import {
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';

export type OriginalWorldQuality = 'low' | 'medium' | 'high';

/** One bounded shadow pass; local emissive accents never add shadow passes. */
export class OriginalWorldLighting {
  readonly group = new Group();
  readonly moon = new DirectionalLight(0xb8c9ff, 2.05);
  readonly moonDisc = createMoonDisc();
  private quality?: OriginalWorldQuality;
  private readonly offset = new Vector3(-70, 100, -50);
  private readonly direction = this.offset.clone().normalize();
  private readonly right = new Vector3()
    .crossVectors(new Vector3(0, 1, 0), this.direction)
    .normalize();
  private readonly up = new Vector3().crossVectors(this.direction, this.right);

  constructor() {
    this.group.name = 'ORIGINAL_NIGHT_LIGHTING';
    this.moon.name = 'moonlight';
    this.moon.position.copy(this.offset);
    this.moon.shadow.camera.left = -48;
    this.moon.shadow.camera.right = 48;
    this.moon.shadow.camera.top = 48;
    this.moon.shadow.camera.bottom = -48;
    // Includes the elevated northern casters when the player is in the village.
    this.moon.shadow.camera.near = 1;
    this.moon.shadow.camera.far = 250;
    this.moon.shadow.bias = -0.00015;
    this.moon.shadow.normalBias = 0.12;
    this.group.add(
      this.moonDisc,
      this.moon,
      this.moon.target,
      new HemisphereLight(0x718cc4, 0x172019, 0.72),
    );
  }

  update(position: Vector3, quality: OriginalWorldQuality): void {
    if (quality !== this.quality) {
      this.quality = quality;
      this.moon.castShadow = quality !== 'low';
      const size = quality === 'high' ? 2048 : 1024;
      this.moon.shadow.mapSize.set(size, size);
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null;
      this.moon.shadow.needsUpdate = true;
    }
    // Snap in light-space to keep shadow texels stable while walking.
    const texel = 96 / this.moon.shadow.mapSize.x;
    const target = this.moon.target.position;
    target.copy(position);
    target.addScaledVector(
      this.right,
      Math.round(position.dot(this.right) / texel) * texel - position.dot(this.right),
    );
    target.addScaledVector(
      this.up,
      Math.round(position.dot(this.up) / texel) * texel - position.dot(this.up),
    );
    this.moon.position.copy(target).add(this.offset);
    this.moon.target.updateMatrixWorld();
    this.moonDisc.position.copy(position).addScaledVector(this.direction, 240);
    this.moonDisc.lookAt(position);
  }

  destroy(): void {
    this.moonDisc.geometry.dispose();
    this.moonDisc.material.dispose();
    this.moon.dispose();
    this.group.removeFromParent();
  }
}

function createMoonDisc(): Mesh<PlaneGeometry, ShaderMaterial> {
  const moon = new Mesh(
    new PlaneGeometry(28, 28),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
          vec2 point = vUv - 0.5;
          float radius = length(point);
          float body = 1.0 - smoothstep(0.285, 0.3, radius);
          float halo = (1.0 - smoothstep(0.3, 0.5, radius)) * 0.24;

          float basin = 1.0 - smoothstep(0.035, 0.095, distance(vUv, vec2(0.42, 0.59)));
          float mare = 1.0 - smoothstep(0.055, 0.14, distance(vUv, vec2(0.59, 0.43)));
          float rim = 1.0 - smoothstep(0.018, 0.048, distance(vUv, vec2(0.55, 0.64)));
          float markings = clamp(basin * 0.12 + mare * 0.09 - rim * 0.05, 0.0, 0.15);

          vec3 moonColor = mix(vec3(0.82, 0.87, 1.0), vec3(1.0, 0.98, 0.9), 0.58);
          moonColor -= markings;
          vec3 haloColor = vec3(0.58, 0.7, 1.0);
          float alpha = body + halo * (1.0 - body);
          vec3 color = mix(haloColor, moonColor, body);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    }),
  );
  moon.name = 'ORIGINAL_SKY_MOON';
  moon.renderOrder = -100;
  moon.frustumCulled = false;
  return moon;
}
