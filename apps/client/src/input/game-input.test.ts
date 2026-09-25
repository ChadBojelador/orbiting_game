import { expect, it } from 'vitest';
import { GameInput, cameraRelative, touchAxes } from './game-input.js';
it('normalizes keyboard/touch axes and maps movement to camera forward', () => {
  expect(Math.hypot(...Object.values(cameraRelative({ x: 1, z: 1 }, 0)))).toBeCloseTo(1);
  expect(cameraRelative({ x: 0, z: -1 }, Math.PI / 2).x).toBeCloseTo(-1);
  expect(touchAxes(1, 1, 45)).toEqual({ x: 0, z: 0 });
  expect(touchAxes(90, 0, 45)).toEqual({ x: 1, z: 0 });
});
it('clamps mouse look and clears one-shot and held input on reset', () => {
  const input = new GameInput();
  input.look(100000, 100000);
  expect(Math.abs(input.cameraPitch)).toBeLessThan(Math.PI / 2);
  input.pressJump();
  input.pressSlide();
  input.pressInteract();
  input.pressLunge();
  input.pressInteract();
  expect(input.sample()).toMatchObject({ jump: true, slide: true, hasInteraction: true, hasLunge: true });
  expect(input.sample()).toMatchObject({ jump: false, slide: false, hasInteraction: false, hasLunge: false });
  input.reset();
  expect(input.sample().hasInteraction).toBe(false);
});
