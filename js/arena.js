'use strict';
// Rocket League (fan remake) - arena + stadium visuals for each map
(function (BL) {
  const U = BL.util;
  const AR = BL.Arena = {};
  const V3 = THREE.Vector3;
  // the seating bowl (distance behind the wall, height): like the real stadiums it starts behind a concourse and
  // rises to y1 at d1, a low band under a high open roof (it used to climb to 42 m and fill the top of the screen).
  // Everything outside is pushed out by RING_PUSH.
  const ST = { d0: 18, d1: 54, y0: 4, y1: 24 };
  const RING_PUSH = ST.d1 - 26;
  // the roof: an open steel lattice over the stands at ROOF.y, its inner edge ROOF.d behind the walls carrying a row
  // of floodlight panels that faces the pitch (the light strips across the top of the real game's picture)
  const ROOF = { y: ST.y1 + 13, d: 8 };

  function q() { return (BL.App && BL.App.quality) || 'medium'; }
  function litMat(opts, low) {
    if (q() === 'low' || low) return new THREE.MeshLambertMaterial(opts);
    return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0.05 }, opts));
  }

  // ---------- perimeter + sweep ----------
  // the arena outline seen from above: straight walls, flat 45-degree corner walls (C = cut length along each wall)
  // and rounded edges between them; matches BL.Physics.wall2d exactly
  function perimeter(hw, hl, C, gw) {
    const pts = [];
    const rc = BL.Physics.arena.cornerRound || 2.5;
    const arcN = q() === 'low' ? 3 : 5; // per 45-degree edge
    const push = (x, z, nx, nz, goal) => pts.push({ x, z, nx, nz, goal: !!goal });
    const straight = (x0, z0, x1, z1, nx, nz, goalAxis) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const stops = [0, 1];
      if (goalAxis) {
        // extra points beside the posts so the tapered ramp (see rampTaper) is smooth
        const tp = BL.Physics.arena.goalTaper || 0;
        for (const g0 of [gw, gw + tp * 0.25, gw + tp * 0.5, gw + tp * 0.75, gw + tp]) {
          for (const g of [-g0, g0]) {
            const t = (g - x0) / (x1 - x0);
            if (t > 0 && t < 1) stops.push(t);
          }
        }
      }
      const n = Math.max(1, Math.round(len / 5));
      for (let i = 1; i < n; i++) stops.push(i / n);
      stops.sort((a, b) => a - b);
      for (let i = 0; i < stops.length - 1; i++) {
        const t = stops[i];
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        push(x, z, nx, nz, goalAxis && Math.abs(x) <= gw + 1e-3);
      }
    };
    const arc = (cx, cz, a0, a1) => {
      for (let i = 0; i < arcN; i++) {
        const a = a0 + (a1 - a0) * (i / arcN);
        push(cx + Math.cos(a) * rc, cz + Math.sin(a) * rc, Math.cos(a), Math.sin(a));
      }
    };
    // edge-rounding centres: v1 = side wall / corner wall, v2 = corner wall / back wall (first quadrant)
    const oc = hw + hl - C - rc * Math.SQRT2;
    const v1x = hw - rc, v1z = oc - v1x, v2z = hl - rc, v2x = oc - v2z;
    const D = Math.SQRT1_2, PI = Math.PI, e = rc * D;
    straight(-v2x, hl, v2x, hl, 0, 1, true);
    arc(v2x, v2z, PI / 2, PI / 4);
    straight(v2x + e, v2z + e, v1x + e, v1z + e, D, D, false);
    arc(v1x, v1z, PI / 4, 0);
    straight(hw, v1z, hw, -v1z, 1, 0, false);
    arc(v1x, -v1z, 0, -PI / 4);
    straight(v1x + e, -v1z - e, v2x + e, -v2z - e, D, -D, false);
    arc(v2x, -v2z, -PI / 4, -PI / 2);
    straight(v2x, -hl, -v2x, -hl, 0, -1, true);
    arc(-v2x, -v2z, -PI / 2, -PI * 0.75);
    straight(-v2x - e, -v2z - e, -v1x - e, -v1z - e, -D, -D, false);
    arc(-v1x, -v1z, -PI * 0.75, -PI);
    straight(-hw, -v1z, -hw, v1z, -1, 0, false);
    arc(-v1x, v1z, PI, PI * 0.75);
    straight(-v1x - e, v1z + e, -v2x - e, v2z + e, -D, D, false);
    arc(-v2x, v2z, PI * 0.75, PI / 2);
    // close loop
    pts.push(Object.assign({}, pts[0]));
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      pts[i].len = len;
    }
    return pts;
  }

  // rows: [{d, y, c:[r,g,b,a]}]; colorFn(pt,row) -> [r,g,b,a]
  function sweep(per, rows, colorFn, opts) {
    const pos = [], col = [], uv = [], idx = [];
    const nR = rows.length;
    for (let i = 0; i < per.length; i++) {
      const p = per[i];
      const k = opts.taper ? opts.taper(p) : 1;
      for (let j = 0; j < nR; j++) {
        const r = rows[j];
        const d = (r.taper ? r.d * k : r.d) - (opts.push && p.goal && !r.noPush ? opts.push : 0);
        pos.push(p.x - p.nx * d, r.taper ? r.y * k : r.y, p.z - p.nz * d);
        const c = colorFn(p, r);
        col.push(c[0], c[1], c[2], c[3]);
        uv.push(p.len / (opts.uvScale || 6), r.v != null ? r.v : r.y / (opts.uvScale || 6));
      }
    }
    for (let i = 0; i < per.length - 1; i++) {
      const goalSeg = per[i].goal && per[i + 1].goal;
      for (let j = 0; j < nR - 1; j++) {
        if (goalSeg && opts.goalH != null && rows[j + 1].y <= opts.goalH + 1e-3) continue;
        const a = i * nR + j, b = (i + 1) * nR + j, c = a + 1, d = b + 1;
        idx.push(a, b, c, b, d, c); // (front faces point out of the arena: from inside we see their backs)
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // octagon with 45-degree corners: |x| <= ex, |z| <= ez, |x| + |z| <= sum
  function octShape(ex, ez, sum) {
    const s = new THREE.Shape();
    const cx = sum - ez, cz = sum - ex;
    s.moveTo(-cx, -ez); s.lineTo(cx, -ez); s.lineTo(ex, -cz); s.lineTo(ex, cz);
    s.lineTo(cx, ez); s.lineTo(-cx, ez); s.lineTo(-ex, cz); s.lineTo(-ex, -cz);
    s.closePath();
    return s;
  }

  // ---------- textures ----------
  // Close up, the pitch texture (one picture for the whole field, ~10 cm a pixel) looks blocky, so grass pitches get a
  // fine detail layer: the grass photo tiled every ~3 m (and once more at ~11 m to hide the repeat), brightening and
  // darkening the turf. Very Low uses the single fine layer. All levels: it's one or two texture reads.
  function grassDetail(mat, map, H, low) {
    if (map.floor.type !== 'grass') return;
    const potato = BL.App && BL.App.potato;
    const u = { uDetail: { value: null }, uDetOn: { value: 0 } };
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey();
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDetXZ;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvDetXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vDetXZ;\nuniform sampler2D uDetail;\nuniform float uDetOn;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + [
          'float dA = dot(texture2D(uDetail, vDetXZ / 3.1).rgb, vec3(0.299, 0.587, 0.114));',
          potato ? 'float dB = 0.42;' : 'float dB = dot(texture2D(uDetail, vDetXZ / 11.3 + 0.37).rgb, vec3(0.299, 0.587, 0.114));',
          'diffuseColor.rgb *= 1.0 + uDetOn * ((dA - 0.42) * 0.9 + (dB - 0.42) * 0.45);',
          // mown grass lies one way per stripe, so stripes swap light and dark as you look along them
          potato ? '' : 'diffuseColor.rgb *= 1.0 + uDetOn * 0.12 * sign(sin(vDetXZ.y * 0.6136)) * normalize(vDetXZ - cameraPosition.xz).y;',
        ].join('\n'));
    };
    mat.customProgramCacheKey = () => (prevKey || '') + '+grassdetail' + (potato ? 'p' : '');
    mat.needsUpdate = true;
    const set = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (u.uDetail.value && u.uDetail.value !== t) u.uDetail.value.dispose(); u.uDetail.value = t; u.uDetOn.value = 1; };
    BL.HQ.texture('assets/textures/grass_color.jpg', H, (t) => { if (u.uDetOn.value === 0) set(t); });
    if (!low) BL.HQ.when(() => { const p = BL.HQ.imageFor('field-grass', grassTurn(map)); if (p) BL.HQ.texture(p, H, set); });
  }
  // one 3.5 m tile of pitch turf made exactly the way drawField makes the pitch (photo, multiply tint, 28% turf
  // colour), so the ramp's grass is the same grass as the pitch
  function turfTile(img, map) {
    const S = 256, { c, g } = U.canvas(S, S), f = map.floor;
    g.drawImage(img, 0, 0, S, S);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = U.shade(f.a, 0.55); g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.28; g.fillStyle = f.a; g.fillRect(0, 0, S, S); g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // grass maps take the downloaded grasses in turn, so each pitch looks different
  const grassTurn = (map) => Math.max(0, BL.MAPS.filter((m) => m.floor.type === 'grass').findIndex((m) => m.id === map.id));
  function fieldTexture(map, A, pads) {
    const potato = BL.App && BL.App.potato;
    const T = potato ? 512 : q() === 'high' ? 2048 : 1024;
    const { c, g } = U.canvas(T, T);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    if (BL.App && BL.App.renderer) tex.anisotropy = q() === 'low' ? 2 : Math.min(8, BL.App.renderer.capabilities.getMaxAnisotropy());
    drawField(g, T, map, A, pads, null);
    if (map.floor.type === 'grass') {
      const draw = (path) => {
        const img = new Image();
        img.onload = () => { drawField(g, T, map, A, pads, img); tex.needsUpdate = true; };
        img.src = BL.HQ.url(path);
      };
      draw('assets/textures/grass_color.jpg');
      BL.HQ.when(() => { const p = BL.HQ.imageFor('field-grass', grassTurn(map)); if (p) draw(p); });
    } else if (map.floor.type === 'sand') {
      BL.HQ.when(() => {
        const p = BL.HQ.image('sand');
        if (!p) return;
        const img = new Image();
        img.onload = () => { drawField(g, T, map, A, pads, img); tex.needsUpdate = true; };
        img.src = BL.HQ.url(p);
      });
    }
    return tex;
  }

  function drawField(g, T, map, A, pads, grass) {
    const X = (x) => (x / (2 * A.hw) + 0.5) * T;
    const Z = (z) => (0.5 - z / (2 * A.hl)) * T;
    const sx = T / (2 * A.hw), sz = T / (2 * A.hl);
    const f = map.floor;
    const rnd = U.rng(U.hash(map.id));
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
    g.fillStyle = f.a; g.fillRect(0, 0, T, T);
    if (f.type === 'grass') {
      if (grass) {
        // tile the real grass photo every ~3.5 m, then tint it toward the map's turf color
        const tw = 3.5 * sx, th = 3.5 * sz;
        for (let y = 0; y < T; y += th) for (let x = 0; x < T; x += tw) g.drawImage(grass, x, y, tw + 1, th + 1);
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = U.shade(f.a, 0.55); g.fillRect(0, 0, T, T);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 0.28; g.fillStyle = f.a; g.fillRect(0, 0, T, T); g.globalAlpha = 1;
      } else {
        for (let i = 0; i < T * 6; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'; g.fillRect(rnd() * T, rnd() * T, 1.5, 3); }
      }
      // mowing stripes
      const band = 5.12;
      for (let z = -A.hl, i = 0; z < A.hl; z += band, i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.15)'; g.fillRect(0, Z(z + band), T, band * sz + 1); }
      // and the big chevrons mown toward the middle from each end, like the real pitches
      g.fillStyle = 'rgba(0,0,0,0.08)';
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
        const z0 = sd * (11 + k * 15), z1 = z0 + sd * 15, w = 4.5 * sd;
        g.beginPath(); g.moveTo(X(-A.hw), Z(z1)); g.lineTo(X(0), Z(z0)); g.lineTo(X(A.hw), Z(z1)); g.lineTo(X(A.hw), Z(z1 + w)); g.lineTo(X(0), Z(z0 + w)); g.lineTo(X(-A.hw), Z(z1 + w)); g.closePath(); g.fill();
      }
    } else if (f.type === 'snow') {
      for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(150,180,220,' + (rnd() * 0.12) + ')'; g.fillRect(rnd() * T, rnd() * T, 3, 3); }
    } else if (f.type === 'sand' && grass) {
      // the real sand photo (ripples and all) every ~4 m, warmed toward the map's sand colour
      const tw = 4 * sx, th = 4 * sz;
      for (let y = 0; y < T; y += th) for (let x = 0; x < T; x += tw) g.drawImage(grass, x, y, tw + 1, th + 1);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.35; g.fillStyle = f.a; g.fillRect(0, 0, T, T);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    } else if (f.type === 'sand') {
      for (let i = 0; i < 6000; i++) { g.fillStyle = 'rgba(90,60,20,' + (rnd() * 0.1) + ')'; g.fillRect(rnd() * T, rnd() * T, 2, 2); }
      g.strokeStyle = 'rgba(120,80,30,0.12)'; g.lineWidth = 2;
      for (let z = -A.hl; z < A.hl; z += 2.5) { g.beginPath(); for (let x = -A.hw; x <= A.hw; x += 2) g.lineTo(X(x), Z(z + Math.sin(x * 0.3 + z) * 0.6)); g.stroke(); }
    } else if (f.type === 'neon' || f.type === 'metal') {
      const step = f.type === 'neon' ? 4 : 6;
      g.fillStyle = f.b;
      for (let x = -A.hw, i = 0; x < A.hw; x += step, i++) for (let z = -A.hl, k = 0; z < A.hl; z += step, k++) if ((i + k) % 2) g.fillRect(X(x), Z(z + step), step * sx, step * sz);
      g.strokeStyle = f.type === 'neon' ? 'rgba(0,229,255,0.22)' : 'rgba(0,0,0,0.35)';
      g.lineWidth = f.type === 'neon' ? 2 : 1.5;
      for (let x = -A.hw; x <= A.hw; x += step) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), T); g.stroke(); }
      for (let z = -A.hl; z <= A.hl; z += step) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(T, Z(z)); g.stroke(); }
    } else if (f.type === 'rock') {
      for (let i = 0; i < 3000; i++) { g.fillStyle = 'rgba(0,0,0,' + (rnd() * 0.25) + ')'; g.fillRect(rnd() * T, rnd() * T, 4, 4); }
      g.strokeStyle = 'rgba(255,90,20,0.55)'; g.lineWidth = 2.5; g.shadowColor = '#ff5722'; g.shadowBlur = 8;
      for (let k = 0; k < 40; k++) {
        let x = (rnd() - 0.5) * 2 * A.hw, z = (rnd() - 0.5) * 2 * A.hl;
        g.beginPath(); g.moveTo(X(x), Z(z));
        for (let s2 = 0; s2 < 6; s2++) { x += (rnd() - 0.5) * 8; z += (rnd() - 0.5) * 8; g.lineTo(X(x), Z(z)); }
        g.stroke();
      }
      g.shadowBlur = 0;
    }
    // team-colored ends
    const tint = (col, z0, z1) => {
      const gr = g.createLinearGradient(0, Z(z0), 0, Z(z1));
      gr.addColorStop(0, U.hexA(col, 0.0)); gr.addColorStop(1, U.hexA(col, f.type === 'neon' ? 0.24 : f.type === 'grass' ? 0.1 : 0.2));
      g.fillStyle = gr; g.fillRect(0, Math.min(Z(z0), Z(z1)), T, Math.abs(Z(z1) - Z(z0)));
    };
    tint(BL.TEAM_MAIN[0], -A.hl * 0.2, -A.hl);
    tint(BL.TEAM_MAIN[1], A.hl * 0.2, A.hl);
    // darker turf toward the walls (grass pitches get theirs from the floodlights instead, so the pitch's turf runs
    // on into the ramp's without a dark band at the join)
    const edge = f.type === 'grass' ? 0 : 5;
    if (edge) for (const [x0, y0, x1, y1, w, h] of [[0, 0, edge * sx, 0, edge * sx, T], [T, 0, T - edge * sx, 0, edge * sx, T], [0, 0, 0, edge * sz, T, edge * sz], [0, T, 0, T - edge * sz, T, edge * sz]]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(Math.min(x0, x1), Math.min(y0, y1), w, h);
    }
    // markings
    const lw = Math.max(1.5, 0.17 * sx);
    g.strokeStyle = f.line; g.lineWidth = lw; g.lineCap = 'round';
    if (f.glow) { g.shadowColor = f.line; g.shadowBlur = 10; }
    const inset = A.floorR + 0.6;
    g.beginPath();
    // boundary line follows the 45-degree corner walls
    const ex = A.hw - inset, ez = A.hl - inset, sum = A.hw + A.hl - A.cornerR - inset * Math.SQRT2;
    const cx = sum - ez, cz = sum - ex;
    g.moveTo(X(-cx), Z(-ez)); g.lineTo(X(cx), Z(-ez)); g.lineTo(X(ex), Z(-cz)); g.lineTo(X(ex), Z(cz));
    g.lineTo(X(cx), Z(ez)); g.lineTo(X(-cx), Z(ez)); g.lineTo(X(-ex), Z(cz)); g.lineTo(X(-ex), Z(-cz));
    g.closePath();
    g.stroke();
    g.beginPath(); g.moveTo(X(-ex), Z(0)); g.lineTo(X(ex), Z(0)); g.stroke();
    const cr = 9 * A.sx;
    g.beginPath(); g.ellipse(X(0), Z(0), cr * sx, cr * sz, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(X(0), Z(0), 0.6 * sx, 0.6 * sz, 0, 0, Math.PI * 2); g.fillStyle = f.line; g.fill();
    for (const sd of [-1, 1]) {
      const gz = sd * ez, bw = A.goalHW + 6, bd = 9 * A.sz;
      g.strokeRect(X(-bw), Math.min(Z(gz), Z(gz - sd * bd)), 2 * bw * sx, bd * sz);
      g.beginPath(); g.ellipse(X(0), Z(gz - sd * bd), 6 * sx, 4 * sz, 0, sd > 0 ? 0 : Math.PI, sd > 0 ? Math.PI : Math.PI * 2); g.stroke();
    }
    g.shadowBlur = 0;
    // soft contact shadow under every boost pad
    for (const pd of pads) {
      const r = (pd.big ? 1.9 : 1.35);
      const gr = g.createRadialGradient(X(pd.x), Z(pd.z), 0, X(pd.x), Z(pd.z), r * sx);
      gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(X(pd.x) - r * sx, Z(pd.z) - r * sz, 2 * r * sx, 2 * r * sz);
    }
    // center logo
    g.save();
    g.translate(X(0), Z(0));
    g.scale(sx / sz, 1);
    g.font = '900 ' + Math.round(2.1 * sz) + 'px "Russo One", Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = U.hexA('#ffffff', 0.3);
    g.fillText('ROCKET', 0, -1.7 * sz);
    g.fillText('LEAGUE', 0, 1.7 * sz);
    g.restore();
  }

  // glowing boost-pad faces: small pads are the orange plate with two chevrons; big pads are an amber light in the
  // middle fading out to a bright rim, with rings round a hot core
  function padTexture(big) {
    const S = 256, { c, g } = U.canvas(S, S), m = S / 2;
    if (!big) {
      const gr = g.createRadialGradient(m, m, 4, m, m, m);
      gr.addColorStop(0, '#fff7d6'); gr.addColorStop(0.25, '#ffd36b'); gr.addColorStop(0.6, '#ff9a1f'); gr.addColorStop(0.92, '#c45a00'); gr.addColorStop(1, '#3a1c00');
      g.fillStyle = gr; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 8;
      g.beginPath(); g.arc(m, m, m - 10, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      const chev = (cy, w) => { g.beginPath(); g.moveTo(m - w, cy + w * 0.55); g.lineTo(m, cy - w * 0.25); g.lineTo(m + w, cy + w * 0.55); g.lineTo(m + w, cy + w * 0.9); g.lineTo(m, cy + w * 0.1); g.lineTo(m - w, cy + w * 0.9); g.closePath(); g.fill(); };
      chev(S * 0.38, 46); chev(S * 0.6, 46);
    } else {
      g.fillStyle = '#2a1500'; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.fill();
      const gr = g.createRadialGradient(m, m, 2, m, m, m * 0.95);
      gr.addColorStop(0, '#fffbe6'); gr.addColorStop(0.18, '#ffe08a'); gr.addColorStop(0.45, '#ffb02e'); gr.addColorStop(0.8, '#e86a00'); gr.addColorStop(1, '#5a2600');
      g.fillStyle = gr; g.beginPath(); g.arc(m, m, m * 0.95, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,236,170,0.95)'; g.lineWidth = 5;
      g.beginPath(); g.arc(m, m, m * 0.86, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,220,140,0.55)'; g.lineWidth = 4;
      for (const r of [0.62, 0.42]) { g.beginPath(); g.arc(m, m, m * r, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = 'rgba(255,230,160,0.5)';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.arc(m + Math.cos(a) * m * 0.74, m + Math.sin(a) * m * 0.74, 5, 0, Math.PI * 2); g.fill(); }
    }
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function beamTexture() {
    const { c, g } = U.canvas(8, 128);
    const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,200,90,0.9)'); gr.addColorStop(0.4, 'rgba(255,150,40,0.35)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
    return new THREE.CanvasTexture(c);
  }

  // thin hexagon lines over a faint pane (fill = how much of the pane shows); the pattern repeats exactly at the edges
  function hexTexture(fill, width) {
    const S = 256, { c, g } = U.canvas(S, S);
    g.fillStyle = 'rgba(255,255,255,' + fill + ')'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#ffffff'; g.lineWidth = width;
    // two hexagons across and two rows down a tile
    const rx = S / 4, ry = S / 3, hex = (cx, cy) => {
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(cx + Math.cos(a) * rx * 1.1547, cy + Math.sin(a) * ry * 1.0); }
      g.stroke();
    };
    for (let y = -1; y <= 3; y++) for (let x = -1; x <= 3; x++) hex(x * rx * 2 + (y % 2 ? rx : 0), y * ry * 1.5);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (BL.App && BL.App.renderer) t.anisotropy = q() === 'low' ? 2 : Math.min(8, BL.App.renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function netTexture(color) {
    const S = 128;
    const { c, g } = U.canvas(S, S);
    g.fillStyle = U.hexA(color, 0.18); g.fillRect(0, 0, S, S);
    g.strokeStyle = U.hexA('#ffffff', 0.85); g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * S / 4, 0); g.lineTo(i * S / 4, S); g.stroke(); g.beginPath(); g.moveTo(0, i * S / 4); g.lineTo(S, i * S / 4); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // The stands as the real ones look from the pitch: row upon row of tiny fans, thousands of specks on dark seats, with
  // aisles, walkways between the tiers and the odd empty seat. The light fans take the team colour from the stand's
  // vertex colours (seatTint). One 22 m tile, laid along the stands; the rows run the stand's whole depth.
  function crowdTexture(map) {
    const W = q() === 'low' ? 512 : 1024, H = W / 2, { c, g } = U.canvas(W, H), rnd = U.rng(U.hash(map.id + 'seats'));
    const px = W / 22, py = H / 41, rows = 44, rh = H / rows;
    g.fillStyle = U.shade(map.stands.color, -0.3); g.fillRect(0, 0, W, H);
    const extra = map.stands.crowd;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      // each row of seats a touch lighter than the step in front of it
      g.fillStyle = r % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.14)'; g.fillRect(0, y, W, rh);
      if (r === 15 || r === 30) continue; // walkways between the tiers
      for (let x = rnd() * 6; x < W; x += 0.62 * px) {
        if ((x / W * 6) % 1 < 0.035 || rnd() < 0.1) continue; // aisles and empty seats
        const k = rnd(), lit = 0.72 + rnd() * 0.28;
        g.fillStyle = k < 0.6 ? 'rgb(' + Math.round(235 * lit) + ',' + Math.round(232 * lit) + ',' + Math.round(226 * lit) + ')' : k < 0.82 ? U.shade(U.choice(extra, rnd), -0.15) : k < 0.92 ? '#20242c' : '#d8b48c';
        const w = (0.36 + rnd() * 0.12) * px, h = (0.5 + rnd() * 0.16) * py;
        g.fillRect(x, y + rh - h - 1, w, h);
        // a head on top
        g.fillStyle = k < 0.5 ? '#e0c4a4' : '#8a6a4e'; g.fillRect(x + w * 0.28, y + rh - h - 1 - 0.22 * py, w * 0.44, 0.22 * py);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
    if (BL.App && BL.App.renderer) t.anisotropy = q() === 'low' ? 2 : Math.min(8, BL.App.renderer.capabilities.getMaxAnisotropy());
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // Each stretch of the stands gets its own mapping along its own length, so the fans stay the same size where the stands
  // fan out round the corners (they used to smear into bars). The seams are lost in the crowd.
  function seatUV(geo) {
    const g = geo.toNonIndexed(), P = g.attributes.position, T = g.attributes.uv;
    geo.dispose();
    for (let i = 0; i + 5 < P.count; i += 6) {
      let tx = P.getX(i + 1) - P.getX(i), tz = P.getZ(i + 1) - P.getZ(i);
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      for (let k = 0; k < 6; k++) T.setX(i + k, (P.getX(i + k) * tx + P.getZ(i + k) * tz) / 22);
    }
    g.computeVertexNormals();
    return g;
  }
  // seats: blue end / orange end, blending through the sidelines
  function seatTint(standGeo) {
    const col = standGeo.attributes.color, pos = standGeo.attributes.position;
    const team = [new THREE.Color(BL.TEAM_MAIN[0]), new THREE.Color(BL.TEAM_MAIN[1])], grey = new THREE.Color('#8c919c'), c = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      // (muted like the real stands: the team colours pulled well toward grey)
      c.copy(team[0]).lerp(team[1], U.smoothstep(-10, 10, pos.getZ(i))).lerp(grey, 0.5);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  // The front of the crowd: fans as tiny shaded sprites standing on the stands, a single draw call, so there can be
  // thousands of them; they sway, and bounce on goals (in the shader, no CPU).
  const FAN_V = `attribute vec3 aCol; attribute float aPhase; uniform float uTime; uniform float uJump; uniform float uPx; varying vec3 vC;
    #include <fog_pars_vertex>
    void main() {
      vec3 p = position;
      p.y += abs(sin(uTime * 8.0 + aPhase)) * uJump * 0.8 + sin(uTime * 1.7 + aPhase) * 0.05;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = clamp(uPx * 0.95 / max(0.1, -mvPosition.z), 1.5, 36.0);
      gl_Position = projectionMatrix * mvPosition;
      // depth as if a metre nearer: a fan stands just above its seat, and far across the stadium the depth buffer can
      // barely tell the two apart (the seat used to win, hiding whole sections of the crowd)
      vec4 nearer = projectionMatrix * (mvPosition + vec4(0.0, 0.0, 1.0, 0.0));
      gl_Position.z = nearer.z / nearer.w * gl_Position.w;
      vC = aCol;
      #include <fog_vertex>
    }`;
  const FAN_F = `uniform float uDim; varying vec3 vC;
    #include <fog_pars_fragment>
    void main() {
      vec2 d = gl_PointCoord * 2.0 - 1.0;
      // an egg, wider at the bottom, lit from above
      if (length(vec2(d.x * (1.75 - 0.35 * d.y), d.y)) > 1.0) discard;
      gl_FragColor = vec4(vC * vC * uDim * (0.72 - 0.42 * d.y), 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`;
  function blobCrowd(root, per, A, map, H) {
    const quality = q();
    const potato = BL.App && BL.App.potato;
    // (Low / Very Low get fewer, but still enough to fill the stands: one draw call either way)
    const spacing = potato ? 2.2 : quality === 'low' ? 1.5 : quality === 'high' ? 0.8 : 1.05;
    const rowsN = potato ? 8 : quality === 'low' ? 12 : quality === 'high' ? 26 : 18;
    const rnd = U.rng(U.hash(map.id + 'fans'));
    const push = A.goalD + 3;
    const pos = [], cols = [], phase = [], col = new THREE.Color(), extra = map.stands.crowd;
    // Each row of seats is laid out along its own line round the stadium (the wall's outline pushed out to that row,
    // and back behind the goals like the stands), so the fans are as close together everywhere. (They used to be spaced
    // along the wall: where the stands fan out round a corner, a couple of metres of wall had to fill 15-40 m of
    // seats, and the corners were nearly empty.)
    for (let r = 0; r < rowsN; r++) {
      const k = (r + 0.5) / rowsN, d = U.lerp(ST.d0, ST.d1, k), y = U.lerp(ST.y0, ST.y1, k) + 0.5;
      const row = per.map((p) => { const pd = d + (p.goal ? push : 0); return { x: p.x + p.nx * pd, z: p.z + p.nz * pd, nx: p.nx, nz: p.nz }; });
      let total = 0;
      row[0].len = 0;
      for (let i = 1; i < row.length; i++) { total += Math.hypot(row[i].x - row[i - 1].x, row[i].z - row[i - 1].z); row[i].len = total; }
      let seg = 1;
      for (let L = rnd() * spacing; L < total; L += spacing) {
        while (seg < row.length - 1 && row[seg].len < L) seg++;
        if (rnd() < 0.14) continue; // the odd empty seat
        const a = row[seg - 1], b = row[seg], t = (L - a.len) / Math.max(1e-6, b.len - a.len);
        const x = U.lerp(a.x, b.x, t), z = U.lerp(a.z, b.z, t), j = (rnd() - 0.5) * 0.3;
        pos.push(x + U.lerp(a.nx, b.nx, t) * j + (rnd() - 0.5) * 0.25, y, z + U.lerp(a.nz, b.nz, t) * j);
        // mostly the colour of the team whose end they sit at, some in the arena's colours, a few anything
        const side = z < 0 ? 0 : 1, c = rnd();
        col.set(c < 0.6 ? BL.TEAM_MAIN[side] : c < 0.82 ? U.choice(extra, rnd) : '#' + new THREE.Color().setHSL(rnd(), 0.5, 0.45 + rnd() * 0.3).getHexString());
        cols.push(col.r, col.g, col.b);
        phase.push(rnd() * Math.PI * 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uJump: { value: 0 }, uPx: { value: 600 }, uDim: { value: { day: 1.1, dusk: 0.8, night: 0.5 }[map.time] || 1 } }]),
      vertexShader: FAN_V, fragmentShader: FAN_F, fog: true,
    });
    const fans = new THREE.Points(geo, mat);
    fans.frustumCulled = false;
    root.add(fans);
    const size = new THREE.Vector2();
    H.anim.push((dt, t) => {
      const u = mat.uniforms, j = H.cheer > 0 ? Math.min(1, H.cheer) : 0, app = BL.App;
      u.uTime.value = t; u.uJump.value = U.damp(u.uJump.value, j, 6, dt);
      // a fan's height in pixels at 1 m away, whatever the screen and field of view
      if (app && app.renderer && app.camera) u.uPx.value = app.renderer.getDrawingBufferSize(size).y / (2 * Math.tan((app.camera.fov * Math.PI) / 360));
    });
  }

  // ---------- downloaded high-quality assets (Medium / High only, see js/assets.js) ----------
  // which downloaded sky suits a map: file names say night / dusk / day (untagged skies fit any map);
  // maps of the same time of day take turns, so several skies spread across them
  const SKY_TAGS = [['night', /night|star|moon|space|galaxy|milky/], ['dusk', /dusk|sunset|sunrise|dawn|evening|golden/], ['day', /day|noon|sunny|clear|cloud/]];
  const skyTag = (p) => { const n = p.split('/').pop().toLowerCase(); const t = SKY_TAGS.find((s) => s[1].test(n)); return t ? t[0] : ''; };
  const timeOf = (m) => (m.time === 'night' ? 'night' : m.time === 'dusk' ? 'dusk' : 'day');
  function pickSky(map) {
    const want = timeOf(map);
    // no matching sky (e.g. a dusk map with only day/night photos) keeps the built-in sky
    const pool = BL.HQ.images('sky').filter((p) => skyTag(p) === want || !skyTag(p));
    if (!pool.length) return null;
    const turn = BL.MAPS.filter((m) => timeOf(m) === want).findIndex((m) => m.id === map.id);
    return pool[Math.max(0, turn) % pool.length];
  }
  // sky photo as the background; fog takes the colour of its horizon so the far ground blends in
  function hqSky(scene, H, map) {
    const p = pickSky(map);
    if (!p) return;
    BL.HQ.texture(p, H, (t) => {
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = t;
      H.hqSky = t;
      if (H.sky) H.sky.visible = false;
      try {
        const { c, g } = U.canvas(64, 32);
        g.drawImage(t.image, 0, 0, 64, 32);
        const d = g.getImageData(0, 14, 64, 3).data;
        let r = 0, gg = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        if (scene.fog) scene.fog.color.setRGB(r / n / 255, gg / n / 255, b / n / 255).convertSRGBToLinear();
      } catch (e) { /* keep the map's fog colour */ }
    });
  }
  // Boost pads, one system: Low / Very Low draw the light built-in plates; Medium / High swap the plates for the
  // downloaded pad bases (assets/hq/boost-pads/small*.glb, big*.glb) and sink the built-in glowing discs into
  // their centre recess. The discs (and the big pads' orb / beam / halo) still dim and hide through H.setPad.
  //   P: { smallHide, smallFace, bigHide, bigFace }   (meshes from AR.build)
  const PAD = {
    small: { width: 1.4, disc: 0.17, discY: 0.012, faceR: 0.82, faceH: 0.075 }, // disc = recess radius / width
    big: { width: 2.3, disc: 0.28, discY: 0.095, faceR: 1.02, faceH: 0.21 },
  };
  function hqPads(root, H, P) {
    BL.HQ.when(() => {
      const urls = BL.HQ.models('boost-pads');
      if (!urls.length || H.disposed) return;
      // dark gunmetal like the real pads (light grey read as a white plate in the sun); low metalness so it never
      // turns black without reflections around it
      const mat = new THREE.MeshStandardMaterial({ color: 0x484d55, metalness: 0.25, roughness: 0.5, envMap: BL.Models.envMap || null, envMapIntensity: 0.35 });
      for (const kind of P.kinds) {
        const url = urls.find((p) => new RegExp(kind, 'i').test(p.split('/').pop()));
        const pads = H.pads.filter((p) => p.big === (kind === 'big'));
        if (!url || !pads.length) continue;
        BL.Models.loadGLTF(url, (gltf) => {
          if (H.disposed) return;
          gltf.scene.updateMatrixWorld(true);
          const geos = [];
          gltf.scene.traverse((o) => { if (o.isMesh) geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
          if (!geos.length) return;
          const geo = geos.length > 1 ? THREE.BufferGeometryUtils.mergeBufferGeometries(geos) : geos[0];
          geo.computeBoundingBox();
          const S = PAD[kind], bb = geo.boundingBox, k = S.width / Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z, 0.01);
          geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
          geo.scale(k, k, k);
          geo.computeVertexNormals();
          const base = new THREE.InstancedMesh(geo, mat, pads.length);
          const face = kind === 'big' ? P.bigFace : P.smallFace;
          const fr = (S.disc * S.width) / S.faceR, fh = 0.04 / S.faceH;
          const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new V3(), pv = new V3();
          pads.forEach((p, j) => {
            qq.setFromAxisAngle(_Y, Math.abs(p.x * 7.13 + p.z * 3.7) % (Math.PI * 2));
            base.setMatrixAt(j, m4.compose(pv.set(p.x, 0.003, p.z), qq, sc.set(1, 1, 1)));
            face.setMatrixAt(p.i, m4.compose(pv.set(p.x, S.discY + 0.02, p.z), qq.identity(), sc.set(fr, fh, fr)));
          });
          base.instanceMatrix.needsUpdate = true;
          face.instanceMatrix.needsUpdate = true;
          base.receiveShadow = true;
          base.frustumCulled = false;
          root.add(base);
          (kind === 'big' ? P.bigHide : P.smallHide).forEach((m) => { m.visible = false; });
        }, () => {});
      }
    });
  }
  // DFH-Stadium touches (Medium / High): each end's seats lean to that team's colour, a lit metal roof
  // (takes the downloaded metal maps), and floodlight banks along the roof edge aimed at the pitch
  // the roof's steel lattice: beams round each bay and a cross brace, the rest see-through (alpha tested)
  function latticeTexture() {
    const { c, g } = U.canvas(128, 128);
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.strokeRect(0, 0, 128, 128);
    g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.moveTo(64, 0); g.lineTo(64, 128); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // a row of floodlight panels: bright cells in a dark frame
  function panelTexture(warm) {
    const { c, g } = U.canvas(64, 32);
    g.fillStyle = '#1b1e24'; g.fillRect(0, 0, 64, 32);
    const gr = g.createLinearGradient(0, 4, 0, 28);
    gr.addColorStop(0, warm ? '#fff3d6' : '#ffffff'); gr.addColorStop(1, warm ? '#ffd9a0' : '#dfe9ff');
    g.fillStyle = gr;
    for (let i = 0; i < 4; i++) g.fillRect(3 + i * 15.5, 5, 12, 22);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function bulbTexture() {
    const { c, g } = U.canvas(256, 128);
    g.fillStyle = '#2a2d33'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#15171b'; g.fillRect(6, 6, 244, 116);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 7; x++) {
        const cx = 22 + x * 35, cy = 26 + y * 38, gr = g.createRadialGradient(cx, cy, 2, cx, cy, 15);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#fff4d6'); gr.addColorStop(1, 'rgba(255,230,180,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function dfhStadium(root, H, sPer, map, roofMesh) {
    // roof: lit brushed metal instead of flat colour
    const roof = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.45, envMap: BL.Models.envMap || null, envMapIntensity: 0.6, alphaMap: roofMesh.material.alphaMap, alphaTest: 0.5 });
    Object.assign(roof, H.metalMaps || {});
    if (H.metalMats) H.metalMats.push(roof);
    roofMesh.material.dispose();
    roofMesh.material = roof;
    // floodlight banks + glare
    const night = map.time !== 'day', n = 16;
    const tex = bulbTexture();
    H.disposables.push(tex);
    const banks = new THREE.InstancedMesh(new THREE.PlaneGeometry(6, 2.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }), n);
    const glarePos = new Float32Array(n * 3), dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const p = sPer[Math.floor(((i + 0.5) / n) * (sPer.length - 1))];
      const pd = ROOF.d + 0.6;
      dummy.position.set(p.x + p.nx * pd, ROOF.y - 3.4, p.z + p.nz * pd);
      dummy.lookAt(0, 0, 0);
      dummy.updateMatrix();
      banks.setMatrixAt(i, dummy.matrix);
      glarePos.set([dummy.position.x - p.nx * 0.4, dummy.position.y, dummy.position.z - p.nz * 0.4], i * 3);
    }
    root.add(banks);
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(glarePos, 3));
    const gMat = new THREE.PointsMaterial({ color: night ? 0xfff1d0 : 0xffffff, size: night ? 9 : 6, sizeAttenuation: true, transparent: true, opacity: night ? 0.7 : 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const img = new Image();
    img.onload = () => { if (H.disposed) return; gMat.map = new THREE.Texture(img); gMat.map.needsUpdate = true; gMat.needsUpdate = true; H.disposables.push(gMat.map); };
    img.src = BL.HQ.url('assets/kenney-particles/light_01.png');
    const glare = new THREE.Points(gGeo, gMat);
    glare.frustumCulled = false;
    root.add(glare);
  }
  // downloaded metal texture (assets/hq/metal/: colour + optional normal / roughness / metalness maps)
  function hqMetal(H, mats) {
    // materials made later (the downloaded pad plates) join H.metalMats and copy H.metalMaps
    H.metalMats = mats; H.metalMaps = {};
    BL.HQ.when(() => {
      const files = BL.HQ.list('metal'), col = BL.HQ.image('metal');
      if (!col || H.disposed) return;
      const pick = (rx) => files.find((p) => rx.test(p.split('/').pop()));
      const apply = (path, key, linear) => path && BL.HQ.texture(path, H, (t) => { H.metalMaps[key] = t; for (const m of H.metalMats) { m[key] = t; m.needsUpdate = true; } }, linear);
      apply(col, 'map');
      apply(pick(/normal(gl)?\.|_nor_gl/i), 'normalMap', true);
      apply(pick(/rough/i), 'roughnessMap', true);
      apply(pick(/metalness|metallic/i), 'metalnessMap', true);
    });
  }
  // tiling texture on the land around the stadium (about one repeat every 8 m)
  function hqOutside(scene, outer, H, map) {
    BL.HQ.when(() => {
      if (H.disposed) return;
      // (themed arenas, under the sea or in a storm, keep their own sky)
      if (!map.themed) hqSky(scene, H, map);
      // the land around the stadium: grass maps sit in a meadow (another of the downloaded grasses), the rest on the
      // downloaded ground (dirt); snow and space keep their own
      const meadow = map.floor.type === 'grass' && BL.HQ.images('field-grass').length > 1;
      const desert = map.floor.type === 'sand' && !!BL.HQ.image('sand');
      const p = map.floor.type === 'snow' || map.id === 'starbase' ? null : meadow ? BL.HQ.imageFor('field-grass', grassTurn(map) + 1) : desert ? BL.HQ.image('sand') : BL.HQ.imageFor('ground-outside', map.id);
      if (!p) return;
      BL.HQ.texture(p, H, (t) => {
        t.repeat.set(1800 / 8, 1800 / 8);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1, metalness: 0 });
        const np = meadow ? null : BL.HQ.normal(desert ? 'sand' : 'ground-outside');
        if (np) BL.HQ.texture(np, H, (n) => { n.repeat.copy(t.repeat); m.normalMap = n; m.needsUpdate = true; }, true);
        outer.material.dispose();
        outer.material = m;
      });
    });
  }

  // flatten a (possibly rigged) model into plain geometries per material, posed and scaled to height h
  function bakeModel(gltf, h) {
    const scene = gltf.scene;
    const clips = gltf.animations || [];
    if (clips.length) {
      // rigged characters: freeze a natural frame of a cheering/idle clip instead of the T-pose
      const clip = clips.find((c) => /cheer|clap|wave|jump|dance|idle|sit/i.test(c.name)) || clips[0];
      const mixer = new THREE.AnimationMixer(scene);
      mixer.clipAction(clip).play();
      mixer.update(Math.min(0.4, clip.duration * 0.3));
    }
    scene.updateMatrixWorld(true);
    const out = [];
    const v = new V3();
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const src = o.geometry;
      const g = new THREE.BufferGeometry();
      const pos = src.attributes.position, n = pos.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i);
        if (o.isSkinnedMesh && o.boneTransform) o.boneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      }
      g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv.clone());
      if (src.attributes.color) g.setAttribute('color', src.attributes.color.clone());
      if (src.index) g.setIndex(src.index.clone());
      g.computeVertexNormals();
      out.push({ geo: g, mat: Array.isArray(o.material) ? o.material[0] : o.material });
    });
    const box = new THREE.Box3();
    for (const m of out) { m.geo.computeBoundingBox(); box.union(m.geo.boundingBox); }
    const k = h / Math.max(0.01, box.max.y - box.min.y);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    let tris = 0;
    for (const m of out) {
      m.geo.translate(-cx, -box.min.y, -cz);
      m.geo.scale(k, k, k);
      tris += (m.geo.index ? m.geo.index.count : m.geo.attributes.position.count) / 3;
    }
    return { parts: out, tris };
  }

  // downloaded people take over the nearest rows of blob seats, within a triangle budget
  // downloaded scenery scattered around the outside of the stadium
  function hqScenery(root, H, map) {
    if (map.themed) return; // (the sea floor and the docks have their own scenery)
    // a folder or file name with "night" / "day" in it only goes around maps of that time; city maps count as
    // night here, so their skylines get the lit buildings too
    const time = map.time === 'night' || map.decor === 'city' ? 'night' : 'day';
    const urls = BL.HQ.models('scenery').filter((u) => { const t = /night/i.test(u) ? 'night' : /(^|[^a-z])day/i.test(u) ? 'day' : ''; return !t || t === time; });
    if (!urls.length || H.disposed) return;
    const rnd = U.rng(91);
    const count = q() === 'high' ? 24 : 12;
    for (const url of urls) {
      BL.Models.loadGLTF(url, (gltf) => {
        if (H.disposed) return;
        gltf.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const h0 = box.max.y - box.min.y;
        // models already in metres keep their size; tiny (Kenney-style) or cm-scale ones become ~14 m
        const list = [];
        for (let i = 0; i < count; i++) {
          const a = rnd() * Math.PI * 2, r = RING_PUSH + 105 + rnd() * 300;
          const h = h0 >= 3 && h0 <= 200 ? h0 * (0.85 + rnd() * 0.3) : 10 + rnd() * 8;
          list.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: rnd() * Math.PI * 2, h });
        }
        addInstanced(root, gltf, list, {}, false, { time: 'day' });
      });
    }
  }

  function adTexture(map) {
    const W = 512, Hh = 64;
    const { c, g } = U.canvas(W, Hh);
    const gr = g.createLinearGradient(0, 0, 0, Hh);
    gr.addColorStop(0, '#0d1428'); gr.addColorStop(1, '#05070f');
    g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    const words = ['ROCKET LEAGUE', 'SUPERSONIC', 'BOOST', map.name.toUpperCase()];
    g.font = '900 30px "Russo One", Arial'; g.textBaseline = 'middle';
    let x = 10;
    for (let i = 0; i < 4; i++) {
      const col = i % 2 ? BL.TEAM_MAIN[1] : BL.TEAM_MAIN[0];
      g.shadowColor = col; g.shadowBlur = 10;
      g.fillStyle = i === 3 ? '#ffffff' : col;
      g.fillText(words[i], x, Hh / 2 + 2);
      x += g.measureText(words[i]).width + 34;
    }
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < Hh; y += 3) g.fillRect(0, y, W, 1);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function windowTexture(night) {
    const { c, g } = U.canvas(64, 128);
    g.fillStyle = night ? '#0a0a14' : '#56606e'; g.fillRect(0, 0, 64, 128);
    const rnd = U.rng(77);
    for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) {
      const lit = rnd() < (night ? 0.45 : 0.3);
      g.fillStyle = lit ? (night ? U.choice(['#ffe082', '#80d8ff', '#ff80ab', '#b388ff'], rnd) : '#cfe3f5') : (night ? '#111522' : '#3c4450');
      g.fillRect(x, y, 5, 5);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ---------- sky traffic ----------
  // Planes crossing the sky high over the stadium (park, city, desert and snow arenas): a white contrail streaming
  // behind them by day, blinking red / green / white lights at night. Over the space arena, starships with blue
  // engine trails. Each crosses in a straight line, then another comes over from a new direction a few seconds later.
  // The trail is a fading ribbon fixed to the plane (no per-frame geometry), so it costs almost nothing.
  function skyTraffic(root, H, map, low) {
    if (map.decor === 'volcano' || map.labs || map.themed) return;
    const ship = map.decor === 'space', night = map.time === 'night';
    const rnd = U.rng(U.hash(map.id + 'planes'));
    const n = low ? 1 : 2, SEG = low ? 10 : 18, TRAIL = ship ? 90 : night ? 60 : 220;
    const bodyMat = new THREE.MeshLambertMaterial({ color: ship ? 0x9fb3d9 : 0xf2f4f8, emissive: night || ship ? 0x1a1d26 : 0x000000 });
    const darkMat = new THREE.MeshLambertMaterial({ color: ship ? 0x30384a : 0x9aa3ad });
    // the trail: a flat ribbon running back from the tail, widening and fading (vertex alpha)
    const trailGeo = (() => {
      const pos = [], colA = [], idx = [], c = new THREE.Color(ship ? '#7fd4ff' : night ? '#c9d6ff' : '#ffffff');
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG, w = (ship ? 1.2 : 1.6) + t * (ship ? 3 : 9), a = (ship ? 0.9 : night ? 0.25 : 0.75) * Math.pow(1 - t, 1.4);
        pos.push(-w, 0, -t * TRAIL, w, 0, -t * TRAIL);
        colA.push(c.r, c.g, c.b, a, c.r, c.g, c.b, a);
        if (i < SEG) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 4));
      g.setIndex(idx);
      return g;
    })();
    const trailMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: ship ? THREE.AdditiveBlending : THREE.NormalBlending });
    const lightMat = (col) => new THREE.MeshBasicMaterial({ color: new THREE.Color(col), fog: false });
    const planes = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      if (ship) {
        const hull = new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 8), bodyMat); hull.rotation.x = Math.PI / 2; g.add(hull);
        for (const sx of [-1, 1]) { const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 7, 8), darkMat); pod.rotation.x = Math.PI / 2; pod.position.set(sx * 3.4, 0, -3); g.add(pod); }
        const glow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), lightMat('#7fd4ff')); glow.position.z = -8; g.add(glow);
      } else {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 18, low ? 6 : 10), bodyMat); body.rotation.x = Math.PI / 2; g.add(body);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(1.1, low ? 6 : 10, 6), bodyMat); nose.position.z = 9; g.add(nose);
        const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 3.4), bodyMat); wing.position.z = 0.5; g.add(wing);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 1.8), bodyMat); tail.position.z = -8; g.add(tail);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 2.4), darkMat); fin.position.set(0, 1.8, -8); g.add(fin);
        // navigation lights: red left wingtip, green right, a white strobe (all brighter at night)
        const navL = new THREE.Mesh(new THREE.SphereGeometry(night ? 0.9 : 0.4, 6, 4), lightMat('#ff2a2a')); navL.position.set(-11, 0, 0.5); g.add(navL);
        const navR = new THREE.Mesh(new THREE.SphereGeometry(night ? 0.9 : 0.4, 6, 4), lightMat('#2aff5a')); navR.position.set(11, 0, 0.5); g.add(navR);
        const strobe = new THREE.Mesh(new THREE.SphereGeometry(night ? 1.1 : 0.5, 6, 4), lightMat('#ffffff')); strobe.position.set(0, -1.2, 0); g.add(strobe);
        g.userData.strobe = strobe;
      }
      const trail = new THREE.Mesh(trailGeo, trailMat); trail.position.z = ship ? -8 : -9; g.add(trail);
      g.visible = false;
      root.add(g);
      H.live.push(g);
      planes.push({ g, t: 0, wait: 2 + i * 9 + rnd() * 6, speed: ship ? 90 : 55, from: new V3(), dir: new V3(), len: 1300 });
    }
    const start = (p) => {
      // a straight pass over (or near) the stadium, from one side of the sky to the other
      const a = rnd() * Math.PI * 2, off = (rnd() - 0.5) * 360, h = ship ? 110 + rnd() * 60 : 150 + rnd() * 70;
      p.dir.set(Math.cos(a), 0, Math.sin(a));
      p.from.set(-p.dir.x * p.len / 2 - p.dir.z * off, h, -p.dir.z * p.len / 2 + p.dir.x * off);
      p.t = 0; p.g.visible = true;
      p.g.position.copy(p.from);
      p.g.lookAt(p.from.x + p.dir.x, h, p.from.z + p.dir.z);
    };
    H.anim.push((dt, time) => {
      for (const p of planes) {
        if (!p.g.visible) { p.wait -= dt; if (p.wait <= 0) start(p); continue; }
        p.t += dt * p.speed;
        p.g.position.copy(p.from).addScaledVector(p.dir, p.t);
        if (p.g.userData.strobe) p.g.userData.strobe.visible = (time * 1.1) % 1 < 0.12;
        if (p.t > p.len) { p.g.visible = false; p.wait = 4 + rnd() * 14; }
      }
    });
    H.planes = planes;
    H.disposables.push(trailGeo, trailMat, bodyMat, darkMat);
  }

  // ---------- the end-of-match podium stage ----------
  // A round two-tier stage at centre field (a raised spot for the MVP), its rims glowing in the winning team's colour,
  // with an arched lighting truss behind it whose spotlights shine down on the cars. Built when the podium starts and
  // removed after; Very Low leaves out the truss.
  AR.podiumStage = function (scene, color, mvpX, width) {
    const low = q() === 'low', potato = BL.App && BL.App.potato, seg = low ? 32 : 64;
    const g = new THREE.Group(), team = new THREE.Color(color), mats = [], geos = [];
    const mk = (geo, mat) => { geos.push(geo); return new THREE.Mesh(geo, mat); };
    const side = litMat({ color: 0x191c23, roughness: 0.4, metalness: 0.55 }, low), top = litMat({ color: 0x4a5162, roughness: 0.2, metalness: 0.35 }, low);
    const glow = new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(low ? 1 : 2.2) });
    const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(low ? 1 : 2.4, low ? 1 : 2.35, low ? 1 : 2.2) });
    mats.push(side, top, glow, white);
    const R = Math.max(5, width / 2 + 2.4), H1 = 0.5, H2 = 0.35, r2 = 2.1;
    const base = mk(new THREE.CylinderGeometry(R, R + 0.35, H1, seg), [side, top, side]); base.position.y = H1 / 2; base.receiveShadow = true; g.add(base);
    const ring = (r, y) => { const t = mk(new THREE.TorusGeometry(r, 0.06, 6, seg), glow); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); };
    ring(R + 0.01, H1); ring(R + 0.36, 0.05); ring(R * 0.62, H1 + 0.005);
    const mvp = mk(new THREE.CylinderGeometry(r2, r2 + 0.15, H2, seg), [side, top, side]); mvp.position.set(mvpX, H1 + H2 / 2, 0); mvp.receiveShadow = true; g.add(mvp);
    const mr = mk(new THREE.TorusGeometry(r2 + 0.01, 0.05, 6, seg), glow); mr.rotation.x = Math.PI / 2; mr.position.set(mvpX, H1 + H2, 0); g.add(mr);
    if (!potato) {
      // the truss: two towers and a beam behind the stage, lamps along the beam with soft beams of light
      const steel = litMat({ color: 0x3a3f4a, roughness: 0.5, metalness: 0.6 }, low); mats.push(steel);
      const zB = -R * 0.75, hB = 9, xB = R + 1.6;
      for (const sx of [-1, 1]) { const t = mk(new THREE.BoxGeometry(0.6, hB, 0.6), steel); t.position.set(sx * xB, hB / 2, zB); g.add(t); }
      const beam = mk(new THREE.BoxGeometry(xB * 2 + 0.6, 0.6, 0.6), steel); beam.position.set(0, hB, zB); g.add(beam);
      const cone = new THREE.MeshBasicMaterial({ color: team.clone().lerp(new THREE.Color(1, 1, 1), 0.35), transparent: true, opacity: low ? 0.025 : 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      mats.push(cone);
      const nL = low ? 3 : 5;
      for (let i = 0; i < nL; i++) {
        const x = (i / (nL - 1) - 0.5) * xB * 1.6, lamp = mk(new THREE.BoxGeometry(0.7, 0.45, 0.5), white);
        lamp.position.set(x, hB - 0.5, zB + 0.2); g.add(lamp);
        const from = new V3(x, hB - 0.7, zB + 0.2), to = new V3(x * 0.4, H1, 0.6), len = from.distanceTo(to);
        const cg = new THREE.CylinderGeometry(0.25, 2.1, len, 18, 1, true); cg.translate(0, -len / 2, 0);
        const c = mk(cg, cone); c.position.copy(from); c.quaternion.setFromUnitVectors(new V3(0, -1, 0), to.clone().sub(from).normalize()); c.renderOrder = 3; g.add(c);
      }
    }
    scene.add(g);
    return { group: g, R, lift: H1, mvpLift: H1 + H2,
      dispose() { if (g.parent) g.parent.remove(g); geos.forEach((x) => x.dispose()); mats.forEach((m) => m.dispose()); } };
  };

  // ---------- build ----------
  AR.build = function (scene, map, pads) {
    const A = BL.Physics.arena;
    const root = new THREE.Group();
    scene.add(root);
    const H = { group: root, pads: [], anim: [], disposables: [], live: [] };
    const low = q() === 'low', high = q() === 'high';
    const L = map.light;
    // how the real arenas are lit (from the user's clips): a dark, contrasty bowl with the pitch floodlit and the
    // stands sitting back in the gloom; less fill light at dusk and at night so shadows and light pools read
    // (night: the pitch is the bright thing. Full exposure and a little more ambient so the cars read, the stands
    // and the crowd dimmer still, and the floodlights below do the lighting)
    const MOOD = { day: { exp: 1.0, hemi: 0.72, stands: 0.8 }, dusk: { exp: 0.95, hemi: 0.68, stands: 0.62 }, night: { exp: 0.95, hemi: 0.56, stands: 0.4 } }[map.time] || { exp: 1, hemi: 1, stands: 1 };
    H.mood = MOOD;

    // sky + fog
    // (more haze than before: in the real arenas the far end of the pitch and the stands fade toward blue-grey)
    scene.fog = new THREE.FogExp2(new THREE.Color(map.fog), map.fogDensity * (low ? 1.2 : 1) * ({ day: 1.9, dusk: 1.45, night: 1.0 }[map.time] || 1));
    // (a lower sun than straight overhead: longer shadows and more shape, like the real arenas)
    const sunDir = new V3(L.sunDir[0], L.sunDir[1] * 0.72, L.sunDir[2]).normalize();
    const plainSky = BL.App && BL.App.potato;
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(map.sky[0]) }, bottom: { value: new THREE.Color(map.sky[1]) }, sunDir: { value: sunDir }, sunCol: { value: new THREE.Color(L.sun) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      // a deep gradient, a bright hazy band along the horizon, soft high cloud (not on Very Low) and a glowing sun
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vD;
        ${plainSky ? '' : `float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hs(i), hs(i + vec2(1.0, 0.0)), f.x), mix(hs(i + vec2(0.0, 1.0)), hs(i + vec2(1.0, 1.0)), f.x), f.y); }`}
        void main() {
          vec3 d = normalize(vD);
          float h = d.y, s = max(dot(d, sunDir), 0.0);
          vec3 c = mix(bottom, top, pow(smoothstep(-0.03, 0.62, h), 0.75));
          c = mix(c, bottom * 1.12, exp(-max(h, 0.0) * 16.0) * 0.55);
          ${plainSky ? '' : `vec2 cp = d.xz / (h + 0.18) * 1.6;
          float cl = vn(cp) * 0.55 + vn(cp * 2.1 + 3.1) * 0.28 + vn(cp * 4.3 + 7.7) * 0.17;
          c = mix(c, mix(bottom, vec3(1.0), 0.6) + sunCol * 0.12, smoothstep(0.52, 0.8, cl) * smoothstep(0.0, 0.2, h) * 0.55);`}
          c += sunCol * (pow(s, 900.0) * 2.5 + pow(s, 60.0) * 0.4 + pow(s, 6.0) * 0.16);
          gl_FragColor = linearToOutputTexel(vec4(c, 1.0));
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 24, 12), skyMat);
    sky.renderOrder = -10;
    root.add(sky);
    H.sky = sky;
    H.live.push(sky);

    // lights
    const hemi = new THREE.HemisphereLight(new THREE.Color(L.hemiSky), new THREE.Color(L.hemiGround), L.hemiI * MOOD.hemi);
    root.add(hemi);
    const sun = new THREE.DirectionalLight(new THREE.Color(L.sun), L.sunI);
    sun.position.copy(sunDir).multiplyScalar(120);
    root.add(sun);
    // night: the floodlights light the pitch from high over the stands. A strong warm key from one side and a cooler,
    // weaker one from the other, so every car has a lit side and a rim and the pitch glows under them (two extra
    // lights, a few sums per pixel on every level); on High the key casts the shadows instead of the moon.
    let shadowLight = sun;
    if (map.time === 'night') {
      const flood = new THREE.DirectionalLight(new THREE.Color('#fff1d8'), 1.25);
      flood.position.set(42, 120, -34);
      root.add(flood); root.add(flood.target);
      const flood2 = new THREE.DirectionalLight(new THREE.Color('#d9e6ff'), 0.55);
      flood2.position.set(-48, 100, 38);
      root.add(flood2); root.add(flood2.target);
      H.flood = flood;
      shadowLight = flood;
    }
    root.add(sun.target);
    if (high) {
      shadowLight.castShadow = true;
      shadowLight.shadow.mapSize.set(2048, 2048);
      const sc = shadowLight.shadow.camera;
      sc.left = -A.hw - 10; sc.right = A.hw + 10; sc.top = A.hl + 12; sc.bottom = -A.hl - 12; sc.near = 10; sc.far = 300;
      shadowLight.shadow.bias = -0.0008;
    }
    H.sun = sun;
    const fill = new THREE.DirectionalLight(new THREE.Color(L.hemiSky), 0.25);
    fill.position.set(-sunDir.x * 100, 60, -sunDir.z * 100);
    root.add(fill);
    // (weather reaches these: lightning lights up the whole arena for a moment)
    H.hemi = hemi; H.fill = fill;

    // floor
    const fieldTex = fieldTexture(map, A, pads);
    H.disposables.push(fieldTex);
    // (a map can set its own shine: Storm Harbor's wet pitch catches the floodlights)
    const floorMat = litMat({ map: fieldTex, roughness: map.floor.rough != null ? map.floor.rough : map.floor.type === 'metal' ? 0.5 : 0.92, metalness: map.floor.metal != null ? map.floor.metal : map.floor.type === 'metal' ? 0.4 : 0 });
    // floodlit pitch on every level (a few sums in the floor's shader): pools of light, darker toward the walls
    if (BL.Ambience) BL.Ambience.floor(floorMat, A, map, H);
    grassDetail(floorMat, map, H, low);
    // the ramp shrinks to nothing beside each goal mouth (same as the physics), so the posts have no hard edge
    const rampTaper = (p) => (Math.abs(p.nz) > 0.9 ? U.smoothstep(A.goalHW, A.goalHW + A.goalTaper, Math.abs(p.x)) : 1);
    // fan from the center through the wall's own perimeter samples (inset by the ramp radius)
    const fper = perimeter(A.hw, A.hl, A.cornerR, A.goalHW);
    const fpos = [0, 0, 0], fidx = [];
    for (let i = 0; i < fper.length; i++) { const p = fper[i], d = A.floorR * rampTaper(p); fpos.push(p.x - p.nx * d, 0, p.z - p.nz * d); }
    for (let j = 0; j < fper.length - 1; j++) fidx.push(0, j + 1, j + 2);
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((fpos.length / 3) * 2), 2));
    fgeo.setIndex(fidx);
    fgeo.computeVertexNormals();
    const setFieldUV = (geo) => {
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * A.hw) + 0.5, p.getZ(i) / (2 * A.hl) + 0.5);
      uv.needsUpdate = true;
    };
    setFieldUV(fgeo);
    const floor = new THREE.Mesh(fgeo, floorMat);
    floor.receiveShadow = true;
    root.add(floor);

    // ramp (opaque, lit)
    const per = perimeter(A.hw, A.hl, A.cornerR, A.goalHW);
    const teamCol = [new THREE.Color(BL.TEAM_MAIN[0]), new THREE.Color(BL.TEAM_MAIN[1])];
    const neutral = new THREE.Color(map.wall.base);
    const tcol = new THREE.Color();
    const tintAt = (z, strength) => {
      const t = U.clamp(Math.abs(z) / A.hl, 0, 1);
      tcol.copy(neutral).lerp(teamCol[z < 0 ? 0 : 1], Math.min(1, Math.pow(t, 1.3) * strength));
      return tcol;
    };
    const rampRows = [];
    const nF = low ? 5 : 8;
    for (let k = 0; k <= nF; k++) { const th = (k / nF) * Math.PI / 2; rampRows.push({ d: A.floorR - A.floorR * Math.sin(th), y: A.floorR - A.floorR * Math.cos(th), taper: true }); }
    // The curved ramp: on grass maps it's the pitch's own turf (same photo, same tint, same fine detail and as dark
    // as the pitch's floodlit edge), so the grass carries on up the curve instead of looking like a separate layer
    // under the pitch; it tints a touch toward the team colour as it rises. Other floors keep a tinted turf colour.
    const turf = new THREE.Color(map.floor.a), grassy = map.floor.type === 'grass', edgeK = low ? 1 : 0.8;
    const rampGeo = sweep(per, rampRows, (p, r) => {
      const up = r.y / A.floorR;
      // (the pitch's team-coloured ends carry on into the ramp too)
      const c = grassy ? new THREE.Color(edgeK, edgeK, edgeK).lerp(teamCol[p.z < 0 ? 0 : 1], 0.08 * U.clamp((Math.abs(p.z) - 0.2 * A.hl) / (0.8 * A.hl), 0, 1)).lerp(tintAt(p.z, 1), 0.12 * up)
        : turf.clone().lerp(tintAt(p.z, 1), 0.08 + 0.22 * up).multiplyScalar(0.82 - 0.12 * up);
      return [c.r, c.g, c.b, 1];
    }, { goalH: A.goalH, uvScale: 3.5, taper: rampTaper });
    // one-sided (sweep winds its faces outward, so the inside is the back): when the ball cam sits behind the wall,
    // like the real game you see through the wall and ramp onto the pitch instead of their dark backs
    const rampMat = litMat({ vertexColors: true, roughness: 0.92, side: THREE.BackSide });
    if (grassy) {
      let hqRamp = false;
      const setRamp = (path, hq) => {
        const img = new Image();
        img.onload = () => {
          if (H.disposed || (hqRamp && !hq)) return;
          if (hq) hqRamp = true;
          if (rampMat.map) rampMat.map.dispose();
          rampMat.map = turfTile(img, map); rampMat.needsUpdate = true;
        };
        img.src = BL.HQ.url(path);
      };
      setRamp('assets/textures/grass_color.jpg', false);
      BL.HQ.when(() => { const p = BL.HQ.imageFor('field-grass', grassTurn(map)); if (p) setRamp(p, true); });
      if (BL.Ambience) BL.Ambience.turf(rampMat, map);
      grassDetail(rampMat, map, H, low);
      H.disposables.push({ dispose: () => rampMat.map && rampMat.map.dispose() });
    } else if (map.floor.type === 'sand') {
      BL.HQ.when(() => { const p = BL.HQ.image('sand'); if (p) BL.HQ.texture(p, H, (t) => { t.repeat.set(0.6, 0.6); if (rampMat.map) rampMat.map.dispose(); rampMat.map = t; rampMat.color.setScalar(1.5); rampMat.needsUpdate = true; }); });
    }
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.receiveShadow = true;
    root.add(ramp);

    // glow strip on top of the ramp
    const glowRows = [{ d: 0, y: A.floorR, taper: true }, { d: 0, y: A.floorR + 0.35 }];
    const glowGeo = sweep(per, glowRows, (p) => { const c = Math.abs(p.z) < A.hl * 0.35 ? tcol.set('#ffffff') : tintAt(p.z, 1.6); return [c.r, c.g, c.b, 1]; }, { goalH: A.goalH, taper: rampTaper });
    root.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

    // glass walls
    const glassRows = [{ d: 0, y: A.floorR + 0.35 }];
    const steps = Math.max(2, Math.round((A.h - A.ceilR - A.floorR) / 4));
    for (let i = 1; i <= steps; i++) {
      const y = A.floorR + 0.35 + (A.h - A.ceilR - A.floorR - 0.35) * (i / steps);
      if (glassRows[glassRows.length - 1].y < A.goalH && y > A.goalH) glassRows.push({ d: 0, y: A.goalH });
      glassRows.push({ d: 0, y });
    }
    const nC = low ? 4 : 6;
    for (let k = 1; k <= nC; k++) { const th = (k / nC) * Math.PI / 2; glassRows.push({ d: A.ceilR - A.ceilR * Math.cos(th), y: A.h - A.ceilR + A.ceilR * Math.sin(th) }); }
    const hexTex = hexTexture(0.16, 3);
    H.disposables.push(hexTex);
    const glassGeo = sweep(per, glassRows, (p, r) => {
      const c = tintAt(p.z, 1);
      // like the real walls: there near the bottom, fading to nearly clear higher up (it used to hang over the
      // stands as a strong tinted honeycomb)
      const a = map.wall.alpha * (r.y < A.goalH + 1 ? 1.05 : 1) * (1 - 0.6 * U.smoothstep(A.goalH, A.h - A.ceilR, r.y)) * 1.5;
      return [c.r, c.g, c.b, a];
    }, { goalH: A.goalH, uvScale: 9 });
    const glassMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, map: hexTex });
    if (!low && BL.Ambience) BL.Ambience.glass(glassMat, H);
    // Medium / High: the wall glass reflects the downloaded environment photo (assets/hq/glass)
    if (!low) BL.HQ.when(() => {
      const p = BL.HQ.image('glass');
      if (!p || H.disposed) return;
      BL.HQ.texture(p, H, (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        glassMat.envMap = t; glassMat.combine = THREE.AddOperation; glassMat.reflectivity = map.time === 'day' ? 0.12 : 0.08;
        glassMat.needsUpdate = true;
      });
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.renderOrder = 2;
    root.add(glass);
    if (!low) {
      const ceil = new THREE.ShapeGeometry(octShape(A.hw - A.ceilR, A.hl - A.ceilR, A.hw + A.hl - A.cornerR - A.ceilR * Math.SQRT2), 8);
      ceil.rotateX(Math.PI / 2); ceil.translate(0, A.h, 0);
      const cu = ceil.attributes.uv, cp = ceil.attributes.position;
      for (let i = 0; i < cp.count; i++) cu.setXY(i, cp.getX(i) / 9, cp.getZ(i) / 9);
      const cm = new THREE.MeshBasicMaterial({ color: neutral, map: hexTex, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
      const cmesh = new THREE.Mesh(ceil, cm); cmesh.renderOrder = 2; root.add(cmesh);
    }

    // goals
    H.goals = [];
    for (const team of [0, 1]) {
      const s = team === 0 ? -1 : 1;
      const colr = BL.TEAM_MAIN[team];
      const g = new THREE.Group();
      const netTex = netTexture(colr);
      H.disposables.push(netTex);
      const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const shell = goalShell(A, s, low);
      // a dark team-tinted shell behind the net: the goal's roof and side walls read as solid, like the real goal
      const shadeMesh = new THREE.Mesh(shell.shade, new THREE.MeshBasicMaterial({ color: new THREE.Color(colr).multiplyScalar(0.16), transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
      shadeMesh.renderOrder = 1;
      g.add(shadeMesh);
      g.add(new THREE.Mesh(shell.net, netMat));
      const gfloor = new THREE.Mesh(shell.floor, litMat({ color: new THREE.Color(colr).multiplyScalar(0.28), side: THREE.DoubleSide }));
      gfloor.receiveShadow = true;
      g.add(gfloor);
      // frame
      const frameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colr) });
      const parts = [];
      // rounded frame like the real goal (the physics rounds the same edge): thick posts and crossbar with round corners
      const fr = 0.24, seg = low ? 8 : 14;
      for (const xs of [-1, 1]) {
        const p = new THREE.CylinderGeometry(fr, fr, A.goalH, seg); p.translate(xs * A.goalHW, A.goalH / 2, s * A.hl); parts.push(p);
        const j = new THREE.SphereGeometry(fr, seg, Math.max(6, seg / 2)); j.translate(xs * A.goalHW, A.goalH, s * A.hl); parts.push(j);
      }
      const bar = new THREE.CylinderGeometry(fr, fr, A.goalHW * 2, seg); bar.rotateZ(Math.PI / 2); bar.translate(0, A.goalH, s * A.hl); parts.push(bar);
      g.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(parts), frameMat));
      // glow panel at the back
      const glowPanel = new THREE.Mesh(new THREE.PlaneGeometry(A.goalHW * 2, A.goalH), new THREE.MeshBasicMaterial({ color: new THREE.Color(colr), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      glowPanel.position.set(0, A.goalH / 2, s * (A.hl + A.goalD - 0.05));
      g.add(glowPanel);
      root.add(g);
      H.goals.push({ group: g, frameMat, glowPanel, base: new THREE.Color(colr), flash: 0 });
    }

    // obstacles (pillars)
    for (const o of A.obstacles) {
      const pm = litMat({ color: new THREE.Color(map.floor.b).lerp(new THREE.Color('#888888'), 0.5), roughness: 0.6, metalness: 0.3 });
      const p = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, Math.min(o.h, A.h + 2), low ? 16 : 32), pm);
      p.position.set(o.x, Math.min(o.h, A.h + 2) / 2, o.z);
      p.castShadow = high; p.receiveShadow = true;
      root.add(p);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(o.r + 0.05, 0.12, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(map.floor.glow || '#ffd600') }));
      ring.rotation.x = Math.PI / 2; ring.position.set(o.x, 0.15, o.z);
      root.add(ring);
    }

    // boost pads: metal-rimmed glowing plates (small) and tiered platforms with a floating orb (big)
    const smalls = pads.filter((p) => !p.big), bigs = pads.filter((p) => p.big);
    const ns = Math.max(1, smalls.length), nb = Math.max(1, bigs.length);
    const rimMat = litMat({ color: 0x4a515c, roughness: 0.3, metalness: 0.85 });
    const darkMat = litMat({ color: 0x15171c, roughness: 0.6, metalness: 0.35 });
    // the big pad's glowing orange band
    const bandMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a12') });
    const sTex = padTexture(false), bTex = padTexture(true), beamTex = beamTexture();
    H.disposables.push(sTex, bTex, beamTex);
    const sRim = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.0, 1.12, 0.07, 32), rimMat, ns);
    const sFace = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.82, 0.82, 0.075, 32), new THREE.MeshBasicMaterial({ map: sTex }), ns);
    // big pads: a compact platform about 3 m across with the orb hovering a metre up (BS scales the whole thing)
    const BS = 0.72, ORB_Y = 1.0;
    const bBase = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.05 * BS, 2.3 * BS, 0.12, 40), darkMat, nb);
    const bRim = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.7 * BS, 1.85 * BS, 0.2, 40), bandMat, nb);
    const bFace = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.42 * BS, 1.42 * BS, 0.21, 40), new THREE.MeshBasicMaterial({ map: bTex }), nb);
    const bOrb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.46 * BS, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc94a') }), nb);
    const bShell = new THREE.InstancedMesh(new THREE.SphereGeometry(0.68 * BS, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a00'), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), nb);
    const bBeam = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9 * BS, 1.35 * BS, 3.2 * BS, 24, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), nb);
    // halo sprites around each orb (one draw call)
    const haloPos = new Float32Array(nb * 3);
    const haloGeo = new THREE.BufferGeometry(); haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
    const haloMat = new THREE.PointsMaterial({ color: new THREE.Color('#ff7a1a'), size: 4.2 * BS, opacity: 0.85, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const haloImg = new Image();
    haloImg.onload = () => { haloMat.map = new THREE.Texture(haloImg); haloMat.map.needsUpdate = true; haloMat.needsUpdate = true; H.disposables.push(haloMat.map); };
    haloImg.src = (BL.EMBED && BL.EMBED['assets/kenney-particles/light_01.png']) || 'assets/kenney-particles/light_01.png';
    const halos = new THREE.Points(haloGeo, haloMat);
    halos.frustumCulled = false;
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new V3(1, 1, 1), pv = new V3();
    const ON = new THREE.Color(1, 1, 1), OFF = new THREE.Color(0.18, 0.16, 0.14);
    let si = 0, bi = 0;
    for (const p of pads) {
      if (p.big) {
        m4.makeTranslation(p.x, 0.06, p.z); bBase.setMatrixAt(bi, m4);
        m4.makeTranslation(p.x, 0.1, p.z); bRim.setMatrixAt(bi, m4);
        m4.makeTranslation(p.x, 0.11, p.z); bFace.setMatrixAt(bi, m4); bFace.setColorAt(bi, ON);
        m4.makeTranslation(p.x, 1.6 * BS, p.z); bBeam.setMatrixAt(bi, m4);
        haloPos[bi * 3] = p.x; haloPos[bi * 3 + 1] = ORB_Y; haloPos[bi * 3 + 2] = p.z;
        H.pads.push({ big: true, i: bi, x: p.x, z: p.z, active: true });
        bi++;
      } else {
        m4.makeTranslation(p.x, 0.035, p.z); sRim.setMatrixAt(si, m4);
        m4.makeTranslation(p.x, 0.04, p.z); sFace.setMatrixAt(si, m4); sFace.setColorAt(si, ON);
        H.pads.push({ big: false, i: si, x: p.x, z: p.z, active: true });
        si++;
      }
    }
    const padMeshes = [sRim, sFace, bBase, bRim, bFace, bOrb, bShell, bBeam];
    sRim.count = si; sFace.count = si;
    for (const m of [bBase, bRim, bFace, bOrb, bShell, bBeam]) m.count = bi;
    haloGeo.setDrawRange(0, bi);
    padMeshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; root.add(m); });
    root.add(halos);
    sRim.receiveShadow = bBase.receiveShadow = bRim.receiveShadow = true;
    H.setPad = (idx, active) => {
      const p = H.pads[idx];
      if (!p || p.active === active) return;
      p.active = active;
      if (!p.big) { sFace.setColorAt(p.i, active ? ON : OFF); sFace.instanceColor.needsUpdate = true; }
      else {
        bFace.setColorAt(p.i, active ? ON : OFF); bFace.instanceColor.needsUpdate = true;
        haloPos[p.i * 3 + 1] = active ? ORB_Y : -50; haloGeo.attributes.position.needsUpdate = true;
        if (!active) {
          m4.makeScale(0, 0, 0);
          bOrb.setMatrixAt(p.i, m4); bShell.setMatrixAt(p.i, m4); bBeam.setMatrixAt(p.i, m4);
          bOrb.instanceMatrix.needsUpdate = bShell.instanceMatrix.needsUpdate = bBeam.instanceMatrix.needsUpdate = true;
        } else { m4.makeTranslation(p.x, 1.6 * BS, p.z); bBeam.setMatrixAt(p.i, m4); bBeam.instanceMatrix.needsUpdate = true; }
      }
    };
    hqMetal(H, [rimMat, darkMat]);
    // Medium / High: the downloaded small pad model (assets/hq/boost-pads) as before; big pads keep the built-in
    // platform unless a real pad model ('realpads' in its name) is dropped in
    const bigModel = BL.HQ.list('boost-pads').some((p) => /realpads/i.test(p));
    hqPads(root, H, { kinds: bigModel ? ['small', 'big'] : ['small'], smallHide: [sRim], smallFace: sFace, bigHide: [bBase, bRim], bigFace: bFace });
    H.anim.push((dt, t) => {
      for (const p of H.pads) {
        if (!p.big || !p.active) continue;
        const y = ORB_Y + Math.sin(t * 2 + p.x) * 0.1;
        qq.setFromAxisAngle(pv.set(0, 1, 0), t * 1.5 + p.x);
        m4.compose(pv.set(p.x, y, p.z), qq, sc.set(1, 1, 1)); bOrb.setMatrixAt(p.i, m4);
        const k = 1 + Math.sin(t * 5 + p.z) * 0.08;
        m4.compose(pv.set(p.x, y, p.z), qq, sc.set(k, k, k)); bShell.setMatrixAt(p.i, m4);
        haloPos[p.i * 3 + 1] = y;
      }
      bOrb.instanceMatrix.needsUpdate = bShell.instanceMatrix.needsUpdate = true;
      haloGeo.attributes.position.needsUpdate = true;
      haloMat.size = 4.2 + Math.sin(t * 4) * 0.4;
      beamTex.offset.y = (t * 0.6) % 1;
    });

    // stands
    const crowdTex = crowdTexture(map);
    H.disposables.push(crowdTex);
    // stands + boards go around the goals (pushed back behind each net)
    const sPer = perimeter(A.hw, A.hl, A.cornerR, A.goalHW + 2.5);
    // seating bowl (double sided: you look at it from inside the arena)
    const standRows = [{ d: -ST.d0, y: ST.y0, v: 0.0 }, { d: -ST.d1, y: ST.y1, v: 1.0 }];
    const standGeo = seatUV(sweep(sPer, standRows, () => [1, 1, 1, 1], { uvScale: 22, push: A.goalD + 3 }));
    seatTint(standGeo);
    // concourse: a walkway behind the boards up to the first row of seats
    const deckCol = new THREE.Color(map.stands.color).lerp(new THREE.Color('#20242c'), 0.6);
    const deckGeo = sweep(sPer, [{ d: -3, y: 3 }, { d: -ST.d0 * 0.55, y: 3.2 }, { d: -ST.d0, y: ST.y0 }], () => [deckCol.r, deckCol.g, deckCol.b, 1], { push: A.goalD + 3 });
    root.add(new THREE.Mesh(deckGeo, litMat({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }, low)));
    const standMat = litMat({ map: crowdTex, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, color: new THREE.Color().setScalar(MOOD.stands) }, low);
    root.add(new THREE.Mesh(standGeo, standMat));
    H.crowdTex = crowdTex;
    blobCrowd(root, sPer, A, map, H);
    // glowing LED ad boards in front of the crowd
    const adTex = adTexture(map);
    H.disposables.push(adTex);
    const adRows = [{ d: -1.5, y: -0.5, v: 0 }, { d: -1.5, y: 2.6, v: 1 }, { d: -3, y: 3, v: 1 }];
    const adGeo = sweep(sPer, adRows, () => [1, 1, 1, 1], { uvScale: 12, push: A.goalD + 3 });
    // (one-sided too: a ball cam behind the wall looks past the boards' backs)
    const adMat = new THREE.MeshBasicMaterial({ map: adTex, side: THREE.BackSide });
    root.add(new THREE.Mesh(adGeo, adMat));
    H.anim.push((dt) => { adTex.offset.x -= dt * 0.08; });
    // roof: a high open steel lattice over the stands (you see the sky through it), from a back wall behind the top
    // row in to its inner edge, which carries a row of floodlight panels facing the pitch
    const roofRows = [{ d: -(ST.d1 + 2), y: ST.y1 + 2, v: 0 }, { d: -(ST.d1 + 2), y: ROOF.y, v: (ROOF.y - ST.y1 - 2) / 8 }, { d: -ROOF.d, y: ROOF.y, v: (ROOF.y - ST.y1 - 2 + ST.d1 + 2 - ROOF.d) / 8, noPush: true }];
    const roofCol = new THREE.Color(map.stands.color).lerp(new THREE.Color('#566175'), 0.5);
    const roofGeo = sweep(sPer, roofRows, () => [roofCol.r, roofCol.g, roofCol.b, 1], { push: A.goalD + 3, uvScale: 8 });
    const latTex = latticeTexture();
    H.disposables.push(latTex);
    const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true, alphaMap: latTex, alphaTest: 0.5 }));
    root.add(roofMesh);
    const panelTex = panelTexture(map.time !== 'day');
    H.disposables.push(panelTex);
    // (the inner edge runs straight past the goal ends: no jog back behind the goals like the stands)
    const stripGeo = sweep(sPer, [{ d: -ROOF.d, y: ROOF.y - 0.3, v: 0 }, { d: -ROOF.d - 0.4, y: ROOF.y - 2.3, v: 1 }], () => [1, 1, 1, 1], { uvScale: 3 });
    // (brighter than white on Medium / High, so the bloom picks the panels up)
    const stripMat = new THREE.MeshBasicMaterial({ map: panelTex, side: THREE.DoubleSide, fog: false, color: new THREE.Color().setScalar(low ? 1 : 2.4) });
    root.add(new THREE.Mesh(stripGeo, stripMat));
    if (!low) dfhStadium(root, H, sPer, map, roofMesh);
    // the thin hexagon lines arching over the whole stadium, like the real arenas' dome (a single see-through shell;
    // Very Low skips it)
    if (!(BL.App && BL.App.potato)) {
      const domeTex = hexTexture(0, 3);
      H.disposables.push(domeTex);
      const domeGeo = new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
      domeGeo.scale(A.hw + ST.d1 + 34, ROOF.y + 62, A.hl + ST.d1 + 34);
      const dp = domeGeo.attributes.position, du = domeGeo.attributes.uv;
      for (let i = 0; i < dp.count; i++) du.setXY(i, dp.getX(i) / 42, dp.getZ(i) / 42);
      const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ map: domeTex, color: new THREE.Color(map.wall.base).lerp(new THREE.Color('#ffffff'), 0.5), transparent: true, opacity: map.time === 'day' ? 0.2 : 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, fog: false }));
      dome.renderOrder = -5;
      root.add(dome);
    }
    // exposure by time of day (MOOD above)
    if (BL.App && BL.App.renderer) BL.App.renderer.toneMappingExposure = MOOD.exp;
    // outer ground
    const groundCol = { grass: '#2f6b2a', neon: '#07070f', snow: '#e9f1fa', sand: '#c79a5a', metal: '#1a1d24', rock: '#1a0f0c' }[map.floor.type] || '#333';
    const outer = new THREE.Mesh(new THREE.CircleGeometry(900, 32), litMat({ color: new THREE.Color(groundCol) }, true));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.6;
    root.add(outer);
    hqOutside(scene, outer, H, map);

    // (no score cube hanging over the pitch: the real arenas keep the sky clear)
    H.setJumbotron = () => {};

    skyTraffic(root, H, map, low);

    // atmosphere on Medium / High: light shafts and drifting motes (js/ambience.js)
    if (!low && BL.Ambience) BL.Ambience.add(root, H, map, A, { high, topY: ROOF.y - 2, ring: ROOF.d + 2 });

    // themed decor: quick built-in shapes first, real 3D models (Kenney CC0 kits) replace them once loaded
    const decor = new THREE.Group();
    root.add(decor);
    buildDecor(decor, map, H, low);
    realDecor(root, map, H, low, decor);
    weather(root, H, map, A, low);
    BL.HQ.when(() => hqScenery(root, H, map));
    H.update = (dt, t) => {
      for (const f of H.anim) f(dt, t);
      for (const g of H.goals) {
        if (g.flash > 0) {
          g.flash = Math.max(0, g.flash - dt);
          const k = 1 + Math.sin(t * 30) * 0.5 * Math.min(1, g.flash);
          g.frameMat.color.copy(g.base).multiplyScalar(k + 0.5 * g.flash);
          g.glowPanel.material.opacity = 0.25 + 0.5 * Math.min(1, g.flash);
        }
      }
      if (H.cheer > 0) H.cheer -= dt;
      if (H.sky && BL.App && BL.App.camera) H.sky.position.copy(BL.App.camera.position);
    };
    H.flashGoal = (team) => { H.goals[team].flash = 3; H.cheer = 4; };
    H.dispose = () => {
      H.disposed = true;
      root.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (!m.userData.shared) m.dispose(); });
      });
      H.disposables.forEach((d) => d.dispose());
      scene.remove(root);
      scene.fog = null;
      if (H.hqSky && scene.background === H.hqSky) scene.background = null;
    };
    // Nothing else in the stadium ever moves (pads, crowd and lights animate on the GPU), so three.js needn't redo each
    // object's matrices every frame. H.live is the list of what does move; anything added later stays live on its own.
    root.updateMatrixWorld(true);
    const moving = new Set();
    for (const o of H.live) o.traverse((x) => moving.add(x));
    root.traverse((o) => { if (moving.has(o)) return; o.matrixAutoUpdate = false; if (!o.children.length) o.matrixWorldAutoUpdate = false; });
    return H;
  };

  // ---------- real 3D scenery (Kenney Nature Kit + City Kits, CC0) ----------
  const NAT = 'assets/kenney-nature/', SUB = 'assets/kenney-city/suburban/', COM = 'assets/kenney-city/commercial/';
  const HOUSES = 'abcdefghijk'.split('').map((c) => SUB + 'building-type-' + c + '.glb');
  const TOWERS = 'abcde'.split('').map((c) => COM + 'building-skyscraper-' + c + '.glb');
  const BLOCKS = 'abcdefghijklmn'.split('').map((c) => COM + 'low-detail-building-' + c + '.glb').concat([COM + 'low-detail-building-wide-a.glb', COM + 'low-detail-building-wide-b.glb']);
  const ROCKS = ['rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD'].map((n) => NAT + n + '.glb');
  const SPIRES = ['rock_tallA', 'rock_tallB', 'rock_tallC', 'stone_tallA', 'stone_largeA'].map((n) => NAT + n + '.glb');
  const PINES = ['tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_pineTallA'].map((n) => NAT + n + '.glb');
  const DECOR_SPECS = {
    trees: [
      { urls: ['tree_default', 'tree_detailed', 'tree_oak', 'tree_fat', 'tree_cone', 'tree_pineRoundA'].map((n) => NAT + n + '.glb'), count: 130, r: [100, 330], h: [10, 18] },
      { urls: [NAT + 'plant_bushLarge.glb', NAT + 'plant_bushDetailed.glb'], count: 60, r: [96, 260], h: [2, 4] },
      { urls: ROCKS, count: 18, r: [110, 300], h: [3, 7] },
      { urls: HOUSES, count: 26, r: [210, 430], h: [10, 14], face: true },
      { urls: [NAT + 'tent_detailedOpen.glb', NAT + 'campfire_stones.glb'], count: 6, r: [96, 140], h: [2, 4] },
    ],
    autumn: [
      { urls: ['tree_default_fall', 'tree_oak_fall', 'tree_detailed_dark', 'tree_fat', 'tree_oak'].map((n) => NAT + n + '.glb'), count: 130, r: [100, 330], h: [10, 18] },
      { urls: [NAT + 'plant_bushLarge.glb', NAT + 'stump_roundDetailed.glb'], count: 40, r: [96, 260], h: [2, 4] },
      { urls: HOUSES, count: 30, r: [200, 420], h: [10, 14], face: true },
    ],
    city: [
      { urls: TOWERS, count: 32, r: [170, 430], h: [60, 140], night: true },
      { urls: BLOCKS, count: 70, r: [150, 650], h: [18, 48], night: true },
    ],
    mountains: [
      { urls: PINES, count: 150, r: [100, 340], h: [12, 22] },
      { urls: SPIRES, count: 22, r: [120, 320], h: [6, 14] },
    ],
    dunes: [
      { urls: SPIRES.concat(ROCKS), count: 50, r: [110, 520], h: [8, 30], tint: '#d9a35f' },
      { urls: [NAT + 'tent_detailedOpen.glb', NAT + 'campfire_stones.glb'], count: 8, r: [100, 220], h: [3, 4] },
    ],
    volcano: [{ urls: SPIRES.concat(ROCKS), count: 50, r: [110, 460], h: [10, 34], tint: '#2b1d19' }],
  };

  function realDecor(root, map, H, low, procedural) {
    if (!THREE.GLTFLoader || (location.protocol === 'file:' && !BL.EMBED)) return;
    const key = map.time === 'dusk' && map.decor === 'trees' ? 'autumn' : map.decor;
    const specs = DECOR_SPECS[key];
    if (!specs) return;
    const rnd = U.rng(U.hash(map.id + 'real'));
    const potato = BL.App && BL.App.potato;
    let pending = 0, loaded = 0;
    for (const sp of (potato ? specs.slice(0, 1) : specs)) {
      const count = Math.max(1, Math.round(sp.count * (potato ? 0.22 : low ? 0.45 : 1)));
      const per = sp.urls.map(() => []);
      for (let i = 0; i < count; i++) {
        const a = rnd() * Math.PI * 2, r = RING_PUSH + sp.r[0] + rnd() * (sp.r[1] - sp.r[0]);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        per[Math.floor(rnd() * sp.urls.length)].push({ x, z, rot: sp.face ? Math.atan2(-x, -z) + (rnd() - 0.5) * 0.4 : rnd() * Math.PI * 2, h: sp.h[0] + rnd() * (sp.h[1] - sp.h[0]) });
      }
      sp.urls.forEach((url, ui) => {
        if (!per[ui].length) return;
        pending++;
        BL.Models.loadGLTF(url, (gltf) => {
          if (H.disposed) return;
          addInstanced(root, gltf, per[ui], sp, low, map);
          loaded++;
          if (loaded === pending) procedural.children.forEach((c) => { if (c.name === 'proc') c.visible = false; });
        });
      });
    }
  }

  const _Y = new V3(0, 1, 0);
  function addInstanced(root, gltf, list, sp, low, map) {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const hgt = Math.max(0.01, box.max.y - box.min.y);
    const meshes = [];
    scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const m4 = new THREE.Matrix4(), place = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), pos = new V3();
    const night = map.time === 'night';
    for (const mesh of meshes) {
      const src = mesh.material;
      let mat;
      if (low) mat = new THREE.MeshLambertMaterial({ color: src.color ? src.color.clone() : 0xffffff, map: src.map || null });
      else { mat = src.clone(); mat.userData = {}; }
      if (sp.tint && mat.color) mat.color.lerp(new THREE.Color(sp.tint), 0.55);
      if (sp.night && night) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = src.map || null; mat.emissiveIntensity = 0.35; }
      const im = new THREE.InstancedMesh(mesh.geometry, mat, list.length);
      list.forEach((it, i) => {
        const k = it.h / hgt;
        q.setFromAxisAngle(_Y, it.rot);
        place.compose(pos.set(it.x, -0.6 - box.min.y * k, it.z), q, sc.set(k, k, k));
        m4.multiplyMatrices(place, mesh.matrixWorld);
        im.setMatrixAt(i, m4);
      });
      im.frustumCulled = false;
      im.receiveShadow = false;
      root.add(im);
    }
  }

  // goal interior: square roof, floor curving up into the side + back walls (matches the physics)
  function goalShell(A, s, low) {
    const gw = A.goalHW, gh = A.goalH, r = A.goalR, n = low ? 4 : 8;
    // cross-section (x, y, nx, ny, floor?) going -x wall -> floor -> +x wall -> roof. The roof corners round off with
    // radius rt, like physics.js: square at the goal mouth (matching the frame) and as round as the floor further in
    const section = (rt) => {
      const P = [[-gw, gh - rt, -1, 0, 0]];
      const arc = (cx, cy, rr, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); P.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.cos(a), Math.sin(a), 0]); } };
      arc(-gw + r, r, r, Math.PI); arc(gw - r, r, r, Math.PI * 1.5);
      arc(gw - rt, gh - rt, rt, 0); arc(-gw + rt, gh - rt, rt, Math.PI / 2);
      P[n + 1][4] = 1; P[n + 2][4] = 1;
      return P;
    };
    const zs = [A.hl - 0.02, A.hl + 0.3, A.hl + 0.85, A.hl + 1.4, A.hl + 2, A.gz1 - r].map((z) => ({ z, inset: 0 }));
    for (let i = 1; i <= n; i++) { const t = (i / n) * Math.PI / 2; zs.push({ z: A.gz1 - r + Math.sin(t) * r, inset: r * (1 - Math.cos(t)) }); }
    for (const row of zs) row.P = section(r * U.smoothstep(A.hl + 0.3, A.hl + 2, row.z));
    const full = zs[zs.length - 1].P;
    const net = { pos: [], uv: [], idx: [] }, floor = { pos: [], uv: [], idx: [] }, shade = { pos: [], uv: [], idx: [] };
    const vert = (o, p, zz, ins, len) => { o.pos.push(p[0] - p[2] * ins, p[1] - p[3] * ins, s * zz); o.uv.push(len / 1.5, zz / 1.5); return o.pos.length / 3 - 1; };
    let len = 0;
    for (let i = 0; i < full.length - 1; i++) {
      const seg = Math.hypot(full[i + 1][0] - full[i][0], full[i + 1][1] - full[i][1]);
      const isFloor = full[i][4] && full[i + 1][4];
      for (const o of isFloor ? [floor] : [net, shade]) {
        for (let j = 0; j < zs.length - 1; j++) {
          const A0 = zs[j].P, B0 = zs[j + 1].P;
          const v0 = vert(o, A0[i], zs[j].z, zs[j].inset, len), v1 = vert(o, A0[i + 1], zs[j].z, zs[j].inset, len + seg);
          const v2 = vert(o, B0[i], zs[j + 1].z, zs[j + 1].inset, len), v3 = vert(o, B0[i + 1], zs[j + 1].z, zs[j + 1].inset, len + seg);
          o.idx.push(v0, v1, v2, v1, v3, v2);
        }
      }
      len += seg;
    }
    // back cap
    const last = zs[zs.length - 1];
    const c0 = net.pos.length / 3;
    for (const p of full) { net.pos.push(p[0] - p[2] * last.inset, p[1] - p[3] * last.inset, s * (last.z + 0.001)); net.uv.push(p[0] / 1.5, p[1] / 1.5); }
    net.pos.push(0, gh * 0.5, s * (last.z + 0.001)); net.uv.push(0, gh / 3);
    const cc = net.pos.length / 3 - 1;
    for (let i = 0; i < full.length - 1; i++) net.idx.push(c0 + i, c0 + i + 1, cc);
    const mk = (o) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2)); g.setIndex(o.idx); g.computeVertexNormals(); return g; };
    return { net: mk(net), floor: mk(floor), shade: mk(shade) };
  }

  function ringPos(rnd, r0, r1) {
    const a = rnd() * Math.PI * 2, r = RING_PUSH + r0 + rnd() * (r1 - r0);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  function buildDecor(root, map, H, low) {
    const rnd = U.rng(U.hash(map.id + 'decor'));
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), pv = new V3(), sc = new V3();
    const inst = (geo, mat, n, place) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      for (let i = 0; i < n; i++) { place(i, pv, qq, sc); m4.compose(pv, qq, sc); im.setMatrixAt(i, m4); }
      root.add(im);
      return im;
    };
    const night = map.time === 'night';
    const d = map.decor;
    if (d === 'trees') {
      const n = low ? 70 : 160;
      const leaf = litMat({ color: new THREE.Color(map.time === 'dusk' ? '#3d6b2a' : '#2f7d32') }, true);
      const geo = new THREE.ConeGeometry(5, 14, 7); geo.translate(0, 9, 0);
      inst(geo, leaf, n, (i, p, qr, s) => { const [x, z] = ringPos(rnd, 110, 320); p.set(x, -0.5, z); qr.identity(); const k = 0.7 + rnd() * 0.9; s.set(k, k * (0.8 + rnd() * 0.5), k); }).name = 'proc';
      const tg = new THREE.CylinderGeometry(0.8, 1, 4, 5); tg.translate(0, 2, 0);
      const rnd2 = U.rng(U.hash(map.id + 'decor'));
      inst(tg, litMat({ color: 0x5d4037 }, true), n, (i, p, qr, s) => { const [x, z] = ringPos(rnd2, 110, 320); p.set(x, -0.5, z); qr.identity(); const k = 0.7 + rnd2() * 0.9; s.set(k, k, k); rnd2(); }).name = 'proc';
    } else if (d === 'city') {
      const n = low ? 50 : 110;
      const wt = windowTexture(night || map.id === 'neon');
      H.disposables.push(wt);
      const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 6);
      const mat = new THREE.MeshBasicMaterial({ map: wt, color: night ? 0xffffff : 0xcfd8dc, fog: true });
      inst(geo, mat, n, (i, p, qr, s) => { const [x, z] = ringPos(rnd, 160, 420); p.set(x, -0.5, z); qr.setFromAxisAngle(pv.clone().set(0, 1, 0), rnd() * 3); s.set(15 + rnd() * 25, 30 + rnd() * 110, 15 + rnd() * 25); }).name = 'proc';
      if (map.id === 'neon') {
        const neonCols = ['#ff2bd6', '#00e5ff', '#b388ff'];
        for (let k = 0; k < 3; k++) {
          inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(neonCols[k]) }), low ? 8 : 16, (i, p, qr, s) => { const [x, z] = ringPos(rnd, 170, 400); p.set(x, 20 + rnd() * 90, z); qr.identity(); s.set(30 + rnd() * 20, 0.8, 0.8); });
        }
      }
    } else if (d === 'mountains') {
      const geo = new THREE.ConeGeometry(1, 1, 6); geo.translate(0, 0.5, 0);
      const col = [];
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const c = y > 0.6 ? [1, 1, 1] : [0.45, 0.52, 0.62]; col.push(...c); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      inst(geo, litMat({ vertexColors: true }, true), low ? 18 : 30, (i, pp, qr, s) => { const [x, z] = ringPos(rnd, 380, 650); pp.set(x, -1, z); qr.identity(); const r = 70 + rnd() * 90; s.set(r, 90 + rnd() * 140, r); });
      const tgeo = new THREE.ConeGeometry(4, 13, 6); tgeo.translate(0, 7, 0);
      inst(tgeo, litMat({ color: 0x1b4332 }, true), low ? 40 : 90, (i, pp, qr, s) => { const [x, z] = ringPos(rnd, 110, 300); pp.set(x, -0.5, z); qr.identity(); const k = 0.7 + rnd(); s.set(k, k, k); }).name = 'proc';
    } else if (d === 'dunes') {
      const geo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      inst(geo, litMat({ color: 0xd9a35f }, true), low ? 20 : 40, (i, pp, qr, s) => { const [x, z] = ringPos(rnd, 140, 600); pp.set(x, -1, z); qr.identity(); s.set(60 + rnd() * 90, 10 + rnd() * 30, 40 + rnd() * 70); });
      const pg = new THREE.ConeGeometry(1, 1, 4); pg.translate(0, 0.5, 0);
      inst(pg, litMat({ color: 0xc8955a }, true), 3, (i, pp, qr, s) => { pp.set(-300 + i * 160, -1, 450 - i * 40); qr.setFromAxisAngle(pv.clone().set(0, 1, 0), 0.6); s.set(80 - i * 15, 70 - i * 12, 80 - i * 15); });
    } else if (d === 'space') {
      const n = low ? 800 : 2000;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = 850;
        const s = Math.sqrt(1 - u * u);
        pos[i * 3] = Math.cos(a) * s * r; pos[i * 3 + 1] = Math.abs(u) * r * 0.9 + 20; pos[i * 3 + 2] = Math.sin(a) * s * r;
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
      root.add(stars);
      H.live.push(stars);
      H.anim.push(() => { if (BL.App && BL.App.camera) stars.position.copy(BL.App.camera.position); });
      const pt = U.canvas(256, 128);
      const gr = pt.g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#5c6bc0'); gr.addColorStop(0.5, '#ff8a65'); gr.addColorStop(1, '#4527a0');
      pt.g.fillStyle = gr; pt.g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 30; i++) { pt.g.fillStyle = 'rgba(255,255,255,0.08)'; pt.g.fillRect(0, rnd() * 128, 256, 2 + rnd() * 6); }
      const ptex = new THREE.CanvasTexture(pt.c); H.disposables.push(ptex);
      const planet = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 20), new THREE.MeshLambertMaterial({ map: ptex, fog: false }));
      planet.position.set(-420, 260, 520);
      root.add(planet);
      const ring = new THREE.Mesh(new THREE.RingGeometry(180, 260, 48), new THREE.MeshBasicMaterial({ color: 0xffccbc, transparent: true, opacity: 0.35, side: THREE.DoubleSide, fog: false }));
      ring.position.copy(planet.position); ring.rotation.x = 1.2; ring.rotation.y = 0.3;
      root.add(ring);
      H.live.push(planet);
      H.anim.push((dt) => { planet.rotation.y += dt * 0.02; });
    } else if (d === 'volcano') {
      const geo = new THREE.ConeGeometry(1, 1, 7, 1, true); geo.translate(0, 0.5, 0);
      inst(geo, litMat({ color: 0x2b1712 }, true), low ? 10 : 18, (i, pp, qr, s) => { const [x, z] = ringPos(rnd, 300, 600); pp.set(x, -1, z); qr.identity(); const r = 80 + rnd() * 80; s.set(r, 100 + rnd() * 120, r); });
      const lava = new THREE.Mesh(new THREE.CircleGeometry(900, 32), new THREE.MeshBasicMaterial({ color: 0xff4e1a, transparent: true, opacity: 0.35, fog: true }));
      lava.rotation.x = -Math.PI / 2; lava.position.y = -0.55;
      root.add(lava);
    } else if (d === 'blossom') {
      // cherry trees in full bloom: dark trunks under round pink crowns (three blobs each, in shades of pink), and a pond
      const n = low ? 60 : 140, trees = [];
      for (let i = 0; i < n; i++) { const [x, z] = ringPos(rnd, 105, 330); trees.push({ x, z, k: 0.8 + rnd() * 0.7, a: rnd() * 6.3 }); }
      const trunk = new THREE.CylinderGeometry(0.55, 0.9, 7, 6); trunk.translate(0, 3.5, 0);
      inst(trunk, litMat({ color: 0x4a3230 }, true), n, (i, p, qr, s) => { const t = trees[i]; p.set(t.x, -0.5, t.z); qr.identity(); s.set(t.k, t.k, t.k); }).name = 'proc';
      const crowns = inst(new THREE.IcosahedronGeometry(4.2, 1), litMat({ color: 0xffffff }, true), n * 3, (i, p, qr, s) => {
        const t = trees[i % n], j = Math.floor(i / n), a = t.a + j * 2.1, off = j ? 2.4 * t.k : 0;
        p.set(t.x + Math.cos(a) * off, (7.4 + j * 1.2) * t.k, t.z + Math.sin(a) * off); qr.identity();
        const kk = t.k * (j ? 0.72 : 1); s.set(kk, kk * 0.82, kk);
      });
      const pinks = ['#ffb7d0', '#ff9cc2', '#ffd1e1', '#f78fb3', '#ffe4ee', '#ff8fb8'], cc = new THREE.Color();
      for (let i = 0; i < n * 3; i++) crowns.setColorAt(i, cc.set(pinks[(i * 7 + (i % 5)) % pinks.length]));
      const pond = new THREE.Mesh(new THREE.CircleGeometry(55, 28), new THREE.MeshBasicMaterial({ color: 0x86cbe6, transparent: true, opacity: 0.8 }));
      pond.rotation.x = -Math.PI / 2; pond.position.set(-230, -0.45, 150);
      root.add(pond);
    } else if (d === 'harbor') {
      // the docks at night: stacks of shipping containers, gantry cranes with blinking red lights, dark water, the
      // town's windows beyond and a lighthouse sweeping its beam round
      const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
      const cols = ['#a8352b', '#2b5a85', '#cf9733', '#3a7346', '#6f747c', '#bb5c2b', '#54447f'], stacks = [];
      for (let i = 0; i < (low ? 40 : 90); i++) {
        const [x, z] = ringPos(rnd, 105, 300), hgt = 1 + Math.floor(rnd() * 4), rot = Math.round(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.1;
        for (let h = 0; h < hgt; h++) stacks.push({ x, z, y: h * 2.6, rot, c: cols[Math.floor(rnd() * cols.length)] });
      }
      const cont = inst(box, litMat({ color: 0xffffff }, true), stacks.length, (i, p, qr, s) => { const st = stacks[i]; p.set(st.x, -0.5 + st.y, st.z); qr.setFromAxisAngle(_Y, st.rot); s.set(12, 2.55, 2.45); });
      const cc = new THREE.Color();
      stacks.forEach((st, i) => cont.setColorAt(i, cc.set(st.c)));
      const parts = [], tops = [], off = new V3();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3, r = RING_PUSH + 255 + rnd() * 60, x = Math.cos(a) * r, z = Math.sin(a) * r, rot = Math.PI / 2 - a;
        for (const pt of [[-8, 0, 2, 46, 2], [8, 0, 2, 46, 2], [0, 44, 70, 3, 3], [0, 30, 18, 2, 2]]) parts.push({ x, z, rot, ox: pt[0], oy: pt[1], sx: pt[2], sy: pt[3], sz: pt[4] });
        tops.push(x, 48, z);
      }
      inst(box, litMat({ color: 0xd8b13a }, true), parts.length, (i, p, qr, s) => { const pt = parts[i]; qr.setFromAxisAngle(_Y, pt.rot); p.copy(off.set(pt.ox, pt.oy, 0).applyQuaternion(qr)).add(sc.set(pt.x, -0.5, pt.z)); s.set(pt.sx, pt.sy, pt.sz); });
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(tops, 3));
      const redM = new THREE.PointsMaterial({ color: 0xff2a2a, size: 4, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      root.add(new THREE.Points(lg, redM));
      H.anim.push((dt, t) => { redM.opacity = Math.sin(t * 3) > 0.2 ? 1 : 0.15; });
      // dark water out to the horizon, catching a little light
      const water = new THREE.Mesh(new THREE.RingGeometry(RING_PUSH + 330, 900, 48, 1), low ? new THREE.MeshBasicMaterial({ color: 0x0a1624 }) : new THREE.MeshStandardMaterial({ color: 0x0b1a2a, roughness: 0.22, metalness: 0.6 }));
      water.rotation.x = -Math.PI / 2; water.position.y = -0.5;
      root.add(water);
      // the town's lit windows across the bay
      const wt = windowTexture(true); H.disposables.push(wt);
      const bg = new THREE.BoxGeometry(1, 1, 1); bg.translate(0, 0.5, 0);
      const buv = bg.attributes.uv; for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) * 3, buv.getY(i) * 5);
      inst(bg, new THREE.MeshBasicMaterial({ map: wt, color: 0xd8e2ff, fog: true }), low ? 24 : 50, (i, p, qr, s) => { const [x, z] = ringPos(rnd, 520, 640); p.set(x, -0.5, z); qr.setFromAxisAngle(_Y, rnd() * 3); s.set(18 + rnd() * 20, 20 + rnd() * 60, 18 + rnd() * 20); });
      // the lighthouse: a striped tower with a slowly turning beam of light
      const lx = -RING_PUSH - 380, lz = 260;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 46, 12), litMat({ color: 0xf2f2f2 }, true)); tower.position.set(lx, 22.5, lz); root.add(tower);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 7, 12), litMat({ color: 0xc0392b }, true)); band.position.set(lx, 20, lz); root.add(band);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff4c8 })); lamp.position.set(lx, 48, lz); root.add(lamp);
      if (!low) {
        const beamGeo = new THREE.CylinderGeometry(0.6, 22, 260, 16, 1, true); beamGeo.translate(0, -130, 0); beamGeo.rotateZ(Math.PI / 2);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
        const beam = new THREE.Group(); beam.position.set(lx, 48, lz); beam.add(new THREE.Mesh(beamGeo, beamMat));
        root.add(beam); H.live.push(beam);
        H.anim.push((dt) => { beam.rotation.y += dt * 0.6; });
      }
    } else if (d === 'reef') {
      // the sea floor outside the dome: coral in bright colours (round heads and finger clusters), dark rocks, kelp
      // swaying in the current and a school of fish circling the stadium
      const cols = ['#ff7a45', '#a35cff', '#ff5fa2', '#ffd23f', '#2ee6d6', '#ff4f5e', '#7cf06a'], cc = new THREE.Color();
      const heads = inst(new THREE.IcosahedronGeometry(1, 1), litMat({ color: 0xffffff }, true), low ? 50 : 120, (i, p, qr, s) => { const [x, z] = ringPos(rnd, 100, 320); p.set(x, -0.8, z); qr.identity(); const k = 2 + rnd() * 5; s.set(k, k * (0.6 + rnd() * 0.4), k); });
      for (let i = 0; i < heads.count; i++) heads.setColorAt(i, cc.set(cols[i % cols.length]));
      const fg = new THREE.ConeGeometry(0.5, 4, 5); fg.translate(0, 2, 0);
      const fingers = inst(fg, litMat({ color: 0xffffff }, true), low ? 120 : 300, (i, p, qr, s) => {
        const [x, z] = ringPos(rnd, 98, 300); p.set(x, -0.5, z); qr.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6)); const k = 0.8 + rnd() * 1.6; s.set(k, k, k);
      });
      for (let i = 0; i < fingers.count; i++) fingers.setColorAt(i, cc.set(cols[(i * 3 + 1) % cols.length]));
      inst(new THREE.DodecahedronGeometry(1, 0), litMat({ color: 0x24343a }, true), low ? 20 : 45, (i, p, qr, s) => { const [x, z] = ringPos(rnd, 110, 420); p.set(x, -1, z); qr.setFromAxisAngle(_Y, rnd() * 6); const k = 4 + rnd() * 12; s.set(k, k * 0.6, k); });
      // kelp: tall thin blades, bent by the current in the vertex shader (each one by its own position)
      const kelpU = { value: 0 };
      const kg = new THREE.PlaneGeometry(1.6, 26, 1, 8); kg.translate(0, 13, 0);
      const kelpM = new THREE.MeshLambertMaterial({ color: 0x2f8a4a, side: THREE.DoubleSide });
      kelpM.onBeforeCompile = (sh) => {
        sh.uniforms.uT = kelpU;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
          float kh = position.y / 26.0; float kp = 0.0;
          #ifdef USE_INSTANCING
            kp = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.07;
          #endif
          transformed.x += sin(uT * 0.9 + kp + kh * 2.5) * 2.4 * kh * kh; transformed.z += cos(uT * 0.7 + kp) * 1.2 * kh * kh;`);
      };
      kelpM.customProgramCacheKey = () => 'kelp';
      inst(kg, kelpM, low ? 60 : 160, (i, p, qr, s) => { const [x, z] = ringPos(rnd, 100, 360); p.set(x, -0.8, z); qr.setFromAxisAngle(_Y, rnd() * 6.3); const k = 0.6 + rnd() * 0.9; s.set(k, k, k); });
      H.anim.push((dt, t) => { kelpU.value = t; });
      // a school of fish going round (one group turning: no per-fish work)
      const school = new THREE.Group(), fishG = new THREE.ConeGeometry(0.7, 2.6, 5); fishG.rotateX(Math.PI / 2);
      const fish = new THREE.InstancedMesh(fishG, litMat({ color: 0xffd23f }, true), low ? 30 : 70);
      for (let i = 0; i < fish.count; i++) {
        const a = (i / fish.count) * 0.9 + rnd() * 0.05, r = RING_PUSH + 150 + rnd() * 14;
        pv.set(Math.cos(a) * r, 18 + rnd() * 10, Math.sin(a) * r); qq.setFromAxisAngle(_Y, -a); sc.set(1, 1, 1);
        m4.compose(pv, qq, sc); fish.setMatrixAt(i, m4); fish.setColorAt(i, cc.set(i % 3 ? '#ffd23f' : '#4fc3f7'));
      }
      school.add(fish); root.add(school); H.live.push(school);
      H.anim.push((dt) => { school.rotation.y -= dt * 0.08; });
    }

    // ambient particles (snow / embers)
    if ((map.snow || map.embers) && !low) {
      const n = 1200;
      const A = BL.Physics.arena;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * (A.hw * 2 + 40); pos[i * 3 + 1] = rnd() * 40; pos[i * 3 + 2] = (rnd() - 0.5) * (A.hl * 2 + 40); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: map.snow ? 0xffffff : 0xff7a2a, size: map.snow ? 0.18 : 0.14, transparent: true, opacity: 0.85, depthWrite: false, blending: map.embers ? THREE.AdditiveBlending : THREE.NormalBlending }));
      root.add(pts);
      H.anim.push((dt, t) => {
        const p = g.attributes.position.array;
        for (let i = 0; i < n; i++) {
          const k = i * 3;
          if (map.snow) { p[k + 1] -= dt * (1.2 + (i % 5) * 0.2); p[k] += Math.sin(t + i) * dt * 0.4; if (p[k + 1] < 0) p[k + 1] = 40; }
          else { p[k + 1] += dt * (1 + (i % 4) * 0.5); p[k] += Math.sin(t * 2 + i) * dt * 0.6; if (p[k + 1] > 40) p[k + 1] = 0; }
        }
        g.attributes.position.needsUpdate = true;
      });
    }
  }

  // ---------- weather over the pitch ----------
  // Petals drifting down (Blossom Gardens), rain (Storm Harbor) and bubbles rising (Coral Reef), all moved in the
  // vertex shader (no work per particle on the CPU); Medium / High only. Lightning (Storm Harbor, every level: it only
  // changes light levels) lights the whole arena up for a moment every so often.
  const WX = {
    rain: { n: 1400, h: 34, col: '#b8cce8', alpha: 0.34, move: 'p.y = mod(p.y - uT * (24.0 + seed * 9.0), uH); p.x += p.y * 0.1 + endv * 0.09; p.y += endv * 1.1;' },
    petals: { n: 950, h: 30, col: '#ffadcb', alpha: 0.96, size: 2.3, move: 'p.y = mod(p.y - uT * (0.7 + seed * 0.6), uH); p.x += sin(uT * 0.6 + s) * 2.6 + sin(uT * 1.7 + s * 3.0) * 0.4; p.z += cos(uT * 0.45 + s * 1.7) * 2.2;' },
    bubbles: { n: 520, h: 30, col: '#dff9ff', alpha: 0.75, size: 1.1, move: 'p.y = mod(p.y + uT * (1.3 + seed * 1.6), uH); p.x += sin(uT * 1.6 + s) * 0.45; p.z += cos(uT * 1.3 + s) * 0.45;' },
  };
  function weather(root, H, map, A, low) {
    const kind = map.rain ? 'rain' : map.petals ? 'petals' : map.bubbles ? 'bubbles' : null;
    const rnd = U.rng(U.hash(map.id + 'wx'));
    if (kind && !low) {
      const w = WX[kind], line = kind === 'rain', per = line ? 2 : 1, W = A.hw * 2 + 30, L = A.hl * 2 + 30;
      const pos = new Float32Array(w.n * per * 3), seed = new Float32Array(w.n * per), endv = new Float32Array(w.n * per);
      for (let i = 0; i < w.n; i++) {
        const x = (rnd() - 0.5) * W, y = rnd() * w.h, z = (rnd() - 0.5) * L, sd = rnd();
        for (let v = 0; v < per; v++) { const k = i * per + v; pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; seed[k] = sd; endv[k] = v; }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('endv', new THREE.BufferAttribute(endv, 1));
      g.boundingSphere = new THREE.Sphere(new V3(0, w.h / 2, 0), Math.hypot(W, L));
      const u = { uT: { value: 0 }, uH: { value: w.h }, uScale: { value: 1 }, uCol: { value: new THREE.Color(w.col) }, uA: { value: w.alpha } };
      // petals are little ovals, bubbles hollow rings with a glint, rain thin streaks
      const frag = line ? 'gl_FragColor = vec4(uCol, uA * vA);'
        : kind === 'petals' ? 'vec2 d = gl_PointCoord - 0.5; d.x *= 1.8; float r = dot(d, d); if (r > 0.25) discard; gl_FragColor = vec4(uCol * (0.85 + 0.3 * (0.25 - r) * 4.0), uA * vA);'
          : 'vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float ring = smoothstep(0.32, 0.46, r) * (1.0 - smoothstep(0.46, 0.5, r)); float glint = 1.0 - smoothstep(0.0, 0.12, length(d - vec2(-0.16, 0.16))); gl_FragColor = vec4(uCol, (ring * 0.8 + glint + 0.08) * uA * vA);';
      const mat = new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: `attribute float seed; attribute float endv; uniform float uT; uniform float uH; uniform float uScale; varying float vA;
          void main(){ vec3 p = position; float s = seed * 6.2831; ${w.move}
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vA = smoothstep(0.0, 1.5, p.y) * smoothstep(uH + 1.0, uH - 3.0, p.y) * smoothstep(1.5, 6.0, -mv.z);
            gl_PointSize = uScale * ${(w.size || 1).toFixed(2)} * (0.7 + seed * 0.6) * 60.0 / -mv.z;
            gl_Position = projectionMatrix * mv; }`,
        fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vA; void main(){ ' + frag + ' }',
        transparent: true, depthWrite: false, fog: false,
      });
      const obj = line ? new THREE.LineSegments(g, mat) : new THREE.Points(g, mat);
      obj.frustumCulled = false; obj.renderOrder = 4;
      root.add(obj);
      H.disposables.push(mat);
      H.anim.push((dt, t) => {
        u.uT.value = t % 3600;
        const r = BL.App && BL.App.renderer;
        if (r) u.uScale.value = r.getDrawingBufferSize(_wxs).y / 720;
      });
    }
    // lightning: now and then a double flash brightens the sky light, the fill light and the sky itself
    if (map.rain && H.hemi && H.sky) {
      const su = H.sky.material.uniforms, base = { hemi: H.hemi.intensity, fill: H.fill.intensity, top: su.top.value.clone(), bottom: su.bottom.value.clone() };
      const flashCol = new THREE.Color('#c9d8ff');
      let next = 3 + rnd() * 5, t0 = -9, last = -1;
      H.anim.push((dt, t) => {
        next -= dt;
        if (next <= 0) { next = 7 + Math.random() * 9; t0 = t; }
        const e = t - t0;
        const f = e < 0 || e > 0.9 ? 0 : e < 0.07 ? 1 : e < 0.15 ? 0.15 : e < 0.23 ? 0.8 : Math.max(0, 0.8 - (e - 0.23) * 1.3);
        if (f === last) return;
        last = f;
        H.hemi.intensity = base.hemi * (1 + 2.6 * f);
        H.fill.intensity = base.fill * (1 + 7 * f);
        su.top.value.copy(base.top).lerp(flashCol, f * 0.55);
        su.bottom.value.copy(base.bottom).lerp(flashCol, f * 0.4);
      });
    }
  }
  const _wxs = new THREE.Vector2();
})(window.BL);
