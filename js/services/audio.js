// Web Audio API Sound Effects Manager

class SoundManager {
  constructor() {
    this.muted = localStorage.getItem('chaos_coop_muted') === 'true';
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('chaos_coop_muted', String(this.muted));
    return this.muted;
  }

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
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch (e) {}
  }

  join() {
    this.playTone(440, 'triangle', 0.12, 0);
    this.playTone(587.33, 'triangle', 0.18, 0.1);
  }

  lockIn() {
    this.playTone(523.25, 'sine', 0.1, 0);
    this.playTone(659.25, 'sine', 0.14, 0.08);
  }

  stepReveal() {
    this.playTone(392, 'triangle', 0.12, 0);
    this.playTone(523.25, 'triangle', 0.2, 0.1);
  }

  wordTick() {
    this.playTone(580 + Math.random() * 120, 'sine', 0.03, 0, 0.025);
  }

  verdictFlyingColors() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.playTone(f, 'triangle', 0.28, i * 0.08, 0.22);
    });
  }

  verdictBarely() {
    [440, 466.16, 523.25, 587.33].forEach((f, i) => {
      this.playTone(f, 'sine', 0.24, i * 0.12, 0.18);
    });
  }

  verdictFail() {
    [349.23, 329.63, 311.13, 261.63].forEach((f, i) => {
      this.playTone(f, 'sawtooth', 0.3, i * 0.14, 0.14);
    });
  }
}

const sfx = new SoundManager();

function updateMuteButton() {
  const btn = document.getElementById('btn-mute');
  if (btn) {
    btn.textContent = sfx.muted ? '🔇 Muted' : '🔊 Sound On';
  }
}

function toggleSound() {
  sfx.toggleMute();
  updateMuteButton();
}
