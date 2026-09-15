import { describe, expect, it, vi } from 'vitest';
import { GAMEPLAY, WEAPONS, isSwimming, type GameplayEvent } from '@ice-water/shared';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { GameplayController } from './gameplay-controller.js';
import { fireHitscan } from './damage-system.js';
import { WeaponController } from './weapon-controller.js';
export function fixture() {
  const state = new LobbyState();
  state.phase = 'playing';
  state.phaseDeadline = 300000;
  const a = new PlayerState(),
    b = new PlayerState();
  a.playerId = 'a';
  b.playerId = 'b';
  a.team = b.team = 'none';
  state.players.set('a', a);
  state.players.set('b', b);
  const events: GameplayEvent[] = [];
  const controller = new GameplayController(state, (e) => events.push(e));
  controller.start(1000);
  Object.assign(a, { x: -50, y: 0, z: -30, protectedUntil: 0 });
  Object.assign(b, { x: -50, y: 0, z: -33, protectedUntil: 0 });
  return { state, a, b, controller, events };
}
describe('authoritative FPS combat', () => {
  it('uses nearest hit, headshots and cover instead of trusting a target ID', () => {
    const { state, a, b } = fixture();
    fireHitscan(
      state,
      a,
      { yaw: 0, pitch: 0 },
      2000,
      () => {},
      () => 0.5,
    );
    expect(b.hp).toBe(56);
    Object.assign(a, { x: 0, z: 8 });
    Object.assign(b, { x: 0, z: -8 });
    fireHitscan(
      state,
      a,
      { yaw: 0, pitch: 0 },
      2200,
      () => {},
      () => 0.5,
    );
    expect(b.hp).toBe(56);
  });
  it('blocks protected and friendly bodies without giving kill credit', () => {
    const { state, a, b } = fixture();
    b.protectedUntil = 3000;
    fireHitscan(
      state,
      a,
      { yaw: 0, pitch: 0 },
      2000,
      () => {},
      () => 0.5,
    );
    expect(b.hp).toBe(100);
    b.protectedUntil = 0;
    state.gameMode = 'tdm';
    a.team = b.team = 'ice';
    fireHitscan(
      state,
      a,
      { yaw: 0, pitch: 0 },
      2000,
      () => {},
      () => 0.5,
    );
    expect(b.hp).toBe(100);
    expect(a.kills).toBe(0);
  });
  it('scores death once, rejects dead actions, and restores loadout at the respawn deadline', () => {
    const { state, a, b, controller } = fixture();
    b.hp = 1;
    expect(controller.handle('a', 'action/shoot', { yaw: 0, pitch: 0 }, 2000)).toBeNull();
    expect(b.status).toBe('dead');
    expect(b.deaths).toBe(1);
    expect(a.kills).toBe(1);
    expect(controller.handle('b', 'action/shoot', { yaw: 0, pitch: 0 }, 2050)).toContain(
      'not alive',
    );
    controller.advance(b.respawnAt - 1);
    expect(b.status).toBe('dead');
    controller.advance(b.respawnAt + 50);
    expect(b.status).toBe('alive');
    expect(b.hp).toBe(100);
    expect(b.ammo).toBe(30);
    expect(b.protectedUntil).toBeGreaterThan(4500);
    expect(state.players.size).toBe(2);
  });
  it('does not respawn disconnected players or permit firing at the exact match deadline', () => {
    const { state, b, controller } = fixture();
    b.status = 'dead';
    b.respawnAt = 1500;
    b.isConnected = false;
    controller.advance(2000);
    expect(b.status).toBe('dead');
    expect(
      controller.handle('a', 'action/shoot', { yaw: 0, pitch: 0 }, state.phaseDeadline),
    ).toContain('phase');
  });
  it('limits movement to server time, rejects stale/flooded sequences and expires input', () => {
    const { a, controller } = fixture();
    const start = a.x;
    for (let i = 1; i <= 5; i++)
      expect(controller.handle('a', 'input/move', { x: 1, z: 0, sequence: i }, 1000)).toBeNull();
    controller.advance(1050);
    expect(a.x - start).toBeLessThanOrEqual(GAMEPLAY.moveSpeed * 0.05);
    expect(controller.handle('a', 'input/move', { x: 1, z: 0, sequence: 5 }, 1100)).toContain(
      'Stale',
    );
    controller.advance(1500);
    expect(a.inputSequence).toBe(5);
    let error: string | null = null;
    for (let i = 6; i <= 40; i++)
      error = controller.handle('a', 'input/move', { x: 0, z: 0, sequence: i }, 1500);
    expect(error).toContain('Too many');
  });
  it('applies Island buoyancy and swim-up input on the authoritative tick', () => {
    const { state, a, controller } = fixture();
    state.mapId = 'island';
    Object.assign(a, {
      x: 20,
      y: GAMEPLAY.waterSurfaceY,
      z: -54,
      verticalVelocity: 0,
      isGrounded: true,
    });
    for (let tick = 1; tick <= 40; tick++) controller.advance(1000 + tick * GAMEPLAY.tickMs);
    expect(a.y).toBeLessThan(-0.4);
    expect(a.isGrounded).toBe(false);
    expect(isSwimming(a, 'island')).toBe(true);

    const floatingY = a.y;
    for (let tick = 41; tick <= 55; tick++) {
      const now = 1000 + tick * GAMEPLAY.tickMs;
      expect(
        controller.handle('a', 'input/move', { x: 0, z: 0, jump: true, sequence: tick - 40 }, now),
      ).toBeNull();
      controller.advance(now);
    }
    expect(a.y).toBeGreaterThan(floatingY + 0.2);
    expect(a.y).toBeLessThanOrEqual(GAMEPLAY.waterSurfaceY);
  });
  it('enforces per-slot ammo, reload deadlines, cooldown across switching and protection removal', () => {
    const p = new PlayerState();
    p.playerId = 'p';
    p.protectedUntil = 9999;
    const weapons = new WeaponController();
    weapons.reset(p);
    expect(weapons.fire(p, 1000)).toBeNull();
    expect(p.ammo).toBe(29);
    expect(p.protectedUntil).toBe(0);
    weapons.switch(p, 1);
    expect(weapons.fire(p, 1001)).toContain('ready');
    weapons.switch(p, 0);
    expect(p.ammo).toBe(29);
    expect(weapons.reload(p, 1100)).toBeNull();
    weapons.tick(p, 3099);
    expect(p.ammo).toBe(29);
    weapons.tick(p, 3100);
    expect(p.ammo).toBe(30);
    expect(p.reserveAmmo).toBe(119);
    weapons.fire(p, 3200);
    weapons.reload(p, 3300);
    weapons.switch(p, 1);
    weapons.tick(p, 9999);
    weapons.switch(p, 0);
    expect(p.ammo).toBe(29);
  });
  it.each(['assault-rifle', 'smg', 'shotgun', 'sniper', 'pistol', 'ice-pick'] as const)(
    'supports %s stats with finite ammunition and configured fire intervals',
    (id) => {
      const { state, a, b } = fixture();
      a.weaponId = id;
      b.hp = 100;
      if (id === 'ice-pick') b.z = -31.5;
      const emit = vi.fn();
      fireHitscan(state, a, { yaw: 0, pitch: 0 }, 2000, emit, () => 0.5);
      expect(b.hp).toBeLessThan(100);
      expect(emit).toHaveBeenCalled();
      expect(WEAPONS[id].fireRateMs).toBeGreaterThan(0);
    },
  );
});
