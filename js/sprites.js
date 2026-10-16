/* =========================================================================
 * sprites.js — pixel art data + tiny rasteriser helpers.
 *
 * Everything here works in "logical pixels" (1 unit = 1 pixel of the
 * 288x512 canvas). Sprites are pre-rendered once into offscreen canvases
 * so the render loop only ever blits.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const P = RF.PAL;

  /* ---------------------------------------------------------------------
   * Bird — 16x12 pixel-art sprite, three wing positions (flap frames).
   * Legend:  K outline  Y body  W eye white  B pupil  R beak  G belly
   * ------------------------------------------------------------------- */
  const BIRD_BODY = [
    ".....KKKKKK.....",
    "...KKYYYYYYKK...",
    "..KYYYYYYYWWWK..",
    ".KYYYYYYYYWWBBK.",
    ".KYYYYYYYWWWBBK.",
    ".KYYYYYYYYWWWKK.",
    "..KYYYYYYYRRRRRK",
    "..KYYYYYYYRRRRRK",
    "..KYYYYYYGYRRRK.",
    "...KGGGGGGGGK...",
    "....KRRKKRRK....",
    ".....KK..KK....."
  ];

  // Wing overlay — drawn on top of the body at three vertical offsets.
  const WING = ["KKKK.", "KWWWK", ".KKK."];
  const WING_Y = [3, 5, 7]; // frame 0 = up, 1 = mid, 2 = down

  const BIRD_W = RF.CONFIG.BIRD_W; // 26 (head slot)
  const BIRD_H = RF.CONFIG.BIRD_H; // 26

  // The pixel-art bird is only a fallback while a head image is loading /
  // if one ever fails, so centre its 16x12 art inside the slot.
  const BIRD_OX = Math.floor((BIRD_W - 16) / 2);
  const BIRD_OY = Math.floor((BIRD_H - 12) / 2);

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx: ctx };
  }

  function paintBitmap(ctx, bitmap, colorMap, ox, oy) {
    for (let y = 0; y < bitmap.length; y++) {
      const row = bitmap[y];
      for (let x = 0; x < row.length; x++) {
        const code = row[x];
        if (code === ".") continue;
        const color = colorMap[code];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  /** Pre-render the three bird frames into offscreen canvases (fallback). */
  function buildBirdFrames() {
    const frames = [];
    const ox = Math.round((BIRD_W - 16) / 2);
    const oy = Math.round((BIRD_H - 12) / 2);
    for (let i = 0; i < 3; i++) {
      const made = makeCanvas(BIRD_W, BIRD_H);
      paintBitmap(made.ctx, BIRD_BODY, P.bird, ox, oy);
      paintBitmap(made.ctx, WING, P.bird, ox + 1, oy + WING_Y[i]);
      frames.push(made.canvas);
    }
    return frames;
  }

  /* ---------------------------------------------------------------------
   * 5x7 pixel font — digits only (all in-canvas text is a score).
   * ------------------------------------------------------------------- */
  const FONT5 = {
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"]
  };

  const GLYPH_W = 5;
  const GLYPH_H = 7;
  const GLYPH_ADV = 6; // 5px glyph + 1px gap

  function paintGlyphs(ctx, text, x, y, scale, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < text.length; i++) {
      const glyph = FONT5[text[i]];
      if (!glyph) continue;
      const gx = x + i * GLYPH_ADV * scale;
      for (let gy = 0; gy < GLYPH_H; gy++) {
        const row = glyph[gy];
        for (let gxi = 0; gxi < GLYPH_W; gxi++) {
          if (row[gxi] === "1") {
            ctx.fillRect(gx + gxi * scale, y + gy * scale, scale, scale);
          }
        }
      }
    }
  }

  function textWidth(text, scale) {
    return text.length * GLYPH_ADV * scale - scale;
  }

  /**
   * Draw pixel text with optional outline/shadow and alignment.
   * align: "left" | "center" | "right"
   */
  function drawPixelText(ctx, text, x, y, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    const align = opts.align || "left";
    const color = opts.color || RF.PAL.text;
    const w = textWidth(text, scale);

    let ox = Math.round(x);
    if (align === "center") ox = Math.round(x - w / 2);
    else if (align === "right") ox = Math.round(x - w);
    const oy = Math.round(y);

    if (opts.outline) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          paintGlyphs(ctx, text, ox + dx * scale, oy + dy * scale, scale, opts.outline);
        }
      }
    }
    if (opts.shadow) {
      paintGlyphs(ctx, text, ox, oy + scale, scale, opts.shadow);
    }
    paintGlyphs(ctx, text, ox, oy, scale, color);
  }

  RF.Sprites = {
    BIRD_W: BIRD_W,
    BIRD_H: BIRD_H,
    birdFrames: null,
    GLYPH_W: GLYPH_W,
    GLYPH_H: GLYPH_H,
    makeCanvas: makeCanvas,
    paintBitmap: paintBitmap,
    drawPixelText: drawPixelText,
    textWidth: textWidth,
    init() {
      this.birdFrames = buildBirdFrames();
    }
  };
})(window.RF);
