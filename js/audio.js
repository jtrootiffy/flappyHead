/* =========================================================================
 * audio.js — tiny 8-bit style synth built on the Web Audio API.
 * No asset files: every sound is generated from oscillators / noise.
 * The AudioContext is only created after the first user gesture.
 * ========================================================================= */
(function (RF) {
  "use strict";

  const Sound = {
    ctx: null,
    master: null,
    noiseBuffer: null,
    muted: false,
    _unlocked: false,

    /** Called from a real user gesture. Safe to call repeatedly. */
    unlock() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
      } catch (e) {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // Pre-render one second of white noise for percussive hits.
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;

      this._unlocked = true;
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    },

    isMuted() {
      return this.muted;
    },

    setMuted(muted) {
      this.muted = !!muted;
      if (this.master) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, t, 0.01);
      }
      RF.Storage.write(RF.Storage.MUTE_KEY, this.muted ? "1" : "0");
      return this.muted;
    },

    /** One oscillator blip with optional pitch sweep. */
    _tone(opts) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + (opts.delay || 0);
      const dur = opts.dur || 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = opts.type || "square";
      osc.frequency.setValueAtTime(opts.freq, t0);
      if (opts.freq2 && opts.freq2 !== opts.freq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, opts.freq2),
          t0 + dur
        );
      }

      const peak = opts.gain === undefined ? 0.25 : opts.gain;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },

    /** Filtered noise burst (impact / dust). */
    _noise(opts) {
      if (!this.ctx || this.muted || !this.noiseBuffer) return;
      const t0 = this.ctx.currentTime + (opts.delay || 0);
      const dur = opts.dur || 0.2;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(opts.freq || 1400, t0);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(80, (opts.freq || 1400) * 0.25),
        t0 + dur
      );
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(opts.gain === undefined ? 0.3 : opts.gain, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },

    /* ----------------------- the sound effects ----------------------- */

    flap() {
      this._tone({ freq: 720, freq2: 980, dur: 0.075, gain: 0.16, type: "square" });
      this._tone({ freq: 360, freq2: 500, dur: 0.09, gain: 0.1, type: "triangle" });
    },

    select() {
      this._tone({ freq: 660, freq2: 1180, dur: 0.07, gain: 0.13, type: "square" });
    },

    score() {
      this._tone({ freq: 988, dur: 0.065, gain: 0.18, type: "square" });
      this._tone({ freq: 1319, dur: 0.11, gain: 0.16, type: "square", delay: 0.062 });
    },

    hit() {
      this._noise({ freq: 1800, dur: 0.18, gain: 0.35 });
      this._tone({ freq: 300, freq2: 90, dur: 0.18, gain: 0.2, type: "square" });
    },

    die() {
      const notes = [660, 520, 392, 262];
      for (let i = 0; i < notes.length; i++) {
        this._tone({
          freq: notes[i],
          freq2: notes[i] * 0.92,
          dur: 0.16,
          gain: 0.16,
          type: "square",
          delay: 0.1 + i * 0.1
        });
      }
    },

    swoosh() {
      this._noise({ freq: 900, dur: 0.18, gain: 0.14 });
    }
  };

  RF.Sound = Sound;
})(window.RF);
