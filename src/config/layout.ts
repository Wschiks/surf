// Map geometry. The map is MAP_W x MAP_H units (15 wide, 8 deep). A phone screen is about 1 unit wide
// and 2 units high at the default zoom. World coordinates are unit * UNIT pixels.
// Map coordinates: x = column (0..15), depth = distance from the back of the beach (0 = back of beach,
// 8 = far edge of the ocean). World y = depth * UNIT, so the beach is at the top of the unrotated map.
// The map is turned 35 degrees and then flipped over, which puts the beach in the bottom left of the screen
// and the open sea toward the top right (rotation 215 = 180 + 35).

export const UNIT = 100;
export const MAP_W = 15;
export const MAP_H = 8;
export const MAP_ROTATION_DEG = 215;
/** How many map units fit across the screen width when the game starts (roughly 1 by 2 units). */
export const START_UNITS_ACROSS = 1.1;
/** Closest allowed zoom, in map units across the screen width. */
export const MIN_UNITS_ACROSS = 0.7;
/** How far the world (sea, sand) is drawn past the map edges, in units. */
export const WORLD_MARGIN = 40;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectangle in map units: x = column, y = depth. */
export function toWorld(r: Rect): Rect {
  return { x: r.x * UNIT, y: r.y * UNIT, w: r.w * UNIT, h: r.h * UNIT };
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
