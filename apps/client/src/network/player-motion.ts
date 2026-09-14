import {
  GAMEPLAY,
  simulateMovement,
  type MapId,
  type MoveInput,
  type PlayerView,
  type Position,
  type MovementState,
} from '@ice-water/shared';
const initial = (): MovementState => ({
  x: 0,
  y: 0,
  z: 0,
  velocityX: 0,
  velocityZ: 0,
  verticalVelocity: 0,
  isGrounded: true,
  isSliding: false,
  isCrouching: false,
  slideUntil: 0,
  slideReadyAt: 0,
});
export class LocalPrediction {
  motion = initial();
  yaw = 0;
  mapId: MapId = 'frostline';
  private pending: { input: MoveInput; now: number; speed: number }[] = [];
  private sequence = 0;
  private generation = -1;
  get position(): Position {
    return this.motion;
  }
  get y(): number {
    return this.motion.y;
  }
  reconcile(player: PlayerView, canMove: boolean): void {
    this.sequence = Math.max(this.sequence, player.inputSequence);
    if (player.spawnGeneration !== this.generation) {
      this.pending = [];
      this.generation = player.spawnGeneration;
    }
    this.pending = canMove
      ? this.pending.filter((p) => p.input.sequence > player.inputSequence)
      : [];
    this.motion = {
      x: player.x,
      y: player.y,
      z: player.z,
      velocityX: player.velocityX,
      velocityZ: player.velocityZ,
      verticalVelocity: player.verticalVelocity,
      isGrounded: player.isGrounded,
      isSliding: player.isSliding,
      isCrouching: player.isCrouching,
      slideUntil: player.slideUntil,
      slideReadyAt: player.slideReadyAt,
    };
    this.yaw = player.yaw;
    for (const p of this.pending)
      this.motion = simulateMovement(
        this.motion,
        p.input,
        p.now,
        GAMEPLAY.tickMs / 1000,
        p.speed,
        this.mapId,
      );
  }
  predict(input: Omit<MoveInput, 'sequence'>, canMove: boolean, now: number, speed = 1): MoveInput {
    const move = { ...input, sequence: ++this.sequence };
    if (canMove && this.pending.length < 10) {
      this.pending.push({ input: move, now, speed });
      this.motion = simulateMovement(
        this.motion,
        move,
        now,
        GAMEPLAY.tickMs / 1000,
        speed,
        this.mapId,
      );
    }
    return move;
  }
  reset(): void {
    this.pending = [];
  }
}
export interface PresentationMotion extends Position {
  y: number;
  yaw: number;
}
export class LocalPresentation {
  private current?: PresentationMotion;
  update(target: PresentationMotion, seconds: number, shouldSnap = false): PresentationMotion {
    if (
      !this.current ||
      shouldSnap ||
      Math.hypot(target.x - this.current.x, target.y - this.current.y, target.z - this.current.z) >
        5
    )
      this.current = { ...target };
    else {
      const alpha = 1 - Math.exp(-24 * seconds);
      this.current.x += (target.x - this.current.x) * alpha;
      this.current.y += (target.y - this.current.y) * alpha;
      this.current.z += (target.z - this.current.z) * alpha;
      this.current.yaw +=
        Math.atan2(
          Math.sin(target.yaw - this.current.yaw),
          Math.cos(target.yaw - this.current.yaw),
        ) * alpha;
    }
    return { ...this.current };
  }
  reset(): void {
    this.current = undefined;
  }
}
export class RemoteInterpolation {
  private samples: (PresentationMotion & { time: number; generation: number })[] = [];
  push(player: PlayerView, time: number): void {
    const previous = this.samples.at(-1);
    if (previous && time <= previous.time) return;
    if (previous?.generation !== player.spawnGeneration || player.status !== 'alive')
      this.samples = [];
    this.samples.push({
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: player.yaw,
      time,
      generation: player.spawnGeneration,
    });
    if (this.samples.length > 10) this.samples.shift();
  }
  at(time: number): PresentationMotion | undefined {
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1]!,
        b = this.samples[i]!;
      if (b.time < time) continue;
      const t = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        yaw: a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * t,
      };
    }
    return this.samples.at(-1);
  }
}
