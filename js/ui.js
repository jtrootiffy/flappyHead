/* =========================================================================
 * ui.js — all DOM/HTML overlay concerns: screens, buttons, HUD text,
 * mute + CRT toggles and stage scaling. The canvas never touches the DOM.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const UI = {
    els: {},
    onPrimary: null,
    lastState: null,
    lastScore: -1,
    lastBest: -1,
    _ro: null,

    init(options) {
      const byId = (id) => document.getElementById(id);
      this.els = {
        stage: byId("stage"),
        menu: byId("screen-menu"),
        ready: byId("screen-ready"),
        over: byId("screen-over"),
        btnStart: byId("btn-start"),
        btnRetry: byId("btn-retry"),
        btnSound: byId("btn-sound"),
        btnCrt: byId("btn-crt"),
        menuBest: byId("menu-best"),
        overScore: byId("over-score"),
        overBest: byId("over-best"),
        overNewBest: byId("over-new-best"),
        flyers: byId("flyers"),
        flyerName: byId("flyer-name"),
        liveRegion: byId("live-region")
      };

      this.onPrimary = options.onPrimary;

      this.bindButton(this.els.btnStart, () => this.onPrimary("start-button"));
      this.bindButton(this.els.btnRetry, () => this.onPrimary("retry-button"));
      this.bindButton(this.els.btnSound, (e, btn) => this.toggleSound(btn));
      this.bindButton(this.els.btnCrt, (e, btn) => this.toggleCrt(btn));

      // Restore persisted mute / CRT preferences.
      const muted = RF.Storage.read(RF.Storage.MUTE_KEY, "0") === "1";
      RF.Sound.setMuted(muted);
      this.paintSoundButton(this.els.btnSound, muted);

      const crt = RF.Storage.read(RF.Storage.CRT_KEY, "1") !== "0";
      this.setCrt(crt);
      this.paintCrtButton(this.els.btnCrt, crt);

      this.buildFlyers();
      this.lastHead = RF.Heads.selected;

      this.observeSize();
      this.showMenu();
    },

    /* ------------------------------- flyers ------------------------------ */
    buildFlyers() {
      const wrap = this.els.flyers;
      if (!wrap) return;
      wrap.innerHTML = "";
      RF.Heads.list.forEach((head, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "flyer";
        btn.setAttribute("aria-label", "Fly as " + head.name);
        btn.setAttribute("aria-pressed", "false");
        const img = document.createElement("img");
        img.src = head.src;
        img.alt = "";
        img.draggable = false;
        btn.appendChild(img);
        this.bindButton(btn, () => RF.Heads.select(i));
        wrap.appendChild(btn);
      });
      this.paintFlyers(false);
    },

    paintFlyers(announce) {
      const wrap = this.els.flyers;
      if (!wrap) return;
      const on = RF.Heads.selected;
      for (let i = 0; i < wrap.children.length; i++) {
        const selected = i === on;
        wrap.children[i].setAttribute("aria-pressed", selected ? "true" : "false");
        wrap.children[i].classList.toggle("is-selected", selected);
      }
      if (this.els.flyerName) this.els.flyerName.textContent = RF.Heads.name();
      if (announce !== false) {
        RF.Sound.select();
        if (this._game) this.announce(this._game);
      }
    },

    /* ------------------------------- buttons ----------------------------- */
    bindButton(btn, handler) {
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Drop focus so Space/Enter keep working as a flap afterwards.
        btn.blur();
        handler(e, btn);
      });
    },

    toggleSound(btn) {
      const muted = RF.Sound.setMuted(!RF.Sound.isMuted());
      this.paintSoundButton(btn, muted);
      if (!muted) RF.Sound.flap(); // audible confirmation
    },

    paintSoundButton(btn, muted) {
      if (!btn) return;
      btn.setAttribute("aria-pressed", muted ? "false" : "true");
      btn.setAttribute("aria-label", muted ? "Sound off. Click to unmute." : "Sound on. Click to mute.");
      btn.title = muted ? "Sound: off" : "Sound: on";
      btn.classList.toggle("is-off", muted);
      const on = btn.querySelector(".ico-on");
      const off = btn.querySelector(".ico-off");
      if (on) on.hidden = muted;
      if (off) off.hidden = !muted;
    },

    toggleCrt(btn) {
      const next = !this.els.stage.classList.contains("crt-on");
      this.setCrt(next);
      this.paintCrtButton(btn, next);
    },

    setCrt(on) {
      this.els.stage.classList.toggle("crt-on", !!on);
      RF.Storage.write(RF.Storage.CRT_KEY, on ? "1" : "0");
    },

    paintCrtButton(btn, on) {
      if (!btn) return;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "CRT effect on. Click to disable." : "CRT effect off. Click to enable.");
      btn.title = on ? "CRT effect: on" : "CRT effect: off";
      btn.classList.toggle("is-off", !on);
    },

    /* ------------------------------- screens ----------------------------- */
    show(el) {
      this.els.menu.hidden = el !== "menu";
      this.els.ready.hidden = el !== "ready";
      this.els.over.hidden = el !== "over";
    },

    showMenu() {
      this.show("menu");
    },

    /* -------------------------------- sync ------------------------------- */
    /** Called every frame; only touches the DOM when something changed. */
    sync(game) {
      this._game = game;
      if (game.state !== this.lastState) {
        this.applyState(game.state);
        if (game.state === "over") this.paintGameOver(game);
        if (game.state === "menu") this.paintMenu(game);
        this.announce(game);
      }
      if (RF.Heads.selected !== this.lastHead) {
        this.lastHead = RF.Heads.selected;
        this.paintFlyers(true);
      }
      if (game.score !== this.lastScore) {
        this.lastScore = game.score;
        if (this.els.overScore) this.els.overScore.textContent = String(game.score);
      }
      if (game.best !== this.lastBest) {
        this.lastBest = game.best;
        if (this.els.menuBest) this.els.menuBest.textContent = String(game.best);
        if (this.els.overBest) this.els.overBest.textContent = String(game.best);
      }
    },

    paintMenu(game) {
      if (this.els.menuBest) {
        this.els.menuBest.textContent = String(game.best);
      }
    },

    paintGameOver(game) {
      if (this.els.overScore) this.els.overScore.textContent = String(game.score);
      if (this.els.overBest) this.els.overBest.textContent = String(game.best);
      if (this.els.overNewBest) this.els.overNewBest.hidden = !game.newBest;
    },

    announce(game) {
      if (!this.els.liveRegion) return;
      if (game.state === "over") {
        this.els.liveRegion.textContent =
          "Game over. Score " + game.score + ". Best " + game.best + ".";
      } else if (game.state === "ready") {
        this.els.liveRegion.textContent =
          "Choose your flyer. " +
          RF.Heads.name() +
          " selected. Press space to flap.";
      }
    },

    /* -------------------------------- sizing ----------------------------- */
    observeSize() {
      const stage = this.els.stage;
      const apply = () => {
        const w = this.els.stage.clientWidth || 288;
        this.els.stage.style.setProperty("--u", w / 288 + "px");
      };
      apply();
      if (typeof ResizeObserver !== "undefined") {
        this._ro = new ResizeObserver(apply);
        this._ro.observe(this.els.stage);
      } else {
        window.addEventListener("resize", apply);
      }
    }
  };

  /* Screen switching + HUD text kept in one place. */
  UI.applyState = function (state) {
    if (state === "menu") UI.show("menu");
    else if (state === "ready") UI.show("ready");
    else if (state === "over") UI.show("over");
    else UI.show("none");
    UI.lastState = state;
  };

  RF.UI = UI;
})(window.RF);
