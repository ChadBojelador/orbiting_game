# AI Agent Instructions

These instructions apply to all AI coding agents working in this repository. More specific nested `AGENTS.md` files may add local rules but may not weaken repository security or source-of-truth requirements.

## Project overview

Ice Ice Water! is a browser-only, third-person 3D multiplayer freeze-tag game for private rooms of 6–150 players. Each of five rounds has 30 seconds of regular play, when Water can rescue teammates, followed by 30 seconds of Deep Freeze, when rescue is disabled. Players still frozen at the deadline are permanently eliminated.

## Sources of truth

- `PRD.md`: product requirements and MVP scope
- `ARCHITECTURE.md`: technical structure and decisions
- `ART_DIRECTION.md`: visual language, asset sourcing, and generation prompts
- `TASKS.md`: current work and status
- `AGENTS.md`: AI-agent working rules

Read `PRD.md` and `ARCHITECTURE.md` before implementing any major feature. Check `TASKS.md` before starting work and keep the relevant entry accurate when requested to manage task status.

When documents disagree, stop and surface the conflict. Do not silently choose a new requirement or architecture.

## Tech stack

- TypeScript throughout application code
- Three.js for the 3D browser client
- React for lobby, HUD, settings, and results
- Vite for client development and builds
- Node.js and Colyseus for authoritative rooms and networking
- PostgreSQL for durable data
- Redis only when documented multi-process requirements justify it
- npm workspaces for the monorepo
- Vitest, Playwright, and multiplayer load tests

## Planned folder structure

```text
apps/client/       Browser UI and Three.js presentation
apps/server/       Authoritative Colyseus server
packages/shared/   Safe shared protocol types and pure utilities
tests/e2e/         Browser-level critical flows
tests/load/        Simulated multiplayer clients
assets/            Source guidance and optimized runtime assets
```

Respect the module responsibilities in `ARCHITECTURE.md`. Do not create alternate top-level application structures without documenting and approving the change.

## Coding conventions

- Use strict TypeScript. Do not introduce `any` without a narrow, documented integration reason.
- Prefer small, cohesive modules and pure functions for game-rule calculations.
- Validate data at process and trust boundaries.
- Use early returns to keep control flow readable.
- Avoid hidden global mutable state.
- Express phase transitions explicitly; do not scatter timer-based transitions across handlers.
- Keep authoritative rules on the server and visual presentation on the client.
- Add comments for intent and constraints, not for obvious syntax.
- Follow the configured ESLint and Prettier rules once available.

## Naming conventions

- Files and directories: `kebab-case`, except framework-required names
- TypeScript variables and functions: `camelCase`
- Classes, React components, types, and interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` only for true module-level constants
- Boolean values: use `is`, `has`, `can`, or `should` prefixes
- Database tables and columns: `snake_case`
- Colyseus messages: lowercase `domain/action`, such as `action/frost-throw`
- Tests: `<unit>.test.ts` for unit/integration tests and `<flow>.spec.ts` for browser tests

## Architecture rules

- The server is authoritative for position, roles, freeze status, rescue progress, phase deadlines, elimination, and results.
- Clients send input and action intent, never trusted outcomes.
- One active match belongs to one Colyseus room and one server process.
- Live room state remains in memory; do not persist per-tick state to PostgreSQL.
- `packages/shared` may contain protocol types, constants, and pure utilities only.
- The client and server must not import directly from one another.
- Disable player-to-player physical collision unless the PRD and architecture are intentionally revised.
- Reject all rescue intent during Deep Freeze, even if a stale client displays a rescue control.
- Keep the Ice-count bracket table configurable; do not invent or hard-code balancing values without recording the decision.
- Optimize only after measurement, except for established 150-player constraints documented in the architecture.
- Never change architecture or introduce a major dependency without documenting the reason, alternatives, and consequences in `ARCHITECTURE.md`.

## Planned commands

Run commands from the repository root unless a package says otherwise:

```bash
npm install          # Install workspace dependencies
npm run dev          # Run client and server locally
npm run test         # Run unit and integration tests
npm run test:e2e     # Run critical browser flows
npm run test:load    # Run multiplayer load scenarios
npm run lint         # Check lint rules
npm run typecheck    # Check TypeScript types
npm run build        # Build all production packages
```

These commands are a required scaffold contract. Until package manifests exist, do not claim that they have run successfully.

## Dependency rules

- Prefer platform and existing dependency capabilities before adding packages.
- Add a dependency only to the workspace that uses it.
- Check maintenance status, license, browser/server compatibility, bundle cost, and security before addition.
- Pin through the lockfile and commit `package-lock.json`.
- Do not add overlapping libraries for the same responsibility without removing or justifying the existing choice.
- Redis, a physics engine, analytics, authentication providers, and infrastructure orchestrators are major additions requiring an architecture update.
- Prefer verified free-tier services for the initial private playtest, but document operational limits and do not misrepresent a sleeping or trial service as production-ready.
- Never install a dependency merely to replace a small, clear utility.

## Database and API conventions

- Make every schema change through a committed migration.
- Use UUID durable identifiers and UTC timezone-aware timestamps.
- Access PostgreSQL through server repository modules, not from rooms or clients directly.
- Use transactions for related match-summary writes.
- Keep HTTP endpoints narrow and version them if a public API grows.
- Define and validate all network payloads.
- Include movement input sequence numbers where reconciliation requires them.
- Keep protocol changes backward-compatible within a deployment when practical; otherwise update client and server together.

## Security rules

- Never expose secrets or commit `.env`.
- Never place secrets in `VITE_` variables; they are visible to browsers.
- Treat every client payload as hostile.
- Validate session tokens, message shape, ranges, rates, cooldowns, and current phase.
- Sanitize display names and any user-visible input.
- Rate-limit session creation, joins, gameplay actions, and help pings.
- Use HTTPS and secure WebSockets outside local development.
- Do not log tokens, connection strings, secrets, or unnecessary personal data.
- Do not implement client-authoritative shortcuts, even temporarily, without isolating them to explicit local test fixtures.
- Report discovered credential exposure or security weaknesses immediately; do not conceal them in unrelated changes.

## Testing expectations

- Add or update tests with every behavioral change.
- Unit-test pure game rules and boundary cases.
- Integration-test room lifecycle, invalid messages, reconnection, and database writes.
- Test phase deadlines with controlled/fake time rather than slow real-time waits.
- Test simultaneous Deep Freeze resolution atomically.
- Include browser tests for join, play, freeze, rescue, elimination, spectate, and results.
- Add load scenarios progressively at 20, 50, 100, and 150 clients.
- A change is not complete until relevant tests, lint, type checking, and builds pass, or the handoff clearly documents why they could not run.
- Never weaken or delete a failing test merely to make a change pass unless the requirement itself changed and the source-of-truth documents were updated.

## Documentation expectations

- Update `PRD.md` when approved product behavior changes.
- Update `ARCHITECTURE.md` when technical boundaries or major decisions change.
- Update `ART_DIRECTION.md` when the visual language, asset-license policy, or generation-prompt standards change.
- Update `TASKS.md` when explicitly managing work status or completing tracked work.
- Update `README.md` when setup, commands, prerequisites, or contributor-facing behavior changes.
- Record assumptions explicitly instead of presenting them as confirmed requirements.
- Keep documentation concise and consistent; remove stale guidance when replacing it.

## Working behavior

- Keep changes focused on the assigned task.
- Do not modify unrelated files unnecessarily.
- Preserve user changes and inspect the working tree before editing.
- Do not reformat unrelated files.
- Do not start major features without reading the PRD and architecture.
- Do not silently expand MVP scope.
- Do not copy Pokémon, Pokopia, or any other third-party character, logo, model, texture, name, or recognizable design. Inspiration must remain at the level of broad visual qualities.
- Before generating a visual asset, write and retain a structured production prompt that states purpose, composition, palette, constraints, and explicit IP exclusions.
- Before importing an internet asset, verify its original source and license, record both, and preserve any required attribution.
- If a requested change conflicts with the PRD or architecture, explain the conflict and update the source of truth only with clear authorization.
- Summarize changed files, verification performed, and remaining risks in the final handoff.
