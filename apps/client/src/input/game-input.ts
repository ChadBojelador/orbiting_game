import type { Position } from '@ice-water/shared';
export function cameraRelative(axes: Position, yaw: number): Position {
  const length = Math.max(1, Math.hypot(axes.x, axes.z)),
    x = axes.x / length,
    z = axes.z / length;
  return { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: z * Math.cos(yaw) - x * Math.sin(yaw) };
}
export function touchAxes(dx: number, dy: number, radius: number): Position {
  if (Math.hypot(dx, dy) < radius * 0.12) return { x: 0, z: 0 };
  const length = Math.max(radius, Math.hypot(dx, dy));
  return { x: dx / length, z: dy / length };
}
export class GameInput {
  cameraYaw = 0;
  cameraPitch = 0;
  sensitivity = 0.002;
  touch: Position = { x: 0, z: 0 };
  isFiring = false;
  isAds = false;
  isScoreboard = false;
  isEnabled = false;
  isTouchCrouching = false;
  isTouchSprinting = false;
  private keys = new Set<string>();
  private hasJump = false;
  private hasSlide = false;
  private hasReload = false;
  private hasShot = false;
  private slot: number | undefined;
  look(dx: number, dy: number): void {
    this.cameraYaw = Math.atan2(
      Math.sin(this.cameraYaw - dx * this.sensitivity),
      Math.cos(this.cameraYaw - dx * this.sensitivity),
    );
    this.cameraPitch = Math.max(
      (-Math.PI * 89) / 180,
      Math.min((Math.PI * 89) / 180, this.cameraPitch - dy * this.sensitivity),
    );
  }
  pressJump(): void {
    this.hasJump = true;
  }
  pressSlide(): void {
    this.hasSlide = true;
  }
  pressReload(): void {
    this.hasReload = true;
  }
  pressFire(): void {
    this.hasShot = true;
    this.isFiring = true;
  }
  switchWeapon(slot: number): void {
    this.slot = (slot + 3) % 3;
  }
  sample() {
    const axes = cameraRelative(
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
    const result = {
      ...axes,
      yaw: this.cameraYaw,
      pitch: this.cameraPitch,
      jump: this.hasJump,
      slide: this.hasSlide,
      crouch: this.keys.has('KeyC') || this.isTouchCrouching,
      sprint:
        this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.isTouchSprinting,
      hasShot: this.hasShot,
      isFiring: this.isFiring,
      isAds: this.isAds,
      hasReload: this.hasReload,
      slot: this.slot,
    };
    this.hasJump = false;
    this.hasSlide = false;
    this.hasReload = false;
    this.hasShot = false;
    this.slot = undefined;
    return result;
  }
  reset(): void {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.isFiring = false;
    this.isAds = false;
    this.isScoreboard = false;
    this.isTouchCrouching = false;
    this.isTouchSprinting = false;
    this.hasJump = false;
    this.hasSlide = false;
    this.hasReload = false;
    this.hasShot = false;
    this.slot = undefined;
  }
  bind(target: Window): () => void {
    const down = (event: KeyboardEvent) => {
      if (
        !this.isEnabled ||
        (event.target instanceof HTMLElement &&
          (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target.tagName) ||
            event.target.isContentEditable))
      )
        return;
      const codes = [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowLeft',
        'ArrowDown',
        'ArrowRight',
        'Space',
        'ShiftLeft',
        'ShiftRight',
        'ControlLeft',
        'ControlRight',
        'KeyC',
        'KeyR',
        'Tab',
        'Digit1',
        'Digit2',
        'Digit3',
      ];
      if (!codes.includes(event.code)) return;
      event.preventDefault();
      this.keys.add(event.code);
      if (event.code === 'Tab') this.isScoreboard = true;
      if (event.repeat) return;
      if (event.code === 'Space') this.pressJump();
      if (event.code.startsWith('Shift')) this.pressSlide();
      if (event.code === 'KeyR') this.pressReload();
      if (event.code.startsWith('Digit')) this.switchWeapon(Number(event.code.slice(-1)) - 1);
    };
    const up = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
      if (event.code === 'Tab') this.isScoreboard = false;
    };
    const reset = () => this.reset();
    target.addEventListener('keydown', down);
    target.addEventListener('keyup', up);
    target.addEventListener('blur', reset);
    target.document.addEventListener('visibilitychange', reset);
    return () => {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', reset);
      target.document.removeEventListener('visibilitychange', reset);
      this.reset();
    };
  }
}
