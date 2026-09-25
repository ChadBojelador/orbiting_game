import { expect, it } from 'vitest';
import { LobbyState, PlayerState } from './lobby-state.js';
import { LobbyController } from './lobby-controller.js';

function fixture(count: number) {
  const state = new LobbyState();
  for (let index = 0; index < count; index++) {
    const player = new PlayerState();
    player.playerId = String(index);
    state.players.set(player.playerId, player);
  }
  state.hostPlayerId = '0';
  return { state, controller: new LobbyController(state, 1_000, () => 0) };
}

function assignedCount(state: LobbyState, team: 'ice' | 'water') {
  return [...state.players.values()].filter((player) => player.team === team).length;
}

it('allows solo practice while rejecting non-hosts and repeated starts', () => {
  const { state, controller } = fixture(1);
  expect(controller.start('intruder', 0)).toContain('host');
  expect(controller.start('0', 0)).toBeNull();
  expect(controller.start('0', 1)).toContain('already');
  controller.tick(999);
  expect(state.phase).toBe('countdown');
  controller.tick(1_000);
  expect(state.phase).toBe('playing');
  expect(state.players.get('0')!.team).toBe('ice');
});

it('cancels a countdown with no connected players and transfers host', () => {
  const { state, controller } = fixture(1);
  controller.start('0', 0);
  state.players.get('0')!.isConnected = false;
  controller.tick(1_000);
  controller.transferHost();
  expect(state.phase).toBe('lobby');
  expect(state.hostPlayerId).toBe('');
});

it.each([
  [5, 1, 4],
  [6, 1, 5],
  [8, 2, 6],
  [10, 2, 8],
  [25, 5, 20],
  [50, 10, 40],
  [100, 20, 80],
])('automatically assigns %i connected players as %i Ice and %i Water', (count, ice, water) => {
  const { state, controller } = fixture(count);
  controller.start('0', 0);
  controller.tick(1_000);
  expect(assignedCount(state, 'ice')).toBe(ice);
  expect(assignedCount(state, 'water')).toBe(water);
});

it('does not assign disconnected roster entries at countdown completion', () => {
  const { state, controller } = fixture(5);
  state.players.get('4')!.isConnected = false;
  controller.start('0', 0);
  controller.tick(1_000);
  expect(assignedCount(state, 'ice')).toBe(1);
  expect(assignedCount(state, 'water')).toBe(3);
  expect(state.players.get('4')!.team).toBe('unassigned');
});
