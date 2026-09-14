import {expect,it} from 'vitest';
import {FirstPersonCamera,clampPitch} from './first-person-camera.js';
import {parseSettings} from './fps-settings.js';
it('clamps vertical look and camera height eases into sliding',()=>{
  expect(clampPitch(100)).toBeLessThan(Math.PI/2);
  const camera=new FirstPersonCamera(),position={x:1,y:2,z:3};
  let pose=position;
  for(let i=0;i<20;i++)pose=camera.update(position,{isSliding:true,isCrouching:false,isGrounded:true},.05);
  expect(pose.y).toBeCloseTo(2.7);expect(pose.x).toBe(1);expect(pose.z).toBe(3);
});
it('sanitizes persisted settings against invalid numbers and CSS values',()=>{
  expect(parseSettings({fov:999,sensitivity:NaN,volume:-1,crosshair:'url(example)',reducedEffects:true})).toEqual({fov:110,sensitivity:1,volume:0,crosshair:'#ffffff',reducedEffects:true,controls:'auto'});
});
