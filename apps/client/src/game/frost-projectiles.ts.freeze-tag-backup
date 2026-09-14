import { GAMEPLAY, type FrostProjectileView } from '@ice-water/shared';
import * as THREE from 'three';

const FORWARD = new THREE.Vector3(0, 0, 1);

export class FrostProjectileRenderer {
  private readonly coreGeometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly coreMaterial = new THREE.MeshStandardMaterial({
    color: 0xbdf6ff,
    emissive: 0x35d9ff,
    emissiveIntensity: 1.8,
    roughness: 0.18,
  });
  private readonly haloGeometry = new THREE.SphereGeometry(1, 8, 6);
  private readonly haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x72e8ff,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  private readonly cores = new THREE.InstancedMesh(
    this.coreGeometry,
    this.coreMaterial,
    GAMEPLAY.maxFrostProjectiles,
  );
  private readonly halos = new THREE.InstancedMesh(
    this.haloGeometry,
    this.haloMaterial,
    GAMEPLAY.maxFrostProjectiles,
  );
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly coreScale = new THREE.Vector3(0.24, 0.24, 0.58);
  private readonly haloScale = new THREE.Vector3(0.42, 0.42, 0.72);

  constructor(private readonly scene: THREE.Scene) {
    this.cores.name = 'frost-projectile-cores';
    this.halos.name = 'frost-projectile-halos';
    this.cores.castShadow = false;
    this.cores.frustumCulled = false;
    this.halos.frustumCulled = false;
    this.scene.add(this.halos, this.cores);
  }

  update(projectiles: readonly FrostProjectileView[], serverNow: number, stateTime: number): void {
    const count = Math.min(projectiles.length, GAMEPLAY.maxFrostProjectiles);
    const seconds = Math.max(0, Math.min(GAMEPLAY.tickMs * 2, serverNow - stateTime)) / 1000;
    for (let index = 0; index < count; index++) {
      const projectile = projectiles[index]!;
      this.position.set(
        projectile.x + projectile.velocityX * seconds,
        projectile.y + projectile.velocityY * seconds,
        projectile.z + projectile.velocityZ * seconds,
      );
      this.direction
        .set(projectile.velocityX, projectile.velocityY, projectile.velocityZ)
        .normalize();
      this.rotation.setFromUnitVectors(FORWARD, this.direction);
      this.matrix.compose(this.position, this.rotation, this.coreScale);
      this.cores.setMatrixAt(index, this.matrix);
      this.matrix.compose(this.position, this.rotation, this.haloScale);
      this.halos.setMatrixAt(index, this.matrix);
    }
    this.cores.count = count;
    this.halos.count = count;
    this.cores.instanceMatrix.needsUpdate = true;
    this.halos.instanceMatrix.needsUpdate = true;
  }

  destroy(): void {
    this.scene.remove(this.cores, this.halos);
    this.coreGeometry.dispose();
    this.coreMaterial.dispose();
    this.haloGeometry.dispose();
    this.haloMaterial.dispose();
  }
}
