'use strict';
// Rocket League (fan remake) - boot, renderer, quality / dynamic resolution, main loop
(function (BL) {
  const U = BL.util;
  const App = BL.App = { width: 1, height: 1, scale: 1 };

  function detectQuality() {
    const ua = navigator.userAgent || '';
    const cores = navigator.hardwareConcurrency || 4;
    // Safari and Firefox don't report memory: guess from the cores (Apple-silicon Macs report 8+)
    const mem = navigator.deviceMemory || (cores >= 8 ? 8 : 4);
    const chromebook = /CrOS/.test(ua);
    const mobile = /Android|iPhone|iPad|Mobile/.test(ua);
    if ((chromebook || mobile) && (cores <= 2 || mem <= 2)) return 'potato';
    if (chromebook || mobile || cores <= 4 || mem <= 4) return 'low';
    if (cores >= 8 && mem >= 8) return 'high';
    return 'medium';
  }

  App.init = function () {
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    BL.Save.load();
    const s = BL.Save.p.settings;
    App.autoQuality = s.quality === 'auto';
    let tier = App.autoQuality ? (s.autoTier || detectQuality()) : s.quality;
    // 'potato' = Very Low for old Chromebooks: everything Low does, plus lighter scenery, crowd and resolution
    App.potato = tier === 'potato';
    App.quality = App.potato ? 'low' : tier;
    App.vsync = s.vsync !== false;
    // downloaded high-quality assets only on Medium / High; Low and Very Low keep the placeholders
    BL.HQ.start(App.quality === 'medium' || App.quality === 'high');
    const canvas = document.getElementById('game');
    let renderer;
    try {
      // (no low-latency "desynchronized" canvas for VSync off: on Windows / AMD it tore and flickered, worse with
      // Medium / High's multi-pass picture)
      renderer = new THREE.WebGLRenderer({ canvas, antialias: App.quality === 'high', powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      document.getElementById('boot').innerHTML = '<h2>WebGL is not available</h2><p>Your browser or device could not start 3D graphics. Try Chrome with hardware acceleration enabled.</p>';
      return;
    }
    App.renderer = renderer;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = App.quality === 'low' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = App.quality === 'high';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    App.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2400);
    // Low (Chromebook) renders a bit under native resolution; Auto also lowers it further if FPS drops
    App.baseRatio = Math.min(window.devicePixelRatio || 1, App.quality === 'high' ? 1.75 : App.quality === 'medium' ? 1.25 : App.potato ? 0.65 : 0.85);
    App.dyn = 1;
    window.addEventListener('resize', App.resize);
    App.resize();

    BL.Input.init(canvas);
    BL.HUD.init();
    BL.FX.init(App.quality);
    BL.Garage.init();
    BL.Menu.init();
    BL.Menu.show(BL.Menu.titleScreen ? 'title' : 'main');
    // e.g. "you left your last match, so it counted as a forfeit"
    if (BL.Save.p.notice) { BL.Menu.toast(BL.Save.p.notice); delete BL.Save.p.notice; BL.Save.save(); }
    App.backgroundTicker();
    // the AUTHENTICATING wheel stays up (behind the opening cards) until the game is ready; on Medium / High it also
    // waits for the downloaded assets (8 s at most)
    const boot = document.getElementById('boot');
    const hideBoot = () => { if (boot && !boot.classList.contains('gone')) { boot.classList.add('gone'); setTimeout(() => boot.remove(), 600); } };
    let bootReady = false;
    const bootGo = () => { if (bootReady) return; bootReady = true; if (BL.Intro) BL.Intro.when(hideBoot); else hideBoot(); };
    if (BL.HQ && BL.HQ.state === 'loading') { BL.HQ.when(bootGo); setTimeout(bootGo, 8000); } else bootGo();
    // your goal explosion's 3D model, if it has one
    { const ex = BL.Save.resolveLoadout().explosion, def = ex && BL.ITEM_BY_ID[ex.id]; if (def) BL.FX.needModel(def.fx); }
    App.fpsEl = document.getElementById('fps');
    App.last = performance.now();
    App.frames = 0; App.fpsT = 0; App.slowT = 0;
    App.started = true; // (the update loader's sign that this build's code works)
    if (App.vsync === false) App.unsynced(); else requestAnimationFrame(App.frame);
  };

  App.resize = function () {
    App.width = window.innerWidth; App.height = window.innerHeight;
    App.camera.aspect = App.width / App.height;
    App.applyResolution();
    App.setFov(App.hfov || 100, true, App.fovRL);
  };

  App.applyResolution = function () {
    const s = BL.Save.p.settings;
    const r = App.baseRatio * (s.resScale || 1) * App.dyn;
    App.renderer.setPixelRatio(Math.max(0.35, r));
    App.renderer.setSize(App.width, App.height, false);
    if (BL.FX.add) BL.FX.setScale(App.camera, App.renderer.domElement.height);
  };

  // horizontal FOV in degrees (like the real game's camera setting)
  // rl: the match camera's FOV works like the real game's, measured across a 4:3 picture (FOV 110 is about 94
  // degrees top to bottom on any widescreen: wider screens see more at the sides, not a zoomed-in middle). The
  // menus' framing (rl off) is across the actual screen.
  App.vfovFor = function (hfov, aspect, rl) {
    const a = rl ? Math.min(aspect, 4 / 3) : aspect;
    return U.clamp(2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / a) * 180 / Math.PI, 40, 100);
  };
  App.setFov = function (hfov, force, rl) {
    if (!force && Math.abs((App.hfov || 0) - hfov) < 0.05 && App.fovRL === !!rl) return;
    App.hfov = hfov; App.fovRL = !!rl;
    const aspect = Math.max(0.5, App.width / App.height);
    let v = App.vfovFor(hfov, aspect, rl);
    App.camera.fov = v;
    App.camera.updateProjectionMatrix();
    if (BL.FX.add) BL.FX.setScale(App.camera, App.renderer.domElement.height);
  };

  function envScene(top, bottom, ground, panels) {
    const sc = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) }, ground: { value: new THREE.Color(ground) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 ground; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0.0 ? mix(bottom, top, smoothstep(0.0, 0.7, h)) : mix(bottom, ground, smoothstep(0.0, -0.25, h)); gl_FragColor = vec4(c, 1.0); }',
    });
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
    const pm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    for (const p of panels) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), pm);
      m.position.set(p[0], p[1], p[2]);
      m.lookAt(0, 0, 0);
      sc.add(m);
    }
    return sc;
  }
  function bake(sc) {
    const pm = new THREE.PMREMGenerator(App.renderer);
    const rt = pm.fromScene(sc, 0.03);
    pm.dispose();
    sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return rt.texture;
  }
  App.makeEnvMap = function (top, bottom, ground) {
    return bake(envScene(top, bottom, ground, [[0, 40, 0, 30, 30], [30, 20, 20, 14, 6], [-30, 20, -20, 14, 6], [25, 18, -25, 10, 4], [-25, 18, 25, 10, 4]]));
  };
  App.makeStudioEnv = function () {
    return bake(envScene('#2a3550', '#121826', '#0a0d16', [[0, 30, 0, 20, 20], [28, 12, 10, 8, 16], [-28, 12, -10, 8, 16], [0, 10, -30, 24, 4], [10, 5, 30, 18, 3]]));
  };

  App.startMatch = function (cfg) {
    if (BL.game) App.endGame();
    BL.bus.emit('match:start');
    if (App.autoQuality && BL.Save.p.settings.autoTier === 'potato' && !App.potato) {
      App.potato = true; App.quality = 'low'; App.baseRatio = Math.min(window.devicePixelRatio || 1, 0.65); App.applyResolution(); BL.FX.init('low');
    }
    BL.Menu.postShown = false;
    BL.Menu.closeOverlay();
    BL.Audio.unlock();
    BL.Menu.showLoading(cfg);
    const t0 = performance.now();
    // let the loading screen paint before the heavy build
    setTimeout(() => {
      BL.Menu.hide();
      BL.Garage.hide();
      let game;
      try {
        game = BL.game = new BL.Game(cfg);
        game.holdSim = true;
      } catch (e) {
        console.error(e);
        BL.game = null;
        BL.Menu.hideLoading();
        BL.Menu.show('main');
        BL.Menu.toast('Could not start the match: ' + e.message);
        return;
      }
      const wait = Math.max(0, 1800 - (performance.now() - t0));
      setTimeout(() => {
        if (BL.game !== game) return;
        game.holdSim = false;
        if (!game.online && game.phase === 'countdown') { game.phaseT = 3 + (game.introLen || 0); game.lastCount = 4; }
        if (game.isClient) BL.Net.sendToHost({ t: 'loaded' });
        BL.Menu.hideLoading();
      }, wait);
    }, 60);
  };

  App.endGame = function () {
    if (!BL.game) return;
    BL.game.dispose();
    BL.game = null;
    BL.Garage.show();
  };

  // Browsers stop requestAnimationFrame in hidden tabs. A tiny worker timer keeps the match (bots, clock,
  // the online host) running while you're on another tab; nothing is drawn until you come back.
  App.backgroundTicker = function () {
    let worker = null, timer = 0;
    try {
      const src = 'let id=0;onmessage=(e)=>{clearInterval(id);if(e.data)id=setInterval(()=>postMessage(0),16);};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = () => { if (document.hidden) App.step(performance.now(), false); };
      // a browser that refuses blob workers on file:// pages (Safari can) falls back to the plain timer
      worker.onerror = () => { worker = null; };
    } catch (e) { worker = null; }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        BL.Input.releaseAll && BL.Input.releaseAll(); // keys held when you switched away would stay stuck
        if (worker) worker.postMessage(1); else timer = setInterval(() => App.step(performance.now(), false), 16);
      } else {
        if (worker) worker.postMessage(0);
        clearInterval(timer);
      }
    });
  };

  // VSync on (the default): one frame per screen refresh, in step with the display
  App.frame = function (now) {
    requestAnimationFrame(App.frame);
    if (!document.hidden) App.step(now, true);
  };
  // VSync off: the picture still comes once per screen refresh (drawing frames out of step with the screen tore and
  // stuttered), but the game itself, your controls and the physics, also runs between frames, every ~4 ms, so
  // what you press reaches the car sooner. Hidden tabs are left to the background ticker.
  App.unsynced = function () {
    const loop = () => {
      setTimeout(loop, document.hidden ? 250 : 4);
      if (!document.hidden) App.step(performance.now(), false);
    };
    loop();
    requestAnimationFrame(App.frame);
  };

  App.step = function (now, draw) {
    let dt = (now - App.last) / 1000;
    App.last = now;
    if (dt > 0.25) dt = 0.25;
    if (dt < 0) dt = 0;
    BL.Input.update();
    const g = BL.game;
    // fps + dynamic resolution (applied before drawing: resizing clears the canvas)
    if (draw) App.frames++;
    App.fpsT += dt;
    if (App.fpsT >= 2) {
      const fps = App.frames / App.fpsT;
      App.frames = 0; App.fpsT = 0;
      const s = BL.Save.p.settings;
      if (App.fpsEl) { App.fpsEl.textContent = Math.round(fps) + ' FPS • ' + App.quality.toUpperCase() + ' • ' + Math.round(App.renderer.getPixelRatio() * 100) + '%'; App.fpsEl.classList.toggle('hidden', !s.showFps); }
      App.dynCool = (App.dynCool || 0) - 1;
      if (App.autoQuality && g && !App.potato && !document.hidden) {
        App.slowSecs = fps < 28 ? (App.slowSecs || 0) + 2 : 0;
        if (App.slowSecs >= 8) { s.autoTier = 'potato'; BL.Save.save(); App.slowSecs = -999; BL.Menu.toast('Switching to Very Low graphics for smoother play (from next match).'); }
      }
      if (App.autoQuality && g && !document.hidden && App.dynCool <= 0) {
        if (fps < 40 && App.dyn > 0.6) { App.dyn = Math.max(0.6, App.dyn - 0.15); App.dynCool = 3; App.dynDown = (App.dynDown || 0) + 1; App.applyResolution(); }
        else if (fps > 59 && App.dyn < 1 && (App.dynDown || 0) < 3) { App.dyn = Math.min(1, App.dyn + 0.1); App.dynCool = 5; App.applyResolution(); }
      }
    }
    if (g) {
      g.update(dt);
      // Medium / High: drawn through the finishing pass (js/post.js); splitscreen draws straight to the screen
      if (draw) { if (BL.Post && !g.view2) BL.Post.render(App.renderer, () => g.draw(App.renderer, App.camera)); else g.draw(App.renderer, App.camera); }
    } else if (draw) {
      BL.Garage.update(dt);
      App.renderer.render(BL.Garage.scene, App.camera);
    }
  };

  window.addEventListener('load', () => {
    if (typeof THREE === 'undefined') {
      document.getElementById('boot').innerHTML = '<h2>Could not load the 3D engine</h2><p>Rocket League needs an internet connection the first time it loads (it downloads three.js from a CDN). Check your connection and refresh.</p>';
      return;
    }
    App.init();
  });
})(window.BL);
