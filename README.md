# Ice Ice Water!

A browser arena FPS with desktop and mobile touch controls, private invite rooms, and server-authoritative combat.

The implementation plan's FPS pivot is implemented as a playable prototype: Frostline and Frost Island arenas, movement/jump/swim/slide/crouch/sprint, six weapons, reload/ADS/headshots, death/respawn, FFA/TDM/duel scoring, settings, scoreboard, sound cues, and PostgreSQL summaries. Frost Island is a 160-metre combat archipelago with a central Fort/Cryogenic Core battlefield and specialized outer islands. Freeze-tag is replaced; historical specifications and superseded sources/tests are retained for reference.

## Run locally

Use **Node 24.18.0**, **npm 11.17.0**, Docker Desktop with Linux containers, and a WebGL 2 browser.

```bash
npm install
npm run setup:local
npm run db:up
npm run db:migrate
npm run dev
```

Open **http://localhost:5173** (or **http://127.0.0.1:5173**). Server: **127.0.0.1:2567**. Keep the terminal running. On PowerShell, use `npm.cmd` if `npm.ps1` is blocked. Setup creates an ignored `.env` and preserves an existing one. Never put secrets in browser-visible `VITE_` variables.

The existing local database uses port 55432. Docker must be running. If port 5432 is reserved, set both `POSTGRES_PORT` and the port in `DATABASE_URL` to 55432. `db:down` retains data. Gameplay runs without PostgreSQL, but summary writes fail and `/ready` reports 503. Migrations 003/004 add FPS tables and map identity while preserving freeze-tag history.

## Play

1. Choose a name, select a mode and primary weapon, then create a private room.
2. Share the eight-character invite code before starting.
3. One player can start solo practice. FFA ends at 30 kills/five minutes; TDM at 50 team kills/five minutes; duel at 10 kills/three minutes and allows at most two players.
4. Death respawns after 2.5 seconds. Spawn protection lasts 1.5 seconds and ends on firing.
5. Results display for eight seconds, then the room closes. Create a new room for another match.

**Desktop:** click Enter arena for mouse lock; WASD/arrows move; mouse aims; Space jumps; Shift slides; C crouches; Control sprints; left-click fires; right-click aims; R reloads; 1/2/3 or wheel switches weapons; hold Tab for scores; Esc releases the cursor.

**Mobile:** movement stick, drag-to-look area, Fire, Aim, Jump, Slide, Reload, Weapon, Scores, Crouch, Sprint. Controls support simultaneous fingers and portrait/landscape. Settings offers Automatic/Touch/Keyboard and mouse if device detection is unreliable. Look sensitivity, FOV, volume, crosshair color, and reduced effects persist locally.

Primary choices: Frost AR, Ice Spray SMG, Glacier Pump shotgun, Icicle sniper. Every loadout also carries Snowmelt pistol and Ice Pick. Values are initial playtest tuning.

Host transfers on departure. Fresh joins close at countdown. Unexpected disconnects reserve identity for 25 seconds by default; reload/reconnect restores health, ammo, score, position, and deadlines. Reserved bodies remain vulnerable; respawn waits for connection. Expired or intentional departures become spectators and cannot rejoin that match.

## Development bots

Optional `DEV_BOT_COUNT=5` fills five seats with wandering targets. Bots have normal authoritative health/death/respawn but do not shoot; solo practice does not require them. Bots reserve room capacity and always leave one human seat. Production disables them.

## Commands and checks

| Command                    | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`              | Client and authoritative server                                           |
| `npm test`                 | Rules, real WebSocket security/lifecycle, database integration            |
| `npm run test:e2e`         | Desktop and mobile join/play/combat/results/settings flows                |
| `npm run test:load`        | 20/50/100/150-client five-second gameplay smoke checks                    |
| `npm run test:load -- 150` | One staged population                                                     |
| `npm run lint`             | ESLint and Prettier                                                       |
| `npm run typecheck`        | Strict TypeScript, including tests                                        |
| `npm run build`            | All production packages and SQL migrations                                |
| `npm run assets:island`    | Rebuild Fort geometry/collision and validate authored Frost Island spawns |
| `npm run db:migrate`       | Transactional checksummed migrations                                      |

Playwright starts an isolated Vite on 5174 and a real server inside the test worker on 2568, with zero bots and a test persistence stub. Its test-only server fixture controls poses/deadlines for combat/results assertions; no control endpoint or client-authoritative shortcut ships. Install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome`/`msedge` for an installed signed browser. Restricted Windows runners need permission to terminate test child processes. Touch input is tested through CDP multitouch; this runner may report no touch capability despite emulation.

Database tests require `TEST_DATABASE_URL` pointing at a disposable database; never production. They skip when absent. Full-match capacity, remote-network latency, and physical mobile-device FPS remain unverified. Five-second same-process load smoke results do not establish 20 Hz throughput or public release readiness; see `TASKS.md`.

## Configuration

| Variable                                | Default/constraint                                                 |
| --------------------------------------- | ------------------------------------------------------------------ |
| `VITE_GAME_SERVER_URL`                  | ws://localhost:2567; public browser config                         |
| `GAME_SERVER_HOST` / `GAME_SERVER_PORT` | 127.0.0.1 / 2567                                                   |
| `CLIENT_ORIGIN`                         | http://localhost:5173; equivalent loopback origin accepted locally |
| `GUEST_SESSION_SIGNING_SECRET`          | Required random secret, at least 32 characters                     |
| `GUEST_SESSION_TTL_SECONDS`             | 3600; range 60–86400                                               |
| `ROOM_MAX_PLAYERS`                      | 150; range 1–150, humans plus bots                                 |
| `DEV_BOT_COUNT`                         | 0; at most room capacity minus one; off in production              |
| `COUNTDOWN_SECONDS`                     | 5; range 1–30                                                      |
| `RECONNECT_SECONDS`                     | 25; range 20–30                                                    |
| `DATABASE_URL`                          | PostgreSQL; required in production                                 |
| `POSTGRES_PASSWORD` / `POSTGRES_PORT`   | Local Compose credentials/port                                     |
| `TEST_DATABASE_URL`                     | Optional isolated test database                                    |

`ICE_COUNT_BRACKETS` is obsolete. TDM balances teams at countdown completion. Weapon/movement/match tuning lives in shared constants. Production requires HTTPS/WSS with a trusted TLS proxy and private raw game port. No hosting is configured.

Routes remain `/health`, `/ready`, `POST /api/guest-session`, `POST /api/rooms`, `POST /api/rooms/join`. Room APIs require a signed guest token; public Colyseus matchmaking remains blocked.

## Sources of truth

[PRD](PRD.md), [architecture](ARCHITECTURE.md), [map specification](MAP_SPEC.md), [art direction](ART_DIRECTION.md), [implementation status](implementation_plan.md), [tasks and verification](TASKS.md), [agent rules](AGENTS.md), [contributing](CONTRIBUTING.md).

`apps/client` renders and captures input; `apps/server` owns outcomes; `packages/shared` holds safe types/constants/pure simulation; `tests` holds browser/load scenarios. Original procedural weapons/facility/combat audio and Frost Island archipelago geometry ship alongside the authorized Fort derivative and wooden house. Lobby character/music are retained project assets. Embedded source/license metadata and outstanding permission evidence are recorded; see [asset provenance](assets/asset-provenance.md).

Contributors: Chad Bojelador and Franco Perez.
