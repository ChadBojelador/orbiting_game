# Ice Ice Water! Product Requirements Document

This document is the source of truth for product requirements. Technical implementation belongs in `ARCHITECTURE.md`, and work status belongs in `TASKS.md`.

## Confirmed product decisions

The founders have confirmed the following:

- The product name is Ice Ice Water!
- The MVP targets modern desktop and mobile browsers with a third-person camera.
- Private rooms require at least 6 players and allow at most 150.
- Players create or join private rooms through invite codes.
- Ice-team size depends on the number of players in the room and is controlled by a configurable bracket table.
- A match contains exactly five rounds.
- Every round has 30 seconds of regular play followed by a 30-second Deep Freeze.
- The MVP uses guest display names and temporary sessions; permanent player accounts are out of scope.
- Water players may rescue teammates during regular play but cannot rescue anyone during Deep Freeze.
- Initial hosting must fit within an available free tier; the provider remains to be selected after validating persistent WebSocket and sleep limits.

## Product overview

Ice Ice Water! is a large-room, third-person 3D browser game based on freeze tag. Ice players hunt and freeze the Water team. During regular play, Water players evade Ice and rescue frozen teammates. Rescue then locks when the 30-second Deep Freeze begins, and anyone frozen at its deadline is permanently eliminated from the match.

## Problem statement

Players need an accessible multiplayer party game that supports a large crowd, is understandable within seconds, and creates meaningful teamwork and last-second rescue moments. It must run directly in a browser without installation and remain fair despite normal internet latency.

## Target users

- Friend groups, communities, schools, and online events seeking a shared browser activity
- Casual players who prefer simple controls and short matches
- Desktop and mobile-browser users on modern devices
- Initial operational audience in Southeast Asia

## Goals

- Let a player enter a match from a browser with minimal setup.
- Support 6–150 connected players in one authoritative private room.
- Make freezing, rescuing, and Deep Freeze immediately understandable.
- Create dramatic team rescues without requiring voice or text chat.
- Keep a full match short enough for repeated play.
- Maintain fair outcomes under expected regional network latency.

## Non-goals

- Native desktop or mobile applications
- Voice chat or free-form text chat
- Social-deduction or hidden-role mechanics
- Player-to-player rigid-body collision
- Ranked matchmaking or esports balancing
- Persistent accounts, inventories, progression, or a cosmetic store
- User-generated maps
- Global multi-region launch in the MVP
- Public matchmaking in the MVP
- Photorealistic graphics or complex physics
- Direct use of Pokémon, Pokopia, or other third-party characters, names, logos, models, textures, or recognizable designs

## Core features

### Rooms and roles

- A host creates a private room and receives an invite code.
- Players join the room through that code.
- A room supports 6–150 players.
- The server chooses the Ice-player count from a configurable room-size bracket table. The initial playtest table below was approved on 2026-09-10; it remains subject to playtest balancing.
- Team assignments remain unchanged for the match.

| Connected players at countdown completion | Ice players |
|---|---|
| 6–10 | 1 |
| 11–20 | 2 |
| 21–35 | 3 |
| 36–50 | 5 |
| 51–75 | 7 |
| 76–100 | 10 |
| 101–125 | 12 |
| 126–150 | 15 |

### Movement and arena

- Players navigate a stylized 3D arena using keyboard or touch controls.
- Player characters do not physically push or block one another.
- The playable arena contracts between rounds to discourage hiding.

### Freezing and rescue

- An Ice player freezes a Water player with a validated close-range tag.
- A frozen Water player cannot move.
- An active Water player rescues a frozen teammate by holding the rescue action nearby for approximately 1.5 seconds.
- Multiple rescuers may reduce rescue time, subject to balancing.
- A rescued player receives approximately two seconds of freeze protection.

### Round and Deep Freeze

- Each regular phase lasts 30 server-controlled seconds.
- Players receive a clear warning before Deep Freeze.
- Deep Freeze lasts exactly 30 server-controlled seconds.
- Rescue is disabled immediately when Deep Freeze starts.
- Ice players may continue freezing Water players during Deep Freeze.
- At the deadline, every Water player still frozen becomes permanently frozen and cannot return in later rounds.
- Permanently frozen players may spectate while their static statues remain in the arena when performance permits.

### Match conclusion

- Ice wins immediately if no active Water players remain.
- Water wins if at least one Water player remains after the final round.
- The results screen shows the winning team and basic individual contributions.

## Functional requirements

### Lobby and sessions

- **FR-01:** A player can enter a valid display name and receive a temporary guest session.
- **FR-02:** A host can create a private room and receive an invite code; another player can join with a valid code.
- **FR-03:** The UI displays connected-player count and match state.
- **FR-04:** A host can start only when at least six eligible players are connected, followed by a visible countdown.

### Gameplay

- **FR-05:** The client supports keyboard movement and a documented mobile touch layout.
- **FR-06:** The server owns player position, team, freeze status, protection status, and eligibility.
- **FR-07:** The server rejects impossible movement, out-of-range tags, and invalid rescues.
- **FR-08:** The game displays clear visual distinctions among Ice, active Water, temporarily protected Water, and frozen Water.
- **FR-09:** Frozen players can request help through a limited visual ping.
- **FR-10:** Players can see the current phase, phase timer, round number, and team objective.
- **FR-10A:** Rescue requests received during Deep Freeze are rejected by the server and clearly shown as unavailable by the client.

### Rounds

- **FR-11:** The server transitions rooms through lobby, countdown, regular play, warning, Deep Freeze, round result, and match result states.
- **FR-12:** The server uses one authoritative deadline for the 30-second Deep Freeze.
- **FR-12A:** The server uses one authoritative deadline for the preceding 30-second regular phase.
- **FR-13:** At that deadline, frozen Water players become permanently eliminated atomically.
- **FR-14:** The arena boundary contracts at the start of configured later rounds.
- **FR-15:** The server evaluates win conditions after eliminations and when no active Water players remain.

### Reliability and results

- **FR-16:** A disconnected player may reclaim the same session within a configurable 20–30 second window.
- **FR-16A:** Disconnecting or reconnecting does not reset a player's authoritative team, position, or active, frozen, or eliminated state; any intervening server-authoritative gameplay and deadline changes are retained. If the reservation expires during a match, an active or frozen participant forfeits and becomes permanently eliminated; an already eliminated participant remains eliminated, and the match cannot be rejoined.
- **FR-17:** Disconnecting cannot remove a player's frozen state or bypass a phase deadline.
- **FR-18:** Permanently eliminated players can spectate without affecting gameplay.
- **FR-19:** The server records a match summary and basic contribution totals.

## Non-functional requirements

- **NFR-01 Capacity:** A room must pass automated tests with 150 simulated connections before public release.
- **NFR-02 Performance:** Target 60 FPS on supported desktops and 30 FPS on supported mobile devices at appropriate quality settings.
- **NFR-03 Networking:** Use compact state updates, interpolation, and distance-aware update frequency; avoid sending full JSON snapshots every frame.
- **NFR-04 Authority:** The server must determine all consequential gameplay outcomes.
- **NFR-05 Security:** Validate and rate-limit all client messages; never trust client identity, position, timers, or results.
- **NFR-06 Availability:** A failed room may end safely without corrupting permanent player data.
- **NFR-07 Accessibility:** Objectives and states must not rely on color alone; provide readable labels/icons and reduced-effects settings.
- **NFR-08 Compatibility:** Support an explicitly tested list of current WebGL 2 desktop and mobile browsers before launch.
- **NFR-09 Observability:** Record room lifecycle, connection, error, and performance metrics without logging secrets.
- **NFR-10 Maintainability:** Shared protocol types and state transitions must be documented and covered by automated tests.

## User flows

### Join and play

1. The player opens the website.
2. The player chooses a display name and creates a room or enters an invite code.
3. The server creates or joins the requested private room.
4. The player sees the controls and objective during the countdown.
5. The server assigns Ice or Water and begins the match.
6. The player freezes opponents or rescues teammates according to their role.
7. The player survives or is permanently frozen at a Deep Freeze deadline.
8. The player sees the match result and can queue again.

### Rescue

1. An active Water player approaches a frozen teammate.
2. The UI displays a rescue prompt and progress.
3. The player holds the rescue action while remaining in range.
4. The server validates progress and completes the rescue.
5. The rescued player receives temporary protection and can move again.

### Deep Freeze

1. The server begins a warning and updates every client.
2. Deep Freeze starts with a shared 30-second deadline.
3. Ice continues freezing while rescue is disabled for Water.
4. At zero, the server permanently freezes every Water player who remains frozen.
5. The server declares a winner or prepares the smaller arena for the next round.

### Reconnect

1. The connection drops while a session remains reserved.
2. The player reloads or reconnects within the grace period.
3. The server validates the guest session and restores the authoritative state.
4. If the deadline expires first, normal elimination rules still apply.

## MVP scope

- One optimized 3D arena with shrinking boundaries
- Placeholder or simple low-poly characters sharing one animation rig
- Guest display names and temporary signed sessions
- Private room creation and invite-code joining
- Dynamic rooms supporting 6–150 players
- Ice and Water role assignment
- Keyboard and basic touch movement
- Freeze, rescue, help ping, and post-rescue protection
- Exactly five rounds, each with 30 seconds of regular play and a 30-second Deep Freeze
- Permanent freeze, spectator mode, team result, and basic scores
- Reconnection grace period
- Automated rules tests and staged load tests at 20, 50, 100, and 150 players
- Low, medium, and high graphics presets

## Future features

These are candidates, not committed requirements:

- Multiple maps
- Optional public matchmaking
- Persistent accounts and progression
- Cosmetic customization
- Additional Ice and Water abilities
- Regional matchmaking beyond the initial deployment
- Moderation and reporting tools
- Improved spectator controls and replay highlights

## Success criteria

The MVP is successful when:

- A 150-client automated match completes without room failure or invalid state transitions.
- At least 95% of invited playtesters can enter a match without developer assistance.
- At least 90% of playtesters understand freezing, rescuing, and Deep Freeze after one match.
- Median supported desktop sessions meet the 60 FPS target and supported mobile sessions meet the 30 FPS target under representative load.
- No tested client action can directly award a freeze, rescue, survival, or match result without server validation.
- Playtests show that both teams can win across several room sizes after balancing.
- Critical room creation/joining, round, Deep Freeze, elimination, and reconnection flows pass automated tests.
- The game can be deployed within a selected free-tier allowance for initial private playtests, or the documented hosting spike proves that a paid service is unavoidable.
