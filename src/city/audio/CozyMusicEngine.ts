/**
 * Procedural Web Audio API cozy ambient town soundtrack.
 * Uses soft low-pass filtered electric-piano / warm pad chords (Fmaj7 - Em7 - Dm9 - Cmaj7)
 * and delicate pentatonic bell plucks with zero external network assets.
 */
class CozyMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timerId: number | null = null;
  private isPlaying = false;
  private volume = 0.28;
  private stepIndex = 0;

  private readonly chords: number[][] = [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [164.81, 196.0, 246.94, 293.66], // Em7
    [146.83, 220.0, 261.63, 329.63], // Dm9
    [130.81, 196.0, 246.94, 329.63], // Cmaj7
  ];

  private readonly melodyNotes = [523.25, 587.33, 659.25, 783.99, 880.0, 659.25, 587.33, 523.25];

  public getPlaying(): boolean {
    return this.isPlaying;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(next: number): void {
    this.volume = Math.max(0, Math.min(1, next));
    if (this.ctx && this.masterGain && this.isPlaying) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.08);
    }
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  public start(): void {
    if (this.isPlaying || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.0001;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1150;
      filter.Q.value = 0.6;
      filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.filterNode = filter;
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.isPlaying = true;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.4);
    }

    this.tick();
    this.timerId = window.setInterval(() => this.tick(), 2100);
  }

  private filterNode: BiquadFilterNode | null = null;

  private tick(): void {
    if (!this.ctx || !this.filterNode || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    const chord = this.chords[this.stepIndex % this.chords.length];

    // Warm pad / Rhodes chord
    chord.forEach((freq, idx) => {
      this.playTone(freq, now + idx * 0.04, 2.25, 0.06, 'triangle');
    });

    // Gentle acoustic bell note
    const mFreq = this.melodyNotes[(this.stepIndex * 2) % this.melodyNotes.length];
    this.playTone(mFreq, now + 0.55, 1.35, 0.035, 'sine');
    if (this.stepIndex % 2 === 0) {
      const m2 = this.melodyNotes[(this.stepIndex * 2 + 3) % this.melodyNotes.length];
      this.playTone(m2, now + 1.35, 1.15, 0.028, 'sine');
    }

    this.stepIndex++;
  }

  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    type: OscillatorType,
  ): void {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.14);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(env);
    env.connect(this.filterNode);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    }
  }
}

export const cozyMusicEngine = new CozyMusicEngine();
