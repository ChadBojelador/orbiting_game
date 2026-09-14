import {expect,it} from 'vitest';
import {LobbyState,PlayerState} from './lobby-state.js';
import {LobbyController} from './lobby-controller.js';
function fixture(count:number){const state=new LobbyState();for(let i=0;i<count;i++){const p=new PlayerState();p.playerId=String(i);state.players.set(p.playerId,p);}state.hostPlayerId='0';return {state,controller:new LobbyController(state,1000,()=>0)};}
it('allows solo practice while rejecting non-hosts and repeated starts',()=>{
  const {state,controller}=fixture(1);expect(controller.start('intruder',0)).toContain('host');
  expect(controller.start('0',0)).toBeNull();expect(controller.start('0',1)).toContain('already');
  controller.tick(999);expect(state.phase).toBe('countdown');controller.tick(1000);expect(state.phase).toBe('playing');expect(state.players.get('0')!.team).toBe('none');
});
it('cancels a countdown with no connected players and transfers host',()=>{
  const {state,controller}=fixture(1);controller.start('0',0);state.players.get('0')!.isConnected=false;
  controller.tick(1000);controller.transferHost();expect(state.phase).toBe('lobby');expect(state.hostPlayerId).toBe('');
});
it('balances odd TDM populations and rejects oversized duels',()=>{
  const {state,controller}=fixture(5);state.gameMode='tdm';controller.start('0',0);controller.tick(1000);
  expect([...state.players.values()].filter(p=>p.team==='ice')).toHaveLength(3);
  const duel=fixture(3);duel.state.gameMode='duel';expect(duel.controller.start('0',0)).toContain('two');
});
