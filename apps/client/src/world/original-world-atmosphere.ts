import * as THREE from 'three';
import { originalTopology } from '@ice-water/shared';
import type { OriginalWorldQuality } from './original-world-lighting.js';

const {
  WORLD_MIN,
  SEA_LEVEL,
  terrainHeightAt,
  isPermanentLand,
  ROUTE_CORRIDORS,
  RIVER_BRANCHES,
  BRIDGES,
  ARENA,
} = originalTopology;

/** Explicitly separate non-cover accents from the immutable collision bake. */
export function isOriginalPresentation(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (current.userData.originalPresentation === true) return true;
  }
  return false;
}

function random(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function distanceToSegment(
  x: number,
  z: number,
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

export function canDressOriginalGround(x: number, z: number): boolean {
  const cellX = WORLD_MIN + Math.floor((x - WORLD_MIN) / 3.125) * 3.125;
  const cellZ = WORLD_MIN + Math.floor((z - WORLD_MIN) / 3.125) * 3.125;
  if (
    !isPermanentLand({ x: cellX + 1.5625, z: cellZ + 1.5625 }) ||
    Math.abs(x) > 123 ||
    Math.abs(z) > 123
  )
    return false;
  if (Math.hypot(x, z) < 31 || terrainHeightAt({ x, z }) < SEA_LEVEL + 0.3) return false;
  for (const route of ROUTE_CORRIDORS) {
    for (let i = 1; i < route.points.length; i++) {
      if (distanceToSegment(x, z, route.points[i - 1]!, route.points[i]!) < route.width / 2 + 1.5)
        return false;
    }
  }
  for (const river of RIVER_BRANCHES) {
    for (let i = 1; i < river.length; i++) {
      if (distanceToSegment(x, z, river[i - 1]!, river[i]!) < 6.5) return false;
    }
  }
  if (
    BRIDGES.some((b) => Math.abs(x - b.x) < b.width / 2 + 2 && Math.abs(z - b.z) < b.depth / 2 + 2)
  )
    return false;
  const heights = [
    terrainHeightAt({ x: x - 0.5, z }),
    terrainHeightAt({ x: x + 0.5, z }),
    terrainHeightAt({ x, z: z - 0.5 }),
    terrainHeightAt({ x, z: z + 0.5 }),
  ];
  return Math.max(...heights) - Math.min(...heights) < 0.3;
}

// Follow the rendered top triangles, not the analytic height between grid vertices.
function groundHeight(x: number, z: number): number {
  const step = 3.125;
  const left = WORLD_MIN + Math.floor((x - WORLD_MIN) / step) * step;
  const top = WORLD_MIN + Math.floor((z - WORLD_MIN) / step) * step;
  const u = (x - left) / step,
    v = (z - top) / step;
  const nw = terrainHeightAt({ x: left, z: top });
  const ne = terrainHeightAt({ x: left + step, z: top });
  const sw = terrainHeightAt({ x: left, z: top + step });
  const se = terrainHeightAt({ x: left + step, z: top + step });
  return u + v <= 1
    ? nw + (ne - nw) * u + (sw - nw) * v
    : se + (sw - se) * (1 - u) + (ne - se) * (1 - v);
}

interface ParticleField {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  count: number;
}

export class OriginalWorldAtmosphere {
  readonly group = new THREE.Group();
  private readonly time = { value: 0 };
  private readonly fields: ParticleField[] = [];
  private readonly detail: THREE.InstancedMesh[] = [];

  constructor() {
    this.group.name = 'ORIGINAL_PRESENTATION';
    this.group.userData.originalPresentation = true;
    this.addGroundDetails();
    this.addWarmAccents();
    // Local fog is sparse soft points below eye height, never a full-screen layer.
    this.addParticles('forest-fireflies', -65, 23, -18, 25, 3, 80, 0xffd080, 0.085, 0.7, 0.12);
    this.addParticles('forest-low-mist', -65, 21.3, -18, 22, 0.45, 20, 0x738b9b, 2.5, 0.045, 0.05);
    this.addParticles('crystal-dust', 69, 24, -14, 15, 8, 90, 0x99a1ff, 0.075, 0.6, 0.18);
    this.addParticles('crystal-low-mist', 69, 20.4, -14, 13, 0.55, 16, 0x877eca, 2.3, 0.045, 0.04);
    this.addParticles('peak-snow', 10, 65, -91, 23, 20, 110, 0xc5def2, 0.065, 0.48, -0.55);
    this.addParticles('peak-mist', 10, 54, -91, 25, 1.4, 20, 0xb4c8e0, 3, 0.045, 0.04);
    this.addParticles('meadow-pollen', -5, 8.2, 60, 30, 1.6, 55, 0xebd8ac, 0.055, 0.4, 0.09);
    this.addParticles('shore-spray', 30, 2.3, 115, 19, 0.7, 36, 0xc2e2ee, 0.06, 0.35, 0.15);
    for (const [name, x, y, z, width, tint] of [
      ['mountain', 20, 23.2, -55, 4, 0xd6e4f2],
      ['crystal', 60, 17.2, -5, 3, 0xb8c6e6],
    ] as const) {
      this.addParticles(`${name}-spray`, x, y + 0.5, z, width, 1.5, 48, tint, 0.08, 0.45, 0.8);
      this.addParticles(`${name}-mist`, x, y, z, width, 0.8, 20, tint, 1.8, 0.09, 0.25);
    }
    for (const [name, x, y, z] of [
      ['village', 0, 16, 1],
      ['moonstone', 37, 7, 116],
    ] as const) {
      this.addParticles(`${name}-glow`, x, y, z, 3.5, 3, 30, 0x69dfff, 0.085, 0.65, 0.16);
    }
  }

  update(seconds: number, camera: THREE.Vector3, quality: OriginalWorldQuality): void {
    this.time.value = seconds;
    for (const { points, count } of this.fields) {
      points.visible = quality !== 'low' && points.position.distanceToSquared(camera) < 140 * 140;
      points.geometry.setDrawRange(0, quality === 'high' ? count : Math.ceil(count * 0.5));
    }
    for (const detail of this.detail) {
      detail.visible = detail.position.distanceToSquared(camera) < 105 * 105;
      detail.count =
        quality === 'low'
          ? Math.ceil(detail.instanceMatrix.count * 0.35)
          : detail.instanceMatrix.count;
    }
  }

  private addGroundDetails(): void {
    const stone = new THREE.IcosahedronGeometry(1, 0);
    const sprig = new THREE.ConeGeometry(1, 1, 4);
    const rock = new THREE.MeshStandardMaterial({
      color: 0x82918e,
      roughness: 0.8,
      flatShading: true,
    });
    const green = new THREE.MeshStandardMaterial({ color: 0x6d9564, roughness: 1 });
    const crystal = new THREE.MeshStandardMaterial({
      color: 0x806cba,
      emissive: 0x594ca8,
      emissiveIntensity: 0.7,
      roughness: 0.28,
    });
    const flower = new THREE.MeshStandardMaterial({ color: 0xe8cf9b, roughness: 0.9 });
    for (const region of originalTopology.LAND_REGIONS) {
      if (region.id === 'BIO_VILLAGE') continue;
      const isCrystal = region.id === 'BIO_CRYSTAL_VALLEY' || region.id === 'BIO_ISLAND_E';
      const isForest = region.id === 'BIO_FOREST';
      const isMeadow = region.id === 'BIO_MEADOW';
      const isIce = region.id === 'BIO_ICE_PEAKS';
      for (let kind = 0; kind < 2; kind++) {
        const placements: THREE.Matrix4[] = [];
        const transform = new THREE.Object3D();
        const attempts = isForest ? 240 : isMeadow ? 100 : 130;
        for (let i = 0; i < attempts; i++) {
          const seed = i + kind * 409 + region.x * 53;
          const x = region.x + (random(seed) * 2 - 1) * region.radiusX * 0.85;
          const z = region.z + (random(seed + 51) * 2 - 1) * region.radiusZ * 0.85;
          if (!canDressOriginalGround(x, z)) continue;
          const height = 0.08 + random(seed + 9) * 0.15;
          transform.position.set(x - region.x, groundHeight(x, z) + height * 0.25, z - region.z);
          transform.rotation.set(0, random(seed + 12) * Math.PI, 0);
          transform.scale.set(kind === 0 ? 0.2 : 0.1, height, kind === 0 ? 0.28 : 0.1);
          transform.updateMatrix();
          placements.push(transform.matrix.clone());
        }
        if (!placements.length) continue;
        const material =
          kind === 0 ? rock : isCrystal ? crystal : isIce || isMeadow ? flower : green;
        const batch = new THREE.InstancedMesh(
          kind === 0 ? stone : sprig,
          material,
          placements.length,
        );
        batch.name = `DRESS_${region.id}_${kind}`;
        batch.position.set(region.x, 0, region.z);
        batch.userData.ankleHeight = true;
        placements.forEach((matrix, index) => {
          batch.setMatrixAt(index, matrix);
          batch.setColorAt(
            index,
            new THREE.Color(isForest ? 0x668278 : isIce ? 0xc8daed : 0xffffff).multiplyScalar(
              0.8 + random(index) * 0.2,
            ),
          );
        });
        batch.receiveShadow = true;
        batch.computeBoundingSphere();
        this.group.add(batch);
        this.detail.push(batch);
      }
    }
  }

  private addWarmAccents(): void {
    const amber = new THREE.MeshStandardMaterial({
      color: 0xf6bc64,
      emissive: 0xff9b35,
      emissiveIntensity: 2.3,
      roughness: 0.7,
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x453a31, roughness: 0.85 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    // Inset crate straps and lamps keep the six existing cover envelopes intact.
    for (const [index, block] of ARENA.blocks.filter((b) => b.id.startsWith('COVER_')).entries()) {
      const y = terrainHeightAt(block);
      for (const sign of [-1, 1]) {
        const strap = new THREE.Mesh(box, trim);
        strap.name = 'village-crate-strap';
        strap.position.set(block.x + sign * block.width * 0.28, y + block.height / 2, block.z);
        strap.scale.set(0.12, block.height + 0.008, block.depth + 0.008);
        this.group.add(strap);
      }
      if (index % 2 === 0) {
        const lamp = new THREE.Mesh(box, amber);
        lamp.name = 'village-inset-lantern';
        lamp.position.set(block.x, y + block.height * 0.65, block.z + block.depth / 2);
        lamp.scale.set(0.16, 0.24, 0.025);
        this.group.add(lamp);
      }
    }
    for (const bridge of BRIDGES) {
      for (const sign of [-1, 1]) {
        const lamp = new THREE.Mesh(box, amber);
        const horizontal = bridge.width > bridge.depth;
        lamp.name = 'bridge-lantern';
        lamp.position.set(
          bridge.x + (horizontal ? sign * bridge.width * 0.35 : bridge.width * 0.46),
          terrainHeightAt(bridge) + 1.31,
          bridge.z + (horizontal ? bridge.depth * 0.46 : sign * bridge.depth * 0.35),
        );
        lamp.scale.set(0.12, 0.16, 0.12);
        this.group.add(lamp);
      }
    }
    const window = new THREE.Mesh(box, amber);
    window.name = 'windmill-window';
    const angle = Math.PI / 8;
    window.position.set(
      -21 + Math.sin(angle) * 2.28,
      terrainHeightAt({ x: -21, z: 62 }) + 6.3,
      62 + Math.cos(angle) * 2.28,
    );
    window.rotation.y = angle;
    window.rotateX(-Math.atan(0.1 * Math.cos(angle)));
    window.scale.set(0.55, 0.85, 0.04);
    this.group.add(window);
    for (const [name, x, y, z, power, range] of [
      ['village-amber', -8, 14, -7, 18, 9],
      ['windmill-amber', -20, 13, 65, 12, 8],
    ] as const) {
      const light = new THREE.PointLight(0xffb65c, power, range, 2);
      light.name = name;
      light.position.set(x, y, z);
      this.group.add(light);
    }
  }

  private addParticles(
    name: string,
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    count: number,
    color: number,
    size: number,
    opacity: number,
    speed: number,
  ): void {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = random(i + x) * Math.PI * 2;
      const r = Math.sqrt(random(i + z + 17)) * radius;
      positions.set(
        [Math.cos(angle) * r, (random(i + y + 31) - 0.5) * height, Math.sin(angle) * r],
        i * 3,
      );
      seeds[i] = random(i + 701) * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      Math.hypot(radius + 1, height + 1),
    );
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog!),
        time: this.time,
        tint: { value: new THREE.Color(color) },
        size: { value: size },
        opacity: { value: opacity },
        height: { value: height },
        speed: { value: speed },
      },
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        attribute float seed;
        uniform float time, size, height, speed;
        varying float shimmer;
        void main() {
          vec3 p = position;
          p.x += sin(time * 0.24 + seed) * 0.35;
          p.z += cos(time * 0.19 + seed) * 0.35;
          p.y = mod(p.y + height * 0.5 + time * speed, height) - height * 0.5;
          shimmer = (0.65 + 0.35 * sin(time * 0.7 + seed)) * (1.0 - pow(abs(p.y / (height * 0.5)), 6.0));
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp(size * 600.0 / max(1.0, -mvPosition.z), 1.0, 80.0);
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform vec3 tint;
        uniform float opacity;
        varying float shimmer;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
          float alpha = (1.0 - smoothstep(0.0, 1.0, radius)) * opacity * shimmer;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(tint, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const points = new THREE.Points(geometry, material);
    points.name = name;
    points.position.set(x, y, z);
    this.group.add(points);
    this.fields.push({ points, count });
  }
}
