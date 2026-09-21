import type Phaser from 'phaser';
import type { Rect } from '../config/layout';

/** Stroke a dashed rectangle outline with the current line style. */
export function dashedRect(g: Phaser.GameObjects.Graphics, r: Rect, dash = 14, gap = dash) {
  const corners: [number, number][] = [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
    [r.x, r.y],
  ];
  for (let c = 0; c < 4; c++) {
    const [x1, y1] = corners[c];
    const [x2, y2] = corners[c + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += dash + gap) {
      const a = d / len;
      const b = Math.min(len, d + dash) / len;
      g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
    }
  }
}
