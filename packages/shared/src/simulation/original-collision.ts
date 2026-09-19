// Indexed collision baked from the restored renderer, including terrain and solid landmarks.
import { ORIGINAL_TRIANGLES_BASE64 } from './original-data.js';
import { WATER_BOTTOM } from './original-topology.js';
import type { Position, SpatialPosition } from '../protocol/gameplay.js';
const CELL_SIZE = 3;
const SEABED = WATER_BOTTOM;
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
    result[i] = source;
  }
  return result;
}
const triangles = decodeTriangles(ORIGINAL_TRIANGLES_BASE64);
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

export function originalRayDistance(
  origin: SpatialPosition,
  direction: SpatialPosition,
  range: number,
): number {
  let nearest = range;
  if (direction.y < 0 && origin.y >= SEABED)
    nearest = Math.min(nearest, (SEABED - origin.y) / direction.y);
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

  return nearest;
}

export function originalHeightAt(position: Position, maximum = 100): number {
  const top = Math.min(100, maximum),
    range = Math.max(0, top - SEABED);
  const origin = { ...position, y: top },
    direction = { x: 0, y: -1, z: 0 };
  let nearest = range;
  for (const triangle of cells.get(
    key(Math.floor(position.x / CELL_SIZE), Math.floor(position.z / CELL_SIZE)),
  ) ?? []) {
    const hit = intersect(triangle, origin, direction);
    if (hit !== null && hit < nearest) nearest = hit;
  }
  const floor = Math.max(SEABED, top - nearest);

  return floor;
}

export function isOriginalBodyClear(
  position: Position,
  y: number,
  height: number,
  radius: number,
): boolean {
  for (const level of [y + 0.33, y + height / 2, y + height - 0.05]) {
    if (
      originalRayDistance(
        { x: position.x - radius, y: level, z: position.z },
        { x: 1, y: 0, z: 0 },
        radius * 2,
      ) <
      radius * 2
    )
      return false;
    if (
      originalRayDistance(
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
  const ceiling = originalRayDistance(
    { ...position, y: y + 0.33 },
    { x: 0, y: 1, z: 0 },
    Math.max(0, ceilingClearance),
  );
  return ceiling >= ceilingClearance;
}

/** Feet have width: center-only grounding lets a body sink into a ledge beside it. */
export function originalSupportHeightAt(
  position: Position,
  maximum: number,
  radius: number,
): number {
  let floor = originalHeightAt(position, maximum);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    floor = Math.max(
      floor,
      originalHeightAt(
        { x: position.x + Math.cos(angle) * radius, z: position.z + Math.sin(angle) * radius },
        maximum,
      ),
    );
  }
  return floor;
}

export function originalCeilingAt(position: Position, headY: number, distance: number): number {
  return headY + originalRayDistance({ ...position, y: headY }, { x: 0, y: 1, z: 0 }, distance);
}
