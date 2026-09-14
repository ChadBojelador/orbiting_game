import { describe, expect, it } from 'vitest';
import {
  ARENA,
  ARENA_ROUNDS,
  BRIDGES,
  advanceVerticalMotion,
  bridgeDeckHeightAt,
  bridgeDimensions,
  createSpawnPoints,
  hasGameplayLineOfSight,
  isPermanentLand,
  isRiver,
  isWalkable,
  terrainHeightAt,
} from './arena.js';

describe('authored world arena', () => {
  it('uses the documented expanded envelope and five shrinking boundaries', () => {
    expect(ARENA.halfExtent).toBe(198);
    expect(ARENA_ROUNDS).toEqual([198, 160, 120, 86, 54]);
    expect(isPermanentLand({ x: -180, z: -35 })).toBe(false);
    expect(isPermanentLand({ x: 132, z: 149 })).toBe(true);
    expect(isPermanentLand({ x: -145, z: -12 })).toBe(true);
    expect(isPermanentLand({ x: 20, z: 139 })).toBe(true);
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

  it('covers every bridge deck and approach with authoritative walkable collision', () => {
    const playerRadius = 0.8;
    for (const bridge of BRIDGES) {
      const { length, deckWidth } = bridgeDimensions(bridge);
      const cos = Math.cos(bridge.heading);
      const sin = Math.sin(bridge.heading);
      const safeHalfWidth = deckWidth / 2 - playerRadius - 0.01;

      for (
        let along = -length / 2 + playerRadius + 0.01;
        along <= length / 2 - playerRadius - 0.01;
        along += 0.25
      ) {
        for (const across of [-safeHalfWidth, 0, safeHalfWidth]) {
          const point = {
            x: bridge.x + cos * along - sin * across,
            z: bridge.z + sin * along + cos * across,
          };
          expect(isWalkable(point, playerRadius), `${bridge.id} has a collision gap`).toBe(true);
        }
      }

      for (let along = -length / 2 - 1; along <= length / 2 + 1; along += 0.1) {
        const approach = {
          x: bridge.x + cos * along,
          z: bridge.z + sin * along,
        };
        expect(isWalkable(approach, playerRadius), `${bridge.id} has a broken approach`).toBe(true);
      }
    }
  });

  it('keeps bridge slopes and platform seams within the authored step limit', () => {
    for (const bridge of BRIDGES) {
      const { length } = bridgeDimensions(bridge);
      const cos = Math.cos(bridge.heading);
      const sin = Math.sin(bridge.heading);
      const pointAt = (along: number) => ({
        x: bridge.x + cos * along,
        z: bridge.z + sin * along,
      });

      for (let along = -length / 2; along < length / 2; along += 0.25) {
        const next = Math.min(length / 2, along + 0.25);
        expect(
          Math.abs(
            bridgeDeckHeightAt(bridge, pointAt(next)) - bridgeDeckHeightAt(bridge, pointAt(along)),
          ),
          `${bridge.id} has an abrupt deck slope`,
        ).toBeLessThanOrEqual(0.35);
      }

      for (const side of [-1, 1]) {
        const deckEnd = pointAt((side * length) / 2);
        const approach = pointAt(side * (length / 2 + 0.2));
        expect(
          Math.abs(terrainHeightAt(deckEnd) - terrainHeightAt(approach)),
          `${bridge.id} does not meet its platform cleanly`,
        ).toBeLessThanOrEqual(0.35 + 1e-9);
      }
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

  it('keeps the outer network connected through authored routes and crossings', () => {
    for (const point of [
      { x: -111, z: 35 },
      { x: 102, z: -28 },
      { x: 8, z: 135 },
      { x: 76, z: 165 },
      { x: 132, z: 149 },
    ]) {
      expect(isWalkable(point, 0.8, ARENA.halfExtent)).toBe(true);
    }
  });

  it('advances jumps against terrain and allows sight above low cover', () => {
    const groundY = terrainHeightAt({ x: 0, z: 0 });
    const airborne = advanceVerticalMotion(
      { y: groundY, verticalVelocity: 0, isGrounded: true },
      { x: 0, z: 0 },
      0.05,
      true,
    );
    expect(airborne.y).toBeGreaterThan(groundY);
    expect(airborne.isGrounded).toBe(false);

    const lowCover = ARENA.blocks.find((block) => block.id === 'COVER_VILLAGE_N')!;
    const pointA = { x: lowCover.x, z: lowCover.z - 3 };
    const pointB = { x: lowCover.x, z: lowCover.z + 3 };
    const groundA = terrainHeightAt(pointA);
    const groundB = terrainHeightAt(pointB);
    expect(hasGameplayLineOfSight({ ...pointA, y: groundA }, { ...pointB, y: groundB })).toBe(
      false,
    );
    expect(
      hasGameplayLineOfSight({ ...pointA, y: groundA + 2 }, { ...pointB, y: groundB + 2 }),
    ).toBe(true);
  });
});
