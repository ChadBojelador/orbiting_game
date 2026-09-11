import { describe, expect, it } from 'vitest';
import { segmentAabbHit, ThirdPersonCamera, type CameraObstacle } from './third-person-camera.js';

const TALL_WALL: CameraObstacle = {
  minX: -2,
  maxX: 2,
  minY: 0,
  maxY: 10,
  minZ: 4,
  maxZ: 5,
};

describe('ThirdPersonCamera', () => {
  it('finds the first segment hit against a static obstacle', () => {
    expect(segmentAabbHit({ x: 0, y: 1, z: 0 }, { x: 0, y: 5, z: 10 }, TALL_WALL)).toBeCloseTo(0.4);
    expect(segmentAabbHit({ x: 3, y: 1, z: 0 }, { x: 3, y: 5, z: 10 }, TALL_WALL)).toBeUndefined();
  });

  it('limits vertical orbit and uses frame-rate-independent damping', () => {
    const fastFrames = new ThirdPersonCamera({ rotationDamping: 10 });
    const slowFrames = new ThirdPersonCamera({ rotationDamping: 10 });
    fastFrames.orbit(100, 10_000);
    slowFrames.orbit(100, 10_000);

    let fast = fastFrames.update({ x: 0, y: 1, z: 0 }, 0, []);
    for (let index = 0; index < 60; index++) {
      fast = fastFrames.update({ x: 0, y: 1, z: 0 }, 1 / 60, []);
    }
    const slow = slowFrames.update({ x: 0, y: 1, z: 0 }, 1, []);

    expect(fast.pitch).toBeLessThanOrEqual(Math.PI * 0.42);
    expect(fast.yaw).toBeCloseTo(slow.yaw, 8);
    expect(fast.pitch).toBeCloseTo(slow.pitch, 8);
  });

  it('pulls in when obstructed and smoothly restores its configured distance', () => {
    const camera = new ThirdPersonCamera({ returnDamping: 5 });
    const target = { x: 0, y: 1.2, z: 0 };
    const obstructed = camera.update(target, 0.1, [TALL_WALL]);
    const firstClear = camera.update(target, 0.1, []);
    const settled = camera.update(target, 2, []);

    expect(obstructed.distance).toBeLessThan(6);
    expect(firstClear.distance).toBeGreaterThan(obstructed.distance);
    expect(firstClear.distance).toBeLessThan(11.5);
    expect(settled.distance).toBeCloseTo(11.5, 3);
  });

  it('keeps the camera above the sampled terrain surface', () => {
    const camera = new ThirdPersonCamera();
    const pose = camera.update({ x: 0, y: 1, z: 0 }, 1, [], (_x, z) => (z > 4 ? 20 : 0));

    expect(pose.distance).toBeLessThan(6);
    expect(pose.position.y).toBeGreaterThanOrEqual(0.35);
  });
});
