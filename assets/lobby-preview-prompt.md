# Lobby preview production brief

- Purpose: a small original procedural PlayCanvas rendering for the foundation lobby, demonstrating engine initialization and cleanup.
- Composition: two abstract clay tokens on a mint circular plinth, viewed from an elevated three-quarter camera. No arena collision, gameplay, or production character art.
- Palette: mint #79D49A, aqua #48CFE3, indigo #4056D8, pale frost #BDEFFF, cream #FFF1D1, coral #FF8D7A.
- Constraints: built-in sphere, cylinder, and box geometry only; static lighting; no textures, external fonts, network assets, or motion required. Accessible text fallback when WebGL 2 is unavailable.
- IP exclusions: no third-party characters, recognizable creature designs, franchise costumes, names, logos, models, textures, or copied props.

UI plan: a left-aligned title and compact three-rule introduction beside the join form; after joining, an oversized invite code sits above the roster and host control. Rounded system type (Trebuchet MS for titles, Segoe UI for body), indigo text, mint background, cream panels, and a single coral join action follow ART_DIRECTION.md. On mobile these stack in reading order. The title is the strongest visual element; the preview stays secondary. No generated bitmap assets are needed.

Layout: `[ title + preview + rules | guest / room form ]`, then `[ invite + roster | phase + host start ]`.

Review: the palette, rounded borders, large invite code, and explicit team labels match the brief. Existing unapproved concept art is not treated as production art.
