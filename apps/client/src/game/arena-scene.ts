/**
 * ArenaScene — PlayCanvas arena mesh, lighting, and boundary walls.
 * Palette follows ART_DIRECTION.md: mint floor, warm sun, cool accent, translucent boundary.
 */
import type * as PC from 'playcanvas';
import { ARENA } from '@ice-water/shared';

export class ArenaScene {
  private readonly entities: PC.Entity[] = [];
  private boundaryEntities: PC.Entity[] = [];
  private currentHalfExtent: number;

  constructor(
    private readonly app: PC.Application,
    private readonly pc: typeof PC,
    halfExtent: number,
  ) {
    this.currentHalfExtent = halfExtent;
    this.build();
  }

  setHalfExtent(halfExtent: number): void {
    if (halfExtent === this.currentHalfExtent) return;
    this.currentHalfExtent = halfExtent;
    for (const e of this.boundaryEntities) {
      this.app.root.removeChild(e);
      e.destroy();
    }
    this.boundaryEntities = [];
    this.buildBoundary(halfExtent);
  }

  destroy(): void {
    for (const e of [...this.entities, ...this.boundaryEntities]) {
      this.app.root.removeChild(e);
      e.destroy();
    }
  }

  private build(): void {
    const { pc, app } = this;

    // Ambient light — cool blue tint.
    app.scene.ambientLight = new pc.Color(0.55, 0.7, 0.85);

    // Directional sun — warm late-afternoon.
    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.9, 0.75),
      intensity: 1.6,
      castShadows: false,
    });
    sun.setEulerAngles(40, 30, 0);
    app.root.addChild(sun);
    this.entities.push(sun);

    // Floor — mint green.
    const floorMat = new pc.StandardMaterial();
    floorMat.diffuse = new pc.Color().fromString('#79D49A');
    floorMat.gloss = 0.15;
    floorMat.update();
    const floor = new pc.Entity('floor');
    floor.addComponent('render', { type: 'box', material: floorMat });
    floor.setPosition(0, -0.25, 0);
    floor.setLocalScale(ARENA.halfExtent * 2, 0.5, ARENA.halfExtent * 2);
    app.root.addChild(floor);
    this.entities.push(floor);

    // Obstacle blocks — cream/honey colored.
    for (let i = 0; i < ARENA.blocks.length; i++) {
      const block = ARENA.blocks[i]!;
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color().fromString('#FFF1D1');
      mat.gloss = 0.1;
      mat.update();
      const ent = new pc.Entity(`block-${i}`);
      ent.addComponent('render', { type: 'box', material: mat });
      ent.setPosition(block.x, block.height / 2, block.z);
      ent.setLocalScale(block.width, block.height, block.depth);
      app.root.addChild(ent);
      this.entities.push(ent);
    }

    // Build initial boundary walls.
    this.buildBoundary(this.currentHalfExtent);
  }

  private buildBoundary(halfExtent: number): void {
    const { pc, app } = this;
    // Four translucent boundary walls — cyan frost.
    const wallMat = new pc.StandardMaterial();
    wallMat.diffuse = new pc.Color().fromString('#9BEAFF');
    wallMat.opacity = 0.25;
    wallMat.blendType = pc.BLEND_NORMAL;
    wallMat.gloss = 0.7;
    wallMat.update();

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
    for (let i = 0; i < specs.length; i++) {
      const [x, y, z, sx, sy, sz] = specs[i]!;
      const wall = new pc.Entity(`boundary-wall-${i}`);
      wall.addComponent('render', { type: 'box', material: wallMat });
      wall.setPosition(x, y, z);
      wall.setLocalScale(sx, sy, sz);
      app.root.addChild(wall);
      this.boundaryEntities.push(wall);
    }
  }
}
