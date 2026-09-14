import type {
  GameplayEvents,
  GameplayMessages,
  PlayerStatus,
  GameMode,
  MapId,
} from './gameplay.js';
import type { WeaponId } from '../constants/weapons.js';
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 150;
export const ROOM_NAME = 'private-game';
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 8;
export type Team = 'unassigned' | 'none' | 'ice' | 'water';
export type MatchPhase = 'lobby' | 'countdown' | 'playing' | 'finished' | 'intermission';
export interface PlayerView {
  playerId: string;
  displayName: string;
  team: Team;
  isConnected: boolean;
  isBot: boolean;
  reconnectDeadline: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  velocityX: number;
  velocityZ: number;
  verticalVelocity: number;
  isGrounded: boolean;
  inputSequence: number;
  status: PlayerStatus;
  protectedUntil: number;
  isSliding: boolean;
  isCrouching: boolean;
  slideUntil: number;
  slideReadyAt: number;
  hp: number;
  kills: number;
  deaths: number;
  currentWeaponSlot: number;
  primaryWeapon: WeaponId;
  weaponId: WeaponId;
  ammo: number;
  reserveAmmo: number;
  reloadUntil: number;
  fireReadyAt: number;
  respawnAt: number;
  spawnGeneration: number;
  lastKillerId: string;
  lastDeathWeapon: WeaponId;
  ping: number;
}
export interface LobbyView {
  inviteCode: string;
  hostPlayerId: string;
  phase: MatchPhase;
  phaseDeadline: number;
  serverTime: number;
  maxPlayers: number;
  minPlayers: number;
  arenaHalfExtent: number;
  gameMode: GameMode;
  mapId: MapId;
  iceScore: number;
  waterScore: number;
  matchWinner: string;
  resultReason: MatchResult['reason'] | '';
  players: PlayerView[];
}
export interface GuestSession {
  token: string;
  playerId: string;
  displayName: string;
  expiresAt: number;
}
export interface SeatReservation {
  name: string;
  roomId: string;
  processId: string;
  sessionId: string;
  publicAddress?: string;
}
export interface RoomReservation {
  inviteCode: string;
  seat: SeatReservation;
}
export interface SessionError {
  code: string;
  message: string;
}
export interface MatchResult {
  winner: string;
  reason: 'score-limit' | 'time-limit';
  gameMode: GameMode;
}
export interface ClientMessages extends GameplayMessages {
  'room/start': Record<string, never>;
  'room/configure': { gameMode?: GameMode; mapId?: MapId };
  'player/loadout': { primaryWeapon: WeaponId };
  'session/ping': { sentAt: number };
}
export interface ServerMessages extends GameplayEvents {
  'session/error': SessionError;
  'session/pong': { sentAt: number };
  'match/phase-changed': { phase: MatchPhase; phaseDeadline: number; serverTime: number };
  'match/result': MatchResult;
}
