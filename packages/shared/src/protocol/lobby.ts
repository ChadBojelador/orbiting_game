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
export interface ClientMessages {
  'room/start': Record<string, never>;
}
export interface ServerMessages {
  'session/error': SessionError;
  'match/phase-changed': { phase: MatchPhase; phaseDeadline: number; serverTime: number };
}
