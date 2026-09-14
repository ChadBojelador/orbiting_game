# Ice Ice Water! Product Requirements

## Approved direction — 2026-09-14
The request to execute `implementation_plan.md` approves replacing freeze-tag with a browser arena FPS. Mobile support was explicitly retained. Previous requirements are historical in `docs/archive/freeze-tag-prd.md` and no longer govern gameplay. Product name, guest sessions, private invite rooms, authoritative server, and existing stack remain.

## Playable release
- First-person keyboard/mouse and mobile touch play in Frostline, an original approximately 80 × 80 metre frozen research arena with three lanes, cover, ramps, elevated routes, ice, and shallow water.
- WASD/arrows move, mouse aims with pointer lock, Space jumps, Shift slides, C crouches, and Control sprints. Mobile provides a movement stick, drag-to-look region, fire, aim, jump, slide, reload, weapon cycling, and scoreboard buttons.
- Movement, health, shots, damage, ammunition, cooldowns, death, respawn, teams, score, and match deadlines are server-authoritative. No physical player-to-player collision.
- Six weapon archetypes: assault rifle, SMG, shotgun, sniper, pistol, and ice pick. Choose a primary in the lobby; carry it alongside pistol and melee. ADS, recoil, spread, damage falloff, reloads, headshots, hit/kill feedback, and brief spawn protection are part of combat.
- Free-for-all: 30 kills or five minutes. Team deathmatch: 50 team kills or five minutes, balanced Ice/Water teams with friendly fire disabled. Duel: two players maximum, 10 kills or three minutes. Highest score wins at the deadline; tied highest scores draw. These are initial playtest values, not validated balance.
- One connected player may start solo practice (assumption adopted from the plan); two or more are needed for competition. Private rooms retain a configurable cap of 150. The compact arena is not yet validated for 150-player combat.
- Death returns a player after 2.5 seconds using a server-selected spawn. Protection lasts 1.5 seconds and ends upon firing. Disconnecting does not reset health, ammunition, score, or deadlines. Reserved disconnected bodies remain vulnerable; respawn waits for reconnection. Expired reservations become spectators and cannot rejoin that match.
- Lifecycle: lobby → countdown → playing → finished → intermission → closed. Results remain visible for eight seconds total, then players can create another room. There is no public matchmaking service; Play creates a private room in the selected mode.
- HUD: health, ammo, crosshair, timer, score, kill feed, damage/hit feedback, death countdown, and hold-Tab/touch scoreboard. Settings: sensitivity, 90–110 degree FOV, volume, crosshair color, and reduced effects.
- Original synthesized combat and movement cues, with positional remote shot/footstep presentation. Audio starts only after a user gesture.
- Match summaries and player kills/deaths are stored transactionally in PostgreSQL. No per-tick state or tokens are persisted.

## Access and reliability
Names are sanitized, temporary sessions signed, room entry invite-only, and all trust boundaries validated and rate-limited. Host departure transfers control. Countdown cancels when no eligible players remain. Fresh joins close at countdown; reconnection is reserved for 20–30 seconds (25 default). HTTPS/WSS is required outside local development.

Support modern WebGL 2 desktop and touch browsers. Target 60 FPS desktop and 30 FPS mobile; publish measured device/capacity limits before release. Input resets on blur, pointer-lock loss, disconnect, and hidden tabs. Prediction/interpolation must never award damage or results. Mobile portrait/landscape layouts must be usable without horizontal overflow.

## Asset policy
Veck.io informs broad arena-FPS qualities. The user reports having reuse permission; paths and applicable license must be inspected and retained before imports. Until then use repository-authored geometry/audio. Preserve source, author, permission scope, attribution, and modifications for every imported asset.

## Scope and release gates
No legacy freeze-tag mode, progression, ranked play, store, accounts, chat, physics engine, public matchmaking, or extra infrastructure. Values are centrally configurable. Public release requires rule/boundary tests, real WebSocket security/reconnection coverage, desktop/mobile browser flows, database checks, staged 20/50/100/150 gameplay load measurements, and device performance/accessibility playtests. Unverified gates remain open in `TASKS.md`.
