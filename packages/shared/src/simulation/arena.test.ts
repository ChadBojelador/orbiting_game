import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '../constants/gameplay.js';
import {
  ARENA,
  SPAWN_POINTS,
  simulateMovement,
  moveKinematic,
  isWalkable,
  terrainHeightAt,
  surfaceAt,
  isSwimming,
  worldRayDistance,
  lookDirection,
  type MovementState,
} from './arena.js';
const motion = (x = 0, z = -34): MovementState => ({
  x,
  y: 0,
  z,
  velocityX: 0,
  velocityZ: 0,
  verticalVelocity: 0,
  isGrounded: true,
  isSliding: false,
  isCrouching: false,
  slideUntil: 0,
  slideReadyAt: 0,
});
describe('Frostline movement and collision', () => {
  it('keeps all sixteen spawn points valid and distinct', () => {
    expect(SPAWN_POINTS).toHaveLength(16);
    expect(new Set(SPAWN_POINTS.map((p) => JSON.stringify(p))).size).toBe(16);
    expect(SPAWN_POINTS.every((p) => isWalkable(p))).toBe(true);
  });
  it('normalizes diagonals and prevents tunneling at high speed', () => {
    const cardinal = moveKinematic({ x: 0, z: -34 }, { x: 1, z: 0 }, 0.05);
    const diagonal = moveKinematic({ x: 0, z: -34 }, { x: 1, z: 1 }, 0.05);
    expect(Math.hypot(diagonal.x, diagonal.z + 34)).toBeCloseTo(cardinal.x);
    const wall = moveKinematic({ x: -51, z: -51 }, { x: -1, z: 0 }, 2, ARENA.halfExtent, 40);
    expect(wall.x).toBeGreaterThan(-59.2);
  });
  it('jumps once while grounded and lands under fixed time', () => {
    let p = simulateMovement(motion(), { x: 0, z: 0, sequence: 1, jump: true }, 50);
    const velocity = p.verticalVelocity;
    p = simulateMovement(p, { x: 0, z: 0, sequence: 2, jump: true }, 100);
    expect(p.verticalVelocity).toBeLessThan(velocity);
    for (let t = 150; t <= 1200; t += 50) p = simulateMovement(p, { x: 0, z: 0, sequence: t }, t);
    expect(p.y).toBe(0);
    expect(p.isGrounded).toBe(true);
  });
  it('validates slide prerequisites, cooldown, stance and jump chaining', () => {
    expect(simulateMovement(motion(), { x: 1, z: 0, sequence: 1, slide: true }, 50).isSliding).toBe(
      false,
    );
    let p = motion();
    p.velocityX = 12;
    p = simulateMovement(p, { x: 1, z: 0, sequence: 2, slide: true }, 100);
    expect(p.isSliding).toBe(true);
    expect(p.velocityX).toBeGreaterThan(12);
    p = simulateMovement(p, { x: 1, z: 0, sequence: 3, jump: true }, 150);
    expect(p.isSliding).toBe(false);
    expect(p.isGrounded).toBe(false);
    expect(p.y).toBeGreaterThan(0);
    p.isGrounded = true;
    p.y = 0;
    expect(simulateMovement(p, { x: 1, z: 0, sequence: 4, slide: true }, 200).isSliding).toBe(
      false,
    );
  });
  it('slows water and crouch movement and retains more ice momentum', () => {
    const input = { x: 0, z: 1, sequence: 1 };
    expect(simulateMovement(motion(-30, -24), input, 50).velocityZ).toBeLessThan(
      simulateMovement(motion(-51, -24), input, 50).velocityZ,
    );
    expect(simulateMovement(motion(), { ...input, crouch: true }, 50).velocityZ).toBeLessThan(
      simulateMovement(motion(), input, 50).velocityZ,
    );
    const ice = motion(0, -33),
      metal = motion(-51, -33);
    ice.velocityZ = metal.velocityZ = 12;
    expect(simulateMovement(ice, { x: 0, z: 0, sequence: 1 }, 50).velocityZ).toBeGreaterThan(
      simulateMovement(metal, { x: 0, z: 0, sequence: 1 }, 50).velocityZ,
    );
  });
  it('allows ramp traversal to the catwalk but rejects climbing its sides', () => {
    let p = motion(-43.5, -24);
    for (let t = 50; t <= 1300; t += 50) p = simulateMovement(p, { x: 0, z: 1, sequence: t }, t);
    expect(p.y).toBeGreaterThan(2.5);
    expect(p.z).toBeGreaterThan(-10);
    expect(terrainHeightAt({ x: -43.5, z: -15 })).toBe(1.5);
    expect(isWalkable({ x: -43.5, z: 0 }, ARENA.halfExtent, 0)).toBe(false);
  });
  it('hits walls, the ground, and ramp wedges with bounded rays', () => {
    expect(worldRayDistance({ x: 0, y: 1.6, z: -10 }, lookDirection(0, 0), 100)).toBeCloseTo(49.5);
    expect(
      worldRayDistance({ x: -43.5, y: 1, z: -24 }, lookDirection(Math.PI, 0), 20),
    ).toBeLessThan(7);
    expect(worldRayDistance({ x: 0, y: 2, z: -51 }, { x: 0, y: -1, z: 0 }, 100)).toBe(2);
  });
});

describe('Island water physics', () => {
  const waterMotion = (): MovementState => ({
    ...motion(20, -54),
    y: GAMEPLAY.waterSurfaceY,
  });

  it('settles a player at the configured buoyant depth', () => {
    let p = waterMotion();
    expect(surfaceAt(p, 'island')).toBe('water');
    for (let tick = 1; tick <= 60; tick++)
      p = simulateMovement(p, { x: 0, z: 0, sequence: tick }, tick * 50, 0.05, 1, 'island');
    expect(p.y).toBeCloseTo(-GAMEPLAY.waterFloatDepth, 2);
    expect(p.verticalVelocity).toBeCloseTo(0, 2);
    expect(p.isGrounded).toBe(false);
    expect(isSwimming(p, 'island')).toBe(true);
  });

  it('uses jump to swim upward and ignores sprint and slide boosts', () => {
    let floating = waterMotion();
    for (let tick = 1; tick <= 40; tick++)
      floating = simulateMovement(
        floating,
        { x: 0, z: 0, sequence: tick },
        tick * 50,
        0.05,
        1,
        'island',
      );
    const startY = floating.y;
    for (let tick = 41; tick <= 60; tick++)
      floating = simulateMovement(
        floating,
        { x: 0, z: 0, jump: true, sequence: tick },
        tick * 50,
        0.05,
        1,
        'island',
      );
    expect(floating.y).toBeGreaterThan(startY + 0.25);
    expect(floating.y).toBeLessThanOrEqual(GAMEPLAY.waterSurfaceY);

    const normal = simulateMovement(
      waterMotion(),
      { x: 1, z: 0, sequence: 1 },
      50,
      0.05,
      1,
      'island',
    );
    const sprinting = simulateMovement(
      waterMotion(),
      { x: 1, z: 0, sprint: true, slide: true, sequence: 1 },
      50,
      0.05,
      1,
      'island',
    );
    expect(sprinting.velocityX).toBeCloseTo(normal.velocityX);
    expect(sprinting.isSliding).toBe(false);
  });

  it('lets a submerged player climb onto a low shoreline', () => {
    let p: MovementState = { ...waterMotion(), x: 13, z: -23 };
    for (let tick = 1; tick <= 20; tick++)
      p = simulateMovement(p, { x: -1, z: 0, sequence: tick }, tick * 50, 0.05, 1, 'island');
    expect(surfaceAt(p, 'island')).toBe('metal');
    expect(p.y).toBeCloseTo(0.25);
    expect(p.isGrounded).toBe(true);
  });
});
