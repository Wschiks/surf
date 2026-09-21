import Phaser from 'phaser';
import { MAP_ROTATION_DEG } from '../config/layout';

// All art is drawn in code with the 2D canvas API and baked into textures. Nothing is downloaded.
// Drawing helpers use a deterministic pseudo random generator so the art is always identical.

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

// Older phone browsers (before Safari 16) have no roundRect: add a small version so the art still draws.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number | number[] = 0) {
    const r = Math.min(Array.isArray(radius) ? radius[0] : radius, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}
const UPRIGHT_ROT = (MAP_ROTATION_DEG * Math.PI) / 180;

/** World size and resolution factor of every baked texture, so images and tiles can be shown at the right size. */
export const texInfo = new Map<string, { w: number; h: number; scale: number }>();

/** Add a baked texture as an image sized in world px. */
export function placeImage(scene: Phaser.Scene, key: string, x: number, y: number) {
  const t = texInfo.get(key)!;
  return scene.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(t.w, t.h);
}

/** Add a baked texture as a repeating tile covering the given world rectangle. */
/** Add a baked texture as an upright billboard (it faces the viewer, whatever the map rotation). Origin is the bottom centre. */
export function placeUpright(scene: Phaser.Scene, key: string, x: number, y: number, ax = 0.5, ay = 1) {
  const t = texInfo.get(key)!;
  return scene.add.image(x, y, key).setOrigin(ax, ay).setDisplaySize(t.w, t.h).setRotation(-UPRIGHT_ROT);
}

export function placeTile(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, extraScale = 1) {
  const t = texInfo.get(key)!;
  const ts = scene.add.tileSprite(x, y, w, h, key).setOrigin(0, 0);
  ts.setTileScale((1 / t.scale) * extraScale, (1 / t.scale) * extraScale);
  return ts;
}

/** Bake a canvas drawing into a texture. `w` and `h` are in world px, `scale` is the canvas resolution factor. */
export function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  scale: number,
  draw: (ctx: Ctx, w: number, h: number) => void,
) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  draw(ctx, w, h);
  scene.textures.addCanvas(key, canvas);
  texInfo.set(key, { w, h, scale });
}

function poly(ctx: Ctx, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, r: () => number, wobble = 0.18, n = 14) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * wobble * 2;
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** A rounded boulder with light on the top left. */
function boulder(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, base = '#8a7f74') {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  blob(ctx, cx + rx * 0.15, cy + ry * 0.25, rx * 1.05, ry * 0.9, rng(seed + 1), 0.1, 10);
  ctx.fill();
  const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  g.addColorStop(0, lighten(base, 0.35));
  g.addColorStop(0.5, base);
  g.addColorStop(1, lighten(base, -0.35));
  ctx.fillStyle = g;
  blob(ctx, cx, cy, rx, ry, r, 0.14, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,25,0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // cracks
  ctx.strokeStyle = 'rgba(40,30,25,0.25)';
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.2, cy - ry * 0.5);
  ctx.lineTo(cx + rx * 0.1, cy);
  ctx.lineTo(cx - rx * 0.1, cy + ry * 0.5);
  ctx.stroke();
  ctx.restore();
}

export function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------- tiles

export function bakeSandTile(scene: Phaser.Scene) {
  bake(scene, 'tile-sand', 200, 200, 1.5, (ctx, w, h) => {
    const r = rng(11);
    ctx.fillStyle = '#f3deaa';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const x = r() * w,
        y = r() * h;
      ctx.fillStyle = r() > 0.5 ? 'rgba(200,160,90,0.22)' : 'rgba(255,250,225,0.35)';
      ctx.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    // soft ripples
    ctx.strokeStyle = 'rgba(190,150,85,0.14)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const y = r() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y - 5, w * 0.6, y + 5, w, y);
      ctx.stroke();
    }
  });
}

/** Small white dashes that drift over the water to make it feel alive. */
export function bakeSparkleTile(scene: Phaser.Scene) {
  bake(scene, 'tile-sparkle', 240, 240, 1.5, (ctx, w, h) => {
    const r = rng(23);
    ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const x = r() * w,
        y = r() * h,
        len = 8 + r() * 18;
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.3})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - 2.5, x + len, y);
      ctx.stroke();
    }
  });
}

export function bakeCloudTile(scene: Phaser.Scene) {
  bake(scene, 'tile-cloud', 512, 512, 0.75, (ctx, w, h) => {
    const r = rng(7);
    for (let i = 0; i < 34; i++) {
      const x = r() * w,
        y = r() * h,
        rad = 50 + r() * 90;
      for (const [ox, oy] of [
        [0, 0],
        [w, 0],
        [-w, 0],
        [0, h],
        [0, -h],
      ]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  });
}

// ---------------------------------------------------------------- landmarks

/** Skimboarding spot: sandy cove with large rocks, a rock arch and cliffs. 350 x 190 world px. */
export const ROCKS_SIZE = { w: 350, h: 190 };
export function bakeRocks(scene: Phaser.Scene) {
  bake(scene, 'lm-rocks', ROCKS_SIZE.w, ROCKS_SIZE.h, 2.5, (ctx) => {
    // sand spit reaching into the shallows (the cove floor)
    const sg = ctx.createLinearGradient(0, 20, 0, 190);
    sg.addColorStop(0, '#f3deaa');
    sg.addColorStop(0.6, '#f0d69a');
    sg.addColorStop(1, 'rgba(240,214,154,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(350, 0);
    ctx.lineTo(350, 110);
    ctx.bezierCurveTo(300, 150, 220, 165, 150, 150);
    ctx.bezierCurveTo(90, 140, 40, 150, 0, 170);
    ctx.closePath();
    ctx.fill();
    // clear shallow water tint around the cove
    const wg = ctx.createRadialGradient(150, 165, 10, 150, 165, 150);
    wg.addColorStop(0, 'rgba(200,255,245,0.55)');
    wg.addColorStop(1, 'rgba(200,255,245,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 100, 350, 90);

    // cliff wall on the left edge
    ctx.fillStyle = '#6f645a';
    poly(ctx, [
      [0, 0], [60, 0], [70, 25], [55, 45], [66, 70], [48, 98], [30, 110], [0, 125],
    ]);
    ctx.fill();
    const cg = ctx.createLinearGradient(0, 0, 70, 0);
    cg.addColorStop(0, 'rgba(255,255,255,0.18)');
    cg.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,22,18,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(4 + i * 9, 6 + i * 4);
      ctx.lineTo(10 + i * 8, 60 + i * 6);
      ctx.stroke();
    }

    // rock arch
    ctx.save();
    ctx.translate(112, 84);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(6, 40, 50, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    const ag = ctx.createLinearGradient(-40, -40, 40, 40);
    ag.addColorStop(0, '#b3a595');
    ag.addColorStop(0.5, '#8a7c6c');
    ag.addColorStop(1, '#5d5145');
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.moveTo(-40, 40);
    ctx.lineTo(-36, -4);
    ctx.bezierCurveTo(-34, -34, 30, -38, 36, -6);
    ctx.lineTo(42, 40);
    ctx.lineTo(24, 40);
    ctx.lineTo(22, 4);
    ctx.bezierCurveTo(16, -14, -14, -14, -18, 6);
    ctx.lineTo(-20, 40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,25,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // inside of the arch shows water
    ctx.fillStyle = 'rgba(120,220,230,0.65)';
    ctx.beginPath();
    ctx.moveTo(-18, 40);
    ctx.lineTo(-16, 8);
    ctx.bezierCurveTo(-12, -10, 16, -10, 20, 8);
    ctx.lineTo(22, 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // big boulders
    boulder(ctx, 190, 66, 26, 20, 3, '#8d8175');
    boulder(ctx, 222, 88, 20, 15, 4, '#9a8e80');
    boulder(ctx, 265, 58, 30, 22, 5, '#7d7267');
    boulder(ctx, 300, 92, 24, 18, 6, '#948879');
    boulder(ctx, 40, 130, 20, 14, 7, '#8a7e72');
    boulder(ctx, 72, 150, 13, 9, 8, '#a09384');
    boulder(ctx, 330, 130, 15, 11, 9, '#8a7e72');
    // foam around rocks
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    for (const [x, y, rx, ry] of [
      [40, 142, 24, 8],
      [330, 140, 20, 7],
      [110, 126, 44, 7],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
  });
}

/** Coral reef in turquoise shallows with a long clean wave along its outer edge. 380 x 120 world px. */
export const REEF_SIZE = { w: 380, h: 130 };
export function bakeReef(scene: Phaser.Scene) {
  bake(scene, 'lm-reef', REEF_SIZE.w, REEF_SIZE.h, 2.5, (ctx, w, h) => {
    const r = rng(41);
    // deep blue water behind the reef, along the bottom
    const dg = ctx.createLinearGradient(0, h * 0.55, 0, h);
    dg.addColorStop(0, 'rgba(10,60,140,0)');
    dg.addColorStop(0.5, 'rgba(10,60,140,0.55)');
    dg.addColorStop(1, 'rgba(6,40,110,0.75)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, w, h);
    // turquoise shallows
    const tg = ctx.createLinearGradient(0, 0, 0, h * 0.75);
    tg.addColorStop(0, 'rgba(120,255,230,0.7)');
    tg.addColorStop(0.8, 'rgba(50,220,220,0.75)');
    tg.addColorStop(1, 'rgba(50,220,220,0)');
    ctx.fillStyle = tg;
    blob(ctx, w / 2, h * 0.42, w * 0.47, h * 0.36, rng(3), 0.06, 26);
    ctx.fill();

    // coral heads
    const colors = ['#ff6f91', '#ff9f45', '#b36bff', '#ffd23f', '#5ee27a', '#ff5a5a', '#4dd0ff'];
    for (let i = 0; i < 24; i++) {
      const x = 22 + r() * (w - 44);
      const y = 14 + r() * (h * 0.52);
      const c = colors[Math.floor(r() * colors.length)];
      const size = 6 + r() * 11;
      const kind = Math.floor(r() * 3);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,60,80,0.22)';
      ctx.beginPath();
      ctx.ellipse(1.5, size * 0.55, size * 0.95, size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (kind === 0) {
        // brain coral
        const g = ctx.createRadialGradient(-size * 0.3, -size * 0.3, 1, 0, 0, size);
        g.addColorStop(0, lighten(c, 0.5));
        g.addColorStop(1, c);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.9;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.8 - Math.abs(k) * 0.5, 0.5 + k * 0.3, 2.4 + k * 0.3);
          ctx.stroke();
        }
      } else if (kind === 1) {
        // branching coral
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 + (k - 2.5) * 0.42;
          ctx.beginPath();
          ctx.moveTo(0, size * 0.3);
          ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(Math.cos(a) * size, Math.sin(a) * size, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = lighten(c, 0.4);
          ctx.fill();
        }
      } else {
        // fan / table coral
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = lighten(c, 0.4);
        ctx.beginPath();
        ctx.ellipse(-size * 0.2, -size * 0.15, size * 0.55, size * 0.22, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // long clean wave along the outer edge of the reef: dark face, bright lip and foam
    const y0 = h * 0.62;
    const face = ctx.createLinearGradient(0, y0 - 14, 0, y0 + 16);
    face.addColorStop(0, 'rgba(120,240,240,0.0)');
    face.addColorStop(0.35, 'rgba(60,190,215,0.85)');
    face.addColorStop(1, 'rgba(15,90,170,0.9)');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.moveTo(0, y0 + 4);
    for (let x = 0; x <= w; x += 10) ctx.lineTo(x, y0 + Math.sin(x / 38) * 3.2 - 6);
    ctx.lineTo(w, y0 + 18);
    ctx.lineTo(0, y0 + 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = y0 + Math.sin(x / 38) * 3.2 - 6;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.6;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const y = y0 + Math.sin(x / 38 + k) * 3.2 - 6 + k * 7;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
}

/** Nazare: red lighthouse on a stone fort at the cliff edge, huge waves crashing below. 400 x 150 world px. */
export const FORT_SIZE = { w: 400, h: 150 };
export function bakeFort(scene: Phaser.Scene) {
  bake(scene, 'lm-fort', FORT_SIZE.w, FORT_SIZE.h, 2.5, (ctx, w, h) => {
    const r = rng(77);
    // cliff headland from the right edge
    const cg = ctx.createLinearGradient(w - 190, 0, w, h);
    cg.addColorStop(0, '#9a8a78');
    cg.addColorStop(1, '#5c5147');
    ctx.fillStyle = cg;
    poly(ctx, [
      [w, 0], [w - 150, 0], [w - 168, 20], [w - 160, 45], [w - 176, 70], [w - 150, 92],
      [w - 120, 100], [w - 84, 112], [w - 40, 120], [w, 128],
    ]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,25,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // cliff strata
    ctx.strokeStyle = 'rgba(40,30,25,0.22)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w - 170 + i * 6, 30 + i * 14);
      ctx.bezierCurveTo(w - 130, 36 + i * 14, w - 80, 26 + i * 14, w, 34 + i * 14);
      ctx.stroke();
    }
    // stone fort on top
    const fx = w - 128,
      fy = 16;
    ctx.fillStyle = '#c9bca6';
    ctx.fillRect(fx, fy + 24, 96, 34);
    ctx.fillStyle = '#b3a58e';
    ctx.fillRect(fx, fy + 24, 96, 6);
    for (let i = 0; i < 8; i++) ctx.fillRect(fx + 2 + i * 12, fy + 17, 8, 8); // battlements
    ctx.strokeStyle = 'rgba(90,75,55,0.5)';
    ctx.lineWidth = 0.8;
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 8; i++) ctx.strokeRect(fx + i * 12 + (row % 2) * 6, fy + 32 + row * 8, 12, 8);
    ctx.fillStyle = '#5b4a3a';
    ctx.beginPath();
    ctx.moveTo(fx + 40, fy + 58);
    ctx.lineTo(fx + 40, fy + 44);
    ctx.arc(fx + 48, fy + 44, 8, Math.PI, 0);
    ctx.lineTo(fx + 56, fy + 58);
    ctx.fill();
    // huge waves crashing below the cliff
    for (let layer = 0; layer < 3; layer++) {
      const yb = 100 + layer * 14;
      ctx.fillStyle = `rgba(255,255,255,${0.55 - layer * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(w - 260, yb + 30);
      for (let x = w - 260; x <= w; x += 8) {
        const bump = Math.sin(x / 11 + layer * 2) * 6 + Math.sin(x / 27) * 8;
        ctx.lineTo(x, yb - 8 + bump - (x > w - 190 ? 12 : 0));
      }
      ctx.lineTo(w, yb + 30);
      ctx.closePath();
      ctx.fill();
    }
    // spray
    for (let i = 0; i < 40; i++) {
      const x = w - 200 + r() * 190;
      const y = 78 + r() * 40;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // dark wave face in front of the foam
    const fg = ctx.createLinearGradient(0, 100, 0, h);
    fg.addColorStop(0, 'rgba(20,90,160,0)');
    fg.addColorStop(1, 'rgba(10,50,120,0.8)');
    ctx.fillStyle = fg;
    ctx.fillRect(w - 300, 100, 300, h - 100);
  });
}


/** The red lighthouse. Drawn upright (it is placed as a billboard). Base of the tower is at (22, 96). */
export const LIGHTHOUSE_SIZE = { w: 44, h: 110 };
export function bakeLighthouse(scene: Phaser.Scene) {
  bake(scene, 'lm-lighthouse', LIGHTHOUSE_SIZE.w, LIGHTHOUSE_SIZE.h, 4, (ctx) => {
    const lx = 22;
    const fy = 72; // y of the base minus 24 to reuse the tower geometry
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(lx + 8, fy + 24, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const lg = ctx.createLinearGradient(lx - 12, 0, lx + 12, 0);
    lg.addColorStop(0, '#e0382e');
    lg.addColorStop(0.5, '#ff5a45');
    lg.addColorStop(1, '#a8201a');
    ctx.fillStyle = lg;
    poly(ctx, [[lx - 11, fy + 24], [lx - 7, fy - 40], [lx + 7, fy - 40], [lx + 11, fy + 24]]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    poly(ctx, [[lx - 9.6, fy - 4], [lx - 8.6, fy - 12], [lx + 8.6, fy - 12], [lx + 9.6, fy - 4]]);
    ctx.fill();
    poly(ctx, [[lx - 8, fy - 24], [lx - 7.6, fy - 30], [lx + 7.6, fy - 30], [lx + 8, fy - 24]]);
    ctx.fill();
    ctx.fillStyle = '#ffe89a';
    ctx.fillRect(lx - 7, fy - 50, 14, 10);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(lx - 9, fy - 52, 18, 3);
    ctx.fillStyle = '#c92b22';
    poly(ctx, [[lx - 9, fy - 52], [lx, fy - 64], [lx + 9, fy - 52]]);
    ctx.fill();
    const bg = ctx.createRadialGradient(lx, fy - 45, 2, lx, fy - 45, 24);
    bg.addColorStop(0, 'rgba(255,240,160,0.55)');
    bg.addColorStop(1, 'rgba(255,240,160,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(lx - 24, fy - 70, 48, 48);
  });
}

/** Foam that rolls along the shoreline. 200 x 40 world px, tiles horizontally. */
export function bakeShoreFoam(scene: Phaser.Scene) {
  bake(scene, 'tile-shorefoam', 200, 40, 2, (ctx, w) => {
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.85 - k * 0.25})`;
      ctx.lineWidth = 3 - k * 0.7;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = 8 + k * 9 + Math.sin(((x + k * 30) / w) * Math.PI * 4) * 3;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
}

// ---------------------------------------------------------------- water looks

import type { GuestKind, WaterLook } from '../config/sports';

/** Colour wash over the water of a zone, so each level has its own background. */
export const LOOK_TINT: Record<WaterLook, [number, number]> = {
  flat: [0x7fe8d8, 0.28],
  ripple: [0x4db8e0, 0.2],
  shallows: [0xd8fff2, 0.4],
  rolling: [0x2aa5c9, 0.2],
  reef: [0x22d3c5, 0.32],
  big: [0x0a3a80, 0.4],
  shorebreak: [0x9be3ff, 0.25],
  bigbreak: [0x0a4a90, 0.36],
  chop: [0x1a6fb0, 0.3],
  swell: [0x123f8c, 0.34],
};

export interface WaveStyle {
  /** How fast the pattern rolls toward the beach (world px per second). */
  speed: number;
  alpha: number;
  /** Extra tile scale (bigger = larger waves). */
  scale: number;
}

export const WAVE_STYLES: Record<WaterLook, WaveStyle> = {
  flat: { speed: 2, alpha: 0.5, scale: 1 },
  shallows: { speed: 4, alpha: 0.7, scale: 1 },
  rolling: { speed: 9, alpha: 0.85, scale: 1 },
  reef: { speed: 11, alpha: 0.85, scale: 1 },
  big: { speed: 16, alpha: 0.95, scale: 1.5 },
  shorebreak: { speed: 12, alpha: 0.9, scale: 1 },
  bigbreak: { speed: 20, alpha: 0.95, scale: 1.5 },
  chop: { speed: 10, alpha: 0.8, scale: 1 },
  ripple: { speed: 6, alpha: 0.65, scale: 1 },
  swell: { speed: 7, alpha: 0.7, scale: 1.8 },
};

/** One repeating tile per water look (200 x 120 world px). Waves roll toward the top of the tile. */
export function bakeWaveTile(scene: Phaser.Scene, look: WaterLook) {
  const key = 'wave-' + look;
  if (scene.textures.exists(key)) return key;
  bake(scene, key, 200, 120, 1.5, (ctx, w, h) => {
    const r = rng(look.length * 31 + 5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const line = (y: number, amp: number, alpha: number, width: number, phase = 0) => {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const yy = y + Math.sin(((x + phase) / w) * Math.PI * 2) * amp;
        x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.stroke();
    };
    switch (look) {
      case 'flat':
        for (let i = 0; i < 10; i++) {
          const x = r() * w,
            y = r() * h;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 8 + r() * 10, y);
          ctx.stroke();
        }
        break;
      case 'shallows':
        for (let i = 0; i < 26; i++) {
          const x = r() * w,
            y = r() * h;
          ctx.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.3})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y, 2 + r() * 4, 0, Math.PI * 1.4);
          ctx.stroke();
        }
        line(30, 2, 0.35, 1.5);
        line(90, 2, 0.35, 1.5, 60);
        break;
      case 'rolling':
        line(20, 5, 0.75, 2.6);
        line(20 + 3, 5, 0.25, 6);
        line(80, 6, 0.6, 2.2, 90);
        break;
      case 'reef':
        line(30, 3, 0.85, 3.2);
        line(34, 3, 0.3, 7);
        line(95, 4, 0.5, 2, 70);
        break;
      case 'big':
        line(18, 7, 0.95, 4.4);
        line(24, 7, 0.35, 11);
        line(78, 8, 0.85, 4, 100);
        for (let i = 0; i < 18; i++) {
          ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.4})`;
          ctx.beginPath();
          ctx.arc(r() * w, 12 + r() * 20, 1.5 + r() * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(r() * w, 72 + r() * 20, 1.5 + r() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'shorebreak':
      case 'bigbreak':
        for (const [y, ph] of [[26, 0], [86, 100]] as const) {
          for (let k = 0; k < 4; k++) {
            const x = k * 50 + ph * 0.1 + 6;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.arc(x + 20, y + 14, 18, Math.PI * 1.1, Math.PI * 1.95);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath();
            ctx.arc(x + 20, y + 14, 18, Math.PI * 1.1, Math.PI * 1.95);
            ctx.lineTo(x + 20, y + 14);
            ctx.fill();
          }
        }
        break;
      case 'ripple':
      case 'chop':
        for (let i = 0; i < (look === 'ripple' ? 26 : 70); i++) {
          const x = r() * w,
            y = r() * h,
            len = 5 + r() * 9;
          ctx.strokeStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
          ctx.stroke();
        }
        break;
      case 'swell':
        for (const y of [20, 78]) {
          const g = ctx.createLinearGradient(0, y - 22, 0, y + 22);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, y - 22, w, 44);
          line(y, 4, 0.5, 2, y);
        }
        break;
    }
  });
  return key;
}

// ---------------------------------------------------------------- guests
// Guests are seen from above, like the map: a board (or boat) with a rider on it, nose pointing up.
// Flat shapes only, so they read clearly even when small.

const SKIN = ['#f2c9a0', '#d9a06f', '#a86b43', '#7a4a2c'];
const HAIR = ['#3b2a1a', '#e2b04a', '#1c1c1c', '#8a3b1a', '#c9c9c9'];

/** Size (world px) of each guest picture and where the rider stands in it (fractions). */
export const GUEST_LOOK: Record<GuestKind, { w: number; h: number; ox: number; oy: number }> = {
  surfer: { w: 14, h: 34, ox: 0.5, oy: 0.55 },
  skimmer: { w: 18, h: 22, ox: 0.5, oy: 0.5 },
  windsurfer: { w: 36, h: 40, ox: 0.45, oy: 0.52 },
  kiter: { w: 30, h: 80, ox: 0.5, oy: 0.78 },
  foiler: { w: 34, h: 40, ox: 0.5, oy: 0.6 },
  sailor: { w: 28, h: 44, ox: 0.5, oy: 0.5 },
  walker: { w: 14, h: 14, ox: 0.5, oy: 0.5 },
};

export function guestTexture(scene: Phaser.Scene, kind: GuestKind, color: string, idx: number): string {
  const key = `guest-${kind}-${color}-${idx % 4}`;
  if (scene.textures.exists(key)) return key;
  const look = GUEST_LOOK[kind];
  bake(scene, key, look.w, look.h, 4, (ctx, w, h) => {
    const cx = w * look.ox;
    const cy = h * look.oy;
    const skin = SKIN[idx % SKIN.length];
    const hair = HAIR[(idx * 3) % HAIR.length];
    // A rider seen from above. Board sports stand SIDEWAYS on the board: the shoulders and arms run along the length of
    // the board and the head sits a little toward one side (regular or goofy, by guest number). `facing` = 0 gives the
    // front-facing person used for the beach walkers.
    const rider = (x: number, y: number, s: number, shirt: string, sideways = true) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      if (sideways) ctx.rotate(Math.PI / 2);
      const side = idx % 2 === 0 ? 1 : -1;
      const headY = sideways ? -2.4 * side : -0.4;
      ctx.fillStyle = skin; // arms
      ctx.beginPath();
      ctx.ellipse(-7, sideways ? 0.4 - 0.6 * side : 0.4, 1.8, 3.2, sideways ? 0.5 * side : 0, 0, Math.PI * 2);
      ctx.ellipse(7, sideways ? 0.4 + 0.6 * side : 0.4, 1.8, 3.2, sideways ? -0.5 * side : 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shirt; // shoulders
      ctx.beginPath();
      ctx.ellipse(0, 0.6, 6.2, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin; // head
      ctx.beginPath();
      ctx.arc(0, headY, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(0, headY, 3.15, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      ctx.restore();
    };
    const board = (x: number, y: number, rx: number, ry: number, fill = '#fdfdfd') => {
      ctx.fillStyle = 'rgba(0,50,80,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + 0.8, y + 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x, y - ry * 0.85);
      ctx.lineTo(x, y + ry * 0.85);
      ctx.stroke();
    };
    switch (kind) {
      case 'surfer':
        board(cx, h * 0.5, 5.6, 15.5);
        rider(cx, cy, 0.62, color);
        break;
      case 'skimmer':
        board(cx, cy, 7.5, 9.2, '#f3cf94');
        rider(cx, cy, 0.55, color);
        break;
      case 'windsurfer': {
        board(cx, cy, 4.6, 15);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 13);
        ctx.quadraticCurveTo(w - 1, cy, cx, cy + 13);
        ctx.quadraticCurveTo(cx + 12, cy, cx, cy - 13);
        ctx.fill();
        rider(cx - 1, cy + 2, 0.5, '#2a3a4a');
        break;
      }
      case 'kiter': {
        board(cx, cy, 3.8, 10);
        ctx.strokeStyle = 'rgba(30,40,50,0.55)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx, 12);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(2, 14);
        ctx.quadraticCurveTo(cx, -3, w - 2, 14);
        ctx.quadraticCurveTo(cx, 8, 2, 14);
        ctx.fill();
        rider(cx, cy, 0.5, '#2a3a4a');
        break;
      }
      case 'foiler': {
        board(cx, cy + 1, 4, 11);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 15, 15, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 15);
        ctx.lineTo(cx + 12, cy - 15);
        ctx.stroke();
        rider(cx, cy + 1, 0.5, '#2a3a4a');
        break;
      }
      case 'sailor': {
        ctx.fillStyle = 'rgba(0,50,80,0.18)';
        ctx.beginPath();
        ctx.ellipse(cx + 1, cy + 1, 8.5, 19.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fdfdfd';
        ctx.beginPath();
        ctx.moveTo(cx, 1);
        ctx.quadraticCurveTo(cx + 10, cy - 4, cx + 7, h - 2);
        ctx.lineTo(cx - 7, h - 2);
        ctx.quadraticCurveTo(cx - 10, cy - 4, cx, 1);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.quadraticCurveTo(cx + 11, cy + 2, cx + 3, cy + 16);
        ctx.lineTo(cx, cy + 16);
        ctx.closePath();
        ctx.fill();
        rider(cx - 4, cy + 12, 0.36, '#2a3a4a', false);
        break;
      }
      case 'walker':
        rider(cx, cy, 0.85, color, false);
        break;
    }
  });
  return key;
}

// ---------------------------------------------------------------- beach buildings (upright, 110 x 100 world px)

export const BUILDING_SIZE = { w: 110, h: 100 };

function awning(ctx: Ctx, x: number, y: number, w: number, c1: string, c2: string, n = 6) {
  const sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? c2 : c1;
    ctx.beginPath();
    ctx.moveTo(x + i * sw, y);
    ctx.lineTo(x + (i + 1) * sw, y);
    ctx.lineTo(x + (i + 1) * sw + 1.5, y + 10);
    ctx.arc(x + (i + 0.5) * sw + 0.75, y + 10, sw / 2, 0, Math.PI);
    ctx.lineTo(x + i * sw - 1.5, y + 10);
    ctx.closePath();
    ctx.fill();
  }
}

export function bakeBuildings(scene: Phaser.Scene) {
  const S = BUILDING_SIZE;
  const shadow = (ctx: Ctx) => {
    ctx.fillStyle = 'rgba(80,50,10,0.22)';
    ctx.beginPath();
    ctx.ellipse(S.w / 2 + 8, S.h - 6, 46, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  bake(scene, 'b-shop', S.w, S.h, 3, (ctx) => {
    shadow(ctx);
    ctx.fillStyle = '#d9a86a';
    ctx.fillRect(18, 38, 74, 54);
    ctx.fillStyle = '#b98543';
    ctx.fillRect(18, 38, 74, 5);
    ctx.fillStyle = '#5a3a1c'; // counter opening
    ctx.fillRect(28, 54, 54, 26);
    ctx.fillStyle = '#efe0c0';
    ctx.fillRect(24, 76, 62, 8);
    awning(ctx, 12, 30, 86, '#e8483d', '#ffffff');
    // rental boards leaning on the wall
    const boards = ['#3fc3ff', '#ffd23f', '#ff5fa2'];
    boards.forEach((c, i) => {
      ctx.save();
      ctx.translate(100 + i * 0, 54 + i * 2);
      ctx.rotate(0.12 - i * 0.06);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(-6 - i * 5, 30, 4.4, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RENT', 55, 25);
  });
  bake(scene, 'b-cafe', S.w, S.h, 3, (ctx) => {
    shadow(ctx);
    ctx.fillStyle = '#f7ead0';
    ctx.fillRect(16, 38, 66, 54);
    ctx.fillStyle = '#e2cfa6';
    ctx.fillRect(16, 38, 66, 5);
    ctx.fillStyle = '#7ec8e3';
    ctx.fillRect(26, 50, 20, 22);
    ctx.fillRect(52, 50, 20, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(28, 52, 6, 18);
    awning(ctx, 10, 30, 78, '#2f8fd6', '#ffffff');
    // sign with a cup
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(30, 8, 30, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(38, 12, 10, 9);
    ctx.fillStyle = '#fff';
    ctx.fillRect(38, 12, 10, 2.5);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(50, 16.5, 3, -1.4, 1.4);
    ctx.stroke();
    // table with parasol
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(96, 60, 2, 30);
    ctx.fillStyle = '#ff7a45';
    ctx.beginPath();
    ctx.moveTo(84, 62);
    ctx.quadraticCurveTo(97, 40, 110, 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(92, 55);
    ctx.quadraticCurveTo(97, 46, 102, 55);
    ctx.closePath();
    ctx.fill();
  });
  bake(scene, 'b-showers', S.w, S.h, 3, (ctx) => {
    shadow(ctx);
    for (let i = 0; i < 3; i++) {
      const x = 14 + i * 27;
      ctx.fillStyle = '#c4915a';
      ctx.fillRect(x, 40, 24, 52);
      ctx.fillStyle = '#a3763f';
      for (let k = 0; k < 5; k++) ctx.fillRect(x + 4 + k * 4, 44, 1.2, 44);
      ctx.fillStyle = '#7a542a';
      ctx.fillRect(x - 1, 36, 26, 5);
      // shower head
      ctx.strokeStyle = '#8b95a1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 12, 36);
      ctx.lineTo(x + 12, 22);
      ctx.lineTo(x + 20, 22);
      ctx.stroke();
      ctx.fillStyle = '#8b95a1';
      ctx.fillRect(x + 17, 21, 7, 3);
      ctx.fillStyle = 'rgba(120,200,255,0.85)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x + 18 + k * 2.5, 26 + k * 2, 1, 5);
    }
    ctx.fillStyle = '#3fa7e0';
    ctx.beginPath();
    ctx.arc(88, 62, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  bake(scene, 'b-lifeguard', S.w, S.h, 3, (ctx) => {
    shadow(ctx);
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 90);
    ctx.lineTo(38, 52);
    ctx.moveTo(80, 90);
    ctx.lineTo(72, 52);
    ctx.moveTo(34, 76);
    ctx.lineTo(76, 66);
    ctx.stroke();
    // ladder
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 90);
    ctx.lineTo(74, 56);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(83 - k * 2.6, 86 - k * 8.4);
      ctx.lineTo(77 - k * 2.6 - 2, 86 - k * 8.4);
      ctx.stroke();
    }
    // cabin
    ctx.fillStyle = '#ff5a45';
    ctx.fillRect(28, 28, 52, 26);
    ctx.fillStyle = '#fff';
    ctx.fillRect(28, 38, 52, 6);
    ctx.fillStyle = '#7ec8e3';
    ctx.fillRect(34, 31, 14, 6);
    ctx.fillRect(58, 31, 14, 6);
    // roof
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(22, 28);
    ctx.lineTo(54, 12);
    ctx.lineTo(86, 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5a45';
    ctx.beginPath();
    ctx.moveTo(38, 20);
    ctx.lineTo(54, 12);
    ctx.lineTo(70, 20);
    ctx.lineTo(70, 28);
    ctx.lineTo(38, 28);
    ctx.closePath();
    ctx.fill();
    // flag
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(54, 12);
    ctx.lineTo(54, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(54, 0, 10, 6);
  });
}

/** The skimboarding cove: clear shallows, a wet sand bank for flatland. 340 x 320 world px. */
export const COVE_SIZE = { w: 340, h: 320 };
export function bakeCove(scene: Phaser.Scene) {
  bake(scene, 'lm-cove', COVE_SIZE.w, COVE_SIZE.h, 2, (ctx, w, h) => {
    const r = rng(55);
    // clear shallow water wash
    const g = ctx.createRadialGradient(120, 150, 20, 150, 150, 200);
    g.addColorStop(0, 'rgba(210,255,246,0.85)');
    g.addColorStop(0.6, 'rgba(160,245,232,0.5)');
    g.addColorStop(1, 'rgba(160,245,232,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // wet sand bank where the flatland riders skim
    const sg = ctx.createLinearGradient(180, 40, 340, 190);
    sg.addColorStop(0, 'rgba(232,206,150,0.95)');
    sg.addColorStop(1, 'rgba(214,186,128,0.85)');
    ctx.fillStyle = sg;
    blob(ctx, 258, 108, 88, 56, rng(9), 0.07, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // sheen and thin water film on the bank
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    blob(ctx, 250, 104, 62, 34, rng(2), 0.1, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,0.25)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const y = 78 + i * 10;
      ctx.beginPath();
      ctx.moveTo(190 + r() * 10, y);
      ctx.bezierCurveTo(230, y - 4, 280, y + 4, 330 - r() * 10, y);
      ctx.stroke();
    }
    // ripples in the shallows
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 5; i++) {
      const x = 20 + r() * 150,
        y = 30 + r() * 140;
      ctx.beginPath();
      ctx.arc(x, y, 3 + r() * 5, 0, Math.PI * 1.5);
      ctx.stroke();
    }
    void h;
  });
}

// ---------------------------------------------------------------- beach sites

/** Wide kite launch area on the sand: marked field with laid-out kites and cones. 300 x 95 world px. */
export const KITE_LAUNCH_SIZE = { w: 300, h: 95 };
export function bakeKiteLaunch(scene: Phaser.Scene) {
  bake(scene, 'site-kite-launch', KITE_LAUNCH_SIZE.w, KITE_LAUNCH_SIZE.h, 2.5, (ctx, w, h) => {
    // smoothed sand field
    ctx.fillStyle = 'rgba(255,244,205,0.75)';
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, h - 4, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,150,85,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(10, 12 + i * 8.5);
      ctx.lineTo(w - 10, 12 + i * 8.5);
      ctx.stroke();
    }
    // boundary rope and cones
    ctx.strokeStyle = '#e8483d';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 12);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8], [w / 2, 6], [w / 2, h - 6]]) {
      ctx.fillStyle = '#ff7a2f';
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // kites laid out flat, waiting to be launched
    const cols = ['#ff5c8a', '#ffd23f', '#29b6f6', '#66bb6a', '#ff7043', '#ab47bc', '#26c6da'];
    cols.forEach((c, i) => {
      const cx = 30 + i * 40;
      const cy = 30 + (i % 2) * 28;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.15 + (i % 3) * 0.12);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(1.5, 2, 17, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-17, 4);
      ctx.quadraticCurveTo(0, -12, 17, 4);
      ctx.quadraticCurveTo(0, -2, -17, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-2, -5, 4, 3);
      ctx.strokeStyle = 'rgba(40,40,40,0.5)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-8, 1);
      ctx.lineTo(-2, 14);
      ctx.moveTo(8, 1);
      ctx.lineTo(2, 14);
      ctx.stroke();
      ctx.restore();
    });
  });
  bake(scene, 'site-windsock', 26, 60, 4, (ctx) => {
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 58);
    ctx.lineTo(6, 6);
    ctx.stroke();
    const seg = ['#ff7a2f', '#ffffff', '#ff7a2f', '#ffffff'];
    seg.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(6 + i * 4.6, 5 + i * 0.6);
      ctx.lineTo(6 + (i + 1) * 4.6, 6 + (i + 1) * 0.9);
      ctx.lineTo(6 + (i + 1) * 4.6, 12 - (i + 1) * 0.9);
      ctx.lineTo(6 + i * 4.6, 14 - i * 0.6);
      ctx.closePath();
      ctx.fill();
    });
  });
}

/** Wooden jetty reaching out from the beach. 65 x 250 world px, drawn flat. */
export const JETTY_SIZE = { w: 65, h: 250 };
export function bakeJetty(scene: Phaser.Scene) {
  bake(scene, 'site-jetty', JETTY_SIZE.w, JETTY_SIZE.h, 3, (ctx, w, h) => {
    // shadow on the water
    ctx.fillStyle = 'rgba(0,40,70,0.25)';
    ctx.fillRect(6, 8, w - 8, h - 4);
    // deck
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#b98a52');
    g.addColorStop(0.5, '#d2a566');
    g.addColorStop(1, '#a87b44');
    ctx.fillStyle = g;
    ctx.fillRect(14, 0, 34, h - 20);
    // T platform at the end
    ctx.fillRect(2, h - 44, w - 6, 26);
    ctx.strokeStyle = 'rgba(70,40,10,0.5)';
    ctx.lineWidth = 1;
    for (let y = 4; y < h - 20; y += 7) {
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(48, y);
      ctx.stroke();
    }
    for (let x = 4; x < w - 4; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, h - 44);
      ctx.lineTo(x, h - 18);
      ctx.stroke();
    }
    // posts
    ctx.fillStyle = '#5a3a1c';
    for (let y = 10; y < h - 20; y += 44) {
      ctx.beginPath();
      ctx.arc(14, y, 3.2, 0, Math.PI * 2);
      ctx.arc(48, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const x of [4, w - 8]) {
      ctx.beginPath();
      ctx.arc(x, h - 44, 3.4, 0, Math.PI * 2);
      ctx.arc(x, h - 18, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // rope between posts
    ctx.strokeStyle = '#efe3c6';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(14, h - 50);
    ctx.moveTo(48, 10);
    ctx.lineTo(48, h - 50);
    ctx.stroke();
  });
}

/** Small boats and marks for the Ocean area (upright billboards). */
export function bakeBoats(scene: Phaser.Scene) {
  bake(scene, 'boat-dinghy', 46, 56, 3, (ctx) => {
    ctx.fillStyle = 'rgba(0,40,70,0.25)';
    ctx.beginPath();
    ctx.ellipse(24, 51, 19, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fdfdfd';
    ctx.beginPath();
    ctx.moveTo(4, 44);
    ctx.quadraticCurveTo(23, 56, 42, 44);
    ctx.lineTo(38, 49);
    ctx.quadraticCurveTo(23, 54, 8, 49);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8483d';
    ctx.fillRect(6, 44, 34, 2.4);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(22, 46);
    ctx.lineTo(22, 4);
    ctx.stroke();
    ctx.fillStyle = '#f7f7f7';
    ctx.beginPath();
    ctx.moveTo(23.5, 6);
    ctx.quadraticCurveTo(38, 24, 38, 43);
    ctx.lineTo(23.5, 43);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8483d';
    ctx.beginPath();
    ctx.moveTo(20.5, 12);
    ctx.lineTo(20.5, 42);
    ctx.lineTo(8, 42);
    ctx.closePath();
    ctx.fill();
  });
  bake(scene, 'boat-yacht', 90, 84, 3, (ctx) => {
    ctx.fillStyle = 'rgba(0,40,70,0.3)';
    ctx.beginPath();
    ctx.ellipse(46, 78, 38, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // hull
    ctx.fillStyle = '#16204a';
    ctx.beginPath();
    ctx.moveTo(6, 62);
    ctx.lineTo(84, 62);
    ctx.quadraticCurveTo(78, 76, 60, 78);
    ctx.lineTo(24, 78);
    ctx.quadraticCurveTo(10, 74, 6, 62);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(7, 62, 76, 3);
    // mast and sails
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(44, 63);
    ctx.lineTo(44, 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(46, 4);
    ctx.quadraticCurveTo(70, 34, 74, 60);
    ctx.lineTo(46, 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.moveTo(42, 14);
    ctx.lineTo(42, 60);
    ctx.lineTo(12, 60);
    ctx.quadraticCurveTo(18, 34, 42, 14);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('OCEAN', 52, 44);
  });
  bake(scene, 'buoy', 16, 22, 4, (ctx) => {
    ctx.fillStyle = 'rgba(0,40,70,0.3)';
    ctx.beginPath();
    ctx.ellipse(8, 19, 6.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6a2a';
    ctx.beginPath();
    ctx.moveTo(3, 18);
    ctx.lineTo(13, 18);
    ctx.lineTo(10.5, 6);
    ctx.lineTo(5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(4.4, 11, 7.2, 2.4);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(8, 5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---------------------------------------------------------------- beach decoration (upright billboards)

export function bakeDecor(scene: Phaser.Scene) {
  // palm tree 80 x 130
  bake(scene, 'deco-palm', 80, 130, 3, (ctx) => {
    ctx.fillStyle = 'rgba(80,50,10,0.22)';
    ctx.beginPath();
    ctx.ellipse(46, 124, 24, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // trunk
    const tg = ctx.createLinearGradient(30, 0, 50, 0);
    tg.addColorStop(0, '#a4703a');
    tg.addColorStop(1, '#7a4f25');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(36, 124);
    ctx.quadraticCurveTo(44, 80, 38, 40);
    ctx.lineTo(45, 40);
    ctx.quadraticCurveTo(52, 80, 46, 124);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,10,0.35)';
    ctx.lineWidth = 1;
    for (let y = 50; y < 120; y += 9) {
      ctx.beginPath();
      ctx.moveTo(38 + (y - 50) * 0.02, y);
      ctx.lineTo(48, y + 2);
      ctx.stroke();
    }
    // fronds
    const fronds = [-2.6, -2.0, -1.3, -0.5, 0.2, 0.9, 1.6, 2.3];
    fronds.forEach((a, i) => {
      ctx.save();
      ctx.translate(42, 40);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, 0, -34);
      g.addColorStop(0, '#2f8f3f');
      g.addColorStop(1, i % 2 ? '#6cc04a' : '#4aa83e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-9, -22, 0, -38);
      ctx.quadraticCurveTo(9, -22, 0, 0);
      ctx.fill();
      ctx.restore();
    });
    ctx.fillStyle = '#6b4423';
    ctx.beginPath();
    ctx.arc(40, 44, 3, 0, Math.PI * 2);
    ctx.arc(46, 45, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // beach umbrella 60 x 70 (colour variants)
  const umb = [['a', '#ff5a45'], ['b', '#2f8fd6'], ['c', '#ffcf3f']] as const;
  for (const [k, c] of umb) {
    bake(scene, 'deco-umbrella-' + k, 60, 70, 3, (ctx) => {
      ctx.fillStyle = 'rgba(80,50,10,0.2)';
      ctx.beginPath();
      ctx.ellipse(34, 66, 22, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, 66);
      ctx.lineTo(30, 18);
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(4, 30);
      ctx.quadraticCurveTo(30, -8, 56, 30);
      ctx.quadraticCurveTo(30, 24, 4, 30);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(18, 27);
      ctx.quadraticCurveTo(30, 0, 42, 27);
      ctx.quadraticCurveTo(30, 22, 18, 27);
      ctx.fill();
    });
  }
  // round tree 70 x 90 and bush 50 x 40
  bake(scene, 'deco-tree', 70, 90, 3, (ctx) => {
    ctx.fillStyle = 'rgba(30,60,10,0.25)';
    ctx.beginPath();
    ctx.ellipse(36, 84, 24, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4f25';
    ctx.fillRect(32, 50, 7, 34);
    for (const [x, y, r, c] of [[24, 38, 20, '#3f9a3a'], [46, 36, 22, '#4aa83e'], [35, 22, 22, '#5cbb47'], [36, 40, 18, '#3a8f38']] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(30, 16, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  bake(scene, 'deco-bush', 50, 40, 3, (ctx) => {
    ctx.fillStyle = 'rgba(30,60,10,0.25)';
    ctx.beginPath();
    ctx.ellipse(26, 36, 20, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, r, c] of [[16, 24, 12, '#3f9a3a'], [32, 22, 13, '#4aa83e'], [24, 16, 12, '#5cbb47']] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // towel, flat 46 x 26
  const towels = [['a', '#ff6b8b', '#ffffff'], ['b', '#4fc3f7', '#ffee58'], ['c', '#81c784', '#ffffff']] as const;
  for (const [k, c1, c2] of towels) {
    bake(scene, 'deco-towel-' + k, 46, 26, 3, (ctx) => {
      ctx.fillStyle = 'rgba(80,50,10,0.15)';
      ctx.fillRect(3, 3, 42, 22);
      ctx.fillStyle = c1;
      ctx.fillRect(1, 1, 42, 22);
      ctx.fillStyle = c2;
      for (let x = 6; x < 42; x += 12) ctx.fillRect(x, 1, 5, 22);
    });
  }
  // shell / starfish, flat 14 x 14
  bake(scene, 'deco-star', 14, 14, 4, (ctx) => {
    ctx.fillStyle = '#ff8a65';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 2.6 : 6;
      ctx.lineTo(7 + Math.cos(a) * r, 7 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  // wake behind a rider (vertical, the rider is at the top)
  bake(scene, 'fx-wake', 14, 34, 3, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 34);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(14, 34);
    ctx.lineTo(0, 34);
    ctx.closePath();
    ctx.fill();
  });
  // big soft swell bands for the open sea, 400 x 300
  bake(scene, 'tile-swell', 400, 300, 1, (ctx, w, h) => {
    for (let k = 0; k < 3; k++) {
      const y = 40 + k * 100;
      const g = ctx.createLinearGradient(0, y - 30, 0, y + 30);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, y - 30);
      for (let x = 0; x <= w; x += 10) ctx.lineTo(x, y - 30 + Math.sin(((x + k * 90) / w) * Math.PI * 2) * 12);
      for (let x = w; x >= 0; x -= 10) ctx.lineTo(x, y + 30 + Math.sin(((x + k * 90) / w) * Math.PI * 2) * 12);
      ctx.closePath();
      ctx.fill();
    }
    void h;
  });
}
