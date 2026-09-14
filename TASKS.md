# FPS Task Tracker

Current product: private-room arena FPS with desktop/mobile support and Frostline and Island - Fort maps. Freeze-tag planning is archived under `docs/archive`.

## Completed

| ID | Work | Status |
|---|---|---|
| FPS-01 | Authoritative movement, camera, prediction, and touch input | Complete |
| FPS-02 | Six weapons, ammo/reload validation, hitscan, damage, and death | Complete |
| FPS-03 | FFA/TDM/duel, solo practice, respawn, reconnect, results, and summaries | Complete |
| FPS-04 | Frostline geometry and wooden-house scale/collision | Complete |
| FPS-05 | Island Fort optimization, shared triangle collision, and spawns | Complete |
| FPS-06 | HUD, scoreboard, feedback, desktop/mobile controls, and settings | Complete |
| FPS-07 | Lobby loadout, preview, audio, and map selection | Complete |
| FPS-08 | Additive FPS summary and map migrations | Complete; local migrations applied |
| FPS-09 | Archive superseded freeze-tag sources and replace active tests | Complete |
| FPS-10 | Update product, architecture, art, map, setup, and agent documentation | Complete |

## Open release gates

| ID | Priority | Acceptance |
|---|---|---|
| FPS-11 | P0 | Independent-process full-match load at 20/50/100/150 on both maps; tune the cap from evidence |
| FPS-12 | P0 | Physical Android/iOS portrait/landscape and desktop GPU checks at the target frame rate |
| FPS-13 | P1 | Multiplayer route, spawn/camping, interior/ceiling, and weapon-balance playtest |
| FPS-14 | P1 | Latency and fairness study before rewind or transport changes |
| FPS-15 | P1 | Independent permission evidence for the supplied reuploaded Island asset and retained lobby assets |
| FPS-16 | P1 | Accessibility and color-independent state review on real devices |
| FPS-17 | P1 | Staging deployment with HTTPS/WSS, proxy isolation, telemetry, and limits |
| FPS-18 | P2 | Add shooting bots only if practice testing demonstrates the need |

## Evidence and limits

The current unit/integration suite passes 80 tests, strict type checking passes, and the production build passes. Browser coverage exercises desktop and mobile join/play/combat/results/settings flows; the Windows Chrome runner uses CDP touch events because its reported touch capability is incomplete. Existing 20/50/100/150-client checks are same-process five-second smoke tests, not sustained 20 Hz capacity evidence. Island-specific full-match profiling, physical-device performance, balance, accessibility, and asset-permission verification remain open.
