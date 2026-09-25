import { Box3, PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import {
  FirstPersonHands,
  firstPersonHandAnimation,
  type FirstPersonHandMotion,
} from './first-person-hands.js';

const motion = (overrides: Partial<FirstPersonHandMotion> = {}): FirstPersonHandMotion => ({
  velocityX: 0,
  velocityZ: 0,
  verticalVelocity: 0,
  isGrounded: true,
  isSliding: false,
  isCrouching: false,
  isWallRunning: false,
  ...overrides,
});

describe('first-person hands', () => {
  it('selects movement poses from state and actual player speed', () => {
    expect(firstPersonHandAnimation(motion()).state).toBe('idle');
    const walking = firstPersonHandAnimation(motion({ velocityZ: 6 }));
    const running = firstPersonHandAnimation(motion({ velocityZ: 15 }));
    expect(walking.state).toBe('walk');
    expect(running.state).toBe('run');
    expect(running.cycleRate).toBeGreaterThan(walking.cycleRate);
    expect(running.amplitude).toBeGreaterThan(walking.amplitude);
    expect(
      firstPersonHandAnimation(motion({ isGrounded: false, verticalVelocity: 4, velocityZ: 8 }))
        .state,
    ).toBe('jump');
    expect(
      firstPersonHandAnimation(motion({ isGrounded: false, verticalVelocity: -4, velocityZ: 8 }))
        .state,
    ).toBe('fall');
    expect(
      firstPersonHandAnimation(motion({ isGrounded: false, isWallRunning: true, velocityZ: 12 }))
        .state,
    ).toBe('run');
    expect(firstPersonHandAnimation(motion({ isSliding: true, velocityZ: 16 })).state).toBe(
      'slide',
    );
  });

  it('builds gun-era-style block arms without fingers, weapons, or held items', () => {
    const camera = new PerspectiveCamera();
    const hands = new FirstPersonHands(camera);
    const root = camera.getObjectByName('first-person-hands');
    expect(root).toBeDefined();
    expect(root?.getObjectByName('left-forearm')).toMatchObject({
      geometry: { type: 'BoxGeometry' },
    });
    expect(root?.getObjectByName('right-forearm')).toMatchObject({
      geometry: { type: 'BoxGeometry' },
    });
    expect(root?.getObjectByName('left-hand')).toMatchObject({
      geometry: { type: 'BoxGeometry' },
    });
    expect(root?.getObjectByName('right-hand')).toMatchObject({
      geometry: { type: 'BoxGeometry' },
    });
    const leftArm = root?.getObjectByName('first-person-left-arm');
    const rightArm = root?.getObjectByName('first-person-right-arm');
    expect(rightArm!.position.x - leftArm!.position.x).toBeCloseTo(0.7);
    const partNames: string[] = [];
    root?.traverse((part) => partNames.push(part.name));
    expect(partNames.some((name) => /finger|thumb/i.test(name))).toBe(false);
    expect(partNames.some((name) => /weapon|gun|item|barrel|grip/i.test(name))).toBe(false);
    hands.destroy();
    expect(camera.getObjectByName('first-person-hands')).toBeUndefined();
  });

  it('blends into the slide brace instead of snapping', () => {
    const camera = new PerspectiveCamera();
    const hands = new FirstPersonHands(camera);
    const leftArm = camera.getObjectByName('first-person-left-arm');
    expect(leftArm).toBeDefined();
    const before = leftArm!.quaternion.clone();
    hands.update(motion({ isSliding: true, velocityZ: 16 }), 1 / 60);
    const firstFrameAngle = before.angleTo(leftArm!.quaternion);
    expect(firstFrameAngle).toBeGreaterThan(0);
    expect(firstFrameAngle).toBeLessThan(0.2);
    for (let index = 0; index < 60; index++)
      hands.update(motion({ isSliding: true, velocityZ: 16 }), 1 / 60);
    expect(before.angleTo(leftArm!.quaternion)).toBeGreaterThan(firstFrameAngle);
    hands.destroy();
  });

  it('keeps every movement pose below the crosshair and beyond the near plane', () => {
    const camera = new PerspectiveCamera(96, 1, 0.05, 320);
    const hands = new FirstPersonHands(camera);
    const root = camera.getObjectByName('first-person-hands');
    const poses = [
      motion(),
      motion({ velocityZ: 8 }),
      motion({ velocityZ: 15 }),
      motion({ isGrounded: false, verticalVelocity: 6 }),
      motion({ isGrounded: false, verticalVelocity: -6 }),
      motion({ isSliding: true, velocityZ: 16 }),
    ];
    for (const pose of poses) {
      for (let index = 0; index < 60; index++) hands.update(pose, 1 / 60);
      camera.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(root!);
      expect(bounds.max.y).toBeLessThan(0.1);
      expect(bounds.max.z).toBeLessThan(-camera.near);
    }
    hands.destroy();
  });
});
