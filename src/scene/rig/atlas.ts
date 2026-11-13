import Phaser from 'phaser';
import type { SkinDef } from '../../config/skins';
import { GEAR_PATHS as G, PATHS } from './models';
import { drawSkin, drawSkinBoard, drawSkinSpin, drawTrailBit, skinBounds, skinShape, SPIN_BOUNDS, TRAIL_SIZE, type SkinBoard, type TrailKind } from './skinArt';

// Every part of the guest models baked once into one texture ('rig'), so all guests draw in one batch.
// Parts are drawn in spec px (README 1.1) at RES texture px per spec px; white parts are tinted per guest.

export const ATLAS = 'rig';
export const RES = 1.4;

type Ctx = CanvasRenderingContext2D;

interface FrameDef {
  name: string;
  /** Bounds in spec px around the pivot (the pivot is 0,0 of the drawing). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  draw: (ctx: Ctx) => void;
}

/** Pivot of every frame as a fraction of its size (for setOrigin). */
export const PIVOT = new Map<string, { ox: number; oy: number }>();

const GREY_EDGE = '#c9c9c9';
const NAVY = '#2A3A4C';
const METAL = '#46525E';

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function path(ctx: Ctx, d: string, fill: string | null, stroke?: string, width = 0) {
  const p = new Path2D(d);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(p);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(p);
  }
}

const FRAMES: FrameDef[] = [
  // ---- shapes for tinting
  {
    name: 'disc',
    x0: -32,
    y0: -32,
    x1: 32,
    y1: 32,
    draw: (c) => circle(c, 0, 0, 32, '#fff'),
  },
  {
    name: 'ring',
    x0: -34,
    y0: -34,
    x1: 34,
    y1: 34,
    draw: (c) => {
      c.strokeStyle = '#fff';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(0, 0, 30, 0, Math.PI * 2);
      c.stroke();
    },
  },
  // a round-capped bar from (0,0) to (64,0), 16 thick: legs, arms, wake marks
  {
    name: 'limb',
    x0: -8,
    y0: -8,
    x1: 72,
    y1: 8,
    draw: (c) => line(c, 0, 0, 64, 0, 16, '#fff'),
  },
  // a plain line from (0,0) to (64,0), 4 thick: kite lines, sheets
  {
    name: 'line',
    x0: 0,
    y0: -2,
    x1: 64,
    y1: 2,
    draw: (c) => {
      c.fillStyle = '#fff';
      c.fillRect(0, -2, 64, 4);
    },
  },
  {
    name: 'torso',
    x0: -32,
    y0: -32,
    x1: 32,
    y1: 32,
    draw: (c) => {
      circle(c, 0, 0, 32, GREY_EDGE);
      circle(c, 0, 0, 28, '#fff');
    },
  },
  // accent stripe over the front of the shoulders (levels 3 and 4), in the unit torso (r 32)
  {
    name: 'stripe',
    x0: -32,
    y0: -32,
    x1: 32,
    y1: 32,
    draw: (c) => {
      c.save();
      c.beginPath();
      c.arc(0, 0, 30, 0, Math.PI * 2);
      c.clip();
      c.strokeStyle = '#fff';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-8, -26);
      c.quadraticCurveTo(34, -24, 31, 4);
      c.stroke();
      c.restore();
    },
  },
  // white piping on the back of a player's shirt / a kiter's harness (forward torso, back = +y)
  {
    name: 'piping',
    x0: -32,
    y0: -32,
    x1: 32,
    y1: 32,
    draw: (c) => {
      c.strokeStyle = '#fff';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-27, 14);
      c.quadraticCurveTo(0, 42, 27, 14);
      c.stroke();
    },
  },
  // the two navy straps of a beginner's foam vest
  {
    name: 'straps',
    x0: -32,
    y0: -32,
    x1: 32,
    y1: 32,
    draw: (c) => {
      c.save();
      c.beginPath();
      c.arc(0, 0, 29, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = NAVY;
      c.fillRect(-32, -14, 64, 5);
      c.fillRect(-32, 9, 64, 5);
      c.restore();
    },
  },
  {
    name: 'helmet',
    x0: -13,
    y0: -13,
    x1: 13,
    y1: 13,
    draw: (c) => {
      circle(c, 0, 0, 11.5, '#C9D3DA');
      circle(c, 0, 0, 10, '#F4F6F7');
    },
  },
  {
    name: 'helmetStripe',
    x0: -2,
    y0: -11,
    x1: 2,
    y1: 11,
    draw: (c) => rrect(c, -1.5, -10.5, 3, 21, 1.5, '#fff'),
  },
  {
    name: 'foot',
    x0: -8,
    y0: -6,
    x1: 8,
    y1: 6,
    draw: (c) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
      c.fill();
    },
  },
  {
    name: 'vee',
    x0: -8,
    y0: -2,
    x1: 8,
    y1: 10,
    draw: (c) => {
      c.strokeStyle = '#fff';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-6, 8);
      c.lineTo(0, 0);
      c.lineTo(6, 8);
      c.stroke();
    },
  },

  // ---- boards (coloured, not tinted)
  {
    name: 'b-surf',
    x0: -34,
    y0: -125,
    x1: 34,
    y1: 168,
    draw: (c) => {
      path(c, PATHS.surf, '#FFFFFF');
      line(c, 0, -116, 0, 120, 1.5, '#DCE5EA');
      rrect(c, -14, 70, 28, 42, 9, '#4A5866');
      path(c, 'M1,120 C12,136 -8,146 5,166', null, NAVY, 2);
    },
  },
  {
    name: 'b-skim',
    x0: -37,
    y0: -82,
    x1: 37,
    y1: 82,
    draw: (c) => {
      path(c, PATHS.skim, '#1F8AA6');
      path(c, 'M-23,62 Q0,74 23,62', null, '#FFB74D', 6);
    },
  },
  {
    name: 'b-wind',
    x0: -49,
    y0: -161,
    x1: 49,
    y1: 162,
    draw: (c) => {
      path(c, PATHS.windsurf, '#FFFFFF');
      line(c, 0, -150, 0, 158, 1.5, '#DCE5EA');
      circle(c, 0, -16, 6, NAVY);
    },
  },
  {
    name: 'strap',
    x0: -12,
    y0: -4,
    x1: 12,
    y1: 4,
    draw: (c) => rrect(c, -11, -3.5, 22, 7, 3.5, NAVY),
  },
  {
    name: 'b-kite',
    x0: -29,
    y0: -81,
    x1: 29,
    y1: 81,
    draw: (c) => {
      c.save();
      c.rotate(-Math.PI / 2);
      path(c, PATHS.kiteboard, '#FFFFFF');
      rrect(c, -36, -5, 8, 12, 3, NAVY);
      rrect(c, 28, -5, 8, 12, 3, NAVY);
      c.restore();
    },
  },
  {
    name: 'b-kite-tips',
    x0: -18,
    y0: -75,
    x1: 18,
    y1: 75,
    draw: (c) => {
      c.save();
      c.rotate(-Math.PI / 2);
      rrect(c, -74, -17, 10, 34, 5, '#fff');
      rrect(c, 64, -17, 10, 34, 5, '#fff');
      c.restore();
    },
  },
  {
    name: 'b-foil',
    x0: -41,
    y0: -96,
    x1: 41,
    y1: 96,
    draw: (c) => {
      path(c, PATHS.foil, '#FFFFFF');
      rrect(c, -27, -59, 54, 142, 16, '#5B6876');
    },
  },
  {
    name: 'b-hull',
    x0: -74,
    y0: -214,
    x1: 74,
    y1: 236,
    draw: (c) => {
      path(c, PATHS.hull, '#FFFFFF', '#DCE5EA', 3);
      rrect(c, -48, 52, 96, 140, 18, '#E7EEF2');
      c.globalAlpha = 0.55;
      line(c, 0, 66, 0, 180, 4, NAVY);
      c.globalAlpha = 1;
      rrect(c, -6, 25, 12, 21, 3, '#9AA7B2');
      rrect(c, -6, 210, 12, 24, 4, NAVY);
      line(c, 0, 215, 0, 148, 6, '#9C7A54');
    },
  },

  // ---- sails and wings (tinted with the guest colour: white = the colour, grey = darker)
  {
    name: 'wsail',
    x0: -4,
    y0: -4,
    x1: 176,
    y1: 205,
    draw: (c) => {
      path(c, PATHS.wsail, '#FFFFFF', GREY_EDGE, 2);
      path(c, PATHS.wluff, null, '#b0b0b0', 6);
    },
  },
  {
    name: 'wsail-hi',
    x0: 40,
    y0: 24,
    x1: 150,
    y1: 150,
    draw: (c) => {
      c.globalAlpha = 0.7;
      line(c, 44, 44, 69, 28, 2, '#fff');
      line(c, 86, 94, 120, 76, 2, '#fff');
      line(c, 118, 146, 146, 136, 2, '#fff');
    },
  },
  {
    name: 'wboom',
    x0: -48,
    y0: -6,
    x1: 196,
    y1: 212,
    draw: (c) => {
      c.save();
      c.translate(72.5, 106);
      c.rotate((53.9 * Math.PI) / 180);
      c.strokeStyle = METAL;
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(0, 0, 119, 15, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    },
  },
  {
    name: 'dsail',
    x0: -2,
    y0: -1,
    x1: 120,
    y1: 196,
    draw: (c) => path(c, PATHS.dsail, '#FFFFFF', GREY_EDGE, 2),
  },
  {
    name: 'dsail-hi',
    x0: 34,
    y0: 60,
    x1: 106,
    y1: 133,
    draw: (c) => {
      c.globalAlpha = 0.6;
      line(c, 38, 74.4, 76, 64.8, 2, '#fff');
      line(c, 66, 128.8, 102, 120.8, 2, '#fff');
    },
  },
  {
    name: 'dboom',
    x0: -8,
    y0: -8,
    x1: 102,
    y1: 196,
    draw: (c) => {
      line(c, 0, 2, 98, 192, 5, METAL);
      circle(c, 0, 0, 7, NAVY);
    },
  },
  {
    name: 'kite',
    x0: -124,
    y0: -80,
    x1: 124,
    y1: 62,
    draw: (c) => {
      path(c, PATHS.kite, '#FFFFFF');
      path(c, PATHS.kiteEdge, null, '#d6d6d6', 9);
      line(c, -71, -17, -62, 14, 4, '#d6d6d6');
      line(c, 0, -42, 0, 0, 4, '#d6d6d6');
      line(c, 71, -17, 62, 14, 4, '#d6d6d6');
    },
  },
  {
    name: 'wing',
    // pivot = the grip between the two handles (0, 80)
    x0: -126,
    y0: -86,
    x1: 126,
    y1: 30,
    draw: (c) => {
      c.save();
      c.translate(0, -80);
      path(c, PATHS.wing, '#FFFFFF');
      path(c, PATHS.wingEdge, null, '#9d9d9d', 10);
      line(c, 0, 2, 0, 104, 7, '#9d9d9d');
      rrect(c, -6, 66, 12, 8, 3, '#3a3a3a');
      rrect(c, -6, 94, 12, 8, 3, '#3a3a3a');
      c.restore();
    },
  },
  {
    name: 'wing-win',
    x0: -66,
    y0: -56,
    x1: 66,
    y1: -32,
    draw: (c) => {
      c.save();
      c.translate(0, -80);
      rrect(c, -64, 26, 28, 20, 6, '#ECE6F8');
      rrect(c, 36, 26, 28, 20, 6, '#ECE6F8');
      c.restore();
    },
  },
  {
    name: 'bar',
    x0: -28,
    y0: -5,
    x1: 28,
    y1: 46,
    draw: (c) => {
      line(c, 0, 3, 0, 44, 2, NAVY);
      rrect(c, -22, -3, 44, 6, 3, NAVY);
      circle(c, -24, 0, 3.5, '#E53935');
      circle(c, 24, 0, 3.5, '#1E88E5');
    },
  },
  {
    name: 'buoy',
    x0: -16,
    y0: -16,
    x1: 16,
    y1: 16,
    draw: (c) => {
      circle(c, 0, 0, 14, '#D9531E');
      circle(c, 0, 0, 12, '#FF7A3D');
      c.save();
      c.beginPath();
      c.arc(0, 0, 12, 0, Math.PI * 2);
      c.clip();
      c.fillStyle = '#FFFFFF';
      c.fillRect(-14, -3, 28, 6);
      c.restore();
      circle(c, -4, -5, 2.5, 'rgba(255,255,255,0.7)');
    },
  },
  {
    name: 'ball-v',
    x0: -12,
    y0: -12,
    x1: 12,
    y1: 12,
    draw: (c) => {
      circle(c, 0, 0, 10.5, '#C9D3DA');
      circle(c, 0, 0, 9.3, '#FFFFFF');
      path(c, 'M-9,-4 Q0,4 9,-4', null, '#FFCA28', 2.5);
      path(c, 'M-6,5 Q0,-2 6,5', null, '#2F7BFF', 2.5);
    },
  },
  {
    name: 'ball-s',
    x0: -12,
    y0: -12,
    x1: 12,
    y1: 12,
    draw: (c) => {
      circle(c, 0, 0, 10.5, '#C9D3DA');
      circle(c, 0, 0, 9.3, '#FFFFFF');
      circle(c, 0, 0, 3.6, '#22262b');
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        circle(c, Math.cos(a) * 8, Math.sin(a) * 8, 2, '#22262b');
      }
    },
  },
];

// ---------------------------------------------------------------- gear per section (docs/SPORTS.md)

const WOOD = '#C99560';
const STRAP = (c: Ctx, x: number, y: number) => rrect(c, x - 13, y - 4, 26, 8, 4, NAVY);

/** Draw a path in the drawn (sideways) frame turned so its +x points up, like the kite boards. */
function upright(c: Ctx, draw: () => void) {
  c.save();
  c.rotate(-Math.PI / 2);
  draw();
  c.restore();
}

const GEAR_FRAMES: FrameDef[] = [
  // surf school soft-top: tinted with the guest colour; the rails and the white slick bottom edge stay lighter/darker
  {
    name: 'b-soft',
    x0: -42,
    y0: -112,
    x1: 42,
    y1: 110,
    draw: (c) => {
      path(c, G.soft, '#FFFFFF', '#bdbdbd', 4);
      c.globalAlpha = 0.35;
      line(c, -18, -60, -18, 70, 2, '#d9d9d9');
      line(c, 18, -60, 18, 70, 2, '#d9d9d9');
      c.globalAlpha = 1;
    },
  },
  // longboard: tinted pastel deck, a wooden stringer
  {
    name: 'b-long',
    x0: -40,
    y0: -152,
    x1: 40,
    y1: 150,
    draw: (c) => {
      path(c, G.long, '#FFFFFF', '#c4c4c4', 3);
      line(c, 0, -146, 0, 146, 3, '#a8a8a8');
    },
  },
  {
    name: 'b-gun',
    x0: -31,
    y0: -154,
    x1: 31,
    y1: 154,
    draw: (c) => {
      path(c, G.gun, '#FFFFFF');
      line(c, 0, -146, 0, 148, 1.5, '#DCE5EA');
      c.save();
      c.clip(new Path2D(G.gun));
      c.fillStyle = '#E53935';
      c.fillRect(-32, -112, 64, 14);
      c.restore();
      STRAP(c, 0, 40);
      STRAP(c, 0, 104);
      rrect(c, -12, 112, 24, 34, 8, '#4A5866');
    },
  },
  {
    name: 'b-wood',
    x0: -40,
    y0: -40,
    x1: 40,
    y1: 40,
    draw: (c) => {
      c.fillStyle = '#8f6236';
      c.beginPath();
      c.ellipse(0, 0, 38, 38, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = WOOD;
      c.beginPath();
      c.ellipse(0, 0, 35, 35, 0, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.clip();
      c.globalAlpha = 0.45;
      for (let k = -30; k <= 30; k += 9) path(c, `M${k},-40 Q${k + 6},0 ${k},40`, null, '#9b6a3d', 2);
      c.restore();
    },
  },
  {
    name: 'b-skim-small',
    x0: -30,
    y0: -64,
    x1: 30,
    y1: 64,
    draw: (c) => {
      path(c, G.skimSmall, '#FFFFFF', '#c4c4c4', 3);
      path(c, 'M-16,46 Q0,54 16,46', null, '#ffffff', 5);
    },
  },
  {
    name: 'b-skim-carbon',
    x0: -37,
    y0: -82,
    x1: 37,
    y1: 82,
    draw: (c) => {
      path(c, PATHS.skim, '#2B2F36');
      c.save();
      c.clip(new Path2D(PATHS.skim));
      c.globalAlpha = 0.25;
      for (let k = -80; k < 80; k += 8) line(c, -40, k, 40, k + 40, 1.5, '#ffffff');
      c.restore();
      path(c, 'M-23,62 Q0,74 23,62', null, '#FF5A1F', 6);
      path(c, 'M0,-70 L0,40', null, '#FF5A1F', 3);
    },
  },
  {
    name: 'b-wind-wide',
    x0: -68,
    y0: -152,
    x1: 68,
    y1: 156,
    draw: (c) => {
      path(c, G.windWide, '#FFFFFF');
      rrect(c, -44, -40, 88, 170, 30, '#B8D4E3');
      circle(c, 0, -16, 6, NAVY);
    },
  },
  {
    name: 'b-wind-race',
    x0: -46,
    y0: -152,
    x1: 46,
    y1: 152,
    draw: (c) => {
      path(c, G.windRace, '#FFFFFF');
      c.save();
      c.clip(new Path2D(G.windRace));
      c.fillStyle = '#E53935';
      c.fillRect(-50, 112, 100, 40);
      c.restore();
      line(c, 0, -140, 0, 110, 1.5, '#DCE5EA');
      circle(c, 0, -16, 6, NAVY);
    },
  },
  {
    name: 'b-wind-free',
    x0: -52,
    y0: -120,
    x1: 52,
    y1: 122,
    draw: (c) => {
      path(c, G.windFree, '#FFFFFF');
      c.save();
      c.clip(new Path2D(G.windFree));
      c.fillStyle = '#7E57C2';
      c.fillRect(-60, -120, 120, 50);
      c.fillStyle = '#26C6DA';
      c.fillRect(-60, -70, 120, 10);
      c.restore();
      rrect(c, -30, 10, 60, 100, 18, '#4A5866');
      circle(c, 0, -16, 6, NAVY);
    },
  },
  {
    name: 'b-wind-wave',
    x0: -36,
    y0: -126,
    x1: 36,
    y1: 124,
    draw: (c) => {
      path(c, G.windWave, '#FFFFFF');
      c.save();
      c.clip(new Path2D(G.windWave));
      c.fillStyle = '#FFCA28';
      c.fillRect(-40, -126, 80, 40);
      c.restore();
      line(c, 0, -110, 0, 118, 1.5, '#DCE5EA');
      circle(c, 0, -16, 6, NAVY);
    },
  },
  {
    name: 'b-kite-big',
    x0: -36,
    y0: -98,
    x1: 36,
    y1: 98,
    draw: (c) =>
      upright(c, () => {
        path(c, G.kiteBig, '#FFFFFF');
        rrect(c, -86, -20, 12, 40, 6, '#29B6F6');
        rrect(c, 74, -20, 12, 40, 6, '#29B6F6');
        rrect(c, -40, -6, 10, 14, 3, NAVY);
        rrect(c, 30, -6, 10, 14, 3, NAVY);
      }),
  },
  {
    name: 'b-kite-boots',
    x0: -29,
    y0: -81,
    x1: 29,
    y1: 81,
    draw: (c) =>
      upright(c, () => {
        path(c, PATHS.kiteboard, '#FFFFFF');
        rrect(c, -74, -17, 10, 34, 5, '#222831');
        rrect(c, 64, -17, 10, 34, 5, '#222831');
        // boots: big dark bindings instead of straps
        rrect(c, -44, -14, 24, 28, 9, '#222831');
        rrect(c, 20, -14, 24, 28, 9, '#222831');
      }),
  },
  {
    name: 'b-kite-dir',
    x0: -29,
    y0: -94,
    x1: 29,
    y1: 92,
    draw: (c) =>
      upright(c, () => {
        path(c, G.kiteDir, '#FFFFFF');
        line(c, -86, 0, 88, 0, 1.5, '#DCE5EA');
        rrect(c, -80, -18, 40, 36, 10, '#4A5866');
      }),
  },
  {
    name: 'b-foil-big',
    x0: -54,
    y0: -120,
    x1: 54,
    y1: 120,
    draw: (c) => {
      path(c, G.foilBig, '#FFFFFF');
      rrect(c, -36, -84, 72, 184, 22, '#9FB3C2');
    },
  },
  {
    name: 'b-foil-down',
    x0: -36,
    y0: -162,
    x1: 36,
    y1: 158,
    draw: (c) => {
      path(c, G.foilDown, '#FFFFFF');
      rrect(c, -22, -20, 44, 150, 14, '#5B6876');
    },
  },
  {
    name: 'b-foil-pro',
    x0: -38,
    y0: -80,
    x1: 38,
    y1: 82,
    draw: (c) => {
      path(c, G.foilPro, '#2B2F36');
      rrect(c, -24, -50, 48, 120, 14, '#5B6876');
      path(c, 'M-30,-60 L30,-60', null, '#FF5A1F', 4);
    },
  },
  {
    name: 'b-opti',
    x0: -72,
    y0: -120,
    x1: 72,
    y1: 128,
    draw: (c) => {
      path(c, G.opti, '#FFFFFF', '#DCE5EA', 3);
      rrect(c, -50, -70, 100, 170, 14, '#E7EEF2');
      rrect(c, -6, -10, 12, 18, 3, '#9AA7B2');
      rrect(c, -5, 112, 10, 16, 3, NAVY);
      line(c, 0, 116, 0, 72, 5, '#9C7A54');
    },
  },
  {
    name: 'b-cat',
    x0: -176,
    y0: -202,
    x1: 176,
    y1: 200,
    draw: (c) => {
      // the trampoline between the hulls, two beams, two hulls
      c.fillStyle = 'rgba(42,58,76,0.55)';
      c.fillRect(-150, -90, 300, 220);
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 1.5;
      for (let k = -150; k <= 150; k += 18) line(c, k, -90, k, 130, 1, 'rgba(255,255,255,0.3)');
      line(c, -150, -90, 150, -90, 8, '#B0BEC5');
      line(c, -150, 130, 150, 130, 8, '#B0BEC5');
      c.save();
      c.translate(-150, 0);
      path(c, G.catHull, '#FFFFFF', '#DCE5EA', 2);
      c.restore();
      c.save();
      c.translate(150, 0);
      path(c, G.catHull, '#FFFFFF', '#DCE5EA', 2);
      c.restore();
    },
  },
  {
    name: 'b-yacht',
    x0: -112,
    y0: -334,
    x1: 112,
    y1: 324,
    draw: (c) => {
      path(c, G.yacht, '#FFFFFF', '#C9D3DA', 4);
      // deck: teak strip, cockpit, wheel and a dark bow sprit line
      c.save();
      c.clip(new Path2D(G.yacht));
      c.fillStyle = '#E7EEF2';
      c.fillRect(-80, 140, 160, 170);
      c.restore();
      rrect(c, -40, -60, 80, 120, 18, '#D5DEE5');
      circle(c, 0, 250, 22, '#4A5866');
      circle(c, 0, 250, 16, '#E7EEF2');
      line(c, 0, -330, 0, -380, 4, '#4A5866');
      c.fillStyle = '#E53935';
      c.font = 'bold 60px Arial';
      c.textAlign = 'center';
      c.fillText('7', 0, 120);
    },
  },
  {
    name: 'spin',
    x0: -156,
    y0: -296,
    x1: 186,
    y1: 6,
    draw: (c) => {
      path(c, G.spin, '#FFFFFF', '#c9c9c9', 3);
      c.save();
      c.clip(new Path2D(G.spin));
      c.globalAlpha = 0.55;
      // panels: lighter stripes (tinted they turn into shades of the colour)
      for (let k = -150; k < 200; k += 60) {
        c.fillStyle = '#d6d6d6';
        c.fillRect(k, -300, 30, 310);
      }
      c.restore();
    },
  },
  {
    name: 'b-jetski',
    x0: -36,
    y0: -80,
    x1: 36,
    y1: 160,
    draw: (c) => {
      // the rescue sled behind it
      rrect(c, -32, 94, 64, 62, 10, '#FFCA28');
      line(c, -20, 104, -20, 146, 3, '#E0A800');
      line(c, 20, 104, 20, 146, 3, '#E0A800');
      line(c, 0, 74, 0, 96, 3, NAVY);
      path(c, G.jetski, '#E53935');
      rrect(c, -14, -6, 28, 54, 10, '#2B2F36');
      rrect(c, -30, -40, 60, 10, 4, '#2B2F36');
      path(c, 'M-26,-52 Q0,-70 26,-52', null, '#B0BEC5', 6);
    },
  },
  {
    name: 'b-committee',
    x0: -72,
    y0: -192,
    x1: 72,
    y1: 192,
    draw: (c) => {
      path(c, G.committee, '#FFFFFF', '#C9D3DA', 4);
      rrect(c, -46, -60, 92, 110, 14, '#90A4AE');
      rrect(c, -40, -54, 80, 30, 8, '#37474F');
      rrect(c, -50, 90, 100, 80, 12, '#E7EEF2');
      // the flag on a pole at the stern
      line(c, 40, 150, 40, 120, 3, '#37474F');
      c.fillStyle = '#FF8F00';
      c.fillRect(40, 120, 30, 20);
    },
  },
  // a white window in a freestyle sail (see-through), in the drawn sail frame
  {
    name: 'wsail-win',
    x0: 30,
    y0: 40,
    x1: 110,
    y1: 120,
    draw: (c) => {
      c.globalAlpha = 0.75;
      path(c, 'M46,58 L92,70 L104,108 L60,96 Z', '#EAF6FB');
    },
  },
  // race numbers (white patch with a dark digit), for the sails of slalom boards and racing dinghies
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d): FrameDef => ({
    name: `num-${d}`,
    x0: -18,
    y0: -22,
    x1: 18,
    y1: 22,
    draw: (c) => {
      rrect(c, -16, -20, 32, 40, 6, '#FFFFFF');
      c.fillStyle = '#1B1F24';
      c.font = 'bold 32px Arial';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(d), 0, 2);
    },
  })),
  // a small round slalom buoy seen from above
  {
    name: 'buoy-y',
    x0: -24,
    y0: -24,
    x1: 24,
    y1: 24,
    draw: (c) => {
      circle(c, 0, 0, 22, '#E0A800');
      circle(c, 0, 0, 19, '#FFD23F');
      circle(c, -6, -7, 5, 'rgba(255,255,255,0.7)');
    },
  },
  // a short flag for the committee boat start line
  {
    name: 'flag',
    x0: 0,
    y0: -12,
    x1: 40,
    y1: 12,
    draw: (c) => {
      c.fillStyle = '#FF8F00';
      c.fillRect(0, -10, 38, 20);
    },
  },
];

/** Bake the atlas once. */
export function bakeRigAtlas(scene: Phaser.Scene) {
  if (scene.textures.exists(ATLAS)) return;
  const pad = 3;
  const maxW = 2048;
  // shelf packing, tallest first
  const items = [...FRAMES, ...GEAR_FRAMES].map((f) => ({
    f,
    w: Math.ceil((f.x1 - f.x0) * RES) + pad * 2,
    h: Math.ceil((f.y1 - f.y0) * RES) + pad * 2,
    x: 0,
    y: 0,
  }));
  items.sort((a, b) => b.h - a.h);
  let x = 0;
  let y = 0;
  let row = 0;
  for (const it of items) {
    if (x + it.w > maxW) {
      x = 0;
      y += row;
      row = 0;
    }
    it.x = x;
    it.y = y;
    x += it.w;
    row = Math.max(row, it.h);
  }
  const H = y + row;
  const canvas = document.createElement('canvas');
  canvas.width = maxW;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (const it of items) {
    const f = it.f;
    ctx.save();
    ctx.translate(it.x + pad, it.y + pad);
    ctx.scale(RES, RES);
    ctx.translate(-f.x0, -f.y0);
    f.draw(ctx);
    ctx.restore();
  }
  const tex = scene.textures.addCanvas(ATLAS, canvas)!;
  for (const it of items) {
    const f = it.f;
    tex.add(f.name, 0, it.x + pad, it.y + pad, it.w - pad * 2, it.h - pad * 2);
    PIVOT.set(f.name, { ox: -f.x0 / (f.x1 - f.x0), oy: -f.y0 / (f.y1 - f.y0) });
  }
}

/**
 * The texture of a skin (made when first worn): its pattern in the shape of its section's gear, at the atlas
 * resolution, with the same pivot as the gear picture, so it lies exactly over it. Returns the key and the origin.
 */
/** The board of a skin that has one (the 1990 set), as a texture laid over the board picture. */
export function skinBoardTexture(scene: Phaser.Scene, skin: SkinDef, b: SkinBoard, num?: number): { key: string; ox: number; oy: number } {
  const key = `skinb-${skin.id}-${b.frame}${num !== undefined ? `-${num}` : ''}`;
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * RES);
    canvas.height = Math.ceil(h * RES);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(RES, RES);
    ctx.translate(-b.x0, -b.y0);
    drawSkinBoard(ctx, skin, b.frame, num);
    scene.textures.addCanvas(key, canvas);
  }
  return { key, ox: -b.x0 / w, oy: -b.y0 / h };
}

/** The spinnaker of a skin that has one (the offshore yachts), laid over the spinnaker picture. */
export function skinSpinTexture(scene: Phaser.Scene, skin: SkinDef): { key: string; ox: number; oy: number } {
  const b = SPIN_BOUNDS;
  const key = `skins-${skin.id}`;
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * RES);
    canvas.height = Math.ceil(h * RES);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(RES, RES);
    ctx.translate(-b.x0, -b.y0);
    drawSkinSpin(ctx, skin);
    scene.textures.addCanvas(key, canvas);
  }
  return { key, ox: -b.x0 / w, oy: -b.y0 / h };
}

export function skinTexture(scene: Phaser.Scene, skin: SkinDef): { key: string; ox: number; oy: number } {
  const shape = skinShape(skin.sport, skin.level);
  const box = skinBounds(skin, shape);
  const key = `skin-${skin.id}`;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * RES);
    canvas.height = Math.ceil(h * RES);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(RES, RES);
    ctx.translate(-box.x0, -box.y0);
    drawSkin(ctx, skin, shape);
    scene.textures.addCanvas(key, canvas);
  }
  return { key, ox: -box.x0 / w, oy: -box.y0 / h };
}

/** One bit of a Club skin's trail (a leaf, a snowflake, ...), centred. */
export function trailTexture(scene: Phaser.Scene, kind: TrailKind, variant: number): string {
  const key = `trail-${kind}-${variant}`;
  if (!scene.textures.exists(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.ceil(TRAIL_SIZE * RES);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(RES, RES);
    ctx.translate(TRAIL_SIZE / 2, TRAIL_SIZE / 2);
    drawTrailBit(ctx, kind, variant);
    scene.textures.addCanvas(key, canvas);
  }
  return key;
}
