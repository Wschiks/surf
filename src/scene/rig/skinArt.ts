// The look of every skin: a pattern in its colours, clipped to the shape of its section's main gear (the board, the
// sail, the kite or the wing). Plain canvas drawing, used both for the game texture and the collection screen.

import type { SkinDef } from '../../config/skins';
import { GEAR_PATHS, PATHS } from './models';

/** The gear a skin goes on: its outline and its bounds (spec px, the pivot of the gear picture is 0,0). */
export interface SkinShape {
  path: string;
  /** Shift of the path inside the frame (the wing is drawn around its grip). */
  dy: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CIRCLE = 'M0,-35 A35,35 0 1 1 0,35 A35,35 0 1 1 0,-35 Z';

/** The shape of the gear a section's skin goes on (the same bounds as that gear's picture in the atlas). */
export function skinShape(sport: string, level: number): SkinShape {
  switch (sport) {
    case 'wave':
      return [
        { path: GEAR_PATHS.soft, dy: 0, x0: -42, y0: -112, x1: 42, y1: 110 },
        { path: GEAR_PATHS.long, dy: 0, x0: -40, y0: -152, x1: 40, y1: 150 },
        { path: PATHS.surf, dy: 0, x0: -34, y0: -125, x1: 34, y1: 168 },
        { path: GEAR_PATHS.gun, dy: 0, x0: -31, y0: -154, x1: 31, y1: 154 },
      ][level - 1];
    case 'skimboarding':
      return [
        { path: CIRCLE, dy: 0, x0: -40, y0: -40, x1: 40, y1: 40 },
        { path: GEAR_PATHS.skimSmall, dy: 0, x0: -30, y0: -64, x1: 30, y1: 64 },
        { path: PATHS.skim, dy: 0, x0: -37, y0: -82, x1: 37, y1: 82 },
        { path: PATHS.skim, dy: 0, x0: -37, y0: -82, x1: 37, y1: 82 },
      ][level - 1];
    case 'windsurfing':
      return { path: PATHS.wsail, dy: 0, x0: -4, y0: -4, x1: 176, y1: 205 };
    case 'kitesurfing':
      return { path: PATHS.kite, dy: 0, x0: -124, y0: -80, x1: 124, y1: 62 };
    case 'foil':
      return { path: PATHS.wing, dy: -80, x0: -126, y0: -86, x1: 126, y1: 30 };
    default:
      return { path: PATHS.dsail, dy: 0, x0: -2, y0: -1, x1: 120, y1: 196 };
  }
}

type Ctx = CanvasRenderingContext2D;

function darker(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - k)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** The edge colour of a skin as a number (a golden rim on the cosmic and pirate skins, else the base colour darker). */
export function skinEdge(skin: SkinDef): number {
  if (isFigure(skin)) return 0xffffff;
  const gold = skin.rarity === 'legendary';
  const n = parseInt((gold ? rimColor(skin) : skin.colors[0]).slice(1), 16);
  const k = gold ? 1 : 0.65;
  return (Math.round(((n >> 16) & 255) * k) << 16) | (Math.round(((n >> 8) & 255) * k) << 8) | Math.round((n & 255) * k);
}

/** The golden rim of a Legendary (the design's own gold when it has one). */
function rimColor(skin: SkinDef): string {
  return skin.pattern === 'cosmic' || skin.pattern === 'pirate' ? skin.colors[2] : '#ffc83d';
}

/** A fixed number 0..1 for a skin and an index (the patterns look the same every time). */
function h(seed: number, i: number): number {
  let x = Math.imul(seed ^ (i * 0x9e3779b9), 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** The middle line of a gear along its long side, measured once per shape: where it runs and how thick the gear is there. */
interface Spine {
  long: boolean;
  /** u 0..1 along the long side → the middle point, half the thickness, and the direction of the long side. */
  at: (u: number) => { x: number; y: number; half: number; ang: number };
}
const spines = new Map<string, Spine>();
function spineOf(shape: SkinShape): Spine {
  const key = shape.path + shape.dy;
  const known = spines.get(key);
  if (known) return known;
  const { x0, y0, x1, y1, dy } = shape;
  const long = y1 - y0 >= x1 - x0;
  const path = new Path2D(shape.path);
  const probe = document.createElement('canvas').getContext('2d')!;
  const N = 48;
  const pts: { x: number; y: number; half: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k <= 120; k++) {
      const across = long ? x0 + ((x1 - x0) * k) / 120 : y0 + ((y1 - y0) * k) / 120;
      const x = long ? across : x0 + (x1 - x0) * t;
      const y = long ? y0 + (y1 - y0) * t : across;
      if (probe.isPointInPath(path, x, y - dy)) {
        lo = Math.min(lo, across);
        hi = Math.max(hi, across);
      }
    }
    if (lo <= hi) pts.push(long ? { x: (lo + hi) / 2, y: y0 + (y1 - y0) * t, half: (hi - lo) / 2 } : { x: x0 + (x1 - x0) * t, y: (lo + hi) / 2, half: (hi - lo) / 2 });
  }
  if (pts.length < 2) pts.splice(0, pts.length, { x: (x0 + x1) / 2, y: y0, half: 10 }, { x: (x0 + x1) / 2, y: y1, half: 10 });
  const at = (u: number) => {
    const f = Math.max(0, Math.min(1, u)) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    const q = f - i;
    const a = pts[i];
    const b = pts[i + 1];
    return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, half: a.half + (b.half - a.half) * q, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };
  const sp = { long, at };
  spines.set(key, sp);
  return sp;
}

/** A point beside the middle line: `off` is a part of the half thickness (+ = right of the long side). */
function beside(sp: Spine, u: number, off: number) {
  const p = sp.at(u);
  const nx = -Math.sin(p.ang);
  const ny = Math.cos(p.ang);
  return { x: p.x + nx * off * p.half, y: p.y + ny * off * p.half, half: p.half, ang: p.ang };
}

function sparkle(c: Ctx, x: number, y: number, r: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
}

/** A smooth closed shape through points (the corners are rounded; a point given twice stays sharp). */
function smoothPts(pts: [number, number][]): Path2D {
  const p = new Path2D();
  const n = pts.length;
  const mid = (i: number) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(0);
  p.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const m = mid(i);
    p.quadraticCurveTo(pts[i % n][0], pts[i % n][1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

/** A line along the gear from u0 to u1, `off` beside the middle. */
function lineU(sp: Spine, u0: number, u1: number, off: number): Path2D {
  const p = new Path2D();
  for (let k = 0; k <= 20; k++) {
    const q = beside(sp, u0 + ((u1 - u0) * k) / 20, off);
    if (k === 0) p.moveTo(q.x, q.y);
    else p.lineTo(q.x, q.y);
  }
  return p;
}

/** A line straight across the gear at u (from rail to rail). */
function acrossU(sp: Spine, u: number): Path2D {
  const p = new Path2D();
  const a = beside(sp, u, -1.5);
  const b = beside(sp, u, 1.5);
  p.moveTo(a.x, a.y);
  p.lineTo(b.x, b.y);
  return p;
}

/** A soft lighter band down the middle of the gear. */
function spineGlow(c: Ctx, sp: Spine, col: string, alpha: number) {
  c.save();
  c.strokeStyle = col;
  c.lineCap = 'round';
  c.globalAlpha = alpha;
  const line = lineU(sp, 0.04, 0.96, 0);
  const half = sp.at(0.5).half;
  c.globalAlpha = alpha / 3;
  for (let k = 1.5; k > 0.2; k -= 0.12) {
    c.lineWidth = half * k;
    c.stroke(line);
  }
  c.restore();
}

/** Spots scattered over the gear without overlapping (the same every time): `size(o)` is a spot's radius for its place
 *  across (0 middle, 1 rail), `gap` the room between spots as a part of their size. */
function scatter(sp: Spine, seed: number, tries: number, size: (o: number) => number, gap: number): { x: number; y: number; r: number }[] {
  const got: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < tries; i++) {
    const o = h(seed, i * 2) * 2.1 - 1.05;
    const q = beside(sp, h(seed, i * 2 + 1) * 1.04 - 0.02, o);
    const r = size(Math.abs(o)) * (0.75 + 0.5 * h(seed, i + 7000));
    if (got.every((g) => Math.hypot(g.x - q.x, g.y - q.y) > (g.r + r) * gap)) got.push({ x: q.x, y: q.y, r });
  }
  return got;
}

/** A darker tone along the rails of the gear, fading inward. */
function railShade(c: Ctx, shape: SkinShape, col: string, alpha: number) {
  const outline = new Path2D(shape.path);
  const width = Math.min(shape.x1 - shape.x0, shape.y1 - shape.y0);
  c.save();
  c.translate(0, shape.dy);
  c.strokeStyle = col;
  c.globalAlpha = alpha / 4;
  for (const k of [0.36, 0.26, 0.17, 0.09]) {
    c.lineWidth = width * k;
    c.stroke(outline);
  }
  c.restore();
}

/** A glossy cartoon water drop at (x, y), radius r, its point turned by `rot` (0 = pointing to -y). */
function waterDrop(c: Ctx, x: number, y: number, r: number, rot: number, ink: string) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  const p = new Path2D();
  p.moveTo(0, -r * 1.8);
  p.bezierCurveTo(r * 0.3, -r * 1.1, r, -r * 0.5, r, r * 0.25);
  p.arc(0, r * 0.25, r, 0, Math.PI);
  p.bezierCurveTo(-r, -r * 0.5, -r * 0.3, -r * 1.1, 0, -r * 1.8);
  const g = c.createLinearGradient(-r, -r, r, r * 1.3);
  g.addColorStop(0, '#effaff');
  g.addColorStop(0.45, '#a6dcff');
  g.addColorStop(1, '#5aaef0');
  c.fillStyle = g;
  c.fill(p);
  c.strokeStyle = ink;
  c.lineWidth = Math.max(1, r * 0.16);
  c.stroke(p);
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.beginPath();
  c.ellipse(-r * 0.42, -r * 0.1, r * 0.17, r * 0.4, 0.3, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(-r * 0.22, r * 0.55, r * 0.11, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = r * 0.12;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(0, r * 0.25, r * 0.68, Math.PI * 0.08, Math.PI * 0.42);
  c.stroke();
  c.restore();
}

/** One flame tongue rising from the tail: `o` its place across the tail, `tip` the u it reaches, `curl` how far it bends
 *  sideways, `wd` its width; `reach` 0..1 draws only the lower part (the orange and yellow cores). */
function flameTongue(sp: Spine, o: number, tip: number, curl: number, wd: number, reach: number): Path2D {
  const N = 28;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let k = 0; k <= N; k++) {
    const t = (k / N) * reach;
    const u = 1.05 + (tip - 1.05) * t;
    const mid = o + curl * t * t + 0.07 * Math.sin(t * 7 + o * 4) * t;
    const wid = wd * Math.pow(1 - k / N, 0.85) * (1 + 0.18 * Math.sin(t * 11 + o));
    const l = beside(sp, u, mid - wid);
    const r = beside(sp, u, mid + wid);
    left.push([l.x, l.y]);
    right.push([r.x, r.y]);
  }
  const p = new Path2D();
  p.moveTo(left[0][0], left[0][1]);
  for (const [x, y] of left) p.lineTo(x, y);
  for (const [x, y] of right.reverse()) p.lineTo(x, y);
  p.closePath();
  return p;
}

/** One raised white wart on the mushroom's cap: a creamy lump with a shade under it and a light top. */
function wart(c: Ctx, x: number, y: number, r: number, seed: number) {
  const pts: [number, number][] = [];
  for (let j = 0; j < 6; j++) {
    const an = (j / 6) * Math.PI * 2 + h(seed, 99);
    const rr = r * (0.8 + 0.35 * h(seed, j));
    pts.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]);
  }
  const lump = smoothPts(pts);
  c.save();
  c.fillStyle = 'rgba(90,10,0,0.35)';
  c.translate(r * 0.18, r * 0.24);
  c.fill(lump);
  c.restore();
  c.fillStyle = '#eadcc0';
  c.fill(lump);
  c.fillStyle = '#fffaf0';
  c.beginPath();
  c.ellipse(x - r * 0.15, y - r * 0.18, r * 0.55, r * 0.48, 0, 0, Math.PI * 2);
  c.fill();
}

/** A pink branching coral at (0, 0), growing toward -y, about r tall. */
function coralBranch(c: Ctx, r: number, col: string, dark: string) {
  c.save();
  c.lineCap = 'round';
  const grow = (x: number, y: number, ang: number, len: number, wd: number, depth: number) => {
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    c.lineWidth = wd;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(ex, ey);
    c.stroke();
    if (depth > 0) {
      grow(ex, ey, ang - 0.5, len * 0.72, wd * 0.75, depth - 1);
      grow(ex, ey, ang + 0.45, len * 0.68, wd * 0.75, depth - 1);
    } else {
      c.beginPath();
      c.arc(ex, ey, wd * 0.62, 0, Math.PI * 2);
      c.fill();
    }
  };
  c.translate(0, r * 0.5);
  c.strokeStyle = dark;
  c.fillStyle = dark;
  grow(0.8, 0.8, -Math.PI / 2, r * 0.55, r * 0.34, 2);
  c.strokeStyle = col;
  c.fillStyle = col;
  grow(0, 0, -Math.PI / 2, r * 0.55, r * 0.25, 2);
  c.restore();
}

/** An orange sea fan: a half disc of fine branches on a short stem. */
function seaFan(c: Ctx, r: number, col: string, dark: string) {
  c.save();
  c.translate(0, r * 0.45);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, r * 0.95, Math.PI * 1.08, Math.PI * 1.92);
  c.closePath();
  c.fill();
  c.strokeStyle = dark;
  c.lineWidth = Math.max(0.8, r * 0.05);
  for (let k = 0; k <= 8; k++) {
    const an = Math.PI * (1.1 + (0.8 * k) / 8);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(Math.cos(an) * r * 0.4, Math.sin(an) * r * 0.55, Math.cos(an) * r * 0.92, Math.sin(an) * r * 0.92);
    c.stroke();
  }
  for (const rr of [0.4, 0.68]) {
    c.beginPath();
    c.arc(0, 0, r * rr, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  }
  c.lineWidth = r * 0.14;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, r * 0.25);
  c.stroke();
  c.restore();
}

/** A round purple brain coral with its winding grooves. */
function brainCoral(c: Ctx, r: number, col: string, dark: string) {
  c.fillStyle = col;
  c.beginPath();
  c.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = dark;
  c.lineWidth = Math.max(0.8, r * 0.07);
  c.stroke();
  c.save();
  c.beginPath();
  c.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  c.clip();
  c.lineWidth = Math.max(0.7, r * 0.06);
  for (let k = -2; k <= 2; k++) {
    c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const x = -r * 0.6 + (r * 1.2 * i) / 20;
      const y = k * r * 0.22 + Math.sin(i * 1.3 + k) * r * 0.07;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.restore();
  c.fillStyle = 'rgba(255,255,255,0.3)';
  c.beginPath();
  c.ellipse(-r * 0.22, -r * 0.24, r * 0.16, r * 0.1, -0.5, 0, Math.PI * 2);
  c.fill();
}

/** A little reef fish swimming toward -x, with a stripe. */
function reefFish(c: Ctx, r: number, col: string, stripe: string) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(r * 0.5, 0);
  c.lineTo(r * 0.95, -r * 0.32);
  c.lineTo(r * 0.95, r * 0.32);
  c.closePath();
  c.fill();
  c.beginPath();
  c.ellipse(0, 0, r * 0.6, r * 0.32, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = stripe;
  c.lineWidth = r * 0.12;
  c.beginPath();
  c.moveTo(r * 0.05, -r * 0.3);
  c.lineTo(r * 0.05, r * 0.3);
  c.stroke();
  c.fillStyle = '#10161c';
  c.beginPath();
  c.arc(-r * 0.33, -r * 0.05, r * 0.07, 0, Math.PI * 2);
  c.fill();
}

/** A tiger stripe curving in from one rail (sd) toward the middle, tapering to a point: `len` how far across it reaches. */
function tigerStripe(sp: Spine, u: number, sd: number, len: number, wd: number): Path2D {
  const N = 16;
  const a: [number, number][] = [];
  const b: [number, number][] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const o = sd * (1.25 - t * len * 1.25);
    const uu = u - 0.09 * t * t;
    const wid = wd * Math.pow(1 - t, 0.6) * (1 + 0.12 * Math.sin(t * 6));
    const p = beside(sp, uu - wid / 2, o);
    const q = beside(sp, uu + wid / 2, o);
    a.push([p.x, p.y]);
    b.push([q.x, q.y]);
  }
  const p = new Path2D();
  a.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  for (const [x, y] of b.reverse()) p.lineTo(x, y);
  p.closePath();
  return p;
}

/** A leopard rosette: a warm centre and a dark ring broken into three or four thick blots. */
function rosette(c: Ctx, x: number, y: number, r: number, rot: number, seed: number, mid: string, ink: string) {
  c.save();
  c.fillStyle = mid;
  c.beginPath();
  c.ellipse(x, y, r * 0.78, r * 0.62, rot, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = ink;
  c.lineCap = 'round';
  const n = h(seed, 1) < 0.5 ? 3 : 4;
  for (let k = 0; k < n; k++) {
    const st = rot + (k * Math.PI * 2) / n + (h(seed, k + 2) - 0.5) * 0.5;
    const span = ((Math.PI * 2) / n) * (0.5 + 0.22 * h(seed, k + 7));
    c.lineWidth = r * (0.42 + 0.16 * h(seed, k + 11));
    c.beginPath();
    c.ellipse(x, y, r * 0.98, r * 0.8, rot, st, st + span);
    c.stroke();
  }
  c.restore();
}

/** Skins that take the place of the gear: a figure is drawn instead of a pattern on the gear's shape. */
export function isFigure(skin: SkinDef): boolean {
  return skin.pattern === 'balloons' || skin.pattern === 'gull' || skin.pattern === 'falcon' || skin.pattern === 'wingDragon' || skin.pattern === 'cherry' || skin.pattern === 'moon' || skin.pattern === 'phoenix' || isRide(skin) || isWingFigure(skin);
}

/** The animals a surfer rides instead of a board (seen from above, snout to the front): their fins and tail stick out past the board. */
export function isRide(skin: SkinDef): boolean {
  return ['sharkRide', 'orca', 'dolphin', 'swordfish', 'carrot', 'rocket', 'mouse', 'xmasTree'].includes(skin.pattern);
}

/** Skins that hide the gear's see-through window (the wing figures, Matchday so its club logo shows whole, the moon sail). */
export function hidesWindow(skin: SkinDef): boolean {
  return isWingFigure(skin) || skin.pattern === 'matchday' || skin.pattern === 'moon';
}

/** Wing skins drawn as a figure instead of a pattern on the wing (the crocodile's spikes, the bat, the dog, the money). */
export function isWingFigure(skin: SkinDef): boolean {
  return ['crocodile', 'batWing', 'goodBoy', 'jackpot'].includes(skin.pattern);
}

/**
 * The Moonlight sail: the crescent moon after a telescope photo. Its horns sit where the sail's corners are (the mast foot
 * at 0,0 and the clew), the lit edge bulges out like a half circle and the terminator is the shallow inner curve. Grey
 * highlands, darker smooth seas, a bright lit edge and craters everywhere, with sharp shadows near the terminator where
 * the sun is low.
 */
function drawMoonSail(c: Ctx, skin: SkinDef) {
  const [surf, lit, dark] = skin.colors;
  const seed = 0x3007;
  // a frame along the chord between the horns: x along the chord, y out toward the lit edge
  const ax = 143;
  const ay = 202;
  const L = Math.hypot(ax, ay) / 2;
  const SO = L * 0.7; // the lit edge (a half ellipse: the moon seen a little from the side, about the size of the sail)
  const SI = L * 0.16; // the terminator
  c.save();
  c.translate(ax / 2, ay / 2);
  c.rotate(Math.atan2(ay, ax));
  c.scale(1, -1);
  const moon = new Path2D();
  moon.ellipse(0, 0, L, SO, 0, 0, Math.PI);
  moon.ellipse(0, 0, L, SI, 0, Math.PI, 0, true);
  moon.closePath();
  c.save();
  c.clip(moon);
  // the lit edge is bright, the surface darkens toward the terminator
  const g = c.createLinearGradient(0, SO, 0, SI * 0.4);
  g.addColorStop(0, lit);
  g.addColorStop(0.55, surf);
  g.addColorStop(1, darker(surf, 0.28));
  c.fillStyle = g;
  c.fillRect(-L - 4, -4, 2 * L + 8, SO + 8);
  for (let k = 0; k < 14; k++) {
    const sk = SI + (SO - SI) * 0.42 * (1 - k / 14);
    c.fillStyle = 'rgba(30,32,36,0.045)';
    c.beginPath();
    c.ellipse(0, 0, L * (1 - k * 0.004), sk, 0, 0, Math.PI);
    c.fill();
  }
  /** A point on the moon: t -1..1 along the chord, f 0 (terminator) .. 1 (lit edge) across. */
  const at = (t: number, f: number) => {
    const r = Math.sqrt(Math.max(0, 1 - t * t));
    return { x: t * L, y: (SI + (SO - SI) * f) * r, w: (SO - SI) * r };
  };
  // the dark seas: smooth soft patches in the middle and lower half, toward the lit side
  const seas: [number, number, number][] = [
    [0.1, 0.6, 0.26],
    [0.36, 0.58, 0.2],
    [-0.14, 0.7, 0.16],
    [0.58, 0.46, 0.13],
    [-0.42, 0.62, 0.1],
  ];
  for (const [t, f, r] of seas) {
    const p = at(t, f);
    const R = r * L;
    for (let i = 0; i < 6; i++) {
      const qx = p.x + (h(seed, i + t * 100) - 0.5) * R * 0.7;
      const qy = p.y + (h(seed, i + 40 + f * 100) - 0.5) * R * 0.45;
      const rg = c.createRadialGradient(qx, qy, 0, qx, qy, R * 0.85);
      rg.addColorStop(0, `${dark}40`);
      rg.addColorStop(0.55, `${dark}30`);
      rg.addColorStop(1, `${dark}00`);
      c.fillStyle = rg;
      c.fillRect(qx - R, qy - R, 2 * R, 2 * R);
    }
  }
  // craters: the sun shines from the lit edge, so each one has a dark wall on that side and a bright rim on the other.
  // Near the terminator they are many and sharp, near the lit edge faint and squashed (seen from the side).
  for (let i = 0; i < 260; i++) {
    const t = (h(seed, i + 200) * 2 - 1) * 0.95;
    const f = Math.pow(h(seed, i + 500), 2.2) * 0.92 + 0.02;
    const p = at(t, f);
    const big = i % 26 === 0;
    const r = Math.min(p.w * 0.2, big ? 3.6 + 2.4 * h(seed, i + 800) : 0.7 + 1.5 * Math.pow(h(seed, i + 800), 2));
    if (r < 0.6) continue;
    const squash = 1 - 0.55 * f;
    const strength = 1 - 0.8 * f;
    c.save();
    c.translate(p.x, p.y);
    // the floor, a little darker
    c.fillStyle = `rgba(40,42,46,${0.18 * strength})`;
    c.beginPath();
    c.ellipse(0, 0, r, r * squash, 0, 0, Math.PI * 2);
    c.fill();
    // the shadow inside, against the wall toward the sun
    c.fillStyle = `rgba(20,22,26,${0.55 * strength})`;
    c.beginPath();
    c.ellipse(0, r * squash * 0.18, r * 0.92, r * squash * 0.78, 0, 0, Math.PI);
    c.ellipse(0, r * squash * 0.18, r * 0.92, r * squash * 0.3, 0, Math.PI, 0, true);
    c.fill();
    // the lit rim on the far side
    c.strokeStyle = `rgba(250,250,252,${0.75 * strength})`;
    c.lineWidth = Math.max(0.6, r * 0.28);
    c.beginPath();
    c.ellipse(0, 0, r, r * squash, 0, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
    if (big) {
      // a bright little peak in the middle
      c.fillStyle = `rgba(250,250,252,${0.6 * strength})`;
      c.beginPath();
      c.arc(0, -r * 0.05, r * 0.16, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
  // a soft fade into the dark along the terminator, and the bright lit edge
  c.strokeStyle = 'rgba(20,22,26,0.28)';
  c.lineWidth = 5;
  c.beginPath();
  c.ellipse(0, 0, L, SI, 0, 0, Math.PI);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.lineWidth = 2.6;
  c.beginPath();
  c.ellipse(0, 0, L, SO, 0, 0, Math.PI);
  c.stroke();
  c.restore();
  c.restore();
}

/** How far an animal's tail reaches past the end of the board (spec px). */
const RIDE_TAIL = 64;

/** The area a skin's picture needs: the gear's own bounds, wider and longer for the animals. */
export function skinBounds(skin: SkinDef, shape: SkinShape): { x0: number; y0: number; x1: number; y1: number } {
  if (isRide(skin)) return { x0: shape.x0 - 48, y0: shape.y0 - 4, x1: shape.x1 + 48, y1: shape.y1 + RIDE_TAIL + 6 };
  if (isWingFigure(skin)) return { x0: shape.x0 - 40, y0: shape.y0 - 50, x1: shape.x1 + 40, y1: shape.y1 + 44 };
  if (skin.pattern === 'moon') return { x0: -6, y0: -16, x1: 180, y1: 208 };
  // the phoenix's raised wings, flame trails and long tail reach past the kite
  if (skin.pattern === 'phoenix') return { x0: -160, y0: -134, x1: 160, y1: 86 };
  return shape;
}

/** A body seen from above, symmetric about x = 0: [part of the length 0..1, half its width there] from the snout back. */
function bodyOutline(prof: [number, number][], at: (f: number) => number): Path2D {
  const pts: [number, number][] = [];
  for (const [f, w] of prof) pts.push([w, at(f)]);
  for (let i = prof.length - 1; i >= 0; i--) if (prof[i][1] > 0) pts.push([-prof[i][1], at(prof[i][0])]);
  return smoothPts(pts);
}

/** The half width of a body profile at f (straight between the given points). */
function widthAt(prof: [number, number][], f: number): number {
  for (let i = 1; i < prof.length; i++)
    if (f <= prof[i][0]) {
      const [fa, wa] = prof[i - 1];
      const [fb, wb] = prof[i];
      return wa + ((wb - wa) * (f - fa)) / (fb - fa);
    }
  return prof[prof.length - 1][1];
}

const INK = '#2b1d14';

/** Where the two kite lines are tied on a figure (kite coordinates): the balloons' knot, the bird's or dragon's feet. */
export function figureTips(skin: SkinDef): [{ x: number; y: number }, { x: number; y: number }] {
  // the cherries: where the two stems meet
  if (skin.pattern === 'cherry')
    return [
      { x: -2, y: 40 },
      { x: 2, y: 40 },
    ];
  if (skin.pattern === 'balloons')
    return [
      { x: -2, y: 52 },
      { x: 2, y: 52 },
    ];
  return [
    { x: -7, y: 12 },
    { x: 7, y: 12 },
  ];
}

/** A five-point star. */
function star5(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/** One wing of a bird or dragon, seen from above, spread along the kite's arc (side -1 left, +1 right). */
function wingPath(side: number, scallop: boolean): Path2D {
  const s = side;
  const p = new Path2D();
  p.moveTo(s * 10, -24);
  p.quadraticCurveTo(s * 64, -70, s * 120, 50);
  if (scallop) {
    p.quadraticCurveTo(s * 100, 22, s * 86, 34);
    p.quadraticCurveTo(s * 70, 8, s * 54, 22);
    p.quadraticCurveTo(s * 38, 0, s * 26, 14);
    p.quadraticCurveTo(s * 16, 4, s * 10, 6);
  } else p.quadraticCurveTo(s * 70, 6, s * 10, 6);
  p.closePath();
  return p;
}

/** A pair of glossy cherries hanging from one knot (x, y) with a leaf; `k` scales it (1 = the cherry kite's size). */
function cherryPair(c: Ctx, x: number, y: number, k: number) {
  const cherries: [number, number, number][] = [
    [x - 50 * k, y - 60 * k, 44 * k],
    [x + 48 * k, y - 70 * k, 42 * k],
  ];
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#5b7a2a';
  c.lineWidth = 4.5 * k;
  for (const [cx, cy, r] of cherries) {
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + (cx - x) * 0.25, y - 30 * k, x + (cx - x) * 0.82, cy + r * 0.7);
    c.stroke();
  }
  for (const [cx, cy, r] of cherries) {
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#ff5a6e');
    g.addColorStop(0.55, '#e0102f');
    g.addColorStop(1, '#8a0a1c');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6 * k;
    c.stroke();
    c.strokeStyle = 'rgba(60,0,10,0.55)';
    c.lineWidth = 2 * k;
    c.beginPath();
    c.arc(cx + r * 0.12, cy + r * 0.62, r * 0.18, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath();
    c.ellipse(cx - r * 0.38, cy - r * 0.34, r * 0.2, r * 0.32, -0.6, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#3f8f3a';
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + 26 * k, y - 10 * k, x + 40 * k, y + 8 * k);
  c.quadraticCurveTo(x + 20 * k, y + 18 * k, x, y);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2 * k;
  c.stroke();
  c.restore();
}

/** The wing figures, in the wing's own coordinates (leading edge from the tips (±120, 70) up to (0, 0), trailing edge down to (0, 104)). */
function drawWingFigure(c: Ctx, skin: SkinDef) {
  const wing = new Path2D(PATHS.wing);
  c.lineJoin = 'round';
  if (skin.pattern === 'crocodile') {
    // green scales, a bumpy ridge down the middle and spikes all along the trailing edge
    const spikes = new Path2D();
    const tr = (t: number, sd: number) => {
      const u = 1 - t;
      const x = sd * (u * u * u * 120 + 3 * u * u * t * 80 + 3 * u * t * t * 40);
      const y = u * u * u * 70 + 3 * u * u * t * 74 + 3 * u * t * t * 96 + t * t * t * 104;
      return [x, y] as const;
    };
    for (const sd of [-1, 1])
      for (let k = 0; k < 9; k++) {
        const [ax, ay] = tr(k / 9, sd);
        const [bx, by] = tr((k + 1) / 9, sd);
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        spikes.moveTo(ax, ay - 2);
        spikes.lineTo(mx + sd * 2, my + 15);
        spikes.lineTo(bx, by - 2);
        spikes.closePath();
      }
    c.fillStyle = '#2f6e2c';
    c.fill(spikes);
    c.strokeStyle = '#1f4a1c';
    c.lineWidth = 2;
    c.stroke(spikes);
    paintIn(
      c,
      wing,
      () => {
        const g = c.createLinearGradient(0, 0, 0, 104);
        g.addColorStop(0, '#58a84c');
        g.addColorStop(1, '#3a8034');
        c.fillStyle = g;
        c.fillRect(-124, -4, 248, 112);
        crocScales(c, -124, -4, 124, 108, 12);
        for (let y = 10; y < 100; y += 16) {
          c.fillStyle = '#2f6e2c';
          c.beginPath();
          c.ellipse(0, y, 6, 7, 0, 0, Math.PI * 2);
          c.fill();
        }
      },
      '#1f4a1c',
      2.6,
    );
    return;
  }
  if (skin.pattern === 'batWing') {
    // a pair of bat wings: the arm bones up to the wrists, the finger bones fanning out, the skin scalloped between them
    const [a, b] = skin.colors;
    for (const sd of [-1, 1]) {
      const wrist = [sd * 72, -6] as const;
      const tips: [number, number][] = [
        [sd * 128, 40],
        [sd * 110, 88],
        [sd * 74, 104],
        [sd * 34, 106],
      ];
      const m = new Path2D();
      m.moveTo(0, 8);
      m.quadraticCurveTo(sd * 36, -18, wrist[0], wrist[1]);
      m.quadraticCurveTo(sd * 104, -2, tips[0][0], tips[0][1]);
      for (let k = 1; k < tips.length; k++) {
        const [px, py] = tips[k - 1];
        const [qx, qy] = tips[k];
        const cx = (px + qx) / 2 + (wrist[0] - (px + qx) / 2) * 0.32;
        const cy = (py + qy) / 2 + (wrist[1] - (py + qy) / 2) * 0.32;
        m.quadraticCurveTo(cx, cy, qx, qy);
      }
      m.quadraticCurveTo(sd * 16, 78, 0, 92);
      m.closePath();
      const g = c.createLinearGradient(0, 0, sd * 128, 60);
      g.addColorStop(0, '#4a4e57');
      g.addColorStop(1, a);
      c.fillStyle = g;
      c.fill(m);
      c.strokeStyle = b;
      c.lineWidth = 2.4;
      c.stroke(m);
      c.lineCap = 'round';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, 10);
      c.quadraticCurveTo(sd * 36, -16, wrist[0], wrist[1]);
      c.stroke();
      c.lineWidth = 2;
      for (const [tx, ty] of tips) {
        c.beginPath();
        c.moveTo(wrist[0], wrist[1]);
        c.quadraticCurveTo((wrist[0] + tx) / 2 + sd * 6, (wrist[1] + ty) / 2 - 6, tx, ty);
        c.stroke();
      }
      c.fillStyle = b;
      c.beginPath();
      c.moveTo(wrist[0] - sd * 4, wrist[1]);
      c.quadraticCurveTo(wrist[0] - sd * 2, wrist[1] - 14, wrist[0] - sd * 10, wrist[1] - 16);
      c.quadraticCurveTo(wrist[0] + sd * 2, wrist[1] - 10, wrist[0] + sd * 4, wrist[1]);
      c.fill();
    }
    return;
  }
  if (skin.pattern === 'goodBoy') {
    // a low-poly dog: the wing cut into grey and white facets like a folded paper dog, the head at the leading edge
    // with floppy dark ears, yellow eyes and a black nose
    const facets: [number, number][][] = [
      [[-120, 70], [-70, 20], [-60, 70]],
      [[-70, 20], [-30, 4], [-60, 70]],
      [[-60, 70], [-30, 4], [-24, 96]],
      [[-30, 4], [0, 0], [0, 50]],
      [[-30, 4], [0, 50], [-24, 96]],
      [[-24, 96], [0, 50], [0, 104]],
    ];
    const shades = ['#5f656d', '#9aa0a8', '#c9cdd2', '#e6e8eb', '#b3b8bf', '#f2f3f5'];
    c.save();
    c.clip(wing);
    c.fillStyle = '#d5d9de';
    c.fillRect(-124, -4, 248, 112);
    for (const sd of [-1, 1])
      facets.forEach((f, k) => {
        c.fillStyle = shades[(k + (sd > 0 ? 1 : 0)) % shades.length];
        c.beginPath();
        f.forEach(([x, y], i) => (i ? c.lineTo(sd * x, y) : c.moveTo(sd * x, y)));
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(60,64,70,0.35)';
        c.lineWidth = 1;
        c.stroke();
      });
    c.restore();
    c.strokeStyle = '#3c4046';
    c.lineWidth = 2.4;
    c.stroke(wing);
    for (const sd of [-1, 1]) {
      c.fillStyle = '#3c4046';
      c.beginPath();
      c.moveTo(sd * 14, -36);
      c.lineTo(sd * 40, -28);
      c.lineTo(sd * 36, 6);
      c.lineTo(sd * 22, -6);
      c.closePath();
      c.fill();
    }
    const head: [string, [number, number][]][] = [
      ['#e6e8eb', [[-18, -40], [18, -40], [22, -14], [0, -6], [-22, -14]]],
      ['#9aa0a8', [[-18, -40], [0, -40], [0, -10], [-22, -14]]],
      ['#f2f3f5', [[-12, -10], [12, -10], [8, 10], [-8, 10]]],
      ['#c9cdd2', [[-22, -14], [-12, -10], [-8, 10], [-16, 2]]],
      ['#c9cdd2', [[22, -14], [12, -10], [8, 10], [16, 2]]],
    ];
    for (const [col, pts] of head) {
      c.fillStyle = col;
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(60,64,70,0.5)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.strokeStyle = '#3c4046';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-18, -40);
    c.lineTo(18, -40);
    c.lineTo(22, -14);
    c.lineTo(16, 2);
    c.lineTo(8, 10);
    c.lineTo(-8, 10);
    c.lineTo(-16, 2);
    c.lineTo(-22, -14);
    c.closePath();
    c.stroke();
    for (const sd of [-1, 1]) {
      c.fillStyle = '#f2c230';
      c.beginPath();
      c.arc(sd * 10, -24, 4.6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#3c4046';
      c.lineWidth = 1.2;
      c.stroke();
      c.fillStyle = '#16161a';
      c.beginPath();
      c.arc(sd * 10, -24, 2.2, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#16161a';
    c.beginPath();
    c.moveTo(-6, -6);
    c.lineTo(6, -6);
    c.lineTo(0, 2);
    c.closePath();
    c.fill();
    c.strokeStyle = '#3c4046';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(0, 2);
    c.lineTo(0, 7);
    c.moveTo(-5, 9);
    c.lineTo(0, 7);
    c.lineTo(5, 9);
    c.stroke();
    return;
  }
  // jackpot: a green money wing in a gold frame with knobs at the tips, bills inside and flying around it
  for (const [x, y, rot] of [
    [-138, 20, -0.5],
    [-120, 100, 0.4],
    [0, -34, 0.15],
    [124, 96, -0.35],
    [140, 14, 0.6],
  ] as const)
    bill(c, x, y, 34, rot);
  paintIn(
    c,
    wing,
    () => {
      const g = c.createLinearGradient(0, 0, 0, 104);
      g.addColorStop(0, '#3fa04c');
      g.addColorStop(1, '#25743a');
      c.fillStyle = g;
      c.fillRect(-124, -4, 248, 112);
      for (const [x, y, rot] of [
        [-80, 46, -0.25],
        [-40, 30, 0.2],
        [-36, 72, -0.1],
        [6, 40, 0.3],
        [40, 74, -0.2],
        [52, 30, 0.15],
        [90, 56, -0.3],
      ] as const)
        bill(c, x, y, 38, rot);
    },
    '#e0a800',
    7,
  );
  c.strokeStyle = '#fff1a8';
  c.lineWidth = 2;
  c.stroke(wing);
  for (const sd of [-1, 1]) {
    c.fillStyle = '#ffcf3a';
    c.beginPath();
    c.arc(sd * 120, 70, 7, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8a6100';
    c.lineWidth = 1.5;
    c.stroke();
  }
  for (const [x, y, r] of [
    [-100, 6, 7],
    [96, 0, 9],
    [-20, 110, 6],
    [70, 116, 5],
  ] as const)
    sparkle(c, x, y, r, '#fff6c4');
}

/** The figure skins (the author's friend's legendary kites): balloons, a seagull, a falcon, a dragon. In the kite's own coordinates: flying toward -y, the lines go to the tips at (±119, 56). */
function drawFigure(c: Ctx, skin: SkinDef, shape: SkinShape) {
  const [a, b, d] = skin.colors;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (skin.pattern === 'sharkRide') {
    // a shark seen from above (after drone photos): a pointed snout, the eyes on the sides of the head, big sickle pectoral
    // fins swept back, the dorsal fin standing up in the middle, small pelvic fins, a thin tail stalk and the tall tail fin
    // (from above only its edge shows, a slim fork). Dark grey on the back, lighter toward the sides.
    const { y0, y1 } = shape;
    const T = y1 + RIDE_TAIL - y0;
    const at = (f: number) => y0 + T * f;
    const prof: [number, number][] = [
      [0, 0], [0.03, 10], [0.08, 21], [0.16, 31], [0.27, 37], [0.4, 35], [0.52, 29], [0.63, 21], [0.72, 13], [0.79, 7.5], [0.84, 5.5],
    ];
    const W = (f: number) => widthAt(prof, f);
    const fin = '#56646f';
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    // the tail fin: a long upper lobe and a short lower one, slightly bent
    for (const [tipX, tipF, wd] of [
      [20, 1.0, 9],
      [-15, 0.93, 6.5],
    ] as const) {
      c.fillStyle = fin;
      c.beginPath();
      c.moveTo(-5, at(0.81));
      c.quadraticCurveTo(tipX * 0.2 - wd, at((0.84 + tipF) / 2), tipX, at(tipF));
      c.quadraticCurveTo(tipX * 0.2 + wd, at((0.84 + tipF) / 2), 5, at(0.81));
      c.closePath();
      c.fill();
      c.stroke();
    }
    // pelvic fins
    for (const sd of [-1, 1]) {
      c.fillStyle = fin;
      c.beginPath();
      c.moveTo(sd * W(0.61) * 0.85, at(0.61));
      c.quadraticCurveTo(sd * 27, at(0.63), sd * 31, at(0.72));
      c.quadraticCurveTo(sd * 22, at(0.69), sd * W(0.68) * 0.85, at(0.68));
      c.closePath();
      c.fill();
      c.stroke();
    }
    // pectoral fins: long sickles swept back
    for (const sd of [-1, 1]) {
      const g = c.createLinearGradient(sd * 30, 0, sd * 82, 0);
      g.addColorStop(0, '#5f6e7a');
      g.addColorStop(1, '#3f4b56');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(sd * W(0.24) * 0.92, at(0.24));
      c.bezierCurveTo(sd * 52, at(0.25), sd * 72, at(0.34), sd * 82, at(0.47));
      c.quadraticCurveTo(sd * 56, at(0.37), sd * W(0.36) * 0.92, at(0.36));
      c.closePath();
      c.fill();
      c.stroke();
    }
    // the body: dark along the back, lighter toward the sides
    const body = bodyOutline(prof, at);
    const g = c.createLinearGradient(-38, 0, 38, 0);
    g.addColorStop(0, b);
    g.addColorStop(0.32, a);
    g.addColorStop(0.68, a);
    g.addColorStop(1, b);
    c.fillStyle = g;
    c.fill(body);
    c.save();
    c.clip(body);
    // a darker stripe down the spine
    c.strokeStyle = 'rgba(30,40,50,0.28)';
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(0, at(0.04));
    c.lineTo(0, at(0.86));
    c.stroke();
    // five gill slits on each side
    c.strokeStyle = 'rgba(28,36,44,0.7)';
    c.lineWidth = 1.6;
    for (const sd of [-1, 1])
      for (let k = 0; k < 5; k++) {
        const f = 0.17 + k * 0.016;
        const x = sd * W(f);
        c.beginPath();
        c.moveTo(x - sd * 9, at(f) - 2);
        c.quadraticCurveTo(x - sd * 4, at(f) + 1, x - sd * 1, at(f) + 4);
        c.stroke();
      }
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke(body);
    // the dorsal fin standing up: its thin top edge, a light side and the shadow it throws
    c.fillStyle = 'rgba(20,30,40,0.3)';
    c.beginPath();
    c.moveTo(1, at(0.47));
    c.quadraticCurveTo(9, at(0.55), 16, at(0.62));
    c.lineTo(1, at(0.6));
    c.closePath();
    c.fill();
    c.fillStyle = '#3a4651';
    c.beginPath();
    c.moveTo(0, at(0.45));
    c.quadraticCurveTo(5.5, at(0.53), 1.8, at(0.62));
    c.lineTo(-1.8, at(0.62));
    c.quadraticCurveTo(-5.5, at(0.53), 0, at(0.45));
    c.fill();
    c.strokeStyle = '#aab7c2';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-1, at(0.47));
    c.quadraticCurveTo(-4, at(0.53), -1.4, at(0.6));
    c.stroke();
    // the eyes on the sides of the head, under an angry brow
    for (const sd of [-1, 1]) {
      const ey = at(0.115);
      const ex = sd * (W(0.115) - 8);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.ellipse(ex, ey, 4.4, 5.2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.stroke();
      c.fillStyle = INK;
      c.beginPath();
      c.arc(ex + sd * 1.2, ey + 0.8, 2.8, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(ex - sd * 7, ey - 9);
      c.lineTo(ex + sd * 5, ey - 4);
      c.stroke();
    }
    c.restore();
    return;
  }
  if (skin.pattern === 'orca') {
    // a killer whale seen from above (after drone photos): a blunt round head, black all over the back, the white eye
    // patches showing at the sides of the head, the grey saddle behind the tall dorsal fin, the white flank patches at the
    // sides further back, big round paddle flippers and wide flat tail flukes
    const { y0, y1 } = shape;
    const T = y1 + RIDE_TAIL - y0;
    const at = (f: number) => y0 + T * f;
    const prof: [number, number][] = [
      [0, 0], [0.012, 14], [0.05, 27], [0.12, 36], [0.24, 42], [0.38, 41], [0.52, 35], [0.64, 26], [0.74, 16], [0.81, 9], [0.85, 7],
    ];
    const W = (f: number) => widthAt(prof, f);
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    // the flukes: wide and flat, a notch in the middle of the trailing edge
    const flukes = new Path2D();
    flukes.moveTo(0, at(0.8));
    flukes.quadraticCurveTo(24, at(0.83), 58, at(0.935));
    flukes.quadraticCurveTo(66, at(0.98), 52, at(0.985));
    flukes.quadraticCurveTo(22, at(0.95), 0, at(0.975));
    flukes.quadraticCurveTo(-22, at(0.95), -52, at(0.985));
    flukes.quadraticCurveTo(-66, at(0.98), -58, at(0.935));
    flukes.quadraticCurveTo(-24, at(0.83), 0, at(0.8));
    flukes.closePath();
    c.fillStyle = a;
    c.fill(flukes);
    c.stroke(flukes);
    // the flippers: big round paddles
    for (const sd of [-1, 1]) {
      const fl = smoothPts([
        [sd * W(0.19) * 0.8, at(0.19)],
        [sd * 56, at(0.2)],
        [sd * 74, at(0.3)],
        [sd * 70, at(0.38)],
        [sd * 56, at(0.36)],
        [sd * W(0.3) * 0.8, at(0.3)],
      ]);
      c.fillStyle = a;
      c.fill(fl);
      c.stroke(fl);
      c.strokeStyle = 'rgba(255,255,255,0.14)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(sd * 52, at(0.215));
      c.quadraticCurveTo(sd * 66, at(0.25), sd * 70, at(0.31));
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
    }
    const body = bodyOutline(prof, at);
    c.fillStyle = a;
    c.fill(body);
    c.save();
    c.clip(body);
    c.fillStyle = b;
    for (const sd of [-1, 1]) {
      // eye patch: a white oval on the side of the head, its back end turning up onto the top
      c.beginPath();
      c.ellipse(sd * (W(0.15) - 2), at(0.15), 9, 19, sd * 0.42, 0, Math.PI * 2);
      c.fill();
      // flank patch: white sweeping back along the side toward the tail
      c.fill(smoothPts([
        [sd * (W(0.53) + 6), at(0.52)],
        [sd * (W(0.58) - 9), at(0.58)],
        [sd * (W(0.67) - 8), at(0.67)],
        [sd * (W(0.75) - 2), at(0.76)],
        [sd * (W(0.68) + 10), at(0.7)],
      ]));
    }
    // the grey saddle behind the dorsal fin
    c.fillStyle = d;
    c.fill(smoothPts([
      [-W(0.5) * 0.75, at(0.5)],
      [0, at(0.535)],
      [W(0.5) * 0.75, at(0.5)],
      [W(0.57) * 0.55, at(0.575)],
      [0, at(0.61)],
      [-W(0.57) * 0.55, at(0.575)],
    ]));
    // a soft shine on the black head
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.beginPath();
    c.ellipse(-9, at(0.14), 8, 16, 0.15, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke(body);
    // the tall dorsal fin standing up: its thin top edge and the shadow it throws
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.moveTo(1, at(0.38));
    c.quadraticCurveTo(10, at(0.46), 20, at(0.54));
    c.lineTo(1, at(0.5));
    c.closePath();
    c.fill();
    c.fillStyle = '#0b0c0f';
    c.beginPath();
    c.moveTo(0, at(0.36));
    c.quadraticCurveTo(6, at(0.43), 2, at(0.51));
    c.lineTo(-2, at(0.51));
    c.quadraticCurveTo(-6, at(0.43), 0, at(0.36));
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-1, at(0.38));
    c.quadraticCurveTo(-4.5, at(0.43), -1.4, at(0.49));
    c.stroke();
    c.restore();
    return;
  }
  if (skin.pattern === 'dolphin') {
    // a bottlenose dolphin seen from above: the short beak, the round melon of the head, the blowhole, a dark cape down the
    // back and lighter sides, small pointed flippers swept back, the curved dorsal fin standing up and wide flat flukes
    const { y0, y1 } = shape;
    const T = y1 + RIDE_TAIL - y0;
    const at = (f: number) => y0 + T * f;
    const prof: [number, number][] = [
      [0, 0], [0.012, 6], [0.05, 8.5], [0.075, 13], [0.1, 21], [0.16, 27], [0.26, 30], [0.4, 28], [0.53, 22], [0.64, 14], [0.73, 7.5], [0.79, 5],
    ];
    const W = (f: number) => widthAt(prof, f);
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    const flukes = new Path2D();
    flukes.moveTo(0, at(0.76));
    flukes.quadraticCurveTo(14, at(0.79), 36, at(0.89));
    flukes.quadraticCurveTo(42, at(0.93), 31, at(0.93));
    flukes.quadraticCurveTo(14, at(0.895), 0, at(0.915));
    flukes.quadraticCurveTo(-14, at(0.895), -31, at(0.93));
    flukes.quadraticCurveTo(-42, at(0.93), -36, at(0.89));
    flukes.quadraticCurveTo(-16, at(0.79), 0, at(0.76));
    flukes.closePath();
    c.fillStyle = d;
    c.fill(flukes);
    c.stroke(flukes);
    for (const sd of [-1, 1]) {
      c.fillStyle = d;
      c.beginPath();
      c.moveTo(sd * W(0.22) * 0.9, at(0.22));
      c.bezierCurveTo(sd * 36, at(0.23), sd * 46, at(0.29), sd * 50, at(0.36));
      c.quadraticCurveTo(sd * 36, at(0.31), sd * W(0.3) * 0.9, at(0.3));
      c.closePath();
      c.fill();
      c.stroke();
    }
    const body = bodyOutline(prof, at);
    const g = c.createLinearGradient(-30, 0, 30, 0);
    g.addColorStop(0, b);
    g.addColorStop(0.3, a);
    g.addColorStop(0.7, a);
    g.addColorStop(1, b);
    c.fillStyle = g;
    c.fill(body);
    c.save();
    c.clip(body);
    // the dark cape down the back
    c.fillStyle = d;
    c.fill(smoothPts([
      [0, at(0.09)], [9, at(0.14)], [13, at(0.3)], [10, at(0.5)], [5, at(0.66)], [0, at(0.72)], [-5, at(0.66)], [-10, at(0.5)], [-13, at(0.3)], [-9, at(0.14)],
    ]));
    // the beak a shade lighter, the crease where it meets the melon
    c.strokeStyle = 'rgba(30,40,50,0.45)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-10, at(0.072));
    c.quadraticCurveTo(0, at(0.09), 10, at(0.072));
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath();
    c.ellipse(-8, at(0.17), 5, 12, 0.1, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke(body);
    // blowhole
    c.strokeStyle = '#26323d';
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(0, at(0.155), 3.2, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    // the curved dorsal fin standing up, with its shadow
    c.fillStyle = 'rgba(20,30,40,0.3)';
    c.beginPath();
    c.moveTo(1, at(0.38));
    c.quadraticCurveTo(8, at(0.44), 15, at(0.52));
    c.lineTo(1, at(0.48));
    c.closePath();
    c.fill();
    c.fillStyle = '#2c3a48';
    c.beginPath();
    c.moveTo(0, at(0.36));
    c.quadraticCurveTo(6, at(0.42), 1.8, at(0.49));
    c.lineTo(-1.8, at(0.49));
    c.quadraticCurveTo(-6, at(0.42), 0, at(0.36));
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(-1, at(0.375));
    c.quadraticCurveTo(-4, at(0.42), -1.3, at(0.475));
    c.stroke();
    // friendly eyes on the sides of the head and a smile along the beak
    for (const sd of [-1, 1]) {
      const ex = sd * (W(0.105) - 5);
      const ey = at(0.105);
      c.fillStyle = INK;
      c.beginPath();
      c.ellipse(ex, ey, 3.4, 4.2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(ex - sd * 0.8, ey - 1.3, 1.3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(sd * 5.5, at(0.03));
      c.quadraticCurveTo(sd * 8.5, at(0.062), sd * 12, at(0.074));
      c.stroke();
    }
    c.restore();
    return;
  }
  if (skin.pattern === 'swordfish') {
    // a swordfish seen from above: the long flat sword at the front, big eyes on the sides of the head, dark blue back and
    // bronze-silver sides, long sickle pectoral fins, the tall dorsal fin standing up, keels on the tail stalk and a big
    // crescent tail
    const { y0, y1 } = shape;
    const T = y1 + RIDE_TAIL - y0;
    const at = (f: number) => y0 + T * f;
    const prof: [number, number][] = [
      [0.2, 3.5], [0.24, 9], [0.28, 17], [0.34, 25], [0.42, 28], [0.52, 25], [0.62, 18], [0.72, 10], [0.79, 5.5], [0.83, 5],
    ];
    const W = (f: number) => widthAt(prof, f);
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    // the crescent tail (it stands upright: from above a slim, deep crescent)
    c.fillStyle = d;
    c.beginPath();
    c.moveTo(-4, at(0.8));
    c.quadraticCurveTo(-6, at(0.9), -22, at(0.985));
    c.quadraticCurveTo(-4, at(0.9), 0, at(0.89));
    c.quadraticCurveTo(4, at(0.9), 22, at(0.985));
    c.quadraticCurveTo(6, at(0.9), 4, at(0.8));
    c.closePath();
    c.fill();
    c.stroke();
    // long sickle pectoral fins
    for (const sd of [-1, 1]) {
      c.fillStyle = d;
      c.beginPath();
      c.moveTo(sd * W(0.3) * 0.9, at(0.3));
      c.bezierCurveTo(sd * 40, at(0.31), sd * 54, at(0.38), sd * 62, at(0.5));
      c.quadraticCurveTo(sd * 42, at(0.42), sd * W(0.38) * 0.9, at(0.38));
      c.closePath();
      c.fill();
      c.stroke();
    }
    // the sword
    c.fillStyle = '#4a5160';
    c.beginPath();
    c.moveTo(0, at(0));
    c.quadraticCurveTo(4.5, at(0.1), 5, at(0.22));
    c.lineTo(-5, at(0.22));
    c.quadraticCurveTo(-4.5, at(0.1), 0, at(0));
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-1, at(0.02));
    c.lineTo(-1.8, at(0.2));
    c.stroke();
    const pts: [number, number][] = [[0, at(0.195)]];
    for (const [f, w] of prof) pts.push([w, at(f)]);
    for (let i = prof.length - 1; i >= 0; i--) pts.push([-prof[i][1], at(prof[i][0])]);
    const body = smoothPts(pts);
    const g = c.createLinearGradient(-28, 0, 28, 0);
    g.addColorStop(0, '#c9b07a');
    g.addColorStop(0.18, b);
    g.addColorStop(0.42, a);
    g.addColorStop(0.58, a);
    g.addColorStop(0.82, b);
    g.addColorStop(1, '#c9b07a');
    c.fillStyle = g;
    c.fill(body);
    c.save();
    c.clip(body);
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.beginPath();
    c.ellipse(-9, at(0.36), 5, 22, 0.05, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke(body);
    // keels on the tail stalk
    c.fillStyle = d;
    for (const sd of [-1, 1]) {
      c.beginPath();
      c.moveTo(sd * 4.5, at(0.76));
      c.lineTo(sd * 9.5, at(0.8));
      c.lineTo(sd * 4.5, at(0.83));
      c.closePath();
      c.fill();
      c.stroke();
    }
    // the tall dorsal fin standing up, with its shadow
    c.fillStyle = 'rgba(15,20,40,0.32)';
    c.beginPath();
    c.moveTo(1, at(0.3));
    c.quadraticCurveTo(12, at(0.36), 24, at(0.42));
    c.lineTo(1, at(0.4));
    c.closePath();
    c.fill();
    c.fillStyle = '#1c2850';
    c.beginPath();
    c.moveTo(0, at(0.28));
    c.quadraticCurveTo(5.5, at(0.34), 1.5, at(0.41));
    c.lineTo(-1.5, at(0.41));
    c.quadraticCurveTo(-5.5, at(0.34), 0, at(0.28));
    c.fill();
    // big eyes on the sides of the head
    for (const sd of [-1, 1]) {
      const ex = sd * (W(0.255) - 4);
      const ey = at(0.255);
      c.fillStyle = '#f2f4f8';
      c.beginPath();
      c.ellipse(ex, ey, 4.4, 5.4, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.stroke();
      c.fillStyle = '#10141c';
      c.beginPath();
      c.arc(ex + sd * 0.8, ey + 0.6, 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(ex - sd * 0.4, ey - 1.2, 1, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    return;
  }
  if (skin.pattern === 'carrot') {
    // a carrot: the pointed tip at the nose, rings across its orange root, the leafy green top sticking out past the tail
    const { y0, y1 } = shape;
    const hw = (shape.x1 - shape.x0) / 2;
    c.strokeStyle = INK;
    c.lineWidth = 2;
    // the leafy top: four stems with rounded leaflets, outlined as one bushy shape
    const fronds: [number, number][] = [
      [0.62, 38],
      [-0.6, 36],
      [0.2, 46],
      [-0.2, 44],
    ];
    const blobs: [number, number, number][] = [];
    const stems: [number, number, number, number][] = [];
    for (const [ang, len] of fronds) {
      const sx = 0;
      const sy = y1 - 8;
      const dx = Math.sin(-ang);
      const dy = Math.cos(ang);
      stems.push([sx, sy, sx + dx * len, sy + dy * len]);
      for (let k = 1; k <= 5; k++) {
        const t = k / 5;
        const cx = sx + dx * len * t;
        const cy = sy + dy * len * t;
        const side = k % 2 ? 1 : -1;
        const r = 6.5 - k * 0.5;
        blobs.push([cx + dy * side * r * 0.8, cy - dx * side * r * 0.8, r]);
      }
      blobs.push([sx + dx * (len + 3), sy + dy * (len + 3), 5]);
    }
    c.fillStyle = INK;
    for (const [x, y, r] of blobs) {
      c.beginPath();
      c.arc(x, y, r + 2, 0, Math.PI * 2);
      c.fill();
    }
    blobs.forEach(([x, y, r], k) => {
      c.fillStyle = k % 3 === 0 ? d : '#52b347';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    });
    c.strokeStyle = '#2b6e27';
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (const [ax, ay, bx, by] of stems) {
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
    }
    c.strokeStyle = INK;
    // the root
    const root = new Path2D();
    root.moveTo(0, y0);
    root.bezierCurveTo(hw * 0.35, y0 + 20, hw * 0.95, y1 - 50, hw * 0.95, y1 - 16);
    root.quadraticCurveTo(hw * 0.9, y1 - 2, 0, y1 - 2);
    root.quadraticCurveTo(-hw * 0.9, y1 - 2, -hw * 0.95, y1 - 16);
    root.bezierCurveTo(-hw * 0.95, y1 - 50, -hw * 0.35, y0 + 20, 0, y0);
    root.closePath();
    const g = c.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, b);
    g.addColorStop(0.35, a);
    g.addColorStop(0.65, '#ffa04a');
    g.addColorStop(1, b);
    c.fillStyle = g;
    c.fill(root);
    c.save();
    c.clip(root);
    c.strokeStyle = 'rgba(160,60,0,0.55)';
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const y = y0 + 22 + k * ((y1 - y0 - 40) / 8);
      const sd = k % 2 ? 1 : -1;
      const half = hw * Math.min(0.9, 0.25 + ((y - y0) / (y1 - y0)) * 0.9);
      c.beginPath();
      c.moveTo(sd * half * 1.1, y);
      c.quadraticCurveTo(sd * half * 0.5, y + 2.5, sd * half * 0.05, y + 1);
      c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.ellipse(-hw * 0.38, y0 + (y1 - y0) * 0.55, hw * 0.12, (y1 - y0) * 0.26, 0.06, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.lineWidth = 2.4;
    c.stroke(root);
    c.restore();
    return;
  }
  if (skin.pattern === 'rocket') {
    // a rocket: red nose cone, a white body with panel lines and rivets, a round blue window, a blue band, red fins
    // sticking out at the back, the nozzle, a flame and puffs of smoke
    const { y0, y1 } = shape;
    const hw = (shape.x1 - shape.x0) / 2 - 4;
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    // smoke and flame
    c.fillStyle = 'rgba(200,205,212,0.9)';
    for (const [x, y, r] of [
      [-10, y1 + 42, 9],
      [9, y1 + 46, 8],
      [0, y1 + 54, 7],
      [-16, y1 + 30, 6],
      [15, y1 + 33, 6],
    ] as const) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    const flame = (len: number, wd: number, col: string) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-wd, y1 + 2);
      c.quadraticCurveTo(-wd * 0.9, y1 + len * 0.6, 0, y1 + len);
      c.quadraticCurveTo(wd * 0.9, y1 + len * 0.6, wd, y1 + 2);
      c.closePath();
      c.fill();
    };
    flame(40, 11, '#ff5a1f');
    flame(30, 7.5, '#ffa52a');
    flame(18, 4, '#fff1a8');
    // fins
    for (const sd of [-1, 1]) {
      c.fillStyle = b;
      c.beginPath();
      c.moveTo(sd * hw * 0.8, y1 - 46);
      c.quadraticCurveTo(sd * (hw + 18), y1 - 30, sd * (hw + 16), y1 + 2);
      c.lineTo(sd * hw * 0.55, y1 - 8);
      c.closePath();
      c.fill();
      c.stroke();
    }
    // nozzle
    c.fillStyle = '#5b616c';
    c.beginPath();
    c.moveTo(-hw * 0.45, y1 - 10);
    c.lineTo(hw * 0.45, y1 - 10);
    c.lineTo(hw * 0.6, y1 + 3);
    c.lineTo(-hw * 0.6, y1 + 3);
    c.closePath();
    c.fill();
    c.stroke();
    // body
    const body = new Path2D();
    body.moveTo(0, y0);
    body.bezierCurveTo(hw * 0.75, y0 + 18, hw, y0 + 50, hw, y0 + 80);
    body.lineTo(hw * 0.86, y1 - 8);
    body.lineTo(-hw * 0.86, y1 - 8);
    body.lineTo(-hw, y0 + 80);
    body.bezierCurveTo(-hw, y0 + 50, -hw * 0.75, y0 + 18, 0, y0);
    body.closePath();
    const g = c.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, '#c4cad3');
    g.addColorStop(0.4, a);
    g.addColorStop(1, '#aeb5c0');
    c.fillStyle = g;
    c.fill(body);
    c.save();
    c.clip(body);
    // the nose cone
    c.fillStyle = b;
    c.beginPath();
    c.moveTo(-hw * 2, y0 + 30);
    c.quadraticCurveTo(0, y0 + 37, hw * 2, y0 + 30);
    c.lineTo(hw * 2, y0 - 10);
    c.lineTo(-hw * 2, y0 - 10);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-hw * 2, y0 + 30);
    c.quadraticCurveTo(0, y0 + 37, hw * 2, y0 + 30);
    c.stroke();
    // the blue band near the back
    c.fillStyle = d;
    c.fillRect(-hw * 2, y1 - 34, hw * 4, 9);
    c.strokeRect(-hw * 2, y1 - 34, hw * 4, 9);
    // panel lines and rivets
    c.strokeStyle = 'rgba(80,90,105,0.45)';
    c.lineWidth = 1;
    for (const y of [y0 + 78, y0 + 100]) {
      c.beginPath();
      c.moveTo(-hw, y);
      c.lineTo(hw, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(80,90,105,0.6)';
    for (const y of [y0 + 74, y0 + 96])
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.arc(k * hw * 0.38, y, 1.1, 0, Math.PI * 2);
        c.fill();
      }
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(-hw * 0.62, y0 + 34, hw * 0.16, y1 - y0 - 74);
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke(body);
    // the window
    const wy = y0 + 54;
    c.fillStyle = '#c9ced6';
    c.beginPath();
    c.arc(0, wy, hw * 0.48, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const glass = c.createRadialGradient(-hw * 0.12, wy - hw * 0.12, 1, 0, wy, hw * 0.34);
    glass.addColorStop(0, '#9fd2ff');
    glass.addColorStop(1, d);
    c.fillStyle = glass;
    c.beginPath();
    c.arc(0, wy, hw * 0.34, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 1.6;
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath();
    c.ellipse(-hw * 0.12, wy - hw * 0.12, hw * 0.08, hw * 0.13, -0.6, 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }
  if (skin.pattern === 'mouse') {
    // a mouse seen from above: grey fur, round pink-lined ears, black bead eyes, a pink nose with whiskers, two little
    // teeth, a white tummy patch and a long pink tail curling out at the back
    const { y0, y1 } = shape;
    const hw = (shape.x1 - shape.x0) / 2 - 2;
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    // the tail
    c.strokeStyle = '#c97b88';
    c.lineCap = 'round';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, y1 - 6);
    c.bezierCurveTo(4, y1 + 24, 30, y1 + 26, 26, y1 + 46);
    c.bezierCurveTo(22, y1 + 62, 2, y1 + 56, 8, y1 + 44);
    c.stroke();
    c.strokeStyle = b;
    c.lineWidth = 2.6;
    c.stroke();
    // the ears
    for (const sd of [-1, 1]) {
      const ex = sd * hw * 0.82;
      const ey = y0 + 46;
      c.fillStyle = a;
      c.beginPath();
      c.arc(ex, ey, 17, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.2;
      c.stroke();
      c.fillStyle = b;
      c.beginPath();
      c.arc(ex + sd * 1.5, ey + 1, 10.5, 0, Math.PI * 2);
      c.fill();
    }
    // the body
    const body = new Path2D();
    body.moveTo(0, y0 + 2);
    body.bezierCurveTo(hw * 0.5, y0 + 4, hw * 0.75, y0 + 34, hw * 0.85, y0 + 66);
    body.bezierCurveTo(hw * 1.02, y0 + 110, hw * 0.92, y1 - 12, 0, y1 - 4);
    body.bezierCurveTo(-hw * 0.92, y1 - 12, -hw * 1.02, y0 + 110, -hw * 0.85, y0 + 66);
    body.bezierCurveTo(-hw * 0.75, y0 + 34, -hw * 0.5, y0 + 4, 0, y0 + 2);
    body.closePath();
    const g = c.createLinearGradient(-hw, 0, hw, 0);
    g.addColorStop(0, '#7d838c');
    g.addColorStop(0.45, a);
    g.addColorStop(1, '#848a93');
    c.fillStyle = g;
    c.fill(body);
    c.save();
    c.clip(body);
    c.fillStyle = d;
    c.beginPath();
    c.ellipse(0, y1 - 46, hw * 0.52, 30, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath();
    c.ellipse(-hw * 0.35, y0 + 80, 6, 26, 0.05, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke(body);
    // whiskers
    c.strokeStyle = '#2b2b2b';
    c.lineWidth = 1.1;
    for (const sd of [-1, 1])
      for (const [dy, len, bend] of [
        [-3, 30, -4],
        [1, 32, 0],
        [5, 29, 5],
      ] as const) {
        c.beginPath();
        c.moveTo(sd * 5, y0 + 16 + dy);
        c.quadraticCurveTo(sd * (5 + len * 0.5), y0 + 14 + dy + bend * 0.5, sd * (5 + len), y0 + 13 + dy + bend * 2);
        c.stroke();
      }
    // eyes
    for (const sd of [-1, 1]) {
      c.fillStyle = '#141414';
      c.beginPath();
      c.ellipse(sd * hw * 0.32, y0 + 32, 3.8, 4.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(sd * hw * 0.32 - 1.2, y0 + 30.5, 1.3, 0, Math.PI * 2);
      c.fill();
    }
    // nose and teeth
    c.fillStyle = '#ffffff';
    c.fillRect(-3, y0 + 9, 2.8, 4.5);
    c.fillRect(0.2, y0 + 9, 2.8, 4.5);
    c.strokeStyle = INK;
    c.lineWidth = 0.9;
    c.strokeRect(-3, y0 + 9, 2.8, 4.5);
    c.strokeRect(0.2, y0 + 9, 2.8, 4.5);
    c.fillStyle = '#e8828f';
    c.beginPath();
    c.ellipse(0, y0 + 5, 5, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 1.4;
    c.stroke();
    c.restore();
    return;
  }
  if (isWingFigure(skin)) {
    drawWingFigure(c, skin);
    c.restore();
    return;
  }
  if (skin.pattern === 'moon') {
    drawMoonSail(c, skin);
    c.restore();
    return;
  }
  if (skin.pattern === 'phoenix') {
    drawPhoenix(c, skin);
    c.restore();
    return;
  }
  if (skin.pattern === 'xmasTree') {
    drawXmasTree(c, skin, shape);
    c.restore();
    return;
  }
  if (skin.pattern === 'cherry') {
    // two glossy cherries away from the rider, their stems meeting where the lines are tied, a leaf on top
    cherryPair(c, 0, 40, 1);
    c.restore();
    return;
  }
  if (skin.pattern === 'balloons') {
    const balloons: [number, number, number, string][] = [
      [-46, -38, 21, '#43a047'],
      [-14, -58, 21, '#e53935'],
      [20, -58, 21, '#fdd835'],
      [50, -36, 21, '#fb8c00'],
      [-62, -4, 19, '#e53935'],
      [-30, -20, 22, '#1e88e5'],
      [4, -28, 23, '#43a047'],
      [36, -10, 21, '#e53935'],
      [64, 6, 18, '#1e88e5'],
      [-12, 6, 21, '#fdd835'],
      [22, 16, 20, '#fb8c00'],
    ];
    // strings first, all to one knot below the bunch (the kite lines are tied to the knot)
    c.strokeStyle = '#3a3f45';
    c.lineWidth = 1.4;
    for (const [x, y, r] of balloons) {
      c.beginPath();
      c.moveTo(x, y + r * 1.12);
      c.quadraticCurveTo(x * 0.4, y + r + 30, 0, 52);
      c.stroke();
    }
    for (const [x, y, r, col] of balloons) {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(x, y, r, r * 1.12, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.stroke();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(x - 3, y + r * 1.12 + 4);
      c.lineTo(x + 3, y + r * 1.12 + 4);
      c.lineTo(x, y + r * 1.12 - 1);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.beginPath();
      c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.34, -0.5, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    const dragon = skin.pattern === 'wingDragon';
    const falcon = skin.pattern === 'falcon';
    // the wings
    for (const side of [-1, 1]) {
      const wing = wingPath(side, dragon);
      c.save();
      c.clip(wing);
      if (dragon) {
        c.fillStyle = b;
        c.fill(wing);
        // bones from the shoulder to every point of the scallops
        c.strokeStyle = a;
        c.lineWidth = 4;
        for (const [x, y] of [
          [120, 50],
          [86, 34],
          [54, 22],
          [26, 14],
        ]) {
          c.beginPath();
          c.moveTo(side * 12, -20);
          c.quadraticCurveTo(side * (x * 0.55), -40 + y * 0.2, side * x, y);
          c.stroke();
        }
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(side * 10, -24);
        c.quadraticCurveTo(side * 64, -70, side * 120, 50);
        c.stroke();
      } else {
        c.fillStyle = falcon ? a : b;
        c.fill(wing);
        // the trailing edge lighter (seagull white, falcon sandy)
        c.strokeStyle = falcon ? '#a89a8a' : a;
        c.lineWidth = 22;
        c.beginPath();
        c.moveTo(side * 120, 50);
        c.quadraticCurveTo(side * 70, 6, side * 10, 6);
        c.stroke();
        if (falcon) {
          // bars across the feathers
          c.strokeStyle = b;
          c.lineWidth = 3;
          for (let k = 1; k < 9; k++) {
            const t = k / 9;
            const lx = side * (10 + 110 * t);
            const ly = -24 + 74 * t * t - 30 * Math.sin(Math.PI * t);
            c.beginPath();
            c.moveTo(lx, ly);
            c.lineTo(lx - side * 8, ly + 26);
            c.stroke();
          }
        } else {
          // feathers
          c.strokeStyle = '#8c98a3';
          c.lineWidth = 1.5;
          for (let k = 2; k < 8; k++) {
            const t = k / 9;
            const x = side * (14 + 100 * t);
            c.beginPath();
            c.moveTo(x, 6 + 30 * t * t);
            c.lineTo(x - side * 4, 18 + 34 * t * t);
            c.stroke();
          }
        }
        // dark wing tips
        c.fillStyle = falcon ? '#3a302a' : '#22262b';
        c.beginPath();
        c.arc(side * 122, 52, 36, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.stroke(wing);
    }
    if (dragon) {
      // a curled tail with spikes
      c.strokeStyle = a;
      c.lineWidth = 11;
      c.beginPath();
      c.moveTo(0, 14);
      c.bezierCurveTo(4, 40, 30, 46, 34, 34);
      c.bezierCurveTo(37, 24, 24, 22, 24, 30);
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 1.6;
      c.stroke();
      c.fillStyle = b;
      for (const [x, y] of [
        [4, 30],
        [14, 42],
        [28, 44],
      ]) {
        c.beginPath();
        c.moveTo(x - 4, y);
        c.lineTo(x, y - 8);
        c.lineTo(x + 4, y);
        c.fill();
      }
    } else {
      // tail feathers
      c.fillStyle = falcon ? b : '#22262b';
      c.beginPath();
      c.moveTo(-9, 12);
      c.lineTo(-13, 36);
      c.quadraticCurveTo(0, 42, 13, 36);
      c.lineTo(9, 12);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.2;
      c.stroke();
    }
    // the body
    c.fillStyle = dragon ? a : falcon ? '#c9b8a3' : a;
    c.beginPath();
    c.ellipse(0, -10, dragon ? 15 : 13, 30, 0, 0, Math.PI * 2);
    c.fill();
    if (dragon) {
      c.fillStyle = d;
      c.beginPath();
      c.ellipse(0, -8, 7, 22, 0, 0, Math.PI * 2);
      c.fill();
    }
    if (falcon) {
      c.strokeStyle = b;
      c.lineWidth = 1.6;
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.moveTo(-6, -24 + k * 8);
        c.lineTo(-2, -20 + k * 8);
        c.moveTo(6, -24 + k * 8);
        c.lineTo(2, -20 + k * 8);
        c.stroke();
      }
    }
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.beginPath();
    c.ellipse(0, -10, dragon ? 15 : 13, 30, 0, 0, Math.PI * 2);
    c.stroke();
    // the head, looking where it flies
    const hy = -46;
    if (dragon) {
      c.fillStyle = '#f3e0b5';
      for (const sd of [-1, 1]) {
        c.beginPath();
        c.moveTo(sd * 5, hy - 2);
        c.quadraticCurveTo(sd * 16, hy + 2, sd * 15, hy + 14);
        c.lineTo(sd * 9, hy + 4);
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = 1.6;
        c.stroke();
      }
    }
    c.fillStyle = dragon ? a : falcon ? '#4b4f55' : a;
    c.beginPath();
    c.ellipse(0, hy, dragon ? 13 : 12, dragon ? 16 : 13, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    // beak or snout
    c.fillStyle = dragon ? a : d;
    c.beginPath();
    if (dragon) c.ellipse(0, hy - 15, 9, 9, 0, 0, Math.PI * 2);
    else {
      c.moveTo(-5, hy - 9);
      c.lineTo(0, hy - (falcon ? 21 : 24));
      c.lineTo(5, hy - 9);
    }
    c.fill();
    c.stroke();
    // eyes
    for (const sd of [-1, 1]) {
      c.fillStyle = dragon || falcon ? '#ffd23f' : '#ffffff';
      c.beginPath();
      c.arc(sd * 6, hy - 2, 3.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#15171c';
      c.beginPath();
      c.arc(sd * 6, hy - 3, 1.8, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

/** The board or boat of a skin that has one: the frame in the atlas it lies over, its outline and its bounds. */
export interface SkinBoard {
  frame: string;
  path: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** The 1990 windsurf set's wave board. */
const DAD_BOARD: SkinBoard = { frame: 'b-wind-wave', path: GEAR_PATHS.windWave, x0: -36, y0: -126, x1: 36, y1: 124 };
/** The sailing boats a skin can bring (laid over the boat of that frame; room for a swan's neck or a dragon head at the bow). */
const BOAT_BOARDS: Record<string, SkinBoard> = {
  'b-opti': { frame: 'b-opti', path: GEAR_PATHS.opti, x0: -78, y0: -126, x1: 78, y1: 134 },
  'b-hull': { frame: 'b-hull', path: PATHS.hull, x0: -90, y0: -390, x1: 90, y1: 262 },
  'b-cat': { frame: 'b-cat', path: GEAR_PATHS.catHull, x0: -186, y0: -330, x1: 186, y1: 236 },
  'b-yacht': { frame: 'b-yacht', path: GEAR_PATHS.yacht, x0: -150, y0: -460, x1: 150, y1: 390 },
};
/** The board or boat a skin brings for the gear frame a guest has (null: nothing for that frame). */
/** The foil school's big board (Matchday's football pitch). */
const FOIL_BOARD: SkinBoard = { frame: 'b-foil-big', path: GEAR_PATHS.foilBig, x0: -56, y0: -122, x1: 56, y1: 122 };
/** The freestyle windsurf board (the Moonlight galaxy board). */
const FREE_BOARD: SkinBoard = { frame: 'b-wind-free', path: GEAR_PATHS.windFree, x0: -52, y0: -120, x1: 52, y1: 122 };
export function skinBoard(skin: SkinDef, frame: string): SkinBoard | null {
  if (!skin.board) return null;
  if (skin.sport === 'foil') return frame === FOIL_BOARD.frame ? FOIL_BOARD : null;
  if (skin.sport === 'sailing') return BOAT_BOARDS[frame] ?? null;
  if (skin.pattern === 'dad90') return frame === DAD_BOARD.frame ? DAD_BOARD : null;
  if (skin.pattern === 'moon') return frame === FREE_BOARD.frame ? FREE_BOARD : null;
  return windBoard(skin, frame);
}

/** The Moonlight board: the Milky Way at night, a dark sky full of white stars with the bright, dusty band of the galaxy across it. */
function drawGalaxyBoard(c: Ctx) {
  const outline = new Path2D(FREE_BOARD.path);
  const { x0, y0, x1, y1 } = FREE_BOARD;
  const W = x1 - x0;
  const H = y1 - y0;
  const seed = 0x6a1a;
  c.save();
  c.clip(outline);
  c.fillStyle = '#05060c';
  c.fillRect(x0 - 4, y0 - 4, W + 8, H + 8);
  // the galaxy band, slanting across the board from the nose on the right to the tail on the left
  const band = (t: number) => ({ x: 34 - 64 * t + 9 * Math.sin(t * 7), y: y0 - 6 + (H + 12) * t });
  for (let i = 0; i < 60; i++) {
    const t = i / 59;
    const p = band(t);
    const r = 22 + 10 * h(seed, i);
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, 'rgba(196,200,224,0.16)');
    g.addColorStop(1, 'rgba(196,200,224,0)');
    c.fillStyle = g;
    c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  // the bright core low on the board, a little warmer
  const core = band(0.78);
  const cg = c.createRadialGradient(core.x, core.y, 0, core.x, core.y, 34);
  cg.addColorStop(0, 'rgba(236,226,214,0.38)');
  cg.addColorStop(1, 'rgba(236,226,214,0)');
  c.fillStyle = cg;
  c.fillRect(core.x - 34, core.y - 34, 68, 68);
  // the dark dust lane: soft, cloudy dark patches along one side of the band's middle
  for (let i = 0; i < 46; i++) {
    const t = 0.12 + (i / 45) * 0.82;
    const p = band(t);
    const x = p.x + 3 + 5 * (h(seed, i + 90) - 0.5);
    const r = 4 + 5 * h(seed, i + 70);
    const g = c.createRadialGradient(x, p.y, 0, x, p.y, r);
    g.addColorStop(0, 'rgba(5,6,12,0.32)');
    g.addColorStop(1, 'rgba(5,6,12,0)');
    c.fillStyle = g;
    c.fillRect(x - r, p.y - r, r * 2, r * 2);
  }
  // a crowd of faint stars in the band
  c.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 220; i++) {
    const p = band(h(seed, i + 200));
    const off = (h(seed, i + 500) + h(seed, i + 800) - 1) * 24;
    c.beginPath();
    c.arc(p.x + off, p.y + (h(seed, i + 1100) - 0.5) * 8, 0.45 + 0.5 * h(seed, i + 1400), 0, Math.PI * 2);
    c.fill();
  }
  // stars all over the sky, some big and bright with a soft glow
  for (let i = 0; i < 150; i++) {
    const x = x0 + h(seed, i + 2000) * W;
    const y = y0 + h(seed, i + 2300) * H;
    const big = i % 9 === 0;
    const r = big ? 1.9 + 0.6 * h(seed, i + 2600) : 0.6 + 0.8 * h(seed, i + 2600);
    if (big) {
      const g = c.createRadialGradient(x, y, 0, x, y, r * 3.2);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    }
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  // a dark deck pad (the stars show faintly through it) and the mast foot
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.roundRect(-30, 10, 60, 100, 18);
  c.fill();
  c.restore();
  c.strokeStyle = 'rgba(160,170,210,0.45)';
  c.lineWidth = 1.5;
  c.stroke(outline);
  c.fillStyle = '#2b2f33';
  c.beginPath();
  c.arc(0, -16, 6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#5b6168';
  c.beginPath();
  c.arc(0, -16, 2.5, 0, Math.PI * 2);
  c.fill();
}

/** Draw a skin's board design (the author's dad's 1990 wave board): sun-faded cream, a blue logo at the nose, the mast track, black and white striped deck pads. */
/** `num`: the guest's race number (painted on the Retro Racer's roundel). */
export function drawSkinBoard(c: Ctx, skin: SkinDef, frame: string, num?: number) {
  if (!skin.board) return;
  if (skin.sport === 'foil') {
    drawFoilBoard(c);
    return;
  }
  if (skin.sport === 'sailing') {
    if (frame === 'b-opti') drawSkinBoat(c, skin);
    else drawBigBoat(c, skin, frame, num);
    return;
  }
  if (skin.pattern === 'moon') {
    drawGalaxyBoard(c);
    return;
  }
  if (skin.pattern !== 'dad90') {
    drawWindBoard(c, skin, frame);
    return;
  }
  const outline = new Path2D(DAD_BOARD.path);
  c.save();
  c.clip(outline);
  const g = c.createLinearGradient(0, -124, 0, 124);
  g.addColorStop(0, '#f8ebc6');
  g.addColorStop(0.45, '#f3dc9c');
  g.addColorStop(1, '#ecd08a');
  c.fillStyle = g;
  c.fillRect(-40, -130, 80, 260);
  // a darker sun line along the rails
  c.strokeStyle = 'rgba(160,120,50,0.25)';
  c.lineWidth = 6;
  c.stroke(outline);
  // stringer
  c.strokeStyle = 'rgba(150,120,70,0.35)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, -122);
  c.lineTo(0, 122);
  c.stroke();
  // the blue logo at the nose: a P
  c.strokeStyle = '#29a8e0';
  c.lineWidth = 4.5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(-6, -72);
  c.lineTo(-6, -98);
  c.lineTo(1, -98);
  c.arc(1, -91, 7, -Math.PI / 2, Math.PI / 2);
  c.lineTo(-6, -84);
  c.stroke();
  // mast track
  c.fillStyle = '#2b2f33';
  c.beginPath();
  c.roundRect(-3.5, -44, 7, 28, 3);
  c.fill();
  c.fillStyle = '#5b6168';
  c.fillRect(-1, -41, 2, 22);
  // striped deck pads: the front pad in two halves, the rear pad with its zigzag edge
  const stripes = (pad: Path2D, angle: number) => {
    c.save();
    c.clip(pad);
    c.fillStyle = '#f1f1ee';
    c.fillRect(-40, -130, 80, 260);
    c.rotate(angle);
    c.fillStyle = '#1d2024';
    for (let x = -160; x < 160; x += 5) c.fillRect(x, -200, 2.6, 400);
    c.restore();
    c.strokeStyle = '#1d2024';
    c.lineWidth = 1;
    c.stroke(pad);
  };
  for (const sd of [-1, 1]) {
    const p = new Path2D();
    p.moveTo(sd * 1.5, -8);
    p.quadraticCurveTo(sd * 22, -16, sd * 29, -2);
    p.lineTo(sd * 30, 30);
    p.quadraticCurveTo(sd * 22, 24, sd * 16, 34);
    p.quadraticCurveTo(sd * 8, 42, sd * 1.5, 34);
    p.closePath();
    stripes(p, sd * 0.6);
  }
  const rear = new Path2D();
  rear.moveTo(-24, 54);
  rear.lineTo(24, 54);
  rear.quadraticCurveTo(30, 70, 26, 104);
  rear.lineTo(-20, 104);
  rear.lineTo(-27, 96);
  rear.lineTo(-20, 88);
  rear.lineTo(-27, 80);
  rear.lineTo(-20, 72);
  rear.lineTo(-27, 64);
  rear.closePath();
  stripes(rear, 0);
  // the little red and cream marks on the rear pad
  c.fillStyle = '#d84a3a';
  c.beginPath();
  c.moveTo(-9, 57);
  c.lineTo(-5, 65);
  c.lineTo(-13, 65);
  c.fill();
  c.fillStyle = '#f0c27a';
  c.beginPath();
  c.moveTo(5, 57);
  c.lineTo(9, 65);
  c.lineTo(1, 65);
  c.fill();
  // the small logo at the tail
  c.strokeStyle = '#3a4f5f';
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(0, 113, 5, Math.PI * 0.15, Math.PI * 1.75);
  c.stroke();
  c.restore();
  c.strokeStyle = '#b89b5c';
  c.lineWidth = 1.6;
  c.stroke(outline);
}

/** One log of a raft seen from above, along y: rounded ends, shaded like a cylinder, the cut end showing at the back. */
function logTop(c: Ctx, x: number, y0: number, y1: number, r: number, light: string, mid: string, dark: string, rings: boolean) {
  const g = c.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, dark);
  g.addColorStop(0.35, light);
  g.addColorStop(0.65, mid);
  g.addColorStop(1, dark);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - r, y0 + r * 0.5);
  c.quadraticCurveTo(x - r, y0, x, y0);
  c.quadraticCurveTo(x + r, y0, x + r, y0 + r * 0.5);
  c.lineTo(x + r, y1 - r * 0.5);
  c.quadraticCurveTo(x + r, y1, x, y1);
  c.quadraticCurveTo(x - r, y1, x - r, y1 - r * 0.5);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(30,20,10,0.55)';
  c.lineWidth = 1.4;
  c.stroke();
  if (rings) {
    // bark lines along the log
    c.strokeStyle = 'rgba(60,35,15,0.3)';
    c.lineWidth = 1;
    for (const k of [-0.45, 0.1, 0.55]) {
      c.beginPath();
      c.moveTo(x + k * r, y0 + 10);
      c.lineTo(x + k * r + 1.5, y1 - 10);
      c.stroke();
    }
  }
}

/** A rope lashing across a raft at y. */
function lashing(c: Ctx, x0: number, x1: number, y: number) {
  c.fillStyle = '#d9b77a';
  c.fillRect(x0, y - 4, x1 - x0, 8);
  c.strokeStyle = 'rgba(110,80,40,0.7)';
  c.lineWidth = 1;
  for (let x = x0 + 3; x < x1; x += 5) {
    c.beginPath();
    c.moveTo(x, y - 4);
    c.lineTo(x - 3, y + 4);
    c.stroke();
  }
  c.strokeRect(x0, y - 4, x1 - x0, 8);
}

/** A crescent moon: a disc with a bite taken out of it, turned by rot. */
function crescent(c: Ctx, x: number, y: number, r: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  c.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5);
  c.bezierCurveTo(-r * 0.25, -r * 0.62, -r * 0.25, r * 0.62, 0, r);
  c.closePath();
  c.fill();
  c.restore();
}

/** The rudder and tiller of the Optimist (the boat skins cover the boat's own). */
function optiRudder(c: Ctx, wood: string) {
  c.fillStyle = '#26354a';
  c.beginPath();
  c.roundRect(-5, 112, 10, 18, 3);
  c.fill();
  c.strokeStyle = wood;
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 118);
  c.lineTo(0, 72);
  c.stroke();
}

/** The sailing school's boats, from above, over the Optimist: the yellow boat, the night raft and the wooden raft. */
function drawSkinBoat(c: Ctx, skin: SkinDef) {
  c.save();
  if (skin.pattern === 'pinkSail') {
    const hull = new Path2D(GEAR_PATHS.opti);
    const g = c.createLinearGradient(-72, 0, 72, 0);
    g.addColorStop(0, '#f2b500');
    g.addColorStop(0.3, '#ffd23f');
    g.addColorStop(0.7, '#ffcf2e');
    g.addColorStop(1, '#e8a900');
    c.fillStyle = g;
    c.fill(hull);
    c.strokeStyle = '#b98500';
    c.lineWidth = 3;
    c.stroke(hull);
    c.fillStyle = '#fff2b8';
    c.beginPath();
    c.roundRect(-50, -70, 100, 170, 14);
    c.fill();
    c.strokeStyle = '#e8b400';
    c.lineWidth = 2;
    c.stroke();
    // a pink stripe round the gunwale
    c.strokeStyle = '#ff7eb6';
    c.lineWidth = 3;
    c.save();
    c.clip(hull);
    c.stroke(hull);
    c.restore();
    c.fillStyle = '#9aa7b2';
    c.beginPath();
    c.roundRect(-6, -10, 12, 18, 3);
    c.fill();
    optiRudder(c, '#9c7a54');
  } else {
    const night = skin.pattern === 'starMoon';
    const n = 5;
    const r = 15;
    const xs = Array.from({ length: n }, (_, k) => -60 + k * 30);
    // the logs (the middle ones a little longer)
    xs.forEach((x, k) => {
      const long = k === 1 || k === 3 ? 6 : k === 2 ? 10 : 0;
      if (night) logTop(c, x, -118 - long, 118 + long * 0.5, r, '#3d50a8', '#2a3a80', '#141c45', false);
      else logTop(c, x, -118 - long, 118 + long * 0.5, r, '#c79a62', '#a67943', '#6e4a24', true);
    });
    lashing(c, -76, 76, -82);
    lashing(c, -76, 76, 70);
    if (night) {
      // gold stars and moons painted over the logs
      c.fillStyle = '#ffd23f';
      for (const [x, y, k] of [
        [-45, -40, 9],
        [30, -100, 7],
        [48, 8, 10],
        [-30, 100, 7],
        [15, 40, 6],
      ] as const)
        star5(c, x, y, k);
      for (const [x, y, k, rot] of [
        [15, -40, 11, 0.4],
        [-48, 30, 10, -0.3],
        [50, 100, 9, 0.8],
      ] as const)
        crescent(c, x, y, k, rot);
    }
    // the steering oar at the back
    c.strokeStyle = night ? '#c9a46a' : '#8b5e34';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, 72);
    c.lineTo(0, 120);
    c.stroke();
    c.fillStyle = night ? '#c9a46a' : '#8b5e34';
    c.beginPath();
    c.ellipse(0, 126, 6, 9, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- the boats of Boat hire, Club racing and the Offshore regatta

/** Paint inside a path, then its edge. */
function paintIn(c: Ctx, path: Path2D, paint: () => void, edge: string, wd = 3) {
  c.save();
  c.clip(path);
  paint();
  c.restore();
  c.strokeStyle = edge;
  c.lineWidth = wd;
  c.stroke(path);
}

/** A chequer of squares of size q over the box. */
function chequer(c: Ctx, x0: number, y0: number, x1: number, y1: number, q: number, a: string, b: string) {
  c.fillStyle = a;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.fillStyle = b;
  for (let y = y0, j = 0; y < y1; y += q, j++) for (let x = x0, i = 0; x < x1; x += q, i++) if ((i + j) % 2) c.fillRect(x, y, q, q);
}

/** Sprinkles scattered over a box (the same every time). */
function sprinkles(c: Ctx, x0: number, y0: number, x1: number, y1: number, n: number, k: number, seed: number) {
  const cols = ['#ff5a8a', '#ffd23f', '#5ec8ff', '#7ed957', '#b57bff', '#ffffff'];
  for (let i = 0; i < n; i++) {
    c.save();
    c.translate(x0 + h(seed, i) * (x1 - x0), y0 + h(seed, i + 300) * (y1 - y0));
    c.rotate(h(seed, i + 600) * Math.PI);
    c.fillStyle = cols[i % cols.length];
    c.beginPath();
    c.roundRect(-3 * k, -1 * k, 6 * k, 2 * k, k);
    c.fill();
    c.restore();
  }
}

/** Watermelon seeds: little dark teardrops with a light glint. */
function seeds(c: Ctx, x0: number, y0: number, x1: number, y1: number, n: number, k: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = x0 + h(seed, i) * (x1 - x0);
    const y = y0 + h(seed, i + 200) * (y1 - y0);
    c.fillStyle = '#1d1d1d';
    c.beginPath();
    c.ellipse(x, y, 2.4 * k, 4 * k, h(seed, i + 400) - 0.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.arc(x - 0.7 * k, y - 1.4 * k, 0.8 * k, 0, Math.PI * 2);
    c.fill();
  }
}

/** The paint of a hull for a skin (inside the hull's outline, a box around it given). */
function hullPaint(c: Ctx, skin: SkinDef, x0: number, y0: number, x1: number, y1: number) {
  const w = x1 - x0;
  switch (skin.pattern) {
    case 'watermelon': {
      c.fillStyle = '#2f9e44';
      c.fillRect(x0, y0, w, y1 - y0);
      c.strokeStyle = '#1d6b2c';
      c.lineWidth = w * 0.07;
      for (let k = 0; k < 7; k++) {
        const x = x0 + (w * (k + 0.5)) / 7;
        c.beginPath();
        for (let y = y0; y <= y1; y += 8) c.lineTo(x + Math.sin(y * 0.06 + k) * w * 0.03, y);
        c.stroke();
      }
      break;
    }
    case 'iceCream': {
      c.fillStyle = '#e2b26a';
      c.fillRect(x0, y0, w, y1 - y0);
      c.strokeStyle = '#b9843f';
      c.lineWidth = 2;
      for (let k = -40; k < 40; k++) {
        c.beginPath();
        c.moveTo(x0 + k * 16, y0);
        c.lineTo(x0 + k * 16 + (y1 - y0), y1);
        c.stroke();
        c.beginPath();
        c.moveTo(x0 + k * 16, y0);
        c.lineTo(x0 + k * 16 - (y1 - y0), y1);
        c.stroke();
      }
      break;
    }
    case 'chequered':
      chequer(c, x0, y0, x1, y1, Math.max(14, w / 6), '#ffffff', '#1b1b1e');
      break;
    case 'retroRacer': {
      c.fillStyle = '#e0262c';
      c.fillRect(x0, y0, w, y1 - y0);
      c.fillStyle = '#ffffff';
      const cx = (x0 + x1) / 2;
      c.fillRect(cx - w * 0.2, y0, w * 0.12, y1 - y0);
      c.fillRect(cx + w * 0.08, y0, w * 0.12, y1 - y0);
      break;
    }
    case 'pirate':
      c.fillStyle = '#17191e';
      c.fillRect(x0, y0, w, y1 - y0);
      break;
    case 'compass':
      c.fillStyle = '#1c2c55';
      c.fillRect(x0, y0, w, y1 - y0);
      break;
    case 'champion': {
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#b8860b');
      g.addColorStop(0.35, '#ffe082');
      g.addColorStop(0.5, '#fff8d6');
      g.addColorStop(0.65, '#ffd54f');
      g.addColorStop(1, '#b8860b');
      c.fillStyle = g;
      c.fillRect(x0, y0, w, y1 - y0);
      break;
    }
    default:
      c.fillStyle = skin.colors[0];
      c.fillRect(x0, y0, w, y1 - y0);
  }
}

/** The edge colour of a skin's hull. */
function hullEdge(skin: SkinDef): string {
  return (
    { watermelon: '#cfeeb0', iceCream: '#8a5a2b', chequered: '#1b1b1e', retroRacer: '#8a1015', pirate: '#ffc83d', compass: '#ffc83d', champion: '#8a6100' } as Record<string, string>
  )[skin.pattern] ?? '#333333';
}

/** The inside of a dinghy's cockpit (or a catamaran's trampoline) for a skin. */
function cockpitPaint(c: Ctx, skin: SkinDef, x0: number, y0: number, x1: number, y1: number, seed: number) {
  const w = x1 - x0;
  const hh = y1 - y0;
  switch (skin.pattern) {
    case 'watermelon':
      c.fillStyle = '#ef3b4f';
      c.fillRect(x0, y0, w, hh);
      seeds(c, x0 + 6, y0 + 6, x1 - 6, y1 - 6, Math.round((w * hh) / 900), 1.2, seed);
      break;
    case 'iceCream':
      c.fillStyle = '#a8ecd2';
      c.fillRect(x0, y0, w, hh);
      sprinkles(c, x0 + 4, y0 + 4, x1 - 4, y1 - 4, Math.round((w * hh) / 300), 1.3, seed);
      break;
    case 'pirate':
    case 'compass': {
      // a teak deck
      c.fillStyle = '#b07a45';
      c.fillRect(x0, y0, w, hh);
      c.strokeStyle = 'rgba(70,40,15,0.55)';
      c.lineWidth = 1.2;
      for (let x = x0 + 8; x < x1; x += 8) {
        c.beginPath();
        c.moveTo(x, y0);
        c.lineTo(x, y1);
        c.stroke();
      }
      break;
    }
    case 'chequered':
      c.fillStyle = '#d6d9de';
      c.fillRect(x0, y0, w, hh);
      break;
    case 'champion':
      c.fillStyle = '#fffbea';
      c.fillRect(x0, y0, w, hh);
      break;
    default:
      c.fillStyle = '#f2f2f2';
      c.fillRect(x0, y0, w, hh);
  }
}

/** A white swan from above, over a hull: a plump shaded body, big folded wings with feather tips, an upturned tail,
 *  and an S-curved neck with the head and orange beak out past the bow. */
function swanTop(c: Ctx, cx: number, _hull: Path2D, half: number, bow: number, stern: number) {
  const len = stern - bow;
  const Y = (f: number) => bow + len * f;
  const edge = '#8c96a2';
  c.save();
  c.translate(cx, 0);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  // tail: an upturned pointed tuft
  c.fillStyle = '#f2f4f6';
  c.strokeStyle = edge;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-half * 0.55, Y(0.9));
  c.quadraticCurveTo(-half * 0.2, Y(1.02), 0, Y(1.08));
  c.quadraticCurveTo(half * 0.2, Y(1.02), half * 0.55, Y(0.9));
  c.closePath();
  c.fill();
  c.stroke();
  // the plump body
  const body = new Path2D();
  body.moveTo(0, Y(0.04));
  body.bezierCurveTo(half * 0.75, Y(0.06), half * 1.1, Y(0.35), half * 1.08, Y(0.6));
  body.bezierCurveTo(half * 1.05, Y(0.85), half * 0.6, Y(0.96), 0, Y(0.96));
  body.bezierCurveTo(-half * 0.6, Y(0.96), -half * 1.05, Y(0.85), -half * 1.08, Y(0.6));
  body.bezierCurveTo(-half * 1.1, Y(0.35), -half * 0.75, Y(0.06), 0, Y(0.04));
  body.closePath();
  const g = c.createRadialGradient(0, Y(0.45), half * 0.2, 0, Y(0.5), half * 1.6);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#f3f5f7');
  g.addColorStop(1, '#d3d9e0');
  c.fillStyle = g;
  c.fill(body);
  c.strokeStyle = edge;
  c.lineWidth = 2.4;
  c.stroke(body);
  // folded wings: a big feathered shape on each side, primaries fanning out at the back
  for (const sd of [-1, 1]) {
    const wing = new Path2D();
    wing.moveTo(sd * half * 0.25, Y(0.24));
    wing.bezierCurveTo(sd * half * 1.05, Y(0.22), sd * half * 1.25, Y(0.55), sd * half * 1.05, Y(0.82));
    const n = 5;
    let px = sd * half * 1.05;
    let py = Y(0.82);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const nx = sd * half * (1.05 - 0.75 * t);
      const ny = Y(0.82 + 0.12 * t);
      wing.quadraticCurveTo((px + nx) / 2 + sd * half * 0.1, (py + ny) / 2 + len * 0.045, nx, ny);
      px = nx;
      py = ny;
    }
    wing.bezierCurveTo(sd * half * 0.2, Y(0.7), sd * half * 0.15, Y(0.4), sd * half * 0.25, Y(0.24));
    // a soft shadow under the wing, then the wing
    c.save();
    c.translate(sd * 2, 3);
    c.fillStyle = 'rgba(90,105,120,0.25)';
    c.fill(wing);
    c.restore();
    const wg = c.createLinearGradient(0, Y(0.25), 0, Y(0.95));
    wg.addColorStop(0, '#ffffff');
    wg.addColorStop(1, '#e3e8ed');
    c.fillStyle = wg;
    c.fill(wing);
    c.strokeStyle = edge;
    c.lineWidth = 2;
    c.stroke(wing);
    // rows of feathers
    c.save();
    c.clip(wing);
    c.strokeStyle = 'rgba(120,132,146,0.55)';
    c.lineWidth = 1.4;
    for (let row = 0; row < 4; row++) {
      const fy = 0.42 + row * 0.11;
      for (let k = 0; k < 4; k++) {
        const fx = sd * half * (0.4 + k * 0.2);
        c.beginPath();
        c.arc(fx, Y(fy) + k * len * 0.01, half * 0.13, Math.PI * 0.1, Math.PI * 0.9);
        c.stroke();
      }
    }
    // long primary feathers at the back
    c.strokeStyle = 'rgba(110,122,136,0.7)';
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(sd * half * (0.45 + k * 0.15), Y(0.7));
      c.lineTo(sd * half * (0.38 + k * 0.17), Y(0.92));
      c.stroke();
    }
    c.restore();
  }
  // the S-curved neck
  const neck = new Path2D();
  neck.moveTo(0, Y(0.12));
  neck.bezierCurveTo(half * 0.55, Y(0.02), -half * 0.45, Y(-0.08), half * 0.1, Y(-0.17));
  const nw = half * 0.36;
  c.strokeStyle = edge;
  c.lineWidth = nw + 4;
  c.stroke(neck);
  c.strokeStyle = '#fbfcfd';
  c.lineWidth = nw;
  c.stroke(neck);
  c.strokeStyle = 'rgba(200,208,216,0.9)';
  c.lineWidth = nw * 0.25;
  c.save();
  c.translate(nw * 0.2, 0);
  c.stroke(neck);
  c.restore();
  // the head, beak forward with its black knob, eyes on the sides
  const hx = half * 0.1;
  const hy = Y(-0.19);
  c.fillStyle = '#ff8f1f';
  c.strokeStyle = '#b55a0a';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(hx - nw * 0.32, hy - nw * 0.45);
  c.quadraticCurveTo(hx, hy - nw * 2.1, hx + nw * 0.32, hy - nw * 0.45);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#fbfcfd';
  c.strokeStyle = edge;
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(hx, hy, nw * 0.62, nw * 0.8, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#1b1b1b';
  c.beginPath();
  c.ellipse(hx, hy - nw * 0.62, nw * 0.34, nw * 0.22, 0, 0, Math.PI * 2);
  c.fill();
  for (const sd of [-1, 1]) {
    c.beginPath();
    c.arc(hx + sd * nw * 0.42, hy - nw * 0.25, Math.max(1.4, nw * 0.12), 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** Round painted shields with a metal boss. */
function shield(c: Ctx, x: number, y: number, r: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3b2a18';
  c.lineWidth = 1.6;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.55)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(x - r * 0.8, y);
  c.lineTo(x + r * 0.8, y);
  c.moveTo(x, y - r * 0.8);
  c.lineTo(x, y + r * 0.8);
  c.stroke();
  c.fillStyle = '#b0b4ba';
  c.beginPath();
  c.arc(x, y, r * 0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3b2a18';
  c.lineWidth = 1;
  c.stroke();
}

/** A carved dragon head on a curved neck, from above, reaching out to -y from (0, y). */
function dragonHeadTop(c: Ctx, y: number, k: number) {
  const wood = '#7a4a22';
  c.save();
  c.translate(0, y);
  c.scale(k, k);
  c.lineCap = 'round';
  c.strokeStyle = '#3b2412';
  c.lineWidth = 22;
  c.beginPath();
  c.moveTo(0, 10);
  c.quadraticCurveTo(12, -30, 0, -62);
  c.stroke();
  c.strokeStyle = wood;
  c.lineWidth = 18;
  c.stroke();
  // scales on the neck
  c.strokeStyle = '#d4a23a';
  c.lineWidth = 1.6;
  for (let t = 0.15; t < 0.9; t += 0.15) {
    const yy = 10 - 72 * t;
    const xx = 12 * 2 * t * (1 - t);
    c.beginPath();
    c.arc(xx, yy, 6, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
  }
  // the head: snout forward, horns back, red eyes, open jaw with teeth
  const head = new Path2D('M0,-58 C14,-58 18,-70 14,-84 C12,-96 6,-104 0,-108 C-6,-104 -12,-96 -14,-84 C-18,-70 -14,-58 0,-58 Z');
  c.fillStyle = wood;
  c.fill(head);
  c.strokeStyle = '#3b2412';
  c.lineWidth = 2.4;
  c.stroke(head);
  for (const sd of [-1, 1]) {
    c.fillStyle = '#d4a23a';
    c.beginPath();
    c.moveTo(sd * 8, -64);
    c.quadraticCurveTo(sd * 26, -60, sd * 30, -44);
    c.quadraticCurveTo(sd * 20, -56, sd * 6, -58);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#e53935';
    c.beginPath();
    c.ellipse(sd * 9, -80, 3.2, 4.2, sd * 0.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    for (let t = 0; t < 3; t++) {
      c.beginPath();
      c.moveTo(sd * (11 - t * 2), -90 - t * 5);
      c.lineTo(sd * (17 - t * 2), -88 - t * 5);
      c.lineTo(sd * (11 - t * 2), -86 - t * 5);
      c.fill();
    }
  }
  c.fillStyle = '#3b2412';
  for (const sd of [-1, 1]) {
    c.beginPath();
    c.arc(sd * 3.5, -103, 1.6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** The Boat hire, Club racing and Offshore boats of the skins, from above, for each boat frame. */
function drawBigBoat(c: Ctx, skin: SkinDef, frame: string, num?: number) {
  const seed = [...skin.id].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0;
  c.save();
  c.lineJoin = 'round';
  if (frame === 'b-cat') {
    const hull = new Path2D(GEAR_PATHS.catHull);
    // trampoline
    c.save();
    c.beginPath();
    c.rect(-150, -90, 300, 220);
    c.clip();
    if (skin.pattern === 'swan') {
      c.fillStyle = '#cfe8f5';
      c.fillRect(-150, -90, 300, 220);
    } else cockpitPaint(c, skin, -150, -90, 150, 130, seed);
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 1;
    for (let k = -150; k <= 150; k += 18) {
      c.beginPath();
      c.moveTo(k, -90);
      c.lineTo(k, 130);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = '#b0bec5';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(-150, -90);
    c.lineTo(150, -90);
    c.moveTo(-150, 130);
    c.lineTo(150, 130);
    c.stroke();
    for (const x of [-150, 150]) {
      c.save();
      if (skin.pattern === 'swan') swanTop(c, x, hull, 24, -200, 196);
      else {
        c.translate(x, 0);
        paintIn(c, hull, () => hullPaint(c, skin, -26, -202, 26, 198), hullEdge(skin), 2.5);
      }
      c.restore();
    }
  } else if (frame === 'b-hull') {
    const hull = new Path2D(PATHS.hull);
    if (skin.pattern === 'swan') {
      swanTop(c, 0, hull, 72, -212, 212);
      c.fillStyle = '#e9eef2';
      c.beginPath();
      c.roundRect(-34, 60, 68, 120, 16);
      c.fill();
    } else {
      paintIn(c, hull, () => hullPaint(c, skin, -74, -214, 74, 214), hullEdge(skin), 3);
      c.save();
      c.beginPath();
      c.roundRect(-48, 52, 96, 140, 18);
      c.clip();
      cockpitPaint(c, skin, -48, 52, 48, 192, seed);
      c.restore();
      c.strokeStyle = hullEdge(skin);
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(-48, 52, 96, 140, 18);
      c.stroke();
      if (skin.pattern === 'retroRacer') {
        // the number roundel on the foredeck, ahead of the mast (the guest's own race number)
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(0, -150, 21, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#14161a';
        c.lineWidth = 2.5;
        c.stroke();
        c.fillStyle = '#14161a';
        c.font = 'bold 26px Arial';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        if (num !== undefined) c.fillText(String(num), 0, -148);
      }
      if (skin.pattern === 'pirate') {
        // gold portholes along the sides
        for (const sd of [-1, 1])
          for (const y of [-80, -20, 40, 100, 160]) {
            c.fillStyle = '#ffc83d';
            c.beginPath();
            c.arc(sd * 58, y, 6, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#2b3a52';
            c.beginPath();
            c.arc(sd * 58, y, 3.4, 0, Math.PI * 2);
            c.fill();
          }
      }
    }
    // centreboard slot, rudder and tiller
    c.fillStyle = '#9aa7b2';
    c.beginPath();
    c.roundRect(-6, 25, 12, 21, 3);
    c.fill();
    c.fillStyle = '#26354a';
    c.beginPath();
    c.roundRect(-6, 210, 12, 24, 4);
    c.fill();
    c.strokeStyle = '#9c7a54';
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, 215);
    c.lineTo(0, 148);
    c.stroke();
  } else if (frame === 'b-yacht') {
    const hull = new Path2D(GEAR_PATHS.yacht);
    if (skin.pattern === 'viking') {
      // a longship: planks along the hull, benches across, shields along the sides, a dragon head at the bow and a
      // curling tail at the stern
      dragonHeadTop(c, -318, 1.25);
      c.save();
      c.translate(0, 330);
      c.strokeStyle = '#3b2412';
      c.lineWidth = 16;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, -20);
      c.quadraticCurveTo(0, 30, 22, 36);
      c.quadraticCurveTo(40, 30, 30, 14);
      c.stroke();
      c.strokeStyle = '#7a4a22';
      c.lineWidth = 12;
      c.stroke();
      c.restore();
      paintIn(
        c,
        hull,
        () => {
          const g = c.createLinearGradient(-110, 0, 110, 0);
          g.addColorStop(0, '#5a361a');
          g.addColorStop(0.5, '#9a6a3a');
          g.addColorStop(1, '#5a361a');
          c.fillStyle = g;
          c.fillRect(-112, -334, 224, 660);
          c.strokeStyle = 'rgba(40,22,8,0.55)';
          c.lineWidth = 2;
          for (const k of [0.86, 0.72, 0.58]) {
            c.save();
            c.scale(k, 1);
            c.stroke(hull);
            c.restore();
          }
          c.fillStyle = '#b8874f';
          c.fillRect(-60, -250, 120, 520);
          c.strokeStyle = 'rgba(60,35,12,0.6)';
          c.lineWidth = 3;
          for (let y = -230; y < 270; y += 42) {
            c.beginPath();
            c.moveTo(-90, y);
            c.lineTo(90, y);
            c.stroke();
          }
        },
        '#3b2412',
        4,
      );
      const sp = spineOf({ path: GEAR_PATHS.yacht, dy: 0, x0: -108, y0: -330, x1: 108, y1: 320 });
      const cols = ['#c62828', '#f9c13a', '#1e5aa8', '#f5f0e6'];
      for (const sd of [-1, 1])
        for (let k = 0; k < 9; k++) {
          const q = beside(sp, 0.2 + k * 0.075, sd * 0.93);
          shield(c, q.x, q.y, 17, cols[(k + (sd > 0 ? 2 : 0)) % cols.length]);
        }
    } else {
      paintIn(c, hull, () => hullPaint(c, skin, -112, -334, 112, 324), hullEdge(skin), 5);
      // a gold pinstripe just inside the edge
      if (skin.pattern === 'compass') {
        c.save();
        c.clip(hull);
        c.strokeStyle = '#ffc83d';
        c.lineWidth = 2.5;
        c.save();
        c.scale(0.9, 0.97);
        c.stroke(hull);
        c.restore();
        c.restore();
      }
      c.save();
      c.clip(hull);
      cockpitPaint(c, skin, -80, 140, 80, 310, seed);
      c.restore();
      c.fillStyle = skin.pattern === 'champion' ? '#fff4c4' : '#e7eef2';
      c.beginPath();
      c.roundRect(-40, -60, 80, 120, 18);
      c.fill();
      c.strokeStyle = hullEdge(skin);
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#4a5866';
      c.beginPath();
      c.arc(0, 250, 22, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e7eef2';
      c.beginPath();
      c.arc(0, 250, 16, 0, Math.PI * 2);
      c.fill();
      if (skin.pattern === 'champion') {
        c.fillStyle = '#ffffff';
        for (const [x, y, r] of [
          [-50, -200, 9],
          [40, -120, 7],
          [-30, 100, 6],
          [55, 60, 8],
        ] as const)
          sparkle(c, x, y, r, '#ffffff');
      }
    }
  }
  c.restore();
}

/** The spinnaker of the offshore skins (its own outline, as drawn in the atlas). */
export const SPIN_BOUNDS = { x0: -156, y0: -296, x1: 186, y1: 6 };
export function hasSpinSkin(skin: SkinDef): boolean {
  return skin.pattern === 'compass' || skin.pattern === 'champion' || skin.pattern === 'viking';
}
export function drawSkinSpin(c: Ctx, skin: SkinDef) {
  const spin = new Path2D(GEAR_PATHS.spin);
  c.save();
  c.clip(spin);
  const { x0, y0, x1, y1 } = SPIN_BOUNDS;
  if (skin.pattern === 'viking') {
    for (let k = 0, x = x0; x < x1; x += 38, k++) {
      c.fillStyle = k % 2 ? '#f5f0e6' : '#c62828';
      c.fillRect(x, y0, 38, y1 - y0);
    }
  } else if (skin.pattern === 'champion') {
    for (let k = 0, x = x0; x < x1; x += 34, k++) {
      c.fillStyle = k % 2 ? '#fff1b0' : '#ffcf3a';
      c.fillRect(x, y0, 34, y1 - y0);
    }
    for (const [x, y, r] of [
      [-60, -200, 14],
      [40, -150, 18],
      [110, -220, 11],
      [-20, -80, 10],
      [90, -70, 13],
    ] as const)
      sparkle(c, x, y, r, '#ffffff');
  } else {
    c.fillStyle = '#1c2c55';
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    compassRose(c, 15, -140, 95);
  }
  c.restore();
  c.strokeStyle = skin.pattern === 'compass' ? '#ffc83d' : skin.pattern === 'champion' ? '#b8860b' : '#3b2412';
  c.lineWidth = 3;
  c.stroke(spin);
}

/** A compass rose: eight gold points (the four main ones long), two rings and an N at the top. */
function compassRose(c: Ctx, x: number, y: number, r: number) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = '#ffc83d';
  c.lineWidth = Math.max(1, r * 0.025);
  for (const rr of [0.72, 0.8]) {
    c.beginPath();
    c.arc(0, 0, r * rr, 0, Math.PI * 2);
    c.stroke();
  }
  for (let k = 0; k < 8; k++) {
    const an = (k * Math.PI) / 4 - Math.PI / 2;
    const len = k % 2 ? r * 0.55 : r;
    const wd = k % 2 ? r * 0.08 : r * 0.13;
    for (const sd of [-1, 1]) {
      c.fillStyle = sd > 0 ? '#ffc83d' : '#c9921c';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(an) * len, Math.sin(an) * len);
      c.lineTo(Math.cos(an + sd * Math.PI / 2) * wd, Math.sin(an + sd * Math.PI / 2) * wd);
      c.closePath();
      c.fill();
    }
  }
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(0, 0, r * 0.06, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffc83d';
  c.font = `bold ${Math.round(r * 0.28)}px Arial`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('N', 0, -r * 1.12);
  c.restore();
}

/** A gold trophy cup inside a laurel wreath, about r tall. */
function trophy(c: Ctx, x: number, y: number, r: number) {
  c.save();
  c.translate(x, y);
  // laurel: leaves along two arcs
  for (const sd of [-1, 1])
    for (let k = 0; k < 7; k++) {
      const an = Math.PI / 2 + sd * (0.35 + k * 0.33);
      const lx = Math.cos(an) * r * 0.95;
      const ly = Math.sin(an) * r * 0.95;
      c.save();
      c.translate(lx, ly);
      c.rotate(an + (sd * Math.PI) / 2 + sd * 0.5);
      c.fillStyle = k % 2 ? '#7cb342' : '#558b2f';
      c.beginPath();
      c.ellipse(0, 0, r * 0.09, r * 0.2, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  // the cup
  const g = c.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
  g.addColorStop(0, '#b8860b');
  g.addColorStop(0.4, '#fff3b0');
  g.addColorStop(1, '#c9921c');
  c.fillStyle = g;
  c.strokeStyle = '#7a5500';
  c.lineWidth = Math.max(1, r * 0.04);
  c.beginPath();
  c.moveTo(-r * 0.45, -r * 0.55);
  c.lineTo(r * 0.45, -r * 0.55);
  c.quadraticCurveTo(r * 0.45, r * 0.05, 0, r * 0.15);
  c.quadraticCurveTo(-r * 0.45, r * 0.05, -r * 0.45, -r * 0.55);
  c.fill();
  c.stroke();
  for (const sd of [-1, 1]) {
    c.beginPath();
    c.arc(sd * r * 0.5, -r * 0.3, r * 0.17, sd > 0 ? -Math.PI / 2 : Math.PI / 2, sd > 0 ? Math.PI / 2 : Math.PI * 1.5);
    c.lineWidth = r * 0.07;
    c.strokeStyle = '#c9921c';
    c.stroke();
  }
  c.fillStyle = g;
  c.lineWidth = Math.max(1, r * 0.04);
  c.strokeStyle = '#7a5500';
  c.fillRect(-r * 0.08, r * 0.12, r * 0.16, r * 0.25);
  c.strokeRect(-r * 0.08, r * 0.12, r * 0.16, r * 0.25);
  c.fillRect(-r * 0.3, r * 0.36, r * 0.6, r * 0.13);
  c.strokeRect(-r * 0.3, r * 0.36, r * 0.6, r * 0.13);
  sparkle(c, -r * 0.18, -r * 0.32, r * 0.1, '#ffffff');
  c.restore();
}

/** The same boats seen from the side, under the sail in the collection picture (sail coordinates: mast at x -40, foot at y 96). */
export function drawSkinHullSide(c: Ctx, skin: SkinDef) {
  c.save();
  c.lineJoin = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 2.4;
  // the mast
  c.strokeStyle = '#9aa3ad';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-40, -104);
  c.lineTo(-40, 102);
  c.stroke();
  if (skin.level >= 2) {
    drawBigHullSide(c, skin);
    c.restore();
    return;
  }
  if (skin.pattern === 'pinkSail') {
    const hull = new Path2D('M -92,98 L 96,98 L 88,124 Q 4,134 -80,124 Z');
    const g = c.createLinearGradient(0, 98, 0, 130);
    g.addColorStop(0, '#ffd84a');
    g.addColorStop(1, '#e8a900');
    c.fillStyle = g;
    c.fill(hull);
    c.fillStyle = '#ff7eb6';
    c.fillRect(-92, 98, 188, 5);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillRect(-86, 116, 176, 2.5);
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke(hull);
    // the rudder
    c.fillStyle = '#26354a';
    c.beginPath();
    c.moveTo(90, 104);
    c.lineTo(100, 104);
    c.lineTo(98, 138);
    c.lineTo(91, 136);
    c.closePath();
    c.fill();
    c.stroke();
  } else {
    const night = skin.pattern === 'starMoon';
    const light = night ? '#3d50a8' : '#c79a62';
    const dark = night ? '#1b2457' : '#7a5228';
    // the back row of logs peeking out above, then the front log
    for (const [y, rr, col] of [
      [104, 11, dark],
      [114, 13, light],
    ] as const) {
      const g = c.createLinearGradient(0, y - rr, 0, y + rr);
      g.addColorStop(0, col);
      g.addColorStop(1, dark);
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(-94, y - rr, 190, rr * 2, rr);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.stroke();
    }
    // the cut ends
    for (const x of [-88, 90]) {
      c.fillStyle = night ? '#e8d7ad' : '#e2c48f';
      c.beginPath();
      c.ellipse(x, 114, 6, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(110,70,30,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(x, 114, 3, 6.5, 0, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 1.6;
      c.beginPath();
      c.ellipse(x, 114, 6, 12, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // rope lashings
    for (const x of [-56, 50]) {
      c.fillStyle = '#d9b77a';
      c.fillRect(x - 5, 92, 10, 35);
      c.strokeStyle = 'rgba(110,80,40,0.8)';
      c.lineWidth = 1;
      for (let y = 95; y < 126; y += 5) {
        c.beginPath();
        c.moveTo(x - 5, y);
        c.lineTo(x + 5, y + 3);
        c.stroke();
      }
    }
    if (night) {
      c.fillStyle = '#ffd23f';
      star5(c, -20, 114, 6);
      star5(c, 72, 112, 5);
      crescent(c, 18, 114, 7, 0.3);
    } else {
      c.strokeStyle = 'rgba(70,40,15,0.35)';
      c.lineWidth = 1;
      for (const y of [109, 118]) {
        c.beginPath();
        c.moveTo(-84, y);
        c.lineTo(84, y + 1);
        c.stroke();
      }
    }
  }
  c.restore();
}

/** The Boat hire, Club racing and Offshore boats from the side (the yacht with its keel, the swan, the longship). */
function drawBigHullSide(c: Ctx, skin: SkinDef) {
  const seed = 11;
  const yacht = skin.level === 4;
  if (skin.pattern === 'swan') {
    // the swan: a round white body, the wing raised toward the back, the long neck and head at the bow
    c.lineWidth = 2.2;
    c.strokeStyle = '#9aa3ad';
    const body = new Path2D('M -78,98 Q -92,132 -30,136 L 66,134 Q 100,128 108,84 Q 92,98 70,96 Z');
    c.fillStyle = '#fbfbfa';
    c.fill(body);
    c.stroke(body);
    const wing = new Path2D('M -40,104 Q 10,74 92,88 Q 76,108 52,112 Q 30,116 10,114 Q -20,116 -40,104 Z');
    c.fillStyle = '#ffffff';
    c.fill(wing);
    c.stroke(wing);
    c.strokeStyle = 'rgba(150,160,170,0.7)';
    c.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(-10 + k * 22, 112);
      c.quadraticCurveTo(0 + k * 22, 98, 14 + k * 22, 96);
      c.stroke();
    }
    // neck and head
    c.lineCap = 'round';
    c.strokeStyle = '#9aa3ad';
    c.lineWidth = 15;
    c.beginPath();
    c.moveTo(-70, 106);
    c.bezierCurveTo(-96, 80, -60, 52, -80, 26);
    c.stroke();
    c.strokeStyle = '#fbfbfa';
    c.lineWidth = 12;
    c.stroke();
    c.fillStyle = '#fbfbfa';
    c.beginPath();
    c.ellipse(-86, 22, 11, 8, -0.2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#9aa3ad';
    c.lineWidth = 1.6;
    c.stroke();
    c.fillStyle = '#ff8f1f';
    c.beginPath();
    c.moveTo(-94, 18);
    c.lineTo(-114, 26);
    c.lineTo(-94, 28);
    c.closePath();
    c.fill();
    c.fillStyle = '#1b1b1b';
    c.beginPath();
    c.ellipse(-95, 22, 3, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(-86, 19, 1.8, 0, Math.PI * 2);
    c.fill();
    return;
  }
  if (skin.pattern === 'viking') {
    // the longship: a curved wooden hull swept up at both ends, the dragon head at the bow, a curled tail at the stern,
    // shields along the side
    c.lineCap = 'round';
    c.strokeStyle = '#3b2412';
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(-84, 104);
    c.bezierCurveTo(-110, 90, -112, 50, -100, 34);
    c.moveTo(92, 104);
    c.bezierCurveTo(118, 90, 124, 54, 108, 50);
    c.stroke();
    c.strokeStyle = '#7a4a22';
    c.lineWidth = 10;
    c.stroke();
    c.fillStyle = '#7a4a22';
    c.strokeStyle = '#3b2412';
    c.lineWidth = 2;
    const head = new Path2D('M -96,40 C -100,26 -112,20 -128,24 L -126,32 L -114,32 L -118,38 C -110,42 -100,44 -96,40 Z');
    c.fill(head);
    c.stroke(head);
    c.fillStyle = '#d4a23a';
    c.beginPath();
    c.moveTo(-100, 28);
    c.lineTo(-92, 12);
    c.lineTo(-96, 30);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#e53935';
    c.beginPath();
    c.arc(-108, 28, 2.4, 0, Math.PI * 2);
    c.fill();
    const hull = new Path2D('M -96,96 L 104,96 Q 98,128 62,134 L -58,134 Q -92,128 -96,96 Z');
    const g = c.createLinearGradient(0, 96, 0, 134);
    g.addColorStop(0, '#a5733f');
    g.addColorStop(1, '#5a361a');
    c.fillStyle = g;
    c.fill(hull);
    c.strokeStyle = 'rgba(40,22,8,0.6)';
    c.lineWidth = 1.4;
    for (const y of [108, 118, 127]) {
      c.beginPath();
      c.moveTo(-88, y);
      c.quadraticCurveTo(4, y + 6, 96, y - 2);
      c.stroke();
    }
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke(hull);
    const cols = ['#c62828', '#f9c13a', '#1e5aa8', '#f5f0e6'];
    for (let k = 0; k < 7; k++) shield(c, -66 + k * 25, 102, 10, cols[k % cols.length]);
    return;
  }
  // a dinghy or the yacht (deeper, with a keel): painted with the skin
  const hull = new Path2D(yacht ? 'M -100,98 L 104,98 L 92,128 Q 2,140 -86,126 Z' : 'M -92,98 L 96,98 L 88,124 Q 4,134 -80,124 Z');
  if (yacht) {
    c.fillStyle = '#2b3036';
    c.beginPath();
    c.moveTo(-4, 132);
    c.lineTo(22, 132);
    c.lineTo(16, 168);
    c.lineTo(0, 168);
    c.closePath();
    c.fill();
    c.beginPath();
    c.ellipse(8, 170, 16, 6, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.save();
  c.clip(hull);
  hullPaint(c, skin, -104, 96, 106, 142);
  if (skin.pattern === 'watermelon') {
    c.fillStyle = '#ef3b4f';
    c.fillRect(-104, 96, 210, 9);
    c.fillStyle = '#e8f5c8';
    c.fillRect(-104, 105, 210, 3);
    seeds(c, -84, 98, 90, 103, 8, 0.8, seed);
  }
  if (skin.pattern === 'iceCream') {
    c.fillStyle = '#ffb3c7';
    c.beginPath();
    c.moveTo(-104, 96);
    c.lineTo(106, 96);
    c.lineTo(106, 104);
    for (let x = 106; x >= -104; x -= 15) c.quadraticCurveTo(x - 7, 114, x - 15, 104);
    c.closePath();
    c.fill();
    sprinkles(c, -90, 97, 96, 104, 14, 0.8, seed);
  }
  if (skin.pattern === 'retroRacer') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(-46, 112, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#14161a';
    c.font = 'bold 13px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('7', -46, 113);
  }
  if (skin.pattern === 'pirate' || skin.pattern === 'compass') {
    c.fillStyle = '#ffc83d';
    c.fillRect(-104, 100, 210, 3);
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      c.arc(-60 + k * 30, 113, 4.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#2b3a52';
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      c.arc(-60 + k * 30, 113, 2.6, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
  c.strokeStyle = INK;
  c.lineWidth = 2.4;
  c.stroke(hull);
  if (!yacht) {
    c.fillStyle = '#26354a';
    c.beginPath();
    c.moveTo(90, 104);
    c.lineTo(100, 104);
    c.lineTo(98, 138);
    c.lineTo(91, 136);
    c.closePath();
    c.fill();
    c.stroke();
  }
}

// ---------------------------------------------------------------- the wing sport (foil)

/** A football pitch filling a box: mowed stripes, the lines, the centre circle, both penalty areas. */
function pitch(c: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const w = x1 - x0;
  const hh = y1 - y0;
  for (let k = 0; k < 12; k++) {
    c.fillStyle = k % 2 ? '#4caf50' : '#43a047';
    c.fillRect(x0, y0 + (hh * k) / 12, w, hh / 12 + 1);
  }
  const m = 9;
  const L = { x0: x0 + m, y0: y0 + m, x1: x1 - m, y1: y1 - m };
  const cx = (L.x0 + L.x1) / 2;
  const cy = (L.y0 + L.y1) / 2;
  const pw = L.x1 - L.x0;
  c.strokeStyle = '#ffffff';
  c.fillStyle = '#ffffff';
  c.lineWidth = 2;
  c.strokeRect(L.x0, L.y0, pw, L.y1 - L.y0);
  c.beginPath();
  c.moveTo(L.x0, cy);
  c.lineTo(L.x1, cy);
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, pw * 0.22, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(cx, cy, 2.2, 0, Math.PI * 2);
  c.fill();
  for (const end of [-1, 1]) {
    const gy = end < 0 ? L.y0 : L.y1;
    const pd = (L.y1 - L.y0) * 0.16;
    const gd = (L.y1 - L.y0) * 0.065;
    c.strokeRect(cx - pw * 0.32, end < 0 ? gy : gy - pd, pw * 0.64, pd);
    c.strokeRect(cx - pw * 0.15, end < 0 ? gy : gy - gd, pw * 0.3, gd);
    c.beginPath();
    c.arc(cx, gy - end * pd * 0.72, 1.8, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(cx, gy - end * pd, pw * 0.14, end < 0 ? Math.PI * 0.15 : Math.PI * 1.15, end < 0 ? Math.PI * 0.85 : Math.PI * 1.85);
    c.stroke();
  }
}

/** Croc scales: a grid of soft rounded squares over a box. */
function crocScales(c: Ctx, x0: number, y0: number, x1: number, y1: number, q: number) {
  c.strokeStyle = 'rgba(25,60,25,0.55)';
  c.lineWidth = 1.2;
  for (let y = y0, j = 0; y < y1; y += q, j++)
    for (let x = x0 + (j % 2) * q * 0.5; x < x1; x += q) {
      c.beginPath();
      c.roundRect(x + 1, y + 1, q - 2, q - 2, q * 0.35);
      c.stroke();
    }
}

/** The foil school board of the friend's set, from above: Matchday's football pitch. */
function drawFoilBoard(c: Ctx) {
  const board = new Path2D(GEAR_PATHS.foilBig);
  c.save();
  paintIn(c, board, () => pitch(c, -52, -118, 52, 118), '#ffffff', 3);
  c.strokeStyle = '#2e7d32';
  c.lineWidth = 1.5;
  c.stroke(board);
  c.restore();
}

/** The middle strut of a wing (in the wing's skin coordinates). */
function wingStrut(c: Ctx) {
  c.strokeStyle = 'rgba(70,78,88,0.75)';
  c.lineWidth = 3.5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -80);
  c.lineTo(0, 24);
  c.stroke();
}

/**
 * The Matchday club logo at (x, y), r its half width (after the author's club badge, without its text and its name
 * band): a shield with a pointed top, curled top corners, a waist under them and a pointed bottom; a red rim, a thick
 * white band, red inside, and a big white football with red seams.
 */
function clubCrest(c: Ctx, x: number, y: number, r: number, white: string, red: string) {
  c.save();
  c.translate(x, y);
  c.scale(r, r);
  const shield = new Path2D();
  shield.moveTo(0, -1.18);
  shield.quadraticCurveTo(0.44, -0.92, 1.0, -1.08);
  shield.bezierCurveTo(0.9, -0.98, 0.8, -0.86, 0.86, -0.7);
  shield.bezierCurveTo(0.74, -0.5, 1.02, -0.32, 1.02, 0.04);
  shield.bezierCurveTo(1.02, 0.56, 0.52, 0.92, 0, 1.2);
  shield.bezierCurveTo(-0.52, 0.92, -1.02, 0.56, -1.02, 0.04);
  shield.bezierCurveTo(-1.02, -0.32, -0.74, -0.5, -0.86, -0.7);
  shield.bezierCurveTo(-0.8, -0.86, -0.9, -0.98, -1.0, -1.08);
  shield.quadraticCurveTo(-0.44, -0.92, 0, -1.18);
  shield.closePath();
  c.lineJoin = 'round';
  // the white band with its thin red rim, then the red inside
  c.fillStyle = white;
  c.fill(shield);
  c.strokeStyle = red;
  c.lineWidth = 0.07;
  c.stroke(shield);
  c.save();
  c.translate(0, 0.02);
  c.scale(0.8, 0.82);
  c.fillStyle = red;
  c.fill(shield);
  c.restore();
  // the football: white panels, red seams (a pentagon in the middle, seams out to the five around it)
  const bx = 0;
  const by = -0.1;
  const R = 0.6;
  c.fillStyle = white;
  c.beginPath();
  c.arc(bx, by, R, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.arc(bx, by, R, 0, Math.PI * 2);
  c.clip();
  c.strokeStyle = red;
  c.lineWidth = 0.065;
  const at = (rr: number, an: number) => [bx + Math.cos(an) * rr, by + Math.sin(an) * rr] as const;
  const a0 = -Math.PI / 2;
  // the middle pentagon
  c.beginPath();
  for (let k = 0; k < 5; k++) {
    const [px, py] = at(0.2, a0 + (k * Math.PI * 2) / 5);
    if (k === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.stroke();
  for (let k = 0; k < 5; k++) {
    const an = a0 + (k * Math.PI * 2) / 5;
    // a seam out from each corner, forking into the pentagons round the edge
    const [ax, ay] = at(0.2, an);
    const [bx2, by2] = at(0.4, an);
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx2, by2);
    c.stroke();
    for (const sd of [-1, 1]) {
      const [cx2, cy2] = at(0.5, an + sd * 0.42);
      c.beginPath();
      c.moveTo(bx2, by2);
      c.lineTo(cx2, cy2);
      c.stroke();
      const [dx2, dy2] = at(0.66, an + sd * 0.5);
      c.beginPath();
      c.moveTo(cx2, cy2);
      c.lineTo(dx2, dy2);
      c.stroke();
    }
  }
  c.restore();
  c.strokeStyle = red;
  c.lineWidth = 0.07;
  c.beginPath();
  c.arc(bx, by, R, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

/** A five-petal flower. */
function flower(c: Ctx, x: number, y: number, r: number, petal: string, mid: string, rot: number) {
  c.fillStyle = petal;
  for (let k = 0; k < 5; k++) {
    const an = rot + (k * Math.PI * 2) / 5;
    c.beginPath();
    c.ellipse(x + Math.cos(an) * r * 0.55, y + Math.sin(an) * r * 0.55, r * 0.5, r * 0.36, an, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = mid;
  c.beginPath();
  c.arc(x, y, r * 0.3, 0, Math.PI * 2);
  c.fill();
}

/** A dollar bill: green with a pale border, a round portrait spot and a $. */
function bill(c: Ctx, x: number, y: number, w: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  const hh = w * 0.48;
  c.fillStyle = '#5fae5a';
  c.fillRect(-w / 2, -hh / 2, w, hh);
  c.strokeStyle = '#2e6b2c';
  c.lineWidth = Math.max(1, w * 0.04);
  c.strokeRect(-w / 2, -hh / 2, w, hh);
  c.strokeStyle = '#c8ecc0';
  c.lineWidth = Math.max(0.8, w * 0.03);
  c.strokeRect(-w / 2 + w * 0.07, -hh / 2 + w * 0.07, w - w * 0.14, hh - w * 0.14);
  c.fillStyle = '#c8ecc0';
  c.beginPath();
  c.arc(0, 0, hh * 0.32, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#2e6b2c';
  c.font = `bold ${Math.round(hh * 0.5)}px Arial`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('$', 0, hh * 0.03);
  c.restore();
}

/** Draw a skin in the shape's own coordinates (call with the canvas already moved to the pivot). */
export function drawSkin(c: Ctx, skin: SkinDef, shape: SkinShape) {
  const [a, b, d] = skin.colors;
  const { x0, y0, x1, y1 } = shape;
  const w = x1 - x0;
  const hh = y1 - y0;
  const s = Math.max(w, hh) / 200;
  const seed = [...skin.id].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0;
  if (isFigure(skin)) {
    c.save();
    c.translate(0, shape.dy);
    drawFigure(c, skin, shape);
    c.restore();
    return;
  }
  c.save();
  c.translate(0, shape.dy);
  const outline = new Path2D(shape.path);
  c.save();
  c.clip(outline);
  c.translate(0, -shape.dy);
  const fill = (col: string) => {
    c.fillStyle = col;
    c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
  };
  const long = hh >= w; // pattern direction follows the long side
  switch (skin.pattern) {
    case 'stripes': {
      fill(a);
      c.save();
      c.rotate(long ? 0.5 : -0.5);
      for (let k = -10; k < 10; k++) {
        c.fillStyle = k % 3 === 0 ? d : b;
        c.fillRect(-300, k * 30 * s, 600, (k % 3 === 0 ? 5 : 12) * s);
      }
      c.restore();
      break;
    }
    case 'dots': {
      fill(a);
      for (let i = 0; i < 90; i++) {
        c.fillStyle = i % 3 ? b : d;
        c.beginPath();
        c.arc(x0 + h(seed, i) * w, y0 + h(seed, i + 500) * hh, (4 + 6 * h(seed, i + 900)) * s, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'split': {
      fill(a);
      c.fillStyle = b;
      c.beginPath();
      c.moveTo(x0 - 10, y1 + 10);
      c.lineTo(x1 + 10, y0 + hh * 0.35);
      c.lineTo(x1 + 10, y1 + 10);
      c.fill();
      c.strokeStyle = d;
      c.lineWidth = 6 * s;
      c.beginPath();
      c.moveTo(x0 - 10, y1 + 10);
      c.lineTo(x1 + 10, y0 + hh * 0.35);
      c.stroke();
      break;
    }
    case 'checkers': {
      const q = 18 * s;
      for (let y = y0 - q; y < y1 + q; y += q)
        for (let x = x0 - q; x < x1 + q; x += q) {
          c.fillStyle = Math.round((x - x0) / q + (y - y0) / q) % 2 ? b : a;
          c.fillRect(x, y, q + 0.5, q + 0.5);
        }
      c.fillStyle = d;
      c.fillRect(x0 - 10, (y0 + y1) / 2 - 4 * s, w + 20, 8 * s);
      break;
    }
    case 'waves': {
      fill(a);
      for (let k = 0; k < 12; k++) {
        c.strokeStyle = k % 2 ? b : d;
        c.lineWidth = (k % 2 ? 7 : 3) * s;
        c.beginPath();
        const y = y0 + (k / 12) * hh;
        for (let x = x0 - 10; x <= x1 + 10; x += 4) {
          const yy = y + Math.sin((x / w) * Math.PI * 4 + k) * 8 * s;
          if (x === x0 - 10) c.moveTo(x, yy);
          else c.lineTo(x, yy);
        }
        c.stroke();
      }
      break;
    }
    case 'chevrons': {
      fill(a);
      c.lineWidth = 10 * s;
      c.lineJoin = 'miter';
      for (let k = -8; k < 12; k++) {
        c.strokeStyle = k % 2 ? b : d;
        const y = y0 + k * 26 * s;
        c.beginPath();
        c.moveTo(x0 - 10, y + 30 * s);
        c.lineTo((x0 + x1) / 2, y);
        c.lineTo(x1 + 10, y + 30 * s);
        c.stroke();
      }
      break;
    }
    case 'palms': {
      fill(a);
      for (let i = 0; i < 7; i++) {
        const px = x0 + h(seed, i) * w;
        const py = y0 + h(seed, i + 40) * hh;
        c.fillStyle = b;
        for (let k = 0; k < 6; k++) {
          c.save();
          c.translate(px, py);
          c.rotate((k / 6) * Math.PI * 2 + h(seed, i + 80));
          c.beginPath();
          c.ellipse(16 * s, 0, 16 * s, 5 * s, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
        c.fillStyle = d;
        c.beginPath();
        c.arc(px, py, 4 * s, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'sunset': {
      const g = long ? c.createLinearGradient(0, y0, 0, y1) : c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, d);
      g.addColorStop(0.45, b);
      g.addColorStop(1, a);
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.arc((x0 + x1) / 2, y0 + hh * 0.6, Math.min(w, hh) * 0.28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = darker(a, 0.25);
      for (let k = 0; k < 4; k++) c.fillRect(x0 - 10, y0 + hh * (0.62 + k * 0.08), w + 20, 3 * s);
      break;
    }
    case 'zebra':
    case 'tiger': {
      fill(a);
      c.fillStyle = b;
      for (let k = 0; k < 14; k++) {
        const y = y0 + (k / 14) * hh;
        const left = k % 2 === 0;
        c.beginPath();
        c.moveTo(left ? x0 - 10 : x1 + 10, y);
        c.quadraticCurveTo((x0 + x1) / 2 + (left ? -1 : 1) * w * 0.1, y + 10 * s, left ? x0 + w * (0.55 + 0.3 * h(seed, k)) : x1 - w * (0.55 + 0.3 * h(seed, k)), y + 4 * s);
        c.quadraticCurveTo((x0 + x1) / 2, y + 14 * s, left ? x0 - 10 : x1 + 10, y + (skin.pattern === 'tiger' ? 9 : 13) * s);
        c.fill();
      }
      if (skin.pattern === 'zebra') {
        c.strokeStyle = d;
        c.lineWidth = 4 * s;
        c.beginPath();
        c.moveTo((x0 + x1) / 2, y0);
        c.lineTo((x0 + x1) / 2, y1);
        c.stroke();
      }
      break;
    }
    case 'camo': {
      fill(a);
      for (let i = 0; i < 40; i++) {
        c.fillStyle = i % 2 ? b : d;
        c.beginPath();
        const cx = x0 + h(seed, i) * w;
        const cy = y0 + h(seed, i + 100) * hh;
        c.ellipse(cx, cy, (10 + 14 * h(seed, i + 200)) * s, (6 + 10 * h(seed, i + 300)) * s, h(seed, i + 400) * 3, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'hibiscus': {
      fill(a);
      for (let i = 0; i < 6; i++) {
        const px = x0 + h(seed, i) * w;
        const py = y0 + h(seed, i + 40) * hh;
        c.fillStyle = b;
        for (let k = 0; k < 5; k++) {
          const an = (k / 5) * Math.PI * 2;
          c.beginPath();
          c.arc(px + Math.cos(an) * 9 * s, py + Math.sin(an) * 9 * s, 8 * s, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = d;
        c.beginPath();
        c.arc(px, py, 4 * s, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'flames': {
      fill(a);
      // flames rise from the back (the tail of a board, the foot of a sail) toward the front
      for (const [col, f] of [
        [b, 1],
        [d, 0.55],
      ] as const) {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(x0 - 10, y1 + 10);
        const n = 7;
        for (let k = 0; k <= n; k++) {
          const x = x0 - 10 + ((w + 20) * k) / n;
          const tip = y1 - hh * f * (0.45 + 0.35 * h(seed, k + (f < 1 ? 50 : 0)));
          c.quadraticCurveTo(x - (w / n) * 0.5, y1 - hh * f * 0.25, x, tip);
        }
        c.lineTo(x1 + 10, y1 + 10);
        c.fill();
      }
      break;
    }
    case 'lightning': {
      fill(a);
      for (let i = 0; i < 3; i++) {
        let x = x0 + w * (0.25 + 0.25 * i);
        let y = y0 - 5;
        c.strokeStyle = d;
        c.lineWidth = 9 * s;
        c.lineJoin = 'miter';
        c.beginPath();
        c.moveTo(x, y);
        while (y < y1 + 10) {
          x += (h(seed, Math.floor(y) + i * 99) - 0.5) * 40 * s;
          y += 22 * s;
          c.lineTo(x, y);
        }
        c.stroke();
        c.strokeStyle = b;
        c.lineWidth = 4 * s;
        c.stroke();
      }
      break;
    }
    case 'gold': {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, b);
      g.addColorStop(0.35, a);
      g.addColorStop(0.5, d);
      g.addColorStop(0.65, a);
      g.addColorStop(1, b);
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 3 * s;
      for (let k = 0; k < 6; k++) {
        c.beginPath();
        c.moveTo(x0 + w * (k / 6), y0);
        c.lineTo(x0 + w * (k / 6) - w * 0.3, y1);
        c.stroke();
      }
      break;
    }
    case 'galaxy':
    case 'stars': {
      fill(a);
      if (skin.pattern === 'galaxy') {
        for (let i = 0; i < 5; i++) {
          const cx = x0 + h(seed, i) * w;
          const cy = y0 + h(seed, i + 9) * hh;
          const r = (40 + 50 * h(seed, i + 19)) * s;
          const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, b);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g;
          c.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
      for (let i = 0; i < 70; i++) {
        c.fillStyle = skin.pattern === 'stars' && i % 4 === 0 ? b : d;
        const r = (skin.pattern === 'stars' && i % 4 === 0 ? 3.5 : 1.4) * s;
        c.beginPath();
        c.arc(x0 + h(seed, i + 30) * w, y0 + h(seed, i + 300) * hh, r, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'dragon': {
      fill(a);
      const sp = spineOf(shape);
      // a winding dragon along the gear, head at the front, a flame tail at the back
      const pt = (u: number) => beside(sp, u, Math.sin(u * Math.PI * 3.2) * 0.3);
      const body = (u: number) => sp.at(u).half * (0.5 - 0.22 * u);
      for (const [col, extra] of [
        [d, 3 * s],
        [b, 0],
      ] as const) {
        c.fillStyle = col;
        for (let u = 0.2; u <= 0.9; u += 0.006) {
          const p = pt(u);
          c.beginPath();
          c.arc(p.x, p.y, body(u) + extra, 0, Math.PI * 2);
          c.fill();
        }
      }
      // scales and a golden spine
      c.strokeStyle = darker(b, 0.35);
      c.lineWidth = 1.3 * s;
      for (let u = 0.24; u <= 0.86; u += 0.035) {
        const p = pt(u);
        c.beginPath();
        c.arc(p.x, p.y, body(u) * 0.55, p.ang + Math.PI * 0.6, p.ang + Math.PI * 1.4);
        c.stroke();
      }
      c.fillStyle = d;
      for (let u = 0.25; u <= 0.88; u += 0.05) {
        const p = pt(u);
        c.beginPath();
        c.arc(p.x, p.y, body(u) * 0.22, 0, Math.PI * 2);
        c.fill();
      }
      // legs
      for (const u of [0.32, 0.62]) {
        const p = pt(u);
        for (const side of [-1, 1]) {
          const q = beside(sp, u + 0.03, Math.sin((u + 0.03) * Math.PI * 3.2) * 0.3 + side * 0.75);
          c.strokeStyle = b;
          c.lineWidth = body(u) * 0.55;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(q.x, q.y);
          c.stroke();
          c.fillStyle = d;
          c.beginPath();
          c.arc(q.x, q.y, body(u) * 0.3, 0, Math.PI * 2);
          c.fill();
        }
      }
      // the tail flame
      const t = pt(0.9);
      c.fillStyle = d;
      c.beginPath();
      c.ellipse(t.x, t.y, body(0.9) * 1.5, body(0.9) * 0.8, t.ang, 0, Math.PI * 2);
      c.fill();
      // the head
      const hd = pt(0.17);
      const hr = body(0.2) * 1.2;
      c.save();
      c.translate(hd.x, hd.y);
      c.rotate(hd.ang + Math.PI);
      c.fillStyle = d;
      c.beginPath();
      c.moveTo(-hr * 0.2, -hr * 0.9);
      c.lineTo(-hr * 1.6, -hr * 1.5);
      c.lineTo(-hr * 0.6, -hr * 0.4);
      c.moveTo(-hr * 0.2, hr * 0.9);
      c.lineTo(-hr * 1.6, hr * 1.5);
      c.lineTo(-hr * 0.6, hr * 0.4);
      c.fill();
      c.fillStyle = b;
      c.beginPath();
      c.ellipse(hr * 0.3, 0, hr * 1.3, hr * 0.85, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = d;
      c.lineWidth = 1.6 * s;
      c.stroke();
      c.fillStyle = d;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(hr * 0.35, side * hr * 0.42, hr * 0.2, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = d;
      c.lineWidth = 1.4 * s;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(hr * 1.4, side * hr * 0.3);
        c.quadraticCurveTo(hr * 2.2, side * hr * 1.4, hr * 1.6, side * hr * 1.9);
        c.stroke();
      }
      c.restore();
      break;
    }
    case 'money': {
      fill(a);
      for (let i = 0; i < 26; i++) {
        const cx = x0 + h(seed, i) * w;
        const cy = y0 + h(seed, i + 70) * hh;
        const bw = 52 * s;
        const bh = 26 * s;
        c.save();
        c.translate(cx, cy);
        c.rotate((h(seed, i + 140) - 0.5) * 1.6);
        c.fillStyle = b;
        c.fillRect(-bw / 2, -bh / 2, bw, bh);
        c.strokeStyle = d;
        c.lineWidth = 1.6 * s;
        c.strokeRect(-bw / 2 + 2.5 * s, -bh / 2 + 2.5 * s, bw - 5 * s, bh - 5 * s);
        c.fillStyle = a;
        c.beginPath();
        c.arc(0, 0, bh * 0.32, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = d;
        c.font = `900 ${bh * 0.52}px sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('$', 0, bh * 0.03);
        c.restore();
      }
      // two big dollar coins
      const sp = spineOf(shape);
      for (const u of [0.3, 0.7]) {
        const p = sp.at(u);
        const r = Math.min(p.half * 0.6, 26 * s);
        c.fillStyle = d;
        c.beginPath();
        c.arc(p.x, p.y, r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = b;
        c.font = `900 ${r * 1.4}px sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('$', p.x, p.y + r * 0.06);
      }
      break;
    }
    case 'lava': {
      fill(a);
      // glowing cracks and pools of lava on dark rock
      for (let i = 0; i < 9; i++) {
        const cx = x0 + h(seed, i) * w;
        const cy = y0 + h(seed, i + 30) * hh;
        const r = (22 + 26 * h(seed, i + 60)) * s;
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, d);
        g.addColorStop(0.45, b);
        g.addColorStop(1, 'rgba(255,90,31,0)');
        c.fillStyle = g;
        c.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      c.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        let x = x0 + h(seed, i + 90) * w;
        let y = y0 + h(seed, i + 120) * hh;
        let an = h(seed, i + 150) * Math.PI * 2;
        c.strokeStyle = i % 3 ? b : d;
        c.lineWidth = (i % 3 ? 3.5 : 2) * s;
        c.beginPath();
        c.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          an += (h(seed, i * 7 + k + 200) - 0.5) * 1.6;
          x += Math.cos(an) * 16 * s;
          y += Math.sin(an) * 16 * s;
          c.lineTo(x, y);
        }
        c.stroke();
      }
      break;
    }
    case 'cosmic': {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, '#120634');
      g.addColorStop(0.5, a);
      g.addColorStop(1, '#120634');
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      for (let i = 0; i < 4; i++) {
        const cx = x0 + h(seed, i) * w;
        const cy = y0 + h(seed, i + 9) * hh;
        const r = (45 + 40 * h(seed, i + 19)) * s;
        const rg = c.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, b);
        rg.addColorStop(1, 'rgba(176,77,255,0)');
        c.fillStyle = rg;
        c.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      // golden rings around the middle, like a magic circle
      const mid = spineOf(shape).at(0.5);
      c.strokeStyle = d;
      c.globalAlpha = 0.85;
      for (const [r, lw] of [
        [0.5, 1.6],
        [0.78, 1],
        [1.15, 1.8],
      ]) {
        c.lineWidth = lw * s;
        c.beginPath();
        c.arc(mid.x, mid.y, mid.half * r * 1.6, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      for (let i = 0; i < 60; i++) {
        c.fillStyle = i % 5 ? '#ffffff' : d;
        c.beginPath();
        c.arc(x0 + h(seed, i + 30) * w, y0 + h(seed, i + 300) * hh, (i % 5 ? 1.2 : 1.8) * s, 0, Math.PI * 2);
        c.fill();
      }
      for (let i = 0; i < 6; i++) sparkle(c, x0 + h(seed, i + 600) * w, y0 + h(seed, i + 700) * hh, (6 + 6 * h(seed, i + 800)) * s, i % 2 ? '#fffbe0' : d);
      break;
    }
    case 'shark': {
      fill(a);
      const sp = spineOf(shape);
      // white belly on the back half, a toothy grin and an angry eye at the front
      c.fillStyle = b;
      c.beginPath();
      for (let u = 0; u <= 1.001; u += 0.02) {
        const p = beside(sp, u, 0.25 + 0.15 * Math.sin(u * Math.PI));
        if (u === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
      for (let u = 1; u >= -0.001; u -= 0.02) {
        const p = beside(sp, u, 1.4);
        c.lineTo(p.x, p.y);
      }
      c.fill();
      // mouth
      c.strokeStyle = d;
      c.lineWidth = 2.4 * s;
      c.beginPath();
      for (let u = 0.52; u <= 0.88; u += 0.01) {
        const p = beside(sp, u, 0.28 + 0.15 * Math.sin(u * Math.PI));
        if (u === 0.52) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
      c.stroke();
      c.fillStyle = '#ffffff';
      for (let u = 0.54; u < 0.86; u += 0.04) {
        const p = beside(sp, u, 0.28 + 0.15 * Math.sin(u * Math.PI));
        const q = beside(sp, u + 0.02, 0.28 + 0.15 * Math.sin(u * Math.PI) - 0.3);
        const r = beside(sp, u + 0.04, 0.28 + 0.15 * Math.sin((u + 0.04) * Math.PI));
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.lineTo(r.x, r.y);
        c.fill();
        c.strokeStyle = darker('#ffffff', 0.4);
        c.lineWidth = 0.8 * s;
        c.stroke();
      }
      // eye with a frown
      const e = beside(sp, 0.7, -0.3);
      const er = Math.min(e.half * 0.3, 12 * s);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(e.x, e.y, er, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = d;
      c.beginPath();
      c.arc(e.x + Math.cos(e.ang) * er * 0.3, e.y + Math.sin(e.ang) * er * 0.3, er * 0.55, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = d;
      c.lineWidth = 2.6 * s;
      const b1 = beside(sp, 0.64, -0.55);
      const b2 = beside(sp, 0.76, -0.42);
      c.beginPath();
      c.moveTo(b1.x, b1.y);
      c.lineTo(b2.x, b2.y);
      c.stroke();
      // gills
      c.lineWidth = 1.6 * s;
      c.strokeStyle = darker(a, 0.3);
      for (const u of [0.38, 0.42, 0.46]) {
        const p = beside(sp, u, -0.5);
        const q = beside(sp, u - 0.015, 0.1);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      break;
    }
    case 'seagull': {
      fill(a);
      const sp = spineOf(shape);
      // grey wing tops with dark tips, feather lines, a head with a yellow beak in the middle
      c.fillStyle = b;
      c.beginPath();
      for (let u = 0; u <= 1.001; u += 0.02) {
        const p = beside(sp, u, -0.05 - 0.25 * Math.sin(u * Math.PI));
        if (u === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
      for (let u = 1; u >= -0.001; u -= 0.02) {
        const p = beside(sp, u, -1.4);
        c.lineTo(p.x, p.y);
      }
      c.fill();
      for (const [u0, u1] of [
        [0, 0.12],
        [0.88, 1],
      ]) {
        c.fillStyle = '#26292e';
        c.beginPath();
        const steps = 8;
        for (let k = 0; k <= steps; k++) {
          const p = beside(sp, u0 + ((u1 - u0) * k) / steps, k % 2 ? 1.4 : -1.4);
          if (k === 0) c.moveTo(p.x, p.y);
          else c.lineTo(p.x, p.y);
        }
        c.lineTo(beside(sp, u1, -1.4).x, beside(sp, u1, -1.4).y);
        c.lineTo(beside(sp, u0, -1.4).x, beside(sp, u0, -1.4).y);
        c.fill();
        const p0 = beside(sp, u0, 0);
        const p1 = beside(sp, u1, 0);
        c.beginPath();
        const end = u0 === 0 ? p0 : p1;
        c.arc(end.x, end.y, end.half * 1.2 + 14 * s, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = darker(b, 0.15);
      c.lineWidth = 1.5 * s;
      for (let u = 0.14; u < 0.88; u += 0.05) {
        if (Math.abs(u - 0.5) < 0.08) continue;
        const p = beside(sp, u, 0.2);
        const q = beside(sp, u + 0.03, 0.95);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      const hd = beside(sp, 0.5, -0.45);
      const hr = Math.min(hd.half * 0.45, 18 * s);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(hd.x, hd.y, hr, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = darker(b, 0.2);
      c.lineWidth = 1.2 * s;
      c.stroke();
      const nx = Math.sin(hd.ang);
      const ny = -Math.cos(hd.ang);
      c.fillStyle = d;
      c.beginPath();
      c.moveTo(hd.x + nx * hr * 0.6 - ny * hr * 0.35, hd.y + ny * hr * 0.6 + nx * hr * 0.35);
      c.lineTo(hd.x + nx * hr * 1.9, hd.y + ny * hr * 1.9);
      c.lineTo(hd.x + nx * hr * 0.6 + ny * hr * 0.35, hd.y + ny * hr * 0.6 - nx * hr * 0.35);
      c.fill();
      c.fillStyle = '#1b1f24';
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(hd.x + nx * hr * 0.25 + Math.cos(hd.ang) * side * hr * 0.45, hd.y + ny * hr * 0.25 + Math.sin(hd.ang) * side * hr * 0.45, hr * 0.14, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'pirate': {
      fill(a);
      // gold coins scattered, a skull and crossbones in the middle
      for (let i = 0; i < 14; i++) {
        const cx = x0 + h(seed, i) * w;
        const cy = y0 + h(seed, i + 50) * hh;
        const r = (5 + 4 * h(seed, i + 90)) * s;
        c.fillStyle = d;
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = darker(d, 0.35);
        c.lineWidth = 1 * s;
        c.stroke();
      }
      const m = spineOf(shape).at(0.5);
      const r = Math.min(m.half * 0.55, 26 * s);
      c.save();
      c.translate(m.x, m.y);
      c.strokeStyle = b;
      c.lineCap = 'round';
      c.lineWidth = r * 0.32;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(-r * 1.5, side * r * 1.5);
        c.lineTo(r * 1.5, -side * r * 1.5);
        c.stroke();
        for (const end of [-1, 1]) {
          c.fillStyle = b;
          c.beginPath();
          c.arc(end * r * 1.5 - end * r * 0.1, -end * side * r * 1.5, r * 0.25, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.fillStyle = b;
      c.beginPath();
      c.arc(0, -r * 0.15, r, 0, Math.PI * 2);
      c.fill();
      c.fillRect(-r * 0.55, r * 0.5, r * 1.1, r * 0.55);
      c.fillStyle = a;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.arc(side * r * 0.38, -r * 0.15, r * 0.27, 0, Math.PI * 2);
        c.fill();
      }
      c.beginPath();
      c.moveTo(0, r * 0.15);
      c.lineTo(-r * 0.12, r * 0.38);
      c.lineTo(r * 0.12, r * 0.38);
      c.fill();
      c.restore();
      break;
    }
    case 'bands': {
      fill(a);
      // wide slanted bands across the canopy with a thin light line beside each (a printed kite)
      const sp = spineOf(shape);
      for (let u = 0.06; u < 1; u += 0.2) {
        c.fillStyle = b;
        const p1 = beside(sp, u, -1.6);
        const p2 = beside(sp, u + 0.09, -1.6);
        const p3 = beside(sp, u + 0.03, 1.6);
        const p4 = beside(sp, u - 0.06, 1.6);
        c.beginPath();
        c.moveTo(p1.x, p1.y);
        c.lineTo(p2.x, p2.y);
        c.lineTo(p3.x, p3.y);
        c.lineTo(p4.x, p4.y);
        c.fill();
        c.strokeStyle = d;
        c.lineWidth = 3 * s;
        const q1 = beside(sp, u + 0.12, -1.6);
        const q2 = beside(sp, u + 0.06, 1.6);
        c.beginPath();
        c.moveTo(q1.x, q1.y);
        c.lineTo(q2.x, q2.y);
        c.stroke();
      }
      break;
    }
    case 'starry': {
      fill(a);
      const sp = spineOf(shape);
      c.fillStyle = d;
      for (let i = 0; i < 16; i++) {
        const p = beside(sp, (i + 0.5) / 16, (h(seed, i) - 0.5) * 1.3);
        star5(c, p.x, p.y, Math.max(3 * s, p.half * (0.22 + 0.12 * h(seed, i + 40))));
      }
      break;
    }
    case 'banana': {
      fill(a);
      const sp = spineOf(shape);
      // a darker ripe band along the inside, a brown stalk at one end and a green tip at the other
      c.fillStyle = b;
      c.beginPath();
      for (let u = 0; u <= 1.001; u += 0.02) {
        const p = beside(sp, u, 0.45);
        if (u === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
      for (let u = 1; u >= -0.001; u -= 0.02) {
        const p = beside(sp, u, 1.6);
        c.lineTo(p.x, p.y);
      }
      c.fill();
      for (const [u, col, r] of [
        [0, d, 0.07],
        [1, '#8bc34a', 0.1],
      ] as const) {
        const p = sp.at(u);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, (r / 0.07) * 18 * s);
        g.addColorStop(0, col);
        g.addColorStop(0.6, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(p.x - 40 * s, p.y - 40 * s, 80 * s, 80 * s);
      }
      break;
    }
    case 'road': {
      fill(a);
      const sp = spineOf(shape);
      // a red and white kerb along the front edge, a white edge line and a dashed middle line
      for (let u = 0, k = 0; u < 1; u += 0.04, k++) {
        c.fillStyle = k % 2 ? b : d;
        const p1 = beside(sp, u, -1.6);
        const p2 = beside(sp, u + 0.041, -1.6);
        const p3 = beside(sp, u + 0.041, -0.62);
        const p4 = beside(sp, u, -0.62);
        c.beginPath();
        c.moveTo(p1.x, p1.y);
        c.lineTo(p2.x, p2.y);
        c.lineTo(p3.x, p3.y);
        c.lineTo(p4.x, p4.y);
        c.fill();
      }
      c.strokeStyle = b;
      c.lineWidth = 2.5 * s;
      c.beginPath();
      for (let u = 0; u <= 1.001; u += 0.02) {
        const p = beside(sp, u, 0.62);
        if (u === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
      c.stroke();
      c.lineWidth = 3 * s;
      for (let u = 0.03; u < 1; u += 0.09) {
        const p1 = beside(sp, u, 0);
        const p2 = beside(sp, u + 0.045, 0);
        c.beginPath();
        c.moveTo(p1.x, p1.y);
        c.lineTo(p2.x, p2.y);
        c.stroke();
      }
      break;
    }
    case 'cherryBands': {
      // three bands along the gear, red at the front, green, black at the back, and a pair of cherries in the middle
      const sp = spineOf(shape);
      const band = (o0: number, o1: number, col: string) => {
        c.fillStyle = col;
        c.beginPath();
        for (let u = -0.02; u <= 1.021; u += 0.02) {
          const p = beside(sp, u, o0);
          if (u <= -0.019) c.moveTo(p.x, p.y);
          else c.lineTo(p.x, p.y);
        }
        for (let u = 1.02; u >= -0.021; u -= 0.02) {
          const p = beside(sp, u, o1);
          c.lineTo(p.x, p.y);
        }
        c.closePath();
        c.fill();
      };
      fill(b);
      band(-2, -0.36, a);
      band(0.36, 2, d);
      const m = sp.at(0.5);
      cherryPair(c, m.x, m.y + m.half * 0.55, Math.min(0.42, (m.half * 1.6) / 120));
      break;
    }
    case 'drops': {
      // water: a blue board, lighter down the middle, covered in glossy water drops of every size, all pointing to the nose
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, b, 0.35);
      railShade(c, shape, d, 0.45);
      let i = 0;
      for (let row = 0; row < 10; row++) {
        const u = 0.04 + row * 0.103;
        for (const o of row % 2 ? [-0.45, 0.4] : [-0.8, -0.03, 0.76]) {
          i++;
          const p = beside(sp, u + (h(seed, i) - 0.5) * 0.035, o + (h(seed, i + 40) - 0.5) * 0.22);
          const big = h(seed, i + 80);
          const r = sp.at(0.5).half * (0.15 + 0.13 * big);
          waterDrop(c, p.x, p.y, r, p.ang - Math.PI / 2, d);
          // a tiny droplet beside some of them
          if (big > 0.55) {
            const q = beside(sp, u + 0.045, o + (o > 0 ? -0.42 : 0.42));
            waterDrop(c, q.x, q.y, r * 0.38, q.ang - Math.PI / 2, d);
          }
        }
      }
      break;
    }
    case 'inferno': {
      // hot-rod flames: black at the nose glowing to deep red at the tail, long flame tongues (red, orange, yellow) licking
      // up the board from the tail
      const sp = spineOf(shape);
      const g = long ? c.createLinearGradient(0, y0, 0, y1) : c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, a);
      g.addColorStop(0.4, a);
      g.addColorStop(0.78, '#4d0905');
      g.addColorStop(1, b);
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      // [offset at the tail, u of the tip, sideways curl, width]
      const tongues: [number, number, number, number][] = [
        [-1.0, 0.36, 0.55, 0.42],
        [1.0, 0.3, -0.6, 0.42],
        [-0.45, 0.5, -0.4, 0.36],
        [0.48, 0.44, 0.38, 0.36],
        [0, 0.2, 0.25, 0.38],
      ];
      const layers: [string, number, number][] = [
        [b, 1, 1],
        ['#ff7a12', 0.66, 0.86],
        ['#ffd23f', 0.32, 0.68],
      ];
      for (const [col, k, reach] of layers) {
        c.fillStyle = col;
        for (const [o, tip, curl, wd] of tongues) c.fill(flameTongue(sp, o, tip, curl, wd * k, reach));
      }
      // glowing embers up toward the nose
      for (let k = 0; k < 7; k++) {
        const p = beside(sp, 0.12 + k * 0.05 + h(seed, k) * 0.04, (h(seed, k + 20) - 0.5) * 1.5);
        c.fillStyle = k % 2 ? '#ff7a12' : '#ffd23f';
        c.globalAlpha = 0.85;
        c.beginPath();
        c.arc(p.x, p.y, (1.2 + h(seed, k + 9) * 1.4) * s, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      break;
    }
    case 'log': {
      // a wooden board: strips of wood in slightly different tones glued side by side, a dark stringer down the middle,
      // the grain running along each strip, a knot or two, and a glossy varnish shine
      const sp = spineOf(shape);
      fill(a);
      const tones = ['#e3b273', '#cf9555', '#ecc184', '#c98d4e', '#dfab6a', '#d49d5e'];
      const edges = [-1.4, -0.7, -0.36, -0.045, 0.045, 0.36, 0.7, 1.4];
      for (let k = 0; k < edges.length - 1; k++) {
        const lo = edges[k];
        const hi = edges[k + 1];
        const strip = new Path2D();
        for (let i = 0; i <= 24; i++) {
          const q = beside(sp, -0.05 + (1.1 * i) / 24, lo);
          if (i === 0) strip.moveTo(q.x, q.y);
          else strip.lineTo(q.x, q.y);
        }
        for (let i = 24; i >= 0; i--) {
          const q = beside(sp, -0.05 + (1.1 * i) / 24, hi);
          strip.lineTo(q.x, q.y);
        }
        strip.closePath();
        c.fillStyle = k === 3 ? d : tones[k % tones.length];
        c.fill(strip);
        if (k === 3) continue;
        // the grain: thin wavy lines along the strip
        c.save();
        c.clip(strip);
        c.strokeStyle = 'rgba(90,45,15,0.2)';
        c.lineWidth = 0.9 * s;
        for (let g = 0; g < 4; g++) {
          const o0 = lo + ((hi - lo) * (g + 0.5)) / 4;
          const ph = h(seed, k * 10 + g) * 6;
          c.beginPath();
          for (let i = 0; i <= 40; i++) {
            const u = -0.05 + (1.1 * i) / 40;
            const q = beside(sp, u, o0 + 0.035 * Math.sin(u * 14 + ph) + 0.02 * Math.sin(u * 37 + ph * 2));
            if (i === 0) c.moveTo(q.x, q.y);
            else c.lineTo(q.x, q.y);
          }
          c.stroke();
        }
        c.restore();
        // the glue line between strips
        c.strokeStyle = 'rgba(70,35,10,0.45)';
        c.lineWidth = 0.8 * s;
        c.stroke(lineU(sp, -0.05, 1.05, hi));
      }
      // knots
      for (const [u, o] of [
        [0.3, -0.55],
        [0.68, 0.55],
      ]) {
        const q = beside(sp, u, o);
        for (let r = 3; r >= 1; r--) {
          c.strokeStyle = 'rgba(80,40,12,0.5)';
          c.lineWidth = 0.9 * s;
          c.beginPath();
          c.ellipse(q.x, q.y, r * 2.2 * s, r * 3.6 * s, q.ang - Math.PI / 2, 0, Math.PI * 2);
          c.stroke();
        }
        c.fillStyle = 'rgba(80,40,12,0.6)';
        c.beginPath();
        c.ellipse(q.x, q.y, 1.6 * s, 2.6 * s, q.ang - Math.PI / 2, 0, Math.PI * 2);
        c.fill();
      }
      railShade(c, shape, b, 0.4);
      // varnish: a long soft shine down one side
      c.strokeStyle = 'rgba(255,248,230,0.32)';
      c.lineCap = 'round';
      c.lineWidth = sp.at(0.5).half * 0.16;
      c.stroke(lineU(sp, 0.12, 0.78, -0.5));
      c.strokeStyle = 'rgba(255,248,230,0.5)';
      c.lineWidth = sp.at(0.5).half * 0.06;
      c.stroke(lineU(sp, 0.18, 0.6, -0.5));
      break;
    }
    case 'coral': {
      // a sandy board grown over with coral: pink branching coral, orange sea fans, purple brain coral, little yellow and
      // blue reef fish in between
      const sp = spineOf(shape);
      const R = sp.at(0.5).half;
      fill(a);
      spineGlow(c, sp, '#fffaf0', 0.7);
      railShade(c, shape, '#e8c48e', 0.6);
      const spots = scatter(sp, seed, 900, () => R * 0.36, 0.86);
      spots.forEach((p, k) => {
        const kind = k % 4;
        const rot = (h(seed, k + 50) - 0.5) * 1.2 + (k % 4 === 3 ? Math.PI / 2 : 0);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(rot);
        const r = p.r;
        if (kind === 0) coralBranch(c, r, '#ff6f91', '#c2416a');
        else if (kind === 1) seaFan(c, r, '#ff9a3c', '#c9661c');
        else if (kind === 2) brainCoral(c, r, '#a066c9', '#6c3b91');
        else reefFish(c, r * 0.8, k % 8 === 3 ? '#ffd23f' : '#3aa0ff', k % 8 === 3 ? '#1d4fa0' : '#ffd23f');
        c.restore();
      });
      break;
    }
    case 'lighthouse': {
      // the red lighthouse of Nazaré: red and white bands down the board, the lamp room at the nose (a dark roof, glowing
      // glass behind its bars, a railing) and the light shining down the middle
      const sp = spineOf(shape);
      fill(b);
      for (let k = 0; k < 5; k++) {
        const u0 = 0.2 + k * 0.17;
        const band = new Path2D();
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 8; i++) pts.push(beside(sp, u0, -1.5 + (3 * i) / 8));
        for (let i = 8; i >= 0; i--) pts.push(beside(sp, u0 + 0.085, -1.5 + (3 * i) / 8));
        pts.forEach((q, i) => (i ? band.lineTo(q.x, q.y) : band.moveTo(q.x, q.y)));
        band.closePath();
        c.fillStyle = a;
        c.fill(band);
      }
      // the light beam
      const top = beside(sp, 0.1, 0);
      const end = beside(sp, 0.95, 0);
      const beam = c.createLinearGradient(top.x, top.y, end.x, end.y);
      beam.addColorStop(0, 'rgba(255,224,110,0.75)');
      beam.addColorStop(1, 'rgba(255,224,110,0)');
      c.fillStyle = beam;
      const bl = beside(sp, 0.95, -0.55);
      const br = beside(sp, 0.95, 0.55);
      c.beginPath();
      c.moveTo(top.x, top.y);
      c.lineTo(bl.x, bl.y);
      c.lineTo(br.x, br.y);
      c.closePath();
      c.fill();
      // the lamp room
      const roof = new Path2D();
      const r0 = beside(sp, 0.075, -1.5);
      roof.moveTo(r0.x, r0.y);
      for (const o of [1.5]) {
        const q = beside(sp, 0.075, o);
        roof.lineTo(q.x, q.y);
      }
      const nose = beside(sp, -0.05, 0);
      roof.lineTo(nose.x, nose.y);
      roof.closePath();
      c.fillStyle = '#2b2b30';
      c.fill(roof);
      const glass = new Path2D();
      const gp = [beside(sp, 0.075, -1.5), beside(sp, 0.075, 1.5), beside(sp, 0.16, 1.5), beside(sp, 0.16, -1.5)];
      gp.forEach((q, i) => (i ? glass.lineTo(q.x, q.y) : glass.moveTo(q.x, q.y)));
      glass.closePath();
      const gc = beside(sp, 0.12, 0);
      const glow = c.createRadialGradient(gc.x, gc.y, 1, gc.x, gc.y, sp.at(0.12).half * 1.4);
      glow.addColorStop(0, '#fffbe0');
      glow.addColorStop(0.5, d);
      glow.addColorStop(1, '#e6a21a');
      c.fillStyle = glow;
      c.fill(glass);
      c.strokeStyle = '#2b2b30';
      c.lineWidth = 1.4 * s;
      for (const o of [-0.5, 0, 0.5]) {
        const p = beside(sp, 0.075, o);
        const q = beside(sp, 0.16, o);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      // the railing round the lamp room
      c.lineWidth = 2.6 * s;
      c.stroke(lineU(sp, 0.165, 0.165, 0));
      c.beginPath();
      const ra = beside(sp, 0.17, -1.5);
      const rb = beside(sp, 0.17, 1.5);
      c.moveTo(ra.x, ra.y);
      c.lineTo(rb.x, rb.y);
      c.stroke();
      c.lineWidth = 1 * s;
      for (let k = -4; k <= 4; k++) {
        const p = beside(sp, 0.17, k * 0.25);
        const q = beside(sp, 0.195, k * 0.25);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      break;
    }
    case 'sardine': {
      // the board is a sardine: a blue-green back down the middle, silver sides full of scales, a row of dark spots along
      // each side, the head at the nose with its eyes and gill covers, the forked tail painted at the tail
      const sp = spineOf(shape);
      const R = sp.at(0.5).half;
      fill(b);
      // scales
      c.strokeStyle = 'rgba(80,120,145,0.35)';
      c.lineWidth = 0.9 * s;
      for (let row = 0; row < 26; row++) {
        const u = 0.2 + row * 0.026;
        for (let k = -6; k <= 6; k++) {
          const o = k * 0.22 + (row % 2) * 0.11;
          const q = beside(sp, u, o);
          c.beginPath();
          c.arc(q.x, q.y, R * 0.13, q.ang - Math.PI * 0.5 + Math.PI * 0.15, q.ang + Math.PI * 0.5 - Math.PI * 0.15);
          c.stroke();
        }
      }
      // the dark back, fading into the silver
      for (const [w, al] of [
        [0.85, 0.25],
        [0.62, 0.4],
        [0.42, 0.65],
        [0.25, 0.9],
      ] as const) {
        c.strokeStyle = a;
        c.globalAlpha = al;
        c.lineCap = 'round';
        c.lineWidth = R * w;
        c.stroke(lineU(sp, 0.05, 0.86, 0));
      }
      c.globalAlpha = 1;
      // a shiny line between back and belly
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1.4 * s;
      for (const sd of [-1, 1]) c.stroke(lineU(sp, 0.2, 0.86, sd * 0.5));
      // the dark spots along each side
      c.fillStyle = '#1d3b4f';
      for (const sd of [-1, 1])
        for (let k = 0; k < 5; k++) {
          const q = beside(sp, 0.24 + k * 0.06, sd * 0.42);
          c.beginPath();
          c.arc(q.x, q.y, R * 0.07, 0, Math.PI * 2);
          c.fill();
        }
      // the head: gill covers and eyes
      c.strokeStyle = '#3d5d70';
      c.lineWidth = 1.6 * s;
      c.beginPath();
      for (let i = 0; i <= 16; i++) {
        const o = -1.2 + (2.4 * i) / 16;
        const q = beside(sp, 0.17 - 0.04 * o * o, o);
        if (i === 0) c.moveTo(q.x, q.y);
        else c.lineTo(q.x, q.y);
      }
      c.stroke();
      for (const sd of [-1, 1]) {
        const e = beside(sp, 0.085, sd * 0.55);
        c.fillStyle = '#f6f2d8';
        c.beginPath();
        c.arc(e.x, e.y, e.half * 0.34, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#3d5d70';
        c.lineWidth = 1.2 * s;
        c.stroke();
        c.fillStyle = '#10161c';
        c.beginPath();
        c.arc(e.x, e.y, e.half * 0.2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(e.x - e.half * 0.06, e.y - e.half * 0.07, e.half * 0.06, 0, Math.PI * 2);
        c.fill();
      }
      // the tail fin: a fork of fin rays at the tail
      const tail = new Path2D();
      const t0 = beside(sp, 0.84, -1.5);
      tail.moveTo(t0.x, t0.y);
      const tm = beside(sp, 0.84, 1.5);
      tail.lineTo(tm.x, tm.y);
      for (const [u, o] of [
        [1.1, 1.5],
        [0.93, 0],
        [1.1, -1.5],
      ]) {
        const q = beside(sp, u, o);
        tail.lineTo(q.x, q.y);
      }
      tail.closePath();
      c.fillStyle = d;
      c.fill(tail);
      c.save();
      c.clip(tail);
      c.strokeStyle = 'rgba(45,80,105,0.55)';
      c.lineWidth = 1 * s;
      for (let k = -5; k <= 5; k++) {
        const p = beside(sp, 0.86, k * 0.06);
        const q = beside(sp, 1.05, k * 0.3);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      c.restore();
      c.strokeStyle = '#3d5d70';
      c.lineWidth = 1.4 * s;
      c.beginPath();
      c.moveTo(t0.x, t0.y);
      c.lineTo(tm.x, tm.y);
      c.stroke();
      break;
    }
    case 'puck': {
      // a black puck: a soft sheen, a thin cream ring and a darker middle
      const R = Math.min(w, hh) / 2 - 5;
      const g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.1);
      g.addColorStop(0, '#3a3e47');
      g.addColorStop(1, a);
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      c.strokeStyle = b;
      c.lineWidth = R * 0.06;
      c.beginPath();
      c.arc(0, 0, R * 0.78, 0, Math.PI * 2);
      c.stroke();
      const m = c.createRadialGradient(-R * 0.15, -R * 0.2, R * 0.05, 0, 0, R * 0.56);
      m.addColorStop(0, '#454a55');
      m.addColorStop(1, d);
      c.fillStyle = m;
      c.beginPath();
      c.arc(0, 0, R * 0.56, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = R * 0.03;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = R * 0.07;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(0, 0, R * 0.9, Math.PI * 1.1, Math.PI * 1.45);
      c.stroke();
      break;
    }
    case 'football': {
      // a football seen from above: a black pentagon in the middle, five more toward the edge (squashed by the curve of the
      // ball), the seams between the white hexagons, shading for the round ball
      const R = Math.min(w, hh) / 2 - 3;
      fill(a);
      const pent = (cx: number, cy: number, r: number, rot: number, squash: number) => {
        c.save();
        c.translate(cx, cy);
        c.rotate(rot);
        c.scale(1, squash);
        c.beginPath();
        for (let k = 0; k < 5; k++) {
          const an = -Math.PI / 2 + (k * Math.PI * 2) / 5;
          const px = Math.cos(an) * r;
          const py = Math.sin(an) * r;
          if (k === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
        c.restore();
        c.fill();
      };
      c.fillStyle = b;
      c.strokeStyle = '#8a8d94';
      c.lineWidth = Math.max(1, R * 0.03);
      c.lineJoin = 'round';
      const r1 = R * 0.3;
      pent(0, 0, r1, 0, 1);
      for (let k = 0; k < 5; k++) {
        const an = -Math.PI / 2 + (k * Math.PI * 2) / 5;
        // seam from the middle pentagon's corner out to the outer one
        c.beginPath();
        c.moveTo(Math.cos(an) * r1, Math.sin(an) * r1);
        c.lineTo(Math.cos(an) * R * 0.66, Math.sin(an) * R * 0.66);
        c.stroke();
        // seams between the outer pentagons
        const mid = an + Math.PI / 5;
        c.beginPath();
        c.moveTo(Math.cos(an) * R * 0.66 + Math.cos(mid) * 0, Math.sin(an) * R * 0.66);
        c.lineTo(Math.cos(mid) * R * 0.78, Math.sin(mid) * R * 0.78);
        c.lineTo(Math.cos(an + (Math.PI * 2) / 5) * R * 0.66, Math.sin(an + (Math.PI * 2) / 5) * R * 0.66);
        c.stroke();
        c.beginPath();
        c.moveTo(Math.cos(mid) * R * 0.78, Math.sin(mid) * R * 0.78);
        c.lineTo(Math.cos(mid) * R * 1.05, Math.sin(mid) * R * 1.05);
        c.stroke();
        c.fillStyle = b;
        pent(Math.cos(an) * R * 0.86, Math.sin(an) * R * 0.86, R * 0.27, an + Math.PI / 2, 0.62);
      }
      const sh = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.02);
      sh.addColorStop(0, 'rgba(255,255,255,0.35)');
      sh.addColorStop(0.55, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(40,50,70,0.4)');
      c.fillStyle = sh;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      break;
    }
    case 'dartboard': {
      // a dartboard: the black number ring, twenty segments in black and cream, the red and green double and treble rings,
      // the green outer bull and the red bullseye, thin silver wires
      const R = Math.min(w, hh) / 2 - 2;
      fill(a);
      const seg = (r0: number, r1: number, col: (k: number) => string) => {
        for (let k = 0; k < 20; k++) {
          const s0 = -Math.PI / 2 - Math.PI / 20 + (k * Math.PI) / 10;
          c.fillStyle = col(k);
          c.beginPath();
          c.arc(0, 0, r1, s0, s0 + Math.PI / 10);
          c.arc(0, 0, r0, s0 + Math.PI / 10, s0, true);
          c.closePath();
          c.fill();
        }
      };
      seg(0.12 * R, 0.8 * R, (k) => (k % 2 ? b : '#1d1d1f'));
      seg(0.72 * R, 0.8 * R, (k) => (k % 2 ? '#1f8a4c' : d));
      seg(0.44 * R, 0.51 * R, (k) => (k % 2 ? '#1f8a4c' : d));
      c.fillStyle = '#1f8a4c';
      c.beginPath();
      c.arc(0, 0, 0.12 * R, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = d;
      c.beginPath();
      c.arc(0, 0, 0.055 * R, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(210,214,220,0.8)';
      c.lineWidth = Math.max(0.6, R * 0.012);
      for (const rr of [0.12, 0.44, 0.51, 0.72, 0.8]) {
        c.beginPath();
        c.arc(0, 0, rr * R, 0, Math.PI * 2);
        c.stroke();
      }
      for (let k = 0; k < 20; k++) {
        const an = -Math.PI / 2 - Math.PI / 20 + (k * Math.PI) / 10;
        c.beginPath();
        c.moveTo(Math.cos(an) * 0.12 * R, Math.sin(an) * 0.12 * R);
        c.lineTo(Math.cos(an) * 0.8 * R, Math.sin(an) * 0.8 * R);
        c.stroke();
      }
      // the number ring: little marks where the numbers sit
      c.fillStyle = 'rgba(240,240,240,0.75)';
      for (let k = 0; k < 20; k++) {
        const an = -Math.PI / 2 + (k * Math.PI) / 10;
        c.beginPath();
        c.arc(Math.cos(an) * 0.9 * R, Math.sin(an) * 0.9 * R, R * 0.028, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'diagonal':
    case 'sunny': {
      // bold diagonal bands; the sunny one has little red dots in its yellow
      fill(a);
      c.save();
      c.rotate(-0.62);
      const step = Math.max(w, hh) * 0.2;
      const R = Math.max(w, hh);
      c.fillStyle = b;
      for (let k = -6; k <= 6; k++) c.fillRect(-R, k * step, R * 2, step * 0.48);
      if (skin.pattern === 'sunny') {
        c.fillStyle = d;
        for (let k = -6; k <= 6; k++)
          for (let j = -6; j <= 6; j++) {
            const x = j * step * 0.62 + (k % 2) * step * 0.31;
            const y = k * step + step * 0.74;
            c.beginPath();
            c.arc(x, y, step * 0.065, 0, Math.PI * 2);
            c.fill();
          }
      }
      c.restore();
      const sp = spineOf(shape);
      railShade(c, shape, skin.pattern === 'sunny' ? '#e07a10' : d, 0.4);
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineCap = 'round';
      c.lineWidth = sp.at(0.5).half * 0.14;
      c.stroke(lineU(sp, 0.15, 0.7, -0.55));
      break;
    }
    case 'racing': {
      // racing stripes down the board: blue, white, red in the middle, white, blue
      const sp = spineOf(shape);
      fill(a);
      const band = (lo: number, hi: number, col: string) => {
        const p = new Path2D();
        for (let i = 0; i <= 24; i++) {
          const q = beside(sp, -0.05 + (1.1 * i) / 24, lo);
          if (i === 0) p.moveTo(q.x, q.y);
          else p.lineTo(q.x, q.y);
        }
        for (let i = 24; i >= 0; i--) {
          const q = beside(sp, -0.05 + (1.1 * i) / 24, hi);
          p.lineTo(q.x, q.y);
        }
        p.closePath();
        c.fillStyle = col;
        c.fill(p);
      };
      band(-0.5, 0.5, b);
      band(-0.2, 0.2, d);
      railShade(c, shape, '#123c80', 0.35);
      c.strokeStyle = 'rgba(255,255,255,0.3)';
      c.lineCap = 'round';
      c.lineWidth = sp.at(0.5).half * 0.1;
      c.stroke(lineU(sp, 0.15, 0.65, -0.75));
      break;
    }
    case 'bolt': {
      // a glowing lightning bolt down a stormy navy board, little cracks of light branching off it
      const sp = spineOf(shape);
      const g = long ? c.createLinearGradient(0, y0, 0, y1) : c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#2e3a7a');
      g.addColorStop(1, d);
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      railShade(c, shape, '#0a0d24', 0.5);
      // the bolt in a unit box (x across, y along): mapped onto the board
      const unit: [number, number][] = [
        [0.56, 0], [0.86, 0], [0.6, 0.4], [0.8, 0.4], [0.32, 1], [0.44, 0.54], [0.22, 0.54],
      ];
      const bolt = new Path2D();
      unit.forEach(([x, y], i) => {
        const q = beside(sp, 0.06 + y * 0.88, (x - 0.5) * 1.9);
        if (i === 0) bolt.moveTo(q.x, q.y);
        else bolt.lineTo(q.x, q.y);
      });
      bolt.closePath();
      const cracks: [number, number, number, number][] = [
        [0.22, 0.54, 0.02, 0.66], [0.3, 0.42, 0.1, 0.36], [0.8, 0.4, 0.98, 0.5], [0.7, 0.22, 0.95, 0.15], [0.44, 0.7, 0.2, 0.86], [0.55, 0.62, 0.78, 0.78],
      ];
      c.strokeStyle = b;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (const [ax, ay, bx, by] of cracks) {
        const p = beside(sp, 0.06 + ay * 0.88, (ax - 0.5) * 1.9);
        const q = beside(sp, 0.06 + by * 0.88, (bx - 0.5) * 1.9);
        const m = beside(sp, 0.06 + ((ay + by) / 2) * 0.88 + 0.02, ((ax + bx) / 2 - 0.5) * 1.9);
        for (const [wd, al] of [
          [4, 0.25],
          [1.4, 1],
        ] as const) {
          c.globalAlpha = al;
          c.lineWidth = wd * s;
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(m.x, m.y);
          c.lineTo(q.x, q.y);
          c.stroke();
        }
      }
      c.globalAlpha = 1;
      for (const [wd, al] of [
        [16, 0.12],
        [10, 0.18],
        [5, 0.3],
      ] as const) {
        c.globalAlpha = al;
        c.lineWidth = wd * s;
        c.stroke(bolt);
      }
      c.globalAlpha = 1;
      c.fillStyle = b;
      c.fill(bolt);
      c.strokeStyle = '#fff6c4';
      c.lineWidth = 1.2 * s;
      c.stroke(bolt);
      break;
    }
    case 'cosmos': {
      // deep space: a nebula glowing purple, blue and pink, stars of every size, a ringed planet, a cratered moon and a
      // shooting star
      const sp = spineOf(shape);
      const R = sp.at(0.5).half;
      fill(a);
      for (const [u, o, rr, col] of [
        [0.25, -0.4, 1.3, 'rgba(123,63,228,0.55)'],
        [0.55, 0.5, 1.2, 'rgba(31,182,201,0.4)'],
        [0.8, -0.3, 1.1, 'rgba(255,79,163,0.45)'],
        [0.05, 0.6, 0.9, 'rgba(255,79,163,0.3)'],
      ] as const) {
        const q = beside(sp, u, o);
        const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, R * rr);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      }
      // stars
      for (const st of scatter(sp, seed, 500, () => R * 0.05, 2.2)) {
        c.globalAlpha = 0.5 + 0.5 * h(seed, Math.round(st.x * 7 + st.y * 13));
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(st.x, st.y, st.r * 0.55, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      for (const [u, o, k] of [
        [0.1, -0.3, 1],
        [0.48, -0.6, 0.8],
        [0.62, 0.65, 1.1],
        [0.93, 0.25, 0.7],
      ] as const) {
        const q = beside(sp, u, o);
        sparkle(c, q.x, q.y, R * 0.14 * k, '#ffffff');
      }
      // the shooting star
      const t0 = beside(sp, 0.62, -0.8);
      const t1 = beside(sp, 0.76, 0.05);
      const tr = c.createLinearGradient(t0.x, t0.y, t1.x, t1.y);
      tr.addColorStop(0, 'rgba(255,255,255,0)');
      tr.addColorStop(1, 'rgba(255,255,255,0.95)');
      c.strokeStyle = tr;
      c.lineCap = 'round';
      c.lineWidth = R * 0.07;
      c.beginPath();
      c.moveTo(t0.x, t0.y);
      c.lineTo(t1.x, t1.y);
      c.stroke();
      sparkle(c, t1.x, t1.y, R * 0.12, '#fff6c4');
      // the moon
      const m = beside(sp, 0.8, 0.4);
      const mr = R * 0.24;
      const mg = c.createRadialGradient(m.x - mr * 0.3, m.y - mr * 0.3, mr * 0.1, m.x, m.y, mr);
      mg.addColorStop(0, '#f1f1f4');
      mg.addColorStop(1, '#9a9cab');
      c.fillStyle = mg;
      c.beginPath();
      c.arc(m.x, m.y, mr, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(110,112,128,0.55)';
      for (const [dx, dy, cr] of [
        [-0.3, -0.2, 0.22],
        [0.35, 0.1, 0.16],
        [-0.05, 0.42, 0.13],
      ] as const) {
        c.beginPath();
        c.arc(m.x + dx * mr, m.y + dy * mr, cr * mr, 0, Math.PI * 2);
        c.fill();
      }
      // the ringed planet: the back of the ring, the planet with its bands, the front of the ring
      const p = beside(sp, 0.19, 0);
      const pr = R * 0.36;
      const tilt = p.ang - Math.PI / 2 - 0.45;
      const ring = (front: boolean) => {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(tilt);
        c.lineWidth = pr * 0.16;
        c.strokeStyle = '#f6d7a0';
        c.beginPath();
        c.ellipse(0, 0, pr * 1.75, pr * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        c.stroke();
        c.lineWidth = pr * 0.06;
        c.strokeStyle = '#c98f4e';
        c.beginPath();
        c.ellipse(0, 0, pr * 1.5, pr * 0.34, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        c.stroke();
        c.restore();
      };
      ring(false);
      c.save();
      c.beginPath();
      c.arc(p.x, p.y, pr, 0, Math.PI * 2);
      const pg = c.createRadialGradient(p.x - pr * 0.35, p.y - pr * 0.35, pr * 0.1, p.x, p.y, pr);
      pg.addColorStop(0, '#ffd89a');
      pg.addColorStop(0.6, d);
      pg.addColorStop(1, '#c0602a');
      c.fillStyle = pg;
      c.fill();
      c.clip();
      c.translate(p.x, p.y);
      c.rotate(tilt);
      c.fillStyle = 'rgba(190,90,40,0.45)';
      for (const [y, hgt] of [
        [-0.45, 0.14],
        [-0.05, 0.2],
        [0.38, 0.12],
      ] as const)
        c.fillRect(-pr, y * pr, pr * 2, hgt * pr);
      c.restore();
      ring(true);
      break;
    }
    case 'tigerSkin': {
      // tiger fur: deep orange at the rails, golden down the middle, black stripes curving in from both rails
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, '#ffd36a', 0.7);
      railShade(c, shape, d, 0.7);
      c.fillStyle = b;
      for (const sd of [-1, 1])
        for (let k = 0; k < 15; k++) {
          const u = 0.03 + k * 0.066 + (sd > 0 ? 0.025 : 0);
          const len = 0.7 + 0.35 * h(seed, k * 2 + (sd > 0 ? 1 : 0));
          c.fill(tigerStripe(sp, u, sd, len, 0.05 + 0.025 * h(seed, k + 40)));
          if (h(seed, k + 70) > 0.6) c.fill(tigerStripe(sp, u + 0.028, sd, len * 0.4, 0.035));
        }
      break;
    }
    case 'pinkSail': {
      // a pink sail: lighter near the mast, panel seams across it, a darker leech
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, b, 0.4);
      c.strokeStyle = 'rgba(160,40,90,0.35)';
      c.lineWidth = 1.2 * s;
      for (let k = 1; k < 6; k++) c.stroke(acrossU(sp, k / 6));
      railShade(c, shape, d, 0.4);
      break;
    }
    case 'starMoon': {
      // a night-blue sail with gold stars and crescent moons
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, d, 0.6);
      c.fillStyle = b;
      const R = sp.at(0.5).half;
      const spots = scatter(sp, seed, 300, () => R * 0.32, 1.25);
      spots.forEach((p, k) => {
        if (k % 3 === 1) crescent(c, p.x, p.y, p.r * 0.85, h(seed, k) * 2 - 1);
        else star5(c, p.x, p.y, p.r * (k % 3 ? 0.75 : 1));
      });
      for (const p of scatter(sp, seed + 3, 300, () => R * 0.05, 3)) {
        c.beginPath();
        c.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'leafSail': {
      // a green leaf: lighter down the middle, the midrib and its side veins
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, d, 0.6);
      railShade(c, shape, b, 0.5);
      c.strokeStyle = '#d9f0b8';
      c.lineCap = 'round';
      c.lineWidth = 2.6 * s;
      c.stroke(lineU(sp, -0.02, 0.98, 0));
      c.lineWidth = 1.3 * s;
      for (let k = 1; k < 9; k++) {
        const u = k * 0.105;
        for (const sd of [-1, 1]) {
          const p = beside(sp, u, 0);
          const q = beside(sp, u - 0.09, sd * 0.85);
          const m = beside(sp, u - 0.025, sd * 0.45);
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.quadraticCurveTo(m.x, m.y, q.x, q.y);
          c.stroke();
        }
      }
      c.fillStyle = 'rgba(255,255,255,0.12)';
      const sh = beside(sp, 0.35, -0.4);
      c.beginPath();
      c.ellipse(sh.x, sh.y, sp.at(0.35).half * 0.25, sp.at(0.35).half * 1.1, sh.ang - Math.PI / 2, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'watermelon': {
      // a slice of watermelon: red flesh, a white and green rind along the foot, black seeds
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, '#ff8a94', 0.5);
      for (const [o0, col] of [
        [0.8, '#e8f5c8'],
        [0.92, d],
      ] as const) {
        const p = new Path2D();
        for (let i = 0; i <= 20; i++) {
          const q = beside(sp, -0.05 + (1.1 * i) / 20, o0);
          if (i === 0) p.moveTo(q.x, q.y);
          else p.lineTo(q.x, q.y);
        }
        for (let i = 20; i >= 0; i--) {
          const q = beside(sp, -0.05 + (1.1 * i) / 20, 1.6);
          p.lineTo(q.x, q.y);
        }
        p.closePath();
        c.fillStyle = col;
        c.fill(p);
      }
      const R = sp.at(0.5).half;
      for (const p of scatter(sp, seed, 200, () => R * 0.12, 2)) {
        if (Math.abs(p.x) > 1e9) continue;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(sp.at(0.5).ang - Math.PI / 2);
        c.fillStyle = b;
        c.beginPath();
        c.ellipse(0, 0, p.r * 0.45, p.r * 0.75, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.beginPath();
        c.arc(-p.r * 0.15, -p.r * 0.3, p.r * 0.16, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      break;
    }
    case 'iceCream': {
      // scoops of strawberry, vanilla and pistachio with drippy edges, sprinkles on top
      const sp = spineOf(shape);
      const cols = [a, b, d, '#8a5a3c'];
      fill(cols[3]);
      for (let k = 2; k >= 0; k--) {
        const u1 = (k + 1) * 0.3;
        const p = new Path2D();
        const top = beside(sp, -0.1, -1.6);
        p.moveTo(top.x, top.y);
        const tr = beside(sp, -0.1, 1.6);
        p.lineTo(tr.x, tr.y);
        for (let i = 0; i <= 12; i++) {
          const o = 1.6 - (3.2 * i) / 12;
          const q = beside(sp, u1 + (i % 2 ? 0.05 : 0), o);
          p.lineTo(q.x, q.y);
        }
        p.closePath();
        c.save();
        c.clip(p);
        c.fillStyle = cols[k];
        c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
        c.restore();
      }
      const R = sp.at(0.5).half;
      const bx = scatter(sp, seed, 260, () => R * 0.08, 1.6);
      const sc = ['#ff5a8a', '#ffd23f', '#5ec8ff', '#7ed957', '#b57bff'];
      bx.forEach((p, k) => {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(h(seed, k) * Math.PI);
        c.fillStyle = sc[k % sc.length];
        c.beginPath();
        c.roundRect(-p.r, -p.r * 0.35, p.r * 2, p.r * 0.7, p.r * 0.35);
        c.fill();
        c.restore();
      });
      break;
    }
    case 'swan': {
      // white feathers in soft rows
      const sp = spineOf(shape);
      fill(a);
      c.strokeStyle = b;
      c.lineWidth = 1.4 * s;
      for (let row = 0; row < 12; row++) {
        const u = 0.06 + row * 0.08;
        for (let k = -4; k <= 4; k++) {
          const q = beside(sp, u, k * 0.3 + (row % 2) * 0.15);
          c.beginPath();
          c.arc(q.x, q.y, sp.at(u).half * 0.22 + 2, q.ang - Math.PI * 0.35, q.ang + Math.PI * 0.35);
          c.stroke();
        }
      }
      railShade(c, shape, '#c9d0d8', 0.4);
      break;
    }
    case 'chequered':
      chequer(c, x0 - 10, y0 - 10, x1 + 10, y1 + 10, Math.max(w, hh) / 9, a, b);
      break;
    case 'retroRacer': {
      // red with two white racing stripes along the sail and a thin white pinstripe near the edge
      const sp = spineOf(shape);
      fill(a);
      const band = (lo: number, hi: number) => {
        const p = new Path2D();
        for (let i = 0; i <= 20; i++) {
          const q = beside(sp, -0.05 + (1.1 * i) / 20, lo);
          if (i === 0) p.moveTo(q.x, q.y);
          else p.lineTo(q.x, q.y);
        }
        for (let i = 20; i >= 0; i--) {
          const q = beside(sp, -0.05 + (1.1 * i) / 20, hi);
          p.lineTo(q.x, q.y);
        }
        p.closePath();
        c.fillStyle = b;
        c.fill(p);
      };
      band(-0.34, -0.12);
      band(0.12, 0.34);
      band(0.72, 0.78);
      band(-0.78, -0.72);
      break;
    }
    case 'compass': {
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, d, 0.7);
      const m = sp.at(0.55);
      compassRose(c, m.x, m.y, Math.min(m.half * 0.95, 60 * s));
      break;
    }
    case 'champion': {
      const g = long ? c.createLinearGradient(x0, 0, x1, 0) : c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, d);
      g.addColorStop(0.3, a);
      g.addColorStop(0.5, '#fff6cf');
      g.addColorStop(0.7, a);
      g.addColorStop(1, b);
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      const sp = spineOf(shape);
      const m = sp.at(0.55);
      trophy(c, m.x, m.y, Math.min(m.half * 0.9, 56 * s));
      for (const [u, o] of [
        [0.15, -0.3],
        [0.3, 0.4],
        [0.85, -0.2],
      ] as const) {
        const q = beside(sp, u, o);
        sparkle(c, q.x, q.y, sp.at(u).half * 0.18 + 2, '#ffffff');
      }
      break;
    }
    case 'viking': {
      // bold red and white stripes down the sail
      const sp = spineOf(shape);
      fill(b);
      for (const [lo, hi] of [
        [-1.6, -0.6],
        [-0.2, 0.2],
        [0.6, 1.6],
      ] as const) {
        const p = new Path2D();
        for (let i = 0; i <= 20; i++) {
          const q = beside(sp, -0.05 + (1.1 * i) / 20, lo);
          if (i === 0) p.moveTo(q.x, q.y);
          else p.lineTo(q.x, q.y);
        }
        for (let i = 20; i >= 0; i--) {
          const q = beside(sp, -0.05 + (1.1 * i) / 20, hi);
          p.lineTo(q.x, q.y);
        }
        p.closePath();
        c.fillStyle = a;
        c.fill(p);
      }
      railShade(c, shape, '#5a1010', 0.3);
      break;
    }
    case 'lemonade': {
      // a navy wing with a lighter leading edge
      fill(a);
      const sp = spineOf(shape);
      spineGlow(c, sp, d, 0.6);
      wingStrut(c);
      break;
    }
    case 'matchday': {
      // the friend's design, 1:1: a flat red wing, dark red struts, and the club logo on the right panel: a white outlined
      // crest (ears at the top corners, a bump on each side, a rounded point at the bottom), a white ring in it and a
      // white football with red patches
      fill(a);
      c.strokeStyle = d;
      c.lineWidth = 3.4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(0, -80);
      c.lineTo(0, 24);
      c.stroke();
      clubCrest(c, 50, -31, 26, b, a);
      break;
    }
    case 'deepBlue':
    case 'ember': {
      // two colours split at the middle strut, the back half a shade deeper
      const deep = skin.pattern === 'deepBlue';
      const sp = spineOf(shape);
      const L = deep ? [a, d] : [a, '#6e1218'];
      const R = deep ? [b, '#1f93c4'] : [b, d];
      c.fillStyle = L[0];
      c.fillRect(x0 - 10, y0 - 10, w / 2 + 10, hh + 20);
      c.fillStyle = R[0];
      c.fillRect(0, y0 - 10, w / 2 + 10, hh + 20);
      const back = new Path2D();
      for (let i = 0; i <= 24; i++) {
        const q = beside(sp, (i / 24) * 1.1 - 0.05, 0.15);
        if (i === 0) back.moveTo(q.x, q.y);
        else back.lineTo(q.x, q.y);
      }
      back.lineTo(x1 + 10, y1 + 10);
      back.lineTo(x0 - 10, y1 + 10);
      back.closePath();
      c.save();
      c.clip(back);
      c.fillStyle = L[1];
      c.fillRect(x0 - 10, y0 - 10, w / 2 + 10, hh + 20);
      c.fillStyle = R[1];
      c.fillRect(0, y0 - 10, w / 2 + 10, hh + 20);
      c.restore();
      c.strokeStyle = 'rgba(70,78,88,0.75)';
      c.lineWidth = 3;
      c.stroke(lineU(sp, -0.05, 1.05, 0.15));
      wingStrut(c);
      break;
    }
    case 'cherryPop': {
      // rows of little cherries on raspberry
      fill(a);
      for (let row = 0, y = y0 + 6; y < y1 + 16; y += 30, row++)
        for (let x = x0 - 4 + (row % 2) * 18; x < x1 + 16; x += 36) cherryPair(c, x, y + 12, 0.2);
      wingStrut(c);
      break;
    }
    case 'mondrian': {
      // white blocks, thick black lines, red, blue and yellow rectangles
      fill(a);
      const cells: [number, number, number, number, string][] = [
        [-130, -90, -78, -48, '#f2c230'],
        [-78, -48, -24, 0, d],
        [-24, -90, 34, -48, '#1f4fa0'],
        [34, -48, 92, 0, '#f2c230'],
        [92, -90, 130, -48, d],
        [-130, 0, -78, 40, '#1f4fa0'],
        [8, 0, 34, 40, d],
        [92, 0, 130, 40, '#1f4fa0'],
      ];
      for (const [ax, ay, bx, by, col] of cells) {
        c.fillStyle = col;
        c.fillRect(ax, ay, bx - ax, by - ay);
      }
      c.strokeStyle = b;
      c.lineWidth = 4.5;
      for (const x of [-78, -24, 8, 34, 92]) {
        c.beginPath();
        c.moveTo(x, y0 - 10);
        c.lineTo(x, y1 + 10);
        c.stroke();
      }
      for (const y of [-48, 0]) {
        c.beginPath();
        c.moveTo(x0 - 10, y);
        c.lineTo(x1 + 10, y);
        c.stroke();
      }
      break;
    }
    case 'holland': {
      // the Dutch flag: red, white and blue bands along the wing
      const sp = spineOf(shape);
      fill(b);
      for (const [lo, hi, col] of [
        [-1.6, -0.33, a],
        [0.33, 1.6, d],
      ] as const) {
        const p = new Path2D();
        for (let i = 0; i <= 24; i++) {
          const q = beside(sp, (i / 24) * 1.1 - 0.05, lo);
          if (i === 0) p.moveTo(q.x, q.y);
          else p.lineTo(q.x, q.y);
        }
        for (let i = 24; i >= 0; i--) {
          const q = beside(sp, (i / 24) * 1.1 - 0.05, hi);
          p.lineTo(q.x, q.y);
        }
        p.closePath();
        c.fillStyle = col;
        c.fill(p);
      }
      wingStrut(c);
      break;
    }
    case 'blossom': {
      // navy with pink blossoms, little white daisies and green leaves
      fill(a);
      const sp = spineOf(shape);
      const R = sp.at(0.5).half;
      const spots = scatter(sp, seed, 500, () => R * 0.2, 1.2);
      spots.forEach((p, k) => {
        if (k % 3 === 2) {
          c.fillStyle = '#5daa52';
          for (const sd of [-1, 1]) {
            c.beginPath();
            c.ellipse(p.x + sd * p.r * 0.35, p.y, p.r * 0.45, p.r * 0.2, sd * 0.6 + h(seed, k), 0, Math.PI * 2);
            c.fill();
          }
        } else if (k % 3 === 1) flower(c, p.x, p.y, p.r * 0.7, d, '#f2c230', h(seed, k) * 3);
        else flower(c, p.x, p.y, p.r, b, '#f2c230', h(seed, k) * 3);
      });
      wingStrut(c);
      break;
    }
    case 'redDots': {
      // the cap of a fly agaric seen from above: red, deeper in the middle and more orange toward the rim, covered in raised
      // white warts, big ones in the middle and small, dense ones toward the rim
      const sp = spineOf(shape);
      const R = sp.at(0.5).half;
      fill(a);
      railShade(c, shape, '#ff8f3e', 0.7);
      spineGlow(c, sp, d, 0.3);
      for (const [k, wt] of scatter(sp, seed, 1400, (o) => R * (0.15 - 0.11 * o), 1.25).entries()) wart(c, wt.x, wt.y, wt.r, seed + k * 7);
      break;
    }
    case 'leopard': {
      // leopard print: golden fur, lighter down the middle, covered in rosettes (broken dark rings around a warmer centre)
      // with small spots in between
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, '#f7d58f', 0.45);
      railShade(c, shape, d, 0.5);
      const R = sp.at(0.5).half;
      const spots = scatter(sp, seed, 700, () => R * 0.26, 1.18);
      spots.forEach((p, k) => rosette(c, p.x, p.y, p.r, h(seed, k + 120) * 6, seed + k * 13, d, b));
      // small solid spots in the gaps
      c.fillStyle = b;
      for (const p of scatter(sp, seed + 1, 900, () => R * 0.06, 1.0)) {
        if (spots.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r * 1.15 + p.r)) continue;
        c.beginPath();
        c.ellipse(p.x, p.y, p.r, p.r * 0.8, p.x, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'ghost': {
      fill(a);
      const sp = spineOf(shape);
      c.fillStyle = b;
      c.beginPath();
      for (let u = 0; u <= 1.001; u += 0.02) {
        const p = beside(sp, u, 0.5);
        if (u === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
      for (let u = 1; u >= -0.001; u -= 0.02) {
        const p = beside(sp, u, 1.6);
        c.lineTo(p.x, p.y);
      }
      c.fill();
      // two big dark eyes
      c.fillStyle = d;
      for (const [u, off] of [
        [0.38, -0.15],
        [0.56, -0.05],
      ]) {
        const p = beside(sp, u, off);
        c.beginPath();
        c.ellipse(p.x, p.y, p.half * 0.5, p.half * 0.36, p.ang + 0.4, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'windSun': {
      // a plain sunny yellow sail
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, '#fff3a0', 0.55);
      railShade(c, shape, '#e0a000', 0.45);
      break;
    }
    case 'windCamo': {
      // a plain leaf-green sail (the camo is on the board)
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, '#8fd46e', 0.4);
      railShade(c, shape, '#2f7a2a', 0.5);
      break;
    }
    case 'jungle': {
      // a deep jungle-green sail, full of the dark shapes of leaves
      fill(a);
      for (let i = 0; i < 60; i++) {
        const col = i % 3 === 0 ? b : d;
        jungleLeaf(c, x0 + h(seed, i) * w, y0 + h(seed, i + 300) * hh, (12 + 12 * h(seed, i + 600)) * s, h(seed, i + 900) * 6.3, col, 0.55);
      }
      railShade(c, shape, d, 0.6);
      break;
    }
    case 'tigerRace': {
      // black with slanted pairs of red and orange stripes
      fill(a);
      tigerBands(c, (x0 + x1) / 2, (y0 + y1) / 2, s, b, d);
      break;
    }
    case 'checkerWind': {
      // a black and white chequered flag
      const q = 14 * s;
      for (let y = y0 - q; y < y1 + q; y += q)
        for (let x = x0 - q; x < x1 + q; x += q) {
          c.fillStyle = Math.round((x - x0) / q + (y - y0) / q) % 2 ? b : a;
          c.fillRect(x, y, q + 0.5, q + 0.5);
        }
      break;
    }
    case 'driftwood': {
      // a sail of leaves: a mass of small leaves in many greens, a brown branch with its twigs across it
      const sp = spineOf(shape);
      fill(b);
      const greens = ['#3f8a2a', '#6cbf4a', '#2f6e22', '#58a83c', '#7fcf5a'];
      for (let i = 0; i < 260; i++) {
        const x = x0 + h(seed, i) * w;
        const y = y0 + h(seed, i + 400) * hh;
        jungleLeaf(c, x, y, (7 + 5 * h(seed, i + 800)) * s, h(seed, i + 1200) * 6.3, greens[i % greens.length], 1);
      }
      railShade(c, shape, '#24561a', 0.45);
      branch(c, sp, d, s);
      break;
    }
    case 'polka': {
      // white with yellow and blue polka dots
      const sp = spineOf(shape);
      fill(a);
      railShade(c, shape, '#c9d2da', 0.3);
      for (const [i, p] of scatter(sp, seed, 500, () => 4.2 * s, 2.3).entries()) {
        c.fillStyle = h(seed, i + 77) > 0.5 ? b : d;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'hearts': {
      // a playing card: white with red hearts (some upside down, like the pips), the 8 and a heart in two corners
      const sp = spineOf(shape);
      fill(a);
      railShade(c, shape, '#d6d9de', 0.3);
      c.fillStyle = b;
      for (const [i, p] of scatter(sp, seed, 400, () => 7 * s, 2.1).entries()) heart(c, p.x, p.y, p.r, h(seed, i + 55) > 0.5 ? Math.PI : 0);
      for (const [u, flip] of [
        [0.1, 0],
        [0.88, Math.PI],
      ] as const) {
        const q = beside(sp, u, 0);
        cardIndex(c, q.x, q.y, 9 * s, flip, b);
      }
      break;
    }
    case 'fruit': {
      // green, full of fruit: oranges, cherries, bananas, grapes and strawberries
      const sp = spineOf(shape);
      fill(a);
      spineGlow(c, sp, '#5fbf55', 0.4);
      railShade(c, shape, d, 0.45);
      for (const [i, p] of scatter(sp, seed, 500, () => 8 * s, 1.55).entries()) fruitIcon(c, i % 5, p.x, p.y, p.r, (h(seed, i + 31) - 0.5) * 1.6);
      break;
    }
    case 'bigFish': {
      // a blue fish: scales all over, its tail at the top of the sail and its head with the eye down at the clew
      const sp = spineOf(shape);
      fill(a);
      railShade(c, shape, d, 0.55);
      fishScales(c, sp, 0.22, 0.66, b, s);
      // the tail fin
      const t0 = beside(sp, 0.24, -1.4);
      const t1 = beside(sp, 0.24, 1.4);
      const tail = new Path2D();
      tail.moveTo(t0.x, t0.y);
      tail.lineTo(t1.x, t1.y);
      const tt = beside(sp, 0.0, 1.6);
      const tn = beside(sp, 0.12, 0);
      const tb = beside(sp, 0.0, -1.6);
      tail.lineTo(tt.x, tt.y);
      tail.lineTo(tn.x, tn.y);
      tail.lineTo(tb.x, tb.y);
      tail.closePath();
      c.fillStyle = d;
      c.fill(tail);
      c.strokeStyle = 'rgba(160,200,245,0.6)';
      c.lineWidth = 1.2 * s;
      for (let k = -4; k <= 4; k++) {
        const p = beside(sp, 0.24, k * 0.3);
        const q = beside(sp, 0.04, k * 0.42);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      // the gill and the eye at the clew
      c.strokeStyle = d;
      c.lineWidth = 2 * s;
      c.stroke(gillArc(sp, 0.66, 1));
      const e = beside(sp, 0.76, 0);
      fishEye(c, e.x, e.y, e.half * 0.5);
      // the mouth near the clew
      c.strokeStyle = d;
      c.lineWidth = 1.6 * s;
      c.stroke(lineU(sp, 0.86, 0.93, 0.25));
      break;
    }
    case 'kite2027': {
      // January: a night-blue kite full of fireworks, gold tips, and 2027 in big gold numbers along it
      const sp = spineOf(shape);
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, d);
      g.addColorStop(1, a);
      c.fillStyle = g;
      c.fillRect(x0 - 10, y0 - 10, w + 20, hh + 20);
      const cols = ['#ff5a5a', '#ffd23f', '#5be08f', '#5ab8ff', '#ff7ab8', '#ffffff'];
      for (let i = 0; i < 9; i++) {
        const q = beside(sp, 0.08 + i * 0.105, (h(seed, i + 10) - 0.5) * 1.2);
        fireworkBurst(c, q.x, q.y, (9 + 7 * h(seed, i + 20)) * s, cols[i % cols.length]);
      }
      for (let i = 0; i < 40; i++) {
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.beginPath();
        c.arc(x0 + h(seed, i + 100) * w, y0 + h(seed, i + 200) * hh, 0.8 * s, 0, Math.PI * 2);
        c.fill();
      }
      // gold tips at both ends
      c.fillStyle = b;
      for (const [u0, u1] of [
        [-0.1, 0.09],
        [0.91, 1.1],
      ]) {
        const p = new Path2D();
        const p1 = beside(sp, u0, -2.5);
        const p2 = beside(sp, u1, -2.5);
        const p3 = beside(sp, u1, 2.5);
        const p4 = beside(sp, u0, 2.5);
        p.moveTo(p1.x, p1.y);
        p.lineTo(p2.x, p2.y);
        p.lineTo(p3.x, p3.y);
        p.lineTo(p4.x, p4.y);
        p.closePath();
        c.fill(p);
      }
      // 2027 along the kite, upright on its curve
      const digits = '2027';
      for (let i = 0; i < 4; i++) {
        const q = beside(sp, 0.32 + i * 0.12, 0.05);
        const size = q.half * 1.7;
        c.save();
        c.translate(q.x, q.y);
        c.rotate(q.ang);
        c.font = `900 ${size}px Arial, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.strokeStyle = '#3a2406';
        c.lineWidth = size * 0.16;
        c.strokeText(digits[i], 0, 0);
        const tg = c.createLinearGradient(0, -size / 2, 0, size / 2);
        tg.addColorStop(0, '#fff1a8');
        tg.addColorStop(0.5, b);
        tg.addColorStop(1, '#d08a10');
        c.fillStyle = tg;
        c.fillText(digits[i], 0, 0);
        c.restore();
      }
      // a gold rim
      c.strokeStyle = b;
      c.lineWidth = 6 * s;
      c.stroke(outline);
      break;
    }
    case 'rose': {
      // February: a round board with a black rim, a gold ring and a big red rose with leaves
      fill(a);
      const R = Math.min(w, hh) / 2;
      c.fillStyle = '#5a0c12';
      c.beginPath();
      c.arc(0, 0, R * 0.78, 0, Math.PI * 2);
      c.fill();
      // leaves peeking out between the petals
      for (let k = 0; k < 4; k++) {
        const ang = Math.PI / 4 + (k * Math.PI) / 2;
        jungleLeaf(c, Math.cos(ang) * R * 0.42, Math.sin(ang) * R * 0.42, R * 0.34, ang, '#4f9a34', 1);
      }
      // the rose: rings of round, cupped petals (a shadow on the inner side, a light lip outside), a swirl in the middle
      const rings: [number, number, number, string, number][] = [
        [0.5, 0.3, 5, '#b3121c', 0],
        [0.32, 0.22, 5, '#d0202a', 0.63],
        [0.17, 0.15, 4, '#e33a35', 0.2],
      ];
      for (const [rc, lobe, n, col, off] of rings)
        for (let k = 0; k < n; k++) {
          const ang = off + (k / n) * Math.PI * 2;
          const px = Math.cos(ang) * R * rc;
          const py = Math.sin(ang) * R * rc;
          const L = R * lobe;
          const petal = new Path2D();
          petal.arc(px, py, L, 0, Math.PI * 2);
          c.fillStyle = col;
          c.fill(petal);
          c.save();
          c.clip(petal);
          // the shadow where it curls in toward the middle
          c.strokeStyle = 'rgba(70,0,8,0.5)';
          c.lineWidth = L * 0.55;
          c.beginPath();
          c.arc(px - Math.cos(ang) * L * 0.25, py - Math.sin(ang) * L * 0.25, L * 0.95, ang + Math.PI - 1.1, ang + Math.PI + 1.1);
          c.stroke();
          // a light lip on the outer edge
          c.strokeStyle = 'rgba(255,140,120,0.6)';
          c.lineWidth = L * 0.16;
          c.beginPath();
          c.arc(px, py, L * 0.92, ang - 1, ang + 1);
          c.stroke();
          c.restore();
          c.strokeStyle = 'rgba(70,0,8,0.8)';
          c.lineWidth = 0.9;
          c.stroke(petal);
        }
      // the tight bud in the middle, a swirl
      c.fillStyle = '#9c0e18';
      c.beginPath();
      c.arc(0, 0, R * 0.12, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ff7a64';
      c.lineWidth = 1.1;
      c.beginPath();
      for (let k = 0; k <= 30; k++) {
        const t = k / 30;
        const ang = t * Math.PI * 3.2;
        const rr = R * 0.11 * t;
        if (k === 0) c.moveTo(0, 0);
        else c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      c.stroke();
      // the gold ring, and little gold leaves on the black rim
      c.strokeStyle = d;
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(0, 0, R * 0.8, 0, Math.PI * 2);
      c.stroke();
      for (let k = 0; k < 4; k++) {
        const ang = (k * Math.PI) / 2;
        const x = Math.cos(ang) * R * 0.9;
        const y = Math.sin(ang) * R * 0.9;
        jungleLeaf(c, x, y, R * 0.12, ang + Math.PI / 2, d, 1);
        jungleLeaf(c, x, y, R * 0.12, ang - Math.PI / 2, d, 1);
      }
      break;
    }
    case 'stPatrick': {
      // March: a rainbow sail with sparkles
      fill('#ffffff');
      const bands = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
      c.save();
      c.translate((x0 + x1) / 2, (y0 + y1) / 2);
      c.rotate(-0.95);
      const bw = 13 * s;
      for (let k = -9; k < 9; k++) {
        c.fillStyle = bands[((k % 6) + 6) % 6];
        c.fillRect(-400, k * bw, 800, bw + 0.5);
      }
      c.restore();
      for (let i = 0; i < 14; i++) sparkle(c, x0 + h(seed, i + 300) * w, y0 + h(seed, i + 400) * hh, (2.5 + 2.5 * h(seed, i + 500)) * s, '#ffffff');
      break;
    }
    case 'dad90': {
      // the 1990 sail seen from above, mast (u 0) to clew (u 1): magenta luff, a blue stripe, big orange panels, a clear window,
      // a lime leech strip and a red-orange clew, white battens
      const sp = spineOf(shape);
      fill('#ffa726');
      const band = (u0: number, u1: number, o0: number, o1: number, col: string, slant = 0.04) => {
        c.fillStyle = col;
        const p1 = beside(sp, u0, o0);
        const p2 = beside(sp, u1, o0);
        const p3 = beside(sp, u1 - slant, o1);
        const p4 = beside(sp, u0 - slant, o1);
        c.beginPath();
        c.moveTo(p1.x, p1.y);
        c.lineTo(p2.x, p2.y);
        c.lineTo(p3.x, p3.y);
        c.lineTo(p4.x, p4.y);
        c.fill();
      };
      band(0.42, 0.64, -1.7, 1.7, '#ffbd45');
      band(0.0, 0.09, -1.7, 1.7, '#e8338f', 0);
      band(0.09, 0.2, -1.7, 1.7, '#29a8e0');
      band(0.2, 0.235, -1.7, 1.7, '#e8338f');
      band(0.62, 0.84, -1.7, 0.15, '#b7c7d3', 0.02);
      band(0.84, 0.885, -1.7, 1.7, '#c6e83a', 0.02);
      band(0.885, 1.02, -1.7, 1.7, '#ff5a1f', 0.02);
      // the window's film: a few lighter streaks
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 1.2 * s;
      for (const u of [0.66, 0.72, 0.78]) {
        const p = beside(sp, u, -1.4);
        const q = beside(sp, u + 0.03, 0);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      // battens
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1.6 * s;
      for (const u of [0.3, 0.5, 0.7]) {
        const p = beside(sp, u, -1.6);
        const q = beside(sp, u - 0.03, 1.6);
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(q.x, q.y);
        c.stroke();
      }
      // a small round sail-number patch
      const m = beside(sp, 0.52, 0.2);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(m.x, m.y, Math.min(m.half * 0.3, 6 * s), 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#29a8e0';
      c.lineWidth = 1.4 * s;
      c.stroke();
      break;
    }
    case 'rainbow': {
      const cols = ['#ff5252', '#ff9100', '#ffd740', '#69f0ae', '#40c4ff', '#7c4dff'];
      const n = cols.length;
      cols.forEach((col, k) => {
        c.fillStyle = col;
        if (long) c.fillRect(x0 - 10, y0 + (k * hh) / n, w + 20, hh / n + 1);
        else c.fillRect(x0 + (k * w) / n, y0 - 10, w / n + 1, hh + 20);
      });
      break;
    }
  }
  c.restore();
  // a crisp edge in a darker tone, so the shape still reads on the water
  if (skin.rarity === 'legendary') {
    // every Legendary has a golden rim
    const rim = rimColor(skin);
    c.strokeStyle = rim;
    c.lineWidth = 7 * s;
    c.stroke(outline);
    c.strokeStyle = darker(rim, 0.45);
    c.lineWidth = 1.6 * s;
    c.stroke(outline);
  } else {
    c.strokeStyle = darker(a, 0.35);
    c.lineWidth = 2.5 * s;
    c.stroke(outline);
  }
  c.restore();
}

// ---- the windsurf designs by the author's friend

/** A leaf (a pointed oval) from (x, y) along rot, len long. */
function jungleLeaf(c: Ctx, x: number, y: number, len: number, rot: number, col: string, alpha: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.globalAlpha = alpha;
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  c.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  c.fill();
  c.restore();
}

/** Slanted pairs of stripes (red, then orange) round (cx, cy). */
function tigerBands(c: Ctx, cx: number, cy: number, s: number, orange: string, red: string) {
  c.save();
  c.translate(cx, cy);
  c.rotate(-0.75);
  const P = 40 * s;
  for (let k = -14; k < 14; k++) {
    const y = k * P;
    c.fillStyle = red;
    c.beginPath();
    c.moveTo(-500, y);
    c.lineTo(500, y + 4 * s);
    c.lineTo(500, y + 15 * s);
    c.lineTo(-500, y + 10 * s);
    c.fill();
    c.fillStyle = orange;
    c.beginPath();
    c.moveTo(-500, y + 10 * s);
    c.lineTo(500, y + 15 * s);
    c.lineTo(500, y + 25 * s);
    c.lineTo(-500, y + 19 * s);
    c.fill();
  }
  c.restore();
}

/** A brown branch along the gear with twigs off both sides (the leaf sail). */
function branch(c: Ctx, sp: Spine, col: string, s: number) {
  c.save();
  c.strokeStyle = col;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const at = (u: number) => beside(sp, u, 0.12 * Math.sin(u * 9));
  c.lineWidth = 3.6 * s;
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const q = at(0.04 + (0.92 * i) / 40);
    if (i === 0) c.moveTo(q.x, q.y);
    else c.lineTo(q.x, q.y);
  }
  c.stroke();
  for (let k = 0; k < 8; k++) {
    const u = 0.1 + k * 0.105;
    const sd = k % 2 ? 1 : -1;
    const p = at(u);
    const m = beside(sp, u + 0.05, sd * 0.5);
    const q = beside(sp, u + 0.1, sd * 0.95);
    c.lineWidth = 2 * s;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.quadraticCurveTo(m.x, m.y, q.x, q.y);
    c.stroke();
    // a little side twig
    const r = beside(sp, u + 0.09, sd * 0.4);
    c.lineWidth = 1.2 * s;
    c.beginPath();
    c.moveTo(m.x, m.y);
    c.lineTo(r.x, r.y);
    c.stroke();
  }
  c.restore();
}

/** A heart of size r at (x, y), its point turned by rot (0 = point down). */
function heart(c: Ctx, x: number, y: number, r: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.beginPath();
  c.moveTo(0, r * 0.95);
  c.bezierCurveTo(-r * 1.35, -r * 0.05, -r * 0.65, -r * 1.1, 0, -r * 0.42);
  c.bezierCurveTo(r * 0.65, -r * 1.1, r * 1.35, -r * 0.05, 0, r * 0.95);
  c.fill();
  c.restore();
}

/** A playing card's corner: the 8 with a small heart under it. */
function cardIndex(c: Ctx, x: number, y: number, size: number, rot: number, col: string) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = col;
  c.font = `900 ${size * 1.5}px Arial, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('8', 0, -size * 0.55);
  heart(c, 0, size * 0.75, size * 0.5, 0);
  c.restore();
}

/** One of five fruits at (x, y), about r round: an orange, cherries, a banana, grapes or a strawberry. */
function fruitIcon(c: Ctx, kind: number, x: number, y: number, r: number, rot: number) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const leaf = (lx: number, ly: number, len: number, a: number) => jungleLeaf(c, lx, ly, len, a, '#4caf50', 1);
  const shine = (sx: number, sy: number, sr: number) => {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.arc(sx, sy, sr, 0, Math.PI * 2);
    c.fill();
  };
  c.lineWidth = r * 0.12;
  if (kind === 0) {
    c.fillStyle = '#ff9a1f';
    c.strokeStyle = '#c45a0a';
    c.beginPath();
    c.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    leaf(0, -r * 0.8, r * 0.7, -0.5);
    shine(-r * 0.3, -r * 0.3, r * 0.18);
  } else if (kind === 1) {
    c.strokeStyle = '#3d6b1f';
    c.beginPath();
    c.moveTo(-r * 0.45, r * 0.2);
    c.quadraticCurveTo(-r * 0.2, -r * 0.5, r * 0.1, -r * 0.85);
    c.moveTo(r * 0.45, r * 0.25);
    c.quadraticCurveTo(r * 0.3, -r * 0.4, r * 0.1, -r * 0.85);
    c.stroke();
    leaf(r * 0.1, -r * 0.85, r * 0.6, -0.3);
    for (const [cx, cy] of [
      [-r * 0.45, r * 0.4],
      [r * 0.45, r * 0.45],
    ]) {
      c.fillStyle = '#d81e2c';
      c.strokeStyle = '#8a0f18';
      c.beginPath();
      c.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      shine(cx - r * 0.14, cy - r * 0.14, r * 0.1);
    }
  } else if (kind === 2) {
    c.fillStyle = '#ffd23f';
    c.strokeStyle = '#b8860b';
    c.beginPath();
    c.moveTo(-r * 0.9, -r * 0.5);
    c.quadraticCurveTo(-r * 0.2, r * 1.0, r * 0.9, -r * 0.4);
    c.quadraticCurveTo(-r * 0.1, r * 0.4, -r * 0.9, -r * 0.5);
    c.fill();
    c.stroke();
    c.fillStyle = '#5a3a1a';
    c.beginPath();
    c.arc(-r * 0.88, -r * 0.5, r * 0.1, 0, Math.PI * 2);
    c.arc(r * 0.88, -r * 0.4, r * 0.1, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 3) {
    c.strokeStyle = '#3d6b1f';
    c.beginPath();
    c.moveTo(0, -r * 0.6);
    c.lineTo(r * 0.1, -r * 0.95);
    c.stroke();
    leaf(r * 0.1, -r * 0.8, r * 0.55, -0.4);
    c.fillStyle = '#8e44ad';
    c.strokeStyle = '#5b2370';
    c.lineWidth = r * 0.08;
    for (const [gx, gy] of [
      [-0.36, -0.42],
      [0, -0.42],
      [0.36, -0.42],
      [-0.18, -0.08],
      [0.18, -0.08],
      [-0.36, 0.26],
      [0, 0.26],
      [0.36, 0.26],
      [-0.18, 0.6],
      [0.18, 0.6],
      [0, 0.92],
    ].filter((_, i) => i !== 5 && i !== 7)) {
      c.beginPath();
      c.arc(gx * r, gy * r, r * 0.22, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  } else {
    c.fillStyle = '#e8262c';
    c.strokeStyle = '#9c1218';
    c.beginPath();
    c.moveTo(0, r * 0.95);
    c.bezierCurveTo(-r * 0.9, r * 0.3, -r * 0.95, -r * 0.65, 0, -r * 0.6);
    c.bezierCurveTo(r * 0.95, -r * 0.65, r * 0.9, r * 0.3, 0, r * 0.95);
    c.fill();
    c.stroke();
    c.fillStyle = '#ffe680';
    for (const [sx, sy] of [
      [-0.35, -0.2],
      [0.3, -0.25],
      [0, 0.1],
      [-0.25, 0.4],
      [0.25, 0.4],
      [0, 0.68],
    ]) {
      c.beginPath();
      c.arc(sx * r, sy * r, r * 0.07, 0, Math.PI * 2);
      c.fill();
    }
    for (const a of [-0.9, -0.3, 0.3, 0.9]) jungleLeaf(c, 0, -r * 0.6, r * 0.5, -Math.PI / 2 + a, '#3f9a3a', 1);
  }
  c.restore();
}

/** Overlapping scales on the gear from u0 to u1, lighter edges. */
function fishScales(c: Ctx, sp: Spine, u0: number, u1: number, col: string, s: number) {
  const R = sp.at(0.5).half;
  c.save();
  c.strokeStyle = col;
  c.globalAlpha = 0.75;
  c.lineWidth = 1.1 * s;
  const rows = Math.round((u1 - u0) / 0.03);
  for (let row = 0; row <= rows; row++) {
    const u = u0 + row * 0.03;
    for (let k = -7; k <= 7; k++) {
      const q = beside(sp, u, k * 0.2 + (row % 2) * 0.1);
      c.beginPath();
      c.arc(q.x, q.y, R * 0.12, q.ang - Math.PI * 0.35, q.ang + Math.PI * 0.35);
      c.stroke();
    }
  }
  c.restore();
}

/** A curved gill line across the gear at u (bulging toward the tail when dir is 1). */
function gillArc(sp: Spine, u: number, dir: number): Path2D {
  const p = new Path2D();
  for (let i = 0; i <= 16; i++) {
    const o = -1.2 + (2.4 * i) / 16;
    const q = beside(sp, u - dir * 0.04 * o * o, o);
    if (i === 0) p.moveTo(q.x, q.y);
    else p.lineTo(q.x, q.y);
  }
  return p;
}

/** A round cartoon fish eye. */
function fishEye(c: Ctx, x: number, y: number, r: number) {
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#1d2a44';
  c.lineWidth = r * 0.22;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#10161c';
  c.beginPath();
  c.arc(x, y, r * 0.55, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(x - r * 0.2, y - r * 0.2, r * 0.18, 0, Math.PI * 2);
  c.fill();
}

/** The four windsurf boards (Beginner class, Slalom, Freestyle, Wave zone) a windsurf skin's own board lies over. */
const WIND_BOARDS: Record<string, SkinBoard> = {
  'b-wind-wide': { frame: 'b-wind-wide', path: GEAR_PATHS.windWide, x0: -68, y0: -152, x1: 68, y1: 156 },
  'b-wind-race': { frame: 'b-wind-race', path: GEAR_PATHS.windRace, x0: -46, y0: -152, x1: 46, y1: 152 },
  'b-wind-free': FREE_BOARD,
  'b-wind-wave': DAD_BOARD,
};

/** A windsurf skin's board: the board of the guest's frame, with room for a snake round the tail or a fish's fins and tail. */
function windBoard(skin: SkinDef, frame: string): SkinBoard | null {
  const base = WIND_BOARDS[frame];
  if (!base) return null;
  if (skin.pattern === 'jungle') return { ...base, x0: base.x0 - 20, x1: base.x1 + 20, y1: base.y1 + 8 };
  if (skin.pattern === 'bigFish') return { ...base, x0: base.x0 - 20, x1: base.x1 + 20, y1: base.y1 + 44 };
  return base;
}

/** Draw a windsurf skin's own board (the friend's designs) on the board of its frame. */
function drawWindBoard(c: Ctx, skin: SkinDef, frame: string) {
  const base = WIND_BOARDS[frame];
  if (!base) return;
  const shape: SkinShape = { path: base.path, dy: 0, x0: base.x0, y0: base.y0, x1: base.x1, y1: base.y1 };
  const outline = new Path2D(base.path);
  const { x0, y0, x1, y1 } = base;
  const W = x1 - x0;
  const H = y1 - y0;
  const s = Math.max(W, H) / 200;
  const sp = spineOf(shape);
  const seed = [...skin.id].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0;
  const [, b, d] = skin.colors;
  const fillAll = (col: string) => {
    c.fillStyle = col;
    c.fillRect(x0 - 4, y0 - 4, W + 8, H + 8);
  };
  const nose = (col: string, f: number) => {
    c.fillStyle = col;
    c.fillRect(x0 - 4, y0 - 4, W + 8, H * f + 4);
  };
  if (skin.pattern === 'bigFish') fishFinsAndTail(c, sp, skin.colors, s, y1);
  switch (skin.pattern) {
    case 'tigerRace':
    case 'checkerWind':
    case 'fruit':
    case 'polka':
    case 'hearts':
      // the same pattern as the sail
      drawSkin(c, skin, shape);
      break;
    case 'driftwood':
      // a plank of brown wood
      drawSkin(c, { ...skin, pattern: 'log', colors: ['#c98a4a', '#8a5426', '#4a2a12'], rarity: 'epic' }, shape);
      c.save();
      c.clip(outline);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = '#b98252';
      c.fillRect(x0 - 4, y0 - 4, W + 8, H + 8);
      c.restore();
      break;
  }
  c.save();
  c.clip(outline);
  switch (skin.pattern) {
    case 'windSun':
      // a plain blue board
      fillAll(b);
      spineGlow(c, sp, '#62acf2', 0.5);
      railShade(c, shape, d, 0.55);
      break;
    case 'windCamo': {
      // camouflage: blobs of olive, dark green, brown and khaki
      fillAll('#7d8c46');
      const cols = ['#3d4a22', '#8a6a3a', '#a3a86a', '#56662c'];
      for (let i = 0; i < 70; i++) {
        const cx = x0 + h(seed, i) * W;
        const cy = y0 + h(seed, i + 100) * H;
        const r = (9 + 9 * h(seed, i + 200)) * s;
        const pts: [number, number][] = [];
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          const rr = r * (0.6 + 0.6 * h(seed, i * 7 + k + 300));
          pts.push([cx + Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr]);
        }
        c.fillStyle = cols[i % cols.length];
        c.fill(smoothPts(pts));
      }
      railShade(c, shape, '#2a3318', 0.4);
      break;
    }
    case 'jungle':
      drawJungle(c, x0, y0, W, H, s, seed);
      railShade(c, shape, '#0f2009', 0.6);
      break;
    case 'polka':
      // the purple nose with a light-blue stripe
      nose('#7e57c2', 0.17);
      c.fillStyle = '#26c6da';
      c.fillRect(x0 - 4, y0 + H * 0.17, W + 8, H * 0.035);
      break;
    case 'hearts': {
      // the red nose, and the card's 8 with a heart near the tail on both sides
      nose(b, 0.14);
      for (const sd of [-1, 1]) {
        const q = beside(sp, 0.84, sd * 0.55);
        // a clean white corner for the index, clear of the hearts
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.roundRect(q.x - 7 * s, q.y - 13 * s, 14 * s, 25 * s, 3 * s);
        c.fill();
        cardIndex(c, q.x, q.y, 8 * s, 0, b);
      }
      break;
    }
    case 'bigFish':
      drawFishBoard(c, sp, skin.colors, s);
      break;
    case 'stPatrick':
      drawPotBoard(c, sp, shape, s, b);
      break;
  }
  c.restore();
  if (skin.pattern === 'windSun' || skin.pattern === 'windCamo' || skin.pattern === 'jungle' || skin.pattern === 'bigFish' || skin.pattern === 'stPatrick') {
    // a crisp darker edge, like the boards drawn with a pattern
    c.strokeStyle = skin.pattern === 'windSun' ? darker(b, 0.45) : skin.pattern === 'bigFish' ? '#1d3a6a' : skin.pattern === 'stPatrick' ? '#16181b' : '#1f2a12';
    c.lineWidth = 2.2 * s;
    c.stroke(outline);
  }
  if (skin.pattern === 'jungle') snakeCoil(c, sp, outline, x0, y0, W, H, s);
  // the mast foot
  c.fillStyle = '#2b2f33';
  c.beginPath();
  c.arc(0, -16, 6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#5b6168';
  c.beginPath();
  c.arc(0, -16, 2.5, 0, Math.PI * 2);
  c.fill();
}

/** A jungle seen in the board: dark green deep inside, brown trunks and branches, hanging vines, big leaves. */
function drawJungle(c: Ctx, x0: number, y0: number, W: number, H: number, s: number, seed: number) {
  const g = c.createLinearGradient(x0, 0, x0 + W, 0);
  g.addColorStop(0, '#1b3a14');
  g.addColorStop(0.5, '#3f7a2c');
  g.addColorStop(1, '#1b3a14');
  c.fillStyle = g;
  c.fillRect(x0 - 4, y0 - 4, W + 8, H + 8);
  // light far away in the middle
  const glow = c.createRadialGradient(0, y0 + H * 0.4, 0, 0, y0 + H * 0.4, W * 0.7);
  glow.addColorStop(0, 'rgba(190,230,120,0.45)');
  glow.addColorStop(1, 'rgba(190,230,120,0)');
  c.fillStyle = glow;
  c.fillRect(x0 - 4, y0 - 4, W + 8, H + 8);
  // far leaves
  for (let i = 0; i < 70; i++)
    jungleLeaf(c, x0 + h(seed, i + 40) * W, y0 + h(seed, i + 140) * H, (10 + 10 * h(seed, i + 240)) * s, h(seed, i + 340) * 6.3, '#2a5a1e', 0.7);
  // trunks and branches
  c.strokeStyle = '#5a3a1e';
  c.lineCap = 'round';
  for (const [tx, lean, wd] of [
    [-0.36, 0.12, 9],
    [0.3, -0.1, 7],
  ] as const) {
    c.lineWidth = wd * s;
    c.beginPath();
    c.moveTo(tx * W, y0 + H);
    c.bezierCurveTo(tx * W + lean * W, y0 + H * 0.6, tx * W - lean * W, y0 + H * 0.35, tx * W + lean * W * 0.5, y0);
    c.stroke();
  }
  c.lineWidth = 3.5 * s;
  for (const [bx, by, ex, ey] of [
    [-0.32, 0.45, 0.1, 0.32],
    [0.28, 0.3, -0.15, 0.2],
    [-0.3, 0.72, 0.05, 0.62],
  ]) {
    c.beginPath();
    c.moveTo(bx * W, y0 + by * H);
    c.quadraticCurveTo(((bx + ex) / 2) * W, y0 + (by - 0.06) * H, ex * W, y0 + ey * H);
    c.stroke();
  }
  // vines hanging down, with small leaves
  c.strokeStyle = '#6aa83a';
  c.lineWidth = 1.4 * s;
  for (let k = 0; k < 5; k++) {
    const vx = (-0.3 + k * 0.15) * W;
    const top = y0 + (0.1 + 0.1 * h(seed, k + 500)) * H;
    const len = (0.25 + 0.2 * h(seed, k + 520)) * H;
    c.beginPath();
    c.moveTo(vx, top);
    c.quadraticCurveTo(vx + 8 * s, top + len / 2, vx - 2 * s, top + len);
    c.stroke();
    for (let j = 1; j < 6; j++) {
      const t = j / 6;
      jungleLeaf(c, vx + 3 * s * Math.sin(t * 3), top + len * t, 5 * s, j % 2 ? 0.6 : 2.5, '#7fc04a', 1);
    }
  }
  // big near leaves along the rails
  for (let i = 0; i < 26; i++) {
    const sd = i % 2 ? 1 : -1;
    const lx = sd * W * (0.38 + 0.12 * h(seed, i + 700));
    const ly = y0 + h(seed, i + 720) * H;
    jungleLeaf(c, lx, ly, (14 + 10 * h(seed, i + 740)) * s, sd > 0 ? Math.PI + (h(seed, i + 760) - 0.5) : h(seed, i + 760) - 0.5, i % 3 ? '#4f9a34' : '#6cbf4a', 1);
  }
}

/** A python wrapped round the tail of the board, its head resting on the deck facing the nose. */
function snakeCoil(c: Ctx, sp: Spine, outline: Path2D, x0: number, y0: number, W: number, H: number, s: number) {
  const k = Math.min(1, W / 136) * 1.1;
  const rb = 6.2 * k * Math.max(1, s / 1.5);
  const halfAt = (y: number) => sp.at((y - y0) / H).half;
  type P = { x: number; y: number; r: number; top: boolean };
  const pts: P[] = [];
  const turns = 2.5;
  const yStart = y0 + H * 0.95;
  const pitch = H * 0.11;
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * turns * Math.PI * 2 - Math.PI / 2;
    const y = yStart - (pitch * (th + Math.PI / 2)) / (Math.PI * 2);
    const R = halfAt(y) + rb * 0.9;
    const r = rb * Math.min(1, 0.25 + (i / N) * 4);
    pts.push({ x: R * Math.cos(th), y, r, top: Math.sin(th) > 0 });
  }
  // the neck: from the last turn (on top of the deck, middle) up toward the nose with a gentle S
  const last = pts[pts.length - 1];
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    pts.push({ x: last.x + Math.sin(t * Math.PI * 1.2) * 10 * k, y: last.y - t * H * 0.14, r: rb, top: true });
  }
  const body = (list: P[], clipOut: boolean) => {
    c.save();
    if (clipOut) {
      const outside = new Path2D();
      outside.rect(x0 - 60, y0 - 60, W + 120, H + 140);
      outside.addPath(outline);
      c.clip(outside, 'evenodd');
    }
    for (const [col, extra] of [
      ['#2c3a12', 1.3],
      ['#7d9a2e', 0],
    ] as const) {
      c.fillStyle = col;
      for (const p of list) {
        c.beginPath();
        c.arc(p.x, p.y, p.r + extra * k, 0, Math.PI * 2);
        c.fill();
      }
    }
    // dark blotches and light speckles down the back
    list.forEach((p, i) => {
      if (i % 9 === 0) {
        c.fillStyle = '#44561a';
        c.beginPath();
        c.ellipse(p.x, p.y, p.r * 0.7, p.r * 0.45, i, 0, Math.PI * 2);
        c.fill();
      } else if (i % 9 === 5) {
        c.fillStyle = '#d6cf6a';
        c.beginPath();
        c.arc(p.x, p.y, p.r * 0.22, 0, Math.PI * 2);
        c.fill();
      }
    });
    c.restore();
  };
  // under the board only the parts past the rails show; then the parts over the deck
  const under: P[] = [];
  const over: P[] = [];
  for (const p of pts) (p.top ? over : under).push(p);
  body(under, true);
  // draw the top parts as separate runs so each crossing is a clean stroke
  let run: P[] = [];
  for (const p of pts) {
    if (p.top) run.push(p);
    else if (run.length) {
      body(run, false);
      run = [];
    }
  }
  if (run.length) body(run, false);
  // the head
  const hp = pts[pts.length - 1];
  const hx = hp.x;
  const hy = hp.y - rb * 0.8;
  c.fillStyle = '#2c3a12';
  c.beginPath();
  c.ellipse(hx, hy, rb * 1.25, rb * 1.6, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#7d9a2e';
  c.beginPath();
  c.ellipse(hx, hy, rb * 1.1, rb * 1.45, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#44561a';
  c.beginPath();
  c.ellipse(hx, hy + rb * 0.2, rb * 0.45, rb * 0.7, 0, 0, Math.PI * 2);
  c.fill();
  for (const sd of [-1, 1]) {
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.arc(hx + sd * rb * 0.75, hy - rb * 0.55, rb * 0.36, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#111';
    c.beginPath();
    c.ellipse(hx + sd * rb * 0.75, hy - rb * 0.55, rb * 0.1, rb * 0.28, 0, 0, Math.PI * 2);
    c.fill();
  }
  // the forked tongue
  c.strokeStyle = '#e0262c';
  c.lineWidth = 1.1 * k;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(hx, hy - rb * 1.5);
  c.lineTo(hx, hy - rb * 2.3);
  c.lineTo(hx - rb * 0.35, hy - rb * 2.75);
  c.moveTo(hx, hy - rb * 2.3);
  c.lineTo(hx + rb * 0.35, hy - rb * 2.75);
  c.stroke();
}

/** The fish board's fins out of the rails and its forked tail past the tail (drawn under the body). */
function fishFinsAndTail(c: Ctx, sp: Spine, colors: [string, string, string], s: number, tailY: number) {
  const [, b, d] = colors;
  c.save();
  c.lineJoin = 'round';
  const fin = (path: Path2D) => {
    c.fillStyle = d;
    c.fill(path);
    c.strokeStyle = '#1d3a6a';
    c.lineWidth = 1.4;
    c.stroke(path);
  };
  for (const sd of [-1, 1]) {
    const p = beside(sp, 0.28, sd * 0.9);
    const q = beside(sp, 0.42, sd * 0.9);
    const tip = beside(sp, 0.44, sd * 1.55);
    const f = new Path2D();
    f.moveTo(p.x, p.y);
    f.quadraticCurveTo(tip.x, p.y + (tip.y - p.y) * 0.3, tip.x, tip.y);
    f.lineTo(q.x, q.y);
    f.closePath();
    fin(f);
    // a small pelvic fin further back
    const p2 = beside(sp, 0.66, sd * 0.85);
    const q2 = beside(sp, 0.74, sd * 0.85);
    const t2 = beside(sp, 0.76, sd * 1.35);
    const f2 = new Path2D();
    f2.moveTo(p2.x, p2.y);
    f2.lineTo(t2.x, t2.y);
    f2.lineTo(q2.x, q2.y);
    f2.closePath();
    fin(f2);
  }
  const root = sp.at(0.93);
  const half = root.half;
  const tail = new Path2D();
  tail.moveTo(-half * 0.55, root.y);
  tail.quadraticCurveTo(-half * 1.2, tailY + 10, -half * 1.35, tailY + 38);
  tail.quadraticCurveTo(-half * 0.4, tailY + 20, 0, tailY + 12);
  tail.quadraticCurveTo(half * 0.4, tailY + 20, half * 1.35, tailY + 38);
  tail.quadraticCurveTo(half * 1.2, tailY + 10, half * 0.55, root.y);
  tail.closePath();
  fin(tail);
  c.save();
  c.clip(tail);
  c.strokeStyle = b;
  c.globalAlpha = 0.6;
  c.lineWidth = 1.2 * s;
  for (let k = -5; k <= 5; k++) {
    c.beginPath();
    c.moveTo(k * half * 0.08, root.y);
    c.lineTo(k * half * 0.27, tailY + 40);
    c.stroke();
  }
  c.restore();
  c.restore();
}

/** The fish board's body: a darker back, scales, the gills and the eyes at the nose. */
function drawFishBoard(c: Ctx, sp: Spine, colors: [string, string, string], s: number) {
  const [a, b, d] = colors;
  c.fillStyle = a;
  c.fillRect(-200, -400, 400, 900);
  spineGlow(c, sp, d, 0.7);
  fishScales(c, sp, 0.24, 0.92, b, s);
  c.strokeStyle = '#1d3a6a';
  c.lineWidth = 2 * s;
  c.stroke(gillArc(sp, 0.22, -1));
  // a light line along each side
  c.strokeStyle = 'rgba(220,238,255,0.6)';
  c.lineWidth = 1.4 * s;
  for (const sd of [-1, 1]) c.stroke(lineU(sp, 0.24, 0.9, sd * 0.55));
  for (const sd of [-1, 1]) {
    const e = beside(sp, 0.11, sd * 0.55);
    fishEye(c, e.x, e.y, e.half * 0.3);
  }
  // the mouth at the nose
  const m = sp.at(0.02);
  c.strokeStyle = '#1d3a6a';
  c.lineWidth = 1.6 * s;
  c.beginPath();
  c.moveTo(m.x - 6 * s, m.y + 3 * s);
  c.quadraticCurveTo(m.x, m.y + 7 * s, m.x + 6 * s, m.y + 3 * s);
  c.stroke();
}

// ---- the Surf Club's monthly skins (the author's friend's designs)

/**
 * November: a phoenix kite after the friend's card. Big smooth shapes, lit from behind: a golden glow, wings raised high
 * in a V (one smooth silhouette each, ending in long finger feathers, a lighter layer of coverts over it), light gold
 * inside and deep bronze at the tips; an upright golden body, the head in profile facing left with a hooked beak and a
 * crest of curly plumes, talons spread forward, long flowing tail plumes curling to one side with peacock eyes, golden
 * sparkles and a few maple leaves. Kite coordinates: flying toward -y, the lines at its talons.
 */
function drawPhoenix(c: Ctx, skin: SkinDef) {
  const [a] = skin.colors;
  const ink = '#4a220a';
  type P = [number, number];
  const bez = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
    const u = 1 - t;
    return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
  };
  /** A ribbon along a curve: tapered at both ends, widest toward its end (a plume). */
  const ribbon = (pts: P[], wmax: number): Path2D => {
    const left: P[] = [];
    const right: P[] = [];
    pts.forEach((q, i) => {
      const t = i / (pts.length - 1);
      const n0 = pts[Math.max(0, i - 1)];
      const n1 = pts[Math.min(pts.length - 1, i + 1)];
      const dx = n1[0] - n0[0];
      const dy = n1[1] - n0[1];
      const l = Math.hypot(dx, dy) || 1;
      const w = wmax * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.82 + 0.06)), 0.7) * (t > 0.92 ? (1 - t) / 0.08 : 1);
      left.push([q[0] - (dy / l) * w, q[1] + (dx / l) * w]);
      right.push([q[0] + (dy / l) * w, q[1] - (dx / l) * w]);
    });
    const p = new Path2D();
    p.moveTo(left[0][0], left[0][1]);
    for (const q of left) p.lineTo(q[0], q[1]);
    for (const q of right.reverse()) p.lineTo(q[0], q[1]);
    p.closePath();
    return p;
  };

  // the glow behind it all: the bird is lit from behind
  // (an ellipse that fades out inside the picture's bounds, so no edge shows)
  c.save();
  c.translate(0, -26);
  c.scale(1.45, 1);
  const glow = c.createRadialGradient(0, -14, 3, 0, -10, 88);
  glow.addColorStop(0, 'rgba(255,232,160,0.85)');
  glow.addColorStop(0.3, 'rgba(255,200,100,0.42)');
  glow.addColorStop(0.6, 'rgba(255,170,70,0.12)');
  glow.addColorStop(0.85, 'rgba(255,170,70,0)');
  c.fillStyle = glow;
  c.beginPath();
  c.arc(0, -10, 88, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // the tail: long plumes flowing down and curling to the right, two to the left, peacock eyes near their ends
  const plumes: [P, P, P, P, number, boolean][] = [
    [[2, 10], [26, 34], [60, 36], [92, 56], 7, true],
    [[2, 12], [14, 46], [44, 60], [62, 80], 8, true],
    [[0, 12], [4, 44], [16, 66], [24, 84], 7.5, true],
    [[-2, 12], [-10, 42], [-28, 58], [-46, 72], 6.5, true],
    [[-2, 10], [-22, 30], [-50, 34], [-74, 48], 5.5, false],
  ];
  for (const [p0, p1, p2, p3, w, eye] of plumes) {
    const pts: P[] = [];
    for (let k = 0; k <= 30; k++) pts.push(bez(p0, p1, p2, p3, k / 30));
    const path = ribbon(pts, w);
    const g = c.createLinearGradient(p0[0], p0[1], p3[0], p3[1]);
    g.addColorStop(0, '#ffb43c');
    g.addColorStop(0.5, '#d2701e');
    g.addColorStop(1, '#6a2a0a');
    c.fillStyle = g;
    c.fill(path);
    // soft barbs along the plume
    c.save();
    c.clip(path);
    c.strokeStyle = 'rgba(255,236,180,0.45)';
    c.lineWidth = 0.8;
    for (let k = 3; k < 28; k += 2) {
      const q = pts[k];
      const n = pts[k + 1];
      c.beginPath();
      c.moveTo(q[0], q[1]);
      c.lineTo(q[0] + (n[1] - q[1]) * 2.5 + (n[0] - q[0]) * 2, q[1] - (n[0] - q[0]) * 2.5 + (n[1] - q[1]) * 2);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(74,34,10,0.7)';
    c.lineWidth = 1.1;
    c.stroke(path);
    if (eye) {
      const [ex, ey] = bez(p0, p1, p2, p3, 0.8);
      c.fillStyle = '#ffd27a';
      c.beginPath();
      c.ellipse(ex, ey, w * 0.85, w * 0.7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1f6a74';
      c.beginPath();
      c.ellipse(ex, ey, w * 0.5, w * 0.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#18242a';
      c.beginPath();
      c.arc(ex, ey, w * 0.2, 0, Math.PI * 2);
      c.fill();
    }
  }

  // the wings: one smooth silhouette each, raised high, ending in long finger feathers
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side, 1);
    const wing = new Path2D();
    wing.moveTo(8, -30);
    wing.quadraticCurveTo(34, -82, 64, -110);
    // finger feathers round the top and the outside: [notch, tip]
    const fingers: [P, P][] = [
      [[70, -112], [76, -132]],
      [[86, -106], [100, -128]],
      [[100, -96], [122, -116]],
      [[110, -82], [138, -96]],
      [[116, -66], [148, -72]],
      [[116, -50], [150, -46]],
    ];
    let prev: P = [64, -110];
    for (const [notch, tip] of fingers) {
      wing.quadraticCurveTo(prev[0] + (tip[0] - prev[0]) * 0.3, tip[1] + 2, tip[0], tip[1]);
      wing.quadraticCurveTo(tip[0] - 2, tip[1] + 10, notch[0] + 8, notch[1] + 4);
      prev = [notch[0] + 8, notch[1] + 4];
    }
    // the trailing edge: rounded secondaries back down to the body
    const secs: P[] = [
      [134, -26],
      [112, -8],
      [86, 2],
      [58, 6],
      [32, 4],
    ];
    for (const tip of secs) {
      wing.quadraticCurveTo(prev[0] + 6, tip[1] - 2, tip[0], tip[1]);
      const back: P = [tip[0] - 6, tip[1] - 10];
      wing.quadraticCurveTo(tip[0] - 2, tip[1] - 4, back[0], back[1]);
      prev = back;
    }
    wing.quadraticCurveTo(18, -6, 12, -14);
    wing.closePath();
    const wg = c.createRadialGradient(34, -56, 4, 46, -56, 118);
    wg.addColorStop(0, '#ffd56a');
    wg.addColorStop(0.3, '#f39a2e');
    wg.addColorStop(0.6, '#c8621a');
    wg.addColorStop(0.85, '#8a3410');
    wg.addColorStop(1, '#4a1a06');
    c.fillStyle = wg;
    c.fill(wing);
    c.save();
    c.clip(wing);
    // a soft shadow beside every long feather (depth), then the line between them
    c.strokeStyle = 'rgba(90,30,6,0.2)';
    c.lineWidth = 7;
    for (const [notch] of fingers) {
      c.beginPath();
      c.moveTo(64, -62);
      c.quadraticCurveTo((60 + notch[0]) / 2 + 10, (-66 + notch[1]) / 2 + 3, notch[0] + 11, notch[1] + 7);
      c.stroke();
    }
    c.strokeStyle = 'rgba(90,36,8,0.6)';
    c.lineWidth = 1.3;
    for (const [notch] of fingers) {
      c.beginPath();
      c.moveTo(60, -66);
      c.quadraticCurveTo((60 + notch[0]) / 2 + 6, (-66 + notch[1]) / 2, notch[0] + 8, notch[1] + 4);
      c.stroke();
    }
    for (const tip of secs) {
      c.beginPath();
      c.moveTo(54, -50);
      c.lineTo(tip[0] - 6, tip[1] - 10);
      c.stroke();
    }
    // the light through the inner wing, and a bright rim along the top
    c.strokeStyle = 'rgba(255,250,215,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(12, -32);
    c.quadraticCurveTo(36, -80, 64, -106);
    c.stroke();
    c.restore();
    // the middle layer: a row of rounded feathers between the coverts and the long feathers
    const midL = new Path2D();
    midL.moveTo(8, -30);
    midL.quadraticCurveTo(34, -82, 64, -110);
    midL.quadraticCurveTo(90, -108, 98, -90);
    const ms: P[] = [
      [104, -72],
      [104, -54],
      [96, -38],
      [82, -24],
      [64, -14],
      [44, -8],
      [26, -8],
    ];
    let mp: P = [98, -90];
    for (const q of ms) {
      midL.quadraticCurveTo((mp[0] + q[0]) / 2 + 8, (mp[1] + q[1]) / 2 + 6, q[0], q[1]);
      mp = q;
    }
    midL.quadraticCurveTo(16, -10, 12, -16);
    midL.closePath();
    const mg = c.createRadialGradient(30, -60, 4, 40, -56, 80);
    mg.addColorStop(0, '#ffd56a');
    mg.addColorStop(0.55, '#f39a2e');
    mg.addColorStop(1, '#b8501a');
    c.fillStyle = mg;
    c.fill(midL);
    c.save();
    c.clip(midL);
    c.strokeStyle = 'rgba(120,50,10,0.45)';
    c.lineWidth = 1.1;
    for (const q of ms) {
      c.beginPath();
      c.moveTo(40, -60);
      c.lineTo(q[0], q[1]);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(110,46,10,0.6)';
    c.lineWidth = 1;
    c.stroke(midL);
    // a smooth layer of golden coverts over the inner wing, its lower edge in soft scallops
    const cov = new Path2D();
    cov.moveTo(8, -30);
    cov.quadraticCurveTo(34, -82, 64, -110);
    cov.quadraticCurveTo(74, -100, 76, -84);
    const sc: P[] = [
      [68, -70],
      [58, -58],
      [46, -46],
      [34, -36],
      [22, -26],
    ];
    let cp: P = [76, -84];
    for (const q of sc) {
      cov.quadraticCurveTo((cp[0] + q[0]) / 2 + 7, (cp[1] + q[1]) / 2 + 7, q[0], q[1]);
      cp = q;
    }
    cov.quadraticCurveTo(18, -12, 12, -16);
    cov.closePath();
    const cg = c.createLinearGradient(20, -100, 80, -30);
    cg.addColorStop(0, '#fff0b0');
    cg.addColorStop(1, '#ffc24a');
    c.fillStyle = cg;
    c.globalAlpha = 0.95;
    c.fill(cov);
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(150,80,20,0.5)';
    c.lineWidth = 1;
    c.stroke(cov);
    c.strokeStyle = ink;
    c.lineWidth = 1.6;
    c.stroke(wing);
    c.restore();
  }

  // the body: upright, golden, lit from behind
  const body = new Path2D();
  body.moveTo(-4, -44);
  body.bezierCurveTo(14, -42, 19, -14, 10, 6);
  body.quadraticCurveTo(0, 16, -10, 6);
  body.bezierCurveTo(-19, -14, -18, -38, -4, -44);
  const bg = c.createLinearGradient(-14, -40, 12, 12);
  bg.addColorStop(0, '#fff0b0');
  bg.addColorStop(0.45, '#ffb43c');
  bg.addColorStop(1, '#c8621a');
  c.fillStyle = bg;
  c.fill(body);
  c.save();
  c.clip(body);
  c.strokeStyle = 'rgba(150,80,20,0.3)';
  c.lineWidth = 0.9;
  for (let row = 0; row < 5; row++)
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.arc(k * 7 + (row % 2) * 3.5 - 1, -28 + row * 8, 4, 0.2 * Math.PI, 0.8 * Math.PI);
      c.stroke();
    }
  c.fillStyle = 'rgba(122,58,18,0.22)';
  c.beginPath();
  c.ellipse(10, -8, 8, 24, 0.15, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.strokeStyle = ink;
  c.lineWidth = 1.6;
  c.stroke(body);

  // the legs and spread talons, reaching forward to the lines
  for (const sd of [-1, 1]) {
    c.strokeStyle = '#8a4a1a';
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(sd * 5, 6);
    c.lineTo(sd * 8, 12);
    c.stroke();
    c.strokeStyle = '#2a140a';
    c.lineWidth = 1.7;
    for (const k of [-0.7, 0, 0.7]) {
      const ang = -Math.PI / 2 + sd * 0.4 + k;
      c.beginPath();
      c.moveTo(sd * 8, 12);
      c.quadraticCurveTo(sd * 8 + Math.cos(ang) * 5, 12 + Math.sin(ang) * 5 - 1, sd * 8 + Math.cos(ang + sd * 0.5) * 7, 12 + Math.sin(ang + sd * 0.5) * 7);
      c.stroke();
    }
  }

  // the neck and head in profile, facing left
  const neck = new Path2D();
  neck.moveTo(-12, -36);
  neck.quadraticCurveTo(-15, -54, -9, -64);
  neck.lineTo(3, -62);
  neck.quadraticCurveTo(9, -50, 10, -36);
  neck.closePath();
  const ng = c.createLinearGradient(-12, -64, 8, -36);
  ng.addColorStop(0, '#fff0b0');
  ng.addColorStop(1, '#ffb43c');
  c.fillStyle = ng;
  c.fill(neck);
  // the crest: curling feather plumes sweeping up and back from the crown, gold tips
  for (const [p1, p2, p3, w] of [
    [[2, -84], [16, -92], [22, -80], 3.4],
    [[10, -78], [26, -84], [28, -70], 3.2],
    [[12, -70], [28, -72], [26, -60], 3],
  ] as [P, P, P, number][]) {
    const pts: P[] = [];
    for (let k = 0; k <= 20; k++) pts.push(bez([-3, -66], p1, p2, p3, k / 20));
    const path = ribbon(pts, w);
    const g = c.createLinearGradient(-3, -66, p3[0], p3[1]);
    g.addColorStop(0, a);
    g.addColorStop(1, '#ffd27a');
    c.fillStyle = g;
    c.fill(path);
    c.strokeStyle = 'rgba(74,34,10,0.7)';
    c.lineWidth = 0.9;
    c.stroke(path);
  }
  const head = new Path2D();
  head.ellipse(-4, -62, 10, 9, -0.2, 0, Math.PI * 2);
  const hg = c.createRadialGradient(-7, -66, 1, -4, -62, 11);
  hg.addColorStop(0, '#fff0b0');
  hg.addColorStop(1, '#f39a2e');
  c.fillStyle = hg;
  c.fill(head);
  c.strokeStyle = ink;
  c.lineWidth = 1.5;
  c.stroke(head);
  // the hooked beak
  const beak = new Path2D();
  beak.moveTo(-11, -66);
  beak.quadraticCurveTo(-22, -68, -25, -59);
  beak.quadraticCurveTo(-21, -61, -18, -58);
  beak.quadraticCurveTo(-14, -56, -11, -57);
  beak.closePath();
  const kg = c.createLinearGradient(-25, -66, -11, -57);
  kg.addColorStop(0, '#c98a1a');
  kg.addColorStop(1, '#ffe08a');
  c.fillStyle = kg;
  c.fill(beak);
  c.strokeStyle = ink;
  c.lineWidth = 1.2;
  c.stroke(beak);
  // the eye
  c.fillStyle = '#fff6d8';
  c.beginPath();
  c.ellipse(-7, -64, 2.8, 2.4, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1a0d06';
  c.beginPath();
  c.arc(-7.6, -64, 1.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(-8.1, -64.6, 0.55, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-11, -67.2);
  c.quadraticCurveTo(-7, -68.4, -3.5, -66.6);
  c.stroke();

  // a few golden sparkles close round it (the showcase and the water add the falling leaves)
  for (const [x, y, r] of [
    [-40, -112, 3.4],
    [44, -118, 3.8],
    [0, -96, 3],
    [-70, 20, 3],
    [74, 24, 3],
  ] as const)
    sparkle(c, x, y, r, '#fff3c4');
}

/** December: the board is a Christmas tree: tiers of green branches out past the rails, a garland, baubles, the gold star at the nose and the trunk at the tail. */
function drawXmasTree(c: Ctx, skin: SkinDef, shape: SkinShape) {
  const [a, b, d] = skin.colors;
  const { y0, y1 } = shape;
  const H = y1 - y0;
  // the board under the tree
  const board = new Path2D(shape.path);
  c.fillStyle = d;
  c.fill(board);
  c.strokeStyle = '#0f3a16';
  c.lineWidth = 2.2;
  c.stroke(board);
  // the trunk at the tail
  c.fillStyle = '#7a4a24';
  c.strokeStyle = '#3d2210';
  c.lineWidth = 1.8;
  c.beginPath();
  c.roundRect(-8, y1 - H * 0.17, 16, H * 0.16, 3);
  c.fill();
  c.stroke();
  // the tiers, bottom first so the higher ones lie over them
  const tiers = 6;
  for (let i = tiers - 1; i >= 0; i--) {
    const t0 = i / tiers;
    const top = y0 + 18 + (H * 0.74 * t0) * 0.95;
    const bottom = y0 + 18 + H * 0.74 * ((i + 1.45) / tiers);
    const half = 24 + 54 * ((i + 1) / tiers);
    const tier = new Path2D();
    tier.moveTo(0, top);
    tier.quadraticCurveTo(half * 0.45, top + (bottom - top) * 0.45, half, bottom);
    // a jagged lower edge of branch tips
    const teeth = 5 + i;
    for (let k = 1; k <= teeth; k++) {
      const x = half - (2 * half * k) / teeth;
      tier.lineTo(x + half / teeth, bottom - 7);
      tier.lineTo(x, bottom + (k % 2 ? 2 : 0));
    }
    tier.quadraticCurveTo(-half * 0.45, top + (bottom - top) * 0.45, 0, top);
    tier.closePath();
    const g = c.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, b);
    g.addColorStop(1, a);
    c.fillStyle = g;
    c.fill(tier);
    c.strokeStyle = '#123f1a';
    c.lineWidth = 1.8;
    c.stroke(tier);
    // needles
    c.save();
    c.clip(tier);
    c.strokeStyle = 'rgba(190,240,170,0.45)';
    c.lineWidth = 1;
    for (let k = -6; k <= 6; k++) {
      c.beginPath();
      c.moveTo(k * 3, top + (bottom - top) * 0.3);
      c.lineTo(k * half * 0.16, bottom - 4);
      c.stroke();
    }
    c.restore();
    // the garland across this tier
    c.strokeStyle = '#f2d16b';
    c.lineWidth = 2;
    c.beginPath();
    const gy = top + (bottom - top) * 0.62;
    const gw = half * 0.78;
    c.moveTo(-gw, gy - 6);
    c.quadraticCurveTo(0, gy + 8, gw, gy - 6);
    c.stroke();
    // baubles
    const cols = ['#e0262c', '#2f7fd6', '#ffc83d', '#e0262c', '#9c4fd6'];
    for (const [k, fx] of [-0.55, 0.05, 0.6].entries()) {
      const x = fx * half;
      const y = bottom - 9 - (k === 1 ? 6 : 0);
      c.fillStyle = cols[(i + k) % cols.length];
      c.beginPath();
      c.arc(x, y, 4.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 0.8;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.arc(x - 1.4, y - 1.4, 1.2, 0, Math.PI * 2);
      c.fill();
    }
  }
  // the star at the nose, glowing
  const sy = y0 + 12;
  const glow = c.createRadialGradient(0, sy, 0, 0, sy, 26);
  glow.addColorStop(0, 'rgba(255,230,120,0.7)');
  glow.addColorStop(1, 'rgba(255,230,120,0)');
  c.fillStyle = glow;
  c.fillRect(-26, sy - 26, 52, 52);
  c.fillStyle = '#ffc83d';
  star5(c, 0, sy, 13);
  c.strokeStyle = '#a8740a';
  c.lineWidth = 1.4;
  c.stroke();
}

/** A firework: rays of dots from a point, in one colour. */
function fireworkBurst(c: Ctx, x: number, y: number, r: number, col: string) {
  c.save();
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineCap = 'round';
  c.globalAlpha = 0.9;
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2;
    c.lineWidth = r * 0.07;
    c.beginPath();
    c.moveTo(x + Math.cos(ang) * r * 0.25, y + Math.sin(ang) * r * 0.25);
    c.lineTo(x + Math.cos(ang) * r * 0.85, y + Math.sin(ang) * r * 0.85);
    c.stroke();
    c.beginPath();
    c.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, r * 0.08, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** A Celtic trinity knot in gold at (x, y), size r. */
function trinityKnot(c: Ctx, x: number, y: number, r: number, col: string) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = '#3a2a06';
  c.lineWidth = r * 0.34;
  c.lineCap = 'round';
  const loops = () => {
    for (let k = 0; k < 3; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI * 2) / 3;
      c.beginPath();
      c.ellipse(Math.cos(ang) * r * 0.45, Math.sin(ang) * r * 0.45, r * 0.62, r * 0.3, ang, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    c.stroke();
  };
  loops();
  c.strokeStyle = col;
  c.lineWidth = r * 0.18;
  loops();
  c.restore();
}

/** March's board: a pot of gold: dark iron with a gold rim, a Celtic knot at the nose, a heap of gold coins and clovers on the deck. */
function drawPotBoard(c: Ctx, sp: Spine, shape: SkinShape, s: number, gold: string) {
  const { x0, y0, x1, y1 } = shape;
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#24272b');
  g.addColorStop(0.5, '#4a4f56');
  g.addColorStop(1, '#24272b');
  c.fillStyle = g;
  c.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
  // gold rim inside the edge
  c.strokeStyle = gold;
  c.lineWidth = 6 * s;
  c.stroke(new Path2D(shape.path));
  const k = beside(sp, 0.14, 0);
  trinityKnot(c, k.x, k.y, k.half * 0.6, gold);
  // the heap of coins
  const coins: { x: number; y: number }[] = [];
  for (let i = 0; i < 46; i++) {
    const u = 0.5 + 0.34 * h(0x90d, i);
    const q = beside(sp, u, (h(0x90d, i + 100) - 0.5) * 1.5);
    coins.push({ x: q.x, y: q.y });
  }
  coins.sort((p, q) => p.y - q.y);
  for (const p of coins) {
    c.fillStyle = gold;
    c.strokeStyle = '#a8740a';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(p.x, p.y, 5 * s, 3.6 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255,248,200,0.8)';
    c.beginPath();
    c.ellipse(p.x - 1.4 * s, p.y - 1 * s, 1.6 * s, 0.9 * s, 0, 0, Math.PI * 2);
    c.fill();
  }
  // clovers in the gold
  for (const [u, o] of [
    [0.58, -0.35],
    [0.7, 0.4],
    [0.8, -0.2],
  ]) {
    const q = beside(sp, u, o);
    for (let k = 0; k < 4; k++) {
      c.fillStyle = '#2f9e44';
      c.beginPath();
      c.arc(q.x + Math.cos((k * Math.PI) / 2) * 3 * s, q.y + Math.sin((k * Math.PI) / 2) * 3 * s, 2.8 * s, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// ---- the Club skins' touch on the water: what each one drops

/** What a Club skin drops on the water: autumn leaves from the phoenix, snow round the tree, sparks round the 2027 kite, rose petals, clovers and coins. */
export type TrailKind = 'leaf' | 'snow' | 'spark' | 'petal' | 'clover';

export function trailOf(skin: SkinDef): TrailKind | null {
  const map: Partial<Record<SkinDef['pattern'], TrailKind>> = { phoenix: 'leaf', xmasTree: 'snow', kite2027: 'spark', rose: 'petal', stPatrick: 'clover' };
  return map[skin.pattern] ?? null;
}

/** The size of one bit (spec px, square, centred on 0,0). */
export const TRAIL_SIZE = 28;

/** Draw one bit of a trail, centred on 0,0, about TRAIL_SIZE across; `variant` 0..2 gives a few looks (leaf colours, a coin among the clovers). */
export function drawTrailBit(c: Ctx, kind: TrailKind, variant: number) {
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (kind === 'leaf') {
    // a maple leaf: five pointed lobes, a stem, veins
    const col = ['#e8691c', '#c2361a', '#f2b134'][variant % 3];
    const p = new Path2D();
    const lobes = [
      [0, -12],
      [7, -6],
      [12, -7],
      [9, 1],
      [11, 5],
      [3, 4],
      [1, 9],
      [-1, 9],
      [-3, 4],
      [-11, 5],
      [-9, 1],
      [-12, -7],
      [-7, -6],
    ];
    lobes.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    c.fillStyle = col;
    c.fill(p);
    c.strokeStyle = darker(col, 0.35);
    c.lineWidth = 1.1;
    c.stroke(p);
    c.beginPath();
    c.moveTo(0, 12);
    c.lineTo(0, -8);
    c.moveTo(0, 2);
    c.lineTo(8, -4);
    c.moveTo(0, 2);
    c.lineTo(-8, -4);
    c.stroke();
  } else if (kind === 'snow') {
    // a six-armed snowflake
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      c.save();
      c.rotate((k * Math.PI) / 3);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -11);
      c.moveTo(0, -6);
      c.lineTo(3.5, -9);
      c.moveTo(0, -6);
      c.lineTo(-3.5, -9);
      c.stroke();
      c.restore();
    }
  } else if (kind === 'spark') {
    // a firework star
    const col = ['#ffd23f', '#ff5a5a', '#5ab8ff'][variant % 3];
    sparkle(c, 0, 0, 12, col);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(0, 0, 2.6, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 'petal') {
    // a rose petal
    c.fillStyle = ['#d9262c', '#b5161d', '#e8453a'][variant % 3];
    c.beginPath();
    c.moveTo(0, 10);
    c.bezierCurveTo(-11, 2, -9, -10, 0, -10);
    c.bezierCurveTo(9, -10, 11, 2, 0, 10);
    c.fill();
    c.strokeStyle = 'rgba(90,6,12,0.6)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = 'rgba(255,170,150,0.55)';
    c.beginPath();
    c.ellipse(-2.5, -3, 2.5, 4.5, -0.3, 0, Math.PI * 2);
    c.fill();
  } else if (variant === 1) {
    // a gold coin
    c.fillStyle = '#f2c230';
    c.strokeStyle = '#a8740a';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, 0, 9, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(168,116,10,0.7)';
    c.beginPath();
    c.arc(0, 0, 6, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,248,200,0.8)';
    c.beginPath();
    c.ellipse(-3, -3, 2.5, 1.5, -0.6, 0, Math.PI * 2);
    c.fill();
  } else {
    // a four-leaf clover
    c.fillStyle = '#2f9e44';
    c.strokeStyle = '#1b6a2a';
    c.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      c.save();
      c.rotate((k * Math.PI) / 2 + Math.PI / 4);
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(-7, -3, -6, -11, -1.5, -10);
      c.bezierCurveTo(0, -12, 1, -12, 1.5, -10);
      c.bezierCurveTo(6, -11, 7, -3, 0, 0);
      c.fill();
      c.stroke();
      c.restore();
    }
    c.strokeStyle = '#1b6a2a';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(3, 6, 2, 11);
    c.stroke();
  }
  c.restore();
}
