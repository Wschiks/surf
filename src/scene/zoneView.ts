import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { toWorld } from '../config/layout';
import type { ZoneRef } from '../config/sports';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import { bakeWaveTile, LOOK_TINT, WAVE_STYLES } from './art';
import { Crew } from './rig/crew';
import { skinById } from '../config/skins';
import type { FxPool } from './rig/fx';
import { DEPTH } from './background';
import type { MapView } from './MapView';
import { bakeTexture, css, roundRect } from './bake';

/** Everything drawn on the map for one zone: plate, rolling water and the guests. */
export class ZoneView {
  readonly rect;
  private plate: Phaser.GameObjects.Image;
  private shade: Phaser.GameObjects.Image;
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
    // plate and lock shade are pictures drawn once (a Graphics is redrawn every frame)
    this.plate = scene.add.image(r.x, r.y, this.drawPlate(scene)).setOrigin(0, 0).setDisplaySize(r.w, r.h).setDepth(DEPTH.zone + 0.1);
    const shadeKey = bakeTexture(scene, `zone-shade-${ref.id}`, r.w, r.h, (c) => {
      c.fillStyle = css(0x062033, 0.38);
      roundRect(c, 3, 3, r.w - 6, r.h - 6, 10);
      c.fill();
    });
    this.shade = scene.add.image(r.x, r.y, shadeKey).setOrigin(0, 0).setDisplaySize(r.w, r.h).setDepth(DEPTH.zone + 0.2);
    this.crew = new Crew(scene, ref, fx, r);
  }

  /** The plate's picture (redrawn when the zone is selected or not): its look's tint, the sport's colour, a white edge. */
  private drawPlate(scene: Phaser.Scene = this.plate.scene): string {
    const r = this.rect;
    const col = Phaser.Display.Color.HexStringToColor(this.ref.sport.color).color;
    const [tint, tintAlpha] = LOOK_TINT[this.ref.def.look];
    const sel = this.selected;
    return bakeTexture(scene, `zone-plate-${this.ref.id}`, r.w, r.h, (c) => {
      roundRect(c, 4, 4, r.w - 8, r.h - 8, 12);
      c.fillStyle = css(tint, tintAlpha);
      c.fill();
      c.fillStyle = sel ? css(0xffffff, 0.16) : css(col, 0.07);
      c.fill();
      c.lineWidth = sel ? 4 : 2;
      c.strokeStyle = css(0xffffff, sel ? 0.95 : 0.3);
      c.stroke();
    });
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
    const worn = state.skins.worn[this.ref.id];
    this.crew.update(dt, time / 1000, z.manager || z.phase === 'running', n, near, detail, worn ? (skinById(worn) ?? null) : null);
  }
}
