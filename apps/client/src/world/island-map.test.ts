import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BufferGeometry,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Raycaster,
  Vector3,
} from 'three';
import {
  ISLAND_SPAWN_POINTS,
  ISLAND_ARENA,
  ISLAND_COVER,
  ISLAND_FORT_SCALE,
  ISLAND_FORT_Y,
  ISLAND_SURFACES,
  GAMEPLAY,
  isWalkable,
  surfaceAt,
  terrainHeightAt,
  worldRayDistance,
  simulateMovement,
} from '@ice-water/shared';

function renderedWorld(): Group {
  const bytes = fs.readFileSync(new URL('./generated/island-fort.glb', import.meta.url));
  const length = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + length).toString()) as {
    meshes: { primitives: { attributes: { POSITION: number }; indices: number }[] }[];
    accessors: { bufferView: number; byteOffset?: number; count: number }[];
    bufferViews: { byteOffset: number; byteStride?: number }[];
  };
  const primitive = model.meshes[0]!.primitives[0]!;
  const position = model.accessors[primitive.attributes.POSITION]!,
    indices = model.accessors[primitive.indices]!;
  const vertexView = model.bufferViews[position.bufferView]!,
    indexView = model.bufferViews[indices.bufferView]!;
  const positions: number[] = [],
    index: number[] = [];
  for (let i = 0; i < position.count; i++)
    for (let axis = 0; axis < 3; axis++)
      positions.push(
        bytes.readFloatLE(
          28 +
            length +
            vertexView.byteOffset +
            (position.byteOffset ?? 0) +
            i * vertexView.byteStride! +
            axis * 4,
        ),
      );
  for (let i = 0; i < indices.count; i++)
    index.push(bytes.readUInt32LE(28 + length + indexView.byteOffset + i * 4));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const group = new Group(),
    fort = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  fort.scale.setScalar(ISLAND_FORT_SCALE);
  fort.position.y = ISLAND_FORT_Y;
  group.add(fort);
  for (const block of [...ISLAND_SURFACES, ...ISLAND_COVER]) {
    const mesh = new Mesh(
      new BoxGeometry(block.width, block.height, block.depth),
      new MeshBasicMaterial({ side: DoubleSide }),
    );
    mesh.position.set(block.x, block.y + block.height / 2, block.z);
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  return group;
}

function disposeWorld(group: Group): void {
  group.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    (object.material as MeshBasicMaterial).dispose();
  });
}

describe('Island render and authoritative geometry', () => {
  it('keeps six outer regions separate around the larger central battlefield', () => {
    const regions = new Set(
      ISLAND_SURFACES.filter((surface) => surface.region !== 'route').map(
        (surface) => surface.region,
      ),
    );
    expect(regions).toEqual(
      new Set(['central', 'north', 'west', 'east', 'south', 'southwest', 'southeast']),
    );
    expect(ISLAND_SURFACES.filter((surface) => surface.region === 'central')).toHaveLength(4);
    expect(ISLAND_SURFACES.filter((surface) => surface.region === 'route').length).toBeGreaterThan(
      15,
    );
    expect(terrainHeightAt({ x: 45, z: -25 }, 'island')).toBe(0);
    expect(surfaceAt({ x: 45, z: -25 }, 'island')).toBe('water');
    expect(terrainHeightAt({ x: 0, z: -43 }, 'island')).toBeCloseTo(0.25);
    expect(surfaceAt({ x: 0, z: -43 }, 'island')).toBe('ice');
    expect(
      ISLAND_SPAWN_POINTS.every((spawn) => Math.max(Math.abs(spawn.x), Math.abs(spawn.z)) >= 43),
    ).toBe(true);
    expect(
      ISLAND_SPAWN_POINTS.every((spawn) => {
        const secondsToCore = Math.hypot(spawn.x, spawn.z) / GAMEPLAY.moveSpeed;
        return secondsToCore >= 5 && secondsToCore <= 7;
      }),
    ).toBe(true);
  });
  it('lets every spawn walk forward out of its initial position', () => {
    for (const spawn of ISLAND_SPAWN_POINTS) {
      const length = Math.hypot(spawn.x, spawn.z);
      let p = {
        ...spawn,
        y: terrainHeightAt(spawn, 'island'),
        verticalVelocity: 0,
        velocityX: 0,
        velocityZ: 0,
        isGrounded: true,
        isSliding: false,
        isCrouching: false,
        slideUntil: 0,
        slideReadyAt: 0,
      };
      for (let tick = 1; tick <= 8; tick++)
        p = simulateMovement(
          p,
          { x: -spawn.x / length, z: -spawn.z / length, sequence: tick },
          tick * 50,
          0.05,
          1,
          'island',
        );
      expect(
        Math.hypot(p.x - spawn.x, p.z - spawn.z),
        `spawn ${spawn.x},${spawn.z}`,
      ).toBeGreaterThan(1.5);
    }
  });
  it('grounds all sixteen outer spawns in the rendered world with standing room', () => {
    const world = renderedWorld();
    expect(ISLAND_SPAWN_POINTS).toHaveLength(16);
    for (const p of ISLAND_SPAWN_POINTS) {
      const y = terrainHeightAt(p, 'island');
      const hits = new Raycaster(new Vector3(p.x, 30, p.z), new Vector3(0, -1, 0)).intersectObject(
        world,
        true,
      );
      expect(hits[0]!.point.y).toBeCloseTo(y, 4);
      expect(isWalkable(p, ISLAND_ARENA.halfExtent, y, GAMEPLAY.playerHeight, 'island')).toBe(true);
    }
    disposeWorld(world);
  });
  it('blocks shots on actual Fort walls, without phantom Frostline blocks', () => {
    const world = renderedWorld();
    for (const origin of [
      { x: 8, y: 2, z: -8 },
      { x: -8, y: 3, z: 0 },
      { x: 6, y: 3, z: 8 },
    ]) {
      for (const direction of [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: 0, z: 1 },
      ]) {
        const hits = new Raycaster(
          new Vector3(origin.x, origin.y, origin.z),
          new Vector3(direction.x, direction.y, direction.z),
          0,
          80,
        ).intersectObject(world, true);
        expect(worldRayDistance(origin, direction, 80, 'island')).toBeCloseTo(
          hits[0]?.distance ?? 80,
          4,
        );
      }
    }
    expect(
      worldRayDistance({ x: 8, y: 2, z: -8 }, { x: 1, y: 0, z: 0 }, 20, 'island'),
    ).toBeGreaterThan(1);
    expect(worldRayDistance({ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 20, 'frostline')).toBe(0);
    disposeWorld(world);
  });
  it('matches rendered hybrid collision for diagonal shots across grid-cell boundaries', () => {
    const world = renderedWorld();
    for (const spawn of ISLAND_SPAWN_POINTS.slice(0, 4)) {
      const origin = { ...spawn, y: terrainHeightAt(spawn, 'island') + 1.6 };
      for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4,
          direction = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
        const hits = new Raycaster(
          new Vector3(origin.x, origin.y, origin.z),
          new Vector3(direction.x, direction.y, direction.z),
          0,
          80,
        ).intersectObject(world, true);
        expect(worldRayDistance(origin, direction, 80, 'island')).toBeCloseTo(
          hits[0]?.distance ?? 80,
          4,
        );
      }
    }
    disposeWorld(world);
  });
  it('keeps a moving player grounded and prevents walking through Fort walls', () => {
    const spawn = ISLAND_SPAWN_POINTS[0]!;
    let p = {
      ...spawn,
      y: terrainHeightAt(spawn, 'island'),
      verticalVelocity: 0,
      velocityX: 0,
      velocityZ: 0,
      isGrounded: true,
      isSliding: false,
      isCrouching: false,
      slideUntil: 0,
      slideReadyAt: 0,
    };
    for (let tick = 1; tick <= 80; tick++) {
      p = simulateMovement(p, { x: 1, z: 0, sequence: tick }, tick * 50, 0.05, 1, 'island');
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(isWalkable(p, ISLAND_ARENA.halfExtent, p.y, GAMEPLAY.playerHeight, 'island')).toBe(
        true,
      );
    }
  });
});
