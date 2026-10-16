/* =========================================================================
 * input.js — one place where every control is normalised to a single
 * "primary action" (flap / start / retry).
 *
 *  - Keyboard : Space, ArrowUp, W, Enter
 *  - Mouse    : click anywhere on the play field
 *  - Touch    : tap anywhere on the play field
 *
 * Pointer events cover mouse + touch + pen with a single listener, which
 * avoids the classic "touchstart and click both fire" double-input bug.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const PRIMARY_CODES = {
    Space: true,
    ArrowUp: true,
    KeyW: true,
    Enter: true,
    NumpadEnter: true
  };

  // Cycle the flyer selection (only acted on during the pre-run screen).
  const NAV_CODES = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  // Pick a flyer directly by number.
  const PICK_CODES = {
    Digit1: 0,
    Numpad1: 0,
    Digit2: 1,
    Numpad2: 1,
    Digit3: 2,
    Numpad3: 2,
    Digit4: 3,
    Numpad4: 3
  };

  const Input = {
    _bound: false,
    onPrimary: null,
    onNav: null,
    onPick: null,
    enabled: true,

    init(options) {
      this.onPrimary = options.onPrimary || function () {};
      this.onNav = options.onNav || function () {};
      this.onPick = options.onPick || function () {};
      this.target = options.target; // the stage element (pointer surface)
      if (this._bound) return;
      this._bound = true;

      /* ------------------------------ keyboard ----------------------------- */
      window.addEventListener(
        "keydown",
        (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          // Let a focused button handle Enter/Space itself (no double action).
          if (this._isInteractive(e.target)) return;

          if (NAV_CODES[e.code] !== undefined) {
            e.preventDefault();
            if (!e.repeat) this._nav(NAV_CODES[e.code]);
            return;
          }
          if (PICK_CODES[e.code] !== undefined) {
            e.preventDefault();
            if (!e.repeat) this._pick(PICK_CODES[e.code]);
            return;
          }
          if (!PRIMARY_CODES[e.code]) return;
          // Stop the page from scrolling while playing.
          e.preventDefault();
          if (e.repeat) return; // hold-key must not auto-flap
          this._fire("keyboard");
        },
        { passive: false }
      );

      // Belt and braces: some browsers scroll on keyup for Space.
      window.addEventListener(
        "keyup",
        (e) => {
          if (!PRIMARY_CODES[e.code]) return;
          e.preventDefault();
        },
        { passive: false }
      );

      /* --------------------------- pointer surface -------------------------- */
      const surface = this.target || document;
      const onPointer = (e) => {
        // Ignore secondary mouse buttons / right click.
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (this._isInteractive(e.target)) return; // buttons handle themselves
        e.preventDefault();
        this._fire("pointer");
      };

      surface.addEventListener("pointerdown", onPointer, { passive: false });

      // Kill the 300ms double-tap zoom and long-press context menu.
      surface.addEventListener("contextmenu", (e) => e.preventDefault());
      surface.addEventListener("dblclick", (e) => e.preventDefault());
      // Some mobile browsers still emit a click after a tap: swallow it.
      surface.addEventListener("click", (e) => {
        if (!this._isInteractive(e.target)) e.preventDefault();
      });
    },

    _isInteractive(el) {
      if (!el || !el.closest) return false;
      return !!el.closest("button, a, input, select, textarea, [data-ui]");
    },

    _fire(source) {
      if (!this.enabled) return;
      RF.Sound.unlock();
      this.onPrimary(source);
    },

    _nav(delta) {
      if (!this.enabled) return;
      RF.Sound.unlock();
      this.onNav(delta);
    },

    _pick(index) {
      if (!this.enabled) return;
      RF.Sound.unlock();
      this.onPick(index);
    },

    setEnabled(v) {
      this.enabled = !!v;
    }
  };

  RF.Input = Input;
})(window.RF);
