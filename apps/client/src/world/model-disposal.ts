import { Mesh, Texture, type Object3D, type Material } from 'three';

export function disposeModel(model: Object3D): void {
  const textures = new Set<Texture>();
  const materials = new Set<Material>();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof Texture) textures.add(value);
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}
