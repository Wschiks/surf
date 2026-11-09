import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { toWorld } from '../config/layout';
import type { ZoneRef } from '../config/sports';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import { bakeWaveTile, LOOK_TINT, WAVE_STYLES } from './art';
import { Crew } from './rig/crew';
import type { FxPool } from './rig/fx';
import { DEPTH } from './background';
import type { MapView } from './MapView';

/** Everything drawn on the map for one zone: plate, rolling water and the guests. */
export class ZoneView {
  readonly rect;
  private plate: Phaser.GameObjects.Graphics;
  private shade: Phaser.GameObjects.Graphics;
  private waves: Phaser.GameObjects.TileSprite;
  private crew: Crew;
  private lockedShown = true;
  private lastElapsed = 0;
  private selected = false;

  constructor(
    scene: Phaser.Scene,
    readonly ref: ZoneRef,
    fx: FxPool,
    private onCycle: (zoneId: string, coins: number) => void = () => {},
  ) {
    this.rect = toWorld(ref.def.rect);
    const r = this.rect;
    const style = WAVE_STYLES[ref.def.look];
    const key = bakeWaveTile(scene, ref.def.look);
    this.waves = scene.add.tileSprite(r.x, r.y, r.w, r.h, key).setOrigin(0, 0).setDepth(DEPTH.zone);
    this.waves.setTileScale((1 / 1.5) * style.scale, (1 / 1.5) * style.scale);
    this.waves.setAlpha(style.alpha * 0.6);
    this.plate = scene.add.graphics().setDepth(DEPTH.zone + 0.1);
    this.shade = scene.add.graphics().setDepth(DEPTH.zone + 0.2);
    this.drawPlate();
    this.shade.fillStyle(0x062033, 0.38);
    this.shade.fillRoundedRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10);
    this.crew = new Crew(scene, ref, fx, r);
  }

  private drawPlate() {
    const r = this.rect;
    const g = this.plate;
    g.clear();
    const col = Phaser.Display.Color.HexStringToColor(this.ref.sport.color).color;
    const inner = { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 };
    const [tint, tintAlpha] = LOOK_TINT[this.ref.def.look];
    g.fillStyle(tint, tintAlpha);
    g.fillRoundedRect(inner.x, inner.y, inner.w, inner.h, 12);
    g.fillStyle(this.selected ? 0xffffff : col, this.selected ? 0.16 : 0.07);
    g.fillRoundedRect(inner.x, inner.y, inner.w, inner.h, 12);
    g.lineStyle(this.selected ? 4 : 2, 0xffffff, this.selected ? 0.95 : 0.3);
    g.strokeRoundedRect(inner.x, inner.y, inner.w, inner.h, 12);
  }

  setSelected(v: boolean) {
    if (v !== this.selected) {
      this.selected = v;
      this.drawPlate();
    }
  }

  update(time: number, dt: number, state: GameState, view: MapView) {
    const z = state.zones[this.ref.id];
    const owned = z.owned;
    if (owned === this.lockedShown) {
      this.lockedShown = !owned;
      this.shade.setVisible(!owned);
    }
    // skip work while the zone is far from the screen
    const c = view.worldToScreen(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2);
    const reach = (Math.max(this.rect.w, this.rect.h) / 2) * view.zoom + 120;
    const near = c.x > -reach && c.x < view.width + reach && c.y > -reach && c.y < view.height + reach;
    this.waves.setVisible(near);
    if (near) {
      const style = WAVE_STYLES[this.ref.def.look];
      this.waves.tilePositionY = (time / 1000) * style.speed * 1.5;
    }
    if (!owned) {
      this.crew.update(dt, time / 1000, false, 0, false);
      return;
    }
    const st = zoneStats(state, this.ref, z);
    // a managed zone finished a session: show the coins (only for zones the player can see)
    if (z.manager && z.elapsed < this.lastElapsed - 0.001 && near && view.ppu > 60) this.onCycle(this.ref.id, st.income);
    this.lastElapsed = z.elapsed;
    const n = Math.min(st.guests, BALANCE.maxVisibleGuests);
    const detail = view.zoom >= 1.2 ? 2 : view.zoom >= 0.55 ? 1 : 0;
    this.crew.update(dt, time / 1000, z.manager || z.phase === 'running', n, near, detail);
  }
}
