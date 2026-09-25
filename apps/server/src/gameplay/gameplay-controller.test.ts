import { describe, expect, it } from 'vitest';
import { GAMEPLAY, distanceSquared3d, type GameplayEvent } from '@ice-water/shared';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { GameplayController } from './gameplay-controller.js';

function fixture() {
  const state = new LobbyState();
  state.phase = 'playing';
  state.phaseDeadline = 300_000;
  const ice = new PlayerState();
  const water = new PlayerState();
  Object.assign(ice, { playerId: 'ice', team: 'ice', x: 0, y: 0, z: 0, protectedUntil: 0 });
  Object.assign(water, { playerId: 'water', team: 'water', x: 0, y: 0, z: -0.29, protectedUntil: 0 });
  state.players.set(ice.playerId, ice);
  state.players.set(water.playerId, water);
  const events: GameplayEvent[] = [];
  const controller = new GameplayController(state, (event) => events.push(event));
  controller.start(1_000);
  Object.assign(ice, { x: 0, y: 0, z: 0, protectedUntil: 0 });
  Object.assign(water, { x: 0, y: 0, z: -0.29, protectedUntil: 0 });
  return { state, ice, water, controller, events };
}

describe('authoritative proximity interactions', () => {
  it('freezes a Water player when Ice interacts within 1 metre', () => {
    const { ice, water, controller, events } = fixture();

    expect(controller.handle(ice.playerId, 'action/interact', {}, 2_000)).toBeNull();
    expect(water.status).toBe('frozen');
    expect(water.velocityZ).toBeLessThan(0);
    expect(water.verticalVelocity).toBe(GAMEPLAY.freezeKnockbackVerticalSpeed);
    controller.advance(2_050);
    expect(water.y).toBeGreaterThan(0);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'player/frozen',
        payload: { playerId: 'water', attackerId: 'ice', serverTime: 2_000 },
      }),
    );
  });

  it('does not freeze a Water player beyond the interaction range', () => {
    const { ice, water, controller } = fixture();
    water.z = -(GAMEPLAY.interactionRange + 0.01);

    expect(controller.handle(ice.playerId, 'action/interact', {}, 2_000)).toBeNull();
    expect(water.status).toBe('alive');
  });

  it('unfreezes a frozen Water teammate with the same proximity interaction', () => {
    const { state, water, controller, events } = fixture();
    water.status = 'frozen';
    water.y = 3.5;
    state.players.delete('ice');
    const rescuer = new PlayerState();
    Object.assign(rescuer, { playerId: 'rescuer', team: 'water', x: 0, y: 3.5, z: 0 });
    state.players.set(rescuer.playerId, rescuer);
    expect(rescuer.team).toBe('water');
    expect(rescuer.status).toBe('alive');
    expect(distanceSquared3d(rescuer, water)).toBeLessThanOrEqual(GAMEPLAY.interactionRange ** 2);

    expect(controller.handle(rescuer.playerId, 'action/interact', {}, 3_000)).toBeNull();
    expect(water.status).toBe('alive');
    expect(water.isGrounded).toBe(false);
    expect(water.velocityZ).toBeLessThan(0);
    expect(water.verticalVelocity).toBe(GAMEPLAY.freezeKnockbackVerticalSpeed);
    expect(water.protectedUntil).toBe(3_000 + GAMEPLAY.freezeProtectionMs);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'player/rescued',
        payload: expect.objectContaining({ playerId: 'water', rescuerIds: ['rescuer'] }),
      }),
    );
  });

  it('lets Ice lunge forward with reduced steering and clears momentum at expiry', () => {
    const { ice, water, controller } = fixture();
    ice.yaw = 0;

    expect(controller.handle(ice.playerId, 'action/lunge', {}, 2_000)).toBeNull();
    expect(ice.lungeUntil).toBe(2_000 + GAMEPLAY.lungeDurationMs);
    expect(ice.lungeReadyAt).toBe(2_000 + GAMEPLAY.lungeCooldownMs);
    expect(ice.velocityZ).toBeLessThan(-GAMEPLAY.moveSpeed);
    expect(ice.verticalVelocity).toBe(GAMEPLAY.lungeVerticalSpeed);
    expect(controller.handle(ice.playerId, 'action/interact', {}, 2_000)).toBeNull();
    expect(water.status).toBe('frozen');
    expect(controller.handle(ice.playerId, 'action/lunge', {}, 2_100)).toBeNull();

    controller.advance(2_600);
    expect(ice.lungeUntil).toBe(0);
    expect(ice.velocityX).toBe(0);
    expect(ice.velocityZ).toBe(0);
    expect(ice.verticalVelocity).toBe(0);
    expect(controller.handle(ice.playerId, 'action/lunge', {}, 2_600)).toBeNull();
  });

  it('lets Water lunge and silently ignores lunge requests during cooldown', () => {
    const { water, controller } = fixture();

    expect(controller.handle(water.playerId, 'action/lunge', {}, 2_000)).toBeNull();
    expect(water.lungeUntil).toBe(2_000 + GAMEPLAY.lungeDurationMs);
    expect(controller.handle(water.playerId, 'action/lunge', {}, 2_100)).toBeNull();
  });
});
