/* =========================================================================
 * heads.js — the selectable flyers.
 *
 * Each head is a PNG in ./heads. On boot every image is downscaled once into
 * a HEAD_RES square offscreen buffer (whole image auto-fit with its aspect
 * ratio preserved), so the render loop only ever blits a small bitmap.
 *
 * The chosen head is persisted, defaults to the first, and can be changed on
 * the pre-run "choose your flyer" screen (see ui.js / input.js).
 * ========================================================================= */
(function (RF) {
  "use strict";

  // Heads are pre-rendered once at this square resolution, then drawn on the
  // device-resolution flyer layer. 256px covers high-DPI phones and big
  // desktop windows while keeping the bitmaps tiny.
  const HEAD_RES = 256;

  const HEADS = [
    { id: "angel", name: "ANGEL", src: "heads/Angel.png" },
    { id: "joven", name: "JOVEN", src: "heads/Joven.png" },
    { id: "raven", name: "RAVEN", src: "heads/Raven.png" },
    { id: "troy", name: "TROY", src: "heads/Troy.png" },
    { id: "piawaps", name: "PIAWAPS", src: "heads/Piawaps.png" }
  ];

  const Heads = {
    list: HEADS,
    selected: 0,
    frames: [], // one BIRD_W x BIRD_H canvas per head, or null until loaded
    loaded: 0,
    ready: false,

    init() {
      const saved = parseInt(RF.Storage.read(RF.Storage.HEAD_KEY, "0"), 10);
      this.selected =
        Number.isFinite(saved) && saved >= 0 && saved < HEADS.length ? saved : 0;

      this.frames = HEADS.map(() => null);
      this.loaded = 0;
      this.ready = false;
      HEADS.forEach((head, i) => this._load(head, i));
    },

    _load(head, index) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        try {
          this.frames[index] = this._render(img);
        } catch (e) {
          /* tainted canvas / decode issue — fall back to the pixel bird */
        }
        this.loaded++;
        if (this.loaded >= HEADS.length) this.ready = true;
      };
      img.onerror = () => {
        this.loaded++;
      };
      img.src = head.src;
    },

    /** Fit the whole image, centred, into a HEAD_RES square buffer. */
    _render(img) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.min(HEAD_RES / iw, HEAD_RES / ih);
      const w = Math.max(1, Math.round(iw * scale));
      const h = Math.max(1, Math.round(ih * scale));

      // Very large sources are stepped down through a 2x buffer first, which
      // avoids the aliasing a single big downscale can produce.
      let source = img;
      let sw = iw;
      let sh = ih;
      if (iw > HEAD_RES * 2 || ih > HEAD_RES * 2) {
        const hs = Math.min((HEAD_RES * 2) / iw, (HEAD_RES * 2) / ih);
        const hw = Math.max(1, Math.round(iw * hs));
        const hh = Math.max(1, Math.round(ih * hs));
        const hop = RF.Sprites.makeCanvas(hw, hh);
        hop.ctx.imageSmoothingEnabled = true;
        hop.ctx.imageSmoothingQuality = "high";
        hop.ctx.drawImage(img, 0, 0, hw, hh);
        source = hop.canvas;
        sw = hw;
        sh = hh;
      }

      const made = RF.Sprites.makeCanvas(HEAD_RES, HEAD_RES);
      const ctx = made.ctx;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        source,
        0,
        0,
        sw,
        sh,
        Math.round((HEAD_RES - w) / 2),
        Math.round((HEAD_RES - h) / 2),
        w,
        h
      );
      return made.canvas;
    },

    count() {
      return HEADS.length;
    },

    name(index) {
      const i = index === undefined ? this.selected : index;
      return HEADS[i] ? HEADS[i].name : "";
    },

    /** Pick a specific head (0-based). No-op if out of range or unchanged. */
    select(index) {
      if (!Number.isInteger(index) || index < 0 || index >= HEADS.length) return false;
      if (index === this.selected) return false;
      this.selected = index;
      RF.Storage.write(RF.Storage.HEAD_KEY, index);
      return true;
    },

    /** Move the selection by delta (wraps around). */
    cycle(delta) {
      const n = HEADS.length;
      const next = (((this.selected + delta) % n) + n) % n;
      return this.select(next);
    },

    /** The canvas for the current selection, or null while it is loading. */
    getFrame() {
      return this.frames[this.selected] || null;
    }
  };

  RF.Heads = Heads;
})(window.RF);
