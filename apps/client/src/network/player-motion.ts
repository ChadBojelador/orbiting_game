import {
  ARENA,
  GAMEPLAY,
  advanceVerticalMotion,
  moveKinematic,
  terrainHeightAt,
  type MoveInput,
  type PlayerView,
  type Position,
} from '@ice-water/shared';

export class LocalPrediction {
  position: Position = { x: 0, z: 0 };
  y = terrainHeightAt(this.position);
  verticalVelocity = 0;
  isGrounded = true;
  yaw = 0;
  private pending: MoveInput[] = [];
  private sequence = 0;

  reconcile(player: PlayerView, canMove: boolean): void {
    this.sequence = Math.max(this.sequence, player.inputSequence);
    this.pending = canMove
      ? this.pending.filter((input) => input.sequence > player.inputSequence)
      : [];
    this.position = { x: player.x, z: player.z };
    this.y = player.y;
    this.verticalVelocity = player.verticalVelocity;
    this.isGrounded = player.isGrounded;
    this.yaw = player.yaw;
    for (const input of this.pending) this.apply(input);
  }
  predict(axes: Position, canMove: boolean, wantsJump = false): MoveInput {
    const input = { ...axes, sequence: ++this.sequence, jump: wantsJump };
    // Stop speculative travel on a stalled connection rather than growing without bound.
    if (canMove && this.pending.length < 10) {
      this.pending.push(input);
      this.apply(input);
    }
    return input;
  }
  reset(): void {
    this.pending = [];
  }
  private apply(input: MoveInput): void {
    this.position = moveKinematic(this.position, input, GAMEPLAY.tickMs / 1000);
    const vertical = advanceVerticalMotion(
      this,
      this.position,
      GAMEPLAY.tickMs / 1000,
      input.jump === true,
    );
    this.y = vertical.y;
    this.verticalVelocity = vertical.verticalVelocity;
    this.isGrounded = vertical.isGrounded;
    if (input.x || input.z) this.yaw = Math.atan2(input.x, input.z);
  }
}

interface MotionSample extends Position {
  y: number;
  verticalVelocity: number;
  isGrounded: boolean;
  yaw: number;
  time: number;
}

export interface PresentationMotion extends Position {
  y: number;
  yaw: number;
}

const LOCAL_PRESENTATION_DAMPING = 24;
const SNAP_DISTANCE = 5;

function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Keeps the rendered local player and follow camera continuous while the
 * deterministic prediction target advances at the server's fixed tick rate.
 */
export class LocalPresentation {
  private current?: PresentationMotion;

  update(target: PresentationMotion, seconds: number, shouldSnap = false): PresentationMotion {
    const distance = this.current
      ? Math.hypot(target.x - this.current.x, target.y - this.current.y, target.z - this.current.z)
      : Number.POSITIVE_INFINITY;

    if (!this.current || shouldSnap || distance > SNAP_DISTANCE) {
      this.current = { ...target };
      return { ...this.current };
    }

    const alpha = 1 - Math.exp(-LOCAL_PRESENTATION_DAMPING * Math.max(0, seconds));
    this.current.x += (target.x - this.current.x) * alpha;
    this.current.y += (target.y - this.current.y) * alpha;
    this.current.z += (target.z - this.current.z) * alpha;
    this.current.yaw += shortestTurn(this.current.yaw, target.yaw) * alpha;

    return { ...this.current };
  }

  reset(): void {
    this.current = undefined;
  }
}

export class RemoteInterpolation {
  private samples: MotionSample[] = [];
  push(player: PlayerView, time: number): void {
    const previous = this.samples.at(-1);
    if (previous && time <= previous.time) return;
    const next = {
      x: player.x,
      y: player.y,
      z: player.z,
      verticalVelocity: player.verticalVelocity,
      isGrounded: player.isGrounded,
      yaw: player.yaw,
      time,
    };
    if (
      player.status !== 'active' ||
      (previous && Math.hypot(previous.x - player.x, previous.z - player.z) > 5)
    )
      this.samples = [];
    this.samples.push(next);
    if (this.samples.length > 10) this.samples.shift();
  }
  at(time: number, halfExtent: number = ARENA.halfExtent): MotionSample | undefined {
    if (!this.samples.length) return undefined;
    const latest = this.samples.at(-1)!;
    for (let index = 1; index < this.samples.length; index++) {
      const b = this.samples[index]!;
      if (b.time < time) continue;
      const a = this.samples[index - 1]!;
      const alpha = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
      const turn = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
      return {
        x: a.x + (b.x - a.x) * alpha,
        y: a.y + (b.y - a.y) * alpha,
        z: a.z + (b.z - a.z) * alpha,
        verticalVelocity: a.verticalVelocity + (b.verticalVelocity - a.verticalVelocity) * alpha,
        isGrounded: alpha < 0.5 ? a.isGrounded : b.isGrounded,
        yaw: a.yaw + turn * alpha,
        time,
      };
    }

    const previous = this.samples.at(-2);
    if (previous && time > latest.time) {
      const sampleDuration = latest.time - previous.time;
      const extrapolationDuration = Math.min(time - latest.time, GAMEPLAY.interpolationMs);
      if (sampleDuration > 0 && sampleDuration <= GAMEPLAY.interpolationMs * 2) {
        const seconds = extrapolationDuration / 1000;
        const velocityX = ((latest.x - previous.x) / sampleDuration) * 1000;
        const velocityZ = ((latest.z - previous.z) / sampleDuration) * 1000;
        const speed = Math.hypot(velocityX, velocityZ);
        const speedScale = Math.min(1, speed / GAMEPLAY.moveSpeed);
        const yawRate = shortestTurn(previous.yaw, latest.yaw) / sampleDuration;
        const extrapolated = moveKinematic(
          latest,
          { x: velocityX, z: velocityZ },
          seconds * speedScale,
          halfExtent,
        );

        const vertical = advanceVerticalMotion(latest, extrapolated, seconds, false);
        return {
          ...extrapolated,
          ...vertical,
          yaw: latest.yaw + yawRate * extrapolationDuration,
          time,
        };
      }
    }

    return { ...latest };
  }
}
