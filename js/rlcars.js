'use strict';
// Rocket League (fan remake) - original car-soccer car bodies, lofted from hand-shaped cross-sections.
// Every body is one smooth shell: superellipse sections (rounded-box -> round) blended with Catmull-Rom
// along the car, wheel arches cut around the tyres, fender flares, a separate greenhouse (glass + painted
// roof/pillars) and lights that sit on the surface. UVs run along the car (u) and around it (v) so decals wrap.
(function (BL) {
  const U = BL.util;
  const V3 = THREE.Vector3;
  const R = BL.RLCars = {};

  // stations: [z, halfWidth, bottom, top]  (meters, heights above the ground)
  const S = {};
  // Octane-like: compact, tall cabin, short nose, flared rear
  S.hatch = {
    body: [[-0.64, 0.25, 0.25, 0.40], [-0.61, 0.36, 0.17, 0.47], [-0.54, 0.42, 0.13, 0.49], [-0.38, 0.44, 0.12, 0.48], [-0.20, 0.43, 0.12, 0.46], [0.0, 0.425, 0.12, 0.45], [0.18, 0.42, 0.12, 0.43], [0.34, 0.42, 0.13, 0.40], [0.46, 0.41, 0.14, 0.36], [0.56, 0.38, 0.16, 0.32], [0.62, 0.31, 0.19, 0.28], [0.65, 0.2, 0.22, 0.25]],
    cabin: [[0.22, 0.3, 0.41, 0.43], [0.14, 0.33, 0.42, 0.53], [0.04, 0.345, 0.43, 0.6], [-0.1, 0.35, 0.44, 0.645], [-0.28, 0.35, 0.45, 0.645], [-0.42, 0.34, 0.46, 0.6], [-0.52, 0.31, 0.46, 0.5], [-0.57, 0.26, 0.46, 0.47]],
    nT: 3.0, nB: 2.4, tum: 0.06, cn: 3.6, ctum: 0.3, flare: 0.03,
    wf: { z: 0.42, r: 0.16, w: 0.15 }, wr: { z: -0.37, r: 0.185, w: 0.18 }, wx: 0.34,
    head: { z: 0.585, y: 0.31, w: 0.12, h: 0.04 }, tail: { z: -0.6, y: 0.42, w: 0.1, h: 0.05 },
    parts: ['roofSpoiler', 'skirts', 'mirrors', 'splitter', 'diffuser'],
  };
  // Dominus-like: long low hood, fastback
  S.muscle = {
    body: [[-0.67, 0.3, 0.2, 0.38], [-0.64, 0.4, 0.14, 0.41], [-0.52, 0.45, 0.11, 0.42], [-0.4, 0.46, 0.1, 0.42], [-0.2, 0.44, 0.1, 0.41], [0.0, 0.43, 0.1, 0.39], [0.2, 0.43, 0.1, 0.37], [0.4, 0.44, 0.11, 0.35], [0.55, 0.42, 0.13, 0.32], [0.64, 0.36, 0.15, 0.29], [0.68, 0.24, 0.18, 0.26]],
    cabin: [[0.05, 0.3, 0.37, 0.39], [-0.05, 0.33, 0.38, 0.47], [-0.15, 0.34, 0.39, 0.53], [-0.28, 0.34, 0.4, 0.535], [-0.4, 0.33, 0.41, 0.49], [-0.52, 0.3, 0.41, 0.44], [-0.58, 0.26, 0.41, 0.42]],
    nT: 3.4, nB: 2.6, tum: 0.05, cn: 3.2, ctum: 0.32, flare: 0.03,
    wf: { z: 0.44, r: 0.15, w: 0.16 }, wr: { z: -0.42, r: 0.17, w: 0.19 }, wx: 0.355,
    head: { z: 0.635, y: 0.28, w: 0.13, h: 0.028 }, tail: { z: -0.655, y: 0.37, w: 0.12, h: 0.03 },
    parts: ['scoop', 'ducktail', 'skirts', 'mirrors', 'splitter', 'diffuser'],
  };
  // Breakout-like: knife-edge wedge, high tail
  S.wedge = {
    body: [[-0.66, 0.36, 0.22, 0.44], [-0.63, 0.41, 0.16, 0.47], [-0.5, 0.42, 0.12, 0.47], [-0.3, 0.41, 0.11, 0.45], [-0.1, 0.4, 0.11, 0.41], [0.1, 0.4, 0.11, 0.36], [0.3, 0.4, 0.11, 0.3], [0.48, 0.38, 0.11, 0.24], [0.6, 0.33, 0.12, 0.19], [0.67, 0.22, 0.13, 0.16]],
    cabin: [[0.22, 0.24, 0.31, 0.33], [0.12, 0.3, 0.34, 0.45], [0.0, 0.32, 0.37, 0.52], [-0.14, 0.32, 0.4, 0.535], [-0.28, 0.3, 0.43, 0.51], [-0.38, 0.26, 0.45, 0.47]],
    nT: 3.2, nB: 2.6, tum: 0.05, cn: 3.0, ctum: 0.35, flare: 0.028,
    wf: { z: 0.4, r: 0.15, w: 0.15 }, wr: { z: -0.42, r: 0.18, w: 0.19 }, wx: 0.325,
    head: { z: 0.6, y: 0.19, w: 0.12, h: 0.022 }, tail: { z: -0.645, y: 0.43, w: 0.12, h: 0.04 },
    parts: ['wing', 'skirts', 'splitter', 'diffuser'],
  };
  // Plank-like: very wide, flat, low, twin fins
  S.flat = {
    body: [[-0.68, 0.34, 0.18, 0.34], [-0.64, 0.44, 0.12, 0.37], [-0.45, 0.47, 0.1, 0.37], [-0.2, 0.46, 0.1, 0.36], [0.05, 0.45, 0.1, 0.34], [0.3, 0.45, 0.1, 0.31], [0.5, 0.44, 0.11, 0.28], [0.62, 0.38, 0.12, 0.24], [0.69, 0.26, 0.14, 0.21]],
    cabin: [[0.1, 0.26, 0.32, 0.34], [0.0, 0.3, 0.33, 0.43], [-0.15, 0.31, 0.34, 0.465], [-0.32, 0.3, 0.35, 0.45], [-0.45, 0.26, 0.36, 0.39]],
    nT: 4.0, nB: 3.0, tum: 0.04, cn: 3.0, ctum: 0.38, flare: 0.025,
    wf: { z: 0.45, r: 0.15, w: 0.17 }, wr: { z: -0.44, r: 0.165, w: 0.2 }, wx: 0.37,
    head: { z: 0.655, y: 0.22, w: 0.16, h: 0.02 }, tail: { z: -0.67, y: 0.31, w: 0.26, h: 0.022 },
    parts: ['fins', 'skirts', 'splitter', 'diffuser'],
  };
  // Merc-like: tall boxy truck, big wheels
  S.truck = {
    body: [[-0.62, 0.4, 0.26, 0.56], [-0.6, 0.44, 0.23, 0.58], [-0.4, 0.45, 0.22, 0.58], [0.0, 0.45, 0.22, 0.58], [0.3, 0.45, 0.22, 0.57], [0.48, 0.44, 0.23, 0.54], [0.58, 0.42, 0.25, 0.5], [0.63, 0.38, 0.28, 0.46]],
    cabin: [[0.38, 0.38, 0.55, 0.57], [0.3, 0.4, 0.56, 0.76], [0.18, 0.4, 0.57, 0.84], [-0.2, 0.4, 0.57, 0.85], [-0.5, 0.4, 0.57, 0.84], [-0.6, 0.38, 0.57, 0.78]],
    nT: 5.0, nB: 4.0, tum: 0.03, cn: 6.0, ctum: 0.1, flare: 0.035,
    wf: { z: 0.4, r: 0.21, w: 0.2 }, wr: { z: -0.4, r: 0.21, w: 0.2 }, wx: 0.355,
    head: { z: 0.605, y: 0.44, w: 0.12, h: 0.07 }, tail: { z: -0.615, y: 0.48, w: 0.05, h: 0.12 },
    parts: ['roofRack', 'mirrors', 'bullbar', 'skirts', 'lightbar'],
  };
  // Fennec-like: chunky squared hatch
  S.boxy = {
    body: [[-0.62, 0.36, 0.2, 0.44], [-0.6, 0.42, 0.15, 0.48], [-0.45, 0.44, 0.13, 0.48], [-0.2, 0.44, 0.13, 0.47], [0.1, 0.44, 0.13, 0.46], [0.35, 0.44, 0.14, 0.44], [0.5, 0.43, 0.15, 0.42], [0.59, 0.41, 0.17, 0.39], [0.63, 0.36, 0.2, 0.36]],
    cabin: [[0.24, 0.36, 0.45, 0.47], [0.16, 0.38, 0.46, 0.58], [0.06, 0.39, 0.46, 0.65], [-0.2, 0.39, 0.47, 0.66], [-0.44, 0.39, 0.47, 0.65], [-0.54, 0.38, 0.47, 0.58], [-0.59, 0.35, 0.47, 0.49]],
    nT: 5.5, nB: 4.5, tum: 0.03, cn: 6.0, ctum: 0.12, flare: 0.04,
    wf: { z: 0.4, r: 0.17, w: 0.17 }, wr: { z: -0.39, r: 0.18, w: 0.18 }, wx: 0.355,
    head: { z: 0.615, y: 0.36, w: 0.06, h: 0.06, round: true }, tail: { z: -0.61, y: 0.42, w: 0.05, h: 0.09 },
    parts: ['roofSpoiler', 'skirts', 'mirrors', 'splitter', 'diffuser'],
  };
  // Endo/supercar-like: low, wide, bubble canopy, long tail with wing
  S.super = {
    body: [[-0.68, 0.34, 0.2, 0.36], [-0.64, 0.44, 0.13, 0.4], [-0.48, 0.47, 0.1, 0.42], [-0.3, 0.46, 0.1, 0.41], [-0.1, 0.44, 0.09, 0.37], [0.1, 0.43, 0.09, 0.34], [0.3, 0.44, 0.09, 0.31], [0.48, 0.44, 0.1, 0.28], [0.6, 0.39, 0.11, 0.24], [0.68, 0.27, 0.13, 0.2]],
    cabin: [[0.2, 0.26, 0.32, 0.34], [0.1, 0.31, 0.34, 0.44], [-0.02, 0.33, 0.36, 0.5], [-0.16, 0.32, 0.38, 0.505], [-0.28, 0.29, 0.4, 0.47], [-0.38, 0.24, 0.41, 0.43]],
    nT: 2.8, nB: 2.6, tum: 0.06, cn: 2.8, ctum: 0.35, flare: 0.035,
    wf: { z: 0.44, r: 0.155, w: 0.17 }, wr: { z: -0.43, r: 0.17, w: 0.21 }, wx: 0.37,
    head: { z: 0.61, y: 0.24, w: 0.14, h: 0.024 }, tail: { z: -0.665, y: 0.34, w: 0.14, h: 0.025 },
    parts: ['wing', 'intakes', 'skirts', 'splitter', 'diffuser'],
  };
  // Beetle-ish: all curves
  S.bug = {
    body: [[-0.6, 0.2, 0.26, 0.38], [-0.56, 0.34, 0.18, 0.44], [-0.45, 0.41, 0.14, 0.46], [-0.3, 0.43, 0.13, 0.45], [0.0, 0.42, 0.13, 0.43], [0.25, 0.42, 0.14, 0.42], [0.42, 0.41, 0.15, 0.4], [0.53, 0.37, 0.17, 0.36], [0.59, 0.28, 0.21, 0.32], [0.61, 0.16, 0.25, 0.29]],
    cabin: [[0.26, 0.28, 0.4, 0.42], [0.16, 0.33, 0.41, 0.54], [0.02, 0.35, 0.42, 0.62], [-0.14, 0.35, 0.43, 0.64], [-0.3, 0.33, 0.43, 0.6], [-0.44, 0.28, 0.42, 0.52], [-0.54, 0.2, 0.4, 0.44]],
    nT: 2.2, nB: 2.2, tum: 0.1, cn: 2.2, ctum: 0.35, flare: 0.045,
    wf: { z: 0.38, r: 0.165, w: 0.16 }, wr: { z: -0.37, r: 0.175, w: 0.17 }, wx: 0.34,
    head: { z: 0.53, y: 0.31, w: 0.055, h: 0.055, round: true }, tail: { z: -0.565, y: 0.4, w: 0.045, h: 0.045, round: true },
    parts: ['mirrors'],
  };
  // rally hatch with a big wing
  S.hybrid = {
    body: [[-0.64, 0.26, 0.24, 0.39], [-0.61, 0.37, 0.16, 0.45], [-0.54, 0.43, 0.12, 0.47], [-0.38, 0.45, 0.11, 0.46], [-0.2, 0.44, 0.11, 0.44], [0.0, 0.43, 0.11, 0.43], [0.18, 0.43, 0.11, 0.41], [0.34, 0.43, 0.12, 0.38], [0.46, 0.42, 0.13, 0.34], [0.56, 0.39, 0.15, 0.3], [0.62, 0.32, 0.18, 0.26], [0.65, 0.21, 0.21, 0.23]],
    cabin: [[0.2, 0.3, 0.39, 0.41], [0.12, 0.33, 0.4, 0.51], [0.02, 0.345, 0.41, 0.58], [-0.12, 0.35, 0.42, 0.615], [-0.3, 0.35, 0.43, 0.615], [-0.44, 0.34, 0.44, 0.57], [-0.54, 0.3, 0.44, 0.48]],
    nT: 3.2, nB: 2.5, tum: 0.06, cn: 3.6, ctum: 0.3, flare: 0.045,
    wf: { z: 0.42, r: 0.16, w: 0.16 }, wr: { z: -0.39, r: 0.175, w: 0.18 }, wx: 0.36,
    head: { z: 0.585, y: 0.29, w: 0.12, h: 0.035 }, tail: { z: -0.605, y: 0.4, w: 0.1, h: 0.045 },
    parts: ['bigwing', 'skirts', 'mirrors', 'vents', 'splitter', 'diffuser'],
  };
  // long-tail endurance racer
  S.gt = {
    body: [[-0.71, 0.36, 0.2, 0.38], [-0.67, 0.45, 0.13, 0.42], [-0.5, 0.47, 0.1, 0.43], [-0.3, 0.46, 0.1, 0.41], [-0.1, 0.44, 0.09, 0.37], [0.1, 0.43, 0.09, 0.34], [0.32, 0.44, 0.09, 0.31], [0.5, 0.44, 0.1, 0.28], [0.62, 0.39, 0.11, 0.24], [0.7, 0.26, 0.13, 0.2]],
    cabin: [[0.18, 0.26, 0.32, 0.34], [0.08, 0.31, 0.34, 0.44], [-0.04, 0.32, 0.36, 0.49], [-0.18, 0.31, 0.38, 0.49], [-0.3, 0.27, 0.4, 0.45], [-0.38, 0.22, 0.41, 0.42]],
    nT: 2.9, nB: 2.6, tum: 0.06, cn: 2.8, ctum: 0.36, flare: 0.04,
    wf: { z: 0.46, r: 0.15, w: 0.17 }, wr: { z: -0.45, r: 0.17, w: 0.2 }, wx: 0.37,
    head: { z: 0.63, y: 0.24, w: 0.14, h: 0.022 }, tail: { z: -0.695, y: 0.36, w: 0.16, h: 0.022 },
    parts: ['wing', 'fins', 'intakes', 'skirts', 'splitter', 'diffuser'],
  };
  // angular armored future-truck
  S.cyber = {
    body: [[-0.63, 0.42, 0.2, 0.55], [-0.62, 0.45, 0.17, 0.56], [-0.3, 0.45, 0.16, 0.55], [0.1, 0.45, 0.16, 0.52], [0.4, 0.45, 0.16, 0.47], [0.6, 0.44, 0.17, 0.44], [0.64, 0.42, 0.19, 0.42]],
    cabin: [[0.42, 0.4, 0.46, 0.47], [0.2, 0.42, 0.5, 0.64], [0.0, 0.42, 0.52, 0.76], [-0.3, 0.42, 0.54, 0.68], [-0.62, 0.42, 0.55, 0.57]],
    nT: 9.0, nB: 7.0, tum: 0.0, cn: 9.0, ctum: 0.14, flare: 0.0,
    wf: { z: 0.4, r: 0.19, w: 0.19 }, wr: { z: -0.4, r: 0.19, w: 0.19 }, wx: 0.36,
    head: { z: 0.635, y: 0.43, w: 0.38, h: 0.012, bar: true }, tail: { z: -0.625, y: 0.5, w: 0.4, h: 0.014, bar: true },
    parts: ['skirts'],
  };
  // open-wheel racer
  S.formula = {
    body: [[-0.62, 0.11, 0.12, 0.34], [-0.5, 0.16, 0.1, 0.44], [-0.3, 0.2, 0.1, 0.47], [-0.15, 0.2, 0.1, 0.41], [0.0, 0.18, 0.1, 0.35], [0.2, 0.14, 0.11, 0.29], [0.45, 0.1, 0.12, 0.23], [0.66, 0.045, 0.13, 0.17]],
    cabin: null, open: true,
    nT: 2.6, nB: 2.2, tum: 0.15, flare: 0,
    wf: { z: 0.45, r: 0.165, w: 0.16 }, wr: { z: -0.4, r: 0.185, w: 0.21 }, wx: 0.42,
    head: null, tail: { z: -0.615, y: 0.25, w: 0.04, h: 0.04, round: true },
    parts: ['frontWing', 'rearWing', 'pods', 'driver'],
  };
  R.STYLES = S;
  R.has = (name) => !!S[name];

  // ---------- section math ----------
  function cr(a, b, c, d, t) {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  }
  function sectionAt(st, z, out) {
    const n = st.length;
    if (z <= st[0][0]) { out.w = st[0][1]; out.y0 = st[0][2]; out.y1 = st[0][3]; return out; }
    if (z >= st[n - 1][0]) { out.w = st[n - 1][1]; out.y0 = st[n - 1][2]; out.y1 = st[n - 1][3]; return out; }
    let i = 0;
    while (i < n - 2 && z > st[i + 1][0]) i++;
    const p0 = st[Math.max(0, i - 1)], p1 = st[i], p2 = st[i + 1], p3 = st[Math.min(n - 1, i + 2)];
    const t = (z - p1[0]) / (p2[0] - p1[0]);
    out.w = Math.max(0.005, cr(p0[1], p1[1], p2[1], p3[1], t));
    out.y0 = cr(p0[2], p1[2], p2[2], p3[2], t);
    out.y1 = Math.max(out.y0 + 0.005, cr(p0[3], p1[3], p2[3], p3[3], t));
    return out;
  }
  // phi: 0 = bottom centre, PI/2 = left (+x), PI = top centre, 3PI/2 = right
  function sectionPoint(sec, phi, nT, nB, tum, out) {
    const s = Math.sin(phi), c = -Math.cos(phi);
    const yc = (sec.y0 + sec.y1) * 0.5, hh = (sec.y1 - sec.y0) * 0.5;
    const e = 2 / (c >= 0 ? nT : nB);
    let x = sec.w * Math.sign(s) * Math.pow(Math.abs(s), e);
    const y = yc + hh * Math.sign(c) * Math.pow(Math.abs(c), e);
    if (c > 0) x *= 1 - tum * c;
    out.x = x; out.y = y;
    return out;
  }

  // ---------- build a lofted shell ----------
  // returns { geo, groups? } ; deform(x, y, z) may move points (arches / flares)
  function loft(st, o) {
    st = st.slice().sort((a, b) => a[0] - b[0]);
    const zs0 = st[0][0], zs1 = st[st.length - 1][0];
    const nz = o.nz, na = o.na;
    const pos = [], uv = [], idx = [];
    const sec = {}, pt = {};
    const L = zs1 - zs0;
    for (let i = 0; i <= nz; i++) {
      // denser sampling near the ends so noses/tails stay round
      const tt = i / nz;
      const t = tt < 0.5 ? 0.5 * Math.pow(tt * 2, 1.15) : 1 - 0.5 * Math.pow((1 - tt) * 2, 1.15);
      const z = zs0 + L * t;
      sectionAt(st, z, sec);
      for (let k = 0; k < na; k++) {
        const phi = (k / na) * Math.PI * 2;
        sectionPoint(sec, phi, o.nT, o.nB, o.tum, pt);
        let x = pt.x, y = pt.y;
        if (o.deform) { const d = o.deform(x, y, z, sec); x = d[0]; y = d[1]; }
        pos.push(x, y - o.restH, z);
        uv.push((z - o.uz0) / o.uL, 1 - Math.abs(Math.PI - phi) / Math.PI);
      }
    }
    const ring = (i, k) => i * na + (k % na);
    const groups = o.group ? [[], []] : null;
    for (let i = 0; i < nz; i++) {
      for (let k = 0; k < na; k++) {
        const a = ring(i, k), b = ring(i + 1, k), c = ring(i, k + 1), d = ring(i + 1, k + 1);
        const tri = [a, c, b, b, c, d];
        if (groups) groups[o.group(i, k, nz, na)].push(...tri); else idx.push(...tri);
      }
    }
    // caps (nose + tail)
    for (const [i, flip] of [[0, false], [nz, true]]) {
      const z = pos[ring(i, 0) * 3 + 2];
      sectionAt(st, z, sec);
      const ci = pos.length / 3;
      pos.push(0, (sec.y0 + sec.y1) * 0.5 - o.restH, z + (flip ? 0.004 : -0.004));
      uv.push((z - o.uz0) / o.uL, 0.5);
      const capIdx = groups ? groups[0] : idx;
      for (let k = 0; k < na; k++) {
        const a = ring(i, k), b = ring(i, k + 1);
        if (flip) capIdx.push(ci, a, b); else capIdx.push(ci, b, a);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (groups) {
      g.setIndex(groups[0].concat(groups[1]));
      g.addGroup(0, groups[0].length, 0);
      g.addGroup(groups[0].length, groups[1].length, 1);
    } else g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // ---------- compatibility fields used by the shared parts / decal code ----------
  R.style = function (name, hb) {
    const d = S[name] || S.hatch;
    const s = { loft: d, restH: hb.H / 2 + 0.2, parts: d.parts.slice(), open: !!d.open };
    const sec = {};
    const z0 = d.body[0][0], z1 = d.body[d.body.length - 1][0];
    s.L = z1 - z0; s.z0 = z0; s.z1 = z1;
    let mw = 0, mb = 9;
    for (const st of d.body) { mw = Math.max(mw, st[1]); mb = Math.min(mb, st[2]); }
    s.W = 2 * (mw + (d.flare || 0));
    s.bottom = mb;
    s.f = { u: d.wf.z, r: d.wf.r, w: d.wf.w };
    s.r = { u: d.wr.z, r: d.wr.r, w: d.wr.w };
    s.wheelX = d.wx;
    const topAt = (z) => sectionAt(d.body, z, sec).y1;
    s.nose = { h: topAt(z1 - 0.08), round: 0.05 };
    s.tail = { h: topAt(z0 + 0.05), round: 0.05 };
    if (d.cabin) {
      const c = d.cabin;
      let roof = 0;
      for (const st of c) roof = Math.max(roof, st[3]);
      const flat = c.filter((st) => st[3] > roof - 0.02);
      let cw = 0;
      for (const st of c) cw = Math.max(cw, st[1]);
      s.cabin = { ws: c[0][0], rw: c[c.length - 1][0], roof, rf: flat[0][0], rr: flat[flat.length - 1][0], w: (2 * cw) / s.W };
      s.hoodU = c[0][0];
      s.belt = topAt(c[0][0]);
      s.deck = { u: c[c.length - 1][0], h: topAt(c[c.length - 1][0]) };
    } else {
      s.cabin = null;
      s.hoodU = 0; s.belt = topAt(0); s.deck = { u: -0.18, h: topAt(-0.3) };
    }
    s.taper = { nose: 0, tail: 0, top: 0 };
    s.widthAt = (z, h) => {
      sectionAt(d.body, z, sec);
      const yc = (sec.y0 + sec.y1) / 2, hh = (sec.y1 - sec.y0) / 2;
      const c = U.clamp((h - yc) / hh, -1, 1);
      return sec.w * (c > 0 ? 1 - d.tum * c : 1);
    };
    return s;
  };

  // surface point + outward normal on the body at (z, phi)
  function surface(d, s, z, phi, deform) {
    const sec = sectionAt(d.body, z, {}), p = {};
    const f = (zz, ph) => {
      sectionAt(d.body, zz, sec);
      sectionPoint(sec, ph, d.nT, d.nB, d.tum, p);
      let x = p.x, y = p.y;
      if (deform) { const r = deform(x, y, zz, sec); x = r[0]; y = r[1]; }
      return new V3(x, y - s.restH, zz);
    };
    const c = f(z, phi);
    const t1 = f(z + 0.01, phi).sub(f(z - 0.01, phi));
    const t2 = f(z, phi + 0.02).sub(f(z, phi - 0.02));
    const n = new V3().crossVectors(t2, t1).normalize();
    if (n.dot(new V3(c.x, c.y + s.restH - (sec.y0 + sec.y1) / 2, 0)) < 0) n.negate();
    return { p: c, n };
  }
  // find phi on the left side where the surface reaches height y at z
  function phiForHeight(d, s, z, y) {
    const sec = sectionAt(d.body, z, {}), p = {};
    let best = Math.PI * 0.75, bd = 1e9;
    for (let k = 0; k <= 60; k++) {
      const ph = Math.PI * 0.5 + (k / 60) * Math.PI * 0.5;
      sectionPoint(sec, ph, d.nT, d.nB, d.tum, p);
      const e = Math.abs(p.y - y);
      if (e < bd) { bd = e; best = ph; }
    }
    return best;
  }

  // turn a +z-facing geometry to face n, keeping its x axis level (so wide lamps stay wide)
  function orient(g, p, n) {
    const z = n.clone().normalize();
    const x = new V3(0, 1, 0).cross(z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0); else x.normalize();
    const y = new V3().crossVectors(z, x);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(p));
    return g;
  }
  // lamp lens (flattened ellipsoid or capsule bar); lensSeg drops on low settings
  let lensSeg = [14, 10];
  function lens(p, n, w, h, round, bar, depth) {
    let g;
    if (bar) { g = new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(h, w * 2, 2, lensSeg[0] - 4) : new THREE.BoxGeometry(h * 2, w * 2, h * 2); g.rotateZ(Math.PI / 2); g.scale(1, 1, 0.4); }
    else { g = new THREE.SphereGeometry(1, lensSeg[0], lensSeg[1]); g.scale(w, h, depth || (round ? 0.03 : 0.024)); }
    return orient(g, p, n);
  }
  // triangles -> flat-shaded geometry (both sides when asked, for thin trim)
  function triGeo(tris, both) {
    const pos = [];
    for (const t of tris) {
      pos.push(t[0].x, t[0].y, t[0].z, t[1].x, t[1].y, t[1].z, t[2].x, t[2].y, t[2].z);
      if (both) pos.push(t[0].x, t[0].y, t[0].z, t[2].x, t[2].y, t[2].z, t[1].x, t[1].y, t[1].z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }
  // rows of profile points along the car -> skin between them, with end caps
  function stripGeo(rows) {
    const tris = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      for (let k = 0; k < a.length - 1; k++) tris.push([a[k], b[k], a[k + 1]], [a[k + 1], b[k], b[k + 1]]);
    }
    for (const r of [rows[0], rows[rows.length - 1]]) for (let k = 1; k < r.length - 1; k++) tris.push([r[0], r[k], r[k + 1]]);
    return triGeo(tris, true);
  }
  // lateral x of the lower body side at height y
  function sideX(d, sec, y) {
    const yc = (sec.y0 + sec.y1) * 0.5, hh = (sec.y1 - sec.y0) * 0.5;
    const c = U.clamp((y - yc) / hh, -0.999, 0.999);
    const e = 2 / (c >= 0 ? d.nT : d.nB);
    const ac = Math.pow(Math.abs(c), 1 / e);
    return sec.w * Math.pow(Math.sqrt(1 - ac * ac), e) * (c > 0 ? 1 - d.tum * ac : 1);
  }
  // height of the top surface at lateral x
  function topY(d, sec, x) {
    const yc = (sec.y0 + sec.y1) * 0.5, hh = (sec.y1 - sec.y0) * 0.5;
    const e = 2 / d.nT;
    const sx = U.clamp(Math.abs(x) / sec.w, 0, 0.999);
    const sn = Math.pow(sx, 1 / e);
    return yc + hh * Math.pow(Math.sqrt(1 - sn * sn), e);
  }
  // airfoil running across the car; leading edge at the origin, chord trailing back (-z)
  function airfoil(chord, thick, span, aoa) {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(0, thick * 0.9, chord * 0.35, thick, chord, thick * 0.3);
    sh.lineTo(chord, thick * 0.05);
    sh.bezierCurveTo(chord * 0.5, -thick * 0.15, chord * 0.1, -thick * 0.4, 0, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: span, bevelEnabled: false, curveSegments: 5 });
    g.translate(0, 0, -span / 2);
    g.rotateY(Math.PI / 2);
    g.rotateX(aoa || 0);
    return g;
  }
  // flat plate in the side plane; pts are [back, up] pairs
  function plate(pts, t) {
    const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -t / 2);
    g.rotateY(Math.PI / 2);
    return g;
  }

  // ---------- assemble ----------
  R.buildBody = function (model, s, H) {
    const d = s.loft;
    const ql = H.q();
    const potato = BL.App && BL.App.potato;
    const nz = potato ? 26 : ql === 'low' ? 34 : ql === 'high' ? 64 : 48;
    const na = potato ? 18 : ql === 'low' ? 24 : ql === 'high' ? 40 : 32;
    lensSeg = potato ? [8, 5] : ql === 'low' ? [10, 7] : [14, 10];
    const uz0 = -s.L / 2, uL = s.L;
    const wheels = [d.wf, d.wr];
    const deform = d.open ? null : (x, y, z, sec) => {
      const ax = Math.abs(x), sg = Math.sign(x) || 1;
      let nx = x, ny = y;
      const yc = (sec.y0 + sec.y1) * 0.5;
      for (const w of wheels) {
        const Ra = w.r + 0.03, dz = z - w.z;
        const inner = d.wx - w.w / 2 - 0.025;
        // fender flare: sides bulge out around each wheel
        if (d.flare && y < sec.y1 - 0.02) {
          const k = Math.exp(-Math.pow(dz / (Ra * 1.15), 2)) * U.smoothstep(sec.y0, yc, y);
          nx += sg * d.flare * k * U.smoothstep(inner, sec.w, ax);
        }
        // wheel arch cut: lift the lower outer body over the tyre
        if (ax > inner && Math.abs(dz) < Ra && y < yc) {
          const archY = w.r + Math.sqrt(Ra * Ra - dz * dz);
          if (ny < archY) ny = archY;
        }
      }
      return [nx, ny];
    };
    const bodyGeo = loft(d.body, { nz, na, nT: d.nT, nB: d.nB, tum: d.tum, restH: s.restH, uz0, uL, deform });
    const parts = [bodyGeo];
    let cabinMesh = null;
    if (d.cabin) {
      const zB = (s.cabin.rf + s.cabin.rr) / 2;
      const cz0 = d.cabin[0][0], cz1 = d.cabin[d.cabin.length - 1][0];
      const cabGeo = loft(d.cabin, {
        nz: Math.round(nz * 0.6), na, nT: d.cn, nB: 3, tum: d.ctum, restH: s.restH, uz0, uL,
        group: (i, k, n2, na2) => {
          const phi = (k + 0.5) / na2 * Math.PI * 2;
          const up = -Math.cos(phi), side = Math.abs(Math.sin(phi));
          const z = cz0 + (cz1 - cz0) * ((i + 0.5) / n2);
          if (up > 0.8) return 1; // roof
          if (up < -0.35) return 1; // belt (inside the body)
          if (side > 0.45 && Math.abs(z - zB) < 0.028) return 1; // B-pillar
          return 0; // glass
        },
      });
      cabinMesh = new THREE.Mesh(cabGeo, [H.glassMat(), model.paintMat]);
      cabinMesh.castShadow = true;
      model.body.add(cabinMesh);
    }
    model.paintGeo = H.merge(parts);
    const bodyMesh = new THREE.Mesh(model.paintGeo, model.paintMat);
    bodyMesh.castShadow = true;
    model.body.add(bodyMesh);
    model.bodyMesh = bodyMesh;

    // lights that sit on the body surface
    const heads = [], tails = [], dark = [];
    const place = (L, list) => {
      if (!L) return;
      if (L.bar) {
        const at = surface(d, s, L.z, Math.PI, deform);
        const p = new V3(0, L.y - s.restH, at.p.z), n = new V3(0, 0, Math.sign(L.z));
        dark.push(lens(p, n, L.w + 0.012, L.h + 0.012, false, true));
        list.push(lens(p.clone().addScaledVector(n, 0.006), n, L.w, L.h, false, true));
        return;
      }
      // keep a pair of lamps on the shoulders, never merged at the top centre
      const ls = sectionAt(d.body, L.z, {});
      const ph = phiForHeight(d, s, L.z, Math.min(L.y, ls.y1 - (ls.y1 - ls.y0) * 0.2));
      for (const side of [1, -1]) {
        const at = surface(d, s, L.z, side > 0 ? ph : Math.PI * 2 - ph, deform);
        // lamp cluster: dark housing with the lens on top, facing mostly forward/back
        const n = at.n.clone().multiplyScalar(0.3).add(new V3(0, 0, Math.sign(L.z))).normalize();
        const p = at.p.clone().addScaledVector(at.n, 0.003);
        dark.push(lens(p, n, L.w * 0.8 + 0.016, L.h + 0.014, L.round, false, 0.018));
        list.push(lens(p.clone().addScaledVector(n, 0.007), n, L.w * 0.8, L.h, L.round, false));
      }
    };
    place(d.head, heads);
    place(d.tail, tails);
    const rh = s.restH, zF = s.z1, zR = s.z0;
    if (!d.open) {
      // wheel-well liners: dark tubs inside each arch so the cut never shows the inside of the shell
      for (const w of wheels) {
        const Ra = w.r + 0.026, inner = d.wx - w.w / 2 - 0.025;
        const outer = sectionAt(d.body, w.z, {}).w + (d.flare || 0);
        const cy = w.r - rh, segs = 14, tris = [];
        for (const sx of [1, -1]) {
          const P = (t, x) => new V3(sx * x, cy + Ra * Math.sin(t), w.z + Ra * Math.cos(t));
          for (let i = 0; i < segs; i++) {
            const t0 = (i / segs) * Math.PI, t1 = ((i + 1) / segs) * Math.PI;
            tris.push([P(t0, inner), P(t0, outer), P(t1, inner)], [P(t1, inner), P(t0, outer), P(t1, outer)]);
            tris.push([new V3(sx * inner, cy, w.z), P(t0, inner), P(t1, inner)]);
          }
        }
        dark.push(triGeo(tris, true));
      }
      // side skirts: a dark rocker panel hugging the lower body between the arches
      if (s.parts.indexOf('skirts') >= 0) {
        const za = d.wr.z + d.wr.r + 0.05, zb = d.wf.z - d.wf.r - 0.05, sec = {};
        for (const sx of [1, -1]) {
          const rows = [];
          for (let i = 0; i <= 10; i++) {
            const z = za + (zb - za) * (i / 10);
            sectionAt(d.body, z, sec);
            const yT = sec.y0 + 0.07, yB = sec.y0 + 0.012;
            const xT = deform(sideX(d, sec, yT), yT, z, sec)[0], xB = deform(sideX(d, sec, yB), yB, z, sec)[0];
            rows.push([
              new V3(sx * (xT - 0.006), yT - rh, z), new V3(sx * (xT + 0.01), yT - 0.008 - rh, z),
              new V3(sx * (xB + 0.016), yB - rh, z), new V3(sx * (xB - 0.012), yB - 0.008 - rh, z),
            ]);
          }
          dark.push(stripGeo(rows));
        }
      }
      const fs = sectionAt(d.body, zF - 0.04, {});
      // grille + splitter + diffuser
      const grille = new THREE.SphereGeometry(1, 16, 8);
      grille.scale(fs.w * 0.55, 0.035, 0.02);
      grille.translate(0, fs.y0 + (fs.y1 - fs.y0) * 0.35 - rh, zF - 0.012);
      dark.push(grille);
      if (s.parts.indexOf('splitter') >= 0) {
        const sp = new THREE.BoxGeometry(fs.w * 1.75, 0.018, 0.09);
        sp.translate(0, fs.y0 - 0.012 - rh, zF - 0.05);
        dark.push(sp);
      }
      const rs = sectionAt(d.body, zR + 0.05, {});
      if (s.parts.indexOf('diffuser') >= 0) {
        const df = new THREE.BoxGeometry(rs.w * 1.4, 0.05, 0.1);
        df.translate(0, rs.y0 + 0.01 - rh, zR + 0.06);
        dark.push(df);
        for (const fx of [-0.15, -0.05, 0.05, 0.15]) { const f = new THREE.BoxGeometry(0.012, 0.06, 0.1); f.translate(fx, rs.y0 + 0.0 - rh, zR + 0.05); dark.push(f); }
      }
      if (s.parts.indexOf('bullbar') >= 0) {
        const bb = new THREE.BoxGeometry(fs.w * 1.6, 0.05, 0.05);
        bb.translate(0, fs.y0 + 0.05 - rh, zF + 0.015);
        dark.push(bb);
        for (const bx of [-0.2, 0.2]) { const p = new THREE.BoxGeometry(0.04, 0.16, 0.04); p.translate(bx, fs.y0 + 0.12 - rh, zF + 0.015); dark.push(p); }
      }
    }
    // exhausts
    model.exhausts = [];
    const rs = sectionAt(d.body, zR + 0.03, {});
    const ex = d.open ? [0] : [-0.12, 0.12];
    for (const x of ex) {
      const ey = d.open ? 0.25 : rs.y0 + 0.06;
      const c = new THREE.CylinderGeometry(0.032, 0.036, 0.09, 12); c.rotateX(Math.PI / 2); c.translate(x, ey - rh, zR + 0.03);
      dark.push(c);
      model.exhausts.push(new V3(x, ey - rh, zR - 0.03));
    }
    s.deform = deform;
    if (heads.length) model.body.add(new THREE.Mesh(H.merge(heads), H.headMat()));
    if (tails.length) model.body.add(new THREE.Mesh(H.merge(tails), H.tailMat()));
    model.darkGeo = dark;
  };

  // body-coloured add-ons fitted to the real surface; returns the part names it built
  R.buildParts = function (model, s, H) {
    const d = s.loft, rh = s.restH, done = new Set(['skirts', 'splitter', 'diffuser', 'bullbar']);
    if (d.open) return done;
    const paint = [], dark = model.darkGeo, sec = {};
    const top = (z) => sectionAt(d.body, z, sec).y1;
    const cab = d.cabin ? d.cabin.slice().sort((a, b) => a[0] - b[0]) : null;
    const wing = (chord, span, zLead, y, aoa, strutX, plateH) => {
      const yd = top(zLead - chord * 0.5);
      paint.push(airfoil(chord, 0.028, span, aoa).translate(0, y - rh, zLead));
      for (const sx of [1, -1]) {
        dark.push(plate([[-0.03, -plateH], [chord + 0.03, -plateH * 0.6], [chord + 0.04, 0.05], [0.02, 0.035]], 0.012).translate(sx * span / 2, y - rh, zLead));
        const h = y - yd + 0.01;
        dark.push(plate([[chord * 0.2, -h], [chord * 0.75, -h], [chord * 0.6, 0.0], [chord * 0.38, 0.0]], 0.016).translate(sx * strutX, y - rh, zLead));
      }
    };
    for (const p of s.parts) {
      if (p === 'wing') {
        const chord = d === S.wedge ? 0.17 : 0.2;
        const zLead = s.z0 + chord + 0.02;
        wing(chord, s.W * 0.9, zLead, top(zLead - chord * 0.5) + 0.14, 0.16, 0.2, 0.06);
        done.add(p);
      }
      if (p === 'bigwing' && s.cabin) {
        const zLead = s.z0 + 0.24;
        wing(0.2, s.W * 0.96, zLead, s.cabin.roof + 0.03, 0.18, 0.22, 0.08);
        done.add(p);
      }
      if (p === 'roofSpoiler' && cab) {
        const cw = sectionAt(cab, s.cabin.rr, sec).w;
        paint.push(airfoil(0.13, 0.022, cw * 1.9, -0.14).translate(0, s.cabin.roof - 0.012 - rh, s.cabin.rr + 0.02));
        done.add(p);
      }
      if (p === 'ducktail') {
        const z = s.z0 + 0.1, w = sectionAt(d.body, z, sec).w;
        paint.push(airfoil(0.1, 0.03, w * 1.7, 0.35).translate(0, top(z) - 0.012 - rh, z));
        done.add(p);
      }
      if (p === 'fins') {
        for (const sx of [1, -1]) {
          const zf = s.z0 + 0.42, zm = s.z0 + 0.22;
          sectionAt(d.body, zm, sec);
          const x = sec.w * 0.76, yb = topY(d, sec, x) - 0.012;
          const L = 0.34, Hf = 0.15;
          const sh = [[0, 0], [L, 0], [L + 0.025, Hf], [L - 0.04, Hf], [L * 0.55, Hf * 0.45], [L * 0.2, Hf * 0.1]];
          paint.push(plate(sh, 0.022).translate(sx * x, yb - rh, zf));
        }
        done.add(p);
      }
      if (p === 'scoop') {
        const z = s.hoodU + 0.25, slope = (top(z + 0.08) - top(z - 0.08)) / 0.16;
        // long, low power bulge down the middle of the hood
        const g = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        g.scale(0.12, 0.032, 0.26); g.rotateX(Math.atan(-slope)); g.translate(0, top(z) - 0.008 - rh, z);
        paint.push(g);
        done.add(p);
      }
      if (p === 'mirrors' && cab) {
        const z = cab[cab.length - 1][0] - 0.05;
        const cw = sectionAt(cab, z, sec).w, y = sectionAt(d.body, z, sec).y1 + 0.045;
        for (const sx of [1, -1]) {
          paint.push(new THREE.SphereGeometry(1, 10, 8).scale(0.045, 0.028, 0.03).translate(sx * (cw + 0.06), y - rh, z));
          dark.push(new THREE.BoxGeometry(0.06, 0.012, 0.02).translate(sx * (cw + 0.025), y - 0.012 - rh, z));
          dark.push(new THREE.CircleGeometry(1, 10).scale(0.034, 0.02, 1).rotateY(Math.PI).translate(sx * (cw + 0.06), y - rh, z - 0.031));
        }
        done.add(p);
      }
    }
    if (paint.length) {
      const m = new THREE.Mesh(H.merge(paint), H.bodyMat());
      m.castShadow = true;
      model.body.add(m);
    }
    return done;
  };
})(window.BL);
