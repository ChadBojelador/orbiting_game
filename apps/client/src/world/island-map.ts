import islandModelUrl from './generated/island-fort.glb?url';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, type Scene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeModel } from './model-disposal.js';

export class IslandMap {
  readonly group = new Group();
  readonly ready: Promise<void>;
  hasError = false;
  isReady = false;
  private destroyed = false;

  constructor(scene: Scene) {
    // Sea is an explicit shallow walkable surface in the shared collision world.
    const sea = new Mesh(new BoxGeometry(120, 0.3, 120), new MeshStandardMaterial({ color: 0x48b3c4, roughness: 0.35 }));
    sea.position.y = -0.15; this.group.add(sea);
    const boundaryMaterial = new MeshStandardMaterial({ color: 0xe0cf94 });
    for (const side of [-1, 1]) {
      const north = new Mesh(new BoxGeometry(120, 0.25, 0.25), boundaryMaterial); north.position.set(0, 0.1, side * 60);
      const east = new Mesh(new BoxGeometry(0.25, 0.25, 120), boundaryMaterial); east.position.set(side * 60, 0.1, 0);
      this.group.add(north, east);
    }
    scene.add(this.group);
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      const model = (await new GLTFLoader().loadAsync(islandModelUrl)).scene;
      if (this.destroyed) { disposeModel(model); return; }
      model.name = 'island-fort';
      this.group.add(model);this.isReady=true;
    } catch { this.hasError = true; }
  }

  destroy(): void {
    this.destroyed = true; disposeModel(this.group); this.group.removeFromParent();
  }
}
