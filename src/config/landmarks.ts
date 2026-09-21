// Where the landmarks and decoration stand on the map. Positions are in map units (x = column, y = depth).
// The pictures themselves are drawn in code (src/scene/art.ts) and identified by their texture key.

export interface LandmarkDef {
  id: string;
  /** Texture key of the picture drawn in art.ts. */
  texture: string;
  /** What it stands for in the concept document. */
  meaning: string;
  at: { x: number; y: number };
  /** Draw size in world px. Defaults to the size the picture was drawn at. */
  size?: { w: number; h: number };
  /** Stand upright on the rotated map (a tall thing seen from the side) instead of lying flat on the ground. */
  upright?: boolean;
  /** Origin for upright things: fraction of the picture that sits on the given point. */
  origin?: { x: number; y: number };
  /** Draw order: negative is below the other landmarks. */
  layer?: number;
}

export const LANDMARKS: LandmarkDef[] = [
  { id: 'cove', texture: 'lm-cove', meaning: 'Skimboarding spot: sandy cove with clear, shallow water', at: { x: 0, y: 2.0 }, layer: -1 },
  { id: 'rocks', texture: 'lm-rocks', meaning: 'Skimboarding spot: large rocks, a rock arch and cliffs', at: { x: 0, y: 0.75 } },
  { id: 'reef', texture: 'lm-reef', meaning: 'Reef (wave surfing level 3): coral reef with a long, clean wave', at: { x: 3.45, y: 3.9 }, size: { w: 310, h: 110 } },
  { id: 'fort', texture: 'lm-fort', meaning: 'Nazaré (wave surfing level 4): stone fort on the cliff edge, huge waves below', at: { x: 6.2, y: 3.8 } },
  { id: 'lighthouse', texture: 'lm-lighthouse', meaning: 'Nazaré: the red lighthouse', at: { x: 9.58, y: 4.24 }, upright: true, origin: { x: 0.5, y: 0.87 }, layer: 1 },
];

export interface DecorDef {
  texture: string;
  x: number;
  y: number;
  /** Draw size in world px. */
  w: number;
  h: number;
  upright: boolean;
}

/** Palms, umbrellas, towels and starfish on the beach. Fixed positions: nothing is random. */
export const BEACH_DECOR: DecorDef[] = [
  ...[0.35, 2.1, 4.0, 6.1, 8.05, 9.7, -1.4, 11.4].map((x, i): DecorDef => ({ texture: 'deco-palm', x, y: 0.16 + (i % 2) * 0.04, w: 52 + (i % 3) * 6, h: 84 + (i % 3) * 8, upright: true })),
  ...(
    [
      [7.1, 1.55, 'a'],
      [8.0, 1.75, 'b'],
      [8.7, 1.4, 'c'],
    ] as const
  ).flatMap(([x, y, k]): DecorDef[] => [
    { texture: 'deco-umbrella-' + k, x, y, w: 44, h: 51, upright: true },
    { texture: 'deco-towel-' + k, x: x - 0.28, y: y + 0.04, w: 46, h: 26, upright: false },
  ]),
  ...(
    [
      [2.6, 0.95],
      [6.9, 1.05],
      [9.1, 0.95],
      [0.9, 1.05],
    ] as const
  ).map(([x, y]): DecorDef => ({ texture: 'deco-star', x, y, w: 14, h: 14, upright: false })),
];

/** Trees and bushes on the land behind the beach (seen when the view reaches past the back of the map). */
export const LAND_DECOR: DecorDef[] = Array.from({ length: 46 }, (_, i): DecorDef => {
  const x = -5 + i * 0.32 + ((i * 7) % 5) * 0.06;
  const row = i % 3;
  const y = -1.55 - row * 0.55 - ((i * 13) % 4) * 0.12;
  return i % 4 === 0
    ? { texture: 'deco-bush', x, y, w: 40, h: 32, upright: true }
    : { texture: 'deco-tree', x, y: y - 0.1, w: 54 + (i % 3) * 8, h: 70 + (i % 3) * 8, upright: true };
});
