'use strict';
// Rocket League (fan remake) - the menus laid out like the real game (from the user's reference screenshots):
// title screen, main menu, Play tiles, Casual / Competitive playlists, Tournaments, Training packs, Play Offline
// (Exhibition, Season), Private Match, garage presets, Profile, Club, friends panel, player banner and the
// "now playing" card. It builds on the screens and actions in js/menu.js (BL.Menu._x).
// Playlists start local matches with bots that look online (searching, joining, player-style names) unless you're
// in an online party, which uses the real online flow.
(function (BL) {
  const M = BL.Menu, U = BL.util, S = BL.Save, X = M._x;
  if (!X) return;
  const { SCREENS, ACT, AFTER, HISTORY, esc, seg, itemCard, mapCards } = X;
  const R = (id) => BL.RARITIES[id] || BL.RARITIES.common;
  const TILE = (n) => 'assets/ui/tiles/' + n + '.jpg';
  const old = { garage: SCREENS.garage, garageAfter: AFTER.garage, profile: SCREENS.profile, tradein: SCREENS.tradein, settings: SCREENS.settings,
    pmMenu: ACT.pmMenu, pmRematch: ACT.pmRematch, leaveMatch: ACT.leaveMatch, pmLobby: ACT.pmLobby, hideLoading: M.hideLoading };
  M.titleScreen = true;

  // ---------- profile fields this file adds ----------
  function ext() {
    const p = S.p;
    if (!p.presets || !p.presets.length) { p.presets = [{ name: 'PRESET 1', loadout: Object.assign({}, p.loadout), colors: Object.assign({}, p.colors) }]; p.presetIdx = 0; }
    p.history = p.history || [];
    p.banner = p.banner || 'default';
    p.border = p.border || 'none';
    p.seasonReward = p.seasonReward || { tier: 0, wins: 0 };
    p.tour = p.tour || { reg: [], rank: 0, wins: 0, cur: null, best: [] };
    p.settings.prefMaps = p.settings.prefMaps || null;
    p.settings.region = p.settings.region || 'USE';
    return p;
  }

  // ---------- shared pieces ----------
  const RANK_FILTER = ['grayscale(1) sepia(1) saturate(1.8) hue-rotate(-18deg) brightness(0.72)', 'grayscale(1) brightness(1.3)', 'grayscale(1) sepia(1) saturate(3.4) hue-rotate(2deg) brightness(1.12)',
    'hue-rotate(-38deg) saturate(0.85) brightness(1.15)', 'none', 'hue-rotate(62deg) saturate(1.25)', 'none', 'none'];
  // rank emblem (the rendered Diamond / Grand Champion / Supersonic Legend badges, recoloured for the other ranks)
  function rankIcon(mmr, cls) {
    const r = S.rankInfo(mmr || 0);
    const src = r.tier >= 7 ? 'ssl' : r.tier === 6 ? 'grandchampion3' : 'diamond3';
    return `<span class="rl-rk ${cls || ''}" title="${esc(r.full)}"><img src="assets/ui/ranks/${src}.png" style="filter:${RANK_FILTER[r.tier] || 'none'}" alt="" draggable="false"></span>`;
  }
  M.rankIcon = rankIcon;
  const tile = (img, act, arg, cls, extra) => `<button class="rl-tile ${cls || ''}" data-act="${act}" data-arg="${esc(arg || '')}"><img src="${TILE(img)}" alt="" draggable="false">${extra || ''}</button>`;
  const btn = (label, act, arg, cls) => `<button class="rl-btn ${cls || ''}" data-act="${act}" data-arg="${esc(arg || '')}">${label}</button>`;
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const bucket = () => Math.floor(Date.now() / 600000);
  const onlineCount = () => Math.round(585000 + 70000 * Math.sin(bucket() * 0.37) + ((U.hash('on' + bucket()) >>> 0) % 15000));
  const pickName = (pool, used) => { let n = U.choice(pool), k = 0; while (used.has(n) && k++ < 60) n = U.choice(pool); if (used.has(n)) n += U.randInt(2, 99); used.add(n); return n; };
  const shuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd || Math.random)() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MAP_POOL = () => BL.MAPS.filter((m) => !m.labs && S.isMapUnlocked(m.id));
  function pickMap() {
    const pref = S.p.settings.prefMaps;
    const pool = MAP_POOL().filter((m) => !pref || pref.indexOf(m.id) >= 0);
    return U.choice(pool.length ? pool : MAP_POOL()).id;
  }

  // ---------- player banners and avatar borders (like the real Player Identity screens) ----------
  // Banners are little pictures drawn here as SVG, with the art toward the right where the name isn't; the old
  // colour banners stay too. Borders are frames drawn round the avatar: Default, the XP Level set (silver with
  // blue, more ornate every 25 levels), a few specials and the rank borders earned in Competitive.
  const svgUrl = (w, h, body, extra) => `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${extra || ''}>${body}</svg>`)}')`;
  const art = (body) => svgUrl(300, 100, body, 'preserveAspectRatio="xMaxYMid slice"') + ' right center/cover no-repeat';
  const scatter = (seed, n, fn) => { let s = seed, o = ''; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < n; i++) o += fn(r, i); return o; };
  const lin = (id, stops, x2, y2) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2 == null ? 1 : x2}" y2="${y2 || 0}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const bgRect = (fill) => `<rect width="300" height="100" fill="${fill}"/>`;
  const heartP = (x, y, s, f, extra) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -3C-2 -7 -8 -7 -8 -2C-8 3 -2 6 0 9C2 6 8 3 8 -2C8 -7 2 -7 0 -3Z" fill="${f}" ${extra || ''}/>`;
  const pent = (cx, cy, s, rot) => `<polygon points="${[0, 1, 2, 3, 4].map((k) => { const a = rot + (k * 2 * Math.PI) / 5; return (cx + Math.sin(a) * s).toFixed(1) + ',' + (cy - Math.cos(a) * s).toFixed(1); }).join(' ')}" fill="#1b1d22"/>`;
  const sball = (x, y, r) => {
    let o = `<defs><clipPath id="cb"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><radialGradient id="sb" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9bfca"/></radialGradient></defs><circle cx="${x}" cy="${y}" r="${r}" fill="url(#sb)"/><g clip-path="url(#cb)">${pent(x, y, r * 0.32, 0)}`;
    for (let k = 0; k < 5; k++) {
      const a = (k * 2 * Math.PI) / 5;
      o += `<line x1="${x + Math.sin(a) * r * 0.32}" y1="${y - Math.cos(a) * r * 0.32}" x2="${x + Math.sin(a) * r * 0.7}" y2="${y - Math.cos(a) * r * 0.7}" stroke="#1b1d22" stroke-width="${r * 0.06}"/>` + pent(x + Math.sin(a) * r * 0.98, y - Math.cos(a) * r * 0.98, r * 0.3, a + Math.PI);
    }
    return o + `</g><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#1b1d22" stroke-width="${r * 0.05}"/>`;
  };
  const hexes = () => { let o = ''; for (let y = -10, row = 0; y < 110; y += 24, row++) for (let x = row % 2 ? 14 : 0; x < 310; x += 28) o += `<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => (x + Math.cos((k * Math.PI) / 3) * 14).toFixed(1) + ',' + (y + Math.sin((k * Math.PI) / 3) * 14).toFixed(1)).join(' ')}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="2"/>`; return o; };
  const grid = () => { let o = ''; for (let x = 100; x <= 300; x += 20) o += `<line x1="${x}" y1="0" x2="${x}" y2="100"/>`; for (let y = 0; y <= 100; y += 20) o += `<line x1="100" y1="${y}" x2="300" y2="${y}"/>`; return o; };
  const sticker = (r) => {
    const x = 110 + r() * 190, y = r() * 100, s = 6 + r() * 9, c = ['#ffd23f', '#ff5fa2', '#39e6c0', '#ffffff', '#ff8a1f'][Math.floor(r() * 5)], k = Math.floor(r() * 3);
    if (k === 0) return `<circle cx="${x}" cy="${y}" r="${s}" fill="${c}" stroke="#fff" stroke-width="2.5"/>`;
    if (k === 1) return `<rect x="${x - s}" y="${y - s * 0.7}" width="${s * 2}" height="${s * 1.4}" rx="3" fill="${c}" stroke="#fff" stroke-width="2.5" transform="rotate(${(r() * 60 - 30).toFixed(0)} ${x} ${y})"/>`;
    return `<polygon points="${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => { const a = (q * Math.PI) / 5, rr = q % 2 ? s * 0.45 : s; return (x + Math.sin(a) * rr).toFixed(1) + ',' + (y - Math.cos(a) * rr).toFixed(1); }).join(' ')}" fill="${c}" stroke="#fff" stroke-width="2"/>`;
  };
  const ghost = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M-16 18V-2A16 16 0 0 1 16 -2V18L10 13 5 18 0 13 -5 18 -10 13Z" fill="#f4f1ff"/><circle cx="${x - 6 * s}" cy="${y}" r="${3 * s}" fill="#ff4f8b"/><circle cx="${x + 6 * s}" cy="${y}" r="${3 * s}" fill="#ff4f8b"/>`;
  const bandage = (x, y, a) => `<g transform="rotate(${a} ${x} ${y})"><rect x="${x - 45}" y="${y - 12}" width="90" height="24" rx="12" fill="#f3d2b0"/><rect x="${x - 13}" y="${y - 10}" width="26" height="20" rx="4" fill="#e5b98f"/>${[0, 1, 2].map((k) => `<circle cx="${x - 6 + k * 6}" cy="${y}" r="1.5" fill="#c9966a"/>`).join('')}</g>`;
  const BANNERS = [
    { id: 'default', name: 'Standard', lvl: 1, rar: 'Common', css: art(`<defs>${lin('a', ['#1f6fe2', '#0c3a9e', '#082a78'], 1, 1)}</defs>${bgRect('url(#a)')}<path d="M150 0h40l-60 100h-40z" fill="#ffffff" opacity="0.05"/><circle cx="248" cy="50" r="40" fill="none" stroke="#9fd0ff" stroke-width="7" opacity="0.18"/><path d="M214 58c8 -14 20 -20 38 -20 12 0 22 4 30 10l-2 10h-8a7 7 0 0 0 -14 0h-26a7 7 0 0 0 -14 0z" fill="#9fd0ff" opacity="0.22"/>`) },
    { id: 'hearts', name: 'Hearts', lvl: 3, css: art(bgRect('#5a60c8') + scatter(7, 16, (r) => heartP((120 + r() * 180).toFixed(1), (r() * 100).toFixed(1), (1.2 + r() * 2.6).toFixed(2), r() > 0.5 ? '#6c74df' : '#484eb2'))) },
    { id: 'ishihara', name: 'Ishihara', lvl: 5, css: art(bgRect('#2b78d2') + scatter(11, 90, (r) => `<circle cx="${(90 + r() * 215).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(2 + r() * 8).toFixed(1)}" fill="${['#1a58b0', '#4ea4f2', '#2766c4', '#73bdfd', '#1f4f9c'][Math.floor(r() * 5)]}"/>`)) },
    { id: 'soccerball', name: 'Soccer Ball', lvl: 7, css: art(`<defs>${lin('a', ['#d61a24', '#8d0b12'], 1, 1)}</defs>${bgRect('url(#a)')}${hexes()}`) },
    { id: 'futurefashion', name: 'Future Fashion', lvl: 9, css: art(`<defs>${lin('a', ['#f2fbff', '#c9ecff'], 1, 1)}</defs>${bgRect('url(#a)')}<g fill="#ffffff" opacity="0.8"><path d="M120 0h70l-40 100h-70z"/><path d="M230 0h40l-50 100h-40z"/></g><g stroke="#4fb3ea" stroke-width="2" fill="none"><path d="M105 100L175 0M200 100L270 0M260 100L300 40"/><path d="M150 0L300 70" opacity="0.6"/></g>`) },
    { id: 'junkfood', name: 'Junk Food', lvl: 11, css: art(`<defs>${lin('a', ['#35d47f', '#1fae58'], 1, 1)}</defs>${bgRect('url(#a)')}<g fill="none" stroke="#ffe23d" stroke-width="3.5" stroke-linecap="round"><circle cx="160" cy="30" r="11"/><circle cx="160" cy="30" r="3"/><rect x="235" y="14" width="52" height="20" rx="10" transform="rotate(-25 261 24)"/><path d="M240 30q20 -8 40 -12"/><path d="M190 70l4 -22h18l4 22zM196 48l-2 -10M202 48v-12M208 48l2 -10"/><path d="M128 78l14 -10M136 92l14 -10"/><circle cx="268" cy="78" r="9"/><path d="M262 76h12"/></g>`) },
    { id: 'kickit', name: 'Kick It', lvl: 13, css: art(`<defs>${lin('a', ['#f7f8fa', '#d6dbe3', '#aeb6c3'], 1, 1)}</defs>${bgRect('url(#a)')}<path d="M120 100L200 0h40l-80 100z" fill="#ffffff" opacity="0.7"/><path d="M180 100L260 0h14l-80 100z" fill="#ffffff" opacity="0.5"/>${sball(252, 52, 38)}`) },
    { id: 'stickerbomb', name: 'Sticker Bomb', lvl: 16, css: art(bgRect('#1686c9') + scatter(5, 18, sticker)) },
    { id: 'tagged', name: 'Tagged', lvl: 19, css: art(`<defs>${lin('a', ['#2a1a6c', '#5b1fa0'])}</defs>${bgRect('url(#a)')}` + scatter(9, 14, (r) => `<circle cx="${(170 + r() * 130).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(4 + r() * 16).toFixed(1)}" fill="#ffd400" opacity="${(0.7 + r() * 0.3).toFixed(2)}"/>`) + scatter(4, 30, (r) => `<circle cx="${(150 + r() * 150).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(1 + r() * 3).toFixed(1)}" fill="${r() > 0.5 ? '#141414' : '#ff3fa4'}"/>`) + `<path d="M222 52l12 13 26 -30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { id: 'neoctane', name: 'NeOctane', lvl: 22, css: art(`${bgRect('#06302f')}<g stroke="#0f5a55" stroke-width="1">${grid()}</g><path d="M168 66l10 -20 34 -10h30l28 14 14 2 4 14z" fill="none" stroke="#3dff9a" stroke-width="9" opacity="0.18"/><g fill="none" stroke="#3dff9a" stroke-width="3" stroke-linejoin="round"><path d="M168 66l10 -20 34 -10h30l28 14 14 2 4 14z"/><circle cx="190" cy="68" r="10"/><circle cx="262" cy="68" r="10"/><path d="M214 38l6 -12h18l8 12"/></g>`) },
    { id: 'rainbowflyer', name: 'Rainbow Flyer', lvl: 24, css: art(`<defs>${lin('a', ['#ff6fb5', '#ffb168'], 1, 1)}</defs>${bgRect('url(#a)')}` + ['#ff3b3b', '#ff9a1f', '#ffe23d', '#4bd863', '#3d8bff', '#9b5cff'].map((c, i) => `<path d="M100 ${30 + i * 8}q60 -20 140 0" fill="none" stroke="${c}" stroke-width="8"/>`).join('') + heartP(248, 46, 4.2, '#ff2f6d', 'stroke="#ffffff" stroke-width="0.8"')) },
    { id: 'avocado', name: 'Mrs. Avocado', lvl: 26, css: art(`${bgRect('#e43678')}<path d="M150 70l20 -30M130 40l14 20" stroke="#c42563" stroke-width="5"/><ellipse cx="250" cy="52" rx="30" ry="40" fill="#2f8a2a"/><ellipse cx="250" cy="56" rx="23" ry="32" fill="#b7e36a"/><circle cx="250" cy="66" r="13" fill="#8a4f24"/><circle cx="242" cy="46" r="3" fill="#1b1b1b"/><circle cx="258" cy="46" r="3" fill="#1b1b1b"/><path d="M245 53q5 4 10 0" fill="none" stroke="#1b1b1b" stroke-width="2"/>`) },
    { id: 'birds', name: 'Peaceful Birds', lvl: 30, css: art(`${bgRect('#f1dfc4')}<path d="M110 90q60 -40 190 -60M200 52q20 -30 50 -40" fill="none" stroke="#5a3a24" stroke-width="4" stroke-linecap="round"/>` + scatter(6, 14, (r) => { const x = (140 + r() * 160).toFixed(1), y = (15 + r() * 70).toFixed(1); return `<circle cx="${x}" cy="${y}" r="${(4 + r() * 4).toFixed(1)}" fill="${r() > 0.5 ? '#ff9ec4' : '#ffc4da'}"/><circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`; }) + `<path d="M232 34q10 -12 24 -4l8 -2 -4 6q-6 12 -22 10z" fill="#3a8fd8"/><circle cx="252" cy="31" r="1.5" fill="#111"/>`) },
    { id: 'spooky', name: 'Spooky Haunts', lvl: 33, css: art(`<defs>${lin('a', ['#241446', '#4b2a80'], 0, 1)}</defs>${bgRect('url(#a)')}<circle cx="150" cy="24" r="12" fill="#d8f7a0"/><circle cx="156" cy="20" r="11" fill="#2c1952"/><path d="M100 100q50 -30 100 -10t100 -20v30z" fill="#2a5a3a"/>${ghost(235, 44, 1)}${ghost(275, 60, 0.75)}`) },
    { id: 'ouchie', name: 'Ouchie', lvl: 36, css: art(`${bgRect('#86e3c7')}${bandage(205, 50, -35)}${bandage(250, 46, 30)}${heartP(150, 30, 1.8, '#ff6f9a')}`) },
    { id: 'octane', name: 'Octane Blue', css: 'linear-gradient(90deg,#0b5fd6,#0a2a66 70%,#06122e)', lvl: 2 },
    { id: 'blaze', name: 'Blaze', css: 'linear-gradient(90deg,#ff7b1c,#a12a00 70%,#3a0e00)', lvl: 4 },
    { id: 'toxic', name: 'Toxic', css: 'linear-gradient(90deg,#55e02a,#17630b 70%,#06240a)', lvl: 6 },
    { id: 'neon', name: 'Neon', css: 'linear-gradient(90deg,#ff2bd6,#5b0f9e 60%,#170733)', lvl: 8 },
    { id: 'gold', name: 'Gilded', css: 'linear-gradient(90deg,#ffd451,#a06d00 65%,#3b2600)', lvl: 12 },
    { id: 'carbon', name: 'Carbon', css: 'repeating-linear-gradient(45deg,#1b1d22 0 6px,#25282f 6px 12px)', lvl: 15 },
    { id: 'aurora', name: 'Aurora', css: 'linear-gradient(90deg,#14e3c6,#2a6bff 50%,#8a2bff)', lvl: 20 },
    { id: 'sunset', name: 'Sunset', css: 'linear-gradient(90deg,#ffb347,#ff4f6d 50%,#5b2a86)', lvl: 25 },
    { id: 'champion', name: 'Champion', css: 'linear-gradient(90deg,#c58bff,#5a1fa8 60%,#1d0a3a)', lvl: 35 },
    // animated
    { id: 'plasma', name: 'Plasma', css: 'linear-gradient(90deg,#ff2bd6,#2a6bff,#14e3c6,#ff2bd6)', anim: 'flow', lvl: 10 },
    { id: 'lava', name: 'Lava Flow', css: 'linear-gradient(90deg,#ff3d00,#ffb300,#ff3d00,#7a1200,#ff3d00)', anim: 'flow', lvl: 18 },
    { id: 'starfield', name: 'Starfield', css: 'radial-gradient(circle at 20% 40%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 60%,#bde 0 1px,transparent 2px),radial-gradient(circle at 45% 20%,#fff 0 1px,transparent 2px),linear-gradient(90deg,#060b24,#1a1060)', anim: 'stars', lvl: 28 },
  ];
  // the XP Level borders unlock at those levels, like the real game
  const XP_TIERS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 350];
  const BORDERS = [
    { id: 'none', name: 'Default', kind: 'default', lvl: 1, rar: 'Common' },
    { id: 'hardmetal', name: 'Hard Metal', kind: 'metal', lvl: 8 },
    { id: 'azumaya', name: 'Azumaya', kind: 'blossom', lvl: 14 },
    { id: 'eerieink', name: 'Eerie Ink', kind: 'ink', lvl: 20 },
  ].concat(XP_TIERS.map((n, i) => ({ id: 'xp' + n, name: 'XP Level ' + n, kind: 'xp', tier: i + 1, lvl: n })), [
    // rank borders: earned by reaching that rank in Competitive (rank = index into BL.RANKS), not by level
    { id: 'bronze', name: 'Bronze', kind: 'rank', css: '#c98a4f', rank: 0 },
    { id: 'silver', name: 'Silver', kind: 'rank', css: '#cfd6df', rank: 1 },
    { id: 'gold', name: 'Gold', kind: 'rank', css: '#f2c23a', rank: 2 },
    { id: 'platinum', name: 'Platinum', kind: 'rank', css: '#5fe3d6', rank: 3 },
    { id: 'diamond', name: 'Diamond', kind: 'rank', css: '#5d9dff', rank: 4 },
    { id: 'champion', name: 'Champion', kind: 'rank', css: '#b674ff', rank: 5 },
    { id: 'gc', name: 'Grand Champion', kind: 'rank', css: '#ff4a55', rank: 6 },
    { id: 'ssl', name: 'Supersonic Legend', kind: 'rank', css: '#ffffff', rank: 7 },
    { id: 'rank', name: 'Your Best Rank', kind: 'rank', css: null, lvl: 1 },
  ]);
  const lockedPick = (b) => (b.rank != null ? S.bestTier() < b.rank : S.p.level < (b.lvl || 1));
  const unlockText = (b) => (b.rank != null ? 'Reach ' + BL.RANKS[b.rank].name : 'Level ' + b.lvl);
  // the border you show: a rank border you haven't earned (picked before borders went by rank) shows as Default
  const myBorder = () => { const b = BORDERS.find((x) => x.id === S.p.border) || BORDERS[0]; return lockedPick(b) ? BORDERS[0] : b; };
  const bestMMR = () => Math.max(...BL.PLAYLISTS.map((pl) => S.p.mmr[pl.id] || 0));
  // a frame drawn round an avatar (viewBox 120: the avatar fills 20..100, ornaments reach out past it)
  const frameCache = {};
  const SIL = '#eef2f8', EDGE = '#7f8ba0', BLU = '#3f8fff', DBLU = '#1546b8';
  const notch = (m, c) => `M${m + c} ${m}H${120 - m - c}L${120 - m} ${m + c}V${120 - m - c}L${120 - m - c} ${120 - m}H${m + c}L${m} ${120 - m - c}V${m + c}Z`;
  const ring = (m, c, stroke, w, extra) => `<path d="${notch(m, c)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" ${extra || ''}/>`;
  const INK = 'M14 18q10 -8 22 -2t24 -4 24 4 22 -2q6 12 2 24t2 24 -2 24 2 18q-12 8 -24 2t-24 4 -24 -4 -20 2q-8 -12 -2 -24t-2 -24 2 -24z';
  function xpFrame(t) {
    let o;
    if (t >= 12) {
      // XP 300 / 350: glowing blue with notched corners (350 adds silver brackets on the corners)
      o = ring(15, 9, BLU, 14, 'opacity="0.3"') + ring(15, 9, DBLU, 9) + ring(15, 9, '#6fb4ff', 5) + ring(19.5, 6, '#d6ebff', 1.2);
      if (t >= 13) o += [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => `<path transform="translate(60 60) scale(${sx} ${sy})" d="M-50 -34V-50H-34" fill="none" stroke="${SIL}" stroke-width="4.5" stroke-linecap="square"/>`).join('');
      return o;
    }
    const c = t >= 5 ? 15 : 7;
    o = t === 4 ? ring(15, c, EDGE, 10) + ring(15, c, BLU, 7) + ring(18.5, c - 1, '#bfe0ff', 1.3) : ring(15, c, EDGE, 10) + ring(15, c, SIL, 7);
    if (t >= 2 && t !== 4) o += ring(19.5, c - 2, BLU, 1.8);
    if (t === 3 || t === 4) o += [[60, 10], [60, 110]].map(([x, y]) => `<rect x="${x - 9}" y="${y - 4}" width="18" height="8" fill="${t === 4 ? SIL : BLU}" stroke="${EDGE}" stroke-width="1"/>`).join('');
    if (t === 4) o += [[17, 17], [103, 17], [17, 103], [103, 103]].map(([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})" fill="#d6ebff"/>`).join('');
    if (t >= 5) o += `<path d="M48 13L60 2 72 13z" fill="${SIL}" stroke="${EDGE}" stroke-width="1.5"/><path d="M55 11L60 6 65 11z" fill="${BLU}"/>`;
    if (t >= 6) o += `<path d="M50 107L60 116 70 107z" fill="${SIL}" stroke="${EDGE}" stroke-width="1.5"/>`;
    if (t >= 7) o += [8, 112].map((x) => `<path d="M${x} 52L${x + (x < 60 ? -6 : 6)} 60 ${x} 68z" fill="${BLU}" stroke="${SIL}" stroke-width="2"/>`).join('');
    if (t >= 8) o += [1, -1].map((s) => `<path transform="translate(60 0) scale(${s} 1)" d="M14 12q14 -10 30 -4l-8 6q-10 -2 -18 2z" fill="${SIL}" stroke="${EDGE}" stroke-width="1"/>`).join('');
    if (t >= 9) {
      // laurels under the frame, a leaf more each tier
      o += [1, -1].map((s) => { let l = ''; for (let k = 0; k < t - 6; k++) { const a = 0.35 + k * 0.32, x = (60 + s * (14 + Math.sin(a) * 40)).toFixed(1), y = (92 + Math.cos(a) * 18 + k * 1.5).toFixed(1); l += `<ellipse cx="${x}" cy="${y}" rx="7" ry="3.2" transform="rotate(${s * (20 + k * 18)} ${x} ${y})" fill="${SIL}" stroke="${EDGE}" stroke-width="1"/>`; } return l; }).join('');
    }
    return o;
  }
  function frameArt(b) {
    const col = b.kind === 'rank' ? b.css || S.rankInfo(bestMMR()).color : '';
    const key = b.id + col;
    if (frameCache[key]) return frameCache[key];
    let o;
    if (b.kind === 'default') o = `<rect x="16" y="16" width="88" height="88" rx="10" fill="none" stroke="#9aa5b6" stroke-width="9"/><rect x="16" y="16" width="88" height="88" rx="10" fill="none" stroke="#f4f7fb" stroke-width="6"/>`;
    else if (b.kind === 'rank') o = ring(15, 6, '#0d1220', 10) + ring(15, 6, col, 7) + ring(19.5, 3, '#ffffff', 1.4, 'opacity="0.55"');
    else if (b.kind === 'metal') o = `<rect x="12" y="12" width="96" height="96" fill="none" stroke="#6b5440" stroke-width="13"/><rect x="12" y="12" width="96" height="96" fill="none" stroke="#d8b38a" stroke-width="9"/><path d="M8 30V8h40M112 90v22H72" fill="none" stroke="#f4dcbf" stroke-width="4"/><rect x="6" y="50" width="8" height="20" fill="#b48f68"/><rect x="106" y="50" width="8" height="20" fill="#b48f68"/>`;
    else if (b.kind === 'blossom') o = `<rect x="15" y="15" width="90" height="90" rx="4" fill="none" stroke="#5c3720" stroke-width="9"/><rect x="15" y="15" width="90" height="90" rx="4" fill="none" stroke="#9a6a45" stroke-width="5"/>` + [[16, 16], [104, 18], [18, 102], [102, 104], [60, 12]].map(([x, y], k) => scatter(20 + k, 6, (r) => { const a = r() * 6.28, d = r() * 11; return `<circle cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d).toFixed(1)}" r="${(3 + r() * 3).toFixed(1)}" fill="${r() > 0.4 ? '#ffb1cf' : '#ff86b2'}"/>`; })).join('');
    else if (b.kind === 'ink') o = `<path d="${INK}" fill="none" stroke="#3dff2a" stroke-width="12" opacity="0.35"/><path d="${INK}" fill="none" stroke="#59ff3c" stroke-width="6"/>`;
    else o = xpFrame(b.tier);
    return (frameCache[key] = svgUrl(120, 120, o));
  }
  // the person icon the real game shows when you haven't picked an avatar
  const FACE = svgUrl(80, 80, `<defs>${lin('f', ['#2f7cf0', '#0d3fa8'], 0, 1)}</defs><rect width="80" height="80" fill="url(#f)"/><circle cx="40" cy="31" r="13" fill="#7fb8ff"/><path d="M14 72c2 -16 13 -23 26 -23s24 7 26 23z" fill="#7fb8ff"/>`);
  const avatar = (b, cls, extra) => `<div class="av ${cls || ''}" ${extra || ''}><i class="av-face" style="background-image:${FACE}"></i><i class="av-fr" style="background-image:${frameArt(b)}"></i></div>`;

  // ---------- the frame every screen sits in ----------
  const teamBtn = () => [BL.Garage.team ? 'VIEW BLUE CAR' : 'VIEW ORANGE CAR', 'gSwap'];
  const multiBar = () => [[M.multi ? 'SINGLE SELECTION' : 'MULTIPLE SELECTION', 'multiSel']].concat(M.multi && M.multi.size ? [['SEARCH (' + M.multi.size + ')', 'plSearch', '', 'hot']] : []);
  const FR = {
    title: { bare: true, view: 'title' },
    main: { view: 'main', np: true, noBar: true, off: 0.35 },
    play: { ghost: 'PLAY', np: true, bar: () => [['QUICK PLAY', 'quickPlay']] },
    casual: { ghost: 'CASUAL', bar: multiBar },
    competitive: { ghost: 'COMPETITIVE', bar: multiBar },
    tournaments: { ghost: 'SCHEDULE', bar: () => [['ABOUT', 'tourAbout']] },
    fpArena: { ghost: 'FREE PLAY', bar: () => [['START', 'fpStart', '', 'hot']] },
    training: { ghost: 'TRAINING' }, offline: { ghost: 'PLAY OFFLINE' }, private: { ghost: 'PRIVATE MATCH' },
    exhibition: { ghost: 'EXHIBITION' }, season: { ghost: 'SEASON' },
    garage: { view: 'garage', off: -1.25, bar: () => [teamBtn()] },
    customize: { view: 'garage', off: -1.75, bar: () => [['RANDOMIZE PRESET', 'gRandom'], teamBtn()] },
    inventory: { view: 'garage', off: -1.75, bar: () => [teamBtn()] },
    tradein: { ghost: 'TRADE IN', bar: () => [['HELP', 'tradeHelp']] },
    drops: { ghost: 'DROPS', view: 'garage', off: -1.6 },
    shop: { view: 'shop', off: 0.85, noBanner: true, bar: () => [['BUY CREDITS', 'buyCredits']].concat(shopPage().kind === 'bundle' ? [[M.shopWhole ? 'VIEW ITEM' : 'VIEW BUNDLE', 'shopWhole']] : [], [teamBtn()]) },
    pass: { ghost: 'ROCKET PASS', view: 'garage', off: 0, lift: -0.62, far: 1.3 },
    profile: { view: 'garage', off: -1.25 },
    career: { ghost: 'CAREER' }, history: { ghost: 'MATCH HISTORY' }, leaderboards: { ghost: 'LEADERBOARDS' }, ranks: { ghost: 'LEAGUE RANKINGS' },
    banners: { view: 'garage', off: -1.25 }, borders: { view: 'garage', off: -1.25 },
    club: { ghost: 'CLUB' }, challenges: { view: 'menu', page: true },
    settings: { ghost: 'SETTINGS' }, controls: { ghost: 'CONTROLS' },
    online: { ghost: 'ONLINE' }, lobby: { ghost: 'LOBBY' },
    searching: { ghost: () => (M.search && M.search.ranked ? 'COMPETITIVE' : 'CASUAL') },
  };
  FR.ranked = FR.competitive;
  M.viewFor = (name) => {
    const f = FR[name] || {};
    if (f.off != null) BL.Garage.wideOffset = f.off;
    BL.Garage.lookYOff = f.lift || 0; BL.Garage.distMul = f.far || 1;
    return f.view || 'menu';
  };

  function companions() {
    const out = [];
    if (M.p2) out.push({ key: 'p2', name: 'Player 2', loadout: S.resolveLoadout() });
    const L = BL.Net && BL.Net.lobby;
    if (L && L.players) for (const pl of L.players) if (pl.pid !== BL.Net.myPid && pl.loadout) out.push({ key: pl.pid + ':' + JSON.stringify(pl.loadout.body || ''), name: pl.name, loadout: pl.loadout });
    const sv = BL.Net && BL.Net.srv;
    if (sv && sv.party) for (const m of sv.party.members) if (m.pid !== sv.pid && m.loadout) out.push({ key: m.pid + ':' + JSON.stringify(m.loadout.body || ''), name: m.name, loadout: m.loadout });
    return out;
  }
  M.frame = function (name, fn) {
    ext();
    if (BL.Friends && !BL.Friends._started) { BL.Friends._started = true; BL.Friends.start(); }
    if (BL.Garage.setCompanions) BL.Garage.setCompanions((FR[name] || {}).view === 'main' || name === 'garage' ? companions() : []);
    const f = FR[name] || {};
    if (f.bare) return `<div class="rl s-${name}">${fn()}</div>`;
    const extra = typeof f.bar === 'function' ? f.bar() : [];
    const bar = f.noBar ? '' : `<div class="rl-bar"><button class="rl-key" data-act="back"><i class="k">B</i>BACK</button>${extra.map((b) => `<button class="rl-key ${b[3] || ''}" data-act="${b[1]}" data-arg="${esc(b[2] || '')}">${b[0]}</button>`).join('')}</div>`;
    const view = f.view || 'menu';
    return `<div class="rl s-${name} v-${view}">
      ${f.page ? '<div class="rl-page"></div>' : view === 'menu' ? '<div class="rl-dim"></div>' : ''}
      ${f.ghost ? `<div class="rl-ghost">${typeof f.ghost === 'function' ? f.ghost() : f.ghost}</div>` : ''}
      <div class="rl-body">${fn()}</div>
      ${bar}${f.noBanner ? '' : banner()}${f.np ? nowPlaying() : ''}
      <button class="rl-friends" data-act="friends" title="Friends &amp; party (F, or RT on a controller)">${peopleSvg}<em>${partyCount()}</em></button>
      ${M.friendsOpen ? friendsPanel() : ''}
    </div>`;
  };

  function banner() {
    const p = S.p, c = p.club, need = S.xpForLevel(p.level), f = U.clamp(p.xp / need, 0, 1);
    const bn = BANNERS.find((b) => b.id === p.banner) || BANNERS[0], bd = myBorder();
    return `<div class="rl-banner">
      ${avatar(bd, 'bn-av', 'data-act="go" data-arg="profile"')}
      <div class="bn-plate ${bn.anim ? 'anim-' + bn.anim : ''}" data-act="go" data-arg="profile" style="background:${bn.anim ? '' : 'linear-gradient(90deg,rgba(0,0,0,0.5),rgba(0,0,0,0.25) 45%,rgba(0,0,0,0) 70%),'}${bn.css}"><b>${c ? `<i>[${esc(c.tag)}]</i> ` : ''}${esc(p.name)}</b>${titleTag()}</div>
      <div class="bn-lvl" title="Level ${p.level} • ${p.xp}/${need} XP"><svg viewBox="0 0 40 40"><circle class="bg" r="16" cx="20" cy="20"/><circle class="fg" r="16" cx="20" cy="20" style="stroke-dasharray:${(f * 100.5).toFixed(1)} 200"/></svg><b>${p.level}</b></div>
      ${partyPlates()}
      ${S.pendingRewards() ? `<button class="rl-key bn-rewards" data-act="rewards">${BL.ICON('gift', 16)} REWARDS <em>${S.pendingRewards()}</em></button>` : ''}
      <button class="rl-key bn-party" data-act="createParty">${partyLabel()}</button>
      <button class="rl-key bn-p2 ${M.p2 ? 'on' : ''}" data-act="p2Toggle" title="Splitscreen: press START on a second controller">${M.p2 ? BL.ICON('gamepad', 16) + ' PLAYER 2 ' + BL.ICON('check', 13) : BL.ICON('gamepad', 16) + ' +P2'}</button>
    </div>`;
  }
  function partyPlates() {
    const pi = partyInfo();
    if (!pi || pi.members.length < 2) return '';
    return `<div class="bn-mates">${pi.members.filter((m) => !m.me).map((m) => `<div class="bn-mate" data-act="friends">${m.lead ? `<i class="fp-crown">${BL.ICON('crown', 13)}</i>` : ''}<b>${esc(m.name)}</b><small>${m.title ? esc(m.title) : 'LV ' + (m.level || 1)}</small></div>`).join('')}</div>`;
  }
  function titleTag() {
    const t = S.itemDef((S.entry(S.p.loadout.title) || {}).id);
    return t && t.text ? `<em class="bn-title ${t.glow ? 'glow' : ''}" style="color:${t.color || '#ffd27a'}">${esc(t.text)}</em>` : '';
  }
  const noteSvg = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M9 3v11.6A3.5 3.5 0 1 0 11 18V8h7V3z"/></svg>';
  const peopleSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7.5 0a3.5 3.5 0 1 0-1.6-6.6A5.9 5.9 0 0 1 15 11zM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1zm16.4-5.9c3.2.4 5.6 2.6 5.6 5.4V21h-4v-1c0-2.2-.6-4.2-1.6-5.9z"/></svg>';
  function nowPlaying() {
    const m = BL.Anthems && BL.Anthems.nowPlaying && BL.Anthems.nowPlaying();
    return `<div class="rl-np" id="rlNp" ${m ? '' : 'hidden'}><i class="np-art">${noteSvg}</i><div class="np-t"><b id="rlNpName">${m ? esc(m.name) : ''}</b><small>NOW PLAYING</small></div><button class="rl-key" data-act="npSkip"><i class="k">Y</i>SKIP</button></div>`;
  }
  setInterval(() => {
    const el = document.getElementById('rlNp');
    if (!el || !BL.Anthems || !BL.Anthems.nowPlaying) return;
    const m = BL.Anthems.nowPlaying(), n = document.getElementById('rlNpName');
    el.hidden = !m;
    if (m && n && n.textContent !== m.name) n.textContent = m.name;
  }, 700);
  ACT.npSkip = () => { if (BL.Anthems && BL.Anthems.skip) BL.Anthems.skip(); };

  // ---------- party / friends ----------
  const N = () => BL.Net;
  function partyInfo() {
    const n = N(), sv = n.srv;
    if (sv.status === 'on' && sv.party) return { kind: 'srv', members: sv.party.members.map((m) => ({ name: m.name, level: m.level, me: m.pid === sv.pid, lead: m.pid === sv.party.leader })), leader: sv.party.leader === sv.pid, code: sv.party.code };
    if (n.lobby) { const lp = n.leaderPid(); return { kind: 'lobby', party: !!n.lobby.party, members: n.lobby.players.map((x) => ({ pid: x.pid, name: x.name, level: x.level, title: x.title, me: x.pid === n.myPid, lead: x.pid === lp })), leader: n.isPartyLeader(), host: n.role === 'host', code: n.lobby.code }; }
    return null;
  }
  const partyCount = () => { const pi = partyInfo(); return pi ? pi.members.length : 1; };
  const partyLabel = () => (partyInfo() ? 'PARTY (' + partyCount() + ')' : 'CREATE PARTY');
  // a party is made in the background (no lobby screen), like the real game: you stay where you are and friends join you
  function makeParty(cb) {
    const n = N();
    if (!n.available()) { M.toast('Parties need an internet connection (or use LOCAL LINK in Online Play to pair with a friend next to you).'); return; }
    M.toast('Creating party...');
    n.host({ party: true, mode: 'soccar', teamSize: 3, fillBots: true, botSkill: 0.5 }, (err) => {
      if (err) { M.toast('Could not create a party: ' + (err.message || err.type || err)); return; }
      M.lobbyLog = [];
      if (cb) cb(); else { M.friendsOpen = true; M.toast('Party created: invite friends from the friends panel or share the code'); }
      if (!BL.game) M.render();
    });
  }
  ACT.createParty = () => {
    const pi = partyInfo();
    if (pi) { M.friendsOpen = true; M.render(); return; }
    const n = N();
    if (n.srv.status === 'on') { n.partyCreate(); M.friendsOpen = true; setTimeout(() => M.render(), 400); return; }
    makeParty();
  };
  // joining a friend's party keeps you on your current screen; a private match lobby still opens its own screen
  ACT.joinParty = (code) => {
    if (!code) return;
    M.toast('Joining party ' + String(code).toUpperCase() + '...');
    N().join(code, (err) => {
      if (err) { M.toast(err.message || 'Could not join'); return; }
      M.lobbyLog = [];
      const L = N().lobby;
      if (L && !L.party) { HISTORY.push('online'); M.show('lobby'); return; }
      M.toast('Joined ' + (L ? L.hostName : '') + "'s party");
      if (!BL.game) { if (M.screen === 'online' || M.screen === 'lobby') M.show('main'); else M.render(); }
    });
  };
  ACT.partyPromote = (pid) => N().partyAct('promote', { pid });
  ACT.partyKickP = (pid) => M.confirm('Kick this player from the party?', () => N().partyAct('kick', { pid }), 'KICK');
  ACT.pchat = () => { const i = document.getElementById('pchatIn'); if (!i || !i.value.trim()) return; N().lobbyChat(S.p.name, i.value.trim()); i.value = ''; i.focus(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'pchatIn') { e.preventDefault(); ACT.pchat(); } });
  BL.bus.on('net:lchat', () => { const log = document.getElementById('pchatLog'); if (log) { log.innerHTML = pchatHtml(); log.scrollTop = 1e9; } });
  BL.bus.on('net:kicked', () => M.toast('You were removed from the party'));
  const pchatHtml = () => (M.lobbyLog || []).slice(-8).map((m) => `<div class="${m.name === 'System' ? 'sys' : ''}"><b>${esc(m.name)}:</b> ${esc(m.m)}</div>`).join('') || '<div class="sys">Party chat: say hi!</div>';
  // send my car to the party whenever it changes, so it shows up beside theirs
  setInterval(() => {
    const n = N(); if (!n.lobby || n.transport === 'ws' || BL.game) return;
    const k = JSON.stringify(S.resolveLoadout()) + S.p.name + S.p.level;
    if (k !== M._sentMe) { M._sentMe = k; n.sendMe(); }
  }, 1500);
  ACT.friends = () => { M.friendsOpen = !M.friendsOpen; M.render(); };
  function friendsPanel() {
    const p = S.p, pi = partyInfo(), n = N(), Fr = BL.Friends;
    const fcode = Fr ? Fr.code() : '', fr = p.friends || [], reqs = p.friendReqs || [], invs = p.invites || [];
    const online = fr.filter((f) => Fr && Fr.isOnline(f.code)), offline = fr.filter((f) => !(Fr && Fr.isOnline(f.code)));
    const row = (label, k, act) => `<div class="fp-row" ${act ? `data-act="${act}"` : ''}><span>${label}</span><b>(${k})</b></div>`;
    const fRow = (f, on) => `<div class="fp-mem ${on ? 'on' : ''}"><i class="fp-dot"></i>${esc(f.name)}<small>LV ${f.level || 1}</small>
      ${on ? `<button class="fp-mini" data-act="frInvite" data-arg="${f.code}" title="Invite to party">PARTY</button>${p.club && p.club.owner ? `<button class="fp-mini" data-act="frClub" data-arg="${f.code}" title="Invite to your club">CLUB</button>` : ''}` : ''}</div>`;
    return `<div class="rl-fp">
      <div class="fp-head">${avatar(myBorder(), 'sm')}<b>${esc(p.name)}</b><button class="fp-x" data-act="friends">${BL.ICON('close', 14)}</button></div>
      <div class="fp-code2" data-act="frCopy" title="Click to copy">FRIEND CODE <b>${esc(fcode)}</b></div>
      <div class="fp-join"><input id="frCodeIn" maxlength="8" placeholder="Friend's code" style="text-transform:uppercase">${btn('ADD FRIEND', 'frAdd')}</div>
      <h4>NOTIFICATIONS</h4>
      ${row('Friend Requests', reqs.length)}${reqs.map((r) => `<div class="fp-req"><b>${esc(r.name)}</b>${btn('ACCEPT', 'frAccept', r.code, 'hot')}${btn('DECLINE', 'frDecline', r.code)}</div>`).join('')}
      ${row('Party Invites', invs.filter((x) => x.t === 'pinv').length)}${row('Club Invites', invs.filter((x) => x.t === 'cinv').length)}
      ${invs.map((x, i) => `<div class="fp-req"><b>${esc(x.name)}</b><small>${x.t === 'pinv' ? 'party' : 'club [' + esc(x.club ? x.club.tag : '') + ']'}</small>${btn('JOIN', 'frJoinInv', String(i), 'hot')}${btn(BL.ICON('close', 12), 'frDropInv', String(i))}</div>`).join('')}
      ${row('Drops to open', S.p.drops.length, 'go')}
      <h4>PARTY</h4>
      ${pi ? `<div class="fp-code" data-act="${pi.kind === 'srv' ? 'copyParty' : 'copyCode'}" title="Party code: click to copy">${esc(pi.code)}</div>${pi.members.map((m) => `<div class="fp-mem ${m.me ? 'me' : ''}">${m.lead ? `<i class="fp-crown" title="Party leader">${BL.ICON('crown', 14)}</i>` : ''}${esc(m.name)}<small>LV ${m.level || 1}</small>
          ${pi.kind === 'lobby' && !m.me && (pi.leader || pi.host) ? `${!m.lead ? `<button class="fp-mini" data-act="partyPromote" data-arg="${esc(m.pid)}" title="Make party leader">LEADER</button>` : ''}${pi.host ? `<button class="fp-mini warn" data-act="partyKickP" data-arg="${esc(m.pid)}" title="Kick from party">KICK</button>` : ''}` : ''}</div>`).join('')}
        ${pi.kind === 'lobby' ? `<div class="fp-lead">${pi.leader ? 'You are the party leader: pick a playlist and everyone joins the match with you.' : 'The party leader picks the playlist and starts the search.'}</div>
        <div class="fp-chat"><div class="fp-log" id="pchatLog">${pchatHtml()}</div><div class="fp-join"><input id="pchatIn" maxlength="120" placeholder="Party chat...">${btn('SEND', 'pchat')}</div></div>
        ${pi.party ? '' : btn('MATCH LOBBY', 'go', 'lobby')}` : ''}
        <div class="fp-btns">${btn('LEAVE PARTY', 'fpLeave')}</div>`
        : `<div class="fp-btns">${btn('CREATE PARTY', 'createParty', '', 'hot')}</div>
        <div class="fp-join"><input id="fpCode" maxlength="8" placeholder="Party / room code" style="text-transform:uppercase">${btn('JOIN', 'fpJoin')}</div>`}
      <h4>ONLINE (${online.length})</h4>${online.length ? online.map((f) => fRow(f, true)).join('') : '<div class="fp-empty">No friends online.</div>'}
      ${offline.length ? `<h4>OFFLINE (${offline.length})</h4>${offline.map((f) => fRow(f, false)).join('')}` : ''}
      <div class="fp-btns">${btn('ONLINE PLAY', 'go', 'online')}${btn('LOCAL LINK', 'llOpen')}</div>
      <div class="fp-foot">${Fr ? (Fr.status === 'on' ? 'Friends: online' : Fr.status === 'in use' ? 'Friends: open in another tab' : Fr.status === 'connecting' ? 'Friends: connecting...' : 'Friends need an internet connection') : ''}</div>
    </div>`;
  }
  ACT.frCopy = () => { const c = BL.Friends && BL.Friends.code(); if (c && navigator.clipboard) navigator.clipboard.writeText(c).then(() => M.toast('Friend code copied'), () => M.toast(c)); else M.toast(c); };
  ACT.frAdd = () => {
    const v = ((document.getElementById('frCodeIn') || {}).value || '').trim();
    if (!v || !BL.Friends) return;
    M.toast('Sending friend request...');
    BL.Friends.request(v, (err) => M.toast(err || 'Friend request sent'));
  };
  ACT.frAccept = (c) => { BL.Friends.accept(c); M.render(); };
  ACT.frDecline = (c) => { BL.Friends.decline(c); M.render(); };
  ACT.frInvite = (c) => {
    const go = () => BL.Friends.invite(c, (err) => M.toast(err || 'Party invite sent'));
    if (!BL.Net.lobby) makeParty(go); else go();
  };
  ACT.frClub = (c) => BL.Friends.clubInvite(c, (err) => M.toast(err || 'Club invite sent'));
  ACT.frJoinInv = (i) => { BL.Friends.acceptInvite(+i); M.render(); };
  ACT.frDropInv = (i) => { BL.Friends.dropInvite(+i); M.render(); };
  BL.bus.on('friends', () => { if (!BL.game && (M.friendsOpen || M.screen === 'club')) M.render(); });
  ACT.fpJoin = () => {
    const v = ((document.getElementById('fpCode') || {}).value || '').trim().toUpperCase();
    if (!v) { M.toast('Enter a code'); return; }
    if (N().srv.status === 'on' && v.length <= 6) N().partyJoin(v); else ACT.joinParty(v);
  };
  ACT.fpLeave = () => { const pi = partyInfo(); if (!pi) return; if (pi.kind === 'srv') N().partyLeave(); else { N().leave(); } M.render(); };
  BL.bus.on('net:srv', () => { if (M.friendsOpen && !BL.game && M.screen !== 'online') M.render(); });
  if (!M._srvBound) {
    M._srvBound = true;
    BL.bus.on('net:srv', () => { if (M.screen === 'online' && !BL.game) { const a = document.activeElement; if (!a || a.tagName !== 'INPUT') M.render(); } });
    BL.bus.on('net:queue', () => M.queueOverlay());
  }

  // ---------- TITLE ----------
  SCREENS.title = () => `<div class="rl-title" data-act="titleGo">
      <img class="tt-logo" src="assets/ui/logo.png" alt="" draggable="false">
      <div class="tt-word">ROCKET<br>LEAGUE</div>
      <div class="tt-season">SEASON ${BL.PASS.season}</div>
      <div class="tt-press" id="ttPress">${titlePrompt()}</div>
      <div class="tt-legal">Fan-made remake for fun. Not affiliated with or endorsed by Psyonix or Epic Games. Rocket League is a trademark of Psyonix LLC.</div>
    </div>`;
  ACT.titleGo = () => { if (M.screen !== 'title') return; HISTORY.length = 0; BL.Audio.unlock(); if (!BL.Audio.musicOn) { BL.Audio.musicOn = true; BL.Audio.startMusic(); } M.show('main'); };
  // to start: A + D together on a computer, LB + RB together on a controller (the prompt switches when a
  // controller is detected); a click / tap still works for touch screens
  function titlePrompt() {
    const pad = BL.Input.pads && BL.Input.pads().length;
    return pad ? 'PRESS <kbd>LB</kbd> + <kbd>RB</kbd> TO START' : 'PRESS <kbd>A</kbd> + <kbd>D</kbd> TO START';
  }
  const titleKeys = new Set();
  window.addEventListener('keydown', (e) => {
    titleKeys.add(e.code);
    if (M.screen === 'title' && !BL.game && titleKeys.has('KeyA') && titleKeys.has('KeyD')) ACT.titleGo();
  });
  window.addEventListener('keyup', (e) => titleKeys.delete(e.code));
  // F opens the friends & party sidebar in the menus and while paused (RT on a controller); not while typing
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing || M.screen === 'title' || (BL.game && !M.pauseOpen)) return;
    e.preventDefault(); ACT.friends();
  });
  window.addEventListener('blur', () => titleKeys.clear());
  setInterval(() => {
    if (M.screen !== 'title' || BL.game) return;
    const el = document.getElementById('ttPress');
    if (el) { const t = titlePrompt(); if (el.innerHTML !== t) el.innerHTML = t; }
    const pads = BL.Input.pads ? BL.Input.pads() : [];
    if (pads.some((gp) => gp.buttons[4] && gp.buttons[4].pressed && gp.buttons[5] && gp.buttons[5].pressed)) ACT.titleGo();
  }, 60);
  // splitscreen like the real game: press START on another controller in the menus to add Player 2 (again to
  // leave). With one controller and Player 1 on keyboard/mouse, that controller is Player 2.
  M.p2 = null;
  let p2Prev = [];
  setInterval(() => {
    if (BL.game || !navigator.getGamepads) return;
    // (one controller listed twice by the browser counts once: BL.Input.pads)
    const pads = BL.Input.pads ? BL.Input.pads() : [...navigator.getGamepads()].filter((p) => p && p.connected);
    const gp = pads.length >= 2 ? pads[1] : pads.length === 1 && !BL.Input.usingGamepad ? pads[0] : null;
    if (!gp) { p2Prev = []; return; }
    const now = gp.buttons.map((b) => b.pressed);
    if (now[9] && !p2Prev[9] && M.screen !== 'title') ACT.p2Toggle();
    p2Prev = now;
  }, 60);
  // adds the menu's Player 2 (splitscreen) to a player list, on Player 1's team
  const withP2 = (players) => (M.p2 ? players.concat([{ id: players.length, name: M.p2.name, team: players[0].team, isLocal2: true, loadout: players[0].loadout }]) : players);
  M.withP2 = withP2;
  ACT.p2Toggle = () => {
    M.p2 = M.p2 ? null : { name: 'Player 2' };
    M.toast(M.p2 ? 'Player 2 joined: splitscreen on (press START again to leave)' : 'Player 2 left');
    if (!BL.game) M.render();
  };
  // browsers keep sound off until a click or key press (a controller press doesn't count): say so
  setInterval(() => {
    const ctx = BL.Audio.ctx, off = !ctx || ctx.state !== 'running';
    let el = document.getElementById('soundHint');
    if (!off) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('button'); el.id = 'soundHint'; el.className = 'sound-hint'; el.innerHTML = BL.ICON('mute', 18) + ' Click or press any key to turn the sound on'; el.onclick = () => { BL.Audio.unlock(); el.remove(); }; document.body.appendChild(el); }
  }, 1000);
  ACT.quit = () => M.confirm('Quit to the title screen?', () => { HISTORY.length = 0; M.friendsOpen = false; M.show('title'); }, 'QUIT');

  // ---------- MAIN ----------
  SCREENS.main = () => {
    const p = S.p, ch = S.challenges(), unseen = S.unseenCount();
    const item = (label, act, arg, extra) => `<button class="rl-mi" data-act="${act}" data-arg="${arg || ''}"><span>${label}</span>${extra || ''}<i class="dia"></i></button>`;
    return `${updatePill()}<div class="rl-mainlist">
        ${item('PLAY', 'go', 'play')}
        ${item('ITEM SHOP', 'go', 'shop')}
        ${item('ROCKET PASS', 'go', 'pass', `<em>${p.pass.tier}</em>`)}
        ${item('GARAGE', 'go', 'garage', unseen ? `<em class="hot">${unseen}</em>` : '')}
        ${item('CLUB', 'go', 'club')}
        ${item('PROFILE', 'go', 'profile')}
        ${item('SETTINGS', 'go', 'settings')}
        ${item('QUIT', 'quit')}
      </div>
      <div class="rl-news">
        <div class="nw-card" data-act="go" data-arg="pass">
          <div class="nw-art"><img src="assets/ui/logo.png" alt="" draggable="false"><b>ROCKET PASS</b><span>SEASON ${BL.PASS.season}</span></div>
          <div class="nw-sub"><b>TIER ${p.pass.tier} / ${BL.PASS.tiers}</b><div class="nw-bar"><i style="width:${Math.round((p.pass.xp / BL.PASS.xpPerTier) * 100)}%"></i></div></div>
        </div>
        <div class="nw-chal"><h4>DAILY CHALLENGES</h4>
          ${ch.map((c) => `<div class="nw-c ${c.done ? 'done' : ''}"><span>${esc(c.desc)}</span><div class="nw-bar"><i style="width:${Math.round((c.progress / c.goal) * 100)}%"></i></div><small>${c.progress}/${c.goal}</small></div>`).join('')}
          ${btn('VIEW CHALLENGES', 'go', 'challenges', 'wide')}
        </div>
      </div>
      <div class="rl-newstab" data-act="go" data-arg="challenges">NEWS</div>
      ${p.drops.length ? `<button class="rl-dropnote" data-act="go" data-arg="drops">${p.drops.length} DROP${p.drops.length > 1 ? 'S' : ''} TO OPEN</button>` : ''}`;
  };

  // ---------- PLAY ----------
  SCREENS.play = () => `<div class="rl-tiles">
      <div class="rl-row big">${tile('casual', 'go', 'casual')}${tile('competitive', 'go', 'competitive')}${tile('tournaments', 'go', 'tournaments')}</div>
      <div class="rl-row">${tile('training', 'go', 'training')}${tile('offline', 'go', 'offline')}${tile('private', 'go', 'private')}</div>
    </div>`;
  ACT.quickPlay = () => startSearch([M.lastCasual || 'doubles'], false);

  // ---------- PLAYLISTS ----------
  const PL_CAS = [
    { id: 'chaos', name: 'Quads 4v4', size: 4, tile: 'quads', srv: 'chaos' },
    { id: 'standard', name: 'Standard 3v3', size: 3, tile: 'standard' },
    { id: 'doubles', name: 'Doubles 2v2', size: 2, tile: 'doubles' },
    { id: 'duel', name: 'Duel 1v1', size: 1, tile: 'duel' },
    { id: 'heatseeker3', name: 'Heatseeker 3v3', size: 3, mode: 'heatseeker', tile: 'heatseeker', row: 2, srv: 'heatseeker' },
    { id: 'spikedrop', name: 'Spike Drop 2v2', size: 2, mode: 'rumble', tile: 'spikedrop', row: 2, itemPool: ['spikes'], srv: 'rumble' },
  ];
  const PL_RK = [
    { id: 'standard', name: 'Standard 3v3', size: 3, tile: 'standard' },
    { id: 'doubles', name: 'Doubles 2v2', size: 2, tile: 'doubles' },
    { id: 'duel', name: 'Duel 1v1', size: 1, tile: 'duel' },
    { id: 'heatseeker', name: 'Heatseeker 2v2', size: 2, mode: 'heatseeker', tile: 'heatseeker2', row: 2 },
    { id: 'rumble', name: 'Rumble 3v3', size: 3, mode: 'rumble', tile: 'rumble', row: 2 },
  ];
  const plDef = (id, ranked) => (ranked ? PL_RK : PL_CAS).find((d) => d.id === id) || (ranked ? PL_RK : PL_CAS)[2];
  function counts() {
    const on = onlineCount();
    return `<div class="rl-counts"><div class="ct"><b>${fmt(on)}</b> PLAYERS ONLINE</div><div class="ct sm"><b>${fmt(on * 0.31)}</b> IN PLAYLIST</div>
      <div class="ct-btns">${btn('ARENAS', 'arenas')}${btn('REGIONS', 'regions')}</div></div>`;
  }
  SCREENS.casual = () => {
    const t = (d) => tile(d.tile, 'plPick', d.id, M.multi && M.multi.has(d.id) ? 'on' : '');
    return `${counts()}<div class="rl-tiles pl">
      <div class="rl-row">${PL_CAS.filter((d) => !d.row).map(t).join('')}</div>
      <div class="rl-row">${PL_CAS.filter((d) => d.row).map(t).join('')}</div></div>`;
  };
  SCREENS.competitive = () => {
    const p = S.p;
    const t = (d) => {
      const mmr = p.mmr[d.id] || 0, r = S.rankInfo(mmr), games = (p.rankedGames || {})[d.id] || 0;
      const over = `<div class="tl-mmr">${games < 10 ? 'PLACEMENT ' + games + '/10' : Math.round(mmr)}</div><div class="tl-rank">${rankIcon(mmr)}<small>${games < 10 ? 'UNRANKED' : esc(r.full.toUpperCase())}</small></div>`;
      return tile(d.tile, 'rkPick', d.id, M.multi && M.multi.has(d.id) ? 'on' : '', over);
    };
    return `${compHead()}${counts()}<div class="rl-tiles pl">
      <div class="rl-row">${PL_RK.filter((d) => !d.row).map(t).join('')}</div>
      <div class="rl-row">${PL_RK.filter((d) => d.row).map(t).join('')}</div></div>`;
  };
  SCREENS.ranked = SCREENS.competitive;
  function compHead() {
    const sr = S.p.seasonReward, top = BL.RANKS.length - 1, cur = BL.RANKS[Math.min(sr.tier, top)], next = BL.RANKS[Math.min(sr.tier + 1, top)];
    return `<div class="rl-sr">${rankIcon(cur.min + 1, 'sm')}<div class="sr-t"><b style="color:${cur.color}">${cur.name.toUpperCase()}</b><small>SEASON REWARD LEVEL</small></div>
      <div class="sr-w"><b>${sr.tier >= top ? '—' : sr.wins + '/10'}</b> WINS<small>${sr.tier >= top ? 'MAX LEVEL REACHED' : 'WIN 10 MATCHES AT ' + next.name.toUpperCase() + ' OR HIGHER TO ADVANCE'}</small></div></div>`;
  }
  ACT.multiSel = () => { M.multi = M.multi ? null : new Set(); M.render(); };
  ACT.plPick = (id) => { if (M.multi) { toggleSel(id, false); return; } M.lastCasual = id; startSearch([id], false); };
  ACT.rkPick = (id) => { if (M.multi) { toggleSel(id, true); return; } startSearch([id], true); };
  function toggleSel(id, ranked) { M.multiRanked = ranked; if (M.multi.has(id)) M.multi.delete(id); else M.multi.add(id); M.render(); }
  ACT.plSearch = () => { if (!M.multi || !M.multi.size) return; startSearch([...M.multi], M.screen === 'competitive' || M.screen === 'ranked'); M.multi = null; M.render(); };
  ACT.rankedGo = (id) => startSearch([id], true); // "play again" after a ranked match
  ACT.arenas = () => {
    const pref = S.p.settings.prefMaps;
    M.openOverlay(`<div class="dlg rl-dlg wide"><h2>ARENA PREFERENCES</h2><p class="muted small">Matches pick from the arenas you leave on.</p>
      <div class="rl-arenas">${MAP_POOL().map((m) => `<button class="rl-ar ${!pref || pref.indexOf(m.id) >= 0 ? 'on' : ''}" data-act="arToggle" data-arg="${m.id}">${esc(m.name)}</button>`).join('')}</div>
      <div class="row end">${btn('ALL', 'arAll')}${btn('DONE', 'closeOv', '', 'hot')}</div></div>`);
  };
  ACT.arToggle = (id) => {
    const all = MAP_POOL().map((m) => m.id);
    let pref = S.p.settings.prefMaps || all.slice();
    pref = pref.indexOf(id) >= 0 ? pref.filter((x) => x !== id) : pref.concat([id]);
    S.p.settings.prefMaps = pref.length && pref.length < all.length ? pref : null; S.save(); ACT.arenas();
  };
  ACT.arAll = () => { S.p.settings.prefMaps = null; S.save(); ACT.arenas(); };
  const REGIONS = [['USE', 'US-East'], ['USW', 'US-West'], ['EU', 'Europe'], ['OCE', 'Oceania'], ['SAM', 'South America'], ['ME', 'Middle East'], ['ASC', 'Asia SE-Mainland'], ['JPN', 'Asia East']];
  ACT.regions = () => M.openOverlay(`<div class="dlg rl-dlg"><h2>REGIONS</h2><div class="rl-arenas">${REGIONS.map((r) => `<button class="rl-ar ${S.p.settings.region === r[0] ? 'on' : ''}" data-act="regionSet" data-arg="${r[0]}">${r[1]}</button>`).join('')}</div><div class="row end">${btn('DONE', 'closeOv', '', 'hot')}</div></div>`);
  ACT.regionSet = (r) => { S.p.settings.region = r; S.save(); ACT.regions(); };

  // ---------- searching (top bar, keep browsing while it runs) ----------
  function startSearch(ids, ranked) {
    if (M.mmBanLeft && M.mmBanLeft() > 0) { M.toast('Matchmaking locked for ' + mmss(M.mmBanLeft()) + ' (you abandoned a match)'); return; }
    const pi = partyInfo();
    const def = plDef(U.choice(ids), ranked);
    if (pi && pi.members.length > 1) {
      if (!pi.leader) { M.toast('Only the party leader can start matchmaking.'); return; }
      if (pi.kind === 'srv') { N().queue(def.srv || def.id, ranked); return; }
      const big = ids.filter((id) => plDef(id, ranked).size >= pi.members.length);
      if (!big.length) { M.toast('Your party is too big for ' + (ids.length > 1 ? 'those playlists' : 'that playlist') + '.'); return; }
      N().partyAct('search', { ids: big, ranked: !!ranked });
      M.search = { ids: big, ranked, since: Date.now(), wait: 1e12, found: 0, party: true };
      searchBar();
      if (!BL.game) ACT.go('searching');
      return;
    }
    M.search = { ids, ranked, since: Date.now(), wait: 2500 + Math.random() * 6500, found: 0 };
    searchBar();
    if (!BL.game) ACT.go('searching');
    // online, the search lasts like a real one (long enough for someone else searching to find us)
    if (N().available() && !N().lobby && !M.p2 && N().transport !== 'ws') M.search.wait = 9000 + Math.random() * 7000;
    probeReal(M.search, def, ranked);
  }
  // Real players searching the same playlist end up in the same match: while the search runs we look for a public
  // lobby someone opened for this playlist and join it, or open one ourselves and wait. When the search time is up,
  // a lobby with real players starts (bots fill the empty seats); if nobody came it's the usual match with bots.
  function probeReal(s, def, ranked) {
    const n = N();
    if (!n.available() || n.lobby || M.p2 || n.transport === 'ws') return;
    const live = () => M.search === s && !s.found;
    s.real = { state: 'looking' };
    n.browse((err, list) => {
      if (!live()) return;
      const open = (list || []).filter((l) => l.quick === def.id && !!l.ranked === !!ranked && l.state === 'lobby' && l.players < l.max);
      const host = () => {
        if (!live()) return;
        const mmr = S.p.mmr[def.id] || (S.p.mmr.doubles || 400);
        n.host({ public: true, quick: def.id, ranked: !!ranked, mode: def.mode || 'soccar', teamSize: def.size, mapId: pickMap(), botSkill: S.botSkillForMMR(mmr), fillBots: true }, (e) => {
          if (e) { s.real = null; return; }
          if (!live()) { n.leaveP2P(); return; }
          if (def.itemPool) n.updateLobby({ itemPool: def.itemPool });
          s.real = { state: 'host', def, ranked, nextScan: Date.now() + 3000 };
        });
      };
      if (open.length) n.join(open[0].code, (e) => { if (!live()) { if (!e) n.leaveP2P(); return; } if (e) host(); else s.real = { state: 'joined' }; });
      else host();
    });
  }
  // two people who started searching at the same moment can each open a lobby: a host that is still alone looks
  // again every few seconds and moves into an earlier lobby for the same playlist (lower code wins), so they meet
  function mergeLobbies(s) {
    const n = N(), L = n.lobby, r = s.real;
    if (!r || r.state !== 'host' || r.scanning || !L || L.players.length > 1 || Date.now() < r.nextScan) return;
    r.scanning = true;
    n.browse((err, list) => {
      r.scanning = false; r.nextScan = Date.now() + 3500;
      const L2 = n.lobby;
      if (M.search !== s || s.found || !L2 || L2.players.length > 1) return;
      const mine = L2.code, other = (list || []).find((l) => l.quick === r.def.id && !!l.ranked === !!r.ranked && l.state === 'lobby' && l.players < l.max && l.code < mine);
      if (!other) return;
      n.leaveP2P();
      s.real = { state: 'joining' };
      n.join(other.code, (e) => { if (M.search !== s) { if (!e) n.leaveP2P(); return; } if (e) { s.real = null; } else s.real = { state: 'joined' }; });
    });
  }
  const realCount = () => { const L = N().lobby; return L && L.public ? L.players.length : 0; };
  function searchBar() {
    let el = document.getElementById('rlSearch');
    const s = M.search;
    const waiting = BL.game && BL.game.cfg.waitSearch;
    if (!s || (BL.game && !waiting) || (!BL.game && M.screen === 'searching')) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'rlSearch'; el.className = 'rl-search'; document.body.appendChild(el); }
    const secs = Math.floor((Date.now() - s.since) / 1000);
    const name = s.ids.length > 1 ? s.ids.length + ' PLAYLISTS' : plDef(s.ids[0], s.ranked).name.toUpperCase();
    const reg = (REGIONS.find((r) => r[0] === S.p.settings.region) || REGIONS[0])[1];
    el.innerHTML = s.found ? `<b>MATCH FOUND</b><span>${esc(name)}</span>`
      : `<i class="spin"></i><b>SEARCHING</b><span>${s.ranked ? 'COMPETITIVE' : 'CASUAL'} • ${esc(name)} • ${esc(reg)}${realCount() > 1 ? ' • ' + (realCount() - 1) + ' PLAYER' + (realCount() > 2 ? 'S' : '') + ' FOUND' : ''}</span><em>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</em><button data-act="srchCancel" title="Cancel">${BL.ICON('close', 14)}</button>`;
    el.classList.toggle('found', !!s.found);
  }
  ACT.srchCancel = () => {
    if (M.search && M.search.party) { if (!N().isPartyLeader()) { M.toast('Only the party leader can cancel the search.'); return; } N().partyAct('cancel'); }
    if (M.search && M.search.real) { const L = N().lobby; if (L && L.public) N().leaveP2P(); }
    M.search = null; searchBar(); if (M.screen === 'searching' && !BL.game) ACT.back();
  };
  // party search state comes from the party's lobby: members mirror it, and the host starts the match when it's "found"
  function partySearchSync() {
    const n = N(), L = n.lobby, sr = L && L.party ? L.searching : null;
    if (sr && !(M.search && M.search.party)) { M.search = { ids: sr.ids, ranked: sr.ranked, since: sr.since, wait: 1e12, found: 0, party: true }; if (!BL.game && M.screen !== 'searching') M.toast('Party leader is searching...'); searchBar(); }
    else if (!sr && M.search && M.search.party && !M.search.found) { M.search = null; searchBar(); if (M.screen === 'searching' && !BL.game) ACT.back(); }
    if (sr && n.role === 'host' && L.state === 'lobby' && Date.now() - sr.since > sr.wait) {
      const def = plDef(U.choice(sr.ids), sr.ranked), size = def.size;
      // the party plays on one team (it fits: the leader can only pick playlists big enough)
      const blue = Math.random() < 0.5 ? 0 : 1;
      L.players.forEach((p, i) => { p.team = i < size ? blue : 1 - blue; });
      const mmr = S.p.mmr[def.id] || (S.p.mmr.doubles || 400), sk = U.clamp(S.botSkillForMMR(mmr) + (sr.ranked ? 0 : U.rand(-0.08, 0.05)), 0.08, 1);
      n.updateLobby({ mode: def.mode || 'soccar', teamSize: size, fillBots: true, botSkill: sk, quick: def.id, ranked: !!sr.ranked, itemPool: def.itemPool || null, mapId: pickMap(), searching: null });
      if (M.search) M.search.found = Date.now();
      setTimeout(() => { M.search = null; searchBar(); n.startGame(); }, 1300);
    }
    if (M.search && M.search.party && L && L.state === 'game') { M.search = null; searchBar(); }
  }
  BL.bus.on('net:lobby', () => { partySearchSync(); if (!BL.game && (M.friendsOpen || (FR[M.screen] || {}).view === 'main')) { const a = document.activeElement; if (!a || a.tagName !== 'INPUT') M.render(); } });
  setInterval(partySearchSync, 500);
  setInterval(() => {
    const s = M.search;
    if (!s) return;
    if (BL.game && !BL.game.cfg.waitSearch) { M.search = null; searchBar(); return; }
    mergeLobbies(s);
    const L = N().lobby, full = s.real && s.real.state === 'host' && L && L.players.length >= L.teamSize * 2;
    // joined someone else's lobby: their search starts the match (give up and play bots if it never does)
    if (!s.found && s.real && s.real.state === 'joined' && Date.now() - s.since > s.wait) {
      if (Date.now() - s.since > s.wait + 20000 || !L) { N().leaveP2P(); s.real = null; } else { searchBar(); return; }
    }
    // still looking through the open lobbies: don't give up on real players yet
    const looking = s.real && (s.real.state === 'looking' || s.real.state === 'joining' || s.real.scanning) && Date.now() - s.since < 16000;
    if (L && L.public && L.players.length > 1 && !s.realAt) s.realAt = Date.now();
    const timeUp = !looking && Date.now() - s.since > s.wait;
    if (!s.found && !s.party && (full || (s.realAt && Date.now() - s.realAt > 3000) || timeUp)) {
      s.found = Date.now();
      BL.Audio.play('matchfound', 1);
      if (BL.game) BL.HUD.big('MATCH FOUND', 'Joining...', '#7fe08a', 1.4);
      setTimeout(() => {
        if (M.search !== s || (BL.game && !BL.game.cfg.waitSearch)) return;
        M.search = null; searchBar();
        const L2 = N().lobby;
        if (s.real && s.real.state === 'host' && L2 && L2.public && L2.players.length > 1) { if (BL.game) BL.App.endGame(); N().startGame(); return; }
        if (s.real && L2 && L2.public) N().leaveP2P();
        launchPlaylist(plDef(U.choice(s.ids), s.ranked), s.ranked);
      }, 1300);
    }
    searchBar();
  }, 500);

  // the searching screen (like the real one): SEARCHING band, what and where, CANCEL SEARCH, and things to do
  // while you wait; Free Play keeps the search going and pulls you into the match when it's found
  SCREENS.searching = () => {
    const s = M.search;
    if (!s) return '<div class="rl-panel narrow"><h2>NOT SEARCHING</h2></div>';
    const name = s.ids.map((id) => plDef(id, s.ranked).name.replace(/ \d.*$/, '')).join(', ');
    const i = Math.max(0, REGIONS.findIndex((r) => r[0] === S.p.settings.region));
    const regs = [REGIONS[i], REGIONS[(i + 1) % REGIONS.length]].map((r) => r[1]).join(', ');
    const secs = Math.floor((Date.now() - s.since) / 1000);
    return `<div class="rl-srch">
      <div class="sr-band"><b>${s.found ? 'MATCH FOUND' : 'SEARCHING'}</b><i class="sr-bars"><u></u><u></u><u></u></i>
        <div class="sr-line"><span></span></div>
        <small>Searching for ${s.ranked ? 'Competitive' : 'Casual'} - ${esc(name)} in: ${esc(regs)} <em id="srchClock">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</em></small></div>
      ${btn('CANCEL SEARCH', 'srchCancel', '', 'sr-cancel')}
      <div class="sr-wait"><h4>WHILE YOU WAIT</h4><div class="rl-row">${tile('wait-freeplay', 'waitFree')}${tile('wait-training', 'go', 'training')}${tile('wait-challenges', 'go', 'challenges')}</div></div>
    </div>`;
  };
  setInterval(() => { if (M.screen === 'searching' && !BL.game) { const el = document.getElementById('srchClock'); if (el && M.search) { const t = Math.floor((Date.now() - M.search.since) / 1000); el.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); } if (M.search && M.search.found && !document.querySelector('.rl-srch .sr-found')) { const b = document.querySelector('.sr-band b'); if (b) { b.textContent = 'MATCH FOUND'; b.classList.add('sr-found'); } } } }, 500);
  ACT.waitFree = () => {
    const map = S.isMapUnlocked(M.ex.map) ? M.ex.map : 'champions';
    M.lastCfg = null;
    BL.App.startMatch({ mode: 'freeplay', mapId: map, mutators: BL.defaultMutators(), players: withP2([{ id: 0, name: S.p.name, team: 0, isLocal: true, loadout: S.resolveLoadout() }]), ranked: null, botSkill: 0.5, waitSearch: true });
  };

  // start a match against bots that look like online players
  function launch(o) {
    const lo = S.resolveLoadout(), team = o.team == null ? (Math.random() < 0.5 ? 0 : 1) : o.team;
    const players = [{ id: 0, name: S.p.name, team, isLocal: true, loadout: lo }];
    const used = new Set([S.p.name]), pool = o.online === false ? BL.BOT_NAMES : BL.ONLINE_BOT_NAMES;
    let id = 1;
    const p2 = M.p2 && o.size >= 2;
    if (p2) { const pr = S.p.presets && S.p.presets[1]; players.push({ id: id++, name: M.p2.name, team, isLocal2: true, loadout: lo }); used.add(M.p2.name); void pr; }
    for (const t of [0, 1]) {
      const mine = t === team, list = (o.names && o.names[mine ? 0 : 1]) || [];
      for (let i = 0; i < o.size - (mine ? (p2 ? 2 : 1) : 0); i++) {
        const nm = list[i] || pickName(pool, used);
        used.add(nm);
        players.push({ id: id++, name: nm, team: t, isBot: true, skill: U.clamp(o.skill[mine ? 0 : 1] + U.rand(-0.05, 0.05), 0.03, 1), loadout: S.randomLoadout() });
      }
    }
    const map = o.map || pickMap();
    const cfg = { mode: o.mode || 'soccar', mapId: map, mutators: BL.defaultMutators(), players, ranked: o.ranked ? { playlist: o.playlist } : null, botSkill: o.skill[1],
      itemPool: o.itemPool || null, playlist: o.playlist || null, disguised: o.online !== false, ctx: o.ctx || null };
    M.lastCfg = { ex: { mode: cfg.mode, size: o.size, skill: o.skill[1], team, map, mutators: cfg.mutators, split: 0 }, ranked: o.ranked ? { playlist: o.playlist, skills: o.skill } : null, again: o.again || null };
    M.friendsOpen = false;
    BL.App.startMatch(cfg);
  }
  function launchPlaylist(def, ranked) {
    const mmr = S.p.mmr[def.id] || (S.p.mmr.doubles || 400);
    // casual uses a looser, hidden skill match
    const sk = U.clamp(S.botSkillForMMR(mmr) + (ranked ? 0 : U.rand(-0.08, 0.05)), 0.08, 1);
    launch({ mode: def.mode, size: def.size, skill: [sk * (ranked ? 0.96 : 0.92), sk], ranked, playlist: def.id, itemPool: def.itemPool,
      again: () => startSearch([def.id], ranked) });
  }

  // "joining" list down the right while the intro plays (screenshots: players checking in one by one)
  M.hideLoading = function () {
    old.hideLoading.apply(M, arguments);
    const g = BL.game;
    if (!g || g.mode === 'freeplay' || !(g.online || g.cfg.disguised)) return;
    const others = shuffle(g.cars.filter((c) => c !== g.local));
    let el = document.getElementById('rlJoin');
    if (el) el.remove();
    el = document.createElement('div'); el.id = 'rlJoin'; el.className = 'rl-join';
    const reg = (REGIONS.find((r) => r[0] === S.p.settings.region) || REGIONS[0])[0];
    el.innerHTML = `<div class="jn-top">JOINING</div><div class="jn-list"><div class="jn-srv">Server: ${reg}${(U.hash(String(Date.now())) >>> 0) % 90 + 10}-${(Date.now() % 9000) + 1000}</div>
      ${[g.local].concat(others).filter(Boolean).map((c, i) => `<div class="jn-r t${c.team}" data-i="${i}"><b>${i === 0 ? esc(c.name) : 'Incoming Player'}</b><i></i></div>`).join('')}</div>`;
    document.body.appendChild(el);
    const rows = el.querySelectorAll('.jn-r'), all = [g.local].concat(others);
    rows[0].classList.add('ok');
    for (let i = 1; i < rows.length; i++) {
      setTimeout(() => { if (rows[i] && all[i]) { rows[i].querySelector('b').textContent = all[i].name; rows[i].classList.add('ok'); } }, 300 + Math.random() * 2800);
    }
    const t0 = performance.now();
    const done = () => { if (!document.body.contains(el)) return; if (BL.game !== g || g.phase === 'play' || performance.now() - t0 > 5200) { el.classList.add('out'); setTimeout(() => el.remove(), 400); } else setTimeout(done, 200); };
    setTimeout(done, 600);
  };

  // ---------- FREE PLAY: choose your arena ----------
  // Like the real game: Free Play opens a list of arenas on the left and a big picture of the one you're on; START
  // (or picking it again) drives out. It remembers your choice, and the drills and tutorial use the same arena.
  const fpArena = () => { const id = S.p.settings.fpMap; return id && BL.MAP_BY_ID[id] && S.isMapUnlocked(id) ? id : 'champions'; };
  const TIME_NAME = { day: 'Day', dusk: 'Dusk', night: 'Night' };
  const fpPrev = (m) => `<div class="fp-pic" style="--s0:${m.sky[0]};--s1:${m.sky[1]};--fl:${m.floor.a}"><div class="mapc-sky"></div><div class="mapc-floor"></div>${X.mapPic(m)}</div>
      <div class="fp-cap"><b>${esc(m.name.toUpperCase())}</b><span>${esc(m.desc || '')}</span><small>${TIME_NAME[m.time] || ''}${m.labs ? ' • LABS' : ''}</small></div>`;
  SCREENS.fpArena = () => {
    const cur = M.fpPick || fpArena(), maps = BL.MAPS.filter((m) => !m.labs).concat(BL.MAPS.filter((m) => m.labs));
    return `<div class="fp-scr">
      <div class="fp-list">${maps.map((m) => { const locked = !S.isMapUnlocked(m.id);
        return `<button class="fp-ar ${m.id === cur ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="${locked ? 'lockedMap' : 'fpPick'}" data-arg="${m.id}" data-fpmap="${m.id}"><b>${esc(m.name.toUpperCase())}</b><small>${locked ? BL.ICON('lock', 12) + ' LEVEL ' + S.mapUnlockLevel(m.id) : (TIME_NAME[m.time] || '') + (m.labs ? ' • LABS' : '')}</small></button>`; }).join('')}</div>
      <div class="fp-prev">${fpPrev(BL.MAP_BY_ID[cur])}</div>
    </div>`;
  };
  ACT.freeplay = () => { M.fpPick = fpArena(); ACT.go('fpArena'); };
  ACT.fpPick = (id) => { if (M.fpPick === id) { ACT.fpStart(); return; } M.fpPick = id; M.render(); };
  ACT.fpStart = () => {
    const map = M.fpPick && S.isMapUnlocked(M.fpPick) ? M.fpPick : fpArena();
    S.p.settings.fpMap = map; S.save();
    M.lastCfg = null;
    X.startLocal({ mode: 'freeplay', size: 1, skill: 0.5, team: 0, map, mutators: BL.defaultMutators() });
  };
  // pointing at (or moving onto) an arena shows its picture before you pick it
  const fpHover = (e) => {
    const t = e.target && e.target.closest ? e.target.closest('.fp-ar') : null, box = t && document.querySelector('.fp-prev');
    if (!box || box.dataset.map === t.dataset.fpmap) return;
    box.dataset.map = t.dataset.fpmap;
    box.innerHTML = fpPrev(BL.MAP_BY_ID[t.dataset.fpmap]);
  };
  document.addEventListener('mouseover', fpHover);
  document.addEventListener('focusin', fpHover);

  // ---------- TRAINING ----------
  SCREENS.training = () => `<div class="rl-tiles">
      <div class="rl-row big">${tile('freeplay', 'freeplay')}${tile('custom', 'customTraining')}${tile('tutorial', 'tutorial')}</div>
      <div class="rl-row">${tile('aerial', 'drill', 'aerial')}${tile('striker', 'drill', 'striker')}${tile('goalie', 'drill', 'goalie')}</div>
    </div>`;
  function startDrill(kind, tutorial) {
    const map = fpArena();
    M.lastCfg = null;
    BL.App.startMatch({ mode: 'freeplay', mapId: map, mutators: BL.defaultMutators(), players: withP2([{ id: 0, name: S.p.name, team: 0, isLocal: true, loadout: S.resolveLoadout() }]), ranked: null, botSkill: 0.5, drill: kind || null, tutorial: !!tutorial });
  }
  ACT.drill = (kind) => { M.closeOverlay(); startDrill(kind); };
  ACT.customTraining = () => M.openOverlay(`<div class="dlg rl-dlg"><h2>CUSTOM TRAINING</h2><p class="muted small">Training packs: 10 shots each. Reset (Backspace / Back) retries a shot.</p>
      <div class="rl-packs">${[['aerial', 'AERIAL', 'Shots hanging in the air'], ['striker', 'STRIKER', 'Passes rolling across the box'], ['goalie', 'GOALIE', 'Shots on your net: save them'], ['mixed', 'MIXED', 'A bit of everything']].map((k) => `<button class="rl-pack" data-act="drill" data-arg="${k[0]}"><b>${k[1]}</b><small>${k[2]}</small></button>`).join('')}</div>
      <div class="row end">${btn('CLOSE', 'closeOv')}</div></div>`);
  ACT.tutorial = () => M.openOverlay(`<div class="dlg rl-dlg wide"><h2>TUTORIAL</h2><p>Learn the basics in Free Play: drive, jump, boost, flip and score.</p>${X.controlsHelp()}
      <div class="row end">${btn('CLOSE', 'closeOv')}${btn('START TUTORIAL', 'tutGo', '', 'hot')}</div></div>`);
  ACT.tutGo = () => { M.closeOverlay(); startDrill(null, true); };
  // tutorial prompts: each step waits for you to do the thing
  const TUT = [
    ['DRIVE', 'Throttle with W / RT and steer with A D / left stick.', (g) => g.local.vel.length() > 9],
    ['JUMP', 'Press Space / A to jump.', (g) => !g.local.onGround && g.local.pos.y > 1.2],
    ['BOOST', 'Hold Shift / B to boost.', (g) => g.local.boost < 92],
    ['FLIP', 'Jump, then jump again while holding a direction to flip.', (g, t) => t > 7],
    ['POWERSLIDE', 'Hold X / Ctrl while turning to powerslide.', (g, t) => t > 6],
    ['BALL CAM', 'Press C / Y to switch ball cam on and off.', (g, t) => t > 5],
    ['SCORE', 'Hit the ball into the orange goal!', (g) => g.score[0] + g.score[1] > 0],
  ];
  setInterval(() => {
    const g = BL.game;
    let el = document.getElementById('rlTut');
    if (!g || !g.cfg.tutorial || !g.local || g.phase === 'countdown') { if (el && (!g || !g.cfg.tutorial)) el.remove(); return; }
    const st = g._tut || (g._tut = { i: 0, t: 0 });
    st.t += 0.25;
    if (!el) { el = document.createElement('div'); el.id = 'rlTut'; el.className = 'rl-tut'; document.body.appendChild(el); }
    if (st.i < TUT.length && TUT[st.i][2](g, st.t)) { st.i++; st.t = 0; BL.Audio.play('confirm', 0.8); }
    el.innerHTML = st.i < TUT.length ? `<small>TUTORIAL ${st.i + 1}/${TUT.length}</small><b>${TUT[st.i][0]}</b><span>${TUT[st.i][1]}</span>` : '<small>TUTORIAL</small><b>COMPLETE!</b><span>Keep practising in Free Play, or press Esc to leave.</span>';
  }, 250);

  // ---------- PLAY OFFLINE ----------
  SCREENS.offline = () => `<div class="rl-tiles mid"><div class="rl-row big">${tile('exhibition', 'go', 'exhibition')}${tile('season', 'go', 'season')}</div></div>`;

  // Season: 8 teams, a round robin (7 weeks), then the top 4 play semi-finals and a final
  const TEAMS = ['Bulldogs', 'Express', 'Guardians', 'Mamba', 'Rebels', 'Skyhawks', 'Wolves', 'Vikings', 'Scorpions', 'Wizards', 'Cobras', 'Titans'];
  function newSeason(skill, size) {
    const names = shuffle(TEAMS).slice(0, 7);
    const teams = [{ name: (S.p.club ? S.p.club.name : S.p.name + "'s Team"), you: true, skill }].concat(names.map((n) => ({ name: n, skill: U.clamp(skill + U.rand(-0.1, 0.1), 0.05, 1) })));
    for (const t of teams) Object.assign(t, { w: 0, l: 0, gf: 0, ga: 0 });
    // circle method: team 0 fixed, the rest rotate
    const ids = [0, 1, 2, 3, 4, 5, 6, 7], weeks = [];
    for (let r = 0; r < 7; r++) {
      const w = [];
      for (let i = 0; i < 4; i++) w.push([ids[i], ids[7 - i]]);
      weeks.push(w);
      ids.splice(1, 0, ids.pop());
    }
    S.p.offSeason = { teams, weeks, week: 0, size, skill, po: null, done: null };
    S.save();
  }
  const standings = (s) => s.teams.map((t, i) => Object.assign({ i }, t)).sort((a, b) => b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  function simGame(s, a, b) {
    const A = s.teams[a], B = s.teams[b];
    const pa = U.clamp(0.5 + (A.skill - B.skill) * 1.6, 0.1, 0.9);
    let ga = U.randInt(0, 3), gb = U.randInt(0, 3);
    const aWins = Math.random() < pa;
    if (aWins && ga <= gb) ga = gb + 1; if (!aWins && gb <= ga) gb = ga + 1;
    record(s, a, b, ga, gb);
    return aWins ? a : b;
  }
  function record(s, a, b, ga, gb) {
    const A = s.teams[a], B = s.teams[b];
    A.gf += ga; A.ga += gb; B.gf += gb; B.ga += ga;
    if (ga > gb) { A.w++; B.l++; } else { B.w++; A.l++; }
  }
  function seasonOpp(s) {
    if (s.po) { const m = s.po.games.find((x) => x[0] === 0 || x[1] === 0); return m ? (m[0] === 0 ? m[1] : m[0]) : -1; }
    const m = s.weeks[s.week] && s.weeks[s.week].find((x) => x[0] === 0 || x[1] === 0);
    return m ? (m[0] === 0 ? m[1] : m[0]) : -1;
  }
  SCREENS.season = () => {
    const s = S.p.offSeason;
    M.seasonOpt = M.seasonOpt || { skill: 0.5, size: 3 };
    if (!s) {
      return `<div class="rl-panel narrow"><h2>NEW SEASON</h2><p class="muted">Play a 7-week season against 7 bot teams, then the top 4 go to the playoffs.</p>
        <div class="form"><label>Difficulty</label>${seg('seaSkill', [[0.2, 'Rookie'], [0.5, 'Pro'], [0.85, 'All-Star']], M.seasonOpt.skill)}
        <label>Team Size</label>${seg('seaSize', [[1, '1v1'], [2, '2v2'], [3, '3v3']], M.seasonOpt.size)}</div>
        <div class="row end">${btn('START SEASON', 'seaNew', '', 'hot big')}</div></div>`;
    }
    const st = standings(s), opp = seasonOpp(s);
    const status = s.done ? `<div class="sea-done">${/CHAMPIONS/.test(s.done) ? BL.ICON('trophy', 18) + ' ' : ''}${esc(s.done)}</div>`
      : `<div class="sea-next"><small>${s.po ? (s.po.round ? 'FINAL' : 'SEMI-FINAL') : 'WEEK ' + (s.week + 1) + ' OF 7'}</small><b>${esc(s.teams[0].name)} <i>VS</i> ${esc(s.teams[opp].name)}</b>${btn('PLAY MATCH', 'seaPlay', '', 'hot big')}</div>`;
    return `<div class="rl-panel"><h2>SEASON <small>${s.size}v${s.size} • ${s.skill < 0.35 ? 'Rookie' : s.skill < 0.7 ? 'Pro' : 'All-Star'}</small></h2>
      <div class="sea-cols"><table class="rl-table"><tr><th>#</th><th>TEAM</th><th>W</th><th>L</th><th>GF</th><th>GA</th></tr>
        ${st.map((t, k) => `<tr class="${t.you ? 'me' : ''} ${k === 3 ? 'cut' : ''}"><td>${k + 1}</td><td>${esc(t.name)}</td><td>${t.w}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td></tr>`).join('')}</table>
        <div>${status}${btn('NEW SEASON', 'seaReset')}</div></div></div>`;
  };
  ACT.seaSkill = (v) => { M.seasonOpt.skill = +v; M.render(); };
  ACT.seaSize = (v) => { M.seasonOpt.size = +v; M.render(); };
  ACT.seaNew = () => { newSeason(M.seasonOpt.skill, M.seasonOpt.size); M.render(); };
  ACT.seaReset = () => M.confirm('Start a new season? This season\'s results are lost.', () => { S.p.offSeason = null; S.save(); M.render(); }, 'NEW SEASON');
  ACT.seaPlay = () => {
    const s = S.p.offSeason, opp = s && seasonOpp(s);
    if (!s || opp < 0) return;
    const roster = (tn) => [0, 1, 2].map((i) => BL.BOT_NAMES[(U.hash(tn + i) >>> 0) % BL.BOT_NAMES.length]);
    launch({ mode: 'soccar', size: s.size, team: 0, skill: [s.skill * 0.95, s.teams[opp].skill], online: false, names: [roster('mine' + s.teams[0].name), roster(s.teams[opp].name)], ctx: { kind: 'season', opp } });
  };
  function seasonResult(r, won) {
    const s = S.p.offSeason;
    if (!s || s.done) return '';
    const opp = seasonOpp(s);
    const local = r.players.find((p) => p.id === r.localId), my = local ? local.team : 0;
    const gf = r.score[my], ga = r.score[1 - my];
    // a draw can't happen in a season: overtime decides; count it as a 1-goal result
    const w = r.winner < 0 ? false : won;
    record(s, 0, opp, w ? Math.max(gf, ga + 1) : gf, w ? ga : Math.max(ga, gf + 1));
    if (s.po) {
      const others = s.po.games.filter((x) => x[0] !== 0 && x[1] !== 0);
      const winners = others.map((x) => simGame(s, x[0], x[1]));
      if (!w) s.done = s.po.round ? 'RUNNERS-UP — you lost the final.' : 'Knocked out in the semi-finals.';
      else if (s.po.round) s.done = 'SEASON CHAMPIONS!';
      else { s.po = { round: 1, games: [[0, winners[0]]] }; }
    } else {
      for (const x of s.weeks[s.week]) if (x[0] !== 0 && x[1] !== 0) simGame(s, x[0], x[1]);
      s.week++;
      if (s.week >= 7) {
        const st = standings(s), seed = st.map((t) => t.i), pos = seed.indexOf(0);
        if (pos > 3) s.done = 'Season over: you finished ' + (pos + 1) + 'th and missed the playoffs.';
        else s.po = { round: 0, games: [[seed[0], seed[3]], [seed[1], seed[2]]] };
      }
    }
    S.save();
    return `<div class="pm-ctx">${s.done ? esc(s.done) : s.po ? (s.po.round ? 'Through to the FINAL!' : 'Regular season done: on to the PLAYOFFS!') : 'Week ' + s.week + ' done.'}</div>`;
  }

  // ---------- LOCAL LINK: party up with someone next to you, no internet (js/locallink.js) ----------
  M.ll = null;
  const llStop = () => { const l = M.ll; if (l && l.stopScan) { l.stopScan(); l.stopScan = null; } };
  function llDraw() {
    const l = M.ll; if (!l) return;
    const scan = BL.LocalLink.canScan();
    const qr = (code) => `<div class="ll-qr"><canvas id="llQr"></canvas><code>${esc(BL.LocalLink.pretty(code))}</code>${btn('COPY CODE', 'llCopy')}</div>`;
    const reader = (label) => `<div class="ll-read">${scan ? `<div class="ll-cam ${l.stopScan ? 'on' : ''}"><video id="llVid"></video>${l.stopScan ? '' : btn('SCAN WITH CAMERA', 'llScan', '', 'hot')}</div>` : ''}
      <label>${label}</label><div class="fp-join"><input id="llIn" placeholder="RLL1 ...." autocomplete="off" spellcheck="false">${btn('OK', 'llEnter', '', scan ? '' : 'hot')}</div></div>`;
    let body = '';
    if (l.step === 'pick') body = `<p>Play with a friend right next to you without internet. Both devices just need to be on the <b>same Wi-Fi or phone hotspot</b> (the hotspot can have no data).</p>
      <div class="ll-pick">${btn('HOST A PARTY', 'llHost', '', 'hot')}${btn('JOIN A FRIEND', 'llJoin')}</div>
      <p class="muted small">The host shows an invite code, the friend scans or types it and shows a reply code, then the host scans or types that. ${scan ? '' : 'This browser has no QR scanner, so type the codes (or copy them over with AirDrop / Nearby Share).'}</p>`;
    else if (l.step === 'busy') body = `<div class="spinner"></div><p class="center">${esc(l.msg || 'Working...')}</p>`;
    else if (l.step === 'hostInvite') body = `<div class="ll-two"><div><h4>1. YOUR FRIEND SCANS THIS</h4>${qr(l.code)}</div><div><h4>2. THEN SCAN THEIR REPLY</h4>${reader("Or type your friend's reply code")}</div></div>`;
    else if (l.step === 'joinRead') body = `<h4>1. SCAN THE HOST'S INVITE</h4>${reader("Or type the host's invite code")}`;
    else if (l.step === 'joinReply') body = `<div class="ll-two"><div><h4>2. THE HOST SCANS THIS REPLY</h4>${qr(l.code)}</div><div><h4>WAITING FOR THE HOST</h4><div class="spinner"></div><p class="muted small">Keep this open. You'll join the party as soon as the host enters your reply.</p></div></div>`;
    else if (l.step === 'done') body = `<p class="center"><b>${esc(l.msg)}</b></p><div class="ll-pick">${l.host ? btn('ADD ANOTHER PLAYER', 'llHost') : ''}${btn('DONE', 'llClose', '', 'hot')}</div>`;
    if (l.err) body = `<div class="ll-err">${esc(l.err)}</div>` + body;
    M.openOverlay(`<div class="dlg rl-dlg wide ll"><h2>LOCAL LINK</h2>${body}<div class="row end">${btn(l.step === 'done' ? 'CLOSE' : 'CANCEL', 'llClose')}</div></div>`);
    const cv = document.getElementById('llQr'); if (cv && l.code) BL.QR.draw(cv, l.code, 4);
    const inp = document.getElementById('llIn'); if (inp) inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') ACT.llEnter(); };
  }
  ACT.llOpen = () => {
    if (!BL.LocalLink || !BL.LocalLink.supported()) { M.toast('This browser can\'t make direct links.'); return; }
    M.friendsOpen = false;
    M.ll = { step: 'pick' }; llDraw();
  };
  ACT.llClose = () => { llStop(); const l = M.ll; if (l && l.pending && l.step !== 'done' && l.pending.cancel) l.pending.cancel(); M.ll = null; M.closeOverlay(); if (!BL.game) M.render(); };
  ACT.llCopy = () => { const c = M.ll && M.ll.code; if (!c) return; if (navigator.clipboard) navigator.clipboard.writeText(c).then(() => M.toast('Code copied'), () => M.toast(c)); else M.toast(c); };
  ACT.llHost = async () => {
    llStop();
    const n = N();
    if (!(n.lobby && n.role === 'host' && n.local)) n.hostLocal();
    M.ll = { step: 'busy', msg: 'Making an invite...', host: true }; llDraw();
    try { const inv = await BL.LocalLink.invite(); if (!M.ll) { inv.cancel(); return; } M.ll = { step: 'hostInvite', host: true, code: inv.code, pending: inv }; }
    catch (e) { M.ll = { step: 'pick', err: e.message || String(e) }; }
    llDraw();
  };
  ACT.llJoin = () => { llStop(); M.ll = { step: 'joinRead' }; llDraw(); };
  ACT.llScan = async () => {
    const l = M.ll, v = document.getElementById('llVid'); if (!l || !v) return;
    try { l.stopScan = await BL.LocalLink.scan(v, (code) => { l.stopScan = null; llGot(code); }); llDraw(); const v2 = document.getElementById('llVid'); if (v2 && v.srcObject) { v2.srcObject = v.srcObject; v2.play(); } }
    catch (e) { l.err = 'Camera unavailable: ' + (e.message || e.name) + '. Type the code instead.'; llDraw(); }
  };
  ACT.llEnter = () => { const v = ((document.getElementById('llIn') || {}).value || '').trim(); if (v) llGot(v); };
  async function llGot(code) {
    const l = M.ll; if (!l) return;
    llStop();
    if (l.step === 'hostInvite') {
      const inv = l.pending;
      M.ll = Object.assign({}, l, { step: 'busy', msg: 'Connecting...' }); llDraw();
      try {
        const c = await inv.accept(code);
        let ok = false;
        const fail = setTimeout(() => { if (!ok && M.ll) { M.ll = { step: 'hostInvite', host: true, code: inv.code, pending: inv, err: 'Could not reach your friend. Check you are both on the same Wi-Fi or hotspot, then try again.' }; llDraw(); } }, 20000);
        c.on('open', () => { ok = true; clearTimeout(fail); N().addLocal(c); BL.Audio.play('confirm', 0.9); });
        BL.bus.on('net:lobby', function onL(L) { if (!ok || !M.ll || M.ll.step !== 'busy') return; const p = L && L.players.find((x) => x.pid === c.peer); if (p) { M.ll = { step: 'done', host: true, msg: p.name + ' joined your party!' }; llDraw(); } });
      } catch (e) { M.ll = Object.assign({}, l, { err: e.message || String(e) }); llDraw(); }
      return;
    }
    if (l.step === 'joinRead') {
      M.ll = { step: 'busy', msg: 'Making your reply...' }; llDraw();
      try {
        const r = await BL.LocalLink.reply(code);
        if (!M.ll) { r.cancel(); return; }
        M.ll = { step: 'joinReply', code: r.code, pending: r };
        llDraw();
        N().joinLocal(r.conn, (err) => {
          if (!M.ll) return;
          if (err) { M.ll = { step: 'joinRead', err: err.message || String(err) }; llDraw(); return; }
          const L = N().lobby;
          M.ll = { step: 'done', msg: 'You joined ' + (L ? L.hostName : 'the host') + '\'s party!' }; llDraw();
          BL.Audio.play('confirm', 0.9);
        });
      } catch (e) { M.ll = { step: 'joinRead', err: e.message || String(e) }; llDraw(); }
    }
  }

  // ---------- PRIVATE MATCH ----------
  SCREENS.private = () => `<div class="rl-tiles">
      <div class="rl-row big">${tile('createprivate', 'pvCreate', 'private')}${tile('createlan', 'pvCreate', 'lan')}</div>
      <div class="rl-row">${tile('joinprivate', 'pvJoin')}${tile('joinlan', 'pvLan')}${tile('locallink', 'llOpen')}</div></div>`;
  M.pv = { kind: 'private', mode: 'soccar', size: 3, bots: 0.5, map: 'champions' };
  ACT.pvCreate = (kind) => {
    const o = M.pv; if (kind) o.kind = kind;
    M.openOverlay(`<div class="dlg rl-dlg wide"><h2>CREATE ${o.kind === 'lan' ? 'LAN' : 'PRIVATE'} MATCH</h2>
      <div class="form"><label>Mode</label>${seg('pvMode', ['soccar', 'rumble', 'heatseeker'].map((m) => [m, BL.MODES[m].name]), o.mode)}
      <label>Team Size</label>${seg('pvSize', [[1, '1v1'], [2, '2v2'], [3, '3v3'], [4, '4v4']], o.size)}
      <label>Bots</label>${seg('pvBots', [[-1, 'None'], [0.2, 'Rookie'], [0.5, 'Pro'], [0.85, 'All-Star']], o.bots)}
      <label>Arena</label>${X.sel('pvMap', MAP_POOL().map((m) => [m.id, m.name]), o.map, 'id="pvMapSel"')}</div>
      <p class="muted small">${N().available() ? (o.kind === 'lan' ? 'LAN matches are listed for anyone on Join LAN Match.' : 'Friends join with the match code shown in the lobby.') : 'No internet connection: this will be a local private match with bots.'}</p>
      <div class="row end">${btn('CANCEL', 'closeOv')}${btn('CREATE MATCH', 'pvGo', '', 'hot')}</div></div>`);
    const s = document.getElementById('pvMapSel'); if (s) s.onchange = () => { M.pv.map = s.value; };
  };
  ACT.pvMode = (v) => { M.pv.mode = v; ACT.pvCreate(); };
  ACT.pvSize = (v) => { M.pv.size = +v; ACT.pvCreate(); };
  ACT.pvBots = (v) => { M.pv.bots = +v; ACT.pvCreate(); };
  ACT.pvGo = () => {
    const o = M.pv;
    M.closeOverlay();
    if (!N().available()) {
      Object.assign(M.ex, { mode: o.mode, size: o.size, skill: o.bots < 0 ? 0.5 : o.bots, map: o.map });
      ACT.go('exhibition');
      return;
    }
    Object.assign(M.on, { mode: o.mode, size: o.size, fill: o.bots >= 0, skill: o.bots < 0 ? 0.5 : o.bots });
    M.ex.map = o.map;
    ACT.host(o.kind === 'lan' ? 'public' : 'private');
  };
  ACT.pvJoin = () => M.openOverlay(`<div class="dlg rl-dlg"><h2>JOIN PRIVATE MATCH</h2><div class="form"><label>Match code</label><input id="pvCode" maxlength="8" placeholder="CODE" style="text-transform:uppercase"></div>
      <div class="row end">${btn('CANCEL', 'closeOv')}${btn('JOIN', 'pvJoinGo', '', 'hot')}</div></div>`);
  ACT.pvJoinGo = () => { const v = ((document.getElementById('pvCode') || {}).value || '').trim(); M.closeOverlay(); ACT.joinCode(v); };
  ACT.pvLan = () => {
    if (!N().available()) { M.toast('Joining matches needs an internet connection.'); return; }
    const draw = (list) => M.openOverlay(`<div class="dlg rl-dlg wide"><h2>JOIN LAN MATCH</h2><div class="publist">${list === 'loading' ? '<div class="muted">Searching…</div>' : list.length ? list.map((l) => `<div class="pubrow"><b>${esc(l.hostName)}</b><span>${esc(BL.MODES[l.mode] ? BL.MODES[l.mode].name : l.mode)} ${l.teamSize}v${l.teamSize}</span><span>${l.players}/${l.max}</span>${l.state === 'lobby' && l.players < l.max ? `<button class="mini" data-act="joinCode" data-arg="${esc(l.code)}">JOIN</button>` : '<span class="muted">IN GAME</span>'}</div>`).join('') : '<div class="muted">No matches found.</div>'}</div>
      <div class="row end">${btn('REFRESH', 'pvLan')}${btn('CLOSE', 'closeOv')}</div></div>`);
    draw('loading');
    N().browse((err, list) => draw(list || []));
  };

  // ---------- TOURNAMENTS ----------
  // a tournament every hour of every day, cycling through every mode
  const TOUR_MODES = [['3V3 SOCCAR', 'soccar', 3], ['2V2 SOCCAR', 'soccar', 2], ['3V3 RUMBLE', 'rumble', 3], ['2V2 HEATSEEKER', 'heatseeker', 2], ['1V1 SOCCAR', 'soccar', 1],
    ['2V2 SPIKE DROP', 'rumble', 2, ['spikes']], ['4V4 CHAOS', 'soccar', 4], ['3V3 HEATSEEKER', 'heatseeker', 3], ['2V2 RUMBLE', 'rumble', 2]];
  // bots by tournament rank: Bronze plays like a Bronze, Supersonic Legend like an SSL
  const TIER_SKILL = [0.12, 0.25, 0.38, 0.52, 0.65, 0.78, 0.9, 1.0];
  const TOUR_RANKS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION', 'GRAND CHAMPION', 'SUPERSONIC LEGEND'];
  const ROUND = ['QUARTERFINALS', 'SEMIFINALS', 'FINALS'];
  const TEAM_WORDS = ['Apex', 'Blitz', 'Nova', 'Fury', 'Zenith', 'Pulse', 'Vortex', 'Echo', 'Titan', 'Rogue', 'Inferno', 'Glacier', 'Phantom', 'Lunar', 'Solar', 'Havoc', 'Static', 'Ember'];
  // the day's schedule: one every hour (10 AM, 11 AM, 12 PM ... 10 PM, and on through the night) for the next 14 hours
  function slots(n) {
    const d = new Date(); d.setMinutes(0, 0, 0);
    const out = [];
    for (let k = 1; k <= (n || 14); k++) { const t = d.getTime() + k * 3600000, h = new Date(t).getHours(); out.push({ t, mode: TOUR_MODES[h % TOUR_MODES.length] }); }
    return out;
  }
  // teams registered: nobody until registration opens, then it fills up toward the 64 team cap as the start nears
  const TOUR_CAP = 64;
  function registered(sl) {
    const left = sl.t - Date.now();
    if (left > OPEN_BEFORE) return 0;
    const k = U.clamp(1 - left / OPEN_BEFORE, 0, 1), base = 6 + ((U.hash('tr' + sl.t) >>> 0) % 7);
    return Math.min(TOUR_CAP, Math.round(base + (TOUR_CAP - base) * Math.pow(k, 0.6)));
  }
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toUpperCase();
  const until = (t) => { const m = Math.max(0, Math.round((t - Date.now()) / 60000)); return (m >= 60 ? Math.floor(m / 60) + 'h ' : '') + (m % 60) + 'm'; };
  const mmss = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const OPEN_BEFORE = 15 * 60000, READY_TIME = 120000, JOIN_TIME = 4000, TOUR_MAX = 150 * 60000;
  // How a tournament runs (like the real game): registration opens 15 min before the start and you wait in the
  // queue; at the start "JOINING ROUND 1 AGAINST <team>", then a ready-up screen laid out like the end of a match
  // (both teams, who's ready) for 2 minutes or until everyone is ready; the match; then you wait for the other
  // matches before the next round. A party plays together: only the leader registers, the registration lands in
  // every member's schedule, everyone readies up and the leader starts the round, played online together.
  // A tournament is over 2.5 hours after it starts, and leaving (or closing the game) during a round knocks you out.
  const tourParty = () => { const pi = partyInfo(); return pi && pi.kind === 'lobby' && pi.members.length > 1 ? pi : null; };
  const rkey = (c) => c.t + ':' + c.round;
  const slotMode = (t) => TOUR_MODES[new Date(t).getHours() % TOUR_MODES.length];
  SCREENS.tournaments = () => {
    const tr = ext().tour, c = tr.cur;
    if (c && c.stage === 'ready') return readyRoom(c);
    if (c) return bracket(c);
    const tRank = TOUR_RANKS[Math.min(tr.rank, 7)];
    return `<div class="rl-tour">
      <div class="tr-head"><div class="tr-top">TOP 3 WEEKLY PLACEMENTS<div>${[0, 1, 2].map((i) => `<i class="tr-med ${tr.best[i] != null ? 'got' : ''}">${tr.best[i] != null ? TOUR_RANKS[tr.best[i]].slice(0, 4) : '&mdash;'}</i>`).join('')}</div></div>
        <div class="tr-rank">${rankIcon(BL.RANKS[Math.min(tr.rank, 7)].min + 1, 'sm')}<div><b>${tRank}</b><small>TOURNAMENT RANK &bull; ${tr.wins % 3}/3 WINS TO RANK UP</small></div></div></div>
      <div class="tr-cards">${slots().map((sl) => {
        const open = sl.t - Date.now() <= OPEN_BEFORE, q = tr.queued === sl.t;
        const act = q ? `<div class="tr-q"><i class="spin"></i>QUEUED &bull; STARTS IN <b id="tqClock">${mmss(sl.t - Date.now())}</b></div>${btn('LEAVE QUEUE', 'tourLeave', '', '')}`
          : open ? btn(tr.queued ? 'JOIN' : 'JOIN QUEUE', 'tourQueue', String(sl.t), 'hot') : `<span class="tr-opens">REGISTRATION OPENS IN ${until(sl.t - OPEN_BEFORE)}</span>`;
        return `<div class="tr-card ${open ? 'first' : ''} ${q ? 'queued' : ''}">
          <div class="tr-time">${clock(sl.t)}</div>
          <div class="tr-art"><img src="${TILE(sl.mode[1] === 'rumble' ? (sl.mode[3] ? 'spikedrop' : 'rumble') : sl.mode[1] === 'heatseeker' ? 'heatseeker2' : sl.mode[2] === 1 ? 'duel' : sl.mode[2] === 2 ? 'doubles' : sl.mode[2] === 4 ? 'quads' : 'standard')}" alt="" draggable="false"></div>
          <div class="tr-info"><small>STARTS IN: ${until(sl.t)}</small><b>${sl.mode[0]}</b></div>
          <div class="tr-fill" data-t="${sl.t}"><i style="width:${Math.round((registered(sl) / TOUR_CAP) * 100)}%"></i><span>${registered(sl) ? registered(sl) + ' / ' + TOUR_CAP + ' TEAMS' + (registered(sl) >= TOUR_CAP ? ' &bull; FULL' : '') : 'REGISTRATION OPENS ' + clock(sl.t - OPEN_BEFORE)}</span></div>
          <div class="tr-act">${act}</div></div>`; }).join('')}</div>
      <div class="tr-region">Region: ${esc((REGIONS.find((r) => r[0] === S.p.settings.region) || REGIONS[0])[1].toUpperCase())}${partyInfo() ? ' &bull; Your party registers together' : ''}</div></div>`;
  };
  // the registration bars tick up while you watch
  setInterval(() => {
    if (M.screen !== 'tournaments' || BL.game) return;
    document.querySelectorAll('.tr-fill[data-t]').forEach((el) => {
      const sl = { t: +el.dataset.t }, n = registered(sl);
      el.querySelector('i').style.width = Math.round((n / TOUR_CAP) * 100) + '%';
      el.querySelector('span').innerHTML = n ? n + ' / ' + TOUR_CAP + ' TEAMS' + (n >= TOUR_CAP ? ' &bull; FULL' : '') : 'REGISTRATION OPENS ' + clock(sl.t - OPEN_BEFORE);
    });
  }, 3000);
  ACT.tourAbout = () => M.openOverlay(`<div class="dlg rl-dlg"><h2>TOURNAMENTS</h2><p>A tournament starts every hour. Registration opens 15 minutes before: join the queue and wait (a party registers together, from the leader). When it starts you're put against another team, and both teams get 2 minutes to ready up before each round; it starts as soon as everyone is ready. Win the Quarterfinals, Semifinals and Finals to win a Tournament Drop and a winner title. Leaving a round knocks you out.</p><div class="row end">${btn('OK', 'closeOv', '', 'hot')}</div></div>`);
  ACT.tourQueue = (t) => {
    const party = tourParty();
    // a party registers together: only the leader can, and it has to fit the team size
    if (party && !party.leader) { M.toast('Only your party leader can register the party'); return; }
    if (party && party.members.length > slotMode(+t)[2]) { M.toast('Your party is too big for a ' + slotMode(+t)[0] + ' tournament'); return; }
    const tr = ext().tour; tr.queued = +t; S.save(); M.render(); BL.Audio.play('confirm', 0.9);
    if (party) BL.Net.partyAct('tour', { tour: +t });
  };
  ACT.tourLeave = () => {
    const party = tourParty();
    if (party && !party.leader) { M.toast('Only your party leader can leave the queue'); return; }
    const tr = ext().tour; tr.queued = null; S.save(); M.render();
    if (party) BL.Net.partyAct('tour', { tour: 0 });
  };
  // an online party match that is a tournament round counts for everyone in it
  // (the party's host builds the match, and may not have seen the leader's call yet: the lobby's tourGo counts too)
  M.netCtx = () => {
    const c = S.p.tour && S.p.tour.cur, L = BL.Net && BL.Net.lobby;
    return c && !c.out && (c.stage === 'playing' || (L && L.tourGo === rkey(c))) ? { kind: 'tour' } : null;
  };
  function startTour(slot) {
    const tr = ext().tour, rnd = U.rng(slot.t % 100000);
    const words = shuffle(TEAM_WORDS, rnd);
    // a party is named after its leader; everything random here is seeded by the start time, so every member of
    // a party sees the same teams, teammates and bracket
    const party = tourParty(), lead = party && party.members.find((m) => m.lead);
    const teams = [{ name: S.p.club ? S.p.club.name : 'Team ' + (lead ? lead.name : S.p.name), you: true }].concat(words.slice(0, 7).map((w) => ({ name: 'Team ' + w })));
    const rank = Math.min(tr.rank, 7), skill = TIER_SKILL[rank];
    const taken = new Set(party ? party.members.map((m) => m.name) : [S.p.name]);
    const mates = [];
    for (let i = 0; mates.length < 3 && i < 40; i++) { const n = BL.ONLINE_BOT_NAMES[(U.hash(slot.t + ':mate' + i) >>> 0) % BL.ONLINE_BOT_NAMES.length]; if (!taken.has(n)) { taken.add(n); mates.push(n); } }
    tr.cur = { mode: slot.mode, t: slot.t, teams, round: 0, skill, rank, alive: [0, 1, 2, 3, 4, 5, 6, 7], res: [], stage: 'joining', at: Date.now(), mates };
    tr.queued = null;
    S.save();
  }
  const myOpp = (c) => { for (let i = 0; i < c.alive.length; i += 2) { const a = c.alive[i], b = c.alive[i + 1]; if (a === 0 || b === 0) return a === 0 ? b : a; } return -1; };
  const oppNames = (c, opp) => [0, 1, 2, 3].map((i) => '[' + c.teams[opp].name.slice(5, 8).toUpperCase() + '] ' + BL.ONLINE_BOT_NAMES[(U.hash(c.teams[opp].name + i) >>> 0) % BL.ONLINE_BOT_NAMES.length]);
  function bracket(c) {
    const cols = [];
    let alive = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let r = 0; r < 3; r++) {
      const pairs = [];
      for (let i = 0; i < alive.length; i += 2) pairs.push([alive[i], alive[i + 1]]);
      const winners = c.res[r] || null;
      cols.push(`<div class="br-col"><h4>${ROUND[r]}</h4>${pairs.map((p, k) => { const w = winners ? winners[k] : -1; return `<div class="br-m">${p.map((t) => `<div class="br-t ${c.teams[t].you ? 'me' : ''} ${w === t ? 'won' : w >= 0 ? 'lost' : ''}">${esc(c.teams[t].name)}</div>`).join('')}</div>`; }).join('')}</div>`);
      if (!winners) break;
      alive = winners;
    }
    const opp = myOpp(c);
    const status = c.champ ? '<div class="sea-done">' + BL.ICON('trophy', 18) + ' TOURNAMENT CHAMPIONS!</div>' : c.out ? `<div class="sea-done">Eliminated in the ${esc(ROUND[c.round].toLowerCase())}.</div>`
      : c.stage === 'joining' ? `<div class="tr-join">JOINING ${ROUND[c.round].replace(/S$/, '')} AGAINST <b>${esc(c.teams[opp].name.toUpperCase())}</b></div>`
      : `<div class="tr-wait"><i class="spin"></i>WAITING FOR THE OTHER MATCHES &bull; NEXT ROUND IN <b id="tqClock">${mmss(c.next - Date.now())}</b></div>`;
    return `<div class="rl-panel"><h2>${esc(c.mode[0])} TOURNAMENT <small>${clock(c.t)}</small></h2><div class="rl-bracket">${cols.join('')}</div>
      ${status}<div class="row end">${c.champ || c.out ? btn('FINISH', 'tourDone', '', 'hot big') : btn('LEAVE TOURNAMENT', 'tourQuit')}</div></div>`;
  }
  // who's ready before a round: you, your party (their ready-up comes through the party lobby), and the bots
  // filling both teams, who ready up one by one
  function readyState(c) {
    const size = c.mode[2], key = rkey(c), party = tourParty(), L = BL.Net && BL.Net.lobby;
    const humans = party ? party.members.filter((m) => !m.me).map((m) => ({ name: m.name, human: true, ready: !!(L && L.tourReady && L.tourReady[m.pid] === key) })) : [];
    const mine = [{ name: S.p.name, me: true, human: true, ready: !!c.meReady }].concat(humans);
    let bi = 0;
    const bot = (name) => ({ name, ready: c.botsReady > bi++ });
    for (const n of c.mates || []) { if (mine.length >= size) break; mine.push(bot(n)); }
    const them = oppNames(c, myOpp(c)).slice(0, size).map(bot);
    return { mine: mine.slice(0, size), them, bots: bi, allHumans: !!c.meReady && humans.every((h) => h.ready), sig: humans.map((h) => +h.ready).join('') };
  }
  // the ready-up before each round, laid out like the end of a match: both teams and who's ready
  function readyRoom(c) {
    const opp = myOpp(c), left = c.readyUntil - Date.now(), rs = readyState(c);
    const row = (p) => `<tr class="${p.me ? 'me' : ''}"><td>${esc(p.name)}</td><td class="rr-st ${p.ready ? 'ok' : ''}">${p.ready ? BL.ICON('check', 13) + ' READY' : 'NOT READY'}</td></tr>`;
    const table = (t, name, list) => `<table class="t${t}"><thead><tr><th>${esc(name.toUpperCase())}</th><th>STATUS</th></tr></thead>${list.map(row).join('')}</table>`;
    const party = tourParty();
    return `<div class="pv rr-pv"><div class="pv-top"><h1>${ROUND[c.round]}</h1><div class="rr-sub">${esc(c.mode[0])} TOURNAMENT &bull; ${clock(c.t)}</div></div>
      <div class="rr-clock">MATCH STARTS IN <b id="tqClock">${mmss(left)}</b> <small>or as soon as everyone is ready</small></div>
      <div class="pv-tables">${table(0, c.teams[0].name, rs.mine)}${table(1, c.teams[opp].name, rs.them)}</div>
      <div class="pv-btns">${c.meReady ? `<em class="sh-done">READY &mdash; ${party && !party.leader ? 'waiting for your party leader' : 'waiting for everyone'}</em>` : btn('READY UP', 'tourReady', '', 'hot big')}${btn('LEAVE TOURNAMENT', 'tourQuit')}</div></div>`;
  }
  ACT.tourReady = () => {
    const c = ext().tour.cur; if (!c || c.stage !== 'ready') return;
    c.meReady = true; S.save(); BL.Audio.play('confirm', 0.9); M.render();
    if (tourParty()) BL.Net.partyAct('tready', { k: rkey(c) });
  };
  ACT.tourQuit = () => M.confirm('Leave this tournament? You\'ll be knocked out.', () => { const tr = ext().tour; tr.cur = null; S.save(); M.render(); }, 'LEAVE');
  ACT.tourDone = () => { const tr = ext().tour; tr.cur = null; S.save(); M.render(); };
  function playRound(c) {
    const opp = myOpp(c);
    const sk = Math.min(1, c.skill + c.round * 0.04);
    c.stage = 'playing'; c.playAt = Date.now(); S.save();
    // a party plays its rounds online together (the leader calls it, the party's host starts it); otherwise
    // against bots that look online
    const party = tourParty();
    if (party) {
      if (party.leader) BL.Net.partyAct('tplay', { mode: c.mode[1], teamSize: c.mode[2], itemPool: c.mode[3] || null, names: [c.mates, oppNames(c, opp)] });
      return;
    }
    launch({ mode: c.mode[1], size: c.mode[2], skill: [sk * 0.95, sk], itemPool: c.mode[3] || null, names: [c.mates, oppNames(c, opp)], team: 0, ctx: { kind: 'tour' } });
  }
  function tourResult(r, won) {
    const tr = ext().tour, c = tr.cur;
    if (!c || c.out || c.champ) return '';
    const w = won && r.winner >= 0;
    const pairs = []; for (let i = 0; i < c.alive.length; i += 2) pairs.push([c.alive[i], c.alive[i + 1]]);
    // the other matches (seeded, so a whole party sees the same bracket)
    const rnd = U.rng(((c.t / 1000) | 0) + c.round * 7919);
    const winners = pairs.map((p) => (p[0] === 0 || p[1] === 0 ? (w ? 0 : (p[0] === 0 ? p[1] : p[0])) : (rnd() < 0.5 ? p[0] : p[1])));
    c.res[c.round] = winners;
    let msg;
    if (!w) { c.out = true; c.stage = 'done'; msg = 'Eliminated in the ' + ROUND[c.round].toLowerCase() + '.'; }
    else if (c.round === 2) {
      c.champ = true; c.stage = 'done'; tr.wins++;
      // winner titles: the first win at a rank gives that rank's title, the third gives the 3x title
      const rk = c.rank == null ? Math.min(tr.rank, 7) : c.rank;
      tr.winsAt = tr.winsAt || {};
      tr.winsAt[rk] = (tr.winsAt[rk] || 0) + 1;
      const tid = tr.winsAt[rk] === 1 ? 'title_tour_' + rk : tr.winsAt[rk] === 3 ? 'title_tour3_' + rk : null;
      if (tid && BL.ITEM_BY_ID[tid] && !S.owns(tid)) { S.addItem(tid); setTimeout(() => M.toast('New title: ' + BL.ITEM_BY_ID[tid].text), 900); }
      if (tr.wins % 3 === 0 && tr.rank < 7) tr.rank++;
      tr.best = tr.best.concat([tr.rank]).sort((a, b) => b - a).slice(0, 3);
      const drop = S.awardDrop(['rare', 'rare', 'veryrare', 'veryrare', 'import', 'import', 'exotic', 'exotic'][tr.rank]);
      msg = BL.ICON('trophy', 18) + ' TOURNAMENT CHAMPIONS! Reward: ' + R(drop.rarity).name + ' Tournament Drop';
    } else {
      c.round++; c.alive = winners; c.stage = 'between'; c.next = Date.now() + (40 + rnd() * 50) * 1000;
      msg = 'On to the ' + ROUND[c.round].toLowerCase() + '! Waiting for the other matches...';
    }
    S.save();
    return `<div class="pm-ctx">${msg}</div>`;
  }
  // the tournament clock: queue -> start -> joining -> ready-up -> match -> waiting -> next round
  let tourBoot = true;
  setInterval(() => {
    if (!S.p || !S.p.tour) return;
    const tr = S.p.tour, now = Date.now();
    // a party leader's registration shows up in the members' schedules
    const L = BL.Net && BL.Net.lobby, pi = L && partyInfo();
    if (pi && pi.kind === 'lobby' && !pi.leader && L.tour !== undefined) { const t = L.tour || null; if (tr.queued !== t && !tr.cur) { tr.queued = t; S.save(); if (t) M.toast('Your party joined the ' + clock(t) + ' tournament'); if (M.screen === 'tournaments' && !BL.game) M.render(); } }
    // a tournament doesn't wait for you: it's over 2.5 h after the start, and a round you weren't in when the game
    // was closed (or reloaded) knocks you out
    if (tr.cur && now - tr.cur.t > TOUR_MAX) {
      const old = tr.cur; tr.cur = null; S.save();
      if (!old.out && !old.champ) M.toast('The ' + clock(old.t) + ' tournament has ended.');
      if (M.screen === 'tournaments' && !BL.game) M.render();
    }
    if (tourBoot) {
      tourBoot = false;
      const c0 = tr.cur;
      if (c0 && c0.stage === 'playing' && !BL.game && !c0.out && !c0.champ) { c0.out = true; c0.stage = 'done'; S.save(); M.toast('You left your tournament match, so your team was knocked out.'); }
    }
    // only the round itself holds the clock; in any other match it keeps running (miss the ready-up and you're out)
    const c = tr.cur;
    if (BL.game && ((BL.game.cfg.ctx && BL.game.cfg.ctx.kind === 'tour') || (c && c.stage === 'playing'))) return;
    let changed = false;
    if (tr.queued && now >= tr.queued) {
      if (now - tr.queued > 10 * 60000) tr.queued = null;
      else {
        startTour({ t: tr.queued, mode: slotMode(tr.queued) });
        if (BL.game) M.toast('Your tournament is starting! Leave this match to ready up.');
        else { M.toast('Your tournament is starting!'); if (M.screen !== 'tournaments') ACT.go('tournaments'); }
      }
      changed = true;
    }
    const cur = tr.cur;
    if (cur && !cur.out && !cur.champ) {
      const c = cur;
      if (c.stage === 'between' && now >= c.next) { c.stage = 'joining'; c.at = now; changed = true; }
      if (c.stage === 'joining' && now - c.at >= JOIN_TIME) {
        c.stage = 'ready'; c.readyUntil = now + READY_TIME; c.meReady = false; c.botsReady = 0;
        c.mates = (c.mates && c.mates.length) ? c.mates : [0, 1, 2].map(() => pickName(BL.ONLINE_BOT_NAMES, new Set([S.p.name])));
        changed = true;
      }
      if (c.stage === 'ready') {
        const rs = readyState(c), key = rkey(c), party = tourParty();
        // the bots ready up one by one; a party member readying up redraws the screen
        if (Math.random() < 0.25 && c.botsReady < rs.bots) { c.botsReady++; changed = true; }
        if (rs.sig !== c.readySig) { c.readySig = rs.sig; changed = true; }
        const out = (msg) => { c.out = true; c.stage = 'done'; c.res[c.round] = c.res[c.round] || []; M.toast(msg); changed = true; };
        if (party && !party.leader) {
          // party members follow the leader's call
          if (L && L.tourGo === key) { c.stage = 'playing'; c.playAt = now; changed = true; }
          else if ((L && L.tourGo === key + ':out') || now >= c.readyUntil + 15000) out('Not everyone readied up in time, so your team forfeited.');
        } else if ((rs.allHumans && c.botsReady >= rs.bots) || now >= c.readyUntil) {
          if (!rs.allHumans) { if (party) BL.Net.partyAct('tgo', { k: key + ':out' }); out(party ? 'Not everyone readied up in time, so your team forfeited.' : 'You didn\'t ready up in time, so your team forfeited.'); }
          else { if (party) BL.Net.partyAct('tgo', { k: key }); S.save(); playRound(c); return; }
        }
      }
      // a round that never got going (the party's host dropped)
      if (c.stage === 'playing' && !BL.game && !M.postShown && now - (c.playAt || now) > 60000) { c.out = true; c.stage = 'done'; M.toast('Your tournament round couldn\'t start, so your team was knocked out.'); changed = true; }
    }
    if (changed) S.save();
    if (BL.game) return;
    if (M.screen === 'tournaments' && (changed || c)) {
      const el = document.getElementById('tqClock');
      if (changed || !el) M.render();
      else if (c && c.stage === 'ready') el.textContent = mmss(c.readyUntil - now);
      else if (c && c.stage === 'between') el.textContent = mmss(c.next - now);
    } else if (M.screen === 'tournaments' && tr.queued) { const el = document.getElementById('tqClock'); if (el) el.textContent = mmss(tr.queued - now); }
  }, 1000);

  // ---------- GARAGE: presets ----------
  function savePreset() { const p = ext(); const cur = p.presets[p.presetIdx || 0]; if (cur) { cur.loadout = Object.assign({}, p.loadout); cur.colors = Object.assign({}, p.colors); } }
  function loadPreset(i) {
    const p = ext(), pr = p.presets[i];
    if (!pr) return;
    p.presetIdx = i;
    for (const slot of S.SLOTS) if (pr.loadout[slot] && S.entry(pr.loadout[slot])) p.loadout[slot] = pr.loadout[slot];
    if (pr.colors) p.colors = Object.assign({}, p.colors, pr.colors);
    S.save(); BL.Garage.refresh();
  }
  SCREENS.garage = () => {
    const p = ext(), pr = p.presets[p.presetIdx || 0];
    const item = (label, act, arg, extra) => `<button class="rl-li" data-act="${act}" data-arg="${arg || ''}"><span>${label}</span>${extra || ''}</button>`;
    return `<div class="rl-preset">
      <div class="pr-head"><button class="pr-arr" data-act="prStep" data-arg="-1">‹</button><b>${esc(pr.name)}</b><button class="pr-arr" data-act="prStep" data-arg="1">›</button></div>
      <div class="rl-list">
        ${item('CUSTOMIZE CAR', 'go', 'customize')}
        ${item('CREATE NEW PRESET', 'prNew', '', '<i class="pr-ic" data-act="prRename" title="Rename">' + BL.ICON('pencil', 14) + '</i><i class="pr-ic" data-act="prDel" title="Delete">' + BL.ICON('trash', 14) + '</i>')}
        ${item('TRADE IN', 'go', 'tradein')}
        ${item('MANAGE INVENTORY', 'go', 'inventory', S.unseenCount() ? `<em class="hot">${S.unseenCount()}</em>` : '')}
        ${item('DROPS', 'go', 'drops', p.drops.length ? `<em class="hot">${p.drops.length}</em>` : '')}
      </div>
      <div class="pr-note">Customize your vehicle. Preset ${(p.presetIdx || 0) + 1} of ${p.presets.length}.</div></div>`;
  };
  AFTER.garage = () => BL.Garage.setBoostPreview(false);
  ACT.prStep = (d) => { savePreset(); const p = ext(); loadPreset(((p.presetIdx || 0) + +d + p.presets.length) % p.presets.length); M.render(); };
  ACT.prNew = (arg, el, e) => {
    if (e && e.target.closest('.pr-ic')) return;
    savePreset(); const p = ext();
    if (p.presets.length >= 20) { M.toast('20 presets max'); return; }
    p.presets.push({ name: 'PRESET ' + (p.presets.length + 1), loadout: Object.assign({}, p.loadout), colors: Object.assign({}, p.colors) });
    p.presetIdx = p.presets.length - 1; S.save(); M.render(); M.toast('Preset created');
  };
  ACT.prRename = () => {
    const p = ext(), pr = p.presets[p.presetIdx || 0];
    const v = window.prompt('Preset name', pr.name);
    if (v && v.trim()) { pr.name = v.trim().slice(0, 18).toUpperCase(); S.save(); M.render(); }
  };
  ACT.prDel = () => {
    const p = ext();
    if (p.presets.length < 2) { M.toast('You need at least one preset'); return; }
    M.confirm('Delete ' + esc(p.presets[p.presetIdx].name) + '?', () => { p.presets.splice(p.presetIdx, 1); loadPreset(Math.max(0, p.presetIdx - 1)); M.render(); }, 'DELETE');
  };
  ACT.gSwap = () => { BL.Garage.setTeam(BL.Garage.team ? 0 : 1); M.render(); };
  ACT.gRandom = () => {
    for (const slot of S.SLOTS) {
      if (slot === 'anthem' || slot === 'title') continue;
      const own = S.p.inventory.filter((e) => S.itemDef(e.id).cat === slot && BL.inSeason(S.itemDef(e.id)));
      if (own.length) S.p.loadout[slot] = U.choice(own).uid;
    }
    savePreset(); S.save(); BL.Garage.refresh(); M.render();
  };
  // customize: the old garage grid, laid out like the real one (icon tabs, title, grid, item card)
  M.gcat = M.gcat || 'body';
  SCREENS.customize = () => {
    const cats = BL.CATEGORIES.map((c) => `<button class="cz-tab ${M.gcat === c.id ? 'on' : ''}" data-act="gcat" data-arg="${c.id}" title="${esc(c.name)}">${BL.ICON(c.icon, 26)}</button>`).join('') + `<button class="cz-tab ${M.gcat === 'colors' ? 'on' : ''}" data-act="gcat" data-arg="colors" title="Paint">${BL.ICON('paint', 26)}</button>`;
    const cat = BL.CATEGORIES.find((c) => c.id === M.gcat);
    const owned = S.p.inventory.filter((e) => S.itemDef(e.id).cat === M.gcat && BL.inSeason(S.itemDef(e.id)));
    const eq = M.gcat !== 'colors' && S.entry(S.p.loadout[M.gcat]);
    const d = eq && S.itemDef(eq.id);
    const card = d ? `<div class="cz-card" style="--rc:${R(d.rarity).color}"><b>${esc(d.name.toUpperCase())}</b><small>${R(d.rarity).name.toUpperCase()}</small>
        ${eq.paint ? `<div>Paint: <b>${esc(BL.PAINT_BY_ID[eq.paint].name)}</b></div>` : ''}${eq.cert ? `<div>Certified: <b>${esc(BL.CERT_BY_ID[eq.cert].name)}</b> ${eq.certN || 0}</div>` : ''}
        ${d.desc ? `<p>${esc(d.desc)}</p>` : ''}<div class="cz-eq">${BL.ICON('check', 14)} EQUIPPED</div></div>` : '';
    const html = old.garage();
    return `<div class="rl-cz"><div class="cz-tabs">${cats}</div>
      <div class="cz-title"><b>${esc(cat ? cat.name.toUpperCase() : 'PAINT')}</b><small>${cat ? owned.length + ' COLLECTED' : 'TEAM & ACCENT COLORS'}</small></div>
      <div class="cz-grid">${html}</div></div>${card}`;
  };
  AFTER.customize = () => old.garageAfter && old.garageAfter();

  // ---------- TRADE IN / SHOP / BUY CREDITS ----------
  SCREENS.tradein = () => {
    const t = M.trade, tiers = ['rare', 'veryrare', 'import', 'exotic'];
    const n = (r) => S.p.inventory.filter((e) => { const d = S.itemDef(e.id); return d.rarity === r && !d.def && BL.inSeason(d) && !S.isEquipped(e.uid); }).length;
    return `<div class="rl-trade"><div class="tr-core"><h4>CORE ITEMS</h4><div class="tr-boxes">${tiers.map((r) => `<button class="tr-box ${t.rar === r ? 'on' : ''}" style="--rc:${R(r).color}" data-act="tRar" data-arg="${r}"><i>${n(r)}</i><b>${R(r).name}</b></button>`).join('')}</div></div>
      <div class="tr-side"><b>TRADE IN</b><p>Select an available quality, then pick five items to trade in for a new item of the next quality.</p></div>
      <div class="tr-old">${old.tradein()}</div></div>`;
  };
  ACT.tradeHelp = () => M.openOverlay(`<div class="dlg rl-dlg"><h2>TRADE IN</h2><p>Trade 5 items of the same quality for 1 random item of the next quality up. Equipped items can't be traded.</p><div class="row end">${btn('OK', 'closeOv', '', 'hot')}</div></div>`);
  ACT.buyCredits = () => M.openOverlay(`<div class="dlg rl-dlg"><h2>CREDITS</h2><p>You have <b>${S.p.credits}</b> credits. In this remake credits come from the Rocket Pass; there's nothing to buy with real money.</p><div class="row end">${btn('ROCKET PASS', 'ovGo', 'pass')}${btn('OK', 'closeOv', '', 'hot')}</div></div>`);
  ACT.ovGo = (s) => { M.closeOverlay(); ACT.go(s); };

  // ---------- ITEM SHOP (laid out like the real one) ----------
  // Tabs across the top (FEATURED SHOP, this week's car bundles, SHOWSTOPPERS, BUNDLES) with credits top right;
  // the picked item's name big top left; the car on the showroom turntable wearing it; the page's item cards on the
  // right; the price and PURCHASE bottom left. VIEW BUNDLE puts the whole bundle on the car.
  M.shopPage = 'featured'; M.shopSel = 0; M.shopWhole = false;
  const catOf = (id) => (BL.CATEGORIES.find((c) => c.id === id) || {}).name || id;
  const kindOf = (d) => (d.cat === 'decal' && d.react ? 'REACTIVE DECAL' : d.cat === 'decal' && d.animated ? 'ANIMATED DECAL' : catOf(d.cat).toUpperCase());
  const CAR_PARTS = ['body', 'decal', 'finish', 'wheels', 'wheeldecal', 'topper', 'antenna', 'boost'];
  const shopPage = () => { const pages = S.shopPages(); return pages.find((x) => x.id === M.shopPage) || pages[0]; };
  // long tab names go over two lines, like the real tabs
  const tabLabel = (s) => {
    if (s.length <= 11 || s.indexOf(' ') < 0) return esc(s);
    let at = -1;
    for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (at < 0 || Math.abs(i - s.length / 2) < Math.abs(at - s.length / 2))) at = i;
    return esc(s.slice(0, at)) + '<br>' + esc(s.slice(at + 1));
  };
  const leaves = (t) => { const ms = Math.max(0, t - Date.now()), d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000); return d ? d + 'D ' + h + 'H' : h + 'H ' + m + 'M'; };
  const cost = (n) => `<span class="sh-cost"><span><i class="cr"></i>${fmt(n)}</span></span>`;
  const shopCard = (o, i, on, priced) => {
    const d = S.itemDef(o.id), r = R(d.rarity), own = S.offerOwned(o), pn = o.paint ? BL.PAINT_BY_ID[o.paint].name : '';
    return `<button class="sh-card ${on ? 'on' : ''} ${own ? 'own' : ''}" style="--rc:${r.color}" data-act="shopSel" data-arg="${i}">
      <span class="sh-cat">${esc(kindOf(d))}</span><span class="sh-name">${esc(d.name)}${pn ? '<br>' + esc(pn) : ''}</span>
      <span class="sh-img">${itemCard(d, { paint: o.paint, cert: o.cert })}</span>
      ${priced ? `<span class="sh-price">${own ? 'OWNED' : '<i class="cr"></i>' + fmt(o.price)}</span>` : ''}${own ? `<span class="sh-own">${BL.ICON('check', 12)}</span>` : ''}</button>`;
  };
  SCREENS.shop = () => {
    const pages = S.shopPages(), pg = shopPage(), p = S.p;
    M.shopPage = pg.id;
    const top = `<div class="sh-tabs">${pages.map((x) => `<button class="sh-tab ${x.id === pg.id ? 'on' : ''}" data-act="shopTab" data-arg="${x.id}"><span>${tabLabel(x.name)}</span></button>`).join('')}</div>
      <button class="sh-credits" data-act="buyCredits"><span><i class="cr"></i>${fmt(p.credits)}</span></button>`;
    if (pg.kind === 'bundles') {
      const list = pages.filter((x) => x.kind === 'bundle'), sb = list[M.shopSel] || list[0];
      const tiles = list.map((b, i) => {
        const deal = S.bundleDeal(b), hero = S.itemDef(b.car || b.offers[0].id);
        return `<button class="sh-card sh-bcard ${i === M.shopSel ? 'on' : ''}" style="--rc:${R(hero.rarity).color}" data-act="shopSel" data-arg="${i}">
          <span class="sh-cat">BUNDLE</span><span class="sh-name">${esc(b.title)}</span>
          <span class="sh-img">${itemCard(hero, {})}</span>
          <span class="sh-price">${deal.left.length ? b.offers.length + ' ITEMS &nbsp;<i class="cr"></i>' + fmt(deal.price) : 'ALL OWNED'}</span></button>`;
      }).join('');
      return `<div class="rl-shop">${top}
        <div class="sh-big"><b>${esc(sb.title)}</b><em>BUNDLE</em></div>
        <div class="sh-left">NEW BUNDLES IN ${leaves(pg.ends)}</div>
        <div class="sh-deal"><b>BUNDLES</b><em>THIS WEEK</em><div class="sh-line">${list.length} bundles, each 55% off</div>
          <button class="sh-purchase" data-act="shopTab" data-arg="${sb.id}">VIEW BUNDLE</button></div>
        <div class="sh-grid sh-wide">${tiles}</div>
        <div class="sh-note">Items you already own don't count toward a bundle's price.</div></div>`;
    }
    const offers = pg.offers, sel = offers[M.shopSel] || offers[0], d = S.itemDef(sel.id), rar = R(d.rarity);
    const pn = sel.paint ? BL.PAINT_BY_ID[sel.paint].name : '';
    const cards = offers.map((o, i) => shopCard(o, i, i === M.shopSel, pg.kind === 'featured')).join('');
    let deal;
    if (pg.kind === 'featured') {
      const own = S.offerOwned(sel);
      deal = `<div class="sh-deal"><b>${esc(d.name.toUpperCase())}</b><em>${esc(rar.name.toUpperCase())}</em>
        <div class="sh-line">${own ? 'You already own this item' : 'The price for this item is: ' + cost(sel.price)}</div>
        ${own ? '<span class="sh-purchase off">OWNED</span>' : `<button class="sh-purchase" data-act="shopBuy" data-arg="${M.shopSel}">PURCHASE ITEM</button>`}</div>`;
    } else {
      const b = S.bundleDeal(pg), n = b.left.length;
      deal = `<div class="sh-deal"><b>${esc(pg.title)}</b><em>BUNDLE</em>
        <div class="sh-line">${n ? `The price for ${n} Item${n > 1 ? 's' : ''} is: ${cost(b.price)}` : 'You own everything in this bundle'}</div>
        ${n ? '<button class="sh-purchase" data-act="shopBundle">PURCHASE BUNDLE</button>' : '<span class="sh-purchase off">OWNED</span>'}</div>`;
    }
    return `<div class="rl-shop">${top}
      <div class="sh-big"><b>${esc(d.name.toUpperCase())}${pn ? ': ' + esc(pn.toUpperCase()) : ''}</b><em>${esc(rar.name.toUpperCase())} ${esc(kindOf(d))}</em></div>
      <div class="sh-left">LEAVES IN ${leaves(pg.ends)}</div>
      ${deal}
      <div class="sh-grid">${cards}</div>
      <div class="sh-note">${pg.kind === 'featured' ? 'Credits come from the Rocket Pass.' : "Items you already own don't count toward the bundle price."}</div></div>`;
  };
  AFTER.shop = () => {
    // on the turntable: the page's car wearing the picked item (VIEW BUNDLE: the whole bundle)
    const pg = shopPage(), lo = S.resolveLoadout();
    const wear = (o) => { const d = S.itemDef(o.id); if (CAR_PARTS.indexOf(d.cat) >= 0) lo[d.cat] = { id: d.id, paint: o.paint, cert: o.cert }; };
    let sel = null;
    if (pg.kind === 'bundles') {
      const b = S.shopPages().filter((x) => x.kind === 'bundle')[M.shopSel];
      if (b) { if (b.car) lo.body = { id: b.car, paint: null, cert: null }; b.offers.forEach(wear); }
    } else {
      sel = pg.offers[M.shopSel] || pg.offers[0];
      if (pg.car) lo.body = { id: pg.car, paint: null, cert: null };
      if (pg.kind === 'bundle' && M.shopWhole) pg.offers.forEach(wear); else if (sel) wear(sel);
    }
    BL.Garage.refresh(lo);
    const sd = sel && S.itemDef(sel.id);
    BL.Garage.setBoostPreview(!!(sd && sd.cat === 'boost' && !M.shopWhole));
  };
  ACT.shopSel = (i) => {
    M.shopSel = +i; M.render();
    const pg = shopPage();
    if (pg.kind === 'bundles') return;
    const o = pg.offers[+i], d = o && S.itemDef(o.id);
    if (d && d.cat === 'explosion') BL.Garage.previewExplosion(d.fx, o.paint);
    if (d && d.cat === 'anthem' && BL.Anthems) BL.Anthems.preview(d);
  };
  ACT.shopTab = (t) => { if (M.shopPage !== t) { M.shopPage = t; M.shopSel = 0; M.shopWhole = false; } M.render(); };
  ACT.shopWhole = () => { M.shopWhole = !M.shopWhole; M.render(); };
  ACT.shopBuy = (i) => {
    const o = shopPage().offers[+i];
    if (!o || S.offerOwned(o)) return;
    if (S.p.credits < o.price) { M.toast('Not enough credits'); return; }
    M.confirm(`Buy <b>${esc(S.itemDef(o.id).name)}</b> for ${fmt(o.price)} credits?`, () => {
      const e = S.buy(o);
      if (e) { S.save(); M.revealItem(e, { title: 'PURCHASED', instant: true, next: () => M.show('shop') }); }
    }, 'BUY');
  };
  ACT.shopBundle = () => {
    const pg = shopPage(), b = S.bundleDeal(pg);
    if (!b.left.length) return;
    if (S.p.credits < b.price) { M.toast('Not enough credits'); return; }
    M.confirm(`Buy <b>${esc(pg.title)}</b> (${b.left.length} items) for ${fmt(b.price)} credits?`, () => {
      const got = S.buyBundle(pg);
      if (got) { M.toast('Bundle purchased: ' + got.length + ' items'); M.render(); }
    }, 'BUY');
  };

  // ---------- PROFILE ----------
  SCREENS.profile = () => {
    const sub = M.profSub || 'career';
    const item = (label, act, arg, on) => `<button class="rl-li ${on ? 'on' : ''}" data-act="${act}" data-arg="${arg || ''}"><span>${label}</span></button>`;
    return `<div class="rl-prof"><div class="rl-list">
        ${item('CAREER', 'profSub', 'career', sub === 'career')}
        ${item('MATCH HISTORY', 'go', 'history')}
        ${item('CHOOSE PLAYER ANTHEM', 'profAnthem')}
        ${item('CHOOSE BANNER', 'go', 'banners')}
        ${item('CHOOSE AVATAR BORDER', 'go', 'borders')}
      </div>
      ${sub === 'career' ? `<div class="rl-list sub">${item('STATS', 'go', 'career')}${item('LEADERBOARDS', 'go', 'leaderboards')}${item('LEAGUE RANKINGS', 'go', 'ranks')}</div>` : ''}
      <div class="pr-note">View your stats or player leaderboards.</div></div>`;
  };
  ACT.profSub = (s) => { M.profSub = M.profSub === s ? null : s; M.render(); };
  ACT.profAnthem = () => { M.gcat = 'anthem'; ACT.go('customize'); };
  SCREENS.career = () => `<div class="rl-wrap-old">${old.profile()}</div>`;
  SCREENS.history = () => {
    const h = ext().history;
    return `<div class="rl-panel"><h2>MATCH HISTORY <small>Last ${h.length} matches</small></h2>${h.length ? `<table class="rl-table"><tr><th>DATE</th><th>PLAYLIST</th><th>ARENA</th><th>RESULT</th><th>SCORE</th><th>GOALS</th><th>ASSISTS</th><th>SAVES</th><th>SHOTS</th><th>PTS</th></tr>
      ${h.map((m) => `<tr class="${m.won ? 'win' : m.draw ? '' : 'loss'}"><td>${new Date(m.t).toLocaleDateString()} ${new Date(m.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td><td>${esc(m.pl)}${m.ranked ? ' <small>RANKED</small>' : ''}</td><td>${esc(m.map)}</td><td>${m.draw ? 'DRAW' : m.won ? 'WIN' : 'LOSS'}</td><td>${m.sc[0]} - ${m.sc[1]}</td><td>${m.s.goals}</td><td>${m.s.assists}</td><td>${m.s.saves}</td><td>${m.s.shots}</td><td>${m.s.score}</td></tr>`).join('')}</table>` : '<p class="muted">Play a match and it shows up here.</p>'}</div>`;
  };
  M.lbPl = 'doubles';
  SCREENS.leaderboards = () => {
    const pl = M.lbPl, mine = S.p.mmr[pl] || 0, rnd = U.rng(U.hash('lb' + pl + U.dayKey()));
    const rows = [];
    let mmr = 2300 + rnd() * 120;
    for (let i = 0; i < 50; i++) { rows.push({ name: BL.ONLINE_BOT_NAMES[Math.floor(rnd() * BL.ONLINE_BOT_NAMES.length)] + (i % 3 ? '' : Math.floor(rnd() * 99)), mmr: Math.round(mmr) }); mmr -= 4 + rnd() * 9; }
    const place = mine >= rows[rows.length - 1].mmr ? null : Math.round(100 + Math.pow(Math.max(0, 1900 - mine) / 1900, 2.2) * 2500000);
    if (!place) rows.push({ name: S.p.name, mmr: Math.round(mine), me: true });
    rows.sort((a, b) => b.mmr - a.mmr);
    return `<div class="rl-panel"><h2>LEADERBOARDS</h2>${seg('lbPl', PL_RK.map((d) => [d.id, d.name]), pl)}
      <table class="rl-table lb"><tr><th>#</th><th>PLAYER</th><th>RANK</th><th>MMR</th></tr>${rows.slice(0, 50).map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${rankIcon(r.mmr, 'xs')}</td><td>${r.mmr}</td></tr>`).join('')}
      ${place ? `<tr class="me"><td>${fmt(place)}</td><td>${esc(S.p.name)}</td><td>${rankIcon(mine, 'xs')}</td><td>${Math.round(mine)}</td></tr>` : ''}</table></div>`;
  };
  ACT.lbPl = (v) => { M.lbPl = v; M.render(); };
  SCREENS.ranks = () => {
    const p = S.p;
    return `${compHead()}<div class="rl-ranks">${PL_RK.map((d) => { const mmr = p.mmr[d.id] || 0, r = S.rankInfo(mmr), g = (p.rankedGames || {})[d.id] || 0;
      return `<div class="rk-card">${rankIcon(mmr, 'big')}<b>${esc(d.name.toUpperCase())}</b><span style="color:${r.color}">${g < 10 ? 'UNRANKED' : esc(r.full.toUpperCase())}</span><small>${g < 10 ? 'Placement ' + g + '/10' : Math.round(mmr) + ' MMR'} • ${g} played</small></div>`; }).join('')}</div>`;
  };
  // the Player Identity pickers, like the real game: a blue panel of tiles (what you have first), the card of the
  // item you're on beside it, and the two CHOOSE buttons under it
  const ICON_BANNER = '<svg viewBox="0 0 24 24"><path d="M5 3h13l-3 5 3 5H7v8H5z" fill="currentColor"/></svg>';
  const ICON_BORDER = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>';
  const ICON_NOTRADE = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12L12 4" stroke="currentColor" stroke-width="2"/></svg>';
  function idCard(b, kind) {
    const cur = kind === 'banner' ? S.p.banner : S.p.border;
    return `<b>${esc(b.name)}</b><span>${b.rar || 'Luxury'} ${kind === 'banner' ? 'Player Banner' : 'Avatar Border'}</span><small>${lockedPick(b) ? BL.ICON('lock', 13) + ' ' + esc(unlockText(b)) : b.id === cur ? BL.ICON('check', 13) + ' EQUIPPED' : ICON_NOTRADE + ' CANNOT BE TRADED IN'}</small>`;
  }
  function identity(kind) {
    const list = kind === 'banner' ? BANNERS : BORDERS, cur = kind === 'banner' ? ext().banner : ext().border;
    const have = list.filter((b) => !lockedPick(b)), sel = list.find((b) => b.id === cur) || list[0];
    M.idKind = kind;
    const tile = (b) => {
      const locked = lockedPick(b), on = b.id === cur;
      return `<button class="id-tile ${on ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="${kind === 'banner' ? 'setBanner' : 'setBorder'}" data-arg="${b.id}" data-tip="${b.id}">${kind === 'banner' ? `<i class="id-bn ${b.anim ? 'anim-' + b.anim : ''}" style="background:${b.css}"></i>` : avatar(b, 'id-av')}${on ? `<i class="id-check">${BL.ICON('check', 26)}</i>` : ''}${locked ? `<i class="id-lock">${BL.ICON('lock', 13)} ${esc(unlockText(b))}</i>` : ''}<b>${esc(b.name)}</b></button>`;
    };
    return `<div class="id-scr">
      <div class="id-panel"><div class="id-head"><h1>${kind === 'banner' ? 'PLAYER BANNER' : 'AVATAR BORDER'}</h1><div class="id-cnt"><b>${have.length}</b><small>COLLECTED</small></div></div>
        <div class="id-grid">${have.concat(list.filter((b) => lockedPick(b))).map(tile).join('')}</div></div>
      <div class="id-card">${idCard(sel, kind)}</div>
      <div class="id-menu">
        <button class="id-mi ${kind === 'banner' ? 'on' : ''}" data-act="idGo" data-arg="banners"><span>CHOOSE BANNER</span><i>${ICON_BANNER}</i></button>
        <button class="id-mi ${kind === 'border' ? 'on' : ''}" data-act="idGo" data-arg="borders"><span>CHOOSE AVATAR BORDER</span><i>${ICON_BORDER}</i></button>
      </div></div>`;
  }
  SCREENS.banners = () => identity('banner');
  SCREENS.borders = () => identity('border');
  // between the two pickers without stacking up BACK presses
  ACT.idGo = (name) => { if (M.screen !== name) M.show(name); };
  // the card follows the tile you point at (or move onto with a controller)
  const idHover = (e) => {
    const t = e.target && e.target.closest ? e.target.closest('.id-tile') : null, card = t && document.querySelector('.id-card');
    if (!card) return;
    const b = (M.idKind === 'banner' ? BANNERS : BORDERS).find((x) => x.id === t.dataset.tip);
    if (b) card.innerHTML = idCard(b, M.idKind);
  };
  document.addEventListener('mouseover', idHover);
  document.addEventListener('focusin', idHover);
  ACT.setBanner = (id) => { const b = BANNERS.find((x) => x.id === id); if (lockedPick(b)) { M.toast('Unlocks at level ' + b.lvl); return; } S.p.banner = id; S.save(); M.render(); };
  ACT.setBorder = (id) => { const b = BORDERS.find((x) => x.id === id); if (lockedPick(b)) { M.toast(b.rank != null ? unlockText(b) + ' in Competitive to unlock this border' : 'Unlocks at level ' + b.lvl); return; } S.p.border = id; S.save(); M.render(); };

  // ---------- CLUB ----------
  const CLUB_TIERS = [10, 50, 150, 400, 1000, 2500];
  const CLUB_COLORS = ['#2f7bff', '#ff8a1f', '#33d17a', '#e5484d', '#b05cff', '#ffd23f', '#f5f5f5', '#1a1a1a'];
  M.clubForm = { name: '', tag: '', c1: 0, c2: 6 };
  SCREENS.club = () => {
    const c = S.p.club, f = M.clubForm;
    if (!c) {
      return `<div class="rl-panel narrow"><h2>CLUBS</h2><p class="muted">Clubs put your tag on your name, keep a roster and earn milestone medals together.</p>
        <h3>CREATE CLUB</h3><div class="form"><label>Club name</label><input id="clName" maxlength="20" value="${esc(f.name)}" placeholder="Club name">
        <label>Tag (2-4)</label><input id="clTag" maxlength="4" value="${esc(f.tag)}" placeholder="TAG" style="text-transform:uppercase">
        <label>Primary</label><div class="swatches">${CLUB_COLORS.map((col, i) => `<div class="sw ${f.c1 === i ? 'on' : ''}" style="background:${col}" data-act="clC1" data-arg="${i}"></div>`).join('')}</div>
        <label>Accent</label><div class="swatches">${CLUB_COLORS.map((col, i) => `<div class="sw ${f.c2 === i ? 'on' : ''}" style="background:${col}" data-act="clC2" data-arg="${i}"></div>`).join('')}</div></div>
        <div class="row end">${btn('CREATE CLUB', 'clCreate', '', 'hot')}</div>
        <h3>JOIN A CLUB</h3><p class="muted small">Clubs are joined by invite: a friend who owns a club can invite you from the friends panel, and the invite shows up in your notifications.</p></div>`;
    }
    const lvl = (n) => { let t = 0; while (t < CLUB_TIERS.length && n >= CLUB_TIERS[t]) t++; return t; };
    const medal = (k, label, ic) => { const n = c.stats[k] || 0, t = lvl(n), nx = CLUB_TIERS[Math.min(t, CLUB_TIERS.length - 1)];
      return `<div class="cl-medal"><h4>${label}</h4><i class="cl-m t${t}" style="--c1:${CLUB_COLORS[c.c1]}">${BL.ICON(ic, 54)}</i><small>TIER ${t}</small><div class="nw-bar"><i style="width:${Math.min(100, (n / nx) * 100)}%"></i></div><small>Next Tier: ${n}/${nx}</small></div>`; };
    const wins = c.stats.wins || 0, tier = ['ROOKIE', 'PROSPECT', 'CONTENDER', 'CHALLENGER', 'ELITE', 'LEGEND'][Math.min(5, Math.floor(wins / 15))];
    return `<div class="rl-club" style="--c1:${CLUB_COLORS[c.c1]};--c2:${CLUB_COLORS[c.c2]}">
      <div class="cl-head"><b class="cl-tag">${esc(c.tag)}</b><div><b class="cl-name">${esc(c.name)}</b><small>S${BL.PASS.season} ${tier} CLUB</small></div></div>
      <div class="cl-cols"><div class="rl-list"><div class="cl-role">${BL.ICON('person', 14)} ${c.owner ? 'Owner' : 'Member'}</div>
        <button class="rl-li" data-act="clRoster"><span>SHOW ROSTER</span></button>
        <button class="rl-li" data-act="clScrim" data-arg="create"><span>CREATE CLUB SCRIMMAGE</span></button>
        <button class="rl-li" data-act="clScrim" data-arg="join"><span>JOIN CLUB SCRIMMAGE</span></button>
        ${c.owner ? '<button class="rl-li" data-act="clCustom"><span>CLUB CUSTOMIZATION</span></button>' : ''}
        <button class="rl-li" data-act="clStats"><span>STATS</span></button>
        <button class="rl-li" data-act="clLeave"><span>LEAVE CLUB</span></button></div>
        <div class="cl-medals">${medal('goals', 'GOALS', 'goal')}${medal('saves', 'SAVES', 'save')}${medal('assists', 'ASSISTS', 'assist')}</div></div>
      <p class="cl-note">Play matches with club members (or any match) to earn seasonal Milestone Medals. Club scrimmages pit your roster against another club.</p></div>`;
  };
  ACT.clC1 = (i) => { M.clubForm.c1 = +i; syncClubForm(); M.render(); };
  ACT.clC2 = (i) => { M.clubForm.c2 = +i; syncClubForm(); M.render(); };
  function syncClubForm() { const n = document.getElementById('clName'), t = document.getElementById('clTag'); if (n) M.clubForm.name = n.value; if (t) M.clubForm.tag = t.value; }
  const roster = (tag) => { const rnd = U.rng(U.hash('club' + tag)); return shuffle(BL.ONLINE_BOT_NAMES, rnd).slice(0, 5 + Math.floor(rnd() * 4)); };
  ACT.clCreate = () => {
    syncClubForm();
    const f = M.clubForm, name = f.name.trim(), tag = f.tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (name.length < 3) { M.toast('Club name needs 3+ characters'); return; }
    if (tag.length < 2) { M.toast('Tag needs 2-4 letters or numbers'); return; }
    S.p.club = { name, tag, c1: f.c1, c2: f.c2, owner: true, members: [], stats: { goals: 0, saves: 0, assists: 0, wins: 0 }, created: Date.now() };
    S.save(); M.render(); M.toast('Club created! Invite friends from the friends panel.');
  };
  ACT.clRoster = () => { const c = S.p.club, fr = S.p.friends || []; const st = (n) => { const f = fr.find((x) => x.name === n); return f && BL.Friends && BL.Friends.isOnline(f.code) ? 'ONLINE' : 'OFFLINE'; };
    M.openOverlay(`<div class="dlg rl-dlg"><h2>[${esc(c.tag)}] ROSTER</h2><div class="cl-roster"><div class="fp-mem me">${c.owner ? BL.ICON('crown', 14) + ' ' : ''}${esc(S.p.name)}<small>LV ${S.p.level}</small></div>${c.members.map((m, i) => `<div class="fp-mem">${!c.owner && i === 0 ? BL.ICON('crown', 14) + ' ' : ''}${esc(m)}<small>${st(m)}</small></div>`).join('')}${c.members.length ? '' : '<p class="muted small">No other members yet: invite friends from the friends panel.</p>'}</div><div class="row end">${btn('CLOSE', 'closeOv', '', 'hot')}</div></div>`); };
  ACT.clStats = () => { const c = S.p.club, s = c.stats; M.openOverlay(`<div class="dlg rl-dlg"><h2>CLUB STATS</h2><div class="stats">${[['Wins', s.wins], ['Goals', s.goals], ['Assists', s.assists], ['Saves', s.saves], ['Members', c.members.length + 1]].map((x) => `<div class="stat"><b>${x[1] || 0}</b><small>${x[0]}</small></div>`).join('')}</div><div class="row end">${btn('CLOSE', 'closeOv', '', 'hot')}</div></div>`); };
  ACT.clCustom = () => { const c = S.p.club; M.clubForm = { name: c.name, tag: c.tag, c1: c.c1, c2: c.c2 }; M.openOverlay(`<div class="dlg rl-dlg"><h2>CLUB CUSTOMIZATION</h2><div class="form"><label>Club name</label><input id="clName2" maxlength="20" value="${esc(c.name)}"><label>Primary</label><div class="swatches">${CLUB_COLORS.map((col, i) => `<div class="sw ${c.c1 === i ? 'on' : ''}" style="background:${col}" data-act="clSetC" data-arg="c1:${i}"></div>`).join('')}</div><label>Accent</label><div class="swatches">${CLUB_COLORS.map((col, i) => `<div class="sw ${c.c2 === i ? 'on' : ''}" style="background:${col}" data-act="clSetC" data-arg="c2:${i}"></div>`).join('')}</div></div><div class="row end">${btn('SAVE', 'clSave', '', 'hot')}</div></div>`); };
  ACT.clSetC = (a) => { const [k, v] = a.split(':'); const n = document.getElementById('clName2'); if (n && n.value.trim().length >= 3) S.p.club.name = n.value.trim(); S.p.club[k] = +v; S.save(); ACT.clCustom(); };
  ACT.clSave = () => { const n = document.getElementById('clName2'); if (n && n.value.trim().length >= 3) S.p.club.name = n.value.trim(); S.save(); M.closeOverlay(); M.render(); };
  ACT.clLeave = () => M.confirm('Leave ' + esc(S.p.club.name) + '?', () => { S.p.club = null; S.save(); M.render(); }, 'LEAVE');
  ACT.clScrim = () => {
    // your club against a rival club (bots fill the seats your club members aren't in)
    const c = S.p.club, rival = 'Team ' + U.choice(TEAM_WORDS);
    const mates = c.members.map((m) => '[' + c.tag + '] ' + m), opp = [0, 1, 2].map((i) => '[' + rival.slice(5, 8).toUpperCase() + '] ' + BL.ONLINE_BOT_NAMES[(U.hash(rival + i) >>> 0) % BL.ONLINE_BOT_NAMES.length]);
    const sk = U.clamp(S.botSkillForMMR(bestMMR()), 0.15, 1);
    launch({ mode: 'soccar', size: 3, skill: [sk, sk], names: [mates, opp], ctx: { kind: 'scrim' } });
  };

  // ---------- CHALLENGES (laid out like the real Challenges screen) ----------
  // Weekly: 6 picked per week from this pool; they count playlist / online / tournament matches ("Online Matches").
  // Season: long goals over the whole season. Daily: the 3 from js/save.js.
  const WEEKLY = [
    { id: 'w_shots', name: 'Fifteen Shots', desc: 'Get 15 Shots on Goal in Online Matches', stat: 'shots', goal: 15, xp: 1500 },
    { id: 'w_score', name: 'Three Thousand Club', desc: 'Get 3,000 points in Online Matches', stat: 'score', goal: 3000, xp: 1500 },
    { id: 'w_saves', name: 'Clearly Safe', desc: 'Get 20 Saves in Online Matches', stat: 'saves', goal: 20, xp: 1500 },
    { id: 'w_showoff', name: 'Showoff Goal', desc: 'Score any special goal type: Aerial, Long or Overtime Goals', stat: 'special', goal: 1, xp: 1500 },
    { id: 'w_savewin', name: 'A Save and a Win', desc: 'Get a Save and Win in 3 Online Matches', stat: 'savewin', goal: 3, xp: 1500 },
    { id: 'w_comp', name: 'Competitive Domination', desc: 'Win 10 Online Matches in any Competitive mode', stat: 'rankedWins', goal: 10, xp: 2500 },
    { id: 'w_demo', name: 'Demolition Derby', desc: 'Demolish 10 cars in Online Matches', stat: 'demos', goal: 10, xp: 1500 },
    { id: 'w_assist', name: 'Team Player', desc: 'Get 8 Assists in Online Matches', stat: 'assists', goal: 8, xp: 1500 },
    { id: 'w_goals', name: 'Goal Getter', desc: 'Score 12 Goals in Online Matches', stat: 'goals', goal: 12, xp: 1500 },
    { id: 'w_play', name: 'Marathon', desc: 'Play 10 Online Matches', stat: 'matches', goal: 10, xp: 1500 },
    { id: 'w_heat', name: 'Feel the Heat', desc: 'Win 3 Online Matches of Heatseeker', stat: 'heatWins', goal: 3, xp: 1500 },
    { id: 'w_touch', name: 'Ball Hog', desc: 'Touch the ball 150 times in Online Matches', stat: 'touches', goal: 150, xp: 1500 },
  ];
  const SEASONAL = [
    { id: 's_wins', name: 'Season Winner', desc: 'Win 25 matches this season', stat: 'wins', goal: 25, xp: 3000 },
    { id: 's_goals', name: 'Sharpshooter', desc: 'Score 75 goals this season', stat: 'goals', goal: 75, xp: 3000 },
    { id: 's_saves', name: 'Brick Wall', desc: 'Make 60 saves this season', stat: 'saves', goal: 60, xp: 3000 },
    { id: 's_mvp', name: 'Most Valuable', desc: 'Be MVP 15 times this season', stat: 'mvps', goal: 15, xp: 3000 },
    { id: 's_aerial', name: 'Sky High', desc: 'Score 10 aerial goals this season', stat: 'aerialGoals', goal: 10, xp: 3000 },
    { id: 's_play', name: 'Dedicated', desc: 'Play 60 matches this season', stat: 'matches', goal: 60, xp: 3000 },
  ];
  const WEEK = 7 * 86400000, MONDAY = 4 * 86400000; // weeks start Monday 00:00 (local)
  const weekNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000 - MONDAY) / WEEK);
  function weekly() {
    const p = ext(), wk = weekNo();
    if (!p.weekly || p.weekly.week !== wk) {
      const ids = shuffle(WEEKLY.map((c) => c.id), U.rng(U.hash('wk' + wk))).slice(0, 6);
      p.weekly = { week: wk, list: ids.map((id) => ({ id, progress: 0, done: false })) };
      S.save();
    }
    return p.weekly.list.map((x) => Object.assign({}, WEEKLY.find((c) => c.id === x.id), x)).filter((c) => c.name);
  }
  function seasonal() {
    const p = ext();
    p.seasonCh = p.seasonCh || { claimed: {} };
    return SEASONAL.map((c) => Object.assign({}, c, { progress: Math.min(c.goal, p.stats[c.stat] || 0), done: !!p.seasonCh.claimed[c.id] }));
  }
  // SEASON challenges like the real game: ten weeks, a new set of six unlocks every Monday (earlier weeks stay open),
  // the last two of each week are Premium (Rocket Pass Premium), progress counts in online matches
  const SEASON_START = new Date(2026, 9, 5).getTime(), SEASON_WEEKS = 10;
  const SW_POOL = [
    ['Goal Rush', 'Score {n} Goals in Online Matches', 'goals', [4, 6, 8, 10]], ['Shot Caller', 'Get {n} Shots on Goal in Online Matches', 'shots', [8, 12, 16]],
    ['Last Line', 'Get {n} Saves in Online Matches', 'saves', [5, 8, 12]], ['Playmaker', 'Get {n} Assists in Online Matches', 'assists', [3, 5, 7]],
    ['Wrecking Crew', 'Demolish {n} cars in Online Matches', 'demos', [3, 5, 8]], ['Point Machine', 'Get {n} points in Online Matches', 'score', [1500, 2500, 4000]],
    ['Showtime', 'Score {n} special goals (Aerial, Long or Overtime)', 'special', [1, 2, 3]], ['Clutch', 'Get a Save and Win in {n} Online Matches', 'savewin', [2, 3, 4]],
    ['Ranked Grind', 'Win {n} Competitive Matches', 'rankedWins', [2, 3, 5]], ['Hot Streak', 'Win {n} Online Matches of Heatseeker', 'heatWins', [1, 2, 3]],
    ['Show Up', 'Play {n} Online Matches', 'matches', [4, 6, 8]], ['Touchy', 'Touch the ball {n} times in Online Matches', 'touches', [60, 90, 120]],
  ];
  const seasonWeek = () => U.clamp(Math.floor((Date.now() - SEASON_START) / WEEK) + 1, 1, SEASON_WEEKS);
  function seasonSet(w) {
    const rnd = U.rng(U.hash('sw' + BL.PASS.season + ':' + w)), pool = shuffle(SW_POOL.slice(), rnd).slice(0, 6);
    return pool.map((t, i) => { const goal = t[3][Math.min(t[3].length - 1, Math.floor(w / 3))]; return { id: 'sw' + w + '_' + i, name: t[0], desc: t[1].replace('{n}', fmt(goal)), stat: t[2], goal, xp: i >= 4 ? 3500 : 2000 + w * 100, premium: i >= 4 }; });
  }
  function seasonWeeks() {
    const p = ext(); p.seasonW = p.seasonW || { season: BL.PASS.season, prog: {} };
    if (p.seasonW.season !== BL.PASS.season) p.seasonW = { season: BL.PASS.season, prog: {} };
    const cur = seasonWeek(), out = [];
    for (let w = 1; w <= SEASON_WEEKS; w++) {
      const list = seasonSet(w).map((c) => { const x = p.seasonW.prog[c.id] || {}; return Object.assign(c, { progress: x.progress || 0, done: !!x.done }); });
      out.push({ w, open: w <= cur, unlock: SEASON_START + (w - 1) * WEEK, list });
    }
    return out;
  }
  function leftText(ms) { const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000); return (d ? d + ' Days ' : '') + h + ' Hours left'; }
  const xpBadge = (xp) => `<i class="ch-xp"><b>${xp >= 1000 ? Math.round(xp / 100) / 10 + 'K' : xp}</b>XP</i>`;
  M.chTab = 'weekly';
  SCREENS.challenges = () => {
    const tab = M.chTab === 'daily' ? 'event' : M.chTab;
    const nextWeek = (weekNo() + 1) * WEEK + MONDAY + new Date().getTimezoneOffset() * 60000;
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    const tabs = [['weekly', 'WEEKLY'], ['season', 'SEASON'], ['event', 'SEASON ' + BL.PASS.season + '<br>KICKOFF', 'two'], ['pass', 'ROCKET<br>PASS', 'two']];
    const tabBar = `<div class="c2-tabs tabs">${tabs.map((t) => `<button class="c2-tab ${t[2] || ''} ${tab === t[0] ? 'on' : ''}" data-act="${t[0] === 'pass' ? 'go' : 'chTab'}" data-arg="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    const card = (c, locked) => `<div class="c2-card ${c.done ? 'done' : ''} ${locked ? 'locked' : ''} ${c.premium ? 'prem' : ''}">${c.premium ? `<i class="c2-premtag">${BL.ICON('star', 11)} PREMIUM</i>` : ''}<b>${esc(c.name)}</b><p>${esc(c.desc)}</p>
        <div class="c2-bar"><i style="width:${Math.round((c.progress / c.goal) * 100)}%"></i><span>${c.done ? BL.ICON('check', 12) : fmt(c.progress) + '/' + fmt(c.goal)}</span></div>
        <div class="c2-rw">REWARD: ${xpBadge(c.xp)}</div>${locked ? `<div class="c2-lock">${BL.ICON('lock', 26)}<small>${esc(locked)}</small></div>` : ''}</div>`;
    if (tab === 'season') {
      const weeks = seasonWeeks(), sel = U.clamp(M.chWeek || seasonWeek(), 1, SEASON_WEEKS), wk = weeks[sel - 1];
      const all = weeks.reduce((n, w) => n + w.list.length, 0), doneAll = weeks.reduce((n, w) => n + w.list.filter((c) => c.done).length, 0);
      const seasonEnd = SEASON_START + SEASON_WEEKS * WEEK;
      const prem = S.p.pass.premium;
      return `<div class="rl-chal2 c2-season">${tabBar}
        <div class="c2-head"><b>SEASON CHALLENGES</b><small>${BL.ICON('timer', 16)} ${esc(leftText(Math.max(0, seasonEnd - Date.now())))}</small></div>
        <div class="c2-sw">
          <div class="c2-weeks">${weeks.map((w) => `<button class="c2-wk ${w.w === sel ? 'on' : ''} ${w.open ? '' : 'shut'}" data-act="chWeek" data-arg="${w.w}"><b>WEEK ${w.w}</b><small>${w.open ? w.list.filter((c) => c.done).length + ' / ' + w.list.length : BL.ICON('lock', 11) + ' ' + new Date(w.unlock).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></button>`).join('')}</div>
          <div class="c2-wbody">
            <div class="c2-cards c3">${wk.list.map((c) => card(c, !wk.open ? 'Unlocks ' + new Date(wk.unlock).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : c.premium && !prem ? 'Premium Rocket Pass' : '')).join('')}</div>
            <div class="c2-sprog"><span>SEASON PROGRESS</span><div class="pv-bar"><i style="width:${Math.round((doneAll / all) * 100)}%"></i></div><b>${doneAll} / ${all}</b>${prem ? '' : btn('UNLOCK PREMIUM', 'go', 'pass', 'gold')}</div>
          </div>
        </div></div>`;
    }
    const list = tab === 'weekly' ? weekly() : S.challenges().map((c) => Object.assign({ name: c.desc }, c));
    const title = tab === 'weekly' ? 'WEEKLY CHALLENGES' : 'SEASON ' + BL.PASS.season + ' KICKOFF';
    const left = tab === 'weekly' ? leftText(nextWeek - Date.now()) : leftText(midnight - Date.now());
    const done = list.filter((c) => c.done).length;
    return `<div class="rl-chal2">${tabBar}
      <div class="c2-head"><b>${title}</b><small>${BL.ICON('timer', 16)} ${esc(left)}</small></div>
      <div class="c2-cards">${list.map((c) => card(c, '')).join('')}</div>
      <div class="c2-event">
        <div class="c2-art"><img src="${TILE('competitive')}" alt="" draggable="false"></div>
        <div class="c2-txt"><b>SEASON ${BL.PASS.season} KICKOFF</b><small>${BL.ICON('timer', 16)} ${esc(leftText(nextWeek - Date.now()))}</small>
          <p>Season ${BL.PASS.season} is here! Climb the Rocket Pass, finish Weekly and Season challenges for Pass XP, and earn new cars, decals and goal explosions along the way.</p>
          <div class="c2-done">${done === list.length ? BL.ICON('check', 14) + ' COMPLETED' : done + ' / ' + list.length + ' COMPLETE'}</div></div>
        ${btn(tab === 'weekly' ? 'VIEW CHALLENGES' : 'VIEW ROCKET PASS', tab === 'weekly' ? 'chTab' : 'go', tab === 'weekly' ? 'season' : 'pass', 'c2-view')}
      </div></div>`;
  };
  ACT.chWeek = (w) => { M.chWeek = +w; M.render(); };
  ACT.chTab = (t) => { M.chTab = t; M.render(); };
  // after each match: weekly progress (playlist / online / tournament matches) and season goals, paid out in Pass XP
  function challengeResult(game, r, won, local) {
    const p = ext(), online = !!(game.online || game.cfg.disguised);
    const st = local.stats, got = [];
    if (online) {
      weekly();
      const add = { shots: st.shots, score: st.score, saves: st.saves, demos: st.demos, assists: st.assists, goals: st.goals, touches: st.touches, matches: 1,
        special: (st.aerialGoals || 0) + (st.longGoals || 0) + (game.overtime && won ? 1 : 0), savewin: st.saves > 0 && won ? 1 : 0,
        rankedWins: r.ranked && won ? 1 : 0, heatWins: game.mode === 'heatseeker' && won ? 1 : 0 };
      for (const x of p.weekly.list) {
        const def = WEEKLY.find((c) => c.id === x.id);
        if (!def || x.done) continue;
        x.progress = Math.min(def.goal, x.progress + (add[def.stat] || 0));
        if (x.progress >= def.goal) { x.done = true; got.push(def); }
      }
    }
    // season weeks: every open week's challenges count (Premium ones need the Premium Rocket Pass)
    if (online) {
      const add = { shots: st.shots, score: st.score, saves: st.saves, demos: st.demos, assists: st.assists, goals: st.goals, touches: st.touches, matches: 1,
        special: (st.aerialGoals || 0) + (st.longGoals || 0) + (game.overtime && won ? 1 : 0), savewin: st.saves > 0 && won ? 1 : 0, rankedWins: r.ranked && won ? 1 : 0, heatWins: game.mode === 'heatseeker' && won ? 1 : 0 };
      for (const wk of seasonWeeks()) {
        if (!wk.open) continue;
        for (const c of wk.list) {
          if (c.done || (c.premium && !S.p.pass.premium)) continue;
          const x = p.seasonW.prog[c.id] = p.seasonW.prog[c.id] || { progress: 0 };
          x.progress = Math.min(c.goal, x.progress + (add[c.stat] || 0));
          if (x.progress >= c.goal) { x.done = true; got.push(c); }
        }
      }
    }
    // season goals read the career stats, which the results screen adds to right after this
    p.seasonCh = p.seasonCh || { claimed: {} };
    const after = Object.assign({}, p.stats);
    for (const k of ['goals', 'saves', 'aerialGoals']) after[k] = (after[k] || 0) + (st[k] || 0);
    after.matches = (after.matches || 0) + 1; after.wins = (after.wins || 0) + (won ? 1 : 0); after.mvps = (after.mvps || 0) + (r.mvp === local.id ? 1 : 0);
    for (const c of SEASONAL) if (!p.seasonCh.claimed[c.id] && (after[c.stat] || 0) >= c.goal) { p.seasonCh.claimed[c.id] = 1; got.push(c); }
    for (const c of got) S.addPassXP(c.xp);
    if (got.length) setTimeout(() => M.toast('Challenge complete: ' + got.map((c) => c.name).join(', ') + ' (+' + got.reduce((a, c) => a + c.xp, 0) + ' Pass XP)'), 600);
    S.save();
  }

  // ---------- SETTINGS (tabs in a dialog like the real one) ----------
  M.setTab = 'video';
  SCREENS.settings = () => {
    const s = S.p.settings, pct = (v) => Math.round(v * 100) + '%';
    const row = (label, ctl) => `<div class="st-row"><label>${label}</label><div>${ctl}</div></div>`;
    const rng = (key, min, max, step, label, f) => row(`${label} <span class="val" id="v_${key}">${f ? f(s[key]) : s[key]}</span>`, `<input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-range="${key}">`);
    const tog = (key, label) => row(label, seg('setTog', [[key + ':1', 'On'], [key + ':0', 'Off']], key + ':' + (s[key] ? 1 : 0)));
    const tabs = [['video', 'VIDEO'], ['camera', 'CAMERA'], ['controls', 'CONTROLS'], ['audio', 'AUDIO'], ['chat', 'CHAT'], ['interface', 'INTERFACE'], ['account', 'ACCOUNT'], ['updates', 'UPDATES']];
    let body = '';
    if (M.setTab === 'video') body = row('Quality <small>(reloads)</small>', seg('setQuality', [['auto', 'Auto'], ['potato', 'Very Low'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], s.quality)) + rng('resScale', 0.5, 1, 0.05, 'Resolution Scale', pct) + row('VSync <small>(reloads)</small>', seg('setVsync', [['1', 'On'], ['0', 'Off']], s.vsync === false ? '0' : '1')) + tog('showFps', 'Show FPS') + row('Post Effects <small>(Medium / High)</small>', seg('setTog', [['post:1', 'On'], ['post:0', 'Off']], 'post:' + (s.post === false ? 0 : 1))) + `<p class="muted small">Current: ${BL.App.potato ? 'VERY LOW' : BL.App.quality.toUpperCase()} • Old Chromebook: pick Very Low. VSync Off: your controls and the physics also update between frames, for a little less input lag (uses more battery).</p>`;
    else if (M.setTab === 'camera') body = row('Camera', seg('setCamPreset', [['player', 'Player View'], ['cinematic', 'Cinematic']], s.camPreset || 'player')) + rng('fov', 80, 110, 1, 'Field of View') + rng('camDist', 2, 3.6, 0.05, 'Distance') + rng('camHeight', 0.6, 1.8, 0.05, 'Height') + rng('camAngle', 0, 10, 0.5, 'Angle') + rng('camStiff', 0, 1, 0.05, 'Stiffness') + rng('camTrans', 0.5, 2, 0.1, 'Transition Speed') + tog('ballCam', 'Ball Cam by Default') + tog('shake', 'Camera Shake');
    else if (M.setTab === 'controls') body = tog('invertPitch', 'Invert Air Pitch') + row('Touch Controls', seg('setTouch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], s.touch)) + row('Bindings', btn('CONFIGURE CONTROLS', 'go', 'controls', 'hot'));
    else if (M.setTab === 'audio') body = rng('master', 0, 1, 0.05, 'Master Volume', pct) + rng('sfx', 0, 1, 0.05, 'Gameplay', pct) + rng('music', 0, 1, 0.05, 'Music', pct) + rng('engine', 0, 1, 0.05, 'Engine', pct) + soundTest(row);
    else if (M.setTab === 'chat') body = qcTab(row);
    else if (M.setTab === 'account') body = accountTab(row);
    else if (M.setTab === 'updates') body = updatesTab(row);
    else body = nameRow(row) + row('Show Title Screen', seg('setTitle', [['1', 'On'], ['0', 'Off']], s.noTitle ? '0' : '1')) + row('Profile', btn('RESET ALL PROGRESS', 'resetProfile', '', 'danger'));
    return `<div class="rl-set"><div class="st-title">SETTINGS</div><div class="st-tabs tabs">${tabs.map((t) => `<button class="st-tab ${M.setTab === t[0] ? 'on' : ''}" data-act="setTab" data-arg="${t[0]}">${t[1]}</button>`).join('')}</div><div class="st-body">${body}</div></div>`;
  };
  ACT.setTab = (t) => { M.setTab = t; M.render(); };
  // ---------- updates (js/updater.js) ----------
  const UPD = () => BL.Update || { state: 'off' };
  // main menu: after a CHECK FOR UPDATES finds a newer version, a reminder with the button (nothing installs by itself)
  function updatePill() {
    const U = UPD();
    return U.state === 'newer' ? `<div class="rl-update"><b>NEW VERSION ON GITHUB</b><small>${esc(U.when(U.latest))}</small>${btn(U.zipping ? 'DOWNLOADING...' : 'UPDATE ZIP FROM GITHUB', 'updZip', '', 'hot')}</div>` : '';
  }
  // Settings > Updates: your version, and the two buttons. Updates only happen when you press them: UPDATE ZIP FROM
  // GITHUB saves the newest version as a zip in Downloads (js/updater.js builds it) to unzip in place of this folder.
  function updatesTab(row) {
    const U = UPD();
    const st = { idle: 'Not checked (updates never install by themselves)', checking: 'Checking GitHub...', current: 'You have the newest version', offline: 'Couldn’t reach GitHub (offline?)', newer: 'A newer version is on GitHub: ' + U.when(U.latest) }[U.state] || '';
    const ver = U.state === 'off' ? row('Game Version', `<div><b>Project folder copy</b></div><small class="muted">The copy the game is built in, so it already has every change.</small>`)
      : row('Game Version', `<div><b>${esc(U.when(U.build))}</b></div><small class="muted">${U.remote ? 'Running the newest code from GitHub because this folder is older: press UPDATE ZIP FROM GITHUB to keep it on this computer.' : 'Running the version in this folder'}</small>`) +
        row('Status', `<div class="${U.state === 'newer' ? 'hot' : ''}">${esc(st)}</div>`);
    const S0 = U.stored;
    return ver + row('Update', `<div class="row">${btn(U.zipping ? 'DOWNLOADING...' : 'UPDATE ZIP FROM GITHUB', 'updZip', '', 'hot')}${U.state === 'off' ? '' : btn(U.state === 'checking' ? 'CHECKING...' : 'CHECK FOR UPDATES', 'updCheck')}${btn('OPEN ONLINE VERSION', 'updSite')}</div>
      <small class="muted" id="updZipMsg">Downloads the newest version from GitHub (about 180 MB) and keeps it in this browser, without saving a file yet.</small>`) +
      row('Stored Update', S0 ? `<div><b>${esc(U.when(S0.build))} version</b> <span class="muted">(${Math.round(S0.size / 1e6)} MB, kept in this browser)</span></div>
        <div class="row">${btn('DOWNLOAD TO THIS COMPUTER', 'updSave', '', 'hot')}${btn('DELETE', 'updDelete')}</div>
        <small class="muted">Saves it as a zip in your Downloads. Unzip it and play from that folder instead of this one (on a Chromebook: open the zip in Files and copy the RocketLeague-Play folder out). Your progress is kept.</small>`
        : '<div class="muted">Nothing stored yet</div>');
  }
  ACT.updSave = () => {
    if (!BL.Update || !BL.Update.saveStored) return;
    M.toast('Saving the zip...');
    BL.Update.saveStored().then((name) => M.toast(name ? 'Saved ' + name + ' to your Downloads' : 'Nothing stored: press UPDATE ZIP FROM GITHUB first'));
  };
  ACT.updDelete = () => { if (BL.Update && BL.Update.deleteStored) M.confirm('Delete the update stored in this browser?', () => BL.Update.deleteStored().then(() => M.render()), 'DELETE'); };
  ACT.updZip = () => {
    if (!BL.Update || !BL.Update.downloadZip || BL.Update.zipping) return;
    const show = (msg) => { const el = document.getElementById('updZipMsg'); if (el) el.textContent = msg; };
    let last = '';
    BL.Update.downloadZip((msg) => { last = msg; show(msg); }).then((name) => { M.toast(name ? 'Update stored in this browser: DOWNLOAD TO THIS COMPUTER saves it' : last || 'The download didn’t finish'); if (M.screen === 'settings') { M.render(); show(last); } });
    M.render(); show('Starting...');
  };
  ACT.updSite = () => window.open('https://dandan4-max.github.io/rocket-league/', '_blank');
  ACT.updCheck = () => { if (!BL.Update || !BL.Update.check) return; BL.Update.check((st) => M.toast(st === 'newer' ? 'A newer version is on GitHub: press UPDATE ZIP FROM GITHUB' : st === 'current' ? 'You have the newest version' : 'Couldn’t reach GitHub. Check your internet.')); M.render(); };
  BL.bus.on('update', () => { if (!BL.game && (M.screen === 'main' || M.screen === 'settings')) M.render(); });
  // custom quick chats: write your own line for any of the 16 slots (blank = the default line)
  function qcTab(row) {
    const qc = BL.quickChats();
    return `<p class="muted small">In a match press a group (1 - 4 or the D-pad), then the message. Blank boxes use the default line.</p>` +
      BL.QUICKCHAT_GROUPS.map((name, g) => row(`${name} <small>(${g + 1})</small>`, `<div class="qc-edit">${qc[g].map((m, i) => `<label><kbd>${i + 1}</kbd><input maxlength="32" data-qc="${g}:${i}" value="${esc(m)}" placeholder="${esc(BL.QUICKCHAT[g][i])}"></label>`).join('')}</div>`)).join('') +
      row('', btn('SAVE QUICK CHATS', 'qcSave', '', 'hot') + btn('RESET TO DEFAULT', 'qcReset'));
  }
  ACT.qcSave = () => {
    const qc = BL.QUICKCHAT.map(() => ['', '', '', '']);
    document.querySelectorAll('[data-qc]').forEach((el) => {
      const [g, i] = el.dataset.qc.split(':').map(Number), v = el.value.replace(/\s+/g, ' ').trim().slice(0, 32);
      qc[g][i] = v && v !== BL.QUICKCHAT[g][i] ? v : '';
    });
    S.p.settings.qc = qc; S.save(); M.toast('Quick chats saved'); M.render();
  };
  ACT.qcReset = () => { delete S.p.settings.qc; S.save(); M.toast('Quick chats reset'); M.render(); };

  // ---------- ACCOUNT: display name (every 2 weeks), game-server account, backup files ----------
  const AC = () => BL.Account;
  const waitText = (ms) => { const d = Math.ceil(ms / 864e5); return d > 1 ? d + ' days' : Math.max(1, Math.ceil(ms / 36e5)) + ' hours'; };
  function nameRow(row) {
    const w = AC().nameWait();
    return row('Player Name', `<div class="form inl"><input id="nameIn" maxlength="16" value="${esc(S.p.name)}" ${w ? 'disabled' : ''}>${btn('SAVE', 'saveName')}</div><small class="muted">${w ? 'You can change your name again in ' + waitText(w) + '.' : 'You can change your name once every 2 weeks.'}</small>`);
  }
  ACT.saveName = () => {
    const v = ((document.getElementById('nameIn') || {}).value || '').trim();
    if (!v || v === S.p.name) return;
    const w = AC().nameWait();
    if (w) { M.toast('You can change your name again in ' + waitText(w)); return; }
    if (BL.NameFilter.bad(v)) { M.toast('That name isn\'t allowed: no swearing or offensive words'); return; }
    if (!AC().validName(v)) { M.toast('Names are 3-16 letters, numbers, spaces, _ - or .'); return; }
    M.confirm(`Change your name to <b>${esc(v)}</b>? You won't be able to change it again for 2 weeks.`, () => {
      S.p.name = v; S.p.nameChangedAt = Date.now(); S.save();
      if (BL.Net.sendProfile) BL.Net.sendProfile();
      M.render(); M.toast('Name changed to ' + v);
    }, 'CHANGE NAME');
  };
  function accountTab(row) {
    const A = AC(), a = S.p.account, base = A.base(), snap = A.snapshotInfo();
    const ago = (t) => { if (!t) return 'not yet'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
    const acct = a && a.token
      ? row('Account', `<div><b>${esc(a.user)}</b> <small class="muted">• synced ${ago(a.synced)}${A.status ? ' • ' + esc(A.status) : ''}</small></div><div class="form inl">${btn('SYNC NOW', 'acSync', '', 'hot')}${btn('SIGN OUT', 'acOut')}</div>`)
      : row('Account', `<p class="muted small">An account keeps your progress on the game server, so clearing the browser or switching devices doesn't lose it.</p>
          <div class="form inl ac-form"><input id="acUser" maxlength="16" placeholder="Username" autocomplete="username" value="${esc(S.p.name)}"><input id="acPass" type="password" maxlength="64" placeholder="Password" autocomplete="current-password"></div>
          <div class="form inl">${btn('CREATE ACCOUNT', 'acNew', '', 'hot')}${btn('SIGN IN', 'acIn')}</div>`)
        + row('Game Server', `<div class="form inl"><input id="acSrv" placeholder="e.g. http://192.168.1.20:8124" value="${esc(S.p.settings.serverUrl || '')}">${btn('SAVE', 'acSrvSave')}</div><small class="muted">${base ? 'Using ' + esc(base) : 'No server yet: someone runs <code>node server/server.js</code> (see README) and you enter its address here.'}</small>`);
    return nameRow(row) + acct
      + row('Backup File', `<div class="form inl">${btn('SAVE BACKUP FILE', 'acExport', '', 'hot')}${btn('LOAD BACKUP FILE', 'acImport')}<input type="file" id="acFile" accept=".json,application/json" hidden></div><small class="muted">Works offline: keep the file somewhere safe (USB stick, Google Drive) and load it on any device.</small>`)
      + (snap ? row('Browser Snapshot', `<div class="form inl"><small class="muted">Daily copy from ${esc(snap.day)} (level ${snap.level}).</small>${btn('RESTORE', 'acSnap')}</div>`) : '');
  }
  const acCreds = () => [((document.getElementById('acUser') || {}).value || '').trim(), (document.getElementById('acPass') || {}).value || ''];
  const acRun = async (label, fn) => {
    M.openOverlay(`<div class="dlg search"><div class="spinner"></div><h3>${label}</h3></div>`);
    try { await fn(); } catch (e) { M.closeOverlay(); M.toast(e.message || String(e)); return; }
    if (document.querySelector('.dlg.search')) M.closeOverlay();
    M.render();
  };
  ACT.acNew = () => { const [u, p] = acCreds(); acRun('CREATING ACCOUNT...', async () => { await AC().register(u, p); M.toast('Account created: your progress now syncs to ' + u); }); };
  ACT.acIn = () => {
    const [u, p] = acCreds();
    acRun('SIGNING IN...', async () => {
      const r = await AC().login(u, p);
      if (!r.remote) { M.toast('Signed in as ' + u + ': progress synced'); return; }
      const rp = r.remote;
      M.openOverlay(`<div class="dlg rl-dlg"><h2>WHICH PROGRESS?</h2><p>Your account has saved progress: <b>${esc(rp.name)}</b>, level ${rp.level}, ${rp.inventory.length} items.</p><p>This device: <b>${esc(S.p.name)}</b>, level ${S.p.level}, ${S.p.inventory.length} items.</p>
        <div class="row end">${btn('KEEP THIS DEVICE', 'acKeepLocal')}${btn('LOAD ACCOUNT', 'acLoadRemote', '', 'hot')}</div></div>`);
      M._remote = rp;
    });
  };
  ACT.acLoadRemote = () => { if (M._remote) AC().useRemote(M._remote); };
  ACT.acKeepLocal = () => { M._remote = null; M.closeOverlay(); acRun('UPLOADING...', () => AC().sync(true)); };
  ACT.acSync = () => acRun('SYNCING...', async () => { await AC().sync(true); M.toast(AC().status || 'Progress synced'); });
  ACT.acOut = () => M.confirm('Sign out? Your progress stays on this device and on your account.', () => { AC().logout().then(() => M.render()); }, 'SIGN OUT');
  ACT.acSrvSave = () => {
    let v = ((document.getElementById('acSrv') || {}).value || '').trim().replace(/\/+$/, '');
    if (v && !/^(wss?|https?):\/\//.test(v)) v = 'http://' + v;
    S.p.settings.serverUrl = v ? v.replace(/^http(s?):\/\//, 'ws$1://').replace(/(\/ws)?$/, '/ws') : '';
    S.save(); M.render(); M.toast(v ? 'Game server saved' : 'Game server cleared');
  };
  ACT.acExport = () => { AC().exportFile(); M.toast('Backup file saved to your Downloads'); };
  ACT.acImport = () => {
    const f = document.getElementById('acFile'); if (!f) return;
    f.onchange = () => {
      const file = f.files && f.files[0]; if (!file) return;
      AC().readFile(file).then((d) => M.confirm(`Load <b>${esc(d.profile.name)}</b> (level ${d.profile.level}, ${d.profile.inventory.length} items${d.saved ? ', saved ' + esc(d.saved.slice(0, 10)) : ''})? This replaces the progress on this device.`, () => AC().importProfile(d.profile), 'LOAD BACKUP'), (e) => M.toast(e.message));
    };
    f.click();
  };
  ACT.acSnap = () => M.confirm('Restore the daily browser snapshot? Progress since then is lost.', () => AC().restoreSnapshot(), 'RESTORE');
  BL.bus.on('account', () => { if (M.screen === 'settings' && M.setTab === 'account' && !BL.game) { const a = document.activeElement; if (!a || a.tagName !== 'INPUT') M.render(); } });
  // Sound Test: the sound pack's files are only numbered, so you can hear each one and pin the right recording
  function soundTest(row) {
    const A = BL.Audio;
    if (!A.SOUND_TEST) return '';
    const pk = S.p.settings.sfxPick || {};
    return `<h4 class="st-h">SOUND TEST <small>Pick the recording for each sound. Default plays a random variation, like the real game.</small></h4>` +
      A.SOUND_TEST.map(([ev, label]) => row(label, `<div class="st-sfx"><button class="rl-btn" data-act="sfxCycle" data-arg="${ev}:-1">${BL.ICON('prev', 14)}</button><span>${pk[ev] ? esc(A.label(pk[ev])) : 'Default (variations)'}</span><button class="rl-btn" data-act="sfxCycle" data-arg="${ev}:1">${BL.ICON('next', 14)}</button><button class="rl-btn hot" data-act="sfxPlay" data-arg="${ev}">PLAY</button></div>`)).join('') +
      row('', btn('RESET SOUNDS', 'sfxReset', '', 'danger'));
  }
  ACT.sfxCycle = (arg) => {
    const [ev, d] = arg.split(':'), def = BL.Audio.SOUND_TEST.find((x) => x[0] === ev);
    const st = S.p.settings; st.sfxPick = st.sfxPick || {};
    const list = [null].concat(def[2]), i = list.indexOf(st.sfxPick[ev] || null), n = list[(i + Number(d) + list.length) % list.length];
    if (n) st.sfxPick[ev] = n; else delete st.sfxPick[ev];
    S.save(); M.render(); ACT.sfxPlay(ev);
  };
  ACT.sfxPlay = (ev) => {
    const A = BL.Audio, pk = (S.p.settings.sfxPick || {})[ev], pool = A.POOLS[ev] || [];
    A.preview(pk || pool[Math.floor(Math.random() * pool.length)]);
  };
  ACT.sfxReset = () => { S.p.settings.sfxPick = {}; S.save(); M.render(); };
  ACT.setTitle = (v) => { S.p.settings.noTitle = v === '0'; S.save(); M.render(); };
  Object.defineProperty(M, 'titleScreen', { get: () => !(S.p && S.p.settings && S.p.settings.noTitle), configurable: true });

  // ---------- match results: history, club, season reward, season / tournament progress ----------
  M.onMatchResult = function (game, r, won) {
    const p = ext(), local = r.players.find((x) => x.id === r.localId);
    if (!local) return;
    const st = local.stats, map = BL.MAP_BY_ID[game.cfg.mapId];
    const def = game.cfg.playlist && (PL_CAS.concat(PL_RK).find((d) => d.id === game.cfg.playlist));
    const size = Math.max(...[0, 1].map((t) => r.players.filter((x) => x.team === t).length));
    p.history.unshift({ t: Date.now(), pl: def ? def.name : (BL.MODES[game.mode] || BL.MODES.soccar).name + ' ' + size + 'v' + size, ranked: !!r.ranked, map: map ? map.name : '', won, draw: r.winner < 0, sc: [r.score[local.team], r.score[1 - local.team]],
      s: { goals: st.goals || 0, assists: st.assists || 0, saves: st.saves || 0, shots: st.shots || 0, score: st.score || 0 } });
    p.history.length = Math.min(p.history.length, 30);
    if (p.club) { const cs = p.club.stats; cs.goals += st.goals || 0; cs.saves += st.saves || 0; cs.assists += st.assists || 0; if (won) cs.wins++; }
    if (r.ranked && won) {
      const sr = p.seasonReward, tier = S.rankInfo((p.mmr[r.ranked.playlist] || 0)).tier;
      if (sr.tier < BL.RANKS.length - 1 && tier >= sr.tier + 1) {
        sr.wins++;
        if (sr.wins >= 10) { sr.tier++; sr.wins = 0; M.toast('Season Reward Level up: ' + BL.RANKS[sr.tier].name + '!'); }
      }
    }
    challengeResult(game, r, won, local);
    const ctx = game.cfg.ctx;
    M._ctxMsg = ctx && ctx.kind === 'season' ? seasonResult(r, won) : ctx && ctx.kind === 'tour' ? tourResult(r, won) : '';
  };
  M.postExtra = () => M._ctxMsg || '';
  const ctxScreen = (g) => { const c = g && g.cfg && g.cfg.ctx; return c ? ({ season: 'season', tour: 'tournaments', scrim: 'club' })[c.kind] : null; };
  ACT.pmMenu = () => {
    const back = ctxScreen(BL.game);
    M._ctxMsg = '';
    old.pmMenu();
    if (back) { HISTORY.length = 0; HISTORY.push('main', 'play'); M.show(back); }
  };
  ACT.pmRematch = () => {
    const back = ctxScreen(BL.game);
    M._ctxMsg = '';
    if (back) { ACT.pmMenu(); return; }
    if (M.lastCfg && M.lastCfg.again) { const again = M.lastCfg.again; M.postShown = false; M.closeOverlay(); BL.App.endGame(); M.show('main'); again(); return; }
    old.pmRematch();
  };
  ACT.pmLobby = () => {
    const L = BL.Net.lobby;
    if (L && L.public && !L.party) { M.postShown = false; M.closeOverlay(); BL.App.endGame(); BL.Net.leaveP2P(); HISTORY.length = 0; M.show('main'); return; }
    if (!L || !L.party) { old.pmLobby(); return; }
    M.postShown = false; M.closeOverlay(); BL.App.endGame();
    if (BL.Net.role === 'host') BL.Net.matchEnded();
    HISTORY.length = 0; M.show('main');
  };
  // ---------- REWARDS: level-up drops and Rocket Pass tiers wait here until you claim them ----------
  function rewardsDlg(justGot) {
    const lv = S.p.unclaimed || [], pc = S.passClaimable();
    const lvCard = (u) => `<div class="cl-card" style="--rc:${R(u.rarity).color}">${M.dropImg(R(u.rarity).color, 'cl-ico')}<b>${R(u.rarity).name} Drop</b>${u.item && BL.ITEM_BY_ID[u.item] ? `<small>+ ${esc(BL.ITEM_BY_ID[u.item].name)}</small>` : ''}<em>LEVEL ${u.level} REWARD</em>${btn('CLAIM', 'claimLvl', u.id, 'hot')}</div>`;
    const pcCard = (c) => `<div class="cl-card pass">${X.rewardCard(c.reward, { cls: c.track === 'premium' ? 'prem' : 'free' })}<em>ROCKET PASS TIER ${c.tier}${c.track === 'premium' ? ' • PREMIUM' : ''}</em>${btn('CLAIM', 'claimTier', c.tier + ':' + c.track, 'hot')}</div>`;
    const got = justGot ? `<div class="cl-got">${BL.ICON('check', 16)} Claimed: ${justGot}</div>` : '';
    M.openOverlay(`<div class="dlg rl-dlg wide cl-dlg"><h2>REWARDS</h2>${got}
      ${lv.length || pc.length ? `<div class="cl-grid">${lv.map(lvCard).join('')}${pc.map(pcCard).join('')}</div>` : '<p class="muted">Nothing left to claim. Level up and climb Rocket Pass tiers to earn more.</p>'}
      <div class="row end">${lv.length + pc.length > 1 ? btn('CLAIM ALL', 'claimAll', '', 'hot') : ''}${btn('CLOSE', 'closeOv')}</div></div>`);
  }
  const gotText = (g) => !g ? '' : g.kind === 'level' ? R(g.drop.rarity).name + ' Drop' + (g.item ? ' + ' + esc(S.itemDef(g.item.id).name) : '') : g.kind === 'credits' ? g.n + ' credits' : g.kind === 'drop' ? R(g.drop.rarity).name + ' Drop' : esc(S.itemDef(g.entry.id).name);
  ACT.rewards = () => rewardsDlg();
  ACT.claimLvl = (id) => { const g = S.claimLevelReward(id); BL.Audio.play('levelup'); rewardsDlg(gotText(g)); };
  ACT.claimTier = (arg) => { const [t, tr] = arg.split(':'); const g = S.claimPassTier(+t, tr); BL.Audio.play('levelup'); if (M.screen === 'pass' && !document.querySelector('.cl-dlg')) { M.render(); M.toast('Claimed: ' + gotText(g).replace(/<[^>]+>/g, '')); } else rewardsDlg(gotText(g)); };
  ACT.claimAll = () => {
    const got = [];
    for (const u of (S.p.unclaimed || []).slice()) got.push(gotText(S.claimLevelReward(u.id)));
    for (const c of S.passClaimable()) got.push(gotText(S.claimPassTier(c.tier, c.track)));
    BL.Audio.play('levelup');
    if (M.screen === 'pass' && !document.querySelector('.cl-dlg')) { M.render(); M.toast('Claimed ' + got.length + ' rewards'); } else rewardsDlg(got.length + ' rewards (' + got.slice(0, 4).join(', ') + (got.length > 4 ? '...' : '') + ')');
  };

  // ---------- ROCKET PASS: a tier track along the bottom, claim each reward yourself ----------
  SCREENS.pass = () => {
    const ps = S.p.pass, P = BL.PASS, pc = S.passClaimable();
    const cell = (row, track) => {
      const rw = track === 'premium' ? row.prem : row.free;
      if (!rw) return '<div class="rp-cell none"></div>';
      const reached = row.tier <= ps.tier, claimed = (track === 'premium' ? ps.claimedPrem : ps.claimedFree)[row.tier];
      const locked = track === 'premium' && !ps.premium;
      const st = claimed ? 'claimed' : reached && !locked ? 'ready' : locked ? 'plocked' : 'locked';
      return `<div class="rp-cell ${track} ${st}">${X.rewardCard(rw, { cls: track === 'premium' ? 'prem' : 'free' })}
        ${st === 'ready' ? btn('CLAIM', 'claimTier', row.tier + ':' + track, 'hot rp-claim') : st === 'claimed' ? `<i class="rp-ok">${BL.ICON('check', 18)}</i>` : `<i class="rp-lock">${BL.ICON('lock', 16)}</i>`}</div>`;
    };
    // 20 tiers a page (300 tiers of cards at once would be thousands of thumbnails)
    const PER = 20, pages = Math.ceil(P.tiers / PER);
    if (M.rpPage == null) M.rpPage = Math.floor(Math.max(0, ps.tier - 1) / PER);
    M.rpPage = U.clamp(M.rpPage, 0, pages - 1);
    const from = M.rpPage * PER, rows = BL.PASS_REWARDS.slice(from, from + PER);
    const cols = rows.map((row) => `<div class="rp-col ${row.tier <= ps.tier ? 'reached' : ''} ${row.tier === ps.tier + 1 ? 'next' : ''}"><div class="rp-n">${row.tier}</div>${cell(row, 'premium')}${cell(row, 'free')}</div>`).join('');
    return `<div class="rp">
      <div class="rp-head">
        <div class="rp-title"><b>ROCKET PASS</b><small>SEASON ${P.season}${ps.premium ? ' • PREMIUM' : ''}</small></div>
        <div class="rp-tier"><div class="rp-tn">TIER <b>${ps.tier}</b><small>/ ${P.tiers}</small></div><div class="pv-bar gold"><i style="width:${Math.round((ps.xp / P.xpPerTier) * 100)}%"></i></div><small>${fmt(ps.xp)} / ${fmt(P.xpPerTier)} XP</small></div>
        <div class="rp-btns">${pc.length ? btn(BL.ICON('gift', 16) + ' CLAIM ALL (' + pc.length + ')', 'claimAll', '', 'hot') : ''}${ps.premium ? '' : btn('UNLOCK PREMIUM <i class="cr"></i>' + P.premiumPrice, 'passBuy', '', 'gold')}${ps.tier < P.tiers ? btn('TIER SKIP <i class="cr"></i>' + P.skipPrice, 'passSkip') : ''}</div>
      </div>
      <div class="rp-pager">${btn(BL.ICON('prev', 14), 'rpPage', '-1')}<b>TIERS ${from + 1}-${Math.min(P.tiers, from + PER)}</b><small>${from >= P.mainTiers ? 'PRO TIERS' : 'SEASON TRACK'}</small>${btn(BL.ICON('next', 14), 'rpPage', '1')}${btn('CURRENT TIER', 'rpPage', 'now')}</div>
      <div class="rp-labels"><span>PREMIUM</span><span>FREE</span></div>
      <div class="rp-track" id="rpTrack">${cols}</div>
      <div class="rp-hint">LB / RB to page • rewards stay here until you claim them</div>
    </div>`;
  };
  ACT.rpPage = (a) => { M.rpPage = a === 'now' ? Math.floor(Math.max(0, S.p.pass.tier - 1) / 20) : (M.rpPage || 0) + (+a); M.render(); };
  AFTER.pass = () => { const tr = document.getElementById('rpTrack'); if (tr) { const first = BL.PASS_REWARDS.findIndex((row) => row.tier <= S.p.pass.tier && (!S.p.pass.claimedFree[row.tier] || (S.p.pass.premium && !S.p.pass.claimedPrem[row.tier]))); const at = (first >= 0 && Math.floor(first / 20) === M.rpPage ? first : Math.max(0, S.p.pass.tier - 1)) - M.rpPage * 20; tr.scrollLeft = Math.max(0, Math.min(19, at) * 128 - 60); } };

  // ---------- AFTER THE MATCH: scoreboard, then XP / Rocket Pass / rank bars that fill up ----------
  const divFrac = (mmr) => {
    const r = S.rankInfo(mmr), RK = BL.RANKS;
    if (r.tier >= RK.length - 1) return 1;
    const span = (RK[r.tier + 1].min - RK[r.tier].min) / 3, lo = RK[r.tier].min + r.div * span;
    return U.clamp((mmr - lo) / span, 0, 1);
  };
  M.postView = function (game, r, o) {
    const d = o.data, p = S.p, res = o.res;
    const prog = !d ? '' : `<div class="pv-prog">
        <div class="pv-card"><div class="pv-k">LEVEL <b id="pvLvl">${d.before.level}</b><em id="pvLvlUp">LEVEL UP!</em></div><div class="pv-bar"><i id="pvXpBar" style="width:${Math.round((d.before.xp / S.xpForLevel(d.before.level)) * 100)}%"></i></div><div class="pv-sub"><span id="pvXp">+0 XP</span>${d.xp ? '' : ' <small>(matches under a minute give no XP)</small>'}</div></div>
        <div class="pv-card"><div class="pv-k">ROCKET PASS <b>TIER <span id="pvTier">${d.before.tier}</span></b><em id="pvTierUp">TIER UP!</em></div><div class="pv-bar gold"><i id="pvPassBar" style="width:${Math.round((d.before.pxp / BL.PASS.xpPerTier) * 100)}%"></i></div><div class="pv-sub">+${fmt(d.xp + d.chXP)} PASS XP</div></div>
        ${d.rank ? `<div class="pv-card pv-rank">${rankIcon(d.rank.before, 'lg')}<div class="pv-rk"><b id="pvRankName">${esc(S.rankInfo(d.rank.before).full)}</b><div class="pv-bar rank"><i id="pvRankBar" style="width:${Math.round(divFrac(d.rank.before) * 100)}%"></i></div>
          <div class="pv-sub"><span class="mmr-d ${d.rank.delta >= 0 ? 'up' : 'down'}">${d.rank.delta >= 0 ? '+' : ''}${d.rank.delta}</span> ${d.rank.games <= 10 ? 'Placement match ' + d.rank.games + '/10' : Math.abs(d.rank.streak || 0) >= 3 ? (d.rank.streak > 0 ? 'WIN' : 'LOSS') + ' STREAK ×' + Math.abs(d.rank.streak) : ''}</div></div><em id="pvRankUp"></em></div>` : ''}
      </div>
      ${d.chDone.length ? `<div class="pv-ch">${d.chDone.map((c) => `<span>${BL.ICON('check', 14)} ${esc(c.desc)} <b>+${c.xp}</b></span>`).join('')}</div>` : ''}
      ${S.pendingRewards() ? `<div class="pv-claim">${BL.ICON('gift', 18)} ${S.pendingRewards()} reward${S.pendingRewards() > 1 ? 's' : ''} ready to claim from the main menu</div>` : ''}`;
    const btns = o.online ? btn('BACK TO MENU', 'pmLobby', '', 'hot') : btn(r.ranked ? 'PLAY AGAIN' : 'REMATCH', 'pmRematch') + btn('CONTINUE', 'pmMenu', '', 'hot');
    // each match starts with an empty end-of-match chat
    if (M.pmChatGame !== game) { M.pmChatGame = game; M.pmChat = (M.pmChat || []).filter((m) => m.game === game); }
    const chat = `<div class="pv-chat"><div class="pv-log" id="pvLog">${M.pmChat.map((m) => `<div><b style="color:${BL.TEAM_MAIN[m.team] || '#fff'}">${esc(m.name)}:</b> ${esc(m.msg)}</div>`).join('') || '<div class="muted">Quick chat <kbd>1</kbd> - <kbd>4</kbd></div>'}</div>
      <div class="pv-qc" id="pvQC"></div></div>`;
    M.openOverlay(`<div class="pv">
      <div class="pv-top ${res === 'VICTORY' ? 'win' : res === 'DEFEAT' ? 'lose' : ''}"><h1>${res}</h1><div class="pv-score"><b class="t0">${r.score[0]}</b><i>-</i><b class="t1">${r.score[1]}</b></div></div>${o.ffNote}
      <div class="pv-tables"><table class="t0"><thead>${o.head}</thead>${o.rows(0)}</table><table class="t1"><thead>${o.head}</thead>${o.rows(1)}</table></div>
      ${prog}${o.extra}${chat}
      <div class="pv-btns">${btns}</div></div>`, 'post-ov pv-ov');
    if (d) animatePost(d);
  };
  document.addEventListener('keydown', (e) => { const g = BL.game; if (e.key === 'Enter' && g && g.podium && !g.podium.done) g._podiumSkip = true; });
  // end-of-match chat: what everyone says on the podium and results (quick chat's post-game lines) is kept in the
  // results log
  const chat0 = BL.HUD.chat;
  BL.HUD.chat = function (name, team, msg) {
    chat0.apply(BL.HUD, arguments);
    if (BL.game && BL.game.phase === 'ended') {
      if (M.pmChatGame !== BL.game) { M.pmChatGame = BL.game; M.pmChat = []; }
      M.pmChat = (M.pmChat || []).concat([{ name, team, msg, game: BL.game }]).slice(-8);
      const log = document.getElementById('pvLog');
      if (log) { log.innerHTML = M.pmChat.map((m) => `<div><b style="color:${BL.TEAM_MAIN[m.team] || '#fff'}">${esc(m.name)}:</b> ${esc(m.msg)}</div>`).join(''); log.scrollTop = 1e9; }
    }
  };

  function animatePost(d) {
    const el = (id) => document.getElementById(id);
    const T = 2200, t0 = performance.now();
    let lastLvl = d.before.level, lastTier = d.before.tier, lastRank = d.rank ? S.rankInfo(d.rank.before).full : '';
    const passTotal = d.xp + d.chXP;
    const step = () => {
      if (!el('pvXpBar')) return;
      const k = Math.min(1, (performance.now() - t0) / T), e = 1 - Math.pow(1 - k, 3);
      // level bar: walk the XP through each level it crosses
      let lvl = d.before.level, xp = d.before.xp + d.xp * e;
      while (xp >= S.xpForLevel(lvl) && lvl < d.after.level) { xp -= S.xpForLevel(lvl); lvl++; }
      if (lvl === d.after.level && k >= 1) xp = d.after.xp;
      el('pvXpBar').style.width = Math.min(100, (xp / S.xpForLevel(lvl)) * 100) + '%';
      el('pvXp').textContent = '+' + fmt(d.xp * e) + ' XP';
      if (lvl !== lastLvl) { lastLvl = lvl; el('pvLvl').textContent = lvl; el('pvLvlUp').classList.remove('on'); void el('pvLvlUp').offsetWidth; el('pvLvlUp').classList.add('on'); BL.Audio.play('levelup'); }
      // Rocket Pass bar
      let tier = d.before.tier, px = d.before.pxp + passTotal * e;
      while (px >= BL.PASS.xpPerTier && tier < d.after.tier) { px -= BL.PASS.xpPerTier; tier++; }
      if (k >= 1) { tier = d.after.tier; px = d.after.pxp; }
      el('pvPassBar').style.width = Math.min(100, (px / BL.PASS.xpPerTier) * 100) + '%';
      if (tier !== lastTier) { lastTier = tier; el('pvTier').textContent = tier; el('pvTierUp').classList.remove('on'); void el('pvTierUp').offsetWidth; el('pvTierUp').classList.add('on'); }
      // rank: the division bar slides with the MMR; the name changes as it crosses a division
      if (d.rank && el('pvRankBar')) {
        const m = d.rank.before + (d.rank.after - d.rank.before) * e, ri = S.rankInfo(m);
        el('pvRankBar').style.width = divFrac(m) * 100 + '%';
        if (ri.full !== lastRank) {
          const up = d.rank.after > d.rank.before;
          lastRank = ri.full; el('pvRankName').textContent = ri.full;
          const card = el('pvRankBar').closest('.pv-rank'), ic = card && card.querySelector('.rl-rk');
          if (ic) ic.outerHTML = rankIcon(m, 'lg');
          const tag = el('pvRankUp'); tag.textContent = up ? 'RANK UP!' : 'RANK DOWN'; tag.className = 'on ' + (up ? 'up' : 'down');
          if (up) BL.Audio.play('levelup');
        }
      }
      if (k < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 700);
  }
  // back in the menus with rewards waiting: say so once
  BL.bus.on('menu:shown', () => {});

  // ---------- PAUSE MENU (like the real one) ----------
  // Matchmade games (playlists, tournaments, party searches) have no free leave: FORFEIT is a team vote and ABANDON
  // MATCH leaves and bans you from matchmaking for 7 minutes. Free Play, exhibitions and private matches just exit.
  const matchmade = (g) => !!(g && g.mode !== 'freeplay' && (g.cfg.disguised || g.cfg.playlist || g.cfg.ranked || (g.cfg.ctx && g.cfg.ctx.kind === 'tour')));
  const BAN_MS = 7 * 60 * 1000;
  M.mmBanLeft = () => Math.max(0, (S.p.mmBanUntil || 0) - Date.now());
  M.togglePause = function (game) {
    if (M.postShown) return;
    if (game.paused || M.pauseOpen) { M.closePause(game); return; }
    const live = game.online || !!game.cfg.disguised, mm = matchmade(game);
    if (!live) game.paused = true;
    const v = game.ffVote, vt = v && game.local && v.team === game.local.team;
    M.openOverlay(`<div class="dlg rl-dlg pause rl-pause"><h2>${live ? 'MENU' : 'PAUSED'}</h2>
      ${btn('RESUME', 'resume', '', 'hot')}
      ${!live && game.mode !== 'freeplay' && !game.cfg.ranked ? btn('RESTART MATCH', 'restart') : ''}
      ${btn('CONTROLS', 'pauseHelp')}
      ${mm ? `${btn(vt ? 'VOTE TO FORFEIT (' + game.voters(game.local.team).filter((id) => v.yes.has(id)).length + ' / ' + game.voters(game.local.team).length + ')' : 'FORFEIT', 'ffVote')}${btn('ABANDON MATCH', 'abandon', '', 'danger')}`
        : btn(live ? 'LEAVE MATCH' : 'EXIT TO MENU', 'leaveMatch', '', 'danger')}
      <div id="pauseHelp" class="hidden">${X.controlsHelp()}</div>
      <p class="rl-pause-hint"><kbd>${BL.Input.pads && BL.Input.pads().length ? 'RT' : 'F'}</kbd> Friends &amp; Party</p></div>`, 'pause-ov');
    M.pauseOpen = true;
  };
  const closePause0 = M.closePause;
  M.closePause = function (game) { closePause0.call(M, game); M.pauseOpen = false; if (BL.game) { M.friendsOpen = false; ingameFriends(); } };
  ACT.ffVote = () => {
    const g = BL.game; if (!g || !g.local) return;
    if (g.isClient) { (BL.Net.transport === 'ws' ? BL.Net.srvSend : BL.Net.sendToHost)({ t: 'ff' }); M.toast('Voted to forfeit'); M.closePause(g); return; }
    const r = g.castForfeit(g.local.id);
    M.closePause(g);
    if (r && !r.done) M.toast('Voted to forfeit: waiting for your teammates (' + r.n + ' / ' + r.of + ')');
  };
  ACT.abandon = () => M.confirm('Abandon this match? You will be <b>banned from matchmaking for 7 minutes</b>' + (BL.game && BL.game.cfg.ranked ? ' and it counts as a loss' : '') + '.', () => {
    S.p.mmBanUntil = Date.now() + BAN_MS; S.save();
    leaveKeepingParty(true);
  }, 'ABANDON');
  // leaving a match never leaves your party: a party member's car goes to a bot, the host leaving ends it for all
  function leaveKeepingParty(abandoned) {
    const g = BL.game, L = BL.Net.lobby;
    if (!g) return;
    if (g.online && L && L.party && BL.Net.transport !== 'ws') {
      M.closeOverlay();
      if (M.forfeit(g)) { /* the time you played still counted */ }
      if (BL.Net.role === 'host') { g.forfeitTeam(g.local ? g.local.team : 0); return; }
      BL.Net.sendToHost({ t: 'leftGame' });
      BL.App.endGame(); HISTORY.length = 0; M.show('main');
      if (abandoned) M.toast('You abandoned the match: matchmaking is locked for 7:00. You are still in your party.');
      return;
    }
    ACT.leaveMatch();
    if (abandoned) setTimeout(() => M.toast('You abandoned the match: matchmaking is locked for 7:00'), 400);
  }
  // the friends sidebar during a match (from the pause menu, or Back / RT on a controller)
  function ingameFriends() {
    let el = document.getElementById('rlFpGame');
    if (!BL.game || !M.friendsOpen) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'rlFpGame'; el.className = 'rl rl-fp-game'; document.body.appendChild(el); }
    el.innerHTML = friendsPanel();
  }
  const friends0 = ACT.friends;
  ACT.friends = () => { if (BL.game) { M.friendsOpen = !M.friendsOpen; ingameFriends(); return; } friends0(); };
  BL.bus.on('friends', () => { if (BL.game && M.friendsOpen) ingameFriends(); });
  BL.bus.on('net:lobby', () => { if (BL.game && M.friendsOpen) ingameFriends(); });

  // leaving a tournament match knocks you out
  ACT.leaveMatch = () => {
    const g = BL.game, ctx = g && g.cfg.ctx;
    if (ctx && ctx.kind === 'tour' && S.p.tour && S.p.tour.cur && g.phase !== 'ended') { S.p.tour.cur.out = true; S.save(); }
    old.leaveMatch();
    const back = ctxScreen(g);
    if (back && !g.online) M.show(back);
    else if (g.online && g.cfg.playlist) { HISTORY.length = 0; M.show('main'); }
  };
})(window.BL);
