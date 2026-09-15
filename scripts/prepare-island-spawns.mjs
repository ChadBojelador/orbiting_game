import {
  GAMEPLAY,
  ISLAND_SPAWN_POINTS,
  isWalkable,
  simulateMovement,
  terrainHeightAt,
} from '../packages/shared/dist/index.js';

if (ISLAND_SPAWN_POINTS.length !== 16) throw new Error('Frost Island requires sixteen spawns');
if (new Set(ISLAND_SPAWN_POINTS.map((spawn) => `${spawn.x},${spawn.z}`)).size !== 16)
  throw new Error('Frost Island spawns must be distinct');

for (const spawn of ISLAND_SPAWN_POINTS) {
  const length = Math.hypot(spawn.x, spawn.z) || 1;
  let player = {
    ...spawn,
    y: terrainHeightAt(spawn, 'island'),
    velocityX: 0,
    velocityZ: 0,
    verticalVelocity: 0,
    isGrounded: true,
    isSliding: false,
    isCrouching: false,
    slideUntil: 0,
    slideReadyAt: 0,
  };
  if (!isWalkable(player, 80, player.y, GAMEPLAY.playerHeight, 'island'))
    throw new Error(`Unsafe Frost Island spawn at ${spawn.x},${spawn.z}`);
  for (let tick = 1; tick <= 8; tick++)
    player = simulateMovement(
      player,
      { x: -spawn.x / length, z: -spawn.z / length, sequence: tick },
      tick * GAMEPLAY.tickMs,
      GAMEPLAY.tickMs / 1000,
      1,
      'island',
    );
  if (Math.hypot(player.x - spawn.x, player.z - spawn.z) <= 1.5)
    throw new Error(`Frost Island spawn lacks a clear exit at ${spawn.x},${spawn.z}`);
}

console.log(`Validated ${ISLAND_SPAWN_POINTS.length} authored Frost Island spawns`);
