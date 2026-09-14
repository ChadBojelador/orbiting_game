# FPS Map Specification

The FPS pivot replaces the legacy procedural freeze-tag world, archived under `docs/archive`. The user also approved integrating the supplied Island and correcting scale/collision. Both maps support FFA, TDM and duel without player-to-player collision.

## Frostline

- X/Z bounds: -60 to +60 metres; Y up; -Z north, +X east. Ground Y=0. The concurrent user change expanded the plan's 80 m horizontal layout to 120 m; vertical dimensions remain unchanged.
- Perimeter walls at X/Z ±60, height 7. Player radius 0.4 m; body 1.8 m standing or 1.1 m crouched/sliding.
- Three lanes: lab walls at X ±19.5, middle depth 27, outer walls Z ±37.5/depth 15.
- Reactor: 7.5 × 7.5 m at (0,0), height 3.5 m.
- Catwalks: X ±43.5, width 9, depth 15, elevation 3. Wedge ramps at Z ±15, depth 15.
- Staggered cover is defined by `ARENA_BLOCKS`. Ice patches at Z ±31.5 are 18 × 13.5 m; shallow-water strips at X ±30 are 6 × 51 m and reduce speed to 70%.
- Wooden house at (-30,-30): uniformly normalized to 8 m wide, 6.55957 m deep and 5.62012 m tall, centered and grounded. This is a closed landmark with a conservative outer-box collider including its roof volume. Decorative openings are not traversable.
- Sixteen authored spawn candidates. Selection scores enemy distance, line of sight and recent death location.

## Island - Fort

The 136.6 MB supplied GLB contains a complete pirate archipelago, thousands of objects, and water planes almost 5,900 source units wide. Bounding the entire file produced the erroneous 220,000 m scale. The FPS release uses its Fort sector as the playable Island map; the full original remains available as source.

- Extract Fort structural buildings and rock/beach/flat terrain. Remove dense foliage, tiny props, other islands, source sea floor and giant water planes.
- Bake node transforms, center X/Z and uniformly scale retained geometry to 112 m across its longest horizontal dimension. Source sea level -18.773349 becomes Y=0. Transformation/hash: `assets/island-build-report.json`.
- Play boundary X/Z ±60 m. Water at Y=0 is shallow, walkable and slows movement. Low visible markers show the boundary; there is no swimming mechanic.
- Derivative: 61,396 triangles, one material draw call, 4,937,100-byte GLB. Collision uses the same centimetre-quantized triangles, 1,105,128 bytes before base64 encoding.
- Sixteen offline-selected spawns on flat land with standing clearance and a two-metre clear exit toward their initial facing direction. Some occupy elevated surfaces. Server safety scoring remains dynamic.
- Feet sample support across their radius to prevent sinking into ledges. Floor queries are bounded by current feet/step height to preserve roof/interior separation. Body clearance uses substepped cross-sections and ceiling rays; shots intersect exact triangles. Standing is deferred beneath low ceilings until there is clearance.

## Build and invariants

Run `npm run assets:island` after changing the source, selection or scale. It rebuilds the runtime GLB, triangle data, report and spawn candidates. Rebuild shared before other checks. Never independently rescale the rendered Island. `scripts/prepare-island.mjs` is deterministic; runtime geometry is indexed by four-metre X/Z cells.

The selected map must reach rendering, authoritative movement, prediction, surface audio, spawn height/visibility and hitscan. Map choice is host-only in the lobby and frozen at countdown. Tests independently raycast the generated GLB and verify every spawn can walk forward. Frostline uses shared analytic blocks and solid ramp wedges. Maximum step-up is 0.32 m; movement substeps prevent tunneling.

Trim/paint are cosmetic. Do not introduce misleading cover without collision. Narrow edges, interior/ceiling traversal, population density, spawn camping, mobile FPS and sustained capacity require playtesting.
