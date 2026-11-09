import Phaser from 'phaser';
import type { GuestKind, ZoneRef } from '../../config/sports';
import { DEPTH } from '../background';
import { ATLAS, PIVOT, RES } from './atlas';
import { GuestBody, type BodyKind } from './body';
import { hexToNum, outfit, type Outfit } from './geom';
import type { FxPool } from './fx';
import { BOATS, gearFor, visibleGuests, type Gear } from './models';
import { newGuest, relax, WIND_FROM, type Guest, type Zone } from './sim';
import { raceCourse } from './sports/sail';
import { stepGuest, stepZone } from './step';
import { WaveView } from './waveView';

/** The outfit of a guest, with what the section's gear adds (helmets, impact vests, life vests). */
function dress(kind: GuestKind | 'jetski' | 'committee', i: number, level: number, color: string, gear?: Gear): Outfit {
  const sailing = kind === 'sailor';
  let o = outfit(i, level, color, {
    vest: sailing && gear?.boat !== 'yacht' ? '#FFCA28' : undefined,
    helmet: !!gear?.helmet,
  });
  if (gear?.vest)
    o = {
      ...o,
      top: hexToNum(gear.vest),
      stripe: -1,
      straps: false,
      bulk: 1.06,
    };
  if (gear?.boat === 'yacht')
    o = {
      ...o,
      top: i % 2 ? 0xd32f2f : 0x1b1f24,
      stripe: -1,
      straps: false,
      bulk: 1.1,
    };
  if (kind === 'jetski')
    o = {
      ...outfit(i, 4, '#FF5A1F'),
      top: 0xff5a1f,
      stripe: -1,
      helmet: true,
      straps: false,
      bulk: 1.08,
    };
  if (kind === 'committee')
    o = {
      ...outfit(i, 2, '#FFFFFF'),
      top: 0xfafafa,
      stripe: -1,
      straps: false,
      bulk: 1,
    };
  return o;
}

/** The guests of one water zone: their simulation and their bodies. */
export class Crew {
  private zone: Zone;
  private guests: Guest[] = [];
  private bodies: GuestBody[] = [];
  private extraBodies: GuestBody[] = [];
  private kind: GuestKind;
  private wave?: WaveView;
  private buoys: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    private ref: ZoneRef,
    private fx: FxPool,
    rect: { x: number; y: number; w: number; h: number },
  ) {
    this.kind = ref.sport.guestKind;
    const level = Math.min(4, ref.level);
    this.zone = {
      ...rect,
      level,
      active: false,
      t: 0,
      windFrom: WIND_FROM,
      guests: this.guests,
      fx: [],
      marks: [],
      extras: [],
      s: {},
    };
    if (this.kind === 'sailor') raceCourse(this.zone);
    if (this.kind === 'surfer' && level >= 3) this.wave = new WaveView(scene, this.zone);
  }

  private body(kind: BodyKind, i: number, color: string, gear: Gear | undefined, depth: number): GuestBody {
    const crewSeats = gear?.boat ? BOATS[gear.boat].seats.length - 1 : 0;
    const crew = Array.from({ length: crewSeats }, (_, k) => dress(this.kind, i * 7 + k + 3, this.zone.level, color, gear));
    return new GuestBody(this.scene, {
      kind,
      outfit: dress(kind === 'jetski' || kind === 'committee' ? kind : this.kind, i, this.zone.level, color, gear),
      color: hexToNum(color),
      gear,
      number: gear?.number ? (i * 3 + 1) % 10 : -1,
      depth,
      shadowDepth: DEPTH.things - 0.2,
      skyDepth: DEPTH.things + 0.6,
      crew,
    });
  }

  /** Make sure there are `n` guests (more come in at their waiting spots). */
  private ensure(n: number) {
    while (this.guests.length < n) {
      const i = this.guests.length;
      const g = newGuest(this.kind, i, this.zone, n);
      this.guests.push(g);
      const colors = this.ref.sport.guestColors;
      this.bodies.push(this.body(this.kind, i, colors[i % colors.length], gearFor(this.kind, this.zone.level, i), DEPTH.things + 0.01 + i * 0.005));
    }
    // helpers of the section (jet skis, committee boat) get a body when they appear
    while (this.extraBodies.length < this.zone.extras.length) {
      const e = this.zone.extras[this.extraBodies.length];
      const frame = e.kind === 'jetski' ? 'b-jetski' : 'b-committee';
      this.extraBodies.push(this.body(e.kind as BodyKind, e.i, '#FFFFFF', { board: frame, sail: 1, rider: 1 }, DEPTH.things + 0.07 + this.extraBodies.length * 0.004));
    }
  }

  /** `detail`: 2 close up, 1 zoomed out (no small parts, only wake marks), 0 far away (no particles). */
  update(dt: number, timeS: number, active: boolean, guests: number, near: boolean, detail = 2) {
    const n = Math.min(guests, visibleGuests(this.kind, this.zone.level));
    const z = this.zone;
    z.active = active;
    z.t = timeS;
    // only the guests in use take part (the list is shared with the simulation for spacing)
    if (z.guests.length !== n) z.guests = this.guests.slice(0, n);
    this.ensure(n);
    if (z.guests.length !== n) z.guests = this.guests.slice(0, n);
    if (n > 0) stepZone(z, this.kind, dt);
    this.ensure(n);
    // far away: the simulation keeps going, nothing is drawn
    for (let i = 0; i < n; i++) stepGuest(this.guests[i], z, n, dt);
    relax(z, this.kind);
    if (near && detail === 2) this.fx.add(z.fx);
    else if (near && detail === 1) this.fx.add(z.fx.filter((f) => f.k === 'wake'));
    z.fx.length = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const on = near && i < n;
      b.setVisible(on);
      if (on) b.draw(this.guests[i].look, timeS, detail);
    }
    for (let i = 0; i < this.extraBodies.length; i++) {
      const b = this.extraBodies[i];
      const on = near && n > 0;
      b.setVisible(on);
      if (on) b.draw(z.extras[i].look, timeS, detail);
    }
    this.wave?.draw(near && n > 0, timeS);
    // the yellow slalom buoys, bobbing
    if (z.buoys && this.buoys.length === 0) {
      const p = PIVOT.get('buoy-y')!;
      for (const b of z.buoys) this.buoys.push(this.scene.add.image(b.x, b.y, ATLAS, 'buoy-y').setOrigin(p.ox, p.oy).setScale((0.125 * 1.2) / RES).setDepth(DEPTH.things - 0.15));
    }
    this.buoys.forEach((im, i) => {
      im.setVisible(near && n > 0);
      if (near) im.setPosition(z.buoys![i].x, z.buoys![i].y + Math.sin(timeS * 2 + i) * 0.4);
    });
  }
}
