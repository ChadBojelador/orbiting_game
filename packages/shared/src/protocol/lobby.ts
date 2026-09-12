import type {
  FrostProjectileView,
  GameplayEvents,
  GameplayMessages,
  PlayerStatus,
} from './gameplay.js';

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 150;
export const ROOM_NAME = 'private-game';
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 8;

export type Team = 'unassigned' | 'ice' | 'water';
export type MatchPhase =
  'lobby' | 'countdown' | 'regular' | 'warning' | 'deep-freeze' | 'round-result' | 'match-result';

export interface PlayerView {
  playerId: string;
  displayName: string;
  team: Team;
  isConnected: boolean;
  reconnectDeadline: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  verticalVelocity: number;
  isGrounded: boolean;
  inputSequence: number;
  status: PlayerStatus;
  protectedUntil: number;
  rescueProgress: number;
  rescuingTarget: string;
  frostReadyAt: number;
  helpPingUntil: number;
  helpPingReadyAt: number;
  tags: number;
  rescues: number;
}

export interface LobbyView {
  inviteCode: string;
  hostPlayerId: string;
  phase: MatchPhase;
  phaseDeadline: number;
  serverTime: number;
  maxPlayers: number;
  minPlayers: number;
  iceCount: number;
  round: number;
  maxRounds: number;
  arenaHalfExtent: number;
  players: PlayerView[];
  projectiles: FrostProjectileView[];
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
  winner: 'ice' | 'water';
  reason: 'all-frozen' | 'rounds-complete';
}
export interface ClientMessages extends GameplayMessages {
  'room/start': Record<string, never>;
}
export interface ServerMessages extends GameplayEvents {
  'session/error': SessionError;
  'match/phase-changed': {
    phase: MatchPhase;
    phaseDeadline: number;
    serverTime: number;
    round?: number;
  };
  'match/result': MatchResult;
}
