'use strict';
// Rocket League (fan remake) - bot AI (rookie -> all-star -> SSL by skill 0..1)
// How a bot plays (the way strong RLBot bots do it): it reads the ball's predicted path, finds the first moment it can
// get to the ball (driving, jumping or flying there), picks where to send it (at the net, a centre in front of it, or a
// clear away from its own goal), and lines the car up behind the ball so the hit goes there. Team mates share the work
// by who gets there first: one goes, one supports behind the play, the last stays back; whoever is beaten to the ball
// shadows back goal-side instead of diving in, and anyone near the net saves a ball that is heading in.
// Skill turns the mechanics on (jump shots, power flips, aerials, half flips) and sets how quick and accurate they are.
(function (BL) {
  const U = BL.util;
  const V3 = THREE.Vector3;
  const AI = BL.AI = {};
  const Phys = BL.Physics, P = BL.PHYS;

  const _t = new V3(), _a = new V3(), _b = new V3(), _c = new V3(), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();
  const UP = new V3(0, 1, 0);

  function brain(car) {
    if (!car.ai || !car.ai.s) car.ai = { planT: Math.random() * 0.1, role: 'attack', act: null, seq: null, seqT: 0, wallT: 0, noise: new V3(), s: new V3(0, 0, 1), aim: new V3(), tHit: 0, hitY: 0, stuck: 0, kick: null };
    return car.ai;
  }

  // ---------- driving model (same numbers physics.js uses) ----------
  // distance covered in a straight line t seconds after starting at speed v0, with and without boost
  const TS = 1 / 30, TN = 151;
  const DB = [], DN = [], VB = [];
  (function () {
    for (let v0 = 0; v0 <= 23; v0++) {
      for (let b = 0; b < 2; b++) {
        const D = new Float32Array(TN), V = new Float32Array(TN);
        let v = v0, d = 0;
        for (let i = 0; i < TN; i++) {
          D[i] = d; V[i] = v;
          for (let k = 0; k < 4; k++) {
            const h = TS / 4;
            const ta = v < 14 ? 16 + (1.6 - 16) * (v / 14) : (v < 14.1 ? 1.6 * (14.1 - v) / 0.1 : 0);
            v = Math.min(P.carMaxSpeed, v + (ta + (b ? P.boostAccel : 0)) * h);
            d += v * h;
          }
        }
        if (b) { DB[v0] = D; VB[v0] = V; } else DN[v0] = D;
      }
    }
  })();
  function look(arr, t) {
    const f = t / TS;
    if (f >= TN - 1) return arr[TN - 1] + (arr[TN - 1] - arr[TN - 2]) * (f - (TN - 1));
    const i = f | 0;
    return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
  }
  // metres covered in t seconds from speed v0 with tb seconds of boost to use
  function travel(v0, t, tb) {
    if (t <= 0) return 0;
    const vi = Math.max(0, Math.min(23, Math.round(v0)));
    if (tb >= t) return look(DB[vi], t);
    let d = 0, v = vi;
    if (tb > 0.03) { d = look(DB[vi], tb); v = Math.max(0, Math.min(23, Math.round(look(VB[vi], tb)))); } else tb = 0;
    return d + look(DN[v], t - tb);
  }
  // turning, roughly: how long to face a direction `ang` radians away, and the speed left after it
  function turnCost(car, ang) {
    const sp = Math.max(0, car.vel.dot(car.fwd));
    return { t: ang / (ang > 1.6 ? 3.4 : 2.6), v: sp * (1 - Math.min(0.7, ang * 0.32)) };
  }
  // can `car` drive to (x, z) within t seconds (arriving heading along (ax, az) if given)?  returns spare time (>= 0 ok)
  function reachSpare(car, x, z, t, ax, az, boostOK) {
    const dx = x - car.pos.x, dz = z - car.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6) return t;
    const fx = car.fwd.x, fz = car.fwd.z, fl = Math.hypot(fx, fz) || 1;
    const ang = Math.acos(U.clamp((dx * fx + dz * fz) / (d * fl), -1, 1));
    const tc = turnCost(car, ang);
    let dd = d, tt = tc.t + (car.onGround ? 0 : 0.35);
    if (ax !== undefined) {
      // the swing round to come in along the shot line
      const ca = U.clamp((dx * ax + dz * az) / d, -1, 1), th = Math.acos(ca);
      dd += d * (1 - ca) * 0.3 + th * 2.2;
      tt += th * 0.12;
    }
    if (car.vel.dot(car.fwd) < -2) tt += 0.25;
    const tb = boostOK ? car.boost / P.boostUse : 0;
    const left = t - tt;
    if (left <= 0) return -1;
    return travel(tc.v, left, tb) >= dd ? left : -1;
  }

  // ---------- jumping model ----------
  // height gained t seconds after a full jump (hold 0.2 s), and after a jump with a double jump at 0.2 s
  const JS = 1 / 60, JN = 120, jumpCache = {};
  function jumpTable(g) {
    const key = g.toFixed(2);
    if (jumpCache[key]) return jumpCache[key];
    const one = new Float32Array(JN), two = new Float32Array(JN);
    for (let dbl = 0; dbl < 2; dbl++) {
      const out = dbl ? two : one;
      let v = P.jumpImpulse, y = 0, t = 0, dj = false;
      for (let i = 0; i < JN; i++) {
        out[i] = y;
        for (let k = 0; k < 2; k++) {
          const h = JS / 2;
          let a = -g;
          if (t < P.jumpHoldTime) a += P.jumpHoldAccel;
          if (dbl && !dj && t >= P.jumpHoldTime) { v += P.jumpImpulse; dj = true; }
          v += a * h; y += v * h; t += h;
        }
      }
    }
    let m1 = 0, m2 = 0, t1 = 0, t2 = 0;
    for (let i = 0; i < JN; i++) { if (one[i] > m1) { m1 = one[i]; t1 = i * JS; } if (two[i] > m2) { m2 = two[i]; t2 = i * JS; } }
    return (jumpCache[key] = { one, two, max1: m1, max2: m2, apex1: t1, apex2: t2 });
  }
  // time from pressing jump until the car has risen h metres (on the way up), or -1
  function riseTime(g, h, dbl) {
    const J = jumpTable(g), arr = dbl ? J.two : J.one;
    for (let i = 1; i < JN; i++) { if (arr[i] >= h) { const k = (h - arr[i - 1]) / ((arr[i] - arr[i - 1]) || 1); return (i - 1 + k) * JS; } if (arr[i] < arr[i - 1]) break; }
    return -1;
  }

  // ---------- the ball's future ----------
  // game.prediction is refreshed every 0.1 s (and on touches); a slice's time counts from when it was made
  function predAge(game) { return U.clamp(0.1 - (game.predT || 0), 0, 0.1); }
  const _bs = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 };
  function ballAt(game, t, o) {
    o = o || _bs;
    const pr = game.prediction, b = game.ball, st = 1 / 30, age = predAge(game);
    o.t = t;
    if (!pr.length || t <= 0) { o.x = b.pos.x; o.y = b.pos.y; o.z = b.pos.z; o.vx = b.vel.x; o.vy = b.vel.y; o.vz = b.vel.z; return o; }
    const f = (t + age) / st - 1;
    let p0, p1, k;
    if (f < 0) {
      const p = pr[0], kk = U.clamp(t / Math.max(1e-3, st - age), 0, 1);
      o.x = b.pos.x + (p.x - b.pos.x) * kk; o.y = b.pos.y + (p.y - b.pos.y) * kk; o.z = b.pos.z + (p.z - b.pos.z) * kk;
      o.vx = p.vx; o.vy = p.vy; o.vz = p.vz; return o;
    }
    if (f >= pr.length - 1) { p0 = p1 = pr[pr.length - 1]; k = 0; } else { const i = f | 0; p0 = pr[i]; p1 = pr[i + 1]; k = f - i; }
    o.x = p0.x + (p1.x - p0.x) * k; o.y = p0.y + (p1.y - p0.y) * k; o.z = p0.z + (p1.z - p0.z) * k;
    o.vx = p0.vx + (p1.vx - p0.vx) * k; o.vy = p0.vy + (p1.vy - p0.vy) * k; o.vz = p0.vz + (p1.vz - p0.vz) * k;
    return o;
  }
  // when (and where) the ball crosses a team's goal line inside the frame, or null
  function goalCross(game, team) {
    const pr = game.prediction, A = Phys.arena, z0 = team === 0 ? -A.hl : A.hl, age = predAge(game);
    for (let i = 0; i < pr.length; i++) {
      const p = pr[i];
      if ((team === 0 ? p.z < z0 : p.z > z0) && Math.abs(p.x) < A.goalHW + 0.6 && p.y < A.goalH + 0.6) return { t: p.t - age, x: p.x, y: p.y };
    }
    return null;
  }

  // ---------- skill ----------
  // everything a bot can do comes from its skill: Rookie (~0.2) keeps it simple and slow, Pro (~0.5) jump shots and
  // power flips, All-Star (~0.85) aerials and saves, Supersonic Legend (1) all of it, quick and on target
  function caps(car) {
    const sk = car.skill;
    if (car.ai && car.ai.capsFor === sk) return car.ai.caps;
    const k = {
      sk,
      plan: U.lerp(0.32, 0.03, sk),          // how often it re-reads the play (s)
      aimErr: U.lerp(0.42, 0.025, sk),       // shot direction error (rad)
      posErr: U.lerp(2.6, 0.15, sk),         // where it thinks the ball will be (m)
      maxSp: U.lerp(16, 23, Math.min(1, sk * 1.3)),
      boost: sk > 0.12,                      // uses boost at all
      dodge: sk > 0.18,                      // flips into the ball for power
      jump: sk > 0.08,                       // jump shots
      dbl: sk > 0.5,                         // double jump shots
      aerial: sk > 0.42,                     // aerials
      aerialH: U.clamp(U.lerp(3.5, 18, (sk - 0.42) / 0.5), 3.5, 19),
      aerialAcc: U.lerp(0.55, 0.86, sk),     // how much of the boost acceleration it dares to rely on
      half: sk > 0.62,                       // half flips
      flipSpeed: sk > 0.5,                   // front flips for speed
      rotate: sk > 0.3,                      // keeps team shape instead of everyone chasing
      shadow: sk > 0.38,                     // backs off goal-side when beaten to the ball
      timingErr: U.lerp(0.11, 0.008, sk),    // jump timing error (s)
      kickFlip: sk > 0.22,
      reach: sk > 0.8 ? 2 : 1,
    };
    if (car.ai) { car.ai.caps = k; car.ai.capsFor = sk; }
    return k;
  }

  // ---------- low-level control ----------
  function clearControls(c) {
    c.throttle = 0; c.steer = 0; c.boost = false; c.handbrake = false; c.pitch = 0; c.roll = 0; c.airRollFree = false;
  }
  // drive toward a point on the car's driving plane at about `speed` m/s (boost only when allowed)
  function drive(car, c, tx, tz, speed, boostOK, ty) {
    _a.set(tx - car.pos.x, (ty == null ? car.pos.y : ty) - car.pos.y, tz - car.pos.z);
    const lx = _a.dot(car.left), lz = _a.dot(car.fwd);
    const ang = Math.atan2(-lx, lz); // + = target to the right
    const dist = Math.hypot(lx, lz);
    const sp = car.vel.dot(car.fwd);
    if (Math.abs(ang) > 2.2 && dist < 6 && sp < 6) {
      // just behind: back up to it (reversing, steering the same way turns the tail toward it)
      c.throttle = -1;
      c.steer = Math.sign(ang) * U.clamp((Math.PI - Math.abs(ang)) * 3, 0, 1);
      c.handbrake = false; c.boost = false;
      return { ang, dist, sp };
    }
    c.steer = U.clamp(ang * 3.6, -1, 1);
    if (sp < speed - 0.8) c.throttle = 1;
    else if (sp > speed + 1.5) c.throttle = sp > speed + 5 ? -1 : 0;
    else c.throttle = speed > 13 ? 1 : 0.4;
    // a sharp turn at speed: powerslide round it
    c.handbrake = car.onGround && Math.abs(ang) > 1.5 && sp > 7 && dist > 2.5;
    c.boost = !!boostOK && car.onGround && Math.abs(ang) < 0.32 && speed > 13.5 && sp < speed - 0.3 && car.boost > 0;
    return { ang, dist, sp };
  }
  // stop and turn to face a point
  function face(car, c, x, z) {
    _a.set(x - car.pos.x, 0, z - car.pos.z);
    const lx = _a.dot(car.left), lz = _a.dot(car.fwd);
    const ang = Math.atan2(-lx, lz), sp = car.vel.dot(car.fwd);
    if (Math.abs(ang) > 0.35) {
      // creep round in a tight circle
      c.throttle = sp > 4 ? -0.6 : 0.6; c.steer = Math.sign(ang) * (sp < 0 ? -1 : 1);
    } else { c.throttle = sp > 1 ? -0.5 : sp < -1 ? 0.5 : 0; c.steer = U.clamp(ang * 2, -1, 1); }
    c.boost = false; c.handbrake = false;
  }

  // point the nose along `dir` (world) in the air, wheels toward `upHint` (default world up). PD gains match the
  // car's air acceleration (pitch 12.5, yaw 9.1, roll 37 rad/s^2). Returns the angle still to turn.
  const _m4 = new THREE.Matrix4(), _ax = new V3(), _au = new V3();
  // orientation with the nose exactly along f and the roof as close to `up` as that allows
  // (U.basisQuat keeps the roof exact instead, which can never point the nose up)
  function noseQuat(f, up, out, car) {
    _ax.crossVectors(up, f);
    // nose straight along `up`: keep whatever side the car has now
    if (_ax.lengthSq() < 1e-6) _ax.copy(car.left).addScaledVector(f, -car.left.dot(f));
    _ax.normalize();
    _au.crossVectors(f, _ax).normalize();
    _m4.makeBasis(_ax, _au, f);
    return out.setFromRotationMatrix(_m4);
  }
  function airAim(car, c, dir, upHint) {
    _a.copy(dir).normalize();
    noseQuat(_a, upHint || UP, _q, car);
    _qi.copy(car.quat).invert();
    _q.multiply(_qi); // error rotation (world)
    if (_q.w < 0) { _q.x = -_q.x; _q.y = -_q.y; _q.z = -_q.z; _q.w = -_q.w; }
    const s = Math.sqrt(Math.max(0, 1 - _q.w * _q.w));
    const angle = 2 * Math.acos(Math.min(1, _q.w));
    _b.set(0, 0, 0);
    if (s > 1e-4) _b.set(_q.x / s, _q.y / s, _q.z / s).multiplyScalar(angle);
    _b.applyQuaternion(_qi); // to local
    _c.copy(car.angVel).applyQuaternion(_qi);
    c.pitch = U.clamp(_b.x * 5 - _c.x * 1.15, -1, 1);
    c.steer = -U.clamp(_b.y * 4.2 - _c.y * 1.25, -1, 1);
    c.roll = U.clamp(_b.z * 3.2 - _c.z * 0.55, -1, 1);
    c.airRollFree = false;
    // how far the nose itself is off (roll doesn't count)
    return Math.acos(U.clamp(car.fwd.dot(_a), -1, 1));
  }

  // ---------- jump sequences ----------
  // o: { hold, dodgeAt, dp, ds, dbl, aim } - hold the jump `hold` s; dodge at `dodgeAt` (pitch dp, steer ds) or double
  // jump at `dbl`; in between point the nose at the ball if `aim`
  function startJump(car, ai, c, o) {
    if (ai.seq) return;
    ai.seq = 'jump'; ai.seqT = 0; ai.j = o; ai.jDone = false; ai.dblDone = false;
    c.jumpSeq++; c.jump = true;
  }
  function runJump(car, ai, c, game, dt) {
    const o = ai.j, t = ai.seqT;
    c.throttle = 1;
    c.jump = t < o.hold;
    if (o.aim && !car.onGround) {
      const b = game.ball;
      _t.set(b.pos.x - car.pos.x, b.pos.y - car.pos.y, b.pos.z - car.pos.z);
      if (_t.lengthSq() > 0.01) airAim(car, c, _t);
    }
    if (o.dbl != null && !ai.dblDone && t >= o.dbl && !car.onGround) {
      ai.dblDone = true; c.pitch = 0; c.steer = 0; c.roll = 0; c.jumpSeq++;
    }
    // dodge: at the planned moment, or (dodgeNear) once the ball is within reach
    let go = false;
    if (!ai.jDone && !car.onGround && car.hasFlip) {
      if (o.dodgeAt != null && t >= o.dodgeAt) go = true;
      if (o.dodgeNear && car.pos.distanceTo(game.ball.pos) < o.dodgeNear) go = true;
    }
    if (go) {
      ai.jDone = true;
      let dp = o.dp, ds = o.ds;
      if (o.dodgeNear && o.dir) {
        // flip along the shot line (so the extra push sends it where we aimed)
        const lz = o.dir.x * car.fwd.x + o.dir.z * car.fwd.z, lx = o.dir.x * car.left.x + o.dir.z * car.left.z, m = Math.hypot(lz, lx) || 1;
        dp = lz / m; ds = -lx / m;
      } else if (o.dodgeNear) {
        // flip straight at the ball
        _t.copy(game.ball.pos).sub(car.pos);
        const lz = _t.dot(car.fwd), lx = _t.dot(car.left), m = Math.hypot(lz, lx) || 1;
        dp = lz / m; ds = -lx / m;
      }
      c.pitch = dp; c.steer = ds; c.roll = 0; c.jumpSeq++;
      ai.seq = 'flip'; ai.seqT = 0; ai.flipP = dp; ai.flipS = ds;
      return;
    }
    if ((car.onGround && t > 0.25) || t > (o.max || 1.6)) ai.seq = null;
  }

  // ---------- aerials ----------
  // fly to meet the ball: jump, double jump, then point the nose along the acceleration still needed and boost
  // (target - where gravity and our speed take us, the classic RLBot aerial)
  function aerialNeed(car, x, y, z, T, g, out) {
    out.x = x - car.pos.x - car.vel.x * T;
    out.y = y - car.pos.y - car.vel.y * T + 0.5 * g * T * T;
    out.z = z - car.pos.z - car.vel.z * T;
    return out;
  }
  function aerialOK(car, game, b, T, k, s) {
    if (!k.aerial || T < 0.5 || T > U.lerp(1.5, 2.6, k.sk) || b.y > k.aerialH || b.y < 2.4 || !car.onGround || car.groundN.y < 0.9) return false;
    const g = game.env.gravity, tj = 0.25;
    // after the jump and double jump we're about 0.9 m up, going up at ~7 m/s
    const vy = 2 * P.jumpImpulse + P.jumpHoldAccel * P.jumpHoldTime - g * tj;
    const px = car.pos.x + car.vel.x * tj, py = car.pos.y + 0.95, pz = car.pos.z + car.vel.z * tj;
    const Tr = T - tj;
    const tx = b.x - s.x * 1.2, ty = b.y, tz = b.z - s.z * 1.2;
    const dx = tx - px - car.vel.x * Tr, dy = ty - py - vy * Tr + 0.5 * g * Tr * Tr, dz = tz - pz - car.vel.z * Tr;
    const need = (2 * Math.hypot(dx, dy, dz)) / (Tr * Tr);
    // the nose has to come round toward it first (about 0.35 s from flat to straight up)
    const dl = Math.hypot(dx, dy, dz);
    const turnT = dl < 1.5 ? 0.2 : 0.25 + 0.3 * Math.acos(U.clamp(dy / dl, -1, 1)) / (Math.PI / 2);
    if (Tr - turnT < 0.2) return false;
    const needTurn = need * Tr / (Tr - turnT);
    return needTurn < P.boostAccelAir * k.aerialAcc && car.boost > ((needTurn / P.boostAccelAir) * Tr * P.boostUse) + 6;
  }
  function startAerial(car, ai, c, game, T, s) {
    ai.seq = 'aerial'; ai.seqT = 0; ai.tHit = game.time + T; ai.dj = false;
    if (s) ai.s.copy(s);
    c.jumpSeq++; c.jump = true;
  }
  function runAerial(car, ai, c, game, dt, k) {
    const t = ai.seqT, g = game.env.gravity;
    let T = ai.tHit - game.time;
    const b = ballAt(game, Math.max(0, T), _bs);
    // aim at the side of the ball facing away from where we want it to go
    const off = game.env.heatseeker ? 0.6 : 1.15;
    const tx = b.x - ai.s.x * off, ty = b.y - ai.s.y * off * 0.3, tz = b.z - ai.s.z * off;
    const Te = Math.max(0.06, T);
    const need = aerialNeed(car, tx, ty, tz, Te, g, _t);
    const nd = need.length();
    c.jump = t < 0.2;
    c.throttle = 1;
    if (!ai.dj && t >= 0.2 && !car.onGround) {
      // the double jump: stick in the middle for that press so it doesn't become a dodge
      ai.dj = true; c.pitch = 0; c.steer = 0; c.roll = 0; c.jumpSeq++; c.boost = car.fwd.dot(need) > 0.8 * nd && car.boost > 0;
      return;
    }
    let err;
    if (nd > 0.5) err = airAim(car, c, need);
    else { _a.set(b.x - car.pos.x, b.y - car.pos.y, b.z - car.pos.z); err = airAim(car, c, _a); }
    // boost while the nose is on the line and we still need more than a little push
    const acc = (2 * nd) / (Te * Te);
    c.boost = car.boost > 0 && err < 0.45 && nd > 0.3 && acc > P.boostAccelAir * 0.18;
    // close: flip into the ball if we still have one (no double jump used)
    if (k.sk > 0.75 && car.hasFlip && T < 0.15 && car.pos.distanceTo(game.ball.pos) < 2.4 && !car.onGround) {
      _t.copy(game.ball.pos).sub(car.pos);
      const lz = _t.dot(car.fwd), lx = _t.dot(car.left), m = Math.hypot(lz, lx) || 1;
      c.pitch = lz / m; c.steer = -lx / m; c.roll = 0; c.jumpSeq++;
      ai.seq = 'flip'; ai.seqT = 0; ai.flipP = c.pitch; ai.flipS = c.steer;
      return;
    }
    // done: hit it, missed it, landed, or it went somewhere else
    if (T < -0.25 || (car.onGround && t > 0.35) || t > 4 || (T < 1.0 && game.ball.pos.distanceTo(car.pos) > 25)) ai.seq = null;
    else if (car.lastHitTime > game.time - 0.15 && t > 0.3) ai.seq = null;
  }

  // ---------- half flip: turn round quickly from a standstill ----------
  function runHalf(car, ai, c, game) {
    const t = ai.seqT;
    c.throttle = -1;
    if (t < 0.06) { c.jump = true; return; }
    c.jump = false;
    if (!ai.hfFlip) {
      if (!car.onGround) { ai.hfFlip = true; c.pitch = -1; c.steer = 0; c.roll = 0; c.jumpSeq++; }
      else if (t > 0.3) ai.seq = null;
      return;
    }
    // backflip, then (cancelled by the stick going the other way) air roll round to land facing back
    if (t < 0.2) { c.pitch = -1; return; }
    _a.set(ai.hfX - car.pos.x, 0, ai.hfZ - car.pos.z);
    if (_a.lengthSq() < 0.01) _a.set(-car.fwd.x, 0, -car.fwd.z);
    airAim(car, c, _a);
    c.boost = car.fwd.dot(_a.normalize()) > 0.85 && t > 0.45 && car.boost > 0;
    if ((car.onGround && t > 0.35) || t > 1.4) ai.seq = null;
  }

  // ---------- planning ----------
  // the shot direction for a ball at b: at the net (lined up from the car if it can't get round), a centre from the
  // corners, or a clear away from our goal
  function shotDir(car, game, b, mode, k, out) {
    const A = Phys.arena, dir = car.team === 0 ? 1 : -1, oppZ = dir * A.hl, ownZ = -dir * A.hl;
    // where it wants the ball to go
    let gx = U.clamp(b.x * 0.18, -A.goalHW * 0.35, A.goalHW * 0.35), gz = oppZ + dir * 2;
    const deep = (oppZ - b.z) * dir;
    if (deep < 14 && Math.abs(b.x) > A.goalHW + 3) { gx = -Math.sign(b.x) * 2.5; gz = oppZ - dir * 9; } // centre it from the corner
    _a.set(gx - b.x, 0, gz - b.z).normalize();
    if (mode === 'clear') {
      // away from our net: toward the side of the field it's already on, and up the field
      const sx = Math.sign(b.x || car.pos.x || 1);
      _a.set(sx * 0.8, 0, dir * 0.6).normalize();
      if ((b.z - ownZ) * dir > 18) _a.set(sx * 0.35, 0, dir).normalize();
      // a fast ball coming at our goal: meet it head on and send it back the way it came (you can't get round it)
      const vh = Math.hypot(b.vx, b.vz);
      if (vh > 9 && b.vz * dir < -5) _a.set(-b.vx / vh + _a.x * 0.5, 0, -b.vz / vh + _a.z * 0.5).normalize();
    }
    // a moving ball keeps its own speed and the hit adds to it: hit it along the direction that makes
    // (ball velocity + hit) come out along the line we want (a rolling ball needs the hit aimed "into" its roll)
    const bvx = b.vx || 0, bvz = b.vz || 0, bv2 = bvx * bvx + bvz * bvz;
    if (bv2 > 4) {
      const fx = _a.x, fz = _a.z, vc = U.clamp(Math.max(Math.hypot(car.vel.x, car.vel.z), 14) + 3, 14, 26);
      let dx = fx, dz = fz;
      for (let it = 0; it < 3; it++) {
        const u = Math.max(4, vc - (bvx * dx + bvz * dz)), H = 1.25 * u, sv = fx * bvx + fz * bvz, disc = sv * sv - bv2 + H * H;
        const vf = disc > 0 ? sv + Math.sqrt(disc) : H;
        dx = vf * fx - bvx; dz = vf * fz - bvz;
        const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      }
      _a.set(dx, 0, dz);
    }
    // the car can only swing so far round the ball: blend from the straight-on line toward the ideal one
    _b.set(b.x - car.pos.x, 0, b.z - car.pos.z);
    const d = _b.length() || 1; _b.multiplyScalar(1 / d);
    const maxTurn = U.lerp(0.55, 1.25, k.sk) * U.clamp(d / 14, 0.35, 1) * (car.ai.turnScale == null ? 1 : car.ai.turnScale);
    let ang = Math.acos(U.clamp(_a.dot(_b), -1, 1));
    if (ang > maxTurn) {
      const crs = _b.x * _a.z - _b.z * _a.x, sgn = crs >= 0 ? 1 : -1, r = maxTurn * sgn;
      _a.set(_b.x * Math.cos(r) - _b.z * Math.sin(r), 0, _b.x * Math.sin(r) + _b.z * Math.cos(r));
      // ...but never toward our own goal when near it: then take the clear that the line allows
      const toOwn = (ownZ - b.z) * dir < 0 ? -_a.z * dir : 0;
      if (toOwn > 0.45 && (b.z - ownZ) * dir < A.hl) {
        _a.set(_b.x, 0, _b.z);
        if (-_a.z * dir > 0.45) { _a.z = 0; _a.x = Math.sign(_a.x || b.x || 1); }
        _a.normalize();
      }
      ang = maxTurn;
    }
    // skill: aim error, fixed per shot
    const e = car.ai.aimN * k.aimErr;
    out.set(_a.x * Math.cos(e) - _a.z * Math.sin(e), 0, _a.x * Math.sin(e) + _a.z * Math.cos(e));
    return out;
  }

  // the earliest moment this car can hit the ball, and how (ground, jump, double jump or aerial)
  const GROUND_H = 1.2; // ball centre below this: a ground hit (it's rolling or right at its bounce)
  // (the Ball Size mutator: the heights and the nose-to-ball distances follow the ball's real radius; they used to
  // assume the normal ball, so with a Gigantic or Small one the bots whiffed every hit)
  const groundH = (game) => GROUND_H + (game.ball.r - 0.9125);
  const hitOff = (game, car, kind) => (kind === 'ground' ? game.ball.r + 0.44 + car.hz - 0.59 : car.hz + game.ball.r - 0.16);
  const _s = new V3(), _hit = { t: 0, kind: '', x: 0, y: 0, z: 0, ok: false }, _hit2 = { t: 0, kind: '', x: 0, y: 0, z: 0, ok: false };
  function findHit(car, game, mode, k, out) {
    const pr = game.prediction, age = predAge(game), A = Phys.arena, g = game.env.gravity;
    const J = jumpTable(g);
    const maxJ = (k.dbl ? J.max2 : J.max1) + car.restH + 0.6;
    const boostOK = k.boost;
    out.ok = false;
    let airPick = null;
    const n = pr.length;
    for (let i = 0; i < n; i += (i < 45 ? 1 : 2)) {
      const p = pr[i], t = p.t - age;
      if (t < 0.03) continue;
      if (Phys.wall2d(p.x, p.z) > -1.6 && Math.abs(p.x) > A.goalHW) continue; // up against a wall
      if (Math.abs(p.z) > A.hl + 0.5) continue; // in a goal already
      const h = p.y;
      // on the ground (rolling or right at the bounce), a hop so the nose meets the middle of the ball (hitting a
      // ball at bumper height from under it only pops it up over the bar), a full jump, a double jump, or fly
      let kind = h < groundH(game) ? 'ground' : h < J.max1 + car.restH + 0.3 ? 'jump' : h < maxJ ? 'dbl' : 'air';
      if (kind !== 'ground' && !k.jump) { if (h > 1.75) continue; kind = 'ground'; }
      // double jump shots only without the boost (or the skill) to fly
      if (kind === 'dbl' && k.aerial && car.boost > 20) kind = 'air';
      if (kind === 'air' || (kind === 'dbl' && !k.dbl)) {
        if (!airPick && k.aerial) {
          shotDir(car, game, p, mode, k, _s);
          if (aerialOK(car, game, p, t, k, _s)) airPick = { t, x: p.x, y: p.y, z: p.z, sx: _s.x, sz: _s.z };
        }
        continue;
      }
      shotDir(car, game, p, mode, k, _s);
      const off = hitOff(game, car, kind);
      const cx = p.x - _s.x * off, cz = p.z - _s.z * off;
      let tt = t;
      if (kind !== 'ground') {
        // the jump has to start early enough to rise to it
        const rt = riseTime(g, U.clamp(h - 0.15 - car.restH, 0.1, (kind === 'dbl' ? J.max2 : J.max1) - 0.05), kind === 'dbl');
        if (rt < 0) continue;
        tt = t - 0.05;
      }
      const spare = reachSpare(car, cx, cz, tt, _s.x, _s.z, boostOK);
      if (spare >= 0) {
        // a high ball we could fly to much sooner wins
        if (airPick && airPick.t < t - 0.6) break;
        Object.assign(out, { ok: true, t, kind, x: p.x, y: p.y, z: p.z, sx: _s.x, sz: _s.z, spare });
        return out;
      }
    }
    if (airPick) { Object.assign(out, { ok: true, t: airPick.t, kind: 'air', x: airPick.x, y: airPick.y, z: airPick.z, sx: airPick.sx, sz: airPick.sz, spare: 0 }); return out; }
    return out;
  }

  // rough earliest touch for any car (team mates and opponents, people included): driving to the ball's path
  function quickHit(car, game) {
    if (car.demolished) return 99;
    const pr = game.prediction, age = predAge(game);
    const hMax = car.isBot ? (car.skill > 0.42 ? 9 : car.skill > 0.08 ? 3.3 : 1.8) : 6;
    for (let i = 0; i < pr.length; i += 2) {
      const p = pr[i], t = p.t - age;
      if (t < 0.03 || p.y > hMax) continue;
      if (reachSpare(car, p.x, p.z, t + (p.y > 2 ? -0.1 : 0), undefined, undefined, true) >= 0) return t;
    }
    return 5 + car.pos.distanceTo(game.ball.pos) / 20;
  }
  // per tick: everyone's rough time to the ball (shared by all bots this tick)
  function hitTimes(game) {
    const C = game._aiHits || (game._aiHits = { tick: -1, t: new Map() });
    if (C.tick === game.tickN) return C.t;
    // refresh every 4 ticks; in between reuse, minus the time gone
    if (C.tick >= 0 && game.tickN - C.tick < 4 && C.n === game.cars.length) return C.t;
    C.tick = game.tickN; C.n = game.cars.length;
    for (const c of game.cars) C.t.set(c, quickHit(c, game));
    return C.t;
  }

  // is the car between the ball and its own goal?
  function goalSide(car, game, bx, bz) {
    const A = Phys.arena, dir = car.team === 0 ? 1 : -1, ownZ = -dir * A.hl;
    return Math.hypot(car.pos.x, car.pos.z - ownZ) < Math.hypot(bx * 0.6, bz - ownZ) + 1;
  }

  // the team's roles: who goes for the ball, who supports, who stays back
  function teamRoles(car, game, k) {
    const mates = game.cars.filter((o) => o.team === car.team && !o.demolished);
    const T = hitTimes(game), b = game.ball;
    const score = (o) => {
      let s = T.get(o);
      if (!goalSide(o, game, b.pos.x, b.pos.z)) s += 0.55;
      if (o.ai && o.ai.role === 'attack') s -= 0.28; // stick with it (no swapping back and forth)
      if (!o.isBot) s -= 0.3; // let people have it
      if (o.isBot && o.boost < 12 && s > 0.8) s += 0.25;
      return s;
    };
    const mine = score(car);
    let rank = 0;
    for (const o of mates) {
      if (o === car) continue;
      const so = score(o);
      if (so < mine - 1e-6 || (Math.abs(so - mine) < 1e-6 && o.id < car.id)) rank++;
    }
    // low skill: chase it if you're anywhere near (bad rotation, like real low ranks)
    if (!k.rotate && rank > 0 && mine < 1.8) rank = 0;
    return { rank, n: mates.length };
  }

  // where a support / last-back player stands
  function supportSpot(car, game, role, out) {
    const A = Phys.arena, dir = car.team === 0 ? 1 : -1, ownZ = -dir * A.hl;
    const b = ballAt(game, 0.5, _bs);
    const kf = U.clamp(((b.z - ownZ) * dir) / (2 * A.hl), 0, 1); // 0 = ball on our goal line, 1 = on theirs
    let sx, sz;
    if (role === 'support') {
      const back = U.lerp(10, 22, kf);
      sx = b.x * 0.5 - Math.sign(b.x || 1) * U.lerp(3, 9, kf);
      sz = b.z - dir * back;
    } else {
      // last back: deep when the ball is near our goal, about at our side of the middle when it's in their end
      sx = b.x * 0.3;
      sz = ownZ + dir * U.lerp(5, 40, kf * kf);
      if ((b.z - sz) * dir < 12) sz = b.z - dir * 12;
    }
    sz = U.clamp(sz, -A.hl + 3, A.hl - 3);
    if ((sz - ownZ) * dir < 3) sz = ownZ + dir * 3;
    out.set(U.clamp(sx, -A.hw + 5, A.hw - 5), 0, sz);
    return out;
  }

  function nearestBigPad(car, game, maxD, dir, limitZ) {
    let best = null, bd = maxD;
    for (const p of game.padState) {
      if (!p.big || !p.active) continue;
      if (limitZ != null && (p.z - limitZ) * dir > 6) continue; // not up past where we're going
      const d = Math.hypot(p.x - car.pos.x, p.z - car.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  // a small pad close to the line we're driving anyway (a little detour for a quick 12 boost)
  function padOnTheWay(car, game, tx, tz) {
    const dx = tx - car.pos.x, dz = tz - car.pos.z, d = Math.hypot(dx, dz);
    if (d < 8 || car.boost > 85) return null;
    const ux = dx / d, uz = dz / d;
    let best = null, bs = 2.6;
    for (const p of game.padState) {
      if (p.big || !p.active) continue;
      const rx = p.x - car.pos.x, rz = p.z - car.pos.z, along = rx * ux + rz * uz;
      if (along < 3 || along > d - 2) continue;
      const side = Math.abs(rx * uz - rz * ux);
      if (side < bs) { bs = side; best = p; }
    }
    return best;
  }

  // ---------- the brain ----------
  AI.think = function (car, game, dt) {
    const c = car.controls;
    const ai = brain(car);
    const A = Phys.arena;
    const k = caps(car);
    const ball = game.ball;
    if (car.demolished) { clearControls(c); c.jump = false; return; }

    const dir = car.team === 0 ? 1 : -1; // attack direction (z)
    const oppZ = dir * A.hl, ownZ = -dir * A.hl;
    // after a goal: the scoring team celebrates (it shows in the replay), the other team sulks
    if (game.phase === 'goal' && game.lastGoal) { celebrate(car, c, ai, game, dt); return; }
    ai.celGoal = null;
    clearControls(c);

    // ---- jump sequences in progress (shots, flips, aerials, half flips) ----
    if (ai.seq) {
      ai.seqT += dt;
      if (ai.seq === 'jump') { runJump(car, ai, c, game, dt); if (ai.seq) return; }
      if (ai.seq === 'flip') {
        // hold the flip direction (the stick doesn't change a dodge once it's going) until we land
        c.pitch = ai.flipP; c.steer = ai.flipS; c.jump = false; c.throttle = 1;
        if (car.onGround || ai.seqT > 1.25) ai.seq = null;
        else if (ai.seqT > 0.75 && !car.dodging) ai.seq = null; // flip finished: recover
        return;
      }
      if (ai.seq === 'aerial') { runAerial(car, ai, c, game, dt, k); if (ai.seq) return; }
      if (ai.seq === 'half') { runHalf(car, ai, c, game); if (ai.seq) return; }
      if (ai.seq === 'wall') { c.jump = ai.seqT < 0.08; c.throttle = 1; if (ai.seqT > 0.15) ai.seq = null; return; }
    }
    c.jump = false;

    // ---- Rumble spikes: carry the ball to their net and flip it in ----
    if (ball.stuckTo === car) {
      const r = drive(car, c, 0, oppZ + dir * 3, 23, true);
      c.boost = car.boost > 0 && Math.abs(r.ang) < 0.5;
      if (car.onGround && Math.abs(oppZ - car.pos.z) < 12 && Math.abs(car.pos.x) < A.goalHW + 3 && Math.abs(r.ang) < 0.3) startJump(car, ai, c, { hold: 0.05, dodgeAt: 0.12, dp: 1, ds: 0 });
      return;
    }

    // ---- in the air without a plan: land on the wheels, nose where we're going ----
    if (!car.onGround) {
      if (car.onRoof) { c.jumpSeq++; return; }
      if (car.dodging) { c.throttle = 1; return; }
      _a.set(car.vel.x, 0, car.vel.z);
      if (_a.lengthSq() < 1) _a.set(car.fwd.x, 0, car.fwd.z);
      if (_a.lengthSq() < 0.01) _a.set(0, 0, dir);
      // landing on a wall: wheels toward it
      let upH = UP;
      if (car.pos.y > 2 && Phys.wall2d(car.pos.x, car.pos.z) > -4 && car.vel.y > -2) {
        const e = 0.05;
        _b.set(-(Phys.wall2d(car.pos.x + e, car.pos.z) - Phys.wall2d(car.pos.x - e, car.pos.z)), 0, -(Phys.wall2d(car.pos.x, car.pos.z + e) - Phys.wall2d(car.pos.x, car.pos.z - e))).normalize();
        upH = _b;
        _a.set(car.vel.x, car.vel.y, car.vel.z).addScaledVector(_b, -car.vel.dot(_b));
        if (_a.lengthSq() < 0.5) _a.set(0, 1, 0).addScaledVector(_b, -_b.y);
      }
      airAim(car, c, _a, upH);
      c.throttle = 1;
      return;
    }

    if (game.env.heatseeker && ball.heat && !ball.hidden) { heatseeker(car, c, ai, game, dt, dir, k); return; }

    // stuck on a wall with nothing to do there: drop off it
    if (car.groundN.y < 0.55) {
      ai.wallT += dt;
      if (ai.wallT > U.lerp(1.2, 0.6, k.sk) && !(ai.act === 'hit' && ai.hit && ai.hit.y > 3)) { ai.wallT = 0; ai.seq = 'wall'; ai.seqT = 0; c.jumpSeq++; c.jump = true; return; }
    } else ai.wallT = 0;

    // ---- kickoff ----
    if (game.kickoffPending) { kickoff(car, c, ai, game, k, dir); return; }
    ai.kick = null;

    // ---- re-plan now and then (quicker at higher skill) ----
    ai.planT -= dt;
    if (ai.planT <= 0 || !ai.act) {
      ai.planT = k.plan * (0.85 + Math.random() * 0.3);
      plan(car, game, ai, k, dir);
    }
    act(car, c, ai, game, k, dir, dt);
  };

  function plan(car, game, ai, k, dir) {
    const A = Phys.arena, ownZ = -dir * A.hl, ball = game.ball;
    const roles = teamRoles(car, game, k);
    const T = hitTimes(game);
    let oppT = 99;
    for (const o of game.cars) if (o.team !== car.team) oppT = Math.min(oppT, T.get(o));
    const myT = T.get(car);
    ai.role = roles.rank === 0 ? 'attack' : roles.rank === 1 && roles.n > 2 ? 'support' : roles.rank === 1 ? 'support2' : 'back';
    // a new shot gets a new aim error (kept for that whole attack)
    if (ai.role !== 'attack' || !ai.hit || Math.random() < 0.15) ai.aimN = U.clamp((Math.random() + Math.random() + Math.random() - 1.5) * 1.15, -1.6, 1.6);
    ai.noise.set(U.rand(-1, 1), 0, U.rand(-1, 1)).multiplyScalar(k.posErr);

    // danger: the ball is heading into our net
    const gc = goalCross(game, car.team);
    const danger = gc && gc.t < 3.6;
    if (danger && ai.role !== 'attack') {
      // the closest one back saves; anyone else heads for the net too, at a lower priority
      const mates = game.cars.filter((o) => o.team === car.team && !o.demolished && o !== car);
      const myG = Math.hypot(car.pos.x - gc.x, car.pos.z - ownZ);
      if (mates.every((o) => Math.hypot(o.pos.x - gc.x, o.pos.z - ownZ) > myG - 2 || (o.ai && o.ai.role === 'attack' && T.get(o) < gc.t - 0.2))) ai.role = 'save';
    }

    // stick with a hit already under way while it still works (no switching plans every tenth of a second)
    const keep = ai.act === 'hit' && ai.hit && (ai.role === 'attack' || ai.role === 'save') && hitStillGood(car, game, ai);
    if (ai.role === 'attack' || ai.role === 'save') {
      const mode = danger || ((ball.pos.z - ownZ) * dir < A.hl * 0.55 && !goalSide(car, game, ball.pos.x, ball.pos.z)) ? 'clear' : 'shoot';
      ai.turnScale = 1;
      let h = findHit(car, game, mode, k, _hit);
      // a race for the ball: lining up the perfect angle loses it, so take the quickest touch that still goes the
      // right way (good players challenge first, aim second)
      if (oppT < (h.ok ? h.t : 9) + 0.3 && oppT < 3) {
        ai.turnScale = 0.25;
        const h2 = findHit(car, game, mode, k, _hit2);
        if (h2.ok && (!h.ok || h2.t < h.t - 0.12)) h = h2;
        ai.turnScale = 1;
      }
      const last = ai.role === 'attack' && (roles.rank === roles.n - 1 || roles.n === 1);
      // a hit in time (before it goes in, when it's going in), not worse than the one we're on
      // (near our own net with it about to go in, only a clearly easy ground hit beats standing in the way)
      const inNet = danger && gc.t < 2.2 && Math.hypot(car.pos.x, car.pos.z - ownZ) < 22;
      const inTime = (t, spare, kind) => !danger || (inNet ? kind === 'ground' && spare > 0.35 && t < gc.t - 0.2 : t < gc.t - 0.08 - (ai.act === 'block' ? 0.15 : 0));
      // the same hit, re-timed: follow the ball's path as it firms up (meeting a rolling ball a little early or
      // late changes the angle the hit comes off at)
      if (keep && h.ok && h.kind === ai.hit.kind && h.kind !== 'air' && Math.abs(h.t - (ai.tHit - game.time)) < 0.6 && inTime(h.t, h.spare, h.kind)) {
        // (the shot line we're lining up on stays, unless the ball's path changed enough to need a new one)
        if (h.sx * ai.s.x + h.sz * ai.s.z < 0.88) ai.s.set(h.sx, 0, h.sz);
        ai.hit = Object.assign(ai.hit, h); ai.tHit = game.time + h.t;
        ai.contested = oppT < h.t + 0.25 || !!danger;
        return;
      }
      if (keep && !(inNet && ai.hit.kind !== 'ground') && (!h.ok || h.t > ai.tHit - game.time - 0.35)) { ai.contested = oppT < ai.tHit - game.time + 0.25 || danger; return; }
      // beaten to it with nobody behind us: shadow back goal-side instead of diving in
      if (k.shadow && last && h.ok && oppT + 0.35 < h.t && !danger && (ball.pos.z - ownZ) * dir < A.hl * 1.3) { ai.act = 'shadow'; return; }
      if (k.shadow && last && !h.ok && oppT < 2 && !danger) { ai.act = 'shadow'; return; }
      if (h.ok && inTime(h.t, h.spare, h.kind)) {
        ai.act = 'hit';
        ai.hit = Object.assign(ai.hit || {}, h);
        ai.tHit = game.time + h.t; ai.s.set(h.sx, 0, h.sz);
        ai.contested = oppT < h.t + 0.25 || !!danger;
        return;
      }
      if (danger) { ai.act = 'block'; ai.gc = gc; return; }
      ai.act = 'chase';
      return;
    }
    ai.act = 'position';
  }
  // is the hit we're going for still on? (the ball is still going where we planned and we can still get there)
  function hitStillGood(car, game, ai) {
    const T = ai.tHit - game.time, h = ai.hit;
    if (T < 0.05) return false;
    const b = ballAt(game, T, _b3);
    if (Math.hypot(b.x - h.x, b.z - h.z) > 2.2 || Math.abs(b.y - h.y) > 1.4) return false;
    if (h.kind === 'air') return true;
    const off = hitOff(game, car, h.kind);
    return reachSpare(car, b.x - ai.s.x * off, b.z - ai.s.z * off, T + 0.15, ai.s.x, ai.s.z, true) >= 0;
  }
  const _b3 = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 };

  function act(car, c, ai, game, k, dir, dt) {
    const A = Phys.arena, ownZ = -dir * A.hl, oppZ = dir * A.hl, ball = game.ball;
    const sp = car.vel.dot(car.fwd);
    if (ai.act === 'hit') { if (strike(car, c, ai, game, k, dir, dt)) return; ai.act = 'chase'; }
    if (ai.act === 'chase') {
      // no clean hit found: get goal-side of the ball's path and toward it
      const b = ballAt(game, 1.2, _bs);
      let tx = b.x, tz = b.z - dir * 6;
      if (!goalSide(car, game, b.x, b.z)) { tx = U.clamp(b.x * 0.5, -A.hw + 6, A.hw - 6); tz = b.z - dir * 14; }
      goTo(car, c, ai, game, k, tx, tz, k.maxSp, true);
      return;
    }
    if (ai.act === 'shadow') {
      // between the ball and our goal, backing off as it comes, ready to pounce when they lose it
      const b = ballAt(game, 0.4, _bs);
      _a.set(-b.x * 0.7, 0, ownZ - b.z);
      const L = _a.length() || 1, back = U.clamp(L * 0.42, 6, 22);
      const tx = b.x + (_a.x / L) * back, tz = b.z + (_a.z / L) * back;
      const d = Math.hypot(tx - car.pos.x, tz - car.pos.z);
      if (d < 3.5 && Math.hypot(ball.vel.x, ball.vel.z) < 14) { face(car, c, ball.pos.x, ball.pos.z); return; }
      goTo(car, c, ai, game, k, tx, tz, U.clamp(d * 1.1 + Math.hypot(ball.vel.x, ball.vel.z) * 0.6, 6, k.maxSp), d > 18);
      return;
    }
    if (ai.act === 'block') {
      // on the goal line where it will cross; jump (or fly) at it when it arrives
      const gc = goalCross(game, car.team) || ai.gc || { t: 2, x: 0, y: 1 };
      const gx = U.clamp(gc.x, -A.goalHW + 1, A.goalHW - 1), gz = ownZ + dir * 1.0;
      // where the ball is as it reaches us
      const tA = Math.max(0, gc.t - 0.12);
      const b = ballAt(game, tA, _b2);
      // coming back from up the field: in by the far post, not through the ball's path
      const upfield = (car.pos.z - ball.pos.z) * dir > -2 && Math.abs(car.pos.z - ownZ) > 14;
      if (upfield) {
        const px = -Math.sign(ball.pos.x || 1) * A.goalHW * 0.8;
        goTo(car, c, ai, game, k, px, ownZ + dir * 3, 23, true);
        return;
      }
      _a.set(gx - car.pos.x, 0, gz - car.pos.z);
      const d = _a.length(), lz = _a.dot(car.fwd), lx = _a.dot(car.left);
      const sp = car.vel.dot(car.fwd);
      if (d > 1.3) {
        if (car.fwd.z * dir > 0.3 && lz < 0 && d < 22) {
          // facing out with the spot behind us: back onto it, steering the tail to it (stay facing the ball)
          const ang = Math.atan2(-lx, lz);
          c.throttle = sp < -Math.min(12, d * 2.4) ? 0.6 : -1;
          c.steer = Math.sign(ang) * U.clamp((Math.PI - Math.abs(ang)) * 2.5, 0, 1);
        } else drive(car, c, gx, gz, U.clamp(d * 2.2, 5, 23), k.boost && d > 12);
      } else face(car, c, ball.pos.x, ball.pos.z);
      // the save: fly at a high one, jump at one in reach, flip into a low one
      if (!car.onGround || ai.seq) return;
      const hb = b.y - car.restH, lat = Math.hypot(b.x - car.pos.x, b.z - car.pos.z) - Math.abs(b.z - car.pos.z) * 0.5;
      if (gc.t > 1.6 || lat > 4.5) return;
      const J = jumpTable(game.env.gravity);
      if (hb > J.max2 - 0.2 || (hb > J.max1 - 0.1 && !k.dbl)) {
        // above a double jump: fly
        _t.set(0, 0, dir);
        if (k.aerial && car.boost > 15 && aerialOK(car, game, b, tA, k, _t)) startAerial(car, ai, c, game, tA, _t);
        return;
      }
      if (hb > 0.9 && k.jump) {
        const dbl = hb > J.max1 - 0.1;
        const rt = riseTime(game.env.gravity, Math.min(hb - 0.35, dbl ? J.max2 - 0.1 : J.max1 - 0.05), dbl);
        // where our momentum carries us by then (the jump keeps it): only go if that's where the ball will be
        const miss = Math.hypot(car.pos.x + car.vel.x * tA - b.x, car.pos.z + car.vel.z * tA - b.z);
        if (rt > 0 && tA <= rt + k.timingErr && (miss < 1.8 || tA < rt - 0.1)) startJump(car, ai, c, { hold: 0.2, dbl: dbl ? 0.2 : null, aim: true, dodgeNear: k.sk > 0.4 ? 2.3 : null, max: 1.8 });
      } else if (hb <= 0.9 && tA < 0.3 && k.dodge && lat > 1.2) startJump(car, ai, c, { hold: 0.05, dodgeNear: 3.2, max: 1.2 });
      return;
    }
    // ---- position: support / last back, grabbing boost on the way ----
    const role = ai.role === 'back' ? 'back' : 'support';
    supportSpot(car, game, role, _t);
    let tx = _t.x, tz = _t.z;
    // coming back from in front of the ball: round the far side (back post), not through the play
    const ahead = (car.pos.z - ball.pos.z) * dir > -1;
    if (ahead && Math.abs(car.pos.z - tz) > 8) { tx = -Math.sign(ball.pos.x || 1) * Math.max(Math.abs(tx), A.goalHW + 4); }
    // low on boost: a big pad on our side of the play if it's not far out of the way
    if (k.boost && car.boost < 40) {
      const pad = nearestBigPad(car, game, car.boost < 15 ? 45 : 30, dir, tz + dir * 10);
      if (pad) { goTo(car, c, ai, game, k, pad.x, pad.z, k.maxSp, false); return; }
    }
    const d = Math.hypot(tx - car.pos.x, tz - car.pos.z);
    if (d < 3.5) { face(car, c, ball.pos.x, ball.pos.z); return; }
    goTo(car, c, ai, game, k, tx, tz, U.clamp(d * 0.9, 5, k.maxSp), d > 25 && ai.role !== 'back');
  }
  const _b2 = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0 };

  // drive somewhere, picking up small pads on the way, half-flipping round or front-flipping for speed when it pays
  function goTo(car, c, ai, game, k, tx, tz, speed, boostOK) {
    const A = Phys.arena;
    tx = U.clamp(tx, -A.hw + 1.5, A.hw - 1.5);
    if (Math.abs(tx) > A.goalHW - 0.5) tz = U.clamp(tz, -A.hl + 1.5, A.hl - 1.5);
    const pad = k.boost ? padOnTheWay(car, game, tx, tz) : null;
    if (pad) { tx = pad.x; tz = pad.z; }
    const r = drive(car, c, tx, tz, speed, boostOK && k.boost);
    if (!car.onGround || car.groundN.y < 0.9) return r;
    // half flip: stopped (or rolling back) facing away from somewhere far
    if (k.half && Math.abs(r.ang) > 2.6 && r.dist > 16 && r.sp < 3 && r.sp > -8) { ai.seq = 'half'; ai.seqT = 0; ai.hfFlip = false; ai.hfX = tx; ai.hfZ = tz; c.jumpSeq++; c.jump = true; return r; }
    // front flip for speed: long straight drive, no boost to spare
    if (k.flipSpeed && Math.abs(r.ang) < 0.08 && r.dist > 30 && r.sp > 11 && r.sp < 19.5 && (car.boost < 8 || !c.boost) && speed > r.sp + 3 && game.ball.pos.distanceTo(car.pos) > 15) {
      startJump(car, ai, c, { hold: 0.05, dodgeAt: 0.1, dp: 1, ds: 0, max: 1.4 });
    }
    return r;
  }

  // the planned hit: line up behind the ball along the shot direction and meet it on time
  function strike(car, c, ai, game, k, dir, dt) {
    const h = ai.hit, A = Phys.arena;
    let T = ai.tHit - game.time;
    if (T < -0.3) return false;
    const b = ballAt(game, Math.max(0, T), _bs);
    // the plan went stale (the ball was hit or bounced somewhere else)
    if (Math.hypot(b.x - h.x, b.z - h.z) > 4 + T * 2 || Math.abs(b.y - h.y) > 2.5) { ai.planT = 0; }
    const s = ai.s, g = game.env.gravity;
    let kind = h.kind;
    // a ground or jump shot follows the ball's height as the prediction firms up (a bounce can lift it)
    if (kind !== 'air') { const J0 = jumpTable(g); kind = b.y < groundH(game) || (!k.jump && b.y < 1.75) ? 'ground' : b.y < J0.max1 + car.restH + 0.3 ? 'jump' : 'dbl'; }
    if (kind === 'air') {
      // launch now if it still works, else wait for it a little closer (the plan comes again)
      if (car.onGround && T > 0.4 && aerialOK(car, game, b, T, k, s)) {
        // the nose has to be roughly toward it first
        _a.set(b.x - car.pos.x, 0, b.z - car.pos.z);
        const ang = Math.acos(U.clamp((_a.x * car.fwd.x + _a.z * car.fwd.z) / ((_a.length() || 1) * (Math.hypot(car.fwd.x, car.fwd.z) || 1)), -1, 1));
        if (ang < 0.5 || _a.length() < 6) { startAerial(car, ai, c, game, T, s); return true; }
      }
      const r = drive(car, c, b.x - s.x * 4, b.z - s.z * 4, k.maxSp, false);
      return r && T > 0;
    }
    const off = hitOff(game, car, kind);
    const cx = b.x - s.x * off + ai.noise.x * 0.12, cz = b.z - s.z * off + ai.noise.z * 0.12;
    const dx = cx - car.pos.x, dz = cz - car.pos.z, dist = Math.hypot(dx, dz);
    // aim at a point back along the shot line (closer as we come in), so we curve in behind the ball
    const along = -(dx * s.x + dz * s.z); // >0: we're behind the contact point
    const lead = ai.contested ? 0 : U.clamp(dist * 0.42, 0, 9) * (along > -1 ? 1 : 1.4);
    let tx = cx - s.x * lead, tz = cz - s.z * lead;
    if (dist < 3) { tx = b.x; tz = b.z; } // in close: straight through the ball
    // speed: arrive on time (but never dawdle into a contested ball)
    const tt = Math.max(0.05, T);
    // (a jump shot has to arrive right on time: early and the roof meets the bottom of the ball before we've risen)
    let want = ai.contested || T < 0.4 ? 23 : kind === 'ground' ? U.clamp((dist / tt) * 1.08 + 1.5, 4, 23) : U.clamp(dist / tt, 3, 23);
    if (kind !== 'ground' && T < 0.6 && !ai.contested) want = U.clamp(dist / tt, 3, 23);
    // lined up and close: come in with some pace (a crawl into the ball is a weak tap)
    if (dist < 7 && along > 0 && kind === 'ground') want = Math.max(want, 15);
    want = Math.min(want, k.maxSp + (ai.contested ? 3 : 0));
    const r = drive(car, c, tx, tz, want, k.boost && (want > car.vel.dot(car.fwd) + 1.5));
    if (!car.onGround || ai.seq) return true;
    const sp = r.sp;
    // ---- the hit ----
    const hDist = Math.hypot(b.x - car.pos.x, b.z - car.pos.z);
    _a.set(b.x - car.pos.x, 0, b.z - car.pos.z);
    const ballAng = Math.abs(Math.atan2(-_a.dot(car.left), _a.dot(car.fwd)));
    if (kind === 'ground') {
      // flip into it for a power shot (or a 50/50) - but only when the flip will meet it on the shot line: a flip
      // can't steer, so against a rolling ball it has to be timed to where the ball will be when we get there
      const reach = 1.35 + sp * 0.2 + 0.6;
      if (k.dodge && hDist < reach && ballAng < 0.5 && sp > 7 && Math.random() < U.lerp(0.4, 1, k.sk) * dt * 60) {
        const fl = Math.hypot(car.fwd.x, car.fwd.z) || 1, fx = car.fwd.x / fl, fz = car.fwd.z / fl, v = sp + 3.5;
        let go = false;
        for (let tc = 0.1; tc <= 0.34; tc += 1 / 60) {
          const bb = ballAt(game, tc, _b3), px = car.pos.x + fx * v * tc, pz = car.pos.z + fz * v * tc;
          const ex = bb.x - px, ez = bb.z - pz, el = Math.hypot(ex, ez);
          if (el > 1.55) continue;
          // contact at tc: how far off the shot line is the hit? (a looser line for a 50/50, where any touch counts)
          const err = Math.acos(U.clamp((ex * s.x + ez * s.z) / (el || 1), -1, 1));
          go = bb.y < 1.55 && err < (ai.contested ? 0.45 : U.lerp(0.3, 0.12, k.sk));
          break;
        }
        if (go) startJump(car, ai, c, { hold: 0.04, dodgeAt: 0.08 + U.rand(-1, 1) * k.timingErr * 0.5, dp: 1, ds: 0, max: 1.3 });
      }
      return true;
    }
    // jump shots: leave the ground so we meet it at the top of the rise
    const dbl = kind === 'dbl', J = jumpTable(g);
    // the car's middle at about the ball's middle (a front-on hit sends it forward, not up)
    const rise = U.clamp(b.y - 0.15 - car.restH, 0.1, (dbl ? J.max2 : J.max1) - 0.05);
    const rt = riseTime(g, rise, dbl);
    if (rt > 0 && T <= rt + 0.02 + U.rand(-1, 1) * k.timingErr && ballAng < 0.45 && Math.abs(r.ang) < 0.5) {
      const hold = dbl ? 0.2 : U.clamp(0.06 + rise * 0.07, 0.06, 0.2);
      startJump(car, ai, c, { hold, dbl: dbl ? 0.2 : null, aim: true, dodgeNear: k.sk > 0.5 ? 2.25 : null, dir: s, max: 1.8 });
    }
    return true;
  }

  // ---- kickoffs: one goes (the closest; the left one on a tie, like people do), one cheats up, the rest grab boost ----
  function kickoff(car, c, ai, game, k, dir) {
    const A = Phys.arena;
    if (!ai.kick) {
      const mates = game.cars.filter((o) => o.team === car.team && !o.demolished);
      const d = (o) => Math.hypot(o.pos.x, o.pos.z) + (o.pos.x * dir > 0.5 ? 0 : 0.3); // left side first on a tie
      const order = mates.slice().sort((a, b) => d(a) - d(b) || a.id - b.id);
      ai.kick = { role: order.indexOf(car) === 0 ? 'go' : order.indexOf(car) === 1 ? 'cheat' : 'boost', flipped: false, speedFlip: false };
    }
    const K = ai.kick, sp = car.vel.dot(car.fwd);
    if (K.role === 'go') {
      const d = Math.hypot(car.pos.x, car.pos.z);
      // come in slightly off centre so the hit sends it toward their side of the field
      const offX = (car.pos.x > 0 ? 1 : car.pos.x < 0 ? -1 : 0) * 0.35;
      const r = drive(car, c, offX, -dir * 0.8, 23, k.boost);
      c.boost = k.boost && car.boost > 0;
      // flip into the ball at the last moment
      if (k.kickFlip && d < 3.2 + sp * 0.2 && Math.abs(r.ang) < 0.25) startJump(car, ai, c, { hold: 0.04, dodgeAt: 0.07, dp: 1, ds: 0, max: 1.2 });
      else if (!k.kickFlip && d < 2.5 && Math.random() < 0.02) startJump(car, ai, c, { hold: 0.1, max: 1 });
      return;
    }
    if (K.role === 'cheat') {
      // up behind the kickoff, ready for the 50/50's leftovers
      const tz = -dir * 16, tx = car.pos.x * 0.3;
      const dd = Math.hypot(tx - car.pos.x, tz - car.pos.z);
      if (dd < 3) face(car, c, 0, 0); else drive(car, c, tx, tz, U.clamp(dd, 6, 16), false);
      return;
    }
    // the corner boost on our side
    const pad = nearestBigPad(car, game, 60, dir, -dir * 10);
    if (pad && car.boost < 90) drive(car, c, pad.x, pad.z, 20, false);
    else { const tz = -dir * (A.hl - 6); const dd = Math.abs(tz - car.pos.z) + Math.abs(car.pos.x); if (dd < 3) face(car, c, 0, 0); else drive(car, c, 0, tz, 12, false); }
  }

  // ---- Heatseeker: any touch sends the ball at the other net, so nobody circles round for an angle ----
  // the team it's flying at sends its first man straight at it (jumping / aerialing to meet it) and the rest stand
  // in the goal mouth where it will arrive; the team that shot follows it for the rebound off their backboard
  function hsIntercept(car, game, k) {
    const pred = game.prediction, age = predAge(game);
    const reach = k.sk > 0.6 ? 6.5 : k.sk > 0.35 ? 3.6 : 2.6;
    for (let i = 0; i < pred.length; i += 2) {
      const p = pred[i], t = p.t - age;
      if (p.y > reach || t < 0.03) continue;
      if (reachSpare(car, p.x, p.z, t - (p.y > 1.8 ? 0.3 : 0), undefined, undefined, true) >= 0) return { x: p.x, y: p.y, z: p.z, t };
    }
    return null;
  }
  function heatseeker(car, c, ai, game, dt, dir, k) {
    const ball = game.ball, A = Phys.arena, pred = game.prediction, heat = ball.heat;
    const ownZ = -dir * A.hl;
    const incoming = !heat.wait && heat.team !== car.team;
    const maxWant = k.maxSp;
    ai.planT -= dt;
    if (ai.planT <= 0 || ai.hsRank == null) {
      ai.planT = k.plan;
      const t = (o) => { if (o.demolished) return 99; const p = hsIntercept(o, game, o.isBot ? caps(o) : k); return p ? p.t : 50 + o.pos.distanceTo(ball.pos); };
      const mine = t(car);
      ai.hsRank = game.cars.filter((o) => o !== car && o.team === car.team && !o.demolished && (t(o) < mine - 0.05 || (Math.abs(t(o) - mine) <= 0.05 && o.id < car.id))).length;
      ai.noise.set(U.rand(-1, 1), 0, U.rand(-1, 1)).multiplyScalar(k.posErr * 0.8);
    }
    const sp = car.vel.dot(car.fwd);
    if ((heat.wait || incoming) && ai.hsRank === 0) {
      // go and touch it
      const p = hsIntercept(car, game, k) || { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z, t: 2 };
      const r = drive(car, c, p.x + ai.noise.x * 0.3, p.z - dir * 0.6 + ai.noise.z * 0.3, maxWant, true);
      const bh = p.y - car.pos.y, d = Math.hypot(p.x - car.pos.x, p.z - car.pos.z);
      if (Math.abs(r.ang) < 0.4) {
        // leave the ground as early as the jump needs to rise to it
        const tt = Math.min(p.t, d / Math.max(4, sp + Math.max(0, -ball.vel.dot(car.fwd))));
        if (bh > 0.9 && bh <= 2.4 && tt < 0.2 + (bh - 0.9) * 0.2) startJump(car, ai, c, { hold: U.clamp((bh - 0.8) * 0.13, 0.05, 0.22), aim: true, max: 1.4 });
        else if (bh <= 0.9 && d < 2.6 + sp * 0.1 && k.dodge && sp > 5) startJump(car, ai, c, { hold: 0.05, dodgeAt: 0.1, dp: 1, ds: 0, max: 1.3 });
        else if (k.aerial && bh > 2.4 && bh < 12 && tt > 0.5 && tt < 2.2 && Math.abs(r.ang) < 0.25 && car.boost > 10) { _t.set(0, 0, dir); startAerial(car, ai, c, game, p.t, _t); }
      }
      return;
    }
    if (!incoming && !heat.wait && ai.hsRank === 0) {
      // our shot: trail it toward their net, ready for the rebound
      const tx = U.clamp(ball.pos.x * 0.6, -A.hw + 8, A.hw - 8), tz = U.clamp(ball.pos.z - dir * 9, -A.hl + 12, A.hl - 12);
      const d = Math.hypot(tx - car.pos.x, tz - car.pos.z);
      if (d < 3) face(car, c, ball.pos.x, ball.pos.z); else drive(car, c, tx, tz, U.clamp(d, 6, maxWant), d > 15);
      return;
    }
    // guard: stand where it will cross our goal line and jump to block it
    let gx = 0;
    for (const p of pred) if ((p.z - ownZ) * dir < 5) { gx = p.x; break; }
    gx = U.clamp(gx, -A.goalHW + 1.2, A.goalHW - 1.2);
    const gz = ownZ + dir * 4, d = Math.hypot(gx - car.pos.x, gz - car.pos.z);
    if (d > 2.2) drive(car, c, gx, gz, U.clamp(d * 1.3, 5, maxWant), d > 12);
    else face(car, c, ball.pos.x, ball.pos.z);
    if (!incoming || !car.onGround || ai.seq) return;
    // when will it get here, and how high will it be?
    _a.set(car.pos.x - ball.pos.x, 0, car.pos.z - ball.pos.z);
    const dH = _a.length(), vIn = ball.vel.x * (_a.x / (dH || 1)) + ball.vel.z * (_a.z / (dH || 1));
    if (vIn < 4) return;
    const tArr = dH / vIn;
    const hy = ballAt(game, tArr, _bs).y;
    const bh = hy - car.pos.y;
    const lead = U.lerp(0.42, 0.3, k.sk);
    if (bh > 3.0 && k.aerial && tArr < 0.9 && tArr > 0.45 && car.boost > 10) { _t.set(0, 0, dir); startAerial(car, ai, c, game, tArr, _t); }
    else if (bh > 0.9 && bh <= 3.0 && tArr < lead * 0.6 + (bh - 0.9) * 0.2) startJump(car, ai, c, { hold: U.clamp((bh - 0.8) * 0.13, 0.05, 0.22), aim: true, max: 1.4 });
  }

  // ---- goal celebrations (the scoring team) ----
  const CELEBRATIONS = ['flips', 'spin', 'donut', 'boostjump', 'double'];
  function celebrate(car, c, ai, game, dt) {
    const g = game.lastGoal, scored = g.team === car.team;
    if (ai.celGoal !== g) { ai.celGoal = g; ai.celT = 0; ai.celNext = 0.3 + Math.random() * 0.5; ai.cel = scored ? U.choice(CELEBRATIONS) : 'mope'; ai.seq = null; ai.celPhase = 0; ai.act = null; ai.hit = null; }
    ai.celT += dt;
    c.boost = false; c.handbrake = false; c.roll = 0; c.pitch = 0; c.steer = 0; c.jump = false; c.airRollFree = false; c.throttle = 0;
    const t = ai.celT;
    const hop = () => { if (car.onGround && t > ai.celNext) { ai.celNext = t + 1.0 + Math.random() * 0.5; ai.celUp = t; c.jumpSeq++; } };
    const up = ai.celUp != null ? t - ai.celUp : 9;
    switch (ai.cel) {
      case 'flips': // hop and backflip, again and again
        c.throttle = 0.3; hop(); c.jump = up < 0.15;
        if (up > 0.2 && up < 0.24 && !car.onGround && ai.celPhase !== ai.celUp) { ai.celPhase = ai.celUp; c.jumpSeq++; c.pitch = -1; }
        break;
      case 'spin': // jump and air roll
        hop(); c.jump = up < 0.2; if (!car.onGround) c.roll = 1;
        break;
      case 'donut': // powerslide circles
        c.throttle = 1; c.steer = 1; c.handbrake = t > 0.3; c.boost = t > 0.6 && t < 1.6;
        break;
      case 'boostjump': // jump, nose up and boost
        hop(); c.jump = up < 0.2; if (!car.onGround && up < 1.0) { c.pitch = -0.6; c.boost = up > 0.15; }
        break;
      case 'double': // double jumps
        hop(); c.jump = up < 0.2;
        if (up > 0.26 && up < 0.3 && !car.onGround && ai.celPhase !== ai.celUp) { ai.celPhase = ai.celUp; c.jumpSeq++; }
        break;
      default: // the team that conceded rolls to a stop
        c.throttle = t < 0.6 ? 0.3 : 0;
    }
  }

  // Rumble: use the item when it does something (not the moment it arrives); anything held 9 s gets used
  AI.wantItem = function (car, game, dt) {
    const ball = game.ball, it = car.item, A = Phys.arena, dir = car.team === 0 ? 1 : -1;
    car.itemHeld = (car.itemHeld || 0) + dt;
    if (car.itemHeld > 9) return true;
    if (Math.random() > dt * 4 || ball.hidden) return false;
    const dB = car.pos.distanceTo(ball.pos), ahead = (ball.pos.z - car.pos.z) * dir > 0;
    const opp = game.cars.filter((o) => o.team !== car.team && !o.demolished);
    const oppNear = (d) => opp.some((o) => o.pos.distanceTo(ball.pos) < d);
    const danger = Phys.predictedGoal(game.prediction, 2) === car.team;
    switch (it) {
      case 'spikes': return dB < 5;
      case 'magnet': return dB > 4 && dB < 22 && ahead;
      case 'freeze': return danger || (oppNear(4) && (ball.pos.z * dir) < 0);
      case 'punch': return dB < 9 && ahead && Math.abs(ball.pos.z - dir * A.hl) < A.hl * 1.4;
      case 'plunger': return dB > 10 && dB < 30 && !ahead;
      case 'boot': return oppNear(8);
      case 'power': return dB < 12 && ahead;
      case 'grapple': return dB > 14 && dB < 40;
      case 'tornado': return dB < 14 && oppNear(10);
      case 'disrupt': return oppNear(10);
      default: return dB < 15;
    }
  };

  AI.chatter = function (car, event) {
    const lines = {
      goalFor: ['Nice shot!', 'Great pass!', 'What a play!', 'Calculated.'],
      goalAgainst: ['Noooo!', 'OMG!', 'Close one!', 'Whoops...', '$#@%!'],
      save: ['What a save!', 'Wow!', 'Thanks!'],
      demo: ['Sorry!', 'No problem.', 'Savage!'],
      win: ['gg', 'Well played.', 'That was fun!'],
      lose: ['gg', 'Well played.', 'Rematch?'],
      gg: ['gg', 'gg wp', 'GG!', 'Well played.', 'gg go next'],
    }[event];
    if (!lines) return null;
    return U.choice(lines);
  };
})(window.BL);
