import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Client, type Room } from '@colyseus/sdk';
import type { GuestSession, PlayerView, RoomReservation } from '@ice-water/shared';
import { startServer } from '../../apps/server/src/app.js';
import { readConfig } from '../../apps/server/src/config/environment.js';

interface LoadState {
  phase: string;
  iceCount: number;
  players: Map<string, PlayerView>;
}
const requested = process.argv.slice(2).map(Number);
const sizes = requested.length ? requested : [20, 50, 100, 150];
if (sizes.some((size) => ![20, 50, 100, 150].includes(size)))
  throw new Error('Use staged sizes: 20, 50, 100, 150');
const app = await startServer(
  readConfig({
    GUEST_SESSION_SIGNING_SECRET: 'load-test-only-secret-at-least-32-characters',
    GAME_SERVER_PORT: '0',
    COUNTDOWN_SECONDS: '1',
  }),
);
const url = `http://127.0.0.1:${app.port}`;
async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(url + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  assert.ok(response.ok, `HTTP ${response.status} from ${path}`);
  return response.json() as Promise<T>;
}
async function until(predicate: () => boolean) {
  const deadline = Date.now() + 15000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Lobby state synchronization timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
try {
  for (const size of sizes) {
    const rooms: Room<unknown, LoadState>[] = [];
    const started = performance.now();
    try {
      let code: string | undefined;
      for (let index = 0; index < size; index++) {
        const guest = await post<GuestSession>('/api/guest-session', {
          displayName: `Load ${size} ${index}`,
        });
        const seat = await post<RoomReservation>(
          code ? '/api/rooms/join' : '/api/rooms',
          code ? { inviteCode: code } : {},
          guest.token,
        );
        code = seat.inviteCode;
        const room: Room<unknown, LoadState> = await new Client(
          url,
        ).consumeSeatReservation<LoadState>(seat.seat);
        room.onMessage('match/phase-changed', () => {});
        rooms.push(room);
      }
      await until(() => rooms.every((room) => room.state?.players.size === size));
      const joinMs = Math.round(performance.now() - started);
      rooms[0]!.send('room/start', {});
      await until(() => rooms.every((room) => room.state.phase === 'regular'));
      const expectedIce = rooms[0]!.state.iceCount;
      assert.ok(
        rooms.every(
          (room) =>
            [...room.state.players.values()].filter((player) => player.team === 'ice').length ===
            expectedIce,
        ),
      );
      console.log(
        JSON.stringify({
          scenario: 'lobby-and-role-assignment',
          clients: size,
          joinMs,
          icePlayers: expectedIce,
          elapsedMs: Math.round(performance.now() - started),
          result: 'passed',
        }),
      );
    } finally {
      await Promise.all(rooms.map((room) => room.leave().catch(() => {})));
    }
  }
} finally {
  await app.stop();
}
