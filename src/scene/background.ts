import Phaser from 'phaser';
import { AREAS, areaById, rgbToHex, seaColorAt, type AreaId } from '../config/areas';
import { MAP_UNITS, UNIT, WORLD_MARGIN } from '../config/layout';
import { BEACH_DECOR, LAND_DECOR, LANDMARKS, type DecorDef } from '../config/landmarks';
import { bakeCloudTile, bakeCove, bakeDecor, bakeFort, bakeLighthouse, bakeReef, bakeRocks, bakeSandTile, bakeShoreFoam, bakeSparkleTile, placeImage, placeTile, placeUpright } from './art';

const M = WORLD_MARGIN * UNIT;
const MAP = MAP_UNITS * UNIT;

export const DEPTH = { base: 0, sparkle: 1, grid: 2, landmark: 5, zone: 6, things: 8, haze: 40 };

/** Sea, sand, grid, landmarks. Everything past the map edges is drawn too so no empty corner ever shows. */
export function buildBackground(scene: Phaser.Scene) {
  bakeSandTile(scene);
  bakeSparkleTile(scene);
  bakeCloudTile(scene);
  bakeShoreFoam(scene);
  bakeRocks(scene);
  bakeCove(scene);
  bakeReef(scene);
  bakeFort(scene);
  bakeDecor(scene);
  bakeLighthouse(scene);

  const g = scene.add.graphics().setDepth(DEPTH.base);
  const left = -M;
  const width = MAP + M * 2;

  // land behind the beach: dunes and grass
  g.fillStyle(0x8fcf6a, 1);
  g.fillRect(left, -M, width, M - 1.3 * UNIT);
  g.fillStyle(0xb7d97a, 1);
  g.fillRect(left, -1.3 * UNIT, width, 0.35 * UNIT);
  g.fillStyle(0xe6d59a, 1);
  g.fillRect(left, -0.95 * UNIT, width, 0.95 * UNIT);

  // sea: light blue near the shore, darker further out (thin strips)
  const step = 0.08;
  for (let d = 2; d < 14; d += step) {
    g.fillStyle(rgbToHex(seaColorAt(d + step / 2)), 1);
    g.fillRect(left, d * UNIT, width, step * UNIT + 1);
  }
  g.fillStyle(rgbToHex(seaColorAt(20)), 1);
  g.fillRect(left, 14 * UNIT, width, M);

  // sand of the beach (rows 1 and 2)
  placeTile(scene, 'tile-sand', left, 0, width, 2 * UNIT).setDepth(DEPTH.base + 0.1);
  // wet sand near the water line
  const wet = scene.add.graphics().setDepth(DEPTH.base + 0.2);
  for (let i = 0; i < 12; i++) {
    wet.fillStyle(0xb99a5e, 0.05);
    wet.fillRect(left, 1.5 * UNIT + i * 4, width, 0.5 * UNIT - i * 4);
  }
  // shallow turquoise glow at the shore
  for (let i = 0; i < 10; i++) {
    g.fillStyle(0xc8fff0, 0.09);
    g.fillRect(left, 2 * UNIT, width, (0.06 + i * 0.05) * UNIT);
  }

  // drifting sparkles on the water
  const sparkle = placeTile(scene, 'tile-sparkle', left, 2 * UNIT, width, 12 * UNIT + M).setDepth(DEPTH.sparkle);
  sparkle.setAlpha(0.3);
  // foam line where the sea meets the sand
  const foam = placeTile(scene, 'tile-shorefoam', left, 2 * UNIT - 10, width, 40).setDepth(DEPTH.sparkle + 0.1);

  // grid, map border and area borders
  const grid = scene.add.graphics().setDepth(DEPTH.grid);
  grid.lineStyle(1.5, 0xffffff, 0.07);
  for (let i = 1; i < MAP_UNITS; i++) {
    grid.lineBetween(i * UNIT, 0, i * UNIT, MAP);
    grid.lineBetween(0, i * UNIT, MAP, i * UNIT);
  }
  grid.lineStyle(2.5, 0xffffff, 0.4);
  for (const a of AREAS) grid.lineBetween(0, a.from * UNIT, MAP, a.from * UNIT);
  grid.lineStyle(5, 0xffffff, 0.55);
  grid.strokeRect(0, 0, MAP, MAP);

  // landmarks
  for (const lm of LANDMARKS) {
    const x = lm.at.x * UNIT;
    const y = lm.at.y * UNIT;
    const img = lm.upright ? placeUpright(scene, lm.texture, x, y) : placeImage(scene, lm.texture, x, y);
    if (lm.origin) img.setOrigin(lm.origin.x, lm.origin.y);
    if (lm.size) img.setDisplaySize(lm.size.w, lm.size.h);
    img.setDepth(DEPTH.landmark + (lm.layer ?? 0));
  }

  // big slow swells over the whole sea
  const swell = placeTile(scene, 'tile-swell', left, 2 * UNIT, width, 12 * UNIT + M, 1.5).setDepth(DEPTH.sparkle - 0.5);
  swell.setAlpha(0.35);

  addDecor(scene);
  return { sparkle, foam, swell };
}

function addDecor(scene: Phaser.Scene) {
  const put = (d: DecorDef) => {
    const img = d.upright ? placeUpright(scene, d.texture, d.x * UNIT, d.y * UNIT) : placeImage(scene, d.texture, d.x * UNIT, d.y * UNIT);
    img.setDisplaySize(d.w, d.h).setDepth(d.upright ? DEPTH.things - 0.5 : DEPTH.things - 1.5);
  };
  BEACH_DECOR.forEach(put);
  LAND_DECOR.forEach(put);
}

/** Light haze over an area the player has not unlocked. Clears with a fade when the area opens. */
export class Haze {
  private veil: Phaser.GameObjects.Graphics;
  private clouds: Phaser.GameObjects.TileSprite;
  private cleared = false;

  constructor(
    private scene: Phaser.Scene,
    readonly area: AreaId,
  ) {
    const a = areaById(area);
    const top = a.from * UNIT;
    const bottom = a.to >= 10 ? MAP + M : a.to * UNIT;
    const left = -M;
    const width = MAP + M * 2;
    this.veil = scene.add.graphics().setDepth(DEPTH.haze);
    this.veil.fillStyle(0xe4f4ff, 0.5);
    this.veil.fillRect(left, top, width, bottom - top);
    this.clouds = placeTile(scene, 'tile-cloud', left, top, width, bottom - top, 1.6).setDepth(DEPTH.haze + 0.1);
    this.clouds.setAlpha(0.7);
  }

  update(time: number) {
    if (this.cleared) return;
    this.clouds.tilePositionX = time * 0.012;
    this.clouds.tilePositionY = time * 0.004;
  }

  /** Clear the haze. `animate` false removes it at once (used when loading a save). */
  clear(animate = true) {
    if (this.cleared) return;
    this.cleared = true;
    if (!animate) {
      this.veil.destroy();
      this.clouds.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: [this.veil, this.clouds],
      alpha: 0,
      duration: 1800,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.veil.destroy();
        this.clouds.destroy();
      },
    });
  }

  get isCleared() {
    return this.cleared;
  }
}
