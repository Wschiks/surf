import { clamp01, DEG, hash01, lerp, lerpPose, lerpV, mirrorPose, rot, shiftPose, smooth, TAU, turnPose, v, wrap, type Pose } from '../geom';
import { FORWARD, SKIM } from '../models';
import { alive, baseLook, ease, fromWorldAt, headingTo, homeSpot, keepIn, leanOf, move, setState, spray, steer, toWorldAt, type Guest, type Zone } from '../sim';

// ---------------------------------------------------------------- skimboarding (4.4.2)
// WAIT_SAND -> RUN -> DROP -> JUMP_ON -> GLIDE -> STOP -> WALK_BACK

function runPose(t: number, g: Guest, period: number, amount: number, carry: boolean): Pose {
  const s = Math.sin((TAU * t) / period + g.phase * TAU) * amount;
  const p: Pose = {
    ...FORWARD,
    legs: amount > 0.05 ? 1 : 0,
    feet: [v(9, -20 * s), v(-9, 20 * s)],
    hands: carry ? [v(-28, 18 * s), v(30, 6)] : [v(-28, 16 + 18 * s), v(28, 16 - 18 * s)],
  };
  return turnPose(p, 6 * DEG * s, p.t);
}

export function skim(g: Guest, z: Zone, n: number, dt: number) {
  const t = z.t;
  const lvl = z.level;
  const home = homeSpot('skimmer', g.i, n, z);
  const L = baseLook(g, t, false);
  let rider: Pose;
  // the board in the right hand: turned across, a little smaller (model frame of the walker)
  const carried = { at: v(g.gear.board === 'b-wood' ? 40 : 44, 6), rot: 0, sx: 0.85, sy: 0.85, alpha: 1 };
  // flatland rides along the beach (left or right); the others run into the sea
  const runDir = lvl === 2 ? (g.count % 2 ? -1 : 1) * (95 + 12 * hash01(g.i, g.count, 1)) * DEG : Math.PI + (hash01(g.i, g.count, 1) - 0.5) * 50 * DEG;
  const topSpeed = [0, 22, 44, 40, 48][lvl];
  const brake = [0, 20, 9, 14, 13][lvl];
  switch (g.state) {
    case 'idle':
    case 'walk': {
      const d = Math.hypot(home.x - g.x, home.y - g.y);
      if (d > 2) {
        steer(g, headingTo(g, z, home.x, home.y, 22), 5, dt);
        ease(g, Math.min(16, d * 2), 3, dt);
      } else {
        steer(g, Math.PI, 4, dt);
        ease(g, 0, 6, dt);
        if (z.active) setState(g, 'wait', 0.3 + 1.8 * hash01(g.i, g.count, 2));
      }
      move(g, dt);
      rider = runPose(t, g, 0.45, clamp01(g.speed / 6), true);
      Object.assign(L.board, carried);
      break;
    }
    case 'wait': {
      steer(g, runDir, 3, dt);
      ease(g, 0, 6, dt);
      move(g, dt);
      rider = runPose(t, g, 0.45, 0, true);
      Object.assign(L.board, carried);
      if (!z.active) setState(g, 'walk');
      else if (g.st >= g.dur) setState(g, 'run', 0.7);
      break;
    }
    case 'run': {
      steer(g, runDir, 3, dt);
      ease(g, lerp(4, topSpeed, g.st / g.dur), 5, dt);
      move(g, dt);
      rider = runPose(t, g, 0.28, 1, true);
      Object.assign(L.board, carried);
      if (g.st >= g.dur) {
        setState(g, 'drop', 0.27);
        // the board lands 20 px ahead and stays there while the rider jumps on
        const ahead = toWorldAt(g, v(0, -60));
        g.m.bx = ahead.x;
        g.m.by = ahead.y;
      }
      break;
    }
    case 'drop': {
      move(g, dt);
      const k = g.st / g.dur;
      // board: from the hand to the ground, then the rider lands on it
      const bLocal = fromWorldAt(g, v(g.m.bx, g.m.by));
      const inHand = k < 0.45;
      if (inHand) {
        L.board.at = lerpV(carried.at, bLocal, k / 0.45);
        L.board.rot = lerp(carried.rot, 0, k / 0.45);
        L.board.sx = L.board.sy = lerp(0.9, 1, k / 0.45);
        rider = runPose(t, g, 0.28, 1, false);
      } else {
        L.board.at = bLocal;
        const j = (k - 0.45) / 0.55;
        rider = lerpPose(runPose(t, g, 0.28, 1, false), shiftPose(skimStand(g, t), bLocal), smooth(j));
      }
      if (g.st >= g.dur) {
        g.x = g.m.bx;
        g.y = g.m.by;
        setState(g, 'glide');
        g.m.spin = 0;
        spray(g, z, SKIM.tail, 80, 0, 0.25, 22);
      }
      break;
    }
    case 'glide': {
      // slide over the thin water, slowing down. Shallows: short and wobbly, often a fall. Flatland: a trick on every
      // glide. Shore break: out to the wave and a wrap turn back on it. Big shore break: launch off the lip.
      steer(g, runDir, 1.5, dt);
      g.speed = Math.max(0, g.speed - brake * dt);
      move(g, dt);
      rider = skimStand(g, t);
      let spin = 0;
      if (lvl === 1) {
        rider = { ...rider, hands: [v(-46 + 8 * Math.sin(t * 8), -40), v(44, 30 + 10 * Math.sin(t * 8 + 1))], t: v(rider.t.x + 4 * Math.sin(t * 6 + g.phase * 9), rider.t.y) };
        if (g.st > 0.6 && hash01(g.i, g.count, 3) < 0.5) {
          setState(g, 'fall', 1.6);
          spray(g, z, v(0, 0), 60, 0, 0.3, 14);
          break;
        }
      }
      if (lvl === 2) {
        // the trick: 0 a 360 (board and rider together), 1 a shove-it (only the board), 2 a body varial (only the rider)
        const tr = Math.floor(hash01(g.i, g.count, 4) * 3);
        const k = smooth((g.st - 0.5) / 0.7);
        const hop = Math.sin(Math.PI * clamp01((g.st - 0.5) / 0.7));
        if (tr === 0) spin = TAU * k;
        if (tr === 1) {
          L.board.rot = TAU * k;
          L.scale = 1 + 0.1 * hop;
        }
        if (tr === 2) {
          rider = turnPose(rider, TAU * k, rider.t);
          L.scale = 1 + 0.12 * hop;
        }
      }
      if (lvl >= 3 && g.y > z.y + z.h * (lvl === 3 ? 0.55 : 0.6)) {
        // at the wave
        g.m.h0 = g.h;
        setState(g, lvl === 3 ? 'wrap' : 'air', lvl === 3 ? 0.7 : 1.1);
        spray(g, z, SKIM.tail, 140, 0, 0.25, 30);
        break;
      }
      L.h = g.h + spin;
      spray(g, z, SKIM.tail, g.speed * 1.4, 0, dt, 16);
      if (g.odo > 3) {
        g.odo = 0;
        const w = toWorldAt(g, rot(SKIM.tail, spin));
        z.fx.push({
          k: 'wake',
          x: w.x,
          y: w.y,
          vx: 0,
          vy: 0,
          rot: g.h,
          size: 0.6,
        });
      }
      if (g.speed < 2.5) setState(g, 'stop', 0.3);
      break;
    }
    case 'fall': {
      // on the bum in the shallow water; the board slides on alone; stand up again
      ease(g, 0, 5, dt);
      move(g, dt);
      const k = g.st / g.dur;
      rider = { ...FORWARD, t: v(0, 14), legs: 1, feet: [v(10, -36), v(-10, -34)], hands: [v(-30, 30), v(30, 30)], hips: v(0, 8) };
      if (k > 0.75) rider = lerpPose(rider, runPose(t, g, 0.45, 0, false), smooth((k - 0.75) / 0.25));
      L.board.at = v(0, -40 - 50 * smooth(k / 0.5));
      L.board.rot = 0.6 * smooth(k);
      if (g.st < dt * 1.5) z.fx.push({ k: 'ring', x: g.x, y: g.y, size: 0.7 });
      if (g.st >= g.dur) {
        g.count++;
        setState(g, 'walk');
      }
      break;
    }
    case 'wrap': {
      // shore break: a hard turn on the wave with a fan of spray, then ride the wave back to the sand
      const k = g.st / g.dur;
      g.h = wrap(g.m.h0 + (g.i % 2 ? 1 : -1) * 170 * DEG * smooth(k));
      g.speed = lerp(Math.max(g.speed, 14), 26, k);
      move(g, dt);
      rider = skimStand(g, t);
      spray(g, z, v(g.i % 2 ? -30 : 30, 40), 200, g.i % 2 ? -1 : 1, dt, 34);
      if (g.st >= g.dur) setState(g, 'back');
      break;
    }
    case 'back': {
      steer(g, 0, 1.2, dt);
      g.speed = Math.max(0, g.speed - 10 * dt);
      move(g, dt);
      rider = skimStand(g, t);
      spray(g, z, SKIM.tail, g.speed * 1.2, 0, dt, 14);
      if (g.speed < 2.5 || g.y < z.y + z.h * 0.14) setState(g, 'stop', 0.3);
      break;
    }
    case 'air': {
      // big shore break: off the lip, up in the air with a 360; land in the foam (or wipe out)
      const k = g.st / g.dur;
      g.speed = Math.max(10, g.speed - 6 * dt);
      move(g, dt);
      const up = Math.sin(Math.PI * k);
      rider = skimStand(g, t);
      L.scale = 1 + 0.45 * up;
      L.lift = 1.8 * up;
      L.h = g.h + TAU * smooth((k - 0.1) / 0.8) * (g.i % 2 ? 1 : -1);
      if (g.st >= g.dur) {
        z.fx.push({ k: 'ring', x: g.x, y: g.y, size: 1.4 });
        spray(g, z, v(0, 0), 160, 0, 0.3, 30);
        g.count++;
        if (hash01(g.i, g.count, 5) < 0.25) setState(g, 'wipe', 1.2);
        else {
          g.h = wrap(g.h + Math.PI);
          setState(g, 'back');
        }
      }
      break;
    }
    case 'wipe': {
      // tumbling in the foam: rider gone, the board flips away; then up and walk back
      ease(g, 0, 2, dt);
      move(g, dt);
      rider = skimStand(g, t);
      const k = g.st / g.dur;
      L.riderAlpha = k < 0.2 ? 1 - k * 5 : k > 0.75 ? (k - 0.75) * 4 : 0;
      L.board.rot = k * 12;
      L.board.at = v(0, -50 * k);
      if (g.st >= g.dur) {
        g.count++;
        setState(g, 'walk');
      }
      break;
    }
    case 'stop':
    default: {
      ease(g, 0, 8, dt);
      move(g, dt);
      const k = smooth(g.st / g.dur);
      rider = lerpPose(skimStand(g, t), runPose(t, g, 0.45, 0, true), k);
      L.board.at = lerpV(v(0, 0), carried.at, k);
      L.board.rot = lerp(0, carried.rot, k);
      L.board.sx = L.board.sy = lerp(1, 0.9, k);
      if (g.st >= g.dur) {
        g.count++;
        setState(g, 'walk');
      }
      break;
    }
  }
  keepIn(g, z, 4);
  L.x = g.x;
  L.y = g.y;
  L.h = g.state === 'glide' || g.state === 'air' ? L.h : g.h;
  L.rider = rider;
}

function skimStand(g: Guest, t: number): Pose {
  const p = g.i % 3 === 1 ? mirrorPose(SKIM.stand) : SKIM.stand;
  return alive(p, g, t, leanOf(g), 0.6);
}
