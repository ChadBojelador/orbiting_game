import { describe, expect, it, vi } from 'vitest';
import { GAMEPLAY } from '@ice-water/shared';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { MatchController } from './match-controller.js';
function fixture() {
  const state = new LobbyState();
  for (const id of ['a', 'b']) {
    const p = new PlayerState();
    p.playerId = id;
    p.team = 'none';
    state.players.set(id, p);
  }
  const onResult = vi.fn(),
    onResultExpired = vi.fn(),
    start = vi.fn();
  const controller = new MatchController(state, () => {}, start, { onResult, onResultExpired });
  controller.start(1000);
  return { state, controller, onResult, onResultExpired, start };
}
describe('FPS match deadlines and scores', () => {
  it('persists and disposes once through intermission after the score limit', () => {
    const { state, controller, onResult, onResultExpired, start } = fixture();
    state.iceScore = GAMEPLAY.tdmScoreLimit;
    controller.tick(1100);
    expect(state.phase).toBe('finished');
    expect(state.matchWinner).toBe('a');
    controller.tick(1150);
    expect(state.phase).toBe('intermission');
    controller.tick(1100 + GAMEPLAY.intermissionMs);
    controller.tick(999999);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResultExpired).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });
  it('uses the exact time deadline and draws tied scores', () => {
    const { state, controller, onResult } = fixture();
    const deadline = state.phaseDeadline;
    controller.tick(deadline - 1);
    expect(state.phase).toBe('playing');
    controller.tick(deadline + 500);
    expect(state.matchWinner).toBe('draw');
    expect(onResult.mock.calls[0]?.[2]).toBe(deadline);
  });
  it('ends Ice Ice Water when a team reaches the score limit', () => {
    const match = fixture();
    match.state.iceScore = GAMEPLAY.tdmScoreLimit;
    match.controller.tick(2000);
    expect(match.state.matchWinner).toBe('ice');
  });
  it('ends immediately when Ice freezes every Water player', () => {
    const { state, controller, onResult } = fixture();
    state.players.get('a')!.team = 'ice';
    state.players.get('b')!.team = 'water';
    state.players.get('b')!.status = 'frozen';

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
});
