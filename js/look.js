'use strict';
// Rocket League (fan remake) - the "look" upgrades on Medium / High, patched into three.js's own shader pieces once at
// start-up (before anything is compiled). Low and Very Low never install this, so their shaders stay exactly as they
// were (an old Chromebook pays for every extra sum per pixel).
//  - haze that glows toward the sun: the far end of the pitch and the stands fade into a warm, bright mist on the
//    sun's side and a cooler one away from it, like the real arenas' aerial haze
//  - a rim light on the car paint: the edges of each car catch the stadium lights so cars stand off the pitch
// The values live in plain objects shared by every material (three.js copies Vector3s per material but hands plain
// objects round by reference), so the arena sets them once per match with BL.Look.setArena.
(function (BL) {
  const L = BL.Look = { on: false };
  const SUN_DIR = { x: 0, y: 1, z: 0 }, SUN_COL = { x: 0, y: 0, z: 0 }, RIM = { x: 0, y: 0, z: 0 };

  L.install = function () {
    if (L.on || !window.THREE || !THREE.ShaderChunk) return;
    const C = THREE.ShaderChunk;
    // world position for the fog (from the view-space position: the view matrix is a rotation plus a move, so its
    // inverse is the transpose)
    C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 vFogWorld;\n#endif';
    C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogWorld = ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) * mat3( viewMatrix );\n#endif';
    C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying vec3 vFogWorld;\n\tuniform vec3 fogSunDir;\n\tuniform vec3 fogSunCol;');
    C.fog_fragment = [
      '#ifdef USE_FOG',
      '\t#ifdef FOG_EXP2',
      '\t\tfloat fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );',
      '\t#else',
      '\t\tfloat fogFactor = smoothstep( fogNear, fogFar, vFogDepth );',
      '\t#endif',
      // (looking toward the sun the haze is brighter and warmer; it adds light, so it never darkens anything)
      '\tfloat fogSunK = max( dot( normalize( vFogWorld - cameraPosition ), fogSunDir ), 0.0 );',
      '\tfogSunK *= fogSunK; fogSunK *= fogSunK;',
      '\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor + fogSunCol * fogSunK, fogFactor );',
      '#endif',
    ].join('\n');
    // car paint rim (only on materials with the CAR_RIM define, see js/carmodels.js): on the sides and edges (a roof or
    // bonnet seen from above would wash out), and the underside and lower sills darker, like the shade under a car
    C.emissivemap_pars_fragment += '\n#ifdef CAR_RIM\n\tuniform vec3 carRim;\n#endif';
    C.emissivemap_fragment += '\n#ifdef CAR_RIM\n\t{ float rimF = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );\n\tfloat rimNu = dot( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ), rimUp = max( rimNu, 0.0 );\n\tdiffuseColor.rgb *= 1.0 - 0.5 * max( - rimNu, 0.0 );\n\ttotalEmissiveRadiance += carRim * ( rimF * rimF * rimF ) * ( 1.0 - 0.75 * rimUp ) * mix( vec3( 1.0 ), diffuseColor.rgb, 0.45 ); }\n#endif';
    const add = (u) => {
      if (!u || !u.fogColor) return;
      u.fogSunDir = { value: SUN_DIR }; u.fogSunCol = { value: SUN_COL };
    };
    add(THREE.UniformsLib.fog);
    for (const k in THREE.ShaderLib) {
      const u = THREE.ShaderLib[k].uniforms;
      add(u);
      if (k === 'standard' || k === 'physical') u.carRim = { value: RIM };
    }
    L.on = true;
  };

  // per match: where the sun is and what colour its haze and the cars' rim light are
  L.setArena = function (map, sunDir) {
    if (!L.on) return;
    const night = map.time === 'night', dusk = map.time === 'dusk';
    SUN_DIR.x = sunDir.x; SUN_DIR.y = sunDir.y; SUN_DIR.z = sunDir.z;
    const s = new THREE.Color(map.light.sun).multiplyScalar(night ? 0.12 : dusk ? 0.42 : 0.3);
    SUN_COL.x = s.r; SUN_COL.y = s.g; SUN_COL.z = s.b;
    // (night: the floodlights' warm white; day: the sky's colour)
    const r = new THREE.Color(night ? '#ffe6c4' : map.light.hemiSky).multiplyScalar(night ? 0.42 : dusk ? 0.32 : 0.26);
    RIM.x = r.r; RIM.y = r.g; RIM.z = r.b;
  };
  L.clear = function () { SUN_COL.x = SUN_COL.y = SUN_COL.z = 0; RIM.x = RIM.y = RIM.z = 0; };
})(window.BL);
