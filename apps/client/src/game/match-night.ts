import type { MapId } from '@ice-water/shared';
import { waterEnvironmentFor, type WaterEnvironment } from './water-presentation.js';

export const NIGHTFALL_START_MS = 120_000;
export const NIGHTFALL_DURATION_MS = 12_000;
export const TWO_MINUTE_WARNING_DURATION_MS = 5_000;

const NIGHT_ENVIRONMENT: WaterEnvironment = {
  background: 0x071426,
  fogColor: 0x102842,
  fogNear: 105,
  fogFar: 255,
};

export function matchNightProgress(
  mapId: MapId,
  remainingMs: number,
  hasReducedEffects: boolean,
): number {
  if (mapId === 'original') return 1;
  if (remainingMs > NIGHTFALL_START_MS) return 0;
  if (hasReducedEffects) return 1;
  const linear = clamp01((NIGHTFALL_START_MS - remainingMs) / NIGHTFALL_DURATION_MS);
  return linear * linear * (3 - 2 * linear);
}

export function isTwoMinuteWarningVisible(remainingMs: number): boolean {
  return (
    remainingMs <= NIGHTFALL_START_MS &&
    remainingMs > NIGHTFALL_START_MS - TWO_MINUTE_WARNING_DURATION_MS
  );
}

export function matchEnvironmentFor(
  mapId: MapId,
  isUnderwater: boolean,
  nightProgress: number,
): WaterEnvironment {
  const environment = waterEnvironmentFor(mapId, isUnderwater);
  if (mapId === 'original' || isUnderwater) return environment;
  const progress = clamp01(nightProgress);
  return {
    background: mixHexColor(environment.background, NIGHT_ENVIRONMENT.background, progress),
    fogColor: mixHexColor(environment.fogColor, NIGHT_ENVIRONMENT.fogColor, progress),
    fogNear: mix(environment.fogNear, NIGHT_ENVIRONMENT.fogNear, progress),
    fogFar: mix(environment.fogFar, NIGHT_ENVIRONMENT.fogFar, progress),
  };
}

function mixHexColor(from: number, to: number, progress: number): number {
  const red = Math.round(mix((from >> 16) & 0xff, (to >> 16) & 0xff, progress));
  const green = Math.round(mix((from >> 8) & 0xff, (to >> 8) & 0xff, progress));
  const blue = Math.round(mix(from & 0xff, to & 0xff, progress));
  return (red << 16) | (green << 8) | blue;
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
