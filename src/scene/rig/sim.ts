// What the guests do in their zone, per sport (README 4: locomotion, secondary motion, state machines, particles).
// Pure TypeScript: each frame `stepGuest` moves a guest and fills in its `Look`, which the renderer only draws.
// Nothing here is random: the spread between guests comes from `hash01` (fixed per guest and per ride).

import type { GuestKind } from '../../config/sports';
import { add, angleTo, clamp, clamp01, DEG, dir, hash01, headingOf, lerp, mul, rot, shadowOffset, shiftPose, sub, TAU, v, wrap, type Pose, type V } from './geom';
import { gearFor, K, type Gear } from './models';

// ---------------------------------------------------------------- types

/** One particle to start (world coordinates, px and px/s). */
export type Fx =
  | {
      k: 'wake';
      x: number;
      y: number;
      vx: number;
      vy: number;
      rot: number;
      size: number;
    }
  | { k: 'spray'; x: number; y: number; vx: number; vy: number; size: number }
  | { k: 'ring'; x: number; y: number; size: number }
  | { k: 'vee'; x: number; y: number; rot: number };

export interface Look {
  /** World position of the model pivot, heading (0 = toward the beach, clockwise), overall scale and alpha. */
  x: number;
  y: number;
  h: number;
  scale: number;
  alpha: number;
  /** The board (or hull) in the model frame: offset, turn, scale (x for banking), alpha. */
  board: { at: V; rot: number; sx: number; sy: number; alpha: number };
  rider: Pose | null;
  riderAlpha: number;
  riderScale: number;
  /** Signed angle of the sail/boom from the centreline toward the stern (+ = starboard), radians. */
  rig: number;
  rigAlpha: number;
  rigScale: number;
  /** 0..1 how much the sail flaps. */
  luff: number;
  /** Wing: where the grip is (model frame), its turn and size, mirrored or not. */
  wing: {
    at: V;
    rot: number;
    scale: number;
    flip: boolean;
    alpha?: number;
  } | null;
  /** Kite in the world: centre, turn (its -y points away from the rider), size, how high it flies (0..1), lines alpha. */
  kite: {
    x: number;
    y: number;
    rot: number;
    scale: number;
    alt: number;
    lines?: number;
  } | null;
  /** More people on board (crew of a catamaran or a yacht), model frame. */
  crew: Pose[];
  /** Spinnaker of a yacht (model frame). */
  spin: {
    at: V;
    rot: number;
    scale: number;
    alpha: number;
    flip: boolean;
  } | null;
  /** Tow rope from the front hand to this world point (Nazaré jet ski). */
  tow: V | null;
  /** 0 = on the water, 1 = flying (the shadow moves away). */
  lift: number;
  /** Extra shadow offset in model px (hiking sailors heel the boat). */
  heel: number;
  /** Kite rider: the bar (model frame) and its angle; the lines go from the kite tips to the bar ends. */
  bar: { at: V; rot: number } | null;
}

/** A breaking wave (Reef, Nazaré): the crest line along the zone, and the peel point where it is breaking. */
export interface Wave {
  n: number;
  /** World y of the crest; the face is on the beach side (toward -y). */
  y: number;
  /** World x of the peel point (the curl); `dir` is the way it peels (+1 = toward +x). */
  px: number;
  dir: number;
  age: number;
  /** Seconds before it starts to break. */
  start: number;
  /** Depth of the face (px) and the peel speed (px/s). */
  face: number;
  peel: number;
  /** 1 while it peels, fading to 0 when it has run out of zone. */
  life: number;
}

export interface Guest {
  i: number;
  kind: GuestKind | 'jetski' | 'committee';
  x: number;
  y: number;
  /** Heading of the board. */
  h: number;
  speed: number;
  /** Current turn rate, radians per second. */
  turn: number;
  state: string;
  /** Seconds in the current state. */
  st: number;
  /** Length of the current state (when it has one). */
  dur: number;
  /** Rides, tacks or runs done: picks the next fixed variation. */
  count: number;
  /** Mirrored (switch stance, the other tack). */
  mirror: boolean;
  /** 0..1, keeps the loops of different guests out of step. */
  phase: number;
  /** Distance since the last wake mark. */
  odo: number;
  /** Small per-sport numbers. */
  m: Record<string, number>;
  /** The section's gear (board, sail size, boat ...). */
  gear: Gear;
  look: Look;
}

export interface Zone {
  /** The zone rectangle in world px (the beach is toward -y). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 1 to 4. */
  level: number;
  /** A session is running (or a manager runs it): the guests do their sport. Otherwise they wait. */
  active: boolean;
  /** Seconds since the start. */
  t: number;
  /** Where the wind comes from (a heading). */
  windFrom: number;
  guests: Guest[];
  /** Particles to start this frame. */
  fx: Fx[];
  /** Race marks (sailing), world px. */
  marks: V[];
  /** Things on the water to sail around (the ocean racer), world px. */
  obstacles?: { x: number; y: number; r: number }[];
  /** Helpers of the section (the Nazaré jet skis, the committee boat): they move like guests. */
  extras: Guest[];
  /** Zone-wide state of the section (the race clock ...). */
  s: Record<string, number>;
  /** The breaking waves (Reef, Nazaré). */
  waves?: Wave[];
  /** Yellow race buoys (slalom), world px. */
  buoys?: V[];
}

/** The world direction that points up on the screen (upright pictures stand that way). */
export function screenUp(): V {
  const o = shadowOffset(0, -1, 1);
  return o;
}

/** One fixed wind for the whole sea: from the open sea, a little from the right (onshore - cross-shore). */
export const WIND_FROM = Math.PI - 14 * DEG;

// ---------------------------------------------------------------- shared helpers

export function emptyLook(): Look {
  return {
    x: 0,
    y: 0,
    h: 0,
    scale: 1,
    alpha: 1,
    board: { at: v(0, 0), rot: 0, sx: 1, sy: 1, alpha: 1 },
    rider: null,
    riderAlpha: 1,
    riderScale: 1,
    rig: 0,
    rigAlpha: 1,
    rigScale: 1,
    luff: 0,
    wing: null,
    kite: null,
    lift: 0,
    heel: 0,
    bar: null,
    crew: [],
    spin: null,
    tow: null,
  };
}

export function newGuest(kind: GuestKind, i: number, z: Zone, n: number): Guest {
  const g: Guest = {
    i,
    kind,
    x: 0,
    y: 0,
    h: 0,
    speed: 0,
    turn: 0,
    state: 'idle',
    st: 0,
    dur: 0,
    count: 0,
    mirror: i % 2 === 1,
    phase: hash01(i, 7),
    odo: 0,
    m: {},
    gear: gearFor(kind, z.level, i),
    look: emptyLook(),
  };
  const home = homeSpot(kind, i, n, z);
  g.x = home.x;
  g.y = home.y;
  g.h = startHeading(kind, z);
  return g;
}

/** The point in the model frame turned into world px. */
export function toWorld(g: Guest, p: V, scale = 1): V {
  const q = rot(mul(p, K * scale), g.look.h);
  return { x: g.look.x + q.x, y: g.look.y + q.y };
}

export function setState(g: Guest, s: string, dur = 0) {
  g.state = s;
  g.st = 0;
  g.dur = dur;
}

/** Turn toward a heading, never faster than `maxTurn` (radians per second). */
export function steer(g: Guest, target: number, maxTurn: number, dt: number, gain = 3) {
  const want = clamp(angleTo(g.h, target) * gain, -maxTurn, maxTurn);
  g.turn += (want - g.turn) * Math.min(1, dt * 8);
  g.h = wrap(g.h + g.turn * dt);
}

export function ease(g: Guest, target: number, accel: number, dt: number) {
  g.speed += (target - g.speed) * Math.min(1, dt * accel);
}

export function move(g: Guest, dt: number) {
  const d = dir(g.h);
  g.x += d.x * g.speed * dt;
  g.y += d.y * g.speed * dt;
  g.odo += Math.abs(g.speed) * dt;
}

/** Heading toward a point, bent away from other guests that are too close and from the zone edges. */
export function headingTo(g: Guest, z: Zone, tx: number, ty: number, keep: number): number {
  let dx = tx - g.x;
  let dy = ty - g.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  let px = 0;
  let py = 0;
  const fwd = dir(g.h);
  for (const o of z.guests) {
    if (o === g) continue;
    const ox = g.x - o.x;
    const oy = g.y - o.y;
    const od = Math.hypot(ox, oy);
    if (od > 0 && od < keep) {
      // stronger for someone ahead (about to be run into) than for someone behind
      const ahead = -(ox * fwd.x + oy * fwd.y) > 0 ? 1.6 : 0.7;
      const w = ((keep - od) / keep) ** 2 * 2.4 * ahead;
      px += (ox / od) * w;
      py += (oy / od) * w;
    }
  }
  for (const o of z.obstacles ?? []) {
    const ox = g.x - o.x;
    const oy = g.y - o.y;
    const od = Math.hypot(ox, oy);
    const reach = o.r + keep * 0.6;
    if (od > 0 && od < reach) {
      const w = ((reach - od) / reach) * 3;
      px += (ox / od) * w;
      py += (oy / od) * w;
    }
  }
  const m = 14;
  if (g.x < z.x + m) px += (z.x + m - g.x) / m;
  if (g.x > z.x + z.w - m) px -= (g.x - (z.x + z.w - m)) / m;
  if (g.y < z.y + m) py += (z.y + m - g.y) / m;
  if (g.y > z.y + z.h - m) py -= (g.y - (z.y + z.h - m)) / m;
  return headingOf(v(dx + px * 1.4, dy + py * 1.4));
}

/** How close two guests of a sport may come (world px): boards and sails never overlap. */
export const SPACE: Record<GuestKind, number> = {
  surfer: 22,
  skimmer: 15,
  windsurfer: 34,
  kiter: 24,
  foiler: 30,
  sailor: 56,
  walker: 8,
};

/** Push guests that came too close apart (half the overlap each), so boards never sit on top of each other. */
export function relax(z: Zone, kind: GuestKind) {
  const min = SPACE[kind];
  const gs = z.guests;
  for (const o of z.obstacles ?? []) {
    for (const g of gs) {
      const dx = g.x - o.x;
      const dy = g.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const r = o.r + min * 0.5;
      if (d < r) {
        g.x = o.x + (dx / d) * r;
        g.y = o.y + (dy / d) * r;
      }
    }
  }
  for (let a = 0; a < gs.length; a++) {
    for (let b = a + 1; b < gs.length; b++) {
      const A = gs[a];
      const B = gs[b];
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2 / d;
      A.x -= dx * push;
      A.y -= dy * push;
      B.x += dx * push;
      B.y += dy * push;
    }
  }
}

/** Keep a guest inside its zone. */
export function keepIn(g: Guest, z: Zone, pad: number) {
  g.x = clamp(g.x, z.x + pad, z.x + z.w - pad);
  g.y = clamp(g.y, z.y + pad, z.y + z.h - pad);
}

/** Wake marks from the model's wake points, one pair every `every` px travelled. */
export function wake(g: Guest, z: Zone, points: V[], every: number, size = 1) {
  if (g.odo < every) return;
  g.odo = 0;
  const side = rot(v(1, 0), g.h);
  points.forEach((p, k) => {
    const w = toWorld(g, p);
    const s = k === 0 ? -1 : 1;
    z.fx.push({
      k: 'wake',
      x: w.x,
      y: w.y,
      vx: side.x * s * 5,
      vy: side.y * s * 5,
      rot: g.h + s * 0.35,
      size,
    });
  });
}

/** Spray off a rail or tail: `amount` drops per second, thrown sideways (`side` -1 / 1, 0 = both). */
export function spray(g: Guest, z: Zone, at: V, amount: number, side: number, dt: number, speed = 26) {
  const n = amount * dt;
  const whole = Math.floor(n) + (hash01(g.i, Math.floor(z.t * 60), 3) < n - Math.floor(n) ? 1 : 0);
  for (let k = 0; k < whole; k++) {
    const r1 = hash01(g.i, Math.floor(z.t * 997) + k, 11);
    const r2 = hash01(g.i, Math.floor(z.t * 991) + k, 13);
    const s = side === 0 ? (r1 < 0.5 ? -1 : 1) : side;
    const out = rot(v(s, 0.35 + r2 * 0.5), g.h);
    const w = toWorld(g, at);
    z.fx.push({
      k: 'spray',
      x: w.x,
      y: w.y,
      vx: out.x * speed * (0.7 + r2 * 0.6),
      vy: out.y * speed * (0.7 + r2 * 0.6),
      size: 0.6 + r1 * 0.5,
    });
  }
}

export function ring(g: Guest, z: Zone, at: V, size = 1) {
  const w = toWorld(g, at);
  z.fx.push({ k: 'ring', x: w.x, y: w.y, size });
}

/** Lean into turns (4.2): a few px toward the inside of the turn. */
export function leanOf(g: Guest) {
  return clamp(g.turn * g.speed * 0.32, -8, 8);
}

/** Breathing, balance sway and lean: the secondary motion of a standing rider (4.3). */
export function alive(p: Pose, g: Guest, t: number, lean: number, sway = 1): Pose {
  const ph = g.phase * TAU;
  const b = 1 + 0.02 * Math.sin(TAU * 0.5 * t + ph);
  const s = 3 * sway * Math.sin(TAU * 0.9 * t + ph);
  const q = shiftPose(p, v(lean, 0));
  return {
    ...q,
    rx: q.rx * b,
    ry: q.ry * b,
    hips: add(q.hips, v(-lean * 0.5, 0)),
    feet: p.feet,
    hands: [add(q.hands[0], v(lean > 0 ? 0 : -lean * 0.5, s - Math.max(0, lean) * 0.4)), add(q.hands[1], v(lean < 0 ? 0 : lean * 0.5, -s + Math.min(0, lean) * 0.4))],
  };
}

/** The water bob (4.3): everything on the water rocks a little. */
export function bob(g: Guest, t: number) {
  return 1.5 * DEG * Math.sin(TAU * 0.4 * t + g.phase * TAU);
}

/** Which side the wind hits, in the model frame: +1 = from starboard, -1 = from port. */
export function windSide(h: number, windFrom: number): number {
  const w = dir(windFrom);
  const right = rot(v(1, 0), h);
  return w.x * right.x + w.y * right.y >= 0 ? 1 : -1;
}

/** Point of sail: 0 = dead downwind, PI = straight into the wind. */
export function pointOfSail(h: number, windFrom: number) {
  return Math.abs(angleTo(windFrom + Math.PI, h));
}

export function baseLook(g: Guest, t: number, onWater = true) {
  const L = g.look;
  L.x = g.x;
  L.y = g.y;
  L.h = g.h + (onWater ? bob(g, t) : 0);
  L.scale = 1;
  L.alpha = 1;
  L.board.at = v(0, 0);
  L.board.rot = 0;
  L.board.sx = 1;
  L.board.sy = 1;
  L.board.alpha = 1;
  L.riderAlpha = 1;
  L.riderScale = 1;
  L.rigAlpha = 1;
  L.rigScale = 1;
  L.luff = 0;
  L.lift = 0;
  L.heel = 0;
  L.wing = null;
  L.kite = null;
  L.bar = null;
  L.crew.length = 0;
  L.spin = null;
  L.tow = null;
  return L;
}

/** Where a guest waits while the zone is idle, and where it starts. */
export function homeSpot(kind: GuestKind, i: number, n: number, z: Zone): V {
  const across = (i + 0.5) / Math.max(1, n);
  switch (kind) {
    case 'surfer':
      return v(z.x + z.w * (0.07 + 0.86 * across), z.y + z.h * (0.74 + 0.1 * (i % 2)));
    case 'skimmer':
      return v(z.x + z.w * (0.08 + 0.84 * across), z.y + z.h * (0.12 + 0.06 * (i % 2)));
    case 'sailor':
      return v(z.x + z.w * (0.12 + 0.76 * across), z.y + z.h * (0.3 + 0.4 * (i % 2)));
    default:
      return v(z.x + z.w * (0.1 + 0.8 * across), z.y + z.h * (0.32 + 0.36 * ((i * 0.618) % 1)));
  }
}

export function startHeading(kind: GuestKind, z: Zone): number {
  if (kind === 'surfer') return Math.PI;
  if (kind === 'skimmer') return Math.PI;
  return z.windFrom; // head to wind, sails flapping
}

/** World point of a model-frame point (before the look is filled in). */
export function toWorldAt(g: Guest, p: V): V {
  const q = rot(mul(p, K), g.h);
  return { x: g.x + q.x, y: g.y + q.y };
}

export function fromWorldAt(g: Guest, w: V): V {
  return mul(rot(sub(w, v(g.x, g.y)), -g.h), 1 / K);
}

// ---------------------------------------------------------------- the sail of a windsurfer or a dinghy

/** How far the sail is let out for a point of sail (wider when sailing downwind). */
export function sheetAngle(pos: number, close: number, open: number) {
  return lerp(open, close, clamp01(pos / (135 * DEG)));
}

/** Where a point drawn with the sail at `drawn` ends up with the sail at the signed angle `a` (around the pivot). */
export function rigPoint(p: V, drawn: number, a: number): V {
  const side = a < 0 ? -1 : 1;
  const q = side < 0 ? v(-p.x, p.y) : p;
  return rot(q, side * (drawn - Math.abs(a)));
}
