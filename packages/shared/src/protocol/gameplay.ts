import type { MatchPhase } from './lobby.js';
import type { WeaponId } from '../constants/weapons.js';

// ── Geometry primitives ──

export interface Position {
  x: number;
  z: number;
}
export interface SpatialPosition extends Position {
  y: number;
}

// ── Input ──

export interface MoveInput extends Position {
  sequence: number;
  /** Vertical look angle in radians (up is negative). */
  pitch?: number;
  /** One-shot jump intent. */
  jump?: boolean;
  /** Slide intent. */
  slide?: boolean;
}

export interface ShootIntent {
  /** Yaw angle of the shot (radians). */
  yaw: number;
  /** Pitch angle of the shot (radians). */
  pitch: number;
}

export interface ReloadIntent {
  // empty — just signals "reload now"
}

export interface WeaponSwitchIntent {
  slot: number; // 0 = primary, 1 = secondary, 2 = melee
}

// ── Player ──

export type PlayerStatus = 'alive' | 'dead' | 'spectator';

export type GameMode = 'ffa' | 'tdm' | 'duel';

export type Team = 'none' | 'ice' | 'water';

// ── Messages ──

export interface GameplayMessages {
  'input/move': MoveInput;
  'action/shoot': ShootIntent;
  'action/reload': ReloadIntent;
  'action/switch-weapon': WeaponSwitchIntent;
}

export interface GameplayEvents {
  'player/hit': {
    attackerId: string;
    victimId: string;
    damage: number;
    isHeadshot: boolean;
    weaponId: WeaponId;
    serverTime: number;
  };
  'player/killed': {
    killerId: string;
    victimId: string;
    weaponId: WeaponId;
    isHeadshot: boolean;
    serverTime: number;
  };
  'player/respawned': {
    playerId: string;
    x: number;
    y: number;
    z: number;
    serverTime: number;
  };
}

export type GameplayEvent = {
  [K in keyof GameplayEvents]: { type: K; payload: GameplayEvents[K] };
}[keyof GameplayEvents];

// ── Phase helpers ──

export function isPlayPhase(phase: MatchPhase): boolean {
  return phase === 'playing';
}

// ── Validation ──

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isMoveInput(value: unknown): value is MoveInput {
  if (!isRecord(value)) return false;
  if (typeof value.x !== 'number' || typeof value.z !== 'number') return false;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) return false;
  if (typeof value.sequence !== 'number' || !Number.isInteger(value.sequence)) return false;
  if (value.pitch !== undefined && (typeof value.pitch !== 'number' || !Number.isFinite(value.pitch))) return false;
  if (value.jump !== undefined && typeof value.jump !== 'boolean') return false;
  if (value.slide !== undefined && typeof value.slide !== 'boolean') return false;
  return true;
}

export function isShootIntent(value: unknown): value is ShootIntent {
  if (!isRecord(value)) return false;
  return (
    typeof value.yaw === 'number' &&
    Number.isFinite(value.yaw) &&
    typeof value.pitch === 'number' &&
    Number.isFinite(value.pitch)
  );
}

export function isReloadIntent(value: unknown): value is ReloadIntent {
  return isRecord(value);
}

export function isWeaponSwitchIntent(value: unknown): value is WeaponSwitchIntent {
  if (!isRecord(value)) return false;
  return typeof value.slot === 'number' && Number.isInteger(value.slot) && value.slot >= 0 && value.slot <= 3;
}

export function isEmptyPayload(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}
