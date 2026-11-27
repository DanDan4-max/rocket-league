'use strict';
// Rocket League (fan remake) - trading and gifts between friends, peer to peer over the friends connection
// (js/friends.js): both games open, nothing stored online.
//  Trade: ask a friend from the Friends list; once they accept, a trade window opens for both. Each side puts in up
//    to 8 items (anything tradeable: not what you're wearing, not default items, songs or rank rewards) and ticks
//    READY. When both are ready on the same two offers, each game makes the swap at once; changing an offer un-readies
//    both, so nobody can switch an item at the last second.
//  Gift: pick items for a friend (online or not); they leave your inventory at once and are theirs when they accept
//    (turned down or called off, they come back). The owner (js/owner.js) can gift any item without having it.
// Everything that comes in is checked: real items and paints only, never a default.
(function (BL) {
  const S = BL.Save, U = BL.util, MAX = 8;
  const T = BL.Trade = { cur: null, asks: [], gift: null };
  const M = () => BL.Menu, F = () => BL.Friends, X = () => BL.Menu._x;
  const esc = U.esc;
  const btn = (label, act, arg, cls) => `<button class="rl-btn ${cls || ''}" data-act="${act}" data-arg="${esc(arg == null ? '' : String(arg))}">${label}</button>`;
  const brief = (e) => ({ id: e.id, paint: e.paint || null, cert: e.cert || null });
  const clean = (list) => (Array.isArray(list) ? list : []).slice(0, MAX).map((x) => {
    const d = x && BL.ITEM_BY_ID[x.id];
    if (!d || d.def) return null;
    return { id: d.id, paint: x.paint && BL.PAINT_BY_ID[x.paint] ? x.paint : null, cert: x.cert && BL.CERT_BY_ID[x.cert] ? x.cert : null };
  }).filter(Boolean);
  const nameOf = (x) => { const d = BL.ITEM_BY_ID[x.id]; return (x.paint ? BL.PAINT_BY_ID[x.paint].name + ' ' : '') + (d ? d.name : x.id); };
  const friend = (code) => (S.p.friends || []).find((f) => f.code === code);
  const changed = () => { if (BL.bus) BL.bus.emit('friends'); };
  const mineBrief = () => T.cur.mine.map((u) => S.entry(u)).filter(Boolean).map(brief);
  const sig = (a, b) => JSON.stringify([a, b]);
  function push() {
    const c = T.cur;
    if (!c || c.state !== 'open') return;
    const mine = mineBrief();
    F().send(c.code, { t: 'tro', items: mine, ready: c.ready, sig: sig(mine, c.theirs) });
  }

  // ---------- trades ----------
  T.ask = function (code) {
    const f = friend(code);
    if (!f) return;
    if (T.cur) { M().toast('Finish your trade with ' + T.cur.name + ' first'); return; }
    T.cur = { code, name: f.name, state: 'asking', mine: [], theirs: [], ready: false, theirReady: false };
    F().send(code, { t: 'trq' }, (ok) => { if (!ok && T.cur && T.cur.code === code) { T.cur = null; M().toast(f.name + ' is offline'); close(); } });
    show();
  };
  T.accept = function (code) {
    const a = T.asks.find((x) => x.code === code);
    T.asks = T.asks.filter((x) => x.code !== code);
    if (!a) return;
    if (T.cur) { M().toast('Finish your current trade first'); return; }
    T.cur = { code, name: a.name, state: 'open', mine: [], theirs: [], ready: false, theirReady: false };
    F().send(code, { t: 'tra' });
    changed(); show();
  };
  T.decline = function (code) { T.asks = T.asks.filter((x) => x.code !== code); F().send(code, { t: 'trd' }); changed(); };
  T.cancel = function () { const c = T.cur; if (!c) return; T.cur = null; F().send(c.code, { t: 'trx' }); close(); };
  const unready = () => { T.cur.ready = false; T.cur.theirReady = false; };
  T.add = function (uid) {
    const c = T.cur, e = S.entry(uid);
    if (!c || c.state !== 'open' || !e) return;
    if (c.mine.length >= MAX) { M().toast('Up to ' + MAX + ' items'); return; }
    const next = S.copies(e).find((x) => S.canGift(x) && c.mine.indexOf(x.uid) < 0);
    if (!next) return;
    c.mine.push(next.uid); unready(); push(); show();
  };
  T.drop = function (uid) { const c = T.cur; if (!c) return; c.mine = c.mine.filter((u) => u !== uid); unready(); push(); show(); };
  T.toggleReady = function () { const c = T.cur; if (!c || c.state !== 'open') return; c.ready = !c.ready; push(); finish(); show(); };
  // both ready on the same two offers: this side makes its half of the swap (the other side does the same)
  function finish() {
    const c = T.cur;
    if (!c || c.done || !c.ready || !c.theirReady) return;
    const out = c.mine.map(S.entry);
    if (out.some((e) => !e || !S.canGift(e))) { c.ready = false; push(); M().toast('Something in your offer changed: check it and ready up again'); return; }
    c.done = true;
    S.p.inventory = S.p.inventory.filter((e) => c.mine.indexOf(e.uid) < 0);
    for (const x of c.theirs) S.addItem(x.id, x.paint, x.cert, true);
    S.save();
    T.last = { name: c.name, gave: out.map(brief), got: c.theirs.slice() };
    F().send(c.code, { t: 'trf', sig: sig(out.map(brief), c.theirs) });
    T.cur = null;
    M().toast('Trade complete with ' + c.name + (c.theirs.length ? ': you got ' + c.theirs.map(nameOf).join(', ') : ''));
    close(); changed();
  }

  // ---------- gifts ----------
  // (2026-11-23, "fix gifting": a gift used to leave your inventory only when the friend's "accepted" note came back,
  // so a lost note or a late accept left you both with it; waiting gifts lived in memory and went with a restart; and
  // you could only gift a friend who was online right then.) Now:
  //  - what you give leaves your inventory the moment you send it, and is kept with the gift (S.p.giftsOut) until the
  //    friend takes it; turned down or called off, it comes back
  //  - a gift to a friend who's offline waits and goes by itself the next time you're both online
  //  - gifts you've been sent are saved (S.p.giftsIn) until you take them or turn them down, and your answer is
  //    remembered (S.p.giftDone), so a gift that arrives twice is only taken once and a sender who missed your answer
  //    gets it again when they ask
  //  - Limited items can be gifted (and traded) too
  const outs = () => (S.p.giftsOut = S.p.giftsOut || []), ins = () => (S.p.giftsIn = S.p.giftsIn || []);
  const done = () => (S.p.giftDone = S.p.giftDone || []);
  const answer = (id) => { const d = done().find((x) => x[0] === id); return d ? d[1] : null; };
  const remember = (id, a) => { const d = done(); d.push([id, a]); if (d.length > 80) d.splice(0, d.length - 80); };
  Object.defineProperty(T, 'gifts', { get: () => (S.p ? ins() : []) });
  T.giftsOut = () => (S.p ? outs() : []);
  T.giftOpen = function (code) { const f = friend(code); if (!f) return; T.gift = { code, name: f.name, picks: [], any: [], tab: 'mine', cat: 'decal' }; show(); };
  T.giftAdd = function (uid) {
    const g = T.gift, e = S.entry(uid);
    if (!g || !e || g.picks.length + g.any.length >= MAX) return;
    const next = S.copies(e).find((x) => S.canGift(x) && g.picks.indexOf(x.uid) < 0);
    if (next) g.picks.push(next.uid);
    show();
  };
  T.giftAny = function (id) { const g = T.gift; if (!g || !(BL.Owner && BL.Owner.is()) || g.picks.length + g.any.length >= MAX || !BL.ITEM_BY_ID[id]) return; g.any.push({ id, paint: null, cert: null }); show(); };
  T.giftDrop = function (i) { const g = T.gift; if (!g) return; const k = +i; if (k < g.picks.length) g.picks.splice(k, 1); else g.any.splice(k - g.picks.length, 1); show(); };
  // one try at handing a gift over (it's 'sent' once the friend's game has it)
  const trying = new Set(); // (gifts on their way this moment: not saved, so a restart never leaves one stuck)
  function deliver(o, loud) {
    if (!F() || trying.has(o.id)) return;
    trying.add(o.id);
    F().send(o.to, { t: 'gift', id: o.id, items: o.items }, (ok) => {
      trying.delete(o.id);
      if (!outs().includes(o)) return;
      if (ok) { if (o.state !== 'sent') { o.state = 'sent'; S.save(); changed(); } if (loud) M().toast('Gift sent to ' + o.name + ': it\'s theirs when they accept'); }
      else if (loud) M().toast(o.name + " is offline: the gift waits and goes the next time you're both online");
    });
  }
  T.giftSend = function () {
    const g = T.gift;
    if (!g) return;
    const owner = !!(BL.Owner && BL.Owner.is());
    // (anything that can't go any more, say it was equipped meanwhile, is left out)
    const entries = g.picks.map((u) => S.entry(u)).filter((e) => e && S.canGift(e));
    const items = entries.map(brief).concat(owner ? g.any : []);
    if (!items.length) { M().toast('Pick something to give first'); return; }
    const uids = entries.map((e) => e.uid);
    S.p.inventory = S.p.inventory.filter((e) => uids.indexOf(e.uid) < 0);
    const o = { id: U.uid(), to: g.code, name: g.name, items, back: entries.map(brief), at: Date.now(), state: 'waiting' };
    outs().push(o);
    S.save();
    T.gift = null; close();
    deliver(o, true);
  };
  // the friend took it / turned it down (or it was called off)
  function settled(o, took) {
    const L = outs(), i = L.indexOf(o);
    if (i < 0) return;
    L.splice(i, 1);
    if (!took) for (const x of o.back || []) S.addItem(x.id, x.paint, x.cert, true);
    S.save(); changed();
  }
  // call a gift off: one that hasn't reached them comes straight back; one they have is asked back (it comes back
  // unless they've already taken it)
  T.giftCancel = function (id) {
    const o = outs().find((x) => x.id === id);
    if (!o) return;
    if (o.state !== 'sent') { settled(o, false); M().toast('Gift called off: it\'s back in your inventory'); return; }
    o.cancel = true; S.save();
    F().send(o.to, { t: 'gcan', id: o.id }, (ok) => { if (!ok) M().toast(o.name + " is offline: the gift comes back once they're online (unless they've taken it)"); });
    changed();
  };
  T.giftAccept = function (id) {
    const L = ins(), i = L.findIndex((x) => x.id === id);
    if (i < 0) return;
    const g = L.splice(i, 1)[0];
    if (answer(id) !== 'ok') { for (const x of g.items) S.addItem(x.id, x.paint, x.cert, true); remember(id, 'ok'); }
    S.save();
    F().send(g.code, { t: 'gack', id });
    M().toast('You got ' + g.items.map(nameOf).join(', ') + ' from ' + g.name);
    changed();
  };
  T.giftDecline = function (id) {
    const L = ins(), i = L.findIndex((x) => x.id === id);
    if (i < 0) return;
    const g = L.splice(i, 1)[0];
    remember(id, 'no'); S.save();
    F().send(g.code, { t: 'gno', id });
    changed();
  };
  // a friend came online (or answered a ping): their waiting gifts go now, and the ones they have are checked on
  T.online = function (code) {
    if (!S.p) return;
    for (const o of outs()) {
      if (o.to !== code) continue;
      if (o.state !== 'sent') deliver(o, false);
      else F().send(code, { t: o.cancel ? 'gcan' : 'gq', id: o.id });
    }
  };
  // receiving side of a gift (from T.onMessage)
  function giftIn(m, from) {
    const id = String(m.id || '').slice(0, 24), items = clean(m.items);
    if (!id || !items.length) return;
    const a = answer(id);
    if (a) { F().send(from.code, { t: a === 'ok' ? 'gack' : 'gno', id }); return; } // (answered already: say so again)
    if (ins().some((g) => g.id === id)) return;
    ins().push({ id, code: from.code, name: from.name, items, at: Date.now() });
    S.save();
    M().toast(from.name + ' sent you a gift: open Friends to take it'); changed();
  }

  // ---------- messages from friends (js/friends.js passes these on) ----------
  T.onMessage = function (m, isFriend) {
    const from = m.from, c = T.cur, here = c && c.code === from.code;
    if (!isFriend) return;
    switch (m.t) {
      case 'trq':
        if (T.cur) { F().send(from.code, { t: 'trd', busy: true }); return; }
        T.asks = T.asks.filter((a) => a.code !== from.code).concat([{ code: from.code, name: from.name, at: Date.now() }]);
        M().toast(from.name + ' wants to trade (Friends list)'); changed(); return;
      case 'tra': if (here && c.state === 'asking') { c.state = 'open'; show(); } return;
      case 'trd': if (here && c.state === 'asking') { T.cur = null; M().toast(from.name + (m.busy ? ' is in another trade' : ' declined the trade')); close(); } return;
      case 'trx': if (here) { T.cur = null; M().toast(from.name + ' cancelled the trade'); close(); } return;
      case 'tro': {
        if (!here || c.state !== 'open') return;
        const items = clean(m.items), was = JSON.stringify(c.theirs);
        c.theirs = items;
        if (JSON.stringify(items) !== was) c.ready = false;
        c.theirReady = !!m.ready && m.sig === sig(items, mineBrief());
        finish(); show(); return;
      }
      case 'trf': {
        // their half is done: this side finishes too, if it was ready on the same offers
        if (!here || c.state !== 'open') return;
        if (c.ready && m.sig === sig(c.theirs, mineBrief())) { c.theirReady = true; finish(); }
        return;
      }
      case 'gift': giftIn(m, from); return;
      case 'gack': case 'gno': {
        const o = outs().find((x) => x.id === m.id && x.to === from.code);
        if (!o) return;
        settled(o, m.t === 'gack');
        M().toast(m.t === 'gack' ? from.name + ' accepted your gift' : o.cancel ? 'Gift called off: it\'s back in your inventory' : from.name + ' turned down your gift: it\'s back in your inventory');
        return;
      }
      // the sender asks how a gift stands (they missed the answer), or calls it off
      case 'gq': { const a = answer(String(m.id)); if (a) F().send(from.code, { t: a === 'ok' ? 'gack' : 'gno', id: m.id }); return; }
      case 'gcan': {
        const id = String(m.id), L = ins(), i = L.findIndex((x) => x.id === id && x.code === from.code);
        if (i >= 0) { L.splice(i, 1); remember(id, 'no'); S.save(); changed(); F().send(from.code, { t: 'gno', id }); return; }
        const a = answer(id); if (a) F().send(from.code, { t: a === 'ok' ? 'gack' : 'gno', id });
        return;
      }
      default:
    }
  };

  // ---------- the windows ----------
  const card = (x, o) => X().itemCard(BL.ITEM_BY_ID[x.id], Object.assign({ paint: x.paint, cert: x.cert, showCat: true }, o));
  function myStacks(skip) {
    const list = S.p.inventory.filter((e) => S.canGift(e) && skip.indexOf(e.uid) < 0);
    return S.stacks(list).sort((a, b) => BL.RARITY_ORDER.indexOf(BL.ITEM_BY_ID[b.top.id].rarity) - BL.RARITY_ORDER.indexOf(BL.ITEM_BY_ID[a.top.id].rarity));
  }
  function tradeHtml() {
    const c = T.cur;
    if (c.state === 'asking') return `<div class="dlg rl-dlg trade-win"><h2>TRADE</h2><p>Waiting for <b>${esc(c.name)}</b> to accept...</p><div class="row end">${btn('CANCEL', 'trCancel')}</div></div>`;
    const mine = c.mine.map(S.entry).filter(Boolean), inv = myStacks(c.mine);
    return `<div class="dlg rl-dlg trade-win"><h2>TRADE WITH ${esc(c.name.toUpperCase())}</h2>
      <div class="tw-cols">
        <div class="tw-side ${c.ready ? 'ready' : ''}"><h4>YOUR OFFER <small>${mine.length}/${MAX}</small></h4><div class="tw-items">${mine.map((e) => card(e, { act: 'trDrop', arg: e.uid })).join('') || '<p class="muted small">Click your items below to add them.</p>'}</div><b class="tw-flag">${c.ready ? 'READY' : 'NOT READY'}</b></div>
        <div class="tw-side ${c.theirReady ? 'ready' : ''}"><h4>${esc(c.name.toUpperCase())}'S OFFER <small>${c.theirs.length}/${MAX}</small></h4><div class="tw-items">${c.theirs.map((x) => card(x, {})).join('') || '<p class="muted small">Nothing yet.</p>'}</div><b class="tw-flag">${c.theirReady ? 'READY' : 'NOT READY'}</b></div>
      </div>
      <h4>YOUR ITEMS <small class="muted">(equipped, default items and songs can't be traded)</small></h4>
      <div class="grid tw-inv">${inv.map((st) => card(st.top, { act: 'trAdd', arg: st.top.uid, qty: st.entries.length })).join('') || '<p class="muted">Nothing tradeable.</p>'}</div>
      <div class="row end">${btn(c.ready ? 'NOT READY' : 'READY', 'trReady', '', 'hot')}${btn('CANCEL TRADE', 'trCancel')}</div>
      <p class="muted small">When you both say READY the swap happens. Changing an offer takes both of you off READY.</p></div>`;
  }
  function giftHtml() {
    const g = T.gift, owner = !!(BL.Owner && BL.Owner.is());
    const picked = g.picks.map(S.entry).filter(Boolean).map(brief).concat(g.any);
    let grid;
    if (g.tab === 'any' && owner) {
      const cats = BL.CATEGORIES.map((c) => `<button class="gtab ${g.cat === c.id ? 'on' : ''}" data-act="gfCat" data-arg="${c.id}">${esc(c.name)}</button>`).join('');
      grid = `<div class="gtabs">${cats}</div><div class="grid tw-inv">${BL.ITEMS.filter((i) => i.cat === g.cat && !i.def).map((d) => X().itemCard(d, { act: 'gfAny', arg: d.id })).join('')}</div>`;
    } else grid = `<div class="grid tw-inv">${myStacks(g.picks).map((st) => card(st.top, { act: 'gfAdd', arg: st.top.uid, qty: st.entries.length })).join('') || '<p class="muted">Nothing you can give.</p>'}</div>`;
    const off = !(F() && F().isOnline && F().isOnline(g.code));
    return `<div class="dlg rl-dlg trade-win"><h2>GIFT TO ${esc(g.name.toUpperCase())}</h2>
      <p class="muted small">${off ? esc(g.name) + " is offline: the gift waits and goes by itself the next time you're both online. " : ''}What you give leaves your inventory now, and comes back if ${esc(g.name)} turns it down.</p>
      <div class="tw-side"><h4>YOUR GIFT <small>${picked.length}/${MAX}</small></h4><div class="tw-items">${picked.map((x, i) => card(x, { act: 'gfDrop', arg: i })).join('') || '<p class="muted small">Pick what to give.</p>'}</div></div>
      ${owner ? `<div class="gtabs">${btn('YOUR ITEMS', 'gfTab', 'mine', g.tab === 'mine' ? 'hot' : '')}${btn('ANY ITEM (OWNER)', 'gfTab', 'any', g.tab === 'any' ? 'hot' : '')}</div>` : ''}
      ${grid}
      <div class="row end">${btn('SEND GIFT', 'gfSend', '', 'hot')}${btn('CANCEL', 'gfCancel')}</div></div>`;
  }
  function show() {
    if (T.cur) M().openOverlay(tradeHtml(), 'trade-ov');
    else if (T.gift) M().openOverlay(giftHtml(), 'trade-ov');
  }
  function close() { if (document.querySelector('.trade-win')) M().closeOverlay(); T.gift = null; changed(); }
  T.show = show;

  // friends-list rows and notifications (js/rlmenu.js friendsPanel)
  T.rowButtons = (f, on) => (on ? btn('TRADE', 'trAsk', f.code, 'fp-mini') : '') + btn('GIFT', 'gfOpen', f.code, 'fp-mini');
  // (incoming trade asks and gifts, and the gifts you've sent that haven't been taken yet)
  T.count = () => T.asks.length + T.gifts.length + T.giftsOut().length;
  T.notices = () => T.asks.map((a) => `<div class="fp-req"><b>${esc(a.name)}</b><small>wants to trade</small>${btn('TRADE', 'trAccept', a.code, 'hot')}${btn('NO', 'trDecline', a.code)}</div>`).join('')
    + T.gifts.map((g) => `<div class="fp-req"><b>${esc(g.name)}</b><small>gift: ${esc(g.items.map(nameOf).join(', '))}</small>${btn('ACCEPT', 'gfAccept', g.id, 'hot')}${btn('NO', 'gfDecline', g.id)}</div>`).join('')
    + T.giftsOut().map((o) => `<div class="fp-req"><b>To ${esc(o.name)}</b><small>${esc(o.items.map(nameOf).join(', '))} &bull; ${o.cancel ? 'calling it off' : o.state === 'sent' ? 'waiting for them to accept' : "goes when they're online"}</small>${o.cancel ? '' : btn('CALL OFF', 'gfCancelOut', o.id)}</div>`).join('');

  const A = () => BL.Menu._x.ACT;
  const hook = () => {
    if (!BL.Menu || !BL.Menu._x) { setTimeout(hook, 50); return; }
    Object.assign(A(), {
      trAsk: (c) => T.ask(c), trAccept: (c) => T.accept(c), trDecline: (c) => T.decline(c), trCancel: () => T.cancel(),
      trAdd: (u) => T.add(u), trDrop: (u) => T.drop(u), trReady: () => T.toggleReady(),
      gfOpen: (c) => T.giftOpen(c), gfAdd: (u) => T.giftAdd(u), gfAny: (id) => T.giftAny(id), gfDrop: (i) => T.giftDrop(i), gfSend: () => T.giftSend(),
      gfCancel: () => { T.gift = null; close(); }, gfTab: (t) => { if (T.gift) { T.gift.tab = t; show(); } }, gfCat: (c) => { if (T.gift) { T.gift.cat = c; show(); } },
      gfAccept: (id) => T.giftAccept(id), gfDecline: (id) => T.giftDecline(id), gfCancelOut: (id) => T.giftCancel(id),
    });
  };
  hook();
  // forget unanswered requests and gifts after a while
  // (and every half minute: waiting gifts try again for friends who are online)
  setInterval(() => {
    const t = Date.now(); T.asks = T.asks.filter((a) => t - a.at < 180000);
    if (S.p && F() && F().isOnline) for (const code of new Set(T.giftsOut().map((o) => o.to))) if (F().isOnline(code)) T.online(code);
  }, 30000);
})(window.BL);
