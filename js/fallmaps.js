'use strict';
// Rocket League (fan remake) - the fall and holiday maps' own scenery (2026-11-22, the user's four themed maps):
//   Autumn Grove   (decor 'bigtree')  a giant autumn tree towering over one end, leaves carpeting the ground
//   Turkey Trot    (decor 'farm')     a farm: red barn and silo, hay bales, pumpkins, a fence; turkeys on the pitch
//                                    (js/turkeys.js: run into one and you're gobbled)
//   Holiday Lights (map.lights)       strings of Christmas lights along the walls, the roof edge and the top of the
//                                    stands, twinkling (one draw call for every bulb)
//   Pumpkin Pie    (decor 'pie')      the pitch is a slice of pumpkin pie (js/arena.js paints the floor), a crust
//                                    rim round the stadium, giant whipped cream dollops, leaves all round
// Built from simple shapes in code (works from disk), instanced; Very Low gets fewer pieces.
(function (BL) {
  const FM = BL.FallMaps = {};
  const U = BL.util, V3 = THREE.Vector3;
  const mat = (col, low, o) => (low ? new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(col) }, o || {})) : new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(col), roughness: 0.85, metalness: 0.02 }, o || {})));
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), pv = new V3(), sc = new V3(), eu = new THREE.Euler();
  function inst(root, H, geo, material, list) {
    const im = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach((it, i) => { eu.set(it.rx || 0, it.ry || 0, it.rz || 0); qq.setFromEuler(eu); pv.set(it.x, it.y || 0, it.z); sc.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1); im.setMatrixAt(i, m4.compose(pv, qq, sc)); });
    root.add(im); H.disposables.push(geo, material);
    return im;
  }
  const ring = (rnd, r0, r1) => { const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0); return [Math.cos(a) * r, Math.sin(a) * r, a]; };

  FM.build = function (root, H, map, A, low, D) {
    const potato = !!(BL.App && BL.App.potato), rnd = U.rng(U.hash(map.id + 'fall'));
    if (map.decor === 'bigtree') giantTree(root, H, A, low, D);
    if (map.decor === 'farm') farm(root, H, A, low, D, rnd, potato);
    if (map.decor === 'pie') pie(root, H, A, low, D, rnd, potato);
    if (map.decor === 'bigtree' || map.decor === 'farm' || map.decor === 'pie') leafCarpet(root, H, A, low, D);
    if (map.lights) lights(root, H, A, low, D, potato);
    if (map.turkeys && BL.Turkeys) BL.Turkeys.build(root, H, low);
  };

  // ---------- leaves on the ground all round the stadium ----------
  let leafTex = null;
  function leafTexture(low) {
    if (leafTex) return leafTex;
    const S = low ? 256 : 512, { c, g } = U.canvas(S, S), rnd = U.rng(11);
    g.fillStyle = '#6b3d1c'; g.fillRect(0, 0, S, S);
    const cols = ['#e07a22', '#c8461c', '#f2b234', '#9c3015', '#d8952e', '#7f4a1c'];
    for (let i = 0; i < S * 2.2; i++) {
      const x = rnd() * S, y = rnd() * S, r = S * (0.012 + rnd() * 0.018);
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        if (Math.abs(x + ox - S / 2) > S / 2 + r * 2 || Math.abs(y + oy - S / 2) > S / 2 + r * 2) continue;
        g.save(); g.translate(x + ox, y + oy); g.rotate(rnd() * 6.3); g.fillStyle = cols[(rnd() * cols.length) | 0];
        g.beginPath(); g.moveTo(0, -r * 1.6); g.quadraticCurveTo(r * 1.1, -r * 0.4, 0, r * 1.4); g.quadraticCurveTo(-r * 1.1, -r * 0.4, 0, -r * 1.6); g.fill();
        g.strokeStyle = 'rgba(60,25,10,0.5)'; g.lineWidth = Math.max(1, r * 0.12); g.beginPath(); g.moveTo(0, -r * 1.4); g.lineTo(0, r * 1.5); g.stroke();
        g.restore();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return (leafTex = t);
  }
  function leafCarpet(root, H, A, low, D) {
    const r0 = A.hw + D.ST.d0, r1 = 760, geo = new THREE.RingGeometry(r0, r1, low ? 40 : 72, 1);
    const tex = leafTexture(low).clone(); tex.needsUpdate = true; tex.repeat.set(r1 / 7, r1 / 7);
    const m = new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = -0.58;
    root.add(mesh); H.disposables.push(geo, m, tex);
  }

  // ---------- a giant autumn tree behind one end ----------
  function giantTree(root, H, A, low, D) {
    const potato = !!(BL.App && BL.App.potato);
    const X = 40, Z = -(A.hl + D.ST.d1 + 62), grp = new THREE.Group();
    grp.scale.setScalar(1.25);
    grp.position.set(X, -0.6, Z);
    const bark = mat('#4a2e1b', low);
    const trunk = new THREE.CylinderGeometry(9, 17, 130, low ? 8 : 14, 4); trunk.translate(0, 65, 0);
    // (a little gnarl: the trunk leans and bulges)
    const tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) * (1 + 0.08 * Math.sin(y * 0.09)) + Math.sin(y * 0.02) * 4); }
    trunk.computeVertexNormals();
    const tm = new THREE.Mesh(trunk, bark); grp.add(tm); H.disposables.push(trunk, bark);
    // branches up into the crown
    const br = new THREE.CylinderGeometry(2.6, 5, 60, low ? 5 : 8); br.translate(0, 30, 0);
    const bl = [];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; bl.push({ x: 0, y: 92 + (k % 3) * 9, z: 0, rx: Math.cos(a) * 0.85, rz: Math.sin(a) * 0.85, s: 0.8 + (k % 2) * 0.3 }); }
    if (!potato) inst(grp, H, br, bark, bl); else br.dispose();
    // the crown: big round clumps of orange, red and gold leaves
    const blob = new THREE.IcosahedronGeometry(1, low ? 0 : 1), rnd = U.rng(77);
    const cols = potato ? ['#d9661c', '#c4471a'] : ['#d9661c', '#b8321e', '#e8a21c', '#c4471a'];
    cols.forEach((col, ci) => {
      const list = [];
      for (let i = 0; i < (potato ? 10 : low ? 5 : 9); i++) {
        const a = rnd() * Math.PI * 2, r = 20 + rnd() * 55, y = 120 + rnd() * 70 - r * 0.25;
        list.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, s: 20 + rnd() * 18, ry: rnd() * 3, rx: rnd() * 3 });
      }
      inst(grp, H, ci ? blob : blob.clone(), mat(col, low, { flatShading: true }), list);
    });
    root.add(grp);
  }

  // ---------- the farm round Turkey Trot ----------
  function farm(root, H, A, low, D, rnd, potato) {
    const out = A.hl + D.ST.d1 + 30;
    // the red barn with a white-trimmed roof, and a silo
    const barn = new THREE.Group(); barn.position.set(-120, -0.6, -out - 40); barn.rotation.y = 0.5;
    const red = mat('#a8281e', low), white = mat('#f2efe8', low), roofM = mat('#4a3a33', low);
    const body = new THREE.BoxGeometry(46, 26, 60); body.translate(0, 13, 0);
    const roof = new THREE.CylinderGeometry(1, 1, 64, 3, 1); roof.rotateZ(Math.PI / 2); roof.rotateX(Math.PI / 6); roof.scale(1, 15, 26); roof.translate(0, 33, 0);
    barn.add(new THREE.Mesh(body, red), new THREE.Mesh(roof, roofM));
    const door = new THREE.BoxGeometry(18, 18, 1); door.translate(0, 9, 30.6);
    barn.add(new THREE.Mesh(door, white));
    const silo = new THREE.CylinderGeometry(9, 9, 52, low ? 10 : 18); silo.translate(36, 26, 0);
    const dome = new THREE.SphereGeometry(9, low ? 10 : 18, 8, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(36, 52, 0);
    barn.add(new THREE.Mesh(silo, mat('#9aa3ab', low)), new THREE.Mesh(dome, mat('#6d757c', low)));
    root.add(barn); H.disposables.push(body, roof, door, silo, dome, red, white, roofM);
    // hay bales, pumpkins and fence posts round the stadium
    const hay = new THREE.CylinderGeometry(1.5, 1.5, 2, low ? 8 : 14); hay.rotateZ(Math.PI / 2);
    const bales = []; for (let i = 0; i < (potato ? 14 : low ? 30 : 60); i++) { const [x, z, a] = ring(rnd, A.hl + D.ST.d1 - 18, A.hl + D.ST.d1 + 90); bales.push({ x, y: 0.9, z, ry: a + rnd(), s: 1.2 + rnd() * 0.5 }); }
    inst(root, H, hay, mat('#d9b348', low), bales);
    if (!potato) {
      const pump = new THREE.SphereGeometry(1, low ? 8 : 12, low ? 6 : 9); pump.scale(1.25, 0.85, 1.25);
      const pl = []; for (let i = 0; i < (low ? 30 : 70); i++) { const [x, z] = ring(rnd, A.hl + D.ST.d1 - 20, A.hl + D.ST.d1 + 60); pl.push({ x, y: 0.2, z, s: 0.9 + rnd() * 1.4 }); }
      inst(root, H, pump, mat('#e36c12', low), pl);
      const post = new THREE.BoxGeometry(0.5, 3, 0.5); post.translate(0, 1.5, 0);
      const rail = new THREE.BoxGeometry(0.25, 0.35, 1); rail.translate(0, 0, 0.5);
      const R = A.hl + D.ST.d1 + 110, np = low ? 90 : 160, posts = [], rails = [];
      for (let i = 0; i < np; i++) {
        const a = (i / np) * Math.PI * 2, b = ((i + 1) / np) * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R, x2 = Math.cos(b) * R, z2 = Math.sin(b) * R, len = Math.hypot(x2 - x, z2 - z), yaw = Math.atan2(x2 - x, z2 - z);
        posts.push({ x, y: -0.6, z });
        for (const h of [1.2, 2.4]) rails.push({ x, y: -0.6 + h, z, ry: yaw, sz: len });
      }
      const wood = mat('#7a5232', low);
      inst(root, H, post, wood, posts); inst(root, H, rail, wood.clone(), rails);
    }
  }

  // ---------- Pumpkin Pie: a crust rim round the stadium and giant whipped cream ----------
  function pie(root, H, A, low, D, rnd, potato) {
    const R = Math.hypot(A.hw, A.hl) + D.ST.d1 + 26;
    const crust = new THREE.TorusGeometry(R, 14, low ? 6 : 10, low ? 48 : 96); crust.rotateX(Math.PI / 2);
    // (a crimped edge: the tube bulges in a wave all the way round)
    const p = crust.attributes.position, v = new V3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), k = 1 + 0.035 * Math.sin(a * 140); p.setXYZ(i, v.x * k, v.y * (0.75 + 0.25 * k), v.z * k); }
    crust.computeVertexNormals();
    const cm = mat('#d89a4e', low);
    const cmesh = new THREE.Mesh(crust, cm); cmesh.position.y = 2; root.add(cmesh); H.disposables.push(crust, cm);
    // whipped cream: a swirl of stacked, twisted rings narrowing to a curl at the top
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, r = (1 - t) * (1 + 0.16 * Math.sin(t * Math.PI * 10)) * 1.0 + 0.02; pts.push(new THREE.Vector2(Math.max(0.01, r), t * 1.6)); }
    const cream = new THREE.LatheGeometry(pts, low ? 10 : 20);
    const cp = cream.attributes.position;
    for (let i = 0; i < cp.count; i++) { v.fromBufferAttribute(cp, i); const a = Math.atan2(v.z, v.x), k = 1 + 0.12 * Math.sin(a * 6 + v.y * 9); cp.setXYZ(i, v.x * k, v.y, v.z * k); }
    cream.computeVertexNormals();
    const dl = []; const n = potato ? 4 : 8;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.4, r = R + 30 + (i % 2) * 40; dl.push({ x: Math.cos(a) * r, y: -0.6, z: Math.sin(a) * r, s: 26 + (i % 3) * 6, ry: i }); }
    inst(root, H, cream, mat('#fbf6ec', low, low ? {} : { roughness: 0.55 }), dl);
    // cinnamon sticks and nutmeg crumbs scattered on the leaves
    if (!potato) {
      const stick = new THREE.CylinderGeometry(1.2, 1.2, 22, 8); stick.rotateZ(Math.PI / 2);
      const sl = []; for (let i = 0; i < 10; i++) { const [x, z, a] = ring(rnd, R + 50, R + 200); sl.push({ x, y: 0.6, z, ry: a + rnd() * 2 }); }
      inst(root, H, stick, mat('#8a4a22', low), sl);
    }
  }

  // ---------- Holiday Lights: strings of bulbs round the stadium ----------
  // the arena's outline (straight walls with 45-degree corners, offset outward by `off`), sampled every `step` m
  function outline(A, off, step) {
    const hw = A.hw + off, hl = A.hl + off, c = (A.cornerR || 11.5) + off * 0.4, pts = [];
    const corners = [[hw - c, hl], [hw, hl - c], [hw, -hl + c], [hw - c, -hl], [-hw + c, -hl], [-hw, -hl + c], [-hw, hl - c], [-hw + c, hl]];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], b = corners[(i + 1) % corners.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / step));
      for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    return pts;
  }
  const BULBS = ['#ff2a2a', '#2aff5a', '#2a7bff', '#ffd02a', '#ff8a1f', '#ff4fd8', '#ffffff'];
  function lights(root, H, A, low, D, potato) {
    // strings: along the top of the field walls, along the roof's edge, round the top of the stands (each sags
    // between hooks every 7 m)
    // (garlands low along the glass and the front of the stands, where you see them from the pitch, then the roof's
    // edge and the top of the stands; bulbs sized so they still read from the far end)
    const strings = [{ off: 0.6, y: 6.2, step: potato ? 2.4 : 1.4, sag: 1.6, r: 0.45 }, { off: D.ROOF.d, y: D.ROOF.y - 1.2, step: potato ? 3 : low ? 2.2 : 1.6, sag: 1.4, r: 0.5 }];
    if (!potato) strings.push({ off: D.ST.d0 - 1, y: D.ST.y0 + 1.4, step: low ? 2 : 1.5, sag: 1.1, r: 0.5 }, { off: D.ST.d1 - 2, y: D.ST.y1 + 1.5, step: low ? 2.6 : 1.8, sag: 1.2, r: 0.5 });
    const pos = [], wires = [];
    for (const s of strings) {
      const pts = outline(A, s.off, s.step), per = Math.max(2, Math.round(7 / s.step));
      pts.forEach((p, i) => {
        const f = (i % per) / per, y = s.y - s.sag * Math.sin(Math.PI * f);
        pos.push([p[0], y, p[1], s.r]);
      });
      for (let i = 0; i < pos.length - 1; i++) if (i >= pos.length - pts.length) wires.push(pos[i], pos[i + 1]);
    }
    const n = pos.length, geo = new THREE.SphereGeometry(1, potato ? 4 : 6, potato ? 3 : 4);
    const ph = new Float32Array(n);
    // bright enough to bloom on Medium / High
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(low ? 1 : 2.4, low ? 1 : 2.4, low ? 1 : 2.4), fog: false });
    const u = { uT: { value: 0 } };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = u.uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aPh; uniform float uT; varying float vTw;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTw = 0.55 + 0.45 * sin(uT * (1.3 + fract(aPh * 3.7) * 2.2) + aPh * 40.0);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTw;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTw;');
    };
    m.customProgramCacheKey = () => 'xmasbulbs';
    const im = new THREE.InstancedMesh(geo, m, n);
    const col = new THREE.Color(), rnd = U.rng(5);
    pos.forEach((p, i) => { pv.set(p[0], p[1], p[2]); m4.makeScale(p[3], p[3], p[3]).setPosition(pv); im.setMatrixAt(i, m4); col.set(BULBS[i % BULBS.length]); im.setColorAt(i, col); ph[i] = rnd(); });
    geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
    im.frustumCulled = false;
    root.add(im); H.disposables.push(geo, m);
    H.anim.push((dt, t) => { u.uT.value = t % 3600; });
    // a soft glow round every bulb (Medium / High: one draw call of additive points)
    if (!low) {
      const gp = new Float32Array(n * 3), gc = new Float32Array(n * 3);
      pos.forEach((p, i) => { gp[i * 3] = p[0]; gp[i * 3 + 1] = p[1]; gp[i * 3 + 2] = p[2]; col.set(BULBS[i % BULBS.length]); gc[i * 3] = col.r; gc[i * 3 + 1] = col.g; gc[i * 3 + 2] = col.b; });
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
      const { c: hc, g: hg } = U.canvas(64, 64), gr = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      hg.fillStyle = gr; hg.fillRect(0, 0, 64, 64);
      const ht = new THREE.CanvasTexture(hc);
      const gm = new THREE.PointsMaterial({ size: 2.4, map: ht, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const glow = new THREE.Points(gg, gm); glow.frustumCulled = false; glow.renderOrder = 3;
      root.add(glow); H.disposables.push(gg, gm, ht);
    }
    // the wires between them
    const wp = new Float32Array(wires.length * 3);
    wires.forEach((p, i) => { wp[i * 3] = p[0]; wp[i * 3 + 1] = p[1] + 0.12; wp[i * 3 + 2] = p[2]; });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
    const wm = new THREE.LineBasicMaterial({ color: 0x1b2a1b });
    root.add(new THREE.LineSegments(wg, wm)); H.disposables.push(wg, wm);
  }
})(window.BL);
