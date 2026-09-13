# Transform Ice Ice Water into an Arena FPS

## Codebase Analysis

### Current Architecture

| Layer | Tech | Key Files |
|-------|------|-----------|
| **Client** | Three.js + React + Vite | `apps/client/` |
| **Server** | Colyseus + Express + Node.js | `apps/server/` |
| **Shared** | Pure TypeScript | `packages/shared/` |
| **Networking** | Colyseus WebSocket rooms | `@colyseus/sdk` ↔ `@colyseus/core` |
| **State sync** | `@colyseus/schema` | Automatic delta patching |

### Existing Systems Inventory

| System | Current Implementation | Reuse Assessment |
|--------|----------------------|------------------|
| **Player Controller** | [`game-input.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/input/game-input.ts) — WASD keyboard + touch joystick, camera-relative axes, smooth acceleration | ⚡ **Extend** — Good foundation; add slide, crouch, weapon keys, pointer lock |
| **Camera** | [`third-person-camera.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/game/third-person-camera.ts) — 3rd-person orbital with collision | ❌ **Replace** — Need FPS first-person camera with pointer lock |
| **Movement (shared)** | [`arena.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/packages/shared/src/simulation/arena.ts) — `moveKinematic()`, `advanceVerticalMotion()`, terrain height, collision vs arena blocks | ⚡ **Extend** — Reuse kinematic movement core; add slide physics, sprint, friction surfaces |
| **Weapons** | Frost launcher projectiles only (3rd-person throw) | ❌ **Replace** — Need hitscan/projectile FPS weapons with ADS, recoil, spread |
| **Shooting** | Projectile-based freeze (`frost-projectiles.ts`, server collision in `gameplay-controller.ts`) | ❌ **Replace** — Need raycasting hitscan system; keep projectile architecture for future projectile weapons |
| **Map/World** | [`world-layout.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/world/world-layout.ts) — Massive procedural island terrain (400×400 units), organic biomes | ❌ **Replace** — Need compact arena map (~80×80); build "Frostline" |
| **Collision** | Block AABB collision in `isWalkable()`, `moveKinematic()` | ⚡ **Extend** — Same pattern works for arena walls/cover; need new map geometry |
| **Health** | None (freeze-tag has freeze/active/eliminated states) | ✨ **New** — Need HP system, damage application, death |
| **Multiplayer** | Colyseus rooms, authoritative server, client prediction, remote interpolation | ✅ **Reuse** — Excellent foundation; extend for shots/damage/respawns |
| **UI** | React HUD, lobby, results screen, touch controls | ⚡ **Extend** — Reuse React shell; redesign HUD for FPS (crosshair, ammo, HP, kill feed) |
| **Game Loop** | Server tick at 50ms (20Hz), `MatchController` phases, `GameplayController` step | ⚡ **Extend** — Adapt phase machine for FFA/TDM; add respawn/score tracking |
| **Spawn System** | Grid-based spawn point generation in village area | ❌ **Replace** — Need placed spawn points with intelligent selection |
| **Network Protocol** | `input/move`, `action/frost-throw`, `action/rescue-*` messages | ⚡ **Extend** — Add `input/look`, `action/shoot`, `action/reload`, `action/switch-weapon` |
| **State Schema** | [`lobby-state.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/server/src/rooms/lobby-state.ts) — Colyseus schema with PlayerState, projectiles | ⚡ **Extend** — Add hp, kills, deaths, currentWeapon, ammo fields |
| **Constants** | [`gameplay.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/packages/shared/src/constants/gameplay.ts) — Centralized gameplay values | ⚡ **Extend** — Add FPS movement/weapon/match constants |
| **Prediction** | [`player-motion.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/network/player-motion.ts) — Client-side prediction + reconciliation | ⚡ **Extend** — Add slide/sprint state to prediction |
| **Room lifecycle** | [`private-room.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/server/src/rooms/private-room.ts) — Auth, join, drop, reconnect, message routing | ✅ **Reuse** — Extend message handlers for new action types |
| **Bot runner** | [`bot-runner.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/server/src/simulation/bot-runner.ts) — Simple movement bots | ⚡ **Extend** — Eventually add shooting AI |
| **Auth/Guest** | Guest session, rate limiting | ✅ **Reuse** — Works as-is |
| **Database** | PostgreSQL match summaries | ✅ **Reuse** — Extend schema for FPS match data |

### Summary: What Changes

- **~40% reuse** — Networking, auth, room lifecycle, Colyseus infra, React shell, prediction framework, constants pattern, build pipeline
- **~30% extend** — Input, movement physics, state schema, protocol, game loop, HUD
- **~30% replace** — Camera (3rd→1st person), weapons (freeze→guns), map (island→arena), world rendering, spawn system

---

## User Review Required

> [!IMPORTANT]
> **This is a major architectural transformation.** The freeze-tag game loop (Ice vs Water, rescue, deep freeze, elimination) will be replaced with arena FPS mechanics (HP, death, respawn, weapons, score). The Colyseus networking, monorepo structure, build pipeline, and auth system will all survive.

> [!WARNING]
> **Existing tests** for freeze-tag gameplay, rescue mechanics, and frost projectiles will become invalid. They'll need to be replaced with tests for the new FPS systems. I'll keep the old test files around (renamed with a `.freeze-tag-backup` suffix) until new tests are solid.

> [!IMPORTANT]
> **PRD.md and ARCHITECTURE.md** describe freeze-tag mechanics exclusively. Per AGENTS.md rules, I should update these documents as the source of truth changes. I will update them incrementally as each phase completes, documenting the FPS pivot.

---

## Open Questions

> [!IMPORTANT]
> **Minimum player count**: The current game requires 6 players minimum. For an arena FPS, should we lower this to **1** (solo play/testing) or **2** (minimum for a real match)? I recommend **1** for dev/testing convenience with the existing bot system.

> [!IMPORTANT]
> **Existing freeze-tag mode**: Should the original freeze-tag mode be preserved as an alternate game mode, or fully replaced? Your request suggests full replacement, but preserving it as a legacy mode is possible with moderate extra work.

> [!IMPORTANT]
> **Mobile/touch support**: The current game has touch controls. The FPS redesign (pointer lock, precision aiming) is inherently desktop-first. Should I remove touch control support or leave a degraded mobile experience?

---

## Proposed Changes

### Phase 1 — FPS Movement & Camera (Start Here)

The foundation that everything else builds on. Movement must feel excellent before proceeding.

---

#### Shared Constants & Types

##### [MODIFY] [`gameplay.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/packages/shared/src/constants/gameplay.ts)
- Add FPS movement constants: `moveSpeed` (increase from 6 → 12), `sprintSpeed`, `slideSpeed`, `slideDuration`, `slideCooldown`, `crouchSpeed`, `airControlFactor`, `friction`, `iceFriction`, `waterSpeedPenalty`
- Add weapon/combat constants (placeholder values for Phase 2)
- Add match constants for FPS modes: `ffa/scoreLimit`, `ffa/timeLimit`, `respawnDelay`

##### [MODIFY] [`gameplay.ts` (protocol)](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/packages/shared/src/protocol/gameplay.ts)
- Add `MoveInput.pitch` (vertical look angle for shooting later)
- Add `MoveInput.slide` boolean flag
- Add `MoveInput.sprint` boolean flag
- Update `PlayerStatus` to include `'dead'`
- Add `ShootIntent`, `ReloadIntent`, `WeaponSwitchIntent` types (for Phase 2)

##### [MODIFY] [`lobby.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/packages/shared/src/protocol/lobby.ts)
- Add `hp`, `kills`, `deaths`, `currentWeaponSlot`, `ammo`, `reserveAmmo` to `PlayerView`
- Add `gameMode` to `LobbyView`
- Update `MatchPhase` for FPS: add `'playing'`, `'intermission'`
- Remove freeze-tag specific fields from view interfaces

---

#### Arena Simulation (Shared)

##### [MODIFY] [`arena.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/packages/shared/src/simulation/arena.ts)
- Replace massive island terrain with compact arena map definition (~80×80 units)
- Define Frostline map: walls, floors, cover blocks, ice patches, water areas, spawn points, ramps
- Keep `moveKinematic()` core but add slide physics, friction modifiers
- Add `slideKinematic()` function for slide movement
- Replace `createSpawnPoints()` with placed FPS spawn points (12-16 per map)
- Keep AABB collision pattern but update block definitions for arena geometry
- Add ice-surface detection for momentum mechanics

---

#### Client — First-Person Camera

##### [NEW] `apps/client/src/game/first-person-camera.ts`
- Pointer lock based camera with mouse look
- Configurable sensitivity, FOV (90-110)
- Pitch clamping (-89° to +89°)
- Subtle weapon sway
- Landing camera dip
- Slide camera lower
- No excessive camera shake

##### [DELETE] `apps/client/src/game/third-person-camera.ts` (keep test file temporarily)

---

#### Client — Input System

##### [MODIFY] [`game-input.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/input/game-input.ts)
- Add pointer lock request/release
- Add mouse look (delta → yaw/pitch)
- Add Shift → slide
- Add C → crouch/alternate slide
- Add Left Mouse → shoot
- Add Right Mouse → ADS
- Add R → reload
- Add 1/2/3/4 → weapon slots
- Add mouse wheel → cycle weapons
- Add Tab → scoreboard (hold)
- Remove frost-throw and rescue inputs
- Remove touch joystick (or flag as disabled)

---

#### Client — Game Scene

##### [MODIFY] [`game-scene.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/game/game-scene.ts)
- Switch from `ThirdPersonCamera` to `FirstPersonCamera`
- Implement pointer lock on canvas click
- Position camera at player eye height (1.6m standing, 1.0m sliding)
- Remove 3rd-person follow logic
- Adjust camera FOV from 52 → 90-100
- Update render loop for FPS perspective

---

#### Client — Movement Prediction

##### [MODIFY] [`player-motion.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/network/player-motion.ts)
- Add slide state to `LocalPrediction`
- Add `applySlide()` prediction
- Update `apply()` for new movement parameters
- Handle slide→jump transition in prediction

---

#### Server — Movement Processing

##### [MODIFY] [`gameplay-controller.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/server/src/gameplay/gameplay-controller.ts)
- Process slide flag in `step()`
- Apply slide physics on server
- Validate slide cooldown
- Remove frost-throw, rescue, and freeze mechanics (Phase 1 only removes, Phase 2 adds combat)

---

#### Server — State Schema

##### [MODIFY] [`lobby-state.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/server/src/rooms/lobby-state.ts)
- Add `hp: t.float32().default(100)` to PlayerState
- Add `kills: t.uint32().default(0)` 
- Add `deaths: t.uint32().default(0)`
- Add `currentWeaponSlot: t.uint8().default(0)`
- Add `ammo: t.uint16().default(30)`
- Add `reserveAmmo: t.uint16().default(120)`
- Add `pitch: t.float32().default(0)` (for remote player rendering)
- Add `isSliding: t.boolean().default(false)`
- Keep `x, y, z, yaw, verticalVelocity, isGrounded, inputSequence`

---

### Phase 2 — Combat System

##### [NEW] `packages/shared/src/constants/weapons.ts`
- Weapon data definitions: assault rifle, SMG, shotgun, sniper, pistol, melee
- All values configurable: damage, headshot multiplier, fire rate, magazine, spread, recoil, range

##### [NEW] `apps/server/src/gameplay/damage-system.ts`
- Server-authoritative hitscan: raycast from player eye position along look direction
- Headshot detection (head hitbox = upper 25% of player capsule)
- Damage application, death check, kill credit
- Knockback on hit

##### [NEW] `apps/server/src/gameplay/weapon-controller.ts`
- Server-side weapon state: ammo, reload timer, fire rate enforcement, weapon switching
- Validate fire requests against cooldowns and ammo

##### [NEW] `apps/client/src/game/weapon-renderer.ts`
- First-person weapon model (simple geometry)
- Muzzle flash effect
- Recoil animation (camera kick + model kick)
- ADS zoom + position transition
- Reload animation
- Weapon switch animation

##### [NEW] `apps/client/src/game/hit-effects.ts`
- Hit markers (crosshair flash on hit)
- Headshot marker (different color/sound)
- Kill confirmation
- Directional damage indicators
- Bullet impact particles on walls/ground

---

### Phase 3 — Match Loop & Respawns

##### [NEW] `apps/server/src/gameplay/spawn-manager.ts`
- Intelligent spawn selection from 12-16 placed points
- Score each spawn: distance from enemies, line of sight check, recent death proximity
- Optional 1s spawn protection (removed on fire)

##### [MODIFY] [`match-controller.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/server/src/gameplay/match-controller.ts)
- Replace freeze-tag phase machine with FPS match states: `waiting → countdown → playing → finished → intermission`
- FFA mode: first to 30 kills or 5-minute timer
- TDM mode: first team to 50 kills or 5-minute timer
- 2-3 second respawn delay
- Score tracking and winner determination

##### [MODIFY] [`gameplay-controller.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/server/src/gameplay/gameplay-controller.ts)
- Add death/respawn processing in `step()`
- Remove freeze/rescue/deep-freeze logic
- Add kill feed events

---

### Phase 4 — Frostline Map

##### [NEW] `apps/client/src/world/frostline-map.ts`
- Compact 3-lane arena map (~80×80 units)
- Geometry: walls, floors, crates, ice blocks, catwalks, ramps
- Visual theme: frozen industrial research complex
- Ice surface patches, water channels
- Cover objects every ~5m in combat areas

##### [MODIFY] [`arena.ts`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/packages/shared/src/simulation/arena.ts)
- Replace terrain/biome system with Frostline collision geometry
- Frostline spawn point definitions
- Ice/water surface detection functions

---

### Phase 5 — HUD & UI

##### [MODIFY] [`game-hud.tsx`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/ui/game-hud.tsx)
- Bottom-left: HP bar
- Bottom-right: Ammo counter (magazine / reserve)
- Center: Dynamic crosshair
- Top-center: Timer + score
- Top-right: Kill feed
- Tab-hold: Scoreboard overlay

##### [NEW] `apps/client/src/ui/death-screen.tsx`
- "Eliminated by [PlayerName]" with weapon info
- Respawn countdown (3… 2… 1…)
- Minimal, fast transition

##### [NEW] `apps/client/src/ui/scoreboard.tsx`
- FFA: Player | Kills | Deaths | K/D | Ping
- TDM: Team Ice vs Team Water with player stats

##### [MODIFY] [`app.tsx`](file:///c:/Users/chadb/Desktop/New%20folder%20(13)/orbiting_game/apps/client/src/ui/app.tsx)
- Redesign main menu for FPS: Play, Loadout, Settings
- Play → Quick Play (FFA, TDM, 1v1)
- Settings panel: sensitivity, FOV, volume, crosshair
- Remove freeze-tag specific UI

---

### Phase 6 — Additional Weapons & Loadout

##### [NEW] `apps/client/src/ui/loadout-screen.tsx`
- Slot 1: Primary (AR, SMG, Shotgun, Sniper)
- Slot 2: Secondary (Pistol)
- Slot 3: Melee (Ice Pick)
- Weapon stats preview

---

### Phase 7 — Polish & Audio

##### [NEW] `apps/client/src/audio/audio-manager.ts`
- Gunshot, reload, empty mag, hit, headshot, kill sounds
- Footsteps (material-aware: metal, ice, water)
- Slide, jump, landing sounds
- Positional audio for enemy footsteps

---

## Verification Plan

### Automated Tests
After each phase:
```bash
npm run typecheck    # TypeScript compilation
npm run lint         # ESLint rules
npm run test         # Vitest unit tests
npm run build        # Production build validation
```

### Manual Verification — Phase 1
- WASD moves player immediately (no sluggish acceleration)
- Mouse look works with pointer lock
- Jump feels responsive, correct height
- Slide: camera dips, speed boost, smooth transition, cooldown works
- Slide→jump chains feel fluid
- Diagonal movement not faster than cardinal
- Player cannot walk through walls or slide through geometry
- Server validates all movement

### Manual Verification — Phase 2
- Left click fires weapon
- Recoil pattern is learnable
- ADS zooms and reduces spread
- Headshots deal bonus damage
- Hit markers appear on hit
- Kill confirmation appears on kill
- Ammo depletes, reload works (R key)
- Weapon switching (1/2/3) is responsive

### Manual Verification — Phase 3
- Death triggers 2-3s respawn countdown
- Player spawns away from enemies
- Kills/deaths track correctly
- Match ends at score limit or time limit
- Scoreboard shows correct data
