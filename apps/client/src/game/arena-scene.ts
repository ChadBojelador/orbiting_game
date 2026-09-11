/**
 * ArenaScene — PlayCanvas arena mesh, lighting, atmosphere, and decorative landmarks.
 * Collision remains defined solely by the shared ARENA specification.
 */
import type * as PC from 'playcanvas';
import { ARENA, ARENA_COLLISION } from '@ice-water/shared';
import { ArenaDecoration } from '../environment/arena-decoration.js';
import {
  createEnvironmentMaterials,
  destroyEnvironmentMaterials,
  type EnvironmentMaterials,
} from '../environment/materials.js';
import type { CameraObstacle } from './third-person-camera.js';

export class ArenaScene {
  private readonly entities: PC.Entity[] = [];
  private readonly cameraObstacles: CameraObstacle[] = ARENA_COLLISION.blocks.map((block) => ({
    minX: block.x - block.width / 2,
    maxX: block.x + block.width / 2,
    minY: 0,
    maxY: block.height,
    minZ: block.z - block.depth / 2,
    maxZ: block.z + block.depth / 2,
  }));
  private boundaryEntities: PC.Entity[] = [];
  private currentHalfExtent: number;
  private readonly materials: EnvironmentMaterials;
  private readonly decoration: ArenaDecoration;

  constructor(
    private readonly app: PC.Application,
    private readonly pc: typeof PC,
    halfExtent: number,
  ) {
    this.currentHalfExtent = halfExtent;
    this.materials = createEnvironmentMaterials(pc);
    this.build();
    this.decoration = new ArenaDecoration(app, pc, this.materials, ARENA.blocks);
  }

  setHalfExtent(halfExtent: number): void {
    if (halfExtent === this.currentHalfExtent) return;
    this.currentHalfExtent = halfExtent;
    for (const entity of this.boundaryEntities) {
      this.app.root.removeChild(entity);
      entity.destroy();
    }
    this.boundaryEntities = [];
    this.buildBoundary(halfExtent);
  }

  destroy(): void {
    this.decoration.destroy();
    for (const entity of [...this.entities, ...this.boundaryEntities]) {
      this.app.root.removeChild(entity);
      entity.destroy();
    }
    destroyEnvironmentMaterials(this.materials);
  }

  /** Static camera geometry is separate from visuals so the world blockout can replace it. */
  getCameraObstacles(): readonly CameraObstacle[] {
    return this.cameraObstacles;
  }

  /** Agent 1's deterministic terrain sampler plugs in here when the authored world lands. */
  getGroundHeight(_x: number, _z: number): number {
    return 0;
  }

  private build(): void {
    const { pc, app } = this;

    // Warm ambient fill and pale distance fog establish depth without volumetrics.
    app.scene.ambientLight = new pc.Color(0.62, 0.72, 0.76);
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = new pc.Color().fromString('#CDEBEA');
    app.scene.fog.start = 38;
    app.scene.fog.end = 82;

    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.9, 0.75),
      intensity: 1.45,
      castShadows: false,
    });
    sun.setEulerAngles(40, 30, 0);
    app.root.addChild(sun);
    this.entities.push(sun);

    const floor = new pc.Entity('floor');
    floor.addComponent('render', { type: 'box', material: this.materials.grass });
    floor.setPosition(0, -0.25, 0);
    floor.setLocalScale(ARENA.halfExtent * 2, 0.5, ARENA.halfExtent * 2);
    app.root.addChild(floor);
    this.entities.push(floor);

    for (let index = 0; index < ARENA.blocks.length; index++) {
      const block = ARENA.blocks[index]!;
      const island = new pc.Entity(`block-${index}`);
      island.addComponent('render', { type: 'box', material: this.materials.cliff });
      island.setPosition(block.x, block.height / 2, block.z);
      island.setLocalScale(block.width, block.height, block.depth);
      app.root.addChild(island);
      this.entities.push(island);

      // The inset cap makes the collision block read as a grassy toy-diorama island.
      const cap = new pc.Entity(`block-grass-cap-${index}`);
      cap.addComponent('render', { type: 'box', material: this.materials.grassLight });
      cap.setPosition(block.x, block.height + 0.08, block.z);
      cap.setLocalScale(Math.max(0.2, block.width - 0.16), 0.16, Math.max(0.2, block.depth - 0.16));
      app.root.addChild(cap);
      this.entities.push(cap);
    }

    this.buildBoundary(this.currentHalfExtent);
  }

  private buildBoundary(halfExtent: number): void {
    const { pc, app } = this;
    const wallHeight = 3;
    const thickness = 0.3;
    const size = halfExtent * 2;
    const specs: Array<[number, number, number, number, number, number]> = [
      [
        0,
        wallHeight / 2,
        -(halfExtent + thickness / 2),
        size + thickness * 2,
        wallHeight,
        thickness,
      ],
      [0, wallHeight / 2, halfExtent + thickness / 2, size + thickness * 2, wallHeight, thickness],
      [-(halfExtent + thickness / 2), wallHeight / 2, 0, thickness, wallHeight, size],
      [halfExtent + thickness / 2, wallHeight / 2, 0, thickness, wallHeight, size],
    ];
    for (let index = 0; index < specs.length; index++) {
      const [x, y, z, sx, sy, sz] = specs[index]!;
      const wall = new pc.Entity(`boundary-wall-${index}`);
      wall.addComponent('render', { type: 'box', material: this.materials.frostBoundary });
      wall.setPosition(x, y, z);
      wall.setLocalScale(sx, sy, sz);
      app.root.addChild(wall);
      this.boundaryEntities.push(wall);
    }
  }
}
