'use strict';
// Rocket League (fan remake) - updates, by hand only.
// A copy always runs the files in its own folder: nothing is checked or installed by itself (running the newest code
// straight from GitHub made Chromebooks lag and fall back to the folder's older version). Settings > Updates has
// UPDATE ZIP FROM GITHUB, which downloads the newest version as a zip and keeps it in this browser's storage (no file
// yet), DOWNLOAD TO THIS COMPUTER, which saves that stored zip to Downloads (to unzip in place of the old folder)
// whenever you want, and CHECK FOR UPDATES, which only says whether GitHub has a newer version. A copy built by tools/make-play.py knows
// its build number (window.BL_BOOT, set by the small loader in its index.html); the project folder has none.
(function () {
  const BL = window.BL;
  const boot = window.BL_BOOT;
  const UP = BL.Update = { state: 'off', build: boot ? boot.build : 0, local: boot ? boot.local : 0, url: (boot && boot.url) || '', remote: !!(boot && boot.remote), from: boot && boot.src ? boot.src.name : '', latest: null };
  const SOURCES = (boot && boot.sources) || [];
  UP.when = (b) => (b ? new Date(b * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date(b * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
  // one source's version.json (10 s at most)
  const fetchVersion = (src) => {
    const ctl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 10000);
    return fetch(src.url + 'version.json?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((m) => {
        clearTimeout(timer);
        if (!m || !(m.build > 0) || !Array.isArray(m.items) || !Array.isArray(m.css)) throw new Error('bad version file');
        m.src = src.name; m.url = src.url;
        return m;
      }, (e) => { clearTimeout(timer); throw e; });
  };

  // ---- the newest version as RocketLeague-Play.zip, built right here ----
  // The file list comes from the online version.json (every file in the package); each file is fetched from
  // GitHub Pages or, if that's blocked, the raw files, then packed into a standard zip (stored, no compression:
  // most of it is already compressed). The zip is kept in this browser (IndexedDB) until DOWNLOAD TO THIS COMPUTER
  // saves it to Downloads. Unzip it anywhere: that copy works offline for good.
  // (The project folder copy has no update sources of its own, so it uses the published address.)
  const zipDB = () => new Promise((ok) => {
    try {
      const rq = indexedDB.open('bl-update-zip', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('z');
      rq.onsuccess = () => ok(rq.result);
      rq.onerror = rq.onblocked = () => ok(null);
    } catch (e) { ok(null); }
  });
  const zipReq = (mode, fn) => zipDB().then((db) => db && new Promise((ok) => {
    try {
      const tx = db.transaction('z', mode), r = fn(tx.objectStore('z'));
      if (mode === 'readwrite') { tx.oncomplete = () => ok(true); tx.onerror = tx.onabort = () => ok(false); } else { r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }
    } catch (e) { ok(null); }
  }));
  // what's stored (build, file name, size, when) without loading the zip itself; UP.stored mirrors it for the menus
  UP.stored = null;
  UP.loadStored = () => zipReq('readonly', (s) => s.get('meta')).then((m) => { UP.stored = m || null; return UP.stored; });
  UP.saveStored = async function () {
    const meta = UP.stored || await UP.loadStored(), blob = meta && await zipReq('readonly', (s) => s.get('blob'));
    if (!blob) return null;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = meta.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    return meta.name;
  };
  UP.deleteStored = () => zipReq('readwrite', (s) => { s.delete('blob'); return s.delete('meta'); }).then(() => { UP.stored = null; });
  UP.loadStored().then(() => { if (UP.stored && BL.bus && BL.bus.emit) BL.bus.emit('update', UP.state); });
  const ZIP_SOURCES = SOURCES.length ? SOURCES : [{ name: 'pages', url: 'https://dandan4-max.github.io/rocket-league/' }, { name: 'raw', url: 'https://raw.githubusercontent.com/dandan4-max/rocket-league/main/' }];
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  UP.zipping = null;
  UP.downloadZip = async function (onProgress) {
    if (UP.zipping) return;
    UP.zipping = { done: 0, total: 0 };
    const say = (msg) => { if (onProgress) onProgress(msg, UP.zipping); };
    try {
      say('Finding the newest version...');
      let m = null, i = 0;
      while (!m && i < ZIP_SOURCES.length) { try { m = await fetchVersion(ZIP_SOURCES[i]); } catch (e) { m = null; } i++; }
      if (!m || !Array.isArray(m.files)) throw new Error(m ? 'This version can\u2019t be downloaded as a zip yet.' : 'Couldn\u2019t reach the update server. Check your internet.');
      const files = m.files.map((f) => f[0]);
      UP.zipping.total = files.length;
      const enc = new TextEncoder(), parts = [], central = [];
      let offset = 0;
      const d = new Date(m.build * 1000);
      const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
      for (const path of files) {
        let data;
        for (let tries = 0; ; tries++) {
          try {
            const r = await fetch(m.url + path.split('/').map(encodeURIComponent).join('/') + (path === 'version.json' ? '?t=' + Date.now() : ''), { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            data = new Uint8Array(await r.arrayBuffer());
            break;
          } catch (e) { if (tries >= 2) throw new Error('Couldn\u2019t download ' + path); }
        }
        const name = enc.encode('RocketLeague-Play/' + path), crc = crc32(data);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
        h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
        h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
        parts.push(h.buffer, name, data);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
        c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
        c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
        c.setUint32(42, offset, true);
        central.push(c.buffer, name);
        offset += 30 + name.length + data.length;
        UP.zipping.done++;
        say('Downloading ' + UP.zipping.done + ' / ' + files.length + ' files...');
      }
      const cdSize = central.reduce((n, b) => n + (b.byteLength || b.length), 0);
      const e = new DataView(new ArrayBuffer(22));
      e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
      e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
      const blob = new Blob(parts.concat(central, [e.buffer]), { type: 'application/zip' });
      const name = 'RocketLeague-Play-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.zip';
      // kept in this browser (it replaces any older stored zip); DOWNLOAD TO THIS COMPUTER saves it as a file
      say('Storing it in this browser...');
      const meta = { build: m.build, name, size: blob.size, when: Date.now() };
      await zipReq('readwrite', (s) => s.delete('blob'));
      const ok = await zipReq('readwrite', (s) => { s.put(blob, 'blob'); return s.put(meta, 'meta'); });
      UP.zipping = null;
      if (!ok) throw new Error('This browser has no room to keep it (try freeing some space).');
      UP.stored = meta;
      say('Stored the ' + UP.when(m.build) + ' version in this browser (' + Math.round(blob.size / 1e6) + ' MB). Press DOWNLOAD TO THIS COMPUTER to save the zip.');
      return name;
    } catch (err) {
      UP.zipping = null;
      say(err.message || 'The download failed.');
      return null;
    }
  };
  // CHECK FOR UPDATES (only when pressed): is there a newer version on GitHub than this copy? Nothing is installed.
  UP.state = boot ? 'idle' : 'off';
  UP.check = function (cb) {
    if (UP.state === 'checking') return;
    const was = UP.state;
    UP.state = 'checking'; emit();
    let i = 0;
    const tryNext = () => (i < ZIP_SOURCES.length ? fetchVersion(ZIP_SOURCES[i++]).catch(tryNext) : Promise.reject(new Error('offline')));
    tryNext()
      .then((m) => { UP.latest = m.build; UP.state = !boot ? was : m.build > UP.build ? 'newer' : 'current'; })
      .catch(() => { UP.state = boot ? 'offline' : was; })
      .then(() => { emit(); if (cb) cb(UP.state); });
  };
  function emit() { if (BL.bus && BL.bus.emit) BL.bus.emit('update', UP.state); }
  // Copies from before updates went manual remember a newer online build ('bl_update') and run its code from GitHub.
  // A copy running its own folder drops that for good. One that is running the online code keeps it (its folder's
  // older code would only switch straight back) and says once how to get this version onto the computer.
  try { if (!UP.remote) localStorage.removeItem('bl_update'); } catch (e) { /* storage off */ }
  if (UP.remote) {
    UP.needZip = true;
    let told = null;
    try { told = sessionStorage.getItem('bl_zip_told'); sessionStorage.setItem('bl_zip_told', '1'); } catch (e) { told = '1'; }
    if (!told) setTimeout(() => { if (BL.Menu && BL.Menu.toast) BL.Menu.toast('Updates are by hand now: Settings > Updates > UPDATE ZIP FROM GITHUB puts this version on your computer'); }, 5000);
  }
})();
