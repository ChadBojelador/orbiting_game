import type * as PC from 'playcanvas';
import { createFacetedMesh, createMeshEntity, type Point3, type Triangle } from './faceted-mesh.js';
import type { EnvironmentMaterials } from './materials.js';

export type RockVariant = 0 | 1 | 2 | 3;

export interface RockOptions {
  readonly variant?: RockVariant;
  readonly scale?: number;
}

function createRockGeometry(variant: number): {
  readonly points: readonly Point3[];
  readonly faces: readonly Triangle[];
} {
  const segments = 6;
  const points: Point3[] = [[variant % 2 === 0 ? 0.12 : -0.14, 0.82, 0.05]];
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2;
    const radius = 0.78 + ((index * 2 + variant) % 3) * 0.11;
    const y = 0.05 + ((index + variant) % 2) * 0.09;
    points.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
  }
  for (let index = 0; index < segments; index++) {
    const angle = (index / segments) * Math.PI * 2;
    const radius = 0.66 + ((index + variant) % 3) * 0.08;
    points.push([Math.cos(angle) * radius, -0.43, Math.sin(angle) * radius]);
  }
  points.push([0.06, -0.5, -0.04]);

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

export class RockFactory {
  private readonly meshes: PC.Mesh[];

  constructor(
    private readonly pc: typeof PC,
    app: PC.Application,
    private readonly materials: EnvironmentMaterials,
  ) {
    this.meshes = [0, 1, 2, 3].map((variant) => {
      const geometry = createRockGeometry(variant);
      return createFacetedMesh(app, pc, geometry.points, geometry.faces);
    });
  }

  createRock({ variant = 0, scale = 1 }: RockOptions = {}): PC.Entity {
    const rock = createMeshEntity(
      this.pc,
      `rock-${variant}`,
      this.meshes[variant]!,
      variant % 2 === 0 ? this.materials.rockA : this.materials.rockB,
    );
    rock.setLocalScale(scale * (1 + variant * 0.08), scale * 0.8, scale * (0.88 + variant * 0.04));
    rock.setLocalEulerAngles(0, variant * 37, variant % 2 === 0 ? 2 : -3);
    return rock;
  }

  destroy(): void {
    for (const mesh of this.meshes) mesh.destroy();
  }
}
