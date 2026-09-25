import { isRecord, isEmptyPayload } from './guest.js';
import type { MoveInput, GameMode, MapId, InteractionIntent } from '../protocol/gameplay.js';
const isAngle = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
export function isMoveInput(v: unknown): v is MoveInput {
  return (
    isRecord(v) &&
    Object.keys(v).every((k) =>
      ['sequence', 'x', 'z', 'yaw', 'pitch', 'jump', 'slide', 'sprint', 'crouch'].includes(k),
    ) &&
    typeof v.sequence === 'number' &&
    Number.isInteger(v.sequence) &&
    v.sequence > 0 &&
    v.sequence <= 0xffffffff &&
    isAngle(v.x, 1) &&
    isAngle(v.z, 1) &&
    (v.yaw === undefined || isAngle(v.yaw, Math.PI)) &&
    (v.pitch === undefined || isAngle(v.pitch, (Math.PI * 89) / 180)) &&
    ['jump', 'slide', 'sprint', 'crouch'].every(
      (k) => v[k] === undefined || typeof v[k] === 'boolean',
    )
  );
}
export const isInteractionIntent = (v: unknown): v is InteractionIntent => isEmptyPayload(v);
export function isGameMode(v: unknown): v is GameMode {
  return v === 'tdm';
}
export function isMapId(v: unknown): v is MapId {
  return v === 'frostline' || v === 'island' || v === 'original';
}
