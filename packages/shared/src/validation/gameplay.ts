import { isRecord, isEmptyPayload } from './guest.js';
import type {
  MoveInput,
  ShootIntent,
  WeaponSwitchIntent,
  GameMode,
  MapId,
} from '../protocol/gameplay.js';
import type { WeaponId } from '../constants/weapons.js';
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
export function isShootIntent(v: unknown): v is ShootIntent {
  return (
    isRecord(v) &&
    Object.keys(v).every((k) => ['yaw', 'pitch', 'isAds'].includes(k)) &&
    isAngle(v.yaw, Math.PI) &&
    isAngle(v.pitch, (Math.PI * 89) / 180) &&
    (v.isAds === undefined || typeof v.isAds === 'boolean')
  );
}
export const isReloadIntent = isEmptyPayload;
export function isWeaponSwitchIntent(v: unknown): v is WeaponSwitchIntent {
  return (
    isRecord(v) &&
    Object.keys(v).length === 1 &&
    typeof v.slot === 'number' &&
    Number.isInteger(v.slot) &&
    v.slot >= 0 &&
    v.slot <= 2
  );
}
export function isGameMode(v: unknown): v is GameMode {
  return v === 'ffa' || v === 'tdm' || v === 'duel';
}
export function isMapId(v: unknown): v is MapId {
  return v === 'frostline' || v === 'island' || v === 'original';
}
export function isPrimaryWeapon(v: unknown): v is WeaponId {
  return ['assault-rifle', 'smg', 'shotgun', 'sniper'].includes(String(v));
}
