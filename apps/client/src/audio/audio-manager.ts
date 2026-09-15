import type { SpatialPosition } from '@ice-water/shared';
export type SoundCue =
  | 'shot'
  | 'reload'
  | 'empty'
  | 'hit'
  | 'headshot'
  | 'kill'
  | 'metal'
  | 'ice'
  | 'water'
  | 'slide'
  | 'jump'
  | 'land';
export class AudioManager {
  private context?: AudioContext;
  private gain?: GainNode;
  volume = 0.35;
  unlock(): void {
    this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    void this.context.resume().catch(() => {});
  }
  listener(position: SpatialPosition, yaw: number): void {
    const l = this.context?.listener;
    if (!l) return;
    l.positionX.value = position.x;
    l.positionY.value = position.y;
    l.positionZ.value = position.z;
    l.forwardX.value = -Math.sin(yaw);
    l.forwardY.value = 0;
    l.forwardZ.value = -Math.cos(yaw);
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
    if (this.gain) this.gain.gain.value = this.volume;
  }
  play(cue: SoundCue, position?: SpatialPosition): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.gain || this.volume <= 0) return;
    const frequency: Record<SoundCue, number> = {
      shot: 100,
      reload: 340,
      empty: 180,
      hit: 720,
      headshot: 1200,
      kill: 980,
      metal: 160,
      ice: 480,
      water: 85,
      slide: 120,
      jump: 330,
      land: 90,
    };
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = cue === 'shot' ? 'sawtooth' : cue === 'water' ? 'triangle' : 'sine';
    const now = context.currentTime,
      duration = cue === 'slide' ? 0.22 : cue === 'kill' ? 0.2 : 0.085;
    oscillator.frequency.setValueAtTime(frequency[cue], now);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency[cue] * (cue === 'kill' ? 1.6 : 0.35),
      now + duration,
    );
    gain.gain.setValueAtTime(cue === 'shot' ? 0.16 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    let panner: PannerNode | undefined;
    if (position) {
      panner = context.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 3;
      panner.maxDistance = 65;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      gain.connect(panner);
      panner.connect(this.gain);
    } else gain.connect(this.gain);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
  destroy(): void {
    void this.context?.close().catch(() => {});
  }
}
