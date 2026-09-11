import type * as PC from 'playcanvas';
import { createFacetedMesh, createMeshEntity, OCTAHEDRON_FACES } from './faceted-mesh.js';
import type { EnvironmentMaterials } from './materials.js';

export type FlowerColor = 'coral' | 'cream' | 'lavender';

const BLOB_POINTS = [
  [0, 1, 0],
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, 0, -1],
] as const;

export class PlantFactory {
  private readonly blobMesh: PC.Mesh;

  constructor(
    private readonly pc: typeof PC,
    app: PC.Application,
    private readonly materials: EnvironmentMaterials,
  ) {
    this.blobMesh = createFacetedMesh(app, pc, BLOB_POINTS, OCTAHEDRON_FACES);
  }

  createBush(scale = 1): PC.Entity {
    const root = new this.pc.Entity('bush');
    const specs: readonly [
      number,
      number,
      number,
      number,
      keyof Pick<EnvironmentMaterials, 'leafA' | 'leafB' | 'leafC'>,
    ][] = [
      [-0.24, 0.3, 0, 0.52, 'leafA'],
      [0.24, 0.28, 0.04, 0.48, 'leafB'],
      [0, 0.5, -0.05, 0.46, 'leafC'],
    ];
    for (let index = 0; index < specs.length; index++) {
      const [x, y, z, size, material] = specs[index]!;
      const leaf = createMeshEntity(
        this.pc,
        `bush-leaf-${index}`,
        this.blobMesh,
        this.materials[material],
      );
      leaf.setLocalPosition(x * scale, y * scale, z * scale);
      leaf.setLocalScale(size * scale, size * 0.78 * scale, size * scale);
      leaf.setLocalEulerAngles(0, index * 43, index % 2 === 0 ? 4 : -4);
      root.addChild(leaf);
    }
    return root;
  }

  createFlower(color: FlowerColor = 'coral', scale = 1): PC.Entity {
    const root = new this.pc.Entity(`flower-${color}`);
    const stem = new this.pc.Entity('stem');
    stem.addComponent('render', { type: 'cylinder', material: this.materials.stem });
    stem.setLocalPosition(0, 0.24 * scale, 0);
    stem.setLocalScale(0.05 * scale, 0.48 * scale, 0.05 * scale);
    root.addChild(stem);

    const material =
      color === 'coral'
        ? this.materials.flowerCoral
        : color === 'cream'
          ? this.materials.flowerCream
          : this.materials.flowerLavender;
    for (let index = 0; index < 5; index++) {
      const angle = (index / 5) * Math.PI * 2;
      const petal = createMeshEntity(this.pc, `petal-${index}`, this.blobMesh, material);
      petal.setLocalPosition(
        Math.cos(angle) * 0.18 * scale,
        0.54 * scale,
        Math.sin(angle) * 0.18 * scale,
      );
      petal.setLocalScale(0.17 * scale, 0.11 * scale, 0.22 * scale);
      petal.setLocalEulerAngles(0, (-angle * 180) / Math.PI, 0);
      root.addChild(petal);
    }
    return root;
  }

  createMushroom(scale = 1): PC.Entity {
    const root = new this.pc.Entity('mushroom');
    const stem = new this.pc.Entity('mushroom-stem');
    stem.addComponent('render', { type: 'cylinder', material: this.materials.cliff });
    stem.setLocalPosition(0, 0.16 * scale, 0);
    stem.setLocalScale(0.12 * scale, 0.32 * scale, 0.12 * scale);
    root.addChild(stem);
    const cap = createMeshEntity(
      this.pc,
      'mushroom-cap',
      this.blobMesh,
      this.materials.mushroomCap,
    );
    cap.setLocalPosition(0, 0.37 * scale, 0);
    cap.setLocalScale(0.3 * scale, 0.13 * scale, 0.3 * scale);
    root.addChild(cap);
    return root;
  }

  destroy(): void {
    this.blobMesh.destroy();
  }
}
