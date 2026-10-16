/* =========================================================================
 * game.js — the simulation. State machine, physics, spawning, collision.
 *
 * States:  menu -> ready -> playing -> dying -> over -> (ready ...)
 *
 * The whole update() is driven with a fixed timestep (see main.js) so the
 * feel of the game never depends on the display refresh rate.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const C = RF.CONFIG;
  const WING_PATTERN = [0, 1, 2, 1];

  function Game() {
    this.bird = RF.createBird();
    this.pipes = [];
    this.particles = [];

    this.state = "menu";
    this.stateTime = 0;
    this.time = 0;

    this.scroll = 0; // total world distance travelled (for parallax)
    this.speed = C.SPEED_START;
    this.score = 0;
    this.best = RF.getBest();
    this.newBest = false;

    this.shake = 0;
    this.flash = 0;
    this.lockout = 0;
    this.groundRest = 0;
    this.impacted = false;
  }

  /* --------------------------- state helpers --------------------------- */
  Game.prototype.setState = function (state) {
    this.state = state;
    this.stateTime = 0;
  };

  Game.prototype.toMenu = function () {
    this.pipes.length = 0;
    this.particles.length = 0;
    this.score = 0;
    this.shake = 0;
    this.flash = 0;
    this.bird = RF.createBird();
    this.setState("menu");
  };

  /** From menu / game-over: arm a fresh run (bird hovers, waiting to flap). */
  Game.prototype.beginRun = function () {
    this.bird = RF.createBird();
    this.pipes.length = 0;
    this.particles.length = 0;
    this.score = 0;
    this.speed = C.SPEED_START;
    this.shake = 0;
    this.flash = 0;
    this.groundRest = 0;
    this.impacted = false;
    this.newBest = false;
    this.setState("ready");
    this.spawnPipes(C.SPACING_START);
  };

  /* ------------------------------- input ------------------------------- */
  /**
   * Single entry point for every control (keyboard / mouse / touch).
   * The state machine decides what the press means — that is what stops
   * double-input and accidental multiple starts.
   */
  Game.prototype.primaryInput = function () {
    switch (this.state) {
      case "menu":
        this.beginRun();
        break;
      case "ready":
        this.flap();
        this.setState("playing");
        break;
      case "playing":
        this.flap();
        break;
      case "over":
        if (this.lockout > 0) return;
        RF.Sound.unlock();
        this.beginRun();
        break;
      default:
        // 'dying' deliberately ignores input so a panicked tap cannot
        // cancel the death animation.
        break;
    }
  };

  Game.prototype.flap = function () {
    const bird = this.bird;
    bird.vy = C.FLAP_V;
    bird.animBoost = 0.22;
    bird.animTime = 0; // always start the wing cycle on the up-stroke
    RF.Sound.flap();
    RF.spawnParticles(this, this.bird.x + 1, this.bird.y + C.BIRD_H, {
      count: 3,
      colors: ["#ffffff", "#dff3fb"],
      speed: 46,
      angle: Math.PI * 0.82,
      lift: 12,
      gravity: 90,
      size: 2,
      life: 0.32
    });
  };

  /* ------------------------------ difficulty --------------------------- */
  Game.prototype.difficulty = function () {
    const s = this.score;
    return {
      speed: Math.min(C.SPEED_START + s * C.SPEED_GAIN_PER, C.SPEED_MAX),
      gap: Math.max(C.GAP_MIN, C.GAP_START - s * C.GAP_SHRINK_PER),
      spacing: Math.max(C.SPACING_MIN, C.SPACING_START - s * C.SPACING_SHRINK_PER)
    };
  };

  /* ------------------------------- pipes ------------------------------- */
  Game.prototype.makePipe = function (x, gap) {
    const margin = C.GAP_MARGIN;
    const maxTop = Math.max(margin + 1, C.PLAY_H - gap - margin);
    const gapY = Math.round(margin + Math.random() * (maxTop - margin));
    return RF.createPipe(x, gapY, gap);
  };

  Game.prototype.spawnPipes = function (spacing) {
    const last = this.pipes[this.pipes.length - 1];
    if (!last) {
      this.pipes.push(this.makePipe(C.WIDTH + 16, this.difficulty().gap));
    } else if (last.x < C.WIDTH) {
      this.pipes.push(this.makePipe(last.x + spacing, this.difficulty().gap));
    }
  };

  /* ------------------------------- scoring ----------------------------- */
  Game.prototype.addScore = function () {
    this.score++;
    this.flash = 0.13;
    RF.Sound.score();
    const bird = this.bird;
    RF.spawnParticles(this, bird.x + C.BIRD_W, bird.y + C.BIRD_H * 0.5, {
      count: 9,
      colors: [RF.PAL.textGold, "#ffffff", RF.PAL.grassLight],
      speed: 95,
      gravity: 260,
      size: 2,
      life: 0.5
    });
  };

  /* ------------------------------ bird anim ---------------------------- */
  Game.prototype.updateWing = function (dt) {
    const bird = this.bird;
    bird.animBoost = Math.max(0, bird.animBoost - dt);
    bird.animTime += dt * (bird.animBoost > 0 ? 22 : 7);
    bird.frame = WING_PATTERN[Math.floor(bird.animTime) % WING_PATTERN.length];
  };

  Game.prototype.updateAngle = function (dt) {
    const bird = this.bird;
    let target;
    if (bird.vy < 0) {
      target = -0.42;
    } else {
      target = Math.min(
        Math.PI / 2,
        (bird.vy / C.MAX_FALL) * (Math.PI / 2) * 1.35
      );
    }
    bird.angle += (target - bird.angle) * RF.clamp(dt * 11, 0, 1);
  };

  Game.prototype.hoverBird = function () {
    const bird = this.bird;
    bird.x = C.BIRD_X;
    bird.vy = 0;
    bird.y = C.PLAY_H * 0.42 + Math.sin(this.time * 3) * C.READY_BOB_AMP;
    bird.angle = Math.sin(this.time * 3) * 0.12;
  };

  /* ------------------------------- death ------------------------------- */
  Game.prototype.die = function () {
    if (this.state === "dying" || this.state === "over") return;
    this.setState("dying");
    this.shake = 7;
    this.impacted = false;
    this.groundRest = 0;
    RF.Sound.hit();
    RF.spawnParticles(this, this.bird.x + C.BIRD_W * 0.5, this.bird.y + C.BIRD_H * 0.5, {
      count: 14,
      colors: [RF.PAL.bird.Y, "#ffffff", RF.PAL.bird.R],
      speed: 130,
      gravity: 340,
      size: 2,
      life: 0.55
    });
  };

  Game.prototype.finishRun = function () {
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = this.score;
      RF.setBest(this.best);
    }
    this.lockout = C.RESTART_LOCKOUT;
    this.setState("over");
    RF.Sound.die();
  };

  /* ------------------------------- update ------------------------------ */
  Game.prototype.update = function (dt) {
    this.time += dt;
    this.stateTime += dt;
    this.lockout = Math.max(0, this.lockout - dt);
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt);
    RF.updateParticles(this, dt);

    switch (this.state) {
      case "menu":
      case "ready":
        this.scroll += 34 * dt;
        this.hoverBird();
        this.updateWing(dt);
        break;
      case "playing":
        this.updatePlaying(dt);
        break;
      case "dying":
        this.updateDying(dt);
        break;
      case "over":
        this.updateWing(dt);
        break;
    }
  };

  Game.prototype.updatePlaying = function (dt) {
    const bird = this.bird;
    const d = this.difficulty();
    this.speed = d.speed;

    // Vertical physics
    bird.vy = Math.min(bird.vy + C.GRAVITY * dt, C.MAX_FALL);
    bird.y += bird.vy * dt;

    // Ceiling: blocked, never fatal (prevents flying over the pipes).
    if (bird.y < 0) {
      bird.y = 0;
      if (bird.vy < 0) bird.vy = 0;
    }

    this.updateAngle(dt);
    this.updateWing(dt);

    // World scroll + pipes
    this.scroll += this.speed * dt;
    for (let i = 0; i < this.pipes.length; i++) {
      this.pipes[i].x -= this.speed * dt;
    }
    this.spawnPipes(d.spacing);

    // Scoring: the bird's centre clearing the pipe's right edge.
    const centre = bird.x + C.BIRD_W * 0.5;
    for (let i = 0; i < this.pipes.length; i++) {
      const p = this.pipes[i];
      if (!p.scored && p.x + C.PIPE_W <= centre) {
        p.scored = true;
        this.addScore();
      }
    }

    // Cull off-screen pipes
    if (this.pipes.length > 3) {
      this.pipes = this.pipes.filter(
        (p) => p.x + C.PIPE_W + C.PIPE_CAP_OVER > -24
      );
    }

    // Collision
    const box = RF.birdHitbox(bird);
    for (let i = 0; i < this.pipes.length; i++) {
      const boxes = RF.pipeHitboxes(this.pipes[i]);
      for (let j = 0; j < boxes.length; j++) {
        if (RF.aabb(box, boxes[j])) {
          this.die();
          return;
        }
      }
    }

    // Ground
    if (bird.y + C.BIRD_H >= C.PLAY_H) {
      bird.y = C.PLAY_H - C.BIRD_H;
      this.die();
    }
  };

  Game.prototype.updateDying = function (dt) {
    const bird = this.bird;
    bird.vy = Math.min(bird.vy + C.GRAVITY * dt, C.MAX_FALL);
    bird.y += bird.vy * dt;
    bird.angle += (Math.PI / 2 - bird.angle) * RF.clamp(dt * 10, 0, 1);
    this.updateWing(dt);

    const floor = C.PLAY_H - C.BIRD_H;
    if (bird.y >= floor) {
      bird.y = floor;
      if (!this.impacted) {
        this.impacted = true;
        this.shake = Math.max(this.shake, 5);
        RF.spawnParticles(this, bird.x + C.BIRD_W * 0.5, C.PLAY_H - 2, {
          count: 10,
          colors: [RF.PAL.dirt, RF.PAL.dirtDark, RF.PAL.grassDark],
          speed: 80,
          angle: -Math.PI / 2,
          lift: 0,
          gravity: 460,
          size: 2,
          life: 0.45
        });
      }
      if (bird.vy > 200) {
        bird.vy = -bird.vy * 0.26; // tiny bounce, feels physical
        this.groundRest = 0;
      } else {
        bird.vy = 0;
        this.groundRest += dt;
        if (this.groundRest > 0.25) this.finishRun();
      }
    }
  };

  /* ------------------------------ factories ---------------------------- */
  Game.prototype.pipeBoxes = function (pipe) {
    return RF.pipeHitboxes(pipe);
  };

  RF.Game = Game;
})(window.RF);
