import { GAMEPLAY } from '../constants/gameplay.js';
import type { Position, SpatialPosition } from '../protocol/gameplay.js';

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
export const WORLD_MIN = -200;
export const WORLD_MAX = 200;

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
  {
    id: 'BIO_ANCIENT_FOREST',
    x: -117,
    z: -35,
    radiusX: 31,
    radiusZ: 42,
    elevation: 25,
    coreRatio: 0.52,
  },
  {
    id: 'BIO_FOREST_RAVINE',
    x: -112,
    z: 18,
    radiusX: 25,
    radiusZ: 30,
    elevation: 16,
    coreRatio: 0.5,
  },
  {
    id: 'BIO_FOREST_SHRINE',
    x: -145,
    z: -12,
    radiusX: 20,
    radiusZ: 22,
    elevation: 27,
    coreRatio: 0.54,
  },
  {
    id: 'BIO_CRYSTAL_GARDENS',
    x: 119,
    z: -28,
    radiusX: 34,
    radiusZ: 34,
    elevation: 25,
    coreRatio: 0.53,
  },
  {
    id: 'BIO_LOWER_BASIN',
    x: 116,
    z: 18,
    radiusX: 36,
    radiusZ: 28,
    elevation: 16,
    coreRatio: 0.56,
  },
  {
    id: 'BIO_CRYSTAL_FALLS',
    x: 83,
    z: -66,
    radiusX: 29,
    radiusZ: 30,
    elevation: 34,
    coreRatio: 0.5,
  },
  {
    id: 'BIO_ICE_CAVES',
    x: -34,
    z: -122,
    radiusX: 28,
    radiusZ: 25,
    elevation: 43,
    coreRatio: 0.48,
  },
  { id: 'BIO_SKY_RIDGE', x: 47, z: -126, radiusX: 32, radiusZ: 24, elevation: 52, coreRatio: 0.5 },
  { id: 'BIO_FARMLANDS', x: -65, z: 91, radiusX: 35, radiusZ: 30, elevation: 8, coreRatio: 0.58 },
  {
    id: 'BIO_FLOWER_HILLS',
    x: 61,
    z: 75,
    radiusX: 36,
    radiusZ: 29,
    elevation: 13,
    coreRatio: 0.55,
  },
  {
    id: 'BIO_COASTAL_CLIFFS',
    x: 10,
    z: 139,
    radiusX: 57,
    radiusZ: 25,
    elevation: 14,
    coreRatio: 0.5,
  },
  { id: 'BIO_BEACH_TOWN', x: -42, z: 163, radiusX: 33, radiusZ: 20, elevation: 4, coreRatio: 0.58 },
  {
    id: 'BIO_OUTER_ISLANDS',
    x: 76,
    z: 165,
    radiusX: 52,
    radiusZ: 30,
    elevation: 5,
    coreRatio: 0.48,
  },
  {
    id: 'BIO_RUINED_ISLAND',
    x: 132,
    z: 149,
    radiusX: 24,
    radiusZ: 24,
    elevation: 9,
    coreRatio: 0.5,
  },
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
  {
    id: 'PATH_FOREST_RAVINE',
    width: 8,
    points: [
      { x: -76, z: 5 },
      { x: -92, z: 19 },
      { x: -111, z: 35 },
      { x: -126, z: 45 },
    ],
  },
  {
    id: 'PATH_FOREST_SHRINE',
    width: 7,
    points: [
      { x: -96, z: -22 },
      { x: -117, z: -26 },
      { x: -139, z: -15 },
    ],
  },
  {
    id: 'PATH_CRYSTAL_GARDENS',
    width: 8,
    points: [
      { x: 82, z: -19 },
      { x: 101, z: -27 },
      { x: 123, z: -36 },
      { x: 145, z: -28 },
    ],
  },
  {
    id: 'PATH_CRYSTAL_FALLS',
    width: 8,
    points: [
      { x: 68, z: -28 },
      { x: 76, z: -46 },
      { x: 84, z: -65 },
      { x: 67, z: -82 },
    ],
  },
  {
    id: 'PATH_ICE_CAVES',
    width: 7,
    points: [
      { x: 14, z: -83 },
      { x: -8, z: -101 },
      { x: -30, z: -119 },
      { x: -18, z: -143 },
    ],
  },
  {
    id: 'PATH_SKY_RIDGE',
    width: 7,
    points: [
      { x: 19, z: -84 },
      { x: 39, z: -102 },
      { x: 52, z: -124 },
      { x: 45, z: -146 },
    ],
  },
  {
    id: 'PATH_MEADOW_FARMS',
    width: 9,
    points: [
      { x: -18, z: 68 },
      { x: -41, z: 78 },
      { x: -65, z: 91 },
      { x: -89, z: 82 },
    ],
  },
  {
    id: 'PATH_MEADOW_HILLS',
    width: 8,
    points: [
      { x: 18, z: 62 },
      { x: 39, z: 68 },
      { x: 61, z: 75 },
      { x: 79, z: 92 },
    ],
  },
  {
    id: 'PATH_MEADOW_CLIFFS',
    width: 8,
    points: [
      { x: -44, z: 83 },
      { x: -23, z: 106 },
      { x: -5, z: 127 },
      { x: 8, z: 142 },
    ],
  },
  {
    id: 'PATH_CLIFFS_BEACH',
    width: 8,
    points: [
      { x: 9, z: 143 },
      { x: -9, z: 154 },
      { x: -31, z: 162 },
      { x: -51, z: 165 },
    ],
  },
  {
    id: 'PATH_BEACH_COVE',
    width: 6,
    points: [
      { x: -18, z: 158 },
      { x: 3, z: 166 },
      { x: 24, z: 156 },
    ],
  },
  {
    id: 'PATH_BEACH_TIDEPOOLS',
    width: 6,
    points: [
      { x: 21, z: 151 },
      { x: 45, z: 156 },
      { x: 63, z: 169 },
    ],
  },
  {
    id: 'PATH_ISLAND_CHAIN',
    width: 6,
    points: [
      { x: 37, z: 116 },
      { x: 58, z: 138 },
      { x: 76, z: 165 },
      { x: 103, z: 171 },
      { x: 132, z: 149 },
    ],
  },
  {
    id: 'PATH_RUINED_ISLAND',
    width: 7,
    points: [
      { x: 113, z: 153 },
      { x: 132, z: 149 },
      { x: 145, z: 137 },
    ],
  },
] as const;

export const BRIDGES: readonly BridgeFootprint[] = [
  { id: 'BR_VILLAGE_NORTH', x: 0, z: -28, width: 12, depth: 6 },
  { id: 'BR_CRYSTAL_01', x: 55, z: -5, width: 6, depth: 12 },
  { id: 'BR_MEADOW_01', x: -5, z: 65, width: 14, depth: 6 },
  { id: 'BR_ISLAND_01', x: 24, z: 118, width: 15, depth: 6 },
  { id: 'BR_FOREST_RAVINE', x: -111, z: 35, width: 6, depth: 12 },
  { id: 'BR_CRYSTAL_GARDENS', x: 102, z: -28, width: 12, depth: 6 },
  { id: 'BR_CRYSTAL_FALLS', x: 77, z: -57, width: 12, depth: 6 },
  { id: 'BR_MEADOW_FARMS', x: -42, z: 82, width: 12, depth: 6 },
  { id: 'BR_COASTAL_CLIFFS', x: 8, z: 135, width: 12, depth: 6 },
  { id: 'BR_BEACH_COVE', x: 3, z: 164, width: 10, depth: 5 },
  { id: 'BR_ISLAND_CHAIN', x: 76, z: 165, width: 12, depth: 6 },
  { id: 'BR_RUINED_ISLAND', x: 132, z: 149, width: 10, depth: 6 },
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
  [
    { x: -108, z: 3 },
    { x: -111, z: 18 },
    { x: -111, z: 35 },
    { x: -126, z: 47 },
  ],
  [
    { x: 76, z: -58 },
    { x: 84, z: -65 },
    { x: 84, z: -82 },
    { x: 69, z: -91 },
    { x: 60, z: -105 },
  ],
  [
    { x: 8, z: 127 },
    { x: 8, z: 142 },
    { x: -12, z: 155 },
    { x: -33, z: 163 },
    { x: -51, z: 165 },
  ],
  [
    { x: 63, z: 169 },
    { x: 76, z: 165 },
    { x: 94, z: 169 },
    { x: 112, z: 160 },
    { x: 132, z: 149 },
  ],
] as const;

export const ARENA = {
  halfExtent: 198,
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

// Approved world boundary: one entry per round, index 0 = round 1.
export const ARENA_ROUNDS: readonly number[] = [198, 160, 120, 86, 54];

export function arenaHalfExtentForRound(round: number): number {
  return (
    ARENA_ROUNDS[Math.max(0, Math.min(ARENA_ROUNDS.length - 1, round - 1))] ?? ARENA.halfExtent
  );
}

export function distanceSquared(a: Position, b: Position): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

export function normalizeAxes(x: number, z: number): Position {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0 };
  const length = Math.max(1, Math.hypot(x, z));
  return { x: x / length, z: z / length };
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

export function isWalkable(
  position: Position,
  radius: number = GAMEPLAY.playerRadius,
  halfExtent: number = ARENA.halfExtent,
): boolean {
  const limit = halfExtent - radius;
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z) ||
    Math.abs(position.x) > limit ||
    Math.abs(position.z) > limit ||
    !isPermanentLand(position, radius)
  ) {
    return false;
  }
  return !ARENA.blocks.some(
    (block) =>
      Math.abs(position.x - block.x) < block.width / 2 + radius &&
      Math.abs(position.z - block.z) < block.depth / 2 + radius,
  );
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

export function moveKinematic(
  position: Position,
  axes: Position,
  seconds: number,
  halfExtent: number = ARENA.halfExtent,
): Position {
  const direction = normalizeAxes(axes.x, axes.z);
  const limit = halfExtent - GAMEPLAY.playerRadius;
  const clamp = (value: number) => Math.max(-limit, Math.min(limit, value));
  const distance = GAMEPLAY.moveSpeed * Math.max(0, seconds);
  let x = position.x;
  let z = position.z;

  const nextX = { x: clamp(position.x + direction.x * distance), z };
  if (isWalkable(nextX, GAMEPLAY.playerRadius, halfExtent)) x = nextX.x;

  const nextZ = { x, z: clamp(position.z + direction.z * distance) };
  if (isWalkable(nextZ, GAMEPLAY.playerRadius, halfExtent)) z = nextZ.z;
  return { x, z };
}

export interface VerticalMotion {
  y: number;
  verticalVelocity: number;
  isGrounded: boolean;
}

/** Advances authoritative/predicted jump motion against the deterministic terrain surface. */
export function advanceVerticalMotion(
  motion: VerticalMotion,
  position: Position,
  seconds: number,
  wantsJump = false,
): VerticalMotion {
  const groundY = terrainHeightAt(position);
  const dt = Math.max(0, seconds);
  let velocity = motion.verticalVelocity;
  let isGrounded = motion.isGrounded;
  let y = motion.y;

  if (isGrounded) {
    y = groundY;
    velocity = 0;
    if (wantsJump) {
      velocity = GAMEPLAY.jumpSpeed;
      isGrounded = false;
    }
  }

  if (!isGrounded) {
    y += velocity * dt - 0.5 * GAMEPLAY.gravity * dt * dt;
    velocity -= GAMEPLAY.gravity * dt;
    if (y <= groundY) {
      y = groundY;
      velocity = 0;
      isGrounded = true;
    }
  }

  return { y, verticalVelocity: velocity, isGrounded };
}

export function distanceSquared3d(a: SpatialPosition, b: SpatialPosition): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}

function hasSpatialLineOfSight(
  a: SpatialPosition,
  b: SpatialPosition,
  heightOffset: number,
): boolean {
  return !ARENA.blocks.some((block) => {
    let near = 0;
    let far = 1;
    for (const axis of ['x', 'z'] as const) {
      const half = (axis === 'x' ? block.width : block.depth) / 2;
      const min = block[axis] - half;
      const max = block[axis] + half;
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) {
        if (a[axis] < min || a[axis] > max) return false;
      } else {
        const t1 = (min - a[axis]) / delta;
        const t2 = (max - a[axis]) / delta;
        near = Math.max(near, Math.min(t1, t2));
        far = Math.min(far, Math.max(t1, t2));
        if (near > far) return false;
      }
    }
    const intersection = (near + far) / 2;
    const intersectionPosition = {
      x: a.x + (b.x - a.x) * intersection,
      z: a.z + (b.z - a.z) * intersection,
    };
    const rayY = a.y + heightOffset + (b.y - a.y) * intersection;
    const blockTop =
      Math.max(terrainHeightAt(block), terrainHeightAt(intersectionPosition)) + block.height;
    return rayY <= blockTop;
  });
}

/** Tests the interaction ray at character chest height, allowing a jump above low cover. */
export function hasGameplayLineOfSight(a: SpatialPosition, b: SpatialPosition): boolean {
  return hasSpatialLineOfSight(a, b, GAMEPLAY.interactionHeight);
}

/** Tests a projectile segment against the height of authored static cover. */
export function hasProjectileLineOfSight(a: SpatialPosition, b: SpatialPosition): boolean {
  return hasSpatialLineOfSight(a, b, 0);
}

export function hasLineOfSight(a: Position, b: Position): boolean {
  return !ARENA.blocks.some((block) => {
    let near = 0;
    let far = 1;
    for (const axis of ['x', 'z'] as const) {
      const half = (axis === 'x' ? block.width : block.depth) / 2;
      const min = block[axis] - half;
      const max = block[axis] + half;
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-9) {
        if (a[axis] < min || a[axis] > max) return false;
      } else {
        const t1 = (min - a[axis]) / delta;
        const t2 = (max - a[axis]) / delta;
        near = Math.max(near, Math.min(t1, t2));
        far = Math.min(far, Math.max(t1, t2));
        if (near > far) return false;
      }
    }
    return true;
  });
}

export function createSpawnPoints(): Position[] {
  const points: Position[] = [];
  for (let z = -24; z <= 32; z += 2.4) {
    for (let x = -30; x <= 30; x += 2.4) {
      if (isWalkable({ x, z }, 0.8, ARENA.halfExtent)) points.push({ x, z });
    }
  }
  return points.sort(
    (a, b) => a.x ** 2 + a.z ** 2 - (b.x ** 2 + b.z ** 2) || a.z - b.z || a.x - b.x,
  );
}
