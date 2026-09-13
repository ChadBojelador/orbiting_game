// Arena FPS gameplay constants — all distances in metres, times in milliseconds.
export const GAMEPLAY = {
  // ── Tick ──
  tickMs: 50,
  tickRate: 20, // 1000 / tickMs

  // ── Movement ──
  moveSpeed: 12,
  sprintMultiplier: 1.3,
  crouchMultiplier: 0.5,
  airControlFactor: 0.35,
  playerRadius: 0.4,
  playerHeight: 1.8,
  playerEyeHeight: 1.6,
  crouchHeight: 1.1,
  crouchEyeHeight: 0.9,

  // ── Jumping ──
  jumpSpeed: 7.5,
  gravity: 20,
  /** Repeated jumps within this window lose effectiveness. */
  bunnyHopWindowMs: 250,
  bunnyHopPenalty: 0.82,

  // ── Sliding ──
  slideSpeed: 16,
  slideDurationMs: 500,
  slideCooldownMs: 800,
  slideMinSpeedThreshold: 4,
  slideHeightMultiplier: 0.6,
  slideEyeHeight: 0.7,
  slideFriction: 0.92,
  slideIceBonus: 1.15,
  slideDownhillBonus: 1.1,

  // ── Surface friction ──
  groundFriction: 0.88,
  iceFriction: 0.97,
  waterSpeedPenalty: 0.7,

  // ── Health ──
  maxHp: 100,
  respawnDelayMs: 2500,
  spawnProtectionMs: 1500,

  // ── Network ──
  interpolationMs: 100,
  inputExpiryMs: 250,
  maxInputQueue: 5,

  // ── Match timing ──
  countdownMs: 3000,
  ffaTimeLimitMs: 300_000, // 5 minutes
  ffaScoreLimit: 30,
  tdmTimeLimitMs: 300_000,
  tdmScoreLimit: 50,
  duelTimeLimitMs: 180_000, // 3 minutes
  duelScoreLimit: 10,
  intermissionMs: 8_000,
  warmupMs: 10_000,

  // ── Damage ──
  headshotMultiplier: 2.0,
  headHitboxRatio: 0.25, // top 25% of player height

  // ── Interaction ──
  interactionHeight: 0.9,
} as const;
