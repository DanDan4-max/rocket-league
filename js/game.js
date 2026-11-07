'use strict';
// Rocket League (fan remake) - match logic, rendering, camera, networking hooks
(function (BL) {
  const U = BL.util;
  const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const Phys = BL.Physics, P = BL.PHYS;
  const _v = new V3(), _v2 = new V3(), _v3 = new V3(), _q = new Q(), _q2 = new Q();
  // particle colours are only read: cache them instead of parsing a new colour on every spawn
  const COLS = {}, COL = (hex) => COLS[hex] || (COLS[hex] = new THREE.Color(hex));
  const PODIUM_SECS = 6.5;
  const _hit = { t: 0, x: 0, y: 0, z: 0 };
  const WORLD_UP = new V3(0, 1, 0);
  const hoverTex = {};
  function hoverTexture(icon) {
    if (hoverTex[icon]) return hoverTex[icon];
    const { c, g } = BL.util.canvas(128, 128);
    const glow = g.createRadialGradient(64, 64, 8, 64, 64, 62);
    const col = icon === 'reset' ? '120,220,255' : '255,210,90';
    glow.addColorStop(0, 'rgba(' + col + ',0.9)'); glow.addColorStop(0.55, 'rgba(' + col + ',0.35)'); glow.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
    if (icon === 'reset') {
      // flip reset: a bright ring with a little arrow, like a recharge symbol
      g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 30, 0.5, Math.PI * 1.85); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(96, 50); g.lineTo(84, 70); g.lineTo(104, 72); g.closePath(); g.fill();
    } else if (icon === 'spikes') {
      // a metal ball covered in spikes
      g.fillStyle = '#9aa3b2';
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; g.beginPath(); g.moveTo(64 + Math.cos(a - 0.2) * 22, 64 + Math.sin(a - 0.2) * 22); g.lineTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46); g.lineTo(64 + Math.cos(a + 0.2) * 22, 64 + Math.sin(a + 0.2) * 22); g.fill(); }
      const bg = g.createRadialGradient(56, 56, 4, 64, 64, 26); bg.addColorStop(0, '#f2f4f8'); bg.addColorStop(1, '#4a5160');
      g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 25, 0, Math.PI * 2); g.fill();
    } else {
      const src = BL.RUMBLE_ICON && BL.RUMBLE_ICON[icon];
      if (src) {
        const im = new Image();
        im.onload = () => { g.drawImage(im, 18, 18, 92, 92); t.needsUpdate = true; };
        im.src = src;
      } else { g.fillStyle = '#fff'; BL.drawIcon(g, icon, 64, 64, 70); }
    }
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return (hoverTex[icon] = t);
  }

  let shadowTex = null;
  function getShadowTex() {
    if (shadowTex) return shadowTex;
    const { c, g } = U.canvas(64, 64);
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
    return shadowTex;
  }
  // under the ball, two circles: a ring the ball's size that always stays, and a dark disc inside it that grows as
  // the ball comes down (a dot when it's high, filling the ring when it lands), so you can read where and when it lands
  let ringTex = null, discTex = null;
  function circleTex(ring) {
    const { c, g } = U.canvas(128, 128);
    g.translate(64, 64);
    if (ring) { g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke(); }
    else {
      const gr = g.createRadialGradient(0, 0, 44, 0, 0, 56);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.fill();
    }
    return new THREE.CanvasTexture(c);
  }
  function makeBallMarks(r) {
    const mat = (map, f) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: f });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * r, 2.2 * r), mat(discTex || (discTex = circleTex(false)), -2));
    const ring = new THREE.Mesh(disc.geometry, mat(ringTex || (ringTex = circleTex(true)), -3));
    disc.renderOrder = ring.renderOrder = 1;
    disc.add(ring);
    disc.userData.ring = ring;
    return disc;
  }

  function makeBlob(size) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: getShadowTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.renderOrder = 1;
    return m;
  }

  class Game {
    constructor(cfg) {
      this.cfg = cfg;
      this.mode = cfg.mode || 'soccar';
      this.net = cfg.net || null;
      this.isClient = !!(this.net && this.net.role === 'client');
      this.isHost = !!(this.net && this.net.role === 'host');
      this.online = !!this.net;
      this.netApi = cfg.netApi || BL.Net;
      this.headless = !!cfg.headless;
      this.map = BL.MAP_BY_ID[cfg.mapId] || BL.MAPS[0];
      Phys.setArena(this.map.arena || null);
      this.A = Phys.arena;
      const m = this.mut = Object.assign(BL.defaultMutators(), cfg.mutators || {});
      this.env = {
        gravity: P.gravity * m.gravity, frozen: false,
        unlimitedBoost: m.boost === 'unlimited' || this.mode === 'freeplay' || this.mode === 'heatseeker', noBoost: m.boost === 'none', rechargeBoost: m.boost === 'recharge',
        ballBounce: m.ballBounce, ballMaxSpeed: P.ballMaxSpeed * m.ballSpeed, demolish: m.demolish,
        heatseeker: this.mode === 'heatseeker', hitScale: 1,
      };
      this.timeScale = m.gameSpeed;
      this.slowmo = 1; this.slowT = 0;
      // Heatseeker is like the real game: no clock, first team to 7 goals wins
      this.matchLength = this.mode === 'freeplay' || this.mode === 'heatseeker' ? 0 : m.matchLength;
      this.goalsToWin = this.mode === 'heatseeker' ? 7 : 0;
      this.clock = this.matchLength;
      this.score = [0, 0];
      this.overtime = false; this.clockRunning = false; this.matchOver = false; this.zeroWait = 0;
      this.time = 0; this.tickN = 0; this.acc = 0;
      this.touches = [];
      this.prediction = []; this.predT = 0;
      this.ballCam = BL.Save.p.settings.ballCam && this.mode !== 'freeplay';
      this.shake = 0;
      this.paused = false;

      this.scene = new THREE.Scene();
      this.camera = this.headless ? new THREE.PerspectiveCamera() : BL.App.camera;
      if (this.headless) BL.Models.envMap = null;
      else if (BL.App.quality !== 'low') { this.envTex = BL.App.makeEnvMap(this.map.sky[0], this.map.sky[1], this.map.floor.a); BL.Models.envMap = this.envTex; } else BL.Models.envMap = null;

      this.pads = Phys.padLayout();
      this.padState = this.pads.map((p) => ({ x: p.x, z: p.z, big: p.big, active: true, timer: 0 }));
      this.arena = this.headless ? { setPad() {}, update() {}, flashGoal() {}, setJumbotron() {}, dispose() {} } : BL.Arena.build(this.scene, this.map, this.pads);
      if (!this.headless) BL.FX.attach(this.scene);

      this.ball = new Phys.Ball(P.ballR * m.ballSize);
      if (!this.headless) {
        this.ballMesh = BL.Models.makeBall(this.ball.r, { white: this.mode === 'heatseeker' });
        this.scene.add(this.ballMesh);
        this.ballShadow = makeBallMarks(this.ball.r);
        this.scene.add(this.ballShadow);
      }
      this.ballVis = new V3();
      this.ballOff = new V3();

      this.cars = [];
      for (const p of cfg.players) {
        const car = new Phys.Car(p);
        if (!this.headless) {
          car.model = new BL.Models.CarModel(p.loadout, p.team);
          this.scene.add(car.model.group);
          car.shadow = makeBlob(1.7);
          this.scene.add(car.shadow);
        }
        car.stats = { score: 0, goals: 0, assists: 0, saves: 0, shots: 0, demos: 0, touches: 0, aerialHits: 0, aerialGoals: 0, longGoals: 0, epicSaves: 0 };
        car.visOff = new V3(); car.rq = new Q();
        car.item = null; car.itemTimer = U.rand(4, 8); car.lastItemSeq = 0;
        car.ackSeq = 0;
        this.cars.push(car);
      }
      this.local = this.cars.find((c) => c.isLocal) || null;
      // splitscreen: Player 2 drives a second local car with its own camera (bottom half of the screen)
      this.local2 = this.cars.find((c) => c.isLocal2) || null;
      if (this.local2 && !this.headless) {
        BL.Input.split = true;
        this.view2 = { camera: new THREE.PerspectiveCamera(75, 1, 0.1, 2400), camPos: new V3(), camFwd: new V3(0, 0, 1), camUp: new V3(0, 1, 0), camLook: new V3(), ballCam: this.ballCam, ballEl: null, ballPull: 0 };
        this.view2.camPos.copy(this.local2.pos).add(new V3(0, 2, this.local2.team === 0 ? -4 : 4));
      }
      if (this.local) { this.local.controls.jumpSeq = BL.Input.controls.jumpSeq; this.local.controls.itemSeq = BL.Input.controls.itemSeq; this.local.lastItemSeq = BL.Input.controls.itemSeq; }
      this.carById = {};
      for (const c of this.cars) this.carById[c.id] = c;
      // goal explosions with a 3D model: start loading it now so the first goal has it
      for (const c of this.cars) { const ex = c.loadout && c.loadout.explosion && BL.ITEM_BY_ID[c.loadout.explosion.id]; if (ex) BL.FX.needModel(ex.fx); }

      this.replay = new BL.Replay(this, 9, 30);
      this.inputHist = []; this.inputSeq = 0; this.trustBallUntil = 0;

      this.camPos = new V3(0, 5, -20); this.camFwd = new V3(0, 0, 1); this.camUp = new V3(0, 1, 0); this.camLook = new V3();
      this._onShake = (a) => { if (BL.Save.p.settings.shake) this.shake = Math.max(this.shake, a); };
      BL.bus.on('shake', this._onShake);

      if (!this.headless) {
        BL.HUD.show(this);
        // Free Play keeps the music going the whole time (song after song); matches go quiet for the engines and crowd
        if (this.mode === 'freeplay') { if (BL.Audio.musicOn) BL.Audio.startMusic(); } else BL.Audio.stopMusic();
        BL.Audio.startEngine(); BL.Audio.startCrowd();
        BL.Input.gameActive = true;
        BL.Input.showTouch(true);
      }

      // training packs: scripted shots in Free Play (cfg.drill = 'aerial' | 'striker' | 'goalie')
      this.drill = cfg.drill ? { kind: cfg.drill, name: cfg.drill.toUpperCase() + ' TRAINING', n: 10, i: 0, t: 0, seed: (Math.random() * 1e6) | 0 } : null;
      this.phase = 'countdown'; this.phaseT = 3;
      if (!this.isClient) this.kickoff();
      else this.placeForKickoff([0, 1, 2, 3, 4]);
      // match intro (first kickoff only): the camera flies over the stadium while the teams are shown,
      // then drops in behind your car for the countdown. Uses the countdown time, so clients follow the host.
      this.introLen = this.mode === 'freeplay' ? 0 : 4.5;
      if (!this.isClient) this.phaseT += this.introLen;
      // online matches give everyone a moment to load before the first countdown
      if (!this.isClient && cfg.pregame && this.phase === 'countdown') this.phaseT += cfg.pregame;
      // host/server: hold the first kickoff until every human has loaded (max 15s)
      this.waiting = new Set((!this.isClient && cfg.waitFor) || []);
      this.waitTotal = this.cars.filter((c) => !c.isBot).length;
      this.waitT = 0;
      for (const c of this.cars) if (c.isBot) c.ping = U.randInt(18, 85);
      if (!this.headless) this.snapCamera();
    }

    // ---------- match flow ----------
    placeForKickoff(order) {
      for (const team of [0, 1]) {
        const list = this.cars.filter((c) => c.team === team);
        const spots = Phys.kickoffSpots(team, list.length, order);
        list.forEach((c, i) => {
          const s = spots[i];
          c.place(s.x, s.z, 0, 0);
          c.boost = 33;
          c.visOff.set(0, 0, 0);
          c.rq.copy(c.quat);
        });
      }
    }

    kickoff() {
      if (!this.headless && BL.Anthems) BL.Anthems.stop(); // anthem fades as the next kickoff starts
      const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
      if (this.mode === 'freeplay') {
        this.ball.reset(0, this.ball.r + 2, 0);
        if (this.local) { this.local.place(0, -25, 0, 0); this.local.boost = 100; }
        if (this.local2) { this.local2.place(6, -25, 6, 0); this.local2.boost = 100; }
        this.phase = 'play'; this.phaseT = 0;
        this.clockRunning = false; this.kickoffPending = false;
        if (this.drill) this.drillShot(false);
      } else {
        this.ball.reset(0, this.ball.r, 0);
        if (this.env.heatseeker) {
          // like the real game: the ball hovers on one side (the team that was just scored on; random for the
          // first kickoff) and waits there until someone touches it
          const side = this.lastConceded == null ? (Math.random() < 0.5 ? 0 : 1) : this.lastConceded;
          this.ball.reset(0, 2.2, (side === 0 ? -1 : 1) * this.A.hl * 0.4);
          this.ball.heat = { team: side, speed: 17, wait: true };
        }
        this.placeForKickoff(order);
        this.phase = 'countdown'; this.phaseT = 3; this.lastCount = 4;
        this.kickoffPending = true; this.clockRunning = false;
      }
      this.ballOff.set(0, 0, 0);
      for (let i = 0; i < this.padState.length; i++) { this.padState[i].active = true; this.padState[i].timer = 0; this.arena.setPad(i, true); }
      for (const c of this.cars) { c.lastJumpSeq = c.controls.jumpSeq; c.respawnTimer = 0; c.demolished = false; c.powerHit = false; c.spikesT = 0; c.magnetT = 0; c.grappleT = 0; c.powerT = 0; }
      this.touches = [];
      this.replay.stop();
      this.refreshPrediction();
      if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'kick', o: order });
    }

    startReplay() {
      if (this.mode === 'freeplay' || !this.replay.canPlay()) { this.afterReplay(); return; }
      this.phase = 'replay';
      this.phaseT = this.replay.start() + 0.3;
      this.replaySnap = true;
      this.skipVotes = new Set();
      BL.HUD.replay(true);
      BL.HUD.replaySkip(0, this.humanCount());
      BL.FX.clear();
      if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'replay' });
    }

    humanCount() { return Math.max(1, this.cars.filter((c) => !c.isBot).length); }

    // like the real game: a replay is skipped only once every player has pressed skip (bots don't vote)
    voteSkip(who) {
      if (this.phase !== 'replay' || !this.skipVotes) return;
      this.skipVotes.add(who);
      const n = this.skipVotes.size, of = this.humanCount();
      BL.HUD.replaySkip(n, of);
      if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'skipv', n, of });
      if (n >= of) this.phaseT = Math.min(this.phaseT, 0.05);
    }

    afterReplay() {
      BL.HUD.replay(false);
      this.replay.stop();
      BL.FX.clear();
      if (this.matchOver) { this.endMatch(); return; }
      this.kickoff();
    }

    // ---------- per-frame ----------
    // Latency handling on clients: a lag spike can deliver a burst of host snapshots at once (or an old one late).
    // Only the newest is used, applied once per frame, so the game catches straight back up to the host instead of
    // replaying the backlog; stale ones are dropped.
    queueSnapshot(s) {
      if (this.lastSnapK != null && s.k != null && s.k <= this.lastSnapK) return;
      this.lastSnapK = s.k; this.pendingSnap = s; this.lastSnapAt = performance.now();
    }

    update(dtReal) {
      const I = BL.Input;
      if (this.podium && !this.podium.done && this.podium.t > 1.2 && (I.pressed('pause') || this._podiumSkip)) { this._podiumSkip = false; this.finishPodium(); }
      if (this.pendingSnap) { const s = this.pendingSnap; this.pendingSnap = null; this.applySnapshot(s); }
      if (I.pressed('pause') && this.phase !== 'ended') BL.Menu.togglePause(this);
      const frozenUI = this.paused && !this.online;
      if (I.pressed('ballcam')) this.ballCam = !this.ballCam;
      const onPodium = this.phase === 'ended' && this.podium && !this.podium.done;
      BL.HUD.scoreboard(I.held('scoreboard') || (this.phase === 'ended' && !BL.Menu.postShown && !onPodium));
      this.handleChatKeys();
      if (this.mode === 'freeplay' && I.pressed('reset')) { if (this.drill) this.drillShot(false); else this.freeplayReset(); }
      if (this.mode === 'freeplay' && !this.drill && I.pressed('ballToMe')) this.ballToMe();
      // training pack: a shot that hasn't gone in after 7.5 s moves on (a save, for Goalie)
      if (this.drill && this.phase === 'play' && !this.paused) { this.drill.t += dtReal; if (this.drill.t > 7.5) { if (this.drill.kind === 'goalie' || (this.drill.kind === 'mixed' && this.drill.i % 3 === 1)) this.drill.ok = (this.drill.ok || 0) + 1; this.drillShot(true); } }
      // team line-up over the intro, once the loading screen is gone
      if (!this.holdSim && !this.introShown && this.introLen && this.phase === 'countdown' && this.phaseT > 3.3) {
        this.introShown = true;
        const names = (t) => this.cars.filter((c) => c.team === t).map((c) => c.name).join('  •  ');
        BL.HUD.big(BL.TEAM_NAMES[0] + '  VS  ' + BL.TEAM_NAMES[1], names(0) + '   |   ' + names(1), '#ffffff', Math.min(this.introLen, this.phaseT - 3) - 0.2);
      }
      // jump skips the intro offline
      if (this.phase === 'countdown' && this.phaseT > 3.05 && !this.online && I.pressed('jump')) this.phaseT = 3.05;
      if (this.phase === 'replay' && I.pressed('jump')) {
        if (!this.isClient) this.voteSkip('local');
        else if (!this.mySkip) { this.mySkip = true; this.netApi.sendToHost({ t: 'skip' }); }
      }

      if (!frozenUI && !this.holdSim) {
        if (this.slowT > 0) { this.slowT -= dtReal; this.slowmo = this.slowT > 0 ? 0.35 : 1; }
        const dt = Math.min(dtReal, 0.1) * this.timeScale * this.slowmo;
        this.acc += dt;
        let steps = 0;
        while (this.acc >= P.dt && steps < 8) { this.applyLocalInput(); this.stepTick(P.dt); this.acc -= P.dt; steps++; }
        if (steps >= 8) this.acc = 0;
        BL.FX.update(dt);
      }
      const alpha = U.clamp(this.acc / P.dt, 0, 1);
      if (this.phase === 'replay' && this.replay.playing) this.renderReplay(frozenUI ? 0 : dtReal * this.timeScale);
      else this.renderState(alpha, frozenUI ? 0 : dtReal);
      this.updateCamera(dtReal);
      if (this.view2) this.updateCamera2(dtReal);
      this.arena.update(dtReal, performance.now() / 1000);
      BL.HUD.update(this, dtReal);
      if (this.view2) BL.HUD.split(this);
      const lc = this.local;
      if (lc && !lc.demolished && this.phase !== 'replay') BL.Audio.setEngine(lc.vel.length(), lc.controls.throttle, lc.boosting, true, lc.onGround, lc.controls.handbrake, lc.supersonic);
      else BL.Audio.setEngine(0, 0, false, false);
      if (this.jumboDirty !== this.score[0] + ':' + this.score[1] + ':' + Math.ceil(this.clock)) {
        this.jumboDirty = this.score[0] + ':' + this.score[1] + ':' + Math.ceil(this.clock);
        this.arena.setJumbotron(this.score[0], this.score[1], this.matchLength ? U.fmtClock(this.clock, this.overtime) : '--');
      }
    }

    // dedicated server: advance the simulation only
    serverUpdate(dtReal) {
      const dt = Math.min(dtReal, 0.1) * this.timeScale * (this.slowT > 0 ? 0.35 : 1);
      if (this.slowT > 0) this.slowT -= dtReal;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= P.dt && steps < 12) { this.stepTick(P.dt); this.acc -= P.dt; steps++; }
      if (steps >= 12) this.acc = 0;
    }

    applyLocalInput() {
      const car = this.local;
      if (!car) return;
      const ic = BL.Input.controls, c = car.controls;
      const block = this.paused || this.phase === 'ended' || this.phase === 'replay';
      if (block) {
        c.throttle = 0; c.steer = 0; c.pitch = 0; c.roll = 0; c.boost = false; c.jump = false; c.handbrake = false; c.airRollFree = false;
        c.jumpSeq = ic.jumpSeq; car.lastJumpSeq = ic.jumpSeq; c.itemSeq = ic.itemSeq; car.lastItemSeq = ic.itemSeq;
        // splitscreen: Player 2's pad still gets read, so their jump votes to skip the replay (it needs both votes)
        if (this.local2) {
          const c2 = this.local2.controls, e = BL.Input.readPad2(c2);
          c2.throttle = 0; c2.steer = 0; c2.pitch = 0; c2.roll = 0; c2.boost = false; c2.jump = false; c2.handbrake = false; c2.airRollFree = false;
          this.local2.lastJumpSeq = c2.jumpSeq; this.local2.lastItemSeq = c2.itemSeq;
          if (this.phase === 'replay' && e.jump) this.voteSkip('local2');
        }
        return;
      }
      c.throttle = ic.throttle; c.steer = ic.steer; c.pitch = ic.pitch; c.roll = ic.roll;
      c.boost = ic.boost; c.jump = ic.jump; c.handbrake = ic.handbrake; c.airRollFree = ic.airRollFree;
      c.jumpSeq = ic.jumpSeq; c.itemSeq = ic.itemSeq;
      if (this.local2 && !this.local2.demolished) {
        const e = BL.Input.readPad2(this.local2.controls);
        if (e.ballcam && this.view2) this.view2.ballCam = !this.view2.ballCam;
      }
    }

    // Player 2's camera: run the normal camera logic with Player 2's car and view state swapped in
    updateCamera2(dt) {
      const v = this.view2;
      if (!v) return;
      // (each view keeps its own supersonic FOV kick: a shared one flickered both views)
      const keep = { local: this.local, camera: this.camera, camPos: this.camPos, camFwd: this.camFwd, camUp: this.camUp, camLook: this.camLook, ballCam: this.ballCam, ballEl: this.ballEl, ballPull: this.ballPull, camB: this.camB, ballTip: this.ballTip, camAnchor: this.camAnchor, camAnchorCar: this.camAnchorCar, lookYaw: this.lookYaw, shake: this.shake, fovExtra: this.fovExtra, hfov: BL.App.hfov };
      Object.assign(this, { local: this.local2, camera: v.camera, camPos: v.camPos, camFwd: v.camFwd, camUp: v.camUp, camLook: v.camLook, ballCam: v.ballCam, ballEl: v.ballEl, ballPull: v.ballPull, camB: v.camB, ballTip: v.ballTip, camAnchor: v.camAnchor, camAnchorCar: v.camAnchorCar, lookYaw: v.lookYaw || 0, shake: 0, fovExtra: v.fovExtra || 0 });
      const fov = BL.App.camera.fov;
      this.updateCamera(dt);
      BL.App.camera.fov = fov; BL.App.camera.updateProjectionMatrix(); BL.App.hfov = keep.hfov;
      v.ballEl = this.ballEl; v.ballPull = this.ballPull; v.camB = this.camB; v.ballTip = this.ballTip; v.camAnchor = this.camAnchor; v.camAnchorCar = this.camAnchorCar; v.lookYaw = this.lookYaw; v.fovExtra = this.fovExtra;
      delete keep.hfov;
      Object.assign(this, keep);
    }

    // draw: one full view, or top (Player 1) / bottom (Player 2) in splitscreen
    draw(r, cam) {
      if (!this.view2) { r.render(this.scene, cam); return; }
      // splitscreen side by side: Player 1 on the left half, Player 2 on the right
      const size = r.getSize(_v3), w = size.x, h = size.y, half = Math.floor(w / 2);
      const st = BL.Save.p.settings;
      const vfov = (hf, aspect) => BL.App.vfovFor(hf, aspect, true);
      const c2 = this.view2.camera;
      const keepFov = cam.fov, keepAspect = cam.aspect;
      cam.aspect = half / h; cam.fov = vfov(st.fov, cam.aspect); cam.updateProjectionMatrix();
      c2.aspect = (w - half) / h; c2.fov = cam.fov; c2.updateProjectionMatrix();
      r.setScissorTest(true);
      r.setViewport(0, 0, half, h); r.setScissor(0, 0, half, h); r.render(this.scene, cam);
      r.setViewport(half, 0, w - half, h); r.setScissor(half, 0, w - half, h); r.render(this.scene, c2);
      r.setScissorTest(false); r.setViewport(0, 0, w, h);
      cam.fov = keepFov; cam.aspect = keepAspect; cam.updateProjectionMatrix();
    }

    handleChatKeys() {
      if (BL.Input.pressed('textchat') && !this.headless) BL.HUD.openChat((m) => this.sendChat(m));
      if (this.mode === 'freeplay') return;
      // after the match: the post-game lines (gg, Well played...). On the results screen the D-pad moves round the
      // buttons, so there it's the number keys only.
      const ended = this.phase === 'ended';
      if (ended && BL.Menu.postShown && BL.Input.usingGamepad) return;
      for (let i = 0; i < 4; i++) {
        if (BL.Input.pressed('chat' + (i + 1))) {
          const g = BL.HUD.quickChatGroup();
          if (g < 0) BL.HUD.quickChat(i, ended ? BL.QUICKCHAT_POST : null);
          else {
            const msg = BL.HUD.quickChatLine(g, i);
            BL.HUD.quickChat(-1);
            if (!msg) continue;
            this.sendChat(msg);
            // bots answer a gg now and then
            if (ended && !this.isClient && /gg|well played|fun|what a game/i.test(msg)) for (const c of this.cars) if (c.isBot && Math.random() < 0.45) this.botChat(c, 'gg', 1);
          }
        }
      }
    }
    sendChat(msg) {
      if (!this.local) return;
      const now = performance.now();
      this.chatTimes = (this.chatTimes || []).filter((t) => now - t < 4000);
      if (this.chatTimes.length >= 4) { BL.HUD.chat('System', this.local.team, 'Chat disabled for a few seconds.'); return; }
      this.chatTimes.push(now);
      this.showChat(this.local.id, msg);
      if (this.online) this.netApi.chat(this.local.id, msg);
    }
    showChat(id, msg) { const c = this.carById[id]; if (c) BL.HUD.chat(c.name, c.team, msg); }
    botChat(car, event, chance) {
      if (!car.isBot || this.isClient || Math.random() > (chance || 0.35)) return;
      const msg = BL.AI.chatter(car, event);
      if (!msg) return;
      setTimeout(() => { if (BL.game === this) { this.showChat(car.id, msg); if (this.isHost) this.netApi.broadcast({ t: 'chat', id: car.id, m: msg }); } }, 400 + Math.random() * 1400);
    }

    drillShot(next) {
      const d = this.drill, car = this.local, b = this.ball, A = this.A;
      if (!d || !car) return;
      if (next) d.i = (d.i + 1) % d.n;
      d.t = 0;
      const rnd = U.rng(d.seed + d.i * 7919), R = (a, z) => a + rnd() * (z - a);
      const kind = d.kind === 'mixed' ? ['striker', 'goalie', 'aerial'][d.i % 3] : d.kind;
      if (kind === 'striker') {
        // a pass rolls across in front of you: put it in the far goal
        car.place(R(-6, 6), -26, 0, 40);
        b.reset(R(-18, 18), 1.2, R(-12, -4));
        b.vel.set(-b.pos.x * R(0.4, 0.7), R(0, 3), R(2, 6));
      } else if (kind === 'goalie') {
        // shots come at your net: keep them out
        car.place(0, -A.hl + 4, 0, 0);
        b.reset(R(-20, 20), R(1, 5), R(-6, 8));
        _v.set(R(-A.goalHW + 1.5, A.goalHW - 1.5), R(1, A.goalH - 1.2), -A.hl - 2).sub(b.pos).normalize().multiplyScalar(R(19, 27));
        b.vel.copy(_v); b.vel.y += 2.5;
      } else {
        // aerial: the ball hangs high, fly up and score
        car.place(R(-10, 10), -30, 0, 40);
        b.reset(R(-12, 12), R(9, 14), R(-12, 0));
        b.vel.set(R(-1, 1), R(2, 4), R(1, 3));
      }
      car.boost = 100; car.vel.set(0, 0, 0); car.angVel.set(0, 0, 0);
      this.phase = 'play';
      if (!this.headless) BL.HUD.big('SHOT ' + (d.i + 1) + ' / ' + d.n, d.name, '#ffffff', 1.3);
    }

    // Free Play: the ball is passed to you from wherever it is and drops just in front of your car about a second later
    ballToMe() {
      const c = this.local, b = this.ball, A = BL.Physics.arena;
      if (!c || c.demolished) return;
      b.hidden = false; b.frozen = 0; b.stuckTo = null;
      const T = U.clamp(b.pos.distanceTo(c.pos) / 28, 0.8, 1.5);
      _v.copy(c.pos).addScaledVector(c.fwd, 5 + c.vel.dot(c.fwd) * T * 0.9);
      _v.x = U.clamp(_v.x, -A.hw + 3, A.hw - 3); _v.z = U.clamp(_v.z, -A.hl + 3, A.hl - 3); _v.y = b.r + 1.4;
      const g = this.env.gravity;
      b.vel.set((_v.x - b.pos.x) / T, (_v.y - b.pos.y + 0.5 * g * T * T) / T, (_v.z - b.pos.z) / T);
      b.angVel && b.angVel.set(0, 0, 0);
      this.phase = 'play';
      BL.Audio.play('whoosh', 0.6);
    }
    freeplayReset() {
      this.ball.reset(0, this.ball.r + 2, 0);
      if (this.local) {
        const c = this.local;
        _v.set(c.pos.x, 0, c.pos.z);
        this.ball.reset(U.clamp(c.pos.x + c.fwd.x * 12, -30, 30), 4, U.clamp(c.pos.z + c.fwd.z * 12, -40, 40));
        this.ball.vel.set(0, 2, 0);
      }
      this.phase = 'play';
    }

    // ---------- simulation tick ----------
    stepTick(dt) {
      this.tickN++;
      this.time += dt;
      const ball = this.ball;
      for (const c of this.cars) { c.prevPos.copy(c.pos); c.prevQuat.copy(c.quat); }
      ball.prevPos.copy(ball.pos); ball.prevQuat.copy(ball.quat);

      if (!this.isClient) this.phaseLogic(dt);
      this.env.frozen = this.phase === 'countdown';
      if (this.phase === 'replay' || this.phase === 'ended') {
        if (this.phase === 'ended') { this.endT = (this.endT || 0) + dt; if (this.podium && !this.podium.done) this.podiumStep(dt); }
        return;
      }

      // bots
      if (!this.isClient) for (const c of this.cars) if (c.isBot) BL.AI.think(c, this, dt);

      // client: record inputs for reconciliation
      if (this.isClient && this.local) {
        const c = this.local.controls;
        this.inputSeq++;
        this.inputHist.push({ seq: this.inputSeq, throttle: c.throttle, steer: c.steer, pitch: c.pitch, roll: c.roll, airRollFree: c.airRollFree, jump: c.jump, jumpSeq: c.jumpSeq, boost: c.boost, handbrake: c.handbrake, itemSeq: c.itemSeq });
        if (this.inputHist.length > 180) this.inputHist.shift();
        if (this.tickN % 2 === 0) this.netApi.sendInput(this.inputSeq, c);
      }

      // the goal blast's clock (see goalBlastCar)
      if (this.goalBlast) { const B = this.goalBlast; B.t += dt; if (B.t > (B.kind === 'push' ? 0.05 : B.kind === 'pull' ? 1.2 : 1.4)) this.goalBlast = null; }
      // cars
      for (const c of this.cars) {
        if (c.demolished) {
          if (!this.isClient) { c.respawnTimer -= dt; if (c.respawnTimer <= 0) this.respawn(c); }
          continue;
        }
        if (this.mode === 'rumble' && !this.isClient) this.rumbleCar(c, dt);
        if (this.goalBlast && !this.isClient) this.goalBlastCar(c, dt);
        Phys.stepCar(c, dt, this.env);
        this.carEvents(c);
      }
      // ball
      if (ball.stuckTo && !ball.stuckTo.demolished) {
        const s = ball.stuckTo;
        ball.pos.copy(s.pos).addScaledVector(s.up, s.hy + ball.r * 0.95).addScaledVector(s.fwd, 0.15);
        ball.vel.copy(s.vel);
        if (this.isClient) { /* host releases */ } else if (s.spikesT <= 0) this.releaseSpikes(s);
      } else {
        if (ball.stuckTo) ball.stuckTo = null;
        Phys.stepBall(ball, dt, this.env);
        if (ball.bounced) { if (ball.bounced > 3 && this.phase !== 'replay') BL.Audio.play('hit', Math.min(0.5, ball.bounced / 40)); ball.bounced = 0; }
      }
      // collisions
      let touched = null;
      for (const c of this.cars) {
        if (ball.stuckTo === c) continue;
        const t = Phys.collideCarBall(c, ball, this.env, this.time);
        if (t) { this.onTouch(c, t); touched = c; }
      }
      for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
        const ev = Phys.collideCars(this.cars[i], this.cars[j], this.env);
        if (!ev) continue;
        if (ev.type === 'demo' && !this.isClient) this.onDemo(ev.attacker, ev.victim);
        else if (ev.type === 'bump' && ev.strength > 5) BL.Audio.play('bump', Math.min(1, ev.strength / 20) * this.volFor(ev.victim));
      }
      if (!this.isClient) {
        this.padLogic(dt);
        // goal check
        if (this.phase === 'play' || this.phase === 'countdown') {
          const g = Phys.goalCheck(ball);
          if (g >= 0) this.onGoal(g);
        }
        this.clockLogic(dt);
        this.forfeitCheck(dt);
        if (this.pendingEval && touched === null) this.evalTouch();
      }
      this.predT -= dt;
      if (this.predT <= 0 || touched) { this.refreshPrediction(); if (touched && !this.isClient) this.evalTouch(); }
      // replays show play only (not the frozen kickoff countdown)
      if (this.phase === 'play' || this.phase === 'goal') this.replay.record(dt);
      if (this.isHost && this.tickN % (this.cars.filter((c) => !c.isBot).length > 4 ? 6 : 4) === 0) (this.netApi.broadcastFast || this.netApi.broadcast)(this.makeSnapshot());
    }

    volFor(car) {
      if (!this.local || car === this.local) return 1;
      const d = car.pos.distanceTo(this.local.pos);
      return U.clamp(1 - d / 60, 0.08, 1);
    }

    carEvents(c) {
      if (!c.events.length) return;
      const v = this.volFor(c);
      for (const e of c.events) {
        if (e === 'jump') BL.Audio.play('jump', v);
        else if (e === 'djump') BL.Audio.play('doublejump', v);
        else if (e === 'dodge') { BL.Audio.play('dodge', v); this.gasPuff(c, 14, 1.4); if (c.spikesT > 0 && this.ball.stuckTo === c && !this.isClient) this.releaseSpikes(c, true); }
        else if (e === 'land' && c.airTime > 0.4) BL.Audio.play('land', v * 0.7);
        else if (e === 'flipReset') { BL.Audio.play('padSmall', v); c.flipResetShow = true; this.flipResetBurst(c); }
        else if (e === 'airroll') this.gasPuff(c, 6, 0.8);
      }
      c.events.length = 0;
    }

    refreshPrediction() {
      Phys.predictBall(this.ball, 4, 1 / 30, this.env, this.prediction);
      this.predT = 0.1;
      // a shot ends once the ball stops heading for that goal (post, save, miss)
      if (this.lastShot && Phys.predictedGoal(this.prediction, 3.5) !== 1 - this.lastShot.team) this.lastShot = null;
    }

    playerLoaded(pid) { this.waiting.delete(pid); }

    phaseLogic(dt) {
      if (this.phase === 'countdown' && this.waiting.size && this.waitT < 15) {
        this.waitT += dt;
        this.phaseT = Math.max(this.phaseT, 3.3);
        if (Math.floor(this.waitT) !== Math.floor(this.waitT - dt)) {
          const msg = { t: 'ev', e: 'wait', n: this.waitTotal - this.waiting.size, total: this.waitTotal };
          this.netApi.broadcast(msg);
          if (!this.headless) this.onNetEvent(msg);
        }
        return;
      }
      if (this.tickN % 600 === 0) for (const c of this.cars) if (c.isBot) c.ping = U.clamp((c.ping || 40) + U.randInt(-6, 6), 12, 140);
      if (this.phase === 'countdown') {
        this.phaseT -= dt;
        const n = Math.ceil(this.phaseT);
        if (n !== this.lastCount && n > 0 && n <= 3) { this.lastCount = n; this.countVisual(n); if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'count', n }); }
        if (this.phaseT <= 0) {
          this.phase = 'play';
          this.countVisual(0);
          if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'count', n: 0 });
        }
      } else if (this.phase === 'goal') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) {
          if (this.drill) this.drillShot(true);
          else if (this.mode === 'freeplay') { this.ball.reset(0, this.ball.r + 2, 0); this.phase = 'play'; }
          else if (this.matchOver && !this.replay.canPlay()) this.endMatch();
          else this.startReplay();
        }
      } else if (this.phase === 'replay') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.afterReplay();
      }
    }

    countVisual(n) {
      if (n > 0) { BL.HUD.big(String(n), this.overtime ? 'OVERTIME' : '', '#ffffff', 0.9); BL.Audio.play('count'); }
      else { BL.HUD.big('GO!', '', '#ffd23f', 0.8); BL.Audio.play('go'); }
    }

    clockLogic(dt) {
      if (this.phase !== 'play' || !this.clockRunning) return;
      this.playTime = (this.playTime || 0) + dt; // seconds of real play (XP is earned per second, like the real game)
      if (this.matchLength <= 0) return;
      if (this.overtime) { this.clock += dt; return; }
      this.clock -= dt;
      if (this.clock <= 0) {
        this.clock = 0;
        this.zeroWait += dt;
        const onGround = this.ball.pos.y < this.ball.r + 0.4;
        if (onGround || this.zeroWait > 6) this.timeUp();
      }
    }

    timeUp() {
      if (this.score[0] === this.score[1]) {
        this.overtime = true;
        this.clock = 0;
        this.zeroWait = 0;
        this.bigAll('OVERTIME', 'Next goal wins!', '#ffd23f', 2.5);
        BL.Audio.play('buzzer');
        this.kickoff();
      } else this.endMatch();
    }

    bigAll(text, sub, color, dur) {
      BL.HUD.big(text, sub, color, dur);
      if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'big', text, sub, color, dur });
    }

    padLogic(dt) {
      const ps = this.padState;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!p.active) {
          p.timer -= dt;
          if (p.timer <= 0) { p.active = true; this.arena.setPad(i, true); }
          continue;
        }
        const r2 = p.big ? 2.08 * 2.08 : 1.44 * 1.44;
        for (const c of this.cars) {
          if (c.demolished || c.boost >= 100 || this.env.unlimitedBoost) continue;
          const dx = c.pos.x - p.x, dz = c.pos.z - p.z;
          if (dx * dx + dz * dz < r2 && c.pos.y < 1.9) {
            c.boost = Math.min(100, c.boost + (p.big ? 100 : 12));
            p.active = false; p.timer = p.big ? 10 : 4;
            this.arena.setPad(i, false);
            if (c.isLocal) BL.Audio.play(p.big ? 'padBig' : 'padSmall');
            break;
          }
        }
      }
    }

    respawn(c) {
      const mates = this.cars.filter((o) => o.team === c.team);
      const s = Phys.respawnSpot(c.team, mates.indexOf(c));
      c.place(s.x, s.z, s.x, s.z + (c.team === 0 ? 10 : -10));
      c.boost = 33;
      c.visOff.set(0, 0, 0); c.rq.copy(c.quat);
      if (c.isLocal) BL.HUD.spectate(null);
    }

    // ---------- events ----------
    onTouch(car, t) {
      if (t.fresh) {
        BL.Audio.play('hit', Math.min(1, t.strength / 30) * this.volFor(car));
        BL.FX.hit(t.point, t.strength);
        if (car.isLocal) this.trustBallUntil = this.time + (this.netApi.rtt || 0.1) * 1.3 + 0.05;
      }
      if (this.isClient) return;
      if (this.kickoffPending) { this.kickoffPending = false; this.clockRunning = true; }
      if (!t.fresh) return;
      const aerial = !car.onGround && this.ball.pos.y > 2.5;
      this.touches.push({ car, t: this.time, aerial, x: car.pos.x, z: car.pos.z });
      if (this.touches.length > 30) this.touches.shift();
      car.stats.touches++;
      // touches earn a few points quietly (no pop-up); aerial touches more, high ones the most
      car.stats.score += 2;
      if (aerial) { car.stats.aerialHits++; car.stats.score += this.ball.pos.y > 6 ? 10 : 5; }
      if (this.env.heatseeker) this.ball.heat = { team: car.team, speed: Math.min(50, (this.ball.heat ? this.ball.heat.speed : 17) + 3), fresh: true };
      if (this.mode === 'rumble' && car.spikesT > 0 && !this.ball.stuckTo) { this.ball.stuckTo = car; BL.Audio.play('punch', 0.4); }
      if (car.grappleT > 0) car.grappleT = 0;
      this.pendingEval = { car, ownDanger: Phys.predictedGoal(this.prediction, 2.5) === car.team, fast: this.ball.vel.length() };
    }

    evalTouch() {
      const e = this.pendingEval;
      this.pendingEval = null;
      if (!e) return;
      const car = e.car;
      const g = Phys.predictedGoal(this.prediction, 3.5);
      if (e.ownDanger && g !== car.team) {
        const epic = !car.onGround || e.fast > 30;
        car.stats.saves++;
        if (epic) car.stats.epicSaves++;
        this.addScore(car, epic ? 75 : 50, epic ? 'EPIC SAVE' : 'SAVE');
        // the saver's anthem plays out in the stadium for everyone (online players get it from the host)
        if (!this.headless && BL.Anthems) BL.Anthems.playNear(car, 'save');
        if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'anth', c: car.id });
        this.botChat(this.cars.find((o) => o.team !== car.team && o.isBot) || car, 'save', 0.3);
      } else if (g === 1 - car.team) {
        // one shot per attack: more touches on a ball already going in (pushing it, dribbling) don't count again
        const ls = this.lastShot;
        if (ls && ls.team === car.team && !this.touches.some((tt) => tt.t > ls.t && tt.car.team !== car.team)) return;
        this.lastShot = { team: car.team, t: this.time };
        car.stats.shots++;
        this.addScore(car, 20, 'SHOT ON GOAL');
      }
    }

    addScore(car, pts, label) {
      car.stats.score += pts;
      if (label) this.popup(car, label, pts);
      if (label && (car === this.local || car === this.local2)) BL.Audio.play('stat', 0.55);
    }

    popup(car, text, pts) {
      if (car.isLocal) BL.HUD.popup(text, pts, BL.TEAM_MAIN[car.team]);
      else if (this.isHost && !car.isBot && car.pid) this.netApi.sendTo(car.pid, { t: 'ev', e: 'pop', text, pts });
    }

    onDemo(attacker, victim) {
      victim.demolished = true;
      victim.respawnTimer = 3;
      victim.boosting = false;
      if (this.ball.stuckTo === victim) this.ball.stuckTo = null;
      attacker.stats.demos++;
      this.addScore(attacker, 25, 'DEMOLITION');
      this.demoVisual(attacker.id, victim.id);
      if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'demo', a: attacker.id, v: victim.id });
      this.botChat(attacker, 'demo', 0.25);
    }
    demoVisual(aid, vid) {
      const a = this.carById[aid], v = this.carById[vid];
      if (!a || !v) return;
      v.demolished = true;
      BL.FX.demo(v.pos.clone(), BL.TEAM_MAIN[v.team]);
      BL.Audio.play('demo', this.volFor(v));
      BL.HUD.feed(`<b style="color:${BL.TEAM_MAIN[a.team]}">${U.esc(a.name)}</b> ${BL.ICON('demo', 15)} <b style="color:${BL.TEAM_MAIN[v.team]}">${U.esc(v.name)}</b>`);
      if (v.isLocal) { BL.HUD.spectate('DEMOLISHED BY ' + a.name.toUpperCase() + ' — respawning...'); this.shake = Math.max(this.shake, 0.6); }
    }

    onGoal(team) {
      const ball = this.ball;
      this.score[team]++;
      // scorer = last touch by scoring team
      let scorer = null, assist = null, scorerTouch = null;
      for (let i = this.touches.length - 1; i >= 0; i--) {
        if (this.touches[i].car.team === team) { scorer = this.touches[i].car; scorerTouch = this.touches[i]; break; }
      }
      if (scorerTouch) {
        for (let i = this.touches.indexOf(scorerTouch) - 1; i >= 0; i--) {
          const t = this.touches[i];
          if (t.car === scorer) continue;
          if (t.car.team === team && scorerTouch.t - t.t < 5) assist = t.car;
          break;
        }
      }
      const ownGoal = !scorer && this.touches.length > 0;
      if (scorer) {
        scorer.stats.goals++;
        this.addScore(scorer, 100, 'GOAL');
        if (scorerTouch.aerial) { scorer.stats.aerialGoals++; this.addScore(scorer, 25, 'AERIAL GOAL'); }
        const gz = team === 0 ? this.A.hl : -this.A.hl;
        if (Math.abs(scorerTouch.z - gz) > this.A.hl * 1.05) { scorer.stats.longGoals++; this.addScore(scorer, 20, 'LONG GOAL'); }
        if (scorer.stats.goals === 3) scorer.stats.hatTricks = (scorer.stats.hatTricks || 0) + 1; // counted, no pop-up
      }
      if (assist) { assist.stats.assists++; this.addScore(assist, 50, 'ASSIST'); }
      const lo = scorer ? scorer.loadout : null;
      const ex = lo && lo.explosion ? lo.explosion : { id: 'explosion_classic' };
      const exDef = BL.ITEM_BY_ID[ex.id] || BL.ITEM_BY_ID.explosion_classic;
      const data = { team, scorer: scorer ? scorer.id : -1, assist: assist ? assist.id : -1, x: ball.pos.x, y: ball.pos.y, z: ball.pos.z, fx: exDef.fx, paint: ex.paint || null, own: ownGoal };
      this.goalVisual(data);
      if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'goal', d: data });
      // the explosion moves the cars near the goal: knocked back, sucked in or slung round, by explosion
      this.goalBlast = { kind: exDef.force || 'push', x: ball.pos.x, y: Math.max(1, ball.pos.y), z: ball.pos.z, t: 0, hit: new Set() };
      this.phase = 'goal';
      this.phaseT = this.mode === 'freeplay' ? 2.5 : 3;
      this.clockRunning = false;
      if (this.overtime) this.matchOver = true;
      if (this.goalsToWin && this.score[team] >= this.goalsToWin) this.matchOver = true;
      this.lastConceded = 1 - team;
      for (const c of this.cars) if (c.isBot && Math.random() < 0.5) this.botChat(c, c.team === team ? 'goalFor' : 'goalAgainst', 0.4);
    }

    goalVisual(d) {
      const ball = this.ball;
      ball.hidden = true;
      ball.stuckTo = null;
      _v.set(d.x, d.y, d.z);
      const paint = d.paint ? BL.PAINT_BY_ID[d.paint].color : null;
      BL.FX.goalExplosion(d.fx, _v, BL.TEAM_MAIN[d.team], paint);
      this.arena.flashGoal(1 - d.team);
      this.goalCelebration(d);
      BL.Audio.play('horn'); BL.Audio.cheer(1);
      this.slowT = this.mode === 'freeplay' ? 0 : 0.7;
      this.replay.markGoal();
      this.lastGoal = d;
      const scorer = this.carById[d.scorer];
      // the scorer's player anthem plays for everyone through the replay
      if (!this.headless && BL.Anthems && scorer) BL.Anthems.playNear(scorer, 'goal');
      const title = this.mode === 'freeplay' ? 'GOAL!' : BL.TEAM_NAMES[d.team] + ' SCORES!';
      BL.HUD.big(title, scorer ? scorer.name + (d.assist >= 0 && this.carById[d.assist] ? '  •  assist ' + this.carById[d.assist].name : '') : (d.own ? 'Own goal!' : ''), BL.TEAM_MAIN[d.team], 2.6);
      if (scorer && this.mode !== 'freeplay') BL.HUD.feed(`${BL.ICON('goal', 15)} <b style="color:${BL.TEAM_MAIN[d.team]}">${U.esc(scorer.name)}</b> scored`);
    }

    // bots give up a lost cause like real players do: a team of bots that is 3+ goals down with under 2 minutes
    // left (or 5+ down at any point, 4+ in first-to-7 Heatseeker) votes to forfeit
    forfeitCheck(dt) {
      if (this.mode === 'freeplay' || this.phase !== 'play' || this.isClient || this.cfg.drill) return;
      this.ffT = (this.ffT || 0) + dt;
      if (this.ffVote && this.time > this.ffVote.until) { this.bigAll('FORFEIT VOTE FAILED', 'Not everyone agreed', '#ff8a8a', 1.8); this.ffVote = null; }
      if (this.ffT < 2) return;
      this.ffT = 0;
      if ((this.playTime || 0) < 60) return;
      for (const t of [0, 1]) {
        const team = this.cars.filter((c) => c.team === t);
        if (!team.length || team.some((c) => !c.isBot)) continue;
        const down = this.score[1 - t] - this.score[t];
        const late = this.matchLength > 0 && !this.overtime && this.clock < 120;
        if ((down >= 3 && late) || down >= 5 || (this.goalsToWin && down >= 4)) {
          this.forfeited = t;
          this.bigAll(BL.TEAM_NAMES[t].toUpperCase() + ' FORFEITED', 'The other team voted to forfeit', '#ffffff', 2.5);
          this.endMatch();
          return;
        }
      }
    }

    // a team gives up: the other team wins
    forfeitTeam(t) {
      if (this.phase === 'ended') return;
      this.forfeited = t; this.ffVote = null;
      this.bigAll(BL.TEAM_NAMES[t].toUpperCase() + ' FORFEITED', 'The other team wins', '#ffffff', 2.5);
      this.endMatch();
    }
    // forfeit vote (host / offline): every real player on the team has to say yes within 20 s. A splitscreen pair
    // counts as one voter; bots don't get a vote.
    voters(team) {
      const ppl = this.cars.filter((c) => c.team === team && !c.isBot && !(c.isLocal2 && this.local && this.local.team === team));
      return ppl.map((c) => c.id);
    }
    castForfeit(carId) {
      const car = this.carById[carId];
      if (!car || this.phase === 'ended' || this.isClient || this.mode === 'freeplay') return null;
      const team = car.team, need = this.voters(team);
      let v = this.ffVote;
      if (!v || v.team !== team) v = this.ffVote = { team, yes: new Set(), until: this.time + 20 };
      v.yes.add(car.isLocal2 && this.local ? this.local.id : carId);
      const n = need.filter((id) => v.yes.has(id)).length;
      if (n >= need.length) { this.forfeitTeam(team); return { done: true }; }
      this.bigAll('FORFEIT VOTE', BL.TEAM_NAMES[team] + ': ' + n + ' / ' + need.length + ' voted yes', '#ffd27a', 2.2);
      return { done: false, n, of: need.length };
    }

    endMatch() {
      if (this.phase === 'ended') return;
      this.phase = 'ended';
      this.endT = 0;
      // a forfeit hands the win to the other team whatever the score
      const winner = this.forfeited != null && this.forfeited >= 0 ? 1 - this.forfeited : this.score[0] === this.score[1] ? -1 : (this.score[0] > this.score[1] ? 0 : 1);
      let mvp = null;
      for (const c of this.cars) if (c.team === winner && (!mvp || c.stats.score > mvp.stats.score)) mvp = c;
      const results = {
        winner, score: this.score.slice(), mode: this.mode, mapId: this.map.id, ranked: this.cfg.ranked || null, online: this.online,
        mvp: mvp ? mvp.id : -1,
        players: this.cars.map((c) => ({ id: c.id, name: c.name, team: c.team, isBot: c.isBot, skill: c.isBot ? c.skill : null, stats: Object.assign({}, c.stats) })),
        forfeit: this.forfeited == null ? -1 : this.forfeited,
        localId: this.local ? this.local.id : -1, botSkill: this.cfg.botSkill, playSecs: Math.round(this.playTime || 0),
      };
      this.results = results;
      this.endVisual(results);
      if (this.isHost) this.netApi.broadcast({ t: 'ev', e: 'end', r: results });
      for (const c of this.cars) if (c.isBot) this.botChat(c, c.team === winner ? 'win' : 'lose', 0.5);
    }

    endVisual(r) {
      this.phase = 'ended';
      this.results = r;
      BL.Audio.play('buzzer');
      BL.Audio.cheer(1);
      const txt = r.winner < 0 ? 'DRAW' : BL.TEAM_NAMES[r.winner] + ' WINS!';
      BL.HUD.big(txt, r.score[0] + ' - ' + r.score[1], r.winner < 0 ? '#fff' : BL.TEAM_MAIN[r.winner], 3);
      BL.Input.showTouch(false);
      // the winning team on the podium for a few seconds (dance, accolades), then the results
      this.setupPodium(r);
      const wait = this.podium ? PODIUM_SECS * 1000 : 3200;
      this.podiumTimer = setTimeout(() => this.finishPodium(), wait);
    }

    // the scoring end celebrates: confetti cannons fire from both posts of the net back over the pitch, and fireworks
    // go up over the stands behind it
    goalCelebration(d) {
      if (this.headless || !BL.FX.confetti) return;
      const A = this.A, s = d.z >= 0 ? 1 : -1, col = BL.TEAM_MAIN[d.team], cols = [col, col, U.shade(col, 0.35), '#ffffff', '#ffd23f'];
      for (const sx of [-1, 1]) BL.FX.confetti({ x: sx * A.goalHW, y: A.goalH * 0.85, z: s * A.hl }, 80, { spread: 0.5, colors: cols, vy: 10, vOut: 3, vz: -s * 7 });
      const n = BL.App.potato ? 2 : 4;
      for (let i = 0; i < n; i++) BL.FX.fireworkLaunch((Math.random() - 0.5) * A.hw * 1.3, s * (A.hl + 8 + Math.random() * 12), 26 + Math.random() * 8, i % 2 ? '#ffffff' : col, 0.1 + i * 0.4, 2.2);
    }

    // ---------- end-of-match podium ----------
    // The winning team lines up at centre field facing the camera, MVP in the middle, with accolades over each car.
    // The cars stay parked on their spots (nobody can drive, jump or boost); quick chat switches to the post-game
    // lines so everyone can say gg.
    setupPodium(r) {
      if (this.headless || this.mode === 'freeplay' || this.cfg.drill) return;
      const team = r.winner >= 0 ? r.winner : (this.local ? this.local.team : 0);
      const ranked = this.cars.filter((c) => c.team === team).sort((a, b) => (b.id === r.mvp) - (a.id === r.mvp) || b.stats.score - a.stats.score);
      if (!ranked.length) return;
      const order = [];
      ranked.forEach((c, i) => { if (i % 2) order.push(c); else order.unshift(c); });
      this.podium = { team, cars: order, t: 0, labels: null };
      const gap = 3.2;
      order.forEach((c, i) => {
        const x = (i - (order.length - 1) / 2) * gap;
        c.demolished = false; c.respawnTimer = 0;
        c.place(x, 0, x, 30);
        c.vel.set(0, 0, 0); c.angVel.set(0, 0, 0); c.boost = 100;
        c.podiumX = x;
        c.prevPos.copy(c.pos); c.prevQuat.copy(c.quat);
      });
      for (const c of this.cars) c.offPodium = order.indexOf(c) < 0;
      this.ball.hidden = true;
      // the stage (the MVP on the raised middle spot), a shower of confetti, fireworks behind (see podiumStep)
      if (!this.headless && BL.Arena.podiumStage) {
        const mi = order.indexOf(ranked[0]);
        const stage = this.podium.stage = BL.Arena.podiumStage(this.scene, BL.TEAM_MAIN[team], (mi - (order.length - 1) / 2) * gap, (order.length - 1) * gap + 3);
        order.forEach((c) => { c.podiumLift = c === ranked[0] ? stage.mvpLift : stage.lift; });
        const col = BL.TEAM_MAIN[team];
        this.podium.confetti = [col, col, U.shade(col, 0.35), '#ffffff', '#ffd23f'];
        // (centred a little behind the cars so no piece falls right in front of the podium camera)
        BL.FX.confetti({ x: 0, y: 7, z: -2 }, 260, { spread: stage.R + 1, colors: this.podium.confetti, vy: -2 });
        this.podium.fwT = 0.4; this.podium.cfT = 0.3;
      }
      // name + accolades for each car on the podium
      const st = (c) => (r.players.find((p) => p.id === c.id) || {}).stats || c.stats;
      const acc = (c) => {
        const s = st(c), out = [];
        if (c.id === r.mvp) out.push('MVP');
        if ((s.goals || 0) >= 3) out.push('HAT TRICK');
        if ((s.saves || 0) >= 3) out.push('SAVIOR');
        if ((s.assists || 0) >= 3) out.push('PLAYMAKER');
        if ((s.demos || 0) >= 2) out.push('DEMOLITION');
        if ((s.aerialGoals || 0) >= 1) out.push('AERIAL GOAL');
        if ((s.epicSaves || 0) >= 1) out.push('EPIC SAVE');
        if (!out.length && (s.score || 0) >= 300) out.push((s.score || 0) + ' POINTS');
        return out;
      };
      const el = document.createElement('div');
      el.id = 'podium'; el.className = 'podium';
      const pad = BL.Input.usingGamepad;
      el.innerHTML = '<div class="pd-hint">QUICK CHAT ' + (pad ? 'D-PAD' : '1 - 4') + ' &bull; ' + (pad ? 'START' : 'ENTER') + ' TO SKIP</div>' +
        order.map((c) => '<div class="pd-tag t' + c.team + '" data-car="' + c.id + '"><b>' + U.esc(c.name) + '</b>' + acc(c).map((a) => '<i class="' + (a === 'MVP' ? 'mvp' : '') + '">' + a + '</i>').join('') + '</div>').join('');
      document.body.appendChild(el);
      this.podium.labels = el;
    }
    podiumStep(dt) {
      const P0 = this.podium;
      P0.t += dt;
      if (P0.stage) {
        // fireworks keep going up behind the stage, confetti keeps falling
        if ((P0.fwT -= dt) <= 0) { P0.fwT = 0.45 + Math.random() * 0.5; BL.FX.fireworkLaunch(U.rand(-24, 24), U.rand(-34, -16), U.rand(13, 21), Math.random() < 0.7 ? BL.TEAM_MAIN[P0.team] : U.choice(['#ffd23f', '#ffffff']), 0); }
        if ((P0.cfT -= dt) <= 0) { P0.cfT = 0.25; BL.FX.confetti({ x: 0, y: 7.5, z: -2 }, 16, { spread: P0.stage.R + 1, colors: P0.confetti }); }
      }
      for (const c of P0.cars) {
        // parked: no driving, jumping, boosting or rolling for anyone (players or bots); physics only settles the car
        const ct = c.controls;
        ct.throttle = 0; ct.steer = 0; ct.pitch = 0; ct.roll = 0; ct.boost = false; ct.jump = false; ct.handbrake = false; ct.airRollFree = false;
        c.lastJumpSeq = ct.jumpSeq;
        Phys.stepCar(c, dt, this.env);
        c.events.length = 0;
        // never wander off the line
        if (c.onGround && Math.abs(c.pos.x - c.podiumX) + Math.abs(c.pos.z) > 1.5) { c.pos.x += (c.podiumX - c.pos.x) * 0.1; c.pos.z *= 0.9; }
      }
    }
    finishPodium() {
      if (BL.game !== this || (this.podium && this.podium.done)) return;
      clearTimeout(this.podiumTimer);
      if (this.podium) {
        this.podium.done = true;
        if (this.podium.labels) this.podium.labels.remove();
        if (this.podium.stage) { this.podium.stage.dispose(); this.podium.stage = null; }
        for (const c of this.cars) { c.offPodium = false; c.podiumLift = 0; }
      }
      BL.Menu.postMatch(this, this.results);
    }

    // ---------- rumble ----------
    rumbleCar(c, dt) {
      if (this.phase !== 'play') return;
      const tor = this.tornado;
      if (tor && c === this.cars[0]) {
        tor.t -= dt; tor.x += tor.vx * dt; tor.z += tor.vz * dt;
        const pull = (body, k) => {
          const dx = tor.x - body.pos.x, dz = tor.z - body.pos.z, d = Math.hypot(dx, dz);
          if (d > 9) return;
          const s = (1 - d / 9) * k * dt;
          body.vel.x += (dx / (d || 1)) * s * 0.6 - (dz / (d || 1)) * s; body.vel.z += (dz / (d || 1)) * s * 0.6 + (dx / (d || 1)) * s;
          body.vel.y += s * 1.4;
        };
        if (!this.ball.hidden) pull(this.ball, 26);
        for (const o of this.cars) if (!o.demolished) pull(o, 18);
        if (Math.random() < 0.8) BL.FX.alpha.spawn(tor.x + (Math.random() - 0.5) * 3, Math.random() * 8, tor.z + (Math.random() - 0.5) * 3, 0, 4, 0, COL('#d7dde8'), COL('#8a94a6'), 1.4, 2.6, 0.8, 0, 0.5, BL.FX.S.smoke, 0.35);
        if (tor.t <= 0) this.tornado = null;
      }
      if (!c.item) { c.itemTimer -= dt; if (c.itemTimer <= 0) { c.item = this.cfg.itemPool ? U.choice(this.cfg.itemPool) : U.choice(BL.RUMBLE_ITEMS).id; c.itemTimer = 10; if (c.isLocal) BL.Audio.play('item'); } }
      if (c.controls.itemSeq !== c.lastItemSeq) { c.lastItemSeq = c.controls.itemSeq; if (c.item) this.useItem(c); }
      if (c.isBot && c.item && BL.AI.wantItem(c, this, dt)) { c.itemHeld = 0; this.useItem(c); }
      const ball = this.ball;
      if (c.spikesT > 0) c.spikesT -= dt;
      if (c.powerT > 0) { c.powerT -= dt; if (c.powerT <= 0) c.powerHit = false; }
      if (c.magnetT > 0) {
        c.magnetT -= dt;
        _v.copy(c.pos).addScaledVector(c.fwd, 1.6).sub(ball.pos);
        const d = _v.length();
        if (d < 28 && !ball.hidden) ball.vel.addScaledVector(_v.normalize(), 16 * dt);
      }
      if (c.disruptT > 0) {
        c.disruptT -= dt;
        const ct = c.controls, w = this.time * 7 + c.id;
        ct.steer = U.clamp(ct.steer + Math.sin(w) * 0.9, -1, 1); ct.throttle = U.clamp(ct.throttle * (Math.sin(w * 0.6) > -0.4 ? 1 : -1), -1, 1);
      }
      if (c.plungeT > 0) c.plungeT -= dt;
      if (c.grappleT > 0) {
        c.grappleT -= dt;
        _v.copy(ball.pos).sub(c.pos).normalize();
        c.vel.addScaledVector(_v, 34 * dt);
        if (Math.random() < 0.6) BL.FX.add.spawn(c.pos.x, c.pos.y, c.pos.z, _v.x * 30, _v.y * 30, _v.z * 30, COL('#cccccc'), COL('#888888'), 0.2, 0.1, 0.4, 0, 0, 0, 1);
      }
    }

    useItem(c) {
      const it = c.item;
      c.item = null;
      c.itemTimer = 10;
      const ball = this.ball;
      const dBall = c.pos.distanceTo(ball.pos);
      BL.Audio.play('item', this.volFor(c));
      const opp = this.cars.filter((o) => o.team !== c.team && !o.demolished).sort((a, b) => a.pos.distanceTo(c.pos) - b.pos.distanceTo(c.pos))[0];
      switch (it) {
        case 'spikes': c.spikesT = 6; break;
        case 'magnet': c.magnetT = 5; break;
        case 'power': c.powerHit = true; c.powerT = 8; break;
        case 'grapple': c.grappleT = 2.2; break;
        case 'freeze': if (!ball.hidden) { ball.frozen = 2.5; ball.vel.multiplyScalar(0.2); BL.FX.burst(ball.pos, 60, { colors: ['#e0f7fa', '#80deea'], speed: [2, 8], size: [0.5, 0.1], life: [0.4, 1], shape: 1 }); BL.Audio.play('freeze'); } break;
        case 'punch':
          if (dBall < 20) { _v.copy(ball.pos).sub(c.pos).normalize(); ball.vel.addScaledVector(_v, 32).y += 6; ball.frozen = 0; BL.FX.ring(ball.pos, '#ff5252', 8, 0.35, _v.clone()); BL.FX.burst(ball.pos, 40, { colors: ['#ff5252', '#ffffff'], speed: [4, 10], size: [0.6, 0.1], life: [0.3, 0.6], shape: 1 }); BL.Audio.play('punch'); }
          break;
        case 'plunger':
          if (dBall < 40) { _v.copy(c.pos).sub(ball.pos).normalize(); ball.vel.copy(_v).multiplyScalar(22); ball.vel.y += 4; ball.frozen = 0; c.plungeT = 0.5; BL.FX.ring(ball.pos, '#f48fb1', 5, 0.3, _v.clone()); }
          break;
        case 'boot':
          if (opp && opp.pos.distanceTo(c.pos) < 45) { _v.copy(opp.pos).sub(c.pos).normalize(); opp.vel.addScaledVector(_v, 18); opp.vel.y += 9; opp.jumpLock = 0.3; opp.onGround = false; BL.FX.ring(opp.pos, '#ffb74d', 7, 0.35, _v.clone()); BL.FX.burst(opp.pos, 30, { colors: ['#8d6e63', '#ffffff'], speed: [3, 8], size: [0.6, 0.1], life: [0.3, 0.6] }); BL.Audio.play('punch'); }
          break;
        case 'tornado': {
          // a spinning vortex that drifts ahead of you, lifting and swirling the ball and cars near it
          _v.copy(c.fwd).setY(0).normalize();
          this.tornado = { x: c.pos.x + _v.x * 6, z: c.pos.z + _v.z * 6, vx: _v.x * 6, vz: _v.z * 6, t: 5 };
          BL.Audio.play('whoosh', 1);
          break;
        }
        case 'disrupt':
          // the nearest opponent's controls go haywire for a few seconds
          if (opp && opp.pos.distanceTo(c.pos) < 50) { opp.disruptT = 4; BL.FX.flash(opp.pos, '#76ff03', 3, 0.3); }
          break;
        case 'swap':
          if (opp) {
            const p = c.pos.clone(), v = c.vel.clone(), q = c.quat.clone();
            c.pos.copy(opp.pos); c.vel.copy(opp.vel); c.quat.copy(opp.quat);
            opp.pos.copy(p); opp.vel.copy(v); opp.quat.copy(q);
            BL.FX.flash(c.pos, '#b388ff', 3, 0.3); BL.FX.flash(opp.pos, '#b388ff', 3, 0.3);
            BL.FX.ring(c.pos, '#b388ff', 6, 0.4, 'y'); BL.FX.ring(opp.pos, '#b388ff', 6, 0.4, 'y');
          }
          break;
        default: break;
      }
      if (c.isLocal) BL.HUD.popup((BL.RUMBLE_ITEMS.find((i) => i.id === it) || {}).name || it, 0);
    }

    // a soft cloud of gas around the car (dodges, starting an air roll)
    // powerslide: tyre smoke off the back wheels while the car drifts
    slideSmoke(c, dt) {
      if (this.headless || !BL.FX.alpha || !c.slideVis || !c.onGround || dt <= 0 || BL.App.potato) return;
      if (Math.random() > dt * 28) return;
      for (const sx of [-1, 1]) {
        _v.copy(c.pos).addScaledVector(c.fwd, -c.hz * 0.85).addScaledVector(c.left, sx * c.hx * 0.9).addScaledVector(c.up, -c.hy * 0.6);
        BL.FX.alpha.spawn(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2,
          COL('#eef1f5'), COL('#a3abb8'), 0.45, 1.5, 0.6 + Math.random() * 0.3, -0.2, 2, BL.FX.S.smoke, 0.32);
      }
    }

    gasPuff(c, n, size) {
      if (this.headless || !BL.FX.alpha) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2.5;
        _v.set(Math.cos(a), (Math.random() - 0.5) * 0.6, Math.sin(a)).multiplyScalar(s);
        BL.FX.alpha.spawn(c.pos.x, c.pos.y, c.pos.z, _v.x + c.vel.x * 0.3, _v.y + c.vel.y * 0.3, _v.z + c.vel.z * 0.3,
          COL('#e9eef7'), COL('#9aa5b8'), size * 0.6, size * 1.6, 0.55 + Math.random() * 0.3, -0.3, 2.5, BL.FX.S.smoke, 0.38);
      }
    }

    // a flip reset (all four wheels on the ball in the air): a ring of light bursts out from under the wheels with a
    // puff, so you see the moment you got it, like the real game
    flipResetBurst(c) {
      if (this.headless || !BL.FX.add) return;
      const up = c.up, n = BL.App.potato ? 10 : BL.App.quality === 'low' ? 16 : 28;
      const ax = (this._frA || (this._frA = new V3())).copy(c.fwd), az = (this._frB || (this._frB = new V3())).crossVectors(up, c.fwd);
      const ox = c.pos.x - up.x * 0.32, oy = c.pos.y - up.y * 0.32, oz = c.pos.z - up.z * 0.32;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, s = 6.5 + Math.random() * 2.5;
        _v.copy(ax).multiplyScalar(Math.cos(a) * s).addScaledVector(az, Math.sin(a) * s).addScaledVector(up, -1.5);
        BL.FX.add.spawn(ox, oy, oz, _v.x + c.vel.x, _v.y + c.vel.y, _v.z + c.vel.z, COL('#ffffff'), COL('#6fc8ff'), 0.55, 0.08, 0.32 + Math.random() * 0.1, 0, 4, BL.FX.S.spark, 1);
      }
      BL.FX.add.spawn(ox, oy, oz, c.vel.x, c.vel.y, c.vel.z, COL('#ffffff'), COL('#9ad8ff'), 1.4, 3.2, 0.22, 0, 0, BL.FX.S.light, 0.8);
      this.gasPuff(c, BL.App.potato ? 4 : 9, 1.1);
    }

    // 3D markers hovering beside a car: a glowing ring when it has a flip reset, its Rumble item when it has one
    updateHover(c, dt) {
      if (this.headless) return;
      if (c.flipResetShow && (c.onGround || !c.hasFlip)) c.flipResetShow = false;
      const icon = c.flipResetShow ? 'reset' : (this.mode === 'rumble' && c.item ? c.item : null);
      if (!icon) { if (c.hoverObj) c.hoverObj.visible = false; return; }
      if (!c.hoverObj || c.hoverIcon !== icon) {
        if (c.hoverObj) { this.scene.remove(c.hoverObj); c.hoverObj.material.dispose(); }
        c.hoverObj = new THREE.Sprite(new THREE.SpriteMaterial({ map: hoverTexture(icon), transparent: true, depthWrite: false }));
        c.hoverObj.scale.setScalar(0.75);
        c.hoverIcon = icon;
        this.scene.add(c.hoverObj);
      }
      const o = c.hoverObj, p = c.model.group.position;
      o.visible = this.phase !== 'replay';
      const bob = Math.sin(this.time * 4 + c.id) * 0.08;
      o.position.copy(p).addScaledVector(c.left, 1.05).addScaledVector(c.up, 0.55 + bob);
      o.material.rotation = Math.sin(this.time * 2 + c.id) * 0.2;
    }

    // Spikes: real metal spikes pop out all over the car while the item is on
    updateSpikes(c, dt) {
      const on = c.spikesT > 0 && !c.demolished;
      if (!on && !c.spikeMesh) return;
      if (!c.spikeMesh) {
        const hb = { W: c.hx * 2, H: c.hy * 2, L: c.hz * 2 };
        const n = BL.App.potato ? 18 : 34, cone = new THREE.ConeGeometry(0.045, 0.26, BL.App.quality === 'low' ? 5 : 8);
        cone.translate(0, 0.13, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.85, roughness: 0.3, envMap: BL.Models.envMap || null });
        const mesh = new THREE.InstancedMesh(cone, mat, n), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new V3(0, 1, 0), dir = new V3(), pos = new V3(), one = new V3(1, 1, 1);
        // points spread over the top and sides of the hitbox, spikes pointing straight out from the body
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, a = i * 2.399963; // golden-angle spiral over a half ellipsoid
          const y = 1 - t * 1.15, r = Math.sqrt(Math.max(0, 1 - Math.min(1, y * y)));
          dir.set(Math.cos(a) * r, Math.max(-0.15, y), Math.sin(a) * r).normalize();
          pos.set(dir.x * hb.W * 0.48, dir.y * hb.H * 0.75 + 0.05, dir.z * hb.L * 0.48);
          q4.setFromUnitVectors(up, dir);
          mesh.setMatrixAt(i, m4.compose(pos, q4, one));
        }
        mesh.renderOrder = 1;
        c.model.body.add(mesh);
        c.spikeMesh = mesh; c.spikeK = 0;
      }
      // pop out fast, fold away when it ends
      c.spikeK = U.damp(c.spikeK, on ? 1 : 0, on ? 14 : 8, dt);
      c.spikeMesh.visible = c.spikeK > 0.02;
      c.spikeMesh.scale.setScalar(Math.max(0.01, c.spikeK));
    }

    releaseSpikes(c, flick) {
      const ball = this.ball;
      if (ball.stuckTo !== c) return;
      ball.stuckTo = null;
      ball.vel.copy(c.vel).addScaledVector(c.fwd, flick ? 14 : 4).addScaledVector(c.up, flick ? 4 : 3);
      c.spikesT = 0;
    }

    // ---------- rendering ----------
    renderState(alpha, dt) {
      const net = this.isClient;
      const decay = Math.exp(-10 * dt);
      for (const c of this.cars) {
        const m = c.model;
        m.group.visible = !c.demolished && !c.offPodium;
        c.shadow.visible = !c.demolished && !c.offPodium;
        if (c.demolished) continue;
        m.group.position.lerpVectors(c.prevPos, c.pos, alpha);
        if (c.podiumLift) m.group.position.y += c.podiumLift;
        _q.copy(c.prevQuat).slerp(c.quat, alpha);
        if (net) {
          // big corrections (after a spike) are pulled in faster, small ones stay smooth
          c.visOff.multiplyScalar(c.visOff.lengthSq() > 1.44 ? Math.exp(-20 * dt) : decay);
          m.group.position.add(c.visOff);
          c.rq.slerp(_q, Math.min(1, dt * 25));
          m.group.quaternion.copy(c.rq);
        } else m.group.quaternion.copy(_q);
        m.group.updateMatrixWorld();
        m.update(dt, c);
        if (c.boosting && dt > 0) BL.FX.boost(m, c, dt);
        if (c.supersonic && dt > 0) BL.FX.supersonicTrail(c, m);
        if (c.powerHit && dt > 0 && Math.random() < 0.4) BL.FX.add.spawn(c.pos.x, c.pos.y, c.pos.z, U.rand(-1, 1), 1, U.rand(-1, 1), COL('#ff1744'), COL('#ff8a80'), 0.5, 0.1, 0.4, 0, 0, 0, 0.8);
        this.placeShadow(c.shadow, m.group.position, 1.7, c.onGround ? c.groundN : null);
        this.updateHover(c, dt);
        this.slideSmoke(c, dt);
        if (this.mode === 'rumble') this.updateSpikes(c, dt);
      }
      const b = this.ball;
      this.ballMesh.visible = !b.hidden;
      this.ballShadow.visible = !b.hidden;
      if (!b.hidden) {
        this.ballVis.lerpVectors(b.prevPos, b.pos, alpha);
        if (net) { this.ballOff.multiplyScalar(decay); this.ballVis.add(this.ballOff); }
        this.ballMesh.position.copy(this.ballVis);
        this.ballMesh.quaternion.copy(b.prevQuat).slerp(b.quat, alpha);
        if (dt > 0) BL.FX.ballTrail(b);
        this.placeShadow(this.ballShadow, this.ballVis, b.r * 2.6, null, true);
        if (this.mode === 'heatseeker') this.heatLook(b, dt);
        if (b.frozen > 0 && dt > 0 && Math.random() < 0.5) BL.FX.add.spawn(b.pos.x + U.rand(-1, 1), b.pos.y + U.rand(-1, 1), b.pos.z + U.rand(-1, 1), 0, 0.3, 0, COL('#e0f7fa'), COL('#80deea'), 0.4, 0.05, 0.6, 0, 0, 1, 1);
      }
      if (this.mode === 'rumble') this.updateRumbleFX(dt);
    }

    // Goal blasts (host / offline; clients see it in the snapshots). Within 30 m of where the ball went in:
    //  push  - a one-off shove away from the goal and up, strongest up close (like the real game's blast)
    //  pull  - for 1.2 s everything is dragged in toward the net, harder the closer it gets
    //  sling - for 1.4 s cars are whirled round the goal mouth and lifted, spinning as they go
    goalBlastCar(c, dt) {
      const B = this.goalBlast, R = 30;
      const dx = c.pos.x - B.x, dy = c.pos.y - B.y, dz = c.pos.z - B.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > R || d < 0.01) return;
      const k = 1 - d / R;
      if (B.kind === 'push') {
        if (B.hit.has(c)) return;
        B.hit.add(c);
        const s = 26 * k;
        c.vel.x += (dx / d) * s; c.vel.z += (dz / d) * s; c.vel.y += 6 + 8 * k;
        c.angVel.x += U.rand(-2, 2) * k; c.angVel.z += U.rand(-2, 2) * k;
      } else if (B.kind === 'pull') {
        // lifted off the ground first (tyre grip would cancel a pull along the floor), then dragged in, floating
        if (!B.hit.has(c)) { B.hit.add(c); c.vel.y += 3.5 + 2 * k; }
        const s = (16 + 30 * k) * dt;
        c.vel.x -= (dx / d) * s; c.vel.z -= (dz / d) * s; c.vel.y += (5.5 - (dy / d) * 4) * dt;
      } else {
        // round the goal (sideways to the line from the goal), up, and a little in so they circle rather than fly off
        const h = Math.sqrt(dx * dx + dz * dz) || 1, tx = -dz / h, tz = dx / h, s = (22 + 20 * k) * dt;
        c.vel.x += tx * s - (dx / h) * s * 0.35; c.vel.z += tz * s - (dz / h) * s * 0.35; c.vel.y += (9 + 6 * k) * dt;
        c.angVel.y += 8 * dt; c.angVel.x += U.rand(-3, 3) * dt;
      }
      c.onGround = false;
    }

    // Heatseeker: the ball glows in the colour of the team that has it (the last to touch it), pulsing faster the
    // quicker it flies, and leaves a trail in that colour; white before the first touch
    heatLook(b, dt) {
      const team = b.heat && !b.heat.wait ? b.heat.team : -1;
      this._heatT = (this._heatT || 0) + dt * (team < 0 ? 2 : 4 + (b.heat.speed || 17) * 0.15);
      const glow = (this._heatCol || (this._heatCol = new THREE.Color())), tint = (this._heatTint || (this._heatTint = new THREE.Color()));
      if (team < 0) { glow.set(0x1c2026); tint.set('#f4f6f9'); } else {
        glow.copy(COL(BL.TEAM_MAIN[team])).multiplyScalar(0.5 + 0.25 * Math.sin(this._heatT));
        tint.copy(COL(BL.TEAM_MAIN[team])).lerp(COL('#ffffff'), 0.25);
      }
      this.ballMesh.traverse((o) => { if (o.material && o.material.emissive) { o.material.emissive.copy(glow); if (o.material.color) o.material.color.copy(tint); } });
      if (team >= 0 && dt > 0 && BL.FX.density > 0.5 && b.vel.lengthSq() > 25) {
        const c = COL(BL.TEAM_MAIN[team]);
        BL.FX.add.spawn(b.pos.x, b.pos.y, b.pos.z, 0, 0, 0, COL('#ffffff'), c, b.r * 1.6, 0.1, 0.35, 0, 0, 0, 0.5);
      }
    }

    // Rumble power-up visuals: an ice shell on a frozen ball, grappling/plunger ropes, a magnet field in front of the car,
    // glowing auras for Power Hitter and Disruptor, and a swirling funnel for the Tornado. A handful of meshes, no textures.
    updateRumbleFX(dt) {
      const R = this._rfx || (this._rfx = { list: [] }), b = this.ball, sc = this.scene;
      const keep = (o) => { sc.add(o); R.list.push(o); return o; };
      const rim = (col, pow) => new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(col) }, t: { value: 0 }, a: { value: 1 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 c; uniform float t; uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float r = pow(1.0 - abs(dot(normalize(vN), vV)), ' + pow.toFixed(1) + '); gl_FragColor = vec4(c * r * a * (0.75 + 0.25 * sin(t * 10.0)), 1.0); }',
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const T = this.time;
      // ice shell: faceted, glassy, grows in fast and shatters when it thaws
      const frozen = b.frozen > 0 && !b.hidden;
      if (frozen) {
        if (!R.ice) R.ice = keep(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xc8f3ff, emissive: 0x1f6f99, emissiveIntensity: 0.6, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.6, flatShading: true, depthWrite: false })));
        R.ice.visible = true; R.ice.position.copy(this.ballVis);
        R.ice.scale.setScalar(b.r * 1.2 * Math.min(1, 0.35 + (2.5 - b.frozen) * 6));
      } else if (R.ice) R.ice.visible = false;
      if (R.wasFrozen && !frozen && !b.hidden && dt > 0) BL.FX.burst(b.pos, 40, { colors: ['#e0f7fa', '#b3e5fc', '#ffffff'], speed: [4, 12], size: [0.5, 0.05], life: [0.3, 0.8], shape: 1, grav: -12 });
      R.wasFrozen = frozen;
      // tornado funnel
      const tor = this.tornado;
      if (tor) {
        if (!R.tor) {
          const g = new THREE.CylinderGeometry(4.2, 0.7, 11, 28, 8, true); g.translate(0, 5.5, 0);
          R.tor = keep(new THREE.Mesh(g, new THREE.ShaderMaterial({
            uniforms: { t: { value: 0 } },
            vertexShader: 'varying vec2 vU; uniform float t; void main(){ vU = uv; vec3 p = position; float w = sin(p.y * 0.45 + t * 3.0) * 0.6; p.x += w; p.z += cos(p.y * 0.4 + t * 2.4) * 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
            fragmentShader: 'varying vec2 vU; uniform float t; void main(){ float s = 0.5 + 0.5 * sin((vU.x * 6.2832 * 3.0) + vU.y * 9.0 - t * 9.0); float band = smoothstep(0.35, 1.0, s); float fade = smoothstep(0.0, 0.15, vU.y) * smoothstep(1.0, 0.75, vU.y); gl_FragColor = vec4(vec3(0.82, 0.86, 0.92) * band * fade * 0.55, 1.0); }',
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
          })));
        }
        R.tor.visible = true; R.tor.position.set(tor.x, 0, tor.z); R.tor.rotation.y -= dt * 6; R.tor.material.uniforms.t.value = T;
        R.tor.scale.setScalar(Math.min(1, (5 - tor.t) * 3, tor.t * 2 + 0.1));
      } else if (R.tor) R.tor.visible = false;
      for (const c of this.cars) {
        const live = !c.demolished && c.model, at = live ? c.model.group.position : c.pos;
        // grappling hook (green) / plunger (pink) rope from the car to the ball
        const rope = live && !b.hidden && (c.grappleT > 0 || c.plungeT > 0);
        if (rope) {
          if (!c._rope) {
            const g = new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true); g.translate(0, 0.5, 0); g.rotateX(Math.PI / 2);
            c._rope = keep(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff })));
          }
          c._rope.material.color.set(c.grappleT > 0 ? 0x9be15d : 0xf48fb1);
          c._rope.visible = true; c._rope.position.copy(at); c._rope.lookAt(this.ballVis);
          c._rope.scale.set(1, 1, Math.max(0.1, at.distanceTo(this.ballVis) - b.r * 0.8));
        } else if (c._rope) c._rope.visible = false;
        // magnet: a translucent blue cone reaching out from the nose
        if (live && c.magnetT > 0) {
          if (!c._mag) {
            const g = new THREE.ConeGeometry(3.2, 9, 24, 1, true); g.translate(0, -4.5, 0); g.rotateX(-Math.PI / 2);
            c._mag = keep(new THREE.Mesh(g, rim('#4fc3f7', 1.2)));
          }
          c._mag.visible = true; c._mag.position.copy(at).addScaledVector(c.fwd, 1.2); c._mag.quaternion.copy(c.model.group.quaternion);
          c._mag.material.uniforms.t.value = T; c._mag.material.uniforms.a.value = Math.min(1, c.magnetT * 2) * 0.9;
        } else if (c._mag) c._mag.visible = false;
        // Power Hitter (red) / Disruptor (green) aura shell around the car
        const aura = live && (c.powerHit ? '#ff3d3d' : c.disruptT > 0 ? '#76ff03' : null);
        if (aura) {
          if (!c._aura) c._aura = keep(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), rim('#ffffff', 2.2)));
          c._aura.visible = true; c._aura.position.copy(at); c._aura.quaternion.copy(c.model.group.quaternion);
          c._aura.scale.set(c.hx * 1.5, c.hy * 2.2, c.hz * 1.35);
          c._aura.material.uniforms.c.value.set(aura); c._aura.material.uniforms.t.value = T + c.id;
          if (c.disruptT > 0 && dt > 0 && Math.random() < 0.3) BL.FX.add.spawn(at.x + U.rand(-1, 1), at.y + 0.6, at.z + U.rand(-1, 1), U.rand(-2, 2), 2, U.rand(-2, 2), COL('#ccff90'), COL('#76ff03'), 0.3, 0.05, 0.4, 0, 0, 7, 1);
        } else if (c._aura) c._aura.visible = false;
      }
    }

    placeShadow(mesh, pos, size, groundN, isBall) {
      // (High keeps a lighter contact shadow under each car too: its real shadow is soft and the fill light washes
      // it out, while the real game's cars sit on a dark patch)
      const hq = BL.App.quality === 'high';
      if (groundN) {
        mesh.position.copy(pos).addScaledVector(groundN, -0.36);
        _v.copy(pos).add(groundN);
        mesh.lookAt(_v);
        mesh.material.opacity = hq && !isBall ? 0.55 : 1;
        mesh.scale.setScalar(1);
        return;
      }
      if (Phys.raycast(pos.x, pos.y, pos.z, 0, -1, 0, 30, _hit)) {
        Phys.normal(_hit.x, _hit.y, _hit.z, _v2);
        if (_v2.y < 0.5) { mesh.visible = false; return; }
        mesh.position.set(_hit.x, _hit.y + 0.03, _hit.z);
        _v.copy(mesh.position).add(_v2);
        mesh.lookAt(_v);
        const h = _hit.t;
        if (isBall) {
          // the disc shrinks to a dot as the ball climbs; the ring (its child) keeps the ball's size
          const sc = 1 - 0.82 * U.clamp((h - this.ball.r) / 14, 0, 1);
          mesh.scale.setScalar(sc);
          mesh.userData.ring.scale.setScalar(1 / sc);
          return;
        }
        mesh.material.opacity = U.clamp(1.1 - h / 22, 0.2, 1) * (hq ? 0.55 : 1);
        mesh.scale.setScalar(1 + h * 0.015);
      } else mesh.visible = false;
    }

    renderReplay(dt) {
      const r = this.replay;
      const s = r.sample(dt);
      const f0 = s.f0, f1 = s.f1, a = s.a;
      const S = BL.Replay.STRIDE;
      for (let i = 0; i < this.cars.length; i++) {
        const c = this.cars[i], m = c.model, k = i * S;
        const flags = f0.c[k + 7];
        const demo = flags & 1;
        m.group.visible = !demo;
        c.shadow.visible = !demo;
        if (demo) continue;
        m.group.position.set(U.lerp(f0.c[k], f1.c[k], a), U.lerp(f0.c[k + 1], f1.c[k + 1], a), U.lerp(f0.c[k + 2], f1.c[k + 2], a));
        _q.set(f0.c[k + 3], f0.c[k + 4], f0.c[k + 5], f0.c[k + 6]);
        _q2.set(f1.c[k + 3], f1.c[k + 4], f1.c[k + 5], f1.c[k + 6]);
        m.group.quaternion.copy(_q).slerp(_q2, a);
        m.group.updateMatrixWorld();
        const fake = this._fake || (this._fake = { wheelSpin: 0, steerVis: 0, onGround: true, restH: 0.38, groundDist: 0.38, vel: new V3(), fwd: new V3(), left: new V3(), up: new V3(), boosting: false, supersonic: false });
        fake.wheelSpin = U.lerp(f0.c[k + 8], f1.c[k + 8], a); fake.steerVis = f0.c[k + 9];
        fake.boosting = !!(flags & 2); fake.supersonic = !!(flags & 4);
        fake.restH = c.restH; fake.groundDist = c.restH;
        fake.fwd.set(0, 0, 1).applyQuaternion(m.group.quaternion); fake.left.set(1, 0, 0).applyQuaternion(m.group.quaternion); fake.up.set(0, 1, 0).applyQuaternion(m.group.quaternion);
        fake.vel.set((f1.c[k] - f0.c[k]) * r.hz, (f1.c[k + 1] - f0.c[k + 1]) * r.hz, (f1.c[k + 2] - f0.c[k + 2]) * r.hz);
        m.update(dt, fake);
        if (fake.boosting && dt > 0) BL.FX.boost(m, fake, dt);
        this.placeShadow(c.shadow, m.group.position, 1.7, null);
      }
      const hidden = f0.b[7] > 0.5;
      this.ballMesh.visible = !hidden;
      this.ballShadow.visible = !hidden;
      if (!hidden) {
        this.ballMesh.position.set(U.lerp(f0.b[0], f1.b[0], a), U.lerp(f0.b[1], f1.b[1], a), U.lerp(f0.b[2], f1.b[2], a));
        _q.set(f0.b[3], f0.b[4], f0.b[5], f0.b[6]); _q2.set(f1.b[3], f1.b[4], f1.b[5], f1.b[6]);
        this.ballMesh.quaternion.copy(_q).slerp(_q2, a);
        this.ballVis.copy(this.ballMesh.position);
        this.placeShadow(this.ballShadow, this.ballVis, this.ball.r * 2.6, null, true);
      } else if (!r.exploded && this.lastGoal) {
        r.exploded = true;
        _v.set(this.lastGoal.x, this.lastGoal.y, this.lastGoal.z);
        BL.FX.goalExplosion(this.lastGoal.fx, _v, BL.TEAM_MAIN[this.lastGoal.team], this.lastGoal.paint ? BL.PAINT_BY_ID[this.lastGoal.paint].color : null);
      }
      if (r.done() && this.isClient) { /* wait for host */ }
    }

    // ---------- camera ----------
    snapCamera() {
      const c = this.local;
      if (c) {
        _v.set(c.fwd.x, 0, c.fwd.z).normalize();
        this.camFwd.copy(_v);
        this.camPos.copy(c.pos).addScaledVector(_v, -BL.Save.p.settings.camDist).add(_v2.set(0, BL.Save.p.settings.camHeight, 0));
      } else { this.camPos.set(0, 12, -45); this.camFwd.set(0, 0, 1); }
      this.camUp.set(0, 1, 0);
      this.camAnchorCar = null; // the trailing point starts on the car again
      this.lookYaw = 0;
    }

    updateCamera(dt) {
      const cam = this.camera;
      const st = BL.Save.p.settings;
      const k = 1 - Math.exp(-dt * 60);
      let lookAt = this.camLook;
      if (this.phase === 'replay' && this.replay.playing) {
        const bp = this.ballMesh.visible ? this.ballMesh.position : (this.lastGoal ? _v3.set(this.lastGoal.x, this.lastGoal.y, this.lastGoal.z) : this.ballMesh.position);
        const vel = this.replayVel || (this.replayVel = new V3(0, 0, 1));
        if (this.ballMesh.visible && this.prevReplayBall) vel.lerp(_v.copy(bp).sub(this.prevReplayBall).setY(0), 0.05);
        this.prevReplayBall = (this.prevReplayBall || new V3()).copy(bp);
        _v.copy(vel); if (_v.lengthSq() < 1e-6) _v.set(0, 0, 1);
        _v.normalize();
        _v2.copy(bp).addScaledVector(_v, -10).add(_v3.set(0, 4.5, 0));
        this.keepInside(_v2);
        const snap = this.replaySnap;
        this.replaySnap = false;
        // after the ball goes in: swing round to the scorer's car for the celebration
        const scorer = this.lastGoal && this.carById[this.lastGoal.scorer];
        if (!this.ballMesh.visible && scorer && scorer.model.group.visible) {
          const cp = scorer.model.group.position;
          const f = (this._celF || (this._celF = new V3())).set(0, 0, 1).applyQuaternion(scorer.model.group.quaternion).setY(0);
          if (f.lengthSq() < 1e-4) f.set(0, 0, 1);
          f.normalize();
          _v2.copy(cp).addScaledVector(f, 6.5).add(_v3.set(f.z * 2.5, 2.4, -f.x * 2.5));
          this.keepInside(_v2);
          this.camPos.lerp(_v2, 1 - Math.exp(-dt * 2.2));
          lookAt.lerp(_v3.copy(cp).add(WORLD_UP), 1 - Math.exp(-dt * 5));
        } else {
          this.camPos.lerp(_v2, snap ? 1 : 1 - Math.exp(-dt * 3));
          lookAt.lerp(bp, snap ? 1 : 1 - Math.exp(-dt * 8));
        }
        cam.up.set(0, 1, 0);
      } else if (this.phase === 'countdown' && this.introLen && this.phaseT > 3.02 && this.local) {
        // intro flyover: a wide sweep high over the pitch that swings round and drops in behind your car
        const u = U.clamp(1 - (this.phaseT - 3) / this.introLen, 0, 1), e = u * u * (3 - 2 * u);
        const car = this.local, cp = car.model.group.position;
        const back = Math.atan2(-car.fwd.x, -car.fwd.z);
        const a = back + (1 - e) * 2.4;
        // (it lands exactly where the car cam takes over: Distance behind, Height up, tipped down by Angle)
        const st0 = BL.Save.p.settings, ang0 = ((st0.camAngle == null ? 4 : st0.camAngle) * Math.PI) / 180;
        const rad = U.lerp(62, st0.camDist, e), hgt = U.lerp(30, cp.y + st0.camHeight, e);
        _v2.set(cp.x * e + Math.sin(a) * rad, hgt, cp.z * e + Math.cos(a) * rad);
        this.camPos.copy(_v2);
        _v3.set(-Math.sin(a), 0, -Math.cos(a));
        lookAt.set(0, 2, 0).lerp(_v.copy(_v2).addScaledVector(_v3, 10 * Math.cos(ang0)).add(_v3.set(0, -10 * Math.sin(ang0), 0)), e);
        this.camFwd.set(car.fwd.x, 0, car.fwd.z).normalize();
        this.camUp.set(0, 1, 0);
        cam.up.set(0, 1, 0);
      } else if (this.phase === 'ended' && this.podium && !this.podium.done) {
        // podium: in front of the line-up, a gentle sway
        const t = this.podium.t, w = Math.max(3.5, this.podium.cars.length * 3.2);
        const lift = this.podium.stage ? this.podium.stage.lift + 0.15 : 0;
        _v2.set(Math.sin(t * 0.35) * 1.2, 1.5 + lift, 2.6 + w * 0.62 + (lift ? 1.2 : 0));
        this.camPos.lerp(_v2, t < 0.05 ? 1 : 1 - Math.exp(-dt * 4));
        lookAt.lerp(_v3.set(0, 0.55 + lift, 0), t < 0.05 ? 1 : 1 - Math.exp(-dt * 6));
        cam.up.set(0, 1, 0);
        this.podiumLabels();
      } else if (this.phase === 'ended') {
        const t = performance.now() / 4000;
        _v2.set(Math.sin(t) * 30, 14, Math.cos(t) * 30);
        this.camPos.lerp(_v2, 1 - Math.exp(-dt * 1.5));
        lookAt.lerp(_v3.set(0, 2, 0), 1 - Math.exp(-dt * 2));
        cam.up.set(0, 1, 0);
      } else {
        const car = this.local;
        if (!car || car.demolished) {
          const bp = this.ballMesh.position;
          const dir = car ? (car.team === 0 ? 1 : -1) : 1;
          _v2.set(bp.x * 0.7, Math.max(6, bp.y + 5), bp.z - dir * 16);
          this.keepInside(_v2);
          this.camPos.lerp(_v2, 1 - Math.exp(-dt * 3));
          lookAt.lerp(bp, 1 - Math.exp(-dt * 6));
          cam.up.set(0, 1, 0);
        } else {
          const cp = car.model.group.position;
          const bp = this.ballMesh.position;
          // right stick: look round the car, the way you push it (pull it back for the rear view); while it's pushed
          // the ball cam lets go, like the real game
          const lk = (this.view2 && car === this.local2 ? BL.Input.look2 : BL.Input.look) || { x: 0, y: 0 };
          const lookOn = Math.hypot(lk.x, lk.y) > 0.3 && this.phase !== 'countdown';
          let lyD = (lookOn ? Math.atan2(lk.x, -lk.y) : 0) - (this.lookYaw || 0);
          lyD = Math.atan2(Math.sin(lyD), Math.cos(lyD));
          this.lookYaw = (this.lookYaw || 0) + lyD * (1 - Math.exp(-dt * 14));
          const useBall = this.ballCam && !this.ball.hidden && this.phase !== 'countdown' && !lookOn;
          // How the real camera works: a boom behind the car (Distance back, Height up) that turns to face where it
          // should look. Car cam faces the car's heading; ball cam swings the boom round AND up/down onto the car->ball
          // line, so the ball sits near the middle of the screen and the car low in the frame, and flips round when
          // the ball goes behind you. On walls and the ceiling the boom stands on the surface you're driving on (the
          // view turns with it), in the air it rights itself. Switching cams eases across (Transition Speed).
          // Car cam stands on the surface you're driving on (the view turns with the wall); ball cam stays nearly level,
          // like the real one (it only leans a little toward the wall, it never turns the picture on its side)
          const upT = !car.onGround ? WORLD_UP : useBall ? (this._upBall || (this._upBall = new V3())).copy(WORLD_UP).lerp(car.groundN, 0.15).normalize() : car.groundN;
          // roll round to the new up (dropping off the ceiling the old and new ups are opposite: lerping them would
          // pass through nothing and flip the view in one frame)
          const ua = Math.acos(U.clamp(this.camUp.dot(upT), -1, 1));
          if (ua > 1e-4) {
            const ax = (this._upAx || (this._upAx = new V3())).crossVectors(this.camUp, upT);
            if (ax.lengthSq() < 1e-6) ax.copy(this.camFwd);
            this.camUp.applyAxisAngle(ax.normalize(), ua * (1 - Math.exp(-dt * 6))).normalize();
          }
          let pT = 0;
          if (useBall) {
            _v.copy(bp).sub(cp);
            const vert = _v.dot(this.camUp);
            _v.addScaledVector(this.camUp, -vert);
            const hz = _v.length();
            // ball almost straight above: hold the current heading instead of spinning
            if (hz < 0.8) _v.copy(this.camFwd);
            // the real ball cam only follows part of the ball's height: about half of it on the ground (topping out
            // near 30 deg), so a high ball rides up the screen while your car keeps its spot; in the air it follows more
            const elev = Math.atan2(vert, Math.max(hz, 0.8));
            pT = car.onGround ? U.clamp(elev * 0.5, -0.3, 0.52) : U.clamp(elev * 0.8, -0.5, 1.0);
          } else if (car.onGround) _v.copy(car.fwd);
          else {
            _v.copy(car.vel);
            if (_v.lengthSq() < 9) _v.copy(car.fwd);
          }
          _v.addScaledVector(this.camUp, -_v.dot(this.camUp));
          if (_v.lengthSq() < 1e-4) _v.copy(this.camFwd);
          _v.normalize();
          const cine = st.camPreset === 'cinematic';
          // 0 = car cam, 1 = ball cam, sliding across when you switch
          const tr = (st.camTrans == null ? 1.2 : st.camTrans) * 3.2;
          this.camB = U.clamp((this.camB == null ? (useBall ? 1 : 0) : this.camB) + U.clamp((useBall ? 1 : 0) - (this.camB == null ? 0 : this.camB), -tr * dt, tr * dt), 0, 1);
          const moving = this.camB > 0.001 && this.camB < 0.999, B = this.camB * this.camB * (3 - 2 * this.camB);
          // the ball cam boom is practically locked onto the ball; car cam swivels fast on the ground, slower in the air
          const swivel = (moving ? 9 : useBall ? 40 : car.onGround ? 8 : 5) * (cine ? 0.45 : 1);
          // ...but never whips round faster than about 720 deg/s (the ball passing right under you flips it quickly, not in one frame)
          const fa = this.camFwd.angleTo(_v);
          this.camFwd.lerp(_v, fa > 1e-4 ? Math.min(1 - Math.exp(-dt * swivel), (12.5 * dt) / fa) : 1).normalize();
          this.ballEl = this.ballEl == null ? pT : U.damp(this.ballEl, pT, (moving ? 8 : useBall ? 24 : 8) * (cine ? 0.5 : 1), dt);
          const el = this.ballEl;
          // The boom hangs off a point that trails the car a little and catches up (the real camera, measured from
          // clips): boosting away the car pulls ahead and shrinks up the screen (to ~2/3 size at supersonic), bumped
          // back it flies at you, a jump lifts it on the screen. Stiffness sets how tightly (1 = welded on). Only
          // that point lags, the boom keeps its angle, so the view never swings through the car.
          const anc = this.camAnchor || (this.camAnchor = new V3().copy(cp));
          if (this.camAnchorCar !== car || anc.distanceToSquared(cp) > 64) { anc.copy(cp); this.camAnchorCar = car; }
          const stiff = st.camStiff == null ? 0.45 : st.camStiff;
          anc.lerp(cp, 1 - Math.exp(-dt * (cine ? 5.5 : 9) / Math.max(0.02, 1 - stiff)));
          const lag = _v3.copy(anc).sub(cp);
          if (lag.lengthSq() > 6.25) anc.copy(cp).add(lag.setLength(2.5));
          const dist = st.camDist * (cine ? 1.4 : 1), height = st.camHeight * (cine ? 1.45 : 1);
          // (its own vector: keepInside below uses the shared temporaries)
          const fwdL = (this._fwdL || (this._fwdL = new V3())).copy(this.camFwd);
          if (Math.abs(this.lookYaw) > 1e-4) fwdL.applyAxisAngle(this.camUp, -this.lookYaw);
          const arm = (this._arm || (this._arm = new V3())).copy(fwdL).multiplyScalar(Math.cos(el)).addScaledVector(this.camUp, Math.sin(el));
          const armUp = (this._armUp || (this._armUp = new V3())).copy(this.camUp).multiplyScalar(Math.cos(el)).addScaledVector(fwdL, -Math.sin(el));
          _v2.copy(anc).addScaledVector(arm, -dist).addScaledVector(armUp, height);
          this.keepInside(_v2, useBall);
          this.camPos.copy(_v2);
          // both cams look along the boom, tipped down by the Angle setting (car cam: level with the car's heading)
          const ang = ((st.camAngle == null ? 4 : st.camAngle) * Math.PI) / 180;
          const carLook = (this._carLook || (this._carLook = new V3())).copy(this.camPos).addScaledVector(fwdL, 10 * Math.cos(ang)).addScaledVector(this.camUp, -10 * Math.sin(ang));
          const ballLook = (this._ballLook || (this._ballLook = new V3())).copy(this.camPos).addScaledVector(arm, 10 * Math.cos(ang)).addScaledVector(armUp, -10 * Math.sin(ang));
          if (useBall) {
            // the view also tips up about halfway toward the ball (the real ball cam: a ball above you moves your car
            // lower on the screen, measured from real clips), at least as far as keeps a high ball in the picture,
            // never so far that your car drops off the bottom (then the ball may leave the top, like the real game)
            const vhalf = (this.viewVFov() * Math.PI) / 360, up = this.camUp;
            const elevOf = (v) => Math.atan2(v.dot(up), Math.max(0.01, Math.sqrt(Math.max(0, v.lengthSq() - v.dot(up) ** 2))));
            const lookD = (this._lookD || (this._lookD = new V3())).copy(ballLook).sub(this.camPos);
            const eBase = elevOf(lookD), eCar = elevOf(_v.copy(cp).sub(this.camPos)), eBall = elevOf(_v.copy(bp).sub(this.camPos));
            let want = Math.max(0, (eBall - eBase) * 0.45, eBall - (eBase + vhalf - 0.12));
            want = Math.min(want, Math.max(0, eCar + vhalf - 0.07 - eBase));
            this.ballTip = U.damp(this.ballTip || 0, want, 10, dt);
            const e = Math.min(eBase + this.ballTip, eCar + vhalf - 0.07);
            if (Math.abs(e - eBase) > 1e-4) {
              const flat = lookD.addScaledVector(up, -lookD.dot(up)).normalize();
              ballLook.copy(this.camPos).addScaledVector(flat, 10 * Math.cos(e)).addScaledVector(up, 10 * Math.sin(e));
            }
          }
          lookAt.copy(carLook).lerp(ballLook, B);
          cam.up.copy(this.camUp).lerp(armUp, B).normalize();
        }
      }
      cam.position.copy(this.camPos);
      if (this.shake > 0) {
        const s = this.shake * 0.35;
        cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
        this.shake = Math.max(0, this.shake - dt * 1.6);
      }
      cam.lookAt(lookAt);
      const sup = this.local && this.local.supersonic && this.phase === 'play' ? 4 : 0;
      this.fovExtra = U.damp(this.fovExtra || 0, sup, 3, dt);
      // the podium is framed with a narrower lens so the cars fill the screen
      if (this.phase === 'ended' && this.podium && !this.podium.done) BL.App.setFov(70);
      else BL.App.setFov(st.fov + this.fovExtra, false, true);
      void k;
    }

    podiumLabels() {
      const el = this.podium && this.podium.labels;
      if (!el) return;
      const cam = this.camera, w = BL.App.width, h = BL.App.height;
      cam.updateMatrixWorld();
      for (const tag of el.querySelectorAll('.pd-tag')) {
        const c = this.carById[+tag.dataset.car];
        if (!c) continue;
        _v.copy(c.model.group.position); _v.y += 1.6;
        _v.project(cam);
        tag.style.transform = 'translate(' + Math.round((_v.x * 0.5 + 0.5) * w) + 'px,' + Math.round((-_v.y * 0.5 + 0.5) * h) + 'px) translate(-50%, -100%)';
      }
    }

    // the vertical field of view this view is drawn with (splitscreen halves are narrower, so it's taller)
    viewVFov() {
      if (!this.view2) return BL.App.camera.fov;
      return BL.App.vfovFor(BL.Save.p.settings.fov, Math.max(0.3, (BL.App.width / 2) / BL.App.height), true);
    }

    // keep the camera in the arena; ball cam may sit a few metres behind the see-through walls like the
    // real game (instead of being squashed into the car when you drive on a wall), as long as it stays
    // above the stands and inside the ceiling
    keepInside(p, throughWalls) {
      if (throughWalls) {
        const w = Phys.wall2d(p.x, p.z);
        if (w > -0.4 && p.y > 0.3) {
          // behind the wall there's open space back to the LED boards (1.5 m) at any height, and further back
          // above the seating: slide the camera in only that far, so it never gets squashed into the car while
          // you're low on a wall (it used to be pushed onto the wall and jump back out once you climbed)
          const y = p.y;
          const wMax = y < 2.6 ? 1.3 : y < 3.4 ? U.lerp(1.3, 3, (y - 2.6) / 0.8) : Math.min(4, 3 + (y - 3.4) / 0.74);
          if (w > wMax) {
            const e = 0.05, gx = Phys.wall2d(p.x + e, p.z) - Phys.wall2d(p.x - e, p.z), gz = Phys.wall2d(p.x, p.z + e) - Phys.wall2d(p.x, p.z - e);
            const gl = Math.hypot(gx, gz) || 1;
            p.x -= (gx / gl) * (w - wMax); p.z -= (gz / gl) * (w - wMax);
          }
          p.y = Math.min(p.y, this.A.h - 0.6);
          return;
        }
      }
      const d = Phys.sdf(p.x, p.y, p.z);
      if (d > -0.4) {
        Phys.normal(p.x, p.y, p.z, _v3);
        p.addScaledVector(_v3, d + 0.4);
      }
    }

    // ---------- networking (host -> clients) ----------
    makeSnapshot() {
      const b = this.ball;
      const R = (x) => Math.round(x * 100);
      const RQ = (x) => Math.round(x * 1000);
      return {
        t: 's', k: this.tickN, ph: this.phase, pt: Math.round(this.phaseT * 100), cl: Math.round(this.clock * 10), ot: this.overtime ? 1 : 0,
        sc: this.score, cr: this.clockRunning ? 1 : 0,
        b: [R(b.pos.x), R(b.pos.y), R(b.pos.z), R(b.vel.x), R(b.vel.y), R(b.vel.z), RQ(b.quat.x), RQ(b.quat.y), RQ(b.quat.z), RQ(b.quat.w), b.hidden ? 1 : 0, Math.round(b.frozen * 10), b.stuckTo ? b.stuckTo.id : -1, b.heat ? b.heat.team : -1, b.heat ? Math.round(b.heat.speed) * (b.heat.wait ? -1 : 1) : 0, R(b.angVel.x), R(b.angVel.y), R(b.angVel.z)],
        c: this.cars.map((c) => {
          const ct = c.controls;
          const fl = (c.demolished ? 1 : 0) | (c.onGround ? 2 : 0) | (c.boosting ? 4 : 0) | (c.supersonic ? 8 : 0) | (c.jumped ? 16 : 0) | (c.hasFlip ? 32 : 0) | (c.dodging ? 64 : 0) | (c.jumpHolding ? 128 : 0) | (c.onRoof ? 256 : 0) | (c.powerHit ? 512 : 0);
          const cb = (ct.jump ? 1 : 0) | (ct.boost ? 2 : 0) | (ct.handbrake ? 4 : 0) | (ct.airRollFree ? 8 : 0);
          return [c.id, R(c.pos.x), R(c.pos.y), R(c.pos.z), RQ(c.quat.x), RQ(c.quat.y), RQ(c.quat.z), RQ(c.quat.w), R(c.vel.x), R(c.vel.y), R(c.vel.z), R(c.angVel.x), R(c.angVel.y), R(c.angVel.z),
            Math.round(c.boost), fl, R(ct.throttle), R(ct.steer), R(ct.pitch), R(ct.roll), cb, ct.jumpSeq, c.ackSeq, R(c.jumpTime), R(c.dodgeTime), R(c.dodgeW.x), R(c.dodgeW.z),
            c.item ? BL.RUMBLE_ITEMS.findIndex((i) => i.id === c.item) : -1, Math.round(c.itemTimer), c.ping || 0, c.stats.score, c.stats.goals, c.stats.assists, c.stats.saves, c.stats.shots, c.stats.demos];
        }),
        p: this.padState.map((p) => (p.active ? 1 : 0)).join(''),
      };
    }

    applySnapshot(s) {
      if (!this.isClient) return;
      const prevPhase = this.phase;
      this.phase = s.ph; this.phaseT = s.pt / 100; this.clock = s.cl / 10; this.overtime = !!s.ot; this.score = s.sc; this.clockRunning = !!s.cr;
      if (prevPhase === 'replay' && this.phase !== 'replay') { BL.HUD.replay(false); this.replay.stop(); }
      if (this.phase === 'replay' && prevPhase !== 'replay') { if (this.replay.canPlay()) { this.replay.start(); this.replaySnap = true; this.mySkip = false; BL.HUD.replay(true); BL.HUD.replaySkip(0, this.humanCount()); BL.FX.clear(); } }
      if (this.phase === 'replay' || this.phase === 'ended') return;
      // predict ahead by half the round trip plus a little for jitter (so other cars aren't drawn in the past)
      const lead = U.clamp(Math.round(((this.netApi.rtt || 0.1) / 2 + Math.min(0.04, this.netApi.jit || 0)) / P.dt), 0, 30);
      const D = (x) => x / 100, DQ = (x) => x / 1000;
      // ball
      const b = this.ball, bs = s.b;
      const wasHidden = b.hidden;
      b.hidden = !!bs[10];
      b.frozen = bs[11] / 10;
      b.stuckTo = bs[12] >= 0 ? this.carById[bs[12]] || null : null;
      b.heat = bs[13] >= 0 ? { team: bs[13], speed: Math.abs(bs[14]), wait: bs[14] < 0 } : null;
      _v.set(D(bs[0]), D(bs[1]), D(bs[2]));
      const err = _v.distanceTo(b.pos);
      if (!(this.time < this.trustBallUntil && err < 5) || wasHidden !== b.hidden) {
        const old = _v2.copy(b.pos).add(this.ballOff);
        b.pos.copy(_v); b.vel.set(D(bs[3]), D(bs[4]), D(bs[5]));
        b.quat.set(DQ(bs[6]), DQ(bs[7]), DQ(bs[8]), DQ(bs[9])).normalize();
        // spin changes how the ball bounces, so clients predict with the host's spin too
        if (bs.length > 17) b.angVel.set(D(bs[15]), D(bs[16]), D(bs[17]));
        if (!b.stuckTo) for (let i = 0; i < lead; i++) Phys.stepBall(b, P.dt, this.env);
        this.ballOff.copy(old).sub(b.pos);
        if (this.ballOff.length() > 4 || wasHidden) this.ballOff.set(0, 0, 0);
        b.prevPos.copy(b.pos);
      }
      // cars
      for (const e of s.c) {
        const c = this.carById[e[0]];
        if (!c) continue;
        const fl = e[15];
        const oldVis = _v2.copy(c.pos).add(c.visOff);
        const wasDemo = c.demolished;
        c.pos.set(D(e[1]), D(e[2]), D(e[3]));
        c.quat.set(DQ(e[4]), DQ(e[5]), DQ(e[6]), DQ(e[7])).normalize();
        c.vel.set(D(e[8]), D(e[9]), D(e[10]));
        c.angVel.set(D(e[11]), D(e[12]), D(e[13]));
        c.boost = e[14];
        c.demolished = !!(fl & 1); c.onGround = !!(fl & 2); c.boosting = !!(fl & 4); c.supersonic = !!(fl & 8);
        c.jumped = !!(fl & 16); c.hasFlip = !!(fl & 32); c.dodging = !!(fl & 64); c.jumpHolding = !!(fl & 128); c.onRoof = !!(fl & 256); c.powerHit = !!(fl & 512);
        c.jumpTime = D(e[23]); c.dodgeTime = D(e[24]); c.dodgeW.set(D(e[25]), 0, D(e[26]));
        c.item = e[27] >= 0 ? BL.RUMBLE_ITEMS[e[27]].id : null; c.itemTimer = e[28]; c.ping = e[29];
        c.stats.score = e[30]; c.stats.goals = e[31]; c.stats.assists = e[32]; c.stats.saves = e[33]; c.stats.shots = e[34]; c.stats.demos = e[35];
        c.lastJumpSeq = e[21];
        c.jumpLock = 0;
        c.updateAxes();
        if (c.onGround) { c.groundN.set(0, 1, 0); }
        if (c === this.local) {
          // reconcile: replay unacknowledged inputs
          const ack = e[22];
          const saved = Object.assign({}, c.controls);
          let replayed = 0;
          for (const h of this.inputHist) {
            if (h.seq <= ack) continue;
            Object.assign(c.controls, h);
            Phys.stepCar(c, P.dt, this.env);
            c.events.length = 0;
            if (++replayed > 40) break;
          }
          Object.assign(c.controls, saved);
          while (this.inputHist.length && this.inputHist[0].seq <= ack) this.inputHist.shift();
        } else {
          const ct = c.controls;
          ct.throttle = D(e[16]); ct.steer = D(e[17]); ct.pitch = D(e[18]); ct.roll = D(e[19]);
          const cb = e[20];
          ct.jump = !!(cb & 1); ct.boost = !!(cb & 2); ct.handbrake = !!(cb & 4); ct.airRollFree = !!(cb & 8);
          ct.jumpSeq = e[21];
          if (!c.demolished) for (let i = 0; i < lead; i++) { Phys.stepCar(c, P.dt, this.env); c.events.length = 0; }
        }
        c.visOff.copy(oldVis).sub(c.pos);
        if (c.visOff.length() > 3 || wasDemo !== c.demolished) { c.visOff.set(0, 0, 0); c.rq.copy(c.quat); }
        c.prevPos.copy(c.pos); c.prevQuat.copy(c.quat);
        if (c === this.local && c.demolished !== wasDemo && !c.demolished) BL.HUD.spectate(null);
      }
      // pads
      for (let i = 0; i < this.padState.length && i < s.p.length; i++) {
        const on = s.p[i] === '1';
        if (this.padState[i].active !== on) {
          if (!on && this.local && Math.hypot(this.local.pos.x - this.padState[i].x, this.local.pos.z - this.padState[i].z) < 2.5) BL.Audio.play(this.padState[i].big ? 'padBig' : 'padSmall');
          this.padState[i].active = on; this.arena.setPad(i, on);
        }
      }
    }

    onNetEvent(m) {
      if (m.t === 'chat') { this.showChat(m.id, m.m); return; }
      if (m.t !== 'ev') return;
      switch (m.e) {
        case 'goal': if (this.isClient) this.goalVisual(m.d); break;
        case 'demo': this.demoVisual(m.a, m.v); break;
        case 'pop': BL.HUD.popup(m.text, m.pts, this.local ? BL.TEAM_MAIN[this.local.team] : null); break;
        case 'anth': if (BL.Anthems && this.carById[m.c]) BL.Anthems.playNear(this.carById[m.c], 'save'); break;
        case 'big': BL.HUD.big(m.text, m.sub, m.color, m.dur); break;
        case 'count': this.countVisual(m.n); break;
        case 'wait': BL.HUD.big('WAITING FOR PLAYERS', m.n + ' / ' + m.total + ' loaded', '#ffffff', 1.3); break;
        case 'kick': this.placeForKickoff(m.o); this.ball.reset(0, this.ball.r, 0); this.ballOff.set(0, 0, 0); this.replay.stop(); BL.HUD.replay(false); BL.FX.clear(); this.inputHist = []; break;
        case 'replay': if (this.phase !== 'replay' && this.replay.canPlay()) { this.phase = 'replay'; this.replay.start(); this.replaySnap = true; this.mySkip = false; BL.HUD.replay(true); BL.HUD.replaySkip(0, this.humanCount()); BL.FX.clear(); } break;
        case 'skipv': BL.HUD.replaySkip(m.n, m.of); break;
        case 'end': this.endVisual(m.r); break;
        default: break;
      }
    }

    // host: input from a client
    onRemoteInput(pid, m) {
      const c = this.cars.find((x) => x.pid === pid);
      // (the fast lane doesn't keep them in order: an older input than the last one is out of date)
      if (!c || m.s <= c.ackSeq) return;
      const ct = c.controls, a = m.c;
      ct.throttle = U.clamp(a[0] / 100, -1, 1); ct.steer = U.clamp(a[1] / 100, -1, 1); ct.pitch = U.clamp(a[2] / 100, -1, 1); ct.roll = U.clamp(a[3] / 100, -1, 1);
      ct.jump = !!(a[4] & 1); ct.boost = !!(a[4] & 2); ct.handbrake = !!(a[4] & 4); ct.airRollFree = !!(a[4] & 8);
      ct.jumpSeq = a[5]; ct.itemSeq = a[6];
      c.ackSeq = m.s;
      if (m.p != null) c.ping = m.p;
    }

    playerLeft(pid) {
      if (this.waiting) this.waiting.delete(pid);
      const c = this.cars.find((x) => x.pid === pid);
      if (!c) return;
      c.isBot = true; c.pid = null; c.skill = 0.5; c.name += ' (bot)';
      BL.HUD.feed(U.esc(c.name) + ' left — a bot took over');
      BL.HUD.names();
    }

    dispose() {
      BL.bus.off('shake', this._onShake);
      clearTimeout(this.podiumTimer);
      if (this.podium && this.podium.labels) this.podium.labels.remove();
      if (this.headless) return;
      if (this.view2) { BL.Input.split = false; BL.HUD.split(null); }
      for (const c of this.cars) { c.model.dispose(); c.shadow.geometry.dispose(); c.shadow.material.dispose(); }
      this.ballMesh.geometry.dispose();
      if (this.ballMesh.material.map) this.ballMesh.material.map.dispose();
      this.ballMesh.material.dispose();
      this.ballShadow.geometry.dispose(); this.ballShadow.material.dispose(); this.ballShadow.userData.ring.material.dispose();
      if (this._rfx) for (const o of this._rfx.list) { o.geometry.dispose(); o.material.dispose(); }
      this.arena.dispose();
      BL.FX.clear();
      if (this.envTex) this.envTex.dispose();
      BL.HUD.hide();
      BL.Audio.stopEngine(); BL.Audio.stopCrowd();
      BL.Input.gameActive = false;
      BL.Input.showTouch(false);
    }
  }
  BL.Game = Game;
})(window.BL);
