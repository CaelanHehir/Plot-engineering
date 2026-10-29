/**
 * Web Audio API Sound Effects Synthesizer
 * 
 * Generates dynamic, responsive 8-bit / cartoon audio cues directly in the browser
 * without needing external audio asset files or downloads.
 */

class SoundManager {
  constructor() {
    /** Persisted sound toggle state */
    this.muted = localStorage.getItem('plot_engineering_muted') === 'true';
    /** @type {AudioContext|null} */
    this.ctx = null;
  }

  /**
   * Lazily initializes the browser AudioContext upon first user interaction
   * to comply with browser autoplay security policies.
   */
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Toggles sound on or off and persists preference in localStorage.
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('plot_engineering_muted', String(this.muted));
    return this.muted;
  }

  /**
   * Plays a synthesized frequency tone using an OscillatorNode and GainNode.
   * 
   * @param {number} freq - Tone frequency in Hz
   * @param {'sine'|'triangle'|'sawtooth'|'square'} type - Waveform type
   * @param {number} duration - Tone length in seconds
   * @param {number} delay - Delay before playing in seconds
   * @param {number} vol - Peak volume level
   */
  playTone(freq, type = 'sine', duration = 0.15, delay = 0, vol = 0.15) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime + delay);
      // Exponential volume decay for clean release without audio clicking
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch (e) {
      // Audio context might be restricted or unsupported on older browsers
    }
  }

  /** Friendly two-tone chime when a player joins the room */
  join() {
    this.playTone(440, 'triangle', 0.12, 0);
    this.playTone(587.33, 'triangle', 0.18, 0.1);
  }

  /** Satisfying confirmation chime when locking in a character or action */
  lockIn() {
    this.playTone(523.25, 'sine', 0.1, 0);
    this.playTone(659.25, 'sine', 0.14, 0.08);
  }

  /** Transition chime when revealing a new screen or story phase */
  stepReveal() {
    this.playTone(392, 'triangle', 0.12, 0);
    this.playTone(523.25, 'triangle', 0.2, 0.1);
  }

  /** Subtle randomized typewriter blip as words appear in the narration */
  wordTick() {
    this.playTone(580 + Math.random() * 120, 'sine', 0.03, 0, 0.025);
  }

  /** Triumphant major-arpeggio fanfare for "Flying Colors" round pass */
  verdictFlyingColors() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.playTone(f, 'triangle', 0.28, i * 0.08, 0.22);
    });
  }

  /** Wobbly, narrow interval chime for "Barely Passed" outcome */
  verdictBarely() {
    [440, 466.16, 523.25, 587.33].forEach((f, i) => {
      this.playTone(f, 'sine', 0.24, i * 0.12, 0.18);
    });
  }

  /** Comedic descending buzzer for failed scenario / game over */
  verdictFail() {
    [349.23, 329.63, 311.13, 261.63].forEach((f, i) => {
      this.playTone(f, 'sawtooth', 0.3, i * 0.14, 0.14);
    });
  }
}

/** Global sound synthesizer instance */
const sfx = new SoundManager();

/** Synchronizes the mute button text and icon with the active sound state */
function updateMuteButton() {
  const btn = document.getElementById('btn-mute');
  if (btn) {
    btn.textContent = sfx.muted ? '🔇 Muted' : '🔊 Sound On';
  }
}

/** Toggles sound effects and updates the UI button */
function toggleSound() {
  sfx.toggleMute();
  updateMuteButton();
}
