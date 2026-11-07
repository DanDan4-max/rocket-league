'use strict';
// Rocket League (fan remake) - small SVG icon set for stat popups and scoreboards
(function (BL) {
  const P = {
    goal: '<path d="M3 5h18v14h-2V7H5v12H3z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zM7 13h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" opacity=".55"/><circle cx="12" cy="17" r="3"/>',
    save: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/><path d="M8 12l3 3 5-6" fill="none" stroke="#0b1020" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    epicsave: '<path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/><path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#0b1020"/>',
    shot: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.6"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2.2"/>',
    assist: '<path d="M3 13l6-6v4h6V7l6 6-6 6v-4H9v4z"/>',
    demo: '<path d="M12 1l2.2 5.3 5.6-2.1-2.1 5.6L23 12l-5.3 2.2 2.1 5.6-5.6-2.1L12 23l-2.2-5.3-5.6 2.1 2.1-5.6L1 12l5.3-2.2-2.1-5.6 5.6 2.1z"/>',
    aerial: '<path d="M2 14l9-3 2-8 2 8 7 3-7 1-1 6h-2l-1-6z"/>',
    longgoal: '<path d="M2 12h14l-4-4 1.5-1.5L20 13l-6.5 6.5L12 18l4-4H2z"/><path d="M21 4v18h-2V4z"/>',
    hattrick: '<path d="M7 5h10v10H7z"/><path d="M3 15h18v3H3z"/><path d="M7 11h10v2H7z" fill="#d50000"/>',
    mvp: '<path d="M12 2l3 6.3 7 .9-5.1 4.8 1.3 6.9L12 17.6 5.8 20.9l1.3-6.9L2 9.2l7-.9z"/>',
    flipreset: '<path d="M12 4a8 8 0 1 1-7.4 5H2l3.5-4 3.5 4H6.7A6 6 0 1 0 12 6z"/><circle cx="12" cy="12" r="2.5"/>',
    touch: '<circle cx="12" cy="12" r="8"/>',
    center: '<path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    clear: '<path d="M4 18l8-12 8 12z"/>',
    item: '<path d="M4 8h16v12H4z"/><path d="M12 8v12M4 12h16" stroke="#0b1020" stroke-width="1.6"/><path d="M8 3c2 0 4 2 4 5-3 0-5-1-5-3 0-1 0-2 1-2zm8 0c-2 0-4 2-4 5 3 0 5-1 5-3 0-1 0-2-1-2z"/>',
    score: '<path d="M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z"/>',
  };
  // drawn icons that replace every emoji in the game (garage tabs, Rumble items, menus): plain path data so the
  // same shapes draw in the menus (SVG) and on in-game canvases (Path2D); EVEN = paths with cut-out holes
  const D = {
    body: 'M2.5 15.5l1.6-4.4C4.6 9.8 5.7 9 7 9h8.6c1 0 1.9.5 2.4 1.3l1.6 2.4 1.9.5c.9.3 1.5 1 1.5 1.9v2.4c0 .6-.5 1-1 1h-1.2a2.6 2.6 0 0 1-5.1 0H8.3a2.6 2.6 0 0 1-5.1 0H2.5zM7.2 10.6l-1.1 2.9h5.4v-2.9zm5.9 0v2.9h5.1l-1.4-2.2c-.3-.4-.7-.7-1.2-.7z',
    decal: 'M4 3h3.4l9.6 18h-3.4zM10.6 3H14l6 11.3v6.4z M3 9.3l6 11.7H5.6L3 15.7z',
    finish: 'M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
    wheels: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.2a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6zm0 4.3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM11 5.6h2v2.9h-2zM11 15.5h2v2.9h-2zM5.6 11h2.9v2H5.6zM15.5 11h2.9v2h-2.9z',
    wheeldecal: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    boost: 'M12 2c1 3.4 5.2 5.6 5.2 10.4A5.2 5.2 0 0 1 12 17.8a5.2 5.2 0 0 1-5.2-5.4c0-2 1-3.7 2.3-4.8.2 1.6 1 2.8 2.1 3.3C10.6 8.2 11 5 12 2zM12 22.5c-3 0-5.4-1.6-5.4-3.6 1.4 1 3.2 1.6 5.4 1.6s4-.6 5.4-1.6c0 2-2.4 3.6-5.4 3.6z',
    topper: 'M8 3h8v11H8zM3.5 15h17v3.2h-17zM8 11h8v1.6H8z',
    antenna: 'M11 9.5h2V21h-2zM12 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM8 20h8v2H8z',
    explosion: 'M12 1l2.2 5.4 5.6-1.8-2.4 5.3L22 13l-5.6 1.3 1.6 5.6-5-3-5 3 1.6-5.6L2 13l4.6-3.1L4.2 4.6l5.6 1.8z',
    anthem: 'M9 3v11.3A3.5 3.5 0 1 0 11 17.5V8h8V3z',
    title: 'M3 5v6.6l9.4 9.4 8.6-8.6L11.6 3H5a2 2 0 0 0-2 2zm4 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
    paint: 'M12 3a9 9 0 0 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-.9-.7-1.2-.7-2.1 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3zM7 12.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
    crown: 'M3 18h18v2.5H3zM3 6.5l4.5 4.2L12 3.5l4.5 7.2L21 6.5l-1.8 10H4.8z',
    check: 'M9 16.2L4.8 12l-1.5 1.5L9 19.2 21 7.2l-1.5-1.5z',
    close: 'M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z',
    trophy: 'M7 2.5h10V5h3.5v3a4.5 4.5 0 0 1-4.6 4.5A5 5 0 0 1 13 15v2.5h3.5v2.5h-9v-2.5H11V15a5 5 0 0 1-2.9-2.5A4.5 4.5 0 0 1 3.5 8V5H7zM5.5 7v1a2.5 2.5 0 0 0 1.6 2.3A6 6 0 0 1 7 9V7zM17 7v2c0 .4 0 .9-.1 1.3A2.5 2.5 0 0 0 18.5 8V7zM6 21h12v1.5H6z',
    lock: 'M7 10V7.5a5 5 0 0 1 10 0V10h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2.2 0h5.6V7.5a2.8 2.8 0 0 0-5.6 0zM12 13.5a1.8 1.8 0 0 0-1 3.3V18h2v-1.2a1.8 1.8 0 0 0-1-3.3z',
    pencil: 'M3 17.3V21h3.7L17.8 9.9l-3.7-3.7zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7z',
    trash: 'M6 7.5h12l-1 13.5H7zM9 3h6l1 2h4v2H4V5h4z',
    person: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.1 0-8 2.1-8 5v2h16v-2c0-2.9-3.9-5-8-5z',
    gamepad: 'M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.6 2.6 0 0 1-4.5 1.2L14.6 16H9.4l-2 2.2A2.6 2.6 0 0 1 2.9 17l-.8-4A5 5 0 0 1 7 7zm0 3v1.5H5.5v2H7V15h2v-1.5h1.5v-2H9V10zm9 .3a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm2.2 2.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z',
    mute: 'M3 9v6h4l5 5V4L7 9zM15.6 8.6l1.4-1.4 2.6 2.6 2.6-2.6 1.4 1.4-2.6 2.6 2.6 2.6-1.4 1.4-2.6-2.6-2.6 2.6-1.4-1.4 2.6-2.6z',
    gift: 'M3.5 9h17v3.5h-17zM5 12.5h14V21H5zM11 9h2v12h-2zM12 9C10 5.5 6 4.5 6 7.2 6 9 10 9 12 9zm0 0c2-3.5 6-4.5 6-1.8C18 9 14 9 12 9z',
    star: 'M12 2l3 6.5 7 .8-5.2 4.8 1.4 6.9L12 17.6 5.8 21l1.4-6.9L2 9.3l7-.8z',
    robot: 'M11 2h2v3h4a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h4zM9 9a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 9 9zm6 0a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 15 9zM8 19.5h8V22H8z',
    timer: 'M6 2h12v2.2c0 3-2 5-4.3 5.8 2.3.8 4.3 2.8 4.3 5.8V20h1v2H5v-2h1v-4.2c0-3 2-5 4.3-5.8C8 9.2 6 7.2 6 4.2V2z',
    ball: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4.2l3.6 2.6-1.4 4.2H9.8L8.4 8.8z',
    prev: 'M15.4 4.6L8 12l7.4 7.4 1.6-1.6L11.2 12 17 6.2z',
    next: 'M8.6 4.6L16 12l-7.4 7.4L7 17.8l5.8-5.8L7 6.2z',
    // Rumble items
    spikes: 'M12 1l1.7 5.4L18.5 3l-1.4 5.5L22.5 10l-4.9 2.4L20.5 17l-5.5-1.3L12 21l-3-5.3L3.5 17l2.9-4.6L1.5 10l5.4-1.5L5.5 3l4.8 3.4z',
    magnet: 'M4.5 3h5v7.5a2.5 2.5 0 0 0 5 0V3h5v7.5a7.5 7.5 0 0 1-15 0z',
    freeze: 'M11 1.5h2v21h-2zM1.5 11h21v2h-21zM4.3 5.7l1.4-1.4 14 14-1.4 1.4zM18.3 4.3l1.4 1.4-14 14-1.4-1.4zM9 3l3 2.5L15 3l.8 1.4L12 7.6 8.2 4.4z',
    punch: 'M8 4.5A2.5 2.5 0 0 1 10.5 2h4.5a4.5 4.5 0 0 1 4.5 4.5V12a6 6 0 0 1-6 6H9.5a4.5 4.5 0 0 1-4.5-4.5V11a2.5 2.5 0 0 1 3-2.4zM8.5 19h8v3h-8z',
    plunger: 'M11 2h2v11.5h-2zM4.5 19.5a7.5 5.5 0 0 1 15 0V21h-15z',
    boot: 'M7 2h6.5v9.2l5.8 2.6a3.2 3.2 0 0 1 1.9 2.9V21H3v-4.5h4z',
    power: 'M13.5 2L4 14.2h6.3L9 22l9.5-12.3h-6.3z',
    grapple: 'M11 2h2v9h-2zM6 13a6 6 0 0 0 12 0h-2.5a3.5 3.5 0 0 1-7 0zM4 12l3-1v3.5zM20 12l-3-1v3.5z',
    swap: 'M7 3.5l-4.5 4.5L7 12.5V9.3h11V6.8H7zM17 11.5l4.5 4.5-4.5 4.5v-3.2H6v-2.5h11z',
    tornado: 'M2.5 3.5h19V6h-19zM4.5 8h15v2.5h-15zM7 12.5h10V15H7zM9 17h6v2.5H9zM11 21h2v2h-2z',
    disrupt: 'M12 2.5a9.5 9.5 0 1 1-9.5 9.5H5a7 7 0 1 0 7-7 4.5 4.5 0 1 0 4.5 4.5H19a7 7 0 1 1-7-7z',
  };
  const EVEN = new Set(['body', 'wheels', 'wheeldecal', 'paint', 'lock', 'gamepad', 'ball', 'trophy', 'robot']);
  for (const k of Object.keys(D)) if (!P[k]) P[k] = `<path d="${D[k]}"${EVEN.has(k) ? ' fill-rule="evenodd"' : ''}/>`;
  BL.ICON = (name, size) => `<svg class="ico" viewBox="0 0 24 24" width="${size || 18}" height="${size || 18}" fill="currentColor">${P[name] || P.touch}</svg>`;
  // the same shapes on a canvas: draws icon `name` centred at (x, y), `size` px across
  BL.drawIcon = function (g, name, x, y, size) {
    const d = D[name];
    if (!d || typeof Path2D === 'undefined') return false;
    g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24);
    g.fill(new Path2D(d), EVEN.has(name) ? 'evenodd' : 'nonzero');
    g.restore();
    return true;
  };
  // map popup labels -> icon
  BL.ICON_FOR = {
    'GOAL': 'goal', 'SAVE': 'save', 'EPIC SAVE': 'epicsave', 'SHOT ON GOAL': 'shot', 'ASSIST': 'assist', 'DEMOLITION': 'demo',
    'AERIAL GOAL': 'aerial', 'AERIAL HIT': 'aerial', 'LONG GOAL': 'longgoal', 'HAT TRICK': 'hattrick', 'FLIP RESET': 'flipreset', 'MVP': 'mvp',
  };
})(window.BL);
