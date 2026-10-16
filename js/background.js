/* =========================================================================
 * background.js — parallax pixel-art scenery.
 *
 * Every layer is baked once into a seamless offscreen tile, then blitted
 * with a modulo offset at a different parallax factor. Cheap and crisp.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const CONFIG = RF.CONFIG;
  const P = RF.PAL;

  /* ---------------------------- tiny helpers --------------------------- */

  function roundedRect(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color;
    if (w <= 0 || h <= 0) return;
    if (r <= 0) {
      ctx.fillRect(x, y, w, h);
      return;
    }
    ctx.fillRect(x + r, y, w - r * 2, 1);
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillRect(x, y + 2, w, h - 4);
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillRect(x + r, y + h - 1, w - r * 2, 1);
  }

  /**
   * Half-ellipse dome sitting on `baseY`, drawn with a darker outline so it
   * reads as classic 16-bit pixel scenery.
   */
  function drawDome(ctx, cx, baseY, rx, ry, fill, line) {
    const rows = [];
    for (let i = 0; i < ry; i++) {
      const t = i / ry;
      rows.push(Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t))));
    }
    for (let i = 0; i < ry; i++) {
      const hw = rows[i];
      const y = baseY - 1 - i;
      ctx.fillStyle = fill;
      ctx.fillRect(cx - hw, y, hw * 2 + 1, 1);
    }
    ctx.fillStyle = line;
    for (let i = 0; i < ry; i++) {
      const hw = rows[i];
      const y = baseY - 1 - i;
      if (i === ry - 1) {
        ctx.fillRect(cx - hw, y, hw * 2 + 1, 1); // cap
      } else {
        const above = rows[i + 1];
        const step = Math.max(1, hw - above);
        ctx.fillRect(cx - hw, y, step, 1); // left riser
        ctx.fillRect(cx + hw - step + 1, y, step, 1); // right riser
      }
    }
  }

  /** Seamless horizontal tiling of a baked layer. */
  function tile(ctx, tileCanvas, offset, y) {
    if (!tileCanvas) return;
    const span = tileCanvas.width;
    const W = RF.CONFIG.WIDTH;
    let off = -(offset % span);
    if (off > 0) off -= span;
    const yy = Math.round(y);
    for (let x = off; x < W; x += span) {
      ctx.drawImage(tileCanvas, Math.round(x), yy);
    }
  }

  /* ------------------------------- sky --------------------------------- */
  function drawSky(ctx) {
    const W = RF.CONFIG.WIDTH;
    const H = RF.CONFIG.PLAY_H;
    const bands = [
      [0, H * 0.36, RF.PAL.sky0],
      [H * 0.36, H * 0.4, RF.PAL.sky1],
      [H * 0.76, H * 0.14, RF.PAL.sky2],
      [H * 0.9, H * 0.1, RF.PAL.sky3]
    ];
    for (const b of bands) {
      ctx.fillStyle = b[2];
      ctx.fillRect(0, Math.round(b[0]), W, Math.ceil(b[1]) + 1);
    }
  }

  /* ------------------------------ clouds -------------------------------- */
  const CLOUD_SPAN = 288;

  function drawCloud(ctx, x, y, s) {
    const blobs = [
      [0, 6 * s, 20 * s, 8 * s],
      [11 * s, 0, 20 * s, 14 * s],
      [28 * s, 6 * s, 16 * s, 8 * s]
    ];
    for (const b of blobs) {
      const bx = x + b[0];
      roundedRect(ctx, bx, y + b[1], b[2], b[3], 2 * s, RF.PAL.cloud);
      ctx.fillStyle = RF.PAL.cloudShade;
      ctx.fillRect(bx + 2, y + b[1] + b[3] - 2, b[2] - 4, 1);
    }
  }

  function buildClouds() {
    const span = 288;
    const height = 64;
    const made = RF.Sprites.makeCanvas(span, height);
    const ctx = made.ctx;
    const rng = RF.mulberry32(20240613);
    const count = 4;
    for (let i = 0; i < count; i++) {
      const s = 1 + Math.floor(rng() * 2);
      const slot = (span / count) * i;
      const cx = Math.round(slot + rng() * (span / count - 40));
      const cy = Math.round(6 + rng() * 34);
      drawCloud(ctx, cx, cy, s);
    }
    return made.canvas;
  }

  /* ------------------------------- hills -------------------------------- */
  function buildHills() {
    const span = 288;
    const h = 66;
    const made = RF.Sprites.makeCanvas(span, h);
    const ctx = made.ctx;
    const base = h;
    drawDome(ctx, 40, base, 58, 52, RF.PAL.hillFar, RF.PAL.hillFarLine);
    drawDome(ctx, 168, base, 74, 44, RF.PAL.hillFar, RF.PAL.hillFarLine);
    drawDome(ctx, 258, base, 46, 34, RF.PAL.hillFar, RF.PAL.hillFarLine);
    drawDome(ctx, 104, base, 44, 30, RF.PAL.hillNear, RF.PAL.hillNearLine);
    drawDome(ctx, 216, base, 40, 26, RF.PAL.hillNear, RF.PAL.hillNearLine);
    return made.canvas;
  }

  /* -------------------------------- city -------------------------------- */
  function buildCity() {
    const span = 288;
    const h = 54;
    const made = RF.Sprites.makeCanvas(span, h);
    const ctx = made.ctx;
    const rng = RF.mulberry32(90210);
    const base = h;
    let x = 0;
    while (x < span) {
      const w = 10 + Math.floor(rng() * 16);
      const bh = 14 + Math.floor(rng() * 34);
      roundedRect(ctx, x, base - bh, w, bh, 1, RF.PAL.city);
      // roof line
      ctx.fillStyle = RF.PAL.cityDark;
      ctx.fillRect(x + 1, base - bh, Math.max(1, w - 2), 1);
      // windows
      for (let wy = base - bh + 4; wy < base - 4; wy += 6) {
        for (let wx = x + 3; wx < x + w - 3; wx += 6) {
          if (rng() > 0.45) {
            ctx.fillStyle = RF.PAL.cityDark;
            ctx.fillRect(wx, wy, 2, 2);
          }
        }
      }
      x += w + 3 + Math.floor(rng() * 6);
    }
    return made.canvas;
  }

  /* ------------------------------- bushes ------------------------------- */
  function buildBushes() {
    const span = 288;
    const h = 22;
    const made = RF.Sprites.makeCanvas(span, h);
    const ctx = made.ctx;
    const rng = RF.mulberry32(555);
    const base = h;
    let x = -6;
    while (x < span + 8) {
      const r = 6 + Math.floor(rng() * 7);
      drawDome(ctx, x, base, r, r + 2, RF.PAL.bush, RF.PAL.bushDark);
      x += Math.floor(r * 1.1) + 2;
    }
    return made.canvas;
  }

  /* ------------------------------- ground ------------------------------- */
  function buildGround() {
    const w = 24;
    const h = RF.CONFIG.GROUND_H; // 96
    const made = RF.Sprites.makeCanvas(w, h);
    const ctx = made.ctx;

    // Grass cap ------------------------------------------------------------
    ctx.fillStyle = RF.PAL.grass;
    ctx.fillRect(0, 0, w, 14);
    ctx.fillStyle = RF.PAL.grassLight;
    ctx.fillRect(0, 0, w, 2);
    // grass speckle / blade marks (period 12 divides 24 → seamless)
    ctx.fillStyle = RF.PAL.grassDark;
    for (let x = 0; x < w; x++) {
      ctx.fillRect(x, 8 + ((x * 5) % 5), 1, 2);
    }
    ctx.fillRect(0, 12, w, 2);

    // Dirt ----------------------------------------------------------------
    ctx.fillStyle = RF.PAL.dirt;
    ctx.fillRect(0, 14, w, h - 14);
    // diagonal stripes, period 12 → seamless
    ctx.fillStyle = RF.PAL.dirtLine;
    for (let y = 14; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x + y) % 12 < 6) ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = RF.PAL.dirtDark;
    for (let y = 18; y < h; y += 10) {
      ctx.fillRect(0, y, w, 1);
    }
    // Repeat clearly readable grass detail at the very top of the tile.
    ctx.fillStyle = RF.PAL.grassDark;
    ctx.fillRect(0, 13, w, 1);

    return made.canvas;
  }

  /* ------------------------------- layer API ---------------------------- */
  const Background = {
    _scroll: 0,

    init() {
      this.clouds = buildClouds();
      this.hills = buildHills();
      this.city = buildCity();
      this.bushes = buildBushes();
      this.ground = buildGround();
    },

    draw(ctx) {
      const s = this._scroll;
      drawSky(ctx);
      tile(ctx, this.clouds, s * 0.38, 8);
      tile(ctx, this.hills, s * 0.22, RF.CONFIG.PLAY_H - 66);
      tile(ctx, this.city, s * 0.12, RF.CONFIG.PLAY_H - 54);
      tile(ctx, this.bushes, s * 0.62, RF.CONFIG.PLAY_H - 22);
    },

    drawGround(ctx) {
      tile(ctx, this.ground, this._scroll, RF.CONFIG.PLAY_H);
    }
  };

  RF.Background = Background;
})(window.RF);
