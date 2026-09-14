import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
  serverTime: number;
  hostPlayerId: string;
  players: Map<string, PlayerView>;
  gameMode: 'ffa' | 'tdm' | 'duel';
  matchWinner: string;
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
const saveMatchSummary = vi.fn(async () => true);
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
  for (const type of ['weapon/fired','player/hit','player/killed','player/respawned','match/result']) room.onMessage(type,()=>{});
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
  await waitFor(() => first.room.state.phase === 'playing');
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
  app = await startServer(config, {
    isReady: async () => isDatabaseReady,
    saveMatchSummary,
    close: async () => {},
  });
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
    await waitFor(() => room.state.phase === 'playing');
    expect([...room.state.players.values()].every(p=>p.team==='none')).toBe(true);
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
      await sendForError(actor.room, actorErrors, 'action/shoot', {
        yaw: 0,
        pitch: 0,
        status: 'eliminated',
      }),
    ).toMatchObject({ code: 'invalid-action', message: 'Invalid shot intent' });
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
    ).toBeLessThanOrEqual(GAMEPLAY.moveSpeed * 0.2);

    const rateStart = rateErrors.length;
    for (let index = 0; index < 26; index++) rateActor.room.send('action/reload', {});
    await waitFor(() => rateErrors.length >= rateStart + 26);
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
  it('synchronizes hits, death, respawn and dead-player reconnect through real sockets', async () => {
    const {participants}=await startMatch('Combat');
    const actor=participants[0]!,target=participants[1]!;
    const serverRoom=authoritativeRoom(actor.room);
    const a=serverRoom.state.players.get(actor.identity.playerId)!,b=serverRoom.state.players.get(target.identity.playerId)!;
    Object.assign(a,{x:-34,z:-30,y:0,protectedUntil:0});
    Object.assign(b,{x:-34,z:-33,y:0,hp:1,protectedUntil:0});
    actor.room.send('action/shoot',{yaw:0,pitch:0,isAds:true});
    await waitFor(()=>actor.room.state.players.get(target.identity.playerId)?.status==='dead');
    expect(actor.room.state.players.get(actor.identity.playerId)?.kills).toBe(1);
    expect(actor.room.state.players.get(target.identity.playerId)?.deaths).toBe(1);
    const deadline=b.respawnAt;
    const token=target.room.reconnectionToken;target.room.reconnection.enabled=false;target.room.connection.close(4010);
    await waitFor(()=>!b.isConnected);
    const reconnected:TestRoom=await new Client(url).reconnect<TestState>(token);rooms.push(reconnected);
    for(const type of ['player/respawned','weapon/fired','player/hit','player/killed','match/phase-changed','match/result'])reconnected.onMessage(type,()=>{});
    await waitFor(()=>reconnected.state?.players.get(target.identity.playerId)?.status==='dead');
    expect(b.respawnAt).toBe(deadline);
    await waitFor(()=>actor.room.state.players.get(target.identity.playerId)?.status==='alive');
    expect(b.hp).toBe(100);expect(b.deaths).toBe(1);
    await Promise.all([reconnected.leave(),...participants.filter(p=>p!==target).map(p=>p.room.leave())]);
  });
  it('keeps match results through their deadline, then disposes the room and invite once', async () => {
    const { participants, code } = await startMatch('Cleanup');
    const observer = participants[0]!;
    const serverRoom = authoritativeRoom(observer.room);
    serverRoom.setTimestep(() => {}, 60_000);
    const reconnectToken = observer.room.reconnectionToken;
    const writesBefore=saveMatchSummary.mock.calls.length;
    serverRoom.state.players.get(observer.identity.playerId)!.kills=GAMEPLAY.ffaScoreLimit;
    const completedAt = Date.now();
    advanceRoom(serverRoom, completedAt);
    await waitFor(() => ['finished','intermission'].includes(observer.room.state.phase));
    await vi.waitFor(() => expect(saveMatchSummary).toHaveBeenCalled());
    const deadline = serverRoom.state.phaseDeadline;

    advanceRoom(serverRoom, deadline - 1);
    expect(matchMaker.getLocalRoomById(observer.room.roomId)).toBe(serverRoom);
    expect(serverRoom.state.serverTime).toBe(deadline - 1);

    advanceRoom(serverRoom, deadline);
    await waitFor(() => !matchMaker.getLocalRoomById(observer.room.roomId));
    expect(saveMatchSummary).toHaveBeenCalledTimes(writesBefore+1);
    await expect(new Client(url).reconnect<TestState>(reconnectToken)).rejects.toThrow();
    expect(
      (await post('/api/rooms/join', { inviteCode: code }, (await guest()).token)).status,
    ).toBe(404);
  });
  it('rate-limits repeated room operations by authenticated guest', async () => {
    const identity = await guest('Rate Guest');
    const responses = [];
    for (let index = 0; index < 11; index++)
      responses.push(await post('/api/rooms/join', { inviteCode: 'ABCDEFGH' }, identity.token));
    expect(responses.at(-1)?.status).toBe(429);
  });
});

