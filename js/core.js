/* =========================================================================
 * core.js — namespace, tuning constants, palette and shared helpers.
 * Loaded first; everything else hangs off window.RF.
 * ========================================================================= */
window.RF = window.RF || {};

(function (RF) {
  "use strict";

  RF.VERSION = "1.0.0";

  /* ---------------------------------------------------------------------
   * Game tuning. All physics values are in *logical pixels per second*
   * so gameplay is identical on every device and refresh rate.
   * ------------------------------------------------------------------- */
  RF.CONFIG = {
    // Logical (pixel-art) resolution. The canvas is stretched with CSS.
    WIDTH: 288,
    HEIGHT: 512,
    GROUND_H: 96,

    // Bird / flyer physics. BIRD_W/H is the square slot the chosen head is
    // auto-fit into; the (smaller) inset hitbox keeps the game forgiving.
    GRAVITY: 1500,
    FLAP_V: -430,
    MAX_FALL: 620,
    BIRD_X: 62,
    BIRD_W: 26,
    BIRD_H: 26,
    HIT_INSET_X: 6,
    HIT_INSET_Y: 6,

    // Pipes
    PIPE_W: 52,
    PIPE_CAP_H: 26,
    PIPE_CAP_OVER: 4,
    GAP_START: 152,
    GAP_MIN: 118,
    GAP_SHRINK_PER: 1.0,
    GAP_MARGIN: 46,

    // Difficulty curve
    SPEED_START: 108,
    SPEED_MAX: 190,
    SPEED_GAIN_PER: 2.0,
    SPACING_START: 168,
    SPACING_MIN: 146,
    SPACING_SHRINK_PER: 0.8,

    // Simulation
    STEP: 1 / 120,
    MAX_STEPS: 6,
    READY_BOB_AMP: 6,
    RESTART_LOCKOUT: 0.35
  };

  RF.CONFIG.PLAY_H = RF.CONFIG.HEIGHT - RF.CONFIG.GROUND_H; // 416

  /* ---------------------------------------------------------------------
   * Limited retro palette.
   * ------------------------------------------------------------------- */
  RF.PAL = {
    sky0: "#2f9fd4",
    sky1: "#4eb4de",
    sky2: "#7fd0e6",
    sky3: "#b3e6f0",

    cloud: "#ffffff",
    cloudShade: "#d9eff6",
    cloudLine: "#bfe3ed",

    inker: "#1f2a33",

    city: "#c9e9f0",
    cityDark: "#a9d6e0",

    hillFar: "#8fd96a",
    hillFarLine: "#5aa63f",
    hillNear: "#7ac95a",
    hillNearLine: "#4b8f33",

    bush: "#5aa63f",
    bushDark: "#3f7f2e",

    pipeDark: "#2f5d17",
    pipeMid: "#5aa02c",
    pipeLight: "#8ed94a",
    pipeHi: "#c8f27a",
    pipeShade: "#3f7a1e",

    grass: "#73bf2e",
    grassDark: "#4d8c1f",
    grassLight: "#a4e05a",
    dirt: "#ded895",
    dirtDark: "#c9bf7a",
    dirtLine: "#d6cc8a",

    bird: {
      K: "#1f1a17",
      Y: "#f7d51d",
      W: "#ffffff",
      B: "#111111",
      R: "#f57e20",
      G: "#fdf0c4",
      w: "#ffffff"
    },

    text: "#ffffff",
    textInk: "#2b2118",
    textGold: "#ffd94a"
  };

  /* ---------------------------------------------------------------------
   * Small math helpers.
   * ------------------------------------------------------------------- */
  RF.clamp = function (v, min, max) {
    return v < min ? min : v > max ? max : v;
  };

  RF.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  RF.rand = function (min, max) {
    return min + Math.random() * (max - min);
  };

  /** Frame-rate independent smoothing factor. */
  RF.damp = function (dt, rate) {
    return 1 - Math.pow(1 - rate, dt * 60);
  };

  /** Deterministic PRNG so background art is identical on every load. */
  RF.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  RF.Storage = {
    BEST_KEY: "retro-flappy:best",
    MUTE_KEY: "retro-flappy:muted",
    CRT_KEY: "retro-flappy:crt",
    HEAD_KEY: "retro-flappy:head",

    read(key, fallback) {
      try {
        const v = window.localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        window.localStorage.setItem(key, String(value));
      } catch (e) {
        /* private mode / disabled storage — non fatal */
      }
    }
  };

  RF.getBest = function () {
    const raw = parseInt(RF.Storage.read(RF.Storage.BEST_KEY, "0"), 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  };

  RF.setBest = function (score) {
    RF.Storage.write(RF.Storage.BEST_KEY, score);
  };
})(window.RF);
