import { expect, it } from 'vitest';
import { simulateMovement, type PlayerView } from '@ice-water/shared';
import { LocalPrediction, RemoteInterpolation } from './player-motion.js';
function player(): PlayerView {
  return {
    playerId: 'p',
    displayName: 'Player',
    team: 'none',
    isConnected: true,
    isBot: false,
    reconnectDeadline: 0,
    x: 0,
    y: 0,
    z: -34,
    yaw: 0,
    pitch: 0,
    velocityX: 0,
    velocityZ: 0,
    verticalVelocity: 0,
    isGrounded: true,
    inputSequence: 0,
    status: 'alive',
    protectedUntil: 0,
    isSliding: false,
    isCrouching: false,
    slideUntil: 0,
    slideReadyAt: 0,
    hp: 100,
    kills: 0,
    deaths: 0,
    currentWeaponSlot: 0,
    primaryWeapon: 'assault-rifle',
    weaponId: 'assault-rifle',
    ammo: 30,
    reserveAmmo: 120,
    reloadUntil: 0,
    fireReadyAt: 0,
    respawnAt: 0,
    spawnGeneration: 1,
    lastKillerId: '',
    lastDeathWeapon: 'assault-rifle',
    ping: 0,
  };
}
it('replays pending inputs identically to the server and clears prediction on respawn', () => {
  const p = player(),
    prediction = new LocalPrediction();
  prediction.reconcile(p, true);
  const first = prediction.predict({ x: 1, z: 0 }, true, 50);
  const second = prediction.predict({ x: 1, z: 0, jump: true }, true, 100);
  const server = simulateMovement(p, first, 50);
  prediction.reconcile({ ...p, ...server, inputSequence: first.sequence }, true);
  expect(prediction.motion).toEqual(simulateMovement(server, second, 100));
  prediction.reconcile({ ...p, spawnGeneration: 2 }, true);
  expect(prediction.motion.x).toBe(0);
});
it('interpolates remote poses and snaps generations instead of flying across the map', () => {
  const remote = new RemoteInterpolation(),
    p = player();
  remote.push(p, 100);
  remote.push({ ...p, x: 2 }, 200);
  expect(remote.at(150)?.x).toBe(1);
  remote.push({ ...p, x: 30, spawnGeneration: 2 }, 300);
  expect(remote.at(250)?.x).toBe(30);
});
