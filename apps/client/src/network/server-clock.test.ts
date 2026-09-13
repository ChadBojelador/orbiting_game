import { describe, expect, it } from 'vitest';
import { ServerClock } from './server-clock.js';

describe('ServerClock', () => {
  it('does not jump backward when a delayed state patch arrives', () => {
    const clock = new ServerClock();
    clock.update(10_000, 100);

    expect(clock.now(175)).toBe(10_075);
    clock.update(10_050, 200);
    expect(clock.now(200)).toBe(10_100);
    expect(clock.now(250)).toBe(10_150);
  });

  it('accepts a newer authoritative time and extrapolates from it', () => {
    const clock = new ServerClock();
    clock.update(10_000, 100);
    clock.update(10_500, 200);

    expect(clock.now(200)).toBe(10_500);
    expect(clock.now(275)).toBe(10_575);
  });
});
