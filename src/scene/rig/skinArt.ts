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

/** Draw a skin in the shape's own coordinates (call with the canvas already moved to the pivot). */
export function drawSkin(c: Ctx, skin: SkinDef, shape: SkinShape) {
  const [a, b, d] = skin.colors;
  const { x0, y0, x1, y1 } = shape;
  const w = x1 - x0;
  const hh = y1 - y0;
  const s = Math.max(w, hh) / 200;
  const seed = [...skin.id].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7) >>> 0;
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
