# Frost Island archipelago production brief

## Purpose

Redesign the existing Island arena as Frost Island: a readable, fast-paced combat archipelago for FFA, balanced-team TDM, and duel. Preserve the optimized supplied Fort derivative as the recognizable central ruin while expanding the playable layout with original, lightweight geometry.

## Composition

- Keep visibly separate land masses surrounded by cyan ocean: one large central battlefield, four specialized cardinal islands, and two smaller southern flank islands.
- Make the retained Fort ruin, damaged courtyard, and glowing Cryogenic Core the central orientation landmark and primary combat hotspot.
- North: elevated observation and sniper cover with interrupted sightlines and two counter-approach bridges.
- West: frozen industrial yard with warehouse, containers, machinery, and three medium-range approaches.
- East: research station with laboratory blocks, narrow lanes, and elevated structures.
- South: frozen harbor with docks, trapped vessel silhouette, cargo, and three rotations toward center.
- Southwest and southeast: compact traversal islands supporting alternate L-shaped flank routes.
- Spawn players on protected outer-island positions with clear exits toward combat. Keep central spawns out of the active pool.

## Palette and materials

- Polar snow `#EDF6FA`, structural navy `#18334B`, ice cyan `#74D9EC`, painted blue `#308CAD`, safety amber `#F3B747`, danger coral `#E96958`.
- Retain the supplied Fort material treatment on the central derivative.
- Use dark rock/steel island sides, pale snow tops, translucent cyan ice routes, amber route markings, and restrained emissive cyan on the Cryogenic Core.

## Gameplay and technical constraints

- Maintain an archipelago silhouette; never merge the islands into one continuous landmass.
- Give each major destination at least two approaches and avoid single mandatory chokepoints.
- Preserve shallow-water movement as a slower fallback route; bridges and ice paths are the faster rotations.
- Bound extreme sightlines with central ruins, facility blocks, ridge cover, fog, and staggered approaches.
- Keep all traversal, cover, floor height, body clearance, spawn, prediction, and hitscan geometry shared and server-authoritative.
- Reuse the existing optimized Fort GLB without editing its generated triangles. Apply one documented transform identically to rendering and collision.
- Use shared materials and instancing for repeated cover. Keep remote islands geometrically simple and rely on frustum culling.
- Preserve mobile controls and the 20 Hz authoritative server target. Do not add a physics engine or new runtime dependency.
- Deep-water swimming, moving platforms, ziplines, pickups, new objective modes, and underground interiors remain future work unless separately approved.

## Explicit IP exclusions

- Do not copy Veck.io or any other game's map layout, branded props, logos, factions, buildings, vehicles, weapon silhouettes, icons, textures, or distinctive landmarks.
- Do not download or introduce third-party assets. Use only the already supplied Fort derivative and repository-authored procedural geometry.
- Do not imply that the supplied reuploaded Island asset has independently verified original-rightsholder permission; retain the existing release gate and attribution.
