// Original renderer restored from GitHub commit 87a8893f6b84acc39f9b2df709153abe26079cdd; current FPS adapter.
import * as THREE from 'three';
import { originalTopology } from '@ice-water/shared';
import { OriginalWorldAtmosphere } from './original-world-atmosphere.js';
import { OriginalWorldMaterials } from './original-world-materials.js';
import type { OriginalWorldQuality } from './original-world-lighting.js';
const {
  ARENA,
  BRIDGES,
  isPermanentLand,
  RIVER_BRANCHES,
  ROUTE_CORRIDORS,
  SEA_LEVEL,
  terrainHeightAt,
  WATER_BOTTOM,
  WORLD_MAX,
  WORLD_MIN,
} = originalTopology;
import type { Position } from '@ice-water/shared';

const PALETTE = {
  ocean: 0xbedbe8,
  seabed: 0x526f6c,
  river: 0x719fae,
  grass: 0x688e6d,
  meadow: 0x94af70,
  forest: 0x284e3b,
  crystal: 0x666785,
  snow: 0xdff7ff,
  sand: 0xffdc9f,
  cliff: 0x87928f,
  path: 0xad9977,
  wood: 0xa96d46,
  woodDark: 0x70442f,
  ice: 0x8ca8c8,
  crystalBlue: 0x5ea8ff,
  crystalDeep: 0x4056d8,
  leaf: 0x234638,
  leafLight: 0x47684b,
  trunk: 0x8e6244,
  flower: 0xff8d7a,
} as const;

const TERRAIN_STEP = 3.125;
const CLIFF_BOTTOM = WATER_BOTTOM;
// River cells are removed by their center point, so a removed square can reach
// more than half its diagonal beyond the authored channel. This overlap closes
// that grid-sized bank gap and leaves room for the player's collision radius.
const RIVER_SUPPORT_WIDTH = 10.4;

function addTriangle(
  positions: number[],
  colors: number[],
  indices: number[],
  vertices: Map<string, number>,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  color: THREE.Color,
  isTop = false,
): void {
  for (const vertex of [a, b, c]) {
    const vertexColor = isTop ? surfaceColor(vertex.x, vertex.z, vertex.y) : color;
    const colorKey = vertexColor.getHex();
    // Position and face color define a render vertex. This welds the many
    // duplicate grid vertices while retaining separate cliff/top normals.
    const key = `${Math.round(vertex.x * 1000)},${Math.round(vertex.y * 1000)},${Math.round(
      vertex.z * 1000,
    )},${colorKey}`;
    let index = vertices.get(key);
    if (index === undefined) {
      index = positions.length / 3;
      vertices.set(key, index);
      positions.push(vertex.x, vertex.y, vertex.z);
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
    indices.push(index);
  }
}

export function surfaceColor(x: number, z: number, elevation: number): THREE.Color {
  const smooth = THREE.MathUtils.smoothstep;
  const color = new THREE.Color(PALETTE.grass);
  color.lerp(new THREE.Color(PALETTE.meadow), smooth(z, 22, 48));
  color.lerp(new THREE.Color(PALETTE.forest), (1 - smooth(x, -45, -22)) * (1 - smooth(z, 12, 43)));
  color.lerp(new THREE.Color(PALETTE.crystal), smooth(x, 24, 52) * (1 - smooth(z, 15, 42)));
  const frost = Math.max(1 - smooth(z, -75, -46), smooth(elevation, 28, 52));
  color.lerp(new THREE.Color(0x768696), frost);
  // Broken snow patches preserve dark rock and the moon-facing mountain facets.
  const patch = 0.5 + 0.5 * Math.sin(x * 0.18 + Math.sin(z * 0.24)) * Math.cos(z * 0.16);
  color.lerp(new THREE.Color(PALETTE.snow), frost * smooth(patch, 0.3, 0.85) * 0.8);
  color.lerp(new THREE.Color(PALETTE.sand), Math.max(smooth(z, 78, 103), 1 - smooth(elevation, 2.4, 5)));
  return color.multiplyScalar(0.96 + Math.sin(x * 0.65) * Math.cos(z * 0.57) * 0.04);
}

function hasTerrainCell(position: Position): boolean {
  return (
    position.x >= WORLD_MIN &&
    position.x < WORLD_MAX &&
    position.z >= WORLD_MIN &&
    position.z < WORLD_MAX &&
    isPermanentLand(position)
  );
}

export function createTerrainGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vertices = new Map<string, number>();
  const cliffColor = new THREE.Color(PALETTE.cliff);

  for (let x = WORLD_MIN; x < WORLD_MAX; x += TERRAIN_STEP) {
    for (let z = WORLD_MIN; z < WORLD_MAX; z += TERRAIN_STEP) {
      const center = { x: x + TERRAIN_STEP / 2, z: z + TERRAIN_STEP / 2 };
      if (!hasTerrainCell(center)) continue;

      const nw = new THREE.Vector3(x, terrainHeightAt({ x, z }), z);
      const ne = new THREE.Vector3(
        x + TERRAIN_STEP,
        terrainHeightAt({ x: x + TERRAIN_STEP, z }),
        z,
      );
      const se = new THREE.Vector3(
        x + TERRAIN_STEP,
        terrainHeightAt({ x: x + TERRAIN_STEP, z: z + TERRAIN_STEP }),
        z + TERRAIN_STEP,
      );
      const sw = new THREE.Vector3(
        x,
        terrainHeightAt({ x, z: z + TERRAIN_STEP }),
        z + TERRAIN_STEP,
      );
      const color = surfaceColor(center.x, center.z, terrainHeightAt(center));
      addTriangle(positions, colors, indices, vertices, nw, sw, ne, color, true);
      addTriangle(positions, colors, indices, vertices, ne, sw, se, color, true);

      // A closed bottom cap makes every land section a solid volume instead of
      // a top sheet. It is shared by adjacent cells and sits below the sea.
      const bottomNw = new THREE.Vector3(nw.x, CLIFF_BOTTOM, nw.z);
      const bottomNe = new THREE.Vector3(ne.x, CLIFF_BOTTOM, ne.z);
      const bottomSe = new THREE.Vector3(se.x, CLIFF_BOTTOM, se.z);
      const bottomSw = new THREE.Vector3(sw.x, CLIFF_BOTTOM, sw.z);
      addTriangle(positions, colors, indices, vertices, bottomNw, bottomNe, bottomSw, cliffColor);
      addTriangle(positions, colors, indices, vertices, bottomNe, bottomSe, bottomSw, cliffColor);

      const edges: Array<{
        neighbor: Position;
        a: THREE.Vector3;
        b: THREE.Vector3;
      }> = [
        // Boundary edges run opposite the old order so their front faces and
        // computed normals point away from the land volume on every side.
        { neighbor: { x: center.x, z: center.z - TERRAIN_STEP }, a: ne, b: nw },
        { neighbor: { x: center.x + TERRAIN_STEP, z: center.z }, a: se, b: ne },
        { neighbor: { x: center.x, z: center.z + TERRAIN_STEP }, a: sw, b: se },
        { neighbor: { x: center.x - TERRAIN_STEP, z: center.z }, a: nw, b: sw },
      ];
      for (const edge of edges) {
        if (hasTerrainCell(edge.neighbor)) continue;
        const bottomA = new THREE.Vector3(edge.a.x, CLIFF_BOTTOM, edge.a.z);
        const bottomB = new THREE.Vector3(edge.b.x, CLIFF_BOTTOM, edge.b.z);
        addTriangle(positions, colors, indices, vertices, edge.a, bottomA, edge.b, cliffColor);
        addTriangle(positions, colors, indices, vertices, edge.b, bottomA, bottomB, cliffColor);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function ribbonPoints(points: readonly Position[], samplesPerSegment = 5): Position[] {
  const sampled: Position[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    for (let sample = index === 1 ? 0 : 1; sample <= samplesPerSegment; sample += 1) {
      const t = sample / samplesPerSegment;
      sampled.push({
        x: THREE.MathUtils.lerp(start.x, end.x, t),
        z: THREE.MathUtils.lerp(start.z, end.z, t),
      });
    }
  }
  return sampled;
}

function extendRibbonEnds(points: readonly Position[], distance: number): Position[] {
  if (points.length < 2) return [...points];
  const first = points[0]!;
  const second = points[1]!;
  const previous = points[points.length - 2]!;
  const last = points[points.length - 1]!;
  const firstLength = Math.max(0.001, Math.hypot(second.x - first.x, second.z - first.z));
  const lastLength = Math.max(0.001, Math.hypot(last.x - previous.x, last.z - previous.z));
  return [
    {
      x: first.x - ((second.x - first.x) / firstLength) * distance,
      z: first.z - ((second.z - first.z) / firstLength) * distance,
    },
    ...points,
    {
      x: last.x + ((last.x - previous.x) / lastLength) * distance,
      z: last.z + ((last.z - previous.z) / lastLength) * distance,
    },
  ];
}

function createRibbonGeometry(
  points: readonly Position[],
  width: number,
  elevation: (point: Position) => number,
): THREE.BufferGeometry {
  const samples = ribbonPoints(points);
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    if (!current || !previous || !next) continue;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const sideX = (-dz / length) * (width / 2);
    const sideZ = (dx / length) * (width / 2);
    const y = elevation(current);
    positions.push(
      current.x + sideX,
      y,
      current.z + sideZ,
      current.x - sideX,
      y,
      current.z - sideZ,
    );
    const v = index / Math.max(1, samples.length - 1);
    uvs.push(0, v, 1, v);
  }

  const indices: number[] = [];
  for (let index = 0; index < samples.length - 1; index += 1) {
    const offset = index * 2;
    // Face upward so paths and rivers render correctly with normal front-face
    // culling instead of relying on a double-sided material.
    indices.push(offset, offset + 2, offset + 1, offset + 2, offset + 3, offset + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Closed shallow volume used for water channels instead of an open top sheet. */
function createRibbonVolumeGeometry(
  points: readonly Position[],
  width: number,
  elevation: (point: Position) => number,
  bottomElevation: (point: Position, top: number) => number,
): THREE.BufferGeometry {
  const samples = ribbonPoints(points);
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index];
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    if (!current || !previous || !next) continue;
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const sideX = (-dz / length) * (width / 2);
    const sideZ = (dx / length) * (width / 2);
    const top = elevation(current);
    const left = { x: current.x + sideX, z: current.z + sideZ };
    const right = { x: current.x - sideX, z: current.z - sideZ };
    const bottomLeft = bottomElevation(left, top);
    const bottomRight = bottomElevation(right, top);
    positions.push(
      left.x,
      top,
      left.z,
      right.x,
      top,
      right.z,
      left.x,
      bottomLeft,
      left.z,
      right.x,
      bottomRight,
      right.z,
    );
    const v = index / Math.max(1, samples.length - 1);
    uvs.push(0, v, 1, v, 0, v, 1, v);
  }

  const topIndices: number[] = [];
  const shellIndices: number[] = [];
  for (let index = 0; index < samples.length - 1; index += 1) {
    const offset = index * 4;
    const next = offset + 4;
    topIndices.push(offset, next, offset + 1, next, next + 1, offset + 1);
    // Bottom, left and right faces. Every winding points out of the volume.
    shellIndices.push(
      offset + 2,
      offset + 3,
      next + 2,
      offset + 3,
      next + 3,
      next + 2,
      offset,
      offset + 2,
      next,
      offset + 2,
      next + 2,
      next,
      offset + 1,
      next + 1,
      offset + 3,
      next + 1,
      next + 3,
      offset + 3,
    );
  }
  const end = (samples.length - 1) * 4;
  shellIndices.push(0, 1, 2, 1, 3, 2, end, end + 2, end + 1, end + 1, end + 2, end + 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([...topIndices, ...shellIndices]);
  geometry.addGroup(0, topIndices.length, 0);
  geometry.addGroup(topIndices.length, shellIndices.length, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function riverElevation(point: Position): number {
  const samples = [
    terrainHeightAt({ x: point.x + 3.4, z: point.z }),
    terrainHeightAt({ x: point.x - 3.4, z: point.z }),
    terrainHeightAt({ x: point.x, z: point.z + 3.4 }),
    terrainHeightAt({ x: point.x, z: point.z - 3.4 }),
  ].filter((height) => height > SEA_LEVEL);
  const authoredHeight =
    samples.length === 0
      ? SEA_LEVEL + 0.05
      : Math.max(SEA_LEVEL + 0.05, Math.max(...samples) - 1.05);
  return authoredHeight + 0.08;
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  name: string,
  position?: THREE.Vector3,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  if (position) result.position.copy(position);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function createCrystalGeometry(radius: number, height: number): THREE.BufferGeometry {
  const sideCount = 6;
  const rings = [
    { y: height / 2, radius: 0, rotation: 0.12 },
    { y: height * 0.18, radius: radius * 0.72, rotation: 0.12 },
    { y: -height * 0.06, radius, rotation: 0 },
    { y: -height * 0.34, radius: radius * 0.54, rotation: 0.28 },
    { y: -height / 2, radius: 0, rotation: 0.28 },
  ] as const;
  const positions: number[] = [];
  const colors: number[] = [];
  const facetTints = [0x9ee8ff, 0x67c4ff, 0x4a8ff2, 0x79d8f5, 0x5477dc, 0x8adfff];

  const vertexAt = (ringIndex: number, sideIndex: number): THREE.Vector3 => {
    const ring = rings[ringIndex]!;
    const angle = (sideIndex / sideCount) * Math.PI * 2 + ring.rotation;
    return new THREE.Vector3(Math.cos(angle) * ring.radius, ring.y, Math.sin(angle) * ring.radius);
  };
  const addTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, tint: number) => {
    const color = new THREE.Color(tint);
    for (const vertex of [a, b, c]) {
      positions.push(vertex.x, vertex.y, vertex.z);
      colors.push(color.r, color.g, color.b);
    }
  };

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let sideIndex = 0; sideIndex < sideCount; sideIndex += 1) {
      const nextSide = (sideIndex + 1) % sideCount;
      const upperLeft = vertexAt(ringIndex, sideIndex);
      const upperRight = vertexAt(ringIndex, nextSide);
      const lowerLeft = vertexAt(ringIndex + 1, sideIndex);
      const lowerRight = vertexAt(ringIndex + 1, nextSide);
      const tint = facetTints[(sideIndex + ringIndex * 2) % facetTints.length]!;
      const alternateTint = facetTints[(sideIndex + ringIndex * 2 + 1) % facetTints.length]!;

      if (rings[ringIndex]!.radius === 0) {
        addTriangle(upperLeft, lowerRight, lowerLeft, tint);
        continue;
      }
      if (rings[ringIndex + 1]!.radius === 0) {
        addTriangle(upperLeft, upperRight, lowerLeft, tint);
        continue;
      }
      if ((sideIndex + ringIndex) % 2 === 0) {
        addTriangle(upperLeft, lowerRight, lowerLeft, tint);
        addTriangle(upperLeft, upperRight, lowerRight, alternateTint);
      } else {
        addTriangle(upperLeft, upperRight, lowerLeft, tint);
        addTriangle(upperRight, lowerRight, lowerLeft, alternateTint);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCrystal(
  material: THREE.Material,
  edgeMaterial: THREE.Material,
  radius: number,
  height: number,
): THREE.Mesh {
  const geometry = createCrystalGeometry(radius, height);
  const crystal = mesh(geometry, material, 'crystal-shard');
  const facetLines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 12), edgeMaterial);
  facetLines.name = 'crystal-facet-lines';
  facetLines.renderOrder = 1;
  crystal.add(facetLines);
  return crystal;
}

function createCrystalLight(name: string, intensity: number, distance: number): THREE.PointLight {
  const light = new THREE.PointLight(0x69c8ff, intensity, distance, 2);
  light.name = name;
  // Three bounded, shadowless lights keep the crystals useful on mobile
  // without multiplying shadow-map renders for the entire world.
  light.castShadow = false;
  return light;
}

function createBeachArch(material: THREE.Material): THREE.Group {
  const radius = 7;
  const tube = 1.45;
  const radialSegments = 8;
  const arch = new THREE.Group();
  arch.name = 'LM_BEACH_ARCH';
  arch.add(
    mesh(
      new THREE.TorusGeometry(radius, tube, radialSegments, 20, Math.PI),
      material,
      'beach-arch-body',
    ),
  );
  for (const x of [-radius, radius]) {
    const cap = mesh(
      new THREE.CircleGeometry(tube, radialSegments),
      material,
      'beach-arch-cap',
      new THREE.Vector3(x, 0, 0),
    );
    // Both ends of the upper semicircle terminate toward local -Y. Closing
    // them prevents the landmark from exposing its hollow tube at ground level.
    cap.rotation.x = Math.PI / 2;
    arch.add(cap);
  }
  return arch;
}

function createLandmarks(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WORLD_LANDMARKS';
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.crystalBlue,
    emissive: 0x19bddd,
    emissiveIntensity: 2.8,
    roughness: 0.16,
    metalness: 0.08,
    vertexColors: true,
  });
  const crystalEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0xc8f4ff,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const violetMaterial = crystalMaterial.clone();
  violetMaterial.color.setHex(0x9374ca);
  violetMaterial.emissive.setHex(0x6740c2);
  violetMaterial.emissiveIntensity = 2.1;
  const iceMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.ice,
    emissive: 0x299fb9,
    emissiveIntensity: 0.025,
    roughness: 0.38,
  });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.leaf, roughness: 0.92 });
  const leafLightMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.leafLight,
    roughness: 0.92,
  });
  const creamMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.cliff, roughness: 0.88 });

  const villageCrystal = new THREE.Group();
  villageCrystal.name = 'LM_VILLAGE_CRYSTAL';
  villageCrystal.position.set(0, terrainHeightAt({ x: 0, z: 1 }) + 3.4, 1);
  for (const [x, z, scale, tilt] of [
    [0, 0, 2.8, 0],
    [-2, 0.8, 1.5, -0.25],
    [2, 1.1, 1.7, 0.2],
  ] as const) {
    const shard = createCrystal(crystalMaterial, crystalEdgeMaterial, scale, scale * 3.2);
    shard.position.set(x, 0, z);
    shard.rotation.z = tilt;
    villageCrystal.add(shard);
  }
  const villageLight = createCrystalLight('CRYSTAL_LIGHT_VILLAGE', 42, 16);
  villageLight.position.set(0, 1.5, 0);
  villageCrystal.add(villageLight);
  group.add(villageCrystal);

  const ancientTree = new THREE.Group();
  ancientTree.name = 'LM_FOREST_TREE';
  ancientTree.position.set(-65, terrainHeightAt({ x: -65, z: -18 }), -18);
  ancientTree.add(
    mesh(
      new THREE.CylinderGeometry(2.3, 3.5, 15, 7),
      woodMaterial,
      'ancient-trunk',
      new THREE.Vector3(0, 7.5, 0),
    ),
  );
  for (const [x, y, z, scale] of [
    [0, 17, 0, 7],
    [-5, 14, 1, 5],
    [5, 14.5, -1, 5.5],
    [0, 14, 5, 4.5],
  ] as const) {
    const crown = mesh(
      new THREE.IcosahedronGeometry(scale, 1),
      x > 0 ? leafLightMaterial : leafMaterial,
      'ancient-crown',
    );
    crown.position.set(x, y, z);
    crown.scale.y = 0.78;
    ancientTree.add(crown);
  }
  group.add(ancientTree);

  const crystalSpire = new THREE.Group();
  crystalSpire.name = 'LM_CRYSTAL_SPIRE';
  crystalSpire.position.set(69, terrainHeightAt({ x: 69, z: -14 }), -14);
  for (const [x, z, radius, height, tilt] of [
    [0, 0, 3.7, 17, 0.05],
    [-4, 2, 2.2, 10, -0.22],
    [4, 1, 2.5, 12, 0.2],
    [1, -4, 1.8, 8, -0.08],
  ] as const) {
    const shard = createCrystal(x === 0 ? crystalMaterial : violetMaterial, crystalEdgeMaterial, radius, height);
    shard.position.set(x, height / 2, z);
    shard.rotation.z = tilt;
    crystalSpire.add(shard);
  }
  const spireLight = createCrystalLight('CRYSTAL_LIGHT_SPIRE', 78, 23);
  spireLight.position.set(0, 5, 0);
  crystalSpire.add(spireLight);
  group.add(crystalSpire);

  const iceSummit = new THREE.Group();
  iceSummit.name = 'LM_ICE_SUMMIT';
  for (const [x, z, radius, height] of [
    [10, -91, 9, 23],
    [-2, -88, 7, 17],
    [21, -96, 6, 15],
  ] as const) {
    const base = terrainHeightAt({ x, z });
    const peak = mesh(
      new THREE.ConeGeometry(radius, height, 7),
      iceMaterial,
      'ice-peak',
      new THREE.Vector3(x, base + height / 2, z),
    );
    peak.rotation.y = x * 0.07;
    iceSummit.add(peak);
  }
  group.add(iceSummit);

  const windmill = new THREE.Group();
  windmill.name = 'LM_MEADOW_WINDMILL';
  windmill.position.set(-21, terrainHeightAt({ x: -21, z: 62 }), 62);
  windmill.add(
    mesh(
      new THREE.CylinderGeometry(2.1, 3.1, 10, 8),
      creamMaterial,
      'windmill-tower',
      new THREE.Vector3(0, 5, 0),
    ),
  );
  const roof = mesh(
    new THREE.ConeGeometry(3.5, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0xd88465, roughness: 0.85 }),
    'windmill-roof',
    new THREE.Vector3(0, 11, 0),
  );
  windmill.add(roof);
  const hub = new THREE.Group();
  hub.position.set(0, 8.5, 3.1);
  for (let index = 0; index < 4; index += 1) {
    const blade = mesh(new THREE.BoxGeometry(0.7, 7, 0.32), woodMaterial, 'windmill-blade');
    blade.position.y = 3.2;
    blade.rotation.z = (index * Math.PI) / 2;
    hub.add(blade);
  }
  windmill.add(hub);
  group.add(windmill);

  const beachArch = createBeachArch(creamMaterial);
  beachArch.position.set(35, terrainHeightAt({ x: 35, z: 103 }) + 0.3, 103);
  beachArch.rotation.y = Math.PI / 2;
  group.add(beachArch);

  const moonstone = createCrystal(crystalMaterial, crystalEdgeMaterial, 2.2, 7);
  moonstone.name = 'LM_ISLAND_MOONSTONE';
  moonstone.position.set(37, terrainHeightAt({ x: 37, z: 116 }) + 3.5, 116);
  const moonstoneLight = createCrystalLight('CRYSTAL_LIGHT_MOONSTONE', 30, 13);
  moonstoneLight.position.copy(moonstone.position).add(new THREE.Vector3(0, 1.5, 0));
  group.add(moonstone, moonstoneLight);

  return group;
}

function createBridge(id: string, x: number, z: number, width: number, depth: number): THREE.Group {
  const bridge = new THREE.Group();
  bridge.name = id;
  const isHorizontal = width > depth;
  const length = Math.max(width, depth);
  const crossWidth = Math.min(width, depth);
  const y = terrainHeightAt({ x, z }) + 0.36;
  bridge.position.set(x, y, z);
  const wood = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 });
  const rope = new THREE.MeshStandardMaterial({ color: PALETTE.woodDark, roughness: 1 });
  const boardCount = Math.max(3, Math.floor(length / 1.2));
  for (let index = 0; index < boardCount; index += 1) {
    const offset = -length / 2 + ((index + 0.5) * length) / boardCount;
    const board = mesh(
      new THREE.BoxGeometry(
        isHorizontal ? length / boardCount - 0.08 : crossWidth,
        0.32,
        isHorizontal ? crossWidth : length / boardCount - 0.08,
      ),
      wood,
      `${id}-board-${index}`,
    );
    board.position.set(isHorizontal ? offset : 0, 0, isHorizontal ? 0 : offset);
    bridge.add(board);
  }
  for (const side of [-1, 1]) {
    const rail = mesh(new THREE.CylinderGeometry(0.12, 0.12, length, 6), rope, `${id}-rail`);
    rail.rotation.z = isHorizontal ? Math.PI / 2 : 0;
    rail.rotation.x = isHorizontal ? 0 : Math.PI / 2;
    rail.position.set(
      isHorizontal ? 0 : side * crossWidth * 0.46,
      0.95,
      isHorizontal ? side * crossWidth * 0.46 : 0,
    );
    bridge.add(rail);
  }
  return bridge;
}

function createWaterfall(
  id: string,
  top: THREE.Vector3,
  bottom: THREE.Vector3,
  width: number,
  material: THREE.Material,
): THREE.Mesh {
  const height = top.distanceTo(bottom);
  const waterfall = mesh(new THREE.PlaneGeometry(width, height, 5, 8), material, id);
  waterfall.position.copy(top).add(bottom).multiplyScalar(0.5);
  // The old vertical sheet missed both authored endpoints in Z. Align its
  // local Y axis to the actual flow so it visibly meets the existing river.
  waterfall.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize());
  waterfall.castShadow = false;
  return waterfall;
}

function createBlockoutDetails(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WORLD_BLOCKOUT_DETAILS';
  const trunk = new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 0.95 });
  const leaf = new THREE.MeshStandardMaterial({ color: PALETTE.leafLight, roughness: 0.9 });
  const flower = new THREE.MeshStandardMaterial({ color: PALETTE.flower, roughness: 0.8 });
  const treePoints: readonly [number, number][] = [
    [-84, -24],
    [-76, -39],
    [-71, 2],
    [-55, -38],
    [-49, 8],
    [-91, -6],
    [-39, -25],
    [47, -17],
    [81, -35],
    [91, -4],
    [75, 13],
    [51, 17],
  ];
  for (const [x, z] of treePoints) {
    const y = terrainHeightAt({ x, z });
    const tree = new THREE.Group();
    tree.name = 'placeholder-tree';
    tree.position.set(x, y, z);
    tree.add(
      mesh(
        new THREE.CylinderGeometry(0.65, 0.9, 4.5, 6),
        trunk,
        'tree-trunk',
        new THREE.Vector3(0, 2.25, 0),
      ),
    );
    const crown = mesh(
      new THREE.IcosahedronGeometry(2.6, 1),
      leaf,
      'tree-crown',
      new THREE.Vector3(0, 5.2, 0),
    );
    crown.scale.y = 1.25;
    tree.add(crown);
    group.add(tree);
  }
  for (const [x, z] of [
    [-30, 56],
    [-14, 45],
    [13, 65],
    [24, 51],
    [-19, 77],
  ] as const) {
    const bloom = mesh(new THREE.IcosahedronGeometry(0.65, 0), flower, 'placeholder-flower');
    bloom.position.set(x, terrainHeightAt({ x, z }) + 0.75, z);
    group.add(bloom);
  }
  return group;
}

export class OriginalWorldMap {
  readonly group = new THREE.Group();
  private readonly style = new OriginalWorldMaterials();
  private atmosphere?: OriginalWorldAtmosphere;
  private boundary = new THREE.Group();
  private readonly waterMaterial = new THREE.MeshPhysicalMaterial({
    color: PALETTE.river,
    transparent: true,
    opacity: 0.76,
    roughness: 0.18,
    metalness: 0,
    transmission: 0,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  private currentHalfExtent: number;

  constructor(
    private readonly scene: THREE.Scene,
    halfExtent: number = WORLD_MAX,
  ) {
    this.currentHalfExtent = halfExtent;
    this.group.name = 'WORLD_ROOT';
    this.scene.add(this.group);
    this.build();
  }

  update(elapsedSeconds: number, camera = this.group.position, quality: OriginalWorldQuality = 'high'): void {
    this.style.time.value = quality === 'low' ? 0 : elapsedSeconds;
    this.style.motion.value = quality === 'low' ? 0 : 1;
    this.atmosphere?.update(elapsedSeconds, camera, quality);
  }

  destroy(): void {
    this.scene.remove(this.group);
    this.disposeObject(this.group);
    this.style.destroy();
  }

  private build(): void {
    const oceanDepth = SEA_LEVEL - WATER_BOTTOM;
    const oceanMaterial = new THREE.MeshPhysicalMaterial({
      color: PALETTE.ocean,
      roughness: 0.22,
      transparent: true,
      opacity: 0.86,
      transmission: 0,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const ocean = mesh(
      new THREE.CylinderGeometry(205, 205, oceanDepth, 64, 1, false),
      oceanMaterial,
      'OCEAN',
      new THREE.Vector3(0, WATER_BOTTOM + oceanDepth / 2, 0),
    );
    ocean.castShadow = false;
    ocean.receiveShadow = true;

    // The closed ocean column has outward faces. A separate downward-facing
    // surface lets submerged cameras see the waterline without DoubleSide.
    const undersideMaterial = oceanMaterial.clone();
    undersideMaterial.color.setHex(0x218fa8);
    undersideMaterial.opacity = 0.68;
    const underside = mesh(
      new THREE.CircleGeometry(205, 64),
      undersideMaterial,
      'OCEAN_UNDERSIDE',
      new THREE.Vector3(0, SEA_LEVEL - 0.015, 0),
    );
    underside.rotation.x = Math.PI / 2;
    underside.castShadow = false;
    underside.renderOrder = 2;

    const seabed = mesh(
      new THREE.CylinderGeometry(205, 205, 0.3, 64),
      new THREE.MeshStandardMaterial({ color: PALETTE.seabed, roughness: 0.98 }),
      'OCEAN_FLOOR',
      new THREE.Vector3(0, WATER_BOTTOM - 0.15, 0),
    );
    seabed.castShadow = false;
    seabed.receiveShadow = true;
    this.group.add(ocean, underside, seabed);
    this.style.apply(oceanMaterial, 'ocean');
    this.style.apply(undersideMaterial, 'water');
    this.style.apply(this.waterMaterial, 'water');

    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.91,
      metalness: 0,
      side: THREE.FrontSide,
    });
    this.style.apply(terrainMaterial, 'ground');
    this.group.add(mesh(createTerrainGeometry(), terrainMaterial, 'TERRAIN_BLOCKOUT'));

    const pathMaterial = new THREE.MeshStandardMaterial({
      color: PALETTE.path,
      roughness: 0.96,
      side: THREE.FrontSide,
    });
    for (const route of ROUTE_CORRIDORS) {
      const path = mesh(
        createRibbonGeometry(
          route.points,
          Math.min(5.2, route.width * 0.62),
          (point) => terrainHeightAt(point) + 0.1,
        ),
        pathMaterial,
        route.id,
      );
      path.receiveShadow = true;
      path.castShadow = false;
      this.group.add(path);
    }

    const riverbankMaterial = new THREE.MeshStandardMaterial({
      color: 0x596c70,
      roughness: 0.48,
      metalness: 0,
      side: THREE.FrontSide,
    });
    this.style.apply(riverbankMaterial, 'rock');
    for (const branch of RIVER_BRANCHES) {
      // Transparent water needs a real upward-facing bed beneath it. The
      // volume's exterior bottom correctly faces downward, so it is culled
      // when viewed through the surface and cannot double as the visible bed.
      // Keeping this bed close to the authored surface makes steep channel
      // transitions read as water over solid terrain instead of empty glass.
      const riverbed = mesh(
        createRibbonVolumeGeometry(
          extendRibbonEnds(branch, TERRAIN_STEP + 0.5),
          RIVER_SUPPORT_WIDTH,
          (point) => riverElevation(point) - 0.32,
          (point, top) =>
            Math.max(WATER_BOTTOM, Math.min(top - 0.18, terrainHeightAt(point) - 0.04)),
        ),
        [riverbankMaterial, riverbankMaterial],
        'RIVERBED_NETWORK',
      );
      riverbed.receiveShadow = true;
      const river = mesh(
        createRibbonVolumeGeometry(branch, 4.6, riverElevation, (point, top) =>
          Math.max(WATER_BOTTOM, Math.min(top - 0.18, terrainHeightAt(point) - 0.04)),
        ),
        [this.waterMaterial, riverbankMaterial],
        'WATER_NETWORK',
      );
      river.renderOrder = 2;
      river.castShadow = false;
      riverbed.castShadow = false;
      this.group.add(riverbed, river);
    }

    for (const bridge of BRIDGES)
      this.group.add(createBridge(bridge.id, bridge.x, bridge.z, bridge.width, bridge.depth));

    const waterfallMaterial = this.waterMaterial.clone();
    waterfallMaterial.opacity = 0.84;
    waterfallMaterial.side = THREE.DoubleSide;
    this.style.apply(waterfallMaterial, 'waterfall');
    this.group.add(
      createWaterfall(
        'WF_MOUNTAIN_01',
        new THREE.Vector3(20, 45, -65),
        new THREE.Vector3(20, 23, -55),
        7,
        waterfallMaterial,
      ),
    );
    this.group.add(
      createWaterfall(
        'WF_CRYSTAL_01',
        new THREE.Vector3(60, 22, -15),
        new THREE.Vector3(60, 17, -5),
        5,
        waterfallMaterial,
      ),
    );

    this.group.add(createLandmarks(), createBlockoutDetails());
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      if (!(object.material instanceof THREE.MeshStandardMaterial)) return;
      if (object.name === 'ice-peak' || object.name.startsWith('beach-arch')) this.style.apply(object.material, 'rock');
      if (object.name.includes('trunk') || object.name.includes('board')) this.style.apply(object.material, 'wood');
    });
    // Restore the original authored village cover as visible solid geometry.
    const coverMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 });
    this.style.apply(coverMaterial, 'wood');
    const coverStone = new THREE.MeshStandardMaterial({ color: 0x7d8684, roughness: 0.85 });
    this.style.apply(coverStone, 'rock');
    for (const block of ARENA.blocks.filter((block) => block.id.startsWith('COVER_'))) {
      this.group.add(
        mesh(
          new THREE.BoxGeometry(block.width, block.height, block.depth),
          block.width > 4 || block.x > 0 && block.z < 0 ? coverStone : coverMaterial,
          block.id,
          new THREE.Vector3(block.x, terrainHeightAt(block) + block.height / 2, block.z),
        ),
      );
    }
    this.boundary = this.createBoundary(this.currentHalfExtent);
    this.group.add(this.boundary);
    this.atmosphere = new OriginalWorldAtmosphere();
    this.group.add(this.atmosphere.group);
  }

  private createBoundary(halfExtent: number): THREE.Group {
    const boundary = new THREE.Group();
    boundary.name = 'MAGICAL_FROST_BOUNDARY';
    const material = new THREE.MeshBasicMaterial({
      color: 0x9beaff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const height = 72;
    const thickness = 0.35;
    const size = halfExtent * 2;
    for (const [x, z, width, depth] of [
      [0, -halfExtent, size, thickness],
      [0, halfExtent, size, thickness],
      [-halfExtent, 0, thickness, size],
      [halfExtent, 0, thickness, size],
    ] as const) {
      const wall = mesh(new THREE.BoxGeometry(width, height, depth), material, 'frost-wall');
      wall.position.set(x, height / 2, z);
      wall.renderOrder = 3;
      wall.castShadow = false;
      wall.receiveShadow = false;
      boundary.add(wall);
    }
    return boundary;
  }

  private disposeObject(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const allMaterials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments) && !(object instanceof THREE.Points)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) allMaterials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    allMaterials.forEach(material => material.dispose());
  }
}

export function worldHeightAt(x: number, z: number): number {
  return terrainHeightAt({ x, z });
}

export const WORLD_CAMERA_FAR = Math.max(420, ARENA.halfExtent * 4);
