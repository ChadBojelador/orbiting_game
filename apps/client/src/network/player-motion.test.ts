import type { PlayerView } from '@ice-water/shared';
import { describe, expect, it } from 'vitest';
import { LocalPrediction, LocalPresentation, RemoteInterpolation } from './player-motion.js';

function player(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    playerId: 'remote',
    displayName: 'Remote',
    team: 'water',
    status: 'active',
    x: 0,
    z: 8,
    yaw: 0,
    inputSequence: 0,
    isConnected: true,
    reconnectDeadline: 0,
    protectedUntil: 0,
    y: 0,
    verticalVelocity: 0,
    isGrounded: true,
    frostReadyAt: 0,
    helpPingUntil: 0,
    helpPingReadyAt: 0,
    rescueProgress: 0,
    rescuingTarget: '',
    tags: 0,
    rescues: 0,
    ...overrides,
  };
}

describe('LocalPresentation', () => {
  it('smooths fixed-tick movement using frame-rate-independent damping', () => {
    const fastFrames = new LocalPresentation();
    const slowFrames = new LocalPresentation();
    const start = { x: 0, y: 0, z: 0, yaw: 0 };
    const target = { x: 0.3, y: 0.2, z: 0, yaw: Math.PI / 2 };

    fastFrames.update(start, 0);
    slowFrames.update(start, 0);
    for (let frame = 0; frame < 3; frame += 1) fastFrames.update(target, 1 / 60);
    const slow = slowFrames.update(target, 1 / 20);
    const fast = fastFrames.update(target, 0);

    expect(fast.x).toBeCloseTo(slow.x, 5);
    expect(fast.y).toBeCloseTo(slow.y, 5);
    expect(fast.yaw).toBeCloseTo(slow.yaw, 5);
    expect(fast.x).toBeGreaterThan(0);
    expect(fast.x).toBeLessThan(target.x);
  });

  it('snaps teleports and explicit authoritative stops', () => {
    const presentation = new LocalPresentation();
    presentation.update({ x: 0, y: 0, z: 0, yaw: 0 }, 0);

    expect(presentation.update({ x: 8, y: 2, z: 0, yaw: Math.PI }, 1 / 60)).toEqual({
      x: 8,
      y: 2,
      z: 0,
      yaw: Math.PI,
    });
    expect(presentation.update({ x: 8.2, y: 0, z: 0, yaw: 0 }, 1 / 60, true)).toEqual({
      x: 8.2,
      y: 0,
      z: 0,
      yaw: 0,
    });
  });
});

describe('RemoteInterpolation', () => {
  it('interpolates buffered movement and briefly extrapolates a late packet', () => {
    const motion = new RemoteInterpolation();
    motion.push(player(), 1_000);
    motion.push(player({ x: 0.3, yaw: Math.PI / 4 }), 1_050);

    expect(motion.at(1_025)?.x).toBeCloseTo(0.15);
    expect(motion.at(1_075)?.x).toBeCloseTo(0.45);
    expect(motion.at(1_300)?.x).toBeCloseTo(0.9);
  });

  it('does not extrapolate a frozen player', () => {
    const motion = new RemoteInterpolation();
    motion.push(player(), 1_000);
    motion.push(player({ x: 0.3, status: 'frozen' }), 1_050);

    expect(motion.at(1_100)?.x).toBe(0.3);
  });

  it('predicts a jump and reconciles its authoritative vertical state', () => {
    const prediction = new LocalPrediction();
    prediction.reconcile(player(), true);
    prediction.predict({ x: 0, z: 0 }, true, true);

    expect(prediction.y).toBeGreaterThan(0);
    expect(prediction.verticalVelocity).toBeGreaterThan(0);
    expect(prediction.isGrounded).toBe(false);

    prediction.reconcile(player({ y: 0.3, verticalVelocity: 5, isGrounded: false }), true);
    expect(prediction.y).toBeGreaterThan(0.3);
  });
});
