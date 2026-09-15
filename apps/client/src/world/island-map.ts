import islandModelUrl from './generated/island-fort.glb?url';
import {
  ISLAND_COVER,
  ISLAND_FORT_SCALE,
  ISLAND_FORT_Y,
  ISLAND_HALF_EXTENT,
  ISLAND_SURFACES,
  type IslandCover,
  type IslandSurface,
} from '@ice-water/shared';
import {
  Group,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  InstancedMesh,
  LOD,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  type Scene,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeModel } from './model-disposal.js';

export class IslandMap {
  readonly group = new Group();
  readonly ready: Promise<void>;
  hasError = false;
  isReady = false;
  private destroyed = false;

  constructor(scene: Scene) {
    // The shared authoritative simulation treats this Y=0 plane as buoyant water.
    const sea = new Mesh(
      new BoxGeometry(ISLAND_HALF_EXTENT * 2, 0.3, ISLAND_HALF_EXTENT * 2),
      new MeshStandardMaterial({ color: 0x48b3c4, roughness: 0.28, metalness: 0.08 }),
    );
    sea.position.y = -0.15;
    this.group.add(sea);
    const boundaryMaterial = new MeshStandardMaterial({ color: 0xe0cf94 });
    for (const side of [-1, 1]) {
      const north = new Mesh(new BoxGeometry(ISLAND_HALF_EXTENT * 2, 0.25, 0.25), boundaryMaterial);
      north.position.set(0, 0.1, side * ISLAND_HALF_EXTENT);
      const east = new Mesh(new BoxGeometry(0.25, 0.25, ISLAND_HALF_EXTENT * 2), boundaryMaterial);
      east.position.set(side * ISLAND_HALF_EXTENT, 0.1, 0);
      this.group.add(north, east);
    }
    this.buildArchipelago();
    scene.add(this.group);
    this.ready = this.load();
  }

  private buildArchipelago(): void {
    const surfaceMaterials: Record<IslandSurface['surface'], MeshStandardMaterial> = {
      snow: new MeshStandardMaterial({ color: 0xedf6fa, roughness: 0.88 }),
      ice: new MeshStandardMaterial({
        color: 0x74d9ec,
        roughness: 0.18,
        metalness: 0.18,
        transparent: true,
        opacity: 0.88,
      }),
      dock: new MeshStandardMaterial({ color: 0x395269, roughness: 0.72 }),
    };
    for (const region of new Set(ISLAND_SURFACES.map((block) => block.region))) {
      for (const kind of Object.keys(surfaceMaterials) as IslandSurface['surface'][]) {
        const blocks = ISLAND_SURFACES.filter(
          (block) => block.region === region && block.surface === kind,
        );
        if (blocks.length)
          this.group.add(
            this.instances(blocks, surfaceMaterials[kind], `frost-island-${region}-${kind}`),
          );
      }
    }

    const coverMaterials: Record<IslandCover['kind'], MeshStandardMaterial> = {
      core: new MeshStandardMaterial({
        color: 0x18334b,
        emissive: 0x1c8298,
        emissiveIntensity: 0.45,
        metalness: 0.62,
        roughness: 0.28,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
      facility: new MeshStandardMaterial({ color: 0x263f55, roughness: 0.68 }),
      container: new MeshStandardMaterial({ color: 0x308cad, roughness: 0.58 }),
      barrier: new MeshStandardMaterial({ color: 0x8fb1bd, roughness: 0.82 }),
      ridge: new MeshStandardMaterial({ color: 0xbfeaf2, roughness: 0.38 }),
      machinery: new MeshStandardMaterial({ color: 0x637887, roughness: 0.56, metalness: 0.4 }),
      dock: new MeshStandardMaterial({ color: 0x593f35, roughness: 0.78 }),
    };
    for (const region of [
      'central',
      'north',
      'west',
      'east',
      'south',
      'southwest',
      'southeast',
    ] as const) {
      const regionGroup = new Group();
      regionGroup.name = `frost-island-${region}`;
      for (const kind of Object.keys(coverMaterials) as IslandCover['kind'][]) {
        const blocks = ISLAND_COVER.filter(
          (block) =>
            block.kind === kind &&
            (block.id === 'cryo-core' ? region === 'central' : block.id.startsWith(region + '-')),
        );
        if (blocks.length)
          regionGroup.add(
            this.instances(blocks, coverMaterials[kind], `frost-island-${region}-${kind}`),
          );
      }
      this.group.add(regionGroup);
    }

    const core = ISLAND_COVER.find((block) => block.id === 'cryo-core')!;
    const coreLod = new LOD(),
      nearCore = new Group();
    coreLod.name = 'cryo-core-detail-lod';
    coreLod.position.set(core.x, core.y, core.z);
    const chamber = new Mesh(
      new CylinderGeometry(2.1, 2.55, 4.4, 12),
      new MeshStandardMaterial({
        color: 0x74d9ec,
        emissive: 0x47d7e9,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.78,
        roughness: 0.18,
      }),
    );
    chamber.position.y = 2.2;
    const coreRingMaterial = new MeshStandardMaterial({
      color: 0xf3b747,
      emissive: 0x9d6114,
      emissiveIntensity: 0.4,
      metalness: 0.55,
      roughness: 0.32,
    });
    for (const y of [1.2, 3.1, 4.7]) {
      const ring = new Mesh(new TorusGeometry(2.5, 0.13, 6, 20), coreRingMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      nearCore.add(ring);
    }
    nearCore.add(chamber);
    const distantCore = new Mesh(
      new CylinderGeometry(2.4, 2.7, 4.6, 6),
      new MeshStandardMaterial({
        color: 0x47d7e9,
        emissive: 0x47d7e9,
        emissiveIntensity: 0.4,
        roughness: 0.45,
      }),
    );
    distantCore.position.y = 2.3;
    coreLod.addLevel(nearCore, 0);
    coreLod.addLevel(distantCore, 70);
    this.group.add(coreLod);
  }

  private instances(
    blocks: readonly (IslandSurface | IslandCover)[],
    material: MeshStandardMaterial,
    name: string,
  ): InstancedMesh {
    const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, blocks.length),
      transform = new Object3D();
    mesh.name = name;
    blocks.forEach((block, index) => {
      transform.position.set(block.x, block.y + block.height / 2, block.z);
      transform.scale.set(block.width, block.height, block.depth);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  private async load(): Promise<void> {
    try {
      const model = (await new GLTFLoader().loadAsync(islandModelUrl)).scene;
      if (this.destroyed) {
        disposeModel(model);
        return;
      }
      model.name = 'island-fort';
      model.scale.setScalar(ISLAND_FORT_SCALE);
      model.position.y = ISLAND_FORT_Y;
      this.group.add(model);
      this.isReady = true;
    } catch {
      this.hasError = true;
    }
  }

  destroy(): void {
    this.destroyed = true;
    disposeModel(this.group);
    this.group.removeFromParent();
  }
}
