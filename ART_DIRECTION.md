# Ice Ice Water! Art Direction

The approved FPS pivot establishes **Frostline: a bright frozen research facility** and the user-approved **Island - Fort** arena. Previous art direction and concept images are historical in `docs/archive` and `assets/concepts`.

## Visual language
- Crisp, readable low-poly painted metal, polar-white walls, navy structural blocks, cyan ice, amber route paint, and coral opponents.
- Palette: #EDF6FA polar white, #18334B structural navy, #74D9EC ice cyan, #308CAD painted blue, #F3B747 safety amber, #E96958 danger coral.
- First-person eye-height composition: keep center screen clear for crosshair and silhouettes, place health/ammo at the lower corners, timer above, kill feed to the right.
- Original compact geometric weapon silhouettes, with understated recoil, ADS, reload and switch animations. No gore. Headshots and kills use readable HUD/audio confirmation.
- Mobile uses portrait/landscape touch layouts and a selectable control mode. Reduced effects suppress camera landing dip, muzzle flashes, tracers, and particles.
- The main menu is a persistent real-time 3D frozen-facility lobby. A full-body player holding the selected primary weapon stands on an amber deployment ring, framed by dark steel, cryogenic tanks, cyan work lights, sparse frost, and deep navy fog. Use an off-axis third-person camera with damped cursor parallax; Loadout and Customize move that same camera closer.
- Lobby navigation is a narrow left rail, the contextual private-room panel sits on the right, and the current party occupies a compact lower dock. Bahnschrift/system sans typography, clipped ice-facet corners, frost-white type, cyan selection, and one amber deployment action keep the interface competitive without becoming a grid of decorative cards.
- The lobby may borrow broad staging quality from modern multiplayer games but must not copy any third-party layout, faction, character, weapon, icon set, logo, or progression system. Profile, party, social, and cosmetics surfaces must label unavailable backend services honestly.

## Production assets
The retained structured brief is [Frostline production prompt](assets/frostline-production-prompt.md). Frostline facility geometry, weapons, combat players, effects, and synthesized combat cues are repository-authored. The supplied wooden house is an eight-metre closed landmark with a shared conservative collider. Island uses the optimized Fort sector with its original painted sand/stone/wood palette and shallow cyan water. The lobby uses the retained project character model and music. Vite public-directory copying is disabled; assets ship only through explicit imports.

Veck.io is a gameplay/visual reference. The user confirmed reuse authorization for both supplied GLBs. Embedded Sketchfab attribution, modifications, hashes, and the unresolved underlying permission evidence are recorded in [asset provenance](assets/asset-provenance.md). The Island source calls itself a reupload; that metadata alone does not establish original-rightsholder permission. No assets were downloaded from Veck.io.

## Constraints and review
Share geometry/materials, cap transient effects, and keep recorded attribution with imported models. Rendered cover and collision must match the selected shared map definition. Island uses a reproducible geometry/collision bake; see MAP_SPEC.md. Decorative paint/trim cannot create misleading cover. Color is supplemented by text, protection labels, damage direction, silhouettes, and sound. Device performance, full crowd readability, and final visual polish require playtesting.
