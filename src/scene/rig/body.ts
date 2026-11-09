import Phaser from 'phaser';
import type { GuestKind } from '../../config/sports';
import { ATLAS, PIVOT, RES } from './atlas';
import { add, arms, head, len, lerp, mul, PAL, rot, shadowOffset, sub, TAU, v, type Outfit, type Pose, type V } from './geom';
import { BOATS, K, KITE, WIND, type Boat, type Gear } from './models';
import { rigPoint, type Look } from './sim';

export { shadowOffset };

// Draws one guest from its Look: a set of images from the 'rig' atlas, placed every frame (README 4.6 layer order).
// The gear comes from the guest's section (docs/SPORTS.md): its own board, boat, sail size, race number ...

const SH_WATER = [7, 10];
const SH_FLY = [26, 36];

/** An image with the least detail level (0..2) it shows at. */
type Img = Phaser.GameObjects.Image & { lod?: number };

/** Mark small parts: they are skipped when the map is zoomed out (README 4.7). */
function lod<T extends Img | undefined>(im: T, level: number): T {
  if (im) im.lod = level;
  return im;
}

export type BodyKind = GuestKind | 'player' | 'jetski' | 'committee';

export interface BodyOpts {
  kind: BodyKind;
  outfit: Outfit;
  /** Sail, kite or wing colour. */
  color: number;
  /** The section's gear (board frame, sail size ...). */
  gear?: Gear;
  /** Race number on the sail (0..9), or -1. */
  number?: number;
  /** Base depth of this guest; its parts stack just above it. */
  depth: number;
  /** Depth of the shadows (below every guest of the zone). */
  shadowDepth: number;
  /** Depth of kites (above everything in the zone). */
  skyDepth: number;
  /** World px per spec px. */
  k?: number;
  /** Extra people on board (crew of a catamaran or a yacht). */
  crew?: Outfit[];
}

const BOARD: Partial<Record<BodyKind, string>> = {
  surfer: 'b-surf',
  skimmer: 'b-skim',
  windsurfer: 'b-wind',
  kiter: 'b-kite',
  foiler: 'b-foil',
  sailor: 'b-hull',
  jetski: 'b-jetski',
  committee: 'b-committee',
};

function lightenNum(n: number, k: number): number {
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * k));
  return (ch[0] << 16) | (ch[1] << 8) | ch[2];
}

/** The images of one person: legs, feet, arms, torso (with stripe/straps/piping), head, hair, hands. */
interface RiderParts {
  out: Outfit;
  legs: Img[];
  feet: Img[];
  body?: Img;
  arms: Img[];
  torso: Img;
  stripe?: Img;
  vest?: Img;
  harness?: Img;
  skin: Img;
  hair: Img;
  extra: Img[];
  tie?: Img;
  helmet?: Img;
  helmetStripe?: Img;
  hands: Img[];
  shadow: Img;
}

export class GuestBody {
  private scene: Phaser.Scene;
  private o: BodyOpts;
  private k: number;
  private layer = 0;
  private all: Img[] = [];
  private boat?: Boat;
  private boardFrame?: string;
  // shadows
  private shBoard?: Img;
  private shGear?: Img;
  private shKite?: Img;
  // board and deck
  private board?: Img;
  private tips?: Img;
  private straps: Img[] = [];
  // people
  private rider!: RiderParts;
  private crew: RiderParts[] = [];
  // gear
  private sail?: Img;
  private sailHi?: Img;
  private sailWin?: Img;
  private sailNum?: Img;
  private boom?: Img;
  private spin?: Img;
  private sheets: Img[] = [];
  private wing?: Img;
  private wingWin?: Img;
  private bar?: Img;
  private lines: Img[] = [];
  private tow?: Img;
  private kite?: Img;
  private visible = true;
  private look!: Look;
  /** 2 = everything, 1 = no hands, feet and small details, 0 = board, body, head and gear only. */
  private detail = 2;

  constructor(scene: Phaser.Scene, o: BodyOpts) {
    this.scene = scene;
    this.o = o;
    this.k = o.k ?? K;
    const kind = o.kind;
    const gear = o.gear;
    const out = o.outfit;
    this.boat = gear?.boat ? BOATS[gear.boat] : kind === 'sailor' ? BOATS.dinghy : undefined;
    this.boardFrame = gear?.board ?? BOARD[kind];
    const gearColor = gear?.color ? parseInt(gear.color.slice(1), 16) : o.color;
    // shadows first (their own depth)
    if (this.boardFrame) this.shBoard = this.shadow(this.boardFrame, 0.22);
    if (kind === 'windsurfer') this.shGear = this.shadow('wsail', 0.14);
    if (kind === 'sailor') this.shGear = this.shadow('dsail', 0.15);
    if (kind === 'foiler') this.shGear = this.shadow('wing', 0.12);
    if (kind === 'kiter') this.shKite = this.shadow('kite', 0.1);
    // board and deck
    if (this.boardFrame) {
      const tint = gear?.tintBoard ? (this.boardFrame === 'b-long' ? lightenNum(o.color, 0.55) : lightenNum(o.color, 0.1)) : undefined;
      this.board = this.img(this.boardFrame, tint);
    }
    if (kind === 'kiter' && this.boardFrame === 'b-kite') this.tips = this.img('b-kite-tips', o.color);
    if (kind === 'windsurfer') this.straps = [this.img('strap'), this.img('strap')];
    if (kind === 'surfer') this.tow = this.img('line', 0xf5f5f5);
    // crew sit under the boom
    for (const c of o.crew ?? []) this.crew.push(this.person(c, false, true));
    // the main person: legs and feet first; sail and boom go between the legs and the arms
    this.rider = this.person(out, kind === 'surfer', false, () => {
      if (kind === 'windsurfer') {
        this.sail = this.img('wsail', gearColor);
        if (gear?.window) this.sailWin = this.img('wsail-win');
        this.sailHi = this.img('wsail-hi');
        if (gear?.number && (o.number ?? -1) >= 0) this.sailNum = this.img(`num-${o.number}`);
        this.boom = this.img('wboom');
      }
      if (kind === 'sailor') {
        this.sheets = [this.img('line', PAL.metal), this.img('line', PAL.metal), this.img('line', PAL.navy)];
        this.sail = this.img('dsail', gearColor);
        this.sailHi = this.img('dsail-hi');
        if (gear?.number && (o.number ?? -1) >= 0) this.sailNum = this.img(`num-${o.number}`);
        this.boom = this.img('dboom');
        if (gear?.boat === 'yacht') this.spin = this.img('spin', lightenNum(o.color, 0.15));
      }
      if (kind === 'kiter') this.bar = this.img('bar');
    });
    if (kind === 'foiler') {
      this.wing = this.img('wing', lightenNum(gearColor, 0.38));
      this.wingWin = this.img('wing-win');
    }
    if (kind === 'kiter') {
      this.lines = [this.sky('line', PAL.line), this.sky('line', PAL.line)];
      this.kite = this.sky('kite', gearColor);
    }
    for (const im of [...this.straps, ...this.sheets, this.sailHi, this.sailWin, this.sailNum, this.wingWin, this.bar, this.tips]) lod(im, 2);
    for (const im of [this.boom, this.shGear, this.shKite, this.tow, ...this.lines]) lod(im, 1);
  }

  /** Make the images of one person. `between` adds images between the legs and the arms (sails, the kite bar). */
  private person(out: Outfit, prone: boolean, seated: boolean, between?: () => void): RiderParts {
    const kind = this.o.kind;
    const shadow = this.shadow('disc', kind === 'player' ? 0.18 : 0.16);
    const legs = [this.img('limb', out.legs), this.img('limb', out.legs)];
    const feet = [this.img('foot', out.skinShade), this.img('foot', out.skinShade)];
    const body = prone ? this.img('torso', out.top) : undefined;
    between?.();
    const arms = [this.img('limb', out.skin), this.img('limb', out.skin)];
    const torso = this.img('torso', out.top);
    const stripe = out.stripe >= 0 ? this.img('stripe', out.stripe) : undefined;
    const vest = out.straps ? this.img('straps') : undefined;
    const harness = kind === 'player' ? this.img('piping', 0xffffff) : kind === 'kiter' ? this.img('piping', out.accent) : undefined;
    const skin = this.img('disc', out.skin);
    let extra: Img[] = [];
    let tie: Img | undefined;
    if (out.style === 'ponytail') {
      extra = [this.img('disc', out.hair)];
      tie = this.img('disc', out.accent);
    } else if (out.style === 'bun') extra = [this.img('disc', out.hair)];
    else if (out.style === 'curls') extra = [0, 1, 2, 3].map(() => this.img('disc', out.hair));
    const hair = this.img('disc', out.hair);
    const helmet = out.helmet ? this.img('helmet') : undefined;
    const helmetStripe = out.helmet ? this.img('helmetStripe', out.accent) : undefined;
    const hands = [this.img('disc', out.skinShade), this.img('disc', out.skinShade)];
    for (const im of [...feet, ...hands, ...extra, tie, helmetStripe, vest, stripe, harness, shadow]) lod(im, 2);
    for (const im of [...legs, ...arms, body]) lod(im, 1);
    void seated;
    return {
      out,
      legs,
      feet,
      body,
      arms,
      torso,
      stripe,
      vest,
      harness,
      skin,
      hair,
      extra,
      tie,
      helmet,
      helmetStripe,
      hands,
      shadow,
    };
  }

  private img(frame: string, tint?: number): Img {
    const im = this.scene.add.image(0, 0, ATLAS, frame);
    const p = PIVOT.get(frame)!;
    im.setOrigin(p.ox, p.oy).setDepth(this.o.depth + this.layer++ * 0.0001);
    if (tint !== undefined) im.setTint(tint);
    this.all.push(im);
    return im;
  }

  private shadow(frame: string, alpha: number): Img {
    const im = this.scene.add.image(0, 0, ATLAS, frame);
    const p = PIVOT.get(frame)!;
    im.setOrigin(p.ox, p.oy).setDepth(this.o.shadowDepth).setTint(PAL.shadow).setTintMode(Phaser.TintModes.FILL).setAlpha(alpha);
    im.setData('a', alpha);
    this.all.push(im);
    return im;
  }

  private sky(frame: string, tint: number): Img {
    const im = this.scene.add.image(0, 0, ATLAS, frame);
    const p = PIVOT.get(frame)!;
    im.setOrigin(p.ox, p.oy)
      .setDepth(this.o.skyDepth + this.layer++ * 0.0001)
      .setTint(tint);
    this.all.push(im);
    return im;
  }

  setVisible(on: boolean) {
    if (on === this.visible) return;
    this.visible = on;
    for (const im of this.all) im.setVisible(on);
  }

  destroy() {
    for (const im of this.all) im.destroy();
    this.all = [];
  }

  // ---------------------------------------------------------------- placing

  /** Model frame -> world. */
  private w(p: V): V {
    const L = this.look;
    const s = this.k * L.scale;
    const c = Math.cos(L.h);
    const sn = Math.sin(L.h);
    return {
      x: L.x + (p.x * c - p.y * sn) * s,
      y: L.y + (p.x * sn + p.y * c) * s,
    };
  }

  /** Put an image at a model-frame point, turned by `r` (model frame) and scaled (spec px). */
  private put(im: Img | undefined, p: V, r: number, sx: number, sy: number, alpha = 1) {
    if (!im) return;
    if ((im.lod ?? 0) > this.detail) {
      im.setVisible(false);
      return;
    }
    const L = this.look;
    const at = this.w(p);
    const s = (this.k * L.scale) / RES;
    im.setPosition(at.x, at.y)
      .setRotation(L.h + r)
      .setScale(sx * s, sy * s)
      .setAlpha(alpha * L.alpha)
      .setVisible(alpha > 0.01 && this.visible);
  }

  /** Same as `put` for a shadow: moved by the world offset of the light. */
  private putShadow(im: Img | undefined, p: V, r: number, sx: number, sy: number, off: V, alpha = 1) {
    if (!im) return;
    this.put(im, p, r, sx, sy, alpha);
    im.setPosition(im.x + off.x * this.look.scale, im.y + off.y * this.look.scale).setAlpha(im.getData('a') * alpha * this.look.alpha);
  }

  private limb(im: Img, a: V, b: V, width: number, alpha = 1) {
    const d = sub(b, a);
    this.put(im, a, Math.atan2(d.y, d.x), Math.max(0.01, len(d) / 64), width / 16, alpha);
  }

  /** A thin line between two world points. */
  private lineW(im: Img, a: V, b: V, width: number, alpha = 1) {
    if ((im.lod ?? 0) > this.detail || alpha <= 0.01) {
      im.setVisible(false);
      return;
    }
    const d = sub(b, a);
    const s = this.k / RES;
    im.setPosition(a.x, a.y)
      .setRotation(Math.atan2(d.y, d.x))
      .setScale(len(d) / 64 / RES, (width / 4) * s)
      .setAlpha(this.look.alpha * alpha)
      .setVisible(this.visible);
  }

  private hide(im?: Img) {
    im?.setVisible(false);
  }

  // ---------------------------------------------------------------- drawing

  draw(L: Look, t: number, detail = 2) {
    this.look = L;
    this.detail = detail;
    if (!this.visible) return;
    const lift = Math.min(1.6, L.lift);
    const off = (base: number[], fly: number[] = SH_FLY) => shadowOffset(lerp(base[0], fly[0], lift), lerp(base[1], fly[1], lift), this.k);
    const B = L.board;

    // board / hull and its shadow
    if (this.board) {
      const heel = shadowOffset(L.heel, 0, this.k);
      this.putShadow(this.shBoard, B.at, B.rot, B.sx, B.sy, add(off(SH_WATER), heel), B.alpha);
      this.put(this.board, B.at, B.rot, B.sx, B.sy, B.alpha);
      if (this.tips) this.put(this.tips, B.at, B.rot, B.sx, B.sy, B.alpha);
    }

    // crew (they sit in the boat, under the sail)
    this.crew.forEach((c, i) => {
      const P = L.crew[i];
      if (P) this.drawPerson(c, P, 1, L.riderAlpha, off, false);
      else this.hidePerson(c);
    });

    const P = L.rider;
    if (!P) {
      this.hidePerson(this.rider);
      if (this.sail) this.drawRig(L, t, off);
      return;
    }
    const rs = L.riderScale * (this.o.gear?.rider ?? 1);
    this.drawPerson(this.rider, P, rs, L.riderAlpha, off, true, () => {
      if (this.sail) this.drawRig(L, t, off);
      else {
        this.hide(this.spin);
      }
      if (this.bar && L.bar) {
        const R = (p: V) => (rs === 1 ? p : add(P.t, mul(sub(p, P.t), rs)));
        this.put(this.bar, R(L.bar.at), L.bar.rot, rs, rs, L.riderAlpha);
      }
    });

    // tow rope (Nazaré): from the front hand to the jet ski
    if (this.tow) {
      if (L.tow) this.lineW(this.tow, this.w(P.hands[0]), L.tow, 2.2);
      else this.hide(this.tow);
    }

    // the wing goes over the hands
    if (this.wing && L.wing) {
      const W = L.wing;
      const sx = (W.flip ? -1 : 1) * W.scale;
      this.putShadow(this.shGear, W.at, W.rot, sx, W.scale, off([28, 38], [40, 52]));
      this.put(this.wing, W.at, W.rot, sx, W.scale, W.alpha ?? 1);
      this.put(this.wingWin, W.at, W.rot, sx, W.scale, W.alpha ?? 1);
    }

    // kite lines and kite, high above everything
    if (this.kite && L.kite && L.bar) {
      const Kt = L.kite;
      const ks = (this.k * Kt.scale) / RES;
      this.kite.setPosition(Kt.x, Kt.y).setRotation(Kt.rot).setScale(ks, ks).setAlpha(L.alpha).setVisible(this.visible);
      const sh = shadowOffset(18 + 20 * Kt.alt, 64 * Kt.alt, this.k);
      this.shKite!.setPosition(Kt.x + sh.x, Kt.y + sh.y)
        .setRotation(Kt.rot)
        .setScale(ks, ks)
        .setAlpha(0.1 * L.alpha)
        .setVisible(this.visible && detail >= 1);
      const tip = (p: V) => {
        const q = rot(mul(p, this.k * Kt.scale), Kt.rot);
        return v(Kt.x + q.x, Kt.y + q.y);
      };
      const R = (p: V) => (rs === 1 ? p : add(P.t, mul(sub(p, P.t), rs)));
      const tA = tip(KITE.tips[0]);
      const tB = tip(KITE.tips[1]);
      const e1 = this.w(R(add(L.bar.at, rot(v(-20, 0), L.bar.rot))));
      const e2 = this.w(R(add(L.bar.at, rot(v(20, 0), L.bar.rot))));
      const straight = len(sub(tA, e1)) + len(sub(tB, e2)) <= len(sub(tA, e2)) + len(sub(tB, e1));
      this.lineW(this.lines[0], tA, straight ? e1 : e2, 1.6, Kt.lines ?? 1);
      this.lineW(this.lines[1], tB, straight ? e2 : e1, 1.6, Kt.lines ?? 1);
    }
  }

  private hidePerson(c: RiderParts) {
    for (const im of [...c.legs, ...c.feet, c.body, ...c.arms, c.torso, c.stripe, c.vest, c.harness, c.skin, c.hair, ...c.extra, c.tie, c.helmet, c.helmetStripe, ...c.hands, c.shadow])
      im?.setVisible(false);
  }

  /** Draw one person from a pose. `between` draws what goes between the legs and the arms. */
  private drawPerson(c: RiderParts, P: Pose, rs: number, ra: number, off: (b: number[], f?: number[]) => V, main: boolean, between?: () => void) {
    const kind = this.o.kind;
    // the person shrinks around the torso (kids, going under in a wipeout)
    const R = (p: V) => (rs === 1 ? p : add(P.t, mul(sub(p, P.t), rs)));
    const shR = kind === 'player' ? [8, 10] : [10, 12];
    this.putShadow(c.shadow, R(P.t), P.rot, ((P.rx + 4) / 32) * rs, ((P.ry + 5) / 32) * rs, off(shR), ra);

    // windsurf straps under the feet
    if (main && this.straps.length) {
      this.put(this.straps[0], P.feet[0], 0, 1, 1, ra * P.legs);
      this.put(this.straps[1], P.feet[1], 0, 1, 1, ra * P.legs);
    }
    // legs and feet
    const legA = P.legs * ra;
    for (let i = 0; i < 2; i++) {
      const from = R(add(P.hips, i === 0 ? P.legSpread : mul(P.legSpread, -1)));
      this.limb(c.legs[i], from, R(P.feet[i]), P.legW * rs, legA);
      const fa = Math.atan2(P.face.y, P.face.x);
      if (P.foot.x > 0) this.put(c.feet[i], R(P.feet[i]), fa, (P.foot.x / 8) * rs, (P.foot.y / 6) * rs, legA);
      else c.feet[i].setVisible(false);
    }
    // the lower body of a rider lying on the board
    if (c.body) {
      const at = R(add(P.t, rot(v(0, 22), P.rot)));
      this.put(c.body, at, P.rot, (14 / 32) * rs, (22 / 32) * rs, P.body * ra);
    }
    between?.();

    // arms, torso, head, hands
    const [a1, a2] = arms(P);
    this.limb(c.arms[0], R(a1[0]), R(a1[1]), 9 * rs, ra);
    this.limb(c.arms[1], R(a2[0]), R(a2[1]), 9 * rs, ra);
    const out = c.out;
    const tsx = ((P.rx * out.bulk) / 32) * rs;
    const tsy = ((P.ry * out.bulk) / 32) * rs;
    const T = R(P.t);
    this.put(c.torso, T, P.rot, tsx, tsy, ra);
    if (c.stripe) {
      // the stripe goes over the front shoulder: mirror it with the rider
      const flip = P.face.x * Math.cos(P.rot) + P.face.y * Math.sin(P.rot) < 0 ? -1 : 1;
      this.put(c.stripe, T, P.rot, tsx * flip, tsy, ra);
    }
    if (c.vest) this.put(c.vest, T, P.rot, tsx, tsy, ra);
    if (c.harness) {
      // forward torso: the piping on the back (away from the face)
      const r = Math.atan2(P.face.y, P.face.x) + Math.PI / 2;
      this.put(c.harness, T, r, (Math.max(P.rx, P.ry) / 32) * rs, (Math.min(P.rx, P.ry) / 32) * rs, ra);
    }
    const hd = head(P);
    const hs = R(hd.skin);
    const hh = R(hd.hair);
    const big = kind === 'player' ? 13 : P.body > 0.5 ? 11.5 : 12.5;
    this.put(c.skin, hs, 0, (big / 32) * rs, (big / 32) * rs, ra);
    const back = mul(P.face, -1);
    if (c.helmet) {
      c.hair.setVisible(false);
      for (const e of c.extra) e.setVisible(false);
      c.tie?.setVisible(false);
      const fa = Math.atan2(P.face.y, P.face.x) + Math.PI / 2;
      this.put(c.helmet, hh, fa, rs, rs, ra);
      this.put(c.helmetStripe, hh, fa, rs, rs, ra);
    } else {
      if (out.style === 'ponytail') {
        this.put(c.extra[0], R(add(hd.hair, mul(back, 14))), Math.atan2(P.face.y, P.face.x), (8 / 32) * rs, (5 / 32) * rs, ra);
        this.put(c.tie, R(add(hd.hair, mul(back, 10))), 0, (3 / 32) * rs, (3 / 32) * rs, ra);
      } else if (out.style === 'bun') this.put(c.extra[0], R(add(hd.hair, mul(back, 13))), 0, (6 / 32) * rs, (6 / 32) * rs, ra);
      else if (out.style === 'curls') {
        const side = v(-P.face.y, P.face.x);
        const spots = [
          [8, -2],
          [-8, -2],
          [6, 6],
          [-6, 6],
        ];
        spots.forEach(([sx, bk], i) => this.put(c.extra[i], R(add(hd.hair, add(mul(side, sx), mul(back, bk)))), 0, (6 / 32) * rs, (6 / 32) * rs, ra));
      }
      const hr = out.style === 'curls' ? 10.5 : big - 0.5;
      this.put(c.hair, hh, 0, (hr / 32) * rs, (hr / 32) * rs, ra);
    }
    this.put(c.hands[0], R(P.hands[0]), 0, (5.5 / 32) * rs, (5.5 / 32) * rs, ra);
    this.put(c.hands[1], R(P.hands[1]), 0, (5.5 / 32) * rs, (5.5 / 32) * rs, ra);
  }

  private drawRig(L: Look, t: number, off: (b: number[], f?: number[]) => V) {
    const kind = this.o.kind;
    const gear = this.o.gear;
    const a = L.rig;
    const side = a < 0 ? -1 : 1;
    const wind = kind === 'windsurfer';
    const boat = this.boat;
    const drawn = wind ? WIND.drawnAngle : Math.atan2(98, 190);
    const pivot = wind ? WIND.mast : boat!.mast;
    const size = (wind ? (gear?.sail ?? 1) : boat!.sail) * L.rigScale;
    const r = side * (drawn - Math.abs(a));
    // flutter: a steady breathing of the sail, a fast flap when it luffs
    const ph = t * TAU;
    const flut = 1 + 0.03 * Math.sin(ph * 1.3) + L.luff * 0.14 * Math.sin(ph * 6 + 1);
    const sx = side * flut * size;
    const sy = size;
    const al = L.rigAlpha;
    this.putShadow(this.shGear, pivot, r, sx, sy, off([28, 38]), al);
    this.put(this.sail, pivot, r, sx, sy, al);
    this.put(this.sailWin, pivot, r, sx, sy, al);
    this.put(this.sailHi, pivot, r, sx, sy, al * (1 - L.luff * 0.6));
    this.put(this.boom, pivot, r, side * size, sy, al);
    if (this.sailNum) {
      // the number sits on the sail, upright to the boom
      const at = add(pivot, mul(rigPoint(wind ? v(96, 120) : v(58, 104), drawn, a), size));
      this.put(this.sailNum, at, r + side * 0.3, 1.4 * size, 1.4 * size, al);
    }
    if (this.spin) {
      // the spinnaker flies in front of the bow, out to the side the boom is on
      const S = L.spin;
      if (S) this.put(this.spin, S.at, S.rot, (S.flip ? -1 : 1) * S.scale, S.scale, S.alpha);
      else this.hide(this.spin);
    }
    if (kind === 'sailor' && L.rider && boat) {
      // mainsheet: boom end -> block -> the sailor's front hand; tiller extension to the back hand
      const end = add(boat.mast, mul(rigPoint(v(98, 190), drawn, a), boat.sail));
      const P = L.rider;
      const W = (p: V) => this.w(p);
      this.lineW(this.sheets[0], W(end), W(boat.block), 1.8);
      this.lineW(this.sheets[1], W(boat.block), W(P.hands[0]), 1.8);
      this.lineW(this.sheets[2], W(boat.tiller), W(P.hands[1]), 3);
    }
  }
}
