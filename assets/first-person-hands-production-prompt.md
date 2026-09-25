# First-person hands production prompt

## Purpose

Create a lightweight, code-native first-person arm rig that restores player embodiment in Ice Ice Water without implying a weapon, inventory item, or combat tool.

## Composition

- Show two forearms entering from the lower corners of the camera view.
- End each arm in an empty, relaxed open hand with a readable palm, four softly separated fingers, and a thumb.
- Keep the center of the screen and crosshair clear.
- Use a wider, forward bracing pose during slides; use smaller opposed arm swings for walking and stronger opposed swings for sprinting.
- Keep every part within a tightly bounded camera-local viewmodel volume so it cannot intersect the camera or the player body.

## Palette and materials

- Ice sleeve: deep glacier blue `#236581`.
- Water sleeve: deep ocean blue `#245E88`.
- Ice hand: pale frost cyan `#C8F4FF`.
- Water hand: clear aqua `#74D9EC`.
- Cuff: dark navy `#17374A`.
- Use matte, slightly rough materials with restrained highlights so the hands remain readable on bright snow and in the darker Original World.

## Constraints

- Procedural Three.js geometry only; no new runtime dependency or downloaded asset.
- No gun, weapon, tool, item, muzzle, barrel, grip, or weapon-like silhouette.
- Low polygon count and shared geometry/materials for desktop and mobile rendering.
- Animation is presentation-only and reads predicted movement state and actual velocity without changing movement simulation.
- Smooth all pose transitions; preserve reduced-effects support.
- Keep the hands below the crosshair and render them as a first-person viewmodel to prevent world-geometry clipping.

## IP exclusions

- Do not imitate or reproduce hands, gloves, sleeves, silhouettes, skins, or weapon poses from Veck.io or any other third-party game.
- Do not use third-party textures, logos, characters, branded costume elements, or proprietary animation data.
