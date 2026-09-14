# Interactive lobby production brief

- Purpose: an original, real-time Three.js lobby that establishes Ice Ice Water as a competitive arena FPS before a private match begins.
- Composition: a full-body player character holding the selected primary weapon on an illuminated deployment ring. Use an off-axis, low three-quarter camera with open space around the silhouette. Loadout and customization states move the same camera closer instead of opening unrelated scenes.
- Environment: a dark frozen research hangar with steel floor plates, cryogenic tanks, frozen pipes, restrained holographic screens, a slowly rotating vent, distant angular mountain silhouettes, drifting frost, fog, and a few animated work lights. The environment remains subordinate to the character.
- Palette: abyss navy `#06111D`, frozen steel `#11283A`, glacier cyan `#77E6F5`, frost white `#EAFCFF`, warning amber `#FFBD59`, and muted ice `#93AFBF`.
- Lighting: cool white key, soft blue fill, cyan rim, dark navy environment, and an amber deployment accent. Preserve clear separation between the character, weapon, and background.
- Interaction: damped cursor parallax in normal lobby states; drag-to-rotate and wheel-to-zoom only in customization; 500–900 ms camera easing between authored views.
- Animation: reuse the current character Idle clip. Add slow stance/weapon drift, sparse frost movement, the vent rotation, hologram flicker, and deployment-ring activation. Respect reduced-effects preferences and pause nonessential work while hidden.
- Performance constraints: one renderer, one character instance, procedural low-poly environment geometry, shared materials, capped device pixel ratio, no post-processing dependency, and no more than 520 frost particles on desktop or 180 on coarse-pointer devices.
- Audio: decode the repository-authored `assets/music/bg1.mp3` once per application session, loop it through one Web Audio buffer source for gapless playback, preserve it across lobby panels, and fade it out before gameplay. Synthesized wind, machinery, and interface cues share the same master/music/SFX preference graph.
- Fallback: keep all lobby controls usable and show a descriptive visual fallback if WebGL initialization or model loading fails.
- IP exclusions: no third-party characters, recognizable franchise armor, copied weapons, logos, UI layouts, branded props, textures, or watermarks. The facility, props, weapon proxy, and interface are repository-authored.

UI plan: a full-bleed stage with a narrow left navigation rail, compact player identity at the upper-right, one contextual command panel, and a low party dock. Bahnschrift Condensed supplies the competitive display voice and Segoe UI handles dense controls. Angled panel corners, bracket marks, and a single amber primary action replace rounded card grids.

Layout: `[left navigation | open 3D character stage | contextual command panel]` over `[party dock]`. On narrow screens the stage remains visible above a scrollable command sheet.

Review: the deployment ring is the single visual flourish. Other animation and glass treatment remain restrained, all backend-dependent states are labelled honestly, and private rooms—not fake public matchmaking—drive the Play flow.
