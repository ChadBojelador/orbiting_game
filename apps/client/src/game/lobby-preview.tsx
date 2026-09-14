import {useEffect,useRef,useState} from 'react';
import {WEAPONS,type WeaponId} from '@ice-water/shared';
import * as THREE from 'three';
import {loadCharacterModel,type CharacterInstance} from './character-model.js';

export type LobbySection='main'|'play'|'modes'|'loadout'|'customize'|'party'|'profile'|'settings';

interface LobbyPreviewProps {
  section:LobbySection;
  weapon:WeaponId;
  reducedEffects:boolean;
  isRoomActive:boolean;
}

const CAMERA_POSES:Record<LobbySection,{position:THREE.Vector3;target:THREE.Vector3}>={
  main:{position:new THREE.Vector3(4.9,2.9,7.2),target:new THREE.Vector3(.65,1.25,0)},
  play:{position:new THREE.Vector3(4.6,2.75,6.8),target:new THREE.Vector3(.62,1.2,0)},
  modes:{position:new THREE.Vector3(5.3,3.15,7.8),target:new THREE.Vector3(.45,1.3,-.2)},
  loadout:{position:new THREE.Vector3(3.15,2.05,4.25),target:new THREE.Vector3(.35,1.18,.05)},
  customize:{position:new THREE.Vector3(3.75,2.42,5.25),target:new THREE.Vector3(.25,1.18,0)},
  party:{position:new THREE.Vector3(4.7,2.82,6.95),target:new THREE.Vector3(.62,1.22,0)},
  profile:{position:new THREE.Vector3(3.6,2.5,5.5),target:new THREE.Vector3(.25,1.38,0)},
  settings:{position:new THREE.Vector3(5.2,3,7.65),target:new THREE.Vector3(.55,1.3,0)},
};

export function LobbyPreview({section,weapon,reducedEffects,isRoomActive}:LobbyPreviewProps){
  const ref=useRef<HTMLCanvasElement>(null),sceneRef=useRef<LobbyScene>();
  const [hasError,setHasError]=useState(false);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    try{sceneRef.current=new LobbyScene(canvas);}catch{setHasError(true);return;}
    return ()=>{sceneRef.current?.destroy();sceneRef.current=undefined;};
  },[]);
  useEffect(()=>sceneRef.current?.setState(section,weapon,reducedEffects,isRoomActive),[section,weapon,reducedEffects,isRoomActive]);
  return <>
    <canvas className="lobby-preview" ref={ref} aria-label="Interactive frozen facility lobby"/>
    {hasError&&<div className="preview-fallback" role="img" aria-label="Frozen facility unavailable"><span>3D lobby unavailable</span><small>Menu controls remain active.</small></div>}
  </>;
}

class LobbyScene {
  private readonly scene=new THREE.Scene();
  private readonly camera=new THREE.PerspectiveCamera(38,1,.1,90);
  private readonly renderer:THREE.WebGLRenderer;
  private readonly stage=new THREE.Group();
  private readonly fan=new THREE.Group();
  private readonly holograms:THREE.Mesh[]=[];
  private readonly cameraTarget=new THREE.Vector3(.65,1.25,0);
  private readonly pointer=new THREE.Vector2();
  private readonly smoothPointer=new THREE.Vector2();
  private readonly ringMaterial=new THREE.MeshStandardMaterial({color:0x263846,emissive:0xffbd59,emissiveIntensity:.7,metalness:.65,roughness:.25});
  private readonly cleanup:Array<()=>void>=[];
  private character?:CharacterInstance;
  private placeholder?:THREE.Group;
  private weapon=new THREE.Group();
  private snow?:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
  private frame=0;
  private previous=performance.now();
  private section:LobbySection='main';
  private weaponId:WeaponId='assault-rifle';
  private isReduced=false;
  private isRoomActive=false;
  private isDestroyed=false;
  private isDragging=false;
  private dragX=0;
  private rotationOffset=0;
  private zoomOffset=0;

  constructor(private readonly canvas:HTMLCanvasElement){
    const isCoarse=matchMedia('(any-pointer: coarse)').matches;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:!isCoarse,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.shadowMap.enabled=!isCoarse;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene.background=new THREE.Color(0x06111d);this.scene.fog=new THREE.FogExp2(0x071522,.035);
    this.buildEnvironment();this.buildLighting();this.bind();this.resize();
    this.placeholder=this.buildPlaceholder();this.stage.add(this.placeholder);
    this.weapon=this.buildWeapon(this.weaponId);this.stage.add(this.weapon);this.scene.add(this.stage);
    void this.loadCharacter();this.frame=requestAnimationFrame(time=>this.render(time));
  }

  setState(section:LobbySection,weapon:WeaponId,reducedEffects:boolean,isRoomActive:boolean):void{
    this.section=section;this.isReduced=reducedEffects;this.isRoomActive=isRoomActive;
    if(this.weaponId!==weapon){this.weaponId=weapon;this.weapon.removeFromParent();this.disposeObject(this.weapon);this.weapon=this.buildWeapon(weapon);this.stage.add(this.weapon);}
    if(this.snow)this.snow.visible=!reducedEffects;
  }

  destroy():void{
    if(this.isDestroyed)return;
    this.isDestroyed=true;cancelAnimationFrame(this.frame);this.cleanup.forEach(dispose=>dispose());
    this.scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Points){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
    this.renderer.dispose();
  }

  private buildLighting():void{
    this.scene.add(new THREE.HemisphereLight(0x8edbea,0x02070d,1.25));
    const key=new THREE.SpotLight(0xeafcff,95,30,Math.PI/5,.5,1.2);key.position.set(4,8,6);key.target.position.set(0,1,0);key.castShadow=this.renderer.shadowMap.enabled;key.shadow.mapSize.set(1024,1024);this.scene.add(key,key.target);
    const rim=new THREE.PointLight(0x43d9f2,38,11,1.6);rim.position.set(-3.5,2.6,-1.8);this.scene.add(rim);
    const warm=new THREE.PointLight(0xffbd59,18,7,2);warm.position.set(0,.35,1);this.scene.add(warm);
  }

  private buildEnvironment():void{
    const steel=new THREE.MeshStandardMaterial({color:0x0b1d2b,metalness:.72,roughness:.42}),darkSteel=new THREE.MeshStandardMaterial({color:0x061019,metalness:.82,roughness:.34});
    const ice=new THREE.MeshPhysicalMaterial({color:0x77e6f5,transparent:true,opacity:.3,roughness:.12,metalness:.05,transmission:.16});
    const cyan=new THREE.MeshStandardMaterial({color:0x173c50,emissive:0x38cde5,emissiveIntensity:1.4,metalness:.4,roughness:.3});
    const floor=new THREE.Mesh(new THREE.CylinderGeometry(12,12,.28,48),steel);floor.position.y=-.18;floor.receiveShadow=true;this.scene.add(floor);
    const inset=new THREE.Mesh(new THREE.CylinderGeometry(3.25,3.25,.08,48),darkSteel);inset.position.y=.005;inset.receiveShadow=true;this.scene.add(inset);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3.03,.055,8,64),this.ringMaterial);ring.rotation.x=Math.PI/2;ring.position.y=.075;this.scene.add(ring);
    for(let i=-5;i<=5;i++){const seam=new THREE.Mesh(new THREE.BoxGeometry(.025,.018,19),i%2?cyan:darkSteel);seam.position.set(i*1.85,.02,-1);this.scene.add(seam);}
    for(const z of [-7.8,-3.9,3.9]){const seam=new THREE.Mesh(new THREE.BoxGeometry(21,.02,.025),darkSteel);seam.position.set(0,.03,z);this.scene.add(seam);}
    const back=new THREE.Mesh(new THREE.BoxGeometry(25,8,.4),steel);back.position.set(0,3.8,-7.5);this.scene.add(back);
    const windowPanel=new THREE.Mesh(new THREE.PlaneGeometry(12,4.2),new THREE.MeshBasicMaterial({color:0x0b3147}));windowPanel.position.set(1,4,-7.27);this.scene.add(windowPanel);
    for(let i=0;i<7;i++){const peak=new THREE.Mesh(new THREE.ConeGeometry(1.6+i%3*.35,3+i%2,4),new THREE.MeshStandardMaterial({color:i%2?0x163b50:0x102c3d,roughness:.9}));peak.position.set(-7.5+i*2.8,1.8,-7);peak.rotation.y=Math.PI/4;this.scene.add(peak);}
    for(const x of [-8.5,8.5]){
      const support=new THREE.Mesh(new THREE.BoxGeometry(1,7.6,1.1),darkSteel);support.position.set(x,3.6,-5.8);this.scene.add(support);
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,8.5,12),steel);pipe.rotation.z=Math.PI/2;pipe.position.set(x>0?5.1:-5.1,6.45,-5.9);this.scene.add(pipe);
      for(const y of [1.5,3.8,6]){const band=new THREE.Mesh(new THREE.BoxGeometry(1.35,.18,1.4),cyan);band.position.set(x,y,-5.75);this.scene.add(band);}
    }
    for(const x of [-5.8,6.3])this.addCryoTank(x,-4.75,steel,ice,cyan);
    this.addHologram(-4.35,2.6,-4.5,.42);this.addHologram(5.05,3.7,-4.8,-.38);this.buildFan(7.15,4.65,-7.15,darkSteel,cyan);this.buildSnow();
  }

  private addCryoTank(x:number,z:number,steel:THREE.Material,ice:THREE.Material,cyan:THREE.Material):void{
    const group=new THREE.Group();group.position.set(x,0,z);
    const chamber=new THREE.Mesh(new THREE.CylinderGeometry(.82,.82,3.5,20,1,true),ice);chamber.position.y=2.1;
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.38,16),steel);base.position.y=.2;
    const cap=base.clone();cap.position.y=4;
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,2.8,10),cyan);core.position.y=2.1;
    group.add(chamber,base,cap,core);this.scene.add(group);
  }

  private addHologram(x:number,y:number,z:number,rotation:number):void{
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2.3,1.45,.08),new THREE.MeshStandardMaterial({color:0x0d2433,metalness:.7,roughness:.3}));frame.position.set(x,y,z);frame.rotation.y=rotation;this.scene.add(frame);
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(2.05,1.2),new THREE.MeshBasicMaterial({color:0x60deef,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false}));panel.position.set(x+(rotation<0?-.04:.04),y,z+.06);panel.rotation.y=rotation;this.holograms.push(panel);this.scene.add(panel);
  }

  private buildFan(x:number,y:number,z:number,steel:THREE.Material,cyan:THREE.Material):void{
    this.fan.position.set(x,y,z);this.fan.rotation.y=Math.PI;
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.24,12),cyan);hub.rotation.x=Math.PI/2;this.fan.add(hub);
    for(let i=0;i<6;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.24,1.55,.08),steel);blade.position.y=.7;blade.rotation.z=i*Math.PI/3;blade.geometry.translate(0,.1,0);this.fan.add(blade);}
    this.scene.add(this.fan);
  }

  private buildSnow():void{
    const count=matchMedia('(any-pointer: coarse)').matches?180:520,positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*22;positions[i*3+1]=Math.random()*9;positions[i*3+2]=(Math.random()-.5)*18;}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.snow=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xd8f8ff,size:.035,transparent:true,opacity:.58,depthWrite:false}));this.scene.add(this.snow);
  }

  private buildPlaceholder():THREE.Group{
    const group=new THREE.Group(),suit=new THREE.MeshStandardMaterial({color:0xdbeef2,roughness:.58,metalness:.15}),visor=new THREE.MeshStandardMaterial({color:0x123449,emissive:0x38cde5,emissiveIntensity:.7});
    const torso=new THREE.Mesh(new THREE.BoxGeometry(.8,1.05,.42),suit);torso.position.y=1.18;
    const head=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),visor);head.position.y=1.96;
    const legs=[-.22,.22].map(x=>{const leg=new THREE.Mesh(new THREE.BoxGeometry(.28,.9,.3),suit);leg.position.set(x,.45,0);return leg;});
    group.add(torso,head,...legs);group.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=true;});return group;
  }

  private async loadCharacter():Promise<void>{
    try{
      const factory=await loadCharacterModel();if(this.isDestroyed)return;
      this.character=factory.instantiate('#dbeef2','Idle');this.character.root.rotation.y=Math.PI;this.character.root.position.y=.02;
      if(this.placeholder){this.placeholder.removeFromParent();this.disposeObject(this.placeholder);this.placeholder=undefined;}
      this.stage.add(this.character.root);
    }catch{/* Keep the original procedural field-suit fallback. */}
  }

  private buildWeapon(id:WeaponId):THREE.Group{
    const group=new THREE.Group(),body=new THREE.MeshStandardMaterial({color:0x132b3b,metalness:.68,roughness:.28}),ice=new THREE.MeshStandardMaterial({color:0xd8f8ff,emissive:0x47d7e9,emissiveIntensity:.32,metalness:.42,roughness:.22}),accent=new THREE.MeshStandardMaterial({color:0xffbd59,emissive:0xff8a32,emissiveIntensity:.18});
    const length=id==='sniper'?1.18:id==='smg'?.66:id==='shotgun'?.9:.82;
    const box=(w:number,h:number,d:number,x:number,y:number,z:number,material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);};
    box(.24,.25,length,0,0,-length/2,body);box(.2,.09,length*.72,0,.14,-length*.48,ice);box(.11,.38,.16,0,-.24,-.16,body);box(.075,.075,.26,0,.02,-length-.1,ice);box(.05,.07,.08,0,.25,-.24,accent);
    if(id==='sniper')box(.14,.14,.38,0,.29,-.42,body);if(id==='shotgun')box(.28,.08,.3,0,-.08,-.6,accent);
    group.name=`${WEAPONS[id].name} lobby preview`;group.position.set(.34,1.19,.16);group.rotation.set(.08,-.24,-.13);return group;
  }

  private bind():void{
    const resize=()=>this.resize(),move=(event:PointerEvent)=>{
      const rect=this.canvas.getBoundingClientRect();this.pointer.set(((event.clientX-rect.left)/Math.max(1,rect.width))*.2-.1,((event.clientY-rect.top)/Math.max(1,rect.height))*.2-.1);
      if(this.isDragging&&this.section==='customize'){this.rotationOffset+=(event.clientX-this.dragX)*.008;this.dragX=event.clientX;}
    },down=(event:PointerEvent)=>{if(this.section!=='customize')return;this.isDragging=true;this.dragX=event.clientX;this.canvas.setPointerCapture(event.pointerId);},up=()=>{this.isDragging=false;},wheel=(event:WheelEvent)=>{if(this.section!=='customize')return;event.preventDefault();this.zoomOffset=THREE.MathUtils.clamp(this.zoomOffset+Math.sign(event.deltaY)*.28,-.55,.85);};
    const observer=new ResizeObserver(resize);observer.observe(this.canvas);
    this.canvas.addEventListener('pointermove',move);this.canvas.addEventListener('pointerdown',down);this.canvas.addEventListener('pointerup',up);this.canvas.addEventListener('pointercancel',up);this.canvas.addEventListener('wheel',wheel,{passive:false});
    this.cleanup.push(()=>observer.disconnect(),()=>this.canvas.removeEventListener('pointermove',move),()=>this.canvas.removeEventListener('pointerdown',down),()=>this.canvas.removeEventListener('pointerup',up),()=>this.canvas.removeEventListener('pointercancel',up),()=>this.canvas.removeEventListener('wheel',wheel));
  }

  private resize():void{
    const width=this.canvas.clientWidth||innerWidth,height=this.canvas.clientHeight||innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(any-pointer: coarse)').matches?1.25:1.7));this.renderer.setSize(width,height,false);this.camera.aspect=width/Math.max(1,height);this.camera.updateProjectionMatrix();
  }

  private render(now:number):void{
    if(this.isDestroyed)return;
    const delta=Math.min(.05,(now-this.previous)/1000);this.previous=now;
    if(!document.hidden){this.update(now,delta);this.renderer.render(this.scene,this.camera);}
    this.frame=requestAnimationFrame(time=>this.render(time));
  }

  private update(now:number,delta:number):void{
    this.character?.update(delta);
    const pose=CAMERA_POSES[this.section],ease=1-Math.exp(-4.8*delta),pointerScale=this.isReduced?0:1;
    this.smoothPointer.lerp(this.pointer,ease*.65);
    const desired=pose.position.clone();desired.z+=this.section==='customize'?this.zoomOffset:0;desired.x+=this.smoothPointer.x*.9*pointerScale;desired.y-=this.smoothPointer.y*.45*pointerScale;this.camera.position.lerp(desired,ease);
    const target=pose.target.clone();target.x+=this.smoothPointer.x*.24*pointerScale;target.y-=this.smoothPointer.y*.12*pointerScale;this.cameraTarget.lerp(target,ease);this.camera.lookAt(this.cameraTarget);
    const baseRotation=this.section==='loadout'?-.35:this.section==='customize'?-0.18:-.12;this.stage.rotation.y=THREE.MathUtils.lerp(this.stage.rotation.y,baseRotation+(this.section==='customize'?this.rotationOffset:0),ease);
    const idle=this.isReduced?0:Math.sin(now*.0017)*.018;this.stage.position.y=idle;this.weapon.rotation.z=-.13+(this.isReduced?0:Math.sin(now*.0013)*.014);
    this.fan.rotation.z+=delta*.38;this.holograms.forEach((panel,index)=>{(panel.material as THREE.MeshBasicMaterial).opacity=.14+(Math.sin(now*.002+index*1.7)+1)*.045;});
    this.ringMaterial.emissiveIntensity=THREE.MathUtils.lerp(this.ringMaterial.emissiveIntensity,this.isRoomActive?2.1:this.section==='play'?1.35:.72,ease);
    if(this.snow&&!this.isReduced){const attribute=this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<attribute.count;i++){let y=attribute.getY(i)-delta*(.13+(i%7)*.018);if(y<.08)y=8.5;attribute.setY(i,y);}attribute.needsUpdate=true;}
  }

  private disposeObject(object:THREE.Object3D):void{
    object.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];materials.forEach(material=>material.dispose());}});
  }
}
