import type { MapId } from '@ice-water/shared';

export interface WaterEnvironment {
  background: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
}

const DEFAULT_ENVIRONMENT: WaterEnvironment = {
  background: 0xc5e4ef,
  fogColor: 0xc5e4ef,
  fogNear: 150,
  fogFar: 300,
};

const ORIGINAL_ENVIRONMENT: WaterEnvironment = {
  background: 0xa4e8ee,
  fogColor: 0xa4e8ee,
  fogNear: 190,
  fogFar: 440,
};

const UNDERWATER_ENVIRONMENT: WaterEnvironment = {
  background: 0x0a4f65,
  fogColor: 0x126d7e,
  fogNear: 0.25,
  fogFar: 42,
};

export function waterEnvironmentFor(mapId: MapId, isUnderwater: boolean): WaterEnvironment {
  if (isUnderwater) return UNDERWATER_ENVIRONMENT;
  return mapId === 'original' ? ORIGINAL_ENVIRONMENT : DEFAULT_ENVIRONMENT;
}
