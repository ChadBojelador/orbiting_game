import { DirectionalLight, Group, HemisphereLight, Vector3 } from 'three';

export type OriginalWorldQuality = 'low' | 'medium' | 'high';

/** One bounded shadow pass; local emissive accents never add shadow passes. */
export class OriginalWorldLighting {
  readonly group = new Group();
  readonly moon = new DirectionalLight(0xb8c9ff, 2.05);
  private quality?: OriginalWorldQuality;
  private readonly offset = new Vector3(-70, 100, -50);

  constructor() {
    this.group.name = 'ORIGINAL_NIGHT_LIGHTING';
    this.moon.name = 'moonlight';
    this.moon.position.copy(this.offset);
    this.moon.shadow.camera.left = -48;
    this.moon.shadow.camera.right = 48;
    this.moon.shadow.camera.top = 48;
    this.moon.shadow.camera.bottom = -48;
    // Includes the elevated northern casters when the player is in the village.
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 250;
    this.moon.shadow.bias = -0.00015;
    this.moon.shadow.normalBias = 0.12;
    this.group.add(this.moon, this.moon.target, new HemisphereLight(0x718cc4, 0x172019, 0.72));
  }

  update(position: Vector3, quality: OriginalWorldQuality): void {
    if (quality !== this.quality) {
      this.quality = quality;
      this.moon.castShadow = quality !== 'low';
      const size = quality === 'high' ? 2048 : 1024;
      this.moon.shadow.mapSize.set(size, size);
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null;
      this.moon.shadow.needsUpdate = true;
    }
    // Snap in light-space to keep shadow texels stable while walking.
    const direction = this.offset.clone().normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
    const up = new Vector3().crossVectors(direction, right);
    const texel = 96 / this.moon.shadow.mapSize.x;
    const target = this.moon.target.position;
    target.copy(position);
    target.addScaledVector(right, Math.round(position.dot(right) / texel) * texel - position.dot(right));
    target.addScaledVector(up, Math.round(position.dot(up) / texel) * texel - position.dot(up));
    this.moon.position.copy(target).add(this.offset);
    this.moon.target.updateMatrixWorld();
  }

  destroy(): void {
    this.moon.dispose();
    this.group.removeFromParent();
  }
}
