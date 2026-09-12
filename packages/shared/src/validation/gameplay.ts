import { isRecord } from './guest.js';
import type { FrostThrowIntent, MoveInput, TargetIntent } from '../protocol/gameplay.js';

export function isMoveInput(value: unknown): value is MoveInput {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => ['sequence', 'x', 'z', 'jump'].includes(key)) &&
    Object.keys(value).length >= 3 &&
    Object.keys(value).length <= 4 &&
    typeof value.sequence === 'number' &&
    Number.isInteger(value.sequence) &&
    value.sequence > 0 &&
    value.sequence <= 0xffffffff &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    Math.abs(value.x) <= 1 &&
    typeof value.z === 'number' &&
    Number.isFinite(value.z) &&
    Math.abs(value.z) <= 1 &&
    (value.jump === undefined || typeof value.jump === 'boolean')
  );
}
export function isFrostThrowIntent(value: unknown): value is FrostThrowIntent {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    !['directionX', 'directionY', 'directionZ'].every((key) => key in value) ||
    typeof value.directionX !== 'number' ||
    typeof value.directionY !== 'number' ||
    typeof value.directionZ !== 'number' ||
    !Number.isFinite(value.directionX) ||
    !Number.isFinite(value.directionY) ||
    !Number.isFinite(value.directionZ)
  ) {
    return false;
  }
  const magnitude = Math.hypot(value.directionX, value.directionY, value.directionZ);
  return (
    magnitude >= 0.9 && magnitude <= 1.1 && value.directionY >= -0.35 && value.directionY <= 0.5
  );
}
export function isTargetIntent(value: unknown): value is TargetIntent {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    typeof value.targetId === 'string' &&
    value.targetId.length > 0 &&
    value.targetId.length <= 64
  );
}
