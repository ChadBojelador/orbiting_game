import { expect, it } from 'vitest';
import {
  isMoveInput,
  isInteractionIntent,
  isMapId,
} from './gameplay.js';
it('rejects non-finite, excessive and forged input across FPS boundaries', () => {
  expect(isMoveInput({ sequence: 1, x: 1, z: 0, yaw: 0, pitch: 0, slide: true })).toBe(true);
  for (const input of [
    { sequence: 0, x: 0, z: 0 },
    { sequence: 1, x: 2, z: 0 },
    { sequence: 1, x: NaN, z: 0 },
    { sequence: 1, x: 0, z: 0, pitch: Math.PI },
    { sequence: 1, x: 0, z: 0, unknown: 100 },
    { sequence: 1, x: 0, z: 0, slide: 'yes' },
  ])
    expect(isMoveInput(input)).toBe(false);
  expect(isInteractionIntent({})).toBe(true);
  expect(isInteractionIntent({ targetId: 'forged' })).toBe(false);
});

it('accepts the restored map and rejects unknown map identifiers', () => {
  for (const map of ['frostline', 'island', 'original']) expect(isMapId(map)).toBe(true);
  for (const map of ['freeze-tag', '', null, {}, 'original-world'])
    expect(isMapId(map)).toBe(false);
});
