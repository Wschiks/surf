import { MAP_W, type Rect } from './layout';

/** Depth of the water line: where the beach ends and the sea begins. */
export const SHORE = 1.6;

export type AreaId = 'beach' | 'wave' | 'sea' | 'ocean';

export interface AreaDef {
  id: AreaId;
  name: string;
  /** Depth range in map units (rows 1-2 = depth 0-2, and so on). */
  from: number;
  to: number;
  /** Number of beach expansions needed to open this area (0 = open from the start). */
  expansion: number;
  /** Colour used on the overview map. */
  color: string;
  blurb: string;
}

export const AREAS: AreaDef[] = [
  { id: 'beach', name: 'Beach', from: 0, to: 1.6, expansion: 0, color: '#f2dca4', blurb: 'The shared hangout' },
  { id: 'wave', name: 'Wave', from: 1.6, to: 4, expansion: 0, color: '#5fd0e6', blurb: 'Wave surfing and skimboarding' },
  { id: 'sea', name: 'Sea', from: 4, to: 6.4, expansion: 1, color: '#2b8fd0', blurb: 'Windsurfing, kitesurfing, foil and wing' },
  { id: 'ocean', name: 'Ocean', from: 6.4, to: 8, expansion: 2, color: '#12468f', blurb: 'Sailing and boats' },
];

export function areaById(id: AreaId): AreaDef {
  return AREAS.find((a) => a.id === id)!;
}

/** Full-width rectangle of an area in map units. */
export function areaRect(a: AreaDef): Rect {
  return { x: 0, y: a.from, w: MAP_W, h: a.to - a.from };
}

/** Sea colour by depth, light turquoise near the beach to dark blue far out. Stops are [depth, r, g, b]. */
export const SEA_STOPS: [number, number, number, number][] = [
  [1.6, 150, 234, 232],
  [2.8, 88, 205, 228],
  [4, 46, 158, 214],
  [5.2, 31, 122, 194],
  [6.4, 22, 86, 160],
  [8, 11, 47, 107],
  [11, 6, 30, 78],
];

export function seaColorAt(depth: number): [number, number, number] {
  const s = SEA_STOPS;
  if (depth <= s[0][0]) return [s[0][1], s[0][2], s[0][3]];
  for (let i = 1; i < s.length; i++) {
    if (depth <= s[i][0]) {
      const t = (depth - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
      return [
        Math.round(s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t),
        Math.round(s[i - 1][2] + (s[i][2] - s[i - 1][2]) * t),
        Math.round(s[i - 1][3] + (s[i][3] - s[i - 1][3]) * t),
      ];
    }
  }
  const l = s[s.length - 1];
  return [l[1], l[2], l[3]];
}

export function rgbToHex(c: [number, number, number]): number {
  return (c[0] << 16) | (c[1] << 8) | c[2];
}
