'use strict';
// Rocket League (fan remake) - stadium atmosphere on Medium / High (Low and Very Low only get the floodlit pitch and
// the muted turf, a few sums in the floor's shader):
//  - the pitch is floodlit: brighter in the middle, soft pools of light, darker against the walls and in the corners
//  - grass is muted and cooled toward the real pitches' colour
//  - faint light shafts from the stand roofs down onto the pitch
//  - drifting motes of dust / sparkle in the air
//  - a slow shimmer that sweeps across the wall glass
// Everything is a handful of draw calls with tiny shaders, animated from the arena's update.
(function (BL) {
  const AM = BL.Ambience = {};

  // floodlit pitch, patched into the floor's material (every quality level: it's a few sums): brighter in the middle
  // and in pools under the floodlights, darker against the walls and in the corners, like the real arenas' baked
  // lighting; strongest at night
  AM.floor = function (mat, A, map, H) {
    // (night: a bright floodlit middle with strong pools and dark edges, so the pitch reads lit and the walls fall away)
    const k = { day: [0.95, 0.12, 0.25], dusk: [0.9, 0.3, 0.32], night: [0.82, 0.5, 0.44] }[map.time] || [0.95, 0.12, 0.25];
    // (Very Low: just the bright middle and the darker edges, no pools)
    const potato = !!(BL.App && BL.App.potato);
    // underwater arenas: sunlight through the waves rippling across the pitch in bright moving lines (Medium / High)
    const caus = !!map.caustics && !potato && BL.App && BL.App.quality !== 'low';
    const uT = { value: 0 };
    if (caus && H) H.anim.push((dt, t) => { uT.value = t % 3600; });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uHalf = { value: new THREE.Vector2(A.hw, A.hl) };
      sh.uniforms.uLit = { value: new THREE.Vector3(k[0], k[1], k[2]) };
      sh.uniforms.uT = uT;
      gradeUniforms(sh, map);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFieldXZ;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvFieldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFieldXZ;\nuniform vec2 uHalf;\nuniform vec3 uLit;\nuniform float uT;' + (caus ? CAUSTIC : ''))
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 fq = vFieldXZ / uHalf;
          float cen = 1.0 - smoothstep(0.0, 1.15, length(fq * vec2(1.0, 0.8)));
          ${potato ? 'float pools = 0.0; float edge = smoothstep(0.8, 1.0, max(abs(fq.x), abs(fq.y)));' : `vec2 pq = abs(fq) - vec2(0.55, 0.5);
          float pools = exp(-dot(pq, pq) * 9.0);
          float edge = smoothstep(0.8, 1.0, max(abs(fq.x), abs(fq.y))) + 0.6 * smoothstep(1.25, 1.65, abs(fq.x) + abs(fq.y));`}
          diffuseColor.rgb *= (uLit.x + uLit.y * (0.55 * cen + pools)) * (1.0 - uLit.z * min(1.0, edge));
          ${caus ? 'diffuseColor.rgb += vec3(0.55, 0.85, 0.9) * caustic(vFieldXZ * 0.12, uT * 0.55) * 0.42 * (1.0 - 0.6 * min(1.0, edge));' : ''}
          ${GRADE}`);
    };
    mat.customProgramCacheKey = () => 'floodlit-pitch' + (potato ? 'p' : '') + (caus ? 'c' : '');
    mat.needsUpdate = true;
  };
  // two layers of warped ripples; where they cancel out a thin bright line is left, like light focused by waves
  const CAUSTIC = `
    float caustic(vec2 p, float t) {
      vec2 q = p + vec2(sin(p.y * 1.7 + t * 0.9), cos(p.x * 1.3 - t * 0.7)) * 0.9;
      float a = sin(q.x * 2.3 + t) * sin(q.y * 2.1 - t * 0.8);
      vec2 r = p * 1.6 + vec2(cos(p.y * 1.1 - t * 0.6), sin(p.x * 1.4 + t * 0.5)) * 1.1;
      float b = sin(r.x * 1.9 - t * 0.7) * sin(r.y * 2.2 + t * 0.9);
      return pow(clamp(1.0 - abs(a + b) * 0.55, 0.0, 1.0), 14.0);
    }`;
  // The real pitches are a muted, slightly cool green (measured from the user's clips: about a third of our turf's
  // saturation), so grass is pulled toward grey and cooled; the ramp's turf gets the same so they match.
  const GRADE = 'float gL = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(vec3(gL), diffuseColor.rgb, uGradeSat) * uGradeTint;';
  function gradeUniforms(sh, map) {
    const grass = map.floor && map.floor.type === 'grass';
    sh.uniforms.uGradeSat = { value: grass ? (map.time === 'day' ? 0.5 : 0.7) : 1 };
    // (and darker: the real turf sits well below the lines and the cars)
    sh.uniforms.uGradeTint = { value: grass ? new THREE.Vector3(map.time === 'day' ? 0.9 : 1.15, map.time === 'day' ? 0.97 : 1.2, map.time === 'day' ? 0.98 : 1.18) : new THREE.Vector3(1, 1, 1) };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGradeSat;\nuniform vec3 uGradeTint;');
  }
  AM.turf = function (mat, map) {
    if (!map.floor || map.floor.type !== 'grass') return;
    mat.onBeforeCompile = (sh) => {
      gradeUniforms(sh, map);
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + GRADE);
    };
    mat.customProgramCacheKey = () => 'graded-turf';
    mat.needsUpdate = true;
  };

  // a sweeping sheen across the wall glass (MeshBasicMaterial with vertex colours and the hex texture)
  AM.glass = function (mat, H) {
    const u = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = u;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlassW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGlassW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlassW;\nuniform float uT;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float sw = fract((vGlassW.x * 0.6 + vGlassW.z * 0.6 + vGlassW.y * 1.4) / 90.0 - uT * 0.06);
          float band = smoothstep(0.0, 0.04, sw) * (1.0 - smoothstep(0.04, 0.1, sw));
          diffuseColor.rgb += vec3(0.5, 0.7, 1.0) * band * 0.35;
          diffuseColor.a = min(1.0, diffuseColor.a + band * 0.12);`);
    };
    mat.customProgramCacheKey = () => 'glass-sheen';
    mat.needsUpdate = true;
    H.anim.push((dt, t) => { u.value = t; });
  };

  AM.add = function (root, H, map, A, opts) {
    const high = opts && opts.high, night = map.time !== 'day';
    const glow = new THREE.Color(map.floor && map.floor.glow ? map.floor.glow : '#fff1d0');
    const warm = night ? new THREE.Color('#ffe9c2') : new THREE.Color('#fff8e8');

    // light shafts: soft additive cones from above the stands to the pitch
    const shaftMat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: warm }, uI: { value: night ? 0.17 : 0.07 }, uT: { value: 0 } },
      vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uI; uniform float uT; varying float vH; varying vec3 vN; varying vec3 vV; void main(){ float side = pow(abs(dot(normalize(vN), vV)), 1.6); float along = smoothstep(0.0, 0.35, vH) * (0.35 + 0.65 * vH); float flick = 0.92 + 0.08 * sin(uT * 0.7 + vH * 6.0); gl_FragColor = vec4(uCol * side * along * uI * flick, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const shafts = new THREE.Group();
    // (from the roof's floodlight row when the arena passes where it is)
    const ring = (opts && opts.ring) || 30, n = high ? 8 : 6, ringX = A.hw + ring, ringZ = A.hl + ring, topY = (opts && opts.topY) || A.h + 34;
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      const from = new THREE.Vector3(Math.cos(a) * ringX, topY, Math.sin(a) * ringZ);
      const to = new THREE.Vector3(Math.cos(a) * A.hw * 0.35, 0, Math.sin(a) * A.hl * 0.35);
      const len = from.distanceTo(to);
      // open-ended cone, narrow at the light (uv.y = 1) and wide on the pitch (uv.y = 0)
      const geo = new THREE.CylinderGeometry(1.2, 13, len, 18, 1, true);
      geo.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(geo, shaftMat);
      m.position.copy(from);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
      m.renderOrder = 3;
      shafts.add(m);
    }
    root.add(shafts);

    // drifting motes
    const count = high ? 520 : 280;
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * A.hw * 1.05; pos[i * 3 + 1] = Math.random() * A.h; pos[i * 3 + 2] = (Math.random() * 2 - 1) * A.hl * 1.05;
      seed[i] = Math.random();
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    mg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    mg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), A.hl * 2);
    const moteMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uH: { value: A.h }, uCol: { value: night ? glow.clone().lerp(warm, 0.5) : warm }, uScale: { value: 1 } },
      vertexShader: `attribute float seed; uniform float uT; uniform float uH; uniform float uScale; varying float vA;
        void main(){ vec3 p = position; float s = seed * 6.2831;
          p.y = mod(p.y + uT * (0.25 + seed * 0.35), uH);
          p.x += sin(uT * 0.21 + s) * 2.2; p.z += cos(uT * 0.17 + s * 1.3) * 2.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (0.35 + 0.65 * sin(uT * (0.6 + seed) + s) * 0.5 + 0.325) * smoothstep(0.0, 2.0, p.y) * smoothstep(uH, uH - 3.0, p.y) * smoothstep(4.0, 12.0, -mv.z);
          gl_PointSize = uScale * (0.9 + seed * 1.6) * 60.0 / -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(uCol * (1.0 - r * 4.0) * vA * 0.4, 1.0); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const motes = new THREE.Points(mg, moteMat);
    motes.renderOrder = 4;
    root.add(motes);

    H.anim.push((dt, t) => {
      shaftMat.uniforms.uT.value = t; moteMat.uniforms.uT.value = t;
      // point sizes follow the drawing-buffer height so the motes look the same at any resolution
      const r = BL.App && BL.App.renderer;
      if (r) moteMat.uniforms.uScale.value = r.getDrawingBufferSize(_s).y / 720;
    });
    H.disposables.push(shaftMat, moteMat);
  };
  const _s = new THREE.Vector2();
})(window.BL);
