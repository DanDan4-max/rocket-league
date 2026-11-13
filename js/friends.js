'use strict';
// Rocket League (fan remake) - friends: friend codes, friend requests, who's online, party and club invites
// (clubs themselves: js/club.js).
// Peer-to-peer through PeerJS (the same free relay online play uses): each player listens on "rlfr-<friend
// code>". A request or invite reaches the other player whenever both games are open; nothing is stored online.
(function (BL) {
  const S = BL.Save, U = BL.util;
  const F = BL.Friends = { online: {}, ready: false, status: 'off' };
  const PREFIX = 'rlfr-';
  let peer = null;

  function prof() {
    const p = S.p;
    if (!p.friendCode) { p.friendCode = U.code(6).toUpperCase(); S.save(); }
    p.friends = p.friends || [];
    p.friendReqs = p.friendReqs || [];
    p.invites = p.invites || [];
    return p;
  }
  F.code = () => prof().friendCode;
  const me = () => { const p = prof(); return { code: p.friendCode, name: p.name, level: p.level }; };
  const changed = () => { S.save(); if (BL.bus) BL.bus.emit('friends'); };

  // one short-lived connection per message
  function send(code, msg, cb) {
    if (!peer || peer.disconnected || peer.destroyed) { if (cb) cb(false); return; }
    let done = false;
    const c = peer.connect(PREFIX + code, { reliable: true });
    const finish = (ok) => { if (done) return; done = true; if (cb) cb(ok); setTimeout(() => { try { c.close(); } catch (e) { /* closed */ } }, 1500); };
    c.on('open', () => { c.send(Object.assign({ from: me() }, msg)); finish(true); });
    c.on('error', () => finish(false));
    setTimeout(() => finish(false), 6000);
  }
  function upsertFriend(f) {
    const p = prof(), i = p.friends.findIndex((x) => x.code === f.code);
    const v = { code: f.code, name: BL.NameFilter.clean(f.name || 'Player'), level: f.level || 1 };
    if (i >= 0) p.friends[i] = Object.assign(p.friends[i], v); else p.friends.push(Object.assign({ since: Date.now() }, v));
  }
  function onMessage(m, peerId) {
    const p = prof(), from = m && m.from;
    if (!from || !from.code || from.code === p.friendCode) return;
    // (who sent it is whoever is on the other end of the connection, not what the message says)
    if (peerId && String(peerId) !== PREFIX + from.code) return;
    from.name = BL.NameFilter.clean(from.name);
    const isFriend = p.friends.some((f) => f.code === from.code);
    switch (m.t) {
      case 'freq':
        if (isFriend) { send(from.code, { t: 'facc' }); break; }
        if (!p.friendReqs.some((r) => r.code === from.code)) { p.friendReqs.push({ code: from.code, name: BL.NameFilter.clean(from.name), level: from.level }); BL.Menu.toast(from.name + ' sent you a friend request'); }
        break;
      case 'facc':
        upsertFriend(from); p.friendReqs = p.friendReqs.filter((r) => r.code !== from.code);
        BL.Menu.toast(from.name + ' is now your friend'); F.online[from.code] = Date.now();
        break;
      case 'ping':
        if (isFriend) { F.online[from.code] = Date.now(); upsertFriend(from); send(from.code, { t: 'pong' }); }
        break;
      case 'pong':
        if (isFriend) { F.online[from.code] = Date.now(); upsertFriend(from); }
        break;
      case 'pinv': case 'cinv':
        if (!isFriend) break;
        p.invites = p.invites.filter((x) => !(x.t === m.t && x.code === from.code)).concat([{ t: m.t, code: from.code, name: BL.NameFilter.clean(from.name), room: m.room || null, club: m.club || null, at: Date.now() }]);
        BL.Menu.toast(from.name + (m.t === 'pinv' ? ' invited you to their party' : ' invited you to the club ' + (m.club ? '[' + m.club.tag + '] ' + m.club.name : '')));
        break;
      default:
        // clubs (js/club.js) keep in step on their own
        if (BL.Club && BL.Club.handles(m.t)) { BL.Club.onMessage(m, isFriend); return; }
        // trades and gifts (js/trade.js)
        if (BL.Trade) BL.Trade.onMessage(m, isFriend);
        return;
    }
    changed();
  }
  F.send = (code, msg, cb) => send(code, msg, cb);

  F.start = function () {
    if (peer || typeof window.Peer === 'undefined') { F.status = typeof window.Peer === 'undefined' ? 'unavailable' : F.status; return; }
    prof();
    F.status = 'connecting';
    try { peer = new window.Peer(PREFIX + prof().friendCode, { debug: 0 }); } catch (e) { F.status = 'unavailable'; return; }
    peer.on('open', () => { F.status = 'on'; F.ready = true; changed(); F.pingAll(); if (BL.Club) setTimeout(BL.Club.tick, 1500); });
    peer.on('connection', (c) => c.on('data', (d) => onMessage(d, c.peer)));
    peer.on('disconnected', () => { F.status = 'off'; setTimeout(() => { try { peer.reconnect(); } catch (e) { /* gone */ } }, 4000); });
    peer.on('error', (e) => {
      // someone else (another tab) already listens on this code: stay quiet; the rest are network trouble
      if (e && e.type === 'unavailable-id') { F.status = 'in use'; return; }
      if (e && e.type === 'peer-unavailable') return;
      F.status = 'off';
    });
    setInterval(F.pingAll, 30000);
  };
  F.pingAll = function () { for (const f of prof().friends) send(f.code, { t: 'ping' }); if (BL.Club && F.ready) BL.Club.tick(); };
  F.isOnline = (code) => Date.now() - (F.online[code] || 0) < 75000;

  F.request = function (code, cb) {
    code = String(code || '').trim().toUpperCase();
    if (!code || code === prof().friendCode) { if (cb) cb('That is your own code.'); return; }
    send(code, { t: 'freq' }, (ok) => { if (cb) cb(ok ? null : 'Could not reach that player. They need to be online with the game open.'); });
  };
  F.accept = function (code) {
    const p = prof(), r = p.friendReqs.find((x) => x.code === code);
    if (!r) return;
    upsertFriend(r); p.friendReqs = p.friendReqs.filter((x) => x.code !== code);
    send(code, { t: 'facc' }); changed();
  };
  F.decline = (code) => { const p = prof(); p.friendReqs = p.friendReqs.filter((x) => x.code !== code); changed(); };
  F.remove = (code) => { const p = prof(); p.friends = p.friends.filter((x) => x.code !== code); changed(); };
  // party invite: your P2P party (lobby) code goes along; the friend joins it from their notifications
  F.invite = function (code, cb) {
    const L = BL.Net && BL.Net.lobby;
    if (!L) { if (cb) cb('Create a party first.'); return; }
    send(code, { t: 'pinv', room: L.code }, (ok) => { if (cb) cb(ok ? null : 'They are offline.'); });
  };
  // any member can invite a friend; joining goes through the club's owner (js/club.js)
  F.clubInvite = function (code, cb) {
    const k = BL.Club && BL.Club.invitePayload();
    if (!k) { if (cb) cb('Make or join a club first.'); return; }
    send(code, { t: 'cinv', club: k }, (ok) => { if (cb) cb(ok ? null : 'They are offline.'); });
  };
  F.acceptInvite = function (i) {
    const p = prof(), inv = p.invites[i];
    if (!inv) return;
    p.invites.splice(i, 1);
    if (inv.t === 'pinv' && inv.room) (BL.Menu._x.ACT.joinParty || BL.Menu._x.ACT.joinCode)(inv.room);
    if (inv.t === 'cinv' && inv.club && BL.Club) BL.Club.join(inv.club);
    changed();
  };
  F.dropInvite = (i) => { const p = prof(); p.invites.splice(i, 1); changed(); };
})(window.BL);
