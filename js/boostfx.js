'use strict';
// Rocket League (fan remake) - how each boost looks. Three layers, all from the same style table:
//  jet       a flame drawn by a shader on a small mesh fixed to each outlet of the car, so it can't drift off it: hot in
//            the middle, torn up by scrolling noise toward the tip, with shock bands on the fast ones
//  particles sprites painted here into the bottom half of the particle atlas (fire, smoke, twinkle, heart, bubble,
//            pixel, shard, coin): R is the shape, G how white-hot it is, so a flame has a hot core and a bubble a shine
//  ribbon    the soft streak behind the car (CarModel.updateTrails), one per side when the outlets are far apart
// Very Low: the same jet on a coarser mesh with one noise lookup, and about half the particles.
(function (BL) {
  const U = BL.util, FX = BL.FX, V3 = THREE.Vector3;
  const B = BL.BoostFX = {};
  // particle shape numbers (5 + atlas tile; the first eight tiles are the older sprites in FX.S)
  const T = B.T = { fire: 13, puff: 14, twinkle: 15, heart: 16, bubble: 17, pixel: 18, shard: 19, coin: 20, petal: 21, note: 22, flake: 23, star: 24, skull: 25, leaf: 26, ring: 27, glyph: 28 };

  // ---------- painted sprites ----------
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const fbm = (x, y) => { let v = 0, a = 0.5; for (let i = 0; i < 4; i++) { v += vnoise(x, y) * a; x = x * 2.03 + 7.1; y = y * 2.03 + 3.7; a *= 0.5; } return v / 0.9375; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const dist = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - ax - dx * t, y - ay - dy * t); };
  const BOLT = [[-0.12, -0.95], [0.22, -0.28], [-0.14, -0.1], [0.2, 0.42], [-0.02, 0.95]];
  // a code glyph (strokes, -1..1): a bar over a hook with a dash beside it
  const GLYPH = [[[-0.55, -0.7], [0.55, -0.7]], [[0.05, -0.7], [0.05, 0.25]], [[0.05, 0.25], [-0.45, 0.8]], [[0.42, -0.15], [0.62, 0.35]], [[-0.55, -0.2], [-0.3, 0.15]]];
  // each returns [shape, heat] for a point in -1..1 (y down, as on screen)
  const TILES = [
    // fire: a ragged ball of flame, white at the heart
    (x, y) => { const r = Math.hypot(x, y), d = r + (fbm(x * 2.3 + 3, y * 2.3 + 1) - 0.5) * 0.6; return [Math.pow(ss(1.02, 0.05, d), 1.6) * (0.78 + 0.22 * fbm(x * 5, y * 5)), 0.8 * ss(0.42, 0, d)]; },
    // smoke: a lumpy puff, thin at the edges
    (x, y) => { const r = Math.hypot(x, y), d = r + (fbm(x * 2.1 + 9, y * 2.1 + 4) - 0.5) * 1.05; return [ss(1, 0.22, d) * (0.5 + 0.5 * fbm(x * 4.5 + 2, y * 4.5)), 0.28 * ss(0.3, -0.4, x + y) * ss(1, 0.4, d)]; },
    // twinkle: a four-point star with a soft halo and little diagonal rays
    (x, y) => {
      const r = Math.hypot(x, y), ax = Math.abs(x), ay = Math.abs(y), u = Math.abs(x + y) * 0.7071, v = Math.abs(x - y) * 0.7071;
      const rays = Math.exp(-ay * 30) * Math.max(0, 1 - ax) + Math.exp(-ax * 30) * Math.max(0, 1 - ay), small = (Math.exp(-u * 38) * Math.max(0, 1 - v * 2.2) + Math.exp(-v * 38) * Math.max(0, 1 - u * 2.2)) * 0.5;
      return [Math.min(1, Math.exp(-r * r * 16) + rays + small + 0.16 * Math.exp(-r * r * 4)), Math.min(1, Math.exp(-r * r * 46) + rays * 0.6)];
    },
    // heart: solid with a glossy highlight
    (x, y) => {
      const qx = x * 1.22, qy = -y * 1.22 + 0.22, k = qx * qx + qy * qy - 1, h = k * k * k - qx * qx * qy * qy * qy;
      const inside = ss(0.05, -0.08, h), rim = ss(-0.9, 0, h) * 0.3;
      return [inside * (0.82 + rim), inside * Math.min(1, Math.exp(-((x + 0.36) ** 2 + (y + 0.34) ** 2) * 24) * 1.2 + 0.1 * ss(0.1, 0.8, -y))];
    },
    // bubble: a clear ball, only its rim and two shines show
    (x, y) => {
      const r = Math.hypot(x, y), shine = Math.exp(-((x + 0.38) ** 2 + (y + 0.4) ** 2) * 34) + 0.65 * Math.exp(-((x - 0.34) ** 2 + (y - 0.44) ** 2) * 110);
      return [Math.max(ss(1, 0.93, r) * (0.1 + 0.9 * r ** 6), Math.min(1, shine) * ss(1, 0.9, r)), Math.min(1, shine)];
    },
    // pixel: a bevelled block
    (x, y) => {
      const m = Math.max(Math.abs(x), Math.abs(y));
      if (m > 0.74) return [0, 0];
      const top = x < -0.5 || y < -0.5, low = x > 0.5 || y > 0.5;
      return [top ? 1 : low ? 0.62 : 0.86, top ? 0.55 : 0];
    },
    // shard: a jagged bit of lightning
    (x, y) => { let d = 9; for (let i = 0; i + 1 < BOLT.length; i++) d = Math.min(d, dist(x, y, BOLT[i][0], BOLT[i][1], BOLT[i + 1][0], BOLT[i + 1][1])); return [Math.min(1, Math.exp(-d * d * 150) + 0.42 * Math.exp(-d * d * 16)), Math.exp(-d * d * 420)]; },
    // coin: a rimmed disc with a raised star and a sheen across it
    (x, y) => {
      const r = Math.hypot(x, y), a = Math.atan2(y, x), star = 0.36 + 0.16 * Math.cos(a * 5);
      const face = ss(0.86, 0.8, r), rim = ss(0.6, 0.68, r), sheen = Math.exp(-((x + y + 0.32) ** 2) * 12);
      return [face * (0.68 + 0.32 * Math.max(rim, ss(star + 0.03, star - 0.03, r))), face * Math.min(1, 0.5 * rim + 0.75 * sheen)];
    },
    // petal: a blossom petal with a notch at its tip and a pale vein
    (x, y) => {
      const inside = (x / 0.55) ** 2 + ((y + 0.08) / 0.9) ** 2, notch = Math.hypot(x, y + 0.98) - 0.2;
      const m = ss(1.02, 0.9, inside) * ss(-0.02, 0.04, notch);
      return [m, m * 0.45 * Math.exp(-x * x * 40) * ss(0.9, -0.6, y)];
    },
    // note: a music note (head, stem and flag)
    Object.assign((x, y) => {
      const ca = Math.cos(-0.35), sa = Math.sin(-0.35), hx = (x + 0.2) * ca - (y - 0.52) * sa, hy = (x + 0.2) * sa + (y - 0.52) * ca;
      const head = (hx / 0.3) ** 2 + (hy / 0.21) ** 2 < 1, stem = x > 0.03 && x < 0.13 && y > -0.85 && y < 0.5;
      const fy = -0.85 + (x - 0.1) * 0.75, flag = x > 0.1 && x < 0.55 && y > fy && y < fy + 0.24;
      return [head || stem || flag ? 1 : 0, head ? 0.35 * ss(0.05, -0.2, hy + hx * 0.3) : 0];
    }, { ss: true }),
    // flake: a six-armed snowflake
    Object.assign((x, y) => {
      const r = Math.hypot(x, y), a = Math.atan2(y, x), seg = Math.PI / 3, d = ((a % seg) + seg) % seg, arm = Math.min(d, seg - d) * r;
      const br = r > 0.35 && r < 0.75 ? Math.abs(Math.min(d, seg - d) * r - (r - 0.35) * 0.55) : 9;
      const on = r < 0.18 || (arm < 0.055 && r < 0.92) || br < 0.045;
      return [on ? 1 : 0, r < 0.22 ? 0.7 : 0.2];
    }, { ss: true }),
    // star: a plump five-point star
    Object.assign((x, y) => {
      const r = Math.hypot(x, y), a = Math.atan2(x, -y), seg = (Math.PI * 2) / 5, d = Math.abs((((a % seg) + seg) % seg) - seg / 2) / (seg / 2);
      const edge = 0.42 + 0.52 * d;
      return [r < edge ? 1 : 0, Math.exp(-r * r * 7) * 0.75];
    }, { ss: true }),
    // skull: a round cranium and jaw with dark eye sockets and nose (bone-white, so it glows in the boost's colour)
    Object.assign((x, y) => {
      const head = Math.hypot(x / 0.78, (y + 0.12) / 0.7) < 1, jaw = Math.abs(x) < 0.42 && y > 0.3 && y < 0.78 && !(y > 0.55 && Math.abs(x) < 0.4 && Math.abs((x * 5) % 1) < 0.18);
      const eye = Math.hypot(Math.abs(x) - 0.3, (y + 0.02) / 1.05) < 0.21, nose = Math.abs(x) < 0.11 - (y - 0.2) * 0.3 && y > 0.18 && y < 0.38;
      const on = (head || jaw) && !eye && !nose;
      return [on ? 1 : 0, on ? 0.55 * ss(0.9, -0.5, y) : 0];
    }, { ss: true }),
    // leaf: pointed at both ends, a pale vein and side veins, a little stem
    Object.assign((x, y) => {
      const w = 0.5 * Math.pow(Math.max(0, 1 - y * y), 0.7), inside = Math.abs(x) < w && Math.abs(y) < 0.92, stem = Math.abs(x) < 0.05 && y > 0.85 && y < 1;
      const vein = Math.abs(x) < 0.035 || (Math.abs(Math.abs(x) * 0.9 - (y - Math.floor(y * 3) / 3) * 0.6) < 0.03 && Math.abs(x) < w * 0.85);
      return [inside || stem ? (vein ? 0.75 : 1) : 0, inside && vein ? 0.4 : 0];
    }, { ss: true }),
    // ring: a soft bright hoop, hottest on its inside edge
    (x, y) => { const r = Math.hypot(x, y), d = Math.abs(r - 0.74); return [Math.exp(-d * d * 260) + 0.25 * Math.exp(-d * d * 40), Math.exp(-(r - 0.68) * (r - 0.68) * 900) * 0.9]; },
    // glyph: a stroke character from a screen of code
    Object.assign((x, y) => { let d = 9; for (const [a, c] of GLYPH) d = Math.min(d, dist(x, y, a[0], a[1], c[0], c[1])); return [d < 0.11 ? 1 : 0, d < 0.05 ? 0.6 : 0.15]; }, { ss: true }),
  ];
  // into the atlas (4 tiles across, rows 2 to 5): opaque, the shape is read from the red channel
  B.paintTiles = function (g, S) {
    TILES.forEach((fn, i) => {
      const img = g.createImageData(S, S), d = img.data;
      // (the hard-edged ones are sampled four times a pixel, for smooth edges)
      const at = fn.ss ? (x, y) => { const h = 0.5 / S, a = fn(x - h, y - h), b = fn(x + h, y - h), c = fn(x - h, y + h), e = fn(x + h, y + h); return [(a[0] + b[0] + c[0] + e[0]) / 4, (a[1] + b[1] + c[1] + e[1]) / 4]; } : fn;
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const v = at(((px + 0.5) / S) * 2 - 1, ((py + 0.5) / S) * 2 - 1), o = (py * S + px) * 4;
        d[o] = Math.max(0, Math.min(1, v[0])) * 255; d[o + 1] = Math.max(0, Math.min(1, v[1])) * 255; d[o + 2] = 0; d[o + 3] = 255;
      }
      g.putImageData(img, (i % 4) * S, (2 + Math.floor(i / 4)) * S);
    });
  };

  // ---------- shared textures ----------
  let noiseTex = null, ribbonT = null;
  // two channels of tiling noise for the flame
  function flameNoise() {
    if (noiseTex) return noiseTex;
    const S = 64, a = new Uint8Array(S * S * 4), P = 8;
    const tile = (x, y, sx, sy) => { const f = (u, v) => hash(((u % P) + P) % P + sx, ((v % P) + P) % P + sy), ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy); return (f(ix, iy) * (1 - wx) + f(ix + 1, iy) * wx) * (1 - wy) + (f(ix, iy + 1) * (1 - wx) + f(ix + 1, iy + 1) * wx) * wy; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x / S) * P, v = (y / S) * P, o = (y * S + x) * 4;
      a[o] = (0.62 * tile(u, v, 0, 0) + 0.38 * tile(u * 2, v * 2, 3, 5)) * 255;
      a[o + 1] = (0.62 * tile(u, v, 11, 7) + 0.38 * tile(u * 2, v * 2, 13, 2)) * 255;
      a[o + 3] = 255;
    }
    noiseTex = new THREE.DataTexture(a, S, S);
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
    noiseTex.magFilter = noiseTex.minFilter = THREE.LinearFilter;
    noiseTex.needsUpdate = true;
    return noiseTex;
  }
  // the trail's cross-section: soft edges with fine streaks running along it
  B.ribbonTex = function () {
    if (ribbonT) return ribbonT;
    const W = 64, H = 32, { c, g } = U.canvas(W, H), img = g.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = (y + 0.5) / H, e = Math.pow(Math.sin(v * Math.PI), 1.5), s = 0.7 + 0.3 * vnoise(v * 14 + 3, (x / W) * 3), o = (y * W + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = e * s * 255;
    }
    g.putImageData(img, 0, 0);
    ribbonT = new THREE.CanvasTexture(c);
    ribbonT.wrapS = THREE.RepeatWrapping;
    ribbonT.userData.shared = true;
    return ribbonT;
  };

  // ---------- the jet ----------
  const JET_V = `
    varying vec3 vN; varying vec3 vV; varying vec2 vQ; varying vec3 vA;
    uniform float uTime; uniform float uWob;
    void main() {
      vQ = uv;
      float t = uv.y;
      vec3 p = position;
      // (it wavers more toward the tip; each jet is turned to its own angle, so two never match)
      p.xy += t * t * uWob * vec2(sin(uTime * 31.0 + t * 9.0), cos(uTime * 27.0 + t * 7.0));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalMatrix * normal; vV = -mv.xyz; vA = normalMatrix * vec3(0.0, 0.0, 1.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const JET_F = `
    varying vec3 vN; varying vec3 vV; varying vec2 vQ; varying vec3 vA;
    uniform sampler2D tNoise; uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uEdge;
    uniform float uTime; uniform float uScroll; uniform float uRough; uniform float uBands; uniform float uPix; uniform float uGain; uniform float uAlpha;
    void main() {
      vec2 q = vQ;
      if (uPix > 0.5) q = floor(q * vec2(uPix, uPix * 1.6)) / vec2(uPix, uPix * 1.6);
      float t = q.y;
      vec3 V = normalize(vV);
      float face = abs(dot(normalize(vN), V));
      // looking down the flame from the chase camera every layer stacks up: it's thinned out so the car still shows
      float along = smoothstep(0.5, 0.96, abs(dot(normalize(vA), V)));
      float n = texture2D(tNoise, vec2(q.x * 2.0, t * 0.8 - uTime * uScroll)).r;
      #ifndef JET_LOW
      n = n * 0.6 + 0.4 * texture2D(tNoise, vec2(q.x * 3.0 + 0.37, t * 1.6 - uTime * uScroll * 1.7)).g;
      #endif
      // hottest down the middle and at the nozzle, broken up by the noise toward the tip
      float heat = pow(face, 1.3) * (1.12 - 0.72 * t) + (n - 0.5) * uRough * (0.25 + 0.9 * t);
      heat *= (1.0 + uBands * sin(t * 40.0 - uTime * 24.0)) * (1.0 - 0.14 * along);
      vec3 c = mix(uEdge, uMid, smoothstep(0.14, 0.48, heat));
      c = mix(c, uCore, smoothstep(0.5, 0.95, heat));
      float a = smoothstep(0.05, 0.32, heat) * (1.0 - smoothstep(0.58, 1.0, t)) * uAlpha * (1.0 - 0.72 * along);
      if (a < 0.004) discard;
      gl_FragColor = linearToOutputTexel(vec4(c * uGain, a));
    }`;
  const geos = {};
  // a flame of revolution down -z: one unit long, one unit across at its widest
  function jetGeo() {
    const low = BL.App && BL.App.quality === 'low', key = low ? 'low' : 'hi';
    if (geos[key]) return geos[key];
    const R = low ? 8 : 16, L = low ? 5 : 10, pos = [], nor = [], uv = [], idx = [];
    const rad = (t) => (0.72 + 0.28 * ss(0, 0.14, t)) * Math.pow(Math.max(0, 1 - t), 0.72);
    for (let i = 0; i <= L; i++) {
      const t = Math.pow(i / L, 1.25), r = rad(t), slope = (rad(Math.min(1, t + 0.01)) - rad(Math.max(0, t - 0.01))) / 0.02;
      for (let j = 0; j <= R; j++) {
        const a = (j / R) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a), l = 1 / Math.hypot(1, slope);
        pos.push(cs * r, sn * r, -t); nor.push(cs * l, sn * l, slope * l); uv.push(j / R, t);
      }
    }
    for (let i = 0; i < L; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.userData.shared = true;
    return (geos[key] = g);
  }
  function jetMat(st) {
    if (st.mat) return st.mat;
    const j = st.jet, low = BL.App && BL.App.quality === 'low';
    const m = new THREE.ShaderMaterial({
      uniforms: {
        tNoise: { value: flameNoise() }, uTime: FX.clock, uCore: { value: new THREE.Color(j.core) }, uMid: { value: new THREE.Color(j.mid) }, uEdge: { value: new THREE.Color(j.edge) },
        uScroll: { value: j.scroll || 2.4 }, uRough: { value: j.rough == null ? 1 : j.rough }, uBands: { value: j.bands || 0 }, uPix: { value: j.pix || 0 }, uGain: { value: j.gain || 1.25 }, uAlpha: { value: j.alpha || 1 }, uWob: { value: j.wob == null ? 0.1 : j.wob },
      },
      vertexShader: JET_V, fragmentShader: JET_F, defines: low ? { JET_LOW: 1 } : {},
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: j.solid ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false,
    });
    m.userData.shared = true;
    return (st.mat = m);
  }
  const JET_R = 0.075;
  B.jet = function (st) {
    const f = new THREE.Mesh(jetGeo(), jetMat(st));
    f.renderOrder = 3;
    f.frustumCulled = false;
    f.rotation.z = Math.random() * 6.283;
    f.visible = false;
    return f;
  };
  // every frame: the jets' length, width and flicker. They light in a few hundredths of a second, not one frame
  B.pose = function (m, dt, on, fast) {
    const st = m.boostStyle, j = st.jet;
    m.jetK = U.damp(m.jetK || 0, on ? 1 : 0, on ? 34 : 20, dt);
    const k = on ? Math.max(m.jetK, 0.05) : m.jetK, show = k > 0.03;
    for (const f of m.flames) {
      f.visible = show;
      if (!show) continue;
      const w = f.userData.size * j.w * JET_R * (0.65 + 0.35 * k);
      f.scale.set(w, w, j.len * (0.88 + Math.random() * 0.24) * (fast ? 1.35 : 1) * k);
    }
    if (st.hue && show && st.mat) {
      const u = st.mat.uniforms, h = (FX.clock.value * 1.5) % 1;
      u.uMid.value.setHSL(h, 1, 0.58); u.uEdge.value.setHSL((h + 0.08) % 1, 1, 0.45);
    } else if (st.hr && show && st.mat) {
      const u = st.mat.uniforms, [lo, hi, sp] = st.hr, h = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(FX.clock.value * (sp || 1)));
      u.uMid.value.setHSL(h, 1, 0.6); u.uEdge.value.setHSL((h + 0.1) % 1, 1, 0.45);
    }
  };

  // ---------- the styles ----------
  // jet: core / mid / edge colours, len (metres), w (width), rough (how torn), bands (shock rings), scroll (speed),
  //      pix (chunky steps), alpha, solid (drawn dark instead of as light)
  // emit: s sprite, rate per second per car, size [start, end], life, speed, spread, cols, end colour, grav, drag,
  //       blend 'alpha' for solid smoke, alpha, rot 'up' / 'none', spin, hi (skipped on Low), hue (rainbow)
  const fire = (cols, end, o) => Object.assign({ s: T.fire, rate: 210, size: [0.46, 0.12], life: 0.3, speed: 9, spread: 0.12, cols, end, drag: 1.5, alpha: 0.62 }, o);
  const smoke = (cols, end, o) => Object.assign({ s: T.puff, rate: 14, size: [0.35, 1.5], life: 0.85, speed: 2.5, spread: 0.2, cols, end, grav: -0.6, drag: 1, blend: 'alpha', alpha: 0.26, hi: true }, o);
  const glint = (cols, o) => Object.assign({ s: T.twinkle, rate: 20, size: [0.22, 0.03], life: 0.5, speed: 7, spread: 0.3, cols, grav: 3, drag: 1 }, o);
  const STYLES = {
    standard: { jet: { core: '#fff3c4', mid: '#ffa726', edge: '#f4400c', len: 1.3, w: 1 },
      emit: [fire(['#ffe9a8', '#ffb347', '#ff7a1f'], '#c92a00'), smoke(['#6e6e6e'], '#2e2e2e'), glint(['#ffcf70', '#ffa040'])], ribbon: { col: '#ff9a3c', w: 0.4 } },
    blue: { jet: { core: '#eafcff', mid: '#49b6ff', edge: '#1238ff', len: 1.5, w: 0.82, bands: 0.32, scroll: 3 },
      emit: [fire(['#e0f7ff', '#7fd0ff', '#3f8cff'], '#0a2fd6', { size: [0.38, 0.08], speed: 10, spread: 0.09 }), glint(['#bfe9ff', '#5cc8ff'], { rate: 26 })], ribbon: { col: '#4aa8ff', w: 0.36 } },
    smoke: { jet: { core: '#f0f0f0', mid: '#a6a6a6', edge: '#5a5a5a', len: 0.65, w: 1.15, rough: 1.5, solid: true, alpha: 0.6, gain: 1 },
      emit: [smoke(['#e2e2e2', '#c6c6c6', '#a2a2a2'], '#5c5c5c', { rate: 72, size: [0.5, 1.9], life: 1.05, speed: 4.5, spread: 0.22, alpha: 0.5, hi: false, grav: -0.9 })], ribbon: { col: '#c8c8c8', w: 0.5, solid: true } },
    sparkles: { jet: { core: '#fffbe0', mid: '#ffe27a', edge: '#d9a21b', len: 0.95, w: 0.72, rough: 0.7, alpha: 0.85 },
      emit: [glint(['#ffffff', '#fff59d', '#ffd54f'], { rate: 95, size: [0.55, 0.06], life: 0.8, speed: 6, spread: 0.36, grav: 2.6, tw: 1 }), glint(['#ffe58a'], { rate: 60, size: [0.16, 0.04], life: 0.45, speed: 8, spread: 0.22, hi: true })], ribbon: { col: '#fff0a0', w: 0.3 } },
    bubbles: { jet: { core: '#e8fbff', mid: '#8fe0ff', edge: '#2aa6e6', len: 0.6, w: 0.85, alpha: 0.6, rough: 0.6, scroll: 1.4 },
      emit: [{ s: T.bubble, rate: 34, size: [0.18, 0.6], life: 1.15, speed: 3.2, spread: 0.3, cols: ['#d9f6ff', '#a6e6ff'], grav: -1.6, drag: 1.5, rot: 'none' }, { s: T.bubble, rate: 42, size: [0.06, 0.15], life: 0.6, speed: 5, spread: 0.26, cols: ['#ffffff'], grav: -2.4, drag: 1.5, rot: 'none', hi: true }], ribbon: { col: '#81d4fa', w: 0.28 } },
    hearts: { jet: { core: '#ffe3ee', mid: '#ff5c9a', edge: '#e3005a', len: 0.9, w: 0.82, scroll: 2 },
      emit: [{ s: T.heart, rate: 34, size: [0.36, 0.66], life: 0.9, speed: 4, spread: 0.3, cols: ['#ff80ab', '#ff4081', '#f50057'], grav: -0.7, drag: 1.5, rot: 'up' }, fire(['#ffc1dc', '#ff5c9a'], '#a3004a', { rate: 70, size: [0.42, 0.1], hi: true })], ribbon: { col: '#ff4081', w: 0.34 } },
    toxic: { jet: { core: '#f4ffcc', mid: '#86ff1a', edge: '#0f8f2c', len: 1.25, w: 1.06, rough: 1.5, scroll: 1.8 },
      emit: [fire(['#e6ffa8', '#9dff2e', '#4cd11a'], '#0d6b1f', { size: [0.5, 0.16], life: 0.42, speed: 7, spread: 0.17 }), smoke(['#5c8a2e', '#3f6b22'], '#1b3312', { rate: 32, alpha: 0.32 }), { s: T.bubble, rate: 18, size: [0.1, 0.05], life: 0.7, speed: 4, spread: 0.3, cols: ['#c6ff66'], grav: 7, drag: 0.6, rot: 'none', hi: true }], ribbon: { col: '#76ff03', w: 0.4 } },
    plasma: { jet: { core: '#ffffff', mid: '#e040fb', edge: '#5a28ff', len: 1.6, w: 0.76, bands: 0.62, scroll: 3.6, gain: 1.9 },
      emit: [fire(['#ffffff', '#ea80fc', '#a06bff'], '#3b12c9', { rate: 220, size: [0.4, 0.07], life: 0.32, speed: 11, spread: 0.09 }), { s: T.shard, rate: 26, size: [0.38, 0.14], life: 0.2, speed: 9, spread: 0.3, cols: ['#f6c6ff', '#b388ff'], drag: 1, hi: true }], ribbon: { col: '#d500f9', w: 0.42 } },
    pixel: { jet: { core: '#d7fff0', mid: '#00e676', edge: '#00b0ff', len: 1, w: 0.9, pix: 9, rough: 1.4, scroll: 2 },
      emit: [{ s: T.pixel, rate: 86, size: [0.34, 0.2], life: 0.72, speed: 5.5, spread: 0.26, cols: ['#00e676', '#00b0ff', '#ffea00', '#ff4081'], drag: 1.5, rot: 'none' }], ribbon: { col: '#00e676', w: 0.3 } },
    lightning: { jet: { core: '#ffffff', mid: '#9be7ff', edge: '#2a8cff', len: 1.4, w: 0.72, rough: 1.8, bands: 0.4, scroll: 4.4, wob: 0.2, gain: 1.9 },
      emit: [{ s: T.shard, rate: 52, size: [0.62, 0.22], life: 0.2, speed: 11, spread: 0.32, cols: ['#ffffff', '#b3e5fc', '#40c4ff'], drag: 1 }, glint(['#e1f7ff'], { rate: 30, speed: 10, life: 0.3 })], ribbon: { col: '#80d8ff', w: 0.32 }, bolts: 4 },
    gold: { jet: { core: '#fff8e1', mid: '#ffd54f', edge: '#d98a00', len: 1.1, w: 0.92, scroll: 2 },
      emit: [{ s: T.coin, rate: 46, size: [0.3, 0.22], life: 1, speed: 6, spread: 0.3, cols: ['#ffe082', '#ffd54f', '#ffb300'], grav: 7, drag: 0.8, spin: 9 }, glint(['#fff8e1', '#ffe082'], { rate: 40, size: [0.34, 0.04], speed: 6 }), fire(['#fff2b8', '#ffc83d'], '#b86a00', { rate: 70, size: [0.44, 0.1], hi: true })], ribbon: { col: '#ffca28', w: 0.36 } },
    fireworks: { jet: { core: '#ffffff', mid: '#ffd6f5', edge: '#ff2d7a', len: 0.95, w: 0.78, alpha: 0.85 },
      emit: [glint(['#ff1744', '#ffea00', '#00e5ff', '#76ff03', '#d500f9'], { rate: 90, size: [0.46, 0.05], life: 0.72, speed: 7, spread: 0.6, grav: 2.2, tw: 1 })], ribbon: { col: '#ffffff', w: 0.3 }, bursts: 2.6 },
    rainbow: { hue: true, jet: { core: '#ffffff', mid: '#ff0000', edge: '#ff8000', len: 1.2, w: 1 },
      emit: [fire(['#ffffff'], '#ffffff', { rate: 200, size: [0.46, 0.22], life: 0.6, speed: 6, spread: 0.08, hue: true }), glint(['#ffffff'], { rate: 30, hue: true, life: 0.7, speed: 5 })], ribbon: { col: '#ffffff', w: 0.85, life: 0.85, rainbow: true } },
    darkmatter: { jet: { core: '#0a0012', mid: '#2a0a52', edge: '#b000ff', len: 1.35, w: 1.08, solid: true, gain: 1.1, rough: 1.3, alpha: 0.95 },
      emit: [smoke(['#000000', '#1a0033', '#2b0f55'], '#4a148c', { rate: 66, size: [0.56, 1.15], life: 0.62, speed: 5, spread: 0.15, alpha: 0.82, hi: false, grav: 0 }), glint(['#d36bff', '#aa00ff'], { rate: 46, size: [0.3, 0.04], life: 0.42, speed: 4, spread: 0.26, grav: 0 }), { s: T.shard, rate: 12, size: [0.36, 0.12], life: 0.22, speed: 6, spread: 0.3, cols: ['#c04dff'], drag: 1, hi: true }], ribbon: { col: '#aa00ff', w: 0.42 } },
    comet: { jet: { core: '#ffffff', mid: '#9fe3ff', edge: '#2f6fe0', len: 1.9, w: 0.98, scroll: 1.5, rough: 0.8 },
      emit: [fire(['#ffffff', '#b3e5fc', '#4fc3f7'], '#1565c0', { rate: 190, size: [0.6, 0.14], life: 0.8, speed: 3, spread: 0.05 }), glint(['#ffffff', '#b3e5fc'], { rate: 44, size: [0.3, 0.04], life: 0.95, speed: 2.4, spread: 0.2, grav: 0.2, tw: 1 })], ribbon: { col: '#e1f5fe', w: 0.62, life: 0.75 } },
    stardust: { jet: { core: '#ffffff', mid: '#d9b8f5', edge: '#7e57c2', len: 0.8, w: 0.72, alpha: 0.72, rough: 0.7, scroll: 1.4 },
      emit: [glint(['#ffffff', '#e1bee7', '#ce93d8', '#7e57c2'], { rate: 70, size: [0.52, 0.05], life: 1.25, speed: 3, spread: 0.46, grav: -0.3, tw: 1 }), glint(['#e1bee7'], { rate: 60, size: [0.13, 0.03], life: 0.8, speed: 4, spread: 0.3, grav: -0.2, hi: true })], ribbon: { col: '#e1bee7', w: 0.34, life: 0.5 } },
    frostbite: { jet: { core: '#ffffff', mid: '#a6ecff', edge: '#3a8fd9', len: 1.3, w: 0.85, bands: 0.2, scroll: 2.6 },
      emit: [{ s: T.flake, rate: 58, size: [0.34, 0.12], life: 0.95, speed: 5, spread: 0.3, cols: ['#ffffff', '#d6f6ff'], grav: 1.2, drag: 1.4, spin: 3 }, { s: T.shard, rate: 22, size: [0.3, 0.1], life: 0.25, speed: 9, spread: 0.25, cols: ['#e0f7ff', '#80d8ff'], drag: 1, hi: true }, glint(['#ffffff'], { rate: 24 })], ribbon: { col: '#a6ecff', w: 0.36 } },
    sakura: { jet: { core: '#fff0f6', mid: '#ff9cc5', edge: '#e05a95', len: 1, w: 0.85, rough: 0.8, scroll: 1.8 },
      emit: [{ s: T.petal, rate: 62, size: [0.3, 0.24], life: 1.25, speed: 4, spread: 0.36, cols: ['#ffd1e3', '#ff9cc5', '#ffffff'], grav: 0.9, drag: 1.6, spin: 4 }, glint(['#ffe3ee'], { rate: 26, life: 0.7, speed: 5, hi: true })], ribbon: { col: '#ff9cc5', w: 0.34 } },
    notes: { jet: { core: '#ffffff', mid: '#7df9ff', edge: '#ff5ad1', len: 1.25, w: 0.85, bands: 0.6, scroll: 3.2 },
      emit: [{ s: T.note, rate: 28, size: [0.42, 0.5], life: 1.05, speed: 3.6, spread: 0.32, cols: ['#ffffff', '#7df9ff', '#ff5ad1', '#ffe066'], grav: -1, drag: 1.5, rot: 'up' }, glint(['#7df9ff', '#ff5ad1'], { rate: 40, life: 0.5, speed: 7 })], ribbon: { col: '#7df9ff', w: 0.38 } },
    starpower: { jet: { core: '#fffde7', mid: '#ffd54f', edge: '#ff9800', len: 1.1, w: 0.9, scroll: 2.2 },
      emit: [{ s: T.star, rate: 42, size: [0.38, 0.14], life: 0.9, speed: 5, spread: 0.3, cols: ['#fff59d', '#ffd54f', '#ffffff'], drag: 1.3, spin: 6 }, glint(['#fff8e1'], { rate: 36, size: [0.3, 0.04] })], ribbon: { col: '#ffd54f', w: 0.36 } },
    brimstone: { jet: { core: '#ffd27a', mid: '#ff3d00', edge: '#5c0000', len: 1.65, w: 1.15, rough: 1.6, scroll: 2.8, gain: 1.4 },
      emit: [fire(['#ffd27a', '#ff6d00', '#ff3d00'], '#3b0000', { rate: 250, size: [0.58, 0.2], life: 0.38, speed: 8, spread: 0.16 }), smoke(['#3a2b26', '#241a17'], '#0d0807', { rate: 34, alpha: 0.42, hi: false }), glint(['#ffab40', '#ff6d00'], { rate: 50, grav: -1.2, life: 0.8, speed: 4, spread: 0.4 })], ribbon: { col: '#ff3d00', w: 0.46 } },
    cyber: { jet: { core: '#e0fbff', mid: '#00e5ff', edge: '#006dff', len: 1.35, w: 0.78, bands: 0.5, scroll: 3.6, gain: 1.6 },
      emit: [{ s: T.pixel, rate: 54, size: [0.2, 0.08], life: 0.5, speed: 7, spread: 0.24, cols: ['#00e5ff', '#e0fbff'], drag: 1.2, rot: 'none' }, { s: T.shard, rate: 20, size: [0.34, 0.1], life: 0.2, speed: 10, spread: 0.3, cols: ['#ffffff', '#00e5ff'], drag: 1, hi: true }], ribbon: { col: '#00e5ff', w: 0.32 }, bolts: 1.5 },
    galaxy: { jet: { core: '#ffffff', mid: '#b388ff', edge: '#304ffe', len: 1.4, w: 1, rough: 1.2, scroll: 1.6 },
      emit: [{ s: T.puff, rate: 40, size: [0.5, 1.1], life: 0.9, speed: 3.5, spread: 0.2, cols: ['#7c4dff', '#448aff', '#e040fb'], alpha: 0.3, drag: 1 }, { s: T.star, rate: 24, size: [0.22, 0.06], life: 1.1, speed: 3, spread: 0.4, cols: ['#ffffff'], spin: 2 }, glint(['#ffffff', '#b388ff'], { rate: 44, size: [0.26, 0.04], life: 1, speed: 3, spread: 0.4, grav: 0, tw: 1 })], ribbon: { col: '#b388ff', w: 0.42 } },
    confetti: { jet: { core: '#ffffff', mid: '#ffe0f0', edge: '#ff4081', len: 0.9, w: 0.75, alpha: 0.8 },
      emit: [{ s: T.pixel, rate: 90, size: [0.2, 0.16], life: 1.1, speed: 5.5, spread: 0.5, cols: ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#d500f9', '#ffffff'], grav: 3.5, drag: 2, spin: 9, blend: 'alpha' }], ribbon: { col: '#ffffff', w: 0.3 } },
    // northern lights: green drifting to violet and back, in soft veils that rise and linger
    aurora: { hr: [0.36, 0.78, 0.9], jet: { core: '#f0fff8', mid: '#3dffa8', edge: '#7c4dff', len: 1.5, w: 0.95, rough: 0.9, bands: 0.15, scroll: 1.4, gain: 1.3 },
      emit: [{ s: T.puff, rate: 46, size: [0.45, 1.5], life: 1.15, speed: 2.6, spread: 0.18, cols: ['#3dffa8'], hr: [0.36, 0.78, 0.9], grav: -0.5, drag: 1.2, alpha: 0.3 }, glint(['#e0fff2', '#b9a6ff'], { rate: 40, life: 0.9, speed: 3, spread: 0.4, grav: -0.3, tw: 1 })], ribbon: { col: '#69f0ae', w: 0.7, life: 0.7 } },
    // fire with burning skulls floating off it
    hellhound: { jet: { core: '#ffe0b0', mid: '#ff4d00', edge: '#7a0000', len: 1.45, w: 1.05, rough: 1.5, scroll: 2.6, gain: 1.4 },
      emit: [fire(['#ffb36b', '#ff5a1f', '#e0230a'], '#2a0000', { rate: 200, size: [0.5, 0.16], life: 0.34 }), { s: T.skull, rate: 10, size: [0.42, 0.62], life: 0.95, speed: 3.2, spread: 0.25, cols: ['#ffd9b0', '#ff8a50'], end: '#ff2a00', grav: -1.3, drag: 1.6, rot: 'up', alpha: 0.9 }, smoke(['#2a1410', '#140a08'], '#050303', { rate: 26, alpha: 0.45 })], ribbon: { col: '#ff4d00', w: 0.44 } },
    // a short warm flame and leaves tumbling down behind
    autumn: { jet: { core: '#fff1d0', mid: '#ffab40', edge: '#d84315', len: 0.95, w: 0.85, rough: 1, scroll: 1.8 },
      emit: [{ s: T.leaf, rate: 46, size: [0.32, 0.28], life: 1.4, speed: 4, spread: 0.35, cols: ['#ff7043', '#ffa726', '#ffca28', '#d84315', '#a1887f'], grav: 1.1, drag: 1.8, spin: 5, blend: 'alpha', alpha: 0.95 }, fire(['#ffd28a', '#ff9a3c'], '#a33a00', { rate: 80, size: [0.36, 0.1], hi: true })], ribbon: { col: '#ffa726', w: 0.32 } },
    // a long blue-white jet, rings of light opening up behind and streaks flying past
    warp: { jet: { core: '#ffffff', mid: '#8fd8ff', edge: '#3d5afe', len: 2.0, w: 0.7, bands: 0.7, scroll: 4.4, gain: 1.8, rough: 0.5 },
      emit: [{ s: T.ring, rate: 9, size: [0.3, 1.9], life: 0.55, speed: 1.2, spread: 0.02, cols: ['#bfe8ff', '#ffffff'], end: '#3d5afe', drag: 2.5, rot: 'none', alpha: 0.85 }, glint(['#ffffff', '#8fd8ff'], { rate: 60, size: [0.18, 0.02], life: 0.3, speed: 14, spread: 0.08, grav: 0 })], ribbon: { col: '#8fd8ff', w: 0.3, life: 0.4 } },
    // green code raining off a blocky green jet
    matrix: { jet: { core: '#e8ffe8', mid: '#00ff41', edge: '#003b00', len: 1.15, w: 0.85, pix: 7, rough: 1.2, scroll: 3 },
      emit: [{ s: T.glyph, rate: 52, size: [0.3, 0.26], life: 0.9, speed: 3.5, spread: 0.3, cols: ['#00ff41', '#7dff9b', '#00c832'], end: '#003b00', grav: 2.2, drag: 2, rot: 'none' }, { s: T.pixel, rate: 30, size: [0.12, 0.06], life: 0.5, speed: 6, spread: 0.25, cols: ['#b9ffc6'], rot: 'none', hi: true }], ribbon: { col: '#00ff41', w: 0.28 } },
    // a white jet that runs through every colour, throwing off glass shards that catch them
    prism: { hue: true, jet: { core: '#ffffff', mid: '#ff4081', edge: '#7c4dff', len: 1.35, w: 0.8, bands: 0.35, scroll: 3, gain: 1.6 },
      emit: [{ s: T.shard, rate: 46, size: [0.4, 0.12], life: 0.5, speed: 8, spread: 0.32, cols: ['#ffffff'], hue: true, drag: 1.2, spin: 6 }, glint(['#ffffff'], { rate: 50, hue: true, size: [0.3, 0.03], life: 0.7, speed: 5, tw: 1 }), { s: T.pixel, rate: 28, size: [0.14, 0.06], life: 0.6, speed: 6, spread: 0.3, cols: ['#ffffff'], hue: true, spin: 8, hi: true }], ribbon: { col: '#ffffff', w: 0.36 } },
    // soft pink, blowing big bubbles (and the odd heart)
    bubblegum: { jet: { core: '#fff0f7', mid: '#ff7ac6', edge: '#d81b8c', len: 0.75, w: 0.95, rough: 0.6, alpha: 0.85, scroll: 1.3 },
      emit: [{ s: T.bubble, rate: 26, size: [0.25, 0.9], life: 1.0, speed: 2.6, spread: 0.25, cols: ['#ffb3e0', '#ff7ac6'], grav: -1.2, drag: 1.8, rot: 'none' }, { s: T.heart, rate: 10, size: [0.2, 0.3], life: 0.8, speed: 3, spread: 0.3, cols: ['#ff80c0'], grav: -0.6, rot: 'up', hi: true }], ribbon: { col: '#ff7ac6', w: 0.34 } },
    // the sun: a long, wide, blinding jet with shock bands, sparks and a heat ring now and then
    solarflare: { jet: { core: '#ffffff', mid: '#ffd54f', edge: '#ff6d00', len: 2.1, w: 1.2, rough: 1.3, bands: 0.25, scroll: 3.2, gain: 1.9 },
      emit: [fire(['#ffffff', '#fff176', '#ffb300'], '#e65100', { rate: 260, size: [0.7, 0.18], life: 0.42, speed: 10, spread: 0.14 }), glint(['#fff9c4', '#ffcc80'], { rate: 70, size: [0.32, 0.03], life: 0.6, speed: 9, spread: 0.5, grav: 0.5 }), { s: T.ring, rate: 3, size: [0.4, 2.4], life: 0.45, speed: 2, spread: 0.02, cols: ['#ffe082'], end: '#ff6d00', drag: 2, rot: 'none', alpha: 0.6, hi: true }], ribbon: { col: '#ffb300', w: 0.5 } },
    // squid ink: a dark cloud and drips falling out of it
    ink: { jet: { core: '#3a2a6e', mid: '#1b1240', edge: '#07040f', len: 1.1, w: 1.1, rough: 1.4, solid: true, alpha: 0.9, gain: 1, scroll: 1.6 },
      emit: [smoke(['#1b1240', '#120c2c', '#2a1a5e'], '#05030c', { rate: 70, size: [0.5, 1.4], life: 0.9, speed: 4, spread: 0.2, alpha: 0.8, hi: false, grav: -0.2 }), { s: T.bubble, rate: 30, size: [0.14, 0.08], life: 0.7, speed: 5, spread: 0.35, cols: ['#3a2a6e', '#5e35b1'], grav: 5, drag: 0.8, rot: 'none', blend: 'alpha', alpha: 0.95 }], ribbon: { col: '#2a1a5e', w: 0.46, solid: true } },
  };
  // anything without its own entry: built from the item's colours
  const derive = (fx) => ({ jet: { core: fx.colors[0], mid: fx.colors[Math.min(1, fx.colors.length - 1)], edge: fx.colors[fx.colors.length - 1], len: 1.1, w: 0.9 },
    emit: [fire(fx.colors, fx.colors[fx.colors.length - 1])], ribbon: { col: fx.flame || fx.colors[0], w: 0.36 } });

  const styles = {};
  // the style for an item in a paint colour (or null): painted boosts keep their shapes and take the paint's colours;
  // a dark paint can't glow, so it's drawn as dark smoke
  B.style = function (def, paint) {
    const key = def.id + '|' + (paint || '');
    if (styles[key]) return styles[key];
    const st = JSON.parse(JSON.stringify(STYLES[def.id.replace(/^boost_/, '')] || derive(def.fx)));
    if (paint) {
      const dark = BL.Models.darkPaint(paint);
      delete st.hue; delete st.hr; if (st.ribbon) st.ribbon.rainbow = false;
      Object.assign(st.jet, dark ? { core: U.shade(paint, 0.35), mid: paint, edge: U.shade(paint, 0.15), solid: true, gain: 1, alpha: 0.9 } : { core: U.shade(paint, 0.75), mid: paint, edge: U.shade(paint, -0.4) });
      for (const e of st.emit) {
        delete e.hue; delete e.hr;
        e.cols = dark ? [U.shade(paint, 0.25), paint] : [U.shade(paint, 0.45), paint];
        e.end = dark ? paint : U.shade(paint, -0.4);
        if (dark) { e.blend = 'alpha'; e.alpha = 0.85; if (e.s === T.fire) e.s = T.puff; }
      }
      st.ribbon.col = paint; st.ribbon.solid = dark;
    }
    for (const e of st.emit) { e.c = e.cols.map((h) => new THREE.Color(h)); e.e = e.end ? new THREE.Color(e.end) : e.c[e.c.length - 1]; }
    return (styles[key] = st);
  };

  // ---------- emission ----------
  const _e = [], _c = new THREE.Color(), _d = new V3();
  // a short crackle of lightning running back from an outlet
  function arc(e, bx, by, bz) {
    const pts = [], len = U.rand(1.2, 2.6), K = 6;
    for (let i = 0; i <= K; i++) { const t = i / K, j = 0.26 * Math.sin(t * Math.PI); pts.push(new V3(e.x + bx * len * t + U.rand(-j, j), e.y + by * len * t + U.rand(-j, j), e.z + bz * len * t + U.rand(-j, j))); }
    const g = new THREE.BufferGeometry().setFromPoints(pts), m = new THREE.LineBasicMaterial({ color: new THREE.Color('#d8f6ff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    FX.mesh(new THREE.Line(g, m), 0.1, (k) => { m.opacity = 1 - k; }, () => { g.dispose(); m.dispose(); });
  }
  FX.boost = function (model, car, dt, scale) {
    const st = model.boostStyle;
    if (!st || !dt) return;
    const ex = model.worldExhausts(_e), n = ex.length;
    if (!n) return;
    const mw = model.group.matrixWorld.elements, cv = car ? car.vel : null, sizes = model.exhaustSize;
    const bx = -mw[8], by = -mw[9], bz = -mw[10];
    // where each outlet was a moment ago: particles are spread along the way, so a fast car leaves a smooth stream
    // rather than a clump every frame
    const prev = model._exPrev || (model._exPrev = []), fresh = FX.time - (model._exT || -9) > 0.12;
    model._exT = FX.time;
    for (let i = 0; i < n; i++) {
      if (!prev[i]) prev[i] = new V3();
      if (fresh || prev[i].distanceToSquared(ex[i]) > 16) prev[i].copy(ex[i]);
      // the glow in the mouth of the outlet (and a flash as it lights)
      const sz = Math.min(1, (sizes && sizes[i]) || 1), c0 = st.emit[0].c[0], e = ex[i];
      if (!st.jet.solid) FX.add.spawn(e.x, e.y, e.z, cv ? cv.x : 0, cv ? cv.y : 0, cv ? cv.z : 0, c0, c0, (fresh ? 0.9 : 0.34) * sz, 0.14 * sz, fresh ? 0.1 : 0.05, 0, 0, FX.S.light, fresh ? 0.7 : 0.42);
    }
    const acc = model._acc || (model._acc = []), dens = FX.density * (scale || 1), low = FX.density < 0.5;
    st.emit.forEach((em, k) => {
      if (em.hi && low) return;
      const pool = em.blend === 'alpha' ? FX.alpha : FX.add;
      let a = (acc[k] || 0) + em.rate * dens * dt;
      while (a >= 1) {
        a -= 1;
        const o = (model._next = ((model._next || 0) + 1) % n), e = ex[o], p = prev[o], t = Math.random(), r = 0.05 * ((sizes && sizes[o]) || 1);
        const sp = em.speed * U.rand(0.8, 1.2), s = em.spread * sp;
        const c0 = em.hue ? _c.setHSL((FX.clock.value * 1.5 + Math.random() * 0.05) % 1, 1, 0.56)
          : em.hr ? _c.setHSL(em.hr[0] + (em.hr[1] - em.hr[0]) * (0.5 + 0.5 * Math.sin(FX.clock.value * (em.hr[2] || 1) + Math.random() * 1.6)), 1, 0.6)
          : em.c[Math.floor(Math.random() * em.c.length)], c1 = em.hue || em.hr ? c0 : em.e;
        const i = pool.spawn(p.x + (e.x - p.x) * t + U.rand(-r, r) * (mw[0] + mw[4]), p.y + (e.y - p.y) * t + U.rand(-r, r) * (mw[1] + mw[5]), p.z + (e.z - p.z) * t + U.rand(-r, r) * (mw[2] + mw[6]),
          bx * sp + U.rand(-s, s) + (cv ? cv.x * 0.25 : 0), by * sp + U.rand(-s, s) + (cv ? cv.y * 0.25 : 0), bz * sp + U.rand(-s, s) + (cv ? cv.z * 0.25 : 0),
          c0, c1, em.size[0] * U.rand(0.8, 1.2), em.size[1], em.life * U.rand(0.7, 1.2), em.grav || 0, em.drag == null ? 1.5 : em.drag, em.s, em.alpha == null ? 1 : em.alpha);
        if (em.rot === 'none') pool.rot[i] = 0; else if (em.rot === 'up') pool.rot[i] = U.rand(-0.35, 0.35);
        pool.rv[i] = em.spin ? U.rand(-em.spin, em.spin) : 0;
      }
      acc[k] = a;
    });
    for (let i = 0; i < n; i++) prev[i].copy(ex[i]);
    if (st.bolts && Math.random() < st.bolts * dt) arc(ex[Math.floor(Math.random() * n)], bx, by, bz);
    if (st.bursts && Math.random() < st.bursts * dt) {
      _d.set(bx, by, bz);
      FX.burst(ex[0].clone().addScaledVector(_d, 2.5), 16, { colors: [st.emit[0].cols[Math.floor(Math.random() * st.emit[0].cols.length)]], speed: [2, 4], size: [0.35, 0.05], life: [0.4, 0.7], grav: 3, shape: 1 });
    }
  };
})(window.BL);
