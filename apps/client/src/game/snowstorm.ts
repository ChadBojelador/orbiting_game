import {
  Group,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Mesh,
  PlaneGeometry,
  Color,
  DoubleSide,
  type Scene,
  type Vector3,
  UniformsUtils,
  UniformsLib,
} from 'three';
import type { MapId } from '@ice-water/shared';

/**
 * Snowstorm timing constants (all in milliseconds of remaining match time).
 * These detect when the existing timer reaches certain points — the round
 * duration itself is never modified.
 */
const STORM_START_MS = 240_000; // 4:00 remaining
const STORM_MID_MS = 120_000; // 2:00 remaining
const STORM_HEAVY_MS = 60_000; // 1:00 remaining
const STORM_MAX_MS = 10_000; // 0:10 remaining

/** Map-specific snowstorm radii and ground plane sizes. */
function mapExtent(mapId: MapId): { radius: number; ground: number; groundY: number } {
  switch (mapId) {
    case 'frostline':
      return { radius: 70, ground: 130, groundY: 0.02 };
    case 'island':
      return { radius: 90, ground: 170, groundY: 0.04 };
    case 'original':
      return { radius: 130, ground: 260, groundY: 0.03 };
  }
}

/**
 * Returns a 0–1 snowstorm intensity based on remaining match milliseconds.
 * 0 = no snow, 1 = maximum blizzard.
 */
export function snowstormIntensity(remainingMs: number): number {
  if (remainingMs >= STORM_START_MS) return 0;
  if (remainingMs <= STORM_MAX_MS) return 1;
  // Piecewise ramp for a natural-feeling progression
  if (remainingMs > STORM_MID_MS) {
    // 4:00 → 2:00: light snow, 0 → 0.3
    const t = (STORM_START_MS - remainingMs) / (STORM_START_MS - STORM_MID_MS);
    return t * 0.3;
  }
  if (remainingMs > STORM_HEAVY_MS) {
    // 2:00 → 1:00: moderate, 0.3 → 0.65
    const t = (STORM_MID_MS - remainingMs) / (STORM_MID_MS - STORM_HEAVY_MS);
    return 0.3 + t * 0.35;
  }
  // 1:00 → 0:10: heavy to max, 0.65 → 1.0
  const t = (STORM_HEAVY_MS - remainingMs) / (STORM_HEAVY_MS - STORM_MAX_MS);
  return 0.65 + t * 0.35;
}

/**
 * Returns a 0–1 snow ground accumulation factor. Slightly lags behind
 * snowfall intensity so accumulation feels like it builds up over time.
 */
export function snowAccumulation(remainingMs: number): number {
  if (remainingMs >= STORM_START_MS) return 0;
  if (remainingMs <= STORM_MAX_MS) return 1;
  if (remainingMs > STORM_MID_MS) {
    const t = (STORM_START_MS - remainingMs) / (STORM_START_MS - STORM_MID_MS);
    return t * 0.15;
  }
  if (remainingMs > STORM_HEAVY_MS) {
    const t = (STORM_MID_MS - remainingMs) / (STORM_MID_MS - STORM_HEAVY_MS);
    return 0.15 + t * 0.4;
  }
  const t = (STORM_HEAVY_MS - remainingMs) / (STORM_HEAVY_MS - STORM_MAX_MS);
  return 0.55 + t * 0.45;
}

// ── Particle counts by quality ──
const PARTICLE_COUNTS = { high: 4000, medium: 2400, low: 1200 } as const;
type Quality = keyof typeof PARTICLE_COUNTS;

/**
 * Performance-friendly snowstorm rendered with a single GPU particle system
 * (THREE.Points with a custom shader) and a translucent ground snow plane.
 *
 * All snowflake positions are computed on the GPU via modular arithmetic so
 * the JS render loop does zero per-particle work. The ground snow plane uses
 * opacity to simulate accumulation — no permanent objects are spawned.
 */
export class Snowstorm {
  readonly group = new Group();
  private readonly snowParticles: Points<BufferGeometry, ShaderMaterial>;
  private readonly groundSnow: Mesh;
  private readonly groundMaterial: ShaderMaterial;
  private readonly particleMaterial: ShaderMaterial;
  private readonly extent: ReturnType<typeof mapExtent>;
  private readonly maxParticles: number;
  private currentIntensity = 0;
  private currentAccumulation = 0;

  constructor(
    scene: Scene,
    private readonly mapId: MapId,
    quality: Quality = 'high',
  ) {
    this.extent = mapExtent(mapId);
    this.maxParticles = PARTICLE_COUNTS[quality];

    // ── GPU snow particles ──
    const positions = new Float32Array(this.maxParticles * 3);
    const seeds = new Float32Array(this.maxParticles * 2);
    for (let i = 0; i < this.maxParticles; i++) {
      const radius = this.extent.radius;
      positions[i * 3] = (Math.random() * 2 - 1) * radius;
      positions[i * 3 + 1] = Math.random() * 50;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * radius;
      seeds[i * 2] = Math.random() * Math.PI * 2;
      seeds[i * 2 + 1] = 0.6 + Math.random() * 0.8; // fall speed multiplier
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('seed', new Float32BufferAttribute(seeds, 2));
    geometry.boundingSphere = null; // disable frustum culling on these
    this.particleMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      blending: AdditiveBlending,
      uniforms: {
        ...UniformsUtils.clone(UniformsLib.fog!),
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uFallHeight: { value: 50 },
        uRadius: { value: this.extent.radius },
        uCameraPos: { value: { x: 0, y: 0, z: 0 } },
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        attribute vec2 seed;
        uniform float uTime, uIntensity, uFallHeight, uRadius;
        uniform vec3 uCameraPos;
        varying float vAlpha;

        void main() {
          float fallSpeed = seed.y * (3.0 + uIntensity * 5.0);
          float drift = seed.x;

          // Wrap the snowflake around the camera so it always falls nearby
          vec3 p = position;
          p.y = mod(p.y - uTime * fallSpeed, uFallHeight);
          p.x += sin(uTime * 0.5 + drift) * (1.5 + uIntensity * 2.0);
          p.z += cos(uTime * 0.37 + drift * 1.3) * (1.2 + uIntensity * 1.5);

          // Re-center around camera
          p.x = uCameraPos.x + mod(p.x - uCameraPos.x + uRadius, uRadius * 2.0) - uRadius;
          p.z = uCameraPos.z + mod(p.z - uCameraPos.z + uRadius, uRadius * 2.0) - uRadius;
          p.y += uCameraPos.y - uFallHeight * 0.3;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float distance = -mvPosition.z;
          float baseSize = 2.2 + uIntensity * 3.5;
          gl_PointSize = clamp(baseSize * 350.0 / max(1.0, distance), 1.0, 18.0);

          // Fade at top/bottom of column + distance fade
          float heightFade = smoothstep(0.0, 3.0, p.y - uCameraPos.y + uFallHeight * 0.3)
                           * smoothstep(0.0, 4.0, uFallHeight - p.y + uCameraPos.y - uFallHeight * 0.3);
          float distFade = smoothstep(uRadius, uRadius * 0.6, length(p.xz - uCameraPos.xz));
          vAlpha = uIntensity * heightFade * distFade * (0.5 + uIntensity * 0.5);

          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        varying float vAlpha;

        void main() {
          float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
          float soft = 1.0 - smoothstep(0.0, 1.0, r);
          float alpha = soft * vAlpha;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(0.85, 0.9, 0.97, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    this.snowParticles = new Points(geometry, this.particleMaterial);
    this.snowParticles.name = 'snowstorm-particles';
    this.snowParticles.frustumCulled = false;
    this.snowParticles.renderOrder = 100;
    this.group.add(this.snowParticles);

    // ── Ground snow accumulation plane ──
    const groundSize = this.extent.ground;
    const groundGeo = new PlaneGeometry(groundSize, groundSize, 1, 1);
    groundGeo.rotateX(-Math.PI / 2);
    this.groundMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: true,
      uniforms: {
        ...UniformsUtils.clone(UniformsLib.fog!),
        uAccumulation: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform float uAccumulation, uTime;
        varying vec2 vUv;

        // Simple procedural noise for snow texture variation
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // Multi-scale noise for natural snow coverage
          float n1 = noise(vUv * 40.0);
          float n2 = noise(vUv * 80.0 + 12.3);
          float n3 = noise(vUv * 160.0 + uTime * 0.003);
          float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

          // Snow coverage expands with accumulation
          float coverage = smoothstep(1.0 - uAccumulation, 1.0, pattern);
          float alpha = coverage * uAccumulation * 0.72;

          // Slight warm-white tint variation
          vec3 snowColor = mix(
            vec3(0.88, 0.92, 0.98),
            vec3(0.95, 0.97, 1.0),
            n2
          );

          if (alpha < 0.003) discard;
          gl_FragColor = vec4(snowColor, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    this.groundSnow = new Mesh(groundGeo, this.groundMaterial);
    this.groundSnow.name = 'snowstorm-ground';
    this.groundSnow.position.y = this.extent.groundY;
    this.groundSnow.renderOrder = 1;
    this.group.add(this.groundSnow);

    this.group.name = 'SNOWSTORM';
    this.group.visible = false;
    scene.add(this.group);
  }

  /**
   * Called every frame from the game render loop.
   * @param elapsedSeconds  - total elapsed wall time in seconds (from `now / 1000`)
   * @param remainingMs     - milliseconds remaining on the match timer
   * @param cameraPosition  - current camera world position
   */
  update(elapsedSeconds: number, remainingMs: number, cameraPosition: Vector3): void {
    this.currentIntensity = snowstormIntensity(remainingMs);
    this.currentAccumulation = snowAccumulation(remainingMs);
    const isActive = this.currentIntensity > 0;
    this.group.visible = isActive;
    if (!isActive) return;

    // Update particle uniforms
    const pu = this.particleMaterial.uniforms;
    pu.uTime!.value = elapsedSeconds;
    pu.uIntensity!.value = this.currentIntensity;
    pu.uCameraPos!.value = cameraPosition;

    // Adjust visible particle count based on intensity
    const visibleCount = Math.ceil(this.maxParticles * this.currentIntensity);
    this.snowParticles.geometry.setDrawRange(0, visibleCount);

    // Update ground snow uniforms
    const gu = this.groundMaterial.uniforms;
    gu.uAccumulation!.value = this.currentAccumulation;
    gu.uTime!.value = elapsedSeconds;

    // Center ground plane on camera X/Z for infinite-feeling coverage
    this.groundSnow.position.x = cameraPosition.x;
    this.groundSnow.position.z = cameraPosition.z;
  }

  /** Clean up all GPU resources. */
  destroy(): void {
    this.snowParticles.geometry.dispose();
    this.particleMaterial.dispose();
    this.groundSnow.geometry.dispose();
    this.groundMaterial.dispose();
    this.group.removeFromParent();
  }
}
