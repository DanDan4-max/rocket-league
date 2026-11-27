'use strict';
// Rocket League (fan remake) - small touches round the pitch (2026-11-26, "make real ideas and implement them"):
//   tyre marks      powersliding (or sliding sideways hard) on the floor leaves dark tyre marks that fade away
//   landing dust    a hard landing on the floor kicks a ring of dust out from under the car
//   ball slams      the ball smashing down into the floor throws dust out round it, more the harder it lands
//   camera flashes  photographers in the crowd: flashes pop round the stands after a goal (and now and then at night)
// The dust is the floor's colour (sand, snow, grass, rock...). Everything but the tyre marks goes in the shared particle
// pools (no draw calls of their own); the marks are one instanced mesh, drawn only while there are any, darkening
// what's under them (multiply). Very Low keeps fewer marks for less time and fewer flashes.
(function (BL) {
  const VIS = BL.Vis = {};
  const U = BL.util;
  const cols = {};
  const C = (h) => cols[h] || (cols[h] = new THREE.Color(h));
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3();
  let S = null; // this match's state

  const dustOf = (map) => {
    const t = map && map.floor && map.floor.type;
    return t === 'sand' ? ['#e6d3aa', '#c4a77d'] : t === 'snow' || t === 'ice' ? ['#ffffff', '#d3e5f7'] : t === 'rock' ? ['#8a7a70', '#4e423c']
      : t === 'neon' || t === 'metal' ? ['#cfd7e8', '#8590a8'] : ['#eff1ea', '#aab5a2'];
  };

  VIS.attach = function (game) {
    VIS.detach();
    if (!game || game.headless || !game.scene) return;
    const App = BL.App, potato = App && App.potato, ql = App && App.quality;
    const N = potato ? 160 : ql === 'low' ? 320 : ql === 'high' ? 720 : 520;
    // soft edges across a mark, darker down the middle (white leaves the floor as it is)
    const { c, g } = U.canvas(32, 4);
    const gr = g.createLinearGradient(0, 0, 32, 0);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, '#b0b0b0'); gr.addColorStop(0.5, '#a2a2a2'); gr.addColorStop(0.78, '#b0b0b0'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 4);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: tex, blending: THREE.MultiplyBlending, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, C('#ffffff'));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.name = 'tyre-marks';
    game.scene.add(mesh);
    S = { game, mesh, geo, mat, tex, N, life: potato ? 4 : ql === 'low' ? 6 : 9, next: 0, used: 0, born: new Float32Array(N), k: new Float32Array(N),
      tracks: new Map(), t: 0, fadeT: 0, lastVy: 0, flashAcc: 0, dust: dustOf(game.map) };
  };
  VIS.detach = function (game) {
    if (!S || (game && S.game !== game)) return;
    if (S.mesh.parent) S.mesh.parent.remove(S.mesh);
    S.geo.dispose(); S.mat.dispose(); S.tex.dispose();
    S = null;
  };

  // ---------- tyre marks ----------
  function mark(x0, z0, x1, z1, w, k) {
    const i = S.next, m = S.mesh;
    S.next = (i + 1) % S.N;
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    _m.compose(_p.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2), _q.setFromAxisAngle(_up, Math.atan2(dx, dz)), _s.set(w, 1, len + w * 0.25));
    m.setMatrixAt(i, _m);
    S.born[i] = S.t; S.k[i] = k;
    const a = m.instanceColor.array, v = 1 - 0.48 * k;
    a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = v;
    if (i + 1 > S.used) S.used = i + 1;
    m.count = S.used; m.visible = true;
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
  function fade() {
    const m = S.mesh, a = m.instanceColor.array, life = S.life;
    let live = 0;
    for (let i = 0; i < S.used; i++) {
      const f = (S.t - S.born[i]) / life;
      let v = 1;
      if (f < 1) { live++; const e = 1 - f; v = 1 - 0.48 * S.k[i] * Math.min(1, e * 2.5); }
      a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = v;
    }
    m.instanceColor.needsUpdate = true;
    if (!live) { m.visible = false; m.count = 0; S.used = 0; S.next = 0; }
  }
  function tyres(c) {
    let tr = S.tracks.get(c);
    if (!tr) S.tracks.set(c, (tr = [{ on: false, x: 0, z: 0 }, { on: false, x: 0, z: 0 }]));
    const sp = Math.hypot(c.vel.x, c.vel.z), lat = Math.abs(c.vel.x * c.left.x + c.vel.z * c.left.z);
    const floor = c.onGround && !c.demolished && c.up.y > 0.85 && c.pos.y < 1.2;
    const sl = c.slideVis ? Math.max(0.4, c.slideK || 0) : 0; // (slideVis: sliding on its tyres; slideK: how far into the powerslide)
    const k = floor && sp > 4 ? Math.max(sl > 0.35 ? 0.5 + 0.5 * sl : 0, lat > 6 ? Math.min(1, (lat - 6) / 8) : 0) : 0;
    for (let s = 0; s < 2; s++) {
      const w = tr[s];
      if (k < 0.05) { w.on = false; continue; }
      const sx = s ? 1 : -1, b = c.hz * 0.72, d0 = sx * c.hx * 0.82;
      const x = c.pos.x - c.fwd.x * b + c.left.x * d0, z = c.pos.z - c.fwd.z * b + c.left.z * d0;
      if (!w.on) { w.on = true; w.x = x; w.z = z; continue; }
      const d = Math.hypot(x - w.x, z - w.z);
      if (d < 0.45) continue;
      if (d < 6) mark(w.x, w.z, x, z, 0.3, k);
      w.x = x; w.z = z;
    }
  }

  // ---------- dust ----------
  function dust(x, z, n, spd, size, life, alpha) {
    const FX = BL.FX;
    if (!FX.alpha) return;
    _v.set(x, 0.18, z);
    FX.burst(_v, n, { colors: S.dust, endColor: S.dust[1], speed: spd, size, life, drag: 3, grav: -0.15, blend: 'alpha', alpha, shape: FX.S.puff, vary: 4, flat: 0.06, vy: 0.3, spin: 0.7, radius: 0.6 });
  }
  // a car coming down hard on the floor (js/game.js carEvents)
  VIS.land = function (game, c) {
    if (!S || S.game !== game || !(c.airTime > 0.7) || c.pos.y > 1.2 || c.up.y < 0.8 || c.demolished) return;
    const k = Math.min(1, (c.airTime - 0.7) / 1.3);
    dust(c.pos.x, c.pos.z, 6 + k * 8, [3, 5 + k * 3], [0.5, 1.5 + k * 0.8], [0.45, 0.8], 0.22 + 0.12 * k);
  };
  function ballSlam(game) {
    const b = game.ball;
    if (!b || b.hidden || b.puck || b.frozen > 0) { S.lastVy = 0; return; }
    const vy = b.vel.y;
    if (S.lastVy < -11 && vy > 0 && b.pos.y < b.r + 1) {
      const s = Math.min(1, (-S.lastVy - 11) / 20);
      dust(b.pos.x, b.pos.z, 8 + s * 10, [5, 8 + s * 6], [0.5, 1.6 + s * 1.2], [0.45, 0.8], 0.2 + 0.12 * s);
    }
    S.lastVy = vy;
  }

  // ---------- camera flashes in the crowd ----------
  function flashes(game, dt) {
    const H = game.arena, fp = H && H.fanPos, FX = BL.FX;
    if (!fp || fp.length < 3 || !FX.add) return;
    const cheer = H.cheer > 0 ? Math.min(1, H.cheer / 2.5) : 0, night = game.map && (game.map.time === 'night' || game.map.time === 'dusk');
    if (!cheer && game.phase !== 'play') return;
    S.flashAcc += (cheer * 160 + (night ? 0.8 : 0.2)) * (BL.App.potato ? 0.4 : FX.density) * dt;
    const n = fp.length / 3;
    while (S.flashAcc >= 1) {
      S.flashAcc -= 1;
      const i = ((Math.random() * n) | 0) * 3;
      // (one of the smoke sheet's white-hot flashes with a four-point glint on it, held up above the fan's head: lower
      // down the stand in front hides it, and the glint alone is too thin to see across the pitch)
      const life = 0.1 + Math.random() * 0.06, y = fp[i + 1] + 2;
      FX.add.spawn(fp[i], y, fp[i + 2], 0, 0, 0, C('#fff8e6'), C('#dcecff'), 3.2, 1.1, life, 0, 0, FX.S.burst + ((Math.random() * 4) | 0), 1);
      FX.add.spawn(fp[i], y, fp[i + 2], 0, 0, 0, C('#ffffff'), C('#d6ebff'), 5.2, 1.6, life, 0, 0, FX.S.flare, 0.9);
    }
  }

  // every frame the match is drawn (js/game.js renderState)
  VIS.update = function (game, dt) {
    if (!S || S.game !== game || dt <= 0) return;
    S.t += dt;
    for (const c of game.cars) tyres(c);
    if (S.used && (S.fadeT += dt) > 0.12) { S.fadeT = 0; fade(); }
    ballSlam(game);
    flashes(game, dt);
  };
})(window.BL);
