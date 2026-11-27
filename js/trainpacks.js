'use strict';
// Rocket League (fan remake) - Custom Training (2026-11-24, "add custom training packs, look into the real UI"). Laid out
// the way the real game's is (from its patch notes and guides: a Featured / Created / Favorites / History list, codes,
// an editor where you place the ball and the car and aim the shot, packs played round by round with Shuffle, Mirror
// and randomness), drawn and written our own way. There's no server, so a pack's SHARE CODE carries the pack itself
// (paste it into ENTER CODE, or send the pack straight to a friend); its short code (XXXX-XXXX-XXXX-XXXX) finds a pack
// you already have.
//  A pack: { uid, name, creator, diff (rookie / pro / allstar), tags [], map, shots: [{ car: [x, z, yaw],
//            ball: [x, y, z], vel: [vx, vy, vz], boost, time }] }   (yaw: the car faces (sin yaw, cos yaw))
//  Playing (js/game.js: cfg.drill 'custom' + cfg.pack): the ball waits where it is until you move, then it's away;
//    score before the time runs out (Goalie packs: keep it out until then); Reset retries, the Free Play D-pad
//    left / right (2 / 3 on the keyboard) go back and on; every round you've beaten is ticked off.
//  Editing (cfg.packEdit): drive your car to where a round should start and SET SPAWN; place and aim the ball with the
//    panel (its flight is drawn as you change it); ADD / COPY / DELETE rounds; TEST plays the round; SAVE names it.
(function (BL) {
  const TP = BL.TrainPacks = {};
  const U = BL.util, S = BL.Save, V3 = THREE.Vector3;
  const MAX_SHOTS = 30, ARENA = () => BL.Physics.arena;
  TP.DIFFS = [['rookie', 'ROOKIE', '#7dd3fc'], ['pro', 'PRO', '#fbbf24'], ['allstar', 'ALL-STAR', '#f87171']];
  TP.TAGS = [['striker', 'Striker'], ['goalie', 'Goalie'], ['aerial', 'Aerial'], ['wall', 'Wall'], ['redirect', 'Redirect'], ['dribble', 'Dribble'], ['defense', 'Defense'], ['recovery', 'Recovery']];
  const esc = (s) => U.esc(String(s == null ? '' : s));
  const store = () => { const p = S.p; p.packs = p.packs || {}; const k = p.packs; k.created = k.created || []; k.favs = k.favs || []; k.history = k.history || []; k.got = k.got || []; return k; };
  const diffOf = (d) => TP.DIFFS.find((x) => x[0] === d) || TP.DIFFS[0];
  const copyShot = (s) => ({ car: s.car.slice(), ball: s.ball.slice(), vel: s.vel.slice(), boost: s.boost == null ? 100 : s.boost, time: s.time || 10 });
  const isGoalie = (pk) => (pk.tags || []).indexOf('goalie') >= 0 || (pk.tags || []).indexOf('defense') >= 0;

  // ---------- share codes: the whole pack, packed small ----------
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
  const q16 = (v, k) => Math.max(-32767, Math.min(32767, Math.round((+v || 0) * k)));
  TP.encode = function (pk) {
    const enc = new TextEncoder(), nm = enc.encode(String(pk.name || 'Pack').slice(0, 32)), cr = enc.encode(String(pk.creator || '').slice(0, 20)), mp = enc.encode(String(pk.map || '').slice(0, 20));
    const shots = pk.shots.slice(0, MAX_SHOTS), size = 8 + nm.length + cr.length + mp.length + shots.length * 20 + 2;
    const u = new Uint8Array(size), dv = new DataView(u.buffer);
    let o = 0;
    const tagBits = TP.TAGS.reduce((b, t, i) => b | ((pk.tags || []).indexOf(t[0]) >= 0 ? 1 << i : 0), 0);
    u[o++] = 1; u[o++] = Math.max(0, TP.DIFFS.findIndex((d) => d[0] === pk.diff)); u[o++] = tagBits; u[o++] = shots.length;
    for (const b of [nm, cr, mp]) { u[o++] = b.length; u.set(b, o); o += b.length; }
    o++; // (spare)
    for (const s of shots) {
      for (const [v, k] of [[s.car[0], 10], [s.car[1], 10], [s.car[2], 10000], [s.ball[0], 10], [s.ball[1], 10], [s.ball[2], 10], [s.vel[0], 10], [s.vel[1], 10], [s.vel[2], 10]]) { dv.setInt16(o, q16(v, k)); o += 2; }
      u[o++] = Math.max(0, Math.min(100, Math.round(s.boost == null ? 100 : s.boost))); u[o++] = Math.max(2, Math.min(60, Math.round(s.time || 10)));
    }
    let sum = 0; for (let i = 0; i < o; i++) sum = (sum + u[i] * (i + 1)) & 0xffff;
    dv.setUint16(o, sum); o += 2;
    return 'TP1-' + b64(u.subarray(0, o));
  };
  TP.decode = function (code) {
    try {
      const m = /^\s*TP1-([A-Za-z0-9_-]+)\s*$/.exec(code || '');
      if (!m) return null;
      const u = unb64(m[1]), dv = new DataView(u.buffer);
      if (u.length < 12 || u[0] !== 1) return null;
      let sum = 0; for (let i = 0; i < u.length - 2; i++) sum = (sum + u[i] * (i + 1)) & 0xffff;
      if (sum !== dv.getUint16(u.length - 2)) return null;
      const dec = new TextDecoder();
      let o = 4;
      const str = () => { const n = u[o++]; const s = dec.decode(u.subarray(o, o + n)); o += n; return s; };
      const name = str(), creator = str(), map = str(); o++;
      const n = Math.min(u[3], MAX_SHOTS), shots = [];
      for (let i = 0; i < n; i++) {
        const v = []; for (let k = 0; k < 9; k++) { v.push(dv.getInt16(o)); o += 2; }
        shots.push({ car: [v[0] / 10, v[1] / 10, v[2] / 10000], ball: [v[3] / 10, v[4] / 10, v[5] / 10], vel: [v[6] / 10, v[7] / 10, v[8] / 10], boost: u[o++], time: u[o++] });
      }
      if (!shots.length) return null;
      const tags = TP.TAGS.filter((t, i) => u[2] & (1 << i)).map((t) => t[0]);
      return { name: BL.NameFilter ? BL.NameFilter.clean(name) : name, creator: BL.NameFilter ? BL.NameFilter.clean(creator) : creator, map: BL.MAP_BY_ID[map] ? map : '', diff: (TP.DIFFS[u[1]] || TP.DIFFS[0])[0], tags, shots };
    } catch (e) { return null; }
  };
  // the short code: 16 hex digits from the pack's contents, in fours
  TP.codeOf = function (pk) {
    const s = TP.encode(pk), h = (x) => (U.hash(x) >>> 0).toString(16).toUpperCase().padStart(8, '0'), c = h(s) + h('tp' + s);
    return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12) + '-' + c.slice(12, 16);
  };

  // ---------- the featured packs (made here, the same for everyone) ----------
  function featured() {
    if (TP._feat) return TP._feat;
    const A = { hw: 40.96, hl: 51.2, goalHW: 8.93, goalH: 6.43 };
    const mk = (name, diff, tags, n, f) => { const rnd = U.rng(U.hash(name)), R = (a, b) => a + rnd() * (b - a), shots = []; for (let i = 0; i < n; i++) shots.push(f(i, R)); return { name, creator: 'Training Team', diff, tags, map: '', shots, featured: true }; };
    const face = (x, z, tx, tz) => [x, z, Math.atan2(tx - x, tz - z)];
    TP._feat = [
      mk('Rolling Finishes', 'rookie', ['striker'], 8, (i, R) => { const side = i % 2 ? 1 : -1, bx = side * R(8, 16); return { car: face(R(-6, 6), R(-22, -12), 0, A.hl), ball: [bx, 0.93, R(8, 22)], vel: [-side * R(4, 8), 0, R(0, 3)], boost: 100, time: 8 }; }),
      mk('Power Shots', 'pro', ['striker'], 8, (i, R) => ({ car: face(R(-8, 8), R(-24, -16), 0, 0), ball: [R(-14, 14), R(1, 3), R(18, 32)], vel: [R(-3, 3), R(4, 8), R(-16, -11)], boost: 100, time: 7 })),
      mk('Shadow Saves', 'pro', ['goalie'], 8, (i, R) => {
        const bx = R(-30, 30), by = R(1, 7), bz = R(-12, 18), tx = R(-A.goalHW + 1.5, A.goalHW - 1.5), ty = R(1, A.goalH - 1.4), tz = -A.hl - 2;
        const d = new V3(tx - bx, ty - by, tz - bz).normalize().multiplyScalar(R(18, 26));
        return { car: face(R(-3, 3), -A.hl + 5, 0, 0), ball: [bx, by, bz], vel: [d.x, d.y + 2.5, d.z], boost: 100, time: 6 };
      }),
      mk('First Aerials', 'rookie', ['aerial'], 8, (i, R) => { const bx = R(-12, 12), bz = R(0, 18); return { car: face(R(-6, 6), R(-22, -14), bx, bz), ball: [bx, R(8, 12), bz], vel: [R(-1, 1), R(1, 3), R(0, 2)], boost: 100, time: 8 }; }),
      mk('Wall Reads', 'allstar', ['wall', 'aerial'], 8, (i, R) => { const s = i % 2 ? 1 : -1; return { car: face(s * R(6, 14), R(-28, -18), s * A.hw, R(0, 10)), ball: [s * (A.hw - 1.4), R(1.5, 3), R(-8, 14)], vel: [s * R(1, 3), R(8, 12), R(3, 7)], boost: 100, time: 9 }; }),
      mk('Corner Crosses', 'allstar', ['redirect'], 8, (i, R) => { const s = i % 2 ? 1 : -1; return { car: face(R(-10, 10), R(-6, 6), 0, A.hl), ball: [s * (A.hw - 6), R(1, 2), A.hl - R(8, 16)], vel: [-s * R(11, 16), R(7, 11), R(-6, -2)], boost: 100, time: 7 }; }),
    ];
    for (const p of TP._feat) p.code = TP.codeOf(p);
    return TP._feat;
  }
  TP.featured = featured;
  const withCode = (p) => { if (!p.code) p.code = TP.codeOf(p); return p; };
  TP.created = () => store().created.map(withCode);
  TP.got = () => store().got.map(withCode);
  // every pack we know, to look a short code up in
  TP.all = () => featured().concat(TP.created(), TP.got());
  TP.byCode = (code) => { const c = String(code || '').toUpperCase().replace(/[^0-9A-F]/g, ''); return TP.all().find((p) => p.code.replace(/-/g, '') === c) || null; };
  TP.favs = () => store().favs.map(TP.byCode).filter(Boolean);
  TP.history = () => store().history.map(TP.byCode).filter(Boolean);
  TP.isFav = (p) => store().favs.indexOf(p.code) >= 0;
  TP.toggleFav = (p) => { const f = store().favs, i = f.indexOf(p.code); if (i >= 0) f.splice(i, 1); else f.unshift(p.code); S.save(); };
  // a pack from a code or a friend: kept (so its short code works) and in History
  TP.receive = function (pk, from) {
    const known = TP.byCode(TP.codeOf(pk));
    if (known) return known;
    const p = Object.assign({ uid: U.uid(), from: from || '' }, pk);
    p.code = TP.codeOf(p);
    store().got.unshift(p); if (store().got.length > 60) store().got.length = 60;
    S.save();
    return p;
  };
  function remember(p) { const h = store().history, i = h.indexOf(p.code); if (i >= 0) h.splice(i, 1); h.unshift(p.code); if (h.length > 20) h.length = 20; S.save(); }
  TP.save = function (pk) {
    const L = store().created, p = Object.assign({}, pk, { creator: pk.creator || S.p.name, shots: pk.shots.map(copyShot) });
    p.uid = p.uid || U.uid(); delete p.code; delete p.featured;
    p.code = TP.codeOf(p);
    const i = L.findIndex((x) => x.uid === p.uid);
    if (i >= 0) L[i] = p; else L.unshift(p);
    S.save();
    return p;
  };
  TP.remove = (p) => { const L = store().created, i = L.findIndex((x) => x.uid === p.uid); if (i >= 0) { L.splice(i, 1); S.save(); } };
  // a friend sent one (js/friends.js passes 'tpack' messages here)
  TP.onFriend = function (m, isFriend) {
    if (!isFriend || !m.from) return;
    const pk = TP.decode(m.code);
    if (!pk) return;
    const p = TP.receive(pk, m.from.name);
    if (BL.Menu && BL.Menu.toast) BL.Menu.toast(m.from.name + ' sent you a training pack: ' + p.name + ' (Training > Custom Training > History)');
    remember(p);
  };

  // ---------- playing a pack (js/game.js calls these for cfg.drill === 'custom') ----------
  TP.drill = function (cfg, g) {
    const pk = cfg.pack, o = Object.assign({ shuffle: false, mirror: false, variance: 0, unlimited: false }, cfg.tpOpts || {});
    const order = pk.shots.map((s, i) => i);
    if (o.shuffle) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (!o.unlimited) g.env.unlimitedBoost = false;
    remember(withCode(pk));
    return { kind: 'custom', name: pk.name, n: pk.shots.length, i: 0, t: 0, pack: pk, order, opts: o, wait: true, beaten: new Set(), tries: 0, goalie: isGoalie(pk) };
  };
  const tmpV = new V3();
  // place a round: the car on its spot, the ball waiting in the air (or on the ground) until you move
  function setRound(g, s, o, d) {
    const car = g.local, b = g.ball, m = o && o.mirror ? -1 : 1, v = (o && o.variance) || 0;
    const jit = (r) => (v ? (Math.random() * 2 - 1) * r * v : 0);
    const cx = m * s.car[0] + jit(1.5), cz = s.car[1] + jit(1.5), yaw = m * s.car[2] + jit(0.12);
    car.place(cx, cz, cx + Math.sin(yaw) * 10, cz + Math.cos(yaw) * 10);
    car.vel.set(0, 0, 0); car.angVel.set(0, 0, 0);
    car.boost = s.boost == null ? 100 : s.boost;
    car.visOff.set(0, 0, 0); car.rq.copy(car.quat);
    b.reset(m * s.ball[0] + jit(2.5), Math.max(b.r, s.ball[1] + jit(1.2)), s.ball[2] + jit(2.5));
    b.frozen = 1e9; // (until you move)
    const k = 1 + jit(0.12);
    if (d) d.launch = tmpV.set(m * s.vel[0] * k, s.vel[1] * k, s.vel[2] * k).toArray();
    g.ballOff.set(0, 0, 0);
  }
  TP.setRound = setRound;
  const moved = (c) => Math.abs(c.throttle) > 0.15 || Math.abs(c.steer) > 0.3 || c.boost || c.jump || Math.abs(c.pitch) > 0.3;
  function launch(g, d) { const b = g.ball; b.frozen = 0; b.vel.fromArray(d.launch || [0, 0, 0]); b.angVel.set(0, 0, 0); d.wait = false; d.t = 0; }
  // advance: called after a goal (js/game.js phaseLogic) or with next === false to retry / step
  TP.shot = function (g, next, step) {
    const d = g.drill, pk = d.pack;
    if (next) {
      // a goal: in your opponent's net beats the round; in yours (Goalie packs) it doesn't
      const lg = g.lastGoal, scoredOn = lg && lg.team !== 0;
      const won = d.goalie ? false : !scoredOn;
      if (won) { d.beaten.add(d.order[d.i]); d.i = (d.i + 1) % d.n; } else d.tries++;
    }
    if (step) d.i = (d.i + step + d.n) % d.n;
    d.wait = true; d.t = 0;
    setRound(g, pk.shots[d.order[d.i]], d.opts, d);
    g.phase = 'play';
    if (!g.headless) {
      if (d.beaten.size === d.n && !d.allDone) { d.allDone = true; BL.HUD.big('PACK COMPLETE', d.n + ' / ' + d.n + ' ROUNDS • keep going, or the menu to stop', '#7dff9a', 3); }
      else BL.HUD.big('ROUND ' + (d.i + 1) + ' / ' + d.n, pk.name, '#ffffff', 1.1);
      TP.hud(g);
    }
  };
  // each frame of a pack: the launch, the clock, the keys
  TP.timer = function (g, dt) {
    const d = g.drill;
    if (d.wait) { if (moved(g.local.controls)) launch(g, d); }
    else {
      d.t += dt;
      const lim = (d.pack.shots[d.order[d.i]].time || 10);
      if (d.t > lim) {
        // time's up: a save for Goalie packs (on to the next), a miss for the rest (try it again)
        if (d.goalie) { d.beaten.add(d.order[d.i]); d.i = (d.i + 1) % d.n; if (!g.headless) BL.HUD.big('SAVED!', '', '#7dff9a', 0.8); } else { d.tries++; if (!g.headless) BL.HUD.big("TIME'S UP", 'try it again', '#ffb347', 0.8); }
        TP.shot(g, false);
      }
    }
    if (!g.headless) TP.hud(g);
  };
  TP.keys = function (g) {
    const I = BL.Input, d = g.drill;
    if (I.pressed('fpLaunch')) TP.shot(g, false, 1);
    else if (I.pressed('fpPass')) TP.shot(g, false, -1);
  };
  // the readout over the pitch
  TP.hud = function (g) {
    let el = document.getElementById('tpHud');
    if (!el) { el = document.createElement('div'); el.id = 'tpHud'; el.className = 'tp-hud'; document.body.appendChild(el); }
    const d = g.drill || (g.packEdit && g.packEdit.test);
    if (!d) { el.style.display = 'none'; return; }
    el.style.display = '';
    const lim = d.pack.shots[d.order ? d.order[d.i] : d.i].time || 10, left = d.wait ? lim : Math.max(0, lim - d.t);
    const k = BL.Input.KEYS, kn = (a) => (k[a] && k[a][0] ? BL.Input.keyName(k[a][0]) : '');
    const html = `<b>${esc(d.pack.name)}</b><div class="tp-row"><span>ROUND ${d.i + 1} / ${d.n}</span><span class="tp-clock ${!d.wait && left < 3 ? 'low' : ''}">${left.toFixed(1)}</span>${d.beaten ? `<span>${d.beaten.size} / ${d.n} DONE</span>` : ''}</div>
      <small>${d.wait ? 'MOVE TO START' : d.goalie ? 'KEEP IT OUT' : 'SCORE!'} &bull; RESET ${esc(kn('reset'))}${g.drill ? ` &bull; PREVIOUS ${esc(kn('fpPass'))} &bull; NEXT ${esc(kn('fpLaunch'))}` : ' &bull; back to the editor'}</small>`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
  };
  TP.cleanup = function (g) {
    const el = document.getElementById('tpHud'); if (el) el.style.display = 'none';
    const p = document.getElementById('tpEdit'); if (p) p.remove();
    if (g && g.packEdit && g.packEdit.vis) { for (const o of g.packEdit.vis) { if (o.parent) o.parent.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); } g.packEdit.vis = null; }
  };

  // ---------- the editor (js/game.js: cfg.packEdit = { pack }) ----------
  const BALL_R = 0.9125;
  TP.editStart = function (g, cfg) {
    const pk = cfg.pack ? JSON.parse(JSON.stringify(cfg.pack)) : null;
    const draft = pk || { name: 'My Training', diff: 'rookie', tags: ['striker'], map: '', shots: [] };
    if (!draft.shots.length) draft.shots.push({ car: [0, -20, 0], ball: [0, BALL_R, 0], vel: [0, 4, 10], boost: 100, time: 10 });
    const E = { pack: draft, i: 0, test: null, dirty: true, vis: [] };
    g.packEdit = E;
    if (!g.headless) build(g, E);
    pick(g, E, 0);
    return E;
  };
  const cur = (E) => E.pack.shots[E.i];
  function pick(g, E, i) {
    E.i = Math.max(0, Math.min(E.pack.shots.length - 1, i));
    setRound(g, cur(E), null, null);
    E.dirty = true;
    panel(g, E);
  }
  TP.editTick = function (g, dt) {
    const E = g.packEdit, I = BL.Input, b = g.ball;
    if (E.test) {
      const d = E.test;
      if (I.pressed('reset')) { stopTest(g, E); return; }
      if (d.wait) { if (moved(g.local.controls)) launch(g, d); } else { d.t += dt; if (d.t > (cur(E).time || 10) + 0.5) stopTest(g, E, "TIME'S UP"); }
      TP.hud(g);
      return;
    }
    // (editing: the ball stays put where the round has it, whatever bumps it)
    const s = cur(E);
    b.pos.set(s.ball[0], Math.max(b.r, s.ball[1]), s.ball[2]); b.vel.set(0, 0, 0); b.angVel.set(0, 0, 0); b.frozen = 1e9;
    if (I.pressed('reset')) pick(g, E, E.i);
    if (E.dirty && !g.headless) { E.dirty = false; preview(g, E); }
  };
  // after a goal while testing: back to editing
  TP.editGoal = function (g) { const E = g.packEdit; if (E && E.test) stopTest(g, E, g.lastGoal && g.lastGoal.team === 0 ? 'GOAL!' : 'SCORED ON'); else if (E) pick(g, E, E.i); g.phase = 'play'; };
  function startTest(g, E) {
    E.test = { pack: E.pack, i: E.i, n: E.pack.shots.length, wait: true, t: 0, goalie: isGoalie(E.pack) };
    setRound(g, cur(E), null, E.test);
    for (const o of E.vis) o.visible = false;
    panel(g, E);
    if (BL.Input.tryLock) BL.Input.tryLock();
    if (!g.headless) BL.HUD.big('TEST ROUND ' + (E.i + 1), 'move to start • Reset to stop', '#ffffff', 1.2);
  }
  function stopTest(g, E, why) {
    E.test = null;
    TP.hud(g);
    for (const o of E.vis) o.visible = true;
    pick(g, E, E.i);
    if (why && !g.headless) BL.HUD.big(why, 'back to the editor', '#ffffff', 1);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  // the ball's flight (the physics' own prediction), and where the car starts
  function preview(g, E) {
    const s = cur(E), Phys = BL.Physics, b = new Phys.Ball(g.ball.r);
    b.pos.fromArray([s.ball[0], Math.max(b.r, s.ball[1]), s.ball[2]]); b.vel.fromArray(s.vel);
    const pts = Phys.predictBall(b, 3, 1 / 30, g.env, []);
    if (!E.line) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(91 * 3), 3));
      E.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthTest: false }));
      E.line.frustumCulled = false; E.line.renderOrder = 9; g.scene.add(E.line); E.vis.push(E.line);
      const dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, depthTest: false }));
      dots.frustumCulled = false; dots.renderOrder = 9; g.scene.add(dots); E.vis.push(dots);
      // the spawn: an arrow on the ground the length of a car
      const ag = new THREE.ShapeGeometry(new THREE.Shape([[-1, -2], [1, -2], [1, 0.6], [1.8, 0.6], [0, 2.6], [-1.8, 0.6], [-1, 0.6]].map(([x, y]) => new THREE.Vector2(x, y))));
      ag.scale(0.42, 0.42, 1); ag.rotateX(-Math.PI / 2); // (about a car's length)
      E.arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0x21d4fd, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      E.arrow.renderOrder = 3; g.scene.add(E.arrow); E.vis.push(E.arrow);
    }
    const arr = E.line.geometry.attributes.position.array;
    arr[0] = b.pos.x; arr[1] = b.pos.y; arr[2] = b.pos.z;
    let n = 1;
    for (const p of pts) { if (n >= 91) break; arr[n * 3] = p.x; arr[n * 3 + 1] = p.y; arr[n * 3 + 2] = p.z; n++; }
    E.line.geometry.setDrawRange(0, n); E.line.geometry.attributes.position.needsUpdate = true;
    E.arrow.position.set(s.car[0], 0.08, s.car[1]); E.arrow.rotation.set(0, s.car[2], 0);
  }

  // ---------- the editor's panel ----------
  const SL = [
    ['bx', 'BALL ACROSS', -40, 40, 0.5, (s) => s.ball[0], (s, v) => { s.ball[0] = v; }],
    ['bz', 'BALL ALONG', -50, 50, 0.5, (s) => s.ball[2], (s, v) => { s.ball[2] = v; }],
    ['by', 'BALL HEIGHT', 0.9, 19, 0.1, (s) => s.ball[1], (s, v) => { s.ball[1] = v; }],
    ['yaw', 'SHOT DIRECTION', -180, 180, 1, (s) => Math.round((Math.atan2(s.vel[0], s.vel[2]) * 180) / Math.PI), null],
    ['lift', 'SHOT LIFT', -40, 80, 1, (s) => Math.round((Math.atan2(s.vel[1], Math.hypot(s.vel[0], s.vel[2])) * 180) / Math.PI), null],
    ['spd', 'SHOT SPEED', 0, 45, 0.5, (s) => +Math.hypot(s.vel[0], s.vel[1], s.vel[2]).toFixed(1), null],
    ['boost', 'CAR BOOST', 0, 100, 1, (s) => s.boost == null ? 100 : s.boost, (s, v) => { s.boost = v; }],
    ['time', 'TIME LIMIT', 3, 30, 1, (s) => s.time || 10, (s, v) => { s.time = v; }],
  ];
  // the shot from direction, lift and speed
  function setShot(s, yawDeg, liftDeg, spd) {
    const y = (yawDeg * Math.PI) / 180, l = (liftDeg * Math.PI) / 180;
    s.vel = [Math.sin(y) * Math.cos(l) * spd, Math.sin(l) * spd, Math.cos(y) * Math.cos(l) * spd].map((v) => +v.toFixed(2));
  }
  function build(g, E) {
    let el = document.getElementById('tpEdit');
    if (el) el.remove();
    el = document.createElement('div'); el.id = 'tpEdit'; el.className = 'tp-edit';
    document.body.appendChild(el);
    // (clicks and drags here are the editor's, not the car's boost)
    for (const ev of ['mousedown', 'pointerdown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { const t = e.target.closest('[data-tp]'); if (t) act(g, E, t.getAttribute('data-tp'), t.getAttribute('data-arg')); });
    el.addEventListener('input', (e) => {
      const t = e.target, k = t.getAttribute('data-sl');
      if (!k) { if (t.id === 'tpName') E.pack.name = t.value.slice(0, 32); return; }
      const s = cur(E), v = +t.value, sl = SL.find((x) => x[0] === k);
      if (sl[6]) sl[6](s, v);
      else { const val = (kk) => +el.querySelector('[data-sl="' + kk + '"]').value; setShot(s, val('yaw'), val('lift'), val('spd')); }
      const out = el.querySelector('[data-out="' + k + '"]'); if (out) out.textContent = v;
      E.dirty = true;
    });
    // (let go of a slider: the keys drive the car again)
    el.addEventListener('change', (e) => { if (e.target.type === 'range') e.target.blur(); });
  }
  function panel(g, E) {
    const el = document.getElementById('tpEdit');
    if (!el) return;
    const s = cur(E), n = E.pack.shots.length;
    if (E.test) { el.classList.add('testing'); el.innerHTML = `<div class="tp-h">TESTING ROUND ${E.i + 1}</div><p>Move to start. Reset (${esc(BL.Input.keyName((BL.Input.KEYS.reset || [])[0] || ''))}) stops the test.</p><button class="rl-btn" data-tp="stop">BACK TO EDITING</button>`; return; }
    el.classList.remove('testing');
    el.innerHTML = `<div class="tp-h">TRAINING EDITOR</div>
      <input id="tpName" maxlength="32" value="${esc(E.pack.name)}" placeholder="Pack name">
      <div class="tp-rounds">${E.pack.shots.map((x, i) => `<button class="tp-r ${i === E.i ? 'on' : ''}" data-tp="pick" data-arg="${i}">${i + 1}</button>`).join('')}${n < MAX_SHOTS ? '<button class="tp-r add" data-tp="add" title="Add a round (a copy of this one)">+</button>' : ''}</div>
      <div class="tp-btns"><button class="rl-btn" data-tp="dup">COPY ROUND</button><button class="rl-btn" data-tp="del" ${n < 2 ? 'disabled' : ''}>DELETE ROUND</button></div>
      <div class="tp-sec">CAR <small>drive it to where the round starts</small></div>
      <div class="tp-btns"><button class="rl-btn hot" data-tp="spawn">SET SPAWN HERE</button></div>
      <div class="tp-sec">BALL</div>
      <div class="tp-btns"><button class="rl-btn" data-tp="ballcar">BALL IN FRONT OF CAR</button><button class="rl-btn" data-tp="aimcam">AIM WHERE I LOOK</button></div>
      ${SL.map(([k, label, a, b, st, get]) => `<label class="tp-sl"><span>${label}</span><input type="range" data-sl="${k}" min="${a}" max="${b}" step="${st}" value="${get(s)}"><em data-out="${k}">${get(s)}</em></label>`).join('')}
      <div class="tp-btns"><button class="rl-btn hot" data-tp="test">TEST ROUND</button><button class="rl-btn" data-tp="save">SAVE PACK</button><button class="rl-btn" data-tp="exit">EXIT</button></div>
      <small class="tp-note">Round ${E.i + 1} of ${n} (up to ${MAX_SHOTS}). The yellow line is where the ball will go.</small>`;
  }
  function act(g, E, a, arg) {
    const s = cur(E), car = g.local;
    if (a === 'pick') pick(g, E, +arg);
    else if (a === 'add' || a === 'dup') { if (E.pack.shots.length < MAX_SHOTS) { E.pack.shots.splice(E.i + 1, 0, copyShot(s)); pick(g, E, E.i + 1); } }
    else if (a === 'del') { if (E.pack.shots.length > 1) { E.pack.shots.splice(E.i, 1); pick(g, E, Math.min(E.i, E.pack.shots.length - 1)); } }
    else if (a === 'spawn') { s.car = [+car.pos.x.toFixed(2), +car.pos.z.toFixed(2), +Math.atan2(car.fwd.x, car.fwd.z).toFixed(4)]; E.dirty = true; BL.HUD.big('SPAWN SET', 'round ' + (E.i + 1), '#21d4fd', 0.8); }
    else if (a === 'ballcar') { const f = new V3(car.fwd.x, 0, car.fwd.z).normalize(); s.ball = [+(car.pos.x + f.x * 7).toFixed(2), Math.max(BALL_R, +(car.pos.y + 0.6).toFixed(2)), +(car.pos.z + f.z * 7).toFixed(2)]; E.dirty = true; panel(g, E); }
    else if (a === 'aimcam') { const d = new V3(); g.camera.getWorldDirection(d); const sp = Math.max(8, Math.hypot(s.vel[0], s.vel[1], s.vel[2])); setShot(s, (Math.atan2(d.x, d.z) * 180) / Math.PI, (Math.asin(U.clamp(d.y, -1, 1)) * 180) / Math.PI, sp); E.dirty = true; panel(g, E); }
    else if (a === 'test') startTest(g, E);
    else if (a === 'stop') stopTest(g, E);
    else if (a === 'save') saveForm(g, E);
    else if (a === 'saveGo') {
      const el = document.getElementById('tpEdit');
      E.pack.diff = el.querySelector('[name="tpDiff"]:checked') ? el.querySelector('[name="tpDiff"]:checked').value : E.pack.diff;
      E.pack.tags = [...el.querySelectorAll('[data-tag]:checked')].map((x) => x.getAttribute('data-tag')).slice(0, 3);
      E.pack.map = el.querySelector('#tpMapHere') && el.querySelector('#tpMapHere').checked ? (g.map.variantOf || g.map.id) : '';
      const p = TP.save(E.pack); E.pack.uid = p.uid;
      BL.HUD.big('PACK SAVED', p.name + ' • ' + p.code, '#7dff9a', 1.8);
      panel(g, E);
    } else if (a === 'saveNo') panel(g, E);
    else if (a === 'exit') { TP.cleanup(g); BL.App.endGame(); if (BL.Menu) { BL.Menu.show('ctrain'); } }
  }
  function saveForm(g, E) {
    const el = document.getElementById('tpEdit'), pk = E.pack;
    el.innerHTML = `<div class="tp-h">SAVE PACK</div>
      <input id="tpName" maxlength="32" value="${esc(pk.name)}" placeholder="Pack name">
      <div class="tp-sec">DIFFICULTY</div><div class="tp-opts">${TP.DIFFS.map(([k, l, c]) => `<label><input type="radio" name="tpDiff" value="${k}" ${pk.diff === k ? 'checked' : ''}><b style="color:${c}">${l}</b></label>`).join('')}</div>
      <div class="tp-sec">TYPE <small>up to 3</small></div><div class="tp-opts">${TP.TAGS.map(([k, l]) => `<label><input type="checkbox" data-tag="${k}" ${(pk.tags || []).indexOf(k) >= 0 ? 'checked' : ''}>${l}</label>`).join('')}</div>
      <div class="tp-opts"><label><input type="checkbox" id="tpMapHere" ${pk.map ? 'checked' : ''}>Play it in this arena (${esc(g.map.name)})</label></div>
      <div class="tp-btns"><button class="rl-btn hot" data-tp="saveGo">SAVE</button><button class="rl-btn" data-tp="saveNo">BACK</button></div>`;
  }

  // ---------- the CUSTOM TRAINING screen (js/rlmenu.js shows it: Training > Custom Training) ----------
  const btn = (label, act, arg, cls, dis) => `<button class="rl-btn ${cls || ''}" data-act="${act}" data-arg="${esc(arg == null ? '' : arg)}" ${dis ? 'disabled' : ''}>${label}</button>`;
  const TABS = [['featured', 'FEATURED'], ['created', 'CREATED'], ['favorites', 'FAVORITES'], ['history', 'HISTORY']];
  const listFor = (tab) => (tab === 'created' ? TP.created() : tab === 'favorites' ? TP.favs() : tab === 'history' ? TP.history() : featured());
  const opts = () => Object.assign({ shuffle: false, mirror: false, variance: 0, unlimited: false }, S.p.settings.tpOpts || {});
  function tagChips(p) { return (p.tags || []).map((t) => `<i class="tp-tag">${esc((TP.TAGS.find((x) => x[0] === t) || [t, t])[1])}</i>`).join(''); }
  function screen() {
    const M = BL.Menu, tab = M.tpTab || 'featured', list = listFor(tab);
    const sel = list.find((p) => p.code === M.tpSel) || list[0] || null;
    if (sel) M.tpSel = sel.code;
    const mine = sel && TP.created().some((p) => p.code === sel.code), o = opts(), dd = sel ? diffOf(sel.diff) : null;
    const empty = { featured: '', created: 'Packs you make show here. CREATE TRAINING starts one.', favorites: 'Star a pack (FAVORITE) to keep it here.', history: 'Packs you play, find by code or get sent show here.' }[tab];
    return `<div class="tp-screen">
      <div class="tp-tabs">${TABS.map(([k, l]) => `<button class="tp-tab ${k === tab ? 'on' : ''}" data-act="tpTab" data-arg="${k}">${l}</button>`).join('')}</div>
      <div class="tp-body">
        <div class="tp-list">${list.length ? list.map((p) => { const d = diffOf(p.diff); return `<button class="tp-item ${sel && p.code === sel.code ? 'on' : ''}" data-act="tpSel" data-arg="${p.code}">
            <span class="tp-nm">${TP.isFav(p) ? '<b class="tp-star">★</b>' : ''}${esc(p.name)}</span><span class="tp-meta">${tagChips(p)}<b style="color:${d[2]}">${d[1]}</b><em>${p.shots.length} SHOTS</em><small>${esc(p.creator || '')}</small></span></button>`; }).join('') : `<p class="muted tp-empty">${empty}</p>`}</div>
        <div class="tp-detail">${sel ? `<h2>${esc(sel.name)}</h2>
          <div class="tp-by">BY ${esc((sel.creator || 'YOU').toUpperCase())}${sel.from ? ' &bull; FROM ' + esc(sel.from.toUpperCase()) : ''}</div>
          <div class="tp-facts"><div><small>CODE</small><b class="tp-code" data-act="tpCopyShort" title="Copy">${sel.code}</b></div><div><small>DIFFICULTY</small><b style="color:${dd[2]}">${dd[1]}</b></div><div><small>SHOTS</small><b>${sel.shots.length}</b></div><div><small>ARENA</small><b>${esc(sel.map && BL.MAP_BY_ID[sel.map] ? BL.MAP_BY_ID[sel.map].name.toUpperCase() : 'TRAINING ARENA')}</b></div></div>
          <div class="tp-tags">${tagChips(sel)}</div>
          <div class="tp-sec">TRAINING OPTIONS</div>
          <div class="tp-optrow">${[['shuffle', 'SHUFFLE'], ['mirror', 'MIRROR'], ['unlimited', 'UNLIMITED BOOST']].map(([k, l]) => `<button class="tp-tog ${o[k] ? 'on' : ''}" data-act="tpOpt" data-arg="${k}">${l}</button>`).join('')}
            <button class="tp-tog ${o.variance ? 'on' : ''}" data-act="tpOpt" data-arg="variance">RANDOMNESS: ${['OFF', 'LOW', 'HIGH'][o.variance] || 'OFF'}</button></div>
          <small class="muted">Randomness moves the ball and the car a little and changes the ball's speed each time. Mirror flips every shot left to right.</small>
          <div class="tp-acts">${btn('PLAY', 'tpPlay', sel.code, 'hot')}${btn(TP.isFav(sel) ? '★ FAVORITE' : '☆ FAVORITE', 'tpFav', sel.code)}${btn('COPY SHARE CODE', 'tpShare', sel.code)}${btn('SEND TO FRIEND', 'tpSend', sel.code, '', !(S.p.friends || []).length)}
            ${mine ? btn('EDIT', 'tpEdit', sel.code) + btn('DELETE', 'tpDel', sel.code, 'warn') : btn('COPY TO MY PACKS', 'tpClone', sel.code)}</div>` : '<p class="muted">No pack picked.</p>'}</div>
      </div></div>`;
  }
  const arena = (p) => (p && p.map && BL.MAP_BY_ID[p.map] ? p.map : (() => { const id = S.p.settings.fpMap; return id && id !== 'random' && BL.MAP_BY_ID[id] ? id : 'champions'; })());
  const me = () => [{ id: 0, name: S.p.name, team: 0, isLocal: true, loadout: S.resolveLoadout() }];
  TP.play = function (p) { BL.Menu.closeOverlay(); BL.App.startMatch({ mode: 'freeplay', mapId: arena(p), mutators: BL.defaultMutators(), players: me(), ranked: null, botSkill: 0.5, drill: 'custom', pack: p, tpOpts: opts() }); };
  TP.edit = function (p) { BL.Menu.closeOverlay(); BL.App.startMatch({ mode: 'freeplay', mapId: arena(p), mutators: BL.defaultMutators(), players: me(), ranked: null, botSkill: 0.5, packEdit: { pack: p || null } }); };
  const copyText = (t, ok) => { const M = BL.Menu; if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => M.toast(ok), () => M.toast(t.slice(0, 60) + '...')); else M.toast(t.slice(0, 60)); };
  function codeDialog() {
    BL.Menu.openOverlay(`<div class="dlg rl-dlg"><h2>ENTER CODE</h2><p class="muted small">Paste a pack's SHARE CODE (it starts TP1-), or type the short code of a pack you already have.</p>
      <textarea id="tpCodeIn" rows="4" placeholder="TP1-... or XXXX-XXXX-XXXX-XXXX" style="width:100%"></textarea>
      <div class="row end">${btn('CANCEL', 'closeOv')}${btn('FIND PACK', 'tpCodeGo', '', 'hot')}</div></div>`);
    setTimeout(() => { const t = document.getElementById('tpCodeIn'); if (t) t.focus(); }, 30);
  }
  function sendDialog(p) {
    const fr = S.p.friends || [];
    BL.Menu.openOverlay(`<div class="dlg rl-dlg"><h2>SEND ${esc(p.name.toUpperCase())}</h2><p class="muted small">Your friend's game has to be open to get it.</p>
      <div class="tp-friends">${fr.map((f) => `<button class="rl-btn" data-act="tpSendTo" data-arg="${esc(f.code)}">${esc(f.name)}${BL.Friends && BL.Friends.isOnline && BL.Friends.isOnline(f.code) ? ' <small style="color:#7dff9a">ONLINE</small>' : ''}</button>`).join('')}</div>
      <div class="row end">${btn('CLOSE', 'closeOv')}</div></div>`);
  }
  const hook = () => {
    const M = BL.Menu, X = M && M._x;
    if (!X || !X.SCREENS || !X.ACT) return false;
    X.SCREENS.ctrain = screen;
    const A = X.ACT, find = (c) => TP.byCode(c), re = () => M.render();
    A.customTraining = () => { M.closeOverlay(); A.go('ctrain'); };
    A.tpTab = (t) => { M.tpTab = t; M.tpSel = null; re(); };
    A.tpSel = (c) => { M.tpSel = c; re(); };
    A.tpOpt = (k) => { const o = opts(); if (k === 'variance') o.variance = (o.variance + 1) % 3; else o[k] = !o[k]; S.p.settings.tpOpts = o; S.save(); re(); };
    A.tpPlay = (c) => { const p = find(c); if (p) TP.play(p); };
    A.tpFav = (c) => { const p = find(c); if (p) { TP.toggleFav(p); re(); } };
    A.tpShare = (c) => { const p = find(c); if (p) copyText(TP.encode(p), 'Share code copied: paste it into ENTER CODE on any copy of the game'); };
    A.tpCopyShort = () => { if (M.tpSel) copyText(M.tpSel, 'Code copied'); };
    A.tpSend = (c) => { const p = find(c); if (p) sendDialog(p); };
    A.tpSendTo = (fc) => {
      const p = find(M.tpSel); if (!p || !BL.Friends) return;
      const f = (S.p.friends || []).find((x) => x.code === fc), nm = f ? f.name : 'your friend';
      BL.Friends.send(fc, { t: 'tpack', code: TP.encode(p) }, (ok) => M.toast(ok ? 'Sent ' + p.name + ' to ' + nm : nm + " isn't online right now"));
      M.closeOverlay();
    };
    A.tpEdit = (c) => { const p = find(c); if (p) TP.edit(p); };
    A.tpCreate = () => TP.edit(null);
    A.tpClone = (c) => {
      const p = find(c); if (!p) return;
      const q = TP.save(Object.assign(JSON.parse(JSON.stringify(p)), { uid: null, name: (p.name + ' (copy)').slice(0, 32), creator: S.p.name, featured: false, from: '' }));
      M.tpTab = 'created'; M.tpSel = q.code; M.toast('Copied to your packs: edit it as you like'); re();
    };
    A.tpDel = (c) => { const p = find(c); if (!p) return; M.openOverlay(`<div class="dlg rl-dlg"><h2>DELETE ${esc(p.name.toUpperCase())}?</h2><p class="muted small">It can't be brought back (unless you kept its share code).</p><div class="row end">${btn('CANCEL', 'closeOv')}${btn('DELETE', 'tpDelGo', c, 'warn')}</div></div>`); };
    A.tpDelGo = (c) => { const p = find(c); if (p) TP.remove(p); M.closeOverlay(); M.tpSel = null; re(); };
    A.tpCode = () => codeDialog();
    A.tpCodeGo = () => {
      const v = (document.getElementById('tpCodeIn') || {}).value || '';
      let p = /^\s*TP1-/.test(v) ? TP.decode(v) : null;
      if (p) p = TP.receive(p);
      else p = TP.byCode(v);
      if (!p) { M.toast("That code doesn't match a pack: check you copied all of it"); return; }
      remember(p); M.closeOverlay(); M.tpTab = 'history'; M.tpSel = p.code; M.toast('Found ' + p.name); re();
    };
    return true;
  };
  if (!hook()) window.addEventListener('load', hook);
})(window.BL);
