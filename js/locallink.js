'use strict';
// Rocket League (fan remake) - Local Link: party up with a friend next to you with no internet.
// The two devices talk over a direct WebRTC data channel on the same Wi-Fi or phone hotspot (the network doesn't
// need internet). There's no server to introduce them, so they swap two short codes instead: the host shows an
// invite (QR code + text), the friend scans or types it and shows a reply, the host scans or types that. After
// that the link behaves exactly like an online party connection (BL.Net), so parties, chat and matches all work.
(function (BL) {
  const LL = BL.LocalLink = {};
  LL.supported = () => typeof RTCPeerConnection !== 'undefined';
  LL.canScan = () => typeof window.BarcodeDetector !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // ---- compact codes: just the ICE credentials, DTLS fingerprint and LAN candidates, in base32 ----
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function b32enc(bytes) {
    let out = '', buf = 0, n = 0;
    for (const b of bytes) { buf = (buf << 8) | b; n += 8; while (n >= 5) { out += B32[(buf >>> (n - 5)) & 31]; n -= 5; } buf &= 0xff; }
    if (n > 0) out += B32[(buf << (5 - n)) & 31];
    return out;
  }
  function b32dec(str) {
    const out = []; let buf = 0, n = 0;
    for (const ch of str.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')) {
      const v = B32.indexOf(ch); if (v < 0) continue;
      buf = (buf << 5) | v; n += 5;
      if (n >= 8) { out.push((buf >>> (n - 8)) & 0xff); n -= 8; buf &= 0xff; }
    }
    return out;
  }
  const strBytes = (s) => Array.from(new TextEncoder().encode(s));
  function pack(kind, id, sdp) {
    const get = (re) => { const m = sdp.match(re); return m ? m[1].trim() : ''; };
    const ufrag = get(/a=ice-ufrag:(.+)/), pwd = get(/a=ice-pwd:(.+)/);
    const fp = get(/a=fingerprint:sha-256 (.+)/).split(':').map((h) => parseInt(h, 16));
    if (fp.length !== 32) throw new Error('This browser gave an unexpected connection fingerprint.');
    const cands = [];
    for (const line of sdp.split(/\r?\n/)) {
      const m = line.match(/^a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/i);
      if (!m || cands.length >= 3) continue;
      const addr = m[1], port = +m[2];
      let enc = null;
      if (/^\d+\.\d+\.\d+\.\d+$/.test(addr)) enc = [4].concat(addr.split('.').map(Number));
      else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.local$/i.test(addr)) enc = [16].concat(addr.slice(0, 36).replace(/-/g, '').match(/../g).map((h) => parseInt(h, 16)));
      if (enc && !cands.some((c) => c.join() === enc.concat([port >> 8, port & 255]).join())) cands.push(enc.concat([port >> 8, port & 255]));
    }
    if (!cands.length) throw new Error('No local network found. Connect both devices to the same Wi-Fi or phone hotspot (it does not need internet).');
    const u = strBytes(ufrag), p = strBytes(pwd);
    const bytes = [kind === 'O' ? 1 : 2, id >> 8, id & 255, u.length].concat(u, [p.length], p, fp, [cands.length], ...cands);
    return 'RLL1' + b32enc(bytes);
  }
  function unpack(code) {
    const raw = String(code || '').trim().replace(/^RLL1/i, '');
    const b = b32dec(raw);
    let i = 0;
    const take = (n) => { const s = b.slice(i, i + n); i += n; if (s.length < n) throw new Error('That code is incomplete. Check it and try again.'); return s; };
    const dec = (arr) => new TextDecoder().decode(new Uint8Array(arr));
    const k = take(1)[0];
    if (k !== 1 && k !== 2) throw new Error('That is not a Local Link code.');
    const idb = take(2), id = (idb[0] << 8) | idb[1];
    const ufrag = dec(take(take(1)[0])), pwd = dec(take(take(1)[0]));
    const fp = take(32).map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(':');
    const n = take(1)[0], cands = [];
    for (let c = 0; c < n; c++) {
      const t = take(1)[0];
      let addr;
      if (t === 4) addr = take(4).join('.');
      else if (t === 16) { const h = take(16).map((x) => x.toString(16).padStart(2, '0')).join(''); addr = h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20) + '.local'; }
      else throw new Error('That code is damaged.');
      const pb = take(2);
      cands.push([addr, (pb[0] << 8) | pb[1]]);
    }
    return { kind: k === 1 ? 'O' : 'A', id, ufrag, pwd, fp, cands };
  }
  function buildSdp(o, setup) {
    const L = ['v=0', 'o=- ' + (1e15 + o.id) + ' 2 IN IP4 127.0.0.1', 's=-', 't=0 0', 'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', 'a=ice-ufrag:' + o.ufrag, 'a=ice-pwd:' + o.pwd,
      'a=fingerprint:sha-256 ' + o.fp, 'a=setup:' + setup, 'a=mid:0', 'a=sctp-port:5000', 'a=max-message-size:262144'];
    o.cands.forEach((c, i) => L.push('a=candidate:' + (i + 1) + ' 1 udp ' + (2122260223 - i) + ' ' + c[0] + ' ' + c[1] + ' typ host generation 0'));
    L.push('a=end-of-candidates');
    return L.join('\r\n') + '\r\n';
  }
  const newPC = () => new RTCPeerConnection({ iceServers: [] });
  function gathered(pc) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') { res(); return; }
      const t = setTimeout(res, 3500);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }
  // a data channel dressed up like a PeerJS DataConnection, which is what BL.Net speaks
  function conn(pc, dcPromise, peer) {
    const h = {}, fire = (ev, a) => (h[ev] || []).slice().forEach((f) => f(a));
    let dc = null;
    const c = {
      peer, open: false, peerConnection: pc,
      on(ev, fn) { (h[ev] = h[ev] || []).push(fn); return c; },
      send(m) { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(m)); },
      close() { try { if (dc) dc.close(); pc.close(); } catch (e) { /* closed */ } },
    };
    Promise.resolve(dcPromise).then((ch) => {
      dc = ch;
      const opened = () => { if (!c.open) { c.open = true; fire('open'); } };
      dc.onopen = opened;
      dc.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } fire('data', m); };
      dc.onclose = () => { if (c.open) { c.open = false; fire('close'); } };
      dc.onerror = () => fire('error');
      if (dc.readyState === 'open') opened();
    });
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed') { fire('error'); if (c.open) { c.open = false; fire('close'); } } });
    return c;
  }

  // host: an invite for one more player. accept(replyCode) connects them.
  LL.invite = async function () {
    const pc = newPC(), dc = pc.createDataChannel('rl', { ordered: true });
    const id = (Math.random() * 65536) | 0;
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const code = pack('O', id, pc.localDescription.sdp);
    return {
      code,
      accept: async (reply) => {
        const a = unpack(reply);
        if (a.kind !== 'A') throw new Error('That is an invite code: scan your friend\'s REPLY code instead.');
        if (a.id !== id) throw new Error('That reply belongs to a different invite. Ask your friend to scan this invite again.');
        await pc.setRemoteDescription({ type: 'answer', sdp: buildSdp(a, 'active') });
        return conn(pc, dc, 'LL' + id.toString(36) + Math.random().toString(36).slice(2, 6));
      },
      cancel: () => { try { pc.close(); } catch (e) { /* closed */ } },
    };
  };
  // friend: the reply code for a host's invite, and the connection (it opens once the host enters the reply)
  LL.reply = async function (invite) {
    const o = unpack(invite);
    if (o.kind !== 'O') throw new Error('That is a reply code: scan the HOST\'s invite instead.');
    const pc = newPC();
    const dc = new Promise((res) => { pc.ondatachannel = (e) => res(e.channel); });
    await pc.setRemoteDescription({ type: 'offer', sdp: buildSdp(o, 'actpass') });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    return { code: pack('A', o.id, pc.localDescription.sdp), conn: conn(pc, dc, 'host'), cancel: () => { try { pc.close(); } catch (e) { /* closed */ } } };
  };

  // camera QR scanning where the browser has a barcode reader (Chrome on Chromebooks, Android and Macs)
  LL.scan = async function (video, onCode) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true;
    await video.play();
    const det = new window.BarcodeDetector({ formats: ['qr_code'] });
    let stopped = false;
    const stop = () => { stopped = true; stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
    const tick = async () => {
      if (stopped) return;
      try {
        const hits = await det.detect(video);
        const hit = hits.find((x) => /^RLL1/i.test(x.rawValue || ''));
        if (hit) { stop(); onCode(hit.rawValue); return; }
      } catch (e) { /* frame not ready */ }
      setTimeout(tick, 220);
    };
    tick();
    return stop;
  };
  // readable groups for typing: RLL1 ABCD EFGH ...
  LL.pretty = (code) => 'RLL1 ' + (code.replace(/^RLL1/, '').match(/.{1,4}/g) || []).join(' ');
  LL._test = { pack, unpack, buildSdp, b32enc, b32dec };
})(window.BL);
