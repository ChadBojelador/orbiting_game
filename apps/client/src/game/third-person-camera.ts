export interface CameraPoint {
  x: number;
  y: number;
  z: number;
}

export interface CameraObstacle {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface CameraPose {
  position: CameraPoint;
  target: CameraPoint;
  yaw: number;
  pitch: number;
  distance: number;
}

interface ThirdPersonCameraOptions {
  distance: number;
  minDistance: number;
  defaultPitch: number;
  minPitch: number;
  maxPitch: number;
  orbitSensitivity: number;
  rotationDamping: number;
  returnDamping: number;
  collisionPadding: number;
  groundClearance: number;
}

const DEFAULT_OPTIONS: ThirdPersonCameraOptions = {
  distance: 11.5,
  minDistance: 2,
  defaultPitch: Math.PI / 6,
  minPitch: Math.PI / 12,
  maxPitch: Math.PI * 0.42,
  orbitSensitivity: 0.01,
  rotationDamping: 14,
  returnDamping: 7,
  collisionPadding: 0.25,
  groundClearance: 0.35,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function damp(current: number, target: number, rate: number, seconds: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * Math.max(0, seconds)));
}

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Returns the first normalized hit distance along a segment, or undefined on a miss. */
export function segmentAabbHit(
  start: CameraPoint,
  end: CameraPoint,
  obstacle: CameraObstacle,
  padding = 0,
): number | undefined {
  let near = 0;
  let far = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const min = obstacle[`min${axis.toUpperCase() as 'X' | 'Y' | 'Z'}`] - padding;
    const max = obstacle[`max${axis.toUpperCase() as 'X' | 'Y' | 'Z'}`] + padding;
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < min || start[axis] > max) return undefined;
      continue;
    }
    const first = (min - start[axis]) / delta;
    const second = (max - start[axis]) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return undefined;
  }
  return near;
}

export class ThirdPersonCamera {
  private readonly options: ThirdPersonCameraOptions;
  private yaw = 0;
  private targetYaw = 0;
  private pitch: number;
  private targetPitch: number;
  private currentDistance: number;

  constructor(options: Partial<ThirdPersonCameraOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.pitch = this.options.defaultPitch;
    this.targetPitch = this.pitch;
    this.currentDistance = this.options.distance;
  }

  orbit(deltaX: number, deltaY: number): void {
    this.targetYaw -= deltaX * this.options.orbitSensitivity;
    this.targetPitch = clamp(
      this.targetPitch + deltaY * this.options.orbitSensitivity,
      this.options.minPitch,
      this.options.maxPitch,
    );
  }

  update(
    target: CameraPoint,
    seconds: number,
    obstacles: readonly CameraObstacle[],
    groundHeightAt: (x: number, z: number) => number = () => 0,
  ): CameraPose {
    const rotationAlpha = 1 - Math.exp(-this.options.rotationDamping * Math.max(0, seconds));
    this.yaw += shortestAngle(this.yaw, this.targetYaw) * rotationAlpha;
    this.pitch = damp(this.pitch, this.targetPitch, this.options.rotationDamping, seconds);

    const horizontalDistance = Math.cos(this.pitch) * this.options.distance;
    const desired = {
      x: target.x + Math.sin(this.yaw) * horizontalDistance,
      y: target.y + Math.sin(this.pitch) * this.options.distance,
      z: target.z + Math.cos(this.yaw) * horizontalDistance,
    };

    let hitFraction = 1;
    for (const obstacle of obstacles) {
      const hit = segmentAabbHit(target, desired, obstacle, this.options.collisionPadding);
      if (hit !== undefined) hitFraction = Math.min(hitFraction, hit);
    }
    for (let step = 1; step <= 12; step++) {
      const fraction = step / 12;
      const x = target.x + (desired.x - target.x) * fraction;
      const y = target.y + (desired.y - target.y) * fraction;
      const z = target.z + (desired.z - target.z) * fraction;
      if (y >= groundHeightAt(x, z) + this.options.groundClearance) continue;
      hitFraction = Math.min(hitFraction, (step - 1) / 12);
      break;
    }
    const collisionDistance = clamp(
      hitFraction < 1
        ? this.options.distance * hitFraction - this.options.collisionPadding
        : this.options.distance,
      this.options.minDistance,
      this.options.distance,
    );
    this.currentDistance =
      collisionDistance < this.currentDistance
        ? collisionDistance
        : damp(this.currentDistance, collisionDistance, this.options.returnDamping, seconds);

    const horizontal = Math.cos(this.pitch) * this.currentDistance;
    const position = {
      x: target.x + Math.sin(this.yaw) * horizontal,
      y: target.y + Math.sin(this.pitch) * this.currentDistance,
      z: target.z + Math.cos(this.yaw) * horizontal,
    };
    position.y = Math.max(
      position.y,
      groundHeightAt(position.x, position.z) + this.options.groundClearance,
    );

    return {
      position,
      target: { ...target },
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.currentDistance,
    };
  }
}
