# Progress

Start time: Mon Sep 21 01:30:26 CEST 2026 (wrap up around 07:00)
All seven stages finished, tagged and pushed by about 02:40 (roughly 70 minutes of work); the rest of the time budget was left unused on purpose because everything on the list was done and checked.

## Task list
- [x] Stage 1: the map (v0.1-map)
- [x] Stage 2: idle loop with wave surfing level 1 (v0.2-idle-loop)
- [x] Stage 3: wave surfing levels 2 to 4 (v0.3-wave-levels)
- [x] Stage 4: unlocks and skimboarding (v0.4-unlocks)
- [x] Stage 5: the Sea area (v0.5-sea)
- [x] Stage 6: the Ocean area (v0.6-ocean)
- [x] Stage 7: polish and balance (v0.7-polish)

## Blocked
Nothing was blocked.

## What works
- Everything in the six stages plus polish: the 10 x 10 map rotated 35 degrees, pan/pinch/wheel, overview map, haze, landmarks (rocks, reef, red lighthouse fort), the idle loop (coins, reputation, capacity/price/speed upgrades, managers, beach facilities), offline earnings with an 8 hour cap, saving, 6 sports x 4 levels with the unlock chain, kite launch area, jetty and boats, "next goal" bar, sports panel, sound with mute.
- 56 automated tests (`npm test`): idle maths, upgrade costs, offline earnings, unlock rules, saving, map view maths, layout data, number formatting and a full playthrough played by a balance bot. `npm run smoke` is a short browser test of the built game.
- Runs in a headless browser at 400 x 800 (screenshots in `screenshots/`); gestures, a real play session and the offline popup were checked with Playwright scripts in `scripts/shots/`.
- iOS and Android projects exist (Capacitor). Not built natively here.

## What does not work / not done
- Not tested on a real phone or in a native build. Only tested in headless Chromium (software WebGL, about 35-45 fps there).
- No prestige, clock, calendar, weather or events (by design). Boats are decoration only.
- Sound is basic beeps. Art is simple vector art.

## How to run
`npm install`, `npm run dev` (http://localhost:5173), `npm test`, `npm run build`. See README.md.

## What to do next
- Play it and tell me how the pace feels (`src/config/balance.ts` and the numbers in `src/config/sports.ts`; `npx tsx scripts/simulate.ts 40 5` prints a whole playthrough).
- Test on a real phone (pinch, safe areas, performance), then `npm run phone:sync` and open the native projects.
- Real art (or better vector art), real app icon and splash screen, and a real app id before any store build.
- Ideas: boats as a real upgrade in the Ocean area, achievements, a prestige system, then the parked ideas (clock, weather, events).

## Tags
`v0.1-map`, `v0.2-idle-loop`, `v0.3-wave-levels`, `v0.4-unlocks`, `v0.5-sea`, `v0.6-ocean`, `v0.7-polish` (the last one is the final commit).

## Second round (review changes)
Done: 15 x 8 map with the beach bottom left, start with surfers and skimboarders, beach expansions (x3 income, start over, big wave, next area opens) replacing the sport chain, per-sport motion, coloured buttons, 100B coins test button. Tests updated (58 passing). Old screenshots (`final-`, `redesign-`) show earlier designs; `redesign2-` shows the new one.

## App store readiness
Done: cheat button removed, version 1.0.0, icons/splash, native settings, privacy manifest, legal pages, store texts and screenshots, `npm run store:check`. To do (owner): publisher contact details, app id, accounts, hosting the privacy page, signing and builds, real-device tests. See docs/STORE-READINESS.md.

## Watch an ad (coins x2 for 40 s)
Done: Watch ad button above Expand, AdMob rewarded video (`src/ads.ts`, ids in `src/config/ads.ts`), `boost` state with tests (103 passing), demo ad in the browser, iOS/Android native setup, Terms/Privacy and store texts updated. Not tested on a real device: the AdMob SDK only runs in the phone apps. Owner to do: Android app in AdMob (ids), consent message in AdMob, `app-ads.txt`, use `npm run phone:sync:live` for store builds. See DECISIONS.md.

## Shop
Done: bag button and Shop dialog, 5-ad daily streak (1 gem, x2 30 s, 2 gems, x2 1 min, 5 gems; locked 24 h), Remove ads and Coins x5 as one-time purchases (`@capgo/native-purchases`), perks kept apart from the save, Restore purchases, Terms/Privacy/store texts, 109 tests. Not tested against the real stores: create the two products first (see `store/listing.md`).

Shop expanded with gem packs (20/100/300 gems), 112 tests.

Surf Club subscription (3.99 a month: x2 coins, ads free, 3 gems a day, +2 h away) added to the shop, 116 tests.
Compact quests panel, single mist that slides back after the wave, no lock badges.
Bigger class costs 2.5x per level (was 1.17x); costScale 9.6 -> 8 to keep overall pace. Light tutorial: dark screen + one lit button for 5 early milestones (manager, skills, next sport, beach building, expand).
Sport tiles redrawn (skim/windsurf/sail were too similar) with a faint themed scene behind each icon, so the six sports read apart at a glance.
App icon (not splash) replaced with the author's own artwork, processed into a real full-bleed opaque source and rendered to every store/native size by a new script.
Welcome-back dialog: watch-ad x2 / gems x3 boosts on offline earnings, X-only close, no Continue button. Ad streak's last reward 5 -> 3 gems.
