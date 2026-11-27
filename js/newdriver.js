'use strict';
// Rocket League (fan remake) - New Driver Challenges, the way the real game's work (researched 2026-11-21: added
// with free-to-play in 2020 as a starter list that fills a new account's garage, and since Season 20 / v2.56 the
// gate to Competitive: they "measure the player's skill, placing them in an appropriate starting rank"). A NEW
// DRIVER tab in Challenges, tasks worked through in order (each stage opens when the one before is done), every task
// gives an item, and the last stage is a Skill Check whose results set where your Competitive placements start.
// When it's all done the tab goes away.
// Every reward is a car or a decal made for one (2026-11-21: "make each new driver challenge feature a car or car
// decal related to the car"): new profiles start with the Octane, Fennec and Dominus, and these hand out the
// Mustang, Gunship, Guardian and Roadster plus each car's own decal (js/cardecals.js). One you already own comes
// painted instead.
// Competitive stays locked for everyone until they're all done (2026-11-21: "make it so you cant do ranked till new
// driver challanges are complete").
(function (BL) {
  const ND = BL.NewDriver = {};
  const U = BL.util;
  // stat: what counts (match stats add up; the skill checks record a result)
  ND.STAGES = [
    { id: 'first', name: 'FIRST STEPS', tasks: [
      { id: 'nd_match', name: 'Hit the Road', desc: 'Play a match', stat: 'matches', goal: 1, reward: { item: 'decal_car_octane' } },
      { id: 'nd_boost', name: 'Boost Up', desc: 'Boost for 20 seconds in total', stat: 'boost', goal: 20, reward: { item: 'body_custom_mustang' } },
      { id: 'nd_touch', name: 'Ball Work', desc: 'Touch the ball 25 times in Free Play', stat: 'fpTouch', goal: 25, reward: { item: 'decal_car_fennec' } },
      { id: 'nd_goal', name: 'First Goal', desc: 'Score a goal in a match', stat: 'goals', goal: 1, reward: { item: 'decal_car_mustang' } },
    ] },
    { id: 'getting', name: 'GETTING IT', tasks: [
      { id: 'nd_win', name: 'Winner', desc: 'Win a match', stat: 'wins', goal: 1, reward: { item: 'body_custom_samus' } },
      { id: 'nd_save', name: 'Keeper', desc: 'Make 2 saves', stat: 'saves', goal: 2, reward: { item: 'decal_car_dominus' } },
      { id: 'nd_air', name: 'Take Flight', desc: 'Hit the ball in the air 3 times in matches', stat: 'aerials', goal: 3, reward: { item: 'decal_car_samus' } },
      { id: 'nd_assist', name: 'Team Player', desc: 'Get an assist', stat: 'assists', goal: 1, reward: { item: 'body_custom_guardian' } },
    ] },
    { id: 'check', name: 'SKILL CHECK', tasks: [
      { id: 'nd_striker', name: 'Skill Check: Striker', desc: 'Finish the Striker training pack (10 shots)', stat: 'striker', goal: 1, check: 'striker', reward: { item: 'decal_car_guardian' } },
      { id: 'nd_goalie', name: 'Skill Check: Goalie', desc: 'Finish the Goalie training pack (10 shots)', stat: 'goalie', goal: 1, check: 'goalie', reward: { item: 'decal_car_roadster' } },
      { id: 'nd_show', name: 'Skill Check: Showdown', desc: 'Play a 1v1 against a Pro opponent', stat: 'showdown', goal: 1, check: 'showdown', reward: { item: 'body_custom_roadster' } },
    ] },
  ];
  ND.TASKS = [].concat(...ND.STAGES.map((s) => s.tasks));
  const COMP = ['duel', 'doubles', 'standard', 'heatseeker', 'rumble', 'snowday'];

  ND.state = function () {
    const p = BL.Save.p;
    if (!p) return null;
    if (!p.newDriver) {
      const ranked = Object.values(p.rankedGames || {}).reduce((a, b) => a + (b || 0), 0);
      p.newDriver = { prog: {}, done: {}, results: {}, complete: false, lock: ranked === 0, got: {} };
    }
    return p.newDriver;
  };
  ND.active = () => { const s = ND.state(); return !!s && !s.complete; };
  ND.locked = () => ND.active();
  ND.stageOpen = (i) => { const s = ND.state(); return i === 0 || ND.STAGES[i - 1].tasks.every((t) => s.done[t.id]); };
  ND.count = () => { const s = ND.state(); return { done: ND.TASKS.filter((t) => s.done[t.id]).length, all: ND.TASKS.length }; };
  ND.list = function () {
    const s = ND.state();
    return ND.STAGES.map((st, i) => ({ id: st.id, name: st.name, open: ND.stageOpen(i), tasks: st.tasks.map((t) => Object.assign({}, t, { progress: Math.min(t.goal, s.prog[t.id] || 0), done: !!s.done[t.id], got: s.got[t.id] || null, gotPaint: (s.gotPaint || {})[t.id] || null })) }));
  };
  // what a task gives: its car or car decal; one you already own comes painted (the same paint for everyone)
  ND.rewardOf = function (r) {
    const S = BL.Save, it = r && r.item && BL.ITEM_BY_ID[r.item];
    if (!it) return null;
    if (!S.owns(it.id)) return { it, paint: null };
    const ps = BL.PAINTS.slice().sort((a, b) => (U.hash('nd:' + it.id + ':' + a.id) >>> 0) - (U.hash('nd:' + it.id + ':' + b.id) >>> 0));
    const pt = ps.find((x) => !S.owns(it.id, x.id));
    return pt ? { it, paint: pt.id } : null;
  };
  // (older task lists named a kind of item: one you don't have yet, common first)
  function pickItem(r) {
    if (r.item) return ND.rewardOf(r);
    const rar = r.rarity || ['common'], S = BL.Save;
    const pool = BL.ITEMS.filter((i) => i.cat === r.cat && rar.indexOf(i.rarity) >= 0 && !i.def && !i.pass && !i.fest && !i.tour && !i.duels && i.rank == null && !S.owns(i.id) && (i.cat !== 'decal' || (i.pattern && i.pattern !== 'none')));
    pool.sort((a, b) => (U.hash('nd:' + a.id) >>> 0) - (U.hash('nd:' + b.id) >>> 0));
    return pool[0] ? { it: pool[0], paint: null } : null;
  }
  function toast(m) { if (BL.Menu && BL.Menu.toast) BL.Menu.toast(m); }
  function complete(t) {
    const s = ND.state(), S = BL.Save;
    s.done[t.id] = 1;
    const pk = pickItem(t.reward), it = pk && pk.it;
    if (it) { S.addItem(it.id, pk.paint, null, true); s.got[t.id] = it.id; if (pk.paint) (s.gotPaint || (s.gotPaint = {}))[t.id] = pk.paint; } else { S.p.credits += 150; s.got[t.id] = 'credits'; }
    const pn = pk && pk.paint && BL.PAINT_BY_ID[pk.paint] ? BL.PAINT_BY_ID[pk.paint].name + ' ' : '';
    toast('New Driver Challenge complete: ' + t.name + (it ? ' • ' + pn + it.name + (it.cat === 'body' ? ' (car)' : '') + ' unlocked' : ' • 150 Credits'));
    if (ND.TASKS.every((x) => s.done[x.id])) finish();
    S.save();
  }
  // a match stat (or Free Play touches / boost seconds) for the open tasks that count it
  ND.add = function (stat, n) {
    if (!n || !ND.active()) return;
    const s = ND.state();
    ND.STAGES.forEach((st, i) => {
      if (!ND.stageOpen(i)) return;
      for (const t of st.tasks) {
        if (t.stat !== stat || s.done[t.id] || t.check) continue;
        s.prog[t.id] = Math.min(t.goal, (s.prog[t.id] || 0) + n);
        if (s.prog[t.id] >= t.goal) complete(t);
      }
    });
  };
  // a Skill Check's result (0..1): only once its stage is open
  ND.check = function (kind, score, detail) {
    if (!ND.active()) return false;
    const s = ND.state(), i = ND.STAGES.findIndex((st) => st.tasks.some((t) => t.check === kind)), t = ND.TASKS.find((x) => x.check === kind);
    if (!t || s.done[t.id] || !ND.stageOpen(i)) return false;
    s.results[kind] = { score: U.clamp(score, 0, 1), detail: detail || '' };
    s.prog[t.id] = 1;
    complete(t);
    return true;
  };
  ND.onMatch = function (game, r, won, local) {
    if (!ND.active() || !local || game.mode === 'freeplay') return;
    const st = local.stats || {};
    const ctx = game.cfg && game.cfg.ctx;
    if (ctx && ctx.kind === 'nd') {
      const me = r.score[local.team], them = r.score[1 - local.team];
      ND.check('showdown', U.clamp(0.5 + (me - them) * 0.14 + (won ? 0.08 : 0), 0, 1), me + '-' + them);
    }
    ND.add('matches', 1); ND.add('goals', st.goals || 0); ND.add('wins', won ? 1 : 0); ND.add('saves', st.saves || 0);
    ND.add('aerials', st.aerialHits || 0); ND.add('assists', st.assists || 0);
  };
  // all done: the Skill Checks set your starting MMR in every Competitive playlist you haven't played yet (Bronze I to
  // about Platinum I), Competitive opens, and a title and a drop
  function finish() {
    const s = ND.state(), p = BL.Save.p, R = s.results;
    const sg = R.striker ? R.striker.score : 0.4, sv = R.goalie ? R.goalie.score : 0.4, sd = R.showdown ? R.showdown.score : 0.4;
    const skill = 0.35 * sg + 0.3 * sv + 0.35 * sd, start = Math.round(140 + skill * 560);
    for (const pl of COMP) if (!((p.rankedGames || {})[pl] > 0)) p.mmr[pl] = start;
    s.complete = true; s.skill = +skill.toFixed(3); s.startMMR = start; s.finishedAt = Date.now();
    if (BL.ITEM_BY_ID.title_newdriver && !BL.Save.owns('title_newdriver')) BL.Save.addItem('title_newdriver', null, null, true);
    if (BL.Save.awardDrop) BL.Save.awardDrop('rare');
    const rk = BL.Save.rankInfo(start);
    setTimeout(() => toast('New Driver Challenges done! Competitive is open: your placements start around ' + rk.full + ' (from your Skill Check)'), 900);
  }
  ND.finishForTest = finish;
})(window.BL);
