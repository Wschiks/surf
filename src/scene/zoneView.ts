import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { toWorld } from '../config/layout';
import type { ZoneRef } from '../config/sports';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import { bakeWaveTile, guestTexture, WAVE_STYLES } from './art';
import { DEPTH } from './background';
import { UPRIGHT } from './upright';
import type { MapView } from './MapView';

const frac = (x: number) => x - Math.floor(x);

/** Everything drawn on the map for one zone: plate, rolling water and the guests. */
export class ZoneView {
  readonly rect;
  private plate: Phaser.GameObjects.Graphics;
  private shade: Phaser.GameObjects.Graphics;
  private waves: Phaser.GameObjects.TileSprite;
  private guests: Phaser.GameObjects.Image[] = [];
  private lockedShown = true;
  private selected = false;

  constructor(
    private scene: Phaser.Scene,
    readonly ref: ZoneRef,
  ) {
    this.rect = toWorld(ref.def.rect);
    const r = this.rect;
    const style = WAVE_STYLES[ref.def.look];
    const key = bakeWaveTile(scene, ref.def.look);
    this.waves = scene.add.tileSprite(r.x, r.y, r.w, r.h, key).setOrigin(0, 0).setDepth(DEPTH.zone);
    this.waves.setTileScale((1 / 1.5) * style.scale, (1 / 1.5) * style.scale);
    this.waves.setAlpha(style.alpha);
    this.plate = scene.add.graphics().setDepth(DEPTH.zone + 0.1);
    this.shade = scene.add.graphics().setDepth(DEPTH.zone + 0.2);
    this.drawPlate();
    this.shade.fillStyle(0x062033, 0.38);
    this.shade.fillRoundedRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10);
  }

  private drawPlate() {
    const r = this.rect;
    const g = this.plate;
    g.clear();
    const col = Phaser.Display.Color.HexStringToColor(this.ref.sport.color).color;
    g.fillStyle(col, this.selected ? 0.22 : 0.08);
    g.fillRoundedRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10);
    g.lineStyle(this.selected ? 4 : 2.2, this.selected ? 0xffffff : col, this.selected ? 0.95 : 0.6);
    g.strokeRoundedRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 10);
  }

  setSelected(v: boolean) {
    if (v !== this.selected) {
      this.selected = v;
      this.drawPlate();
    }
  }

  private ensureGuests(n: number) {
    while (this.guests.length < n) {
      const i = this.guests.length;
      const colors = this.ref.def.guestColors;
      const key = guestTexture(this.scene, this.ref.sport.guestKind, colors[i % colors.length], i);
      const img = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.92).setDepth(DEPTH.things);
      img.setDisplaySize(30 * 0.62, 44 * 0.62).setRotation(-UPRIGHT);
      this.guests.push(img);
    }
  }

  update(time: number, state: GameState, view: MapView) {
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
      for (const g of this.guests) g.setVisible(false);
      return;
    }
    const st = zoneStats(state, this.ref, z);
    const n = Math.min(st.guests, BALANCE.maxVisibleGuests);
    this.ensureGuests(n);
    const r = this.rect;
    const running = z.phase === 'running';
    const progress = running ? z.elapsed / st.duration : 0;
    const kind = this.ref.sport.guestKind;
    const cruise = kind === 'windsurfer' || kind === 'kiter' || kind === 'foiler' || kind === 'sailor';
    for (let i = 0; i < this.guests.length; i++) {
      const g = this.guests[i];
      g.setVisible(i < n && near);
      if (i >= n || !near) continue;
      const slot = frac(0.618 * (i + 1));
      if (!running && !z.manager) {
        // waiting for the player: guests queue at the beach side of the zone
        const x = r.x + r.w * (0.1 + (0.8 * (i + 0.5)) / n);
        g.setPosition(x, r.y + r.h * 0.2 + Math.sin(time / 500 + i) * 1.5);
        g.setFlipX(false);
        continue;
      }
      // a manager runs the zone all the time: use the clock, a cycle is one session
      const p = z.manager ? frac(z.elapsed / st.duration) : progress;
      const t = frac(p + i / n);
      if (cruise) {
        const a = (t + slot) * Math.PI * 2;
        g.setPosition(r.x + r.w * (0.5 + 0.4 * Math.sin(a)), r.y + r.h * (0.3 + 0.5 * frac(slot * 3.1)) + Math.sin(time / 400 + i) * 1.2);
        g.setFlipX(Math.cos(a) < 0);
      } else {
        const x = r.x + r.w * (0.08 + 0.84 * slot) + Math.sin(t * Math.PI * 2) * 6;
        // ride toward the beach (up), start again from the outside
        g.setPosition(x, r.y + r.h * (0.95 - 0.8 * t));
        g.setFlipX(false);
      }
    }
  }
}
