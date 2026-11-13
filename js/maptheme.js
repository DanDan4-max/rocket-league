'use strict';
// Rocket League (fan remake) - goal explosions that take over the whole arena until the next kickoff:
//   petals     Cherry Blossom: pink petals drifting down everywhere, a petal carpet on the pitch, a pastel sky and an
//              anime look (flatter colour with ink outlines, Medium / High)
//   snowstorm  Snow Globe: snow falling over the whole stadium, the pitch under snow, a cold sky
//   encore     Encore: a concert: the arena goes dark, coloured spotlights sweep the pitch, music notes float up
//   starburst  Star Burst: night falls, a sky full of twinkling stars, gold stars drifting down, shooting stars
//   pixelblast Pixel Blast: the picture goes 8-bit (big pixels, fewer colours) and pixels rain down
// Everything is drawn on the GPU in a few draw calls (the falling things move in their vertex shader, no per-frame
// work on the CPU). Very Low and Low get the weather, ground, sky and lights; the picture filters need the finishing
// pass (js/post.js, Medium / High).
(function (BL) {
  const FX = BL.FX, U = BL.util, V3 = THREE.Vector3;
  const T = BL.MapTheme = { cur: null, post: { k: 0, tint: new THREE.Color(1, 1, 1), sat: 1, toon: 0, pix: 0, dark: 0 } };
  const KINDS = { petals: 1, snowstorm: 1, encore: 1, starburst: 1, pixelblast: 1 };
  T.has = (fx) => !!KINDS[fx];
  const tier = () => (BL.App && BL.App.potato ? 0 : FX.quality === 'low' ? 1 : FX.quality === 'high' ? 3 : 2);

  // ---------- falling (or rising) sprites over the whole arena ----------
  const W_V = `
    attribute float aSeed;
    uniform float uTime; uniform float uFall; uniform float uSway; uniform float uSpin; uniform float uSize; uniform float uScale; uniform float uFade;
    uniform vec3 uMin; uniform vec3 uSpan; uniform vec3 uColA; uniform vec3 uColB; uniform float uTw;
    varying vec4 vC; varying float vRot;
    void main() {
      vec3 p = position;
      float sp = 0.7 + 0.6 * aSeed;
      p.y = uMin.y + mod(p.y - uMin.y - uTime * uFall * sp, uSpan.y);
      p.x += sin(uTime * 0.9 + aSeed * 20.0) * uSway; p.z += cos(uTime * 0.7 + aSeed * 13.0) * uSway;
      vRot = aSeed * 6.283 + uTime * uSpin * (aSeed - 0.5) * 2.0;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vC = vec4(mix(uColA, uColB, fract(aSeed * 7.13)), uFade * smoothstep(0.8, 3.5, -mv.z));
      if (uTw > 0.0) vC.a *= 0.45 + 0.55 * sin(uTime * 6.0 + aSeed * 90.0);
      gl_PointSize = clamp(uSize * (0.6 + 0.8 * fract(aSeed * 3.7)) * uScale / max(0.1, -mv.z), 0.0, 120.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const W_F = `
    uniform sampler2D atlas; uniform float uTile; uniform float hasAtlas;
    varying vec4 vC; varying float vRot;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      float a = 0.0, hot = 0.0;
      if (hasAtlas > 0.5) {
        float cs = cos(vRot), sn = sin(vRot);
        vec2 pc = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) * 0.5 + 0.5;
        if (pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) discard;
        float col = mod(uTile, 4.0), row = floor(uTile / 4.0);
        vec4 t = texture2D(atlas, vec2((col + pc.x) / 4.0, 1.0 - (row + pc.y) / 6.0));
        a = t.r; hot = t.g;
      } else { a = clamp(1.0 - length(p), 0.0, 1.0); }
      a *= vC.a;
      if (a < 0.02) discard;
      gl_FragColor = linearToOutputTexel(vec4(mix(vC.rgb, vec3(1.0), hot), a));
    }`;
  const arena = () => BL.Physics.arena || { hw: 40.96, hl: 51.2 };
  function weather(o) {
    const A = arena(), n = [o.n * 0.2, o.n * 0.4, o.n * 0.7, o.n][tier()] | 0;
    const min = new V3(-A.hw - 24, o.y0 == null ? 0 : o.y0, -A.hl - 24), span = new V3((A.hw + 24) * 2, o.h || 42, (A.hl + 24) * 2);
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = min.x + Math.random() * span.x; pos[i * 3 + 1] = min.y + Math.random() * span.y; pos[i * 3 + 2] = min.z + Math.random() * span.z; seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const atlas = FX.add && FX.add.mat.uniforms.atlas.value;
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: FX.clock, uFall: { value: o.fall }, uSway: { value: o.sway || 0.8 }, uSpin: { value: o.spin || 0 }, uSize: { value: o.size }, uScale: { value: FX.add ? FX.add.mat.uniforms.scale.value : 500 }, uFade: { value: 0 },
        uMin: { value: min }, uSpan: { value: span }, uColA: { value: new THREE.Color(o.a) }, uColB: { value: new THREE.Color(o.b || o.a) }, uTw: { value: o.tw || 0 },
        atlas: { value: atlas }, hasAtlas: { value: atlas ? 1 : 0 }, uTile: { value: o.tile - 5 } },
      vertexShader: W_V, fragmentShader: W_F, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false; pts.renderOrder = 4;
    return { obj: pts, fade: (k) => { m.uniforms.uFade.value = k * (o.alpha || 1); m.uniforms.uScale.value = FX.add ? FX.add.mat.uniforms.scale.value : 500; }, dispose: () => { g.dispose(); m.dispose(); } };
  }

  // ---------- a layer on the pitch (snow, a petal carpet) ----------
  const groundTex = {};
  function groundTexture(kind) {
    if (groundTex[kind]) return groundTex[kind];
    const S = tier() <= 1 ? 256 : 512, { c, g } = U.canvas(S, S), rnd = U.rng(kind === 'snow' ? 5 : 9);
    if (kind === 'snow') {
      g.fillStyle = 'rgba(244,248,255,0.93)'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < S * 3; i++) { const r = 2 + rnd() * S * 0.03; g.fillStyle = rnd() < 0.5 ? 'rgba(210,225,245,0.25)' : 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.95)'; for (let i = 0; i < S; i++) g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
    } else {
      const cols = ['#ffc4dc', '#ffb0d0', '#ff9cc5', '#ffd6e8'];
      for (let i = 0; i < S * 0.9; i++) {
        const x = rnd() * S, y = rnd() * S, r = S * (0.008 + rnd() * 0.012);
        g.save(); g.translate(x, y); g.rotate(rnd() * 6.3); g.fillStyle = cols[(rnd() * cols.length) | 0]; g.globalAlpha = 0.75 + rnd() * 0.25;
        g.beginPath(); g.ellipse(0, 0, r * 1.5, r * 0.8, 0, 0, 7); g.fill(); g.restore();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return (groundTex[kind] = t);
  }
  function ground(kind, rep) {
    // (not in the garage: its studio floor isn't a pitch)
    if (!BL.game) return { obj: new THREE.Object3D(), fade() {}, dispose() {} };
    const A = BL.Physics.arena, geo = new THREE.PlaneGeometry((A.hw - 2.6) * 2, (A.hl - 2.6) * 2);
    geo.rotateX(-Math.PI / 2);
    const tex = groundTexture(kind).clone(); tex.needsUpdate = true; tex.repeat.set(rep[0], rep[1]);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(geo, m); mesh.position.y = 0.03; mesh.renderOrder = 1;
    return { obj: mesh, fade: (k) => { m.opacity = k; }, dispose: () => { geo.dispose(); m.dispose(); tex.dispose(); } };
  }

  // ---------- the sky ----------
  const SKY_V = 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const SKY_F = `uniform vec3 uTop; uniform vec3 uHor; uniform float uK; uniform float uStars; uniform float uTime; varying vec3 vD;
    float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    void main() {
      float y = vD.y;
      vec3 c = mix(uHor, uTop, smoothstep(-0.05, 0.6, y));
      if (uStars > 0.0) {
        vec3 q = floor(vD * 260.0); float s = h(q);
        float tw = 0.5 + 0.5 * sin(uTime * 3.0 + s * 60.0);
        c += vec3(1.0, 0.95, 0.85) * step(0.9965, s) * tw * smoothstep(0.0, 0.25, y) * uStars * 1.6;
      }
      gl_FragColor = linearToOutputTexel(vec4(c, uK));
    }`;
  function sky(top, hor, stars, op) {
    const g = new THREE.SphereGeometry(880, 32, 16), m = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(hor) }, uK: { value: 0 }, uStars: { value: stars ? 1 : 0 }, uTime: FX.clock },
      vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -9; mesh.frustumCulled = false;
    return { obj: mesh, sky: true, fade: (k) => { m.uniforms.uK.value = k * (op || 1); }, dispose: () => { g.dispose(); m.dispose(); } };
  }

  // ---------- concert spotlights ----------
  const BEAM_V = 'varying vec2 vU; varying vec3 vC; void main(){ vU = uv; vC = instanceColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }';
  const BEAM_F = 'uniform float uK; varying vec2 vU; varying vec3 vC; void main(){ float sx = sin(vU.x * 3.14159); float a = (1.0 - vU.y) * (0.35 + 0.65 * sx * sx) * uK * 0.11; gl_FragColor = linearToOutputTexel(vec4(vC * a, 1.0)); }';
  const POOL_F = 'uniform float uK; varying vec2 vU; varying vec3 vC; void main(){ float r = length(vU - 0.5) * 2.0; float a = (1.0 - smoothstep(0.4, 1.0, r)) * uK * 0.4; gl_FragColor = linearToOutputTexel(vec4(vC * a, 1.0)); }';
  function spotlights(colors) {
    const A = arena(), n = tier() ? 8 : 4, H = 30;
    const bg = new THREE.CylinderGeometry(0.3, 4.2, H, 18, 1, true); bg.translate(0, -H / 2, 0);
    const pg = new THREE.CircleGeometry(4.6, 28); pg.rotateX(-Math.PI / 2);
    const mk = (fs) => new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 } }, vertexShader: BEAM_V, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const bm = mk(BEAM_F), pm = mk(POOL_F);
    const beams = new THREE.InstancedMesh(bg, bm, n), pools = new THREE.InstancedMesh(pg, pm, n);
    beams.frustumCulled = pools.frustumCulled = false; beams.renderOrder = pools.renderOrder = 5;
    const L = [];
    for (let i = 0; i < n; i++) {
      const sx = i % 2 ? 1 : -1, zk = (Math.floor(i / 2) / Math.max(1, n / 2 - 1)) * 2 - 1;
      L.push({ from: new V3(sx * (A.hw + 6), H, zk * A.hl * 0.75), ph: i * 1.7, col: new THREE.Color(colors[i % colors.length]) });
      beams.setColorAt(i, L[i].col); pools.setColorAt(i, L[i].col);
    }
    const grp = new THREE.Group(); grp.add(beams, pools);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), dn = new V3(0, -1, 0), d = new V3(), tgt = new V3(), one = new V3(1, 1, 1), sc = new V3();
    return {
      obj: grp,
      fade: (k) => { bm.uniforms.uK.value = k; pm.uniforms.uK.value = k; },
      tick: (t) => {
        for (let i = 0; i < n; i++) {
          const l = L[i];
          tgt.set(Math.sin(t * 0.9 + l.ph) * A.hw * 0.7, 0, Math.sin(t * 0.55 + l.ph * 1.3) * A.hl * 0.7);
          d.copy(tgt).sub(l.from); const len = d.length(); d.multiplyScalar(1 / len);
          q.setFromUnitVectors(dn, d);
          m4.compose(l.from, q, sc.set(1, len / H, 1)); beams.setMatrixAt(i, m4);
          m4.compose(tgt.setY(0.06), new THREE.Quaternion(), one); pools.setMatrixAt(i, m4);
        }
        beams.instanceMatrix.needsUpdate = pools.instanceMatrix.needsUpdate = true;
      },
      dispose: () => { bg.dispose(); pg.dispose(); bm.dispose(); pm.dispose(); },
    };
  }

  // ---------- the themes ----------
  const BT = () => BL.BoostFX.T;
  const THEMES = {
    petals: () => ({ parts: [weather({ n: 5200, fall: 1.6, sway: 1.6, spin: 2.5, size: 0.55, a: '#ffc4dc', b: '#ff8fbf', tile: BT().petal }), ground('petals', [5, 6]), sky('#ffd6ec', '#c9b6ff')],
      post: { tint: [1.06, 0.97, 1.05], sat: 1.28, toon: 1, pix: 0, dark: 0 } }),
    snowstorm: () => ({ parts: [weather({ n: 7000, fall: 2.6, sway: 1.2, spin: 1.2, size: 0.42, a: '#ffffff', b: '#dbefff', tile: BT().flake }), ground('snow', [6, 8]), sky('#c9d6e6', '#eef4fb')],
      post: { tint: [0.93, 0.98, 1.08], sat: 0.72, toon: 0, pix: 0, dark: 0 } }),
    encore: (a) => ({ parts: [weather({ n: 1500, fall: -1.1, sway: 1.4, size: 0.9, a: '#7df9ff', b: '#ff5ad1', tile: BT().note, y0: 1, h: 26, add: true, alpha: 0.9 }), spotlights([a, '#ff5ad1', '#7df9ff', '#ffe066', '#b388ff']), sky('#120022', '#2c0a44')],
      post: { tint: [0.85, 0.78, 1.0], sat: 1.3, toon: 0, pix: 0, dark: 0.42 } }),
    starburst: () => ({ parts: [weather({ n: 1400, fall: 1.2, sway: 0.6, spin: 1.5, size: 0.55, a: '#fff59d', b: '#ffd54f', tile: BT().star, add: true, tw: 1 }), sky('#04081c', '#1b2450', true)],
      post: { tint: [1.0, 0.95, 1.08], sat: 1.15, toon: 0, pix: 0, dark: 0.32 } }),
    pixelblast: () => ({ parts: [weather({ n: 3000, fall: 3.2, sway: 0, spin: 0, size: 0.5, a: '#00e676', b: '#d500f9', tile: BT().pixel, alpha: 0.95 }), sky('#3a1a7a', '#7a5cff', false, 0.6)],
      post: { tint: [1.03, 1.0, 1.04], sat: 1.22, toon: 0, pix: 1, dark: 0 } }),
  };

  T.start = function (kind, teamColor, maxSecs) {
    if (!THEMES[kind] || !FX.scene || FX.quiet) return;
    if (T.cur && T.cur.kind === kind && T.cur.scene === FX.scene) { T.cur.end = FX.time + (maxSecs || 14); T.cur.out = false; return; }
    T.stop(true);
    let th;
    try { th = THEMES[kind](teamColor || '#2f7bff'); } catch (e) { return; }
    for (const p of th.parts) FX.scene.add(p.obj);
    T.cur = { kind, th, scene: FX.scene, game: BL.game || null, k: 0, out: false, t0: FX.time, end: FX.time + (maxSecs || 14) };
  };
  // still on in the scene being shown? (one left over from a garage preview or a match that's gone is put away
  // here, so the picture filter never lands on a loading screen or the next match)
  const stale = (c) => c.scene !== FX.scene || c.game !== (BL.game || null);
  T.live = function () {
    const c = T.cur;
    if (!c) return false;
    if (FX.quiet) return false;
    if (stale(c)) { T.stop(true); return false; }
    return c.k > 0;
  };
  T.stop = function (now) {
    const c = T.cur;
    if (!c) return;
    if (!now) { c.out = true; return; }
    for (const p of c.th.parts) { if (p.obj.parent) p.obj.parent.remove(p.obj); p.dispose(); }
    T.cur = null;
    const o = T.post; o.k = 0; o.toon = 0; o.pix = 0; o.dark = 0; o.sat = 1; o.tint.setRGB(1, 1, 1);
  };
  T.update = function (dt) {
    const c = T.cur;
    if (!c) return;
    if (stale(c)) { T.stop(true); return; }
    // fades out at the next kickoff (or after a while in the garage)
    const g = BL.game;
    if (FX.time > c.end || (g && FX.time - c.t0 > 1.5 && (g.phase === 'countdown' || g.phase === 'play'))) c.out = true;
    c.k = Math.max(0, Math.min(1, c.k + (c.out ? -dt / 0.8 : dt / 0.7)));
    if (c.out && c.k <= 0) { T.stop(true); return; }
    const e = c.k * c.k * (3 - 2 * c.k), cam = BL.App && BL.App.camera;
    for (const p of c.th.parts) { p.fade(e); if (p.tick) p.tick(FX.clock.value); if (p.sky && cam) p.obj.position.copy(cam.position); }
    const P = c.th.post, o = T.post;
    o.k = e; o.tint.setRGB(P.tint[0], P.tint[1], P.tint[2]); o.sat = P.sat; o.toon = P.toon * e; o.pix = P.pix * e; o.dark = P.dark * e;
  };
})(window.BL);
