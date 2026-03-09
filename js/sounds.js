/**
 * sounds.js – Web Audio API sound effects for MentalMath
 *
 * All sounds are generated programmatically via the Web Audio API,
 * so no external audio files are needed.
 */

'use strict';

class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.enabled = true;
    this._init();
  }

  // ── Initialise AudioContext on first use ───────────────────
  _init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (_) {
      this.ctx = null;
    }
  }

  /** Resume a suspended context (required after a user gesture on some browsers). */
  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Play a simple oscillator tone.
   * @param {number}  freq     – frequency in Hz
   * @param {number}  duration – duration in seconds
   * @param {OscillatorType} type   – oscillator waveform
   * @param {number}  volume   – gain 0–1
   * @param {number}  [delay]  – offset from now in seconds
   */
  _tone(freq, duration, type = 'sine', volume = 0.28, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    try {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);

      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime  + delay + duration);
    } catch (_) { /* silently ignore audio errors */ }
  }

  // ── Public sound effects ────────────────────────────────────

  /** Short click when a keypad button is pressed. */
  playClick() {
    this._tone(900, 0.04, 'square', 0.15);
  }

  /** Two-note chime for a correct answer. */
  playCorrect() {
    this._tone(523, 0.1, 'sine', 0.3);       // C5
    this._tone(784, 0.15, 'sine', 0.3, 0.1); // G5
  }

  /** Descending buzz for a wrong answer. */
  playWrong() {
    this._tone(320, 0.08,  'sawtooth', 0.2);
    this._tone(200, 0.18, 'sawtooth', 0.2, 0.08);
  }

  /** Ascending fanfare when a streak milestone is hit. */
  playStreak() {
    const freqs = [523, 659, 784, 1047]; // C5 E5 G5 C6
    freqs.forEach((f, i) => this._tone(f, 0.14, 'sine', 0.3, i * 0.08));
  }

  /** Descending game-over jingle. */
  playGameOver() {
    [440, 370, 311, 261].forEach((f, i) => this._tone(f, 0.2, 'sawtooth', 0.22, i * 0.16));
  }

  /** Single tick used for the countdown. */
  playCountdown() {
    this._tone(440, 0.14, 'sine', 0.3);
  }

  /** Higher-pitched "GO!" sound at the end of the countdown. */
  playCountdownGo() {
    this._tone(880, 0.2, 'sine', 0.4);
  }

  /** Celebratory scale for a new high score. */
  playNewHighScore() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this._tone(f, 0.12, 'sine', 0.35, i * 0.07)
    );
  }

  /** Short upward glide for level-up. */
  playLevelUp() {
    [440, 554, 659, 880].forEach((f, i) =>
      this._tone(f, 0.1, 'sine', 0.28, i * 0.06)
    );
  }

  /**
   * Toggle sound on/off.
   * @param {boolean} [val] – explicit state; toggles if omitted
   * @returns {boolean} new enabled state
   */
  toggle(val) {
    this.enabled = (val !== undefined) ? val : !this.enabled;
    return this.enabled;
  }
}
