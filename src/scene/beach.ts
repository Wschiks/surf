import Phaser from 'phaser';
import { FACILITIES, type FacilityDef } from '../config/facilities';
import { facilityOpen } from '../core/economy';
import { UNIT } from '../config/layout';
import type { GameState } from '../core/state';
import { BUILDING_SIZE, bakeBuildings, GUEST_LOOK, guestTexture, placeUpright } from './art';
import { DEPTH } from './background';

const KEY: Record<string, string> = { shop: 'b-shop', cafe: 'b-cafe', hotel: 'b-hotel', showers: 'b-showers', lifeguard: 'b-lifeguard' };

/** Beach facilities: an empty plot until bought, then the building stands on the sand. */
export class BeachView {
  private plots = new Map<string, Phaser.GameObjects.Graphics>();
  private buildings = new Map<string, Phaser.GameObjects.Image>();
  private walkers: Phaser.GameObjects.Image[] = [];
  /** Called when a new building goes up (not when the map is first drawn), so the camera can go and look. */
  onBuilt?: (f: FacilityDef) => void;

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
      if (!this.plots.get(f.id)?.visible && !this.buildings.has(f.id)) continue;
      if (Math.hypot(wx - f.at.x * UNIT, wy - (f.at.y * UNIT + 20)) < 60) return f.id;
    }
    return null;
  }

  update(state: GameState, animate = true) {
    for (const f of FACILITIES) {
      const lvl = state.facilities[f.id] ?? 0;
      // a house of a later stage has no plot until that stage
      if (!this.buildings.has(f.id)) this.plots.get(f.id)?.setVisible(facilityOpen(state, f));
      if (lvl > 0 && !this.buildings.has(f.id)) {
        const img = placeUpright(this.scene, KEY[f.id], f.at.x * UNIT, f.at.y * UNIT + 50).setDepth(DEPTH.things);
        img.setOrigin(0.5, 0.92).setDisplaySize(BUILDING_SIZE.w * 0.9, BUILDING_SIZE.h * 0.9);
        if (animate) {
          // the camera flies over first, then the building pops up with a bounce and a squash, and sparkles
          const { scaleX, scaleY } = img;
          img.setScale(0.001, 0.001);
          this.onBuilt?.(f);
          const x = f.at.x * UNIT;
          const y = f.at.y * UNIT + 50;
          this.scene.tweens.chain({
            targets: img,
            tweens: [
              { scaleX, scaleY, duration: 520, delay: 450, ease: 'Back.easeOut', onStart: () => this.celebrate(x, y) },
              { scaleX: scaleX * 1.12, scaleY: scaleY * 0.86, duration: 110, ease: 'Sine.easeOut', yoyo: true },
            ],
          });
        }
        this.buildings.set(f.id, img);
        this.plots.get(f.id)?.setVisible(false);
      }
    }
  }

  /** A ring of light, a puff of sand and a burst of sparkles where a building goes up. Fixed pattern, nothing random. */
  private celebrate(x: number, y: number) {
    const sc = this.scene;
    const depth = DEPTH.things + 1;
    const ring = sc.add.graphics().setDepth(DEPTH.things - 0.8).setPosition(x, y - 10);
    ring.lineStyle(5, 0xffffff, 1).strokeCircle(0, 0, 30);
    ring.setScale(0.3);
    sc.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 750, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const puff = sc.add.graphics().setDepth(DEPTH.things - 0.7).setPosition(x, y - 6);
      puff.fillStyle(0xf3dfae, 0.9).fillCircle(0, 0, 9);
      sc.tweens.add({ targets: puff, x: x + Math.cos(a) * 62, y: y - 6 + Math.sin(a) * 34, scale: 1.8, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    }
    const colors = [0xffd23f, 0xffffff, 0xff7ab8, 0x3fd0e8];
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996;
      const d = 60 + (i % 5) * 16;
      const star = sc.add.graphics().setDepth(depth).setPosition(x, y - 40);
      const r = 5 + (i % 3) * 2;
      star.fillStyle(colors[i % colors.length], 1).fillPoints([new Phaser.Math.Vector2(0, -r), new Phaser.Math.Vector2(r * 0.35, 0), new Phaser.Math.Vector2(0, r), new Phaser.Math.Vector2(-r * 0.35, 0)], true);
      sc.tweens.add({ targets: star, x: x + Math.cos(a) * d, y: y - 40 + Math.sin(a) * d, angle: 180, alpha: 0, duration: 900, delay: (i % 4) * 30, ease: 'Cubic.easeOut', onComplete: () => star.destroy() });
    }
  }

  /** Take all buildings away again (the beach started over). */
  reset() {
    for (const img of this.buildings.values()) img.destroy();
    this.buildings.clear();
    for (const g of this.plots.values()) g.setVisible(true); // update() hides the plots of later stages again
  }

  /** People strolling along the water line. More of them come as the beach grows. */
  animateWalkers(state: GameState, time: number) {
    const want = Math.min(WALKER_COLORS.length, 3 + Math.floor(Math.log10(state.totalCoins + 1) / 1.5));
    while (this.walkers.length < want) {
      const i = this.walkers.length;
      const key = guestTexture(this.scene, 'walker', WALKER_COLORS[i], i);
      const img = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.5).setDepth(DEPTH.things);
      img.setDisplaySize(GUEST_LOOK.walker.w, GUEST_LOOK.walker.h);
      this.walkers.push(img);
    }
    this.walkers.forEach((w, i) => {
      const speed = 0.006 + (i % 4) * 0.0018;
      const t = (time / 1000) * speed + i * 0.37;
      const phase = ((t % 2) + 2) % 2; // 0..2
      const ping = phase < 1 ? phase : 2 - phase; // 0..1..0
      const x = 0.4 * UNIT + ping * 14.2 * UNIT;
      const y = (1.38 + 0.05 * (i % 3)) * UNIT + Math.sin(time / 300 + i) * 1.2;
      w.setPosition(x, y).setRotation(phase >= 1 ? -Math.PI / 2 : Math.PI / 2);
    });
  }
}

const WALKER_COLORS = ['#ff6b3d', '#3fc3ff', '#ffd23f', '#ff5fa2', '#4be07a', '#b56bff', '#ff9f43', '#2ec4b6', '#f15bb5', '#9bc53d', '#00bbf9', '#fee440'];
