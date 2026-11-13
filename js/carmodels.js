'use strict';
// Rocket League (fan remake) - procedural car, wheel, topper, antenna and ball models (+ optional GLB override)
(function (BL) {
  const U = BL.util;
  const M = BL.Models = { envMap: null };
  const V3 = THREE.Vector3;

  // Heights (h) are meters above the ground; u is meters along the car (+ = front)
  const STYLES = {
    hatch: {
      L: 1.24, W: 0.86, bottom: 0.12, f: { u: 0.40, r: 0.155, w: 0.15 }, r: { u: -0.37, r: 0.19, w: 0.18 },
      nose: { h: 0.33, round: 0.07 }, hoodU: 0.14, belt: 0.43, deck: { u: -0.50, h: 0.45 }, tail: { h: 0.42, round: 0.06 },
      cabin: { ws: 0.14, rf: -0.04, roof: 0.63, rr: -0.32, rw: -0.50, w: 0.76 }, taper: { nose: 0.22, tail: 0.08, top: 0.08 },
      parts: ['roofSpoiler', 'skirts', 'mirrors'],
    },
    boxy: {
      L: 1.22, W: 0.88, bottom: 0.12, f: { u: 0.39, r: 0.17, w: 0.17 }, r: { u: -0.38, r: 0.17, w: 0.17 },
      nose: { h: 0.38, round: 0.04 }, hoodU: 0.20, belt: 0.45, deck: { u: -0.52, h: 0.46 }, tail: { h: 0.45, round: 0.035 },
      cabin: { ws: 0.20, rf: 0.07, roof: 0.65, rr: -0.44, rw: -0.55, w: 0.80 }, taper: { nose: 0.06, tail: 0.04, top: 0.03 },
      parts: ['skirts', 'mirrors', 'roofRack'],
    },
    muscle: {
      L: 1.32, W: 0.88, bottom: 0.10, f: { u: 0.43, r: 0.15, w: 0.16 }, r: { u: -0.42, r: 0.175, w: 0.19 },
      nose: { h: 0.33, round: 0.05 }, hoodU: 0.0, belt: 0.40, deck: { u: -0.40, h: 0.41 }, tail: { h: 0.41, round: 0.05 },
      cabin: { ws: 0.0, rf: -0.15, roof: 0.55, rr: -0.30, rw: -0.42, w: 0.74 }, taper: { nose: 0.12, tail: 0.05, top: 0.05 },
      parts: ['scoop', 'ducktail', 'skirts', 'mirrors'],
    },
    bug: {
      L: 1.20, W: 0.86, bottom: 0.13, f: { u: 0.38, r: 0.165, w: 0.16 }, r: { u: -0.37, r: 0.175, w: 0.17 },
      nose: { h: 0.35, round: 0.09 }, hoodU: 0.18, belt: 0.44, deck: { u: -0.38, h: 0.44 }, tail: { h: 0.38, round: 0.12 },
      cabin: { ws: 0.18, rf: 0.02, roof: 0.64, rr: -0.24, rw: -0.52, w: 0.78 }, taper: { nose: 0.2, tail: 0.2, top: 0.12 },
      parts: ['mirrors'],
    },
    wedge: {
      L: 1.32, W: 0.82, bottom: 0.10, f: { u: 0.40, r: 0.145, w: 0.15 }, r: { u: -0.42, r: 0.18, w: 0.19 },
      nose: { h: 0.25, round: 0.04 }, hoodU: 0.08, belt: 0.42, deck: { u: -0.42, h: 0.47 }, tail: { h: 0.47, round: 0.04 },
      cabin: { ws: 0.08, rf: -0.08, roof: 0.56, rr: -0.26, rw: -0.42, w: 0.70 }, taper: { nose: 0.32, tail: 0.06, top: 0.06 },
      parts: ['wing', 'skirts'],
    },
    flat: {
      L: 1.34, W: 0.90, bottom: 0.10, f: { u: 0.44, r: 0.15, w: 0.17 }, r: { u: -0.43, r: 0.165, w: 0.19 },
      nose: { h: 0.32, round: 0.05 }, hoodU: 0.0, belt: 0.37, deck: { u: -0.40, h: 0.38 }, tail: { h: 0.38, round: 0.05 },
      cabin: { ws: 0.0, rf: -0.15, roof: 0.48, rr: -0.32, rw: -0.44, w: 0.72 }, taper: { nose: 0.1, tail: 0.03, top: 0.04 },
      parts: ['fins', 'skirts'],
    },
    truck: {
      L: 1.26, W: 0.90, bottom: 0.22, f: { u: 0.40, r: 0.21, w: 0.2 }, r: { u: -0.40, r: 0.21, w: 0.2 },
      nose: { h: 0.52, round: 0.04 }, hoodU: 0.22, belt: 0.57, deck: { u: -0.20, h: 0.58 }, tail: { h: 0.58, round: 0.035 },
      cabin: { ws: 0.22, rf: 0.10, roof: 0.84, rr: -0.17, rw: -0.20, w: 0.82 }, taper: { nose: 0.04, tail: 0.02, top: 0.02 },
      parts: ['rollbar', 'mirrors', 'bed'],
    },
    hybrid: {
      L: 1.28, W: 0.86, bottom: 0.11, f: { u: 0.41, r: 0.16, w: 0.16 }, r: { u: -0.40, r: 0.175, w: 0.18 },
      nose: { h: 0.34, round: 0.06 }, hoodU: 0.13, belt: 0.43, deck: { u: -0.52, h: 0.45 }, tail: { h: 0.44, round: 0.05 },
      cabin: { ws: 0.13, rf: -0.05, roof: 0.61, rr: -0.36, rw: -0.52, w: 0.76 }, taper: { nose: 0.15, tail: 0.06, top: 0.07 },
      parts: ['bigwing', 'skirts', 'mirrors', 'vents'],
    },
    super: {
      L: 1.36, W: 0.90, bottom: 0.09, f: { u: 0.44, r: 0.15, w: 0.17 }, r: { u: -0.42, r: 0.17, w: 0.20 },
      nose: { h: 0.28, round: 0.05 }, hoodU: 0.14, belt: 0.37, deck: { u: -0.30, h: 0.42 }, tail: { h: 0.39, round: 0.05 },
      cabin: { ws: 0.14, rf: -0.02, roof: 0.52, rr: -0.20, rw: -0.32, w: 0.68 }, taper: { nose: 0.25, tail: 0.1, top: 0.1 },
      parts: ['wing', 'intakes', 'skirts'], archPad: 0.012,
    },
    gt: {
      L: 1.40, W: 0.90, bottom: 0.09, f: { u: 0.46, r: 0.15, w: 0.17 }, r: { u: -0.44, r: 0.17, w: 0.20 },
      nose: { h: 0.28, round: 0.05 }, hoodU: 0.12, belt: 0.37, deck: { u: -0.26, h: 0.42 }, tail: { h: 0.40, round: 0.04 },
      cabin: { ws: 0.12, rf: -0.04, roof: 0.52, rr: -0.18, rw: -0.30, w: 0.66 }, taper: { nose: 0.3, tail: 0.05, top: 0.1 },
      parts: ['wing', 'fins', 'intakes', 'skirts'], archPad: 0.012,
    },
    cyber: {
      L: 1.28, W: 0.90, bottom: 0.16, f: { u: 0.40, r: 0.19, w: 0.19 }, r: { u: -0.40, r: 0.19, w: 0.19 },
      nose: { h: 0.44, round: 0.02 }, hoodU: 0.28, belt: 0.50, deck: { u: -0.62, h: 0.56 }, tail: { h: 0.55, round: 0.02 },
      cabin: { ws: 0.28, rf: 0.02, roof: 0.76, rr: -0.10, rw: -0.62, w: 0.84 }, taper: { nose: 0.03, tail: 0.02, top: 0.02 },
      parts: ['skirts', 'lightbar', 'ledstrip'],
    },
    formula: {
      L: 1.30, W: 0.30, bottom: 0.10, f: { u: 0.45, r: 0.165, w: 0.16 }, r: { u: -0.40, r: 0.185, w: 0.21 },
      nose: { h: 0.22, round: 0.04 }, hoodU: 0.0, belt: 0.34, deck: { u: -0.18, h: 0.46 }, tail: { h: 0.30, round: 0.05 },
      cabin: null, taper: { nose: 0.45, tail: 0.15, top: 0.2 }, open: true, wheelX: 0.40,
      parts: ['frontWing', 'rearWing', 'pods', 'driver'],
    },
  };
  M.STYLES = STYLES;

  // ---------- shapes ----------
  function profileShape(s, arches) {
    const sh = new THREE.Shape();
    const L2 = s.L / 2, b = s.bottom, tr = s.tail.round, nr = s.nose.round;
    const pad = s.archPad == null ? 0.02 : s.archPad;
    const fa = s.f.r + pad, ra = s.r.r + pad;
    sh.moveTo(-L2 + tr, b);
    if (arches) {
      sh.lineTo(s.r.u - ra, b);
      sh.absarc(s.r.u, s.r.r, ra, Math.PI, 0, true);
      sh.lineTo(s.r.u + ra, b);
      sh.lineTo(s.f.u - fa, b);
      sh.absarc(s.f.u, s.f.r, fa, Math.PI, 0, true);
      sh.lineTo(s.f.u + fa, b);
    }
    sh.lineTo(L2 - nr, b);
    sh.quadraticCurveTo(L2, b, L2, b + nr);
    sh.lineTo(L2, s.nose.h - nr);
    sh.quadraticCurveTo(L2, s.nose.h, L2 - nr * 1.2, s.nose.h + nr * 0.12);
    sh.quadraticCurveTo(U.lerp(L2, s.hoodU, 0.5), U.lerp(s.nose.h, s.belt, 0.85), s.hoodU, s.belt);
    sh.lineTo(s.deck.u, s.deck.h);
    sh.quadraticCurveTo(U.lerp(s.deck.u, -L2, 0.6), s.deck.h + 0.005, -L2 + tr, s.tail.h);
    sh.quadraticCurveTo(-L2, s.tail.h - tr * 0.2, -L2, s.tail.h - tr);
    sh.lineTo(-L2, b + tr);
    sh.quadraticCurveTo(-L2, b, -L2 + tr, b);
    return sh;
  }

  function cabinShape(s) {
    const c = s.cabin, sh = new THREE.Shape();
    const fb = s.belt - 0.03, rb = s.deck.h - 0.03;
    sh.moveTo(c.rw, rb);
    sh.lineTo(c.ws, fb);
    sh.quadraticCurveTo(U.lerp(c.ws, c.rf, 0.3), U.lerp(fb, c.roof, 0.78), c.rf, c.roof);
    sh.quadraticCurveTo((c.rf + c.rr) / 2, c.roof + 0.025, c.rr, c.roof - 0.01);
    sh.quadraticCurveTo(U.lerp(c.rr, c.rw, 0.3), U.lerp(c.roof, rb, 0.25), c.rw, rb);
    return sh;
  }

  function roofShape(s) {
    const c = s.cabin;
    const p0 = [c.rf, c.roof], cp = [(c.rf + c.rr) / 2, c.roof + 0.025], p2 = [c.rr, c.roof - 0.01];
    const top = [];
    for (let i = 0; i <= 8; i++) {
      const t = 0.04 + (i / 8) * 0.92, it = 1 - t;
      top.push([it * it * p0[0] + 2 * it * t * cp[0] + t * t * p2[0], it * it * p0[1] + 2 * it * t * cp[1] + t * t * p2[1]]);
    }
    const sh = new THREE.Shape();
    sh.moveTo(top[0][0], top[0][1] + 0.004);
    for (let i = 1; i < top.length; i++) sh.lineTo(top[i][0], top[i][1] + 0.004);
    for (let i = top.length - 1; i >= 0; i--) sh.lineTo(top[i][0], top[i][1] - 0.03);
    return sh;
  }

  function extrude(shape, width, bt, bs, segs, cs) {
    const depth = Math.max(0.005, width - 2 * bt);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: segs, curveSegments: cs, steps: 1 });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i, -(z - depth / 2), y, x);
    }
    return g;
  }

  // deform + merge + normals + wrap-around UVs
  function finalize(g, s, deform, xOff) {
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    let geo = THREE.BufferGeometryUtils.mergeVertices(g, 1e-4);
    g.dispose();
    const p = geo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    const top = 0.7, wrap = s.W / 2 * 0.8;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) + xOff;
      const h = p.getY(i), z = p.getZ(i);
      if (deform) x *= deform(z, h, x);
      p.setXYZ(i, x, h - s.restH, z);
      uv[i * 2] = (z + s.L / 2) / s.L;
      uv[i * 2 + 1] = U.clamp((h + Math.max(0, s.W / 2 - Math.abs(x)) * 0.8) / (top + wrap), 0, 1);
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }

  function taperFn(s, extraTop) {
    if (s.widthAt) return (z, h) => s.widthAt(z, h) / (s.W / 2);
    const L2 = s.L / 2;
    return (z, h) => {
      let f = 1;
      const fz = (z - L2 * 0.45) / (L2 * 0.55);
      if (fz > 0) f *= 1 - s.taper.nose * fz * fz;
      const rz = (-z - L2 * 0.6) / (L2 * 0.4);
      if (rz > 0) f *= 1 - s.taper.tail * rz * rz;
      const th = (h - s.belt * 0.85) / 0.25;
      if (th > 0) f *= 1 - s.taper.top * Math.min(1, th);
      if (extraTop && s.cabin) {
        const ct = (h - s.belt) / (s.cabin.roof - s.belt);
        if (ct > 0) f *= 1 - extraTop * Math.min(1, ct);
      }
      return f;
    };
  }

  function box(w, h, d, x, y, z, rx, ry, rz) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)));
    g.translate(x, y, z);
    return g;
  }
  function cyl(rt, rb, h, seg, x, y, z, rx, ry, rz) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)));
    g.translate(x, y, z);
    return g;
  }
  function merge(list) {
    const clean = list.filter(Boolean).map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (n !== g) g.dispose();
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
      if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      if (!n.attributes.normal) n.computeVertexNormals();
      return n;
    });
    if (!clean.length) return null;
    const m = THREE.BufferGeometryUtils.mergeBufferGeometries(clean, false);
    clean.forEach((g) => g.dispose());
    return m;
  }

  // ---------- materials ----------
  const shared = {};
  function q() { return (BL.App && BL.App.quality) || 'medium'; }
  function stdMat(opts, lowShin) {
    if (q() === 'low') {
      const o = { color: opts.color != null ? opts.color : 0xffffff, map: opts.map || null, shininess: lowShin == null ? 30 : lowShin, specular: 0x333333 };
      if (opts.emissive) o.emissive = opts.emissive;
      return new THREE.MeshPhongMaterial(o);
    }
    const m = new THREE.MeshStandardMaterial(Object.assign({ envMap: M.envMap, envMapIntensity: 1 }, opts));
    return m;
  }
  function sharedMat(key, make) {
    const k = key + ':' + q() + ':' + (M.envMap ? M.envMap.uuid : 'x');
    if (!shared[k]) { shared[k] = make(); shared[k].userData.shared = true; }
    return shared[k];
  }
  function tireTexture() {
    const W = q() === 'low' ? 256 : 512, H = W / 4;
    const { c, g } = U.canvas(W, H);
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, W, H);
    const vy = (v) => (1 - v) * H;
    const t0 = vy(4 / 7), t1 = vy(3 / 7);
    const blocks = 48;
    for (let i = 0; i < blocks; i++) {
      const x = (i / blocks) * W;
      g.fillStyle = '#0c0c0d';
      g.fillRect(x, t0, W / blocks * 0.28, t1 - t0);
      g.fillStyle = '#26272b';
      g.fillRect(x + W / blocks * 0.4, t0 + (t1 - t0) * 0.15, W / blocks * 0.45, (t1 - t0) * 0.7);
    }
    g.fillStyle = '#0c0c0d'; g.fillRect(0, (t0 + t1) / 2 - 1, W, 2);
    g.strokeStyle = '#0d0d0e'; g.lineWidth = Math.max(1, W / 256);
    for (const [a, b] of [[vy(5 / 7), t0], [t1, vy(2 / 7)]]) {
      for (let i = 0; i < blocks; i++) { const x = (i / blocks) * W; g.beginPath(); g.moveTo(x, a); g.lineTo(x + W / blocks * 0.6, b); g.stroke(); }
    }
    for (const [y0, y1] of [[vy(2 / 7), vy(0)], [vy(1), vy(5 / 7)]]) {
      const mid = (y0 + y1) / 2;
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y0, W, (y1 - y0) * 0.12);
      g.fillStyle = '#7d8088'; g.font = '900 ' + Math.max(7, Math.round((y1 - y0) * 0.38)) + 'px Arial'; g.textBaseline = 'middle'; g.textAlign = 'left';
      for (let k = 0; k < 3; k++) g.fillText('ROCKET LEAGUE \u2022 RACING', (k / 3) * W + 4, mid);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const tireMat = () => sharedMat('tire', () => {
    const tex = tireTexture();
    if (q() === 'low') return new THREE.MeshPhongMaterial({ map: tex, shininess: 6, specular: 0x111111 });
    return new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.004, roughness: 0.9, metalness: 0, envMap: M.envMap, envMapIntensity: 0.4 });
  });
  const darkMat = () => sharedMat('dark', () => stdMat({ color: 0x1c1d22, roughness: 0.55, metalness: 0.4 }, 20));
  const glassMat = () => sharedMat('glass', () => stdMat({ color: 0x0d1424, roughness: 0.06, metalness: 0.3 }, 140));
  const headMat = () => sharedMat('head', () => new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
  const tailMat = () => sharedMat('tail', () => new THREE.MeshBasicMaterial({ color: 0xff2b2b }));

  let glitterTex = null;
  function getGlitter() {
    if (glitterTex) return glitterTex;
    const { c, g } = U.canvas(128, 128);
    const img = g.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) {
      img.data[i * 4] = 128 + (Math.random() - 0.5) * 200;
      img.data[i * 4 + 1] = 128 + (Math.random() - 0.5) * 200;
      img.data[i * 4 + 2] = 230; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    glitterTex = new THREE.CanvasTexture(c);
    glitterTex.wrapS = glitterTex.wrapT = THREE.RepeatWrapping;
    glitterTex.repeat.set(10, 5);
    return glitterTex;
  }

  function paintMaterial(finish, map) {
    const ql = q();
    if (ql === 'low') return new THREE.MeshPhongMaterial({ map, shininess: finish.shin, specular: finish.metal > 0.6 ? 0x999999 : 0x444444 });
    const opts = { map, metalness: finish.metal, roughness: finish.rough, envMap: M.envMap, envMapIntensity: finish.metal > 0.8 ? 1.3 : 1 };
    if (finish.glitter) { opts.normalMap = getGlitter(); opts.normalScale = new THREE.Vector2(0.6, 0.6); }
    if (ql === 'high' && (finish.clear || finish.irid)) {
      opts.clearcoat = finish.clear || 0;
      opts.clearcoatRoughness = 0.06;
      if (finish.irid) { opts.iridescence = finish.irid; opts.iridescenceIOR = 1.5; }
      return new THREE.MeshPhysicalMaterial(opts);
    }
    return new THREE.MeshStandardMaterial(opts);
  }

  // a paint finish on a downloaded model's paint: same values as the built-in bodies (the model's own
  // metalness/roughness maps are dropped so Matte is matte and Chrome is chrome)
  function finishModelPaint(m0, finish, color, finishCol) {
    const opts = { map: m0.map || null, normalMap: finish.glitter ? getGlitter() : m0.normalMap || null, aoMap: m0.aoMap || null, color: new THREE.Color(color),
      metalness: finish.metal, roughness: finish.rough, envMap: M.envMap, envMapIntensity: finish.metal > 0.8 ? 1.3 : 1, side: m0.side, transparent: m0.transparent, opacity: m0.opacity };
    if (finish.glitter) opts.normalScale = new THREE.Vector2(0.6, 0.6);
    let m;
    if (q() === 'high' && (finish.clear || finish.irid)) {
      m = new THREE.MeshPhysicalMaterial(Object.assign(opts, { clearcoat: finish.clear || 0, clearcoatRoughness: 0.06 }));
      if (finish.irid) { m.iridescence = finish.irid; m.iridescenceIOR = 1.5; }
    } else m = new THREE.MeshStandardMaterial(opts);
    // a painted finish tints the paint, like on the built-in bodies
    if (finishCol) m.color.multiply(new THREE.Color(finishCol).lerp(new THREE.Color(1, 1, 1), 0.55));
    m.name = m0.name;
    return m;
  }

  // ---------- decals ----------
  const DEC = {};
  DEC.none = () => {};
  DEC.neonpulse = (g, W, H, base, acc) => {
    g.fillStyle = acc;
    for (const y of [0.02, 0.1, 0.5, 0.62]) g.fillRect(0, H * y, W, H * 0.028);
    for (let x = 0; x < W; x += W / 12) g.fillRect(x, H * 0.3, W * 0.012, H * 0.25);
  };
  DEC.hyperdrive = (g, W, H, base, acc) => {
    g.fillStyle = acc;
    for (let i = 0; i < 9; i++) { const x = (i / 9) * W; g.beginPath(); g.moveTo(x, H * 0.25); g.lineTo(x + W * 0.06, H * 0.42); g.lineTo(x, H * 0.59); g.lineTo(x + W * 0.025, H * 0.59); g.lineTo(x + W * 0.085, H * 0.42); g.lineTo(x + W * 0.025, H * 0.25); g.fill(); }
    g.fillRect(0, 0, W, H * 0.04);
  };
  DEC.overload = (g, W, H, base, acc) => {
    g.strokeStyle = acc; g.lineWidth = H * 0.018; const rnd = U.rng(7);
    for (let k = 0; k < 7; k++) { let x = rnd() * W, y = H * (0.2 + rnd() * 0.5); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++) { x += W * 0.05; y += (rnd() - 0.5) * H * 0.14; g.lineTo(x, y); } g.stroke(); }
  };
  // more animated decals (they tile left-right so they can scroll along the body)
  DEC.flowstate = (g, W, H, base, acc) => {
    g.strokeStyle = acc; g.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      g.lineWidth = H * (0.012 + k * 0.004); g.beginPath();
      for (let x = 0; x <= W; x += W / 64) { const y = H * (0.16 + k * 0.1) + Math.sin((x / W) * Math.PI * 4 + k) * H * 0.04; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  };
  DEC.pulsar = (g, W, H, base, acc) => {
    g.strokeStyle = acc;
    for (let i = 0; i < 4; i++) { const cx = ((i + 0.5) / 4) * W, cy = H * 0.4; for (let r = 1; r <= 4; r++) { g.lineWidth = H * (0.008 + r * 0.003); g.beginPath(); g.arc(cx, cy, r * H * 0.06, 0, Math.PI * 2); g.stroke(); } }
  };
  DEC.heartbeat = (g, W, H, base, acc) => {
    g.strokeStyle = acc; g.lineWidth = H * 0.02; g.lineJoin = 'round';
    const y = H * 0.42, u = W / 4;
    g.beginPath(); g.moveTo(0, y);
    for (let i = 0; i < 4; i++) { const x = i * u; for (const [px, py] of [[0.35, 0], [0.42, -0.06], [0.48, 0.05], [0.55, -0.22], [0.62, 0.12], [0.68, 0], [1, 0]]) g.lineTo(x + u * px, y + H * py); }
    g.stroke();
  };
  DEC.tron = (g, W, H, base, acc) => {
    g.strokeStyle = acc; g.lineWidth = H * 0.008;
    for (let x = 0; x <= W; x += W / 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H * 0.7); g.stroke(); }
    for (let y = 0; y <= H * 0.7; y += H * 0.07) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  };
  DEC.storm = (g, W, H, base, acc) => {
    const rnd = U.rng(31);
    g.fillStyle = U.shade(base, 0.55);
    for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(rnd() * W, H * (0.1 + rnd() * 0.25), H * (0.05 + rnd() * 0.06), 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = acc; g.lineWidth = H * 0.014;
    for (let k = 0; k < 5; k++) { let x = rnd() * W, y = H * 0.2; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (rnd() - 0.5) * W * 0.05; y += H * 0.07; g.lineTo(x, y); } g.stroke(); }
  };
  DEC.hueshift = (g, W, H, base, acc) => {
    g.fillStyle = acc;
    for (let i = 0; i < 12; i++) {
      const x = (i / 12) * W;
      g.beginPath(); g.moveTo(x, H * 0.7); g.bezierCurveTo(x + W * 0.03, H * 0.45, x - W * 0.02, H * 0.25, x + W * 0.04, 0);
      g.lineTo(x + W * 0.055, 0); g.bezierCurveTo(x, H * 0.25, x + W * 0.05, H * 0.45, x + W * 0.025, H * 0.7); g.fill();
    }
  };
  // ---- the bigger set of animated decals: each tiles left-right (and up-down for the ones that rise or fall) ----
  // (anything crossing an edge is drawn again one width / height over, so the pattern has no seam when it scrolls)
  const tileDraw = (W, H, vert, fn) => { for (const dx of [-W, 0, W]) for (const dy of vert ? [-H, 0, H] : [0]) fn(dx, dy); };
  DEC.equalizer = (g, W, H, base, acc) => {
    const rnd = U.rng(41), n = 40, bw = W / n, top = U.shade(acc, 0.55);
    for (let i = 0; i < n; i++) {
      const h = 3 + Math.floor((0.5 + 0.5 * Math.sin(i * 0.7) * Math.cos(i * 0.23)) * 6 + rnd() * 4);
      for (let k = 0; k < h; k++) { g.fillStyle = k > h - 3 ? top : acc; g.fillRect(i * bw + bw * 0.12, H * 0.66 - (k + 1) * H * 0.045, bw * 0.76, H * 0.035); }
    }
  };
  DEC.galaxy = (g, W, H, base, acc) => {
    g.fillStyle = U.shade(base, -0.7); g.fillRect(0, 0, W, H);
    const rnd = U.rng(5);
    for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.15 ? acc : 'rgba(255,255,255,' + (0.3 + rnd() * 0.7) + ')'; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    tileDraw(W, H, false, (dx) => {
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 180; i++) {
        const t = i / 180, a = arm * Math.PI + t * Math.PI * 3.2, r = t * H * 0.42;
        const x = dx + W * 0.5 + Math.cos(a) * r * 1.7, y = H * 0.42 + Math.sin(a) * r * 0.55;
        g.fillStyle = i % 3 ? U.hexA(acc, 0.7 * (1 - t) + 0.2) : 'rgba(255,255,255,0.8)';
        g.beginPath(); g.arc(x, y, H * (0.012 + 0.02 * (1 - t)), 0, 7); g.fill();
      }
    });
    const gr = g.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, H * 0.12); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(W * 0.3, H * 0.2, W * 0.4, H * 0.45);
  };
  DEC.lavalamp = (g, W, H, base, acc) => {
    const rnd = U.rng(19);
    acc = acc === '#f5f5f5' ? '#ff6d00' : acc;
    for (let i = 0; i < 16; i++) {
      const x = rnd() * W, y = rnd() * H, r = H * (0.05 + rnd() * 0.09);
      tileDraw(W, H, true, (dx, dy) => {
        const gr = g.createRadialGradient(x + dx - r * 0.3, y + dy - r * 0.3, 0, x + dx, y + dy, r);
        gr.addColorStop(0, U.shade(acc, 0.5)); gr.addColorStop(0.7, acc); gr.addColorStop(1, U.hexA(acc, 0));
        g.fillStyle = gr; g.beginPath(); g.ellipse(x + dx, y + dy, r, r * 1.25, 0, 0, 7); g.fill();
      });
    }
  };
  DEC.synthwave = (g, W, H, base, acc) => {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.55); sky.addColorStop(0, '#1a0638'); sky.addColorStop(1, '#ff2d95');
    g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.55);
    for (const sx of [0.25, 0.75]) {
      const cx = W * sx, cy = H * 0.5, r = H * 0.26, sun = g.createLinearGradient(0, cy - r, 0, cy);
      sun.addColorStop(0, '#ffe66d'); sun.addColorStop(1, '#ff6b35');
      g.fillStyle = sun; g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.fill();
      g.fillStyle = '#ff2d95'; for (let k = 0; k < 5; k++) g.fillRect(cx - r, cy - r * (0.12 + k * 0.17), r * 2, r * 0.035 * (k + 1));
    }
    g.fillStyle = '#12002a'; g.fillRect(0, H * 0.55, W, H * 0.45);
    g.strokeStyle = acc === '#f5f5f5' ? '#00f0ff' : acc; g.lineWidth = H * 0.008;
    for (let k = 0; k < 8; k++) { const y = H * 0.55 + H * 0.45 * Math.pow(k / 8, 1.6); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x <= W; x += W / 24) { g.beginPath(); g.moveTo(x, H * 0.55); g.lineTo(x + (x % (W / 2) - W / 4) * 0.6, H); g.stroke(); }
  };
  DEC.datastream = (g, W, H, base, acc) => {
    const rnd = U.rng(77);
    g.strokeStyle = U.hexA(acc, 0.55); g.lineWidth = H * 0.008; g.lineJoin = 'round';
    for (let k = 0; k < 9; k++) { const y = H * (0.14 + k * 0.06); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += W / 16) g.lineTo(x, y + (Math.floor(x / (W / 16)) % 3 === 0 ? H * 0.02 : 0)); g.stroke(); }
    g.fillStyle = acc;
    for (let k = 0; k < 9; k++) for (let j = 0; j < 5; j++) { const y = H * (0.14 + k * 0.06), x = rnd() * W; g.fillRect(x, y - H * 0.012, W * 0.03, H * 0.024); }
    g.fillStyle = U.shade(acc, 0.6); for (let i = 0; i < 30; i++) g.fillRect(rnd() * W, H * (0.13 + Math.floor(rnd() * 9) * 0.06), W * 0.008, H * 0.03);
  };
  DEC.fizz = (g, W, H, base, acc) => {
    const rnd = U.rng(23);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H, r = H * (0.012 + rnd() * rnd() * 0.05);
      tileDraw(W, H, true, (dx, dy) => {
        g.strokeStyle = U.hexA(acc, 0.9); g.lineWidth = Math.max(1, r * 0.18); g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(x + dx - r * 0.35, y + dy - r * 0.35, r * 0.22, 0, 7); g.fill();
      });
    }
  };
  DEC.blizzard = (g, W, H, base, acc) => {
    const rnd = U.rng(61);
    const flake = (x, y, r, col) => {
      g.strokeStyle = col; g.lineWidth = Math.max(1, r * 0.16); g.lineCap = 'round';
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a); g.beginPath(); g.moveTo(x, y); g.lineTo(x + cx * r, y + cy * r); g.moveTo(x + cx * r * 0.55, y + cy * r * 0.55); g.lineTo(x + Math.cos(a + 0.6) * r * 0.85, y + Math.sin(a + 0.6) * r * 0.85); g.moveTo(x + cx * r * 0.55, y + cy * r * 0.55); g.lineTo(x + Math.cos(a - 0.6) * r * 0.85, y + Math.sin(a - 0.6) * r * 0.85); g.stroke(); }
    };
    for (let i = 0; i < 55; i++) { const x = rnd() * W, y = rnd() * H, r = H * (0.015 + rnd() * 0.04), col = rnd() < 0.3 ? acc : '#ffffff'; tileDraw(W, H, true, (dx, dy) => flake(x + dx, y + dy, r, col)); }
  };
  DEC.sakura = (g, W, H, base, acc) => {
    const rnd = U.rng(13), pink = acc === '#f5f5f5' ? '#ffb7d0' : acc;
    g.strokeStyle = '#3e2723'; g.lineWidth = H * 0.018; g.lineCap = 'round';
    tileDraw(W, H, false, (dx) => { g.beginPath(); g.moveTo(dx, H * 0.66); g.bezierCurveTo(dx + W * 0.3, H * 0.5, dx + W * 0.55, H * 0.72, dx + W, H * 0.58); g.stroke(); });
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = H * (0.05 + rnd() * 0.65), r = H * (0.014 + rnd() * 0.02), a = rnd() * 6.28;
      tileDraw(W, H, false, (dx) => {
        g.save(); g.translate(x + dx, y); g.rotate(a);
        g.fillStyle = rnd() < 0.5 ? pink : U.shade(pink, 0.5); g.beginPath(); g.ellipse(0, 0, r * 1.5, r * 0.8, 0, 0, 7); g.fill();
        g.restore();
      });
    }
  };
  DEC.tesla = (g, W, H, base, acc) => {
    const rnd = U.rng(97), col = acc === '#f5f5f5' ? '#9be7ff' : acc;
    const bolt = (x, y, len, ang, w, depth) => {
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < 8; i++) { x += Math.cos(ang) * len / 8 + (rnd() - 0.5) * len * 0.12; y += Math.sin(ang) * len / 8 + (rnd() - 0.5) * len * 0.12; g.lineTo(x, y); if (depth < 2 && rnd() < 0.25) { g.stroke(); bolt(x, y, len * 0.45, ang + (rnd() - 0.5) * 1.6, w * 0.6, depth + 1); g.beginPath(); g.moveTo(x, y); } }
      g.stroke();
    };
    g.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const x = (k / 6) * W, y = H * (0.2 + rnd() * 0.4); g.strokeStyle = U.hexA(col, 0.35); bolt(x, y, W * 0.22, (rnd() - 0.5) * 0.8, H * 0.03, 1); g.strokeStyle = '#ffffff'; bolt(x, y, W * 0.18, (rnd() - 0.5) * 0.8, H * 0.009, 0); g.strokeStyle = col; bolt(x, y + H * 0.01, W * 0.2, (rnd() - 0.5) * 0.8, H * 0.014, 0); }
  };
  DEC.radar = (g, W, H, base, acc) => {
    g.strokeStyle = U.hexA(acc, 0.35); g.lineWidth = H * 0.004;
    for (let x = 0; x <= W; x += W / 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H * 0.7); g.stroke(); }
    for (let y = 0; y <= H * 0.7; y += H * 0.06) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (const cx of [W * 0.25, W * 0.75]) {
      g.strokeStyle = acc; for (let r = 1; r <= 4; r++) { g.lineWidth = H * 0.008; g.beginPath(); g.arc(cx, H * 0.38, r * H * 0.075, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(cx - H * 0.33, H * 0.38); g.lineTo(cx + H * 0.33, H * 0.38); g.moveTo(cx, H * 0.05); g.lineTo(cx, H * 0.7); g.stroke();
      g.fillStyle = U.shade(acc, 0.6); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx + Math.cos(i * 2.1 + 0.4) * H * 0.18, H * 0.38 + Math.sin(i * 2.1 + 0.4) * H * 0.18, H * 0.014, 0, 7); g.fill(); }
    }
  };
  DEC.heartthrob = (g, W, H, base, acc) => {
    const col = acc === '#f5f5f5' ? '#ff4081' : acc, heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.45, y - s * 1.05, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s, y - s * 0.4, x, y + s * 0.35); g.fill(); };
    for (let i = 0; i < 8; i++) { g.fillStyle = col; heart((i + 0.5) / 8 * W, H * 0.44, H * 0.11); g.fillStyle = 'rgba(255,255,255,0.7)'; heart((i + 0.5) / 8 * W - H * 0.035, H * 0.38, H * 0.025); }
    g.fillStyle = U.hexA(col, 0.7); for (let i = 0; i < 16; i++) heart((i + 0.25) / 16 * W, H * (i % 2 ? 0.16 : 0.66), H * 0.035);
  };
  DEC.scanner = (g, W, H, base, acc) => {
    const col = acc === '#f5f5f5' ? '#ff1744' : acc;
    g.fillStyle = '#0b0b0e'; g.fillRect(0, H * 0.36, W, H * 0.13);
    for (let i = 0; i < 48; i++) { const x = (i / 48) * W, dd = Math.abs(i - 24) / 24, k = Math.max(0, 1 - dd * 5); g.fillStyle = k > 0 ? U.hexA(col, 0.25 + 0.75 * k) : U.hexA(col, 0.12); g.fillRect(x + W * 0.003, H * 0.385, W / 48 - W * 0.006, H * 0.08); }
    const gr = g.createRadialGradient(W * 0.5, H * 0.425, 0, W * 0.5, H * 0.425, W * 0.08); gr.addColorStop(0, U.hexA(col, 0.9)); gr.addColorStop(1, U.hexA(col, 0));
    g.fillStyle = gr; g.fillRect(W * 0.38, H * 0.3, W * 0.24, H * 0.25);
  };
  DEC.spectrum = (g, W, H, base) => {
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = 'hsl(' + (k * 48) + ',100%,58%)'; g.lineWidth = H * 0.04; g.beginPath();
      for (let x = 0; x <= W; x += 4) { const y = H * (0.18 + k * 0.065) + Math.sin((x / W) * Math.PI * 4) * H * 0.07; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  };
  DEC.neontiger = (g, W, H, base, acc) => {
    const col = acc === '#f5f5f5' ? '#ff9100' : acc;
    g.fillStyle = U.shade(base, -0.55); g.fillRect(0, 0, W, H);
    g.shadowColor = col; g.shadowBlur = H * 0.03; g.fillStyle = col;
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * W, y0 = H * 0.08;
      g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + W * 0.04, H * 0.3, x + W * 0.012, H * 0.62); g.lineTo(x + W * 0.03, H * 0.62); g.quadraticCurveTo(x + W * 0.055, H * 0.3, x + W * 0.02, y0); g.fill();
    }
    g.shadowBlur = 0;
  };
  DEC.ghostflames = (g, W, H, base, acc) => {
    // spectral flames licking back along the car, white-hot at the front, fading to the paint behind
    const rnd = U.rng(29), col = acc === '#f5f5f5' ? '#40c4ff' : acc;
    g.fillStyle = U.shade(base, -0.5); g.fillRect(0, 0, W, H);
    g.shadowColor = col; g.shadowBlur = H * 0.04;
    for (let k = 0; k < 3; k++) {
      const x0 = (k / 3) * W, len = W * 0.42;
      tileDraw(W, H, false, (dx) => {
        const gr = g.createLinearGradient(x0 + dx + len, 0, x0 + dx, 0);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, U.shade(col, 0.45)); gr.addColorStop(0.75, col); gr.addColorStop(1, U.hexA(col, 0));
        g.fillStyle = gr;
        for (let i = 0; i < 6; i++) {
          const y0 = H * (0.3 + i * 0.06), l = len * (0.55 + rnd() * 0.45), xe = x0 + dx + len;
          g.beginPath(); g.moveTo(xe, y0 - H * 0.035);
          g.bezierCurveTo(xe - len * 0.25, y0 - H * 0.09, xe - l * 0.7, y0 + H * 0.05, xe - l, y0 - H * 0.03);
          g.bezierCurveTo(xe - l * 0.6, y0 + H * 0.06, xe - len * 0.15, y0 + H * 0.07, xe, y0 + H * 0.045);
          g.fill();
        }
      });
    }
    g.shadowBlur = 0;
  };
  DEC.hexcore = (g, W, H, base, acc) => {
    const rnd = U.rng(83), r = H * 0.055, w = r * Math.sqrt(3), cols = Math.round(W / w);
    const rw = W / cols;
    for (let row = 0; row < 12; row++) for (let i = -1; i <= cols; i++) {
      const cx = i * rw + (row % 2 ? rw / 2 : 0), cy = row * r * 1.5 + r * 0.5;
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k / 6) * Math.PI * 2; g.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); } g.closePath();
      g.strokeStyle = U.hexA(acc, 0.5); g.lineWidth = H * 0.005; g.stroke();
      if (rnd() < 0.16) { g.fillStyle = U.hexA(acc, 0.35 + rnd() * 0.5); g.fill(); }
    }
  };
  DEC.cyclone = (g, W, H, base, acc) => {
    g.lineCap = 'round';
    tileDraw(W, H, false, (dx) => {
      for (const cx of [W * 0.25, W * 0.75]) for (let k = 0; k < 7; k++) {
        g.strokeStyle = k % 2 ? acc : U.shade(acc, 0.5); g.lineWidth = H * (0.008 + k * 0.002); g.beginPath();
        for (let t = 0; t <= 1; t += 0.02) { const a = t * Math.PI * 2.4 + k * 0.9, r = H * (0.04 + t * 0.32); const x = dx + cx + Math.cos(a) * r * 1.5, y = H * 0.38 + Math.sin(a) * r * 0.7; if (t) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
    });
  };
  DEC.dna = (g, W, H, base, acc) => {
    const y0 = H * 0.42, amp = H * 0.13, f = (x, ph) => y0 + Math.sin((x / W) * Math.PI * 6 + ph) * amp;
    g.strokeStyle = U.hexA('#ffffff', 0.6); g.lineWidth = H * 0.008;
    for (let x = 0; x < W; x += W / 36) { g.beginPath(); g.moveTo(x, f(x, 0)); g.lineTo(x, f(x, Math.PI)); g.stroke(); }
    for (const [ph, col] of [[0, acc], [Math.PI, U.shade(acc, 0.55)]]) { g.strokeStyle = col; g.lineWidth = H * 0.03; g.beginPath(); for (let x = 0; x <= W; x += 3) { if (x) g.lineTo(x, f(x, ph)); else g.moveTo(x, f(x, ph)); } g.stroke(); }
  };
  DEC.glitchy = (g, W, H, base, acc) => {
    const rnd = U.rng(3);
    for (let i = 0; i < 60; i++) { const x = rnd() * W, y = rnd() * H * 0.72, w = W * (0.02 + rnd() * 0.12), h = H * (0.01 + rnd() * 0.04); g.fillStyle = ['rgba(255,0,80,0.8)', 'rgba(0,255,230,0.8)', U.hexA(acc, 0.9), 'rgba(255,255,255,0.7)'][i % 4]; g.fillRect(x, y, w, h); if (x + w > W) g.fillRect(x - W, y, w, h); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += H / 60) g.fillRect(0, y, W, H / 160);
  };
  DEC.toxicdrip = (g, W, H, base, acc) => {
    const rnd = U.rng(51), col = acc === '#f5f5f5' ? '#76ff03' : acc;
    g.fillStyle = col; g.fillRect(0, 0, W, H * 0.06);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, len = H * (0.08 + rnd() * 0.42), w = W * (0.006 + rnd() * 0.01);
      tileDraw(W, H, false, (dx) => { g.fillStyle = col; g.fillRect(x + dx - w / 2, H * 0.05, w, len); g.beginPath(); g.arc(x + dx, H * 0.05 + len, w * 1.4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x + dx - w * 0.4, H * 0.05 + len - w * 0.3, w * 0.4, 0, 7); g.fill(); });
    }
  };
  DEC.checkerrun = (g, W, H, base, acc) => {
    const s = H * 0.05;
    for (let y = 0; y < 3; y++) for (let x = 0; x < W / s; x++) { g.fillStyle = (x + y) % 2 ? '#111111' : '#f5f5f5'; g.fillRect(x * s, H * 0.36 + y * s, s, s); }
    g.fillStyle = acc; for (let i = 0; i < 18; i++) g.fillRect((i / 18) * W, H * (i % 2 ? 0.26 : 0.56), W * 0.04, H * 0.014);
  };
  DEC.fireworkshow = (g, W, H, base, acc) => {
    const rnd = U.rng(71);
    g.fillStyle = U.shade(base, -0.6); g.fillRect(0, 0, W, H * 0.7);
    for (let b = 0; b < 7; b++) {
      const cx = ((b + 0.5) / 7) * W, cy = H * (0.18 + rnd() * 0.3), r = H * (0.1 + rnd() * 0.08), hue = Math.floor(rnd() * 360);
      g.lineCap = 'round';
      for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; g.strokeStyle = 'hsl(' + hue + ',100%,' + (55 + (k % 3) * 12) + '%)'; g.lineWidth = H * 0.008; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); g.fillStyle = '#ffffff'; g.fillRect(cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 1.08, 2, 2); }
    }
  };
  DEC.starfield = (g, W, H, base, acc) => {
    g.fillStyle = U.shade(base, -0.72); g.fillRect(0, 0, W, H);
    const rnd = U.rng(9);
    const u = W / 512;
    for (let i = 0; i < 420; i++) { const x = rnd() * W, y = rnd() * H, b = rnd(); g.fillStyle = b > 0.9 ? acc : 'rgba(255,255,255,' + (0.45 + b * 0.55) + ')'; const r = (b > 0.95 ? 3.2 : b > 0.7 ? 2.1 : 1.3) * u; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); if (b > 0.92) { g.fillRect(x - r * 3, y - 0.5 * u, r * 6, u); g.fillRect(x - 0.5 * u, y - r * 3, u, r * 6); } }
  };
  DEC.waveform = (g, W, H, base, acc) => {
    g.strokeStyle = acc; g.lineWidth = H * 0.018; g.lineJoin = 'round'; g.beginPath();
    for (let x = 0; x <= W; x += 2) { const t = (x / W) * Math.PI * 2, y = H * 0.42 + (Math.sin(t * 3) * 0.6 + Math.sin(t * 11) * 0.25 + Math.sin(t * 23) * 0.12) * H * 0.14; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    g.strokeStyle = U.hexA(acc, 0.35); g.lineWidth = H * 0.004; for (const y of [0.24, 0.6]) { g.beginPath(); g.moveTo(0, H * y); g.lineTo(W, H * y); g.stroke(); }
  };
  DEC.stripes = (g, W, H, base, acc) => {
    g.fillStyle = acc;
    g.fillRect(0, 0, W, H * 0.045); g.fillRect(0, H * 0.075, W, H * 0.045);
    g.fillRect(0, H * 0.66, W, H * 0.025);
  };
  DEC.twotone = (g, W, H, base, acc) => {
    g.fillStyle = acc; g.fillRect(0, H * 0.7, W, H * 0.3);
    g.fillStyle = U.shade(base, 0.5); g.fillRect(0, H * 0.68, W, H * 0.02);
  };
  DEC.number = (g, W, H, base, acc) => {
    g.fillStyle = acc; g.fillRect(0, 0, W, H * 0.05);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(W * 0.5, H * 0.66, H * 0.15, 0, Math.PI * 2); g.fill();
    g.fillStyle = acc === '#f5f5f5' ? '#111' : acc;
    g.font = 'bold ' + Math.round(H * 0.2) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('07', W * 0.5, H * 0.665);
  };
  DEC.checker = (g, W, H, base, acc) => {
    const s = H / 14;
    for (let y = H * 0.68; y < H * 0.92; y += s) for (let x = 0; x < W; x += s) {
      if ((Math.floor(x / s) + Math.floor(y / s)) % 2) { g.fillStyle = acc; g.fillRect(x, y, s, s); }
    }
    for (let y = 0; y < H * 0.12; y += s) for (let x = 0; x < W; x += s) {
      if ((Math.floor(x / s) + Math.floor(y / s)) % 2) { g.fillStyle = acc; g.fillRect(x, y, s, s); }
    }
  };
  function flames(g, W, H, acc, off, rnd) {
    const grd = g.createLinearGradient(W, 0, W * 0.3, 0);
    grd.addColorStop(0, '#fff176'); grd.addColorStop(0.35, '#ffb300'); grd.addColorStop(1, acc);
    g.fillStyle = grd;
    for (let i = 0; i < 7; i++) {
      const y0 = H * (0.5 + i * 0.05), len = W * (0.35 + rnd() * 0.3);
      g.beginPath();
      g.moveTo(W + off, y0 - H * 0.04);
      g.bezierCurveTo(W * 0.8 + off, y0 - H * 0.1, W - len * 0.7 + off, y0 + H * 0.05, W - len + off, y0 - H * 0.03);
      g.bezierCurveTo(W - len * 0.6 + off, y0 + H * 0.06, W * 0.85 + off, y0 + H * 0.08, W + off, y0 + H * 0.05);
      g.fill();
    }
  }
  DEC.flames = (g, W, H, base, acc) => flames(g, W, H, acc === '#f5f5f5' ? '#ff3d00' : acc, 0, U.rng(7));
  DEC.zigzag = (g, W, H, base, acc) => {
    g.strokeStyle = acc; g.lineWidth = H * 0.05; g.lineJoin = 'miter';
    for (const yc of [H * 0.64, H * 0.06]) {
      g.beginPath();
      for (let x = 0, i = 0; x <= W + 20; x += W / 16, i++) g.lineTo(x, yc + (i % 2 ? -1 : 1) * H * 0.04);
      g.stroke();
    }
  };
  DEC.lightning = (g, W, H, base, acc) => {
    const rnd = U.rng(3);
    g.shadowColor = acc; g.shadowBlur = H * 0.04;
    g.strokeStyle = '#ffffff'; g.lineWidth = H * 0.018;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      let x = W, y = H * (0.5 + k * 0.12);
      g.moveTo(x, y);
      while (x > 0) { x -= W * (0.04 + rnd() * 0.06); y += (rnd() - 0.5) * H * 0.15; g.lineTo(x, y); }
      g.stroke();
    }
    g.shadowBlur = 0;
  };
  DEC.camo = (g, W, H, base, acc) => {
    const rnd = U.rng(11), cols = [U.shade(base, -0.45), acc, U.shade(base, 0.25)];
    for (let i = 0; i < 90; i++) {
      g.fillStyle = cols[i % 3];
      g.beginPath();
      g.ellipse(rnd() * W, rnd() * H, H * (0.04 + rnd() * 0.07), H * (0.03 + rnd() * 0.05), rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  };
  DEC.tiger = (g, W, H, base, acc) => {
    const rnd = U.rng(5);
    g.fillStyle = acc === '#f5f5f5' ? '#111' : acc;
    for (let x = W * 0.05; x < W; x += W * 0.07) {
      g.beginPath();
      const y0 = H * (0.35 + rnd() * 0.2);
      g.moveTo(x, y0);
      g.quadraticCurveTo(x + W * 0.05, H * 0.6, x - W * 0.01, H * 0.95);
      g.quadraticCurveTo(x + W * 0.02, H * 0.6, x + W * 0.015, y0 - H * 0.02);
      g.fill();
      g.beginPath();
      g.moveTo(x, H * 0.02); g.quadraticCurveTo(x + W * 0.03, H * 0.12, x + W * 0.01, H * 0.25); g.lineTo(x + W * 0.02, H * 0.02); g.fill();
    }
  };
  DEC.splatter = (g, W, H, base, acc) => {
    const rnd = U.rng(9);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = i % 3 === 0 ? '#ffffff' : acc;
      const x = rnd() * W, y = rnd() * H, r = H * (0.015 + rnd() * 0.06);
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * r * 4, y + (rnd() - 0.5) * r * 4, r * rnd() * 0.35, 0, Math.PI * 2); g.fill(); }
      g.fillRect(x - r * 0.15, y, r * 0.3, r * (1 + rnd() * 2));
    }
  };
  DEC.hex = (g, W, H, base, acc) => {
    const s = H * 0.06, rnd = U.rng(2);
    g.strokeStyle = acc; g.lineWidth = H * 0.008;
    for (let row = 0; row * s * 1.5 < H + s; row++) for (let col = 0; col * s * 1.732 < W + s; col++) {
      const cx = col * s * 1.732 + (row % 2) * s * 0.866, cy = row * s * 1.5;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); }
      g.closePath();
      if (rnd() < 0.15) { g.fillStyle = U.hexA(acc, 0.55); g.fill(); }
      g.stroke();
    }
  };
  DEC.circuit = (g, W, H, base, acc) => {
    const rnd = U.rng(4);
    g.strokeStyle = acc; g.fillStyle = acc; g.lineWidth = H * 0.008;
    for (let i = 0; i < 60; i++) {
      let x = rnd() * W, y = rnd() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { if (rnd() < 0.5) x += (rnd() - 0.5) * W * 0.2; else y += (rnd() - 0.5) * H * 0.3; g.lineTo(x, y); }
      g.stroke();
      g.beginPath(); g.arc(x, y, H * 0.012, 0, Math.PI * 2); g.fill();
    }
  };
  DEC.carbon = (g, W, H, base, acc) => {
    g.fillStyle = '#17181b'; g.fillRect(0, 0, W, H);
    const s = Math.max(2, Math.round(H / 64));
    for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) {
      g.fillStyle = ((x / s + y / s) % 2) ? '#24262b' : '#101113';
      g.fillRect(x, y, s, s);
    }
    g.fillStyle = base; g.fillRect(0, H * 0.62, W, H * 0.05); g.fillRect(0, 0, W, H * 0.03); g.fillRect(0, H * 0.92, W, H * 0.08);
  };
  DEC.scales = (g, W, H, base, acc) => {
    const s = H * 0.05;
    g.strokeStyle = U.shade(base, -0.5); g.lineWidth = H * 0.008;
    for (let row = 0; row * s < H + s; row++) for (let col = 0; col * s * 2 < W + s; col++) {
      const cx = col * s * 2 + (row % 2) * s, cy = row * s;
      g.fillStyle = (row + col) % 4 === 0 ? acc : U.shade(base, (row % 3) * 0.08);
      g.beginPath(); g.arc(cx, cy, s, 0, Math.PI); g.fill(); g.stroke();
    }
  };
  DEC.nebula = (g, W, H, base, acc) => {
    g.fillStyle = '#07030f'; g.fillRect(0, 0, W, H);
    const rnd = U.rng(21);
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W, y = rnd() * H, r = H * (0.2 + rnd() * 0.4);
      // (drawn either side too: it joins up as it flows along the car)
      for (const ox of [-W, 0, W]) {
        const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        gr.addColorStop(0, U.hexA(i % 2 ? base : acc, 0.55)); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 160; i++) g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    g.fillStyle = base; g.fillRect(0, H * 0.93, W, H * 0.07);
  };
  DEC.warp = (g, W, H, base, acc) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0a0620'); gr.addColorStop(0.55, '#05030f'); gr.addColorStop(1, '#0c0418');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rnd = U.rng(5);
    g.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H * 0.92, len = W * (0.02 + rnd() * 0.07);
      g.strokeStyle = i % 3 ? '#ffffff' : acc === '#f5f5f5' ? base : acc; g.globalAlpha = 0.35 + rnd() * 0.6; g.lineWidth = Math.max(1, H * (0.002 + rnd() * 0.006));
      for (const ox of [0, -W]) { g.beginPath(); g.moveTo(x + ox, y); g.lineTo(x + ox + len, y); g.stroke(); }
    }
    g.globalAlpha = 1;
    g.fillStyle = base; g.fillRect(0, H * 0.93, W, H * 0.07);
  };
  DEC.molten = (g, W, H, base, acc) => {
    const hot = acc === '#f5f5f5' ? '#ff5a14' : acc, rnd = U.rng(31), walks = [];
    g.fillStyle = '#120907'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(60,40,32,0.35)' : 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(rnd() * W, rnd() * H, H * (0.01 + rnd() * 0.04), 0, 7); g.fill(); }
    // cracks: wandering lines that join up round the car, a wide hot glow under a thin bright core
    for (let k = 0; k < 16; k++) {
      let x = rnd() * W, y = rnd() * H * 0.9, a = rnd() * 6.3;
      const pts = [[x, y]];
      for (let j = 0; j < 12; j++) { a += (rnd() - 0.5) * 1.4; x += Math.cos(a) * W * 0.03; y += Math.sin(a) * H * 0.06; pts.push([x, y]); }
      walks.push(pts);
    }
    const cracks = (col, w) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round';
      for (const pts of walks) for (const ox of [-W, 0, W]) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + ox, p[1]) : g.moveTo(p[0] + ox, p[1]))); g.stroke(); }
    };
    cracks(U.hexA(hot, 0.25), H * 0.05); cracks(U.hexA(hot, 0.8), H * 0.018); cracks('#ffe9a8', Math.max(1, H * 0.006));
    g.fillStyle = base; g.fillRect(0, H * 0.93, W, H * 0.07);
  };
  DEC.aurora = (g, W, H, base, acc) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#04101f'); gr.addColorStop(0.7, '#061a26'); gr.addColorStop(1, '#03090f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rnd = U.rng(17), cols = ['#39ffb0', '#3fd2ff', '#b06bff'], step = Math.max(2, W / 340);
    // curtains of light: whole waves round the car, so they join up as they drift
    for (let k = 0; k < 4; k++) {
      const col = k === 3 && acc !== '#f5f5f5' ? acc : cols[k % 3], f1 = 1 + k, f2 = 3 + k, p1 = rnd() * 6.3, p2 = rnd() * 6.3, y0 = H * (0.22 + k * 0.11);
      for (let x = 0; x < W; x += step) {
        const u = (x / W) * 6.2832, y = y0 + Math.sin(u * f1 + p1) * H * 0.09 + Math.sin(u * f2 + p2) * H * 0.04, h = H * (0.18 + 0.14 * (0.5 + 0.5 * Math.sin(u * f2 + p1)));
        const c = g.createLinearGradient(0, y, 0, y + h);
        c.addColorStop(0, U.hexA(col, 0)); c.addColorStop(0.25, U.hexA(col, 0.5)); c.addColorStop(1, U.hexA(col, 0));
        g.fillStyle = c; g.fillRect(x, y, step + 1, h);
      }
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i++) g.fillRect(rnd() * W, rnd() * H * 0.9, 1 + rnd(), 1 + rnd());
    g.fillStyle = base; g.fillRect(0, H * 0.93, W, H * 0.07);
  };
  DEC.inferno = (g, W, H, base, acc) => {
    g.fillStyle = U.shade(base, -0.55); g.fillRect(0, 0, W, H);
    const rnd = U.rng(13);
    flames(g, W, H, base, 0, rnd); flames(g, W, H, base, -W * 0.5, rnd); flames(g, W, H, base, W * 0.5, rnd);
  };
  DEC.prism = (g, W, H, base) => {
    for (let i = 0; i < 12; i++) {
      g.fillStyle = 'hsla(' + (i * 30) + ',100%,60%,0.75)';
      g.beginPath();
      const x = (i / 12) * W * 2 - W * 0.5;
      g.moveTo(x, 0); g.lineTo(x + W / 12, 0); g.lineTo(x + W / 12 - W * 0.25, H); g.lineTo(x - W * 0.25, H); g.fill();
    }
    g.fillStyle = base; g.fillRect(0, H * 0.62, W, H * 0.04);
  };
  DEC.coderain = (g, W, H, base) => {
    g.fillStyle = '#020a04'; g.fillRect(0, 0, W, H);
    const rnd = U.rng(31), fs = Math.max(6, Math.round(H / 22));
    g.font = fs + 'px monospace';
    for (let x = 0; x < W; x += fs * 0.8) {
      for (let y = 0; y < H; y += fs) {
        const a = rnd();
        g.fillStyle = a > 0.85 ? '#d7ffd9' : (a > 0.4 ? U.hexA(base, 0.9) : 'rgba(0,255,90,0.55)');
        g.fillText(String.fromCharCode(0x30A0 + Math.floor(rnd() * 90)), x, y);
      }
    }
  };

  DEC.s1 = (g, W, H, base, acc) => {
    g.fillStyle = '#ff6a00'; g.fillRect(0, H * 0.6, W, H * 0.035);
    g.fillStyle = acc; g.fillRect(0, H * 0.645, W, H * 0.015);
    g.font = 'italic 900 ' + Math.round(H * 0.24) + 'px "Russo One", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = H * 0.02; g.strokeStyle = '#111'; g.strokeText('S1', W * 0.47, H * 0.79);
    g.fillStyle = '#ff6a00'; g.fillText('S1', W * 0.47, H * 0.79);
    g.fillStyle = acc; g.fillRect(W * 0.1, 0, W * 0.8, H * 0.03);
  };
  function chevrons(g, W, H, color, off, glow) {
    g.fillStyle = color;
    if (glow) { g.shadowColor = color; g.shadowBlur = H * 0.04; }
    const step = W / 9;
    for (let x = -step + (off % step); x < W + step; x += step) {
      for (const [yc, hh] of [[H * 0.78, H * 0.14], [H * 0.08, H * 0.08]]) {
        g.beginPath();
        g.moveTo(x, yc - hh); g.lineTo(x + step * 0.45, yc); g.lineTo(x, yc + hh);
        g.lineTo(x - step * 0.2, yc + hh); g.lineTo(x + step * 0.25, yc); g.lineTo(x - step * 0.2, yc - hh);
        g.closePath(); g.fill();
      }
    }
    g.shadowBlur = 0;
  }
  DEC.chevron = (g, W, H, base, acc) => chevrons(g, W, H, acc, 0, false);
  DEC.ignition = (g, W, H, base) => {
    g.fillStyle = U.shade(base, -0.6); g.fillRect(0, 0, W, H);
    chevrons(g, W, H, '#ff9100', 0, true);
    g.globalAlpha = 0.6; chevrons(g, W, H, '#ffea00', W / 18, true); g.globalAlpha = 1;
    g.fillStyle = base; g.fillRect(0, H * 0.6, W, H * 0.04);
  };
  DEC.waves = (g, W, H, base, acc) => {
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = k % 2 ? acc : U.shade(base, -0.35); g.lineWidth = H * 0.03;
      g.beginPath();
      for (let x = 0; x <= W; x += 4) g.lineTo(x, H * (0.45 + k * 0.1) + Math.sin(x / W * Math.PI * 6 + k) * H * 0.04);
      g.stroke();
    }
    g.fillStyle = acc; g.fillRect(0, 0, W, H * 0.04);
  };
  DEC.pixel = (g, W, H, base, acc) => {
    const rnd = U.rng(17), s = Math.max(4, Math.round(H / 20));
    const cols = [U.shade(base, -0.35), U.shade(base, 0.2), acc, U.shade(base, -0.15)];
    for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) if (rnd() < 0.45) { g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(x, y, s, s); }
  };
  DEC.stars = (g, W, H, base, acc) => {
    const rnd = U.rng(23);
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ffffff' : acc; g.fillRect(0, H * (0.62 + i * 0.07), W, H * 0.035); }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const x = rnd() * W, y = rnd() * H * 0.55, r = H * (0.015 + rnd() * 0.02);
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    }
  };

  // baked shading + panel lines + badges so every car looks finished
  function detail(g, W, H, s, base) {
    let gr = g.createLinearGradient(0, H, 0, H * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, H * 0.62, W, H * 0.38);
    gr = g.createLinearGradient(0, H * 0.36, 0, H * 0.46);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, H * 0.36, W, H * 0.1);
    gr = g.createLinearGradient(0, H * 0.3, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.1)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.3);
    if (!s) return;
    const uOf = (u) => ((u + s.L / 2) / s.L) * W;
    const line = Math.max(1, W / 400);
    const seam = (x, y0, y1) => {
      g.lineWidth = line;
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + line, y0); g.lineTo(x + line, y1); g.stroke();
    };
    if (!s.open) {
      const doorF = uOf(s.f.u - s.f.r - 0.06), doorR = uOf(s.r.u + s.r.r + 0.05);
      seam(doorF, H * 0.42, H * 0.9);
      seam(doorR, H * 0.42, H * 0.9);
      if (s.cabin && s.cabin.w > 0.75) seam((doorF + doorR) / 2, H * 0.42, H * 0.88);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(doorR + W * 0.012, H * 0.47, W * 0.035, H * 0.012);
      seam(uOf(s.hoodU + 0.02), H * 0.02, H * 0.3);
      seam(uOf(s.deck.u - 0.03), H * 0.02, H * 0.3);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.beginPath(); g.arc(uOf(s.r.u - 0.02), H * 0.5, H * 0.022, 0, Math.PI * 2); g.stroke();
    }
    g.font = '700 ' + Math.round(H * 0.035) + 'px Arial'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText('ROCKET LEAGUE', uOf(s.r.u + s.r.r * 0.2), H * 0.86);
    if (!s.loft) {
      const bx = uOf(s.L / 2 - 0.06), by = H * 0.06;
      g.fillStyle = '#d9dde4'; g.beginPath(); g.arc(bx, by, H * 0.028, 0, Math.PI * 2); g.fill();
      g.fillStyle = U.shade(base, -0.4); g.beginPath(); g.arc(bx, by, H * 0.018, 0, Math.PI * 2); g.fill();
    }
  }

  // A painted decal: the pattern itself takes the paint, keeping its own light and dark, so every decal can be
  // painted (even the ones drawn in fixed colours, like Prismatic). d holds the pattern drawn over a flat base and
  // d0 the base alone; returns nothing, recolours d in place (alpha = where the pattern is).
  const hexRGB = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function tintPattern(d, d0, paint, keepAlpha) {
    const [pr, pg, pb] = hexRGB(paint);
    for (let i = 0; i < d.length; i += 4) {
      const diff = Math.abs(d[i] - d0[i]) + Math.abs(d[i + 1] - d0[i + 1]) + Math.abs(d[i + 2] - d0[i + 2]);
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, k = 0.3 + 0.9 * l, lift = l * 26;
      d[i] = Math.min(255, pr * k + lift); d[i + 1] = Math.min(255, pg * k + lift); d[i + 2] = Math.min(255, pb * k + lift);
      if (!keepAlpha) d[i + 3] = Math.min(255, diff * 32);
    }
  }
  function paintedPattern(pattern, base, accent, paint, W, H) {
    const a = U.canvas(W, H), b = U.canvas(W, H);
    for (const k of [a, b]) { k.g.fillStyle = base; k.g.fillRect(0, 0, W, H); }
    DEC[pattern](a.g, W, H, base, accent);
    const img = a.g.getImageData(0, 0, W, H);
    tintPattern(img.data, b.g.getImageData(0, 0, W, H).data, paint);
    a.g.putImageData(img, 0, 0);
    return a.c;
  }
  const VSCROLL = new Set(['lavalamp', 'fizz', 'blizzard']);
  // other files add decal patterns (js/songpass.js paints the song decals)
  M.registerDecal = (name, fn) => { DEC[name] = fn; };
  M.decalCanvas = function (pattern, base, accent, style, paint) {
    const W = q() === 'low' ? 256 : q() === 'high' ? 1024 : 512, H = W / 2;
    const { c, g } = U.canvas(W, H);
    const grd = g.createLinearGradient(0, H, 0, 0);
    grd.addColorStop(0, U.shade(base, -0.3)); grd.addColorStop(0.55, base); grd.addColorStop(1, U.shade(base, 0.1));
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    if (q() !== 'low') {
      const rnd = U.rng(99);
      for (let i = 0; i < W * 2; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
    }
    if (paint && DEC[pattern] && pattern !== 'none') g.drawImage(paintedPattern(pattern, base, accent, paint, W, H), 0, 0);
    else (DEC[pattern] || DEC.none)(g, W, H, base, accent);
    // (the ones that scroll up or down don't get the baked shading: it would scroll with them)
    if (!VSCROLL.has(pattern)) detail(g, W, H, style, base);
    return c;
  };

  // The real car models (Octane, Fennec, Dominus...) have their own UVs, so a decal is laid over their paint by
  // projection instead: the same wrap as the built-in bodies (across = rear to front, down = from the roof line
  // over the sides to the underside). Only the pattern is drawn here (alpha = where it differs from the paint),
  // so the model's own paint shading shows through around it.
  M.decalOverlay = function (pattern, base, accent, paint) {
    if (!pattern || pattern === 'none' || !DEC[pattern]) return null;
    const W = q() === 'high' ? 1024 : 512, H = W / 2;
    const a = U.canvas(W, H), b = U.canvas(W, H);
    for (const k of [a, b]) { k.g.fillStyle = base; k.g.fillRect(0, 0, W, H); }
    DEC[pattern](a.g, W, H, base, accent);
    const img = a.g.getImageData(0, 0, W, H), d = img.data, d0 = b.g.getImageData(0, 0, W, H).data;
    if (paint) tintPattern(d, d0, paint);
    else for (let i = 0; i < d.length; i += 4) {
      const diff = Math.abs(d[i] - d0[i]) + Math.abs(d[i + 1] - d0[i + 1]) + Math.abs(d[i + 2] - d0[i + 2]);
      d[i + 3] = Math.min(255, diff * 32);
    }
    a.g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(a.c);
    tex.premultiplyAlpha = true; // clean edges: transparent pixels carry no colour
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (BL.App && BL.App.renderer) tex.anisotropy = Math.min(8, BL.App.renderer.capabilities.getMaxAnisotropy());
    return tex;
  };
  // The star layers over the space decals on the real models (shared by every car): stars in red, the same stars as
  // long streaks in green, so near top speed they stretch out with one texture read.
  let starTex = null;
  function starLayer() {
    if (starTex) return starTex;
    const W = q() === 'high' ? 1024 : 512, H = W / 2, { c, g } = U.canvas(W, H), rnd = U.rng(77);
    g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 230; i++) {
      const x = rnd() * W, y = rnd() * H, b = Math.round(90 + rnd() * 165), r = (W / 512) * (0.6 + rnd() * rnd() * 1.6), len = W * (0.04 + rnd() * 0.08);
      g.fillStyle = `rgb(${b},0,0)`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (i % 3) continue;
      // (every third star leaves a thin streak, fading away toward the front of the car)
      for (const ox of [0, -W]) {
        const gr = g.createLinearGradient(x + ox, 0, x + ox + len, 0);
        gr.addColorStop(0, `rgb(0,${b},0)`); gr.addColorStop(1, 'rgb(0,0,0)');
        g.fillStyle = gr; g.fillRect(x + ox, y - r * 0.35, len, Math.max(1, r * 0.7));
      }
    }
    starTex = new THREE.CanvasTexture(c);
    starTex.wrapS = starTex.wrapT = THREE.RepeatWrapping;
    starTex.userData.shared = true;
    return starTex;
  }
  // an object's bounds in car-body space (toBody = inverse of the body's world matrix)
  M.bodySpaceBox = function (root, toBody) {
    const box = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(tmp.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(toBody, o.matrixWorld)));
    });
    return box;
  };
  // adds the projected decal to a model's paint material. rel: mesh -> car body space; box: the car in body space;
  // cell (optional): [u0, v0, u1, v1], the decal only shows where the texture's UVs fall in it (a palette's paint swatch)
  // stars (optional): the star layers, drifting over the decal at their own rates (decalStarOff: near xy, far zw)
  M.projectDecal = function (mat, tex, rel, box, anim, cell, stars) {
    const sz = box.getSize(new V3());
    const u = {
      decalCell: { value: cell ? new THREE.Vector4().fromArray(cell) : new THREE.Vector4() },
      decalMap: { value: tex }, decalMat: { value: rel.clone() }, decalOff: { value: anim ? anim.offset : new THREE.Vector2() },
      decalGlow: { value: 0 }, decalTint: { value: new THREE.Color(1, 1, 1) },
      decalB: { value: new THREE.Vector4(box.min.z, 1 / Math.max(0.01, sz.z), box.min.y + sz.y * 0.5, 0) },
      decalS: { value: new THREE.Vector2(2 / Math.max(0.01, sz.x), 2 / Math.max(0.01, sz.y)) },
    };
    if (stars) { u.decalStars = { value: stars }; u.decalStarOff = { value: new THREE.Vector4() }; u.decalWarp = { value: 0 }; }
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 decalMat; varying vec3 vDecalP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDecalP = (decalMat * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = (stars ? '#define DECAL_STARS\n' : '') + sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D decalMap; uniform vec4 decalB; uniform vec4 decalCell; uniform vec2 decalS; uniform vec2 decalOff; uniform float decalGlow; uniform vec3 decalTint; varying vec3 vDecalP; vec3 decalEm = vec3(0.0); vec3 decalStar = vec3(0.0);\n#ifdef DECAL_STARS\nuniform sampler2D decalStars; uniform vec4 decalStarOff; uniform float decalWarp;\n#endif')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += decalEm * decalGlow * decalTint + decalStar * (0.5 + 0.5 * decalGlow);')
        .replace('#include <map_fragment>', [
          '#include <map_fragment>',
          '{',
          '  float dU = (vDecalP.z - decalB.x) * decalB.y;',
          '  float dTh = atan(vDecalP.x * decalS.x, (vDecalP.y - decalB.z) * decalS.y);',
          '  vec2 dUV = vec2(dU, 1.0 - abs(dTh) / PI);',
          '  vec4 dC = texture2D(decalMap, dUV + decalOff);',
          '  #ifdef USE_MAP',
          '  if (decalCell.z > 0.0) dC *= step(decalCell.x, vUv.x) * step(vUv.x, decalCell.z) * step(decalCell.y, vUv.y) * step(vUv.y, decalCell.w);',
          '  #endif',
          '  diffuseColor.rgb = diffuseColor.rgb * (1.0 - dC.a) + dC.rgb;',
          '  decalEm = dC.rgb;',
          '  #ifdef DECAL_STARS',
          '  vec2 sN = texture2D(decalStars, dUV + decalStarOff.xy).rg, sF = texture2D(decalStars, dUV * 1.9 + decalStarOff.zw).rg;',
          '  decalStar = vec3(0.9, 0.95, 1.0) * dC.a * (mix(sN.r, sN.g, decalWarp) + 0.5 * mix(sF.r, sF.g, decalWarp * 0.7));',
          '  diffuseColor.rgb += decalStar * 0.35;',
          '  #endif',
          '}',
        ].join('\n'));
    };
    mat.customProgramCacheKey = () => (stars ? 'decal-stars' : 'decal');
    mat.needsUpdate = true;
    return u;
  };

  // wheel decal rings (transparent canvas, drawn once per pattern + colour)
  const ringCache = {};
  M.wheelDecalCanvas = function (def, color) {
    const key = def.id + ':' + color;
    if (ringCache[key]) return ringCache[key];
    const S = 256, { c, g } = U.canvas(S, S), cx = S / 2, R0 = S * 0.36, R1 = S * 0.49;
    g.translate(cx, cx);
    const ringPath = () => { g.beginPath(); g.arc(0, 0, R1, 0, Math.PI * 2); g.arc(0, 0, R0, 0, Math.PI * 2, true); };
    g.fillStyle = color; g.strokeStyle = color;
    switch (def.ring) {
      case 'letters': {
        g.font = 'bold ' + Math.round(S * 0.075) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const word = 'ROCKET LEAGUE  •  ROCKET LEAGUE  •  ';
        for (let i = 0; i < word.length; i++) { g.save(); g.rotate((i / word.length) * Math.PI * 2); g.fillText(word[i], 0, -(R0 + R1) / 2); g.restore(); }
        break;
      }
      case 'line': g.lineWidth = S * 0.025; g.beginPath(); g.arc(0, 0, R0 + (R1 - R0) * 0.45, 0, Math.PI * 2); g.stroke(); break;
      case 'band': g.lineWidth = (R1 - R0) * 0.55; g.beginPath(); g.arc(0, 0, (R0 + R1) / 2, 0, Math.PI * 2); g.stroke(); break;
      case 'dashes': g.lineWidth = (R1 - R0) * 0.4; g.setLineDash([S * 0.05, S * 0.035]); g.beginPath(); g.arc(0, 0, (R0 + R1) / 2, 0, Math.PI * 2); g.stroke(); break;
      case 'flames':
        for (let i = 0; i < 12; i++) {
          g.save(); g.rotate((i / 12) * Math.PI * 2); g.beginPath();
          g.moveTo(-S * 0.035, -R1); g.quadraticCurveTo(S * 0.06, -(R0 + R1) / 2, S * 0.012, -R0 + 2); g.quadraticCurveTo(S * 0.0, -(R0 + R1) / 2, -S * 0.035, -R1);
          g.fill(); g.restore();
        }
        break;
      case 'stars':
        for (let i = 0; i < 9; i++) {
          g.save(); g.rotate((i / 9) * Math.PI * 2); g.translate(0, -(R0 + R1) / 2); g.beginPath();
          for (let k = 0; k < 10; k++) { const r = k % 2 ? S * 0.022 : S * 0.05, a = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
          g.closePath(); g.fill(); g.restore();
        }
        break;
      case 'checker': {
        const n = 36;
        for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
          if ((i + j) % 2) continue;
          const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, r0 = R0 + (R1 - R0) * j / 2, r1 = R0 + (R1 - R0) * (j + 1) / 2;
          g.beginPath(); g.arc(0, 0, r1, a0, a1); g.arc(0, 0, r0, a1, a0, true); g.closePath(); g.fill();
        }
        break;
      }
      case 'neon': g.shadowColor = color; g.shadowBlur = S * 0.05; g.lineWidth = S * 0.03; g.beginPath(); g.arc(0, 0, R0 + (R1 - R0) * 0.35, 0, Math.PI * 2); g.stroke(); g.stroke(); break;
      case 'tiger':
        ringPath(); g.save(); g.clip();
        for (let i = 0; i < 16; i++) { g.save(); g.rotate((i / 16) * Math.PI * 2); g.beginPath(); g.moveTo(-S * 0.02, -R1 - 4); g.lineTo(S * 0.03, -R1 - 4); g.lineTo(S * 0.005, -R0 + S * 0.02); g.closePath(); g.fill(); g.restore(); }
        g.restore();
        break;
      case 'polka': for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, r = (R0 + R1) / 2; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, (R1 - R0) * 0.28, 0, 7); g.fill(); } break;
      case 'barcode': for (let i = 0; i < 90; i++) { if ((i * 7) % 5 < 2) continue; g.save(); g.rotate((i / 90) * Math.PI * 2); g.fillRect(-S * 0.004 * (1 + (i % 3)), -R1, S * 0.008 * (1 + (i % 3)), (R1 - R0) * 0.8); g.restore(); } break;
      case 'bolts': g.lineWidth = S * 0.018; g.lineJoin = 'miter'; g.beginPath(); for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, r = i % 2 ? R0 + (R1 - R0) * 0.2 : R1 - (R1 - R0) * 0.15; if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); break;
      case 'wave': g.lineWidth = S * 0.02; for (const o of [0, 0.5]) { g.beginPath(); for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2, r = (R0 + R1) / 2 + Math.sin(a * 10 + o * Math.PI) * (R1 - R0) * 0.3; if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.globalAlpha = o ? 0.5 : 1; g.stroke(); } g.globalAlpha = 1; break;
      case 'hearts': for (let i = 0; i < 12; i++) { g.save(); g.rotate((i / 12) * Math.PI * 2); g.translate(0, -(R0 + R1) / 2); const s = (R1 - R0) * 0.42; g.beginPath(); g.moveTo(0, s * 0.35); g.bezierCurveTo(-s, -s * 0.4, -s * 0.45, -s * 1.05, 0, -s * 0.45); g.bezierCurveTo(s * 0.45, -s * 1.05, s, -s * 0.4, 0, s * 0.35); g.fill(); g.restore(); } break;
      case 'saw': g.beginPath(); for (let i = 0; i <= 36; i++) { const a = (i / 36) * Math.PI * 2; g.lineTo(Math.cos(a) * R1, Math.sin(a) * R1); const b = a + Math.PI / 36; g.lineTo(Math.cos(b) * (R0 + (R1 - R0) * 0.45), Math.sin(b) * (R0 + (R1 - R0) * 0.45)); } g.arc(0, 0, R0, 0, Math.PI * 2, true); g.fill(); break;
      default: break;
    }
    ringCache[key] = c;
    return c;
  };
  function wheelDecalMat(def, color) {
    const tex = new THREE.CanvasTexture(M.wheelDecalCanvas(def, color));
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const m = def.glow ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      : (q() === 'low' ? new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false }) : new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.6, metalness: 0 }));
    m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    return { m, tex };
  }

  // ---------- wheel decals fitted to each wheel ----------
  // Rims, tyres and sidewalls differ on every wheel, and a car's front and rear can differ too, so the decal isn't a
  // flat disc: it's a ring laid on that wheel's own sidewall, from the edge of the rim to the shoulder of the tyre,
  // following its bulge. Everything's measured from the wheel's vertices in the wheel's own space (where it's round,
  // whatever stretching the car model got), so the ring turns and stretches with it.
  const _fv = new V3();
  function measureWheel(parts, ax) {
    const box = new THREE.Box3(), sets = [];
    for (const { geo, rel } of parts) {
      const p = geo.attributes.position, pts = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { _fv.fromBufferAttribute(p, i); if (rel) _fv.applyMatrix4(rel); pts[i * 3] = _fv.x; pts[i * 3 + 1] = _fv.y; pts[i * 3 + 2] = _fv.z; box.expandByPoint(_fv); }
      sets.push(pts);
    }
    const c = box.getCenter(new V3());
    // each part as radius and height (out along the axle)
    const rings = sets.map((pts) => {
      const n = pts.length / 3, rh = new Float32Array(n * 2);
      let r0 = Infinity, r1 = 0;
      for (let i = 0; i < n; i++) {
        const x = pts[i * 3] - c.x, y = pts[i * 3 + 1] - c.y, z = pts[i * 3 + 2] - c.z, h = x * ax.x + y * ax.y + z * ax.z, r = Math.sqrt(Math.max(0, x * x + y * y + z * z - h * h));
        rh[i * 2] = r; rh[i * 2 + 1] = h;
        if (r < r0) r0 = r; if (r > r1) r1 = r;
      }
      return { rh, r0, r1 };
    });
    const R = rings.reduce((m, t) => Math.max(m, t.r1), 0);
    // the tyre is the part that reaches the outside and is hollow; the rim's edge is where something else stops
    const tyre = rings.filter((t) => t.r1 >= R * 0.97 && t.r0 >= R * 0.4);
    let inner;
    if (tyre.length) {
      inner = Math.min(...tyre.map((t) => t.r0));
      for (const t of rings) if (tyre.indexOf(t) < 0 && t.r1 < R * 0.985) inner = Math.max(inner, t.r1);
    } else {
      // tyre and rim in one piece: walk in from the outside until the face drops away into the rim
      const K = 40, top = new Float32Array(K).fill(-1e9);
      for (const t of rings) for (let i = 0; i < t.rh.length; i += 2) { const b = Math.min(K - 1, Math.floor((t.rh[i] / R) * K)); if (t.rh[i + 1] > top[b]) top[b] = t.rh[i + 1]; }
      let hmax = -1e9, i = K - 1;
      for (let b = Math.floor(K * 0.4); b < K; b++) hmax = Math.max(hmax, top[b]);
      while (i > K * 0.5 && (top[i] < -1e8 || top[i] >= hmax * 0.72)) i--;
      inner = U.clamp(((i + 1) / K) * R, R * 0.5, R * 0.84);
    }
    // the outline of the sidewall: the upper hull of its radius / height points, so the ring never sinks into it
    const pts = [];
    for (const t of (tyre.length ? tyre : rings)) for (let i = 0; i < t.rh.length; i += 2) if (t.rh[i] >= inner * 0.97) pts.push([t.rh[i], t.rh[i + 1]]);
    pts.sort((a, b) => a[0] - b[0]);
    const hull = [];
    for (const p of pts) {
      while (hull.length > 1) { const a = hull[hull.length - 2], b = hull[hull.length - 1]; if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) hull.pop(); else break; }
      hull.push(p);
    }
    return { c, R, inner, hull };
  }
  const hullAt = (h, r) => {
    if (r <= h[0][0]) return h[0][1];
    for (let i = 0; i + 1 < h.length; i++) if (r <= h[i + 1][0]) { const a = h[i], b = h[i + 1], d = b[0] - a[0]; return d > 1e-9 ? a[1] + ((b[1] - a[1]) * (r - a[0])) / d : b[1]; }
    return h[h.length - 1][1];
  };
  function ringGeo(m, ax, lift) {
    const low = q() === 'low', S = low ? 24 : 48, K = low ? 3 : 6;
    const u = new V3(Math.abs(ax.x) < 0.9 ? 1 : 0, Math.abs(ax.x) < 0.9 ? 0 : 1, 0).cross(ax).normalize(), v = new V3().crossVectors(ax, u);
    const r0 = m.inner, r1 = m.R * 0.985, e = (m.R - m.inner) * 0.05, pos = [], nor = [], uv = [], idx = [], rad = new V3(), n = new V3();
    for (let i = 0; i <= K; i++) {
      const t = i / K, r = r0 + (r1 - r0) * t, h = hullAt(m.hull, r) + lift, sl = (hullAt(m.hull, r + e) - hullAt(m.hull, r - e)) / (2 * e), rho = 0.7 + 0.3 * t;
      for (let j = 0; j <= S; j++) {
        const a = (j / S) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        rad.copy(u).multiplyScalar(cs).addScaledVector(v, sn);
        n.copy(ax).addScaledVector(rad, -sl).normalize();
        pos.push(m.c.x + ax.x * h + rad.x * r, m.c.y + ax.y * h + rad.y * r, m.c.z + ax.z * h + rad.z * r);
        nor.push(n.x, n.y, n.z); uv.push(0.5 + 0.5 * rho * cs, 0.5 + 0.5 * rho * sn);
      }
    }
    for (let i = 0; i < K; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + S + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.userData.shared = true;
    return g;
  }
  // the built-in wheels' rings, shared by size
  const builtinRings = {};
  function builtinRing(grp, r, w) {
    const key = r.toFixed(3) + ':' + w.toFixed(3) + ':' + q();
    if (builtinRings[key]) return builtinRings[key];
    const ax = new V3(1, 0, 0), parts = grp.children.filter((o) => o.isMesh).map((o) => ({ geo: o.geometry }));
    return (builtinRings[key] = ringGeo(measureWheel(parts, ax), ax, 0.006));
  }

  // ---------- wheels ----------
  const tireGeoCache = {};
  function tireGeo(r, w) {
    const key = r.toFixed(3) + ':' + w.toFixed(3) + ':' + q();
    if (tireGeoCache[key]) return tireGeoCache[key];
    const pts = [];
    const ri = r * 0.64;
    pts.push(new THREE.Vector2(ri, -w / 2));
    pts.push(new THREE.Vector2(r * 0.9, -w / 2));
    pts.push(new THREE.Vector2(r * 0.98, -w / 2 + w * 0.12));
    pts.push(new THREE.Vector2(r, -w / 4));
    pts.push(new THREE.Vector2(r, w / 4));
    pts.push(new THREE.Vector2(r * 0.98, w / 2 - w * 0.12));
    pts.push(new THREE.Vector2(r * 0.9, w / 2));
    pts.push(new THREE.Vector2(ri, w / 2));
    const g = new THREE.LatheGeometry(pts, q() === 'low' ? 12 : 20);
    g.rotateZ(Math.PI / 2);
    tireGeoCache[key] = g;
    return g;
  }

  function rimGeos(rim, r, w) {
    const rr = r * 0.66, face = w / 2 - 0.012, segs = q() === 'low' ? 12 : 20;
    const metal = [], glow = [];
    const n = rim.spokes || 5;
    // barrel + hub
    metal.push(cyl(rr, rr, w * 0.85, segs, 0, 0, 0, 0, 0, Math.PI / 2));
    metal.push(cyl(r * 0.12, r * 0.14, 0.03, 10, face + 0.004, 0, 0, 0, 0, Math.PI / 2));
    const lip = new THREE.TorusGeometry(rr, 0.012, 6, segs);
    lip.rotateY(Math.PI / 2); lip.translate(face, 0, 0);
    metal.push(lip);
    const spoke = (ang, width, depth, twist, inset, len) => {
      const L = len || rr * 0.95;
      const g = new THREE.BoxGeometry(depth || 0.02, L, width);
      g.translate(0, L / 2, 0);
      if (twist) g.rotateY(twist);
      g.rotateX(ang);
      g.translate(face - (inset || 0), 0, 0);
      return g;
    };
    const st = rim.style;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (st === 'spoke') metal.push(spoke(a, 0.028, 0.02));
      else if (st === 'turbine') metal.push(spoke(a, 0.03, 0.012, 0.6));
      else if (st === 'star') { metal.push(spoke(a - 0.12, 0.018, 0.02)); metal.push(spoke(a + 0.12, 0.018, 0.02)); }
      else if (st === 'dish') metal.push(spoke(a, 0.02, 0.02, 0, 0.035));
      else if (st === 'tri') metal.push(spoke(a, 0.07, 0.02));
      else if (st === 'mesh') { metal.push(spoke(a + 0.35, 0.012, 0.015)); metal.push(spoke(a - 0.35, 0.012, 0.015)); }
      else if (st === 'ring') metal.push(spoke(a, 0.012, 0.015, 0, 0, rr * 0.6));
      else if (st === 'spiral') { metal.push(spoke(a, 0.02, 0.02, 0, 0, rr * 0.5)); metal.push(spoke(a + 0.5, 0.02, 0.02, 0.0, 0, rr * 0.95)); }
    }
    if (st === 'dish') {
      const dl = new THREE.TorusGeometry(rr * 1.0, 0.02, 6, segs); dl.rotateY(Math.PI / 2); dl.translate(face + 0.005, 0, 0); metal.push(dl);
    }
    if (rim.glow) {
      const gr = new THREE.TorusGeometry(rr * (st === 'ring' ? 0.72 : 0.9), st === 'ring' ? 0.02 : 0.009, 6, segs);
      gr.rotateY(Math.PI / 2); gr.translate(face + 0.006, 0, 0);
      glow.push(gr);
      glow.push(cyl(r * 0.07, r * 0.07, 0.035, 10, face + 0.01, 0, 0, 0, 0, Math.PI / 2));
    }
    return { metal: merge(metal), glow: merge(glow) };
  }

  function buildWheel(rimDef, paint, r, w) {
    const grp = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo(r, w), tireMat());
    grp.add(tire);
    const rim = Object.assign({}, rimDef);
    const color = paint ? BL.PAINT_BY_ID[paint].color : rim.color;
    const geos = rimGeos(rim, r, w);
    const metalMat = stdMat({ color: new THREE.Color(color), metalness: 0.85, roughness: 0.25 }, 90);
    grp.add(new THREE.Mesh(geos.metal, metalMat));
    let glowMat = null;
    if (geos.glow) {
      glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(paint ? color : rim.glow) });
      grp.add(new THREE.Mesh(geos.glow, glowMat));
    }
    return { grp, glowMat, anim: rim.anim, baseGlow: glowMat ? glowMat.color.clone() : null };
  }
  // a downloaded model (wheel, topper...) centred, with its thinnest axis turned onto x when asked (a wheel's
  // axle), and its largest size; cached per file
  M.fitModel = function (gltf, axleX) {
    const key = axleX ? 'fitWheel' : 'fit';
    if (gltf.userData[key]) return gltf.userData[key];
    const src = gltf.scene.clone(true);
    src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src), s = box.getSize(new V3());
    const turn = new THREE.Group();
    turn.add(src);
    let d = Math.max(s.x, s.y, s.z);
    if (!axleX) src.position.sub(box.getCenter(new V3()));
    else {
      // wheels: the axle is the thin axis of the biggest flat disc (rim face); the radius is measured from the
      // vertices (98th percentile) so stray tyre vertices can't skew it
      const ax = ['x', 'y', 'z'];
      let disc = null, area = 0;
      src.traverse((o) => {
        if (!o.isMesh) return;
        const b = new THREE.Box3().setFromObject(o), z = b.getSize(new V3()), dims = ax.map((k) => z[k]);
        const lo = Math.min(...dims), i = dims.indexOf(lo), others = dims.filter((_, j) => j !== i);
        if (lo < 0.15 * Math.max(...others) && Math.min(...others) > 0.85 * Math.max(...others) && others[0] * others[1] > area) {
          area = others[0] * others[1]; disc = { axis: ax[i], c: b.getCenter(new V3()) };
        }
      });
      if (!disc) { const i = [s.x, s.y, s.z].indexOf(Math.min(s.x, s.y, s.z)); disc = { axis: ax[i], c: box.getCenter(new V3()) }; }
      const radial = [], along = [], v = new V3();
      src.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 2) {
          v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).sub(disc.c);
          along.push(v[disc.axis]);
          v[disc.axis] = 0;
          radial.push(v.length());
        }
      });
      radial.sort((a, b) => a - b); along.sort((a, b) => a - b);
      const pc = (arr, k) => arr[Math.min(arr.length - 1, Math.floor(arr.length * k))] || 0;
      d = 2 * pc(radial, 0.98);
      const c = disc.c.clone();
      c[disc.axis] += (pc(along, 0.05) + pc(along, 0.95)) / 2;
      src.position.sub(c);
      if (disc.axis === 'y') turn.rotation.z = Math.PI / 2; else if (disc.axis === 'z') turn.rotation.y = Math.PI / 2;
    }
    const obj = new THREE.Group();
    obj.add(turn);
    obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return (gltf.userData[key] = { obj, d, size: s });
  };

  // ---------- toppers & antennas ----------
  // toppers are built at about 0.25 m and scaled up to real-game size on the roof
  const TOPPER_SCALE = 1.3;
  function mat(color, opts) { return stdMat(Object.assign({ color: new THREE.Color(color), roughness: 0.5, metalness: 0.1 }, opts || {}), 40); }
  function glowMat(color) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }); }

  M.buildTopper = function (def, paint) {
    const g = new THREE.Group();
    if (!def || def.shape === 'none') return null;
    const col = paint ? BL.PAINT_BY_ID[paint].color : def.color;
    const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; };
    const s = def.shape;
    const info = { group: g, spin: null, bob: null, flames: false };
    if (s === 'saturn') {
      // a planet bobbing above the roof with its ring turning round it
      const bob = new THREE.Group(); bob.position.y = 0.17; g.add(bob);
      const pl = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 12), mat(col)); bob.add(pl);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.012, 6, 32), mat('#fff3e0', { metalness: 0.4, roughness: 0.3 })); ring.rotation.x = Math.PI / 2 - 0.4; bob.add(ring);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), mat('#9e9e9e'), 0, 0.045, 0);
      info.spin = ring; info.bob = bob;
      return info;
    } else if (s === 'disco') {
      // a spinning mirror ball: rows of little mirror tiles, each its own shade, a few lit up like they caught a spotlight
      const T = 128, { c: dc, g: dg } = U.canvas(T, T), rnd = U.rng(77), base = new THREE.Color(col);
      dg.fillStyle = '#20242c'; dg.fillRect(0, 0, T, T);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
        const k = 0.55 + rnd() * 0.45, hot = rnd() < 0.08, cc = hot ? new THREE.Color(1, 1, 1) : base.clone().lerp(new THREE.Color(rnd() < 0.15 ? '#9fe8ff' : '#ffffff'), 0.35).multiplyScalar(k);
        dg.fillStyle = '#' + cc.getHexString(); dg.fillRect(x * (T / 24) + 0.6, y * (T / 16) + 0.6, T / 24 - 1.2, T / 16 - 1.2);
      }
      const dt = new THREE.CanvasTexture(dc); if (THREE.sRGBEncoding) dt.encoding = THREE.sRGBEncoding;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), stdMat({ map: dt, emissiveMap: dt, emissive: new THREE.Color(0.32, 0.32, 0.32), metalness: 0.55, roughness: 0.22, flatShading: true }, 60));
      const spin = new THREE.Group(); spin.position.y = 0.16; spin.add(ball); g.add(spin);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), mat('#424242'), 0, 0.035, 0);
      info.spin = spin;
      return info;
    } else if (s === 'orbit') {
      // a glowing core with three moons orbiting it
      const core = add(new THREE.SphereGeometry(0.055, 14, 10), new THREE.MeshBasicMaterial({ color: col }), 0, 0.15, 0);
      const spin = new THREE.Group(); spin.position.y = 0.15; g.add(spin);
      for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: ['#ffffff', '#40c4ff', '#ff4081'][i] })); const a = (i / 3) * Math.PI * 2; m.position.set(Math.cos(a) * 0.12, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.12); spin.add(m); }
      info.spin = spin; info.bob = core;
      return info;
    }
    if (s === 'cone') {
      add(new THREE.ConeGeometry(0.085, 0.24, 14), mat(col), 0, 0.13, 0);
      add(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 14), mat('#ffffff'), 0, 0.11, 0);
      add(new THREE.BoxGeometry(0.2, 0.02, 0.2), mat(col), 0, 0.01, 0);
    } else if (s === 'tophat') {
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.015, 20), mat(col), 0, 0.008, 0);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 20), mat(col), 0, 0.11, 0);
      add(new THREE.CylinderGeometry(0.102, 0.102, 0.035, 20), mat('#c62828'), 0, 0.04, 0);
    } else if (s === 'sharkfin') {
      const sh = new THREE.Shape(); sh.moveTo(-0.12, 0); sh.lineTo(0.1, 0); sh.quadraticCurveTo(-0.02, 0.08, -0.1, 0.26); sh.lineTo(-0.12, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 });
      geo.rotateY(-Math.PI / 2); geo.translate(0.012, 0, 0);
      add(geo, mat(col));
    } else if (s === 'antlers') {
      const m = mat(col);
      for (const sx of [-1, 1]) {
        const a = add(new THREE.CylinderGeometry(0.012, 0.018, 0.22, 6), m, sx * 0.08, 0.11, 0); a.rotation.z = -sx * 0.4;
        const b = add(new THREE.CylinderGeometry(0.009, 0.012, 0.1, 6), m, sx * 0.15, 0.2, 0.0); b.rotation.z = -sx * 1.1;
        const c = add(new THREE.CylinderGeometry(0.009, 0.012, 0.09, 6), m, sx * 0.11, 0.25, 0.02); c.rotation.x = -0.5;
      }
    } else if (s === 'propeller') {
      const cap = new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      add(cap, mat(col));
      add(new THREE.BoxGeometry(0.09, 0.012, 0.1), mat('#1565c0'), 0, 0.005, 0.15);
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), mat('#eeeeee'), 0, 0.15, 0);
      const prop = new THREE.Group(); prop.position.y = 0.19; g.add(prop);
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.006, 0.035), mat(['#ffeb3b', '#43a047', '#1e88e5'][i])); b.rotation.y = (i * Math.PI * 2) / 3; b.position.set(Math.cos(i * 2.09) * 0.085, 0, -Math.sin(i * 2.09) * 0.085); prop.add(b); }
      info.spin = prop;
    } else if (s === 'viking') {
      add(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, { metalness: 0.8, roughness: 0.3 }));
      add(new THREE.TorusGeometry(0.13, 0.012, 6, 20), mat('#8d6e63'), 0, 0.005, 0).rotation.x = Math.PI / 2;
      for (const sx of [-1, 1]) {
        const h = add(new THREE.ConeGeometry(0.03, 0.18, 10), mat('#f5f0e1'), sx * 0.15, 0.12, 0);
        h.rotation.z = -sx * 0.9;
      }
    } else if (s === 'devil') {
      for (const sx of [-1, 1]) { const h = add(new THREE.ConeGeometry(0.035, 0.16, 10), mat(col), sx * 0.08, 0.07, 0.03); h.rotation.z = -sx * 0.35; h.rotation.x = 0.3; }
    } else if (s === 'wizard') {
      add(new THREE.CylinderGeometry(0.18, 0.18, 0.012, 20), mat(col), 0, 0.006, 0);
      const c = add(new THREE.ConeGeometry(0.11, 0.38, 16), mat(col), 0, 0.2, -0.02); c.rotation.x = -0.15;
      const st = glowMat('#ffeb3b');
      for (let i = 0; i < 5; i++) add(new THREE.OctahedronGeometry(0.018), st, Math.cos(i * 1.3) * 0.07, 0.07 + i * 0.05, Math.sin(i * 1.3) * 0.07);
    } else if (s === 'crown' || s === 'firecrown') {
      const m = mat(col, { metalness: 0.9, roughness: 0.2 });
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.07, 20, 1, true), m, 0, 0.035, 0).material.side = THREE.DoubleSide;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.ConeGeometry(0.025, 0.07, 6), m, Math.cos(a) * 0.105, 0.1, Math.sin(a) * 0.105);
        add(new THREE.SphereGeometry(0.014, 8, 6), glowMat(i % 2 ? '#e53935' : '#1e88e5'), Math.cos(a + 0.5) * 0.108, 0.04, Math.sin(a + 0.5) * 0.108);
      }
      if (s === 'firecrown') info.flames = true;
    } else if (s === 'cap') {
      // baseball cap: a six-panel crown, a curved peak to the front and a button on top
      const m = mat(col, { roughness: 0.9 });
      const crown = add(new THREE.SphereGeometry(0.12, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
      crown.scale.set(1, 0.85, 1.05);
      // the peak: a half disc sticking out of the front of the crown, tipped down a little
      const peak = add(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 16, 1, false, -Math.PI / 2, Math.PI), m, 0, 0.012, 0.1);
      peak.scale.set(1.05, 1, 0.95); peak.rotation.x = 0.15;
      add(new THREE.SphereGeometry(0.016, 8, 6), mat('#f5f5f5'), 0, 0.104, 0);
    } else if (s === 'beanie') {
      add(new THREE.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, { roughness: 0.95 }));
      add(new THREE.CylinderGeometry(0.125, 0.125, 0.04, 16), mat('#f5f5f5', { roughness: 0.95 }), 0, 0.02, 0);
      add(new THREE.SphereGeometry(0.045, 10, 8), mat('#f5f5f5', { roughness: 1 }), 0, 0.135, 0);
    } else if (s === 'astro') {
      add(new THREE.SphereGeometry(0.13, 18, 12), mat(col, { roughness: 0.3, metalness: 0.2 }), 0, 0.11, 0);
      add(new THREE.SphereGeometry(0.105, 16, 10, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.28, Math.PI * 0.4), mat('#ffb300', { metalness: 1, roughness: 0.05 }), 0, 0.11, 0.035);
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 5), darkMat(), 0.06, 0.26, -0.03);
      add(new THREE.SphereGeometry(0.014, 8, 6), glowMat('#ff1744'), 0.06, 0.32, -0.03);
    } else if (s === 'partyhat') {
      // a striped cone with a pom on top
      const { c: cv, g: cg } = U.canvas(64, 64); cg.fillStyle = col; cg.fillRect(0, 0, 64, 64); cg.fillStyle = '#ffeb3b'; for (let i = 0; i < 64; i += 16) { cg.beginPath(); cg.moveTo(i, 64); cg.lineTo(i + 8, 64); cg.lineTo(i + 40, 0); cg.lineTo(i + 32, 0); cg.fill(); }
      add(new THREE.ConeGeometry(0.09, 0.26, 18), stdMat({ map: new THREE.CanvasTexture(cv), roughness: 0.7 }, 20), 0, 0.13, 0);
      add(new THREE.SphereGeometry(0.035, 10, 8), mat('#ffffff', { roughness: 1 }), 0, 0.27, 0);
    } else if (s === 'chef') {
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 18), mat(col, { roughness: 0.95 }), 0, 0.05, 0);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(new THREE.SphereGeometry(0.07, 12, 8), mat(col, { roughness: 1 }), Math.cos(a) * 0.065, 0.13, Math.sin(a) * 0.065); }
      add(new THREE.SphereGeometry(0.075, 12, 8), mat(col, { roughness: 1 }), 0, 0.16, 0);
    } else if (s === 'bunny') {
      for (const sx of [-1, 1]) {
        const ear = add(new THREE.SphereGeometry(0.04, 12, 10), mat(col, { roughness: 0.9 }), sx * 0.05, 0.14, -0.01); ear.scale.set(0.8, 3.2, 0.45); ear.rotation.z = -sx * 0.18;
        const inner = add(new THREE.SphereGeometry(0.025, 10, 8), mat('#f8bbd0', { roughness: 0.9 }), sx * 0.05, 0.14, 0.007); inner.scale.set(0.8, 3.4, 0.3); inner.rotation.z = -sx * 0.18;
      }
    } else if (s === 'cat') {
      for (const sx of [-1, 1]) {
        const e = add(new THREE.ConeGeometry(0.05, 0.11, 4), mat(col, { roughness: 0.8 }), sx * 0.08, 0.05, 0); e.rotation.z = -sx * 0.25; e.rotation.y = Math.PI / 4;
        const i2 = add(new THREE.ConeGeometry(0.03, 0.07, 4), mat('#f48fb1', { roughness: 0.8 }), sx * 0.08, 0.045, 0.012); i2.rotation.z = -sx * 0.25; i2.rotation.y = Math.PI / 4;
      }
    } else if (s === 'mohawk') {
      for (let i = 0; i < 7; i++) { const sp = add(new THREE.ConeGeometry(0.025, 0.12 + Math.sin((i / 6) * Math.PI) * 0.06, 6), mat(col, { roughness: 0.8 }), 0, 0.06, -0.12 + i * 0.04); sp.rotation.x = -0.25 + i * 0.08; }
    } else if (s === 'sombrero') {
      add(new THREE.CylinderGeometry(0.22, 0.24, 0.012, 24), mat(col, { roughness: 0.9 }), 0, 0.008, 0);
      add(new THREE.TorusGeometry(0.225, 0.012, 6, 28), mat('#c62828', { roughness: 0.9 }), 0, 0.016, 0).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.06, 0.09, 0.13, 18), mat(col, { roughness: 0.9 }), 0, 0.075, 0);
      add(new THREE.CylinderGeometry(0.091, 0.091, 0.025, 18), mat('#2e7d32', { roughness: 0.9 }), 0, 0.03, 0);
    } else if (s === 'unicorn') {
      // a twisted golden horn
      const pts = []; for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector2(0.04 * (1 - i / 12) * (1 + 0.15 * Math.sin(i * 2.6)), i * 0.022));
      const horn = add(new THREE.LatheGeometry(pts, 16), mat(col, { metalness: 0.6, roughness: 0.3, emissive: new THREE.Color(col).multiplyScalar(0.18) }), 0, 0.01, 0.03); horn.rotation.x = 0.35;
      // the tip: the horn's top (0.264 up its axis) tipped forward with it
      const tip = new V3(0, 12 * 0.022, 0).applyAxisAngle(new V3(1, 0, 0), 0.35).add(new V3(0, 0.01, 0.03));
      add(new THREE.OctahedronGeometry(0.018, 0), glowMat('#ffffff'), tip.x, tip.y, tip.z);
    } else if (s === 'halo') {
      const h = add(new THREE.TorusGeometry(0.15, 0.018, 8, 32), glowMat(new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.45)), 0, 0.17, 0);
      h.rotation.x = Math.PI / 2;
      // (the glow: a wider see-through ring added on top; Low leaves it out)
      if (q() !== 'low') {
        const glow = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.renderOrder = 3; h.add(glow);
      }
      info.bob = h;
    }
    // downloaded topper model (Medium / High) replaces the built-in shape once it loads, ~0.34 m across
    if (def.model && q() !== 'low') {
      BL.HQ.when(() => M.loadGLTF(def.model, (gltf) => {
        const fit = M.fitModel(gltf, false);
        const o = fit.obj.clone(true);
        o.scale.setScalar(0.34 / Math.max(fit.size.x, fit.size.z, 0.01));
        o.position.y = (fit.size.y * o.scale.x) / 2;
        g.children.forEach((c) => { c.visible = false; });
        g.add(o);
      }, () => {}));
    }
    return info;
  };

  function flatShape(kind) {
    const sh = new THREE.Shape();
    if (kind === 'star') {
      for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.03 : 0.07; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) sh.lineTo(x, y); else sh.moveTo(x, y); }
    } else if (kind === 'heart') {
      sh.moveTo(0, -0.06); sh.bezierCurveTo(-0.09, 0, -0.06, 0.07, 0, 0.035); sh.bezierCurveTo(0.06, 0.07, 0.09, 0, 0, -0.06);
    } else if (kind === 'bolt') {
      sh.moveTo(0.02, 0.08); sh.lineTo(-0.04, 0); sh.lineTo(0, 0); sh.lineTo(-0.02, -0.08); sh.lineTo(0.045, 0.01); sh.lineTo(0.005, 0.01); sh.lineTo(0.02, 0.08);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 1 });
    g.translate(0, 0, -0.0075);
    return g;
  }

  function flagTexture(kind, color, paint) {
    const { c, g } = U.canvas(64, 48);
    if (kind === 'flag') {
      // (painted: the light squares take the paint)
      for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111' : paint || '#fff'; g.fillRect(x * 8, y * 8, 8, 8); }
    } else if (kind === 's1flag') {
      g.fillStyle = color; g.fillRect(0, 0, 64, 48);
      g.fillStyle = '#111'; g.fillRect(0, 34, 64, 14);
      g.fillStyle = '#fff'; g.font = 'italic 900 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('S1', 32, 19);
    } else {
      g.fillStyle = '#111'; g.fillRect(0, 0, 64, 48);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 20, 11, 0, Math.PI * 2); g.fill();
      g.fillRect(26, 26, 12, 8);
      g.fillStyle = '#111'; g.beginPath(); g.arc(28, 19, 3, 0, 7); g.arc(36, 19, 3, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(14, 34); g.lineTo(50, 44); g.moveTo(50, 34); g.lineTo(14, 44); g.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  M.buildAntenna = function (def, paint) {
    if (!def || def.shape === 'none') return null;
    const col = paint ? BL.PAINT_BY_ID[paint].color : def.color;
    const pivot = new THREE.Group();
    // the pole stands well above the roof like the real ones; the topper part is scaled up to match
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.56, 5), darkMat());
    pole.position.y = 0.28; pivot.add(pole);
    const top = new THREE.Group(); top.position.y = 0.57; top.scale.setScalar(1.35); pivot.add(top);
    let flag = null;
    const s = def.shape;
    if (s === 'ball') {
      const { c, g } = U.canvas(64, 32); g.fillStyle = col; g.fillRect(0, 0, 64, 32); g.fillStyle = '#ff7a00'; g.fillRect(0, 13, 64, 6);
      top.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), stdMat({ map: new THREE.CanvasTexture(c), roughness: 0.4 }, 50)));
    } else if (s === 'torch') {
      top.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.08, 8), mat(paint ? col : '#8d6e63')));
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.03, 8), mat(col, { metalness: 0.8, roughness: 0.3 }));
      cup.position.y = 0.05; top.add(cup);
      // a flame of its own in the cup (the sparks fly off it in a match; cards and Very Low show this)
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), glowMat('#ff7a1a')); fl.position.y = 0.1; top.add(fl);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.05, 8), glowMat('#ffe27a')); core.position.y = 0.088; top.add(core);
    } else if (s === 'flag' || s === 'skull' || s === 's1flag') {
      // a cloth flag off the back of the pole that waves (see update); the hoist edge stays on the pole
      const geo = new THREE.PlaneGeometry(0.16, 0.11, 8, 1);
      geo.translate(0.08, 0, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: flagTexture(s, col, paint ? col : null), side: THREE.DoubleSide }));
      m.rotation.y = Math.PI / 2; m.position.set(0, -0.04, 0); top.add(m);
      flag = { geo, base: Float32Array.from(geo.attributes.position.array) };
    } else if (s === 'star' || s === 'heart' || s === 'bolt') {
      const m = new THREE.Mesh(flatShape(s), mat(col, { metalness: 0.5, roughness: 0.3 }));
      m.rotation.y = Math.PI / 2; m.position.y = 0.04; top.add(m);
    } else if (s === 'orb') {
      top.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glowMat(col)));
    } else if (s === 'donut') {
      const d = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.018, 8, 16), mat('#d7a86e')); d.rotation.y = Math.PI / 2; top.add(d);
      const icing = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.0185, 8, 16, Math.PI * 2), mat(col, { roughness: 0.5 })); icing.rotation.y = Math.PI / 2; icing.position.x = 0.004; icing.scale.set(1, 1, 0.9); top.add(icing);
    } else if (s === 'pizza') {
      const sh = new THREE.Shape(); sh.moveTo(0, -0.05); sh.lineTo(-0.045, 0.05); sh.quadraticCurveTo(0, 0.065, 0.045, 0.05); sh.lineTo(0, -0.05);
      const slice = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false }), mat(col, { roughness: 0.8 })); slice.rotation.y = Math.PI / 2; top.add(slice);
      for (const [px, py] of [[-0.012, 0.02], [0.015, 0.03], [0, -0.005]]) { const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 10), mat('#c62828')); pep.rotation.z = Math.PI / 2; pep.position.set(0.007, py, px); top.add(pep); }
    } else if (s === 'football') {
      const { c, g } = U.canvas(64, 32); g.fillStyle = col; g.fillRect(0, 0, 64, 32); g.fillStyle = '#111'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i * 11 + 5) % 64, i % 2 ? 9 : 23, 4, 0, 7); g.fill(); }
      top.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), stdMat({ map: new THREE.CanvasTexture(c), roughness: 0.5 }, 30)));
    } else if (s === 'moon') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.016, 8, 18, Math.PI * 1.2), glowMat(col)); m.rotation.y = Math.PI / 2; m.rotation.x = -0.6; top.add(m);
    } else if (s === 'rocket') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), mat('#eeeeee', { metalness: 0.3 })); top.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 10), mat(col)); nose.position.y = 0.055; top.add(nose);
      for (let i = 0; i < 3; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.022), mat(col)); const a = (i / 3) * Math.PI * 2; fin.position.set(Math.cos(a) * 0.02, -0.03, Math.sin(a) * 0.02); fin.rotation.y = -a; top.add(fin); }
    } else if (s === 'diamond') {
      const dm = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), mat(col, { metalness: 0.2, roughness: 0.05, flatShading: true, emissive: new THREE.Color(col).multiplyScalar(0.35) })); dm.scale.y = 1.3; top.add(dm);
    }
    return { pivot, top, flag, sx: 0, sz: 0, vx: 0, vz: 0, spin: s === 'star' || s === 'heart' || s === 'bolt' || s === 'donut' || s === 'diamond' || s === 'football', flames: s === 'torch' || s === 'rocket' };
  };

  // ---------- car assembly ----------
  const _v = new V3(), _v2 = new V3();
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
  const _wm = new THREE.Matrix4(), _wm2 = new THREE.Matrix4();

  // ---------- trails: camera-facing ribbons in world space (boost trail, supersonic streaks) ----------
  const _ra = new V3(), _rb = new V3(), _rv = new V3();
  class Ribbon {
    constructor(n, life, width, additive) {
      this.n = n; this.life = life; this.width = width;
      this.pts = []; this.pool = [];
      this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 8);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
      const uv = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { uv[i * 4] = uv[i * 4 + 2] = i / (n - 1); uv[i * 4 + 3] = 1; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const idx = [];
      for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx);
      g.setDrawRange(0, 0);
      // (two materials for every ribbon in the match: colour and fade are in the vertices, the texture is the soft streak)
      const key = additive ? 'ribbon-add' : 'ribbon-mix';
      this.mat = sharedMat(key, () => new THREE.MeshBasicMaterial({ map: BL.BoostFX.ribbonTex(), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
      this.mesh = new THREE.Mesh(g, this.mat);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 2;
      this.mesh.visible = false;
      this.color = new THREE.Color(1, 1, 1);
    }
    push(p, now) {
      let last = this.pts[this.pts.length - 1];
      if (last && last.p.distanceToSquared(p) > 36) { this.clear(); last = null; } // respawn / kickoff teleport
      if (last && last.p.distanceToSquared(p) < 0.0016) { last.t = now; return; }
      const e = this.pool.pop() || { p: new V3(), t: 0 };
      e.p.copy(p); e.t = now;
      this.pts.push(e);
      if (this.pts.length > this.n) this.pool.push(this.pts.shift());
    }
    update(now, cam) {
      while (this.pts.length && now - this.pts[0].t > this.life) this.pool.push(this.pts.shift());
      const m = this.pts.length, g = this.mesh.geometry;
      // (hidden when empty: an empty draw still costs a full material and buffer switch)
      this.mesh.visible = m >= 2 && !!cam;
      if (!this.mesh.visible) return;
      const c = this.color;
      for (let i = 0; i < m; i++) {
        const a = this.pts[i].p;
        _rv.copy(this.pts[Math.min(m - 1, i + 1)].p).sub(this.pts[Math.max(0, i - 1)].p);
        _ra.copy(cam.position).sub(a);
        _rb.crossVectors(_rv, _ra).normalize();
        const k = Math.max(0, 1 - (now - this.pts[i].t) / this.life), w = this.width * (0.25 + 0.75 * k) * 0.5;
        // (fades out close to the lens: the chase camera trails the car, so the old end passes right under it and
        // used to smear a wide band down the screen)
        const o = i * 6, q = i * 8, al = k * k * U.smoothstep(2.5, 7, _ra.length());
        // (Rainbow Road: the colours run down its length)
        if (this.rainbow) c.setHSL((now * 0.6 + (m - i) / m * 0.9) % 1, 1, 0.56);
        this.pos[o] = a.x + _rb.x * w; this.pos[o + 1] = a.y + _rb.y * w; this.pos[o + 2] = a.z + _rb.z * w;
        this.pos[o + 3] = a.x - _rb.x * w; this.pos[o + 4] = a.y - _rb.y * w; this.pos[o + 5] = a.z - _rb.z * w;
        this.col[q] = this.col[q + 4] = c.r; this.col[q + 1] = this.col[q + 5] = c.g; this.col[q + 2] = this.col[q + 6] = c.b;
        this.col[q + 3] = this.col[q + 7] = al;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
      g.setDrawRange(0, (m - 1) * 6);
    }
    clear() { while (this.pts.length) this.pool.push(this.pts.pop()); this.mesh.visible = false; }
    dispose() { if (this.mesh.parent) this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); }
  }

  // A downloaded car is dozens of small parts, many sharing a material, and each part costs a draw call (two with
  // the real shadows) plus three.js's own work every frame. Once per model (every car built from it shares the result)
  // parts with the same material are joined into one mesh: the same triangles in the same places, so the same picture.
  // Wheels keep turning: their parts are joined inside each wheel node, or per corner for wheels made of loose parts.
  // See-through parts stay as they are, three.js sorts those by distance.
  function mergeModelParts(root, cfg) {
    const topRe = cfg.wheelParts ? null : new RegExp(cfg.wheels || 'wheel|tire|tyre', 'i');
    const partRe = cfg.wheelParts ? new RegExp(cfg.wheelParts, 'i') : null;
    root.updateMatrixWorld(true);
    const mid = new THREE.Box3().setFromObject(root).getCenter(new V3()), c = new V3(), buckets = new Map();
    // some model files mark solid paint as blended: drawn as glass it costs double and sorts badly. No fading and a
    // texture with no holes means it's solid
    const solid = (m) => {
      if (m.opacity < 1 || m.alphaMap || m.alphaTest > 0 || m.transmission) return false;
      if (!m.map) return true;
      try {
        const S = 128, { c: cv, g } = U.canvas(S, S);
        g.drawImage(m.map.image, 0, 0, S, S);
        const d = g.getImageData(0, 0, S, S).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return false;
        return true;
      } catch (e) { return false; }
    };
    const seen = new Set();
    root.traverse((o) => {
      const m = o.isMesh && o.material;
      if (!m || Array.isArray(m) || !m.transparent || seen.has(m)) return;
      seen.add(m);
      if (solid(m)) { m.transparent = false; m.depthWrite = true; }
    });
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.visible || !o.material || Array.isArray(o.material) || o.material.transparent) return;
      if (Object.keys(o.geometry.morphAttributes || {}).length) return;
      let anchor = root, corner = '';
      if (topRe) {
        for (let p = o; p && p !== root; p = p.parent) if (topRe.test(p.name || '')) anchor = p;
        if (anchor === o) return;
      } else if (partRe.test(o.name || '') || partRe.test(o.material.name || '')) {
        new THREE.Box3().setFromObject(o).getCenter(c);
        corner = (c.z > mid.z ? 'F' : 'R') + (c.x > mid.x ? 'L' : 'R');
      }
      const key = [anchor.uuid, o.material.uuid, corner, Object.keys(o.geometry.attributes).sort().join()].join('|');
      if (!buckets.has(key)) buckets.set(key, { anchor, list: [] });
      buckets.get(key).list.push(o);
    });
    const GET = ['getX', 'getY', 'getZ', 'getW'], rel = new THREE.Matrix4(), inv = new THREE.Matrix4();
    const plain = (a) => {
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a[GET[k]](i);
      return new THREE.BufferAttribute(out, a.itemSize);
    };
    for (const { anchor, list } of buckets.values()) {
      if (list.length < 2) continue;
      inv.copy(anchor.matrixWorld).invert();
      const geos = list.map((o) => {
        const src = o.geometry, g = new THREE.BufferGeometry();
        for (const k of Object.keys(src.attributes)) g.setAttribute(k, plain(src.attributes[k]));
        rel.multiplyMatrices(inv, o.matrixWorld);
        g.applyMatrix4(rel);
        const idx = src.index ? Array.from(src.index.array) : Array.from({ length: src.attributes.position.count }, (_, i) => i);
        // (a mirrored part's triangles turn over when its transform is baked in)
        if (rel.determinant() < 0) for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        g.setIndex(idx);
        return g;
      });
      const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, list[0].material);
      mesh.name = list[0].name;
      anchor.add(mesh);
      for (const o of list) o.parent.remove(o);
    }
    // the empty branches they left behind (wheel nodes stay: they're looked up by name)
    const prune = (o) => { for (const ch of o.children.slice()) prune(ch); if (o !== root && !o.children.length && !o.isMesh && !(topRe && topRe.test(o.name || ''))) o.parent.remove(o); };
    prune(root);
  }

  class CarModel {
    constructor(loadout, team, opts) {
      opts = opts || {};
      this.loadout = loadout;
      this.team = team;
      const bodyDef = BL.ITEM_BY_ID[(loadout.body && loadout.body.id) || 'body_striker'];
      const hb = BL.HITBOXES[bodyDef.hitbox || 'octane'];
      // original lofted bodies (js/rlcars.js); the old extruded shapes stay as a fallback
      let s;
      if (BL.RLCars && BL.RLCars.has(bodyDef.style || 'hatch')) s = BL.RLCars.style(bodyDef.style || 'hatch', hb);
      else { s = Object.assign({}, STYLES[bodyDef.style || 'hatch']); s.restH = hb.H / 2 + 0.2; }
      this.style = s;
      this.group = new THREE.Group();
      this.body = new THREE.Group();
      this.group.add(this.body);
      this.anims = [];
      this.time = Math.random() * 10;

      const baseColor = team === 0 ? loadout.blue : loadout.orange;
      this.baseColor = baseColor;
      const accent = loadout.accent || '#f5f5f5';
      const decalDef = BL.ITEM_BY_ID[(loadout.decal && loadout.decal.id) || 'decal_none'] || BL.ITEM_BY_ID.decal_none;
      const finishDef = BL.ITEM_BY_ID[(loadout.finish && loadout.finish.id) || 'finish_gloss'] || BL.ITEM_BY_ID.finish_gloss;
      const decalPaint = loadout.decal && loadout.decal.paint && BL.PAINT_BY_ID[loadout.decal.paint] ? BL.PAINT_BY_ID[loadout.decal.paint].color : null;
      const decalAccent = decalPaint || accent;
      // (a moving decal leaves out the door seams, or they'd slide along the car with it)
      const tex = new THREE.CanvasTexture(M.decalCanvas(decalDef.pattern, baseColor, decalAccent, decalDef.animated ? null : s, decalPaint));
      if (BL.App && BL.App.renderer && q() !== 'low') tex.anisotropy = Math.min(8, BL.App.renderer.capabilities.getMaxAnisotropy());
      if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      if (decalDef.animated) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; this.animTex = { tex, kind: decalDef.pattern, anim: decalDef.anim || null, bpm: decalDef.bpm || 0 }; }
      const finishCol = loadout.finish && loadout.finish.paint ? BL.PAINT_BY_ID[loadout.finish.paint].color : null;
      this.finishDef = finishDef; this.finishCol = finishCol;
      this.paintMat = paintMaterial(finishDef, tex);
      // (Very Low skips the extra texture for the reactive ones: they brighten the paint instead, see updateDecal)
      if (decalDef.anim && !(decalDef.react && BL.App && BL.App.potato)) {
        // only the pattern glows: an emissive copy of the decal without the body colour
        const glow = M.decalOverlay(decalDef.pattern, baseColor, decalAccent, decalPaint);
        if (glow) { glow.wrapS = glow.wrapT = THREE.RepeatWrapping; this.paintMat.emissiveMap = glow; this.paintMat.emissive = new THREE.Color(decalAccent); this.paintMat.emissiveIntensity = 0.6; this.glowTex = glow; }
      }
      if (finishCol) this.paintMat.color = new THREE.Color(finishCol).lerp(new THREE.Color(1, 1, 1), 0.55);
      if (decalDef.react && !this.paintMat.emissiveMap) this.paintBase = this.paintMat.color.clone();
      this.accentMat = stdMat({ color: new THREE.Color(accent), metalness: 0.35, roughness: 0.4 }, 50);
      this.mats = [this.paintMat, this.accentMat];
      this.textures = this.glowTex ? [tex, this.glowTex] : [tex];

      this.decal = { def: decalDef, base: baseColor, accent: decalAccent, paint: decalPaint };
      this.buildBody(s);
      this.buildWheels(s, loadout);
      this.buildExtras(s, loadout);
      this.buildFlames(s, loadout);
      if (!opts.noAsset) this.tryAsset(bodyDef, baseColor);
    }

    buildBody(s) {
      if (s.loft) { BL.RLCars.buildBody(this, s, { q, glassMat, headMat, tailMat, merge }); return; }
      const low = q() === 'low';
      const segs = low ? 2 : 3, cs = low ? 6 : 10;
      const W = s.W, deform = taperFn(s, 0);
      const pieces = [];
      if (s.open) {
        pieces.push(finalize(extrude(profileShape(s, false), W, 0.04, 0.03, segs, cs), s, deform, 0));
      } else {
        const slab = Math.max(s.f.w, s.r.w) + 0.03;
        const coreW = W - 2 * slab;
        pieces.push(finalize(extrude(profileShape(s, false), coreW, 0.03, 0.02, segs, cs), s, deform, 0));
        const side = profileShape(s, true);
        pieces.push(finalize(extrude(side, slab, 0.045, 0.03, segs, cs), s, deform, W / 2 - slab / 2));
        pieces.push(finalize(extrude(side, slab, 0.045, 0.03, segs, cs), s, deform, -(W / 2 - slab / 2)));
      }
      if (s.cabin) {
        const cw = W * s.cabin.w;
        const cabin = finalize(extrude(cabinShape(s), cw, 0.05, 0.03, segs, cs), s, taperFn(s, 0.18), 0);
        this.body.add(new THREE.Mesh(cabin, glassMat()));
        pieces.push(finalize(extrude(roofShape(s), cw + 0.02, 0.025, 0.012, 1, cs), s, taperFn(s, 0.18), 0));
        // B-pillars
        const bu = (s.cabin.ws + s.cabin.rw) / 2 - 0.02;
        const ph = s.cabin.roof - s.belt;
        const bp = box(cw * 0.97, ph * 0.9, 0.05, 0, (s.belt + s.cabin.roof) / 2 - s.restH, bu);
        const pp = bp.attributes.position;
        for (let i = 0; i < pp.count; i++) { const h = pp.getY(i) + s.restH; pp.setX(i, pp.getX(i) * (1 - 0.18 * U.clamp((h - s.belt) / ph, 0, 1))); }
        pieces.push(bp);
      }
      this.paintGeo = merge(pieces);
      const bodyMesh = new THREE.Mesh(this.paintGeo, this.paintMat);
      bodyMesh.castShadow = true;
      this.body.add(bodyMesh);
      this.bodyMesh = bodyMesh;

      // lights, trim
      const L2 = s.L / 2, rh = s.restH;
      const dW = deform(L2 - 0.02, s.nose.h - 0.06) * (W / 2);
      const heads = [], tails = [], dark = [];
      const hw = s.open ? 0.04 : 0.11;
      heads.push(box(hw, 0.045, 0.03, dW - hw / 2 - 0.035, s.nose.h - 0.07 - rh, L2 - 0.005));
      heads.push(box(hw, 0.045, 0.03, -(dW - hw / 2 - 0.035), s.nose.h - 0.07 - rh, L2 - 0.005));
      const tW = taperFn(s, 0)(-L2 + 0.02, s.tail.h - 0.06) * (W / 2);
      tails.push(box(0.13, 0.04, 0.03, tW - 0.1, s.tail.h - 0.08 - rh, -L2 + 0.005));
      tails.push(box(0.13, 0.04, 0.03, -(tW - 0.1), s.tail.h - 0.08 - rh, -L2 + 0.005));
      if (!s.open) dark.push(box(Math.min(0.36, dW * 1.1), 0.07, 0.03, 0, s.bottom + 0.09 - rh, L2 - 0.004));
      // exhausts
      this.exhausts = [];
      const ex = s.open ? [0] : [-0.13, 0.13];
      for (const x of ex) {
        dark.push(cyl(0.035, 0.035, 0.08, 10, x, s.bottom + 0.07 - rh, -L2 + 0.02, Math.PI / 2, 0, 0));
        this.exhausts.push(new V3(x, s.bottom + 0.07 - rh, -L2 - 0.03));
      }
      this.body.add(new THREE.Mesh(merge(heads), headMat()));
      this.body.add(new THREE.Mesh(merge(tails), tailMat()));
      this.darkGeo = dark;
    }

    buildWheels(s, loadout) {
      const wdef = BL.ITEM_BY_ID[(loadout.wheels && loadout.wheels.id) || 'wheels_stock'] || BL.ITEM_BY_ID.wheels_stock;
      const paint = loadout.wheels && loadout.wheels.paint;
      this.wheels = [];
      const W = s.W;
      for (const front of [true, false]) {
        const wd = front ? s.f : s.r;
        for (const side of [1, -1]) {
          const pivot = new THREE.Group();
          const x = s.wheelX ? side * s.wheelX : side * (W / 2 - wd.w / 2 - 0.015);
          pivot.position.set(x, wd.r - s.restH, wd.u);
          const wheel = buildWheel(wdef.rim, paint, wd.r, wd.w);
          const spin = wheel.grp;
          if (side < 0) spin.rotation.y = Math.PI;
          pivot.add(spin);
          this.body.add(pivot);
          this.wheels.push({ pivot, spin, front, r: wd.r, w: wd.w, glowMat: wheel.glowMat, anim: wheel.anim, baseGlow: wheel.baseGlow, baseY: wd.r - s.restH });
          if (wheel.glowMat) this.mats.push(wheel.glowMat);
          if (this.hasWheelDecal()) spin.add(this.wheelDecalMesh(builtinRing(wheel.grp, wd.r, wd.w)));
        }
      }
      if (q() === 'low' || !wdef.model) this.instanceWheels();
      // downloaded wheel model (Medium / High): swaps in for each tyre + rim once it loads
      if (wdef.model && q() !== 'low') {
        BL.HQ.when(() => M.loadGLTF(wdef.model, (gltf) => {
          if (this.disposed) return;
          const fit = M.fitModel(gltf, true);
          const rings = fit.rings || (fit.rings = {});
          for (const w of this.wheels) {
            const o = fit.obj.clone(true);
            o.scale.setScalar((2 * w.r) / fit.d);
            w.spin.children.forEach((c) => { c.visible = false; });
            w.spin.add(o);
            // (the decal goes on this wheel's own sidewall)
            if (this.hasWheelDecal()) {
              const key = w.r.toFixed(3);
              if (!rings[key]) {
                w.spin.updateMatrixWorld(true);
                const inv = new THREE.Matrix4().copy(w.spin.matrixWorld).invert(), parts = [], ax = new V3(1, 0, 0);
                o.traverse((x) => { if (x.isMesh) parts.push({ geo: x.geometry, rel: new THREE.Matrix4().multiplyMatrices(inv, x.matrixWorld) }); });
                rings[key] = ringGeo(measureWheel(parts, ax), ax, 0.006);
              }
              w.spin.add(this.wheelDecalMesh(rings[key]));
            }
          }
        }, () => {}));
      }
    }

    // each wheel part (tyre, rim, glow, decal) is one instanced mesh for all four wheels (they share materials), so a
    // car's wheels cost 2-4 draw calls instead of 8-16 (the per-wheel meshes stay as hidden transform holders)
    instanceWheels() {
      const ws = this.wheels;
      if (ws.length !== 4 || ws.some((w) => w.spin.children.length !== ws[0].spin.children.length)) return;
      this.wheelInst = [];
      ws[0].spin.children.forEach((p, idx) => {
        if (!p.isMesh || Array.isArray(p.material)) return;
        const im = new THREE.InstancedMesh(p.geometry, p.material, 4);
        im.frustumCulled = false; im.castShadow = p.castShadow;
        this.body.add(im);
        for (const w of ws) {
          const ch = w.spin.children[idx];
          ch.visible = false;
          ch.updateMatrix();
          // (a rear wheel of another size draws the front's parts stretched to its own size)
          if (ch.geometry !== p.geometry) ch.matrix.premultiply(_wm.makeScale(w.w / ws[0].w, w.r / ws[0].r, w.r / ws[0].r));
          ch.matrixAutoUpdate = false; ch.matrixWorldAutoUpdate = false;
        }
        this.wheelInst.push({ im, idx });
      });
    }

    hasWheelDecal() { const it = this.loadout.wheeldecal, def = it && BL.ITEM_BY_ID[it.id]; return !!(def && def.ring && def.ring !== 'none'); }
    // the equipped wheel decal on a ring made for one wheel (see ringGeo)
    wheelDecalMesh(geo) {
      const it = this.loadout.wheeldecal, def = BL.ITEM_BY_ID[it.id];
      const color = it.paint ? BL.PAINT_BY_ID[it.paint].color : def.color || '#f5f5f5';
      if (!this._wdm) { this._wdm = wheelDecalMat(def, color); this.mats.push(this._wdm.m); this.textures.push(this._wdm.tex); }
      const mesh = new THREE.Mesh(geo, this._wdm.m);
      mesh.renderOrder = 2;
      return mesh;
    }

    trimPaintMat() {
      if (!this._trimPaint) {
        this._trimPaint = stdMat({ color: new THREE.Color(this.baseColor), metalness: 0.45, roughness: 0.32 }, 60);
        this.mats.push(this._trimPaint);
      }
      return this._trimPaint;
    }

    buildExtras(s, loadout) {
      const acc = [], dark = this.darkGeo || [], rh = s.restH, W = s.W, L2 = s.L / 2;
      const parts = s.parts || [];
      const deform = taperFn(s, 0);
      // lofted bodies fit their own wings/skirts/mirrors to the real surface, in the body colour
      const fitted = s.loft ? BL.RLCars.buildParts(this, s, { merge, bodyMat: () => this.trimPaintMat() }) : null;
      for (const p of parts) {
        if (fitted && fitted.has(p)) continue;
        if (p === 'roofSpoiler') acc.push(box(W * 0.62, 0.022, 0.13, 0, s.cabin.roof - 0.005 - rh, s.cabin.rr - 0.06, -0.15));
        if (p === 'wing') {
          acc.push(box(W * 0.95, 0.025, 0.17, 0, s.deck.h + 0.16 - rh, -L2 + 0.1, 0.12));
          acc.push(box(0.025, 0.16, 0.06, 0.24, s.deck.h + 0.08 - rh, -L2 + 0.12));
          acc.push(box(0.025, 0.16, 0.06, -0.24, s.deck.h + 0.08 - rh, -L2 + 0.12));
          acc.push(box(0.02, 0.09, 0.2, W * 0.475, s.deck.h + 0.15 - rh, -L2 + 0.1));
          acc.push(box(0.02, 0.09, 0.2, -W * 0.475, s.deck.h + 0.15 - rh, -L2 + 0.1));
        }
        if (p === 'bigwing') {
          acc.push(box(W * 1.0, 0.03, 0.2, 0, s.cabin.roof + 0.04 - rh, -L2 + 0.1, 0.1));
          acc.push(box(0.03, 0.2, 0.05, 0.22, s.cabin.roof - 0.06 - rh, -L2 + 0.13));
          acc.push(box(0.03, 0.2, 0.05, -0.22, s.cabin.roof - 0.06 - rh, -L2 + 0.13));
        }
        if (p === 'ducktail') acc.push(box(W * 0.84, 0.03, 0.08, 0, s.tail.h + 0.012 - rh, -L2 + 0.05, -0.35));
        if (p === 'fins') {
          for (const sx of [1, -1]) {
            const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(-0.36, 0); sh.lineTo(-0.36, 0.2); sh.quadraticCurveTo(-0.15, 0.05, 0, 0);
            const g = new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false });
            g.rotateY(-Math.PI / 2); g.translate(sx * (W / 2 - 0.08), s.deck.h - 0.01 - rh, -L2 + 0.38);
            acc.push(g);
          }
        }
        if (p === 'skirts') {
          for (const sx of [1, -1]) {
            const len = (s.f.u - s.f.r) - (s.r.u + s.r.r) - 0.04;
            const mid = ((s.f.u - s.f.r) + (s.r.u + s.r.r)) / 2;
            acc.push(box(0.03, 0.04, Math.max(0.05, len), sx * (deform(mid, s.bottom) * W / 2 + 0.005), s.bottom + 0.015 - rh, mid));
          }
        }
        if (p === 'mirrors' && s.cabin) {
          for (const sx of [1, -1]) dark.push(box(0.06, 0.04, 0.03, sx * (W * s.cabin.w / 2 + 0.03), s.belt + 0.04 - rh, s.cabin.ws - 0.03));
        }
        if (p === 'scoop') { acc.push(box(0.2, 0.05, 0.24, 0, s.belt - 0.005 - rh, s.hoodU + 0.24, 0.06)); dark.push(box(0.15, 0.035, 0.02, 0, s.belt + 0.008 - rh, s.hoodU + 0.36)); }
        if (p === 'roofRack') {
          for (const sx of [1, -1]) acc.push(box(0.025, 0.025, (s.cabin.rf - s.cabin.rr) * 0.9, sx * W * s.cabin.w * 0.42, s.cabin.roof + 0.03 - rh, (s.cabin.rf + s.cabin.rr) / 2));
          dark.push(box(W * s.cabin.w * 0.85, 0.02, 0.025, 0, s.cabin.roof + 0.03 - rh, s.cabin.rf - 0.05));
          dark.push(box(W * s.cabin.w * 0.85, 0.02, 0.025, 0, s.cabin.roof + 0.03 - rh, s.cabin.rr + 0.05));
        }
        if (p === 'rollbar') {
          acc.push(box(W * 0.8, 0.035, 0.035, 0, s.deck.h + 0.17 - rh, s.cabin.rw - 0.06));
          for (const sx of [1, -1]) acc.push(box(0.035, 0.18, 0.035, sx * W * 0.38, s.deck.h + 0.08 - rh, s.cabin.rw - 0.06));
          this.lightBar = box(W * 0.5, 0.04, 0.04, 0, s.cabin.roof + 0.03 - rh, s.cabin.rf - 0.03);
        }
        if (p === 'lightbar' && s.cabin) this.lightBar = box(W * s.cabin.w * 0.85, 0.022, 0.03, 0, s.cabin.roof - 0.012 - rh, s.cabin.rf + 0.005);
        if (p === 'ledstrip') this.ledStrip = box(W * 0.86, 0.018, 0.02, 0, s.nose.h - 0.035 - rh, L2 + 0.002);
        if (p === 'bed') {
          dark.push(box(W * 0.78, 0.012, (L2 + s.deck.u) * 0.85, 0, s.deck.h + 0.003 - rh, (s.deck.u - L2) / 2));
          for (const sx of [1, -1]) acc.push(box(0.03, 0.06, (L2 + s.deck.u) * 0.9, sx * W * 0.44, s.deck.h + 0.03 - rh, (s.deck.u - L2) / 2));
        }
        if (p === 'vents') { dark.push(box(0.08, 0.012, 0.12, 0.12, s.belt - 0.018 - rh, s.hoodU + 0.18, 0.1)); dark.push(box(0.08, 0.012, 0.12, -0.12, s.belt - 0.018 - rh, s.hoodU + 0.18, 0.1)); }
        if (p === 'intakes') for (const sx of [1, -1]) dark.push(box(0.03, 0.08, 0.16, sx * (W / 2 - 0.0), s.bottom + 0.16 - rh, s.r.u + s.r.r + 0.14));
        if (p === 'frontWing') {
          acc.push(box(0.98, 0.022, 0.16, 0, 0.07 - rh, L2 - 0.08));
          acc.push(box(0.02, 0.08, 0.2, 0.49, 0.1 - rh, L2 - 0.08));
          acc.push(box(0.02, 0.08, 0.2, -0.49, 0.1 - rh, L2 - 0.08));
        }
        if (p === 'rearWing') {
          acc.push(box(0.72, 0.03, 0.17, 0, 0.6 - rh, -L2 + 0.06, 0.15));
          acc.push(box(0.72, 0.02, 0.1, 0, 0.53 - rh, -L2 + 0.08, 0.1));
          acc.push(box(0.02, 0.15, 0.22, 0.36, 0.56 - rh, -L2 + 0.07));
          acc.push(box(0.02, 0.15, 0.22, -0.36, 0.56 - rh, -L2 + 0.07));
          dark.push(box(0.04, 0.25, 0.05, 0, 0.45 - rh, -L2 + 0.1));
        }
        if (p === 'pods') {
          for (const sx of [1, -1]) {
            const g = new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.07, 0.36, 4, 8) : new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8);
            g.rotateX(Math.PI / 2); g.translate(sx * 0.2, 0.2 - rh, -0.06);
            this.podGeo = (this.podGeo || []).concat([g]);
          }
          dark.push(box(0.2, 0.05, 0.3, 0, s.belt - 0.01 - rh, -0.02));
        }
        if (p === 'driver') {
          const helm = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), this.accentMat);
          helm.position.set(0, s.belt + 0.06 - rh, -0.02);
          this.body.add(helm);
          const visor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.04), glassMat());
          visor.position.set(0, s.belt + 0.065 - rh, 0.045);
          this.body.add(visor);
          const halo = new THREE.TorusGeometry(0.13, 0.014, 6, 16, Math.PI);
          halo.rotateY(Math.PI / 2); halo.translate(0, s.belt + 0.03 - rh, 0.0);
          dark.push(halo);
        }
      }
      if (acc.length) { const m = new THREE.Mesh(merge(acc), this.accentMat); m.castShadow = true; this.body.add(m); }
      if (this.podGeo) this.body.add(new THREE.Mesh(merge(this.podGeo), this.paintMat));
      if (dark.length) this.body.add(new THREE.Mesh(merge(dark), darkMat()));
      if (this.lightBar || this.ledStrip) this.body.add(new THREE.Mesh(merge([this.lightBar, this.ledStrip]), headMat()));

      // topper
      const tdef = BL.ITEM_BY_ID[(loadout.topper && loadout.topper.id) || 'topper_none'];
      this.topper = M.buildTopper(tdef, loadout.topper && loadout.topper.paint);
      if (this.topper) {
        const g = this.topper.group;
        if (s.cabin) g.position.set(0, s.cabin.roof + 0.012 - rh, (s.cabin.rf + s.cabin.rr) / 2);
        else g.position.set(0, s.belt + 0.13 - rh, -0.02);
        g.scale.setScalar(TOPPER_SCALE);
        this.body.add(g);
      }
      // antenna
      const adef = BL.ITEM_BY_ID[(loadout.antenna && loadout.antenna.id) || 'antenna_none'];
      this.antenna = M.buildAntenna(adef, loadout.antenna && loadout.antenna.paint);
      if (this.antenna) {
        this.antenna.pivot.position.set(W * 0.3 * (s.open ? 0.5 : 1), (s.open ? s.deck.h : s.deck.h) - rh, s.open ? -0.3 : U.lerp(s.deck.u, -L2, 0.3));
        this.body.add(this.antenna.pivot);
      }
    }

    buildFlames(s, loadout) {
      const bdef = BL.ITEM_BY_ID[(loadout.boost && loadout.boost.id) || 'boost_standard'] || BL.ITEM_BY_ID.boost_standard;
      this.boostDef = bdef;
      const paint = loadout.boost && loadout.boost.paint;
      this.boostPaint = paint ? BL.PAINT_BY_ID[paint].color : null;
      this.boostStyle = BL.BoostFX.style(bdef, this.boostPaint);
      this.flames = [];
      this.exhaustSize = this.exhausts.map(() => 0.8);
      this.fitFlames();
    }

    // one flame jet per outlet (js/boostfx.js)
    fitFlames() {
      for (const f of this.flames) this.body.remove(f);
      this.flames = this.exhausts.map((e, i) => {
        const f = BL.BoostFX.jet(this.boostStyle);
        f.position.copy(e);
        f.userData.size = this.exhaustSize[i] || 1;
        this.body.add(f);
        return f;
      });
    }

    // Real 3D model override (see js/assets.js). Falls back to the procedural body if it can't load.
    tryAsset(bodyDef, baseColor) {
      const cfg = BL.ASSETS && BL.ASSETS.cars && BL.ASSETS.cars[bodyDef.id];
      if (!cfg || !THREE.GLTFLoader) return;
      // downloaded cars: off on Low / Very Low; on file:// they come from the packed HQ copies
      if (cfg.hq) { if (q() === 'low') return; BL.HQ.when(() => BL.HQ.car(cfg.url, () => { if (!this.disposed) this.loadAsset(cfg, bodyDef, baseColor); })); return; }
      if (location.protocol === 'file:' && !(BL.EMBED && BL.EMBED[cfg.url])) return;
      this.loadAsset(cfg, bodyDef, baseColor);
    }

    loadAsset(cfg, bodyDef, baseColor) {
      if (location.protocol === 'file:' && !BL.HQ.url(cfg.url).startsWith('data:')) return;
      M.loadGLTF(cfg.url, (gltf) => {
        if (this.disposed) return;
        // rigged models (bones, e.g. Samus' Gunship): a copy of a skinned mesh loses its skeleton and vanishes, so
        // each skinned mesh is baked once (on the loaded original) into a plain mesh: every vertex where its bones put
        // it in the modelled pose, in the model's own space
        if (!gltf.userData.unskinned) {
          gltf.userData.unskinned = true;
          const skinned = [];
          gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
          gltf.scene.updateMatrixWorld(true);
          const v = new V3();
          for (const o of skinned) {
            o.skeleton.update();
            const geo = o.geometry.clone(), pos = geo.attributes.position;
            // (this three.js's boneTransform takes the vertex's own position in `v` and returns it skinned)
            for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); pos.setXYZ(i, v.x, v.y, v.z); }
            geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
            if (geo.attributes.normal) geo.computeVertexNormals();
            geo.computeBoundingBox(); geo.computeBoundingSphere();
            const plain = new THREE.Mesh(geo, o.material);
            plain.name = o.name;
            o.parent.remove(o);
            gltf.scene.add(plain);
          }
        }
        if (!gltf.userData.merged) { gltf.userData.merged = true; mergeModelParts(gltf.scene, cfg); }
        const obj = gltf.scene.clone(true);
        if (cfg.rotationY) obj.rotation.y = cfg.rotationY;
        const bb = new THREE.Box3().setFromObject(obj);
        const size = bb.getSize(new V3());
        // fit the model to its hitbox: long enough AND wide enough (open-wheel/kart models are narrow & long)
        const hb = BL.HITBOXES[bodyDef.hitbox || 'octane'];
        const fitL = (hb.L * 1.08) / Math.max(0.01, size.z), fitW = (hb.W * 1.04) / Math.max(0.01, size.x);
        // fit 'length': the model's length is fitScale x the hitbox length (keeps real cars' height on the hitbox too)
        const sc = (cfg.scale || 1) * (cfg.fit === 'length' ? (hb.L * (cfg.fitScale || 1.1)) / Math.max(0.01, size.z) : Math.min(Math.max(fitL, fitW), fitL * 1.45));
        obj.scale.setScalar(sc);
        // fitWidth / fitHeight: stretch width (incl. wheels) to that fraction of the hitbox width, and the roofline
        // (from the ground) to that fraction of the hitbox top, keeping the fitted length
        if (cfg.fitWidth || cfg.fitHeight) {
          obj.updateMatrixWorld(true);
          const s1 = new THREE.Box3().setFromObject(obj).getSize(new V3());
          const side = Math.abs(Math.sin(cfg.rotationY || 0)) > 0.7 ? 'z' : 'x'; // model axis that ends up across the car
          if (cfg.fitWidth) obj.scale[side] *= (hb.W * cfg.fitWidth) / Math.max(0.01, s1.x);
          if (cfg.fitHeight) obj.scale.y *= ((0.2 + hb.H) * cfg.fitHeight) / Math.max(0.01, s1.y);
        }
        obj.updateMatrixWorld(true);
        const bb2 = new THREE.Box3().setFromObject(obj);
        const c = bb2.getCenter(new V3());
        const off = cfg.offset || [0, 0, 0];
        obj.position.set(-c.x + off[0], -this.style.restH - bb2.min.y + off[1], -c.z + off[2]);
        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj);
        // team paint: recolor the model's main color swatch (Kenney palette textures) or named paint materials; a
        // model with neither has its body shell painted: the material covering the most surface (found once per model)
        const wheelish = new RegExp(cfg.wheelParts || cfg.wheels || 'wheel|tire|tyre', 'i');
        const inWheel = (o) => { for (let p = o; p && p !== obj; p = p.parent) if (wheelish.test(p.name || '') || (p.material && wheelish.test(p.material.name || ''))) return true; return false; };
        let paintSrc = cfg.paintMaterial;
        if (!paintSrc && !cfg.autoPaint) {
          if (gltf.userData.shellPaint === undefined) gltf.userData.shellPaint = M.shellMaterial(obj, inWheel);
          paintSrc = gltf.userData.shellPaint;
        }
        const paintRe = new RegExp(paintSrc || 'paint|carpaint', 'i');
        let paintTex = null;
        const paintMeshes = [];
        // where the decal goes: each painted mesh, with the paint swatch's UV rectangle on palette-textured models
        const decalMeshes = [];
        obj.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          const m0 = o.material;
          if (!m0) return;
          let m = m0.clone();
          m.userData = {};
          // see-through (transmission) paint and maps on a second UV set (this three.js reads only the first) draw
          // as patchy glass on a car body: plain opaque paint instead
          if (m.transmission) { m.transmission = 0; m.transmissionMap = null; }
          if (cfg.firstUvOnly) { m.roughnessMap = null; m.metalnessMap = null; }
          if (cfg.autoPaint && m.map && m.map.image) {
            if (!paintTex) paintTex = M.teamPaletteTexture(obj, m.map, baseColor);
            if (paintTex) { m.map = paintTex; if (!inWheel(o)) decalMeshes.push([o, paintTex.userData.paintCell]); }
          } else if (paintRe.test(m.name || '')) {
            m.color = new THREE.Color(baseColor);
            if (m.map) m.map = M.neutralMap(m.map);
            paintMeshes.push(o); decalMeshes.push([o, null]);
          }
          const isPaint = paintMeshes.indexOf(o) >= 0;
          if (q() === 'low') { const lm = new THREE.MeshLambertMaterial({ map: m.map, color: m.color }); m.dispose(); m = lm; }
          else if (isPaint && this.finishDef) { const fm = finishModelPaint(m, this.finishDef, baseColor, this.finishCol); m.dispose(); m = fm; }
          else { m.envMap = M.envMap; m.envMapIntensity = 0.7; if (m.roughness != null) m.roughness = Math.min(m.roughness, 0.45); if (m.metalness != null) m.metalness = Math.max(m.metalness, 0.15); }
          o.material = m;
          this.mats.push(m);
        });
        // decal laid over the model's paint (projected: the model's UVs belong to its own textures)
        const dd = this.decal && this.decal.def;
        if (decalMeshes.length && dd && dd.pattern && dd.pattern !== 'none' && q() !== 'low') {
          const tex = M.decalOverlay(dd.pattern, this.decal.base, this.decal.accent, this.decal.paint);
          if (tex) {
            this.textures.push(tex);
            this.group.updateMatrixWorld(true);
            const toBody = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
            // wrap around the painted shell itself (not the wheels or a tall wing), like the built-in bodies
            const shell = new THREE.Box3();
            for (const [o] of decalMeshes) shell.union(M.bodySpaceBox(o, toBody));
            if (dd.animated) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true; this.animTex = { tex, kind: dd.pattern, anim: dd.anim || null, bpm: dd.bpm || 0 }; }
            for (const [o, cell] of decalMeshes) {
              const u = M.projectDecal(o.material, tex, new THREE.Matrix4().multiplyMatrices(toBody, o.matrixWorld), shell, dd.animated ? tex : null, cell, dd.anim === 'space' ? starLayer() : null);
              // one shared set of moving uniforms for all the paint meshes
              if (this.decalU) { for (const k of ['decalGlow', 'decalTint', 'decalStarOff', 'decalWarp']) if (u[k]) u[k] = this.decalU[k]; } else this.decalU = u;
            }
          }
        }
        // wheels built from loose parts (tyre, rim, bolts, brake... as separate meshes, cfg.wheelParts matching mesh or
        // material names): each corner's parts go into one node, so they turn as one wheel and wheel items can take over
        if (cfg.wheelParts) {
          const partRe = new RegExp(cfg.wheelParts, 'i'), corners = {};
          obj.updateMatrixWorld(true);
          const parts = [];
          obj.traverse((o) => { if (o.isMesh && (partRe.test(o.name || '') || partRe.test((o.material && o.material.name) || ''))) parts.push(o); });
          const cb = new V3();
          for (const o of parts) {
            new THREE.Box3().setFromObject(o).getCenter(cb);
            const key = (cb.z > 0 ? 'F' : 'R') + (cb.x > 0 ? 'L' : 'R');
            (corners[key] = corners[key] || []).push(o);
          }
          for (const key of Object.keys(corners)) {
            const box = new THREE.Box3();
            corners[key].forEach((o) => box.expandByObject(o));
            const g = new THREE.Group();
            g.name = 'wheelgroup_' + key;
            obj.add(g);
            g.position.copy(obj.worldToLocal(box.getCenter(new V3())));
            g.updateMatrixWorld(true);
            corners[key].forEach((o) => g.attach(o));
          }
        }
        // animate the model's own wheels
        this.modelWheels = [];
        if (cfg.modelWheels) {
          // wheel nodes by name (cfg.wheels, e.g. 'Dieci'); front/side come from where they sit on the car
          const wheelRe = new RegExp(cfg.wheelParts ? '^wheelgroup_' : cfg.wheels || 'wheel|tire|tyre', 'i');
          const inv = new THREE.Quaternion(), wp = new V3();
          obj.traverse((o) => {
            if (o === obj || !wheelRe.test(o.name || '')) return;
            if (o.parent && wheelRe.test(o.parent.name || '')) return;
            const wb = new THREE.Box3().setFromObject(o);
            wb.getCenter(wp);
            // the car's axle (x) and up (y) axes, expressed in the wheel's parent space (models come z-up, y-up, scaled...)
            o.parent.getWorldQuaternion(inv).invert();
            const front = wp.z > 0;
            this.modelWheels.push({
              node: o, front, idx: (front ? 0 : 2) + (wp.x > 0 ? 0 : 1),
              base: o.quaternion.clone(), basePos: o.position.clone(),
              axle: new V3(1, 0, 0).applyQuaternion(inv), up: new V3(0, 1, 0).applyQuaternion(inv),
              ps: o.parent.getWorldScale(new V3()).x || 1, r: Math.max(0.05, (wb.max.y - wb.min.y) / 2), center: wp.clone(),
            });
          });
        }
        // an equipped wheels item (anything but Stock) takes over from the model's own wheels, at the same spots
        // (painted Stock too: the model's own wheels can't take a paint, our stock rim can)
        const lw = this.loadout.wheels;
        const itemWheels = lw && lw.id && (lw.id !== 'wheels_stock' || lw.paint) && this.modelWheels.length === 4 && this.wheels.length === 4;
        if (itemWheels) {
          for (const mw of this.modelWheels) {
            mw.node.visible = false;
            const w = this.wheels[mw.idx];
            w.pivot.position.copy(mw.center);
            w.baseY = mw.center.y;
            w.spin.scale.setScalar(mw.r / w.r);
          }
          this.modelWheels = [];
        }
        // wheel decal on the model's own wheels: a ring on each one's sidewall, parented to the wheel so it spins with it.
        // (obj isn't on the car yet, so its world space here is the car's; rings are made once per wheel of a model)
        if (this.modelWheels.length && this.hasWheelDecal()) {
          obj.updateMatrixWorld(true);
          const rings = gltf.userData.wheelRings || (gltf.userData.wheelRings = {});
          for (const mw of this.modelWheels) {
            if (!rings[mw.idx]) {
              const inv = new THREE.Matrix4().copy(mw.node.matrixWorld).invert(), parts = [];
              const ax = new V3(mw.center.x > 0 ? 1 : -1, 0, 0).transformDirection(inv);
              mw.node.traverse((o) => { if (o.isMesh) parts.push({ geo: o.geometry, rel: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }); });
              // (6 mm off the tyre, in the wheel's own units)
              const unit = ax.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(mw.node.matrixWorld)).length();
              rings[mw.idx] = ringGeo(measureWheel(parts, ax), ax, 0.006 / unit);
            }
            mw.node.add(this.wheelDecalMesh(rings[mw.idx]));
          }
        }
        // hide the procedural body (keep topper, antenna, boost flames; keep wheels only if the model has none)
        const keepWheels = itemWheels || (!this.modelWheels.length && !cfg.hideWheels);
        this.body.children.forEach((ch) => {
          const isWheel = this.wheels.some((w) => w.pivot === ch) || (this.wheelInst && this.wheelInst.some((it) => it.im === ch));
          const isExtra = (this.topper && ch === this.topper.group) || (this.antenna && ch === this.antenna.pivot) || this.flames.indexOf(ch) >= 0;
          if (!isExtra && !(isWheel && keepWheels)) { ch.visible = false; ch.matrixAutoUpdate = false; ch.matrixWorldAutoUpdate = false; }
        });
        // move extras onto the new body
        const rearZ = box.min.z + 0.02, midY = box.min.y + (box.max.y - box.min.y) * 0.32;
        if (cfg.exhausts && cfg.exhausts.length) {
          // the model's real boost outlets: [x of half-width, y of height from the bottom, z of half-length, size].
          // How deep each one sits is measured by looking in from behind (once per model): the flame starts on the
          // surface of the pipe or vent itself
          if (!gltf.userData.outlets) {
            const hw = (box.max.x - box.min.x) / 2, h = box.max.y - box.min.y, hl = (box.max.z - box.min.z) / 2, cz = (box.min.z + box.max.z) / 2;
            const rc = new THREE.Raycaster(), from = new V3(), back = new V3(0, 0, 1);
            obj.updateMatrixWorld(true);
            gltf.userData.outlets = cfg.exhausts.map((e) => {
              const p = new V3(e[0] * hw, box.min.y + e[1] * h, cz + e[2] * hl);
              rc.set(from.set(p.x, p.y, box.min.z - 1), back);
              const hit = rc.intersectObject(obj, true)[0];
              if (hit) p.z = Math.min(hit.point.z - 0.004, p.z + 0.25);
              return p;
            });
          }
          this.exhausts = gltf.userData.outlets.map((p) => p.clone());
          this.exhaustSize = cfg.exhausts.map((e) => e[3] || 1);
        } else this.exhausts.forEach((e, i) => { e.set(this.exhausts.length > 1 ? (i ? 0.13 : -0.13) : 0, midY, rearZ - 0.03); });
        this.fitFlames();
        if (this.topper && gltf.userData.roof) { this.topper.group.position.copy(gltf.userData.roof); this.topper.group.scale.setScalar(TOPPER_SCALE); }
        else if (this.topper) {
          // toppers sit on the roof: rays down the car at the centre and 30% out to each side (front 60% of the
          // cabin span, so never the rear wing). A row's height is its lowest hit, so only a wide surface counts
          // (a narrow vent or fin behind the roof, like the Octane's, doesn't); take the highest row and centre on
          // the flat part around it
          const rc = new THREE.Raycaster(), hl = (box.max.z - box.min.z) / 2, cz = (box.min.z + box.max.z) / 2, hits = [];
          const hwx = (box.max.x - box.min.x) / 2;
          for (let k = -0.4; k <= 0.3; k += 0.05) {
            let y = Infinity;
            for (const fx of [-0.3, 0, 0.3]) {
              rc.set(new V3(fx * hwx, box.max.y + 1, cz + k * hl), new V3(0, -1, 0));
              const h = rc.intersectObject(obj, true)[0];
              y = h ? Math.min(y, h.point.y) : -Infinity;
            }
            if (y > -Infinity) hits.push(new V3(0, y, cz + k * hl));
          }
          const top = hits.reduce((m, p) => Math.max(m, p.y), -Infinity);
          const roof = hits.filter((p) => p.y > top - 0.02);
          if (roof.length) this.topper.group.position.set(0, top - 0.005, roof.reduce((s, p) => s + p.z, 0) / roof.length);
          else this.topper.group.position.set(0, box.max.y - 0.01, cz - 0.05);
          this.topper.group.scale.setScalar(TOPPER_SCALE);
          gltf.userData.roof = this.topper.group.position.clone();
        }
        if (this.antenna) {
          // at the back corner, on whatever is there: straight down onto the body (once per model). A thin wing over a
          // gap (a rear spoiler) is passed over for the body under it
          if (!gltf.userData.antenna) {
            const ax = box.max.x - Math.min(0.12, (box.max.x - box.min.x) * 0.12), az = box.min.z + (box.max.z - box.min.z) * 0.2;
            const rc = new THREE.Raycaster(); obj.updateMatrixWorld(true);
            rc.set(new V3(ax, box.max.y + 1, az), new V3(0, -1, 0));
            const hs = rc.intersectObject(obj, true).filter((h) => h.object.visible);
            let y = box.min.y + (box.max.y - box.min.y) * 0.62;
            if (hs.length) { y = hs[0].point.y; if (hs.length > 2 && hs[0].point.y - hs[1].point.y < 0.08 && hs[1].point.y - hs[2].point.y > 0.1) y = hs[2].point.y; }
            gltf.userData.antenna = new V3(ax, y - 0.004, az);
          }
          this.antenna.pivot.position.copy(gltf.userData.antenna);
        }
        this.body.add(obj);
        this.assetObj = obj;
      });
    }

    // boost trail in the boost's own colour while boosting, white supersonic streaks from the rear corners;
    // Low draws shorter ribbons and a single streak
    updateTrails(car) {
      const scene = this.group.parent, cam = BL.App && BL.App.camera;
      if (!scene || !cam) return;
      const low = q() === 'low', now = this.time;
      if (!this.trails) {
        const rb = this.boostStyle.ribbon, life = (rb.life || 0.3) * (low ? 0.8 : 1);
        // one ribbon down the middle, or one per side of the car when its outlets are far apart
        const wide = this.exhausts.some((e) => Math.abs(e.x) > 0.16);
        const sides = wide ? [this.exhausts.filter((e) => e.x > 0), this.exhausts.filter((e) => e.x < 0)].filter((l) => l.length) : [this.exhausts];
        const boost = sides.map((outlets) => {
          const r = new Ribbon(low ? 10 : 18, life, rb.w, !rb.solid);
          r.color.set(rb.col); r.rainbow = !!rb.rainbow; r.outlets = outlets;
          return r;
        });
        const streaks = [];
        for (let i = 0; i < (low ? 1 : 2); i++) { const r = new Ribbon(low ? 12 : 22, 0.55, 0.16, true); r.color.setRGB(0.85, 0.95, 1); streaks.push(r); }
        this.trails = { boost, streaks };
        for (const r of boost.concat(streaks)) scene.add(r.mesh);
      }
      const T = this.trails;
      this.group.updateMatrixWorld();
      if (car.boosting && !car.demolished) {
        for (const r of T.boost) {
          _ra.set(0, 0, 0);
          for (const e of r.outlets) _ra.add(e);
          _ra.multiplyScalar(1 / r.outlets.length).applyMatrix4(this.group.matrixWorld);
          r.push(_ra, now);
        }
      }
      if (car.supersonic && !car.demolished) {
        const e0 = this.exhausts[0], hw = (this.assetObj ? 0.3 : this.style.W * 0.4);
        T.streaks.forEach((r, i) => {
          _rb.set(T.streaks.length > 1 ? (i ? -hw : hw) : 0, e0 ? e0.y + 0.06 : 0, e0 ? e0.z : -0.6).applyMatrix4(this.group.matrixWorld);
          r.push(_rb, now);
        });
      }
      for (const r of T.boost) r.update(now, cam);
      for (const r of T.streaks) r.update(now, cam);
    }

    // Moving decals follow the car. How fast every animated decal runs and how bright it glows go with the car's
    // speed, boost lights it up, and any sudden knock (the ball, a bump, a flip, a hard landing) flashes it. The
    // reactive ones go further: what's on them moves with the car, so driving forward flies you through it, reversing
    // runs it backward, and jumping or spinning shifts it; on the real models the star layers slide at their own rates
    // and stretch into streaks near top speed. On a turntable (no car) a slow made-up drive shows it off.
    updateDecal(dt, car, boosting) {
      const a = this.animTex, off = a.tex.offset, t = this.time, wrap = (x) => x - Math.floor(x);
      const R = this.react || (this.react = { speed: 0, boost: 0, hit: 0, x: 0, y: 0, ph: 0, hue: 0, v: null });
      let sp, fs, us, tw = 0, tl = 0;
      if (car) {
        const v = car.vel;
        if (R.v && dt > 0) { const kick = Math.hypot(v.x - R.v.x, v.y - R.v.y, v.z - R.v.z); if (kick > 3.5) R.hit = Math.max(R.hit, Math.min(1, kick / 9)); }
        (R.v || (R.v = new V3())).copy(v);
        sp = v.length(); fs = v.dot(car.fwd); us = v.dot(car.up);
        if (car.angVel) { tw = car.angVel.dot(car.up) * 2.2; tl = car.angVel.dot(car.left) * 1.6 + car.angVel.dot(car.fwd) * 1.6; }
      } else { fs = sp = 8 + 7 * Math.sin(t * 0.7); us = 1.4 * Math.sin(t * 0.43); }
      R.speed += (Math.min(1, sp / 23) - R.speed) * (1 - Math.exp(-6 * dt));
      R.boost += ((boosting ? 1 : 0) - R.boost) * (1 - Math.exp(-(boosting ? 12 : 4) * dt));
      R.hit *= Math.exp(-5 * dt);
      R.x += (fs + tw) * dt; R.y += (us + tl) * dt;
      const S = R.speed, B = R.boost, kind = a.anim;
      let k = 0;
      if (kind === 'space') { off.x = wrap(R.x * 0.03); k = 0.1 + 0.4 * S; }
      else if (kind === 'drift') { off.x = wrap(R.x * 0.02 + t * 0.015); k = 0.25 + 0.75 * S; }
      else if (kind === 'heat') { off.x = wrap(off.x - dt * (0.02 + 0.2 * S)); k = 0.3 + 0.9 * S + 0.1 * Math.sin(t * 3); }
      else if (kind === 'pulse') { R.ph += dt * (3 + 8 * S + 3 * B); k = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(R.ph)); }
      else if (kind === 'flicker') { R.ph += dt * (0.8 + 2 * S); k = Math.sin(R.ph * 31) > 0.2 - 0.6 * S || Math.sin(R.ph * 7.3) > 0.6 ? 1.1 : 0.15; }
      else if (a.kind === 'coderain') off.y = wrap(off.y + dt * (0.12 + 0.9 * S + 0.5 * B));
      else if (kind === 'race') { off.x = wrap(off.x - dt * (0.35 + 2.2 * S + B)); k = 0.9 * (0.6 + 0.5 * S); }
      else if (kind === 'flow') { off.x = wrap(off.x - dt * (0.15 + 1.1 * S)); k = 0.7 + 0.3 * Math.sin(t * 2); }
      else if (kind === 'rise' || kind === 'fall') { off.y = wrap(off.y + (kind === 'rise' ? -1 : 1) * dt * (0.06 + 0.4 * S + 0.25 * B)); off.x = wrap(off.x - dt * 0.2 * S); k = 0.45 + 0.55 * S; }
      else if (kind === 'scan') { R.ph += dt * (1.6 + 3 * S); off.x = wrap(0.16 * Math.sin(R.ph)); k = 0.75 + 0.35 * Math.abs(Math.cos(R.ph)); }
      // (a song decal beats at its song's tempo, only a little faster when the car moves)
      else if (kind === 'beat') { R.ph += dt * (a.bpm ? (a.bpm / 60) * (1 + 0.15 * S) : 2.13 + 1.2 * S) * Math.PI * 2; off.x = wrap(off.x - dt * (0.05 + 0.3 * S)); k = 0.25 + 1.15 * Math.pow(Math.max(0, Math.sin(R.ph)), 6); }
      else if (kind === 'glitch') { R.gt = (R.gt || 0) - dt; if (R.gt <= 0) { R.gt = U.rand(0.04, 0.5) / (1 + 2 * S); off.x = Math.random(); off.y = Math.random() < 0.3 ? U.rand(-0.02, 0.02) : 0; } k = R.gt < 0.07 ? 1.5 : 0.45; }
      else { off.x = wrap(off.x - dt * (0.1 + 0.9 * S)); if (kind === 'hue') k = 0.9 * (0.6 + 0.5 * S); }
      if (this.glowTex) this.glowTex.offset.copy(off);
      k += 0.6 * B + 1.2 * R.hit;
      const em = this.paintMat && this.paintMat.emissiveMap;
      if (kind === 'hue' && !(this.decal && this.decal.paint)) {
        // Hue Shift: the glow runs through the rainbow, faster the more you move
        R.hue = wrap(R.hue + dt * (0.06 + 0.4 * S + 0.3 * B));
        if (this.decalU) this.decalU.decalTint.value.setHSL(R.hue, 1, 0.6);
        if (em) this.paintMat.emissive.setHSL(R.hue, 1, 0.55);
      }
      if (em) this.paintMat.emissiveIntensity = k;
      else if (this.paintBase) this.paintMat.color.copy(this.paintBase).multiplyScalar(1 + 0.7 * k);
      if (this.decalU) {
        this.decalU.decalGlow.value = k;
        if (this.decalU.decalStarOff) {
          this.decalU.decalStarOff.value.set(wrap(R.x * 0.11), wrap(R.y * 0.05), wrap(R.x * 0.065), wrap(R.y * 0.03));
          this.decalU.decalWarp.value = Math.min(1, Math.max(0, (S - 0.5) / 0.4) + 0.5 * B * S);
        }
      }
    }

    update(dt, car) {
      this.time += dt;
      if (car) this.updateTrails(car);
      // wheels
      for (let wi = 0; wi < this.wheels.length; wi++) {
        const w = this.wheels[wi];
        if (car) {
          w.spin.rotation.x = car.wheelSpin * (0.18 / w.r);
          w.pivot.rotation.y = w.front ? -car.steerVis * 0.45 : 0;
          const wd = car.wheelDefs && car.wheelDefs[wi];
          w.pivot.position.y = wd ? w.baseY + U.clamp(wd.comp - car.eqComp, -0.07, 0.08) : w.baseY;
        }
        if (w.glowMat) {
          if (w.anim === 'hue') w.glowMat.color.setHSL((this.time * 0.15) % 1, 1, 0.55);
          else if (w.anim === 'pulse') w.glowMat.color.copy(w.baseGlow).multiplyScalar(0.55 + 0.45 * Math.sin(this.time * 6));
        }
      }
      if (this.wheelInst && this.wheelInst.length && this.wheelInst[0].im.visible) {
        for (let wi = 0; wi < 4; wi++) {
          const w = this.wheels[wi];
          w.pivot.updateMatrix(); w.spin.updateMatrix();
          _wm.multiplyMatrices(w.pivot.matrix, w.spin.matrix);
          for (const it of this.wheelInst) it.im.setMatrixAt(wi, _wm2.multiplyMatrices(_wm, w.spin.children[it.idx].matrix));
        }
        for (const it of this.wheelInst) it.im.instanceMatrix.needsUpdate = true;
      }
      if (this.modelWheels) {
        for (let wi = 0; wi < this.modelWheels.length; wi++) {
          const w = this.modelWheels[wi];
          // (still on the showroom turntable: the real garage's wheels don't turn)
          const spin = car ? car.wheelSpin * (0.18 / Math.max(0.08, w.r)) : 0;
          _qa.setFromAxisAngle(w.axle, spin);
          _qb.setFromAxisAngle(w.up, car && w.front ? -car.steerVis * 0.45 : 0);
          w.node.quaternion.copy(_qb).multiply(_qa).multiply(w.base);
          const wd = car && car.wheelDefs && car.wheelDefs[w.idx];
          w.node.position.copy(w.basePos);
          if (wd) w.node.position.addScaledVector(w.up, U.clamp(wd.comp - car.eqComp, -0.07, 0.08) / w.ps);
        }
      }
      // flames
      const boosting = car ? car.boosting : this.previewBoost;
      BL.BoostFX.pose(this, dt, !!boosting, !!(car && car.supersonic));
      if (this.animTex) this.updateDecal(dt, car, boosting);
      if (this.topper) {
        if (this.topper.spin) this.topper.spin.rotation.y += dt * (car ? 4 + car.vel.length() * 0.8 : 6);
        if (this.topper.bob) this.topper.bob.position.y = 0.17 + Math.sin(this.time * 3) * 0.015;
        if (this.topper.flames && BL.FX && Math.random() < dt * 30) {
          this.topper.group.getWorldPosition(_v);
          BL.FX.spawnFlame(_v);
        }
      }
      if (this.antenna && car) {
        const a = this.antenna;
        // spring sway from acceleration (in car local space)
        const ax = car.vel.dot(car.left) - (this.prevLat || 0), az = car.vel.dot(car.fwd) - (this.prevFwd || 0);
        this.prevLat = car.vel.dot(car.left); this.prevFwd = car.vel.dot(car.fwd);
        a.vx += (-a.sx * 60 - a.vx * 6) * dt - az * 0.6;
        a.vz += (-a.sz * 60 - a.vz * 6) * dt + ax * 0.6;
        a.sx += a.vx * dt; a.sz += a.vz * dt;
        a.sx = U.clamp(a.sx, -0.6, 0.6); a.sz = U.clamp(a.sz, -0.6, 0.6);
        a.pivot.rotation.x = -a.sx; a.pivot.rotation.z = a.sz;
        if (a.spin) a.top.rotation.y += dt * 2;
      }
      // the flag ripples, harder and faster the quicker the car goes
      if (this.antenna && this.antenna.flag && q() !== 'low') {
        const f = this.antenna.flag, P = f.geo.attributes.position.array, sp = car ? Math.min(1, car.vel.length() / 23) : 0.25;
        const t = this.time * (7 + sp * 9), amp = 0.012 + sp * 0.02;
        for (let i = 0; i < P.length; i += 3) { const u = f.base[i] / 0.16; P[i + 2] = f.base[i + 2] + Math.sin(t - u * 5.5) * amp * u; P[i] = f.base[i] * (1 - sp * 0.06 * u); }
        f.geo.attributes.position.needsUpdate = true;
      }
      if (this.antenna && this.antenna.flames && BL.FX && BL.FX.add && Math.random() < dt * 30) {
        this.antenna.top.getWorldPosition(_v);
        _v.y += 0.06;
        BL.FX.spawnFlame(_v);
      }
    }

    worldExhausts(out) {
      for (let i = 0; i < this.exhausts.length; i++) {
        out[i] = out[i] || new V3();
        out[i].copy(this.exhausts[i]).applyMatrix4(this.group.matrixWorld);
      }
      out.length = this.exhausts.length;
      return out;
    }

    dispose() {
      this.disposed = true;
      if (this.trails) { this.trails.boost.forEach((r) => r.dispose()); this.trails.streaks.forEach((r) => r.dispose()); this.trails = null; }
      const tires = Object.values(tireGeoCache);
      const done = new Set();
      this.group.traverse((o) => {
        if (!o.isMesh) return;
        if (o.geometry && !o.geometry.userData.shared && tires.indexOf(o.geometry) < 0 && !done.has(o.geometry)) { done.add(o.geometry); o.geometry.dispose(); }
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m && !m.userData.shared && !done.has(m)) { done.add(m); if (m.map && m.map !== this.textures[0] && !m.map.userData.shared) m.map.dispose(); m.dispose(); }
      });
      this.textures.forEach((t) => t.dispose());
      if (this.group.parent) this.group.parent.remove(this.group);
    }
  }
  M.CarModel = CarModel;

  // dark paints (Black, Grey...) can't glow: their boost is drawn as dark smoke instead of added light
  M.darkPaint = (hex) => { if (!hex) return false; const [r, g, b] = hexRGB(hex); return 0.299 * r + 0.587 * g + 0.114 * b < 70; };

  // small 3D render of a built-in body for the item grid; null means "use the 2D silhouette"
  let thumbKit = null;
  M.bodyThumb = function (def, color) {
    const r = BL.App && BL.App.renderer;
    if (!r || BL.App.potato || def.custom || !BL.RLCars || !BL.RLCars.has(def.style)) return null;
    const W = 320, H = 160;
    if (!thumbKit) {
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xe8eeff, 0x2a2e36, 0.65));
      const sun = new THREE.DirectionalLight(0xffffff, 1.25); sun.position.set(2, 4, 3); scene.add(sun);
      const rim = new THREE.DirectionalLight(0x9fc4ff, 0.6); rim.position.set(-3, 2, -3); scene.add(rim);
      const cam = new THREE.PerspectiveCamera(13, W / H, 0.1, 30);
      cam.position.set(-2.7, 1.3, 3.0); cam.lookAt(0, 0, 0);
      const rt = new THREE.WebGLRenderTarget(W, H);
      rt.texture.encoding = THREE.sRGBEncoding; // three applies tone mapping + sRGB before storing, so no banding
      thumbKit = { scene, cam, rt, px: new Uint8Array(W * H * 4) };
    }
    const T = thumbKit;
    const lo = { body: { id: def.id }, blue: color || BL.TEAM_COLORS[0][0], orange: BL.TEAM_COLORS[1][0], accent: '#f5f5f5' };
    const m = new CarModel(lo, 0, { noAsset: true });
    m.group.position.y = m.style.restH - 0.3;
    T.scene.add(m.group);
    const prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(T.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(T.scene, T.cam);
    r.readRenderTargetPixels(T.rt, 0, 0, W, H, T.px);
    r.setRenderTarget(prevRT);
    r.setClearColor(prevClear, prevAlpha);
    T.scene.remove(m.group);
    m.dispose();
    // flip rows (GL reads bottom-up), then halve for smooth edges
    const big = U.canvas(W, H), img = big.g.createImageData(W, H), row = W * 4;
    for (let y = 0; y < H; y++) img.data.set(T.px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    big.g.putImageData(img, 0, 0);
    const out = U.canvas(W / 2, H / 2);
    out.g.drawImage(big.c, 0, 0, W / 2, H / 2);
    return out.c.toDataURL();
  };

  // ---------- miniature 3D item pictures (like the real garage) ----------
  // Every car item is shown as a little render of the real thing in neutral white: a whole car for bodies, decals
  // and paint finishes (the real models too), the front wheel up close for wheels, the roof for toppers...
  // Async (downloaded models load first); one at a time through menu.js's queue. Very Low keeps the drawings.
  let itemKit = null;
  const NEUTRAL = '#d6dbe4';
  function kit() {
    if (itemKit) return itemKit;
    const W = 320, H = 240, scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xeef3ff, 0x30343e, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(2.5, 4, 3); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xa9c8ff, 0.7); rim.position.set(-3, 2, -3); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(20, W / H, 0.05, 40);
    const rt = new THREE.WebGLRenderTarget(W, H);
    rt.texture.encoding = THREE.sRGBEncoding;
    itemKit = { W, H, scene, cam, rt, px: new Uint8Array(W * H * 4) };
    return itemKit;
  }
  function snap(obj, camPos, look, glow) {
    const r = BL.App.renderer, T = kit();
    if (obj) T.scene.add(obj);
    T.cam.position.copy(camPos); T.cam.lookAt(look);
    const far = Math.max(40, camPos.distanceTo(look) * 3);
    if (T.cam.far !== far) { T.cam.far = far; T.cam.updateProjectionMatrix(); }
    const prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(T.rt); r.setClearColor(0x000000, 0); r.clear(); r.render(T.scene, T.cam);
    r.readRenderTargetPixels(T.rt, 0, 0, T.W, T.H, T.px);
    r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevAlpha);
    if (obj) T.scene.remove(obj);
    const big = U.canvas(T.W, T.H), img = big.g.createImageData(T.W, T.H), row = T.W * 4;
    for (let y = 0; y < T.H; y++) img.data.set(T.px.subarray((T.H - 1 - y) * row, (T.H - y) * row), y * row);
    // glowing particles: the render holds light added over nothing (colour times its own alpha); as a picture that
    // shows the same over the card, each pixel's alpha is its brightness and its colour is scaled back up
    if (glow) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = Math.max(d[i + 3], d[i], d[i + 1], d[i + 2]);
        if (a > 0 && a < 255) { const k = 255 / a; d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k); }
        d[i + 3] = a;
      }
    }
    big.g.putImageData(img, 0, 0);
    // crop to the item (plus a margin), keeping 4:3, so small things like toppers fill the card too
    let x0 = T.W, y0 = T.H, x1 = 0, y1 = 0;
    const d = img.data;
    for (let y = 0; y < T.H; y += 2) for (let x = 0; x < T.W; x += 2) if (d[(y * T.W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const out = U.canvas(T.W / 2, T.H / 2);
    if (x1 > x0 && y1 > y0) {
      let w = (x1 - x0) * 1.16 + 6, h = (y1 - y0) * 1.16 + 6;
      if (w / h > 4 / 3) h = w * 0.75; else w = h * 4 / 3;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      out.g.drawImage(big.c, cx - w / 2, cy - h / 2, w, h, 0, 0, T.W / 2, T.H / 2);
    } else out.g.drawImage(big.c, 0, 0, T.W / 2, T.H / 2);
    // (how long this one held the screen up: menu.js rests twice that before the next)
    M.lastThumbMs = performance.now() - (M.thumbT0 || performance.now());
    return out.c.toDataURL();
  }
  const waitAsset = (m, ms) => new Promise((ok) => { const t0 = performance.now(); const tick = () => { if (m.assetObj || m.disposed || performance.now() - t0 > ms) ok(); else setTimeout(tick, 80); }; tick(); });
  M.canItemThumb = (def) => !!(BL.App && BL.App.renderer && !BL.App.potato) && ['body', 'decal', 'finish', 'wheels', 'wheeldecal', 'topper', 'antenna', 'boost', 'explosion'].indexOf(def.cat) >= 0;
  const fxScale = () => { const T = kit(); return T.H / (2 * Math.tan((T.cam.fov * Math.PI) / 360)); };
  // a goal explosion a moment after it goes off (the real effect, run on its own), blasting out of the goal to the
  // left of the picture and up the pitch
  async function explosionThumb(def, paint) {
    BL.FX.needModel(def.fx);
    for (let t = 0; t < 4000 && !BL.FX.modelReady(def.fx); t += 100) await new Promise((ok) => setTimeout(ok, 100));
    M.thumbT0 = performance.now();
    const col = paint ? BL.PAINT_BY_ID[paint].color : null;
    return BL.FX.offline(kit().scene, fxScale(), () => {
      BL.FX.goalExplosion(def.fx, new V3(0, 1.5, 0), BL.TEAM_MAIN[0], col);
      // (the 3D ones at their best moment)
      const n = Math.round(((BL.FX.THUMB_T || {})[def.fx] || 0.55) * 60);
      for (let i = 0; i < n; i++) BL.FX.update(1 / 60);
      return snap(null, new V3(30, 14, -44), new V3(0, 4, -8), true);
    });
  }
  M.itemThumb = async function (def, paint) {
    if (!M.canItemThumb(def)) return null;
    if (def.cat === 'explosion') return explosionThumb(def, paint);
    const base = BL.Save.resolveLoadout();
    // the showroom car for parts: your body unless it's a downloaded one still loading; bodies are themselves
    const lo = { body: def.cat === 'body' ? { id: def.id, paint } : base.body, decal: null, finish: null, wheels: null, wheeldecal: null, topper: null, antenna: null, boost: null,
      blue: def.cat === 'body' && paint ? BL.PAINT_BY_ID[paint].color : NEUTRAL, orange: NEUTRAL, accent: '#eef1f6' };
    if (def.cat !== 'body') lo[def.cat] = { id: def.id, paint: paint || null };
    if (def.cat === 'decal' && !paint) lo.decal.paint = null;
    const tc = performance.now(), m = new CarModel(lo, 0), ctor = performance.now() - tc;
    await waitAsset(m, 4000);
    if (m.disposed) return null;
    M.thumbT0 = performance.now() - ctor;
    m.group.updateMatrixWorld(true);
    m.update(0, null);
    const box = new THREE.Box3().setFromObject(m.group), c = box.getCenter(new V3()), sz = box.getSize(new V3());
    let camPos, look;
    if (def.cat === 'wheels' || def.cat === 'wheeldecal') {
      // the front-left wheel, side on
      const w = (m.modelWheels && m.modelWheels.find((x) => x.front && x.center.x > 0)) || null;
      const wp = w ? w.center.clone() : new V3(m.style.W / 2, (m.wheels[0] ? m.wheels[0].baseY : -0.2), m.wheels[0] ? m.wheels[0].pivot.position.z : 0.35);
      if (!w && m.wheels[0]) m.wheels[0].pivot.getWorldPosition(wp);
      look = wp; camPos = wp.clone().add(new V3(1.35, 0.18, 0.35));
    } else if (def.cat === 'topper' && m.topper) {
      // the topper by itself, turned a little toward the front-left and seen from a bit above
      const tg = m.topper.group, par = tg.parent;
      par.remove(tg); tg.position.set(0, 0, 0); tg.rotation.set(0, 0.45, 0); tg.scale.setScalar(1); tg.updateMatrixWorld(true);
      const tb = new THREE.Box3().setFromObject(tg), tc = tb.getCenter(new V3()), ts = tb.getSize(new V3()), dd = Math.max(ts.x, ts.y, ts.z, 0.05) * 5.2;
      const url = snap(tg, tc.clone().add(new V3(-0.5 * dd, 0.45 * dd, 0.75 * dd)), tc);
      par.add(tg); m.dispose();
      return url;
    } else if (def.cat === 'antenna' && m.antenna) {
      // the antenna's head on a short bit of its pole
      const pv = m.antenna.pivot, top = m.antenna.top, par = pv.parent, pole = pv.children.find((ch) => ch !== top);
      // (a flag turned so its front faces the camera)
      par.remove(pv); pv.position.set(0, 0, 0); pv.rotation.set(0, m.antenna.flag ? Math.PI + 0.5 : 0.5, 0);
      if (pole) pole.visible = false;
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.14, 6), darkMat()); stub.position.y = top.position.y - 0.07; pv.add(stub);
      pv.updateMatrixWorld(true);
      const tb = new THREE.Box3().setFromObject(top).union(new THREE.Box3().setFromObject(stub)), tc = tb.getCenter(new V3()), ts = tb.getSize(new V3()), dd = Math.max(ts.x, ts.y, ts.z, 0.05) * 4.6;
      const url = snap(pv, tc.clone().add(new V3(-0.55 * dd, 0.25 * dd, 0.8 * dd)), tc);
      pv.remove(stub); stub.geometry.dispose(); if (pole) pole.visible = true; par.add(pv); m.dispose();
      return url;
    } else if (def.cat === 'boost') {
      // boosting on the spot for a moment (the real trail), seen from behind and to one side
      const url = BL.FX.offline(kit().scene, fxScale(), () => {
        m.previewBoost = true;
        for (let i = 0; i < 40; i++) { m.update(1 / 60, null); m.group.updateMatrixWorld(true); BL.FX.boost(m, null, 1 / 60); BL.FX.update(1 / 60); }
        const cb = new THREE.Box3().setFromObject(m.body).getCenter(new V3());
        return snap(m.group, cb.clone().add(new V3(-4.6, 2.1, -6.4)), cb.clone().add(new V3(0, -0.1, -1.0)), true);
      });
      m.dispose();
      return url;
    } else {
      const d = Math.max(sz.x, sz.z) * 3.2;
      look = c; camPos = c.clone().add(new V3(-0.62 * d, 0.36 * d, 0.7 * d));
    }
    const url = snap(m.group, camPos, look);
    m.dispose();
    return url;
  };

  // drops: a 3D crate with glowing edges in the drop's rarity colour (frames for the spinning reveal)
  const dropCache = {};
  M.dropThumb = function (color, angle) {
    const key = color + ':' + (angle || 0).toFixed(2);
    if (dropCache[key]) return dropCache[key];
    if (!BL.App || !BL.App.renderer || BL.App.potato) return null;
    const g = new THREE.Group(), col = new THREE.Color(color);
    const shell = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.35), metalness: 0.7, roughness: 0.35, emissive: col.clone().multiplyScalar(0.12) });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shell));
    const edge = new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.35) });
    const e = 0.07, h = 0.535;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const x = new THREE.Mesh(new THREE.BoxGeometry(1.07, e, e), edge); x.position.set(0, a * h, b * h); g.add(x);
      const y = new THREE.Mesh(new THREE.BoxGeometry(e, 1.07, e), edge); y.position.set(a * h, 0, b * h); g.add(y);
      const z = new THREE.Mesh(new THREE.BoxGeometry(e, e, 1.07), edge); z.position.set(a * h, b * h, 0); g.add(z);
    }
    // emblem on the faces: a glowing ring with a shield
    const cv = U.canvas(128, 128), cg = cv.g;
    cg.strokeStyle = '#ffffff'; cg.lineWidth = 7; cg.beginPath(); cg.arc(64, 64, 42, 0, Math.PI * 2); cg.stroke();
    cg.fillStyle = '#ffffff'; cg.beginPath(); cg.moveTo(64, 34); cg.lineTo(90, 46); cg.lineTo(84, 82); cg.lineTo(64, 96); cg.lineTo(44, 82); cg.lineTo(38, 46); cg.closePath(); cg.fill();
    const et = new THREE.CanvasTexture(cv.c);
    const em = new THREE.MeshBasicMaterial({ map: et, transparent: true, color: col.clone().lerp(new THREE.Color(1, 1, 1), 0.5) });
    for (const [rx, ry, p] of [[0, 0, [0, 0, 0.505]], [0, Math.PI / 2, [0.505, 0, 0]], [-Math.PI / 2, 0, [0, 0.505, 0]]]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), em); f.rotation.set(rx, ry, 0); f.position.set(...p); g.add(f); }
    g.rotation.set(0.35, 0.75 + (angle || 0), 0);
    const url = snap(g, new V3(0, 0.35, 4.6), new V3(0, 0, 0));
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    shell.dispose(); edge.dispose(); em.dispose(); et.dispose();
    return (dropCache[key] = url);
  };

  // ---------- team paint for palette-textured models ----------
  const paletteCache = {};
  M.teamPaletteTexture = function (root, srcTex, color) {
    const img = srcTex.image;
    if (!img || !img.width) return null;
    const key = (srcTex.uuid || '') + ':' + root.uuid + ':' + color;
    if (paletteCache[key]) return paletteCache[key];
    const W = img.width, H = img.height;
    const { c, g } = U.canvas(W, H);
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, W, H).data;
    // find the most used saturated cell on the "body" mesh: that's the paint
    const counts = {};
    let body = null;
    root.traverse((o) => { if (!body && o.isMesh && /body/i.test((o.name || '') + (o.parent ? o.parent.name : ''))) body = o; });
    const cols = 8, rows = 4;
    (body ? [body] : []).concat(body ? [] : [root]).forEach((r) => r.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.uv) return;
      const uv = o.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i), v = uv.getY(i);
        const px = U.clamp(Math.floor(u * W), 0, W - 1), py = U.clamp(Math.floor(v * H), 0, H - 1);
        const k = (py * W + px) * 4;
        const R = data[k], G = data[k + 1], B = data[k + 2];
        const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
        if (mx < 70 || (mx - mn) / mx < 0.32) continue;
        const cell = U.clamp(Math.floor(u * cols), 0, cols - 1) + ',' + U.clamp(Math.floor(v * rows), 0, rows - 1);
        counts[cell] = (counts[cell] || 0) + 1;
      }
    }));
    let best = null, bc = 0;
    for (const k in counts) if (counts[k] > bc) { bc = counts[k]; best = k; }
    if (!best) return null;
    const [cx, cy] = best.split(',').map(Number);
    const cw = W / cols, ch = H / rows, x0 = cx * cw, y0 = cy * ch;
    g.fillStyle = color; g.fillRect(x0, y0, cw / 2, ch);
    const gr = g.createLinearGradient(0, y0, 0, y0 + ch);
    gr.addColorStop(0, U.shade(color, 0.25)); gr.addColorStop(1, U.shade(color, -0.35));
    g.fillStyle = gr; g.fillRect(x0 + cw / 2, y0, cw / 2, ch);
    const t = new THREE.CanvasTexture(c);
    t.flipY = srcTex.flipY; t.encoding = srcTex.encoding; t.wrapS = srcTex.wrapS; t.wrapT = srcTex.wrapT;
    t.magFilter = srcTex.magFilter; t.minFilter = srcTex.minFilter;
    t.userData.shared = true;
    t.userData.paintCell = [cx / cols, cy / rows, (cx + 1) / cols, (cy + 1) / rows]; // the paint's UVs (decals go there)
    paletteCache[key] = t;
    return t;
  };

  // a paint texture in a strong colour of its own (Samus' orange body) would turn the team colour muddy when tinted:
  // a grey copy keeping its shading and panel lines, about as bright as white paint. Neutral textures are kept.
  const neutralCache = {};
  M.neutralMap = function (tex) {
    const img = tex.image;
    if (!img || !img.width) return tex;
    if (neutralCache[tex.uuid]) return neutralCache[tex.uuid];
    const S = Math.min(1024, img.width), T = Math.round(S * (img.height / img.width));
    const { c, g } = U.canvas(S, T);
    g.drawImage(img, 0, 0, S, T);
    const im = g.getImageData(0, 0, S, T), d = im.data;
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    if (!mx || (mx - mn) / mx < 0.3) return (neutralCache[tex.uuid] = tex);
    const avg = (0.3 * r + 0.59 * gg + 0.11 * b) / (d.length / 4), k = 215 / Math.max(1, avg);
    for (let i = 0; i < d.length; i += 4) { const l = Math.min(255, (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) * k); d[i] = d[i + 1] = d[i + 2] = l; }
    g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    t.magFilter = tex.magFilter; t.minFilter = tex.minFilter; t.anisotropy = tex.anisotropy;
    t.userData.shared = true;
    return (neutralCache[tex.uuid] = t);
  };

  // a model with no material named "paint": its body shell is the material covering the most surface, leaving out
  // wheels (skip(mesh)) and glass. Returns a regex source matching that material's name, or null.
  M.shellMaterial = function (root, skip) {
    const area = {}, a = new V3(), b = new V3(), c = new V3();
    let named = false;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o.isMesh && o.material;
      if (!m || Array.isArray(m) || !o.geometry.attributes.position) return;
      if (/paint/i.test(m.name || '')) named = true;
      if (!m.name || skip(o) || m.transparent || m.opacity < 1 || m.transmission || /glass|window|light|chrome/i.test(m.name)) return;
      const p = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : p.count;
      let s = 0;
      for (let i = 0; i + 2 < n; i += 3) {
        a.fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(o.matrixWorld).sub(a);
        c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(o.matrixWorld).sub(a);
        s += b.cross(c).length() / 2;
      }
      area[m.name] = (area[m.name] || 0) + s;
    });
    if (named) return null;
    let best = null;
    for (const k in area) if (!best || area[k] > area[best]) best = k;
    return best ? '^' + best.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$' : null;
  };

  // ---------- GLTF cache ----------
  const gltfCache = {};
  M.loadGLTF = function (url, cb, onFail) {
    if (gltfCache[url]) {
      const c = gltfCache[url];
      if (c.gltf) cb(c.gltf); else if (c.failed) { if (onFail) onFail(); } else { c.cbs.push(cb); if (onFail) c.fails.push(onFail); }
      return;
    }
    gltfCache[url] = { gltf: null, cbs: [cb], fails: onFail ? [onFail] : [] };
    try {
      // opened from disk: serve models/textures from the bundled copies (js/embedded-models.js)
      const manager = new THREE.LoadingManager();
      if (BL.EMBED || BL.EMBED_HQ || BL.EMBED_FX || BL.EMBED_CARS) {
        const find = (k) => (BL.EMBED_HQ && BL.EMBED_HQ[k]) || (BL.EMBED_CARS && BL.EMBED_CARS[k]) || (BL.EMBED_FX && BL.EMBED_FX[k]) || (BL.EMBED && BL.EMBED[k]);
        manager.setURLModifier((u) => find(u) || find(u.replace(/^\.\//, '')) || find(decodeURI(u)) || u);
      }
      new THREE.GLTFLoader(manager).load(url, (gltf) => {
        // geometry/textures are shared by every clone: never dispose them with a car
        gltf.scene.traverse((o) => {
          if (o.geometry) o.geometry.userData.shared = true;
          const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          for (const m of ms) { m.userData.shared = true; if (m.map) m.map.userData.shared = true; }
        });
        gltfCache[url].gltf = gltf;
        gltfCache[url].cbs.forEach((f) => f(gltf));
      }, undefined, (err) => {
        console.warn('[assets] could not load', url, err);
        gltfCache[url].failed = true;
        gltfCache[url].fails.forEach((f) => f());
      });
    } catch (e) { console.warn('[assets] loader error', e); gltfCache[url].failed = true; gltfCache[url].fails.forEach((f) => f()); }
  };

  // ---------- Ball ----------
  // white: the Heatseeker ball (bright white panels with faint seams)
  M.ballTexture = function (white) {
    const W = q() === 'low' ? 256 : 512, H = W / 2;
    const { c, g } = U.canvas(W, H);
    const grd = g.createLinearGradient(0, 0, 0, H);
    if (white) { grd.addColorStop(0, '#e9edf2'); grd.addColorStop(0.5, '#ffffff'); grd.addColorStop(1, '#e9edf2'); } else { grd.addColorStop(0, '#9aa0a8'); grd.addColorStop(0.5, '#e6e8ec'); grd.addColorStop(1, '#9aa0a8'); }
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const s = H / 7;
    g.lineWidth = Math.max(1, H / 90);
    for (let row = -1; row * s * 1.5 < H + s; row++) for (let col = -1; col * s * 1.732 < W + s; col++) {
      const cx = col * s * 1.732 + (row % 2 ? s * 0.866 : 0), cy = row * s * 1.5;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * s * 0.92, cy + Math.sin(a) * s * 0.92); }
      g.closePath();
      g.fillStyle = white ? ((row + col) % 3 === 0 ? 'rgba(200,208,220,0.35)' : 'rgba(255,255,255,0.3)') : (row + col) % 3 === 0 ? 'rgba(70,75,85,0.55)' : 'rgba(255,255,255,0.18)';
      g.fill();
      g.strokeStyle = white ? 'rgba(150,160,175,0.6)' : 'rgba(40,44,52,0.7)'; g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, H * 0.49, W, H * 0.02);
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  };

  // opts.white: the Heatseeker ball
  M.makeBall = function (radius, opts) {
    const white = !!(opts && opts.white);
    const segs = q() === 'low' ? [20, 14] : [32, 22];
    const geo = new THREE.SphereGeometry(radius, segs[0], segs[1]);
    const m = q() === 'low'
      ? new THREE.MeshPhongMaterial({ map: M.ballTexture(white), shininess: 60, specular: 0x555555 })
      : new THREE.MeshStandardMaterial({ map: M.ballTexture(white), metalness: white ? 0.05 : 0.25, roughness: 0.35, envMap: M.envMap });
    if (white) m.emissive = new THREE.Color(0x1c2026);
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    // optional GLB ball: BL.ASSETS.ball, else a downloaded one in assets/hq/ball/ (Medium / High only)
    const attach = (url) => {
      M.loadGLTF(url, (gltf) => {
        const obj = gltf.scene.clone(true);
        const bb = new THREE.Box3().setFromObject(obj);
        const size = bb.getSize(new V3());
        obj.scale.setScalar((radius * 2) / Math.max(size.x, size.y, size.z));
        const bb2 = new THREE.Box3().setFromObject(obj);
        obj.position.sub(bb2.getCenter(new V3()));
        obj.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.material = o.material.clone();
          if (q() !== 'low') { o.material.envMap = M.envMap; o.material.envMapIntensity = 0.8; }
          // Heatseeker: drop the dark panel colours, keep the model's bumps and shine
          if (white) { o.material.map = null; o.material.color = new THREE.Color('#f4f6f9'); if (o.material.metalness != null) o.material.metalness = 0.05; if (o.material.emissive) o.material.emissive.set(0x1c2026); o.material.needsUpdate = true; }
        });
        mesh.material.visible = false;
        mesh.add(obj);
      });
    };
    const cfg = BL.ASSETS && BL.ASSETS.ball;
    if (cfg && cfg.url) attach(cfg.url);
    else BL.HQ.when(() => { const u = BL.HQ.models('ball')[0]; if (u) attach(u); });
    return mesh;
  };
})(window.BL);
