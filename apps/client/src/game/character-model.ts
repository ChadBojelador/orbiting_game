import characterModelUrl from '../../../../assets/character/test_char_model.glb?url';
import type * as PC from 'playcanvas';

export type CharacterAnimation = 'Idle' | 'Run' | 'Frozen' | 'Unfrozen' | 'Wave';

interface CharacterContainerResource {
  animations: PC.Asset[];
  instantiateRenderEntity(options?: object): PC.Entity;
}

interface ClipDefinition {
  sourceName: string;
  speed: number;
  loop: boolean;
}

const CLIPS: Record<CharacterAnimation, ClipDefinition> = {
  Idle: { sourceName: 'Armature|Idle', speed: 1, loop: true },
  Run: { sourceName: 'Armature|Run', speed: 1.15, loop: true },
  Frozen: { sourceName: 'Armature|freeze', speed: 1, loop: false },
  Unfrozen: { sourceName: 'Armature|unfrozen', speed: 1, loop: false },
  Wave: { sourceName: 'Armature|Wave', speed: 0.9, loop: true },
};

export interface CharacterInstance {
  entity: PC.Entity;
  material: PC.StandardMaterial;
  play(animation: CharacterAnimation, blendTime?: number): void;
}

export class CharacterModelFactory {
  constructor(
    private readonly pc: typeof PC,
    private readonly resource: CharacterContainerResource,
  ) {}

  instantiate(color: string, initialAnimation: CharacterAnimation): CharacterInstance {
    const entity = this.resource.instantiateRenderEntity({ castShadows: true });
    entity.name = 'character-model';
    entity.setLocalScale(0.2, 0.2, 0.2);

    const material = new this.pc.StandardMaterial();
    material.diffuse = new this.pc.Color().fromString(color);
    material.gloss = 0.28;
    material.metalness = 0;
    material.update();

    for (const component of entity.findComponents('render')) {
      const render = component as PC.RenderComponent;
      for (const meshInstance of render.meshInstances ?? []) meshInstance.material = material;
    }

    entity.addComponent('anim', { activate: true });
    for (const [stateName, definition] of Object.entries(CLIPS) as [
      CharacterAnimation,
      ClipDefinition,
    ][]) {
      const animation = this.resource.animations.find(
        (candidate) => candidate.name === definition.sourceName,
      );
      if (!animation?.resource) continue;
      entity.anim?.assignAnimation(
        stateName,
        animation.resource as PC.AnimTrack,
        undefined,
        definition.speed,
        definition.loop,
      );
    }

    let currentAnimation = initialAnimation;
    entity.anim?.baseLayer?.transition(initialAnimation);

    return {
      entity,
      material,
      play(animation, blendTime = 0.12) {
        if (animation === currentAnimation) return;
        currentAnimation = animation;
        entity.anim?.baseLayer?.transition(animation, blendTime);
      },
    };
  }
}

export function loadCharacterModel(
  app: PC.Application,
  pc: typeof PC,
): Promise<CharacterModelFactory> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(characterModelUrl, 'container', (error, asset) => {
      if (error || !asset?.resource) {
        reject(new Error(`Unable to load character model: ${String(error ?? 'missing resource')}`));
        return;
      }
      resolve(new CharacterModelFactory(pc, asset.resource as CharacterContainerResource));
    });
  });
}
