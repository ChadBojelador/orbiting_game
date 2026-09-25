# Procedural Sky Clouds Production Brief

## Purpose

Add a calm, readable cloud layer to all playable maps so the sky feels alive without changing gameplay, collision, navigation, or the authored map silhouettes.

## Composition

- Distribute sparse, soft-edged cloud banks around and above the playable space with varied widths, depths, rotations, and altitudes.
- Keep broad gaps of open sky and avoid a uniform ring, repeated grid, dense ceiling, or persistent obstruction at the crosshair.
- Move the banks slowly in a generally shared wind direction with small per-cloud drift differences.
- Recycle distant clouds around the player so the atmosphere remains continuous across the full map without creating a large world mesh.

## Palette and lighting

- Frostline and Frost Island: frost-white highlights with cool cyan-blue undersides that complement polar white, ice cyan, painted blue, and the bright daytime sky.
- Original World: restrained lavender-blue moonlit clouds that remain subordinate to the moon disc, crystal landmarks, and deep-navy night sky.
- Allow only a subtle, slowly changing reduction in the primary sky light as cloud cover passes overhead. Never make routes, players, or the environment materially dark.

## Technical constraints

- Presentation-only client effect: no collision, shadows, server state, shared simulation changes, or gameplay authority.
- Use deterministic procedural texture data and instanced planes; do not add a runtime dependency or downloaded texture.
- Keep the effect to a few draw calls, a small fixed instance budget, no cloud shadow-map pass, and no per-frame allocations.
- Reduce the visible instance count and motion/lighting variation for touch or reduced-effects modes.
- Hide the sky layer while the camera is underwater and dispose all owned GPU resources on scene teardown.
- Preserve clear silhouettes, open sky, mobile readability, and current fog/tone-mapping behavior.

## Explicit IP exclusions

- Do not copy cloud art, skyboxes, weather patterns, shaders, textures, silhouettes, logos, or distinctive compositions from Veck.io or any other third-party game.
- Do not import internet assets. The result must be an original repository-authored procedural effect.
