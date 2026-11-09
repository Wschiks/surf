import { add, angleTo, easeInOutSine, DEG, hash01, lerpV, mirrorPose, mul, rot, shiftPose, smooth, TAU, v, type Pose, type V } from '../geom';
import { WING } from '../models';
import { alive, baseLook, ease, headingTo, keepIn, leanOf, move, ring, setState, spray, steer, toWorldAt, wake, windSide, type Guest, type Zone } from '../sim';

// ---------------------------------------------------------------- foil and wing (4.4.5)
// SLOG -> TAKEOFF -> FLY <-> FOOT_SWITCH -> TOUCHDOWN

export function foil(g: Guest, z: Zone, _n: number, dt: number) {
  const t = z.t;
  const lvl = z.level;
  const L = baseLook(g, t);
  const wf = z.windFrom;
  const fly = [0, 22, 26, 30, 34][lvl];
  if (g.m.wp === undefined) {
    g.m.wp = Math.floor(hash01(g.i, 1) * 6);
    g.m.lift = 0;
    g.m.side = -windSide(g.h, wf);
    g.m.flip = 0;
  }
  // wandering from one spot of the zone to the next: long curves in every direction
  const spots = [v(0.15, 0.3), v(0.5, 0.2), v(0.85, 0.32), v(0.82, 0.72), v(0.5, 0.82), v(0.18, 0.7)];
  const order = [0, 3, 1, 4, 2, 5];
  const sp = spots[order[(g.m.wp + g.i) % 6]];
  const tx = z.x + z.w * sp.x;
  const ty = z.y + z.h * sp.y;
  if (Math.hypot(tx - g.x, ty - g.y) < 22) g.m.wp = (g.m.wp + 1 + (hash01(g.i, g.count++, 2) < 0.3 ? 1 : 0)) % 6;
  let target = headingTo(g, z, tx, ty, 50);
  // downwind: glide with the wind in S-curves down the swells, then wing back up against it
  if (lvl === 3) {
    if (g.m.down === undefined) g.m.down = 1;
    if (g.m.down && g.y < z.y + z.h * 0.2) g.m.down = 0;
    if (!g.m.down && g.y > z.y + z.h * 0.82) g.m.down = 1;
    target = g.m.down ? headingTo(g, z, g.x + Math.sin(g.st * 0.7 + g.i) * 40, z.y, 50) + 26 * DEG * Math.sin(g.st * 1.4 + g.phase * 6) : headingTo(g, z, g.x + (g.i % 2 ? 50 : -50), z.y + z.h, 50);
  }
  const off = angleTo(wf, target);
  if (Math.abs(off) < 50 * DEG) target = wf + (off >= 0 ? 50 : -50) * DEG;
  let pump = 0;
  let glide = 0;
  let loose = 0;

  switch (g.state) {
    case 'idle':
    case 'slog': {
      if (!z.active) {
        g.state = 'idle';
        steer(g, wf + 70 * DEG * (g.i % 2 ? 1 : -1), 0.5, dt);
        ease(g, 0, 1, dt);
        move(g, dt);
        g.m.lift = Math.max(0, g.m.lift - dt * 2);
        break;
      }
      if (g.state === 'idle') setState(g, 'slog', 1.2 + 1.8 * hash01(g.i, g.count, 3));
      steer(g, target, 40 * DEG, dt);
      ease(g, lvl === 1 ? 7 : 9, 1, dt);
      move(g, dt);
      pump = 0.4;
      wake(g, z, WING.wake, 3.4, 0.7);
      // the school never really flies: short hops out of the water
      if (g.st >= g.dur) setState(g, lvl === 1 ? 'hop' : 'takeoff', lvl === 1 ? 1.5 : 1.6);
      break;
    }
    case 'hop': {
      steer(g, target, 30 * DEG, dt);
      ease(g, 11, 1, dt);
      move(g, dt);
      pump = 1;
      g.m.lift = 0.5 * Math.sin(Math.PI * smooth(g.st / g.dur));
      if (g.st >= g.dur) {
        ring(g, z, v(0, 30), 0.9);
        spray(g, z, v(0, 0), 70, 0, 0.25, 16);
        g.count++;
        if (hash01(g.i, g.count, 8) < 0.45) setState(g, 'fall', 2.2);
        else setState(g, 'slog', 1.4 + 1.6 * hash01(g.i, g.count, 9));
      }
      break;
    }
    case 'fall': {
      // over the front: the wing lies flat on the water, the rider climbs back on the board
      ease(g, 0, 3, dt);
      move(g, dt);
      g.m.lift = 0;
      if (g.st >= g.dur) setState(g, 'slog', 1.5);
      break;
    }
    case 'jump': {
      // pro arena: the wing pulls the rider up; a 360 high above the water, a splash on landing
      ease(g, fly, 1, dt);
      move(g, dt);
      glide = 1;
      if (g.st >= g.dur) {
        ring(g, z, v(0, 30), 1.4);
        spray(g, z, v(0, 0), 140, 0, 0.3, 30);
        setState(g, 'fly', 3 + 3 * hash01(g.i, g.count, 11));
      }
      break;
    }
    case 'takeoff': {
      steer(g, target, 40 * DEG, dt);
      ease(g, fly * 0.8, 1.2, dt);
      move(g, dt);
      pump = 1;
      g.m.lift = smooth(g.st / g.dur);
      L.board.sx = L.board.sy = 1 + 0.03 * Math.max(0, Math.sin(TAU * 1.2 * g.st));
      if (g.m.lift < 0.6) wake(g, z, WING.wake, 3, 0.7 * (1 - g.m.lift));
      if (g.st >= g.dur) setState(g, 'fly', 14 + 12 * hash01(g.i, g.count, 4));
      break;
    }
    case 'fly': {
      steer(g, target, 50 * DEG, dt);
      ease(g, fly, 0.8, dt);
      move(g, dt);
      glide = 1;
      g.m.lift = 1;
      if (lvl === 3 && g.m.down) loose = 1;
      if (lvl === 4 && g.st > 2.5 && hash01(g.i, Math.floor(g.st), 10) < 0.02) {
        g.count++;
        setState(g, 'jump', 1.3);
        break;
      }
      if (g.odo > 3) {
        g.odo = 0;
        const w = toWorldAt(g, WING.mast);
        z.fx.push({ k: 'vee', x: w.x, y: w.y, rot: g.h });
      }
      if (!z.active || g.st >= g.dur) setState(g, 'touchdown', 0.3);
      break;
    }
    case 'touchdown':
    default: {
      ease(g, 6, 3, dt);
      move(g, dt);
      g.m.lift = 1 - smooth(g.st / g.dur);
      if (g.st >= g.dur) {
        ring(g, z, v(0, 30), 1);
        spray(g, z, v(0, 0), 90, 0, 0.25, 20);
        g.count++;
        setState(g, z.active ? 'slog' : 'idle', 2 + 2 * hash01(g.i, g.count, 5));
      }
      break;
    }
  }
  keepIn(g, z, 8);

  // the wing sits downwind; when the wind side changes the rider passes the wing over the head (foot switch)
  const side = -windSide(g.h, wf);
  if (side !== g.m.side && g.m.flip <= 0) {
    g.m.flip = 1;
    g.m.from = g.m.side;
    g.m.side = side;
  }
  let wingSide = g.m.side;
  let flipK = 0;
  if (g.m.flip > 0) {
    g.m.flip = Math.max(0, g.m.flip - dt);
    flipK = 1 - g.m.flip; // 0..1 over one second
    if (flipK < 0.5) wingSide = g.m.from;
  }
  const mirror = wingSide < 0;
  const ph = g.phase * TAU;
  const pumpRot = pump * 6 * DEG * Math.sin(TAU * 1.2 * t + ph);
  const over = Math.sin(Math.PI * flipK);
  const wingRot = WING.angle + pumpRot + (flipK > 0 ? (flipK < 0.5 ? 1 : -1) * over * 80 * DEG : 0);
  const grip = WING.grip;
  const wingAt = flipK > 0 ? lerpV(grip, v(0, -10), over) : grip;
  let wingScale = (1 - 0.15 * over) * g.gear.sail;
  let wingA = wingAt;
  let wingR = wingRot;
  // downwind: the wing held loose above the head, flagging along the board
  if (loose) {
    wingA = v(0, -6);
    wingR = 0.15 * Math.sin(t * 1.3 + ph);
    wingScale *= 0.92;
  }
  const handsW = WING.handles.map((h) => add(wingA, rot(mul(h, wingScale), wingR))) as [V, V];
  let p: Pose = { ...WING.stand, hands: handsW };
  p = alive(p, g, t, leanOf(g), 0);
  if (glide) {
    const up = 2 * Math.sin(TAU * 0.6 * t + ph);
    p = shiftPose(p, v(0, up));
  }
  const m = (q: V) => v(-q.x, q.y);
  L.wing = {
    at: mirror ? m(wingA) : wingA,
    rot: mirror ? -wingR : wingR,
    scale: wingScale,
    flip: mirror,
  };
  if (g.state === 'fall') {
    // the wing flat on the water in front, the rider in the water next to the board
    L.wing = { at: v(mirror ? -60 : 60, -120), rot: (mirror ? -1 : 1) * 1.2, scale: wingScale * 0.95, flip: mirror, alpha: 0.85 };
    p = { ...p, legs: 0, hands: [v(30, -60), v(20, -40)] };
    L.riderScale = 0.85;
  }
  L.rider = mirror ? mirrorPose(p) : p;
  L.lift = g.m.lift;
  L.scale = 1 + 0.05 * g.m.lift;
  if (g.state === 'jump') {
    const k = g.st / g.dur;
    const up = Math.sin(Math.PI * k);
    L.scale = 1.05 + 0.45 * up;
    L.lift = 1 + 1.4 * up;
    L.h = g.h + TAU * easeInOutSine((k - 0.1) / 0.8) * (g.i % 2 ? 1 : -1);
  }
  L.x = g.x;
  L.y = g.y;
  if (g.m.lift > 0.5 && g.state !== 'jump') L.h = g.h; // flying: no water bob
}
