import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ICE_BRACKETS, parseIceBrackets, type IceBracket } from './ice-brackets.js';

export interface ServerConfig {
  host: string;
  port: number;
  clientOrigin: string;
  signingSecret: string;
  databaseUrl?: string;
  isProduction: boolean;
  maxPlayers: number;
  /** Non-zero only in development. Bots fill seats so solo testing is possible. */
  devBotCount: number;
  countdownSeconds: number;
  reconnectSeconds: number;
  sessionTtlSeconds: number;
  iceBrackets: readonly IceBracket[];
}

export function loadEnvironment(): void {
  const path = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = env[key] === undefined ? fallback : Number(env[key]);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  };
  const secret = env.GUEST_SESSION_SIGNING_SECRET ?? '';
  if (secret.length < 32 || /replace|example/i.test(secret))
    throw new Error(
      'Set GUEST_SESSION_SIGNING_SECRET to a random secret of at least 32 characters',
    );
  const isProduction = env.NODE_ENV === 'production';
  const origin = new URL(env.CLIENT_ORIGIN ?? 'http://localhost:5173');
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.origin !== origin.href.replace(/\/$/, '') ||
    origin.username ||
    origin.password
  )
    throw new Error('Invalid CLIENT_ORIGIN');
  if (isProduction && origin.protocol !== 'https:')
    throw new Error('Production CLIENT_ORIGIN must use HTTPS');
  if (isProduction && !env.DATABASE_URL) throw new Error('Production requires DATABASE_URL');
  if (env.DATABASE_URL) {
    const database = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(database.protocol))
      throw new Error('Invalid DATABASE_URL');
  }
  return {
    host: env.GAME_SERVER_HOST ?? '127.0.0.1',
    port: integer('GAME_SERVER_PORT', 2567, 0, 65535),
    clientOrigin: origin.origin,
    signingSecret: secret,
    databaseUrl: env.DATABASE_URL || undefined,
    isProduction,
    maxPlayers: integer('ROOM_MAX_PLAYERS', 150, 6, 150),
    devBotCount: isProduction ? 0 : integer('DEV_BOT_COUNT', 0, 0, 149),
    countdownSeconds: integer('COUNTDOWN_SECONDS', 5, 1, 30),
    reconnectSeconds: integer('RECONNECT_SECONDS', 25, 20, 30),
    sessionTtlSeconds: integer('GUEST_SESSION_TTL_SECONDS', 3600, 60, 86400),
    iceBrackets: env.ICE_COUNT_BRACKETS
      ? parseIceBrackets(JSON.parse(env.ICE_COUNT_BRACKETS) as unknown)
      : DEFAULT_ICE_BRACKETS,
  };
}
