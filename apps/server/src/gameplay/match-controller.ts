import { GAMEPLAY,type MatchResult,type ServerMessages } from '@ice-water/shared';
import type { LobbyState } from '../rooms/lobby-state.js';
type MatchEvent={type:'match/result';payload:MatchResult}|{type:'match/phase-changed';payload:ServerMessages['match/phase-changed']};
export interface MatchLifecycle {onResult?:(result:MatchResult,startedAt:number,completedAt:number)=>void;onResultExpired?:()=>void}
export class MatchController {
  private hasStarted=false;private startedAt=0;private hasExpired=false;
  constructor(private readonly state:LobbyState,private readonly emit:(event:MatchEvent)=>void,private readonly onStart:(now:number)=>void,private readonly lifecycle:MatchLifecycle={}){}
  start(now:number):void {
    if(this.hasStarted)return;
    this.hasStarted=true;this.startedAt=now;this.state.phase='playing';
    this.state.phaseDeadline=now+(this.state.gameMode==='duel'?GAMEPLAY.duelTimeLimitMs:GAMEPLAY.ffaTimeLimitMs);
    this.onStart(now);this.changed(now);
  }
  tick(now:number):boolean {
    if(!this.hasStarted)return false;
    if(this.state.phase==='finished'){this.state.phase='intermission';this.changed(now);return true;}
    if(this.state.phase==='intermission'){
      if(!this.hasExpired && now>=this.state.phaseDeadline){this.hasExpired=true;this.lifecycle.onResultExpired?.();return true;}return false;
    }
    if(this.state.phase!=='playing')return false;
    const limit=this.state.gameMode==='tdm'?GAMEPLAY.tdmScoreLimit:this.state.gameMode==='duel'?GAMEPLAY.duelScoreLimit:GAMEPLAY.ffaScoreLimit;
    const scores=this.state.gameMode==='tdm'
      ? [{id:'ice',score:this.state.iceScore},{id:'water',score:this.state.waterScore}]
      : [...this.state.players.values()].filter(p=>p.team!=='unassigned').map(p=>({id:p.playerId,score:p.kills}));
    scores.sort((a,b)=>b.score-a.score);
    const leader=scores[0];
    const hasScoreLimit=(leader?.score??0)>=limit;
    if(!hasScoreLimit && now<this.state.phaseDeadline)return false;
    const winner=!leader || leader.score===scores[1]?.score?'draw':leader.id;
    const result:MatchResult={winner,reason:hasScoreLimit?'score-limit':'time-limit',gameMode:this.state.gameMode};
    const completedAt=hasScoreLimit?now:this.state.phaseDeadline;
    this.state.phase='finished';this.state.matchWinner=winner;this.state.resultReason=result.reason;
    this.state.phaseDeadline=completedAt+GAMEPLAY.intermissionMs;
    this.emit({type:'match/result',payload:result});this.changed(now);
    this.lifecycle.onResult?.(result,this.startedAt,completedAt);return true;
  }
  private changed(now:number):void {
    this.emit({type:'match/phase-changed',payload:{phase:this.state.phase,phaseDeadline:this.state.phaseDeadline,serverTime:now}});
  }
}
