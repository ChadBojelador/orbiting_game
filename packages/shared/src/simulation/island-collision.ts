export { ISLAND_SPAWNS } from './island-spawns.js';
import { ISLAND_TRIANGLES_BASE64 } from './island-data.js';
import {
  ISLAND_COVER,
  ISLAND_FORT_SCALE,
  ISLAND_FORT_Y,
  ISLAND_HALF_EXTENT,
  ISLAND_SURFACES,
  isInsideIslandBlock,
  type IslandLayoutBlock,
} from './island-layout.js';
import type { Position, SpatialPosition } from '../protocol/gameplay.js';

const CELL_SIZE = 3;
const ISLAND_BLOCKS: readonly IslandLayoutBlock[] = [...ISLAND_SURFACES, ...ISLAND_COVER];
function decodeTriangles(encoded: string): Float32Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let bits = 0,
    value = 0;
  for (const character of encoded) {
    if (character === '=') break;
    value = (value << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 255);
    }
  }
  const result = new Float32Array(bytes.length / 2);
  for (let i = 0; i < result.length; i++) {
    const unsigned = bytes[i * 2]! | (bytes[i * 2 + 1]! << 8);
    const source = (unsigned >= 32768 ? unsigned - 65536 : unsigned) / 100;
    result[i] = source * ISLAND_FORT_SCALE + (i % 3 === 1 ? ISLAND_FORT_Y : 0);
  }
  return result;
}
const triangles = decodeTriangles(ISLAND_TRIANGLES_BASE64);
const key = (x: number, z: number) => `${x},${z}`;
// Built once from immutable geometry; queries never mutate the index.
const cells: ReadonlyMap<string, readonly number[]> = (() => {
  const result = new Map<string, number[]>();
  for (let i = 0; i < triangles.length; i += 9) {
    const minX = Math.floor(
      Math.min(triangles[i]!, triangles[i + 3]!, triangles[i + 6]!) / CELL_SIZE,
    );
    const maxX = Math.floor(
      Math.max(triangles[i]!, triangles[i + 3]!, triangles[i + 6]!) / CELL_SIZE,
    );
    const minZ = Math.floor(
      Math.min(triangles[i + 2]!, triangles[i + 5]!, triangles[i + 8]!) / CELL_SIZE,
    );
    const maxZ = Math.floor(
      Math.max(triangles[i + 2]!, triangles[i + 5]!, triangles[i + 8]!) / CELL_SIZE,
    );
    for (let x = minX; x <= maxX; x++)
      for (let z = minZ; z <= maxZ; z++) {
        const cellKey = key(x, z),
          bucket = result.get(cellKey) ?? [];
        bucket.push(i);
        result.set(cellKey, bucket);
      }
  }
  return result;
})();

function intersect(i: number, o: SpatialPosition, d: SpatialPosition): number | null {
  const ax = triangles[i]!,
    ay = triangles[i + 1]!,
    az = triangles[i + 2]!;
  const ex = triangles[i + 3]! - ax,
    ey = triangles[i + 4]! - ay,
    ez = triangles[i + 5]! - az;
  const fx = triangles[i + 6]! - ax,
    fy = triangles[i + 7]! - ay,
    fz = triangles[i + 8]! - az;
  const px = d.y * fz - d.z * fy,
    py = d.z * fx - d.x * fz,
    pz = d.x * fy - d.y * fx;
  const det = ex * px + ey * py + ez * pz;
  if (Math.abs(det) < 1e-8) return null;
  const tx = o.x - ax,
    ty = o.y - ay,
    tz = o.z - az;
  const u = (tx * px + ty * py + tz * pz) / det;
  if (u < -1e-6 || u > 1.000001) return null;
  const qx = ty * ez - tz * ey,
    qy = tz * ex - tx * ez,
    qz = tx * ey - ty * ex;
  const v = (d.x * qx + d.y * qy + d.z * qz) / det;
  if (v < -1e-6 || u + v > 1.000001) return null;
  const t = (fx * qx + fy * qy + fz * qz) / det;
  return t >= 0 ? t : null;
}

function intersectBlock(
  block: IslandLayoutBlock,
  origin: SpatialPosition,
  direction: SpatialPosition,
  range: number,
): number | null {
  let near = 0,
    far = range;
  const min = {
      x: block.x - block.width / 2,
      y: block.y,
      z: block.z - block.depth / 2,
    },
    max = {
      x: block.x + block.width / 2,
      y: block.y + block.height,
      z: block.z + block.depth / 2,
    };
  for (const axis of ['x', 'y', 'z'] as const) {
    const distance = direction[axis],
      start = origin[axis];
    if (Math.abs(distance) < 1e-9) {
      if (start < min[axis] || start > max[axis]) return null;
      continue;
    }
    const first = (min[axis] - start) / distance,
      second = (max[axis] - start) / distance;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return null;
  }
  return near;
}

export function islandRayDistance(
  origin: SpatialPosition,
  direction: SpatialPosition,
  range: number,
): number {
  let nearest = range;
  if (direction.y < 0 && origin.y >= 0) nearest = Math.min(nearest, -origin.y / direction.y);
  const tested = new Set<number>();
  const visit = (x: number, z: number) => {
    for (const triangle of cells.get(key(x, z)) ?? []) {
      if (tested.has(triangle)) continue;
      tested.add(triangle);
      const hit = intersect(triangle, origin, direction);
      if (hit !== null && hit < nearest) nearest = hit;
    }
  };

  // Traverse only the grid cells crossed by the ray. The old half-cell sampler
  // inspected a 3 x 3 neighbourhood at every sample, making each short player
  // clearance ray test roughly nine cells and starving bot-enabled room ticks.
  // Triangles are already inserted into every cell touched by their X/Z bounds,
  // so exact 2D grid traversal retains collision coverage without the neighbours.
  let cellX = Math.floor(origin.x / CELL_SIZE),
    cellZ = Math.floor(origin.z / CELL_SIZE);
  const endX = Math.floor((origin.x + direction.x * range) / CELL_SIZE),
    endZ = Math.floor((origin.z + direction.z * range) / CELL_SIZE),
    stepX = Math.sign(direction.x),
    stepZ = Math.sign(direction.z),
    deltaX = stepX === 0 ? Infinity : CELL_SIZE / Math.abs(direction.x),
    deltaZ = stepZ === 0 ? Infinity : CELL_SIZE / Math.abs(direction.z);
  let crossingX =
      stepX === 0
        ? Infinity
        : ((stepX > 0 ? (cellX + 1) * CELL_SIZE : cellX * CELL_SIZE) - origin.x) / direction.x,
    crossingZ =
      stepZ === 0
        ? Infinity
        : ((stepZ > 0 ? (cellZ + 1) * CELL_SIZE : cellZ * CELL_SIZE) - origin.z) / direction.z;

  while (true) {
    visit(cellX, cellZ);
    if (cellX === endX && cellZ === endZ) break;
    const crossing = Math.min(crossingX, crossingZ);
    if (crossing > nearest) break;
    const crossesX = crossingX <= crossingZ,
      crossesZ = crossingZ <= crossingX;
    if (crossesX) {
      cellX += stepX;
      crossingX += deltaX;
    }
    if (crossesZ) {
      cellZ += stepZ;
      crossingZ += deltaZ;
    }
  }
  for (const block of ISLAND_BLOCKS) {
    const hit = intersectBlock(block, origin, direction, nearest);
    if (hit !== null && hit < nearest) nearest = hit;
  }
  return nearest;
}

export function islandHeightAt(position: Position, maximum = 30): number {
  const top = Math.min(30, maximum),
    range = Math.max(0, top);
  const origin = { ...position, y: top },
    direction = { x: 0, y: -1, z: 0 };
  let nearest = range;
  for (const triangle of cells.get(
    key(Math.floor(position.x / CELL_SIZE), Math.floor(position.z / CELL_SIZE)),
  ) ?? []) {
    const hit = intersect(triangle, origin, direction);
    if (hit !== null && hit < nearest) nearest = hit;
  }
  let floor = Math.max(0, top - nearest);
  for (const block of ISLAND_BLOCKS) {
    const blockTop = block.y + block.height;
    if (blockTop <= top && isInsideIslandBlock(position, block)) floor = Math.max(floor, blockTop);
  }
  return floor;
}

export function isIslandBodyClear(
  position: Position,
  y: number,
  height: number,
  radius: number,
): boolean {
  for (const block of ISLAND_BLOCKS) {
    if (
      isInsideIslandBlock(position, block, radius) &&
      y + 0.32 < block.y + block.height &&
      y + height > block.y
    )
      return false;
  }
  for (const level of [y + 0.33, y + height / 2, y + height - 0.05]) {
    if (
      islandRayDistance(
        { x: position.x - radius, y: level, z: position.z },
        { x: 1, y: 0, z: 0 },
        radius * 2,
      ) <
      radius * 2
    )
      return false;
    if (
      islandRayDistance(
        { x: position.x, y: level, z: position.z - radius },
        { x: 0, y: 0, z: 1 },
        radius * 2,
      ) <
      radius * 2
    )
      return false;
  }
  // Only block when geometry intrudes into the upper half of the player body.
  // Using the full headroom (height - 0.33) is too strict: open-air positions
  // near sloped roofs or overhanging ledges would fail even though the player
  // can stand there comfortably. A ceiling closer than height * 0.5 (≈ 0.9 m
  // above the waist ray origin) is a genuine obstruction.
  const ceilingClearance = height * 0.5;
  const ceiling = islandRayDistance(
    { ...position, y: y + 0.33 },
    { x: 0, y: 1, z: 0 },
    Math.max(0, ceilingClearance),
  );
  return ceiling >= ceilingClearance;
}

/** Feet have width: center-only grounding lets a body sink into a ledge beside it. */
export function islandSupportHeightAt(position: Position, maximum: number, radius: number): number {
  let floor = islandHeightAt(position, maximum);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    floor = Math.max(
      floor,
      islandHeightAt(
        { x: position.x + Math.cos(angle) * radius, z: position.z + Math.sin(angle) * radius },
        maximum,
      ),
    );
  }
  return floor;
}

export function islandCeilingAt(position: Position, headY: number, distance: number): number {
  return headY + islandRayDistance({ ...position, y: headY }, { x: 0, y: 1, z: 0 }, distance);
}

export function findIslandSpawns(): readonly Position[] {
  const candidates: Position[] = [];
  for (let x = -ISLAND_HALF_EXTENT + 2; x <= ISLAND_HALF_EXTENT - 2; x += 2)
    for (let z = -ISLAND_HALF_EXTENT + 2; z <= ISLAND_HALF_EXTENT - 2; z += 2) {
      const p = { x, z },
        y = islandHeightAt(p);
      if (y < 0.4 || y > 6 || !isIslandBodyClear(p, y, 1.8, 0.5)) continue;
      if (
        [
          { x: x - 0.7, z },
          { x: x + 0.7, z },
          { x, z: z - 0.7 },
          { x, z: z + 0.7 },
        ].some((q) => Math.abs(islandHeightAt(q) - y) > 0.12)
      )
        continue;
      // A clear standing point is insufficient: small ledges and doorway pockets
      // can trap a newly spawned player. Require a usable route in their initial
      // (arena-facing) direction, including the complete body at every substep.
      const length = Math.hypot(x, z) || 1;
      let floor = y,
        hasExit = true;
      for (let distance = 0.15; distance <= 2; distance += 0.15) {
        const next = { x: x - (x / length) * distance, z: z - (z / length) * distance };
        const nextFloor = islandHeightAt(next, floor + 0.32);
        if (
          Math.abs(nextFloor - floor) > 0.32 ||
          !isIslandBodyClear(next, Math.max(floor, nextFloor), 1.8, 0.5)
        ) {
          hasExit = false;
          break;
        }
        floor = nextFloor;
      }
      if (!hasExit) continue;
      candidates.push(p);
    }
  const chosen: Position[] = [];
  while (chosen.length < 16 && candidates.length) {
    let best = 0,
      score = -1;
    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i]!;
      const distance = chosen.length
        ? Math.min(...chosen.map((q) => (p.x - q.x) ** 2 + (p.z - q.z) ** 2))
        : p.x * p.x + p.z * p.z;
      if (distance > score) {
        best = i;
        score = distance;
      }
    }
    chosen.push(candidates.splice(best, 1)[0]!);
  }
  if (chosen.length < 16) throw new Error('Island has insufficient safe spawn surfaces');
  return chosen;
}
