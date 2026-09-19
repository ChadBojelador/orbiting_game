# FPS Map Specification

The FPS pivot replaced freeze-tag gameplay, archived under `docs/archive`; the first procedural map is now restored as Original World under current FPS rules. The user approved the supplied Fort derivative and the later Frost Island archipelago redesign. All three maps support FFA, TDM and duel without player-to-player collision.

## Frostline

- X/Z bounds: -60 to +60 metres; Y up; -Z north, +X east. Ground Y=0. The concurrent user change expanded the plan's 80 m horizontal layout to 120 m; vertical dimensions remain unchanged.
- Perimeter walls at X/Z ±60, height 7. Player radius 0.4 m; body 1.8 m standing or 1.1 m crouched/sliding.
- Three lanes: lab walls at X ±19.5, middle depth 27, outer walls Z ±37.5/depth 15.
- Reactor: 7.5 × 7.5 m at (0,0), height 3.5 m.
- Catwalks: X ±43.5, width 9, depth 15, elevation 3. Wedge ramps at Z ±15, depth 15.
- Staggered cover is defined by `ARENA_BLOCKS`. Ice patches at Z ±31.5 are 18 × 13.5 m; shallow-water strips at X ±30 are 6 × 51 m and reduce speed to 70%.
- Wooden house at (-30,-30): uniformly normalized to 8 m wide, 6.55957 m deep and 5.62012 m tall, centered and grounded. This is a closed landmark with a conservative outer-box collider including its roof volume. Decorative openings are not traversable.
- Sixteen authored spawn candidates. Selection scores enemy distance, line of sight and recent death location.

## Frost Island

Frost Island is a 160 × 160 metre combat archipelago. It preserves the optimized supplied Fort derivative as the recognizable central ruin and adds original procedural land, routes, facilities, and cover from `island-layout.ts`. The 136.6 MB source referenced by the original build report is absent from the current working tree; do not claim it is retained or attempt to extract additional source sectors until it is restored and inspected.

- Coordinate boundary: X/Z ±80 m; Y up; -Z north and +X east. Water surface Y=0.
- Central battlefield: overlapping snow platforms span roughly X ±29 and Z -27 to +20. The retained Fort is uniformly transformed by scale 0.52 and Y offset 0.25 in both rendering and collision. A five-metre Cryogenic Core at the origin, damaged facility blocks, containers, barriers, and machinery create close/medium lanes and interrupt cross-map sightlines.
- North island: X 0 / Z -68, observation platform and asymmetric ice ridges. Two metal bridges and a narrow ice path approach the center. Two stair routes counter the elevated position.
- West island: X -68 / Z 0, frozen warehouse, containers, pipeline, and loader. North bridge, south bridge, and central ice route support medium-range rotations.
- East island: X +68 / Z 0, two research blocks, connecting facility lane, and generator. North bridge, south bridge, and central ice route provide separate approaches.
- South island: X 0 / Z +68, trapped-vessel silhouette, cargo, crane base, and broken dock. Two dock bridges and one ice route connect to the center.
- Southwest/southeast islands: compact flanking land masses around (±47,+47). Each has an L-shaped center route and a second harbor rotation so players can bypass the central approach.
- Land masses remain visibly separate above cyan ocean. Bridges and ice paths are fast routes; water is a slower fallback. Sea movement uses deterministic buoyancy/drag: players float 0.55 m below the surface, hold jump to rise, move at 70% base speed, and receive no sprint or slide boost.
- All sixteen spawn candidates are on outer islands. Spawns have clear inward exits and are approximately five seconds from the central core at base movement speed. Dynamic server scoring still accounts for enemy distance, visibility, and recent death position.
- The Fort derivative remains 61,396 triangles, one material draw call, and 4,937,100 bytes. Procedural surfaces and cover are instanced by region/material for frustum culling; the Cryogenic Core uses distance-based LOD. No new runtime dependency or downloaded asset is introduced.
- Feet sample support across their radius. Floor queries remain bounded by current feet/step height; body clearance uses substepped cross-sections and ceiling rays. Shots intersect both exact transformed Fort triangles and authored analytic blocks.

## Build and invariants

Edit `island-layout.ts` for Frost Island land, routes, cover, bounds, and the single shared Fort transform. Do not separately transform the rendered Fort or generated collision. Fort triangle data is indexed by three-metre X/Z cells and combined with the analytic layout at query time. `npm run assets:island` rebuilds the retained Fort derivative only after the missing original source GLB has been restored; it must not overwrite the authored outer-island spawn plan.

The selected map must reach rendering, authoritative movement, prediction, swimming/surface audio, spawn height/visibility and hitscan. Map choice is host-only in the lobby and frozen at countdown; `arenaHalfExtent` updates with it. Tests independently raycast the transformed GLB plus procedural blocks, verify the archipelago topology, and verify every spawn can walk forward. Frostline uses shared analytic blocks and solid ramp wedges. Maximum step-up is 0.32 m; movement substeps prevent tunneling.

Trim, core rings, and distant LOD detail are cosmetic and stay inside visible colliders. Do not introduce misleading cover without collision. Underground interiors, jump pads, ziplines, pickups, deep-water elimination, narrow edges, population density, spawn camping, sightline balance, mobile FPS, and sustained capacity require later implementation or playtesting.

## Original World

Restored from GitHub commit [87a8893](https://github.com/ChadBojelador/orbiting_game/commit/87a8893f6b84acc39f9b2df709153abe26079cdd), the first arena world foundation, before the Version 2 expansion. Select Original World before room creation or as the connected lobby host. Identifier: original.

- Original X/Z authored envelope ?125 m, fixed throughout the FPS match; ocean Y=1.5. Original colorful palette, irregular terrain and elevations are retained.
- Nine land regions: village, forest, Crystal Valley, Ice Peaks, meadow, beach, and three coastal islands. Retains the village crystal, ancient tree, crystal spire, ice summit, meadow windmill, beach arch, original river network, two waterfalls and four bridges.
- Original village cover is rendered as solid wooden blocks. Mesh terrain, bridge decks/rails, landmarks, vegetation, and cover share baked triangle collision. River ribbons are closed shallow volumes that provide channel floors. The ocean is a closed six-metre-deep water column with a matching analytic seabed; hold crouch to dive, hold jump to rise, or release both to return to the normal surface float depth.
- The 3.125 m terrain grid is an indexed, welded, closed volume: top faces point upward, exposed coast/river/world-envelope walls point outward, and a shared underside closes each land section at `WATER_BOTTOM`. Coast walls continue to that seabed so underwater cameras cannot see through the landmass. Terrain, paths, rivers, and ocean use normal front-face culling. The ocean has an explicit downward-facing interior surface; only presentation sheets such as waterfalls and the boundary remain intentionally double-sided.
- Sixteen distinct village/inner-approach spawns have clear inward exits; server scoring accounts for enemies, visibility, and last death. The restored layout is not yet validated for 150-player combat.
- Edit original-topology.ts / OriginalWorldMap and run npm run assets:original together. The generated original-data.ts is collision only. Independent renderer raycasts, closed-manifold/winding checks, and spawn movement tests verify the bake. Boundary and paint remain cosmetic; the windmill blades stay at their baked pose. No freeze-tag behavior returns.
