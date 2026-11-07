'use strict';
// Rocket League (fan remake) - audio: recorded sound effects (BL.SFX) with synthesized fallbacks, engine, crowd, menu synth
(function (BL) {
  const A = BL.Audio = { ctx: null, ready: false };
  let noiseBuf = null;
  let engine = null, crowd = null, music = null;

  A.init = function () {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = A.ctx = new AC();
    Object.assign(A, A._bus(ctx, ctx.destination));
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true;
    A.applyVolumes();
    A.loadSamples();
  };

  // ---------- recorded sound effects (BL.SFX in js/assets.js) ----------
  // decoded once; only each file's [start, start + len] window plays. file:// pages read the packed copies.
  const samples = {};
  A.loadSamples = function () {
    const list = BL.SFX || {};
    for (const name of Object.keys(list)) {
      const s = list[name];
      const packed = BL.EMBED_SFX && BL.EMBED_SFX[s.url];
      let bytes;
      if (packed) {
        const bin = atob(packed.slice(packed.indexOf(',') + 1)), arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        bytes = Promise.resolve(arr.buffer);
      } else if (location.protocol !== 'file:') bytes = fetch(s.url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)));
      else continue;
      bytes.then((b) => new Promise((ok, no) => A.ctx.decodeAudioData(b, ok, no)))
        .then((buf) => { samples[name] = buf; })
        .catch(() => console.warn('[audio] could not load', s.url));
    }
  };
  // play a sample window with short fades so cut edges never click; false if it isn't loaded
  function sample(name, vol, delay) {
    const buf = samples[name], s = BL.SFX && BL.SFX[name];
    if (!buf || !s) return false;
    const ctx = A.ctx, t = ctx.currentTime + (delay || 0);
    const len = Math.min(s.len, buf.duration - s.start);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, len - Math.min(0.12, len * 0.25)));
    g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(g); g.connect(A.sfx);
    src.start(t, s.start, len);
    return true;
  }
  A.hasSample = (name) => !!samples[name];

  // Rocket League pack (js/assets.js rl_*): which recordings play for what. Each play picks a random variation
  // from the pool, like the game; Settings -> Audio -> Sound Test can pin a different file per sound.
  const mvs = []; for (let n = 1; n <= 25; n++) mvs.push('rl_mv_' + String(n).padStart(2, '0'));
  A.POOLS = {
    jump: ['rl_mv_06', 'rl_mv_12', 'rl_mv_13', 'rl_mv_19'],
    doublejump: ['rl_mv_05', 'rl_mv_08', 'rl_mv_09', 'rl_mv_23'],
    dodge: ['rl_mv_04', 'rl_mv_11', 'rl_mv_16', 'rl_mv_21'],
    land: ['rl_mv_01', 'rl_mv_15', 'rl_mv_17', 'rl_mv_24'],
    ballhit: ['rl_ballhit'], padSmall: ['rl_pad_small'], padBig: ['rl_pad_big'], goalBoom: ['rl_goal_boom'], demo: ['rl_demo'],
    stat: ['rl_stat'], click: ['rl_ui_03'], hover: ['rl_ui_29'], confirm: ['rl_ui_13'], matchFound: ['rl_ui_42'], boostStart: ['rl_boost_start'], rev: ['rl_rev_1', 'rl_rev_2'],
  };
  const uis = ['rl_ui_03', 'rl_ui_06', 'rl_ui_13', 'rl_ui_29', 'rl_ui_42'];
  A.SOUND_TEST = [
    ['jump', 'Jump', mvs], ['doublejump', 'Double Jump', mvs], ['dodge', 'Flip', mvs], ['land', 'Landing', mvs],
    ['ballhit', 'Ball Hit', ['rl_ballhit']], ['padSmall', 'Small Boost Pad', ['rl_pad_small', 'rl_pad_big', 'rl_stat']], ['padBig', 'Big Boost Pad', ['rl_pad_big', 'rl_pad_small']],
    ['boostStart', 'Boost Start', ['rl_boost_start', 'rl_boost_alt']], ['goalBoom', 'Goal', ['rl_goal_boom', 'rl_goal_crowd']], ['demo', 'Demolition', ['rl_demo']],
    ['stat', 'Stat Pop-up', ['rl_stat', 'rl_pad_small']], ['click', 'Menu Click', uis], ['hover', 'Menu Hover', uis], ['confirm', 'Menu Confirm', uis], ['matchFound', 'Match Found', uis],
  ];
  function pick(ev) {
    const st = BL.Save.p && BL.Save.p.settings, o = st && st.sfxPick && st.sfxPick[ev];
    if (o && samples[o]) return o;
    const ok = (A.POOLS[ev] || []).filter((k) => samples[k]);
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
  }
  function rl(ev, vol, delay) { const k = pick(ev); return k ? sample(k, vol, delay) : false; }
  A.preview = (key) => { A.unlock(); if (A.ctx && A.ctx.state === 'running') sample(key, 0.8); };
  A.label = (key) => (key ? key.replace(/^rl_mv_/, 'Car Movement ').replace(/^rl_ui_/, 'Menu Sound ').replace(/^rl_/, '').replace(/_/g, ' ') : '');
  let countdownAt = -10, overtimeOn = false;

  A.unlock = function () {
    if (!A.ctx) A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  // mixer: effects -> compressor -> make-up gain, crowd ambience beside it, then a limiter on everything.
  // The synth effects used to sit 30-50 dB under the recorded ball hit (and mostly in bass laptop speakers
  // can't play), so they sounded muted.
  A._bus = function (ctx, dest) {
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
    lim.connect(dest);
    const master = ctx.createGain(); master.connect(lim);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.002; comp.release.value = 0.16;
    const makeup = ctx.createGain(); makeup.gain.value = 1.7;
    comp.connect(makeup); makeup.connect(master);
    const sfx = ctx.createGain(); sfx.connect(comp);
    const amb = ctx.createGain(); amb.connect(master);
    const musicGain = ctx.createGain(); musicGain.connect(master);
    const engineGain = ctx.createGain(); engineGain.connect(master);
    const s = BL.Save.p ? BL.Save.p.settings : { master: 0.8, sfx: 0.9, music: 0.5, engine: 0.6 };
    master.gain.value = s.master; sfx.gain.value = s.sfx; amb.gain.value = s.sfx;
    musicGain.gain.value = s.music * 0.5; engineGain.gain.value = s.engine;
    return { master, sfx, amb, musicGain, engineGain };
  };

  A.applyVolumes = function () {
    if (!A.ctx) return;
    const s = BL.Save.p ? BL.Save.p.settings : { master: 0.8, sfx: 0.9, music: 0.5, engine: 0.6 };
    A.master.gain.value = s.master;
    A.sfx.gain.value = s.sfx;
    if (A.amb) A.amb.gain.value = s.sfx;
    A.musicGain.gain.value = s.music * 0.5;
    A.engineGain.gain.value = s.engine;
  };

  function noiseSrc() {
    const n = A.ctx.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    n.loopStart = Math.random();
    return n;
  }

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  function tone(type, f0, f1, dur, vol, dest, delay) {
    const ctx = A.ctx, t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(dest || A.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(filterType, f0, f1, q, dur, vol, dest, delay) {
    const ctx = A.ctx, t = ctx.currentTime + (delay || 0);
    const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.004, vol, dur);
    n.connect(f); f.connect(g); g.connect(dest || A.sfx);
    n.start(t); n.stop(t + dur + 0.05);
  }

  const lastAt = {}, GAP = { hit: 0.07, bump: 0.08, jump: 0.06, land: 0.08, dodge: 0.06, padSmall: 0.05, hover: 0.04 };
  A.play = function (name, vol, opt) {
    if (!A.ready || A.ctx.state !== 'running') return;
    vol = vol == null ? 1 : vol;
    const now = A.ctx.currentTime, gap = GAP[name] == null ? 0.03 : GAP[name];
    if (lastAt[name] != null && now - lastAt[name] < gap) return;
    lastAt[name] = now;
    switch (name) {
      case 'hit': {
        const v = Math.min(1, vol);
        if (v > 0.3 && rl('ballhit', 0.3 + v * 0.55)) break;
        if (sample('bounce', 0.3 + v * 0.65)) break;
        tone('sine', 160 + v * 60, 45, 0.18, 0.5 * v + 0.1);
        noise('lowpass', 2500 + v * 3000, 300, 0.7, 0.12, 0.35 * v + 0.05);
        break;
      }
      case 'goal': if (!rl('goalBoom', 1.0 * vol) && !sample('goal', 1.4 * vol)) A.play('boom', vol); break;
      case 'overtime': sample('overtime', 0.9 * vol); break;
      case 'bump': if (rl('land', 0.7 * vol)) break; tone('triangle', 230, 90, 0.16, 0.5 * vol); noise('bandpass', 2000, 600, 0.9, 0.2, 0.7 * vol); break;
      case 'jump': if (rl('jump', 0.75 * vol)) break; noise('bandpass', 2300, 520, 1.3, 0.15, 0.4 * vol); tone('sine', 200, 78, 0.12, 0.34 * vol); noise('highpass', 5200, 3200, 0.7, 0.03, 0.13 * vol); break;
      case 'doublejump': if (rl('doublejump', 0.7 * vol) || rl('jump', 0.7 * vol)) break; noise('bandpass', 2300, 520, 1.3, 0.15, 0.4 * vol); break;
      case 'dodge': if (rl('dodge', 0.75 * vol)) break; noise('bandpass', 3000, 650, 1.3, 0.32, 0.75 * vol); noise('highpass', 5000, 7000, 0.7, 0.07, 0.2 * vol); break;
      case 'land': if (rl('land', 0.7 * vol)) break; tone('triangle', 210, 100, 0.1, 0.24 * vol); noise('lowpass', 2200, 500, 0.8, 0.09, 0.21 * vol); break;
      case 'padSmall': if (rl('padSmall', 0.55 * vol)) break; tone('sine', 900, 1400, 0.08, 0.16 * vol); tone('triangle', 1800, 2600, 0.06, 0.045 * vol); break;
      case 'padBig': if (rl('padBig', 0.7 * vol)) break; tone('triangle', 520, 1560, 0.24, 0.34 * vol); tone('sine', 1040, 2080, 0.2, 0.15 * vol, null, 0.05); noise('highpass', 4000, 8000, 0.7, 0.18, 0.1 * vol); break;
      case 'count': {
        // the recorded countdown holds all four beeps (3-2-1-GO, 1 s apart): start it on "3", skip "2" / "1"
        const now = A.ctx.currentTime;
        if (now - countdownAt < 2.9) break;
        if (sample('countdown', 0.9 * vol)) { countdownAt = now; break; }
        tone('square', 520, 520, 0.14, 0.12 * vol);
        break;
      }
      case 'go':
        if (A.ctx.currentTime - countdownAt < 3.6) break;
        tone('square', 1040, 1040, 0.4, 0.13 * vol); tone('square', 780, 780, 0.4, 0.06 * vol);
        break;
      case 'horn': {
        const ctx = A.ctx, t = ctx.currentTime;
        [220, 277.2, 329.6, 440].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = f;
          lp.type = 'lowpass'; lp.frequency.value = 1800;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.05);
          g.gain.setValueAtTime(0.09 * vol, t + 1.1);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
          o.connect(lp); lp.connect(g); g.connect(A.sfx);
          o.start(t + i * 0.01); o.stop(t + 1.7);
        });
        break;
      }
      case 'boom': {
        noise('lowpass', 4000, 120, 0.8, 1.4, 0.8 * vol);
        tone('sine', 90, 30, 1.0, 0.7 * vol);
        noise('bandpass', 1500, 400, 0.6, 0.6, 0.25 * vol, null, 0.1);
        break;
      }
      case 'demo': if (rl('demo', 0.9 * vol)) break; noise('lowpass', 6000, 250, 0.7, 1.0, 0.9 * vol); noise('bandpass', 2600, 500, 1, 0.4, 0.55 * vol); tone('sawtooth', 320, 45, 0.5, 0.22 * vol); break;
      case 'thunder': noise('lowpass', 1200, 60, 0.5, 2.0, 0.7 * vol); break;
      case 'click': if (rl('click', 0.5 * vol)) break; tone('triangle', 1600, 1000, 0.05, 0.16 * vol); break;
      case 'hover': if (rl('hover', 0.3 * vol)) break; tone('sine', 1800, 1600, 0.03, 0.05 * vol); break;
      case 'buzzer': tone('square', 300, 280, 0.9, 0.12 * vol); tone('square', 303, 283, 0.9, 0.1 * vol); break;
      case 'chat': tone('sine', 660, 990, 0.08, 0.1 * vol); break;
      case 'stat': rl('stat', vol); break;
      case 'item': tone('triangle', 400, 1200, 0.25, 0.26 * vol); break;
      // menu moments that used to borrow the Rumble item sound
      case 'confirm': if (rl('confirm', 0.55 * vol)) break; tone('triangle', 880, 1320, 0.12, 0.14 * vol); break;
      case 'matchfound': if (rl('matchFound', 0.7 * vol)) break; [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.18, 0.13 * vol, null, i * 0.11)); break;
      case 'freeze': noise('highpass', 3000, 9000, 1, 0.5, 0.2 * vol); tone('sine', 2000, 3000, 0.3, 0.06 * vol); break;
      case 'punch': tone('sine', 200, 60, 0.2, 0.6 * vol); noise('lowpass', 2000, 200, 1, 0.15, 0.4 * vol); break;
      case 'shake': {
        for (let i = 0; i < 6; i++) noise('bandpass', 600 + i * 150, 800 + i * 150, 3, 0.08, 0.1 * vol, null, i * 0.08);
        break;
      }
      case 'reveal': {
        const tier = opt || 0;
        const base = [262, 294, 330, 349, 392, 440, 494, 523][tier] || 262;
        [1, 1.25, 1.5, 2].forEach((m, i) => tone(i % 2 ? 'triangle' : 'sine', base * m, base * m, 0.6 + tier * 0.1, 0.12 * vol, null, i * 0.07));
        if (tier >= 4) noise('highpass', 4000, 12000, 1, 1.2, 0.08 * vol, null, 0.1);
        break;
      }
      case 'whoosh': noise('bandpass', 400, 2600, 1.1, 0.5, 0.45 * vol); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.25, 0.12 * vol, null, i * 0.09)); break;
      default: break;
    }
  };

  // ---------- Driving sound (local car) ----------
  // engine (two detuned saws + a sub, filter opening with speed), tyre roll on the ground, boost roar, a squeal
  // when powersliding and a high whoosh at supersonic. Started lazily, so it also starts if the sound was still
  // locked when the match loaded (browsers only allow audio after a click or key press).
  // the real engine: four recorded Octane layers (idle -> high) crossfaded and pitched with speed, tyre roll,
  // powerslide skid and the boost loop; the synth below is the fallback until the recordings have loaded
  function startRecordedEngine() {
    const ctx = A.ctx, out = A.engineGain;
    const loop = (key, dest) => { const s = ctx.createBufferSource(); s.buffer = samples[key]; s.loop = true; s.connect(dest); s.start(ctx.currentTime + Math.random() * 0.05); return s; };
    const gain = (v, dest) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; };
    const layers = ['rl_engine_idle', 'rl_engine_low', 'rl_engine_mid', 'rl_engine_high'].map((k) => { const g = gain(0, out); return { g, s: loop(k, g) }; });
    const tg = gain(0, out), sg = gain(0, A.sfx), bg = gain(0, A.sfx), hg = gain(0, out);
    const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 4200; hf.connect(hg);
    const hn = noiseSrc(); hn.connect(hf); hn.start();
    engine = { rec: true, layers, tg, sg, bg, hg, tire: loop('rl_tire_roll', tg), slide: loop('rl_tire_slide', sg), boost: loop('rl_boost_loop', bg), srcs: [hn], wasBoost: false, lastTh: 0 };
    engine.srcs.push(engine.tire, engine.slide, engine.boost, ...layers.map((l) => l.s));
  }
  const ENGINE_KEYS = ['rl_engine_idle', 'rl_engine_low', 'rl_engine_mid', 'rl_engine_high', 'rl_tire_roll', 'rl_tire_slide', 'rl_boost_loop'];
  const recordedReady = () => ENGINE_KEYS.every((k) => samples[k]);
  A.startEngine = function () {
    if (!A.ready || engine) return;
    if (recordedReady()) { startRecordedEngine(); return; }
    const ctx = A.ctx, out = A.engineGain;
    const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    const gain = (v, dest) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; };
    const filt = (type, f, q, dest) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
    const g = gain(0, out), lp = filt('lowpass', 700, 0.9, g);
    const o1 = osc('sawtooth', 70), o2 = osc('sawtooth', 70.3), sub = osc('triangle', 35);
    o1.connect(lp); o2.connect(lp); const subG = gain(0.5, lp); sub.connect(subG);
    const noiseInto = (dest) => { const n = noiseSrc(); n.connect(dest); n.start(); return n; };
    const tg = gain(0, out), tf = filt('bandpass', 400, 0.7, tg), tn = noiseInto(tf);
    const bg = gain(0, out), bf = filt('bandpass', 1400, 0.6, bg), bn = noiseInto(bf);
    const bg2 = gain(0, out), bf2 = filt('lowpass', 450, 0.7, bg2), bn2 = noiseInto(bf2);
    const sg = gain(0, out), sf = filt('bandpass', 2600, 5, sg), sn = noiseInto(sf);
    const hg = gain(0, out), hf = filt('highpass', 4200, 0.7, hg), hn = noiseInto(hf);
    o1.start(); o2.start(); sub.start();
    engine = { o1, o2, sub, lp, g, tg, tf, bg, bf, bg2, sg, hg, srcs: [o1, o2, sub, tn, bn, bn2, sn, hn] };
  };
  A._engineOn = () => !!engine;
  A.stopEngine = function () {
    if (!engine) return;
    for (const n of engine.srcs) { try { n.stop(); } catch (e) { /* already stopped */ } }
    engine = null;
  };
  A.setEngine = function (speed, throttle, boosting, active, onGround, sliding, supersonic) {
    // overtime sting the moment a match goes to overtime (setEngine runs every frame in a match)
    const ot = !!(BL.game && BL.game.overtime && !BL.game.matchOver);
    if (ot && !overtimeOn) A.play('overtime');
    overtimeOn = ot;
    if (!engine && active && A.ready) { A.startEngine(); if (BL.game && !crowd) A.startCrowd(); }
    // the recordings finished loading after the synth started: swap over
    if (engine && !engine.rec && recordedReady()) { A.stopEngine(); A.startEngine(); }
    if (crowd && !crowd.rec && samples.rl_crowd_loop) { A.stopCrowd(); A.startCrowd(); }
    if (!engine) return;
    const t = A.ctx.currentTime, th = Math.abs(throttle || 0), sp = Math.min(speed, 23);
    const ground = onGround !== false;
    if (engine.rec) {
      const u = sp / 23, on = active ? 1 : 0;
      // crossfade idle -> low -> mid -> high, each pitched up through its range
      const w = [Math.max(0, 1 - u * 4), Math.max(0, 1 - Math.abs(u - 0.25) * 4), Math.max(0, 1 - Math.abs(u - 0.55) * 3.3), Math.max(0, (u - 0.6) * 2.5)];
      const lv = 0.22 + th * 0.12;
      engine.layers.forEach((l, i) => {
        l.g.gain.setTargetAtTime(on * Math.min(1, w[i]) * lv, t, 0.08);
        l.s.playbackRate.setTargetAtTime(0.85 + u * 0.45 + th * 0.05, t, 0.08);
      });
      engine.tg.gain.setTargetAtTime(on && ground ? Math.min(1, sp / 18) * 0.32 : 0, t, 0.08);
      engine.tire.playbackRate.setTargetAtTime(0.75 + u * 0.5, t, 0.1);
      engine.sg.gain.setTargetAtTime(on && ground && sliding && sp > 5 ? 0.45 : 0, t, 0.05);
      engine.bg.gain.setTargetAtTime(on && boosting ? 0.32 : 0, t, 0.05);
      engine.hg.gain.setTargetAtTime(on && supersonic ? 0.05 : 0, t, 0.15);
      if (active && boosting && !engine.wasBoost) rl('boostStart', 0.4);
      engine.wasBoost = !!(active && boosting);
      // a rev when you floor it from a standstill
      if (active && th > 0.8 && engine.lastTh < 0.2 && sp < 4) rl('rev', 0.35);
      engine.lastTh = th;
      return;
    }
    const f = 62 + sp * 4.4 + th * 10;
    engine.o1.frequency.setTargetAtTime(f, t, 0.06);
    engine.o2.frequency.setTargetAtTime(f * 1.006, t, 0.06);
    engine.sub.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    engine.lp.frequency.setTargetAtTime(500 + sp * 70 + th * 600, t, 0.08);
    engine.g.gain.setTargetAtTime(active ? 0.12 + th * 0.09 + sp * 0.004 : 0, t, 0.1);
    engine.tg.gain.setTargetAtTime(active && ground ? Math.min(1, sp / 20) * 0.3 : 0, t, 0.08);
    engine.tf.frequency.setTargetAtTime(250 + sp * 30, t, 0.1);
    engine.bg.gain.setTargetAtTime(active && boosting ? 0.17 : 0, t, 0.06);
    engine.bf.frequency.setTargetAtTime(1200 + sp * 45, t, 0.1);
    engine.bg2.gain.setTargetAtTime(active && boosting ? 0.13 : 0, t, 0.07);
    engine.sg.gain.setTargetAtTime(active && ground && sliding && sp > 7 ? 0.1 : 0, t, 0.05);
    engine.hg.gain.setTargetAtTime(active && supersonic ? 0.05 : 0, t, 0.15);
  };

  // ---------- Crowd ambience ----------
  A.startCrowd = function () {
    if (!A.ready || crowd) return;
    const ctx = A.ctx;
    if (samples.rl_crowd_loop) {
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = samples.rl_crowd_loop; s.loop = true; g.gain.value = 0.3; s.connect(g); g.connect(A.amb || A.sfx); s.start();
      crowd = { rec: true, n: s, g };
      return;
    }
    const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
    g.gain.value = 0.03;
    n.connect(f); f.connect(g); g.connect(A.amb || A.sfx);
    n.start();
    crowd = { n, f, g };
  };
  A.stopCrowd = function () {
    if (!crowd) return;
    try { crowd.n.stop(); } catch (e) { /* noop */ }
    crowd = null;
  };
  A.cheer = function (amount) {
    if (!crowd) return;
    const t = A.ctx.currentTime, a = amount || 1;
    if (crowd.rec) {
      sample('rl_goal_crowd', 0.55 * a);
      crowd.g.gain.cancelScheduledValues(t); crowd.g.gain.setValueAtTime(crowd.g.gain.value, t);
      crowd.g.gain.linearRampToValueAtTime(0.3 + 0.25 * a, t + 0.4); crowd.g.gain.linearRampToValueAtTime(0.3, t + 5);
      return;
    }
    crowd.g.gain.cancelScheduledValues(t);
    crowd.g.gain.setValueAtTime(crowd.g.gain.value, t);
    crowd.g.gain.linearRampToValueAtTime(0.06 + 0.3 * a, t + 0.3);
    crowd.g.gain.linearRampToValueAtTime(0.03, t + 4.5);
    crowd.f.frequency.setValueAtTime(2200, t);
    crowd.f.frequency.linearRampToValueAtTime(900, t + 4);
  };

  // ---------- Menu music (tiny synthwave sequencer) ----------
  const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  A.startMusic = function () {
    if (!A.ready || music) return;
    const ctx = A.ctx;
    const bpm = 108, step = 60 / bpm / 2;
    let next = ctx.currentTime + 0.1, i = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    lp.connect(A.musicGain);
    const sched = () => {
      while (next < ctx.currentTime + 0.25) {
        const bar = Math.floor(i / 8) % 4, s = i % 8;
        const chord = PROG[bar];
        // bass
        tone('sawtooth', mtof(chord[0] - 24), mtof(chord[0] - 24), step * 0.9, 0.12, lp, next - ctx.currentTime);
        // arp
        if (s % 2 === 0) tone('square', mtof(chord[(s / 2) % 3] + 12), mtof(chord[(s / 2) % 3] + 12), step * 0.7, 0.025, lp, next - ctx.currentTime);
        // pad on bar start
        if (s === 0) chord.forEach((m) => tone('triangle', mtof(m), mtof(m), step * 7.5, 0.03, lp, next - ctx.currentTime));
        // drums
        if (s % 4 === 0) tone('sine', 120, 40, 0.18, 0.25, A.musicGain, next - ctx.currentTime);
        if (s % 4 === 2) noise('bandpass', 1800, 1500, 0.8, 0.12, 0.08, A.musicGain, next - ctx.currentTime);
        noise('highpass', 7000, 9000, 1, 0.03, 0.025, A.musicGain, next - ctx.currentTime);
        next += step; i++;
      }
    };
    const id = setInterval(sched, 90);
    music = { id, lp };
  };
  A.stopMusic = function () {
    if (!music) return;
    clearInterval(music.id);
    music = null;
  };
})(window.BL);
