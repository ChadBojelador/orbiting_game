# Ice Ice Water! World Map Specification

`MAP_SPEC.md` is the single source of truth for physical world layout. Rendering, server movement, spawn placement, collision, navigation tests, biome dressing, and future minimap work must use the stable IDs and coordinates defined here. Decorative offsets may vary by up to 2 units when they do not change topology, collision, sightlines, or named landmark positions.

## World frame

- Playable world: approximately 400 x 400 units in round one, with the original dense 250 x 250 inner world preserved.
- Authored coordinate envelope: `X -200..200`, `Z -200..200`, `Y 0..64`.
- World center: `(0, 0, 0)`.
- Axes: `+X` east, `-X` west, `-Z` north, `+Z` south, `+Y` up.
- Sea level: `Y 1.5`.
- Main player spawn: `SPAWN_VILLAGE`, centered on `(0, 12, 6)` with distributed spawn points across the village green.
- Terrain is an authored, deterministic composition of rounded land lobes, terraces, slopes, and river cuts. Random runtime terrain generation is prohibited.
- The permanent coastline is irregular. The round boundary is a separate magical frost front and must not be mistaken for the coast.

```text
                                 NORTH (-Z)
                                     ^
                                     |
                         +-----------------------+
                         | ICE PEAKS  Y 41-64    |
                         | summit / frozen fall  |
                         +----------+------------+
                                    | WF_MOUNTAIN_01
                    ridge loop -----+----- crystal ascent
                         /                        \
          +-------------+----+              +----+----------------+
          | FOREST Y 17-25   |--------------| CRYSTAL VALLEY      |
          | ancient tree     | village loop | Y 17-27 / cave      |
          +------+-----------+              +----------+----------+
                 \                                     /
                  \       +-------------------+       /
                   +------| VILLAGE Y 10-16   |------+
                          | crystal / stream  |
                          +---------+---------+
                                    |
                           MEADOW Y 4-9
                         windmill / river fork
                                    |
                            BEACH Y 1.5-3
                              arch / lagoon
                                    |
                         SMALL ISLANDS Y 2-6
                                    |
                                     v
                                  SOUTH (+Z)
```

```text
 Z -125  ----------------------------------------------------------------

                              ICE PEAKS
                               (10,-85)

       FOREST                                      CRYSTAL VALLEY
      (-60,-15)                                       (65,-10)

                               VILLAGE
                                 (0,0)

                               MEADOW
                               (-5,60)

                                BEACH
                               (10,105)

                         SOUTHERN SMALL ISLANDS

 Z +125  ----------------------------------------------------------------
          X -125                                      X +125
```

## Elevation bands

| Level |  Elevation | Uses                                 | Transition language                          |
| ----- | ---------: | ------------------------------------ | -------------------------------------------- |
| 0     |   `Y 0..3` | Ocean, beach, lagoon, small islands  | Sand shelves and shallow water               |
| 1     |   `Y 4..9` | Meadow, coast terraces               | Long walkable slopes and low cream ledges    |
| 2     | `Y 10..16` | Central Village                      | Broad green terraces with bridge crossings   |
| 3     | `Y 17..25` | Forest and Crystal Valley            | Switchbacks, roots, crystal shelves          |
| 4     | `Y 26..40` | Mountain approaches and upper cliffs | Ridge trails and guarded ramps               |
| 5     | `Y 41..64` | Ice Peaks and summit                 | Snow shelves, frozen cascade, final overlook |

Elevation changes must be made with walkable ramps or switchbacks on named routes. Vertical cliff faces are cream stone with softened, faceted profiles. No biome may appear as a rectangular slab.

## Biomes

### `BIO_VILLAGE` - Central Village

- Purpose: orientation hub, initial spawn, rescue-readable open play, and the intersection of both primary loops.
- Approximate center / size: `(0, 12, 0)`, radius `34`.
- Terrain: three connected grass terraces from `Y 10` to `Y 15`; broad central green; shallow north-south stream cut.
- Entrances: `ENT_VILLAGE_W`, `ENT_VILLAGE_E`, `ENT_VILLAGE_N`, `ENT_VILLAGE_S`.
- Exits: west forest road, east crystal causeway, north cascade trail, south meadow descent.
- Primary landmark: `LM_VILLAGE_CRYSTAL` at `(0, 15, 1)`.
- Secondary landmarks: `LM_VILLAGE_BELL` at `(-16, 14, 8)`, `LM_VILLAGE_GATE` at `(4, 13, -24)`.
- Connections: `PATH_VILLAGE_FOREST`, `PATH_VILLAGE_CRYSTAL`, `PATH_VILLAGE_MEADOW`, `PATH_VILLAGE_NORTH`.
- Sightlines: the central crystal is visible from all four entrances; the northern frozen waterfall frames the north gate; the meadow windmill is visible down the south road.

### `BIO_CRYSTAL_VALLEY` - Crystal Valley

- Purpose: high-visibility pursuit loop, water-network reveal, optional cave shortcut.
- Approximate center / size: `(65, 20, -10)`, irregular radius `36`.
- Terrain: bowl-shaped upper valley from `Y 17` to `Y 27`, with stepped cream walls and a turquoise channel along its west edge.
- Entrances: `ENT_CRYSTAL_W` near `(35, 16, 1)`, `ENT_CRYSTAL_N` near `(52, 25, -38)`.
- Exits: village causeway, northern ridge ascent, meadow crystal descent, cave tunnel return.
- Primary landmark: `LM_CRYSTAL_SPIRE` at `(69, 33, -14)`.
- Secondary landmarks: `LM_CRYSTAL_RING` at `(82, 22, 4)`, `LM_CRYSTAL_CAVE_MOUTH` at `(89, 20, -24)`.
- Gameplay: central channel splits the floor into two lanes joined by `BR_CRYSTAL_01` and stepping-stone shallows.
- Secret: `SEC_CRYSTAL_CAVE`, an east-wall entrance with a curved exit overlooking the lower valley.
- Sightlines: the spire is visible from the village east gate, meadow east ridge, and ice approach.

### `BIO_FOREST` - Whisperwood Forest

- Purpose: enclosed route choice and cover without losing macro orientation.
- Approximate center / size: `(-60, 21, -15)`, irregular radius `38`.
- Terrain: rolling root terraces from `Y 17` to `Y 25`, open glades connected by two broad lanes.
- Entrances: `ENT_FOREST_E` near `(-31, 17, -4)`, `ENT_FOREST_N` near `(-38, 25, -43)`, `ENT_FOREST_S` near `(-43, 13, 25)`.
- Exits: village road, northern ridge loop, meadow shortcut.
- Primary landmark: `LM_FOREST_TREE` at `(-65, 34, -18)`.
- Secondary landmarks: `LM_FOREST_STONES` at `(-48, 22, -31)`, `LM_GROVE_POOL` at `(-92, 18, -13)`.
- Secret: `SEC_HIDDEN_GROVE`, reached through the western root arch; it reconnects south rather than becoming a dead end.
- Sightlines: the ancient tree crown is visible above the canopy from the village and mountain west ridge; the central crystal becomes visible again at the east exit.

### `BIO_ICE_PEAKS` - Ice Peaks

- Purpose: vertical climax, long-range orientation landmark, and high-risk ridge loop.
- Approximate center / size: `(10, 49, -85)`, irregular radius `38`.
- Terrain: rising mountain shoulders from `Y 27`, snow terraces above `Y 41`, summit at `Y 62`.
- Entrances: `ENT_ICE_SW` near `(-22, 29, -56)`, `ENT_ICE_SE` near `(43, 29, -54)`.
- Exits: forest ridge descent, crystal ridge descent, secret overlook return.
- Primary landmark: `LM_ICE_SUMMIT` at `(10, 62, -91)`.
- Secondary landmarks: `LM_FROZEN_FALL` at `(20, 46, -65)`, `LM_ICE_GATE` at `(-1, 39, -68)`.
- Water: `WF_MOUNTAIN_01` drops from the spring shelf into the crystal-valley headwater.
- Secret: `SEC_ICE_OVERLOOK` at `(-19, 49, -96)` with a safe return trail to the southwest ridge.
- Sightlines: the summit silhouette is visible from every mainland biome; the overlook shows both primary loops and the southern ocean.

### `BIO_MEADOW` - Sunpetal Meadow

- Purpose: broad group play, the southern loop junction, and a gentle route to the coast.
- Approximate center / size: `(-5, 7, 60)`, irregular radius `38`.
- Terrain: rolling grassy slopes from `Y 4` to `Y 9`, divided by the shallow village river.
- Entrances: `ENT_MEADOW_N` near `(0, 9, 30)`, `ENT_MEADOW_W` near `(-38, 10, 39)`, `ENT_MEADOW_E` near `(35, 11, 42)`.
- Exits: village road, forest shortcut, crystal descent, beach road.
- Primary landmark: `LM_MEADOW_WINDMILL` at `(-21, 17, 62)`.
- Secondary landmarks: `LM_MEADOW_FLOWER_RING` at `(14, 8, 55)`, `LM_RIVER_FORK` at `(4, 6, 76)`.
- Gameplay: two open banks connected by `BR_MEADOW_01`; flower berms break long tag sightlines without becoming collision clutter.
- Secret: `SEC_MEADOW_FOREST`, a west-bank ramp that reconnects to the forest south entrance.
- Sightlines: windmill blades are visible from the village south gate, beach arch, and forest shortcut.

### `BIO_BEACH` - Sunwash Beach

- Purpose: readable coastal chase loop and gateway to the southern islets.
- Approximate center / size: `(10, 2.5, 105)`, width `84`, depth `26`.
- Terrain: crescent sand shelf with dune humps, shallow turquoise lagoon, and cream headlands.
- Entrances: `ENT_BEACH_N` near `(4, 5, 84)`, `ENT_BEACH_E` near `(38, 4, 94)`.
- Exits: meadow river road, east headland return, stepping-stone island route.
- Primary landmark: `LM_BEACH_ARCH` at `(35, 10, 103)`.
- Secondary landmark: `LM_BEACH_BEACON` at `(-27, 7, 108)`.
- Secret: `SEC_HIDDEN_ISLAND`, concealed behind the east rock arch and connected back through the lagoon stones.
- Sightlines: the arch frames the hidden island from the beach center; the windmill remains visible to the north.

### `BIO_SMALL_ISLANDS` - Skipping-Stone Isles

- Purpose: short optional traversal loop and southern world-edge reveal.
- Approximate centers: `(-18, 3, 119)`, `(10, 4, 121)`, `(37, 3, 116)`.
- Terrain: three rounded grass-and-sand caps, each 8-14 units across, joined by broad stepping stones and one rope bridge.
- Entrance: `ENT_ISLANDS_N` from the beach lagoon.
- Exit: `ENT_BEACH_E` via the hidden-island return.
- Primary landmark: `LM_ISLAND_MOONSTONE` at `(35, 8, 117)`.

## Permanent landmarks

| Stable ID               |         Position | Navigation role                             |
| ----------------------- | ---------------: | ------------------------------------------- |
| `LM_VILLAGE_CRYSTAL`    |     `(0, 15, 1)` | World hub and four-way orientation anchor   |
| `LM_VILLAGE_BELL`       |   `(-16, 14, 8)` | West-side village marker                    |
| `LM_VILLAGE_GATE`       |   `(4, 13, -24)` | Frames the mountain waterfall               |
| `LM_FOREST_TREE`        | `(-65, 34, -18)` | West-biome canopy beacon                    |
| `LM_GROVE_POOL`         | `(-92, 18, -13)` | Hidden-grove reward marker                  |
| `LM_CRYSTAL_SPIRE`      |  `(69, 33, -14)` | East-biome beacon visible across the island |
| `LM_CRYSTAL_CAVE_MOUTH` |  `(89, 20, -24)` | Cave entrance silhouette                    |
| `LM_ICE_SUMMIT`         |  `(10, 62, -91)` | Northern global landmark                    |
| `LM_FROZEN_FALL`        |  `(20, 46, -65)` | Vertical water-network anchor               |
| `LM_MEADOW_WINDMILL`    |  `(-21, 17, 62)` | Southern mainland beacon                    |
| `LM_RIVER_FORK`         |     `(4, 6, 76)` | Route split toward beach crossings          |
| `LM_BEACH_ARCH`         |  `(35, 10, 103)` | Coast and hidden-island frame               |
| `LM_ISLAND_MOONSTONE`   |   `(35, 8, 117)` | Southern loop reward marker                 |

## Connected water network

Water always has an authored source and destination:

1. `WATER_SPRING_ICE` begins at `(15, 55, -96)` below the summit snow shelf.
2. `STREAM_ICE` travels southeast to `WF_MOUNTAIN_01`.
3. `WF_MOUNTAIN_01` falls from `(20, 45, -65)` to `(20, 23, -55)`, height `22`.
4. `STREAM_CRYSTAL` bends east through Crystal Valley, passes `LM_CRYSTAL_SPIRE`, and reaches `WF_CRYSTAL_01`.
5. `WF_CRYSTAL_01` falls from `(60, 22, -15)` to `(60, 17, -5)`, height `5`.
6. `STREAM_VILLAGE` flows west-southwest through `BR_CRYSTAL_01`, then south through the village beneath `BR_VILLAGE_NORTH`.
7. `STREAM_MEADOW` meanders through the meadow beneath `BR_MEADOW_01` and splits at `LM_RIVER_FORK`.
8. Both meadow branches enter the beach lagoon and then the ocean at `OUTFLOW_BEACH` near `(10, 1.5, 112)`.

The renderer may use simplified ribbon geometry during blockout, but these relationships and flow direction are permanent.

## Bridges and crossings

| Stable ID          |         Center | Heading / span   | Connects                                                       |
| ------------------ | -------------: | ---------------- | -------------------------------------------------------------- |
| `BR_VILLAGE_NORTH` | `(0, 14, -28)` | east-west / 11   | Village north gate to mountain trail across the cascade stream |
| `BR_CRYSTAL_01`    | `(55, 19, -5)` | north-south / 10 | Crystal west and east floor lanes                              |
| `BR_MEADOW_01`     |  `(-5, 8, 65)` | east-west / 12   | Meadow banks on the beach road                                 |
| `BR_ISLAND_01`     | `(24, 4, 118)` | east-west / 13   | Middle isle to Hidden Island                                   |

Bridge decks must be at least 4 units wide for opposing traffic. Their approaches must align to terrain height with no step greater than `0.35` units.

## Primary routes

| Stable ID              | Ordered waypoints `(x,y,z)`                                   | Purpose                              |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------ |
| `PATH_VILLAGE_CRYSTAL` | `(22,14,2) -> (35,16,1) -> (50,18,-2) -> (65,20,-10)`         | East ascent and primary-loop leg     |
| `PATH_CRYSTAL_ICE`     | `(64,21,-32) -> (49,28,-48) -> (34,36,-65) -> (16,47,-80)`    | Crystal switchback to summit         |
| `PATH_ICE_FOREST`      | `(-2,45,-77) -> (-22,31,-57) -> (-39,25,-43) -> (-54,22,-31)` | West ridge descent                   |
| `PATH_FOREST_VILLAGE`  | `(-46,21,-17) -> (-31,17,-4) -> (-20,14,2)`                   | Forest return to hub                 |
| `PATH_VILLAGE_MEADOW`  | `(2,11,24) -> (0,9,36) -> (-3,7,54) -> (-5,7,65)`             | Broad south road                     |
| `PATH_MEADOW_BEACH`    | `(2,6,75) -> (5,5,86) -> (9,3,99) -> (10,2,109)`              | River-following coast route          |
| `PATH_BEACH_ISLANDS`   | `(15,2,109) -> (10,3,119) -> (24,4,118) -> (37,3,116)`        | Stepping-stone route                 |
| `PATH_ISLAND_MEADOW`   | `(37,3,116) -> (42,4,101) -> (35,8,84) -> (23,9,69)`          | East headland return                 |
| `PATH_FOREST_SHORTCUT` | `(-62,19,10) -> (-47,14,27) -> (-34,10,43) -> (-23,8,53)`     | Forest-to-meadow optional connector  |
| `PATH_CRYSTAL_MEADOW`  | `(72,18,13) -> (57,14,28) -> (43,11,43) -> (28,9,57)`         | Crystal-to-meadow optional connector |

The two mandatory exploration loops are:

- Northern loop: Village -> Crystal Valley -> Ice Peaks -> Forest -> Village.
- Southern loop: Village -> Meadow -> Beach -> Small Islands -> Meadow -> Village.

## Secrets and entrances

| Stable ID           | Entrance / exit                 | Rule                                                    |
| ------------------- | ------------------------------- | ------------------------------------------------------- |
| `SEC_HIDDEN_GROVE`  | `(-84,20,-7)` / `(-76,18,12)`   | Root-arch loop; never a dead end                        |
| `SEC_CRYSTAL_CAVE`  | `(89,20,-24)` / `(76,23,-34)`   | Short curved tunnel bypassing the valley channel        |
| `SEC_ICE_OVERLOOK`  | `(-19,49,-96)` / `(-22,39,-73)` | Summit-side overlook with guarded return slope          |
| `SEC_HIDDEN_ISLAND` | `(35,3,111)` / `(42,4,101)`     | Revealed by passing beneath the beach arch              |
| `SEC_MEADOW_FOREST` | `(-34,10,43)` / `(-47,14,27)`   | Explicit forest shortcut, wide enough for group pursuit |

Secrets may contain small visual rewards but cannot create mechanically superior hiding pockets outside the active arena boundary.

## Navigation, safety, and sightline rules

- Primary paths are 6-10 units wide; shortcuts are at least 4 units wide.
- Sustained primary-route grades should remain below 18 degrees. Short ramps may reach 24 degrees when a level rest follows.
- Every cliff-adjacent primary route gets a 1-unit visual shoulder or a low guard element; no unavoidable fall may exceed 4 units.
- No route terminates without a landmark, reward, overlook, or return connection.
- Bridges and stepping stones are broad enough for two players and have collision footprints matching their visible decks.
- Traversable terrain must not contain holes, inverted faces, or gaps wider than `0.2` units.
- The village crystal, ice summit, forest tree, crystal spire, meadow windmill, and beach arch form a navigation chain that avoids dependence on a minimap.
- Vegetation and decoration must preserve the documented landmark sightlines and at least 70% of every primary path width.
- Runtime terrain sampling is deterministic so client presentation and server-authoritative movement share the same `X/Z` topology. Player `Y` is derived from the authored terrain surface; routes do not vertically overlap in the MVP blockout.

## Round boundary contract

The island remains physically stable across all rounds. The Deep Freeze boundary contracts independently using the following half-extents centered on the village:

| Round | Half-extent | Intended readable area                                                  |
| ----: | ----------: | ----------------------------------------------------------------------- |
|     1 |         198 | Entire expanded mainland, coast, and outer island loop                  |
|     2 |         160 | Excludes the farthest outer forest and island edges                     |
|     3 |         120 | Focuses play on the connected mainland and inner coast                  |
|     4 |          70 | Pulls play toward village, inner forest, inner valley, and north meadow |
|     5 |          54 | Final hub-centered confrontation                                        |

The boundary is a magical weather wall, not a terrain wall. Server authority continues to own its active size and movement clamping.

## Version 2 expansion plan

The current 250 x 250 authored world is preserved as the dense inner world. Version 2 expands the authored envelope toward `X -200..200`, `Z -200..200` without scaling the existing layout. New terrain is added as connected outer subregions, with the existing village remaining the orientation hub and the existing landmark coordinates remaining stable.

### Expanded coordinate diagram

```text
                 NORTH (-Z)
          FROZEN SUMMIT / SKY RIDGE
            /       |       \
        ICE CAVES   CRYSTAL FALLS   UPPER PASS
          |             |             |
       ANCIENT FOREST ---- ICE PEAKS ---- CRYSTAL GARDENS
       /     |       \          |          /       \
    HIDDEN   FOREST   RAVINE   MOUNTAIN   CRYSTAL   LOWER BASIN
    GROVE    SHRINE    TRAIL     PASS       CAVE       |
       \       \       |        |         |        |
        FOREST EDGE -- VILLAGE -- CRYSTAL VALLEY -- EAST RIDGE
            |   \          |             \
          FARMLANDS GRAND MEADOW        FLOWER HILLS
            |      |       |              |
            +------RIVERSIDE FIELD-------+
                 |
              COASTAL CLIFFS
                 |
          BEACH TOWN -- QUIET COVE -- ROCKY SHORE
            |          |              |
          TIDE POOLS -- SEA CAVE      ISLAND CHAIN
                      /        \
                   FLOWER ISLES   RUINED ISLAND
                 SOUTH (+Z) / OPEN OCEAN
```

### Outer subregions and stable landmarks

The outer regions are authored as walkable transition lobes rather than a radial ring:

- `BIO_FARMLANDS` and `BIO_FLOWER_HILLS` deepen the meadow-to-coast transition.
- `BIO_COASTAL_CLIFFS` and `BIO_BEACH_TOWN` create a stepped descent to the preserved beach.
- `BIO_ANCIENT_FOREST`, `BIO_FOREST_RAVINE`, and `BIO_FOREST_SHRINE` extend the west route.
- `BIO_CRYSTAL_GARDENS`, `BIO_LOWER_BASIN`, and `BIO_CRYSTAL_FALLS` extend the east route.
- `BIO_ICE_CAVES` and `BIO_SKY_RIDGE` create the secondary northern climb.
- `BIO_OUTER_ISLANDS` and `BIO_RUINED_ISLAND` extend the southern island loop.

New major landmark IDs are `LM_VILLAGE_CLOCKTOWER`, `LM_FOREST_SHRINE`, `LM_FOREST_RAVINE`, `LM_CRYSTAL_GARDENS`, `LM_CRYSTAL_FALLS`, `LM_CRYSTAL_CAVE`, `LM_ICE_CAVE`, `LM_SKY_RIDGE`, `LM_MEADOW_BARN`, `LM_FLOWER_HILL`, `LM_COASTAL_OVERLOOK`, `LM_BEACH_DOCK`, `LM_BEACH_COVE`, and `LM_RUINED_ISLAND`. Existing landmark IDs and positions are unchanged.

### Expanded routes, water, and crossings

New routes are `PATH_FOREST_RAVINE`, `PATH_FOREST_SHRINE`, `PATH_CRYSTAL_GARDENS`, `PATH_CRYSTAL_FALLS`, `PATH_ICE_CAVES`, `PATH_SKY_RIDGE`, `PATH_MEADOW_FARMS`, `PATH_MEADOW_HILLS`, `PATH_MEADOW_CLIFFS`, `PATH_CLIFFS_BEACH`, `PATH_BEACH_COVE`, `PATH_BEACH_TIDEPOOLS`, `PATH_ISLAND_CHAIN`, and `PATH_RUINED_ISLAND`. Together with the preserved routes they form the northern mountain loop, the meadow/coast loop, and the beach/island loop, with forest-to-ravine-to-mountain and crystal-to-basin-to-meadow shortcuts.

The water network gains `STREAM_FOREST_RAVINE`, `STREAM_CRYSTAL_FALLS`, `STREAM_COASTAL`, and `STREAM_ISLAND_TIDE`; these feed two medium waterfalls, several small drops, two ponds, and the existing river/ocean outflow. New crossings are `BR_FOREST_RAVINE`, `BR_CRYSTAL_GARDENS`, `BR_CRYSTAL_FALLS`, `BR_MEADOW_FARMS`, `BR_COASTAL_CLIFFS`, `BR_BEACH_COVE`, `BR_ISLAND_CHAIN`, and `BR_RUINED_ISLAND`.

### Verticality, secrets, and density targets

Outer terrain uses local low/mid/high bands: forest ravine `Y 11..18`, forest ridge `Y 24..34`, lower crystal basin `Y 12..18`, crystal falls `Y 24..38`, coastal cliffs `Y 8..20`, sky ridge `Y 42..58`, and ruined-island center `Y 5..14`. New secrets are `SEC_FOREST_SHRINE`, `SEC_RAVINE_LEDGE`, `SEC_CRYSTAL_CHAMBER`, `SEC_WATERFALL_PASSAGE`, `SEC_ICE_CAVE`, `SEC_SUMMIT_LEDGE`, `SEC_MEADOW_POND`, `SEC_COASTAL_CAVE`, `SEC_TIDEPOOL`, and `SEC_RUINED_ISLAND`.

The implementation target is 12-18 major landmarks and 20-30 small environmental points of interest. Detail is staged as macro land first, then routes/water, then subregion dressing and micro props. Shared geometry, deterministic placement, and grouped decoration remain preferred so the larger authored envelope stays browser-friendly.

## Blockout acceptance criteria

- An original irregular island silhouette fills the intended `-200..200` coordinate envelope without using a giant terrain plane or rectangular biome platforms.
- The preserved biomes and expanded subregions, 27 named landmarks, 12 bridges, five waterfalls, and 24 named routes are recognizable from placeholder geometry.
- The water network reads continuously from summit spring to ocean.
- Both mandatory loops can be traversed without jumps, impossible slopes, dead ends, broken bridge approaches, or accidental terrain gaps.
- The renderer and shared movement rules use the same stable layout constants.
- At least 150 valid spawn positions exist around the village and inner approach routes.
- Automated tests cover world bounds, spawn capacity, representative path waypoints, water exclusion, bridge crossings, and terrain-height continuity.
