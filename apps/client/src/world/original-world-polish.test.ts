import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  AdditiveBlending,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Points,
  Scene,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { OriginalWorldMap, surfaceColor } from './original-world-map.js';
import { canDressOriginalGround, isOriginalPresentation } from './original-world-atmosphere.js';
import { OriginalWorldLighting } from './original-world-lighting.js';

describe('Original World presentation safeguards', () => {
  it('preserves every centimetre-quantized collision triangle, including landmark poses', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      const values: number[] = [];
      const vertex = new Vector3();
      world.group.updateMatrixWorld(true);
      world.group.traverse((object) => {
        if (
          !(object instanceof Mesh) ||
          isOriginalPresentation(object) ||
          object.name.startsWith('OCEAN') ||
          object.name === 'frost-wall' ||
          object.name.startsWith('PATH_') ||
          object.name.startsWith('WF_')
        )
          return;
        const positions = object.geometry.getAttribute('position');
        const indices = object.geometry.index;
        const top =
          object.name === 'WATER_NETWORK' || object.name === 'RIVERBED_NETWORK'
            ? object.geometry.groups.find((g: { materialIndex?: number }) => g.materialIndex === 0)
            : undefined;
        for (
          let i = top?.start ?? 0;
          i < (top?.start ?? 0) + (top?.count ?? indices?.count ?? positions.count);
          i++
        ) {
          vertex
            .fromBufferAttribute(positions, indices ? indices.getX(i) : i)
            .applyMatrix4(object.matrixWorld);
          values.push(
            Math.round(vertex.x * 100),
            Math.round(vertex.y * 100),
            Math.round(vertex.z * 100),
          );
        }
      });
      const actual = Buffer.alloc(values.length * 2);
      values.forEach((value, index) => actual.writeInt16LE(value, index * 2));
      const source = readFileSync(
        new URL('../../../../packages/shared/src/simulation/original-data.ts', import.meta.url),
        'utf8',
      );
      const encoded = source.match(/'([A-Za-z0-9+/=]+)'/)?.[1];
      expect(encoded).toBeDefined();
      expect(actual.equals(Buffer.from(encoded!, 'base64'))).toBe(true);
    } finally {
      world.destroy();
    }
  });

  it('keeps instanced ground dressing ankle-height and outside routes, rivers and the hub', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      const matrix = new Matrix4();
      const position = new Vector3();
      const scale = new Vector3();
      let count = 0;
      world.group.traverse((object) => {
        if (!(object instanceof InstancedMesh)) return;
        expect(isOriginalPresentation(object)).toBe(true);
        expect(object.castShadow).toBe(false);
        for (let i = 0; i < object.count; i++) {
          object.getMatrixAt(i, matrix);
          position.setFromMatrixPosition(matrix).add(object.position);
          scale.setFromMatrixScale(matrix);
          expect(canDressOriginalGround(position.x, position.z)).toBe(true);
          expect(scale.y).toBeLessThan(0.24);
          count++;
        }
      });
      expect(count).toBeGreaterThan(100);
      expect(count).toBeLessThan(2000);
      expect(canDressOriginalGround(0, 0)).toBe(false);
      expect(canDressOriginalGround(35, 1)).toBe(false);
      expect(canDressOriginalGround(10, -41)).toBe(false);
    } finally {
      world.destroy();
    }
  });

  it('bounds lights and particles, honors reduced effects, and disposes shared resources once', () => {
    const world = new OriginalWorldMap(new Scene());
    const lights: PointLight[] = [];
    const particles: Points[] = [];
    const instanced: InstancedMesh[] = [];
    world.group.traverse((object) => {
      if (object instanceof PointLight) lights.push(object);
      if (object instanceof Points) particles.push(object);
      if (object instanceof InstancedMesh) instanced.push(object);
    });
    expect(lights).toHaveLength(8);
    expect(lights.every((light) => !light.castShadow && light.distance <= 110)).toBe(true);
    expect(lights.find((light) => light.name === 'windmill-beacon-light')?.distance).toBe(90);
    const crystalLights = lights.filter((light) => light.name.startsWith('CRYSTAL_LIGHT_'));
    expect(crystalLights).toHaveLength(3);
    expect(crystalLights.every((light) => light.distance >= 75 && light.decay <= 1.65)).toBe(true);
    const fireflyLights = lights.filter((light) => light.name.startsWith('forest-firefly-light-'));
    expect(fireflyLights).toHaveLength(3);
    expect(
      fireflyLights.every(
        (light) =>
          light.distance >= 30 &&
          light.intensity >= 140 &&
          light.color.getHex() === 0xf6c85f &&
          !light.castShadow,
      ),
    ).toBe(true);
    const fireflies = particles.find((field) => field.name === 'forest-fireflies')!;
    expect(fireflies.geometry.getAttribute('position').count).toBe(120);
    expect((fireflies.material as import('three').ShaderMaterial).blending).toBe(AdditiveBlending);
    expect(
      particles.reduce((count, field) => count + field.geometry.getAttribute('position').count, 0),
    ).toBeLessThan(800);
    const camera = new Vector3(0, 15, 0);
    world.update(1, camera, 'high');
    expect(particles.some((field) => field.visible)).toBe(true);
    const field = particles[0]!;
    const fullCount = field.geometry.drawRange.count;
    world.update(2, camera, 'medium');
    expect(field.geometry.drawRange.count).toBe(Math.ceil(fullCount / 2));
    world.update(3, camera, 'low');
    expect(particles.every((field) => !field.visible)).toBe(true);
    world.update(4, new Vector3(1000, 1000, 1000), 'high');
    expect(particles.every((field) => !field.visible)).toBe(true);
    expect(fireflyLights.every((light) => !light.visible)).toBe(true);
    expect(instanced.every((mesh) => !mesh.visible)).toBe(true);
    const geometryDispose = vi.spyOn(instanced[0]!.geometry, 'dispose');
    const materialDispose = vi.spyOn(field.material as import('three').ShaderMaterial, 'dispose');
    const instanceDispose = vi.spyOn(instanced[0]!, 'dispose');
    world.destroy();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(instanceDispose).toHaveBeenCalledTimes(1);
  });

  it('integrates the broad meadow beacon and aligns an animated non-colliding fan', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      const landmark = world.group.getObjectByName('LM_MEADOW_WINDMILL')!;
      const tower = landmark.getObjectByName('windmill-tower') as Mesh;
      const beacon = landmark.getObjectByName('windmill-beacon-section') as Mesh;
      const light = landmark.getObjectByName('windmill-beacon-light') as PointLight;
      const fan = landmark.getObjectByName('windmill-fan')!;

      tower.geometry.computeBoundingBox();
      const towerTop = tower.position.y + tower.geometry.boundingBox!.max.y;
      expect(beacon.parent).toBe(landmark);
      expect(beacon.position.y).toBeGreaterThanOrEqual(towerTop);
      expect((beacon.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(2);
      expect(light.parent).toBe(landmark);
      expect(light.position.y).toBe(beacon.position.y);
      expect(light.distance).toBeGreaterThanOrEqual(80);
      expect(light.castShadow).toBe(false);

      expect(fan.position.y).toBeGreaterThan(towerTop * 0.8);
      expect(fan.position.z).toBeGreaterThan(2.2);
      expect(isOriginalPresentation(fan)).toBe(true);
      world.update(2, new Vector3(), 'high');
      expect(fan.rotation.z).toBeCloseTo(0.9);
    } finally {
      world.destroy();
    }
  });

  it('grades cyan crystals from shadowed bases to bright tips while retaining real shadows', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      const cyanCrystals: Mesh[] = [];
      world.group.traverse((object) => {
        if (!(object instanceof Mesh) || object.name !== 'crystal-shard') return;
        const material = object.material;
        if (
          !Array.isArray(material) &&
          material instanceof MeshStandardMaterial &&
          material.color.getHex() === 0x5ea8ff
        )
          cyanCrystals.push(object);
      });

      expect(cyanCrystals.length).toBeGreaterThan(0);
      for (const crystal of cyanCrystals) {
        const position = crystal.geometry.getAttribute('position');
        const color = crystal.geometry.getAttribute('color');
        const glow = crystal.geometry.getAttribute('crystalGlow');
        expect(glow.count).toBe(position.count);
        crystal.geometry.computeBoundingBox();
        const bounds = crystal.geometry.boundingBox!;
        const cutoff = (bounds.max.y - bounds.min.y) * 0.2;
        let lowerLight = 0;
        let lowerCount = 0;
        let upperLight = 0;
        let upperCount = 0;
        for (let index = 0; index < position.count; index += 1) {
          const light = color.getX(index) + color.getY(index) + color.getZ(index);
          const y = position.getY(index);
          if (y <= bounds.min.y + cutoff) {
            lowerLight += light;
            lowerCount++;
          }
          if (y >= bounds.max.y - cutoff) {
            upperLight += light;
            upperCount++;
          }
        }
        expect(upperLight / upperCount).toBeGreaterThan((lowerLight / lowerCount) * 1.5);
        expect(crystal.castShadow).toBe(true);
        expect(crystal.receiveShadow).toBe(true);
        const material = crystal.material as import('three').MeshStandardMaterial;
        expect(material.emissiveIntensity).toBeGreaterThan(2);
        expect(material.userData.hasCrystalGlowGradient).toBe(true);
        expect(material.roughness).toBeGreaterThanOrEqual(0.25);
      }
    } finally {
      world.destroy();
    }
  });

  it('uses one local moon shadow volume with stable light direction and quality resizing', () => {
    const lighting = new OriginalWorldLighting();
    try {
      const camera = new Vector3(20, 47, -65);
      lighting.update(camera, 'high');
      expect(lighting.moon.castShadow).toBe(true);
      expect(lighting.moon.shadow.mapSize.x).toBe(2048);
      expect(lighting.moon.target.position.distanceTo(camera)).toBeLessThan(0.1);
      expect(lighting.moon.position.clone().sub(lighting.moon.target.position).toArray()).toEqual([
        -70, 100, -50,
      ]);
      expect(lighting.moonDisc.name).toBe('ORIGINAL_SKY_MOON');
      expect(lighting.moonDisc.position.distanceTo(camera)).toBeCloseTo(240);
      expect(
        lighting.moonDisc.position
          .clone()
          .sub(camera)
          .normalize()
          .dot(lighting.moon.position.clone().sub(lighting.moon.target.position).normalize()),
      ).toBeCloseTo(1);
      expect(lighting.moonDisc.material.depthWrite).toBe(false);
      expect(lighting.moonDisc.material.fog).toBe(false);
      expect(lighting.moon.shadow.camera.right - lighting.moon.shadow.camera.left).toBe(96);
      const map = new WebGLRenderTarget(1, 1);
      const dispose = vi.spyOn(map, 'dispose');
      lighting.moon.shadow.map = map;
      lighting.update(camera, 'medium');
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(lighting.moon.shadow.mapSize.x).toBe(1024);
      lighting.update(camera, 'low');
      expect(lighting.moon.castShadow).toBe(false);
    } finally {
      const geometryDispose = vi.spyOn(lighting.moonDisc.geometry, 'dispose');
      const materialDispose = vi.spyOn(lighting.moonDisc.material, 'dispose');
      lighting.destroy();
      expect(geometryDispose).toHaveBeenCalledTimes(1);
      expect(materialDispose).toHaveBeenCalledTimes(1);
    }
  });

  it('blends the formerly hard biome borders while preserving distinct regional colors', () => {
    for (const [x, z, elevation] of [
      [-28, 0, 21],
      [30, 0, 20],
      [0, 30, 12],
      [0, 88, 7],
      [0, -55, 35],
    ]) {
      const left = surfaceColor(x! - 0.01, z! - 0.01, elevation!);
      const right = surfaceColor(x! + 0.01, z! + 0.01, elevation!);
      expect(
        Math.abs(left.r - right.r) + Math.abs(left.g - right.g) + Math.abs(left.b - right.b),
      ).toBeLessThan(0.01);
    }
    const forest = surfaceColor(-65, -18, 21);
    const meadow = surfaceColor(-5, 60, 7);
    expect(forest.g).toBeLessThan(meadow.g * 0.5);
    expect(surfaceColor(69, -14, 20).b).toBeGreaterThan(surfaceColor(69, -14, 20).r);
  });

  it('connects both waterfall sheets to their authored top and river endpoints', () => {
    const world = new OriginalWorldMap(new Scene());
    try {
      world.group.updateMatrixWorld(true);
      for (const [name, top, bottom] of [
        ['WF_MOUNTAIN_01', new Vector3(20, 45, -65), new Vector3(20, 23, -55)],
        ['WF_CRYSTAL_01', new Vector3(60, 22, -15), new Vector3(60, 17, -5)],
      ] as const) {
        const waterfall = world.group.getObjectByName(name) as Mesh;
        const halfHeight = top.distanceTo(bottom) / 2;
        expect(
          new Vector3(0, halfHeight, 0).applyMatrix4(waterfall.matrixWorld).distanceTo(top),
        ).toBeLessThan(0.001);
        expect(
          new Vector3(0, -halfHeight, 0).applyMatrix4(waterfall.matrixWorld).distanceTo(bottom),
        ).toBeLessThan(0.001);
        expect(waterfall.castShadow).toBe(false);
      }
    } finally {
      world.destroy();
    }
  });
});
