'use strict';
// Rocket League (fan remake) - an emblem of its own for every Competitive rank: Bronze I to Grand Champion III and
// Supersonic Legend (22), plus Unranked. Original artwork drawn as SVG here (nothing loaded): each tier has its own
// shape (Bronze a round badge, Silver a pointed shield, Gold a crest with a star, Platinum a hexagon with crystals,
// Diamond a cut gem, Champion a crowned shield, Grand Champion a winged crowned crest in flames, Supersonic Legend a
// winged star in sonic rings) and each level within it more trim: I one pip, II side fins and two pips, III a
// ring of light and three pips. Each one is built once and kept as a data: URL (an <img>, so ids never clash).
(function (BL) {
  const RA = BL.RankArt = {};
  // [light, dark, outline, glow]
  const PAL = [
    ['#f3b882', '#7f4520', '#2e1608', '#ff9a4a'],
    ['#ffffff', '#8796a6', '#2f3742', '#dfe9ff'],
    ['#fff3a6', '#cf9310', '#523700', '#ffd23f'],
    ['#dcfff9', '#26a896', '#0a4740', '#5fffe6'],
    ['#d2ebff', '#2766db', '#0a275e', '#6fb2ff'],
    ['#f3d8ff', '#8a2ee0', '#2b0a52', '#c77dff'],
    ['#ffd5c8', '#cf1530', '#45030e', '#ff4d4d'],
    ['#ffffff', '#b8c6ff', '#262b48', '#ffffff'],
  ];
  const SH = {
    disc: 'M50 12 A36 36 0 1 1 49.9 12 Z',
    heater: 'M20 16 H80 V46 C80 68 65 83 50 92 C35 83 20 68 20 46 Z',
    crest: 'M50 7 L81 18 L77 54 C73 73 62 85 50 93 C38 85 27 73 23 54 L19 18 Z',
    hex: 'M50 8 L85 28 L85 68 L50 88 L15 68 L15 28 Z',
    gem: 'M30 14 H70 L88 36 L50 92 L12 36 Z',
  };
  const star = (cx, cy, r1, r2, n) => { let d = ''; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1) + ' '; } return d + 'Z'; };
  const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => (100 - +x).toFixed(1) + ' ' + y);
  function emblem(tier, lv) {
    const [lt, dk, ol, gl] = PAL[tier], g = 'g' + tier + lv, s = 's' + tier + lv, out = [];
    const defs = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset="${lv === 2 ? 0.42 : 0.55}" stop-color="${mixHex(lt, dk, 0.45)}"/><stop offset="1" stop-color="${dk}"/></linearGradient>`
      + `<linearGradient id="${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`
      + (tier === 7 ? `<linearGradient id="p${lv}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6f5"/><stop offset="0.35" stop-color="#ffffff"/><stop offset="0.7" stop-color="#c9fff4"/><stop offset="1" stop-color="#cfd6ff"/></linearGradient>` : '')
      + `<radialGradient id="r${tier}${lv}"><stop offset="0.55" stop-color="${gl}" stop-opacity="0.55"/><stop offset="1" stop-color="${gl}" stop-opacity="0"/></radialGradient></defs>`;
    out.push(defs);
    const fill = tier === 7 ? `url(#p${lv})` : `url(#${g})`;
    const body = (d, f) => `<path d="${d}" fill="${f || fill}" stroke="${ol}" stroke-width="3.2" stroke-linejoin="round"/>`;
    const shine = (d) => `<path d="${d}" fill="url(#${s})" opacity="0.8"/>`;
    const mark = (d, o) => `<path d="${d}" fill="#ffffff" fill-opacity="${o == null ? 0.92 : o}" stroke="${ol}" stroke-width="1.6" stroke-opacity="0.55" stroke-linejoin="round"/>`;
    // level III: a ring of light behind it
    if (lv === 2) out.push(`<circle cx="50" cy="50" r="49" fill="url(#r${tier}${lv})"/>`);
    // level II and III: fins / spikes out to the sides (each tier its own)
    const fins = lv >= 1;
    switch (tier) {
      case 0: // Bronze: a round badge with a rising chevron
        if (fins) out.push(body('M14 50 L4 40 L8 58 Z'), body(mirror('M14 50 L4 40 L8 58 Z')));
        out.push(body(SH.disc), shine('M50 15 A33 33 0 0 1 82 44 A40 40 0 0 0 18 44 A33 33 0 0 1 50 15 Z'));
        out.push(`<circle cx="50" cy="48" r="26" fill="none" stroke="${ol}" stroke-opacity="0.35" stroke-width="2"/>`);
        out.push(mark('M33 58 L50 40 L67 58 L67 67 L50 50 L33 67 Z'));
        break;
      case 1: // Silver: a pointed shield with a double chevron
        if (fins) out.push(body('M20 24 L6 18 L12 40 L20 44 Z'), body(mirror('M20 24 L6 18 L12 40 L20 44 Z')));
        out.push(body(SH.heater), shine('M24 20 H76 V40 C60 34 40 34 24 44 Z'));
        out.push(mark('M35 46 L50 32 L65 46 L65 53 L50 40 L35 53 Z'), mark('M35 61 L50 47 L65 61 L65 68 L50 55 L35 68 Z', 0.78));
        break;
      case 2: // Gold: a crest with a star
        if (fins) out.push(body('M19 22 L5 12 L9 36 L22 44 Z'), body(mirror('M19 22 L5 12 L9 36 L22 44 Z')));
        out.push(body(SH.crest), shine('M50 11 L77 21 L75 40 C60 33 40 33 25 42 L22 21 Z'));
        out.push(mark(star(50, 50, 18, 7.5, 5)));
        break;
      case 3: // Platinum: a hexagon with crystals
        if (fins) out.push(body('M15 36 L3 30 L3 66 L15 60 Z'), body(mirror('M15 36 L3 30 L3 66 L15 60 Z')));
        out.push(body(SH.hex), shine('M50 12 L82 30 L82 44 C62 36 38 36 18 46 L18 30 Z'));
        out.push(mark('M50 26 L60 44 L50 70 L40 44 Z'), mark('M36 40 L42 50 L36 64 L30 50 Z', 0.7), mark('M64 40 L70 50 L64 64 L58 50 Z', 0.7));
        break;
      case 4: // Diamond: a cut gem
        if (fins) out.push(body('M16 34 L2 26 L8 46 L22 46 Z'), body(mirror('M16 34 L2 26 L8 46 L22 46 Z')));
        out.push(body(SH.gem));
        out.push(`<path d="M12 36 H88 M30 14 L38 36 L50 92 L62 36 L70 14 M38 36 L50 14 L62 36" fill="none" stroke="${ol}" stroke-opacity="0.45" stroke-width="1.8" stroke-linejoin="round"/>`);
        out.push(shine('M30 16 H50 L38 36 H14 Z'), mark('M50 22 L58 36 L50 60 L42 36 Z', 0.85));
        break;
      case 5: // Champion: a crowned shield with laurels
        if (fins) out.push(body('M20 30 L6 26 L10 50 L22 54 Z'), body(mirror('M20 30 L6 26 L10 50 L22 54 Z')));
        out.push(body('M22 26 H78 V50 C78 70 64 84 50 93 C36 84 22 70 22 50 Z'), shine('M26 30 H74 V44 C58 38 42 38 26 48 Z'));
        out.push(body('M26 28 L30 8 L40 18 L50 4 L60 18 L70 8 L74 28 Z'));
        out.push(`<circle cx="30" cy="8" r="3" fill="#fff"/><circle cx="50" cy="4" r="3.4" fill="#fff"/><circle cx="70" cy="8" r="3" fill="#fff"/>`);
        out.push(`<path d="M36 76 C28 66 28 54 32 44 M64 76 C72 66 72 54 68 44" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="3" stroke-linecap="round"/>`);
        for (const [x, y, a] of [[31, 50, -30], [30, 60, -15], [33, 70, 5], [69, 50, 30], [70, 60, 15], [67, 70, -5]]) out.push(`<ellipse cx="${x}" cy="${y}" rx="2.6" ry="5" transform="rotate(${a} ${x} ${y})" fill="#fff" fill-opacity="0.85"/>`);
        out.push(mark(star(50, 58, 11, 4.8, 5)));
        break;
      case 6: { // Grand Champion: a winged, crowned crest in flames
        const flame = 'M50 2 C56 12 64 12 66 4 C70 14 68 22 62 26 L38 26 C32 22 30 14 34 4 C36 12 44 12 50 2 Z';
        out.push(`<path d="${flame}" fill="#ffb347" stroke="${ol}" stroke-width="2.4" stroke-linejoin="round"/>`);
        const wing = 'M24 34 C10 30 2 18 2 8 C10 18 16 22 24 22 C16 26 12 30 14 34 C8 32 4 30 2 26 C8 38 16 44 26 46 Z';
        out.push(body(wing), body(mirror(wing)));
        if (fins) { const w2 = 'M24 50 C12 50 6 44 4 38 C12 44 18 44 24 42 Z'; out.push(body(w2), body(mirror(w2))); }
        out.push(body(SH.crest.replace('M50 7', 'M50 14')), shine('M50 17 L77 26 L75 42 C60 35 40 35 25 44 L22 26 Z'));
        out.push(body('M32 26 L35 14 L43 21 L50 11 L57 21 L65 14 L68 26 Z', '#ffd23f'));
        out.push(mark(star(50, 56, 15, 6.5, 5)));
        out.push(`<path d="M50 44 L50 68" stroke="${ol}" stroke-opacity="0.25" stroke-width="1.5"/>`);
        break;
      }
      default: { // Supersonic Legend: a winged star in sonic rings
        out.push(`<ellipse cx="50" cy="52" rx="46" ry="16" fill="none" stroke="#9fb3ff" stroke-width="2.4" stroke-opacity="0.8" transform="rotate(-18 50 52)"/>`);
        out.push(`<ellipse cx="50" cy="52" rx="40" ry="12" fill="none" stroke="#ffd6f5" stroke-width="1.8" stroke-opacity="0.8" transform="rotate(14 50 52)"/>`);
        const wing = 'M30 46 C16 44 4 34 0 20 C10 30 20 34 32 34 C22 30 16 24 14 16 C22 26 30 30 38 30 Z';
        out.push(body(wing), body(mirror(wing)));
        out.push(body(star(50, 50, 40, 17, 8)));
        out.push(`<path d="${star(50, 50, 40, 17, 8)}" fill="url(#${s})" opacity="0.9"/>`);
        out.push(mark(star(50, 50, 16, 7, 4), 1));
        out.push(`<circle cx="50" cy="50" r="5" fill="#fff"/>`);
        break;
      }
    }
    // the level's pips along the bottom (not on Supersonic Legend: it has no levels)
    if (tier < 7) {
      const n = lv + 1, y = tier === 4 ? 78 : tier === 0 ? 83 : 82, gap = 9;
      for (let i = 0; i < n; i++) { const x = 50 + (i - (n - 1) / 2) * gap; out.push(`<path d="M${x} ${y - 4.5} L${x + 4} ${y} L${x} ${y + 4.5} L${x - 4} ${y} Z" fill="#fff" stroke="${ol}" stroke-width="1.4"/>`); }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 108 108">${out.join('')}</svg>`;
  }
  function mixHex(a, b, k) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  const cache = {};
  // tier 0-7 (BL.RANKS), level 0-2 (I-III; Supersonic Legend has one); tier < 0 = Unranked
  RA.svg = (tier, lv) => (tier < 0 ? UNRANKED : emblem(Math.min(7, tier), tier >= 7 ? 0 : Math.max(0, Math.min(2, lv | 0))));
  RA.url = function (tier, lv) {
    const k = tier < 0 ? 'u' : tier + ':' + (tier >= 7 ? 0 : lv | 0);
    return cache[k] || (cache[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(RA.svg(tier, lv)));
  };
  const UNRANKED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 108 108"><path d="M50 8 L85 28 L85 68 L50 88 L15 68 L15 28 Z" fill="#2a3140" stroke="#8892a4" stroke-width="3.2" stroke-dasharray="7 5" stroke-linejoin="round"/>'
    + '<text x="50" y="62" font-family="Arial, sans-serif" font-size="38" font-weight="900" text-anchor="middle" fill="#aab3c2">?</text></svg>';
})(window.BL);
