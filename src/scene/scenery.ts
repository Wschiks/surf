import Phaser from 'phaser';
import { UNIT } from '../config/layout';
import { bakeIsland, bakeShip, bakeTurbine, ISLAND_SIZE, placeImage, placeUpright } from './art';
import { DEPTH } from './background';
import { UPRIGHT } from './upright';

/**
 * Scenery just past the edges of the Sea and the Ocean, so these areas have something to look at too: three wind
 * turbines that turn, a sandbank island with palms, and a container ship that sails by. Everything moves on a fixed
 * clock (nothing is random). The haze covers it until the area is opened.
 */
export class Scenery {
  private blades: Phaser.GameObjects.Image[] = [];
  private ship: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    bakeTurbine(scene);
    bakeIsland(scene);
    bakeShip(scene);
    // Sea, right edge: wind turbines (base at the given point)
    [4.65, 5.3, 5.95].forEach((depth, i) => {
      const x = 15.7 + (i % 2) * 0.35;
      const tower = placeUpright(scene, 'sc-tower', x * UNIT, depth * UNIT).setDepth(DEPTH.things - 0.4);
      tower.setOrigin(0.58, 0.95).setDisplaySize(26, 120);
      const b = scene.add.image(x * UNIT, depth * UNIT, 'sc-blades').setDepth(DEPTH.things - 0.3).setDisplaySize(100, 100);
      b.setData('base', { x: x * UNIT, y: depth * UNIT });
      b.setData('phase', i * 1.3);
      this.blades.push(b);
    });
    // Sea, left edge: a sandbank island with two palms
    placeImage(scene, 'sc-island', -1.9 * UNIT, 4.6 * UNIT).setDepth(DEPTH.things - 0.6).setDisplaySize(ISLAND_SIZE.w, ISLAND_SIZE.h);
    for (const [dx, dy, s] of [[-1.05, 5.22, 0.85], [-0.78, 5.32, 1]] as const) {
      const palm = placeUpright(scene, 'deco-palm', dx * UNIT, dy * UNIT).setDepth(DEPTH.things - 0.5);
      palm.setDisplaySize(52 * s, 84 * s);
    }
    // Ocean: a container ship that sails out past the right edge
    this.ship = scene.add.image(0, 0, 'sc-ship').setDepth(DEPTH.things - 0.5).setDisplaySize(34, 140);
  }

  update(time: number) {
    // turbines: the blades turn slowly around the top of the tower (upright, so they counter-rotate with the map)
    for (const b of this.blades) {
      const base = b.getData('base') as { x: number; y: number };
      b.setPosition(base.x - Math.sin(UPRIGHT) * 106, base.y - Math.cos(UPRIGHT) * 106);
      b.setRotation(-UPRIGHT + time / 1600 + (b.getData('phase') as number));
    }
    // ship: 150 s per crossing along the depth axis, fading in and out at the ends
    const t = (time / 150000) % 1;
    const y = (6.6 + t * 2.2) * UNIT;
    this.ship.setPosition(17.3 * UNIT, y).setRotation(Math.PI);
    this.ship.setAlpha(Math.min(1, t * 8, (1 - t) * 8));
  }
}
