import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from 'three';
import { ISLAND_SPAWN_POINTS, GAMEPLAY, isWalkable, terrainHeightAt, worldRayDistance, simulateMovement } from '@ice-water/shared';

function renderedMesh(): Mesh {
  const bytes = fs.readFileSync(new URL('./generated/island-fort.glb', import.meta.url));
  const length = bytes.readUInt32LE(12);
  const model = JSON.parse(bytes.subarray(20, 20 + length).toString()) as {
    meshes: { primitives: { attributes: { POSITION: number }; indices: number }[] }[];
    accessors: { bufferView: number; byteOffset?: number; count: number }[];
    bufferViews: { byteOffset: number; byteStride?: number }[];
  };
  const primitive = model.meshes[0]!.primitives[0]!;
  const position = model.accessors[primitive.attributes.POSITION]!, indices = model.accessors[primitive.indices]!;
  const vertexView = model.bufferViews[position.bufferView]!, indexView = model.bufferViews[indices.bufferView]!;
  const positions: number[] = [], index: number[] = [];
  for (let i = 0; i < position.count; i++) for (let axis = 0; axis < 3; axis++) positions.push(bytes.readFloatLE(28 + length + vertexView.byteOffset + (position.byteOffset ?? 0) + i * vertexView.byteStride! + axis * 4));
  for (let i = 0; i < indices.count; i++) index.push(bytes.readUInt32LE(28 + length + indexView.byteOffset + i * 4));
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(index);
  return new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
}

describe('Island render and authoritative geometry', () => {
  it('grounds all sixteen spawns on the rendered mesh with room for a standing player', () => {
    const mesh = renderedMesh();
    expect(ISLAND_SPAWN_POINTS).toHaveLength(16);
    for (const p of ISLAND_SPAWN_POINTS) {
      const y = terrainHeightAt(p, 'island');
      const hits = new Raycaster(new Vector3(p.x, 30, p.z), new Vector3(0, -1, 0)).intersectObject(mesh);
      expect(hits[0]!.point.y).toBeCloseTo(y, 4);
      expect(isWalkable(p, 60, y, GAMEPLAY.playerHeight, 'island')).toBe(true);
    }
    mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose();
  });
  it('blocks shots on actual Fort walls, without phantom Frostline blocks', () => {
    const mesh = renderedMesh();
    for (const origin of [{x:0,y:2,z:0},{x:-16,y:4,z:0},{x:0,y:3,z:4}]) {
      for (const direction of [{x:1,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:0,z:1}]) {
        const hits = new Raycaster(new Vector3(origin.x,origin.y,origin.z), new Vector3(direction.x,direction.y,direction.z),0,80).intersectObject(mesh);
        expect(worldRayDistance(origin,direction,80,'island')).toBeCloseTo(hits[0]?.distance??80,4);
      }
    }
    expect(worldRayDistance({x:0,y:2,z:0},{x:1,y:0,z:0},20,'island')).toBeGreaterThan(1);
    expect(worldRayDistance({x:0,y:2,z:0},{x:1,y:0,z:0},20,'frostline')).toBe(0);
    mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose();
  });
  it('keeps a moving player grounded and prevents walking through Fort walls', () => {
    const spawn=ISLAND_SPAWN_POINTS[0]!;
    let p={...spawn,y:terrainHeightAt(spawn,'island'),verticalVelocity:0,velocityX:0,velocityZ:0,isGrounded:true,isSliding:false,isCrouching:false,slideUntil:0,slideReadyAt:0};
    for(let tick=1;tick<=80;tick++) {
      p=simulateMovement(p,{x:1,z:0,sequence:tick},tick*50,0.05,1,'island');
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(isWalkable(p,60,p.y,GAMEPLAY.playerHeight,'island')).toBe(true);
    }
  });
});
