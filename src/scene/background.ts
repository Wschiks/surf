import Phaser from 'phaser';
import { AREAS, areaById, rgbToHex, SHORE, seaColorAt } from '../config/areas';
import { MAP_H, MAP_W, UNIT, WORLD_MARGIN } from '../config/layout';
import { BEACH_DECOR, LAND_DECOR, LANDMARKS, type DecorDef } from '../config/landmarks';
import { bakeMistTile, bakeFogRamp, bakeCove, bakeDecor, bakeFort, bakeLighthouse, bakeReef, bakeRocks, bakeSandTile, bakeShoreFoam, bakeSparkleTile, placeImage, placeTile, placeUpright } from './art';

const M = WORLD_MARGIN * UNIT;
const MAP_PX_W = MAP_W * UNIT;
const MAP_PX_H = MAP_H * UNIT;
const SH = SHORE * UNIT;

export const DEPTH = { base: 0, sparkle: 1, grid: 2, landmark: 5, zone: 6, things: 8, haze: 40 };

/** Sea, sand, grid, landmarks. Everything past the map edges is drawn too so no empty corner ever shows. */
export function buildBackground(scene: Phaser.Scene) {
  bakeSandTile(scene);
  bakeSparkleTile(scene);
  bakeMistTile(scene, 'tile-mist-a', 31, 9, 0.42);
  bakeMistTile(scene, 'tile-mist-b', 77, 12, 0.3);
  bakeFogRamp(scene);
  bakeShoreFoam(scene);
  bakeRocks(scene);
  bakeCove(scene);
  bakeReef(scene);
  bakeFort(scene);
  bakeDecor(scene);
  bakeLighthouse(scene);

  const g = scene.add.graphics().setDepth(DEPTH.base);
  const left = -M;
  const width = MAP_PX_W + M * 2;

  // land behind the beach: dunes and grass
  g.fillStyle(0x8fcf6a, 1);
  g.fillRect(left, -M, width, M - 1.3 * UNIT);
  g.fillStyle(0xb7d97a, 1);
  g.fillRect(left, -1.3 * UNIT, width, 0.35 * UNIT);
  g.fillStyle(0xe6d59a, 1);
  g.fillRect(left, -0.95 * UNIT, width, 0.95 * UNIT);

  // sea: light blue near the shore, darker further out (thin strips)
  const step = 0.08;
  for (let d = SHORE; d < 11; d += step) {
    g.fillStyle(rgbToHex(seaColorAt(d + step / 2)), 1);
    g.fillRect(left, d * UNIT, width, step * UNIT + 1);
  }
  g.fillStyle(rgbToHex(seaColorAt(20)), 1);
  g.fillRect(left, 11 * UNIT, width, M);

  // sand of the beach (rows 1 and 2)
  placeTile(scene, 'tile-sand', left, 0, width, SH).setDepth(DEPTH.base + 0.1);
  // wet sand near the water line
  const wet = scene.add.graphics().setDepth(DEPTH.base + 0.2);
  for (let i = 0; i < 12; i++) {
    wet.fillStyle(0xb99a5e, 0.05);
    wet.fillRect(left, SH - 0.4 * UNIT + i * 4, width, 0.4 * UNIT - i * 4);
  }
  // shallow turquoise glow at the shore
  for (let i = 0; i < 10; i++) {
    g.fillStyle(0xc8fff0, 0.09);
    g.fillRect(left, SH, width, (0.06 + i * 0.05) * UNIT);
  }

  // drifting sparkles on the water
  const sparkle = placeTile(scene, 'tile-sparkle', left, SH, width, 10 * UNIT + M).setDepth(DEPTH.sparkle);
  sparkle.setAlpha(0.3);
  // foam line where the sea meets the sand
  const foam = placeTile(scene, 'tile-shorefoam', left, SH - 10, width, 40).setDepth(DEPTH.sparkle + 0.1);

  // grid, map border and area borders
  const grid = scene.add.graphics().setDepth(DEPTH.grid);
  grid.lineStyle(1.5, 0xffffff, 0.07);
  for (let i = 1; i < MAP_W; i++) grid.lineBetween(i * UNIT, 0, i * UNIT, MAP_PX_H);
  for (let i = 1; i < MAP_H; i++) grid.lineBetween(0, i * UNIT, MAP_PX_W, i * UNIT);
  grid.lineStyle(2.5, 0xffffff, 0.4);
  for (const a of AREAS) grid.lineBetween(0, a.from * UNIT, MAP_PX_W, a.from * UNIT);
  grid.lineStyle(5, 0xffffff, 0.55);
  grid.strokeRect(0, 0, MAP_PX_W, MAP_PX_H);

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
  const swell = placeTile(scene, 'tile-swell', left, SH, width, 10 * UNIT + M, 1.5).setDepth(DEPTH.sparkle - 0.5);
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

/**
 * One big mist over everything the player has not opened yet (the Sea and the Ocean together). The fog fades in
 * softly from its front edge and two layers of wide wisps drift across it. Every beach expansion pulls the front edge
 * back: the first uncovers the Sea, the second the Ocean, and the mist slides away.
 */
export class Mist {
  private parts: Phaser.GameObjects.GameObject[] = [];
  private layers: { sprite: Phaser.GameObjects.TileSprite; vx: number; vy: number }[] = [];
  private ramp: Phaser.GameObjects.Image;
  private fog: Phaser.GameObjects.Graphics;
  private strips: { sprite: Phaser.GameObjects.TileSprite; i: number }[] = [];
  private bodies: Phaser.GameObjects.TileSprite[] = [];
  private tween: Phaser.Tweens.Tween | null = null;
  private front: number;
  private gone = false;
  /** The number of expansions the mist is drawn for. */
  level: number;

  private static readonly LEFT = -M;
  private static readonly WIDTH = MAP_PX_W + M * 2;
  private static readonly BOTTOM = MAP_PX_H + M;
  private static readonly FEATHER = 0.9 * UNIT;
  private static readonly STRIPS = 14;

  /** Where the front edge sits after this many expansions (past the bottom of the world = no mist left). */
  static frontFor(level: number): number {
    if (level <= 0) return areaById('sea').from * UNIT;
    if (level === 1) return areaById('ocean').from * UNIT;
    return Mist.BOTTOM + Mist.FEATHER;
  }

  constructor(
    private scene: Phaser.Scene,
    level: number,
  ) {
    this.level = level;
    this.front = Mist.frontFor(level);
    const depth = DEPTH.haze;
    this.ramp = scene.add.image(Mist.LEFT, 0, 'fog-ramp').setOrigin(0, 0).setDisplaySize(Mist.WIDTH, Mist.FEATHER).setDepth(depth);
    this.fog = scene.add.graphics().setDepth(depth);
    this.parts.push(this.ramp, this.fog);
    for (const [key, scale, alpha, vx, vy] of [
      ['tile-mist-a', 2.4, 0.75, 0.012, 0.002],
      ['tile-mist-b', 1.6, 0.5, -0.008, -0.0015],
    ] as const) {
      // the parts near the front edge are fainter, so the mist fades in together with the fog
      for (let i = 0; i < Mist.STRIPS; i++) {
        const fade = ((i + 1) / (Mist.STRIPS + 1)) ** 1.4;
        const t = placeTile(scene, key, Mist.LEFT, 0, Mist.WIDTH, Mist.FEATHER / Mist.STRIPS, scale).setDepth(depth + 0.1).setAlpha(alpha * fade);
        this.parts.push(t);
        this.layers.push({ sprite: t, vx, vy });
        this.strips.push({ sprite: t, i });
      }
      // the rest of the mist, at full strength (one sprite)
      const body = placeTile(scene, key, Mist.LEFT, 0, Mist.WIDTH, UNIT, scale).setDepth(depth + 0.1).setAlpha(alpha);
      this.parts.push(body);
      this.layers.push({ sprite: body, vx, vy });
      this.bodies.push(body);
    }
    this.layout();
    this.finish();
  }

  /** Put every piece where the front edge is now. */
  private layout() {
    const f = this.front;
    const top = f + Mist.FEATHER;
    const h = Mist.BOTTOM - top;
    this.ramp.setPosition(Mist.LEFT, f);
    this.fog.clear();
    if (h > 0) {
      this.fog.fillStyle(0xe2f0fa, 0.78);
      this.fog.fillRect(Mist.LEFT, top, Mist.WIDTH, h);
    }
    for (const s of this.strips) s.sprite.setPosition(Mist.LEFT, f + (Mist.FEATHER * s.i) / Mist.STRIPS);
    for (const b of this.bodies) {
      b.setPosition(Mist.LEFT, top);
      b.setSize(Mist.WIDTH, Math.max(1, h));
    }
    const hidden = f >= Mist.BOTTOM;
    for (const p of this.parts) (p as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).setVisible(!hidden);
  }

  update(time: number) {
    if (this.gone) return;
    for (const l of this.layers) {
      // tiles of one layer must stay aligned with each other, so all use the same world offset
      l.sprite.tilePositionX = time * l.vx;
      l.sprite.tilePositionY = time * l.vy + l.sprite.y / (l.sprite.tileScaleY || 1);
    }
  }

  /** Pull the front edge back to where `level` expansions leave it. `animate` false jumps there (loading a save). */
  moveTo(level: number, animate = true) {
    if (this.gone || level === this.level) return;
    this.level = level;
    const target = Mist.frontFor(level);
    this.tween?.stop();
    if (!animate) {
      this.front = target;
      this.layout();
      return this.finish();
    }
    const state = { f: this.front };
    this.tween = this.scene.tweens.add({
      targets: state,
      f: target,
      duration: 4200,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.front = state.f;
        this.layout();
      },
      onComplete: () => {
        this.front = target;
        this.layout();
        this.finish();
      },
    });
  }

  private finish() {
    if (this.front < Mist.BOTTOM) return;
    this.gone = true;
    this.parts.forEach((p) => p.destroy());
  }
}
