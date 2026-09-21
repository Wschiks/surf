# Surf Tycoon: the complete design document

**Purpose of this document.** It describes the finished game *Surf Tycoon* so precisely that a developer (or an AI) who only has this text can rebuild the same game: same rules, same numbers, same layout, same look and same feel. Everything that a player can see or feel is written down. Where a number is given, use that number.

The companion document `DESIGN-IDLE-TYCOON-FRAMEWORK.md` explains the same game as a reusable recipe for making other tycoons in this style (for example a ski resort). Read that one when you want a *different* theme; read this one when you want *this* game.

How to use this with an AI: give it this whole document and say "Build exactly this game as a web game. Follow the document literally. Where it gives numbers, use those numbers. Then run the acceptance checklist in section 16."

---

## 1. What the game is

* A **mobile idle tycoon** (portrait phone, also playable in a desktop browser as a 1:2 column). You run a water-sports spot: a beach and the sea in front of it.
* **Guests** (surfers, skimboarders, windsurfers, kitesurfers, foilers, sailors) come to **zones** on the map, ride, and pay coins. You spend coins on upgrades, hire managers so zones run by themselves (also while the game is closed), unlock higher levels and new sports, and finally **expand the beach**: a big wave washes over the screen, everything starts over, all income is multiplied for good and a new area of the sea opens.
* Two currencies: **coins** (spent on upgrades) and **reputation** (a star counter; it gates higher levels and sports).
* **Nothing is random.** There is no clock, calendar, weather or events. Everything the game shows and asks depends only on the saved progress.
* Tone: friendly, bright, simple. Flat shapes, strong colours, big tap targets, no clutter.
* The original inspiration is the mobile game "Idle Theme Park - Tycoon Game", moved from a park to a beach and the sea.

### Design pillars
1. **Always something to buy or to aim for.** Upgrades are tiny and frequent; unlocks come every few minutes early on and every hour later.
2. **Idle first.** A manager makes a zone earn by itself; offline earnings are paid on return (max 8 hours).
3. **A big map you can pan and zoom**, drawn as a rotated top-down world with riders you can watch.
4. **Prestige as a spectacle:** expanding the beach is a wave animation and a fresh start that is faster than before.
5. **Simple to read:** one round badge per zone, one bottom sheet per zone, no floating text over the map.

---

## 2. Technology and project structure

* **Phaser 4** (4.2.x) for the map, **TypeScript**, **Vite**, **npm**. Tests with **Vitest**. Screenshots and a browser smoke test with **Playwright**. Optional phone wrapper with **Capacitor** (iOS and Android projects, no publishing).
* The **map** is drawn in a Phaser WebGL canvas. The **user interface** (top bar, quests, bottom bar, sheets, menu, dialogs, badges and labels that follow map points) is plain **HTML/CSS on top of the canvas**, with custom inline **SVG icons**. No emoji, no image files: all art is drawn in code (2D canvas API baked into textures, plus a few Phaser Graphics).
* The canvas is rendered at the device pixel ratio (max 2). Layout works in page pixels.
* Game logic is **pure TypeScript with no Phaser imports** (`src/core`) so it can be tested and simulated. All game data lives in **config files** (`src/config`).

```
index.html                 the page: #app > #game (canvas), #ui (overlay), #splash (loading)
src/main.ts                creates the Phaser game (Scale.NONE, size = holder * min(dpr,2)), ResizeObserver
src/styles.css             all CSS (tokens, components)
src/config/
  layout.ts                map size, rotation, zoom limits, helpers
  areas.ts                 the four areas, sea colour gradient
  sports.ts                sports, levels (zones), unlock rules, texts, rects
  balance.ts               all balance numbers + stat definitions + milestones
  facilities.ts            beach buildings
  expansions.ts            beach expansions
  landmarks.ts             landmark + decoration positions
  legal.ts                 Terms of Service, Privacy Policy, credits texts
src/core/  (no Phaser)
  state.ts                 GameState, newGame, openAreas, ensureState
  economy.ts               income, costs, buying, sessions, offline
  unlocks.ts               level/sport/expansion rules, next goal, expand()
  quests.ts                quests
  save.ts                  local storage, save codes
  game.ts                  real-time clock + offline + autosave
  bot.ts                   balance bot (plays the whole game)
src/scene/
  MapScene.ts              the Phaser scene: wires everything together
  MapView.ts               camera maths + pan/pinch/wheel input
  background.ts            sea, sand, grid, landmarks, decoration, haze
  art.ts                   all drawing code (textures)
  zoneView.ts              zone plate, water tile, riders
  motion.ts                how riders move (per sport)
  beach.ts sites.ts ocean.ts   buildings, kite launch/jetty, boats
src/ui/
  ui.ts                    top bar, quests panel, bottom bar, sheets, dialogs, big wave, confetti
  menu.ts                  the menu (settings, help, legal, save codes)
  zoneChips.ts labels.ts   round badges + DOM labels that follow map points
  icons.ts format.ts sound.ts
tests/                     unit tests + full playthrough test
scripts/                   simulate.ts (balance bot), screenshots.mjs, smoke.mjs, design-tables.ts
```

---

## 3. The world and the map

### 3.1 Coordinates
* The map is **15 units wide and 8 units deep**. `UNIT = 100` world pixels per unit.
* Map coordinates: `x` = column 0..15, `depth` = distance from the back of the beach (0 = back of the beach, 8 = far edge of the ocean). **World y = depth × 100**, so in the unrotated world the beach is at the top.
* A phone screen is about **1 unit wide and 2 units high** at the start zoom.

### 3.2 Rotation
The whole map is turned by **215°** (clockwise, 35° plus a flip). Result on screen: **the beach is in the bottom left, the open sea toward the top right, waves roll toward the beach** (down-left). Tall things (lighthouse, buildings, palms, trees, umbrellas) are drawn as "billboards" that counter-rotate so they stand upright on screen; riders and flat things rotate with the map.

### 3.3 Areas
The map is 20% beach and 80% sea (the original concept): beach 1.6 of 8 deep.


The sea is coloured by depth: **light turquoise near the shore, getting darker further out** (linear blend between these stops; depth 11 and beyond is the last colour):

| depth | rgb |
|---|---|
| 1.6 | 150, 234, 232 |
| 2.8 | 88, 205, 228 |
| 4 | 46, 158, 214 |
| 5.2 | 31, 122, 194 |
| 6.4 | 22, 86, 160 |
| 8 | 11, 47, 107 |
| 11 | 6, 30, 78 |

The **Beach** and **Wave** areas are open from the start. The **Sea** area opens with beach expansion 1, the **Ocean** with expansion 2. Areas that are not open yet sit under a **haze**: a full-width veil `#e4f4ff` at alpha 0.5 with a drifting cloud texture on top (alpha 0.7, scrolling slowly: x += t×0.012, y += t×0.004 px per ms; cloud tile 512×512 texture drawn at 1.6× scale), depth above everything on the map. The haze covers the whole band of the area, also past the map edges (the Ocean haze runs to the end of the world). When the area opens the veil and clouds **fade out over 1.8 s** (or vanish instantly when loading a save).

### 3.4 The world past the map edges
Nothing empty is ever shown. World margin = 40 units on every side:
* **Behind the beach** (depth < 0): dunes and grass: `#e6d59a` sand from depth -0.95 to 0, `#b7d97a` from -1.3 to -0.95, `#8fcf6a` grass beyond. Trees and bushes stand on the grass (see decoration).
* **Left and right**: the sand and the sea simply continue.
* **Beyond the ocean edge**: the darkest sea colour continues.

### 3.5 Layers of the background (bottom to top, Phaser depth in brackets)
1. (0) Solid bands: grass/dunes; the sea drawn as thin strips of 0.08 unit from the shore (depth 1.6) to depth 11 using the gradient above, then a solid dark colour further out.
2. (0.1) Sand: repeating sand tile (200×200 world px, baked at 1.5×: base `#f3deaa`, 160 tiny speckles in `rgba(200,160,90,.22)` and `rgba(255,250,225,.35)`, 6 faint ripple curves) over depth 0 to 1.6.
3. (0.2) Wet sand: 12 stacked translucent strips `#b99a5e` alpha 0.05 over the last 0.4 unit of the beach.
4. Shallow glow: 10 stacked strips `#c8fff0` alpha 0.09 growing from the shoreline (0.06 + i×0.05 unit deep).
5. (0.5 below) Big slow swell tile (400×300, three soft white bands, alpha 0.35 as whole layer), scrolls x += t×0.004, y -= t×0.008 (px per ms).
6. (1) Sparkles: 240×240 tile with 18 short white dashes, whole layer alpha 0.3, scrolls x += t×0.01, y -= t×0.006.
7. (1.1) Shore foam: 200×40 tile of three wavy white lines, along the shoreline (y from shoreline-10), scrolls x += t×0.012.
8. (2) Grid: white lines every 1 unit at alpha 0.07 (1.5 px); area borders every area start at alpha 0.4 (2.5 px); the map border in white alpha 0.55 (5 px).
9. (5) Landmarks (see 3.6). 10. (6) Zones (plate, water tile). 11. (8) Riders, buildings, walkers. 12. (40) Haze.

### 3.6 Landmarks (drawn in code; positions in map units, x = column, y = depth)
Each important zone has a recognisable landmark.

| Landmark | Position (top-left) and size | What it looks like |
|---|---|---|
| **Cove** (under the rocks) | (0.6, 1.15), 340×320 px | Skimboarding cove: soft pale-turquoise clear water wash, and a wet sand bank (blob ~ (258,108) radius 88×56, sand `#e8ce96`→`#d6ba80`, white outline, lighter sheen blob, six faint ripple lines, a few ripple circles) |
| **Rocks** | (0, 0.35), 350×190 px | "A sandy cove with large rocks, a rock arch and cliffs": sand spit that fades into the shallows; a dark grey-brown cliff wall on the left edge with vertical strata lines; a rock arch (stone pillars with a curved top, the inside shows turquoise water); 7 rounded boulders (grey-brown gradients, light on the top left, cracks, soft shadow), white foam arcs around some rocks |
| **Reef** (wave surfing level 3) | (5.7, 2.78), displayed 450×130 px | Turquoise shallows blob, ~24 coral heads (brain corals, branching corals, fan corals) in pink `#ff6f91`, orange `#ff9f45`, purple `#b36bff`, yellow `#ffd23f`, green `#5ee27a`, red `#ff5a5a`, blue `#4dd0ff`; **a long clean wave along its outer edge**: darker face, bright foam lip (white 3.2 px line with wave sin(x/38)×3.2) and two thinner foam lines; deep blue water fading in behind it |
| **Fort** (Nazaré, level 4) | (11.2, 2.65), 400×150 px | A rocky cliff headland entering from the right map edge with strata lines, a stone fort with battlements on top (sand-stone blocks), a dark arched door, and **huge waves crashing below**: three layered white foam sheets, ~40 spray dots, a dark wave face in front |
| **Lighthouse** | base at (14.58, 3.09), upright, 44×110 px (origin 0.5, 0.87) | The **red lighthouse**: red tapered tower with two white bands, a yellow lantern room, black rim, a red cone roof, a soft yellow glow |

### 3.7 Beach decoration (fixed positions, nothing random)
* **Palms** (upright, 80×130 base texture, displayed width 52+6×(i mod 3), height 84+8×(i mod 3)) at x = 0.35, 2.3, 4.6, 7.6, 9.9, 12.3, 14.5, -1.4, 16.4 and y = 0.12 + 0.04×(i mod 2).
* **Beach umbrellas** (upright 44×51) with **towels** (flat 46×26, at x-0.28, y+0.04): (11.2, 1.2, red `#ff5a45`), (12.1, 1.35, blue `#2f8fd6`), (13.4, 1.15, yellow `#ffcf3f`), (2.3, 1.35, blue). Towels have coloured stripes (pink/white, blue/yellow, green/white).
* **Starfish** (flat 14×14, `#ff8a65`) at (3.1,1.05), (9.9,1.2), (13.0,1.0), (0.9,1.1).
* **Trees and bushes** on the grass: for i = 0..51: x = -5 + i×0.46 + ((i×7) mod 5)×0.06, row = i mod 3, y = -1.55 - row×0.55 - ((i×13) mod 4)×0.12; every 4th (i mod 4 = 0) is a bush (40×32), otherwise a round tree (54+8×(i mod 3) wide, 70+8×(i mod 3) high, at y-0.1). Trees: brown trunk, four overlapping green circles `#3f9a3a #4aa83e #5cbb47 #3a8f38` plus a light highlight.
* **Beach walkers** (top-down people strolling along the water line): count = min(12, 3 + floor(log10(reputation+1) × 2)). Walker i walks back and forth between x = 0.4 and x = 14.6 at y = 1.38 + 0.05×(i mod 3) units (+ tiny bob sin(t/300+i)×1.2 px). Phase t = (time_s × (0.006 + 0.0018×(i mod 4))) + i×0.37; ping-pong = phase in [0,1] goes right, in [1,2] goes left; the figure is rotated to face its direction (±90°). Colours: `#ff6b3d #3fc3ff #ffd23f #ff5fa2 #4be07a #b56bff #ff9f43 #2ec4b6 #f15bb5 #9bc53d #00bbf9 #fee440`.

### 3.8 Beach facilities and sites
* **Facility plots**: an empty circular plot (radius 36 px, sand-brown `#b98543`, 12 dashes, fill alpha 0.16) at each facility position (see the facilities table) until it is bought; tapping a plot opens the Beach sheet. When bought, the **building appears with a pop-in** (scale 0.15 → 1 over 500 ms, Back.easeOut) as an upright billboard 99×90 px: **rental shop** (wooden box, red/white awning, "RENT" sign, colourful boards leaning on the wall), **beach café** (cream building with a blue/white awning, cup sign, orange parasol with a table), **showers** (three wooden cabins with shower heads and drops), **lifeguard tower** (red/white cabin on stilts with a ladder, white roof, yellow flag). Buildings have a soft ground shadow.
* **Kite launch area** (beach site of kitesurfing): rect (5.5, 0.9, 4×0.6). Until kitesurfing is unlocked it is an empty dashed plot (`#b98543`, 3 px dashes of 14) with a small locked badge (only visible when zoomed in: ppu ≥ 130). When unlocked it appears (900 ms fade): a smoothed sand field with fine lines, a red dashed rope boundary with orange/white cones at the corners, **seven coloured kites laid out flat** (crescents with lines) and an upright **windsock** (orange/white striped) at its right end.
* **Jetty** (beach site of sailing): rect (4.9, 0.9, 0.55×2.2). Empty plot until sailing is unlocked; then a wooden pier with planks, posts, a T-platform at the end and rope between posts (900 ms fade). **Moored dinghies**: one white/red sailing dinghy per sailing level owned, upright at x = 4.75, y = 1.05 + 0.5×i, bobbing (sin(t/700 + i×1.7)×1.6 px).
* **Ocean boats** (decoration, no mechanics): when sailing level 3 is owned, four **race-course buoys** (orange with a white band and yellow top) in the Club-racing zone at fractions (0.12,0.2), (0.5,0.86), (0.88,0.2), (0.5,0.2); when level 4 is owned an **ocean racer yacht** (navy hull with a yellow stripe, white main sail and a red jib) at fraction (0.5, 0.62) of the Offshore-regatta zone, bobbing.

---

## 4. Camera, zoom and input

State: view centre `(cx, cy)` in world px, `ppu` = screen pixels per map unit, screen size `(W, H)` in page pixels. `zoom = ppu / 100`. Rotation `ROT = 215°`.

* `screen = (W/2, H/2) + R(ROT) · ((world - c) · zoom)` with `R` the clockwise rotation matrix (y down). Screen-to-world is the inverse. (In Phaser: `camera.setRotation(ROT)`, `camera.setZoom(zoom × dpr)`, `camera.centerOn(cx, cy)`.)
* **Start zoom**: 1.1 units across the screen width (`ppu = W / 1.1`). **Closest zoom**: 0.7 units across (`ppu = W / 0.7`). **Furthest zoom**: the whole rotated map fits: `ppu = min(W / (15·|cos| + 8·|sin| + 0.4), H / (15·|sin| + 8·|cos| + 0.4))`.
* **Start position**: centre (7.9, 2.2) units, at the start zoom. After an expansion the view returns there.
* **Pan**: one finger / mouse drag (starts after 6 px). A tap = movement ≤ 8 px and < 500 ms. **Pinch**: two fingers (zoom around the midpoint and pan with it). **Wheel**: `ppu *= exp(-deltaY × 0.0015)` around the pointer. **Fling**: if a drag of more than 12 px ends within 80 ms of its last move, the view keeps gliding with the last smoothed speed (speed below 60 px/s is ignored), friction `exp(-dt × 3.5)`, stop under 25 px/s.
* **Clamp** ("keep the view inside the map"): compute the half size of the rotated screen rectangle in world axes: `hx = (W/2·|cos| + H/2·|sin|)/zoom`, `hy = (W/2·|sin| + H/2·|cos|)/zoom`. The centre is kept in `[hx·0.5, 15·100 - hx·0.5] × [hy·0.5, 8·100 - hy·0.5]` (OVERHANG 0.5: the view may hang over an edge by a quarter of its size). If the view is bigger than the map in an axis, the map is centred on that axis.
* **Animated moves** (`animateTo(cx, cy, ppu, lift)`): exponential smoothing `k = 1 - exp(-dt × 8)` for centre and `ppu *= (target/ppu)^k`; a `lift` in screen px moves the target up on screen (the world offset is `R⁻¹(0, lift)/zoom`) so a zone can sit above the bottom sheet. Done when within 0.5 px and 0.2% zoom. The target is clamped too.
* **Selecting a zone** animates to its centre with `units across = clamp(zoneWidth×0.6 + 0.5, 1.5, 3.2)` and lift = 20% of the screen height. The Beach sheet animates to (7.5, 0.8) at 3.6 units across with the same lift.

---

## 5. Sports, levels and zones

There are **6 sports with 4 levels each = 24 zones**. Every level is one **zone**: a rectangle on the map (`rect` = x, depth, width, height in map units), with its own guests, water conditions and economy tier. The levels of a sport form a 2×2 block: Level 1 and 2 nearest the beach, Level 3 and 4 further out (in the Ocean the four sailing zones run in one row, Level 1 on the right, Level 4 on the left). In the concept: the further from the beach, the more advanced the surfers ("Level 4 is pros only").

#### Sports
| id | name | icon | area | guest kind | noun | guest colours | beach site | unlock rule |
|---|---|---|---|---|---|---|---|---|
| wave | Wave surfing | wave | wave | surfer | surfers | #ff6b3d #ffd23f #ff5fa2 #4be07a #3fc3ff | - | open from the start |
| skimboarding | Skimboarding | skim | wave | skimmer | skimboarders | #ffb74d #4dd0e1 #f06292 #aed581 #ba68c8 | - | Level 2 of wave, reputation 12, 5,800 coins |
| windsurfing | Windsurfing | wind | sea | windsurfer | windsurfers | #26c6da #ffd54f #ff8a65 #9ccc65 #ba68c8 | - | Level 2 of skimboarding, reputation 51, 2,600,000 coins |
| kitesurfing | Kitesurfing | kite | sea | kiter | kitesurfers | #ff7043 #ffca28 #29b6f6 #ec407a #66bb6a | kite-launch (5.5,0.9,4x0.6) | Level 2 of windsurfing, reputation 74, 9,500,000 coins |
| foil | Foil and wing | foil | sea | foiler | foilers | #7e57c2 #26c6da #ffa726 #ec407a #9ccc65 | - | Level 2 of kitesurfing, reputation 110, 35,000,000 coins |
| sailing | Sailing | sail | ocean | sailor | sailors | #ff7043 #ffd54f #4fc3f7 #f06292 #aed581 | jetty (4.9,0.9,0.55x2.2) | Level 2 of foil, reputation 580, 10,000,000,000 coins |

#### Upgrade and manager names per sport
| sport | capacity | level up | speed | manager | manager text |
|---|---|---|---|---|---|
| wave | Bigger class | Level up | Faster turnover | Head instructor | Runs this zone by themselves, even while you are away. |
| skimboarding | More boards | Level up | Quicker runs | Cove host | Looks after the cove by themselves, even while you are away. |
| windsurfing | More sails | Level up | Faster changeovers | Windsurf coach | Runs the rigging area by themselves, even while you are away. |
| kitesurfing | More kite spots | Level up | Quicker launches | Kite instructor | Runs the launch area by themselves, even while you are away. |
| foil | More foil boards | Level up | Quick swaps | Foil coach | Runs the foil school by themselves, even while you are away. |
| sailing | More boats | Level up | Faster turnarounds | Harbour master | Runs the harbour by themselves, even while you are away. |

#### All 24 zones (levels)
| zone | name | who | conditions | includes | rect x,y,w,h | tier | base guests | base sec | water look | unlock: coins / reputation / prev-level upgrades | base income/session | base coins/sec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wave-1 | Beginner class | Kids in a class, wearing bright vests | Small, long, rolling waves | Bright vests; A first instructor; A board rack | 5.6, 1.7, 4.6, 1.1 | 0 | 3 | 6 | rolling | free | 3 | 0.5 |
| wave-2 | Longboarders | Longboard surfers | Small, long, rolling waves | Longboard rental; A beach café | 10.3, 1.7, 4.6, 1.1 | 1.6 | 4 | 8 | rolling | 290 / 0 / 12 | 52.53 | 6.57 |
| wave-3 | Reef | Good surfers | High waves | A lifeguard tower; Reef access | 5.6, 2.85, 4.6, 1.15 | 3.2 | 3 | 10 | reef | 220,000 / 31 / - | 517.4 | 51.74 |
| wave-4 | Nazaré | Pros only | Big waves | A rescue jet ski; A safety crew | 10.3, 2.85, 3.1, 1.15 | 4.8 | 2 | 12 | big | 15,000,000 / 260 / - | 4,530 | 377.49 |
| skimboarding-1 | Shallows | Kids and first-timers | Ankle-deep water at the water's edge, no waves | Rental skimboards; A shallow-water flag | 0.1, 1.7, 2.2, 1.1 | 0.4 | 4 | 7 | shallows | free | 7.61 | 1.09 |
| skimboarding-2 | Flatland | Flatland riders | Wide, flat, wet sand with a thin layer of water | Flatland boards; A wet-sand track | 2.35, 1.7, 2.2, 1.1 | 1.4 | 4 | 8 | flat | 1,600 / 0 / 12 | 38.07 | 4.76 |
| skimboarding-3 | Shore break | Wave riders | Small, steep waves breaking close to the sand | Wave boards; A shore-break spotter | 0.1, 2.85, 2.2, 1.15 | 2.6 | 3 | 9 | shorebreak | 60,000 / 21 / - | 196.99 | 21.89 |
| skimboarding-4 | Big shore break | Pros only | Big, fast waves breaking right on the sand | Pro boards; A rescue crew on the sand | 2.35, 2.85, 2.2, 1.15 | 4 | 2 | 11 | bigbreak | 2,700,000 / 160 / - | 1,250 | 113.64 |
| windsurfing-1 | Beginner class | Kids and adults in a class, on wide, stable boards | Shallow, flat water and light, steady wind | Wide, stable boards; Small sails; A rigging area | 0.05, 4.05, 2.4, 1.1 | 4.4 | 4 | 7 | flat | free | 4,759 | 679.88 |
| windsurfing-2 | Freeride | Windsurfers cruising back and forth | Steady wind and flat to slightly choppy water | Freeride sails; A bigger rigging park | 2.55, 4.05, 2.4, 1.1 | 5.4 | 4 | 8 | ripple | 9,400,000 / 0 / 12 | 23,796 | 2,974 |
| windsurfing-3 | Speed and freestyle | Fast riders and trick riders | Strong wind and choppy water | Speed boards; Freestyle sails | 0.05, 5.2, 2.4, 1.1 | 6.6 | 3 | 9 | chop | 360,000,000 / 280 / - | 123,118 | 13,680 |
| windsurfing-4 | Wave zone | Pros only | Strong wind and big waves | Wave sails; A rescue boat | 2.55, 5.2, 2.4, 1.1 | 7.8 | 2 | 11 | big | 10,000,000,000 / 1800 / - | 566,234 | 51,476 |
| kitesurfing-1 | Kite school | Beginners in a class, starting with a small trainer kite | Shallow, flat water and steady wind | Trainer kites; Safety helmets; A wide launch area | 5.05, 4.05, 2.4, 1.1 | 5 | 4 | 8 | flat | free | 12,500 | 1,563 |
| kitesurfing-2 | Freeride | Riders on twin-tip boards | Steady wind and flat to slightly choppy water | Twin-tip boards; Bigger kites | 7.55, 4.05, 2.4, 1.1 | 6 | 4 | 8 | ripple | 35,000,000 / 0 / 12 | 62,500 | 7,813 |
| kitesurfing-3 | Freestyle and big air | Riders who do tricks and big jumps | Strong wind and choppy water, with lots of open space | Big air kites; A jump judge | 5.05, 5.2, 2.4, 1.1 | 7.2 | 3 | 10 | chop | 1,300,000,000 / 410 / - | 323,374 | 32,337 |
| kitesurfing-4 | Big air and waves | Pros only | Very strong wind and big waves | Pro kites; A rescue jet ski | 7.55, 5.2, 2.4, 1.1 | 8.4 | 2 | 12 | big | 39,000,000,000 / 2600 / - | 1,487,230 | 123,936 |
| foil-1 | Foil school | Beginners in a class, on big, stable foil boards | Flat, calm water | Big foil boards; Helmets and pads | 10.05, 4.05, 2.4, 1.1 | 5.6 | 4 | 9 | flat | free | 32,832 | 3,648 |
| foil-2 | Wing freeride | Riders with a hand-held wing | Light wind and flat water | Hand-held wings; Smaller foils | 12.55, 4.05, 2.4, 1.1 | 6.6 | 4 | 9 | flat | 130,000,000 / 0 / 12 | 164,158 | 18,240 |
| foil-3 | Downwind | Experienced riders who ride small ocean swells | Open water with long, rolling swell | Downwind foils; A chase boat | 10.05, 5.2, 2.4, 1.1 | 7.8 | 3 | 11 | swell | 4,900,000,000 / 600 / - | 849,351 | 77,214 |
| foil-4 | Pro arena | Pros only | Big waves and strong wind | Pro foils; A rescue crew | 12.55, 5.2, 2.4, 1.1 | 9 | 2 | 13 | big | 140,000,000,000 / 3900 / - | 3,906,250 | 300,481 |
| sailing-1 | Sailing school | Kids in a class, in small dinghies | Sheltered, flat water and light wind | Small dinghies; Life jackets; A sheltered mooring | 11.3, 6.5, 3.5, 1.4 | 8.2 | 4 | 8 | flat | free | 2,155,828 | 269,478 |
| sailing-2 | Boat hire | Weekend sailors in dinghies and catamarans | Open water near the shore and steady wind | Dinghies and catamarans; A boat hire desk | 7.6, 6.5, 3.5, 1.4 | 9.4 | 4 | 10 | ripple | 57,000,000,000 / 0 / 12 | 14,872,296 | 1,487,230 |
| sailing-3 | Club racing | Racing sailors on faster boats | Open water, strong wind and a marked race course | Racing boats; Race course buoys | 3.9, 6.5, 3.5, 1.4 | 10.6 | 3 | 12 | chop | 2,200,000,000,000 / 3600 / - | 76,949,057 | 6,412,421 |
| sailing-4 | Offshore regatta | Pro crews, like the Volvo Ocean Race | Open sea, strong wind and big swell | An ocean racer; A support boat | 0.2, 6.5, 3.5, 1.4 | 11.8 | 2 | 14 | swell | 63,000,000,000,000 / 23000 / - | 353,896,320 | 25,278,309 |

Notes on the table:
* `rect` is `x, depth, width, height`. Zones do not overlap; every zone lies inside the area of its sport.
* `tier` sets economy (section 8). "base income/session" = base guests × 5^tier. "base coins/sec" = that ÷ base seconds.
* **Unlock coins** are `unlockCoins(tier, factor)` = round to 2 significant digits of `factor × 3 × 8.8^tier` (the 3 is `unlockMult`); factors: Level 2 = 3, Level 3 = 70, Level 4 = 150, and for a sport unlock 60 with the tier of its Level 1. **Reputation for Level 3** = round2sig(4 × 1.9^tier), **Level 4** = round2sig(12 × 1.9^tier). Level 2 needs **12 upgrade levels bought** on Level 1 (any mix of the three upgrades; the count is `level up + bigger class + faster`) plus coins, and no reputation. (round2sig rounds to two significant digits when ≥ 100, to whole numbers below.)
* Sport unlock rule (all sports except surfing): **own Level 2 of the previous sport in the chain, have the reputation, pay the coins**. The chain is wave surfing → skimboarding → windsurfing → kitesurfing → foil and wing → sailing. Only sports in **open areas** can be unlocked (Sea sports need expansion 1, sailing needs expansion 2). Unlocking gives Level 1 free.
* **Wave surfing Level 1 is the only zone owned at a new game and after every expansion.** Nothing else is given for free.

### 5.1 Water looks (per level)
Each zone has a `look` that decides its **colour wash** and its **rolling wave pattern**. All levels of a sport use the same riders; the water around them is what changes.

| look | wash colour | wash alpha | wave scroll speed (px/s toward the beach, ×1.5 applied) | wave alpha (×0.6 applied) | tile scale | pattern (200×120 tile, drawn in white) |
|---|---|---|---|---|---|---|
| flat | `#7fe8d8` | 0.28 | 2 | 0.5 | 1 | ~10 tiny short dashes |
| ripple | `#4db8e0` | 0.20 | 6 | 0.65 | 1 | ~26 short curved dashes |
| shallows | `#d8fff2` | 0.40 | 4 | 0.7 | 1 | ~26 small open circles + two faint lines |
| rolling | `#2aa5c9` | 0.20 | 9 | 0.85 | 1 | long sine lines (2 thick + 1 thin), soft double line |
| reef | `#22d3c5` | 0.32 | 11 | 0.85 | 1 | thick clean line + wide soft line + thin line |
| big | `#0a3a80` | 0.40 | 16 | 0.95 | 1.5 | very thick lines with foam dots |
| shorebreak | `#9be3ff` | 0.25 | 12 | 0.9 | 1 | curls: short arcs with white fill, two rows |
| bigbreak | `#0a4a90` | 0.36 | 20 | 0.95 | 1.5 | same curls, bigger |
| chop | `#1a6fb0` | 0.30 | 10 | 0.8 | 1 | ~70 short choppy dashes |
| swell | `#123f8c` | 0.34 | 7 | 0.7 | 1.8 | broad soft horizontal bands |

The wave tile is a repeating TileSprite the size of the zone, scrolling with `tilePositionY = time_s × speed × 1.5` (so waves roll toward the beach). The tile scale is `(1/1.5) × tile scale`.

### 5.2 Zone plate on the map
* Water colour wash (above) as a rounded rectangle (radius 12, inset 4 px from the zone rect), then the sport colour at alpha 0.07, then a **white outline alpha 0.3, 2 px**. **Selected** zone: white fill alpha 0.16 and a white outline alpha 0.95, 4 px.
* **Locked** zones (not owned) get a dark shade `#062033` at alpha 0.38 (rounded rect, inset 3 px).

### 5.3 The round badge (one per zone, DOM element that follows the zone centre)
A **38 px circle** (26 px when zoomed out: ppu < 120), background = the sport colour, 3 px dark ring `#0a2439`, white icon (20 px), a small **level number** chip at the top right (yellow `#ffc233` with dark text, 19 px, dark ring), soft bottom shadow. States:
* **Locked**: grey `#7d92a3` with a lock icon.
* **Waiting (no manager, not running), idle**: coral `#ff6a3d` with a play icon, gently bobbing.
* **Waiting, ready** (a finished session waits): yellow `#ffc233` with a coins icon, dark icon, bobbing, and a small dark pill under it with the waiting amount.
* **Running / managed**: the sport icon with a **progress ring** around it (8 px outside, 4 px thick, white; yellow when managed); the ring fills in steps of 5% over the session.
* **Selected**: scaled 1.25 with a yellow outline ring.
Tapping a waiting badge **collects and starts the next session** at once (plays the coin sound, shows a floating "+amount"). Tapping any other badge opens the zone sheet. Badges of the beach sites (kite launch, jetty) show a small grey badge with the sport icon while locked.
**Area names** ("BEACH", "WAVE", "SEA", "OCEAN") are small white uppercase letter-spaced labels at the middle of each area (x = 7.5), only visible when zoomed far out (ppu ≤ 70).

---

## 6. Riders: how they look and move

### 6.1 Look
Riders are **flat top-down pictures** (seen from above, like the map), nose pointing up in the picture, baked at 4× resolution. Each has a soft shadow and a white board or hull with a coloured centre stripe, and a rider seen from above: shoulders (ellipse in the guest colour), two skin-coloured arms, a head (skin tone) with hair on top. Skin tones `#f2c9a0 #d9a06f #a86b43 #7a4a2c` (by guest index mod 4), hair `#3b2a1a #e2b04a #1c1c1c #8a3b1a #c9c9c9` ((index×3) mod 5). Guest `i` of a zone uses colour `guestColors[i mod 5]` of its sport.

| kind | picture size (w×h world px) and rider position (fractions) | description |
|---|---|---|
| surfer | 14×34, (0.5, 0.55) | long white surfboard (ellipse 5.6×15.5) with a stripe in the guest colour, rider shirt in the guest colour |
| skimmer | 18×22, (0.5, 0.5) | round wooden skim board (`#f3cf94`, ellipse 7.5×9.2) with a stripe |
| windsurfer | 36×40, (0.45, 0.52) | board (4.6×15) plus a **curved sail** in the guest colour, dark wetsuit |
| kiter | 30×80, (0.5, 0.78) | small board, a thin dark **line** up to a **crescent kite** in the guest colour, dark wetsuit |
| foiler | 34×40, (0.5, 0.6) | board (4×11) and a **wide thin wing** ahead of it in the guest colour with a white line |
| sailor | 28×44, (0.5, 0.5) | white pointed hull, a coloured sail wedge, a tiny sailor |
| walker | 14×14, (0.5, 0.5) | only the person (beach strollers) |

### 6.2 What is shown
* At most **10 riders per zone** are drawn (`maxVisibleGuests`), also if the zone has more guests. The number is `min(guests, 10)`.
* A **wake** (white triangle fading out, 11×26 px, alpha 0.6, origin at the rider, rotated with the rider) trails riders that are on the water.
* Zones far from the screen are not animated.
* Only owned zones show riders.

### 6.3 Waiting state
A zone **without a manager** that is not running (idle or ready) shows its riders **standing in a row at the beach side of the zone**: rider `i` of `n` at x = zone.x + zone.w × (0.1 + 0.8 × (i+0.5)/n), y = zone.y + zone.h × 0.2 + sin(time/500 + i)×1.2, rotation 0.

### 6.4 Movement while running
Every sport has its **own way of moving**. For a running zone the phase is `p = elapsed/duration` (managed zones use the continuous clock `frac(elapsed/duration)`), rider `i` of `n` has phase `t = frac(p + i/n)` and lane `slot = frac(0.618 × (i+1))`. The position is a fraction of the zone rectangle (x across, y down = toward the sea). Heading = direction from `pose(t)` to `pose(t + 0.006)`, `rotation = atan2(dx, -dy)` plus `tilt`. A rider in the air (`lift`) is drawn `lift × 7` px higher and scaled by `1 + lift × 0.6`. All formulas (`TAU = 2π`, `frac(v) = v - floor(v)`):

* **surfer**: `x0 = 0.14 + 0.72×lane`. If `u=frac(t) < 0.3`: paddling out: `x = x0 - 0.16×(1-k)`, `y = 0.9 + 0.03×sin(18k)`, `k = u/0.3`, no wake. Else riding in: `r = (u-0.3)/0.7`; `x = x0 + 0.1×sin(2.6πr)`, `y = 0.9 - 0.78r`, `lift = 0.5×e^(-14r)` (a hop when standing up), wake on.
* **skimmer**: `x0 = 0.2 + 0.6×lane`. `u < 0.22`: run down the wet sand: `x = x0`, `y = 0.05 + 0.25k` (`k=u/0.22`), `lift = 0.15 sin²(6πk)`. Else slide: `r = (u-0.22)/0.78`, `x = x0 + 0.22 sin(2πr)`, `y = 0.3 + 0.5 sin(πr)`, wake on.
* **windsurfer** (tacking zigzag): `w = 2t + lane`, `a = |2frac(w) - 1|`, `x = 0.08 + 0.84(1-a)`, `y = 0.2 + 0.55 frac(3.7 lane) + 0.16(1 - |2frac(w/2) - 1|)`, `tilt = ±0.12` (+ while `frac(w) < 0.5`), wake on.
* **kiter** (fast runs, big jumps): `w = 2t + lane`, `jump = max(0, sin(2π(3t + lane)))²`, `x = 0.5 + 0.42 sin(2πw)`, `y = 0.25 + 0.5 frac(2.3 lane) + 0.1 sin(4πw)`, `lift = jump`, `tilt = 0.9 jump sin(12πt)`, wake only when `jump < 0.15`.
* **foiler** (long smooth figure eights): `w = t + lane`, `x = 0.5 + 0.4 sin(2πw)`, `y = 0.28 + 0.44 frac(1.9 lane) + 0.22 sin(4πw)`, `lift = 0.22 + 0.1 sin(8πt)`, no wake.
* **sailor** (race around a course): `w = t + 0.5 lane`, `x = 0.5 + 0.38 cos(2πw)`, `y = 0.5 + 0.32 sin(2πw)`, `tilt = 0.1 sin(4πw)`, wake on.
* **Presence** (fade in/out so guests "arrive" and "leave"): surfer `smooth(min(1, 8u, 8(1-u)))`, skimmer with 14 instead of 8, others 1. `smooth(a) = a²(3-2a)`.

---

## 7. Game rules

### 7.1 State (what is saved)
```
GameState {
  version: 3, coins, reputation, totalCoins,
  sports: {sportId: bool},               // unlocked sports
  zones: {zoneId: {owned, capacity, price, speed, manager, phase: 'idle'|'running'|'ready',
                   elapsed, pending, pendingRep, sessions, served}},
  facilities: {facilityId: level},
  expansions: number (0..2),
  quests: Quest[], questsDone: number,
  savedAt (ms), startedAt (ms)
}
```
`capacity`, `price`, `speed` are the number of levels bought in the three upgrades (`price` = "Level up"). A new game: everything 0/false, **`wave-1` owned (phase idle), `sports.wave = true`**.

### 7.2 A session (per zone)
* **Guests** `= baseGuests + capacityLevels`. **Price per guest** `= 5^tier × (1 + 0.05 × levelUpLevels) × milestone(levelUpLevels) × coinMultiplier`. **Duration** `= baseSeconds / ((1 + 0.06 × speedLevels) × speedMultiplier)`. **Income per session** = guests × price per guest. **Reputation per session** = guests × 0.04 × 1.9^tier × reputationMultiplier. Coins per second = income / duration.
* `coinMultiplier` = `3^expansions` × Π over facilities of coin type `(1 + perLevel × level)`; `speedMultiplier` and `reputationMultiplier` likewise from the facilities of those types.
* **Without a manager**: tap a zone (badge or the "Start a session" button) → phase `running`, elapsed 0. When elapsed ≥ duration the zone becomes **`ready`** with `pending = income` and `pendingRep = rep` (counts one session and `guests` served) and **waits**. Tapping it again pays out the pending coins and reputation and immediately starts the next session.
* **With a manager**: the zone runs continuously; when the elapsed time passes the duration, `n = floor(elapsed / duration)` sessions are paid at once (coins, reputation, sessions += n, served += n × guests) and `elapsed -= n × duration`. Buying a manager on a `ready` zone collects it and starts running.
* **Offline earnings**: on load, and when the tab was asleep for more than 3 s, the gap in seconds (max **8 hours = 28,800 s**) is applied with the same tick function. So managed zones earn; unmanaged zones finish at most one session and wait. A "Welcome back!" dialog shows the time away, the coins (and reputation ≥ 1) earned, the cap note ("Offline earnings stop after 8h 0m.") when capped, and how many zones are waiting ("N zones are waiting for you. Hire a manager to keep them running while you are away.").
* The game runs on real time: `dt = now - last`; a gap > 3 s counts as time away. Autosave every 5 s of play, on hide/leave, and after purchases.

### 7.3 The three upgrades (per zone) and the manager
Cost of the next level, at current level `n` of a stat: `cost = ceil( baseCost × 8.8^tier × growth^n × 100 ) / 100`, `Infinity` at the maximum.

| upgrade (label) | icon | baseCost | growth | max level | effect of one level |
|---|---|---|---|---|---|
| **Level up** (row 1) | tag | 6 | 1.03 | **1000** | price per guest +5% of the base, and milestone bonuses |
| **Bigger class / more space** (row 2, name per sport) | people | 25 | 1.17 | 100 | +1 guest |
| **Faster** (row 3, name per sport) | bolt | 80 | 1.22 | 40 | duration ÷ (1 + 0.06 × level) |

**Milestone bonuses of Level up** (they stack, multiply the price per guest): level 25 ×1.1, 50 ×1.2, 75 ×1.5, 100 ×1.75, 200 ×2, 300 ×2, and after that **every 100 levels ×2** (400, 500, 600 ...). Total bonus `milestone(n) = Π{bonus for each milestone ≤ n} × (n ≥ 400 ? 2^(floor(n/100) - 3) : 1)`. The sheet shows "Bonus ×(current) · next ×(m) at level (L)".

**Manager**: cost `ceil(60 × 8.8^tier)`, one per zone, permanent (until an expansion).

**Buying**: a tap buys according to the **buy amount** chosen above the rows: ×1, ×10, ×100 or Max. ×10 and ×100 are **all or nothing** (exactly that many levels if the coins are there, else nothing); **Max** buys as many as the coins allow. The button always shows the price of the chosen amount (with "+N" when N > 1), also when it cannot be paid yet (then it is greyed out). **Holding** a level up / bigger class / faster button (or a beach building button) keeps buying: first after 300 ms, then the delay shrinks ×0.8 per repeat to a minimum of 25 ms, and after each 600 ms of holding one extra purchase per tick (so about 100 levels in 2 seconds). The game is saved when the button is released. The buy sound is throttled to once per 90 ms.

### 7.4 Beach facilities (shared, boost every sport)
| id | name | icon | effect | per level | max | base cost | growth | at (x,y) | blurb |
|---|---|---|---|---|---|---|---|---|---|
| shop | Rental shop | shop | coins | 0.1 | 8 | 5000 | 5.2 | 1.2, 0.3 | Board and wetsuit rental. Every guest pays more. |
| cafe | Beach café | cafe | coins | 0.1 | 8 | 12000 | 5.4 | 3.2, 0.3 | Guests stay for a drink and spend more. |
| showers | Showers | shower | speed | 0.06 | 8 | 25000 | 5.3 | 10.4, 0.3 | Quicker changeovers, so sessions finish faster. |
| lifeguard | Lifeguard tower | lifeguard | reputation | 0.15 | 8 | 18000 | 5.4 | 12.8, 0.3 | Safe beaches make happy guests: more reputation. |
Cost of level `n` (0-based): `ceil(baseCost × growth^n)`. The bonuses of the same type multiply (`(1+0.1×shop)(1+0.1×café)`). Buildings appear on the beach when level ≥ 1. They are **dear on purpose**.

### 7.5 Reputation
Earned from every finished session (formula above). Shown as a star counter (rounded down). It is **kept** through expansions. It gates Level 3 and 4 of every sport and the sports.

### 7.6 Beach expansion (prestige)
| n | name | opens | level | reputation | coins | blurb |
|---|---|---|---|---|---|---|
| 1 | Beach expansion | sea | 4 | 400 | 320,000,000 | Opens the Sea: windsurfing, kitesurfing and foil and wing. |
| 2 | Grand beach expansion | ocean | 4 | 8000 | 1,300,000,000,000 | Opens the Ocean: sailing and boats. |
* Requirements to buy expansion `n`: **own Level `level` (4) of every sport that is in an open area** (this includes sports that still have to be unlocked, so all of them must be unlocked and levelled), **reputation ≥ the number**, and **coins ≥ the price** (`unlockCoins(tier, 150)` with tier 6.2 for expansion 1 and 10.0 for expansion 2; that is 320,000,000 and 1,300,000,000,000).
* Buying it triggers the **big wave** (section 9.9). At the middle of the animation the game state is reset: `expansions += 1`, **coins = 0, all zones back to a fresh zone (not owned, all upgrade levels 0, no manager), all facilities 0, all sports locked, quests cleared**; then the area rules apply again: **only wave surfing Level 1 is owned** (like a new game). **Reputation and total coins stay.** The new area is open (its haze clears) but **its sports must be earned again with the normal sport unlock chain**. Income is multiplied by **×3 per expansion** (×3, then ×9).
* After the last expansion the Expand sheet shows "Fully expanded".
* There is a **test aid** `BALANCE.testAlwaysExpand` (default **false**). When true, Expand always works with no requirements, and can replay the wave after the last expansion.

### 7.7 Unlock rules summary
* Level 2 of a sport: 12 upgrade levels on Level 1 + coins. Level 3: reputation + coins + Level 2. Level 4: reputation + coins + Level 3. Level 2-4 also need the sport to be unlocked and its area to be open. Locked zones show "Opens with beach expansion N" when the area is closed.
* The **unlock card** in a locked zone's sheet shows "You get: (the includes list)", a list of requirements with a check when met and progress text (for example "Upgrade Beginner class 5 / 12 upgrades", "Reputation 31  12 / 31"), and a button "Unlock · (coins)" (or "Start it · (coins)" for a sport) that is enabled only when everything is met and the coins are there. Text "(need more coins)" appears when only coins are missing. Numbers use the short format (section 10).

### 7.8 Quests
A row of up to **6 quests** (5 at the start), each with its **own reward** (fixed when the quest is made). Slot rules (deterministic):
* Slot 1 **level up**: "Level up (zone) to level N", N = the next of 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 1000 above the current level; the zone is chosen from the owned zones sorted by tier (highest first) with index `questsDone mod count`.
* Slot 2 **sessions**: "Finish N sessions at (zone)": N = 10 × (1 + round) where `round = floor(questsDone/4)` (doubled once round > 2); counted from the value when the quest was made.
* Slot 3 **served**: "Serve N guests at (zone)": N = 40 × (1 + round) (doubled once round > 2); counted from the value when the quest was made.
* Slot 4 **rotating job**, cycling with `questsDone`: *unlock* the next goal (a level or a sport: "Unlock (level name)" / "Start (sport)"), *manager* ("Hire a manager for (zone)"), *speed* ("Make (zone) faster: speed level N", N = next multiple of 5), *facility* ("Build the (building)" or "Upgrade the (building) to level N"), *expand* ("Expand the beach", only when everything but the coins is met). The first that applies is used.
* Slot 5 **earn**: "Earn N coins" with N = round2sig(max(60, coinsPerSecond × 240 × (1 + round))), counted from `totalCoins` at creation.
* Slot 6 **more guests**: only after 4 quests were finished: "Get N (guest noun) in (zone)": N = max(10, next multiple of 5 above the current guests).
* **Reward** = `ceil(base × worth)`, `base = max(40 × 3^expansions, 90 × coinsPerSecond)` where coinsPerSecond is the income of all managed zones (or of all owned zones if none is managed), and `worth` = level 1, sessions 0.8, served 0.8, earn 0.7, more guests 1.2, faster 1.6, manager 2, building 2.5, unlock 3, expand 6.
* Claiming adds the coins (also to total coins), `questsDone += 1`, and the slot gets a new quest in the same place. After an expansion the quests start again. Quests that ask for a zone that is no longer owned are replaced.

### 7.9 The next goal
`nextGoal(state)` is used to make the unlock quest: the next locked level or sport (the first missing requirement) unless the expansion is within reach.

---

## 8. The economy in one place (the numbers to use)

```
tierFactor(t) = 5^t                 // income scale of a zone
costFactor(t) = 8.8^t               // cost scale (bigger than income scale on purpose)
unlockCoins(t, f) = round2sig(f × 3 × 8.8^t)
pricePerGuest  = 5^tier × (1 + 0.05×lvlUp) × milestone(lvlUp) × 3^expansions × Π(coin facilities)
guests         = baseGuests + capacityLevels
duration       = baseSeconds / ((1 + 0.06×speedLevels) × Π(speed facilities))
income/session = guests × pricePerGuest
rep/session    = guests × 0.04 × 1.9^tier × Π(reputation facilities)
statCost(n)    = ceil(baseCost × 8.8^tier × growth^n × 100)/100
managerCost    = ceil(60 × 8.8^tier)
offline cap    = 8 hours (28,800 s)
```
Because costs grow ×8.8 per tier and income only ×5 per tier, every new tier takes a little longer than the one before. This is what stretches the game over hours. Level up has a small growth (1.03) so that a thousand levels are reachable; the milestone bonuses "bump the income back up" whenever the cost curve gets steep.

**Intended pacing** (measured with the balance bot, which taps every waiting zone at once and buys the best payback, i.e. an active, patient player): first unlock (Level 2 of wave surfing) after about **11 minutes**, skimboarding about 20 minutes, expansion 1 after about **1 h 40 min**, expansion 2 after about **4 h**, everything unlocked and managed after about **7 h**. Maxing all 1000 levels is far beyond 40 hours (on purpose). No gap of 3 hours or more without something to unlock. The playthrough test asserts: first unlock < 15 min, finished between 4 and 14 hours, two expansions with more than 30 minutes between them, levels of a sport unlock in order, no gap ≥ 3.5 h between unlocks.

**Balance bot** (for tests and tuning): every step (10 s in the test) it ticks the game, collects all waiting zones, claims finished quests, then loops up to 50 times: buy the expansion if possible; unlock any sport/level it can afford; otherwise buy the affordable upgrade (level up / capacity / speed of any owned zone, a manager at 15% of the zone's income as its value, a facility) with the **best payback = cost / income gain**, buying up to 200 levels at once but at most 25% of its coins; while saving for an unlock whose only missing piece is coins, it only buys things that pay back in less than half of the time still needed.

**Notes from "The Math of Idle Games, Part I" (Game Developer)** and how this game relates:
* Cost of the next unit `= base × rate^owned`, with rates of 1.07–1.15 in the classics; production is linear in what you own times multipliers. Here the "owned" count is the **level** of an upgrade; rates are 1.03 (level up, thousand levels), 1.17 (capacity) and 1.22 (speed). Exponential cost eventually beats linear income; **multipliers at milestone counts (25/50/100 in the article, 25/50/75/100/200/300 then every 100 here) bump you back up**, and **prestige** (the beach expansion, ×3 income and a restart) is what lets the player pass the wall.
* Bulk buying has a closed form: cost of `n` more units `= b × r^k × (r^n − 1)/(r − 1)`, and the most units affordable with `c` coins `= floor(log_r(c(r−1)/(b r^k) + 1))`. The game loops instead (at most 1000 steps) because every level price is rounded to 0.01.
* The newest generator tends to dominate; older ones must still feel useful. Here the older zones keep their multipliers and quests ask for them in turn, and higher tiers cost ×8.8 versus ×5 income per tier, so upgrading earlier zones stays a sensible use of coins.

---

## 9. The user interface

Portrait. On a wide window the game is a **centred column of width 50vh (a 1:2 screen)**; on a phone it fills the screen. Safe-area insets are respected (`env(safe-area-inset-*)`). Everything in the overlay `#ui` ignores pointer events except real buttons, so dragging on empty places moves the map. Font: `ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, ...`, weights 700-800, no text selection, no long-press menu.

### 9.1 Colour tokens
| token | value | use |
|---|---|---|
| ink | `#0d2b45` | dark text on yellow buttons |
| text | `#eaf6fd` | text on dark panels |
| mute / soft | `#9cc3da` | secondary text |
| panel (foam) | `#0e3352` | sheets, menu, dialogs |
| card | `#164a70` | rows and cards on a panel |
| tile | `#1e5f8c` | small tiles, statistics, icon squares |
| line | `#2a75a8` | borders, sheet handle |
| navy / navy-dark | `#14405f` / `#0a2439` | top-bar pills, quests panel |
| teal / dark | `#1497b5` / `#0e7690` | main action buttons, Beach button |
| purple / dark | `#7a5cff` / `#5237c9` | Sports button |
| coral / dark | `#ff6a3d` / `#d94a1f` | gear, close, Expand, start-over accents |
| sun (yellow) / dark | `#ffc233` / `#d99a10` | buying, claiming, coins |
| red (danger) | `#d94a4a` (shadow `#a72f2f`) | Start over |
| gloss | `linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,0) 55%)` on top of a button colour |

**Buttons are never white.** Every button has a coloured gradient body (gloss over colour), a solid darker **bottom edge** (`box-shadow: 0 3-4px 0 dark`) and moves down 2-3 px when pressed. Minimum tap size 44 px (buy buttons 96×52). **No white as a main colour anywhere.**

### 9.2 Top bar
Left to right at the top (10 px margin, 44 px high): **coins pill** (navy, gloss, coin icon, amount in short format 18 px bold, small "+x/s" of the managed income, and a yellow "×N" chip when expansions > 0), **reputation pill** (star icon + number), **gear button** (coral, right-aligned, 44 px). Under it the quests panel.

### 9.3 Quests panel
Full-width card (rgba(10,36,57,0.9), radius 18, 10 px margins) under the top bar (top 62 px). Header row (30 px): "QUESTS" in yellow small caps, a hint text ("Swipe for more quests", or "N to claim" in yellow), and an arrow that **folds the list away** (tap anywhere on the header; arrow rotates). Below, one **horizontally scrolling row** of cards (scroll-snap, hidden scrollbar), **three cards visible at a time** (each 1/3 of the width minus gaps 6 px, min height 92 px, rgba white 0.08, radius 12). A card: the quest text (11.5 px bold, max 4 lines), a 4 px progress bar (cyan `#3fd1e8`; yellow when done), a small count text ("11 / 25", "Not yet", "Done") and a **button with the reward** ("coin 70"). While not finished the button is grey-ish and inactive; when finished the card gets a warm tint and the button turns yellow, pulses, reads "Claim (coin) 70" and gives the coins on tap (coin sound, floating "+70"). The panel is hidden while a sheet is open.

### 9.4 Bottom bar
Three equal buttons (12 px side margin, 10 px gap, 66 px high, radius 22, icon 28 px over a 12 px label): **Beach** (teal, umbrella icon), **Sports** (purple, surfboard icon), **Expand** (coral, expand-arrows icon; **yellow with dark text and a pulse when you can expand**). It slides away (translateY 120 px, fade) while a sheet is open.

### 9.5 Bottom sheets
A sheet slides up from the bottom (0.28 s), max height 60% of the screen, scrolls inside, radius 28 px at the top, panel colour, a small handle, and a subtle top edge (`0 -4px 0 #2a75a8`). The map behind is moved so the selected zone is visible above it. Tapping empty map closes the sheet. Every sheet header: a coloured 48 px rounded **tile with a white icon**, a title (21 px bold) with a small subtitle, and a coral **close button** (42 px).

**Zone sheet** (owned zone). Header: sport tile, level name, "(Sport) · Level N". Then:
1. **Stat tiles** (4 across): guests, coins each, seconds per session, coins per second.
2. A **session progress bar** (10 px) and a big button: "Start a session" (teal, play icon) / "Collect (coins) X and go again" (yellow) / "Session running…" (disabled) / "Runs by itself" (green, check) with a manager.
3. **Buy amount** row: "BUY" ×1 ×10 ×100 Max (selected = yellow).
4. **Three upgrade rows** in this order: **Level up** (tag icon; text "Lv N · coin a → b each" and a yellow line "star Bonus ×x · next ×y at level L"), **Bigger class** (sport-specific name, people icon, "Lv N · g → g' guests"), **Faster** (sport-specific name, bolt icon, "Lv N · 6.0s → 5.7s per session"). Each row: 40 px icon square, name, effect text, and the buy button (yellow when affordable, dull blue when not, "MAX" in green at the top level).
5. The **manager row** (person-with-star icon, sport-specific name and blurb, a warm-tinted card): button "Hire (coin) X" or "check Hired".
The sheet does **not** show a description block (guests/water/includes) — it was removed.

**Locked zone sheet**: header with a grey lock tile; the unlock card (7.7) or, for a closed area, "Not open yet - Opens with beach expansion N. You start over on a bigger beach and all income is 3 times higher." with a button "Go to the beach" (opens the Expand sheet).

**Beach sheet**: title "Beach facilities" / "Shared buildings that boost every sport": four rows (icon square, "name Lv n/8", blurb, the effect line "+X% coins now, +Y% per level", buy button).

**Sports sheet** ("Water sports" / "Tap a level to go there"): a row per sport (46 px tile with the sport icon and colour, name, an info line, and four level pills 44×36 that are blue when owned and dull when not; tapping a pill opens that zone). Info: "(Area) area · N of 4 levels", or "Locked · needs Level 2 of (sport) and reputation R", or "Locked · opens with beach expansion N".

**Expand sheet** ("Expand the beach" / "Open a new area, income goes up for good"): a teal-blue gradient card: "(beach icon) Beach expansion N", the blurb, "All income x3. A big wave washes over the beach and you start over, faster than before. Reputation stays.", one requirement row per sport plus reputation (tick when met, progress text), and the button "Expand · (coin) price" (yellow, enabled only when everything is met). When done: "Fully expanded - The whole map is open. All income is xN."

### 9.6 The menu (gear)
A dialog (max width 380 px, up to 92% of the height, scrolls). Header: coral gear tile "Menu" and close. A **stats strip** (4 tiles: Zones n/24, Managers, Expansions n/2, Quests done) and a line "(coin) X earned in total · playing for T". Then grouped rows (each a card with a 40 px icon tile, title, subtitle, and a chevron or switch): **Settings**: Sound (on/off switch, green when on; remembered). **Help**: How to play. **Your save**: Save code. **Legal**: Terms of Service, Privacy Policy, About and credits (with the version). **Testing**: Add 100B coins (adds 100,000,000,000 coins). Then a red **Start over (erases your save)** and a teal "Back to the beach". Sub-pages have a back arrow, the same close button and a "Back to the menu" button:
* **How to play**: 7 short cards (text in the appendix).
* **Terms of Service** and **Privacy Policy**: dated, sectioned texts (appendix).
* **About**: a teal app icon with a wave, "Surf Tycoon", the version, one sentence, the credits list, and shortcuts to the two legal pages.
* **Save code**: a read-only box with the code (`SURF1:` + base64 of the save JSON), a "Copy the code" button, and "Restore a save": a paste box and a "Restore this save" button (invalid text shows "That is not a valid save code for this version of the game."). Restoring writes the save, stops autosaving and reloads.
* **Start over** asks first in **its own dialog** ("Start over? This erases everything: coins, zones, upgrades, expansions and reputation. You start again with wave surfing only." with "No, keep playing" and a red "Yes, erase everything"). Confirming stops saving, deletes the save and reloads the page. (Do not use the browser's `confirm()`.)

### 9.7 Other UI
* **Floating numbers**: "+amount" in light yellow with a dark outline floats up 60 px and fades (1.1 s) at the zone (max 8 at once). Shown when collecting and when a managed zone finishes a session on screen (ppu > 60).
* **Toasts**: dark rounded notes at the top left under the quests (3.2 s): "(name) unlocked!", "Income x3. New area open!", "Added 100B coins", "Code copied".
* **Confetti**: 30 pieces (9×14 px, six colours `#ff5a45 #ffcf3f #4fc3f7 #5be08f #ff7ab8 #ffffff`) burst from 42% height with a fixed golden-angle pattern (angle i×137.5°, distance 90 + (i×53 mod 130), 1.3 s) on every unlock.
* **Welcome back** dialog (7.2).
* **Loading splash**: a blue gradient with "Surf Tycoon", a moving white bar and "Loading the beach…", fades out (0.5 s) when the scene is ready.
* **Coin icon**: a drawn gold circle (radial gradient `#fff3a8 → #ffc233 → #e39a12`, dark gold ring), not an emoji.

### 9.8 Icons (all custom inline SVG, 24×24, flat, `currentColor`)
coin, coins, star, gear, close, lock, play, check, dot, plus, arrow, flag, trophy, sound, mute, people, tag, bolt, manager (person with a yellow star), info, help, doc, shield, heart, download, upload, chart, back, chevron, copy, wrench, expand, beach (umbrella), sports (board + waves), the six sports (wave: board + water line; skim: round board; wind: sail on board; kite: kite with line; foil: wing with mast; sail: boat with sails), and the buildings (shop, cafe, shower, lifeguard ring). White icons on coloured tiles, dark icons on yellow.

### 9.9 The big wave (expansion animation)
A full-screen overlay (blocks input, 3.3 s, `linear` overall with per-keyframe easing) that **sweeps from the top of the screen down toward the beach**: one continuous body of water (gradient `#5fd0e6 → #2b9ccf → #1a7fb8`) 280% of the screen tall, its **leading edge** is a wavy crest built from a lighter wave ahead (`#4fb6dc`), a main wave (`#1a7fb8`) with a **white foam line** (9 px stroke) and a thinner translucent foam line and a few white foam dots; its **trailing edge** (a white/teal wavy edge) follows. Keyframes of the body's translateY: 0% -100% (fast, `cubic-bezier(.25,.55,.35,1)`), 42% -64% (screen fully covered), 60% -64% (hold, `cubic-bezier(.5,0,.65,1)`), 100% +36% (leaves). The title "(Beach expansion N)" with a beach icon fades in while covered (25%→42%, out 62%→80%). The sheet closes when it starts; at **1.5 s** the state is reset (expand()) and the scene resets its buildings/boats and jumps the camera to the start position; at **2.5 s** confetti and the toast "Income x3. New area open!"; the overlay is removed at 3.4 s. (The tail end of the animation, the trailing edge revealing the fresh map, was praised in review: keep it as it is.)

### 9.10 Sound (Web Audio, no files)
Oscillator blips with an exponential envelope (0.01 s attack, ~0.16 s decay): **coin** 880 Hz then 1320 Hz at +0.07 s (triangle, vol 0.08); **buy** 520 Hz then 780 Hz at +0.06 s (sine, 0.07); **unlock** 523, 659, 784, 1047 Hz at 0, 0.1, 0.2, 0.3 s (triangle, 0.09); **tap** 660 Hz (sine, 0.05). A mute switch in the menu, remembered in local storage (`surf-tycoon-muted`).

---

## 10. Number format
Short numbers: below 1,000 whole numbers (below 10: one or two decimals when needed, e.g. 0.5, 1.3), then suffixes with 3 significant digits: K, M, B, T, Qa, Qi, Sx, Sp, Oc (e.g. 1.50K, 12.5K, 2.50M, 3.00T). If rounding gives 1000 use the next suffix. Times: "45s", "2m 5s", "2h 5m". Session seconds: "6.0s" below 10 s, then whole seconds.

---

## 11. Saving
* Local storage key `surf-tycoon-save-v1` holds the JSON of `GameState` (`version: 3`); a save with another version is ignored and a new game starts. Missing zones/facilities/fields are filled in on load.
* Autosave every 5 s, when the page is hidden or closed, and after purchases. "Start over" and "restore a save" stop autosaving before reloading so nothing overwrites the change.
* Save code = `"SURF1:" + base64(utf8(json))`; parsing validates version, `coins` (number) and `zones` (object).

## 12. Art drawing rules (all drawn in code)
* **Style**: flat, bright, simple shapes; soft shadows; strong colours; no outlines except where noted; **less detail rather than more**. Nothing is downloaded.
* All baked pictures are drawn with the 2D canvas at 1.5–4× resolution, deterministically (a fixed pseudo random generator `s = s×1664525 + 1013904223` seeded per picture), then used as textures.
* Flat pictures lie on the ground and turn with the map (sand, water tiles, cove, kite launch area, jetty, towels, starfish). **Upright pictures** stand up on screen (lighthouse, buildings, palms, trees, bushes, umbrellas, boats, buoys, windsock).

## 13. Tests that must exist (Vitest)
Map view maths (projection round trip, zoom keeps the point under the finger, zoom limits, clamp, start size), economy (income, costs increase every level, buying, managers, facilities, offline equals live play, offline cap), upgrades (milestones, x10/x100 all-or-nothing, Max, the price of x100 shown before affordable, rows order), unlocks (level rules, sport chain, expansion requirements, reset content, ×3 and ×9), quests (kinds, determinism, counters, rewards per kind, reset), save (round trip, garbage, older saves, start over does not re-save, save codes), layout (map 15×8, areas, zones inside their areas and not overlapping, beach sites on the beach), number format, and a **full playthrough** with the balance bot (section 8). Also a browser smoke test (loads, a session pays, buying, hiring a manager, a managed zone earns, progress is saved, wheel zoom, no console errors).

## 14. Things that are deliberately not in the game
No clock, calendar, weather or events (parked ideas). No randomness. No real-money purchases, ads, accounts or analytics. No downloaded art. The boats in the Ocean are decoration only.

## 15. Build and run
`npm install`, `npm run dev` (Vite, port 5173), `npm run build` (type check + build), `npm test`, `npm run smoke`, `npx tsx scripts/simulate.ts 40 5` (prints a whole balance-bot playthrough), `npx tsx scripts/design-tables.ts` (prints the data tables of this document).

## 16. Acceptance checklist (the rebuilt game must pass all of it)
1. Portrait 1:2, 15×8 map turned 215°, beach bottom-left, sea gradient light to dark, no empty space at any pan/zoom, view stays inside the map (overhang max a quarter).
2. Start: only wave surfing Level 1, zone badge says play; after tapping it and waiting 6 s it shows a coin badge; tapping collects 3 coins.
3. First upgrade costs 6 coins (Level up), 25 (Bigger class), 80 (Faster); hire manager 60.
4. Upgrade rows in the order Level up, Bigger class, Faster, then manager; holding a buy button repeats faster and faster; ×10/×100/Max work; x100 price shown when unaffordable.
5. Level milestones give the bonuses of 7.3; level 1000 is reachable.
6. Level 2 unlocks after 12 upgrade levels + 290 coins; skimboarding after Level 2 of surfing + 12 reputation + 5,800 coins; the rest of the chain as in the table.
7. Offline: managed zones earn for up to 8 h; welcome-back dialog.
8. Six sports each move differently (7.4); levels of a sport look alike but their water differs.
9. Expand: needs Level 4 everywhere in open areas, reputation, coins; wave animation; reset as in 7.6; ×3 income; new area haze fades; sports must be re-earned.
10. Quests: row of up to 6 cards, own reward each, easy first (level 10, 10 sessions, 40 guests), fold-away header works, swipe works.
11. Menu with stats, sound switch, how to play, terms, privacy, about, save code backup/restore, test coins, start-over dialog that really wipes the save.
12. No emoji, no white buttons, custom SVG icons, coloured gloss buttons with solid bottom edge.
13. `npm test` and the smoke test pass; the playthrough timings of section 8 hold.

---

## Appendix A. Texts (copy exactly)

**Zone/level texts** are in the tables above (names, guests, conditions, includes). **Upgrade and manager names per sport** are in the table above.

**Facility blurbs** are in the facilities table. **Expansion blurbs** in the expansions table.

**How to play** (menu):
* **Start sessions**: Tap the round badge on a zone to start a session. When it is done, tap it again to collect the coins.
* **Upgrade**: Open a zone to level it up, get a bigger class or make it faster. Hold a button to buy quickly, or pick x10, x100 or Max.
* **Managers**: Hire a manager to keep a zone running by itself, also while the game is closed (up to 8 hours).
* **New levels and sports**: Levels and sports need coins and reputation. Reputation comes from your guests.
* **Quests**: Finish quests for extra coins. Every quest pays its own reward. Swipe the row of quests sideways to see them all.
* **Expand the beach**: When you own Level 4 of every sport, you can expand the beach: all income goes up for good, a new area opens and you start over.
* **Moving around**: Swipe to move, pinch or scroll to zoom.

**Terms of Service** (last updated 21 September 2026):
* **1. About this game** Surf Tycoon is a free idle game about running a water-sports spot. By playing it you agree to these terms. If you do not agree, please do not play.
* **2. Free to play** The game is free. There are no in-app purchases, no ads and no real-money items. Coins, reputation and everything else in the game have no value outside the game and cannot be exchanged for money.
* **3. Your progress** Your progress is saved on your own device. If you clear the data of the app or the browser, or use "Start over" in the menu, your progress is gone. You can make a backup with a save code in the menu. We cannot restore lost progress.
* **4. Fair play** You may play the game for your own enjoyment. Please do not copy, sell or pass off the game as your own, and do not try to break or misuse it. Options marked as test options in the menu are there to try the game out.
* **5. No promises** The game is provided "as is". It is still being built, so things can change, get rebalanced or contain mistakes. We do not promise that it will always work or be available, and we are not responsible for any loss that comes from playing it, as far as the law allows.
* **6. Changes** We may change the game or these terms. When we do, the date below changes. If you keep playing after a change, you accept the new terms.
* **7. Contact** Questions about these terms? Contact the publisher of the game. (Contact details are added when the game is released.)

**Privacy Policy** (last updated 21 September 2026):
* **The short version** Surf Tycoon does not collect, send or sell any personal data. Everything stays on your device.
* **What is stored** Your game progress (coins, zones, upgrades and so on), the time it was last saved, and your sound setting. This is stored on your device only, in the local storage of the app or browser.
* **What is not collected** No name, no email address, no account, no location, no contacts, no advertising ID and no analytics or tracking of any kind. The game does not connect to any server to run.
* **Third parties** There are no ads and no third-party services in the game. If you play in a web browser, the website that hosts the game can see normal technical information (like your IP address) in its own logs, as with any website.
* **Your choices** You can delete all data the game stores at any time with "Start over" in the menu, or by clearing the site or app data. A save code you copy is yours: keep it somewhere safe, because anyone with the code can load your progress.
* **Children** The game is suitable for all ages and does not ask for any personal information.
* **Changes and contact** If this ever changes (for example when online features are added), this policy will be updated before it does. Contact the publisher of the game with questions. (Contact details are added when the game is released.)

**Credits**: Game design - The author of the Surf Tycoon concept; Built with - Phaser 4, TypeScript and Vite; Art and icons - Drawn in code, no downloaded art; Sound - Made with the Web Audio API. About text: "An idle game about running a water-sports spot: surf, skim, windsurf, kite, foil and sail."

**Loading**: "Loading the beach…". **Welcome back** texts in 7.2. **Buttons**: "Start a session", "Session running…", "Runs by itself", "Collect (coin) X and go again", "Hire", "Hired", "Unlock", "Start it", "Expand", "Claim", "Go to the beach", "Back to the beach", "Back to the menu", "Copy the code", "Restore this save", "Start over (erases your save)".
