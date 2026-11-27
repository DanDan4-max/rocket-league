'use strict';
// Rocket League (fan remake) - goal explosions that take over the whole arena until the next kickoff:
//   petals     Cherry Blossom: pink petals drifting down everywhere, a petal carpet on the pitch, a pastel sky and an
//              anime look (flatter colour with ink outlines, Medium / High)
//   snowstorm  Snow Globe: snow falling over the whole stadium, the pitch under snow, a cold sky
//   encore     Encore: a concert: the arena goes dark, coloured spotlights sweep the pitch, music notes float up
//   starburst  Star Burst: night falls, a sky full of twinkling stars, gold stars drifting down, shooting stars
//   pixelblast Pixel Blast: the picture goes 8-bit (big pixels, fewer colours) and pixels rain down
//   harvestmoon Harvest Moon: a warm autumn dusk, a huge moon rising, leaves blowing over the whole stadium and a
//              carpet of them on the pitch
//   aurora     Aurora: night falls and the northern lights ripple across the sky, sparkles drifting down
//   thunder    Thunderstorm: dark clouds, rain over everything and lightning striking the pitch
//   fireworks  Grand Finale: night, and fireworks bursting all over the stadium with confetti coming down
//   ocean      Ocean: the arena goes bright white, underwater: bubbles rising everywhere, light rippling over a
//              foam-white pitch, a white sky, and every car glowing white (and floating, see js/game.js)
//   eruption   Eruption: a black and red sky raining ash, embers rising, the pitch cracked open into lava with geysers
//              bursting all over it (and under every car, throwing it up); the cars charred black, glowing hot
//   zerog      Zero Gravity: deep space (a nebula, the Milky Way, a ringed planet, a galaxy turning overhead), the
//              pitch turned to glass over the stars, star dust drifting; the cars glow violet and float
//   deepfreeze Deep Freeze: a pale frozen sky, hoarfrost over the pitch, ice crystals growing out of the walls,
//              diamond dust glittering; every car frozen solid in a block of ice (it cracks apart after 3 s)
//   haunted    Haunted: a black night, a green moon, a green haze, a summoning circle glowing on the pitch, mist,
//              skulls and spirit swirls drifting up, bats flapping round; the cars turn to glowing green spirits and
//              rise off the floor
//   sugarrush  Sugar Rush: a pastel sky with candy-floss clouds, candy stripes and sprinkles over the pitch, sprinkles,
//              hearts and stars raining down, a cartoon look; the cars cycle through candy colours and bounce like
//              jelly
// Everything is drawn on the GPU in a few draw calls (the falling things move in their vertex shader, no per-frame
// work on the CPU). Very Low and Low get the weather, ground, sky and lights; the picture filters need the finishing
// pass (js/post.js, Medium / High).
(function (BL) {
  const FX = BL.FX, U = BL.util, V3 = THREE.Vector3;
  const T = BL.MapTheme = { cur: null, post: { k: 0, tint: new THREE.Color(1, 1, 1), sat: 1, toon: 0, pix: 0, dark: 0, white: 0 } };
  const KINDS = { petals: 1, snowstorm: 1, encore: 1, starburst: 1, pixelblast: 1, harvestmoon: 1, aurora: 1, thunder: 1, fireworks: 1, ocean: 1, eruption: 1, zerog: 1, deepfreeze: 1, haunted: 1, sugarrush: 1 };
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
        vec4 t = texture2D(atlas, vec2((col + pc.x) / 4.0, 1.0 - (row + pc.y) / 12.0));
        if ((uTile > 7.5 && uTile < 23.5) || uTile > 31.5) { a = t.r; hot = t.g; } else a = t.a * max(dot(t.rgb, vec3(0.3, 0.59, 0.11)), 0.35);
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
    if (kind === 'foam') {
      // sunlight through water: a web of bright rings over pale foam
      g.fillStyle = 'rgba(150,205,240,0.9)'; g.fillRect(0, 0, S, S);
      g.lineWidth = S / 170;
      for (let i = 0; i < S * 0.55; i++) {
        const x = rnd() * S, y = rnd() * S, r = S * (0.012 + rnd() * 0.03);
        g.strokeStyle = rnd() < 0.6 ? 'rgba(255,255,255,0.8)' : 'rgba(140,215,255,0.45)';
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { if (Math.abs(x + ox - S / 2) > S / 2 + r || Math.abs(y + oy - S / 2) > S / 2 + r) continue; g.beginPath(); g.ellipse(x + ox, y + oy, r * 1.3, r, rnd() * 3, 0, 7); g.stroke(); }
      }
    } else if (kind === 'lava') {
      // plates of cooled black crust with lava glowing up through the seams between them (the seams are where the
      // nearest two of a scatter of points are about as near: a tiling Voronoi pattern), white-hot down the middle
      const N = 5, cell = S / N, pts = [], img = g.createImageData(S, S), d = img.data, w = S / 80;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + 0.05 + rnd() * 0.9) * cell, (j + 0.05 + rnd() * 0.9) * cell, rnd()]);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
        let f1 = 1e9, f2 = 1e9, sh = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + N) % N, jj = (cj + dj + N) % N, p = pts[jj * N + ii];
          const dx = x - (p[0] + (ci + di - ii) * cell), dy = y - (p[1] + (cj + dj - jj) * cell), dd = dx * dx + dy * dy;
          if (dd < f1) { f2 = f1; f1 = dd; sh = p[2]; } else if (dd < f2) f2 = dd;
        }
        const e = Math.sqrt(f2) - Math.sqrt(f1), glow = Math.min(1, Math.exp(-(e * e) / (w * w)) + 0.3 * Math.exp(-(e * e) / (w * w * 12))), hot = Math.exp(-(e * e) / (w * w * 0.12));
        // (the crust: dark, a little lighter toward the middle of each plate, and glowing red near the seams)
        const cr = 22 + sh * 18 + Math.sqrt(f1) / cell * 10, o = (y * S + x) * 4;
        d[o] = Math.min(255, cr * (1 - glow) + glow * 255); d[o + 1] = Math.min(255, cr * 0.55 * (1 - glow) + glow * (70 + 170 * hot)); d[o + 2] = Math.min(255, cr * 0.4 * (1 - glow) + glow * (15 + 120 * hot * hot)); d[o + 3] = 242;
      }
      g.putImageData(img, 0, 0);
    } else if (kind === 'stars') {
      // the pitch turned to glass over deep space
      g.fillStyle = 'rgba(8,5,26,0.9)'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 8; i++) { const x = rnd() * S, y = rnd() * S, r = S * (0.1 + rnd() * 0.2), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rnd() < 0.5 ? 'rgba(130,60,200,0.35)' : 'rgba(40,140,200,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
      for (let i = 0; i < S * 1.2; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + rnd() * 0.7) + ')'; const r = rnd() < 0.08 ? 2.2 : 1; g.fillRect(rnd() * S, rnd() * S, r, r); }
      g.strokeStyle = 'rgba(160,120,255,0.18)'; g.lineWidth = 1;
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * S / 8, 0); g.lineTo(i * S / 8, S); g.stroke(); g.beginPath(); g.moveTo(0, i * S / 8); g.lineTo(S, i * S / 8); g.stroke(); }
    } else if (kind === 'frost') {
      // hoarfrost: feathery crystals over pale ice
      g.fillStyle = 'rgba(222,242,255,0.45)'; g.fillRect(0, 0, S, S);
      g.lineCap = 'round';
      const feather = (x, y, a, len, w, depth) => {
        if (depth > 3 || len < 3) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        for (let f = 0.25; f < 1; f += 0.25) { const fx = x + (x2 - x) * f, fy = y + (y2 - y) * f; feather(fx, fy, a + 0.9, len * 0.38, w * 0.6, depth + 1); feather(fx, fy, a - 0.9, len * 0.38, w * 0.6, depth + 1); }
      };
      for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(255,255,255,' + (0.45 + rnd() * 0.4) + ')'; feather(rnd() * S, rnd() * S, rnd() * 6.3, S * (0.05 + rnd() * 0.08), 1.6, 0); }
      for (let i = 0; i < S * 2; i++) { g.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.6) + ')'; g.fillRect(rnd() * S, rnd() * S, 1.2, 1.2); }
    } else if (kind === 'mist') {
      // ghostly mist curling over the pitch
      for (let i = 0; i < 40; i++) { const x = rnd() * S, y = rnd() * S, r = S * (0.08 + rnd() * 0.18), a = 0.05 + rnd() * 0.09; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(205,255,220,' + a + ')'); gr.addColorStop(1, 'rgba(205,255,220,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
    } else if (kind === 'candy') {
      // candy stripes, pink, white and mint, with sprinkles
      const cols = ['rgba(255,143,200,0.55)', 'rgba(255,255,255,0.45)', 'rgba(143,255,200,0.55)', 'rgba(255,255,255,0.45)'], w = S / 8;
      g.save(); g.translate(S / 2, S / 2); g.rotate(Math.PI / 4);
      for (let i = -12; i < 12; i++) { g.fillStyle = cols[((i % 4) + 4) % 4]; g.fillRect(i * w * 0.7071, -S, w * 0.7071, S * 2); }
      g.restore();
      const sp = ['#ff3b8f', '#3bb5ff', '#ffd23f', '#8f5bff', '#2bd97a', '#ff8a2b'];
      for (let i = 0; i < S * 0.7; i++) { g.save(); g.translate(rnd() * S, rnd() * S); g.rotate(rnd() * 6.3); g.fillStyle = sp[(rnd() * sp.length) | 0]; g.fillRect(-S / 120, -S / 400, S / 60, S / 200); g.restore(); }
    } else if (kind === 'snow') {
      g.fillStyle = 'rgba(244,248,255,0.93)'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < S * 3; i++) { const r = 2 + rnd() * S * 0.03; g.fillStyle = rnd() < 0.5 ? 'rgba(210,225,245,0.25)' : 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.95)'; for (let i = 0; i < S; i++) g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
    } else {
      const cols = kind === 'leaves' ? ['#ffb347', '#d4541c', '#ffd06b', '#8c3b12', '#b8471a'] : ['#ffc4dc', '#ffb0d0', '#ff9cc5', '#ffd6e8'];
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
    // (the light through the water drifts, the lava glows brighter and dimmer, the mist curls along)
    const tick = kind === 'foam' ? (t) => { tex.offset.set(Math.sin(t * 0.13) * 0.06, t * 0.012); }
      : kind === 'lava' ? (t) => { m.color.setScalar(0.82 + 0.18 * Math.sin(t * 2.3)); }
        : kind === 'mist' ? (t) => { tex.offset.set(t * 0.018, Math.sin(t * 0.2) * 0.05); } : null;
    return { obj: mesh, tick, fade: (k) => { m.opacity = k; }, dispose: () => { geo.dispose(); m.dispose(); tex.dispose(); } };
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

  // ---------- a moon in the sky (follows the camera, like the sky) ----------
  function moon(col, size) {
    const { c, g } = U.canvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.42, 'rgba(255,250,235,1)'); gr.addColorStop(0.5, 'rgba(255,240,200,0.55)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'multiply'; const rnd = U.rng(4);
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(220,200,170,0.45)'; g.beginPath(); g.arc(40 + rnd() * 48, 40 + rnd() * 48, 3 + rnd() * 7, 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(c), m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(col), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    const geo = new THREE.PlaneGeometry(size, size), mesh = new THREE.Mesh(geo, m), grp = new THREE.Group();
    mesh.position.set(-230, 360, -560); mesh.renderOrder = -8; grp.add(mesh); mesh.frustumCulled = false;
    return { obj: grp, sky: true, fade: (k) => { m.opacity = k; }, tick: () => { const cam = BL.App && BL.App.camera; if (cam) mesh.quaternion.copy(cam.quaternion); }, dispose: () => { geo.dispose(); m.dispose(); tex.dispose(); } };
  }
  // ---------- northern lights: tall rippling curtains of light round the sky ----------
  const AUR_V = 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const AUR_F = `uniform float uT; uniform float uK; uniform vec3 uA; uniform vec3 uB; varying vec2 vU;
    void main() {
      float x = vU.x * 18.0, y = vU.y;
      float ray = 0.55 + 0.45 * sin(x * 3.1 + uT * 0.7 + sin(x * 0.7 + uT * 0.3) * 2.0);
      ray *= 0.6 + 0.4 * sin(x * 9.3 - uT * 1.6);
      float band = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.55, 1.0, y));
      vec3 c = mix(uA, uB, smoothstep(0.35, 0.95, y));
      gl_FragColor = linearToOutputTexel(vec4(c * ray * band * uK * 0.55, 1.0));
    }`;
  function aurora(a, b) {
    const grp = new THREE.Group(), mats = [], geos = [];
    for (let i = 0; i < 3; i++) {
      const r = 560 + i * 60, geo = new THREE.CylinderGeometry(r, r, 180 + i * 30, 64, 1, true, i * 2.1, 2.4);
      // (a wavy curtain: the cylinder's rim pushed in and out)
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), z = pos.getZ(k), ang = Math.atan2(z, x), w = 1 + 0.06 * Math.sin(ang * 7 + i); pos.setX(k, x * w); pos.setZ(k, z * w); }
      const m = new THREE.ShaderMaterial({ uniforms: { uT: FX.clock, uK: { value: 0 }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } }, vertexShader: AUR_V, fragmentShader: AUR_F, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, m); mesh.position.y = 235 + i * 25; mesh.renderOrder = -8; mesh.frustumCulled = false;
      grp.add(mesh); mats.push(m); geos.push(geo);
    }
    return { obj: grp, sky: true, fade: (k) => { for (const m of mats) m.uniforms.uK.value = k; }, dispose: () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); } };
  }
  // ---------- lightning: bolts strike the pitch now and then (and light it up) ----------
  function lightning() {
    let next = 0.4, k = 0;
    const A = arena();
    return { obj: new THREE.Object3D(), fade: (v) => { k = v; }, tick: (t) => {
      if (k < 0.5 || !FX.scene) return;
      if (t > next || t < next - 9) {
        next = t + 1.2 + Math.random() * 2.6;
        const to = new V3(U.rand(-A.hw * 0.8, A.hw * 0.8), 0.2, U.rand(-A.hl * 0.8, A.hl * 0.8)), from = to.clone().add(new V3(U.rand(-12, 12), 60, U.rand(-12, 12)));
        if (FX.bolt) FX.bolt(from, to, '#dfe9ff', 0.35);
        FX.lightFlash(to.clone().setY(8), '#cfe0ff', 14, 5);
        if (FX.flash) FX.flash(to, '#e8f0ff', 6, 0.25);
        T.post.flash = 1;
      }
    }, dispose: () => {} };
  }
  // ---------- everything bright white, the cars too (Ocean) ----------
  // The lights brighten (and the exposure where there's tone mapping), the fog goes white, and every car's
  // materials are pushed to white with a white glow. Set just before each frame is drawn (the cars set some of
  // their own colours every frame) and put back exactly as they were at the end. Works on every quality.
  function whiteout() {
    const sc = FX.scene, WHITE = new THREE.Color(1, 1, 1), SEA = new THREE.Color('#a9d8f5'), lights = [], mats = new Map();
    // (the scene's own lights: not the short point-light flashes explosions make, which fade on their own)
    sc.traverse((o) => { if (o.isLight && !o.isPointLight && !o.isSpotLight) lights.push([o, o.intensity]); });
    const fog = sc.fog && sc.fog.color ? sc.fog.color.clone() : null, bg = sc.background && sc.background.isColor ? sc.background.clone() : null;
    const r = BL.App && BL.App.renderer, exp = r ? r.toneMappingExposure : 1, tm = r && r.toneMapping !== THREE.NoToneMapping;
    const models = () => (BL.game ? BL.game.cars.map((c) => c.model) : [BL.Garage && BL.Garage.model]).filter((m) => m && m.group);
    const scan = () => {
      for (const m of models()) m.group.traverse((o) => {
        if (!o.isMesh) return;
        for (const mt of [].concat(o.material)) {
          if (!mt || !mt.color || mt.isShaderMaterial || mt.blending === THREE.AdditiveBlending || mats.has(mt)) continue;
          mats.set(mt, { c: mt.color.clone(), e: mt.emissive ? mt.emissive.clone() : null, ei: mt.emissiveIntensity || 0 });
        }
      });
    };
    let k = 0, scanT = 0;
    const own = Object.prototype.hasOwnProperty.call(sc, 'onBeforeRender'), prev = sc.onBeforeRender;
    sc.onBeforeRender = function () {
      if (prev) prev.apply(this, arguments);
      if (k <= 0) return;
      for (const [mt, o] of mats) {
        mt.color.copy(o.c).lerp(WHITE, 0.9 * k);
        if (mt.emissive) { mt.emissive.copy(o.e).lerp(WHITE, k); mt.emissiveIntensity = o.ei + (1.4 - o.ei) * k; }
      }
    };
    return {
      obj: new THREE.Object3D(),
      fade: (v) => {
        k = v;
        for (const [l, i0] of lights) l.intensity = i0 * (1 + 0.25 * v);
        if (fog && sc.fog) sc.fog.color.copy(fog).lerp(SEA, 0.75 * v);
        if (bg && sc.background && sc.background.isColor) sc.background.copy(bg).lerp(SEA, 0.75 * v);
        if (r && tm) r.toneMappingExposure = exp * (1 + 0.05 * v);
      },
      // (cars built or loaded since: a demolished car's new model, a model that just finished downloading)
      tick: (t) => { if (t - scanT > 0.5 || t < scanT) { scanT = t; scan(); } },
      dispose: () => {
        for (const [mt, o] of mats) { mt.color.copy(o.c); if (mt.emissive && o.e) { mt.emissive.copy(o.e); mt.emissiveIntensity = o.ei; } }
        for (const [l, i0] of lights) l.intensity = i0;
        // (the match may already have taken its fog and background down when this ends)
        if (fog && sc.fog) sc.fog.color.copy(fog);
        if (bg && sc.background && sc.background.isColor) sc.background.copy(bg);
        if (r && tm) r.toneMappingExposure = exp;
        if (own) sc.onBeforeRender = prev; else delete sc.onBeforeRender;
      },
    };
  }


  // ==================== 2026-11-22: five more takeovers, themed (the user: "add more of the celes like the ocean one
  // that are themed and put lots of effort into it"). Each changes the sky, the pitch, the light, the cars' look and
  // (js/game.js goalBlastCar) how every car moves, until the next kickoff. ====================

  // ---------- the cars' look while it lasts (Ocean's whiteout, generalised) ----------
  // o.col / o.ck: the colour the paint goes toward and how far; o.em / o.ei: the glow's colour and strength; o.hue: the
  // paint cycles through pastel colours at this rate (Sugar Rush); o.flick: the glow flickers (Haunted)
  function carLook(o) {
    const sc = FX.scene, mats = new Map(), COL = new THREE.Color(o.col || '#ffffff'), EM = new THREE.Color(o.em || '#000000'), tmp = new THREE.Color();
    const models = () => (BL.game ? BL.game.cars.map((c) => c.model) : [BL.Garage && BL.Garage.model]).filter((m) => m && m.group);
    const scan = () => {
      for (const m of models()) m.group.traverse((x) => {
        if (!x.isMesh) return;
        for (const mt of [].concat(x.material)) {
          if (!mt || !mt.color || mt.isShaderMaterial || mt.blending === THREE.AdditiveBlending || mats.has(mt)) continue;
          mats.set(mt, { c: mt.color.clone(), e: mt.emissive ? mt.emissive.clone() : null, ei: mt.emissiveIntensity || 0 });
        }
      });
    };
    let k = 0, scanT = 0, t = 0;
    const own = Object.prototype.hasOwnProperty.call(sc, 'onBeforeRender'), prev = sc.onBeforeRender;
    sc.onBeforeRender = function () {
      if (prev) prev.apply(this, arguments);
      if (k <= 0) return;
      let i = 0;
      for (const [mt, s] of mats) {
        const target = o.hue ? tmp.setHSL((((t * o.hue + i * 0.17) % 1) + 1) % 1, 0.8, 0.72) : COL;
        mt.color.copy(s.c).lerp(target, (o.ck || 0) * k);
        if (mt.emissive && s.e) {
          const f = o.flick ? 0.7 + 0.3 * Math.sin(t * 11 + i * 1.7) * Math.sin(t * 3.1 + i) : 1;
          mt.emissive.copy(s.e).lerp(o.hue ? target : EM, k);
          mt.emissiveIntensity = s.ei + ((o.ei || 0) * f - s.ei) * k;
        }
        i++;
      }
    };
    return {
      obj: new THREE.Object3D(),
      fade: (v) => { k = v; },
      tick: (tt) => { t = tt; if (tt - scanT > 0.5 || tt < scanT) { scanT = tt; scan(); } },
      dispose: () => {
        for (const [mt, s] of mats) { mt.color.copy(s.c); if (mt.emissive && s.e) { mt.emissive.copy(s.e); mt.emissiveIntensity = s.ei; } }
        if (own) sc.onBeforeRender = prev; else delete sc.onBeforeRender;
      },
    };
  }
  // ---------- the light: the scene's own lights brighter or dimmer, the haze toward a colour, the exposure ----------
  function envLook(o) {
    const sc = FX.scene, lights = [], TO = new THREE.Color(o.fog || '#ffffff');
    sc.traverse((x) => { if (x.isLight && !x.isPointLight && !x.isSpotLight) lights.push([x, x.intensity]); });
    const fog = sc.fog && sc.fog.color ? sc.fog.color.clone() : null, bg = sc.background && sc.background.isColor ? sc.background.clone() : null;
    const r = BL.App && BL.App.renderer, exp = r ? r.toneMappingExposure : 1, tm = r && r.toneMapping !== THREE.NoToneMapping;
    return {
      obj: new THREE.Object3D(),
      fade: (v) => {
        for (const [l, i0] of lights) l.intensity = i0 * (1 + ((o.light || 1) - 1) * v);
        if (fog && sc.fog) sc.fog.color.copy(fog).lerp(TO, (o.fk || 0) * v);
        if (bg && sc.background && sc.background.isColor) sc.background.copy(bg).lerp(TO, (o.fk || 0) * v);
        if (r && tm && o.exp) r.toneMappingExposure = exp * (1 + (o.exp - 1) * v);
      },
      dispose: () => {
        for (const [l, i0] of lights) l.intensity = i0;
        if (fog && sc.fog) sc.fog.color.copy(fog);
        if (bg && sc.background && sc.background.isColor) sc.background.copy(bg);
        if (r && tm && o.exp) r.toneMappingExposure = exp;
      },
    };
  }

  // ---------- Eruption: geysers of lava burst all over the pitch, and under every car that's thrown up ----------
  function geysers() {
    const A = arena(), last = new WeakMap();
    let k = 0, next = 0.5;
    const blow = (x, z, big) => {
      const p = new V3(x, 0.2, z);
      FX.burst(p, big ? 70 : 36, { colors: ['#fff2a0', '#ffb030', '#ff5a10', '#c81e05'], speed: [8, big ? 22 : 15], size: [1.0, 0.3], life: [0.6, 1.3], grav: 14, drag: 0.5, up: 0.97, shape: FX.S.fire });
      FX.burst(p, big ? 18 : 10, { colors: ['#3a2e2a', '#5a4a42'], speed: [2, 6], size: [2, 4.5], life: [1.4, 2.2], grav: -2, drag: 1.2, blend: 'alpha', alpha: 0.6, up: 0.95 });
      if (FX.sprite) FX.sprite(new V3(x, 0.07, z), FX.S.scorch, '#120806', big ? 9 : 6, 6, { flat: true, alpha: true, grow: [0.5, 1], fade: 0.5, rot: Math.random() * 6, peak: 0.85 });
      FX.ring(p, '#ff7a1a', big ? 8 : 5, 0.6, 'y');
      if (big) FX.lightFlash(p.clone().setY(3), '#ff7a2a', 8, 6);
    };
    return {
      obj: new THREE.Object3D(),
      fade: (v) => { k = v; },
      tick: (t) => {
        if (k < 0.5 || !FX.scene) return;
        const g = BL.game;
        // (a car thrown up: js/game.js does it on the host, and everyone sees the jump in its speed)
        if (g) for (const c of g.cars) { const vy0 = last.get(c); last.set(c, c.vel.y); if (vy0 != null && c.vel.y - vy0 > 6 && c.pos.y < 4 && !c.demolished) blow(c.pos.x, c.pos.z, true); }
        if (t > next || t < next - 9) { next = t + (tier() ? 0.22 : 0.5) + Math.random() * 0.45; blow(U.rand(-A.hw * 0.85, A.hw * 0.85), U.rand(-A.hl * 0.85, A.hl * 0.85), false); }
      },
      dispose: () => {},
    };
  }

  // ---------- Zero Gravity: deep space (a nebula, the Milky Way, stars) and a ringed planet ----------
  const NEB_F = `uniform float uK; uniform float uTime; uniform float uOct; varying vec3 vD;
    float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
                 mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
    float fbm(vec3 p) { float a = 0.0, w = 0.55; for (int i = 0; i < 4; i++) { if (float(i) >= uOct) break; a += vn(p) * w; p *= 2.07; w *= 0.5; } return a; }
    void main() {
      vec3 d = normalize(vD);
      vec3 c = mix(vec3(0.008, 0.004, 0.03), vec3(0.03, 0.01, 0.07), smoothstep(-0.2, 0.8, d.y));
      float n = fbm(d * 2.6 + vec3(0.0, uTime * 0.01, 0.0)), n2 = fbm(d * 5.0 + 7.0);
      c += vec3(0.42, 0.12, 0.62) * smoothstep(0.42, 0.85, n) * 0.55 + vec3(0.05, 0.4, 0.6) * smoothstep(0.5, 0.9, n2) * 0.35;
      float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.55, -0.8))) * 3.5, 2.0));
      c += vec3(0.55, 0.45, 0.75) * band * (0.12 + 0.3 * n2);
      vec3 q = floor(d * 280.0); float s = h(q);
      c += vec3(1.0, 0.95, 0.9) * step(0.9965, s) * (0.6 + 0.4 * sin(uTime * 3.0 + s * 60.0)) * 1.5;
      gl_FragColor = linearToOutputTexel(vec4(c, uK));
    }`;
  function nebula() {
    const g = new THREE.SphereGeometry(870, 40, 20), m = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 }, uTime: FX.clock, uOct: { value: [1, 2, 3, 4][tier()] } }, vertexShader: SKY_V, fragmentShader: NEB_F, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -9; mesh.frustumCulled = false;
    return { obj: mesh, sky: true, fade: (k) => { m.uniforms.uK.value = k; }, dispose: () => { g.dispose(); m.dispose(); } };
  }
  function planet() {
    const { c, g } = U.canvas(256, 128), rnd = U.rng(8);
    for (let y = 0; y < 128; y++) { const v = y / 128, b = Math.sin(v * 22 + Math.sin(v * 7) * 2) * 0.5 + 0.5; g.fillStyle = `rgb(${Math.round(190 + 50 * b)},${Math.round(120 + 60 * b)},${Math.round(90 + 40 * b)})`; g.fillRect(0, y, 256, 1); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,240,220,' + (rnd() * 0.15) + ')'; g.fillRect(0, rnd() * 128, 256, 1 + rnd() * 3); }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const ball = new THREE.SphereGeometry(95, 32, 20);
    const pm = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uK: { value: 0 } },
      vertexShader: 'varying vec2 vU; varying vec3 vN; void main(){ vU = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float uK; varying vec2 vU; varying vec3 vN; void main(){ vec3 c = texture2D(map, vU).rgb; float l = max(0.0, dot(vN, normalize(vec3(0.8, 0.3, 0.5)))); c *= 0.06 + 1.1 * l; c += vec3(0.5, 0.35, 0.9) * pow(1.0 - abs(vN.z), 3.0) * 0.25; gl_FragColor = vec4(c * uK, uK); }',
      transparent: true, depthWrite: false, fog: false,
    });
    const rc = U.canvas(256, 4), rg = rc.g.createLinearGradient(0, 0, 256, 0);
    rg.addColorStop(0, 'rgba(255,230,200,0)'); rg.addColorStop(0.15, 'rgba(255,225,190,0.55)'); rg.addColorStop(0.45, 'rgba(220,180,150,0.25)'); rg.addColorStop(0.6, 'rgba(255,235,210,0.6)'); rg.addColorStop(1, 'rgba(255,230,200,0)');
    rc.g.fillStyle = rg; rc.g.fillRect(0, 0, 256, 4);
    const rtex = new THREE.CanvasTexture(rc.c);
    const ring = new THREE.RingGeometry(125, 215, 96, 1);
    const ru = ring.attributes.uv, rp = ring.attributes.position;
    for (let i = 0; i < rp.count; i++) ru.setXY(i, (Math.hypot(rp.getX(i), rp.getY(i)) - 125) / 90, 0.5);
    const rm = new THREE.MeshBasicMaterial({ map: rtex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, opacity: 0 });
    const grp = new THREE.Group(), pmesh = new THREE.Mesh(ball, pm), rmesh = new THREE.Mesh(ring, rm);
    rmesh.rotation.set(-1.25, 0.25, 0.3);
    const holder = new THREE.Group(); holder.position.set(-300, 280, -640); holder.add(pmesh, rmesh);
    pmesh.renderOrder = rmesh.renderOrder = -8; pmesh.frustumCulled = rmesh.frustumCulled = false;
    grp.add(holder);
    return { obj: grp, sky: true, fade: (k) => { pm.uniforms.uK.value = k; rm.opacity = k; }, tick: (t) => { pmesh.rotation.y = t * 0.02; }, dispose: () => { ball.dispose(); pm.dispose(); tex.dispose(); ring.dispose(); rm.dispose(); rtex.dispose(); } };
  }
  // a huge galaxy turning slowly high over the pitch (the swirl sprite)
  function galaxy() {
    if (!FX.spriteMat || !FX.atlas) return { obj: new THREE.Object3D(), fade() {}, dispose() {} };
    const mat = FX.spriteMat(FX.S.twirl, '#b48cff', { flat: true }), m2 = FX.spriteMat(FX.S.twirl, '#6fd8ff', { flat: true, rot: 1.7 });
    const grp = new THREE.Group(), a = new THREE.Mesh(FX.spriteGeo, mat), b = new THREE.Mesh(FX.spriteGeo, m2);
    a.rotation.x = b.rotation.x = Math.PI / 2; a.position.y = 120; b.position.y = 121;
    a.scale.setScalar(300); b.scale.setScalar(220); a.renderOrder = b.renderOrder = -7; a.frustumCulled = b.frustumCulled = false;
    grp.add(a, b);
    return { obj: grp, fade: (k) => { mat.uniforms.opacity.value = k * 0.7; m2.uniforms.opacity.value = k * 0.5; }, tick: (t) => { mat.uniforms.rot.value = t * 0.05; m2.uniforms.rot.value = 1.7 - t * 0.07; }, dispose: () => { mat.dispose(); m2.dispose(); } };
  }

  // ---------- Deep Freeze: every car in a block of ice (it cracks apart when the freeze ends), crystals ----------
  function iceBlocks() {
    const low = tier() <= 1, n = 10, geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = low ? new THREE.MeshLambertMaterial({ color: 0xcfefff, emissive: 0x2a6f99, transparent: true, opacity: 0.5, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: '#d6f2ff', emissive: '#2f86b8', emissiveIntensity: 0.4, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.42, depthWrite: false, envMap: BL.Models && BL.Models.envMap || null });
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.frustumCulled = false; im.renderOrder = 3; im.count = 0;
    const m4 = new THREE.Matrix4(), sc = new V3(), q = new THREE.Quaternion(), p = new V3(), t0 = FX.time;
    let k = 0, cracked = false;
    const list = () => (BL.game ? BL.game.cars.filter((c) => c.model && c.model.group && c.model.group.visible && !c.demolished).map((c) => [c.model.group, c]) : (BL.Garage && BL.Garage.model && BL.Garage.model.group ? [[BL.Garage.model.group, null]] : []));
    return {
      obj: im,
      fade: (v) => { k = v; },
      tick: () => {
        const age = FX.time - t0, L = list();
        if (!cracked && age > 2.9) {
          // the ice cracks apart: shards and frost off every car
          cracked = true; im.count = 0;
          for (const [g] of L) {
            FX.burst(g.position, 60, { colors: ['#ffffff', '#d6f4ff', '#8fd8ff'], speed: [4, 14], size: [0.5, 0.15], life: [0.6, 1.3], grav: 9, drag: 0.6, shape: BT().shard });
            FX.burst(g.position, 10, { colors: ['#e8f8ff'], speed: [1, 4], size: [1.4, 3], life: [0.8, 1.4], drag: 1.5, blend: 'alpha', alpha: 0.5 });
          }
          if (BL.Audio) { try { BL.Audio.play('freeze', 0.7); } catch (e) { /* (no sound) */ } }
          return;
        }
        if (cracked) return;
        const e = Math.min(1, age / 0.35) * Math.min(1, k * 3);
        let i = 0;
        for (const [g, c] of L) {
          if (i >= n) break;
          const hx = c ? c.hx : 0.42, hy = c ? c.hy : 0.18, hz = c ? c.hz : 0.6;
          q.copy(g.quaternion); p.copy(g.position);
          sc.set(hx * 2.9 * e, (hy * 2 + 0.75) * e, hz * 2.6 * e);
          im.setMatrixAt(i++, m4.compose(p, q, sc));
        }
        im.count = i; im.instanceMatrix.needsUpdate = true;
      },
      dispose: () => { geo.dispose(); mat.dispose(); },
    };
  }
  function crystals() {
    const A = arena(), n = [14, 28, 44, 60][tier()], rnd = U.rng(91), geo = new THREE.ConeGeometry(1, 1, 6, 1); geo.translate(0, 0.5, 0);
    const mat = tier() <= 1 ? new THREE.MeshLambertMaterial({ color: 0xa8e4ff, emissive: 0x3a9fd8 }) : new THREE.MeshStandardMaterial({ color: '#a8e4ff', emissive: '#3a9fd8', emissiveIntensity: 0.85, roughness: 0.1, metalness: 0.2, envMap: BL.Models && BL.Models.envMap || null });
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.frustumCulled = false;
    const L = [];
    for (let i = 0; i < n; i++) {
      // along the side walls and in the corners, leaning out from the wall
      const side = rnd() < 0.5 ? -1 : 1, along = rnd() < 0.7;
      const x = along ? side * (A.hw - 1.2 - rnd() * 1.5) : U.lerp(-A.hw * 0.6, A.hw * 0.6, rnd()), z = along ? U.lerp(-A.hl * 0.8, A.hl * 0.8, rnd()) : side * (A.hl - 3.5 - rnd() * 1.5);
      L.push({ x, z, h: 2 + rnd() * 5.5, w: 0.4 + rnd() * 0.6, rx: (rnd() - 0.5) * 0.6, rz: (rnd() - 0.5) * 0.6 + (along ? -side * 0.35 : 0), d: rnd() * 0.5 });
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), s = new V3(), t0 = FX.time;
    return {
      obj: im,
      fade: (v) => {
        const age = FX.time - t0;
        L.forEach((c, i) => { const g = Math.min(1, Math.max(0, (age - c.d) / 0.5)) * v; e.set(c.rx, 0, c.rz); q.setFromEuler(e); p.set(c.x, -0.3, c.z); s.set(c.w * g, c.h * g, c.w * g); im.setMatrixAt(i, m4.compose(p, q, s)); });
        im.instanceMatrix.needsUpdate = true;
      },
      dispose: () => { geo.dispose(); mat.dispose(); },
    };
  }

  // ---------- Haunted: bats flapping round over the pitch, and a summoning circle glowing on it ----------
  function bats() {
    const n = [6, 14, 22, 30][tier()];
    // a bat: a body and two jagged wings (flapped in the vertex shader)
    const v = [0, 0, 0.35, -0.1, 0, -0.2, 0.1, 0, -0.2,
      0.08, 0, 0.1, 0.9, 0.05, 0.25, 0.5, 0, -0.25, 0.5, 0, -0.25, 0.9, 0.05, 0.25, 1.1, 0, -0.15,
      -0.08, 0, 0.1, -0.5, 0, -0.25, -0.9, 0.05, 0.25, -0.5, 0, -0.25, -1.1, 0, -0.15, -0.9, 0.05, 0.25];
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: 0x050308, side: THREE.DoubleSide });
    const uT = FX.clock;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  #ifdef USE_INSTANCING\n  transformed.y += abs(position.x) * sin(uT * 16.0 + instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.5) * 0.7;\n  #endif');
    };
    mat.customProgramCacheKey = () => 'bl-bats';
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.frustumCulled = false;
    const rnd = U.rng(13), B = [];
    for (let i = 0; i < n; i++) B.push({ r: 18 + rnd() * 40, y: 10 + rnd() * 14, w: (0.35 + rnd() * 0.4) * (rnd() < 0.5 ? -1 : 1), a: rnd() * 6.3, s: 1.2 + rnd() * 1.0, wob: rnd() * 6.3 });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V3(), s = new V3();
    let k = 0;
    return {
      obj: im,
      fade: (vv) => { k = vv; im.visible = k > 0.05; },
      tick: (t) => {
        B.forEach((b, i) => {
          const a = b.a + t * b.w, r = b.r + Math.sin(t * 0.7 + b.wob) * 8;
          p.set(Math.cos(a) * r, b.y + Math.sin(t * 1.3 + b.wob) * 3, Math.sin(a) * r);
          e.set(0, -a + (b.w > 0 ? Math.PI : 0), Math.sin(t * 2 + b.wob) * 0.3); q.setFromEuler(e);
          s.setScalar(b.s * k);
          im.setMatrixAt(i, m4.compose(p, q, s));
        });
        im.instanceMatrix.needsUpdate = true;
      },
      dispose: () => { geo.dispose(); mat.dispose(); },
    };
  }
  function runeFloor(col) {
    if (!FX.spriteMat || !FX.atlas || !BL.game) return { obj: new THREE.Object3D(), fade() {}, dispose() {} };
    const mat = FX.spriteMat(FX.S.rune, col, { flat: true }), mesh = new THREE.Mesh(FX.spriteGeo, mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.06; mesh.scale.setScalar(40); mesh.renderOrder = 2; mesh.frustumCulled = false;
    let k = 0;
    return { obj: mesh, fade: (v) => { k = v; }, tick: (t) => { mat.uniforms.rot.value = t * 0.12; mat.uniforms.opacity.value = k * (0.65 + 0.25 * Math.sin(t * 2.2)); }, dispose: () => mat.dispose() };
  }

  // ---------- fireworks all over the stadium ----------
  function fireworks(team) {
    let next = 0, k = 0;
    const A = arena(), cols = [team, '#ffd23f', '#ff5fa2', '#7df9ff', '#ffffff', '#9bff6a'];
    return { obj: new THREE.Object3D(), fade: (v) => { k = v; }, tick: (t) => {
      if (k < 0.5 || !FX.fireworkLaunch) return;
      if (t > next || t < next - 9) {
        next = t + 0.35 + Math.random() * 0.5;
        const side = Math.random() < 0.5 ? -1 : 1;
        FX.fireworkLaunch(side * (A.hw + U.rand(-8, 10)), U.rand(-A.hl, A.hl), U.rand(28, 44), U.choice(cols), 0, 1.2);
      }
    }, dispose: () => {} };
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
    harvestmoon: () => ({ parts: [weather({ n: 4200, fall: 1.7, sway: 2.0, spin: 2.6, size: 0.62, a: '#ffb347', b: '#b8471a', tile: BT().leaf }), ground('leaves', [5, 6]), sky('#2a1640', '#ff9a4a'), moon('#ffe2a0', 190)],
      post: { tint: [1.08, 1.0, 0.9], sat: 1.12, toon: 0, pix: 0, dark: 0.12 } }),
    aurora: () => ({ parts: [weather({ n: 1600, fall: 0.8, sway: 1.0, spin: 0, size: 0.45, a: '#bfffe9', b: '#e0c8ff', tile: BT().twinkle, add: true, tw: 1 }), sky('#020814', '#0b2a3a', true), aurora('#3dffb0', '#b36bff')],
      post: { tint: [0.92, 1.03, 1.06], sat: 1.15, toon: 0, pix: 0, dark: 0.36 } }),
    thunder: () => ({ parts: [weather({ n: 6500, fall: 24, sway: 0.25, spin: 0, size: 0.32, a: '#cfe0ff', b: '#9fb8e0', tile: BT().shard, alpha: 0.55 }), sky('#141a24', '#3a4658'), lightning()],
      post: { tint: [0.9, 0.95, 1.05], sat: 0.78, toon: 0, pix: 0, dark: 0.3 } }),
    fireworks: (a) => ({ parts: [weather({ n: 1400, fall: 1.4, sway: 1.2, spin: 3, size: 0.5, a: '#ffd23f', b: a, tile: BT().pixel, alpha: 0.9 }), sky('#05061a', '#1d1640', true), fireworks(a)],
      post: { tint: [1.0, 0.97, 1.05], sat: 1.2, toon: 0, pix: 0, dark: 0.34 } }),
    ocean: () => ({ parts: [weather({ n: 2600, fall: -2.4, sway: 0.8, spin: 0, size: 0.6, a: '#5cc2ff', b: '#2a93dc', tile: BT().bubble, y0: 0, h: 34, alpha: 0.95 }), ground('foam', [4, 5]), sky('#d9f0ff', '#7cc4f2'), whiteout()],
      post: { tint: [0.84, 0.96, 1.08], sat: 0.7, toon: 0, pix: 0, dark: 0, white: 0.32 } }),
    eruption: () => ({ parts: [weather({ n: 2400, fall: -4.5, sway: 1.6, spin: 0, size: 0.32, a: '#ffcf5a', b: '#ff4a10', tile: BT().twinkle, add: true, y0: 0, h: 38, tw: 1 }),
      weather({ n: 2600, fall: 1.3, sway: 1.8, spin: 1.2, size: 0.42, a: '#2a2420', b: '#5a4e48', tile: BT().flake, alpha: 0.85 }),
      ground('lava', [2, 2.5]), sky('#0c0302', '#c2300a'), envLook({ fog: '#3a0e04', fk: 0.8, light: 0.7, exp: 0.95 }), carLook({ col: '#1e1612', ck: 0.72, em: '#ff5a14', ei: 0.6 }), geysers()],
      post: { tint: [1.12, 0.92, 0.8], sat: 1.25, toon: 0, pix: 0, dark: 0.18 } }),
    zerog: () => ({ parts: [weather({ n: 1800, fall: -0.35, sway: 2.6, spin: 0, size: 0.38, a: '#ffffff', b: '#c9b0ff', tile: BT().twinkle, add: true, y0: 0, h: 40, tw: 1 }),
      ground('stars', [3, 4]), nebula(), planet(), galaxy(), envLook({ fog: '#0a0620', fk: 0.9, light: 0.72 }), carLook({ col: '#1b1035', ck: 0.4, em: '#9d6bff', ei: 0.65 })],
      post: { tint: [0.94, 0.9, 1.1], sat: 1.2, toon: 0, pix: 0, dark: 0.3 } }),
    deepfreeze: () => ({ parts: [weather({ n: 2000, fall: 0.6, sway: 1.2, spin: 0, size: 0.28, a: '#ffffff', b: '#bfeaff', tile: BT().twinkle, add: true, tw: 1 }),
      weather({ n: 2600, fall: 1.8, sway: 1.0, spin: 1.2, size: 0.38, a: '#ffffff', b: '#dbefff', tile: BT().flake }),
      ground('frost', [5, 6]), sky('#8cc8f0', '#eaf7ff'), envLook({ fog: '#d6efff', fk: 0.45, light: 1.05 }), carLook({ col: '#cfeeff', ck: 0.62, em: '#5fc8ff', ei: 0.35 }), crystals(), iceBlocks()],
      post: { tint: [0.9, 1.0, 1.1], sat: 0.78, toon: 0, pix: 0, dark: 0 } }),
    haunted: () => ({ parts: [weather({ n: 900, fall: -1.0, sway: 2.2, spin: 0.6, size: 0.8, a: '#c8ffd8', b: '#39ff88', tile: BT().skull, add: true, y0: 0, h: 30, alpha: 0.7, tw: 1 }),
      weather({ n: 600, fall: -0.6, sway: 3, spin: 1.5, size: 2.2, a: '#39ff88', b: '#7affc0', tile: FX.S.twirl, add: true, y0: 0, h: 26, alpha: 0.45 }),
      ground('mist', [3, 4]), sky('#030106', '#173322', true), moon('#c8ffd0', 230), envLook({ fog: '#12301c', fk: 0.85, light: 0.5, exp: 0.95 }),
      carLook({ col: '#b9ffd2', ck: 0.75, em: '#39ff88', ei: 0.95, flick: true }), runeFloor('#39ff88'), bats()],
      post: { tint: [0.85, 1.06, 0.9], sat: 0.75, toon: 0, pix: 0, dark: 0.36 } }),
    sugarrush: () => ({ parts: [weather({ n: 2400, fall: 2.2, sway: 1.0, spin: 3, size: 0.34, a: '#ff6fb5', b: '#5fd0ff', tile: BT().pixel, alpha: 0.95 }),
      weather({ n: 900, fall: 1.5, sway: 1.6, spin: 1.5, size: 0.6, a: '#ffb0d8', b: '#fff07a', tile: BT().heart, alpha: 0.95 }),
      weather({ n: 160, fall: 0.1, sway: 4, spin: 0.05, size: 14, a: '#ffc6e8', b: '#c9e8ff', tile: FX.S.smoke, y0: 32, h: 34, alpha: 0.8 }),
      ground('candy', [9, 11]), sky('#ffb8e2', '#c4fff0'), envLook({ fog: '#ffd6ef', fk: 0.75, light: 1.15 }), carLook({ hue: 0.12, ck: 0.7, ei: 0.35 })],
      post: { tint: [1.06, 0.98, 1.06], sat: 1.35, toon: 0.6, pix: 0, dark: 0 } }),
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
  // Behind the loading screen (js/effects.js FX.warm): a takeover's scenery is built, put in the scene for the renderer to
  // make its shaders, and taken out again; the returned function throws it away (at the next match's warm-up, so the
  // shaders stay made for this one: three.js drops a shader nothing uses)
  T.warm = function (kind, scene, compile) {
    if (!THEMES[kind]) return null;
    const th = THEMES[kind]('#2f7bff');
    for (const p of th.parts) { scene.add(p.obj); if (p.obj.isObject3D) p.obj.updateMatrixWorld(true); }
    try { compile(); } finally { for (const p of th.parts) if (p.obj.parent) p.obj.parent.remove(p.obj); }
    return () => { for (const p of th.parts) { try { p.dispose(); } catch (e) { /* */ } } };
  };
  T.stop = function (now) {
    const c = T.cur;
    if (!c) return;
    if (!now) { c.out = true; return; }
    for (const p of c.th.parts) { if (p.obj.parent) p.obj.parent.remove(p.obj); p.dispose(); }
    T.cur = null;
    const o = T.post; o.k = 0; o.toon = 0; o.pix = 0; o.dark = 0; o.sat = 1; o.white = 0; o.tint.setRGB(1, 1, 1);
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
    o.flash = Math.max(0, (o.flash || 0) - dt * 5);
    o.k = e; o.tint.setRGB(P.tint[0], P.tint[1], P.tint[2]); o.sat = P.sat; o.toon = P.toon * e; o.pix = P.pix * e; o.white = (P.white || 0) * e; o.dark = Math.max(-0.35, P.dark * e - (o.flash || 0) * 0.6);
  };
})(window.BL);
