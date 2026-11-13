'use strict';
// Rocket League (fan remake) - particles, boost trails, goal explosions, demolitions
(function (BL) {
  const U = BL.util;
  const V3 = THREE.Vector3;
  const FX = BL.FX = {};
  FX.clock = { value: 0 }; // shared with every shader that wants the time

  const VERT = `
    attribute float size; attribute vec4 pcolor; attribute float shape; attribute float rot;
    varying vec4 vColor; varying float vShape; varying float vRot;
    uniform float scale; uniform float uTime;
    void main() {
      vColor = pcolor; vShape = shape; vRot = rot;
      // (the twinkle sprite shimmers, each at its own beat)
      if (shape > 14.5 && shape < 15.5) vColor.a *= 0.62 + 0.38 * sin(uTime * 26.0 + rot * 40.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      // fade out right in front of the lens so drifting smoke never fills the screen
      vColor.a *= shape > 12.5 ? smoothstep(1.4, 5.0, -mv.z) : smoothstep(0.7, 2.4, -mv.z);
      gl_PointSize = clamp(size * scale / max(0.1, -mv.z), 0.0, 400.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const FRAG = `
    varying vec4 vColor; varying float vShape; varying float vRot;
    uniform sampler2D atlas; uniform float hasAtlas;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      float r = length(p);
      float a = 0.0, hot = 0.0;
      if (vShape > 4.5 && hasAtlas > 0.5) {
        float tile = floor(vShape - 5.0 + 0.5);
        float cs = cos(vRot), sn = sin(vRot);
        vec2 pc = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) * 0.5 + 0.5;
        if (pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) discard;
        float col = mod(tile, 4.0), row = floor(tile / 4.0);
        vec4 t = texture2D(atlas, vec2((col + pc.x) / 4.0, 1.0 - (row + pc.y) / 6.0));
        // the boost sprites (js/boostfx.js): shape in red, white-hot in green; the older sprites are masks: brightness x alpha
        if (tile > 7.5) { a = t.r; hot = t.g; }
        else a = t.a * max(dot(t.rgb, vec3(0.3, 0.59, 0.11)), 0.35);
      } else if (vShape > 4.5) { a = clamp(1.0 - r, 0.0, 1.0); a = a * a; }
      else if (vShape < 0.5) { a = clamp(1.0 - r, 0.0, 1.0); a = a * a; }
      else if (vShape < 1.5) { a = pow(clamp(1.0 - r, 0.0, 1.0), 2.0) + clamp(1.0 - abs(p.x) * 7.0, 0.0, 1.0) * clamp(1.0 - abs(p.y), 0.0, 1.0) * 0.7 + clamp(1.0 - abs(p.y) * 7.0, 0.0, 1.0) * clamp(1.0 - abs(p.x), 0.0, 1.0) * 0.7; }
      else if (vShape < 2.5) { a = (abs(p.x) < 0.75 && abs(p.y) < 0.5) ? 1.0 : 0.0; }
      else if (vShape < 3.5) { vec2 q = vec2(p.x * 1.25, -p.y * 1.25 + 0.25); float hb = q.x*q.x + q.y*q.y - 1.0; float h = hb * hb * hb - q.x*q.x*q.y*q.y*q.y; a = h < 0.0 ? 1.0 : 0.0; }
      else { a = clamp(1.0 - abs(r - 0.72) * 6.0, 0.0, 1.0); }
      a *= vColor.a;
      if (a < 0.01) discard;
      gl_FragColor = linearToOutputTexel(vec4(mix(vColor.rgb, vec3(1.0), hot), a));
    }`;

  class Pool {
    constructor(max, blending) {
      this.max = max; this.n = 0;
      this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
      this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
      this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.shape = new Float32Array(max); this.rot = new Float32Array(max); this.rv = new Float32Array(max);
      this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
      this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
      this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.a0 = new Float32Array(max);
      const g = new THREE.BufferGeometry();
      this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aPos.setUsage(THREE.DynamicDrawUsage);
      this.aCol = new THREE.BufferAttribute(this.col, 4); this.aCol.setUsage(THREE.DynamicDrawUsage);
      this.aSize = new THREE.BufferAttribute(this.size, 1); this.aSize.setUsage(THREE.DynamicDrawUsage);
      this.aShape = new THREE.BufferAttribute(this.shape, 1); this.aShape.setUsage(THREE.DynamicDrawUsage);
      this.aRot = new THREE.BufferAttribute(this.rot, 1); this.aRot.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol); g.setAttribute('size', this.aSize); g.setAttribute('shape', this.aShape); g.setAttribute('rot', this.aRot);
      g.setDrawRange(0, 0);
      this.mat = new THREE.ShaderMaterial({
        uniforms: { scale: { value: 500 }, atlas: { value: null }, hasAtlas: { value: 0 }, uTime: FX.clock }, vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, blending: blending,
      });
      this.points = new THREE.Points(g, this.mat);
      this.points.frustumCulled = false;
      this.points.renderOrder = 5;
      this.geo = g;
    }
    spawn(x, y, z, vx, vy, vz, c0, c1, s0, s1, life, grav, drag, shape, alpha) {
      let i;
      if (this.n < this.max) i = this.n++;
      else i = Math.floor(Math.random() * this.max);
      const k = i * 3;
      this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
      this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
      this.c0[k] = c0.r; this.c0[k + 1] = c0.g; this.c0[k + 2] = c0.b;
      const e = c1 || c0;
      this.c1[k] = e.r; this.c1[k + 1] = e.g; this.c1[k + 2] = e.b;
      this.s0[i] = s0; this.s1[i] = s1; this.life[i] = life; this.maxLife[i] = life;
      this.grav[i] = grav || 0; this.drag[i] = drag || 0; this.shape[i] = shape || 0; this.a0[i] = alpha == null ? 1 : alpha;
      this.rot[i] = Math.random() * 6.283; this.rv[i] = 0;
      return i;
    }
    copy(from, to) {
      const a = from * 3, b = to * 3;
      for (let j = 0; j < 3; j++) {
        this.pos[b + j] = this.pos[a + j]; this.vel[b + j] = this.vel[a + j];
        this.c0[b + j] = this.c0[a + j]; this.c1[b + j] = this.c1[a + j];
      }
      this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from]; this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
      this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.shape[to] = this.shape[from]; this.a0[to] = this.a0[from]; this.rot[to] = this.rot[from]; this.rv[to] = this.rv[from];
    }
    update(dt) {
      for (let i = 0; i < this.n; i++) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) { this.n--; if (i !== this.n) this.copy(this.n, i); i--; continue; }
        const k = i * 3;
        const dr = 1 - this.drag[i] * dt;
        this.vel[k] *= dr; this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt; this.vel[k + 2] *= dr;
        this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
        const t = 1 - this.life[i] / this.maxLife[i];
        this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
        this.rot[i] += this.rv[i] * dt;
        const c = i * 4;
        this.col[c] = this.c0[k] + (this.c1[k] - this.c0[k]) * t;
        this.col[c + 1] = this.c0[k + 1] + (this.c1[k + 1] - this.c0[k + 1]) * t;
        this.col[c + 2] = this.c0[k + 2] + (this.c1[k + 2] - this.c0[k + 2]) * t;
        const fadeIn = Math.min(1, t * 12), fadeOut = Math.min(1, (1 - t) * 3);
        this.col[c + 3] = this.a0[i] * fadeIn * fadeOut;
      }
      this.geo.setDrawRange(0, this.n);
      this.points.visible = this.n > 0;
      if (!this.n) return;
      // only the particles alive go to the GPU (the buffers are sized for the biggest goal explosion)
      const n = this.n, A = [this.aPos, this.aCol, this.aSize, this.aShape, this.aRot];
      for (const a of A) { a.updateRange.count = n * a.itemSize; a.needsUpdate = true; }
    }
    clear() { this.n = 0; this.geo.setDrawRange(0, 0); this.points.visible = false; }
  }

  const colCache = {};
  const C = (hex) => colCache[hex] || (colCache[hex] = new THREE.Color(hex));

  FX.init = function (quality) {
    if (FX.add) { FX.add.points.parent && FX.add.points.parent.remove(FX.add.points); FX.alpha.points.parent && FX.alpha.points.parent.remove(FX.alpha.points); }
    const max = BL.App && BL.App.potato ? 450 : quality === 'low' ? 900 : quality === 'high' ? 4000 : 2200;
    FX.quality = quality;
    FX.density = quality === 'low' ? 0.45 : quality === 'high' ? 1 : 0.75;
    FX.add = new Pool(max, THREE.AdditiveBlending);
    FX.alpha = new Pool(Math.floor(max * 0.6), THREE.NormalBlending);
    FX.meshes = [];
    FX.timers = [];
    FX.time = 0;
    FX.scene = null;
    FX.light = new THREE.PointLight(0xffffff, 0, 40, 2);
    BL.HQ.when(() => { if (BL.HQ.list('boost').length) FX.loadAtlas(true); });
  };

  // sprite sheet: 0 flame, 1 smoke, 2 spark, 3 magic, 4 muzzle flash, 5 light, 6 star, 7 fire  -> particle shape = 5 + index
  // (tiles 8-15 are the boost sprites, painted by js/boostfx.js)
  const SPRITES = ['flame_01', 'smoke_04', 'spark_05', 'magic_03', 'muzzle_02', 'light_01', 'star_06', 'fire_01'];
  FX.S = { flame: 5, smoke: 6, spark: 7, magic: 8, muzzle: 9, light: 10, star: 11, fire: 12 };
  // hq: downloaded sprites from assets/hq/boost/ (flame/smoke/spark/fire... in the file name) replace those tiles
  const SPRITE_KEYS = ['flame', 'smoke', 'spark', 'magic', 'muzzle', 'light', 'star', 'fire'];
  FX.loadAtlas = function (hq) {
    if (!hq && (FX.atlas || FX._atlasLoading)) return;
    FX._atlasLoading = true;
    const paths = SPRITES.map((n) => 'assets/kenney-particles/' + n + '.png');
    if (hq) {
      for (const p of BL.HQ.list('boost')) {
        const name = p.split('/').pop().toLowerCase();
        if (!/\.(png|webp)$/.test(name)) continue;
        SPRITE_KEYS.forEach((k, i) => { if (name.indexOf(k) >= 0) paths[i] = p; });
      }
    }
    const T = FX.quality === 'low' ? 64 : hq && FX.quality === 'high' ? 256 : 128;
    const { c, g } = U.canvas(T * 4, T * 6);
    BL.BoostFX.paintTiles(g, T);
    let left = paths.length;
    paths.forEach((path, i) => {
      const img = new Image();
      img.onload = () => {
        g.drawImage(img, (i % 4) * T, Math.floor(i / 4) * T, T, T);
        if (--left === 0) {
          if (FX.atlas) FX.atlas.dispose();
          FX.atlas = new THREE.CanvasTexture(c);
          for (const pool of [FX.add, FX.alpha]) { pool.mat.uniforms.atlas.value = FX.atlas; pool.mat.uniforms.hasAtlas.value = 1; }
        }
      };
      img.onerror = () => { left = -1; };
      img.src = BL.HQ.url(path);
    });
  };

  FX.attach = function (scene) {
    if (BL.MapTheme && BL.MapTheme.cur && BL.MapTheme.cur.scene !== scene) BL.MapTheme.stop(true);
    FX.loadAtlas();
    if (FX.atlas) for (const pool of [FX.add, FX.alpha]) { pool.mat.uniforms.atlas.value = FX.atlas; pool.mat.uniforms.hasAtlas.value = 1; }
    FX.clear();
    FX.scene = scene;
    scene.add(FX.add.points); scene.add(FX.alpha.points);
    if (FX.quality !== 'low') scene.add(FX.light);
  };

  FX.clear = function () {
    if (!FX.add) return;
    FX.add.clear(); FX.alpha.clear();
    for (const m of FX.meshes) { if (m.obj.parent) m.obj.parent.remove(m.obj); if (m.dispose) m.dispose(); }
    FX.meshes = []; FX.timers = [];
    if (CF.mesh) { CF.p.length = 0; CF.mesh.count = 0; }
    FX.light.intensity = 0;
  };

  // Runs an effect in a private copy of the particle system (its own particles, meshes, timers and light, all in
  // `scene`), for the item pictures: fn() sets it off, steps it with FX.update and renders, all at once; the live
  // effects are untouched and it makes no sound, shake or screen flash. Returns what fn returns.
  let quiet = null;
  FX.offline = function (scene, scale, fn) {
    if (!FX.add) return null;
    if (!quiet) quiet = { add: new Pool(1500, THREE.AdditiveBlending), alpha: new Pool(900, THREE.NormalBlending), light: new THREE.PointLight(0xffffff, 0, 40, 2) };
    const live = { add: FX.add, alpha: FX.alpha, meshes: FX.meshes, timers: FX.timers, time: FX.time, scene: FX.scene, light: FX.light, lightDecay: FX.lightDecay, push: FX.push, shake: FX.shake, play: BL.Audio.play };
    for (const p of [quiet.add, quiet.alpha]) {
      p.clear();
      p.mat.uniforms.scale.value = scale;
      p.mat.uniforms.atlas.value = live.add.mat.uniforms.atlas.value; p.mat.uniforms.hasAtlas.value = live.add.mat.uniforms.hasAtlas.value;
      scene.add(p.points);
    }
    quiet.light.intensity = 0; scene.add(quiet.light);
    Object.assign(FX, { add: quiet.add, alpha: quiet.alpha, meshes: [], timers: [], time: 0, scene, light: quiet.light, push: null, shake: () => {}, quiet: true });
    BL.Audio.play = () => {};
    try { return fn(); } finally {
      for (const m of FX.meshes) { if (m.obj.parent) m.obj.parent.remove(m.obj); if (m.dispose) m.dispose(); }
      scene.remove(quiet.add.points); scene.remove(quiet.alpha.points); scene.remove(quiet.light);
      quiet.add.clear(); quiet.alpha.clear();
      BL.Audio.play = live.play;
      delete live.play;
      Object.assign(FX, live, { quiet: false });
    }
  };
  // Sets each of these goal explosions off out of sight in its own copy of the particles and has the renderer build
  // every shader it uses (compile), so the first goal doesn't stall while they're made. Nothing is drawn or heard.
  FX.warm = function (scene, ids, compile) {
    for (const id of ids) {
      if (!FX.modelReady(id)) continue;
      try {
        FX.offline(scene, FX.add.mat.uniforms.scale.value, () => {
          FX.goalExplosion(id, new V3(0, -400, 0), '#2f7bff', null);
          for (let i = 0; i < 6; i++) FX.update(1 / 30);
          compile();
        });
      } catch (err) { /* only a warm-up */ }
    }
  };
  // true once an explosion's downloaded model (if it has one) is ready
  FX.modelReady = (fxId) => !XM_FX[fxId] || !!XM[XM_FX[fxId]];

  FX.setScale = function (camera, heightPx) {
    const s = heightPx / (2 * Math.tan((camera.fov * Math.PI) / 360));
    FX.add.mat.uniforms.scale.value = s;
    FX.alpha.mat.uniforms.scale.value = s;
  };

  // Goal explosions burst out of the goal and up the pitch (like Dueling Dragons and the real ones): while one is being
  // set off FX.push = { dir, k } and every burst it makes is carried along dir at k x its own speed. Delayed parts
  // (FX.after, FX.stream) keep the push they were made under.
  FX.push = null;
  const withPush = (push, fn) => (a, b) => { const keep = FX.push; FX.push = push; try { fn(a, b); } finally { FX.push = keep; } };
  FX.after = function (delay, fn) { FX.timers.push({ t: FX.time + delay, fn: FX.push ? withPush(FX.push, fn) : fn }); };

  FX.update = function (dt) {
    if (!FX.add) return;
    FX.time += dt;
    FX.clock.value = (FX.clock.value + dt) % 600;
    for (let i = FX.timers.length - 1; i >= 0; i--) {
      if (FX.time >= FX.timers[i].t) { const f = FX.timers[i].fn; FX.timers.splice(i, 1); f(); }
    }
    FX.add.update(dt); FX.alpha.update(dt);
    updateConfetti(dt);
    if (BL.MapTheme && !FX.quiet) BL.MapTheme.update(dt);
    for (let i = FX.meshes.length - 1; i >= 0; i--) {
      const m = FX.meshes[i];
      m.t += dt;
      const k = m.t / m.dur;
      if (k >= 1) { if (m.obj.parent) m.obj.parent.remove(m.obj); if (m.dispose) m.dispose(); FX.meshes.splice(i, 1); continue; }
      m.update(k, dt);
    }
    if (FX.light.intensity > 0) FX.light.intensity = Math.max(0, FX.light.intensity - dt * FX.lightDecay);
  };

  // ---------- celebrations: confetti and fireworks (goals and the end-of-match podium) ----------
  // Confetti: little paper squares in the team colours, white and gold that tumble and flutter down and settle on the
  // ground; one instanced mesh moved on the CPU (Very Low keeps a handful). Fireworks: a rising spark, then a burst
  // from the normal spark pool.
  const CF = { mesh: null, scene: null, p: [], max: 0 };
  const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cs = new V3(), _cp = new V3();
  function confettiMesh() {
    if (CF.mesh && CF.scene === FX.scene) return CF.mesh;
    if (CF.mesh) { if (CF.mesh.parent) CF.mesh.parent.remove(CF.mesh); CF.mesh.geometry.dispose(); CF.mesh.material.dispose(); }
    const potato = BL.App && BL.App.potato;
    CF.max = potato ? 90 : FX.quality === 'low' ? 240 : FX.quality === 'high' ? 700 : 450;
    CF.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CF.max);
    CF.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    CF.mesh.setColorAt(0, C('#ffffff'));
    CF.mesh.count = 0; CF.mesh.frustumCulled = false;
    CF.scene = FX.scene; CF.p = [];
    FX.scene.add(CF.mesh);
    return CF.mesh;
  }
  // n pieces from around p (o: spread radius, colors, vy up, vOut sideways, vz push along z)
  FX.confetti = function (p, n, o) {
    if (!FX.scene || FX.quiet) return;
    confettiMesh();
    n = Math.max(1, Math.round(n * CF.max / 450));
    for (let i = 0; i < n; i++) {
      if (CF.p.length >= CF.max) CF.p.shift();
      const a = Math.random() * Math.PI * 2, r = Math.random() * (o.spread || 1), out = o.vOut || 0;
      CF.p.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.random() * 0.6, z: p.z + Math.sin(a) * r,
        vx: Math.cos(a) * out * Math.random() + (Math.random() - 0.5) * 1.5 + (o.vx || 0) * (0.5 + Math.random() * 0.7), vy: (o.vy || 0) * (0.6 + Math.random() * 0.6), vz: Math.sin(a) * out * Math.random() + (o.vz || 0) * (0.5 + Math.random() * 0.7),
        rx: Math.random() * 6.3, ry: Math.random() * 6.3, rz: Math.random() * 6.3, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 10, sz: (Math.random() - 0.5) * 12,
        ph: Math.random() * 6.3, life: 5 + Math.random() * 3, col: C(o.colors[Math.floor(Math.random() * o.colors.length)]) });
    }
  };
  function updateConfetti(dt) {
    if (!CF.mesh || (!CF.p.length && !CF.mesh.count)) return;
    const P = CF.p, m = CF.mesh, damp = Math.exp(-1.6 * dt);
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const c = P[i];
      c.life -= dt;
      if (c.life <= 0) continue;
      if (c.y > 0.03) {
        // falls slowly (paper), drifting and fluttering side to side, spinning as it goes
        c.vy = Math.max(c.vy - 9 * dt, -1.7);
        c.vx *= damp; c.vz *= damp;
        c.x += (c.vx + Math.sin(FX.time * 3 + c.ph) * 0.7) * dt; c.y += c.vy * dt; c.z += (c.vz + Math.cos(FX.time * 2.3 + c.ph) * 0.5) * dt;
        c.rx += c.sx * dt; c.ry += c.sy * dt; c.rz += c.sz * dt;
      } else { c.y = 0.03; c.rx = -Math.PI / 2; c.ry = 0; c.life = Math.min(c.life, 1.5); }
      _cq.setFromEuler(_ce.set(c.rx, c.ry, c.rz));
      _cm.compose(_cp.set(c.x, c.y, c.z), _cq, _cs.setScalar(Math.min(1, c.life / 0.6)));
      m.setMatrixAt(w, _cm); m.setColorAt(w, c.col);
      P[w++] = c;
    }
    P.length = w; m.count = w;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  // a burst of sparks in the sky (and a quick flash)
  // (k scales it: the goal ones are seen from the far end of the pitch)
  FX.firework = function (x, y, z, color, k) {
    if (!FX.add || FX.quiet) return;
    k = k || 1;
    const potato = BL.App && BL.App.potato, n = potato ? 22 : FX.quality === 'low' ? 40 : 80, c0 = C(color);
    for (let i = 0; i < n; i++) {
      randDir(_d);
      const sp = (9 + Math.random() * 4) * k;
      // (the coloured sparks are solid colour so they show against a bright day sky too; every fourth glows white)
      // (a solid sparkle, shape 1: the thin spark sprite vanished at a distance)
      (i % 4 ? FX.alpha : FX.add).spawn(x, y, z, _d.x * sp, _d.y * sp, _d.z * sp, i % 4 ? c0 : C('#ffffff'), c0, 1.9 * k, 0.5 * k, 1.1 + Math.random() * 0.5, 3.2, 1.2, 1, 1);
    }
    FX.add.spawn(x, y, z, 0, 0, 0, C('#ffffff'), c0, 7 * k, 12 * k, 0.28, 0, 0, FX.S.light, 0.9);
  };
  // ...shot up from below first: a bright spark climbs, then it bursts at height y
  FX.fireworkLaunch = function (x, z, y, color, delay, k) {
    if (!FX.add || FX.quiet) return;
    const go = () => {
      FX.add.spawn(x, y - 13, z, 0, 15.5, 0, C('#fff3d6'), C(color), 0.7 * (k || 1), 0.4, 0.85, 0, 0, FX.S.light, 1);
      FX.timers.push({ t: FX.time + 0.85, fn: () => FX.firework(x, y, z, color, k) });
    };
    if (delay > 0) FX.timers.push({ t: FX.time + delay, fn: go }); else go();
  };

  // ---------- primitives ----------
  const _d = new V3();
  function randDir(out) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return out.set(Math.cos(a) * s, u, Math.sin(a) * s);
  }
  FX.burst = function (pos, n, o) {
    const pool = o.blend === 'alpha' ? FX.alpha : FX.add;
    n = Math.max(1, Math.round(n * FX.density));
    const cols = o.colors;
    const push = o.vx == null && o.vz == null && FX.push, carry = push ? push.k * (o.speed[0] + o.speed[1]) * 0.5 : 0;
    const vx = (o.vx || 0) + (push ? push.dir.x * carry : 0), vz = (o.vz || 0) + (push ? push.dir.z * carry : 0);
    for (let i = 0; i < n; i++) {
      randDir(_d);
      if (o.up) { _d.y = Math.abs(_d.y) * o.up + _d.y * (1 - o.up); }
      if (o.flat) { _d.y *= o.flat; }
      // pushed: anything heading back into the goal is turned round, so the burst is a cone out over the pitch
      if (push) { const back = _d.x * push.dir.x + _d.z * push.dir.z; if (back < 0) { _d.x -= 2 * back * push.dir.x; _d.z -= 2 * back * push.dir.z; } }
      const sp = U.rand(o.speed[0], o.speed[1]) * (push ? push.s : 1);
      const c0 = C(cols[i % cols.length]), c1 = o.endColor ? C(o.endColor) : c0;
      const off = o.radius ? U.rand(0, o.radius) : 0;
      let shp = o.shape || 0;
      if (shp === 0 && o.blend === 'alpha') shp = FX.S.smoke;
      else if (shp === 0) shp = FX.S.light;
      else if (shp === 1) shp = i % 3 ? 1 : FX.S.spark;
      pool.spawn(pos.x + _d.x * off, pos.y + _d.y * off, pos.z + _d.z * off, _d.x * sp + vx, _d.y * sp + (o.vy || 0), _d.z * sp + vz,
        c0, c1, U.rand(o.size[0], o.size[0] * 1.4) * (shp === FX.S.smoke ? 1.6 : 1), o.size[1] * (shp === FX.S.smoke ? 1.6 : 1), U.rand(o.life[0], o.life[1]), o.grav || 0, o.drag || 0, shp, o.alpha);
    }
  };

  FX.mesh = function (obj, dur, update, dispose) {
    if (!FX.scene) return;
    FX.scene.add(obj);
    FX.meshes.push({ obj, dur, t: 0, update, dispose });
  };

  // Soft glows: flashes, the lens streak and light pooling on the floor. A card drawn in the shader with a white-hot
  // centre fading through the colour into a wide halo. Billboards turn to face the camera and fade out toward the
  // floor, so a glow never ends in a hard line where it meets the pitch (the old solid spheres did). A billboard is
  // also drawn a little toward the camera (same size on screen), so the goal frame and walls round the blast don't
  // cut it into a hard-edged box.
  const GLOW_V = `uniform vec2 size; uniform float flatOn; varying vec2 vP; varying float vY;
    void main() {
      vP = position.xy * 2.0;
      if (flatOn > 0.5) {
        vec4 wp = modelMatrix * vec4(position.x * size.x, position.y * size.y, 0.0, 1.0);
        vY = wp.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
        return;
      }
      vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      vY = (c + right * position.x * size.x + up * position.y * size.y).y;
      vec4 cv = viewMatrix * vec4(c, 1.0);
      float d = max(0.01, -cv.z), k = (d - min(max(size.x, size.y) * 0.3, d * 0.6)) / d;
      gl_Position = projectionMatrix * vec4((cv.xyz + vec3(position.x * size.x, position.y * size.y, 0.0)) * k, 1.0);
    }`;
  const GLOW_F = `uniform vec3 color; uniform float opacity; uniform float core; uniform float flatOn; varying vec2 vP; varying float vY;
    void main() {
      float r2 = dot(vP, vP);
      if (r2 > 1.0) discard;
      float halo = (1.0 - r2) * (1.0 - r2), hot = exp(-r2 * 16.0) * core;
      float a = opacity * (halo * 0.7 + hot) * (flatOn > 0.5 ? 1.0 : smoothstep(-0.4, 1.8, vY));
      gl_FragColor = linearToOutputTexel(vec4(mix(color, vec3(1.0), clamp(hot, 0.0, 1.0)) * a, 1.0));
    }`;
  const glowGeo = new THREE.PlaneGeometry(1, 1);
  // o: core (white centre, 0-1), flat (lie on the floor), grow [from, to] size multipliers, fade power, travel
  FX.glow = function (pos, color, w, h, dur, o) {
    if (FX.quiet || !FX.scene) return;
    o = o || {};
    const u = { color: { value: C(color).clone() }, opacity: { value: 1 }, core: { value: o.core == null ? 1 : o.core }, size: { value: new THREE.Vector2(w, h) }, flatOn: { value: o.flat ? 1 : 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: GLOW_V, fragmentShader: GLOW_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(glowGeo, mat);
    m.frustumCulled = false; m.renderOrder = 5;
    m.position.copy(pos);
    if (o.flat) m.rotation.x = -Math.PI / 2;
    const p0 = pos.clone(), push = o.travel === 0 ? null : FX.push, g = o.grow || [0.45, 1], fp = o.fade || 2, peak = o.peak || 1;
    FX.mesh(m, dur, (k) => {
      const s = g[0] + (g[1] - g[0]) * Math.sqrt(k);
      u.size.value.set(w * s, h * s);
      u.opacity.value = peak * Math.pow(1 - k, fp) * (o.rise ? Math.min(1, k / o.rise) : 1);
      if (push) m.position.copy(p0).addScaledVector(push.dir, push.travel * (o.travel || 0.5) * k);
    }, () => mat.dispose());
  };
  FX.flash = function (pos, color, radius, dur) {
    // (a split-second glow: frozen in an item picture it would just be a grey ball, so FX.glow skips those)
    FX.glow(pos, color, radius * 2.6, radius * 2.6, dur, { grow: [0.4, 1] });
  };

  // Shockwave rings: a bright leading edge with a soft glowing trail behind it, white-hot at the very front. They fade
  // out right in front of the lens, so the ones flying toward you never sweep across the screen as solid bands.
  const RING_V = 'varying float vR; varying float vZ; void main() { vR = length(position.xy); vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }';
  const RING_F = `uniform vec3 color; uniform float opacity; uniform float width; varying float vR; varying float vZ;
    void main() {
      float t = (vR - (1.0 - width)) / width;
      if (t < 0.0) discard;
      float lead = 1.0 - smoothstep(0.8, 1.0, t), a = pow(t, 2.2) * lead, hot = pow(t, 9.0) * lead;
      a *= opacity * smoothstep(2.0, 10.0, vZ);
      gl_FragColor = linearToOutputTexel(vec4(mix(color, vec3(1.0), hot * 0.75) * a * 1.5, 1.0));
    }`;
  const ringGeo = [];
  FX.ring = function (pos, color, r1, dur, axis, thick) {
    const hi = FX.quality === 'high' || FX.quality === 'medium' ? 1 : 0;
    const geo = ringGeo[hi] || (ringGeo[hi] = new THREE.RingGeometry(0.5, 1, hi ? 72 : 40, 1));
    const u = { color: { value: C(color).clone() }, opacity: { value: 1 }, width: { value: U.clamp(0.3 * (thick || 1), 0.06, 0.5) } };
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: RING_V, fragmentShader: RING_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos); m.renderOrder = 4;
    if (axis === 'y') m.rotation.x = -Math.PI / 2;
    else if (axis === 'z') m.rotation.set(0, 0, 0);
    else if (axis === 'x') m.rotation.y = Math.PI / 2;
    else if (axis && axis.isVector3) m.lookAt(pos.clone().add(axis));
    // during an explosion a ring standing up across the pitch flies out toward you (floor rings stay put)
    const p0 = pos.clone(), push = FX.push, go = push && axis !== 'y' ? push.travel : 0;
    FX.mesh(m, dur, (k) => {
      const e = 1 - (1 - k) * (1 - k);
      m.scale.setScalar(0.5 + r1 * (0.25 * k + 0.75 * e)); u.opacity.value = Math.pow(1 - k, 1.4);
      if (go) m.position.copy(p0).addScaledVector(push.dir, go * e);
    }, () => m.material.dispose());
  };

  // Lightning: a jagged white-hot core inside a coloured glow, with a couple of forks, built as ribbons turned toward
  // the camera (plain lines are one pixel wide)
  const BOLT_V = 'attribute float across; varying float vA; void main() { vA = across; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const BOLT_F = 'uniform vec3 color; uniform float opacity; varying float vA; void main() { float x = vA * 2.0 - 1.0; float glow = exp(-x * x * 4.0), core = exp(-x * x * 60.0); gl_FragColor = linearToOutputTexel(vec4(mix(color, vec3(1.0), core) * (glow * 0.55 + core * 1.4) * opacity, 1.0)); }';
  function jagged(from, to, n, amp) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const p = from.clone().lerp(to, i / n);
      if (i > 0 && i < n) p.add(new V3(U.rand(-1, 1), U.rand(-0.6, 0.6), U.rand(-1, 1)).multiplyScalar(amp));
      pts.push(p);
    }
    return pts;
  }
  FX.bolt = function (from, to, color, dur) {
    const main = jagged(from, to, 14, 1.4), paths = [[main, 1.5]];
    for (let f = 0; f < 2; f++) {
      const a = main[3 + ((Math.random() * 8) | 0)];
      paths.push([jagged(a, a.clone().add(new V3(U.rand(-6, 6), -U.rand(3, 7), U.rand(-6, 6))), 6, 0.8), 0.8]);
    }
    const cam = BL.App && BL.App.camera ? BL.App.camera.position : new V3(0, 10, -40);
    const pos = [], across = [], idx = [], t = new V3(), side = new V3(), toCam = new V3();
    for (const [pts, w] of paths) {
      const base = pos.length / 3;
      pts.forEach((p, i) => {
        t.copy(pts[Math.min(i + 1, pts.length - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
        side.crossVectors(t, toCam.copy(cam).sub(p)).normalize().multiplyScalar(w * (i === pts.length - 1 ? 0.4 : 1));
        pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
        across.push(0, 1);
        if (i) { const v = base + i * 2; idx.push(v - 2, v - 1, v, v - 1, v + 1, v); }
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('across', new THREE.Float32BufferAttribute(across, 1));
    g.setIndex(idx);
    const u = { color: { value: C(color).clone() }, opacity: { value: 1 } };
    const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: BOLT_V, fragmentShader: BOLT_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    FX.mesh(mesh, dur, (k) => { u.opacity.value = (1 - k) * (0.6 + 0.4 * Math.abs(Math.sin(k * 47))); }, () => { g.dispose(); mesh.material.dispose(); });
    FX.glow(to, color, 7, 7, dur * 1.4, { travel: 0 });
    for (let i = 0; i < main.length; i += 2) FX.burst(main[i], 2, { colors: ['#ffffff', color], speed: [0.5, 2], size: [0.9, 0.2], life: [0.2, 0.4] });
  };

  // o.burst: a spiky comic-book burst in that colour behind the word
  FX.text = function (pos, text, color, dur, size, o) {
    const { c, g } = U.canvas(512, 256);
    if (o && o.burst) {
      g.beginPath();
      for (let i = 0; i < 28; i++) { const an = (i / 28) * Math.PI * 2, r = i % 2 ? 0.62 : 1; g.lineTo(256 + Math.cos(an) * 250 * r, 128 + Math.sin(an) * 124 * r); }
      g.closePath(); g.fillStyle = o.burst; g.fill(); g.lineWidth = 10; g.strokeStyle = '#111'; g.stroke();
    }
    g.font = '900 150px "Russo One", Impact, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 18; g.strokeStyle = '#111'; g.strokeText(text, 256, 128);
    g.fillStyle = color; g.fillText(text, 256, 128);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    sp.position.copy(pos);
    const S = size || 9;
    FX.mesh(sp, dur, (k) => {
      const pop = k < 0.15 ? k / 0.15 * 1.2 : 1.2 - Math.min(0.2, (k - 0.15) * 2);
      sp.scale.set(S * 2 * pop, S * pop, 1);
      sp.material.rotation = Math.sin(k * 20) * 0.08 * (1 - k);
      sp.material.opacity = k > 0.8 ? (1 - k) * 5 : 1;
    }, () => { tex.dispose(); sp.material.dispose(); });
  };

  FX.lightFlash = function (pos, color, intensity, decay) {
    if (FX.quality === 'low') return;
    FX.light.position.copy(pos);
    FX.light.color.copy(C(color));
    FX.light.intensity = Math.min(3, intensity * 0.3);
    FX.lightDecay = Math.max(2, (decay || intensity) * 0.3);
  };

  FX.stream = function (dur, fn) {
    const obj = new THREE.Object3D();
    const f = FX.push ? withPush(FX.push, fn) : fn;
    FX.mesh(obj, dur, (k, dt) => f(k, dt));
  };

  FX.shake = function (amount) { BL.bus.emit('shake', amount); };

  // ---------- small effects ----------
  FX.hit = function (pos, strength) {
    if (strength < 4) return;
    const n = Math.min(30, strength * 0.8);
    FX.burst(pos, n, { colors: ['#ffffff', '#fff3c4', '#ffd166'], speed: [2, 4 + strength * 0.35], size: [0.35, 0.05], life: [0.15, 0.4], grav: 4, drag: 2, shape: 1 });
  };

  FX.demo = function (pos, teamColor) {
    FX.flash(pos, '#ffcc66', 4, 0.5);
    FX.burst(pos, 70, { colors: ['#ffffff', '#ffcc33', '#ff6a00', teamColor], speed: [4, 16], size: [1.0, 0.1], life: [0.3, 0.9], grav: 5, drag: 1.5, shape: 0 });
    FX.burst(pos, 25, { colors: ['#555555', '#333333', '#777777'], speed: [1, 4], size: [1.5, 3.5], life: [0.8, 1.6], grav: -1, drag: 1, blend: 'alpha', alpha: 0.7 });
    FX.burst(pos, 30, { colors: ['#222222', teamColor, '#888888'], speed: [5, 12], size: [0.3, 0.3], life: [0.6, 1.2], grav: 9, drag: 0.5, shape: 2, blend: 'alpha' });
    FX.lightFlash(pos, '#ff9944', 6, 8);
  };

  FX.spawnFlame = function (pos) {
    FX.add.spawn(pos.x + U.rand(-0.06, 0.06), pos.y + 0.08, pos.z + U.rand(-0.06, 0.06), U.rand(-0.2, 0.2), U.rand(0.8, 1.6), U.rand(-0.2, 0.2),
      C('#ffd54f'), C('#ff3d00'), 0.32, 0.06, U.rand(0.25, 0.45), -1, 1, FX.S.flame, 1);
  };

  // (boost emission: FX.boost in js/boostfx.js)

  // supersonic: bright white-blue sparks streaming off the back of the car on every graphics level (the
  // ribbons in CarModel.updateTrails draw the long streaks); Low emits about half as many
  const _ss = [];
  FX.supersonicTrail = function (car, model) {
    if (FX.density < 0.5 && Math.random() > 0.55) return;
    const ex = model && model.worldExhausts ? model.worldExhausts(_ss) : null;
    const p = ex && ex.length ? ex[0] : car.pos;
    for (let i = 0; i < (FX.density < 0.5 ? 1 : 2); i++) {
      FX.add.spawn(p.x + U.rand(-0.35, 0.35), p.y + U.rand(-0.08, 0.18), p.z + U.rand(-0.35, 0.35), -car.vel.x * 0.35, -car.vel.y * 0.35 + 0.3, -car.vel.z * 0.35,
        C('#ffffff'), C('#7fc8ff'), 0.42, 0.05, 0.34, 0, 0.5, 0, 0.85);
    }
  };

  FX.ballTrail = function (ball) {
    const sp = ball.vel.length();
    if (sp < 20 || FX.density < 0.5) return;
    const k = Math.min(1, (sp - 20) / 30);
    FX.add.spawn(ball.pos.x, ball.pos.y, ball.pos.z, 0, 0, 0, C('#ffffff'), C('#ffcc66'), ball.r * 1.4 * k, 0.05, 0.25, 0, 0, 0, 0.25 * k);
  };

  // ---------- goal explosions ----------
  // each is (pos, colour, team colour, dir): dir points out of the goal, up the pitch. The 3D ones (Dueling Dragons,
  // Kraken, Crystal Spire, Gold Rush, Volcano, Abduction, Disco Fever) and the 3D debris and shockwave domes the
  // others use are in js/fxmodels.js.
  const EX = FX.EX = {};
  FX.C = C; FX.randDir = randDir;
  const _q0 = new V3();
  // A billowing fireball: glowing puffs in the explosion's colours swelling and drifting apart, flame licks, dark
  // smoke rolling up out of it and embers raining down. Gives an explosion a body instead of only sparks.
  // o: size (m), smoke / embers (0 = none, 1 = normal), smokeCols, emberCols, puffs
  FX.fireball = function (p, cols, o) {
    o = o || {};
    const R = o.size || 6, lv = BL.App && BL.App.potato ? 0 : FX.quality === 'low' ? 1 : 2;
    const n = o.puffs || [2, 4, 6][lv];
    for (let i = 0; i < n; i++) {
      const q = p.clone().add(new V3(U.rand(-1, 1) * R * 0.35, U.rand(0, 1) * R * 0.25, U.rand(-1, 1) * R * 0.35));
      FX.after(i * 0.035, () => FX.glow(q, cols[i % cols.length], R * U.rand(1.7, 2.3), R * U.rand(1.5, 2.0), U.rand(0.75, 1.15), { grow: [0.3, 1.3], fade: 1.3, core: i ? 0.45 : 1, travel: 0.35 }));
    }
    FX.burst(p, 60, { colors: cols, speed: [R * 0.8, R * 2.2], size: [R * 0.5, R * 0.12], life: [0.5, 1.0], grav: -2, drag: 2.2, shape: FX.S.fire, up: 0.4 });
    if (o.smoke !== 0) FX.burst(p.clone().add(new V3(0, R * 0.3, 0)), 26 * (o.smoke || 1), { colors: o.smokeCols || ['#3b3631', '#2a2622', '#4a443d'], speed: [R * 0.3, R * 0.9], size: [R * 0.55, R * 1.2], life: [1.6, 2.8], grav: -1.4, drag: 1.2, blend: 'alpha', alpha: 0.5, up: 0.6 });
    if (o.embers !== 0) FX.burst(p, 60 * (o.embers || 1), { colors: o.emberCols || ['#ffe08a', '#ffb347', '#ff7a1a'], speed: [R * 1.2, R * 3.6], size: [0.35, 0.05], life: [1.2, 2.4], grav: 5, drag: 0.8, shape: 1, up: 0.5 });
  };
  EX.classic = (p, a, b) => {
    FX.flash(p, '#fff1c1', 10, 0.6);
    FX.fireball(p, ['#fff3c4', '#ffb347', '#ff7a1a', a], { size: 7 });
    FX.burst(p, 220, { colors: ['#ffffff', '#ffe08a', '#ff9a2e', a], speed: [8, 30], size: [1.4, 0.15], life: [0.5, 1.4], grav: 6, drag: 1.2, shape: 1 });
    FX.ring(p, a, 24, 0.9, 'y');
    FX.ring(p, '#ffffff', 16, 0.6, 'z');
    FX.debris(p, 22, { shape: 'rock', colors: ['#ffe08a', '#ff9a2e', a, '#ffffff'], size: [0.25, 0.55], speed: [8, 22], life: 1.8, grav: 14, glow: 0.9 });
    FX.dome(p, '#ffe9b0', 13, 0.55);
  };
  EX.shockwave = (p, a, b, dir) => {
    FX.flash(p, a, 6, 0.4);
    for (let i = 0; i < 3; i++) FX.after(i * 0.15, () => { FX.ring(p, i === 1 ? '#ffffff' : a, 30 + i * 6, 0.9, 'y'); FX.ring(p, a, 20, 0.7, 'z'); });
    FX.burst(p, 120, { colors: ['#ffffff', a], speed: [15, 30], size: [0.8, 0.1], life: [0.4, 0.8], drag: 2, flat: 0.15, shape: 1 });
    FX.dome(p, a, 18, 0.7);
    FX.after(0.15, () => FX.dome(p, '#ffffff', 24, 0.8));
    FX.glow(p, a, 24, 18, 0.8, { core: 1, grow: [0.3, 1.2] });
    FX.burst(new V3(p.x, 0.5, p.z).addScaledVector(dir, 5), 36, { colors: ['#c9d3dd', '#aab6c2'], speed: [10, 20], size: [1.8, 3.6], life: [1.0, 1.6], drag: 1.8, flat: 0.1, blend: 'alpha', alpha: 0.4 });
  };
  // Party Popper: two popper blasts of paper confetti shooting up out of the goal and raining over the pitch, with
  // streamers of glitter and a bright pop (the old cloud of tiny squares just sat in the goal like static)
  EX.confetti = (p, a, b, dir) => {
    const cols = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#d500f9', '#ff9100', '#ffffff'];
    FX.flash(p, '#ffffff', 7, 0.35);
    FX.glow(p, '#ffe9f5', 22, 16, 0.5, { core: 1, grow: [0.3, 1.2] });
    FX.ring(p, '#ff4fd8', 20, 0.7, 'y'); FX.ring(p, '#ffe14f', 14, 0.55, 'z');
    for (const s of [-1, 1]) FX.confetti(p.clone().add(new V3(s * 3, 0, 0)), 130, { spread: 1.5, colors: cols, vy: 19, vOut: 7, vz: dir.z * 9, vx: s * 5 });
    FX.after(0.35, () => FX.confetti(p.clone().add(new V3(0, 2, 0)), 120, { spread: 3, colors: cols, vy: 13, vOut: 11, vz: dir.z * 12 }));
    FX.burst(p, 160, { colors: cols, speed: [10, 26], size: [0.7, 0.6], life: [1.6, 2.6], grav: 4, drag: 1.6, shape: 2, blend: 'alpha', up: 0.75 });
    FX.burst(p, 120, { colors: ['#ffffff', '#fff3a0', '#ffd1f0'], speed: [8, 24], size: [0.5, 0.05], life: [0.8, 1.6], grav: 3, drag: 1.2, shape: FX.S.star, up: 0.6 });
  };
  EX.ice = (p, a, b, dir) => {
    FX.flash(p, '#bff4ff', 8, 0.6);
    FX.burst(p, 160, { colors: ['#ffffff', '#b3f5ff', '#4fc3f7'], speed: [8, 22], size: [0.9, 0.1], life: [0.6, 1.4], grav: 8, drag: 1, shape: 1 });
    FX.burst(p, 90, { colors: ['#e0f7fa', '#80deea', '#ffffff'], speed: [4, 14], size: [0.4, 0.4], life: [1, 2], grav: 9, drag: 0.6, shape: 2, blend: 'alpha' });
    FX.burst(p, 120, { colors: ['#ffffff'], speed: [0.5, 3], size: [0.25, 0.25], life: [2.5, 4], grav: 0.4, drag: 0.8, radius: 10, blend: 'alpha', alpha: 0.9 });
    FX.ring(p, '#80deea', 28, 1.0, 'y'); FX.ring(p, '#e8fdff', 16, 0.6, 'z', 0.6);
    FX.fireball(p, ['#e8fbff', '#9fe8ff', '#5fc8ff'], { size: 6, smoke: 0, emberCols: ['#ffffff', '#d6f6ff', '#9fe8ff'] });
    FX.glow(new V3(p.x, 0.06, p.z).addScaledVector(dir, 5), '#bff4ff', 26, 26, 2.6, { flat: true, core: 0.2, grow: [0.4, 1], fade: 1.2, peak: 0.6, rise: 0.15 });
    FX.burst(new V3(p.x, 0.6, p.z).addScaledVector(dir, 5), 40, { colors: ['#e8fbff', '#cfefff'], speed: [6, 14], size: [2.2, 4.5], life: [1.4, 2.4], drag: 1.6, flat: 0.12, blend: 'alpha', alpha: 0.45 });
    FX.lightFlash(p, '#9fe8ff', 8, 6);
    FX.debris(p, 28, { shape: 'crystal', colors: ['#e8fdff', '#9fe8ff', '#5fc8ff'], size: [0.3, 0.8], speed: [8, 20], life: 2.2, grav: 14, spec: 1.4, glow: 0.45, bounce: 0.25 });
    BL.FXM.crystals(p, dir, { n: 16, big: 2, reach: 11, spread: 4, h: [1.6, 4], bigH: [5, 7], colors: ['#e8fdff', '#9fe8ff', '#5fc8ff'], wave: 0.04, shatter: 1.4 });
  };
  EX.fireworks = (p, a, b, dir) => {
    const cols = [['#ff1744', '#ff8a80'], ['#ffea00', '#fff59d'], ['#00e5ff', '#ffffff'], ['#76ff03', '#ccff90'], ['#d500f9', '#ea80fc'], [a, '#ffffff']];
    for (let i = 0; i < 7; i++) {
      FX.after(i * 0.22, () => {
        const q = p.clone().add(new V3(U.rand(-8, 8), U.rand(3, 12), U.rand(-3, 3))).addScaledVector(dir, 4 + i * 3);
        const c = U.choice(cols);
        FX.burst(q, 150, { colors: c, speed: [8, 15], size: [0.9, 0.05], life: [1.1, 2.0], grav: 3, drag: 1.5, shape: 1 });
        FX.burst(q, 40, { colors: ['#ffffff', c[1]], speed: [3, 9], size: [0.5, 0.3], life: [1.4, 2.2], grav: 1.5, drag: 2, shape: 15 });
        FX.glow(q, c[0], 9, 9, 0.5, { core: 0.8, travel: 0 });
        FX.flash(q, c[0], 3, 0.25);
        BL.Audio.play('hit', 0.6);
      });
    }
    FX.burst(p, 60, { colors: ['#ffffff', '#ffd54f'], speed: [5, 15], size: [0.6, 0.1], life: [0.4, 0.8], grav: 3, shape: 1 });
    FX.glow(p, '#fff3c4', 18, 14, 0.5, { grow: [0.3, 1.1] });
    for (let i = 0; i < 6; i++) FX.fireworkLaunch(p.x + U.rand(-7, 7), p.z + dir.z * U.rand(5, 12), p.y + U.rand(13, 18), U.choice(cols)[0], 0.2 + i * 0.32, 1.3);
  };
  EX.toon = (p, a, b, dir) => {
    FX.flash(p, '#ffeb3b', 7, 0.35);
    FX.text(p.clone().add(new V3(0, 3, 0)).addScaledVector(dir, 6), U.choice(['POW!', 'BOOM!', 'KAPOW!', 'WHAM!']), '#ffeb3b', 2.2, 11, { burst: '#ff3d6e' });
    FX.ring(p, '#ffeb3b', 20, 0.6, 'z', 0.5); FX.ring(p, '#00e5ff', 26, 0.8, 'y', 0.5);
    FX.burst(p, 90, { colors: ['#ffeb3b', '#ff4081', '#00e5ff', '#ffffff'], speed: [8, 18], size: [1.6, 0.3], life: [0.4, 0.9], drag: 2, shape: 1 });
    FX.burst(p, 40, { colors: ['#111111'], speed: [4, 10], size: [0.7, 0.7], life: [0.5, 1], drag: 2, shape: 4, blend: 'alpha' });
    FX.debris(p, 16, { shape: 'puff', colors: ['#ffffff', '#fff3a0', '#ffe0f0'], size: [1.8, 3.4], speed: [5, 11], grav: -1, life: 1.4, spin: 1, floor: false, spec: 0.1, glow: 0.15 });
    FX.debris(p, 18, { shape: 'cube', colors: ['#ffeb3b', '#ff4081', '#00e5ff'], size: [0.3, 0.6], speed: [8, 18], life: 1.6, grav: 14, glow: 0.4, bounce: 0.5 });
  };
  EX.hearts = (p, a, b, dir) => {
    FX.flash(p, '#ff80ab', 7, 0.45);
    FX.glow(p, '#ff5c9a', 26, 20, 1.1, { core: 0.7, grow: [0.3, 1.2], fade: 1.4 });
    FX.ring(p, '#ff80ab', 22, 0.8, 'z', 0.6); FX.ring(p, '#ff4081', 26, 1.0, 'y');
    FX.burst(p, 160, { colors: ['#ff4081', '#ff80ab', '#f50057', '#ffffff'], speed: [4, 14], size: [1.2, 0.8], life: [1.2, 2.4], grav: -0.6, drag: 1.4, shape: 3 });
    FX.burst(p, 70, { colors: ['#ffffff', '#ffd1e3'], speed: [6, 18], size: [0.5, 0.2], life: [0.8, 1.6], grav: 1, drag: 1.4, shape: 15 });
    FX.after(0.4, () => FX.burst(p.clone().add(new V3(0, 3, 0)).addScaledVector(dir, 7), 1, { colors: ['#ff1744'], speed: [0, 0.1], size: [12, 16], life: [1.4, 1.4], shape: 3 }));
    FX.debris(p, 24, { shape: 'heart', colors: ['#ff4081', '#ff80ab', '#f50057'], size: [0.6, 1.1], speed: [5, 12], up: 0.7, grav: -1.5, life: 2.4, floor: false, spin: 2.5, glow: 0.5, spec: 0.8, rim: '#ffd1e3' });
  };
  EX.glitch = (p, a, b, dir) => {
    FX.burst(p, 240, { colors: ['#00ff66', '#00e5ff', '#ffffff', '#ff00aa'], speed: [3, 18], size: [0.6, 0.6], life: [0.6, 1.6], drag: 3, shape: 2 });
    for (let i = 0; i < 6; i++) FX.after(i * 0.12, () => FX.burst(p.clone().add(new V3(U.rand(-5, 5), U.rand(-1, 5), U.rand(-2, 2))).addScaledVector(dir, 2 + i * 2.2), 30, { colors: ['#00ff66', '#111111'], speed: [0, 2], size: [1.2, 1.2], life: [0.15, 0.25], shape: 2, blend: 'alpha' }));
    FX.text(p.clone().add(new V3(0, 4, 0)).addScaledVector(dir, 6), 'ERROR', '#00ff66', 1.5, 7);
    FX.glow(p, '#00ff66', 20, 14, 0.4, { grow: [0.3, 1.1] });
    for (let i = 0; i < 9; i++) FX.after(i * 0.09 + Math.random() * 0.05, () => FX.glow(p.clone().add(new V3(U.rand(-4, 4), U.rand(-0.5, 7), 0)).addScaledVector(dir, U.rand(1, 9)), i % 2 ? '#ff00aa' : '#00ff66', U.rand(10, 26), U.rand(0.5, 1.2), U.rand(0.12, 0.25), { core: 0.6, grow: [1, 1.1], fade: 0.5 }));
    FX.debris(p, 40, { shape: 'cube', colors: ['#00ff66', '#00e5ff', '#ff00aa', '#111111'], size: [0.3, 0.6], speed: [4, 14], grav: 0, drag: 2, life: 1.4, spin: 0, glow: 1.2, snap: true, floor: false });
  };
  EX.meteor = (p, a, b, dir) => {
    for (let i = 0; i < 12; i++) {
      FX.after(i * 0.12, () => {
        const target = p.clone().add(new V3(U.rand(-10, 10), 0, U.rand(-3, 3))).addScaledVector(dir, 3 + i * 2.2);
        target.y = 0.5;
        // they come in from behind the goal, over the crossbar
        const start = target.clone().add(new V3(U.rand(-6, 6), 26, 0)).addScaledVector(dir, -14);
        let hit = false;
        FX.stream(0.5, (k) => {
          const q = start.clone().lerp(target, k);
          FX.add.spawn(q.x, q.y, q.z, 0, 1, 0, C('#ffffff'), C('#ff5722'), 2.6, 0.4, 0.45, 0, 0, FX.S.fire, 1);
          FX.add.spawn(q.x, q.y, q.z, 0, 0, 0, C('#fff3c4'), C('#ff8a3c'), 1.2, 0.3, 0.25, 0, 0, 0, 1);
          if (Math.random() < 0.6) FX.alpha.spawn(q.x, q.y, q.z, U.rand(-0.5, 0.5), U.rand(0.5, 1.5), U.rand(-0.5, 0.5), C('#4a3a32'), C('#2a2420'), 1.4, 3.2, U.rand(0.8, 1.3), -0.5, 0.8, FX.S.smoke, 0.5);
          if (k > 0.96 && !hit) {
            hit = true;
            FX.glow(target, '#ff8a3c', 9, 9, 0.5, { travel: 0 }); FX.ring(target, '#ff7a2a', 8, 0.5, 'y');
            FX.burst(target, 40, { colors: ['#ffcc80', '#ff5722', a], speed: [3, 10], size: [0.8, 0.1], life: [0.4, 0.8], grav: 6, up: 0.8, shape: 1 });
            if (i % 3 === 0) FX.debris(target, 6, { shape: 'rock', colors: ['#5a3b2a', '#3a2a22', '#ff6a1a'], size: [0.25, 0.55], speed: [5, 11], up: 0.9, life: 1.5, grav: 16, glow: 0.8, rim: '#ff8a50' });
          }
        });
      });
    }
    FX.flash(p, '#ff8a50', 6, 0.5);
  };
  EX.supernova = (p, a, b) => {
    FX.flash(p, '#ffffff', 16, 1.0);
    FX.burst(p, 300, { colors: ['#ffffff', '#b388ff', '#7c4dff', '#40c4ff', a], speed: [3, 20], size: [1.4, 0.2], life: [1.4, 2.6], drag: 1.2, shape: 0 });
    FX.after(0.25, () => { FX.ring(p, '#b388ff', 40, 1.4, 'y'); FX.ring(p, '#ffffff', 30, 1.0, 'z'); FX.ring(p, '#40c4ff', 30, 1.2, 'x'); FX.dome(p, '#ffffff', 30, 0.9); });
    FX.dome(p, '#b388ff', 22, 1.0);
    FX.glow(p, '#ffffff', 16, 16, 1.3, { core: 1, grow: [0.8, 1.1], fade: 2.2 });
    FX.glow(p, '#9f6bff', 44, 34, 1.4, { core: 0.2, grow: [0.3, 1.2], fade: 1.5, peak: 0.8 });
    FX.glow(p, '#cfe6ff', 70, 2.6, 0.9, { grow: [0.4, 1.2], fade: 1.5, travel: 0 });
    FX.burst(p, 90, { colors: ['#ffffff', '#d1b3ff'], speed: [4, 14], size: [0.6, 0.3], life: [1.2, 2.2], drag: 1.6, shape: 15 });
    FX.lightFlash(p, '#d1b3ff', 12, 7);
  };
  EX.thunder = (p, a, b, dir) => {
    FX.flash(p, '#e1f5fe', 8, 0.4);
    for (let i = 0; i < 7; i++) {
      FX.after(i * 0.14, () => {
        const end = p.clone().add(new V3(U.rand(-6, 6), U.rand(-1, 2), U.rand(-2, 2))).addScaledVector(dir, i * 3);
        const top = end.clone().add(new V3(U.rand(-5, 5), 24, U.rand(-5, 5)));
        FX.bolt(top, end, i % 2 ? '#80d8ff' : '#ffffff', 0.35);
        FX.glow(top, '#bfe6ff', 16, 9, 0.3, { core: 0.5, travel: 0 });
        FX.lightFlash(end, '#bbe6ff', 10, 25);
      });
    }
    FX.burst(p, 140, { colors: ['#ffffff', '#80d8ff', '#448aff'], speed: [8, 22], size: [0.9, 0.1], life: [0.4, 1.0], grav: 3, shape: 1 });
    FX.burst(p.clone().add(new V3(0, 21, 0)).addScaledVector(dir, 6), 26, { colors: ['#3a4250', '#252b35', '#4a5262'], speed: [1, 4], size: [7, 10], life: [1.8, 2.4], drag: 1, flat: 0.3, blend: 'alpha', alpha: 0.8, vx: 0, vz: 0 });
    FX.dome(p, '#9fdcff', 12, 0.5);
    BL.Audio.play('thunder', 0.9);
  };
  EX.hellfire = (p, a, b, dir) => {
    FX.flash(p, '#ff6d00', 9, 0.6);
    FX.stream(1.8, (k) => {
      const q = _q0.copy(p).addScaledVector(dir, k * 16);
      for (let i = 0; i < 6 * FX.density; i++) {
        const r = U.rand(0, 3), ang = Math.random() * Math.PI * 2;
        FX.add.spawn(q.x + Math.cos(ang) * r, Math.max(0.3, p.y - 1), q.z + Math.sin(ang) * r, U.rand(-1, 1), U.rand(8, 16), U.rand(-1, 1), C('#ffeb3b'), C('#d50000'), U.rand(2.4, 4.0), 0.6, U.rand(0.6, 1.1), 0, 0.8, FX.S.fire, 1);
      }
      if (Math.random() < 0.5) FX.add.spawn(q.x + U.rand(-3, 3), p.y, q.z + U.rand(-3, 3), U.rand(-2, 2), U.rand(10, 18), U.rand(-2, 2), C('#fff1a0'), C('#ff3d00'), 0.35, 0.05, U.rand(1, 1.6), -1, 0.5, 1, 1);
    });
    FX.fireball(p, ['#fff1a0', '#ff9100', '#ff3d00', '#d50000'], { size: 6, embers: 1.4 });
    FX.glow(new V3(p.x, 0.06, p.z).addScaledVector(dir, 8), '#ff5a1a', 20, 34, 2.2, { flat: true, core: 0.2, grow: [0.6, 1], fade: 1.1, peak: 0.6, rise: 0.1 });
    FX.burst(p, 80, { colors: ['#333333', '#1a1a1a'], speed: [2, 6], size: [2, 6], life: [1.5, 3], grav: -2, drag: 1, blend: 'alpha', alpha: 0.6 });
    FX.ring(p, '#ff3d00', 20, 0.9, 'y');
    FX.lightFlash(p, '#ff5722', 10, 5);
    FX.debris(p, 20, { shape: 'rock', colors: ['#3a2a22', '#5a3b2a', '#ff6d00'], size: [0.3, 0.7], speed: [8, 18], up: 0.85, life: 2.2, grav: 14, glow: 1.0, rim: '#ff6d00' });
  };
  // The downloaded explosion models (assets/hq/explosions/<name>/model.glb). They're small, so every graphics level
  // gets them: opened from disk they come from their own bundle (js/embedded-fx.js, about 3 MB), loaded the first
  // time an explosion that uses one is equipped, previewed or in a match. Until then those explosions use their
  // built-in look.
  const XM = {}, XM_FX = { blackhole: 'blackhole', kaboom: 'layered' };
  FX.preloadExplosions = () => {
    for (const name of ['blackhole', 'layered']) {
      if (XM[name]) continue;
      BL.Models.loadGLTF('assets/hq/explosions/' + name + '/model.glb', (gltf) => { XM[name] = gltf.scene; }, () => {});
    }
  };
  FX.needModel = function (fxId) {
    if (BL.FXM) BL.FXM.warm(fxId);
    if (!XM_FX[fxId] || FX.modelsAsked) return;
    FX.modelsAsked = true;
    if (location.protocol !== 'file:' || BL.EMBED_FX || (BL.EMBED_HQ && BL.EMBED_HQ['assets/hq/explosions/layered/model.glb'])) { FX.preloadExplosions(); return; }
    const bad = () => console.warn('[fx] js/embedded-fx.js missing: run tools/embed-models.py');
    if (window.BL_BOOT && window.BL_BOOT.loadScript) { window.BL_BOOT.loadScript('js/embedded-fx.js', () => FX.preloadExplosions(), bad); return; }
    const s = document.createElement('script');
    s.src = 'js/embedded-fx.js';
    s.onload = () => FX.preloadExplosions();
    s.onerror = bad;
    document.head.appendChild(s);
  };
  // a fresh copy with its own fading materials, centred on its base; null before it loads
  const xmodel = (name) => {
    const src = XM[name];
    if (!src) return null;
    const obj = src.clone(true), mats = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.transparent = true; o.material.depthWrite = false;
      mats.push(o.material);
    });
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new V3());
    obj.position.set(-c.x, -box.min.y, -c.z);
    const g = new THREE.Group(); g.add(obj);
    g.userData = { mats, size: box.getSize(new V3()) };
    g.dispose = () => mats.forEach((m) => m.dispose());
    return g;
  };
  EX.blackhole = (p0, a, b, dir) => {
    const p = p0.clone().addScaledVector(dir, 6);
    const bh = xmodel('blackhole');
    if (bh) {
      // the model's emissive strengths (up to 10) blow out to white: tame them into a warm disk, a thin ring,
      // a faint additive halo and a solid black core that hides the far side of the disk
      for (const m of bh.userData.mats) {
        const n = m.name || '';
        if (/black/i.test(n)) { m.transparent = false; m.depthWrite = true; m.emissiveIntensity = 0; m.color.set(0x000000); m.metalness = 0; m.roughness = 1; }
        else if (/glow/i.test(n)) { m.blending = THREE.AdditiveBlending; m.emissive.set('#ff9a3c'); m.emissiveIntensity = 0.6; m.color.set(0x000000); m.userData.peak = 0.35; }
        else if (/ring/i.test(n)) { m.blending = THREE.AdditiveBlending; m.emissive.set('#ffd9a0'); m.emissiveIntensity = 1.2; m.userData.peak = 0.9; }
        else { m.emissive.set('#ffb347'); m.emissiveIntensity = 1.6; m.userData.peak = 1; }
      }
      const s0 = 9 / Math.max(bh.userData.size.x, bh.userData.size.z);
      bh.position.copy(p).y -= bh.userData.size.y * s0 * 0.5;
      bh.rotation.x = -0.35;
      FX.mesh(bh, 2.0, (k) => {
        const s = s0 * (k < 0.7 ? 0.3 + k * 2.4 : Math.max(0.02, (1 - k) * 6.3));
        bh.scale.setScalar(s);
        bh.rotation.y += 0.09;
        const fade = k < 0.85 ? 1 : (1 - k) / 0.15;
        for (const m of bh.userData.mats) if (m.transparent) m.opacity = (m.userData.peak || 1) * fade;
      }, () => bh.dispose());
    }
    if (!bh) {
      const core = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      core.position.copy(p);
      FX.mesh(core, 2.0, (k) => { const s = k < 0.7 ? 0.5 + k * 4 : (1 - k) * 10; core.scale.setScalar(Math.max(0.01, s)); }, () => { core.geometry.dispose(); core.material.dispose(); });
      const disk = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.4, 48), new THREE.MeshBasicMaterial({ color: 0xb388ff, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      disk.position.copy(p); disk.rotation.x = -1.2;
      FX.mesh(disk, 2.0, (k) => { disk.rotation.z += 0.2; const s = k < 0.7 ? 1 + k * 3 : (1 - k) * 10; disk.scale.setScalar(Math.max(0.01, s)); disk.material.opacity = 1 - k * 0.5; }, () => { disk.geometry.dispose(); disk.material.dispose(); });
    }
    FX.glow(p, '#a05cff', 30, 24, 1.5, { core: 0, grow: [0.4, 1.1], fade: 1.2, peak: 0.7, rise: 0.3, travel: 0 });
    FX.stream(1.3, () => {
      for (let i = 0; i < 8 * FX.density; i++) {
        randDir(_d);
        const r = U.rand(8, 14);
        FX.add.spawn(p.x + _d.x * r, p.y + _d.y * r, p.z + _d.z * r, -_d.x * r * 1.6, -_d.y * r * 1.6, -_d.z * r * 1.6, C('#ea80fc'), C('#ffffff'), 0.6, 0.1, 0.6, 0, 0, 0, 1);
      }
    });
    FX.after(1.4, () => {
      FX.flash(p, '#ffffff', 14, 0.7);
      FX.burst(p, 260, { colors: ['#ffffff', '#ea80fc', '#7c4dff', a], speed: [10, 30], size: [1.2, 0.1], life: [0.6, 1.4], drag: 1.2, shape: 1 });
      FX.ring(p, '#b388ff', 35, 1.0, 'y');
      FX.dome(p, '#b388ff', 20, 0.8);
      FX.debris(p, 24, { shape: 'shard', colors: ['#ea80fc', '#7c4dff', '#ffffff'], size: [0.25, 0.6], speed: [10, 24], life: 1.6, grav: 8, glow: 0.8, stretch: [0.6, 1.6, 0.6] });
      FX.lightFlash(p, '#c58cff', 14, 10);
      FX.shake(0.8);
      BL.Audio.play('boom', 0.8);
    });
  };
  // Kaboom: the downloaded layered fireball (Medium / High) swelling up from the goal floor layer by layer;
  // Low gets the cartoon burst
  EX.kaboom = (p0, a, b, dir) => {
    const p = p0.clone().addScaledVector(dir, 4);
    const xm = xmodel('layered');
    if (!xm) { EX.toon(p0, a, b, dir); return; }
    const layers = [];
    xm.traverse((o) => { if (o.isMesh) { o.userData.s0 = o.scale.clone(); layers.push(o); } });
    const s0 = 15 / Math.max(xm.userData.size.y, 0.01);
    xm.position.set(p.x, Math.max(0, p.y - 4), p.z);
    xm.scale.setScalar(s0);
    FX.mesh(xm, 2.6, (k) => {
      layers.forEach((m, i) => {
        // inner layers pop first, outer ones follow; everything fades at the end
        const t = U.clamp((k - i * 0.035) / 0.35, 0, 1), e = 1 - Math.pow(1 - t, 3);
        m.scale.copy(m.userData.s0).multiplyScalar(Math.max(0.001, e));
      });
      xm.rotation.y += 0.004;
      for (const m of xm.userData.mats) m.opacity = k < 0.6 ? 1 : Math.max(0, (1 - k) / 0.4);
    }, () => xm.dispose());
    FX.burst(p, 160, { colors: ['#fff3c4', '#ffb300', '#ff6d00', a], speed: [12, 34], size: [1.4, 0.2], life: [0.6, 1.3], drag: 1.1, shape: 1 });
    FX.ring(p, '#ffb300', 32, 0.9, 'y');
    FX.dome(p, '#ffcf6a', 16, 0.7);
    FX.debris(p, 24, { shape: 'rock', colors: ['#4a3426', '#2e221c', '#ffb300'], size: [0.3, 0.7], speed: [10, 24], life: 2.0, grav: 15, glow: 0.7, rim: '#ffb74d' });
    FX.lightFlash(p, '#ffb74d', 16, 8);
    FX.shake(1.0);
  };
  EX.rainbow = (p, a, b, dir) => {
    for (let i = 0; i < 7; i++) {
      FX.after(i * 0.08, () => {
        const c = '#' + new THREE.Color().setHSL(i / 7, 1, 0.55).getHexString();
        FX.ring(p.clone().addScaledVector(dir, i * 1.6), c, 18 + i * 3, 1.1, dir);
        FX.burst(p, 50, { colors: [c], speed: [8 + i * 2, 14 + i * 2], size: [0.9, 0.1], life: [0.8, 1.4], drag: 1.2, shape: 1 });
      });
    }
    FX.flash(p, '#ffffff', 8, 0.5);
    FX.glow(p, '#ffffff', 22, 18, 0.7, { core: 1, grow: [0.3, 1.2] });
    FX.burst(p, 200, { colors: ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#2979ff', '#d500f9'], speed: [4, 14], size: [0.5, 0.5], life: [2, 3], grav: 2, drag: 2.5, shape: 2, blend: 'alpha' });
    FX.confetti(p, 160, { spread: 2, colors: ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#2979ff', '#d500f9'], vy: 14, vOut: 8, vz: dir.z * 9 });
  };

  EX.ignition = (p, a, b, dir) => {
    FX.flash(p, '#ffd180', 10, 0.6);
    FX.stream(1.4, (k) => {
      for (let i = 0; i < 7 * FX.density; i++) {
        const ang = Math.random() * Math.PI * 2, r = U.rand(0, 1.2);
        FX.add.spawn(p.x + Math.cos(ang) * r, p.y, p.z + Math.sin(ang) * r, U.rand(-0.6, 0.6) + dir.x * 11, U.rand(14, 24), U.rand(-0.6, 0.6) + dir.z * 11, C('#ffffff'), C(a), U.rand(1.8, 2.8), 0.4, 0.9, 0, 0.6, FX.S.flame, 1);
      }
      if (Math.random() < 0.12) FX.ring(new V3(p.x, p.y + k * 18, p.z).addScaledVector(dir, k * 9), Math.random() < 0.5 ? '#ff9100' : a, 10, 0.5, 'y');
    });
    FX.after(1.2, () => {
      const top = p.clone().add(new V3(0, 18, 0)).addScaledVector(dir, 10);
      FX.flash(top, '#ffffff', 9, 0.5);
      FX.burst(top, 220, { colors: ['#ffea00', '#ff9100', '#ff1744', a], speed: [8, 20], size: [1.2, 0.1], life: [0.8, 1.6], grav: 6, shape: 1 });
      FX.dome(top, '#ffb74d', 14, 0.6);
      FX.fireball(top, ['#fff3c4', '#ffb300', '#ff5a1a', a], { size: 6, smoke: 0.6 });
      FX.debris(top, 16, { shape: 'rock', colors: ['#3a2a22', '#ff9100', a], size: [0.25, 0.5], speed: [8, 16], life: 1.8, grav: 14, glow: 0.9, rim: '#ffb74d' });
      BL.Audio.play('boom', 0.7);
    });
    FX.ring(p, '#ff9100', 24, 0.8, 'y');
  };
  // the newer ones use the boost sprites (js/boostfx.js) as their confetti
  const BT = () => (BL.BoostFX ? BL.BoostFX.T : { petal: 2, note: 1, flake: 1, star: 1, pixel: 2 });
  EX.petals = (p, a, b, dir) => {
    FX.flash(p, '#ffd1e3', 7, 0.5);
    FX.glow(p, '#ff9cc5', 24, 18, 0.9, { core: 0.7, grow: [0.3, 1.2] });
    FX.burst(p, 260, { colors: ['#ffd1e3', '#ff9cc5', '#ffffff', '#ff6fa8'], speed: [6, 18], size: [0.9, 0.7], life: [1.6, 2.8], grav: 1.6, drag: 1.8, shape: BT().petal, up: 0.5 });
    FX.ring(p, '#ff9cc5', 22, 0.8, 'y'); FX.dome(p, '#ffe3ee', 12, 0.6);
    FX.after(0.35, () => FX.burst(p.clone().add(new V3(0, 4, 0)), 140, { colors: ['#ffffff', '#ffb7d0'], speed: [3, 10], size: [0.7, 0.6], life: [1.6, 2.4], grav: 1.4, drag: 2, shape: BT().petal }));
  };
  EX.encore = (p, a, b, dir) => {
    const cols = ['#7df9ff', '#ff5ad1', '#ffe066', '#ffffff'];
    for (let i = 0; i < 4; i++) FX.after(i * 0.28, () => {
      FX.flash(p, cols[i], 6, 0.3);
      FX.ring(p, cols[i], 18 + i * 4, 0.6, 'z');
      FX.burst(p, 90, { colors: [cols[i], '#ffffff'], speed: [7, 16], size: [1.3, 1.0], life: [1.0, 1.8], grav: -0.6, drag: 1.4, shape: BT().note, up: 0.4 });
    });
    FX.dome(p, '#7df9ff', 14, 0.9);
    FX.glow(p, '#ff5ad1', 26, 18, 1.0, { core: 0.8, grow: [0.3, 1.2] });
  };
  EX.snowstorm = (p, a, b, dir) => {
    FX.flash(p, '#e0f7ff', 8, 0.55);
    FX.burst(p, 200, { colors: ['#ffffff', '#d6f6ff', '#a6ecff'], speed: [7, 20], size: [1.0, 0.6], life: [1.2, 2.2], grav: 3, drag: 1.2, shape: BT().flake });
    FX.burst(p, 160, { colors: ['#ffffff'], speed: [0.5, 3], size: [0.5, 0.4], life: [2.5, 4], grav: 0.5, drag: 0.8, radius: 12, shape: BT().flake, blend: 'alpha', alpha: 0.9 });
    FX.ring(p, '#a6ecff', 26, 0.9, 'y'); FX.dome(p, '#d6f6ff', 16, 0.8);
    FX.glow(p, '#e0f7ff', 26, 20, 1.0, { core: 0.8, grow: [0.3, 1.2] });
    FX.burst(new V3(p.x, 0.6, p.z).addScaledVector(dir, 5), 30, { colors: ['#ffffff', '#e8fbff'], speed: [6, 14], size: [2.2, 4.5], life: [1.4, 2.4], drag: 1.6, flat: 0.12, blend: 'alpha', alpha: 0.45 });
  };
  EX.starburst = (p, a, b, dir) => {
    FX.flash(p, '#fff59d', 9, 0.6);
    FX.burst(p, 220, { colors: ['#fff59d', '#ffd54f', '#ffffff', a], speed: [9, 26], size: [1.2, 0.4], life: [0.9, 1.7], grav: 2, drag: 1.1, shape: BT().star });
    FX.ring(p, '#ffd54f', 24, 0.7, 'y'); FX.ring(p, '#ffffff', 16, 0.5, 'z');
    FX.after(0.25, () => FX.burst(p, 80, { colors: ['#ffffff'], speed: [3, 9], size: [2.2, 0.3], life: [0.6, 1.0], drag: 1.5, shape: BT().star }));
    FX.dome(p, '#fff59d', 14, 0.6);
    FX.glow(p, '#fff59d', 26, 20, 0.9, { core: 1, grow: [0.3, 1.2] });
    FX.glow(p, '#ffffff', 60, 2.4, 0.7, { grow: [0.4, 1.2], fade: 1.5, travel: 0 });
  };
  EX.pixelblast = (p, a, b, dir) => {
    const cols = ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#d500f9', '#00e5ff'];
    FX.flash(p, '#ffffff', 7, 0.4);
    FX.burst(p, 300, { colors: cols, speed: [8, 24], size: [0.8, 0.8], life: [1.2, 2.2], grav: 5, drag: 1, shape: BT().pixel });
    FX.debris(p, 26, { shape: 'cube', colors: cols, size: [0.3, 0.6], speed: [8, 20], life: 1.8, grav: 14, glow: 0.8 });
    FX.ring(p, a, 20, 0.7, 'y'); FX.dome(p, '#ffffff', 12, 0.5);
    for (let i = 0; i < 3; i++) FX.after(i * 0.1, () => FX.glow(p.clone().add(new V3(U.rand(-3, 3), U.rand(0, 3), 0)), cols[(Math.random() * cols.length) | 0], 16, 16, 0.5, { core: 0.6 }));
  };
  EX.tornado = (p, a, b, dir) => {
    FX.stream(2.0, (k) => {
      const q = _q0.copy(p).addScaledVector(dir, 2 + k * 14);
      for (let i = 0; i < 10 * FX.density; i++) {
        const h = Math.random() * 16, ang = Math.random() * Math.PI * 2 + k * 20, r = 1 + h * 0.45;
        const x = q.x + Math.cos(ang) * r, z = q.z + Math.sin(ang) * r;
        FX.alpha.spawn(x, Math.max(0.2, p.y - 1) + h, z, -Math.sin(ang) * 12, 2, Math.cos(ang) * 12, C('#cfd8dc'), C('#78909c'), U.rand(1.2, 2.4), 3, 0.5, 0, 0.5, FX.S.smoke, 0.6);
      }
      if (Math.random() < 0.25) FX.burst(q.clone().add(new V3(0, Math.random() * 12, 0)), 3, { colors: [a, '#ffffff'], speed: [6, 12], size: [0.4, 0.4], life: [0.5, 1], shape: 2, flat: 0.2 });
    });
    FX.flash(p, a, 6, 0.4);
    FX.burst(new V3(p.x, 0.5, p.z).addScaledVector(dir, 5), 40, { colors: ['#b0bec5', '#90a4ae', '#cfd8dc'], speed: [6, 14], size: [2, 4], life: [1.2, 2.0], drag: 1.4, flat: 0.15, blend: 'alpha', alpha: 0.5 });
    FX.ring(p, '#cfd8dc', 22, 1.0, 'y');
    FX.after(1.7, () => FX.debris(p.clone().addScaledVector(dir, 14).add(new V3(0, 6, 0)), 22, { shape: 'rock', colors: ['#78909c', '#546e7a', a], size: [0.3, 0.7], speed: [8, 18], flat: 0.5, life: 1.8, grav: 14, spec: 0.2, vx: 0 }));
    BL.Audio.play('whoosh', 1);
  };

  FX.goalExplosion = function (fxId, pos, teamColor, paintColor) {
    const f = EX[fxId] || EX.classic;
    FX.needModel(fxId);
    const a = paintColor || teamColor;
    // out of the goal, up the pitch: every explosion goes off at the goal line and blasts out over the pitch toward
    // the players (FX.push: bursts become a forward cone, faster, and are carried along; rings and flashes travel
    // out), so each one fills the screen with its own look
    const dir = new V3(0, 0, -Math.sign(pos.z || 1));
    const at = pos.clone().addScaledVector(dir, 2.5);
    at.y = Math.max(1.2, at.y);
    FX.add.spawn(at.x, at.y, at.z, 0, 0, 0, C('#ffffff'), C(a), 6, 14, 0.4, 0, 0, FX.S.muzzle, 1);
    if (!FX.quiet) screenFlash(a);
    // every explosion: a lens streak across the blast and its light pooling on the floor in front of the goal
    // (Very Low leaves out the floor light: it covers a lot of screen)
    FX.glow(at, a, 48, 2.4, 0.6, { grow: [0.55, 1.15], fade: 1.6, travel: 0 });
    if (!(BL.App && BL.App.potato)) FX.glow(new V3(at.x, 0.06, at.z).addScaledVector(dir, 3), a, 32, 32, 1.8, { flat: true, core: 0.35, grow: [0.5, 1.1], fade: 1.5, peak: 0.55, travel: 0 });
    const keep = FX.push;
    FX.push = { dir, k: 0.6, s: 1.15, travel: 18 };
    try { f(at, a, teamColor, dir); } finally { FX.push = keep; }
    // some take over the whole arena until the next kickoff (js/maptheme.js)
    if (BL.MapTheme && BL.MapTheme.has(fxId)) BL.MapTheme.start(fxId, a, BL.game ? 18 : 5);
    FX.lightFlash(at, a, 9, 6);
    FX.shake(0.9);
    BL.Audio.play('goal', 1);
  };
  // a quick full-screen flash in the scorer's colour
  function screenFlash(col) {
    if (typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('goalFlash');
    if (!el) { el = document.createElement('div'); el.id = 'goalFlash'; document.body.appendChild(el); }
    el.style.setProperty('--gf', col);
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  }
  FX.EXPLOSIONS = Object.keys(EX);
})(window.BL);
