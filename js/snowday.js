'use strict';
// Rocket League (fan remake) - Snow Day (2026-11-22: "for snow day make the map a giant [snow globe]"):
//  M.makePuck(r, hh)  the puck's look: one mesh, dark rubber faces with a frosty snowflake, a glowing ice-blue band
//                     round the rim (the puck's physics are in js/physics.js, Phys.makePuck)
//  SD.build(...)      the Snow Globe arena's scenery (map 'snowglobe', only played in Snow Day): the stadium and a
//                     snowy village inside a giant glass globe, snow swirling round inside it (whirled up after a
//                     goal, like a shaken snow globe), a giant snowman behind one goal and a giant Christmas tree
//                     behind the other, a gold rim where the glass meets the snow, and through the glass, way out of
//                     focus, the cosy room the globe stands in: a fire, a Christmas tree's lights, a frosty window
// Built in code (works from disk). Very Low: a smaller room picture, fewer flakes, no ornaments or rim.
(function (BL) {
  const SD = BL.SnowDay = {};
  const U = BL.util, V3 = THREE.Vector3;
  const tierOf = (low) => (BL.App && BL.App.potato ? 0 : low ? 1 : BL.App && BL.App.quality === 'high' ? 3 : 2);
  // the glass: a sphere this big with its middle this far under the pitch (it meets the snow ~320 m out)
  const RG = 330, CY = -80;

  // ---------- the puck ----------
  // One canvas for both faces and the rim: the faces use the disc in the middle of it, the rim a strip in the bottom
  // left corner (outside the disc). The glow (emissive) map lights the rim band and the snowflake.
  function puckTextures() {
    const S = BL.App && BL.App.quality === 'low' ? 256 : 512;
    const make = (glow) => {
      const { c, g } = U.canvas(S, S), h = S / 2;
      g.fillStyle = glow ? '#000000' : '#16191f'; g.fillRect(0, 0, S, S);
      if (!glow) {
        const gr = g.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0, '#2b313b'); gr.addColorStop(0.8, '#1d2128'); gr.addColorStop(1, '#121418');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, 7); g.fill();
        // fine grip texture
        const rnd = U.rng(42);
        for (let i = 0; i < S * 4; i++) { g.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.04) + ')'; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
      }
      // a ring near the edge and the snowflake in the middle
      g.strokeStyle = glow ? '#3aa8e6' : '#7fd0ff'; g.lineWidth = S * 0.018;
      g.beginPath(); g.arc(h, h, h * 0.84, 0, 7); g.stroke();
      g.save(); g.translate(h, h);
      g.strokeStyle = glow ? '#4f8fb8' : '#e8f6ff'; g.lineCap = 'round'; g.lineWidth = S * 0.03;
      if (!glow) { g.shadowColor = '#9fe0ff'; g.shadowBlur = S * 0.03; }
      for (let k = 0; k < 6; k++) {
        g.rotate(Math.PI / 3);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -h * 0.58); g.stroke();
        for (const t of [0.28, 0.44]) { g.beginPath(); g.moveTo(0, -h * t); g.lineTo(h * 0.12, -h * (t + 0.11)); g.moveTo(0, -h * t); g.lineTo(-h * 0.12, -h * (t + 0.11)); g.stroke(); }
      }
      g.restore();
      // the rim strip (bottom-left corner, image y 90-100%): dark edges, a bright ice-blue band round the middle
      const x0 = 0, w = S * 0.1, y0 = S * 0.9, hh = S * 0.1;
      g.fillStyle = glow ? '#000000' : '#191c22'; g.fillRect(x0, y0, w, hh);
      g.fillStyle = glow ? '#2aa4ff' : '#5cc8ff'; g.fillRect(x0, y0 + hh * 0.44, w, hh * 0.14);
      if (!glow) { g.fillStyle = '#2a2f38'; g.fillRect(x0, y0 + hh * 0.18, w, hh * 0.03); g.fillRect(x0, y0 + hh * 0.79, w, hh * 0.03); }
      const t = new THREE.CanvasTexture(c);
      if (!glow && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
      return t;
    };
    return [make(false), make(true)];
  }
  BL.Models = BL.Models || {};
  BL.Models.makePuck = function (r, hh) {
    const low = BL.App && BL.App.quality === 'low';
    const geo = new THREE.CylinderGeometry(r, r, hh * 2, low ? 24 : 40, 1);
    // the side's UVs into the rim strip
    const side = geo.groups[0], uv = geo.attributes.uv, seen = new Set();
    for (let i = side.start; i < side.start + side.count; i++) {
      const v = geo.index.getX(i);
      if (seen.has(v)) continue;
      seen.add(v);
      uv.setXY(v, 0.005 + uv.getX(v) * 0.09, 0.012 + uv.getY(v) * 0.076);
    }
    const [map, glow] = puckTextures();
    const o = { map, emissiveMap: glow, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1 };
    const m = low ? new THREE.MeshLambertMaterial(o) : new THREE.MeshStandardMaterial(Object.assign(o, { roughness: 0.5, metalness: 0.15, envMap: BL.Models.envMap || null }));
    m.userData.glowMap = glow;
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    // (dispose: the game disposes the geometry, the material and its map; the glow map goes with the material)
    const d0 = m.dispose.bind(m);
    m.dispose = () => { glow.dispose(); d0(); };
    return mesh;
  };

  // ---------- the room outside the glass (the sky) ----------
  // An all-round picture of a warm, dim living room, blurred (we're tiny, inside the globe): wallpaper, the polished
  // table the globe stands on, a tall window with snow falling outside, a fireplace, a Christmas tree, a lamp; then
  // the lights on top as soft out-of-focus discs (bokeh), with their reflections in the table.
  function roomTexture(W) {
    const H = W / 2, { c, g } = U.canvas(W, H), rnd = U.rng(1225);
    const x = (f) => f * W, y = (f) => f * H;
    let gr = g.createLinearGradient(0, 0, 0, y(0.5));
    gr.addColorStop(0, '#0d0706'); gr.addColorStop(0.3, '#2c120e'); gr.addColorStop(1, '#5c2a1c');
    g.fillStyle = gr; g.fillRect(0, 0, W, y(0.5));
    for (let i = 0; i < 72; i++) { g.fillStyle = i % 2 ? 'rgba(255,205,150,0.04)' : 'rgba(0,0,0,0.06)'; g.fillRect(x(i / 72), y(0.1), x(1 / 144), y(0.4)); }
    // the table: polished dark wood
    gr = g.createLinearGradient(0, y(0.5), 0, H);
    gr.addColorStop(0, '#5a321c'); gr.addColorStop(0.06, '#3a1f10'); gr.addColorStop(0.35, '#1e1008'); gr.addColorStop(1, '#0b0503');
    g.fillStyle = gr; g.fillRect(0, y(0.5), W, y(0.5));
    for (let i = 0; i < 120; i++) {
      g.strokeStyle = 'rgba(0,0,0,' + (0.05 + rnd() * 0.1) + ')'; g.lineWidth = 1 + rnd() * 2.5;
      const yy = y(0.5 + Math.pow(rnd(), 1.6) * 0.5); g.beginPath(); g.moveTo(0, yy);
      for (let k = 1; k <= 12; k++) g.lineTo(x(k / 12), yy + Math.sin(k * 1.3 + i) * H * 0.004);
      g.stroke();
    }
    // the window: night blue, snow outside, frost in the corners, a cross of frame
    const wx = x(0.06), ww = x(0.15), wy = y(0.13), wh = y(0.35);
    gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#0a1630'); gr.addColorStop(1, '#2d5288');
    g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.4 + rnd() * 0.6) + ')'; g.beginPath(); g.arc(wx + rnd() * ww, wy + rnd() * wh, 1 + rnd() * W * 0.0016, 0, 7); g.fill(); }
    for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const rg = g.createRadialGradient(wx + fx * ww, wy + fy * wh, 0, wx + fx * ww, wy + fy * wh, ww * 0.45); rg.addColorStop(0, 'rgba(235,245,255,0.75)'); rg.addColorStop(1, 'rgba(235,245,255,0)'); g.fillStyle = rg; g.fillRect(wx, wy, ww, wh); }
    g.fillStyle = '#2a170e'; const fw = W * 0.006;
    g.fillRect(wx - fw, wy - fw, ww + fw * 2, fw); g.fillRect(wx - fw, wy + wh, ww + fw * 2, fw * 1.6); g.fillRect(wx - fw, wy, fw, wh); g.fillRect(wx + ww, wy, fw, wh);
    g.fillRect(wx + ww / 2 - fw / 2, wy, fw, wh); g.fillRect(wx, wy + wh * 0.45, ww, fw);
    // the fireplace: a stone surround, the fire and its glow over the wall
    const fx0 = x(0.58), fw0 = x(0.12), fy0 = y(0.3), fh = y(0.2);
    gr = g.createRadialGradient(fx0 + fw0 / 2, fy0 + fh, 0, fx0 + fw0 / 2, fy0 + fh, fw0 * 1.6);
    gr.addColorStop(0, 'rgba(255,150,60,0.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.fillRect(fx0 - fw0, fy0 - fh, fw0 * 3, fh * 2.2);
    g.fillStyle = '#3a2a24'; g.fillRect(fx0 - fw0 * 0.15, fy0 - fh * 0.12, fw0 * 1.3, fh * 1.12);
    g.fillStyle = '#4a2615'; g.fillRect(fx0 - fw0 * 0.25, fy0 - fh * 0.2, fw0 * 1.5, fh * 0.1); // the mantel
    g.fillStyle = '#0c0504'; g.fillRect(fx0 + fw0 * 0.1, fy0 + fh * 0.15, fw0 * 0.8, fh * 0.85);
    for (let i = 0; i < 14; i++) { const fx = fx0 + fw0 * (0.2 + rnd() * 0.6), fy = fy0 + fh * (0.6 + rnd() * 0.35), r = fw0 * (0.06 + rnd() * 0.1); const rg = g.createRadialGradient(fx, fy, 0, fx, fy, r); rg.addColorStop(0, 'rgba(255,240,170,0.95)'); rg.addColorStop(0.5, 'rgba(255,140,40,0.8)'); rg.addColorStop(1, 'rgba(255,80,20,0)'); g.fillStyle = rg; g.fillRect(fx - r, fy - r, r * 2, r * 2); }
    // stockings on the mantel
    for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#2e7d32' : '#c62828'; const sx = fx0 + fw0 * (0.1 + k * 0.38); g.fillRect(sx, fy0 - fh * 0.1, fw0 * 0.12, fh * 0.28); g.fillStyle = '#f2f2f2'; g.fillRect(sx, fy0 - fh * 0.1, fw0 * 0.12, fh * 0.06); }
    // the Christmas tree: dark tiers (its lights go on after the blur)
    const tx = x(0.37), ty = y(0.12), th = y(0.38), tw = x(0.07);
    g.fillStyle = '#0f2a17';
    for (let k = 0; k < 4; k++) { const t0 = ty + th * k * 0.22, t1 = ty + th * (0.3 + k * 0.23), w2 = tw * (0.45 + k * 0.2); g.beginPath(); g.moveTo(tx, t0); g.lineTo(tx + w2, t1); g.lineTo(tx - w2, t1); g.closePath(); g.fill(); }
    g.fillStyle = '#3a2210'; g.fillRect(tx - tw * 0.08, ty + th * 0.98, tw * 0.16, th * 0.06);
    // presents under it
    for (let k = 0; k < 5; k++) { g.fillStyle = ['#c62828', '#1565c0', '#f9a825', '#6a1b9a', '#2e7d32'][k]; const px = tx - tw * 0.7 + k * tw * 0.32, pw = tw * (0.22 + rnd() * 0.1); g.fillRect(px, y(0.5) - pw * 0.9, pw, pw * 0.9); }
    // a lamp, warm
    gr = g.createRadialGradient(x(0.86), y(0.24), 0, x(0.86), y(0.24), x(0.06));
    gr.addColorStop(0, 'rgba(255,225,160,0.9)'); gr.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = gr; g.fillRect(x(0.79), y(0.12), x(0.14), y(0.3));
    g.fillStyle = '#e8c890'; g.beginPath(); g.moveTo(x(0.845), y(0.2)); g.lineTo(x(0.875), y(0.2)); g.lineTo(x(0.885), y(0.27)); g.lineTo(x(0.835), y(0.27)); g.closePath(); g.fill();
    g.fillStyle = '#20120a'; g.fillRect(x(0.858), y(0.27), x(0.004), y(0.23));
    // out of focus
    const { c: c2, g: g2 } = U.canvas(W, H);
    if ('filter' in g2) { g2.filter = 'blur(' + Math.max(2, Math.round(W / 220)) + 'px)'; g2.drawImage(c, 0, 0); g2.filter = 'none'; } else g2.drawImage(c, 0, 0);
    // the lights: soft discs, a little brighter at the rim (like a camera's bokeh), mirrored dimly in the table
    g2.globalCompositeOperation = 'lighter';
    // (drawn wider toward the top and bottom: the picture is stretched across by 1 / cos(latitude) there, so they
    // come out round on the sphere)
    const bokeh = (bx, by, r, col, a) => {
      for (const [yy, k] of [[by, 1], [y(1) - by, 0.22]]) {
        if (k < 1 && yy < y(0.5)) continue;
        const sx = 1 / Math.max(0.2, Math.cos((0.5 - yy / H) * Math.PI));
        g2.save(); g2.translate(bx, yy); g2.scale(sx, 1);
        const rg = g2.createRadialGradient(0, 0, 0, 0, 0, r);
        rg.addColorStop(0, U.hexA(col, 0.35 * a * k)); rg.addColorStop(0.8, U.hexA(col, 0.5 * a * k)); rg.addColorStop(0.92, U.hexA(col, 0.6 * a * k)); rg.addColorStop(1, U.hexA(col, 0));
        g2.fillStyle = rg; g2.fillRect(-r, -r, r * 2, r * 2);
        g2.restore();
      }
    };
    const TREE = ['#ff3b3b', '#ffd23f', '#3bff7a', '#4fa8ff', '#ff6ad5', '#ffffff', '#ff9a2a'];
    for (let i = 0; i < 90; i++) { const v = rnd(), hw2 = tw * (0.08 + v * 0.95); bokeh(tx + (rnd() * 2 - 1) * hw2 * 0.9, ty + th * (0.04 + v * 0.92), W * (0.004 + rnd() * 0.006), TREE[(rnd() * TREE.length) | 0], 0.9); }
    bokeh(tx, ty, W * 0.01, '#ffe27a', 1.4);
    // string lights sagging along the top of the walls, all the way round
    for (let s = 0; s < 6; s++) for (let k = 0; k < 16; k++) {
      const f = (s + k / 16) / 6, sag = Math.sin((k / 16) * Math.PI) * y(0.05);
      bokeh(x(f), y(0.1) + sag, W * (0.003 + rnd() * 0.003), rnd() < 0.7 ? '#ffd9a0' : '#fff4dc', 0.9);
    }
    for (let i = 0; i < 18; i++) bokeh(fx0 + fw0 * (0.2 + rnd() * 0.6), fy0 + fh * (0.3 + rnd() * 0.6), W * (0.002 + rnd() * 0.003), '#ffb060', 0.8);
    const t = new THREE.CanvasTexture(c2);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ---------- the glass ----------
  // Additive and almost clear: bright at glancing angles (the curve of the globe reads), the room's window and fire
  // caught in it as soft reflections, and a long highlight down one side.
  const GLASS_V = 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const GLASS_F = `uniform vec3 uTint; uniform float uK; uniform vec3 uC; varying vec3 vN; varying vec3 vW;
    void main() {
      vec3 v = normalize(cameraPosition - vW), n = normalize(vN);
      float f = 1.0 - abs(dot(n, v));
      float a = 0.025 + 0.5 * pow(f, 4.0);
      vec3 d = normalize(vW - uC);
      float win = smoothstep(0.93, 0.985, dot(d, normalize(vec3(-0.6, 0.55, -0.58))));
      float win2 = smoothstep(0.965, 0.99, dot(d, normalize(vec3(-0.45, 0.7, -0.55))));
      float streak = smoothstep(0.05, 0.0, abs(dot(d, normalize(vec3(0.8, 0.0, -0.6))))) * smoothstep(0.08, 0.3, d.y) * (1.0 - smoothstep(0.45, 0.7, d.y)) * smoothstep(0.3, 0.7, dot(normalize(d.xz), normalize(vec2(-0.6, -0.8))));
      float fire = smoothstep(0.955, 0.995, dot(d, normalize(vec3(0.62, 0.3, 0.72))));
      vec3 col = uTint * a + vec3(0.85, 0.92, 1.0) * (win * 0.22 + win2 * 0.25 + streak * 0.16) + vec3(1.0, 0.62, 0.3) * fire * 0.22;
      gl_FragColor = linearToOutputTexel(vec4(col * uK, 1.0));
    }`;

  // ---------- the snow swirling round inside ----------
  // Each flake goes round the middle (slower the further out) and falls through the globe's height there (the glass is
  // lower toward the edge), all on the GPU; the tick only moves two numbers on.
  const SNOW_V = `attribute vec4 aP; // radius, angle, height, seed
    uniform float uSpin; uniform float uFall; uniform float uSize; uniform float uScale; uniform float uTop; uniform float uRG; uniform float uCY;
    varying float vA; varying float vRot;
    void main() {
      float s = aP.w, r = aP.x;
      float ang = aP.y + uSpin * (0.55 + 0.9 * s) * 80.0 / (r + 80.0);
      float top = min(uTop, uCY + sqrt(max(0.0, uRG * uRG - r * r)) - 4.0);
      float y = mod(aP.z - uFall * (0.7 + 0.6 * s), top);
      vec3 p = vec3(cos(ang) * r, y, sin(ang) * r);
      p.x += sin(uFall * 0.35 + s * 40.0) * 1.4; p.z += cos(uFall * 0.3 + s * 23.0) * 1.4;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vA = smoothstep(0.8, 4.0, -mv.z) * (1.0 - smoothstep(top - 8.0, top, y)) * smoothstep(0.0, 3.0, y);
      vRot = s * 6.283 + uFall * (s - 0.5) * 0.6;
      gl_PointSize = clamp(uSize * (0.6 + 0.8 * fract(s * 3.7)) * uScale / max(0.1, -mv.z), 0.0, 90.0);
      gl_Position = projectionMatrix * mv;
    }`;
  const SNOW_F = `uniform sampler2D atlas; uniform float uTile; uniform float hasAtlas;
    varying float vA; varying float vRot;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0;
      float a;
      if (hasAtlas > 0.5) {
        float cs = cos(vRot), sn = sin(vRot);
        vec2 pc = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) * 0.5 + 0.5;
        if (pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) discard;
        float col = mod(uTile, 4.0), row = floor(uTile / 4.0);
        a = texture2D(atlas, vec2((col + pc.x) / 4.0, 1.0 - (row + pc.y) / 12.0)).r;
      } else a = clamp(1.0 - length(p), 0.0, 1.0);
      a *= vA;
      if (a < 0.02) discard;
      gl_FragColor = linearToOutputTexel(vec4(1.0, 1.0, 1.0, a * 0.95));
    }`;
  function snow(root, H, tier) {
    const n = [900, 2400, 5000, 8000][tier], arr = new Float32Array(n * 4), rnd = U.rng(77);
    for (let i = 0; i < n; i++) {
      // (more of them close in, over the pitch and the stands, where they're seen)
      const r = i < n * 0.55 ? Math.sqrt(rnd()) * 125 : 125 + rnd() * 185;
      arr[i * 4] = r; arr[i * 4 + 1] = rnd() * Math.PI * 2; arr[i * 4 + 2] = rnd() * 200; arr[i * 4 + 3] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('aP', new THREE.BufferAttribute(arr, 4));
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const FX = BL.FX, atlas = FX && FX.add && FX.add.mat.uniforms.atlas.value, BT = BL.BoostFX && BL.BoostFX.T;
    const m = new THREE.ShaderMaterial({
      uniforms: { uSpin: { value: 0 }, uFall: { value: 0 }, uSize: { value: 0.42 }, uScale: { value: FX && FX.add ? FX.add.mat.uniforms.scale.value : 500 }, uTop: { value: 170 }, uRG: { value: RG }, uCY: { value: CY },
        atlas: { value: atlas || null }, hasAtlas: { value: atlas && BT ? 1 : 0 }, uTile: { value: BT ? BT.flake - 5 : 0 } },
      vertexShader: SNOW_V, fragmentShader: SNOW_F, transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false; pts.renderOrder = 4;
    root.add(pts); H.disposables.push(g, m);
    // a goal shakes the globe: the snow whirls round and up, then settles back over the next few seconds
    let spin = 0, fall = 0, shake = 0, phase = '';
    H.anim.push((dt) => {
      const gm = BL.game, ph = gm ? gm.phase : '';
      if (ph === 'goal' && phase !== 'goal') shake = 1;
      phase = ph;
      shake = Math.max(0, shake - dt * 0.16);
      const e = shake * shake;
      spin += dt * (0.05 + 1.3 * e); fall += dt * (1.15 - 3.4 * e);
      m.uniforms.uSpin.value = spin; m.uniforms.uFall.value = fall;
      if (FX && FX.add) m.uniforms.uScale.value = FX.add.mat.uniforms.scale.value;
    });
    return pts;
  }

  // ---------- giants: a snowman behind one goal, a Christmas tree behind the other ----------
  function part(geo, col, m4) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.applyMatrix4(m4);
    const n = geo.attributes.position.count, c = new THREE.Color(col), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    return geo;
  }
  function merge(parts) {
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
  const M4 = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new V3(sx || 1, sy || 1, sz || 1));
  const vmat = (low, o) => (low ? new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, o || {})) : new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0 }, o || {})));
  function snowman(low) {
    const s = low ? 12 : 22, P = [], SNOW = '#f4f8ff', COAL = '#17181c';
    P.push(part(new THREE.SphereGeometry(24, s, s * 0.7 | 0), SNOW, M4(0, 21, 0, 0, 0, 0, 1, 0.92, 1)));
    P.push(part(new THREE.SphereGeometry(17, s, s * 0.7 | 0), SNOW, M4(0, 56, 0, 0, 0, 0, 1, 0.94, 1)));
    P.push(part(new THREE.SphereGeometry(12, s, s * 0.7 | 0), SNOW, M4(0, 82, 0)));
    // the hat: brim, crown and a red band
    P.push(part(new THREE.CylinderGeometry(15, 15, 1.6, s), COAL, M4(0, 92.5, 0, -0.08, 0, 0.05)));
    P.push(part(new THREE.CylinderGeometry(9.5, 10, 15, s), COAL, M4(0.4, 100.5, -0.6, -0.08, 0, 0.05)));
    P.push(part(new THREE.CylinderGeometry(10.1, 10.1, 2.4, s), '#c62828', M4(0.1, 95, -0.2, -0.08, 0, 0.05)));
    // the face: coal eyes, a carrot nose, a coal smile
    for (const sx of [-1, 1]) P.push(part(new THREE.SphereGeometry(1.5, 8, 6), COAL, M4(sx * 4.4, 85.5, 10.6)));
    P.push(part(new THREE.ConeGeometry(2.1, 13, 10), '#ff7a1a', M4(0, 81.5, 16.5, Math.PI / 2, 0, 0)));
    for (let k = 0; k < 5; k++) { const a = (k / 4 - 0.5) * 1.3; P.push(part(new THREE.SphereGeometry(1.1, 6, 5), COAL, M4(Math.sin(a) * 6.5, 76.8 - Math.cos(a) * 1.8 + 1.8, 10.6 * Math.cos(a * 0.6)))); }
    // buttons
    for (let k = 0; k < 3; k++) P.push(part(new THREE.SphereGeometry(1.9, 8, 6), COAL, M4(0, 64 - k * 8, 16.2 - Math.abs(k - 1) * 0.6)));
    // the scarf: round the neck, one end hanging down
    P.push(part(new THREE.TorusGeometry(11.2, 2.6, 8, s), '#d32f2f', M4(0, 71.5, 0, Math.PI / 2, 0, 0)));
    P.push(part(new THREE.BoxGeometry(5.5, 18, 2.2), '#d32f2f', M4(6.5, 62, 11.5, 0.12, 0, 0.15)));
    for (let k = 0; k < 4; k++) P.push(part(new THREE.BoxGeometry(5.6, 1.2, 2.3), '#f5f5f5', M4(6.5 - k * 0.3, 67 - k * 4, 11.8, 0.12, 0, 0.15)));
    // stick arms with twig fingers
    for (const sx of [-1, 1]) {
      P.push(part(new THREE.CylinderGeometry(0.9, 1.3, 34, 6), '#5d3a1f', M4(sx * 30, 64, 0, 0, 0, sx * -1.0)));
      P.push(part(new THREE.CylinderGeometry(0.5, 0.7, 9, 5), '#5d3a1f', M4(sx * 44.5, 76, 0, 0, 0, sx * -0.4)));
      P.push(part(new THREE.CylinderGeometry(0.5, 0.7, 8, 5), '#5d3a1f', M4(sx * 45, 72.5, 0, 0, 0, sx * -1.6)));
    }
    return merge(P);
  }
  function xmasTree(low) {
    const s = low ? 10 : 18, P = [], tiers = 5;
    P.push(part(new THREE.CylinderGeometry(5, 7, 16, 8), '#4e2f18', M4(0, 8, 0)));
    for (let k = 0; k < tiers; k++) {
      const r = 42 - k * 8, h = 34 - k * 3, y0 = 12 + k * 21;
      P.push(part(new THREE.ConeGeometry(r, h, s, 1), k % 2 ? '#1d5e31' : '#174f28', M4(0, y0 + h / 2, 0, 0, k * 0.4, 0)));
      // snow on the tips of each tier
      P.push(part(new THREE.ConeGeometry(r * 0.32, h * 0.3, s, 1, true), '#eef4fb', M4(0, y0 + h * 0.86, 0)));
    }
    return { geo: merge(P), tiers };
  }
  function giants(root, H, A, K, low, tier) {
    const mat = vmat(low);
    H.disposables.push(mat);
    const zEnd = A.hl + K.ST.d1 + 82;
    const sm = new THREE.Mesh(snowman(low), mat);
    sm.position.set(-34, -0.6, -zEnd); // (faces the stadium: +z)
    sm.castShadow = !low;
    root.add(sm); H.disposables.push(sm.geometry);
    const t = xmasTree(low), tm = new THREE.Mesh(t.geo, mat);
    tm.position.set(30, -0.6, zEnd);
    root.add(tm); H.disposables.push(t.geo);
    // baubles and lights on the tree, and a star on top (unlit colours: they glow); not on Very Low
    if (tier) {
      const n = tier >= 2 ? 150 : 60, geo = new THREE.IcosahedronGeometry(1, 1);
      const bm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      const im = new THREE.InstancedMesh(geo, bm, n + 1);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), sc = new V3(), rnd = U.rng(31), cols = ['#ff3b3b', '#ffd23f', '#4fa8ff', '#ff6ad5', '#ffffff', '#3bff7a', '#ff9a2a'];
      const col = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const k = (rnd() * t.tiers) | 0, r = 42 - k * 8, h = 34 - k * 3, y0 = 12 + k * 21, f = 0.15 + rnd() * 0.8, a = rnd() * Math.PI * 2;
        const rr = r * (1 - f) + 1.2;
        p.set(30 + Math.cos(a) * rr, -0.6 + y0 + h * f, zEnd + Math.sin(a) * rr);
        sc.setScalar(1.0 + rnd() * 1.1);
        im.setMatrixAt(i, m4.compose(p, q, sc));
        im.setColorAt(i, col.set(cols[i % cols.length]).multiplyScalar(1.6));
      }
      p.set(30, -0.6 + 12 + 4 * 21 + 34 - 12 + 4, zEnd); sc.set(5.5, 7, 5.5);
      im.setMatrixAt(n, m4.compose(p, q, sc)); im.setColorAt(n, col.set('#ffe27a').multiplyScalar(2.2));
      root.add(im); H.disposables.push(geo, bm);
    }
  }

  SD.build = function (root, H, map, A, low, K) {
    const tier = tierOf(low);
    // the room, as the sky (the arena's own sky is put away)
    if (H.sky) H.sky.visible = false;
    const tex = roomTexture(tier >= 2 ? 2048 : 1024);
    const skyGeo = new THREE.SphereGeometry(900, 48, 24), skyMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -10; sky.rotation.y = 0.9;
    root.add(sky); H.disposables.push(skyGeo, skyMat, tex);
    // the glass (only the part above the snow)
    const cosT = (-1 - CY) / RG, glassGeo = new THREE.SphereGeometry(RG, tier ? 72 : 40, tier ? 30 : 16, 0, Math.PI * 2, 0, Math.acos(cosT));
    const glassMat = new THREE.ShaderMaterial({
      uniforms: { uTint: { value: new THREE.Color('#cfe9ff') }, uK: { value: 1 }, uC: { value: new V3(0, CY, 0) } },
      vertexShader: GLASS_V, fragmentShader: GLASS_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = CY; glass.renderOrder = -4; glass.frustumCulled = false;
    root.add(glass); H.disposables.push(glassGeo, glassMat);
    // a gold rim where the glass meets the snow
    if (tier) {
      const rr = Math.sqrt(RG * RG - CY * CY), rimGeo = new THREE.TorusGeometry(rr, 3.2, 8, 160);
      const rimMat = low ? new THREE.MeshLambertMaterial({ color: 0xc9a24a }) : new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.85, roughness: 0.3, envMap: BL.Models.envMap || null });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = -Math.PI / 2; rim.position.y = 0.2;
      root.add(rim); H.disposables.push(rimGeo, rimMat);
    }
    snow(root, H, tier);
    giants(root, H, A, K, low, tier);
  };
})(window.BL);
