// Original authored topology restored from GitHub commit 87a8893f6b84acc39f9b2df709153abe26079cdd.
import type { Position } from '../protocol/gameplay.js';

export interface ArenaBlock extends Position {
  id: string;
  width: number;
  depth: number;
  height: number;
}

export interface LandRegion extends Position {
  id: string;
  radiusX: number;
  radiusZ: number;
  elevation: number;
  coreRatio: number;
}

export interface RouteCorridor {
  id: string;
  width: number;
  points: readonly Position[];
}

export interface BridgeFootprint extends Position {
  id: string;
  width: number;
  depth: number;
}

export const SEA_LEVEL = 1.5;
export const WORLD_MIN = -125;
export const WORLD_MAX = 125;

export const LAND_REGIONS: readonly LandRegion[] = [
  { id: 'BIO_VILLAGE', x: 0, z: 0, radiusX: 37, radiusZ: 38, elevation: 12, coreRatio: 0.62 },
  { id: 'BIO_FOREST', x: -60, z: -15, radiusX: 43, radiusZ: 40, elevation: 21, coreRatio: 0.58 },
  {
    id: 'BIO_CRYSTAL_VALLEY',
    x: 65,
    z: -10,
    radiusX: 43,
    radiusZ: 40,
    elevation: 20,
    coreRatio: 0.58,
  },
  { id: 'BIO_ICE_PEAKS', x: 10, z: -85, radiusX: 42, radiusZ: 42, elevation: 48, coreRatio: 0.42 },
  { id: 'BIO_MEADOW', x: -5, z: 60, radiusX: 44, radiusZ: 42, elevation: 7, coreRatio: 0.62 },
  { id: 'BIO_BEACH', x: 10, z: 104, radiusX: 46, radiusZ: 23, elevation: 2.8, coreRatio: 0.62 },
  { id: 'BIO_ISLAND_W', x: -18, z: 119, radiusX: 11, radiusZ: 8, elevation: 3.2, coreRatio: 0.55 },
  { id: 'BIO_ISLAND_C', x: 10, z: 121, radiusX: 10, radiusZ: 7, elevation: 4, coreRatio: 0.55 },
  { id: 'BIO_ISLAND_E', x: 37, z: 116, radiusX: 12, radiusZ: 9, elevation: 3.4, coreRatio: 0.55 },
] as const;

export const ROUTE_CORRIDORS: readonly RouteCorridor[] = [
  {
    id: 'PATH_VILLAGE_CRYSTAL',
    width: 10,
    points: [
      { x: 20, z: 2 },
      { x: 35, z: 1 },
      { x: 50, z: -2 },
      { x: 65, z: -10 },
    ],
  },
  {
    id: 'PATH_CRYSTAL_ICE',
    width: 9,
    points: [
      { x: 64, z: -32 },
      { x: 49, z: -48 },
      { x: 34, z: -65 },
      { x: 16, z: -80 },
    ],
  },
  {
    id: 'PATH_ICE_FOREST',
    width: 9,
    points: [
      { x: -2, z: -77 },
      { x: -22, z: -57 },
      { x: -39, z: -43 },
      { x: -54, z: -31 },
    ],
  },
  {
    id: 'PATH_FOREST_VILLAGE',
    width: 10,
    points: [
      { x: -46, z: -17 },
      { x: -31, z: -4 },
      { x: -20, z: 2 },
    ],
  },
  {
    id: 'PATH_VILLAGE_MEADOW',
    width: 11,
    points: [
      { x: 4, z: 22 },
      { x: 5, z: 36 },
      { x: 2, z: 52 },
      { x: -5, z: 65 },
    ],
  },
  {
    id: 'PATH_MEADOW_BEACH',
    width: 10,
    points: [
      { x: 2, z: 75 },
      { x: 5, z: 86 },
      { x: 9, z: 99 },
      { x: 10, z: 109 },
    ],
  },
  {
    id: 'PATH_BEACH_ISLANDS',
    width: 5,
    points: [
      { x: 15, z: 109 },
      { x: 10, z: 119 },
      { x: 24, z: 118 },
      { x: 37, z: 116 },
    ],
  },
  {
    id: 'PATH_ISLAND_MEADOW',
    width: 7,
    points: [
      { x: 37, z: 116 },
      { x: 42, z: 101 },
      { x: 35, z: 84 },
      { x: 23, z: 69 },
    ],
  },
  {
    id: 'PATH_FOREST_SHORTCUT',
    width: 7,
    points: [
      { x: -62, z: 10 },
      { x: -47, z: 27 },
      { x: -34, z: 43 },
      { x: -23, z: 53 },
    ],
  },
  {
    id: 'PATH_CRYSTAL_MEADOW',
    width: 7,
    points: [
      { x: 72, z: 13 },
      { x: 57, z: 28 },
      { x: 43, z: 43 },
      { x: 28, z: 57 },
    ],
  },
] as const;

export const BRIDGES: readonly BridgeFootprint[] = [
  { id: 'BR_VILLAGE_NORTH', x: 0, z: -28, width: 12, depth: 6 },
  { id: 'BR_CRYSTAL_01', x: 55, z: -5, width: 6, depth: 12 },
  { id: 'BR_MEADOW_01', x: -5, z: 65, width: 14, depth: 6 },
  { id: 'BR_ISLAND_01', x: 24, z: 118, width: 15, depth: 6 },
] as const;

export const RIVER_BRANCHES: readonly (readonly Position[])[] = [
  [
    { x: 20, z: -55 },
    { x: 10, z: -41 },
    { x: 0, z: -28 },
    { x: 10, z: -12 },
    { x: 12, z: 8 },
    { x: 9, z: 30 },
    { x: 3, z: 50 },
    { x: -5, z: 65 },
    { x: 4, z: 76 },
    { x: 8, z: 92 },
    { x: 10, z: 112 },
  ],
  [
    { x: 66, z: -24 },
    { x: 60, z: -15 },
    { x: 60, z: -5 },
    { x: 45, z: -2 },
    { x: 28, z: -8 },
    { x: 10, z: -18 },
    { x: 0, z: -28 },
  ],
] as const;

export const ARENA = {
  halfExtent: 118,
  blocks: [
    { id: 'COVER_VILLAGE_NW', x: -8, z: -8, width: 4, depth: 4, height: 1.8 },
    { id: 'COVER_VILLAGE_NE', x: 8, z: -8, width: 4, depth: 4, height: 1.8 },
    { id: 'COVER_VILLAGE_SW', x: -8, z: 8, width: 4, depth: 4, height: 1.8 },
    { id: 'COVER_VILLAGE_SE', x: 8, z: 8, width: 4, depth: 4, height: 1.8 },
    { id: 'COVER_VILLAGE_N', x: 0, z: -17, width: 8, depth: 2, height: 1.2 },
    { id: 'COVER_VILLAGE_S', x: 0, z: 17, width: 8, depth: 2, height: 1.2 },
    { id: 'LM_FOREST_TREE', x: -65, z: -18, width: 7, depth: 7, height: 17 },
    { id: 'LM_CRYSTAL_SPIRE', x: 69, z: -14, width: 8, depth: 8, height: 16 },
    { id: 'LM_MEADOW_WINDMILL', x: -21, z: 62, width: 6, depth: 6, height: 12 },
  ] as readonly ArenaBlock[],
} as const;

export function distanceSquared(a: Position, b: Position): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

function distanceToSegmentSquared(point: Position, start: Position, end: Position): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return distanceSquared(point, start);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared),
  );
  return distanceSquared(point, { x: start.x + dx * t, z: start.z + dz * t });
}

function isInsideRegion(position: Position, region: LandRegion, padding = 0): boolean {
  const radiusX = Math.max(0.01, region.radiusX - padding);
  const radiusZ = Math.max(0.01, region.radiusZ - padding);
  const dx = (position.x - region.x) / radiusX;
  const dz = (position.z - region.z) / radiusZ;
  return dx * dx + dz * dz <= 1;
}

function isInsideCorridor(position: Position, corridor: RouteCorridor, padding = 0): boolean {
  const radius = Math.max(0, corridor.width / 2 - padding);
  if (radius <= 0) return false;
  for (let index = 1; index < corridor.points.length; index += 1) {
    const start = corridor.points[index - 1];
    const end = corridor.points[index];
    if (start && end && distanceToSegmentSquared(position, start, end) <= radius * radius)
      return true;
  }
  return false;
}

function isOnBridge(position: Position, padding = 0): boolean {
  return BRIDGES.some(
    (bridge) =>
      Math.abs(position.x - bridge.x) <= bridge.width / 2 - padding &&
      Math.abs(position.z - bridge.z) <= bridge.depth / 2 - padding,
  );
}

export function isRiver(position: Position, padding = 0): boolean {
  const radius = 2.4 + padding;
  return RIVER_BRANCHES.some((branch) => {
    for (let index = 1; index < branch.length; index += 1) {
      const start = branch[index - 1];
      const end = branch[index];
      if (start && end && distanceToSegmentSquared(position, start, end) <= radius * radius)
        return true;
    }
    return false;
  });
}

export function isPermanentLand(position: Position, padding = 0): boolean {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const isLand =
    LAND_REGIONS.some((region) => isInsideRegion(position, region, padding)) ||
    ROUTE_CORRIDORS.some((corridor) => isInsideCorridor(position, corridor, padding));
  if (!isLand) return false;
  return !isRiver(position, padding) || isOnBridge(position, padding);
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function regionElevation(position: Position, region: LandRegion): number {
  const dx = (position.x - region.x) / region.radiusX;
  const dz = (position.z - region.z) / region.radiusZ;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const falloff = 1 - smoothstep((distance - region.coreRatio) / (1 - region.coreRatio));
  return SEA_LEVEL + 0.35 + (region.elevation - SEA_LEVEL - 0.35) * falloff;
}

/** Deterministic display height for the authored world surface. */
export function terrainHeightAt(position: Position): number {
  if (!isPermanentLand(position)) return SEA_LEVEL - 0.45;
  let height = SEA_LEVEL + 0.45;
  for (const region of LAND_REGIONS) height = Math.max(height, regionElevation(position, region));

  // The summit crown rises above the broad ice plateau without changing route topology.
  const summitDistance = Math.hypot((position.x - 10) / 20, (position.z + 91) / 18);
  if (summitDistance < 1) height = Math.max(height, 48 + 14 * (1 - smoothstep(summitDistance)));

  // Shallow visible channels sit below their banks; bridge decks override this in rendering.
  if (isRiver(position) && !isOnBridge(position)) height -= 1.15;
  return Math.round(height * 20) / 20;
}
