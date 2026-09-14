import { GAMEPLAY } from '../constants/gameplay.js';
import type { Position, SpatialPosition, MoveInput } from '../protocol/gameplay.js';

export interface ArenaBlock extends SpatialPosition { id: string; width: number; depth: number; height: number }
export interface ArenaRamp extends Position { id: string; width: number; depth: number; height: number; direction: 1 | -1 }
export const ARENA = { halfExtent: 40 } as const;
export const ARENA_BLOCKS: readonly ArenaBlock[] = [
  { id:'north', x:0,y:0,z:-40,width:80,depth:1,height:7 },
  { id:'south', x:0,y:0,z:40,width:80,depth:1,height:7 },
  { id:'west', x:-40,y:0,z:0,width:1,depth:80,height:7 },
  { id:'east', x:40,y:0,z:0,width:1,depth:80,height:7 },
  ...[-1,1].flatMap(side => [
    { id:'lab-'+side, x:side*13,y:0,z:0,width:3,depth:18,height:5 },
    { id:'lane-n-'+side, x:side*13,y:0,z:-25,width:3,depth:10,height:4 },
    { id:'lane-s-'+side, x:side*13,y:0,z:25,width:3,depth:10,height:4 },
    ...[-24,-8,8,24].map((z,i) => ({ id:'cover-'+side+'-'+i, x:side*(i%2 ? 30 : 24),y:0,z,width:4,depth:3,height:i%2 ? 1.2:2.4 })),
    { id:'mid-'+side, x:side*5,y:0,z:side*14,width:4,depth:3,height:1.3 },
    { id:'catwalk-'+side,x:side*29,y:0,z:0,width:6,depth:10,height:3 },
  ]),
  {id:'reactor',x:0,y:0,z:0,width:5,depth:5,height:3.5},
];
export const ARENA_RAMPS: readonly ArenaRamp[] = [-1,1].flatMap(side => [
  {id:'ramp-n-'+side,x:side*29,z:-10,width:6,depth:10,height:3,direction:1 as const},
  {id:'ramp-s-'+side,x:side*29,z:10,width:6,depth:10,height:3,direction:-1 as const},
]);
export const SPAWN_POINTS: readonly Position[] = [
  {x:-34,z:-34},{x:-22,z:-34},{x:0,z:-34},{x:22,z:-34},{x:34,z:-34},
  {x:-34,z:34},{x:-22,z:34},{x:0,z:34},{x:22,z:34},{x:34,z:34},
  {x:-35,z:-18},{x:-35,z:18},{x:35,z:-18},{x:35,z:18},{x:-6,z:-26},{x:6,z:26},
];
export const ICE_PATCHES = [{x:0,z:-21,width:12,depth:9},{x:0,z:21,width:12,depth:9}] as const;
export const WATER_PATCHES = [{x:-20,z:0,width:4,depth:34},{x:20,z:0,width:4,depth:34}] as const;
const inside = (p: Position, b: Position & {width:number;depth:number}, margin=0) => Math.abs(p.x-b.x) <= b.width/2+margin && Math.abs(p.z-b.z) <= b.depth/2+margin;
export function surfaceAt(p: Position): 'metal'|'ice'|'water' {
  if (terrainHeightAt(p)>0.1) return 'metal';
  if (ICE_PATCHES.some(b => inside(p,b))) return 'ice';
  return WATER_PATCHES.some(b=>inside(p,b))?'water':'metal';
}
export function terrainHeightAt(p: Position): number {
  for (const ramp of ARENA_RAMPS) if(inside(p,ramp)) return ramp.height * (0.5 + ramp.direction*(p.z-ramp.z)/ramp.depth);
  for (const b of ARENA_BLOCKS) if(inside(p,b)) return b.y+b.height;
  return 0;
}
export function createSpawnPoints(): Position[] { return SPAWN_POINTS.map(p=>({...p})); }
export function distanceSquared(a: Position,b: Position): number { return (a.x-b.x)**2+(a.z-b.z)**2; }
export function distanceSquared3d(a: SpatialPosition,b: SpatialPosition): number { return distanceSquared(a,b)+(a.y-b.y)**2; }
export function bodyHeight(p: {isSliding:boolean;isCrouching:boolean}): number {
  return p.isSliding || p.isCrouching ? GAMEPLAY.crouchHeight : GAMEPLAY.playerHeight;
}
export function eyeHeight(p: {isSliding:boolean;isCrouching:boolean}): number {
  return p.isSliding ? GAMEPLAY.slideEyeHeight : p.isCrouching ? GAMEPLAY.crouchEyeHeight : GAMEPLAY.playerEyeHeight;
}
export function isWalkable(p: Position, halfExtent:number=ARENA.halfExtent, y=0, height:number=GAMEPLAY.playerHeight): boolean {
  const r=GAMEPLAY.playerRadius;
  if(Math.abs(p.x)>halfExtent-r || Math.abs(p.z)>halfExtent-r) return false;
  if(ARENA_BLOCKS.some(b=>inside(p,b,r) && y+0.32<b.y+b.height && y+height>b.y)) return false;
  // A ramp is solid from the ground to its slope. Its sides cannot be climbed.
  return terrainHeightAt(p) <= y+0.32;
}
export function moveKinematic(p: Position, input: Position, seconds:number, halfExtent:number=ARENA.halfExtent, speed:number=GAMEPLAY.moveSpeed, y=terrainHeightAt(p), height:number=GAMEPLAY.playerHeight): Position {
  const magnitude=Math.max(1,Math.hypot(input.x,input.z));
  const dx=input.x/magnitude*speed*seconds, dz=input.z/magnitude*speed*seconds;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.15));
  const next={x:p.x,z:p.z};
  let floor=y;
  for(let i=0;i<steps;i++){
    const x={x:next.x+dx/steps,z:next.z};
    if(isWalkable(x,halfExtent,floor,height)) next.x=x.x;
    const z={x:next.x,z:next.z+dz/steps};
    if(isWalkable(z,halfExtent,floor,height)) next.z=z.z;
    const sampled=terrainHeightAt(next);
    if(sampled<=floor+0.32 && sampled>floor) floor=sampled;
  }
  return next;
}
export interface VerticalMotion { y:number; verticalVelocity:number; isGrounded:boolean }
export function advanceVerticalMotion(previous:VerticalMotion, position:Position, seconds:number, wantsJump:boolean): VerticalMotion {
  const floor=terrainHeightAt(position);
  let velocity=previous.verticalVelocity;
  if(wantsJump && previous.isGrounded) velocity=GAMEPLAY.jumpSpeed;
  let y=previous.y;
  if(!previous.isGrounded || velocity>0 || y>floor+0.06){
    y+=velocity*seconds-0.5*GAMEPLAY.gravity*seconds*seconds;
    velocity-=GAMEPLAY.gravity*seconds;
  }
  if(y<=floor) return {y:floor,verticalVelocity:0,isGrounded:true};
  return {y,verticalVelocity:velocity,isGrounded:false};
}
export interface MovementState extends SpatialPosition,VerticalMotion {
  velocityX:number;velocityZ:number;isSliding:boolean;isCrouching:boolean;
  slideUntil:number;slideReadyAt:number;
}
export function simulateMovement(p:MovementState,input:MoveInput,now:number,seconds=GAMEPLAY.tickMs/1000,speedMultiplier=1): MovementState {
  const next:MovementState={x:p.x,y:p.y,z:p.z,velocityX:p.velocityX,velocityZ:p.velocityZ,verticalVelocity:p.verticalVelocity,
    isGrounded:p.isGrounded,isSliding:p.isSliding,isCrouching:p.isCrouching,slideUntil:p.slideUntil,slideReadyAt:p.slideReadyAt};
  const length=Math.max(1,Math.hypot(input.x,input.z));
  const x=input.x/length,z=input.z/length;
  const surface=surfaceAt(p);
  if(next.isSliding && (now>=next.slideUntil || input.jump)) next.isSliding=false;
  if(input.slide && !next.isSliding && p.isGrounded && now>=p.slideReadyAt && Math.hypot(p.velocityX,p.velocityZ)>=GAMEPLAY.slideMinSpeedThreshold) {
    next.isSliding=true;next.slideUntil=now+GAMEPLAY.slideDurationMs;next.slideReadyAt=now+GAMEPLAY.slideCooldownMs;
    const speed=Math.hypot(p.velocityX,p.velocityZ);
    next.velocityX=p.velocityX/speed*GAMEPLAY.slideSpeed*(surface==='ice'?GAMEPLAY.slideIceBonus:1);
    next.velocityZ=p.velocityZ/speed*GAMEPLAY.slideSpeed*(surface==='ice'?GAMEPLAY.slideIceBonus:1);
  }
  next.isCrouching=!!input.crouch && !next.isSliding;
  if(next.isSliding){
    const friction=surface==='ice'?GAMEPLAY.iceFriction:GAMEPLAY.slideFriction;
    next.velocityX*=friction;next.velocityZ*=friction;
  }else{
    const speed=GAMEPLAY.moveSpeed*speedMultiplier*(next.isCrouching?GAMEPLAY.crouchMultiplier:input.sprint?GAMEPLAY.sprintMultiplier:1)*(surface==='water'?GAMEPLAY.waterSpeedPenalty:1);
    const alpha=p.isGrounded?(surface==='ice'?0.08:0.82):GAMEPLAY.airControlFactor;
    next.velocityX+=(x*speed-next.velocityX)*alpha;next.velocityZ+=(z*speed-next.velocityZ)*alpha;
  }
  const travelSpeed=Math.hypot(next.velocityX,next.velocityZ);
  const moved=moveKinematic(p,{x:travelSpeed?next.velocityX/travelSpeed:0,z:travelSpeed?next.velocityZ/travelSpeed:0},seconds,ARENA.halfExtent,travelSpeed,p.y,bodyHeight(next));
  if(Math.abs(moved.x-p.x)<0.00001) next.velocityX=0;
  if(Math.abs(moved.z-p.z)<0.00001) next.velocityZ=0;
  Object.assign(next,moved,advanceVerticalMotion(p,moved,seconds,!!input.jump));
  return next;
}
/** Slab intersection, returning distance along a normalized ray. */
export function rayBox(origin:SpatialPosition,direction:SpatialPosition,min:SpatialPosition,max:SpatialPosition,range:number): number | null {
  let near=0,far=range;
  for(const axis of ['x','y','z'] as const){
    const d=direction[axis],o=origin[axis];
    if(Math.abs(d)<1e-9){if(o<min[axis] || o>max[axis])return null;continue;}
    const a=(min[axis]-o)/d,b=(max[axis]-o)/d;
    near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
    if(near>far)return null;
  }
  return near;
}
export function worldRayDistance(origin:SpatialPosition,direction:SpatialPosition,range:number): number {
  let nearest=range;
  if(direction.y<0) nearest=Math.min(nearest,Math.max(0,-origin.y/direction.y));
  for(const b of ARENA_BLOCKS){
    const hit=rayBox(origin,direction,{x:b.x-b.width/2,y:b.y,z:b.z-b.depth/2},{x:b.x+b.width/2,y:b.y+b.height,z:b.z+b.depth/2},nearest);
    if(hit!==null)nearest=hit;
  }
  // Clip a ray against the five planar faces of each solid ramp wedge.
  for(const r of ARENA_RAMPS){
    const slope=r.direction*r.height/r.depth;
    const planes=[
      {n:{x:1,y:0,z:0},c:r.x+r.width/2},{n:{x:-1,y:0,z:0},c:-r.x+r.width/2},
      {n:{x:0,y:0,z:1},c:r.z+r.depth/2},{n:{x:0,y:0,z:-1},c:-r.z+r.depth/2},
      {n:{x:0,y:-1,z:0},c:0},{n:{x:0,y:1,z:-slope},c:r.height/2-slope*r.z},
    ];
    let lo=0,hi=nearest;
    for(const {n,c} of planes){
      const start=n.x*origin.x+n.y*origin.y+n.z*origin.z-c;
      const rate=n.x*direction.x+n.y*direction.y+n.z*direction.z;
      if(Math.abs(rate)<1e-9){if(start>0){hi=-1;break;}continue;}
      const t=-start/rate;
      if(rate<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    }
    if(lo<=hi)nearest=Math.min(nearest,lo);
  }
  return nearest;
}
export function lookDirection(yaw:number,pitch:number): SpatialPosition {
  return {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
}
export function hasGameplayLineOfSight(a:SpatialPosition,b:SpatialPosition):boolean {
  const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},length=Math.hypot(d.x,d.y,d.z);
  if(length<0.001)return true;
  return worldRayDistance(a,{x:d.x/length,y:d.y/length,z:d.z/length},length)>=length-0.001;
}
