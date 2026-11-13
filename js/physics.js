'use strict';
// Rocket League (fan remake) - custom car-soccer physics (no engine; tuned to feel like the real thing)
// World: x = width, y = up, z = length. Blue (team 0) defends -z, Orange (team 1) defends +z.
// Car local axes: +Z forward, +Y up, +X left.
(function (BL) {
  const U = BL.util;
  const V3 = THREE.Vector3, Q = THREE.Quaternion;

  // Values match the real game (RocketSim / RLBot measurements, 1 uu = 1 cm)
  const P = BL.PHYS = {
    dt: 1 / 120, gravity: 6.5, ballR: 0.9125, ballMass: 30, carMass: 180,
    ballMaxSpeed: 60, carMaxSpeed: 23, supersonic: 22, supersonicKeep: 21,
    boostAccel: 9.917, boostUse: 33.3, brakeAccel: 35, coastDecel: 5.25,
    jumpImpulse: 2.917, jumpHoldAccel: 14.58, jumpHoldTime: 0.2, jumpMinTime: 0.025, dodgeImpulse: 5.0,
    flipWindow: 1.25, stickyAccel: 3.25, ballDrag: 0.03,
    // air control: angular acceleration (rad/s^2) and damping (1/s); spin is capped at 5.5 rad/s
    // roll is quicker than the real game's (asked for): faster to spin up and up to 7 rad/s around the roll axis
    // (pitch / yaw and their damping are the measured ones: 12.146, 8.92, 2.798, 1.886 rad/s^2)
    airPitch: 12.146, airYaw: 8.92, airRoll: 36.98, airPitchDamp: 2.798, airYawDamp: 1.886, airRollDamp: 4.6, rollSpin: 5.5, flipRollSpin: 7,
    maxSpin: 5.5, boostAccelAir: 10.583,
    // a tap of boost still boosts 0.1 s; throttle in the air pushes a little (66.7 uu/s^2); supersonic holds down to
    // 21 m/s only for the first second of it; Recharge boost refills 10/s after 0.25 s off the boost
    boostMinTime: 0.1, airThrottle: 0.6667, supersonicKeepTime: 1, rechargeRate: 10, rechargeDelay: 0.25,
    // powerslide eases in (5/s) and out (2/s) instead of switching
    slideRise: 5, slideFall: 2,
    // dodges: torque for 0.65 s, pitch stays locked 0.3 s more, falling is damped 0.15-0.65 s
    dodgeDeadzone: 0.5, flipTorquePitch: 224, flipTorqueRoll: 260, flipTorqueTime: 0.65, flipPitchLock: 0.3,
    flipFullTime: (Math.PI * 2 - 0.1) / 5.5 + 0.03, // one full turn at max spin (front/back flip)
    flipZDamp: 0.35, flipZDampStart: 0.15, flipZDampEnd: 0.21,
    // ball vs world: restitution, friction against the slip of the contact point, spin limit
    ballRestitution: 0.6, ballFriction: 0.35, ballMaxSpin: 6, carBallFriction: 2.0,
  };
  // turning curvature (1/m) vs forward speed (m/s)
  const CURV = [[0, 0.69], [5, 0.398], [10, 0.235], [15, 0.1375], [17.5, 0.11], [23, 0.088]];
  const HIT_SCALE = [[0, 0.65], [5, 0.65], [23, 0.55], [46, 0.30]];

  // cornerR: length of the diagonal corner cut along each wall (real arena: 1152 uu); cornerRound rounds its edges
  const FRAME_R = 0.24; // goal posts / crossbar radius (matches the frame arena.js draws)
  const DEFAULT_ARENA = { hw: 40.96, hl: 51.2, h: 20.44, cornerR: 11.52, cornerRound: 2.5, goalTaper: 3.0, floorR: 3.0, ceilR: 3.0, goalHW: 8.93, goalH: 6.43, goalD: 8.8, goalR: 1.6, obstacles: [] };
  const A = {};
  const Phys = BL.Physics = { arena: A, P };
  // the Heatseeker ball (RocketSim's numbers): served at 29 m/s, +0.85 per touch (only if the last touch was over a
  // second ago) up to 46; homes on the goal centre 3.2 m up; a backboard sends it back with a third of its speed
  const HS = Phys.HS = { initial: 29, step: 0.85, stepGap: 1, maxSpeed: 46, targetY: 3.2, hBlend: 1.45, vBlend: 0.78, speedBlend: 0.3, maxPitch: (7000 * Math.PI) / 32768, bounceForce: 1 / 3, bounceUp: 0.3 };

  Phys.setArena = function (def) {
    for (const k in A) delete A[k];
    Object.assign(A, DEFAULT_ARENA, def || {});
    A.obstacles = (def && def.obstacles) || [];
    A.gz0 = A.hl - A.floorR - 0.3;
    A.gz1 = A.hl + A.goalD;
    A.gcz = (A.gz0 + A.gz1) / 2;
    A.ghz = (A.gz1 - A.gz0) / 2;
    A.sx = A.hw / 40.96;
    A.sz = A.hl / 51.2;
    // shrunk octagon (by the edge rounding) in the first quadrant: side wall, corner cut, back wall
    const rc = A.cornerRound, K = A.hw + A.hl - A.cornerR;
    A.cK = K;
    A.oc = K - rc * Math.SQRT2;
    A.v1x = A.hw - rc; A.v1z = A.oc - A.v1x;
    A.v2z = A.hl - rc; A.v2x = A.oc - A.v2z;
  };
  Phys.setArena(null);

  function roundInter(a, b, r) {
    const ux = r + a > 0 ? r + a : 0, uy = r + b > 0 ? r + b : 0;
    return Math.min(-r, Math.max(a, b)) + Math.sqrt(ux * ux + uy * uy);
  }

  // distance from (px, pz) to the segment (ax, az)-(bx, bz)
  function segDist(px, pz, ax, az, bx, bz) {
    const ex = bx - ax, ez = bz - az;
    const t = U.clamp(((px - ax) * ex + (pz - az) * ez) / (ex * ex + ez * ez), 0, 1);
    const dx = px - ax - ex * t, dz = pz - az - ez * t;
    return Math.sqrt(dx * dx + dz * dz);
  }
  // 2D outline of the arena seen from above: a rectangle with its corners cut at 45 degrees and the
  // edges rounded (exact distance: shrunk octagon, then grown back by the rounding radius)
  function wall2d(x, z) {
    const ax = Math.abs(x), az = Math.abs(z), rc = A.cornerRound;
    const dx = ax - A.v1x, dz = az - A.v2z, dc = (ax + az - A.oc) * Math.SQRT1_2;
    const inside = Math.max(dx, dz, dc);
    if (inside <= 0) return inside - rc;
    const d = Math.min(
      dx > 0 && az <= A.v1z ? dx : segDist(ax, az, A.v1x, -1e4, A.v1x, A.v1z),
      segDist(ax, az, A.v1x, A.v1z, A.v2x, A.v2z),
      dz > 0 && ax <= A.v2x ? dz : segDist(ax, az, -1e4, A.v2z, A.v2x, A.v2z));
    return d - rc;
  }
  Phys.wall2d = wall2d;

  // Signed distance: negative inside the playable volume, positive inside walls.
  function sdf(x, y, z) {
    const d2 = wall2d(x, z);
    // the floor-to-wall curve shrinks to nothing beside the goal mouth, so there is no hard edge at the posts
    let fr = A.floorR;
    const ax = Math.abs(x);
    if (ax < A.goalHW + A.goalTaper && Math.abs(z) > A.hl - A.floorR - 2) fr *= U.smoothstep(A.goalHW, A.goalHW + A.goalTaper, ax);
    let f = roundInter(d2, -y, fr > 0.01 ? fr : 0.01);
    f = roundInter(f, y - A.h, A.ceilR);
    // goal boxes (both ends)
    // inside the goal the floor curves up into the side and back walls (drivable), ceiling stays square
    const az = Math.abs(z);
    let g = roundInter(roundInter(Math.abs(x) - A.goalHW, -y, A.goalR), az - A.gz1, A.goalR);
    // the roof curves into the side and back walls as well, so you can drive up a goal wall onto the roof; the goal
    // mouth keeps its square frame (the rounding fades in over the first couple of metres behind the goal line)
    const rt = A.goalR * U.smoothstep(A.hl + 0.3, A.hl + 2, az);
    g = rt > 0.01 ? roundInter(g, y - A.goalH, rt) : Math.max(g, y - A.goalH);
    g = Math.max(g, A.gz0 - az);
    // the goal frame (crossbar and posts) is rounded like the real game: a smooth union of field and goal near
    // the goal line, fading out toward the floor so the goal mouth floor stays flat
    const kr = az > A.hl - 1.5 && az < A.hl + 1.5 ? 0.8 * U.smoothstep(0.4, 1.4, y) : 0;
    if (kr > 0.01) {
      const hh = Math.max(kr - Math.abs(f - g), 0) / kr;
      f = Math.min(f, g) - hh * hh * kr * 0.25;
    } else if (g < f) f = g;
    // the goal frame itself is solid: round posts and crossbar (the same 0.24 m tubes arena.js draws, centred on
    // the goal-mouth edge), so the ball rolls off the bar instead of sinking into it and bouncing off a corner
    const dz = az - A.hl, ax2 = Math.abs(x);
    if (dz > -0.5 && dz < 0.5 && y < A.goalH + 0.5 && ax2 < A.goalHW + 0.5) {
      const ox = Math.max(0, ax2 - A.goalHW), oy = y - A.goalH;
      const bar = Math.sqrt(ox * ox + oy * oy + dz * dz);
      const px = ax2 - A.goalHW, py = Math.max(0, oy);
      const post = Math.sqrt(px * px + py * py + dz * dz);
      const t = FRAME_R - Math.min(bar, post);
      if (t > f) f = t;
    }
    // solid obstacles (pillars)
    const obs = A.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const dx = x - o.x, dz = z - o.z;
      const dr = Math.sqrt(dx * dx + dz * dz) - o.r;
      const dy = Math.abs(y - o.h * 0.5) - o.h * 0.5;
      const mr = dr > 0 ? dr : 0, my = dy > 0 ? dy : 0;
      const c = Math.min(Math.max(dr, dy), 0) + Math.sqrt(mr * mr + my * my);
      if (-c > f) f = -c;
    }
    return f;
  }
  Phys.sdf = sdf;

  // Normal pointing into the playable volume
  function normal(x, y, z, out) {
    const e = 0.004;
    const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e), c = sdf(x - e, y + e, z - e), d = sdf(x + e, y + e, z + e);
    const nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    out.x = -nx / l; out.y = -ny / l; out.z = -nz / l;
    return out;
  }
  Phys.normal = normal;

  function raycast(ox, oy, oz, dx, dy, dz, maxT, out) {
    let t = 0;
    for (let i = 0; i < 24; i++) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      const d = sdf(x, y, z);
      if (d > -0.003) { out.t = t; out.x = x; out.y = y; out.z = z; return true; }
      t += -d;
      if (t > maxT) return false;
    }
    return false;
  }
  Phys.raycast = raycast;

  // ---------- Layout helpers ----------
  const RL_PADS = [[0, -4240, 0], [-1792, -4184, 0], [1792, -4184, 0], [-3072, -4096, 1], [3072, -4096, 1], [-940, -3308, 0], [940, -3308, 0],
    [0, -2816, 0], [-3584, -2484, 0], [3584, -2484, 0], [-1788, -2300, 0], [1788, -2300, 0], [-2048, -1036, 0], [0, -1024, 0], [2048, -1036, 0],
    [-3584, 0, 1], [-1024, 0, 0], [1024, 0, 0], [3584, 0, 1], [-2048, 1036, 0], [0, 1024, 0], [2048, 1036, 0], [-1788, 2300, 0], [1788, 2300, 0],
    [-3584, 2484, 0], [3584, 2484, 0], [0, 2816, 0], [-940, 3310, 0], [940, 3308, 0], [-3072, 4096, 1], [3072, 4096, 1], [-1792, 4184, 0], [1792, 4184, 0], [0, 4240, 0]];
  Phys.padLayout = function () {
    const out = [];
    for (const p of RL_PADS) {
      const x = (p[0] / 100) * A.sx, z = (p[1] / 100) * A.sz;
      let blocked = false;
      for (const o of A.obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + 1.5) blocked = true;
      if (!blocked) out.push({ x, z, big: !!p[2] });
    }
    return out;
  };

  const KICK = [[-20.48, -25.6], [20.48, -25.6], [-2.56, -38.4], [2.56, -38.4], [0, -46.08]];
  // returns array of {x,z} for each slot of a team; `order` is a shuffled index list shared by both teams
  Phys.kickoffSpots = function (team, count, order) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const k = KICK[order[i % order.length]];
      let x = k[0] * A.sx, z = k[1] * A.sz;
      if (i >= 5) { x += (i - 4) * 3; z -= 2; }
      if (team === 1) { x = -x; z = -z; }
      out.push({ x, z });
    }
    return out;
  };
  Phys.respawnSpot = function (team, i) {
    const s = [[-23, -44], [23, -44], [-8, -47], [8, -47]][i % 4];
    let x = s[0] * A.sx, z = s[1] * A.sz;
    if (team === 1) { x = -x; z = -z; }
    return { x, z };
  };

  // ---------- Car ----------
  function makeControls() {
    return { throttle: 0, steer: 0, pitch: 0, roll: 0, airRollFree: false, jump: false, jumpSeq: 0, boost: false, handbrake: false, itemSeq: 0 };
  }
  Phys.makeControls = makeControls;

  class Car {
    constructor(o) {
      this.id = o.id; this.name = o.name || 'Car'; this.team = o.team || 0;
      this.tag = U.cleanTag(o.tag); this.tagc = (o.tagc | 0) & 7;
      this.isBot = !!o.isBot; this.isLocal = !!o.isLocal; this.isLocal2 = !!o.isLocal2; this.skill = o.skill == null ? 0.5 : o.skill; this.pid = o.pid || null;
      this.loadout = o.loadout;
      const bodyDef = o.loadout && o.loadout.body ? BL.ITEM_BY_ID[o.loadout.body.id] : null;
      const hb = BL.HITBOXES[(bodyDef && bodyDef.hitbox) || 'octane'];
      this.hx = hb.W / 2; this.hy = hb.H / 2; this.hz = hb.L / 2; this.restH = this.hy + 0.2;
      this.pos = new V3(); this.vel = new V3(); this.quat = new Q(); this.angVel = new V3();
      this.prevPos = new V3(); this.prevQuat = new Q();
      this.fwd = new V3(0, 0, 1); this.up = new V3(0, 1, 0); this.left = new V3(1, 0, 0);
      this.groundN = new V3(0, 1, 0); this.prevGroundN = new V3(0, 1, 0); this.contactN = new V3(0, 1, 0);
      this.dodgeW = new V3();
      this.controls = makeControls();
      this.events = [];
      this.boost = 33;
      this.reset();
    }
    reset() {
      this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
      this.onGround = true; this.jumped = false; this.hasFlip = true; this.dodging = false; this.jumpHolding = false;
      this.jumpTime = 0; this.jumpLock = 0; this.airTime = 0; this.dodgeTime = 0; this.onRoof = false; this.rightLeft = 0; this.contact = false;
      this.demolished = false; this.respawnTimer = 0; this.supersonic = false; this.boosting = false;
      this.wheelSpin = 0; this.steerVis = 0; this.lastHitTime = -10; this.groundDist = this.restH; this.dodgeAngle = 0;
      this.lastJumpSeq = this.controls.jumpSeq;
    }
    updateAxes() {
      this.fwd.set(0, 0, 1).applyQuaternion(this.quat);
      this.up.set(0, 1, 0).applyQuaternion(this.quat);
      this.left.set(1, 0, 0).applyQuaternion(this.quat);
    }
    place(x, z, faceX, faceZ) {
      this.pos.set(x, this.restH, z);
      const f = new V3(faceX - x, 0, faceZ - z);
      if (f.lengthSq() < 1e-6) f.set(0, 0, this.team === 0 ? 1 : -1);
      f.normalize();
      U.basisQuat(f, new V3(0, 1, 0), this.quat);
      this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
      this.groundN.set(0, 1, 0); this.prevGroundN.set(0, 1, 0);
      this.reset();
      this.updateAxes();
    }
    speed() { return this.vel.length(); }
  }
  Phys.Car = Car;

  const _a = new V3(), _b = new V3(), _c = new V3(), _n = new V3(), _w = new V3(), _r = new V3();
  const _q = new Q(), _q2 = new Q();
  const hit = { t: 0, x: 0, y: 0, z: 0 };

  // ---- Suspension (mass-normalised raycast vehicle, like the real game) ----
  // 4 wheels with springs/dampers: landings and ramp transitions settle naturally instead of snapping.
  const SUSP = { k: 144, c: 14.4, rw: 0.16, travel: 0.12 };
  function setupWheels(car) {
    const zf = car.hz * 0.72, zb = -car.hz * 0.62, x = car.hx - 0.07, y = -car.hy * 0.4;
    const kf = (SUSP.k / 2) * (-zb) / (zf - zb), kb = (SUSP.k / 2) * zf / (zf - zb);
    const rest = (car.restH + y - SUSP.rw) + P.gravity / SUSP.k;
    const mk = (wx, wz, k, front) => ({ x: wx, y, z: wz, k, c: SUSP.c * k / SUSP.k, rest, front, contact: false, comp: P.gravity / SUSP.k, len: rest });
    car.wheelDefs = [mk(x, zf, kf, true), mk(-x, zf, kf, true), mk(x, zb, kb, false), mk(-x, zb, kb, false)];
    car.eqComp = P.gravity / SUSP.k;
    car.Ix = ((2 * car.hz) ** 2 + (2 * car.hy) ** 2) / 12;
    car.Iz = ((2 * car.hx) ** 2 + (2 * car.hy) ** 2) / 12;
  }
  Phys.setupWheels = setupWheels;

  const _lin = new V3(), _pv = new V3(), _gn = new V3();
  function suspension(car) {
    let contacts = 0, tx = 0, tz = 0;
    _lin.set(0, 0, 0); _gn.set(0, 0, 0);
    const up = car.up, lf = car.left, fw = car.fwd;
    for (let i = 0; i < 4; i++) {
      const w = car.wheelDefs[i];
      w.contact = false;
      if (car.jumpLock > 0) { w.len = w.rest + SUSP.travel; w.comp = -SUSP.travel; continue; }
      _r.set(0, 0, 0).addScaledVector(lf, w.x).addScaledVector(up, w.y).addScaledVector(fw, w.z);
      const ox = car.pos.x + _r.x, oy = car.pos.y + _r.y, oz = car.pos.z + _r.z;
      if (!raycast(ox, oy, oz, -up.x, -up.y, -up.z, w.rest + SUSP.travel + SUSP.rw, hit)) { w.len = w.rest + SUSP.travel; w.comp = -SUSP.travel; continue; }
      normal(hit.x, hit.y, hit.z, _n);
      if (_n.dot(up) < 0.4) { w.len = w.rest + SUSP.travel; w.comp = -SUSP.travel; continue; }
      const len = hit.t - SUSP.rw;
      const comp = w.rest - len;
      _pv.crossVectors(car.angVel, _r).add(car.vel);
      let f = w.k * comp - w.c * _pv.dot(up);
      if (len < 0) f += w.k * 8 * -len; // bump stop
      if (f < 0) f = 0;
      w.contact = true; w.len = len; w.comp = comp;
      contacts++;
      _gn.add(_n);
      _lin.addScaledVector(up, f);
      tx += -w.z * f; tz += w.x * f;
    }
    car.wheelContacts = contacts;
    if (contacts) car.groundN.copy(_gn).normalize();
    car.suspTx = tx / car.Ix; car.suspTz = tz / car.Iz;
    return contacts;
  }

  function stepCar(car, dt, env) {
    if (car.demolished) return;
    const c = car.controls;
    if (!car.wheelDefs) setupWheels(car);
    car.updateAxes();
    const jumpPressed = c.jumpSeq !== car.lastJumpSeq;
    car.lastJumpSeq = c.jumpSeq;
    if (env.frozen) { car.vel.set(0, 0, 0); car.angVel.set(0, 0, 0); car.boosting = false; return; }
    if (car.jumpLock > 0) car.jumpLock -= dt;

    const contacts = suspension(car);
    const wasGround = car.onGround;
    // 3+ wheels = driving (like the real game); keep driving through curved transitions with 2
    const grounded = contacts >= 3 || (contacts >= 2 && wasGround);
    car.onGround = grounded;
    if (grounded) {
      if (!wasGround) {
        car.events.push('land');
        // tyres bite on landing: most sideways slide is gone at once (no skating after flips/jumps)
        const ls = car.vel.dot(car.left);
        car.vel.addScaledVector(car.left, -ls * 0.7);
      }
      car.jumped = false; car.hasFlip = true; car.dodging = false; car.airTime = 0; car.onRoof = false; car.jumpHolding = false; car.rightLeft = 0;
      car.groundDist = car.restH;
    } else car.airTime += dt;

    // boost (a tap boosts for at least 0.1 s, like the real game)
    if (c.boost && !car.boostIn) car.boostMinT = P.boostMinTime;
    car.boostIn = !!c.boost;
    if (car.boostMinT > 0) car.boostMinT -= dt;
    const boosting = (c.boost || car.boostMinT > 0) && !env.noBoost && (env.unlimitedBoost || car.boost > 0);
    if (boosting && !env.unlimitedBoost) car.boost = Math.max(0, car.boost - P.boostUse * dt);
    if (env.rechargeBoost && !boosting && car.boost < 100) {
      car.rechargeT = (car.rechargeT || 0) + dt;
      if (car.rechargeT > P.rechargeDelay) car.boost = Math.min(100, car.boost + P.rechargeRate * dt);
    } else car.rechargeT = 0;
    car.boosting = boosting;
    if (car.bumpT > 0) car.bumpT -= dt;

    // suspension forces (linear + pitch/roll torque)
    car.vel.addScaledVector(_lin, dt);
    car.angVel.addScaledVector(car.left, car.suspTx * dt).addScaledVector(car.fwd, car.suspTz * dt);
    if (grounded) {
      car.landT = wasGround ? (car.landT || 0) + dt : 0;
      // hug the surface: soft right after landing (the suspension absorbs it), firm while driving
      _a.copy(car.fwd).addScaledVector(car.groundN, -car.fwd.dot(car.groundN));
      if (_a.lengthSq() > 1e-6) {
        _a.normalize();
        U.basisQuat(_a, car.groundN, _q);
        car.quat.slerp(_q, Math.min(1, (car.landT < 0.25 ? 7 : 32) * dt));
        car.updateAxes();
      }
    }
    if (contacts > 0 && car.jumpLock <= 0) {
      // tyre-alignment torque toward the surface (helps when only some wheels touch)
      _a.crossVectors(car.up, car.groundN);
      const s = _a.length();
      if (s > 1e-4) {
        const ang = Math.asin(Math.min(1, s));
        const k = 110 * (contacts / 4);
        _a.multiplyScalar(ang / s);
        _c.copy(car.angVel).addScaledVector(car.up, -car.angVel.dot(car.up));
        car.angVel.addScaledVector(_a, k * dt).addScaledVector(_c, -Math.min(1, 14 * (contacts / 4) * dt));
      }
      // carry momentum when the surface curves away (floor -> ramp -> wall)
      if (grounded && wasGround) {
        const vn = car.vel.dot(car.groundN), sp0 = car.vel.length();
        if (vn < 0 && -vn < 0.45 * sp0) {
          car.vel.addScaledVector(car.groundN, -vn);
          const sp1 = car.vel.length();
          if (sp0 > 6 && sp1 > 0.01) car.vel.multiplyScalar(sp0 / sp1);
        }
      }
    }

    car.rollPivot = 0;
    if (grounded) driveGround(car, c, dt, boosting, jumpPressed, env);
    else {
      flyAir(car, c, dt, jumpPressed, contacts > 0);
      // one or two wheels down (edges, ramps, landings): those tyres still grip sideways
      if (contacts > 0) car.vel.addScaledVector(car.left, -car.vel.dot(car.left) * (1 - Math.exp(-34 * (contacts / 4) * dt)));
    }

    if (boosting) car.vel.addScaledVector(car.fwd, (grounded ? P.boostAccel : P.boostAccelAir) * dt);
    else if (!grounded && c.throttle) car.vel.addScaledVector(car.fwd, P.airThrottle * U.clamp(c.throttle, -1, 1) * dt);
    car.vel.y -= env.gravity * dt;

    const sp = car.vel.length();
    if (sp > P.carMaxSpeed) car.vel.multiplyScalar(P.carMaxSpeed / sp);
    // supersonic from 22 m/s; for its first second it holds down to 21 m/s, after that it needs 22 (the real rule)
    if (car.supersonic && (car.ssT || 0) < P.supersonicKeepTime) car.supersonic = sp >= P.supersonicKeep;
    else car.supersonic = sp >= P.supersonic;
    car.ssT = car.supersonic ? (car.ssT || 0) + dt : 0;
    car.pos.addScaledVector(car.vel, dt);

    // (directional air roll: the side it rolls toward stays put and the rest of the car swings round it)
    if (car.rollPivot) {
      const th = car.angVel.dot(car.fwd) * dt, pv = car.rollPivot;
      car.pos.addScaledVector(car.left, pv * (1 - Math.cos(th))).addScaledVector(car.up, -pv * Math.sin(th));
    }
    const w = car.angVel.length();
    if (w > 1e-5) {
      _q.setFromAxisAngle(_a.copy(car.angVel).multiplyScalar(1 / w), w * dt);
      car.quat.premultiply(_q).normalize();
    }
    car.updateAxes();
    collideArena(car, dt);
  }
  Phys.stepCar = stepCar;

  function driveGround(car, c, dt, boosting, jumpPressed, env) {
    const up = car.up;
    let fs = car.vel.dot(car.fwd), ls = car.vel.dot(car.left);
    const us = car.vel.dot(up);

    let thr = c.throttle;
    if (boosting) thr = 1;
    const afs = Math.abs(fs);
    if (thr !== 0 && fs * thr < -0.05) {
      const dec = P.brakeAccel * dt;
      fs = afs <= dec ? 0 : fs - Math.sign(fs) * dec;
    } else if (thr !== 0) {
      const ta = afs < 14 ? U.lerp(16, 1.6, afs / 14) : (afs < 14.1 ? 1.6 * (14.1 - afs) / 0.1 : 0);
      fs += ta * thr * dt;
    } else {
      // coasting; below ~0.25 m/s the real game brakes fully so the car holds still (even on slopes)
      const dec = (afs < 0.25 ? P.brakeAccel : P.coastDecel) * dt;
      fs = afs <= dec ? 0 : fs - Math.sign(fs) * dec;
    }
    // powerslide: like the real game it eases in over 0.2 s and lets go over 0.5 s (handbrake rise 5/s, fall 2/s)
    car.slideK = U.clamp((car.slideK || 0) + (c.handbrake ? P.slideRise : -P.slideFall) * dt, 0, 1);
    const slide = car.slideK;

    // steering: yaw the car around its own up axis
    const curv = U.piecewise(CURV, Math.abs(fs));
    const yawRate = curv * fs * c.steer * (1 + 0.75 * slide);
    // the car's momentum before it turns (fs/ls along the old heading, i.e. what full grip would carry round)
    const wx = car.vel.x, wy = car.vel.y, wz = car.vel.z;
    _q2.setFromAxisAngle(up, -yawRate * dt);
    car.quat.premultiply(_q2).normalize();
    car.updateAxes();
    if (slide > 0) {
      // powerslide: the tyres let go sideways, so the car turns but its momentum mostly keeps going -> the back
      // slides out (at full slide only a fifth of the turn is carried by the tyres), and the slide fades slowly
      const nf = wx * car.fwd.x + wy * car.fwd.y + wz * car.fwd.z, nl = wx * car.left.x + wy * car.left.y + wz * car.left.z;
      const k = U.lerp(1, 0.2, slide);
      fs = U.lerp(nf, fs, k); ls = U.lerp(nl, ls, k);
      ls *= Math.exp(-U.lerp(44, 1.6, slide) * dt);
    } else ls *= Math.exp(-44 * dt); // grip: the velocity turns with the car and sideways slip dies at once
    car.vel.copy(car.fwd).multiplyScalar(fs).addScaledVector(car.left, ls).addScaledVector(up, us);
    // yaw is handled above; pitch/roll come from the suspension, damped like tyres on the ground
    const wu = car.angVel.dot(up);
    car.angVel.addScaledVector(up, -wu);
    car.angVel.multiplyScalar(Math.exp(-3 * dt));

    // sticky force (real game: 0.5g, up to 1.5g on walls while driving)
    const fullStick = Math.abs(c.throttle) > 0.01 || Math.abs(fs) > 0.25;
    const stick = 0.5 + (fullStick ? 1 - Math.abs(up.y) : 0);
    car.vel.addScaledVector(up, -stick * env.gravity * dt);

    car.wheelSpin += (fs * dt) / 0.18;
    car.steerVis = c.steer;
    car.slideVis = slide > 0.3 && Math.abs(ls) > 2;

    if (jumpPressed) {
      car.vel.addScaledVector(up, P.jumpImpulse);
      car.jumped = true; car.jumpTime = 0; car.jumpEnd = P.jumpHoldTime; car.jumpHolding = true; car.jumpLock = 0.1;
      car.onGround = false; car.hasFlip = true;
      car.events.push('jump');
    }
  }

  // flip spin along a flip direction (fx = front/back share, fz = sideways share), inside the spin limit
  function flipSpin(fx, fz) { const l = Math.hypot(fx, fz) || 1; return 1 / Math.sqrt((fx / l / P.maxSpin) ** 2 + (fz / l / P.flipRollSpin) ** 2) / l; }
  function flipFullTime(fx, fz) { return (Math.PI * 2 - 0.1) / (flipSpin(fx, fz) * Math.hypot(fx, fz)) + 0.03; }

  function flyAir(car, c, dt, jumpPressed, partial) {
    car.jumpTime += dt;
    car.slideVis = false;
    if (car.jumpHolding) {
      if ((c.jump || car.jumpTime < P.jumpMinTime) && car.jumpTime < P.jumpHoldTime) car.vel.addScaledVector(car.up, P.jumpHoldAccel * dt);
      else { car.jumpHolding = false; car.jumpEnd = car.jumpTime; }
    }
    // flip / double jump: any time if you left the ground without jumping, else up to 1.25 s after the jump ends
    const jumpEnd = car.jumpHolding ? car.jumpTime : car.jumpEnd == null ? P.jumpHoldTime : car.jumpEnd;
    const flipOk = !car.jumped || car.jumpTime - jumpEnd < P.flipWindow;
    if (jumpPressed && car.onRoof) {
      // turtle recovery: hop off the roof and roll exactly half a turn back onto the wheels (the stick picks which
      // way round, else the side that's lower)
      car.vel.addScaledVector(car.contactN, 3.6);
      const pick = c.roll || c.steer;
      car.rightDir = pick ? Math.sign(pick) : car.left.dot(car.contactN) > 0 ? -1 : 1;
      car.rightLeft = Math.PI;
      car.onRoof = false;
      car.events.push('jump');
    } else if (jumpPressed && car.hasFlip && flipOk && !(car.rightLeft > 0)) {
      car.hasFlip = false;
      car.jumpHolding = false;
      // like the real game: stick (pitch + yaw + roll) past the dodge deadzone flips, otherwise double jump
      if (Math.abs(c.pitch) + Math.abs(c.steer) + Math.abs(c.roll) >= P.dodgeDeadzone) {
        let fx = c.pitch, sx = U.clamp(c.steer + c.roll, -1, 1);
        if (Math.abs(fx) < 0.1 && Math.abs(sx) < 0.1) { fx = 0; sx = 0; } // cancelled-out input: stall
        const m = Math.hypot(fx, sx) || 1;
        fx /= m; sx /= m;
        _a.set(car.fwd.x, 0, car.fwd.z);
        if (_a.lengthSq() < 0.01) _a.set(-car.up.x, 0, -car.up.z);
        _a.normalize();
        _b.set(-_a.z, 0, _a.x); // right
        // impulses: 500 uu/s; dodging against your motion grows up to 2.5x (x16/15), sideways up to 1.9x with speed
        const fwdSpeed = car.vel.dot(_a), ratio = Math.min(1, Math.abs(fwdSpeed) / P.carMaxSpeed);
        let ix = fx * P.dodgeImpulse, iy = sx * P.dodgeImpulse;
        if ((fx >= 0) !== (fwdSpeed >= 0)) ix *= (16 / 15) * (1.5 * ratio + 1);
        iy *= 0.9 * ratio + 1;
        car.vel.addScaledVector(_a, ix).addScaledVector(_b, iy);
        car.dodging = true; car.dodgeTime = 0; car.dodgeAngle = 0;
        // dodgeW holds the flip direction: x = pitch share (front/back), z = roll share (sideways)
        car.dodgeW.set(fx, 0, sx);
        car.events.push('dodge');
      } else {
        car.vel.addScaledVector(car.up, P.jumpImpulse);
        car.events.push('djump');
      }
    }
    // air control in local space
    _q.copy(car.quat).invert();
    _w.copy(car.angVel).applyQuaternion(_q);
    if (car.rightLeft > 0) {
      // rolling back over after a turtle recovery: half a turn in about 0.4 s, the stick does nothing meanwhile
      const step = Math.min(car.rightLeft, 8 * dt), dm = Math.exp(-12 * dt);
      car.rightLeft -= step;
      _w.set(_w.x * dm, _w.y * dm, (car.rightDir * step) / dt);
      car.angVel.copy(_w).applyQuaternion(car.quat);
      car.rollHeld = false; car.steerVis = c.steer;
      return;
    }
    const pIn = partial ? 0 : c.pitch;
    let yIn = partial ? 0 : -c.steer, rIn = partial ? 0 : c.roll;
    // directional air roll (the roll buttons) turns the car about the side it rolls toward, like tipping over onto it;
    // free air roll (hold the button and steer) turns it about its middle. stepCar moves it round that side.
    car.rollPivot = !partial && !c.airRollFree && !car.dodging && c.roll ? -Math.sign(c.roll) * car.hx : 0;
    if (c.airRollFree && !partial) { rIn = U.clamp(rIn + c.steer, -1, 1); yIn = 0; }
    // a dodge: 0.65 s of flip torque, then it keeps turning at full speed until one full rotation
    let air = true, pitchScale = 1;
    if (car.dodging) {
      car.dodgeTime += dt;
      const t = car.dodgeTime, tr = car.dodgeW.z;
      if (t < P.flipTorqueTime) {
        let tp = car.dodgeW.x;
        air = false;
        // flip cancel (half-flips): stick against the flip's pitch direction scales its pitch torque down,
        // a firm pull stops the pitch part of the flip for good
        if (tp !== 0 && pIn !== 0 && Math.sign(tp) !== Math.sign(pIn)) {
          tp *= 1 - Math.min(1, Math.abs(pIn));
          if (Math.abs(pIn) > 0.5) car.dodgeW.x = 0;
          air = true;
        }
        if (car.dodgeW.x === 0 && tr === 0) air = true; // stall / cancelled
        _w.x += P.flipTorquePitch * tp * dt;
        _w.z += P.flipTorqueRoll * tr * dt;
        pitchScale = 0;
        // flips hang in the air: falling (and, early on, rising) speed is damped
        if (t >= P.flipZDampStart && (car.vel.y < 0 || t < P.flipZDampEnd)) car.vel.y *= Math.pow(1 - P.flipZDamp, dt * 120);
      } else if ((car.dodgeW.x !== 0 || tr !== 0) && t < flipFullTime(car.dodgeW.x, tr)) {
        // finish the turn so front, back and side flips go all the way round; air steering (yaw) still works
        const s = flipSpin(car.dodgeW.x, tr);
        _w.x = car.dodgeW.x * s; _w.z = tr * s;
        _w.y += (P.airYaw * yIn - P.airYawDamp * _w.y * (1 - Math.abs(yIn))) * dt;
        air = false;
      } else {
        // done: settle with a little leftover spin
        if (car.dodgeW.x !== 0 || tr !== 0) { _w.x *= 0.15; _w.z *= 0.15; }
        car.dodging = false;
      }
    }
    if (air) {
      const pu = pIn * pitchScale;
      _w.x += (P.airPitch * pu - P.airPitchDamp * _w.x * (1 - Math.abs(pu))) * dt;
      _w.y += (P.airYaw * yIn - P.airYawDamp * _w.y * (1 - Math.abs(yIn))) * dt;
      _w.z += (P.airRoll * rIn - P.airRollDamp * _w.z) * dt;
    }
    // spin limit: 5.5 rad/s like the real game; side flips (barrel rolls) may roll up to flipRollSpin so they finish quicker
    const rs = car.dodging ? P.flipRollSpin : P.rollSpin;
    const lim = Math.sqrt((_w.x * _w.x + _w.y * _w.y) / (P.maxSpin * P.maxSpin) + (_w.z * _w.z) / (rs * rs));
    if (lim > 1) _w.multiplyScalar(1 / lim);
    // a puff of gas when you start an air roll (game.js draws it)
    if (rIn && !car.rollHeld && !car.dodging) car.events.push('airroll');
    car.rollHeld = !!rIn;
    car.angVel.copy(_w).applyQuaternion(car.quat);
    car.steerVis = c.steer;
  }

  // hitbox sample points (unit cube corners, edges, faces)
  const SAMPLES = [];
  for (let sx = -1; sx <= 1; sx++) for (let sy = -1; sy <= 1; sy++) for (let sz = -1; sz <= 1; sz++) {
    if (sx || sy || sz) SAMPLES.push([sx, sy, sz]);
  }

  function collideArena(car, dt) {
    car.contact = false;
    for (let iter = 0; iter < 3; iter++) {
      let best = 0, bx = 0, by = 0, bz = 0;
      for (let i = 0; i < SAMPLES.length; i++) {
        const s = SAMPLES[i];
        const ox = s[0] * car.hx, oy = s[1] * car.hy, oz = s[2] * car.hz;
        const x = car.pos.x + car.left.x * ox + car.up.x * oy + car.fwd.x * oz;
        const y = car.pos.y + car.left.y * ox + car.up.y * oy + car.fwd.y * oz;
        const z = car.pos.z + car.left.z * ox + car.up.z * oy + car.fwd.z * oz;
        const d = sdf(x, y, z);
        if (d > best) { best = d; bx = x; by = y; bz = z; }
      }
      if (best <= 0) break;
      normal(bx, by, bz, _n);
      car.pos.addScaledVector(_n, best + 0.001);
      const vn = car.vel.dot(_n);
      if (vn < 0) {
        car.vel.addScaledVector(_n, -vn * 1.05);
        if (!car.onGround) {
          _r.set(bx - car.pos.x, by - car.pos.y, bz - car.pos.z);
          _c.crossVectors(_r, _n);
          car.angVel.addScaledVector(_c, -vn * 0.9);
        }
      }
      car.contact = true;
      car.contactN.copy(_n);
    }
    if (car.contact && !car.onGround) {
      const ud = car.up.dot(car.contactN);
      // lying on the roof rattles in and out of contact: keep the flag a moment so turtle recovery always works
      if (ud < -0.5) { car.onRoof = true; car.roofT = 0.25; }
      else if (ud < 0.55) {
        _a.crossVectors(car.up, car.contactN);
        const l = _a.length();
        if (l > 1e-3) car.angVel.addScaledVector(_a, (14 * dt) / l);
      }
      car.vel.multiplyScalar(Math.exp(-1.2 * dt));
      car.angVel.multiplyScalar(Math.exp(-2 * dt));
    } else if (!car.contact && car.onRoof && (car.roofT = (car.roofT || 0) - dt) <= 0) car.onRoof = false;
  }

  // ---------- Ball ----------
  class Ball {
    constructor(r) {
      this.r = r || P.ballR;
      this.pos = new V3(0, this.r, 0); this.vel = new V3(); this.angVel = new V3(); this.quat = new Q();
      this.prevPos = new V3(); this.prevQuat = new Q();
      this.contact = false; this.contactN = new V3(0, 1, 0);
      this.frozen = 0; this.heat = null; this.hidden = false; this.stuckTo = null;
    }
    reset(x, y, z) {
      this.pos.set(x || 0, y == null ? this.r : y, z || 0);
      this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
      this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
      this.frozen = 0; this.heat = null; this.hidden = false; this.stuckTo = null;
    }
  }
  Phys.Ball = Ball;

  function stepBall(b, dt, env) {
    if (b.hidden) return;
    if (b.frozen > 0) { b.frozen -= dt; return; }
    if (env.frozen && env.heatseeker && b.heat) return; // Heatseeker: the served ball hangs still until GO
    if (env.heatseeker && b.heat && b.heat.wait) { b.vel.set(0, 0, 0); return; } // ...and after GO until the first touch
    const heat = env.heatseeker && b.heat && !env.frozen; // the homing waits for the countdown
    if (!heat) b.vel.y -= env.gravity * dt;
    b.vel.multiplyScalar(1 - P.ballDrag * dt);
    if (heat) {
      // the real Heatseeker (RocketSim's numbers): the ball leaves in the direction it was hit, then every tick its
      // heading (yaw and pitch, pitch kept within 38 degrees) turns part of the way toward the middle of the target
      // goal 3.2 m up, quicker the faster it's going, and its speed closes 30% of the gap to the target speed per tick
      // (a bigger ball aims lower, so it still fits under the crossbar: with the Gigantic ball it used to arrive too
      // high, bounce off the backboard every time and the match never ended)
      const tz = b.heat.team === 0 ? A.hl : -A.hl, ty = Math.min(HS.targetY * (A.goalH / 6.43), A.goalH - b.r - 1.2) - Math.max(0, b.r - P.ballR) * 0.6;
      const sp = b.vel.length();
      const dx = -b.pos.x, dy = ty - b.pos.y, dz = tz - b.pos.z;
      const yawT = Math.atan2(dx, dz), pitchT = Math.atan2(dy, Math.hypot(dx, dz));
      let yaw = yawT, pitch = 0;
      if (sp > 0.5) { yaw = Math.atan2(b.vel.x, b.vel.z); pitch = Math.asin(U.clamp(b.vel.y / sp, -1, 1)); }
      const f = (sp / HS.maxSpeed) * dt;
      let dyaw = yawT - yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      yaw += dyaw * Math.min(1, f * HS.hBlend);
      pitch = U.clamp(pitch + (pitchT - pitch) * Math.min(1, f * HS.vBlend), -HS.maxPitch, HS.maxPitch);
      const ns = sp + (b.heat.speed - sp) * (1 - Math.pow(1 - HS.speedBlend, dt * 120));
      const cp = Math.cos(pitch);
      b.vel.set(Math.sin(yaw) * cp * ns, Math.sin(pitch) * ns, Math.cos(yaw) * cp * ns);
    }
    const maxSp = env.ballMaxSpeed || P.ballMaxSpeed;
    const sp = b.vel.length();
    if (sp > maxSp) b.vel.multiplyScalar(maxSp / sp);
    b.pos.addScaledVector(b.vel, dt);

    b.contact = false;
    for (let iter = 0; iter < 2; iter++) {
      const d = sdf(b.pos.x, b.pos.y, b.pos.z);
      const pen = d + b.r;
      if (pen <= 0) break;
      normal(b.pos.x, b.pos.y, b.pos.z, _n);
      b.pos.addScaledVector(_n, pen);
      const vn = b.vel.dot(_n);
      if (vn < 0) {
        // the real game's bounce: normal speed x0.6; friction acts on the slip of the contact point
        // (so spin changes how it kicks off walls) and turns into spin
        const e = env.ballBounce == null ? P.ballRestitution : env.ballBounce;
        _a.copy(b.vel).addScaledVector(_n, -vn); // tangential velocity
        _c.crossVectors(_n, b.angVel).multiplyScalar(b.r).add(_a); // slip of the contact point
        const slip = _c.length();
        const dvn = -vn < 0.5 ? -vn : -(1 + e) * vn; // tiny contacts just settle
        if (slip > 1e-4) {
          // friction can take at most 0.35 x the normal push (the real game's coefficient), measured against the
          // push actually given: a bounce's (with the rebound) or a resting ball's (gravity alone). It used to take
          // twice a resting ball's, so a rolling ball slowed 1.6x faster than the real one.
          const k = -Math.min(1, (P.ballFriction * dvn) / slip);
          _c.multiplyScalar(k); // tangential change
          _r.crossVectors(_c, _n);
          b.angVel.addScaledVector(_r, 2.5 / b.r);
          b.vel.add(_c);
        }
        b.vel.addScaledVector(_n, dvn);
        if (-vn > 2) b.bounced = -vn;
        // Heatseeker backboard (the real rule): hitting the back wall it was heading for (within 3 m of it) turns it
        // round for the other goal, with a push of a third of its speed toward that goal and a little up
        const tdir = b.heat ? (b.heat.team === 0 ? 1 : -1) : 0;
        if (heat && _n.z * tdir <= -0.5 && b.pos.z * tdir >= A.hl - 3) {
          b.heat.team = 1 - b.heat.team;
          const gz = -tdir * A.hl;
          _a.set(-b.pos.x, 0, gz - b.pos.z).normalize().multiplyScalar(1 - HS.bounceUp);
          _a.y += HS.bounceUp;
          b.vel.addScaledVector(_a.normalize(), b.vel.length() * HS.bounceForce);
        }
      }
      b.contact = true;
      b.contactN.copy(_n);
    }
    let w = b.angVel.length();
    if (w > P.ballMaxSpin) { b.angVel.multiplyScalar(P.ballMaxSpin / w); w = P.ballMaxSpin; }
    if (w > 1e-4) {
      _q.setFromAxisAngle(_a.copy(b.angVel).multiplyScalar(1 / w), w * dt);
      b.quat.premultiply(_q).normalize();
    }
  }
  Phys.stepBall = stepBall;

  // ---------- Car vs Ball ----------
  const touch = { car: null, strength: 0, point: new V3(), normal: new V3() };
  // The wheels: four small spheres, each where its suspension holds it (they hang lower in the air than when the car
  // sits on the ground). They keep the ball out like the body does, instead of the ball passing through them, and a
  // flip reset is when all four of them touch the ball at the same time. Returns how many touch.
  const WR = SUSP.rw + 0.01, _wc = new V3(), _wn = new V3(), _wv = new V3(), _wr = new V3();
  const wheelHit = { n: 0, hit: false, strength: 0, fresh: false };
  function wheelsOnBall(car, b, now) {
    if (!car.wheelDefs) setupWheels(car);
    wheelHit.n = 0; wheelHit.hit = false; wheelHit.strength = 0;
    const reach = b.r + WR;
    for (const w of car.wheelDefs) {
      _wr.set(0, 0, 0).addScaledVector(car.left, w.x).addScaledVector(car.up, w.y - w.len).addScaledVector(car.fwd, w.z);
      _wc.copy(car.pos).add(_wr);
      const d = _wc.distanceTo(b.pos);
      if (d < reach + 0.05) wheelHit.n++;
      if (d >= reach || d < 1e-4) continue;
      const pen = reach - d;
      _wn.copy(b.pos).sub(_wc).multiplyScalar(1 / d);
      b.pos.addScaledVector(_wn, pen * 0.92); car.pos.addScaledVector(_wn, -pen * 0.08);
      // the ball against the wheel at its contact point: a soft bounce (tyres give a little)
      _wv.crossVectors(car.angVel, _wr).add(car.vel);
      const vn = _b.copy(b.vel).sub(_wv).dot(_wn);
      if (vn < 0) {
        const j = (-1.3 * vn) / (1 / P.ballMass + 1 / P.carMass);
        b.vel.addScaledVector(_wn, j / P.ballMass);
        car.vel.addScaledVector(_wn, -j / P.carMass);
        wheelHit.strength = Math.max(wheelHit.strength, -vn);
      }
      wheelHit.hit = true;
      touch.point.copy(_wc).addScaledVector(_wn, WR); touch.normal.copy(_wn);
    }
    return wheelHit.n;
  }
  function collideCarBall(car, b, env, now) {
    if (car.demolished || b.hidden) return null;
    let dx = b.pos.x - car.pos.x, dy = b.pos.y - car.pos.y, dz = b.pos.z - car.pos.z;
    const lim = b.r + 0.95;
    if (dx * dx + dy * dy + dz * dz > lim * lim) return null;
    // flip reset: all four wheels on the ball while in the air gives the flip back
    if (wheelsOnBall(car, b, now) === 4 && !car.onGround && (!car.hasFlip || car.jumped)) {
      car.hasFlip = true; car.jumped = false; car.dodging = false;
      car.events.push('flipReset');
    }
    dx = b.pos.x - car.pos.x; dy = b.pos.y - car.pos.y; dz = b.pos.z - car.pos.z;
    _a.set(dx, dy, dz);
    const lx = _a.dot(car.left), ly = _a.dot(car.up), lz = _a.dot(car.fwd);
    const cx = U.clamp(lx, -car.hx, car.hx), cy = U.clamp(ly, -car.hy, car.hy), cz = U.clamp(lz, -car.hz, car.hz);
    const ex = lx - cx, ey = ly - cy, ez = lz - cz;
    const d2 = ex * ex + ey * ey + ez * ez;
    if (d2 > b.r * b.r) {
      // only a wheel touched: still a touch of the ball (a gentle one)
      if (!wheelHit.hit || b.stuckTo) return null;
      const fresh = now - car.lastHitTime > 0.1 && wheelHit.strength > 0.5;
      if (fresh) car.lastHitTime = now;
      touch.car = car; touch.strength = Math.min(46, wheelHit.strength); touch.fresh = fresh;
      return touch;
    }
    let dist = Math.sqrt(d2), nlx, nly, nlz;
    if (dist < 1e-4) { nlx = 0; nly = 1; nlz = 0; dist = -(car.hy - ly); } else { nlx = ex / dist; nly = ey / dist; nlz = ez / dist; }
    _n.set(0, 0, 0).addScaledVector(car.left, nlx).addScaledVector(car.up, nly).addScaledVector(car.fwd, nlz).normalize();
    const pen = b.r - dist;
    b.pos.addScaledVector(_n, pen * 0.92);
    car.pos.addScaledVector(_n, -pen * 0.08);

    // velocity of the car at the contact point
    _r.set(0, 0, 0).addScaledVector(car.left, cx).addScaledVector(car.up, cy).addScaledVector(car.fwd, cz);
    _c.crossVectors(car.angVel, _r).add(car.vel);
    _b.copy(b.vel).sub(_c); // relative velocity
    const relMag = Math.min(46, _b.length());
    const vn = _b.dot(_n);
    if (b.stuckTo) return null;
    if (vn < 0) {
      const j = -vn / (1 / P.ballMass + 1 / P.carMass);
      b.vel.addScaledVector(_n, j / P.ballMass);
      car.vel.addScaledVector(_n, -j / P.carMass);
      // friction: the ball's contact point is dragged along with the car (spinning the ball),
      // up to 2x the normal impulse
      _a.crossVectors(b.angVel, _n).multiplyScalar(-b.r).add(_b); // slip at the contact point
      _a.addScaledVector(_n, -_a.dot(_n));
      const slip = _a.length();
      if (slip > 1e-4) {
        const jt = Math.min(P.carBallFriction * j, slip / (3.5 / P.ballMass + 1 / P.carMass));
        _a.multiplyScalar(-jt / slip); // tangential impulse on the ball
        b.vel.addScaledVector(_a, 1 / P.ballMass);
        car.vel.addScaledVector(_a, -1 / P.carMass);
        _w.crossVectors(_a, _n);
        b.angVel.addScaledVector(_w, 2.5 / (P.ballMass * b.r));
      }
    }
    let hitFresh = false;
    if (now - car.lastHitTime > 0.1 && vn < 0.5) {
      car.lastHitTime = now;
      hitFresh = true;
      _a.copy(b.pos).sub(car.pos);
      _a.y *= 0.35;
      _a.addScaledVector(car.fwd, -0.35 * _a.dot(car.fwd)).normalize();
      const scale = U.piecewise(HIT_SCALE, relMag) * (car.powerHit ? 1.7 : 1) * (env.hitScale || 1);
      b.vel.addScaledVector(_a, relMag * scale);
    }
    const maxSp = env.ballMaxSpeed || P.ballMaxSpeed;
    const sp = b.vel.length();
    if (sp > maxSp) b.vel.multiplyScalar(maxSp / sp);
    touch.car = car; touch.strength = relMag; touch.fresh = hitFresh;
    touch.point.copy(car.pos).add(_r); touch.normal.copy(_n);
    return touch;
  }
  Phys.collideCarBall = collideCarBall;

  // ---------- Car vs Car ----------
  const _s1 = { pen: 0, n: new V3() }, _s2 = { pen: 0, n: new V3() };
  function boxSphere(car, center, r, out) {
    _a.copy(center).sub(car.pos);
    const lx = _a.dot(car.left), ly = _a.dot(car.up), lz = _a.dot(car.fwd);
    const cx = U.clamp(lx, -car.hx, car.hx), cy = U.clamp(ly, -car.hy, car.hy), cz = U.clamp(lz, -car.hz, car.hz);
    const ex = lx - cx, ey = ly - cy, ez = lz - cz;
    const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (d >= r) { out.pen = 0; return out; }
    out.pen = r - d;
    if (d < 1e-4) out.n.copy(_a).normalize();
    else out.n.set(0, 0, 0).addScaledVector(car.left, ex / d).addScaledVector(car.up, ey / d).addScaledVector(car.fwd, ez / d);
    if (out.n.lengthSq() < 1e-6) out.n.set(0, 1, 0);
    out.n.normalize();
    return out;
  }
  const carEv = { type: '', attacker: null, victim: null, strength: 0 };
  function collideCars(a, b, env) {
    if (a.demolished || b.demolished) return null;
    const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
    if (dx * dx + dy * dy + dz * dz > 2.4 * 2.4) return null;
    boxSphere(a, b.pos, 0.46, _s1);
    boxSphere(b, a.pos, 0.46, _s2);
    if (_s1.pen <= 0 && _s2.pen <= 0) {
      // extra probes at the noses so long cars still collide
      _c.copy(b.pos).addScaledVector(b.fwd, b.hz * 0.7);
      boxSphere(a, _c, 0.4, _s1);
      if (_s1.pen <= 0) {
        _c.copy(a.pos).addScaledVector(a.fwd, a.hz * 0.7);
        boxSphere(b, _c, 0.4, _s2);
        if (_s2.pen <= 0) return null;
      }
    }
    let pen;
    if (_s1.pen >= _s2.pen) { _n.copy(_s1.n); pen = _s1.pen; } else { _n.copy(_s2.n).negate(); pen = _s2.pen; }
    a.pos.addScaledVector(_n, -pen / 2);
    b.pos.addScaledVector(_n, pen / 2);
    const vn = b.vel.dot(_n) - a.vel.dot(_n);
    if (vn >= 0) return null;
    // speeds before the knock, along the line between the cars (the bump rules use these)
    _cd.set(dx, dy, dz).normalize(); // a -> b
    _va.copy(a.vel); _vb.copy(b.vel);
    // the physical knock: cars barely bounce off each other (restitution 0.1, like the real game)
    const j = -1.1 * vn / 2;
    a.vel.addScaledVector(_n, -j);
    b.vel.addScaledVector(_n, j);
    // bumps and demos (the real rules): the car driving into the other with its bumper, closing faster than the other
    // is getting away, once per 0.25 s per pair. The other car gets pushed along the attacker's direction of travel
    // by an amount from the attacker's speed (14 m/s: 11 on the ground / 13.9 in the air, plus 2.8 up)
    // (each car is checked as the attacker: in a head-on both get bumped)
    carEv.type = ''; carEv.strength = 0; carEv.attacker = null; carEv.victim = null;
    const mode = env.demolish || 'normal';
    for (let k = 0; k < 2; k++) {
      const att = k ? b : a, vic = k ? a : b, sgn = k ? -1 : 1;
      const into = (k ? _vb : _va).dot(_cd) * sgn, away = (k ? _va : _vb).dot(_cd) * sgn;
      if (into > carEv.strength && carEv.type !== 'demo') { carEv.strength = into; carEv.attacker = att; carEv.victim = vic; carEv.type = 'bump'; }
      if (into <= 0.5 || into <= away) continue;
      if (_n.dot(att.fwd) * sgn <= 0.55) continue; // not with the bumper
      if (att.bumpT > 0 && att.bumpWho === vic.id) continue;
      att.bumpT = BUMP_COOLDOWN; att.bumpWho = vic.id;
      const sameTeam = att.team === vic.team;
      if (mode !== 'off' && (!sameTeam || mode === 'friendly') && (att.supersonic || (mode === 'contact' && into > 4) || (att.powerHit && into > 6))) {
        carEv.type = 'demo'; carEv.attacker = att; carEv.victim = vic; carEv.strength = into;
        return carEv;
      }
      const av = k ? _vb : _va, al = av.length() || 1, grounded = vic.onGround;
      vic.vel.addScaledVector(av, U.piecewise(grounded ? BUMP_GROUND : BUMP_AIR, into) / al);
      const lift = U.piecewise(BUMP_UP, into);
      if (grounded) vic.vel.addScaledVector(vic.up, lift); else vic.vel.y += lift;
      vic.jumpLock = 0.15;
    }
    return carEv.type && carEv.strength > 3 ? carEv : null;
  }
  // bump strength (m/s added to the car that's hit) from the attacker's speed into it: RocketSim's measured curves
  const BUMP_GROUND = [[0, 0.0083], [14, 11], [22, 15.3]], BUMP_AIR = [[0, 0.0083], [14, 13.9], [22, 19.45]], BUMP_UP = [[0, 0.0033], [14, 2.78], [22, 4.17]];
  const BUMP_COOLDOWN = 0.25;
  const _cd = new V3(), _va = new V3(), _vb = new V3();
  Phys.collideCars = collideCars;

  // ---------- Ball prediction ----------
  const _pb = new Ball();
  Phys.predictBall = function (b, seconds, step, env, out) {
    // (with the ball's spin: it changes how it bounces and rolls, so a spinless prediction drifts off after a bounce)
    _pb.r = b.r; _pb.pos.copy(b.pos); _pb.vel.copy(b.vel); _pb.angVel.copy(b.angVel);
    _pb.frozen = b.frozen; _pb.hidden = false; _pb.stuckTo = null;
    _pb.heat = b.heat ? { team: b.heat.team, speed: b.heat.speed, wait: b.heat.wait, fresh: b.heat.fresh } : null;
    const n = Math.floor(seconds / step);
    for (let i = 0; i < n; i++) {
      stepBall(_pb, step, env);
      const o = out[i] || (out[i] = {});
      o.t = (i + 1) * step; o.x = _pb.pos.x; o.y = _pb.pos.y; o.z = _pb.pos.z;
      o.vx = _pb.vel.x; o.vy = _pb.vel.y; o.vz = _pb.vel.z;
    }
    out.length = n;
    return out;
  };

  // returns team that scored (0 blue / 1 orange) or -1
  Phys.goalCheck = function (b) {
    if (b.hidden) return -1;
    if (Math.abs(b.pos.x) > A.goalHW + 0.5 || b.pos.y > A.goalH + 0.5) return -1;
    if (b.pos.z > A.hl + b.r) return 0;
    if (b.pos.z < -(A.hl + b.r)) return 1;
    return -1;
  };
  // which goal (team that owns it) a predicted path enters, else -1
  Phys.predictedGoal = function (pred, maxT) {
    for (let i = 0; i < pred.length; i++) {
      const p = pred[i];
      if (p.t > maxT) break;
      if (Math.abs(p.x) < A.goalHW && p.y < A.goalH) {
        if (p.z > A.hl) return 1;
        if (p.z < -A.hl) return 0;
      }
    }
    return -1;
  };
})(window.BL);
