import type * as PC from 'playcanvas';
import { createFacetedMesh, createMeshEntity } from './faceted-mesh.js';
import type { EnvironmentMaterials } from './materials.js';

export type CrystalSize = 'small' | 'medium' | 'large';

export interface CrystalOptions {
  readonly size?: CrystalSize;
  readonly scale?: number;
}

const CRYSTAL_POINTS = [
  [0, 1, 0],
  [0.48, 0.28, 0],
  [0.24, 0.22, 0.42],
  [-0.24, 0.26, 0.42],
  [-0.48, 0.2, 0],
  [-0.24, 0.24, -0.42],
  [0.24, 0.18, -0.42],
  [0, -0.08, 0],
] as const;

const CRYSTAL_FACES = [
  [0, 2, 1],
  [0, 3, 2],
  [0, 4, 3],
  [0, 5, 4],
  [0, 6, 5],
  [0, 1, 6],
  [7, 1, 2],
  [7, 2, 3],
  [7, 3, 4],
  [7, 4, 5],
  [7, 5, 6],
  [7, 6, 1],
] as const;

const SIZE_SCALE: Readonly<Record<CrystalSize, readonly [number, number, number]>> = {
  small: [0.45, 0.8, 0.45],
  medium: [0.68, 1.35, 0.68],
  large: [0.92, 2.25, 0.92],
};

export class CrystalFactory {
  private readonly mesh: PC.Mesh;

  constructor(
    private readonly pc: typeof PC,
    app: PC.Application,
    private readonly materials: EnvironmentMaterials,
  ) {
    this.mesh = createFacetedMesh(app, pc, CRYSTAL_POINTS, CRYSTAL_FACES);
  }

  createCrystal({ size = 'medium', scale = 1 }: CrystalOptions = {}): PC.Entity {
    const crystal = createMeshEntity(this.pc, `crystal-${size}`, this.mesh, this.materials.crystal);
    const sizeScale = SIZE_SCALE[size];
    crystal.setLocalScale(sizeScale[0] * scale, sizeScale[1] * scale, sizeScale[2] * scale);
    return crystal;
  }

  createCluster(scale = 1): PC.Entity {
    const root = new this.pc.Entity('crystal-cluster');
    const specs: readonly [CrystalSize, number, number, number, number][] = [
      ['large', 0, 0, 0, -4],
      ['medium', -0.58, 0, 0.16, -18],
      ['medium', 0.55, 0, 0.12, 22],
      ['small', -0.3, 0, -0.48, 12],
      ['small', 0.36, 0, -0.42, -25],
    ];
    for (let index = 0; index < specs.length; index++) {
      const [size, x, y, z, tilt] = specs[index]!;
      const crystal = createMeshEntity(
        this.pc,
        `cluster-crystal-${index}`,
        this.mesh,
        index === 0 ? this.materials.crystalHighlight : this.materials.crystal,
      );
      const sizeScale = SIZE_SCALE[size];
      crystal.setLocalPosition(x * scale, y, z * scale);
      crystal.setLocalScale(sizeScale[0] * scale, sizeScale[1] * scale, sizeScale[2] * scale);
      crystal.setLocalEulerAngles(tilt, index * 39, index % 2 === 0 ? 4 : -5);
      root.addChild(crystal);
    }
    return root;
  }

  destroy(): void {
    this.mesh.destroy();
  }
}
