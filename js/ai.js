'use strict';
// Rocket League (fan remake) - bot AI (rookie -> all-star by skill 0..1)
(function (BL) {
  const U = BL.util;
  const V3 = THREE.Vector3;
  const AI = BL.AI = {};
  const Phys = BL.Physics;

  const _t = new V3(), _a = new V3(), _b = new V3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

  function brain(car) {
    if (!car.ai) car.ai = { target: new V3(), think: 0, seq: null, seqT: 0, wallT: 0, mode: 'attack', aim: new V3(), noise: new V3(), aerial: false, aerialT: 0, stuck: 0 };
    return car.ai;
  }

  // time estimate for a car to drive to a ground point
  function eta(car, x, z) {
    const dx = x - car.pos.x, dz = z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const fx = car.fwd.x, fz = car.fwd.z;
    const fl = Math.hypot(fx, fz) || 1;
    const ang = Math.acos(U.clamp((dx * fx + dz * fz) / ((dist || 1) * fl), -1, 1));
    const sp = Math.max(0, car.vel.dot(car.fwd));
    const vmax = car.boost > 15 ? 21 : 14;
    return ang * 0.45 + dist / Math.max(6, (sp + vmax) * 0.5);
  }

  // steer the car toward a world point on its driving plane
  function driveTo(car, c, tx, ty, tz, wantSpeed, allowBoost) {
    _a.set(tx - car.pos.x, ty - car.pos.y, tz - car.pos.z);
    const lx = _a.dot(car.left), lz = _a.dot(car.fwd);
    const ang = Math.atan2(-lx, lz); // + = target to the right
    const dist = Math.hypot(lx, lz);
    const sp = car.vel.dot(car.fwd);
    c.steer = U.clamp(ang * 3.2, -1, 1);
    if (Math.abs(ang) > 2.4 && dist < 6 && sp < 4) {
      // tight reverse turn
      c.throttle = -1; c.steer = -c.steer;
    } else {
      c.throttle = sp < wantSpeed ? 1 : (sp > wantSpeed + 4 ? -0.5 : 0.1);
    }
    c.handbrake = Math.abs(ang) > 1.25 && sp > 7 && car.onGround;
    c.boost = allowBoost && car.onGround && Math.abs(ang) < 0.3 && sp < wantSpeed + 1 && sp < 22.6 && dist > 6;
    return { ang, dist };
  }

  // orient in the air: point nose to dir (world), keep roof up-ish
  function airAim(car, c, dir, upHint) {
    _a.copy(dir).normalize();
    U.basisQuat(_a, upHint || _b.set(0, 1, 0), _q);
    // error rotation (world) = target * inverse(current)
    const qe = _q.clone().multiply(car.quat.clone().invert());
    if (qe.w < 0) { qe.x = -qe.x; qe.y = -qe.y; qe.z = -qe.z; qe.w = -qe.w; }
    const s = Math.sqrt(1 - Math.min(1, qe.w * qe.w));
    const angle = 2 * Math.acos(Math.min(1, qe.w));
    const axis = s > 1e-4 ? _b.set(qe.x / s, qe.y / s, qe.z / s) : _b.set(0, 0, 0);
    // to local space
    const inv = car.quat.clone().invert();
    const errL = axis.multiplyScalar(angle).applyQuaternion(inv);
    const wL = car.angVel.clone().applyQuaternion(inv);
    c.pitch = U.clamp(errL.x * 3.2 - wL.x * 0.55, -1, 1);
    c.steer = -U.clamp(errL.y * 3.2 - wL.y * 0.55, -1, 1);
    c.roll = U.clamp(errL.z * 2.6 - wL.z * 0.35, -1, 1);
    c.airRollFree = false;
    return angle;
  }

  function nearestPad(car, game) {
    let best = null, bd = 1e9;
    const pads = game.padState;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p.big || !p.active) continue;
      const d = Math.hypot(p.x - car.pos.x, p.z - car.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { pad: best, dist: bd } : null;
  }

  AI.think = function (car, game, dt) {
    const c = car.controls;
    const ai = brain(car);
    const A = Phys.arena;
    const sk = car.skill;
    const ball = game.ball;
    c.roll = 0; c.airRollFree = false; c.pitch = 0;
    if (car.demolished) { c.throttle = 0; c.boost = false; c.jump = false; return; }

    const dir = car.team === 0 ? 1 : -1; // attack direction (z)
    const oppGoalZ = dir * A.hl, ownGoalZ = -dir * A.hl;
    // after a goal: the scoring team celebrates (it shows in the replay), the other team sulks
    if (game.phase === 'goal' && game.lastGoal) { celebrate(car, c, ai, game, dt); return; }
    ai.celGoal = null;

    // ---- active jump sequences (shots, dodges, aerials) ----
    if (ai.seq) {
      ai.seqT += dt;
      const s = ai.seq;
      if (s === 'jump') {
        c.jump = ai.seqT < ai.hold;
        if (ai.seqT > ai.hold + 0.05 && ai.dodge) { c.jumpSeq++; c.pitch = ai.dodgeY; c.steer = ai.dodgeX; ai.seq = 'flip'; ai.seqT = 0; }
        else if (ai.seqT > 1.4) ai.seq = null;
        if (ai.seq === 'jump') { c.throttle = 1; return; }
      }
      if (ai.seq === 'flip') {
        c.pitch = ai.dodgeY; c.steer = ai.dodgeX; c.jump = false; c.throttle = 1;
        if (ai.seqT > 0.6 || car.onGround) ai.seq = null;
        return;
      }
      if (ai.seq === 'aerial') {
        const pr = game.prediction;
        const tAim = Math.max(0.05, ai.aerialT - ai.seqT);
        let aimP = null;
        for (let i = 0; i < pr.length; i++) if (pr[i].t >= tAim) { aimP = pr[i]; break; }
        if (!aimP) aimP = { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z };
        // aim slightly behind the ball relative to the opponent goal
        _t.set(-aimP.x * 0.15, 0, oppGoalZ - aimP.z).normalize();
        const off = game.env.heatseeker ? 0.3 : 1.1;
        const tx = aimP.x - _t.x * off, ty = aimP.y, tz = aimP.z - _t.z * off;
        _a.set(tx - car.pos.x, ty - car.pos.y, tz - car.pos.z);
        // compensate gravity
        _a.y += 0.5 * game.env.gravity * tAim * tAim * 0.35;
        const err = airAim(car, c, _a);
        c.jump = ai.seqT < 0.22;
        if (ai.seqT > 0.25 && ai.seqT < 0.3 && !ai.dj) { c.jumpSeq++; ai.dj = true; c.pitch = 0; c.steer = 0; }
        c.boost = err < 0.6 && car.boost > 0;
        c.throttle = 1;
        const close = car.pos.distanceTo(ball.pos) < 2.6;
        if (close && car.hasFlip && sk > 0.8) { c.jumpSeq++; c.pitch = 1; c.steer = 0; ai.seq = 'flip'; ai.seqT = 0; ai.dodgeY = 1; ai.dodgeX = 0; return; }
        if (ai.seqT > ai.aerialT + 0.4 || (car.onGround && ai.seqT > 0.4) || ai.seqT > 3) ai.seq = null;
        return;
      }
    }
    c.jump = false;

    // ---- Rumble spikes: carry the ball to their net and flip it in ----
    if (ball.stuckTo === car) {
      const r = driveTo(car, c, 0, 0, oppGoalZ + dir * 3, 23, true);
      c.boost = car.boost > 0 && Math.abs(r.ang) < 0.5;
      if (car.onGround && Math.abs(oppGoalZ - car.pos.z) < 12 && Math.abs(car.pos.x) < A.goalHW + 3 && Math.abs(r.ang) < 0.3) startJump(ai, c, 0.05, true, 1, 0);
      return;
    }

    // ---- in the air without a plan: land on wheels ----
    if (!car.onGround) {
      _a.set(car.vel.x, 0, car.vel.z);
      if (_a.lengthSq() < 1) _a.set(car.fwd.x, 0, car.fwd.z);
      if (_a.lengthSq() < 0.01) _a.set(0, 0, dir);
      if (car.onRoof) { c.jumpSeq++; return; }
      airAim(car, c, _a);
      c.throttle = 1;
      c.boost = false;
      return;
    }

    if (game.env.heatseeker && ball.heat && !ball.hidden) { heatseeker(car, c, ai, game, dt, dir, sk); return; }

    // ---- decide plan (throttled by skill) ----
    ai.think -= dt;
    const pred = game.prediction;
    if (ai.think <= 0) {
      ai.think = U.lerp(0.28, 0.05, sk);
      ai.noise.set(U.rand(-1, 1), 0, U.rand(-1, 1)).multiplyScalar(U.lerp(3.5, 0.3, sk));
      // team roles: closest-to-ball (by eta) attacks
      const mates = game.cars.filter((o) => o.team === car.team && !o.demolished);
      const myEta = eta(car, ball.pos.x, ball.pos.z) + (((car.pos.z - ball.pos.z) * dir) > 2 ? 2 : 0);
      let rank = 0;
      for (const o of mates) {
        if (o === car) continue;
        const e = eta(o, ball.pos.x, ball.pos.z) + (((o.pos.z - ball.pos.z) * dir) > 2 ? 2 : 0);
        if (e < myEta - 0.05) rank++;
      }
      ai.mode = rank === 0 ? 'attack' : rank === 1 ? 'support' : 'goalie';
      if (game.kickoffPending) ai.mode = rank === 0 ? 'kickoff' : 'support';
      // ball heading into own net -> everyone panics
      const danger = Phys.predictedGoal(pred, 2.5) === car.team;
      if (danger && rank <= 1) ai.mode = 'save';
      // ball deep in our third: the second player steps up to challenge instead of waiting on its shadow spot
      if (rank === 1 && (ball.pos.z - ownGoalZ) * dir < A.hl * 0.6 && sk > 0.3) ai.mode = 'save';
      // someone on the other team is right on the ball: go straight at it (no circling round for the perfect angle)
      ai.contested = game.cars.some((o) => o.team !== car.team && !o.demolished && o.pos.distanceTo(ball.pos) < 6);
      // Heatseeker: the ball homes on a goal, so whoever can reach it first just touches it; the rest guard the net
      if (game.env.heatseeker && ball.heat) {
        const atUs = ball.heat.team !== car.team;
        ai.mode = rank === 0 ? 'attack' : atUs ? 'goalie' : 'support';
      }
      ai.boostOK = Math.random() < U.lerp(0.45, 1, sk);
      ai.flipOK = Math.random() < U.lerp(0.15, 0.95, sk);
    }

    const sp = car.vel.dot(car.fwd);
    const maxWant = U.lerp(15, 23, sk);
    const useBoost = ai.boostOK !== false || ai.mode === 'kickoff';

    // wall: come down if stuck on wall
    if (car.groundN.y < 0.6) {
      ai.wallT += dt;
      if (ai.wallT > U.lerp(1.4, 2.5, sk) && ball.pos.y < 4) { ai.wallT = 0; ai.seq = 'jump'; ai.seqT = 0; ai.hold = 0.05; ai.dodge = false; c.jumpSeq++; return; }
    } else ai.wallT = 0;

    if (ai.mode === 'kickoff') {
      const r = driveTo(car, c, ball.pos.x, 0, ball.pos.z, 23, sk > 0.15);
      c.boost = sk > 0.15 && car.boost > 0;
      if (r.dist < 4.2 + sp * 0.11 && sk > 0.25) { startJump(ai, c, 0.04, true, 1, 0); }
      return;
    }

    // choose intercept on predicted path
    let target = null;
    const reach = 2.4 + (sk > 0.55 ? 8 * sk : 0);
    for (let i = 0; i < pred.length; i += 2) {
      const p = pred[i];
      if (p.y > reach) continue;
      if (eta(car, p.x, p.z) <= p.t + 0.05) { target = p; break; }
    }
    if (!target) target = pred[Math.min(pred.length - 1, 90)] || { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z, t: 1.5 };

    if (ai.mode === 'save' || ai.mode === 'attack') {
      // shot direction: from ball to target point in opponent goal (or away from own goal when saving)
      let aimX = U.clamp(target.x * 0.3, -A.goalHW * 0.6, A.goalHW * 0.6);
      _t.set(aimX - target.x, 0, oppGoalZ - target.z).normalize();
      if (ai.mode === 'save') { _t.set(target.x - 0, 0, target.z - ownGoalZ).normalize(); if (Math.abs(target.z - ownGoalZ) < 12) _t.set(Math.sign(target.x || 1), 0, dir * 0.4).normalize(); }
      const toBall = _b.set(target.x - car.pos.x, 0, target.z - car.pos.z);
      const dBall = toBall.length();
      toBall.normalize();
      const aligned = toBall.dot(_t);
      let tx = target.x - _t.x * (ball.r + car.hz * 0.6), tz = target.z - _t.z * (ball.r + car.hz * 0.6);
      if (aligned < 0.2 && dBall > 5 && ai.mode === 'attack' && !ai.contested) {
        // we're on the wrong side: swing around behind the ball
        const back = U.lerp(4, 10, U.clamp((0.2 - aligned), 0, 1));
        tx = target.x - _t.x * back + ai.noise.x;
        tz = target.z - _t.z * back;
        // if way ahead of the ball, rotate back towards own goal post
        if ((car.pos.z - target.z) * dir > 6) { tx = Math.sign(car.pos.x || 1) * A.goalHW * 1.4; tz = ownGoalZ + dir * 10; }
      }
      tx += ai.noise.x * 0.3; tz += ai.noise.z * 0.3;
      let want = U.clamp(dBall / Math.max(0.3, target.t) + 3, 8, maxWant);
      if ((aligned > 0.6 && ai.mode === 'attack') || ai.contested) want = maxWant; // lined up or contested: hit it hard
      const r = driveTo(car, c, tx, 0, tz, ai.mode === 'save' ? maxWant : want, useBoost && car.boost > 5);
      // shots: jump / dodge into the ball
      const bh = target.y - car.pos.y;
      const close3d = car.pos.distanceTo(ball.pos);
      if (Math.abs(r.ang) < 0.35) {
        if (bh > 1.4 && bh < 3.4 && target.t < 0.32 && dBall < 6) startJump(ai, c, U.clamp((bh - 1.2) * 0.12, 0.05, 0.2), sk > 0.45 && bh < 2.4, 1, 0);
        else if (bh < 1.4 && close3d < 2.6 + sp * 0.1 && ai.flipOK && sp > 6 && (aligned > 0.35 || ai.mode === 'save')) {
          // flip into the ball, angled toward where we want it to go
          const side = U.clamp((_t.x * car.left.x + _t.z * car.left.z) * -1.4, -0.6, 0.6);
          startJump(ai, c, 0.05, true, 1, side);
        }
        else if (sk > 0.55 && bh > 4 && bh < 12 && target.t < 2.0 && target.t > 0.6 && car.boost > 25 && Math.abs(r.ang) < 0.18 && dBall < target.t * 18) {
          ai.seq = 'aerial'; ai.seqT = 0; ai.aerialT = target.t; ai.dj = false; c.jumpSeq++;
        }
      }
      return;
    }

    if (ai.mode === 'support') {
      // hang back between the ball and own goal, grab boost when low
      if (car.boost < 35) {
        const np = nearestPad(car, game);
        if (np && np.dist < 35) { driveTo(car, c, np.pad.x, 0, np.pad.z, maxWant, false); return; }
      }
      // shadow: on the line from the ball back to our goal, ~20 m off the ball
      _a.set(0 - ball.pos.x, 0, ownGoalZ - ball.pos.z);
      const bl = _a.length() || 1;
      const back = Math.min(bl * 0.75, U.lerp(24, 18, sk));
      const tx = U.clamp(ball.pos.x + (_a.x / bl) * back, -A.hw + 6, A.hw - 6);
      const tz = U.clamp(ball.pos.z + (_a.z / bl) * back, -A.hl + 8, A.hl - 8);
      const d = Math.hypot(tx - car.pos.x, tz - car.pos.z);
      if (d < 4) { faceBall(car, c, ball); return; }
      driveTo(car, c, tx, 0, tz, U.clamp(d * 0.9, 4, maxWant), useBoost && d > 25);
      return;
    }

    // goalie
    const gx = U.clamp(ball.pos.x * 0.25, -A.goalHW * 0.7, A.goalHW * 0.7);
    const gz = ownGoalZ + dir * 3.5;
    const d = Math.hypot(gx - car.pos.x, gz - car.pos.z);
    if (d < 3) { faceBall(car, c, ball); return; }
    driveTo(car, c, gx, 0, gz, U.clamp(d, 4, maxWant), useBoost && d > 20);
  };

  // ---- Heatseeker: any touch sends the ball at the other net, so nobody circles round for an angle ----
  // the team it's flying at sends its first man straight at it (jumping / aerialing to meet it) and the rest stand
  // in the goal mouth where it will arrive; the team that shot follows it for the rebound off their backboard
  function hsIntercept(car, pred, sk) {
    const reach = sk > 0.6 ? 6.5 : sk > 0.35 ? 3.6 : 2.6;
    for (let i = 0; i < pred.length; i += 2) {
      const p = pred[i];
      if (p.y > reach) continue;
      if (eta(car, p.x, p.z) + (p.y > 1.8 ? 0.3 : 0) <= p.t + 0.05) return p;
    }
    return null;
  }
  function heatseeker(car, c, ai, game, dt, dir, sk) {
    const ball = game.ball, A = Phys.arena, pred = game.prediction, heat = ball.heat;
    const ownZ = -dir * A.hl, oppZ = dir * A.hl;
    const incoming = !heat.wait && heat.team !== car.team;
    const maxWant = U.lerp(16, 23, sk);
    ai.think -= dt;
    if (ai.think <= 0 || ai.hsRank == null) {
      ai.think = U.lerp(0.3, 0.06, sk);
      const t = (o) => { const p = hsIntercept(o, pred, sk); return p ? p.t : 50 + o.pos.distanceTo(ball.pos); };
      const mine = t(car);
      ai.hsRank = game.cars.filter((o) => o !== car && o.team === car.team && !o.demolished && t(o) < mine - 0.05).length;
      ai.noise.set(U.rand(-1, 1), 0, U.rand(-1, 1)).multiplyScalar(U.lerp(2.5, 0.2, sk));
    }
    const sp = car.vel.dot(car.fwd);
    if (heat.wait || incoming ? ai.hsRank === 0 : false) {
      // go and touch it
      const p = hsIntercept(car, pred, sk) || { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z, t: 2 };
      const r = driveTo(car, c, p.x + ai.noise.x * 0.3, 0, p.z - dir * 0.6 + ai.noise.z * 0.3, maxWant, true);
      const bh = p.y - car.pos.y, d = Math.hypot(p.x - car.pos.x, p.z - car.pos.z);
      if (Math.abs(r.ang) < 0.4) {
        // leave the ground as early as the jump needs to rise to it (time to get there from distance and speed,
        // and from the ball's own flight when it's coming at us)
        const tt = Math.min(p.t, d / Math.max(4, sp + Math.max(0, -ball.vel.dot(car.fwd))));
        if (bh > 0.9 && bh <= 2.4 && tt < 0.2 + (bh - 0.9) * 0.2) startJump(ai, c, U.clamp((bh - 0.8) * 0.13, 0.05, 0.22), false, 0, 0);
        else if (bh <= 0.9 && d < 2.6 + sp * 0.1 && sk > 0.3 && sp > 5) startJump(ai, c, 0.05, true, 1, 0);
        else if (sk > 0.4 && bh > 2.4 && bh < 12 && tt > 0.4 && tt < 2.2 && Math.abs(r.ang) < 0.25) { ai.seq = 'aerial'; ai.seqT = 0; ai.aerialT = p.t; ai.dj = false; c.jumpSeq++; }
      }
      return;
    }
    if (!incoming && !heat.wait && ai.hsRank === 0) {
      // our shot: trail it toward their net, ready for the rebound
      const tx = U.clamp(ball.pos.x * 0.6, -A.hw + 8, A.hw - 8), tz = U.clamp(ball.pos.z - dir * 9, -A.hl + 12, A.hl - 12);
      const d = Math.hypot(tx - car.pos.x, tz - car.pos.z);
      if (d < 3) faceBall(car, c, ball); else driveTo(car, c, tx, 0, tz, U.clamp(d, 6, maxWant), d > 15);
      return;
    }
    // guard: stand where it will cross our goal line and jump to block it
    let gx = 0;
    for (const p of pred) if ((p.z - ownZ) * dir < 5) { gx = p.x; break; }
    gx = U.clamp(gx, -A.goalHW + 1.2, A.goalHW - 1.2);
    const gz = ownZ + dir * 4, d = Math.hypot(gx - car.pos.x, gz - car.pos.z);
    if (d > 2.2) driveTo(car, c, gx, 0, gz, U.clamp(d * 1.3, 5, maxWant), d > 12);
    else faceBall(car, c, ball);
    if (!incoming || !car.onGround || ai.seq) return;
    // when will it get here, and how high will it be?
    _a.set(car.pos.x - ball.pos.x, 0, car.pos.z - ball.pos.z);
    const dH = _a.length(), vIn = ball.vel.x * (_a.x / (dH || 1)) + ball.vel.z * (_a.z / (dH || 1));
    if (vIn < 4) return;
    const tArr = dH / vIn;
    let hy = ball.pos.y;
    for (const p of pred) if (p.t >= tArr) { hy = p.y; break; }
    const bh = hy - car.pos.y;
    const lead = U.lerp(0.42, 0.3, sk); // how early to leave the ground
    if (bh > 3.0 && sk > 0.4 && tArr < 0.9 && tArr > 0.35) { ai.seq = 'aerial'; ai.seqT = 0; ai.aerialT = tArr; ai.dj = false; c.jumpSeq++; }
    else if (bh > 0.9 && bh <= 3.0 && tArr < lead * 0.6 + (bh - 0.9) * 0.2) startJump(ai, c, U.clamp((bh - 0.8) * 0.13, 0.05, 0.22), false, 0, 0);
  }

  // ---- goal celebrations (the scoring team) ----
  const CELEBRATIONS = ['flips', 'spin', 'donut', 'boostjump', 'double'];
  function celebrate(car, c, ai, game, dt) {
    const g = game.lastGoal, scored = g.team === car.team;
    if (ai.celGoal !== g) { ai.celGoal = g; ai.celT = 0; ai.celNext = 0.3 + Math.random() * 0.5; ai.cel = scored ? U.choice(CELEBRATIONS) : 'mope'; ai.seq = null; ai.celPhase = 0; }
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

  function faceBall(car, c, ball) {
    _a.set(ball.pos.x - car.pos.x, 0, ball.pos.z - car.pos.z);
    const lx = _a.dot(car.left), lz = _a.dot(car.fwd);
    const ang = Math.atan2(-lx, lz);
    const sp = car.vel.dot(car.fwd);
    if (Math.abs(ang) > 0.5) { c.throttle = sp > 3 ? -0.3 : 0.5; c.steer = U.clamp(ang * 2, -1, 1); }
    else { c.throttle = sp > 1 ? -0.4 : 0; c.steer = 0; }
    c.boost = false; c.handbrake = false;
  }

  function startJump(ai, c, hold, dodge, dy, dx) {
    if (ai.seq) return;
    ai.seq = 'jump'; ai.seqT = 0; ai.hold = hold; ai.dodge = dodge; ai.dodgeY = dy; ai.dodgeX = dx;
    c.jumpSeq++; c.jump = true;
  }

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
