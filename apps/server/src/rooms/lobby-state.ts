import { schema, t, type SchemaType } from '@colyseus/schema';
import { MIN_PLAYERS, type MatchPhase, type Team } from '@ice-water/shared';

export const PlayerState = schema(
  {
    playerId: t.string().default(''),
    displayName: t.string().default(''),
    team: t.string<Team>().default('unassigned'),
    isConnected: t.boolean().default(true),
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
    players: t.map(PlayerState),
  },
  'LobbyState',
);
export type LobbyState = SchemaType<typeof LobbyState>;
