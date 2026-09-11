import { describe, expect, it } from 'vitest';
import {
  ARENA,
  ARENA_ROUNDS,
  BRIDGES,
  createSpawnPoints,
  isPermanentLand,
  isRiver,
  isWalkable,
  terrainHeightAt,
} from './arena.js';

describe('authored world arena', () => {
  it('uses the documented 250-unit envelope and five shrinking boundaries', () => {
    expect(ARENA.halfExtent).toBe(118);
    expect(ARENA_ROUNDS).toEqual([118, 102, 86, 70, 54]);
  });

  it('keeps the major biome centers on permanent land', () => {
    for (const point of [
      { x: -60, z: -15 },
      { x: 65, z: -10 },
      { x: 10, z: -85 },
      { x: -15, z: 60 },
      { x: 20, z: 103 },
      { x: 37, z: 116 },
    ]) {
      expect(isPermanentLand(point)).toBe(true);
    }
  });

  it('rejects ocean and river channels while accepting every bridge deck', () => {
    expect(isWalkable({ x: -118, z: 110 })).toBe(false);
    expect(isRiver({ x: 9, z: 30 })).toBe(true);
    expect(isWalkable({ x: 9, z: 30 })).toBe(false);

    for (const bridge of BRIDGES) {
      expect(isPermanentLand(bridge)).toBe(true);
    }
  });

  it('provides enough safe village spawns for a full room', () => {
    const spawns = createSpawnPoints();
    expect(spawns.length).toBeGreaterThanOrEqual(150);
    expect(spawns.every((spawn) => isWalkable(spawn, 0.8))).toBe(true);
  });

  it('maintains the intended south-to-north elevation hierarchy', () => {
    const beach = terrainHeightAt({ x: 20, z: 103 });
    const meadow = terrainHeightAt({ x: -15, z: 58 });
    const village = terrainHeightAt({ x: 15, z: 5 });
    const forest = terrainHeightAt({ x: -60, z: -15 });
    const summit = terrainHeightAt({ x: 10, z: -91 });

    expect(beach).toBeLessThan(meadow);
    expect(meadow).toBeLessThan(village);
    expect(village).toBeLessThan(forest);
    expect(forest).toBeLessThan(summit);
    expect(summit).toBeGreaterThanOrEqual(60);
  });
});
