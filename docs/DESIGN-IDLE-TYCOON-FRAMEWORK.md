# The Surf Tycoon recipe: how to make any themed idle tycoon in the same style

**Purpose.** `DESIGN-SURF-TYCOON.md` describes one finished game. This document turns it into a **recipe**. Give an AI (or a developer) *this document plus the Surf Tycoon document* and one sentence such as **"I want a ski resort"**, and it should produce a new game that plays, looks and feels like Surf Tycoon, with the theme swapped: same screens, same economy shape, same map logic, same quests, same menu, same prestige moment.

Rule of thumb: **everything in Surf Tycoon is kept except the theme.** Only *data* (names, colours, numbers that depend on the theme), *art* (landmarks, riders, buildings), *motion* (how the guests move) and *texts* change. Code structure, formulas, UI layout, interaction rules, tests and balance targets stay the same.

---

## 0. How to use this (prompt to give an AI)

> You are building a mobile idle tycoon called **{GAME NAME}** about **{THEME}**. Read `DESIGN-SURF-TYCOON.md` (the reference game) and `DESIGN-IDLE-TYCOON-FRAMEWORK.md` (this recipe). Build the new game in the same technology (Phaser 4 + TypeScript + Vite + npm, HTML/CSS overlay, all art drawn in code, custom SVG icons, Vitest, Playwright) and the same project structure. Fill in the theme sheet in section 3 for my theme (use the worked example in section 14 as the model). Keep every rule, formula, UI layout, colour rule and test of Surf Tycoon, changing only names, art, motion and theme-dependent numbers as this recipe says. Work in the stages of section 12, run the tests and the balance bot, and finish with the acceptance checklist of section 13. Do not download art. Do not use emoji. No button may be white.

If the user only gives a theme (for example "a ski resort"), use the **defaults in section 14** and write down every choice in a `DECISIONS.md`.

---

## 1. What "the same style" means

**Game feel**
* Portrait phone game (1:2), one big rotated top-down map you pan and zoom, a base ("hub") in the bottom-left corner and ever more difficult territory toward the top-right.
* **Two currencies**: coins and reputation (a star counter).
* **Zones** with round badges, one bottom sheet per zone, three small upgrades + a manager per zone, milestone bonuses, quests with their own rewards, prestige as a big animated "wave" that resets everything for a permanent multiplier.
* **Nothing random. No clock/weather/events.** Idle earnings up to 8 hours.
* Friendly, bright, flat; **no clutter floating over the map**; big tap targets.

**Look**
* Flat top-down guests (a vehicle/board/equipment + a person seen from above), soft shadows, bright saturated colours.
* Dark-blue panels with light text, **coloured glossy buttons with a solid darker bottom edge, never white**, custom SVG icons, no emoji.
* Landmarks that make important zones recognisable; a hazy veil over areas that are not open yet.

**Structure** (never changes): base area (20%) + three territories (30/30/20%) on a 15×8 map, six activities × four levels = 24 zones, four beach-style facilities, two expansions, quests, menu with legal pages and save codes.

---

## 2. Vocabulary: Surf Tycoon term → generic term → ski resort term

| Surf Tycoon | Generic term | Ski resort |
|---|---|---|
| beach (20% of the map, shared hangout) | **base** | **village / lodge area** |
| Wave area (open from start) | territory 1 | **Bunny hills** |
| Sea area (opens with expansion 1) | territory 2 | **Mountain slopes** |
| Ocean area (opens with expansion 2) | territory 3 | **Summit** |
| water gradient light → dark (depth) | **terrain gradient** | snow: white-blue near the village to deep grey-blue toward the summit |
| sport (wave surfing...) | **activity** | skiing, sledding, snowboarding, snowkiting, ski jumping, heli-skiing |
| level (Beginner class ... Nazaré) | level (1-4) | Bunny slope ... Couloir |
| zone | zone | zone |
| guests / riders | guests | skiers, sledders... |
| session | session (a run) | a run down the hill |
| manager | manager | ski instructor / patrol / pilot |
| beach facilities (shop, café, showers, lifeguard) | **base facilities** | rental shop, mountain hut, sauna, ski patrol tower |
| beach expansion + big wave | **expansion + the big event animation** | **lodge expansion + an avalanche / snowstorm sweeping the screen** |
| kite launch area, jetty (beach sites) | **base sites** | snowkite field, helipad |
| reef, Nazaré fort + red lighthouse, rocks (landmarks) | **landmarks** | see 14 |
| "waves roll toward the beach" | "terrain flow points toward the base" | snow drifts / slopes lead downhill toward the village |

Keep the **counts and roles** (6 activities, 4 levels, 4 facilities, 2 sites, 3 landmarks + cove, 2 expansions), not the surf words.

---

## 3. The theme sheet (fill this in first)

Decide these and write them into the config files. Every item has a default in section 14.

1. **Game name**, one-sentence pitch, app id placeholder.
2. **Base**: name, what it looks like (sand → snow/village), decoration (palms/umbrellas → pines/benches), 4 facility buildings.
3. **Three territories** (names, look, gradient stops), and what "haze" is (clouds/fog/snow mist).
4. **Six activities** in this unlock chain order: #1 the start activity (open from the start), #2 the cheap sibling (at the base edge, needs Level 2 of #1), #3-#5 territory-2 activities (side by side), #6 the territory-3 activity (needs the most expensive investment and a base site).
5. For each activity: name, icon idea, **guest kind** (their equipment), guest colours (5), **noun** ("skiers"), upgrade names (bigger class / faster / manager), 4 levels (name, who, conditions, includes-list, water/terrain look).
6. **Landmarks**: one for the cheap activity's spot (rocks+cove analog), one for level 3 (reef analog), one for level 4 (fort + lighthouse analog), all drawn in code.
7. **Base sites**: one for activity #5 or #4 (kite-launch analog), one for #6 (jetty analog); decoration for territory 3 (boats analog: helicopters, cable cars).
8. **Expansion event**: what sweeps the screen (default: a wave-like sweep in the theme's colours, entering from the top, leaving at the bottom), the two expansion names and blurbs.
9. **Colour palette**: keep the UI palette of section 9 of the reference (dark-blue panels, teal/purple/coral/yellow buttons); change only map colours (terrain gradient, sport colours) and the app icon.
10. **Legal texts**: reuse the two texts with the game name replaced.

---

## 4. Data model (the config every theme fills in)

Keep these TypeScript shapes (they are the same as in Surf Tycoon). Adding an activity must only mean adding data.

```ts
type GuestKind = 'a'|'b'|'c'|'d'|'e'|'f'|'walker';       // one per activity + strolling guests at the base
interface AreaDef { id; name; from; to /*depth*/; expansion /*0,0,1,2*/; color; blurb }
interface UnlockRule { coins; reputation; prevLevelUpgrades? }
interface LevelDef { name; guests /*who*/; conditions; starterBuys: string[]; rect /*x,depth,w,h*/;
                     tier; baseGuests; baseSeconds; look /*terrain look*/; unlock? }
interface SportDef  /* rename to ActivityDef in a new game if you like */ {
  id; name; icon; area; color; noun; guestKind; guestColors: string[5];
  unlock?: { after: ActivityId; level: 2; reputation; coins };       // all but the first activity
  beachSite?: { id; name; rect };                                   // base site
  terms: { capacity; price /*'Level up'*/; speed; manager; managerBlurb };
  levels: LevelDef[4] }
interface FacilityDef { id; name; icon; blurb; effect: 'coins'|'speed'|'reputation'; perLevel; max; baseCost; growth; at }
interface ExpansionDef { n; name; opens: AreaId; blurb; level; reputation; coins }
```
Plus `balance.ts` (constants of section 6), `landmarks.ts`, `legal.ts`, `layout.ts` (15×8, unit 100, rotation 215, zoom limits) exactly as in the reference.

---

## 5. World and map recipe

1. **Map** 15 wide × 8 deep, `UNIT = 100`, rotated 215° so the base is bottom-left and the goal territory top-right. Keep the camera maths, clamping, gestures and zoom limits of the reference.
2. **Areas by depth** (fractions of 8): base 0-1.6, territory 1 1.6-4.0, territory 2 4.0-6.4, territory 3 6.4-8.0. Territory 2 and 3 sit under a **haze** until their expansion.
3. **Terrain gradient**: a list of `[depth, r, g, b]` stops from a light colour at the base edge to a dark colour far out, extended past the map so no corner is ever empty. (Surf: turquoise → deep blue. Ski: bright white-blue snow → grey-blue → dark slate at the summit.) The area behind the base and left/right of the map continue the base ground.
4. **Zone layout inside a territory**: every activity gets a 2×2 block: Level 1 and 2 nearest the base, Level 3 and 4 further out (territory 3: four zones in one row, Level 1 nearest the base site side).
   * Territory 1 (two activities side by side): the cheap activity on the left with zones of 2.2×1.1 at x = 0.1 and 2.35, y = 1.7 and 2.85; the start activity on the right with 4.6×1.1 wide zones at x = 5.6 and 10.3 (Level 4 only 3.1 wide because a landmark sits at the map edge). A one-unit gap at x ≈ 4.9-5.45 holds the territory-3 base site.
   * Territory 2: three activities each in a 5-unit column (`x0 = 0, 5, 10`): zones 2.4×1.1 at `x0+0.05` and `x0+2.55`, y = 4.05 and 5.2.
   * Territory 3: four zones 3.5×1.4 at y = 6.5, x = 11.3, 7.6, 3.9, 0.2 (Level 1 → 4).
   * A validation test must check: all zones inside the map and inside their territory, no overlaps, base sites on the base.
5. **Landmarks** (drawn in code, positions as in the reference): a "rocks + cove" picture at the base edge next to the cheap activity's zones; a colourful "reef" picture on the level-3 zone of the start activity with a long clean feature line; a "fort + tall red tower" on a cliff at the right map edge next to the level-4 zone with huge effects below it.
6. **Base decoration**: fixed positions (not random): 9 tall things along the back of the base (palms), 4 sun-shade+mat pairs, 4 small ground details, 52 trees/bushes behind the base, strolling guests (count `min(12, 3 + floor(log10(rep+1)×2))`).
7. **Base sites**: an empty dashed plot with a small locked badge until its activity is unlocked, then the built version fades in (900 ms). Territory-3 extras (moored boats, buoys, a racer) are decoration linked to the levels owned.

---

## 6. Economy recipe (keep these formulas and constants)

```
tierFactor(t) = 5^t        costFactor(t) = 8.8^t        unlockMult = 3
unlockCoins(t, f) = round2sig(f × 3 × 8.8^t)
pricePerGuest = 5^tier × (1 + 0.05×levelUp) × milestone(levelUp) × 3^expansions × Π(coin facilities)
guests   = baseGuests + capacityLevels
duration = baseSeconds / ((1 + 0.06×speedLevels) × Π(speed facilities))
rep/session = guests × 0.04 × 1.9^tier × Π(rep facilities)
statCost(n) = ceil(baseCost × 8.8^tier × growth^n × 100)/100
   level up  : base 6,  growth 1.03, max 1000  (+5% of base per level)
   capacity  : base 25, growth 1.17, max 100   (+1 guest)
   speed     : base 80, growth 1.22, max 40    (session ÷ (1+0.06n))
milestones on level up (stack): 25 ×1.1, 50 ×1.2, 75 ×1.5, 100 ×1.75, 200 ×2, 300 ×2, then every 100 ×2
manager = ceil(60 × 8.8^tier)
facilities: cost = ceil(baseCost × growth^level), 8 levels, +10% coins, +10% coins, +6% speed, +15% reputation
offline cap 8 h;  max 10 guests drawn per zone
```
**How to assign the numbers for a new theme** (this is the part an AI must not improvise):
1. Give every zone a **tier** exactly like the reference: start activity `0, 1.6, 3.2, 4.8`; cheap sibling `0.4, 1.4, 2.6, 4.0`; territory-2 activities start at `4.4, 5.0, 5.6` and rise by about `1.0, 1.2, 1.2`; territory-3 activity `8.2, 9.4, 10.6, 11.8`.
2. `baseGuests`: `3, 4, 3, 2` for the start activity, `4, 4, 3, 2` for the others; `baseSeconds` rises with level (6-8, 8-10, 10-12, 12-14). Pros have fewer guests and longer sessions.
3. **Unlock rules**: Level 2 = 12 upgrade levels + `unlockCoins(tier₂, 3)` coins (no reputation); Level 3 = `unlockCoins(tier₃, 70)` + reputation `round2sig(4×1.9^tier₃)`; Level 4 = `unlockCoins(tier₄, 150)` + reputation `round2sig(12×1.9^tier₄)`; activity unlock (chain) = Level 2 of the previous activity + reputation `round2sig(3×1.9^tier₁)` + `unlockCoins(tier₁, 60)`.
4. **Expansions**: need Level 4 of every activity in the open territories, reputation 400 / 8000, coins `unlockCoins(6.2, 150)` / `unlockCoins(10.0, 150)`; each ×3 income, everything restarts (only the first activity's Level 1 is owned), the new territory opens, its activities are earned again through the chain, reputation stays.
5. **Run the balance bot** (`scripts/simulate.ts`, section 8 of the reference) and only if the pacing misses these targets change `costScale` (8.8) and `unlockMult` (3): first unlock ≈ 11 min, expansion 1 ≈ 1 h 40, expansion 2 ≈ 4 h, all unlocked and managed ≈ 7 h, no 3-hour gap between unlocks. The playthrough test enforces this.
6. Use the ideas of "The Math of Idle Games, Part I": exponential cost vs linear income (rates 1.07-1.15 in classics; here 1.03/1.17/1.22 per stat), **milestone multipliers to bump income back up**, **prestige to pass the wall**, closed-form bulk cost `b·r^k·(r^n−1)/(r−1)` and max affordable `floor(log_r(c(r−1)/(b·r^k)+1))`, and keep older generators relevant with quests and multipliers.

Because the numbers depend only on tiers, **a new theme keeps the same economy** and only the labels change.

---

## 7. Guests: art and motion for new activities

**Art rule**: a guest is a flat top-down picture (the vehicle/board/equipment + a person seen from above: shoulders in the guest colour, two arms, a head with hair), baked at 4×, nose pointing up, with a soft shadow. One picture set per activity; five shirt colours; four skin tones and five hair colours by index. A `walker` picture (person only) strolls along the base.

**Motion rule**: every activity has its **own** parametric path `pose(t, lane) → {x, y, lift, tilt, wake}` in fractions of the zone rectangle, `t` = session phase 0..1, heading from `pose(t)` to `pose(t+0.006)`, plus `presence(t)` for fade in/out. Paths must differ clearly between activities. Vocabulary to combine: *approach then run* (paddle out, ride in), *arc out and back* (slide), *zigzag legs with sharp turns* (tacking), *fast runs with jumps* (`lift`), *figure eights*, *loops around a course*, *straight downhill with S-curves*, *stand and queue* (waiting state: a row at the base side of the zone).

Rules that stay: at most 10 guests drawn per zone; a wake/trail image where the guest touches the terrain; waiting (unmanaged, not running) guests stand in a row; badges on zones instead of text labels.

**Terrain looks** (the "water looks"): each level has a `look` that sets a translucent colour wash over the zone and a scrolling pattern tile (200×120) that flows toward the base: flat, ripple, shallows, rolling, reef, big, shorebreak, bigbreak, chop, swell (see the reference). For snow: *powder* (soft dots), *groomed* (fine parallel lines), *moguls* (bumps), *icy* (glossy streaks), *chop* (rough dashes), *avalanche field* (big drifting bands). Keep the table of scroll speed / alpha / scale / wash colour per look.

---

## 8. Interface recipe (identical structure)

Keep every screen of the reference and its layout numbers: top bar (coins pill with "+x/s" and "×N" chip, reputation pill, coral gear), quests panel (up to 6 cards in a swipeable row, three visible, fold-away header, own reward per card), round zone badges (locked, play, coins, progress ring), bottom bar (**Base** teal, **Activities** purple, **Expand** coral/yellow), bottom sheets (zone: stats, progress, start, buy amount ×1/×10/×100/Max, rows in the order **Level up → Bigger class → Faster → Manager**, hold-to-repeat buying; base facilities; activities list; expand card), menu (stats, sound switch, how to play, save code backup/restore, Terms, Privacy, About, test coins, start-over dialog), welcome-back dialog, toasts, floating "+coins", confetti on unlock, loading splash, the **big event animation** for expansions.

Only these change: the words ("beach" → "base", "sport" → "activity"), the tile/badge colours per activity, the map colours, the icons of activities/buildings (draw new SVGs in the same 24×24 flat style), and the **expansion animation colours/shape** (an avalanche of white snow with a wavy leading edge sweeping from the top of the screen to the base and back out, in the same timing: 3.3 s, cover at 42%, reset at 1.5 s, confetti at 2.5 s).

Fixed UI rules: no emoji anywhere; **no white buttons and no white main colour** (dark-blue panels, coloured glossy buttons with a solid darker bottom edge); at least 44 px tap targets; short number format (K, M, B, T, Qa...); no text floating over the map except the small area names when zoomed far out.

---

## 9. Quests, menu, legal, save (all reused as they are)

* **Quests**: the deterministic slots of section 7.8 of the reference (level up 10/25/50..., finish N sessions, serve N guests, rotating job, earn coins, more guests later), each with its own reward = `max(40×3^expansions, 90×coinsPerSecond) × worth(kind)`. Only the nouns change ("serve 40 guests at Bunny slope", "Get 10 skiers in ...").
* **Menu and pages**: same rows. Reuse the Terms of Service and Privacy Policy with the game name replaced and the same honest statements (no accounts, no purchases, nothing collected, saved on the device). Mark them as placeholders that need publisher details and a legal check before a store release.
* **Save**: local storage key of the new game, versioned JSON, autosave, offline gap handling, save codes `NAME1:` + base64, start-over dialog (never the browser `confirm()`).

---

## 10. Technical recipe

* Same repo layout as section 2 of the reference. `src/core` has **no Phaser imports** and contains: state, economy, unlocks (levels, chain, expansion, next goal), quests, save, game clock, balance bot. Everything theme-specific is in `src/config`, `src/scene/art.ts` (landmark/guest/building drawing), `src/scene/motion.ts`, `src/ui/icons.ts`.
* Canvas rendered at min(devicePixelRatio, 2); camera rotation 215°; upright pictures counter-rotate; DOM badges/labels follow world points each frame.
* Draw everything in code with a deterministic random generator; bake textures once at start.
* Keep the debugging hook `window.__surf`-style (scene, view, game, ui) for the screenshot scripts, and the test aid flag `testAlwaysExpand` (default false).

---

## 11. Things that must NOT change between themes
The 15×8 map and 215° rotation; the four-area split; six activities × four levels; the three upgrades and their order; the milestone table; the tier/cost formulas; the expansion rule and the reset content (only the first activity's Level 1 owned, reputation kept); the 8-hour offline cap; the quest slots; the menu; the colour rules for buttons; no randomness; no clock/weather/events.

---

## 12. Build order (stages, each ending with tests, screenshots at 400×800, a commit)
1. **Map**: 15×8 rotated map, terrain gradient, base, landmarks, haze, pan/pinch/wheel, clamping, start view.
2. **Idle loop** with the first activity Level 1: coins, reputation, three upgrades + manager, facilities, offline earnings, saving, sheets.
3. **Levels 2-4** of the first activity, unlock rules, landmarks in place.
4. **Second activity** and the activity unlock chain.
5. **Territory 2** (three activities, base site 1), haze clears with expansion 1.
6. **Territory 3** (last activity, base site 2, decoration).
7. **Quests, expansions with the big animation, menu, legal, save codes, sound**.
8. **Polish and balance**: run the bot, tune, playthrough test, smoke test, screenshots.

Tests as listed in section 13 of the reference must be written along the way.

---

## 13. Acceptance checklist for a new theme
1. Same screens and layout as the reference; badges not text on the map; no emoji; no white buttons.
2. Only the first activity's Level 1 at a new game; chain unlocks as in the recipe.
3. Economy identical to section 6 (spot-check: first upgrades cost 6 / 25 / 80 coins, manager 60, Level 2 after 12 upgrade levels).
4. Each activity has its own motion; the levels of an activity look alike, their terrain differs.
5. Expansion: requirements, big animation, full reset with ×3, next territory opens, reputation kept.
6. Quests as specified; menu complete; start over really wipes; save codes work.
7. All tests and the balance-bot playthrough pass; pacing targets hold; smoke test passes.
8. `DECISIONS.md` lists every choice made for the theme.

---

## 14. Worked example: **Ski Resort Tycoon** (use these choices if the user only says "a ski resort")

**Name**: *Ski Resort Tycoon*. **Pitch**: run a mountain resort from a small village to a summit with helicopters. Landing text: "An idle game about running a ski resort: ski, sled, snowboard, snowkite, jump and heli-ski."

**Base** = the **village** (bottom-left, 20%): warm snow-packed ground `#f4f8fb` with cobbled paths, decoration: pine trees instead of palms (upright, dark green layered triangles with snow caps), benches and sun loungers instead of umbrellas/towels, little snowmen instead of starfish, a frozen-pond ring; behind the village a **forest** (pines and bushes, 52 of them, same formula). Strolling guests: people in winter jackets walking the village street. **Facilities** (same numbers): *Rental shop* (+10% coins), *Mountain hut / café* (+10% coins), *Sauna and showers* → *Sauna* (+6% speed), *Ski patrol tower* (+15% reputation). Their buildings: a chalet with a striped awning and skis leaning on it; a log hut with a steaming cup sign; a wooden sauna cabin with steam; a red-white patrol tower on stilts with a cross flag.

**Territories and terrain gradient** (depth 0 → 11): village edge `(244, 250, 255)` → `(214, 236, 250)` → `(168, 208, 236)` → `(120, 172, 214)` → `(84, 128, 178)` → `(52, 84, 130)` → `(30, 48, 84)`. Areas: **Village** (0-1.6), **Bunny hills** (1.6-4.0, open from the start), **Mountain** (4.0-6.4, opens with expansion 1), **Summit** (6.4-8.0, opens with expansion 2). The haze is a **cloud/fog bank**.

**Six activities** (same chain and tiers as Surf):

| # | Surf analog | Activity | Territory | Guest kind (top-down) | Noun | Movement | Upgrade names (capacity / speed / manager) |
|---|---|---|---|---|---|---|---|
| 1 | wave surfing | **Skiing** | Bunny hills | skier: two long skis + poles, person from above | skiers | walk up the hill edge (approach), then **S-turns straight downhill** toward the village, small hop at the start | Bigger class / Faster lifts / Head instructor |
| 2 | skimboarding | **Sledding** | Bunny hills (left, at the village edge, with the *snow rocks + frozen cove* landmark) | sledder on a round tube / wooden sled | sledders | run a few steps, **drop on the sled and slide out in a wide arc** and curve back | More sleds / Quicker runs / Sled host |
| 3 | windsurfing | **Snowboarding** | Mountain (column 1) | rider on a wide board seen from above | snowboarders | **wide carved zigzag legs across the slope**, sharp turn at each edge | More boards / Faster changeovers / Board coach |
| 4 | kitesurfing | **Snowkiting** | Mountain (column 2, needs the *snowkite field* base site) | rider with a crescent kite on a line | snowkiters | **fast runs with big jumps** | More kite spots / Quicker launches / Kite instructor |
| 5 | foil and wing | **Ski jumping** | Mountain (column 3) | jumper in a tucked pose with skis in a V | jumpers | **long smooth arcs with airtime** (lift, no trail) | More jumps / Quick swaps / Jump coach |
| 6 | sailing | **Heli-skiing** | Summit (needs the *helipad* base site) | skier + a small helicopter icon seen from above | heli-skiers | **loops around a course** (helicopter circuit) | More helicopters / Faster turnarounds / Pilot |

**Levels (four each)**, following the pattern of the reference (the sentences are guest / conditions):
* **Skiing**: 1 *Ski school* (kids in a class, in bright jackets / small gentle slope, soft powder), 2 *Cruisers* (weekend skiers / long groomed runs), 3 *Moguls* (good skiers / high bumps and steep pitch), 4 *Couloir* (pros only / extreme steep chute; **landmark: the cliff with a red cable-car station**). Terrain looks: powder, groomed, moguls, avalanche field.
* **Sledding**: 1 *Kids' hill* (kids and first-timers / gentle, ankle-deep snow), 2 *Toboggan run* (families / a long smooth run), 3 *Ice slide* (thrill seekers / fast icy chute), 4 *Bobsled track* (pros only / a banked ice track).
* **Snowboarding**: 1 *Beginner class*, 2 *Freeride*, 3 *Park and pipe*, 4 *Backcountry powder* (pros only).
* **Snowkiting**: 1 *Kite school* (trainer kites, flat field), 2 *Freeride*, 3 *Freestyle and big air*, 4 *Mountain lines* (pros only).
* **Ski jumping**: 1 *Practice hill*, 2 *Normal hill*, 3 *Large hill*, 4 *Flying hill* (pros only).
* **Heli-skiing**: 1 *Helipad school* (beginners flown to a gentle peak), 2 *Charter flights*, 3 *Glacier runs*, 4 *Summit drop* (pro crews).
Guest colours per activity: five bright jacket colours (reuse the palette of the reference, e.g. skiing `#ff6b3d #ffd23f #ff5fa2 #4be07a #3fc3ff`).

**Landmarks** (all drawn in code, same positions as the reference): *snow rocks + frozen cove* (dark grey boulders with snow caps, an ice arch, a frozen pond with a wet-ice shine) for sledding; a *frozen lake / ice field with colourful ice crystals and a long clean groomed line* on the skiing level 3 zone; a *rocky cliff with a stone lodge and a tall red cable-car pylon/tower* at the right map edge with an *avalanche spray* below it for skiing level 4.

**Base sites**: *snowkite field* (wide flat field with laid-out kites and cones and a windsock, at the same place as the kite launch area), *helipad* (a wooden/concrete pad with an H, at the jetty's place and size), summit decoration: a **helicopter parked per heli-skiing level owned, marker flags for the course in level 3, a big rescue helicopter in level 4** (in place of dinghies/buoys/yacht).

**Expansions**: 1 *Lodge expansion* ("Opens the Mountain: snowboarding, snowkiting and ski jumping"), 2 *Grand lodge expansion* ("Opens the Summit: heli-skiing"). The event animation is an **avalanche of white snow** sweeping from the top of the screen over the village and away, with a wavy leading edge, foam-like snow dust and the title "Lodge expansion N".

**Copy**: replace "beach" with "village", "sport" with "activity", "session" stays. How-to-play texts adapt ("Tap the round badge on a zone to start a run...").

**Colours of the activities** (tiles/badges): skiing `#ff6a3d`, sledding `#f2b134`, snowboarding `#1fb6c9`, snowkiting `#ff5c8a`, ski jumping `#8e6bd8`, heli-skiing `#3f51b5` (same as the reference).

Everything else (economy numbers, UI, quests, menu, tests, pacing) is **the same as Surf Tycoon**.

---

## 15. Common mistakes to avoid (learned while building Surf Tycoon)
* Do not put text labels floating over the map: use round badges.
* Do not use emoji or white buttons; keep panels dark blue; keep the coin as a drawn icon.
* Do not use the browser `confirm()` for "start over"; use an in-game dialog. Stop autosaving before wiping/restoring.
* Do not let a sheet's scroll or a CSS rule hide things by accident: test the fold-away quests header, the hold-to-buy button and the menu pages in a browser.
* An expansion must really start over (only the first activity's Level 1 owned); do not hand out free unlocks after it.
* Keep the levels of one activity looking alike (same riders); differentiate them with the terrain look.
* Rewards of quests are per quest (harder jobs pay more), not one fixed number for all.
* Keep everything deterministic; no `Math.random`.
* Always finish with the balance-bot playthrough test and a browser smoke test.
