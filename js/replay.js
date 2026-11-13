'use strict';
// Rocket League (fan remake) - goal replays (ring buffer of the last few seconds)
(function (BL) {
  const STRIDE = 11; // x y z qx qy qz qw flags wheelSpin steer boost
  class Replay {
    constructor(game, seconds, hz) {
      this.game = game;
      this.hz = hz || 30;
      this.max = Math.round((seconds || 8) * this.hz);
      this.frames = [];
      this.acc = 0;
      this.goalIndex = -1;
      this.playing = false;
      this.t = 0;
    }
    record(dt) {
      this.acc += dt;
      if (this.acc < 1 / this.hz) return;
      this.acc -= 1 / this.hz;
      const g = this.game;
      const b = g.ball;
      const f = { b: new Float32Array([b.pos.x, b.pos.y, b.pos.z, b.quat.x, b.quat.y, b.quat.z, b.quat.w, b.hidden ? 1 : 0]), c: new Float32Array(g.cars.length * STRIDE) };
      for (let i = 0; i < g.cars.length; i++) {
        const c = g.cars[i], k = i * STRIDE;
        f.c[k] = c.pos.x; f.c[k + 1] = c.pos.y; f.c[k + 2] = c.pos.z;
        f.c[k + 3] = c.quat.x; f.c[k + 4] = c.quat.y; f.c[k + 5] = c.quat.z; f.c[k + 6] = c.quat.w;
        f.c[k + 7] = (c.demolished ? 1 : 0) | (c.boosting ? 2 : 0) | (c.supersonic ? 4 : 0);
        f.c[k + 8] = c.wheelSpin; f.c[k + 9] = c.steerVis; f.c[k + 10] = c.boost;
      }
      this.frames.push(f);
      if (this.frames.length > this.max) { this.frames.shift(); if (this.goalIndex >= 0) this.goalIndex--; }
    }
    markGoal() { this.goalIndex = this.frames.length - 1; }
    canPlay() { return this.goalIndex > this.hz; }
    start() {
      const pre = 5.0 * this.hz;
      this.start0 = Math.max(0, this.goalIndex - pre);
      // keep ~3 s after the goal so the replay shows the explosion and the scorer's celebration
      this.end0 = Math.min(this.frames.length - 1, this.goalIndex + 3.0 * this.hz);
      this.t = 0;
      this.duration = (this.end0 - this.start0) / this.hz;
      this.playing = true;
      this.exploded = false;
      return this.duration;
    }
    stop() { this.playing = false; this.frames = []; this.goalIndex = -1; this.acc = 0; }
    // returns sample object with getters for ball & car i
    sample(dt) {
      this.t += dt;
      const fi = this.start0 + this.t * this.hz;
      const i0 = Math.min(this.end0, Math.floor(fi)), i1 = Math.min(this.end0, i0 + 1);
      const a = fi - Math.floor(fi);
      const f0 = this.frames[i0], f1 = this.frames[i1];
      this.cur = { f0, f1, a, idx: i0 };
      return this.cur;
    }
    done() { return this.t >= this.duration; }
  }
  Replay.STRIDE = STRIDE;
  BL.Replay = Replay;
})(window.BL);
