import { describe, expect, it } from 'vitest';
import { GuestSessions } from './guest-session.js';
import { RateLimiter } from './rate-limiter.js';

describe('signed guest sessions', () => {
  it('issues independent identities and validates a signed token', () => {
    const service = new GuestSessions('a'.repeat(32), 60, () => 1000);
    const first = service.issue('Chad');
    const second = service.issue('Chad');
    expect(service.verify(first.token)).toMatchObject({
      playerId: first.playerId,
      displayName: 'Chad',
      expiresAt: 61000,
    });
    expect(second.playerId).not.toBe(first.playerId);
  });
  it('rejects tampering, malformed tokens, foreign signatures, and expiration at the deadline', () => {
    let now = 0;
    const service = new GuestSessions('a'.repeat(32), 60, () => now);
    const token = service.issue('Chad').token;
    for (const bad of [
      null,
      '',
      `${token}.extra`,
      token.slice(0, -1),
      token.replace(/^./, 'Z'),
      'a'.repeat(3000),
    ])
      expect(() => service.verify(bad)).toThrow();
    expect(() => new GuestSessions('b'.repeat(32), 60, () => now).verify(token)).toThrow();
    now = 59999;
    expect(service.verify(token)).toBeDefined();
    now = 60000;
    expect(() => service.verify(token)).toThrow();
  });
  it('refreshes the same identity without permitting a name change', () => {
    const service = new GuestSessions('a'.repeat(32), 60);
    const first = service.issue('Chad');
    const next = service.issue('Impostor', service.verify(first.token));
    expect(next.playerId).toBe(first.playerId);
    expect(next.displayName).toBe('Chad');
  });
});

it('rate-limits by key and resets at the exact window boundary', () => {
  let now = 0;
  const limiter = new RateLimiter(2, 1000, () => now);
  expect(limiter.take('one')).toBe(true);
  expect(limiter.take('one')).toBe(true);
  expect(limiter.take('one')).toBe(false);
  expect(limiter.take('two')).toBe(true);
  now = 1000;
  expect(limiter.take('one')).toBe(true);
});
