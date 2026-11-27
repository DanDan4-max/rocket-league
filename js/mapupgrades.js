'use strict';
// Rocket League (fan remake) - scenery for the maps that hadn't had any work since the first version (2026-11-23,
// "make the maps that didn't get upgrades better"). Built in code from simple shapes (works from disk), the parked cars
// are the Kenney Car Kit (CC0) already in assets/kenney-cars. Each map's day and night versions both get it.
//   Grand Prix Speedway  a continuous circuit round the stadium with cars racing on it, a start gantry over the pitch
//                    (its lights count the kickoff down), checkered flags on the roof, a blimp, floodlights
//   Champions Field  a road round the stadium, car parks full of cars, floodlight towers, rows of team flags waving
//   Sunset Park      a lake, a Ferris wheel turning (lit up at dusk), park lamps along the paths
//   Sandstorm Dunes  rolling dunes all round, giant pyramids in the haze, an oasis with palm trees, dust devils
//   Magma Core       a crater wall round the stadium, a lake of lava at its foot, lava falls pouring down the wall
//   Neon Nights      holographic billboards, flying traffic on lanes round the towers, a giant neon ring
//   Blossom Gardens  a pagoda, torii gates, stone lanterns, an arched bridge and koi swimming in the pond
// Very Low gets the big shapes and leaves out the small, many ones (fewer cars, no flags, no koi).
// Anything here that moves as a whole object goes in H.live: js/arena.js freezes every other object's matrix once the
// stadium is built (instanced meshes that only change their instance matrices don't need it).
(function (BL) {
  const MU = BL.MapUp = {};
  const U = BL.util, V3 = THREE.Vector3;
  const tierOf = (low) => (BL.App && BL.App.potato ? 0 : low ? 1 : BL.App && BL.App.quality === 'high' ? 3 : 2);
  const mat = (o, low) => (low ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0.05 }, o)));
  const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new V3(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz));
  // one geometry, coloured per vertex, from many parts (one draw call)
  function part(geo, col, m4) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    if (m4) geo.applyMatrix4(m4);
    const n = geo.attributes.position.count, c = new THREE.Color(col), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    return geo;
  }
  function merge(parts) {
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
  function add(root, H, geo, material, cast) {
    const m = new THREE.Mesh(geo, material);
    if (cast) m.castShadow = true;
    root.add(m); H.disposables.push(geo, material);
    return m;
  }
  function inst(root, H, geo, material, list) {
    const im = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
    list.forEach((m4, i) => im.setMatrixAt(i, m4));
    im.count = list.length;
    root.add(im); H.disposables.push(geo, material);
    return im;
  }
  const canvasTex = (w, h, draw, srgb) => { const { c, g } = U.canvas(w, h); draw(g, w, h); const t = new THREE.CanvasTexture(c); if (srgb !== false && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; return t; };

  MU.build = function (root, H, map, A, low, K) {
    const base = map.variantOf || map.id, tier = tierOf(low), night = map.time === 'night';
    const rnd = U.rng(U.hash(base + 'up'));
    // (RC: clear of the stadium's corners, where the stands reach furthest out)
    const RC = Math.hypot(A.hw + K.ST.d1, A.hl + K.ST.d1) + 4;
    const o = { root, H, map, A, low, K, tier, night, rnd, RC };
    try {
      if (base === 'champions') champions(o);
      else if (base === 'speedway') speedway(o);
      else if (base === 'sunset') sunset(o);
      else if (base === 'dunes') dunes(o);
      else if (base === 'magma') magma(o);
      else if (base === 'neon') neon(o);
      else if (base === 'blossom') blossom(o);
    } catch (e) { console.warn('[map upgrade]', base, e); }
  };
  MU.has = (map) => ['champions', 'speedway', 'sunset', 'dunes', 'magma', 'neon', 'blossom'].indexOf(map.variantOf || map.id) >= 0;

  // ---------- shared: a road ring round the stadium, parked cars, floodlight towers, flags ----------
  function road(o, r0, r1, col) {
    const { root, H, tier } = o;
    const tex = canvasTex(512, 64, (g, w, h) => {
      g.fillStyle = col || '#2b2e33'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, h * 0.06, w, h * 0.04); g.fillRect(0, h * 0.9, w, h * 0.04);
      g.fillStyle = 'rgba(255,214,0,0.9)'; for (let x = 0; x < w; x += 64) g.fillRect(x, h * 0.48, 34, h * 0.05);
    });
    tex.wrapS = THREE.RepeatWrapping;
    const geo = new THREE.RingGeometry(r0, r1, tier ? 160 : 72, 1);
    // (the texture runs round the ring)
    const p = geo.attributes.position, uv = geo.attributes.uv, L = Math.PI * 2 * (r0 + r1) / 2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), a = Math.atan2(y, x), r = Math.hypot(x, y); uv.setXY(i, ((a + Math.PI) / (Math.PI * 2)) * (L / 14), (r - r0) / (r1 - r0)); }
    const m = new THREE.Mesh(geo, mat({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o.low));
    m.rotation.x = -Math.PI / 2; m.position.y = -0.56; m.receiveShadow = true;
    root.add(m); H.disposables.push(geo, m.material, tex);
  }
  const CARS = ['sedan', 'suv', 'hatchback-sports', 'van', 'taxi', 'sedan-sports', 'suv-luxury', 'truck', 'police'].map((n) => 'assets/kenney-cars/' + n + '.glb');
  // rows of parked cars: each model's meshes as instanced meshes (a draw call or two a model)
  function parkCars(o, spots) {
    const { root, H, tier } = o;
    if (!spots.length) return;
    // Very Low (2026-11-26, lag fixes): plain two-box cars, all in one mesh. A real model had to be fetched and its
    // shaders built (a stall on an old Chromebook) and was thousands of triangles a car; from the stands it reads the same
    if (!tier || !BL.Models || !BL.Models.loadGLTF) {
      const P = [], cols = ['#c8ccd2', '#2d3440', '#b23a3a', '#2f5fa8', '#e8e8e8', '#3f6b45', '#d8b54a'];
      spots.forEach((p, i) => {
        const c = cols[(i * 5 + (i % 3)) % cols.length], base = M4(p.x, -0.55, p.z, 0, p.yaw, 0);
        P.push(part(new THREE.BoxGeometry(1.9, 0.75, 4.3), c, base.clone().multiply(M4(0, 0.55, 0))));
        P.push(part(new THREE.BoxGeometry(1.6, 0.6, 2.2), c, base.clone().multiply(M4(0, 1.2, -0.2))));
        P.push(part(new THREE.BoxGeometry(1.62, 0.36, 2.0), '#1d2430', base.clone().multiply(M4(0, 1.22, -0.2))));
      });
      add(root, H, merge(P), mat({ vertexColors: true }, true), false);
      return;
    }
    const kinds = CARS.slice(0, [1, 4, 6, 9][tier]); // (Very Low: one model, each kind is a few draw calls)
    const per = kinds.map(() => []);
    spots.forEach((s, i) => per[(i * 7 + (i % 3)) % kinds.length].push(s));
    kinds.forEach((url, k) => {
      if (!per[k].length) return;
      BL.Models.loadGLTF(url, (gltf) => {
        if (H.disposed) return;
        const sc = gltf.scene;
        sc.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(sc), size = box.getSize(new V3()), s = 4.4 / Math.max(size.x, size.z);
        sc.traverse((m) => {
          if (!m.isMesh) return;
          const im = new THREE.InstancedMesh(m.geometry, m.material, per[k].length);
          const rel = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).premultiply(new THREE.Matrix4().makeScale(s, s, s));
          per[k].forEach((p, i) => im.setMatrixAt(i, M4(p.x, -0.55, p.z, 0, p.yaw, 0).multiply(rel).multiply(m.matrixWorld)));
          im.castShadow = tier >= 3; im.frustumCulled = false;
          root.add(im);
        });
      });
    });
  }
  // a car park: a dark tarmac rectangle with white bays, cars in most of them
  function carPark(o, cx, cz, w, d, yaw, fill) {
    const { root, H, rnd, tier } = o;
    const cols = Math.floor(w / 3.4), rows = Math.floor(d / 7.5);
    const tex = canvasTex(256, 256, (g, W, Hh) => {
      g.fillStyle = '#34373c'; g.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 1500; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')'; g.fillRect(Math.random() * W, Math.random() * Hh, 2, 2); }
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) { const x = (c / cols) * W, y0 = (r / rows) * Hh; g.beginPath(); g.moveTo(x, y0 + 4); g.lineTo(x, y0 + Hh / rows * 0.42); g.moveTo(x, y0 + Hh / rows * 0.58); g.lineTo(x, y0 + Hh / rows - 4); g.stroke(); }
    });
    const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o.low));
    m.position.set(cx, -0.555, cz); m.rotation.y = yaw; m.receiveShadow = true;
    root.add(m); H.disposables.push(geo, m.material, tex);
    const spots = [], cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (let r = 0; r < rows; r++) for (let half = 0; half < 2; half++) for (let c = 0; c < cols; c++) {
      if (rnd() > fill) continue;
      const lx = -w / 2 + (c + 0.5) * (w / cols), lz = -d / 2 + (r + 0.25 + half * 0.5) * (d / rows);
      spots.push({ x: cx + lx * cs + lz * sn, z: cz - lx * sn + lz * cs, yaw: yaw + (half ? 0 : Math.PI) + (rnd() - 0.5) * 0.08 });
    }
    return spots.slice(0, [12, 40, 90, 160][tier]);
  }
  // floodlight towers: a lattice mast with a bank of lamps on top (lit at night, a glow round them)
  function floodTowers(o, spots, h) {
    const { root, H, night, tier } = o;
    const P = [];
    P.push(part(new THREE.CylinderGeometry(0.9, 1.6, h, 6), '#9aa3ad', M4(0, h / 2, 0)));
    for (let k = 0; k < 6; k++) P.push(part(new THREE.BoxGeometry(2.2, 0.25, 0.25), '#7f8891', M4(0, h * (0.15 + k * 0.13), 0, 0, k * 0.8, 0.6)));
    P.push(part(new THREE.BoxGeometry(12, 6.5, 1.2), '#4a5058', M4(0, h + 2.6, 0)));
    const geo = merge(P), list = spots.map((s) => M4(s.x, -0.6, s.z, 0, Math.atan2(-s.x, -s.z), 0));
    inst(root, H, geo, mat({ vertexColors: true }, o.low), list);
    // the lamps: a bright panel facing the pitch
    const lg = new THREE.PlaneGeometry(11, 5.5), lm = new THREE.MeshBasicMaterial({ color: night ? 0xfff3d6 : 0xe6ecf2, fog: false });
    inst(root, H, lg, lm, spots.map((s) => { const yaw = Math.atan2(-s.x, -s.z); return M4(s.x + Math.sin(yaw) * 0.7, -0.6 + h + 2.6, s.z + Math.cos(yaw) * 0.7, 0, yaw, 0); }));
    if (night && tier && BL.FX && BL.FX.spriteMat && BL.FX.atlas) {
      const gm = BL.FX.spriteMat(BL.FX.S.light, '#fff1cf', {}); gm.uniforms.opacity.value = 0.55;
      for (const s of spots) { const yaw = Math.atan2(-s.x, -s.z), g = new THREE.Mesh(BL.FX.spriteGeo, gm); g.position.set(s.x + Math.sin(yaw) * 2, h + 2, s.z + Math.cos(yaw) * 2); g.scale.setScalar(34); g.frustumCulled = false; g.renderOrder = 6; root.add(g); }
      H.disposables.push(gm);
    }
  }
  // flags on poles, waving (in the vertex shader: no work per frame)
  function flags(o, spots, cols, checker) {
    const { root, H, tier } = o;
    if (!tier) return;
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 12, 5); poleGeo.translate(0, 6, 0);
    inst(root, H, poleGeo, mat({ color: 0xe8ecf0, metalness: 0.5, roughness: 0.4 }, o.low), spots.map((s) => M4(s.x, s.y == null ? -0.6 : s.y, s.z)));
    const fg = new THREE.PlaneGeometry(4.5, 2.6, 10, 2); fg.translate(2.25, 10, 0);
    const ck = checker ? canvasTex(64, 32, (g, W, Hh) => { for (let x = 0; x < W; x += 8) for (let y = 0; y < Hh; y += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x, y, 8, 8); } }) : null;
    if (ck) H.disposables.push(ck);
    const fm = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, map: ck });
    const uT = BL.FX ? BL.FX.clock : { value: 0 };
    fm.onBeforeCompile = (sh) => { sh.uniforms.uT = uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  float fw = position.x / 4.5;\n  #ifdef USE_INSTANCING\n  float ph = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.2;\n  #else\n  float ph = 0.0;\n  #endif\n  transformed.z += sin(uT * 4.0 + fw * 5.0 + ph) * 0.45 * fw;\n  transformed.y += cos(uT * 3.0 + fw * 4.0 + ph) * 0.12 * fw;'); };
    fm.customProgramCacheKey = () => 'bl-flag';
    const im = inst(root, H, fg, fm, spots.map((s) => M4(s.x, s.y == null ? -0.6 : s.y, s.z, 0, s.yaw || 0, 0)));
    const c = new THREE.Color();
    spots.forEach((s, i) => im.setColorAt(i, c.set(cols[i % cols.length])));
  }
  const ringSpots = (n, r, a0) => Array.from({ length: n }, (_, i) => { const a = (a0 || 0) + (i / n) * Math.PI * 2; return { x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: -a + Math.PI / 2 }; });


  // ---------- Grand Prix Speedway: a real circuit round the stadium, racing on it, a start gantry, a blimp ----------
  // (2026-11-24, "the grand prix speedway looks like the normal map": from the pitch it did. The pitch now has its
  // racing markings (js/arena.js), and here: one continuous track (it used to be 96 straight pieces of the Kenney
  // Racing Kit set right on the grass, so the two fought for the same height and flickered), cars lapping it, a
  // gantry of start lights over the halfway line that counts the kickoff down, checkered flags along the roof and a
  // blimp going round)
  function circuit(o, r, w) {
    const { root, H, tier, low } = o;
    const tex = canvasTex(1024, 128, (g, W, Hh) => {
      g.fillStyle = '#26282c'; g.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 3000; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.06) + ')'; g.fillRect(Math.random() * W, Math.random() * Hh, 2, 2); }
      // (the racing line: darker rubber down the middle)
      const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.25)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      // red / white kerbs on both edges, white lines inside them
      for (let x = 0; x < W; x += 32) { g.fillStyle = (x / 32) % 2 ? '#e53935' : '#f5f5f5'; g.fillRect(x, 0, 32, Hh * 0.11); g.fillRect(x, Hh * 0.89, 32, Hh * 0.11); }
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, Hh * 0.13, W, Hh * 0.025); g.fillRect(0, Hh * 0.845, W, Hh * 0.025);
    });
    tex.wrapS = THREE.RepeatWrapping;
    const geo = new THREE.RingGeometry(r - w / 2, r + w / 2, tier ? 192 : 96, 1);
    const p = geo.attributes.position, uv = geo.attributes.uv, L = Math.PI * 2 * r;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), a = Math.atan2(y, x); uv.setXY(i, ((a + Math.PI) / (Math.PI * 2)) * Math.round(L / 30), (Math.hypot(x, y) - (r - w / 2)) / w); }
    // (a little above the grass, with an offset as well: the two never fight for the same pixels)
    const m = new THREE.Mesh(geo, mat({ map: tex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }, low));
    m.rotation.x = -Math.PI / 2; m.position.y = -0.48; m.receiveShadow = true;
    root.add(m); H.disposables.push(geo, m.material, tex);
    // the start / finish line: a chequered band across the track
    const cg = new THREE.PlaneGeometry(w, 3.2); cg.rotateX(-Math.PI / 2);
    const ct = canvasTex(128, 32, (g, W, Hh) => { for (let x = 0; x < W; x += 8) for (let y = 0; y < Hh; y += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x, y, 8, 8); } });
    const cm = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ map: ct, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
    cm.position.set(r, -0.46, 0); cm.rotation.y = Math.PI / 2;
    root.add(cm); H.disposables.push(cg, cm.material, ct);
  }
  // race cars lapping the circuit (the Kenney Racing Kit's cars, one instanced mesh per part, moved each frame)
  function racers(o, r) {
    const { root, H, tier } = o;
    if (!BL.Models || !BL.Models.loadGLTF) return;
    const urls = ['raceCarRed', 'raceCarGreen', 'raceCarOrange', 'raceCarWhite'].map((n) => 'assets/kits/racing/' + n + '.glb');
    const per = [1, 2, 3, 3][tier], kinds = tier ? 4 : 2, list = [];
    for (let k = 0; k < kinds; k++) for (let j = 0; j < per; j++) list.push({ k, lane: (k + j) % 3 - 1, a: (k * per + j) * 0.55, w: 0.19 + ((k * 5 + j * 3) % 7) * 0.008 });
    const go = (load) => (BL.HQ && BL.HQ.kit ? BL.HQ.kit('racing', load) : load());
    go(() => urls.slice(0, kinds).forEach((url, k) => BL.Models.loadGLTF(url, (gltf) => {
      if (H.disposed) return;
      const mine = list.filter((c) => c.k === k), sc = gltf.scene;
      sc.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(sc), size = box.getSize(new V3()), s = 4.8 / Math.max(size.x, size.z), along = size.z >= size.x;
      const rel = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).premultiply(new THREE.Matrix4().makeScale(s, s, s));
      if (!along) rel.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
      const parts = [];
      sc.traverse((m) => { if (!m.isMesh) return; const im = new THREE.InstancedMesh(m.geometry, m.material, mine.length); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(im); parts.push([im, m.matrixWorld.clone()]); });
      const M = new THREE.Matrix4(), T4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new V3(), one = new V3(1, 1, 1), up = new V3(0, 1, 0);
      H.anim.push((dt) => {
        mine.forEach((c, i) => {
          c.a += c.w * dt;
          const rr = r + c.lane * 3.2;
          pv.set(Math.cos(c.a) * rr, -0.45, Math.sin(c.a) * rr);
          q.setFromAxisAngle(up, -c.a); // (facing along the track: +z of the model is its nose)
          M.compose(pv, q, one).multiply(rel);
          for (const [im, mw] of parts) im.setMatrixAt(i, T4.multiplyMatrices(M, mw));
        });
        for (const [im] of parts) im.instanceMatrix.needsUpdate = true;
      });
    })));
  }
  // the start gantry: a beam over the halfway line, high under the roof, with five pairs of red lamps that come on one
  // by one through the kickoff countdown and all go out at GO (like a real grand prix start)
  function startLights(o) {
    const { root, H, A } = o;
    const P = [];
    P.push(part(new THREE.BoxGeometry(A.hw * 0.75, 2.2, 1.2), '#1c1f24', M4(0, 0, 0)));
    for (const sx of [-1, 1]) P.push(part(new THREE.BoxGeometry(0.25, 12, 0.25), '#2b2f36', M4(sx * A.hw * 0.3, 7, 0)));
    for (let i = 0; i < 5; i++) P.push(part(new THREE.BoxGeometry(2.2, 3.6, 1.4), '#111316', M4((i - 2) * 3.2, -2.2, 0)));
    const beam = add(root, H, merge(P), mat({ vertexColors: true, metalness: 0.4, roughness: 0.5 }, o.low));
    beam.position.set(0, 27, 0);
    const lg = new THREE.CircleGeometry(0.62, 16), lm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false });
    const list = [];
    for (let i = 0; i < 5; i++) for (const y of [-1.4, -3.0]) for (const sz of [-0.72, 0.72]) list.push(M4((i - 2) * 3.2, 27 + y, sz, 0, sz < 0 ? Math.PI : 0, 0));
    const lamps = inst(root, H, lg, lm, list);
    const on = new THREE.Color('#ff1a1a').multiplyScalar(2.2), off = new THREE.Color('#2a0606'), c = new THREE.Color();
    for (let i = 0; i < list.length; i++) lamps.setColorAt(i, off);
    let shown = 0;
    H.anim.push(() => {
      const g = BL.game;
      // (how many are lit: one more every 0.6 s through the 3 s count, none at GO and in play)
      const n = g && g.phase === 'countdown' && g.phaseT <= 3.05 ? Math.min(5, Math.floor((3.05 - g.phaseT) / 0.6) + 1) : 0;
      if (n === shown) return;
      shown = n;
      for (let i = 0; i < list.length; i++) lamps.setColorAt(i, c.copy(Math.floor(i / 4) < n ? on : off));
      lamps.instanceColor.needsUpdate = true;
    });
  }
  // a blimp going slowly round high over the stadium, GRAND PRIX down its side
  function blimp(o) {
    const { root, H, low } = o;
    const tex = canvasTex(512, 128, (g, W, Hh) => {
      g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#e53935'; g.fillRect(0, Hh * 0.7, W, Hh * 0.12);
      g.font = '900 44px "Russo One", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#16181c';
      g.fillText('GRAND PRIX', W * 0.25, Hh * 0.42); g.fillText('GRAND PRIX', W * 0.75, Hh * 0.42);
    });
    const body = new THREE.SphereGeometry(1, 32, 16); body.rotateY(Math.PI / 2); body.scale(9, 9, 30); // (the words on its sides)
    const bm = new THREE.Mesh(body, mat({ map: tex, roughness: 0.6 }, low));
    const fins = [];
    for (let k = 0; k < 4; k++) fins.push(part(new THREE.BoxGeometry(0.6, 9, 7), '#e53935', M4(0, 0, -26, 0, 0, k * Math.PI / 2 + Math.PI / 4)));
    fins.push(part(new THREE.BoxGeometry(3, 2.4, 7), '#2b2f36', M4(0, -9.6, 2)));
    const fm = new THREE.Mesh(merge(fins), mat({ vertexColors: true }, low));
    const grp = new THREE.Group(); grp.add(bm, fm); root.add(grp);
    H.live.push(grp); // (it moves: js/arena.js freezes the matrices of everything else in the stadium)
    H.disposables.push(body, bm.material, tex, fm.geometry, fm.material);
    let a = 0.8;
    H.anim.push((dt) => { a += dt * 0.035; grp.position.set(Math.cos(a) * 150, 92, Math.sin(a) * 150); grp.rotation.y = -a; });
  }
  function speedway(o) {
    const { A, K, tier } = o, R = o.RC + 34;
    circuit(o, R, 16);
    // (Very Low: no racing cars or floodlight towers, they're seen from the air only and cost a dozen draw calls)
    if (tier) racers(o, R);
    startLights(o);
    blimp(o);
    // chequered flags along the roof edge
    if (tier) {
      const n = [0, 12, 20, 28][tier], spots = [];
      for (let i = 0; i < n; i++) { const t = i / n, a = t * Math.PI * 2, x = Math.cos(a) * (A.hw + K.ST.d1 + 2), z = Math.sin(a) * (A.hl + K.ST.d1 + 2); spots.push({ x, z, yaw: -a + Math.PI / 2 }); }
      flags(o, spots.map((s) => Object.assign(s, { y: K.ROOF.y + 1 })), ['#ffffff'], true);
    }
    if (tier) floodTowers(o, [{ x: R * 0.7, z: R * 0.7 }, { x: -R * 0.7, z: R * 0.7 }, { x: R * 0.7, z: -R * 0.7 }, { x: -R * 0.7, z: -R * 0.7 }], 58);
  }

  // ---------- Champions Field: a stadium on match day ----------
  function champions(o) {
    const { RC } = o, R = RC;
    road(o, R, R + 12);
    // car parks either side, and a smaller one behind each end (outside the road)
    let spots = [];
    spots = spots.concat(carPark(o, -(R + 46), 0, 120, 60, Math.PI / 2, 0.8) || []);
    spots = spots.concat(carPark(o, R + 46, 0, 120, 60, -Math.PI / 2, 0.8) || []);
    if (o.tier >= 2) { spots = spots.concat(carPark(o, 0, R + 40, 100, 40, 0, 0.7) || []); spots = spots.concat(carPark(o, 0, -(R + 40), 100, 40, Math.PI, 0.7) || []); }
    parkCars(o, spots);
    // floodlights at the four corners, and team flags along the road
    const c = R - 6;
    floodTowers(o, [{ x: c * 0.72, z: c * 0.72 }, { x: -c * 0.72, z: c * 0.72 }, { x: c * 0.72, z: -c * 0.72 }, { x: -c * 0.72, z: -c * 0.72 }], 62);
    flags(o, ringSpots([0, 18, 28, 40][o.tier], R + 15, 0.1), [BL.TEAM_MAIN[0], BL.TEAM_MAIN[1], '#ffffff', '#ffd23f']);
  }

  // ---------- Sunset Park: a lake and a Ferris wheel ----------
  function sunset(o) {
    const { root, H, tier, low, RC } = o, R = RC;
    // the lake: warm sky mirrored in still water
    const lx = -(R + 80), lz = R * 0.45;
    const lg = new THREE.CircleGeometry(62, 48); lg.rotateX(-Math.PI / 2);
    const lm = low ? new THREE.MeshLambertMaterial({ color: 0x5d6fa8, emissive: 0x3a2a4a }) : new THREE.MeshStandardMaterial({ color: '#4a5d96', roughness: 0.08, metalness: 0.9, envMap: BL.Models && BL.Models.envMap || null, emissive: '#2a1c33' });
    const lake = add(root, H, lg, lm); lake.position.set(lx, -0.5, lz); lake.scale.set(1.5, 1, 1);
    // its shore
    const sg = new THREE.RingGeometry(62, 68, 48); sg.rotateX(-Math.PI / 2);
    const shore = add(root, H, sg, mat({ color: 0xc9b38a }, low)); shore.position.set(lx, -0.52, lz); shore.scale.set(1.5, 1, 1);
    // the Ferris wheel on the shore
    const wx = lx + 68, wz = lz + 60, WR = 34, hub = WR + 6;
    const frame = [];
    for (const side of [-1.6, 1.6]) {
      frame.push(part(new THREE.TorusGeometry(WR, 0.45, 6, tier ? 72 : 36), '#f2f2f2', M4(0, 0, side)));
      frame.push(part(new THREE.TorusGeometry(WR * 0.35, 0.3, 6, 24), '#f2f2f2', M4(0, 0, side)));
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; frame.push(part(new THREE.BoxGeometry(0.25, WR, 0.25), '#e0e0e0', M4(Math.cos(a) * WR / 2, Math.sin(a) * WR / 2, side, 0, 0, a - Math.PI / 2))); }
    }
    frame.push(part(new THREE.CylinderGeometry(1.4, 1.4, 4.4, 12), '#c62828', M4(0, 0, 0, Math.PI / 2, 0, 0)));
    const wheel = add(root, H, merge(frame), mat({ vertexColors: true, metalness: 0.4, roughness: 0.45 }, low), tier >= 3);
    wheel.position.set(wx, hub, wz); wheel.rotation.y = Math.atan2(-wx, -wz) + Math.PI / 2;
    H.live.push(wheel); // (it turns)
    const legs = [];
    for (const side of [-1, 1]) for (const lean of [-1, 1]) legs.push(part(new THREE.BoxGeometry(1.1, hub + 2, 1.1), '#d0d0d0', M4(lean * hub * 0.28, hub / 2 - 1, side * 3.2, 0, 0, lean * 0.3)));
    const legM = add(root, H, merge(legs), mat({ vertexColors: true }, low)); legM.position.set(wx, -0.6, wz); legM.rotation.y = wheel.rotation.y;
    // the gondolas: they turn with the wheel and hang level
    const ng = 16, gg = new THREE.BoxGeometry(2.6, 2.4, 2.4); gg.translate(0, -1.6, 0);
    const gm = mat({ color: 0xffffff }, low), gond = new THREE.InstancedMesh(gg, gm, ng);
    const gcols = ['#e53935', '#ffd23f', '#2f7bff', '#39d353', '#ff8a1f', '#b06bff'], gc = new THREE.Color();
    for (let i = 0; i < ng; i++) gond.setColorAt(i, gc.set(gcols[i % gcols.length]));
    gond.frustumCulled = false; root.add(gond); H.disposables.push(gg, gm);
    // lights round the rim (lit at dusk)
    let bulbs = null;
    if (tier) {
      const bg = new THREE.SphereGeometry(0.45, 6, 4), bm = new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false });
      const nb = 64, list = [];
      for (let i = 0; i < nb; i++) { const a = (i / nb) * Math.PI * 2; list.push(M4(Math.cos(a) * (WR + 0.6), Math.sin(a) * (WR + 0.6), 1.8)); }
      bulbs = inst(root, H, bg, bm, list);
      bulbs.position.copy(wheel.position); bulbs.rotation.copy(wheel.rotation);
      H.live.push(bulbs);
    }
    const m4 = new THREE.Matrix4(), pv = new V3(), q = new THREE.Quaternion(), one = new V3(1, 1, 1), yq = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), wheel.rotation.y);
    let ang = 0;
    H.anim.push((dt) => {
      ang += dt * 0.06;
      wheel.rotation.z = ang; if (bulbs) bulbs.rotation.z = ang;
      for (let i = 0; i < ng; i++) {
        const a = ang + (i / ng) * Math.PI * 2;
        pv.set(Math.cos(a) * WR, Math.sin(a) * WR, 0).applyQuaternion(yq).add(wheel.position);
        gond.setMatrixAt(i, m4.compose(pv, q.copy(yq), one));
      }
      gond.instanceMatrix.needsUpdate = true;
    });
    // park lamps along paths round the stadium (their globes glow)
    const nl = [16, 40, 60, 70][tier], lamps = [];
    for (let i = 0; i < nl; i++) { const a = (i / nl) * Math.PI * 2, r = R + 1 + (i % 2) * 11; lamps.push({ x: Math.cos(a) * r, z: Math.sin(a) * r }); }
    const pg = new THREE.CylinderGeometry(0.12, 0.18, 5, 5); pg.translate(0, 2.5, 0);
    inst(root, H, pg, mat({ color: 0x2b2b2b }, low), lamps.map((p) => M4(p.x, -0.6, p.z)));
    const glg = new THREE.SphereGeometry(0.42, 8, 6);
    inst(root, H, glg, new THREE.MeshBasicMaterial({ color: 0xffd49a }), lamps.map((p) => M4(p.x, 4.6, p.z)));
    // and a path ring for them
    road(o, R + 3, R + 10, '#8a7a66');
  }

  // ---------- Sandstorm Dunes: dunes, pyramids, an oasis, dust devils ----------
  function dunes(o) {
    const { root, H, A, K, tier, low, rnd } = o, R = Math.max(A.hw, A.hl) + K.ST.d1, RC = o.RC;
    // rolling dunes: a wide ring of sand pushed into long wavy ridges
    const seg = tier ? 140 : 60, rs = tier ? 24 : 10;
    const dg = new THREE.RingGeometry(R + 8, 760, seg, rs);
    const p = dg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y), a = Math.atan2(y, x);
      const ramp = U.clamp((r - R - 8) / 60, 0, 1);
      const h = (Math.sin(a * 9 + r * 0.022) * 0.5 + 0.5) * 22 + (Math.sin(a * 23 - r * 0.05) * 0.5 + 0.5) * 9 + Math.sin(r * 0.04 + a * 3) * 6;
      p.setZ(i, h * ramp);
    }
    dg.computeVertexNormals();
    const rip = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#d8a964'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,80,30,0.16)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 9) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.07 + y) * 3); g.stroke(); }
      for (let i = 0; i < 2000; i++) { g.fillStyle = 'rgba(255,240,210,' + (Math.random() * 0.15) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    });
    rip.wrapS = rip.wrapT = THREE.RepeatWrapping; rip.repeat.set(60, 60);
    const dm = add(root, H, dg, mat({ map: rip, color: 0xffffff, roughness: 0.95 }, low)); H.disposables.push(rip);
    dm.rotation.x = -Math.PI / 2; dm.position.y = -0.6; dm.receiveShadow = true;
    // three great pyramids in the haze
    const pyr = [];
    [[-260, 300, 130], [-90, 380, 100], [120, 430, 80]].forEach(([x, z, s]) => {
      pyr.push(part(new THREE.ConeGeometry(s * 0.78, s, 4, 1), '#c9995a', M4(x, s / 2 - 2, z, 0, Math.PI / 4 + 0.3, 0)));
      pyr.push(part(new THREE.ConeGeometry(s * 0.12, s * 0.16, 4, 1), '#f1d08a', M4(x, s * 0.92 - 2, z, 0, Math.PI / 4 + 0.3, 0)));
    });
    add(root, H, merge(pyr), mat({ vertexColors: true, roughness: 0.95 }, low));
    // the oasis: a pool, palm trees round it
    const ox = RC + 30, oz = -RC * 0.35;
    const pool = new THREE.CircleGeometry(26, 32); pool.rotateX(-Math.PI / 2);
    const pm = low ? new THREE.MeshLambertMaterial({ color: 0x2aa6a6, emissive: 0x0a3a3a }) : new THREE.MeshStandardMaterial({ color: '#1f9aa6', roughness: 0.1, metalness: 0.6, envMap: BL.Models && BL.Models.envMap || null });
    const pl = add(root, H, pool, pm); pl.position.set(ox, -0.4, oz); pl.scale.set(1.4, 1, 1);
    const grass = new THREE.RingGeometry(26, 36, 32); grass.rotateX(-Math.PI / 2);
    const gm = add(root, H, grass, mat({ color: 0x6f9a3a }, low)); gm.position.set(ox, -0.45, oz); gm.scale.set(1.4, 1, 1);
    palms(o, Array.from({ length: [5, 9, 12, 14][tier] }, (_, i) => { const a = (i / 12) * Math.PI * 2 + rnd() * 0.3, r = 30 + rnd() * 6; return { x: ox + Math.cos(a) * r * 1.4, z: oz + Math.sin(a) * r, h: 12 + rnd() * 6, a: rnd() * 6.3 }; }));
    // dust devils: twisting columns of sand wandering round outside
    if (tier && BL.FX && BL.FX.atlas) dustDevils(o, R, [0, 2, 3, 4][tier]);
  }
  function palms(o, list) {
    const { root, H, low } = o, P = [];
    // one palm (unit height 1 = 14 m): a curving trunk of segments, a crown of drooping fronds
    const segs = 7;
    for (let k = 0; k < segs; k++) { const t = k / segs; P.push(part(new THREE.CylinderGeometry(0.38 - t * 0.12, 0.42 - t * 0.12, 2.1, 6), k % 2 ? '#8a6a44' : '#7a5c3a', M4(Math.sin(t * 1.6) * 1.6, 1 + k * 1.9, 0, 0, 0, -0.18 - t * 0.12))); }
    const top = new V3(Math.sin(1.6) * 1.6, 14, 0);
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * Math.PI * 2;
      for (let s = 0; s < 3; s++) {
        const d = 1.6 + s * 1.7, droop = s * s * 0.45;
        P.push(part(new THREE.BoxGeometry(1.9, 0.12, 0.9 - s * 0.18), f % 2 ? '#3f8a2e' : '#4f9e36', M4(top.x + Math.cos(a) * d, top.y - droop, top.z + Math.sin(a) * d, 0, -a, -0.25 - s * 0.35)));
      }
    }
    for (let c = 0; c < 3; c++) P.push(part(new THREE.SphereGeometry(0.4, 6, 4), '#5a3a1a', M4(top.x + Math.cos(c * 2.1) * 0.4, top.y - 0.6, Math.sin(c * 2.1) * 0.4)));
    const geo = merge(P);
    inst(root, H, geo, mat({ vertexColors: true, side: THREE.DoubleSide }, low), list.map((p) => M4(p.x, -0.6, p.z, 0, p.a, 0, p.h / 14)));
  }
  const DUST_V = `attribute vec4 aP; uniform float uT; uniform float uScale; varying float vA;
    void main() {
      float s = aP.w, h = aP.y, r = aP.x * (0.35 + h / 30.0);
      float a = aP.z + uT * (2.2 + s) - h * 0.15;
      vec3 p = vec3(cos(a) * r, h, sin(a) * r);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vA = 0.5 * (1.0 - h / 34.0);
      gl_PointSize = clamp((2.5 + 4.0 * s) * uScale / max(0.1, -mv.z), 0.0, 90.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const DUST_F = `uniform sampler2D atlas; uniform float uTile; varying float vA;
    void main() { vec2 pc = gl_PointCoord; float col = mod(uTile, 4.0), row = floor(uTile / 4.0); vec4 t = texture2D(atlas, vec2((col + pc.x) / 4.0, 1.0 - (row + pc.y) / 12.0)); float a = t.a * max(dot(t.rgb, vec3(0.3, 0.59, 0.11)), 0.35) * vA; if (a < 0.02) discard; gl_FragColor = linearToOutputTexel(vec4(0.86, 0.7, 0.48, a)); }`;
  function dustDevils(o, R, n) {
    const { root, H, rnd } = o, FX = BL.FX, per = 260;
    const arr = new Float32Array(per * 4);
    for (let i = 0; i < per; i++) { arr[i * 4] = 1.5 + rnd() * 5; arr[i * 4 + 1] = Math.pow(rnd(), 0.8) * 34; arr[i * 4 + 2] = rnd() * 6.3; arr[i * 4 + 3] = rnd(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('aP', new THREE.BufferAttribute(arr, 4)); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(per * 3), 3));
    const m = new THREE.ShaderMaterial({ uniforms: { uT: FX.clock, uScale: { value: FX.add ? FX.add.mat.uniforms.scale.value : 500 }, atlas: { value: FX.atlas }, uTile: { value: FX.S.smoke - 5 } }, vertexShader: DUST_V, fragmentShader: DUST_F, transparent: true, depthWrite: false });
    H.disposables.push(g, m);
    const D = [];
    for (let k = 0; k < n; k++) { const pts = new THREE.Points(g, m); pts.frustumCulled = false; root.add(pts); H.live.push(pts); D.push({ pts, a: rnd() * 6.3, r: R + 40 + rnd() * 90, w: (0.03 + rnd() * 0.03) * (rnd() < 0.5 ? -1 : 1) }); }
    H.anim.push((dt) => { for (const d of D) { d.a += d.w * dt; d.pts.position.set(Math.cos(d.a) * d.r, -0.5, Math.sin(d.a) * d.r); } if (FX.add) m.uniforms.uScale.value = FX.add.mat.uniforms.scale.value; });
  }

  // ---------- Magma Core: a crater, a lava lake, lava falls ----------
  function lavaTex(S) {
    // glowing lava under drifting black crust (a soft noise of plates)
    return canvasTex(S, S, (g, w, h) => {
      const img = g.createImageData(w, h), d = img.data, rnd = U.rng(31), N = 6, cell = w / N, pts = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + rnd()) * cell, (j + rnd()) * cell]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ci = Math.floor(x / cell), cj = Math.floor(y / cell); let f1 = 1e9, f2 = 1e9;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = (ci + di + N) % N, jj = (cj + dj + N) % N, p = pts[jj * N + ii]; const dx = x - (p[0] + (ci + di - ii) * cell), dy = y - (p[1] + (cj + dj - jj) * cell), dd = dx * dx + dy * dy; if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd; }
        const e = Math.sqrt(f2) - Math.sqrt(f1), hot = Math.exp(-e / (w / 30)), o2 = (y * w + x) * 4;
        d[o2] = 90 + 165 * hot; d[o2 + 1] = 20 + 160 * hot * hot; d[o2 + 2] = 5 + 60 * hot * hot * hot; d[o2 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  function magma(o) {
    const { root, H, A, K, tier, low, rnd } = o, R = Math.max(A.hw, A.hl) + K.ST.d1;
    // the lava lake round the stadium's foot, its crust drifting and glowing
    const S = tier >= 2 ? 256 : 128, lt = lavaTex(S); lt.wrapS = lt.wrapT = THREE.RepeatWrapping; lt.repeat.set(10, 10);
    const lg = new THREE.RingGeometry(R + 4, R + 120, tier ? 96 : 48, 1); lg.rotateX(-Math.PI / 2);
    const lm = new THREE.MeshBasicMaterial({ map: lt, color: 0xffffff, fog: true });
    const lake = add(root, H, lg, lm); lake.position.y = -0.5; H.disposables.push(lt);
    H.anim.push((dt) => { lt.offset.x += dt * 0.004; lt.offset.y += dt * 0.0025; lm.color.setScalar(0.85 + 0.15 * Math.sin(performance.now() / 700)); });
    // the crater wall: a ring of jagged dark rock rising all round, glowing red low down from the lava
    const cr = R + 120, seg = tier ? 96 : 40, rings = tier ? 8 : 4;
    const wg = new THREE.CylinderGeometry(cr + 170, cr, 190, seg, rings, true);
    const wp = wg.attributes.position, cols = new Float32Array(wp.count * 3);
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i), y = wp.getY(i), z = wp.getZ(i), a = Math.atan2(z, x), t = (y + 95) / 190;
      const j = 1 + 0.09 * Math.sin(a * 13 + t * 5) + 0.06 * Math.sin(a * 29 - t * 9) + (rnd() - 0.5) * 0.05;
      wp.setX(i, x * j); wp.setZ(i, z * j); wp.setY(i, y + (t > 0.95 ? Math.sin(a * 7) * 25 : 0));
      const glow = Math.pow(1 - t, 4);
      cols[i * 3] = 0.13 + 0.8 * glow; cols[i * 3 + 1] = 0.08 + 0.18 * glow; cols[i * 3 + 2] = 0.07 + 0.03 * glow;
    }
    wg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    wg.computeVertexNormals();
    const wall = add(root, H, wg, mat({ vertexColors: true, side: THREE.BackSide, roughness: 0.95, flatShading: true }, low));
    wall.position.y = 95 - 2;
    // lava falls pouring down the crater wall into the lake
    if (tier) {
      const fallT = lavaTex(128); fallT.wrapS = fallT.wrapT = THREE.RepeatWrapping; fallT.repeat.set(1, 4);
      const nf = [0, 4, 6, 8][tier], fg = new THREE.PlaneGeometry(1, 1, 1, 8); fg.translate(0, 0.5, 0);
      const fm = new THREE.MeshBasicMaterial({ map: fallT, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
      const list = [];
      // (each leans back with the wall's slope: 170 m out over 190 m up)
      const lean = -Math.atan2(170, 190), e = new THREE.Euler(), qq = new THREE.Quaternion();
      for (let i = 0; i < nf; i++) {
        const a = (i / nf) * Math.PI * 2 + 0.4, r = cr + 2;
        e.set(lean, Math.atan2(-Math.cos(a), -Math.sin(a)), 0, 'YXZ'); qq.setFromEuler(e);
        list.push(new THREE.Matrix4().compose(new V3(Math.cos(a) * r, -1, Math.sin(a) * r), qq, new V3(14 + rnd() * 10, 245, 1)));
      }
      inst(root, H, fg, fm, list);
      H.disposables.push(fallT);
      H.anim.push((dt) => { fallT.offset.y -= dt * 0.35; });
      // the splash where each fall meets the lake
      if (BL.FX && BL.FX.spriteMat && BL.FX.atlas) {
        const sm = BL.FX.spriteMat(BL.FX.S.light, '#ff7a1a', {}); sm.uniforms.opacity.value = 0.9;
        for (let i = 0; i < nf; i++) { const a = (i / nf) * Math.PI * 2 + 0.4, r = cr - 6, s = new THREE.Mesh(BL.FX.spriteGeo, sm); s.position.set(Math.cos(a) * r, 6, Math.sin(a) * r); s.scale.setScalar(60); s.frustumCulled = false; root.add(s); }
        H.disposables.push(sm);
      }
    }
  }

  // ---------- Neon Nights: holograms, flying traffic, a neon ring ----------
  function neon(o) {
    const { root, H, A, K, tier, rnd } = o, R = o.RC;
    // the streets: dark wet tarmac with glowing lane lines in a grid
    const st = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#07070c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1200; i++) { g.fillStyle = 'rgba(120,140,255,' + (Math.random() * 0.06) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.shadowBlur = 6;
      for (const [col, x] of [['#ff2bd6', 0.25], ['#00e5ff', 0.75]]) { g.strokeStyle = col; g.shadowColor = col; g.lineWidth = 3; g.beginPath(); g.moveTo(x * w, 0); g.lineTo(x * w, h); g.stroke(); g.beginPath(); g.moveTo(0, x * h); g.lineTo(w, x * h); g.stroke(); }
    });
    st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(24, 24);
    const sg = new THREE.CircleGeometry(700, 48); sg.rotateX(-Math.PI / 2);
    const street = add(root, H, sg, new THREE.MeshBasicMaterial({ map: st, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    street.position.y = -0.58; H.disposables.push(st);
    // holographic billboards on poles round the stadium: one shared animated texture (scrolling words and shapes)
    const W = 512, Hh = 256, { c, g } = U.canvas(W, Hh);
    const holo = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) holo.encoding = THREE.sRGBEncoding;
    const words = ['NEON NIGHTS', 'BOOST', 'SUPERSONIC', 'DEMO', 'GOAL!', 'NIGHT CITY', 'KICKOFF', 'OVERTIME'];
    let tAcc = 0, frame = 0;
    const paint = (t) => {
      g.fillStyle = 'rgba(6,0,20,1)'; g.fillRect(0, 0, W, Hh);
      for (let k = 0; k < 4; k++) {
        const x0 = (k % 2) * W / 2, y0 = Math.floor(k / 2) * Hh / 2, col = ['#ff2bd6', '#00e5ff', '#b388ff', '#ffe066'][(k + frame) % 4];
        g.save(); g.beginPath(); g.rect(x0, y0, W / 2, Hh / 2); g.clip();
        g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 12;
        g.strokeRect(x0 + 6, y0 + 6, W / 2 - 12, Hh / 2 - 12);
        g.font = '900 34px "Russo One", Arial'; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(words[(k + frame) % words.length], x0 + W / 4 + Math.sin(t * 2 + k) * 18, y0 + Hh / 4);
        for (let i = 0; i < 6; i++) { g.globalAlpha = 0.25; g.fillRect(x0, y0 + ((t * 40 + i * 22) % (Hh / 2)), W / 2, 2); }
        g.globalAlpha = 1; g.restore();
      }
      holo.needsUpdate = true;
    };
    paint(0);
    const nb = [4, 8, 12, 14][tier], bg = new THREE.PlaneGeometry(1, 1), list = [], uvs = [];
    const bm = new THREE.MeshBasicMaterial({ map: holo, transparent: true, opacity: 0.92, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (let i = 0; i < nb; i++) { const a = (i / nb) * Math.PI * 2 + rnd() * 0.3, r = R + 10 + rnd() * 70, w = 26 + rnd() * 18; list.push(M4(Math.cos(a) * r, 22 + rnd() * 40, Math.sin(a) * r, 0, -a - Math.PI / 2, 0, w, w * 0.5, 1)); }
    // (each board shows one quarter of the texture)
    const geoQ = [0, 1, 2, 3].map((k) => { const q = new THREE.PlaneGeometry(1, 1), uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + (k % 2)) / 2, (uv.getY(i) + 1 - Math.floor(k / 2)) / 2); return q; });
    geoQ.forEach((q, k) => { const L = list.filter((_, i) => i % 4 === k); if (L.length) inst(root, H, q, bm, L); });
    bg.dispose(); H.disposables.push(holo);
    H.anim.push((dt) => { tAcc += dt; if (tAcc > [0.6, 0.4, 0.2, 0.15][tier]) { if (Math.floor((performance.now() / 2500)) % 4 !== frame) frame = Math.floor(performance.now() / 2500) % 4; paint(performance.now() / 1000); tAcc = 0; } });
    // flying traffic: glowing cars on circular lanes at different heights, both ways
    const nc = [10, 30, 60, 90][tier], cg = new THREE.BoxGeometry(2.2, 0.8, 4.4), cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
    const cars = new THREE.InstancedMesh(cg, cm, nc), CL = [], cc = new THREE.Color();
    for (let i = 0; i < nc; i++) { const lane = i % 5; CL.push({ r: R + 20 + lane * 30, y: 40 + lane * 14, a: rnd() * 6.3, w: (0.05 + rnd() * 0.04) * (lane % 2 ? 1 : -1) }); cars.setColorAt(i, cc.set(['#ff2bd6', '#00e5ff', '#ffffff', '#ffe066', '#b388ff'][i % 5]).multiplyScalar(1.6)); }
    cars.frustumCulled = false; root.add(cars); H.disposables.push(cg, cm);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new V3(), one = new V3(1, 1, 1), up = new V3(0, 1, 0);
    H.anim.push((dt) => {
      for (let i = 0; i < nc; i++) { const L = CL[i]; L.a += L.w * dt; pv.set(Math.cos(L.a) * L.r, L.y, Math.sin(L.a) * L.r); q.setFromAxisAngle(up, -L.a + (L.w > 0 ? Math.PI : 0)); cars.setMatrixAt(i, m4.compose(pv, q, one)); }
      cars.instanceMatrix.needsUpdate = true;
    });
    // a giant neon ring standing over the far end, pulsing pink to cyan
    const rg = new THREE.TorusGeometry(70, 2.2, 10, tier ? 128 : 48);
    const rm = new THREE.ShaderMaterial({ uniforms: { uT: BL.FX ? BL.FX.clock : { value: 0 } }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform float uT; varying vec2 vU; void main(){ float k = 0.5 + 0.5 * sin(vU.x * 25.0 - uT * 3.0); vec3 c = mix(vec3(1.0, 0.17, 0.84), vec3(0.0, 0.9, 1.0), k); gl_FragColor = linearToOutputTexel(vec4(c * 1.6, 1.0)); }', fog: false });
    const ring = add(root, H, rg, rm); ring.position.set(0, 80, -(A.hl + K.ST.d1 + 70));
  }

  // ---------- Blossom Gardens: a Japanese garden ----------
  function blossom(o) {
    const { root, H, A, K, tier, low, rnd } = o, R = o.RC;
    const RED = '#c62828', DARK = '#2b1d1a', ROOF = '#3a3f4a', STONE = '#a9a39a';
    // the pagoda behind one end: five storeys, each with its flared roof
    const P = [];
    let y = 0;
    for (let k = 0; k < 5; k++) {
      const w = 22 - k * 3.2, h = 8 - k * 0.6;
      P.push(part(new THREE.BoxGeometry(w * 0.7, h, w * 0.7), k ? '#f3e6d0' : STONE, M4(0, y + h / 2, 0)));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(part(new THREE.BoxGeometry(0.9, h, 0.9), RED, M4(sx * w * 0.33, y + h / 2, sz * w * 0.33)));
      y += h;
      P.push(part(new THREE.ConeGeometry(w * 0.82, 4.2, 4, 1, true), ROOF, M4(0, y + 1.6, 0, 0, Math.PI / 4, 0)));
      P.push(part(new THREE.BoxGeometry(w * 1.1, 0.5, w * 1.1), DARK, M4(0, y, 0)));
      y += 2.6;
    }
    P.push(part(new THREE.CylinderGeometry(0.35, 0.5, 12, 6), '#d4a017', M4(0, y + 6, 0)));
    for (let k = 0; k < 5; k++) P.push(part(new THREE.TorusGeometry(1.2 - k * 0.12, 0.18, 4, 10), '#d4a017', M4(0, y + 2 + k * 1.8, 0, Math.PI / 2, 0, 0)));
    const pag = add(root, H, merge(P), mat({ vertexColors: true }, low), tier >= 3);
    pag.position.set(-30, -0.6, -(A.hl + K.ST.d1 + 66)); pag.rotation.y = 0.3; pag.scale.setScalar(1.7);
    // torii gates along a path at the other end
    const T = [];
    T.push(part(new THREE.CylinderGeometry(0.7, 0.8, 12, 8), RED, M4(-5.5, 6, 0)));
    T.push(part(new THREE.CylinderGeometry(0.7, 0.8, 12, 8), RED, M4(5.5, 6, 0)));
    T.push(part(new THREE.BoxGeometry(17, 1.1, 1.4), RED, M4(0, 10.2, 0)));
    T.push(part(new THREE.BoxGeometry(19, 1.3, 1.8), DARK, M4(0, 12.4, 0)));
    T.push(part(new THREE.BoxGeometry(1, 2, 0.9), RED, M4(0, 11.3, 0)));
    for (const sx of [-1, 1]) T.push(part(new THREE.CylinderGeometry(1.1, 1.1, 0.8, 8), DARK, M4(sx * 5.5, 0.3, 0)));
    const tg = merge(T), gates = [];
    for (let i = 0; i < [2, 4, 6, 7][tier]; i++) gates.push(M4(22, -0.6, A.hl + K.ST.d1 + 36 + i * 19, 0, 0, 0, 1.9 - i * 0.07));
    inst(root, H, tg, mat({ vertexColors: true }, low), gates);
    road(o, R, R + 8, '#8f846f');
    // stone lanterns along the gravel path
    const L = [];
    L.push(part(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 6), STONE, M4(0, 0.3, 0)));
    L.push(part(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 6), STONE, M4(0, 1.7, 0)));
    L.push(part(new THREE.BoxGeometry(1.5, 1.2, 1.5), STONE, M4(0, 3.3, 0)));
    L.push(part(new THREE.ConeGeometry(1.5, 1.2, 6), '#8f897f', M4(0, 4.5, 0)));
    const lgeo = merge(L), ln = [10, 24, 36, 44][tier], lamps = [];
    for (let i = 0; i < ln; i++) { const a = (i / ln) * Math.PI * 2, r = R + 11; lamps.push(M4(Math.cos(a) * r, -0.6, Math.sin(a) * r)); }
    inst(root, H, lgeo, mat({ vertexColors: true }, low), lamps);
    const lightG = new THREE.BoxGeometry(1.0, 0.7, 1.0);
    inst(root, H, lightG, new THREE.MeshBasicMaterial({ color: 0xffd89a }), lamps.map((m) => { const p = new V3().setFromMatrixPosition(m); return M4(p.x, 3.3 - 0.6, p.z); }));
    // the pond (js/arena.js draws it at -230, 150): an arched red bridge over it, koi swimming
    const B = [];
    const bs = 14;
    for (let k = 0; k < bs; k++) { const t = k / (bs - 1), a = (t - 0.5) * 2.2, x = (t - 0.5) * 34, yy = Math.cos(a * 0.7) * 5 - 1.2; B.push(part(new THREE.BoxGeometry(34 / bs + 0.3, 0.5, 5), '#8a4a2a', M4(x, yy, 0, 0, 0, -Math.sin(a) * 0.35))); for (const sz of [-2.4, 2.4]) B.push(part(new THREE.BoxGeometry(0.3, 1.6, 0.3), RED, M4(x, yy + 0.9, sz))); }
    for (const sz of [-2.4, 2.4]) B.push(part(new THREE.BoxGeometry(34, 0.25, 0.3), RED, M4(0, 4.7, sz)));
    const br = add(root, H, merge(B), mat({ vertexColors: true }, low)); br.position.set(-230, -0.3, 150); br.rotation.y = 0.5;
    if (tier) {
      const nk = [0, 10, 18, 24][tier], kg = new THREE.ConeGeometry(0.7, 2.6, 6); kg.rotateX(Math.PI / 2);
      const km = new THREE.MeshLambertMaterial({ color: 0xffffff }), koi = new THREE.InstancedMesh(kg, km, nk), KL = [], kc = new THREE.Color();
      for (let i = 0; i < nk; i++) { KL.push({ r: 12 + rnd() * 36, a: rnd() * 6.3, w: (0.12 + rnd() * 0.15) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.3 }); koi.setColorAt(i, kc.set(['#ff7a1a', '#ffffff', '#ffb347', '#e53935', '#fff3e0'][i % 5])); }
      koi.frustumCulled = false; root.add(koi); H.disposables.push(kg, km);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new V3(), one = new V3(1, 1, 1), up = new V3(0, 1, 0);
      H.anim.push((dt) => {
        for (let i = 0; i < nk; i++) { const k = KL[i]; k.a += k.w * dt; const rr = k.r + Math.sin(k.a * 3 + k.ph) * 3; pv.set(-230 + Math.cos(k.a) * rr, -0.35, 150 + Math.sin(k.a) * rr * 0.9); q.setFromAxisAngle(up, -k.a + (k.w > 0 ? 0 : Math.PI) + Math.sin(k.a * 8) * 0.2); koi.setMatrixAt(i, m4.compose(pv, q, one)); }
        koi.instanceMatrix.needsUpdate = true;
      });
    }
  }
})(window.BL);
