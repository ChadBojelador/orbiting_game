# Ice Ice Water! Task Tracker

This file is the source of truth for current development work. The PRD defines what to build; the architecture defines how it is structured.

## Tracker conventions

- Owners: `Unassigned`, `Chad Bojelador`, or `Franco Perez`.
- Priorities: `P0` blocks the playable MVP, `P1` is required before public MVP testing, and `P2` is valuable follow-up.
- Move a task rather than duplicating it between sections.
- Keep tasks small enough for one focused pull request where practical.

## Backlog

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-35 | Evaluate optional public matchmaking after private-room MVP | Unassigned | P2 | Matchmaking | MVP-10 |
| MVP-36 | Evaluate Redis using measured multi-process room-discovery needs | Unassigned | P2 | Scale-out | MVP-34 |
| MVP-37 | Add accessibility review for color-independent player states | Unassigned | P2 | Accessibility | MVP-20 |

## To Do

### Reliability, quality, and release

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-40 | Add browser test for join-to-results critical flow | Unassigned | P1 | Quality | MVP-32, MVP-34 |
| MVP-41 | Add structured room lifecycle, error, and performance telemetry | Unassigned | P1 | Observability | MVP-05, MVP-26 |
| MVP-42 | Implement low, medium, and high graphics presets | Unassigned | P1 | Performance | MVP-16, MVP-20, MVP-30 |
| MVP-43 | Create simulated-player load harness | Unassigned | P0 | Load testing | MVP-11, MVP-18, MVP-26 |
| MVP-44 | Pass and document 20- and 50-player load scenarios | Unassigned | P0 | Load testing | MVP-43 |
| MVP-45 | Pass and document 100- and 150-player load scenarios | Unassigned | P0 | Load testing | MVP-44, MVP-42 |
| MVP-46 | Optimize network interest and animation LOD from profiling evidence | Unassigned | P1 | Performance | MVP-45 |
| MVP-47 | Deploy browser client, regional game server, and PostgreSQL staging environment | Unassigned | P1 | Deployment | MVP-08, MVP-33, MVP-41 |
| MVP-48 | Run two-team playtest and record balancing decisions | Unassigned | P1 | Validation | MVP-40, MVP-45, MVP-47 |
| MVP-49 | Complete MVP release checklist against PRD success criteria | Unassigned | P1 | Release | MVP-48 |
| MVP-50 | Compare free-tier static, WebSocket server, and PostgreSQL hosting limits | Unassigned | P0 | Deployment | MVP-05, MVP-07 |
| MVP-52 | Audit and record licenses for every sourced prototype asset | Unassigned | P0 | Asset pipeline | MVP-51 |

## In Progress

No tasks currently in progress.

## Review

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-01 | Initialize Git and GitHub repository; `main` protection was saved after approval, before the subsequent request not to add a rule; no further rule changes made | Unassigned | P0 | Collaboration | — |
| MVP-51 | Approve original visual direction and first concept reference | Chad Bojelador and Franco Perez | P0 | Art direction | — |

## Done

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| DOC-01 | Establish README, PRD, architecture, agent guide, contribution workflow, environment example, ignore rules, and task tracker | Unassigned | P0 | Foundation | — |

### Completed authoritative clock, room cleanup, and match persistence (2026-09-14)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-33 | Store match summary and contribution totals transactionally | Unassigned | P1 | Persistence | MVP-07, MVP-32 |

### Verification and scope (Clock, cleanup, persistence, and bundles)

- Active rooms synchronize current server time on every authoritative tick. The shared client clock keeps gameplay and HUD estimates monotonic across delayed patches while retaining server-owned phase deadlines.
- Match results remain available for the configured result duration, after which the room releases its invite/memberships and disposes exactly once; completed reconnects and invite joins are rejected.
- Migration `002-match-summaries.sql` and the match-summary repository transactionally store one idempotent UUID-keyed result and all player contribution rows without live state, tokens, or display names.
- Production builds force production dependency resolution and lazily load tree-shaken Three.js presentation. JavaScript output decreased from approximately 1,425 kB to 1,080 kB uncompressed; the remaining approximately 633 kB renderer/GLTF chunk is lazy and tracked as an optimization advisory.

### Completed throwable frost and PC controls (2026-09-12)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-56 | Replace close-range targeting with server-authoritative throwable frost, optimized PC input, and an in-match control guide | Chad Bojelador | P0 | Freezing and controls | MVP-22, MVP-55 |

### Verification and scope (Throwable frost and PC controls)

- Right-click throws frost toward a centered Ice reticle, with `F` as a keyboard fallback. Left-drag remains dedicated to camera look, Space jumps, Water holds `E` to rescue, and frozen players press `H` for help.
- The server validates normalized three-dimensional aim, role, active status, phase, cooldown, and in-flight capacity. Fixed-step swept collisions freeze the first eligible Water player and stop on static cover, arena bounds, protected players, or expiry.
- The client synchronizes and renders up to 64 frost shards using two instanced meshes. The desktop HUD shows a compact role-aware control guide; coarse-pointer and narrow layouts keep the existing touch controls instead.
- Coverage includes malformed and unauthorized throws, cooldowns, hits, cover, airborne misses, protection absorption, input one-shots, and a real-WebSocket authoritative projectile hit.

### Completed authoritative jumping (2026-09-12)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-55 | Make jumping a server-authoritative mechanic with vertical interaction validation | Chad Bojelador | P0 | Movement | MVP-18, MVP-19, MVP-38 |

### Verification and scope (Authoritative jumping)

- Sequenced movement carries a backward-compatible one-shot jump flag; the server owns world-space height, vertical velocity, grounded state, jump eligibility, gravity, and landing.
- Client prediction and remote interpolation include authoritative vertical motion. Keyboard and touch expose distinct jump controls.
- Frost-projectile hits and rescue use authoritative three-dimensional positions. Airborne players retain horizontal static collision and cannot vault through walls.
- Unit coverage includes jump validation, grounded-only initiation, landing, prediction/reconciliation, vertical interaction range, rescue cancellation, and low-cover line of sight; real-WebSocket coverage verifies jump intent reaches authoritative state.
- Local verification passed 117 non-database tests, strict type checking, changed-file ESLint, the production build, and both existing Playwright scenarios. The configured PostgreSQL migration test could not connect to port 55432, and the Playwright command required termination after its assertions because of the documented Windows child-process cleanup hang.

### Completed active-match reconnection (2026-09-11)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-34 | Add 20–30 second reconnection reservation without bypassing deadlines | Unassigned | P1 | Reliability | MVP-10, MVP-26, MVP-29 |

### Verification and scope (Active-match reconnection)

- Active, frozen, and eliminated players reconnect to their current authoritative state during Regular play and Deep Freeze; disconnect/reconnect never clears frozen state or rolls back server-side changes.
- Reconnect reservations expose a server-time deadline. Expiry rejects late reconnects, releases membership, and permanently eliminates active or frozen participants while retaining already eliminated state.
- Deadline-first finalization is covered at the exact Deep Freeze boundary, including a disconnected frozen Water player receiving the atomic permanent-freeze result before reservation forfeit cleanup.

### Completed room security and lifecycle integration (2026-09-11)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-39 | Add real-WebSocket integration coverage for invalid gameplay messages and authoritative room lifecycle | Unassigned | P0 | Security | MVP-26, MVP-34 |

### Verification and scope (Room security and lifecycle)

- Real Colyseus clients verify malformed movement and action payload rejection, unknown-message rejection, stale movement sequences, and the 12-action-per-second gameplay limit without permitting client-forged state or excess movement.
- Integration flows cover late joins, intentional and expired host departure, reconnect-token expiry, membership release, host transfer, and invite removal after room disposal.
- A controlled authoritative room tick receives frost-throw and movement intent through real WebSockets, preserves eligible pre-deadline input, eliminates disconnected frozen Water atomically at the exact Deep Freeze deadline, and rejects post-deadline gameplay.

### Completed baseline stabilization and development bots (2026-09-11)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-53 | Add configurable development-only wandering bots for solo match testing | Chad Bojelador | P1 | Developer experience | MVP-18, MVP-26 |
| MVP-54 | Reserve bot seats, isolate browser tests from bots, and lock authoritative deadline tick ordering with boundary tests | Unassigned | P0 | Quality | MVP-28, MVP-53 |

### Verification and scope (Baseline stabilization)

- Development bot configuration retains at least one human seat and caps combined bots, connected humans, and reconnect-reserved humans at `ROOM_MAX_PLAYERS`, which remains limited to 150. Production forces the effective bot count to zero.
- Playwright launches isolated server and client processes with `DEV_BOT_COUNT=0`; the desktop six-player and mobile validation assertions pass. On restricted Windows runners, the known child-process cleanup hang can still require terminating the completed test command.
- Unit coverage includes valid and invalid capacity boundaries, exact-capacity bot population, bot overfill rejection, the last eligible rescue step before the Regular deadline, and the last eligible movement step before Deep Freeze resolution.
- Verification completed with 86 non-database tests, root/workspace strict type checking, ESLint, targeted Prettier checks, and the production build passing. The configured PostgreSQL integration test could not connect to the local disposable database at port 55432 and was not treated as a product-code failure.

### Completed foundation and private rooms (2026-09-10)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-02 | Create npm-workspace root with shared development scripts | Unassigned | P0 | Tooling | MVP-01 |
| MVP-03 | Pin Node/npm versions and configure ESLint, Prettier, and strict TypeScript | Unassigned | P0 | Tooling | MVP-02 |
| MVP-04 | Scaffold Vite client with React and PlayCanvas | Unassigned | P0 | Client | MVP-02 |
| MVP-05 | Scaffold Colyseus server with health and readiness endpoints | Unassigned | P0 | Server | MVP-02 |
| MVP-06 | Create shared protocol package with initial message and state types | Unassigned | P0 | Networking | MVP-04, MVP-05 |
| MVP-07 | Add local PostgreSQL Docker Compose service and migration command | Unassigned | P1 | Persistence | MVP-02 |
| MVP-08 | Add CI for lint, type checking, tests, and builds | Unassigned | P1 | Quality | MVP-03, MVP-04, MVP-05 |
| MVP-09 | Implement sanitized guest display-name form | Unassigned | P0 | Guest session | MVP-04 |
| MVP-10 | Issue and validate short-lived signed guest sessions | Unassigned | P0 | Guest session | MVP-05, MVP-06 |
| MVP-11 | Create configurable 6–150 player private game room | Unassigned | P0 | Rooms | MVP-05, MVP-06 |
| MVP-12 | Add room creation, invite codes, code-based joining, and visible player count | Unassigned | P0 | Rooms | MVP-09, MVP-10, MVP-11 |
| MVP-13 | Add host-controlled start with six-player minimum and countdown | Unassigned | P0 | Rooms | MVP-12 |
| MVP-14 | Agree, document, and implement configurable Ice-count brackets by room size | Unassigned | P0 | Roles | MVP-13 |

### Verification and scope

- Foundation and sessions/private-room implementation: npm workspace scripts, exact Node/npm and package pins, strict TypeScript, ESLint/Prettier, CI, local PostgreSQL, migrations, React/PlayCanvas lobby, signed guests, invite rooms, host countdown, and approved configurable role brackets.
- Local tests: 44 unit/integration tests passed, including a real isolated PostgreSQL migration test; both desktop six-player and mobile validation/layout browser flows passed. Lint, strict typechecking (including tests), and all production builds passed. The SQL migration was applied and its idempotent rerun passed.
- Measured lobby connection/role checks: 20 clients (689 ms joins), 50 (1480 ms), 100 (3210 ms), and 150 (5057 ms), on the local Windows machine. All clients observed the same assigned Ice count. These are lobby-only smoke measurements; MVP-43–46 remain open for real gameplay, full-match load, and FPS profiling.
- The measured initial 150-player schema exceeded Colyseus's 16 KiB default encoding buffer. An explicit process startup setting raises it to 32 KiB; the repeat load run passed without buffer growth warnings.
- Browser build currently has a roughly 186 KiB gzip main bundle and 603 KiB gzip lazy PlayCanvas chunk. Vite flags large chunks. Runtime download/3D optimization remains a measured follow-up.
- Reconnection coverage here verifies lobby identity/reservation only. MVP-34 still owns freeze/elimination/deadline continuity during actual matches.
- The first two groups finish at role assignment into `regular`; movement, tag/rescue, round deadlines, and results are deliberately not marked complete.

### Completed core 3D gameplay and multi-round match loop (2026-09-10)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-15 | Build placeholder arena with static collision and spawn points | Unassigned | P0 | Arena | MVP-04, MVP-51 |
| MVP-16 | Add shared low-poly placeholder character and basic animations | Unassigned | P0 | Characters | MVP-04, MVP-51 |
| MVP-17 | Implement keyboard and touch input normalization | Unassigned | P0 | Controls | MVP-04 |
| MVP-18 | Implement server-authoritative kinematic movement | Unassigned | P0 | Movement | MVP-06, MVP-15, MVP-17 |
| MVP-19 | Add local prediction and remote-player interpolation | Unassigned | P0 | Networking | MVP-18 |
| MVP-20 | Render distinct Ice, Water, protected, and frozen states | Unassigned | P0 | Player states | MVP-14, MVP-16, MVP-19 |
| MVP-21 | Implement spatial-grid nearby-player queries | Unassigned | P0 | Performance | MVP-18 |
| MVP-22 | Implement validated Ice freezing and temporary freeze | Unassigned | P0 | Freezing | MVP-20, MVP-21 |
| MVP-23 | Implement hold-to-rescue with server-owned progress | Unassigned | P0 | Rescue | MVP-22 |
| MVP-24 | Add two-second post-rescue protection | Unassigned | P0 | Rescue | MVP-23 |
| MVP-25 | Add rate-limited frozen-player help ping | Unassigned | P1 | Rescue | MVP-22 |
| MVP-26 | Implement and unit-test the authoritative match state machine | Unassigned | P0 | Match flow | MVP-14, MVP-22, MVP-23 |
| MVP-27 | Implement server-derived phase and round HUD timers | Unassigned | P0 | Match flow | MVP-26 |
| MVP-28 | Add 30-second regular phase, Deep Freeze warning, and 30-second Deep Freeze deadline | Unassigned | P0 | Deep Freeze | MVP-26, MVP-27 |
| MVP-28A | Disable and reject rescue throughout Deep Freeze | Unassigned | P0 | Deep Freeze | MVP-23, MVP-28 |
| MVP-29 | Permanently freeze unresolved players atomically at the deadline | Unassigned | P0 | Deep Freeze | MVP-28 |
| MVP-30 | Add static ice statues and spectator mode | Unassigned | P0 | Elimination | MVP-29 |
| MVP-31 | Contract arena boundaries between configured rounds | Unassigned | P0 | Arena | MVP-15, MVP-26 |
| MVP-32 | Implement Ice/Water win evaluation and results screen | Unassigned | P0 | Results | MVP-29, MVP-31 |

### Completed gameplay rule coverage (2026-09-11)

| ID | Task | Owner | Priority | Related feature | Dependencies |
|---|---|---|---|---|---|
| MVP-38 | Add direct unit coverage for movement, frost collisions and cooldowns, rescue range and leases, multiple rescuers, protection, help pings, exact phase deadlines, and win rules | Unassigned | P0 | Quality | MVP-22, MVP-24, MVP-32 |

### Verification and scope (Gameplay loop)

- End-to-end playable 3D match loop: Three.js arena with obstacles, third-person follow camera, per-player entity manager with distinct state materials (Water, Ice, protected, frozen, eliminated statue).
- Server-authoritative MatchController: multi-round phase loop (regular 30s -> warning 8s -> deep freeze 30s -> round result 5s -> next round/match result), atomic deadline elimination of frozen Water, arena shrinkage across rounds (28m down to 12m), early Ice win check, and 5-round Water victory.
- HUD & Controls: phase/round countdown timers, score counters, role banners, desktop control guide, touch joystick, and contextual action buttons (throw frost, hold rescue, help ping).
- Automated tests: 55 unit and integration tests passing (`npm run test`), Playwright browser tests passing (`npm run test:e2e`), strict TypeScript type check passing across all packages (`npm run typecheck`), ESLint and Prettier passing (`npm run lint`), and production build passing (`npm run build`).

