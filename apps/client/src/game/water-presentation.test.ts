import { describe, expect, it } from 'vitest';
import { waterEnvironmentFor } from './water-presentation.js';

describe('water presentation', () => {
  it('preserves each map surface atmosphere', () => {
    expect(waterEnvironmentFor('original', false)).toEqual({
      background: 0xa4e8ee,
      fogColor: 0xa4e8ee,
      fogNear: 190,
      fogFar: 440,
    });
    expect(waterEnvironmentFor('frostline', false).fogFar).toBe(300);
  });

  it('uses short blue-green fog below the waterline', () => {
    const underwater = waterEnvironmentFor('original', true);
    expect(underwater.fogNear).toBeLessThan(1);
    expect(underwater.fogFar).toBeLessThan(50);
    expect(underwater.background).not.toBe(waterEnvironmentFor('original', false).background);
  });
});
