import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { toWorld } from '../config/layout';
import type { ZoneRef } from '../config/sports';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import { bakeWaveTile, guestTexture, GUEST_LOOK, WAVE_STYLES } from './art';
import { DEPTH } from './background';
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
  private lastElapsed = 0;
  private selected = false;

  constructor(
    private scene: Phaser.Scene,
    readonly ref: ZoneRef,
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
  }

  private drawPlate() {
    const r = this.rect;
    const g = this.plate;
    g.clear();
    const col = Phaser.Display.Color.HexStringToColor(this.ref.sport.color).color;
    const inner = { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 };
    g.fillStyle(this.selected ? 0xffffff : col, this.selected ? 0.16 : 0.09);
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

  private ensureGuests(n: number) {
    const kind = this.ref.sport.guestKind;
    const look = GUEST_LOOK[kind];
    while (this.guests.length < n) {
      const i = this.guests.length;
      const colors = this.ref.def.guestColors;
      const key = guestTexture(this.scene, kind, colors[i % colors.length], i);
      const img = this.scene.add.image(0, 0, key).setOrigin(look.ox, look.oy).setDepth(DEPTH.things);
      img.setDisplaySize(look.w, look.h);
      this.guests.push(img);
      const wake = this.scene.add.image(0, 0, 'fx-wake').setOrigin(0.5, 0).setDepth(DEPTH.things - 0.2).setDisplaySize(11, 26);
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
    // a managed zone finished a session: show the coins (only for zones the player can see)
    if (z.manager && z.elapsed < this.lastElapsed - 0.001 && near && view.ppu > 60) this.onCycle(this.ref.id, st.income);
    this.lastElapsed = z.elapsed;
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
        // waiting for the player: guests stand in a row at the beach side of the zone
        const x = r.x + r.w * (0.1 + (0.8 * (i + 0.5)) / n);
        g.setPosition(x, r.y + r.h * 0.2 + Math.sin(time / 500 + i) * 1.2);
        g.setRotation(0);
        g.setAlpha(1);
        continue;
      }
      // a manager runs the zone all the time: use the clock, a cycle is one session
      const p = z.manager ? frac(z.elapsed / st.duration) : progress;
      const t = frac(p + i / n);
      let rot: number;
      let gx: number;
      let gy: number;
      if (cruise) {
        const a = (t + slot) * Math.PI * 2;
        gx = r.x + r.w * (0.5 + 0.4 * Math.sin(a));
        gy = r.y + r.h * (0.3 + 0.5 * frac(slot * 3.1)) + Math.sin(time / 400 + i) * 1;
        rot = (Math.cos(a) >= 0 ? Math.PI / 2 : -Math.PI / 2) + Math.sin(time / 500 + i) * 0.05;
        g.setAlpha(1);
      } else {
        // ride toward the beach (up), start again from the outside
        gx = r.x + r.w * (0.08 + 0.84 * slot) + Math.sin(t * Math.PI * 2) * 6;
        gy = r.y + r.h * (0.95 - 0.8 * t);
        rot = Math.cos(t * Math.PI * 2) * 0.16;
        // guests arrive at the start of a ride and leave at the end
        g.setAlpha(Math.min(1, t * 10, (1 - t) * 10));
      }
      g.setPosition(gx, gy).setRotation(rot);
      wake.setPosition(gx, gy).setRotation(rot).setVisible(true).setAlpha(0.6 * g.alpha);
    }
  }
}
