# Frostline production brief — 2026-09-14

- Purpose: original browser-efficient first-person arena, weapons, remote combatants, and procedural audio for Ice Ice Water!
- Composition: 80 × 80 metre frozen research facility; three readable lanes; central reactor; mirrored elevated side routes; sixteen ground spawns. Reserve center screen for aiming. Menus frame a live angled arena preview, with entry controls on the right.
- Palette: polar white #EDF6FA, structural navy #18334B, ice cyan #74D9EC, painted blue #308CAD, safety amber #F3B747, warning coral #E96958.
- Geometry/materials: repository-authored boxes, wedge ramps, cylindrical reactor accents, compact original geometric tools, simple capsule-like armored players; matte painted metal and opaque ice. Shared collision drives visible geometry.
- UI: Bahnschrift display with system sans fallback; large game title, quiet left-aligned forms, thin ice-blue rules. HUD remains peripheral. Amber is for the primary action and score feedback.
- Constraints: no added assets/dependencies; shared materials; low-poly reusable meshes; restrained effects; touch-safe controls and reduced effects.
- IP exclusions: do not copy Veck.io maps, models, UI, names, logos, music, textures, characters, or any other recognizable third-party designs. Licensed supplied files may be considered separately after recording their permission.
- Audio: original Web Audio oscillator/noise envelopes for shots, reloads, hit/headshot/kill feedback, footsteps, jump, slide, landing. No sampled third-party recordings.
- Review: this facility-specific palette and live map composition replace the previous cozy island. Avoid generic dashboard cards; show the actual arena and only actionable settings.

Implementation adaptation (2026-09-15): the concurrent approved layout expands horizontal dimensions from 80 m to 120 m; vertical scale remains unchanged. The persistent character lobby supersedes the initial arena-preview menu composition. Frost Island and the supplied wooden house have separate provenance and shared collision documented in MAP_SPEC.md and assets/asset-provenance.md.
