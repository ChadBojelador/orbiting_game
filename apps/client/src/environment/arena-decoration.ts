import type * as PC from 'playcanvas';
import type { ArenaBlock } from '@ice-water/shared';
import { createArenaDecorationLayout } from './arena-decoration-layout.js';
import { CrystalFactory } from './crystal-factory.js';
import type { EnvironmentMaterials } from './materials.js';
import { PlantFactory } from './plant-factory.js';
import { RockFactory } from './rock-factory.js';
import { TreeFactory } from './tree-factory.js';

export class ArenaDecoration {
  private readonly root: PC.Entity;
  private readonly treeFactory: TreeFactory;
  private readonly rockFactory: RockFactory;
  private readonly crystalFactory: CrystalFactory;
  private readonly plantFactory: PlantFactory;
  private readonly batchGroupId: number;

  constructor(
    private readonly app: PC.Application,
    private readonly pc: typeof PC,
    materials: EnvironmentMaterials,
    blocks: readonly ArenaBlock[],
  ) {
    this.root = new pc.Entity('arena-decoration');
    this.batchGroupId = app.batcher.addGroup('arena-decoration', false, 18).id;
    this.treeFactory = new TreeFactory(app, pc, materials);
    this.rockFactory = new RockFactory(pc, app, materials);
    this.crystalFactory = new CrystalFactory(pc, app, materials);
    this.plantFactory = new PlantFactory(pc, app, materials);
    app.root.addChild(this.root);
    this.populate(blocks);
    for (const component of this.root.findComponents('render') as PC.RenderComponent[]) {
      component.batchGroupId = this.batchGroupId;
    }
  }

  destroy(): void {
    this.app.batcher.removeGroup(this.batchGroupId);
    this.app.root.removeChild(this.root);
    this.root.destroy();
    this.treeFactory.destroy();
    this.rockFactory.destroy();
    this.crystalFactory.destroy();
    this.plantFactory.destroy();
  }

  private populate(blocks: readonly ArenaBlock[]): void {
    for (const placement of createArenaDecorationLayout(blocks)) {
      const block = blocks[placement.blockIndex]!;
      let entity: PC.Entity;
      switch (placement.kind) {
        case 'tree':
          entity = this.treeFactory.createTree({
            variant: placement.variant,
            scale: placement.scale,
          });
          break;
        case 'rock':
          entity = this.rockFactory.createRock({
            variant: placement.variant,
            scale: placement.scale,
          });
          break;
        case 'crystal-cluster':
          entity = this.crystalFactory.createCluster(placement.scale);
          break;
        case 'bush':
          entity = this.plantFactory.createBush(placement.scale);
          break;
        case 'flower':
          entity = this.plantFactory.createFlower(placement.color, placement.scale);
          break;
        case 'mushroom':
          entity = this.plantFactory.createMushroom(placement.scale);
          break;
      }
      entity.setLocalPosition(placement.x, block.height + 0.16, placement.z);
      entity.setLocalEulerAngles(0, placement.rotation, 0);
      this.root.addChild(entity);
    }
  }
}
