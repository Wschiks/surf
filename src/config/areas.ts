import type { Rect } from './layout';

export type AreaId = 'beach' | 'wave' | 'sea' | 'ocean';

export interface AreaDef {
  id: AreaId;
  name: string;
  /** Depth range in map units (rows 1-2 = depth 0-2, and so on). */
  from: number;
  to: number;
  /** The sport whose unlock clears the haze on this area. null = clear from the start. */
  clearedBySport: string | null;
  /** Colour used on the overview map. */
  color: string;
  blurb: string;
}

export const AREAS: AreaDef[] = [
  { id: 'beach', name: 'Beach', from: 0, to: 2, clearedBySport: null, color: '#f2dca4', blurb: 'The shared hangout' },
  { id: 'wave', name: 'Wave', from: 2, to: 5, clearedBySport: null, color: '#5fd0e6', blurb: 'Wave surfing and skimboarding' },
  { id: 'sea', name: 'Sea', from: 5, to: 8, clearedBySport: 'windsurfing', color: '#2b8fd0', blurb: 'Windsurfing, kitesurfing, foil and wing' },
  { id: 'ocean', name: 'Ocean', from: 8, to: 10, clearedBySport: 'sailing', color: '#12468f', blurb: 'Sailing and boats' },
];

export function areaById(id: AreaId): AreaDef {
  return AREAS.find((a) => a.id === id)!;
}

/** Full-width rectangle of an area in map units. */
export function areaRect(a: AreaDef): Rect {
  return { x: 0, y: a.from, w: 10, h: a.to - a.from };
}

/** Sea colour by depth, light turquoise near the beach to dark blue far out. Stops are [depth, r, g, b]. */
export const SEA_STOPS: [number, number, number, number][] = [
  [2, 150, 234, 232],
  [3.5, 88, 205, 228],
  [5, 46, 158, 214],
  [6.5, 31, 122, 194],
  [8, 22, 86, 160],
  [10, 11, 47, 107],
  [14, 6, 30, 78],
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
