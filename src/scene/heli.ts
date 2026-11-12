import Phaser from 'phaser';
import { SHORE } from '../config/areas';
import { MAP_W, UNIT } from '../config/layout';
import type { MapView } from './MapView';
import { UPRIGHT } from './upright';
import { sound } from '../ui/sound';

/** What happens when the helicopter is tapped, or when it has flown by. */
export interface HeliFlight {
  seconds: number;
  /** It slows down and lingers this long in the middle of the screen. */
  linger: number;
  onTap: () => void;
  onGone: () => void;
}

/** Above everything on the map, the mist too: it flies. */
const DEPTH_HELI = 60;
/** How high it flies: its shadow lies this far below it on the ground (screen-down, in art pixels). */
const ALTITUDE = 74;
/** How low it hovers over the swimmer. */
const LOW = 44;
/** Screen px added round the helicopter's size for a tap, and the smallest tap circle (screen px). */
const TAP_PAD = 60;
const TAP_RADIUS = 110;
/** How much faster than its normal pace it flies away when the popup is closed with X. */
const LEAVE_HURRY = 3;
/** How big it is compared with the old banner plane (in the game world: it grows and shrinks with the map). */
const SIZE = 1.3;

type Phase = 'fly' | 'hover' | 'rescue' | 'cruise';

/**
 * The rescue helicopter (replaces the banner plane): a yellow rescue helicopter flies along the coast through the middle of
 * what you see, rotors turning, its shadow on the ground. Tap it and it stops and hovers while the popup shows the reward.
 * Closed without the ad: it flies on. After the ad: it flies to a swimmer waving in the water, hovers low (its rotor wash
 * rings the water), lowers the winch line, pulls the swimmer up and flies away. Drawn upright (like the buildings), seen
 * from the side, so it always looks level on the turned map. Nothing random.
 */
export class HeliView {
  private box?: Phaser.GameObjects.Container;
  private body?: Phaser.GameObjects.Container;
  private shadow?: Phaser.GameObjects.Graphics;
  private flight?: HeliFlight;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private t = 0;
  private phase: Phase = 'fly';
  private alt = ALTITUDE;
  private rotor?: Phaser.GameObjects.Graphics;
  private tail?: Phaser.GameObjects.Graphics;
  private spin = 0;
  private ring?: Phaser.GameObjects.Graphics;
  /** After it has crossed your screen it flies on over the rest of the map until it is past the map's edge (zoomed out you always see it fly off, it never vanishes in the middle). */
  private cruiseSpeed = 0;
  private cruiseV = 0;
  /** Faster than its normal pace (flying away after X). */
  private hurry = 1;
  private dir = { x: -1, y: 0 };
  /** Seconds since it started its flight (it lingers in the middle). */
  private elapsed = 0;

  constructor(
    private scene: Phaser.Scene,
    private view: MapView,
  ) {}

  get flying(): boolean {
    return !!this.box;
  }

  fly(f: HeliFlight) {
    this.remove();
    this.flight = f;
    this.t = 0;
    this.elapsed = 0;
    this.phase = 'fly';
    this.hurry = 1;
    this.alt = ALTITUDE;
    const v = this.view;
    this.route();
    const len = Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y) || 1;
    this.dir = { x: (this.to.x - this.from.x) / len, y: (this.to.y - this.from.y) / len };
    // its pace over your screen (world units a second), kept when it flies on over the rest of the map
    this.cruiseSpeed = len / Math.max(1, f.seconds - f.linger);

    const box = this.scene.add.container(this.from.x, this.from.y).setDepth(DEPTH_HELI);
    box.setRotation(-UPRIGHT);
    box.setScale((SIZE * UNIT) / v.defaultPpu());
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x0a2a40, 0.22);
    shadow.fillEllipse(6, 0, 96, 16);
    shadow.fillEllipse(-4, 0, 150, 8);
    shadow.setPosition(0, this.alt);
    box.add(shadow);
    // a pulsing ring on the water under it: tap me
    const ring = this.scene.add.graphics();
    ring.lineStyle(3, 0xffffff, 0.9);
    ring.strokeEllipse(0, 0, 70, 20);
    ring.setPosition(0, this.alt);
    box.add(ring);
    this.ring = ring;
    this.scene.tweens.add({ targets: ring, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 1100, repeat: -1, ease: 'Sine.easeOut' });
    sound.rotor();
    const body = this.scene.add.container(0, 0);
    // level, nose a little down the way it flies (it always crosses the screen right to left; the art faces left)
    body.setRotation(-0.1);
    this.drawHeli(body);
    box.add(body);
    this.scene.tweens.add({ targets: body, y: -4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.box = box;
    this.body = body;
    this.shadow = shadow;
  }

  /**
   * Its route in the game world, worked out when it appears: through the middle of what you see, along the coast, from
   * fully outside the screen on the right to fully outside on the left. Its own size on screen at this zoom is counted,
   * so even zoomed far out it comes in from the side and never pops up inside the screen.
   */
  private route() {
    const v = this.view;
    const c = v.screenToWorld(v.width / 2, v.height * 0.4);
    const a = v.worldToScreen(c.x, c.y);
    const b = v.worldToScreen(c.x + UNIT, c.y);
    const dir = b.x - a.x <= 0 ? 1 : -1;
    const pxPerUnit = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // half the screen's diagonal plus half the helicopter (rotor included, at this zoom) plus a little, in screen pixels
    const heliHalf = 95 * SIZE * (v.ppu / v.defaultPpu());
    const half = (Math.hypot(v.width, v.height) / 2 + heliHalf + 40) / pxPerUnit;
    this.from = { x: c.x - dir * half * UNIT, y: c.y };
    this.to = { x: c.x + dir * half * UNIT, y: c.y };
  }

  /**
   * Did a tap (in world coordinates) hit the helicopter? Measured on screen, generously: anywhere in a big circle round
   * the helicopter or round the ring on the water under it counts (it moves, so a tap must not miss by a hair).
   */
  hit(wx: number, wy: number): boolean {
    if (!this.box || this.phase !== 'fly') return false;
    const v = this.view;
    const tap = v.worldToScreen(wx, wy);
    const box = this.box;
    const sc = box.scaleX;
    // the ring sits `alt` below the helicopter in its own (turned, scaled) frame
    const ringX = box.x - Math.sin(box.rotation) * this.alt * sc;
    const ringY = box.y + Math.cos(box.rotation) * this.alt * sc;
    const heliHalf = 95 * SIZE * (v.ppu / v.defaultPpu());
    const r = Math.max(TAP_RADIUS, heliHalf + TAP_PAD);
    return [v.worldToScreen(box.x, box.y), v.worldToScreen(ringX, ringY)].some((p) => Math.hypot(tap.x - p.x, tap.y - p.y) <= r);
  }

  /** The player tapped it: it stops and hovers while the popup is open. */
  tap() {
    if (!this.flight || this.phase !== 'fly') return;
    this.phase = 'hover';
    this.flight.onTap();
  }

  /** The popup was closed with X: it flies away at once, fast, over the map's edge (and the next one is planned). */
  leave() {
    if (!this.box || !this.flight || this.phase !== 'hover') return;
    this.hurry = LEAVE_HURRY;
    this.cruise(this.cruiseSpeed * LEAVE_HURRY);
    this.flight.onGone();
  }

  /** After the ad: fly to a swimmer in the water, winch them up, fly away. `done` when it has gone. */
  rescue(done: () => void) {
    const box = this.box;
    const body = this.body;
    if (!box || !body) return done();
    this.phase = 'rescue';
    this.ring?.setVisible(false);
    // a spot in the water near the middle of the screen, so the whole rescue is in view (on the beach: straight out to sea)
    const mid = this.view.screenToWorld(this.view.width / 2, this.view.height * 0.45);
    const tx = Phaser.Math.Clamp(mid.x, 0.6 * UNIT, (MAP_W - 0.6) * UNIT);
    const ty = Math.max(mid.y, (SHORE + 0.7) * UNIT);
    const s = this.scene;
    // the swimmer and the water rings sit on the ground below (made now, shown once it is there)
    const ground = s.add.container(0, LOW).setAlpha(0);
    const rings = [0, 1, 2].map(() => s.add.graphics());
    rings.forEach((r) => ground.add(r));
    const swimmer = this.drawSwimmer();
    ground.add(swimmer);
    const line = s.add.graphics();
    box.addAt(line, 1);
    box.addAt(ground, 1);
    const winch = { len: 0, up: 0 };
    const drawLine = () => {
      line.clear();
      if (winch.len <= 0) return;
      const top = 6;
      const bottom = top + (LOW - top - 4) * winch.len - (LOW - top - 4) * winch.up;
      line.lineStyle(1.6, 0x2b2f33, 1);
      line.lineBetween(-8, top, -8, bottom);
      line.fillStyle(0xff5a1f, 1);
      line.fillCircle(-8, bottom, 2.4);
    };
    const wash = () => {
      // rotor wash: rings run outward over the water
      rings.forEach((r, i) => {
        s.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 1100,
          delay: i * 360,
          repeat: -1,
          onUpdate: (tw) => {
            const p = tw.getValue() ?? 0;
            r.clear();
            r.lineStyle(2.2, 0xffffff, 0.75 * (1 - p));
            r.strokeEllipse(0, 4, 30 + p * 110, 8 + p * 26);
          },
        });
      });
    };
    // 1. fly over the water and come down low
    s.tweens.add({ targets: box, x: tx, y: ty, duration: 1300, ease: 'Sine.easeInOut' });
    s.tweens.add({
      targets: this,
      alt: LOW,
      duration: 1300,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.shadow?.setY(this.alt),
      onComplete: () => {
        // 2. the swimmer is there, waving; the rotor wash rings the water
        s.tweens.add({ targets: ground, alpha: 1, duration: 250 });
        wash();
        // 3. the line goes down
        s.tweens.add({
          targets: winch,
          len: 1,
          delay: 450,
          duration: 550,
          ease: 'Sine.easeOut',
          onUpdate: drawLine,
          onComplete: () => {
            // 4. up they go
            s.tweens.add({
              targets: winch,
              up: 1,
              duration: 1000,
              ease: 'Sine.easeInOut',
              onUpdate: () => {
                drawLine();
                swimmer.setY(-(LOW - 10) * winch.up);
                swimmer.setScale(1 + 0.15 * winch.up);
              },
              onComplete: () => {
                swimmer.setVisible(false);
                line.clear();
                // 5. climb and fly away
                // on the way it came, over the rest of the map and past its edge
                s.tweens.add({ targets: ground, alpha: 0, duration: 600, onComplete: () => rings.forEach((r) => s.tweens.killTweensOf(r)) });
                s.tweens.add({ targets: this, alt: ALTITUDE, duration: 900, ease: 'Sine.easeIn', onUpdate: () => this.shadow?.setY(this.alt) });
                this.cruise(0);
                done();
              },
            });
          },
        });
      },
    });
  }

  /** Fly on over the map from where it is, speeding up from `v0`, until it is past the map's edge. */
  private cruise(v0: number) {
    this.phase = 'cruise';
    this.cruiseV = v0;
    this.ring?.setVisible(false);
  }

  /** Past the edge of the map (and a bit), in the way it flies. */
  private pastMap(): boolean {
    const b = this.box!;
    const m = 3 * UNIT;
    return (this.dir.x < 0 && b.x < -m) || (this.dir.x > 0 && b.x > MAP_W * UNIT + m) || (this.dir.x === 0 && Math.abs(b.y) > 99 * UNIT);
  }

  update(dt: number) {
    if (!this.box || !this.flight) return;
    // the rotors turn all the time
    this.spin += dt * 34;
    if (this.rotor) this.rotor.scaleX = 0.25 + 0.75 * Math.abs(Math.cos(this.spin));
    if (this.tail) this.tail.rotation = this.spin * 1.6;
    if (this.phase === 'cruise') {
      // at its normal pace while you can see it; out of sight it hurries to the edge of the map
      const p = this.view.worldToScreen(this.box.x, this.box.y);
      const seen = p.x > -250 && p.x < this.view.width + 250 && p.y > -250 && p.y < this.view.height + 250;
      // zoomed far out it flies a bit faster (it is still a thing in the game, just not a crawl across the whole map)
      const zf = Phaser.Math.Clamp(Math.sqrt(this.view.defaultPpu() / this.view.ppu), 1, 5);
      const top = this.cruiseSpeed * zf * (seen ? 1 : 6) * this.hurry;
      this.cruiseV = Math.min(top, this.cruiseV + this.cruiseSpeed * dt * (seen ? 0.8 : 6));
      this.box.x += this.dir.x * this.cruiseV * dt;
      this.box.y += this.dir.y * this.cruiseV * dt;
      if (this.pastMap()) this.remove();
      return;
    }
    if (this.phase !== 'fly') return;
    // in, slowing down to linger in the middle of the screen, then on and out (smooth, no sudden stop)
    this.elapsed += dt;
    const f0 = this.flight;
    const half = Math.max(1, (f0.seconds - f0.linger) / 2);
    const e = this.elapsed;
    if (e < half) this.t = 0.46 * Math.sin((e / half) * (Math.PI / 2));
    else if (e < half + f0.linger) this.t = 0.46 + (0.08 * (e - half)) / f0.linger;
    else this.t = 0.54 + 0.46 * (1 - Math.cos(Math.min(1, (e - half - f0.linger) / half) * (Math.PI / 2)));
    if (e >= f0.seconds) {
      // off your screen: the next one can be planned; it flies on to the edge of the map
      this.cruise(this.cruiseSpeed);
      f0.onGone();
      return;
    }
    this.box.setPosition(this.from.x + (this.to.x - this.from.x) * this.t, this.from.y + (this.to.y - this.from.y) * this.t);
  }

  remove() {
    if (this.box) {
      this.scene.tweens.killTweensOf(this.box);
      this.scene.tweens.killTweensOf(this.box.list);
      this.scene.tweens.killTweensOf(this);
    }
    this.box?.destroy();
    this.box = undefined;
    this.body = undefined;
    this.shadow = undefined;
    this.rotor = undefined;
    this.tail = undefined;
    this.ring = undefined;
    this.flight = undefined;
  }

  /** A yellow rescue helicopter seen from the side, nose to the left, about 120 by 50: rounded cabin, big window, open side door, tail boom with a red band, tail rotor, skids, main rotor. */
  private drawHeli(body: Phaser.GameObjects.Container) {
    const s = this.scene;
    const ink = 0x2a2a2a;
    const yellow = 0xffc21a;
    const g = s.add.graphics();
    const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    // tail boom and fin
    g.fillStyle(yellow, 1);
    g.lineStyle(2, ink, 1);
    const boom = [V(18, -14), V(70, -12), V(76, -24), V(84, -24), V(82, -6), V(70, -4), V(18, 0)];
    g.fillPoints(boom, true);
    g.strokePoints(boom, true);
    g.fillStyle(0xe53935, 1);
    g.fillRect(48, -12.5, 7, 9);
    g.fillStyle(0xffffff, 1);
    g.fillRect(55, -12.2, 4, 8.6);
    // cabin
    g.fillStyle(yellow, 1);
    g.fillRoundedRect(-44, -26, 66, 34, { tl: 18, tr: 10, bl: 14, br: 6 });
    g.lineStyle(2.2, ink, 1);
    g.strokeRoundedRect(-44, -26, 66, 34, { tl: 18, tr: 10, bl: 14, br: 6 });
    // cockpit window and the open door with the winch operator
    g.fillStyle(0x1f3a52, 1);
    g.fillRoundedRect(-41, -22, 20, 15, { tl: 12, tr: 3, bl: 4, br: 3 });
    g.fillStyle(0x8fd3ff, 0.55);
    g.fillRoundedRect(-38, -20, 8, 5, 2);
    g.fillStyle(0x2b2f33, 1);
    g.fillRect(-15, -20, 16, 22);
    g.fillStyle(0xff5a1f, 1);
    g.fillRoundedRect(-11, -12, 8, 12, 2);
    g.fillStyle(0xf2c9a0, 1);
    g.fillCircle(-7, -15, 3.4);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-11, -19.5, 8, 3.5, 1.5);
    // a red stripe along the cabin and a white cross
    g.fillStyle(0xe53935, 1);
    g.fillRect(2, -4, 19, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRect(9, -17, 6, 2);
    g.fillRect(11, -19, 2, 6);
    // skids
    g.lineStyle(2.4, ink, 1);
    g.lineBetween(-30, 8, -30, 14);
    g.lineBetween(10, 8, 10, 14);
    g.lineBetween(-42, 14, 20, 14);
    g.lineBetween(-42, 14, -46, 11);
    // rotor mast
    g.fillStyle(0x4a5058, 1);
    g.fillRect(-12, -32, 6, 7);
    body.add(g);
    // main rotor: a long blade that seems to spin (it narrows and widens), and a faint disc
    const disc = s.add.graphics();
    disc.fillStyle(0xffffff, 0.12);
    disc.fillEllipse(-9, -33, 150, 7);
    body.add(disc);
    const rotor = s.add.graphics();
    rotor.fillStyle(0x30353b, 1);
    rotor.fillRoundedRect(-75, -1.6, 150, 3.2, 1.6);
    rotor.setPosition(-9, -33);
    body.add(rotor);
    // tail rotor
    const tail = s.add.graphics();
    tail.fillStyle(0x30353b, 0.85);
    tail.fillRect(-1.2, -9, 2.4, 18);
    tail.fillRect(-9, -1.2, 18, 2.4);
    tail.setPosition(80, -16);
    body.add(tail);
    this.rotor = rotor;
    this.tail = tail;
  }

  /** A swimmer waiting in the water: head, orange life vest, both arms waving. */
  private drawSwimmer(): Phaser.GameObjects.Container {
    const s = this.scene;
    const c = s.add.container(0, 0);
    const water = s.add.graphics();
    water.fillStyle(0xffffff, 0.55);
    water.fillEllipse(0, 4, 26, 7);
    c.add(water);
    const vest = s.add.graphics();
    vest.fillStyle(0xff7a1a, 1);
    vest.fillRoundedRect(-6, -7, 12, 11, 4);
    vest.fillStyle(0xf2c9a0, 1);
    vest.fillCircle(0, -11, 4.6);
    vest.fillStyle(0x5a3a22, 1);
    vest.fillEllipse(0, -14.5, 9, 4);
    c.add(vest);
    for (const side of [-1, 1]) {
      const arm = s.add.graphics();
      arm.lineStyle(2.6, 0xf2c9a0, 1);
      arm.lineBetween(0, 0, 0, -10);
      arm.setPosition(side * 5, -5);
      arm.setRotation(side * 0.5);
      c.add(arm);
      s.tweens.add({ targets: arm, rotation: side * 1.1, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: side > 0 ? 140 : 0 });
    }
    return c;
  }
}
