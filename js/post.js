'use strict';
// Rocket League (fan remake) - the finishing pass on Medium / High: the match is drawn into an HDR buffer, then
// graded (more contrast and colour, cool shadows / warm highlights), vignetted and given bloom so boost, lights and
// goal explosions glow (High: a wide second layer too). Medium smooths jagged edges (FXAA: its buffer has no
// multisampling), High is sharpened a touch (it has 4x MSAA). Tone mapping and sRGB output happen here instead of
// in each material. Low and Very Low (and splitscreen) draw straight to the screen as before.
(function (BL) {
  const P = BL.Post = { ok: null };
  let rt = null, bA = null, bB = null, cA = null, cB = null, quad = null, scn = null, cam = null, mats = null;
  const size = new THREE.Vector2();

  P.wanted = function () {
    const App = BL.App, s = BL.Save.p.settings;
    return !App.potato && (App.quality === 'medium' || App.quality === 'high') && s.post !== false;
  };
  function supported(r) {
    if (P.ok != null) return P.ok;
    const gl = r.getContext();
    P.ok = !!(r.capabilities.isWebGL2 && gl.getExtension('EXT_color_buffer_float'));
    return P.ok;
  }
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  function build(high) {
    scn = new THREE.Scene(); cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false; scn.add(quad);
    const raw = (fs, u) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false, toneMapped: false });
    mats = {
      // bright parts of the frame, downsampled
      bright: raw(`uniform sampler2D tSrc; uniform vec2 uPx; varying vec2 vUv;
        void main(){ vec3 c = vec3(0.0);
          c += texture2D(tSrc, vUv + uPx * vec2(-1.0, -1.0)).rgb; c += texture2D(tSrc, vUv + uPx * vec2(1.0, -1.0)).rgb;
          c += texture2D(tSrc, vUv + uPx * vec2(-1.0, 1.0)).rgb; c += texture2D(tSrc, vUv + uPx * vec2(1.0, 1.0)).rgb;
          c = max(c * 0.25, vec3(0.0)); float l = max(c.r, max(c.g, c.b));
          // (a broken pixel - NaN or infinite - glows nothing instead of the blur spreading it into a black box)
          if (!(l < 65000.0)) { c = vec3(0.0); l = 0.0; }
          gl_FragColor = vec4(c * smoothstep(0.85, 1.6, l), 1.0); }`, { tSrc: { value: null }, uPx: { value: new THREE.Vector2() } }),
      blur: raw(`uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
          c += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
          c += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
          gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }),
      final: new THREE.ShaderMaterial({
        uniforms: { tSrc: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, uBloom: { value: high ? 0.5 : 0.35 }, uBloom2: { value: 0.4 }, uVig: { value: 0.32 }, uPx: { value: new THREE.Vector2() },
          // a goal explosion's look over the whole picture (js/maptheme.js)
          uThK: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1 }, uToon: { value: 0 }, uPix: { value: 0 }, uDark: { value: 0 } },
        vertexShader: vs,
        fragmentShader: `uniform sampler2D tSrc; uniform sampler2D tBloom; uniform sampler2D tBloom2; uniform float uBloom; uniform float uBloom2; uniform float uVig; uniform vec2 uPx; varying vec2 vUv;
          uniform float uThK; uniform vec3 uTint; uniform float uSat; uniform float uToon; uniform float uPix; uniform float uDark;
          vec2 uv;
          vec3 at(vec2 o){ return texture2D(tSrc, uv + o * uPx).rgb; }
          vec3 tm(vec3 x){ return x / (1.0 + x); }
          vec3 untm(vec3 q){ q = min(q, vec3(0.96)); return q / (1.0 - q); }
          float lu(vec3 c){ c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
          void main(){
            uv = vUv;
            // Pixel Blast: big square pixels
            if (uPix > 0.0) { vec2 bs = uPx * floor(mix(1.0, 4.0, uPix) + 0.5); uv = (floor(vUv / bs) + 0.5) * bs; }
            vec3 c = texture2D(tSrc, uv).rgb;
            ${high ? `
            // sharpen: lift the difference from the four neighbours, never past them (no halos)
            vec3 n = at(vec2(0.0, 1.0)), s = at(vec2(0.0, -1.0)), e = at(vec2(1.0, 0.0)), w = at(vec2(-1.0, 0.0));
            c = clamp(c + 0.16 * (4.0 * c - n - s - e - w), min(c, min(min(n, s), min(e, w))), max(c, max(max(n, s), max(e, w))));
            c += texture2D(tBloom2, vUv).rgb * uBloom2;` : `
            // FXAA: blend along edges found from the brightness of the four diagonal neighbours
            vec3 nw = at(vec2(-1.0, 1.0)), ne = at(vec2(1.0, 1.0)), sw = at(vec2(-1.0, -1.0)), se = at(vec2(1.0, -1.0));
            float lNW = lu(nw), lNE = lu(ne), lSW = lu(sw), lSE = lu(se), lM = lu(c);
            float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
            if (lMax - lMin > max(0.03, lMax * 0.12)) {
              vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
              float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
              dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), vec2(-8.0), vec2(8.0));
              vec3 a = 0.5 * (at(dir * (1.0 / 3.0 - 0.5)) + at(dir * (2.0 / 3.0 - 0.5)));
              vec3 b = a * 0.5 + 0.25 * (at(dir * -0.5) + at(dir * 0.5));
              float lB = lu(b);
              c = (lB < lMin || lB > lMax) ? a : b;
            }`}
            c += texture2D(tBloom, vUv).rgb * uBloom;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = max(vec3(0.0), mix(vec3(l), c, 1.17));
            c *= mix(vec3(0.94, 0.98, 1.08), vec3(1.06, 1.01, 0.94), smoothstep(0.05, 0.9, l));
            vec2 d = vUv - 0.5; c *= 1.0 - uVig * pow(dot(d, d) * 2.2, 1.4);
            if (uThK > 0.0) {
              float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
              c = mix(c, mix(vec3(l2), c, uSat) * uTint * (1.0 - uDark), uThK);
              // Cherry Blossom's anime look: flat bands of colour with ink lines where colours change
              if (uToon > 0.0) {
                // (bands of brightness only, so colours keep their hue; ink only where the picture really changes)
                const vec3 LW = vec3(0.299, 0.587, 0.114);
                float ln = dot(tm(at(vec2(0.0, 1.5))), LW), ls = dot(tm(at(vec2(0.0, -1.5))), LW), le = dot(tm(at(vec2(1.5, 0.0))), LW), lw = dot(tm(at(vec2(-1.5, 0.0))), LW);
                float ink = smoothstep(0.22, 0.5, abs(ln - ls) + abs(le - lw)) * uToon;
                vec3 q = tm(c); float l = max(0.02, dot(q, LW)), lq = max(0.12, floor(l * 6.0 + 0.5) / 6.0);
                c = mix(c, untm(min(vec3(0.95), q * (lq / l))), 0.45 * uToon) * (1.0 - 0.55 * ink);
              }
              // Pixel Blast: fewer colours, like an old console
              if (uPix > 0.0) c = mix(c, untm(floor(tm(c) * 8.0 + 0.5) / 8.0), uPix * 0.8);
            }
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`,
        depthTest: false, depthWrite: false,
      }),
    };
  }
  function ensure(r, high) {
    r.getDrawingBufferSize(size);
    const w = Math.max(1, size.x | 0), h = Math.max(1, size.y | 0);
    if (!mats || mats.high !== high) { P.dispose(); build(high); mats.high = high; }
    if (!rt || rt.width !== w || rt.height !== h) {
      if (rt) rt.dispose(); if (bA) { bA.dispose(); bB.dispose(); }
      if (cA) { cA.dispose(); cB.dispose(); }
      // (no stencil: with one three.js makes a multisampled depth+stencil buffer, and resolving that made High's frames
      // about 6x slower on the GPU, 0.8 -> 5 ms; the fans in the stands get their depth bias in the shader instead)
      rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: high ? 4 : 0, depthBuffer: true, stencilBuffer: false });
      const half = (k) => new THREE.WebGLRenderTarget(Math.max(1, w >> k), Math.max(1, h >> k), { type: THREE.HalfFloatType, depthBuffer: false });
      bA = half(2); bB = half(2); cA = half(3); cB = half(3);
    }
  }
  const pass = (r, mat, target) => { quad.material = mat; r.setRenderTarget(target); r.render(scn, cam); };

  // draw(fn): fn renders the scene into whatever target is current
  P.render = function (r, fn) {
    if (!P.wanted() || !supported(r)) { fn(); return; }
    const high = BL.App.quality === 'high';
    ensure(r, high);
    r.setRenderTarget(rt); r.clear(); fn();
    const blur = (A, B, n) => {
      for (let i = 0; i < n; i++) {
        mats.blur.uniforms.tSrc.value = A.texture; mats.blur.uniforms.uDir.value.set((1 + i) / A.width, 0); pass(r, mats.blur, B);
        mats.blur.uniforms.tSrc.value = B.texture; mats.blur.uniforms.uDir.value.set(0, (1 + i) / A.height); pass(r, mats.blur, A);
      }
    };
    // bloom at a quarter size (Medium: one blur round); High adds a wider, softer layer at an eighth
    mats.bright.uniforms.tSrc.value = rt.texture; mats.bright.uniforms.uPx.value.set(1 / rt.width, 1 / rt.height);
    pass(r, mats.bright, bA);
    blur(bA, bB, high ? 2 : 1);
    mats.final.uniforms.tBloom.value = bA.texture;
    if (high) {
      mats.blur.uniforms.tSrc.value = bA.texture; mats.blur.uniforms.uDir.value.set(1 / bA.width, 1 / bA.height); pass(r, mats.blur, cA);
      blur(cA, cB, 2);
      mats.final.uniforms.tBloom2.value = cA.texture;
    }
    mats.final.uniforms.tSrc.value = rt.texture; mats.final.uniforms.uPx.value.set(1 / rt.width, 1 / rt.height);
    const MT = BL.MapTheme, th = MT && MT.live() ? MT.post : null, U = mats.final.uniforms;
    U.uThK.value = th ? th.k : 0;
    if (th && th.k > 0) { U.uTint.value.copy(th.tint); U.uSat.value = th.sat; U.uToon.value = th.toon; U.uPix.value = th.pix; U.uDark.value = th.dark; }
    pass(r, mats.final, null);
  };
  // run fn with the same target the match draws into (three.js builds a different shader for each kind of target)
  P.warm = function (r, fn) {
    if (!P.wanted() || !supported(r)) { fn(); return; }
    ensure(r, BL.App.quality === 'high');
    r.setRenderTarget(rt); fn(); r.setRenderTarget(null);
  };
  P.dispose = function () {
    if (rt) rt.dispose(); if (bA) { bA.dispose(); bB.dispose(); } if (cA) { cA.dispose(); cB.dispose(); }
    rt = bA = bB = cA = cB = null;
    if (mats) { for (const k of ['bright', 'blur', 'final']) mats[k].dispose(); mats = null; }
    if (quad) quad.geometry.dispose();
  };
})(window.BL);
