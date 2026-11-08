import Phaser from 'phaser';
import { UNIT } from '../config/layout';
import type { MapView } from './MapView';
import { UPRIGHT } from './upright';

/** What the banner shows and what happens when the plane is tapped or gone. */
export interface PlaneFlight {
  kind: 'coins' | 'boost' | 'gems';
  text: string;
  seconds: number;
  onTap: () => void;
  onGone: () => void;
}

/** Above everything on the map, the mist too: it flies. */
const DEPTH_PLANE = 60;
/** How high it flies: its shadow lies this far below it on the ground (screen-down, in art pixels). */
const ALTITUDE = 70;
/** Extra touch area around the plane, in screen pixels. */
const TAP_PAD = 40;

/**
 * The banner plane, in the game world: it flies along the coast through the middle of what you see when it starts,
 * zooms and pans with the map, and drops a shadow on the ground below it. Drawn upright (like the buildings), so it
 * always looks level on the turned map.
 */
export class PlaneView {
  private box?: Phaser.GameObjects.Container;
  private flight?: PlaneFlight;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private t = 0;

  constructor(
    private scene: Phaser.Scene,
    private view: MapView,
  ) {}

  get flying(): boolean {
    return !!this.box;
  }

  fly(f: PlaneFlight) {
    this.remove();
    this.flight = f;
    this.t = 0;
    const v = this.view;
    // through the middle of the screen, along the coast (world x), from just outside the screen to just outside the other side
    const c = v.screenToWorld(v.width / 2, v.height * 0.4);
    const a = v.worldToScreen(c.x, c.y);
    const b = v.worldToScreen(c.x + UNIT, c.y);
    // go the way that crosses the screen from right to left
    const dir = b.x - a.x <= 0 ? 1 : -1;
    const sx = (b.x - a.x) * dir;
    const sy = (b.y - a.y) * dir;
    const pxPerUnit = Math.hypot(sx, sy);
    const half = (Math.hypot(v.width, v.height) / 2 + 160) / pxPerUnit;
    this.from = { x: c.x - dir * half * UNIT, y: c.y };
    this.to = { x: c.x + dir * half * UNIT, y: c.y };

    const box = this.scene.add.container(this.from.x, this.from.y).setDepth(DEPTH_PLANE);
    // upright on the turned map (so its shadow falls straight down), and the plane tilted so the nose points the way it flies (the art faces left)
    box.setRotation(-UPRIGHT);
    const tilt = Math.atan2(sy, sx) - Math.PI;
    // as big on screen as on a phone at the start zoom, and it grows and shrinks when you zoom
    box.setScale(UNIT / v.defaultPpu());

    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x0a2a40, 0.22);
    shadow.fillEllipse(30, 0, 76, 16);
    shadow.fillEllipse(150, 2, 110, 12);
    shadow.setPosition(0, ALTITUDE).setRotation(tilt);
    box.add(shadow);

    const body = this.scene.add.container(0, 0).setRotation(tilt);
    body.add(this.drawPlane());
    body.add(this.scene.add.rectangle(92 + 17, 0, 34, 2, 0xffffff, 0.9));
    body.add(this.drawBanner(126, f));
    box.add(body);
    this.scene.tweens.add({ targets: body, y: -5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.box = box;
  }

  /** Did a tap (in world coordinates) hit the plane or its banner? */
  hit(wx: number, wy: number): boolean {
    if (!this.box) return false;
    // a generous touch area: the plane and banner plus about 40 screen pixels all round
    const pad = (TAP_PAD * UNIT) / this.view.ppu;
    const b = this.box.getBounds();
    return wx >= b.x - pad && wx <= b.right + pad && wy >= b.y - pad && wy <= b.bottom + pad;
  }

  /** The player tapped it: it goes away and the popup opens. */
  tap() {
    const f = this.flight;
    this.remove();
    f?.onTap();
  }

  update(dt: number) {
    if (!this.box || !this.flight) return;
    this.t += dt / this.flight.seconds;
    if (this.t >= 1) {
      const f = this.flight;
      this.remove();
      f.onGone();
      return;
    }
    this.box.setPosition(this.from.x + (this.to.x - this.from.x) * this.t, this.from.y + (this.to.y - this.from.y) * this.t);
  }

  remove() {
    if (this.box) this.scene.tweens.killTweensOf(this.box.list);
    this.box?.destroy();
    this.box = undefined;
    this.flight = undefined;
  }

  /** A small red and white plane, nose to the left, about 92 by 46. */
  private drawPlane(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    const k = 1.44;
    const pts = (xs: number[][]) => xs.map(([x, y]) => new Phaser.Math.Vector2(x * k, (y - 16) * k));
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts([[6, 16], [7, 13], [12, 11.5], [20, 11], [46, 12], [56, 6], [60, 6], [57, 14], [60, 15], [60, 18], [46, 20], [20, 21], [12, 20.5], [7, 19]]), true);
    g.fillStyle(0xe8463a, 1);
    g.fillPoints(pts([[24, 16], [40, 16], [44, 28], [38, 28]]), true);
    g.fillPoints(pts([[48, 13], [56, 7], [59, 7], [56, 14]]), true);
    g.fillStyle(0x7fd3f0, 1);
    g.fillCircle(16 * k, -1 * k, 2.6 * k);
    g.fillCircle(23 * k, -1 * k, 2.6 * k);
    g.fillStyle(0x3a4c5c, 1);
    g.fillRoundedRect(2 * k, -7 * k, 2.4 * k, 14 * k, 1.2 * k);
    return g;
  }

  /** The banner: cream cloth with a notched end, the prize icon and its amount. */
  private drawBanner(x: number, f: PlaneFlight): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, 0);
    const text = this.scene.add.text(0, 0, f.text, { fontFamily: "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif", fontSize: '64px', fontStyle: '900', color: '#16324a' }).setScale(0.32).setOrigin(0, 0.5);
    const w = 12 + 22 + 6 + text.displayWidth + 20;
    const h = 38;
    const g = this.scene.add.graphics();
    g.fillStyle(0xfff7e3, 1);
    g.fillPoints([new Phaser.Math.Vector2(0, -h / 2), new Phaser.Math.Vector2(w, -h / 2), new Phaser.Math.Vector2(w - 9, 0), new Phaser.Math.Vector2(w, h / 2), new Phaser.Math.Vector2(0, h / 2)], true);
    c.add(g);
    const icon = this.scene.add.graphics();
    const ix = 12 + 11;
    if (f.kind === 'gems') {
      icon.fillStyle(0x8e5cf7, 1);
      icon.fillPoints([new Phaser.Math.Vector2(ix - 10, -3), new Phaser.Math.Vector2(ix - 5, -9), new Phaser.Math.Vector2(ix + 5, -9), new Phaser.Math.Vector2(ix + 10, -3), new Phaser.Math.Vector2(ix, 10)], true);
      icon.fillStyle(0xc9b0ff, 1);
      icon.fillPoints([new Phaser.Math.Vector2(ix - 5, -9), new Phaser.Math.Vector2(ix + 5, -9), new Phaser.Math.Vector2(ix + 3, -3), new Phaser.Math.Vector2(ix - 3, -3)], true);
    } else {
      icon.fillStyle(0xc98a0a, 1);
      icon.fillCircle(ix, 0, 11);
      icon.fillStyle(0xffc233, 1);
      icon.fillCircle(ix, 0, 9);
      icon.fillStyle(0xfff3a8, 1);
      icon.fillCircle(ix - 3, -3, 3);
    }
    c.add(icon);
    text.setPosition(12 + 22 + 6, 1);
    c.add(text);
    return c;
  }
}
