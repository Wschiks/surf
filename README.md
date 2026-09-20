# Surf Tycoon

A mobile idle tycoon about running a water-sports spot on a beach and in the sea.
Built with Phaser 4, TypeScript and Vite. The game idea lives in [docs/concept.md](docs/concept.md).

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
```

## Screenshots

With the dev server running, `node scripts/screenshots.mjs <prefix> --script scripts/shots/<file>.mjs`
takes screenshots in a 400 x 800 headless browser and saves them in `screenshots/`.

## Project layout

- `src/config/` all game data (areas, sports, levels, zones, upgrades, costs, unlock rules)
- `src/core/` game logic without any rendering (income, upgrades, unlocks, offline earnings, saving)
- `src/scene/` the Phaser map scene, camera and code-drawn art
- `src/ui/` the DOM user interface on top of the map
- `tests/` automated tests
- `PROGRESS.md` what is done and what is next, `DECISIONS.md` every choice made and why
