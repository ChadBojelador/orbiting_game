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
    const auto = players.filter((player) => player.teamPreference === 'auto');
    let iceCount = players.filter((player) => player.teamPreference === 'ice').length;
    let waterCount = players.filter((player) => player.teamPreference === 'water').length;
    for (const player of auto) {
      if (iceCount <= waterCount) {
        player.team = 'ice';
        iceCount++;
      } else {
        player.team = 'water';
        waterCount++;
      }
    }
    for (const player of players) {
      if (player.teamPreference === 'ice') player.team = 'ice';
      if (player.teamPreference === 'water') player.team = 'water';
    }
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
