'use strict';
// Rocket League (fan remake) - chat moderation:
//  - the chat filter (Settings > Chat, on by default): swearing and slurs in messages become ****, the same word list
//    and leet spellings as names (js/namefilter.js); links are taken out; long runs of one letter are cut down
//  - who you see: Everyone / Teammates / Quick chat only / Nobody
//  - mute players for the rest of the match (pause menu), block players for good (friends list): nothing from a
//    blocked player reaches you (chat, friend requests, invites, trades)
//  - spam: four messages in four seconds and you wait (game.js); the host drops a flood from anyone (js/net.js)
(function (BL) {
  const NF = BL.NameFilter;
  const MOD = BL.Mod = { muted: new Set() };
  const settings = () => (BL.Save && BL.Save.p && BL.Save.p.settings) || {};
  // invisible and control characters (written as escapes: a raw line separator would end the line)
  const CTRL = new RegExp('[\u0000-\u001f\u200b-\u200f\u2028-\u202e]', 'g');
  const LINK = /\b((https?:\/\/|www\.)\S+|\S+\.(com|net|org|gg|io|ly|xyz|ru|tk|me|tv|co|app|link)(\/\S*)?)\b/gi;
  // one word at a time, so a whole message isn't thrown out for one bad word (and "Class" isn't "ass")
  MOD.clean = function (msg) {
    let s = String(msg || '').replace(CTRL, '').slice(0, 120);
    if (settings().chatFilter === false) return s;
    s = s.replace(LINK, '[link]');
    s = s.replace(/(.)\1{4,}/g, '$1$1$1');
    s = s.replace(/[^\s]+/g, (w) => (NF && NF.bad(w) ? '*'.repeat(Math.min(8, w.length)) : w));
    // spaced-out words ("f u c k"): runs of single letters are checked joined up
    s = s.replace(/\b(?:\w[\s.\-_]){2,}\w\b/g, (run) => { const j = run.replace(/[\s.\-_]/g, ''); return NF && NF.bad(j) ? '*'.repeat(Math.min(8, j.length)) : run; });
    return s;
  };
  // should a chat line from this player show? (System lines always do)
  MOD.allowed = function (name, team, myTeam, quick) {
    if (name === 'System') return true;
    if (MOD.muted.has(String(name).toLowerCase())) return false;
    if (MOD.blockedName(name)) return false;
    const who = settings().chatFrom || 'all';
    if (who === 'none') return false;
    if (who === 'quick') return !!quick;
    if (who === 'team') return team === myTeam;
    return true;
  };
  MOD.mute = (name, on) => { const k = String(name).toLowerCase(); if (on === false || (on == null && MOD.muted.has(k))) MOD.muted.delete(k); else MOD.muted.add(k); };
  MOD.isMuted = (name) => MOD.muted.has(String(name).toLowerCase());
  // blocking (kept): by friend code, with the name it had, so a blocked player's chat in a party is hidden too
  const blocks = () => { const p = BL.Save.p; p.blocked = p.blocked || []; return p.blocked; };
  MOD.block = function (code, name) { const b = blocks(); if (!b.some((x) => x.code === code)) b.push({ code, name: String(name || '').slice(0, 16), at: Date.now() }); BL.Save.save(); };
  MOD.unblock = function (code) { const p = BL.Save.p; p.blocked = blocks().filter((x) => x.code !== code); BL.Save.save(); };
  MOD.blocked = (code) => blocks().some((x) => x.code === code);
  MOD.blockedName = (name) => blocks().some((x) => x.name && x.name.toLowerCase() === String(name).toLowerCase());
  MOD.list = () => blocks().slice();
  // a new match starts with nobody muted
  if (BL.bus && BL.bus.on) BL.bus.on('match:start', () => MOD.muted.clear());
})(window.BL);
