'use strict';
// Rocket League (fan remake) - keeping your progress safe:
//  - an account on the game server (server/accounts.js): sign up once, your profile syncs after every save, and
//    signing in on another browser or device brings it back
//  - backup files you can save and load anywhere (works offline and from file://)
//  - a daily snapshot inside the browser, used if the main save ever gets damaged
(function (BL) {
  const S = BL.Save;
  const A = BL.Account = { busy: false, status: '' };
  const SNAP = 'boostleague_snapshot_v1';

  // the server's http address: from the server URL setting (ws://host/ws -> http://host) or the page itself
  A.base = function () {
    const ws = BL.Net && BL.Net.serverUrl ? BL.Net.serverUrl() : '';
    if (ws) return ws.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws\/?$/, '');
    if (/^https?:$/.test(location.protocol)) return location.origin;
    return '';
  };
  A.signedIn = () => !!(S.p.account && S.p.account.token);
  // (the owner code stays on the device it was typed into: never synced or written into backups)
  const cleanProfile = () => { const p = JSON.parse(JSON.stringify(S.p)); delete p.account; delete p.ownerCode; return p; };
  async function call(action, body, base) {
    const b = base || (S.p.account && S.p.account.base) || A.base();
    if (!b) throw new Error('No game server set. Accounts are kept on the game server: set its address under Settings > Account, or use backup files.');
    let r;
    try { r = await fetch(b + '/api/account/' + action, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('Could not reach the game server at ' + b + '.'); }
    let j = {}; try { j = await r.json(); } catch (e) { /* not json */ }
    if (!r.ok) throw new Error(j.error || 'Server error (' + r.status + ').');
    return j;
  }
  A.register = async function (user, pass) {
    const base = A.base(), j = await call('register', { user, pass }, base);
    S.p.account = { user: j.user, token: j.token, base, synced: 0 };
    S.save();
    await A.sync(true);
    return j;
  };
  // sign in: returns { remote } when the account already has progress saved, so the menu can ask which to keep
  A.login = async function (user, pass) {
    const base = A.base(), j = await call('login', { user, pass }, base);
    const keep = S.p.account;
    S.p.account = { user: j.user, token: j.token, base, synced: 0 };
    S.save();
    if (j.profile && j.profile.inventory) return { remote: j.profile, updated: j.updated, prev: keep };
    await A.sync(true);
    return {};
  };
  A.useRemote = function (remote) {
    const acct = S.p.account;
    remote.account = acct;
    localStorage.setItem('boostleague_profile_v1', JSON.stringify(remote));
    location.reload();
  };
  A.logout = async function () {
    const a = S.p.account;
    if (a) { try { await call('logout', { user: a.user, token: a.token }); } catch (e) { /* offline: forget it locally anyway */ } }
    delete S.p.account; S.save();
  };
  A.sync = async function (now) {
    if (!A.signedIn() || A.busy) return;
    const a = S.p.account;
    A.busy = true;
    try { const j = await call('save', { user: a.user, token: a.token, profile: cleanProfile() }); a.synced = j.updated || Date.now(); A.status = ''; saveRaw(); }
    catch (e) { A.status = e.message; if (/sign in again/i.test(e.message)) { delete S.p.account; saveRaw(); } }
    A.busy = false;
    BL.bus.emit('account');
    void now;
  };
  // every save schedules a sync a little later (so a burst of saves is one upload)
  let timer = null;
  const save0 = S.save;
  function saveRaw() { save0.call(S); }
  S.save = function () {
    save0.apply(S, arguments);
    if (A.signedIn()) { clearTimeout(timer); timer = setTimeout(() => A.sync(), 15000); }
    snapshot();
  };
  window.addEventListener('pagehide', () => { if (A.signedIn() && timer) { clearTimeout(timer); const a = S.p.account; try { navigator.sendBeacon && navigator.sendBeacon(a.base + '/api/account/save', new Blob([JSON.stringify({ user: a.user, token: a.token, profile: cleanProfile() })], { type: 'text/plain' })); } catch (e) { /* best effort */ } } });

  // ---- backup files ----
  A.exportFile = function () {
    const data = { format: 'rl-fan-remake-progress', version: 1, saved: new Date().toISOString(), profile: cleanProfile() };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    const day = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = 'rocket-league-progress-' + String(S.p.name || 'player').replace(/[^A-Za-z0-9_-]+/g, '_') + '-' + day + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  // reads a backup file; resolves with { profile, saved } for the menu to confirm
  A.readFile = function (file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result), p = d && (d.profile || d);
          if (!p || !p.inventory || !p.loadout) throw new Error('bad');
          res({ profile: p, saved: d.saved || null });
        } catch (e) { rej(new Error('That file is not a Rocket League progress backup.')); }
      };
      r.onerror = () => rej(new Error('Could not read that file.'));
      r.readAsText(file);
    });
  };
  A.importProfile = function (p) {
    if (S.p.account) p.account = S.p.account;
    localStorage.setItem('boostleague_profile_v1', JSON.stringify(p));
    location.reload();
  };

  // ---- daily snapshot in the browser (restores a damaged save) ----
  function snapshot() {
    try {
      const day = new Date().toISOString().slice(0, 10), cur = JSON.parse(localStorage.getItem(SNAP) || 'null');
      if (cur && cur.day === day) return;
      localStorage.setItem(SNAP, JSON.stringify({ day, profile: S.p }));
    } catch (e) { /* storage full */ }
  }
  A.snapshotInfo = () => { try { const s = JSON.parse(localStorage.getItem(SNAP) || 'null'); return s && s.profile ? { day: s.day, level: s.profile.level, name: s.profile.name } : null; } catch (e) { return null; } };
  A.restoreSnapshot = () => { const s = JSON.parse(localStorage.getItem(SNAP)); localStorage.setItem('boostleague_profile_v1', JSON.stringify(s.profile)); location.reload(); };
  // if the main save can't be read, put the snapshot back before the profile loads
  try {
    const raw = localStorage.getItem('boostleague_profile_v1');
    let bad = false;
    if (raw) { try { const p = JSON.parse(raw); bad = !p || !p.inventory; } catch (e) { bad = true; } }
    const snap = bad && JSON.parse(localStorage.getItem(SNAP) || 'null');
    if (snap && snap.profile) localStorage.setItem('boostleague_profile_v1', JSON.stringify(snap.profile));
  } catch (e) { /* storage blocked */ }

  // ---- display name: once every two weeks ----
  A.NAME_COOLDOWN = 14 * 864e5;
  A.nameWait = () => Math.max(0, (S.p.nameChangedAt || 0) + A.NAME_COOLDOWN - Date.now());
  A.validName = (n) => /^[A-Za-z0-9_\-. ]{3,16}$/.test(n) && n.trim() === n && !BL.NameFilter.bad(n);
})(window.BL);
