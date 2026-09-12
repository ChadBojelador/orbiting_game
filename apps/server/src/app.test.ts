import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker, type Room as ServerRoom } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import {
  GAMEPLAY,
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
  phaseDeadline: number;
  hostPlayerId: string;
  players: Map<string, PlayerView>;
  iceCount: number;
}
type TestRoom = Room<unknown, TestState>;
type AuthoritativeRoom = ServerRoom & { state: TestState };
interface Participant {
  identity: GuestSession;
  room: TestRoom;
}
let app: Awaited<ReturnType<typeof startServer>>;
let url: string;
const rooms: TestRoom[] = [];
let isDatabaseReady = true;
const config = {
  ...readConfig({
    GUEST_SESSION_SIGNING_SECRET: 'test-secret-with-at-least-32-characters',
    GAME_SERVER_PORT: '0',
    ROOM_MAX_PLAYERS: '6',
    COUNTDOWN_SECONDS: '1',
  }),
  // Keep production validation at 20–30 seconds; only accelerate integration expiry.
  reconnectSeconds: 1,
};
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
  room.onMessage('arena/boundary-changed', () => {});
  room.onMessage('player/frozen', () => {});
  room.onMessage('frost/thrown', () => {});
  room.onMessage('player/permanently-frozen', () => {});
  await waitFor(() => !!room.state?.players);
  return { room, code: reservation.inviteCode };
}
async function waitFor(predicate: () => boolean, timeout = 5000) {
  await expect.poll(predicate, { timeout, interval: 25 }).toBe(true);
}
async function startMatch(prefix: string): Promise<{ participants: Participant[]; code: string }> {
  const hostIdentity = await guest(`${prefix} Host`);
  const first = await enter(hostIdentity);
  const participants: Participant[] = [{ identity: hostIdentity, room: first.room }];
  for (let index = 1; index < 6; index++) {
    const identity = await guest(`${prefix} ${index}`);
    participants.push({ identity, room: (await enter(identity, first.code)).room });
  }
  await waitFor(() => first.room.state.players.size === 6);
  first.room.send('room/start', {});
  await waitFor(() => first.room.state.phase === 'regular');
  return { participants, code: first.code };
}
function authoritativeRoom(room: TestRoom): AuthoritativeRoom {
  const current = matchMaker.getLocalRoomById(room.roomId);
  if (!current) throw new Error('Authoritative room is unavailable');
  return current as AuthoritativeRoom;
}
function advanceRoom(room: AuthoritativeRoom, now: number): void {
  const advance: unknown = Reflect.get(room, 'advance');
  if (typeof advance !== 'function') throw new Error('Room advance hook is unavailable');
  Reflect.apply(advance, room, [now]);
  room.broadcastPatch();
}
function errorInbox(room: TestRoom) {
  const errors: SessionError[] = [];
  room.onMessage<SessionError>('session/error', (error) => errors.push(error));
  return errors;
}
async function sendForError(
  room: TestRoom,
  errors: SessionError[],
  type: string,
  payload: unknown,
): Promise<SessionError> {
  const index = errors.length;
  room.send(type, payload);
  await waitFor(() => errors.length > index);
  return errors[index]!;
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
  it('rejects malformed gameplay, stale sequences, forged outcomes, and action floods', async () => {
    const { participants } = await startMatch('Authority');
    const actor = participants[0]!;
    const rateActor = participants[1]!;
    const actorErrors = errorInbox(actor.room);
    const rateErrors = errorInbox(rateActor.room);
    const before = actor.room.state.players.get(actor.identity.playerId)!;
    const original = {
      x: before.x,
      y: before.y,
      z: before.z,
      team: before.team,
      status: before.status,
    };

    expect(
      await sendForError(actor.room, actorErrors, 'input/move', {
        x: 2,
        z: 0,
        sequence: 1,
      }),
    ).toMatchObject({ code: 'invalid-action', message: 'Invalid movement input' });
    expect(
      await sendForError(actor.room, actorErrors, 'input/move', {
        x: 0,
        z: 0,
        sequence: 1,
        jump: 'yes',
      }),
    ).toMatchObject({ code: 'invalid-action', message: 'Invalid movement input' });
    expect(
      await sendForError(actor.room, actorErrors, 'action/frost-throw', {
        directionX: 1,
        directionY: 0,
        directionZ: 0,
        status: 'eliminated',
      }),
    ).toMatchObject({ code: 'invalid-action', message: 'Invalid frost throw' });
    expect(
      await sendForError(actor.room, actorErrors, 'match/result', {
        winner: 'water',
      }),
    ).toMatchObject({ code: 'invalid-message' });

    actor.room.send('input/move', { x: 1, z: 0, sequence: 1, jump: true });
    await waitFor(() => actor.room.state.players.get(actor.identity.playerId)?.inputSequence === 1);
    await waitFor(() => actor.room.state.players.get(actor.identity.playerId)!.y > original.y);
    expect(
      await sendForError(actor.room, actorErrors, 'input/move', {
        x: 1,
        z: 0,
        sequence: 1,
      }),
    ).toMatchObject({ code: 'invalid-action', message: 'Stale or invalid input sequence' });

    const authoritative = actor.room.state.players.get(actor.identity.playerId)!;
    expect({ team: authoritative.team, status: authoritative.status }).toEqual({
      team: original.team,
      status: original.status,
    });
    expect(
      Math.hypot(authoritative.x - original.x, authoritative.z - original.z),
    ).toBeLessThanOrEqual((GAMEPLAY.moveSpeed * GAMEPLAY.tickMs) / 1000 + 0.001);

    const rateStart = rateErrors.length;
    for (let index = 0; index < 13; index++) rateActor.room.send('action/help-ping', {});
    await waitFor(() => rateErrors.length >= rateStart + 13);
    expect(rateErrors.slice(rateStart)).toContainEqual({
      code: 'invalid-action',
      message: 'Too many gameplay requests',
    });

    await Promise.all(participants.map(({ room }) => room.leave()));
  });
  it('expires a dropped host reservation, transfers host, rejects reconnect, and disposes', async () => {
    const host = await guest('Expiring Host');
    const watcherIdentity = await guest('Expiry Watcher');
    const first = await enter(host);
    const watcher = await enter(watcherIdentity, first.code);
    const token = first.room.reconnectionToken;
    first.room.reconnection.enabled = false;
    first.room.connection.close(4010);

    await waitFor(() => watcher.room.state.players.get(host.playerId)?.isConnected === false);
    await waitFor(() => !watcher.room.state.players.has(host.playerId), 3000);
    expect(watcher.room.state.hostPlayerId).toBe(watcherIdentity.playerId);
    await expect(new Client(url).reconnect<TestState>(token)).rejects.toThrow();

    await watcher.room.leave();
    await waitFor(() => !matchMaker.getLocalRoomById(first.room.roomId));
    await expect
      .poll(
        async () =>
          (await post('/api/rooms/join', { inviteCode: first.code }, (await guest()).token)).status,
      )
      .toBe(404);
  });
  it('applies pre-deadline intent before atomic resolution and rejects post-deadline intent', async () => {
    const { participants } = await startMatch('Deadline');
    const observer = participants[0]!;
    const serverRoom = authoritativeRoom(observer.room);
    // Pause automatic simulation while preserving a patch loop we can flush manually.
    serverRoom.setTimestep(() => {}, 60_000);

    const icePlayer = [...observer.room.state.players.values()].find(
      (player) => player.team === 'ice',
    )!;
    const targetPlayer = [...observer.room.state.players.values()].find(
      (player) => player.team === 'water' && player.playerId !== observer.identity.playerId,
    )!;
    const ice = participants.find(({ identity }) => identity.playerId === icePlayer.playerId)!;
    const target = participants.find(
      ({ identity }) => identity.playerId === targetPlayer.playerId,
    )!;
    const authoritativeIce = serverRoom.state.players.get(ice.identity.playerId)!;
    const authoritativeTarget = serverRoom.state.players.get(target.identity.playerId)!;
    authoritativeIce.x = 0;
    authoritativeIce.z = 0;
    authoritativeTarget.x = 1;
    authoritativeTarget.z = 0;
    advanceRoom(serverRoom, Date.now() + GAMEPLAY.tickMs);

    const frozen = new Promise<{ playerId: string }>((resolve) =>
      observer.room.onMessage('player/frozen', resolve),
    );
    const throwAt = Date.now();
    ice.room.send('action/frost-throw', {
      directionX: 1,
      directionY: 0,
      directionZ: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    advanceRoom(serverRoom, throwAt + 2 * GAMEPLAY.tickMs);
    expect((await frozen).playerId).toBe(target.identity.playerId);
    serverRoom.broadcastPatch();
    await waitFor(
      () => observer.room.state.players.get(target.identity.playerId)?.status === 'frozen',
    );

    const reconnectToken = target.room.reconnectionToken;
    target.room.reconnection.enabled = false;
    target.room.connection.close(4010);
    await waitFor(
      () => serverRoom.state.players.get(target.identity.playerId)?.isConnected === false,
    );
    serverRoom.broadcastPatch();
    await waitFor(
      () => observer.room.state.players.get(target.identity.playerId)?.isConnected === false,
    );

    const deadline = Date.now() + 100;
    serverRoom.state.phase = 'deep-freeze';
    serverRoom.state.phaseDeadline = deadline;
    serverRoom.broadcastPatch();
    const sequence = authoritativeIce.inputSequence + 1;
    const startingX = authoritativeIce.x;
    const permanentlyFrozen = new Promise<{ playerId: string; serverTime: number }>((resolve) =>
      observer.room.onMessage('player/permanently-frozen', resolve),
    );
    ice.room.send('input/move', { x: 1, z: 0, sequence });
    await new Promise((resolve) => setTimeout(resolve, 25));
    advanceRoom(serverRoom, deadline);

    expect(await permanentlyFrozen).toEqual({
      playerId: target.identity.playerId,
      serverTime: deadline,
    });
    await waitFor(() => observer.room.state.phase === 'round-result');
    expect(observer.room.state.players.get(target.identity.playerId)?.status).toBe('eliminated');
    expect(observer.room.state.players.get(ice.identity.playerId)?.inputSequence).toBe(sequence);
    expect(observer.room.state.players.get(ice.identity.playerId)!.x).toBeGreaterThan(startingX);

    const iceErrors = errorInbox(ice.room);
    expect(
      await sendForError(ice.room, iceErrors, 'input/move', {
        x: 1,
        z: 0,
        sequence: sequence + 1,
      }),
    ).toMatchObject({ code: 'invalid-action', message: 'Gameplay is unavailable in this phase' });

    const reconnected: TestRoom = await new Client(url).reconnect<TestState>(reconnectToken);
    rooms.push(reconnected);
    await waitFor(
      () => reconnected.state.players.get(target.identity.playerId)?.status === 'eliminated',
    );
    await Promise.all([
      reconnected.leave(),
      ...participants.filter(({ room }) => room !== target.room).map(({ room }) => room.leave()),
    ]);
  });
  it('rate-limits repeated room operations by authenticated guest', async () => {
    const identity = await guest('Rate Guest');
    const responses = [];
    for (let index = 0; index < 11; index++)
      responses.push(await post('/api/rooms/join', { inviteCode: 'ABCDEFGH' }, identity.token));
    expect(responses.at(-1)?.status).toBe(429);
  });
});
