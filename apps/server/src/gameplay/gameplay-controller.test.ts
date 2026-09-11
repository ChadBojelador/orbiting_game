import { beforeEach, describe, expect, it } from 'vitest';
import { GAMEPLAY, type GameplayEvent } from '@ice-water/shared';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { GameplayController } from './gameplay-controller.js';

const START = 10_000;

interface PlayerOptions {
  id: string;
  team: 'ice' | 'water';
  status?: 'active' | 'frozen' | 'eliminated' | 'spectator';
  x?: number;
  z?: number;
}

function addPlayer(state: LobbyState, options: PlayerOptions): PlayerState {
  const player = new PlayerState();
  player.playerId = options.id;
  player.team = options.team;
  player.status = options.status ?? 'active';
  player.isConnected = true;
  player.x = options.x ?? 0;
  player.z = options.z ?? 0;
  state.players.set(player.playerId, player);
  return player;
}

function makeFixture(options: PlayerOptions[]) {
  const state = new LobbyState();
  state.phase = 'regular';
  state.phaseDeadline = START + 60_000;
  const players = new Map<string, PlayerState>();
  for (const option of options) players.set(option.id, addPlayer(state, option));

  const events: GameplayEvent[] = [];
  const controller = new GameplayController(state, (event) => events.push(event));
  controller.startRound(START, state.arenaHalfExtent);

  // startRound owns spawning. Put players at the scenario positions afterward,
  // then run one fixed step so the controller's spatial grid sees them.
  for (const option of options) {
    const player = players.get(option.id)!;
    player.x = option.x ?? 0;
    player.z = option.z ?? 0;
    player.status = option.status ?? 'active';
  }
  const now = START + GAMEPLAY.tickMs;
  controller.advance(now);
  return { state, players, events, controller, now };
}

function advanceInTicks(controller: GameplayController, from: number, to: number): void {
  for (let now = from + GAMEPLAY.tickMs; now <= to; now += GAMEPLAY.tickMs) {
    controller.advance(now);
  }
}

describe('GameplayController', () => {
  describe('movement validation', () => {
    it('rejects malformed axes and stale or implausibly advanced sequences', () => {
      const { controller, now } = makeFixture([{ id: 'water', team: 'water' }]);

      expect(controller.handle('water', 'input/move', { x: 1.01, z: 0, sequence: 1 }, now)).toBe(
        'Invalid movement input',
      );
      expect(controller.handle('water', 'input/move', { x: 1, z: 0, sequence: 1 }, now)).toBeNull();
      expect(controller.handle('water', 'input/move', { x: 1, z: 0, sequence: 1 }, now)).toBe(
        'Stale or invalid input sequence',
      );
      expect(controller.handle('water', 'input/move', { x: 1, z: 0, sequence: 130 }, now)).toBe(
        'Stale or invalid input sequence',
      );
    });

    it('normalizes diagonal speed and clamps movement to the arena boundary', () => {
      const testHalfExtent = 18;
      const { controller, players, state, now } = makeFixture([
        { id: 'water', team: 'water', x: testHalfExtent - GAMEPLAY.playerRadius - 0.1 },
      ]);
      const player = players.get('water')!;
      state.arenaHalfExtent = testHalfExtent;

      expect(controller.handle('water', 'input/move', { x: 1, z: 1, sequence: 1 }, now)).toBeNull();
      controller.advance(now + GAMEPLAY.tickMs);

      expect(player.x).toBeCloseTo(testHalfExtent - GAMEPLAY.playerRadius, 5);
      expect(player.z).toBeCloseTo((GAMEPLAY.moveSpeed * GAMEPLAY.tickMs) / 1000 / Math.sqrt(2), 5);
      expect(player.inputSequence).toBe(1);
    });

    it('acknowledges but does not apply movement from a frozen player', () => {
      const { controller, players, now } = makeFixture([
        { id: 'water', team: 'water', status: 'frozen', x: 3, z: 4 },
      ]);
      const player = players.get('water')!;

      expect(controller.handle('water', 'input/move', { x: 1, z: 0, sequence: 1 }, now)).toBeNull();
      controller.advance(now + GAMEPLAY.tickMs);

      expect({ x: player.x, z: player.z }).toEqual({ x: 3, z: 4 });
      expect(player.inputSequence).toBe(1);
    });
  });

  describe('tag validation and cooldowns', () => {
    let fixture: ReturnType<typeof makeFixture>;

    beforeEach(() => {
      fixture = makeFixture([
        { id: 'ice', team: 'ice', x: 0, z: 0 },
        { id: 'water-a', team: 'water', x: GAMEPLAY.tagRange, z: 0 },
        { id: 'water-b', team: 'water', x: 0, z: GAMEPLAY.tagRange },
      ]);
    });

    it('accepts a target exactly at tag range and rejects one just beyond it', () => {
      const { controller, players, now } = fixture;

      expect(controller.handle('ice', 'action/tag', { targetId: 'water-a' }, now)).toBeNull();
      expect(players.get('water-a')!.status).toBe('frozen');

      const other = makeFixture([
        { id: 'ice', team: 'ice', x: 0, z: 0 },
        { id: 'water', team: 'water', x: GAMEPLAY.tagRange + 0.001, z: 0 },
      ]);
      expect(other.controller.handle('ice', 'action/tag', { targetId: 'water' }, other.now)).toBe(
        'Move closer to active Water',
      );
      expect(other.players.get('water')!.status).toBe('active');
    });

    it('rejects a nearby target when an arena block crosses line of sight', () => {
      const blocked = makeFixture([
        { id: 'ice', team: 'ice', x: 5.54, z: -9.3 },
        { id: 'water', team: 'water', x: 6.7, z: -10.46 },
      ]);

      expect(
        blocked.controller.handle('ice', 'action/tag', { targetId: 'water' }, blocked.now),
      ).toBe('Move closer to active Water');
      expect(blocked.players.get('water')!.status).toBe('active');
    });

    it('enforces the tag cooldown until, but not including, its deadline', () => {
      const { controller, players, now } = fixture;

      expect(controller.handle('ice', 'action/tag', { targetId: 'water-a' }, now)).toBeNull();
      const readyAt = now + GAMEPLAY.tagCooldownMs;
      expect(controller.handle('ice', 'action/tag', { targetId: 'water-b' }, readyAt - 1)).toBe(
        'Tag is cooling down',
      );
      expect(controller.handle('ice', 'action/tag', { targetId: 'water-b' }, readyAt)).toBeNull();
      expect(players.get('water-b')!.status).toBe('frozen');
      expect(players.get('ice')!.tags).toBe(2);
    });

    it('rejects a protected target before protection expires and accepts it at expiry', () => {
      const { controller, players, now } = fixture;
      const target = players.get('water-a')!;
      target.protectedUntil = now + GAMEPLAY.protectionMs;

      expect(
        controller.handle('ice', 'action/tag', { targetId: 'water-a' }, target.protectedUntil - 1),
      ).toBe('This player is protected');
      expect(
        controller.handle('ice', 'action/tag', { targetId: 'water-a' }, target.protectedUntil),
      ).toBeNull();
      expect(target.status).toBe('frozen');
    });
  });

  describe('rescue range, leases, and contributors', () => {
    it('accepts rescue at the exact range and rejects distance and line-of-sight violations', () => {
      const atRange = makeFixture([
        { id: 'rescuer', team: 'water', x: 0, z: 0 },
        { id: 'target', team: 'water', status: 'frozen', x: GAMEPLAY.rescueRange, z: 0 },
      ]);
      expect(
        atRange.controller.handle(
          'rescuer',
          'action/rescue-start',
          { targetId: 'target' },
          atRange.now,
        ),
      ).toBeNull();

      const tooFar = makeFixture([
        { id: 'rescuer', team: 'water', x: 0, z: 0 },
        { id: 'target', team: 'water', status: 'frozen', x: GAMEPLAY.rescueRange + 0.001, z: 0 },
      ]);
      expect(
        tooFar.controller.handle(
          'rescuer',
          'action/rescue-start',
          { targetId: 'target' },
          tooFar.now,
        ),
      ).toBe('Move closer to a frozen teammate');

      const blocked = makeFixture([
        { id: 'rescuer', team: 'water', x: 5.54, z: -9.3 },
        { id: 'target', team: 'water', status: 'frozen', x: 6.7, z: -10.46 },
      ]);
      expect(
        blocked.controller.handle(
          'rescuer',
          'action/rescue-start',
          { targetId: 'target' },
          blocked.now,
        ),
      ).toBe('Move closer to a frozen teammate');
    });

    it('expires an unrenewed rescue lease and resets its progress', () => {
      const { controller, players, now } = makeFixture([
        { id: 'rescuer', team: 'water', x: 0, z: 0 },
        { id: 'target', team: 'water', status: 'frozen', x: 1, z: 0 },
      ]);

      expect(
        controller.handle('rescuer', 'action/rescue-start', { targetId: 'target' }, now),
      ).toBeNull();
      advanceInTicks(controller, now, now + GAMEPLAY.rescueLeaseMs - GAMEPLAY.tickMs);
      expect(players.get('target')!.rescueProgress).toBeGreaterThan(0);

      controller.advance(now + GAMEPLAY.rescueLeaseMs);
      expect(players.get('target')!.rescueProgress).toBe(0);
      expect(players.get('rescuer')!.rescuingTarget).toBe('');
      expect(players.get('target')!.status).toBe('frozen');
    });

    it('tracks simultaneous rescuers on one shared hold and credits each contributor', () => {
      const { controller, players, events, now } = makeFixture([
        { id: 'rescuer-a', team: 'water', x: 0, z: 0 },
        { id: 'rescuer-b', team: 'water', x: 0, z: 1 },
        { id: 'target', team: 'water', status: 'frozen', x: 1, z: 0 },
      ]);

      for (const rescuer of ['rescuer-a', 'rescuer-b']) {
        expect(
          controller.handle(rescuer, 'action/rescue-start', { targetId: 'target' }, now),
        ).toBeNull();
      }
      for (
        let elapsed = GAMEPLAY.tickMs;
        elapsed <= GAMEPLAY.rescueMs;
        elapsed += GAMEPLAY.tickMs
      ) {
        const tickAt = now + elapsed;
        if (elapsed % 300 === 0) {
          for (const rescuer of ['rescuer-a', 'rescuer-b']) {
            expect(
              controller.handle(rescuer, 'action/rescue-start', { targetId: 'target' }, tickAt),
            ).toBeNull();
          }
        }
        controller.advance(tickAt);
      }

      expect(players.get('target')!.status).toBe('active');
      expect(players.get('target')!.protectedUntil).toBe(
        now + GAMEPLAY.rescueMs + GAMEPLAY.protectionMs,
      );
      expect(players.get('rescuer-a')!.rescues).toBe(1);
      expect(players.get('rescuer-b')!.rescues).toBe(1);
      expect(events.at(-1)).toEqual({
        type: 'player/rescued',
        payload: {
          playerId: 'target',
          by: ['rescuer-a', 'rescuer-b'],
          protectedUntil: now + GAMEPLAY.rescueMs + GAMEPLAY.protectionMs,
          serverTime: now + GAMEPLAY.rescueMs,
        },
      });
    });

    it('cancels rescue progress when the rescuer leaves range', () => {
      const { controller, players, now } = makeFixture([
        { id: 'rescuer', team: 'water', x: 0, z: 0 },
        { id: 'target', team: 'water', status: 'frozen', x: 1, z: 0 },
      ]);
      expect(
        controller.handle('rescuer', 'action/rescue-start', { targetId: 'target' }, now),
      ).toBeNull();
      controller.advance(now + GAMEPLAY.tickMs);
      expect(players.get('target')!.rescueProgress).toBeGreaterThan(0);

      players.get('rescuer')!.x = GAMEPLAY.rescueRange + 2;
      controller.advance(now + GAMEPLAY.tickMs * 2);

      expect(players.get('target')!.rescueProgress).toBe(0);
      expect(players.get('rescuer')!.rescuingTarget).toBe('');
    });

    it('rejects new rescue intent at the regular deadline and throughout Deep Freeze', () => {
      const { controller, state, now } = makeFixture([
        { id: 'rescuer', team: 'water', x: 0, z: 0 },
        { id: 'target', team: 'water', status: 'frozen', x: 1, z: 0 },
      ]);
      state.phaseDeadline = now + 100;

      expect(
        controller.handle('rescuer', 'action/rescue-start', { targetId: 'target' }, now + 99),
      ).toBeNull();
      expect(
        controller.handle('rescuer', 'action/rescue-start', { targetId: 'target' }, now + 100),
      ).toBe('Gameplay is unavailable in this phase');

      state.phase = 'deep-freeze';
      state.phaseDeadline = now + GAMEPLAY.deepFreezeMs;
      expect(
        controller.handle('rescuer', 'action/rescue-start', { targetId: 'target' }, now + 101),
      ).toBe('Rescue is locked');
    });
  });

  describe('post-rescue protection and help pings', () => {
    it('protects a rescued player for the exact configured interval', () => {
      const { controller, players, now } = makeFixture([
        { id: 'ice', team: 'ice', x: 0, z: 1 },
        { id: 'rescuer-a', team: 'water', x: 0, z: 0 },
        { id: 'rescuer-b', team: 'water', x: 1, z: 1 },
        { id: 'target', team: 'water', status: 'frozen', x: 1, z: 0 },
      ]);
      for (const id of ['rescuer-a', 'rescuer-b']) {
        controller.handle(id, 'action/rescue-start', { targetId: 'target' }, now);
      }
      for (
        let elapsed = GAMEPLAY.tickMs;
        elapsed <= GAMEPLAY.rescueMs;
        elapsed += GAMEPLAY.tickMs
      ) {
        const tickAt = now + elapsed;
        if (elapsed % 300 === 0) {
          for (const id of ['rescuer-a', 'rescuer-b']) {
            controller.handle(id, 'action/rescue-start', { targetId: 'target' }, tickAt);
          }
        }
        controller.advance(tickAt);
      }
      const target = players.get('target')!;
      expect(target.status).toBe('active');

      expect(
        controller.handle('ice', 'action/tag', { targetId: 'target' }, target.protectedUntil - 1),
      ).toBe('This player is protected');
      expect(
        controller.handle('ice', 'action/tag', { targetId: 'target' }, target.protectedUntil),
      ).toBeNull();
    });

    it('allows only frozen Water to ping and enforces the cooldown boundary', () => {
      const { controller, players, events, now } = makeFixture([
        { id: 'ice', team: 'ice' },
        { id: 'active-water', team: 'water' },
        { id: 'frozen-water', team: 'water', status: 'frozen' },
      ]);

      expect(controller.handle('ice', 'action/help-ping', {}, now)).toBe(
        'Only frozen Water can request help',
      );
      expect(controller.handle('active-water', 'action/help-ping', {}, now)).toBe(
        'Only frozen Water can request help',
      );
      expect(controller.handle('frozen-water', 'action/help-ping', {}, now)).toBeNull();
      expect(players.get('frozen-water')!.helpPingUntil).toBe(now + GAMEPLAY.helpDurationMs);
      expect(events.at(-1)).toEqual({
        type: 'player/help-ping',
        payload: {
          playerId: 'frozen-water',
          until: now + GAMEPLAY.helpDurationMs,
          serverTime: now,
        },
      });

      expect(
        controller.handle(
          'frozen-water',
          'action/help-ping',
          {},
          now + GAMEPLAY.helpCooldownMs - 1,
        ),
      ).toBe('Help ping is cooling down');
      expect(
        controller.handle('frozen-water', 'action/help-ping', {}, now + GAMEPLAY.helpCooldownMs),
      ).toBeNull();
    });
  });
});
