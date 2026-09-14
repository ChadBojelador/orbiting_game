import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAMEPLAY, type PlayerStatus } from '@ice-water/shared';
import { GuestSessions, type GuestIdentity } from '../auth/guest-session.js';
import { readConfig } from '../config/environment.js';
import type { MatchController } from '../gameplay/match-controller.js';
import { createPrivateRoom } from './private-room.js';
import { PlayerState } from './lobby-state.js';
import { RoomDirectory } from './room-directory.js';
import type { Database } from '../persistence/database.js';

const NOW = 1_800_000_000_000;
const config = readConfig({
  GUEST_SESSION_SIGNING_SECRET: 'test-secret-with-at-least-32-characters',
  RECONNECT_SECONDS: '25',
});
const database: Database = {
  isReady: async () => true,
  saveMatchSummary: async () => true,
  close: async () => {},
};
const PrivateRoom = createPrivateRoom({
  config,
  sessions: new GuestSessions(config.signingSecret, config.sessionTtlSeconds),
  directory: new RoomDirectory(),
  database,
});
type TestRoom = InstanceType<typeof PrivateRoom>;
type GuestClient = Parameters<TestRoom['onDrop']>[0];

function setup(status: PlayerStatus, phase: TestRoom['state']['phase'] = 'regular') {
  const room = new PrivateRoom();
  room.state.phase = phase;
  room.state.phaseDeadline = NOW + 10_000;
  const player = new PlayerState();
  player.playerId = 'water-player';
  player.displayName = 'Water Player';
  player.team = 'water';
  player.status = status;
  player.x = 12;
  player.z = -7;
  room.state.players.set(player.playerId, player);

  const identity: GuestIdentity = {
    playerId: player.playerId,
    sessionId: 'guest-session',
    displayName: player.displayName,
    expiresAt: NOW + 60_000,
  };
  const leave = vi.fn(() => Promise.resolve());
  const client = {
    auth: identity,
    sessionId: 'room-session',
    leave,
  } as unknown as GuestClient;
  return { room, player, client, leave };
}

function resolveReconnection(room: TestRoom, client: GuestClient): void {
  vi.spyOn(room, 'allowReconnection').mockReturnValue(
    Promise.resolve(client) as unknown as ReturnType<TestRoom['allowReconnection']>,
  );
}

function expireReconnection(room: TestRoom): void {
  vi.spyOn(room, 'allowReconnection').mockReturnValue(
    Promise.reject(new Error('expired')) as unknown as ReturnType<TestRoom['allowReconnection']>,
  );
}

describe('PrivateRoom active-match reconnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each<PlayerStatus>(['active', 'frozen', 'eliminated'])(
    'restores the same authoritative %s state within the reservation',
    async (status) => {
      const { room, player, client } = setup(status);
      resolveReconnection(room, client);

      await room.onDrop(client);
      expect(player.isConnected).toBe(false);
      expect(player.reconnectDeadline).toBe(NOW + config.reconnectSeconds * 1000);
      expect(player.status).toBe(status);

      room.onReconnect(client);
      expect(player.isConnected).toBe(true);
      expect(player.reconnectDeadline).toBe(0);
      expect(player.status).toBe(status);
      expect({ x: player.x, z: player.z, team: player.team }).toEqual({
        x: 12,
        z: -7,
        team: 'water',
      });
    },
  );

  it('reconnects during Deep Freeze without changing the phase or deadline', async () => {
    const { room, player, client } = setup('active', 'deep-freeze');
    resolveReconnection(room, client);

    await room.onDrop(client);
    room.onReconnect(client);

    expect(player.status).toBe('active');
    expect(room.state.phase).toBe('deep-freeze');
    expect(room.state.phaseDeadline).toBe(NOW + 10_000);
  });

  it.each(['regular', 'warning', 'deep-freeze', 'round-result', 'match-result'] as const)(
    'updates authoritative server time during %s ticks',
    (phase) => {
      const { room } = setup('active', phase);
      vi.spyOn(room, 'broadcast').mockImplementation(() => {});
      const tickAt = NOW + 500;

      const advance = Reflect.get(room, 'advance') as (now: number) => void;
      advance.call(room, tickAt);

      expect(room.state.serverTime).toBe(tickAt);
    },
  );

  it('refreshes server time before a reconnecting client receives state', () => {
    const { room, client } = setup('active');
    const player = room.state.players.get(client.auth!.playerId)!;
    player.isConnected = false;
    player.reconnectDeadline = NOW + 10_000;
    room.state.serverTime = NOW - 5_000;

    room.onReconnect(client);

    expect(room.state.serverTime).toBe(NOW);
  });

  it.each<PlayerStatus>(['active', 'frozen'])(
    'permanently eliminates a %s participant when the reservation expires',
    async (status) => {
      const { room, player, client, leave } = setup(status);
      expireReconnection(room);

      await room.onDrop(client);
      room.onLeave(client);

      expect(player.isConnected).toBe(false);
      expect(player.reconnectDeadline).toBe(0);
      expect(player.status).toBe('eliminated');

      room.onReconnect(client);
      expect(leave).toHaveBeenCalledWith(4001);
      expect(player.isConnected).toBe(false);
    },
  );

  it('keeps an already eliminated participant eliminated when the reservation expires', async () => {
    const { room, player, client } = setup('eliminated');
    expireReconnection(room);

    await room.onDrop(client);
    room.onLeave(client);

    expect(player.status).toBe('eliminated');
    expect(player.reconnectDeadline).toBe(0);
  });

  it('resolves the Deep Freeze deadline before finalizing an expired reservation', async () => {
    const { room, player, client } = setup('active');
    const survivor = new PlayerState();
    survivor.playerId = 'water-survivor';
    survivor.team = 'water';
    survivor.status = 'active';
    room.state.players.set(survivor.playerId, survivor);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {});
    const match = Reflect.get(room, 'match') as MatchController;
    const matchStartedAt = NOW - GAMEPLAY.regularMs - GAMEPLAY.deepFreezeMs;
    match.start(matchStartedAt);
    match.tick(matchStartedAt + GAMEPLAY.regularMs);
    player.status = 'frozen';
    expireReconnection(room);

    await room.onDrop(client);
    room.onLeave(client);

    expect(room.state.phase).toBe('round-result');
    expect(player.status).toBe('eliminated');
    expect(
      vi
        .mocked(room.broadcast)
        .mock.calls.some(
          ([type, payload]) =>
            type === 'player/permanently-frozen' &&
            (payload as { playerId?: string }).playerId === player.playerId,
        ),
    ).toBe(true);
  });

  it('logs a summary write failure once without changing the completed room state', async () => {
    const saveMatchSummary = vi.fn(async () => {
      throw new Error('database unavailable');
    });
    const localDatabase: Database = { ...database, saveMatchSummary };
    const LocalPrivateRoom = createPrivateRoom({
      config,
      sessions: new GuestSessions(config.signingSecret, config.sessionTtlSeconds),
      directory: new RoomDirectory(),
      database: localDatabase,
    });
    const room = new LocalPrivateRoom();
    vi.spyOn(room, 'broadcast').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ice = new PlayerState();
    ice.playerId = 'ice-player';
    ice.team = 'ice';
    const water = new PlayerState();
    water.playerId = 'water-player';
    water.team = 'water';
    water.rescues = 2;
    room.state.players.set(ice.playerId, ice);
    room.state.players.set(water.playerId, water);
    room.state.maxRounds = GAMEPLAY.maxRounds;
    const match = Reflect.get(room, 'match') as MatchController;

    match.start(NOW);
    water.status = 'frozen';
    match.tick(NOW + 1);
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    match.tick(NOW + 2);

    expect(room.state.phase).toBe('match-result');
    expect(room.state.matchWinner).toBe('ice');
    expect(saveMatchSummary).toHaveBeenCalledOnce();
    expect(saveMatchSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        winner: 'ice',
        resultReason: 'all-frozen',
        finalRound: 1,
        maxRounds: GAMEPLAY.maxRounds,
        players: expect.arrayContaining([
          expect.objectContaining({
            playerId: water.playerId,
            team: 'water',
            finalStatus: 'frozen',
            rescues: 2,
          }),
        ]),
      }),
    );
    expect(error).toHaveBeenCalledWith(expect.stringContaining('match-summary/write-failed'));
    error.mockRestore();
  });
});
