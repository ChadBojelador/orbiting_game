import * as THREE from 'three';
import { originalTopology } from '@ice-water/shared';

const { terrainHeightAt, SEA_LEVEL } = originalTopology;
export type OriginalSurface = 'ground' | 'rock' | 'wood' | 'water' | 'ocean' | 'waterfall';

/** Small shader additions keep Three's lighting, fog, shadows and color management. */
export class OriginalWorldMaterials {
  readonly time = { value: 0 };
  readonly motion = { value: 1 };
  private readonly depth = createCoastalDepthTexture();

  apply(material: THREE.MeshStandardMaterial, surface: OriginalSurface): void {
    const isWater = surface === 'water' || surface === 'ocean' || surface === 'waterfall';
    material.customProgramCacheKey = () => `original-night-${surface}-v1`;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.originalTime = this.time;
      shader.uniforms.originalMotion = this.motion;
      shader.uniforms.originalDepth = { value: this.depth };
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vOriginalWorld;',
      ).replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 originalPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          originalPosition = instanceMatrix * originalPosition;
        #endif
        vOriginalWorld = (modelMatrix * originalPosition).xyz;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vOriginalWorld;
        uniform float originalTime;
        uniform float originalMotion;
        uniform sampler2D originalDepth;
        float originalGrain(vec3 p) {
          return sin(p.x * 2.7 + sin(p.z * 1.9)) * sin(p.z * 3.1 + p.y * 2.3);
        }`,
      );
      const waterColor = surface === 'ocean' ? `
        vec2 depthUv = (vOriginalWorld.xz + 128.0) / 256.0;
        float inMap = step(0.0, depthUv.x) * step(depthUv.x, 1.0)
          * step(0.0, depthUv.y) * step(depthUv.y, 1.0);
        float depth = mix(1.0, texture2D(originalDepth, clamp(depthUv, 0.0, 1.0)).r, inMap);
        diffuseColor.rgb *= mix(vec3(0.32, 0.85, 0.77), vec3(0.09, 0.22, 0.36), depth);
        float shore = (1.0 - smoothstep(0.02, 0.19, depth)) * smoothstep(0.0, 0.018, depth);
        float foam = pow(0.5 + 0.5 * sin(vOriginalWorld.x * 2.0 + vOriginalWorld.z * 1.4
          - originalTime * 0.6), 8.0);
        diffuseColor.rgb += shore * foam * 0.12;` : surface === 'waterfall' ? `
        float streak = pow(0.5 + 0.5 * sin(vOriginalWorld.x * 8.0
          + sin(vOriginalWorld.y * 0.9 + originalTime * 3.5)), 4.0);
        diffuseColor.rgb *= 0.75 + streak * 0.5;
        diffuseColor.a *= 0.75 + streak * 0.25;` : '';
      const surfaceColor = isWater ? waterColor : `
        float grain = originalGrain(vOriginalWorld * ${surface === 'wood' ? 'vec3(0.5, 7.0, 0.5)' : 'vec3(1.0)'});
        diffuseColor.rgb *= 0.93 + grain * 0.07;
        ${surface === 'rock' ? `
          float frost = smoothstep(32.0, 67.0, vOriginalWorld.y + grain * 3.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.66, 0.78, 0.88), frost * 0.65);` : ''}
        ${surface === 'ground' ? `
          float wet = 1.0 - smoothstep(1.7, 3.1, vOriginalWorld.y);
          diffuseColor.rgb *= 1.0 - wet * 0.24;` : ''}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>', `#include <color_fragment>\n${surfaceColor}`,
      );
      if (isWater) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          vec2 ripple = vec2(
            cos(vOriginalWorld.x * 0.72 + vOriginalWorld.z * 0.35 + originalTime * 0.55),
            sin(vOriginalWorld.z * 0.91 - vOriginalWorld.x * 0.21 + originalTime * 0.43));
          normal = normalize(normal + mat3(viewMatrix) * vec3(ripple.x, 0.0, ripple.y) * 0.075 * originalMotion);`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 3.0);
          totalEmissiveRadiance += vec3(0.035, 0.055, 0.09) * fresnel;`,
        );
      }
    };
  }

  destroy(): void { this.depth.dispose(); }
}

function createCoastalDepthTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const point = { x: -128 + (x + 0.5) * 2, z: -128 + (z + 0.5) * 2 };
    const height = terrainHeightAt(point);
    // Authored water outside land is a shallow sentinel; estimate coastal
    // distance there without changing the real seabed or playable boundary.
    let distance = 6;
    if (height >= SEA_LEVEL) distance = 0;
    else for (const region of originalTopology.LAND_REGIONS) {
      const radial = Math.hypot((point.x - region.x) / region.radiusX, (point.z - region.z) / region.radiusZ);
      distance = Math.min(distance, Math.max(0, radial - 1) * Math.min(region.radiusX, region.radiusZ) * 0.5);
    }
    const value = Math.round(THREE.MathUtils.clamp(distance / 6, 0, 1) * 255);
    pixels.set([value, value, value, 255], (z * size + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
