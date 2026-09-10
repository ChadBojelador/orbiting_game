import {
  GAMEPLAY,
  arenaHalfExtentForRound,
  type GameplayEvent,
  type MatchPhase,
  type MatchResult,
} from '@ice-water/shared';
import type { LobbyState } from '../rooms/lobby-state.js';

type EmitFn = (
  event:
    | GameplayEvent
    | {
        type: 'match/phase-changed';
        payload: { phase: MatchPhase; phaseDeadline: number; serverTime: number; round?: number };
      }
    | { type: 'match/result'; payload: MatchResult },
) => void;

/**
 * MatchController owns the authoritative multi-round phase state machine.
 * It is driven by the room's advance() tick and should be called after
 * GameplayController.advance() so movement is resolved before we evaluate
 * win conditions in the same tick.
 *
 * Phase sequence per round:
 *   regular → warning → deep-freeze → round-result → (next round or match-result)
 *
 * The 30-second regular phase contains an 8-second warning window at the end.
 * Deep Freeze lasts exactly 30 server-controlled seconds.
 */
export class MatchController {
  private hasStarted = false;

  constructor(
    private readonly state: LobbyState,
    private readonly emit: EmitFn,
    private readonly onStartRound: (now: number, halfExtent: number) => void,
  ) {}

  /** Called once when the countdown ends and roles are assigned. */
  start(now: number): void {
    if (this.hasStarted) return;
    this.hasStarted = true;
    this.beginRound(1, now);
  }

  /**
   * Advance the phase clock. Returns true if the phase changed so the room
   * can broadcast the new state.
   */
  tick(now: number): boolean {
    if (!this.hasStarted) return false;
    const phase = this.state.phase;
    if (phase === 'lobby' || phase === 'countdown' || phase === 'match-result') return false;

    // Check Ice-wins-early condition every tick during a play phase.
    if (phase === 'regular' || phase === 'warning' || phase === 'deep-freeze') {
      if (this.iceWinsNow()) {
        this.resolveMatch('ice', 'all-frozen', now);
        return true;
      }
    }

    const deadline = this.state.phaseDeadline;
    if (deadline !== 0 && now < deadline) {
      // Transition regular → warning when the warning window begins.
      if (phase === 'regular') {
        const warningStart = deadline - GAMEPLAY.warningMs;
        if (now >= warningStart) {
          this.state.phase = 'warning';
          this.emit({
            type: 'match/phase-changed',
            payload: {
              phase: 'warning',
              phaseDeadline: deadline,
              serverTime: now,
            },
          });
          return true;
        }
      }
      return false;
    }

    switch (phase) {
      case 'regular':
      case 'warning':
        this.beginDeepFreeze(now);
        return true;
      case 'deep-freeze':
        this.resolveDeepFreeze(now);
        return true;
      case 'round-result':
        if (this.state.round >= this.state.maxRounds) {
          this.resolveMatch('water', 'rounds-complete', now);
        } else {
          this.beginRound(this.state.round + 1, now);
        }
        return true;
      default:
        return false;
    }
  }

  private beginRound(round: number, now: number): void {
    const halfExtent = arenaHalfExtentForRound(round);
    this.state.round = round;
    this.state.arenaHalfExtent = halfExtent;
    this.state.phase = 'regular';
    this.state.phaseDeadline = now + GAMEPLAY.regularMs;
    this.onStartRound(now, halfExtent);
    this.emit({ type: 'arena/boundary-changed', payload: { halfExtent, round, serverTime: now } });
    this.emit({
      type: 'match/phase-changed',
      payload: {
        phase: 'regular',
        phaseDeadline: this.state.phaseDeadline,
        serverTime: now,
        round,
      },
    });
  }

  private beginDeepFreeze(now: number): void {
    this.state.phase = 'deep-freeze';
    this.state.phaseDeadline = now + GAMEPLAY.deepFreezeMs;
    this.emit({
      type: 'match/phase-changed',
      payload: {
        phase: 'deep-freeze',
        phaseDeadline: this.state.phaseDeadline,
        serverTime: now,
      },
    });
  }

  private resolveDeepFreeze(now: number): void {
    // Atomically permanently-freeze all Water players still frozen at the deadline.
    for (const player of this.state.players.values()) {
      if (player.team === 'water' && player.status === 'frozen') {
        player.status = 'eliminated';
        this.emit({
          type: 'player/permanently-frozen',
          payload: { playerId: player.playerId, serverTime: now },
        });
      }
    }
    this.state.phase = 'round-result';
    this.state.phaseDeadline = now + GAMEPLAY.roundResultMs;
    this.emit({
      type: 'match/phase-changed',
      payload: {
        phase: 'round-result',
        phaseDeadline: this.state.phaseDeadline,
        serverTime: now,
      },
    });
  }

  private resolveMatch(winner: 'ice' | 'water', reason: MatchResult['reason'], now: number): void {
    this.state.phase = 'match-result';
    this.state.phaseDeadline = now + GAMEPLAY.matchResultMs;
    this.state.matchWinner = winner;
    this.emit({ type: 'match/result', payload: { winner, reason } });
    this.emit({
      type: 'match/phase-changed',
      payload: {
        phase: 'match-result',
        phaseDeadline: this.state.phaseDeadline,
        serverTime: now,
      },
    });
  }

  /** Ice wins immediately when every Water player is frozen or eliminated. */
  private iceWinsNow(): boolean {
    let hasActiveWater = false;
    let hasAnyWater = false;
    for (const player of this.state.players.values()) {
      if (player.team !== 'water') continue;
      hasAnyWater = true;
      if (player.status === 'active') {
        hasActiveWater = true;
        break;
      }
    }
    return hasAnyWater && !hasActiveWater;
  }
}
