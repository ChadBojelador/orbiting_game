# Ice Ice Water!

A browser-only multiplayer freeze-tag game for private groups of 6–150 players.

**Implemented:** the npm monorepo, React/Vite/Three.js client, signed guest sessions, private rooms, authoritative movement and actions, the five-round match loop, Deep Freeze elimination, spectating, and results. Development-only wandering bots can fill seats for solo testing.

## Run locally

Use **Node 24.18.0** and **npm 11.17.0**, Docker Desktop with the Linux engine, and a modern WebGL 2 browser. Versions are pinned in `.node-version`, `.nvmrc`, and `package.json`.

```bash
npm install
npm run setup:local
npm run db:up
npm run db:migrate
npm run dev
```

Open **http://localhost:5173**. The game server listens on **127.0.0.1:2567**. `setup:local` creates an ignored `.env` with random credentials and preserves an existing file. Alternatively, copy `.env.example` to `.env` and replace its placeholders. On PowerShell systems that block `npm.ps1`, use `npm.cmd` for these commands.

Docker must be running before `db:up`. If Windows reserves port 5432, set `POSTGRES_PORT=55432` and change the port in `DATABASE_URL` to 55432. This workspace uses that override. `db:down` stops the database while retaining its named volume. The lobby works without PostgreSQL; `/ready` reports 503 until the database is reachable.

## Try a private room

1. Enter a name, then choose **Create private room**.
2. Share the eight-character invite code with friends.
3. Each guest chooses a name and joins with the code. Use separate browser contexts for independent test guests.
4. With six connected guests, the host can start the countdown. It cancels if the count drops below six.
5. The server assigns Ice and Water at the deadline and starts the five-round match.

Host duties transfer to the first connected guest when the host leaves. Unexpected disconnects reserve the same player for 25 seconds by default; the browser reconnects automatically, and a reload can reclaim the per-tab connection. During a match, reconnecting restores the current authoritative team, position, and freeze/elimination state, including any server-side changes that occurred while disconnected. If the reservation expires, an active or frozen participant forfeits and becomes permanently eliminated, and that match cannot be rejoined. Intentional **Leave room** releases the seat and has the same in-match forfeit outcome. Fresh joins close when countdown begins.

### Controls

- Keyboard: WASD or arrow keys to move, Space to jump, F to tag as Ice, E to hold rescue as Water, and H to request help while frozen.
- Touch: use the left joystick plus the on-screen Jump and role-specific action buttons.

Jumping is server-authoritative and affects three-dimensional tag and rescue range. It cannot pass through static obstacles.

### Test locally with bots

Set `DEV_BOT_COUNT=5` in the root `.env`, restart `npm run dev`, and create a room. One human plus five server-side wandering bots satisfies the six-player start minimum. Bots occupy normal room seats and participate in authoritative movement, team assignment, freezing, and elimination, but they do not tag or rescue.

`DEV_BOT_COUNT` must be between zero and `ROOM_MAX_PLAYERS - 1`, leaving at least one human seat. Human capacity is `ROOM_MAX_PLAYERS - DEV_BOT_COUNT`, so the combined bot and human population cannot exceed the configured room maximum or the global limit of 150. Production always runs with zero bots.

## Commands

| Command                             | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                       | Run client and game server                                            |
| `npm test`                          | Unit and real HTTP/WebSocket integration tests                        |
| `npm run test:e2e`                  | Chromium desktop/mobile lobby flows                                   |
| `npm run test:load`                 | Staged lobby checks at 20, 50, 100, and 150 connections               |
| `npm run test:load -- 150`          | Run one lobby size                                                    |
| `npm run lint`                      | ESLint and Prettier check                                             |
| `npm run format`                    | Format implementation files                                           |
| `npm run typecheck`                 | Strict TypeScript across packages and tests                           |
| `npm run build`                     | Build shared, server (including SQL migrations), and browser packages |
| `npm run db:migrate`                | Apply transactional, checksummed SQL migrations                       |
| `npm run db:up` / `npm run db:down` | Start / stop local PostgreSQL                                         |

Install the test browser once with `npx playwright install chromium` (Linux CI uses `--with-deps`). Browser tests always start isolated client and server processes with `DEV_BOT_COUNT=0`; ports 5173 and 2567 must be free. Run them with an account allowed to terminate the child processes they launch; restrictive Windows sandboxes can hang during process-tree cleanup even after assertions pass.

Database integration tests require an explicit `TEST_DATABASE_URL` pointing to a disposable test database. They report a skip when it is absent. The local verification uses a separate `icewater_test` database; CI provisions its own PostgreSQL service and runs this check. Never point the test URL at a production database.

The load harness verifies connection count, synchronized lobby state, and role assignment. It does **not** establish gameplay throughput, render FPS, or full-match capacity. Those remain MVP-43–46. Current verification details are in [TASKS.md](TASKS.md).

## Configuration

| Variable                                | Default / constraint                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `VITE_GAME_SERVER_URL`                  | `ws://localhost:2567`; public browser configuration                                                                          |
| `GAME_SERVER_HOST` / `GAME_SERVER_PORT` | `127.0.0.1` / `2567`                                                                                                         |
| `CLIENT_ORIGIN`                         | `http://localhost:5173`; exact allowed origin                                                                                |
| `GUEST_SESSION_SIGNING_SECRET`          | Required random secret, at least 32 characters                                                                               |
| `GUEST_SESSION_TTL_SECONDS`             | 3600; range 60–86400                                                                                                         |
| `ROOM_MAX_PLAYERS`                      | 150; range 6–150; total humans plus development bots; start minimum always six                                               |
| `DEV_BOT_COUNT`                         | 0; development range 0 to `ROOM_MAX_PLAYERS - 1`; reserves seats from human capacity; disabled in production                 |
| `COUNTDOWN_SECONDS`                     | 5; range 1–30                                                                                                                |
| `RECONNECT_SECONDS`                     | 25; range 20–30                                                                                                              |
| `ICE_COUNT_BRACKETS`                    | Optional JSON array of `{ "maxPlayers": 10, "icePlayers": 1 }` rows covering through 150; see the approved full table in PRD |
| `DATABASE_URL`                          | PostgreSQL URL; required in production                                                                                       |
| `POSTGRES_PASSWORD` / `POSTGRES_PORT`   | Local Compose password / host port (5432)                                                                                    |
| `TEST_DATABASE_URL`                     | Optional explicit isolated database for integration tests                                                                    |

`.env` loads from the repository root; existing process environment values take precedence. `VITE_` variables are bundled into browser code and must never contain secrets. Production requires HTTPS/WSS via a trusted TLS proxy and a private raw server port. Hosting is not configured yet.

HTTP routes are `/health`, `/ready`, `POST /api/guest-session`, `POST /api/rooms`, and `POST /api/rooms/join`. Room APIs require `Authorization: Bearer <guest token>`. Refresh a valid guest token by POSTing `{}` to `/api/guest-session` with the same header. Initial Colyseus public matchmaking routes are blocked; the invite API returns a short-lived seat reservation.

## Structure and sources of truth

```text
apps/client/src/    React UI, network adapter, and Three.js presentation
apps/server/src/    Authentication, authoritative rooms, configuration, persistence
packages/shared/   Safe protocol types, constants, and pure validation
tests/e2e/         Browser lobby flows
tests/load/        Simulated lobby clients
scripts/           Local setup and development tooling
assets/            Original art guidance and retained production briefs
```

- [PRD.md](PRD.md): product behavior and approved Ice-count brackets
- [ARCHITECTURE.md](ARCHITECTURE.md): technical boundaries and implementation decisions
- [ART_DIRECTION.md](ART_DIRECTION.md): visual language and asset rules
- [TASKS.md](TASKS.md): current work and verification
- [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md): contribution rules

The project uses TypeScript, Three.js, React, Vite, Node.js, Colyseus, PostgreSQL, npm workspaces, Vitest, and Playwright. Dependencies are pinned in `package-lock.json`. The world blockout uses original repository-authored geometry and the project-owned character GLB; no third-party world assets were imported.

## Contributors

- Chad Bojelador — co-creator
- Franco Perez — co-creator
