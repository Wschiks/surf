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
