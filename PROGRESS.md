# Progress

Start time: Mon Sep 21 01:30:26 CEST 2026 (wrap up around 07:00)

## Task list
- [x] Stage 1: the map (v0.1-map)
- [x] Stage 2: idle loop with wave surfing level 1 (v0.2-idle-loop)
- [x] Stage 3: wave surfing levels 2 to 4 (v0.3-wave-levels)
- [x] Stage 4: unlocks and skimboarding (v0.4-unlocks)
- [x] Stage 5: the Sea area (v0.5-sea)
- [x] Stage 6: the Ocean area (v0.6-ocean)
- [x] Stage 7: polish and balance (v0.7-polish)

## Blocked
Nothing yet.

## What works
- Everything in the six stages plus polish: the 10 x 10 map rotated 35 degrees, pan/pinch/wheel, overview map, haze, landmarks (rocks, reef, red lighthouse fort), the idle loop (coins, reputation, capacity/price/speed upgrades, managers, beach facilities), offline earnings with an 8 hour cap, saving, 6 sports x 4 levels with the unlock chain, kite launch area, jetty and boats, "next goal" bar, sports panel, sound with mute.
- 49 automated tests (`npm test`): idle maths, upgrade costs, offline earnings, unlock rules, saving, map view maths, number formatting and a full playthrough played by a balance bot.
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
