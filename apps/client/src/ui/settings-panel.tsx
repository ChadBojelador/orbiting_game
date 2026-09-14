import type { FpsSettings } from '../game/fps-settings.js';
export function SettingsPanel({value,onChange,onClose}:{value:FpsSettings;onChange:(v:FpsSettings)=>void;onClose:()=>void}){
  return <section className="settings-panel" role="dialog" aria-label="Settings" aria-modal="true">
    <h2>Settings</h2>
    <label htmlFor="controls">Controls</label>
    <select id="controls" value={value.controls} onChange={e=>onChange({...value,controls:e.target.value as FpsSettings['controls']})}>
      <option value="auto">Automatic</option><option value="touch">Touch controls</option><option value="mouse">Keyboard and mouse</option>
    </select>
    <label htmlFor="sensitivity">Look sensitivity <output>{value.sensitivity.toFixed(1)}</output><input id="sensitivity" type="range" min="0.2" max="3" step="0.1" value={value.sensitivity} onChange={e=>onChange({...value,sensitivity:Number(e.target.value)})}/></label>
    <label htmlFor="fov">Field of view <output>{value.fov}°</output><input id="fov" type="range" min="90" max="110" value={value.fov} onChange={e=>onChange({...value,fov:Number(e.target.value)})}/></label>
    <label htmlFor="volume">Master volume <output>{Math.round(value.volume*100)}%</output><input id="volume" type="range" min="0" max="1" step="0.05" value={value.volume} onChange={e=>onChange({...value,volume:Number(e.target.value)})}/></label>
    <label htmlFor="music-volume">Music volume <output>{Math.round(value.musicVolume*100)}%</output><input id="music-volume" type="range" min="0" max="1" step="0.05" value={value.musicVolume} onChange={e=>onChange({...value,musicVolume:Number(e.target.value)})}/></label>
    <label htmlFor="sfx-volume">SFX volume <output>{Math.round(value.sfxVolume*100)}%</output><input id="sfx-volume" type="range" min="0" max="1" step="0.05" value={value.sfxVolume} onChange={e=>onChange({...value,sfxVolume:Number(e.target.value)})}/></label>
    <label className="check-label"><input type="checkbox" checked={value.isMuted} onChange={e=>onChange({...value,isMuted:e.target.checked})}/>Mute all audio</label>
    <label>Crosshair color<input type="color" value={value.crosshair} onChange={e=>onChange({...value,crosshair:e.target.value})}/></label>
    <label className="check-label"><input type="checkbox" checked={value.reducedEffects} onChange={e=>onChange({...value,reducedEffects:e.target.checked})}/>Reduced effects</label>
    <button className="primary" onClick={onClose} autoFocus>Done</button>
  </section>;
}
