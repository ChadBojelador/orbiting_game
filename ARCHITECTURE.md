# Ice Ice Water! Architecture

## FPS pivot — 2026-09-14
`implementation_plan.md` was approved, with mobile support explicitly retained. Freeze-tag architecture is archived in `docs/archive/freeze-tag-architecture.md`. No new major runtime dependency is needed.

## Boundaries and stack
- `apps/client`: TypeScript, React HUD/lobby/settings, Three.js, Vite, pointer-lock/touch input, prediction, remote interpolation, Web Audio.
- `apps/server`: Node.js, Colyseus, Express invite/session APIs, validated fixed-step movement, authoritative combat/lifecycle, PostgreSQL repositories.
- `packages/shared`: protocol, configurable constants, pure map/collision/movement functions. No authority decisions, secrets, database, or rendering.
- One room belongs to one process. Live state stays in memory. No Redis, physics engine, alternate app structure, or client/server cross-imports.

## Simulation and combat
The server runs at 20 Hz. Sequenced movement is bounded and queued; message volume cannot purchase time. Server and prediction share 50 ms movement including velocity/friction, air control, jump, slide deadlines, crouch, sprint, and surface modifiers. Static collision uses substeps against shared Frostline geometry. Ramp heights are shared. Players do not block one another.

Shots carry bounded yaw/pitch and ADS intent, never a victim or claimed hit. Server weapon state owns per-slot ammo, reload/fire deadlines, server-random spread, and loadout eligibility. Hitscan begins at authoritative eye height and chooses the nearest player/static intersection. Headshots use the upper quarter of current standing/crouched volume. Damage/falloff, pellets, death credit, friendly-fire rejection, protection, knockback, and respawn are server-owned. No lag compensation: current-state hitscan over WebSockets is an explicit playtest tradeoff. Transport/tick-rate/rewind changes need latency evidence.

Spawns score enemy distance, visibility, and recent death location across 16 authored points. Reserved disconnected bodies remain vulnerable but cannot act or respawn before reconnecting. Firing removes protection. Input queues and speculative movement clear across death/respawn and disconnect.

## Lifecycle and protocol
Lobby → countdown → playing → finished → intermission → closed. Steps at/after the match deadline are rejected; earlier steps resolve before results. Score-limit resolution stops further simulation. Ties draw. Results persist once under a UUID and release invite/memberships once after an eight-second display.

Client messages: `input/move`, `action/shoot`, `action/reload`, `action/switch-weapon`, `room/start`, `room/configure`, `player/loadout`, `session/ping`. Events: `weapon/fired`, `player/hit`, `player/killed`, `player/respawned`, `match/phase-changed`, `match/result`, `session/pong`, `session/error`. Schema patches synchronize motion/stance, HP, current weapon/ammo/deadlines, scores, team/mode, server clock. Deploy client and server together: the freeze-tag protocol is replaced.

Inactive-slot ammo stays server-side. Hit markers/feed consume authoritative events. React does not drive per-frame movement. Camera/weapon animation uses the Three.js loop. Pointer-lock loss/blur neutralizes intent; mobile tracks independent pointers for concurrent look/movement/fire. Settings are validated local preferences.

## Lobby presentation

The pre-match client keeps one `LobbyScene` alive while React changes between main, play, game-mode, loadout, customization, party, profile, and settings panels. The scene owns its Three.js renderer, cinematic camera poses, loaded character instance, selected-weapon proxy, procedural frozen-facility environment, and low-cost effects. React communicates state changes through imperative setters; it never drives the render loop.

Lobby audio is application-scoped rather than panel-scoped. One Web Audio graph decodes and loops the repository-authored lobby track, shares persisted master/music/SFX/mute preferences, resumes after a valid interaction when autoplay is blocked, and fades out before the active match scene starts. Private-room creation remains the Play action; the lobby does not simulate a public matchmaking queue, friends service, progression, rank, currency, or cosmetic inventory.

## Security and access
Retain HMAC-SHA256 signed guests, timing-safe signature verification, per-tab storage, random eight-character invites, origins, 4 KiB payload cap, private/unlisted rooms. Public Colyseus matchmaking remains blocked; authenticated HTTP issues seats and WebSocket auth verifies sessions again. Never log tokens, connection strings, or unnecessary personal data.

Routes remain `/health`, `/ready`, `POST /api/guest-session`, `POST /api/rooms`, `POST /api/rooms/join`. Connected host configures mode in lobby. Duel configuration/start rejects more than two occupants. Host configuration/start and player loadout are validated and rate-limited. Every mutation checks unexpired sessions. Movement/actions have separate budgets plus transport cap. Unknown/legacy messages are rejected.

Population is configurable 1–150, default 150. Dev bots reserve seats, leave one human seat, cannot host, and are disabled in production. Start minimum is one for practice. TDM teams balance at countdown completion; FFA/duel use no team. Fresh joins close at countdown. Reconnect defaults to 25 seconds and preserves state; expiry advances deadlines then marks spectator and releases membership.

HTTP limits remain 600 guest/room/upgrade requests per minute per direct peer IP, room APIs 10/minute per guest. Forwarded headers are untrusted. HTTPS/WSS requires a trusted proxy with private raw server port outside development.

## Persistence and deployment
Additive `003-arena-matches.sql` creates FPS tables without modifying checksummed historical migrations or deleting old results. UUID match/player IDs, UTC dates, mode, winner/reason, kills/deaths, team/status are stored atomically and idempotently. Dev bots also get UUIDs. Positions, names, tokens, live timers are excluded. Write failure logs only match ID and does not alter lifecycle.

Node 24.18.0 / npm 11.17.0 and lockfile pins remain. Migrations use transactions/advisory locks/checksums. Local Compose and readiness semantics remain. Free-tier hosting is an unselected measured spike. No deployment is implied. Throughput, mobile performance, and latency fairness remain gates.

## Alternatives and consequences
Replacing freeze-tag avoids maintaining conflicting rule paths; a second mode would double state/HUD/validation complexity and is out of scope. Original geometry/synthesized audio avoids unverified imports. Supplied licensed Veck.io assets can replace it once provenance is recorded. Shared kinematics/analytic collision retain the dependency footprint; complex physics and rewind are deferred. Frostline replaces the large island; `MAP_SPEC.md` defines its layout.
