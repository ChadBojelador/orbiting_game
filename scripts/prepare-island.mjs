// Offline, reproducible derivative of the user-supplied source. No downloads.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Matrix4, Matrix3, Vector3, Quaternion, Box3 } from 'three';

const source = 'apps/client/src/world/island.glb';
const sourceBytes = fs.readFileSync(source);
const jsonLength = sourceBytes.readUInt32LE(12);
const document = JSON.parse(sourceBytes.subarray(20, 20 + jsonLength).toString());
const binary = sourceBytes.subarray(28 + jsonLength);
const selected = document.nodes.findIndex((n) => n.name === 'Fort');
const meshes = [];
function visit(index, parent, included = false) {
  const node = document.nodes[index];
  const matrix = node.matrix
    ? new Matrix4().fromArray(node.matrix)
    : new Matrix4().compose(
        new Vector3(...(node.translation ?? [0, 0, 0])),
        new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
        new Vector3(...(node.scale ?? [1, 1, 1])),
      );
  matrix.premultiply(parent);
  included ||= index === selected;
  // Keep structural surfaces; remove dense foliage and tiny decorative props.
  if (included && node.mesh !== undefined && /SM_Bld_|SM_Env_(Beach|Rock|Flat)/.test(node.name)) {
    for (const primitive of document.meshes[node.mesh].primitives)
      meshes.push({ primitive, matrix });
  }
  for (const child of node.children ?? []) visit(child, matrix, included);
}
visit(document.scenes[0].nodes[0], new Matrix4());
function readAccessor(index) {
  const accessor = document.accessors[index],
    view = document.bufferViews[accessor.bufferView];
  const dimensions = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const bytes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[accessor.componentType];
  const read = {
    5126: 'readFloatLE',
    5125: 'readUInt32LE',
    5123: 'readUInt16LE',
    5121: 'readUInt8',
  }[accessor.componentType];
  if (!bytes || !dimensions) throw new Error('Unsupported source accessor');
  return Array.from({ length: accessor.count }, (_, i) =>
    Array.from({ length: dimensions }, (_, k) =>
      binary[read](
        (view.byteOffset ?? 0) +
          (accessor.byteOffset ?? 0) +
          i * (view.byteStride ?? dimensions * bytes) +
          k * bytes,
      ),
    ),
  );
}
const bounds = new Box3();
for (const { primitive, matrix } of meshes) {
  const a = document.accessors[primitive.attributes.POSITION];
  bounds.union(new Box3(new Vector3(...a.min), new Vector3(...a.max)).applyMatrix4(matrix));
}
const center = bounds.getCenter(new Vector3());
const size = bounds.getSize(new Vector3());
const scale = 112 / Math.max(size.x, size.z);
const seaLevel = -18.773349;
const groups = new Map(),
  collision = [];
for (const { primitive, matrix } of meshes) {
  let group = groups.get(primitive.material);
  if (!group) {
    group = { vertices: [], indices: [], lookup: new Map() };
    groups.set(primitive.material, group);
  }
  const positions = readAccessor(primitive.attributes.POSITION);
  const normals = readAccessor(primitive.attributes.NORMAL);
  const uv = readAccessor(primitive.attributes.TEXCOORD_0);
  const indices = readAccessor(primitive.indices).flat();
  const normalMatrix = new Matrix3().getNormalMatrix(matrix);
  const transformed = positions.map((p) => {
    const v = new Vector3(...p).applyMatrix4(matrix);
    return [
      Math.round((v.x - center.x) * scale * 100),
      Math.round((v.y - seaLevel) * scale * 100),
      Math.round((v.z - center.z) * scale * 100),
    ];
  });
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3);
    collision.push(...triangle.flatMap((index) => transformed[index]));
    for (const index of triangle) {
      const n = new Vector3(...normals[index]).applyNormalMatrix(normalMatrix);
      const vertex = [...transformed[index].map((v) => v / 100), n.x, n.y, n.z, ...uv[index]];
      const key = vertex.map((v) => Math.round(v * 10000)).join(',');
      let mapped = group.lookup.get(key);
      if (mapped === undefined) {
        mapped = group.vertices.length / 8;
        group.lookup.set(key, mapped);
        group.vertices.push(...vertex);
      }
      group.indices.push(mapped);
    }
  }
}
const chunks = [],
  views = [],
  accessors = [];
let offset = 0;
function bufferView(bytes, extra = {}) {
  const padding = (4 - (offset % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    offset += padding;
  }
  const id = views.length;
  views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...extra });
  chunks.push(bytes);
  offset += bytes.length;
  return id;
}
const primitives = [];
for (const [material, group] of groups) {
  const vertexBuffer = Buffer.from(new Float32Array(group.vertices).buffer);
  const vertexView = bufferView(vertexBuffer, { byteStride: 32 });
  const box = new Box3();
  for (let i = 0; i < group.vertices.length; i += 8)
    box.expandByPoint(new Vector3(...group.vertices.slice(i, i + 3)));
  const position = accessors.length;
  accessors.push({
    bufferView: vertexView,
    byteOffset: 0,
    componentType: 5126,
    count: group.vertices.length / 8,
    type: 'VEC3',
    min: box.min.toArray(),
    max: box.max.toArray(),
  });
  accessors.push({
    bufferView: vertexView,
    byteOffset: 12,
    componentType: 5126,
    count: group.vertices.length / 8,
    type: 'VEC3',
  });
  accessors.push({
    bufferView: vertexView,
    byteOffset: 24,
    componentType: 5126,
    count: group.vertices.length / 8,
    type: 'VEC2',
  });
  const index = accessors.length;
  accessors.push({
    bufferView: bufferView(Buffer.from(new Uint32Array(group.indices).buffer)),
    componentType: 5125,
    count: group.indices.length,
    type: 'SCALAR',
  });
  primitives.push({
    attributes: { POSITION: position, NORMAL: position + 1, TEXCOORD_0: position + 2 },
    indices: index,
    material,
  });
}
const images = document.images.map((img) => {
  const view = document.bufferViews[img.bufferView];
  return {
    mimeType: img.mimeType,
    bufferView: bufferView(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)),
  };
});
const output = {
  asset: { version: '2.0', generator: 'prepare-island.mjs', extras: document.asset.extras },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Island Fort: 112 metre structural derivative' }],
  meshes: [{ primitives }],
  buffers: [{ byteLength: offset }],
  bufferViews: views,
  accessors,
  materials: document.materials,
  images,
  textures: document.textures,
  samplers: document.samplers,
  extensionsUsed: document.extensionsUsed,
};
const rawJson = Buffer.from(JSON.stringify(output));
const json = Buffer.concat([rawJson, Buffer.alloc((4 - (rawJson.length % 4)) % 4, 32)]);
const rawBin = Buffer.concat(chunks),
  bin = Buffer.concat([rawBin, Buffer.alloc((4 - (rawBin.length % 4)) % 4)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length);
binHeader.writeUInt32LE(0x004e4942, 4);
fs.mkdirSync('apps/client/src/world/generated', { recursive: true });
fs.writeFileSync(
  'apps/client/src/world/generated/island-fort.glb',
  Buffer.concat([header, json, binHeader, bin]),
);
const encoded = Buffer.alloc(collision.length * 2);
collision.forEach((value, i) => encoded.writeInt16LE(value, i * 2));
fs.writeFileSync(
  'packages/shared/src/simulation/island-data.ts',
  `// Generated by scripts/prepare-island.mjs. Centimetre-quantized triangle soup.\nexport const ISLAND_TRIANGLES_BASE64: string = '${encoded.toString('base64')}';\n`,
);
const report = {
  source,
  sha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'),
  sourceAttribution: document.asset.extras,
  selectedSector: 'Fort',
  runtimeUse: 'Frost Island central ruin',
  runtimeTransform: { uniformScale: 0.52, yOffset: 0.25 },
  scale,
  seaLevel,
  sourceCenter: center,
  derivativeSourceHalfExtent: 60,
  playableHalfExtent: 80,
  triangles: collision.length / 9,
  drawCalls: primitives.length,
  runtimeBytes: header.length + json.length + binHeader.length + bin.length,
  collisionBytes: encoded.length,
};
fs.writeFileSync('assets/island-build-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
