import islandModelUrl from './island.glb?url';
import { Box3,Group,Mesh,Vector3,type Material,type Object3D,type Scene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class IslandMap {
  readonly group=new Group();
  private destroyed=false;

  constructor(scene:Scene){
    scene.add(this.group);
    void this.load();
  }

  private async load():Promise<void>{
    const model=(await new GLTFLoader().loadAsync(islandModelUrl)).scene;
    if(this.destroyed){this.disposeModel(model);return;}
    model.name='island-map';
    model.traverse(object=>{
      if(!(object instanceof Mesh))return;
      object.castShadow=true;
      object.receiveShadow=true;
    });
    const bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3());
    const largest=Math.max(size.x,size.y,size.z);
    if(largest>0)model.scale.setScalar(72/largest);
    const normalizedBounds=new Box3().setFromObject(model),center=normalizedBounds.getCenter(new Vector3());
    model.position.set(-center.x,-normalizedBounds.min.y,-center.z);
    this.group.add(model);
  }

  private disposeModel(model:Object3D):void{
    model.traverse(object=>{
      if(!(object instanceof Mesh))return;
      object.geometry.dispose();
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        (material as Material).dispose();
      }
    });
  }

  destroy():void{
    this.destroyed=true;
    this.disposeModel(this.group);
    this.group.removeFromParent();
  }
}