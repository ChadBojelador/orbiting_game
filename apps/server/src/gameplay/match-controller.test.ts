import { describe, expect, it, vi } from 'vitest';
import { GAMEPLAY } from '@ice-water/shared';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { MatchController } from './match-controller.js';

function fixture(waterCount = 0, iceCount = 1) {
  const state = new LobbyState();
  for (let index = 0; index < iceCount; index++) {
    const player = new PlayerState();
    player.playerId = `ice-${index}`;
    player.team = 'ice';
    state.players.set(player.playerId, player);
  }
  for (let index = 0; index < waterCount; index++) {
    const player = new PlayerState();
    player.playerId = `water-${index}`;
    player.team = 'water';
    state.players.set(player.playerId, player);
  }
  const onResult = vi.fn();
  const onResultExpired = vi.fn();
  const start = vi.fn();
  const controller = new MatchController(state, () => {}, start, { onResult, onResultExpired });
  controller.start(1_000);
  return { state, controller, onResult, onResultExpired, start };
}

describe('Ice Ice Water match resolution', () => {
  it('records original Water count once and updates the authoritative unfrozen count', () => {
    const { state, controller } = fixture(5);
    expect(state.waterStartedCount).toBe(5);
    expect(state.waterUnfrozenCount).toBe(5);

    state.players.get('water-0')!.status = 'frozen';
    state.players.get('water-1')!.status = 'spectator';
    controller.tick(1_100);
    expect(state.waterStartedCount).toBe(5);
    expect(state.waterUnfrozenCount).toBe(3);

    state.players.get('water-0')!.status = 'alive';
    controller.tick(1_150);
    expect(state.waterUnfrozenCount).toBe(4);
  });

  it('ends immediately only when every original Water player is frozen', () => {
    const { state, controller, onResult } = fixture(2);
    state.players.get('water-0')!.status = 'frozen';
    state.players.get('water-1')!.status = 'frozen';
    controller.tick(2_000);

    expect(state.phase).toBe('finished');
    expect(state.matchWinner).toBe('ice');
    expect(state.resultReason).toBe('all-frozen');
    expect(onResult).toHaveBeenCalledWith(
      { winner: 'ice', reason: 'all-frozen', gameMode: 'tdm' },
      1_000,
      2_000,
    );
  });

  it('awards Water at the exact deadline when at least 60% remain unfrozen', () => {
    const { state, controller, onResult } = fixture(20);
    for (let index = 0; index < 8; index++) state.players.get(`water-${index}`)!.status = 'frozen';
    const deadline = state.phaseDeadline;
    controller.tick(deadline - 1);
    expect(state.phase).toBe('playing');
    controller.tick(deadline);
    expect(state.waterUnfrozenCount).toBe(12);
    expect(state.matchWinner).toBe('water');
    expect(state.resultReason).toBe('water-survived');
    expect(onResult.mock.calls[0]?.[2]).toBe(deadline);
  });

  it('awards Ice at timeout when fewer than 60% remain unfrozen', () => {
    const { state, controller } = fixture(20);
    for (let index = 0; index < 9; index++) state.players.get(`water-${index}`)!.status = 'frozen';
    controller.tick(state.phaseDeadline);
    expect(state.waterUnfrozenCount).toBe(11);
    expect(state.matchWinner).toBe('ice');
    expect(state.resultReason).toBe('water-below-threshold');
  });

  it.each([
    [9, 6],
    [11, 7],
    [19, 12],
  ])('rounds the %i-player Water threshold up to %i', (waterCount, requiredUnfrozen) => {
    const win = fixture(waterCount);
    for (let index = requiredUnfrozen; index < waterCount; index++)
      win.state.players.get(`water-${index}`)!.status = 'frozen';
    win.controller.tick(win.state.phaseDeadline);
    expect(win.state.matchWinner).toBe('water');

    const loss = fixture(waterCount);
    for (let index = requiredUnfrozen - 1; index < waterCount; index++)
      loss.state.players.get(`water-${index}`)!.status = 'frozen';
    loss.controller.tick(loss.state.phaseDeadline);
    expect(loss.state.matchWinner).toBe('ice');
  });

  it('persists and disposes once through intermission', () => {
    const { state, controller, onResult, onResultExpired, start } = fixture(1);
    state.players.get('water-0')!.status = 'frozen';
    controller.tick(1_100);
    controller.tick(1_150);
    expect(state.phase).toBe('intermission');
    controller.tick(1_100 + GAMEPLAY.intermissionMs);
    controller.tick(999_999);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResultExpired).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
