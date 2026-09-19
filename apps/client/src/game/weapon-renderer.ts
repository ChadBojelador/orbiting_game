import { WEAPONS, type SpatialPosition, type WeaponId } from '@ice-water/shared';
import {
  BoxGeometry,
  AdditiveBlending,
  OctahedronGeometry,
  PointLight,
  SphereGeometry,
  Vector3,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  type PerspectiveCamera,
} from 'three';
export class WeaponRenderer {
  private readonly root = new Group();
  private model = new Group();
  private readonly flash = new Group();
  private readonly flashCore = new Mesh(
    new OctahedronGeometry(0.115, 0),
    new MeshBasicMaterial({
      color: 0xfff4cf,
      blending: AdditiveBlending,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  private readonly flashHalo = new Mesh(
    new SphereGeometry(0.17, 8, 5),
    new MeshBasicMaterial({
      color: 0xf3b747,
      blending: AdditiveBlending,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  private readonly flashLight = new PointLight(0xffd27a, 3.5, 1.8, 2);
  private current: WeaponId | undefined;
  private kick = 0;
  private flashUntil = 0;
  private switchAt = 0;
  constructor(camera: PerspectiveCamera) {
    camera.add(this.root);
    this.flashCore.scale.z = 1.75;
    this.flash.add(this.flashHalo, this.flashCore, this.flashLight);
    this.root.add(this.flash);
    this.flash.visible = false;
  }
  fire(now: number): void {
    this.kick = 1;
    this.flashUntil = now + 130;
  }
  muzzleWorldPosition(): SpatialPosition {
    const position = new Vector3();
    this.flash.updateWorldMatrix(true, false);
    this.flash.getWorldPosition(position);
    return { x: position.x, y: position.y, z: position.z };
  }
  update(
    id: WeaponId,
    now: number,
    seconds: number,
    isAds: boolean,
    isReloading: boolean,
    reducedEffects: boolean,
  ): void {
    if (this.current !== id) {
      this.clear();
      this.current = id;
      this.switchAt = now;
      this.build(id);
    }
    this.kick *= Math.exp(-WEAPONS[id].recoilRecoveryRate * seconds);
    const reload = isReloading ? 0.25 + Math.sin(now / 130) * 0.05 : 0;
    const sway = reducedEffects ? 0 : Math.sin(now / 850) * 0.003;
    this.root.position.set(
      isAds ? 0 : 0.26 + sway,
      isAds ? -0.16 : -0.26 - reload,
      -0.42 + this.kick * 0.06,
    );
    this.root.rotation.set(this.kick * 0.09 + reload, 0, isReloading ? -0.5 : 0);
    this.root.position.y -= Math.max(0, 1 - (now - this.switchAt) / 200) * 0.25;
    this.flash.visible = !reducedEffects && now < this.flashUntil && id !== 'ice-pick';
  }
  destroy(): void {
    this.clear();
    this.flashCore.geometry.dispose();
    (this.flashCore.material as MeshBasicMaterial).dispose();
    this.flashHalo.geometry.dispose();
    (this.flashHalo.material as MeshBasicMaterial).dispose();
    this.root.removeFromParent();
  }
  private clear(): void {
    this.model.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as MeshStandardMaterial).dispose();
      }
    });
    this.model.removeFromParent();
    this.model = new Group();
    this.root.add(this.model);
  }
  private build(id: WeaponId): void {
    const length = id === 'sniper' ? 0.65 : id === 'pistol' ? 0.25 : 0.44;
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      color: number,
    ) => {
      const mesh = new Mesh(
        new BoxGeometry(w, h, d),
        new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 }),
      );
      mesh.position.set(x, y, z);
      this.model.add(mesh);
    };
    if (id === 'ice-pick') {
      box(0.055, 0.4, 0.055, 0, 0, -0.15, 0x18334b);
      box(0.3, 0.045, 0.08, 0.06, 0.2, -0.15, 0x74d9ec);
    } else {
      box(0.12, 0.14, length, 0, 0, -length / 2, 0x18334b);
      box(0.125, 0.045, length * 0.7, 0, 0.06, -length / 2, 0xedf6fa);
      box(0.065, 0.2, 0.08, 0, -0.1, -0.08, 0x308cad);
      box(0.045, 0.045, 0.15, 0, 0.01, -length, 0x74d9ec);
      box(0.025, 0.035, 0.04, 0, 0.11, -0.22, 0xf3b747);
      if (id === 'sniper') box(0.07, 0.07, 0.22, 0, 0.14, -0.28, 0x308cad);
    }
    this.flash.position.set(0, 0.015, -length - 0.16);
  }
}
