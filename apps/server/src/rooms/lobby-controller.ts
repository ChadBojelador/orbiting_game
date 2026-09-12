import { randomInt } from 'node:crypto';
import { GAMEPLAY, MIN_PLAYERS } from '@ice-water/shared';
import { iceCountFor, type IceBracket } from '../config/ice-brackets.js';
import type { LobbyState } from './lobby-state.js';

export class LobbyController {
  constructor(
    private readonly state: LobbyState,
    private readonly countdownMs: number,
    private readonly brackets: readonly IceBracket[],
    private readonly pick: (max: number) => number = randomInt,
  ) {}

  start(playerId: string, now: number): string | null {
    if (this.state.hostPlayerId !== playerId) return 'Only the host can start the match';
    if (this.state.phase !== 'lobby') return 'The match has already started';
    if (this.connectedCount() < MIN_PLAYERS) return 'At least six connected players are needed';
    this.state.phase = 'countdown';
    this.state.phaseDeadline = now + this.countdownMs;
    this.state.serverTime = now;
    return null;
  }

  tick(now: number): boolean {
    this.state.serverTime = now;
    if (this.state.phase !== 'countdown') return false;
    if (this.connectedCount() < MIN_PLAYERS) {
      this.state.phase = 'lobby';
      this.state.phaseDeadline = 0;
      return true;
    }
    if (now < this.state.phaseDeadline) return false;
    const players = [...this.state.players.values()].filter((player) => player.isConnected);
    for (let index = players.length - 1; index > 0; index--) {
      const target = this.pick(index + 1);
      const current = players[index];
      const other = players[target];
      if (current && other) {
        players[index] = other;
        players[target] = current;
      }
    }
    this.state.iceCount = iceCountFor(players.length, this.brackets);
    players.forEach((player, index) => {
      player.team = index < 2 ? 'ice' : 'water';
    });
    this.state.round = 0; // MatchController.start() will set this to 1.
    this.state.maxRounds = GAMEPLAY.maxRounds;
    this.state.phase = 'regular';
    // Phase deadline and round tracking are owned by MatchController (MVP-26/28).
    this.state.phaseDeadline = 0;
    return true;
  }

  connectedCount(): number {
    return [...this.state.players.values()].filter((player) => player.isConnected).length;
  }

  transferHost(): void {
    const host = this.state.players.get(this.state.hostPlayerId);
    if (host?.isConnected && !host.playerId.startsWith('bot-')) return;
    this.state.hostPlayerId =
      [...this.state.players.values()].find(
        (player) => player.isConnected && !player.playerId.startsWith('bot-'),
      )?.playerId ?? '';
  }
}
