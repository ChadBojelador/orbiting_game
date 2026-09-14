import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '@ice-water/shared';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { advanceAuthoritativeTick } from './authoritative-tick.js';
import { GameplayController } from './gameplay-controller.js';
import { MatchController } from './match-controller.js';

function addPlayer(state: LobbyState, playerId: string, team: 'ice' | 'water'): PlayerState {
  const player = new PlayerState();
  player.playerId = playerId;
  player.team = team;
  state.players.set(playerId, player);
  return player;
}

function fixture() {
  const state = new LobbyState();
  state.maxRounds = GAMEPLAY.maxRounds;
  const ice = addPlayer(state, 'ice', 'ice');
  const rescuer = addPlayer(state, 'rescuer', 'water');
  const target = addPlayer(state, 'target', 'water');
  const gameplay = new GameplayController(state);
  const match = new MatchController(
    state,
    () => {},
    (now, halfExtent) => gameplay.startRound(now, halfExtent),
  );
  match.start(0);
  return { state, ice, rescuer, target, gameplay, match };
}

describe('authoritative gameplay tick ordering', () => {
  it('finishes the last eligible rescue step before the regular deadline transition', () => {
    const { state, rescuer, target, gameplay, match } = fixture();
    const deadline = GAMEPLAY.regularMs;
    match.tick(deadline - GAMEPLAY.warningMs);
    gameplay.advance(deadline - GAMEPLAY.rescueMs - GAMEPLAY.tickMs);
    rescuer.x = target.x = 0;
    rescuer.z = target.z = 0;
    target.status = 'frozen';
    expect(
      gameplay.handle(
        rescuer.playerId,
        'action/rescue-start',
        { targetId: target.playerId },
        deadline - GAMEPLAY.rescueMs - GAMEPLAY.tickMs,
      ),
    ).toBeNull();

    for (
      let now = deadline - GAMEPLAY.rescueMs;
      now < deadline - GAMEPLAY.tickMs;
      now += GAMEPLAY.tickMs
    ) {
      if ((deadline - now) % 250 === 0)
        expect(
          gameplay.handle(
            rescuer.playerId,
            'action/rescue-start',
            { targetId: target.playerId },
            now,
          ),
        ).toBeNull();
      gameplay.advance(now);
    }

    expect(target.rescueProgress).toBeCloseTo(
      (GAMEPLAY.rescueMs - GAMEPLAY.tickMs) / GAMEPLAY.rescueMs,
    );
    advanceAuthoritativeTick(deadline, gameplay, match);

    expect(target.status).toBe('active');
    expect(state.phase).toBe('deep-freeze');
  });

  it('applies a queued pre-deadline move before resolving the Deep Freeze deadline', () => {
    const { state, ice, gameplay, match } = fixture();
    const regularDeadline = GAMEPLAY.regularMs;
    const deepFreezeDeadline = regularDeadline + GAMEPLAY.deepFreezeMs;
    match.tick(regularDeadline);
    gameplay.advance(deepFreezeDeadline - 2 * GAMEPLAY.tickMs);
    const startingX = ice.x;
    expect(
      gameplay.handle(
        ice.playerId,
        'input/move',
        { x: 1, z: 0, sequence: 1 },
        deepFreezeDeadline - 2 * GAMEPLAY.tickMs,
      ),
    ).toBeNull();
    expect(
      gameplay.handle(ice.playerId, 'input/move', { x: 1, z: 0, sequence: 2 }, deepFreezeDeadline),
    ).toBe('Gameplay is unavailable in this phase');

    advanceAuthoritativeTick(deepFreezeDeadline, gameplay, match);

    expect(ice.x).toBeGreaterThan(startingX);
    expect(state.phase).toBe('round-result');
  });
});
