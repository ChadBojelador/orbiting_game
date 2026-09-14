import { BRIDGES, bridgeDeckHeightAt, bridgeDimensions } from '@ice-water/shared';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WorldLayout } from './world-layout.js';

describe('WorldLayout bridges', () => {
  it('renders closed decks on the same surface used by collision', () => {
    const scene = new THREE.Scene();
    const world = new WorldLayout(scene, 198);
    scene.updateMatrixWorld(true);

    for (const bridge of BRIDGES) {
      const bridgeGroup = scene.getObjectByName(bridge.id);
      const deck = bridgeGroup?.getObjectByName(`${bridge.id}-deck`);
      expect(deck, `${bridge.id} is missing its structural deck`).toBeInstanceOf(THREE.Mesh);
      if (!(deck instanceof THREE.Mesh)) continue;

      const { length, deckWidth } = bridgeDimensions(bridge);
      const cos = Math.cos(bridge.heading);
      const sin = Math.sin(bridge.heading);
      for (const along of [-length / 2 + 0.05, 0, length / 2 - 0.05]) {
        for (const across of [-deckWidth / 2 + 0.05, 0, deckWidth / 2 - 0.05]) {
          const point = {
            x: bridge.x + cos * along - sin * across,
            z: bridge.z + sin * along + cos * across,
          };
          const expectedHeight = bridgeDeckHeightAt(bridge, point);
          const downward = new THREE.Raycaster(
            new THREE.Vector3(point.x, expectedHeight + 2, point.z),
            new THREE.Vector3(0, -1, 0),
            0,
            4,
          );
          const hit = downward.intersectObject(deck, false)[0];
          expect(hit, `${bridge.id} has an open or missing deck section`).toBeDefined();
          expect(hit?.point.y).toBeCloseTo(expectedHeight, 1);
        }
      }

      const centerHeight = bridgeDeckHeightAt(bridge, bridge);
      const upward = new THREE.Raycaster(
        new THREE.Vector3(bridge.x, centerHeight - 2, bridge.z),
        new THREE.Vector3(0, 1, 0),
        0,
        4,
      );
      const underside = upward.intersectObject(deck, false)[0];
      expect(underside, `${bridge.id} exposes a hollow underside`).toBeDefined();
      expect(underside?.point.y).toBeCloseTo(centerHeight - 0.5, 1);

      const alongDirection = new THREE.Vector3(cos, 0, sin);
      const acrossDirection = new THREE.Vector3(-sin, 0, cos);
      for (const [direction, distance] of [
        [alongDirection, length / 2],
        [acrossDirection, deckWidth / 2],
      ] as const) {
        for (const side of [-1, 1]) {
          const surfacePoint = new THREE.Vector3(bridge.x, 0, bridge.z).addScaledVector(
            direction,
            side * distance,
          );
          surfacePoint.y =
            bridgeDeckHeightAt(bridge, { x: surfacePoint.x, z: surfacePoint.z }) - 0.25;
          const sideRay = new THREE.Raycaster(
            surfacePoint.clone().addScaledVector(direction, side * 2),
            direction.clone().multiplyScalar(-side),
            0,
            4,
          );
          expect(
            sideRay.intersectObject(deck, false)[0],
            `${bridge.id} exposes an open edge or end`,
          ).toBeDefined();
        }
      }
    }

    world.destroy();
  });
});
