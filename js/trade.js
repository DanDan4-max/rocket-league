'use strict';
// Rocket League (fan remake) - trading and gifts between friends, peer to peer over the friends connection
// (js/friends.js): both games open, nothing stored online.
//  Trade: ask a friend from the Friends list; once they accept, a trade window opens for both. Each side puts in up
//    to 8 items (anything tradeable: not what you're wearing, not default items, songs or rank rewards) and ticks
//    READY. When both are ready on the same two offers, each game makes the swap at once; changing an offer un-readies
//    both, so nobody can switch an item at the last second.
//  Gift: pick items for a friend; they leave your inventory when the friend accepts. The owner (js/owner.js) can
//    gift any item without having it.
// Everything that comes in is checked: real items and paints only, never a default.
(function (BL) {
  const S = BL.Save, U = BL.util, MAX = 8;
  const T = BL.Trade = { cur: null, asks: [], gifts: [], gift: null, sent: {} };
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
    const next = S.copies(e).find((x) => S.canTrade(x) && c.mine.indexOf(x.uid) < 0);
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
    if (out.some((e) => !e || !S.canTrade(e))) { c.ready = false; push(); M().toast('Something in your offer changed: check it and ready up again'); return; }
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
  T.giftOpen = function (code) { const f = friend(code); if (!f) return; T.gift = { code, name: f.name, picks: [], any: [], tab: 'mine', cat: 'decal' }; show(); };
  T.giftAdd = function (uid) {
    const g = T.gift, e = S.entry(uid);
    if (!g || !e || g.picks.length + g.any.length >= MAX) return;
    const next = S.copies(e).find((x) => S.canTrade(x) && g.picks.indexOf(x.uid) < 0);
    if (next) g.picks.push(next.uid);
    show();
  };
  T.giftAny = function (id) { const g = T.gift; if (!g || !(BL.Owner && BL.Owner.is()) || g.picks.length + g.any.length >= MAX) return; g.any.push({ id, paint: null, cert: null }); show(); };
  T.giftDrop = function (i) { const g = T.gift; if (!g) return; const k = +i; if (k < g.picks.length) g.picks.splice(k, 1); else g.any.splice(k - g.picks.length, 1); show(); };
  T.giftSend = function () {
    const g = T.gift;
    if (!g || !(g.picks.length + g.any.length)) return;
    const id = U.uid(), owner = !!(BL.Owner && BL.Owner.is()), items = g.picks.map((u) => brief(S.entry(u))).concat(owner ? g.any : []);
    T.sent[id] = { uids: g.picks.slice(), to: g.code, name: g.name, at: Date.now() };
    F().send(g.code, { t: 'gift', id, items }, (ok) => { if (!ok) { delete T.sent[id]; M().toast(g.name + ' is offline'); } });
    M().toast('Gift sent to ' + g.name + (g.picks.length ? '. It leaves your inventory when they accept.' : ''));
    T.gift = null; close();
  };
  T.giftAccept = function (id) {
    const g = T.gifts.find((x) => x.id === id);
    T.gifts = T.gifts.filter((x) => x.id !== id);
    if (!g) return;
    for (const x of g.items) S.addItem(x.id, x.paint, x.cert, true);
    S.save();
    F().send(g.code, { t: 'gack', id });
    M().toast('You got ' + g.items.map(nameOf).join(', ') + ' from ' + g.name);
    changed();
  };
  T.giftDecline = function (id) { const g = T.gifts.find((x) => x.id === id); T.gifts = T.gifts.filter((x) => x.id !== id); if (g) F().send(g.code, { t: 'gno', id }); changed(); };

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
      case 'gift': {
        const items = clean(m.items);
        if (!items.length || T.gifts.some((g) => g.id === m.id)) return;
        T.gifts.push({ id: String(m.id).slice(0, 24), code: from.code, name: from.name, items });
        M().toast(from.name + ' sent you a gift (Friends list)'); changed(); return;
      }
      case 'gack': {
        const g = T.sent[m.id];
        if (!g || g.to !== from.code) return;
        delete T.sent[m.id];
        if (g.uids.length) { S.p.inventory = S.p.inventory.filter((e) => g.uids.indexOf(e.uid) < 0 || S.isEquipped(e.uid)); S.save(); }
        M().toast(from.name + ' accepted your gift'); changed(); return;
      }
      case 'gno': if (T.sent[m.id]) { delete T.sent[m.id]; M().toast(from.name + ' turned down your gift'); } return;
      default:
    }
  };

  // ---------- the windows ----------
  const card = (x, o) => X().itemCard(BL.ITEM_BY_ID[x.id], Object.assign({ paint: x.paint, cert: x.cert, showCat: true }, o));
  function myStacks(skip) {
    const list = S.p.inventory.filter((e) => S.canTrade(e) && skip.indexOf(e.uid) < 0);
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
    return `<div class="dlg rl-dlg trade-win"><h2>GIFT TO ${esc(g.name.toUpperCase())}</h2>
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
  T.rowButtons = (f, on) => (on ? btn('TRADE', 'trAsk', f.code, 'fp-mini') + btn('GIFT', 'gfOpen', f.code, 'fp-mini') : '');
  T.notices = () => T.asks.map((a) => `<div class="fp-req"><b>${esc(a.name)}</b><small>wants to trade</small>${btn('TRADE', 'trAccept', a.code, 'hot')}${btn('NO', 'trDecline', a.code)}</div>`).join('')
    + T.gifts.map((g) => `<div class="fp-req"><b>${esc(g.name)}</b><small>gift: ${esc(g.items.map(nameOf).join(', '))}</small>${btn('ACCEPT', 'gfAccept', g.id, 'hot')}${btn('NO', 'gfDecline', g.id)}</div>`).join('');

  const A = () => BL.Menu._x.ACT;
  const hook = () => {
    if (!BL.Menu || !BL.Menu._x) { setTimeout(hook, 50); return; }
    Object.assign(A(), {
      trAsk: (c) => T.ask(c), trAccept: (c) => T.accept(c), trDecline: (c) => T.decline(c), trCancel: () => T.cancel(),
      trAdd: (u) => T.add(u), trDrop: (u) => T.drop(u), trReady: () => T.toggleReady(),
      gfOpen: (c) => T.giftOpen(c), gfAdd: (u) => T.giftAdd(u), gfAny: (id) => T.giftAny(id), gfDrop: (i) => T.giftDrop(i), gfSend: () => T.giftSend(),
      gfCancel: () => { T.gift = null; close(); }, gfTab: (t) => { if (T.gift) { T.gift.tab = t; show(); } }, gfCat: (c) => { if (T.gift) { T.gift.cat = c; show(); } },
      gfAccept: (id) => T.giftAccept(id), gfDecline: (id) => T.giftDecline(id),
    });
  };
  hook();
  // forget unanswered requests and gifts after a while
  setInterval(() => { const t = Date.now(); T.asks = T.asks.filter((a) => t - a.at < 180000); for (const k of Object.keys(T.sent)) if (t - T.sent[k].at > 600000) delete T.sent[k]; }, 30000);
})(window.BL);
