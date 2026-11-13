'use strict';
// Rocket League (fan remake) - the opening: two black cards ("from the producer of Forge files", "and from the
// creators PYPHONIC"), then the AUTHENTICATING wheel until everything has loaded, then the title screen.
// Its script tag sits right after the intro markup, so it starts while the rest of the game is still loading;
// any key or click skips the cards.
(function () {
  window.BL = window.BL || {};
  const I = BL.Intro = { finished: false, cbs: [] };
  I.when = (fn) => { if (I.finished) fn(); else I.cbs.push(fn); };
  function finish() {
    if (I.finished) return;
    I.finished = true;
    const el = document.getElementById('intro');
    if (el) { el.classList.add('gone'); setTimeout(() => el.remove(), 700); }
    I.cbs.splice(0).forEach((f) => f());
  }
  let started = false;
  function start() {
    const el = document.getElementById('intro');
    if (started || !el) return;
    started = true;
    // restarting to install an update: straight on, no opening cards again
    let updating = false;
    try { updating = sessionStorage.getItem('bl_updated') !== null; } catch (e) { /* storage off */ }
    if (updating) { finish(); return; }
    const cards = el.querySelectorAll('.in-card');
    // each card fades in, holds, fades out
    [[300, 2600], [3200, 5600]].forEach(([a, b], i) => {
      setTimeout(() => cards[i] && cards[i].classList.add('on'), a);
      setTimeout(() => cards[i] && cards[i].classList.remove('on'), b);
    });
    setTimeout(finish, 6300);
    const skip = () => { if (I.finished) return; cards.forEach((c) => c.classList.remove('on')); setTimeout(finish, 250); };
    el.addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: true });
  }
  start();
  if (!started) document.addEventListener('DOMContentLoaded', () => { start(); if (!started) finish(); });
})();
