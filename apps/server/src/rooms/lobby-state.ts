import { schema, t, type SchemaType } from '@colyseus/schema';
import { ARENA, MIN_PLAYERS, GAMEPLAY, type MatchPhase, type Team, type PlayerStatus, type GameMode, type MapId, type WeaponId, type MatchResult } from '@ice-water/shared';
export const PlayerState = schema({
  playerId: t.string().default(''), displayName: t.string().default(''),
  team: t.string<Team>().default('unassigned'), isConnected: t.boolean().default(true), isBot: t.boolean().default(false),
  reconnectDeadline: t.number().default(0),
  x: t.float32().default(0), y: t.float32().default(0), z: t.float32().default(0),
  yaw: t.float32().default(0), pitch: t.float32().default(0),
  velocityX: t.float32().default(0), velocityZ: t.float32().default(0),
  verticalVelocity: t.float32().default(0), isGrounded: t.boolean().default(true), inputSequence: t.uint32().default(0),
  status: t.string<PlayerStatus>().default('alive'), protectedUntil: t.number().default(0),
  isSliding: t.boolean().default(false), isCrouching: t.boolean().default(false),
  slideUntil: t.number().default(0), slideReadyAt: t.number().default(0),
  hp: t.float32().default(GAMEPLAY.maxHp), kills: t.uint32().default(0), deaths: t.uint32().default(0),
  currentWeaponSlot: t.uint8().default(0), primaryWeapon: t.string<WeaponId>().default('assault-rifle'),
  weaponId: t.string<WeaponId>().default('assault-rifle'), ammo: t.uint16().default(30), reserveAmmo: t.uint16().default(120),
  reloadUntil: t.number().default(0), fireReadyAt: t.number().default(0), respawnAt: t.number().default(0),
  spawnGeneration: t.uint32().default(0), lastKillerId: t.string().default(''),
  lastDeathWeapon: t.string<WeaponId>().default('assault-rifle'), ping: t.uint16().default(0),
}, 'PlayerState');
export type PlayerState = SchemaType<typeof PlayerState>;
export const LobbyState = schema({
  inviteCode: t.string().default(''), hostPlayerId: t.string().default(''),
  phase: t.string<MatchPhase>().default('lobby'), phaseDeadline: t.number().default(0), serverTime: t.number().default(0),
  maxPlayers: t.uint16().default(150), minPlayers: t.uint8().default(MIN_PLAYERS),
  arenaHalfExtent: t.float32().default(ARENA.halfExtent), gameMode: t.string<GameMode>().default('ffa'), mapId: t.string<MapId>().default('frostline'),
  iceScore: t.uint16().default(0), waterScore: t.uint16().default(0),
  matchWinner: t.string().default(''), resultReason: t.string<MatchResult['reason'] | ''>().default(''),
  players: t.map(PlayerState),
}, 'LobbyState');
export type LobbyState = SchemaType<typeof LobbyState>;
