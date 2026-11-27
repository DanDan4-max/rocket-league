'use strict';
// Rocket League (fan remake) - Turkey Trot's turkeys (2026-11-22: "Put Turkeys going around and if you run into one,
// you die"). Six giant turkeys strut round the pitch on paths that are a function of the match's play time (they stop
// for kickoffs and goals, and every copy of the game agrees where they are). Driving into one gobbles you: demolished,
// back in three seconds. The ball goes straight through them. Bots steer round the ones in front of them.
//  T.pos(i, t)    where turkey i is at play time t: { x, z, yaw, step }
//  T.hit(game)    (the host, each tick) gobbles any car touching a turkey
//  T.build(...)   the turkeys' look: one instanced mesh, coloured per vertex (one draw call for the flock)
(function (BL) {
  const T = BL.Turkeys = { N: 6, R: 2.0 };
  const U = BL.util, V3 = THREE.Vector3;
  const rnd = U.rng(20261122);
  // each one's path: two sine waves across, two along (out of the goal mouths)
  const P = [];
  for (let i = 0; i < 12; i++) P.push({ fx: [0.09 + rnd() * 0.08, 0.19 + rnd() * 0.12], px: [rnd() * 6.28, rnd() * 6.28], fz: [0.07 + rnd() * 0.07, 0.17 + rnd() * 0.1], pz: [rnd() * 6.28, rnd() * 6.28] });
  const at = (i, t, A, o) => {
    const p = P[i % P.length];
    o.x = A.hw * 0.74 * (0.62 * Math.sin(p.fx[0] * t + p.px[0]) + 0.38 * Math.sin(p.fx[1] * t + p.px[1]));
    o.z = A.hl * 0.72 * (0.62 * Math.sin(p.fz[0] * t + p.pz[0]) + 0.38 * Math.sin(p.fz[1] * t + p.pz[1]));
    return o;
  };
  const _a = {}, _b = {};
  T.pos = function (i, t, A) {
    A = A || BL.Physics.arena;
    at(i, t, A, _a); at(i, t + 0.1, A, _b);
    return { x: _a.x, z: _a.z, yaw: Math.atan2(_b.x - _a.x, _b.z - _a.z), step: Math.hypot(_b.x - _a.x, _b.z - _a.z) * 10 };
  };
  T.time = (g) => (g && g.playTime) || 0;

  // the host: anyone driving into a turkey is gobbled (only in play: not at kickoffs or after a goal)
  T.hit = function (g) {
    if (g.phase !== 'play') return;
    const t = T.time(g), A = BL.Physics.arena;
    for (let i = 0; i < T.N; i++) {
      const p = T.pos(i, t, A);
      for (const c of g.cars) {
        if (c.demolished || c.pos.y > 2.8) continue;
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < T.R) g.turkeyDemo(c, i);
      }
    }
  };
  // bots: a turkey just ahead (in the next ~9 m, within a car width or two of the line) and they swerve round it
  T.avoid = function (car, g) {
    if (!car.onGround || car.demolished) return;
    const t = T.time(g), A = BL.Physics.arena, c = car.controls;
    for (let i = 0; i < T.N; i++) {
      const p = T.pos(i, t, A), dx = p.x - car.pos.x, dz = p.z - car.pos.z;
      const ahead = dx * car.fwd.x + dz * car.fwd.z, side = dx * car.left.x + dz * car.left.z;
      if (ahead > 0 && ahead < 9 && Math.abs(side) < 3.6) { c.steer = side > 0 ? 1 : -1; c.handbrake = false; if (ahead < 4) c.boost = false; return; }
    }
  };
  if (BL.AI && BL.AI.think && !BL.AI._turkeys) {
    const think0 = BL.AI.think;
    BL.AI.think = function (car, game, dt) { think0.call(this, car, game, dt); if (game && game.map && game.map.turkeys) T.avoid(car, game); };
    BL.AI._turkeys = true;
  }

  // ---------- the look ----------
  // one geometry with vertex colours: body, wings, a fan of tail feathers, neck, blue-grey head, red wattle and snood,
  // yellow beak, orange legs. About 2 m tall (giant turkeys: you see them coming). Faces +z, feet at 0.
  function part(geo, col, m) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.applyMatrix4(m);
    const n = geo.attributes.position.count, c = new THREE.Color(col), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    return geo;
  }
  const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new V3(sx || 1, sy || 1, sz || 1));
  let geoCache = null;
  T.geometry = function (low) {
    if (geoCache) return geoCache;
    const s = low ? 6 : 10, parts = [];
    parts.push(part(new THREE.SphereGeometry(0.72, s + 2, s), '#5a361b', M4(0, 1.05, 0, 0, 0, 0, 0.92, 0.82, 1.12)));
    parts.push(part(new THREE.SphereGeometry(0.5, s, s - 2), '#6e4423', M4(0, 1.02, 0.42, 0, 0, 0, 0.9, 0.9, 0.7)));
    for (const sx of [-1, 1]) parts.push(part(new THREE.SphereGeometry(0.5, s, s - 2), '#432812', M4(sx * 0.6, 1.08, -0.05, 0, 0, sx * 0.3, 0.32, 0.62, 0.95)));
    // the tail fan: feathers in bands of brown and tan with pale tips
    const nf = low ? 7 : 11;
    for (let k = 0; k < nf; k++) {
      const a = (k / (nf - 1) - 0.5) * 2.5, dx = Math.sin(a), dy = Math.cos(a);
      parts.push(part(new THREE.SphereGeometry(0.5, s - 2, s - 4), k % 2 ? '#8a5428' : '#b8743a', M4(dx * 0.72, 1.3 + dy * 0.72, -0.78, 0, 0, -a, 0.3, 0.95, 0.06)));
      parts.push(part(new THREE.SphereGeometry(0.17, s - 4, s - 6), '#efe2c4', M4(dx * 1.33, 1.3 + dy * 1.33, -0.8, 0, 0, -a, 1, 0.8, 0.45)));
    }
    parts.push(part(new THREE.CylinderGeometry(0.12, 0.2, 0.75, s - 2), '#6b4a3a', M4(0, 1.62, 0.66, 0.35, 0, 0)));
    parts.push(part(new THREE.SphereGeometry(0.22, s, s - 2), '#a8bdd2', M4(0, 2.0, 0.8)));
    parts.push(part(new THREE.ConeGeometry(0.07, 0.22, 6), '#e3a93a', M4(0, 1.98, 1.06, Math.PI / 2, 0, 0)));
    parts.push(part(new THREE.SphereGeometry(0.1, 6, 5), '#d11f1f', M4(0, 1.8, 0.92, 0, 0, 0, 0.8, 1.4, 0.8)));
    parts.push(part(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 5), '#d11f1f', M4(0.06, 1.88, 1.07, -0.2, 0, 0)));
    for (const sx of [-1, 1]) parts.push(part(new THREE.SphereGeometry(0.035, 4, 3), '#111111', M4(sx * 0.13, 2.05, 0.95)));
    for (const sx of [-1, 1]) {
      parts.push(part(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 5), '#d9822b', M4(sx * 0.24, 0.31, 0.05)));
      parts.push(part(new THREE.BoxGeometry(0.22, 0.05, 0.3), '#d9822b', M4(sx * 0.24, 0.03, 0.14)));
    }
    // merged
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return (geoCache = geo);
  };
  // the flock in an arena: strutting (a bob and a waddle), following the match's play time
  T.build = function (root, H, low) {
    const geo = T.geometry(low);
    const mat = low ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
    const im = new THREE.InstancedMesh(geo, mat, T.N);
    im.frustumCulled = false; im.castShadow = !low;
    root.add(im);
    H.disposables.push(mat);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), one = new V3(1.15, 1.15, 1.15);
    let tl = 0;
    const tick = (dt) => {
      tl += dt;
      const g = BL.game, t = g ? T.time(g) : tl * 0.6;
      for (let i = 0; i < T.N; i++) {
        const s = T.pos(i, t), ph = t * 9 + i;
        e.set(0, s.yaw, Math.sin(ph) * 0.07 * Math.min(1, s.step / 3));
        q.setFromEuler(e);
        p.set(s.x, Math.abs(Math.sin(ph)) * 0.12 * Math.min(1, s.step / 3), s.z);
        im.setMatrixAt(i, m4.compose(p, q, one));
      }
      im.instanceMatrix.needsUpdate = true;
    };
    tick(0);
    H.anim.push(tick);
    return im;
  };
  // gobbled: feathers everywhere
  T.feathers = function (pos) {
    if (!BL.FX || !BL.FX.burst) return;
    BL.FX.burst(pos, 46, { colors: ['#8a5428', '#b8743a', '#efe2c4', '#5a361b'], speed: [3, 10], size: [0.6, 0.35], life: [0.9, 1.8], grav: 2.5, drag: 1.6, blend: 'alpha', alpha: 0.95, up: 0.6, shape: BL.BoostFX ? BL.BoostFX.T.leaf : 1 });
  };
})(window.BL);
