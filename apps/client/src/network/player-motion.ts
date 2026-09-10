import { GAMEPLAY, moveKinematic, type MoveInput, type PlayerView, type Position } from '@ice-water/shared';

export class LocalPrediction {
  position: Position = { x: 0, z: 0 };
  yaw = 0;
  private pending: MoveInput[] = [];
  private sequence = 0;

  reconcile(player: PlayerView, canMove: boolean): void {
    this.sequence = Math.max(this.sequence, player.inputSequence);
    this.pending = canMove ? this.pending.filter(input => input.sequence > player.inputSequence) : [];
    this.position = { x: player.x, z: player.z };
    this.yaw = player.yaw;
    for (const input of this.pending) this.apply(input);
  }
  predict(axes: Position, canMove: boolean): MoveInput {
    const input = { ...axes, sequence: ++this.sequence };
    // Stop speculative travel on a stalled connection rather than growing without bound.
    if (canMove && this.pending.length < 10) { this.pending.push(input); this.apply(input); }
    return input;
  }
  reset(): void { this.pending = []; }
  private apply(input: MoveInput): void {
    this.position = moveKinematic(this.position, input, GAMEPLAY.tickMs / 1000);
    if (input.x || input.z) this.yaw = Math.atan2(input.x, input.z);
  }
}

interface MotionSample extends Position { yaw: number; time: number }
export class RemoteInterpolation {
  private samples: MotionSample[] = [];
  push(player: PlayerView, time: number): void {
    const previous = this.samples.at(-1);
    if (previous && time <= previous.time) return;
    const next = { x: player.x, z: player.z, yaw: player.yaw, time };
    if (player.status !== 'active' || (previous && Math.hypot(previous.x - player.x, previous.z - player.z) > 5)) this.samples = [];
    this.samples.push(next);
    if (this.samples.length > 10) this.samples.shift();
  }
  at(time: number): MotionSample | undefined {
    if (!this.samples.length) return undefined;
    const latest = this.samples.at(-1)!;
    for (let index = 1; index < this.samples.length; index++) {
      const b = this.samples[index]!;
      if (b.time < time) continue;
      const a = this.samples[index - 1]!;
      const alpha = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
      const turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
      return { x: a.x + (b.x - a.x) * alpha, z: a.z + (b.z - a.z) * alpha, yaw: a.yaw + turn * alpha, time };
    }
    return { ...latest };
  }
}
