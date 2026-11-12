# Surf Tycoon

The source of truth for the game idea is `docs/concept.md` (a copy of the author's concept document, never edit it).
Sections without "(proposal)" are the author's own idea; follow them exactly.
Nothing in the game is random (two exceptions, the author's choice: the banner plane's prize and timing, and what a skin box gives), and there is no clock, calendar, weather or events (see "Parked for later"). The one use of the real date is the daily rewards calendar (the author's choice): one tile a day you play, a new calendar on the 1st of the month.

- Stack: Phaser 4 + TypeScript + Vite (npm). DOM overlay for the UI.
- All game data lives in `src/config/`. Add a sport by adding data, not code.
- Pure game logic lives in `src/core/` (no Phaser imports) and is covered by tests in `tests/`.
- See PROGRESS.md and DECISIONS.md.
