'use strict';
// Rocket League (fan remake) - more cosmetics:
//  - SUPERSONIC TRAILS (their own garage slot): what streams off your car once you go supersonic. Two ribbons from
//    the back corners plus a stream of sprites, each trail with its own colours, width, length and particles
//    (js/carmodels.js draws the ribbons, FX.supersonicTrail the sprites)
//  - more decals (painted here, registered with js/carmodels.js), wheels, boosts and toppers built from the shapes
//    the game already has
(function (BL) {
  const U = BL.util;
  const push = (it) => { if (!BL.ITEM_BY_ID[it.id]) { BL.ITEMS.push(it); BL.ITEM_BY_ID[it.id] = it; } };
  const add = (cat, id, name, rarity, extra) => push(Object.assign({ id: cat + '_' + id, cat, name, rarity }, extra || {}));

  // ---------- supersonic trails ----------
  // tr: ribbon colour (or 'rainbow' / 'flicker'), width w, life (s); p: the sprites (shape s by name, colours c,
  // size [start, end], life, n per frame, spread, back = how much of the car's speed they keep, up, grav, blend)
  const TR = (id, name, rarity, tr, extra) => add('trail', id, name, rarity, Object.assign({ tr }, extra || {}));
  TR('standard', 'Standard', 'common', { col: '#d9f2ff', w: 0.16, life: 0.55, p: { s: 'puff', c: ['#ffffff', '#7fc8ff'], size: [0.42, 0.05], life: 0.34, n: 2, back: 0.35 } }, { def: true });
  TR('pure', 'Pure White', 'common', { col: '#ffffff', w: 0.2, life: 0.8, p: { s: 'dot', c: ['#ffffff', '#e8f4ff'], size: [0.3, 0.02], life: 0.3, n: 1, back: 0.3 } });
  TR('ion', 'Ion', 'common', { col: '#5fd0ff', w: 0.18, life: 0.6, p: { s: 'twinkle', c: ['#e0faff', '#2fa8ff'], size: [0.35, 0.05], life: 0.35, n: 2, back: 0.3 } });
  TR('sunburst', 'Sunburst', 'uncommon', { col: '#ffb347', w: 0.2, life: 0.6, p: { s: 'fire', c: ['#fff2a8', '#ff6a1f'], size: [0.45, 0.08], life: 0.32, n: 2, back: 0.3, up: 0.6 } });
  TR('toxic', 'Toxic', 'uncommon', { col: '#7dff4a', w: 0.18, life: 0.6, p: { s: 'bubble', c: ['#e6ffd0', '#4ad21e'], size: [0.18, 0.4], life: 0.6, n: 1, back: 0.2, up: 1.2 } });
  TR('crimson', 'Crimson Streak', 'uncommon', { col: '#ff3b4a', w: 0.2, life: 0.7, p: { s: 'shard', c: ['#ffd0d4', '#c4001a'], size: [0.3, 0.05], life: 0.3, n: 2, back: 0.35 } });
  TR('royal', 'Royal', 'uncommon', { col: '#a46bff', w: 0.18, life: 0.65, p: { s: 'twinkle', c: ['#f3e8ff', '#7a3cff'], size: [0.34, 0.05], life: 0.4, n: 2, back: 0.3 } });
  TR('hearts', 'Lovestruck', 'rare', { col: '#ff6fa8', w: 0.17, life: 0.6, p: { s: 'heart', c: ['#ffd6e7', '#ff2f6d'], size: [0.26, 0.12], life: 0.55, n: 1, back: 0.2, up: 0.8, rot: 'up' } });
  TR('snow', 'Snowdrift', 'rare', { col: '#e6f6ff', w: 0.18, life: 0.7, p: { s: 'flake', c: ['#ffffff', '#bfe6ff'], size: [0.24, 0.1], life: 0.8, n: 1, back: 0.15, grav: 1.2, spin: 2 } });
  TR('bubbles', 'Bubble Wake', 'rare', { col: '#8fe0ff', w: 0.16, life: 0.6, p: { s: 'bubble', c: ['#ffffff', '#4fc3f7'], size: [0.12, 0.34], life: 0.8, n: 1, back: 0.1, up: 1.6 } });
  TR('petals', 'Blossom', 'rare', { col: '#ffb1cf', w: 0.15, life: 0.7, p: { s: 'petal', c: ['#ffe0ec', '#ff7aa8'], size: [0.22, 0.14], life: 0.9, n: 1, back: 0.15, grav: 0.8, spin: 3 } });
  TR('notes', 'Encore', 'rare', { col: '#ffd166', w: 0.15, life: 0.6, p: { s: 'note', c: ['#fff6d6', '#ffb000'], size: [0.26, 0.14], life: 0.7, n: 1, back: 0.15, up: 1, rot: 'up' } });
  TR('pixels', '8-Bit Dash', 'veryrare', { col: '#39e6c0', w: 0.2, life: 0.55, p: { s: 'pixel', c: ['#ffffff', '#ff5fa2'], size: [0.2, 0.06], life: 0.4, n: 2, back: 0.3, rot: 'none' } });
  TR('flames', 'Afterburner', 'veryrare', { col: '#ff7a1f', w: 0.24, life: 0.6, p: { s: 'fire', c: ['#ffffff', '#ff3d00'], size: [0.6, 0.1], life: 0.38, n: 3, back: 0.25, up: 0.8 } });
  TR('smoke', 'Burnout', 'veryrare', { col: '#9aa0a8', w: 0.2, life: 0.7, add: false, p: { s: 'puff', c: ['#d5d8dd', '#4a4f57'], size: [0.4, 1.1], life: 0.7, n: 1, back: 0.1, up: 0.5, blend: 'alpha', alpha: 0.55 } });
  TR('lightning', 'Thunderclap', 'veryrare', { col: 'flicker', w: 0.2, life: 0.45, p: { s: 'shard', c: ['#ffffff', '#5fa8ff'], size: [0.36, 0.05], life: 0.22, n: 3, back: 0.4, spread: 0.6 } });
  TR('stars', 'Starfall', 'import', { col: '#fff1b8', w: 0.18, life: 0.75, p: { s: 'star', c: ['#ffffff', '#ffd23f'], size: [0.3, 0.06], life: 0.6, n: 2, back: 0.2, grav: 1.5, spin: 4 } });
  TR('galaxy', 'Galaxy', 'import', { col: '#9b5cff', w: 0.22, life: 0.8, p: { s: 'twinkle', c: ['#ffffff', '#ff4fd8'], size: [0.32, 0.04], life: 0.6, n: 3, back: 0.2, spread: 0.7 } });
  TR('glitch', 'Glitch', 'import', { col: 'flicker', w: 0.2, life: 0.5, p: { s: 'glyph', c: ['#00f0ff', '#ff2bd6'], size: [0.26, 0.1], life: 0.35, n: 2, back: 0.3, rot: 'none' } });
  TR('leaves', 'Autumn Wind', 'import', { col: '#ff9a3c', w: 0.16, life: 0.7, p: { s: 'leaf', c: ['#ffd06b', '#b8471a'], size: [0.26, 0.16], life: 0.9, n: 1, back: 0.15, grav: 0.9, spin: 3 } });
  TR('coins', 'High Roller', 'exotic', { col: '#ffd451', w: 0.2, life: 0.7, p: { s: 'coin', c: ['#fff6c8', '#ffb300'], size: [0.24, 0.16], life: 0.7, n: 1, back: 0.15, grav: 4, up: 1.5, spin: 6 } });
  TR('rings', 'Sonic Rings', 'exotic', { col: '#7df9ff', w: 0.18, life: 0.6, p: { s: 'ring', c: ['#ffffff', '#2fe6ff'], size: [0.2, 0.9], life: 0.35, n: 1, back: 0.05, rot: 'none' } });
  TR('skulls', 'Haunted', 'exotic', { col: '#8dff8a', w: 0.18, life: 0.7, p: { s: 'skull', c: ['#e8ffe6', '#2fbf5a'], size: [0.26, 0.12], life: 0.6, n: 1, back: 0.15, up: 0.9, rot: 'up' } });
  TR('rainbow', 'Rainbow Road', 'blackmarket', { col: 'rainbow', w: 0.26, life: 0.9, p: { s: 'twinkle', c: ['#ffffff', '#ffe23d'], size: [0.3, 0.05], life: 0.45, n: 2, back: 0.25, hue: true } });
  TR('plasma', 'Plasma Core', 'blackmarket', { col: '#ff2bd6', w: 0.28, life: 0.7, p: { s: 'fire', c: ['#ffffff', '#7a2bff'], size: [0.5, 0.08], life: 0.32, n: 3, back: 0.3, hue: true } });
  TR('gold', 'Gilded Comet', 'blackmarket', { col: '#ffe08a', w: 0.24, life: 0.85, p: { s: 'twinkle', c: ['#ffffff', '#ffc400'], size: [0.36, 0.04], life: 0.55, n: 3, back: 0.2, spread: 0.5 } });
  TR('fest', 'Harvest Moon', 'limited', { col: '#ff9a3c', w: 0.22, life: 0.8, p: { s: 'leaf', c: ['#ffe2a0', '#d4541c'], size: [0.3, 0.14], life: 0.9, n: 2, back: 0.15, grav: 0.8, spin: 3 } }, { fest: 'thanksgiving', pass: 'fest' });

  // ---------- more decals ----------
  const reg = (name, fn) => BL.Models && BL.Models.registerDecal && BL.Models.registerDecal(name, fn);
  const tile = (W, fn) => { for (const dx of [-W, 0, W]) fn(dx); };
  reg('blocks', (g, W, H, base, acc) => { const rnd = U.rng(3); for (let i = 0; i < 40; i++) { g.fillStyle = i % 3 ? acc : U.shade(base, -0.35); const w = W * (0.03 + rnd() * 0.08), h = H * (0.05 + rnd() * 0.12); g.fillRect(rnd() * W, H * (0.2 + rnd() * 0.42), w, h); } });
  reg('tri', (g, W, H, base, acc) => { g.fillStyle = acc; for (let x = 0; x < W; x += W / 14) { g.beginPath(); g.moveTo(x, H * 0.66); g.lineTo(x + W / 28, H * 0.36); g.lineTo(x + W / 14, H * 0.66); g.fill(); } g.fillRect(0, H * 0.66, W, H * 0.03); });
  reg('wave2', (g, W, H, base, acc) => { g.fillStyle = acc; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 4) g.lineTo(x, H * (0.5 + 0.08 * Math.sin((x / W) * Math.PI * 6))); g.lineTo(W, H); g.fill(); g.fillStyle = U.shade(acc, -0.3); g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 4) g.lineTo(x, H * (0.62 + 0.06 * Math.sin((x / W) * Math.PI * 6 + 1.6))); g.lineTo(W, H); g.fill(); });
  reg('diag', (g, W, H, base, acc) => { g.strokeStyle = acc; g.lineWidth = H * 0.05; for (let x = -W; x < W * 2; x += W / 10) { g.beginPath(); g.moveTo(x, H * 0.2); g.lineTo(x + H * 0.45, H * 0.68); g.stroke(); } });
  reg('polka', (g, W, H, base, acc) => { g.fillStyle = acc; for (let y = 0; y < 6; y++) for (let x = 0; x < 18; x++) { g.beginPath(); g.arc(((x + (y % 2) * 0.5) / 18) * W, H * (0.2 + y * 0.09), H * 0.025, 0, Math.PI * 2); g.fill(); } });
  reg('scribble', (g, W, H, base, acc) => { const rnd = U.rng(9); g.strokeStyle = acc; g.lineWidth = H * 0.016; g.lineCap = 'round'; for (let k = 0; k < 7; k++) { let x = rnd() * W, y = H * (0.25 + rnd() * 0.35); g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 14; j++) { x += (rnd() - 0.3) * W * 0.04; y += (rnd() - 0.5) * H * 0.08; g.lineTo(x, y); } g.stroke(); } });
  reg('turbo', (g, W, H, base, acc) => { g.fillStyle = acc; g.fillRect(0, H * 0.44, W, H * 0.05); g.fillRect(0, H * 0.52, W, H * 0.02); g.font = `bold ${Math.round(H * 0.14)}px Arial Black, Impact, Arial`; g.textBaseline = 'middle'; tile(W, (dx) => { g.save(); g.translate(dx + W * 0.62, H * 0.33); g.scale(-1, 1); g.fillText('TURBO', 0, 0); g.restore(); }); });
  reg('fang', (g, W, H, base, acc) => { g.fillStyle = acc; for (let i = 0; i < 6; i++) { const x = (i / 6) * W; g.beginPath(); g.moveTo(x, H * 0.36); g.lineTo(x + W * 0.09, H * 0.36); g.lineTo(x + W * 0.03, H * 0.62); g.fill(); } g.fillRect(0, H * 0.32, W, H * 0.04); });
  reg('topo', (g, W, H, base, acc) => { g.strokeStyle = U.hexA(acc, 0.8); g.lineWidth = H * 0.008; for (let k = 0; k < 9; k++) { g.beginPath(); for (let x = 0; x <= W; x += 4) { const y = H * (0.2 + k * 0.05) + Math.sin(x / W * Math.PI * 4 + k * 0.7) * H * 0.03 + Math.sin(x / W * Math.PI * 10 + k) * H * 0.01; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); } });
  reg('flagstripe', (g, W, H, base, acc) => { const c = [acc, '#ffffff', U.shade(base, -0.4)]; for (let i = 0; i < 3; i++) { g.fillStyle = c[i]; g.fillRect(0, H * (0.4 + i * 0.07), W, H * 0.06); } });
  reg('harvest', (g, W, H, base, acc) => { const rnd = U.rng(31); const cols = ['#ffb347', '#d4541c', '#ffd06b', '#8c3b12']; for (let i = 0; i < 46; i++) { const x = rnd() * W, y = H * (0.2 + rnd() * 0.44), s = H * (0.02 + rnd() * 0.035), a = rnd() * 6.28; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(0, 0, s * 1.6, s * 0.7, 0, 0, Math.PI * 2); g.fill(); g.restore(); } });
  reg('frost', (g, W, H, base, acc) => { const rnd = U.rng(77); g.strokeStyle = 'rgba(235,248,255,0.85)'; g.lineWidth = H * 0.006; for (let i = 0; i < 26; i++) { const x = rnd() * W, y = H * (0.22 + rnd() * 0.42), r = H * (0.02 + rnd() * 0.035); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); } } });
  const DEC = (id, name, rarity, extra) => add('decal', id, name, rarity, Object.assign({ pattern: id }, extra || {}));
  DEC('blocks', 'Blockade', 'common'); DEC('tri', 'Sawtooth', 'common'); DEC('wave2', 'Tidal', 'uncommon'); DEC('diag', 'Hazard Lines', 'uncommon');
  DEC('polka', 'Polka', 'uncommon'); DEC('scribble', 'Scribbles', 'rare'); DEC('turbo', 'Turbo Script', 'rare'); DEC('fang', 'Fangs', 'rare');
  DEC('topo', 'Topographic', 'veryrare'); DEC('flagstripe', 'Tri-Stripe', 'veryrare');
  DEC('harvest', 'Harvest', 'import', { fest: 'thanksgiving', pass: 'fest' }); DEC('frost', 'Frostbite', 'import', { fest: 'winter', pass: 'fest' });
  // animated versions of a few (they drift along the car and pulse with speed, like the others)
  DEC('diag_run', 'Caution Run', 'exotic', { pattern: 'diag', animated: true, anim: 'race' });
  DEC('topo_flow', 'Contour Flow', 'exotic', { pattern: 'topo', animated: true, anim: 'flow' });

  // ---------- wheels, boosts and toppers from the shapes the game already draws ----------
  const WH = (id, name, rarity, rim) => add('wheels', id, name, rarity, { rim });
  WH('cobalt', 'Cobalt Spoke', 'common', { style: 'spoke', spokes: 7, color: '#2f6bd6' });
  WH('crimsondish', 'Crimson Dish', 'uncommon', { style: 'dish', spokes: 6, color: '#c4202f' });
  WH('ghost', 'Ghost Turbine', 'rare', { style: 'turbine', spokes: 14, color: '#e8edf5', glow: '#cfe6ff' });
  WH('solar', 'Solar Star', 'rare', { style: 'star', spokes: 5, color: '#1c1208', glow: '#ffb300' });
  WH('aqua', 'Aqua Ring', 'veryrare', { style: 'ring', spokes: 6, color: '#0e1a22', glow: '#00e5c0' });
  WH('venom', 'Venom Tri', 'import', { style: 'tri', spokes: 3, color: '#0a140a', glow: '#76ff03', anim: 'pulse' });
  WH('prism', 'Prism Spiral', 'exotic', { style: 'spiral', spokes: 9, color: '#101018', glow: '#ff4fd8', anim: 'hue' });
  WH('harvest', 'Harvest Spokes', 'import', { style: 'spoke', spokes: 12, color: '#8c3b12', glow: '#ffb347' });
  const BO = (id, name, rarity, fx, extra) => add('boost', id, name, rarity, Object.assign({ fx }, extra || {}));
  BO('emerald', 'Emerald Flame', 'uncommon', { colors: ['#e6ffe6', '#4cff7a', '#0a9b3c'], shape: 0, size: [0.5, 0.1], life: 0.3, speed: 9, spread: 0.1, rate: 70, flame: '#4cff7a' });
  BO('violet', 'Violet Flame', 'uncommon', { colors: ['#f3e6ff', '#b46bff', '#5a1fd6'], shape: 0, size: [0.5, 0.1], life: 0.3, speed: 9, spread: 0.1, rate: 70, flame: '#b46bff' });
  BO('sunset', 'Sunset Burner', 'rare', { colors: ['#ffe6a8', '#ff7a5c', '#c4207a'], shape: 0, size: [0.6, 0.12], life: 0.34, speed: 8, spread: 0.14, rate: 70, flame: '#ff7a5c' });
  BO('ice', 'Cryo Jet', 'rare', { colors: ['#ffffff', '#bfefff', '#4fb7ff'], shape: 1, size: [0.45, 0.06], life: 0.5, speed: 7, spread: 0.25, rate: 60, flame: '#bfefff' });
  BO('ember', 'Ember Storm', 'veryrare', { colors: ['#fff2a8', '#ff8a1f', '#a12a00'], shape: 0, size: [0.55, 0.1], life: 0.5, speed: 6, spread: 0.3, rate: 80, grav: -1, flame: '#ff8a1f', smoke: true });
  BO('harvest', 'Hearth Fire', 'import', { colors: ['#ffe2a0', '#ff9a3c', '#8c3b12'], shape: 0, size: [0.6, 0.12], life: 0.36, speed: 8, spread: 0.16, rate: 75, flame: '#ff9a3c', smoke: true }, { fest: 'thanksgiving', pass: 'fest' });
  const TO = (id, name, rarity, shape, color) => add('topper', id, name, rarity, { shape, color });
  TO('goldhat', 'Golden Top Hat', 'veryrare', 'tophat', '#ffc400');
  TO('icecone', 'Ice Cone', 'uncommon', 'cone', '#9fe8ff');
  TO('frostantlers', 'Frost Antlers', 'rare', 'antlers', '#d8f2ff');
  TO('blackhorns', 'Shadow Horns', 'veryrare', 'devil', '#1a1a1a');
  TO('neonfin', 'Neon Fin', 'rare', 'sharkfin', '#00e5ff');
})(window.BL);
