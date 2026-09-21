import type { GuestKind } from '../config/sports';

// How riders move in a zone. Every sport has its own way of moving, so they never look alike:
// surfers paddle out and ride waves in, skimboarders run and slide, windsurfers tack in zigzags,
// kitesurfers jump, foilers carve long figure eights and sailors race around a course.
// A path returns a position inside the zone as fractions (0..1) of its width and depth.

export interface Pose {
  x: number;
  y: number;
  /** 0 to 1: how high the rider is in the air (kite jumps, board hops). */
  lift: number;
  /** Extra turn in radians (heel of a sail, a spin in the air). */
  tilt: number;
  /** Rider is on the water and leaves a wake. */
  wake: boolean;
}

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const smooth = (a: number) => a * a * (3 - 2 * a);

/**
 * Position of a rider at phase `t` (0..1 of one session). `lane` (0..1) spreads riders out so they
 * do not all take the same line.
 */
export function pose(kind: GuestKind, t: number, lane: number): Pose {
  const u = frac(t);
  switch (kind) {
    case 'surfer': {
      const x0 = 0.14 + 0.72 * lane;
      if (u < 0.3) {
        // paddle out along the back of the wave line, then turn and catch the wave
        const k = u / 0.3;
        return { x: x0 - 0.16 * (1 - k), y: 0.9 + 0.03 * Math.sin(k * 18), lift: 0, tilt: 0, wake: false };
      }
      const r = (u - 0.3) / 0.7;
      // ride toward the beach, carving from side to side, with a small hop when standing up
      return { x: x0 + 0.1 * Math.sin(r * Math.PI * 2.6), y: 0.9 - 0.78 * r, lift: Math.exp(-r * 14) * 0.5, tilt: 0, wake: true };
    }
    case 'skimmer': {
      const x0 = 0.2 + 0.6 * lane;
      if (u < 0.22) {
        // run down the wet sand with the board
        const k = u / 0.22;
        return { x: x0, y: 0.05 + 0.25 * k, lift: 0.15 * Math.sin(k * Math.PI * 6) ** 2, tilt: 0, wake: false };
      }
      // drop the board and slide out in a wide arc, then curve back toward the sand
      const r = (u - 0.22) / 0.78;
      return { x: x0 + 0.22 * Math.sin(r * TAU), y: 0.3 + 0.5 * Math.sin(r * Math.PI), lift: 0, tilt: 0, wake: true };
    }
    case 'windsurfer': {
      // tacking: straight legs across the wind, sharp turns at each end
      const w = t * 2 + lane;
      const a = Math.abs(frac(w) * 2 - 1); // 1..0..1
      const x = 0.08 + 0.84 * (1 - a);
      const y = 0.2 + 0.55 * frac(lane * 3.7) + 0.16 * (1 - Math.abs(frac(w * 0.5) * 2 - 1));
      return { x, y, lift: 0, tilt: (frac(w) < 0.5 ? 1 : -1) * 0.12, wake: true };
    }
    case 'kiter': {
      // fast runs with big jumps
      const w = t * 2 + lane;
      const jump = Math.max(0, Math.sin(TAU * (t * 3 + lane))) ** 2;
      return { x: 0.5 + 0.42 * Math.sin(TAU * w), y: 0.25 + 0.5 * frac(lane * 2.3) + 0.1 * Math.sin(TAU * w * 2), lift: jump, tilt: jump * 0.9 * Math.sin(TAU * t * 6), wake: jump < 0.15 };
    }
    case 'foiler': {
      // long, smooth figure eights, flying just above the water
      const w = t + lane;
      return { x: 0.5 + 0.4 * Math.sin(TAU * w), y: 0.28 + 0.44 * frac(lane * 1.9) + 0.22 * Math.sin(TAU * w * 2), lift: 0.22 + 0.1 * Math.sin(TAU * t * 4), tilt: 0, wake: false };
    }
    case 'sailor': {
      // race around a course, leaning over in the turns
      const w = t + lane * 0.5;
      return { x: 0.5 + 0.38 * Math.cos(TAU * w), y: 0.5 + 0.32 * Math.sin(TAU * w), lift: 0, tilt: 0.1 * Math.sin(TAU * w * 2), wake: true };
    }
    case 'walker':
      return { x: 0.5, y: 0.5, lift: 0, tilt: 0, wake: false };
  }
}

/** Fade in at the start and out at the end of a session, for sports where riders come and go. */
export function presence(kind: GuestKind, t: number): number {
  const u = frac(t);
  if (kind === 'surfer') return smooth(Math.min(1, u * 8, (1 - u) * 8));
  if (kind === 'skimmer') return smooth(Math.min(1, u * 14, (1 - u) * 14));
  return 1;
}

