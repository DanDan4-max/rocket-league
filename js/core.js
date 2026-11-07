'use strict';
// Rocket League (fan remake) - core namespace + helpers
window.BL = window.BL || {};
(function (BL) {
  BL.VERSION = '1.0.0';
  BL.NET_PREFIX = 'boostleague-v1-';

  const U = BL.util = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.choice = (arr, rnd) => arr[Math.floor((rnd ? rnd() : Math.random()) * arr.length)];
  U.sign = (v) => (v < 0 ? -1 : 1);
  U.smoothstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  U.piecewise = (pts, x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const a = pts[i - 1], b = pts[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return pts[pts.length - 1][1];
  };
  U.hash = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.rng = (seed) => {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.weightedPick = (pairs, rnd) => {
    let total = 0;
    for (const p of pairs) total += p[1];
    let r = (rnd ? rnd() : Math.random()) * total;
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };
  U.fmtClock = (t, countUp) => {
    t = Math.max(0, t);
    const s = countUp ? Math.floor(t) : Math.ceil(t);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  U.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; };
  U.shade = (hex, amt) => {
    const c = new THREE.Color(hex);
    if (amt >= 0) c.lerp(new THREE.Color(1, 1, 1), amt); else c.lerp(new THREE.Color(0, 0, 0), -amt);
    return '#' + c.getHexString();
  };
  U.hexA = (hex, a) => {
    const c = new THREE.Color(hex);
    return 'rgba(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ',' + a + ')';
  };
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.code = (n) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  U.dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  // Tiny event bus
  BL.bus = {
    _h: {},
    on(e, f) { (this._h[e] = this._h[e] || []).push(f); return f; },
    off(e, f) { const a = this._h[e]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
    emit(e, a, b, c) { const l = this._h[e]; if (l) for (const f of l.slice()) f(a, b, c); },
  };

  // Build a quaternion from a forward + up direction (car local: +Z forward, +Y up, +X left)
  const _m4 = new THREE.Matrix4(), _l = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3();
  U.basisQuat = (fwd, up, out) => {
    _u.copy(up).normalize();
    _l.crossVectors(_u, fwd);
    if (_l.lengthSq() < 1e-8) { _l.set(1, 0, 0); }
    _l.normalize();
    _f.crossVectors(_l, _u).normalize();
    _m4.makeBasis(_l, _u, _f);
    return out.setFromRotationMatrix(_m4);
  };
})(window.BL);
