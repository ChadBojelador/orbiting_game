import type * as PC from 'playcanvas';

export type Point3 = readonly [x: number, y: number, z: number];
export type Triangle = readonly [a: number, b: number, c: number];

function faceNormal(a: Point3, b: Point3, c: Point3): Point3 {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const acz = c[2] - a[2];
  const x = aby * acz - abz * acy;
  const y = abz * acx - abx * acz;
  const z = abx * acy - aby * acx;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** Creates deliberately flat-shaded geometry by giving each face unique vertices. */
export function createFacetedMesh(
  app: PC.Application,
  pc: typeof PC,
  points: readonly Point3[],
  faces: readonly Triangle[],
): PC.Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const face of faces) {
    const a = points[face[0]]!;
    const b = points[face[1]]!;
    const c = points[face[2]]!;
    const normal = faceNormal(a, b, c);
    const base = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normal, ...normal, ...normal);
    indices.push(base, base + 1, base + 2);
  }

  const mesh = new pc.Mesh(app.graphicsDevice);
  mesh.setPositions(positions);
  mesh.setNormals(normals);
  mesh.setIndices(indices);
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}

export function createMeshEntity(
  pc: typeof PC,
  name: string,
  mesh: PC.Mesh,
  material: PC.Material,
): PC.Entity {
  const entity = new pc.Entity(name);
  const meshInstance = new pc.MeshInstance(mesh, material);
  meshInstance.castShadow = false;
  entity.addComponent('render', { meshInstances: [meshInstance] });
  return entity;
}

export const OCTAHEDRON_FACES: readonly Triangle[] = [
  [0, 2, 3],
  [0, 3, 4],
  [0, 4, 5],
  [0, 5, 2],
  [1, 3, 2],
  [1, 4, 3],
  [1, 5, 4],
  [1, 2, 5],
];
