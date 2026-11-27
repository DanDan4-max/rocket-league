'use strict';
// Rocket League (fan remake) - New Year's countdown (2026-11-22: "download a new years timer and more"). Built in code
// (works opened from disk too, no download needed):
//  - a NEW YEAR card at the top of the main menu's news column, counting down to midnight on 1 January in your own
//    time zone; click it for the big countdown. It only shows for the last three weeks of the year (from 11 December)
//    and the first week of January (the user, 2026-11-22: "remove the new years countdown for now but make it start
//    3 weeks before new year")
//  - in a match, the last minute counts down at the top of the screen
//  - the last ten seconds count down big, wherever you are; at midnight: HAPPY NEW YEAR, fireworks (over the stadium
//    in a match, over the screen in the menus) and the crowd going wild
//  - a gift for opening the game between 1 and 7 January: that year's gold Party Hat and a HAPPY <year> title
(function (BL) {
  const NY = BL.NewYear = { offset: 0 };
  const U = BL.util;
  NY.now = () => Date.now() + NY.offset;
  // the next midnight of 1 January (and the year it starts)
  NY.target = () => { const d = new Date(NY.now()); return new Date(d.getFullYear() + 1, 0, 1, 0, 0, 0, 0); };
  NY.year = () => NY.target().getFullYear();
  // 1 - 7 January: it's the new year, the celebration week
  NY.party = () => { const d = new Date(NY.now()); return d.getMonth() === 0 && d.getDate() <= 7 ? d.getFullYear() : 0; };
  // the countdown's on show: the last three weeks of the year and the first week of January
  NY.SHOW_DAYS = 21;
  NY.showing = () => !!NY.party() || NY.target().getTime() - NY.now() <= NY.SHOW_DAYS * 86400000;
  // test hook: midnight in `secs` seconds
  NY.fakeMidnight = (secs) => { NY.offset = 0; NY.offset = NY.target().getTime() - Date.now() - secs * 1000; NY._last = null; };

  // the gifts, one pair per year (every year from 2027 on stays registered, so old inventories keep theirs)
  const push = (it) => { if (!BL.ITEM_BY_ID[it.id]) { BL.ITEMS.push(it); BL.ITEM_BY_ID[it.id] = it; } };
  const lastYear = Math.max(2027, new Date().getFullYear() + 1);
  for (let y = 2027; y <= lastYear; y++) {
    push({ id: 'topper_ny' + y, cat: 'topper', name: 'New Year ' + y + ' Hat', rarity: 'limited', shape: 'partyhat', color: '#ffd23f', fest: 'newyear', pass: 'fest', ny: y });
    push({ id: 'title_ny' + y, cat: 'title', name: 'Happy ' + y, rarity: 'limited', text: 'HAPPY ' + y, color: '#ffd23f', glow: true, fest: 'newyear', pass: 'fest', ny: y });
  }
  NY.gifts = (y) => ['topper_ny' + y, 'title_ny' + y].filter((id) => BL.ITEM_BY_ID[id]);
  NY.grant = function () {
    const y = NY.party(), S = BL.Save;
    if (!y || !S || !S.p) return [];
    const got = [];
    for (const id of NY.gifts(y)) if (!S.owns(id)) { S.addItem(id, null, null, true); got.push(BL.ITEM_BY_ID[id].name); }
    if (got.length) { S.save(); toast('Happy New Year! Your gift: ' + got.join(' + ')); }
    return got;
  };
  function toast(m) { if (BL.Menu && BL.Menu.toast) BL.Menu.toast(m); }

  // "39 DAYS 04:12:09" / "04:12:09"
  const two = (n) => String(n).padStart(2, '0');
  NY.parts = () => { let s = Math.max(0, Math.floor((NY.target().getTime() - NY.now()) / 1000)); const d = Math.floor(s / 86400); s -= d * 86400; return { d, h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }; };
  NY.text = () => { const p = NY.parts(); return (p.d ? p.d + (p.d === 1 ? ' DAY ' : ' DAYS ') : '') + two(p.h) + ':' + two(p.m) + ':' + two(p.s); };

  // the main menu card (js/rlmenu.js puts it at the top of the news column)
  NY.card = function () {
    if (!NY.showing()) return '';
    const y = NY.party();
    if (y) return `<div class="nw-card nw-ny party" data-act="nyOpen"><div class="nw-art"><i class="ny-spark"></i><b>HAPPY NEW YEAR</b><span>${y}</span></div><div class="nw-sub"><small>Open the game until 7 January for your gift: the ${y} Hat and a HAPPY ${y} title</small></div></div>`;
    return `<div class="nw-card nw-ny" data-act="nyOpen"><div class="nw-art"><i class="ny-spark"></i><b>NEW YEAR ${NY.year()}</b><span data-ny="all">${NY.text()}</span></div><div class="nw-sub"><small>Countdown to midnight, fireworks, and a gift from 1 January</small></div></div>`;
  };
  // the big countdown
  function panel() {
    const y = NY.party(), M = BL.Menu, X = M._x, gifts = NY.gifts(y || NY.year()).map((id) => X.itemCard(BL.ITEM_BY_ID[id], { tip: 'New Year gift' })).join('');
    const box = (k, l) => `<div class="ny-box"><b data-ny="${k}">00</b><small>${l}</small></div>`;
    M.openOverlay(`<div class="dlg rl-dlg ny-dlg"><h2>${y ? 'HAPPY NEW YEAR ' + y + '!' : 'NEW YEAR ' + NY.year()}</h2>
      ${y ? '<p class="muted">The new year is here! Your gift is in the garage.</p>' : `<div class="ny-clock">${box('d', 'DAYS')}${box('h', 'HOURS')}${box('m', 'MINUTES')}${box('s', 'SECONDS')}</div>
      <p class="muted small">Midnight on 1 January in your own time zone. Keep the game open (in a match or the menus) for the last ten seconds and the fireworks.</p>`}
      <h4>NEW YEAR GIFT</h4><div class="ny-gifts">${gifts}</div><p class="muted small">Yours for opening the game between 1 and 7 January.</p>
      <div class="row end">${'<button class="rl-btn" data-act="nyPreview">PREVIEW FIREWORKS</button>'}<button class="rl-btn hot" data-act="closeOv">CLOSE</button></div></div>`);
    tick(true);
  }

  // ---------- the clock: updates whatever shows it, the in-match countdown, the last ten seconds, midnight ----------
  let hud = null, big = null;
  function el(id, cls) { let e = document.getElementById(id); if (!e) { e = document.createElement('div'); e.id = id; e.className = cls; document.body.appendChild(e); } return e; }
  function tick(force) {
    const left = (NY.target().getTime() - NY.now()) / 1000, p = NY.parts();
    // midnight passed since the last tick (the target has moved on a year): celebrate
    const ty = NY.year();
    if (NY._last != null && ty !== NY._last) celebrate(ty - 1);
    NY._last = ty;
    document.querySelectorAll('[data-ny]').forEach((e) => {
      const k = e.getAttribute('data-ny'), v = k === 'all' ? NY.text() : k === 'd' ? String(p.d) : two(p[k]);
      if (force || e.textContent !== v) e.textContent = v;
    });
    // a match: the last minute at the top of the screen
    const g = BL.game, inMatch = !!(g && !g.headless && !g.holdSim);
    if (inMatch && left <= 60 && left > 0) { hud = hud || el('nyHud', 'ny-hud'); hud.style.display = ''; hud.textContent = 'NEW YEAR IN ' + p.m + ':' + two(p.s); } else if (hud) hud.style.display = 'none';
    // the last ten seconds, big
    if (left <= 10 && left > 0) { big = big || el('nyBig', 'ny-big'); const n = String(Math.ceil(left)); if (big.textContent !== n) { big.textContent = n; big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop'); } big.style.display = ''; } else if (big && !big.classList.contains('hny')) big.style.display = 'none';
  }
  // midnight: HAPPY NEW YEAR, fireworks, the crowd, and the gift
  function celebrate(y, preview) {
    big = big || el('nyBig', 'ny-big');
    big.classList.add('hny'); big.innerHTML = `<small>HAPPY NEW YEAR</small>${y}`; big.style.display = '';
    setTimeout(() => { big.classList.remove('hny'); big.style.display = 'none'; }, 6000);
    const g = BL.game;
    if (g && !g.headless && BL.FX && BL.FX.fireworkLaunch && BL.Physics && BL.Physics.arena) {
      const A = BL.Physics.arena, cols = ['#ffd23f', '#ff5fa2', '#7df9ff', '#ffffff', '#9bff6a', '#ff8a1f'], n = BL.App && BL.App.potato ? 10 : 24;
      for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; BL.FX.fireworkLaunch(side * (A.hw + U.rand(-6, 10)), U.rand(-A.hl, A.hl), U.rand(26, 44), cols[i % cols.length], i * 0.35, 1.2); }
    } else screenFireworks();
    if (BL.Audio) { try { BL.Audio.cheer(1); BL.Audio.play('horn'); } catch (e) { /* (no sound yet) */ } }
    if (!preview) setTimeout(() => { NY.grant(); if (BL.Menu && BL.Menu.screen === 'main' && !BL.game) BL.Menu.render(); }, 1500);
  }
  NY.celebrate = celebrate;
  // fireworks drawn over the menus: a canvas on top for a few seconds (a few hundred sparks, then it's gone)
  function screenFireworks() {
    const cv = document.createElement('canvas'), W = cv.width = Math.min(1280, innerWidth), H = cv.height = Math.round(W * innerHeight / innerWidth);
    cv.className = 'ny-fw'; document.body.appendChild(cv);
    const g = cv.getContext('2d'), sparks = [], cols = ['#ffd23f', '#ff5fa2', '#7df9ff', '#ffffff', '#9bff6a', '#ff8a1f'];
    let t = 0, next = 0, last = performance.now();
    const burst = () => { const x = W * (0.15 + Math.random() * 0.7), y = H * (0.15 + Math.random() * 0.35), c = cols[(Math.random() * cols.length) | 0]; for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, s = 60 + Math.random() * 160; sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.2 + Math.random() * 0.8, c }); } };
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (t < 6 && t > next) { burst(); next = t + 0.25 + Math.random() * 0.35; }
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
        s.vy += 90 * dt; s.vx *= 1 - dt * 0.8; s.vy *= 1 - dt * 0.8; s.x += s.vx * dt; s.y += s.vy * dt;
        g.globalAlpha = Math.min(1, s.life); g.fillStyle = s.c; g.fillRect(s.x, s.y, 2.5, 2.5);
      }
      g.globalAlpha = 1;
      if (t < 8.5) requestAnimationFrame(frame); else cv.remove();
    };
    requestAnimationFrame(frame);
  }

  // the menu's actions, and the clock running (four times a second: only text that changed is touched)
  const hook = () => {
    const M = BL.Menu, ACT = M && M._x && M._x.ACT;
    if (!ACT) return false;
    ACT.nyOpen = panel;
    ACT.nyPreview = () => { const M2 = BL.Menu; if (M2.closeOverlay) M2.closeOverlay(); celebrate(NY.party() || NY.year(), true); };
    return true;
  };
  if (!hook()) window.addEventListener('load', hook);
  setInterval(tick, 250);
  // the gift when the game opens during the first week of January (once the profile is loaded)
  const tryGrant = (n) => { if (BL.Save && BL.Save.p) NY.grant(); else if (n < 40) setTimeout(() => tryGrant(n + 1), 500); };
  setTimeout(() => tryGrant(0), 1500);
})(window.BL);
