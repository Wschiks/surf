// Map geometry. The map is a square of MAP_UNITS x MAP_UNITS units. A phone screen is 1 unit wide
// and 2 units high at the default zoom. World coordinates are unit * UNIT pixels.
// Map coordinates: x = column (0..10, left to right), depth = distance from the back of the beach
// (0 = back of beach, 10 = far edge of the ocean). World y = depth * UNIT, so the beach is at the top
// of the unrotated map and the whole map is then rotated MAP_ROTATION_DEG on screen.

export const UNIT = 100;
export const MAP_UNITS = 10;
export const MAP_ROTATION_DEG = 35;
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
