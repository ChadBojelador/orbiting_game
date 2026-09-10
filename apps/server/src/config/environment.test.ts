import { expect, it } from 'vitest';
import { readConfig } from './environment.js';

const valid = { GUEST_SESSION_SIGNING_SECRET: 'test-only-valid-signing-secret-with-32-characters' };
it('validates secrets, capacity, reconnection windows, and production transport configuration', () => {
  expect(readConfig(valid)).toMatchObject({
    maxPlayers: 150,
    countdownSeconds: 5,
    reconnectSeconds: 25,
  });
  for (const override of [
    { GUEST_SESSION_SIGNING_SECRET: 'replace-with-a-long-random-secret' },
    { GUEST_SESSION_SIGNING_SECRET: '' },
    { ROOM_MAX_PLAYERS: '151' },
    { ROOM_MAX_PLAYERS: '5' },
    { RECONNECT_SECONDS: '19' },
    { RECONNECT_SECONDS: '31' },
    { COUNTDOWN_SECONDS: '0' },
    { GAME_SERVER_PORT: 'nope' },
    { CLIENT_ORIGIN: 'https://game.example/path' },
    { NODE_ENV: 'production', CLIENT_ORIGIN: 'http://game.example' },
    { NODE_ENV: 'production', CLIENT_ORIGIN: 'https://game.example' },
    { DATABASE_URL: 'http://db.example' },
  ])
    expect(() => readConfig({ ...valid, ...override })).toThrow();
});
