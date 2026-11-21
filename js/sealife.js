'use strict';
// Rocket League (fan remake) - sea life round the underwater arenas (Coral Reef, day and night): schools of tropical
// fish with swishing tails, manta rays flapping overhead, sea turtles paddling past, a whale gliding through the haze
// and jellyfish drifting up past the glass (glowing at night).
// Every animal moves on the graphics card: each kind is one instanced draw call whose vertex shader works out where
// each animal is along its path from the time, turns it to face the way it swims and bends its tail / wings / flippers,
// so the CPU does nothing per frame. They live outside the glass dome and get their own, lighter water haze (the
// arena's fog is thick enough down here to hide anything past the stands).
// Very Low: one school and a few jellyfish (two draw calls); Low adds rays; Medium / High have everything.
(function (BL) {
  const SL = BL.SeaLife = {};
  const U = BL.util, V3 = THREE.Vector3;

  // ---------- shapes (unit size, nose along +x) ----------
  const strip = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };
  // colour every vertex of a part: fn(x, y, z) -> THREE.Color
  const paint = (g, fn) => {
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const col = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return g; };
  const merge = (parts) => THREE.BufferGeometryUtils.mergeBufferGeometries(parts.map(strip));
  const C = (h) => new THREE.Color(h);

  function fishGeo() {
    const body = new THREE.SphereGeometry(1, 12, 7); body.scale(1, 0.44, 0.2);
    const top = C('#3a3f48'), belly = C('#f4f1e8'), mid = C('#ffffff');
    paint(body, (x, y) => (y > 0.18 ? mid.clone().lerp(top, U.smoothstep(0.18, 0.44, y) * 0.6) : y < -0.12 ? belly : mid));
    const fin = C('#ffffff');
    const tail = paint(tri([-0.82, 0, 0, -1.5, 0.5, 0, -1.32, 0, 0, -0.82, 0, 0, -1.32, 0, 0, -1.5, -0.5, 0]), () => fin);
    const dorsal = paint(tri([0.25, 0.38, 0, -0.45, 0.36, 0, -0.2, 0.78, 0]), () => fin);
    const eye = new THREE.SphereGeometry(0.075, 6, 4); eye.translate(0.72, 0.1, 0.12); paint(eye, () => C('#0c0c10'));
    const eye2 = new THREE.SphereGeometry(0.075, 6, 4); eye2.translate(0.72, 0.1, -0.12); paint(eye2, () => C('#0c0c10'));
    return merge([body, tail, dorsal, eye, eye2]);
  }
  function rayGeo() {
    const s = new THREE.Shape();
    s.moveTo(0.95, 0.16); s.quadraticCurveTo(0.7, 0.55, -0.05, 1.0); s.quadraticCurveTo(-0.25, 0.6, -0.55, 0.22); s.lineTo(-0.62, 0.05);
    s.lineTo(-0.62, -0.05); s.lineTo(-0.55, -0.22); s.quadraticCurveTo(-0.25, -0.6, -0.05, -1.0); s.quadraticCurveTo(0.7, -0.55, 0.95, -0.16);
    s.quadraticCurveTo(1.05, 0, 0.95, 0.16);
    const wing = new THREE.ShapeGeometry(s, 10); wing.rotateX(-Math.PI / 2);
    const tail = tri([-0.6, 0, 0.03, -1.7, 0, 0, -0.6, 0, -0.03]);
    const dark = C('#26323e');
    return merge([paint(wing, (x, y, z) => dark.clone().lerp(C('#3e5262'), 1 - Math.abs(z))), paint(tail, () => dark)]);
  }
  function turtleGeo() {
    const shell = new THREE.SphereGeometry(1, 14, 8); shell.scale(1, 0.4, 0.8);
    const top = C('#5d5128'), plate = C('#c8b67a');
    paint(shell, (x, y, z) => (y < -0.05 ? plate : top.clone().lerp(C('#7a6a34'), (Math.sin(x * 9) * Math.sin(z * 9) + 1) * 0.3)));
    const skin = C('#8c9a62');
    const head = new THREE.SphereGeometry(0.3, 8, 6); head.scale(1.2, 0.8, 0.9); head.translate(1.12, 0.04, 0); paint(head, () => skin);
    const fl = (x, z, sx, sz, yaw) => { const g = new THREE.SphereGeometry(1, 8, 4); g.scale(sx, 0.07, sz); g.rotateY(yaw); g.translate(x, -0.02, z); return paint(g, () => skin); };
    return merge([shell, head, fl(0.45, 0.98, 0.34, 0.78, 0.45), fl(0.45, -0.98, 0.34, 0.78, -0.45), fl(-0.78, 0.6, 0.22, 0.38, -0.5), fl(-0.78, -0.6, 0.22, 0.38, 0.5)]);
  }
  function whaleGeo() {
    // a body of revolution (radius along the length), turned to lie along x
    const pts = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18, x = -1.3 + t * 2.3; const r = t < 0.08 ? 0.02 + t * 0.6 : 0.34 * Math.sin(Math.PI * Math.pow((t - 0.04) / 0.96, 0.62)) + 0.03; pts.push(new THREE.Vector2(Math.max(0.01, r), x)); }
    const body = new THREE.LatheGeometry(pts, 14); body.rotateZ(-Math.PI / 2); body.scale(1, 0.86, 1);
    const top = C('#3a4756'), belly = C('#b8c2cc');
    paint(body, (x, y) => belly.clone().lerp(top, U.smoothstep(-0.16, 0.12, y)));
    const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.quadraticCurveTo(-0.12, 0.3, -0.32, 0.46); fs.quadraticCurveTo(-0.2, 0.2, -0.26, 0); fs.quadraticCurveTo(-0.2, -0.2, -0.32, -0.46); fs.quadraticCurveTo(-0.12, -0.3, 0, 0);
    const fluke = new THREE.ShapeGeometry(fs, 6); fluke.rotateX(-Math.PI / 2); fluke.translate(-1.28, 0, 0); paint(fluke, () => top);
    const fin = (z) => { const g = new THREE.SphereGeometry(1, 8, 4); g.scale(0.22, 0.04, 0.34); g.rotateX(z > 0 ? 0.5 : -0.5); g.translate(0.42, -0.18, z); return paint(g, () => top); };
    return merge([body, fluke, fin(0.36), fin(-0.36)]);
  }
  function jellyGeo() {
    const bell = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); bell.scale(1, 0.75, 1);
    const parts = [bell];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, t = new THREE.PlaneGeometry(0.07, 2.6, 1, 6);
      t.translate(0, -1.3, 0); t.rotateY(a); t.translate(Math.cos(a) * 0.55, 0.02, Math.sin(a) * 0.55); parts.push(t);
    }
    return merge(parts);
  }

  // ---------- the shaders ----------
  // aSwim: (where on its circle it starts, circle radius, height, turn speed in rad/s, + for anticlockwise)
  // aOff: (offset in its school: ahead, up, to the side; size)
  const SWIM = `
    uniform float uT;
    attribute vec4 aSwim; attribute vec4 aOff;
    varying vec3 vSeaW;
    vec2 sDir; vec3 sCen;
    void swimSetup() {
      float a = aSwim.x + uT * aSwim.w;
      sDir = vec2(-sin(a), cos(a)) * (aSwim.w < 0.0 ? -1.0 : 1.0);
      sCen = vec3(cos(a) * aSwim.y, aSwim.z + sin(uT * 0.31 + aSwim.x * 5.0) * 2.5, sin(a) * aSwim.y);
    }
    // turn so +x points the way it swims
    vec3 yawV(vec3 v) { return vec3(v.x * sDir.x - v.z * sDir.y, v.y, v.x * sDir.y + v.z * sDir.x); }`;
  const BEND = {
    // the tail swishes side to side (faster for little fish)
    fish: 'p.z += sin(uT * 10.0 + aSwim.x * 31.0 + aOff.x * 3.0 + p.x * 2.4) * 0.26 * max(0.0, 0.3 - p.x);',
    // the wings flap from the body out
    ray: 'p.y += sin(uT * 1.6 + aSwim.x * 7.0 - abs(p.z) * 0.8) * 0.42 * pow(abs(p.z), 1.5); p.y += sin(uT * 1.1 + p.x * 2.0) * 0.05;',
    // the flippers row (front and back out of step)
    turtle: 'p.y += sin(uT * 1.9 + aSwim.x * 5.0 + (p.x > 0.0 ? 0.0 : 1.8)) * 0.42 * smoothstep(0.55, 1.2, abs(p.z));',
    // the tail beats up and down, slowly
    whale: 'p.y += sin(uT * 0.8 + aSwim.x) * 0.22 * pow(max(0.0, -p.x - 0.15), 2.0);',
  };
  const T = { value: 0 }, FOGC = { value: new THREE.Color() }, FOGD = { value: 0.004 }, GLOW = { value: 0.35 };
  function swimMat(kind) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = T; sh.uniforms.uFogC = FOGC; sh.uniforms.uFogD = FOGD; sh.uniforms.uGlow = GLOW;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SWIM)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nswimSetup(); objectNormal = yawV(objectNormal);')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          { vec3 p = transformed; ${BEND[kind]} transformed = sCen + yawV(p * aOff.w + aOff.xyz); }`)
        .replace('#include <project_vertex>', '#include <project_vertex>\nvSeaW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeaW; uniform vec3 uFogC; uniform float uFogD; uniform float uGlow;')
        // (a ray is dark on top and pale underneath)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (kind === 'ray' ? 'if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.82, 0.86, 0.88);\n' : '')
          // (light scattered by the water reaches them from all round, so the undersides you see from the pitch aren't black)
          + 'totalEmissiveRadiance += diffuseColor.rgb * uGlow;')
        .replace('#include <fog_fragment>', '{ float sd = length(vSeaW - cameraPosition); gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, 1.0 - exp(-uFogD * uFogD * sd * sd)); }');
    };
    m.customProgramCacheKey = () => 'sea-' + kind;
    return m;
  }
  // jellyfish: see-through and glowing, pulsing as they drift up past the dome (drawn adding light, so the haze
  // fades them to nothing rather than to the fog colour)
  const JELLY_V = `
    uniform float uT; uniform float uFogD;
    attribute vec4 aSwim; attribute vec4 aOff; attribute vec3 aCol;
    varying vec3 vC; varying float vA;
    void main() {
      float a = aSwim.x + uT * aSwim.w, ph = aOff.x * 6.2831;
      float span = 46.0, rise = mod(uT * (0.5 + aOff.y * 0.5) + aOff.x * span, span);
      vec3 c = vec3(cos(a) * aSwim.y, aSwim.z + rise - span * 0.5, sin(a) * aSwim.y);
      vec3 p = position;
      float pulse = sin(uT * 2.3 + ph);
      if (p.y > -0.01) { p.xz *= 1.0 + 0.17 * pulse; p.y *= 1.0 - 0.12 * pulse; }
      else { p.x += sin(uT * 1.4 + p.y * 1.3 + ph) * 0.22 * -p.y; p.z += cos(uT * 1.1 + p.y * 1.1 + ph) * 0.18 * -p.y; p.y *= 1.0 + 0.1 * pulse; }
      vec3 w = c + p * aOff.w;
      vec4 mv = viewMatrix * vec4(w, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = length(w - cameraPosition);
      // (fades in and out at the ends of its climb, and into the haze with distance)
      vA = smoothstep(0.0, 4.0, rise) * smoothstep(span, span - 6.0, rise) * exp(-uFogD * uFogD * d * d) * (p.y > -0.01 ? 1.0 : 0.55);
      vC = aCol;
    }`;
  const JELLY_F = 'uniform float uK; varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC * vA * uK, 1.0); }';

  // ---------- placing them ----------
  // a school: n fish sharing a circle round the dome, packed in a loose ball
  function addSchools(list, rnd, schools, perSchool, hm) {
    for (let s = 0; s < schools; s++) {
      const a0 = rnd() * 6.283, R = U.lerp(hm.r0, hm.r1, rnd()), h = U.lerp(hm.h0, hm.h1, rnd()), sp = (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * 1.6) / R;
      const size = U.lerp(hm.s0, hm.s1, rnd()), col = hm.cols[s % hm.cols.length];
      for (let i = 0; i < perSchool; i++) {
        list.push({ swim: [a0 + (rnd() - 0.5) * 0.02, R + (rnd() - 0.5) * 4, h, sp], off: [(rnd() - 0.5) * 18, (rnd() - 0.5) * 7, (rnd() - 0.5) * 12, size * (0.8 + rnd() * 0.4)], col });
      }
    }
  }
  function build(geo, mat, list) {
    const n = list.length, im = new THREE.InstancedMesh(geo, mat, n);
    const swim = new Float32Array(n * 4), off = new Float32Array(n * 4), c = new THREE.Color();
    list.forEach((f, i) => { swim.set(f.swim, i * 4); off.set(f.off, i * 4); im.setColorAt(i, c.set(f.col)); });
    geo.setAttribute('aSwim', new THREE.InstancedBufferAttribute(swim, 4));
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    im.frustumCulled = false;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    return im;
  }

  // where animal i of an instanced kind is right now (the vertex shader's sums; for tests and cameras)
  SL.where = function (im, i, v) {
    const sw = im.geometry.attributes.aSwim, t = T.value, a = sw.getX(i) + t * sw.getW(i);
    return (v || new V3()).set(Math.cos(a) * sw.getY(i), sw.getZ(i) + Math.sin(t * 0.31 + sw.getX(i) * 5) * 2.5, Math.sin(a) * sw.getY(i));
  };
  // root: the arena's group; dome: { rx, ry, rz } the glass dome's half-sizes (the animals stay outside it)
  SL.add = function (root, H, map, opts) {
    const potato = !!(BL.App && BL.App.potato), low = !!opts.low, night = map.time === 'night';
    const rnd = U.rng(U.hash(map.id + 'sealife'));
    const D = opts.dome, ring0 = Math.max(D.rx, D.rz) * 0.9;
    FOGC.value.set(map.fog); FOGD.value = night ? 0.0036 : 0.0032; GLOW.value = night ? 0.3 : 0.42;
    const out = [];
    // fish: schools circling outside the glass, above the stands' roofs and over the top of the dome
    const fishCols = ['#ffd23f', '#4fc3f7', '#ff7a45', '#c792ff', '#7cf06a', '#ff5fa2'];
    const fishes = [];
    // (bigger than life: they're 100+ m away, where a real-sized fish is a speck; and up above the stands' roofs)
    addSchools(fishes, rnd, potato ? 2 : low ? 3 : 5, potato ? 18 : low ? 24 : 32, { r0: ring0 + 4, r1: ring0 + 34, h0: 56, h1: 92, s0: 2.4, s1: 3.2, cols: fishCols });
    if (!low) addSchools(fishes, rnd, 2, 30, { r0: 20, r1: D.rx * 0.55, h0: D.ry + 10, h1: D.ry + 22, s0: 2.6, s1: 3.4, cols: fishCols.slice(2) });
    out.push(build(fishGeo(), swimMat('fish'), fishes));
    if (!potato) {
      // manta rays gliding round, wide and slow, some right over the dome
      const rays = [];
      for (let i = 0; i < (low ? 2 : 4); i++) {
        const R = i % 2 ? ring0 + 10 + rnd() * 30 : 25 + rnd() * 40, h = i % 2 ? 62 + rnd() * 26 : D.ry + 14 + rnd() * 12;
        rays.push({ swim: [rnd() * 6.283, R, h, (rnd() < 0.5 ? -1 : 1) * 3.6 / R], off: [0, 0, 0, 9 + rnd() * 3], col: '#ffffff' });
      }
      out.push(build(rayGeo(), swimMat('ray'), rays));
    }
    if (!low) {
      const turtles = [];
      for (let i = 0; i < 5; i++) { const R = ring0 + 8 + rnd() * 30; turtles.push({ swim: [rnd() * 6.283, R, 58 + rnd() * 34, (rnd() < 0.5 ? -1 : 1) * 2.0 / R], off: [0, 0, 0, 3.8 + rnd() * 1.0], col: '#ffffff' }); }
      out.push(build(turtleGeo(), swimMat('turtle'), turtles));
      // a pair of whales far out in the blue, slowly circling the whole arena
      const whales = [];
      for (let i = 0; i < 2; i++) { const R = ring0 + 60 + i * 35; whales.push({ swim: [i * 3.1 + rnd(), R, 84 + i * 16, (i ? -1 : 1) * 3.0 / R], off: [0, 0, 0, 22 + i * 4], col: '#ffffff' }); }
      out.push(build(whaleGeo(), swimMat('whale'), whales));
    }
    // jellyfish drifting up round the glass
    {
      const n = potato ? 16 : low ? 28 : 56, geo = jellyGeo();
      const swim = new Float32Array(n * 4), off = new Float32Array(n * 4), col = new Float32Array(n * 3), c = new THREE.Color();
      const jc = ['#ff7ad9', '#7df9ff', '#b388ff', '#ffb36b'];
      for (let i = 0; i < n; i++) {
        swim.set([rnd() * 6.283, ring0 + 2 + rnd() * 30, 52 + rnd() * 36, (rnd() - 0.5) * 0.02], i * 4);
        off.set([rnd(), rnd(), 0, 2.4 + rnd() * 2.0], i * 4);
        c.set(jc[i % jc.length]); col.set([c.r, c.g, c.b], i * 3);
      }
      const ig = new THREE.InstancedBufferGeometry(); ig.setAttribute('position', geo.attributes.position);
      ig.setAttribute('aSwim', new THREE.InstancedBufferAttribute(swim, 4)); ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); ig.setAttribute('aCol', new THREE.InstancedBufferAttribute(col, 3));
      ig.instanceCount = n;
      // (brighter at night, when they're the light down here; past white on Medium / High so they glow)
      const hdr = !low && BL.Post && BL.Post.wanted();
      const jm = new THREE.ShaderMaterial({ uniforms: { uT: T, uFogD: FOGD, uK: { value: (night ? 0.9 : 0.42) * (hdr ? 1.8 : 1) } }, vertexShader: JELLY_V, fragmentShader: JELLY_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const jelly = new THREE.Mesh(ig, jm); jelly.frustumCulled = false; jelly.renderOrder = 4;
      out.push(jelly);
    }
    for (const o of out) root.add(o);
    H.anim.push((dt, t) => { T.value = t; });
    return out;
  };
})(window.BL);
