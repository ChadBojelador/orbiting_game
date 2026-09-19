import {
  AdditiveBlending,
  CylinderGeometry,
  Mesh,
  BoxGeometry,
  MeshBasicMaterial,
  Vector3,
  type Scene,
} from 'three';
import type { SpatialPosition } from '@ice-water/shared';
export class HitEffects {
  private effects: { core: Mesh; halo: Mesh; until: number }[] = [];
  private impacts: { mesh: Mesh; until: number; dx: number; dy: number; dz: number }[] = [];
  private readonly tracer = new CylinderGeometry(1, 1, 1, 6, 1, true);
  private readonly tracerCore = new MeshBasicMaterial({
    color: 0xedf6fa,
    transparent: true,
    opacity: 0.95,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly tracerHalo = new MeshBasicMaterial({
    color: 0x74d9ec,
    transparent: true,
    opacity: 0.34,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly chip = new BoxGeometry(0.04, 0.04, 0.04);
  private readonly chipMaterial = new MeshBasicMaterial({ color: 0xffe7a8, toneMapped: false });
  constructor(private readonly scene: Scene) {}
  shot(origin: SpatialPosition, end: SpatialPosition, now: number): void {
    const start = new Vector3(origin.x, origin.y, origin.z);
    const finish = new Vector3(end.x, end.y, end.z);
    const direction = finish.clone().sub(start);
    const fullLength = direction.length();
    if (fullLength <= 0.001) return;
    direction.normalize();
    start.addScaledVector(direction, Math.min(0.45, fullLength * 0.15));
    const length = finish.distanceTo(start);
    const midpoint = start.clone().add(finish).multiplyScalar(0.5);
    const core = this.tracerMesh(midpoint, direction, length, 0.018, this.tracerCore);
    const halo = this.tracerMesh(midpoint, direction, length, 0.055, this.tracerHalo);
    this.scene.add(halo, core);
    this.effects.push({ core, halo, until: now + 140 });
    if (this.effects.length > 48) this.remove(0);
    for (let i = 0; i < 5; i++) {
      const mesh = new Mesh(this.chip, this.chipMaterial);
      mesh.position.set(end.x, end.y, end.z);
      this.scene.add(mesh);
      this.impacts.push({
        mesh,
        until: now + 260,
        dx: (Math.random() - 0.5) * 0.065,
        dy: Math.random() * 0.052,
        dz: (Math.random() - 0.5) * 0.065,
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
    this.tracer.dispose();
    this.tracerCore.dispose();
    this.tracerHalo.dispose();
    this.chip.dispose();
    this.chipMaterial.dispose();
  }
  private tracerMesh(
    midpoint: Vector3,
    direction: Vector3,
    length: number,
    radius: number,
    material: MeshBasicMaterial,
  ): Mesh {
    const mesh = new Mesh(this.tracer, material);
    mesh.position.copy(midpoint);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
    mesh.scale.set(radius, length, radius);
    mesh.renderOrder = 2;
    return mesh;
  }
  private remove(i: number): void {
    const effect = this.effects.splice(i, 1)[0]!;
    effect.core.removeFromParent();
    effect.halo.removeFromParent();
  }
}
