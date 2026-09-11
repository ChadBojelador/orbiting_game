import { describe, expect, it } from 'vitest';
import { cameraRelative, smoothAxes, touchAxes } from './game-input.js';

describe('game input', () => {
  it('rotates movement relative to camera yaw', () => {
    const forward = cameraRelative({ x: 0, z: -1 }, Math.PI / 2);
    expect(forward.x).toBeCloseTo(-1);
    expect(forward.z).toBeCloseTo(0);
  });

  it('normalizes touch input and applies a center dead zone', () => {
    expect(touchAxes(2, 2, 100)).toEqual({ x: 0, z: 0 });
    expect(touchAxes(100, 100, 100)).toEqual({
      x: 1 / Math.sqrt(2),
      z: 1 / Math.sqrt(2),
    });
  });

  it('accelerates and decelerates movement without overshooting', () => {
    const accelerated = smoothAxes({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.05);
    const stopped = smoothAxes(accelerated, { x: 0, z: 0 }, 1);

    expect(accelerated).toEqual({ x: 0.45, z: 0 });
    expect(stopped).toEqual({ x: 0, z: 0 });
  });
});
