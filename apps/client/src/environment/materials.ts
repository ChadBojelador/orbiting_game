import type * as PC from 'playcanvas';

export interface EnvironmentMaterials {
  readonly grass: PC.StandardMaterial;
  readonly grassLight: PC.StandardMaterial;
  readonly cliff: PC.StandardMaterial;
  readonly bark: PC.StandardMaterial;
  readonly leafA: PC.StandardMaterial;
  readonly leafB: PC.StandardMaterial;
  readonly leafC: PC.StandardMaterial;
  readonly rockA: PC.StandardMaterial;
  readonly rockB: PC.StandardMaterial;
  readonly crystal: PC.StandardMaterial;
  readonly crystalHighlight: PC.StandardMaterial;
  readonly stem: PC.StandardMaterial;
  readonly flowerCoral: PC.StandardMaterial;
  readonly flowerCream: PC.StandardMaterial;
  readonly flowerLavender: PC.StandardMaterial;
  readonly mushroomCap: PC.StandardMaterial;
  readonly frostBoundary: PC.StandardMaterial;
}

interface MaterialOptions {
  readonly gloss?: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  readonly opacity?: number;
}

function createMaterial(
  pc: typeof PC,
  color: string,
  { gloss = 0.12, emissive, emissiveIntensity = 1, opacity = 1 }: MaterialOptions = {},
): PC.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = new pc.Color().fromString(color);
  material.gloss = gloss;
  if (emissive) {
    material.emissive = new pc.Color().fromString(emissive);
    material.emissiveIntensity = emissiveIntensity;
  }
  if (opacity < 1) {
    material.opacity = opacity;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
  }
  material.update();
  return material;
}

export function createEnvironmentMaterials(pc: typeof PC): EnvironmentMaterials {
  return {
    grass: createMaterial(pc, '#79D49A'),
    grassLight: createMaterial(pc, '#A7E5A1'),
    cliff: createMaterial(pc, '#FFF1D1'),
    bark: createMaterial(pc, '#9A6445'),
    leafA: createMaterial(pc, '#4FAA78'),
    leafB: createMaterial(pc, '#72C982'),
    leafC: createMaterial(pc, '#9EDB78'),
    rockA: createMaterial(pc, '#A9A4BA'),
    rockB: createMaterial(pc, '#C2B7BE'),
    crystal: createMaterial(pc, '#54CFE8', {
      gloss: 0.72,
      emissive: '#1A8FB8',
      emissiveIntensity: 0.48,
    }),
    crystalHighlight: createMaterial(pc, '#A5F5FF', {
      gloss: 0.82,
      emissive: '#67DDF5',
      emissiveIntensity: 0.65,
    }),
    stem: createMaterial(pc, '#4E9B69'),
    flowerCoral: createMaterial(pc, '#FF8D7A'),
    flowerCream: createMaterial(pc, '#FFF6D8'),
    flowerLavender: createMaterial(pc, '#B7A0E8'),
    mushroomCap: createMaterial(pc, '#F39C7B'),
    frostBoundary: createMaterial(pc, '#9BEAFF', {
      gloss: 0.7,
      emissive: '#5FCDE9',
      emissiveIntensity: 0.22,
      opacity: 0.24,
    }),
  };
}

export function destroyEnvironmentMaterials(materials: EnvironmentMaterials): void {
  for (const material of Object.values(materials)) material.destroy();
}
