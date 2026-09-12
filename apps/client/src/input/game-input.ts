import { normalizeAxes, type Position } from '@ice-water/shared';

const INPUT_ACCELERATION = 9;
const INPUT_DECELERATION = 13;

export function cameraRelative(axes: Position, yaw: number): Position {
  const { x, z } = normalizeAxes(axes.x, axes.z);
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: z * Math.cos(yaw) - x * Math.sin(yaw) };
}

export function touchAxes(dx: number, dy: number, radius: number): Position {
  if (Math.hypot(dx, dy) < radius * 0.12) return { x: 0, z: 0 };
  return normalizeAxes(dx / radius, dy / radius);
}

export function smoothAxes(
  current: Position,
  target: Position,
  seconds: number,
  acceleration = INPUT_ACCELERATION,
  deceleration = INPUT_DECELERATION,
): Position {
  const targetLength = Math.hypot(target.x, target.z);
  const maxDelta = (targetLength > 0 ? acceleration : deceleration) * Math.max(0, seconds);
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= maxDelta || distance === 0) return { ...target };
  const scale = maxDelta / distance;
  return { x: current.x + dx * scale, z: current.z + dz * scale };
}

export class GameInput {
  cameraYaw = 0;
  touch: Position = { x: 0, z: 0 };
  isTouchRescuing = false;
  private readonly keys = new Set<string>();
  private movement: Position = { x: 0, z: 0 };
  private hasTag = false;
  private hasPing = false;
  private hasJump = false;

  pressTag(): void {
    this.hasTag = true;
  }
  pressPing(): void {
    this.hasPing = true;
  }
  pressJump(): void {
  this.hasJump = true;
}
  reset(): void {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.movement = { x: 0, z: 0 };
    this.isTouchRescuing = false;
    this.hasTag = false;
    this.hasPing = false;
    this.hasJump = false;
  }
  sample(seconds = 0): ReturnType<GameInput['createSample']> {
    const desired = cameraRelative(
      {
        x:
          Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
          Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) +
          this.touch.x,
        z:
          Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
          Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) +
          this.touch.z,
      },
      this.cameraYaw,
    );
    this.movement = smoothAxes(this.movement, desired, seconds);
    return this.createSample();
  }

  private createSample() {
    const sample = {
      ...this.movement,
      isRescuing: this.keys.has('KeyE') || this.isTouchRescuing,
      hasTag: this.hasTag,
      hasPing: this.hasPing,
      hasJump: this.hasJump,
    };
    this.hasTag = false;
    this.hasPing = false;
    this.hasJump = false;
    return sample;
  }

  bind(target: Window, onReset: () => void): () => void {
    const codes = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowLeft',
      'ArrowDown',
      'ArrowRight',
      'KeyE',
      'Space',
      'KeyH',
    ]);
    const down = (event: KeyboardEvent) => {
      if (!codes.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      )
        return;
      event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Space') this.pressJump();
      if (event.code === 'KeyH') this.pressPing();
    };
    const up = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
    };
    const reset = () => {
      this.reset();
      onReset();
    };
    const visibility = () => {
      if (target.document.hidden) reset();
    };
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', reset);
    target.document.addEventListener('visibilitychange', visibility);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', reset);
      target.document.removeEventListener('visibilitychange', visibility);
      reset();
    };
  }
}
