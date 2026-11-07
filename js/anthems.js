'use strict';
// Rocket League (fan remake) - player anthems + menu music from the songs listed in BL.MUSIC (js/assets.js):
//   { id, name, url, clipStart, clipLen }
// Songs play through <audio> elements with relative paths, so they work from file:// without being packed.
(function (BL) {
  const AN = BL.Anthems = {};
  const songs = () => BL.MUSIC || [];
  const song = (id) => songs().find((m) => m.id === id) || null;

  // every song is a Player Anthem item everyone owns (plus "None"); the basic anthem comes first so it's the default
  AN.DEFAULT = 'throwback-anthem';
  function register() {
    const add = (it) => { if (!BL.ITEM_BY_ID[it.id]) { BL.ITEMS.push(it); BL.ITEM_BY_ID[it.id] = it; } };
    const list = songs().slice().sort((a, b) => (b.id === AN.DEFAULT) - (a.id === AN.DEFAULT));
    for (const m of list) add({ id: 'anthem_' + m.id, cat: 'anthem', name: m.name, rarity: m.id === AN.DEFAULT ? 'common' : m.rarity || 'rare', def: true, song: m.id });
    add({ id: 'anthem_none', cat: 'anthem', name: 'None', rarity: 'common', def: true });
  }
  register();

  const vol = () => {
    const s = (BL.Save.p && BL.Save.p.settings) || { master: 0.8, music: 0.45 };
    return Math.max(0, Math.min(1, (s.master == null ? 0.8 : s.master) * (s.music == null ? 0.45 : s.music) * 1.7));
  };

  // one song at a time: fades in, fades out before the clip ends
  let cur = null;
  function play(m, start, len, onEnd) {
    stopNow();
    // #t= starts the file right at the clip (no blip of the intro before the seek lands)
    const a = new Audio(start > 0 ? m.url + '#t=' + start : m.url);
    a.preload = 'auto';
    a.volume = 0;
    const seek = () => { try { if (start > 0) a.currentTime = start; } catch (e) { /* not seekable yet */ } };
    a.addEventListener('loadedmetadata', seek, { once: true });
    if (a.readyState >= 1) seek();
    cur = { a, len, t0: 0, onEnd, out: 0, near: null };
    const p = a.play();
    if (p && p.catch) p.catch(() => { if (cur && cur.a === a) cur.blocked = true; });
    a.addEventListener('playing', () => { if (cur && cur.a === a && !cur.t0) cur.t0 = performance.now(); });
    a.addEventListener('ended', () => { if (cur && cur.a === a) finish(); });
  }
  function stopNow() { if (cur) { cur.a.pause(); cur.a.src = ''; cur = null; } }
  function finish() { const f = cur && cur.onEnd; stopNow(); if (f) f(); }
  setInterval(() => {
    if (!cur || !cur.t0) return;
    const t = (performance.now() - cur.t0) / 1000;
    let v = vol() * Math.min(1, t / 0.6) * nearGain(cur.near);
    if (cur.len < 1e6) v *= Math.max(0, Math.min(1, (cur.len - t) / 1.2));
    if (cur.out) { cur.out -= 0.06; v *= Math.max(0, cur.out); if (cur.out <= 0) { finish(); return; } }
    cur.a.volume = Math.max(0, Math.min(1, v));
    if (t >= cur.len) finish();
  }, 50);

  // in a match: an anthem is played out in the stadium, louder the closer your camera is to that player
  function nearGain(n) {
    const g = BL.game, cam = BL.App && BL.App.camera;
    if (!n || !g || !cam || !n.car.model) return 1;
    if (n.car === g.local || n.car === g.local2) return 1;
    const d = cam.position.distanceTo(n.car.model.group.position);
    return Math.max(0.22, Math.min(1, 1.15 - d / 55));
  }
  // after a goal or a save: the player's anthem for everyone, with a banner naming the player and the song.
  // A goal's anthem isn't cut off by a save; saves get a shorter clip.
  AN.playNear = function (car, kind) {
    const m = car && AN.forLoadout(car.loadout);
    if (!m) return false;
    if (kind === 'save' && cur && cur.near && cur.near.kind === 'goal') return false;
    menuOn = false;
    play(m, m.clipStart || 0, kind === 'save' ? 6 : m.clipLen || 12, () => { if (wantMenu) AN.menu(); });
    cur.near = { car, kind };
    AN.banner(car, m);
    return true;
  };
  AN.banner = function (car, m) {
    let el = document.getElementById('anthemBanner');
    if (!el) { el = document.createElement('div'); el.id = 'anthemBanner'; el.className = 'anthem-banner'; document.body.appendChild(el); }
    const team = car.team === 1 ? '#ff8a1f' : '#2f7bff';
    el.style.setProperty('--tc', team);
    el.innerHTML = '<i>' + BL.ICON('anthem', 22) + '</i><div><small>' + BL.util.esc(car.name) + "'S ANTHEM</small><b>" + BL.util.esc(m.name) + '</b></div>';
    el.classList.remove('out', 'on');
    void el.offsetWidth; // restart the slide when a new anthem replaces one still showing
    el.classList.add('on');
    clearTimeout(AN._bt);
    AN._bt = setTimeout(() => { el.classList.add('out'); el.classList.remove('on'); }, 4500);
  };

  // anthem clip for a loadout (goal / MVP / garage preview)
  AN.forLoadout = (lo) => {
    const def = lo && lo.anthem && BL.ITEM_BY_ID[lo.anthem.id];
    return def && def.song ? song(def.song) : null;
  };
  AN.playClip = function (m) {
    if (!m) return false;
    menuOn = false;
    play(m, m.clipStart || 0, m.clipLen || 12, () => { if (wantMenu) AN.menu(); });
    return true;
  };
  AN.preview = (def) => AN.playClip(def && def.song ? song(def.song) : null) || AN.stop();
  AN.stop = function () { menuOn = false; if (cur) cur.out = cur.out || 1; };

  // menu music: the theme tracks first, then the rest, full length, one after another
  let menuOn = false, wantMenu = false, idx = -1;
  const playlist = () => {
    const all = songs().slice();
    all.sort((a, b) => (/theme|anthem/i.test(b.id) ? 1 : 0) - (/theme|anthem/i.test(a.id) ? 1 : 0));
    return all;
  };
  AN.menu = function () {
    const pl = playlist();
    if (!pl.length) return false;
    wantMenu = true;
    if (menuOn && cur) return true;
    menuOn = true;
    idx = (idx + 1) % pl.length;
    play(pl[idx], 0, 1e9, () => { menuOn = false; if (wantMenu) AN.menu(); });
    AN.current = pl[idx];
    return true;
  };
  // what the menu music is playing (the main screen's "now playing" card) and skipping to the next song
  AN.nowPlaying = () => (menuOn && cur ? AN.current : null);
  AN.skip = () => { if (menuOn && cur) { const was = wantMenu; stopNow(); menuOn = false; if (was) AN.menu(); } };
  AN.menuOff = function () { wantMenu = false; if (menuOn) AN.stop(); };
  // autoplay is blocked until the first click/key: retry then
  const retry = () => { if (cur && cur.blocked) { cur.blocked = false; const p = cur.a.play(); if (p && p.catch) p.catch(() => {}); } };
  window.addEventListener('pointerdown', retry);
  window.addEventListener('keydown', retry);

  // the built-in synth menu music steps aside when there are real songs
  const A = BL.Audio;
  if (A) {
    const start = A.startMusic, stop = A.stopMusic;
    A.startMusic = function () { if (AN.menu()) return; return start.apply(A, arguments); };
    A.stopMusic = function () { AN.menuOff(); return stop.apply(A, arguments); };
  }
})(window.BL);
