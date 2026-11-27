'use strict';
// Rocket League (fan remake) - car decals: one made for each car, like the real game's "Octane: ..." decals
// (2026-11-21: "make each new driver challenge feature a car or car decal related to the car"). An item with
// `body` only shows in the garage with that car on, and only goes on that car (js/carmodels.js drops it from any
// other). They're laid out for one car, not tiled: x = the tail (0) to the nose (W), y = the roof line (0) over the
// side (the side shows about y 0.2 - 0.7) to the underside (H). Both sides share the texture, mirrored, so nothing
// here is lettering that only reads one way (the roundel's 88 reads the same both ways).
(function (BL) {
  const U = BL.util;
  const reg = (name, fn) => BL.Models && BL.Models.registerDecal && BL.Models.registerDecal(name, fn);
  const sh = (h, k) => U.shade(h, k);
  const hexA = (h, a) => U.hexA(h, a);
  // the texture is stretched about 1.4x top to bottom on the cars: round things are drawn squashed by K
  const K = 0.7;
  const band = (g, x0, x1, y0, y1, col) => { g.fillStyle = col; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
  // draw in "car space" (round stays round): f gets y scaled so Y(v) is a fraction of H
  function round(g, H, f) { g.save(); g.scale(1, K); f((v) => (v * H) / K); g.restore(); }
  // a glowing tube with a white-hot core
  function neon(g, col, w, path) {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = col; g.shadowBlur = w * 2.5; g.strokeStyle = hexA(col, 0.95); g.lineWidth = w; g.beginPath(); path(); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = '#ffffff'; g.lineWidth = w * 0.35; g.beginPath(); path(); g.stroke();
    g.restore();
  }
  const poly = (g, pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); };

  // Octane: Grand Prix - an old-school race livery: twin stripes over the roof, a shoulder pinstripe, a number
  // roundel on the door and a chequered sill stripe at the back
  reg('car_octane', (g, W, H, base, acc) => {
    const pin = sh(acc, 0.55);
    band(g, 0, W, H * 0.02, H * 0.06, acc); band(g, 0, W, H * 0.068, H * 0.076, pin);
    band(g, W * 0.04, W * 0.95, H * 0.3, H * 0.309, pin);
    band(g, W * 0.1, W * 0.93, H * 0.585, H * 0.6, acc);
    const cx = W * 0.5;
    round(g, H, (Y) => {
      const cy = Y(0.44), r = H * 0.112;
      g.fillStyle = acc; g.beginPath(); g.arc(cx, cy, r * 1.17, 0, 7); g.fill();
      g.fillStyle = '#f6f7f9'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = '#15171b'; g.font = `900 ${Math.round(r * 1.12)}px "Arial Black", Impact, Arial, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('88', cx, cy + r * 0.06);
      // chequers on the sill toward the tail, thinning out toward the door
      const s = H * 0.034, rnd = U.rng(8);
      for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
        if ((i + j) % 2) continue;
        const k = i / 9;
        if (rnd() < k * 0.7) continue;
        g.globalAlpha = 1 - k * 0.65; g.fillStyle = i % 3 === 2 ? pin : acc;
        g.fillRect(W * 0.035 + i * s, Y(0.62) + j * s, s, s);
      }
      g.globalAlpha = 1;
    });
  });

  // Fennec: Desert Fox - a low sunset behind rolling dunes along the sills and a low-poly fox head on the front wing
  reg('car_fennec', (g, W, H, base, acc) => {
    round(g, H, (Y) => {
      const sx = W * 0.27, sy = Y(0.55), sr = H * 0.15;
      const sg = g.createLinearGradient(0, sy - sr, 0, sy); sg.addColorStop(0, sh(acc, 0.6)); sg.addColorStop(1, sh(acc, 0.05));
      g.fillStyle = sg; g.beginPath(); g.arc(sx, sy, sr, Math.PI, 0); g.closePath(); g.fill();
      // (the retro sun's cut lines)
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 4; i++) g.fillRect(sx - sr, sy - sr * (0.14 + i * 0.22), sr * 2, sr * (0.035 + 0.025 * i));
      g.globalCompositeOperation = 'source-over';
    });
    const cols = [sh(acc, 0.1), sh(acc, -0.2), sh(acc, -0.42)];
    for (let k = 0; k < 3; k++) {
      const y = (x) => H * (0.545 + k * 0.042 + 0.028 * Math.sin((x / W) * Math.PI * (2.2 + k * 0.7) + k * 1.9) + 0.01 * Math.sin((x / W) * Math.PI * 9 + k));
      g.fillStyle = cols[k]; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 96) g.lineTo(x, y(x));
      g.lineTo(W, H); g.closePath(); g.fill();
      g.strokeStyle = sh(acc, 0.45); g.lineWidth = H * 0.005; g.beginPath();
      for (let x = 0; x <= W; x += W / 96) { if (x) g.lineTo(x, y(x)); else g.moveTo(x, y(x)); }
      g.stroke();
    }
    // the fox: ears, face, white cheeks, eyes and nose (the same both ways round)
    round(g, H, (Y) => {
      const cx = W * 0.79, cy = Y(0.39), s = H * 0.085, P = (x, y) => [cx + x * s, cy + y * s];
      const face = sh(acc, 0.12), dark = '#1b1410', ear = sh(acc, -0.3);
      for (const m of [-1, 1]) {
        poly(g, [P(m * 0.5, -0.3), P(m * 0.78, -1.12), P(m * 0.1, -0.5)], face);
        poly(g, [P(m * 0.48, -0.4), P(m * 0.68, -0.92), P(m * 0.22, -0.52)], ear);
      }
      poly(g, [P(-0.86, -0.46), P(0.86, -0.46), P(0.6, 0.12), P(0, 0.9), P(-0.6, 0.12)], face);
      for (const m of [-1, 1]) poly(g, [P(m * 0.86, -0.46), P(m * 0.62, 0.12), P(0, 0.9), P(m * 0.12, 0.22)], '#fbf6ee');
      for (const m of [-1, 1]) poly(g, [P(m * 0.18, -0.2), P(m * 0.48, -0.3), P(m * 0.4, -0.12)], dark);
      poly(g, [P(-0.13, 0.66), P(0.13, 0.66), P(0, 0.9)], dark);
    });
  });

  // Dominus: Sovereign - a gold-leaf look: a long pinstripe along the shoulder ending in a scroll, a blade along the
  // lower door, a stripe down the roof and a small crown on the front wing
  reg('car_dominus', (g, W, H, base, acc) => {
    const hi = sh(acc, 0.45), lo = sh(acc, -0.2);
    band(g, 0, W, 0, H * 0.03, acc); band(g, 0, W, H * 0.042, H * 0.049, hi);
    round(g, H, (Y) => {
      g.lineCap = 'round';
      const spiral = (cx, cy, r0, turns, w, col) => {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath();
        const n = 60;
        for (let i = 0; i <= n; i++) { const t = (i / n) * turns * Math.PI * 2, r = r0 * (1 - (i / n) * 0.85), a = -Math.PI / 2 - t; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      };
      // the long line and its scroll at the tail end
      const y0 = Y(0.335), r0 = H * 0.05;
      g.strokeStyle = acc; g.lineWidth = H * 0.013; g.beginPath(); g.moveTo(W * 0.97, y0); g.lineTo(W * 0.2, y0); g.stroke();
      spiral(W * 0.2, y0 + r0, r0, 1.1, H * 0.013, acc);
      g.strokeStyle = hi; g.lineWidth = H * 0.005; g.beginPath(); g.moveTo(W * 0.93, y0 + H * 0.03); g.lineTo(W * 0.3, y0 + H * 0.03); g.stroke();
      // the crown
      const cx = W * 0.78, cy = Y(0.42), s = H * 0.06, P = (x, y) => [cx + x * s, cy + y * s];
      poly(g, [P(-1, 0.5), P(-1.05, -0.55), P(-0.5, -0.05), P(0, -0.85), P(0.5, -0.05), P(1.05, -0.55), P(1, 0.5)], acc);
      band(g, cx - s, cx + s, cy + s * 0.5, cy + s * 0.78, lo);
      g.fillStyle = hi; for (const x of [-1.05, 0, 1.05]) { g.beginPath(); g.arc(cx + x * s, cy + (x ? -0.62 : -0.92) * s, s * 0.16, 0, 7); g.fill(); }
    });
    // the blade: wide at the front wheel, to a point toward the tail (lighter on top, like polished metal)
    const tip = [W * 0.2, H * 0.545], top = H * 0.505, bot = H * 0.59, x1 = W * 0.86;
    poly(g, [tip, [x1, top], [x1 - W * 0.02, H * 0.5475], [x1, bot]], lo);
    poly(g, [tip, [x1, top], [x1 - W * 0.02, H * 0.5475]], hi);
  });

  // Mustang: Quarter Mile - drag-strip muscle: wide twin rally stripes over the roof, a hockey-stick stripe from the
  // nose that hooks down behind the door, and a chequered flag breaking up over the rear wing
  reg('car_mustang', (g, W, H, base, acc) => {
    const dk = sh(acc, -0.55);
    band(g, 0, W, H * 0.012, H * 0.017, dk); band(g, 0, W, H * 0.017, H * 0.078, acc); band(g, 0, W, H * 0.078, H * 0.083, dk);
    round(g, H, (Y) => {
      const lw = (H * 0.05) / K;
      g.lineJoin = 'round'; g.lineCap = 'butt';
      const path = () => { g.beginPath(); g.moveTo(W * 1.02, Y(0.37)); g.lineTo(W * 0.4, Y(0.37)); g.quadraticCurveTo(W * 0.3, Y(0.37), W * 0.3, Y(0.47)); g.lineTo(W * 0.3, Y(0.64)); };
      g.strokeStyle = acc; g.lineWidth = lw; path(); g.stroke();
      g.strokeStyle = sh(acc, 0.5); g.lineWidth = lw * 0.12; g.beginPath(); g.moveTo(W * 1.02, Y(0.418)); g.lineTo(W * 0.42, Y(0.418)); g.stroke();
      // the flag: squares in rows, scattering toward the door
      const s = H * 0.04, rnd = U.rng(21);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
        if ((i + j) % 2) continue;
        const k = i / 6;
        if (rnd() < k * 0.55) continue;
        g.globalAlpha = 1 - k * 0.5; g.fillStyle = j % 2 ? acc : '#f4f4f4';
        g.fillRect(W * 0.03 + i * s + (rnd() - 0.5) * k * s * 0.6, Y(0.43) + j * s, s * (1 - k * 0.3), s * (1 - k * 0.3));
      }
      g.globalAlpha = 1;
    });
  });

  // Gunship: Ion Drive - panel lines over the hull, an energy conduit running nose to tail with glowing nodes, a
  // thruster ring at the tail and chevrons pointing forward (they pulse with light)
  reg('car_samus', (g, W, H, base, acc) => {
    const ln = 'rgba(10,14,22,0.55)';
    g.strokeStyle = ln; g.lineWidth = H * 0.006;
    g.beginPath();
    g.moveTo(W * 0.04, H * 0.31); g.lineTo(W * 0.96, H * 0.31); g.moveTo(W * 0.06, H * 0.61); g.lineTo(W * 0.94, H * 0.61);
    for (const x of [0.28, 0.52, 0.72]) { g.moveTo(W * x, H * 0.31); g.lineTo(W * (x + 0.03), H * 0.61); }
    g.moveTo(W * 0.52, H * 0.2); g.lineTo(W * 0.9, H * 0.2);
    g.stroke();
    const w = H * 0.017, cy = H * 0.47, up = H * 0.425;
    neon(g, acc, w, () => { g.moveTo(W * 0.06, cy); g.lineTo(W * 0.31, cy); g.lineTo(W * 0.36, up); g.lineTo(W * 0.6, up); g.lineTo(W * 0.65, cy); g.lineTo(W * 0.9, cy); });
    round(g, H, (Y) => {
      g.fillStyle = '#ffffff';
      for (const [x, y] of [[0.31, 0.47], [0.36, 0.425], [0.6, 0.425], [0.65, 0.47]]) { g.beginPath(); g.arc(W * x, Y(y), H * 0.016, 0, 7); g.fill(); }
      neon(g, acc, w * 0.8, () => { g.arc(W * 0.13, Y(0.38), H * 0.07, 0, 7); });
      neon(g, acc, w * 0.6, () => { g.arc(W * 0.13, Y(0.38), H * 0.04, 0, 7); });
      for (let i = 0; i < 3; i++) {
        const x = W * (0.78 + i * 0.045), y = Y(0.55), s = H * 0.035;
        neon(g, acc, w * 0.7, () => { g.moveTo(x - s * 0.6, y - s); g.lineTo(x + s * 0.4, y); g.lineTo(x - s * 0.6, y + s); });
      }
    });
  });

  // Guardian: Aegis - armour: a shield on the door, plates overlapping along the sills with rivets, and a band of
  // hexagons along the shoulder
  reg('car_guardian', (g, W, H, base, acc) => {
    const hi = sh(acc, 0.4), lo = sh(acc, -0.25), dk = sh(acc, -0.55);
    // the plates, each leaning forward and lit along its top edge
    const n = 9, x0 = W * 0.05, pw = (W * 0.9) / n, y0 = H * 0.53, y1 = H * 0.665, lean = W * 0.018;
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * pw, col = i % 2 ? lo : acc;
      poly(g, [[xa + lean, y0], [xa + pw - W * 0.004 + lean, y0], [xa + pw - W * 0.004, y1], [xa, y1]], col);
      g.fillStyle = hi; g.beginPath(); g.moveTo(xa + lean, y0); g.lineTo(xa + pw - W * 0.004 + lean, y0); g.lineTo(xa + pw - W * 0.004 + lean * 0.9, y0 + H * 0.012); g.lineTo(xa + lean * 0.9, y0 + H * 0.012); g.closePath(); g.fill();
    }
    round(g, H, (Y) => {
      g.fillStyle = dk;
      for (let i = 0; i < n; i++) for (const f of [0.25, 0.75]) { g.beginPath(); g.arc(x0 + i * pw + pw * f + W * 0.01, Y(0.56), H * 0.0085, 0, 7); g.fill(); }
      // hexagons along the shoulder
      const r = H * 0.022, hx = r * 1.75;
      g.lineWidth = H * 0.005;
      for (let i = 0; i * hx < W * 0.84; i++) {
        const cx = W * 0.08 + i * hx, cy = Y(0.29) + (i % 2 ? r * 0.87 : 0);
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
        if (i % 3 === 1) { g.fillStyle = hexA(acc, 0.85); g.fill(); } else { g.strokeStyle = acc; g.stroke(); }
      }
      // the shield
      const cx = W * 0.5, cy = Y(0.42), s = H * 0.11;
      const shield = (k) => { g.beginPath(); g.moveTo(cx - s * k, cy - s * 0.85 * k); g.quadraticCurveTo(cx, cy - s * 1.05 * k, cx + s * k, cy - s * 0.85 * k); g.lineTo(cx + s * k, cy - s * 0.05 * k); g.quadraticCurveTo(cx + s * 0.95 * k, cy + s * 0.75 * k, cx, cy + s * 1.15 * k); g.quadraticCurveTo(cx - s * 0.95 * k, cy + s * 0.75 * k, cx - s * k, cy - s * 0.05 * k); g.closePath(); };
      g.fillStyle = hi; shield(1); g.fill();
      g.fillStyle = acc; shield(0.84); g.fill();
      g.fillStyle = dk; g.beginPath(); g.moveTo(cx - s * 0.55, cy - s * 0.4); g.lineTo(cx, cy + s * 0.25); g.lineTo(cx + s * 0.55, cy - s * 0.4); g.lineTo(cx + s * 0.55, cy - s * 0.12); g.lineTo(cx, cy + s * 0.6); g.lineTo(cx - s * 0.55, cy - s * 0.12); g.closePath(); g.fill();
    });
  });

  // Roadster: Live Wire - electric: a forked bolt of current running the length of the car, circuit traces along
  // the sills and a charge meter at the back (they flicker with light)
  reg('car_roadster', (g, W, H, base, acc) => {
    const rnd = U.rng(17), pts = [];
    for (let x = W * 0.97; x > W * 0.03; x -= W * (0.035 + rnd() * 0.03)) pts.push([x, H * (0.41 + (x < W * 0.5 ? 0.02 : 0) + (rnd() - 0.5) * 0.07)]);
    pts.push([W * 0.03, H * 0.44]);
    const w = H * 0.016;
    neon(g, acc, w, () => pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))));
    for (let f = 0; f < 6; f++) {
      const s = pts[2 + ((f * 5) % (pts.length - 4))], dir = f % 2 ? 1 : -1;
      let x = s[0], y = s[1];
      neon(g, acc, w * 0.55, () => { g.moveTo(x, y); for (let k = 0; k < 3; k++) { x -= W * (0.015 + rnd() * 0.02); y += dir * H * (0.02 + rnd() * 0.025); g.lineTo(x, y); } });
    }
    // circuit traces with pads at the ends
    const tc = sh(acc, 0.15);
    g.strokeStyle = tc; g.lineWidth = H * 0.006; g.lineJoin = 'round';
    round(g, H, (Y) => {
      for (let i = 0; i < 7; i++) {
        const xs = W * (0.1 + i * 0.12 + rnd() * 0.03), y = Y(0.56 + (i % 3) * 0.028), d = H * 0.035, len = W * (0.05 + rnd() * 0.05);
        g.lineWidth = (H * 0.006) / K;
        g.beginPath(); g.moveTo(xs, y); g.lineTo(xs + len, y); g.lineTo(xs + len + d, y + d * (i % 2 ? 1 : -1)); g.lineTo(xs + len + d + W * 0.03, y + d * (i % 2 ? 1 : -1)); g.stroke();
        g.fillStyle = tc; g.beginPath(); g.arc(xs, y, H * 0.011, 0, 7); g.fill();
        g.beginPath(); g.arc(xs + len + d + W * 0.03, y + d * (i % 2 ? 1 : -1), H * 0.011, 0, 7); g.stroke();
      }
      // the charge meter: five slanted bars, brighter toward full
      for (let i = 0; i < 5; i++) {
        const x = W * (0.05 + i * 0.026), y = Y(0.31);
        g.globalAlpha = 0.45 + i * 0.13; poly(g, [[x + W * 0.008, y], [x + W * 0.026, y], [x + W * 0.018, y + H * 0.07], [x, y + H * 0.07]], i === 4 ? '#ffffff' : acc);
      }
      g.globalAlpha = 1;
    });
  });

  // the items (car decals drop like any other, and the New Driver Challenges hand them out, see js/newdriver.js)
  const push = (it) => { if (!BL.ITEM_BY_ID[it.id]) { BL.ITEMS.push(it); BL.ITEM_BY_ID[it.id] = it; } };
  const CD = (car, name, rarity, extra) => push(Object.assign({ id: 'decal_car_' + car, cat: 'decal', name, rarity, pattern: 'car_' + car, body: 'body_custom_' + car, nd: true }, extra || {}));
  CD('octane', 'Octane: Grand Prix', 'uncommon');
  CD('fennec', 'Fennec: Desert Fox', 'rare');
  CD('dominus', 'Dominus: Sovereign', 'rare');
  CD('mustang', 'Mustang: Quarter Mile', 'veryrare');
  CD('samus', 'Gunship: Ion Drive', 'veryrare', { animated: true, anim: 'pulse' });
  CD('guardian', 'Guardian: Aegis', 'import');
  CD('roadster', 'Roadster: Live Wire', 'exotic', { animated: true, anim: 'flicker' });
})(window.BL);
