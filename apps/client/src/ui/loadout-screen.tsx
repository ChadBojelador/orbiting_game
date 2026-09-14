import { WEAPONS,type WeaponId } from '@ice-water/shared';
const primaries:WeaponId[]=['assault-rifle','smg','shotgun','sniper'];
export function LoadoutScreen({value,onChange,disabled=false}:{value:WeaponId;onChange:(id:WeaponId)=>void;disabled?:boolean}){
  const weapon=WEAPONS[value];
  return <section className="loadout" aria-label="Loadout"><h3>Loadout</h3>
    <label htmlFor="primary-weapon">Primary weapon</label>
    <select id="primary-weapon" value={value} onChange={e=>onChange(e.target.value as WeaponId)} disabled={disabled}>{primaries.map(id=><option key={id} value={id}>{WEAPONS[id].name}</option>)}</select>
    <p>{weapon.damage}{weapon.pelletsPerShot>1?` × ${weapon.pelletsPerShot}`:''} damage · {weapon.magazineSize} rounds · {weapon.range} m range</p>
    <small>2 · Snowmelt pistol &nbsp; 3 · Ice Pick</small></section>;
}
