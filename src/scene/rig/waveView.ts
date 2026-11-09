import Phaser from 'phaser';
import { DEPTH } from '../background';
import { hash01 } from './geom';
import type { Zone } from './sim';

// The breaking waves of the Reef and Nazaré, seen from above: the face (a darker band on the beach side of the crest),
// the white water behind the peel point, and the curling lip over the barrel. The lip is drawn above the surfers, so a
// surfer inside the barrel disappears under it.

export class WaveView {
  private below: Phaser.GameObjects.Graphics;
  private above: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private z: Zone,
  ) {
    this.below = scene.add.graphics().setDepth(DEPTH.things - 0.28);
    this.above = scene.add.graphics().setDepth(DEPTH.things + 0.25);
  }

  draw(near: boolean, t: number) {
    const b = this.below;
    const a = this.above;
    b.clear();
    a.clear();
    b.setVisible(near);
    a.setVisible(near);
    if (!near) return;
    const z = this.z;
    const x0 = z.x + 3;
    const x1 = z.x + z.w - 3;
    for (const w of z.waves ?? []) {
      const F = w.face;
      const fade = Math.min(1, w.life) * Math.min(1, w.age / 0.8);
      const broke = w.age >= w.start;
      // the unbroken face: from the peel point to the end of the zone (the whole wave before it breaks)
      const sx0 = broke ? (w.dir > 0 ? w.px : x0) : x0;
      const sx1 = broke ? (w.dir > 0 ? x1 : w.px) : x1;
      if (sx1 > sx0) {
        const steep = broke ? 1 : Math.min(1, w.age / w.start);
        b.fillGradientStyle(0x0a4f7a, 0x0a4f7a, 0x0c6a96, 0x0c6a96, 0.08 * fade, 0.08 * fade, (0.22 + 0.25 * steep) * fade, (0.22 + 0.25 * steep) * fade);
        b.fillRect(sx0, w.y - F, sx1 - sx0, F);
        b.lineStyle(F > 25 ? 2.4 : 1.6, 0xffffff, (0.35 + 0.35 * steep) * fade);
        b.lineBetween(sx0, w.y, sx1, w.y);
      }
      if (!broke) continue;
      const curl = F * 1.5;
      const cx = w.px - w.dir * curl;
      // white water behind the curl: thick near the curl, thinning and fading further back, with a bubbly edge
      const back = -w.dir;
      const len = w.dir > 0 ? cx - x0 : x1 - cx;
      // stacked soft layers from the curl backward: each one a bit shorter, so the foam fades out smoothly
      const bands = 7;
      for (let k = 0; k < bands; k++) {
        const u1 = len * (0.35 + (0.65 * (k + 1)) / bands);
        const f = 1 - k / bands;
        const pts: Phaser.Math.Vector2[] = [];
        const steps = 14;
        for (let j = 0; j <= steps; j++) {
          const xx = cx + back * ((u1 * j) / steps);
          const taper = 1 - (j / steps) * 0.55;
          pts.push(new Phaser.Math.Vector2(xx, w.y - F * (0.45 + 0.8 * f) * taper + Math.sin(xx * 0.15 + t * 2.4 + k) * F * 0.07));
        }
        for (let j = steps; j >= 0; j--) {
          const xx = cx + back * ((u1 * j) / steps);
          pts.push(new Phaser.Math.Vector2(xx, w.y + 3 + Math.sin(xx * 0.2 + t * 1.8) * 1.5));
        }
        b.fillStyle(0xffffff, 0.16 * fade);
        b.fillPoints(pts, true);
      }
      const blobs = Math.ceil(len / (F * 0.5));
      for (let k = 0; k < blobs; k++) {
        const r1 = hash01(w.n, k, 1);
        const r2 = hash01(w.n, k, 2);
        const u = ((k + r1) / blobs) * len;
        const f = 1 - u / len;
        const bx = cx + back * u;
        const wob = Math.sin(t * 2.2 + k * 1.7) * F * 0.08;
        b.fillStyle(0xffffff, (0.35 + 0.5 * r2) * f * fade);
        b.fillCircle(bx, w.y - F * (0.5 + 0.75 * f) + wob, F * (0.14 + 0.16 * r2) * (0.5 + 0.5 * f));
      }
      // inside the barrel: a dark tube under the lip (drawn below the surfer)
      const tube: Phaser.Math.Vector2[] = [];
      for (let j = 0; j <= 10; j++) {
        const u = j / 10;
        tube.push(new Phaser.Math.Vector2(cx + w.dir * u * curl, w.y - F * (0.15 + 0.7 * (1 - u * 0.6))));
      }
      for (let j = 10; j >= 0; j--) tube.push(new Phaser.Math.Vector2(cx + w.dir * (j / 10) * curl, w.y - F * 0.12));
      b.fillStyle(0x062a44, 0.42 * fade);
      b.fillPoints(tube, true);
      // the lip: a white curl over the face, thick where it crashes down, thin where it throws out at the peel point
      const lip: Phaser.Math.Vector2[] = [];
      const n = 14;
      for (let j = 0; j <= n; j++) {
        const u = j / n;
        const thick = F * (0.98 - 0.62 * Math.pow(u, 1.4));
        lip.push(new Phaser.Math.Vector2(cx + w.dir * u * curl, w.y - thick));
      }
      lip.push(new Phaser.Math.Vector2(w.px + w.dir * F * 0.18, w.y - F * 0.18));
      for (let j = n; j >= 0; j--) lip.push(new Phaser.Math.Vector2(cx + w.dir * (j / n) * curl, w.y + 1));
      a.fillStyle(0xffffff, 0.9 * fade);
      a.fillPoints(lip, true);
      // a soft foam line along the inside edge of the lip
      a.lineStyle(Math.max(1.2, F * 0.06), 0xd6eef6, 0.9 * fade);
      a.beginPath();
      for (let j = 0; j <= n; j++) {
        const u = j / n;
        const x = cx + w.dir * u * curl;
        const y = w.y - F * (0.98 - 0.62 * Math.pow(u, 1.4)) + F * 0.08;
        if (j === 0) a.moveTo(x, y);
        else a.lineTo(x, y);
      }
      a.strokePath();
    }
  }

  destroy() {
    this.below.destroy();
    this.above.destroy();
  }
}
