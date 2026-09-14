import { useEffect,useRef } from 'react';
import { Scene,PerspectiveCamera,WebGLRenderer,Color,HemisphereLight,DirectionalLight } from 'three';
import { FrostlineMap } from '../world/frostline-map.js';
import { IslandMap } from '../world/island-map.js';
export function LobbyPreview(){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    let renderer:WebGLRenderer;
    try{renderer=new WebGLRenderer({canvas,antialias:true});}catch{return;}
    const scene=new Scene();scene.background=new Color(0xc5e4ef);
    const camera=new PerspectiveCamera(48,1,0.1,320);camera.position.set(54,49,64);camera.lookAt(0,0,0);
    scene.add(new HemisphereLight(0xedfaff,0x41617b,2.5));const sun=new DirectionalLight(0xfff0d0,2);sun.position.set(-30,60,20);scene.add(sun);
    const map=new FrostlineMap(scene);const island=new IslandMap(scene);
    const render=()=>{const w=canvas.clientWidth||1,h=canvas.clientHeight||1;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(render);observer.observe(canvas);render();
    return ()=>{observer.disconnect();map.destroy();island.destroy();renderer.dispose();};
  },[]);
  return <canvas className="lobby-preview" ref={ref} aria-label="Frostline arena preview"/>;
}
