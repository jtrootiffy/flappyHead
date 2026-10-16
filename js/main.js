/* =========================================================================
 * main.js — bootstrap + the requestAnimationFrame loop.
 *
 * The loop uses a fixed-timestep accumulator so the physics run at exactly
 * 120 Hz no matter what the display does (60 Hz, 120 Hz, stuttering…).
 * ========================================================================= */
(function (RF) {
  "use strict";

  /**
   * The pixel font is an optional enhancement: it is fetched only after the
   * load event, so a slow or offline network can never delay the game. If it
   * never arrives, the monospace fallback in style.css takes over.
   */
  function loadPixelFont() {
    if (document.querySelector("link[data-pixel-font]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute("data-pixel-font", "");
    link.href =
      "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
    document.head.appendChild(link);
  }

  function boot() {
    if (document.readyState === "complete") loadPixelFont();
    else window.addEventListener("load", loadPixelFont, { once: true });
    const canvas = document.getElementById("game");
    const stage = document.getElementById("stage");
    if (!canvas || !stage) return;

    // Bake the pixel art once.
    RF.Sprites.init();
    RF.Background.init();
    RF.Heads.init();

    const game = new RF.Game();
    const renderer = new RF.Renderer(canvas, document.getElementById("flyer"));

    RF.UI.init({ onPrimary: () => game.primaryInput() });

    RF.Input.init({
      target: stage,
      onPrimary: () => game.primaryInput(),
      onNav: (delta) => {
        // Only the pre-run "choose your flyer" screen changes the selection.
        if (game.state === "ready") RF.Heads.cycle(delta);
      },
      onPick: (index) => {
        if (game.state === "ready") RF.Heads.select(index);
      }
    });

    // Handy for debugging / automated checks.
    window.__flappy = { game: game, renderer: renderer, RF: RF };

    let last = performance.now();
    let acc = 0;

    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;
      // Tab was hidden or the machine stalled: never simulate a huge jump.
      if (dt > 0.25) dt = 0.25;

      acc += dt;
      let steps = 0;
      while (acc >= RF.CONFIG.STEP && steps < RF.CONFIG.MAX_STEPS) {
        game.update(RF.CONFIG.STEP);
        acc -= RF.CONFIG.STEP;
        steps++;
      }
      if (steps >= RF.CONFIG.MAX_STEPS) acc = 0; // avoid the spiral of death

      renderer.draw(game, dt);
      RF.UI.sync(game);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.RF);
