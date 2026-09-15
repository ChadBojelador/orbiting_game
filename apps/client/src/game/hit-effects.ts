import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  type Scene,
} from 'three';
import type { SpatialPosition } from '@ice-water/shared';
export class HitEffects {
  private effects: { line: Line; until: number }[] = [];
  private impacts: { mesh: Mesh; until: number; dx: number; dy: number; dz: number }[] = [];
  private readonly chip = new BoxGeometry(0.04, 0.04, 0.04);
  private readonly chipMaterial = new MeshBasicMaterial({ color: 0xffde92 });
  constructor(private readonly scene: Scene) {}
  shot(origin: SpatialPosition, end: SpatialPosition, now: number): void {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([origin.x, origin.y, origin.z, end.x, end.y, end.z], 3),
    );
    const line = new Line(
      geometry,
      new LineBasicMaterial({ color: 0xffde92, transparent: true, opacity: 0.65 }),
    );
    this.scene.add(line);
    this.effects.push({ line, until: now + 70 });
    if (this.effects.length > 48) this.remove(0);
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(this.chip, this.chipMaterial);
      mesh.position.set(end.x, end.y, end.z);
      this.scene.add(mesh);
      this.impacts.push({
        mesh,
        until: now + 220,
        dx: (Math.random() - 0.5) * 0.05,
        dy: Math.random() * 0.04,
        dz: (Math.random() - 0.5) * 0.05,
      });
    }
    while (this.impacts.length > 144) this.impacts.shift()!.mesh.removeFromParent();
  }
  update(now: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--)
      if (now >= this.effects[i]!.until) this.remove(i);
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const p = this.impacts[i]!;
      if (now >= p.until) {
        p.mesh.removeFromParent();
        this.impacts.splice(i, 1);
      } else {
        p.mesh.position.x += p.dx;
        p.mesh.position.y += p.dy;
        p.mesh.position.z += p.dz;
        p.dy -= 0.004;
      }
    }
  }
  destroy(): void {
    while (this.effects.length) this.remove(0);
    this.impacts.forEach((p) => p.mesh.removeFromParent());
    this.chip.dispose();
    this.chipMaterial.dispose();
  }
  private remove(i: number): void {
    const effect = this.effects.splice(i, 1)[0]!;
    effect.line.geometry.dispose();
    (effect.line.material as LineBasicMaterial).dispose();
    effect.line.removeFromParent();
  }
}
