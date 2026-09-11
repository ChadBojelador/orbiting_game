import characterModelUrl from '../../../../assets/character/test_char_model.glb?url';
import type * as PC from 'playcanvas';

export type CharacterAnimation = 'Idle' | 'Run' | 'Frozen' | 'Unfrozen' | 'Wave';

interface CharacterContainerResource {
  animations: PC.Asset[];
  instantiateRenderEntity(options?: object): PC.Entity;
}

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

    // The GLB needs a skin update track to render its mesh parts. Its action clips
    // are intentionally not used: they separate the test export in PlayCanvas.
    const skinTrack = this.resource.animations.find(
      (candidate) => candidate.name === 'Armature|Idle',
    );
    if (skinTrack?.resource) {
      entity.addComponent('anim', { activate: true });
      if (entity.anim) {
        entity.anim.assignAnimation(
          'SkinUpdate',
          skinTrack.resource as PC.AnimTrack,
          undefined,
          1,
          true,
        );
        entity.anim.baseLayer?.transition('SkinUpdate');
      }
    }

    let currentAnimation = initialAnimation;
    let stateStartedAt = performance.now();

    return {
      entity,
      material,
      play(animation) {
        if (animation !== currentAnimation) {
          currentAnimation = animation;
          stateStartedAt = performance.now();
        }

        const elapsed = (performance.now() - stateStartedAt) / 1000;
        const scale = 0.2;
        if (animation === 'Run') {
          entity.setLocalPosition(0, Math.abs(Math.sin(elapsed * 10)) * 0.055, 0);
          entity.setLocalEulerAngles(0, 0, Math.sin(elapsed * 10) * 4);
          return;
        }
        if (animation === 'Unfrozen') {
          const bounce = Math.max(0, 1 - elapsed * 2.2) * Math.sin(elapsed * 15) * 0.08;
          entity.setLocalPosition(0, bounce, 0);
          entity.setLocalEulerAngles(0, 0, 0);
          entity.setLocalScale(scale, scale * (1 + bounce * 0.4), scale);
          return;
        }
        if (animation === 'Wave') {
          entity.setLocalPosition(0, Math.sin(elapsed * 3) * 0.025, 0);
          entity.setLocalEulerAngles(0, Math.sin(elapsed * 2) * 9, 0);
          return;
        }
        entity.setLocalPosition(0, 0, 0);
        entity.setLocalEulerAngles(0, 0, 0);
        entity.setLocalScale(scale, scale, scale);
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
