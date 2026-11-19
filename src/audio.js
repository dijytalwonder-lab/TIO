// ---------------------------------------------------------------------------
// Procedural "ASMR" audio. No asset files - everything is synthesised:
//  * hammer = layered thump (sub + body + crisp click + whack)
//  * shatter = fracture crack + a granular shower of tinkling shards (modal rings per material)
//  * fragments bounce with pitch by size, level by speed, panned to where they land
//  * soft reverb tail, a gentle slow-motion muffle, bubble-pop counter, marimba music
// ---------------------------------------------------------------------------

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const PENT = [0, 2, 4, 7, 9];

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.lastBounce = -1;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNote = 0;
    this.musicMode = 'menu';
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this._init(new AC());
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn && !this.musicTimer) this.startMusic(this.musicMode);
  }

  /** Build the graph on any (Offline)AudioContext. */
  _init(ctx) {
    this.ctx = ctx;
    const c = ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.14;
    this.master.connect(comp); comp.connect(c.destination);

    // small, soft room
    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(1.35);
    this.wet = c.createGain(); this.wet.gain.value = 0.6;
    this.verb.connect(this.wet); this.wet.connect(this.master);

    // sfx bus -> lowpass (slow-mo muffle) -> master (+ reverb send)
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.Q.value = 0.4;
    this.sfx = c.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0;
    this.send = c.createGain(); this.send.gain.value = 0.3;
    this.sfx.connect(this.lp); this.lp.connect(this.master); this.lp.connect(this.send); this.send.connect(this.verb);

    this.music = c.createGain(); this.music.gain.value = this.musicOn ? 0.2 : 0;
    this.mlp = c.createBiquadFilter(); this.mlp.type = 'lowpass'; this.mlp.frequency.value = 2800;
    this.music.connect(this.mlp); this.mlp.connect(this.master); this.mlp.connect(this.send);

    const len = Math.floor(c.sampleRate * 1.2);
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.panPool = [-0.55, 0, 0.55].map((p) => this._panner(p));
  }

  _impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += ((Math.random() * 2 - 1) - lp) * (0.4 - 0.33 * t);   // gets darker as it decays
        d[i] = lp * Math.pow(1 - t, 3.4) * 1.1;
      }
      for (const e of [0.011, 0.023, 0.037, 0.051]) d[Math.floor(e * c.sampleRate + ch * 40)] += (Math.random() - 0.5) * 0.7;
    }
    return b;
  }

  setSfx(on) { this.sfxOn = on; if (this.sfx) this.sfx.gain.value = on ? 1 : 0; }
  setMusic(on) {
    this.musicOn = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.1);
    if (on && this.ctx) this.startMusic(this.musicMode); else this.stopMusic();
  }

  get ok() { return this.ctx && this.sfxOn; }

  // --- primitives ----------------------------------------------------------
  _panner(p) {
    const c = this.ctx;
    if (!c.createStereoPanner) return this.sfx;
    const n = c.createStereoPanner();
    n.pan.value = clamp(p, -1, 1);
    n.connect(this.sfx);
    return n;
  }
  _dest(pan) { return !pan ? this.sfx : this._panner(pan); }

  _tone(freq, dur, type = 'sine', gain = 0.3, when = 0, slideTo = null, dest = null, att = 0.003) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.03);
  }

  _noise(dur, type, freq, q, gain, when = 0, slideTo = null, dest = null) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = rand(0.85, 1.25);
    const f = c.createBiquadFilter(); f.type = type;
    f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  /** A struck "ring": sine with a 1 ms attack and exponential decay (modal synthesis partial). */
  _ring(freq, dur, gain, when, dest) { this._tone(freq, dur, 'sine', gain, when, null, dest, 0.001); }

  /**
   * One tiny shard sound. size01 0=tiny..1=big (small = higher pitch), vel01 = loudness.
   * Each material uses its own set of resonant modes.
   */
  _grain(mat, size01, vel01, when, dest) {
    const pitch = lerp(1.55, 0.78, size01);
    const g = 0.035 + 0.13 * vel01;
    switch (mat) {
      case 'glass': {
        const f = rand(3000, 6800) * pitch * 0.85;
        this._ring(f, lerp(0.28, 0.6, size01), g, when, dest);
        this._ring(f * 1.51, 0.3, g * 0.55, when, dest);
        this._ring(f * 2.37, 0.18, g * 0.35, when, dest);
        this._noise(0.012, 'highpass', 6500, 0.8, g * 0.9, when, null, dest);
        break;
      }
      case 'wood': {
        const f = rand(190, 420) * pitch;
        this._ring(f, 0.09, g * 1.9, when, dest);
        this._ring(f * 1.9, 0.06, g, when, dest);
        this._noise(0.035, 'bandpass', rand(800, 1600), 2.2, g * 1.6, when, null, dest);
        break;
      }
      case 'stone': {
        const f = rand(95, 210) * pitch;
        this._ring(f, 0.12, g * 2.2, when, dest);
        this._noise(0.07, 'lowpass', rand(900, 1700), 0.8, g * 2, when, null, dest);
        this._noise(0.012, 'highpass', 3500, 0.7, g * 0.6, when, null, dest);
        break;
      }
      case 'metal': {
        const f = rand(800, 1500) * pitch;
        this._ring(f, lerp(0.5, 1.0, size01), g * 0.8, when, dest);
        this._ring(f * 2.76, 0.55, g * 0.45, when, dest);
        this._ring(f * 5.4, 0.3, g * 0.25, when, dest);
        break;
      }
      case 'soft': {
        this._noise(0.07, 'lowpass', rand(450, 900), 0.6, g * 1.8, when, null, dest);
        break;
      }
      default: { // ceramic / terracotta: bright "tink" with a short tail
        const f = rand(1500, 2900) * pitch;
        this._ring(f, lerp(0.07, 0.17, size01), g, when, dest);
        this._ring(f * 1.83, 0.09, g * 0.5, when, dest);
        this._ring(f * 2.9, 0.05, g * 0.28, when, dest);
        this._noise(0.014, 'bandpass', rand(3200, 5200), 2, g * 1.1, when, null, dest);
      }
    }
  }

  // --- gameplay sounds -----------------------------------------------------
  whoosh(pan = 0) {
    if (!this.ok) return;
    this._noise(0.14, 'bandpass', 450, 1.1, 0.16, 0, 2400, this._dest(pan));
  }

  /** Heavy hammer: sub thump + body knock + crisp transient + whack. */
  hammer(P, pan = 0) {
    if (!this.ok) return;
    const d = this._dest(pan);
    const k = clamp(0.5 + P * 0.25, 0.5, 1.3);
    this._tone(98, 0.34, 'sine', 0.95 * k, 0, 36, d);
    this._tone(190, 0.16, 'triangle', 0.5 * k, 0, 68, d);
    this._noise(0.012, 'highpass', 2600, 0.7, 0.55 * k, 0, null, d);
    this._noise(0.07, 'bandpass', 760, 1.1, 0.42 * k, 0, null, d);
    if (P >= 2.6) {
      this._tone(62, 0.85, 'sine', 0.9, 0.005, 24, d);
      this._noise(0.55, 'lowpass', 1500, 0.7, 0.38, 0.005, 140, d);
    }
  }

  /** Break: fracture crack, then a granular shower of shards that thins out. */
  shatter(mat, n, crit, pan = 0) {
    if (!this.ok) return;
    const m = mat === 'terracotta' ? 'ceramic' : mat;
    const d = this._dest(pan);
    this._noise(0.03, 'highpass', 1800, 0.7, 0.5, 0.004, null, d);
    this._noise(0.1, 'bandpass', 5200, 1.2, 0.26, 0.004, 1300, d);
    if (m !== 'glass') this._tone(rand(250, 430), 0.08, 'triangle', 0.24, 0.004, 110, d);
    else this._ring(rand(5200, 7200), 0.35, 0.12, 0.006, d);
    const grains = Math.min(34, 7 + Math.floor(n * 0.7));
    const span = 0.26 + Math.min(0.9, n * 0.013);
    for (let i = 0; i < grains; i++) {
      const u = i / grains;
      const when = 0.02 + span * Math.pow(u, 1.75) + rand(0, 0.012);
      const dest = this.panPool[(Math.random() * 3) | 0];
      this._grain(m, Math.random(), clamp(1 - u * 0.62 + rand(-0.12, 0.12), 0.12, 1), when, pan ? this._panner(pan + rand(-0.45, 0.45)) : dest);
    }
    if (crit) this.sparkle();
  }

  /** Cracks that did not break the shard (no fragments): a short "krrk-tk". */
  crackle(mat, P, pan = 0) {
    if (!this.ok) return;
    const m = mat === 'terracotta' ? 'ceramic' : mat;
    const d = this._dest(pan);
    const clicks = 3 + Math.floor(P);
    for (let i = 0; i < clicks; i++) {
      const t = 0.004 + i * rand(0.025, 0.045);
      this._noise(0.02, 'bandpass', rand(2300, 3800) * (1 + i * 0.1), 2.6, 0.24, t, null, d);
      if (i % 2 === 0) this._grain(m, rand(0.3, 0.9), 0.35, t, d);
    }
    this._tone(rand(210, 300), 0.06, 'triangle', 0.14, 0, 110, d);
  }

  sparkle() {
    if (!this.ok) return;
    const base = 1046;
    for (let i = 0; i < 5; i++) {
      const f = base * Math.pow(2, PENT[i] / 12);
      this._ring(f, 0.7, 0.085, 0.04 + i * 0.055, this.panPool[i % 3]);
      this._ring(f * 2, 0.35, 0.03, 0.04 + i * 0.055, this.panPool[(i + 1) % 3]);
    }
    this._noise(0.6, 'highpass', 7000, 0.6, 0.06, 0.03, null, null);
  }

  /** A fragment hits the floor. size = fragment radius, pan from its screen x. */
  bounce(mat, speed, size = 0.2, pan = 0, when = 0) {
    if (!this.ok) return;
    const now = this.ctx.currentTime + when;
    if (now - this.lastBounce < 0.018) return;
    this.lastBounce = now;
    const m = mat === 'terracotta' ? 'ceramic' : mat;
    this._grain(m, clamp((size - 0.05) / 0.4, 0, 1), clamp(speed / 9, 0.1, 1) * 0.8, when, this._dest(pan));
  }

  split(mat, size = 0.2, pan = 0) {
    if (!this.ok) return;
    const m = mat === 'terracotta' ? 'ceramic' : mat;
    const d = this._dest(pan);
    this._noise(0.025, 'bandpass', rand(2000, 3600), 2.4, 0.2, 0, null, d);
    this._grain(m, clamp((size - 0.05) / 0.4, 0, 1), 0.55, 0.01, d);
  }

  /** Slow-motion: highs duck for a moment and bloom back as time resumes. */
  slowMo(dur) {
    if (!this.ctx) return;
    const f = this.lp.frequency, t = this.ctx.currentTime;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(2500, f.value), t);
    f.exponentialRampToValueAtTime(3600, t + 0.05);
    f.setValueAtTime(3600, t + dur * 0.45);
    f.exponentialRampToValueAtTime(20000, t + dur * 1.1);
  }

  // --- UI sounds -------------------------------------------------------------
  click() { if (this.ok) { this._tone(520, 0.05, 'sine', 0.16, 0, 900); this._noise(0.01, 'highpass', 4000, 0.7, 0.1); } }
  /** Soft typewriter blip for dialogue text. */
  blip(i) { if (this.ok) this._tone(480 + (i % 4) * 55, 0.04, 'triangle', 0.045); }
  tick(urgent) { if (this.ok) this._tone(urgent ? 1180 : 820, 0.06, 'triangle', 0.08); }
  coin() { if (this.ok) { this._ring(1318, 0.35, 0.12, 0); this._ring(1976, 0.45, 0.1, 0.07); this._ring(2637, 0.3, 0.04, 0.07); } }
  pop() { if (this.ok) { this._tone(300, 0.16, 'sine', 0.3, 0, 90); this._noise(0.04, 'lowpass', 900, 0.7, 0.2); } }

  /** Soft bubble-pop for the rolling fragment counter. i climbs a pentatonic scale. */
  countPop(i) {
    if (!this.ok) return;
    const k = i % 15;
    const f = 523.25 * Math.pow(2, (PENT[k % 5] + 12 * Math.floor(k / 5)) / 12);
    this._tone(f, 0.075, 'sine', 0.085, 0, f * 1.55, null, 0.002);
    this._ring(f * 2, 0.06, 0.025, 0);
  }

  win() {
    if (!this.ok) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this._ring(f, 0.9, 0.16, i * 0.09, null);
      this._ring(f * 4, 0.18, 0.04, i * 0.09, null);
      this._tone(f / 2, 0.5, 'triangle', 0.08, i * 0.09, null, null, 0.01);
    });
    this._noise(0.6, 'highpass', 6500, 0.6, 0.06, 0.12);
  }

  fail() {
    if (!this.ok) return;
    this._tone(330, 0.55, 'sine', 0.2, 0, 165, null, 0.01);
    this._tone(262, 0.65, 'sine', 0.18, 0.16, 131, null, 0.01);
  }

  star(i) { if (this.ok) { const f = 784 * Math.pow(1.26, i); this._ring(f, 0.7, 0.18, 0); this._ring(f * 2, 0.4, 0.06, 0); } }

  // --- music ---------------------------------------------------------------
  startMusic(mode = 'menu') {
    this.musicMode = mode;
    if (!this.ctx || !this.musicOn) return;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = setInterval(() => this._schedule(), 120);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  _schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const zen = this.musicMode === 'zen';
    const bpm = this.musicMode === 'game' ? 112 : zen ? 66 : 96;
    const step = 60 / bpm / 2;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const roots = [261.63, 220.0, 174.61, 196.0];
    const chance = zen ? 0.42 : 0.72;
    while (this.nextNote < c.currentTime + 0.35) {
      const s = this.musicStep++;
      const bar = Math.floor(s / 8) % 4;
      const root = roots[bar];
      const t = this.nextNote - c.currentTime;
      if (s % 8 === 0) {
        this._tone(root / 2, step * (zen ? 7 : 3.5), 'triangle', zen ? 0.4 : 0.5, t, null, this.music, zen ? 0.25 : 0.003);
        if (zen) this._tone(root * 1.5, step * 7, 'sine', 0.22, t, null, this.music, 0.4);
      }
      if (!zen && s % 4 === 2) this._tone((root / 2) * 1.5, step * 1.6, 'triangle', 0.3, t, null, this.music);
      if (Math.random() < chance) {
        const deg = scale[Math.floor(Math.random() * scale.length)];
        const f = root * Math.pow(2, deg / 12);
        this._tone(f, step * (zen ? 3 : 1.5), 'sine', 0.5, t, null, this.music, 0.002);
        this._tone(f * 2, step * 0.7, 'sine', 0.12, t, null, this.music, 0.002);
      }
      this.nextNote += step;
    }
  }
}
