# Asset provenance

No files were downloaded or extracted from Veck.io for this implementation. The user identified the local Island and wooden-house GLBs as the assets they have permission to reuse and approved their integration. The following records distinguish that authorization from independently verified ownership.

| Asset | Source / author | Permission and inspection | Runtime use |
|---|---|---|---|
| Frostline facility, weapons, combat-player geometry, particles | Original repository TypeScript; retained production prompt | Project source; no external model/sample | Three.js gameplay |
| Combat/movement cues | Original Web Audio envelopes | Project source | AudioManager |
| Island GLB | Embedded title: "chicken gun pirateislands reupload"; uploader amogusstrikesback2; [source listing](https://sketchfab.com/3d-models/chicken-gun-pirateislands-reupload-893581df1abf4d35a0dd849b169722fc) | Embedded CC BY 4.0; user confirmed reuse permission. Source calls itself a reupload and includes PolygonPirates mesh/material names. Original-rightsholder permission is not established by uploader metadata; retain documentary evidence before public release. Listing fetch returned 403 during review. | Optimized Fort derivative, with full source retained unchanged |
| Wooden house | iGauravRajput; [source listing](https://sketchfab.com/3d-models/low-poly-wooden-house-rusty-3d-model-free-abc884c3fea04b9aa4991a3691aa9a36) | Embedded CC BY 4.0; user confirmed permission for the supplied file. Listing could not be fetched during review. | Normalized closed Frostline landmark |
| Lobby character | Pre-existing assets/character/test_char_model.glb | Project-supplied; independent ownership/provenance documentation still needed | Lobby character with existing animations |
| Lobby music | Pre-existing assets/music/bg1.mp3; described as repository-authored in retained lobby production brief | Ownership documentation still needed | LobbyAudio |
| Historical concepts and alternate character copy | Existing assets/concepts files | Historical audit remains open | Not imported by active FPS runtime |

## Modifications and attribution

Island preparation extracts the Fort sector, removes dense foliage/tiny props/other sectors, bakes node transforms, uniformly normalizes to 112 m, quantizes vertices to centimetres, and merges structural surfaces. The same coordinates generate shared collision and safe spawns. Source hash, transformation and byte/triangle counts are in `island-build-report.json`; reproducible command: `npm run assets:island`.

The house is centered, grounded and uniformly normalized to eight metres across its largest dimension. Its conservative outer bounds form a closed landmark collider. Source GLBs are preserved.

Both supplied files name [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Author/source/license links and modification notices are retained in `ATTRIBUTION.txt`, included in the client build and linked from the player profile. These notices do not imply the original rights have been independently verified. User permission statements are part of this task's conversation; no separate permission document was supplied.

Vite public-directory copying is disabled. Only explicit runtime imports ship. Do not silently substitute a mirror's license for original-rightsholder permission or describe these assets as verified Veck.io assets.
