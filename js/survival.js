'use strict';
// Rocket League (fan remake) - Survival (2026-11-23: "make a survival gamemode where you have to crash into people
// and try to be the last one on the map"). An original mode, not one from the real game:
//  - no ball and no goals: eight cars, every car for itself (each in its own colour)
//  - every car has 3 lives: drive into another car with your bumper, hard (12 m/s closing or more, or supersonic),
//    and it loses one; it comes back inside the ring 2.5 s later, safe for 2 s (no spawn kills); on its last life
//    it's knocked out for good
//  - a glowing ring closes in on the middle of the pitch after the first 25 seconds; outside it for 3 seconds costs
//    a life too, so every match ends
//  - the last car left wins (if the last two go out together, the one that lasted longer wins)
//  - knocked out, you watch the cars still in; boost refills on its own (Recharge), so nobody runs dry
// Hooks: js/game.js calls prep / kickoff / tick / clockText / watch, endMatch reads result(); js/physics.js has the
// 'survival' demolish rule; bots drive with SV.think (wraps BL.AI.think for this mode).
(function (BL) {
  const SV = BL.Survival = { GRACE: 25, SHRINK: 95, R0: 66, R1: 7, OUT_SECS: 3, DEMO: 12, LIVES: 3, BACK: 2.5, SAFE: 2 };
  const U = BL.util, V3 = THREE.Vector3;
  const COLS = ['#2f7bff', '#ff8a1f', '#39d353', '#e53935', '#ffd23f', '#b06bff', '#21d4fd', '#ff5fa2', '#f2f2f2', '#8d6e63'];
  SV.COLS = COLS;
  // every car its own colour (both team paints set to it), sides alternate (only for the spawn and the feed)
  SV.prep = function (players) {
    players.forEach((p, i) => { p.team = i % 2; p.loadout = Object.assign({}, p.loadout || {}, { blue: COLS[i % COLS.length], orange: COLS[i % COLS.length] }); p.svCol = COLS[i % COLS.length]; });
  };
  const colOf = (c) => (c && c.loadout && c.loadout.blue) || BL.TEAM_MAIN[c ? c.team : 0];
  SV.colOf = colOf;
  // the ring: its radius at this point of the match (play time, the same on every copy of an online match)
  SV.radius = (g) => { const t = (g && g.playTime) || 0; return t < SV.GRACE ? SV.R0 : U.lerp(SV.R0, SV.R1, Math.min(1, (t - SV.GRACE) / SV.SHRINK)); };
  const alive = (g) => g.cars.filter((c) => !c.svOut);

  // the start: everyone round a big circle facing the middle
  SV.kickoff = function (g) {
    const n = g.cars.length, R = Math.min(g.A.hw, g.A.hl) * 0.78;
    g.cars.forEach((c, i) => {
      const a = (i / n) * Math.PI * 2;
      c.place(Math.sin(a) * R, Math.cos(a) * R, 0, 0);
      c.boost = 60; c.svOut = false; c.svRing = 0; c.svPlace = 0; c.demolished = false; c.respawnTimer = 0; c.svLives = SV.LIVES; c.svSafe = 0; c.svHit = false;
      c.visOff.set(0, 0, 0); c.rq.copy(c.quat);
    });
    g.ball.hidden = true;
    g.kickoffPending = false;
    g.sv = { order: [], endT: 0, n };
  };
  // a life lost (to a car, the ring or anything else that demolishes): back in a moment, or out for good on the last
  function loseLife(g, c, how) {
    c.svLives = Math.max(0, (c.svLives == null ? SV.LIVES : c.svLives) - 1);
    c.svRing = 0;
    if (c.svLives <= 0) { knockOut(g, c, how); return; }
    if (!c.demolished) { c.demolished = true; c.boosting = false; if (!g.headless) BL.FX.demo(c.pos.clone(), colOf(c)); }
    c.respawnTimer = SV.BACK;
    if (g.isHost) g.netApi.broadcast({ t: 'ev', e: 'svlife', v: c.id, n: c.svLives, how });
    SV.lifeVisual(g, c.id, c.svLives, how);
  }
  SV.lifeVisual = function (g, vid, n, how) {
    const c = g.carById[vid];
    if (!c || g.headless) return;
    c.svLives = n;
    if (how === 'ring') { BL.Audio.play('demo', g.volFor(c)); BL.HUD.feed(`<b style="color:#ff3b3b">THE RING</b> ${BL.ICON('demo', 15)} <b style="color:${colOf(c)}">${U.esc(c.name)}</b>`); }
    if (c.isLocal) BL.HUD.spectate((how === 'ring' ? 'CAUGHT OUTSIDE THE RING' : 'HIT!') + '  •  ' + n + (n === 1 ? ' LIFE' : ' LIVES') + ' LEFT  •  BACK IN A MOMENT');
  };
  // back in: somewhere inside the ring away from the others, facing the middle, safe for a moment
  SV.respawn = function (g, c) {
    const r = SV.radius(g) * 0.55;
    let best = null, bd = -1;
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2, x = Math.sin(a) * r, z = Math.cos(a) * r;
      let d = 1e9; for (const o of g.cars) if (o !== c && !o.svOut && !o.demolished) d = Math.min(d, Math.hypot(o.pos.x - x, o.pos.z - z));
      if (d > bd) { bd = d; best = [x, z]; }
    }
    c.place(best[0], best[1], 0, 0);
    c.boost = Math.max(c.boost, 50); c.svSafe = SV.SAFE; c.svRing = 0;
    c.visOff.set(0, 0, 0); c.rq.copy(c.quat);
    if (c.isLocal) BL.HUD.spectate(null);
  };
  // knocked out for good: its place recorded
  function knockOut(g, c, how) {
    if (c.svOut) return;
    c.svOut = true;
    c.demolished = true; c.respawnTimer = 1e9; c.boosting = false;
    const left = alive(g).length;
    c.svPlace = left + 1;
    g.sv.order.push(c.id);
    if (g.isHost) g.netApi.broadcast({ t: 'ev', e: 'svout', v: c.id, p: c.svPlace, how });
    SV.outVisual(g, c.id, c.svPlace, how);
  }
  SV.outVisual = function (g, vid, place, how) {
    const c = g.carById[vid];
    if (!c) return;
    c.svOut = true; c.svPlace = place; c.demolished = true;
    if (g.headless) return;
    const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    if (how === 'ring') {
      BL.FX.demo(c.pos.clone(), colOf(c));
      BL.Audio.play('demo', g.volFor(c));
      BL.HUD.feed(`<b style="color:#ff3b3b">THE RING</b> ${BL.ICON('demo', 15)} <b style="color:${colOf(c)}">${U.esc(c.name)}</b>`);
    }
    BL.HUD.feed(`<b style="color:${colOf(c)}">${U.esc(c.name)}</b> is out &bull; ${ord(place)}`);
    if (c.isLocal) { BL.HUD.spectate("YOU'RE OUT: " + ord(place).toUpperCase() + ' OF ' + g.cars.length + '  •  WATCHING THE REST'); g.shake = Math.max(g.shake, 0.7); }
  };
  // the host, every tick: the ring, anyone knocked out, the end
  SV.tick = function (g, dt) {
    if (!g.sv) return;
    if (g.phase === 'play' && !g.clockRunning) g.clockRunning = true;
    if (g.isClient || g.phase !== 'play') return;
    const r = SV.radius(g);
    for (const c of g.cars) {
      if (c.svOut) continue;
      // (a fresh demolish: a life gone; one already counted waits for its respawn)
      if (c.demolished) { if (!c.svHit) { c.svHit = true; loseLife(g, c, 'car'); } continue; }
      c.svHit = false;
      if (c.svSafe > 0) c.svSafe -= dt;
      const d = Math.hypot(c.pos.x, c.pos.z);
      c.svRing = d > r ? c.svRing + dt : Math.max(0, c.svRing - dt * 0.5);
      if (c.svRing > SV.OUT_SECS) { c.svHit = true; loseLife(g, c, 'ring'); }
    }
    const L = alive(g);
    if (L.length <= 1) {
      g.sv.endT += dt;
      if (L[0] && !L[0].svPlace) { L[0].svPlace = 1; }
      // (a moment to see the last hit before the end)
      if (g.sv.endT > 1.6) { g.matchOver = true; g.endMatch(); }
    }
  };
  // the winner and the places, for the results (js/game.js endMatch)
  SV.result = function (g) {
    const L = alive(g);
    const win = L[0] || g.carById[g.sv.order[g.sv.order.length - 1]] || g.cars[0];
    const place = {};
    for (const c of g.cars) place[c.id] = c === win ? 1 : c.svPlace || 2;
    return { winner: win.id, place, order: g.sv.order.slice() };
  };
  // the scoreboard: how many are left, and the ring
  SV.clockText = (g) => alive(g).length + ' LEFT';
  SV.subText = (g) => {
    const t = g.playTime || 0, me = g.local, lv = me && !me.svOut ? '♥'.repeat(Math.max(0, me.svLives == null ? SV.LIVES : me.svLives)) + '  •  ' : '';
    return lv + (t < SV.GRACE ? 'RING CLOSES IN ' + Math.ceil(SV.GRACE - t) : SV.radius(g) <= SV.R1 + 0.01 ? 'RING CLOSED' : 'RING CLOSING');
  };
  // knocked out: the camera watches a car that's still in (the one that got you, if it's still going)
  SV.watch = function (g) {
    const me = g.local, L = alive(g);
    let w = g.carById[g._svWatch];
    if (!w || w.svOut) { w = L.slice().sort((a, b) => a.pos.distanceTo(me ? me.pos : a.pos) - b.pos.distanceTo(me ? me.pos : b.pos))[0] || null; g._svWatch = w ? w.id : null; }
    return w ? w.model.group.position : g.ballMesh.position;
  };

  // ---------- the ring's look: a wall of light round the safe circle, and the floor outside it glowing red ----------
  const WALL_V = 'varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  // (only inside the arena: the ring starts bigger than the pitch, out past the walls, and the glass mustn't show it)
  const CLIP = 'uniform vec3 uBox; bool outside(vec3 w) { vec2 a = abs(w.xz); return a.x > uBox.x || a.y > uBox.y || a.x + a.y > uBox.z; }';
  const WALL_F = `uniform float uT; uniform float uK; varying vec2 vU; varying vec3 vW; ${CLIP}
    void main() {
      if (outside(vW)) discard;
      float y = vU.y, a = pow(1.0 - y, 1.6) * 0.75 + 0.12 * (1.0 - y);
      a *= 0.65 + 0.35 * sin(vU.x * 380.0 - uT * 3.0) * sin(vU.x * 47.0 + uT * 1.3);
      float band = smoothstep(0.02, 0.0, abs(fract(y * 4.0 - uT * 0.35) - 0.5) - 0.46);
      vec3 c = mix(vec3(0.9, 0.04, 0.02), vec3(1.0, 0.32, 0.06), pow(1.0 - y, 3.0)) * (a + band * 0.35) * 0.8;
      gl_FragColor = linearToOutputTexel(vec4(c * uK, 1.0));
    }`;
  const FLOOR_F = `uniform float uR; uniform float uT; uniform float uK; varying vec2 vU; varying vec3 vW; ${CLIP}
    void main() {
      if (outside(vW)) discard;
      float d = length(vW.xz) - uR;
      if (d < 0.0) discard;
      float edge = exp(-d * 0.9), stripes = 0.5 + 0.5 * sin((vW.x + vW.z) * 0.8 + uT * 2.0);
      float a = (0.22 + 0.1 * stripes) * smoothstep(0.0, 0.6, d) + edge * 0.55;
      gl_FragColor = linearToOutputTexel(vec4(vec3(1.0, 0.16, 0.1) * a * uK, 1.0));
    }`;
  SV.build = function (g) {
    const FX = BL.FX, low = BL.App && BL.App.quality === 'low', A = g.A, box = { value: new V3(A.hw + 0.3, A.hl + A.goalD, A.hw + A.hl - A.cornerR * 0.7) };
    const wallGeo = new THREE.CylinderGeometry(1, 1, 1, low ? 64 : 128, 1, true); wallGeo.translate(0, 0.5, 0);
    const wallMat = new THREE.ShaderMaterial({ uniforms: { uT: FX.clock, uK: { value: 1 }, uBox: box }, vertexShader: WALL_V, fragmentShader: WALL_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const wall = new THREE.Mesh(wallGeo, wallMat); wall.frustumCulled = false; wall.renderOrder = 5;
    const flGeo = new THREE.PlaneGeometry(260, 260); flGeo.rotateX(-Math.PI / 2);
    const flMat = new THREE.ShaderMaterial({ uniforms: { uT: FX.clock, uK: { value: 1 }, uR: { value: SV.R0 }, uBox: box }, vertexShader: WALL_V, fragmentShader: FLOOR_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const floor = new THREE.Mesh(flGeo, flMat); floor.position.y = 0.05; floor.frustumCulled = false; floor.renderOrder = 2;
    g.scene.add(wall, floor);
    SV.hud();
    g.svVis = { wall, floor, dispose: () => { wallGeo.dispose(); wallMat.dispose(); flGeo.dispose(); flMat.dispose(); } };
  };
  SV.render = function (g) {
    if (!g.svVis) return;
    const r = SV.radius(g), V = g.svVis;
    V.wall.scale.set(r, 12, r);
    V.floor.material.uniforms.uR.value = r;
    // (it shows from the countdown, brighter once it's closing)
    const k = g.phase === 'ended' ? 0.3 : (g.playTime || 0) < SV.GRACE ? 0.55 : 1;
    V.wall.material.uniforms.uK.value = k; V.floor.material.uniforms.uK.value = k;
    // you outside it: a warning with the seconds left
    const me = g.local, el = SV.warnEl;
    if (el) {
      const out = me && !me.svOut && me.svRing > 0.05 && Math.hypot(me.pos.x, me.pos.z) > r && g.phase === 'play';
      el.style.display = out ? '' : 'none';
      if (out) el.innerHTML = 'BACK INTO THE RING <b>' + Math.max(0, SV.OUT_SECS - me.svRing).toFixed(1) + '</b>';
    }
  };
  SV.hud = function () {
    let el = document.getElementById('svWarn');
    if (!el) { el = document.createElement('div'); el.id = 'svWarn'; el.className = 'sv-warn'; document.body.appendChild(el); }
    el.style.display = 'none';
    SV.warnEl = el;
  };
  SV.dispose = function (g) { if (g.svVis) { g.scene.remove(g.svVis.wall, g.svVis.floor); g.svVis.dispose(); g.svVis = null; } if (SV.warnEl) SV.warnEl.style.display = 'none'; };

  // ---------- the bots ----------
  // Hunt the best target (near, in front, not coming straight at you), lead it, boost when lined up; get out of the
  // way of a car coming head on at speed (a hop or a swerve, sooner the better the bot); keep inside the ring; top
  // up at a boost pad when low; flip back over when upside down.
  function steerTo(car, c, x, z) {
    const dx = x - car.pos.x, dz = z - car.pos.z;
    const ahead = dx * car.fwd.x + dz * car.fwd.z, side = dx * car.left.x + dz * car.left.z;
    const ang = Math.atan2(side, ahead); // + = target on the left
    c.steer = U.clamp(-ang * 2.6, -1, 1);
    return { ang, dist: Math.hypot(dx, dz) };
  }
  SV.think = function (car, g, dt) {
    const c = car.controls, ai = car.sv || (car.sv = { t: 0, target: null, hop: 0, slide: 0, flipT: 0 });
    c.throttle = 0; c.steer = 0; c.pitch = 0; c.roll = 0; c.boost = false; c.handbrake = false; c.jump = false; c.airRollFree = false;
    if (car.svOut || car.demolished || g.phase !== 'play') { if (g.phase === 'countdown') c.throttle = 0; return; }
    const sk = car.skill == null ? 0.5 : car.skill;
    ai.t -= dt; ai.hop -= dt; ai.flipT -= dt;
    // upside down: jump to flip back
    if (car.onRoof && ai.flipT <= 0) { c.jumpSeq++; c.jump = true; ai.flipT = 0.8; return; }
    if (!car.onGround) { c.throttle = 1; c.boost = car.fwd.y > -0.2 && car.fwd.y < 0.3 && car.boost > 30 && Math.random() < 0.3; return; }
    const r = SV.radius(g), dc = Math.hypot(car.pos.x, car.pos.z), sp = car.vel.length();
    // a car coming at me, bumper first and fast: get out of the way (a hop, or a hard swerve)
    for (const o of g.cars) {
      if (o === car || o.svOut || o.demolished) continue;
      const dx = car.pos.x - o.pos.x, dz = car.pos.z - o.pos.z, d = Math.hypot(dx, dz) || 1;
      if (d > 16) continue;
      const close = (o.vel.x - car.vel.x) * dx / d + (o.vel.z - car.vel.z) * dz / d, facing = (o.fwd.x * dx + o.fwd.z * dz) / d;
      if (close > SV.DEMO && facing > 0.8 && d / close < 0.25 + 0.45 * sk && Math.random() < 0.25 + 0.6 * sk) {
        if (ai.hop <= 0 && Math.random() < 0.6) { c.jumpSeq++; c.jump = true; ai.hop = 1.2; }
        // (swerve: away from its line)
        const side = (o.fwd.x * car.left.x + o.fwd.z * car.left.z);
        c.steer = side > 0 ? -1 : 1; c.throttle = 1; c.boost = car.boost > 10;
        return;
      }
    }
    // keep inside the ring (head for the middle when near its edge)
    let tx, tz, mode = 'hunt';
    if (dc > r - 5 - sp * 0.25) { tx = 0; tz = 0; mode = 'ring'; }
    else {
      // a target: pick again now and then
      if (ai.t <= 0 || !ai.target || ai.target.svOut || ai.target.demolished) {
        ai.t = 0.6 + Math.random() * 0.8;
        let best = null, bs = 1e9;
        for (const o of g.cars) {
          if (o === car || o.svOut || o.demolished) continue;
          const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z, d = Math.hypot(dx, dz) || 1;
          const inFront = (dx * car.fwd.x + dz * car.fwd.z) / d, theyFace = -(o.fwd.x * dx + o.fwd.z * dz) / d;
          const s = d - inFront * 12 + theyFace * 10 + (o.isLocal ? -4 * sk : 0) + Math.random() * 6;
          if (s < bs) { bs = s; best = o; }
        }
        ai.target = best;
      }
      const o = ai.target;
      if (!o) { tx = 0; tz = 0; }
      else {
        // low on boost and a big pad close: top up first
        if (car.boost < 20 && g.padState) {
          let pad = null, pd = 22;
          g.padState.forEach((p) => { if (!p.active || !p.big) return; const d = Math.hypot(p.x - car.pos.x, p.z - car.pos.z); if (d < pd && Math.hypot(p.x, p.z) < r - 3) { pd = d; pad = p; } });
          if (pad) { tx = pad.x; tz = pad.z; mode = 'pad'; }
        }
        if (mode === 'hunt') {
          // lead it (better bots lead better), with a little aim wobble for the weaker ones
          const d = Math.hypot(o.pos.x - car.pos.x, o.pos.z - car.pos.z), t = Math.min(1.2, d / Math.max(10, sp + 6)) * (0.4 + 0.6 * sk);
          tx = o.pos.x + o.vel.x * t + Math.sin(g.time * 1.7 + car.id) * (1 - sk) * 2.5;
          tz = o.pos.z + o.vel.z * t + Math.cos(g.time * 1.3 + car.id) * (1 - sk) * 2.5;
        }
      }
    }
    const st = steerTo(car, c, tx, tz);
    const a = Math.abs(st.ang);
    c.throttle = a > 2.3 && st.dist < 10 && sp < 6 ? -1 : 1;
    c.handbrake = a > 1.3 && sp > 7;
    c.boost = a < 0.3 && car.boost > 2 && (mode !== 'pad') && (mode === 'ring' ? dc > r - 2 : st.dist > 4);
  };
  if (BL.AI && BL.AI.think && !BL.AI._survival) {
    const think0 = BL.AI.think;
    BL.AI.think = function (car, game, dt) { if (game && game.mode === 'survival') { SV.think(car, game, dt); return; } think0.call(this, car, game, dt); };
    BL.AI._survival = true;
  }
})(window.BL);
