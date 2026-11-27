'use strict';
// Rocket League (fan remake) - better toppers and antennas (2026-11-21: "make the toppers and antennas better too").
// Real modelling instead of a few primitives: lathed profiles (hats, crowns, cones, the rocket), curved tapering
// tubes (horns, antlers), bevelled shapes, canvas textures (knit, stars, stitching, a real ball pattern), bands,
// buckles, rivets and jewels. Pieces that share a material are merged into one mesh, so a topper is a draw call or
// three; Low and Very Low get fewer segments. Same shapes and item names: whoever owns one gets the new model.
// Shapes not listed here (saturn, disco, orbit, halo) keep the builder in js/carmodels.js.
(function (BL) {
  const M = BL.Models, U = BL.util, V3 = THREE.Vector3, V2 = THREE.Vector2;
  if (!M || !M.buildTopper) return;
  const low = () => !!(BL.App && BL.App.quality === 'low');
  const seg = (hi, lo) => (low() ? lo : hi);
  const C = (c) => new THREE.Color(c);
  function std(color, o) {
    o = o || {};
    if (low()) return new THREE.MeshPhongMaterial({ color: C(color), map: o.map || null, emissive: o.emissive || C('#000000'), flatShading: !!o.flatShading, side: o.side || THREE.FrontSide,
      shininess: o.roughness != null ? (1 - o.roughness) * 80 + 6 : 40, specular: (o.metalness || 0) > 0.5 ? 0x9a9a9a : 0x2a2a2a });
    return new THREE.MeshStandardMaterial(Object.assign({ color: C(color), roughness: 0.5, metalness: 0.1, envMap: M.envMap, envMapIntensity: 0.9 }, o));
  }
  const glow = (c) => new THREE.MeshBasicMaterial({ color: C(c) });
  const tex = (W, H, draw) => { const { c, g } = U.canvas(W, H); draw(g, W, H); const t = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const lathe = (pts, n) => new THREE.LatheGeometry(pts.map(([x, y]) => new V2(Math.max(0.0005, x), y)), n);
  // a tube along a curve that tapers from r0 to r1 (horns, antlers, the wizard's bent hat)
  function taper(pts, r0, r1, n, rad, flat) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(p[0], p[1], p[2])));
    const fr = curve.computeFrenetFrames(n, false), pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = r0 + (r1 - r0) * Math.pow(t, flat || 1);
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z)); uv.push(j / rad, t);
      }
    }
    // (wound so the faces point outward: with the curve's frames, going round the ring runs the other way)
    for (let i = 0; i < n; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // parts: [geo, material, [x,y,z], [rx,ry,rz], [sx,sy,sz]] - merged into one mesh per material
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3();
  function assemble(group, parts) {
    const by = new Map();
    for (const [geo0, mat, p, r, s] of parts) {
      let geo = geo0.index ? geo0.toNonIndexed() : geo0.clone();
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _q.setFromEuler(_e); _p.set(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0); _s.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1);
      geo.applyMatrix4(_m.compose(_p, _q, _s));
      if (!by.has(mat)) by.set(mat, []);
      by.get(mat).push(geo);
      if (geo0 !== geo) geo0.dispose && geo0.dispose();
    }
    for (const [mat, geos] of by) {
      const g = geos.length > 1 ? THREE.BufferGeometryUtils.mergeBufferGeometries(geos) : geos[0];
      group.add(new THREE.Mesh(g, mat));
      if (geos.length > 1) geos.forEach((x) => x.dispose());
    }
    return group;
  }
  // a horn: curves out and up, tapering to a point, with growth rings
  const horn = (sx, len, out, up, back, r0) => taper([[0, 0, 0], [sx * out * 0.45, len * 0.45, back * 0.3], [sx * out, len * 0.8, back * 0.8], [sx * out * 0.8, len * up, back]], r0, r0 * 0.06, seg(18, 8), seg(12, 6), 1.1);

  // ---------- the toppers ----------
  const T = {};
  T.cone = (col) => {
    const body = std(col, { roughness: 0.45 }), band = std('#f4f6f8', { roughness: 0.25, metalness: 0.15 });
    // the cone in sections along one profile, so the reflective bands sit flush on it
    const r = (y) => 0.092 - (y - 0.03) * 0.33, piece = (y0, y1, m) => [lathe([[r(y0), y0], [r(y1), y1]], seg(24, 10)), m];
    return [
      piece(0.03, 0.082, body), piece(0.082, 0.112, band), piece(0.112, 0.165, body), piece(0.165, 0.19, band), piece(0.19, 0.285, body),
      [lathe([[r(0.285), 0.285], [0.006, 0.3], [0, 0.302]], seg(24, 10)), body],
      [new THREE.BoxGeometry(0.22, 0.03, 0.22, 1, 1, 1), body, [0, 0.015, 0]],
      [new THREE.CylinderGeometry(0.095, 0.095, 0.006, seg(24, 10)), std('#1c1c1c', { roughness: 0.9 }), [0, 0.031, 0]],
    ];
  };
  T.tophat = (col) => {
    const felt = std(col, { roughness: 0.38, metalness: col === '#ffc400' ? 0.85 : 0.05 }), band = std('#b71c1c', { roughness: 0.3 }), gold = std('#ffd54f', { metalness: 1, roughness: 0.25 });
    return [
      // brim curled up at the sides, crown flaring slightly to the top
      [lathe([[0, 0.002], [0.1, 0.0], [0.15, 0.006], [0.172, 0.022], [0.176, 0.03], [0.165, 0.026], [0.14, 0.012], [0.1, 0.012]], seg(32, 12)), felt, null, null, [1, 1, 0.86]],
      [lathe([[0.096, 0.012], [0.094, 0.1], [0.1, 0.2], [0.104, 0.236], [0.098, 0.24], [0, 0.242]], seg(32, 12)), felt, null, null, [1, 1, 0.86]],
      [lathe([[0.0985, 0.016], [0.0985, 0.058], [0.0975, 0.058], [0.0975, 0.016]], seg(32, 12)), band, null, null, [1, 1, 0.86]],
      [new THREE.BoxGeometry(0.03, 0.03, 0.008), gold, [0, 0.037, 0.087]],
    ];
  };
  T.sharkfin = (col, def) => {
    const sh = new THREE.Shape(); sh.moveTo(-0.13, 0); sh.lineTo(0.11, 0); sh.bezierCurveTo(0.06, 0.04, 0.0, 0.12, -0.075, 0.27); sh.bezierCurveTo(-0.09, 0.2, -0.1, 0.1, -0.13, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: seg(4, 1), curveSegments: seg(16, 6) });
    geo.rotateY(-Math.PI / 2); geo.translate(0.009, 0, 0);
    // (Neon Fin glows all over)
    const neon = !!(def && def.id && /neonfin/.test(def.id));
    return [[geo, std(col, neon ? { roughness: 0.2, metalness: 0.1, emissive: C(col).multiplyScalar(0.6) } : { roughness: 0.28, metalness: 0.2 })]];
  };
  T.antlers = (col) => {
    const m = std(col, { roughness: 0.75 }), tip = std('#' + C(col).lerp(C('#ffffff'), 0.45).getHexString(), { roughness: 0.6 }), parts = [];
    for (const sx of [-1, 1]) {
      // the beam, then three tines off it
      parts.push([taper([[sx * 0.05, 0, 0], [sx * 0.08, 0.08, -0.01], [sx * 0.14, 0.17, -0.03], [sx * 0.17, 0.27, -0.02]], 0.017, 0.006, seg(16, 7), seg(9, 5)), m]);
      parts.push([taper([[sx * 0.075, 0.07, -0.008], [sx * 0.04, 0.13, 0.02], [sx * 0.03, 0.18, 0.04]], 0.009, 0.003, seg(10, 5), seg(7, 4)), m]);
      parts.push([taper([[sx * 0.125, 0.15, -0.026], [sx * 0.1, 0.22, 0.0], [sx * 0.095, 0.27, 0.02]], 0.008, 0.003, seg(10, 5), seg(7, 4)), m]);
      parts.push([taper([[sx * 0.155, 0.22, -0.026], [sx * 0.21, 0.26, -0.03], [sx * 0.24, 0.27, -0.02]], 0.007, 0.003, seg(10, 5), seg(7, 4)), m]);
      parts.push([new THREE.SphereGeometry(0.022, seg(12, 6), seg(8, 4)), tip, [sx * 0.05, 0.004, 0], null, [1, 0.6, 1]]);
    }
    return parts;
  };
  T.propeller = (col) => {
    const panels = tex(128, 32, (g, W, H) => { const cs = [col, '#ffeb3b', '#1e88e5', '#43a047']; for (let i = 0; i < 8; i++) { g.fillStyle = cs[i % 4]; g.fillRect((i * W) / 8, 0, W / 8 + 1, H); } g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 8; i++) g.fillRect((i * W) / 8 - 1, 0, 2, H); });
    const cap = std('#ffffff', { map: panels, roughness: 0.85 }), peak = std('#1565c0', { roughness: 0.8 }), hub = std('#eeeeee', { metalness: 0.8, roughness: 0.25 });
    return [
      [new THREE.SphereGeometry(0.12, seg(28, 12), seg(12, 6), 0, Math.PI * 2, 0, Math.PI / 2), cap, null, null, [1, 0.9, 1.04]],
      [new THREE.CylinderGeometry(0.105, 0.105, 0.01, seg(20, 10), 1, false, -Math.PI / 2, Math.PI), peak, [0, 0.008, 0.06], [0.12, 0, 0], [1, 1, 1.25]],
      [new THREE.CylinderGeometry(0.008, 0.01, 0.07, 8), hub, [0, 0.135, 0]],
      [new THREE.SphereGeometry(0.016, 10, 8), hub, [0, 0.175, 0]],
    ];
  };
  T.propellerBlades = () => {
    const blade = new THREE.Shape(); blade.moveTo(0, -0.012); blade.bezierCurveTo(0.06, -0.026, 0.12, -0.02, 0.13, 0); blade.bezierCurveTo(0.12, 0.02, 0.06, 0.026, 0, 0.012); blade.closePath();
    const g = new THREE.ExtrudeGeometry(blade, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: seg(10, 4) });
    g.rotateX(Math.PI / 2);
    const ms = ['#ffeb3b', '#e53935'].map((c) => std(c, { roughness: 0.4 }));
    return [[g, ms[0], null, [0.18, 0, 0]], [g, ms[1], null, [-0.18, Math.PI, 0]]];
  };
  T.viking = (col) => {
    const steel = std(col, { metalness: 0.85, roughness: 0.32 }), bronze = std('#b8863b', { metalness: 0.9, roughness: 0.35 }), bone = std('#efe6d2', { roughness: 0.55 }), parts = [];
    parts.push([new THREE.SphereGeometry(0.13, seg(28, 12), seg(14, 6), 0, Math.PI * 2, 0, Math.PI / 2), steel, null, null, [1, 0.95, 1.05]]);
    parts.push([new THREE.TorusGeometry(0.131, 0.012, seg(8, 4), seg(32, 14)), bronze, [0, 0.008, 0], [Math.PI / 2, 0, 0], [1, 1.05, 1]]);
    parts.push([new THREE.TorusGeometry(0.128, 0.009, seg(6, 4), seg(24, 10), Math.PI), bronze, [0, 0, 0], [0, 0, 0], [1, 0.97, 1]]);
    parts.push([new THREE.BoxGeometry(0.022, 0.09, 0.012), bronze, [0, 0.0, 0.135], [0.12, 0, 0]]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; parts.push([new THREE.SphereGeometry(0.007, 6, 4), bronze, [Math.cos(a) * 0.135, 0.012, Math.sin(a) * 0.141]]); }
    for (const sx of [-1, 1]) parts.push([horn(sx, 0.2, 0.12, 0.98, -0.02, 0.03), bone, [sx * 0.11, 0.06, 0]]);
    return parts;
  };
  T.devil = (col) => {
    const m = std(col, { roughness: col === '#1a1a1a' ? 0.25 : 0.4, metalness: col === '#ffd23f' ? 0.7 : 0.15 }), parts = [];
    // short and stout, curling out and back
    for (const sx of [-1, 1]) parts.push([horn(sx, 0.14, 0.06, 0.9, -0.05, 0.04), m, [sx * 0.07, 0, 0.02]]);
    return parts;
  };
  T.wizard = (col) => {
    const stars = tex(128, 128, (g, W, H) => { g.fillStyle = '#' + C(col).getHexString(); g.fillRect(0, 0, W, H); const rnd = U.rng(5); g.fillStyle = '#ffeb3b'; for (let i = 0; i < 22; i++) { const x = rnd() * W, y = rnd() * H, r = 2 + rnd() * 4; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); } g.fillStyle = '#fff59d'; g.beginPath(); g.arc(W * 0.3, H * 0.4, 9, 0, 7); g.fill(); g.fillStyle = '#' + C(col).getHexString(); g.beginPath(); g.arc(W * 0.33, H * 0.38, 8, 0, 7); g.fill(); });
    const felt = std('#ffffff', { map: stars, roughness: 0.85 }), plain = std(col, { roughness: 0.85 }), band = std('#ffd23f', { metalness: 0.7, roughness: 0.3 });
    return [
      // a wide, slightly floppy brim, then the crown, bent over at the top
      [lathe([[0, 0.004], [0.13, 0.002], [0.19, -0.008], [0.205, -0.004], [0.2, 0.006], [0.15, 0.012], [0.1, 0.014]], seg(32, 12)), plain],
      [taper([[0, 0.01, 0], [0, 0.12, -0.01], [0.0, 0.24, -0.04], [0.03, 0.33, -0.09], [0.08, 0.36, -0.13]], 0.1, 0.006, seg(24, 10), seg(20, 9), 0.9), felt],
      [new THREE.TorusGeometry(0.099, 0.012, seg(8, 4), seg(28, 12)), band, [0, 0.03, 0], [Math.PI / 2, 0, 0]],
    ];
  };
  T.crown = (col, def) => {
    const gold = std(col, { metalness: 0.95, roughness: 0.18 }), velvet = std('#8e1b2e', { roughness: 0.95 }), parts = [];
    const n = seg(48, 24), pos = [], idx = [], pts = 8;
    // the band with its points: the top edge rises to a point eight times round
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, k = Math.abs(Math.sin((i / n) * Math.PI * pts)), top = 0.075 + 0.07 * Math.pow(k, 3);
      for (const [r, y] of [[0.11, 0], [0.112, top], [0.104, top], [0.102, 0]]) pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j, b = a + 4; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const band = new THREE.BufferGeometry(); band.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); band.setIndex(idx); band.computeVertexNormals();
    const gm = std(col, { metalness: 0.95, roughness: 0.18, side: THREE.DoubleSide });
    parts.push([band, gm]);
    parts.push([new THREE.SphereGeometry(0.1, seg(20, 10), seg(10, 5), 0, Math.PI * 2, 0, Math.PI / 2), velvet, [0, 0.02, 0], null, [1, 0.75, 1]]);
    parts.push([new THREE.TorusGeometry(0.111, 0.01, seg(8, 4), seg(36, 14)), gold, [0, 0.004, 0], [Math.PI / 2, 0, 0]]);
    const jewel = new THREE.OctahedronGeometry(0.015, 0), gems = [glow('#e53935'), glow('#1e88e5'), glow('#43a047')];
    for (let i = 0; i < pts; i++) {
      const a = ((i + 0.5) / pts) * Math.PI * 2;
      parts.push([new THREE.SphereGeometry(0.011, 8, 6), gold, [Math.cos(a) * 0.105, 0.148, Math.sin(a) * 0.105]]);
      parts.push([jewel, gems[i % 3], [Math.cos(a + Math.PI / pts) * 0.112, 0.035, Math.sin(a + Math.PI / pts) * 0.112], [0, a, 0], [1, 1.3, 0.6]]);
    }
    parts.push([new THREE.SphereGeometry(0.016, 10, 8), gold, [0, 0.115, 0]]);
    parts.push([new THREE.BoxGeometry(0.008, 0.04, 0.008), gold, [0, 0.14, 0]], [new THREE.BoxGeometry(0.03, 0.008, 0.008), gold, [0, 0.146, 0]]);
    return parts;
  };
  T.firecrown = T.crown;
  T.cap = (col) => {
    const panels = tex(128, 32, (g, W, H) => { g.fillStyle = '#' + C(col).getHexString(); g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo((i * W) / 6, 0); g.lineTo((i * W) / 6, H); g.stroke(); g.setLineDash([2, 2]); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo((i * W) / 6 + 3, 0); g.lineTo((i * W) / 6 + 3, H); g.stroke(); g.setLineDash([]); g.strokeStyle = 'rgba(0,0,0,0.35)'; } g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '900 13px Arial'; g.textAlign = 'center'; g.fillText('RL', W * 0.75, H * 0.75); });
    const crown = std('#ffffff', { map: panels, roughness: 0.9 }), m = std(col, { roughness: 0.88 });
    // the peak: a curved slab bent down at its sides
    const pk = new THREE.CylinderGeometry(0.11, 0.11, 0.012, seg(22, 10), 1, false, -Math.PI / 2, Math.PI);
    const pp = pk.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i); pp.setY(i, pp.getY(i) - x * x * 1.6 - Math.max(0, z) * 0.12); } pk.computeVertexNormals();
    return [
      [new THREE.SphereGeometry(0.12, seg(26, 12), seg(12, 6), 0, Math.PI * 2, 0, Math.PI / 2), crown, null, [0, Math.PI / 2, 0], [1, 0.82, 1.05]],
      [pk, m, [0, 0.012, 0.075], [0.1, 0, 0], [1.05, 1, 1.2]],
      [new THREE.SphereGeometry(0.014, 10, 8), m, [0, 0.099, 0]],
    ];
  };
  T.beanie = (col) => {
    const knit = tex(128, 64, (g, W, H) => { g.fillStyle = '#' + C(col).getHexString(); g.fillRect(0, 0, W, H); for (let x = 0; x < W; x += 6) for (let y = 0; y < H; y += 6) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.ellipse(x + 3, y + 3, 2.2, 3, 0.4 * ((x / 6) % 2 ? 1 : -1), 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 5, y, 1, 6); } });
    const rib = tex(128, 16, (g, W, H) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,0.13)'; for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 2, H); });
    const pom = new THREE.IcosahedronGeometry(0.048, seg(2, 1)), pp = pom.attributes.position, rnd = U.rng(3);
    for (let i = 0; i < pp.count; i++) { const k = 1 + (rnd() - 0.5) * 0.25; pp.setXYZ(i, pp.getX(i) * k, pp.getY(i) * k, pp.getZ(i) * k); } pom.computeVertexNormals();
    return [
      [new THREE.SphereGeometry(0.12, seg(26, 12), seg(12, 6), 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', { map: knit, roughness: 1 }), [0, 0.02, 0], null, [1, 1.05, 1]],
      [lathe([[0.12, 0], [0.128, 0.005], [0.13, 0.04], [0.124, 0.045], [0.12, 0.045]], seg(26, 12)), std('#ffffff', { map: rib, roughness: 1 })],
      [pom, std('#f5f5f5', { roughness: 1 }), [0, 0.15, 0]],
    ];
  };
  T.astro = (col) => {
    const shell = std(col, { roughness: 0.28, metalness: 0.15 }), visor = std('#ffb300', { metalness: 1, roughness: 0.06 }), dark = std('#37474f', { metalness: 0.6, roughness: 0.4 });
    return [
      [new THREE.SphereGeometry(0.13, seg(28, 12), seg(18, 8)), shell, [0, 0.12, 0]],
      [new THREE.SphereGeometry(0.112, seg(24, 10), seg(12, 6), -Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.26, Math.PI * 0.42), visor, [0, 0.12, 0.028]],
      [new THREE.TorusGeometry(0.115, 0.01, 6, seg(24, 10), Math.PI * 0.8), dark, [0, 0.12, 0.03], [0, 0, Math.PI * 0.1]],
      [new THREE.CylinderGeometry(0.135, 0.13, 0.025, seg(28, 12)), dark, [0, 0.012, 0]],
      [new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10), dark, [0.13, 0.12, 0], [0, 0, Math.PI / 2]],
      [new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10), dark, [-0.13, 0.12, 0], [0, 0, Math.PI / 2]],
      [new THREE.CylinderGeometry(0.004, 0.005, 0.13, 6), dark, [0.07, 0.28, -0.04]],
      [new THREE.SphereGeometry(0.013, 8, 6), glow('#ff1744'), [0.07, 0.35, -0.04]],
    ];
  };
  T.partyhat = (col) => {
    const st = tex(64, 64, (g) => { g.fillStyle = '#' + C(col).getHexString(); g.fillRect(0, 0, 64, 64); g.fillStyle = '#ffeb3b'; for (let i = -64; i < 64; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 8, 64); g.lineTo(i + 40, 0); g.lineTo(i + 32, 0); g.fill(); } g.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((i * 23) % 64, (i * 37) % 64, 2.2, 0, 7); g.fill(); } });
    const ruff = new THREE.TorusGeometry(0.088, 0.014, seg(8, 4), seg(40, 16)), rp = ruff.attributes.position;
    for (let i = 0; i < rp.count; i++) { const a = Math.atan2(rp.getY(i), rp.getX(i)); const k = 1 + 0.18 * Math.sin(a * 14); rp.setZ(i, rp.getZ(i) * (1 + 0.5 * Math.sin(a * 14))); rp.setX(i, rp.getX(i) * (0.98 + 0.02 * k)); } ruff.computeVertexNormals();
    const pom = new THREE.IcosahedronGeometry(0.034, seg(2, 1));
    return [
      [lathe([[0.09, 0.012], [0.06, 0.1], [0.03, 0.19], [0.006, 0.262], [0, 0.265]], seg(24, 10)), std('#ffffff', { map: st, roughness: 0.6 })],
      [ruff, std('#ffeb3b', { roughness: 0.8 }), [0, 0.012, 0], [Math.PI / 2, 0, 0]],
      [pom, std('#ffffff', { roughness: 1 }), [0, 0.278, 0]],
    ];
  };
  T.chef = (col) => {
    // a pleated toque: a lathed puff with folds round it, on a band
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([0.1 + 0.035 * Math.sin(t * Math.PI) - (t > 0.8 ? (t - 0.8) * 0.5 : 0), 0.06 + t * 0.16]); }
    pts.push([0.0, 0.225]);
    const puff = lathe(pts, seg(36, 14)), pp = puff.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.06 * Math.cos(a * 12); pp.setX(i, x * k); pp.setZ(i, z * k); } puff.computeVertexNormals();
    const cloth = std(col, { roughness: 0.92 });
    return [[puff, cloth], [lathe([[0.098, 0], [0.101, 0.002], [0.101, 0.065], [0.098, 0.067]], seg(32, 12)), std('#e8e8e8', { roughness: 0.9 })]];
  };
  T.bunny = (col) => {
    const fur = std(col, { roughness: 0.92 }), pink = std('#f8bbd0', { roughness: 0.9 }), parts = [];
    for (const sx of [-1, 1]) {
      const ear = lathe([[0, 0], [0.026, 0.02], [0.034, 0.08], [0.03, 0.15], [0.018, 0.2], [0, 0.215]], seg(16, 8));
      parts.push([ear, fur, [sx * 0.05, 0.01, -0.01], [0.12, 0, -sx * 0.22], [1, 1, 0.38]]);
      parts.push([lathe([[0, 0.02], [0.016, 0.04], [0.022, 0.09], [0.018, 0.15], [0, 0.19]], seg(14, 7)), pink, [sx * 0.05 - sx * 0.003, 0.015, 0.0], [0.12, 0, -sx * 0.22], [1, 1, 0.2]]);
    }
    parts.push([new THREE.TorusGeometry(0.11, 0.008, 6, seg(24, 10), Math.PI), std('#e0e0e0', { roughness: 0.6 }), [0, 0, 0], [0, 0, 0], [1, 0.45, 1]]);
    return parts;
  };
  T.cat = (col) => {
    const ear = new THREE.Shape(); ear.moveTo(-0.05, 0); ear.quadraticCurveTo(-0.035, 0.07, 0.0, 0.11); ear.quadraticCurveTo(0.035, 0.07, 0.05, 0); ear.closePath();
    const inner = new THREE.Shape(); inner.moveTo(-0.03, 0.012); inner.quadraticCurveTo(-0.02, 0.06, 0.0, 0.085); inner.quadraticCurveTo(0.02, 0.06, 0.03, 0.012); inner.closePath();
    const eg = new THREE.ExtrudeGeometry(ear, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: seg(3, 1), curveSegments: seg(12, 5) });
    const ig = new THREE.ExtrudeGeometry(inner, { depth: 0.004, bevelEnabled: false, curveSegments: seg(10, 4) });
    const fur = std(col, { roughness: 0.85 }), pink = std('#f48fb1', { roughness: 0.8 }), parts = [];
    for (const sx of [-1, 1]) { parts.push([eg, fur, [sx * 0.075, 0, -0.01], [-0.12, sx * 0.25, -sx * 0.18]]); parts.push([ig, pink, [sx * 0.075 + sx * 0.002, 0.004, 0.018], [-0.12, sx * 0.25, -sx * 0.18]]); }
    parts.push([new THREE.TorusGeometry(0.11, 0.008, 6, seg(24, 10), Math.PI), std('#222222', { roughness: 0.5 }), [0, 0, 0], [0, 0, 0], [1, 0.45, 1]]);
    return parts;
  };
  T.mohawk = (col) => {
    const tip = '#' + C(col).lerp(C('#ffffff'), 0.5).getHexString(), parts = [], hair = std(col, { roughness: 0.75 }), light = std(tip, { roughness: 0.7 });
    for (let i = 0; i < 9; i++) {
      const z = -0.13 + i * 0.033, h = 0.11 + Math.sin((i / 8) * Math.PI) * 0.08, lean = -0.3 + i * 0.07;
      parts.push([taper([[0, 0, 0], [0, h * 0.55, -h * 0.12 * lean], [0, h, -h * 0.3 * lean]], 0.026, 0.002, seg(10, 5), seg(8, 5), 0.8), i % 2 ? light : hair, [0, 0.01, z], null, [0.55, 1, 1]]);
    }
    parts.push([new THREE.BoxGeometry(0.03, 0.02, 0.3), std('#212121', { roughness: 0.9 }), [0, 0.01, 0]]);
    return parts;
  };
  T.sombrero = (col) => {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([0.06 + t * 0.19, 0.03 - Math.sin(t * Math.PI * 0.5) * 0.012 + (t > 0.85 ? (t - 0.85) * 0.3 : 0)]); }
    const brim = lathe(pts.concat([[0.25, 0.034], [0.06, 0.04]]), seg(40, 16));
    const zig = tex(128, 32, (g, W, H) => { g.fillStyle = '#' + C(col).getHexString(); g.fillRect(0, 0, W, H); g.fillStyle = '#c62828'; g.fillRect(0, H * 0.2, W, H * 0.6); g.fillStyle = '#2e7d32'; for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, H * 0.8); g.lineTo(x + 8, H * 0.2); g.lineTo(x + 16, H * 0.8); g.fill(); } g.fillStyle = '#ffeb3b'; for (let x = 4; x < W; x += 16) g.fillRect(x, H * 0.45, 4, 4); });
    const straw = std(col, { roughness: 0.92 }), parts = [[brim, straw]];
    parts.push([lathe([[0.075, 0.035], [0.07, 0.07], [0.062, 0.12], [0.045, 0.15], [0, 0.155]], seg(28, 12)), straw]);
    parts.push([lathe([[0.0745, 0.037], [0.0725, 0.066], [0.0705, 0.066], [0.0725, 0.037]], seg(28, 12)), std('#ffffff', { map: zig, roughness: 0.85 })]);
    const pom = new THREE.SphereGeometry(0.012, 8, 6), red = std('#e53935', { roughness: 1 });
    for (let i = 0; i < seg(16, 8); i++) { const a = (i / seg(16, 8)) * Math.PI * 2; parts.push([pom, red, [Math.cos(a) * 0.252, 0.025, Math.sin(a) * 0.252]]); }
    return parts;
  };
  T.unicorn = (col) => {
    // a twisted horn: the lathe pushed round in a spiral groove
    const pts = []; for (let i = 0; i <= 24; i++) pts.push([0.042 * (1 - i / 24) + 0.003, i * 0.012]);
    const g = lathe(pts, seg(28, 12)), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), k = 1 + 0.12 * Math.sin(a * 2 - y * 60); p.setX(i, Math.cos(a) * r * k); p.setZ(i, Math.sin(a) * r * k); }
    g.computeVertexNormals();
    const m = std(col, { metalness: 0.7, roughness: 0.25, emissive: C(col).multiplyScalar(0.18) });
    const tip = new V3(0, 0.29, 0).applyAxisAngle(new V3(1, 0, 0), 0.35).add(new V3(0, 0.012, 0.03));
    return [[g, m, [0, 0.012, 0.03], [0.35, 0, 0]], [new THREE.OctahedronGeometry(0.02, 0), glow('#ffffff'), [tip.x, tip.y, tip.z]], [new THREE.TorusGeometry(0.046, 0.01, 6, seg(20, 10)), std('#f8bbd0', { roughness: 0.6 }), [0, 0.014, 0.03], [Math.PI / 2 + 0.35, 0, 0]]];
  };

  const build0 = M.buildTopper;
  M.buildTopper = function (def, paint) {
    if (!def || !T[def.shape] || def.model) return build0.call(this, def, paint);
    const col = paint ? BL.PAINT_BY_ID[paint].color : def.color;
    const g = new THREE.Group(), info = { group: g, spin: null, bob: null, flames: def.shape === 'firecrown' };
    assemble(g, T[def.shape](col, def));
    if (def.shape === 'propeller') { const prop = new THREE.Group(); prop.position.y = 0.175; assemble(prop, T.propellerBlades()); g.add(prop); info.spin = prop; }
    return info;
  };

  // ---------- the antennas ----------
  const A = {};
  const ballTex = (col) => tex(256, 128, (g, W, H) => {
    // a classic football: white with black pentagons (an equirectangular sketch of them)
    g.fillStyle = '#' + C(col).getHexString(); g.fillRect(0, 0, W, H);
    g.fillStyle = '#151515';
    const pent = (x, y, r) => { g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5; g.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r); } g.fill(); };
    pent(W * 0.5, 6, 12); pent(W * 0.5, H - 6, 12);
    for (let i = 0; i < 5; i++) { pent(((i + 0.5) / 5) * W, H * 0.33, 11); pent((i / 5) * W, H * 0.67, 11); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo((i / 10) * W, 0); g.lineTo((i / 10) * W + W * 0.05, H); g.stroke(); }
  });
  A.ball = (col) => [[new THREE.SphereGeometry(0.045, seg(24, 12), seg(16, 8)), std('#ffffff', { map: tex(64, 32, (g) => { g.fillStyle = '#' + C(col).getHexString(); g.fillRect(0, 0, 64, 32); g.fillStyle = '#ff7a00'; g.fillRect(0, 13, 64, 6); g.fillStyle = '#ffffff'; g.fillRect(0, 15, 64, 2); }), roughness: 0.3 })]];
  A.football = (col) => [[new THREE.SphereGeometry(0.046, seg(26, 12), seg(18, 8)), std('#ffffff', { map: ballTex(col), roughness: 0.45 })]];
  A.star = (col) => [[extrudeFlat('star'), std(col, { metalness: 0.45, roughness: 0.3, emissive: C(col).multiplyScalar(0.18) }), [0, 0.04, 0], [0, Math.PI / 2, 0]]];
  A.heart = (col) => [[extrudeFlat('heart'), std(col, { metalness: 0.3, roughness: 0.25 }), [0, 0.04, 0], [0, Math.PI / 2, 0]]];
  A.bolt = (col) => [[extrudeFlat('bolt'), std(col, { metalness: 0.6, roughness: 0.3, emissive: C(col).multiplyScalar(0.25) }), [0, 0.04, 0], [0, Math.PI / 2, 0]]];
  function extrudeFlat(kind) {
    const sh = new THREE.Shape();
    if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.032 : 0.072; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); } sh.closePath(); }
    else if (kind === 'heart') { sh.moveTo(0, -0.062); sh.bezierCurveTo(-0.1, 0, -0.065, 0.078, 0, 0.036); sh.bezierCurveTo(0.065, 0.078, 0.1, 0, 0, -0.062); }
    else { sh.moveTo(0.022, 0.085); sh.lineTo(-0.042, 0.002); sh.lineTo(-0.002, 0.002); sh.lineTo(-0.022, -0.085); sh.lineTo(0.048, 0.012); sh.lineTo(0.007, 0.012); sh.closePath(); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: seg(3, 1), curveSegments: seg(14, 6) });
    g.translate(0, 0, -0.008);
    return g;
  }
  // a bright core inside a glowing shell (the shell adds light, so the core shows through)
  A.orb = (col) => [[new THREE.SphereGeometry(0.034, seg(18, 10), seg(12, 6)), glow('#' + C(col).lerp(C('#ffffff'), 0.55).getHexString())],
    [new THREE.SphereGeometry(0.052, seg(20, 10), seg(14, 7)), new THREE.MeshBasicMaterial({ color: C(col), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })]];
  A.donut = (col) => {
    const dough = std('#d39a5b', { roughness: 0.75 }), icing = std(col, { roughness: 0.35 }), parts = [];
    parts.push([new THREE.TorusGeometry(0.036, 0.019, seg(14, 8), seg(28, 14)), dough, null, [0, Math.PI / 2, 0]]);
    // icing on the front face with drips
    const ic = new THREE.TorusGeometry(0.036, 0.0195, seg(14, 8), seg(28, 14)), ip = ic.attributes.position;
    for (let i = 0; i < ip.count; i++) { const z = ip.getZ(i), a = Math.atan2(ip.getY(i), ip.getX(i)); if (z < -0.004 + 0.004 * Math.sin(a * 7)) ip.setZ(i, -0.004 + 0.004 * Math.sin(a * 7)); }
    ic.computeVertexNormals();
    parts.push([ic, icing, [0.0015, 0, 0], [0, Math.PI / 2, 0]]);
    const rnd = U.rng(11), sp = new THREE.BoxGeometry(0.003, 0.003, 0.012), cs = ['#ffeb3b', '#40c4ff', '#ffffff', '#69f0ae'].map((c) => std(c, { roughness: 0.4 }));
    for (let i = 0; i < seg(26, 12); i++) { const a = rnd() * Math.PI * 2, r = 0.024 + rnd() * 0.024; parts.push([sp, cs[i % 4], [0.021, Math.sin(a) * r, Math.cos(a) * r], [rnd() * 3, rnd() * 3, 0]]); }
    return parts;
  };
  A.pizza = (col) => {
    const sh = new THREE.Shape(); sh.moveTo(0, -0.055); sh.lineTo(-0.048, 0.048); sh.quadraticCurveTo(0, 0.064, 0.048, 0.048); sh.closePath();
    const parts = [[new THREE.ExtrudeGeometry(sh, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: seg(10, 4) }), std(col, { roughness: 0.7 }), null, [0, Math.PI / 2, 0]]];
    parts.push([taper([[0, 0.049, -0.05], [0, 0.06, 0], [0, 0.049, 0.05]], 0.009, 0.009, 10, 7), std('#c9873d', { roughness: 0.85 })]);
    for (const [py, pz] of [[0.022, -0.012], [0.03, 0.017], [-0.006, 0.002], [0.008, -0.022]]) parts.push([new THREE.CylinderGeometry(0.01, 0.01, 0.004, 12), std('#b71c1c', { roughness: 0.55 }), [0.007, py, pz], [0, 0, Math.PI / 2]]);
    return parts;
  };
  A.moon = (col) => {
    const sh = new THREE.Shape(); sh.absarc(0, 0, 0.055, -Math.PI * 0.7, Math.PI * 0.7, false); sh.absarc(0.026, 0, 0.044, Math.PI * 0.62, -Math.PI * 0.62, true);
    return [[new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: seg(3, 1), curveSegments: seg(24, 10) }), std(col, { roughness: 0.4, emissive: C(col).multiplyScalar(0.55) }), [0, 0.035, 0], [0, Math.PI / 2, 0]]];
  };
  A.rocket = (col) => {
    const hull = std('#eceff1', { metalness: 0.45, roughness: 0.3 }), red = std(col, { roughness: 0.35 }), parts = [];
    parts.push([lathe([[0.0, -0.045], [0.014, -0.044], [0.02, -0.02], [0.021, 0.02], [0.016, 0.045], [0.006, 0.065], [0, 0.07]], seg(20, 10)), hull]);
    parts.push([lathe([[0.0155, 0.045], [0.0165, 0.047], [0.007, 0.066], [0.001, 0.071], [0, 0.071]], seg(20, 10)), red]);
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.022, -0.02); fin.lineTo(0.022, -0.032); fin.lineTo(0, -0.02); fin.closePath();
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.003, bevelEnabled: false }); fg.translate(0.016, -0.012, -0.0015);
    for (let i = 0; i < 3; i++) parts.push([fg, red, null, [0, (i / 3) * Math.PI * 2, 0]]);
    parts.push([new THREE.CylinderGeometry(0.007, 0.007, 0.004, 12), std('#40c4ff', { metalness: 0.8, roughness: 0.1 }), [0.0205, 0.012, 0], [0, 0, Math.PI / 2]]);
    parts.push([new THREE.ConeGeometry(0.012, 0.035, 10), glow('#ff9a3c'), [0, -0.064, 0], [Math.PI, 0, 0]]);
    return parts;
  };
  A.diamond = (col) => {
    // a brilliant cut: a few facets round, flat-shaded
    const g = lathe([[0, -0.055], [0.05, 0.0], [0.046, 0.012], [0.03, 0.028], [0, 0.03]], 8);
    return [[g, std(col, { metalness: 0.2, roughness: 0.04, flatShading: true, emissive: C(col).multiplyScalar(0.35) }), [0, 0.03, 0]]];
  };
  A.torch = (col) => [
    [lathe([[0.012, -0.04], [0.016, 0.0], [0.028, 0.03], [0.03, 0.04], [0.025, 0.042]], seg(16, 8)), std('#6d4c41', { roughness: 0.8 })],
    [lathe([[0.025, 0.035], [0.042, 0.05], [0.044, 0.06], [0.036, 0.06], [0.02, 0.045]], seg(18, 9)), std(col, { metalness: 0.85, roughness: 0.3 })],
    [new THREE.ConeGeometry(0.03, 0.085, 10), glow('#ff7a1a'), [0, 0.1, 0]],
    [new THREE.ConeGeometry(0.017, 0.055, 10), glow('#ffe27a'), [0, 0.09, 0]],
  ];

  const ant0 = M.buildAntenna;
  M.buildAntenna = function (def, paint) {
    const r = ant0.call(this, def, paint);
    if (!r || !def || !A[def.shape]) return r;
    const col = paint ? BL.PAINT_BY_ID[paint].color : def.color;
    // swap the head for the new model, keeping the pole, the wobble and the rest
    for (const ch of r.top.children.slice()) { r.top.remove(ch); if (ch.geometry) ch.geometry.dispose(); }
    assemble(r.top, A[def.shape](col, def));
    return r;
  };
  // flags: a finial ball on the pole's tip, and the cloth in more pieces so it waves smoothly
  const ant1 = M.buildAntenna;
  M.buildAntenna = function (def, paint) {
    const r = ant1.call(this, def, paint);
    if (r && r.flag && !low()) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), std('#ffd54f', { metalness: 0.9, roughness: 0.25 }));
      tip.position.y = 0.02; r.top.add(tip);
    }
    return r;
  };
})(window.BL);
