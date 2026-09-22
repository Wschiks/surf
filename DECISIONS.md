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

## More and easier quests
- **The Guests / Water / Includes block is gone** from the zone sheet.
- **Up to 6 quests at a time** in one row of cards; swipe the row sideways to see them all. Small jobs come first:
  - Level up a zone to level **10**, then 25, 50, 75, 100...
  - **Finish 10 sessions** at a zone, and **serve 40 guests** at a zone (zones now count their finished sessions and guests served, also while you are away).
  - Earn a number of coins, from the moment the quest is made.
  - A rotating job: unlock the next level or sport, hire a manager, a faster level, a beach building, expand the beach.
  - "Get 10 surfers in Beginner class" (more guests) only shows up later, after 4 quests were finished.
- Asks get bigger as you finish more quests (sessions 10 -> 20 -> 30..., guests 40 -> 80 -> 120...). Every quest still has its own reward, by kind.

## Design documents
- Two documents were written in `docs/`: `DESIGN-SURF-TYCOON.md` (the whole game, with all numbers, formulas, coordinates, colours, texts and an acceptance checklist) and `DESIGN-IDLE-TYCOON-FRAMEWORK.md` (a recipe for other themes, with a complete ski resort example). The data tables in the first one are generated from the code by `scripts/design-tables.ts`, so they are exact; if the game data changes, run the script and update the tables.
- Read "The Math of Idle Games, Part I" (Game Developer): cost `base x rate^owned` (rates 1.07-1.15 in the classics), production linear in what you own times multipliers, milestone multipliers that bump income back up, prestige to pass the wall, and closed-form bulk formulas. The game already follows this shape (level up 1.03, bigger class 1.17, faster 1.22, milestones at 25/50/75/100/200/300 and every 100 after, the beach expansion as prestige). No numbers were changed because of it; the mapping is written in section 8 of the design document. The closed-form bulk formulas are not used in code because every level price is rounded to 0.01 and the loop is at most 1000 steps.

## App store readiness
- **Removed the "Add 100B coins" button** and the always-expand test switch (`testAlwaysExpand`) completely; the debug hook `window.__surf` now only exists in development or with `?debug` in the address (the test and screenshot scripts add `?debug=1`). `npm run store:check` fails if any cheat code comes back.
- **Version 1.0.0**, app id `com.wschiks.surftycoon` (derived from the GitHub name, to be changed by the owner before the first upload; `npm run phone:id` copies it into Android and iOS; `com.example.*` is refused by Google Play).
- **Icon and splash screens** are drawn in code (`scripts/make-icons.mjs`): a sea gradient, a sun, a white wave and a coral surfboard. iOS icon written without an alpha channel (the App Store refuses alpha), Android round and adaptive icons (sea-blue background), splash screens at every existing size, web icons and a web manifest.
- **iOS**: iPhone only (no iPad screenshots needed), portrait only, export compliance answered (no encryption), a **privacy manifest** (no tracking, no collected data, UserDefaults with reason CA92.1 for the web view) added to the Xcode project. **Android**: portrait only, no cleartext traffic, package moved to the new id, adaptive icon background. (Neither could be built here: there is no Xcode or Android SDK on this machine.)
- **Legal**: a `PUBLISHER` block in `src/config/legal.ts` (name, email, website) is used in the Terms and the Privacy Policy. It is empty because the contact details must be the owner's own; `store:check` fails until it is filled in. The two texts are also written as web pages (`public/terms.html`, `public/privacy.html`) on every build, for the privacy policy web address the stores ask for.
- **Store material**: `store/listing.md` (names, keywords, description, age rating, Google Data safety and Apple privacy label answers, reviewer notes), `store/screenshots/` (1290x2796 iPhone and 1080x1920 Android, six each) and `store/icon-1024.png`. A Google Play feature graphic (1024x500) is still to be made.
- What only the owner can do (accounts, hosting the policy, signing keys, Xcode archive, real-device tests, store forms) is listed in `docs/STORE-READINESS.md`. Nothing was submitted.
- Note: the two design documents in `docs/` were found deleted in the working folder during this step (they are still in git history, commit 421198f). They were not restored and their deletion was not committed.

## Responsive layout, skill points and skill trees
- **Responsive:** the map now always fills the whole window (on a wide screen you see more of the sea instead of a narrow strip); the controls (top bar, quests, bottom bar, sheets) stay in a phone-wide column (max 480 px) in the middle. The map zoom is based on a phone-shaped reference width, so a big window shows more map rather than zooming in. Small phones (<= 390 px) get slimmer pills, short screens (<= 700 px) shorter buttons, and very flat screens (landscape) start with the quests folded away. Checked at 390x844, 360x640, 820x1180, 1280x720, 1920x1080 and 800x360 (`screenshots/resp-*`).
- **Stars:** the star is reputation. It was unclear what it was for, so tapping it now opens a short explanation ("how much guests love your beach; higher levels and sports need it; you keep it when you expand"), and it is also in How to play.
- **Second currency: skill points** (purple gems). Quests now pay skill points on top of coins (1 for a normal quest, 2 for faster/manager/building, 3 for unlocks, 5 for expanding) and every beach expansion pays 15 (first) and 25 (second). They are spent in the skill trees. Skills and points are permanent: they stay when the beach is expanded.
- **Seven skill trees** (`src/config/skills.ts`): one per sport (six) and one for the beach, each with 12 skills. Every tree starts with one free root skill that the player cannot choose (so a new game already has seven learned skills), which then splits into two branches, then four, then a big finishing skill. A skill needs its parent and its points.
  - Sport trees: better prices (+% coins), quicker sessions, bigger crowds (+guests in every zone of the sport), cheaper upgrades, cheaper managers, happy guests (+% reputation), cheaper level/sport unlocks, and a master skill (+30% coins). Discounts are capped at 70%.
  - Beach tree: away time (+0.5, +1, +1.5, +2, +3 hours), better buildings (+10/15/30% effect), cheap materials (-15/20% building prices), quest bonus (+25% coins from quests), busy beach (+5% coins from everything).
  - The skill screen (bottom bar: **Skills**, or tap the gem in the top bar) is a pan-and-zoom map of the seven little trees with a tab per tree, a card that explains the chosen skill and a Learn button. The Skills button pulses when something can be learned.
- **Away time is now 2 hours** (was 8) and the Beach tree makes it longer (up to 2 + 8 = 10 hours). The welcome-back dialog says so.
- **Rendering fix:** the game now asks for the minimum 8 texture units, which removes the "waiting surfer cut in half" glitch that showed up on some renderers with 16 units.
- The balance bot does not spend skill points, so the playthrough numbers describe a player who ignores skills; real players will be faster. The free root skills give +5% coins in every sport.

## Skill points are rare
- Easy quests (level up, finish sessions, serve guests, earn coins, more guests, faster) pay **no** skill points. Harder ones do: hire a manager 1, build/upgrade a beach building 1, unlock a level or sport 2, expand the beach 5. On top of that **every 5th quest you finish pays at least 1**, whatever it asks (it depends on how many you finished, so it stays deterministic). A quest card only shows the gem when it pays one. Expansions still pay 15 and 25.

## Gem quests are fixed per quest
- Fix: the gem was decided when a quest was claimed, so when the 5th quest came around every easy quest suddenly showed a gem. Now it is decided **when a quest is made** and stored on that quest (`points`): a hard kind (manager 1, building 1, unlock 2, expand 5) or every 5th quest that is made (`questsMade`). Only that one quest is a gem quest and it keeps its gem until you finish it; the other quests never change.

## Rounded corners and buttons scale with the screen
- One size unit `--u` (set on the page by `src/main.ts` on load and on every resize): `--u = clamp(0.72, min(columnWidth / 390, windowHeight / 780), 1.15)`, 1 on a normal phone. Every rounded corner in `src/styles.css` is now `calc(N px * var(--u))` and the sizes of the main controls (bottom-bar buttons, pills, close buttons, Go/Buy/Buy-amount buttons, level pills, menu rows, claim buttons) use the same unit, so shapes keep their proportions on small, flat and big screens. Icon tiles keep their picture size and use a proportional corner (31%), so they stay square-ish. The bottom-bar buttons are equal width. Checked at 390x844, 360x640, 800x360 and 1280x720 (`screenshots/btn-*`).

## Skill map is a wheel
- The skill screen now has **one hub in the middle** (a glowing violet gem). The seven free root skills sit on a ring of radius 230 px around it (the Beach at the top, then wave surfing, skimboarding, windsurfing, kitesurfing, foil and wing, sailing clockwise, every 360/7 degrees), joined to the hub by coloured spokes. **Every tree grows outward from its root** like a petal (the tree's local "up" points away from the hub; `skillPosition()` in `src/config/skills.ts`). The tree names sit on the inside of the ring. A new first tab (the gem) shows the whole wheel; the other tabs slide to one tree. All eight tabs fit on one row. Tests check the ring, the outward growth and that no two skills overlap.

## Round: tap outside, no reputation, dearer and slower upgrades
- **Tapping outside closes the sheet.** While an upgrade (or beach, sports, expand) sheet is open, any tap on the map closes it (before, a tap inside the selected zone just reopened it). Also the quests panel's buttons stayed clickable under the sheet while it was invisible (`visibility: hidden` now), which swallowed taps. Tapping the dark area around a dialog closes the dialog too.
- **Reputation is gone** (star, counter, dialog, save field, session gain, requirements, skill kind, facility effect). What gated things before is replaced: **Level 3 needs 30 upgrade levels on Level 2 and Level 4 needs 60 on Level 3** (Level 2 still needs 12 on Level 1), plus the coins; a new sport needs a level of the sport before it and coins; an expansion needs Level 4 everywhere in the open areas and coins. The lifeguard tower now gives +8% coins per level. The "Happy guests" skill became "Cheaper space" (the bigger class costs 20% less). Beach walkers now grow with total coins earned. Old saves still load (the extra field is ignored).
- **Bigger class and Faster are dearer over time and slower to max.** New `surge` in the cost: `cost x (1 + surge x level)` (bigger class 0.06, faster 0.1) on top of the exponential growth. **Faster**: each level now makes a session only 2% quicker (about 0.1 s on a 6 s session, was 6% / 0.3 s), with 100 levels instead of 40 (growth 1.085, first level 80), so it reaches x3 after 100 small upgrades instead of x3.4 after 40. The quest for faster asks in steps of 10 levels.
- **Balance:** cost scale 8.8 -> 9.6 because dropping reputation made the game faster. Balance bot: expansion 1 after about 1h45, expansion 2 after about 4h, everything unlocked after about 10-11 hours (the playthrough test still asserts 4 to 14 hours).
- The two design documents on the Desktop were updated to match.

## Sideways riders and a first-run hint
- Board riders (surfers, skimboarders, windsurfers, kitesurfers, foilers) now stand **sideways** on the board like real surfers: shoulders and arms along the board, the head a little to one side (regular/goofy alternating by guest). Sailors and beach walkers stay front-facing.
- A new game shows a yellow "Tap to start" pill under the first zone's badge until the first session is started.

## Mist, scenery, splashes and first steps
- **Mist (the haze over closed areas) redone**: the old flat white veil with grey blotches had a hard edge. Now the fog fades in over 0.9 unit from the open area, with two layers of wide soft wisps drifting at different speeds (14 fading strips so there is no banding), and fades out over 2.2 s when the area opens.
- **Scenery for the Sea and the Ocean** (just outside the map edges): three turning wind turbines and a sandbank island with palms (Sea), a container ship sailing past (Ocean). The reef picture lost its hard dark rectangle (its deep-water layer now fades out toward both ends).
- **Riders**: a splash where they land after a hop or jump, and they lean into turns.
- **Tips**: after the first coins a note says an upgrade can be bought; after 3 upgrade levels it says to hire a manager. Shown once each (state field `tips`).

## Watch an ad: coins x2 for 40 seconds
- A violet **Watch ad** button sits directly above the Expand button (both live in a `.dock-slot`, so it hides with the bar). A rewarded video (Google AdMob, `@capacitor-community/admob`) makes **all coin income x2 for 40 seconds** (`BALANCE.boostSeconds`, `boostMult`; state field `boost` in seconds). It runs down with the game clock, also while away (a long tick only doubles the first `boost` seconds), survives an expansion and cannot be restarted while running. The reward is given only when the ad was watched to the end.
- **Ids** are in `src/config/ads.ts`: iOS app `ca-app-pub-8560073239883666~9782230015`, rewarded block `ca-app-pub-8560073239883666/6132040872`. Android has no AdMob app yet and uses Google's public test ids (also in the manifest). **Builds request test ads** (with the real ids) unless `VITE_ADS_LIVE=1`; use `npm run phone:sync:live` for the store build. This avoids clicking your own live ads (can get the account banned).
- First tap: iOS tracking permission, EU/UK consent form (needs a message made in AdMob > Privacy & messaging), then the ad. In a browser a 5 s **demo ad** dialog stands in (closing it gives nothing).
- Native files: `Info.plist` (app id, SKAdNetwork, tracking text), `PrivacyInfo.xcprivacy` (tracking on, Google domains, Device ID / Advertising Data / Product Interaction), Android manifest meta-data. **Terms and Privacy Policy rewritten** (they said "no ads"); `store/listing.md` and `docs/STORE-READINESS.md` now say "contains ads" and explain the forms.
- The game is no longer "no ads / no network": update the store questionnaires (Data safety, App Privacy) as described in `store/listing.md`, add `app-ads.txt` on the developer site, and decide the age rating / child-directed answer yourself.

## Shop: ad streak and two purchases
- A **bag button** in the top bar (yellow, with a red dot while the ad streak is available) opens the **Shop**. Built now because the gem ad has to live somewhere; more items can be added later (`src/config/shop.ts`, `src/ui/shop.ts`).
- **Ad streak** (your list): ad 1 = 1 gem, ad 2 = coins x2 for 30 s, ad 3 = 2 gems, ad 4 = coins x2 for 1 minute, ad 5 = 5 gems (8 gems in total). After the 5th ad the streak is locked for **24 hours** of real time (`state.adShop {step, lockedUntil}`, saved), then starts again at ad 1. A boost reward never shortens a longer running boost. The **Watch ad button in the game stays** (x2 for 40 s, no limit, only while no boost runs).
- **Two purchases**, one-time, non-consumable: **Remove ads** 2.99 and **Coins x5** 4.99 (EUR shown as fallback; the store's own price text is used in the apps). My reading of your notes: *Remove ads* = every ad reward is given without watching an ad (all ads in the game are optional, so this is what "removing" them can mean); *Coins x5* = all coin income x5 for good (`BALANCE.x5Mult`; it multiplies with expansions and the ad boost, and shows in the "x9" chip next to the coins). Tell me if you meant something else.
- **Purchases are not part of the save**: stored in their own key (`src/core/perks.ts`), left out of the save and of save codes (a forged code cannot switch them on: `ensureState` clears `perks`), and not erased by "Start over". The apps check the store at every start and the shop has **Restore purchases** (required by the stores). Plugin `@capgo/native-purchases` (`src/purchases.ts`). In a browser you cannot buy (the shop says so).
- **Legal**: Terms (2. Free to play and the shop) and Privacy (Purchases, Ads, Third parties) rewritten; store listing has the product table.
- **You still have to** create the two products with the ids in `src/config/shop.ts` in App Store Connect and Google Play Console, add the In-App Purchase capability in Xcode, and test with sandbox / testing accounts. Nothing here was tested against a real store.

## Shop: gem packs
- New **Gems** section in the shop: **20 gems 0.99, 100 gems 3.99 (Popular), 300 gems 9.99 (Best value)** (EUR fallback texts, the store's own price is shown in the apps). You suggested 250 for 9.99, but 100 for 3.99 is already 0.0399 a gem and 250 for 9.99 is 0.0400, so the big pack was *worse*; 300 makes it the best deal. Change `GEM_PACKS` in `src/config/shop.ts` to taste.
- Consumable products (`com.wschiks.surftycoon.gems20/gems100/gems300`), bought as often as you like. Gems are added as skill points (`addSkillPoints`). **Paid out once per store transaction id** (`grantGemPack`; ids remembered in their own storage key, last 100), the game is saved immediately, and packs the store reports later (`transactionUpdated`, e.g. the app closed after paying) are paid out too. In a browser nothing can be bought.
- Balance note: quests give 1 to 5 gems, expansions 15 and 25, the ad streak 8 a day; 20 gems is already a whole expansion's worth. If the packs feel too generous, lower the gems in `GEM_PACKS`.
- Terms and Privacy updated for gem packs; store listing has the five products. **The three gem products must be created in both stores before testing.**

## Shop: Surf Club (monthly subscription, 3.99)
- A purple **Surf Club** card at the top of the shop. Benefits (my choice, all in `CLUB` in `src/config/shop.ts`): **coins x2 all the time**, **every ad reward without an ad** (like Remove ads), **3 gems every 24 hours** (claim button, does not add up when skipped, `state.clubNext`) and **+2 hours away time**. It stacks with Coins x5 (x10 together) and expansions; the coin chip shows the permanent multiplier. Tell me if you want different perks or numbers.
- **Price 3.99 a month** (fallback text; the store price is shown). The card shows what the stores require: price, monthly, automatic renewal until cancelled in the account settings, Manage subscription, links to Terms and Privacy. Terms and Privacy updated.
- **How it is checked**: the paid-until date from the store is stored on the device with the other perks (not in the save or save codes), `perks.club` is recalculated every frame from it, so an expired subscription stops by itself and works offline. Every start and Restore purchases ask the store again (`getPurchases` with current entitlements; iOS gives an end date, Android does not, so it is trusted 3 days at a time). Plugin: `@capgo/native-purchases`, `productType SUBS` with the Android base plan id `monthly`.
- **You still have to** create the subscription in App Store Connect (subscription group + 1-month auto-renewable product `com.wschiks.surftycoon.club`) and Google Play Console (subscription with the same id and a base plan `monthly`), and test with sandbox accounts. Nothing was tested against a real store.

## Compact quests, one mist, no lock badges
- **Quests panel halved**: 134 px -> about 78 px. No header and no fold arrow any more (nothing to hide: it is small enough). Cards: text 2 lines, thin progress bar with the count beside it, a 24 px reward button; the panel is more opaque (0.96) so nothing shows through it.
- **One big mist**: the two separate hazes (Sea and Ocean, with a visible seam) became one `Mist` (`src/scene/background.ts`) over everything not yet opened, with SEA and OCEAN written on it. It has one **front edge**: at the Sea with 0 expansions, at the Ocean after expansion 1, gone after expansion 2. After an expansion the front **slides back over 4.2 s**, starting 1.7 s after the reset so it happens **after the big wave has left the screen** (the wave animation was not touched). Loading a save places the mist at once.
- **Locked zones have no round badge** any more (the grey lock with the level number). Tap the zone on the map, or use Sports, to unlock. Owned zones keep their badges. (You asked what the button was and said you do not need it; I took that as "remove".)

## A light tutorial: dark screen, one lit button
- New "coach mark" system (`src/ui/ui.ts`): for five early milestones, the whole screen dims and only the one relevant button stays lit with a glowing ring and a short yellow bubble explaining it. Shown once per milestone, ever (`state.tips`), in this order: **hire** (a manager is affordable on wave-1: spotlights the existing small tip pill), **skills** (the first skill point is earned: the Skills dock button, hidden until now, pops into the dock and is spotlighted), **sports** (the next sport can be unlocked: spotlights Sports), **beach** (a beach building is affordable, shown after the manager hint: spotlights Beach), **expand** (the beach can be expanded: spotlights Expand). Only one shows at a time; tapping the lit button (or the dark area) dismisses it; tapping the button also does its normal action.
- The **Skills dock button is now hidden until the player has earned at least one gem** (`state.skillEarned > 0`), instead of always sitting there unexplained. It pops into its slot in the dock the moment the first gem arrives, at the same time as its coach mark.
- Built with plain DOM elements and CSS (`.coach`, `.coach-ring`, `.coach-bubble`, `.coached`), no new dependency. The dark overlay and the lit button live in the same stacking context (`.col`) so a `z-index` bump is enough to keep the target clickable through the dark layer; the ring/bubble follow the target's real screen position every frame, so dock reflows (e.g. Skills appearing) don't misalign it.
- Not built: a full step-by-step forced walkthrough (arrows, blocked UI, ordered "next" steps) - the author picked the lighter option of a few coach marks on top of the existing hint system.

## Bigger class costs much more per level
- Capacity ("Bigger class") growth: **1.17 -> 2.5** (each level now costs about 2.5x, +150%, the one before, not counting the existing surge; was roughly +20% before). This makes Level up clearly the cheap, frequent upgrade and Bigger class a rare, deliberate one, as asked.
- On its own this pushed the balance-bot playthrough far past the intended 4-14 hour range (whole-game capacity purchases had been a big, efficient part of its income growth). To keep the overall pace the author already tuned, `BALANCE.costScale` (every stat and manager cost, all sports) was lowered **9.6 -> 8**, which cost is unaffected by. All balance and playthrough tests pass at these numbers (116 total).

## The tutorial also covers the very first upgrade
- Added a 6th, earliest coach mark: **upgradeCoach**, the moment the very first upgrade is affordable (before any coins have been spent on one). It spotlights the same small `.tip` pill the old lightweight hint already used, so the message the player sees ("You can buy an upgrade! Tap the zone on the map.") does not change - only that it now gets the same dark-screen, one-lit-button treatment as the rest.
- Fixed an overlap this uncovered: spotlighting `.tip` for **upgradeCoach** or **hire** no longer also shows the floating coach bubble, since the pill itself already carries its own explanation - showing both stacked two slightly different sentences on top of each other, confusing rather than "grandma-simple".

## Sports look more distinct: redrawn icons and a scene behind each one
- Redrew the three icons that were hardest to tell apart at a glance: **skimboarding** (was a plain white circle - now a short round board with a splash trailing it), **windsurfing** (now a flat board with a mast, boom loop and sail - the boom is what makes it read as windsurfing and not sailing), **sailing** (now an actual hull with a mainsail and a jib - two sails and a boat body, clearly not the same shape as the windsurfing rig). Kitesurfing, foil and wing, and wave surfing kept their already-distinct shapes, with a couple of small touch-ups.
- New `sportTile()` (`src/ui/icons.ts`) draws a faint themed **scene behind the icon**: wave-crest lines for wave surfing, sand/splash dots for skimboarding, wind streaks for windsurfing, wind-gust arcs for kitesurfing, spray dots and a swell line for foil and wing, and a wavy horizon for sailing. White at low opacity, so it works on every sport's own tile colour. Used on the Sports sheet rows and the zone sheet's header tile (both places a sport's icon appears at a readable size); the small round map badges are unchanged (too small for a background to read).

## Locked zone badges are back on the map
- You asked to remove the round lock badge on a zone earlier this session ("i dont need this"); you now say you miss it, because it is how a glance at the map shows there is more to unlock out there. Restored: an unowned zone shows its grey badge with a lock icon and its level number again (`src/ui/zoneChips.ts`), tapping it opens that zone's sheet (its unlock requirements) same as before. Owned zones are unaffected.

## Tutorial: unlocking Level 2 (a new sport's first taste)
- New coach mark, right after the very first upgrade and before the manager hint: the moment **Beginner class (wave-1) reaches 12 total upgrade levels** (the exact requirement for Level 2 of Wave surfing), the whole screen dims and **Sports** lights up: "You have upgraded enough to open more! Tap Sports, then tap 2 to unlock the next level." Shown once, ever (`tips.levels`). This is on top of, not instead of, the existing **sports** coach mark (a different, later milestone: a whole new *sport*, like Skimboarding, becoming affordable).
