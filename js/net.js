'use strict';
// Rocket League (fan remake) - online play over WebRTC (PeerJS). The host runs the match, clients predict + reconcile.
(function (BL) {
  const U = BL.util;
  const N = BL.Net = { peer: null, role: null, rtt: 0, conns: {}, hostConn: null, lobby: null, myPid: null };
  // two people in a lobby never share a name: the second "Player" shows as "Player 2"
  const uniqueIn = (list, name, self) => { let v = name, k = 2; const taken = (x) => list.some((p) => p !== self && String(p.name).toLowerCase() === x.toLowerCase()); while (taken(v)) v = name.slice(0, 14) + ' ' + k++; return v; };
  const MAX_PUBLIC = 10;
  // PeerJS's own servers plus a few more ways to find a direct route (going through a relay is far slower)
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }], sdpSemantics: 'unified-plan' };

  N.available = () => typeof window.Peer !== 'undefined';
  const peerId = (code) => BL.NET_PREFIX + String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');

  function me() {
    const p = BL.Save.p;
    const title = BL.ITEM_BY_ID[(BL.Save.entry(p.loadout.title) || {}).id];
    const ct = BL.Club ? BL.Club.tagFor() : {};
    return { name: p.name, level: p.level, title: title ? title.text : '', tag: ct.tag || '', tagc: ct.tagc || 0, loadout: BL.Save.resolveLoadout() };
  }

  function emit(e, a) { BL.bus.emit('net:' + e, a); }

  N.lobbySummary = function () {
    const L = N.lobby;
    return { code: L.code, hostName: L.hostName, mode: L.mode, mapId: L.mapId, teamSize: L.teamSize, players: L.players.length, max: L.teamSize * 2, state: L.state, public: L.public, quick: L.quick || null, ranked: !!L.ranked };
  };

  // ---------- QUICK PLAY without a server: join an open public room for this playlist, or become its host ----------
  const QP = { duel: ['soccar', 1], doubles: ['soccar', 2], standard: ['soccar', 3], chaos: ['soccar', 4], rumble: ['rumble', 3], heatseeker: ['heatseeker', 2] };
  N.p2pQueue = null;
  N.quickPlay = function (playlist, ranked) {
    const qp = QP[playlist];
    if (!qp || !N.available()) { BL.Menu.toast('Online needs an internet connection.'); return; }
    N.p2pQueue = { playlist, ranked: !!ranked, since: Date.now(), wait: 15, p2p: true };
    N.srv.queue = N.p2pQueue;
    emit('queue');
    const myQ = N.p2pQueue;
    const cancelled = () => N.p2pQueue !== myQ;
    N.browse((err, list) => {
      if (cancelled()) return;
      const open = (list || []).filter((l) => l.quick === playlist && !!l.ranked === !!ranked && l.state === 'lobby' && l.players < l.max);
      const tryHost = () => {
        if (cancelled()) return;
        N.host({ public: true, quick: playlist, ranked: !!ranked, mode: qp[0], teamSize: qp[1], mapId: U.choice(BL.MAPS.filter((m) => !m.labs)).id, botSkill: ranked ? BL.Save.botSkillForMMR(BL.Save.p.mmr[playlist] || 400) : 0.5, fillBots: true }, (e) => {
          if (cancelled()) { N.leaveP2P(); return; }
          if (e) { N.cancelQuick(); BL.Menu.toast('Could not start online play: ' + (e.message || e.type)); return; }
          // auto-start once full or after the wait
          const check = setInterval(() => {
            if (cancelled() || N.role !== 'host' || !N.lobby) { clearInterval(check); return; }
            const L = N.lobby;
            const full = L.players.length >= L.teamSize * 2;
            if (full || Date.now() - myQ.since > myQ.wait * 1000) { clearInterval(check); N.p2pQueue = null; N.srv.queue = null; emit('queue'); N.startGame(); }
          }, 500);
        });
      };
      if (open.length) {
        N.join(open[0].code, (e) => {
          if (cancelled()) { N.leaveP2P(); return; }
          if (e) tryHost(); // someone else filled it: host our own
        });
      } else setTimeout(tryHost, Math.random() * 1200);
    });
  };
  N.cancelQuick = function () {
    if (!N.p2pQueue) return;
    N.p2pQueue = null; N.srv.queue = null;
    N.leaveP2P();
    emit('queue');
  };

  // ---------- HOST ----------
  N.host = function (opts, cb) {
    N.leave();
    if (!N.available()) { cb(new Error('Online library failed to load. Check your internet connection.')); return; }
    const isPublic = !!opts.public;
    let attempt = 1;
    const tryOpen = () => {
      const code = isPublic ? 'PUB' + attempt : U.code(5);
      const peer = new window.Peer(peerId(code), { debug: 1, config: ICE });
      let opened = false;
      peer.on('open', (id) => {
        opened = true;
        N.peer = peer; N.role = 'host'; N.myPid = id;
        const m = me();
        N.lobby = {
          code, public: isPublic, party: !!opts.party, leader: id, searching: null, itemPool: null, quick: opts.quick || null, ranked: !!opts.ranked, hostName: m.name, mode: opts.mode || 'soccar', mapId: opts.mapId || 'champions', teamSize: opts.teamSize || 2,
          mutators: opts.mutators || BL.defaultMutators(), botSkill: opts.botSkill == null ? 0.5 : opts.botSkill, fillBots: opts.fillBots !== false, state: 'lobby',
          players: [{ pid: id, name: m.name, level: m.level, title: m.title, tag: m.tag, tagc: m.tagc, loadout: m.loadout, team: 0, host: true }],
        };
        cb(null, code);
        emit('lobby', N.lobby);
      });
      peer.on('connection', (conn) => N.onClientConn(conn));
      peer.on('error', (err) => {
        if (!opened && err.type === 'unavailable-id' && isPublic && attempt < MAX_PUBLIC) { attempt++; try { peer.destroy(); } catch (e) { /* ignore */ } tryOpen(); return; }
        if (!opened) { try { peer.destroy(); } catch (e) { /* ignore */ } cb(err); }
        else console.warn('[net] host error', err);
      });
      peer.on('disconnected', () => { if (N.peer === peer && !peer.destroyed) peer.reconnect(); });
    };
    tryOpen();
  };

  N.onClientConn = function (conn) {
    conn.on('data', (msg) => N.hostRecv(conn, msg));
    conn.on('close', () => N.hostDrop(conn.peer));
    conn.on('error', () => N.hostDrop(conn.peer));
  };

  function sendConn(conn, msg) { try { if (conn && conn.open) conn.send(msg); } catch (e) { /* closed */ } }

  // ---------- the fast lane ----------
  // The PeerJS channel is reliable and ordered: one lost packet holds up everything behind it until it's resent, which
  // on Wi-Fi is the ping jumping to hundreds of ms. What's out of date the moment it's late (position updates, inputs,
  // pings) goes on a second channel beside it, unordered with no resends: a lost one is simply replaced by the next.
  // Goals, chat, the lobby and everything else that must arrive stay on the reliable channel. Both ends open the same
  // agreed channel (negotiated, so PeerJS never sees it) and keep saying hello on it; until they've heard each other,
  // or if the other copy doesn't have it, everything goes the old way.
  const FAST_ID = 101, FAST_BACKLOG = 16384;
  function openFast(conn, recv) {
    const pc = conn.peerConnection;
    if (!pc || conn.fast) return;
    let ch;
    try { ch = pc.createDataChannel('fast', { negotiated: true, id: FAST_ID, ordered: false, maxRetransmits: 0 }); } catch (e) { return; }
    conn.fast = ch;
    const hello = () => { try { if (ch.readyState === 'open') ch.send('{"t":"fh"}'); } catch (e) { /* closed */ } };
    let tries = 0;
    const timer = setInterval(() => { if (conn.fastOk || ++tries > 60 || ch.readyState === 'closed') clearInterval(timer); else hello(); }, 250);
    ch.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'fh') { conn.fastOk = true; hello(); return; }
      recv(m);
    };
    ch.onclose = () => { conn.fastOk = false; };
  }
  // a send that's useless once it's late; a backed-up link skips it rather than queueing it, the next is fresher anyway
  function fastWire(conn, text) { try { if (conn.fast.bufferedAmount < FAST_BACKLOG) conn.fast.send(text); } catch (e) { /* closed */ } }
  const fastUp = (conn) => !!(conn && conn.fastOk && conn.fast.readyState === 'open');
  function sendFast(conn, msg) { if (fastUp(conn)) fastWire(conn, JSON.stringify(msg)); else sendConn(conn, msg); }
  N.fastTo = sendFast;
  N.sendPing = (msg) => sendFast(N.hostConn, msg);
  N.broadcastFast = function (msg) {
    let text = null;
    for (const pid in N.conns) {
      const c = N.conns[pid];
      if (fastUp(c)) fastWire(c, text || (text = JSON.stringify(msg))); else sendConn(c, msg);
    }
  };

  N.hostRecv = function (conn, msg) {
    if (!msg || typeof msg !== 'object' || !N.lobby) return;
    const L = N.lobby, pid = conn.peer;
    switch (msg.t) {
      case 'info': sendConn(conn, { t: 'info', lobby: N.lobbySummary() }); break;
      case 'hello': {
        if (L.state !== 'lobby') { sendConn(conn, { t: 'deny', reason: 'Match already in progress. Try again after it ends.' }); return; }
        if (L.players.length >= L.teamSize * 2) { sendConn(conn, { t: 'deny', reason: 'Lobby is full.' }); return; }
        if (msg.v !== BL.VERSION) { sendConn(conn, { t: 'deny', reason: 'Version mismatch (host ' + BL.VERSION + ', you ' + msg.v + '). Refresh the page.' }); return; }
        const t0 = L.players.filter((p) => p.team === 0).length, t1 = L.players.filter((p) => p.team === 1).length;
        L.players = L.players.filter((p) => p.pid !== pid);
        // a party plays on one team (the bots or other players are the opponents); a private match balances the teams
        const team = L.party ? (t0 < L.teamSize ? 0 : 1) : t0 <= t1 ? 0 : 1;
        L.players.push({ pid, name: uniqueIn(L.players, BL.NameFilter.clean(String(msg.name || 'Player').slice(0, 16))), level: msg.level | 0, title: String(msg.title || '').slice(0, 24), tag: U.cleanTag(msg.tag), tagc: (msg.tagc | 0) & 7, loadout: sanitizeLoadout(msg.loadout), team });
        N.conns[pid] = conn;
        openFast(conn, (m) => N.hostRecv(conn, m));
        sendConn(conn, { t: 'welcome', pid, lobby: L });
        N.pushLobby();
        N.lobbyChat('System', msg.name + ' joined');
        break;
      }
      case 'team': {
        const p = L.players.find((x) => x.pid === pid);
        if (!p || L.state !== 'lobby') return;
        const want = msg.team === 1 ? 1 : 0;
        if (L.players.filter((x) => x.team === want).length < L.teamSize) { p.team = want; N.pushLobby(); }
        break;
      }
      case 'in': if (BL.game && BL.game.isHost) BL.game.onRemoteInput(pid, msg); break;
      case 'skip': if (BL.game && BL.game.isHost) BL.game.voteSkip(pid); break;
      case 'chat': {
        const c = BL.game && BL.game.cars.find((x) => x.pid === pid);
        if (!c) return;
        const m = { t: 'chat', id: c.id, m: String(msg.m || '').slice(0, 60) };
        BL.game.showChat(c.id, m.m);
        N.broadcast(m);
        break;
      }
      case 'party': N.partyHandle(pid, msg); break;
      case 'ff': { const c = BL.game && BL.game.isHost && BL.game.cars.find((x) => x.pid === pid); if (c) BL.game.castForfeit(c.id); break; }
      // a party member abandoned the match but stays in the party: a bot takes their car
      case 'leftGame': if (BL.game && BL.game.isHost) BL.game.playerLeft(pid); break;
      case 'prof': {
        // a party member changed their car / title: everyone's menus show it
        const p = L.players.find((x) => x.pid === pid);
        if (!p || L.state !== 'lobby') return;
        p.loadout = sanitizeLoadout(msg.loadout); p.level = msg.level | 0; p.title = String(msg.title || '').slice(0, 24); p.name = BL.NameFilter.clean(String(msg.name || p.name).slice(0, 16));
        p.tag = U.cleanTag(msg.tag); p.tagc = (msg.tagc | 0) & 7;
        N.pushLobby();
        break;
      }
      case 'lchat': {
        const p = L.players.find((x) => x.pid === pid);
        if (p) N.lobbyChat(p.name, String(msg.m || '').slice(0, 120));
        break;
      }
      case 'ping': sendFast(conn, { t: 'pong', ts: msg.ts }); break;
      case 'loaded': if (BL.game && BL.game.isHost) BL.game.playerLoaded(pid); break;
      default: break;
    }
  };

  function sanitizeLoadout(l) {
    const out = {};
    for (const slot of BL.Save.SLOTS) {
      const e = l && l[slot];
      const def = e && BL.ITEM_BY_ID[e.id];
      out[slot] = def && def.cat === slot ? { id: e.id, paint: BL.PAINT_BY_ID[e.paint] ? e.paint : null, cert: null } : null;
    }
    const col = (c, d) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : d);
    out.blue = col(l && l.blue, BL.TEAM_COLORS[0][0]);
    out.orange = col(l && l.orange, BL.TEAM_COLORS[1][0]);
    out.accent = col(l && l.accent, '#f5f5f5');
    return out;
  }

  N.hostDrop = function (pid) {
    if (N.role !== 'host' || !N.lobby) return;
    if (!N.conns[pid]) return;
    delete N.conns[pid];
    const p = N.lobby.players.find((x) => x.pid === pid);
    N.lobby.players = N.lobby.players.filter((x) => x.pid !== pid);
    if (p) N.lobbyChat('System', p.name + ' left');
    if (N.lobby.leader === pid) { N.lobby.leader = N.myPid; N.lobby.searching = null; }
    if (BL.game && BL.game.isHost) BL.game.playerLeft(pid);
    N.pushLobby();
  };

  N.pushLobby = function () {
    if (N.role !== 'host') return;
    N.broadcast({ t: 'lobby', lobby: N.lobby });
    emit('lobby', N.lobby);
  };

  // names from other players never show swearing (js/namefilter.js)
  function cleanLobby(L) {
    if (L && L.players) for (const p of L.players) { p.name = BL.NameFilter.clean(p.name); p.tag = U.cleanTag(p.tag); p.tagc = (p.tagc | 0) & 7; }
    if (L && L.hostName) L.hostName = BL.NameFilter.clean(L.hostName);
    return L;
  }
  N.updateLobby = function (patch) {
    if (N.transport === 'ws') { N.srvSend({ t: 'room.settings', patch }); return; }
    if (N.role !== 'host') return;
    Object.assign(N.lobby, patch);
    // trim teams if the size shrank
    for (const t of [0, 1]) {
      const team = N.lobby.players.filter((p) => p.team === t);
      while (team.length > N.lobby.teamSize) { const p = team.pop(); p.team = 1 - t; }
    }
    N.pushLobby();
  };

  N.setMyTeam = function (team) {
    if (N.role === 'host') {
      const p = N.lobby.players.find((x) => x.pid === N.myPid);
      if (p && N.lobby.players.filter((x) => x.team === team).length < N.lobby.teamSize) { p.team = team; N.pushLobby(); }
    } else sendConn(N.hostConn, { t: 'team', team });
  };

  // ---------- party (a P2P lobby flagged `party`): the leader picks playlists and searches, everyone joins together ----------
  N.leaderPid = () => (N.lobby ? N.lobby.leader || (N.lobby.players.find((p) => p.host) || {}).pid : null);
  N.isPartyLeader = () => !!N.lobby && N.leaderPid() === N.myPid;
  N.partyAct = function (a, data) {
    const msg = Object.assign({ t: 'party', a }, data || {});
    if (N.role === 'host') N.partyHandle(N.myPid, msg); else sendConn(N.hostConn, msg);
  };
  const cleanTags = (a) => (Array.isArray(a) ? a.slice(0, 2).map((t) => (t && U.cleanTag(t.tag) ? { tag: U.cleanTag(t.tag), tagc: (t.tagc | 0) & 7 } : null)) : null);
  const cleanTeamNames = (a) => (Array.isArray(a) ? a.slice(0, 2).map((s) => (s ? BL.NameFilter.clean(String(s).slice(0, 24), 'CLUB') : null)) : null);
  N.partyHandle = function (pid, msg) {
    const L = N.lobby;
    if (!L || N.role !== 'host') return;
    const lead = pid === N.leaderPid(), host = pid === N.myPid;
    const who = (x) => L.players.find((p) => p.pid === x);
    switch (msg.a) {
      case 'search':
        if (!lead || L.state !== 'lobby') return;
        L.searching = { ids: (msg.ids || []).slice(0, 8).map(String), ranked: !!msg.ranked, since: Date.now(), wait: 3000 + Math.random() * 6000 };
        break;
      case 'cancel': if (!lead) return; L.searching = null; break;
      // tournaments: the leader registers the party (tour = start time, 0 = left the queue), everyone's ready-up is
      // shared (tourReady[pid] = round key), the leader calls each round (tourGo = round key, or key + ':out' when
      // the team didn't ready up in time) and the host starts the party's match
      case 'tour': if (!lead) return; L.tour = msg.tour ? +msg.tour : 0; L.tourReady = {}; L.tourGo = null; break;
      case 'tready': L.tourReady = L.tourReady || {}; L.tourReady[pid] = String(msg.k || ''); break;
      case 'tgo': if (!lead) return; L.tourGo = String(msg.k || ''); break;
      case 'tplay':
        if (!lead) return;
        // the party is one team (blue), the bots are the other tournament team
        L.players.forEach((p, i) => { p.team = i < msg.teamSize ? 0 : 1; });
        // the bots keep the names shown on the ready-up screen
        L.botNames = Array.isArray(msg.names) ? msg.names.slice(0, 2).map((a) => (Array.isArray(a) ? a : []).slice(0, 4).map((n) => String(n).slice(0, 16))) : null;
        L.botTags = cleanTags(msg.tags); L.teamNames = cleanTeamNames(msg.teamNames); L.scrim = false;
        // (the other team plays at the tournament's rank)
        N.updateLobby(Object.assign({ mode: msg.mode, teamSize: msg.teamSize, itemPool: msg.itemPool || null, fillBots: true }, msg.skill ? { botSkill: U.clamp(+msg.skill || 0.5, 0.05, 1) } : {}));
        setTimeout(() => N.startGame(), 300);
        return;
      case 'scrim':
        // a club scrimmage: the party (club members) against a rival club of bots
        if (!lead || L.state !== 'lobby') return;
        L.players.forEach((p, i) => { p.team = i < msg.teamSize ? 0 : 1; });
        L.botNames = Array.isArray(msg.names) ? msg.names.slice(0, 2).map((a) => (Array.isArray(a) ? a : []).slice(0, 4).map((n) => String(n).slice(0, 16))) : null;
        L.botTags = cleanTags(msg.tags); L.teamNames = cleanTeamNames(msg.teamNames); L.scrim = true;
        N.updateLobby({ mode: 'soccar', teamSize: U.clamp(msg.teamSize | 0, 1, 4), itemPool: null, fillBots: true, botSkill: U.clamp(+msg.skill || 0.5, 0.05, 1) });
        setTimeout(() => N.startGame(), 300);
        return;
      case 'promote':
        if ((!lead && !host) || !who(msg.pid)) return;
        L.leader = msg.pid; L.searching = null;
        N.lobbyChat('System', who(msg.pid).name + ' is now the party leader');
        break;
      case 'kick':
        if ((!lead && !host) || msg.pid === N.myPid || !N.conns[msg.pid]) return;
        sendConn(N.conns[msg.pid], { t: 'kicked' });
        setTimeout(() => { const c = N.conns[msg.pid]; if (c) { try { c.close(); } catch (e) { /* ignore */ } } N.hostDrop(msg.pid); }, 300);
        return;
      default: return;
    }
    N.pushLobby();
  };
  // tell the host about my current car / title so party members' menus show it
  N.sendMe = function () {
    if (!N.lobby || N.transport === 'ws') return;
    const m = me();
    if (N.role === 'host') {
      const p = N.lobby.players.find((x) => x.pid === N.myPid);
      if (p) { p.loadout = m.loadout; p.level = m.level; p.title = m.title; p.name = m.name; p.tag = m.tag; p.tagc = m.tagc; N.pushLobby(); }
    } else sendConn(N.hostConn, { t: 'prof', name: m.name, level: m.level, title: m.title, tag: m.tag, tagc: m.tagc, loadout: m.loadout });
  };

  // ---------- Local Link (js/locallink.js): a party over a direct WebRTC link, no internet or signalling server ----------
  N.hostLocal = function () {
    if (N.lobby && N.role === 'host' && N.local) return;
    N.leave();
    const m = me(), id = 'LLH' + U.code(5);
    N.role = 'host'; N.myPid = id; N.local = true;
    N.lobby = { code: 'LOCAL', local: true, public: false, party: true, leader: id, searching: null, itemPool: null, quick: null, ranked: false, hostName: m.name,
      mode: 'soccar', mapId: 'champions', teamSize: 3, mutators: BL.defaultMutators(), botSkill: 0.5, fillBots: true, state: 'lobby',
      players: [{ pid: id, name: m.name, level: m.level, title: m.title, tag: m.tag, tagc: m.tagc, loadout: m.loadout, team: 0, host: true }] };
    emit('lobby', N.lobby);
  };
  // host: a friend's link is up; their hello arrives through hostRecv like any other player
  N.addLocal = (conn) => N.onClientConn(conn);
  N.joinLocal = function (conn, cb) {
    N.leave();
    N.local = true; N.myPid = 'LLC' + U.code(5);
    let done = false;
    const finish = (err) => { if (done) return; done = true; clearTimeout(timer); cb(err); };
    const timer = setTimeout(() => finish(new Error('Could not reach the host. Make sure they scanned your reply and you are on the same Wi-Fi or hotspot.')), 30000);
    const hello = () => { const m = me(); sendConn(conn, { t: 'hello', name: m.name, level: m.level, title: m.title, tag: m.tag, tagc: m.tagc, loadout: m.loadout, v: BL.VERSION }); };
    if (conn.open) hello(); else conn.on('open', hello);
    conn.on('data', (msg) => {
      if (msg && msg.t === 'welcome') { N.role = 'client'; N.hostConn = conn; N.myPid = msg.pid; N.lobby = cleanLobby(msg.lobby); openFast(conn, (m) => N.clientRecv(m)); N.startPing(); finish(null); emit('lobby', N.lobby); return; }
      if (msg && msg.t === 'deny') { finish(new Error(msg.reason)); return; }
      N.clientRecv(msg);
    });
    conn.on('close', () => { if (done && N.hostConn === conn) N.lostHost(); });
    conn.on('error', () => { if (!done) finish(new Error('The link failed. Both devices must be on the same Wi-Fi or hotspot.')); });
  };

  N.broadcast = function (msg) { for (const pid in N.conns) sendConn(N.conns[pid], msg); };
  N.sendTo = function (pid, msg) { sendConn(N.conns[pid], msg); };

  N.lobbyChat = function (name, m) {
    if (N.role === 'host') { const msg = { t: 'lchat', name, m }; N.broadcast(msg); emit('lchat', msg); }
    else sendConn(N.hostConn, { t: 'lchat', m });
  };

  N.startGame = function () {
    if (N.transport === 'ws') { N.sendProfile(); N.srvSend({ t: 'room.start' }); return; }
    if (N.role !== 'host') return;
    const L = N.lobby;
    const players = [];
    let id = 0;
    const used = new Set(L.players.map((p) => p.name));
    const me = L.players.find((p) => p.pid === N.myPid), p2 = BL.Menu.p2 && me ? BL.Menu.p2 : null;
    for (const team of [0, 1]) {
      const humans = L.players.filter((p) => p.team === team).slice(0, L.teamSize);
      for (const h of humans) players.push({ id: id++, name: h.name, tag: h.tag || '', tagc: h.tagc | 0, team, isBot: false, pid: h.pid, loadout: h.loadout, skill: 0 });
      // splitscreen on the host: Player 2 takes a seat on the host's team
      let seats = humans.length;
      if (p2 && team === me.team && seats < L.teamSize) { players.push({ id: id++, name: p2.name, team, isBot: false, pid: N.myPid + ':p2', p2: true, loadout: me.loadout, skill: 0 }); seats++; }
      if (L.fillBots) {
        const preset = ((L.botNames && L.botNames[team]) || []).filter((n) => !used.has(n));
        for (let k = seats; k < L.teamSize; k++) {
          let name = preset.shift() || U.choice(BL.ONLINE_BOT_NAMES);
          while (used.has(name)) name = U.choice(BL.ONLINE_BOT_NAMES);
          used.add(name);
          const bt = (L.botTags && L.botTags[team]) || (BL.botClub && BL.botClub(name)) || null; // (a bot's own club otherwise)
          players.push({ id: id++, name, tag: bt ? bt.tag : '', tagc: bt ? bt.tagc : 0, team, isBot: true, skill: L.botSkill, loadout: BL.Save.randomLoadout() });
        }
      }
    }
    const cfg = { mode: L.mode, mapId: L.mapId, mutators: L.mutators, players, botSkill: L.botSkill, ranked: L.ranked && L.quick ? { playlist: L.quick } : null, ctx: BL.Menu.netCtx ? BL.Menu.netCtx() : null,
      itemPool: L.itemPool || null, playlist: L.quick || null, disguised: !!L.party, teamNames: L.teamNames || null };
    if (L.scrim) cfg.ctx = { kind: 'scrim' };
    L.state = 'game'; L.botNames = null; L.botTags = null; L.teamNames = null; L.scrim = false;
    N.pushLobby();
    N.broadcast({ t: 'start', cfg });
    BL.App.startMatch(Object.assign({}, cfg, { net: { role: 'host' }, pregame: 1, waitFor: players.filter((p) => !p.isBot && !p.p2 && p.pid !== N.myPid).map((p) => p.pid), players: players.map((p) => Object.assign({}, p, { isLocal: p.pid === N.myPid, isLocal2: !!p.p2 })) }));
  };

  N.matchEnded = function () {
    if (N.role === 'host' && N.lobby) { N.lobby.state = 'lobby'; N.pushLobby(); }
  };

  // ---------- CLIENT ----------
  N.join = function (code, cb) {
    N.leave();
    if (!N.available()) { cb(new Error('Online library failed to load. Check your internet connection.')); return; }
    const peer = new window.Peer({ debug: 1, config: ICE });
    let done = false;
    const finish = (err) => { if (done) return; done = true; clearTimeout(timer); if (err) { try { peer.destroy(); } catch (e) { /* ignore */ } N.peer = null; N.role = null; } cb(err); };
    const timer = setTimeout(() => finish(new Error('Could not reach that lobby. Check the code and try again.')), 12000);
    peer.on('open', (id) => {
      N.peer = peer; N.myPid = id;
      const conn = peer.connect(peerId(code), { reliable: true, serialization: 'json' });
      conn.on('open', () => { const m = me(); sendConn(conn, { t: 'hello', name: m.name, level: m.level, title: m.title, tag: m.tag, tagc: m.tagc, loadout: m.loadout, v: BL.VERSION }); });
      conn.on('data', (msg) => {
        if (msg && msg.t === 'welcome') { N.role = 'client'; N.hostConn = conn; N.lobby = cleanLobby(msg.lobby); openFast(conn, (m) => N.clientRecv(m)); N.startPing(); finish(null); emit('lobby', N.lobby); return; }
        if (msg && msg.t === 'deny') { finish(new Error(msg.reason)); return; }
        N.clientRecv(msg);
      });
      conn.on('close', () => { if (done && N.hostConn === conn) N.lostHost(); });
      conn.on('error', () => { if (!done) finish(new Error('Connection failed.')); });
    });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') finish(new Error('No lobby found with code ' + code.toUpperCase() + '.'));
      else if (!done) finish(err);
      else console.warn('[net] client error', err);
    });
  };

  N.clientRecv = function (msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'lobby': N.lobby = cleanLobby(msg.lobby); emit('lobby', N.lobby); break;
      case 'lchat': emit('lchat', msg); break;
      case 'kicked': N.leave(); emit('kicked'); emit('lobby', null); break;
      case 'start': {
        const cfg = msg.cfg;
        if (N.p2pQueue) { N.p2pQueue = null; N.srv.queue = null; emit('queue'); }
        BL.App.startMatch(Object.assign({}, cfg, { net: { role: 'client' }, players: cfg.players.map((p) => Object.assign({}, p, { isLocal: p.pid === N.myPid })) }));
        break;
      }
      case 's': if (BL.game && BL.game.isClient) BL.game.queueSnapshot(msg); break;
      case 'ev': case 'chat': if (BL.game) BL.game.onNetEvent(msg); break;
      case 'pong': { const r = (performance.now() - msg.ts) / 1000; N.jit = N.rtt ? (N.jit || 0) * 0.85 + Math.abs(r - N.rtt) * 0.15 : 0; N.rtt = N.rtt ? N.rtt * 0.8 + r * 0.2 : r; break; }
      default: break;
    }
  };

  N.startPing = function () {
    clearInterval(N.pingTimer);
    let n = 0;
    N.pingTimer = setInterval(() => { N.sendPing({ t: 'ping', ts: performance.now() }); if (n++ % 10 === 0) checkRoute(); }, 500);
  };
  // whether the link to the host is direct or goes through a relay server, which is much slower (the HUD says so)
  function checkRoute() {
    const pc = N.hostConn && N.hostConn.peerConnection;
    if (!pc || !pc.getStats) return;
    pc.getStats().then((st) => {
      let pair = null;
      st.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
      const a = pair && st.get(pair.localCandidateId), b = pair && st.get(pair.remoteCandidateId);
      N.relay = !!((a && a.candidateType === 'relay') || (b && b.candidateType === 'relay'));
    }).catch(() => {});
  }

  N.sendInput = function (seq, c) {
    const bits = (c.jump ? 1 : 0) | (c.boost ? 2 : 0) | (c.handbrake ? 4 : 0) | (c.airRollFree ? 8 : 0);
    sendFast(N.hostConn, { t: 'in', s: seq, c: [Math.round(c.throttle * 100), Math.round(c.steer * 100), Math.round(c.pitch * 100), Math.round(c.roll * 100), bits, c.jumpSeq, c.itemSeq], p: Math.round(N.rtt * 1000) });
  };

  N.chat = function (id, m) {
    if (N.role === 'host') N.broadcast({ t: 'chat', id, m });
    else sendConn(N.hostConn, { t: 'chat', m });
  };

  N.lostHost = function () {
    const wasClient = N.role === 'client', party = !!(N.lobby && N.lobby.party);
    N.leave();
    if (wasClient) {
      if (BL.game) BL.App.endGame();
      BL.Menu.show(party ? 'main' : 'online');
      BL.Menu.toast(party ? 'The party leader disconnected: you left the party.' : 'Disconnected from the host.');
    }
  };

  // ---------- browse public lobbies ----------
  N.browse = function (cb) {
    if (!N.available()) { cb(new Error('Online library failed to load.'), []); return; }
    const found = [];
    const peer = new window.Peer({ debug: 0, config: ICE });
    let finished = false;
    const end = () => { if (finished) return; finished = true; try { peer.destroy(); } catch (e) { /* ignore */ } cb(null, found.sort((a, b) => a.code.localeCompare(b.code))); };
    // done as soon as every public slot has answered (a lobby's info, or "nobody there"), at most 4.5 s
    let settled = 0;
    const settle = () => { if (++settled >= MAX_PUBLIC) setTimeout(end, 50); };
    peer.on('open', () => {
      for (let n = 1; n <= MAX_PUBLIC; n++) {
        const conn = peer.connect(peerId('PUB' + n), { reliable: true, serialization: 'json' });
        let done = false;
        const fin = () => { if (!done) { done = true; settle(); } };
        conn.on('open', () => sendConn(conn, { t: 'info' }));
        conn.on('data', (msg) => { if (msg && msg.t === 'info') { found.push(msg.lobby); try { conn.close(); } catch (e) { /* ignore */ } fin(); } });
        conn.on('error', fin);
        conn.on('close', fin);
      }
      setTimeout(end, 4500);
    });
    peer.on('error', (err) => { if (err.type === 'peer-unavailable') settle(); else console.warn('[net] browse', err); });
    setTimeout(end, 9000);
  };

  // ---------- DEDICATED SERVER (WebSocket): parties, matchmaking, server-run matches ----------
  N.srv = { ws: null, status: 'off', pid: null, party: null, queue: null, online: 0, matches: 0, url: '' };
  N.serverUrl = function () {
    const s = BL.Save.p.settings.serverUrl;
    if (s) return s;
    if (BL.SERVER_URL) return BL.SERVER_URL;
    if (/^https?:$/.test(location.protocol)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return '';
  };
  N.connectServer = function (cb) {
    if (N.srv.ws && (N.srv.status === 'on' || N.srv.status === 'connecting')) { if (cb) cb(N.srv.status === 'on' ? null : new Error('Connecting...')); return; }
    const url = N.serverUrl();
    if (!url) { if (cb) cb(new Error('No server address set.')); return; }
    let ws;
    try { ws = new WebSocket(url); } catch (e) { N.srv.status = 'off'; emit('srv'); if (cb) cb(e); return; }
    N.srv.ws = ws; N.srv.status = 'connecting'; N.srv.url = url;
    emit('srv');
    let done = false;
    const finish = (err) => { if (done) return; done = true; clearTimeout(timer); if (cb) cb(err); };
    const timer = setTimeout(() => { if (N.srv.status !== 'on') { try { ws.close(); } catch (e) { /* ignore */ } finish(new Error('Server not reachable.')); } }, 6000);
    ws.onopen = () => { const m = me(); ws.send(JSON.stringify({ t: 'hello', name: m.name, level: m.level, title: m.title, tag: m.tag, tagc: m.tagc, loadout: m.loadout, mmr: BL.Save.p.mmr, v: BL.VERSION })); };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hi') { N.srv.status = 'on'; N.srv.pid = m.pid; N.srv.online = m.online; emit('srv'); finish(null); return; }
      N.srvRecv(m);
    };
    ws.onclose = () => {
      if (N.srv.ws !== ws) return;
      N.srv.ws = null; N.srv.status = 'off'; N.srv.party = null; N.srv.queue = null;
      emit('srv'); emit('queue');
      finish(new Error('Server not reachable.'));
      if (N.transport === 'ws') N.lostHost();
    };
    ws.onerror = () => {};
  };
  N.srvSend = function (m) { if (N.srv.ws && N.srv.ws.readyState === 1) N.srv.ws.send(JSON.stringify(m)); };
  N.srvRecv = function (m) {
    switch (m.t) {
      case 'stats': N.srv.online = m.online; N.srv.matches = m.matches; emit('srv'); break;
      case 'party': N.srv.party = m.party; emit('srv'); break;
      case 'queue': N.srv.queue = m.state === 'searching' ? m : null; emit('queue'); break;
      case 'err': BL.Menu.toast(m.m); break;
      case 'lobby': N.useServer(); N.lobby = cleanLobby(m.lobby); emit('lobby', N.lobby); break;
      case 'lchat': emit('lchat', m); break;
      case 'start': N.useServer(); N.clientRecv(m); break;
      default: if (N.transport === 'ws') N.clientRecv(m);
    }
  };
  N.useServer = function () {
    if (N.transport === 'ws') return;
    N.leaveP2P();
    N.transport = 'ws'; N.role = 'client'; N.myPid = N.srv.pid;
    N.hostConn = { open: true, send: (msg) => N.srvSend(msg), close() {} };
    N.startPing();
  };
  N.sendProfile = function () { const m = me(); N.srvSend({ t: 'profile', name: m.name, tag: m.tag, tagc: m.tagc, loadout: m.loadout, mmr: BL.Save.p.mmr }); };
  N.queue = function (playlist, ranked) { N.sendProfile(); N.srvSend({ t: 'queue', playlist, ranked: !!ranked }); };
  N.unqueue = function () { N.srvSend({ t: 'unqueue' }); };
  N.partyCreate = () => N.srvSend({ t: 'party.create' });
  N.partyJoin = (code) => N.srvSend({ t: 'party.join', code });
  N.partyLeave = () => N.srvSend({ t: 'party.leave' });
  N.partyKick = (pid) => N.srvSend({ t: 'party.kick', pid });
  N.roomCreate = () => { N.sendProfile(); N.srvSend({ t: 'room.create' }); };
  N.roomJoin = (code) => { N.sendProfile(); N.srvSend({ t: 'room.join', code }); };
  N.isLobbyOwner = () => (N.transport === 'ws' ? !!(N.lobby && N.lobby.owner === N.myPid) : N.role === 'host');
  N.sendToHost = (msg) => sendConn(N.hostConn, msg);

  N.leaveP2P = function () {
    if (N.transport === 'ws') return;
    clearInterval(N.pingTimer);
    if (N.hostConn) { try { N.hostConn.close(); } catch (e) { /* ignore */ } }
    for (const pid in N.conns) { try { N.conns[pid].close(); } catch (e) { /* ignore */ } }
    if (N.peer) { try { N.peer.destroy(); } catch (e) { /* ignore */ } }
    N.peer = null; N.role = null; N.conns = {}; N.hostConn = null; N.lobby = null; N.rtt = 0; N.myPid = null; N.transport = null; N.local = false; N.relay = false;
  };

  // leave the current match / lobby (keeps the server connection and party)
  N.leave = function () {
    if (N.transport === 'ws') {
      N.srvSend({ t: 'leaveMatch' });
      N.srvSend({ t: 'room.leave' });
      clearInterval(N.pingTimer);
      N.transport = null; N.role = null; N.hostConn = null; N.lobby = null; N.myPid = null; N.rtt = 0;
      return;
    }
    N.leaveP2P();
  };
  N.leaveMatchOnly = function () { if (N.transport === 'ws') N.srvSend({ t: 'leaveMatch' }); };

  N._oldLeave = function () {
    clearInterval(N.pingTimer);
    if (N.hostConn) { try { N.hostConn.close(); } catch (e) { /* ignore */ } }
    for (const pid in N.conns) { try { N.conns[pid].close(); } catch (e) { /* ignore */ } }
    if (N.peer) { try { N.peer.destroy(); } catch (e) { /* ignore */ } }
    N.peer = null; N.role = null; N.conns = {}; N.hostConn = null; N.lobby = null; N.rtt = 0; N.myPid = null;
  };
  window.addEventListener('beforeunload', () => N.leave());
})(window.BL);
