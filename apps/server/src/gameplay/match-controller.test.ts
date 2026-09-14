import {describe,expect,it,vi} from 'vitest';
import {GAMEPLAY} from '@ice-water/shared';
import {LobbyState,PlayerState} from '../rooms/lobby-state.js';
import {MatchController} from './match-controller.js';
function fixture(){
  const state=new LobbyState();for(const id of ['a','b']){const p=new PlayerState();p.playerId=id;p.team='none';state.players.set(id,p);}
  const onResult=vi.fn(),onResultExpired=vi.fn(),start=vi.fn();const controller=new MatchController(state,()=>{},start,{onResult,onResultExpired});controller.start(1000);
  return {state,controller,onResult,onResultExpired,start};
}
describe('FPS match deadlines and scores',()=>{
  it('ends FFA at thirty kills and persists/disposes once through intermission',()=>{
    const {state,controller,onResult,onResultExpired,start}=fixture();state.players.get('a')!.kills=30;
    controller.tick(1100);expect(state.phase).toBe('finished');expect(state.matchWinner).toBe('a');
    controller.tick(1150);expect(state.phase).toBe('intermission');controller.tick(1100+GAMEPLAY.intermissionMs);controller.tick(999999);
    expect(onResult).toHaveBeenCalledTimes(1);expect(onResultExpired).toHaveBeenCalledTimes(1);expect(start).toHaveBeenCalledTimes(1);
  });
  it('uses the exact time deadline and draws tied scores',()=>{
    const {state,controller,onResult}=fixture();const deadline=state.phaseDeadline;
    controller.tick(deadline-1);expect(state.phase).toBe('playing');
    controller.tick(deadline+500);expect(state.matchWinner).toBe('draw');
    expect(onResult.mock.calls[0]?.[2]).toBe(deadline);
  });
  it('ends TDM by team score and duel by its configured score',()=>{
    const tdm=fixture();tdm.state.gameMode='tdm';tdm.state.iceScore=50;tdm.controller.tick(2000);expect(tdm.state.matchWinner).toBe('ice');
    const duel=fixture();duel.state.gameMode='duel';duel.state.players.get('b')!.kills=10;duel.controller.tick(2000);expect(duel.state.matchWinner).toBe('b');
  });
});
