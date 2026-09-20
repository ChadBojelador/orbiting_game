# Original World Map Layout

This document describes the restored Original World arena as implemented by the shared topology and Three.js renderer.

## Coordinate system and world limits

- `+X`: east/right
- `-X`: west/left
- `-Z`: north/top
- `+Z`: south/bottom
- Playable boundary: `X/Z = -125 to +125`
- Ocean surface: `Y = 1.5`
- Seabed: `Y = -4.5`
- Maximum summit terrain: approximately `Y = 62`
- Terrain grid spacing: `3.125 m`

```text
                              NORTH  -Z
                                 ▲
                  ┌───────────────────────────┐
                  │        ICE PEAKS          │
                  │      Summit (10,-91)      │
                  │ Mountain waterfall        │
                  │       /           \       │
                  │      /             \      │
          FOREST  │                     │  CRYSTAL VALLEY
       (-60,-15) ─┤─── VILLAGE ─────────┤── (65,-10)
       Ancient    │     (0,0)           │   Crystal spire
       Tree       │  Glowing crystal    │   + waterfall
                  │       ╲  River  ╱    │
                  │        ╲      ╱      │
                  │         MEADOW       │
                  │        (-5,60)       │
                  │        Windmill      │
                  │            │         │
                  │          BEACH       │
                  │        (10,104)      │
                  │       Beach arch     │
                  │                      │
                  │  WEST   CENTER  EAST │
                  │ ISLAND  ISLAND ISLAND│
                  │              Moonstone
                  └───────────────────────────┘
                                 ▼
                              SOUTH +Z
```

The diagram is approximate and not to scale.

## Major terrain regions

Terrain regions are elliptical. The listed radii are half-widths, and the elevation is the nominal height of the region's core.

| Region         | Center `(X,Z)` | Radii `(X,Z)` | Nominal height | Character                 |
| -------------- | -------------: | ------------: | -------------: | ------------------------- |
| Village        |       `(0, 0)` |    `(37, 38)` |           `12` | Central combat hub        |
| Forest         |   `(-60, -15)` |    `(43, 40)` |           `21` | Elevated western landmass |
| Crystal Valley |    `(65, -10)` |    `(43, 40)` |           `20` | Elevated eastern landmass |
| Ice Peaks      |    `(10, -85)` |    `(42, 42)` |           `48` | High northern plateau     |
| Meadow         |     `(-5, 60)` |    `(44, 42)` |            `7` | Lower southern approach   |
| Beach          |    `(10, 104)` |    `(46, 23)` |          `2.8` | Low coastline             |
| West Island    |   `(-18, 119)` |     `(11, 8)` |          `3.2` | Small offshore island     |
| Center Island  |    `(10, 121)` |     `(10, 7)` |            `4` | Central offshore island   |
| East Island    |    `(37, 116)` |     `(12, 9)` |          `3.4` | Moonstone island          |

Terrain remains near the nominal height inside each region's core. It smoothly descends toward approximately `Y = 1.85` near the outer coastline.

The Ice Peaks include an additional summit crown centered near `(10,-91)`, reaching approximately `Y = 62`.

## Main route network

The widths below are the authored navigable corridor widths. The visible painted path is capped at approximately `5.2 m`.

### Village to Crystal Valley

- Authored width: `10 m`
- Approximate length: `47.3 m`

```text
(20,2) → (35,1) → (50,-2) → (65,-10)
```

### Crystal Valley to Ice Peaks

- Authored width: `9 m`
- Approximate length: `68.0 m`

```text
(64,-32) → (49,-48) → (34,-65) → (16,-80)
```

### Ice Peaks to Forest

- Authored width: `9 m`
- Approximate length: `69.5 m`

```text
(-2,-77) → (-22,-57) → (-39,-43) → (-54,-31)
```

### Forest to Village

- Authored width: `10 m`
- Approximate length: `32.4 m`

```text
(-46,-17) → (-31,-4) → (-20,2)
```

### Village to Meadow

- Authored width: `11 m`
- Approximate length: `45.1 m`

```text
(4,22) → (5,36) → (2,52) → (-5,65)
```

### Meadow to Beach

- Authored width: `10 m`
- Approximate length: `35.1 m`

```text
(2,75) → (5,86) → (9,99) → (10,109)
```

### Beach to Islands

- Authored width: `5 m`
- Approximate length: `38.4 m`

```text
(15,109) → (10,119) → (24,118) → (37,116)
```

### East Island to Meadow flank

- Authored width: `7 m`
- Approximate length: `53.4 m`

```text
(37,116) → (42,101) → (35,84) → (23,69)
```

### Forest to Meadow shortcut

- Authored width: `7 m`
- Approximate length: `58.2 m`

```text
(-62,10) → (-47,27) → (-34,43) → (-23,53)
```

### Crystal Valley to Meadow shortcut

- Authored width: `7 m`
- Approximate length: `62.2 m`

```text
(72,13) → (57,28) → (43,43) → (28,57)
```

Together, these routes create a large outer loop around Village, two southern flanking routes, and an island rotation around Beach.

## River network

### Main north-south branch

- Approximate length: `183.5 m`

```text
(20,-55)
→ (10,-41)
→ (0,-28)
→ (10,-12)
→ (12,8)
→ (9,30)
→ (3,50)
→ (-5,65)
→ (4,76)
→ (8,92)
→ (10,112)
```

This branch begins below the mountain waterfall, passes the northern Village bridge, travels through the eastern side of Village, continues through Meadow, and exits near Beach.

### Crystal Valley branch

- Approximate length: `88.9 m`

```text
(66,-24)
→ (60,-15)
→ (60,-5)
→ (45,-2)
→ (28,-8)
→ (10,-18)
→ (0,-28)
```

This branch begins in Crystal Valley and joins the main river at the northern Village bridge.

### River dimensions and collision

- Visible water width: `4.6 m`
- Solid terrain-backed support width: `10.4 m`
- Supporting beds overlap the surrounding terrain grid.
- Supporting beds extend beyond both ends of each river branch.
- Water tops and riverbed tops participate in collision.
- Buried side and underside geometry is presentation-only and does not create invisible movement barriers.

## Bridges

| Bridge         | Center `(X,Z)` |       Size | Purpose                                |
| -------------- | -------------: | ---------: | -------------------------------------- |
| Village North  |      `(0,-28)` | `12 × 6 m` | Crosses the main river/branch junction |
| Crystal Bridge |      `(55,-5)` | `6 × 12 m` | Crosses the Crystal Valley branch      |
| Meadow Bridge  |      `(-5,65)` | `14 × 6 m` | Crosses the southern river             |
| Island Bridge  |     `(24,118)` | `15 × 6 m` | Connects the beach/island route        |

Each bridge has a solid wooden deck and two raised rails.

## Major landmarks

### Village crystal

- Center: `(0,1)`
- Ground elevation: approximately `Y = 12`
- Primary central navigation light
- Cyan point-light range: `16 m`
- Three shards:

| Shard | Local offset `(X,Z)` | Radius |   Height |
| ----- | -------------------: | -----: | -------: |
| Main  |              `(0,0)` |  `2.8` | `8.96 m` |
| West  |           `(-2,0.8)` |  `1.5` |  `4.8 m` |
| East  |            `(2,1.1)` |  `1.7` | `5.44 m` |

### Ancient forest tree

- Position: `(-65,-18)`
- Ground elevation: approximately `Y = 21`
- Trunk height: `15 m`
- Large multi-part crown
- Primary western landmark

### Crystal Valley spire

- Position: `(69,-14)`
- Ground elevation: approximately `Y = 20`
- Strongest crystal light source
- Cyan point-light range: `23 m`
- Four shards:

| Shard     | Local offset `(X,Z)` | Radius | Height |
| --------- | -------------------: | -----: | -----: |
| Center    |              `(0,0)` |  `3.7` | `17 m` |
| Northwest |             `(-4,2)` |  `2.2` | `10 m` |
| East      |              `(4,1)` |  `2.5` | `12 m` |
| South     |             `(1,-4)` |  `1.8` |  `8 m` |

### Ice summit

| Position `(X,Z)` | Radius | Peak geometry height |
| ---------------: | -----: | -------------------: |
|       `(10,-91)` |    `9` |               `23 m` |
|       `(-2,-88)` |    `7` |               `17 m` |
|       `(21,-96)` |    `6` |               `15 m` |

The peaks sit on the already elevated northern terrain.

### Meadow windmill

- Position: `(-21,62)`
- Ground elevation: approximately `Y = 7`
- Tower body height: `12 m`
- Integrated amber beacon centered `12.2 m` above its base with a `90 m` light range
- Roof centered approximately `14.4 m` above its base
- Four rotating presentation-only blades centered on the upper tower face
- Primary southern mid-map landmark

### Beach arch

- Position: `(35,103)`
- Ground elevation: approximately `Y = 2.8`
- Arch radius: `7 m`
- Arch thickness: `1.45 m`
- Located near the eastern beach/island approach

### Island moonstone

- Position: `(37,116)`
- Island elevation: approximately `Y = 3.4`
- Crystal height: `7 m`
- Cyan point-light range: `13 m`
- Marks the eastern offshore island

## Waterfalls

### Mountain waterfall

- Top: `(20,45,-65)`
- Bottom: `(20,23,-55)`
- Width: `7 m`
- Vertical drop: `22 m`
- Feeds the northern end of the main river

### Crystal waterfall

- Top: `(60,22,-15)`
- Bottom: `(60,17,-5)`
- Width: `5 m`
- Vertical drop: `5 m`
- Located beside the Crystal Valley river branch

## Village combat cover

| Cover           | Center `(X,Z)` | Size `(W × D × H)` |
| --------------- | -------------: | -----------------: |
| Northwest block |      `(-8,-8)` |    `4 × 4 × 1.8 m` |
| Northeast block |       `(8,-8)` |    `4 × 4 × 1.8 m` |
| Southwest block |       `(-8,8)` |    `4 × 4 × 1.8 m` |
| Southeast block |        `(8,8)` |    `4 × 4 × 1.8 m` |
| North barrier   |      `(0,-17)` |    `8 × 2 × 1.2 m` |
| South barrier   |       `(0,17)` |    `8 × 2 × 1.2 m` |

This creates a roughly symmetrical central combat space around the glowing Village crystal.

## Spawn locations

All 16 spawn candidates are concentrated around Village and its inner approaches.

```text
(-20,28)   (4,-28)   (20,12)   (-24,-4)
(24,-12)   (0,-4)    (8,32)     (-4,16)
(-12,-20)  (-20,12)  (-12,0)    (-8,32)
(8,-16)    (8,8)     (12,-4)    (24,0)
```

The server dynamically selects a candidate based on:

- Distance from enemies
- Enemy visibility
- Recent death location
- Clear standing space
- A clear inward movement route

## Decorative distribution

### Forest and western trees

```text
(-84,-24), (-76,-39), (-71,2), (-55,-38),
(-49,8), (-91,-6), (-39,-25)
```

### Crystal Valley and eastern trees

```text
(47,-17), (81,-35), (91,-4), (75,13), (51,17)
```

### Meadow flowers

```text
(-30,56), (-14,45), (13,65), (24,51), (-19,77)
```

## Ocean and underwater layout

- Ocean surface: `Y = 1.5`
- Seabed: `Y = -4.5`
- Total rendered ocean depth: `6 m`
- The rendered ocean extends beyond the playable map so the horizon remains filled.
- Coast walls extend to the seabed.
- Players float with their feet approximately `0.55 m` below the surface.
- Holding jump raises the player toward a shallow swim depth.
- Holding crouch dives the player toward a feet depth of `2.4 m`.
- Water movement uses `70%` of normal horizontal movement speed.

## Night lighting structure

Original World uses:

- A permanent deep-navy night sky
- Dark blue distance fog
- Lavender-blue moon directional lighting with restrained hemisphere fill
- Strong emissive cyan main crystals with violet secondary spire shards
- Three broad shadowless crystal point lights, one small Village light, and one broad Windmill beacon

| Light source         |   Range | Role                                          |
| -------------------- | ------: | --------------------------------------------- |
| Village crystal      |  `85 m` | Broad central cyan map light                  |
| Crystal Valley spire | `110 m` | Strongest eastern regional magical light      |
| Island moonstone     |  `75 m` | Broad southern-island and coastline map light |

Only the moon renders shadows, in a player-centered 96-metre volume: 2048 desktop, 1024 touch, disabled with reduced effects. The five local lights remain shadowless. The Village amber light reaches 9 m; the integrated Windmill beacon reaches 90 m across the southern meadow. Bridge lamps are emissive only.

## Tactical interpretation

- **Village** is the primary close- and mid-range combat hub.
- **Forest and Crystal Valley** form elevated western and eastern flanks.
- **Ice Peaks** provide the highest terrain and longest northern sightlines.
- **Meadow** is a broad, lower southern rotation space.
- **Beach and the islands** are low-elevation areas with greater water exposure.
- **Four bridges** create predictable river crossing points.
- **Forest and Crystal shortcuts** allow players to bypass Village and rotate toward Meadow.
- **The island loop** offers a southern flank around Beach.
- **Glowing crystals** act as nighttime navigation anchors at the center, east, and far south.

## Source files

- Shared topology: `packages/shared/src/simulation/original-topology.ts`
- Spawn candidates: `packages/shared/src/simulation/original-spawns.ts`
- Renderer and landmark geometry: `apps/client/src/world/original-world-map.ts`
- Generated collision data: `packages/shared/src/simulation/original-data.ts`
- High-level map specification: `MAP_SPEC.md`
