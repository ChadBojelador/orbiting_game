import { GAMEPLAY } from '../constants/gameplay.js';
import type { Position } from '../protocol/gameplay.js';

export interface ArenaBlock extends Position { width: number; depth: number; height: number }
export const ARENA = {
  halfExtent: 28,
  blocks: [
    { x: -8, z: -8, width: 4, depth: 4, height: 1.8 },
    { x: 8, z: -8, width: 4, depth: 4, height: 1.8 },
    { x: -8, z: 8, width: 4, depth: 4, height: 1.8 },
    { x: 8, z: 8, width: 4, depth: 4, height: 1.8 },
    { x: 0, z: -17, width: 8, depth: 2, height: 1.2 },
    { x: 0, z: 17, width: 8, depth: 2, height: 1.2 },
  ] as readonly ArenaBlock[],
} as const;

export function distanceSquared(a: Position, b: Position): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}
export function normalizeAxes(x: number, z: number): Position {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: 0, z: 0 };
  const length = Math.max(1, Math.hypot(x, z));
  return { x: x / length, z: z / length };
}
export function isWalkable(position: Position, radius = GAMEPLAY.playerRadius): boolean {
  const limit = ARENA.halfExtent - radius;
  return Number.isFinite(position.x) && Number.isFinite(position.z) &&
    Math.abs(position.x) <= limit && Math.abs(position.z) <= limit &&
    !ARENA.blocks.some(block =>
      Math.abs(position.x - block.x) < block.width / 2 + radius &&
      Math.abs(position.z - block.z) < block.depth / 2 + radius);
}

// Conservative swept square footprint: separate axes permit wall sliding and
// clip against the entire segment, so even long prediction corrections cannot tunnel.
export function moveKinematic(position: Position, axes: Position, seconds: number): Position {
  const direction = normalizeAxes(axes.x, axes.z);
  const limit = ARENA.halfExtent - GAMEPLAY.playerRadius;
  const clamp = (n: number) => Math.max(-limit, Math.min(limit, n));
  let x = clamp(position.x + direction.x * GAMEPLAY.moveSpeed * Math.max(0, seconds));
  for (const block of ARENA.blocks) {
    const left = block.x - block.width / 2 - GAMEPLAY.playerRadius;
    const right = block.x + block.width / 2 + GAMEPLAY.playerRadius;
    if (Math.abs(position.z - block.z) >= block.depth / 2 + GAMEPLAY.playerRadius) continue;
    if (position.x <= left && x > left) x = left;
    if (position.x >= right && x < right) x = right;
  }
  let z = clamp(position.z + direction.z * GAMEPLAY.moveSpeed * Math.max(0, seconds));
  for (const block of ARENA.blocks) {
    const front = block.z - block.depth / 2 - GAMEPLAY.playerRadius;
    const back = block.z + block.depth / 2 + GAMEPLAY.playerRadius;
    if (Math.abs(x - block.x) >= block.width / 2 + GAMEPLAY.playerRadius) continue;
    if (position.z <= front && z > front) z = front;
    if (position.z >= back && z < back) z = back;
  }
  return { x, z };
}

export function hasLineOfSight(a: Position, b: Position): boolean {
  return !ARENA.blocks.some(block => {
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
  for (let z = -24; z <= 24; z += 3)
    for (let x = -24; x <= 24; x += 3)
      if (isWalkable({ x, z }, 0.8)) points.push({ x, z });
  return points.sort((a, b) => a.x ** 2 + a.z ** 2 - b.x ** 2 - b.z ** 2 || a.z - b.z || a.x - b.x);
}
