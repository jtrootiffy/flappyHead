/* =========================================================================
 * renderer.js — all drawing. Reads game state, never mutates it.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const C = RF.CONFIG;
  const P = RF.PAL;

  function Renderer(canvas, flyerCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = C.WIDTH;
    canvas.height = C.HEIGHT;
    this.ctx.imageSmoothingEnabled = false;

    // A second layer, kept at the display's real resolution, used to draw the
    // chosen head. The 288x512 play field is upscaled with `image-rendering:
    // pixelated`, which is perfect for the bitmap art but would turn a
    // photo-ish head into mush — so the head lives here instead.
    this.flyer = flyerCanvas || null;
    this.fctx = this.flyer ? this.flyer.getContext("2d") : null;
  }

  Renderer.prototype.draw = function (game) {
    const ctx = this.ctx;
    RF.Background._scroll = game.scroll;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;

    // Screen shake — integer offsets keep the pixels crisp.
    let sx = 0;
    let sy = 0;
    if (game.shake > 0.1) {
      sx = Math.round(RF.rand(-game.shake, game.shake));
      sy = Math.round(RF.rand(-game.shake, game.shake));
    }

    ctx.save();
    ctx.translate(sx, sy);
    RF.Background.draw(ctx);
    this.drawPipes(ctx, game);
    RF.Background.drawGround(ctx);

    // The bird bounces on the floor while dying: keep it above the ground.
    this.drawBird(ctx, game);
    this.drawParticles(ctx, game);
    ctx.restore();

    // Score flash — a brief white wash when the player scores.
    if (game.flash > 0) {
      ctx.globalAlpha = Math.min(0.42, game.flash * 2.4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);
      ctx.globalAlpha = 1;
    }

    this.drawScore(ctx, game);

    // The head is composited on its own device-resolution canvas (see below),
    // so it is drawn after the whole play field rather than inside it.
    this.drawFlyer(game, sx, sy);
  };

  /* -------------------------------- pipes ------------------------------- */
  Renderer.prototype.pipeStripes = function (ctx, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = RF.PAL.pipeMid;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = RF.PAL.pipeLight;
    ctx.fillRect(x + 3, y, 6, h);
    ctx.fillStyle = RF.PAL.pipeHi;
    ctx.fillRect(x + 3, y, 2, h);
    ctx.fillStyle = RF.PAL.pipeShade;
    ctx.fillRect(x + w - 7, y, 5, h);
    // ink outline
    ctx.fillStyle = RF.PAL.pipeDark;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  };

  Renderer.prototype.drawPipes = function (ctx, game) {
    const over = C.PIPE_CAP_OVER;
    const capH = C.PIPE_CAP_H;
    for (let i = 0; i < game.pipes.length; i++) {
      const p = game.pipes[i];
      const x = Math.round(p.x);
      const gapBottom = p.gapY + p.gapH;

      // Upper shaft
      const shaftH = p.gapY - capH;
      if (shaftH > 0) this.pipeStripes(ctx, x, 0, C.PIPE_W, shaftH);
      // Upper cap
      this.pipeStripes(ctx, x - over, p.gapY - capH, C.PIPE_W + over * 2, capH);
      // Lower cap
      this.pipeStripes(ctx, x - over, gapBottom, C.PIPE_W + over * 2, capH);
      // Lower shaft
      const lowerY = gapBottom + capH;
      const lowerH = C.PLAY_H - lowerY;
      if (lowerH > 0) this.pipeStripes(ctx, x, lowerY, C.PIPE_W, lowerH);
    }
  };

  /* -------------------------------- bird -------------------------------- */
  /**
   * The pixel-art bird is only a fallback: it shows while the chosen head PNG
   * is still loading (or if it ever fails). Once a head is ready it is drawn
   * on the high-resolution flyer layer instead — see drawFlyer.
   */
  Renderer.prototype.drawBird = function (ctx, game) {
    if (RF.Heads && RF.Heads.getFrame()) return;

    const frames = RF.Sprites.birdFrames;
    if (!frames) return;

    const bird = game.bird;
    const sprite = frames[bird.frame % frames.length];
    const cx = bird.x + C.BIRD_W * 0.5;
    const cy = bird.y + C.BIRD_H * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bird.angle);
    ctx.drawImage(sprite, -C.BIRD_W * 0.5, -C.BIRD_H * 0.5, C.BIRD_W, C.BIRD_H);
    ctx.restore();
  };

  /* ----------------------------- flyer layer ---------------------------- */
  /** Match the flyer layer's backing store to the canvas' on-screen size. */
  Renderer.prototype.resizeFlyer = function () {
    const cv = this.flyer;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = this.canvas.clientWidth || C.WIDTH;
    const cssH = this.canvas.clientHeight || C.HEIGHT;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
  };

  /**
   * Draw the chosen head on the device-resolution layer, in the same place,
   * at the same tilt and with the same screen shake as the play field.
   */
  Renderer.prototype.drawFlyer = function (game, sx, sy) {
    const cv = this.flyer;
    const ctx = this.fctx;
    if (!cv || !ctx) return;
    this.resizeFlyer();

    // Device pixels per logical pixel. The stage keeps the 288:512 aspect
    // ratio, so this one factor maps the whole play field.
    const k = cv.width / C.WIDTH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);

    const head = RF.Heads && RF.Heads.getFrame();
    if (!head || !(k > 0)) return;

    const bird = game.bird;
    const cx = bird.x + C.BIRD_W * 0.5;
    const cy = bird.y + C.BIRD_H * 0.5;

    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(sx, sy);
    ctx.translate(cx, cy);
    ctx.rotate(bird.angle);

    // Soft contact shadow so the head reads against the bright sky.
    ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.drawImage(head, -C.BIRD_W * 0.5, -C.BIRD_H * 0.5, C.BIRD_W, C.BIRD_H);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  /* ------------------------------ particles ----------------------------- */
  Renderer.prototype.drawParticles = function (ctx, game) {
    const list = game.particles;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a < 0.4 ? Math.max(0, a / 0.4) : 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  };

  /* -------------------------------- score ------------------------------- */
  Renderer.prototype.drawScore = function (ctx, game) {
    if (game.state === "menu" || game.state === "ready" || game.state === "over") {
      return;
    }
    const text = String(game.score);
    RF.Sprites.drawPixelText(ctx, text, C.WIDTH / 2, 26, {
      scale: 3,
      align: "center",
      color: "#ffffff",
      outline: RF.PAL.textInk,
      shadow: "rgba(0,0,0,0.25)"
    });
  };

  RF.Renderer = Renderer;
})(window.RF);
