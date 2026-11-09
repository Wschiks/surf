import { MAP_ROTATION_DEG } from '../../config/layout';

// The guest models (docs/models/README.md, the author's spec; never edit it). Pure maths, no Phaser: points, angles,
// easing, the rider pose and the palette. Model coordinates are "spec px": 1 px is about 0.8 cm, the model's pivot is
// the board (or hull) centre, its heading is -y (up) and +x is starboard.

export interface V {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const v = (x: number, y: number): V => ({ x, y });
export const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k });
export const len = (a: V) => Math.hypot(a.x, a.y);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerpV = (a: V, b: V, k: number): V => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
});
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);

/** Rotate a point clockwise on screen (y grows downward) by `a` radians. */
export function rot(p: V, a: number): V {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** An angle wrapped to (-PI, PI]. */
export function wrap(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** The shortest turn from angle `a` to angle `b`. */
export const angleTo = (a: number, b: number) => wrap(b - a);
export const lerpAngle = (a: number, b: number, k: number) => a + angleTo(a, b) * k;

/** Heading (0 = up / toward the beach, clockwise) as a unit vector, and back. */
export const dir = (h: number): V => ({ x: Math.sin(h), y: -Math.cos(h) });
export const headingOf = (d: V) => Math.atan2(d.x, -d.y);

export const smooth = (k: number) => {
  k = clamp01(k);
  return k * k * (3 - 2 * k);
};
export const easeInOutSine = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k));
export function easeOutBack(k: number) {
  k = clamp01(k);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

/**
 * A fixed number between 0 and 1 for a guest and a counter (its ride, its tack ...). Nothing in the game is random:
 * this only spreads the guests' timing so they never move in step, and it is the same every time.
 */
export function hash01(a: number, b = 0, c = 0): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- light (README 1.3)

const MAP_ROT = (MAP_ROTATION_DEG * Math.PI) / 180;

/**
 * One light for the whole map: shadows fall down-right on screen, whatever the map rotation or the guest's heading.
 * This turns a screen offset (spec px) into a world offset (world px, `k` world px per spec px).
 */
export function shadowOffset(sx: number, sy: number, k = 0.125): V {
  const c = Math.cos(MAP_ROT);
  const s = Math.sin(MAP_ROT);
  return { x: (sx * c + sy * s) * k, y: (-sx * s + sy * c) * k };
}

// ---------------------------------------------------------------- palette (README 1.4)

export const PAL = {
  foam: 0xffffff,
  shadow: 0x0e4a5c,
  navy: 0x2a3a4c,
  metal: 0x46525e,
  black: 0x1b1f24,
  line: 0x3b4651,
};

export const SKINS = ['#F6D2B0', '#F3C9A2', '#E3AE84', '#B97C55', '#7A4A2E'];
export const HAIRS = ['#3D2B1A', '#1C1715', '#D9A441', '#A0522D', '#8C8C8C'];

export function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** A colour made darker (k < 0) or lighter (k > 0), as a number for tinting. */
export function shade(hex: string | number, k: number): number {
  const n = typeof hex === 'number' ? hex : hexToNum(hex);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k));
  return (ch[0] << 16) | (ch[1] << 8) | ch[2];
}

/** Hair styles drawn with the hair cap. */
export type HairStyle = 'short' | 'ponytail' | 'bun' | 'curls';
export const HAIR_STYLES: HairStyle[] = ['short', 'ponytail', 'short', 'bun', 'curls'];

/** How one guest looks: skin, hair and the colours of the outfit (README 1.5: the outfit shows the level). */
export interface Outfit {
  skin: number;
  skinShade: number;
  hair: number;
  style: HairStyle;
  /** Torso fill (its edge is the same colour, darker). */
  top: number;
  legs: number;
  /** Accent stripe over the shoulders (levels 3 and 4), or -1. */
  stripe: number;
  /** Navy strap lines of a beginner's foam vest. */
  straps: boolean;
  /** A chunkier torso (foam vest). */
  bulk: number;
  /** A white helmet instead of hair (big wave surfers). */
  helmet: boolean;
  accent: number;
}

/** The outfit of guest `i` in a zone of level 1 to 4, in the sport's colour `accent`. */
export function outfit(i: number, level: number, accent: string, opts: { vest?: string; helmet?: boolean } = {}): Outfit {
  const skinHex = SKINS[(i * 3 + level) % SKINS.length];
  const a = hexToNum(accent);
  const vest = opts.vest ? hexToNum(opts.vest) : a;
  const base = {
    skin: hexToNum(skinHex),
    skinShade: shade(skinHex, -0.08),
    hair: hexToNum(HAIRS[(i * 2 + level * 3) % HAIRS.length]),
    style: HAIR_STYLES[(i + level) % HAIR_STYLES.length],
    accent: a,
    helmet: false,
  };
  switch (level) {
    case 1:
      return {
        ...base,
        top: vest,
        legs: PAL.navy,
        stripe: -1,
        straps: true,
        bulk: 1.12,
      };
    case 2:
      return {
        ...base,
        top: vest,
        legs: PAL.navy,
        stripe: -1,
        straps: false,
        bulk: 1,
      };
    case 3:
      return {
        ...base,
        top: opts.vest ? vest : PAL.navy,
        legs: PAL.navy,
        stripe: opts.vest ? -1 : a,
        straps: false,
        bulk: 1,
      };
    default:
      return {
        ...base,
        top: opts.vest ? vest : PAL.black,
        legs: PAL.black,
        stripe: opts.vest ? -1 : a,
        straps: false,
        bulk: 1,
        helmet: !!opts.helmet,
      };
  }
}

// ---------------------------------------------------------------- the rider pose (README 2)

export interface Pose {
  /** Torso centre. */
  t: V;
  /** Torso rotation (radians, clockwise). */
  rot: number;
  /** Torso half sizes before the rotation (15 x 26 sideways, 28 x 14 forward). */
  rx: number;
  ry: number;
  /** Unit vector the rider looks toward. */
  face: V;
  hips: V;
  /** Front and back foot. */
  feet: [V, V];
  /** Front and back hand. */
  hands: [V, V];
  /** 0..1: how much of the legs and feet show (0 = hidden under the torso). */
  legs: number;
  /** Where the legs start: hips + spread (front leg) and hips - spread (back leg). */
  legSpread: V;
  /** Width of the legs. */
  legW: number;
  /** Foot size (half sizes; the long axis points where the rider looks). */
  foot: V;
  /** 0..1 lower body of a rider lying on the board. */
  body: number;
  /** How far the head sits from the torso centre, toward the face. */
  neck: number;
}

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const face = lerpV(a.face, b.face, k);
  const fl = len(face) || 1;
  return {
    t: lerpV(a.t, b.t, k),
    rot: lerpAngle(a.rot, b.rot, k),
    rx: lerp(a.rx, b.rx, k),
    ry: lerp(a.ry, b.ry, k),
    face: mul(face, 1 / fl),
    hips: lerpV(a.hips, b.hips, k),
    feet: [lerpV(a.feet[0], b.feet[0], k), lerpV(a.feet[1], b.feet[1], k)],
    hands: [lerpV(a.hands[0], b.hands[0], k), lerpV(a.hands[1], b.hands[1], k)],
    legs: lerp(a.legs, b.legs, k),
    legSpread: lerpV(a.legSpread, b.legSpread, k),
    legW: lerp(a.legW, b.legW, k),
    foot: lerpV(a.foot, b.foot, k),
    body: lerp(a.body, b.body, k),
    neck: lerp(a.neck, b.neck, k),
  };
}

/** The same pose seen in a mirror (x -> -x): switch stance, the other tack. */
export function mirrorPose(p: Pose): Pose {
  const m = (q: V): V => ({ x: -q.x, y: q.y });
  return {
    ...p,
    t: m(p.t),
    rot: -p.rot,
    face: m(p.face),
    hips: m(p.hips),
    legSpread: m(p.legSpread),
    feet: [m(p.feet[0]), m(p.feet[1])],
    hands: [m(p.hands[0]), m(p.hands[1])],
  };
}

/** Move a whole pose. */
export function shiftPose(p: Pose, d: V): Pose {
  return {
    ...p,
    t: add(p.t, d),
    hips: add(p.hips, d),
    feet: [add(p.feet[0], d), add(p.feet[1], d)],
    hands: [add(p.hands[0], d), add(p.hands[1], d)],
  };
}

/** Turn a whole pose around a point. */
export function turnPose(p: Pose, a: number, about: V = p.t): Pose {
  const r = (q: V) => add(about, rot(sub(q, about), a));
  return {
    ...p,
    t: r(p.t),
    rot: p.rot + a,
    face: rot(p.face, a),
    hips: r(p.hips),
    legSpread: rot(p.legSpread, a),
    feet: [r(p.feet[0]), r(p.feet[1])],
    hands: [r(p.hands[0]), r(p.hands[1])],
  };
}

/** A standing rider: torso, feet and hands as given; everything else from the README defaults. */
export function pose(t: V, feet: [V, V], hands: [V, V], o: Partial<Pose> = {}): Pose {
  return {
    t,
    rot: 0,
    rx: 15,
    ry: 26,
    face: v(1, 0),
    hips: t,
    feet,
    hands,
    legs: 1,
    legSpread: v(0, 0),
    legW: 12,
    foot: v(8, 6),
    body: 0,
    neck: 6,
    ...o,
  };
}

/** The shoulder points: 22 px both ways along the torso's long axis. */
export function shoulders(p: Pose): [V, V] {
  const along = p.rx > p.ry ? v(1, 0) : v(0, 1);
  const s = rot(along, p.rot);
  const reach = Math.min(22, Math.max(p.rx, p.ry) * 0.9);
  return [add(p.t, mul(s, reach)), add(p.t, mul(s, -reach))];
}

/** Which shoulder each hand belongs to: the pairing with the shortest arms. */
export function arms(p: Pose): [[V, V], [V, V]] {
  const [s1, s2] = shoulders(p);
  const [h1, h2] = p.hands;
  const a = len(sub(h1, s1)) + len(sub(h2, s2));
  const b = len(sub(h1, s2)) + len(sub(h2, s1));
  return a <= b
    ? [
        [s1, h1],
        [s2, h2],
      ]
    : [
        [s2, h1],
        [s1, h2],
      ];
}

/** Head centre (skin) and hair-cap centre: the hair sits back, the skin crescent left over is the face. */
export function head(p: Pose): { skin: V; hair: V } {
  const skin = add(p.t, mul(p.face, p.neck));
  return { skin, hair: add(skin, mul(p.face, -4)) };
}
