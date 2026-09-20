import { describe, expect, it } from 'vitest';
import {
  BufferGeometry,
  Float32BufferAttribute,
  FrontSide,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Raycaster,
  Scene,
  Vector3,
} from 'three';
import {
  GAMEPLAY,
  arenaHalfExtentForMap,
  isSwimming,
  isUnderwater,
  isWalkable,
  originalTopology,
  simulateMovement,
  spawnPointsForMap,
  terrainHeightAt,
  worldRayDistance,
  type MovementState,
} from '@ice-water/shared';
import { OriginalWorldMap } from './original-world-map.js';
import { isOriginalPresentation } from './original-world-atmosphere.js';

function geometryTopology(geometry: BufferGeometry): {
  boundaryEdges: number;
  nonManifoldEdges: number;
  windingErrors: number;
  degenerateTriangles: number;
  signedVolume: number;
  connectedComponents: number;
  unreferencedVertices: number;
  invalidNormals: number;
} {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
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
  const adjacency = new Map<number, Set<number>>();
  const referencedVertices = new Set<number>();
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
    const fromNeighbors = adjacency.get(from) ?? new Set<number>();
    const toNeighbors = adjacency.get(to) ?? new Set<number>();
    fromNeighbors.add(to);
    toNeighbors.add(from);
    adjacency.set(from, fromNeighbors);
    adjacency.set(to, toNeighbors);
  };

  for (let offset = 0; offset < indices.count; offset += 3) {
    const ai = indices.getX(offset);
    const bi = indices.getX(offset + 1);
    const ci = indices.getX(offset + 2);
    referencedVertices.add(ai);
    referencedVertices.add(bi);
    referencedVertices.add(ci);
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

  let connectedComponents = 0;
  const visited = new Set<number>();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    connectedComponents += 1;
    const pending = [start];
    while (pending.length > 0) {
      const vertex = pending.pop()!;
      if (visited.has(vertex)) continue;
      visited.add(vertex);
      for (const neighbor of adjacency.get(vertex) ?? []) pending.push(neighbor);
    }
  }

  let invalidNormals = 0;
  for (let index = 0; index < normals.count; index += 1) {
    const length = Math.hypot(normals.getX(index), normals.getY(index), normals.getZ(index));
    if (!Number.isFinite(length) || length < 0.5) invalidNormals += 1;
  }
  return {
    boundaryEdges,
    nonManifoldEdges,
    windingErrors,
    degenerateTriangles,
    signedVolume,
    connectedComponents,
    unreferencedVertices: positions.count - referencedVertices.size,
    invalidNormals,
  };
}

function combinedGeometry(root: Object3D): BufferGeometry {
  root.updateMatrixWorld(true);
  const positions: number[] = [];
  const indices: number[] = [];
  const vertex = new Vector3();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const sourcePositions = object.geometry.getAttribute('position');
    const sourceIndices = object.geometry.index;
    for (let index = 0; index < (sourceIndices?.count ?? sourcePositions.count); index += 1) {
      const sourceIndex = sourceIndices ? sourceIndices.getX(index) : index;
      vertex.fromBufferAttribute(sourcePositions, sourceIndex).applyMatrix4(object.matrixWorld);
      indices.push(positions.length / 3);
      positions.push(vertex.x, vertex.y, vertex.z);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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

      const crystalLights: PointLight[] = [];
      world.group.traverse((object) => {
        if (object instanceof PointLight && object.name.startsWith('CRYSTAL_LIGHT_'))
          crystalLights.push(object);
      });
      expect(crystalLights.map((light) => light.name).sort()).toEqual([
        'CRYSTAL_LIGHT_MOONSTONE',
        'CRYSTAL_LIGHT_SPIRE',
        'CRYSTAL_LIGHT_VILLAGE',
      ]);
      for (const light of crystalLights) {
        expect(light.castShadow).toBe(false);
        expect(light.distance).toBeGreaterThanOrEqual(75);
        expect(light.intensity).toBeGreaterThanOrEqual(190);
        expect(light.distance).toBeLessThanOrEqual(110);
      }
      const shard = world.group.getObjectByName('crystal-shard') as Mesh;
      const shardMaterial = Array.isArray(shard.material) ? shard.material[0] : shard.material;
      expect(shardMaterial).toBeInstanceOf(MeshStandardMaterial);
      expect((shardMaterial as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(2);
      expect((shardMaterial as MeshStandardMaterial).userData.hasCrystalGlowGradient).toBe(true);
      expect((shardMaterial as MeshStandardMaterial).vertexColors).toBe(true);
      expect(shard.geometry.getAttribute('color')).toBeDefined();
      expect(shard.geometry.getAttribute('crystalGlow')).toBeDefined();
      expect(shard.geometry.getAttribute('position').count).toBeGreaterThan(24);
      expect(shard.getObjectByName('crystal-facet-lines')).toBeDefined();
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
          isOriginalPresentation(object) ||
          object.name.startsWith('OCEAN') ||
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
        connectedComponents: 1,
        unreferencedVertices: 0,
        invalidNormals: 0,
      });
      expect(geometryTopology(mesh.geometry).signedVolume).toBeGreaterThan(0);

      const bottom = originalTopology.WATER_BOTTOM;
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
      const bottom = originalTopology.WATER_BOTTOM;
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
        expect(
          new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).y,
        ).toBeGreaterThan(0);
      }

      const rivers: Mesh<BufferGeometry>[] = [];
      const riverbeds: Mesh<BufferGeometry>[] = [];
      world.group.traverse((object) => {
        if (object instanceof Mesh && object.name === 'WATER_NETWORK')
          rivers.push(object as Mesh<BufferGeometry>);
        if (object instanceof Mesh && object.name === 'RIVERBED_NETWORK')
          riverbeds.push(object as Mesh<BufferGeometry>);
      });
      expect(rivers).toHaveLength(originalTopology.RIVER_BRANCHES.length);
      expect(riverbeds).toHaveLength(originalTopology.RIVER_BRANCHES.length);
      for (const river of rivers) {
        expect(Array.isArray(river.material)).toBe(true);
        const [water, bank] = Array.isArray(river.material) ? river.material : [];
        expect(water?.side).toBe(FrontSide);
        expect(water?.transparent).toBe(true);
        expect(bank?.side).toBe(FrontSide);
        expect(bank?.transparent).toBe(false);
        expect(river.geometry.groups).toHaveLength(2);
        const positions = river.geometry.getAttribute('position');
        expect(positions.getY(2)).toBeLessThan(positions.getY(0));
      }
      for (let index = 0; index < riverbeds.length; index += 1) {
        const bed = riverbeds[index]!;
        const material = Array.isArray(bed.material) ? bed.material[0] : bed.material;
        if (!material) throw new Error('Riverbed material is missing');
        expect(material.side).toBe(FrontSide);
        expect(material.transparent).toBe(false);
        const bedPositions = bed.geometry.getAttribute('position');
        const riverPositions = rivers[index]!.geometry.getAttribute('position');
        expect(bedPositions.count).toBe(riverPositions.count + 40);
        for (let sample = 0; sample < riverPositions.count / 4; sample += 1) {
          const riverVertex = sample * 4;
          const bedVertex = (sample + 5) * 4;
          const bedCenterX = (bedPositions.getX(bedVertex) + bedPositions.getX(bedVertex + 1)) / 2;
          const bedCenterZ = (bedPositions.getZ(bedVertex) + bedPositions.getZ(bedVertex + 1)) / 2;
          const riverCenterX =
            (riverPositions.getX(riverVertex) + riverPositions.getX(riverVertex + 1)) / 2;
          const riverCenterZ =
            (riverPositions.getZ(riverVertex) + riverPositions.getZ(riverVertex + 1)) / 2;
          expect(bedCenterX).toBeCloseTo(riverCenterX);
          expect(bedCenterZ).toBeCloseTo(riverCenterZ);
          expect(bedPositions.getY(bedVertex)).toBeCloseTo(riverPositions.getY(riverVertex) - 0.32);
          expect(
            Math.hypot(
              bedPositions.getX(bedVertex) - bedPositions.getX(bedVertex + 1),
              bedPositions.getZ(bedVertex) - bedPositions.getZ(bedVertex + 1),
            ),
          ).toBeGreaterThan(
            Math.hypot(
              riverPositions.getX(riverVertex) - riverPositions.getX(riverVertex + 1),
              riverPositions.getZ(riverVertex) - riverPositions.getZ(riverVertex + 1),
            ) + 5,
          );
        }
      }
      const firstPoint = originalTopology.RIVER_BRANCHES[0]![0]!;
      const firstRiverPositions = rivers[0]!.geometry.getAttribute('position');
      const neighboringLand = [
        { x: firstPoint.x + 3.4, z: firstPoint.z },
        { x: firstPoint.x - 3.4, z: firstPoint.z },
        { x: firstPoint.x, z: firstPoint.z + 3.4 },
        { x: firstPoint.x, z: firstPoint.z - 3.4 },
      ]
        .map((point) => originalTopology.terrainHeightAt(point))
        .filter((height) => height > originalTopology.SEA_LEVEL);
      expect(firstRiverPositions.getY(0)).toBeCloseTo(
        (neighboringLand.length === 0
          ? originalTopology.SEA_LEVEL + 0.05
          : Math.max(originalTopology.SEA_LEVEL + 0.05, Math.max(...neighboringLand) - 1.05)) +
          0.08,
      );
    } finally {
      world.destroy();
    }
  });

  it('keeps all solid world and water meshes closed while preserving intentional sheets', () => {
    const world = new OriginalWorldMap(new Scene());
    world.group.updateMatrixWorld(true);
    const arch = world.group.getObjectByName('LM_BEACH_ARCH');
    if (!arch) throw new Error('Beach arch is missing');
    expect(world.group.getObjectByName('OCEAN')).toBeDefined();
    expect(world.group.getObjectByName('OCEAN_UNDERSIDE')).toBeDefined();
    expect(world.group.getObjectByName('OCEAN_FLOOR')).toBeDefined();
    const audits = [{ name: arch.name, geometry: combinedGeometry(arch) }];
    world.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (isOriginalPresentation(object)) return;
      if (
        object.name === 'OCEAN_UNDERSIDE' ||
        object.name.startsWith('PATH_') ||
        object.name.startsWith('WF_')
      )
        return;
      for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent)
        if (ancestor === arch) return;
      audits.push({ name: object.name, geometry: combinedGeometry(object) });
    });
    try {
      for (const audit of audits) {
        const topology = geometryTopology(audit.geometry);
        expect(topology.boundaryEdges, audit.name).toBe(0);
        expect(topology.nonManifoldEdges, audit.name).toBe(0);
        expect(topology.windingErrors, audit.name).toBe(0);
        expect(topology.degenerateTriangles, audit.name).toBe(0);
        expect(topology.unreferencedVertices, audit.name).toBe(0);
        expect(topology.invalidNormals, audit.name).toBe(0);
        expect(topology.connectedComponents, audit.name).toBe(1);
        expect(topology.signedVolume, audit.name).toBeGreaterThan(0);
      }
    } finally {
      audits.forEach((audit) => audit.geometry.dispose());
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
      expect(
        Math.hypot(p.x - spawn.x, p.z - spawn.z),
        `Blocked Original spawn exit at ${JSON.stringify(spawn)}`,
      ).toBeGreaterThan(2.5);
      expect(p.y).toBeGreaterThan(1.5);
    }
  });

  it('keeps the full river-bank corridor supported above the ocean floor', () => {
    const gaps: Array<{ x: number; z: number; y: number }> = [];
    for (const branch of originalTopology.RIVER_BRANCHES) {
      for (let segment = 1; segment < branch.length; segment += 1) {
        const start = branch[segment - 1]!;
        const end = branch[segment]!;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dz);
        const sideX = -dz / length;
        const sideZ = dx / length;
        for (let along = -0.1; along <= 1.1; along += 0.1) {
          for (let lateral = -5; lateral <= 5; lateral += 0.5) {
            const point = {
              x: start.x + dx * along + sideX * lateral,
              z: start.z + dz * along + sideZ * lateral,
            };
            const y = terrainHeightAt(point, 'original');
            if (y < originalTopology.SEA_LEVEL - 0.5) gaps.push({ ...point, y });
          }
        }
      }
    }
    expect(gaps).toEqual([]);
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

  it('dives below the waterline, remains buoyant, and returns to surface float', () => {
    let p: MovementState = {
      x: -110,
      y: originalTopology.SEA_LEVEL,
      z: 80,
      velocityX: 0,
      velocityZ: 0,
      verticalVelocity: 0,
      isGrounded: false,
      isSliding: false,
      isCrouching: false,
      slideUntil: 0,
      slideReadyAt: 0,
    };
    expect(terrainHeightAt(p, 'original')).toBeCloseTo(originalTopology.WATER_BOTTOM);
    expect(worldRayDistance(p, { x: 0, y: -1, z: 0 }, 100, 'original')).toBeCloseTo(
      originalTopology.SEA_LEVEL - originalTopology.WATER_BOTTOM,
    );

    for (let tick = 1; tick <= 80; tick++)
      p = simulateMovement(
        p,
        { x: 0, z: 0, crouch: true, sequence: tick },
        tick * 50,
        0.05,
        1,
        'original',
      );
    expect(p.y).toBeCloseTo(originalTopology.SEA_LEVEL - GAMEPLAY.originalWaterDiveDepth, 1);
    expect(isUnderwater({ ...p, y: p.y + GAMEPLAY.playerEyeHeight }, 'original')).toBe(true);
    expect(p.verticalVelocity).toBeCloseTo(0, 1);

    for (let tick = 81; tick <= 160; tick++)
      p = simulateMovement(p, { x: 0, z: 0, sequence: tick }, tick * 50, 0.05, 1, 'original');
    expect(p.y).toBeCloseTo(originalTopology.SEA_LEVEL - GAMEPLAY.waterFloatDepth, 1);
    expect(isUnderwater({ ...p, y: p.y + GAMEPLAY.playerEyeHeight }, 'original')).toBe(false);
  });
});
