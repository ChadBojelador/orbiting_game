import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import {
  type GuestSession,
  type RoomReservation,
  type SessionError,
  type PlayerView,
  type MatchPhase,
} from '@ice-water/shared';
import { startServer } from './app.js';
import { readConfig } from './config/environment.js';

interface TestState {
  phase: MatchPhase;
  hostPlayerId: string;
  players: Map<string, PlayerView>;
  iceCount: number;
}
type TestRoom = Room<unknown, TestState>;
let app: Awaited<ReturnType<typeof startServer>>;
let url: string;
const rooms: TestRoom[] = [];
let isDatabaseReady = true;
const config = readConfig({
  GUEST_SESSION_SIGNING_SECRET: 'test-secret-with-at-least-32-characters',
  GAME_SERVER_PORT: '0',
  ROOM_MAX_PLAYERS: '6',
  COUNTDOWN_SECONDS: '1',
});
async function post(path: string, body: unknown, token?: string) {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function guest(name = 'Snow Guest'): Promise<GuestSession> {
  return (await post('/api/guest-session', { displayName: name })).json() as Promise<GuestSession>;
}
async function enter(
  identity: GuestSession,
  inviteCode?: string,
): Promise<{ room: TestRoom; code: string }> {
  const response = await post(
    inviteCode ? '/api/rooms/join' : '/api/rooms',
    inviteCode ? { inviteCode } : {},
    identity.token,
  );
  expect(response.status).toBe(inviteCode ? 200 : 201);
  const reservation = (await response.json()) as RoomReservation;
  const room: TestRoom = await new Client(url).consumeSeatReservation<TestState>(reservation.seat);
  rooms.push(room);
  room.onMessage('match/phase-changed', () => {});
  await waitFor(() => !!room.state?.players);
  return { room, code: reservation.inviteCode };
}
async function waitFor(predicate: () => boolean) {
  await expect.poll(predicate, { timeout: 5000, interval: 25 }).toBe(true);
}

beforeAll(async () => {
  app = await startServer(config, { isReady: async () => isDatabaseReady, close: async () => {} });
  url = `http://127.0.0.1:${app.port}`;
});
afterAll(async () => {
  for (const room of rooms) room.reconnection.enabled = false;
  await app.stop();
});

describe('HTTP and real WebSocket room flow', () => {
  it('reports health and readiness, sanitizes guests, and validates requests', async () => {
    expect((await fetch(`${url}/health`)).status).toBe(200);
    expect((await fetch(`${url}/ready`)).status).toBe(200);
    isDatabaseReady = false;
    expect((await fetch(`${url}/ready`)).status).toBe(503);
    expect((await fetch(`${url}/health`)).status).toBe(200);
    isDatabaseReady = true;
    expect((await guest('  Ｓnow  Guest! ')).displayName).toBe('Snow Guest');
    expect((await post('/api/guest-session', { displayName: '<>' })).status).toBe(400);
    expect((await post('/api/rooms', {})).status).toBe(401);
    expect((await post('/api/rooms', {}, 'forged')).status).toBe(401);
    expect(
      (await fetch(`${url}/health`, { headers: { Origin: 'https://untrusted.example' } })).status,
    ).toBe(403);
    expect(
      (
        await fetch(`${url}/api/guest-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{bad',
        })
      ).status,
    ).toBe(400);
    expect((await post('/api/guest-session', { displayName: 'a'.repeat(5000) })).status).toBe(400);
  });
  it('blocks built-in matchmaking, room enumeration, and custom capacity injection', async () => {
    expect((await post('/matchmake/create/private-game', {})).status).toBe(403);
    expect((await post('/matchmake/joinOrCreate/private-game', {})).status).toBe(403);
    expect((await fetch(`${url}/matchmake/private-game`)).status).toBe(403);
    const identity = await guest();
    expect((await post('/api/rooms', { maxPlayers: 1000 }, identity.token)).status).toBe(400);
    expect((await post('/api/rooms/join', { inviteCode: 'ABCDEFGH' }, identity.token)).status).toBe(
      404,
    );
  });
  it('creates and joins by invite; enforces identity, capacity, host start and late-join rejection', async () => {
    const host = await guest('Host');
    const { room, code } = await enter(host);
    expect(room.state.hostPlayerId).toBe(host.playerId);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await post('/api/rooms/join', { inviteCode: code }, host.token)).status).toBe(409);
    const startError = new Promise<SessionError>((resolve) =>
      room.onMessage('session/error', resolve),
    );
    room.send('room/start', {});
    expect((await startError).message).toContain('six');
    const others: TestRoom[] = [];
    for (let index = 0; index < 5; index++)
      others.push((await enter(await guest(`Guest ${index}`), code)).room);
    await waitFor(() => room.state.players.size === 6);
    const intruder = await guest('Extra Guest');
    expect((await post('/api/rooms/join', { inviteCode: code }, intruder.token)).status).toBe(409);
    const other = others[0]!;
    const unauthorized = new Promise<SessionError>((resolve) =>
      other.onMessage('session/error', resolve),
    );
    other.send('room/start', {});
    expect((await unauthorized).message).toContain('host');
    const invalid = new Promise<SessionError>((resolve) =>
      room.onMessage('session/error', resolve),
    );
    room.send('room/start', { playerId: host.playerId });
    expect((await invalid).code).toBe('invalid-message');
    room.send('room/start', {});
    await waitFor(() => room.state.phase === 'countdown');
    await waitFor(() => room.state.phase === 'regular');
    expect(room.state.iceCount).toBe(1);
    expect(
      [...room.state.players.values()].filter((player) => player.team === 'water'),
    ).toHaveLength(5);
    expect((await post('/api/rooms/join', { inviteCode: code }, intruder.token)).status).toBe(409);
    await Promise.all([room, ...others].map((client) => client.leave()));
  });
  it('transfers the host on leave and disposes empty invite codes', async () => {
    const host = await guest('Old Host');
    const next = await guest('Next Host');
    const first = await enter(host);
    const second = await enter(next, first.code);
    await first.room.leave();
    await waitFor(() => second.room.state.hostPlayerId === next.playerId);
    await second.room.leave();
    await expect
      .poll(
        async () =>
          (await post('/api/rooms/join', { inviteCode: first.code }, (await guest()).token)).status,
      )
      .toBe(404);
  });
  it('reclaims the same player after an unexpected socket drop', async () => {
    const identity = await guest('Reconnect Guest');
    const first = await enter(identity);
    const watcher = await enter(await guest('Watcher'), first.code);
    const token = first.room.reconnectionToken;
    first.room.reconnection.enabled = false;
    first.room.connection.close(4010);
    await waitFor(() => watcher.room.state.players.get(identity.playerId)?.isConnected === false);
    const reconnected: TestRoom = await new Client(url).reconnect<TestState>(token);
    rooms.push(reconnected);
    reconnected.onMessage('match/phase-changed', () => {});
    await waitFor(() => watcher.room.state.players.get(identity.playerId)?.isConnected === true);
    expect(watcher.room.state.players.size).toBe(2);
    await reconnected.leave();
    await watcher.room.leave();
  });
  it('rate-limits repeated room operations by authenticated guest', async () => {
    const identity = await guest('Rate Guest');
    const responses = [];
    for (let index = 0; index < 11; index++)
      responses.push(await post('/api/rooms/join', { inviteCode: 'ABCDEFGH' }, identity.token));
    expect(responses.at(-1)?.status).toBe(429);
  });
});
