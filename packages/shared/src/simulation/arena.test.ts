import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../constants/gameplay.js';
import {
  hasLineOfSight,
  isWalkable,
  moveKinematic,
  type StaticCollisionGeometry,
} from './arena.js';

const customWorld: StaticCollisionGeometry = {
  blocks: [{ x: 2, z: 0, width: 1, depth: 4, height: 3 }],
};

describe('static world collision integration', () => {
  it('uses supplied world geometry for walkability and line of sight', () => {
    expect(isWalkable({ x: 2, z: 0 }, GAMEPLAY.playerRadius, 10, customWorld)).toBe(false);
    expect(hasLineOfSight({ x: 0, z: 0 }, { x: 4, z: 0 }, customWorld)).toBe(false);
    expect(hasLineOfSight({ x: 0, z: 4 }, { x: 4, z: 4 }, customWorld)).toBe(true);
  });

  it('slides against supplied simplified colliders', () => {
    const position = moveKinematic({ x: 1, z: -1 }, { x: 1, z: 1 }, 1, 10, customWorld);

    expect(position.x).toBeCloseTo(2 - 0.5 - GAMEPLAY.playerRadius);
    expect(position.z).toBeGreaterThan(-1);
  });
});
