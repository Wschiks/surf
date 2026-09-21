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
- "Keep the view inside the map": the view is kept inside the map square, but it may hang over an edge by a quarter of its own size (so the beach, the rocks and the ocean edge can sit in the middle of the screen; the world continues there). At the widest zoom the whole map is visible and centred. Tested in `tests/mapview.test.ts`.
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

## Unlocks and skimboarding (stage 4)
- The sport rule from the concept is built exactly: a sport unlocks when the player owns Level 2 of the previous sport and has enough reputation. On top of that the player pays coins to build the sport (its Level 1 zone is then free). Reason: "Each further level is a purchase" and the Sea/Ocean sports are described as bigger investments (kite launch area, boats and jetty), so a coin price makes sense and keeps the player saving. The order is fixed by `order` in `src/config/sports.ts`: wave surfing, skimboarding, windsurfing, kitesurfing, foil and wing, sailing.
- Level 1 of a locked sport is the "start this sport" card; levels 2-4 of a locked sport say "Unlock the sport first".
- Skimboarding's four zones are a 2 x 2 block in the left of the Wave area next to the rocks: Shallows and Flatland near the sand, Shore break and Big shore break further out. The cove has clear shallow water and a wet sand bank for Flatland. Level 1 rule: reputation and coins; Level 2 needs 10 upgrades on Level 1, like wave surfing.
- A "Next goal" bar under the top bar always shows what to aim for (first locked zone in sport order, first missing requirement, progress bar). Tapping it opens that zone. This keeps the player from getting lost in a big map.

## The Sea area (stage 5)
- Open question "how are windsurfing, kitesurfing and foil and wing laid out inside the Sea area: side by side, or one behind the other?" Default chosen: **side by side**, three columns across the Sea area (windsurfing on the left, kitesurfing in the middle, foil and wing on the right), each with its four levels as a 2 x 2 block (Level 1 and 2 nearest the beach, Level 3 and 4 further out).
- The Sea area's haze fades away when windsurfing unlocks (the first sport of the area), as asked.
- Kitesurfing has its own wide launch area on the beach (in front of the beach buildings, in the middle). Until kitesurfing is unlocked it is an empty dashed plot with a label; when the sport unlocks the launch area appears with kites laid out and a windsock.
- Balance: income of a zone grows 5x per tier, costs grow 7.5x per tier (`costScale`). Because costs grow faster than income, every new tier takes a bit longer than the one before, which is what stretches the game to hours instead of minutes. Tuned with the balance bot.
- Zone conditions map to water looks (flat, ripple, chop, swell, rolling, shore break, big) drawn as rolling foam patterns; nothing is random.

## The Ocean area (stage 6)
- Sailing has four zones side by side across the Ocean area (rows 9-10). Level 1 (Sailing school) is on the right, next to the jetty side of the map, and the levels run to the left, so Level 4 (Offshore regatta) is the furthest offshore.
- The Ocean area's haze fades away when sailing unlocks, as asked.
- The jetty is on the beach side, at the right edge of the beach, reaching into the water. It is an empty dashed plot until sailing unlocks, then the wooden jetty appears.
- Open question "what else belongs in the Ocean area besides sailing (sailing and boats and all)": simple boat features, purely visual, tied to progress: dinghies moored at the jetty (one for every sailing level owned), race course buoys once Club racing is open, and an ocean racer yacht once the Offshore regatta is open. They bob gently. No extra mechanics were added, to keep the first version simple; boats as a real upgrade type is listed under next steps.
- Sailing is the biggest investment: it has the highest reputation and coin requirements of all sports.

## Balance (stage 7)
- Tuned with the balance bot (`npx tsx scripts/simulate.ts 40 5`, env `CS=` cost scale and `UM=` unlock price multiplier to try other values). The playthrough test (`tests/playthrough.test.ts`) plays the whole game with the bot and checks: everything unlocked and managed within 4 to 12 hours, everything maxed within 36 hours, the first unlock within 15 minutes, the sport order of the concept, and no gap of 3 hours or more between unlocks.
- With the final numbers the bot (which taps every zone at once and never sleeps) gets the first unlock after about 6 minutes, a new level or sport every 5 to 15 minutes in the first two hours, then slower steps. Everything is unlocked and managed after about 8 hours, and every upgrade is maxed after about 24 hours. A real player who sleeps and works will take days, which is the point of an idle game; the 8 hour offline cap fits that.
- Costs grow 7.1x per tier while income grows 5x per tier, unlock prices are 3x the base formula (`unlockMult`). Reputation thresholds grow about 1.9x per tier, following how fast reputation is earned.
- No prestige system (open question): not built, as asked. The late game is simply "max everything".

## Polish and phone build (stage 7)
- The canvas is drawn at the device pixel ratio (at most 2), the view maths works in page pixels, so the art is sharp on phones.
- Swiping keeps gliding a little after the finger lifts. A tap (little movement) on a zone opens it; a tap on empty water closes the panel.
- Extra polish, all drawn in code: palms, umbrellas and towels on the beach, trees and bushes behind the beach, slow swells over the whole sea, wake foam behind riders, guests fade in and out at the start and end of a ride, people strolling along the shore (more of them when reputation grows), coin numbers that float up when a managed zone finishes a session, confetti and a toast on every unlock.
- A "Sports" panel lists the six sports with a button per level to jump to any zone.
- Small sound effects (Web Audio, no files) for coins, purchases and unlocks. There is a mute switch in the menu and the choice is remembered. Not asked for, but the concept lists "sound" as a later step; it can be removed by deleting `src/ui/sound.ts`.
- Capacitor: `@capacitor/core`, the CLI, and the iOS and Android projects are added (`ios/`, `android/`, `capacitor.config.ts`). `npm run phone:sync` builds the web game and copies it in. The app id is a placeholder (`com.example.surftycoon`). Nothing was built natively (no Xcode or Android Studio runs here), no store account was created and nothing was published.
- Screenshots are saved in `screenshots/` (the prefix says which stage or check: `s1-` to `s6-` are the stage screenshots taken while building, `final-` are the last ones).

## Answers to the open questions (defaults chosen, all changeable in config)
1. Do the four wave surfing levels sit at increasing distance from the beach? Yes (see stage 3).
2. How much of the map does the player see at once, can they zoom out? About 1 by 2 units at the start, closer up to 0.7 units across, and out until the whole map is visible.
3. Which landmarks belong to the first two wave levels, the Sea area and the Ocean area? None (the concept says they do not have one yet). The Sea area only has the kite launch area on the beach; the Ocean area gets the jetty and the boats.
4. Sea layout: side by side.
5. What else in the Ocean besides sailing? Simple boats (see stage 6).
6. Do areas and sports unlock one by one as suggested? Yes, exactly as suggested: a sport needs Level 2 of the previous sport and reputation; the Sea area opens with windsurfing and the Ocean area with sailing. Coins are needed on top.
7. Do the suggested zones, guests and conditions for the five other sports fit? They were used as written in the concept document.
8. Prestige system? Not built, as instructed.
9. Build route? Web (Phaser 4 + TypeScript + Vite), phone-first but it also plays in a desktop browser (shown as a 1:2 column), with a Capacitor wrapper for phones.
10. Where does the art come from? Simple vector art drawn in code, no downloads.

## Simpler look (after review feedback)
- Feedback: too much detail, tags floating over the map, riders did not look like surfers, emoji and default-looking buttons.
- Riders are now flat top-down pictures (board or boat with a rider on it, seen from above like the map), rotated to the direction they move. Sails, kites and wings are simple flat shapes.
- The text tags on the map are gone. Every zone has one small round badge (sport icon, level number, ring for the session progress). Waiting zones show a play or coin badge; tapping it starts or collects. Names only appear in the sheet. Area names only show when zoomed far out; the kite launch area and jetty plots only show a small lock badge.
- All icons are custom inline SVG (`src/ui/icons.ts`): sports, upgrades, beach buildings, buttons, close, lock, star, gear. No emoji anywhere in the game. Buttons use one flat, chunky style: yellow for buying, teal for actions, sand for secondary.
- Less noise in the water and sand (fewer sparkles, fainter waves, no dashed zone borders, fewer corals).
- Menu (gear): new "Add 100B coins (test)" button for trying the late game. It only adds to the coin balance.

## Big change: beach expansions, new map, new look of buttons (second review)
- **The map is now 15 wide and 8 deep** (was 10 x 10). The areas keep their shares: beach 20% (1.6), Wave 30% (2.4), Sea 30% (2.4), Ocean 20% (1.6). All zones, landmarks, the kite launch area, the jetty, beach buildings and decoration were re-laid out for it (`src/config/`). Wave surfing and skimboarding sit side by side in the Wave area with the jetty in the gap between them; the three Sea sports are side by side; the four sailing zones run across the Ocean.
- **The beach is bottom left.** The map is turned 35 degrees and flipped (rotation 215 = 180 + 35), so the beach is in the bottom left of the screen and the open sea goes toward the top right. Waves roll toward the beach.
- **The unlock chain between sports is gone.** You start with wave surfing and skimboarding (both Level 1, free). Levels 2 to 4 of each sport still need upgrades or reputation plus coins.
- **Beach expansions replace it** (`src/config/expansions.ts`, `src/core/unlocks.ts`): Expansion 1 opens the Sea (windsurfing, kitesurfing, foil and wing at Level 1), Expansion 2 opens the Ocean (sailing). Each one needs Level 4 of every sport in the open areas, reputation and a lot of coins, multiplies all coin income by 3 (so x3, then x9) and **starts everything over**: coins, zones, upgrades, managers and facilities are wiped. Reputation is kept (it is your standing, and it makes the replay faster). A big wave sweeps over the screen; while it hides the map the reset happens, then the new area's haze clears. This is the prestige-like system the author asked for now; the earlier "no prestige" answer is replaced by it.
- Saves from the previous version are not compatible (save version 2) and start a new game.
- **Balance** was tuned again with the bot: cost scale 8.8. The bot reaches Expansion 1 after about 1h50m, Expansion 2 after about 4h50m, has everything unlocked after about 9 hours and everything maxed after about 24 hours. Each replay is much faster than the first run.
- **Motion per sport** (`src/scene/motion.ts`): surfers paddle out and ride waves in with a hop, skimboarders run down the sand and slide out in an arc, windsurfers tack in zigzags, kitesurfers make fast runs with big jumps, foilers fly long figure eights, sailors race around a course. All levels of one sport use the same riders; the water around them differs (colour wash and wave pattern per level).
- **Buttons** are no longer white: navy for the top bar and small buttons, teal, purple and yellow for the bottom bar, coral for close and menu, yellow for buying. All have a soft gloss and a solid bottom edge.

## Third round (review changes)
- **Collect button removed.** The bottom bar is now Beach, Sports and **Expand**. Expand opens its own sheet with the beach expansion card (it lights up yellow and pulses when you can afford it). The beach sheet only has the buildings now. Waiting zones are collected by tapping their round badge on the map.
- **The game starts with wave surfing only.** Skimboarding must be earned: own Level 2 of wave surfing, 12 reputation and coins. After a beach expansion it is open from the start (you have learned it), together with the Sea sports. The expansion still asks for Level 4 in every sport of the open areas, so skimboarding is part of the first expansion.
- **Start over really works:** it used the browser's confirm() which some app views block. It now has its own dialog ("Start over?" with "No, keep playing" and "Yes, erase everything"), stops saving, erases the save and reloads. Checked in the browser: after confirming the game is new (0 coins, one zone, no manager, no expansions) and stays new. Save version is 3, so saves from before start fresh.
- **Beach buildings are much dearer:** first level 5,000 to 25,000 coins (was 250 to 1,200) and each level costs about 5.3x the last.
- **Upgrades rebuilt** (`src/config/balance.ts`):
  - **Level up** (was "income per guest"): up to 1,000 levels. Each level is a small step (+5% of the base price per guest) and costs 3% more than the last. Bonus multipliers that stack: level 25 x1.1, 50 x1.2, 75 x1.5, 100 x1.75, 200 x2, 300 x2, and then every 100 levels x2 (400, 500, ...). I read "lvl 100 = 1.75x" as the multiplier that level adds on top of the earlier ones. The row shows the current bonus and the next one.
  - **Faster** is the dearest (first level 80, +22% per level, 40 levels, each level makes a session 6% quicker).
  - **Bigger class / more space** is dearer than a level up (first level 25, +17% per level, up to 100 levels, one more guest each).
  - **Buy amount:** x1, x10, x100 or Max above the upgrade rows, so 1,000 levels do not need 1,000 taps. A button that buys several levels shows "+N" and the total price.
- Balance with the bot: first unlock after about 11 minutes, the first expansion after about 2 hours, the second after about 4 hours 45 minutes, everything unlocked and managed after about 9 hours. Maxing every level up (1,000 each) is far beyond 40 hours, on purpose.

## Fourth round (review changes)
- **Order of the upgrades:** level up, bigger class, faster, then the manager (head instructor).
- **Holding a buy button keeps buying** (level up, bigger class, faster and the beach buildings): first a slow repeat, then quicker, and after a second or so several levels per tick, so 100 levels take about two seconds. Saved when the button is let go. Sound is throttled while holding.
- **x10 and x100 are all or nothing:** exactly that many levels or none. The button always shows the price of the chosen amount (+10, +100 and the total), greyed out while the coins are not there. Max still buys as many as the coins allow.
- **No white as the main colour any more:** the panels, cards, menus and dialogs are now deep blue (with light text) and the map badges have dark rings; buttons stay coloured (navy, teal, purple, coral, yellow).

## Fifth round (review changes)
- **The overview map and its jump buttons are gone**, and so is the "next goal" bar.
- **Quests** (`src/core/quests.ts`): three at a time in a small panel under the top bar (tap the header to fold it away). Finish one and tap Claim for coins; the slot then gets a new quest. What is asked depends only on how far you are (nothing random): slot 1 "Level up <zone> to level 25, 50, 75...", slot 2 "Get 10, 20, 30... <surfers, skimboarders...> in <zone>", slot 3 rotates between unlocking the next level or sport, hiring a manager, a faster level, a beach building and expanding the beach. The reward is about 1.5 minutes of what the beach earns at that moment (never less than 40 coins, times 3 per expansion). After an expansion the quests start again. The balance bot claims them too.
- **Test aid: you can always expand.** `BALANCE.testAlwaysExpand` (in `src/config/balance.ts`) is `true` for now, so the Expand button works at any time with no requirements and no coins, and it can replay the big wave after the last expansion. The button shows "Expand (test: no requirements)". Set it to `false` for the real rules (tests and the bot always play with it off).

## Sixth round (review changes)
- **Layout: back to the old one.** I first misread "the west" as the sport zones and put the four levels of each sport in a row; that was wrong and is undone: the levels are a 2 x 2 block again (Level 1 and 2 near the beach, 3 and 4 further out), landmarks and jetty are back where they were. What was meant was the **quests**: the three quests now sit **next to each other** in one row (a small card each with the text, a progress bar, the count and the Claim button), not underneath each other.
- **A beach expansion now really starts over:** all upgrades, managers and buildings are gone (as before) and nothing is given for free any more: you start with wave surfing Level 1 only, like a new game (with the higher income multiplier and your reputation). The new area is open, but its sports have to be earned again: skimboarding after Level 2 of wave surfing, windsurfing after Level 2 of skimboarding, kitesurfing after windsurfing, foil and wing after kitesurfing, sailing after foil and wing (each needs reputation and coins). With the bot: Expansion 1 after about 1h40m, Expansion 2 after about 4h, everything unlocked and managed after about 7 hours.
- **Big wave animation:** the start was a flat block and a stiff slow beginning. It now sweeps in quickly as one piece of water with a foam line, a lighter wave ahead of it and foam bubbles; the ending is unchanged.

## Expanding is no longer free
- `BALANCE.testAlwaysExpand` is now `false`: the Expand button follows the real rules again (Level 4 of every sport in the open areas, reputation and coins). It is only enabled when everything is met, and it needs the coins (it is not free). Set it to `true` again to watch the big wave at any time.

## The menu (gear button)
- Rebuilt as a proper menu (`src/ui/menu.ts`) with a header, your stats (zones, managers, expansions, quests done, coins earned, time played) and grouped rows: **Settings** (sound switch), **Help** (how to play), **Your save** (save code), **Legal** (Terms of Service, Privacy Policy, About and credits), **Testing** (add 100B coins) and a red **Start over**. Every page has a back button.
- **Terms of Service and Privacy Policy** are real screens with the text in `src/config/legal.ts`. They describe what the game does today: free, no purchases or ads, no accounts, nothing collected, the save only on the device. They are short, plain placeholder texts, **not legal advice**: before a store release the publisher's name and contact details must be added and the texts checked by someone who knows the rules of the target stores.
- **Save code:** copy your whole game as text (starts with `SURF1:`) and restore it by pasting it back (also to move to another device). Invalid text is rejected with a message. Tested in `tests/save.test.ts` and in the browser.
- Version and credits come from `package.json` and `src/config/legal.ts`.

## Quests reworked
- **Every quest has its own reward**, shown on its card the whole time (not "x each"). The reward is fixed when the quest is made and depends on the kind of job: a level up pays the base amount (about 1.5 minutes of what the beach earns, at least 40 coins), more guests x1.2, a faster level x1.6, hiring a manager x2, a beach building x2.5, unlocking a level or sport x3 and expanding the beach x6. A finished quest shows a yellow Claim button with its coins.
- **The fold-away arrow works now.** A CSS rule had been overwritten by mistake, so the list never hid. Tapping the header folds the quests into one bar and tapping again opens them. Checked in the browser.
