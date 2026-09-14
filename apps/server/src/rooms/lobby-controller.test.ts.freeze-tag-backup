import { describe, expect, it } from 'vitest';
import { DEFAULT_ICE_BRACKETS, iceCountFor, parseIceBrackets } from '../config/ice-brackets.js';
import { LobbyController } from './lobby-controller.js';
import { LobbyState, PlayerState } from './lobby-state.js';

function fixture(count: number) {
  const state = new LobbyState();
  for (let index = 0; index < count; index++) {
    const player = new PlayerState();
    player.playerId = String(index);
    state.players.set(player.playerId, player);
  }
  state.hostPlayerId = '0';
  return { state, controller: new LobbyController(state, 5000, DEFAULT_ICE_BRACKETS, () => 0) };
}

describe('authoritative lobby', () => {
  it('rejects non-hosts, starts below six, and repeated starts', () => {
    const { state, controller } = fixture(5);
    expect(controller.start('1', 100)).toContain('host');
    expect(controller.start('0', 100)).toContain('six');
    const player = new PlayerState();
    player.playerId = '5';
    state.players.set('5', player);
    expect(controller.start('0', 100)).toBeNull();
    expect(controller.start('0', 101)).toContain('already');
    expect(state.phaseDeadline).toBe(5100);
  });
  it('assigns roles once at the exact countdown deadline', () => {
    const { state, controller } = fixture(6);
    controller.start('0', 100);
    controller.tick(5099);
    expect(state.phase).toBe('countdown');
    expect([...state.players.values()].every((player) => player.team === 'unassigned')).toBe(true);
    controller.tick(5100);
    expect(state.phase).toBe('regular');
    const teams = [...state.players.values()].map((player) => player.team);
    expect(teams.filter((team) => team === 'ice')).toHaveLength(1);
    expect(teams.filter((team) => team === 'water')).toHaveLength(5);
    controller.tick(99999);
    expect([...state.players.values()].map((player) => player.team)).toEqual(teams);
  });
  it('cancels countdown on a disconnect and transfers the host', () => {
    const { state, controller } = fixture(6);
    controller.start('0', 0);
    state.players.get('0')!.isConnected = false;
    controller.transferHost();
    controller.tick(5000);
    expect(state.hostPlayerId).toBe('1');
    expect(state.phase).toBe('lobby');
    expect(state.phaseDeadline).toBe(0);
    expect([...state.players.values()].every((player) => player.team === 'unassigned')).toBe(true);
  });
  it('assigns only connected players and preserves at least one Water', () => {
    const { state, controller } = fixture(150);
    controller.start('0', 0);
    controller.tick(5000);
    expect([...state.players.values()].filter((player) => player.team === 'ice')).toHaveLength(15);
    expect([...state.players.values()].filter((player) => player.team === 'water')).toHaveLength(
      135,
    );
  });
});

describe('approved Ice-count brackets', () => {
  it.each([
    [6, 1],
    [10, 1],
    [11, 2],
    [20, 2],
    [21, 3],
    [35, 3],
    [36, 5],
    [50, 5],
    [51, 7],
    [75, 7],
    [76, 10],
    [100, 10],
    [101, 12],
    [125, 12],
    [126, 15],
    [150, 15],
  ])('uses %i players → %i Ice', (players, ice) =>
    expect(iceCountFor(players, DEFAULT_ICE_BRACKETS)).toBe(ice),
  );
  it('rejects gaps in coverage, invalid counts, and non-monotonic thresholds', () => {
    for (const brackets of [
      [],
      [{ maxPlayers: 149, icePlayers: 1 }],
      [{ maxPlayers: 150, icePlayers: 6 }],
      [
        { maxPlayers: 10, icePlayers: 1 },
        { maxPlayers: 9, icePlayers: 2 },
      ],
      [{ maxPlayers: 150.5, icePlayers: 1 }],
    ])
      expect(() => parseIceBrackets(brackets)).toThrow();
    expect(parseIceBrackets(DEFAULT_ICE_BRACKETS)).toEqual(DEFAULT_ICE_BRACKETS);
    expect(() => iceCountFor(5, DEFAULT_ICE_BRACKETS)).toThrow();
    expect(() => iceCountFor(151, DEFAULT_ICE_BRACKETS)).toThrow();
  });
});
