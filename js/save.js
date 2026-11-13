'use strict';
// Rocket League (fan remake) - profile, inventory, progression (localStorage)
(function (BL) {
  const U = BL.util;
  const KEY = 'boostleague_profile_v1';
  const S = BL.Save = { p: null };

  const SLOTS = ['body', 'decal', 'finish', 'wheels', 'wheeldecal', 'boost', 'topper', 'antenna', 'explosion', 'anthem', 'title'];
  S.SLOTS = SLOTS;

  function defaultSettings() {
    return {
      quality: 'auto', vsync: true, resScale: 1, showFps: false,
      fov: 110, camDist: 2.7, camHeight: 1.05, camStiff: 0.45, camAngle: 4, camTrans: 1.2, shake: true, ballCam: true,
      master: 0.8, sfx: 0.9, music: 0.45, engine: 0.55, touch: 'auto', invertPitch: false,
      deadzone: 0.15, steerSens: 1, vibration: true,
    };
  }

  function defaultProfile() {
    const p = {
      v: 1, name: 'Player' + U.randInt(100, 999), level: 1, xp: 0, credits: 500, created: Date.now(),
      mmr: { duel: 400, doubles: 400, standard: 400, heatseeker: 400, rumble: 400 },
      stats: { matches: 0, wins: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0, demos: 0, aerialGoals: 0, score: 0, epicSaves: 0 },
      inventory: [], drops: [], loadout: {}, colors: { blue: 0, orange: 0, accent: '#f5f5f5' },
      settings: defaultSettings(), shopBought: {}, seen: {},
      pass: defaultPass(), challenges: { day: '', list: [] },
    };
    for (const it of BL.ITEMS) {
      if (it.def) {
        const e = makeEntry(it.id, null, null);
        e.isNew = false;
        p.inventory.push(e);
        if (!p.loadout[it.cat] || it.start) p.loadout[it.cat] = e.uid;
      }
    }
    // one welcome drop; everything else has to be earned
    p.drops.push({ uid: U.uid(), rarity: 'rare', t: Date.now() });
    return p;
  }

  function defaultPass() { return { season: BL.PASS.season, xp: 0, tier: 0, premium: false, claimedFree: {}, claimedPrem: {} }; }

  function makeEntry(itemId, paint, cert) {
    return { uid: U.uid(), id: itemId, paint: paint || null, cert: cert || null, certN: 0, isNew: true, t: Date.now() };
  }

  S.load = function () {
    let p = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) p = JSON.parse(raw);
    } catch (e) { p = null; }
    if (!p || !p.inventory) p = defaultProfile();
    // migrate / repair
    if (BL.NameFilter && BL.NameFilter.bad(p.name)) p.name = 'Player' + U.randInt(100, 999);
    // the owner's name is theirs alone (js/owner.js)
    if (BL.Owner && BL.Owner.reserved(p.name) && !BL.Owner.codeOk(p.ownerCode)) p.name = 'Player' + U.randInt(100, 999);
    p.settings = Object.assign(defaultSettings(), p.settings || {});
    p.mmr = Object.assign({ duel: 400, doubles: 400, standard: 400, heatseeker: 400, rumble: 400 }, p.mmr || {});
    p.stats = Object.assign(defaultProfile().stats, p.stats || {});
    p.colors = Object.assign({ blue: 0, orange: 0, accent: '#f5f5f5' }, p.colors || {});
    if (!p.pass || p.pass.season !== BL.PASS.season) p.pass = defaultPass();
    p.challenges = p.challenges || { day: '', list: [] };
    p.inventory = p.inventory.filter((e) => BL.ITEM_BY_ID[e.id]);
    // every song used to be handed to everyone: now only the three starting ones are, the rest are earned in music
    // events. Taken back once; a song you already earned after this stays
    let songGone = false;
    if ((p.migSongs || 0) < 1) {
      p.migSongs = 1;
      p.inventory = p.inventory.filter((e) => { const d = BL.ITEM_BY_ID[e.id]; if (!(d.cat === 'anthem' && d.event)) return true; if (p.loadout.anthem === e.uid) songGone = true; return false; });
    }
    for (const it of BL.ITEMS) {
      if (it.def && !p.inventory.some((e) => e.id === it.id)) { const e = makeEntry(it.id); e.isNew = false; p.inventory.push(e); }
    }
    for (const slot of SLOTS) {
      if (!p.loadout[slot] || !p.inventory.some((e) => e.uid === p.loadout[slot])) {
        const def = p.inventory.find((e) => BL.ITEM_BY_ID[e.id].cat === slot && BL.ITEM_BY_ID[e.id].def);
        if (def) p.loadout[slot] = def.uid;
      }
    }
    if (songGone && BL.Anthems) { const e = p.inventory.find((x) => x.id === 'anthem_' + BL.Anthems.DEFAULT); if (e) p.loadout.anthem = e.uid; }
    // rank titles you'd already earned before they were rank rewards
    setTimeout(() => { if (S.p === p) S.rankRewards(); }, 0);
    if ((p.mig3d || 0) < 2) {
      p.mig3d = 2;
      const cur = p.inventory.find((e) => e.uid === p.loadout.body);
      const hatch = p.inventory.find((e) => e.id === 'body_hatch');
      if (hatch && (!cur || BL.ITEM_BY_ID[cur.id].def)) p.loadout.body = hatch.uid;
    }
    // everyone gets the basic player anthem once (they can pick another or None in the garage)
    if ((p.migAnthem || 0) < 1) {
      p.migAnthem = 1;
      const want = BL.Anthems ? 'anthem_' + BL.Anthems.DEFAULT : null;
      const e = p.inventory.find((x) => x.id === want) || p.inventory.find((x) => BL.ITEM_BY_ID[x.id] && BL.ITEM_BY_ID[x.id].cat === 'anthem' && x.id !== 'anthem_none');
      if (e) p.loadout.anthem = e.uid;
    }
    // build 1793670482 handed the new 3D goal explosions (and Dueling Dragons) to everyone; they're earned like any
    // other item, so that batch is taken back (all added in the same moment, so an earned copy stays). If one was
    // equipped, the default goes back on.
    if (p.migBoom === 1) {
      const ids = ['explosion_dragons', 'explosion_kraken', 'explosion_ufo', 'explosion_volcano', 'explosion_goldrush', 'explosion_crystal', 'explosion_disco'];
      // (the gift's moment: when the six brand-new ones arrived)
      const fresh = p.inventory.filter((e) => ids.indexOf(e.id) > 0), T = fresh.length ? Math.min(...fresh.map((e) => e.t || 0)) : 0;
      if (T) p.inventory = p.inventory.filter((e) => ids.indexOf(e.id) < 0 || Math.abs((e.t || 0) - T) > 3000);
      if (!p.inventory.some((e) => e.uid === p.loadout.explosion)) {
        const def = p.inventory.find((e) => BL.ITEM_BY_ID[e.id].cat === 'explosion' && BL.ITEM_BY_ID[e.id].def);
        if (def) p.loadout.explosion = def.uid;
      }
    }
    p.migBoom = 2;
    // the original lofted Striker is the starter again; only swaps out free default bodies
    if ((p.mig3d || 0) < 3) {
      p.mig3d = 3;
      const cur = p.inventory.find((e) => e.uid === p.loadout.body);
      const striker = p.inventory.find((e) => e.id === 'body_striker');
      if (striker && (!cur || BL.ITEM_BY_ID[cur.id].def)) p.loadout.body = striker.uid;
    }
    // this season's cars only (BL.SEASON_BODIES): an off-season body stays in the inventory, hidden,
    // and the first in-season one (the Octane) is equipped instead
    const body = p.inventory.find((e) => e.uid === p.loadout.body);
    if (!body || !BL.inSeason(BL.ITEM_BY_ID[body.id])) {
      const e = p.inventory.find((x) => BL.ITEM_BY_ID[x.id].cat === 'body' && BL.inSeason(BL.ITEM_BY_ID[x.id]));
      if (e) p.loadout.body = e.uid;
    }
    S.p = p;
    S.save();
    return p;
  };

  S.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(S.p)); } catch (e) { /* storage full or blocked */ }
  };

  S.reset = function () { S.p = defaultProfile(); S.save(); };

  S.itemDef = (id) => BL.ITEM_BY_ID[id];
  S.entry = (uid) => S.p.inventory.find((e) => e.uid === uid);
  S.isEquipped = (uid) => SLOTS.some((s) => S.p.loadout[s] === uid);

  // Identical items (same item, paint and certification) stack: the inventory still holds every copy, the menus show
  // one card with a count. The copy on show is the equipped one, if any.
  const sameKey = (e) => e.id + '|' + (e.paint || '') + '|' + (e.cert || '');
  S.stacks = function (list) {
    const by = new Map();
    for (const e of list) {
      const k = sameKey(e);
      let st = by.get(k);
      if (!st) by.set(k, st = { top: e, entries: [], isNew: false });
      st.entries.push(e);
      if (e.isNew) st.isNew = true;
      if (S.isEquipped(e.uid)) st.top = e;
    }
    return Array.from(by.values());
  };
  S.copies = (e) => { const k = sameKey(e); return S.p.inventory.filter((x) => sameKey(x) === k); };
  // what can go into a trade-in: not defaults, event songs or rank rewards, and not what you're wearing
  S.TRADE_TIERS = ['common', 'uncommon', 'rare', 'veryrare', 'import', 'exotic', 'blackmarket'];
  S.canTrade = (e) => { const d = BL.ITEM_BY_ID[e.id]; return !!d && !d.def && !d.event && d.rank == null && BL.inSeason(d) && S.TRADE_TIERS.indexOf(d.rarity) >= 0 && !S.isEquipped(e.uid); };
  // Black Market is the top: five of those trade for another one
  S.tradeTo = (rar) => S.TRADE_TIERS[Math.min(S.TRADE_TIERS.length - 1, S.TRADE_TIERS.indexOf(rar) + 1)];
  // the duplicates of a quality: every tradeable copy past the first (the one you're wearing counts as the first)
  S.spares = function (rar) {
    const out = [];
    for (const st of S.stacks(S.p.inventory.filter((e) => BL.ITEM_BY_ID[e.id].rarity === rar))) {
      const free = st.entries.filter(S.canTrade);
      out.push(...(st.entries.length > free.length ? free : free.slice(1)));
    }
    return out;
  };

  S.addItem = function (itemId, paint, cert, noSave) {
    const e = makeEntry(itemId, paint, cert);
    S.p.inventory.push(e);
    if (!noSave) S.save();
    return e;
  };

  S.removeItems = function (uids) {
    S.p.inventory = S.p.inventory.filter((e) => uids.indexOf(e.uid) < 0 || S.isEquipped(e.uid) || BL.ITEM_BY_ID[e.id].def);
    S.save();
  };

  S.equip = function (uid) {
    const e = S.entry(uid);
    if (!e) return;
    const def = BL.ITEM_BY_ID[e.id];
    S.p.loadout[def.cat] = uid;
    e.isNew = false;
    S.save();
  };

  // Loadout -> plain data used to build models (also sent over network)
  S.resolveLoadout = function (p) {
    p = p || S.p;
    const out = {};
    for (const slot of SLOTS) {
      const e = p.inventory.find((x) => x.uid === p.loadout[slot]);
      out[slot] = e ? { id: e.id, paint: e.paint, cert: e.cert } : null;
    }
    out.blue = BL.TEAM_COLORS[0][p.colors.blue] || BL.TEAM_COLORS[0][0];
    out.orange = BL.TEAM_COLORS[1][p.colors.orange] || BL.TEAM_COLORS[1][0];
    out.accent = p.colors.accent;
    return out;
  };

  // Random loadout for bots
  S.randomLoadout = function (rnd) {
    rnd = rnd || Math.random;
    const out = {};
    for (const slot of SLOTS) {
      const pool = BL.ITEMS.filter((i) => i.cat === slot && i.rarity !== 'limited' && !i.pass && i.rank == null);
      // (the dedicated server has no anthems: js/anthems.js only loads in the browser)
      if (!pool.length) continue;
      let pick = U.choice(pool, rnd);
      // bots mostly use cheaper stuff
      if (BL.RARITY_ORDER.indexOf(pick.rarity) > 4 && rnd() < 0.6) pick = pool.find((i) => i.def) || pick;
      if ((slot === 'topper' || slot === 'antenna') && rnd() < 0.5) pick = pool.find((i) => i.def);
      out[slot] = { id: pick.id, paint: rnd() < 0.2 ? U.choice(BL.PAINTS, rnd).id : null, cert: null };
    }
    out.blue = U.choice(BL.TEAM_COLORS[0], rnd);
    out.orange = U.choice(BL.TEAM_COLORS[1], rnd);
    out.accent = U.choice(BL.ACCENT_COLORS, rnd);
    return out;
  };

  // ---------- Progression ----------
  // like the real game: levels get longer up to level 20, then every level takes the same XP
  S.xpForLevel = (lvl) => 900 + Math.min(lvl, 20) * 150;

  S.addXP = function (amount) {
    const p = S.p;
    const gained = [];
    p.xp += Math.round(amount);
    while (p.xp >= S.xpForLevel(p.level)) {
      p.xp -= S.xpForLevel(p.level);
      p.level++;
      // each level up earns a drop (the only way drops come from playing; credits come from the Rocket Pass). Like the
      // real game it waits to be claimed: S.claimLevelReward
      const reward = { id: U.uid(), kind: 'level', level: p.level, rarity: U.weightedPick(BL.DROP_ODDS), item: BL.LEVEL_REWARDS[p.level] || null };
      (p.unclaimed = p.unclaimed || []).push(reward);
      gained.push(reward);
    }
    S.save();
    return gained;
  };

  S.claimLevelReward = function (id) {
    const list = S.p.unclaimed || [], i = list.findIndex((r) => r.id === id);
    if (i < 0) return null;
    const r = list.splice(i, 1)[0], out = { kind: 'level', level: r.level, drop: S.awardDrop(r.rarity) };
    if (r.item && BL.ITEM_BY_ID[r.item]) out.item = S.addItem(r.item);
    S.save();
    return out;
  };
  // everything waiting to be claimed: level-up drops plus Rocket Pass tiers reached
  S.pendingRewards = () => (S.p.unclaimed || []).length + S.passClaimable().length;

  S.addCredits = function (n) { S.p.credits = Math.max(0, S.p.credits + Math.round(n)); S.save(); };

  S.awardDrop = function (rarity) {
    const d = { uid: U.uid(), rarity: rarity || U.weightedPick(BL.DROP_ODDS), t: Date.now() };
    S.p.drops.push(d);
    S.save();
    return d;
  };

  // pick a random item of a rarity, then roll painted/certified
  S.rollItem = function (rarity, rnd) {
    rnd = rnd || Math.random;
    let pool = BL.ITEMS.filter((i) => i.rarity === rarity && !i.def && !i.pass && !i.event && i.rank == null);
    if (!pool.length) pool = BL.ITEMS.filter((i) => i.rarity === 'rare' && !i.pass && !i.event && i.rank == null);
    const it = U.choice(pool, rnd);
    const paintable = it.cat !== 'title';
    const paint = paintable && rnd() < 0.28 ? U.choice(BL.PAINTS, rnd).id : null;
    const cert = rnd() < 0.3 ? U.choice(BL.CERTS, rnd).id : null;
    return { id: it.id, paint, cert };
  };

  S.openDrop = function (dropUid) {
    const i = S.p.drops.findIndex((d) => d.uid === dropUid);
    if (i < 0) return null;
    const d = S.p.drops[i];
    S.p.drops.splice(i, 1);
    const r = S.rollItem(d.rarity);
    // (a Chromatic tournament cup always comes painted)
    if (d.painted && !r.paint) { const def = BL.ITEM_BY_ID[r.id]; if (def && def.cat !== 'title') r.paint = U.choice(BL.PAINTS).id; }
    return S.addItem(r.id, r.paint, r.cert);
  };

  S.tradeIn = function (uids) {
    if (uids.length !== 5) return null;
    const entries = uids.map(S.entry);
    if (entries.some((e) => !e || !S.canTrade(e))) return null;
    const rar = BL.ITEM_BY_ID[entries[0].id].rarity;
    if (entries.some((e) => BL.ITEM_BY_ID[e.id].rarity !== rar)) return null;
    S.p.inventory = S.p.inventory.filter((e) => uids.indexOf(e.uid) < 0);
    const r = S.rollItem(S.tradeTo(rar));
    return S.addItem(r.id, r.paint, r.cert);
  };

  S.salvageValue = (e) => {
    const r = BL.ITEM_BY_ID[e.id].rarity;
    return Math.round(BL.SHOP_PRICES[r] * 0.12) + (e.paint ? 10 : 0);
  };

  // Daily shop: deterministic by date
  S.shopItems = function () {
    const rnd = U.rng(U.hash('shop' + U.dayKey()));
    const out = [];
    const used = {};
    const wanted = ['rare', 'veryrare', 'veryrare', 'import', 'exotic', 'blackmarket'];
    for (const rar of wanted) {
      let tries = 0, r;
      do { r = S.rollItem(rar, rnd); tries++; } while (used[r.id] && tries < 20);
      used[r.id] = 1;
      const price = BL.SHOP_PRICES[rar] + (r.paint ? 100 : 0);
      out.push({ key: U.dayKey() + ':' + r.id, id: r.id, paint: r.paint, cert: null, price });
    }
    return out;
  };

  // ---------- Item Shop pages (like the real shop's tabs) ----------
  // FEATURED SHOP is today's six (above, new at midnight). The rest are new every Monday: a bundle for each of
  // three of this season's cars (the car, which everyone owns, plus a themed set to wear on it), a goal explosion
  // collection, and BUNDLES, all of them on one page. A bundle's price only counts what you don't own yet.
  const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  S.shopEnds = (week) => { const d = week ? weekStart() : new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (week ? 7 : 1)); return d.getTime(); };
  S.owns = (id, paint) => { const d = BL.ITEM_BY_ID[id]; return !!(d && d.def) || S.p.inventory.some((e) => e.id === id && (e.paint || null) === (paint || null)); };
  S.offerOwned = (o) => !!S.p.shopBought[o.key] || S.owns(o.id, o.paint);
  const THEMES = [['Neon Nights', 'pink'], ['Inferno', 'crimson'], ['Arctic', 'twhite'], ['Midnight', 'black'], ['Venom', 'lime'], ['Solar Flare', 'orange'],
    ['Deep Sea', 'cobalt'], ['Gilded', 'gold'], ['Storm Chaser', 'skyblue'], ['Royal', 'purple'], ['Wildwood', 'forest'], ['Desert Run', 'saffron']];
  const RANK = (r) => BL.RARITY_ORDER.indexOf(r);
  let pagesFor = '', pagesCache = null;
  S.shopPages = function () {
    const day = U.dayKey(), wk = weekStart().getTime();
    if (pagesFor === day && pagesCache) return pagesCache;
    const rnd = U.rng(U.hash('bundles' + wk)), ends = S.shopEnds(true);
    const pool = (cat, min, max, test) => BL.ITEMS.filter((i) => i.cat === cat && !i.def && !i.pass && !i.event && i.rank == null && RANK(i.rarity) >= RANK(min) && RANK(i.rarity) <= RANK(max || 'limited') && (!test || test(i)));
    const take = (list, used) => { const left = list.filter((i) => !used[i.id]); const it = left.length ? U.choice(left, rnd) : null; if (it) used[it.id] = 1; return it; };
    const offer = (pg, it, paint) => ({ key: 'B' + wk + ':' + pg + ':' + it.id + ':' + (paint || ''), id: it.id, paint: paint || null, cert: null, price: BL.SHOP_PRICES[it.rarity] + (paint ? 100 : 0) });
    const pages = [{ id: 'featured', name: 'FEATURED SHOP', kind: 'featured', offers: S.shopItems(), ends: S.shopEnds(false) }];
    // three of the season's cars, each with its own look
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const cars = shuffle(BL.SEASON_BODIES.filter((id) => BL.ITEM_BY_ID[id])), themes = shuffle(THEMES.slice());
    cars.slice(0, 3).forEach((carId, n) => {
      const car = BL.ITEM_BY_ID[carId], [theme, paint] = themes[n], used = {}, id = 'car' + n, list = [];
      const add = (it, painted) => { if (it) list.push(offer(id, it, painted && rnd() < 0.6 ? paint : null)); };
      list.push({ key: 'B' + wk + ':' + id + ':' + carId, id: carId, paint: null, cert: null, price: BL.SHOP_PRICES[car.rarity] });
      add(take(pool('decal', 'rare', 'blackmarket', (i) => i.animated), used));
      add(take(pool('decal', 'uncommon', 'exotic', (i) => !i.animated), used));
      add(take(pool('decal', 'rare', 'blackmarket'), used));
      add(take(pool('wheels', 'uncommon'), used), true);
      add(take(pool('wheeldecal', 'uncommon'), used), true);
      add(take(pool('boost', 'uncommon'), used), true);
      add(take(pool('topper', 'uncommon'), used), true);
      add(take(pool('antenna', 'uncommon'), used), true);
      add(take(pool('explosion', 'rare'), used));
      pages.push({ id, name: car.name.toUpperCase(), kind: 'bundle', title: car.name.toUpperCase() + ': ' + theme.toUpperCase(), car: carId, offers: list, ends });
    });
    // a goal explosion collection, with a boost and a topper to match
    const used = {}, boom = [];
    for (let k = 0; k < 4; k++) { const it = take(pool('explosion', 'import'), used); if (it) boom.push(offer('boom', it)); }
    for (const c of ['boost', 'topper']) { const it = take(pool(c, 'veryrare'), used); if (it) boom.push(offer('boom', it)); }
    pages.push({ id: 'boom', name: 'SHOWSTOPPERS', kind: 'bundle', title: 'SHOWSTOPPERS', car: null, offers: boom, ends });
    pages.push({ id: 'bundles', name: 'BUNDLES', kind: 'bundles', ends });
    pagesFor = day; pagesCache = pages;
    return pages;
  };
  // what a bundle still costs: 55 % off everything in it you don't own yet
  S.bundleDeal = (pg) => { const left = pg.offers.filter((o) => !S.offerOwned(o)); return { left, price: Math.round((left.reduce((a, o) => a + o.price, 0) * 0.45) / 10) * 10 }; };
  S.buyBundle = function (pg) {
    const b = S.bundleDeal(pg);
    if (!b.left.length || S.p.credits < b.price) return null;
    S.p.credits -= b.price;
    const got = b.left.map((o) => { S.p.shopBought[o.key] = 1; return S.addItem(o.id, o.paint, o.cert); });
    S.save();
    return got;
  };

  S.buy = function (offer) {
    if (S.p.credits < offer.price) return null;
    S.p.credits -= offer.price;
    S.p.shopBought[offer.key] = 1;
    return S.addItem(offer.id, offer.paint, offer.cert);
  };

  S.buyDrop = function (rarity, price) {
    if (S.p.credits < price) return null;
    S.p.credits -= price;
    return S.awardDrop(rarity);
  };

  // ---------- Ranks ----------
  S.rankInfo = function (mmr) {
    let tier = 0;
    for (let i = 0; i < BL.RANKS.length; i++) if (mmr >= BL.RANKS[i].min) tier = i;
    const r = BL.RANKS[tier];
    if (tier === BL.RANKS.length - 1) return { name: r.name, full: r.name, color: r.color, tier, div: 0 };
    const next = BL.RANKS[tier + 1].min;
    const span = (next - r.min) / 3;
    const div = Math.min(2, Math.floor((mmr - r.min) / span));
    const roman = ['I', 'II', 'III'][div];
    return { name: r.name, full: r.name + ' ' + roman, color: r.color, tier, div };
  };
  // Competitive rank rewards: the highest rank reached in any Competitive playlist (once its 10 placement matches
  // are done; -1 = unranked) unlocks the avatar borders and season titles up to it. It's kept for the season, so
  // dropping a rank later doesn't take them away.
  S.bestTier = function () {
    const p = S.p;
    let best = p.bestTier == null ? -1 : p.bestTier;
    for (const pl of BL.PLAYLISTS) if (((p.rankedGames || {})[pl.id] || 0) >= 10) best = Math.max(best, S.rankInfo(p.mmr[pl.id] || 0).tier);
    return best;
  };
  // gives you the rank titles you've earned; returns the new ones
  S.rankRewards = function () {
    const p = S.p, best = S.bestTier(), got = [];
    p.bestTier = best;
    for (const it of BL.ITEMS) if (it.cat === 'title' && it.rank != null && it.rank <= best && !S.owns(it.id)) { S.addItem(it.id); got.push(it); }
    return got;
  };
  // bots play like people of your rank: a Gold lobby's bots aerial, boost and flip like Gold players do (js/ai.js turns
  // these on from about 0.55), up to Grand Champion and Supersonic Legend
  const SKILL_AT = [[0, 0.3], [300, 0.45], [500, 0.6], [700, 0.7], [900, 0.8], [1100, 0.88], [1350, 0.95], [1600, 1]];
  S.botSkillForMMR = function (mmr) {
    if (mmr <= SKILL_AT[0][0]) return SKILL_AT[0][1];
    for (let i = 1; i < SKILL_AT.length; i++) if (mmr < SKILL_AT[i][0]) { const a = SKILL_AT[i - 1], b = SKILL_AT[i]; return a[1] + (b[1] - a[1]) * (mmr - a[0]) / (b[0] - a[0]); }
    return 1;
  };

  S.unseenCount = () => S.p.inventory.filter((e) => e.isNew).length;

  // ---------- Unlocks ----------
  S.mapUnlockLevel = (id) => BL.MAP_UNLOCKS[id] || 1;
  S.modeUnlockLevel = (id) => BL.MODE_UNLOCKS[id] || 1;
  S.isMapUnlocked = () => true;
  S.isModeUnlocked = () => true;
  S.owns = (itemId) => S.p.inventory.some((e) => e.id === itemId);

  // ---------- Season Pass ----------
  S.grantReward = function (r) {
    if (!r) return null;
    if (r.type === 'credits') { S.p.credits += r.n; return { kind: 'credits', n: r.n }; }
    if (r.type === 'drop') return { kind: 'drop', drop: S.awardDrop(r.rarity) };
    if (r.type === 'item') return { kind: 'item', entry: S.addItem(r.id, r.paint, null) };
    return null;
  };

  // Rocket Pass tiers reached but not claimed yet
  S.passClaimable = function () {
    const ps = S.p.pass, out = [];
    for (const row of BL.PASS_REWARDS) {
      if (row.tier > ps.tier) break;
      if (row.free && !ps.claimedFree[row.tier]) out.push({ tier: row.tier, track: 'free', reward: row.free });
      if (ps.premium && row.prem && !ps.claimedPrem[row.tier]) out.push({ tier: row.tier, track: 'premium', reward: row.prem });
    }
    return out;
  };
  S.claimPassTier = function (tier, track) {
    const ps = S.p.pass, row = BL.PASS_REWARDS[tier - 1];
    if (!row || tier > ps.tier || (track === 'premium' && !ps.premium)) return null;
    const flags = track === 'premium' ? ps.claimedPrem : ps.claimedFree, rw = track === 'premium' ? row.prem : row.free;
    if (!rw || flags[tier]) return null;
    flags[tier] = 1;
    const g = S.grantReward(rw);
    if (g) { g.tier = tier; g.track = track; }
    S.save();
    return g;
  };
  // claim everything reached but not yet claimed
  S.claimPass = function () {
    const ps = S.p.pass, out = [];
    for (const row of BL.PASS_REWARDS) {
      if (row.tier > ps.tier) break;
      if (row.free && !ps.claimedFree[row.tier]) { ps.claimedFree[row.tier] = 1; const g = S.grantReward(row.free); if (g) { g.tier = row.tier; g.track = 'free'; out.push(g); } }
      if (ps.premium && !ps.claimedPrem[row.tier]) { ps.claimedPrem[row.tier] = 1; const g = S.grantReward(row.prem); if (g) { g.tier = row.tier; g.track = 'premium'; out.push(g); } }
    }
    S.save();
    return out;
  };

  S.addPassXP = function (n) {
    const ps = S.p.pass;
    const before = ps.tier;
    ps.xp += Math.round(n);
    while (ps.tier < BL.PASS.tiers && ps.xp >= BL.PASS.xpPerTier) { ps.xp -= BL.PASS.xpPerTier; ps.tier++; }
    if (ps.tier >= BL.PASS.tiers) ps.xp = Math.min(ps.xp, BL.PASS.xpPerTier);
    S.save();
    // tier rewards wait in the Rocket Pass to be claimed
    return { tiers: ps.tier - before, rewards: [] };
  };

  S.buyPremium = function () {
    const ps = S.p.pass;
    if (ps.premium || S.p.credits < BL.PASS.premiumPrice) return null;
    S.p.credits -= BL.PASS.premiumPrice;
    ps.premium = true;
    S.save();
    return [];
  };

  S.skipTier = function () {
    const ps = S.p.pass;
    if (ps.tier >= BL.PASS.tiers || S.p.credits < BL.PASS.skipPrice) return null;
    S.p.credits -= BL.PASS.skipPrice;
    ps.tier++;
    S.save();
    return [];
  };

  // ---------- Daily challenges ----------
  S.challenges = function () {
    const ch = S.p.challenges;
    const day = U.dayKey();
    if (ch.day !== day) {
      const rnd = U.rng(U.hash('ch' + day));
      const pool = BL.CHALLENGES.slice();
      const list = [];
      for (let i = 0; i < 3 && pool.length; i++) {
        const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        list.push({ id: c.id, progress: 0, done: false });
      }
      S.p.challenges = { day, list };
      S.save();
    }
    return S.p.challenges.list.map((x) => Object.assign({}, BL.CHALLENGES.find((c) => c.id === x.id), x));
  };

  // stats: match stats + {wins, matches}; returns completed challenges
  S.progressChallenges = function (stats) {
    S.challenges();
    const done = [];
    for (const x of S.p.challenges.list) {
      if (x.done) continue;
      const def = BL.CHALLENGES.find((c) => c.id === x.id);
      if (!def) continue;
      x.progress = Math.min(def.goal, x.progress + (stats[def.stat] || 0));
      if (x.progress >= def.goal) { x.done = true; done.push(def); }
    }
    S.save();
    return done;
  };
})(window.BL);
