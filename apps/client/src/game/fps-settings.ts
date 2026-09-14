export interface FpsSettings {
  sensitivity:number;fov:number;volume:number;musicVolume:number;sfxVolume:number;isMuted:boolean;
  crosshair:string;reducedEffects:boolean;controls:'auto'|'touch'|'mouse';
}
export const DEFAULT_SETTINGS:FpsSettings={sensitivity:1,fov:96,volume:0.35,musicVolume:0.55,sfxVolume:0.8,isMuted:false,crosshair:'#ffffff',reducedEffects:false,controls:'auto'};
export function parseSettings(value:unknown):FpsSettings {
  if(typeof value!=='object' || value===null)return {...DEFAULT_SETTINGS};
  const v=value as Record<string,unknown>;
  const number=(key:string,min:number,max:number,fallback:number)=>typeof v[key]==='number' && Number.isFinite(v[key])?Math.max(min,Math.min(max,v[key])):fallback;
  return {sensitivity:number('sensitivity',0.2,3,1),fov:number('fov',90,110,96),volume:number('volume',0,1,0.35),
    musicVolume:number('musicVolume',0,1,0.55),sfxVolume:number('sfxVolume',0,1,0.8),isMuted:v.isMuted===true,
    crosshair:typeof v.crosshair==='string' && /^#[0-9a-f]{6}$/i.test(v.crosshair)?v.crosshair:'#ffffff',reducedEffects:v.reducedEffects===true,controls:v.controls==='touch'||v.controls==='mouse'?v.controls:'auto'};
}
export function readSettings():FpsSettings {
  try{return parseSettings(JSON.parse(localStorage.getItem('ice-water/fps-settings')??'null'));}
  catch{return {...DEFAULT_SETTINGS};}
}
export function saveSettings(value:FpsSettings):void {try{localStorage.setItem('ice-water/fps-settings',JSON.stringify(value));}catch{/* Preferences still work for this session. */}}
