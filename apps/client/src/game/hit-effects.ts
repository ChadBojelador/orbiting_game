import { BufferGeometry,Float32BufferAttribute,Line,LineBasicMaterial,type Scene } from 'three';
import type { SpatialPosition } from '@ice-water/shared';
export class HitEffects {
  private effects:{line:Line;until:number}[]=[];
  constructor(private readonly scene:Scene){}
  shot(origin:SpatialPosition,end:SpatialPosition,now:number):void {
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([origin.x,origin.y,origin.z,end.x,end.y,end.z],3));
    const line=new Line(geometry,new LineBasicMaterial({color:0xffde92,transparent:true,opacity:0.65}));
    this.scene.add(line);this.effects.push({line,until:now+70});
    if(this.effects.length>48)this.remove(0);
  }
  update(now:number):void{for(let i=this.effects.length-1;i>=0;i--)if(now>=this.effects[i]!.until)this.remove(i);}
  destroy():void{while(this.effects.length)this.remove(0);}
  private remove(i:number):void{const effect=this.effects.splice(i,1)[0]!;effect.line.geometry.dispose();(effect.line.material as LineBasicMaterial).dispose();effect.line.removeFromParent();}
}
