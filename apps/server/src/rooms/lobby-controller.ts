import { randomInt } from 'node:crypto';
import { MIN_PLAYERS } from '@ice-water/shared';
import type { LobbyState } from './lobby-state.js';
export class LobbyController {
  constructor(
    private readonly state: LobbyState,
    private readonly countdownMs: number,
    private readonly pick: (max: number) => number = randomInt,
  ) {}
  start(playerId: string, now: number): string | null {
    if (this.state.hostPlayerId !== playerId) return 'Only the host can start the match';
    if (this.state.phase !== 'lobby') return 'The match has already started';
    if (this.connectedCount() < MIN_PLAYERS) return 'At least one connected player is needed';
    if (this.state.gameMode === 'duel' && this.state.players.size > 2)
      return 'Duel supports at most two players';
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
    const players = [...this.state.players.values()].filter((p) => p.isConnected);
    for (let i = players.length - 1; i > 0; i--) {
      const j = this.pick(i + 1);
      [players[i], players[j]] = [players[j]!, players[i]!];
    }
    players.forEach((p, i) => {
      p.team = this.state.gameMode === 'tdm' ? (i % 2 === 0 ? 'ice' : 'water') : 'none';
    });
    this.state.phase = 'playing';
    this.state.phaseDeadline = 0;
    return true;
  }
  connectedCount(): number {
    return [...this.state.players.values()].filter((p) => p.isConnected).length;
  }
  transferHost(): void {
    const host = this.state.players.get(this.state.hostPlayerId);
    if (host?.isConnected && !host.isBot) return;
    this.state.hostPlayerId =
      [...this.state.players.values()].find((p) => p.isConnected && !p.isBot)?.playerId ?? '';
  }
}
