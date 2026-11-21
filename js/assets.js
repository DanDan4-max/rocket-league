'use strict';
// Rocket League (fan remake) - optional real 3D models.
//
// Drop .glb files into the assets/ folder and point to them here. Anything you leave out
// keeps using the built-in procedural models, so you can swap cars in one at a time.
// NOTE: loading .glb files needs the game to be served over http(s) (GitHub Pages, itch.io,
// or a local server) - browsers block loading model files from a file:// page.
//
// Example:
//   cars: {
//     body_striker: { url: 'assets/cars/striker.glb', scale: 1, rotationY: Math.PI, offset: [0, 0, 0],
//                     paintMaterial: 'paint|body', hideWheels: false },
//   },
//   ball: { url: 'assets/ball.glb' },
//
// - scale:          multiplier after the model is auto-fitted to the car's length
// - rotationY:      turn the model so its nose points forward (+Z)
// - offset:         nudge [x, y, z] in meters
// - paintMaterial:  regex for material names that should take the team color
// - hideWheels:     true if the model already has its own wheels (the built-in ones are hidden)
window.BL = window.BL || {};
window.BL.ASSETS = {
  cars: {},
  ball: null,
};
// ---- YOUR OWN CAR MODELS ----
// 1. Put a .glb file (or a .gltf in its own folder, with its .bin + textures) in assets/custom-cars/
// 2. Open tools/pack-assets.html and pick the game folder. The car shows up in the Garage (Body tab),
//    already unlocked, on Medium / High graphics. Add a line below only to tweak how it's set up:
//    hitbox: octane | dominus | plank | breakout | hybrid | merc   (how the car plays)
//    rotationY: Math.PI if the car faces backwards   scale: >1 bigger, <1 smaller
//    paintMaterial: regex for the material name(s) to paint in your team color (optional)
//    wheels: regex for the model's wheel node names, if they aren't called wheel/tire (optional)
window.BL.CUSTOM_CARS = [
  // { id: 'mycar', name: 'My Car', url: 'assets/custom-cars/mycar.glb', hitbox: 'octane', rotationY: 0, scale: 1, paintMaterial: 'paint|body' },
  // "Octane - Rocket League Car" by Jako (Sketchfab), CC-BY-4.0 - see README credits
  // fit 'length': model length = fitScale x hitbox length; fitWidth / fitHeight: width and roofline as fractions of the
  // hitbox's width and top; exhausts: boost outlets as [x of half-width, y of height from the bottom, z of half-length,
  // size] (read off each model from behind; how deep they sit is measured from the model when it loads)
  { id: 'octane', name: 'Octane', rarity: 'common', start: true, url: 'assets/custom-cars/octane/scene.gltf', hitbox: 'octane', rotationY: -Math.PI / 2, paintMaterial: '^Octane_Body$', wheels: 'Dieci', fit: 'length', fitScale: 1.02, fitWidth: 0.9, exhausts: [[0.265, 0.46, -0.9, 1.5], [-0.265, 0.46, -0.9, 1.5]] },
  // same author, CC-BY-4.0; in this season's lineup (BL.SEASON_BODIES in js/data.js)
  // the Fennec model is narrow: widened to its hitbox it gets taller by the same share (it looked squashed)
  { id: 'fennec', name: 'Fennec', rarity: 'import', url: 'assets/custom-cars/fennec/scene.gltf', hitbox: 'octane', rotationY: -Math.PI / 2, paintMaterial: '^Fennec_-_Body$', wheels: 'Alpha', fit: 'length', fitScale: 1.02, fitWidth: 0.9, fitHeight: 1.0, exhausts: [[0.345, 0.535, -0.99, 0.9], [-0.345, 0.535, -0.99, 0.9]] },
  { id: 'dominus', name: 'Dominus', rarity: 'rare', url: 'assets/custom-cars/dominus/scene.gltf', hitbox: 'dominus', rotationY: -Math.PI / 2, paintMaterial: '^Dominus_Body$', wheels: 'Cristiano', fit: 'length', fitScale: 1.02, fitWidth: 0.9, exhausts: [[0.15, 0.66, -0.96, 1.35], [-0.15, 0.66, -0.96, 1.35]] },
  // "2018 Ford Mustang Cobra Jet" by Ddiaz Design (Sketchfab), CC-BY-NC-SA-4.0 - see README credits
  { id: 'mustang', name: 'Mustang Cobra Jet', rarity: 'veryrare', url: 'assets/custom-cars/mustang/scene.gltf', hitbox: 'dominus', rotationY: 0, paintMaterial: 'PaintA_Material1$', wheels: '^3DWheel', fit: 'length', fitScale: 1.02, fitWidth: 0.9, exhausts: [[0.485, 0.24, -0.99, 0.8], [-0.485, 0.24, -0.99, 0.8]] },
  // "Guardian | Rocket League Car" by Prabhu Ram (Sketchfab), CC-BY-4.0; its wheels are loose parts (tyre, rim, bolts)
  { id: 'guardian', name: 'Guardian', rarity: 'exotic', url: 'assets/custom-cars/guardian/scene.gltf', hitbox: 'hybrid', rotationY: 0, wheelParts: '^Tyre_Model__Prabhu', paintMaterial: '^lambert2$', fit: 'length', fitScale: 1.02, fitWidth: 0.92, exhausts: [[0.65, 0.4, -0.98, 0.72], [-0.65, 0.4, -0.98, 0.72], [0.78, 0.4, -0.98, 0.72], [-0.78, 0.4, -0.98, 0.72]] },
  // "Rocket League Samus Gunship 3D Model (Switch)" by Techo (Sketchfab), CC-BY-NC-4.0
  { id: 'samus', name: 'Samus\' Gunship', rarity: 'import', url: 'assets/custom-cars/samus/scene.gltf', hitbox: 'breakout', rotationY: -Math.PI / 2, paintMaterial: '^Samus_Orange_Body$', wheels: 'Wheel.MK2', fit: 'length', fitScale: 1.02, fitWidth: 0.92, exhausts: [[0.48, 0.61, -0.96, 1.7], [-0.48, 0.61, -0.96, 1.7]] },
  // "Tesla Roadster 2.0" by Michael (Sketchfab), CC-BY-4.0; its wheels are four separate models (model_0/2/3/4)
  { id: 'roadster', name: 'Roadster', rarity: 'blackmarket', url: 'assets/custom-cars/roadster/scene.gltf', hitbox: 'dominus', rotationY: 0, wheelParts: '^model_[0234]_asset', firstUvOnly: true, paintMaterial: '^model_1_asset_0$', fit: 'length', fitScale: 1.02, fitWidth: 0.9, exhausts: [[0.157, 0.45, -0.99, 0.85], [-0.157, 0.45, -0.99, 0.85], [0.445, 0.45, -0.99, 0.85], [-0.445, 0.45, -0.99, 0.85]] },
];
// Every .glb/.gltf dropped into assets/custom-cars/ is added automatically once the pack page has run
// (tools/pack-assets.html writes js/asset-list.js). Lines above win for name/hitbox/rotation tweaks.
(function () {
  const BL = window.BL;
  const listed = (BL.ASSET_LIST && BL.ASSET_LIST.customCars) || [];
  for (const url of listed) {
    if (BL.CUSTOM_CARS.some((c) => c.url === url)) continue;
    // a model in its own folder (Sketchfab zips: octane/scene.gltf) is named after the folder
    const parts = url.replace(/^assets\/custom-cars\//, '').split('/');
    const file = (parts.length > 1 ? parts[0] : parts[0].replace(/\.(glb|gltf)$/i, '')).replace(/[^a-z0-9_ -]/gi, '');
    const name = file.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    BL.CUSTOM_CARS.push({ id: file, name, url, hitbox: 'octane' });
  }
  for (const c of BL.CUSTOM_CARS) {
    const id = 'body_custom_' + String(c.id).replace(/[^a-z0-9_]/gi, '');
    if (BL.ITEM_BY_ID[id]) continue;
    const item = { id, cat: 'body', name: c.name || c.id, rarity: c.rarity || 'limited', style: 'hatch', hitbox: BL.HITBOXES[c.hitbox] ? c.hitbox : 'octane', def: true, custom: true, start: !!c.start };
    BL.ITEMS.push(item);
    BL.ITEM_BY_ID[id] = item;
    // hq: downloaded models stay off on Low / Very Low (the built-in body shows instead)
    BL.ASSETS.cars[id] = { url: c.url, rotationY: c.rotationY || 0, scale: c.scale || 1, offset: c.offset, paintMaterial: c.paintMaterial, wheels: c.wheels, wheelParts: c.wheelParts, firstUvOnly: c.firstUvOnly, fit: c.fit, fitScale: c.fitScale, fitWidth: c.fitWidth, fitHeight: c.fitHeight, exhausts: c.exhausts, modelWheels: true, hq: true };
  }
  // season (BL.SEASON_BODIES in js/data.js): off-season bodies leave the item pool (drops, shop, trade-ins,
  // bots, garage) but stay in ITEM_BY_ID so saved inventories keep them
  BL.OFF_SEASON = [];
  for (let i = BL.ITEMS.length - 1; i >= 0; i--) if (!BL.inSeason(BL.ITEMS[i])) BL.OFF_SEASON.push(BL.ITEMS.splice(i, 1)[0]);
})();

// ---- MUSIC (assets/audio/music/, every graphics level) ----
// Played through <audio> elements with relative paths, so they work from file:// without being packed.
// clipStart / clipLen: the loudest, most hook-like ~12 s of each song (picked by loudness analysis), used for
// player anthems and short previews. Add songs by dropping an .mp3 in the folder and a line here.
window.BL.MUSIC = [
  { id: 'rock-it', name: 'Rock It', url: 'assets/audio/music/rock-it.mp3', clipStart: 92, clipLen: 12, dur: 191.3 },
  { id: 'fury', name: 'Fury', url: 'assets/audio/music/fury.mp3', clipStart: 110.75, clipLen: 12, dur: 244.1 },
  { id: 'heat-wave', name: 'Heat Wave', url: 'assets/audio/music/heat-wave.mp3', clipStart: 181.5, clipLen: 12, dur: 226.9 },
  { id: 'firework', name: 'Firework', url: 'assets/audio/music/firework.mp3', clipStart: 136.5, clipLen: 12, dur: 187.3 },
  { id: 'breathing-underwater', name: 'Breathing Underwater (Ether Remix)', url: 'assets/audio/music/breathing-underwater.mp3', clipStart: 95.5, clipLen: 12, dur: 277.7 },
  { id: 'luv-u-need-u', name: 'Luv U Need U', url: 'assets/audio/music/luv-u-need-u.mp3', clipStart: 38.25, clipLen: 12, dur: 146.7 },
  { id: 'walking-on-the-moon', name: 'Walking on the Moon (Bad Computer Remix)', url: 'assets/audio/music/walking-on-the-moon.mp3', clipStart: 141, clipLen: 12, dur: 189.2 },
  { id: 'rlcs-theme', name: 'RLCS Theme', url: 'assets/audio/music/rlcs-theme.mp3', clipStart: 42.75, clipLen: 12, dur: 75.8 },
  { id: 'throwback-anthem', name: 'Rocket League Throwback Anthem', url: 'assets/audio/music/throwback-anthem.mp3', clipStart: 73, clipLen: 12, dur: 98.8 },
  { id: 'slippy-flow', name: 'Slippy Flow', url: 'assets/audio/music/slippy-flow.mp3', clipStart: 6.5, clipLen: 12, dur: 26.1 },
  { id: 'shiawase', name: 'Shiawase', url: 'assets/audio/music/shiawase.mp3', clipStart: 14.25, clipLen: 12, dur: 30 },
  { id: 'everyone-dance', name: 'Everyone Dance', url: 'assets/audio/music/everyone-dance.mp3', clipStart: 7.5, clipLen: 12, dur: 30 },
  { id: 'angel-wings', name: 'Angel Wings', url: 'assets/audio/music/angel-wings.mp3', clipStart: 331.5, clipLen: 12, dur: 369.1 },
  { id: 'we-speak-chinese', name: 'We Speak Chinese', url: 'assets/audio/music/we-speak-chinese.mp3', clipStart: 161.75, clipLen: 12, dur: 280.1 },
  { id: 'love-thru-the-night', name: 'Love Thru the Night', url: 'assets/audio/music/love-thru-the-night.mp3', clipStart: 75, clipLen: 12, dur: 310 },
  { id: 'darkness', name: 'Darkness', url: 'assets/audio/music/darkness.mp3', clipStart: 219, clipLen: 12, dur: 453.1 },
  { id: 'flying-forever', name: 'Flying Forever', url: 'assets/audio/music/flying-forever.mp3', clipStart: 283.75, clipLen: 12, dur: 367 },
  { id: 'i-can-be', name: 'I Can Be', url: 'assets/audio/music/i-can-be.mp3', clipStart: 91.25, clipLen: 12, dur: 262 },
  { id: 'rock-it-vip', name: 'Rock It (VIP)', url: 'assets/audio/music/rock-it-vip.mp3', clipStart: 70.75, clipLen: 12, dur: 195.1 },
  { id: 'play', name: 'Play', url: 'assets/audio/music/play.mp3', clipStart: 32.75, clipLen: 12, dur: 184 },
  { id: 'stronger', name: 'Stronger', url: 'assets/audio/music/stronger.mp3', clipStart: 76.5, clipLen: 12, dur: 205.5 },
  { id: 'wygd', name: 'WYGD', url: 'assets/audio/music/wygd.mp3', clipStart: 104.25, clipLen: 12, dur: 148.8 },
  { id: 'rl-theme', name: 'Rocket League Theme', url: 'assets/audio/music/rl-theme.mp3', clipStart: 53, clipLen: 12, dur: 91.1 },
  { id: 'rl-theme-medley', name: 'Rocket League Theme Medley', url: 'assets/audio/music/rl-theme-medley.mp3', clipStart: 117.5, clipLen: 12, dur: 240.1 },
  { id: 'rl-theme-menu', name: 'Rocket League Theme (Menu)', url: 'assets/audio/music/rl-theme-menu.mp3', clipStart: 42.5, clipLen: 12, dur: 109 },
  { id: 'rl-theme-select', name: 'Rocket League Theme (Game Select)', url: 'assets/audio/music/rl-theme-select.mp3', clipStart: 32.25, clipLen: 12, dur: 82.1 },
  { id: 'sarpbc-theme', name: 'Battle-Cars Theme', url: 'assets/audio/music/sarpbc-theme.mp3', clipStart: 22, clipLen: 12, dur: 41 },
  { id: 'sarpbc-theme-accel', name: 'Battle-Cars Theme (Accelerato)', url: 'assets/audio/music/sarpbc-theme-accel.mp3', clipStart: 3.5, clipLen: 12, dur: 21.1 },
];

// ---- SOUND EFFECTS (assets/audio/sfx/, every graphics level) ----
// Only the window [start, start + len] of each file plays (the files carry silence / extra sound around it).
// js/embedded-sfx.js packs them for file:// pages (tools/pack-assets.html or tools/embed-models.py).
window.BL.SFX = {
  bounce: { url: 'assets/audio/sfx/bounce.mp3', start: 1.0, len: 0.45 }, // ball bounces and touches
  goal: { url: 'assets/audio/sfx/goal.mp3', start: 0.22, len: 1.15 }, // goal explosion
  countdown: { url: 'assets/audio/sfx/countdown.mp3', start: 0.16, len: 3.85 }, // 3-2-1-GO beeps, 1 s apart
  overtime: { url: 'assets/audio/sfx/overtime.mp3', start: 0.17, len: 9.5 }, // overtime sting
};

// ---- Rocket League sound pack (from the user's RocketLeague-Audio zip, converted to WAV so every browser plays it) ----
// The pack's files are only numbered; js/audio.js picks which play for what (and Settings -> Audio -> Sound Test can swap them).
Object.assign(window.BL.SFX, {
  rl_ballhit: { url: 'assets/audio/sfx/rl/ballhit.wav', start: 0, len: 1.3 },
  rl_boost_alt: { url: 'assets/audio/sfx/rl/boost_alt.wav', start: 0, len: 1.719 },
  rl_boost_loop: { url: 'assets/audio/sfx/rl/boost_loop.wav', start: 0, len: 1.741, loop: true },
  rl_boost_start: { url: 'assets/audio/sfx/rl/boost_start.wav', start: 0, len: 1.055 },
  rl_crowd_loop: { url: 'assets/audio/sfx/rl/crowd_loop.wav', start: 0, len: 28.5 },
  rl_demo: { url: 'assets/audio/sfx/rl/demo.wav', start: 0, len: 2.2 },
  rl_engine_high: { url: 'assets/audio/sfx/rl/engine_high.wav', start: 0, len: 1.517, loop: true },
  rl_engine_idle: { url: 'assets/audio/sfx/rl/engine_idle.wav', start: 0, len: 1.064, loop: true },
  rl_engine_low: { url: 'assets/audio/sfx/rl/engine_low.wav', start: 0, len: 1.637, loop: true },
  rl_engine_mid: { url: 'assets/audio/sfx/rl/engine_mid.wav', start: 0, len: 1.064, loop: true },
  rl_goal_boom: { url: 'assets/audio/sfx/rl/goal_boom.wav', start: 0, len: 4.5 },
  rl_goal_crowd: { url: 'assets/audio/sfx/rl/goal_crowd.wav', start: 0, len: 5.351 },
  rl_mv_01: { url: 'assets/audio/sfx/rl/mv_01.wav', start: 0, len: 1.1 },
  rl_mv_02: { url: 'assets/audio/sfx/rl/mv_02.wav', start: 0, len: 1.1 },
  rl_mv_03: { url: 'assets/audio/sfx/rl/mv_03.wav', start: 0, len: 1.1 },
  rl_mv_04: { url: 'assets/audio/sfx/rl/mv_04.wav', start: 0, len: 1.1 },
  rl_mv_05: { url: 'assets/audio/sfx/rl/mv_05.wav', start: 0, len: 1.1 },
  rl_mv_06: { url: 'assets/audio/sfx/rl/mv_06.wav', start: 0, len: 1.1 },
  rl_mv_07: { url: 'assets/audio/sfx/rl/mv_07.wav', start: 0, len: 1.1 },
  rl_mv_08: { url: 'assets/audio/sfx/rl/mv_08.wav', start: 0, len: 1.1 },
  rl_mv_09: { url: 'assets/audio/sfx/rl/mv_09.wav', start: 0, len: 1.1 },
  rl_mv_10: { url: 'assets/audio/sfx/rl/mv_10.wav', start: 0, len: 1.1 },
  rl_mv_11: { url: 'assets/audio/sfx/rl/mv_11.wav', start: 0, len: 1.1 },
  rl_mv_12: { url: 'assets/audio/sfx/rl/mv_12.wav', start: 0, len: 1.1 },
  rl_mv_13: { url: 'assets/audio/sfx/rl/mv_13.wav', start: 0, len: 1.1 },
  rl_mv_14: { url: 'assets/audio/sfx/rl/mv_14.wav', start: 0, len: 1.1 },
  rl_mv_15: { url: 'assets/audio/sfx/rl/mv_15.wav', start: 0, len: 1.1 },
  rl_mv_16: { url: 'assets/audio/sfx/rl/mv_16.wav', start: 0, len: 1.1 },
  rl_mv_17: { url: 'assets/audio/sfx/rl/mv_17.wav', start: 0, len: 1.1 },
  rl_mv_18: { url: 'assets/audio/sfx/rl/mv_18.wav', start: 0, len: 1.1 },
  rl_mv_19: { url: 'assets/audio/sfx/rl/mv_19.wav', start: 0, len: 1.1 },
  rl_mv_20: { url: 'assets/audio/sfx/rl/mv_20.wav', start: 0, len: 1.1 },
  rl_mv_21: { url: 'assets/audio/sfx/rl/mv_21.wav', start: 0, len: 1.1 },
  rl_mv_22: { url: 'assets/audio/sfx/rl/mv_22.wav', start: 0, len: 1.1 },
  rl_mv_23: { url: 'assets/audio/sfx/rl/mv_23.wav', start: 0, len: 1.1 },
  rl_mv_24: { url: 'assets/audio/sfx/rl/mv_24.wav', start: 0, len: 1.1 },
  rl_mv_25: { url: 'assets/audio/sfx/rl/mv_25.wav', start: 0, len: 1.1 },
  rl_pad_big: { url: 'assets/audio/sfx/rl/pad_big.wav', start: 0, len: 1.215 },
  rl_pad_small: { url: 'assets/audio/sfx/rl/pad_small.wav', start: 0, len: 0.761 },
  rl_rev_1: { url: 'assets/audio/sfx/rl/rev_1.wav', start: 0, len: 1.108 },
  rl_rev_2: { url: 'assets/audio/sfx/rl/rev_2.wav', start: 0, len: 1.177 },
  rl_stat: { url: 'assets/audio/sfx/rl/stat.wav', start: 0, len: 0.895 },
  rl_tire_roll: { url: 'assets/audio/sfx/rl/tire_roll.wav', start: 0, len: 3.053, loop: true },
  rl_tire_slide: { url: 'assets/audio/sfx/rl/tire_slide.wav', start: 0, len: 2.664, loop: true },
  rl_tire_squeal: { url: 'assets/audio/sfx/rl/tire_squeal.wav', start: 0, len: 3.925, loop: true },
  rl_ui_03: { url: 'assets/audio/sfx/rl/ui_03.wav', start: 0, len: 0.06 },
  rl_ui_06: { url: 'assets/audio/sfx/rl/ui_06.wav', start: 0, len: 0.279 },
  rl_ui_13: { url: 'assets/audio/sfx/rl/ui_13.wav', start: 0, len: 0.089 },
  rl_ui_29: { url: 'assets/audio/sfx/rl/ui_29.wav', start: 0, len: 0.725 },
  rl_ui_42: { url: 'assets/audio/sfx/rl/ui_42.wav', start: 0, len: 0.383 },
});

// ---- HIGH-QUALITY ASSETS (Medium & High graphics only) ----
// Drop files into the folders under assets/hq/ (each has a README.txt), then open tools/pack-assets.html
// and pick the game folder. Low and Very Low always keep the light built-in placeholders.
//   sky/            one 360-degree (2:1) sky picture
//   ground-outside/ a tiling texture for the land around the stadium (+ optional *normal* map)
//   field-grass/    a tiling grass texture for the pitch
//   sand/           a tiling sand texture for desert maps (+ optional *normal* map)
//   glass/          an environment photo (2:1) the arena glass reflects
//   people/         low-poly people models for the stands
//   boost/          flame.png / smoke.png / spark.png / fire.png particle sprites
//   scenery/        models placed around the outside of the stadium
(function () {
  const BL = window.BL;
  const HQ = BL.HQ = { files: (BL.ASSET_LIST && BL.ASSET_LIST.hq) || {}, enabled: false, state: 'off', cbs: [] };
  // called once at boot with the graphics tier; on file:// pages the packed copies load in the background
  HQ.start = function (on) {
    const cars = (BL.ASSET_LIST && BL.ASSET_LIST.customCars) || [];
    HQ.enabled = !!on && (cars.length > 0 || Object.keys(HQ.files).some((k) => HQ.files[k].length));
    if (!HQ.enabled) { HQ.state = 'off'; return; }
    if (location.protocol !== 'file:') { HQ.state = 'ready'; return; }
    HQ.state = 'loading';
    const ok = () => { HQ.state = BL.EMBED_HQ ? 'ready' : 'off'; const cbs = HQ.cbs; HQ.cbs = []; if (HQ.state === 'ready') cbs.forEach((f) => f()); };
    const bad = () => { HQ.state = 'off'; HQ.cbs = []; console.warn('[assets] js/embedded-hq.js missing: open tools/pack-assets.html'); };
    // (an updated copy loads it the way the update loader loads everything else: see tools/make-play.py)
    if (window.BL_BOOT && window.BL_BOOT.loadScript) { window.BL_BOOT.loadScript('js/embedded-hq.js', ok, bad); return; }
    const s = document.createElement('script');
    s.src = 'js/embedded-hq.js'; s.onload = ok; s.onerror = bad;
    document.head.appendChild(s);
  };
  // run cb once the high-quality files can be used (never, on Low / Very Low or with nothing dropped in)
  HQ.when = (cb) => { if (HQ.state === 'ready') cb(); else if (HQ.state === 'loading') HQ.cbs.push(cb); };
  HQ.list = (slot) => (HQ.enabled ? HQ.files[slot] || [] : []);
  HQ.url = (p) => (BL.EMBED_HQ && BL.EMBED_HQ[p]) || (BL.EMBED_CARS && BL.EMBED_CARS[p]) || (BL.EMBED_FX && BL.EMBED_FX[p]) || (BL.EMBED && BL.EMBED[p]) || p;
  // a custom car's own bundle (js/embedded-car-<folder>.js, see tools/embed-models.py): loaded the first time that
  // car is shown, on every page (the package leaves out the cars' original model files)
  const carLoads = {};
  HQ.car = function (url, cb) {
    const m = /^assets\/custom-cars\/([^/]+)\//.exec(url);
    if (!m || (BL.EMBED_CARS && BL.EMBED_CARS[url])) { cb(); return; }
    const k = m[1];
    if (carLoads[k]) { if (carLoads[k] === 'done') cb(); else carLoads[k].push(cb); return; }
    carLoads[k] = [cb];
    const done = () => { const list = carLoads[k]; carLoads[k] = 'done'; list.forEach((f) => f()); };
    const src = 'js/embedded-car-' + k + '.js';
    if (window.BL_BOOT && window.BL_BOOT.loadScript) { window.BL_BOOT.loadScript(src, done, done); return; }
    const s = document.createElement('script'); s.src = src; s.onload = done; s.onerror = done; document.head.appendChild(s);
  };
  // first image in a slot (skipping normal/roughness maps), and its matching normal map if there is one
  const IMG = /\.(jpe?g|png|webp)$/i, AUX = /(normal|_nor|nrm|rough|_ao|ambientocclusion|displace|height|_disp|metalness|metallic|opacity|_arm)/i;
  HQ.images = (slot) => HQ.list(slot).filter((p) => IMG.test(p) && !AUX.test(p.split('/').pop()));
  HQ.image = (slot) => HQ.images(slot)[0] || null;
  // a slot with several images: each map gets its own (key: a map id, or a number to hand them out in turn)
  HQ.imageFor = (slot, key) => { const l = HQ.images(slot); return l.length ? l[(typeof key === 'number' ? key : BL.util.hash(String(key)) >>> 0) % l.length] : null; };
  HQ.normal = (slot) => HQ.list(slot).find((p) => IMG.test(p) && /(normal|_nor|nrm)/i.test(p.split('/').pop()) && !/dx/i.test(p.split('/').pop())) || null;
  HQ.models = (slot) => HQ.list(slot).filter((p) => /\.(glb|gltf)$/i.test(p));
  // load an image slot as a texture (sRGB colour unless linear), calling back only if the arena is still alive
  HQ.texture = (path, H, cb, linear) => {
    new THREE.TextureLoader().load(HQ.url(path), (t) => {
      if (H && H.disposed) { t.dispose(); return; }
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (!linear && THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
      const r = BL.App && BL.App.renderer;
      if (r) t.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy());
      if (H) H.disposables.push(t);
      cb(t);
    }, undefined, () => console.warn('[assets] could not load', path));
  };
})();

// Built-in real models: Kenney Car Kit (CC0, www.kenney.nl) in assets/kenney-cars/.
// Every body item with a `model` field uses it; the team color is painted onto the model's main color.
(function () {
  const A = window.BL.ASSETS;
  const items = window.BL.ITEMS || [];
  for (const it of items) {
    if (it.cat === 'body' && it.model && !A.cars[it.id]) {
      A.cars[it.id] = { url: 'assets/kenney-cars/' + it.model + '.glb', autoPaint: true, modelWheels: true, preview: 'assets/kenney-cars/previews/' + it.model + '.png' };
    }
  }
})();
