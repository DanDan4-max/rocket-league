'use strict';
// Rocket League (fan remake) - clubs: your club tag on your name in every match (and online, for everyone to see),
// a roster that stays the same for every member, shared milestone stats and club scrimmages.
// Peer-to-peer like friends (js/friends.js), with nothing stored online: the club's owner keeps the club, and
// every member's game checks in with the owner's game whenever both are open (every 30 s, and right after a
// match). The owner sends back the club as it is now: name, tag, colours, roster, stats and who's online.
//   cinv   invite (friends only, js/friends.js)       chi    member -> owner: here I am (+ my new match stats)
//   csync  owner -> member: the club as it is now     cleave member -> owner: I left
//   ckick  owner -> member: you were removed           cgone  owner -> member: the club was disbanded
//   cmove  old owner -> member: the club has a new owner (they left and handed it over)
//   csinv  any member -> member: join my club scrimmage (a party invite that doesn't need friends)
(function (BL) {
  const S = BL.Save, U = BL.util;
  const C = BL.Club = { seen: {} };
  const MAX = 20, ONLINE_MS = 75000;
  const KEYS = ['goals', 'saves', 'assists', 'wins', 'matches'];
  const zero = () => ({ goals: 0, saves: 0, assists: 0, wins: 0, matches: 0 });
  const Fr = () => BL.Friends;
  const myCode = () => (Fr() ? Fr().code() : S.p.friendCode || '');
  const send = (code, msg, cb) => { if (Fr() && code) Fr().send(code, msg, cb); else if (cb) cb(false); };
  const toast = (t) => { if (BL.Menu && BL.Menu.toast) BL.Menu.toast(t); };
  const changed = () => { S.save(); if (BL.bus) BL.bus.emit('friends'); };
  const cleanName = (n) => String(n == null ? '' : n).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  const cleanCode = (c) => { const s = String(c == null ? '' : c).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); return s || null; };
  const num = (v) => Math.max(0, Math.min(1e7, Math.floor(+v || 0)));
  const label = (c) => '[' + c.tag + '] ' + c.name;
  C.COLORS = BL.CLUB_COLORS;

  // clubs saved before clubs synced (a list of member names) become the new shape once
  function upgrade(c) {
    if (!c || typeof c !== 'object') return null;
    if (c.v === 2) return c;
    const me = myCode(), fr = S.p.friends || [];
    const codeOf = (n) => { const f = fr.find((x) => x.name === n); return f ? f.code : null; };
    const names = Array.isArray(c.members) ? c.members.map(String) : [], codes = Array.isArray(c.memberCodes) ? c.memberCodes : [];
    let ownerCode, roster;
    if (c.owner) {
      ownerCode = me;
      roster = [{ code: me, name: S.p.name }].concat(names.map((n, i) => ({ code: codes[i] || codeOf(n), name: n })));
    } else {
      ownerCode = names[0] ? codeOf(names[0]) : null;
      roster = [{ code: ownerCode, name: names[0] || 'Owner' }, { code: me, name: S.p.name }].concat(names.slice(1).map((n) => ({ code: codeOf(n), name: n })));
    }
    const seen = new Set();
    roster = roster.filter((r) => { const k = r.code || 'name:' + r.name; if (seen.has(k)) return false; seen.add(k); return true; });
    return { v: 2, id: U.code(8).toUpperCase(), name: cleanName(c.name) || 'Club', tag: U.cleanTag(c.tag) || 'CLUB', c1: (c.c1 | 0) & 7, c2: (c.c2 | 0) & 7,
      ownerCode, roster, stats: Object.assign(zero(), c.stats || {}), pend: zero(), fly: null, seq: 0, ver: 1, created: c.created || Date.now(), synced: !!c.owner };
  }
  // my club (or null), with `owner` set when it's mine
  C.my = function () {
    const p = S.p;
    if (p.club && p.club.v !== 2) { p.club = upgrade(p.club); S.save(); }
    const c = p.club || null;
    if (c) c.owner = !!c.ownerCode && c.ownerCode === myCode();
    return c;
  };
  // the tag to wear in matches
  C.tagFor = () => { const c = C.my(); return c ? { tag: c.tag, tagc: c.c1 } : {}; };
  const add = (a, b) => { for (const k of KEYS) a[k] = num((a[k] || 0) + (b && b[k] || 0)); return a; };
  const any = (s) => KEYS.some((k) => s && s[k] > 0);
  // club stats: everyone's matches the owner has counted, plus mine that are still on their way
  C.totals = () => { const c = C.my(); if (!c) return zero(); const t = add(zero(), c.stats); if (!c.owner) { add(t, c.pend); if (c.fly) add(t, c.fly.add); } return t; };

  // the party I'm in, for club scrimmages (a PeerJS party only: the code is what members join)
  const myParty = () => { const N = BL.Net, L = N && N.lobby; return L && L.party && !L.local && N.transport !== 'ws' ? L.code : null; };

  // ---------- making, inviting, joining, leaving ----------
  C.create = function (name, tag, c1, c2) {
    const nm = cleanName(name), raw = String(tag || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), tg = U.cleanTag(raw);
    if (nm.length < 3) return 'Club name needs 3+ characters';
    if (BL.NameFilter.bad(nm)) return 'Pick another club name';
    if (raw.length < 2) return 'Tag needs 2-4 letters or numbers';
    if (!tg) return 'Pick another tag';
    const me = myCode();
    S.p.club = { v: 2, id: U.code(8).toUpperCase(), name: nm, tag: tg, c1: (c1 | 0) & 7, c2: (c2 | 0) & 7, ownerCode: me, roster: [{ code: me, name: S.p.name }],
      stats: zero(), pend: zero(), fly: null, seq: 0, ver: 1, created: Date.now(), synced: true };
    S.p.clubMoved = null;
    changed(); C.pushSoon();
    return null;
  };
  // what an invite carries (any member can invite their friends; joining goes through the owner)
  C.invitePayload = function () {
    const c = C.my();
    if (!c) return null;
    const own = c.roster.find((r) => r.code === c.ownerCode);
    return { id: c.id, name: c.name, tag: c.tag, c1: c.c1, c2: c.c2, ownerCode: c.ownerCode, ownerName: own ? own.name : '', n: c.roster.length };
  };
  C.join = function (k) {
    const tg = U.cleanTag(k && k.tag), id = cleanCode(k && k.id), oc = cleanCode(k && k.ownerCode);
    if (!tg || !id || !oc) { toast('That club invite is from an older version of the game: ask for a new one.'); return false; }
    const old = C.my();
    if (old && old.id === id) { toast('You are already in ' + label(old)); return false; }
    if (old) C.leave(true);
    const me = myCode();
    S.p.club = { v: 2, id, name: BL.NameFilter.clean(cleanName(k.name), 'Club'), tag: tg, c1: (k.c1 | 0) & 7, c2: (k.c2 | 0) & 7, ownerCode: oc,
      roster: [{ code: oc, name: BL.NameFilter.clean(cleanName(k.ownerName) || 'Owner') }, { code: me, name: S.p.name }],
      stats: zero(), pend: zero(), fly: null, seq: 0, ver: 0, created: Date.now(), synced: false };
    changed();
    C.checkIn();
    toast('You joined ' + label(S.p.club) + (Fr() && Fr().status === 'on' ? '' : ' (it syncs once you are online)'));
    return true;
  };
  // leaving: a member just goes; the owner hands the club to the next member (or it ends when they were alone)
  C.leave = function (quiet) {
    const c = C.my();
    if (!c) return;
    if (c.owner) {
      const next = c.roster.find((r) => r.code && r.code !== c.ownerCode);
      if (next) {
        c.ownerCode = next.code; c.ver++;
        c.roster = c.roster.filter((r) => r.code !== myCode());
        C.push();
        S.p.clubMoved = { id: c.id, to: next.code };
        if (!quiet) toast(next.name + ' is the owner of ' + label(c) + ' now');
      }
    } else if (c.ownerCode) send(c.ownerCode, { t: 'cleave', id: c.id });
    S.p.club = null;
    changed();
  };
  // the owner only: everyone's club goes
  C.disband = function () {
    const c = C.my();
    if (!c || !c.owner) return;
    for (const r of c.roster) if (r.code && r.code !== c.ownerCode) send(r.code, { t: 'cgone', id: c.id });
    S.p.club = null; S.p.clubMoved = null;
    changed();
  };
  C.kick = function (code) {
    const c = C.my();
    if (!c || !c.owner || code === c.ownerCode) return;
    const r = c.roster.find((x) => x.code === code);
    if (!r) return;
    c.roster = c.roster.filter((x) => x !== r); c.ver++;
    send(code, { t: 'ckick', id: c.id });
    changed(); C.push();
    toast(r.name + ' was removed from the club');
  };
  C.promote = function (code) {
    const c = C.my();
    if (!c || !c.owner || !c.roster.some((x) => x.code === code && code !== c.ownerCode)) return;
    c.ownerCode = code; c.ver++;
    C.push();
    S.p.clubMoved = { id: c.id, to: code };
    changed();
  };
  // the owner changes the club's name / tag / colours
  C.setInfo = function (o) {
    const c = C.my();
    if (!c || !c.owner) return 'Only the owner can change the club';
    if (o.name != null) { const nm = cleanName(o.name); if (nm.length < 3) return 'Club name needs 3+ characters'; if (BL.NameFilter.bad(nm)) return 'Pick another club name'; c.name = nm; }
    if (o.tag != null) { const raw = String(o.tag).toUpperCase().replace(/[^A-Z0-9]/g, ''), tg = U.cleanTag(raw); if (raw.length < 2) return 'Tag needs 2-4 letters or numbers'; if (!tg) return 'Pick another tag'; c.tag = tg; }
    if (o.c1 != null) c.c1 = (o.c1 | 0) & 7;
    if (o.c2 != null) c.c2 = (o.c2 | 0) & 7;
    c.ver++;
    changed(); C.pushSoon();
    return null;
  };

  // ---------- a match finished: it counts for the club ----------
  C.addMatch = function (st, won) {
    const c = C.my();
    if (!c || !st) return;
    const d = { goals: st.goals || 0, saves: st.saves || 0, assists: st.assists || 0, wins: won ? 1 : 0, matches: 1 };
    if (c.owner) { add(c.stats, d); c.ver++; S.save(); C.pushSoon(); return; }
    add(c.pend, d); S.save();
    setTimeout(C.checkIn, 1500);
  };

  // ---------- keeping in step ----------
  const snapshot = (c) => ({ id: c.id, name: c.name, tag: c.tag, c1: c.c1, c2: c.c2, ownerCode: c.ownerCode, roster: c.roster.map((r) => ({ code: r.code, name: r.name })), stats: add(zero(), c.stats), ver: c.ver });
  const onList = () => {
    const now = Date.now(), out = [{ code: myCode(), party: myParty() }];
    for (const k in C.seen) if (now - C.seen[k].at < ONLINE_MS) out.push({ code: k, party: C.seen[k].party });
    return out;
  };
  // owner: everyone gets the club as it is now (one at a time is fine: members are few and the messages tiny)
  C.push = function () {
    const c = S.p.club;
    if (!c || !Fr()) return;
    const msg = { t: 'csync', club: snapshot(c), on: onList() };
    for (const r of c.roster) if (r.code && r.code !== myCode()) send(r.code, msg);
  };
  let pushT = 0;
  C.pushSoon = () => { clearTimeout(pushT); pushT = setTimeout(() => { const c = C.my(); if (c && c.owner) C.push(); }, 2500); };
  // member: check in with the owner (carrying my matches since the last time, until the owner says it has them)
  C.checkIn = function () {
    const c = C.my();
    if (!c || c.owner || !c.ownerCode || !Fr() || Fr().status !== 'on') return;
    if (!c.fly && any(c.pend)) { c.seq = (c.seq || 0) + 1; c.fly = { seq: c.seq, add: c.pend }; c.pend = zero(); S.save(); }
    send(c.ownerCode, { t: 'chi', id: c.id, seq: c.fly ? c.fly.seq : 0, add: c.fly ? c.fly.add : null, party: myParty() });
  };
  C.tick = function () { const c = C.my(); if (!c) return; if (c.owner) { if (Date.now() - (C._lastPush || 0) > 120000) { C._lastPush = Date.now(); C.push(); } } else C.checkIn(); };

  C.isOnline = function (code) {
    const c = C.my(), now = Date.now();
    if (!code) return false;
    if (code === myCode()) return true;
    if (Fr() && Fr().isOnline(code)) return true;
    if (C.seen[code] && now - C.seen[code].at < ONLINE_MS) return true;
    return !!(c && !c.owner && c.on && now - c.on.at < ONLINE_MS && c.on.list.some((x) => x.code === code));
  };
  // club members in a party right now (whose party you can join for a scrimmage)
  C.openScrims = function () {
    const c = C.my(), now = Date.now(), mine = myParty(), out = [];
    if (!c) return out;
    const list = c.owner ? onList() : (c.on && now - c.on.at < ONLINE_MS ? c.on.list : []);
    for (const x of list) {
      if (!x.party || x.party === mine || x.code === myCode()) continue;
      const r = c.roster.find((y) => y.code === x.code);
      if (r && !out.some((o) => o.party === x.party)) out.push({ code: x.code, name: r.name, party: x.party });
    }
    return out;
  };
  // invite club members (friends or not) to my party for a scrimmage
  C.scrimInvite = function (code, cb) {
    const room = myParty();
    if (!room) { if (cb) cb('Create a party first.'); return; }
    const c = C.my();
    send(code, { t: 'csinv', id: c ? c.id : '', room }, (ok) => { if (cb) cb(ok ? null : 'They are offline.'); });
  };

  function gone(c, why) {
    if (S.p.club !== c) return;
    S.p.club = null;
    toast(why);
    changed();
    if (BL.Menu && !BL.game && BL.Menu.screen === 'club') BL.Menu.render();
  }
  // messages for clubs (from js/friends.js: the sender's code is checked against the connection it came on)
  C.onMessage = function (m, isFriend) {
    const from = m.from, c = C.my(), me = myCode();
    switch (m.t) {
      case 'chi': {
        // a member checking in with me, the owner
        if (!c || !c.owner || c.id !== cleanCode(m.id)) {
          const mv = S.p.clubMoved;
          if (mv && mv.id === cleanCode(m.id)) send(from.code, { t: 'cmove', id: mv.id, to: mv.to });
          else send(from.code, { t: 'cgone', id: cleanCode(m.id) });
          return;
        }
        let r = c.roster.find((x) => x.code === from.code), dirty = false;
        if (!r) {
          if (c.roster.length >= MAX) { send(from.code, { t: 'cgone', id: c.id, full: 1 }); return; }
          r = { code: from.code, name: from.name }; c.roster.push(r); dirty = true;
          toast(from.name + ' joined your club');
        }
        if (r.name !== from.name) { r.name = from.name; dirty = true; }
        const seq = num(m.seq);
        if (m.add && seq > (r.seq || 0)) { add(c.stats, m.add); r.seq = seq; dirty = true; }
        C.seen[from.code] = { at: Date.now(), party: cleanCode(m.party) };
        if (dirty) c.ver++;
        send(from.code, { t: 'csync', club: snapshot(c), ack: seq, on: onList() });
        if (dirty) { changed(); C.pushSoon(); } else if (BL.bus) BL.bus.emit('friends');
        return;
      }
      case 'csync': {
        const k = m.club;
        if (!c || !k || cleanCode(k.id) !== c.id || from.code !== c.ownerCode) return;
        const roster = (Array.isArray(k.roster) ? k.roster : []).slice(0, MAX).map((r) => ({ code: cleanCode(r && r.code), name: BL.NameFilter.clean(cleanName(r && r.name) || 'Player') })).filter((r) => r.code);
        if (!roster.some((r) => r.code === me)) { gone(c, 'You are no longer in ' + label(c)); return; }
        const wasOwner = c.ownerCode === me;
        c.name = BL.NameFilter.clean(cleanName(k.name), c.name) || c.name;
        c.tag = U.cleanTag(k.tag) || c.tag;
        c.c1 = (k.c1 | 0) & 7; c.c2 = (k.c2 | 0) & 7;
        c.roster = roster;
        c.stats = add(zero(), k.stats);
        c.ver = num(k.ver);
        const oc = cleanCode(k.ownerCode);
        if (oc && roster.some((r) => r.code === oc)) c.ownerCode = oc;
        if (c.fly && num(m.ack) >= c.fly.seq) c.fly = null;
        c.on = { at: Date.now(), list: (Array.isArray(m.on) ? m.on : []).slice(0, MAX + 1).map((x) => ({ code: cleanCode(x && x.code), party: cleanCode(x && x.party) })).filter((x) => x.code) };
        c.synced = true;
        if (!wasOwner && c.ownerCode === me) { toast('You are the owner of ' + label(c) + ' now'); C.seen = {}; }
        changed();
        return;
      }
      case 'cmove':
        if (c && !c.owner && cleanCode(m.id) === c.id && from.code === c.ownerCode && cleanCode(m.to)) { c.ownerCode = cleanCode(m.to); changed(); C.checkIn(); }
        return;
      case 'ckick':
        if (c && cleanCode(m.id) === c.id && from.code === c.ownerCode && !c.owner) gone(c, 'You were removed from ' + label(c));
        return;
      case 'cgone':
        if (c && cleanCode(m.id) === c.id && from.code === c.ownerCode && !c.owner) gone(c, m.full ? label(c) + ' is full (' + MAX + ' members)' : label(c) + ' was disbanded');
        return;
      case 'cleave': {
        if (!c || !c.owner || cleanCode(m.id) !== c.id) return;
        const r = c.roster.find((x) => x.code === from.code);
        if (!r || r.code === me) return;
        c.roster = c.roster.filter((x) => x !== r); c.ver++; delete C.seen[from.code];
        toast(r.name + ' left the club');
        changed(); C.push();
        return;
      }
      case 'csinv': {
        // a club scrimmage invite: from someone in my club, friend or not
        const room = cleanCode(m.room);
        if (!c || cleanCode(m.id) !== c.id || !room || !c.roster.some((x) => x.code === from.code)) return;
        const p = S.p;
        p.invites = (p.invites || []).filter((x) => !(x.t === 'pinv' && x.code === from.code)).concat([{ t: 'pinv', scrim: true, code: from.code, name: from.name, room, at: Date.now() }]);
        toast(from.name + ' invited you to a club scrimmage');
        changed();
        return;
      }
      default:
    }
  };
  C.handles = (t) => ['chi', 'csync', 'cmove', 'ckick', 'cgone', 'cleave', 'csinv'].indexOf(t) >= 0;

  // ---------- rival clubs (bots) for scrimmages ----------
  const RIVAL_A = ['Apex', 'Turbo', 'Nova', 'Velocity', 'Midnight', 'Iron', 'Neon', 'Storm', 'Rogue', 'Phantom', 'Atomic', 'Lunar', 'Blitz', 'Crimson', 'Royal', 'Static', 'Frost', 'Golden', 'Shadow', 'Solar'];
  const RIVAL_B = ['Kings', 'Wolves', 'Raiders', 'Squad', 'Legion', 'Syndicate', 'Drifters', 'Collective', 'Esports', 'Union', 'Crew', 'Vipers', 'Titans', 'Rockets', 'Owls', 'Hornets'];
  C.rival = function (seed) {
    const rnd = U.rng(U.hash(String(seed)) >>> 0), mine = C.my();
    for (let i = 0; i < 12; i++) {
      const a = U.choice(RIVAL_A, rnd), b = U.choice(RIVAL_B, rnd);
      let tag = (a[0] + b[0] + (rnd() < 0.5 ? a[1] : '')).toUpperCase();
      if (rnd() < 0.35) tag = (a.slice(0, 2) + b[0]).toUpperCase();
      tag = U.cleanTag(tag);
      if (!tag || (mine && tag === mine.tag)) continue;
      let c1 = (rnd() * 6) | 0; if (mine && c1 === mine.c1) c1 = (c1 + 3) % 6;
      return { name: a + ' ' + b, tag, c1, c2: (c1 + 2 + ((rnd() * 3) | 0)) % 8 };
    }
    return { name: 'Rival Club', tag: 'RVL', c1: 3, c2: 6 };
  };
  // tags for tournament teams ("Team Nova" plays as [NOVA])
  const TEAM_TAGS = { Apex: 'APX', Blitz: 'BLZ', Nova: 'NOVA', Fury: 'FURY', Zenith: 'ZEN', Pulse: 'PLS', Vortex: 'VTX', Echo: 'ECHO', Titan: 'TTN', Rogue: 'RGE', Inferno: 'INF', Glacier: 'GLC', Phantom: 'PHM', Lunar: 'LUNR', Solar: 'SOL', Havoc: 'HVC', Static: 'STC', Ember: 'EMBR' };
  C.teamTag = (teamName) => { const w = String(teamName || '').replace(/^Team\s+/, ''); return U.cleanTag(TEAM_TAGS[w] || w.slice(0, 3)) || 'TM'; };
})(window.BL);
