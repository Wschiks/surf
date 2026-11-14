// Static shapes drawn once onto a canvas texture and shown as an Image. A Phaser Graphics object is turned into
// triangles again every frame (it was 70% of the frame time with 60-odd static Graphics on the map), so anything that
// does not change shape is baked here instead: zone plates, the lock shade, the cars, the background bands.

import Phaser from 'phaser';

/** A colour number and alpha as a CSS colour. */
export function css(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

/**
 * Draw onto a canvas texture `key` (w x h world units at `res` pixels per unit; the drawing works in world units with
 * 0,0 at the texture's top left) and return its key. Drawing again with the same key repaints the same texture.
 */
export function bakeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, res = 2): string {
  const pw = Math.max(1, Math.ceil(w * res));
  const ph = Math.max(1, Math.ceil(h * res));
  let tex = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : null;
  if (tex && (tex.width !== pw || tex.height !== ph)) {
    scene.textures.remove(key);
    tex = null;
  }
  if (!tex) tex = scene.textures.createCanvas(key, pw, ph)!;
  const c = tex.getContext();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, pw, ph);
  c.scale(pw / w, ph / h);
  draw(c);
  tex.refresh();
  return key;
}

/** A rounded rectangle path (world units). */
export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
