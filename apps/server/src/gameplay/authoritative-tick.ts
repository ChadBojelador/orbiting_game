import type { GameplayController } from './gameplay-controller.js';
import type { MatchController } from './match-controller.js';

/**
 * Apply fixed gameplay steps before resolving phase deadlines at the same
 * timestamp. GameplayController rejects the step exactly at the deadline, but
 * this ordering preserves any queued step whose fixed timestamp is earlier.
 */
export function advanceAuthoritativeTick(
  now: number,
  gameplay: GameplayController,
  match: MatchController,
): boolean {
  gameplay.advance(now);
  return match.tick(now);
}
