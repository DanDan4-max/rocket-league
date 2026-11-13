'use strict';
// Rocket League (fan remake) - in-match HUD (DOM overlay)
(function (BL) {
  const U = BL.util;
  const H = BL.HUD = {};
  let root = null, els = {}, game = null;
  let bigTimer = 0, qcGroup = -1, qcTimer = 0;

  H.init = function () {
    root = document.getElementById('hud');
    root.innerHTML = `
      <div class="sb">
        <div class="sb-team sb-blue"><div class="sb-names" id="hNamesB"></div><div class="sb-score" id="hScoreB">0</div></div>
        <div class="sb-mid"><div class="sb-clock" id="hClock">5:00</div><div class="sb-sub" id="hSub"></div></div>
        <div class="sb-team sb-orange"><div class="sb-score" id="hScoreO">0</div><div class="sb-names" id="hNamesO"></div></div>
      </div>
      <div class="h-feed" id="hFeed"></div>
      <div class="h-chat" id="hChat"></div>
      <div class="h-ping hidden" id="hPing"></div>
      <div class="h-qc hidden" id="hQC"></div>
      <div class="h-big hidden" id="hBig"><div class="h-big-t" id="hBigT"></div><div class="h-big-s" id="hBigS"></div></div>
      <div class="h-pops" id="hPops"></div>
      <div class="h-boost" id="hBoost">
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" class="hb-bg"/>
          <circle cx="60" cy="60" r="50" class="hb-fill" id="hBoostArc"/>
          <g class="hb-ticks"><line x1="60" y1="4" x2="60" y2="17" transform="rotate(0 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(18 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(36 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(54 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(72 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(90 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(108 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(126 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(144 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(162 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(180 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(198 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(216 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(234 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(252 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(270 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(288 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(306 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(324 60 60)"/><line x1="60" y1="4" x2="60" y2="17" transform="rotate(342 60 60)"/></g>
          <circle cx="60" cy="60" r="57.5" class="hb-ring"/><circle cx="60" cy="60" r="42.5" class="hb-ring"/>
        </svg>
        <div class="hb-num" id="hBoostNum">33</div><div class="hb-lbl">BOOST</div>
      </div>
      <div class="h-item hidden" id="hItem"><div class="hi-icon" id="hItemIcon"></div><div class="hi-name" id="hItemName"></div><div class="hi-key">R / F / RB</div></div>
      <div class="h-spec hidden" id="hSpec"></div>
      <div class="h-replay hidden" id="hReplay"><span class="rec"></span>REPLAY<small>press JUMP to skip</small></div>
      <div class="h-scoreboard hidden" id="hBoard"></div>
      <div class="h-hint" id="hHint"></div>
      <div class="h-cam" id="hCam">BALL CAM</div>
      <div class="h-help hidden" id="hHelp"></div>`;
    for (const id of ['hScoreB', 'hScoreO', 'hClock', 'hSub', 'hFeed', 'hChat', 'hQC', 'hBig', 'hBigT', 'hBigS', 'hPops', 'hBoost', 'hBoostArc', 'hBoostNum', 'hItem', 'hItemIcon', 'hItemName', 'hPing', 'hSpec', 'hReplay', 'hBoard', 'hNamesB', 'hNamesO', 'hHint', 'hCam', 'hHelp']) els[id] = document.getElementById(id);
    const C = 2 * Math.PI * 50;
    els.hBoostArc.style.strokeDasharray = C + ' ' + C;
    els.C = C;
  };

  H.show = function (g) {
    game = g;
    root.classList.remove('hidden');
    els.hFeed.innerHTML = ''; els.hChat.innerHTML = ''; els.hPops.innerHTML = '';
    H.big(null);
    H.replay(false);
    H.spectate(null);
    H.scoreboard(false);
    H.names();
    els.hHint.textContent = g.mode === 'freeplay' ? 'FREE PLAY • ' + kn('reset') + ': reset ball • ' + kn('ballToMe') + ': ball to you • ' + kn('ballcam') + ': ball cam • ' + kn('pause') + ': menu' : '';
    if (!H.helpShown) {
      H.helpShown = true;
      const I = BL.Input;
      const pad = I.usingGamepad;
      const k = (a) => pad ? I.padName(I.PAD[a]) : kn(a);
      els.hHelp.innerHTML = '<b>CONTROLS</b>' +
        (pad ? '<div>Drive: RT / LT • Steer: left stick</div>' : '<div>Drive: ' + kn('forward') + '/' + kn('back') + ' • Steer: ' + kn('left') + '/' + kn('right') + '</div>') +
        '<div>Jump: ' + k('jump') + ' (press again + direction to flip)</div><div>Boost: ' + k('boost') + (pad ? '' : ' or left mouse') + '</div>' +
        '<div>Powerslide / free air roll: hold ' + k('slide') + '</div><div>Air roll (no powerslide): hold ' + k('airroll') + '</div><div>Air roll left / right: ' + k('rollLeft') + ' / ' + k('rollRight') + '</div>' +
        '<div>Ball cam: ' + k('ballcam') + ' • Scoreboard: ' + k('scoreboard') + '</div><div>Quick chat: ' + k('chat1') + '-' + k('chat4') + ' • Menu: ' + k('pause') + '</div>';
      els.hHelp.classList.remove('hidden', 'out');
      setTimeout(() => els.hHelp.classList.add('out'), 9000);
      setTimeout(() => els.hHelp.classList.add('hidden'), 9700);
    }
  };
  function kn(a) { const c = BL.Input.KEYS[a]; return c && c.length ? BL.Input.keyName(c[0]) : '—'; }
  H.hide = function () { if (root) root.classList.add('hidden'); game = null; };

  H.names = function () {
    if (!game) return;
    const list = (t) => game.cars.filter((c) => c.team === t).map((c) => `<span class="${c.isLocal ? 'me' : ''}">${U.tagHtml(c)}${U.esc(c.name)}</span>`).join('');
    els.hNamesB.innerHTML = list(0);
    els.hNamesO.innerHTML = list(1);
  };

  let lastBoost = -1, lastClock = '';
  H.update = function (g, dt) {
    els.hScoreB.textContent = g.score[0];
    els.hScoreO.textContent = g.score[1];
    const clock = g.goalsToWin ? 'FIRST TO ' + g.goalsToWin : g.matchLength <= 0 ? '∞' : (g.overtime ? '+' : '') + U.fmtClock(g.clock, g.overtime);
    if (clock !== lastClock) { els.hClock.textContent = clock; lastClock = clock; }
    const duel = g.cfg && g.cfg.ctx && g.cfg.ctx.kind === 'duel';
    els.hSub.textContent = g.overtime ? 'OVERTIME' : (duel ? 'HONOR DUEL' + (g.mode !== 'soccar' ? ' • ' + BL.MODES[g.mode].name.toUpperCase() : '') : g.mode !== 'soccar' && g.mode !== 'freeplay' ? BL.MODES[g.mode].name.toUpperCase() : '');
    const car = g.local;
    const b = car ? Math.round(g.env.unlimitedBoost ? 100 : car.boost) : 0;
    if (b !== lastBoost) {
      lastBoost = b;
      els.hBoostNum.textContent = g.env.unlimitedBoost ? '∞' : b;
      els.hBoostArc.style.strokeDashoffset = els.C * (1 - b / 100);
      els.hBoost.classList.toggle('full', b >= 100);
      els.hBoost.classList.toggle('empty', b <= 0);
    }
    if (bigTimer > 0) { bigTimer -= dt; if (bigTimer <= 0) H.big(null); }
    if (g.ballCam !== H._cam) { H._cam = g.ballCam; els.hCam.classList.toggle('on', !!g.ballCam); els.hCam.textContent = g.ballCam ? 'BALL CAM' : 'CAR CAM'; }
    if (qcTimer > 0) { qcTimer -= dt; if (qcTimer <= 0) H.quickChat(-1); }
    // online: your ping (green / yellow / red) and a warning when the host goes quiet
    if (g.online && els.hPing) {
      H._pingT = (H._pingT || 0) - dt;
      if (H._pingT <= 0) {
        H._pingT = 0.5;
        const N = BL.Net, ms = Math.round((N.rtt || 0) * 1000), stale = g.isClient && g.phase !== 'replay' && g.phase !== 'ended' && g.lastSnapAt && performance.now() - g.lastSnapAt > 1500; // (the host sends nothing during those two)
        els.hPing.classList.remove('hidden');
        els.hPing.className = 'h-ping ' + (stale ? 'bad' : g.isHost ? 'good' : ms < 70 ? 'good' : ms < 140 ? 'ok' : 'bad');
        els.hPing.textContent = stale ? 'CONNECTION LOST - RECONNECTING' : g.isHost ? 'HOST' : 'PING ' + ms + ' ms' + ((N.jit || 0) > 0.03 ? ' ~' : '') + (N.relay ? ' (RELAY)' : '');
      }
    } else if (els.hPing) els.hPing.classList.add('hidden');
    if (car && g.mode === 'rumble') {
      els.hItem.classList.remove('hidden');
      const it = car.item ? BL.RUMBLE_ITEMS.find((i) => i.id === car.item) : null;
      const ik = it ? it.id : 'wait';
      if (H._itemKey !== ik) { H._itemKey = ik; els.hItemIcon.innerHTML = it && BL.RUMBLE_ICON[it.id] ? `<img src="${BL.RUMBLE_ICON[it.id]}" alt="">` : BL.ICON('timer', 30); }
      els.hItemName.textContent = it ? it.name : 'Next item ' + Math.ceil(Math.max(0, car.itemTimer)) + 's';
      els.hItem.classList.toggle('ready', !!it);
    } else els.hItem.classList.add('hidden');
  };

  H.big = function (text, sub, color, dur) {
    if (!text) { els.hBig.classList.add('hidden'); bigTimer = 0; return; }
    els.hBigT.textContent = text;
    els.hBigS.textContent = sub || '';
    els.hBigT.style.color = color || '#fff';
    els.hBig.classList.remove('hidden');
    els.hBig.classList.remove('pop'); void els.hBig.offsetWidth; els.hBig.classList.add('pop');
    bigTimer = dur || 2;
  };

  H.popup = function (text, pts, color) {
    const fade = (el) => {
      clearTimeout(el._t1); clearTimeout(el._t2);
      el._t1 = setTimeout(() => el.classList.add('out'), 2200);
      el._t2 = setTimeout(() => el.remove(), 2700);
    };
    // the same message again while it's still showing counts up instead of stacking copies
    const last = els.hPops.lastElementChild;
    if (last && last.dataset.text === text && !last.classList.contains('out')) {
      const n = (+last.dataset.n || 1) + 1, total = (+last.dataset.pts || 0) + (pts || 0);
      last.dataset.n = n; last.dataset.pts = total;
      last.querySelector('b').textContent = text + ' x' + n;
      const sp = last.querySelector('span');
      if (sp) sp.textContent = '+' + total;
      fade(last);
      return;
    }
    const ic = BL.ICON_FOR[text] || (BL.RUMBLE_ITEMS.some((i) => i.name === text) ? 'item' : 'touch');
    const el = U.h(`<div class="h-pop pop-${ic}"><i class="pop-ic">${BL.ICON(ic, 26)}</i><b>${U.esc(text)}</b>${pts ? `<span>+${pts}</span>` : ''}</div>`);
    el.dataset.text = text; el.dataset.pts = pts || 0;
    if (color) el.style.borderColor = color;
    els.hPops.appendChild(el);
    fade(el);
    while (els.hPops.children.length > 4) els.hPops.firstChild.remove();
  };

  H.feed = function (html) {
    const el = U.h(`<div class="h-feed-i">${html}</div>`);
    els.hFeed.appendChild(el);
    setTimeout(() => el.classList.add('out'), 5000);
    setTimeout(() => el.remove(), 5600);
    while (els.hFeed.children.length > 5) els.hFeed.firstChild.remove();
  };

  H.chat = function (name, team, msg) {
    const el = U.h(`<div class="h-chat-i"><b style="color:${BL.TEAM_MAIN[team]}">${U.esc(name)}:</b> ${U.esc(msg)}</div>`);
    els.hChat.appendChild(el);
    setTimeout(() => el.classList.add('out'), 6000);
    setTimeout(() => el.remove(), 6600);
    while (els.hChat.children.length > 6) els.hChat.firstChild.remove();
    BL.Audio.play('chat', 0.7);
  };

  // typed chat (T): a box over the chat feed; Enter sends, Esc closes
  H.openChat = function (send) {
    if (document.getElementById('hChatIn')) return;
    const box = U.h('<div class="h-chatbox"><span>ALL</span><input id="hChatIn" maxlength="60" autocomplete="off" placeholder="Type a message (Enter to send, Esc to close)"></div>');
    els.hChat.parentNode.appendChild(box);
    const inp = box.querySelector('input');
    const close = () => { box.remove(); };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = inp.value.trim(); close(); if (v) send(v); }
      else if (e.key === 'Escape') close();
    });
    inp.addEventListener('blur', () => setTimeout(close, 50));
    setTimeout(() => inp.focus(), 0);
  };

  // set: { groups, lines } (the in-match set by default, BL.QUICKCHAT_POST after the match); the open menu is also
  // drawn on the results screen (#pvQC), which covers the HUD
  let qcSet = null;
  H.quickChat = function (group, set) {
    qcGroup = group;
    const pv = document.getElementById('pvQC');
    if (group < 0) { els.hQC.classList.add('hidden'); if (pv) pv.innerHTML = ''; return -1; }
    qcSet = set || { groups: BL.QUICKCHAT_GROUPS, lines: BL.quickChats() };
    qcTimer = 3;
    els.hQC.innerHTML = `<div class="qc-h">${qcSet.groups[group]}</div>` + qcSet.lines[group].map((m, i) => `<div><kbd>${i + 1}</kbd> ${U.esc(m)}</div>`).join('');
    els.hQC.classList.remove('hidden');
    if (pv) pv.innerHTML = els.hQC.innerHTML;
    return group;
  };
  H.quickChatGroup = () => qcGroup;
  H.quickChatLine = (g, i) => qcSet && qcSet.lines[g] && qcSet.lines[g][i];

  H.spectate = function (text) {
    if (!text) { els.hSpec.classList.add('hidden'); return; }
    els.hSpec.textContent = text;
    els.hSpec.classList.remove('hidden');
  };
  H.replay = function (on) { els.hReplay.classList.toggle('hidden', !on); };
  // splitscreen: Player 1's HUD sits on the top half, Player 2 gets a boost readout on the bottom half
  H.split = function (g) {
    const hud = document.getElementById('hud');
    hud.classList.toggle('split', !!(g && g.local2));
    let el = document.getElementById('hBoost2');
    if (g && g.local2) {
      if (!el) { el = U.h('<div class="h-boost2" id="hBoost2"><b>P2</b><span>33</span><small>BOOST</small></div>'); hud.appendChild(el); }
      el.querySelector('span').textContent = g.env.unlimitedBoost ? '∞' : Math.round(g.local2.boost);
    } else if (el) el.remove();
  };
  // "press JUMP to skip (1/2)": every player has to vote
  H.replaySkip = function (n, of) {
    const sm = els.hReplay && els.hReplay.querySelector('small');
    if (sm) sm.textContent = of > 1 ? `press JUMP to skip (${n}/${of})` : 'press JUMP to skip';
  };

  H.scoreboard = function (on) {
    if (!els.hBoard) return;
    if (!on || !game) { els.hBoard.classList.add('hidden'); return; }
    const rows = (t) => game.cars.filter((c) => c.team === t).sort((a, b) => b.stats.score - a.stats.score).map((c) => `
      <tr class="${c.isLocal ? 'me' : ''}"><td>${U.tagHtml(c)}${U.esc(c.name)}</td><td>${c.stats.score}</td><td>${c.stats.goals}</td><td>${c.stats.assists}</td><td>${c.stats.saves}</td><td>${c.stats.shots}</td><td>${c.stats.demos}</td><td>${c.ping != null ? c.ping : ''}</td></tr>`).join('');
    const I = BL.ICON;
    const head = `<tr><th>PLAYER</th><th>${I('score')} SCORE</th><th>${I('goal')} GOALS</th><th>${I('assist')} ASSISTS</th><th>${I('save')} SAVES</th><th>${I('shot')} SHOTS</th><th>${I('demo')} DEMOS</th><th>PING</th></tr>`;
    // real-game layout: each team's big score on the left, its players on a team-coloured band
    els.hBoard.innerHTML = `<div class="hb-team blue"><div class="hb-tt"><b>${game.score[0]}</b><span>${U.esc(game.teamName(0))}</span></div><table>${head}${rows(0)}</table></div>
      <div class="hb-team orange"><div class="hb-tt"><b>${game.score[1]}</b><span>${U.esc(game.teamName(1))}</span></div><table>${head}${rows(1)}</table></div>`;
    els.hBoard.classList.remove('hidden');
  };
})(window.BL);
