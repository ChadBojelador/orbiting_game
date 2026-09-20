# Original World visible moon - 2026-09-20

- Purpose: make the established moonlight source visible in the Original World night sky as a clear orientation landmark.
- Composition: one distant circular moon aligned with the existing directional moonlight, with a pale solid body, restrained surface mottling, and a soft outer halo. It follows the player at a fixed celestial distance so it never drifts out of the playable sky.
- Palette: icy white and pale lavender-blue against the existing deep-navy sky, matching the established `#b8c9ff` moonlight.
- Constraints: procedural shader geometry only; no downloaded texture, gameplay geometry, collider, shadow pass, post-processing effect, or new dependency. The moon must remain behind opaque world geometry, ignore distance fog, and dispose all GPU resources with the scene.
- IP exclusions: no third-party assets, logos, characters, proprietary celestial artwork, copied textures, or recognizable branded designs.
- Verification: unit coverage for light alignment, camera-relative placement, presentation-only rendering settings, and resource disposal; client typecheck and focused tests.
