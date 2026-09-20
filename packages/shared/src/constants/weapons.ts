// Weapon definitions — all configurable for balance tuning.
export interface WeaponStats {
  name: string;
  slot: 'primary' | 'secondary' | 'melee';
  damage: number;
  headshotMultiplier: number;
  fireRateMs: number; // ms between shots
  magazineSize: number;
  reserveAmmo: number;
  reloadMs: number;
  spread: number; // radians — hipfire
  adsSpread: number; // radians — ADS
  recoilVertical: number; // degrees per shot
  recoilHorizontalMax: number; // degrees per shot
  recoilRecoveryRate: number; // degrees per second
  range: number; // maximum hitscan travel in metres; falloff controls long-range damage
  falloffStart: number; // range at which damage begins to fall off
  falloffEnd: number; // range at which damage reaches minimum
  falloffMinDamage: number; // minimum damage at max range (fraction 0-1)
  moveSpeedMultiplier: number; // 1.0 = no penalty
  adsZoomFov: number; // FOV when aiming down sights
  fireMode: 'auto' | 'semi' | 'burst' | 'pump';
  pelletsPerShot: number; // > 1 for shotguns
}

// Long enough to cross Original World's widest playable sightline. Static map
// geometry still clips every shot before this distance.
const FIREARM_HITSCAN_RANGE = 400;

export type WeaponId = 'assault-rifle' | 'smg' | 'shotgun' | 'sniper' | 'pistol' | 'ice-pick';

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  'assault-rifle': {
    name: 'Frost AR',
    slot: 'primary',
    damage: 22,
    headshotMultiplier: 2.0,
    fireRateMs: 100,
    magazineSize: 30,
    reserveAmmo: 120,
    reloadMs: 2000,
    spread: 0.025,
    adsSpread: 0,
    recoilVertical: 1.2,
    recoilHorizontalMax: 0.4,
    recoilRecoveryRate: 8,
    range: FIREARM_HITSCAN_RANGE,
    falloffStart: 30,
    falloffEnd: 70,
    falloffMinDamage: 0.5,
    moveSpeedMultiplier: 0.95,
    adsZoomFov: 65,
    fireMode: 'auto',
    pelletsPerShot: 1,
  },
  smg: {
    name: 'Ice Spray',
    slot: 'primary',
    damage: 16,
    headshotMultiplier: 1.8,
    fireRateMs: 65,
    magazineSize: 35,
    reserveAmmo: 140,
    reloadMs: 1600,
    spread: 0.04,
    adsSpread: 0,
    recoilVertical: 0.8,
    recoilHorizontalMax: 0.6,
    recoilRecoveryRate: 12,
    range: FIREARM_HITSCAN_RANGE,
    falloffStart: 15,
    falloffEnd: 35,
    falloffMinDamage: 0.4,
    moveSpeedMultiplier: 1.0,
    adsZoomFov: 72,
    fireMode: 'auto',
    pelletsPerShot: 1,
  },
  shotgun: {
    name: 'Glacier Pump',
    slot: 'primary',
    damage: 12, // per pellet
    headshotMultiplier: 1.5,
    fireRateMs: 800,
    magazineSize: 6,
    reserveAmmo: 24,
    reloadMs: 2800,
    spread: 0.08,
    adsSpread: 0.05,
    recoilVertical: 4.0,
    recoilHorizontalMax: 1.5,
    recoilRecoveryRate: 5,
    range: FIREARM_HITSCAN_RANGE,
    falloffStart: 5,
    falloffEnd: 14,
    falloffMinDamage: 0.2,
    moveSpeedMultiplier: 0.9,
    adsZoomFov: 70,
    fireMode: 'pump',
    pelletsPerShot: 8,
  },
  sniper: {
    name: 'Icicle',
    slot: 'primary',
    damage: 75,
    headshotMultiplier: 2.0,
    fireRateMs: 1200,
    magazineSize: 5,
    reserveAmmo: 20,
    reloadMs: 3000,
    spread: 0.06,
    adsSpread: 0,
    recoilVertical: 6.0,
    recoilHorizontalMax: 1.0,
    recoilRecoveryRate: 3,
    range: FIREARM_HITSCAN_RANGE,
    falloffStart: 80,
    falloffEnd: 120,
    falloffMinDamage: 0.8,
    moveSpeedMultiplier: 0.85,
    adsZoomFov: 30,
    fireMode: 'semi',
    pelletsPerShot: 1,
  },
  pistol: {
    name: 'Snowmelt',
    slot: 'secondary',
    damage: 25,
    headshotMultiplier: 2.0,
    fireRateMs: 180,
    magazineSize: 12,
    reserveAmmo: 48,
    reloadMs: 1400,
    spread: 0.02,
    adsSpread: 0,
    recoilVertical: 2.0,
    recoilHorizontalMax: 0.5,
    recoilRecoveryRate: 10,
    range: FIREARM_HITSCAN_RANGE,
    falloffStart: 20,
    falloffEnd: 45,
    falloffMinDamage: 0.5,
    moveSpeedMultiplier: 1.0,
    adsZoomFov: 68,
    fireMode: 'semi',
    pelletsPerShot: 1,
  },
  'ice-pick': {
    name: 'Ice Pick',
    slot: 'melee',
    damage: 55,
    headshotMultiplier: 1.0,
    fireRateMs: 500,
    magazineSize: 1,
    reserveAmmo: 0,
    reloadMs: 0,
    spread: 0,
    adsSpread: 0,
    recoilVertical: 0,
    recoilHorizontalMax: 0,
    recoilRecoveryRate: 0,
    range: 2.5,
    falloffStart: 2.5,
    falloffEnd: 2.5,
    falloffMinDamage: 1.0,
    moveSpeedMultiplier: 1.1,
    adsZoomFov: 90,
    fireMode: 'semi',
    pelletsPerShot: 1,
  },
} as const;

/** Default loadout for new players. */
export const DEFAULT_LOADOUT: [WeaponId, WeaponId, WeaponId] = [
  'assault-rifle',
  'pistol',
  'ice-pick',
];
