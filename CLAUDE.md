# Surf Tycoon

The source of truth for the game idea is `docs/concept.md` (a copy of the author's concept document, never edit it).
Sections without "(proposal)" are the author's own idea; follow them exactly.
Nothing in the game is random, and there is no clock, calendar, weather or events (see "Parked for later").

- Stack: Phaser 4 + TypeScript + Vite (npm). DOM overlay for the UI.
- All game data lives in `src/config/`. Add a sport by adding data, not code.
- Pure game logic lives in `src/core/` (no Phaser imports) and is covered by tests in `tests/`.
- See PROGRESS.md and DECISIONS.md.
