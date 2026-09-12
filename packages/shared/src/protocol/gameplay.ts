import type { MatchPhase } from './lobby.js';

export interface Position {
  x: number;
  z: number;
}
export interface SpatialPosition extends Position {
  y: number;
}
export interface MoveInput extends Position {
  sequence: number;
  /** One-shot jump intent. Optional so a rolling deployment accepts older clients. */
  jump?: boolean;
}
export interface TargetIntent {
  targetId: string;
}
export type PlayerStatus = 'active' | 'frozen' | 'eliminated' | 'spectator';
export interface GameplayMessages {
  'input/move': MoveInput;
  'action/tag': TargetIntent;
  'action/rescue-start': TargetIntent;
  'action/rescue-stop': Record<string, never>;
  'action/help-ping': Record<string, never>;
}
export interface GameplayEvents {
  'player/frozen': { playerId: string; by: string; serverTime: number };
  'player/rescued': { playerId: string; by: string[]; protectedUntil: number; serverTime: number };
  'player/help-ping': { playerId: string; until: number; serverTime: number };
  'player/permanently-frozen': { playerId: string; serverTime: number };
  'arena/boundary-changed': { halfExtent: number; round: number; serverTime: number };
}
export type GameplayEvent = {
  [K in keyof GameplayEvents]: { type: K; payload: GameplayEvents[K] };
}[keyof GameplayEvents];

export function isPlayPhase(phase: MatchPhase): boolean {
  return phase === 'regular' || phase === 'warning' || phase === 'deep-freeze';
}
export function canRescueInPhase(phase: MatchPhase, deadline: number, now: number): boolean {
  return (phase === 'regular' || phase === 'warning') && (deadline === 0 || now < deadline);
}
