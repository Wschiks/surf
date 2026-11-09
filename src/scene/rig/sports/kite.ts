import { hash01, smooth, lerpV, add, angleTo, clamp, clamp01, DEG, dir, easeInOutSine, headingOf, lerp, mirrorPose, mul, rot, shiftPose, sub, TAU, turnPose, v, wrap, type Pose, type V } from '../geom';
import { fromDrawn, K, KITE } from '../models';
import { alive, baseLook, ease, fromWorldAt, headingTo, keepIn, move, ring, setState, spray, steer, wake, type Guest, type Zone } from '../sim';

// ---------------------------------------------------------------- kitesurfing (4.4.4)
// RIDE -> TRANSITION -> RIDE (the other way), JUMP, beginners BODY_DRAG

function kiteStand(g: Guest, t: number, kiteLocal: V | null, mirror: boolean): { p: Pose; bar: { at: V; rot: number } } {
  // the drawn rider (board across, facing the kite) turned into the model frame
  const d = KITE.stand;
  const conv = (q: V) => fromDrawn(q);
  let p: Pose = {
    ...d,
    t: conv(d.t),
    rot: d.rot - Math.PI / 2,
    face: conv(d.face),
    hips: conv(d.hips),
    legSpread: conv(d.legSpread),
    feet: [conv(d.feet[0]), conv(d.feet[1])],
    hands: [conv(d.hands[0]), conv(d.hands[1])],
  };
  let bar = conv(KITE.bar);
  if (mirror) {
    p = mirrorPose(p);
    bar = v(-bar.x, bar.y);
  }
  let barRot = mirror ? -Math.PI / 2 : Math.PI / 2;
  // the upper body turns toward the kite (leaning away from it)
  if (kiteLocal) {
    const want = headingOf(sub(kiteLocal, p.t));
    const now = headingOf(p.face);
    const turn = clamp(angleTo(now, want), -55 * DEG, 55 * DEG);
    const upper = turnPose(p, turn, p.hips);
    p = { ...upper, feet: p.feet, hips: p.hips, legSpread: p.legSpread };
    bar = add(p.hips, rot(sub(bar, p.hips), turn));
    barRot += turn;
    p = shiftPose({ ...p, feet: p.feet }, mul(p.face, -4));
    p = { ...p, feet: p.feet.map((f) => sub(f, mul(p.face, -4))) as [V, V] };
  }
  return { p: alive(p, g, t, 0, 0.2), bar: { at: bar, rot: barRot } };
}

export function kite(g: Guest, z: Zone, _n: number, dt: number) {
  const t = z.t;
  const lvl = z.level;
  const L = baseLook(g, t);
  const wf = z.windFrom;
  const down = wf + Math.PI;
  const D = KITE.lineLength * K;
  const pace = [0, 11, 26, 30, 36][lvl];
  const waveRider = g.gear.board === 'b-kite-dir';
  if (g.m.lane === undefined) {
    g.m.lane = z.y + z.h * (0.46 + 0.4 * ((g.i * 0.618 + 0.3) % 1));
    g.m.dirX = g.i % 2 ? -1 : 1;
    g.m.beta = 0;
  }
  const sweepAmp = lvl === 1 ? 30 : 20;
  const sweepHz = lvl === 1 ? 0.25 : 0.15;
  const sweep = sweepAmp * DEG * Math.sin(TAU * sweepHz * t + g.phase * TAU);
  let zenith = 0;
  let travelSide = g.m.dirX;
  let mirror = false;
  let rider: Pose | null = null;
  let jumpK = -1;

  switch (g.state) {
    case 'idle': {
      // waiting: the kite parked overhead, the rider standing in the water next to the board
      ease(g, 0, 1.5, dt);
      steer(g, wf + (g.m.dirX > 0 ? -90 : 90) * DEG, 0.6, dt);
      move(g, dt);
      zenith = 1;
      if (z.active) setState(g, 'ride');
      break;
    }
    case 'ride': {
      if (!z.active) {
        setState(g, 'idle');
        break;
      }
      // the school makes short runs in the middle; the others use the whole zone
      const margin = lvl === 1 ? z.w * 0.16 : 20;
      const endX = g.m.dirX > 0 ? z.x + z.w - margin : z.x + margin;
      let target = headingTo(g, z, endX, g.m.lane, 44);
      // across the wind, a little upwind to hold the line (kiters never head far downwind: the kite would be ahead)
      const across = Math.sin(wf + Math.PI / 2) * g.m.dirX > 0 ? wf + Math.PI / 2 : wf - Math.PI / 2;
      const up = Math.sign(angleTo(across, wf));
      const off = angleTo(across, target) * up;
      target = across + clamp(off, -4 * DEG, 18 * DEG) * up;
      // wave riders carve S-turns on a strapless surfboard; beginners wobble
      if (waveRider) target += 34 * DEG * Math.sin(g.st * 3.2 + g.phase * 6);
      if (lvl === 1) target += 12 * DEG * Math.sin(g.st * 2.3 + g.phase * 4);
      steer(g, target, waveRider ? 150 * DEG : 70 * DEG, dt, waveRider ? 4 : 3);
      ease(g, pace * (0.9 + 0.1 * Math.sin(TAU * 0.11 * t + g.phase * 9)), 1, dt);
      move(g, dt);
      wake(g, z, KITE.wake, 2.8, 0.9);
      spray(g, z, v(-g.m.dirX * 26, 0), g.speed * 0.6, -g.m.dirX, dt, 16);
      if (waveRider) {
        const carve = Math.abs(g.turn) * g.speed;
        if (carve > 25) spray(g, z, v(g.turn > 0 ? -30 : 30, 60), carve, g.turn > 0 ? -1 : 1, dt, 32);
      }
      const mid = Math.abs(g.x - (z.x + z.w / 2)) < 12;
      if (!waveRider && lvl >= 2 && mid && !g.m.jumped && (lvl > 2 || g.count % 3 === 1)) {
        // freeride: a small hop now and then; freestyle: a trick every run; big air: a huge jump (sometimes a kiteloop)
        g.m.jumped = 1;
        const r = hash01(g.i, g.count, 6);
        g.m.trick = lvl === 3 ? (r < 0.4 ? 1 : r < 0.7 ? 2 : 3) : lvl === 4 ? (r < 0.5 ? 4 : 5) : 0;
        setState(g, 'jump', [0.8, 1.3, 1.5, 1.4, 2.2, 2.4][g.m.trick]);
      }
      // a beginner loses it halfway: the kite drops in the water
      if (lvl === 1 && g.st > 1.4 && !g.m.jumped && hash01(g.i, g.count, 7) < 0.45) {
        g.m.jumped = 1;
        setState(g, 'crash', 3.2);
      }
      if ((g.m.dirX > 0 && g.x > endX - 4) || (g.m.dirX < 0 && g.x < endX + 4)) {
        g.count++;
        g.m.jumped = 0;
        g.m.h0 = g.h;
        if (lvl === 1 && g.count % 2 === 0) setState(g, 'drag', 2.4);
        else setState(g, 'transition', 1.6);
      }
      break;
    }
    case 'transition': {
      // slow down, the kite swings over the top to the other side, the board turns, switch stance
      const k = g.st / g.dur;
      ease(g, k < 0.7 ? 5 : pace * 0.6, 2, dt);
      const turnDir = g.m.dirX > 0 ? -1 : 1;
      g.h = wrap(g.m.h0 + turnDir * Math.PI * easeInOutSine((k - 0.2) / 0.6));
      move(g, dt);
      zenith = Math.sin(Math.PI * clamp01(k * 1.15));
      if (k > 0.5) travelSide = -g.m.dirX;
      if (g.st >= g.dur) {
        g.m.dirX *= -1;
        setState(g, 'ride');
      }
      break;
    }
    case 'jump': {
      // kite to the top, up in the air with a grab, and a splash on landing
      jumpK = g.st / g.dur;
      ease(g, pace, 1, dt);
      move(g, dt);
      zenith = Math.sin(Math.PI * clamp01(jumpK * 1.2));
      if (g.st >= g.dur) {
        ring(g, z, v(0, 0), 1.3);
        spray(g, z, v(0, 0), 120, 0, 0.3, 30);
        setState(g, 'ride');
      }
      break;
    }
    case 'crash': {
      // the kite falls out of the sky onto the water; the rider sits in the water, then relaunches it
      ease(g, 0, 2, dt);
      move(g, dt);
      if (g.st >= g.dur) setState(g, 'ride');
      break;
    }
    case 'drag':
    default: {
      // a beginner lost the board: dragged through the water by the kite, then back on the board
      ease(g, 7, 2, dt);
      move(g, dt);
      if (g.st >= g.dur) {
        g.m.dirX *= -1;
        g.h = wrap(g.h + Math.PI);
        setState(g, 'ride');
      }
      break;
    }
  }
  keepIn(g, z, 8);
  mirror = travelSide < 0;

  // the kite: downwind of the rider, 60 degrees toward the side of travel, sweeping; through the zenith it comes close
  let beta = clamp(60 * DEG + sweep, 35 * DEG, 72 * DEG) * travelSide * (1 - zenith);
  // never straight ahead of the board (and never upwind of the rider: the edge of the wind window is 90 degrees)
  const ahead = angleTo(g.h, down + beta);
  if (Math.abs(ahead) < 30 * DEG && zenith < 0.5) beta = clamp(beta + (Math.sign(ahead) || 1) * (30 * DEG - Math.abs(ahead)), -85 * DEG, 85 * DEG);
  g.m.beta = beta;
  const kd = D * lerp(1, 0.35, zenith);
  const kdir = dir(down + beta);
  const kx = g.x + kdir.x * kd;
  const ky = g.y + kdir.y * kd;
  L.kite = {
    x: kx,
    y: ky,
    rot: headingOf(kdir),
    scale: lerp(1, 1.15, zenith) * g.gear.sail,
    alt: 0.6 + 0.4 * zenith,
  };
  if (g.state === 'crash') {
    // down in the water at the edge of the window, lines slack; then it climbs back up
    const k = g.st / g.dur;
    const fall = smooth(k / 0.25) * (1 - smooth((k - 0.75) / 0.25));
    const side = travelSide || 1;
    const cd = dir(down + side * lerp(Math.abs(beta), 88 * DEG, fall));
    L.kite.x = g.x + cd.x * kd * lerp(1, 1.08, fall);
    L.kite.y = g.y + cd.y * kd * lerp(1, 1.08, fall);
    L.kite.rot = headingOf(cd) + side * 1.2 * fall;
    L.kite.alt = lerp(0.6, 0, fall);
    L.kite.lines = 1 - 0.6 * fall;
    if (k > 0.24 && k < 0.27) z.fx.push({ k: 'ring', x: L.kite.x, y: L.kite.y, size: 1.6 });
  }
  if (jumpK >= 0 && g.m.trick === 5) {
    // kiteloop: the kite makes a full circle in the sky while the rider flies
    const loopA = TAU * easeInOutSine((jumpK - 0.1) / 0.6) * (travelSide || 1);
    const ld = dir(down + beta + loopA);
    L.kite.x = g.x + ld.x * kd * 0.8;
    L.kite.y = g.y + ld.y * kd * 0.8;
    L.kite.rot = headingOf(ld) + loopA;
  }
  L.x = g.x;
  L.y = g.y;
  const kiteLocal = fromWorldAt(g, v(kx, ky));
  const st = kiteStand(g, t, kiteLocal, mirror);
  rider = st.p;
  L.bar = st.bar;
  if (jumpK >= 0) {
    // up in the air: bigger, the shadow far away. Tricks: 0 small hop, 1 raley, 2 handle pass, 3 spin, 4 big air, 5 kiteloop
    const tr = g.m.trick ?? 0;
    const up = Math.sin(Math.PI * jumpK);
    const height = [0.12, 0.22, 0.3, 0.3, 0.55, 0.5][tr];
    L.scale = 1 + height * up;
    L.lift = up * [0.6, 1, 1.6, 1.6, 2.6, 2.4][tr];
    L.board.rot = (tr === 1 ? 0 : 28) * DEG * Math.sin(Math.PI * clamp01((jumpK - 0.2) / 0.6));
    const spinDir = g.m.dirX > 0 ? 1 : -1;
    if (tr === 2 || tr === 3 || tr === 4) L.h += TAU * easeInOutSine((jumpK - 0.15) / 0.7) * spinDir;
    if (tr === 1) {
      // raley: the body is thrown out flat behind, legs and board flying away from the kite
      const away = mul(rider.face, -1);
      const k2 = up;
      rider = { ...rider, feet: [add(rider.feet[0], mul(away, 46 * k2)), add(rider.feet[1], mul(away, 46 * k2))], t: add(rider.t, mul(away, 14 * k2)) };
      L.board.at = mul(away, 46 * k2);
    }
    if (tr === 2) {
      // handle pass: the bar goes behind the back, the hands swap
      const behind = add(rider.t, mul(rider.face, -16));
      const k2 = Math.sin(Math.PI * clamp01((jumpK - 0.3) / 0.4));
      rider = { ...rider, hands: [lerpV(rider.hands[0], add(behind, v(-6, 0)), k2), lerpV(rider.hands[1], add(behind, v(6, 0)), k2)] };
    }
  }
  if (g.state === 'crash') {
    rider = { ...rider, legs: 0 };
    L.riderScale = 0.85;
    L.board.at = v(0, 40);
  }
  if (g.state === 'drag' || g.state === 'idle') {
    L.board.alpha = g.state === 'drag' ? clamp01((g.st - g.dur + 0.4) / 0.4) : 1;
    rider = { ...rider, legs: g.state === 'drag' ? 0 : rider.legs };
    if (g.state === 'drag') {
      L.riderScale = 0.82;
      if (g.odo > 3) {
        g.odo = 0;
        ring(g, z, v(0, 0), 0.4);
      }
    }
  }
  L.rider = rider;
}
