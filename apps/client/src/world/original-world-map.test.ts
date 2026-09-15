import { describe, expect, it } from 'vitest';
import { DoubleSide, Mesh, Raycaster, Scene, Vector3 } from 'three';
import {
  GAMEPLAY,
  arenaHalfExtentForMap,
  isSwimming,
  isWalkable,
  originalTopology,
  simulateMovement,
  spawnPointsForMap,
  terrainHeightAt,
  worldRayDistance,
  type MovementState,
} from '@ice-water/shared';
import { OriginalWorldMap } from './original-world-map.js';

describe('restored Original World', () => {
  it('preserves the first authored biomes, landmarks, bridges and dimensions', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      expect(arenaHalfExtentForMap('original')).toBe(125);
      expect(originalTopology.LAND_REGIONS).toHaveLength(9);
      for (const name of [
        'LM_VILLAGE_CRYSTAL',
        'LM_FOREST_TREE',
        'LM_CRYSTAL_SPIRE',
        'LM_ICE_SUMMIT',
        'LM_MEADOW_WINDMILL',
        'LM_BEACH_ARCH',
      ]) {
        expect(world.group.getObjectByName(name), name).toBeDefined();
      }
      for (const bridge of originalTopology.BRIDGES)
        expect(world.group.getObjectByName(bridge.id)).toBeDefined();
    } finally {
      world.destroy();
    }
  });

  it('matches independently raycast visible terrain, bridges and cover', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      const solids: Mesh[] = [];
      world.group.traverse((object) => {
        if (
          !(object instanceof Mesh) ||
          object.name === 'OCEAN' ||
          object.name === 'frost-wall' ||
          object.name.startsWith('PATH_') ||
          object.name.startsWith('WF_')
        )
          return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          material.side = DoubleSide;
        solids.push(object);
      });
      world.group.updateMatrixWorld(true);
      const origins = [
        ...spawnPointsForMap('original').map((p) => ({ ...p, y: 90 })),
        ...originalTopology.BRIDGES.map((p) => ({ x: p.x, y: 90, z: p.z })),
        { x: 10, y: 90, z: -91 },
        { x: -8, y: 13.6, z: -16 },
        { x: 8, y: 13.6, z: 16 },
      ];
      for (const origin of origins) {
        const direction =
          origin.y === 90 ? { x: 0, y: -1, z: 0 } : { x: 0, y: 0, z: origin.z < 0 ? 1 : -1 };
        const ray = new Raycaster(
          new Vector3(origin.x, origin.y, origin.z),
          new Vector3(direction.x, direction.y, direction.z),
          0,
          100,
        );
        const visibleHit = ray.intersectObjects(solids, false)[0];
        expect(visibleHit).toBeDefined();
        expect(worldRayDistance(origin, direction, 100, 'original')).toBeCloseTo(
          visibleHit!.distance,
          1,
        );
      }
    } finally {
      world.destroy();
    }
  });

  it('provides sixteen clear spawns with usable inward exits and grounded movement', () => {
    const spawns = spawnPointsForMap('original');
    expect(spawns).toHaveLength(16);
    expect(new Set(spawns.map((p) => `${p.x},${p.z}`)).size).toBe(16);
    for (const spawn of spawns) {
      const y = terrainHeightAt(spawn, 'original');
      expect(
        isWalkable(spawn, 125, y, GAMEPLAY.playerHeight, 'original'),
        JSON.stringify(spawn),
      ).toBe(true);
      let p: MovementState = {
        ...spawn,
        y,
        velocityX: 0,
        velocityZ: 0,
        verticalVelocity: 0,
        isGrounded: true,
        isSliding: false,
        isCrouching: false,
        slideUntil: 0,
        slideReadyAt: 0,
      };
      const length = Math.hypot(spawn.x, spawn.z);
      for (let t = 50; t <= 300; t += 50)
        p = simulateMovement(
          p,
          { x: -spawn.x / length, z: -spawn.z / length, sequence: t },
          t,
          0.05,
          1,
          'original',
        );
      expect(Math.hypot(p.x - spawn.x, p.z - spawn.z)).toBeGreaterThan(2.5);
      expect(p.y).toBeGreaterThan(1.5);
    }
  });

  it('uses the original sea level for buoyancy and prevents tunneling through village cover', () => {
    let p: MovementState = {
      x: -110,
      y: 1.5,
      z: 80,
      velocityX: 0,
      velocityZ: 0,
      verticalVelocity: 0,
      isGrounded: true,
      isSliding: false,
      isCrouching: false,
      slideUntil: 0,
      slideReadyAt: 0,
    };
    for (let t = 50; t <= 2000; t += 50)
      p = simulateMovement(p, { x: 0, z: 0, sequence: t }, t, 0.05, 1, 'original');
    expect(isSwimming(p, 'original')).toBe(true);
    expect(p.y).toBeCloseTo(1.5 - GAMEPLAY.waterFloatDepth, 1);
    p = { ...p, x: -8, y: 12, z: -14, isGrounded: true, verticalVelocity: 0 };
    for (let t = 50; t <= 1000; t += 50)
      p = simulateMovement(p, { x: 0, z: 1, sequence: t, sprint: true }, t, 0.05, 1, 'original');
    expect(p.z).toBeLessThan(-10);
  });
});
