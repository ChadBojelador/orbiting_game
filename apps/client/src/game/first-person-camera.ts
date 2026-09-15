import { GAMEPLAY, eyeHeight, type SpatialPosition } from '@ice-water/shared';
export function clampPitch(pitch: number): number {
  return Math.max((-Math.PI * 89) / 180, Math.min((Math.PI * 89) / 180, pitch));
}
export class FirstPersonCamera {
  private height: number = GAMEPLAY.playerEyeHeight;
  private dip = 0;
  private wasGrounded = true;
  update(
    position: SpatialPosition,
    stance: { isSliding: boolean; isCrouching: boolean; isGrounded: boolean },
    seconds: number,
    reducedEffects = false,
  ): SpatialPosition {
    if (!this.wasGrounded && stance.isGrounded && !reducedEffects) this.dip = 0.12;
    this.wasGrounded = stance.isGrounded;
    this.height += (eyeHeight(stance) - this.height) * (1 - Math.exp(-18 * seconds));
    this.dip *= Math.exp(-12 * seconds);
    return { x: position.x, y: position.y + this.height - this.dip, z: position.z };
  }
}
