import { isRecord } from './guest.js';
import type { MoveInput, TargetIntent } from '../protocol/gameplay.js';

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
export function isTargetIntent(value: unknown): value is TargetIntent {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    typeof value.targetId === 'string' &&
    value.targetId.length > 0 &&
    value.targetId.length <= 64
  );
}
