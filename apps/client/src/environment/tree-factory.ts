import type * as PC from 'playcanvas';
import { createFacetedMesh, createMeshEntity, type Point3, type Triangle } from './faceted-mesh.js';
import type { EnvironmentMaterials } from './materials.js';

export type TreeVariant = 0 | 1 | 2 | 3;

export interface TreeOptions {
  readonly variant?: TreeVariant;
  readonly scale?: number;
}

interface CanopySpec {
  readonly position: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
  readonly material: 'leafA' | 'leafB' | 'leafC';
}

const CANOPIES: readonly (readonly CanopySpec[])[] = [
  [
    { position: [-0.22, 2.45, 0.02], scale: [1.05, 0.9, 0.95], material: 'leafB' },
    { position: [0.38, 2.72, -0.08], scale: [0.82, 0.78, 0.78], material: 'leafA' },
    { position: [0.12, 3.18, 0.1], scale: [0.68, 0.74, 0.66], material: 'leafC' },
  ],
  [
    { position: [-0.42, 2.2, 0.05], scale: [1.12, 0.72, 0.84], material: 'leafA' },
    { position: [0.48, 2.25, -0.08], scale: [1.05, 0.78, 0.88], material: 'leafB' },
    { position: [0.02, 2.76, 0.12], scale: [1.18, 0.75, 0.92], material: 'leafC' },
  ],
  [
    { position: [0.02, 2.0, 0], scale: [0.95, 0.82, 0.88], material: 'leafC' },
    { position: [-0.2, 2.7, 0.04], scale: [0.78, 0.78, 0.76], material: 'leafB' },
    { position: [0.22, 3.35, -0.04], scale: [0.58, 0.68, 0.58], material: 'leafA' },
  ],
  [
    { position: [-0.34, 2.35, 0.02], scale: [0.82, 0.95, 0.82], material: 'leafA' },
    { position: [0.42, 2.45, -0.12], scale: [0.88, 0.82, 0.8], material: 'leafC' },
    { position: [0, 3.05, 0.1], scale: [0.95, 0.86, 0.88], material: 'leafB' },
  ],
];

function createCanopyGeometry(variant: number): {
  readonly points: readonly Point3[];
  readonly faces: readonly Triangle[];
} {
  const segments = 6;
  const skew = variant * 0.025;
  const points: Point3[] = [[skew, 1, -skew]];
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2;
    const radius = 0.94 + ((index + variant) % 2) * 0.1;
    points.push([Math.cos(angle) * radius + skew, 0.28, Math.sin(angle) * radius]);
  }
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2;
    const radius = 0.75 + ((index + variant) % 3) * 0.045;
    points.push([Math.cos(angle) * radius - skew, -0.46, Math.sin(angle) * radius]);
  }
  points.push([-skew, -0.82, skew]);

  const faces: Triangle[] = [];
  const bottom = points.length - 1;
  for (let index = 0; index < segments; index++) {
    const next = (index + 1) % segments;
    const upper = 1 + index;
    const nextUpper = 1 + next;
    const lower = 1 + segments + index;
    const nextLower = 1 + segments + next;
    faces.push(
      [0, nextUpper, upper],
      [upper, nextUpper, lower],
      [nextUpper, nextLower, lower],
      [bottom, lower, nextLower],
    );
  }
  return { points, faces };
}

export class TreeFactory {
  private readonly canopyMeshes: PC.Mesh[];

  constructor(
    private readonly app: PC.Application,
    private readonly pc: typeof PC,
    private readonly materials: EnvironmentMaterials,
  ) {
    this.canopyMeshes = [0, 1, 2, 3].map((variant) => {
      const geometry = createCanopyGeometry(variant);
      return createFacetedMesh(app, pc, geometry.points, geometry.faces);
    });
  }

  createTree({ variant = 0, scale = 1 }: TreeOptions = {}): PC.Entity {
    const root = new this.pc.Entity(`tree-${variant}`);
    root.setLocalScale(scale, scale, scale);

    const lowerTrunk = this.createTrunk('trunk-lower', [0, 0.8, 0], [0.34, 1.6, 0.34], 0);
    const upperTrunk = this.createTrunk(
      'trunk-upper',
      [variant % 2 === 0 ? 0.13 : -0.13, 1.72, 0],
      [0.25, 1.15, 0.25],
      variant % 2 === 0 ? -8 : 8,
    );
    root.addChild(lowerTrunk);
    root.addChild(upperTrunk);

    const canopySpecs = CANOPIES[variant]!;
    for (let index = 0; index < canopySpecs.length; index++) {
      const spec = canopySpecs[index]!;
      const canopy = createMeshEntity(
        this.pc,
        `canopy-${index}`,
        this.canopyMeshes[(variant + index) % this.canopyMeshes.length]!,
        this.materials[spec.material],
      );
      canopy.setLocalPosition(...spec.position);
      canopy.setLocalScale(...spec.scale);
      canopy.setLocalEulerAngles(0, variant * 31 + index * 47, index % 2 === 0 ? -4 : 5);
      root.addChild(canopy);
    }
    return root;
  }

  destroy(): void {
    for (const mesh of this.canopyMeshes) mesh.destroy();
  }

  private createTrunk(
    name: string,
    position: readonly [number, number, number],
    scale: readonly [number, number, number],
    zTilt: number,
  ): PC.Entity {
    const trunk = new this.pc.Entity(name);
    trunk.addComponent('render', { type: 'cylinder', material: this.materials.bark });
    trunk.setLocalPosition(...position);
    trunk.setLocalScale(...scale);
    trunk.setLocalEulerAngles(0, 0, zTilt);
    return trunk;
  }
}
