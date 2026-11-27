'use strict';
// Rocket League (fan remake) - better versions of the plainer decals (2026-11-21: "replace all the mid decals with
// better quality"). Same names, so everyone who owns them gets the new look. Every one tiles left-right (the
// animated ones scroll along the body; Fizz also tiles top-bottom, it scrolls up). Drawn once per car texture.
// The texture wraps the car: x = rear to front, y = the roof line (0) over the sides to the underside (1); the sides
// show about y 0.2 - 0.7.
(function (BL) {
  const U = BL.util;
  const reg = (name, fn) => BL.Models && BL.Models.registerDecal && BL.Models.registerDecal(name, fn);
  const hexA = (h, a) => U.hexA(h, a);
  const sh = (h, k) => U.shade(h, k);
  // draw f at x and wrapped round by one texture width either side (so shapes over the seam join up)
  const wrapX = (W, f) => { for (const ox of [-W, 0, W]) f(ox); };
  // a stroke with a soft glow and a bright core (neon)
  function neon(g, col, w, path) {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = col; g.shadowBlur = w * 3; g.strokeStyle = hexA(col, 0.9); g.lineWidth = w; g.beginPath(); path(); g.stroke();
    g.shadowBlur = w * 1.2; g.strokeStyle = '#ffffff'; g.lineWidth = w * 0.35; g.beginPath(); path(); g.stroke();
    g.restore();
  }
  // a bevelled block: lighter top-left edge, darker bottom-right
  function bevel(g, x, y, w, h, col) {
    g.fillStyle = col; g.fillRect(x, y, w, h);
    const e = Math.max(1, Math.min(w, h) * 0.14);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, w, e); g.fillRect(x, y, e, h);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + h - e, w, e); g.fillRect(x + w - e, y, e, h);
  }
  function band(g, W, y0, y1, col) { g.fillStyle = col; g.fillRect(0, y0, W, y1 - y0); }

  // Racing Stripes: twin bold stripes down the sides with a pinstripe between, and a pair over the roof
  reg('stripes', (g, W, H, base, acc) => {
    const pin = sh(acc, 0.55);
    band(g, W, H * 0.3, H * 0.355, acc); band(g, W, H * 0.372, H * 0.38, pin); band(g, W, H * 0.397, H * 0.452, acc);
    band(g, W, H * 0.47, H * 0.476, pin);
    band(g, W, 0, H * 0.03, acc); band(g, W, H * 0.045, H * 0.075, acc); band(g, W, H * 0.034, H * 0.04, pin);
  });
  // Two-Tone: the lower body in the second colour, split by a sweeping line with a pinstripe along it
  reg('twotone', (g, W, H, base, acc) => {
    const y = (x) => H * (0.5 + 0.045 * Math.sin((x / W) * Math.PI * 4) + 0.02 * Math.sin((x / W) * Math.PI * 10));
    g.fillStyle = acc; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 128) g.lineTo(x, y(x));
    g.lineTo(W, H); g.closePath(); g.fill();
    g.strokeStyle = sh(acc, 0.6); g.lineWidth = H * 0.008; g.beginPath();
    for (let x = 0; x <= W; x += W / 128) { const yy = y(x) - H * 0.022; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
    g.stroke();
  });
  // Zig Zag: a bold double zigzag band edged with pinstripes
  reg('zigzag', (g, W, H, base, acc) => {
    const n = 12, a = H * 0.07, zig = (y0, w) => { g.beginPath(); g.moveTo(0, y0); for (let i = 0; i <= n * 2; i++) g.lineTo((i / (n * 2)) * W, y0 + (i % 2 ? a : 0)); for (let i = n * 2; i >= 0; i--) g.lineTo((i / (n * 2)) * W, y0 + (i % 2 ? a : 0) + w); g.closePath(); g.fill(); };
    g.fillStyle = acc; zig(H * 0.3, H * 0.05);
    g.fillStyle = sh(acc, -0.25); zig(H * 0.41, H * 0.035);
    band(g, W, H * 0.27, H * 0.278, sh(acc, 0.5)); band(g, W, H * 0.53, H * 0.538, sh(acc, 0.5));
  });
  // Neon Pulse: glowing tubes with an EQ of light pulses between them
  reg('neonpulse', (g, W, H, base, acc) => {
    const w = H * 0.018;
    neon(g, acc, w, () => { g.moveTo(0, H * 0.3); g.lineTo(W, H * 0.3); });
    neon(g, acc, w, () => { g.moveTo(0, H * 0.58); g.lineTo(W, H * 0.58); });
    const n = 24;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W, h = H * (0.06 + 0.16 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
      neon(g, acc, w * 0.7, () => { g.moveTo(x, H * 0.44 - h / 2); g.lineTo(x, H * 0.44 + h / 2); });
    }
    neon(g, sh(acc, 0.3), w * 0.5, () => { g.moveTo(0, H * 0.04); g.lineTo(W, H * 0.04); });
  });
  // Overload: crackling electric arcs with branches, glowing
  reg('overload', (g, W, H, base, acc) => {
    const rnd = U.rng(7), w = H * 0.012;
    for (let k = 0; k < 6; k++) {
      const pts = []; let y = H * (0.25 + rnd() * 0.35);
      const x0 = rnd() * W, len = W * (0.25 + rnd() * 0.3), steps = 14;
      for (let j = 0; j <= steps; j++) { pts.push([x0 + (j / steps) * len, y]); y = U.clamp(y + (rnd() - 0.5) * H * 0.09, H * 0.18, H * 0.68); }
      wrapX(W, (ox) => {
        neon(g, acc, w, () => { pts.forEach(([x, yy], j) => (j ? g.lineTo(x + ox, yy) : g.moveTo(x + ox, yy))); });
        for (let b = 2; b < steps; b += 4) { const [bx, by] = pts[b]; neon(g, acc, w * 0.5, () => { g.moveTo(bx + ox, by); g.lineTo(bx + ox + W * 0.025, by + (rnd() - 0.3) * H * 0.1); g.lineTo(bx + ox + W * 0.045, by + (rnd() - 0.3) * H * 0.12); }); }
      });
    }
  });
  // Grid Runner: a neon grid with glowing nodes and light runners racing along it
  reg('tron', (g, W, H, base, acc) => {
    const cols = 16, rows = 6, y0 = H * 0.2, y1 = H * 0.68, cw = W / cols, rh = (y1 - y0) / rows;
    g.strokeStyle = hexA(acc, 0.35); g.lineWidth = H * 0.004;
    for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(i * cw, y0); g.lineTo(i * cw, y1); g.stroke(); }
    for (let j = 0; j <= rows; j++) { g.beginPath(); g.moveTo(0, y0 + j * rh); g.lineTo(W, y0 + j * rh); g.stroke(); }
    const rnd = U.rng(21);
    for (let k = 0; k < 6; k++) {
      const j = 1 + Math.floor(rnd() * (rows - 1)), x0 = Math.floor(rnd() * cols) * cw, len = cw * (3 + Math.floor(rnd() * 4));
      wrapX(W, (ox) => neon(g, acc, H * 0.012, () => { g.moveTo(x0 + ox, y0 + j * rh); g.lineTo(x0 + ox + len, y0 + j * rh); g.lineTo(x0 + ox + len, y0 + (j + (rnd() < 0.5 ? -1 : 1)) * rh); }));
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < cols; i += 2) for (let j = 0; j <= rows; j += 2) { g.save(); g.shadowColor = acc; g.shadowBlur = H * 0.02; g.beginPath(); g.arc(i * cw + (j % 4 ? cw : 0), y0 + j * rh, H * 0.008, 0, 7); g.fill(); g.restore(); }
  });
  // Storm Front: rolling storm clouds along the top with lightning striking down the sides
  reg('storm', (g, W, H, base, acc) => {
    const rnd = U.rng(31), dark = sh(base, -0.55);
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * W + rnd() * W * 0.02, y = H * (0.12 + rnd() * 0.08), r = H * (0.06 + rnd() * 0.06);
      wrapX(W, (ox) => { const gr = g.createRadialGradient(x + ox - r * 0.3, y - r * 0.4, r * 0.1, x + ox, y, r); gr.addColorStop(0, sh(acc, 0.35)); gr.addColorStop(0.6, sh(base, -0.3)); gr.addColorStop(1, dark); g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y, r, 0, 7); g.fill(); });
    }
    for (let k = 0; k < 5; k++) {
      let x = ((k + 0.3 + rnd() * 0.4) / 5) * W, y = H * 0.2; const pts = [[x, y]];
      while (y < H * 0.62) { x += (rnd() - 0.5) * W * 0.04; y += H * (0.04 + rnd() * 0.04); pts.push([x, y]); }
      neon(g, acc, H * 0.012, () => pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))));
    }
  });
  // Hue Shift: three thick glossy ribbons weaving along the body (the colour cycles as it plays)
  reg('hueshift', (g, W, H, base, acc) => {
    for (let k = 0; k < 3; k++) {
      const yc = (x) => H * (0.3 + k * 0.12) + Math.sin((x / W) * Math.PI * 2 * (2 + k) + k * 1.4) * H * 0.05, th = H * 0.05;
      const gr = g.createLinearGradient(0, H * 0.22, 0, H * 0.7); gr.addColorStop(0, sh(acc, 0.5)); gr.addColorStop(0.5, acc); gr.addColorStop(1, sh(acc, -0.35));
      g.fillStyle = gr; g.beginPath();
      for (let x = 0; x <= W; x += W / 96) g.lineTo(x, yc(x) - th / 2);
      for (let x = W; x >= 0; x -= W / 96) g.lineTo(x, yc(x) + th / 2);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = H * 0.006; g.beginPath();
      for (let x = 0; x <= W; x += W / 96) { const y = yc(x) - th * 0.3; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  });
  // Season One: a bold S1 crest on each side with speed lines streaming back from it
  reg('s1', (g, W, H, base, acc) => {
    band(g, W, H * 0.04, H * 0.058, acc);
    // (both sides of a car share the texture, mirrored: drawn backward it reads right on the side the garage shows,
    // like the song decals' lettering)
    for (const cx of [W * 0.25, W * 0.75]) {
      g.save(); g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0);
      for (let i = 0; i < 5; i++) { g.fillStyle = hexA(acc, 0.85 - i * 0.14); const y = H * (0.37 + i * 0.035); g.fillRect(cx - W * (0.09 + i * 0.03), y, W * (0.07 + i * 0.03), H * 0.014); }
      g.save(); g.translate(cx, H * 0.43); g.transform(1, 0, -0.22, 1, 0, 0);
      g.fillStyle = sh(base, -0.5); g.beginPath(); g.moveTo(-H * 0.12, -H * 0.11); g.lineTo(H * 0.16, -H * 0.11); g.lineTo(H * 0.12, H * 0.11); g.lineTo(-H * 0.16, H * 0.11); g.closePath(); g.fill();
      g.strokeStyle = acc; g.lineWidth = H * 0.01; g.stroke();
      g.font = `900 ${Math.round(H * 0.16)}px "Russo One", Arial Black, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = acc; g.fillText('S1', 0, H * 0.008); g.restore();
      g.restore();
    }
  });
  // Data Stream: lanes of glowing data packets, bright at the head, fading behind
  reg('datastream', (g, W, H, base, acc) => {
    const rnd = U.rng(44), lanes = 9;
    for (let l = 0; l < lanes; l++) {
      const y = H * (0.24 + l * 0.05);
      g.fillStyle = hexA(acc, 0.12); g.fillRect(0, y - H * 0.003, W, H * 0.006);
      for (let p = 0; p < 6; p++) {
        const x = rnd() * W, len = W * (0.05 + rnd() * 0.1), h = H * 0.02;
        wrapX(W, (ox) => { const gr = g.createLinearGradient(x + ox - len, 0, x + ox, 0); gr.addColorStop(0, hexA(acc, 0)); gr.addColorStop(1, acc); g.fillStyle = gr; g.fillRect(x + ox - len, y - h / 2, len, h); g.fillStyle = '#ffffff'; g.fillRect(x + ox - h, y - h / 2, h, h); });
      }
    }
  });
  // Fizz: glossy bubbles of all sizes (tiles both ways: it rises)
  reg('fizz', (g, W, H, base, acc) => {
    const rnd = U.rng(52);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H, r = H * (0.008 + rnd() * rnd() * 0.05);
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
        const cx = x + ox, cy = y + oy;
        if (cx < -r || cx > W + r || cy < -r || cy > H + r) continue;
        const gr = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r); gr.addColorStop(0, hexA(acc, 0.08)); gr.addColorStop(0.85, hexA(acc, 0.55)); gr.addColorStop(1, hexA(sh(acc, 0.4), 0.9));
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.16, -0.6, 0, 7); g.fill();
      }
    }
  });
  // Heart Throb: a row of glossy hearts on a heartbeat line, with sparkles
  reg('heartthrob', (g, W, H, base, acc) => {
    const heart = (cx, cy, s) => { g.beginPath(); g.moveTo(cx, cy + s * 0.9); g.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.9, cy - s * 1.3, cx, cy - s * 0.45); g.bezierCurveTo(cx + s * 0.9, cy - s * 1.3, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9); g.closePath(); };
    g.strokeStyle = hexA(acc, 0.7); g.lineWidth = H * 0.008; g.lineJoin = 'round'; g.beginPath();
    const u = W / 8, y = H * 0.44;
    g.moveTo(0, y); for (let i = 0; i < 8; i++) for (const [px, py] of [[0.3, 0], [0.38, -0.08], [0.46, 0.06], [0.54, 0], [1, 0]]) g.lineTo(i * u + u * px, y + H * py);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const cx = (i + 0.78) * u, s = H * (i % 2 ? 0.045 : 0.06);
      const gr = g.createLinearGradient(0, y - s, 0, y + s); gr.addColorStop(0, sh(acc, 0.45)); gr.addColorStop(1, sh(acc, -0.3));
      heart(cx, y - H * 0.06, s); g.fillStyle = gr; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(cx - s * 0.45, y - H * 0.06 - s * 0.35, s * 0.25, s * 0.14, -0.7, 0, 7); g.fill();
    }
    const rnd = U.rng(8); g.fillStyle = '#ffffff';
    for (let i = 0; i < 26; i++) { const x = rnd() * W, yy = H * (0.25 + rnd() * 0.4), r = H * (0.004 + rnd() * 0.006); g.beginPath(); g.moveTo(x, yy - r * 3); g.lineTo(x + r, yy); g.lineTo(x, yy + r * 3); g.lineTo(x - r, yy); g.closePath(); g.fill(); }
  });
  // Night Rider: a black visor band round the car with a segmented light bar that glows (the light sweeps)
  reg('scanner', (g, W, H, base, acc) => {
    const y0 = H * 0.36, y1 = H * 0.46;
    const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#2a2d33'); gr.addColorStop(0.5, '#08090b'); gr.addColorStop(1, '#1a1c20');
    g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
    band(g, W, y0 - H * 0.006, y0, '#9aa0aa'); band(g, W, y1, y1 + H * 0.006, '#5a606a');
    const n = 32, sw = W / n;
    for (let i = 0; i < n; i++) {
      const k = Math.max(0, 1 - Math.abs(i - n * 0.5) / 5);
      g.fillStyle = k > 0 ? hexA(acc, 0.35 + 0.65 * k) : hexA(acc, 0.12);
      g.save(); if (k > 0.3) { g.shadowColor = acc; g.shadowBlur = H * 0.03 * k; }
      g.fillRect(i * sw + sw * 0.12, y0 + H * 0.025, sw * 0.76, H * 0.05); g.restore();
    }
  });
  // Blockade: neat bevelled blocks stacked in a band along the sides, two tones
  reg('blocks', (g, W, H, base, acc) => {
    const cw = W / 32, rnd = U.rng(3), alt = sh(acc, -0.3);
    for (let i = 0; i < 32; i++) {
      const hgt = 1 + Math.floor(rnd() * 4);
      for (let j = 0; j < hgt; j++) bevel(g, i * cw + 1, H * 0.6 - (j + 1) * cw * 0.95, cw - 2, cw * 0.95 - 2, (i + j) % 3 ? acc : alt);
    }
    band(g, W, H * 0.6, H * 0.612, sh(acc, -0.5));
  });
  // Scribbles: graffiti marker strokes, two tones, with paint drips
  reg('scribble', (g, W, H, base, acc) => {
    const rnd = U.rng(9);
    for (const [col, wid] of [[sh(acc, -0.35), 0.03], [acc, 0.018]]) {
      g.strokeStyle = col; g.lineWidth = H * wid; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let k = 0; k < 9; k++) {
        const x0 = (k / 9) * W + rnd() * W * 0.04, y0 = H * (0.3 + rnd() * 0.2);
        wrapX(W, (ox) => {
          g.beginPath(); g.moveTo(x0 + ox, y0);
          for (let t = 0; t < 1; t += 0.05) { const a = t * Math.PI * 5; g.lineTo(x0 + ox + t * W * 0.1 + Math.cos(a) * H * 0.04, y0 + Math.sin(a) * H * 0.05 + t * H * 0.04); }
          g.stroke();
        });
      }
    }
    g.fillStyle = acc;
    for (let i = 0; i < 14; i++) { const x = rnd() * W, y = H * (0.42 + rnd() * 0.12), l = H * (0.04 + rnd() * 0.1), w = H * 0.01; g.fillRect(x - w / 2, y, w, l); g.beginPath(); g.arc(x, y + l, w * 0.9, 0, 7); g.fill(); }
  });
  // Turbo Script: italic TURBO lettering with an outline, speed lines and a stripe underneath
  reg('turbo', (g, W, H, base, acc) => {
    band(g, W, H * 0.5, H * 0.535, acc); band(g, W, H * 0.545, H * 0.555, sh(acc, 0.5));
    for (const cx of [W * 0.25, W * 0.75]) {
      g.save(); g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0);
      for (let i = 0; i < 4; i++) { g.fillStyle = hexA(acc, 0.7 - i * 0.15); g.fillRect(cx - W * (0.16 + i * 0.02), H * (0.36 + i * 0.03), W * (0.08 - i * 0.012), H * 0.012); }
      g.save(); g.translate(cx, H * 0.42); g.transform(1, 0, -0.3, 1, 0, 0);
      g.font = `900 ${Math.round(H * 0.13)}px "Russo One", Arial Black, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.strokeStyle = sh(base, -0.6); g.lineWidth = H * 0.018; g.strokeText('TURBO', 0, 0);
      const gr = g.createLinearGradient(0, -H * 0.06, 0, H * 0.06); gr.addColorStop(0, sh(acc, 0.5)); gr.addColorStop(1, sh(acc, -0.2));
      g.fillStyle = gr; g.fillText('TURBO', 0, 0); g.restore();
      g.restore();
    }
  });
  // Topographic / Contour Flow: a real contour map of a smooth landscape: a few even lines (every third one bolder),
  // each drawn the same width wherever it runs (its distance in pixels from the pixel's height), worked out once
  function topo(g, W, H, base, acc) {
    // (worked out per pixel, so on the big textures it's drawn at half size and scaled up: a quarter of the work)
    if (W > 512) { const h = U.canvas(W / 2, H / 2); topo(h.g, W / 2, H / 2, base, acc); g.drawImage(h.c, 0, 0, W, H); return; }
    const img = g.getImageData(0, 0, W, H), d = img.data, [r, gg, b] = [1, 3, 5].map((i) => parseInt(acc.slice(i, i + 2), 16));
    const tx = (Math.PI * 2) / W, px = W / 512;
    const f = (x, y) => { const a = x * tx, v = y / H; return Math.sin(a * 2 + v * 4) * 0.8 + Math.sin(a * 3 - v * 5 + 1.3) * 0.45 + Math.cos(a + v * 3 + 0.4) * 0.3 + v * 1.6; };
    const steps = 4.5;
    for (let y = Math.floor(H * 0.16); y < H * 0.74; y++) {
      for (let x = 0; x < W; x++) {
        const v = f(x, y) * steps, gx = f(x + 1, y) * steps - v, gy = f(x, y + 1) * steps - v, gm = Math.hypot(gx, gy) || 1e-6;
        const n = Math.round(v), pd = Math.abs(v - n) / gm, major = n % 3 === 0, hw = (major ? 1.7 : 0.9) * px;
        const k = U.clamp(hw + 0.6 - pd, 0, 1) * (major ? 1 : 0.8);
        if (k <= 0) continue;
        const i = (y * W + x) * 4;
        // (drawn on its own see-through layer the line is the colour with its strength as opacity; over paint, mixed in)
        if (d[i + 3] === 0) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255 * k; }
        else { d[i] = d[i] + (r - d[i]) * k; d[i + 1] = d[i + 1] + (gg - d[i + 1]) * k; d[i + 2] = d[i + 2] + (b - d[i + 2]) * k; }
      }
    }
    g.putImageData(img, 0, 0);
  }
  reg('topo', topo);
  // Tri-Stripe: three bold livery stripes sweeping along the sides with angled ends, and over the roof
  reg('flagstripe', (g, W, H, base, acc) => {
    const c = [acc, '#ffffff', sh(acc, -0.5)];
    for (const cx of [0, W * 0.5]) for (let i = 0; i < 3; i++) {
      const y = H * (0.34 + i * 0.066), x0 = cx + W * 0.03 + i * W * 0.014, x1 = cx + W * 0.47 - i * W * 0.014, s = H * 0.06;
      g.fillStyle = c[i]; g.beginPath(); g.moveTo(x0 + s, y); g.lineTo(x1, y); g.lineTo(x1 - s, y + H * 0.055); g.lineTo(x0, y + H * 0.055); g.closePath(); g.fill();
    }
    for (let i = 0; i < 3; i++) band(g, W, H * (0.012 + i * 0.022), H * (0.03 + i * 0.022), c[i]);
  });
  // Frostbite: detailed six-armed snowflakes and frost creeping up from below
  reg('frost', (g, W, H, base, acc) => {
    const rnd = U.rng(77), ice = '#eaf7ff';
    const flake = (x, y, r) => {
      g.save(); g.translate(x, y); g.strokeStyle = ice; g.lineCap = 'round'; g.lineWidth = Math.max(1, r * 0.09);
      for (let a = 0; a < 6; a++) {
        g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r);
        for (const t of [0.45, 0.7]) { g.moveTo(0, -r * t); g.lineTo(-r * 0.22, -r * (t + 0.16)); g.moveTo(0, -r * t); g.lineTo(r * 0.22, -r * (t + 0.16)); }
        g.stroke();
      }
      g.restore();
    };
    for (let i = 0; i < 30; i++) { const x = rnd() * W, y = H * (0.2 + rnd() * 0.36), r = H * (0.015 + rnd() * rnd() * 0.05); wrapX(W, (ox) => flake(x + ox, y, r)); }
    // frost from the sills
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, h = H * (0.04 + rnd() * 0.1);
      g.strokeStyle = hexA(ice, 0.6); g.lineWidth = H * 0.004; g.beginPath(); g.moveTo(x, H * 0.7); g.lineTo(x + (rnd() - 0.5) * H * 0.05, H * 0.7 - h); g.stroke();
    }
    const gr = g.createLinearGradient(0, H * 0.62, 0, H * 0.72); gr.addColorStop(0, hexA(ice, 0)); gr.addColorStop(1, hexA(ice, 0.55));
    g.fillStyle = gr; g.fillRect(0, H * 0.62, W, H * 0.1);
  });
})(window.BL);
