import Phaser from 'phaser';
import { toWorld } from '../config/layout';
import { ZONES, zoneId } from '../config/sports';

/** The rectangle of a sailing zone (1 to 4). */
const zoneRect = (level: number) => ZONES.find((z) => z.id === zoneId('sailing', level))!.def.rect;
import type { GameState } from '../core/state';
import { bakeBoats, placeUpright } from './art';
import { DEPTH } from './background';

/**
 * Boats of the Ocean area: race course buoys once Club racing is open. (The Offshore regatta sails real yachts, see
 * rig/sports/sail.ts.)
 */
export class OceanView {
  private buoys: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene) {
    bakeBoats(scene);
  }

  update(state: GameState, _time: number, animate = true) {
    // race course: a triangle of buoys inside the Club racing zone
    if (state.zones[zoneId('sailing', 3)]?.owned && this.buoys.length === 0) {
      const r = toWorld(zoneRect(3));
      const pts = [
        [0.12, 0.2],
        [0.5, 0.86],
        [0.88, 0.2],
        [0.5, 0.2],
      ];
      for (const [fx, fy] of pts) {
        // upright pictures stand above the boats on the water, so a dinghy sailing behind one goes out of sight
        const b = placeUpright(this.scene, 'buoy', r.x + r.w * fx, r.y + r.h * fy).setDepth(DEPTH.things + 0.3);
        b.setOrigin(0.5, 0.85).setDisplaySize(16 * 1.1, 22 * 1.1);
        if (animate) this.pop(b);
        this.buoys.push(b);
      }
    }
  }

  reset() {
    for (const o of this.buoys) o.destroy();
    this.buoys = [];
  }

  private pop(img: Phaser.GameObjects.Image) {
    const { scaleX, scaleY } = img;
    img.setScale(scaleX * 0.2, scaleY * 0.2);
    this.scene.tweens.add({ targets: img, scaleX, scaleY, duration: 600, ease: 'Back.easeOut' });
  }
}
