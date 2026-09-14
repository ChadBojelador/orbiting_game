import {expect,it} from 'vitest';
import {isMoveInput,isShootIntent,isWeaponSwitchIntent,isReloadIntent} from './gameplay.js';
it('rejects non-finite, excessive and forged input across FPS boundaries',()=>{
  expect(isMoveInput({sequence:1,x:1,z:0,yaw:0,pitch:0,slide:true})).toBe(true);
  for(const input of [{sequence:0,x:0,z:0},{sequence:1,x:2,z:0},{sequence:1,x:NaN,z:0},{sequence:1,x:0,z:0,pitch:Math.PI},{sequence:1,x:0,z:0,hp:100},{sequence:1,x:0,z:0,slide:'yes'}])expect(isMoveInput(input)).toBe(false);
  for(const input of [{yaw:Infinity,pitch:0},{yaw:0,pitch:0,victimId:'forged'},{yaw:0,pitch:2},{yaw:0,pitch:0,isAds:1}])expect(isShootIntent(input)).toBe(false);
  expect(isShootIntent({yaw:0,pitch:0,isAds:true})).toBe(true);
  expect(isWeaponSwitchIntent({slot:2})).toBe(true);expect(isWeaponSwitchIntent({slot:3})).toBe(false);
  expect(isReloadIntent({})).toBe(true);expect(isReloadIntent({ammo:30})).toBe(false);
});
