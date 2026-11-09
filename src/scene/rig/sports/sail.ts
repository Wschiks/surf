// Sailing, four sections (docs/SPORTS.md 6):
// 1 School: kids in Optimists follow the leader in a line like ducklings, slowly; now and then one capsizes.
// 2 Boat hire: dinghies and catamarans wander where they like and stop now and then; catamarans fly a hull.
// 3 Club racing: the fleet waits behind a start line at the committee boat, starts together, races round the buoys.
// 4 Offshore regatta: three big yachts with crews race a long course; downwind the spinnaker goes up.

import { angleTo, clamp, clamp01, DEG, dir, hash01, lerp, lerpPose, mirrorPose, shiftPose, smooth, v, type Pose, type V } from '../geom';
import { BOATS, FORWARD, SAIL } from '../models';
import { alive, baseLook, ease, headingTo, keepIn, move, newGuest, pointOfSail, ring, setState, sheetAngle, spray, steer, wake, windSide, type Guest, type Zone } from '../sim';

/** The race course of a sailing zone (Club racing uses its real buoys, drawn by the ocean view). */
export function raceCourse(z: Zone) {
  const at = (fx: number, fy: number) => v(z.x + z.w * fx, z.y + z.h * fy);
  if (z.level === 3) z.marks = [at(0.5, 0.86), at(0.88, 0.2), at(0.5, 0.2), at(0.12, 0.2)];
  else if (z.level === 4) z.marks = [at(0.15, 0.25), at(0.3, 0.85), at(0.7, 0.85), at(0.88, 0.5), at(0.6, 0.18)];
  else if (z.level === 1) z.marks = [at(0.2, 0.3), at(0.5, 0.72), at(0.8, 0.3), at(0.5, 0.18)];
  else z.marks = [at(0.14, 0.26), at(0.52, 0.8), at(0.86, 0.26)];
  z.obstacles = [];
}

/** Speed for the point of sail: nothing head to wind, best on a beam reach. */
function polar(pos: number) {
  return pos > 140 * DEG ? 0.08 : pos > 128 * DEG ? lerp(0.75, 0.08, (pos - 128 * DEG) / (12 * DEG)) : pos > 90 * DEG ? lerp(1, 0.75, (pos - 90 * DEG) / (38 * DEG)) : lerp(0.75, 1, pos / (90 * DEG));
}

/** Steer toward a point the way a boat can: upwind it beats (zig-zag, tacking at the layline or the edge). */
function sailTo(g: Guest, z: Zone, tx: number, ty: number, keep: number, dt: number, turnRate = 55 * DEG): number {
  const wf = z.windFrom;
  const bearing = headingTo(g, z, tx, ty, keep);
  const rel = angleTo(wf, bearing);
  let target = bearing;
  if (Math.abs(rel) < 48 * DEG) {
    const edge = g.x < z.x + 34 || g.x > z.x + z.w - 34 || g.y > z.y + z.h - 24;
    if ((Math.sign(rel) === -g.m.tack && Math.abs(rel) > 30 * DEG) || (edge && (g.m.tackT ?? 0) <= 0)) {
      g.m.tack = -g.m.tack;
      g.m.tackT = 3;
      g.count++;
    }
    target = wf + g.m.tack * 50 * DEG;
  }
  g.m.tackT = (g.m.tackT ?? 0) - dt;
  steer(g, target, turnRate, dt, 2.5);
  return polar(pointOfSail(g.h, wf));
}

/** Seated sailor on a seat (drawn on the port side, `side` +1 mirrors to starboard), hiking out `hike` px. */
function seated(seat: V, side: number, hike: number): Pose {
  const base = shiftPose(SAIL.sailor, v(seat.x - SAIL.sailor.t.x - hike, seat.y - SAIL.sailor.t.y));
  return side > 0 ? mirrorPose(base) : base;
}

export function sail(g: Guest, z: Zone, _n: number, dt: number) {
  const t = z.t;
  const lvl = z.level;
  const L = baseLook(g, t);
  const wf = z.windFrom;
  const boat = BOATS[g.gear.boat ?? 'dinghy'];
  const cat = g.gear.boat === 'cat';
  const yacht = g.gear.boat === 'yacht';
  if (g.m.mark === undefined) {
    g.m.mark = lvl === 1 ? 0 : g.i % z.marks.length;
    g.m.tack = g.i % 2 ? 1 : -1;
    g.m.side = 1;
    g.m.cross = 0;
    g.m.boom = 0;
  }
  const pace = (lvl === 1 ? 9 : lvl === 2 ? (cat ? 22 : 14) : lvl === 3 ? 19 : 17) * (0.94 + 0.12 * hash01(g.i, 3));
  let speedK = 0;
  let stopped = false;
  if (!z.active) {
    // waiting: head to wind, the sail flapping
    steer(g, wf + (g.i % 2 ? 1 : -1) * 20 * DEG, 30 * DEG, dt);
    ease(g, 0, 0.8, dt);
  } else if (g.state === 'capsize') {
    // over on its side, the sail flat on the water; then the kid stands on the daggerboard and pulls it back up
    ease(g, 0, 3, dt);
    if (g.st >= g.dur) setState(g, 'sail');
  } else if (lvl === 1) {
    // ducklings: the first boat sails the course, every other one follows the boat in front
    let tx: number;
    let ty: number;
    if (g.i === 0) {
      const mk = z.marks[g.m.mark];
      tx = mk.x;
      ty = mk.y;
      if (Math.hypot(tx - g.x, ty - g.y) < 16) g.m.mark = (g.m.mark + 1) % z.marks.length;
    } else {
      const lead = z.guests[g.i - 1];
      const back = dir(lead.h + Math.PI);
      tx = lead.x + back.x * 34;
      ty = lead.y + back.y * 34;
    }
    const before = g.count;
    speedK = sailTo(g, z, tx, ty, 30, dt, 40 * DEG);
    const d = Math.hypot(tx - g.x, ty - g.y);
    speedK *= g.i === 0 ? 1 : clamp(d / 24, 0.3, 1.25);
    if (g.count !== before && hash01(g.i, g.count, 4) < 0.18) {
      setState(g, 'capsize', 2.6);
      ring(g, z, v(0, 0), 1);
      spray(g, z, v(0, 0), 60, 0, 0.3, 16);
    }
  } else if (lvl === 2) {
    // boat hire: wander from one spot to the next, and now and then just stop and drift for a while
    if (g.state !== 'drift' && g.state !== 'sail') setState(g, 'sail');
    if (g.state === 'drift') {
      steer(g, wf + (g.i % 2 ? 1 : -1) * 15 * DEG, 25 * DEG, dt);
      stopped = true;
      if (g.st >= g.dur) setState(g, 'sail');
    } else {
      const spots = [v(0.15, 0.25), v(0.5, 0.2), v(0.85, 0.3), v(0.8, 0.75), v(0.5, 0.82), v(0.18, 0.7), v(0.5, 0.5)];
      const sp = spots[(g.i * 3 + g.count) % spots.length];
      const tx = z.x + z.w * sp.x;
      const ty = z.y + z.h * sp.y;
      speedK = sailTo(g, z, tx, ty, cat ? 90 : 70, dt);
      if (Math.hypot(tx - g.x, ty - g.y) < 24) {
        g.count++;
        if (hash01(g.i, g.count, 5) < 0.35) setState(g, 'drift', 3 + 3 * hash01(g.i, g.count, 6));
      }
    }
  } else if (lvl === 3) {
    // club racing: a race every 40 s. Wait behind the line (luffing up and down), the horn, then the course.
    const clock = z.s.race ?? 0;
    const lineY = z.y + z.h * 0.2;
    if (clock < 7) {
      // pre-start: mill around just below the line between the committee boat and the pin buoy
      const tx = z.x + z.w * (0.16 + 0.06 * (g.i % 5));
      const ty = lineY - 14 - 8 * (g.i % 2);
      const d = Math.hypot(tx - g.x, ty - g.y);
      speedK = sailTo(g, z, tx, ty, 60, dt) * clamp(d / 30, 0.15, 1);
      g.m.mark = 0;
    } else {
      // the race: round the marks; after the last one, back to the line
      const mk = z.marks[Math.min(g.m.mark, z.marks.length - 1)];
      speedK = sailTo(g, z, mk.x, mk.y, 70, dt);
      if (Math.hypot(mk.x - g.x, mk.y - g.y) < 22 && g.m.mark < z.marks.length - 1) g.m.mark++;
    }
  } else {
    // offshore: the long course round the whole zone
    const mk = z.marks[g.m.mark];
    speedK = sailTo(g, z, mk.x, mk.y, 120, dt, 32 * DEG);
    if (Math.hypot(mk.x - g.x, mk.y - g.y) < 30) g.m.mark = (g.m.mark + 1) % z.marks.length;
  }
  if (z.active && g.state !== 'capsize') ease(g, stopped ? 0 : pace * speedK, yacht ? 0.35 : 0.7, dt);
  move(g, dt);
  keepIn(g, z, yacht ? 26 : 12);
  wake(g, z, boat.wake, yacht ? 4 : 3.2, (yacht ? 1.4 : 0.9) + 0.3 * clamp01(g.speed / 20));

  // the boom: let out downwind, in close-hauled, flapping head to wind (and when stopped); it swings across
  const pos = pointOfSail(g.h, wf);
  const windward = windSide(g.h, wf);
  const luffing = pos > 136 * DEG || stopped || !z.active;
  const want = luffing ? 0 : -windward * sheetAngle(pos, 8 * DEG, 80 * DEG);
  const before = g.m.boom;
  g.m.boom += clamp(want - g.m.boom, -dt * (yacht ? 2 : 4.5), dt * (yacht ? 2 : 4.5));
  const boom = g.m.boom;
  const sideWant = luffing ? g.m.side : windward;
  if (sideWant !== g.m.side && g.m.cross <= 0) {
    g.m.cross = yacht ? 1.2 : 0.6;
    g.m.side = sideWant;
  }
  if (Math.sign(before) !== Math.sign(boom) && Math.abs(before) > 0.3) spray(g, z, v(0, 100), 40, 0, 0.1, 14);
  const crossT = yacht ? 1.2 : 0.6;
  let k = 1;
  if (g.m.cross > 0) {
    g.m.cross = Math.max(0, g.m.cross - dt);
    k = 1 - g.m.cross / crossT;
  }
  const hard = !luffing && pos > 85 * DEG;
  const hike = (lvl >= 3 || cat) && hard ? boat.beam * 0.12 : 0;
  // everyone on board sits on the windward side; crossing over means ducking under the boom
  const people = boat.seats.map((seat) => {
    const from = seated(seat, -g.m.side, hike);
    const to = seated(seat, g.m.side, hike);
    let p = k < 1 ? lerpPose(from, to, smooth(k)) : to;
    if (k < 1) {
      const duck = 1 - 0.1 * Math.sin(Math.PI * k);
      p = { ...p, rx: p.rx * duck, ry: p.ry * duck };
    }
    return alive(p, g, t, 0, 0.3);
  });
  L.rider = people[0];
  L.crew = people.slice(1);
  L.rig = boom === 0 ? 0.0001 : boom;
  L.luff = luffing ? 1 : pos > 128 * DEG ? 0.35 : 0;
  L.board.sx = hike ? 0.97 : 1;
  L.heel = hike ? -windward * (cat ? 9 : 3) : 0;
  if (cat && hard && g.speed > 16) {
    // flying a hull: the windward hull lifts, its shadow moves away
    L.lift = 0.35;
    L.heel = -windward * 14;
    spray(g, z, v(windward * 150, -150), 30, windward, dt, 20);
  }
  if (yacht) {
    // downwind the spinnaker goes up in front of the bow, out to the side of the boom; upwind spray over the bow
    if (!luffing && pos < 70 * DEG) {
      const s = boom < 0 ? -1 : 1;
      L.spin = { at: v(s * 30, -310), rot: s * 0.25, scale: 0.95, alpha: 1, flip: s < 0 };
    }
    if (hard && pos > 110 * DEG) spray(g, z, v(-windward * 60, -300), 26, -windward, dt, 20);
  }
  if (g.state === 'capsize') {
    // on its side: the hull looks narrow, the sail lies flat on the water, the kid is in the water next to it
    const k2 = g.st / g.dur;
    const up = smooth((k2 - 0.6) / 0.4);
    L.board.sx = lerp(0.45, 1, up);
    L.rig = lerp(95 * DEG, 20 * DEG, up) * (g.m.side > 0 ? -1 : 1);
    L.rigAlpha = 0.85;
    L.luff = 1 - up;
    L.rider = { ...FORWARD, t: v(-g.m.side * 70, 30), legs: 0 } as Pose;
  }
  L.x = g.x;
  L.y = g.y;
}

// ---------------------------------------------------------------- the race clock and the committee boat (Club racing)

export function stepRace(z: Zone, dt: number) {
  if (z.level !== 3) return;
  if (!z.active) {
    z.s.race = 0;
    return;
  }
  z.s.race = (z.s.race ?? 0) + dt;
  // the race ends when the leader has rounded everything and is back at the line; then a new start
  const done = z.guests.length > 0 && z.guests.every((g) => g.m.mark >= z.marks.length - 1) && z.s.race > 20;
  if (z.s.race > 7 && (done || z.s.race > 55)) z.s.race = 0;
  if (z.extras.length === 0) {
    const c = newGuest('sailor', 200, z, 1);
    c.kind = 'committee';
    c.x = z.x + z.w * 0.36;
    c.y = z.y + z.h * 0.2;
    c.h = z.windFrom;
    z.extras.push(c);
    z.obstacles = [{ x: c.x, y: c.y, r: 26 }];
  }
}

/** The race officer's boat at the start line: anchored, swinging gently to the wind. */
export function stepCommittee(c: Guest, z: Zone, dt: number) {
  const t = z.t;
  c.st += dt;
  const L = baseLook(c, t);
  c.h = z.windFrom + 0.1 * Math.sin(t * 0.3);
  L.h = c.h + 0.02 * Math.sin(t * 0.8);
  // the officer stands at the stern; at the start the flag comes down (the horn)
  const clock = z.s.race ?? 0;
  const horn = clock > 6.6 && clock < 7.6;
  L.rider = { ...FORWARD, t: v(0, 120), legs: 0, hands: horn ? [v(-10, 80), v(30, 70)] : [v(-28, 136), v(28, 136)] };
  if (horn && Math.floor(clock * 10) % 3 === 0) z.fx.push({ k: 'ring', x: c.x, y: c.y, size: 0.6 });
}
