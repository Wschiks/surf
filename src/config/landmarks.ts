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
  { id: 'cove', texture: 'lm-cove', meaning: 'Skimboarding spot: sandy cove with clear, shallow water', at: { x: -0.45, y: 1.15 }, layer: -1 },
  { id: 'rocks', texture: 'lm-rocks', meaning: 'Skimboarding spot: large rocks, a rock arch and cliffs', at: { x: 0, y: 0.35 } },
  { id: 'reef', texture: 'lm-reef', meaning: 'Reef (wave surfing level 3): coral reef with a long, clean wave', at: { x: 9.8, y: 2.3 }, size: { w: 215, h: 150 } },
  { id: 'fort', texture: 'lm-fort', meaning: 'Nazaré (wave surfing level 4): stone fort on the cliff edge, huge waves below', at: { x: 11.65, y: 2.65 } },
  { id: 'lighthouse', texture: 'lm-lighthouse', meaning: 'Nazaré: the red lighthouse', at: { x: 15.0, y: 3.09 }, upright: true, origin: { x: 0.5, y: 0.87 }, layer: 1 },
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
  ...[0.35, 2.3, 4.6, 7.6, 9.9, 12.3, 14.5, -1.4, 16.4].map((x, i): DecorDef => ({ texture: 'deco-palm', x, y: 0.12 + (i % 2) * 0.04, w: 52 + (i % 3) * 6, h: 84 + (i % 3) * 8, upright: true })),
  ...(
    [
      [11.2, 1.2, 'a'],
      [12.1, 1.35, 'b'],
      [13.4, 1.15, 'c'],
      [2.3, 1.35, 'b'],
    ] as const
  ).flatMap(([x, y, k]): DecorDef[] => [
    { texture: 'deco-umbrella-' + k, x, y, w: 44, h: 51, upright: true },
    { texture: 'deco-towel-' + k, x: x - 0.28, y: y + 0.04, w: 46, h: 26, upright: false },
  ]),
  ...(
    [
      [3.1, 1.05],
      [9.9, 1.2],
      [13.0, 1.0],
      [0.9, 1.1],
    ] as const
  ).map(([x, y]): DecorDef => ({ texture: 'deco-star', x, y, w: 14, h: 14, upright: false })),
];

/** Trees and bushes on the land behind the beach (seen when the view reaches past the back of the map). */
export const LAND_DECOR: DecorDef[] = Array.from({ length: 52 }, (_, i): DecorDef => {
  const x = -5 + i * 0.46 + ((i * 7) % 5) * 0.06;
  const row = i % 3;
  const y = -1.55 - row * 0.55 - ((i * 13) % 4) * 0.12;
  return i % 4 === 0
    ? { texture: 'deco-bush', x, y, w: 40, h: 32, upright: true }
    : { texture: 'deco-tree', x, y: y - 0.1, w: 54 + (i % 3) * 8, h: 70 + (i % 3) * 8, upright: true };
});
