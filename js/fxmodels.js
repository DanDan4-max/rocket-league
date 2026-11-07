'use strict';
// Rocket League (fan remake) - 3D goal explosion models, all built in code (nothing to download, so they work opened
// from disk too): Dueling Dragons, Kraken, Crystal Spire, Gold Rush, Volcano, Abduction and Disco Fever, plus the
// shared 3D pieces the other explosions use (tumbling debris, shockwave domes, crystal spikes). Every one has a
// lighter Very Low version (fewer pieces and segments, no extra parts).
(function (BL) {
  const FX = BL.FX, U = BL.util, V3 = THREE.Vector3, EX = FX.EX, C = FX.C;
  const FXM = BL.FXM = {};
  // detail: 0 Very Low, 1 Low, 2 Medium, 3 High
  const LV = () => (BL.App && BL.App.potato ? 0 : FX.quality === 'low' ? 1 : FX.quality === 'high' ? 3 : 2);
  const UP = new V3(0, 1, 0);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
  const win = (t, a, b) => smooth(a, a + 0.12, t) * (1 - smooth(b - 0.12, b, t));
  const backOut = (e) => 1 + 2.70158 * Math.pow(e - 1, 3) + 1.70158 * Math.pow(e - 1, 2);
  const flatDir = (dir) => dir.clone().setY(0).normalize();
  const sideOf = (fwd) => new V3(-fwd.z, 0, fwd.x);
  // a point in an explosion's own frame: f out of the goal, x across it, y height
  const frame = (p, fwd, side) => (f, x, y) => new V3(p.x, y, p.z).addScaledVector(fwd, f).addScaledVector(side, x);
  const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _d = new V3();
  const _x = new V3(), _y = new V3(), _z = new V3();

  // ---------- one lit material for every model ----------
  // Colour slots picked per vertex (aMat): 0 main (cA), 1 accent (cB), 2 ivory (cI), 3 dark (cD), 4 eyes (cE); aGlow
  // makes a vertex glow, aBu is where it sits along a body (0 head .. 1 tail) for burning away. Lit from the
  // viewer's side so the models read well from any camera, with a rim light, a highlight and glow. BODY adds the
  // patterns drawn on the dragon / tentacle tubes (uv along and around).
  const LIT_V = `
    attribute float aMat;
    attribute float aGlow;
    attribute float aBu;
    varying float vMat;
    varying float vGlow;
    varying float vBu;
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vIC;
    #ifdef BODY
    varying vec2 vU;
    #endif
    #include <fog_pars_vertex>
    void main() {
      vMat = aMat; vGlow = aGlow; vBu = aBu;
      #ifdef BODY
      vU = uv;
      #endif
      vec4 lp = vec4(position, 1.0);
      vec3 ln = normal;
      #ifdef USE_INSTANCING
      lp = instanceMatrix * lp;
      ln = mat3(instanceMatrix) * ln;
      #endif
      #ifdef USE_INSTANCING_COLOR
      vIC = instanceColor;
      #else
      vIC = vec3(1.0);
      #endif
      vec4 wp = modelMatrix * lp;
      vN = normalize(mat3(modelMatrix) * ln);
      vV = cameraPosition - wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const LIT_F = `
    uniform vec3 cA;
    uniform vec3 cB;
    uniform vec3 cI;
    uniform vec3 cD;
    uniform vec3 cE;
    uniform vec3 rimC;
    uniform float fade;
    uniform float burn;
    uniform float specK;
    uniform float rimK;
    uniform float glowK;
    uniform float glow0;
    uniform float time;
    uniform float scu;
    uniform float pat;
    uniform float twk;
    varying float vMat;
    varying float vGlow;
    varying float vBu;
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vIC;
    #ifdef BODY
    varying vec2 vU;
    #endif
    #include <fog_pars_fragment>
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 base = vMat < 0.5 ? cA : vMat < 1.5 ? cB : vMat < 2.5 ? cI : vMat < 3.5 ? cD : cE;
      float gw = vGlow + glow0;
      vec3 add = vec3(0.0);
      float nz = hash(vec2(floor(vBu * 60.0), floor(vMat + 0.5)));
      float bu = vBu;
      #ifdef BODY
      float up = sin(vU.y * 6.2832);
      float bk = 1.0 - smoothstep(-0.55, -0.15, up);
      nz = hash(floor(vU * vec2(56.0, 9.0)));
      bu = vU.x;
      if (pat < 0.5) {
        // dragon: rows of scales on the back, banded belly plates, a glowing spine with pulses running down it
        vec2 g = vec2(vU.x * scu, vU.y * 14.0);
        g.y += mod(floor(g.x), 2.0) * 0.5;
        vec2 f = fract(g) - 0.5;
        float d = length(f * vec2(1.0, 1.3));
        base = mix(cA * (0.55 + 0.6 * (1.0 - smoothstep(0.1, 0.55, d))), cB * (0.7 + 0.3 * smoothstep(0.0, 0.2, fract(vU.x * scu * 0.5))), bk);
        add = cB * cB * smoothstep(0.86, 0.98, up) * (0.4 + 1.8 * pow(0.5 + 0.5 * sin(vU.x * 40.0 - time * 14.0), 6.0));
      } else {
        // tentacle: smooth skin, rows of suckers along the inside
        float s = length(vec2(fract(vU.x * scu) - 0.5, (fract(vU.y * 18.0) - 0.5) * 0.8));
        base = mix(cA * (0.85 + 0.15 * sin(vU.x * 50.0)), cB * 0.9, bk * 0.85);
        base = mix(base, cB * 0.5, bk * (1.0 - smoothstep(0.28, 0.34, s)) * (1.0 - 0.6 * (1.0 - smoothstep(0.1, 0.16, s))));
      }
      #endif
      float e = burn * 1.3 - bu - 0.18 * nz;
      if (burn > 0.0 && e > 0.0) discard;
      base *= vIC;
      base *= base;
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec3 v = normalize(vV);
      vec3 L = normalize(v * 0.5 + vec3(0.25, 0.9, 0.15));
      float dif = max(dot(n, L), 0.0);
      float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      float sp = pow(max(dot(reflect(-L, n), v), 0.0), 30.0);
      float tw = 1.0;
      if (twk > 0.0 && gw > 1.0) tw = 1.0 - twk * 0.7 + twk * 2.5 * step(0.84, fract(gw * 37.0 + time * 1.3));
      vec3 col = base * (0.3 + 0.85 * dif + 0.15 * max(-n.y, 0.0)) + rimC * rimC * fr * rimK + vec3(sp * specK) + base * gw * glowK * tw + add;
      if (burn > 0.0) col += rimC * rimC * 4.0 * smoothstep(-0.14, 0.0, e);
      gl_FragColor = vec4(col, fade);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`;
  const col3 = (c, d) => (Array.isArray(c) ? new THREE.Color(c[0], c[1], c[2]) : new THREE.Color(c || d));
  function litMat(o) {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        cA: { value: col3(o.a, '#ffffff') }, cB: { value: col3(o.b, '#ffcf3f') }, cI: { value: col3(o.i, '#f4ead2') }, cD: { value: col3(o.d, '#241010') },
        cE: { value: col3(o.e, [2.2, 1.9, 1.1]) }, rimC: { value: col3(o.rim, '#ffd27a') },
        fade: { value: 1 }, burn: { value: 0 }, specK: { value: o.spec == null ? 0.3 : o.spec }, rimK: { value: o.rimK == null ? 0.9 : o.rimK },
        glowK: { value: o.glowK == null ? 1.6 : o.glowK }, glow0: { value: o.glow0 || 0 }, time: { value: 0 }, scu: { value: o.scu || 40 }, pat: { value: o.pat || 0 }, twk: { value: o.twk || 0 },
      }]),
      vertexShader: LIT_V, fragmentShader: LIT_F, defines: o.body ? { BODY: '' } : {},
      transparent: true, depthWrite: true, side: o.double ? THREE.DoubleSide : THREE.FrontSide, fog: true,
    });
  }
  FXM.litMat = litMat;

  // ---------- building models out of simple shapes ----------
  const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new V3(sx || 1, sy || sx || 1, sz || sx || 1));
  // a shape tagged with its colour slot and glow (numbers, or functions of the point before it's moved into place)
  function part(geo, mat, glow, m) {
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const P = geo.attributes.position, n = P.count, am = new Float32Array(n), ag = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      am[i] = typeof mat === 'function' ? mat(x, y, z) : mat;
      ag[i] = typeof glow === 'function' ? glow(x, y, z) : glow;
    }
    geo.setAttribute('aMat', new THREE.BufferAttribute(am, 1));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(ag, 1));
    if (m) geo.applyMatrix4(m);
    return geo;
  }
  const merge = (list) => { const g = THREE.BufferGeometryUtils.mergeBufferGeometries(list); list.forEach((x) => x.dispose()); return g; };
  const flatten = (g) => { const f = g.index ? g.toNonIndexed() : g; if (f !== g) g.dispose(); f.computeVertexNormals(); return f; };
  // a box narrowing toward +z (front kx wide, ky tall), faceted
  function taper(g, kx, ky) {
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const t = clamp01(P.getZ(i) + 0.5); P.setXY(i, P.getX(i) * (1 - (1 - kx) * t), P.getY(i) * (1 - (1 - ky) * t)); }
    g.computeVertexNormals();
    return g;
  }
  // a cone from `from` pointing along dir, glowing toward its tip
  function spike(r, h, seg, from, dir, mat, glowTip) {
    const g = new THREE.ConeGeometry(r, h, seg, 1);
    g.translate(0, h / 2, 0);
    part(g, mat, (x, y) => (glowTip ? glowTip * Math.pow(clamp01(y / h), 1.5) : 0));
    g.applyQuaternion(_q.setFromUnitVectors(UP, _d.copy(dir).normalize()));
    g.translate(from.x, from.y, from.z);
    return g;
  }
  // a tube along pts, r0 thick at the start to r1 at the end, glowing toward the end
  function tube(pts, r0, r1, seg, mat, glowTip) {
    const n = pts.length, pos = [], gl = [], idx = [], T = new V3(), X = new V3(), B = new V3(), ref = new V3();
    for (let i = 0; i < n; i++) {
      T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      ref.set(0, 1, 0); if (Math.abs(T.y) > 0.9) ref.set(1, 0, 0);
      X.crossVectors(ref, T).normalize(); B.crossVectors(T, X);
      const f = i / (n - 1), r = r0 + (r1 - r0) * f;
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
        pos.push(pts[i].x + X.x * c + B.x * s, pts[i].y + X.y * c + B.y * s, pts[i].z + X.z * c + B.z * s);
        gl.push(glowTip * f * f);
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j; idx.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    part(g, mat, 0); g.attributes.aGlow.array.set(gl);
    return g;
  }
  const curve = (pts, n) => new THREE.CatmullRomCurve3(pts).getPoints(n);
  const sph = (seg, rx, ry, rz, x, y, z, mat, glow, ry2) => part(new THREE.SphereGeometry(1, seg, Math.max(4, (seg * 0.6) | 0)), mat, glow, M4(x, y, z, 0, ry2 || 0, 0, rx, ry, rz));

  // ---------- moving parts drawn as one mesh ----------
  // Rigid pieces (spines, legs, tail fins) are copied into one geometry each frame at their own place; raw slots are
  // filled by hand (whiskers). One draw call for all of them.
  class Dyn {
    constructor() { this.src = []; this.n = 0; }
    slot(geo, count) { const s = { geo, count, off: this.n, vc: geo.attributes.position.count }; this.n += s.vc * count; this.src.push(s); return s; }
    raw(vc, mat, glow) { const s = { geo: null, count: 1, off: this.n, vc, mat, glow }; this.n += vc; this.src.push(s); return s; }
    build(material) {
      const n = this.n, am = new Float32Array(n), ag = new Float32Array(n);
      this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3); this.bu = new Float32Array(n);
      for (const s of this.src) {
        if (!s.geo) { am.fill(s.mat, s.off, s.off + s.vc); ag.fill(s.glow, s.off, s.off + s.vc); continue; }
        for (let k = 0; k < s.count; k++) { am.set(s.geo.attributes.aMat.array, s.off + k * s.vc); ag.set(s.geo.attributes.aGlow.array, s.off + k * s.vc); }
      }
      const g = this.geo = new THREE.BufferGeometry();
      this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
      this.aN = new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage);
      this.aB = new THREE.BufferAttribute(this.bu, 1).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.aP); g.setAttribute('normal', this.aN); g.setAttribute('aBu', this.aB);
      g.setAttribute('aMat', new THREE.BufferAttribute(am, 1)); g.setAttribute('aGlow', new THREE.BufferAttribute(ag, 1));
      this.mesh = new THREE.Mesh(g, material); this.mesh.frustumCulled = false;
      return this.mesh;
    }
    stamp(s, k, m, bu) {
      const sp = s.geo.attributes.position.array, sn = s.geo.attributes.normal.array, e = m.elements, o = s.off + k * s.vc;
      const P = this.pos, N = this.nrm;
      for (let v = 0; v < s.vc; v++) {
        const a = v * 3, i = (o + v) * 3, x = sp[a], y = sp[a + 1], z = sp[a + 2], nx = sn[a], ny = sn[a + 1], nz = sn[a + 2];
        P[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const tx = e[0] * nx + e[4] * ny + e[8] * nz, ty = e[1] * nx + e[5] * ny + e[9] * nz, tz = e[2] * nx + e[6] * ny + e[10] * nz, l = 1 / (Math.sqrt(tx * tx + ty * ty + tz * tz) || 1);
        N[i] = tx * l; N[i + 1] = ty * l; N[i + 2] = tz * l;
        this.bu[o + v] = bu;
      }
    }
    done() { this.aP.needsUpdate = true; this.aN.needsUpdate = true; this.aB.needsUpdate = true; }
    dispose() { if (this.geo) this.geo.dispose(); }
  }

  // ---------- a bendy tube (dragon bodies, tentacles) ----------
  // N rings of M sides along the points P (rebuilt each frame); R is each ring's radius. Frames are carried along the
  // tube (parallel transport) so it never twists; T points toward ring 0.
  class DynTube {
    constructor(N, M, material) {
      this.N = N; this.M = M;
      const V = N * (M + 1), uv = new Float32Array(V * 2), idx = [];
      for (let i = 0; i < N; i++) for (let j = 0; j <= M; j++) { uv[(i * (M + 1) + j) * 2] = i / (N - 1); uv[(i * (M + 1) + j) * 2 + 1] = j / M; }
      for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      this.pos = new Float32Array(V * 3); this.nrm = new Float32Array(V * 3);
      const g = this.geo = new THREE.BufferGeometry();
      this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
      this.aN = new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.aP); g.setAttribute('normal', this.aN); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      this.mesh = new THREE.Mesh(g, material); this.mesh.frustumCulled = false;
      const vs = () => Array.from({ length: N }, () => new V3());
      this.P = vs(); this.T = vs(); this.X = vs(); this.B = vs(); this.R = new Float32Array(N);
    }
    frames(start, hint) {
      const { P, T, X, B, N } = this;
      for (let i = 0; i < N; i++) { T[i].subVectors(P[Math.max(0, i - 1)], P[Math.min(N - 1, i + 1)]); if (T[i].lengthSq() < 1e-10) T[i].copy(i ? T[i - 1] : UP); T[i].normalize(); }
      X[start].crossVectors(hint, T[start]);
      if (X[start].lengthSq() < 1e-6) X[start].set(1, 0, 0).cross(T[start]);
      X[start].normalize(); B[start].crossVectors(T[start], X[start]);
      const st = start === 0 ? 1 : -1;
      for (let k = 1; k < N; k++) {
        const i = start + st * k, j = i - st;
        X[i].copy(X[j]).addScaledVector(T[i], -X[j].dot(T[i]));
        if (X[i].lengthSq() < 1e-8) X[i].copy(X[j]);
        X[i].normalize(); B[i].crossVectors(T[i], X[i]);
      }
    }
    // the cross-section is an oval: wx wide (along X), hb tall (along B)
    shape(wx, hb) {
      const { P, X, B, R, N, M, pos, nrm } = this;
      for (let i = 0; i < N; i++) {
        const p = P[i], x = X[i], b = B[i], r = R[i];
        for (let j = 0; j <= M; j++) {
          const a = (j / M) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), o = (i * (M + 1) + j) * 3;
          pos[o] = p.x + (x.x * c * wx + b.x * s * hb) * r; pos[o + 1] = p.y + (x.y * c * wx + b.y * s * hb) * r; pos[o + 2] = p.z + (x.z * c * wx + b.z * s * hb) * r;
          let nx = x.x * c * hb + b.x * s * wx, ny = x.y * c * hb + b.y * s * wx, nz = x.z * c * hb + b.z * s * wx;
          const l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
          nrm[o] = nx * l; nrm[o + 1] = ny * l; nrm[o + 2] = nz * l;
        }
      }
      this.aP.needsUpdate = true; this.aN.needsUpdate = true;
    }
    dispose() { this.geo.dispose(); }
  }

  // ---------- a path to fly along, by distance ----------
  // Past either end it carries straight on.
  class Track {
    constructor(pts) {
      const P = this.P = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getPoints(240), S = this.S = new Float32Array(P.length);
      for (let i = 1; i < P.length; i++) S[i] = S[i - 1] + P[i].distanceTo(P[i - 1]);
      this.len = S[P.length - 1];
      this.d0 = P[0].clone().sub(P[1]).normalize(); this.d1 = P[P.length - 1].clone().sub(P[P.length - 2]).normalize();
    }
    at(s, out) {
      const P = this.P, S = this.S, K = P.length - 1;
      if (s <= 0) return out.copy(P[0]).addScaledVector(this.d0, -s);
      if (s >= this.len) return out.copy(P[K]).addScaledVector(this.d1, s - this.len);
      let lo = 0, hi = K;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m; else hi = m; }
      return out.copy(P[lo]).lerp(P[hi], (s - S[lo]) / (S[hi] - S[lo] || 1));
    }
    sNear(q) { let best = 0, bd = Infinity; this.P.forEach((p, i) => { const d = p.distanceToSquared(q); if (d < bd) { bd = d; best = i; } }); return this.S[best]; }
  }

  // ---------- shared 3D pieces ----------
  // tumbling debris: rocks, shards, cubes, coins, hearts, crystals, puffs; one instanced mesh per call that bounces
  // on the ground and shrinks away. o: shape, colors, size [a,b], speed [a,b], up, flat, grav, drag, bounce, life,
  // spin, glow, spec, rim, stretch [x,y,z], radius, from(i, out), floor (false: no bounce), snap (voxel grid),
  // vx/vy/vz (set: not carried by the goal push)
  const DG = {};
  function debrisGeo(shape) {
    if (DG[shape]) return DG[shape];
    let g;
    if (shape === 'rock') g = flatten(new THREE.DodecahedronGeometry(0.5, 0));
    else if (shape === 'cube') g = flatten(new THREE.BoxGeometry(0.8, 0.8, 0.8));
    else if (shape === 'puff') g = new THREE.IcosahedronGeometry(0.5, 1);
    else if (shape === 'coin') { g = new THREE.CylinderGeometry(0.5, 0.5, 0.09, 14, 1); g.rotateX(Math.PI / 2); g = flatten(g); }
    else if (shape === 'heart') g = heartGeo();
    else if (shape === 'crystal') g = crystalGeo();
    else g = flatten(new THREE.OctahedronGeometry(0.5, 0));
    if (!g.attributes.aMat) part(g, 0, 0);
    return (DG[shape] = g);
  }
  function heartGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(0.1, -0.3, 0.55, -0.1, 0.5, 0.18); s.bezierCurveTo(0.45, 0.45, 0.1, 0.48, 0, 0.25);
    s.bezierCurveTo(-0.1, 0.48, -0.45, 0.45, -0.5, 0.18); s.bezierCurveTo(-0.55, -0.1, -0.1, -0.3, 0, -0.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1, curveSegments: 5 });
    g.center();
    return part(g, 0, 0);
  }
  function crystalGeo() {
    const a = new THREE.CylinderGeometry(0.42, 0.5, 0.72, 6, 1); a.translate(0, 0.36, 0);
    const b = new THREE.ConeGeometry(0.42, 0.34, 6, 1); b.translate(0, 0.89, 0);
    part(a, 0, (x, y) => y * 0.5); part(b, 0, (x, y) => 0.4 + (y - 0.72) * 2);
    const g = flatten(merge([a, b]));
    g.scale(1, 1 / 1.06, 1);
    return g;
  }
  FX.debris = function (pos, n, o) {
    if (!FX.scene) return null;
    n = Math.max(1, Math.round(n * [0.35, 0.55, 0.8, 1][LV()]));
    const mat = litMat({ a: '#ffffff', rim: o.rim || '#ffffff', spec: o.spec == null ? 0.5 : o.spec, glow0: o.glow || 0, rimK: o.rimK == null ? 0.7 : o.rimK });
    const mesh = new THREE.InstancedMesh(debrisGeo(o.shape || 'shard'), mat, n);
    mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const push = o.vx == null && FX.push, carry = push ? push.k * (o.speed[0] + o.speed[1]) * 0.5 : 0, st = o.stretch || [1, 1, 1], L = [];
    for (let i = 0; i < n; i++) {
      FX.randDir(_d);
      if (o.up) _d.y = Math.abs(_d.y) * o.up + _d.y * (1 - o.up);
      if (o.flat) _d.y *= o.flat;
      if (push) { const bk = _d.x * push.dir.x + _d.z * push.dir.z; if (bk < 0) { _d.x -= 2 * bk * push.dir.x; _d.z -= 2 * bk * push.dir.z; } }
      const sp = U.rand(o.speed[0], o.speed[1]) * (push ? push.s : 1), q = o.from ? o.from(i, new V3()) : pos.clone();
      if (o.radius) q.addScaledVector(_d, U.rand(0, o.radius));
      const sz = U.rand(o.size[0], o.size[1]), wob = 0.7 + Math.random() * 0.6;
      L.push({
        p: q, v: new V3(_d.x * sp + (push ? push.dir.x * carry : 0) + (o.vx || 0), _d.y * sp + (o.vy || 0), _d.z * sp + (push ? push.dir.z * carry : 0) + (o.vz || 0)),
        r: new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3), w: new V3(U.rand(-1, 1), U.rand(-1, 1), U.rand(-1, 1)).multiplyScalar(o.spin == null ? 7 : o.spin),
        s: new V3(st[0] * sz * wob, st[1] * sz, st[2] * sz * (2 - wob)),
      });
      mesh.setColorAt(i, C(o.colors[i % o.colors.length]));
    }
    const life = o.life || 2, grav = o.grav == null ? 12 : o.grav, bounce = o.bounce == null ? 0.35 : o.bounce, drag = o.drag || 0.3, floor = o.floor !== false;
    const upd = (k, dt) => {
      const t = k * life, sc = Math.min(1, (1 - k) / 0.22) * Math.min(1, t * 12 + 0.25);
      for (let i = 0; i < n; i++) {
        const c = L[i];
        if (dt > 0) {
          c.v.y -= grav * dt; c.v.multiplyScalar(Math.max(0, 1 - drag * dt));
          c.p.addScaledVector(c.v, dt);
          const hy = c.s.y * 0.45;
          if (floor && c.p.y < hy) { c.p.y = hy; if (c.v.y < 0) { c.v.y = -c.v.y * bounce; c.v.x *= 0.7; c.v.z *= 0.7; c.w.multiplyScalar(0.6); } }
          c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
        }
        _p.copy(c.p);
        if (o.snap) { _p.x = Math.round(_p.x * 2) / 2; _p.y = Math.round(_p.y * 2) / 2; _p.z = Math.round(_p.z * 2) / 2; }
        _m.compose(_p, o.snap ? _q.identity() : _q.setFromEuler(c.r), _s.copy(c.s).multiplyScalar(sc));
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    upd(0, 0);
    FX.mesh(mesh, life, upd, () => { mat.dispose(); mesh.dispose(); });
    return mesh;
  };

  // a see-through shockwave bubble: bright at its edge, swelling out and fading
  const DOME_V = 'varying vec3 vN; varying vec3 vV; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  const DOME_F = 'uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV; void main() { float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = linearToOutputTexel(vec4(color * (0.05 + 1.2 * pow(f, 2.6)), opacity)); }';
  const domeGeo = [];
  FX.dome = function (pos, color, r1, dur) {
    if (!FX.scene || FX.quiet) return;
    const lv = LV(), geo = domeGeo[lv ? 1 : 0] || (domeGeo[lv ? 1 : 0] = new THREE.SphereGeometry(1, lv ? 28 : 14, lv ? 16 : 8));
    const mat = new THREE.ShaderMaterial({ uniforms: { color: { value: C(color).clone() }, opacity: { value: 1 } }, vertexShader: DOME_V, fragmentShader: DOME_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: lv ? THREE.DoubleSide : THREE.FrontSide });
    const m = new THREE.Mesh(geo, mat), p0 = pos.clone(), push = FX.push;
    m.position.copy(pos); m.renderOrder = 4;
    FX.mesh(m, dur, (k) => {
      const e = 1 - Math.pow(1 - k, 2.2);
      m.scale.setScalar(0.5 + r1 * e); mat.uniforms.opacity.value = (1 - k) * (1 - k);
      if (push) m.position.copy(p0).addScaledVector(push.dir, push.travel * 0.35 * e);
    }, () => mat.dispose());
  };
  FXM.dome = FX.dome;

  // light beams (UFO, disco): an open cone, brightest at its narrow top, soft at the edges
  const BEAM_V = 'varying vec2 vU; varying vec3 vN; varying vec3 vV; void main() { vU = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  const BEAM_F = 'uniform vec3 color; uniform float opacity; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main() { float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.4); float a = opacity * (0.12 + 0.88 * pow(vU.y, 1.6)) * e; gl_FragColor = linearToOutputTexel(vec4(color * a, 1.0)); }';
  const beamMat = (color) => new THREE.ShaderMaterial({ uniforms: { color: { value: C(color).clone() }, opacity: { value: 0 } }, vertexShader: BEAM_V, fragmentShader: BEAM_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  // crystals bursting out of the ground in a wave from the goal, then shattering (Crystal Spire, Ice Shatter)
  // o: n, big (how many giant ones in the middle), reach, spread, h [a,b], bigH [a,b], colors, wave, shatter, life
  FXM.crystals = function (p, dir, o) {
    if (!FX.scene) return;
    const fwd = flatDir(dir), side = sideOf(fwd), n = Math.max(4, Math.round(o.n * [0.35, 0.55, 0.8, 1][LV()]));
    const mat = litMat({ a: '#ffffff', rim: o.rim || '#e8fbff', spec: 1.3, glow0: 0.12, rimK: 1.1, glowK: 1.4 });
    const mesh = new THREE.InstancedMesh(debrisGeo('crystal'), mat, n), list = [];
    mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) {
      const big = i < (o.big || 0);
      const f = big ? o.reach * 0.22 + i * 1.6 : 1 + Math.pow(Math.random(), 0.75) * o.reach, x = big ? (i % 2 ? 1 : -1) * Math.min(i, 2) * 1.7 : U.rand(-1, 1) * (o.spread + f * 0.45);
      const q = new V3(p.x, 0, p.z).addScaledVector(fwd, f).addScaledVector(side, x);
      const h = big ? U.rand(o.bigH[0], o.bigH[1]) : U.rand(o.h[0], o.h[1]) * (1.15 - f / (o.reach * 1.6));
      list.push({ q, h, r: big ? h * 0.13 : U.rand(0.3, 0.7) * (0.6 + h * 0.12), t0: 0.05 + Math.hypot(f, x) * (o.wave || 0.03), e: new THREE.Euler(U.rand(-0.35, 0.35), Math.random() * 6.3, U.rand(-0.35, 0.35)), up: false });
      mesh.setColorAt(i, C(U.choice(o.colors)).clone().lerp(C('#ffffff'), U.rand(0, 0.25)));
    }
    let shattered = false;
    const life = o.life || o.shatter + 0.05;
    const upd = (k, dt) => {
      const t = k * life;
      for (let i = 0; i < n; i++) {
        const c = list[i], g = t >= o.shatter ? 0 : backOut(clamp01((t - c.t0) / 0.24));
        if (!c.up && t >= c.t0 && dt > 0) {
          // it pops out of the ground with a glint and a puff of dust
          c.up = true;
          FX.add.spawn(c.q.x, 0.3, c.q.z, 0, 3, 0, C('#ffffff'), C(o.colors[0]), 1.4, 0.2, 0.35, 0, 1, 1, 1);
          if (i % 2 === 0) FX.alpha.spawn(c.q.x, 0.4, c.q.z, U.rand(-1, 1), 1, U.rand(-1, 1), C('#d8e6f0'), C('#9aa8b4'), 1.2, 3, 0.8, 0, 1.5, FX.S.smoke, 0.45);
        }
        _q.setFromEuler(c.e);
        _m.compose(c.q, _q, _s.set(c.r * 2 * (0.6 + 0.4 * Math.min(1, g)), c.h * Math.max(0.0001, g), c.r * 2 * (0.6 + 0.4 * Math.min(1, g))));
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mat.uniforms.glow0.value = 0.12 + 0.1 * Math.sin(t * 9);
      if (!shattered && t >= o.shatter) {
        shattered = true;
        FX.debris(null, n * 3, { shape: 'shard', colors: o.colors.concat(['#ffffff']), size: [0.2, 0.5], speed: [4, 14], up: 0.6, glow: 0.5, spec: 1.5, life: 1.6, grav: 14, stretch: [0.6, 1.6, 0.6], vx: 0,
          from: (i, out) => { const c = list[i % n]; return out.copy(c.q).setY(Math.random() * c.h); } });
        for (let i = 0; i < Math.min(n, 8); i++) { const c = list[(i * 7) % n]; FX.burst(_p.copy(c.q).setY(c.h * 0.6), 14, { colors: ['#ffffff', o.colors[0]], speed: [3, 9], size: [0.6, 0.05], life: [0.4, 0.8], grav: 4, shape: 1, vx: 0, vz: 0 }); }
        if (o.onShatter) o.onShatter();
      }
    };
    upd(0, 0);
    FX.mesh(mesh, life, upd, () => mat.dispose());
  };

  // ---------- Dueling Dragons ----------
  // Two eastern dragons (antlers, whiskers, mane, legs, spines and a scaled body) burst out of the goal twisting
  // round each other, rear up on either side and lunge: the scorer's dragon (their colour) smashes through the
  // other (the other team's colour), which burns away, then climbs and blows up into fireworks.
  const HS = 1.05, R0 = 0.78;
  const KITS = {};
  function dragonKit(lv) {
    if (KITS[lv]) return KITS[lv];
    const hi = lv >= 2, s = hi ? 12 : lv ? 9 : 7;
    // head (+z forward, +y up), the lower jaw separate so it can open
    const H = [];
    H.push(sph(s, 0.62, 0.5, 0.74, 0, 0.12, 0, 0, 0));
    H.push(part(taper(new THREE.BoxGeometry(1, 1, 1, 1, 1, 2), 0.6, 0.72), 0, 0, M4(0, 0.06, 0.95, 0, 0, 0, 0.8, 0.42, 1.6)));
    H.push(part(new THREE.BoxGeometry(1, 1, 1), 1, 0.25, M4(0, 0.28, 0.85, 0.06, 0, 0, 0.14, 0.08, 1.35)));
    H.push(sph(s, 0.3, 0.2, 0.24, 0, 0.12, 1.72, 0, 0));
    for (const x of [-1, 1]) {
      H.push(sph(6, 0.07, 0.06, 0.07, x * 0.13, 0.24, 1.84, 3, 0));
      H.push(sph(s, 0.17, 0.1, 0.42, x * 0.31, 0.42, 0.45, 1, 0.15, x * 0.3));
      H.push(sph(s, 0.12, 0.09, 0.15, x * 0.36, 0.3, 0.58, 4, 1));
      H.push(spike(0.075, 0.4, 6, new V3(x * 0.25, -0.1, 1.42), new V3(0, -1, 0.15), 2, 0));
      for (let k = 0; k < (hi ? 4 : 2); k++) { const z = 0.6 + k * 0.2; H.push(spike(0.045, 0.2, 4, new V3(x * 0.33 * (1 - (z - 0.5) * 0.28), -0.12, z), new V3(0, -1, 0.1), 2, 0)); }
      // antlers: a swept-back horn with one tine
      H.push(tube(curve([new V3(x * 0.28, 0.48, -0.1), new V3(x * 0.46, 0.92, -0.62), new V3(x * 0.54, 1.12, -1.3), new V3(x * 0.44, 1.2, -1.95)], hi ? 10 : 5), 0.13, 0.025, hi ? 6 : 4, 2, 0.35));
      H.push(tube(curve([new V3(x * 0.5, 1.02, -0.85), new V3(x * 0.72, 1.4, -0.9), new V3(x * 0.78, 1.62, -1.12)], hi ? 6 : 3), 0.075, 0.02, hi ? 5 : 3, 2, 0.35));
      H.push(spike(0.17, 0.75, 5, new V3(x * 0.52, -0.02, 0), new V3(x * 0.85, -0.25, -0.6), 1, 0.3));
    }
    // a mane of flame-like spikes round the back of the head
    const K = hi ? 11 : 6;
    for (let k = 0; k < K; k++) {
      const ph = -1.9 + (3.8 * k) / (K - 1), len = (k % 2 ? 0.85 : 1.15) * (1 - Math.abs(ph) * 0.12);
      H.push(spike(0.13, len, 5, new V3(Math.sin(ph) * 0.42, 0.12 + Math.cos(ph) * 0.38, -0.42), new V3(Math.sin(ph) * 0.75, Math.cos(ph) * 0.6 + 0.15, -1), k % 2 ? 0 : 1, 0.55));
    }
    // the throat glows like there's fire in it
    H.push(sph(s, 0.3, 0.1, 0.72, 0, -0.12, 0.95, 1, 1.4));
    const J = [];
    J.push(part(taper(new THREE.BoxGeometry(1, 1, 1, 1, 1, 2), 0.55, 0.75), 0, 0, M4(0, -0.1, 0.78, 0, 0, 0, 0.66, 0.22, 1.5)));
    J.push(part(new THREE.BoxGeometry(1, 1, 1), 1, 0, M4(0, -0.22, 0.72, 0, 0, 0, 0.5, 0.06, 1.3)));
    for (const x of [-1, 1]) {
      J.push(spike(0.06, 0.3, 5, new V3(x * 0.19, 0, 1.36), new V3(0, 1, 0.1), 2, 0));
      for (let k = 0; k < (hi ? 4 : 2); k++) { const z = 0.55 + k * 0.2; J.push(spike(0.04, 0.17, 4, new V3(x * 0.28 * (1 - (z - 0.5) * 0.3), 0, z), new V3(0, 1, -0.05), 2, 0)); }
    }
    for (let k = 0; k < (hi ? 5 : 3); k++) { const x = (k - (hi ? 2 : 1)) * 0.13; J.push(spike(0.07, 0.65 - Math.abs(x), 4, new V3(x, -0.24, 0.45 + Math.abs(x)), new V3(x, -0.7, -1), 1, 0.4)); }
    // a back spine: a swept fin, gold toward its glowing tip
    const fw = 0.07, fin = new THREE.BufferGeometry();
    fin.setAttribute('position', new THREE.Float32BufferAttribute([-fw, 0, 0.32, fw, 0, 0.32, -fw, 0, -0.32, fw, 0, -0.32, 0, 1, -0.55], 3));
    fin.setIndex([0, 4, 1, 1, 4, 3, 3, 4, 2, 2, 4, 0, 0, 1, 3, 0, 3, 2]);
    // legs (attach at the origin on the body's side and hang down), three ivory claws each
    const leg = (sx) => {
      const G = [], sg = hi ? 6 : 4;
      G.push(tube(curve([new V3(0, 0.1, 0.05), new V3(sx * 0.35, -0.42, 0.12), new V3(sx * 0.42, -0.85, -0.12)], 4), 0.24, 0.15, sg, 0, 0));
      G.push(tube(curve([new V3(sx * 0.42, -0.85, -0.12), new V3(sx * 0.47, -1.08, 0.05), new V3(sx * 0.5, -1.22, 0.25)], 4), 0.15, 0.11, sg, 0, 0));
      G.push(sph(sg, 0.17, 0.12, 0.2, sx * 0.5, -1.26, 0.3, 0, 0));
      for (let k = -1; k <= 1; k++) G.push(spike(0.05, 0.32, 4, new V3(sx * 0.5 + k * 0.09, -1.28, 0.42), new V3(k * 0.35, -0.5, 1), 2, 0.15));
      G.push(spike(0.09, 0.55, 4, new V3(sx * 0.42, -0.85, -0.12), new V3(sx * 0.3, 0.2, -1), 1, 0.5));
      const g = merge(G), f = g.toNonIndexed(); g.dispose();
      return f;
    };
    return (KITS[lv] = { head: merge(H), jaw: merge(J), fin: flatten(part(fin, (x, y) => (y > 0.5 ? 1 : 0), (x, y) => y * y * 0.9)), legR: lv ? leg(1) : null, legL: lv ? leg(-1) : null });
  }
  function makeDragon(kit, lv, ca, cb) {
    const N = [20, 28, 38, 48][lv], Mr = [6, 8, 10, 12][lv];
    const bodyMat = litMat({ body: true, a: ca, b: cb, rim: '#ffd27a', rimK: 0.55, scu: 46, spec: 0.35 });
    const partMat = litMat({ a: ca, b: cb, rim: '#ffd27a', rimK: 0.4, double: true, spec: 0.35 });
    const body = new DynTube(N, Mr, bodyMat);
    const head = new THREE.Mesh(kit.head, partMat), jaw = new THREE.Mesh(kit.jaw, partMat);
    jaw.position.set(0, -0.1, 0.05); head.add(jaw); head.scale.setScalar(HS);
    const fstep = lv ? 2 : 3, nf = Math.floor((N - 8) / fstep), dyn = new Dyn();
    const D = { N, body, head, jaw, dyn, fstep, nf, mats: [bodyMat, partMat] };
    D.fins = dyn.slot(kit.fin, nf); D.tuft = dyn.slot(kit.fin, 5);
    if (kit.legR) D.legs = [dyn.slot(kit.legR, 2), dyn.slot(kit.legL, 2)];
    if (lv) { D.wh = dyn.raw(252, 1, 0.5); D.WP = [0, 1].map(() => Array.from({ length: 8 }, () => new V3())); }
    D.g = new THREE.Group(); D.g.add(body.mesh, head, dyn.build(partMat));
    D.dispose = () => { body.dispose(); dyn.dispose(); bodyMat.dispose(); partMat.dispose(); };
    return D;
  }
  // puts a dragon's body along its track with its head at distance s, legs paddling and whiskers streaming
  function poseDragon(D, tr, s, t, L, open) {
    const B = D.body, N = D.N, P = B.P, ds = L / (N - 1);
    for (let i = 0; i < N; i++) tr.at(s - i * ds, P[i]);
    B.frames(0, UP);
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      B.R[i] = R0 * (f < 0.12 ? 0.55 + (0.45 * f) / 0.12 : 0.06 + 0.94 * Math.pow(1 - (f - 0.12) / 0.88, 0.8)) * (1 + 0.06 * Math.sin(i * 0.8 - t * 10));
    }
    B.shape(1, 0.86);
    const T = B.T, X = B.X, Bn = B.B, R = B.R, dy = D.dyn;
    _m.makeBasis(X[0], Bn[0], T[0]);
    D.head.quaternion.setFromRotationMatrix(_m);
    D.head.position.copy(P[0]).addScaledVector(T[0], 0.3 * HS);
    D.jaw.rotation.x = open;
    // spines down the back, shrinking toward the tail
    for (let k = 0; k < D.nf; k++) {
      const i = 3 + k * D.fstep, h = 0.35 + 1.25 * R[i];
      _m.makeBasis(X[i], Bn[i], T[i]).scale(_s.set(1 + R[i] * 0.6, h, 0.8 + R[i] * 0.5)).setPosition(_p.copy(P[i]).addScaledVector(Bn[i], R[i] * 0.78));
      dy.stamp(D.fins, k, _m, i / (N - 1));
    }
    // a fan of flame fins at the tip of the tail
    const it = N - 1;
    for (let k = 0; k < 5; k++) {
      const a = (k - 2) * 0.42;
      _y.copy(T[it]).multiplyScalar(-1).addScaledVector(Bn[it], Math.cos(a) * 0.55).addScaledVector(X[it], Math.sin(a) * 0.9).normalize();
      _x.crossVectors(_y, T[it]); if (_x.lengthSq() < 1e-6) _x.copy(X[it]); _x.normalize();
      _z.crossVectors(_x, _y);
      _m.makeBasis(_x, _y, _z).scale(_s.set(1.6, 1.7 - Math.abs(k - 2) * 0.3, 1.4)).setPosition(P[it]);
      dy.stamp(D.tuft, k, _m, 1);
    }
    if (D.legs) {
      const at = [Math.round(0.2 * (N - 1)), Math.round(0.56 * (N - 1))];
      for (let k = 0; k < 2; k++) {
        const i = at[k], r = R[i], sw = 0.55 * Math.sin(t * 9 + k * 2.2);
        for (let sd = 0; sd < 2; sd++) {
          const sg = sd ? -1 : 1;
          _m.makeBasis(X[i], Bn[i], T[i]).setPosition(_p.copy(P[i]).addScaledVector(X[i], sg * r * 0.72).addScaledVector(Bn[i], -r * 0.3));
          _m.multiply(_m2.makeRotationX(sg * sw)).scale(_s.setScalar(0.75 + r * 0.6));
          dy.stamp(D.legs[sd], k, _m, i / (N - 1));
        }
      }
    }
    if (D.wh) {
      // two long whiskers off the snout, streaming back and waving
      const pos = dy.pos, nrm = dy.nrm, Hp = D.head.position, X0 = X[0], B0 = Bn[0], T0 = T[0];
      let o = D.wh.off * 3;
      const vert = (c, a, r) => {
        const cx = Math.cos(a), sx = Math.sin(a), nx = X0.x * cx + B0.x * sx, ny = X0.y * cx + B0.y * sx, nz = X0.z * cx + B0.z * sx;
        pos[o] = c.x + nx * r; pos[o + 1] = c.y + ny * r; pos[o + 2] = c.z + nz * r; nrm[o] = nx; nrm[o + 1] = ny; nrm[o + 2] = nz; o += 3;
      };
      for (let w = 0; w < 2; w++) {
        const sx = w ? -1 : 1, WP = D.WP[w];
        for (let k = 0; k < 8; k++) WP[k].copy(Hp).addScaledVector(X0, sx * (0.3 + 0.13 * k) * HS).addScaledVector(B0, (-0.02 - 0.07 * k + Math.sin(t * 9 - k * 0.7 + w) * 0.05 * k) * HS).addScaledVector(T0, (1.5 - 0.55 * k) * HS);
        for (let k = 0; k < 7; k++) {
          const r0 = (0.07 * (1 - k / 8) + 0.015) * HS, r1 = (0.07 * (1 - (k + 1) / 8) + 0.015) * HS;
          for (let j = 0; j < 3; j++) {
            const a0 = j * 2.0944, a1 = a0 + 2.0944;
            vert(WP[k], a0, r0); vert(WP[k + 1], a0, r1); vert(WP[k], a1, r0);
            vert(WP[k], a1, r0); vert(WP[k + 1], a0, r1); vert(WP[k + 1], a1, r1);
          }
        }
      }
    }
    dy.done();
  }
  EX.dragons = (p, a, b, dir) => {
    const lv = LV(), kit = dragonKit(lv), fwd = flatDir(dir), side = sideOf(fwd), W = frame(p, fwd, side);
    const opp = BL.TEAM_MAIN[BL.TEAM_MAIN[0] === b ? 1 : 0] || '#ff7a1a', cols = [[a, '#ffcf3f'], [opp, '#ffe39a']];
    // the flight: out of the back of the goal, a twisting helix up the middle, a rearing loop out to each side, a
    // lunge into each other; the winner (0) carries on up
    // (kept low and close enough to the goal for the garage camera)
    const H = lv ? 12 : 8, clash = W(4.8, 0, 6), starts = [];
    const tracks = [1, -1].map((sg, d) => {
      const pts = [W(-13, -sg * 1.2, 2.1), W(-6.5, -sg * 1.4, 2.3)];
      for (let k = 0; k <= H; k++) {
        const u = k / H, ang = (sg > 0 ? Math.PI : 0) + u * 3 * Math.PI, r = 2.0 * (1 - 0.2 * u);
        pts.push(W(-1 + 8 * u, Math.cos(ang) * r, 2.5 + 1.2 * u + Math.sin(ang) * r * 0.8));
      }
      starts[d] = pts[2].clone();
      for (const [f, x, y] of [[8, 3.8, 4.6], [9, 6.2, 6], [8.6, 7, 7.6], [7.2, 6.4, 8.2], [5.8, 4.8, 7.6], [5.1, 2.7, 6.6], [4.8, 1.2, 6.1]]) pts.push(W(f, sg * x, y));
      pts.push(clash.clone());
      if (d === 0) for (const [f, x, y] of [[4.5, -1.8, 7.4], [4.1, -1.2, 9], [4, 0, 9.8]]) pts.push(W(f, x, y));
      return new Track(pts);
    });
    const s0 = tracks.map((tr, d) => tr.sNear(starts[d])), sc = [tracks[0].sNear(clash), tracks[1].len];
    const Ds = cols.map((c) => makeDragon(kit, lv, c[0], c[1])), grp = new THREE.Group();
    Ds.forEach((D) => grp.add(D.g));
    const L = 12, TC = 2.0, TB = 2.55, DUR = 3.05, dens = FX.density;
    let clashT = 0, sClash = 0, boomed = false;
    const sAt = [0, 0];
    const update = (k, dt) => {
      const t = k * DUR;
      for (let d = 0; d < 2; d++) {
        const D = Ds[d], tr = tracks[d];
        let s, burn = 0;
        if (d === 0 && t > TC) { const tau = Math.min(1, (t - TC) / (TB - TC)); s = sc[0] + (tr.len - sc[0]) * (1 - (1 - tau) * (1 - tau)); burn = clamp01((t - TB) / 0.42); }
        else if (d === 1 && clashT) { const tau = Math.min(1, (t - clashT) / 0.4); s = sClash - 2.2 * (1 - (1 - tau) * (1 - tau)); burn = clamp01((t - clashT) / 0.42); }
        else { const u = Math.min(1, t / TC); s = s0[d] + (sc[d] - s0[d]) * (0.82 * u + 0.18 * u * u * u); }
        sAt[d] = s;
        const roar = win(t, 1.1, 1.55) + win(t, 1.72, 2.05) + (d === 0 ? win(t, 2.05, 2.55) : 0);
        if (burn >= 1) { D.g.visible = false; continue; }
        poseDragon(D, tr, s, t, L, 0.1 + 0.06 * Math.sin(t * 11 + d) + 0.55 * roar);
        for (const m of D.mats) { m.uniforms.fade.value = Math.min(1, t * 5); m.uniforms.burn.value = burn; m.uniforms.time.value = t; }
        if (dt <= 0) continue;
        const P = D.body.P, T0 = D.body.T[0], c0 = C(cols[d][0]), c1 = C(cols[d][1]);
        if (burn > 0) {
          // burning away from the head back: embers off the burning edge
          const i = Math.min(D.N - 1, Math.floor(burn * 1.15 * (D.N - 1)));
          for (let q = 0; q < 4 * dens; q++) FX.add.spawn(P[i].x + U.rand(-0.6, 0.6), P[i].y + U.rand(-0.6, 0.6), P[i].z + U.rand(-0.6, 0.6), U.rand(-3, 3), U.rand(-1, 4), U.rand(-3, 3), C('#ffffff'), c1, 1.0, 0.1, 0.6, -1, 1, FX.S.spark, 1);
          continue;
        }
        if (roar > 0.35) {
          // fire breath
          const hp = D.head.position, B0 = D.body.B[0];
          for (let q = 0; q < (lv ? 3 : 1); q++) {
            const mx = hp.x + (T0.x * 1.9 - B0.x * 0.2) * HS, my = hp.y + (T0.y * 1.9 - B0.y * 0.2) * HS, mz = hp.z + (T0.z * 1.9 - B0.z * 0.2) * HS;
            FX.add.spawn(mx, my, mz, T0.x * 14 + U.rand(-2, 2), T0.y * 14 + U.rand(-2, 2), T0.z * 14 + U.rand(-2, 2), C('#ffc24a'), c0, 1.1, 2.2, U.rand(0.3, 0.45), -2, 1.4, FX.S.fire, 0.8);
          }
        }
        // embers shed along the body and flames off the tail
        const bp = P[(Math.random() * D.N) | 0];
        FX.add.spawn(bp.x, bp.y, bp.z, U.rand(-1, 1), U.rand(-0.5, 1.5), U.rand(-1, 1), c1, c0, 0.7, 0.05, 0.6, -2, 0.5, FX.S.spark, 1);
        if (lv) { const tp = P[D.N - 1]; FX.add.spawn(tp.x, tp.y, tp.z, U.rand(-1, 1), U.rand(0, 2), U.rand(-1, 1), c1, c0, 1.2, 0.2, 0.4, -1, 1, FX.S.flame, 0.9); }
      }
      // the clash: snout to snout
      if (!clashT && (t >= TC || (t > 1.6 && Ds[0].body.P[0].distanceTo(Ds[1].body.P[0]) < 4.4))) {
        clashT = t; sClash = sAt[1];
        const q = Ds[0].head.position.clone().lerp(Ds[1].head.position, 0.5);
        FX.flash(q, '#ffe6a8', 4.5, 0.35);
        FX.burst(q, 150, { colors: [a, '#ffffff', '#ffcf3f'], speed: [8, 22], size: [1.2, 0.1], life: [0.6, 1.2], grav: 4, drag: 1.2, shape: 1 });
        FX.burst(q, 110, { colors: [opp, '#ffe6b0'], speed: [6, 18], size: [1.1, 0.1], life: [0.5, 1.0], grav: 4, drag: 1.2, shape: 1 });
        FX.ring(q, '#ffffff', 11, 0.5, side); FX.ring(q, a, 16, 0.7, side);
        FX.dome(q, '#ffe2a0', 7, 0.5);
        FX.debris(q, 26, { shape: 'shard', colors: [a, opp, '#ffcf3f'], size: [0.25, 0.6], speed: [8, 20], life: 1.8, grav: 14, glow: 0.6, stretch: [0.7, 1.5, 0.7] });
        FX.lightFlash(q, '#ffe0a0', 14, 7); FX.shake(1.1); BL.Audio.play('boom', 0.9);
      }
      // the winner blows up into fireworks
      if (!boomed && t >= TB) {
        boomed = true;
        const q = Ds[0].head.position.clone();
        FX.flash(q, a, 6, 0.5);
        FX.burst(q, 260, { colors: [a, '#ffcf3f', '#ffffff', '#ff7a1a'], speed: [8, 26], size: [1.3, 0.1], life: [0.9, 1.7], grav: 5, drag: 1, shape: 1 });
        FX.ring(q, '#ffcf3f', 22, 0.8, 'y'); FX.dome(q, a, 10, 0.6);
        for (let i = 0; i < (lv ? 3 : 1); i++) FX.firework(q.x + U.rand(-6, 6), q.y + U.rand(0, 3), q.z + U.rand(-3, 2), i % 2 ? '#ffcf3f' : a, 1.1);
        FX.lightFlash(q, a, 16, 6); FX.shake(0.9); BL.Audio.play('boom', 1);
      }
    };
    update(0, 0);
    FX.mesh(grp, DUR, update, () => Ds.forEach((D) => D.dispose()));
    FX.flash(p, a, 7, 0.45);
    FX.burst(p, 90, { colors: [a, '#ffcf3f', '#ffffff'], speed: [8, 18], size: [1, 0.1], life: [0.4, 0.8], drag: 1.5, shape: 1 });
    BL.Audio.play('whoosh', 1);
  };

  // ---------- Kraken ----------
  // A dark pool opens in front of the goal and huge tentacles (the scorer's colour, rows of suckers) burst up out of
  // it, writhe and curl; the middle ones slam down on the pitch in a big splash, then they all sink back.
  const POOL_V = 'varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const POOL_F = 'uniform vec3 color; uniform float opacity; uniform float time; varying vec2 vU; void main() { float r = length(vU - 0.5) * 2.0; float a = (1.0 - smoothstep(0.55, 1.0, r)) * opacity; float rip = pow(0.5 + 0.5 * sin(r * 26.0 - time * 7.0), 8.0) * (1.0 - r); vec3 c = color + vec3(0.35, 0.7, 0.9) * rip * 0.6; gl_FragColor = linearToOutputTexel(vec4(c, a * (0.75 + rip * 0.25))); }';
  const poolMat = () => new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color('#041a2c') }, opacity: { value: 0 }, time: { value: 0 } }, vertexShader: POOL_V, fragmentShader: POOL_F, transparent: true, depthWrite: false });
  EX.kraken = (p, a, b, dir) => {
    const lv = LV(), fwd = flatDir(dir), side = sideOf(fwd), W = frame(p, fwd, side);
    const K = [3, 4, 5, 6][lv], N = [12, 16, 20, 26][lv], Mr = [6, 7, 8, 10][lv], DUR = 3.1, dens = FX.density;
    const mat = litMat({ body: true, pat: 1, a, b: '#ffe1ec', rim: '#bff3ff', scu: 9, spec: 0.55, rimK: 0.75 });
    const grp = new THREE.Group(), T = [];
    const mid = Math.floor(K / 2);
    for (let i = 0; i < K; i++) {
      const u = K > 1 ? (i / (K - 1)) * 2 - 1 : 0, base = W(5 + (1 - u * u) * 4, u * 9.5, 0);
      const out = base.clone().sub(W(-3, 0, 0)).setY(0).normalize();
      const tb = new DynTube(N, Mr, mat);
      grp.add(tb.mesh);
      const slam = K > 3 ? (i === mid - 1 ? 1.3 : i === mid ? 1.5 : 0) : i === mid ? 1.35 : 0;
      T.push({ tb, base, out, nout: out.clone().negate(), side: new V3().crossVectors(UP, out), L: (10 + 3 * (1 - Math.abs(u))) * U.rand(0.9, 1.1), ph: Math.random() * 6.3, d: 0.12 + Math.abs(u) * 0.25 + Math.random() * 0.12, slam, up: false, hit: false });
    }
    // the pool they come out of
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat());
    pool.rotation.x = -Math.PI / 2; pool.position.copy(W(7, 0, 0.04)); pool.scale.set(26, 15, 1);
    pool.rotation.z = Math.atan2(fwd.x, fwd.z);
    grp.add(pool);
    const splash = (q, big) => {
      FX.burst(q, big ? 90 : 40, { colors: ['#ffffff', '#cfefff', '#7fd4ff'], speed: [3, big ? 14 : 9], size: [0.9, 1.6], life: [0.7, 1.3], grav: 14, drag: 0.6, up: 0.9, blend: 'alpha', alpha: 0.85 });
      FX.burst(q, big ? 36 : 14, { colors: ['#ffffff', '#e6f6ff'], speed: [1, 4], size: [2.2, 4.5], life: [0.8, 1.4], grav: 1, drag: 1.5, up: 0.5, blend: 'alpha', alpha: 0.45 });
      FX.ring(_p.copy(q).setY(0.08), '#bfefff', big ? 16 : 7, big ? 0.9 : 0.8, 'y');
    };
    const _dv = new V3();
    const pose = (o, t) => {
      const e = smooth(o.d, o.d + 0.5, t), sink = smooth(2.45, DUR, t), P = o.tb.P, n = N, ds = o.L / (n - 1);
      const sl = o.slam ? smooth(o.slam, o.slam + 0.2, t) * (1 - smooth(o.slam + 0.55, o.slam + 1.0, t)) : 0;
      const lean = 0.12 + 0.12 * Math.sin(t * 2.1 + o.ph) + sl * 1.35, bend = 0.45 * Math.sin(t * 2.7 + o.ph), curl = (2.3 + 0.7 * Math.sin(t * 3.3 + o.ph * 1.7)) * (1 - sl * 0.85);
      // from the base (last ring, rising out of the ground) up to the tip (ring 0)
      P[n - 1].copy(o.base); P[n - 1].y = -o.L * (1 - e) - o.L * 1.05 * sink - 0.5;
      for (let k = 1; k < n; k++) {
        const i = n - 1 - k, f = k / (n - 1), th = lean + bend * f + curl * f * f * f;
        _dv.copy(UP).multiplyScalar(Math.cos(th)).addScaledVector(o.out, Math.sin(th)).addScaledVector(o.side, 0.25 * Math.sin(t * 2.4 + o.ph + f * 3) * f).normalize();
        P[i].copy(P[i + 1]).addScaledVector(_dv, ds);
      }
      for (let i = 0; i < n; i++) o.tb.R[i] = 0.07 + 0.9 * Math.pow(i / (n - 1), 0.9);
      o.tb.frames(n - 1, o.nout);
      o.tb.shape(1, 1);
      return sl;
    };
    const update = (k, dt) => {
      const t = k * DUR;
      pool.material.uniforms.opacity.value = smooth(0, 0.3, t) * (1 - smooth(2.6, DUR, t)) * 0.85;
      pool.material.uniforms.time.value = t;
      mat.uniforms.time.value = t;
      for (const o of T) {
        const sl = pose(o, t);
        if (dt <= 0) continue;
        if (!o.up && t >= o.d) { o.up = true; splash(o.base, false); }
        if (o.slam && !o.hit && sl > 0.97) {
          o.hit = true;
          const tip = o.tb.P[0].clone().setY(0.2);
          splash(tip, true);
          FX.dome(tip, '#bfefff', 9, 0.5);
          FX.burst(tip, 18, { colors: ['#1a0f2e', '#2b1846'], speed: [1, 4], size: [3, 6], life: [1, 1.6], grav: -0.5, drag: 1.2, blend: 'alpha', alpha: 0.5 });
          FX.shake(1.2); BL.Audio.play('boom', 0.9);
        }
        // water running off them as they rise
        if (o.up && t < 2.4 && Math.random() < 0.5 * dens) { const q = o.tb.P[(Math.random() * N * 0.7) | 0]; FX.alpha.spawn(q.x, q.y, q.z, U.rand(-1, 1), 0, U.rand(-1, 1), C('#e6f7ff'), C('#7fd4ff'), 0.5, 0.3, 0.7, 14, 0.2, 0, 0.8); }
      }
    };
    update(0, 0);
    FX.mesh(grp, DUR, update, () => { T.forEach((o) => o.tb.dispose()); mat.dispose(); pool.geometry.dispose(); pool.material.dispose(); });
    FX.flash(p, '#bff3ff', 6, 0.4);
    splash(W(4, 0, 0.2), true);
    BL.Audio.play('whoosh', 1);
  };

  // ---------- Crystal Spire ----------
  EX.crystal = (p, a, b, dir) => {
    FX.flash(p, '#e8fbff', 8, 0.5);
    FX.burst(p, 120, { colors: ['#ffffff', '#bff4ff', a], speed: [6, 18], size: [0.9, 0.05], life: [0.5, 1.1], grav: 3, drag: 1.4, shape: 1 });
    FX.ring(p, '#bff4ff', 24, 0.9, 'y');
    FXM.crystals(p, dir, { n: 46, big: 3, reach: 16, spread: 4, h: [1.6, 4.5], bigH: [7, 9.5], colors: [a, a, '#6fe3ff', '#b58cff'], wave: 0.035, shatter: 2.15, life: 2.25,
      onShatter: () => { FX.lightFlash(p, '#bff4ff', 12, 6); FX.shake(0.7); BL.Audio.play('boom', 0.6); } });
    FX.lightFlash(p, '#bff4ff', 10, 5);
    BL.Audio.play('freeze', 1);
  };

  // ---------- Gold Rush ----------
  // A fountain of spinning gold coins out of the goal, raining down on the pitch and bouncing; a giant coin rises
  // over the goal and bursts into more.
  let bigCoin = null;
  function bigCoinGeo() {
    if (bigCoin) return bigCoin;
    const G = [], cyl = new THREE.CylinderGeometry(1, 1, 0.16, 32, 1);
    cyl.rotateX(Math.PI / 2); G.push(part(cyl, 0, 0));
    for (const z of [-0.085, 0.085]) G.push(part(new THREE.TorusGeometry(0.9, 0.06, 5, 32), 1, 0.15, M4(0, 0, z)));
    const st = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.24 : 0.58, an = (i / 10) * Math.PI * 2 + Math.PI / 2; if (i) st.lineTo(Math.cos(an) * r, Math.sin(an) * r); else st.moveTo(Math.cos(an) * r, Math.sin(an) * r); }
    for (const z of [-1, 1]) { const g = new THREE.ExtrudeGeometry(st, { depth: 0.05, bevelEnabled: false }); g.translate(0, 0, z > 0 ? 0.08 : -0.13); G.push(part(g, 1, 0.3)); }
    // the extruded stars come non-indexed and the rest indexed: all non-indexed to merge
    return (bigCoin = merge(G.map((g) => { if (!g.index) return g; const f = g.toNonIndexed(); g.dispose(); return f; })));
  }
  EX.goldrush = (p, a, b, dir) => {
    const fwd = flatDir(dir), W = frame(p, fwd, sideOf(fwd)), gold = ['#ffd54a', '#ffc21a', '#ffe680', '#f5b800'];
    const coins = { shape: 'coin', colors: gold, size: [0.55, 0.85], speed: [12, 26], up: 0.75, life: 3.2, grav: 16, bounce: 0.45, spec: 1.4, glow: 0.12, spin: 14, rim: '#fff3b0' };
    FX.flash(p, '#fff1b0', 9, 0.5);
    FX.debris(p, 150, coins);
    FX.after(0.35, () => FX.debris(p, 90, Object.assign({}, coins, { speed: [8, 18] })));
    FX.burst(p, 160, { colors: ['#fff6c8', '#ffd54a', '#ffffff'], speed: [6, 20], size: [0.5, 0.05], life: [0.8, 1.8], grav: 6, shape: 1 });
    FX.ring(p, '#ffd54a', 22, 0.8, 'y');
    const mat = litMat({ a: '#ffc93a', b: '#ffe58a', rim: '#fff1b8', spec: 1.6, rimK: 1.1 });
    const coin = new THREE.Mesh(bigCoinGeo(), mat), from = p.clone(), to = W(5, 0, 8.5);
    let burst = false;
    const upd = (k, dt) => {
      const t = k * 1.6, e = 1 - Math.pow(1 - clamp01(t / 0.9), 3);
      coin.position.lerpVectors(from, to, e); coin.position.y += Math.sin(t * 3) * 0.2;
      coin.rotation.y += dt * 7; coin.rotation.z = Math.sin(t * 2) * 0.15;
      coin.scale.setScalar(0.4 + 2.8 * e);
      mat.uniforms.glow0.value = 0.1 + 0.25 * smooth(1.0, 1.5, t);
      if (!burst && t >= 1.5) {
        burst = true; coin.visible = false;
        const q = coin.position.clone();
        FX.flash(q, '#fff1b0', 12, 0.6);
        FX.debris(q, 80, Object.assign({}, coins, { speed: [8, 20], up: 0.4, vx: 0 }));
        FX.burst(q, 140, { colors: ['#ffffff', '#ffd54a', '#ffe680'], speed: [8, 24], size: [1.0, 0.05], life: [0.7, 1.4], grav: 5, shape: 1 });
        FX.ring(q, '#ffd54a', 26, 0.8, fwd); FX.dome(q, '#ffd54a', 12, 0.6);
        FX.lightFlash(q, '#ffd54a', 14, 6); FX.shake(0.8); BL.Audio.play('boom', 0.8);
      }
    };
    upd(0, 0);
    FX.mesh(coin, 1.6, upd, () => mat.dispose());
    FX.lightFlash(p, '#ffd54a', 12, 5);
    BL.Audio.play('item', 1);
  };

  // ---------- Volcano ----------
  // A volcano shoves up out of the pitch in front of the goal and erupts: a lava fountain, glowing lava bombs
  // that bounce across the pitch, a smoke column; then it sinks back.
  const VOLC = {};
  function volcanoGeo(lv) {
    if (VOLC[lv]) return VOLC[lv];
    const rs = lv ? 22 : 12, g = new THREE.CylinderGeometry(1.7, 6.2, 5.6, rs, lv ? 6 : 3, true);
    g.translate(0, 2.8, 0);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), an = Math.atan2(z, x), k = 1 + 0.09 * Math.sin(an * 5 + y * 1.3) + 0.06 * Math.sin(an * 11 - y * 2.1);
      P.setXYZ(i, x * k, y + (y > 5.5 ? 0.25 * Math.sin(an * 7) : 0), z * k);
    }
    g.computeVertexNormals();
    // lava streaks running down from the crater
    const lava = (x, y, z) => (y > 5.2 || (y > 0.8 && Math.sin(Math.atan2(z, x) * 6 + y * 0.35) > 0.8) ? 1 : 0);
    part(g, lava, (x, y, z) => (lava(x, y, z) ? 0.8 + 0.6 * clamp01(y / 5.6) : 0));
    const pool = new THREE.CircleGeometry(1.75, rs); pool.rotateX(-Math.PI / 2); pool.translate(0, 5.2, 0);
    return (VOLC[lv] = merge([g, part(pool, 1, 1.8)]));
  }
  EX.volcano = (p, a, b, dir) => {
    const lv = LV(), fwd = flatDir(dir), c = new V3(p.x, 0, p.z).addScaledVector(fwd, 6), dens = FX.density, VS = 0.72;
    const mat = litMat({ a: '#3d2c26', b: '#ff5a14', rim: '#ff8a3c', rimK: 0.8, glowK: 2.0, double: true, spec: 0.15 });
    const m = new THREE.Mesh(volcanoGeo(lv), mat);
    m.scale.setScalar(VS); m.position.set(c.x, -6, c.z); m.rotation.y = Math.random() * 6.3;
    const DUR = 3.0, top = new V3();
    let erupted = false, bombs = 0;
    FX.debris(c, 22, { shape: 'rock', colors: ['#3f5f2c', '#4e3b2c', '#2f2420'], size: [0.3, 0.7], speed: [5, 12], up: 0.85, life: 1.6, grav: 16, spec: 0.1, radius: 3, vx: 0 });
    FX.burst(c, 30, { colors: ['#8a7a66', '#5e5244'], speed: [2, 6], size: [2, 4], life: [0.8, 1.4], grav: -0.5, drag: 1.5, flat: 0.4, blend: 'alpha', alpha: 0.55, vx: 0, vz: 0 });
    const upd = (k, dt) => {
      const t = k * DUR, rise = backOut(clamp01(t / 0.45)), sink = smooth(2.45, DUR, t);
      m.position.y = (-6 + 6 * rise - 6.5 * sink) * VS;
      m.position.x = c.x + (t < 0.55 ? U.rand(-0.08, 0.08) : 0); m.position.z = c.z + (t < 0.55 ? U.rand(-0.08, 0.08) : 0);
      mat.uniforms.glowK.value = 1.6 + 0.5 * Math.sin(t * 13) + (erupted ? 0.8 : 0);
      top.set(c.x, m.position.y + 5.3 * VS, c.z);
      if (dt <= 0) return;
      if (!erupted && t > 0.5) {
        erupted = true;
        FX.flash(top, '#ffb24a', 5, 0.4); FX.ring(_p.copy(c).setY(0.1), '#ff7a2a', 26, 0.9, 'y'); FX.dome(top, '#ff9a4a', 7, 0.5);
        FX.lightFlash(top, '#ff7a2a', 14, 4); FX.shake(1.2); BL.Audio.play('boom', 1);
      }
      if (erupted && t < 2.3) {
        // lava fountain: solid glowing blobs (they show against a bright sky) and fire
        for (let q = 0; q < 3 * dens; q++) FX.alpha.spawn(top.x + U.rand(-0.6, 0.6), top.y, top.z + U.rand(-0.6, 0.6), U.rand(-2.5, 2.5), U.rand(9, 15), U.rand(-2.5, 2.5), C('#ffd060'), C('#d83a00'), U.rand(0.7, 1.2), 0.4, U.rand(0.8, 1.2), 16, 0.2, 1, 1);
        for (let q = 0; q < 4 * dens; q++) FX.add.spawn(top.x + U.rand(-0.6, 0.6), top.y, top.z + U.rand(-0.6, 0.6), U.rand(-2, 2), U.rand(6, 11), U.rand(-2, 2), C('#fff1a0'), C('#ff3d00'), U.rand(1.6, 2.6), 0.6, U.rand(0.5, 0.8), 6, 0.6, FX.S.fire, 1);
        if (Math.random() < 0.5) FX.alpha.spawn(top.x + U.rand(-1, 1), top.y + 1, top.z + U.rand(-1, 1), U.rand(-1, 1), U.rand(5, 8), U.rand(-1, 1), C('#3a3330'), C('#1c1a19'), U.rand(3, 5), U.rand(8, 12), U.rand(1.8, 2.6), -0.5, 0.6, FX.S.smoke, 0.75);
        if (t > 0.6 + bombs * 0.45 && bombs < 4) { bombs++; FX.debris(top, 8, { shape: 'rock', colors: ['#ff6a1a', '#ff9a2e', '#5a2a18'], size: [0.35, 0.8], speed: [10, 20], up: 0.92, life: 2.0, grav: 16, glow: 1.3, rim: '#ffb060', bounce: 0.25, spec: 0.1, vx: 0 }); }
      }
    };
    upd(0, 0);
    FX.mesh(m, DUR, upd, () => mat.dispose());
    FX.flash(p, '#ff9a4a', 6, 0.4);
    FX.shake(0.6);
    BL.Audio.play('thunder', 0.5);
  };

  // ---------- Abduction ----------
  // A flying saucer swoops in over the crossbar, hovers, beams a cow up off the pitch and zips away.
  const UFOG = {};
  function ufoGeo(lv) {
    if (UFOG[lv]) return UFOG[lv];
    const seg = lv ? 28 : 14, G = [];
    const prof = [[0.05, -0.42], [0.9, -0.36], [2.0, -0.16], [2.65, -0.02], [2.7, 0.04], [2.35, 0.16], [1.4, 0.34], [0.95, 0.4]].map(([r, y]) => new THREE.Vector2(r, y));
    G.push(part(new THREE.LatheGeometry(prof, seg), 0, 0));
    G.push(part(new THREE.SphereGeometry(1, seg, (seg / 2) | 0, 0, Math.PI * 2, 0, Math.PI / 2), 2, 0.55, M4(0, 0.36, 0, 0, 0, 0, 1, 0.75, 1)));
    const K = lv ? 12 : 8;
    for (let k = 0; k < K; k++) { const an = (k / K) * Math.PI * 2; G.push(part(new THREE.SphereGeometry(0.13, 6, 4), 1, 1.2 + k * 0.071, M4(Math.cos(an) * 2.5, 0.08, Math.sin(an) * 2.5))); }
    G.push(part(new THREE.CylinderGeometry(0.9, 1.0, 0.12, seg, 1), 2, 1.6, M4(0, -0.42, 0)));
    G.push(part(new THREE.TorusGeometry(2.0, 0.06, 4, seg), 3, 0, M4(0, -0.17, 0, Math.PI / 2, 0, 0)));
    return (UFOG[lv] = merge(G));
  }
  let cowG = null;
  function cowGeo() {
    if (cowG) return cowG;
    const G = [], box = (w, h, d, x, y, z, mat) => G.push(part(new THREE.BoxGeometry(1, 1, 1), mat, 0, M4(x, y, z, 0, 0, 0, w, h, d)));
    box(1.0, 0.75, 1.6, 0, 1.05, 0, 0);
    box(1.03, 0.5, 0.5, 0, 1.12, 0.25, 3); box(0.6, 0.77, 0.45, 0.12, 1.05, -0.45, 3);
    box(0.55, 0.5, 0.6, 0, 1.3, 1.0, 0); box(0.5, 0.28, 0.2, 0, 1.18, 1.36, 1);
    for (const x of [-1, 1]) {
      box(0.08, 0.08, 0.05, x * 0.17, 1.42, 1.31, 3); box(0.25, 0.08, 0.12, x * 0.36, 1.45, 0.9, 0);
      G.push(spike(0.05, 0.22, 4, new V3(x * 0.2, 1.55, 0.95), new V3(x * 0.6, 1, 0), 2, 0));
      for (const z of [-1, 1]) { box(0.22, 0.75, 0.22, x * 0.32, 0.375, z * 0.55, 0); box(0.24, 0.12, 0.24, x * 0.32, 0.06, z * 0.55, 3); }
    }
    box(0.35, 0.18, 0.35, 0, 0.62, -0.35, 1);
    G.push(tube([new V3(0, 1.35, -0.8), new V3(0, 1.0, -0.92), new V3(0, 0.75, -0.95)], 0.04, 0.03, 4, 0, 0));
    return (cowG = merge(G));
  }
  EX.ufo = (p, a, b, dir) => {
    const lv = LV(), fwd = flatDir(dir), side = sideOf(fwd), W = frame(p, fwd, side), dens = FX.density;
    const mat = litMat({ a: '#c5ced8', b: a, i: '#8ff3ff', d: '#2a3038', spec: 1.3, rim: '#c8f6ff', rimK: 1.0, twk: 1, glowK: 1.8 });
    const cowMat = litMat({ a: '#f4f4f4', b: '#ff9fb2', i: '#efe6cf', d: '#161616', rim: '#c8f6ff', rimK: 0.6 });
    const ufo = new THREE.Mesh(ufoGeo(lv), mat), cow = new THREE.Mesh(cowGeo(), cowMat);
    const bgeo = new THREE.CylinderGeometry(1.1, 4.2, 1, lv ? 24 : 12, 1, true); bgeo.translate(0, -0.5, 0);
    const beam = new THREE.Mesh(bgeo, beamMat('#9ff3ff'));
    ufo.scale.setScalar(1.5); cow.visible = false; beam.visible = false;
    const grp = new THREE.Group(); grp.add(ufo, beam, cow);
    const hover = W(6, 0, 8.2), from = W(-22, 7, 24), away = W(-4, -40, 44), DUR = 3.0, ARR = 0.7, LEAVE = 2.25;
    let gone = false;
    const upd = (k, dt) => {
      const t = k * DUR;
      if (t < ARR) ufo.position.lerpVectors(from, hover, 1 - Math.pow(1 - t / ARR, 3));
      else if (t < LEAVE) { ufo.position.copy(hover).addScaledVector(side, Math.sin((t - ARR) * 2.3) * 0.6); ufo.position.y += Math.sin((t - ARR) * 5) * 0.35; }
      else ufo.position.lerpVectors(hover, away, Math.pow((t - LEAVE) / (DUR - LEAVE), 2));
      ufo.rotation.y += dt * 3.5; ufo.rotation.x = t < ARR ? 0.35 * (1 - t / ARR) : 0.06 * Math.sin(t * 4);
      mat.uniforms.time.value = t * 3;
      // the tractor beam, and the cow going up it
      const on = smooth(ARR + 0.05, ARR + 0.25, t) * (1 - smooth(LEAVE - 0.15, LEAVE, t));
      beam.visible = on > 0.01;
      beam.position.copy(ufo.position); beam.position.y -= 0.6;
      beam.scale.set(1, Math.max(0.01, beam.position.y), 1);
      beam.material.uniforms.opacity.value = on * (0.6 + 0.15 * Math.sin(t * 30));
      const cu = clamp01((t - ARR - 0.15) / (LEAVE - ARR - 0.3)), ce = cu * cu * (3 - 2 * cu);
      cow.visible = t > ARR && t < LEAVE - 0.05;
      cow.position.set(beam.position.x, (beam.position.y - 1.6) * ce, beam.position.z);
      cow.rotation.y += dt * 2; cow.rotation.z = Math.sin(t * 3) * 0.3 * ce;
      cow.scale.setScalar(Math.max(0.01, cu > 0.85 ? 1 - (cu - 0.85) / 0.15 : 1));
      if (dt <= 0) return;
      if (on > 0.5) for (let q = 0; q < 3 * dens; q++) { const an = Math.random() * 6.283, r = Math.random() * 3.4; FX.add.spawn(beam.position.x + Math.cos(an) * r, 0.3, beam.position.z + Math.sin(an) * r, 0, U.rand(5, 9), 0, C('#ffffff'), C('#5ff0ff'), 0.6, 0.1, 1.0, 0, 0, 1, 0.9); }
      if (t >= LEAVE) FX.add.spawn(ufo.position.x, ufo.position.y, ufo.position.z, 0, 0, 0, C('#ffffff'), C('#8ff3ff'), 2.2, 0.4, 0.35, 0, 0, FX.S.light, 0.8);
      if (!gone && t >= LEAVE) {
        gone = true;
        FX.flash(ufo.position, '#bff6ff', 7, 0.4); FX.ring(ufo.position, '#8ff3ff', 16, 0.6, 'y');
        FX.burst(ufo.position, 60, { colors: ['#ffffff', '#8ff3ff', a], speed: [4, 12], size: [0.7, 0.05], life: [0.5, 1.0], grav: 2, shape: 1, vx: 0, vz: 0 });
        BL.Audio.play('whoosh', 1);
      }
    };
    upd(0, 0);
    FX.mesh(grp, DUR, upd, () => { mat.dispose(); cowMat.dispose(); bgeo.dispose(); beam.material.dispose(); });
    FX.flash(p, '#bff6ff', 6, 0.4);
    FX.burst(p, 80, { colors: ['#ffffff', '#8ff3ff', a], speed: [6, 16], size: [0.8, 0.05], life: [0.4, 0.9], drag: 1.4, shape: 1 });
    BL.Audio.play('whoosh', 0.8);
  };

  // ---------- Disco Fever ----------
  // A giant mirror ball drops in over the goal and spins, sweeping coloured light beams round the pitch to a beat,
  // with confetti; then it bursts into mirror shards.
  const DISCO = {};
  function discoGeo(lv) {
    if (DISCO[lv]) return DISCO[lv];
    const g = flatten(new THREE.IcosahedronGeometry(1, lv ? 2 : 1));
    part(g, 0, 0);
    const gw = g.attributes.aGlow.array;
    for (let i = 0; i < gw.length; i += 3) { const v = 1 + Math.random(); gw[i] = gw[i + 1] = gw[i + 2] = v; }
    return (DISCO[lv] = g);
  }
  EX.disco = (p, a, b, dir) => {
    const lv = LV(), fwd = flatDir(dir), W = frame(p, fwd, sideOf(fwd)), pos = W(6, 0, 7.8), dens = FX.density;
    const mat = litMat({ a: '#dfe4ea', spec: 2.2, rim: '#ffffff', rimK: 0.8, glowK: 0.55, twk: 1 });
    const ball = new THREE.Mesh(discoGeo(lv), mat);
    const wireG = new THREE.CylinderGeometry(0.04, 0.04, 40, 4, 1); wireG.translate(0, 20, 0);
    const wire = new THREE.Mesh(wireG, new THREE.MeshBasicMaterial({ color: 0x222428 }));
    const nB = [3, 4, 6, 6][lv], bcols = [a, '#ff2bd6', '#2bf0ff', '#ffe92b', '#7cff4a', '#ff8a1a'];
    const bgeo = new THREE.CylinderGeometry(0.08, 1.5, 1, lv ? 12 : 8, 1, true); bgeo.translate(0, -0.5, 0);
    const beams = [], grp = new THREE.Group();
    grp.add(ball, wire);
    for (let i = 0; i < nB; i++) { const m = new THREE.Mesh(bgeo, beamMat(bcols[i % bcols.length])); m.scale.set(1, 26, 1); grp.add(m); beams.push(m); }
    ball.scale.setScalar(2.4);
    const DUR = 2.45, POP = 2.35, bdir = new V3();
    let beat = -1, popped = false;
    const upd = (k, dt) => {
      const t = k * DUR, drop = backOut(clamp01(t / 0.5));
      ball.position.copy(pos); ball.position.y = 30 - (30 - pos.y) * drop;
      ball.rotation.y += dt * 1.6; wire.position.copy(ball.position);
      mat.uniforms.time.value = t * 2.2;
      const on = smooth(0.45, 0.6, t) * (1 - smooth(POP - 0.1, POP, t));
      beams.forEach((m, i) => {
        // each beam swings round the ball, aimed down and out at the pitch
        const th = t * (1.2 + i * 0.17) * (i % 2 ? -1 : 1) + (i / nB) * 6.283, ph = 0.55 + 0.3 * Math.sin(t * 1.7 + i);
        bdir.set(Math.sin(ph) * Math.cos(th), -Math.cos(ph), Math.sin(ph) * Math.sin(th));
        m.position.copy(ball.position); m.quaternion.setFromUnitVectors(_y.set(0, -1, 0), bdir);
        m.visible = on > 0.01; m.material.uniforms.opacity.value = on * (0.55 + 0.25 * Math.sin(t * 8 + i));
      });
      if (dt <= 0) return;
      // the beat: a coloured light pulse and a thump every 0.4 s
      const bt = Math.floor((t - 0.5) / 0.4);
      if (t > 0.5 && bt !== beat && t < POP) {
        beat = bt;
        FX.lightFlash(ball.position, bcols[bt % bcols.length], 8, 9); FX.shake(0.25); BL.Audio.play('hit', 0.5);
        if (bt === 0) FX.confetti(_p.copy(ball.position).setY(ball.position.y + 2), 140, { spread: 6, colors: bcols.concat(['#ffffff']), vy: 3, vOut: 4 });
      }
      if (on > 0.5 && Math.random() < 0.6 * dens) { FX.randDir(_d); FX.add.spawn(ball.position.x + _d.x * 2.4, ball.position.y + _d.y * 2.4, ball.position.z + _d.z * 2.4, _d.x * 2, _d.y * 2, _d.z * 2, C('#ffffff'), C(U.choice(bcols)), 1.2, 0.1, 0.4, 0, 0, 1, 1); }
      if (!popped && t >= POP) {
        popped = true; ball.visible = false; wire.visible = false;
        const q = ball.position.clone();
        FX.flash(q, '#ffffff', 12, 0.5);
        FX.debris(q, 40, { shape: 'shard', colors: ['#e8edf2', '#c9d1da', '#ffffff'], size: [0.3, 0.7], speed: [8, 22], life: 1.8, grav: 14, spec: 2.0, glow: 0.2, stretch: [1, 0.2, 1], vx: 0 });
        FX.burst(q, 160, { colors: bcols, speed: [8, 24], size: [0.9, 0.05], life: [0.6, 1.3], grav: 4, shape: 1, vx: 0, vz: 0 });
        FX.ring(q, '#ffffff', 24, 0.7, 'y'); FX.dome(q, '#ff8af0', 8, 0.5);
        FX.shake(0.8); BL.Audio.play('boom', 0.8);
      }
    };
    upd(0, 0);
    FX.mesh(grp, DUR, upd, () => { mat.dispose(); wireG.dispose(); wire.material.dispose(); bgeo.dispose(); beams.forEach((m) => m.material.dispose()); });
    FX.flash(p, '#ff8af0', 6, 0.4);
    FX.burst(p, 90, { colors: bcols, speed: [6, 16], size: [0.8, 0.05], life: [0.4, 0.9], drag: 1.4, shape: 1 });
  };

  // the moment each one looks best in its item picture (seconds after it goes off)
  FX.THUMB_T = { dragons: 1.45, kraken: 1.25, crystal: 0.9, goldrush: 0.75, volcano: 1.3, ufo: 1.4, disco: 1.3 };

  // Before the first goal: build the models of the explosions that can go off (so the goal doesn't stall on it)
  // and compile their shaders.
  const warmed = {};
  FXM.warm = function (fx) {
    setTimeout(() => {
      try {
        const lv = LV();
        if (!warmed[fx + lv]) {
          warmed[fx + lv] = true;
          if (fx === 'dragons') dragonKit(lv);
          else if (fx === 'volcano') volcanoGeo(lv);
          else if (fx === 'ufo') { ufoGeo(lv); cowGeo(); }
          else if (fx === 'disco') discoGeo(lv);
          else if (fx === 'goldrush') { bigCoinGeo(); debrisGeo('coin'); }
          else if (fx === 'crystal' || fx === 'ice') debrisGeo('crystal');
        }
        // once per scene (each has its own fog and lights)
        const r = BL.App && BL.App.renderer, cam = BL.App && BL.App.camera, sc = FX.scene;
        if (!r || !cam || !sc || !r.compile || FXM.compiledFor === sc) return;
        FXM.compiledFor = sc;
        // (the lit material in each variant, the shockwave bubble, light beams and the kraken's pool)
        const dome = new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color() }, opacity: { value: 0 } }, vertexShader: DOME_V, fragmentShader: DOME_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: lv ? THREE.DoubleSide : THREE.FrontSide });
        const g = new THREE.Group(), mats = [litMat({}), litMat({ double: true }), litMat({ body: true }), litMat({}), dome, beamMat('#ffffff'), poolMat()];
        const box = new THREE.BoxGeometry(0.01, 0.01, 0.01);
        for (const i of [0, 1, 2, 4, 5, 6]) g.add(new THREE.Mesh(box, mats[i]));
        const im = new THREE.InstancedMesh(box, mats[3], 1); im.setColorAt(0, C('#ffffff')); g.add(im);
        g.position.set(0, -50, 0);
        sc.add(g); r.compile(sc, cam); sc.remove(g);
        mats.forEach((m) => m.dispose()); box.dispose();
      } catch (e) { /* only a head start */ }
    }, 300);
  };
  FX.EXPLOSIONS = Object.keys(EX);
})(window.BL);
