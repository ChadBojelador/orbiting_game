import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GAMEPLAY, arenaHalfExtentForRound } from '@ice-water/shared';
import { MatchController } from './match-controller.js';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';

function makeState(waterCount = 3, iceCount = 1): LobbyState {
  const state = new LobbyState();
  state.iceCount = iceCount;
  state.maxRounds = GAMEPLAY.maxRounds;
  // Add Ice players.
  for (let i = 0; i < iceCount; i++) {
    const p = new PlayerState();
    p.playerId = `ice-${i}`;
    p.team = 'ice';
    p.status = 'active';
    p.isConnected = true;
    state.players.set(p.playerId, p);
  }
  // Add Water players.
  for (let i = 0; i < waterCount; i++) {
    const p = new PlayerState();
    p.playerId = `water-${i}`;
    p.team = 'water';
    p.status = 'active';
    p.isConnected = true;
    state.players.set(p.playerId, p);
  }
  return state;
}

function makeController(state: LobbyState) {
  const events: Array<{ type: string; payload: unknown }> = [];
  const onStartRound = vi.fn();
  const ctrl = new MatchController(state, (event) => events.push(event), onStartRound);
  return { ctrl, events, onStartRound };
}

describe('MatchController', () => {
  let state: LobbyState;
  let ctrl: MatchController;
  let events: Array<{ type: string; payload: unknown }>;
  let onStartRound: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = makeState();
    ({ ctrl, events, onStartRound } = makeController(state));
  });

  it('sets round=1 and phase=regular on start', () => {
    ctrl.start(1000);
    expect(state.round).toBe(1);
    expect(state.phase).toBe('regular');
    expect(state.phaseDeadline).toBe(1000 + GAMEPLAY.regularMs);
    expect(state.arenaHalfExtent).toBe(arenaHalfExtentForRound(1));
    expect(onStartRound).toHaveBeenCalledWith(1000, arenaHalfExtentForRound(1));
  });

  it('does not start twice', () => {
    ctrl.start(1000);
    ctrl.start(2000);
    expect(onStartRound).toHaveBeenCalledTimes(1);
  });

  it('transitions regular → warning when warning window begins', () => {
    ctrl.start(0);
    const deadline = GAMEPLAY.regularMs;
    const warningStart = deadline - GAMEPLAY.warningMs;
    // Just before warning.
    const changed1 = ctrl.tick(warningStart - 1);
    expect(changed1).toBe(false);
    expect(state.phase).toBe('regular');
    // At warning start.
    const changed2 = ctrl.tick(warningStart);
    expect(changed2).toBe(true);
    expect(state.phase).toBe('warning');
    // Deadline unchanged.
    expect(state.phaseDeadline).toBe(deadline);
  });

  it('transitions warning → deep-freeze at the regular deadline', () => {
    ctrl.start(0);
    const deadline = GAMEPLAY.regularMs;
    // Advance to warning.
    ctrl.tick(deadline - GAMEPLAY.warningMs);
    // At deadline.
    const changed = ctrl.tick(deadline);
    expect(changed).toBe(true);
    expect(state.phase).toBe('deep-freeze');
    expect(state.phaseDeadline).toBe(deadline + GAMEPLAY.deepFreezeMs);
  });

  it('does not enter Deep Freeze before the exact regular deadline', () => {
    ctrl.start(250);
    const deadline = 250 + GAMEPLAY.regularMs;

    ctrl.tick(deadline - GAMEPLAY.warningMs);
    expect(ctrl.tick(deadline - 1)).toBe(false);
    expect(state.phase).toBe('warning');
    expect(state.phaseDeadline).toBe(deadline);

    expect(ctrl.tick(deadline)).toBe(true);
    expect(state.phase).toBe('deep-freeze');
    expect(state.phaseDeadline).toBe(deadline + GAMEPLAY.deepFreezeMs);
  });

  it('atomically permanently-freezes frozen Water at Deep Freeze deadline', () => {
    ctrl.start(0);
    const deadline = GAMEPLAY.regularMs;
    ctrl.tick(deadline - GAMEPLAY.warningMs);
    ctrl.tick(deadline); // → deep-freeze
    // Freeze one Water player.
    state.players.get('water-0')!.status = 'frozen';
    const dfDeadline = deadline + GAMEPLAY.deepFreezeMs;

    expect(ctrl.tick(dfDeadline - 1)).toBe(false);
    expect(state.phase).toBe('deep-freeze');
    expect(state.players.get('water-0')!.status).toBe('frozen');
    expect(events.some((event) => event.type === 'player/permanently-frozen')).toBe(false);

    // At the exact deadline, all pending eliminations resolve in the same tick.
    ctrl.tick(dfDeadline);
    expect(state.players.get('water-0')!.status).toBe('eliminated');
    expect(state.players.get('water-1')!.status).toBe('active'); // untouched
    const permFreezeEvent = events.find((e) => e.type === 'player/permanently-frozen');
    expect(permFreezeEvent).toBeDefined();
  });

  it('eliminates disconnected frozen Water at the same authoritative deadline', () => {
    ctrl.start(0);
    const regularDeadline = GAMEPLAY.regularMs;
    ctrl.tick(regularDeadline - GAMEPLAY.warningMs);
    ctrl.tick(regularDeadline);
    const disconnected = state.players.get('water-0')!;
    disconnected.status = 'frozen';
    disconnected.isConnected = false;
    disconnected.reconnectDeadline = regularDeadline + GAMEPLAY.deepFreezeMs + 5_000;

    const deepFreezeDeadline = regularDeadline + GAMEPLAY.deepFreezeMs;
    ctrl.tick(deepFreezeDeadline);

    expect(disconnected.status).toBe('eliminated');
    expect(disconnected.isConnected).toBe(false);
    expect(events).toContainEqual({
      type: 'player/permanently-frozen',
      payload: { playerId: disconnected.playerId, serverTime: deepFreezeDeadline },
    });
  });

  it('transitions deep-freeze → round-result → next regular', () => {
    ctrl.start(0);
    const deadline = GAMEPLAY.regularMs;
    ctrl.tick(deadline - GAMEPLAY.warningMs);
    ctrl.tick(deadline); // → deep-freeze
    ctrl.tick(deadline + GAMEPLAY.deepFreezeMs); // → round-result
    expect(state.phase).toBe('round-result');
    ctrl.tick(deadline + GAMEPLAY.deepFreezeMs + GAMEPLAY.roundResultMs); // → regular (round 2)
    expect(state.phase).toBe('regular');
    expect(state.round).toBe(2);
    expect(state.arenaHalfExtent).toBe(arenaHalfExtentForRound(2));
  });

  it('does not leave round result before its exact deadline', () => {
    ctrl.start(0);
    const deepFreezeDeadline = GAMEPLAY.regularMs + GAMEPLAY.deepFreezeMs;
    ctrl.tick(GAMEPLAY.regularMs - GAMEPLAY.warningMs);
    ctrl.tick(GAMEPLAY.regularMs);
    ctrl.tick(deepFreezeDeadline);
    const roundResultDeadline = deepFreezeDeadline + GAMEPLAY.roundResultMs;

    expect(ctrl.tick(roundResultDeadline - 1)).toBe(false);
    expect(state.phase).toBe('round-result');
    expect(state.round).toBe(1);

    expect(ctrl.tick(roundResultDeadline)).toBe(true);
    expect(state.phase).toBe('regular');
    expect(state.round).toBe(2);
  });

  it('declares match-result after maxRounds rounds', () => {
    ctrl.start(0);
    let now = 0;
    for (let round = 0; round < GAMEPLAY.maxRounds; round++) {
      const rDeadline = now + GAMEPLAY.regularMs;
      ctrl.tick(rDeadline - GAMEPLAY.warningMs);
      ctrl.tick(rDeadline);
      ctrl.tick(rDeadline + GAMEPLAY.deepFreezeMs);
      now = rDeadline + GAMEPLAY.deepFreezeMs + GAMEPLAY.roundResultMs;
      ctrl.tick(now);
    }
    expect(state.phase).toBe('match-result');
    const resultEvent = events.find((e) => e.type === 'match/result');
    expect(resultEvent?.payload).toEqual({ winner: 'water', reason: 'rounds-complete' });
  });

  it('keeps results available until the deadline and requests cleanup exactly once afterward', () => {
    const onResultExpired = vi.fn();
    const lifecycleController = new MatchController(
      state,
      (event) => events.push(event),
      () => {},
      { onResultExpired },
    );
    lifecycleController.start(1_000);
    for (const player of state.players.values()) {
      if (player.team === 'water') player.status = 'frozen';
    }
    lifecycleController.tick(1_001);
    const resultDeadline = 1_001 + GAMEPLAY.matchResultMs;

    expect(state.phase).toBe('match-result');
    expect(lifecycleController.tick(resultDeadline - 1)).toBe(false);
    expect(onResultExpired).not.toHaveBeenCalled();
    expect(lifecycleController.tick(resultDeadline)).toBe(true);
    expect(onResultExpired).toHaveBeenCalledTimes(1);
    expect(lifecycleController.tick(resultDeadline + 1)).toBe(false);
    expect(onResultExpired).toHaveBeenCalledTimes(1);
  });

  it('reports one completed result with authoritative timestamps', () => {
    const onResult = vi.fn();
    const lifecycleController = new MatchController(
      state,
      (event) => events.push(event),
      () => {},
      { onResult },
    );
    lifecycleController.start(1_000);
    for (const player of state.players.values()) {
      if (player.team === 'water') player.status = 'frozen';
    }

    lifecycleController.tick(1_250);
    lifecycleController.tick(2_000);

    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith({ winner: 'ice', reason: 'all-frozen' }, 1_000, 1_250);
  });

  it('Ice wins immediately when all Water are frozen', () => {
    ctrl.start(1000);
    // Freeze all Water players.
    for (const p of state.players.values()) {
      if (p.team === 'water') p.status = 'frozen';
    }
    const changed = ctrl.tick(1000 + 1);
    expect(changed).toBe(true);
    expect(state.phase).toBe('match-result');
    expect(state.matchWinner).toBe('ice');
    const resultEvent = events.find((e) => e.type === 'match/result');
    expect(resultEvent?.payload).toEqual({ winner: 'ice', reason: 'all-frozen' });
  });

  it('does not award Ice while any active Water player remains', () => {
    ctrl.start(1000);
    state.players.get('water-0')!.status = 'frozen';
    state.players.get('water-1')!.status = 'eliminated';

    expect(ctrl.tick(1001)).toBe(false);
    expect(state.phase).toBe('regular');
    expect(state.matchWinner).toBe('');
    expect(events.some((event) => event.type === 'match/result')).toBe(false);
  });

  it('does not resolve match if there are no Water players', () => {
    // Edge: if somehow no Water exist, Ice should not win prematurely.
    const s = makeState(0, 1);
    const { ctrl: c } = makeController(s);
    c.start(1000);
    // Should not immediately declare Ice the winner.
    expect(s.phase).toBe('regular');
    c.tick(1001);
    expect(s.phase).toBe('regular');
  });

  it('arena half-extent follows the shrink table each round', () => {
    ctrl.start(0);
    let now = 0;
    for (let round = 1; round <= GAMEPLAY.maxRounds; round++) {
      expect(state.arenaHalfExtent).toBe(arenaHalfExtentForRound(round));
      if (round < GAMEPLAY.maxRounds) {
        const rDeadline = now + GAMEPLAY.regularMs;
        ctrl.tick(rDeadline - GAMEPLAY.warningMs);
        ctrl.tick(rDeadline);
        ctrl.tick(rDeadline + GAMEPLAY.deepFreezeMs);
        now = rDeadline + GAMEPLAY.deepFreezeMs + GAMEPLAY.roundResultMs;
        ctrl.tick(now);
      }
    }
  });

  it('rescue intent during deep-freeze phase is reflected in canRescueInPhase', async () => {
    // This checks the protocol helper, not MatchController itself.
    // canRescueInPhase should return false during deep-freeze.
    const { canRescueInPhase } = await import('@ice-water/shared');
    ctrl.start(0);
    const deadline = GAMEPLAY.regularMs;
    ctrl.tick(deadline - GAMEPLAY.warningMs);
    ctrl.tick(deadline);
    expect(state.phase).toBe('deep-freeze');
    expect(canRescueInPhase(state.phase, state.phaseDeadline, deadline + 1)).toBe(false);
  });
});
