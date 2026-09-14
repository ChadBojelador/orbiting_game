# Frostline Map Specification

The FPS pivot replaces the 400 × 400 island. Its historical specification is in `docs/archive/freeze-tag-map-spec.md`.

## Frame and topology

- X/Z bounds: -40 to +40 metres; Y up; -Z north, +X east. Ground is Y=0.
- Four perimeter walls at X/Z ±40, height 7. Player radius 0.4; body 1.8 standing or 1.1 crouched/sliding.
- Three lanes separated by lab walls at X ±13: central walls Z=0, depth 18; outer lane walls Z ±25, depth 10. Gaps connect routes.
- Central reactor cover: (0,0), 5 × 5 footprint, height 3.5.
- Side catwalks: X ±29, Z=0, width 6, depth 10, elevation 3. Solid wedge ramps at Z ±10, depth 10, provide access.
- Staggered side cover at Z -24,-8,8,24 and X ±24/±30, plus low middle cover at (±5,±14). All cover dimensions are the shared `ARENA_BLOCKS` data.
- Ice patches: (0,-21), (0,21), each 12 × 9; retain momentum.
- Shallow-water strips: X ±20, Z=0, each 4 × 34; movement speed reduced to 70%.
- Sixteen fixed spawn candidates in `SPAWN_POINTS`, distributed around edges. Server chooses based on enemy distance, visibility, and recent death location.
- No shrinking boundary, sea, rescue areas, or player-to-player collision.

## Shared geometry

`packages/shared/src/simulation/arena.ts` is the executable geometry definition used by rendering, authoritative collision, prediction, hitscan, and tests. Update it and this document together. Ramps use matching solid wedges for ray occlusion; movement is substepped to prevent high-speed tunneling. Maximum step-up is 0.32 m. Raised surfaces support landing.

Do not place visible blocking art outside shared collision. Trim/paint are nonblocking details. The arena is a compact playtest layout; 150-player combat density, spawn safety, and route balance remain unvalidated.
