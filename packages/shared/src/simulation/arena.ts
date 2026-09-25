import {
  originalHeightAt,
  originalSupportHeightAt,
  originalRayDistance,
  isOriginalBodyClear,
  originalCeilingAt,
} from './original-collision.js';
import {
  WORLD_MAX as ORIGINAL_HALF_EXTENT,
  SEA_LEVEL as ORIGINAL_SEA_LEVEL,
} from './original-topology.js';
import { ORIGINAL_SPAWN_POINTS } from './original-spawns.js';
import {
  islandHeightAt,
  islandSupportHeightAt,
  islandRayDistance,
  isIslandBodyClear,
  islandCeilingAt,
  ISLAND_SPAWNS,
} from './island-collision.js';
import { ISLAND_HALF_EXTENT, islandSurfaceAt } from './island-layout.js';
import { GAMEPLAY } from '../constants/gameplay.js';
import type { MapId, Position, SpatialPosition, MoveInput } from '../protocol/gameplay.js';

export interface ArenaBlock extends SpatialPosition {
  id: string;
  width: number;
  depth: number;
  height: number;
}
export interface ArenaRamp extends Position {
  id: string;
  width: number;
  depth: number;
  height: number;
  direction: 1 | -1;
}
const MAP_SCALE = 1.5;
export const ARENA = { halfExtent: 40 * MAP_SCALE } as const;
export const ISLAND_ARENA = { halfExtent: ISLAND_HALF_EXTENT } as const;
export function arenaHalfExtentForMap(mapId: MapId): number {
  if (mapId === 'original') return ORIGINAL_HALF_EXTENT;
  return mapId === 'island' ? ISLAND_ARENA.halfExtent : ARENA.halfExtent;
}
export const HOUSE_LANDMARK: ArenaBlock = {
  id: 'wooden-house',
  x: -30,
  y: 0,
  z: -30,
  width: 8,
  depth: 6.55957,
  height: 5.62012,
};
export const ARENA_BLOCKS: readonly ArenaBlock[] = [
  HOUSE_LANDMARK,
  { id: 'north', x: 0, y: 0, z: -40 * MAP_SCALE, width: 80 * MAP_SCALE, depth: 1, height: 7 },
  { id: 'south', x: 0, y: 0, z: 40 * MAP_SCALE, width: 80 * MAP_SCALE, depth: 1, height: 7 },
  { id: 'west', x: -40 * MAP_SCALE, y: 0, z: 0, width: 1, depth: 80 * MAP_SCALE, height: 7 },
  { id: 'east', x: 40 * MAP_SCALE, y: 0, z: 0, width: 1, depth: 80 * MAP_SCALE, height: 7 },
  ...[-1, 1].flatMap((side) => [
    {
      id: 'lab-' + side,
      x: side * 13 * MAP_SCALE,
      y: 0,
      z: 0,
      width: 3 * MAP_SCALE,
      depth: 18 * MAP_SCALE,
      height: 5,
    },
    {
      id: 'lane-n-' + side,
      x: side * 13 * MAP_SCALE,
      y: 0,
      z: -25 * MAP_SCALE,
      width: 3 * MAP_SCALE,
      depth: 10 * MAP_SCALE,
      height: 4,
    },
    {
      id: 'lane-s-' + side,
      x: side * 13 * MAP_SCALE,
      y: 0,
      z: 25 * MAP_SCALE,
      width: 3 * MAP_SCALE,
      depth: 10 * MAP_SCALE,
      height: 4,
    },
    ...[-24, -8, 8, 24].map((z, i) => ({
      id: 'cover-' + side + '-' + i,
      x: side * (i % 2 ? 30 : 24) * MAP_SCALE,
      y: 0,
      z: z * MAP_SCALE,
      width: 4 * MAP_SCALE,
      depth: 3 * MAP_SCALE,
      height: i % 2 ? 1.2 : 2.4,
    })),
    {
      id: 'mid-' + side,
      x: side * 5 * MAP_SCALE,
      y: 0,
      z: side * 14 * MAP_SCALE,
      width: 4 * MAP_SCALE,
      depth: 3 * MAP_SCALE,
      height: 1.3,
    },
    {
      id: 'catwalk-' + side,
      x: side * 29 * MAP_SCALE,
      y: 0,
      z: 0,
      width: 6 * MAP_SCALE,
      depth: 10 * MAP_SCALE,
      height: 3,
    },
  ]),
  { id: 'reactor', x: 0, y: 0, z: 0, width: 5 * MAP_SCALE, depth: 5 * MAP_SCALE, height: 3.5 },
];
export const ARENA_RAMPS: readonly ArenaRamp[] = [-1, 1].flatMap((side) => [
  {
    id: 'ramp-n-' + side,
    x: side * 29 * MAP_SCALE,
    z: -10 * MAP_SCALE,
    width: 6 * MAP_SCALE,
    depth: 10 * MAP_SCALE,
    height: 3,
    direction: 1 as const,
  },
  {
    id: 'ramp-s-' + side,
    x: side * 29 * MAP_SCALE,
    z: 10 * MAP_SCALE,
    width: 6 * MAP_SCALE,
    depth: 10 * MAP_SCALE,
    height: 3,
    direction: -1 as const,
  },
]);
export const SPAWN_POINTS: readonly Position[] = [
  ...[-34, -22, 0, 22, 34].map((x) => ({ x: x * MAP_SCALE, z: -34 * MAP_SCALE })),
  ...[-34, -22, 0, 22, 34].map((x) => ({ x: x * MAP_SCALE, z: 34 * MAP_SCALE })),
  ...[-35, 35].flatMap((x) => [-18, 18].map((z) => ({ x: x * MAP_SCALE, z: z * MAP_SCALE }))),
  { x: -6 * MAP_SCALE, z: -26 * MAP_SCALE },
  { x: 6 * MAP_SCALE, z: 26 * MAP_SCALE },
];
export const ISLAND_SPAWN_POINTS = ISLAND_SPAWNS;
export const ICE_PATCHES = [
  { x: 0, z: -21 * MAP_SCALE, width: 12 * MAP_SCALE, depth: 9 * MAP_SCALE },
  { x: 0, z: 21 * MAP_SCALE, width: 12 * MAP_SCALE, depth: 9 * MAP_SCALE },
] as const;
export const WATER_PATCHES = [
  { x: -20 * MAP_SCALE, z: 0, width: 4 * MAP_SCALE, depth: 34 * MAP_SCALE },
  { x: 20 * MAP_SCALE, z: 0, width: 4 * MAP_SCALE, depth: 34 * MAP_SCALE },
] as const;
const inside = (p: Position, b: Position & { width: number; depth: number }, margin = 0) =>
  Math.abs(p.x - b.x) <= b.width / 2 + margin && Math.abs(p.z - b.z) <= b.depth / 2 + margin;
export function surfaceAt(p: Position, mapId: MapId = 'frostline'): 'metal' | 'ice' | 'water' {
  if (mapId === 'original') {
    const floor = originalHeightAt(p);
    return floor <= ORIGINAL_SEA_LEVEL ? 'water' : p.z < -55 ? 'ice' : 'metal';
  }
  if (mapId === 'island') {
    if (islandSurfaceAt(p)?.surface === 'ice') return 'ice';
    return islandHeightAt(p) < 0.1 ? 'water' : 'metal';
  }
  if (terrainHeightAt(p) > 0.1) return 'metal';
  if (ICE_PATCHES.some((b) => inside(p, b))) return 'ice';
  return WATER_PATCHES.some((b) => inside(p, b)) ? 'water' : 'metal';
}
export function waterSurfaceYForMap(mapId: MapId): number {
  return mapId === 'original' ? ORIGINAL_SEA_LEVEL : GAMEPLAY.waterSurfaceY;
}
function isSwimmingOnSurface(
  p: SpatialPosition,
  mapId: MapId,
  surface: ReturnType<typeof surfaceAt>,
): boolean {
  return (
    (mapId === 'island' || mapId === 'original') &&
    p.y <= waterSurfaceYForMap(mapId) + GAMEPLAY.waterEntryHeight &&
    surface === 'water'
  );
}
export function isSwimming(p: SpatialPosition, mapId: MapId = 'frostline'): boolean {
  return isSwimmingOnSurface(p, mapId, surfaceAt(p, mapId));
}
export function isUnderwater(p: SpatialPosition, mapId: MapId = 'frostline'): boolean {
  return (
    (mapId === 'island' || mapId === 'original') &&
    p.y < waterSurfaceYForMap(mapId) - 0.05 &&
    surfaceAt(p, mapId) === 'water'
  );
}
export function terrainHeightAt(
  p: Position,
  mapId: MapId = 'frostline',
  maximum = Infinity,
): number {
  if (mapId === 'original') return originalHeightAt(p, maximum);
  if (mapId === 'island') return islandHeightAt(p, maximum);
  for (const ramp of ARENA_RAMPS)
    if (inside(p, ramp))
      return ramp.height * (0.5 + (ramp.direction * (p.z - ramp.z)) / ramp.depth);
  for (const b of ARENA_BLOCKS) if (inside(p, b)) return b.y + b.height;
  return 0;
}
export function createSpawnPoints(): Position[] {
  return SPAWN_POINTS.map((p) => ({ ...p }));
}
export function spawnPointsForMap(mapId: MapId): readonly Position[] {
  if (mapId === 'original') return ORIGINAL_SPAWN_POINTS;
  return mapId === 'island' ? ISLAND_SPAWN_POINTS : SPAWN_POINTS;
}
export function distanceSquared(a: Position, b: Position): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}
export function distanceSquared3d(a: SpatialPosition, b: SpatialPosition): number {
  return distanceSquared(a, b) + (a.y - b.y) ** 2;
}
export function bodyHeight(p: { isSliding: boolean; isCrouching: boolean }): number {
  return p.isSliding || p.isCrouching ? GAMEPLAY.crouchHeight : GAMEPLAY.playerHeight;
}
export function eyeHeight(p: { isSliding: boolean; isCrouching: boolean }): number {
  return p.isSliding
    ? GAMEPLAY.slideEyeHeight
    : p.isCrouching
      ? GAMEPLAY.crouchEyeHeight
      : GAMEPLAY.playerEyeHeight;
}
export function isWalkable(
  p: Position,
  halfExtent: number = ARENA.halfExtent,
  y = 0,
  height: number = GAMEPLAY.playerHeight,
  mapId: MapId = 'frostline',
): boolean {
  const r = GAMEPLAY.playerRadius;
  if (Math.abs(p.x) > halfExtent - r || Math.abs(p.z) > halfExtent - r) return false;
  if (mapId === 'original') return isOriginalBodyClear(p, y, height, r);
  if (mapId === 'island') return isIslandBodyClear(p, y, height, r);
  if (ARENA_BLOCKS.some((b) => inside(p, b, r) && y + 0.32 < b.y + b.height && y + height > b.y))
    return false;
  // A ramp is solid from the ground to its slope. Its sides cannot be climbed.
  return terrainHeightAt(p) <= y + 0.32;
}
export function moveKinematic(
  p: Position,
  input: Position,
  seconds: number,
  halfExtent: number = ARENA.halfExtent,
  speed: number = GAMEPLAY.moveSpeed,
  y = terrainHeightAt(p),
  height: number = GAMEPLAY.playerHeight,
  mapId: MapId = 'frostline',
): Position {
  const magnitude = Math.max(1, Math.hypot(input.x, input.z));
  const dx = (input.x / magnitude) * speed * seconds,
    dz = (input.z / magnitude) * speed * seconds;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  const next = { x: p.x, z: p.z };
  let floor = y;
  for (let i = 0; i < steps; i++) {
    const x = { x: next.x + dx / steps, z: next.z };
    if (isWalkable(x, halfExtent, floor, height, mapId)) next.x = x.x;
    const z = { x: next.x, z: next.z + dz / steps };
    if (isWalkable(z, halfExtent, floor, height, mapId)) next.z = z.z;
    const sampled = supportHeightAt(next, floor + 0.32, mapId);
    if (sampled <= floor + 0.32 && sampled > floor) floor = sampled;
  }
  return next;
}
function supportHeightAt(p: Position, maximum: number, mapId: MapId): number {
  if (mapId === 'island') return islandSupportHeightAt(p, maximum, GAMEPLAY.playerRadius);
  if (mapId === 'original') return originalSupportHeightAt(p, maximum, GAMEPLAY.playerRadius);
  return terrainHeightAt(p, mapId, maximum);
}
export interface VerticalMotion {
  y: number;
  verticalVelocity: number;
  isGrounded: boolean;
}
export function advanceVerticalMotion(
  previous: VerticalMotion,
  position: Position,
  seconds: number,
  wantsJump: boolean,
  mapId: MapId = 'frostline',
  height: number = GAMEPLAY.playerHeight,
  wantsDive = false,
  gravityFactor = 1,
  initialVerticalVelocity?: number,
): VerticalMotion {
  if (isSwimming({ ...position, y: previous.y }, mapId)) {
    const surfaceY = waterSurfaceYForMap(mapId);
    const targetDepth = wantsJump
      ? GAMEPLAY.waterSwimDepth
      : wantsDive && mapId === 'original'
        ? GAMEPLAY.originalWaterDiveDepth
        : GAMEPLAY.waterFloatDepth;
    const targetY = surfaceY - targetDepth;
    const acceleration =
      (targetY - previous.y) * GAMEPLAY.waterBuoyancy -
      previous.verticalVelocity * GAMEPLAY.waterVerticalDrag;
    const verticalVelocity = Math.max(
      -GAMEPLAY.waterMaxSinkSpeed,
      Math.min(GAMEPLAY.waterMaxRiseSpeed, previous.verticalVelocity + acceleration * seconds),
    );
    const y = previous.y + verticalVelocity * seconds;
    return {
      y: Math.min(surfaceY, y),
      verticalVelocity,
      isGrounded: false,
    };
  }
  const floor = supportHeightAt(position, previous.y + 0.32, mapId);
  let velocity = initialVerticalVelocity ?? previous.verticalVelocity;
  if (wantsJump && previous.isGrounded) velocity = GAMEPLAY.jumpSpeed;
  let y = previous.y;
  if (previous.isGrounded && !wantsJump && Math.abs(y - floor) <= 0.32)
    return { y: floor, verticalVelocity: 0, isGrounded: true };
  if (!previous.isGrounded || velocity > 0 || y > floor + 0.06) {
    y += velocity * seconds - 0.5 * GAMEPLAY.gravity * gravityFactor * seconds * seconds;
    velocity -= GAMEPLAY.gravity * gravityFactor * seconds;
  }
  if ((mapId === 'island' || mapId === 'original') && y > previous.y) {
    const ceilingAt = mapId === 'original' ? originalCeilingAt : islandCeilingAt;
    const ceiling = ceilingAt(position, previous.y + height, y - previous.y + 0.01);
    if (y + height > ceiling) {
      y = Math.max(previous.y, ceiling - height);
      velocity = 0;
    }
  }
  if (y <= floor) return { y: floor, verticalVelocity: 0, isGrounded: true };
  return { y, verticalVelocity: velocity, isGrounded: false };
}
interface WallContact {
  normalX: number;
  normalZ: number;
}
function wallContactAt(
  position: Position,
  y: number,
  height: number,
  halfExtent: number,
  mapId: MapId,
): WallContact | undefined {
  const probe = GAMEPLAY.playerRadius + GAMEPLAY.wallRunProbeDistance;
  const contacts: WallContact[] = [
    { normalX: 1, normalZ: 0 },
    { normalX: -1, normalZ: 0 },
    { normalX: 0, normalZ: 1 },
    { normalX: 0, normalZ: -1 },
  ];
  return contacts.find((contact) =>
    !isWalkable(
      {
        x: position.x + contact.normalX * probe,
        z: position.z + contact.normalZ * probe,
      },
      halfExtent,
      y,
      height,
      mapId,
    ),
  );
}
export interface MovementState extends SpatialPosition, VerticalMotion {
  velocityX: number;
  velocityZ: number;
  isSliding: boolean;
  isCrouching: boolean;
  slideUntil: number;
  slideReadyAt: number;
  isWallRunning: boolean;
}
export function simulateMovement(
  p: MovementState,
  input: MoveInput,
  now: number,
  seconds = GAMEPLAY.tickMs / 1000,
  speedMultiplier = 1,
  mapId: MapId = 'frostline',
  steeringFactor = 1,
): MovementState {
  const halfExtent = arenaHalfExtentForMap(mapId);
  const next: MovementState = {
    x: p.x,
    y: p.y,
    z: p.z,
    velocityX: p.velocityX,
    velocityZ: p.velocityZ,
    verticalVelocity: p.verticalVelocity,
    isGrounded: p.isGrounded,
    isSliding: p.isSliding,
    isCrouching: p.isCrouching,
    slideUntil: p.slideUntil,
    slideReadyAt: p.slideReadyAt,
    isWallRunning: false,
  };
  const length = Math.max(1, Math.hypot(input.x, input.z));
  const x = input.x / length,
    z = input.z / length;
  const surface = surfaceAt(p, mapId);
  const swimming = isSwimmingOnSurface(p, mapId, surface);
  if (next.isSliding && (now >= next.slideUntil || input.jump || swimming)) next.isSliding = false;
  if (
    input.slide &&
    !swimming &&
    !next.isSliding &&
    p.isGrounded &&
    now >= p.slideReadyAt &&
    Math.hypot(p.velocityX, p.velocityZ) >= GAMEPLAY.slideMinSpeedThreshold
  ) {
    next.isSliding = true;
    next.slideUntil = now + GAMEPLAY.slideDurationMs;
    next.slideReadyAt = now + GAMEPLAY.slideCooldownMs;
    const speed = Math.hypot(p.velocityX, p.velocityZ);
    next.velocityX =
      (p.velocityX / speed) *
      GAMEPLAY.slideSpeed *
      (surface === 'ice' ? GAMEPLAY.slideIceBonus : 1);
    next.velocityZ =
      (p.velocityZ / speed) *
      GAMEPLAY.slideSpeed *
      (surface === 'ice' ? GAMEPLAY.slideIceBonus : 1);
  }
  next.isCrouching = !swimming && !!input.crouch && !next.isSliding;
  if (
    !next.isSliding &&
    !next.isCrouching &&
    (p.isCrouching || p.isSliding) &&
    !isWalkable(p, halfExtent, p.y, GAMEPLAY.playerHeight, mapId)
  )
    next.isCrouching = true;
  if (next.isSliding) {
    const friction = surface === 'ice' ? GAMEPLAY.iceFriction : GAMEPLAY.slideFriction;
    next.velocityX *= friction;
    next.velocityZ *= friction;
  } else {
    const speed =
      GAMEPLAY.moveSpeed *
      speedMultiplier *
      (next.isCrouching
        ? GAMEPLAY.crouchMultiplier
        : input.sprint && !swimming
          ? GAMEPLAY.sprintMultiplier
          : 1) *
      (surface === 'water' ? GAMEPLAY.waterSpeedPenalty : 1);
    const alpha = (swimming
      ? GAMEPLAY.waterControlFactor
      : p.isGrounded
        ? surface === 'ice'
          ? 0.08
          : 0.82
        : GAMEPLAY.airControlFactor) * steeringFactor;
    next.velocityX += (x * speed - next.velocityX) * alpha;
    next.velocityZ += (z * speed - next.velocityZ) * alpha;
  }
  const travelSpeed = Math.hypot(next.velocityX, next.velocityZ);
  const moved = moveKinematic(
    p,
    {
      x: travelSpeed ? next.velocityX / travelSpeed : 0,
      z: travelSpeed ? next.velocityZ / travelSpeed : 0,
    },
    seconds,
    halfExtent,
    travelSpeed,
    swimming ? waterSurfaceYForMap(mapId) : p.y,
    bodyHeight(next),
    mapId,
  );
  if (Math.abs(moved.x - p.x) < 0.00001) next.velocityX = 0;
  if (Math.abs(moved.z - p.z) < 0.00001) next.velocityZ = 0;
  const previousWall = p.isWallRunning
    ? wallContactAt(p, p.y, bodyHeight(next), halfExtent, mapId)
    : undefined;
  const wall =
    !p.isGrounded && !swimming
      ? wallContactAt(moved, p.y, bodyHeight(next), halfExtent, mapId) ?? previousWall
      : undefined;
  const inputLength = Math.max(1, Math.hypot(input.x, input.z));
  const kickWall = wall ?? { normalX: input.x / inputLength, normalZ: input.z / inputLength };
  const wantsWall = wall && input.x * wall.normalX + input.z * wall.normalZ > 0.1;
  next.isWallRunning = !!wantsWall;
  let wallKicked = false;
  if (p.isWallRunning && input.jump) {
    next.isWallRunning = false;
    wallKicked = true;
    next.velocityX = -kickWall.normalX * GAMEPLAY.wallRunKickSpeed;
    next.velocityZ = -kickWall.normalZ * GAMEPLAY.wallRunKickSpeed;
    next.verticalVelocity = GAMEPLAY.wallRunJumpSpeed;
  }
  Object.assign(
    next,
    moved,
    advanceVerticalMotion(
      p,
      moved,
      seconds,
      !!input.jump && !next.isWallRunning,
      mapId,
      bodyHeight(next),
      !!input.crouch,
      next.isWallRunning ? GAMEPLAY.wallRunGravityFactor : 1,
      wallKicked ? next.verticalVelocity : undefined,
    ),
  );
  return next;
}
/** Slab intersection, returning distance along a normalized ray. */
export function rayBox(
  origin: SpatialPosition,
  direction: SpatialPosition,
  min: SpatialPosition,
  max: SpatialPosition,
  range: number,
): number | null {
  let near = 0,
    far = range;
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = direction[axis],
      o = origin[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }
    const a = (min[axis] - o) / d,
      b = (max[axis] - o) / d;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return null;
  }
  return near;
}
export function worldRayDistance(
  origin: SpatialPosition,
  direction: SpatialPosition,
  range: number,
  mapId: MapId = 'frostline',
): number {
  if (mapId === 'original') return originalRayDistance(origin, direction, range);
  if (mapId === 'island') return islandRayDistance(origin, direction, range);
  let nearest = range;
  if (direction.y < 0) nearest = Math.min(nearest, Math.max(0, -origin.y / direction.y));
  for (const b of ARENA_BLOCKS) {
    const hit = rayBox(
      origin,
      direction,
      { x: b.x - b.width / 2, y: b.y, z: b.z - b.depth / 2 },
      { x: b.x + b.width / 2, y: b.y + b.height, z: b.z + b.depth / 2 },
      nearest,
    );
    if (hit !== null) nearest = hit;
  }
  // Clip a ray against the five planar faces of each solid ramp wedge.
  for (const r of ARENA_RAMPS) {
    const slope = (r.direction * r.height) / r.depth;
    const planes = [
      { n: { x: 1, y: 0, z: 0 }, c: r.x + r.width / 2 },
      { n: { x: -1, y: 0, z: 0 }, c: -r.x + r.width / 2 },
      { n: { x: 0, y: 0, z: 1 }, c: r.z + r.depth / 2 },
      { n: { x: 0, y: 0, z: -1 }, c: -r.z + r.depth / 2 },
      { n: { x: 0, y: -1, z: 0 }, c: 0 },
      { n: { x: 0, y: 1, z: -slope }, c: r.height / 2 - slope * r.z },
    ];
    let lo = 0,
      hi = nearest;
    for (const { n, c } of planes) {
      const start = n.x * origin.x + n.y * origin.y + n.z * origin.z - c;
      const rate = n.x * direction.x + n.y * direction.y + n.z * direction.z;
      if (Math.abs(rate) < 1e-9) {
        if (start > 0) {
          hi = -1;
          break;
        }
        continue;
      }
      const t = -start / rate;
      if (rate < 0) lo = Math.max(lo, t);
      else hi = Math.min(hi, t);
    }
    if (lo <= hi) nearest = Math.min(nearest, lo);
  }
  return nearest;
}
export function lookDirection(yaw: number, pitch: number): SpatialPosition {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
export function hasGameplayLineOfSight(
  a: SpatialPosition,
  b: SpatialPosition,
  mapId: MapId = 'frostline',
): boolean {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
    length = Math.hypot(d.x, d.y, d.z);
  if (length < 0.001) return true;
  return (
    worldRayDistance(a, { x: d.x / length, y: d.y / length, z: d.z / length }, length, mapId) >=
    length - 0.001
  );
}
