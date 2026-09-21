import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { toWorld } from '../config/layout';
import type { ZoneRef } from '../config/sports';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import { bakeWaveTile, guestTexture, WAVE_STYLES } from './art';
import { DEPTH } from './background';
import { dashedRect } from './draw';
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
  private wakes: Phaser.GameObjects.Image[] = [];
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
    const inner = { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 };
    g.fillStyle(this.selected ? 0xffffff : col, this.selected ? 0.16 : 0.06);
    g.fillRoundedRect(inner.x, inner.y, inner.w, inner.h, 12);
    if (this.selected) {
      g.lineStyle(4, 0xffffff, 0.95);
      g.strokeRoundedRect(inner.x, inner.y, inner.w, inner.h, 12);
    } else {
      g.lineStyle(2, 0xffffff, 0.55);
      dashedRect(g, inner, 10, 8);
      // a coloured corner mark shows which sport the zone belongs to
      g.lineStyle(4, col, 0.9);
      const L = Math.min(26, inner.w / 3, inner.h / 3);
      g.lineBetween(inner.x, inner.y + L, inner.x, inner.y);
      g.lineBetween(inner.x, inner.y, inner.x + L, inner.y);
      g.lineBetween(inner.x + inner.w - L, inner.y, inner.x + inner.w, inner.y);
      g.lineBetween(inner.x + inner.w, inner.y, inner.x + inner.w, inner.y + L);
      g.lineBetween(inner.x, inner.y + inner.h - L, inner.x, inner.y + inner.h);
      g.lineBetween(inner.x, inner.y + inner.h, inner.x + L, inner.y + inner.h);
      g.lineBetween(inner.x + inner.w - L, inner.y + inner.h, inner.x + inner.w, inner.y + inner.h);
      g.lineBetween(inner.x + inner.w, inner.y + inner.h - L, inner.x + inner.w, inner.y + inner.h);
    }
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
      img.setDisplaySize(30 * 0.6, 44 * 0.6).setRotation(-UPRIGHT);
      this.guests.push(img);
      const wake = this.scene.add.image(0, 0, 'fx-wake').setDepth(DEPTH.things - 0.2).setDisplaySize(30, 15);
      this.wakes.push(wake);
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
      for (const w of this.wakes) w.setVisible(false);
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
      const wake = this.wakes[i];
      g.setVisible(i < n && near);
      wake.setVisible(false);
      if (i >= n || !near) continue;
      const slot = frac(0.618 * (i + 1));
      if (!running && !z.manager) {
        // waiting for the player: guests queue at the beach side of the zone
        const x = r.x + r.w * (0.1 + (0.8 * (i + 0.5)) / n);
        g.setPosition(x, r.y + r.h * 0.2 + Math.sin(time / 500 + i) * 1.5);
        g.setFlipX(false);
        g.setRotation(-UPRIGHT);
        continue;
      }
      // a manager runs the zone all the time: use the clock, a cycle is one session
      const p = z.manager ? frac(z.elapsed / st.duration) : progress;
      const t = frac(p + i / n);
      if (cruise) {
        const a = (t + slot) * Math.PI * 2;
        const gx = r.x + r.w * (0.5 + 0.4 * Math.sin(a));
        const gy = r.y + r.h * (0.3 + 0.5 * frac(slot * 3.1)) + Math.sin(time / 400 + i) * 1.2;
        g.setPosition(gx, gy);
        g.setFlipX(Math.cos(a) < 0);
        g.setRotation(-UPRIGHT + Math.cos(a) * 0.08);
        wake.setPosition(gx - Math.sign(Math.cos(a)) * 10, gy + 2).setVisible(true).setAlpha(0.5 + 0.2 * Math.sin(time / 200 + i));
      } else {
        const x = r.x + r.w * (0.08 + 0.84 * slot) + Math.sin(t * Math.PI * 2) * 6;
        // ride toward the beach (up), start again from the outside
        const gy = r.y + r.h * (0.95 - 0.8 * t);
        g.setPosition(x, gy + Math.sin(time / 260 + i * 2) * 1.2);
        g.setFlipX(false);
        g.setRotation(-UPRIGHT + Math.sin(t * Math.PI * 2) * 0.1);
        wake.setPosition(x, gy + 5).setVisible(true).setAlpha(0.55 + 0.25 * Math.sin(time / 180 + i));
      }
    }
  }
}
