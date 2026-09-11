import { schema, t, type SchemaType } from '@colyseus/schema';
import {
  ARENA,
  MIN_PLAYERS,
  type MatchPhase,
  type Team,
  type PlayerStatus,
} from '@ice-water/shared';

export const PlayerState = schema(
  {
    playerId: t.string().default(''),
    displayName: t.string().default(''),
    team: t.string<Team>().default('unassigned'),
    isConnected: t.boolean().default(true),
    reconnectDeadline: t.number().default(0),
    x: t.float32().default(0),
    z: t.float32().default(0),
    yaw: t.float32().default(0),
    inputSequence: t.uint32().default(0),
    status: t.string<PlayerStatus>().default('active'),
    protectedUntil: t.number().default(0),
    rescueProgress: t.float32().default(0),
    rescuingTarget: t.string().default(''),
    tagReadyAt: t.number().default(0),
    helpPingUntil: t.number().default(0),
    helpPingReadyAt: t.number().default(0),
    tags: t.uint32().default(0),
    rescues: t.uint32().default(0),
  },
  'PlayerState',
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const LobbyState = schema(
  {
    inviteCode: t.string().default(''),
    hostPlayerId: t.string().default(''),
    phase: t.string<MatchPhase>().default('lobby'),
    phaseDeadline: t.number().default(0),
    serverTime: t.number().default(0),
    maxPlayers: t.uint16().default(150),
    minPlayers: t.uint8().default(MIN_PLAYERS),
    iceCount: t.uint8().default(0),
    round: t.uint8().default(0),
    maxRounds: t.uint8().default(0),
    arenaHalfExtent: t.float32().default(ARENA.halfExtent),
    matchWinner: t.string<'ice' | 'water' | ''>().default(''),
    players: t.map(PlayerState),
  },
  'LobbyState',
);
export type LobbyState = SchemaType<typeof LobbyState>;
