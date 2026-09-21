import Phaser from 'phaser';
import { UNIT, toWorld } from '../config/layout';
import { zoneId } from '../config/sports';
import type { GameState } from '../core/state';
import { bakeBoats, placeUpright } from './art';
import { DEPTH } from './background';

/**
 * Boats of the Ocean area: dinghies moored at the jetty (one per sailing level owned), race course buoys once
 * Club racing is open, and an ocean racer once the Offshore regatta is open. They bob gently.
 */
export class OceanView {
  private moored: Phaser.GameObjects.Image[] = [];
  private buoys: Phaser.GameObjects.Image[] = [];
  private yacht?: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    bakeBoats(scene);
  }

  update(state: GameState, time: number, animate = true) {
    const owned = [1, 2, 3, 4].filter((l) => state.zones[zoneId('sailing', l)]?.owned).length;
    // dinghies moored along the left side of the jetty
    while (this.moored.length < owned) {
      const i = this.moored.length;
      const img = placeUpright(this.scene, 'boat-dinghy', 9.16 * UNIT, (1.85 + i * 0.42) * UNIT).setDepth(DEPTH.things);
      img.setOrigin(0.5, 0.9).setDisplaySize(46 * 0.9, 56 * 0.9);
      if (animate) this.pop(img);
      this.moored.push(img);
    }
    // race course: a triangle of buoys inside the Club racing zone
    if (state.zones[zoneId('sailing', 3)]?.owned && this.buoys.length === 0) {
      const r = toWorld({ x: 0.15 + 2.45, y: 8.15, w: 2.35, h: 1.7 });
      const pts = [
        [0.12, 0.2],
        [0.5, 0.86],
        [0.88, 0.2],
        [0.5, 0.2],
      ];
      for (const [fx, fy] of pts) {
        const b = placeUpright(this.scene, 'buoy', r.x + r.w * fx, r.y + r.h * fy).setDepth(DEPTH.things);
        b.setOrigin(0.5, 0.85).setDisplaySize(16 * 1.1, 22 * 1.1);
        if (animate) this.pop(b);
        this.buoys.push(b);
      }
    }
    // the ocean racer of the offshore regatta
    if (state.zones[zoneId('sailing', 4)]?.owned && !this.yacht) {
      const r = toWorld({ x: 0.15, y: 8.15, w: 2.35, h: 1.7 });
      this.yacht = placeUpright(this.scene, 'boat-yacht', r.x + r.w * 0.5, r.y + r.h * 0.62).setDepth(DEPTH.things);
      this.yacht.setOrigin(0.5, 0.9).setDisplaySize(90 * 1.1, 84 * 1.1);
      if (animate) this.pop(this.yacht);
    }
    const bob = (img: Phaser.GameObjects.Image | undefined, i: number, baseY: number) => {
      if (img) img.y = baseY + Math.sin(time / 700 + i * 1.7) * 1.6;
    };
    this.moored.forEach((m, i) => bob(m, i, (1.85 + i * 0.42) * UNIT));
    if (this.yacht) {
      const r = toWorld({ x: 0.15, y: 8.15, w: 2.35, h: 1.7 });
      bob(this.yacht, 0, r.y + r.h * 0.62);
    }
  }

  private pop(img: Phaser.GameObjects.Image) {
    const { scaleX, scaleY } = img;
    img.setScale(scaleX * 0.2, scaleY * 0.2);
    this.scene.tweens.add({ targets: img, scaleX, scaleY, duration: 600, ease: 'Back.easeOut' });
  }
}
