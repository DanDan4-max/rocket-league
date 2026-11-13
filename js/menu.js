'use strict';
// Rocket League (fan remake) - menus, garage UI, drops, shop, trade-in, season pass, ranked, lobby, post-match
(function (BL) {
  const U = BL.util, S = BL.Save;
  const M = BL.Menu = { screen: null, postShown: false };
  let root, overlay, toastEl;
  const ACT = {};
  const R = (id) => BL.RARITIES[id] || BL.RARITIES.common;
  const esc = U.esc;

  M.init = function () {
    root = document.getElementById('menu');
    overlay = document.getElementById('overlay');
    toastEl = document.getElementById('toast');
    document.addEventListener('click', (e) => {
      BL.Audio.unlock();
      if (!BL.Audio.musicOn && !BL.game) { BL.Audio.musicOn = true; BL.Audio.startMusic(); }
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = ACT[el.dataset.act];
      if (fn) { BL.Audio.play('click', 0.8); fn(el.dataset.arg, el, e); }
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-set]');
      if (el) ACT.setting(el.dataset.set, el);
      const ex = e.target.closest('[data-ex]');
      if (ex) { M.ex.mutators[ex.dataset.ex] = parseMut(ex.dataset.ex, ex.value); }
      const lm = e.target.closest('[data-lmut]');
      if (lm && BL.Net.role === 'host') { const muts = Object.assign({}, BL.Net.lobby.mutators); muts[lm.dataset.lmut] = parseMut(lm.dataset.lmut, lm.value); BL.Net.updateLobby({ mutators: muts }); }
    });
    document.addEventListener('input', (e) => {
      const el = e.target.closest('[data-range]');
      if (el) ACT.setting(el.dataset.range, el);
    });
    document.addEventListener('mouseover', (e) => { if (e.target.closest && e.target.closest('.mbtn, .tile')) { if (!e.target._h) { e.target._h = 1; BL.Audio.play('hover'); setTimeout(() => { e.target._h = 0; }, 300); } } });
    BL.bus.on('net:lobby', () => { if (M.screen === 'lobby' && !BL.game) M.render(); });
    BL.bus.on('net:lchat', (m) => {
      M.lobbyLog = (M.lobbyLog || []).concat([m]).slice(-40);
      const log = document.getElementById('lchatLog');
      if (log) { log.innerHTML = lobbyLogHtml(); log.scrollTop = 1e9; }
    });
    M.ex = { mode: 'soccar', size: 2, skill: 0.5, team: 0, map: 'champions', mutators: BL.defaultMutators() };
    M.on = { mode: 'soccar', size: 2, map: 'champions', skill: 0.5, fill: true };
  };

  function parseMut(key, v) {
    const opt = BL.MUTATORS[key].opts.find((o) => String(o[0]) === v);
    return opt ? opt[0] : BL.MUTATORS[key].def;
  }

  M.show = function (name, params) {
    if (M.endPreview && name !== M.screen) M.endPreview();
    M.screen = name;
    M.params = params || {};
    root.classList.remove('hidden');
    if (!BL.game) { BL.Garage.show(); if (BL.Audio.musicOn) BL.Audio.startMusic(); }
    BL.Garage.setBoostPreview(false);
    BL.Garage.wideOffset = ['garage', 'inventory', 'tradein', 'shop', 'drops', 'pass', 'controls', 'settings', 'exhibition', 'online', 'lobby', 'profile', 'ranked'].indexOf(name) >= 0 ? -1.45 : -0.35;
    if (M.viewFor) BL.Garage.view = M.viewFor(name);
    M.render();
  };
  M.hide = function () { root.classList.add('hidden'); BL.Garage.hide(); M.closeOverlay(); };

  M.render = function () {
    const fn = SCREENS[M.screen] || SCREENS.main;
    root.innerHTML = M.frame ? M.frame(M.screen, fn) : `<div class="m-wrap s-${M.screen}">${topbar()}<div class="m-body">${fn()}</div></div>`;
    if (AFTER[M.screen]) AFTER[M.screen]();
  };

  // Gamepad in menus: stick / d-pad moves between buttons, A presses, B goes back, LB/RB cycle tabs
  (function padMenus() {
    let prev = [], held = 0, lastDir = 0;
    const focusables = () => {
      const ov = overlay && !overlay.classList.contains('hidden') ? overlay : null;
      const scope = ov || (BL.game ? null : root);
      if (!scope) return [];
      return [...scope.querySelectorAll('[data-act]:not([disabled]), button:not([disabled]), input, select')].filter((e) => e.offsetParent !== null && e.getAttribute('data-act') !== 'noop');
    };
    const current = (list) => list.indexOf(document.querySelector('.pad-focus')) >= 0 ? document.querySelector('.pad-focus') : null;
    const setFocus = (el) => {
      document.querySelectorAll('.pad-focus').forEach((e) => e.classList.remove('pad-focus'));
      if (!el) return;
      el.classList.add('pad-focus');
      el.scrollIntoView && el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (el.focus) el.focus({ preventScroll: true });
    };
    const move = (dx, dy) => {
      const list = focusables();
      if (!list.length) return;
      const cur = current(list);
      if (!cur) { setFocus(list[0]); return; }
      const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
      let best = null, bestS = 1e9;
      for (const el of list) {
        if (el === cur) continue;
        const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
        const vx = bx - ax, vy = by - ay, along = vx * dx + vy * dy;
        if (along <= 4) continue;
        const across = Math.abs(vx * dy - vy * dx);
        const s = along + across * 2.2;
        if (s < bestS) { bestS = s; best = el; }
      }
      if (best) setFocus(best);
    };
    setInterval(() => {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      const gp = pads[0];
      if (!gp) return;
      const inMenu = !BL.game || (overlay && !overlay.classList.contains('hidden'));
      const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const pressed = (i) => btn(i) && !prev[i];
      // rebinding a controller button: the next press is the new binding, so the menu doesn't move or click
      if (BL.Input.capture) { prev = gp.buttons.map((b) => b.pressed); return; }
      // Back / View / Share opens the friends & party sidebar (like the real game)
      // (RT or Back / View, in the menus and while paused; F on the keyboard)
      if ((!BL.game || M.pauseOpen) && (pressed(8) || pressed(7)) && ACT.friends && M.screen !== 'title') ACT.friends();
      if (inMenu) {
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        const dir = btn(12) ? 1 : btn(13) ? 2 : btn(14) ? 3 : btn(15) ? 4 : ay < -0.6 ? 1 : ay > 0.6 ? 2 : ax < -0.6 ? 3 : ax > 0.6 ? 4 : 0;
        const now = performance.now();
        if (dir && (dir !== lastDir || now - held > 180)) { held = now; move(dir === 3 ? -1 : dir === 4 ? 1 : 0, dir === 1 ? -1 : dir === 2 ? 1 : 0); }
        lastDir = dir;
        if (pressed(0)) { const el = current(focusables()); if (el) el.click(); else move(0, 1); }
        if (pressed(1)) {
          if (overlay && !overlay.classList.contains('hidden') && !BL.game) M.closeOverlay();
          else if (BL.game && BL.game.paused) ACT.resume && ACT.resume();
          else if (!BL.game && M.screen !== 'main') ACT.back();
        }
        if (pressed(4) || pressed(5)) {
          // LB / RB: previous / next tab of the tab bar on screen (settings, garage, shop, challenges...), or page
          // along a long track (Rocket Pass)
          const scope = overlay && !overlay.classList.contains('hidden') ? overlay : root, dirn = pressed(5) ? 1 : -1;
          const group = [...scope.querySelectorAll('.st-tabs, .cz-tabs, .sh-tabs, .c2-tabs, .gtabs, .tabs, .cats')].find((g) => g.offsetParent !== null);
          const tabs = group ? [...group.querySelectorAll('[data-act]')].filter((e) => e.offsetParent !== null) : [];
          if (tabs.length > 1) {
            const on = Math.max(0, tabs.findIndex((e) => e.classList.contains('on')));
            tabs[(on + dirn + tabs.length) % tabs.length].click();
            BL.Audio.play('hover');
          } else {
            if (scope.querySelector('.rp-pager') && ACT.rpPage) ACT.rpPage(String(dirn));
            else { const sc = scope.querySelector('.rp-track'); if (sc) sc.scrollBy({ left: dirn * sc.clientWidth * 0.8, behavior: 'smooth' }); }
          }
        }
      }
      prev = gp.buttons.map((b) => b.pressed);
    }, 33);
  })();

  M.toast = function (text) {
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(M._tt);
    M._tt = setTimeout(() => toastEl.classList.remove('on'), 2800);
  };

  M.openOverlay = function (html, cls) {
    overlay.className = 'overlay ' + (cls || '');
    overlay.innerHTML = html;
    overlay.classList.remove('hidden');
  };
  M.closeOverlay = function () { overlay.classList.add('hidden'); overlay.innerHTML = ''; M.pauseOpen = false; };

  M.confirm = function (text, onYes, yesLabel) {
    M._confirm = onYes;
    M.openOverlay(`<div class="dlg"><p>${text}</p><div class="row"><button class="mbtn" data-act="confirmNo">CANCEL</button><button class="mbtn primary" data-act="confirmYes">${yesLabel || 'CONFIRM'}</button></div></div>`);
  };
  ACT.confirmYes = () => { const f = M._confirm; M.closeOverlay(); if (f) f(); };
  ACT.confirmNo = () => M.closeOverlay();

  // ---------- shared bits ----------
  function topbar() {
    const p = S.p;
    const need = S.xpForLevel(p.level);
    const title = S.itemDef((S.entry(p.loadout.title) || {}).id);
    const back = M.screen !== 'main' ? `<button class="back" data-act="back">‹ BACK</button>` : '';
    return `<div class="topbar">${back}
      <div class="tb-logo" data-act="go" data-arg="main">ROCKET<b>LEAGUE</b></div>
      <div class="tb-sp"></div>
      <div class="tb-chip credits" title="Credits"><i class="cr"></i>${p.credits}</div>
      <div class="tb-chip" data-act="go" data-arg="drops" title="Unopened drops">DROPS ${p.drops.length}</div>
      <div class="tb-player" data-act="go" data-arg="profile">
        <div class="tb-name">${esc(p.name)} <span class="lvl">LV ${p.level}</span></div>
        <div class="tb-title">${title ? esc(title.text) : ''}</div>
        <div class="tb-xp"><i style="width:${Math.round((p.xp / need) * 100)}%"></i></div>
      </div></div>`;
  }

  const thumbCache = {}, thumb3d = {};
  // 3D body renders cost a few frames each on slow devices: show the silhouette first and
  // swap the render in when it's ready, one per tick
  const thumbQueue = [];
  let thumbPump = 0, lastInput = 0;
  // ...and they're kept between visits (IndexedDB), so each picture is only ever drawn once. Bump THUMB_VER when the
  // pictures change and they're all drawn again.
  const THUMB_VER = 'v1|';
  const thumbDB = (() => {
    let opening = null;
    const open = () => opening || (opening = new Promise((ok) => {
      try {
        const rq = indexedDB.open('bl-item-pictures', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('p');
        rq.onsuccess = () => ok(rq.result);
        rq.onerror = rq.onblocked = () => ok(null);
      } catch (e) { ok(null); }
    }));
    const req = (mode, fn) => open().then((db) => db && new Promise((ok) => {
      try { const r = fn(db.transaction('p', mode).objectStore('p')); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); }
    }));
    return { get: (k) => req('readonly', (s) => s.get(THUMB_VER + k)), put: (k, v) => req('readwrite', (s) => s.put(v, THUMB_VER + k)) };
  })();
  // drawing one stalls the screen for a moment (a lot on old Chromebooks), so it waits until you stop scrolling or
  // clicking, and rests twice as long as the last one took before the next
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) window.addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true, capture: true });
  function queue3D(key, def, pc, paint) {
    if (thumbQueue.some((j) => j.key === key)) return;
    thumbQueue.push({ key, def, pc, paint, t0: performance.now() });
    if (!thumbPump) thumbPump = setTimeout(pump3D, 60);
  }
  function showThumb(key, url) {
    thumbCache[key] = url;
    document.querySelectorAll('img[data-thumb="' + key + '"]').forEach((im) => { im.src = url; im.removeAttribute('data-thumb'); im.classList.add('r3d'); });
  }
  async function pump3D() {
    // newest first: whatever is on screen now renders before an earlier screen's leftovers
    const j = thumbQueue[thumbQueue.length - 1];
    if (!j) { thumbPump = 0; return; }
    // already drawn on an earlier visit
    const kept = await thumbDB.get(j.key);
    if (kept) { thumbQueue.splice(thumbQueue.indexOf(j), 1); showThumb(j.key, kept); thumbPump = setTimeout(pump3D, 0); return; }
    if (performance.now() - lastInput < 300 && performance.now() - j.t0 < 4000) { thumbPump = setTimeout(pump3D, 150); return; }
    thumbQueue.splice(thumbQueue.indexOf(j), 1);
    let url = null;
    try { url = BL.Models.itemThumb ? await BL.Models.itemThumb(j.def, j.paint) : BL.Models.bodyThumb(j.def, j.pc); } catch (e) { url = null; }
    if (url) { showThumb(j.key, url); thumbDB.put(j.key, url); }
    thumbPump = thumbQueue.length ? setTimeout(pump3D, U.clamp(2 * (BL.Models.lastThumbMs || 0), 20, 1500)) : 0;
  }
  function thumb(def, paint) {
    const pc = paint ? BL.PAINT_BY_ID[paint].color : null;
    let key = def.id + ':' + (paint || '');
    // a miniature 3D render of the real item (drawn placeholder until it's ready); parts are shown on your car
    const r3 = BL.Models.canItemThumb && BL.Models.canItemThumb(def);
    if (r3 && def.cat !== 'body' && def.cat !== 'explosion') key += '@' + ((S.resolveLoadout().body || {}).id || '');
    if (r3 && def.cat === 'explosion') key += '@x2';
    if (r3 && (def.cat === 'boost' || def.cat === 'wheeldecal')) key += '@b2'; // (redrawn: new boost and wheel decal looks)
    if (r3 && (def.cat === 'topper' || def.cat === 'antenna')) key += '@t3'; // (redrawn: toppers and antennas on their own, big)
    if (thumbCache[key]) return `<img class="${thumb3d[key] ? 'r3d' : ''}" src="${thumbCache[key]}" alt="">`;
    if (r3) {
      queue3D(key, def, pc, paint);
      thumb3d[key] = 1;
      let ph = '';
      try { ph = def.cat === 'body' ? silhouette(def, pc) : def.cat === 'wheels' ? rimThumb(def, pc) : def.cat === 'boost' ? boostThumb(def, pc) : def.cat === 'explosion' ? boomThumb(def, pc) : ''; } catch (e) { ph = ''; }
      return `<img data-thumb="${key}" src="${ph || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}" alt="">`;
    }
    let url = null;
    try {
      if (def.cat === 'body') url = silhouette(def, pc);
      else if (def.cat === 'decal') {
        const src = BL.Models.decalCanvas(def.pattern, BL.TEAM_MAIN[0], pc || '#f5f5f5', null, pc);
        const { c, g } = U.canvas(128, 64); g.drawImage(src, 0, 0, 128, 64); url = c.toDataURL();
      } else if (def.cat === 'wheels') url = rimThumb(def, pc);
      else if (def.cat === 'wheeldecal') {
        const { c, g } = U.canvas(80, 80);
        const gr = g.createRadialGradient(40, 40, 8, 40, 40, 38); gr.addColorStop(0, '#5a5f6a'); gr.addColorStop(0.55, '#2a2d33'); gr.addColorStop(1, '#141518');
        g.fillStyle = gr; g.beginPath(); g.arc(40, 40, 38, 0, Math.PI * 2); g.fill();
        if (def.ring !== 'none') g.drawImage(BL.Models.wheelDecalCanvas(def, pc || def.color || '#f5f5f5'), 1, 1, 78, 78);
        url = c.toDataURL();
      }
      else if (def.cat === 'boost') url = boostThumb(def, pc);
      else if (def.cat === 'explosion') url = boomThumb(def, pc);
      else if (def.cat === 'finish') url = finishThumb(def, pc);
    } catch (e) { url = null; }
    if (url) { thumbCache[key] = url; return `<img src="${url}" alt="">`; }
    if (def.cat === 'topper') return `<span class="emo">${BL.ICON('topper', 44)}</span>`;
    if (def.cat === 'antenna') return `<span class="emo">${BL.ICON('antenna', 44)}</span>`;
    if (def.cat === 'title') return `<span class="ttl ${def.glow ? 'glow' : ''}" ${def.color ? `style="color:${def.color}"` : ''}>${esc(def.text)}</span>`;
    return `<span class="emo">${BL.ICON(def.cat, 44)}</span>`;
  }
  function silhouette(def, pc) {
    const st = BL.Models.STYLES[def.style];
    const { c, g } = U.canvas(160, 80);
    const sc = 160 / 1.6;
    const tx = (u) => 80 + u * sc, ty = (h) => 72 - h * sc;
    const shapeOf = (sh) => sh.getPoints(8);
    // reuse model shape builders via a temporary CarModel would be heavy; draw simple profile
    const L2 = st.L / 2;
    g.fillStyle = pc || '#2f7bff';
    g.beginPath();
    g.moveTo(tx(-L2), ty(st.bottom));
    g.lineTo(tx(L2), ty(st.bottom));
    g.lineTo(tx(L2), ty(st.nose.h));
    g.quadraticCurveTo(tx((L2 + st.hoodU) / 2), ty(U.lerp(st.nose.h, st.belt, 0.85)), tx(st.hoodU), ty(st.belt));
    if (st.cabin) {
      const cb = st.cabin;
      g.lineTo(tx(cb.ws), ty(st.belt));
      g.quadraticCurveTo(tx(U.lerp(cb.ws, cb.rf, 0.3)), ty(U.lerp(st.belt, cb.roof, 0.78)), tx(cb.rf), ty(cb.roof));
      g.lineTo(tx(cb.rr), ty(cb.roof - 0.01));
      g.quadraticCurveTo(tx(U.lerp(cb.rr, cb.rw, 0.3)), ty(U.lerp(cb.roof, st.deck.h, 0.25)), tx(cb.rw), ty(st.deck.h));
    } else g.lineTo(tx(st.deck.u), ty(st.deck.h));
    g.lineTo(tx(st.deck.u), ty(st.deck.h));
    g.lineTo(tx(-L2), ty(st.tail.h));
    g.closePath(); g.fill();
    if (st.cabin) {
      g.fillStyle = 'rgba(10,20,40,0.85)';
      const cb = st.cabin;
      g.beginPath();
      g.moveTo(tx(cb.ws - 0.03), ty(st.belt + 0.02));
      g.lineTo(tx(cb.rf - 0.01), ty(cb.roof - 0.03));
      g.lineTo(tx(cb.rr + 0.01), ty(cb.roof - 0.04));
      g.lineTo(tx(cb.rw + 0.04), ty(st.deck.h + 0.02));
      g.closePath(); g.fill();
    }
    g.fillStyle = '#111';
    for (const w of [st.f, st.r]) { g.beginPath(); g.arc(tx(w.u), ty(w.r), w.r * sc, 0, Math.PI * 2); g.fill(); g.fillStyle = '#bbb'; g.beginPath(); g.arc(tx(w.u), ty(w.r), w.r * sc * 0.55, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; }
    void shapeOf;
    return c.toDataURL();
  }
  function rimThumb(def, pc) {
    const { c, g } = U.canvas(80, 80);
    const r = def.rim;
    g.fillStyle = '#151515'; g.beginPath(); g.arc(40, 40, 36, 0, Math.PI * 2); g.fill();
    g.fillStyle = pc || r.color; g.beginPath(); g.arc(40, 40, 25, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(40, 40, 21, 0, Math.PI * 2); g.fill();
    g.strokeStyle = pc || r.color; g.lineWidth = r.style === 'tri' ? 9 : 4;
    const n = r.spokes || 5;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.beginPath(); g.moveTo(40, 40); g.lineTo(40 + Math.cos(a) * 22, 40 + Math.sin(a) * 22); g.stroke(); }
    if (r.glow) { g.strokeStyle = pc || r.glow; g.lineWidth = 3; g.shadowColor = r.glow; g.shadowBlur = 8; g.beginPath(); g.arc(40, 40, 23, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0; }
    g.fillStyle = '#ccc'; g.beginPath(); g.arc(40, 40, 5, 0, Math.PI * 2); g.fill();
    return c.toDataURL();
  }
  function boostThumb(def, pc) {
    const { c, g } = U.canvas(128, 64);
    const cols = def.fx.special === 'rainbow' ? ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#d500f9'] : (pc ? [pc, U.shade(pc, -0.4)] : def.fx.colors);
    const gr = g.createLinearGradient(120, 0, 0, 0);
    cols.forEach((cc, i) => gr.addColorStop(i / Math.max(1, cols.length - 1), cc));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(124, 26); g.quadraticCurveTo(60, 10, 6, 32); g.quadraticCurveTo(60, 54, 124, 38); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 12; i++) { const x = 10 + Math.random() * 100; g.beginPath(); g.arc(x, 32 + (Math.random() - 0.5) * 20 * (1 - x / 128), 1 + Math.random() * 2, 0, 7); g.fill(); }
    return c.toDataURL();
  }
  const BOOM_COL = { chomp: ['#ff6f91', '#3a0612'], shark: ['#bfe8ff', '#0b4a6e'], petals: ['#ffd1e3', '#ff6fa8'], encore: ['#7df9ff', '#ff5ad1'], snowstorm: ['#ffffff', '#80d8ff'], starburst: ['#fff59d', '#ff9800'], pixelblast: ['#00e676', '#d500f9'], classic: ['#ffe08a', '#ff7a1f'], shockwave: ['#ffffff', '#2f7bff'], confetti: ['#ff1744', '#00e676'], ice: ['#e0f7fa', '#4fc3f7'], fireworks: ['#ffea00', '#d500f9'], toon: ['#ffeb3b', '#ff4081'], hearts: ['#ff80ab', '#f50057'], glitch: ['#00ff66', '#111111'], meteor: ['#ffcc80', '#ff5722'], supernova: ['#ffffff', '#7c4dff'], thunder: ['#ffffff', '#40c4ff'], hellfire: ['#ffeb3b', '#d50000'], blackhole: ['#000000', '#ea80fc'], dragons: ['#ffeb3b', '#d50000'], rainbow: ['#ff1744', '#2979ff'], ignition: ['#ffea00', '#ff6d00'], tornado: ['#cfd8dc', '#546e7a'],
    kraken: ['#7fd4ff', '#5b2a86'], ufo: ['#8ff3ff', '#3d4a5a'], volcano: ['#ffb24a', '#5a2a18'], goldrush: ['#fff1b0', '#ffc21a'], crystal: ['#e8fbff', '#5fc8ff'], disco: ['#ff2bd6', '#2bf0ff'] };
  function boomThumb(def, pc) {
    const { c, g } = U.canvas(80, 80);
    const cols = BOOM_COL[def.fx] || ['#fff', '#f80'];
    const gr = g.createRadialGradient(40, 40, 2, 40, 40, 38);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, pc || cols[0]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 80, 80);
    g.strokeStyle = pc || cols[1]; g.lineWidth = 3;
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.beginPath(); g.moveTo(40 + Math.cos(a) * 14, 40 + Math.sin(a) * 14); g.lineTo(40 + Math.cos(a) * 36, 40 + Math.sin(a) * 36); g.stroke(); }
    return c.toDataURL();
  }
  function finishThumb(def, pc) {
    const { c, g } = U.canvas(80, 80);
    const base = pc || '#3f7cff';
    const gr = g.createRadialGradient(30, 26, 2, 40, 40, 36);
    gr.addColorStop(0, def.rough < 0.3 ? '#ffffff' : U.shade(base, 0.3)); gr.addColorStop(0.35, base); gr.addColorStop(1, U.shade(base, def.metal > 0.6 ? -0.8 : -0.5));
    g.fillStyle = gr; g.beginPath(); g.arc(40, 40, 34, 0, Math.PI * 2); g.fill();
    if (def.irid) { const ir = g.createLinearGradient(0, 0, 80, 80); ir.addColorStop(0, 'rgba(255,0,200,0.35)'); ir.addColorStop(0.5, 'rgba(0,255,200,0.3)'); ir.addColorStop(1, 'rgba(255,255,0,0.3)'); g.fillStyle = ir; g.beginPath(); g.arc(40, 40, 34, 0, Math.PI * 2); g.fill(); }
    if (def.glitter) { g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) g.fillRect(14 + Math.random() * 52, 14 + Math.random() * 52, 1.5, 1.5); }
    return c.toDataURL();
  }

  function itemCard(def, o) {
    o = o || {};
    const rar = R(def.rarity);
    const paint = o.paint ? BL.PAINT_BY_ID[o.paint] : null;
    const cert = o.cert ? BL.CERT_BY_ID[o.cert] : null;
    const act = o.act ? `data-act="${o.act}" data-arg="${esc(o.arg || '')}"` : '';
    return `<div class="icard ${o.eq ? 'eq' : ''} ${o.locked ? 'locked' : ''} ${o.sel ? 'sel' : ''} ${o.cls || ''}" style="--rc:${rar.color}" ${act} title="${esc(o.tip || '')}">
      <div class="ic-thumb">${thumb(def, o.paint)}</div>
      <div class="ic-name">${esc(def.name)}</div>
      <div class="ic-sub">${rar.name}${o.showCat ? ' ' + esc(catName(def.cat)) : ''}</div>
      ${paint ? `<div class="ic-paint" style="--pc:${paint.color}">${esc(paint.name)}</div>` : ''}
      ${cert ? `<div class="ic-cert">${esc(cert.name)}${o.certN ? ' · ' + o.certN : ''}</div>` : ''}
      ${o.qty > 1 ? `<i class="ic-qty">×${o.qty}</i>` : ''}${o.isNew ? '<i class="ic-new">NEW</i>' : ''}${o.eq ? '<i class="ic-eq">' + BL.ICON('check', 14) + '</i>' : ''}${o.locked ? '<i class="ic-lock">' + BL.ICON('lock', 14) + '</i>' : ''}${o.price ? `<div class="ic-price"><i class="cr"></i>${o.price}</div>` : ''}
    </div>`;
  }
  const catName = (id) => (BL.CATEGORIES.find((c) => c.id === id) || {}).name || id;

  function rankBadge(mmr, big) {
    const r = S.rankInfo(mmr);
    return `<div class="rank ${big ? 'big' : ''}" style="--rk:${r.color}"><div class="rk-hex"><span>${'I'.repeat(r.div + 1).replace('III', 'III')}</span></div><div class="rk-name">${r.full}</div><div class="rk-mmr">${Math.round(mmr)} MMR</div></div>`;
  }

  function sel(name, opts, val, attr) {
    return `<select ${attr}>${opts.map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
  }

  function seg(act, opts, val) {
    return `<div class="seg">${opts.map((o) => `<button class="${String(o[0]) === String(val) ? 'on' : ''} ${o[2] ? 'disabled' : ''}" data-act="${act}" data-arg="${esc(o[0])}" title="${esc(o[3] || '')}">${esc(o[1])}${o[2] ? ' ' + BL.ICON('lock', 12) : ''}</button>`).join('')}</div>`;
  }

  function mapCards(act, current) {
    return `<div class="maps">${BL.MAPS.map((m) => {
      const locked = !S.isMapUnlocked(m.id);
      return `<div class="mapc ${m.id === current ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="${locked ? 'lockedMap' : act}" data-arg="${m.id}" style="--s0:${m.sky[0]};--s1:${m.sky[1]};--fl:${m.floor.a}">
        <div class="mapc-sky"></div><div class="mapc-floor"></div>${mapPic(m)}
        <div class="mapc-name">${esc(m.name)}${m.labs ? ' <small>LABS</small>' : ''}</div></div>`;
    }).join('')}</div>`;
  }
  // aerial 3D shot of an arena for its map card; built one at a time after the menu is shown, then cached
  const mapPics = {}, mapQueue = [];
  function mapPic(m) {
    if (BL.App.potato) return '';
    if (mapPics[m.id]) return `<img class="mapc-pic" src="${mapPics[m.id]}" alt="">`;
    if (mapQueue.indexOf(m.id) < 0) { mapQueue.push(m.id); if (mapQueue.length === 1) setTimeout(renderMapPic, 250); }
    return `<img class="mapc-pic" data-mappic="${m.id}" alt="" hidden>`;
  }
  function renderMapPic() {
    const id = mapQueue[0];
    if (!id || BL.game) { mapQueue.length = 0; return; }
    let url = null;
    try { url = shootArena(BL.MAP_BY_ID[id]); } catch (e) { console.warn('[menu] map picture failed', id, e); }
    mapQueue.shift();
    if (url) {
      mapPics[id] = url;
      document.querySelectorAll('img[data-mappic="' + id + '"]').forEach((im) => { im.src = url; im.hidden = false; im.removeAttribute('data-mappic'); });
    }
    if (mapQueue.length) setTimeout(renderMapPic, 120);
  }
  function shootArena(map) {
    const r = BL.App.renderer, W = 512, H = 288;
    BL.Physics.setArena(map.arena || null);
    const scene = new THREE.Scene();
    const arena = BL.Arena.build(scene, map, BL.Physics.padLayout());
    const cam = new THREE.PerspectiveCamera(50, W / H, 0.5, 2000);
    const A = BL.Physics.arena;
    // (from a corner, under the stadium roof so its lattice doesn't cross the picture)
    cam.position.set(A.hw * 0.85, A.h * 1.45, -A.hl * 1.25); cam.lookAt(0, 0, -A.hl * 0.05);
    if (arena.sky) arena.sky.position.copy(cam.position);
    const rt = new THREE.WebGLRenderTarget(W, H);
    rt.texture.encoding = THREE.sRGBEncoding;
    const prev = r.getRenderTarget();
    r.setRenderTarget(rt); r.clear(); r.render(scene, cam);
    const px = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(rt, 0, 0, W, H, px);
    r.setRenderTarget(prev);
    rt.dispose(); arena.dispose();
    BL.Physics.setArena(null);
    const { c, g } = U.canvas(W, H), img = g.createImageData(W, H), row = W * 4;
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.82);
  }
  ACT.lockedMap = (id) => M.toast('Reach level ' + S.mapUnlockLevel(id) + ' to unlock ' + BL.MAP_BY_ID[id].name + '.');

  function mutatorSelects(muts, attrName, disabled) {
    return `<div class="muts">${Object.keys(BL.MUTATORS).map((k) => `<label>${BL.MUTATORS[k].name}${sel(k, BL.MUTATORS[k].opts, muts[k], `data-${attrName}="${k}" ${disabled ? 'disabled' : ''}`)}</label>`).join('')}</div>`;
  }

  // ---------- navigation ----------
  const HISTORY = [];
  ACT.go = (name) => { if (M.screen && M.screen !== name) HISTORY.push(M.screen); M.show(name); };
  ACT.back = () => {
    if (M.screen === 'lobby') { M.confirm('Leave this lobby?', () => { BL.Net.leave(); HISTORY.length = 0; M.show('online'); }, 'LEAVE'); return; }
    M.show(HISTORY.pop() || 'main');
  };

  // ---------- SCREENS ----------
  const SCREENS = {}, AFTER = {};

  // right-hand party panel: you, your party (online lobby members) and invite slots
  function partySide() {
    const p = S.p, L = BL.Net && BL.Net.lobby;
    const best = Math.max(p.mmr.duel || 0, p.mmr.doubles || 0, p.mmr.standard || 0);
    const members = L ? L.players.filter((x) => x.pid !== BL.Net.myPid) : [];
    const initials = (n) => esc(String(n || '?').slice(0, 2).toUpperCase());
    const slot = (m) => m ? `<div class="ps-slot"><i class="ps-av">${initials(m.name)}</i><b>${esc(m.name)}</b></div>` : `<div class="ps-slot empty" data-act="go" data-arg="online"><i class="ps-av">+</i><b>INVITE</b></div>`;
    const slots = [0, 1].map((i) => slot(members[i]));
    return `<div class="card party-side">
      <div class="ps-me" data-act="go" data-arg="profile"><i class="ps-av me">${initials(p.name)}</i><div><b>${esc(p.name)}</b><small>LV ${p.level}</small></div>${rankBadge(best)}</div>
      <h3>PARTY <small>${1 + members.length}/3</small></h3>${slots.join('')}
      <button class="mbtn" data-act="go" data-arg="online">${L ? 'PARTY LOBBY' : 'CREATE PARTY'}</button>
    </div>`;
  }

  SCREENS.main = () => {
    const p = S.p;
    const ch = S.challenges();
    const unseen = S.unseenCount();
    return `<div class="m-left">
      <button class="mbtn big primary" data-act="go" data-arg="play">PLAY</button>
      <button class="mbtn" data-act="go" data-arg="garage">GARAGE</button>
      <button class="mbtn" data-act="go" data-arg="pass">ROCKET PASS <em>TIER ${p.pass.tier}</em></button>
      <button class="mbtn" data-act="go" data-arg="drops">DROPS ${p.drops.length ? `<em class="hot">${p.drops.length}</em>` : ''}</button>
      <button class="mbtn" data-act="go" data-arg="shop">ITEM SHOP</button>
      <button class="mbtn" data-act="go" data-arg="inventory">INVENTORY ${unseen ? `<em class="hot">${unseen} NEW</em>` : ''}</button>
      <button class="mbtn" data-act="go" data-arg="tradein">TRADE-IN</button>
      <button class="mbtn" data-act="go" data-arg="profile">CAREER</button>
      <button class="mbtn" data-act="go" data-arg="settings">SETTINGS</button>
    </div>
    <div class="m-side">
      ${partySide()}
      <div class="card news">
        <h3>CHALLENGES</h3>
        ${ch.map((c) => `<div class="chal ${c.done ? 'done' : ''}"><div>${esc(c.desc)} <small>+${c.xp} XP</small></div><div class="bar"><i style="width:${Math.round((c.progress / c.goal) * 100)}%"></i></div><small>${c.progress}/${c.goal}</small></div>`).join('')}
      </div>
      <div class="card news pass-mini" data-act="go" data-arg="pass">
        <h3>${esc(BL.PASS.name)}</h3>
        <div class="bar big"><i style="width:${Math.round((p.pass.xp / BL.PASS.xpPerTier) * 100)}%"></i></div>
        <small>Tier ${p.pass.tier} / ${BL.PASS.tiers} ${p.pass.premium ? '• PREMIUM' : '• Free track'}</small>
      </div>
    </div>`;
  };

  SCREENS.play = () => {
    const tile = (act, arg, title, desc, cls, extra) => `<div class="tile ${cls || ''}" data-act="${act}" data-arg="${arg || ''}"><div class="tile-t">${title}</div><div class="tile-d">${desc}</div>${extra || ''}</div>`;
    const best = Math.max(S.p.mmr.duel, S.p.mmr.doubles, S.p.mmr.standard);
    return `<div class="tiles">
      ${tile('go', 'online', 'ONLINE', '', 't-online')}
      ${tile('go', 'ranked', 'COMPETITIVE', '', 't-ranked', rankBadge(best))}
      ${tile('exhib', 'soccar', 'PRIVATE MATCH', '', 't-exhib')}
      ${tile('exhib', 'rumble', 'EXTRA MODES', '', 't-extra')}
      ${tile('freeplay', '', 'FREE PLAY', '', 't-free')}
    </div>`;
  };

  ACT.exhib = (mode) => {
    if (mode !== 'soccar' && !S.isModeUnlocked(mode)) mode = 'soccar';
    M.ex.mode = mode;
    ACT.go('exhibition');
  };
  ACT.freeplay = () => {
    const map = S.isMapUnlocked(M.ex.map) ? M.ex.map : 'champions';
    startLocal({ mode: 'freeplay', size: 1, skill: 0.5, team: 0, map, mutators: BL.defaultMutators() });
  };

  SCREENS.exhibition = () => {
    const ex = M.ex;
    const modes = ['soccar', 'rumble', 'heatseeker', 'freeplay'].map((m) => [m, BL.MODES[m].name, !S.isModeUnlocked(m), S.isModeUnlocked(m) ? BL.MODES[m].desc : 'Unlocks at level ' + S.modeUnlockLevel(m)]);
    return `<div class="panel wide">
      <h2>PRIVATE MATCH</h2>
      <div class="form">
        <label>Mode</label>${seg('exMode', modes, ex.mode)}
        <label>Team Size</label>${seg('exSize', [[1, '1v1'], [2, '2v2'], [3, '3v3'], [4, '4v4 Chaos']], ex.size)}
        <label>Bot Difficulty</label>${seg('exSkill', [[0.2, 'Rookie'], [0.5, 'Pro'], [0.85, 'All-Star']], ex.skill)}
        <label>Your Team</label>${seg('exTeam', [[0, 'Blue'], [1, 'Orange']], ex.team)}
        ${ex.mode !== 'freeplay' ? `<label>Splitscreen <small>(Player 2 uses a controller)</small></label>${seg('exSplit', [[0, 'Off'], [1, 'P2 same team'], [2, 'P2 other team']], ex.split || 0)}` : ''}
      </div>
      <h3>MAP</h3>${mapCards('exMap', ex.map)}
      <h3>MUTATORS</h3>${mutatorSelects(ex.mutators, 'ex')}
      <div class="row end"><button class="mbtn" data-act="exReset">RESET MUTATORS</button><button class="mbtn big primary" data-act="exStart">START MATCH</button></div>
    </div>`;
  };
  ACT.exMode = (v) => { if (!S.isModeUnlocked(v)) { M.toast('Unlocks at level ' + S.modeUnlockLevel(v)); return; } M.ex.mode = v; M.render(); };
  ACT.exSize = (v) => { M.ex.size = +v; M.render(); };
  ACT.exSkill = (v) => { M.ex.skill = +v; M.render(); };
  ACT.exTeam = (v) => { M.ex.team = +v; M.render(); };
  ACT.exSplit = (v) => { M.ex.split = +v; if (+v === 1 && M.ex.size < 2) M.ex.size = 2; M.render(); };
  ACT.exMap = (v) => { M.ex.map = v; M.render(); };
  ACT.exReset = () => { M.ex.mutators = BL.defaultMutators(); M.render(); };
  ACT.exStart = () => startLocal(M.ex);

  function botPlayers(team, count, skill, idStart, used) {
    const out = [];
    for (let i = 0; i < count; i++) {
      let name = U.choice(BL.BOT_NAMES);
      while (used.has(name)) name = U.choice(BL.BOT_NAMES);
      used.add(name);
      out.push({ id: idStart + i, name, team, isBot: true, skill: U.clamp(skill + U.rand(-0.06, 0.06), 0.03, 1), loadout: S.randomLoadout() });
    }
    return out;
  }

  function startLocal(ex, ranked) {
    const lo = S.resolveLoadout();
    const players = [{ id: 0, name: S.p.name, team: ex.team, isLocal: true, loadout: lo }];
    const used = new Set([S.p.name]);
    // splitscreen: a second local player (controller) on your team or the other one
    const sp = ex.split || (M.p2 && ex.size >= 2 ? 1 : 0);
    const split = !ranked && sp ? (sp === 1 || ex.mode === 'freeplay' ? ex.team : 1 - ex.team) : -1;
    if (split >= 0) players.push({ id: 1, name: 'Player 2', team: split, isLocal2: true, loadout: Object.assign({}, lo, { body: lo.body }) });
    if (ex.mode !== 'freeplay') {
      let id = players.length;
      for (const team of [0, 1]) {
        const need = Math.max(0, ex.size - players.filter((p) => p.team === team).length);
        const skill = ranked ? ranked.skills[team === ex.team ? 0 : 1] : ex.skill;
        const bots = botPlayers(team, need, skill, id, used);
        id += bots.length;
        players.push(...bots);
      }
    }
    const cfg = { mode: ex.mode, mapId: ex.map, mutators: Object.assign({}, ex.mutators), players, ranked: ranked ? { playlist: ranked.playlist } : null, botSkill: ex.skill };
    M.lastCfg = { ex: Object.assign({}, ex, { mutators: Object.assign({}, ex.mutators) }), ranked };
    BL.App.startMatch(cfg);
  }

  // ---------- RANKED ----------
  SCREENS.ranked = () => {
    const p = S.p;
    return `<div class="panel wide"><h2>COMPETITIVE</h2>
      <div class="tiles three">${BL.PLAYLISTS.map((pl) => {
        const mmr = p.mmr[pl.id];
        return `<div class="tile ranked-card" data-act="rankedGo" data-arg="${pl.id}"><div class="tile-t">${pl.name.toUpperCase()}</div><div class="tile-d">${pl.size}v${pl.size}</div>${rankBadge(mmr, true)}<button class="mbtn primary">FIND MATCH</button></div>`;
      }).join('')}</div></div>`;
  };
  ACT.rankedGo = (plId) => {
    const pl = BL.PLAYLISTS.find((x) => x.id === plId);
    const mmr = S.p.mmr[plId];
    const skill = S.botSkillForMMR(mmr);
    const maps = BL.MAPS.filter((m) => !m.labs && S.isMapUnlocked(m.id));
    const map = U.choice(maps).id;
    const team = Math.random() < 0.5 ? 0 : 1;
    M.openOverlay(`<div class="dlg search"><div class="spinner"></div><h3>FINDING ${pl.name.toUpperCase()} MATCH</h3><p class="muted" id="srchTxt">Searching for ranked bots near ${S.rankInfo(mmr).full}...</p><button class="mbtn" data-act="cancelSearch">CANCEL</button></div>`);
    clearTimeout(M._search);
    M._search = setTimeout(() => {
      const t = document.getElementById('srchTxt');
      if (t) t.textContent = 'Match found! Joining ' + BL.MAP_BY_ID[map].name + '...';
      M._search = setTimeout(() => {
        M.closeOverlay();
        startLocal({ mode: 'soccar', size: pl.size, skill, team, map, mutators: BL.defaultMutators() }, { playlist: plId, skills: [skill * 0.95, skill * 1.03] });
      }, 900);
    }, 1200 + Math.random() * 1600);
  };
  ACT.cancelSearch = () => { clearTimeout(M._search); M.closeOverlay(); };

  // ---------- ONLINE ----------
  M.onPl = 'doubles';
  const CASUAL = [['duel', 'Duel 1v1'], ['doubles', 'Doubles 2v2'], ['standard', 'Standard 3v3'], ['chaos', 'Chaos 4v4'], ['rumble', 'Rumble 3v3'], ['heatseeker', 'Heatseeker 2v2']];
  SCREENS.online = () => {
    const N = BL.Net, sv = N.srv, o = M.on;
    const on = sv.status === 'on';
    const party = sv.party;
    const leader = !party || party.leader === sv.pid;
    const status = on ? `<span class="dot on"></span>Connected • ${sv.online} online • ${sv.matches || 0} matches`
      : sv.status === 'connecting' ? '<span class="dot wait"></span>Connecting…' : '<span class="dot"></span>Not connected';
    const p2p = N.available();
    const pub = M.publicList;
    return `<div class="panel wide online">
      <div class="on-head"><h2>ONLINE</h2><div class="srv-status">${status}</div></div>
      <div class="form"><label>Name</label><input id="nameIn" maxlength="16" value="${esc(S.p.name)}"><button class="mbtn" data-act="saveName">SAVE</button></div>
      ${on ? '' : `<details class="srv-card"><summary>DEDICATED SERVER (optional)</summary>
        <div class="form"><label>Server address</label><input id="srvIn" placeholder="wss://your-server.example.com/ws" value="${esc(S.p.settings.serverUrl || N.serverUrl())}"><button class="mbtn" data-act="srvConnect">CONNECT</button></div></details>`}
      <div class="cols">
        <div class="card">
          <h3>PARTY</h3>
          ${on ? (party ? `<div class="party-code" data-act="copyParty" title="Click to copy">${esc(party.code)}</div>
            <div class="party-list">${party.members.map((m) => `<div class="lp ${m.pid === sv.pid ? 'me' : ''}"><b>${m.pid === party.leader ? BL.ICON('crown', 14) + ' ' : ''}${esc(m.name)}</b><small>LV ${m.level || 1}</small>${leader && m.pid !== sv.pid ? `<button class="mini" data-act="partyKick" data-arg="${esc(m.pid)}">KICK</button>` : ''}</div>`).join('')}</div>
            <div class="row"><button class="mbtn" data-act="partyLeave">LEAVE PARTY</button></div>`
            : `<div class="row"><button class="mbtn primary" data-act="partyCreate">CREATE PARTY</button></div>
            <div class="form"><input id="partyIn" maxlength="6" placeholder="Party code" style="text-transform:uppercase"><button class="mbtn" data-act="partyJoin">JOIN</button></div>`)
            : '<div class="muted">Parties need the dedicated server. Without one, share a room code below to play together.</div>'}
        </div>
        <div class="card">
          <h3>CASUAL</h3>
          ${seg('onPl', CASUAL, M.onPl)}
          <div class="row"><button class="mbtn big primary" data-act="search" data-arg="0" ${leader ? '' : 'disabled'}>SEARCH</button></div>
          ${on ? '' : '<div class="muted small">No server needed — you will join an open match or host one automatically. Bots fill any empty seats.</div>'}
          <h3>COMPETITIVE</h3>
          <div class="ranked-row">${BL.PLAYLISTS.map((pl) => `<button class="rk-btn" data-act="searchRanked" data-arg="${pl.id}" ${leader ? '' : 'disabled'}>${rankBadge(S.p.mmr[pl.id])}<b>${pl.name}</b></button>`).join('')}</div>
          ${party && !leader ? '<div class="muted small">The party leader starts the search.</div>' : ''}
        </div>
        <div class="card">
          <h3>PRIVATE MATCH</h3>
          <div class="row"><button class="mbtn primary" data-act="roomCreate" ${on ? '' : 'disabled'}>CREATE</button></div>
          <div class="form"><input id="roomIn" maxlength="6" placeholder="Match code" style="text-transform:uppercase"><button class="mbtn" data-act="roomJoin" ${on ? '' : 'disabled'}>JOIN</button></div>
        </div>
      </div>
      <details class="p2p" ${on ? '' : 'open'}><summary>PEER-TO-PEER (no server needed)</summary>
        <div class="cols">
          <div class="card"><h3>HOST</h3>
            <div class="form">
              <label>Mode</label>${seg('onMode', ['soccar', 'rumble', 'heatseeker'].map((m) => [m, BL.MODES[m].name]), o.mode)}
              <label>Team Size</label>${seg('onSize', [[1, '1v1'], [2, '2v2'], [3, '3v3'], [4, '4v4']], o.size)}
              <label>Bots fill slots</label>${seg('onFill', [[1, 'Yes'], [0, 'No']], o.fill ? 1 : 0)}
            </div>
            <div class="row"><button class="mbtn primary" data-act="host" data-arg="private" ${p2p ? '' : 'disabled'}>HOST PRIVATE</button><button class="mbtn" data-act="host" data-arg="public" ${p2p ? '' : 'disabled'}>HOST PUBLIC</button></div>
          </div>
          <div class="card"><h3>JOIN</h3>
            <div class="form"><input id="codeIn" maxlength="8" placeholder="Room code" style="text-transform:uppercase"><button class="mbtn primary" data-act="join" ${p2p ? '' : 'disabled'}>JOIN</button></div>
            <h3>PUBLIC ROOMS <button class="mini" data-act="browse" ${p2p ? '' : 'disabled'}>⟳</button></h3>
            <div class="publist">${pub === 'loading' ? '<div class="muted">Searching…</div>' : (pub && pub.length ? pub.map((l) => `<div class="pubrow"><b>${esc(l.hostName)}</b><span>${esc(BL.MODES[l.mode] ? BL.MODES[l.mode].name : l.mode)} ${l.teamSize}v${l.teamSize}</span><span>${esc((BL.MAP_BY_ID[l.mapId] || {}).name || '')}</span><span>${l.players}/${l.max}</span>${l.state === 'lobby' && l.players < l.max ? `<button class="mini" data-act="joinCode" data-arg="${esc(l.code)}">JOIN</button>` : '<span class="muted">IN GAME</span>'}</div>`).join('') : '<div class="muted">None found</div>')}</div>
          </div>
        </div>
      </details>
    </div>`;
  };
  AFTER.online = () => {
    if (!M._srvBound) {
      M._srvBound = true;
      BL.bus.on('net:srv', () => { if (M.screen === 'online' && !BL.game) { const a = document.activeElement; if (!a || a.tagName !== 'INPUT') M.render(); } });
      BL.bus.on('net:queue', () => M.queueOverlay());
    }
    if (BL.Net.srv.status === 'off' && !M._triedSrv && BL.Net.serverUrl()) { M._triedSrv = true; BL.Net.connectServer(() => { if (M.screen === 'online') M.render(); }); }
  };
  ACT.srvConnect = () => {
    const v = (document.getElementById('srvIn').value || '').trim();
    S.p.settings.serverUrl = v; S.save();
    BL.Net.connectServer((err) => { if (err) M.toast(err.message); if (M.screen === 'online') M.render(); });
    M.render();
  };
  ACT.onPl = (v) => { M.onPl = v; M.render(); };
  ACT.search = () => (BL.Net.srv.status === 'on' ? BL.Net.queue(M.onPl, false) : BL.Net.quickPlay(M.onPl, false));
  ACT.searchRanked = (pl) => (BL.Net.srv.status === 'on' ? BL.Net.queue(pl, true) : BL.Net.quickPlay(pl, true));
  ACT.partyCreate = () => BL.Net.partyCreate();
  ACT.partyJoin = () => { const v = (document.getElementById('partyIn').value || '').trim(); if (v) BL.Net.partyJoin(v.toUpperCase()); };
  ACT.partyLeave = () => BL.Net.partyLeave();
  ACT.partyKick = (pid) => BL.Net.partyKick(pid);
  ACT.copyParty = () => { const c = BL.Net.srv.party && BL.Net.srv.party.code; if (c && navigator.clipboard) navigator.clipboard.writeText(c).then(() => M.toast('Party code copied!'), () => M.toast(c)); };
  ACT.roomCreate = () => { M.lobbyLog = []; BL.Net.roomCreate(); M.waitLobby = true; };
  ACT.roomJoin = () => { const v = (document.getElementById('roomIn').value || '').trim(); if (v) { M.lobbyLog = []; BL.Net.roomJoin(v.toUpperCase()); M.waitLobby = true; } };
  BL.bus.on('net:lobby', () => { if (M.waitLobby && !BL.game) { M.waitLobby = false; HISTORY.push('online'); M.show('lobby'); } });

  // searching overlay while in a matchmaking queue
  M.queueOverlay = function () {
    const q = BL.Net.srv.queue;
    clearInterval(M._qTimer);
    if (!q) { if (overlay.classList.contains('queue-ov')) M.closeOverlay(); return; }
    const name = (CASUAL.find((c) => c[0] === q.playlist) || [0, q.playlist])[1];
    M.openOverlay(`<div class="dlg search"><div class="spinner"></div><h3>${q.ranked ? 'COMPETITIVE' : 'CASUAL'} • ${esc(name.toUpperCase())}</h3>
      <div class="q-time" id="qTime">0:00</div><p class="muted small" id="qHint">Searching for players…</p>
      <button class="mbtn" data-act="cancelQueue">CANCEL</button></div>`, 'queue-ov');
    const tick = () => {
      const s = Math.floor((Date.now() - q.since) / 1000);
      const el = document.getElementById('qTime'), h = document.getElementById('qHint');
      if (!el) { clearInterval(M._qTimer); return; }
      el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (h && s >= (q.wait || 15) - 3) h.textContent = 'Filling empty slots…';
    };
    tick();
    M._qTimer = setInterval(tick, 500);
  };
  ACT.cancelQueue = () => { if (BL.Net.p2pQueue) BL.Net.cancelQuick(); else BL.Net.unqueue(); M.closeOverlay(); };

  ACT.saveName = () => { const v = (document.getElementById('nameIn').value || '').trim().slice(0, 16); if (v && BL.Owner && BL.Owner.reserved(v) && !BL.Owner.is()) { M.toast('That name is taken'); return; } if (v) { S.p.name = v; S.save(); BL.Net.sendProfile(); M.render(); M.toast('Name saved'); } };
  ACT.onMode = (v) => { M.on.mode = v; M.render(); };
  ACT.onSize = (v) => { M.on.size = +v; M.render(); };
  ACT.onFill = (v) => { M.on.fill = v === '1'; M.render(); };
  ACT.host = (kind) => {
    M.openOverlay('<div class="dlg search"><div class="spinner"></div><h3>CREATING ROOM…</h3></div>');
    const map = M.ex.map || 'champions';
    BL.Net.host({ public: kind === 'public', mode: M.on.mode, teamSize: M.on.size, mapId: map, botSkill: M.on.skill, fillBots: M.on.fill, mutators: BL.defaultMutators() }, (err) => {
      M.closeOverlay();
      if (err) { M.toast('Could not create room: ' + (err.message || err.type || err)); return; }
      M.lobbyLog = [];
      HISTORY.push('online');
      M.show('lobby');
    });
  };
  ACT.join = () => ACT.joinCode((document.getElementById('codeIn').value || '').trim());
  ACT.joinCode = (code) => {
    if (!code) { M.toast('Enter a room code'); return; }
    M.openOverlay(`<div class="dlg search"><div class="spinner"></div><h3>JOINING ${esc(code.toUpperCase())}…</h3></div>`);
    BL.Net.join(code, (err) => {
      M.closeOverlay();
      if (err) { M.toast(err.message || 'Could not join'); return; }
      M.lobbyLog = [];
      HISTORY.push('online');
      M.show('lobby');
    });
  };
  ACT.browse = () => {
    M.publicList = 'loading'; M.render();
    BL.Net.browse((err, list) => { M.publicList = list || []; if (M.screen === 'online') M.render(); });
  };

  function lobbyLogHtml() { return (M.lobbyLog || []).map((m) => `<div><b>${esc(m.name)}:</b> ${esc(m.m)}</div>`).join(''); }

  SCREENS.lobby = () => {
    const N = BL.Net, L = N.lobby;
    if (!L) return '<div class="panel"><p>Not connected.</p></div>';
    const host = N.isLobbyOwner();
    const slot = (team) => {
      const pl = L.players.filter((p) => p.team === team);
      let html = pl.map((p) => `<div class="lp ${p.pid === N.myPid ? 'me' : ''}"><b>${p.host ? BL.ICON('crown', 14) + ' ' : ''}${U.tagHtml(p)}${esc(p.name)}</b><small>LV ${p.level} ${esc(p.title || '')}</small></div>`).join('');
      for (let i = pl.length; i < L.teamSize; i++) html += `<div class="lp empty">${L.fillBots ? BL.ICON('robot', 14) + ' Bot' : 'Open slot'}</div>`;
      return html;
    };
    const dis = host ? '' : 'disabled';
    return `<div class="panel wide lobby">
      <div class="lobby-head"><div><h2>${L.public ? 'PUBLIC' : 'PRIVATE'} LOBBY</h2></div>
        <div class="code" data-act="copyCode" title="Click to copy">${esc(L.code)}</div></div>
      <div class="cols">
        <div class="team-col blue"><h3>BLUE</h3>${slot(0)}<button class="mbtn" data-act="lobbyTeam" data-arg="0">JOIN BLUE</button></div>
        <div class="team-col orange"><h3>ORANGE</h3>${slot(1)}<button class="mbtn" data-act="lobbyTeam" data-arg="1">JOIN ORANGE</button></div>
        <div class="card lset">
          <h3>MATCH SETTINGS ${host ? '' : '<small>(host only)</small>'}</h3>
          <div class="form">
            <label>Mode</label>${seg(host ? 'lMode' : 'noop', ['soccar', 'rumble', 'heatseeker'].map((m) => [m, BL.MODES[m].name]), L.mode)}
            <label>Team Size</label>${seg(host ? 'lSize' : 'noop', [[1, '1v1'], [2, '2v2'], [3, '3v3'], [4, '4v4']], L.teamSize)}
            <label>Bots</label>${seg(host ? 'lSkill' : 'noop', [[-1, 'Off'], [0.2, 'Rookie'], [0.5, 'Pro'], [0.85, 'All-Star']], L.fillBots ? L.botSkill : -1)}
            <label>Map</label>${sel('map', BL.MAPS.map((m) => [m.id, m.name]), L.mapId, `id="lMap" ${dis}`)}
          </div>
          ${mutatorSelects(L.mutators, 'lmut', !host)}
        </div>
      </div>
      <div class="lchat"><div class="lchat-log" id="lchatLog">${lobbyLogHtml()}</div><div class="form"><input id="lchatIn" maxlength="120" placeholder="Say something..."><button class="mbtn" data-act="lchat">SEND</button></div></div>
      <div class="row end">${host ? `<button class="mbtn big primary" data-act="lStart" ${L.players.length < 1 ? 'disabled' : ''}>START MATCH</button>` : '<div class="muted">Waiting for the host to start...</div>'}</div>
    </div>`;
  };
  AFTER.lobby = () => {
    const m = document.getElementById('lMap');
    if (m) m.onchange = () => BL.Net.updateLobby({ mapId: m.value });
    const inp = document.getElementById('lchatIn');
    if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') ACT.lchat(); };
    const log = document.getElementById('lchatLog');
    if (log) log.scrollTop = 1e9;
  };
  ACT.noop = () => {};
  ACT.copyCode = () => { const c = BL.Net.lobby && BL.Net.lobby.code; if (c && navigator.clipboard) navigator.clipboard.writeText(c).then(() => M.toast('Code copied!'), () => M.toast(c)); else M.toast(c); };
  ACT.lobbyTeam = (t) => BL.Net.setMyTeam(+t);
  ACT.lMode = (v) => BL.Net.updateLobby({ mode: v });
  ACT.lSize = (v) => BL.Net.updateLobby({ teamSize: +v });
  ACT.lSkill = (v) => { const s = +v; BL.Net.updateLobby(s < 0 ? { fillBots: false } : { fillBots: true, botSkill: s }); };
  ACT.lStart = () => BL.Net.startGame();
  ACT.lchat = () => { const i = document.getElementById('lchatIn'); if (!i || !i.value.trim()) return; BL.Net.lobbyChat(S.p.name, i.value.trim()); i.value = ''; };

  // ---------- GARAGE ----------
  M.gcat = 'body';
  SCREENS.garage = () => {
    const cats = BL.CATEGORIES.map((c) => `<button class="gtab ${M.gcat === c.id ? 'on' : ''}" data-act="gcat" data-arg="${c.id}">${c.name}</button>`).join('') + `<button class="gtab ${M.gcat === 'colors' ? 'on' : ''}" data-act="gcat" data-arg="colors">Paint Colors</button>`;
    let content = '';
    if (M.gcat === 'colors') {
      const p = S.p;
      const sw = (act, list, cur) => `<div class="swatches">${list.map((c, i) => `<div class="sw ${cur === i || cur === c ? 'on' : ''}" style="background:${c}" data-act="${act}" data-arg="${typeof cur === 'number' ? i : c}"></div>`).join('')}</div>`;
      content = `<div class="colors"><h3>BLUE TEAM COLOR</h3>${sw('colBlue', BL.TEAM_COLORS[0], p.colors.blue)}<h3>ORANGE TEAM COLOR</h3>${sw('colOrange', BL.TEAM_COLORS[1], p.colors.orange)}<h3>ACCENT COLOR</h3>${sw('colAccent', BL.ACCENT_COLORS, p.colors.accent)}</div>`;
    } else {
      const owned = S.stacks(S.p.inventory.filter((e) => S.itemDef(e.id).cat === M.gcat && BL.inSeason(S.itemDef(e.id)))).sort((a, b) => BL.RARITY_ORDER.indexOf(S.itemDef(b.top.id).rarity) - BL.RARITY_ORDER.indexOf(S.itemDef(a.top.id).rarity));
      const ownedIds = new Set(owned.map((st) => st.top.id));
      const locked = BL.ITEMS.filter((i) => i.cat === M.gcat && !ownedIds.has(i.id));
      content = `<div class="grid">${owned.map((st) => { const e = st.top; return itemCard(S.itemDef(e.id), { act: 'equip', arg: e.uid, eq: S.p.loadout[M.gcat] === e.uid, paint: e.paint, cert: e.cert, certN: e.certN, isNew: st.isNew, qty: st.entries.length }); }).join('')}</div>
        ${locked.length ? `<h3 class="locked-h">LOCKED (${locked.length}) <small>click one to try it on</small></h3><div class="grid">${locked.map((d) => itemCard(d, { locked: true, sel: M.preview === d.id, act: 'lockedItem', arg: d.id, lockText: sourceText(d), tip: sourceText(d) })).join('')}</div>` : ''}`;
    }
    const total = BL.ITEMS.length, ownedCount = new Set(S.p.inventory.map((e) => e.id)).size;
    return `<div class="garage"><div class="gtabs">${cats}<div class="gteam">${seg('gTeam', [[0, 'Blue'], [1, 'Orange']], BL.Garage.team)}</div><div class="muted small">Collection: ${ownedCount}/${total}</div></div><div class="gitems">${content}</div></div>`;
  };
  function sourceText(d) {
    const row = BL.PASS_REWARDS.find((r) => (r.prem && r.prem.id === d.id) || (r.free && r.free.id === d.id));
    if (row) return 'Rocket Pass tier ' + row.tier + (row.free && row.free.id === d.id ? ' (free)' : ' (premium)');
    const sp = BL.SongPass && (d.pass === 'song' || d.event) ? BL.SongPass.tierOfItem(d.id) : 0;
    if (sp) return 'Song Pass tier ' + sp + ' (Challenges)';
    if (d.duels) return 'Win ' + d.duels + ' Honor Duels';
    if (d.pass) return 'Rocket Pass';
    if (d.rank != null) return 'Reach ' + BL.RANKS[d.rank].name + ' in Competitive';
    if (d.event) return 'Song Pass (Challenges)';
    return R(d.rarity).name + ' drops, shop or trade-in';
  }
  M.sourceText = sourceText;
  M.thumb = thumb;
  AFTER.garage = () => {
    BL.Garage.setBoostPreview(M.gcat === 'boost');
    for (const e of S.p.inventory) if (S.itemDef(e.id).cat === M.gcat && e.isNew) e.isNew = false;
    S.save();
  };
  ACT.gcat = (c) => { M.endPreview(); M.gcat = c; M.render(); };
  ACT.gTeam = (t) => { BL.Garage.setTeam(+t); M.render(); };
  ACT.equip = (uid) => {
    M.preview = null;
    S.equip(uid);
    const e = S.entry(uid);
    const def = S.itemDef(e.id);
    BL.Garage.refresh();
    if (def.cat === 'explosion') BL.Garage.previewExplosion(def.fx, e.paint);
    if (def.cat === 'anthem' && BL.Anthems) BL.Anthems.preview(def);
    M.render();
  };
  // try on something you don't own: it goes on the showroom car (a song plays, a goal explosion goes off), nothing is
  // saved, and it comes off when you pick something else, click it again or leave
  M.preview = null;
  const CAR_PART = ['body', 'decal', 'finish', 'wheels', 'wheeldecal', 'topper', 'antenna', 'boost'];
  M.endPreview = function () {
    if (!M.preview) return;
    const d = S.itemDef(M.preview);
    M.preview = null;
    if (d.cat === 'anthem' && BL.Anthems) BL.Anthems.stop();
    if (!BL.game && CAR_PART.indexOf(d.cat) >= 0) BL.Garage.refresh();
  };
  ACT.lockedItem = (id) => {
    const d = BL.ITEM_BY_ID[id], again = M.preview === id;
    M.endPreview();
    if (!again) {
      M.preview = id;
      if (!BL.game && CAR_PART.indexOf(d.cat) >= 0) { const lo = S.resolveLoadout(); lo[d.cat] = { id: d.id, paint: null, cert: null }; BL.Garage.refresh(lo); }
      if (d.cat === 'explosion') BL.Garage.previewExplosion(d.fx, null);
      if (d.cat === 'anthem' && BL.Anthems) BL.Anthems.preview(d);
      M.toast('Preview: ' + d.name + ' — ' + sourceText(d));
    }
    M.render();
  };
  ACT.colBlue = (i) => { S.p.colors.blue = +i; S.save(); BL.Garage.setTeam(0); M.render(); };
  ACT.colOrange = (i) => { S.p.colors.orange = +i; S.save(); BL.Garage.setTeam(1); M.render(); };
  ACT.colAccent = (c) => { S.p.colors.accent = c; S.save(); BL.Garage.refresh(); M.render(); };

  // ---------- INVENTORY ----------
  M.inv = { cat: 'all', rar: 'all', sel: null };
  SCREENS.inventory = () => {
    const f = M.inv;
    let list = S.p.inventory.filter((e) => BL.inSeason(S.itemDef(e.id))); // off-season cars stay saved, hidden
    if (f.cat !== 'all') list = list.filter((e) => S.itemDef(e.id).cat === f.cat);
    if (f.rar !== 'all') list = list.filter((e) => S.itemDef(e.id).rarity === f.rar);
    const stacks = S.stacks(list).sort((a, b) => BL.RARITY_ORDER.indexOf(S.itemDef(b.top.id).rarity) - BL.RARITY_ORDER.indexOf(S.itemDef(a.top.id).rarity) || b.top.t - a.top.t);
    const selE = f.sel && S.entry(f.sel);
    const det = selE ? (() => {
      const d = S.itemDef(selE.id);
      const eq = S.isEquipped(selE.uid), n = S.copies(selE).length;
      return `<div class="detail" style="--rc:${R(d.rarity).color}">${itemCard(d, { paint: selE.paint, cert: selE.cert, certN: selE.certN, showCat: true, eq, qty: n })}
        ${n > 1 ? `<p class="muted small">You have ${n} of these. Spare copies can go in a Trade In.</p>` : ''}
        <div class="row"><button class="mbtn primary" data-act="invEquip" data-arg="${selE.uid}" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPPED' : 'EQUIP'}</button>
</div></div>`;
    })() : '<div class="detail muted">Select an item to see actions.</div>';
    return `<div class="panel wide"><h2>INVENTORY <small>${S.p.inventory.length} items</small></h2>
      <div class="filters">${sel('cat', [['all', 'All Categories']].concat(BL.CATEGORIES.map((c) => [c.id, c.name])), f.cat, 'id="invCat"')}${sel('rar', [['all', 'All Rarities']].concat(BL.RARITY_ORDER.map((r) => [r, R(r).name])), f.rar, 'id="invRar"')}</div>
      <div class="inv"><div class="grid">${stacks.map((st) => { const e = st.top; return itemCard(S.itemDef(e.id), { act: 'invSel', arg: e.uid, paint: e.paint, cert: e.cert, certN: e.certN, isNew: st.isNew, sel: st.entries.some((x) => x.uid === f.sel), eq: st.entries.some((x) => S.isEquipped(x.uid)), showCat: true, qty: st.entries.length }); }).join('')}</div>${det}</div></div>`;
  };
  AFTER.inventory = () => {
    document.getElementById('invCat').onchange = (e) => { M.inv.cat = e.target.value; M.render(); };
    document.getElementById('invRar').onchange = (e) => { M.inv.rar = e.target.value; M.render(); };
  };
  ACT.invSel = (uid) => { M.inv.sel = uid; const e = S.entry(uid); if (e) { for (const x of S.copies(e)) x.isNew = false; S.save(); } M.render(); };
  ACT.invEquip = (uid) => { S.equip(uid); BL.Garage.refresh(); M.render(); M.toast('Equipped'); };
  ACT.invSalvage = (uid) => {
    const e = S.entry(uid);
    if (!e) return;
    M.confirm(`Salvage <b>${esc(S.itemDef(e.id).name)}</b> for ${S.salvageValue(e)} credits? This can't be undone.`, () => {
      S.addCredits(S.salvageValue(e)); S.removeItems([uid]); M.inv.sel = null; M.render(); M.toast('Salvaged');
    }, 'SALVAGE');
  };

  // ---------- DROPS + REVEAL ----------
  SCREENS.drops = () => {
    const drops = S.p.drops;
    return `<div class="panel wide"><h2>DROPS</h2>
      ${drops.length ? `<div class="drops">${drops.map((d) => `<div class="dropc" style="--rc:${R(d.rarity).color}" data-act="openDrop" data-arg="${d.uid}">${dropImg(R(d.rarity).color)}<b>${d.label ? esc(d.label) + ' <small>' + R(d.rarity).name + '</small>' : R(d.rarity).name + ' Drop'}</b><small>CLICK TO OPEN</small></div>`).join('')}</div>` : '<div class="empty-state">No drops</div>'}
      <h3>DROP ODDS</h3><div class="odds">${BL.DROP_ODDS.map((o) => `<span style="color:${R(o[0]).color}">${R(o[0]).name} ${o[1]}%</span>`).join('')}</div></div>`;
  };
  ACT.openDrop = (uid) => {
    const d = S.p.drops.find((x) => x.uid === uid);
    if (!d) return;
    const entry = S.openDrop(uid);
    revealItem(entry, { title: R(d.rarity).name.toUpperCase() + ' DROP', boxColor: R(d.rarity).color, next: () => M.show('drops') });
  };

  // big reveal overlay with a shaking box -> burst -> item card
  // a drop: the rendered 3D crate (the old CSS box on Very Low)
  function dropImg(color, cls) {
    const url = BL.Models.dropThumb && BL.Models.dropThumb(color, 0);
    return url ? `<img class="drop3d ${cls || ''}" src="${url}" alt="" draggable="false">` : `<div class="dbox ${cls || ''}"></div>`;
  }
  M.dropImg = dropImg;
  function revealItem(entry, o) {
    const def = S.itemDef(entry.id);
    const rar = R(def.rarity);
    M._reveal = { entry, o };
    M.openOverlay(`<div class="reveal" style="--rc:${o.boxColor || rar.color};--ic:${rar.color}">
      <h2>${esc(o.title || 'NEW ITEM')}</h2>
      <div class="rv-stage">${BL.Models.dropThumb && BL.Models.dropThumb(o.boxColor || rar.color, 0) ? `<img class="rv-drop3d shaking" id="rvDrop" data-act="rvOpen" src="${BL.Models.dropThumb(o.boxColor || rar.color, 0)}" alt="" draggable="false">` : '<div class="rv-box shaking" data-act="rvOpen"><div class="rv-lid"></div><div class="rv-glow"></div></div>'}</div>
      <p class="muted" id="rvHint">Click the drop to open it!</p>
      <div class="rv-actions hidden" id="rvActs"><button class="mbtn" data-act="rvEquip">EQUIP</button><button class="mbtn primary" data-act="rvDone">CONTINUE</button></div>
    </div>`, 'reveal-ov');
    BL.Audio.play('shake');
    // spin the 3D crate (pre-rendered turn frames)
    const col = o.boxColor || rar.color;
    if (BL.Models.dropThumb && BL.Models.dropThumb(col, 0)) {
      const frames = []; for (let k = 0; k < 16; k++) frames.push(BL.Models.dropThumb(col, (k / 16) * Math.PI / 2));
      let k = 0; clearInterval(M._rvSpin);
      M._rvSpin = setInterval(() => { const im = document.getElementById('rvDrop'); if (!im) { clearInterval(M._rvSpin); return; } im.src = frames[k++ % frames.length]; }, 60);
    }
    if (o.instant) setTimeout(() => ACT.rvOpen(), 300);
  }
  M.revealItem = revealItem;
  ACT.rvOpen = () => {
    const r = M._reveal;
    if (!r || r.opened) return;
    r.opened = true;
    const def = S.itemDef(r.entry.id);
    const tier = BL.RARITY_ORDER.indexOf(def.rarity);
    const stage = overlay.querySelector('.rv-stage');
    stage.innerHTML = `<div class="rv-flash"></div><div class="rv-card">${itemCard(def, { paint: r.entry.paint, cert: r.entry.cert, showCat: true })}</div>`;
    document.getElementById('rvHint').textContent = R(def.rarity).name + ' ' + catName(def.cat) + (r.entry.paint ? ' • Painted ' + BL.PAINT_BY_ID[r.entry.paint].name : '') + (r.entry.cert ? ' • Certified ' + BL.CERT_BY_ID[r.entry.cert].name : '') + (S.copies(r.entry).length > 1 ? ' • Duplicate: you now have ' + S.copies(r.entry).length : '');
    document.getElementById('rvActs').classList.remove('hidden');
    BL.Audio.play('reveal', 1, tier);
    // preview on the showroom car
    if (!BL.game) {
      const lo = S.resolveLoadout();
      if (['body', 'decal', 'finish', 'wheels', 'topper', 'antenna', 'boost'].indexOf(def.cat) >= 0) { lo[def.cat] = { id: def.id, paint: r.entry.paint, cert: r.entry.cert }; BL.Garage.refresh(lo); }
      if (def.cat === 'boost') BL.Garage.setBoostPreview(true);
      if (def.cat === 'explosion') BL.Garage.previewExplosion(def.fx, r.entry.paint);
      if (def.cat === 'anthem' && BL.Anthems) BL.Anthems.preview(def);
    }
  };
  ACT.rvEquip = () => { const r = M._reveal; if (r) { S.equip(r.entry.uid); M.toast('Equipped ' + S.itemDef(r.entry.id).name); } ACT.rvDone(); };
  ACT.rvDone = () => {
    const r = M._reveal;
    M._reveal = null;
    M.closeOverlay();
    BL.Garage.setBoostPreview(false);
    if (!BL.game) BL.Garage.refresh();
    if (r && r.o.next) r.o.next(); else M.render();
  };

  // ---------- SHOP ----------
  SCREENS.shop = () => {
    const offers = S.shopItems();
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const hrs = Math.floor((mid - now) / 3600000), mins = Math.floor(((mid - now) % 3600000) / 60000);
    return `<div class="panel wide"><h2>ITEM SHOP <small>Refreshes in ${hrs}h ${mins}m</small></h2>
      <h3>FEATURED</h3><div class="grid shop">${offers.map((o, i) => {
        const bought = S.p.shopBought[o.key];
        return itemCard(S.itemDef(o.id), { paint: o.paint, price: bought ? null : o.price, act: bought ? 'noop' : 'buy', arg: i, showCat: true, cls: bought ? 'bought' : '' });
      }).join('')}</div>
      <p class="muted">Credits come from the Rocket Pass. Drops come from levelling up.</p>
      </div>`;
  };
  ACT.buy = (i) => {
    const o = S.shopItems()[+i];
    if (!o) return;
    if (S.p.credits < o.price) { M.toast('Not enough credits'); return; }
    M.confirm(`Buy <b>${esc(S.itemDef(o.id).name)}</b> for ${o.price} credits?`, () => {
      const e = S.buy(o);
      if (e) revealItem(e, { title: 'PURCHASED', instant: true, next: () => M.show('shop') });
    }, 'BUY');
  };
  ACT.buyDrop = (arg) => {
    const [rar, price] = arg.split(':');
    if (S.p.credits < +price) { M.toast('Not enough credits'); return; }
    M.confirm(`Buy a ${R(rar).name} Drop for ${price} credits?`, () => { S.buyDrop(rar, +price); S.save(); M.toast('Drop added — open it in DROPS'); M.render(); }, 'BUY');
  };

  // ---------- TRADE-IN ----------
  M.trade = { rar: 'rare', picks: [] };
  SCREENS.tradein = () => {
    const t = M.trade;
    const tiers = S.TRADE_TIERS;
    const list = S.p.inventory.filter((e) => S.itemDef(e.id).rarity === t.rar && S.canTrade(e));
    const next = S.tradeTo(t.rar);
    const stacks = S.stacks(list), spare = S.spares(t.rar).filter((e) => t.picks.indexOf(e.uid) < 0).length;
    return `<div class="panel wide"><h2>TRADE-IN</h2>
      ${seg('tRar', tiers.map((r) => [r, R(r).name + ' → ' + R(S.tradeTo(r)).name]), t.rar)}
      <div class="trade-slots">${[0, 1, 2, 3, 4].map((i) => { const e = t.picks[i] && S.entry(t.picks[i]); return `<div class="tslot" style="--rc:${R(t.rar).color}">${e ? itemCard(S.itemDef(e.id), { paint: e.paint, act: 'tPick', arg: e.uid }) : '+'}</div>`; }).join('')}<div class="tarrow">➜</div><div class="tslot result" style="--rc:${R(next).color}">?<small>${R(next).name}</small></div></div>
      <div class="row end">${spare && t.picks.length < 5 ? `<button class="mbtn big" data-act="tAuto">ADD DUPLICATES (${spare})</button>` : ''}<button class="mbtn big primary" data-act="tGo" ${t.picks.length === 5 ? '' : 'disabled'}>TRADE IN</button></div>
      <h3>YOUR ${R(t.rar).name.toUpperCase()} ITEMS (${list.length})</h3>
      <div class="grid">${list.length ? stacks.map((st) => { const e = st.top, left = st.entries.filter((x) => t.picks.indexOf(x.uid) < 0).length; return itemCard(S.itemDef(e.id), { act: 'tAdd', arg: e.uid, paint: e.paint, cert: e.cert, sel: left < st.entries.length, showCat: true, qty: left, cls: left ? '' : 'spent' }); }).join('') : '<div class="empty-state">No tradeable items of this rarity (equipped items are excluded).</div>'}</div></div>`;
  };
  ACT.tRar = (r) => { M.trade = { rar: r, picks: [] }; M.render(); };
  // (a slot gives its item back; a card adds one more copy from its stack)
  ACT.tPick = (uid) => {
    const t = M.trade, i = t.picks.indexOf(uid);
    if (i >= 0) t.picks.splice(i, 1); else if (t.picks.length < 5) t.picks.push(uid);
    M.render();
  };
  ACT.tAdd = (uid) => {
    const t = M.trade, e = S.entry(uid);
    if (!e || t.picks.length >= 5) return;
    const next = S.copies(e).find((x) => S.canTrade(x) && t.picks.indexOf(x.uid) < 0);
    if (next) t.picks.push(next.uid);
    M.render();
  };
  ACT.tAuto = () => {
    const t = M.trade;
    for (const e of S.spares(t.rar)) { if (t.picks.length >= 5) break; if (t.picks.indexOf(e.uid) < 0) t.picks.push(e.uid); }
    M.render();
  };
  ACT.tGo = () => {
    M.confirm('Trade these 5 items? They will be gone forever.', () => {
      const e = S.tradeIn(M.trade.picks);
      M.trade.picks = [];
      if (e) revealItem(e, { title: 'TRADE-IN', next: () => M.show('tradein') });
      else M.toast('Trade failed');
    }, 'TRADE');
  };

  // ---------- SEASON PASS ----------
  function rewardCard(r, o) {
    if (!r) return '<div class="pr empty"></div>';
    if (r.type === 'credits') return `<div class="pr ${o.cls}"><div class="pr-ico"><i class="cr"></i></div><b>${r.n}</b><small>Credits</small></div>`;
    if (r.type === 'drop') return `<div class="pr ${o.cls}" style="--rc:${R(r.rarity).color}">${dropImg(R(r.rarity).color, 'pr-ico')}<b>${R(r.rarity).name}</b><small>Drop</small></div>`;
    const d = S.itemDef(r.id);
    const paint = r.paint ? BL.PAINT_BY_ID[r.paint] : null;
    return `<div class="pr ${o.cls}" style="--rc:${R(d.rarity).color}" title="${esc(d.name)}"><div class="pr-thumb">${thumb(d, r.paint)}</div><b>${esc(d.name)}</b><small>${paint ? esc(paint.name) + ' ' : ''}${esc(catName(d.cat))}</small></div>`;
  }
  SCREENS.pass = () => {
    const ps = S.p.pass, P = BL.PASS;
    const ch = S.challenges();
    const cols = BL.PASS_REWARDS.map((row) => {
      const reached = row.tier <= ps.tier;
      return `<div class="pt ${reached ? 'reached' : ''} ${row.tier === ps.tier + 1 ? 'next' : ''}"><div class="pt-n">${row.tier}</div>
        ${rewardCard(row.prem, { cls: 'prem ' + (ps.premium ? (reached ? 'got' : '') : 'lockedp') })}
        ${rewardCard(row.free, { cls: 'free ' + (reached ? 'got' : '') })}</div>`;
    }).join('');
    return `<div class="panel wide pass"><div class="pass-head"><div><h2>${esc(P.name)}</h2></div>
      <div class="pass-stat"><div class="pass-tier">TIER <b>${ps.tier}</b>/${P.tiers}</div><div class="bar big"><i style="width:${Math.round((ps.xp / P.xpPerTier) * 100)}%"></i></div><small>${ps.xp} / ${P.xpPerTier} XP to next tier</small>
      <div class="row">${ps.premium ? '<div class="prem-badge">' + BL.ICON('star', 14) + ' PREMIUM UNLOCKED</div>' : `<button class="mbtn primary" data-act="passBuy">UNLOCK PREMIUM <i class="cr"></i>${P.premiumPrice}</button>`}<button class="mbtn" data-act="passSkip" ${ps.tier >= P.tiers ? 'disabled' : ''}>SKIP TIER <i class="cr"></i>${P.skipPrice}</button></div></div></div>
      <div class="pass-track-labels"><span>PREMIUM</span><span>FREE</span></div>
      <div class="pass-track" id="passTrack">${cols}</div>
      <h3>CHALLENGES</h3>
      <div class="chals">${ch.map((c) => `<div class="chal card ${c.done ? 'done' : ''}"><div>${esc(c.desc)}</div><div class="bar"><i style="width:${Math.round((c.progress / c.goal) * 100)}%"></i></div><small>${c.done ? BL.ICON('check', 12) + ' COMPLETE' : c.progress + ' / ' + c.goal} • +${c.xp} Pass XP</small></div>`).join('')}</div></div>`;
  };
  AFTER.pass = () => {
    const tr = document.getElementById('passTrack');
    if (tr) tr.scrollLeft = Math.max(0, (S.p.pass.tier - 2) * 132);
  };
  function showPassRewards(list, title) {
    if (!list || !list.length) return;
    M.openOverlay(`<div class="dlg rewards"><h2>${esc(title)}</h2><div class="rw-list">${list.map((g) => {
      if (g.kind === 'credits') return `<div class="rw"><b>${g.n} credits</b> <small>tier ${g.tier}</small></div>`;
      if (g.kind === 'drop') return `<div class="rw" style="color:${R(g.drop.rarity).color}">${BL.ICON('gift', 15)} <b>${R(g.drop.rarity).name} Drop</b> <small>tier ${g.tier}</small></div>`;
      const d = S.itemDef(g.entry.id);
      return `<div class="rw" style="color:${R(d.rarity).color}">${BL.ICON(d.cat, 15)} <b>${esc(d.name)}</b>${g.entry.paint ? ' <i>' + esc(BL.PAINT_BY_ID[g.entry.paint].name) + '</i>' : ''} <small>tier ${g.tier} ${g.track}</small></div>`;
    }).join('')}</div><div class="row end"><button class="mbtn primary" data-act="closeOv">AWESOME</button></div></div>`);
    BL.Audio.play('levelup');
  }
  ACT.closeOv = () => { M.closeOverlay(); if (!BL.game) { BL.Garage.refresh(); M.render(); } };
  ACT.passBuy = () => {
    if (S.p.credits < BL.PASS.premiumPrice) { M.toast('Not enough credits. You earn them from Rocket Pass tiers.'); return; }
    M.confirm(`Unlock the Premium Rocket Pass for ${BL.PASS.premiumPrice} credits? You'll instantly get every premium reward up to your current tier.`, () => {
      const got = S.buyPremium();
      M.render();
      showPassRewards(got, 'PREMIUM UNLOCKED!');
    }, 'UNLOCK');
  };
  ACT.passSkip = () => {
    if (S.p.credits < BL.PASS.skipPrice) { M.toast('Not enough credits'); return; }
    const got = S.skipTier();
    M.render();
    showPassRewards(got, 'TIER ' + S.p.pass.tier + ' REWARDS');
  };

  // ---------- PROFILE ----------
  SCREENS.profile = () => {
    const p = S.p, st = p.stats;
    const stat = (k, n) => `<div class="stat"><b>${n}</b><small>${k}</small></div>`;
    return `<div class="panel wide"><h2>${esc(p.name)} <small>Level ${p.level}</small></h2>
      <div class="cols"><div class="card"><h3>CAREER</h3><div class="stats">
        ${stat('Matches', st.matches)}${stat('Wins', st.wins)}${stat('Win %', st.matches ? Math.round((st.wins / st.matches) * 100) + '%' : '—')}${stat('Goals', st.goals)}${stat('Assists', st.assists)}${stat('Saves', st.saves)}${stat('Shots', st.shots)}${stat('MVPs', st.mvps)}${stat('Demos', st.demos)}${stat('Aerial Goals', st.aerialGoals)}${stat('Epic Saves', st.epicSaves)}${stat('Honor Duels', p.duels ? p.duels.w + '-' + p.duels.l : '0-0')}${stat('Items', p.inventory.length)}
      </div></div>
      <div class="card"><h3>RANKS</h3><div class="ranks">${BL.PLAYLISTS.map((pl) => `<div><h4>${pl.name}</h4>${rankBadge(p.mmr[pl.id], true)}</div>`).join('')}</div></div></div></div>`;
  };

  // ---------- SETTINGS ----------
  SCREENS.settings = () => {
    const s = S.p.settings;
    const rng = (key, min, max, step, label, fmt) => `<label>${label}<span class="val" id="v_${key}">${fmt ? fmt(s[key]) : s[key]}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-range="${key}">`;
    const tog = (key, label) => `<label>${label}</label>${seg('setTog', [[key + ':1', 'On'], [key + ':0', 'Off']], key + ':' + (s[key] ? 1 : 0))}`;
    const pct = (v) => Math.round(v * 100) + '%';
    return `<div class="panel wide settings"><h2>SETTINGS</h2><div class="cols">
      <div class="card"><h3>GRAPHICS</h3><div class="form">
        <label>Quality <small>(reloads)</small></label>${seg('setQuality', [['auto', 'Auto'], ['potato', 'Very Low (old Chromebook)'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], s.quality)}
        ${rng('resScale', 0.5, 1, 0.05, 'Resolution Scale', pct)}
        ${tog('showFps', 'Show FPS')}
        <p class="muted small">Current: ${BL.App.potato ? 'VERY LOW' : BL.App.quality.toUpperCase()} • Old Chromebook: pick Very Low. Auto lowers the resolution (and the detail) if the game starts lagging.</p>
      </div></div>
      <div class="card"><h3>CAMERA</h3><div class="form">
        <label>Camera</label>${seg('setCamPreset', [['player', 'Player View'], ['cinematic', 'Cinematic']], s.camPreset || 'player')}
        ${rng('fov', 80, 110, 1, 'Field of View')}
        ${rng('camDist', 2, 3.6, 0.05, 'Distance')}
        ${rng('camHeight', 0.6, 1.8, 0.05, 'Height')}
        ${rng('camStiff', 0, 1, 0.05, 'Stiffness')}
        ${tog('ballCam', 'Ball Cam by Default')}
        ${tog('shake', 'Camera Shake')}
      </div></div>
      <div class="card"><h3>AUDIO</h3><div class="form">
        ${rng('master', 0, 1, 0.05, 'Master', pct)}${rng('sfx', 0, 1, 0.05, 'Effects', pct)}${rng('music', 0, 1, 0.05, 'Menu Music', pct)}${rng('engine', 0, 1, 0.05, 'Engine', pct)}
      </div></div>
      <div class="card"><h3>CONTROLS</h3><div class="form">
        ${tog('invertPitch', 'Invert Air Pitch')}
        <label>Touch Controls</label>${seg('setTouch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']], s.touch)}
      </div><div class="row"><button class="mbtn primary" data-act="go" data-arg="controls">CONFIGURE CONTROLS</button></div></div>
      <div class="card"><h3>PROFILE</h3><div class="form"><label>Name</label><input id="nameIn" maxlength="16" value="${esc(S.p.name)}"><button class="mbtn" data-act="saveName">SAVE</button></div>
        <button class="mbtn danger" data-act="resetProfile">RESET ALL PROGRESS</button></div>
    </div></div>`;
  };
  function controlsHelp() {
    return `<div class="keys">
      <div><kbd>W</kbd><kbd>S</kbd> Throttle / air pitch</div><div><kbd>A</kbd><kbd>D</kbd> Steer / air yaw</div>
      <div><kbd>Space</kbd> or right-click Jump (double-tap + direction = flip)</div><div><kbd>Shift</kbd> or left-click Boost</div>
      <div><kbd>X</kbd>/<kbd>Ctrl</kbd> Powerslide / air roll</div><div><kbd>Q</kbd><kbd>E</kbd> Air roll left / right</div>
      <div><kbd>C</kbd> Ball cam</div><div><kbd>R</kbd> Use Rumble item</div><div><kbd>1-4</kbd> Quick chat</div><div><kbd>Tab</kbd> Scoreboard • <kbd>Esc</kbd> Pause</div>
      <div>${BL.ICON('gamepad', 15)} Gamepad: RT/LT drive, A jump, B boost, X drift, Y ball cam, RB item, D-pad chat</div></div>`;
  }
  // ---------- CONTROLS (rebinding) ----------
  SCREENS.controls = () => {
    const I = BL.Input, s = S.p.settings;
    const gp = I.getPad();
    const cap = M.capturing || '';
    const keyBtn = (a, slot) => {
      const id = 'k:' + a + ':' + slot;
      const code = (I.KEYS[a] || [])[slot];
      return `<button class="bind ${cap === id ? 'cap' : ''}" data-act="bindKey" data-arg="${a}:${slot}">${cap === id ? 'Press a key…' : esc(I.keyName(code))}</button>`;
    };
    const padBtn = (a) => {
      const id = 'p:' + a;
      return `<button class="bind ${cap === id ? 'cap' : ''}" data-act="bindPad" data-arg="${a}">${cap === id ? 'Press a button…' : esc(I.padName(I.PAD[a]))}</button>`;
    };
    const rng = (key, min, max, step, label) => `<label>${label}<span class="val" id="v_${key}">${s[key]}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}" data-range="${key}">`;
    const rows = I.ACTIONS.map((a) => `<tr><td>${esc(I.ACTIONS_DEF[a][0])}</td><td>${keyBtn(a, 0)}</td><td>${keyBtn(a, 1)}</td><td>${['forward', 'back', 'left', 'right'].indexOf(a) >= 0 ? '<span class="muted">Left stick</span>' : padBtn(a)}</td></tr>`).join('');
    return `<div class="panel wide"><h2>CONTROLS</h2>
      <div class="ctl-status">${gp ? BL.ICON('gamepad', 15) + ' Controller connected: <b>' + esc(gp.id.slice(0, 60)) + '</b>' : 'No controller detected — press any button on your controller.'}</div>
      <table class="binds"><tr><th>ACTION</th><th>KEY</th><th>ALT KEY</th><th>CONTROLLER</th></tr>${rows}
        <tr><td>Throttle (analog)</td><td colspan="2" class="muted">Throttle / Reverse keys</td><td><button class="bind ${cap === 'p:throttleBtn' ? 'cap' : ''}" data-act="bindPad" data-arg="throttleBtn">${cap === 'p:throttleBtn' ? 'Press a button…' : esc(I.padName(I.PAD.throttleBtn))}</button></td></tr>
        <tr><td>Reverse / Brake (analog)</td><td colspan="2"></td><td><button class="bind ${cap === 'p:brakeBtn' ? 'cap' : ''}" data-act="bindPad" data-arg="brakeBtn">${cap === 'p:brakeBtn' ? 'Press a button…' : esc(I.padName(I.PAD.brakeBtn))}</button></td></tr>
      </table>
      <div class="cols"><div class="card"><h3>CONTROLLER</h3><div class="form">
        ${rng('deadzone', 0, 0.4, 0.01, 'Stick Deadzone')}
        ${rng('steerSens', 0.5, 2, 0.05, 'Steering Sensitivity')}
        <label>Vibration</label>${seg('setTog', [['vibration:1', 'On'], ['vibration:0', 'Off']], 'vibration:' + (s.vibration ? 1 : 0))}
        <label>Invert Air Pitch</label>${seg('setTog', [['invertPitch:1', 'On'], ['invertPitch:0', 'Off']], 'invertPitch:' + (s.invertPitch ? 1 : 0))}
      </div></div>
      <div class="card"><h3>MOUSE</h3><p class="muted small">Left mouse = Boost, Right mouse = Jump (during matches).</p></div></div>
      <div class="row end"><button class="mbtn danger" data-act="bindReset">RESET TO DEFAULTS</button></div></div>`;
  };
  AFTER.controls = () => {
    if (!M._padListen) {
      M._padListen = true;
      window.addEventListener('gamepadconnected', () => { if (M.screen === 'controls') M.render(); });
      window.addEventListener('gamepaddisconnected', () => { if (M.screen === 'controls') M.render(); });
    }
  };
  ACT.bindKey = (arg) => {
    const [a, slot] = arg.split(':');
    M.capturing = 'k:' + a + ':' + slot;
    M.render();
    BL.Input.capture = (ev) => {
      M.capturing = null;
      if (ev.type === 'key' && ev.code !== 'Escape') BL.Input.setKey(a, +slot, ev.code);
      M.render();
    };
  };
  ACT.bindPad = (a) => {
    M.capturing = 'p:' + a;
    BL.Input.captureFresh = true; // wait for the button that opened this to be let go
    M.render();
    BL.Input.capture = (ev) => {
      M.capturing = null;
      if (ev.type === 'pad') {
        if (a === 'throttleBtn' || a === 'brakeBtn') { const st = S.p.settings; st.pad = st.pad || {}; st.pad[a] = ev.button; S.save(); BL.Input.loadBindings(); }
        else BL.Input.setPad(a, ev.button);
      }
      M.render();
    };
  };
  ACT.bindReset = () => M.confirm('Reset all keyboard and controller bindings to default?', () => { BL.Input.resetBindings(); M.render(); }, 'RESET');

  ACT.setting = (key, el) => {
    const s = S.p.settings;
    s[key] = parseFloat(el.value);
    const v = document.getElementById('v_' + key);
    if (v) v.textContent = ['master', 'sfx', 'music', 'engine', 'resScale'].indexOf(key) >= 0 ? Math.round(s[key] * 100) + '%' : s[key];
    S.save();
    BL.Audio.applyVolumes();
    if (key === 'resScale') BL.App.applyResolution();
  };
  ACT.setCamPreset = (v) => { S.p.settings.camPreset = v; S.save(); M.render(); };
  ACT.setTog = (arg) => { const [k, v] = arg.split(':'); S.p.settings[k] = v === '1'; S.save(); M.render(); };
  ACT.setTouch = (v) => { S.p.settings.touch = v; S.save(); M.render(); };
  ACT.setQuality = (v) => {
    if (S.p.settings.quality === v) return;
    S.p.settings.quality = v; delete S.p.settings.autoTier; S.save();
    M.toast('Applying graphics settings...');
    setTimeout(() => location.reload(), 500);
  };
  // VSync picks the frame loop and canvas when the game starts, so changing it reloads
  ACT.setVsync = (v) => {
    const on = v === '1';
    if ((S.p.settings.vsync !== false) === on) return;
    S.p.settings.vsync = on; S.save();
    M.toast('Applying graphics settings...');
    setTimeout(() => location.reload(), 500);
  };
  ACT.resetProfile = () => M.confirm('Reset ALL progress, items and ranks? This cannot be undone.', () => { S.reset(); location.reload(); }, 'RESET');

  // ---------- LOADING SCREEN ----------
  const TIPS = [
    'Hold Powerslide in the air to free air roll.',
    'Touch the ball with your wheels in the air to get a flip reset.',
    'Ball cam keeps the ball in view — toggle it any time.',
    'Big boost pads give 100 boost and respawn after 10 seconds.',
    'Flip into the ball for a much harder shot.',
    'Supersonic cars demolish opponents on contact.',
    'Drive up the walls to keep your speed and cut off angles.',
    'Pull back during a flip to cancel it (half-flip).',
    'Small pads give 12 boost and come back in 4 seconds.',
    'Rotate back to defend after you take a shot.',
  ];
  M.showLoading = function (cfg) {
    const map = BL.MAP_BY_ID[cfg.mapId] || BL.MAPS[0];
    const el = document.getElementById('loading');
    const team = (t) => cfg.players.filter((p) => p.team === t).map((p) => `<div>${esc(p.name)}</div>`).join('');
    const size = Math.max(1, Math.max(...[0, 1].map((t) => cfg.players.filter((p) => p.team === t).length)));
    el.innerHTML = `<div class="ld-bg" style="--s0:${map.sky[0]};--s1:${map.sky[1]};--fl:${map.floor.a}"></div><div class="ld-hex"></div>
      <div class="ld-top"><div class="ld-map">${esc(map.name.toUpperCase())}</div><div class="ld-mode">${esc((BL.MODES[cfg.mode] || BL.MODES.soccar).name.toUpperCase())} • ${size}V${size}${cfg.ranked ? ' • COMPETITIVE' : ''}</div></div>
      ${cfg.mode === 'freeplay' ? '' : `<div class="ld-teams"><div class="ld-t blue">${team(0)}</div><div class="ld-vs">VS</div><div class="ld-t orange">${team(1)}</div></div>`}
      <div class="ld-bottom"><div class="ld-logo"><span class="ld-ring"></span>ROCKET<b>LEAGUE</b></div><div class="ld-bar"><i></i></div><div class="ld-tip">TIP: ${esc(U.choice(TIPS))}</div></div>`;
    el.classList.remove('hidden', 'out');
  };
  M.hideLoading = function () {
    const el = document.getElementById('loading');
    el.classList.add('out');
    setTimeout(() => el.classList.add('hidden'), 450);
  };

  // ---------- PAUSE ----------
  M.togglePause = function (game) {
    if (M.postShown) return;
    if (game.paused || M.pauseOpen) { M.closePause(game); return; }
    // matches found through the playlists look online: they keep running behind the menu, like the real game
    const live = game.online || !!game.cfg.disguised;
    if (!game.cfg.disguised) game.paused = true;
    M.openOverlay(`<div class="dlg pause"><h2>${live ? 'MENU' : 'PAUSED'}</h2>
      <button class="mbtn big primary" data-act="resume">RESUME</button>
      ${!live && game.mode !== 'freeplay' && !game.cfg.ranked ? '<button class="mbtn" data-act="restart">RESTART MATCH</button>' : ''}
      <button class="mbtn" data-act="pauseHelp">CONTROLS</button>
      <button class="mbtn danger" data-act="leaveMatch">${live ? (game.cfg.ranked ? 'LEAVE MATCH (counts as a loss)' : 'LEAVE MATCH') : (game.cfg.ranked ? 'FORFEIT (counts as a loss)' : 'EXIT TO MENU')}</button>
      <div id="pauseHelp" class="hidden">${controlsHelp()}</div></div>`, 'pause-ov');
    M.pauseOpen = true;
  };
  M.closePause = function (game) { game.paused = false; M.closeOverlay(); };
  ACT.resume = () => { if (BL.game) M.closePause(BL.game); };
  ACT.pauseHelp = () => document.getElementById('pauseHelp').classList.toggle('hidden');
  ACT.restart = () => { M.closeOverlay(); if (BL.game && BL.game.cfg.ranked) return; if (M.lastCfg && !M.lastCfg.ranked) startLocal(M.lastCfg.ex, null); };
  // XP like the real game: earned per second of play (60 s minimum) plus score, MVP and win bonuses,
  // a consecutive-games bonus and two double-XP wins banked per day
  function matchXP(st, secs, won, mvp) {
    if (secs < 60) return 0;
    const p = S.p, now = Date.now();
    let xp = secs * 2 + (st.score || 0) * 0.3 + (mvp ? 100 : 0) + (won ? 100 : 0);
    p.streakGames = now - (p.lastMatchAt || 0) < 15 * 60 * 1000 ? Math.min(3, (p.streakGames || 0) + 1) : 0;
    p.lastMatchAt = now;
    xp *= 1 + 0.1 * p.streakGames;
    const day = Math.floor(now / 86400000);
    const wb = p.winBonus || (p.winBonus = { day, left: 2 });
    if (wb.day !== day) { wb.left = Math.min(14, wb.left + 2 * Math.max(0, day - wb.day)); wb.day = day; }
    if (won && wb.left > 0) { wb.left--; xp *= 2; }
    return Math.round(xp);
  }

  // leaving early (Leave Match, closing or reloading the tab) is a forfeit: a loss, a ranked loss in ranked,
  // and, as in the real game, the time you did play still earns XP
  M.forfeit = function (g) {
    if (!g || g.rewarded || g.phase === 'ended' || g.mode === 'freeplay' || !g.local) return false;
    g.rewarded = true;
    const p = S.p;
    p.stats.matches++;
    p.stats.forfeits = (p.stats.forfeits || 0) + 1;
    const xp = matchXP(g.local.stats, Math.round(g.playTime || 0), false, false);
    if (xp) { S.addXP(xp); S.addPassXP(xp); }
    if (g.cfg.ranked) {
      const pl = g.cfg.ranked.playlist;
      p.mmr[pl] = Math.max(0, p.mmr[pl] - 15);
      p.streak = Math.min(-1, (p.streak || 0) - 1);
    }
    S.save();
    return true;
  };
  window.addEventListener('pagehide', () => {
    if (M.forfeit(BL.game)) { S.p.notice = 'You left your last match, so it counted as a forfeit.'; S.save(); }
  });

  ACT.leaveMatch = () => {
    const g = BL.game;
    M.closeOverlay();
    if (!g) return;
    if (M.forfeit(g)) M.toast('Match forfeited');
    const online = g.online;
    BL.App.endGame();
    if (online) { BL.Net.leave(); M.show('online'); } else M.show('main');
  };

  // ---------- POST MATCH ----------
  M.postMatch = function (game, r) {
    if (M.postShown) return;
    M.postShown = true;
    const local = r.players.find((p) => p.id === r.localId);
    // the MVP's player anthem plays over the results
    const mvpCar = game.cars.find((c) => c.id === r.mvp);
    if (BL.Anthems && mvpCar) BL.Anthems.playClip(BL.Anthems.forLoadout(mvpCar.loadout));
    let rewards = '';
    if (local && game.mode !== 'freeplay' && !game.rewarded) {
      game.rewarded = true;
      const won = local.team === r.winner;
      if (M.onMatchResult) M.onMatchResult(game, r, won);
      const st = local.stats, p = S.p;
      p.stats.matches++; if (won) p.stats.wins++;
      for (const k of ['goals', 'assists', 'saves', 'shots', 'demos', 'aerialGoals', 'score', 'epicSaves']) p.stats[k] = (p.stats[k] || 0) + (st[k] || 0);
      const mvp = r.mvp === local.id;
      if (mvp) p.stats.mvps++;
      // certified items count stats
      for (const slot of S.SLOTS) {
        const e = S.entry(p.loadout[slot]);
        if (e && e.cert) { const c = BL.CERT_BY_ID[e.cert]; e.certN = (e.certN || 0) + (c.stat === 'wins' ? (won ? 1 : 0) : c.stat === 'mvps' ? (mvp ? 1 : 0) : (st[c.stat] || 0)); }
      }
      // every match gives XP (offline ones too; they're presented like online matches)
      M.pmData = { before: { level: p.level, xp: p.xp, tier: p.pass.tier, pxp: p.pass.xp } };
      const xp = matchXP(st, r.playSecs == null ? 300 : r.playSecs, won, mvp);
      const levels = S.addXP(xp);
      let passR = S.addPassXP(xp);
      const chDone = S.progressChallenges(Object.assign({}, st, { wins: won ? 1 : 0, matches: 1 }));
      let chXP = 0;
      for (const c of chDone) chXP += c.xp;
      if (chXP) { const pr2 = S.addPassXP(chXP); passR = { tiers: passR.tiers + pr2.tiers, rewards: passR.rewards.concat(pr2.rewards) }; }
      // the same XP climbs the Song Pass (its rewards are handed out at once)
      const songR = BL.SongPass && xp + chXP > 0 ? BL.SongPass.addXP(xp + chXP) : { tiers: 0, rewards: [] };
      let rankHtml = '';
      if (r.ranked) {
        const pl = r.ranked.playlist;
        const before = p.mmr[pl], rb = S.rankInfo(before);
        p.rankedGames = p.rankedGames || {};
        const games = p.rankedGames[pl] = (p.rankedGames[pl] || 0) + 1;
        const oppMMR = 150 + (r.botSkill == null ? 0.5 : r.botSkill) * 1450;
        const expected = 1 / (1 + Math.pow(10, (oppMMR - before) / 400));
        const K = games <= 10 ? 52 : 26;
        let delta = r.winner < 0 ? 0 : K * ((won ? 1 : 0) - expected);
        const margin = Math.abs(r.score[0] - r.score[1]);
        if (r.winner >= 0) delta += (won ? 1 : -1) * Math.min(4, Math.max(0, margin - 1)) * 1.5;
        if (won && mvp) delta += 3;
        p.streak = r.winner < 0 ? 0 : won ? Math.max(1, (p.streak || 0) + 1) : Math.min(-1, (p.streak || 0) - 1);
        if (Math.abs(p.streak) >= 3) delta *= 1.2;
        delta = Math.round(delta);
        if (r.winner >= 0 && Math.abs(delta) < 4) delta = won ? 4 : -4;
        p.mmr[pl] = Math.max(0, before + delta);
        const ra = S.rankInfo(p.mmr[pl]);
        const change = ra.tier > rb.tier || (ra.tier === rb.tier && ra.div > rb.div) ? '<div class="rankup">RANK UP!</div>' : (ra.tier < rb.tier || (ra.tier === rb.tier && ra.div < rb.div) ? '<div class="rankdown">RANK DOWN</div>' : '');
        const extra = games <= 10 ? `<div class="muted">Placement match ${games}/10</div>` : (Math.abs(p.streak) >= 3 ? `<div class="hot">${p.streak > 0 ? 'WIN' : 'LOSS'} STREAK ×${Math.abs(p.streak)}</div>` : '');
        M.pmData.rank = { pl, before, after: p.mmr[pl], delta, games, streak: p.streak };
        const newTitles = S.rankRewards();
        if (newTitles.length) setTimeout(() => M.toast('Rank reward unlocked: ' + newTitles.map((t) => t.name + ' title').join(', ') + ' and its avatar border'), 1200);
        rankHtml = `<div class="pm-rank">${rankBadge(p.mmr[pl], true)}<div><div class="mmr-d ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} MMR</div>${extra}</div>${change}</div>`;
      }
      S.save();
      Object.assign(M.pmData, { xp, chXP, levels, passTiers: passR.tiers, chDone, after: { level: p.level, xp: p.xp, tier: p.pass.tier, pxp: p.pass.xp } });
      rewards = `<div class="pm-rewards">
        <div class="rw">${BL.ICON('star', 15)} <b>+${xp} XP</b> ${levels.length ? `<span class="hot">LEVEL UP → ${p.level}!</span>` : ''}${xp ? '' : ' <small class="muted">(matches under a minute give no XP)</small>'}</div>
        <div class="rw"><b>Rocket Pass</b> tier ${p.pass.tier}${passR.tiers ? ` <span class="hot">+${passR.tiers} TIER${passR.tiers > 1 ? 'S' : ''}</span>` : ''}</div>
        ${BL.SongPass ? `<div class="rw"><b>Song Pass</b> tier ${BL.SongPass.state().tier}${songR.tiers ? ` <span class="hot">+${songR.tiers} TIER${songR.tiers > 1 ? 'S' : ''}</span>` : ''}</div>` : ''}
        ${songR.rewards.map((g) => `<div class="rw" style="color:#ffd166">${BL.ICON(g.kind === 'song' ? 'anthem' : g.kind === 'decal' ? 'decal' : g.kind === 'title' ? 'title' : 'person', 15)} Song Pass tier ${g.tier}: <b>${esc(g.name)}</b> <small>${esc(BL.SongPass.KINDS[g.kind] || '')}${g.dup ? ' • already yours, +' + g.dup + ' credits' : ''}</small></div>`).join('')}
        ${chDone.map((c) => `<div class="rw">${BL.ICON('check', 15)} Challenge complete: <b>${esc(c.desc)}</b> +${c.xp} Pass XP</div>`).join('')}
        ${passR.rewards.map((g) => g.kind === 'item' ? `<div class="rw" style="color:${R(S.itemDef(g.entry.id).rarity).color}">${BL.ICON('gift', 15)} Pass reward: <b>${esc(S.itemDef(g.entry.id).name)}</b></div>` : g.kind === 'drop' ? `<div class="rw" style="color:${R(g.drop.rarity).color}">${BL.ICON('gift', 15)} Pass reward: <b>${R(g.drop.rarity).name} Drop</b></div>` : `<div class="rw">Rocket Pass reward: <b>${g.n} credits</b></div>`).join('')}
        ${levels.map((l) => `<div class="rw">${BL.ICON('trophy', 15)} Level ${l.level} reward: <b style="color:${R(l.rarity).color}">${R(l.rarity).name} Drop</b>${l.item ? ` + <b style="color:${R('limited').color}">${esc(S.itemDef(l.item).name)}</b>` : ''}</div>`).join('')}
      </div>${rankHtml}`;
      if (levels.length) BL.Audio.play('levelup');
    }
    const pl = r.ranked && r.ranked.playlist;
    const rankOf = (p) => (!pl || !M.rankIcon ? '' : p.id === r.localId ? M.rankIcon(S.p.mmr[pl] || 0, 'xs') : p.isBot && p.skill != null ? M.rankIcon(150 + p.skill * 1450, 'xs') : '');
    const rows = (t) => r.players.filter((p) => p.team === t).sort((a, b) => b.stats.score - a.stats.score).map((p) => `<tr class="${p.id === r.localId ? 'me' : ''}"><td>${rankOf(p)}${p.id === r.mvp ? '<span class="mvp-ic">' + BL.ICON('mvp', 16) + '</span> ' : ''}${U.tagHtml(p)}${esc(p.name)}</td><td>${p.stats.score}</td><td>${p.stats.goals}</td><td>${p.stats.assists}</td><td>${p.stats.saves}</td><td>${p.stats.shots}</td></tr>`).join('');
    const I = BL.ICON;
    const head = `<tr><th></th><th title="Score">${I('score')}</th><th title="Goals">${I('goal')}</th><th title="Assists">${I('assist')}</th><th title="Saves">${I('save')}</th><th title="Shots">${I('shot')}</th></tr>`;
    const res = !local ? 'MATCH OVER' : r.winner < 0 ? 'DRAW' : local.team === r.winner ? 'VICTORY' : 'DEFEAT';
    const ffNote = r.forfeit >= 0 ? `<div class="pm-ctx">${esc((r.teamNames || BL.TEAM_NAMES)[r.forfeit])} forfeited.</div>` : '';
    const online = game.online;
    if (M.postView) { M.postView(game, r, { res, rows, head, ffNote, online, extra: M.postExtra ? M.postExtra(r) : '', data: rewards ? M.pmData : null }); return; }
    M.openOverlay(`<div class="post"><h1 class="${res === 'VICTORY' ? 'win' : res === 'DEFEAT' ? 'lose' : ''}">${res}</h1>
      <div class="pm-score"><span style="color:${BL.TEAM_MAIN[0]}">${r.score[0]}</span> - <span style="color:${BL.TEAM_MAIN[1]}">${r.score[1]}</span></div>${ffNote}
      <div class="pm-tables"><table class="blue">${head}${rows(0)}</table><table class="orange">${head}${rows(1)}</table></div>
      ${rewards}
      ${M.postExtra ? M.postExtra(r) : ''}
      <div class="row center">${online ? `<button class="mbtn primary" data-act="pmLobby">BACK TO LOBBY</button>` : `<button class="mbtn" data-act="pmRematch">${r.ranked ? 'PLAY AGAIN' : 'REMATCH'}</button><button class="mbtn primary" data-act="pmMenu">CONTINUE</button>`}</div></div>`, 'post-ov');
  };
  ACT.pmMenu = () => { M.postShown = false; BL.App.endGame(); M.closeOverlay(); M.show(S.p.drops.length ? 'main' : 'main'); };
  ACT.pmRematch = () => {
    M.postShown = false; M.closeOverlay();
    if (!M.lastCfg) { ACT.pmMenu(); return; }
    if (M.lastCfg.ranked) { BL.App.endGame(); M.show('ranked'); ACT.rankedGo(M.lastCfg.ranked.playlist); return; }
    startLocal(M.lastCfg.ex, null);
  };
  ACT.pmLobby = () => {
    M.postShown = false; M.closeOverlay();
    BL.App.endGame();
    if (BL.Net.transport === 'ws') { BL.Net.leaveMatchOnly(); if (!BL.Net.lobby) { BL.Net.leave(); M.show('online'); return; } }
    if (BL.Net.role === 'host') BL.Net.matchEnded();
    if (BL.Net.lobby) M.show('lobby'); else M.show('online');
  };

  // shared pieces for js/rlmenu.js (the menus laid out like the real game)
  M._x = { SCREENS, ACT, AFTER, HISTORY, esc, seg, sel, itemCard, rankBadge, startLocal, botPlayers, mapCards, mapPic, controlsHelp, mutatorSelects, thumb, rewardCard };
})(window.BL);
