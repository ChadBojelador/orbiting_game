import { describe, expect, it } from 'vitest';
import { waterEnvironmentFor } from './water-presentation.js';

describe('water presentation', () => {
  it('preserves each map surface atmosphere', () => {
    expect(waterEnvironmentFor('original', false)).toEqual({
      background: 0x050b18,
      fogColor: 0x0a1830,
      fogNear: 120,
      fogFar: 380,
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
