/* =========================================================================
 * entities.js — the things that live in the world: bird, pipes, particles.
 * Plain factory functions; all simulation lives in game.js.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const C = RF.CONFIG;

  /* ------------------------------- bird -------------------------------- */
  RF.createBird = function () {
    return {
      x: C.BIRD_X,
      y: C.PLAY_H * 0.42,
      vy: 0,
      angle: 0,
      frame: 0,
      animTime: 0,
      animBoost: 0
    };
  };

  RF.birdHitbox = function (bird) {
    return {
      x: bird.x + C.HIT_INSET_X,
      y: bird.y + C.HIT_INSET_Y,
      w: C.BIRD_W - C.HIT_INSET_X * 2,
      h: C.BIRD_H - C.HIT_INSET_Y * 2
    };
  };

  /* ------------------------------- pipes ------------------------------- */
  RF.createPipe = function (x, gapY, gapH) {
    return { x: x, gapY: gapY, gapH: gapH, scored: false };
  };

  /**
   * Four collision rectangles per pipe: the two shafts (body width) plus the
   * two wider caps (pipes are capped like the arcade original, and the cap
   * overhang must be collidable without making the whole pipe unfair).
   */
  RF.pipeHitboxes = function (p) {
    const over = C.PIPE_CAP_OVER;
    const capH = C.PIPE_CAP_H;
    const gapBottom = p.gapY + p.gapH;
    const boxes = [];

    // Upper shaft
    const upperShaftH = p.gapY - capH;
    if (upperShaftH > 0) boxes.push({ x: p.x, y: 0, w: C.PIPE_W, h: upperShaftH });
    // Upper cap
    boxes.push({ x: p.x - over, y: p.gapY - capH, w: C.PIPE_W + over * 2, h: capH });
    // Lower cap
    boxes.push({ x: p.x - over, y: gapBottom, w: C.PIPE_W + over * 2, h: capH });
    // Lower shaft
    const lowerShaftY = gapBottom + capH;
    const lowerShaftH = C.PLAY_H - lowerShaftY;
    if (lowerShaftH > 0) {
      boxes.push({ x: p.x, y: lowerShaftY, w: C.PIPE_W, h: lowerShaftH });
    }
    return boxes;
  };

  RF.aabb = function (a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  };

  /* ----------------------------- particles ----------------------------- */
  RF.spawnParticles = function (game, x, y, opts) {
    const count = opts.count || 8;
    const colors = opts.colors || [RF.PAL.textGold, RF.PAL.text];
    const speed = opts.speed || 90;
    const life = opts.life || 0.5;
    const size = opts.size || 2;
    for (let i = 0; i < count; i++) {
      const a = opts.angle !== undefined ? opts.angle + RF.rand(-0.9, 0.9) : RF.rand(0, Math.PI * 2);
      const v = speed * RF.rand(0.45, 1.15);
      game.particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (opts.lift === undefined ? 30 : opts.lift),
        life: life * RF.rand(0.7, 1.3),
        maxLife: life,
        size: size,
        color: colors[(Math.random() * colors.length) | 0],
        gravity: opts.gravity === undefined ? 320 : opts.gravity
      });
    }
  };

  RF.updateParticles = function (game, dt) {
    const list = game.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  };
})(window.RF);
