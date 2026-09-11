import { describe, expect, it } from 'vitest';
import { MIN_PLAYERS } from '@ice-water/shared';
import { LobbyState, PlayerState } from '../rooms/lobby-state.js';
import { LobbyController } from '../rooms/lobby-controller.js';
import { GameplayController } from '../gameplay/gameplay-controller.js';
import { BotRunner } from './bot-runner.js';
import { DEFAULT_ICE_BRACKETS } from '../config/ice-brackets.js';

describe('BotRunner and solo playtest', () => {
  it('populates bots and allows solo host to start countdown when total reaches MIN_PLAYERS', () => {
    const state = new LobbyState();
    state.hostPlayerId = 'human-host';

    // Add human host
    const host = new PlayerState();
    host.playerId = 'human-host';
    host.displayName = 'Solo Host';
    state.players.set(host.playerId, host);

    const gameplay = new GameplayController(state, () => {});
    const bots = new BotRunner(state, gameplay, 5);
    const lobby = new LobbyController(state, 5000, DEFAULT_ICE_BRACKETS);

    expect(lobby.connectedCount()).toBe(1);
    expect(lobby.start('human-host', 1000)).toBe('At least six connected players are needed');

    // Start bots
    bots.start();
    expect(lobby.connectedCount()).toBe(6);
    expect(state.players.size).toBe(6);

    // Host starts
    const error = lobby.start('human-host', 1000);
    expect(error).toBeNull();
    expect(state.phase).toBe('countdown');

    // Ticking moves bots
    bots.tick(1050);

    // Countdown finishes -> regular round starts
    const transitioned = lobby.tick(6001);
    expect(transitioned).toBe(true);
    expect(state.phase).toBe('regular');
    expect(state.round).toBe(0);

    // Stop bots
    bots.stop();
    expect(state.players.size).toBe(1);
  });

  it('ensures bots are never selected as host in transferHost', () => {
    const state = new LobbyState();
    state.hostPlayerId = 'bot-0';

    const gameplay = new GameplayController(state, () => {});
    const bots = new BotRunner(state, gameplay, 3);
    bots.start();

    const lobby = new LobbyController(state, 5000, DEFAULT_ICE_BRACKETS);
    lobby.transferHost();
    // No humans connected, so hostPlayerId should become empty string
    expect(state.hostPlayerId).toBe('');

    // Add human
    const human = new PlayerState();
    human.playerId = 'human-player';
    state.players.set(human.playerId, human);

    lobby.transferHost();
    expect(state.hostPlayerId).toBe('human-player');
  });
});
