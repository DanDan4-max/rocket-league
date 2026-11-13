'use strict';
// Rocket League (fan remake) - game data: items, rarities, maps, ranks, modes
(function (BL) {
  BL.RARITY_ORDER = ['common', 'uncommon', 'rare', 'veryrare', 'import', 'exotic', 'blackmarket', 'limited'];
  BL.RARITIES = {
    common: { name: 'Common', color: '#b9c0c9' },
    uncommon: { name: 'Uncommon', color: '#6fe0ff' },
    rare: { name: 'Rare', color: '#5b8cff' },
    veryrare: { name: 'Very Rare', color: '#a46bff' },
    import: { name: 'Import', color: '#ff4d4d' },
    exotic: { name: 'Exotic', color: '#ffd13b' },
    blackmarket: { name: 'Black Market', color: '#ff3fbf' },
    limited: { name: 'Limited', color: '#ff8c2b' },
  };

  BL.CATEGORIES = [
    { id: 'body', name: 'Body', icon: 'body' },
    { id: 'decal', name: 'Decal', icon: 'decal' },
    { id: 'finish', name: 'Paint Finish', icon: 'finish' },
    { id: 'wheels', name: 'Wheels', icon: 'wheels' },
    { id: 'wheeldecal', name: 'Wheel Decal', icon: 'wheeldecal' },
    { id: 'boost', name: 'Rocket Boost', icon: 'boost' },
    { id: 'topper', name: 'Topper', icon: 'topper' },
    { id: 'antenna', name: 'Antenna', icon: 'antenna' },
    { id: 'explosion', name: 'Goal Explosion', icon: 'explosion' },
    { id: 'anthem', name: 'Player Anthem', icon: 'anthem' },
    { id: 'title', name: 'Player Title', icon: 'title' },
  ];

  // Hitbox sizes in meters (length, width, height)
  BL.HITBOXES = {
    octane: { L: 1.18, W: 0.84, H: 0.36, name: 'Octane-type' },
    dominus: { L: 1.28, W: 0.84, H: 0.31, name: 'Dominus-type' },
    plank: { L: 1.28, W: 0.85, H: 0.30, name: 'Plank-type' },
    breakout: { L: 1.31, W: 0.80, H: 0.30, name: 'Breakout-type' },
    hybrid: { L: 1.27, W: 0.83, H: 0.34, name: 'Hybrid-type' },
    merc: { L: 1.21, W: 0.77, H: 0.42, name: 'Merc-type' },
  };

  const I = [];
  const add = (cat, id, name, rarity, extra) => I.push(Object.assign({ id: cat + '_' + id, cat, name, rarity }, extra || {}));

  // ---------- BODIES ----------
  add('body', 'striker', 'Striker', 'common', { style: 'hatch', hitbox: 'octane', def: true, start: true, desc: 'The all-rounder. Tall, nimble, iconic.' });
  add('body', 'bulldog', 'Bulldog', 'common', { style: 'boxy', hitbox: 'octane', def: true, desc: 'Boxy brawler with flat sides.' });
  add('body', 'viper', 'Viper', 'uncommon', { style: 'muscle', hitbox: 'dominus', desc: 'Long-hood muscle car.' });
  add('body', 'scarab', 'Scarab', 'uncommon', { style: 'bug', hitbox: 'octane', desc: 'Round, bouncy and cute.' });
  add('body', 'razor', 'Razor', 'rare', { style: 'wedge', hitbox: 'breakout', desc: 'Pointy wedge built for aerials.' });
  add('body', 'mammoth', 'Mammoth', 'rare', { style: 'truck', hitbox: 'merc', desc: 'A tall pickup truck. Big bumps.' });
  add('body', 'phantom', 'Phantom', 'veryrare', { style: 'flat', hitbox: 'plank', desc: 'Low, wide and mysterious.' });
  add('body', 'hornet', 'Hornet', 'import', { style: 'hybrid', hitbox: 'hybrid', desc: 'Rally hatch with a giant wing.' });
  add('body', 'nova', 'Nova GT', 'exotic', { style: 'super', hitbox: 'dominus', desc: 'Mid-engine hypercar.' });
  add('body', 'apex', 'Apex F1', 'blackmarket', { style: 'formula', hitbox: 'plank', desc: 'Open-wheel race machine.' });
  // Real 3D models (Kenney Car Kit, CC0). `style` is the fallback shape if the model can't load (e.g. opened from file://).
  add('body', 'racer', 'Racer', 'common', { style: 'formula', hitbox: 'plank', model: 'race', def: true });
  add('body', 'hatch', 'Sport Hatch', 'common', { style: 'hatch', hitbox: 'octane', model: 'hatchback-sports', def: true });
  add('body', 'future', 'Future Racer', 'rare', { style: 'wedge', hitbox: 'breakout', model: 'race-future' });
  add('body', 'sportsedan', 'Sports Sedan', 'uncommon', { style: 'muscle', hitbox: 'dominus', model: 'sedan-sports' });
  add('body', 'trail', 'Trail SUV', 'common', { style: 'boxy', hitbox: 'merc', model: 'suv' });
  add('body', 'luxsuv', 'Luxury SUV', 'rare', { style: 'boxy', hitbox: 'hybrid', model: 'suv-luxury' });
  add('body', 'hauler', 'Hauler', 'rare', { style: 'truck', hitbox: 'merc', model: 'truck' });
  add('body', 'interceptor', 'Interceptor', 'veryrare', { style: 'muscle', hitbox: 'dominus', model: 'police' });
  add('body', 'cabbie', 'Cabbie', 'uncommon', { style: 'boxy', hitbox: 'octane', model: 'taxi' });
  add('body', 'gokart', 'Go-Kart', 'import', { style: 'formula', hitbox: 'plank', model: 'kart-oodi' });
  add('body', 'courier', 'Courier Van', 'common', { style: 'boxy', hitbox: 'merc', model: 'van' });
  add('body', 'classic', 'Classic Sedan', 'common', { style: 'muscle', hitbox: 'dominus', model: 'sedan' });

  // ---------- DECALS ----------
  add('decal', 'none', 'None', 'common', { pattern: 'none', def: true });
  // wheel decals: a ring painted on the outside of each tyre (paintable like decals)
  add('wheeldecal', 'none', 'None', 'common', { ring: 'none', def: true });
  add('wheeldecal', 'sidewall', 'Sidewall Letters', 'common', { ring: 'letters', def: true });
  add('wheeldecal', 'redline', 'Redline', 'common', { ring: 'line', color: '#e53935' });
  add('wheeldecal', 'whitewall', 'Whitewall', 'uncommon', { ring: 'band', color: '#f5f5f5' });
  add('wheeldecal', 'dashes', 'Dash Ring', 'uncommon', { ring: 'dashes' });
  add('wheeldecal', 'flames', 'Flame Ring', 'rare', { ring: 'flames' });
  add('wheeldecal', 'stars', 'Star Ring', 'rare', { ring: 'stars' });
  add('wheeldecal', 'checker', 'Checkered Ring', 'veryrare', { ring: 'checker' });
  add('wheeldecal', 'neon', 'Neon Ring', 'import', { ring: 'neon', color: '#33e1ff', glow: true });
  add('wheeldecal', 'tiger', 'Tiger Ring', 'exotic', { ring: 'tiger', color: '#ff8a1f' });
  add('decal', 'stripes', 'Racing Stripes', 'common', { pattern: 'stripes' });
  add('decal', 'twotone', 'Two-Tone', 'common', { pattern: 'twotone' });
  add('decal', 'number', 'Number 07', 'common', { pattern: 'number' });
  add('decal', 'checker', 'Checkered', 'uncommon', { pattern: 'checker' });
  add('decal', 'flames', 'Hot Rod Flames', 'uncommon', { pattern: 'flames' });
  add('decal', 'zigzag', 'Zig Zag', 'uncommon', { pattern: 'zigzag' });
  add('decal', 'lightning', 'Storm Bolt', 'rare', { pattern: 'lightning' });
  add('decal', 'camo', 'Camo', 'rare', { pattern: 'camo' });
  add('decal', 'tiger', 'Tiger Claw', 'rare', { pattern: 'tiger' });
  add('decal', 'splatter', 'Paint Splat', 'rare', { pattern: 'splatter' });
  add('decal', 'hex', 'Hexed', 'veryrare', { pattern: 'hex' });
  add('decal', 'circuit', 'Circuitry', 'veryrare', { pattern: 'circuit' });
  add('decal', 'carbon', 'Carbon Fiber', 'import', { pattern: 'carbon' });
  add('decal', 'scales', 'Dragon Scales', 'import', { pattern: 'scales' });
  // reactive: what's on them moves with the car (carmodels.js updateDecal)
  add('decal', 'nebula', 'Nebula', 'exotic', { pattern: 'nebula', animated: true, react: true, anim: 'space' });
  add('decal', 'warp', 'Warp Drive', 'blackmarket', { pattern: 'warp', animated: true, react: true, anim: 'space' });
  add('decal', 'molten', 'Molten Core', 'exotic', { pattern: 'molten', animated: true, react: true, anim: 'heat' });
  add('decal', 'aurora', 'Aurora', 'import', { pattern: 'aurora', animated: true, react: true, anim: 'drift' });
  add('decal', 'inferno', 'Inferno', 'blackmarket', { pattern: 'inferno', animated: true });
  add('decal', 'prism', 'Prismatic', 'blackmarket', { pattern: 'prism', animated: true });
  add('decal', 'coderain', 'Code Rain', 'blackmarket', { pattern: 'coderain', animated: true });
  // animated decals that glow: the pattern pulses / races along the body (anim: pulse | race | flicker)
  add('decal', 'neonpulse', 'Neon Pulse', 'exotic', { pattern: 'neonpulse', animated: true, anim: 'pulse' });
  add('decal', 'hyperdrive', 'Hyperdrive', 'blackmarket', { pattern: 'hyperdrive', animated: true, anim: 'race' });
  add('decal', 'overload', 'Overload', 'blackmarket', { pattern: 'overload', animated: true, anim: 'flicker' });
  add('decal', 'flowstate', 'Flowstate', 'exotic', { pattern: 'flowstate', animated: true, anim: 'flow' });
  add('decal', 'pulsar', 'Pulsar', 'exotic', { pattern: 'pulsar', animated: true, anim: 'pulse' });
  add('decal', 'tron', 'Grid Runner', 'import', { pattern: 'tron', animated: true, anim: 'flow' });
  add('decal', 'heartbeat', 'Heartbeat', 'blackmarket', { pattern: 'heartbeat', animated: true, anim: 'race' });
  add('decal', 'storm', 'Storm Front', 'blackmarket', { pattern: 'storm', animated: true, anim: 'flicker' });
  add('decal', 'hueshift', 'Hue Shift', 'blackmarket', { pattern: 'hueshift', animated: true, anim: 'hue' });

  // ---------- PAINT FINISHES ----------
  add('finish', 'gloss', 'Gloss', 'common', { metal: 0.15, rough: 0.28, clear: 1, shin: 80, def: true });
  add('finish', 'matte', 'Matte', 'common', { metal: 0.0, rough: 0.9, clear: 0, shin: 4 });
  add('finish', 'satin', 'Satin', 'uncommon', { metal: 0.3, rough: 0.5, clear: 0.3, shin: 30 });
  add('finish', 'metallic', 'Metallic', 'uncommon', { metal: 0.75, rough: 0.32, clear: 0.6, shin: 90 });
  add('finish', 'pearl', 'Pearlescent', 'rare', { metal: 0.4, rough: 0.25, clear: 1, irid: 0.5, shin: 110 });
  add('finish', 'glitter', 'Glitter Bomb', 'veryrare', { metal: 0.8, rough: 0.35, clear: 1, glitter: true, shin: 120 });
  add('finish', 'chrome', 'Chrome', 'exotic', { metal: 1.0, rough: 0.06, clear: 1, shin: 200 });
  add('finish', 'holo', 'Holographic', 'blackmarket', { metal: 0.9, rough: 0.12, clear: 1, irid: 1, shin: 160 });

  // ---------- WHEELS ----------
  add('wheels', 'stock', 'Stock', 'common', { rim: { style: 'spoke', spokes: 6, color: '#b8bcc4' }, def: true });
  add('wheels', 'oem', 'Sport OEM', 'common', { rim: { style: 'spoke', spokes: 5, color: '#30333a' } });
  add('wheels', 'turbine', 'Turbine', 'uncommon', { rim: { style: 'turbine', spokes: 12, color: '#d8dbe0' } });
  add('wheels', 'fivestar', 'Five Star', 'uncommon', { rim: { style: 'star', spokes: 5, color: '#e9c46a' } });
  add('wheels', 'deep', 'Deep Dish', 'rare', { rim: { style: 'dish', spokes: 8, color: '#e8e8ee' } });
  add('wheels', 'tri', 'Tri-Blade', 'rare', { rim: { style: 'tri', spokes: 3, color: '#ff4040' } });
  add('wheels', 'mesh', 'Mesh Pro', 'veryrare', { rim: { style: 'mesh', spokes: 10, color: '#c0c0c8' } });
  add('wheels', 'neon', 'Neon Ring', 'import', { rim: { style: 'ring', spokes: 4, color: '#1a1a22', glow: '#00e5ff' } });
  add('wheels', 'fire', 'Inferno Rims', 'exotic', { rim: { style: 'star', spokes: 6, color: '#2a1208', glow: '#ff6a00' } });
  add('wheels', 'cyber', 'Cyber Spin', 'exotic', { rim: { style: 'turbine', spokes: 8, color: '#101018', glow: '#b46bff', anim: 'hue' } });
  add('wheels', 'reaper', 'Reaper', 'blackmarket', { rim: { style: 'tri', spokes: 3, color: '#050505', glow: '#ff1744', anim: 'pulse' } });
  add('wheels', 'vortex', 'Vortex', 'blackmarket', { rim: { style: 'spiral', spokes: 7, color: '#0b0b14', glow: '#39ff14', anim: 'hue' } });
  add('wheels', 'golden', 'Golden Spokes', 'limited', { rim: { style: 'spoke', spokes: 10, color: '#ffd23f', glow: '#ffb300' } });
  // model: downloaded wheel shown on Medium / High (the rim is the Low / Very Low look)
  add('wheels', 'sc20', 'SC20', 'import', { rim: { style: 'mesh', spokes: 10, color: '#1c1d22' }, model: 'assets/hq/wheels/sc20/model.glb' });

  // ---------- BOOSTS ----------
  add('boost', 'standard', 'Classic Fire', 'common', { def: true, fx: { colors: ['#fff2a8', '#ffb347', '#ff5a1f'], shape: 0, size: [0.55, 0.12], life: 0.32, speed: 8, spread: 0.14, rate: 70, flame: '#ff9a3c', smoke: true } });
  add('boost', 'blue', 'Blue Flame', 'common', { fx: { colors: ['#e0f7ff', '#5cc8ff', '#1e5bff'], shape: 0, size: [0.5, 0.1], life: 0.3, speed: 9, spread: 0.1, rate: 70, flame: '#4aa8ff' } });
  add('boost', 'smoke', 'Smokescreen', 'common', { fx: { colors: ['#dddddd', '#999999', '#555555'], shape: 0, size: [0.4, 1.2], life: 0.7, speed: 5, spread: 0.2, rate: 45, flame: '#ffffff', blend: 'alpha', alpha: 0.5 } });
  add('boost', 'sparkles', 'Sparkles', 'uncommon', { fx: { colors: ['#ffffff', '#fff59d', '#ffd54f'], shape: 1, size: [0.45, 0.05], life: 0.6, speed: 6, spread: 0.35, rate: 60, grav: 3, flame: '#fff59d' } });
  add('boost', 'bubbles', 'Bubbles', 'uncommon', { fx: { colors: ['#e1f5fe', '#81d4fa', '#4fc3f7'], shape: 4, size: [0.15, 0.5], life: 0.9, speed: 3, spread: 0.3, rate: 30, grav: -1.5, flame: '#81d4fa' } });
  add('boost', 'hearts', 'Love Shot', 'rare', { fx: { colors: ['#ff80ab', '#ff4081', '#f50057'], shape: 3, size: [0.35, 0.6], life: 0.7, speed: 4, spread: 0.3, rate: 30, grav: -0.5, flame: '#ff4081' } });
  add('boost', 'toxic', 'Toxic', 'rare', { fx: { colors: ['#ccff90', '#76ff03', '#2e7d32'], shape: 0, size: [0.6, 0.25], life: 0.45, speed: 7, spread: 0.18, rate: 65, flame: '#76ff03', smoke: true } });
  add('boost', 'plasma', 'Plasma', 'veryrare', { fx: { colors: ['#ffffff', '#ea80fc', '#7c4dff'], shape: 0, size: [0.7, 0.1], life: 0.35, speed: 10, spread: 0.1, rate: 80, flame: '#d500f9' } });
  add('boost', 'pixel', 'Pixel Dust', 'veryrare', { fx: { colors: ['#00e676', '#00b0ff', '#ffea00'], shape: 2, size: [0.3, 0.3], life: 0.6, speed: 5, spread: 0.25, rate: 45, flame: '#00e676' } });
  add('boost', 'lightning', 'Thunderbolt', 'import', { fx: { colors: ['#ffffff', '#b3e5fc', '#40c4ff'], shape: 1, size: [0.5, 0.05], life: 0.25, speed: 12, spread: 0.3, rate: 70, flame: '#80d8ff', special: 'lightning' } });
  add('boost', 'gold', 'Gold Rush', 'exotic', { fx: { colors: ['#fff8e1', '#ffd54f', '#ffa000'], shape: 2, size: [0.25, 0.15], life: 0.8, speed: 6, spread: 0.3, rate: 55, grav: 6, flame: '#ffca28', special: 'gold' } });
  add('boost', 'fireworks', 'Fireworks', 'exotic', { fx: { colors: ['#ff1744', '#ffea00', '#00e5ff', '#76ff03', '#d500f9'], shape: 1, size: [0.4, 0.05], life: 0.7, speed: 7, spread: 0.6, rate: 50, grav: 2, flame: '#ffffff', special: 'fireworks' } });
  add('boost', 'rainbow', 'Rainbow Road', 'blackmarket', { fx: { colors: ['#ff0000'], shape: 0, size: [0.6, 0.35], life: 0.6, speed: 6, spread: 0.08, rate: 90, flame: '#ffffff', special: 'rainbow' } });
  add('boost', 'darkmatter', 'Dark Matter', 'blackmarket', { fx: { colors: ['#000000', '#1a0033', '#4a148c'], shape: 0, size: [0.6, 1.0], life: 0.6, speed: 5, spread: 0.15, rate: 60, flame: '#aa00ff', blend: 'alpha', alpha: 0.85, special: 'dark' } });

  // ---------- TOPPERS ----------
  add('topper', 'none', 'None', 'common', { shape: 'none', def: true });
  add('topper', 'cone', 'Traffic Cone', 'common', { shape: 'cone', color: '#ff6d00' });
  add('topper', 'tophat', 'Top Hat', 'common', { shape: 'tophat', color: '#151515' });
  add('topper', 'sharkfin', 'Shark Fin', 'uncommon', { shape: 'sharkfin', color: '#607d8b' });
  add('topper', 'antlers', 'Antlers', 'uncommon', { shape: 'antlers', color: '#8d6e63' });
  add('topper', 'propeller', 'Propeller Cap', 'rare', { shape: 'propeller', color: '#e53935' });
  add('topper', 'viking', 'Viking Helm', 'rare', { shape: 'viking', color: '#9e9e9e' });
  add('topper', 'devil', 'Devil Horns', 'rare', { shape: 'devil', color: '#d50000' });
  add('topper', 'wizard', 'Wizard Hat', 'veryrare', { shape: 'wizard', color: '#3949ab' });
  add('topper', 'crown', 'Royal Crown', 'import', { shape: 'crown', color: '#ffd23f' });
  add('topper', 'halo', 'Halo', 'exotic', { shape: 'halo', color: '#fff59d', glow: true });
  add('topper', 'firecrown', 'Fire Crown', 'blackmarket', { shape: 'firecrown', color: '#ff6d00', glow: true });
  // animated toppers
  add('topper', 'saturn', 'Ringed Planet', 'import', { shape: 'saturn', color: '#ffb74d' });
  add('topper', 'disco', 'Disco Ball', 'exotic', { shape: 'disco', color: '#e0e0e0' });
  add('topper', 'orbit', 'Orbital', 'blackmarket', { shape: 'orbit', color: '#7c4dff', glow: true });
  // model: downloaded topper shown on Medium / High (the shape is the Low / Very Low look)
  add('topper', 'cap', 'Printed Cap', 'rare', { shape: 'cap', color: '#59606b' });

  // ---------- ANTENNAS ----------
  add('antenna', 'none', 'None', 'common', { shape: 'none', def: true });
  add('antenna', 'ball', 'Ball Antenna', 'common', { shape: 'ball', color: '#e0e0e0' });
  add('antenna', 'flag', 'Checkered Flag', 'common', { shape: 'flag', color: '#ffffff' });
  add('antenna', 'star', 'Gold Star', 'uncommon', { shape: 'star', color: '#ffd23f' });
  add('antenna', 'heart', 'Heart', 'uncommon', { shape: 'heart', color: '#ff4081' });
  add('antenna', 'bolt', 'Lightning', 'rare', { shape: 'bolt', color: '#ffea00' });
  add('antenna', 'skull', 'Jolly Roger', 'veryrare', { shape: 'skull', color: '#111111' });
  add('antenna', 'orb', 'Glow Orb', 'import', { shape: 'orb', color: '#00e5ff', glow: true });

  // ---------- GOAL EXPLOSIONS ----------
  add('explosion', 'classic', 'Classic', 'common', { fx: 'classic', def: true });
  add('explosion', 'shockwave', 'Shockwave', 'common', { fx: 'shockwave' });
  add('explosion', 'confetti', 'Party Popper', 'uncommon', { fx: 'confetti' });
  add('explosion', 'ice', 'Ice Shatter', 'rare', { fx: 'ice' });
  add('explosion', 'fireworks', 'Fireworks', 'rare', { fx: 'fireworks' });
  add('explosion', 'toon', 'Toon Boom', 'veryrare', { fx: 'toon' });
  add('explosion', 'hearts', 'Love Bomb', 'veryrare', { fx: 'hearts' });
  add('explosion', 'glitch', 'Glitch', 'import', { fx: 'glitch', force: 'pull' });
  add('explosion', 'meteor', 'Meteor Shower', 'import', { fx: 'meteor' });
  add('explosion', 'supernova', 'Supernova', 'exotic', { fx: 'supernova' });
  add('explosion', 'thunder', 'Thunderstorm', 'exotic', { fx: 'thunder' });
  add('explosion', 'hellfire', 'Hellfire', 'exotic', { fx: 'hellfire' });
  add('explosion', 'blackhole', 'Black Hole', 'blackmarket', { fx: 'blackhole', force: 'devour', blast: { at: 6, r: 16, eat: 'hold', from: 0.45, to: 1.75, er: 3.2, end: 2.0 } });
  add('explosion', 'dragons', 'Dueling Dragons', 'blackmarket', { fx: 'dragons', force: 'sling' });
  add('explosion', 'kaboom', 'Kaboom', 'exotic', { fx: 'kaboom' });
  add('explosion', 'rainbow', 'Rainbow Burst', 'limited', { fx: 'rainbow', force: 'sling' });
  // 3D ones (js/fxmodels.js)
  // (how they move cars, js/game.js goalBlastCar: devour drags cars to the model and eats the ones in its mouth
  // when it bites; grab drags them in and flings them back out; abduct floats them up the saucer's beam. `at` is
  // how far out of the goal the model is, past where the explosion goes off; r how far it reaches (30 m when not
  // given); times are seconds after the goal)
  add('explosion', 'kraken', 'Kraken', 'blackmarket', { fx: 'kraken', force: 'grab', blast: { at: 0.5, spit: 1.45, end: 1.9 } });
  add('explosion', 'ufo', 'Abduction', 'blackmarket', { fx: 'ufo', force: 'abduct', blast: { at: 6, from: 0.8, to: 2.2, end: 2.3 } });
  add('explosion', 'chomp', 'Chomp Chomp', 'blackmarket', { fx: 'chomp', force: 'devour', blast: { at: -1.8, r: 17, eat: [0.95, 1.53, 2.07], er: 4.6, end: 2.25 } });
  add('explosion', 'shark', 'Shark Attack', 'exotic', { fx: 'shark', force: 'devour', blast: { at: 1, r: 17, eat: [2.15], er: 5.5, end: 2.35 } });
  add('explosion', 'volcano', 'Volcano', 'exotic', { fx: 'volcano' });
  add('explosion', 'goldrush', 'Gold Rush', 'exotic', { fx: 'goldrush' });
  add('explosion', 'crystal', 'Crystal Spire', 'import', { fx: 'crystal' });
  add('explosion', 'disco', 'Disco Fever', 'veryrare', { fx: 'disco' });
  // ---------- TITLES ----------
  add('title', 'rookie', 'Rookie', 'common', { text: 'ROOKIE', def: true });
  // Rocket Pass Pro Tier titles
  add('title', 'rp100', 'Pro Tier 100', 'exotic', { text: 'TIER 100 CLUB', color: '#ffb84d', pass: 1 });
  add('title', 'rp200', 'Pro Tier 200', 'blackmarket', { text: 'TIER 200 GRINDER', color: '#ff5ad1', glow: true, pass: 1 });
  add('title', 'rp300', 'Pro Tier 300', 'blackmarket', { text: 'ROCKET PASS LEGEND', color: '#7df9ff', glow: true, pass: 1 });
  add('title', 'chaser', 'Ball Chaser', 'common', { text: 'BALL CHASER' });
  add('title', 'fan', 'Car Soccer Fan', 'common', { text: 'CAR SOCCER FAN' });
  add('title', 'kickoff', 'Kickoff King', 'uncommon', { text: 'KICKOFF KING' });
  add('title', 'wall', 'Wall Crawler', 'uncommon', { text: 'WALL CRAWLER' });
  add('title', 'aerial', 'Aerial Ace', 'rare', { text: 'AERIAL ACE' });
  add('title', 'demo', 'Demo Machine', 'rare', { text: 'DEMO MACHINE' });
  add('title', 'keeper', 'Goal Keeper', 'rare', { text: 'GOAL KEEPER' });
  add('title', 'flipreset', 'Flip Reset God', 'veryrare', { text: 'FLIP RESET GOD' });
  add('title', 'gc', 'Grand Champ', 'import', { text: 'GRAND CHAMP', rank: 6 });
  add('title', 'ssl', 'Supersonic Legend', 'exotic', { text: 'SUPERSONIC LEGEND', rank: 7 });
  // Competitive season rewards: reaching a rank in any Competitive playlist (after placements) earns its title
  // (rank = index into BL.RANKS; these never come from drops, the shop or trade-ins)
  [['bronze', 'Bronze', 'common', '#d9a066'], ['silver', 'Silver', 'common', '#d7dee6'], ['gold', 'Gold', 'uncommon', '#ffcc33'], ['plat', 'Platinum', 'rare', '#4fd1c5'],
    ['diamond', 'Diamond', 'veryrare', '#6aa0ff'], ['champ', 'Champion', 'import', '#c27dff'], ['gcs', 'Grand Champion', 'exotic', '#ff4d4d'], ['ssls', 'Supersonic Legend', 'blackmarket', '#ffffff']]
    .forEach(([id, name, rar, color], i) => add('title', 's1' + id, 'Season 1 ' + name, rar, { text: 'S1 ' + name.toUpperCase(), color, glow: i >= 6, rank: i }));
  add('title', 'calculated', 'Calculated.', 'blackmarket', { text: 'CALCULATED.' });
  add('title', 'founder', 'Founder', 'limited', { text: 'FOUNDER' });
  // Honor Duel titles: only by winning Honor Duels (duels: wins needed; pass keeps them out of drops and the shop)
  add('title', 'duelist', 'Duelist', 'rare', { text: 'DUELIST', color: '#ff9f1c', pass: 'duel', duels: 5 });
  add('title', 'honorchamp', 'Honor Duel Champion', 'exotic', { text: 'HONOR DUEL CHAMPION', color: '#ffd451', glow: true, pass: 'duel', duels: 25 });

  // ---------- SEASON ----------
  // The only car bodies this season. Drops, shop, trade-ins, the pass, bots, online players and the garage all
  // use just these; every other body stays defined (and stays in saves, hidden). Add ids back to return them.
  BL.SEASON_BODIES = ['body_custom_octane', 'body_custom_fennec', 'body_custom_dominus', 'body_custom_mustang', 'body_custom_guardian', 'body_custom_samus', 'body_custom_roadster'];
  BL.inSeason = (def) => !def || def.cat !== 'body' || !BL.SEASON_BODIES || BL.SEASON_BODIES.indexOf(def.id) >= 0;

  // ---------- SEASON PASS EXCLUSIVES (never drop, only from the pass) ----------
  const P1 = { pass: 1 };
  add('body', 'titanx', 'Titan X', 'import', Object.assign({ style: 'gt', hitbox: 'dominus', desc: 'Season 1 endurance racer.' }, P1));
  add('body', 'cyberbolt', 'Cyber Bolt', 'exotic', Object.assign({ style: 'cyber', hitbox: 'merc', desc: 'Angular armored future-truck.' }, P1));
  add('decal', 's1', 'Season One', 'common', Object.assign({ pattern: 's1' }, P1));
  add('decal', 'chevron', 'Chevron Rush', 'rare', Object.assign({ pattern: 'chevron' }, P1));
  add('decal', 'waves', 'Shockwaves', 'rare', Object.assign({ pattern: 'waves' }, P1));
  add('decal', 'pixel', '8-Bit', 'rare', Object.assign({ pattern: 'pixel' }, P1));
  add('decal', 'stars', 'Star Spangled', 'veryrare', Object.assign({ pattern: 'stars' }, P1));
  add('decal', 'ignition', 'Ignition', 'blackmarket', Object.assign({ pattern: 'ignition', animated: true }, P1));
  add('finish', 'candy', 'Candy Coat', 'veryrare', Object.assign({ metal: 0.55, rough: 0.14, clear: 1, irid: 0.35, shin: 140 }, P1));
  add('wheels', 'slicer', 'Slicer', 'uncommon', Object.assign({ rim: { style: 'tri', spokes: 5, color: '#d7dbe2' } }, P1));
  add('wheels', 'ignition', 'Ignition Rims', 'veryrare', Object.assign({ rim: { style: 'turbine', spokes: 10, color: '#111111', glow: '#ff6a00', anim: 'pulse' } }, P1));
  add('wheels', 'chromelord', 'Chrome Lord', 'import', Object.assign({ rim: { style: 'dish', spokes: 12, color: '#f2f4f8' } }, P1));
  add('boost', 'comet', 'Comet Tail', 'veryrare', Object.assign({ fx: { colors: ['#ffffff', '#b3e5fc', '#4fc3f7', '#1565c0'], shape: 0, size: [0.8, 0.2], life: 0.8, speed: 3, spread: 0.05, rate: 90, flame: '#e1f5fe', special: 'comet' } }, P1));
  add('boost', 'stardust', 'Stardust', 'import', Object.assign({ fx: { colors: ['#ffffff', '#e1bee7', '#ce93d8', '#7e57c2'], shape: 1, size: [0.5, 0.05], life: 1.1, speed: 3, spread: 0.45, rate: 55, grav: -0.3, flame: '#e1bee7' } }, P1));
  add('topper', 'beanie', 'Pom Beanie', 'common', Object.assign({ shape: 'beanie', color: '#e53935' }, P1));
  add('topper', 'astro', 'Astro Helmet', 'rare', Object.assign({ shape: 'astro', color: '#f5f5f5' }, P1));
  add('topper', 'horns', 'Golden Horns', 'veryrare', Object.assign({ shape: 'devil', color: '#ffd23f' }, P1));
  add('antenna', 's1flag', 'Season Flag', 'uncommon', Object.assign({ shape: 's1flag', color: '#ff6a00' }, P1));
  add('antenna', 'torch', 'Torch', 'veryrare', Object.assign({ shape: 'torch', color: '#ff6a00' }, P1));
  add('explosion', 'ignition', 'Ignition', 'exotic', Object.assign({ fx: 'ignition' }, P1));
  add('explosion', 'tornado', 'Tornado', 'import', Object.assign({ fx: 'tornado', force: 'sling' }, P1));
  add('title', 's1rookie', 'Season 1 Rookie', 'common', Object.assign({ text: 'SEASON 1 ROOKIE' }, P1));
  add('title', 'ignited', 'Ignited', 'rare', Object.assign({ text: 'IGNITED' }, P1));
  add('title', 'passholder', 'Pass Holder', 'veryrare', Object.assign({ text: 'PASS HOLDER' }, P1));
  add('title', 's1legend', 'Season 1 Legend', 'blackmarket', Object.assign({ text: 'SEASON 1 LEGEND' }, P1));

  // ---- more to collect (drops, the shop, trade-ins; none of them handed out) ----
  // animated decals: the pattern moves along the car (anim: how), and its bright parts glow
  for (const [id, name, rar, anim] of [
    ['equalizer', 'Bass Drop', 'exotic', 'beat'], ['galaxy', 'Galaxy Swirl', 'blackmarket', 'drift'], ['lavalamp', 'Lava Lamp', 'exotic', 'rise'],
    ['synthwave', 'Synthwave', 'blackmarket', 'flow'], ['datastream', 'Data Stream', 'import', 'race'], ['fizz', 'Fizz', 'veryrare', 'rise'],
    ['blizzard', 'Blizzard', 'import', 'fall'], ['sakura', 'Sakura Drift', 'exotic', 'drift'], ['tesla', 'Tesla Coil', 'blackmarket', 'flicker'],
    ['radar', 'Radar Sweep', 'import', 'pulse'], ['heartthrob', 'Heart Throb', 'veryrare', 'beat'], ['scanner', 'Night Rider', 'exotic', 'scan'],
    ['spectrum', 'Spectrum Wave', 'blackmarket', 'flow'], ['neontiger', 'Neon Tiger', 'exotic', 'pulse'], ['ghostflames', 'Ghost Flames', 'blackmarket', 'heat'],
    ['hexcore', 'Hex Core', 'import', 'flicker'], ['cyclone', 'Cyclone', 'exotic', 'flow'], ['dna', 'Double Helix', 'veryrare', 'flow'],
    ['glitchy', 'Glitch', 'blackmarket', 'glitch'], ['toxicdrip', 'Toxic Drip', 'import', 'pulse'], ['checkerrun', 'Checkered Rush', 'veryrare', 'race'],
    ['fireworkshow', 'Fireworks Show', 'exotic', 'beat'], ['starfield', 'Starfield', 'import', 'space'], ['waveform', 'Audio Wave', 'veryrare', 'flow'],
  ]) add('decal', id, name, rar, { pattern: id, animated: true, anim });
  // boosts (looks in js/boostfx.js)
  add('boost', 'frostbite', 'Frostbite', 'import', { fx: { colors: ['#ffffff', '#a6ecff', '#3a8fd9'], flame: '#a6ecff' } });
  add('boost', 'sakura', 'Petal Storm', 'exotic', { fx: { colors: ['#ffe3ee', '#ff9cc5', '#e05a95'], flame: '#ff9cc5' } });
  add('boost', 'notes', 'Bass Drop', 'blackmarket', { fx: { colors: ['#ffffff', '#7df9ff', '#ff5ad1'], flame: '#7df9ff' } });
  add('boost', 'starpower', 'Star Power', 'import', { fx: { colors: ['#fffde7', '#ffd54f', '#ff9800'], flame: '#ffd54f' } });
  add('boost', 'brimstone', 'Brimstone', 'blackmarket', { fx: { colors: ['#ffd27a', '#ff3d00', '#5c0000'], flame: '#ff3d00' } });
  add('boost', 'cyber', 'Cyber Core', 'veryrare', { fx: { colors: ['#e0fbff', '#00e5ff', '#006dff'], flame: '#00e5ff' } });
  add('boost', 'galaxy', 'Galaxy', 'blackmarket', { fx: { colors: ['#ffffff', '#b388ff', '#304ffe'], flame: '#b388ff' } });
  add('boost', 'confetti', 'Confetti', 'veryrare', { fx: { colors: ['#ff1744', '#ffea00', '#00e676', '#2979ff', '#d500f9'], flame: '#ffffff' } });
  add('boost', 'aurora', 'Aurora', 'blackmarket', { fx: { colors: ['#e0fff2', '#3dffa8', '#7c4dff'], flame: '#69f0ae' } });
  add('boost', 'hellhound', 'Hellhound', 'exotic', { fx: { colors: ['#ffb36b', '#ff4d00', '#7a0000'], flame: '#ff4d00' } });
  add('boost', 'prism', 'Prism', 'exotic', { fx: { colors: ['#ffffff', '#ff4081', '#7c4dff'], flame: '#ffffff' } });
  add('boost', 'warp', 'Warp Drive', 'import', { fx: { colors: ['#ffffff', '#8fd8ff', '#3d5afe'], flame: '#8fd8ff' } });
  add('boost', 'solarflare', 'Solar Flare', 'import', { fx: { colors: ['#ffffff', '#ffd54f', '#ff6d00'], flame: '#ffb300' } });
  add('boost', 'matrix', 'Digital Rain', 'veryrare', { fx: { colors: ['#b9ffc6', '#00ff41', '#003b00'], flame: '#00ff41' } });
  add('boost', 'autumn', 'Autumn Leaves', 'rare', { fx: { colors: ['#ffca28', '#ff7043', '#d84315'], flame: '#ffa726' } });
  add('boost', 'ink', 'Ink Cloud', 'rare', { fx: { colors: ['#3a2a6e', '#1b1240', '#07040f'], flame: '#2a1a5e' } });
  add('boost', 'bubblegum', 'Bubblegum', 'uncommon', { fx: { colors: ['#ffe0f2', '#ff7ac6', '#d81b8c'], flame: '#ff7ac6' } });
  // toppers and antennas (shapes in js/carmodels.js)
  add('topper', 'partyhat', 'Party Hat', 'uncommon', { shape: 'partyhat', color: '#ff4081' });
  add('topper', 'chef', 'Chef Hat', 'uncommon', { shape: 'chef', color: '#fafafa' });
  add('topper', 'bunny', 'Bunny Ears', 'rare', { shape: 'bunny', color: '#f5f5f5' });
  add('topper', 'cat', 'Cat Ears', 'rare', { shape: 'cat', color: '#424242' });
  add('topper', 'mohawk', 'Mohawk', 'rare', { shape: 'mohawk', color: '#76ff03' });
  add('topper', 'sombrero', 'Sombrero', 'veryrare', { shape: 'sombrero', color: '#f9a825' });
  add('topper', 'unicorn', 'Unicorn Horn', 'import', { shape: 'unicorn', color: '#ffe082', glow: true });
  add('antenna', 'donut', 'Donut', 'common', { shape: 'donut', color: '#ff80ab' });
  add('antenna', 'pizza', 'Pizza Slice', 'uncommon', { shape: 'pizza', color: '#ffca28' });
  add('antenna', 'football', 'Football', 'uncommon', { shape: 'football', color: '#f5f5f5' });
  add('antenna', 'moon', 'Crescent Moon', 'rare', { shape: 'moon', color: '#fff59d', glow: true });
  add('antenna', 'rocket', 'Rocket', 'veryrare', { shape: 'rocket', color: '#e53935' });
  add('antenna', 'diamond', 'Diamond', 'import', { shape: 'diamond', color: '#80deea', glow: true });
  // wheel decals
  add('wheeldecal', 'polka', 'Polka Ring', 'uncommon', { ring: 'polka' });
  add('wheeldecal', 'barcode', 'Barcode', 'uncommon', { ring: 'barcode' });
  add('wheeldecal', 'boltring', 'Lightning Ring', 'rare', { ring: 'bolts', color: '#ffea00' });
  add('wheeldecal', 'wavering', 'Wave Ring', 'rare', { ring: 'wave', color: '#40c4ff' });
  add('wheeldecal', 'hearts', 'Heart Ring', 'veryrare', { ring: 'hearts', color: '#ff4081' });
  add('wheeldecal', 'saw', 'Sawblade', 'import', { ring: 'saw', color: '#cfd8dc' });
  // goal explosions (js/effects.js)
  add('explosion', 'petals', 'Cherry Blossom', 'veryrare', { fx: 'petals' });
  add('explosion', 'encore', 'Encore', 'exotic', { fx: 'encore' });
  add('explosion', 'snowstorm', 'Snow Globe', 'import', { fx: 'snowstorm' });
  add('explosion', 'starburst', 'Star Burst', 'import', { fx: 'starburst' });
  add('explosion', 'pixelblast', 'Pixel Blast', 'exotic', { fx: 'pixelblast' });
  // paint finishes
  add('finish', 'brushed', 'Brushed Metal', 'rare', { metal: 0.85, rough: 0.45, clear: 0.2, shin: 70 });
  add('finish', 'frosted', 'Frosted', 'uncommon', { metal: 0.1, rough: 0.72, clear: 0.5, shin: 20 });
  add('finish', 'oilslick', 'Oil Slick', 'exotic', { metal: 0.7, rough: 0.2, clear: 1, irid: 0.85, shin: 150 });
  // titles
  for (const [id, text, rar, extra] of [
    ['turbo', 'TURBO', 'common'], ['skyhigh', 'SKY HIGH', 'uncommon'], ['rotation', 'ROTATION KING', 'uncommon'], ['bump', 'BUMP KING', 'uncommon'],
    ['whiff', 'WHIFF MASTER', 'rare'], ['zerosec', 'ZERO SECONDS LEFT', 'rare'], ['octane', 'OCTANE ENJOYER', 'rare'], ['freestyle', 'FREESTYLER', 'veryrare'],
    ['dribble', 'DRIBBLE GOD', 'veryrare'], ['ceiling', 'CEILING SHOT', 'import'], ['savemachine', 'SAVE MACHINE', 'import'],
    ['nofear', 'NO FEAR', 'exotic', { color: '#ff5252', glow: true }],
  ]) add('title', id, text.charAt(0) + text.slice(1).toLowerCase(), rar, Object.assign({ text }, extra || {}));

  BL.ITEMS = I;
  BL.ITEM_BY_ID = {};
  I.forEach((it) => { BL.ITEM_BY_ID[it.id] = it; });

  // Level rewards (Limited items)
  BL.LEVEL_REWARDS = {};

  // Painted attribute colors
  BL.PAINTS = [
    { id: 'crimson', name: 'Crimson', color: '#d10f1f' },
    { id: 'lime', name: 'Lime', color: '#8cff1a' },
    { id: 'black', name: 'Black', color: '#1a1a1a' },
    { id: 'twhite', name: 'Titanium White', color: '#f5f5f5' },
    { id: 'cobalt', name: 'Cobalt', color: '#2b4bd8' },
    { id: 'sienna', name: 'Burnt Sienna', color: '#8a3b1a' },
    { id: 'saffron', name: 'Saffron', color: '#f2d23c' },
    { id: 'skyblue', name: 'Sky Blue', color: '#5ec8ff' },
    { id: 'pink', name: 'Pink', color: '#ff6fd0' },
    { id: 'purple', name: 'Purple', color: '#8a2be2' },
    { id: 'forest', name: 'Forest Green', color: '#1f7a2a' },
    { id: 'orange', name: 'Orange', color: '#ff7a00' },
    { id: 'grey', name: 'Grey', color: '#8a8a8a' },
    { id: 'gold', name: 'Gold', color: '#d4af37' },
  ];
  BL.PAINT_BY_ID = {};
  BL.PAINTS.forEach((p) => { BL.PAINT_BY_ID[p.id] = p; });

  // Certified attributes: cert -> which match stat it counts
  BL.CERTS = [
    { id: 'striker', name: 'Striker', stat: 'goals' },
    { id: 'goalkeeper', name: 'Goalkeeper', stat: 'saves' },
    { id: 'playmaker', name: 'Playmaker', stat: 'assists' },
    { id: 'sniper', name: 'Sniper', stat: 'longGoals' },
    { id: 'aviator', name: 'Aviator', stat: 'aerialGoals' },
    { id: 'victor', name: 'Victor', stat: 'wins' },
    { id: 'paragon', name: 'Paragon', stat: 'mvps' },
    { id: 'tactician', name: 'Tactician', stat: 'shots' },
    { id: 'juggler', name: 'Juggler', stat: 'touches' },
    { id: 'scorer', name: 'Scorer', stat: 'score' },
    { id: 'showoff', name: 'Show-Off', stat: 'aerialHits' },
    { id: 'destroyer', name: 'Destroyer', stat: 'demos' },
  ];
  BL.CERT_BY_ID = {};
  BL.CERTS.forEach((c) => { BL.CERT_BY_ID[c.id] = c; });

  // Team body color shades
  BL.TEAM_COLORS = [
    ['#1e6bff', '#0d47a1', '#2196f3', '#00b0ff', '#3949ab', '#00bcd4', '#5c6bc0', '#14d4ff'],
    ['#ff6d00', '#ff9100', '#ff3d00', '#ffab00', '#f4511e', '#ffc400', '#e65100', '#ff7043'],
  ];
  BL.TEAM_MAIN = ['#2f7bff', '#ff8a1f'];
  BL.TEAM_NAMES = ['BLUE', 'ORANGE'];
  // club colours (js/club.js): primary / accent picks, the tag on your name is in the primary
  BL.CLUB_COLORS = ['#2f7bff', '#ff8a1f', '#33d17a', '#e5484d', '#b05cff', '#ffd23f', '#f5f5f5', '#1a1a1a'];
  BL.ACCENT_COLORS = ['#f5f5f5', '#bdbdbd', '#616161', '#151515', '#d50000', '#ff4081', '#aa00ff', '#651fff',
    '#2962ff', '#00b8d4', '#00c853', '#64dd17', '#aeea00', '#ffd600', '#ff6d00', '#8d6e63', '#ffd23f', '#00e5ff', '#76ff03', '#ff1744'];

  // Maps
  BL.MAPS = [
    {
      id: 'champions', name: 'Champions Field', desc: 'Sunny classic stadium',
      sky: ['#2f80e6', '#cfe8ff'], fog: '#b8d8f8', fogDensity: 0.0022,
      floor: { type: 'grass', a: '#3e9b36', b: '#378b2f', line: 'rgba(255,255,255,0.9)' },
      wall: { alpha: 0.2, base: '#d9e7ff' },
      light: { sun: '#fff1d6', sunI: 1.15, sunDir: [0.35, 1, 0.3], hemiSky: '#d3e8ff', hemiGround: '#3c5b2c', hemiI: 0.7 },
      stands: { color: '#2b3342', crowd: ['#ffffff', '#2f7bff', '#ff8a1f', '#ffd23f', '#e53935'] }, decor: 'trees', time: 'day',
    },
    {
      id: 'neon', name: 'Neon Nights', desc: 'Cyberpunk city under the night sky',
      sky: ['#080018', '#3a0a5e'], fog: '#1a0630', fogDensity: 0.004,
      floor: { type: 'neon', a: '#0c0f1e', b: '#10142a', line: 'rgba(0,229,255,0.9)', glow: '#ff2bd6' },
      wall: { alpha: 0.28, base: '#ff2bd6' },
      light: { sun: '#b388ff', sunI: 0.55, sunDir: [-0.3, 1, 0.2], hemiSky: '#6a1b9a', hemiGround: '#0d47a1', hemiI: 0.8 },
      stands: { color: '#120b22', crowd: ['#00e5ff', '#ff2bd6', '#ffffff', '#b388ff'] }, decor: 'city', time: 'night',
    },
    {
      id: 'arctic', name: 'Frostbite Arena', desc: 'Snowy mountain stadium',
      sky: ['#7fa6c9', '#eef6ff'], fog: '#dde9f5', fogDensity: 0.003,
      floor: { type: 'snow', a: '#e8f1fa', b: '#dbe8f5', line: 'rgba(40,120,220,0.85)' },
      wall: { alpha: 0.22, base: '#bfe3ff' },
      light: { sun: '#ffffff', sunI: 0.95, sunDir: [0.2, 0.8, -0.4], hemiSky: '#ffffff', hemiGround: '#9ab7d3', hemiI: 0.85 },
      stands: { color: '#46566b', crowd: ['#ffffff', '#90caf9', '#e53935', '#2f7bff'] }, decor: 'mountains', time: 'day', snow: true,
    },
    {
      id: 'dunes', name: 'Sandstorm Dunes', desc: 'Scorching desert wasteland',
      sky: ['#d9792b', '#ffd9a0'], fog: '#f0c48a', fogDensity: 0.003,
      floor: { type: 'sand', a: '#c9a063', b: '#bf955a', line: 'rgba(255,250,235,0.85)' },
      wall: { alpha: 0.2, base: '#ffe0b2' },
      light: { sun: '#ffd8a8', sunI: 1.2, sunDir: [-0.5, 0.7, 0.3], hemiSky: '#ffd180', hemiGround: '#8d6e63', hemiI: 0.7 },
      stands: { color: '#5a4030', crowd: ['#ffe0b2', '#ff7043', '#8d6e63', '#ffffff'] }, decor: 'dunes', time: 'day',
    },
    {
      id: 'starbase', name: 'Starbase Orbit', desc: 'Zero-atmosphere arena in space',
      sky: ['#000005', '#0b1030'], fog: '#05060f', fogDensity: 0.0015,
      floor: { type: 'metal', a: '#2a2f3a', b: '#323846', line: 'rgba(120,200,255,0.9)', glow: '#40c4ff' },
      wall: { alpha: 0.26, base: '#80d8ff' },
      light: { sun: '#e3f2fd', sunI: 1.0, sunDir: [0.6, 0.9, -0.2], hemiSky: '#5c6bc0', hemiGround: '#111122', hemiI: 0.6 },
      stands: { color: '#1b1e2a', crowd: ['#80d8ff', '#ffffff', '#b388ff'] }, decor: 'space', time: 'night',
    },
    {
      id: 'sunset', name: 'Sunset Park', desc: 'Golden hour in the city park',
      sky: ['#5b3a8c', '#ff9a5a'], fog: '#e8a07a', fogDensity: 0.0028,
      floor: { type: 'grass', a: '#4f8f34', b: '#47812f', line: 'rgba(255,245,230,0.9)' },
      wall: { alpha: 0.2, base: '#ffd0a8' },
      light: { sun: '#ffb27a', sunI: 1.1, sunDir: [-0.8, 0.35, 0.4], hemiSky: '#ffb3c6', hemiGround: '#3d4f2a', hemiI: 0.7 },
      stands: { color: '#3b2f3f', crowd: ['#ffffff', '#ff8a65', '#2f7bff', '#ffd54f'] }, decor: 'trees', time: 'dusk',
    },
    {
      id: 'magma', name: 'Magma Core', desc: 'Built inside an active volcano',
      sky: ['#120202', '#5a1206'], fog: '#2a0703', fogDensity: 0.004,
      floor: { type: 'rock', a: '#2b211f', b: '#33261f', line: 'rgba(255,140,40,0.9)', glow: '#ff5722' },
      wall: { alpha: 0.26, base: '#ff7043' },
      light: { sun: '#ff8a50', sunI: 0.8, sunDir: [0.2, 1, 0.1], hemiSky: '#ff7043', hemiGround: '#210000', hemiI: 0.75 },
      stands: { color: '#1e1110', crowd: ['#ff7043', '#ffd54f', '#ffffff'] }, decor: 'volcano', time: 'night', embers: true,
    },
    {
      id: 'blossom', name: 'Blossom Gardens', desc: 'Cherry trees in full bloom, petals on the breeze',
      sky: ['#5b97e6', '#ffe3ef'], fog: '#f4d7e5', fogDensity: 0.0024,
      floor: { type: 'grass', a: '#4f9b45', b: '#47903d', line: 'rgba(255,255,255,0.9)' },
      wall: { alpha: 0.2, base: '#ffd6e8' },
      light: { sun: '#fff0e6', sunI: 1.1, sunDir: [-0.4, 1, 0.35], hemiSky: '#ffe3f0', hemiGround: '#40603a', hemiI: 0.72 },
      stands: { color: '#3a2f3b', crowd: ['#ffffff', '#ff8fb8', '#2f7bff', '#ff8a1f', '#ffd1e1'] }, decor: 'blossom', time: 'day', petals: true,
    },
    {
      id: 'harbor', name: 'Storm Harbor', desc: 'A rainy night down at the docks, lightning over the bay',
      sky: ['#04070d', '#1b2736'], fog: '#0e1722', fogDensity: 0.0042,
      floor: { type: 'metal', a: '#27313d', b: '#2c3744', line: 'rgba(235,244,255,0.92)', glow: '#7fb8ff', rough: 0.28, metal: 0.55 },
      wall: { alpha: 0.24, base: '#9cc7ff' },
      light: { sun: '#9fb4d8', sunI: 0.5, sunDir: [0.3, 1, -0.4], hemiSky: '#2b3e5e', hemiGround: '#06080c', hemiI: 0.6 },
      stands: { color: '#151b24', crowd: ['#ffd23f', '#ffffff', '#2f7bff', '#ff8a1f'] }, decor: 'harbor', time: 'night', rain: true, noVariant: true, themed: true,
    },
    {
      id: 'reef', name: 'Coral Reef', desc: 'A glass dome on the sea floor, sunlight rippling through the waves',
      sky: ['#012a3a', '#0c8a96'], fog: '#0a5262', fogDensity: 0.0068,
      floor: { type: 'sand', a: '#8d8461', b: '#857c5a', line: 'rgba(235,255,250,0.8)' },
      wall: { alpha: 0.24, base: '#8ff3ff' },
      light: { sun: '#c4f7ff', sunI: 0.85, sunDir: [0.1, 1, 0.2], hemiSky: '#5fd2e0', hemiGround: '#163c44', hemiI: 0.7 },
      stands: { color: '#123a44', crowd: ['#2ee6d6', '#ffd23f', '#ffffff', '#ff7a45'] }, decor: 'reef', time: 'day', bubbles: true, caustics: true, themed: true,
    },
    {
      id: 'mini', name: 'Mini Pitch', desc: 'Labs: tiny arena, chaos guaranteed',
      sky: ['#1aa0a0', '#d6fff6'], fog: '#bff2ea', fogDensity: 0.003,
      floor: { type: 'grass', a: '#46a63c', b: '#3e9535', line: 'rgba(255,255,255,0.9)' },
      wall: { alpha: 0.22, base: '#d6fff6' },
      light: { sun: '#ffffff', sunI: 1.1, sunDir: [0.3, 1, 0.5], hemiSky: '#e0fff8', hemiGround: '#3c5b2c', hemiI: 0.75 },
      stands: { color: '#284040', crowd: ['#ffffff', '#2f7bff', '#ff8a1f'] }, decor: 'trees', time: 'day',
      arena: { hw: 30, hl: 38, h: 14, cornerR: 8, goalHW: 7.5, goalH: 5.5 }, labs: true,
    },
    {
      id: 'pillars', name: 'Pillars Lab', desc: 'Labs: giant pillars block the field',
      sky: ['#263238', '#90a4ae'], fog: '#78909c', fogDensity: 0.0032,
      floor: { type: 'metal', a: '#3a4249', b: '#424b53', line: 'rgba(255,214,0,0.9)', glow: '#ffd600' },
      wall: { alpha: 0.22, base: '#ffd600' },
      light: { sun: '#ffffff', sunI: 1.0, sunDir: [0.4, 1, 0.2], hemiSky: '#cfd8dc', hemiGround: '#37474f', hemiI: 0.75 },
      stands: { color: '#263238', crowd: ['#ffd600', '#ffffff', '#2f7bff', '#ff8a1f'] }, decor: 'city', time: 'day',
      arena: { obstacles: [{ x: -13, z: 0, r: 4.2, h: 30 }, { x: 13, z: 0, r: 4.2, h: 30 }] }, labs: true,
    },
  ];
  // Every arena also comes in the other time of day, like the real game's map variants ("Champions Field (Night)"):
  // night ones have a dark sky, moonlight and the floodlights on; day versions of the night arenas get sunshine.
  // (Labs arenas stay as they are.)
  const mixCol = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();
  function timeVariant(m, to) {
    const v = JSON.parse(JSON.stringify(m));
    v.id = m.id + '_' + to; v.variantOf = m.id; v.time = to;
    v.name = m.name + (to === 'night' ? ' (Night)' : ' (Day)');
    if (to === 'night') {
      v.desc = m.desc.replace(/\.$/, '') + ' under the floodlights';
      v.sky = [mixCol(m.sky[0], '#02040c', 0.85), mixCol(m.sky[1], '#16213f', 0.8)];
      v.fog = mixCol(m.fog, '#0a1020', 0.85); v.fogDensity = m.fogDensity * 1.1;
      v.light = { sun: '#a8bfff', sunI: 0.4, sunDir: m.light.sunDir, hemiSky: mixCol(m.light.hemiSky, '#1c2a52', 0.75), hemiGround: mixCol(m.light.hemiGround, '#05070d', 0.7), hemiI: 0.55 };
    } else {
      v.desc = m.desc.replace(/\.$/, '') + ' in daylight';
      v.sky = [mixCol('#2f80e6', m.sky[0], 0.25), mixCol('#cfe8ff', m.sky[1], 0.2)];
      v.fog = mixCol('#b8d8f8', m.fog, 0.25); v.fogDensity = m.fogDensity * 0.85;
      v.light = { sun: '#fff1d6', sunI: 1.15, sunDir: [0.35, 1, 0.3], hemiSky: mixCol('#d3e8ff', m.light.hemiSky, 0.25), hemiGround: mixCol(m.floor.a, '#000000', 0.4), hemiI: 0.72 };
    }
    return v;
  }
  // (a stormy night stays stormy: no daylight version)
  BL.MAPS = BL.MAPS.flatMap((m) => (m.labs || m.noVariant ? [m] : [m, timeVariant(m, m.time === 'night' ? 'day' : 'night')]));
  BL.MAP_BY_ID = {};
  BL.MAPS.forEach((m) => { BL.MAP_BY_ID[m.id] = m; });

  BL.MODES = {
    soccar: { id: 'soccar', name: 'Soccar', desc: 'Classic car soccer.' },
    rumble: { id: 'rumble', name: 'Rumble', desc: 'Crazy power-ups every few seconds.' },
    heatseeker: { id: 'heatseeker', name: 'Heatseeker', desc: 'The ball homes in on the goal after every touch.' },
    freeplay: { id: 'freeplay', name: 'Free Play', desc: 'Practice alone with unlimited boost.' },
  };

  BL.MUTATORS = {
    matchLength: { name: 'Match Length', opts: [[120, '2 Minutes'], [180, '3 Minutes'], [300, '5 Minutes'], [600, '10 Minutes'], [0, 'Unlimited']], def: 300 },
    ballSize: { name: 'Ball Size', opts: [[0.75, 'Small'], [1, 'Default'], [1.4, 'Large'], [2, 'Gigantic']], def: 1 },
    ballBounce: { name: 'Ball Bounciness', opts: [[0.4, 'Low'], [0.6, 'Default'], [0.85, 'High'], [1.02, 'Super High']], def: 0.6 },
    ballSpeed: { name: 'Ball Max Speed', opts: [[0.6, 'Slow'], [1, 'Default'], [1.5, 'Super Fast']], def: 1 },
    gravity: { name: 'Gravity', opts: [[0.35, 'Super Low'], [0.6, 'Low'], [1, 'Default'], [1.6, 'High']], def: 1 },
    gameSpeed: { name: 'Game Speed', opts: [[0.75, 'Slow-Mo'], [1, 'Default'], [1.2, 'Turbo']], def: 1 },
    boost: { name: 'Boost Amount', opts: [['normal', 'Default'], ['unlimited', 'Unlimited'], ['recharge', 'Recharge'], ['none', 'No Boost']], def: 'normal' },
    demolish: { name: 'Demolish', opts: [['normal', 'Default'], ['off', 'Disabled'], ['friendly', 'Friendly Fire'], ['contact', 'On Contact']], def: 'normal' },
  };
  BL.defaultMutators = () => { const m = {}; for (const k in BL.MUTATORS) m[k] = BL.MUTATORS[k].def; return m; };

  BL.RUMBLE_ITEMS = [
    { id: 'spikes', name: 'Spikes', icon: 'spikes', desc: 'Ball sticks to your car' },
    { id: 'magnet', name: 'Magnetizer', icon: 'magnet', desc: 'Pulls the ball toward you' },
    { id: 'freeze', name: 'Freezer', icon: 'freeze', desc: 'Freezes the ball in place' },
    { id: 'punch', name: 'Haymaker', icon: 'punch', desc: 'Punches the ball away from you' },
    { id: 'plunger', name: 'Plunger', icon: 'plunger', desc: 'Yanks the ball toward you' },
    { id: 'boot', name: 'Boot', icon: 'boot', desc: 'Kicks the nearest opponent' },
    { id: 'power', name: 'Power Hitter', icon: 'power', desc: 'Super-strong hits & demos' },
    { id: 'grapple', name: 'Grappling Hook', icon: 'grapple', desc: 'Pulls you to the ball' },
    { id: 'swap', name: 'Swapper', icon: 'swap', desc: 'Swap places with an opponent' },
    { id: 'tornado', name: 'Tornado', icon: 'tornado', desc: 'A vortex that lifts the ball and cars' },
    { id: 'disrupt', name: 'Disruptor', icon: 'disrupt', desc: "Scrambles the nearest opponent's controls" },
  ];

  BL.QUICKCHAT = [
    ['I got it!', 'Need boost!', 'Take the shot!', 'Defending...'],
    ['Nice shot!', 'Great pass!', 'Thanks!', 'What a save!'],
    ['OMG!', 'Noooo!', 'Wow!', 'Close one!'],
    ['$#@%!', 'No problem.', 'Whoops...', 'Sorry!'],
  ];
  BL.QUICKCHAT_GROUPS = ['Information', 'Compliments', 'Reactions', 'Apologies'];
  // your quick chats (Settings > Chat): your own lines, with the defaults in any slot left blank
  BL.quickChats = () => {
    const qc = (BL.Save && BL.Save.p && BL.Save.p.settings.qc) || [];
    return BL.QUICKCHAT.map((g, gi) => g.map((m, i) => (qc[gi] && qc[gi][i]) || m));
  };
  // once the match is over, quick chat switches to the post-game lines (like the real game)
  BL.QUICKCHAT_POST = {
    groups: ['Post-Game', 'Post-Game', 'Compliments', 'Reactions'],
    lines: [['gg', 'Well played.', 'That was fun!', 'What a game!'], ['Rematch!', 'One. More. Game.', 'Nice moves.', 'Everybody dance!'], BL.QUICKCHAT[1], BL.QUICKCHAT[2]],
  };

  BL.BOT_NAMES = ['Blaze', 'Comet', 'Turbo', 'Rex', 'Nitro', 'Bolt', 'Ace', 'Storm', 'Goose', 'Iceman', 'Hound', 'Bandit',
    'Dash', 'Spike', 'Jinx', 'Echo', 'Flash', 'Tank', 'Chip', 'Zed', 'Ozzy', 'Maverick', 'Rocket', 'Sparky', 'Ziggy', 'Moose', 'Pixel', 'Duke'];

  // Online bots use player-style names so matches feel full: twelve thousand of them, put together the way people
  // name themselves (two words, a word and a number, a first name, a streamer tag, leet spelling, lower case...),
  // the same list every time so a name means the same bot. js/namefilter.js runs them through the swear filter.
  const NAME_A = ['Turbo', 'Nitro', 'Neon', 'Shadow', 'Frost', 'Blaze', 'Storm', 'Cyber', 'Pixel', 'Hyper', 'Mega', 'Ultra', 'Dark', 'Light', 'Silent', 'Rapid', 'Swift', 'Sonic', 'Super', 'Lucky',
    'Crazy', 'Wild', 'Savage', 'Epic', 'Royal', 'Golden', 'Silver', 'Crimson', 'Cobalt', 'Toxic', 'Mystic', 'Cosmic', 'Lunar', 'Solar', 'Astro', 'Retro', 'Quantum', 'Atomic', 'Electric', 'Frozen',
    'Burning', 'Flying', 'Rolling', 'Flipping', 'Dizzy', 'Sleepy', 'Hungry', 'Angry', 'Happy', 'Grumpy', 'Tiny', 'Giant', 'Mini', 'Jumbo', 'Sneaky', 'Spicy', 'Salty', 'Sweet', 'Sour', 'Fresh',
    'Funky', 'Chill', 'Icy', 'Fiery', 'Stormy', 'Rusty', 'Shiny', 'Glitchy', 'Mighty', 'Noble', 'Rogue', 'Phantom', 'Ghost', 'Void', 'Nova', 'Vortex', 'Zero', 'Alpha', 'Omega', 'Delta',
    'Prime', 'Apex', 'Elite', 'Pro', 'Rookie', 'Captain', 'Major', 'Agent', 'Doctor', 'Professor', 'King', 'Queen', 'Lord', 'Lady', 'Baron', 'Duke', 'Sir', 'Mad', 'Bad', 'Rad',
    'Big', 'Lil', 'Old', 'Young', 'Lone', 'Twin', 'Double', 'Triple', 'Hot', 'Cold', 'Fast', 'Slow', 'Loud', 'Quiet', 'Blue', 'Orange', 'Purple', 'Green', 'Red', 'Black',
    'White', 'Pink', 'Jade', 'Ruby', 'Amber', 'Onyx', 'Iron', 'Steel', 'Chrome', 'Carbon', 'Diamond', 'Platinum', 'Bronze', 'Smol', 'Chonky', 'Spooky', 'Sparkly', 'Soggy', 'Crispy', 'Fluffy'];
  const NAME_B = ['Fox', 'Wolf', 'Bear', 'Tiger', 'Lion', 'Panda', 'Koala', 'Otter', 'Shark', 'Whale', 'Dolphin', 'Eagle', 'Hawk', 'Falcon', 'Raven', 'Crow', 'Owl', 'Duck', 'Goose', 'Penguin',
    'Frog', 'Toad', 'Gecko', 'Dragon', 'Phoenix', 'Griffin', 'Unicorn', 'Yeti', 'Goblin', 'Wizard', 'Knight', 'Ninja', 'Samurai', 'Pirate', 'Viking', 'Bandit', 'Cowboy', 'Sheriff', 'Ranger', 'Hunter',
    'Sniper', 'Striker', 'Keeper', 'Goalie', 'Rocket', 'Comet', 'Meteor', 'Star', 'Moon', 'Planet', 'Galaxy', 'Nebula', 'Thunder', 'Lightning', 'Blizzard', 'Tornado', 'Tsunami', 'Volcano', 'Avalanche', 'Glacier',
    'Flame', 'Spark', 'Ember', 'Smoke', 'Spirit', 'Reaper', 'Titan', 'Golem', 'Robot', 'Cyborg', 'Droid', 'Mech', 'Pilot', 'Racer', 'Driver', 'Rider', 'Drifter', 'Flyer', 'Jumper', 'Dasher',
    'Crasher', 'Smasher', 'Blaster', 'Buster', 'Boomer', 'Zoomer', 'Taco', 'Burrito', 'Nacho', 'Pickle', 'Waffle', 'Pancake', 'Muffin', 'Cookie', 'Donut', 'Bagel', 'Noodle', 'Pretzel', 'Peanut', 'Mango',
    'Banana', 'Cherry', 'Lemon', 'Pepper', 'Potato', 'Tomato', 'Biscuit', 'Nugget', 'Cheese', 'Butter', 'Toast', 'Beans', 'Sauce', 'Soda', 'Latte', 'Mocha', 'Cocoa', 'Byte', 'Glitch', 'Lag',
    'Ping', 'Bug', 'Patch', 'Boost', 'Engine', 'Piston', 'Gear', 'Wheel', 'Tire', 'Axle', 'Bumper', 'Spoiler', 'Hood', 'Fender', 'Exhaust', 'Wrench', 'Hammer', 'Anvil', 'Blade', 'Arrow',
    'Dagger', 'Shield', 'Helmet', 'Crown', 'Cape', 'Boot', 'Sock', 'Hat', 'Jacket', 'Goggles', 'Mask', 'Kiwi', 'Melon', 'Plum', 'Peach', 'Grape', 'Olive', 'Walnut', 'Cashew', 'Pudding',
    'Jelly', 'Candy', 'Gummy', 'Lolly', 'Mint', 'Fudge', 'Bubble', 'Bolt', 'Nut', 'Screw', 'Spring', 'Cog', 'Rotor', 'Turbine', 'Jet', 'Blimp', 'Kart', 'Buggy', 'Truck', 'Van',
    'Bus', 'Train', 'Tram', 'Sled', 'Scooter', 'Skate', 'Puck', 'Bat', 'Ball', 'Net', 'Post', 'Goal', 'Pitch', 'Arena', 'Stadium', 'Llama', 'Alpaca', 'Capybara', 'Axolotl', 'Hedgehog',
    'Raccoon', 'Badger', 'Moose', 'Bison', 'Lynx', 'Cobra', 'Viper', 'Python', 'Mantis', 'Hornet', 'Wasp', 'Beetle', 'Cricket', 'Shrimp', 'Crab', 'Squid', 'Octopus', 'Jellyfish', 'Narwhal', 'Walrus'];
  const NAME_F = ['Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'Lucas', 'Mason', 'Ethan', 'Logan', 'Aiden', 'Jack', 'Owen', 'Leo', 'Max', 'Finn', 'Theo', 'Oscar', 'Felix', 'Hugo', 'Luca',
    'Mateo', 'Diego', 'Santiago', 'Thiago', 'Rafael', 'Gabriel', 'Nico', 'Enzo', 'Marco', 'Luis', 'Pablo', 'Javier', 'Andres', 'Carlos', 'Mats', 'Lukas', 'Jonas', 'Jan', 'Tim', 'Lars',
    'Erik', 'Sven', 'Nils', 'Axel', 'Oskar', 'Kai', 'Yuki', 'Haru', 'Ren', 'Sora', 'Riku', 'Kenji', 'Hiro', 'Taro', 'Jin', 'Min', 'Jun', 'Chen', 'Wei', 'Ming',
    'Hao', 'Aarav', 'Arjun', 'Vihaan', 'Rohan', 'Dev', 'Ravi', 'Omar', 'Ali', 'Sami', 'Zayn', 'Amir', 'Yusuf', 'Karim', 'Tariq', 'Kofi', 'Kwame', 'Amara', 'Zara', 'Mia',
    'Emma', 'Ava', 'Sophia', 'Isla', 'Luna', 'Nora', 'Zoe', 'Chloe', 'Lily', 'Ella', 'Maya', 'Aria', 'Nina', 'Lena', 'Hana', 'Yuna', 'Sana', 'Mei', 'Rin', 'Aya',
    'Leila', 'Noor', 'Priya', 'Anya', 'Sofia', 'Valentina', 'Camila', 'Lucia', 'Elena', 'Ines', 'Clara', 'Freya', 'Ida', 'Saga', 'Elsa', 'Stella', 'Ivy', 'Tessa', 'Sky', 'Remy',
    'Blake', 'Riley', 'Quinn', 'Rowan', 'Sage', 'Reese', 'Casey', 'Drew', 'Jordan', 'Taylor', 'Morgan', 'Kit', 'Rio', 'Ziggy', 'Ozzy', 'Rex', 'Milo', 'Arlo', 'Ezra', 'Jude',
    'Kaito', 'Ryan', 'Dan', 'Sam', 'Ben', 'Tom', 'Joe', 'Alex', 'Chris', 'Nick', 'Matt', 'Josh', 'Jake', 'Kyle', 'Tyler', 'Cody', 'Dylan', 'Evan', 'Ryder', 'Zane'];
  const NAME_R = ['Musty', 'Flip', 'Pinch', 'Ceiling', 'Aerial', 'Demo', 'Bump', 'Wave', 'Dash', 'Boost', 'Kickoff', 'Reset', 'Speed', 'Clear', 'Save', 'Shot', 'Dribble', 'Pop', 'Flick', 'Wall',
    'Backboard', 'Redirect', 'Stall', 'Hover', 'Drift', 'Supersonic', 'Rumble', 'Dropshot', 'Hoops', 'Snowday', 'Heatseeker', 'Ranked', 'Champ', 'Plat', 'Whiff', 'Clutch', 'Snipe', 'Chip', 'Lob', 'Volley'];
  BL.ONLINE_BOT_NAMES = (() => {
    const seen = new Set(), out = [], rnd = BL.util.rng(20261111);
    const put = (n) => { n = String(n).slice(0, 15); const k = n.toLowerCase(); if (n.length < 3 || seen.has(k)) return; seen.add(k); out.push(n); };
    ['Turbo_Taco', 'xBlaze', 'NitroNinja', 'AerialAce07', 'PixelDrift', 'Sk1llz', 'FlipReset', 'BallChaser99', 'SnipeGod', 'Kaito', 'Vroom', 'MidfieldMaestro', 'KickoffKing', 'DemoDan',
      'WallWizard', 'CeilingShot', 'NovaRL', 'Zeph', 'Moxie', 'GoalieGoblin', 'SpeedFlip', 'RocketRyan', 'BoostBandit', 'Saucey', 'Lil_Musty', 'Clutch', 'PogChamp88', 'Duckie'].forEach(put);
    const pick = (a) => a[Math.floor(rnd() * a.length)], n2 = () => String(Math.floor(rnd() * 100)).padStart(2, '0');
    const leet = (s) => s.replace(/[aeio]/gi, (c) => (rnd() < 0.5 ? ({ a: '4', e: '3', i: '1', o: '0' })[c.toLowerCase()] : c));
    const STYLES = [
      () => pick(NAME_A) + pick(NAME_B), () => pick(NAME_A) + pick(NAME_B), () => pick(NAME_A) + pick(NAME_B) + n2(), () => pick(NAME_B) + '_' + pick(NAME_A),
      () => pick(NAME_F), () => pick(NAME_F) + n2(), () => pick(NAME_F) + (2000 + Math.floor(rnd() * 14)), () => 'Itz' + pick(NAME_F), () => 'TTV_' + pick(NAME_A) + pick(NAME_B),
      () => pick(NAME_B) + 'YT', () => (rnd() < 0.5 ? 'Lil' : 'Big') + pick(NAME_B), () => (rnd() < 0.5 ? 'Dr' : 'Mr') + pick(NAME_B), () => 'The' + pick(NAME_A) + pick(NAME_B),
      () => leet(pick(NAME_A) + pick(NAME_B)), () => (pick(NAME_A) + pick(NAME_B)).toLowerCase(), () => pick(NAME_R) + pick(NAME_B), () => pick(NAME_R) + pick(NAME_F), () => pick(NAME_F) + pick(NAME_R),
      () => pick(NAME_B) + '.' + pick(NAME_A).toLowerCase(), () => 'Not' + pick(NAME_F), () => pick(NAME_R) + 'King', () => pick(NAME_A) + pick(NAME_B) + '_' + (1 + Math.floor(rnd() * 9)),
      () => 'x' + pick(NAME_B) + 'x', () => pick(NAME_F) + 'RL', () => pick(NAME_B) + 'Main', () => pick(NAME_A) + pick(NAME_F), () => pick(NAME_F) + '_' + pick(NAME_B).toLowerCase(),
      () => pick(NAME_R) + 'Merchant', () => 'Just' + pick(NAME_F), () => pick(NAME_B) + n2() + n2(),
    ];
    for (let i = 0; out.length < 12000 && i < 80000; i++) put(STYLES[Math.floor(rnd() * STYLES.length)]());
    return out;
  })();
  // Some online bots belong to clubs, like real players: a club tag in the club's colour before their name. Which
  // club (if any) goes by the name, so a bot always shows the same tag wherever it turns up.
  BL.BOT_CLUBS = [['Nitro Knights', 'NTRO', 0], ['Aerial Assassins', 'AERO', 3], ['Flip Reset Gang', 'FRG', 4], ['Supersonic Squad', 'SSQ', 1], ['Boost Bandits', 'BNDT', 5], ['Ceiling Shots', 'CEIL', 2],
    ['Demo Dogs', 'DEMO', 3], ['Pinch Pros', 'PNCH', 0], ['Musty Mafia', 'MSTY', 2], ['Wall Walkers', 'WALL', 7], ['Kickoff Kings', 'KOK', 5], ['Backboard Boys', 'BBB', 1], ['Dribble Dynasty', 'DRBL', 4],
    ['Octane Outlaws', 'OCTN', 1], ['Fennec Force', 'FNNC', 0], ['Dominus Dons', 'DMNS', 3], ['Rumble Rats', 'RMBL', 5], ['Hoops Heroes', 'HOOP', 1], ['Snow Day Crew', 'SNOW', 6], ['Dropshot Dept', 'DROP', 4],
    ['Zero Second Goals', 'ZSG', 7], ['Whiff City', 'WHFF', 2], ['Rotation Nation', 'ROT8', 0], ['Clutch Club', 'CLCH', 3], ['Speed Flippers', 'SPDF', 5], ['Air Dribblers', 'AIRD', 1], ['Double Taps', 'DBLT', 4],
    ['Bumper Cars', 'BUMP', 3], ['Goalie Guild', 'GOAL', 0], ['Midfield Mob', 'MIDF', 2], ['Corner Boost Co', 'CBC', 5], ['Lag Switchers', 'LAG', 7], ['Ping Pals', 'PING', 1], ['Sunday League', 'SUN', 5],
    ['Night Owls RL', 'OWL', 4], ['Late Boomers', 'BOOM', 3], ['Ball Chasers', 'CHAS', 1], ['Orange Peel', 'PEEL', 1], ['Blue Shells', 'SHEL', 0], ['Chrome Hearts', 'CHRM', 6], ['Nebula Nine', 'NEB9', 4],
    ['Comet Club', 'CMET', 0], ['Vortex Vipers', 'VRTX', 2], ['Glitch Mob', 'GLTC', 4], ['Pixel Pushers', 'PXL', 5], ['Taco Tuesday', 'TACO', 1], ['Waffle House', 'WFFL', 5], ['Noodle Arms', 'NDL', 2],
    ['Capybara Collective', 'CAPY', 2], ['Axolotl Army', 'AXO', 6], ['Penguin Patrol', 'PNGN', 0], ['Honey Badgers', 'HNY', 5], ['Grand Champ Wannabes', 'GCW', 3], ['SSL Someday', 'SSL', 7], ['Bronze Legends', 'BRNZ', 1],
    ['Plat Chat', 'PLAT', 6], ['Diamond Dogs', 'DIAM', 0], ['Champ Camp', 'CAMP', 4], ['Freeplay Forever', 'FRPL', 2], ['Replay Reviewers', 'RPLY', 7]];
  BL.botClub = (name) => {
    const h = BL.util.hash('club' + name) >>> 0;
    if (h % 100 >= 35) return null;
    const c = BL.BOT_CLUBS[(h >>> 8) % BL.BOT_CLUBS.length];
    return { name: c[0], tag: c[1], tagc: c[2] };
  };
  BL.RANKS = [
    { name: 'Bronze', color: '#b07a4a', min: 0 },
    { name: 'Silver', color: '#c9d1d9', min: 300 },
    { name: 'Gold', color: '#ffcc33', min: 500 },
    { name: 'Platinum', color: '#4fd1c5', min: 700 },
    { name: 'Diamond', color: '#4f8dff', min: 900 },
    { name: 'Champion', color: '#b05cff', min: 1100 },
    { name: 'Grand Champion', color: '#ff3b3b', min: 1350 },
    { name: 'Supersonic Legend', color: '#f5f5f5', min: 1600 },
  ];
  BL.PLAYLISTS = [
    { id: 'duel', name: 'Duel', size: 1 },
    { id: 'doubles', name: 'Doubles', size: 2 },
    { id: 'standard', name: 'Standard', size: 3 },
    { id: 'heatseeker', name: 'Heatseeker', size: 2, mode: 'heatseeker', extra: true },
    { id: 'rumble', name: 'Rumble', size: 3, mode: 'rumble', extra: true },
  ];

  // Maps / modes that unlock as you level up
  BL.MAP_UNLOCKS = { champions: 1, neon: 1, sunset: 1, blossom: 1, harbor: 1, reef: 1, arctic: 2, dunes: 3, starbase: 4, magma: 6, mini: 8, pillars: 10 };
  BL.MODE_UNLOCKS = { soccar: 1, freeplay: 1, rumble: 2, heatseeker: 4 };

  // ---------- Season Pass ----------
  BL.PASS = { season: 1, name: 'ROCKET PASS — SEASON 1', tiers: 300, mainTiers: 40, xpPerTier: 650, premiumPrice: 1000, skipPrice: 120 };
  // reward: { type: 'item'|'drop'|'credits', id, paint, rarity, n }
  const it = (id, paint) => ({ type: 'item', id, paint: paint || null });
  const drop = (rarity) => ({ type: 'drop', rarity });
  const cr = (n) => ({ type: 'credits', n });
  const FREE = {
    1: it('title_s1rookie'), 2: cr(50), 5: it('title_founder'), 4: drop('rare'), 6: it('topper_beanie'), 8: cr(75), 10: it('decal_s1'), 12: drop('rare'),
    14: it('wheels_slicer'), 16: cr(100), 18: drop('veryrare'), 20: it('antenna_s1flag'), 22: cr(100), 24: drop('rare'), 26: it('decal_s1', 'cobalt'),
    28: cr(150), 30: it('wheels_golden'), 32: it('wheels_slicer', 'crimson'), 34: cr(150), 36: drop('veryrare'), 38: cr(200), 40: it('explosion_rainbow'),
  };
  const PREM = [
    it('body_titanx'), it('decal_chevron'), it('boost_comet'), it('title_ignited'), it('wheels_ignition'),
    it('topper_astro'), drop('veryrare'), it('decal_waves'), it('antenna_torch'), it('explosion_tornado'),
    it('body_cyberbolt'), it('finish_candy'), it('decal_pixel'), drop('import'), it('boost_stardust'),
    it('wheels_chromelord'), it('topper_horns'), it('decal_stars'), it('title_passholder'), it('explosion_ignition'),
    it('body_titanx', 'twhite'), it('decal_chevron', 'gold'), drop('import'), it('boost_comet', 'pink'), it('wheels_ignition', 'lime'),
    it('topper_astro', 'gold'), it('decal_waves', 'black'), drop('exotic'), it('antenna_torch', 'cobalt'), it('explosion_tornado', 'purple'),
    it('body_cyberbolt', 'black'), it('finish_candy', 'crimson'), it('wheels_chromelord', 'gold'), drop('exotic'), it('boost_stardust', 'skyblue'),
    it('topper_horns', 'twhite'), it('decal_stars', 'crimson'), it('explosion_ignition', 'twhite'), it('decal_ignition'), it('title_s1legend'),
  ];
  // off-season car rewards turn into painted items of the same tier, so no tier is empty
  const SWAP = [it('wheels_chromelord', 'twhite'), it('boost_stardust', 'gold'), it('wheels_ignition', 'cobalt'), it('boost_comet', 'crimson')];
  let swapN = 0;
  PREM.forEach((r, i) => { if (r.type === 'item' && !BL.inSeason({ cat: r.id.split('_')[0], id: r.id })) PREM[i] = SWAP[swapN++ % SWAP.length]; });
  // Pro Tiers 41-300 (like the real pass's tiers past the main track): a premium reward every tier, cycling through
  // painted versions of this season's pass items with drops and credits mixed in, titles at 100 / 200 / 300, and
  // something on the free track every 4 tiers
  const PASS_ITEMS = [...new Set(PREM.filter((r) => r.type === 'item' && !/^title_/.test(r.id)).map((r) => r.id))];
  const PAINT_IDS = BL.PAINTS.map((p) => p.id);
  for (let t = BL.PASS.mainTiers + 1; t <= BL.PASS.tiers; t++) {
    PREM[t - 1] = t % 100 === 0 ? it('title_rp' + t) : t % 25 === 0 ? drop('exotic') : t % 10 === 0 ? drop('import') : t % 5 === 0 ? drop('veryrare')
      : it(PASS_ITEMS[(t * 7) % PASS_ITEMS.length], PAINT_IDS[(t * 3) % PAINT_IDS.length]);
    if (t % 20 === 0) FREE[t] = drop('veryrare'); else if (t % 4 === 0) FREE[t] = cr(t % 8 === 0 ? 30 : 20);
  }
  BL.PASS_REWARDS = [];
  for (let t = 1; t <= BL.PASS.tiers; t++) BL.PASS_REWARDS.push({ tier: t, free: FREE[t] || null, prem: PREM[t - 1] });

  // Daily challenges (3 per day picked from this list)
  BL.CHALLENGES = [
    { id: 'goals3', desc: 'Score 3 goals', stat: 'goals', goal: 3, xp: 600 },
    { id: 'win2', desc: 'Win 2 matches', stat: 'wins', goal: 2, xp: 700 },
    { id: 'saves4', desc: 'Make 4 saves', stat: 'saves', goal: 4, xp: 600 },
    { id: 'shots6', desc: 'Take 6 shots on goal', stat: 'shots', goal: 6, xp: 500 },
    { id: 'demo3', desc: 'Demolish 3 cars', stat: 'demos', goal: 3, xp: 650 },
    { id: 'assist2', desc: 'Get 2 assists', stat: 'assists', goal: 2, xp: 550 },
    { id: 'play3', desc: 'Play 3 matches', stat: 'matches', goal: 3, xp: 450 },
    { id: 'aerial1', desc: 'Score an aerial goal', stat: 'aerialGoals', goal: 1, xp: 800 },
    { id: 'score1500', desc: 'Earn 1500 match points', stat: 'score', goal: 1500, xp: 650 },
    { id: 'touch40', desc: 'Touch the ball 40 times', stat: 'touches', goal: 40, xp: 450 },
  ];

  // Tournament winner titles: one per tournament rank, in the rank's colour; winning 3 at a rank gives the 3x
  // title in its own colour (green for Bronze). Earned only by winning tournaments (never in drops or the shop).
  BL.TOUR_RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion', 'Grand Champion', 'Supersonic Legend'];
  const TOUR3_COLORS = ['#3ddc84', '#4fc3f7', '#ff9f1c', '#2ee6d6', '#8f7bff', '#ff5ad1', '#ff3b3b', '#ffffff'];
  BL.TOUR_RANKS.forEach((rk, i) => {
    const col = (BL.RANKS[i] || BL.RANKS[0]).color;
    BL.ITEMS.push({ id: 'title_tour_' + i, cat: 'title', name: rk + ' Tournament Winner', rarity: 'limited', tour: true, text: 'S' + BL.PASS.season + ' ' + rk.toUpperCase() + ' TOURNAMENT WINNER', color: col });
    BL.ITEMS.push({ id: 'title_tour3_' + i, cat: 'title', name: '3x ' + rk + ' Tournament Winner', rarity: 'limited', tour: true, text: 'S' + BL.PASS.season + ' 3X ' + rk.toUpperCase() + ' TOURNAMENT WINNER', color: TOUR3_COLORS[i], glow: true });
  });
  for (const it of BL.ITEMS) BL.ITEM_BY_ID[it.id] = it;

  // Drop odds (rarity -> weight)
  BL.DROP_ODDS = [['rare', 52], ['veryrare', 28], ['import', 13], ['exotic', 5.5], ['blackmarket', 1.5]];
  BL.SHOP_PRICES = { common: 50, uncommon: 100, rare: 200, veryrare: 400, import: 700, exotic: 1100, blackmarket: 2000, limited: 2500 };
})(window.BL);
