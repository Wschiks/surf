import Phaser from 'phaser';
import { FACILITIES } from '../config/facilities';
import { UNIT } from '../config/layout';
import type { GameState } from '../core/state';
import { BUILDING_SIZE, bakeBuildings, placeUpright } from './art';
import { DEPTH } from './background';

const KEY: Record<string, string> = { shop: 'b-shop', cafe: 'b-cafe', showers: 'b-showers', lifeguard: 'b-lifeguard' };

/** Beach facilities: an empty plot until bought, then the building stands on the sand. */
export class BeachView {
  private plots = new Map<string, Phaser.GameObjects.Graphics>();
  private buildings = new Map<string, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {
    bakeBuildings(scene);
    for (const f of FACILITIES) {
      const g = scene.add.graphics().setDepth(DEPTH.things - 1);
      const x = f.at.x * UNIT;
      const y = f.at.y * UNIT;
      g.lineStyle(2.5, 0xb98543, 0.7);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const b = ((i + 0.55) / 12) * Math.PI * 2;
        g.beginPath();
        g.arc(x, y + 20, 36, a, b);
        g.strokePath();
      }
      g.fillStyle(0xb98543, 0.16);
      g.fillCircle(x, y + 20, 36);
      this.plots.set(f.id, g);
    }
  }

  /** The facility whose plot is near a world point, if any. */
  hit(wx: number, wy: number): string | null {
    for (const f of FACILITIES) {
      if (Math.hypot(wx - f.at.x * UNIT, wy - (f.at.y * UNIT + 20)) < 60) return f.id;
    }
    return null;
  }

  update(state: GameState, animate = true) {
    for (const f of FACILITIES) {
      const lvl = state.facilities[f.id] ?? 0;
      if (lvl > 0 && !this.buildings.has(f.id)) {
        const img = placeUpright(this.scene, KEY[f.id], f.at.x * UNIT, f.at.y * UNIT + 50).setDepth(DEPTH.things);
        img.setOrigin(0.5, 0.92).setDisplaySize(BUILDING_SIZE.w * 0.9, BUILDING_SIZE.h * 0.9);
        if (animate) {
          const { scaleX, scaleY } = img;
          img.setScale(scaleX * 0.15, scaleY * 0.15);
          this.scene.tweens.add({ targets: img, scaleX, scaleY, duration: 500, ease: 'Back.easeOut' });
        }
        this.buildings.set(f.id, img);
        this.plots.get(f.id)?.setVisible(false);
      }
    }
  }
}
