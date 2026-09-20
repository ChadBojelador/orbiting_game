# Original World crystal gradient and shadow - 2026-09-20

- Purpose: give the cyan crystal landmarks readable depth, a strong magical glow, and a large-scale regional lighting role at night.
- Composition: each low-poly shard grades from a deep, shadowed cyan base through saturated cyan facets to a pale icy tip. Emission follows that same vertical gradient, keeping the base and alternating facets shaded while the tip glows strongly. The three existing crystal lights cast broad overlapping cyan pools across the map.
- Palette: deep navy-cyan `#08263f`, saturated sky cyan `#5ea8ff`, bright aqua `#9ee8ff`, icy tip `#d8fbff`, and vivid cyan emission `#16b9d4`.
- Constraints: preserve every existing vertex position, landmark transform, collider, light count, and shadow-map pass. Use vertex colors, the existing standard-lit material, and the existing three shadowless point lights only; no texture, transparency, refraction, bloom, new light, or dependency. Crystal ranges are 85 m at Village, 110 m at Crystal Valley, and 75 m at the island moonstone.
- IP exclusions: no third-party assets, logos, proprietary crystal designs, copied textures, or recognizable branded forms.
- Verification: confirm brighter upper vertices than lower vertices, tip-weighted emission, standard shadow casting and receiving, broad bounded light ranges, unchanged collision positions, focused tests, lint, types, and production build.
