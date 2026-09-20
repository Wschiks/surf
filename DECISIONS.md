# Decisions

Every choice made while building, and why. The concept document (`docs/concept.md`, an unedited copy) is the source of truth.

## Setup
- The concept document was not in the repository, so a copy was saved as `docs/concept.md` (the document itself suggests this) and `CLAUDE.md` points to it. The copy is unedited.
- Phaser 4.2.1 (latest stable), TypeScript, Vite 8, Vitest for tests, Playwright for screenshots. npm as asked.
- The game world is drawn by Phaser (WebGL), the user interface (coins, panels, buttons, labels on the map, overview map) is plain HTML/CSS on top. This gives crisp text, big tap targets, easy scrolling lists and easy automated testing. All game data lives in `src/config/`.
- All art is drawn in code with the 2D canvas API and baked into textures at start. No art is downloaded. Drawing uses a fixed pseudo random generator, so the art is always the same.

## Map (stage 1)
- Map coordinates: x is the column (0 to 10), depth is the distance from the back of the beach (0 to 10). World y = depth * 100 px, so the beach is at the top of the unrotated map. The whole map is then rotated 35 degrees clockwise on screen by the camera.
- Rows follow the "Layout sketch": beach depth 0-2, Wave 2-5, Sea 5-8, Ocean 8-10.
- Screen: portrait, fills a phone; on a wide desktop window the game is shown as a centred 1:2 column.
- Start zoom shows about 1.1 units across (so roughly 1 by 2.2 units). The closest zoom is 0.7 units across, the furthest shows the whole rotated map. (Answer to the open question "can they zoom out": yes.)
- "Keep the view inside the map": the centre of the view is kept inside the map square. At the widest zoom the whole map is visible.
- Past the map edges: the sea continues left, right and beyond the ocean edge (darker), the beach sand continues left and right, and behind the beach there are dunes and grass. Nothing empty is ever shown.
- Haze over the Sea and Ocean areas is a white veil plus drifting clouds, and fades out when the area opens. The Wave area and the beach are clear from the start.
- Pan and pinch use plain DOM pointer events (one finger drag, two finger pinch, mouse wheel zoom). A tap (little movement) selects a zone.
- Zone/landmark labels are DOM elements that follow map points, so text stays upright while the map is rotated. Tall landmarks (lighthouse, later buildings) are drawn upright "billboards" so they stand up on the rotated map.
- Debug: `?unlock=sea,ocean` or `?unlock=all` clears the haze at start (stage 1 test aid).
- Answer to open question 3 (landmarks for the first two wave levels, Sea and Ocean): no landmarks for wave surfing levels 1 and 2; the Sea area and the Ocean area get simple decoration only (see later stages).

## Idle loop (stage 2)
- Two currencies: coins (spent on upgrades) and reputation (shown as a star, gates levels and sports later). Reputation is earned from every finished session: guests x a small rate that grows with the zone tier. Facilities can raise it (lifeguard tower).
- One zone = one level of a sport. It has a number of guests, a price per guest and a session length. Coins per session = guests x price. Everything scales with the zone's `tier` (costs and income multiply by 5 per tier step), see `src/config/balance.ts`.
- Upgrades per zone: Capacity (+1 guest per level), Income per guest (+25% of the base price per level), Speed (session 10% shorter per level, compounding as base / (1 + 0.1 x level)) and a Manager (automation). Every purchase costs more than the last (geometric growth: 1.3, 1.33 and 1.4 per level). Each stat has a maximum level (25, 30 and 15) so speed cannot reach zero.
- Beach facilities (shared, boost every sport): Rental shop (+10% coins per level), Beach café (+10% coins), Showers (+6% speed), Lifeguard tower (+15% reputation). Maximum 8 levels each. Buildings appear on the beach when first bought.
- No manager: a zone runs one session, then waits with its coins ("Collect"). Tapping the zone (or "Collect all") pays out and starts the next session. With a manager it collects and restarts by itself, and earns offline.
- Offline: earnings are calculated from the saved timestamp, using the same maths as playing live (tested). Zones with a manager earn; zones without one finish one session and wait. **Offline cap: 8 hours** (a full working day/night; long enough to reward leaving overnight, short enough that it doesn't skip the game). The welcome-back screen says so when the cap applied.
- If the tab sleeps for more than 3 seconds (phone locked), the gap is treated as time away with the same rules.
- Saving: browser local storage (`surf-tycoon-save-v1`), every 5 seconds, when the tab is hidden, and after purchases. Saves from older versions get missing zones/facilities filled in.
- UI is HTML on top of the map: top bar with coins and reputation, bottom dock (Beach, Collect all), a bottom sheet per zone. Tap targets are at least 44 px. The camera glides to a selected zone and lifts it above the sheet.
- The coin icon is drawn in CSS because the coin emoji looks different (or missing) on different phones.

## Wave surfing levels (stage 3)
- Open question "do the four wave levels sit at increasing distance from the beach": yes. Levels 1 and 2 are wide bands right behind the shore (rows 3 and 4), the Reef (Level 3) and Nazaré (Level 4) sit side by side at the far edge of the Wave area (row 5). Nazaré is at the map edge, next to the cliff with the fort and the red lighthouse, so the cliff never covers a zone.
- Unlock rules, from the "Starting with wave surfing" table: Level 2 = Level 1 has 10 upgrade levels bought + coins. Level 3 = reputation + coins. Level 4 = high reputation + coins. Each level also needs the level before it. The numbers live in `src/config/sports.ts` and are checked by `tests/unlocks.test.ts`.
- Locked zones show a dark shade on the map with a lock on the tag. Tapping one opens a card that lists what is still needed (with ticks) and the button to buy it.
- Landmarks the player sees from the start: the reef and Nazaré landmarks are on the map from the start, even while their zones are locked (the concept says the player sees the whole map from the start).
- A balance bot (`src/core/bot.ts`, run with `npx tsx scripts/simulate.ts 12`) plays the game: taps every waiting zone at once, buys the best-payback upgrade, and saves up when an unlock is near. It is used in the playthrough test.
