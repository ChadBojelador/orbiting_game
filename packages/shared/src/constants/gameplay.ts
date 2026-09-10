// Initial playtest values, recorded in ARCHITECTURE.md; all distances are metres.
export const GAMEPLAY = {
  tickMs: 50,
  moveSpeed: 6,
  playerRadius: 0.45,
  tagRange: 1.8,
  tagCooldownMs: 600,
  rescueRange: 2.4,
  rescueMs: 1500,
  protectionMs: 2000,
  rescueLeaseMs: 350,
  helpCooldownMs: 5000,
  helpDurationMs: 2500,
  inputExpiryMs: 250,
  maxInputQueue: 5,
  interpolationMs: 100,
} as const;
