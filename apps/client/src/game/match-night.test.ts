import { describe, expect, it } from 'vitest';
import {
  NIGHTFALL_DURATION_MS,
  NIGHTFALL_START_MS,
  TWO_MINUTE_WARNING_DURATION_MS,
  isTwoMinuteWarningVisible,
  matchEnvironmentFor,
  matchNightProgress,
} from './match-night.js';
import { waterEnvironmentFor } from './water-presentation.js';

describe('match nightfall', () => {
  it('smoothly changes day maps to night from the authoritative two-minute mark', () => {
    expect(matchNightProgress('frostline', NIGHTFALL_START_MS + 1, false)).toBe(0);
    expect(matchNightProgress('frostline', NIGHTFALL_START_MS, false)).toBe(0);
    expect(
      matchNightProgress('frostline', NIGHTFALL_START_MS - NIGHTFALL_DURATION_MS / 2, false),
    ).toBeCloseTo(0.5);
    expect(matchNightProgress('island', NIGHTFALL_START_MS - NIGHTFALL_DURATION_MS, false)).toBe(1);
  });

  it('keeps Original World at night and avoids animated fading with reduced effects', () => {
    expect(matchNightProgress('original', 300_000, false)).toBe(1);
    expect(matchNightProgress('frostline', NIGHTFALL_START_MS, true)).toBe(1);
  });

  it('shows the warning once during the opening five seconds of nightfall', () => {
    expect(isTwoMinuteWarningVisible(NIGHTFALL_START_MS + 1)).toBe(false);
    expect(isTwoMinuteWarningVisible(NIGHTFALL_START_MS)).toBe(true);
    expect(isTwoMinuteWarningVisible(NIGHTFALL_START_MS - TWO_MINUTE_WARNING_DURATION_MS + 1)).toBe(
      true,
    );
    expect(isTwoMinuteWarningVisible(NIGHTFALL_START_MS - TWO_MINUTE_WARNING_DURATION_MS)).toBe(
      false,
    );
  });

  it('darkens surface distance fog without changing underwater visibility', () => {
    const day = matchEnvironmentFor('frostline', false, 0);
    const night = matchEnvironmentFor('frostline', false, 1);
    expect(night.background).not.toBe(day.background);
    expect(night.fogFar).toBeLessThan(day.fogFar);
    expect(matchEnvironmentFor('island', true, 1)).toEqual(waterEnvironmentFor('island', true));
  });
});
