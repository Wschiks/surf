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
    for (let i = 0; i < 700; i++) {
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
    for (let i = 0; i < 46; i++) {
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
    for (let i = 0; i < 46; i++) {
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
