'use strict';
// Rocket League (fan remake) - the SONG PASS (Challenges -> SONG PASS): one free track of 75 tiers that every match's
// XP climbs. Every song you don't start with is on it, each followed by a decal made for that song (its colours, a
// picture that fits it, its title along the side, and it pulses at the song's own tempo), with pixel-art avatar
// borders, avatar backgrounds, player banners and three titles in between. It replaced the weekly music events.
(function (BL) {
  const SP = BL.SongPass = {};
  SP.DEF = { vol: 1, name: 'SONG PASS — VOLUME 1', xpPerTier: 600 };
  SP.KINDS = { song: 'SONG', decal: 'DECAL', border: 'AVATAR BORDER', avbg: 'AVATAR BACKGROUND', banner: 'PLAYER BANNER', title: 'PLAYER TITLE' };

  // The songs in pass order (easy-going ones first, the Rocket League themes last), with the look of each one's decal:
  // two colours, a picture (m), and its tempo in beats per minute (measured from the song itself; the decal's glow
  // beats at that rate). r is the decal's rarity.
  const SONGS = [
    { id: 'everyone-dance', c: ['#ff5fa2', '#ffd23f'], m: 'notes', bpm: 117, r: 'rare' },
    { id: 'play', c: ['#39e6c0', '#ffffff'], m: 'eq', bpm: 128, r: 'rare' },
    { id: 'slippy-flow', c: ['#4fd1ff', '#0b3fa0'], m: 'wave', bpm: 156, r: 'rare', band: true },
    { id: 'shiawase', c: ['#ffb1cf', '#ff5fa2'], m: 'petals', bpm: 75, r: 'rare' },
    { id: 'luv-u-need-u', c: ['#ff3f8e', '#ffffff'], m: 'hearts', bpm: 148, r: 'rare' },
    { id: 'rock-it', c: ['#ff8c2b', '#1a1a1a'], m: 'eq', bpm: 128, r: 'rare', band: true },
    { id: 'heat-wave', c: ['#ff3d00', '#ffd13b'], m: 'flame', bpm: 128, r: 'rare' },
    { id: 'firework', c: ['#ffd23f', '#ff5fa2'], m: 'burst', bpm: 120, r: 'rare' },
    { id: 'breathing-underwater', c: ['#2ad4ff', '#063a7a'], m: 'bubbles', bpm: 141, r: 'veryrare', band: true },
    { id: 'walking-on-the-moon', c: ['#eef2ff', '#1b1f4a'], m: 'moon', bpm: 131, r: 'veryrare', band: true },
    { id: 'i-can-be', c: ['#ffd23f', '#ff8c2b'], m: 'rays', bpm: 131, r: 'veryrare' },
    { id: 'stronger', c: ['#7df9ff', '#1546b8'], m: 'bolt', bpm: 161, r: 'veryrare', band: true },
    { id: 'flying-forever', c: ['#ffffff', '#8fc8ff'], m: 'wings', bpm: 134, r: 'veryrare' },
    { id: 'wygd', c: ['#ff2bd6', '#00f0ff'], m: 'glitch', bpm: 75, r: 'veryrare' },
    { id: 'darkness', c: ['#9b5cff', '#0a0514'], m: 'rings', bpm: 128, r: 'veryrare', band: true },
    { id: 'fury', c: ['#ff1744', '#1a0000'], m: 'flame', bpm: 88, r: 'veryrare', band: true },
    { id: 'rock-it-vip', c: ['#ffd451', '#1a1a1a'], m: 'eq', bpm: 128, r: 'import', band: true },
    { id: 'throwback-anthem', c: ['#ff8a1f', '#2a1a0a'], m: 'vinyl', bpm: 95, r: 'import', band: true },
    { id: 'sarpbc-theme', c: ['#ff6a00', '#ffd23f'], m: 'retro', bpm: 115, r: 'import' },
    { id: 'sarpbc-theme-accel', c: ['#ff3b3b', '#ffffff'], m: 'speed', bpm: 120, r: 'import' },
    { id: 'rl-theme-select', c: ['#9fd0ff', '#0c3a9e'], m: 'ball', bpm: 120, r: 'exotic', band: true },
    { id: 'rl-theme-menu', c: ['#ffffff', '#1f6fe2'], m: 'ball', bpm: 120, r: 'exotic', band: true },
    { id: 'rl-theme-medley', c: ['#ffd23f', '#1f6fe2'], m: 'medley', bpm: 120, r: 'exotic', band: true },
    { id: 'rlcs-theme', c: ['#ffd451', '#0b1030'], m: 'trophy', bpm: 104, r: 'blackmarket', band: true },
    { id: 'rl-theme', c: ['#ffffff', '#1f6fe2'], m: 'anthem', bpm: 120, r: 'blackmarket', band: true },
  ];
  // what sits between the songs: one extra after every song and its decal (js/rlmenu.js draws these)
  const EXTRAS = [
    ['border', 'stitchblue', 'Blue Stitch'], ['avbg', 'pxpitch', 'Pixel Pitch'], ['border', 'stitchgreen', 'Green Stitch'], ['banner', 'pxbeat', 'Beat Bars'],
    ['border', 'hazard', 'Hazard'], ['avbg', 'pxbeat', 'Beat Bars'], ['border', 'pixelwave', 'Pixel Wave'], ['title', 'title_dj', 'DJ'],
    ['border', 'jungle', 'Jungle'], ['avbg', 'pxsunset', 'Pixel Sunset'], ['border', 'lemon', 'Lemon Drop'], ['banner', 'pxsunset', 'Sunset Pitch'],
    ['border', 'hivis', 'Hi-Vis'], ['avbg', 'pxhearts', 'Pixel Hearts'], ['border', 'filmreel', 'Film Reel'], ['title', 'title_headliner', 'Headliner'],
    ['border', 'royal', 'Royal'], ['avbg', 'pxstatic', 'Pixel Static'], ['border', 'slash', 'No Entry'], ['banner', 'pxgrid', 'Retro Grid'],
    ['border', 'hazardheavy', 'Heavy Hazard'], ['avbg', 'pxrainbow', 'Pixel Rainbow'], ['border', 'goldbar', 'Gold Bar'], ['banner', 'pxhearts', 'Pixel Hearts'],
    ['title', 'title_songlegend', 'Song Pass Legend'],
  ];

  const songDef = (id) => (BL.MUSIC || []).find((m) => m.id === id) || null;
  const push = (it) => { if (!BL.ITEM_BY_ID[it.id]) { BL.ITEMS.push(it); BL.ITEM_BY_ID[it.id] = it; } };
  // the titles (pass: 'song' keeps them, and the decals, out of drops, the shop and trade-ins)
  push({ id: 'title_dj', cat: 'title', name: 'DJ', rarity: 'exotic', text: 'DJ', color: '#39e6c0', pass: 'song' });
  push({ id: 'title_headliner', cat: 'title', name: 'Headliner', rarity: 'blackmarket', text: 'HEADLINER', color: '#ff5ad1', glow: true, pass: 'song' });
  push({ id: 'title_songlegend', cat: 'title', name: 'Song Pass Legend', rarity: 'blackmarket', text: 'SONG PASS LEGEND', color: '#ffd451', glow: true, pass: 'song' });

  SP.TIERS = [];
  SONGS.forEach((s, i) => {
    const m = songDef(s.id), name = m ? m.name : s.id;
    push({ id: 'decal_song_' + s.id, cat: 'decal', name, rarity: s.r, pattern: 'song_' + s.id, animated: true, anim: 'beat', bpm: s.bpm, song: s.id, pass: 'song', desc: 'The ' + name + ' song decal: it beats at the song\'s tempo.' });
    const x = EXTRAS[i];
    SP.TIERS.push({ kind: 'song', id: s.id, name }, { kind: 'decal', id: 'decal_song_' + s.id, name: name + ' decal' }, { kind: x[0], id: x[1], name: x[2] });
  });
  SP.TIERS.forEach((t, i) => { t.tier = i + 1; });
  SP.SONGS = SONGS;

  // ---------- progress ----------
  SP.state = function () {
    const p = BL.Save.p;
    if (!p.songPass || p.songPass.vol !== SP.DEF.vol) p.songPass = { vol: SP.DEF.vol, xp: 0, tier: 0 };
    p.idOwned = p.idOwned || {};
    return p.songPass;
  };
  // the identity pieces (borders, backgrounds, banners) you've earned here
  SP.owned = (kind, id) => !!(BL.Save.p.idOwned && BL.Save.p.idOwned[kind + ':' + id]);
  SP.tierOf = (kind, id) => { const t = SP.TIERS.find((x) => x.kind === kind && x.id === id); return t ? t.tier : 0; };
  SP.tierOfKey = (key) => { const i = key.indexOf(':'); return i < 0 ? 0 : SP.tierOf(key.slice(0, i), key.slice(i + 1)); };
  SP.tierOfItem = (itemId) => {
    if (/^anthem_/.test(itemId)) return SP.tierOf('song', itemId.slice(7));
    if (/^decal_song_/.test(itemId)) return SP.tierOf('decal', itemId);
    if (/^title_/.test(itemId)) return SP.tierOf('title', itemId);
    return 0;
  };
  function grant(t) {
    const S = BL.Save, p = S.p, out = { tier: t.tier, kind: t.kind, id: t.id, name: t.name };
    if (t.kind === 'song' || t.kind === 'decal' || t.kind === 'title') {
      const iid = t.kind === 'song' ? 'anthem_' + t.id : t.id;
      if (!BL.ITEM_BY_ID[iid]) return null;
      // a song you already earned in the old music events: credits instead
      if (S.owns(iid)) { p.credits += 100; out.dup = 100; } else S.addItem(iid, null, null, true);
    } else p.idOwned[t.kind + ':' + t.id] = 1;
    return out;
  }
  // after a match: the match's XP climbs the pass; every tier reached hands out its reward at once
  SP.addXP = function (n) {
    const S = BL.Save, st = SP.state(), before = st.tier, got = [];
    st.xp += Math.round(n);
    while (st.tier < SP.TIERS.length && st.xp >= SP.DEF.xpPerTier) {
      st.xp -= SP.DEF.xpPerTier; st.tier++;
      const g = grant(SP.TIERS[st.tier - 1]);
      if (g) got.push(g);
    }
    if (st.tier >= SP.TIERS.length) st.xp = Math.min(st.xp, SP.DEF.xpPerTier);
    S.save();
    return { tiers: st.tier - before, rewards: got };
  };
  SP.reached = (t) => t.tier <= SP.state().tier;
  SP.songsOwned = () => { const S = BL.Save; return SONGS.filter((s) => S.owns('anthem_' + s.id)).length; };

  // ---------- the song decals ----------
  // Each is painted from its song's two colours: the picture along the side, the title under it as a ticker, and a
  // stripe along the roof line. They tile left-right (the beat animation drifts them along the car).
  const FONT = (px) => `bold ${px}px 'Russo One', 'Arial Black', Impact, Arial, sans-serif`;
  const tile = (W, fn) => { for (const dx of [-W, 0, W]) fn(dx); };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const heart = (g, x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.45, y - s * 1.05, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s, y - s * 0.4, x, y + s * 0.35); g.fill(); };
  const note = (g, x, y, s, flag) => {
    g.beginPath(); g.ellipse(x, y, s * 0.55, s * 0.4, -0.4, 0, Math.PI * 2); g.fill();
    g.fillRect(x + s * 0.4, y - s * 2.2, s * 0.16, s * 2.2);
    if (flag) { g.beginPath(); g.moveTo(x + s * 0.56, y - s * 2.2); g.quadraticCurveTo(x + s * 1.5, y - s * 1.7, x + s * 0.9, y - s * 0.9); g.quadraticCurveTo(x + s * 1.2, y - s * 1.5, x + s * 0.56, y - s * 1.6); g.fill(); }
  };
  const ball = (g, x, y, r, dark) => {
    g.fillStyle = '#ffffff'; circ(g, x, y, r);
    g.fillStyle = dark;
    for (let k = 0; k < 6; k++) {
      const a = k === 5 ? 0 : (k * Math.PI * 2) / 5 - Math.PI / 2, d = k === 5 ? 0 : r * 0.62, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, rr = r * 0.27;
      g.beginPath(); for (let q = 0; q < 5; q++) { const b = a + Math.PI + (q * Math.PI * 2) / 5; g.lineTo(cx + Math.cos(b) * rr, cy + Math.sin(b) * rr); } g.closePath(); g.fill();
    }
    g.strokeStyle = dark; g.lineWidth = r * 0.08; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  };
  const MOTIF = {
    eq(g, W, H, c1, c2, rnd) {
      const n = 36, bw = W / n;
      for (let i = 0; i < n; i++) {
        const h = 2 + Math.floor((0.5 + 0.5 * Math.sin(i * 0.9) * Math.cos(i * 0.31)) * 5 + rnd() * 4);
        for (let k = 0; k < h; k++) { g.fillStyle = k >= h - 2 ? c2 : c1; g.fillRect(i * bw + bw * 0.14, H * 0.6 - (k + 1) * H * 0.04, bw * 0.72, H * 0.03); }
      }
    },
    wave(g, W, H, c1, c2) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const [col, w, ph] of [[c2, 0.05, 0.6], [c1, 0.026, 0]]) {
        g.strokeStyle = col; g.lineWidth = H * w; g.beginPath();
        for (let x = 0; x <= W; x += 3) { const t = (x / W) * Math.PI * 2, y = H * 0.43 + (Math.sin(t * 3 + ph) * 0.6 + Math.sin(t * 9 + ph) * 0.25 + Math.sin(t * 21) * 0.1) * H * 0.13; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
    },
    notes(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => { for (let i = 0; i < 14; i++) { const x = dx + ((i + 0.3) / 14) * W + (rnd() - 0.5) * W * 0.03, y = H * (0.36 + rnd() * 0.22), s = H * (0.035 + rnd() * 0.03); g.fillStyle = i % 3 ? c1 : c2; note(g, x, y, s, i % 2 === 0); } });
    },
    petals(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => { for (let i = 0; i < 60; i++) { const x = dx + rnd() * W, y = H * (0.22 + rnd() * 0.42), r = H * (0.018 + rnd() * 0.03); g.fillStyle = rnd() < 0.6 ? c1 : c2; g.beginPath(); g.ellipse(x, y, r, r * 0.55, rnd() * Math.PI, 0, Math.PI * 2); g.fill(); } });
    },
    hearts(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => { for (let i = 0; i < 22; i++) { const x = dx + rnd() * W, y = H * (0.3 + rnd() * 0.3), s = H * (0.03 + rnd() * 0.045); g.fillStyle = i % 4 ? c1 : c2; heart(g, x, y, s); } });
    },
    flame(g, W, H, c1, c2, rnd) {
      const n = 26;
      for (const [col, k] of [[c1, 1], [c2, 0.62]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(-W, H * 0.62);
        for (let i = 0; i <= n * 3; i++) { const x = ((i / n) - 1) * W, h = H * (0.1 + 0.26 * k * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)))); g.quadraticCurveTo(x - W / n / 2, H * 0.62 - h * 1.4, x, H * 0.62 - h * 0.6); }
        g.lineTo(W * 2, H * 0.62); g.lineTo(W * 2, H * 0.66); g.lineTo(-W, H * 0.66); g.fill();
      }
    },
    burst(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => { for (let i = 0; i < 6; i++) { const cx = dx + ((i + 0.5) / 6) * W, cy = H * (0.3 + (i % 2) * 0.14), r = H * (0.09 + rnd() * 0.06), col = i % 2 ? c1 : c2; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = H * 0.008; for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); circ(g, cx + Math.cos(a) * r * 1.12, cy + Math.sin(a) * r * 1.12, H * 0.008); } } });
    },
    bubbles(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => { for (let i = 0; i < 40; i++) { const x = dx + rnd() * W, y = H * (0.2 + rnd() * 0.44), r = H * (0.012 + rnd() * rnd() * 0.05); g.strokeStyle = c1; g.lineWidth = Math.max(1, r * 0.22); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#ffffff'; circ(g, x - r * 0.35, y - r * 0.35, r * 0.2); } });
    },
    moon(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => {
        for (let i = 0; i < 50; i++) { g.fillStyle = i % 5 ? '#ffffff' : c1; circ(g, dx + rnd() * W, H * (0.2 + rnd() * 0.42), H * (0.004 + rnd() * 0.006)); }
        for (const sx of [0.3, 0.8]) { const cx = dx + W * sx, cy = H * 0.42, r = H * 0.13; g.fillStyle = c1; circ(g, cx, cy, r); g.fillStyle = c2; circ(g, cx + r * 0.42, cy - r * 0.2, r * 0.86); }
      });
    },
    rays(g, W, H, c1, c2) {
      tile(W, (dx) => { for (let k = 0; k < 16; k++) { const a0 = Math.PI + (k / 16) * Math.PI, a1 = a0 + Math.PI / 32, cx = dx + W * 0.5, cy = H * 0.62, R = W * 0.6; g.fillStyle = k % 2 ? c1 : c2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.fill(); } });
      g.fillStyle = c1; circ(g, W * 0.5, H * 0.62, H * 0.07); g.fillStyle = c2; circ(g, W * 0.5, H * 0.62, H * 0.045);
    },
    bolt(g, W, H, c1, c2, rnd) {
      g.lineJoin = 'miter';
      tile(W, (dx) => { for (let i = 0; i < 5; i++) { const x = dx + ((i + 0.4) / 5) * W, s = H * 0.3, pts = [[0, 0], [-0.25, 0.45], [0.02, 0.42], [-0.3, 1], [0.3, 0.4], [0.03, 0.44], [0.28, 0]]; for (const [col, k] of [[c2, 1.25], [c1, 1]]) { g.fillStyle = col; g.beginPath(); pts.forEach(([px, py], j) => { const X = x + px * s * k, Y = H * 0.25 + py * s + (1 - k) * s * 0.05; if (j) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fill(); } } });
    },
    wings(g, W, H, c1, c2) {
      g.lineCap = 'round';
      tile(W, (dx) => { for (const [sx, dir] of [[0.28, -1], [0.72, 1]]) { const ox = dx + W * sx, oy = H * 0.55; for (let k = 0; k < 7; k++) { const a = -0.15 - k * 0.19, L = H * (0.34 - k * 0.028); g.strokeStyle = k % 2 ? c2 : c1; g.lineWidth = H * (0.03 - k * 0.002); g.beginPath(); g.moveTo(ox, oy); g.quadraticCurveTo(ox + dir * L * 0.6, oy + Math.sin(a) * L * 0.9 - L * 0.1, ox + dir * L * Math.cos(a * 0.6) * 1.1, oy + Math.sin(a) * L); g.stroke(); } } });
    },
    glitch(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => { for (let i = 0; i < 46; i++) { const y = H * (0.2 + rnd() * 0.44), h = H * (0.008 + rnd() * 0.03), x = dx + rnd() * W, w = W * (0.03 + rnd() * 0.18); g.fillStyle = rnd() < 0.5 ? c1 : c2; g.fillRect(x, y, w, h); if (rnd() < 0.3) { g.fillStyle = '#ffffff'; g.fillRect(x + w * 0.3, y, w * 0.08, h); } } });
    },
    rings(g, W, H, c1, c2) {
      tile(W, (dx) => { for (const sx of [0.25, 0.75]) { const cx = dx + W * sx, cy = H * 0.42; for (let r = 7; r >= 1; r--) { g.strokeStyle = r % 2 ? c1 : '#ffffff'; g.globalAlpha = 0.25 + 0.75 * (1 - r / 8); g.lineWidth = H * 0.01; g.beginPath(); g.arc(cx, cy, r * H * 0.03, 0, Math.PI * 2); g.stroke(); } g.globalAlpha = 1; g.fillStyle = c2; circ(g, cx, cy, H * 0.035); } });
    },
    vinyl(g, W, H, c1, c2) {
      tile(W, (dx) => { for (const sx of [0.22, 0.52, 0.82]) { const cx = dx + W * sx, cy = H * 0.42, R = H * 0.16; g.fillStyle = '#111111'; circ(g, cx, cy, R); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let r = R * 0.45; r < R; r += R * 0.09) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); } g.fillStyle = c1; circ(g, cx, cy, R * 0.36); g.fillStyle = c2; circ(g, cx, cy, R * 0.07); } });
    },
    retro(g, W, H, c1, c2, rnd) {
      const s = Math.max(4, Math.round(H / 14));
      for (let y = Math.round(H * 0.2 / s) * s; y < H * 0.62; y += s) for (let x = 0; x < W; x += s) { const v = rnd(); if (v < 0.22) { g.fillStyle = c1; g.fillRect(x, y, s, s); } else if (v < 0.32) { g.fillStyle = c2; g.fillRect(x, y, s, s); } }
    },
    speed(g, W, H, c1, c2, rnd) {
      tile(W, (dx) => { for (let i = 0; i < 26; i++) { const y = H * (0.22 + rnd() * 0.4), L = W * (0.08 + rnd() * 0.3), x = dx + rnd() * W, h = H * (0.006 + rnd() * 0.02); const gr = g.createLinearGradient(x, 0, x + L, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, i % 3 ? c1 : c2); g.fillStyle = gr; g.fillRect(x, y, L, h); } });
    },
    ball(g, W, H, c1, c2) {
      tile(W, (dx) => { for (let i = 0; i < 4; i++) ball(g, dx + ((i + 0.5) / 4) * W, H * (0.4 + (i % 2) * 0.06), H * (0.1 + (i % 2) * 0.03), c2); });
    },
    medley(g, W, H, c1, c2, rnd) {
      MOTIF.notes(g, W, H, c1, '#ffffff', rnd);
      tile(W, (dx) => { for (const sx of [0.2, 0.7]) ball(g, dx + W * sx, H * 0.46, H * 0.1, c2); });
    },
    trophy(g, W, H, c1, c2) {
      tile(W, (dx) => { for (const sx of [0.25, 0.75]) {
        const cx = dx + W * sx, cy = H * 0.46;
        for (const dir of [-1, 1]) for (let k = 0; k < 7; k++) { const a = 0.3 + k * 0.28, x = cx + dir * (H * 0.09 + Math.sin(a) * H * 0.18), y = cy + Math.cos(a) * H * 0.16 - k * H * 0.004; g.fillStyle = c1; g.beginPath(); g.ellipse(x, y, H * 0.032, H * 0.014, dir * (0.4 + k * 0.3), 0, Math.PI * 2); g.fill(); }
        g.fillStyle = c1; g.beginPath(); g.moveTo(cx - H * 0.07, cy - H * 0.16); g.lineTo(cx + H * 0.07, cy - H * 0.16); g.quadraticCurveTo(cx + H * 0.07, cy + H * 0.02, cx, cy + H * 0.04); g.quadraticCurveTo(cx - H * 0.07, cy + H * 0.02, cx - H * 0.07, cy - H * 0.16); g.fill();
        g.fillRect(cx - H * 0.012, cy + H * 0.03, H * 0.024, H * 0.06); g.fillRect(cx - H * 0.05, cy + H * 0.085, H * 0.1, H * 0.02);
      } });
    },
    anthem(g, W, H, c1, c2) {
      // chevrons racing behind a ball
      tile(W, (dx) => { for (let i = 0; i < 10; i++) { const x = dx + (i / 10) * W; g.fillStyle = i % 2 ? c1 : 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(x, H * 0.26); g.lineTo(x + W * 0.05, H * 0.42); g.lineTo(x, H * 0.58); g.lineTo(x + W * 0.02, H * 0.58); g.lineTo(x + W * 0.07, H * 0.42); g.lineTo(x + W * 0.02, H * 0.26); g.fill(); } ball(g, dx + W * 0.5, H * 0.42, H * 0.15, c2); });
    },
  };
  function paintSong(g, W, H, base, acc, t) {
    const rnd = BL.util.rng(BL.util.hash('song' + t.id)), [c1, c2] = t.c, m = songDef(t.id), name = m ? m.name : t.id;
    g.save();
    // a band of the second colour under the picture, for the ones that need the contrast
    if (t.band) { g.fillStyle = c2; g.fillRect(0, H * 0.18, W, H * 0.46); }
    MOTIF[t.m](g, W, H, c1, c2, rnd);
    // the title, a ticker along the lower side (and again a width over, so it wraps without a seam). Both sides of a
    // car share the one texture, mirrored, so the lettering is drawn backward here: it reads the right way round on
    // the side the garage shows (the car's right), like a real one-sided livery.
    const text = name.toUpperCase();
    let px = Math.round(H * 0.085);
    g.font = FONT(px); const want = W * 0.9; let tw = g.measureText(text).width;
    if (tw > want) { px = Math.max(6, Math.floor(px * want / tw)); g.font = FONT(px); tw = g.measureText(text).width; }
    g.textBaseline = 'middle'; g.textAlign = 'left';
    tile(W, (dx) => {
      g.save(); g.translate(dx + W * 0.05 + tw, H * 0.69); g.scale(-1, 1);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(text, -px * 0.08, px * 0.08);
      g.fillStyle = acc && acc !== '#f5f5f5' ? acc : c1; g.fillText(text, 0, 0);
      g.restore();
    });
    // the roof line
    g.fillStyle = c1; g.fillRect(0, H * 0.03, W, H * 0.025); g.fillStyle = c2; g.fillRect(0, H * 0.062, W, H * 0.012);
    g.restore();
  }
  if (BL.Models && BL.Models.registerDecal) for (const s of SONGS) BL.Models.registerDecal('song_' + s.id, (g, W, H, base, acc) => paintSong(g, W, H, base, acc, s));
})(window.BL);
