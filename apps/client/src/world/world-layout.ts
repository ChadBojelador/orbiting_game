import * as THREE from 'three';
import {
  ARENA,
  BRIDGES,
  isPermanentLand,
  RIVER_BRANCHES,
  ROUTE_CORRIDORS,
  SEA_LEVEL,
  terrainHeightAt,
  WORLD_MAX,
  WORLD_MIN,
  type Position,
} from '@ice-water/shared';

const PALETTE = {
  ocean: 0x35cddd,
  river: 0x64e7ef,
  grass: 0x79d49a,
  meadow: 0xa8df7e,
  forest: 0x4fa879,
  crystal: 0x75cbc1,
  snow: 0xdff7ff,
  sand: 0xffdc9f,
  cliff: 0xfff1d1,
  path: 0xf5c995,
  wood: 0xa96d46,
  woodDark: 0x70442f,
  ice: 0x7eebff,
  crystalBlue: 0x5ea8ff,
  crystalDeep: 0x4056d8,
  leaf: 0x4a9e68,
  leafLight: 0x86d475,
  trunk: 0x8e6244,
  flower: 0xff8d7a,
} as const;

const TERRAIN_STEP = 3.125;
const CLIFF_BOTTOM = SEA_LEVEL - 0.55;

function addTriangle(
  positions: number[],
  colors: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  color: THREE.Color,
): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let index = 0; index < 3; index += 1) colors.push(color.r, color.g, color.b);
}

function surfaceColor(x: number, z: number, elevation: number): THREE.Color {
  if (z > 88 || elevation < 4) return new THREE.Color(PALETTE.sand);
  if (z > 118 && elevation > 9) return new THREE.Color(PALETTE.cliff);
  if (z < -55 || elevation > 35) return new THREE.Color(PALETTE.snow);
  if (x < -28 && z < 24) return new THREE.Color(PALETTE.forest);
  if (x > 30 && z < 26) return new THREE.Color(PALETTE.crystal);
  if (z > 30) return new THREE.Color(PALETTE.meadow);
  return new THREE.Color(PALETTE.grass);
}

function createTerrainGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const cliffColor = new THREE.Color(PALETTE.cliff);

  for (let x = WORLD_MIN; x < WORLD_MAX; x += TERRAIN_STEP) {
    for (let z = WORLD_MIN; z < WORLD_MAX; z += TERRAIN_STEP) {
      const center = { x: x + TERRAIN_STEP / 2, z: z + TERRAIN_STEP / 2 };
      if (!isPermanentLand(center)) continue;

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
      addTriangle(positions, colors, nw, sw, ne, color);
      addTriangle(positions, colors, ne, sw, se, color);

      const edges: Array<{
        neighbor: Position;
        a: THREE.Vector3;
        b: THREE.Vector3;
      }> = [
        { neighbor: { x: center.x, z: center.z - TERRAIN_STEP }, a: nw, b: ne },
        { neighbor: { x: center.x + TERRAIN_STEP, z: center.z }, a: ne, b: se },
        { neighbor: { x: center.x, z: center.z + TERRAIN_STEP }, a: se, b: sw },
        { neighbor: { x: center.x - TERRAIN_STEP, z: center.z }, a: sw, b: nw },
      ];
      for (const edge of edges) {
        if (isPermanentLand(edge.neighbor)) continue;
        const bottomA = new THREE.Vector3(edge.a.x, CLIFF_BOTTOM, edge.a.z);
        const bottomB = new THREE.Vector3(edge.b.x, CLIFF_BOTTOM, edge.b.z);
        addTriangle(positions, colors, edge.a, bottomA, edge.b, cliffColor);
        addTriangle(positions, colors, edge.b, bottomA, bottomB, cliffColor);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
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
    indices.push(offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function riverElevation(point: Position): number {
  const samples = [
    terrainHeightAt({ x: point.x + 3.4, z: point.z }),
    terrainHeightAt({ x: point.x - 3.4, z: point.z }),
    terrainHeightAt({ x: point.x, z: point.z + 3.4 }),
    terrainHeightAt({ x: point.x, z: point.z - 3.4 }),
  ].filter((height) => height > SEA_LEVEL);
  if (samples.length === 0) return SEA_LEVEL + 0.05;
  return Math.max(SEA_LEVEL + 0.05, Math.max(...samples) - 1.05);
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
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

function createCrystal(material: THREE.Material, radius: number, height: number): THREE.Mesh {
  const crystal = mesh(new THREE.OctahedronGeometry(radius, 0), material, 'crystal-shard');
  crystal.scale.y = height / (radius * 2);
  return crystal;
}

function createLandmarks(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'WORLD_LANDMARKS';
  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.crystalBlue,
    emissive: PALETTE.crystalDeep,
    emissiveIntensity: 0.22,
    roughness: 0.28,
    metalness: 0.05,
  });
  const iceMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.ice,
    emissive: 0x299fb9,
    emissiveIntensity: 0.16,
    roughness: 0.32,
  });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.leaf, roughness: 0.92 });
  const leafLightMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.leafLight,
    roughness: 0.92,
  });
  const creamMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.cliff, roughness: 0.88 });

  const addOuterLandmark = (
    name: string,
    x: number,
    z: number,
    material: THREE.Material,
    height: number,
    radius: number,
  ): void => {
    const landmark = new THREE.Group();
    landmark.name = name;
    const base = terrainHeightAt({ x, z });
    landmark.position.set(x, base, z);
    landmark.add(
      mesh(
        new THREE.CylinderGeometry(radius * 0.72, radius, height * 0.62, 7),
        material,
        `${name}-base`,
        new THREE.Vector3(0, height * 0.31, 0),
      ),
    );
    landmark.add(
      mesh(
        new THREE.ConeGeometry(radius * 0.92, height * 0.55, 7),
        material,
        `${name}-crown`,
        new THREE.Vector3(0, height * 0.75, 0),
      ),
    );
    group.add(landmark);
  };

  const villageCrystal = new THREE.Group();
  villageCrystal.name = 'LM_VILLAGE_CRYSTAL';
  villageCrystal.position.set(0, terrainHeightAt({ x: 0, z: 1 }) + 3.4, 1);
  for (const [x, z, scale, tilt] of [
    [0, 0, 2.8, 0],
    [-2, 0.8, 1.5, -0.25],
    [2, 1.1, 1.7, 0.2],
  ] as const) {
    const shard = createCrystal(crystalMaterial, scale, scale * 3.2);
    shard.position.set(x, 0, z);
    shard.rotation.z = tilt;
    villageCrystal.add(shard);
  }
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
    const shard = createCrystal(crystalMaterial, radius, height);
    shard.position.set(x, height / 2, z);
    shard.rotation.z = tilt;
    crystalSpire.add(shard);
  }
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

  const beachArch = mesh(
    new THREE.TorusGeometry(7, 1.45, 8, 20, Math.PI),
    creamMaterial,
    'LM_BEACH_ARCH',
  );
  beachArch.position.set(35, terrainHeightAt({ x: 35, z: 103 }) + 0.3, 103);
  beachArch.rotation.y = Math.PI / 2;
  group.add(beachArch);

  const moonstone = createCrystal(crystalMaterial, 2.2, 7);
  moonstone.name = 'LM_ISLAND_MOONSTONE';
  moonstone.position.set(37, terrainHeightAt({ x: 37, z: 116 }) + 3.5, 116);
  group.add(moonstone);

  for (const [name, x, z, height, radius, material] of [
    ['LM_VILLAGE_CLOCKTOWER', 15, -18, 12, 2.2, woodMaterial],
    ['LM_FOREST_SHRINE', -139, -15, 7, 3.2, creamMaterial],
    ['LM_FOREST_RAVINE', -126, 45, 8, 2.6, woodMaterial],
    ['LM_CRYSTAL_GARDENS', 123, -36, 14, 3.6, crystalMaterial],
    ['LM_CRYSTAL_FALLS', 84, -65, 16, 4.2, crystalMaterial],
    ['LM_CRYSTAL_CAVE', 145, -28, 9, 3.5, crystalMaterial],
    ['LM_ICE_CAVE', -18, -143, 13, 3.7, iceMaterial],
    ['LM_SKY_RIDGE', 52, -124, 17, 3.4, iceMaterial],
    ['LM_MEADOW_BARN', -65, 91, 6, 4.2, woodMaterial],
    ['LM_FLOWER_HILL', 61, 75, 8, 3.3, leafLightMaterial],
    ['LM_COASTAL_OVERLOOK', 20, 139, 10, 3.5, creamMaterial],
    ['LM_BEACH_DOCK', -42, 163, 5, 3.8, woodMaterial],
    ['LM_BEACH_COVE', 24, 156, 7, 3.2, creamMaterial],
    ['LM_RUINED_ISLAND', 132, 149, 11, 4.4, creamMaterial],
  ] as const) {
    addOuterLandmark(name, x, z, material, height, radius);
  }

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
  const height = top.y - bottom.y;
  const waterfall = mesh(new THREE.PlaneGeometry(width, height, 5, 8), material, id);
  waterfall.position.set((top.x + bottom.x) / 2, bottom.y + height / 2, (top.z + bottom.z) / 2);
  waterfall.rotation.y = Math.atan2(top.x - bottom.x, top.z - bottom.z);
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
    [-112, -42],
    [-124, -18],
    [-137, 7],
    [-101, 34],
    [-126, 47],
    [104, -29],
    [126, -42],
    [145, -26],
    [83, -68],
    [58, -94],
    [-18, -120],
    [49, -133],
    [-69, 89],
    [-91, 98],
    [58, 78],
    [82, 86],
    [19, 131],
    [-18, 143],
    [-52, 164],
    [73, 166],
    [103, 176],
    [137, 151],
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
    [-68, 92],
    [-48, 103],
    [57, 73],
    [78, 84],
    [-2, 133],
    [18, 145],
    [-31, 163],
    [24, 157],
    [64, 170],
    [104, 174],
  ] as const) {
    const bloom = mesh(new THREE.IcosahedronGeometry(0.65, 0), flower, 'placeholder-flower');
    bloom.position.set(x, terrainHeightAt({ x, z }) + 0.75, z);
    group.add(bloom);
  }
  return group;
}

export class WorldLayout {
  private readonly root = new THREE.Group();
  private boundary = new THREE.Group();
  private readonly waterMaterial = new THREE.MeshPhysicalMaterial({
    color: PALETTE.river,
    transparent: true,
    opacity: 0.76,
    roughness: 0.18,
    metalness: 0,
    transmission: 0.08,
    depthWrite: false,
  });
  private currentHalfExtent: number;

  constructor(
    private readonly scene: THREE.Scene,
    halfExtent: number,
  ) {
    this.currentHalfExtent = halfExtent;
    this.root.name = 'WORLD_ROOT';
    this.scene.add(this.root);
    this.build();
  }

  setHalfExtent(halfExtent: number): void {
    if (halfExtent === this.currentHalfExtent) return;
    this.currentHalfExtent = halfExtent;
    this.root.remove(this.boundary);
    this.disposeObject(this.boundary);
    this.boundary = this.createBoundary(halfExtent);
    this.root.add(this.boundary);
  }

  update(elapsedSeconds: number): void {
    this.waterMaterial.opacity = 0.72 + Math.sin(elapsedSeconds * 1.4) * 0.04;
    const windmill = this.root.getObjectByName('LM_MEADOW_WINDMILL');
    const hub = windmill?.children.find((child) => child.type === 'Group');
    if (hub) hub.rotation.z = elapsedSeconds * 0.35;
  }

  destroy(): void {
    this.scene.remove(this.root);
    this.disposeObject(this.root);
  }

  private build(): void {
    const oceanMaterial = new THREE.MeshPhysicalMaterial({
      color: PALETTE.ocean,
      roughness: 0.22,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    });
    const ocean = mesh(new THREE.CircleGeometry(205, 64), oceanMaterial, 'OCEAN');
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = SEA_LEVEL;
    ocean.receiveShadow = true;
    this.root.add(ocean);

    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.91,
      metalness: 0,
    });
    this.root.add(mesh(createTerrainGeometry(), terrainMaterial, 'TERRAIN_BLOCKOUT'));

    const pathMaterial = new THREE.MeshStandardMaterial({
      color: PALETTE.path,
      roughness: 0.96,
      side: THREE.DoubleSide,
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
      this.root.add(path);
    }

    for (const branch of RIVER_BRANCHES) {
      const river = mesh(
        createRibbonGeometry(branch, 4.6, (point) => riverElevation(point) + 0.08),
        this.waterMaterial,
        'WATER_NETWORK',
      );
      river.renderOrder = 2;
      this.root.add(river);
    }

    for (const bridge of BRIDGES)
      this.root.add(createBridge(bridge.id, bridge.x, bridge.z, bridge.width, bridge.depth));

    const waterfallMaterial = this.waterMaterial.clone();
    waterfallMaterial.opacity = 0.84;
    waterfallMaterial.side = THREE.DoubleSide;
    this.root.add(
      createWaterfall(
        'WF_MOUNTAIN_01',
        new THREE.Vector3(20, 45, -65),
        new THREE.Vector3(20, 23, -55),
        7,
        waterfallMaterial,
      ),
    );
    this.root.add(
      createWaterfall(
        'WF_CRYSTAL_01',
        new THREE.Vector3(60, 22, -15),
        new THREE.Vector3(60, 17, -5),
        5,
        waterfallMaterial,
      ),
    );
    for (const [id, top, bottom, width] of [
      ['WF_CRYSTAL_02', [84, 32, -65], [84, 24, -76], 6],
      ['WF_COASTAL_01', [8, 15, 142], [-2, 8, 153], 5],
      ['WF_COASTAL_02', [-18, 12, 145], [-18, 6, 157], 4],
    ] as const) {
      this.root.add(
        createWaterfall(
          id,
          new THREE.Vector3(...top),
          new THREE.Vector3(...bottom),
          width,
          waterfallMaterial,
        ),
      );
    }

    this.root.add(createLandmarks(), createBlockoutDetails());
    this.boundary = this.createBoundary(this.currentHalfExtent);
    this.root.add(this.boundary);
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
      boundary.add(wall);
    }
    return boundary;
  }

  private disposeObject(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }
}

export function worldHeightAt(x: number, z: number): number {
  return terrainHeightAt({ x, z });
}

export const WORLD_CAMERA_FAR = Math.max(420, ARENA.halfExtent * 4);
