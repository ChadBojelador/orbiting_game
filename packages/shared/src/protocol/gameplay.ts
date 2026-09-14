import type { MatchPhase } from './lobby.js';
import type { WeaponId } from '../constants/weapons.js';
export interface Position {
  x: number;
  z: number;
}
export interface SpatialPosition extends Position {
  y: number;
}
export interface MoveInput extends Position {
  sequence: number;
  yaw?: number;
  pitch?: number;
  jump?: boolean;
  slide?: boolean;
  sprint?: boolean;
  crouch?: boolean;
}
export interface ShootIntent {
  yaw: number;
  pitch: number;
  isAds?: boolean;
}
export type ReloadIntent = Record<string, never>;
export interface WeaponSwitchIntent {
  slot: number;
}
export type PlayerStatus = 'alive' | 'dead' | 'spectator';
export type GameMode = 'ffa' | 'tdm' | 'duel';
export type MapId = 'frostline' | 'island';
export interface GameplayMessages {
  'input/move': MoveInput;
  'action/shoot': ShootIntent;
  'action/reload': ReloadIntent;
  'action/switch-weapon': WeaponSwitchIntent;
}
export interface GameplayEvents {
  'weapon/fired': {
    playerId: string;
    weaponId: WeaponId;
    origin: SpatialPosition;
    end: SpatialPosition;
    serverTime: number;
  };
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
  'player/respawned': { playerId: string; x: number; y: number; z: number; serverTime: number };
}
export type GameplayEvent = {
  [K in keyof GameplayEvents]: { type: K; payload: GameplayEvents[K] };
}[keyof GameplayEvents];
export function isPlayPhase(phase: MatchPhase): boolean {
  return phase === 'playing';
}
