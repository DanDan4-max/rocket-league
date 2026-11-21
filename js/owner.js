'use strict';
// Rocket League (fan remake) - the game's owner. The name DanDan4.0 is the owner's alone: a device becomes the owner's
// by entering the owner code once (Settings -> Account -> OWNER). The game only carries the code's SHA-256, so the code
// itself is in none of the published files (the owner keeps it in OWNER-CODE.txt, which is never packaged), and it
// isn't sent with account syncs or written into backup files. Anyone else trying to take the name (in any spelling:
// case, spaces, dots and look-alike digits don't count) is refused. The owner can unlock any item, top up credits
// and gift any item to a friend (js/trade.js).
(function (BL) {
  const S = BL.Save;
  const O = BL.Owner = { NAME: 'DanDan4.0' };
  const HASH = 'b50dbdef90d9e02b3408ca253bcfdf689338f651ac16a08ea1a92125254d8380';
  // tiny SHA-256 (hex): the same answer as crypto.subtle, but it also works on file:// pages and older browsers
  function sha256(str) {
    const P = [], K = new Uint32Array(64), H = new Uint32Array(8);
    for (let n = 2; P.length < 64; n++) if (P.every((p) => n % p)) P.push(n);
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) >>> 0;
    for (let i = 0; i < 64; i++) K[i] = frac(Math.cbrt(P[i]));
    for (let i = 0; i < 8; i++) H[i] = frac(Math.sqrt(P[i]));
    const b = new TextEncoder().encode(str), l = b.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n);
    m.set(b); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 536870912));
    const w = new Uint32Array(64), ror = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const x = w[i - 15], y = w[i - 2]; w[i] = (w[i - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + w[i - 7] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10))) | 0; }
      let a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
  }
  const norm = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let lastCode = null, lastOk = false;
  O.codeOk = (code) => { const n = norm(code); if (n !== lastCode) { lastCode = n; lastOk = n.length >= 12 && sha256(n) === HASH; } return lastOk; };
  O.is = () => !!(S.p && O.codeOk(S.p.ownerCode));
  const key = (n) => String(n || '').toLowerCase().replace(/[\s._\-]+/g, '').replace(/0/g, 'o').replace(/[1i|]/g, 'l').replace(/4/g, 'a').replace(/3/g, 'e').replace(/5/g, 's');
  const OWN = key(O.NAME);
  O.reserved = (name) => key(name) === OWN;
  O.claim = function (code) {
    if (!O.codeOk(code)) return false;
    S.p.ownerCode = norm(code); S.p.name = O.NAME; S.save();
    if (BL.Net && BL.Net.sendProfile) BL.Net.sendProfile();
    return true;
  };
  O.forget = function () { delete S.p.ownerCode; if (O.reserved(S.p.name)) S.p.name = 'Player' + BL.util.randInt(100, 999); S.save(); };
  // one of every item you don't have yet, songs and Rocket Pass items included
  O.unlockAll = function () {
    if (!O.is()) return 0;
    let n = 0;
    for (const it of BL.ITEMS) if (!S.owns(it.id)) { S.addItem(it.id, null, null, true).isNew = false; n++; }
    S.save();
    return n;
  };
  O.unlock = (id, paint) => (O.is() && BL.ITEM_BY_ID[id] ? S.addItem(id, paint || null, null) : null);
  O.credits = (n) => { if (O.is()) { S.p.credits += n; S.save(); } };
})(window.BL);
