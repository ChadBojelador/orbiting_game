import characterModelUrl from '../../../../assets/character/test_char_model.glb?url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export type CharacterAnimation = 'Idle' | 'Run' | 'Frozen' | 'Unfrozen' | 'Wave';

const CLIPS: Record<CharacterAnimation, { sourceName: string; speed: number; loop: boolean }> = {
  Idle: { sourceName: 'Armature|Idle', speed: 1, loop: true },
  Run: { sourceName: 'Armature|Run', speed: 1.15, loop: true },
  Frozen: { sourceName: 'Armature|freeze', speed: 1, loop: false },
  Unfrozen: { sourceName: 'Armature|unfrozen', speed: 1, loop: false },
  Wave: { sourceName: 'Armature|Wave', speed: 0.9, loop: true },
};

export interface CharacterInstance {
  root: THREE.Object3D;
  material: THREE.MeshStandardMaterial;
  play(animation: CharacterAnimation, blendTime?: number): void;
  update(deltaSeconds: number): void;
}

export class CharacterModelFactory {
  constructor(
    private readonly source: THREE.Object3D,
    private readonly animations: readonly THREE.AnimationClip[],
  ) {}

  instantiate(color: string, initialAnimation: CharacterAnimation): CharacterInstance {
    const root = cloneSkeleton(this.source);
    root.name = 'character-model';
    root.scale.setScalar(0.2);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0 });
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.material = material;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map<CharacterAnimation, THREE.AnimationAction>();
    for (const [name, definition] of Object.entries(CLIPS) as [
      CharacterAnimation,
      (typeof CLIPS)[CharacterAnimation],
    ][]) {
      const clip = this.animations.find((candidate) => candidate.name === definition.sourceName);
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      action.timeScale = definition.speed;
      action.setLoop(
        definition.loop ? THREE.LoopRepeat : THREE.LoopOnce,
        definition.loop ? Infinity : 1,
      );
      action.clampWhenFinished = !definition.loop;
      actions.set(name, action);
    }

    let currentAnimation = initialAnimation;
    actions.get(initialAnimation)?.play();
    return {
      root,
      material,
      play(animation, blendTime = 0.12) {
        if (animation === currentAnimation) return;
        const previous = actions.get(currentAnimation);
        const next = actions.get(animation);
        currentAnimation = animation;
        if (!next) return;
        next.reset().fadeIn(blendTime).play();
        previous?.fadeOut(blendTime);
      },
      update(deltaSeconds) {
        mixer.update(deltaSeconds);
      },
    };
  }
}

export async function loadCharacterModel(): Promise<CharacterModelFactory> {
  const gltf = await new GLTFLoader().loadAsync(characterModelUrl);
  return new CharacterModelFactory(gltf.scene, gltf.animations);
}
