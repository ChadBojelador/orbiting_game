import { describe, expect, it } from 'vitest';
import { BufferGeometry, FrontSide, Mesh, Raycaster, Scene, Vector3 } from 'three';
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

function geometryTopology(geometry: BufferGeometry): {
  boundaryEdges: number;
  nonManifoldEdges: number;
  windingErrors: number;
  degenerateTriangles: number;
  signedVolume: number;
} {
  const positions = geometry.getAttribute('position');
  const indices = geometry.index;
  if (!indices) throw new Error('Expected indexed terrain geometry');
  const welded = new Map<string, number>();
  const weldedIds: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    const key = `${Math.round(positions.getX(index) * 1000)},${Math.round(
      positions.getY(index) * 1000,
    )},${Math.round(positions.getZ(index) * 1000)}`;
    let id = welded.get(key);
    if (id === undefined) {
      id = welded.size;
      welded.set(key, id);
    }
    weldedIds[index] = id;
  }

  const edges = new Map<string, number[]>();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();
  let degenerateTriangles = 0;
  let signedVolume = 0;
  const addEdge = (from: number, to: number) => {
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    const key = `${low}:${high}`;
    const directions = edges.get(key) ?? [];
    directions.push(from === low ? 1 : -1);
    edges.set(key, directions);
  };

  for (let offset = 0; offset < indices.count; offset += 3) {
    const ai = indices.getX(offset);
    const bi = indices.getX(offset + 1);
    const ci = indices.getX(offset + 2);
    a.fromBufferAttribute(positions, ai);
    b.fromBufferAttribute(positions, bi);
    c.fromBufferAttribute(positions, ci);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    if (ab.cross(ac).lengthSq() < 1e-10) degenerateTriangles += 1;
    signedVolume += a.dot(new Vector3().crossVectors(b, c)) / 6;
    addEdge(weldedIds[ai]!, weldedIds[bi]!);
    addEdge(weldedIds[bi]!, weldedIds[ci]!);
    addEdge(weldedIds[ci]!, weldedIds[ai]!);
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  let windingErrors = 0;
  for (const directions of edges.values()) {
    if (directions.length === 1) boundaryEdges += 1;
    else if (directions.length !== 2) nonManifoldEdges += 1;
    else if (directions[0] === directions[1]) windingErrors += 1;
  }
  return { boundaryEdges, nonManifoldEdges, windingErrors, degenerateTriangles, signedVolume };
}

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

  it('builds a closed, outward-wound and indexed terrain volume', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      const terrain = world.group.getObjectByName('TERRAIN_BLOCKOUT');
      expect(terrain).toBeInstanceOf(Mesh);
      const mesh = terrain as Mesh<BufferGeometry>;
      expect(Array.isArray(mesh.material) ? mesh.material[0]?.side : mesh.material.side).toBe(
        FrontSide,
      );
      expect(mesh.geometry.index).not.toBeNull();
      expect(mesh.geometry.getAttribute('position').count).toBeLessThan(mesh.geometry.index!.count);
      expect(geometryTopology(mesh.geometry)).toEqual({
        boundaryEdges: 0,
        nonManifoldEdges: 0,
        windingErrors: 0,
        degenerateTriangles: 0,
        signedVolume: expect.any(Number),
      });
      expect(geometryTopology(mesh.geometry).signedVolume).toBeGreaterThan(0);

      const bottom = originalTopology.SEA_LEVEL - 0.55;
      const upward = new Raycaster(new Vector3(-10, bottom - 1, 0), new Vector3(0, 1, 0), 0, 2);
      expect(upward.intersectObject(mesh, false)[0]?.distance).toBeCloseTo(1, 4);
    } finally {
      world.destroy();
    }
  });

  it('faces every exposed cliff orientation outward and keeps ribbons front-sided', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      const terrain = world.group.getObjectByName('TERRAIN_BLOCKOUT') as Mesh<BufferGeometry>;
      world.group.updateMatrixWorld(true);
      const step = 3.125;
      const bottom = originalTopology.SEA_LEVEL - 0.55;
      const sides = [
        { dx: 0, dz: -1 },
        { dx: 1, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: -1, dz: 0 },
      ] as const;
      for (const side of sides) {
        let hitDistance: number | undefined;
        for (let x = originalTopology.WORLD_MIN; x < originalTopology.WORLD_MAX; x += step) {
          for (let z = originalTopology.WORLD_MIN; z < originalTopology.WORLD_MAX; z += step) {
            const center = { x: x + step / 2, z: z + step / 2 };
            const neighbor = { x: center.x + side.dx * step, z: center.z + side.dz * step };
            if (
              !originalTopology.isPermanentLand(center) ||
              originalTopology.isPermanentLand(neighbor)
            )
              continue;
            const edge = {
              x: center.x + side.dx * (step / 2),
              z: center.z + side.dz * (step / 2),
            };
            const top = originalTopology.terrainHeightAt(edge);
            if (top <= bottom + 0.2) continue;
            const ray = new Raycaster(
              new Vector3(edge.x + side.dx * 0.5, (top + bottom) / 2, edge.z + side.dz * 0.5),
              new Vector3(-side.dx, 0, -side.dz),
              0,
              1,
            );
            hitDistance = ray.intersectObject(terrain, false)[0]?.distance;
            if (hitDistance !== undefined) break;
          }
          if (hitDistance !== undefined) break;
        }
        expect(hitDistance, JSON.stringify(side)).toBeCloseTo(0.5, 4);
      }

      const ribbons: Mesh<BufferGeometry>[] = [];
      world.group.traverse((object) => {
        if (object instanceof Mesh && object.name.startsWith('PATH_'))
          ribbons.push(object as Mesh<BufferGeometry>);
      });
      expect(ribbons).toHaveLength(originalTopology.ROUTE_CORRIDORS.length);
      for (const ribbon of ribbons) {
        const material = Array.isArray(ribbon.material) ? ribbon.material[0] : ribbon.material;
        expect(material?.side).toBe(FrontSide);
        const positions = ribbon.geometry.getAttribute('position');
        const indices = ribbon.geometry.index!;
        const a = new Vector3().fromBufferAttribute(positions, indices.getX(0));
        const b = new Vector3().fromBufferAttribute(positions, indices.getX(1));
        const c = new Vector3().fromBufferAttribute(positions, indices.getX(2));
        expect(new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).y).toBeGreaterThan(
          0,
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
