// Development only (not in the build, not committed): the guest models on their own, with a clock that can stop and step.
import Phaser from 'phaser';
import { MAP_ROTATION_DEG, toWorld } from './config/layout';
import { ZONES } from './config/sports';
import { WAVE_STYLES, bakeWaveTile, LOOK_TINT } from './scene/art';
import { bakeRigAtlas } from './scene/rig/atlas';
import { Crew } from './scene/rig/crew';
import { FxPool } from './scene/rig/fx';

class Lab extends Phaser.Scene {
  crews: { id: string; crew: Crew; rect: { x: number; y: number; w: number; h: number } }[] = [];
  fx!: FxPool;
  t = 0;
  paused = false;
  active = true;
  guests = 10;
  view = { x: 0, y: 0, zoom: 3 };
  rot = (MAP_ROTATION_DEG * Math.PI) / 180;
  create() {
    bakeRigAtlas(this);
    this.fx = new FxPool(this, 7.75);
    const g = this.add.graphics().setDepth(0);
    for (const ref of ZONES) {
      const r = toWorld(ref.def.rect);
      g.fillStyle(0x7cc8dc, 1).fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20);
      const [tint, a] = LOOK_TINT[ref.def.look];
      g.fillStyle(tint, a).fillRect(r.x, r.y, r.w, r.h);
      const key = bakeWaveTile(this, ref.def.look);
      const st = WAVE_STYLES[ref.def.look];
      this.add.tileSprite(r.x, r.y, r.w, r.h, key).setOrigin(0, 0).setDepth(1).setTileScale(st.scale / 1.5, st.scale / 1.5).setAlpha(st.alpha * 0.6);
      g.lineStyle(1, 0xffffff, 0.5).strokeRect(r.x, r.y, r.w, r.h);
      this.crews.push({ id: ref.id, crew: new Crew(this, ref, this.fx, r), rect: r });
    }
    (window as unknown as { lab: unknown }).lab = this;
  }
  step(dt: number) {
    this.t += dt;
    for (const c of this.crews) c.crew.update(dt, this.t, this.active, this.guests, true);
    this.fx.update(dt);
  }
  advance(seconds: number) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) this.step(1 / 60);
  }
  look(x: number, y: number, zoom: number) {
    this.view = { x, y, zoom };
  }
  zone(id: string) {
    return this.crews.find((c) => c.id === id)!;
  }
  update(_t: number, delta: number) {
    if (!this.paused) this.step(Math.min(delta, 50) / 1000);
    const cam = this.cameras.main;
    cam.setZoom(this.view.zoom);
    cam.setRotation(this.rot);
    cam.centerOn(this.view.x, this.view.y);
  }
}

new Phaser.Game({ type: Phaser.WEBGL, parent: 'lab', width: 420, height: 420, backgroundColor: '#7cc8dc', scene: Lab, antialias: true, render: { maxTextures: 8 } });
