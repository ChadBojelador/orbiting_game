# FPS Task Tracker

Current product: private-room arena FPS with desktop/mobile support and Frostline, Frost Island, and Original World maps. Freeze-tag planning is archived under `docs/archive`.

## Completed

| ID | Work | Status |
|---|---|---|
| FPS-01 | Authoritative movement, camera, prediction, and touch input | Complete |
| FPS-02 | Six weapons, ammo/reload validation, hitscan, damage, and death | Complete |
| FPS-03 | FFA/TDM/duel, solo practice, respawn, reconnect, results, and summaries | Complete |
| FPS-04 | Frostline geometry and wooden-house scale/collision | Complete |
| FPS-05 | Fort optimization and shared triangle collision | Complete |
| FPS-06 | HUD, scoreboard, feedback, desktop/mobile controls, and settings | Complete |
| FPS-07 | Lobby loadout, preview, audio, and map selection | Complete |
| FPS-08 | Additive FPS summary and map migrations | Complete; local migrations applied |
| FPS-09 | Archive superseded freeze-tag sources and replace active tests | Complete |
| FPS-10 | Update product, architecture, art, map, setup, and agent documentation | Complete |
| FPS-19 | Island sea buoyancy, drag, swim-up input, and shared prediction tests | Complete |
| FPS-21 | Restore first GitHub procedural world as a selectable FPS map with shared collision and additive migration | Complete; verification recorded below |
| FPS-20 | Frost Island archipelago layout, hybrid collision, outer spawns, routes, and LOD | Complete |

## Open release gates

| ID | Priority | Acceptance |
|---|---|---|
| FPS-11 | P0 | Independent-process full-match load at 20/50/100/150 on all three maps; tune the cap from evidence |
| FPS-12 | P0 | Physical Android/iOS portrait/landscape and desktop GPU checks at the target frame rate |
| FPS-13 | P1 | Multiplayer route, spawn/camping, interior/ceiling, and weapon-balance playtest |
| FPS-14 | P1 | Latency and fairness study before rewind or transport changes |
| FPS-15 | P1 | Independent permission evidence for the supplied reuploaded Island asset and retained lobby assets |
| FPS-16 | P1 | Accessibility and color-independent state review on real devices |
| FPS-17 | P1 | Staging deployment with HTTPS/WSS, proxy isolation, telemetry, and limits |
| FPS-18 | P2 | Add shooting bots only if practice testing demonstrates the need |

## Evidence and limits

Final checks on 2026-09-15:

- `npm test`: 81 passed across 20 files, including PostgreSQL migrations/transactional summaries and real WebSocket reconnect/security flows.
- `npm run test:e2e`: 5 passed in installed Chrome. Desktop combat/results; mobile simultaneous movement/look/fire on Frostline and Island in portrait/landscape; loadout/duel/settings; Island loading, movement, firing and Escape/leave.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed. Vite reports large shared-collision/renderer chunks; do not suppress this advisory as a substitute for device profiling.
- Independent GLB raycasting matches Island ground and shot collision. All sixteen spawns have a clear initial exit; regression tests cover walking off ledges without sinking into adjacent collision. Pointer-lock release has an explicit Escape handler.
- Migrations 003/004 applied to the local database; `/ready` reports database ready. The developer game runs at http://127.0.0.1:5173 with the authoritative server on 2567. Test ports 5174/2568 are separate.

The Windows Chrome runner uses CDP touch events because reported touch capability is incomplete. Physical-device FPS and full-match capacity remain unverified.

### Staged load smoke evidence — 2026-09-14

Five seconds of active input/firing, real WebSockets, same-process driver/server, no rendering. These Frostline measurements precede the final Island integration and do not establish sustained 20 Hz capacity.

| Clients | Join ms | Observed simulation tick changes | Kills | Driver timer p95 ms |
|---|---:|---:|---:|---:|
| 20 | 679 | 81 | 15 | 4 |
| 50 | 1544 | 61 | 46 | 10 |
| 100 | 3359 | 18 | 61 | 40 |
| 150, encoder rerun | 6224 | 29 | 126 | 38 |

The first 150-client run overflowed the 32 KiB schema buffer. A 64 KiB buffer removed that failure on rerun. Larger populations did not sustain the target tick rate; the configured 150-player cap is not verified production capacity. Independent-process full-match profiling on all three maps, physical-device performance, balance, accessibility and asset-permission evidence remain open.

### Original World verification ? 2026-09-15

- npm test: 92 passed; five PostgreSQL checks failed with ECONNREFUSED on local port 55432. Docker is not running, so migration 005 could not be applied or database-verified. Tests retain their assertions.
- npm run test:e2e: all seven browser flows passed in installed Chrome, including Original World desktop damage/death/respawn/results and simultaneous mobile controls in portrait/landscape.
- npm run lint, npm run typecheck, npm run build: passed. Existing bundle-size advisories remain; physical-device performance and full-match capacity are unverified.
- npm run assets:original: regenerated 9,912 matching collision triangles / 178,416 bytes. Independent renderer raycasts and sixteen inward spawn exits passed; desktop/mobile screenshots inspected.
- Repaired the malformed NUL-encoded trailing GLB ignore rule, which had become a wildcard hiding all new files. Previously hidden existing island-layout.ts and the Frost Island production brief are preserved.
