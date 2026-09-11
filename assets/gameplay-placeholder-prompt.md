# Core gameplay placeholder production brief

- **Purpose:** Original, code-built arena and shared character rig for MVP-15–25. Temporary gameplay geometry, not approval of the pending MVP-51 art direction.
- **Composition:** A 56 × 56 metre mint playfield, cream perimeter, six low block obstacles, broad crossing lanes, and at least 150 distinct collision-free spawn positions. Third-person camera above and behind the local character.
- **Palette:** Mint `#79d49a`, aqua `#48cfe3`, ice `#bdefff`, indigo `#4056d8`, cream `#fff1d1`, coral `#ff8d7a`.
- **Character:** One reusable articulated low-poly traveler hierarchy; rounded head, compact torso, two mitten arms and wide feet. Shared meshes/materials and procedural idle, run, rescue and freeze poses. Ice has angular shoulder/crown accents; Water has a rounded crest; protection has a cream ring; frozen players have a faceted shell and raised-arm pose.
- **Constraints:** No downloaded textures or models, no player collision, simple static geometry matching shared collision bounds, no per-player lights, capped pixel ratio, reduced-motion support. State labels supplement color. Mobile movement lower left, contextual action lower right; unobstructed center view.
- **IP exclusions:** No Pokémon, Pokopia, third-party characters, recognizable creature silhouettes, franchise costumes/logos, weapons, text textures or watermarks.
- **Source/license:** Original repository-authored geometry using the MIT-licensed Three.js engine. No external world-asset import. Existing concept is a mood reference only.

## HUD design plan

Use the existing Trebuchet MS display / Segoe UI body fonts and palette. The arena fills the screen; a compact role/objective strip sits at the top, local state and rescue progress above the controls, and player names track their characters. Left-align instructions. Rounded cream control surfaces follow the toy-playground art direction. Keep the center clear, with all motion tied to locomotion or a gameplay event. Reviewed against the brief: no extra dashboard panels or decorative cards; visible state shapes and labels carry gameplay information.
