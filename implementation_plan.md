# Arena FPS Implementation Status

The original seven-phase plan is archived at `docs/archive/approved-fps-implementation-plan.md`. This file records the executed scope and remaining release work. `PRD.md` and `ARCHITECTURE.md` are the current product and technical sources of truth.

## Accepted decisions

- Replace freeze-tag gameplay with an arena FPS; retain superseded tests and specifications only as archived references.
- Keep desktop and mobile touch support, including simultaneous movement, look, and firing.
- Allow one player to start solo practice. FFA, TDM, and duel remain private-room modes; duel is capped at two players.
- Integrate the supplied Island and wooden-house GLBs after normalizing scale and deriving shared render/collision geometry. Asset provenance and the unresolved rightsholder-permission question remain release gates.
- Keep the expanded 120 metre Frostline layout and the existing lobby character/music assets.

## Executed phases

| Phase                        | Result                                                                                                       | Primary modules                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Movement and camera          | Authoritative movement, jump, slide, crouch, sprint, surfaces, prediction, pointer lock, and touch look      | `packages/shared/src/simulation`; `game-input`; `first-person-camera`; `player-motion` |
| Combat                       | Six weapons, ammo, reload, ADS, spread, falloff, headshots, authoritative damage/death, and feedback         | `weapons`; `weapon-controller`; `damage-system`; `weapon-renderer`                     |
| Match loop                   | FFA/TDM/duel, solo practice, score/time limits, teams, respawn protection, reconnect, results, and summaries | `match-controller`; `gameplay-controller`; `spawn-manager`; `private-room`             |
| Maps                         | Frostline analytic collision plus optimized Island - Fort triangle collision and closed-house bounds         | `arena`; `island-collision`; `FrostlineMap`; `IslandMap`; asset scripts                |
| HUD and controls             | Health, ammo, timer, score, feed, crosshair, indicators, scoreboard, results, and mobile controls            | `apps/client/src/ui`; `hit-effects`; `touch-controls`                                  |
| Loadout, settings, and audio | Loadout selection, persistent settings, lobby preview, synthesized combat cues, and retained lobby audio     | `lobby-screen`; `settings-panel`; `fps-settings`; `audio-manager`; `lobby-audio`       |

## Implementation boundaries

The server owns movement outcomes, aim validation, health, ammunition, cooldowns, hits, deaths, respawns, scores, deadlines, and results. Clients send input and action intent only. All current weapons use authoritative hitscan, including the short-range melee trace. Bots wander as optional practice targets and do not shoot. There is no public matchmaking, ranking, store, progression, or legacy freeze-tag mode.

Island uses the Fort sector of the supplied archipelago. The 136.6 MB source remains unchanged; the runtime derivative is approximately 4.9 MB and uses the same baked coordinates for rendering, movement, spawn height, and hitscan. Run `npm run assets:island` after changing the source or selection. Do not independently rescale the rendered model or edit generated collision data.

## Verification status

- `npm test`: passed, 81 tests across 20 files, including the database suite.
- `npm run typecheck`: passed for shared, client, server, and root tests.
- `npm run build`: passed for shared, server, and client. Vite retains a large renderer chunk as a tracked advisory.
- `npm run lint`: ESLint and Prettier passed.
- `npm run test:e2e`: 5 passed in Chrome, including desktop Island movement/firing/Escape and simultaneous mobile controls on both maps in portrait/landscape.
- Island movement follow-up: generated spawns require a clear initial exit; feet use radius-based ledge support; standing beneath low ceilings retains crouch. Render/shot collision is checked against the actual GLB, and all sixteen spawns are tested for forward movement.
- Staged 20/50/100/150-client load smoke measurements and remaining limits are recorded in TASKS.md. They do not establish full-match capacity or physical-device frame rate.
- PostgreSQL integration requires a disposable `TEST_DATABASE_URL`; never use production credentials.

## Remaining release gates

1. Independent-process full-match load on both maps, with tick latency, memory, bandwidth, and results correctness recorded.
2. Physical Android/iOS and desktop GPU playtesting for frame rate, input parity, reload/ADS, and portrait/landscape layouts.
3. Spawn, route, interior/ceiling, weapon-balance, accessibility, and latency/fairness playtests.
4. Independent rightsholder-permission evidence for the supplied reuploaded Island asset and an audit of retained character/music assets.
5. Staging deployment with HTTPS/WSS, proxy isolation, telemetry, and documented operational limits.
