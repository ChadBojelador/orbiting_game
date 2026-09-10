# Ice Ice Water!

Ice Ice Water! is a browser-only, third-person 3D freeze-tag game for 6–150 simultaneous players. A size-balanced Ice team freezes Water players, while Water players rescue one another during regular play and try to survive each round's unrescuable 30-second Deep Freeze.

> Project status: documentation and planning only. The application has not been scaffolded yet.

## Problem

Most browser party games are designed for small rooms. Ice Ice Water! aims to deliver a simple, readable social game that remains tense and playable with groups of 6–150 people without requiring an installation.

## Core features

- Browser-only 3D gameplay
- Private rooms for 6–150 players, joined through invite codes
- Ice-team size selected from configurable room-size brackets
- Server-authoritative movement, freezing, rescuing, and elimination
- Hold-to-rescue teamwork with short post-rescue protection
- Five-round matches with a shrinking arena
- A 30-second regular phase in which Water players can rescue teammates
- A 30-second Deep Freeze at the end of every round
- Rescue is disabled during Deep Freeze
- Permanent elimination for players still frozen when Deep Freeze ends
- Reconnection window and spectator mode
- End-of-match team result and basic contribution scores

See [PRD.md](PRD.md) for product requirements. The original cozy toy-diorama visual language and asset rules are defined in [ART_DIRECTION.md](ART_DIRECTION.md).

## Planned tech stack

- **Client:** TypeScript, PlayCanvas Engine, React, Vite
- **Server:** Node.js, TypeScript, Colyseus
- **Transport:** Secure WebSockets through Colyseus
- **Database:** PostgreSQL
- **Optional scale-out coordination:** Redis, only when multiple game-server processes require it
- **Assets:** Blender-authored, optimized GLB/glTF files
- **Tooling:** npm workspaces, ESLint, Prettier, Vitest, Playwright, Docker

Technical structure and decisions are defined in [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites

- An active-LTS version of Node.js; the exact version will be pinned during scaffolding
- npm, bundled with Node.js
- Docker Desktop or a local PostgreSQL installation
- A modern browser with WebGL 2 support
- Git

## Installation

The following commands are the intended development contract. They will become available after the scaffold tasks in [TASKS.md](TASKS.md) are completed.

```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

Create a local environment file without committing it:

```bash
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` instead.

Start PostgreSQL after the Docker Compose configuration has been added:

```bash
docker compose up -d postgres
```

## Run locally

```bash
npm run dev
```

The planned defaults are:

- Client: `http://localhost:5173`
- Game server: `ws://localhost:2567`

Other planned commands:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Planned project structure

```text
.
├── apps/
│   ├── client/             # React UI and PlayCanvas 3D client
│   └── server/             # Authoritative Colyseus game server
├── packages/
│   └── shared/             # Shared protocol types, constants, and pure utilities
├── tests/
│   ├── e2e/                # Browser-level critical-flow tests
│   └── load/               # Simulated multiplayer clients
├── assets/                 # Source asset guidance and optimized runtime assets
├── README.md
├── PRD.md                  # Product source of truth
├── ARCHITECTURE.md         # Technical source of truth
├── ART_DIRECTION.md        # Visual and asset source of truth
├── TASKS.md                # Work-status source of truth
└── AGENTS.md               # AI-agent instructions
```

## Environment setup

Copy `.env.example` to `.env` and replace placeholder values. Variables beginning with `VITE_` are included in browser code and must never contain secrets.

Required variables cover the client URL, game-server address, PostgreSQL connection, and guest-session signing secret. Redis is optional for a future multi-process deployment.

Never commit `.env` or real credentials.

## Sources of truth

- Product requirements: [PRD.md](PRD.md)
- Technical structure: [ARCHITECTURE.md](ARCHITECTURE.md)
- Visual direction and asset rules: [ART_DIRECTION.md](ART_DIRECTION.md)
- Current work: [TASKS.md](TASKS.md)
- AI development rules: [AGENTS.md](AGENTS.md)
- Human contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)

## Contributors

- Chad Bojelador — co-creator; GitHub handle and role to be added
- Franco Perez — co-creator; GitHub handle and role to be added
