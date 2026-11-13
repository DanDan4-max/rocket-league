'use strict';
// Rocket League (fan remake) - keyboard, mouse, gamepad and touch input with rebindable controls
(function (BL) {
  const U = BL.util;
  const I = BL.Input = {};

  // action -> [label, default keys, default gamepad button (-1 = none)]
  const ACTIONS_DEF = {
    forward: ['Throttle / Pitch Down', ['KeyW', 'ArrowUp'], -1],
    back: ['Reverse / Pitch Up', ['KeyS', 'ArrowDown'], -1],
    left: ['Steer Left', ['KeyA', 'ArrowLeft'], -1],
    right: ['Steer Right', ['KeyD', 'ArrowRight'], -1],
    jump: ['Jump', ['Space', 'KeyJ'], 0],
    boost: ['Boost', ['ShiftLeft', 'KeyK'], 1],
    slide: ['Powerslide / Air Roll', ['KeyX', 'ControlLeft'], 2],
    airroll: ['Air Roll (hold + steer)', ['KeyZ'], -1],
    rollLeft: ['Air Roll Left', ['KeyQ'], 4],
    rollRight: ['Air Roll Right', ['KeyE'], 5],
    ballcam: ['Ball Cam', ['KeyC', 'KeyI'], 3],
    item: ['Use Rumble Item', ['KeyR', 'KeyF'], 11],
    scoreboard: ['Scoreboard', ['Tab'], 8],
    pause: ['Pause / Menu', ['Escape', 'KeyP'], 9],
    reset: ['Reset Ball (Free Play)', ['Backspace'], 10],
    textchat: ['Text Chat', ['KeyT'], -1],
    ballToMe: ['Bring Ball to You (Free Play)', ['KeyG'], 13],
    chat1: ['Quick Chat: Information', ['Digit1'], 12],
    chat2: ['Quick Chat: Compliments', ['Digit2'], 15],
    chat3: ['Quick Chat: Reactions', ['Digit3'], 13],
    chat4: ['Quick Chat: Apologies', ['Digit4'], 14],
  };
  I.ACTIONS_DEF = ACTIONS_DEF;
  const ACTIONS = Object.keys(ACTIONS_DEF);
  I.ACTIONS = ACTIONS;
  // analog gamepad bindings
  I.PAD_AXES_DEF = { throttle: 7, brake: 6 };

  let KEYS = {}, PAD = {}, GAME_CODES = new Set();
  I.loadBindings = function () {
    const s = BL.Save.p.settings;
    KEYS = {}; PAD = {};
    for (const a of ACTIONS) {
      KEYS[a] = (s.keys && s.keys[a]) ? s.keys[a].slice() : ACTIONS_DEF[a][1].slice();
      PAD[a] = (s.pad && s.pad[a] != null) ? s.pad[a] : ACTIONS_DEF[a][2];
    }
    PAD.throttleBtn = (s.pad && s.pad.throttleBtn != null) ? s.pad.throttleBtn : I.PAD_AXES_DEF.throttle;
    PAD.brakeBtn = (s.pad && s.pad.brakeBtn != null) ? s.pad.brakeBtn : I.PAD_AXES_DEF.brake;
    GAME_CODES = new Set([].concat(...Object.values(KEYS)));
    I.KEYS = KEYS; I.PAD = PAD;
  };
  I.setKey = function (action, slot, code) {
    const s = BL.Save.p.settings;
    s.keys = s.keys || {};
    const list = (s.keys[action] || ACTIONS_DEF[action][1]).slice();
    // a key can only do one thing: remove it from other actions
    for (const a of ACTIONS) {
      if (a === action) continue;
      const other = (s.keys[a] || ACTIONS_DEF[a][1]).slice();
      const i = other.indexOf(code);
      if (i >= 0) { other.splice(i, 1); s.keys[a] = other; }
    }
    list[slot] = code;
    s.keys[action] = list.filter(Boolean);
    BL.Save.save();
    I.loadBindings();
  };
  I.setPad = function (action, btn) {
    const s = BL.Save.p.settings;
    s.pad = s.pad || {};
    for (const a of ACTIONS) if (a !== action && (s.pad[a] != null ? s.pad[a] : ACTIONS_DEF[a][2]) === btn) s.pad[a] = -1;
    s.pad[action] = btn;
    BL.Save.save();
    I.loadBindings();
  };
  I.resetBindings = function () {
    const s = BL.Save.p.settings;
    delete s.keys; delete s.pad;
    BL.Save.save();
    I.loadBindings();
  };
  I.keyName = function (code) {
    if (!code) return '—';
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑').replace('↑Up', '↑').replace('↑Down', '↓').replace('↑Left', '←').replace('↑Right', '→')
      .replace('ShiftLeft', 'L-Shift').replace('ShiftRight', 'R-Shift').replace('ControlLeft', 'L-Ctrl').replace('ControlRight', 'R-Ctrl').replace('AltLeft', 'L-Alt').replace('Space', 'Space');
  };
  const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];
  I.padName = (b) => (b == null || b < 0 ? '—' : PAD_NAMES[b] || 'Button ' + b);

  const down = {};
  const tapped = {};
  const active = {};
  const prev = {};
  const mouse = { left: false, right: false };
  const touch = { joyX: 0, joyY: 0, buttons: {}, enabled: false };
  I.touch = touch;
  I.gameActive = false;
  I.usingGamepad = false;
  I.capture = null; // rebinding capture callback

  // right stick: look round the car (game.js turns the camera); one per pad for splitscreen
  I.look = { x: 0, y: 0 }; I.look2 = { x: 0, y: 0 };
  I.controls = { throttle: 0, steer: 0, pitch: 0, roll: 0, airRollFree: false, jump: false, jumpSeq: 0, boost: false, handbrake: false, itemSeq: 0 };

  I.init = function (canvas) {
    I.loadBindings();
    window.addEventListener('keydown', (e) => {
      if (I.capture) { e.preventDefault(); const f = I.capture; I.capture = null; f({ type: 'key', code: e.code }); return; }
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      down[e.code] = true;
      for (const a of ACTIONS) if (KEYS[a].indexOf(e.code) >= 0) tapped[a] = true;
      if (I.gameActive && GAME_CODES.has(e.code)) e.preventDefault();
      I.usingGamepad = false;
    });
    window.addEventListener('keyup', (e) => { down[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in down) down[k] = false; mouse.left = mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!I.gameActive) return;
      if (e.button === 0) { mouse.left = true; }
      if (e.button === 2) { mouse.right = true; tapped.jump = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) mouse.left = false;
      if (e.button === 2) mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    I.buildTouch();
  };

  function key(a) {
    const codes = KEYS[a];
    for (let i = 0; i < codes.length; i++) if (down[codes[i]]) return true;
    return false;
  }

  function dz(v, d) { return Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d); }

  // splitscreen: Player 2 takes a controller; Player 1 keeps the keyboard (and the first pad if there are two)
  I.split = false;
  // Some browsers (Chromebooks especially) list one physical controller twice. Both copies always show exactly the
  // same buttons and sticks, so a pad that keeps mirroring an earlier one while being used is treated as the same
  // controller (otherwise splitscreen Player 2 reads Player 1's pad and one press toggles both players' ball cam).
  const mirror = {};
  const padKey = (p) => p.buttons.map((b) => (b.pressed || b.value > 0.5 ? 1 : 0)).join('') + p.axes.map((x) => Math.round(x * 4)).join(',');
  const connected = () => {
    const raw = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter((p) => p && p.connected);
    if (raw.length < 2) return raw;
    const keys = raw.map(padKey), active = raw.map((p) => p.buttons.some((b) => b.pressed || b.value > 0.5) || p.axes.some((x) => Math.abs(x) > 0.3));
    for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) {
      if (!active[i] && !active[j]) continue;
      const k = raw[i].index + ':' + raw[j].index;
      mirror[k] = keys[i] === keys[j] ? Math.min(20, (mirror[k] || 0) + 1) : -40;
    }
    return raw.filter((p, j) => !raw.some((q, i) => i < j && (mirror[q.index + ':' + p.index] || 0) >= 4));
  };
  I.pads = () => connected();
  I.getPad = function () {
    const pads = connected();
    if (I.split) return pads.length >= 2 ? pads[0] : null;
    return pads[0] || null;
  };
  I.getPad2 = function () {
    const pads = connected();
    return pads.length >= 2 ? pads[1] : pads[0] || null;
  };
  // Player 2's controls from its own pad (same button mapping as Player 1)
  const p2prev = {};
  I.readPad2 = function (c) {
    const gp = I.getPad2();
    if (!gp) { c.throttle = 0; c.steer = 0; c.pitch = 0; c.roll = 0; c.boost = false; c.jump = false; c.handbrake = false; c.airRollFree = false; I.look2.x = I.look2.y = 0; return {}; }
    const settings = BL.Save.p.settings;
    const pressed = (i) => (i != null && i >= 0 && gp.buttons[i] ? gp.buttons[i].pressed || gp.buttons[i].value > 0.5 : false);
    const bv = (i) => (i != null && i >= 0 && gp.buttons[i] ? gp.buttons[i].value : 0);
    const dead = settings.deadzone == null ? 0.15 : settings.deadzone;
    const ax = U.clamp(dz(gp.axes[0] || 0, dead), -1, 1), ay = U.clamp(dz(gp.axes[1] || 0, dead), -1, 1);
    I.look2.x = U.clamp(dz(gp.axes[2] || 0, dead), -1, 1); I.look2.y = U.clamp(dz(gp.axes[3] || 0, dead), -1, 1);
    const st = {};
    for (const a of ACTIONS) st[a] = pressed(PAD[a]);
    c.throttle = U.clamp(bv(PAD.throttleBtn) - bv(PAD.brakeBtn), -1, 1);
    c.steer = ax; c.pitch = settings.invertPitch ? ay : -ay;
    c.roll = (pressed(PAD.rollRight) ? 1 : 0) - (pressed(PAD.rollLeft) ? 1 : 0);
    c.boost = !!st.boost; c.jump = !!st.jump; c.handbrake = !!st.slide; c.airRollFree = !!(st.slide || st.airroll);
    const edge = {};
    for (const a of ACTIONS) { edge[a] = st[a] && !p2prev[a]; p2prev[a] = st[a]; }
    if (edge.jump) c.jumpSeq++;
    if (edge.item) c.itemSeq++;
    return edge;
  };

  let padPrevButtons = [];
  I.update = function () {
    const settings = BL.Save.p.settings;
    let throttle = 0, steer = 0, pitch = 0, roll = 0;
    const st = {};
    for (const a of ACTIONS) st[a] = key(a) || !!tapped[a];
    st.boost = st.boost || mouse.left;
    st.jump = st.jump || mouse.right;

    const kf = (key('forward') ? 1 : 0) - (key('back') ? 1 : 0);
    const ks = (key('right') ? 1 : 0) - (key('left') ? 1 : 0);
    throttle = kf; pitch = kf; steer = ks;
    roll = (key('rollRight') ? 1 : 0) - (key('rollLeft') ? 1 : 0);

    const gp = I.getPad();
    I.look.x = I.look.y = 0;
    if (gp) {
      const pressed = (i) => (i != null && i >= 0 && gp.buttons[i] ? gp.buttons[i].pressed || gp.buttons[i].value > 0.5 : false);
      const bv = (i) => (i != null && i >= 0 && gp.buttons[i] ? gp.buttons[i].value : 0);
      // rebinding capture for gamepad buttons
      if (I.capture) {
        // the press that opened the prompt (A on a controller) must be released first, or it binds itself
        if (I.captureFresh) { if (!gp.buttons.some((b, i) => pressed(i))) I.captureFresh = false; }
        else for (let i = 0; i < gp.buttons.length; i++) {
          if (pressed(i) && !padPrevButtons[i]) { const f = I.capture; I.capture = null; f({ type: 'pad', button: i }); break; }
        }
      }
      padPrevButtons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      const dead = settings.deadzone == null ? 0.15 : settings.deadzone;
      const sens = settings.steerSens == null ? 1 : settings.steerSens;
      const ax = U.clamp(dz(gp.axes[0] || 0, dead) * sens, -1, 1), ay = U.clamp(dz(gp.axes[1] || 0, dead) * sens, -1, 1);
      const trig = bv(PAD.throttleBtn) - bv(PAD.brakeBtn);
      const anyPad = Math.abs(ax) > 0 || Math.abs(ay) > 0 || Math.abs(trig) > 0.05 || gp.buttons.some((x) => x && x.pressed);
      if (anyPad) I.usingGamepad = true;
      if (I.usingGamepad) {
        if (Math.abs(ax) > Math.abs(steer)) steer = ax;
        if (Math.abs(trig) > 0.05) throttle = trig;
        if (Math.abs(ay) > 0) pitch = -ay;
        for (const a of ACTIONS) if (pressed(PAD[a])) st[a] = true;
        const r = (pressed(PAD.rollRight) ? 1 : 0) - (pressed(PAD.rollLeft) ? 1 : 0);
        if (r) roll = r;
        I.look.x = U.clamp(dz(gp.axes[2] || 0, dead), -1, 1); I.look.y = U.clamp(dz(gp.axes[3] || 0, dead), -1, 1);
      }
    }

    if (touch.enabled) {
      if (Math.abs(touch.joyX) > 0.05 || Math.abs(touch.joyY) > 0.05) {
        steer = U.clamp(touch.joyX * 1.3, -1, 1);
        pitch = U.clamp(-touch.joyY * 1.3, -1, 1);
        throttle = U.clamp(-touch.joyY * 2, -1, 1);
      }
      const tb = touch.buttons;
      st.jump = st.jump || !!tb.jump;
      st.boost = st.boost || !!tb.boost;
      st.slide = st.slide || !!tb.slide;
      st.ballcam = st.ballcam || !!tb.ballcam;
      st.item = st.item || !!tb.item;
      st.pause = st.pause || !!tb.pause;
    }

    if (settings.invertPitch) pitch = -pitch;

    for (const a of ACTIONS) { prev[a] = active[a]; active[a] = st[a]; tapped[a] = false; }

    const c = I.controls;
    c.throttle = U.clamp(throttle, -1, 1);
    c.steer = U.clamp(steer, -1, 1);
    c.pitch = U.clamp(pitch, -1, 1);
    c.roll = roll;
    // free air roll: the Powerslide button rolls in the air (like the real defaults), and so does a separate Air Roll
    // binding, which never powerslides on the ground
    c.airRollFree = !!(active.slide || active.airroll);
    c.handbrake = !!active.slide;
    c.boost = !!active.boost;
    c.jump = !!active.jump;
    if (active.jump && !prev.jump) c.jumpSeq++;
    if (active.item && !prev.item) c.itemSeq++;
  };

  I.pressed = (a) => !!active[a] && !prev[a];
  I.held = (a) => !!active[a];

  I.rumble = function (strong, weak, ms) {
    if (!BL.Save.p.settings.vibration || !I.usingGamepad) return;
    const gp = I.getPad();
    const act = gp && gp.vibrationActuator;
    if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms || 120, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
  };

  // ---------- Touch controls ----------
  I.buildTouch = function () {
    const root = document.getElementById('touch');
    if (!root) return;
    root.innerHTML = `
      <div class="t-joy" id="tJoy"><div class="t-knob" id="tKnob"></div></div>
      <div class="t-btns">
        <button class="t-btn t-jump" data-b="jump">JUMP</button>
        <button class="t-btn t-boost" data-b="boost">BOOST</button>
        <button class="t-btn t-slide" data-b="slide">DRIFT</button>
        <button class="t-btn t-cam" data-b="ballcam">CAM</button>
        <button class="t-btn t-item" data-b="item">ITEM</button>
      </div>
      <button class="t-btn t-pause" data-b="pause">II</button>`;
    const joy = document.getElementById('tJoy'), knob = document.getElementById('tKnob');
    let joyId = null, cx = 0, cy = 0;
    const R = 55;
    const move = (t) => {
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      touch.joyX = dx / R; touch.joyY = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    joy.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      move(t); e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) { move(t); e.preventDefault(); }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === joyId) {
        joyId = null; touch.joyX = 0; touch.joyY = 0; knob.style.transform = '';
      }
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    root.querySelectorAll('.t-btn').forEach((btn) => {
      const b = btn.dataset.b;
      btn.addEventListener('touchstart', (e) => { touch.buttons[b] = true; tapped[b] = true; btn.classList.add('on'); e.preventDefault(); }, { passive: false });
      const up = (e) => { touch.buttons[b] = false; btn.classList.remove('on'); e.preventDefault(); };
      btn.addEventListener('touchend', up, { passive: false });
      btn.addEventListener('touchcancel', up, { passive: false });
    });
  };

  I.isTouchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  I.showTouch = function (show) {
    const root = document.getElementById('touch');
    if (!root) return;
    const mode = BL.Save.p.settings.touch;
    const on = show && (mode === 'on' || (mode === 'auto' && I.isTouchDevice() && !matchMedia('(pointer: fine)').matches));
    touch.enabled = on;
    root.classList.toggle('hidden', !on);
  };
})(window.BL);
