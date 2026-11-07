'use strict';
// Rocket League (fan remake) - 3D showroom used behind the menus (car preview, item previews)
(function (BL) {
  const U = BL.util;
  const V3 = THREE.Vector3;
  const G = BL.Garage = { team: 0 };

  G.init = function () {
    const sc = G.scene = G.studio = new THREE.Scene();
    sc.background = new THREE.Color('#0b1020');
    sc.fog = new THREE.Fog(new THREE.Color('#0b1020'), 14, 40);
    const low = BL.App.quality === 'low';
    if (!low) G.env = BL.App.makeStudioEnv();
    sc.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a1a28, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(4, 7, 5); sc.add(key);
    const rim = new THREE.DirectionalLight(0x7aa8ff, 0.7); rim.position.set(-6, 3, -5); sc.add(rim);
    G.teamLight = new THREE.PointLight(0x2f7bff, 1.2, 12, 2); G.teamLight.position.set(0, 0.6, 0); sc.add(G.teamLight);
    if (BL.App.quality === 'high') { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3; }
    // floor
    const fl = U.canvas(512, 512);
    const g = fl.g;
    const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256);
    gr.addColorStop(0, '#1d2742'); gr.addColorStop(1, '#0b1020');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(90,130,255,0.18)'; g.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const ftex = new THREE.CanvasTexture(fl.c);
    if (THREE.sRGBEncoding) ftex.encoding = THREE.sRGBEncoding;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), low ? new THREE.MeshLambertMaterial({ map: ftex }) : new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.55, metalness: 0.25, envMap: G.env, envMapIntensity: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    sc.add(floor);
    G.floor = floor;
    const plat = G.plat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.08, 48), low ? new THREE.MeshLambertMaterial({ color: 0x232838 }) : new THREE.MeshStandardMaterial({ color: 0x1a1e2b, roughness: 0.25, metalness: 0.8, envMap: G.env }));
    plat.position.y = 0.04; plat.receiveShadow = true;
    sc.add(plat);
    G.ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: 0x2f7bff }));
    G.ring.rotation.x = Math.PI / 2; G.ring.position.y = 0.085;
    sc.add(G.ring);
    G.turn = new THREE.Group();
    G.turn.position.y = 0.08;
    sc.add(G.turn);
    G.angle = 0.6; G.spin = 0.25; G.drag = null; G.zoom = 0; G.zoomT = 0;
    const cv = BL.App.renderer.domElement;
    const down = (x) => { G.drag = { x, a: G.angle }; };
    const move = (x) => { if (G.drag && G.active) { G.angle = G.drag.a + (x - G.drag.x) * 0.01; G.spinPause = 3; } };
    cv.addEventListener('mousedown', (e) => { if (G.active) down(e.clientX); });
    window.addEventListener('mousemove', (e) => move(e.clientX));
    window.addEventListener('mouseup', () => { G.drag = null; });
    cv.addEventListener('touchstart', (e) => { if (G.active && e.touches[0]) down(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchmove', (e) => { if (e.touches[0]) move(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchend', () => { G.drag = null; });
  };

  // Behind the menus the car stands on a real stadium pitch, like the real game's main menu (the item shop keeps
  // the turntable studio). Very Low (old Chromebooks) skips the stadium and uses the studio everywhere.
  G.view = 'main';
  const VIEWS = {
    main: { stage: true }, garage: { stage: true }, menu: { stage: true, away: true }, title: { stage: true, away: true, pan: true }, shop: { stage: false },
  };
  const STAGE_CAR = new V3(-5, 0, -30);
  const useStage = () => !BL.App.potato;
  function ensureStage() {
    if (G.stage || !useStage()) return;
    try {
      const map = BL.MAP_BY_ID.champions || BL.MAPS[0];
      BL.Physics.setArena(map.arena || null);
      G.stageA = Object.assign({}, BL.Physics.arena);
      G.stage = new THREE.Scene();
      G.stageH = BL.Arena.build(G.stage, map, BL.Physics.padLayout());
    } catch (e) { console.warn('[garage] stadium failed, using the studio', e); G.stage = null; G.stageH = null; }
  }
  function dropStage() {
    if (!G.stage) return;
    if (G.scene === G.stage) { G.scene = G.studio; G.studio.add(G.turn); }
    try { G.stageH.dispose(); } catch (e) { /* already gone */ }
    G.stage = null; G.stageH = null;
  }

  G.show = function () {
    G.active = true;
    BL.Models.envMap = G.env || null;
    ensureStage();
    BL.FX.attach(G.scene);
    G.refresh();
  };
  // Low keeps one arena in memory at a time: the menu stadium goes while a match is on
  G.hide = function () { G.active = false; G.boosting = false; if (BL.App.quality === 'low') dropStage(); };

  // loadout optional (defaults to the player's)
  G.refresh = function (loadout) {
    G.loadout = loadout || BL.Save.resolveLoadout();
    BL.Models.envMap = G.env || null;
    if (G.model) G.model.dispose();
    G.model = new BL.Models.CarModel(G.loadout, G.team);
    G.model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    G.model.group.position.y = G.model.style.restH;
    G.turn.add(G.model.group);
    const col = new THREE.Color(BL.TEAM_MAIN[G.team]);
    G.ring.material.color.copy(col);
    G.teamLight.color.copy(col);
  };

  G.setTeam = function (t) { G.team = t; G.refresh(G.loadout); };

  // ---------- the item shop's showroom ----------
  // Like the real shop: a metal hangar (panelled walls with blue light strips, big arches overhead, an opening at
  // the back onto a bright stadium) round a large turntable with a gold ring and a studded steel rim that turns with
  // the car. Built the first time the shop opens and only shown there; Very Low gets smaller textures and no arches.
  const BEHIND = Math.PI + 0.5; // straight behind the car from the studio camera
  function shopRoom() {
    if (G.room) return G.room;
    const low = BL.App.quality === 'low', potato = !!BL.App.potato, T = potato ? 512 : 1024;
    const mat = (o) => (low ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.5, metalness: 0.55, envMap: G.env, envMapIntensity: 0.6 }, o)));
    const tex = (c, rx, ry) => { const t = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry || 1); } return t; };
    const room = new THREE.Group();
    // turntable top: dark centre, a steel ring, vents, the gold band and a studded steel rim with blue lights
    {
      const { c, g } = U.canvas(T, T), C0 = T / 2, k = T / 512;
      const ring = (r0, r1, fill) => { g.beginPath(); g.arc(C0, C0, r1 * k, 0, Math.PI * 2); g.arc(C0, C0, r0 * k, 0, Math.PI * 2, true); g.fillStyle = fill; g.fill(); };
      const rad = (r0, r1, stops) => { const gr = g.createRadialGradient(C0, C0, r0 * k, C0, C0, r1 * k); stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s)); return gr; };
      g.fillStyle = '#0d0f14'; g.fillRect(0, 0, T, T);
      ring(0, 150, rad(0, 150, ['#20242d', '#171a21', '#1c2028']));
      for (let r = 14; r < 150; r += 9) { g.strokeStyle = 'rgba(255,255,255,' + (r % 27 ? 0.025 : 0.06) + ')'; g.lineWidth = k; g.beginPath(); g.arc(C0, C0, r * k, 0, Math.PI * 2); g.stroke(); }
      ring(150, 163, rad(150, 163, ['#5b6372', '#b7c0cf', '#4d5462']));
      ring(163, 197, '#1b2029');
      g.strokeStyle = '#0a0c11'; g.lineWidth = 5 * k;
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; g.beginPath(); g.moveTo(C0 + Math.cos(a) * 168 * k, C0 + Math.sin(a) * 168 * k); g.lineTo(C0 + Math.cos(a) * 192 * k, C0 + Math.sin(a) * 192 * k); g.stroke(); }
      ring(197, 216, rad(197, 216, ['#7a5718', '#f4d47c', '#c99a3a', '#8a6420']));
      g.fillStyle = 'rgba(60,40,8,0.8)';
      for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; g.save(); g.translate(C0 + Math.cos(a) * 206.5 * k, C0 + Math.sin(a) * 206.5 * k); g.rotate(a); g.fillRect(-1.2 * k, -3.5 * k, 2.4 * k, 7 * k); g.restore(); }
      ring(216, 220, '#0c0e13');
      ring(220, 252, rad(220, 252, ['#6d7686', '#aab3c2', '#7c8595', '#4a515f']));
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2, x = C0 + Math.cos(a) * 236 * k, y = C0 + Math.sin(a) * 236 * k;
        if (i % 4 === 0) { g.fillStyle = '#7cc4ff'; g.shadowColor = '#3d9bff'; g.shadowBlur = 8 * k; g.beginPath(); g.arc(x, y, 3.2 * k, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; }
        else { g.fillStyle = '#3c424e'; g.beginPath(); g.arc(x, y, 2.6 * k, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - 0.8 * k, y - 0.8 * k, 1 * k, 0, Math.PI * 2); g.fill(); }
      }
      ring(252, 256, '#14171d');
      const top = mat({ map: tex(c), metalness: 0.65, roughness: 0.38 }), side = mat({ color: 0x6f7888, metalness: 0.8, roughness: 0.35 });
      const tt = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.98, 0.16, potato ? 40 : 72), [side, top, side]);
      tt.position.y = -0.08; tt.receiveShadow = true;
      G.tt = tt; G.turn.add(tt);
    }
    // floor: steel deck plates round a painted ring
    {
      const { c, g } = U.canvas(T, T), C0 = T / 2, P = T / 16;
      g.fillStyle = '#262c37'; g.fillRect(0, 0, T, T);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        const v = 34 + ((i * 7 + j * 13) % 5) * 3;
        g.fillStyle = `rgb(${v},${v + 5},${v + 14})`; g.fillRect(i * P + 2, j * P + 2, P - 4, P - 4);
        g.fillStyle = 'rgba(255,255,255,0.12)'; for (const [x, y] of [[6, 6], [P - 6, 6], [6, P - 6], [P - 6, P - 6]]) { g.beginPath(); g.arc(i * P + x, j * P + y, T / 512, 0, Math.PI * 2); g.fill(); }
      }
      const vg = g.createRadialGradient(C0, C0, T * 0.1, C0, C0, T * 0.5); vg.addColorStop(0, 'rgba(70,90,130,0.25)'); vg.addColorStop(1, 'rgba(5,8,16,0.85)');
      g.fillStyle = vg; g.fillRect(0, 0, T, T);
      g.strokeStyle = 'rgba(214,170,74,0.7)'; g.lineWidth = T / 180; g.setLineDash([T / 60, T / 90]);
      g.beginPath(); g.arc(C0, C0, T * 0.068, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      const fl = new THREE.Mesh(new THREE.CircleGeometry(18, potato ? 32 : 64), mat({ map: tex(c), metalness: 0.45, roughness: 0.6 }));
      fl.rotation.x = -Math.PI / 2; fl.position.y = 0.004; fl.receiveShadow = true;
      room.add(fl);
    }
    // the hangar wall: rows of panels with rivets, open behind the car
    {
      const { c, g } = U.canvas(T / 2, T / 2), W = T / 2;
      g.fillStyle = '#2b3240'; g.fillRect(0, 0, W, W);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
        const x = col * W / 2, y = row * W / 4, v = 46 + ((row + col) % 2) * 8;
        const gr = g.createLinearGradient(0, y, 0, y + W / 4); gr.addColorStop(0, `rgb(${v + 14},${v + 20},${v + 30})`); gr.addColorStop(1, `rgb(${v - 10},${v - 6},${v + 2})`);
        g.fillStyle = gr; g.fillRect(x + 3, y + 3, W / 2 - 6, W / 4 - 6);
        g.fillStyle = 'rgba(255,255,255,0.18)'; for (let q = 0; q < 6; q++) { g.beginPath(); g.arc(x + 10 + q * (W / 2 - 20) / 5, y + 8, W / 300, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = '#151a24'; g.fillRect(0, W * 0.72, W, W * 0.05);
      const gap = 1.1, R = 11.5, H = 13;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, potato ? 32 : 64, 1, true, BEHIND + gap / 2, Math.PI * 2 - gap), mat({ map: tex(c, 14, 1.5), side: THREE.BackSide, metalness: 0.6, roughness: 0.45 }));
      wall.position.y = H / 2; room.add(wall);
      // blue light strips along it
      const glow = new THREE.MeshBasicMaterial({ color: 0x3d8bff, side: THREE.BackSide });
      for (const y of [1.15, 6.3, 10.4]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.12, potato ? 32 : 64, 1, true, BEHIND + gap / 2, Math.PI * 2 - gap), glow); s.position.y = y; room.add(s); }
      // through the opening: a bright stadium, blurred
      // (drawn sharp, then blurred into a second canvas: it's out of focus, like the real one)
      const BW = T / 2, BH = T / 4, sh = U.canvas(BW, BH), sg = sh.g;
      const sky = sg.createLinearGradient(0, 0, 0, BH);
      sky.addColorStop(0, '#7f98c4'); sky.addColorStop(0.42, '#eef3ff'); sky.addColorStop(0.6, '#d8e4f4'); sky.addColorStop(0.72, '#a9c79a'); sky.addColorStop(1, '#6f9a66');
      sg.fillStyle = sky; sg.fillRect(0, 0, BW, BH);
      sg.fillStyle = 'rgba(40,52,78,0.45)'; sg.fillRect(0, BH * 0.5, BW, BH * 0.1);
      for (let i = 0; i < 9; i++) { const x = (i + 0.5) * BW / 9, y = BH * 0.36, gl = sg.createRadialGradient(x, y, 0, x, y, BW / 14); gl.addColorStop(0, 'rgba(255,255,255,0.95)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gl; sg.fillRect(x - BW / 14, y - BW / 14, BW / 7, BW / 7); }
      const bd = U.canvas(BW, BH);
      bd.g.filter = 'blur(' + Math.round(BW / 90) + 'px)'; bd.g.drawImage(sh.c, 0, 0); bd.g.filter = 'none';
      const back = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), new THREE.MeshBasicMaterial({ map: tex(bd.c), fog: false }));
      // (its horizon at about eye height)
      back.position.set(Math.sin(BEHIND) * 17, 3, Math.cos(BEHIND) * 17); back.lookAt(0, 3, 0);
      room.add(back);
      // big arches across the hangar, each with a light strip
      if (!potato) {
        const steel = mat({ color: 0x5d6676, metalness: 0.85, roughness: 0.35 });
        for (const dd of [3.5, 7.5]) {
          const arch = new THREE.Group();
          arch.add(new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.32, 6, 40, Math.PI), steel));
          arch.add(new THREE.Mesh(new THREE.TorusGeometry(10.1, 0.05, 4, 40, Math.PI), glow));
          arch.rotation.y = BEHIND; arch.position.set(Math.sin(BEHIND) * dd, 0, Math.cos(BEHIND) * dd);
          room.add(arch);
        }
      }
    }
    room.visible = false;
    G.studio.add(room);
    return (G.room = room);
  }

  // party members and splitscreen Player 2 stand beside your car on the pitch, like the real menu
  // list: [{ key, name, loadout }] (key changes when their car changes)
  G.companions = [];
  // party members' cars: side by side with about half a car's width between them, like the real menu line-up
  const SIDE = [[1.5, 0.3], [-1.5, 0.3], [3.0, 0.75], [-3.0, 0.75]];
  G.setCompanions = function (list) {
    list = (list || []).slice(0, SIDE.length);
    const sig = list.map((c) => c.key).join('|');
    if (sig === G.compSig) return;
    G.compSig = sig;
    for (const c of G.companions) { if (c.model) { c.model.group.parent && c.model.group.parent.remove(c.model.group); c.model.dispose(); } }
    G.companions = list.map((c, i) => {
      const m = new BL.Models.CarModel(c.loadout, G.team);
      m.group.position.set(SIDE[i][0], m.style.restH, -SIDE[i][1]);
      m.group.rotation.y = 0.05 * Math.sign(SIDE[i][0]);
      G.turn.add(m.group);
      return { key: c.key, name: c.name, model: m };
    });
  };

  // Goal explosion preview, like the real garage: the camera cuts to a goal, a ball is shot into the net and the
  // explosion goes off there, out of the goal and up the pitch as in a match. On the stadium it's the real blue
  // goal; Very Low's studio gets a simple goal frame.
  const BOOM_SHOT = 0.35, BOOM_FLY = 0.75, BOOM_END = 4.4;
  G.previewExplosion = function (fxId, paint) {
    BL.FX.needModel(fxId);
    BL.FX.clear();
    if (G.boom && G.boom.ball) G.boom.ball.visible = false;
    G.boom = { fx: fxId, color: paint ? BL.PAINT_BY_ID[paint].color : null, t: 0, fired: false, ball: G.boom && G.boom.ball };
  };
  // the goal the preview uses: goal line z (the net is at smaller z) and the mouth's half width / height
  function boomGoal(sc) {
    if (sc === G.stage && G.stageA) return { z: -G.stageA.hl, hw: G.stageA.goalHW, h: G.stageA.goalH };
    if (!G.pvGoal) {
      // studio goal frame at real size (explosions are made for a real goal): posts, crossbar and a see-through
      // net, 10 m behind the turntable
      const grp = new THREE.Group(), hw = 8.93, h = 6.43, d = 4;
      const post = new THREE.MeshLambertMaterial({ color: 0xdfe6f2 });
      const tube = (w, hgt, dp, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, dp), post); m.position.set(x, y, z); grp.add(m); };
      tube(0.3, h, 0.3, -hw, h / 2, 0); tube(0.3, h, 0.3, hw, h / 2, 0); tube(hw * 2 + 0.3, 0.3, 0.3, 0, h, 0);
      tube(0.18, 0.18, d, -hw, h, -d / 2); tube(0.18, 0.18, d, hw, h, -d / 2);
      const { c, g } = U.canvas(128, 128);
      g.strokeStyle = 'rgba(220,230,255,0.55)'; g.lineWidth = 2;
      for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const netMat = (rx, ry) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(BL.TEAM_MAIN[0]).lerp(new THREE.Color('#ffffff'), 0.5) }); };
      const back = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, h), netMat(hw, h / 2)); back.position.set(0, h / 2, -d); grp.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, d), netMat(hw, d / 2)); top.rotation.x = Math.PI / 2; top.position.set(0, h, -d / 2); grp.add(top);
      for (const sx of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(d, h), netMat(d / 2, h / 2)); sd.rotation.y = Math.PI / 2; sd.position.set(sx * hw, h / 2, -d / 2); grp.add(sd); }
      grp.position.z = -10;
      grp.visible = false;
      G.studio.add(grp);
      G.pvGoal = grp;
    }
    return { z: -10, hw: 8.93, h: 6.43, studio: true };
  }
  // runs the preview; returns true while it owns the camera
  const _bs = new V3(), _be = new V3(), _bp = new V3();
  function boomUpdate(dt, sc) {
    const B = G.boom;
    if (!B) return false;
    B.t += dt;
    const gl = boomGoal(sc);
    if (G.pvGoal) G.pvGoal.visible = !!gl.studio;
    // the studio's fog would hide a goal that far away: pushed back while the preview runs
    if (gl.studio && sc.fog) { if (B.fog == null) B.fog = [sc.fog.near, sc.fog.far]; sc.fog.near = 60; sc.fog.far = 160; }
    if (!B.ball) { B.ball = BL.Models.makeBall(0.93); }
    if (B.ball.parent !== sc) sc.add(B.ball);
    const r = 0.93;
    // shot from out on the pitch, a little off to the side, curling into the net just under the bar
    _bs.set(gl.hw * 0.7, r + 0.4, gl.z + 20);
    _be.set(-gl.hw * 0.25, Math.min(gl.h - r - 0.3, gl.h * 0.55), gl.z - r * 2.2);
    const f = U.clamp((B.t - BOOM_SHOT) / BOOM_FLY, 0, 1);
    _bp.copy(_bs).lerp(_be, f);
    _bp.y += Math.sin(f * Math.PI) * 2.2;
    B.ball.position.copy(_bp);
    B.ball.rotation.x -= dt * 9;
    B.ball.visible = f < 1;
    if (f >= 1 && !B.fired) {
      B.fired = true;
      BL.FX.goalExplosion(B.fx, _be.clone(), BL.TEAM_MAIN[G.team], B.color);
    }
    BL.FX.update(dt);
    // camera: out on the pitch to one side, looking into the goal mouth
    const cam = BL.App.camera, wide = BL.App.width / BL.App.height > 1.1, s = 1;
    _p.set(-gl.hw * 1.35, 4.4 * s + 0.6, gl.z + 25 * s);
    _l.set(0, gl.h * 0.6, gl.z + 4 * s);
    if (B.t < dt * 1.5) { G.camP = (G.camP || _p.clone()).copy(_p); G.camL = (G.camL || _l.clone()).copy(_l); }
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.1));
    G.camP.lerp(_p, k); G.camL.lerp(_l, k);
    cam.position.copy(G.camP); cam.up.set(0, 1, 0); cam.lookAt(G.camL);
    BL.App.setFov(wide ? 70 : 80);
    if (sc === G.stage) { if (G.stageH.sky) G.stageH.sky.position.copy(cam.position); if (G.stageH.update) G.stageH.update(dt, performance.now() / 1000); }
    if (B.t > BOOM_END) {
      B.ball.visible = false;
      if (G.pvGoal) G.pvGoal.visible = false;
      if (B.fog && sc.fog) { sc.fog.near = B.fog[0]; sc.fog.far = B.fog[1]; }
      G.boom = null; G.camSnap = true;
      if (B.ball.parent) B.ball.parent.remove(B.ball);
      B.ball.geometry.dispose(); B.ball.material.dispose();
    }
    return true;
  }
  G.setBoostPreview = function (on) { G.boosting = !!on; };

  G.update = function (dt) {
    if (!G.active) return;
    const V = VIEWS[G.view] || VIEWS.main;
    const sc = G.stage && V.stage ? G.stage : G.studio;
    if (G.scene !== sc) {
      G.scene = sc; sc.add(G.turn); BL.FX.clear(); BL.FX.attach(sc);
      if (sc === G.stage) G.turn.position.copy(STAGE_CAR); else G.turn.position.set(0, 0.08, 0);
      G.camSnap = true;
    }
    // the shop's showroom (not while an explosion preview has the studio goal up)
    const shop = G.view === 'shop' && sc === G.studio && !G.boom;
    if (shop) shopRoom();
    if (G.room) {
      G.room.visible = shop; G.tt.visible = shop;
      G.plat.visible = G.ring.visible = G.floor.visible = !shop;
      const f = G.studio.fog;
      if (shop) { f.near = 18; f.far = 60; } else if (!G.boom) { f.near = 14; f.far = 40; }
    }
    if (boomUpdate(dt, sc)) return;
    if (sc === G.stage) return stageUpdate(dt, V);
    if (G.spinPause > 0) G.spinPause -= dt; else if (!G.drag) G.angle += dt * G.spin;
    G.turn.rotation.y = G.angle;
    if (G.model) {
      G.model.group.updateMatrixWorld();
      G.model.previewBoost = G.boosting;
      G.model.update(dt, null);
      if (G.boosting) BL.FX.boost(G.model, null, dt);
    }
    BL.FX.update(dt);
    const cam = BL.App.camera;
    const aspect = BL.App.width / BL.App.height;
    const wide = aspect > 1.1;
    if (G.zoomT > 0) G.zoomT -= dt;
    G.zoom = U.damp(G.zoom, G.zoomT > 0 ? 1 : 0, 3, dt);
    // (the shop looks down on its big turntable from a little higher, like the real one)
    const d = U.lerp(shop ? (wide ? 3.45 : 4.8) : wide ? 5.4 : 6.4, 14, G.zoom);
    cam.position.set(Math.sin(0.5) * d, U.lerp(shop ? 1.45 : 1.7, 5, G.zoom), Math.cos(0.5) * d);
    G.offX = U.damp(G.offX == null ? -0.35 : G.offX, G.wideOffset != null ? G.wideOffset : -0.35, 5, dt);
    const lookX = wide ? U.lerp(G.offX, 0, G.zoom) : 0;
    G.look = G.look || new V3();
    G.look.set(lookX * Math.cos(0.5), U.lerp(shop ? 0.62 : 0.45, 2.2, G.zoom), -lookX * Math.sin(0.5));
    cam.up.set(0, 1, 0);
    cam.lookAt(G.look);
    BL.App.setFov(wide ? 58 : 70);
  };

  // stadium: the car parked near the blue goal; the camera eases between the screens' views
  const _p = new V3(), _l = new V3(), _c = new V3(), _w = new V3();
  function stageUpdate(dt, V) {
    // rests three-quarters on with the nose to the left of the screen (like the reference shots); drag to turn it
    if (G.spinPause > 0) G.spinPause -= dt; else if (!G.drag) G.angle = U.damp(G.angle, -0.3, 2, dt);
    G.turn.rotation.y = G.angle;
    if (G.model) {
      G.model.group.updateMatrixWorld();
      G.model.previewBoost = G.boosting;
      G.model.update(dt, null);
      if (G.boosting) BL.FX.boost(G.model, null, dt);
    }
    G.companions.forEach((c) => c.model.update(dt, null));
    BL.FX.update(dt);
    const cam = BL.App.camera, wide = BL.App.width / BL.App.height > 1.1;
    G.t = (G.t || 0) + dt;
    if (V.away) {
      // looking up the pitch at the far stands (the car is behind the camera)
      const a = V.pan ? Math.sin(G.t * 0.05) * 0.5 : 0.12;
      _p.set(Math.sin(a) * 14, 4.2, -14 + Math.cos(a) * 2);
      _l.set(_p.x + Math.sin(a) * 40, 9, 60);
    } else {
      if (G.zoomT > 0) G.zoomT -= dt;
      G.zoom = U.damp(G.zoom, G.zoomT > 0 ? 1 : 0, 3, dt);
      // close and low like the real main menu: the car fills about half the screen
      // party members' cars stand beside yours: pull back and centre on the whole line-up, like the real menu
      const nComp = G.companions.length;
      G.compOff = G.compOff || new V3();
      _c.set(0, 0, 0);
      if (nComp) { for (const c of G.companions) _c.add(c.model.group.getWorldPosition(_w).sub(STAGE_CAR)); _c.multiplyScalar(1 / (nComp + 1)).setY(0); }
      G.compOff.lerp(_c, 1 - Math.exp(-4 * Math.min(dt, 0.1)));
      G.compMul = U.damp(G.compMul || 1, 1 + Math.min(0.9, 0.38 * nComp), 4, dt);
      const d = U.lerp(wide ? 2.6 : 3.6, 14, G.zoom) * (G.distMul || 1) * G.compMul;
      G.offX = U.damp(G.offX == null ? -0.35 : G.offX, G.wideOffset != null ? G.wideOffset : -0.35, 5, dt);
      // some screens lift the car above a panel along the bottom (Rocket Pass): look a little below it
      G.liftY = U.damp(G.liftY || 0, G.lookYOff || 0, 5, dt);
      // the screens' offsets are tuned for the studio distance (5.2): scale so the car moves the same share of the screen
      const lookX = wide ? U.lerp(G.offX * (d / 5.2), 0, G.zoom) : 0;
      _p.set(Math.sin(0.5) * d, U.lerp(0.8, 5, G.zoom) * (0.8 + 0.2 * G.compMul), Math.cos(0.5) * d).add(STAGE_CAR).add(G.compOff);
      _l.set(lookX * Math.cos(0.5), U.lerp(0.32, 2.2, G.zoom) + G.liftY, -lookX * Math.sin(0.5)).add(STAGE_CAR).add(G.compOff);
    }
    G.camP = G.camP || _p.clone(); G.camL = G.camL || _l.clone();
    if (G.camSnap) { G.camP.copy(_p); G.camL.copy(_l); G.camSnap = false; }
    const k = 1 - Math.exp(-5.5 * Math.min(dt, 0.1));
    G.camP.lerp(_p, k); G.camL.lerp(_l, k);
    cam.position.copy(G.camP);
    cam.up.set(0, 1, 0);
    cam.lookAt(G.camL);
    BL.App.setFov(wide ? 58 : 70);
    if (G.stageH.sky) G.stageH.sky.position.copy(cam.position);
    if (G.stageH.update) G.stageH.update(dt, performance.now() / 1000);
  }
})(window.BL);
