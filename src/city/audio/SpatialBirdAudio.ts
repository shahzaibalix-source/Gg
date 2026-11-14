export interface SpatialBirdEmitter {
  x: number;
  y: number;
  z: number;
  weight: number;
  zone: 'park' | 'square' | 'garden' | 'countryside';
}

type BirdSpecies = 'robin' | 'blackbird' | 'sparrow' | 'finch';

/**
 * Procedural Web Audio API 3D Spatial Bird Chirping Engine.
 * Uses true AudioListener + HRTF PannerNodes to localize realistic multi-species
 * songbird calls at exact tree and park coordinates with zero external audio assets.
 */
class SpatialBirdAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private enabled = true;
  private volume = 0.72;
  private gestureBound = false;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        next ? this.volume * 0.42 : 0.0001,
        this.ctx.currentTime,
        0.12,
      );
    }
    if (next) {
      this.unlock();
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.masterGain && this.enabled) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.42, this.ctx.currentTime, 0.08);
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.enabled ? this.volume * 0.42 : 0.0001;

      // Soft outdoor air absorption filter so chirps sound natural, never harsh
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 6200;
      this.filterNode.Q.value = 0.5;

      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /**
   * Unlocks / resumes AudioContext cleanly after a user gesture (required by browsers).
   */
  public unlock = (): void => {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Safe no-op if browser hasn't registered interaction yet
      });
    }
  };

  public bindGestureUnlock(): () => void {
    if (typeof window === 'undefined' || this.gestureBound) {
      return () => {};
    }
    this.gestureBound = true;
    const onGesture = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
        this.gestureBound = false;
      }
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      this.gestureBound = false;
    };
  }

  /**
   * Updates the Web Audio 3D AudioListener position and orientation.
   */
  public updateListener(
    posX: number,
    posY: number,
    posZ: number,
    fwdX: number,
    fwdY: number,
    fwdZ: number,
    upX: number,
    upY: number,
    upZ: number,
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const listener = this.ctx.listener;
    const t = this.ctx.currentTime;

    if (listener.positionX) {
      listener.positionX.setValueAtTime(posX, t);
      listener.positionY.setValueAtTime(posY, t);
      listener.positionZ.setValueAtTime(posZ, t);
      listener.forwardX.setValueAtTime(fwdX, t);
      listener.forwardY.setValueAtTime(fwdY, t);
      listener.forwardZ.setValueAtTime(fwdZ, t);
      listener.upX.setValueAtTime(upX, t);
      listener.upY.setValueAtTime(upY, t);
      listener.upZ.setValueAtTime(upZ, t);
    } else if ('setPosition' in listener) {
      (listener as AudioListener & { setPosition: (x: number, y: number, z: number) => void }).setPosition(
        posX,
        posY,
        posZ,
      );
      (
        listener as AudioListener & {
          setOrientation: (
            fx: number,
            fy: number,
            fz: number,
            ux: number,
            uy: number,
            uz: number,
          ) => void;
        }
      ).setOrientation(fwdX, fwdY, fwdZ, upX, upY, upZ);
    }
  }

  /**
   * Triggers a localized 3D spatial songbird phrase at world position (x, y, z).
   */
  public triggerChirpAt(
    x: number,
    y: number,
    z: number,
    gainScale = 1,
    refDistance = 11,
    maxDistance = 88,
  ): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.filterNode) return;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = 1.25;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    const now = ctx.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(x, now);
      panner.positionY.setValueAtTime(y, now);
      panner.positionZ.setValueAtTime(z, now);
    } else if ('setPosition' in panner) {
      (panner as PannerNode & { setPosition: (px: number, py: number, pz: number) => void }).setPosition(
        x,
        y,
        z,
      );
    }

    const phraseGain = ctx.createGain();
    phraseGain.gain.value = Math.max(0.05, Math.min(1.4, gainScale));
    phraseGain.connect(panner);
    panner.connect(this.filterNode);

    const speciesRoll = Math.random();
    const species: BirdSpecies =
      speciesRoll < 0.34
        ? 'robin'
        : speciesRoll < 0.64
          ? 'blackbird'
          : speciesRoll < 0.86
            ? 'sparrow'
            : 'finch';

    const pitchJitter = 0.9 + Math.random() * 0.22;
    let totalDuration = 0.65;

    if (species === 'robin') {
      this.scheduleSweepNote(ctx, phraseGain, now, 0.06, 2750 * pitchJitter, 4250 * pitchJitter, 0.14);
      this.scheduleSweepNote(
        ctx,
        phraseGain,
        now + 0.11,
        0.075,
        3050 * pitchJitter,
        4650 * pitchJitter,
        0.16,
      );
      if (Math.random() > 0.4) {
        this.scheduleSweepNote(
          ctx,
          phraseGain,
          now + 0.24,
          0.08,
          2900 * pitchJitter,
          4400 * pitchJitter,
          0.11,
        );
      }
      totalDuration = 0.48;
    } else if (species === 'blackbird') {
      // Smooth flute-like melodic warble with vibrato
      this.scheduleWarbleNote(ctx, phraseGain, now, 0.14, 1820 * pitchJitter, 2240 * pitchJitter, 0.16);
      this.scheduleWarbleNote(
        ctx,
        phraseGain,
        now + 0.17,
        0.16,
        2150 * pitchJitter,
        1960 * pitchJitter,
        0.15,
      );
      this.scheduleWarbleNote(
        ctx,
        phraseGain,
        now + 0.37,
        0.19,
        1980 * pitchJitter,
        2480 * pitchJitter,
        0.13,
      );
      totalDuration = 0.72;
    } else if (species === 'sparrow') {
      // Crisp 3-to-4 peep staccato trill
      const count = Math.random() > 0.45 ? 4 : 3;
      for (let i = 0; i < count; i++) {
        const start = now + i * 0.082;
        const base = (3350 + (i % 2) * 280) * pitchJitter;
        this.scheduleSweepNote(ctx, phraseGain, start, 0.045, base, base * 1.18, 0.13);
      }
      totalDuration = 0.48;
    } else {
      // Soft descending finch whistle
      this.scheduleSweepNote(ctx, phraseGain, now, 0.17, 2650 * pitchJitter, 1920 * pitchJitter, 0.14);
      this.scheduleSweepNote(
        ctx,
        phraseGain,
        now + 0.22,
        0.14,
        2420 * pitchJitter,
        1820 * pitchJitter,
        0.1,
      );
      totalDuration = 0.52;
    }

    // Automatic node cleanup after phrase ends
    window.setTimeout(() => {
      phraseGain.disconnect();
      panner.disconnect();
    }, Math.ceil((totalDuration + 0.2) * 1000));
  }

  private scheduleSweepNote(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    duration: number,
    fStart: number,
    fEnd: number,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(400, fEnd), startTime + duration);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.015, duration * 0.22));
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(env);
    env.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private scheduleWarbleNote(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    duration: number,
    fStart: number,
    fEnd: number,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const env = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(fStart, startTime);
    osc.frequency.linearRampToValueAtTime(fEnd, startTime + duration);

    lfo.type = 'sine';
    lfo.frequency.value = 24;
    lfoGain.gain.value = 55;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(env);
    env.connect(dest);
    lfo.start(startTime);
    osc.start(startTime);
    lfo.stop(startTime + duration + 0.02);
    osc.stop(startTime + duration + 0.02);
  }
}

export const spatialBirdAudio = new SpatialBirdAudioEngine();
