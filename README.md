# Surf Tycoon

A mobile idle tycoon about running a water-sports spot on a beach and in the sea.
Built with Phaser 4, TypeScript and Vite. The game idea lives in [docs/concept.md](docs/concept.md).

## How the game works

- Guests come to a zone, ride, and pay coins. Every zone is one level of one sport. Tap a zone to start a session, tap again to collect.
- You start with wave surfing. Skimboarding is unlocked with Level 2 of wave surfing. Every sport has its own way of moving (surfers catch waves, skimmers run and slide, windsurfers tack, kitesurfers jump, foilers carve, sailors race).
- Upgrade each zone: bigger class (more guests), level up (up to 1000 small steps with big bonuses at level 25, 50, 75, 100, 200, 300 and then every 100), faster sessions, and a manager who runs it by themselves (also while the game is closed, up to 8 hours).
- Beach facilities (rental shop, café, showers, lifeguard tower) boost every sport.
- Reputation comes from happy guests. New levels need coins and reputation.
- **Beach expansion:** when you own Level 4 of every sport, have enough reputation and coins, you can expand the beach. A big wave washes over the screen, everything starts over, all income is x3 and the next area opens (first the Sea with windsurfing, kitesurfing and foil and wing, then the Ocean with sailing).
- Nothing is random. There is no clock, calendar, weather or events.

## Install

```bash
npm install
```

## Run

```bash
npm run dev        # dev server on http://localhost:5173 (also reachable from your phone on the same wifi)
```

## Build and test

```bash
npm run build      # type check + production build in dist/
npm run preview    # serve the production build
npm test           # unit tests (idle maths, unlock rules, full playthrough simulation)
npm run smoke      # short browser test of the built game (run npm run build first; needs Playwright's Chromium)
```

## Screenshots

The first time, install the test browser: `npx playwright install chromium`.

With the dev server running, `node scripts/screenshots.mjs <prefix> --script scripts/shots/<file>.mjs`
takes screenshots in a 400 x 800 headless browser and saves them in `screenshots/`.

## Project layout

- `src/config/` all game data (areas, sports, levels, zones, upgrades, costs, unlock rules)
- `src/core/` game logic without any rendering (income, upgrades, unlocks, offline earnings, saving)
- `src/scene/` the Phaser map scene, camera and code-drawn art
- `src/ui/` the DOM user interface on top of the map
- `tests/` automated tests
- `PROGRESS.md` what is done and what is next, `DECISIONS.md` every choice made and why

## Phone app (Capacitor)

The web game is wrapped for phones with [Capacitor](https://capacitorjs.com). The native projects are in `ios/` and `android/`.

```bash
npm run phone:sync          # build the web game and copy it into both native projects
npm run phone:open:ios      # open in Xcode (needs a Mac with Xcode)
npm run phone:open:android  # open in Android Studio
```

The app id in `capacitor.config.ts` is a placeholder (`com.example.surftycoon`); change it before you make a store build.
Nothing has been published and no store accounts were created.
