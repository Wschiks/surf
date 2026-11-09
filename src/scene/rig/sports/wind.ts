import { add, angleTo, mul, clamp01, DEG, easeInOutSine, hash01, lerp, lerpAngle, lerpV, mirrorPose, rot, shiftPose, smooth, sub, TAU, v, wrap, type Pose, type V } from '../geom';
import { WIND } from '../models';
import { alive, baseLook, ease, headingTo, keepIn, move, pointOfSail, rigPoint, ring, setState, sheetAngle, spray, steer, wake, windSide, type Guest, type Zone } from '../sim';

// ---------------------------------------------------------------- windsurfing (4.4.3)
// REACH <-> TACK / GYBE, PLANING, FALL -> UPHAUL

export function windsurf(g: Guest, z: Zone, _n: number, dt: number) {
  const t = z.t;
  const lvl = z.level;
  const L = baseLook(g, t);
  const wf = z.windFrom;
  const reachSpeed = [0, 9, 38, 22, 30][lvl];
  const size = g.gear.sail;
  if (g.m.lane === undefined) {
    g.m.lane = z.y + z.h * (0.2 + 0.4 * ((g.i * 0.618) % 1));
    g.m.dirX = g.i % 2 ? -1 : 1;
  }
  const laneY = lvl === 1 || lvl === 3 ? z.y + z.h * (0.3 + 0.4 * ((g.i * 0.618) % 1)) + (g.m.dirX > 0 ? 0 : 14) : g.m.lane + (g.m.dirX > 0 ? 0 : 26);
  let rigA: number;
  let rider: Pose;
  let luff = 0;

  const standOn = (a: number, plane: number): Pose => {
    // hands on the boom (they follow the sail), feet back in the straps when planing
    const side = a < 0 ? -1 : 1;
    const hands = WIND.boomHands.map((h) => add(WIND.mast, mul(rigPoint(h, WIND.drawnAngle, a), size))) as [V, V];
    // with a smaller sail (school) the rider stands closer to the mast, with a bigger one further back
    const stance = shiftPose(WIND.stand, v(0, (size - 1) * 100));
    const base = side < 0 ? mirrorPose(stance) : stance;
    const back = v(0, 12 * plane);
    const p: Pose = {
      ...base,
      feet: [base.feet[0], add(base.feet[1], back)],
      hands,
    };
    const d = sub(hands[1], hands[0]);
    const r = Math.atan2(-d.x, d.y);
    const lean = -side * (4 + 6 * plane);
    const q = shiftPose({ ...p, rot: r, face: rot(v(side, 0), r) }, v(lean, 4 * plane));
    return alive({ ...q, feet: p.feet }, g, t, 0, 0.4);
  };

  switch (g.state) {
    case 'idle':
    case 'reach': {
      if (!z.active) {
        // waiting: drift slowly head to wind, the sail flapping
        steer(g, wf, 0.6, dt);
        ease(g, 0, 1, dt);
        move(g, dt);
        rigA = windSide(g.h, wf) * -4 * DEG;
        luff = 1;
        rider = standOn(rigA, 0);
        g.state = 'idle';
        break;
      }
      g.state = 'reach';
      // the end of the run: the school and freestyle stay in the middle (short runs), the others use the whole zone
      const margin = lvl === 1 ? 0.24 : lvl === 3 ? 0.3 : 0.11;
      let endX = g.m.dirX > 0 ? z.x + z.w * (1 - margin) : z.x + z.w * margin;
      let ty = laneY;
      let planeWanted = lvl === 1 ? 0 : 1;
      let pace = reachSpeed;
      if (lvl === 2) {
        // slalom: the race clock decides where everyone goes
        const leg = slalomLeg(g, z);
        endX = leg.x;
        ty = leg.y;
        pace = leg.speed;
        planeWanted = leg.speed > 20 ? 1 : 0;
      }
      if (lvl === 4) {
        // wave zone: out through the waves (upwind, jumping), back in riding them (downwind, carving)
        if (g.x < z.x + 40) g.m.dirX = 1;
        if (g.x > z.x + z.w - 40) g.m.dirX = -1;
        ty = g.m.out ? z.y + z.h * 0.9 : z.y + z.h * 0.18;
        endX = g.x + g.m.dirX * 60;
      }
      let target = headingTo(g, z, endX, ty, 56);
      if (lvl === 4 && !g.m.out) target += 38 * DEG * Math.sin(g.st * 3.6 + g.phase * 5);
      // never point into the no-go zone
      const off = angleTo(wf, target);
      if (Math.abs(off) < 55 * DEG) target = wf + (off >= 0 ? 55 : -55) * DEG;
      steer(g, target, lvl === 4 && !g.m.out ? 160 * DEG : 50 * DEG, dt, lvl === 4 ? 4 : 3);
      const pos = pointOfSail(g.h, wf);
      const gust = 0.85 + 0.15 * Math.sin(TAU * 0.07 * t + g.phase * TAU);
      ease(g, pace * gust * (pos > 135 * DEG ? 0.2 : 1), lvl === 2 ? 1.6 : 0.8, dt);
      move(g, dt);
      const side = -windSide(g.h, wf);
      rigA = side * sheetAngle(pos, 14 * DEG, 70 * DEG);
      const plane = planeWanted * clamp01((g.speed - 18) / 8);
      rider = standOn(rigA, plane);
      wake(g, z, WIND.wake, plane > 0.3 ? 2.2 : 3.2, 0.8 + plane * 0.6);
      if (plane > 0.2) spray(g, z, v(side * -30, 150), (lvl === 2 ? 46 : 26) * plane, -side, dt, 24);
      const carve = Math.abs(g.turn) * g.speed;
      if (lvl === 4 && carve > 30) spray(g, z, v(g.turn > 0 ? -40 : 40, 120), carve * 0.9, g.turn > 0 ? -1 : 1, dt, 34);
      // beginners fall in now and then, also without turning
      if (lvl === 1 && g.st > 2 && hash01(g.i, g.count, 9) < 0.3 && !g.m.fell) {
        g.m.fell = 1;
        setState(g, 'fall', 1.4);
        break;
      }
      // wave zone: a jump off a wave every few seconds on the way out; turn at the outside and the inside
      if (lvl === 4) {
        g.m.jumpT = (g.m.jumpT ?? 1.5) - dt;
        if (g.m.out && g.m.jumpT <= 0 && g.speed > 18) {
          g.count++;
          g.m.jumpT = 2 + 1.5 * hash01(g.i, g.count, 3);
          setState(g, 'jump', 1.3);
          g.m.loop = hash01(g.i, g.count, 4) < 0.4 ? 1 : 0;
          break;
        }
        const turn = g.m.out ? g.y > z.y + z.h * 0.8 : g.y < z.y + z.h * 0.26;
        if (turn && g.st > 1) {
          g.m.h0 = g.h;
          g.m.side0 = side;
          g.count++;
          if (g.m.out) setState(g, 'gybe', 0.9);
          else setState(g, 'tack', 1.4);
          g.m.out = g.m.out ? 0 : 1;
        }
        break;
      }
      const atEnd = (g.m.dirX > 0 && g.x > endX - 4) || (g.m.dirX < 0 && g.x < endX + 4);
      if (lvl === 2) {
        // slalom: round a buoy -> next leg; the next target on the other side means a gybe
        slalomProgress(g, z);
        const want = Math.sign(endX - g.x);
        if (want !== 0 && want !== g.m.dirX && Math.abs(endX - g.x) > 18) {
          g.m.h0 = g.h;
          g.m.side0 = side;
          g.count++;
          setState(g, 'gybe', 0.9);
          g.m.dirX = want;
        }
        break;
      }
      if (atEnd) {
        g.m.h0 = g.h;
        g.m.side0 = side;
        g.count++;
        g.m.fell = 0;
        if (lvl === 3) {
          // freestyle: every run ends in a trick, and you go back the other way
          const r = hash01(g.i, g.count, 5);
          g.m.trick = r < 0.38 ? 0 : r < 0.72 ? 1 : 2;
          setState(g, 'trick', [1.2, 1.3, 2][g.m.trick]);
        } else if (lvl === 1 || g.m.dirX > 0) setState(g, 'tack', lvl === 1 ? 2.6 : 1.4);
        else setState(g, 'gybe', 0.9);
        g.m.dirX *= -1;
      }
      break;
    }
    case 'trick': {
      // freestyle tricks: a spin in place, a jump with a turn, or sailing backwards
      const k = g.st / g.dur;
      const side0 = g.m.side0;
      const h0 = g.m.h0;
      const tr = g.m.trick;
      if (tr === 0) {
        // spin: board and sail turn one and a half times on the spot
        ease(g, 2, 3, dt);
        move(g, dt);
        L.h = h0 + side0 * 3 * Math.PI * easeInOutSine(k);
        rigA = side0 * 30 * DEG;
        luff = 0.5;
        rider = standOn(rigA, 0);
        spray(g, z, v(0, 140), 50, 0, dt, 22);
      } else if (tr === 1) {
        // jump: up in the air, the board turns round underneath
        ease(g, 12, 2, dt);
        move(g, dt);
        const up = Math.sin(Math.PI * k);
        L.scale = 1 + 0.3 * up;
        L.lift = up * 1.5;
        L.h = h0 + side0 * Math.PI * easeInOutSine((k - 0.15) / 0.7);
        L.board.rot = 0.5 * up * side0;
        rigA = side0 * 30 * DEG;
        rider = standOn(rigA, 0);
      } else {
        // sailing backwards: the board turns round and keeps sliding the old way, then off the other way
        ease(g, k < 0.7 ? 8 : 4, 2, dt);
        move(g, dt);
        L.h = h0 + side0 * Math.PI * smooth(k / 0.25);
        rigA = -side0 * 40 * DEG;
        rider = standOn(rigA, 0);
        wake(g, z, WIND.wake, 3, 0.7);
      }
      if (g.st >= g.dur) {
        g.h = wrap(h0 + Math.PI);
        if (tr === 1) {
          ring(g, z, v(0, 0), 1.3);
          spray(g, z, v(0, 0), 140, 0, 0.3, 30);
        }
        setState(g, 'reach');
      }
      break;
    }
    case 'jump': {
      // wave zone: launch off a wave, high, sometimes a full loop backwards; splash on landing
      const k = g.st / g.dur;
      ease(g, 26, 1, dt);
      move(g, dt);
      const up = Math.sin(Math.PI * k);
      L.scale = 1 + 0.42 * up;
      L.lift = up * 2;
      L.board.rot = 0.35 * up;
      if (g.m.loop) L.h = g.h - (g.m.dirX || 1) * TAU * easeInOutSine((k - 0.1) / 0.8);
      const side = -windSide(g.h, wf);
      rigA = side * 30 * DEG;
      rider = standOn(rigA, 0.5);
      if (g.st >= g.dur) {
        ring(g, z, v(0, 0), 1.5);
        spray(g, z, v(0, 0), 160, 0, 0.3, 34);
        setState(g, 'reach');
      }
      break;
    }
    case 'tack': {
      // 0-0.4 turn into the wind; 0.4-0.9 step around the front of the mast; 0.9-1.4 bear away on the new side
      const k = g.st;
      const side0 = g.m.side0;
      const newH = wf - Math.sign(angleTo(wf, g.m.h0)) * 78 * DEG; // the new reach, on the other tack
      // the school does everything at half speed
      const slow = g.dur / 1.4;
      const kk = k / slow;
      if (kk < 0.4) g.h = lerpAngle(g.m.h0, wf, easeInOutSine(kk / 0.4));
      else if (kk < 0.9) g.h = wf;
      else g.h = lerpAngle(wf, newH, easeInOutSine((kk - 0.9) / 0.5));
      ease(g, k < 0.9 ? 3 : reachSpeed * 0.6, 2, dt);
      move(g, dt);
      const a0 = side0 * sheetAngle(pointOfSail(g.m.h0, wf), 14 * DEG, 70 * DEG);
      if (kk < 0.4) {
        rigA = lerp(a0, side0 * 3 * DEG, smooth(kk / 0.4));
        luff = smooth(kk / 0.4);
        rider = standOn(rigA, 0);
      } else if (kk < 0.9) {
        const u = (kk - 0.4) / 0.5;
        rigA = (u < 0.5 ? side0 : -side0) * 3 * DEG;
        luff = 1;
        // step forward to the mast, around its front (30 px away), and back on the other side
        const ang = Math.PI * smooth((u - 0.2) / 0.6);
        const arc = add(WIND.mast, v(-side0 * 30 * Math.cos(ang), 26 - 56 * Math.sin(ang)));
        const from = standOn(side0 * 3 * DEG, 0);
        const to = standOn(-side0 * 3 * DEG, 0);
        const p = u < 0.5 ? from : to;
        const w = smooth(Math.min(u / 0.2, (1 - u) / 0.2, 1));
        const at = lerpV(p.t, arc, w);
        rider = shiftPose(p, sub(at, p.t));
        rider = {
          ...rider,
          feet: [add(rider.t, v(0, -26)), add(rider.t, v(0, 26))],
          hips: rider.t,
          hands: [lerpV(p.hands[0], add(WIND.mast, v(-7, 4)), w), lerpV(p.hands[1], add(WIND.mast, v(7, 10)), w)],
        };
      } else {
        const u = (kk - 0.9) / 0.5;
        const a1 = -side0 * sheetAngle(pointOfSail(newH, wf), 14 * DEG, 70 * DEG);
        rigA = lerp(-side0 * 3 * DEG, a1, smooth(u));
        luff = 1 - smooth(u);
        rider = standOn(rigA, 0);
      }
      if (g.st >= g.dur) {
        if (lvl === 1 && hash01(g.i, g.count, 8) < 0.45) setState(g, 'fall', 1.4);
        else setState(g, 'reach');
      }
      break;
    }
    case 'gybe': {
      // carve downwind; halfway the sail flips over the nose and the feet swap
      const k = g.st / g.dur;
      const side0 = g.m.side0;
      const turnDir = side0; // bear away: turn the nose away from the wind (toward the sail)
      g.h = wrap(g.m.h0 + turnDir * 165 * DEG * easeInOutSine(k));
      ease(g, reachSpeed * (lvl === 2 ? 0.85 : 0.75), 2, dt);
      move(g, dt);
      const a0 = side0 * sheetAngle(pointOfSail(g.m.h0, wf), 14 * DEG, 70 * DEG);
      const flip = clamp01((k - 0.4) / 0.28);
      // the sail swings forward, past the nose (180 degrees) and out on the other side
      const sweep = Math.abs(a0) + (TAU - 2 * Math.abs(a0)) * easeInOutSine(flip);
      rigA = side0 * wrap(sweep);
      luff = flip > 0 && flip < 1 ? 0.6 : 0;
      rider = flip < 0.5 ? standOn(side0 * Math.abs(a0), 0) : standOn(-side0 * Math.abs(a0), 0);
      if (flip > 0 && flip < 1)
        rider = {
          ...rider,
          hands: [add(WIND.mast, v(-5, 10)), add(WIND.mast, v(5, 16))],
        };
      wake(g, z, WIND.wake, 3, 0.9);
      spray(g, z, v(side0 * 30, 140), lvl === 2 ? 70 : 30, side0, dt, lvl === 2 ? 32 : 24);
      if (g.st >= g.dur) setState(g, 'reach');
      break;
    }
    case 'fall': {
      // a beginner falls in: the sail lies flat on the water, only head and shoulders show
      ease(g, 0, 4, dt);
      move(g, dt);
      const side = -windSide(g.h, wf);
      rigA = side * 95 * DEG;
      L.rigAlpha = 0.8;
      rider = { ...standOn(side * 40 * DEG, 0), legs: 0 };
      L.riderScale = 0.8;
      if (g.st < dt * 1.5) ring(g, z, WIND.stand.t, 1);
      if (g.st >= g.dur) setState(g, 'uphaul', 1.5);
      break;
    }
    case 'uphaul':
    default: {
      // pull the sail back up
      ease(g, 0, 4, dt);
      move(g, dt);
      const k = smooth(g.st / g.dur);
      const side = -windSide(g.h, wf);
      rigA = side * lerp(95, 30, k) * DEG;
      L.rigScale = lerp(0.3, 1, k);
      luff = 1 - k;
      rider = standOn(rigA, 0);
      L.riderScale = lerp(0.85, 1, k);
      if (g.st >= g.dur) setState(g, 'reach');
      break;
    }
  }
  keepIn(g, z, 8);
  L.x = g.x;
  L.y = g.y;
  L.rig = rigA;
  L.luff = luff;
  L.rider = rider;
}

// ---------------------------------------------------------------- slalom: a race between the buoys

/**
 * The race clock (38 s): 0-5 everyone waits at the start (upwind, left), then all race at full speed downwind in a
 * zig-zag round the yellow buoys, gybing at each one, to the finish (right, near the beach); then they sail back.
 */
export function stepSlalom(z: Zone, dt: number) {
  const at = (fx: number, fy: number) => v(z.x + z.w * fx, z.y + z.h * fy);
  if (!z.buoys) z.buoys = [at(0.86, 0.66), at(0.14, 0.42), at(0.86, 0.18)];
  z.s.race = z.active ? ((z.s.race ?? 0) + dt) % 38 : 0;
}

/** Where a slalom racer heads now, and how fast. */
function slalomLeg(g: Guest, z: Zone): { x: number; y: number; speed: number } {
  const clock = z.s.race ?? 0;
  const b = z.buoys ?? [];
  const lane = ((g.i % 4) - 1.5) * 7;
  if (clock < 5 || g.m.leg === undefined || g.m.leg >= 4) {
    // at the start box (or sailing back to it): upwind on the left, slowly, side by side
    if (clock < 5) g.m.leg = 0;
    return { x: z.x + z.w * 0.1, y: z.y + z.h * 0.86 + lane, speed: 12 };
  }
  if (g.m.leg === 0) g.m.leg = 1;
  const target = b[Math.min(2, g.m.leg - 1)];
  return { x: target.x + (g.m.leg === 3 ? 30 : 0), y: target.y + lane, speed: 40 + 3 * hash01(g.i, 2) };
}

/** Round the buoy of the current leg: on to the next one; after the finish, sail back to the start. */
function slalomProgress(g: Guest, z: Zone) {
  if ((z.s.race ?? 0) < 5 || g.m.leg === undefined || g.m.leg === 0 || g.m.leg >= 4) return;
  const b = (z.buoys ?? [])[g.m.leg - 1];
  if (b && Math.abs(g.x - b.x) < 12) g.m.leg++;
}
