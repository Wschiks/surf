// Wave surfing, four sections (docs/SPORTS.md 1):
// 1 School: kids walk out with soft-tops and ride the white water straight in, lying down or standing wobbly; lots of falls.
// 2 Longboard: slow, long rides on small rolling waves; the rider walks to the nose and hangs five.
// 3 Reef: a real wave peels along the reef; surfers take off at the peel, ride ahead of the curl, get barreled and
//   shoot out with the spit, then snap and kick out.
// 4 Nazaré: giant waves; a jet ski tows the surfer in, a fast drop, a huge barrel and foam explosion, the jet ski picks
//   the surfer up on its sled.

import { add, clamp01, DEG, dir, easeOutBack, hash01, headingOf, lerp, lerpPose, lerpV, mirrorPose, pose, shiftPose, smooth, TAU, v, wrap, type Pose, type V } from '../geom';
import { FORWARD, SURF } from '../models';
import { alive, baseLook, ease, headingTo, homeSpot, keepIn, leanOf, move, newGuest, ring, setState, spray, steer, wake, type Guest, type Wave, type Zone } from '../sim';

// ---------------------------------------------------------------- poses per board

/** Standing on each board (sideways, facing +x), feet over the deck. */
const STAND: Record<number, Pose> = {
  1: pose(v(-2, 28), [v(3, -4), v(3, 60)], [v(30, -10), v(-30, 70)]),
  2: pose(v(-2, 50), [v(3, 18), v(3, 82)], [v(28, 2), v(-30, 98)]),
  3: SURF.stand,
  4: pose(v(-2, 72), [v(3, 40), v(3, 104)], [v(30, 20), v(-30, 120)]),
};

function paddleHands(t: number, g: Guest, rate: number, shoulderY: number): [V, V] {
  const sh = [v(-20, shoulderY), v(20, shoulderY)];
  const out: V[] = [0, 1].map((k) => {
    const a = TAU * (t * rate) + g.phase * TAU + k * Math.PI;
    const s = k === 0 ? -1 : 1;
    return add(sh[k], v(s * (12 + 9 * Math.max(0, Math.sin(a))), -30 * Math.cos(a)));
  });
  return [out[0], out[1]];
}

/** Lying on the board, paddling (0 = still). Longboarders lie further forward on their long board. */
function prone(g: Guest, t: number, paddling: number, lvl: number): Pose {
  const dy = lvl === 2 ? -14 : lvl === 1 ? 6 : 0;
  const base = shiftPose(SURF.prone, v(0, dy));
  const rest: [V, V] = [v(-30, -14 + dy), v(30, -14 + dy)];
  return {
    ...base,
    hands: paddling > 0 ? paddleHands(t, g, paddling / 0.9, base.t.y) : rest,
  };
}

function stand(g: Guest, t: number, lvl: number, wobble = 0): Pose {
  const p = g.mirror ? mirrorPose(STAND[lvl]) : STAND[lvl];
  const q = alive(p, g, t, leanOf(g));
  if (!wobble) return q;
  // a beginner fighting for balance: arms wide and waving, the body swaying
  const w = Math.sin(t * 7 + g.phase * 9) * wobble;
  return {
    ...shiftPose(q, v(w * 5, 0)),
    hands: [add(q.hands[0], v(10, -10 + w * 14)), add(q.hands[1], v(-10, 10 - w * 14))],
    feet: p.feet,
  };
}

/** Standing in the water next to the board, waist deep (only the upper body shows), facing forward. */
function wading(t: number, g: Guest, walking: number): Pose {
  const s = Math.sin(t * 6 + g.phase * 5) * walking;
  return {
    ...FORWARD,
    legs: 0,
    hands: [v(-26, 8 + 6 * s), v(30, 4)],
    rot: 0.08 * s,
  };
}

// ---------------------------------------------------------------- the breaking wave (Reef, Nazaré)

/** The waves of a Reef or Nazaré zone: they come in from the open sea and peel along the zone. */
export function stepWaves(z: Zone, dt: number) {
  if (!z.waves) z.waves = [];
  const big = z.level === 4;
  const face = big ? 34 : 19;
  const peel = big ? 78 : 46;
  const every = big ? 6.5 : 3.4;
  z.s.waveT = (z.s.waveT ?? every - 1) + dt;
  if (z.s.waveT >= every) {
    z.s.waveT = 0;
    z.s.waveN = (z.s.waveN ?? 0) + 1;
    // the reef is a peak: rights and lefts take turns; at Nazaré too
    const d = z.s.waveN % 2 === 0 ? -1 : 1;
    z.waves.push({
      n: z.s.waveN,
      y: z.y + z.h * (big ? 0.8 : 0.84),
      px: d > 0 ? z.x + z.w * 0.04 : z.x + z.w * 0.96,
      dir: d,
      age: 0,
      face,
      peel,
      life: 1,
      start: big ? 1.6 : 0.6,
    });
  }
  for (const w of z.waves) {
    w.age += dt;
    // the swell rolls in first; then it breaks and peels along the zone
    const breaking = w.age > w.start;
    w.y -= dt * (big ? 6 : 3.4);
    if (breaking) w.px += w.dir * w.peel * dt;
    const gone = w.dir > 0 ? w.px > z.x + z.w * 0.98 : w.px < z.x + z.w * 0.02;
    if (gone) w.life = Math.max(0, w.life - dt * 1.4);
    if (breaking && w.life > 0.5) {
      // the lip crashing down: foam and spray all along the curl (an explosion at Nazaré)
      const n = big ? 7 : 2;
      for (let k = 0; k < n; k++) {
        const r1 = hash01(w.n, Math.floor(z.t * 60), k);
        const r2 = hash01(w.n, Math.floor(z.t * 61), k + 9);
        const x = w.px - w.dir * (4 + r1 * w.face * (big ? 1.6 : 0.8));
        const y = w.y - w.face * (0.3 + r2 * 0.6);
        z.fx.push({
          k: 'spray',
          x,
          y,
          vx: (r2 - 0.5) * 30,
          vy: -(10 + r1 * (big ? 40 : 18)),
          size: big ? 1.2 + r1 : 0.7 + r1 * 0.5,
        });
      }
      if (big && hash01(w.n, Math.floor(z.t * 8), 3) < 0.2)
        z.fx.push({
          k: 'ring',
          x: w.px - w.dir * w.face,
          y: w.y - w.face * 0.6,
          size: 2.2,
        });
    }
  }
  z.waves = z.waves.filter((w) => w.life > 0);
}

/** The wave a surfer can ride now: breaking, and the peel point close (ahead in its direction). */
function waveNear(z: Zone, x: number, reach: number): Wave | null {
  for (const w of z.waves ?? []) {
    if (w.age < w.start || w.life < 1) continue;
    const ahead = (x - w.px) * w.dir;
    if (ahead > -4 && ahead < reach) return w;
  }
  return null;
}

/** Follow a moving target on the wave: steer the board along the face (velocity locked to the wave). */
function ride(g: Guest, tx: number, ty: number, carry: number, maxSpeed: number, dt: number) {
  const vx = (tx - g.x) * 3.2 + carry;
  const vy = (ty - g.y) * 3.2;
  const sp = Math.min(maxSpeed, Math.hypot(vx, vy));
  if (sp > 1) steer(g, headingOf(v(vx, vy)), 5, dt, 6);
  ease(g, sp, 6, dt);
  move(g, dt);
}

// ---------------------------------------------------------------- one surfer

export function surf(g: Guest, z: Zone, n: number, dt: number) {
  switch (z.level) {
    case 1:
      return school(g, z, n, dt);
    case 2:
      return longboard(g, z, n, dt);
    case 3:
      return reef(g, z, n, dt);
    default:
      return nazare(g, z, n, dt);
  }
}

// ---------------------------------------------------------------- 1 school

function school(g: Guest, z: Zone, n: number, dt: number) {
  const t = z.t;
  const L = baseLook(g, t);
  const home = homeSpot('surfer', g.i, n, z);
  home.y = z.y + z.h * (0.6 + 0.08 * (g.i % 2));
  let rider: Pose;
  // the board floats next to the kid while walking or waiting (model frame of the kid, who faces where it walks)
  const beside = { at: v(52, 10), rot: 0, sx: 1, sy: 1, alpha: 1 };
  switch (g.state) {
    case 'idle':
    case 'walk': {
      const d = Math.hypot(home.x - g.x, home.y - g.y);
      steer(g, headingTo(g, z, home.x, home.y, 26), 3, dt);
      ease(g, Math.min(6, d * 1.5), 2, dt);
      move(g, dt);
      rider = wading(t, g, clamp01(g.speed / 4));
      Object.assign(L.board, beside);
      if (d < 4) setState(g, 'wait', z.active ? 0.5 + 2.5 * hash01(g.i, g.count, 1) : 1e9);
      break;
    }
    case 'wait': {
      // facing the beach, the board next to them, waiting for the foam
      if (z.active && g.dur > 1e8) g.dur = g.st + 0.3 + 2 * hash01(g.i, g.count, 2);
      if (!z.active) g.dur = 1e9;
      steer(g, 0, 1.2, dt);
      ease(g, 0, 2, dt);
      move(g, dt);
      rider = wading(t, g, 0);
      Object.assign(L.board, beside);
      if (g.st >= g.dur) {
        setState(g, 'hop', 0.4);
        g.m.style = hash01(g.i, g.count, 3); // < 0.35 stays lying down, the rest try to stand up
      }
      break;
    }
    case 'hop': {
      // jump on the board as the foam comes
      const k = smooth(g.st / g.dur);
      ease(g, 6, 3, dt);
      move(g, dt);
      L.board.at = lerpV(beside.at, v(0, 0), k);
      rider = lerpPose(shiftPose(wading(t, g, 0), lerpV(v(0, 0), v(0, 0), k)), prone(g, t, 0, 1), k);
      if (g.st >= g.dur) setState(g, 'foam', 4 + 2 * hash01(g.i, g.count, 4));
      break;
    }
    case 'foam':
    default: {
      // the white water pushes the board straight to the beach; most kids try to stand, wobbly, and many fall
      steer(g, 0.1 * Math.sin(g.st * 1.7 + g.phase * 6), 0.6, dt);
      ease(g, 13, 1.2, dt);
      move(g, dt);
      const up = g.m.style > 0.35 ? clamp01((g.st - 1) / 0.5) : 0;
      rider = up > 0 ? lerpPose(prone(g, t, 0, 1), stand(g, t, 1, 1), easeOutBack(up)) : prone(g, t, 0, 1);
      wake(g, z, SURF.wake, 4, 0.5);
      spray(g, z, v(0, 100), 10, 0, dt, 10);
      const falls = g.m.style > 0.35 && hash01(g.i, g.count, 5) < 0.55;
      if (g.state === 'foam' && falls && g.st > 1.9) {
        setState(g, 'fall', 1.2);
        ring(g, z, v(0, 0), 0.8);
        spray(g, z, v(0, 0), 60, 0, 0.3, 14);
      } else if (g.st >= g.dur || g.y < z.y + z.h * 0.16) {
        setState(g, 'off', 0.4);
      }
      if (g.state === 'fall') rider = stand(g, t, 1, 1);
      break;
    }
    case 'fall': {
      // splash: the kid falls off sideways and stands up in the water next to the board
      ease(g, 0, 4, dt);
      move(g, dt);
      const k = g.st / g.dur;
      rider = k < 0.4 ? stand(g, t, 1, 1) : wading(t, g, 0);
      L.riderAlpha = k < 0.25 ? 1 - k * 3 : k < 0.5 ? 0.25 : clamp01((k - 0.5) * 3);
      L.board.rot = 0.6 * smooth(k);
      L.board.at = v(30 * smooth(k), 0);
      if (g.st >= g.dur) {
        g.count++;
        g.h = wrap(g.h + Math.PI);
        setState(g, 'walk');
      }
      break;
    }
    case 'off': {
      // step off in the shallow water and turn around
      ease(g, 0, 4, dt);
      move(g, dt);
      rider = lerpPose(stand(g, t, 1, 0.5), wading(t, g, 0), smooth(g.st / g.dur));
      if (g.st >= g.dur) {
        g.count++;
        g.h = wrap(g.h + Math.PI);
        setState(g, 'walk');
      }
      break;
    }
  }
  keepIn(g, z, 6);
  L.x = g.x;
  L.y = g.y;
  L.rider = rider;
}

// ---------------------------------------------------------------- 2 longboard

/** Walking the board: `k` 0 = normal stance, 1 = at the nose (hang five). */
function noseRide(g: Guest, t: number, k: number): Pose {
  const base = stand(g, t, 2);
  const s = g.mirror ? -1 : 1;
  if (k <= 0) return base;
  // cross-stepping forward: the feet take turns, the body faces the nose a little
  const step = Math.sin(k * Math.PI * 4) * (k < 0.85 ? 1 : 0);
  const fwd = -128 * smooth(k);
  const nose: Pose = {
    ...base,
    t: v(base.t.x, base.t.y + fwd * 0.92),
    hips: v(base.hips.x, base.hips.y + fwd * 0.92),
    feet: [v(s * 3, -122 * smooth(k) + 18 * (1 - smooth(k)) + step * 6), v(s * 3, 82 + fwd * 0.95 - step * 6)],
    // hang five: arms out wide for balance, body upright
    hands: [v(s * 42, base.t.y + fwd * 0.92 - 24), v(-s * 40, base.t.y + fwd * 0.92 + 30)],
  };
  return lerpPose(base, nose, smooth(k));
}

function longboard(g: Guest, z: Zone, n: number, dt: number) {
  const t = z.t;
  const L = baseLook(g, t);
  const home = homeSpot('surfer', g.i, n, z);
  let rider: Pose;
  if (!z.active && ['catch', 'pop', 'ride'].includes(g.state)) setState(g, 'kick', 1.2);
  switch (g.state) {
    case 'idle':
    case 'paddle': {
      const d = Math.hypot(home.x - g.x, home.y - g.y);
      steer(g, headingTo(g, z, home.x, home.y, 34), 1.2, dt);
      ease(g, Math.min(9, d * 1.2), 1.5, dt);
      move(g, dt);
      rider = prone(g, t, g.speed > 1 ? 0.7 : 0, 2);
      if (d < 5) setState(g, 'wait', z.active ? 1.5 + 4 * hash01(g.i, g.count, 1) : 1e9);
      wake(g, z, SURF.wake, 5, 0.5);
      break;
    }
    case 'wait': {
      // long, calm waits between the waves
      if (z.active && g.dur > 1e8) g.dur = g.st + 0.5 + 3.5 * hash01(g.i, g.count, 2);
      if (!z.active) g.dur = 1e9;
      const left = g.dur - g.st;
      const dirX = g.x < z.x + z.w / 2 ? 1 : -1;
      steer(g, left < 1.2 ? dirX * 40 * DEG : Math.PI, 0.8, dt, 2);
      ease(g, 0, 1, dt);
      move(g, dt);
      rider = prone(g, t, left < 1.2 ? 0.6 : 0, 2);
      if (g.st >= g.dur) {
        setState(g, 'catch', 0.9);
        g.m.dir = dirX;
        g.mirror = hash01(g.i, 5) < 0.4;
      }
      break;
    }
    case 'catch': {
      steer(g, g.m.dir * 50 * DEG, 0.8, dt);
      ease(g, 14, 2, dt);
      move(g, dt);
      rider = prone(g, t, 1.2, 2);
      wake(g, z, SURF.wake, 3.5, 0.7);
      if (g.st >= g.dur) setState(g, 'pop', 0.6);
      break;
    }
    case 'pop': {
      // a slow, relaxed pop-up
      ease(g, 17, 2, dt);
      move(g, dt);
      rider = lerpPose(prone(g, t, 0, 2), stand(g, t, 2), smooth(g.st / g.dur));
      wake(g, z, SURF.wake, 3, 0.8);
      if (g.st >= g.dur) {
        setState(g, 'ride', 9 + 4 * hash01(g.i, g.count, 3));
        g.m.walk = 0;
      }
      break;
    }
    case 'ride': {
      // slow trim along the long wave, one wide turn, and a walk to the nose for a hang five
      const D = g.m.dir;
      const wide = Math.sin((g.st / g.dur) * Math.PI * 2) * 22 * DEG;
      steer(g, D * 72 * DEG + wide, 25 * DEG, dt, 1.5);
      ease(g, 18, 0.8, dt);
      move(g, dt);
      const walkK = clamp01((g.st - 2) / 1.6) - clamp01((g.st - 5.6) / 1.6);
      rider = noseRide(g, t, walkK);
      L.board.sx = 1 - Math.abs(leanOf(g)) * 0.004;
      wake(g, z, SURF.wake, 3, 0.9);
      const out = g.y < z.y + z.h * 0.16 || g.x < z.x + 18 || g.x > z.x + z.w - 18;
      if (g.st >= g.dur || out) {
        g.count++;
        setState(g, 'kick', 1.2);
        g.m.kick = D;
      }
      break;
    }
    case 'kick':
    default: {
      // a slow, wide turn back over the wave and lie down again
      steer(g, g.h + (g.m.kick || 1) * 1.5, 70 * DEG, dt, 1);
      ease(g, 5, 2, dt);
      move(g, dt);
      rider = lerpPose(stand(g, t, 2), prone(g, t, 0, 2), smooth((g.st - 0.7) / 0.5));
      if (g.st >= g.dur) setState(g, 'paddle');
      break;
    }
  }
  keepIn(g, z, 8);
  L.x = g.x;
  L.y = g.y;
  L.rider = rider;
}

// ---------------------------------------------------------------- 3 reef

function reef(g: Guest, z: Zone, _n: number, dt: number) {
  const t = z.t;
  const L = baseLook(g, t);
  let rider: Pose;
  // two line-ups, one at each end (rights start on the left, lefts on the right); a surfer paddles back to the nearer one
  const first = g.m.end === undefined;
  if (first) g.m.end = g.i % 2 ? 1 : -1;
  const spread = 0.05 + 0.24 * ((g.i * 0.618) % 1);
  const home = v(z.x + z.w * (g.m.end < 0 ? spread : 1 - spread), z.y + z.h * (0.8 + 0.05 * (g.i % 2)));
  if (first) {
    // they start at their line-up
    g.x = home.x;
    g.y = home.y;
  }
  if (!z.active && ['take', 'ride'].includes(g.state)) setState(g, 'kick', 0.8);
  switch (g.state) {
    case 'idle':
    case 'paddle': {
      const d = Math.hypot(home.x - g.x, home.y - g.y);
      steer(g, headingTo(g, z, home.x, home.y, 26), 1.8, dt);
      ease(g, Math.min(13, d * 1.3), 2, dt);
      move(g, dt);
      rider = prone(g, t, g.speed > 1 ? 1 : 0, 3);
      if (d < 6) setState(g, 'wait');
      wake(g, z, SURF.wake, 4, 0.55);
      break;
    }
    case 'wait': {
      steer(g, Math.PI, 0.8, dt);
      ease(g, 0, 1.5, dt);
      move(g, dt);
      rider = prone(g, t, 0, 3);
      // a wave peeling toward me, and nobody else on it yet: go
      const w = z.active ? waveNear(z, g.x, 22) : null;
      const taken = w && z.guests.some((o) => o !== g && o.m.wave === w.n && ['take', 'ride'].includes(o.state));
      if (w && !taken && Math.abs(g.y - w.y) < 26) {
        g.m.wave = w.n;
        g.m.dir = w.dir;
        g.mirror = w.dir < 0;
        setState(g, 'take', 0.5);
      }
      break;
    }
    case 'take':
    case 'ride': {
      const w = (z.waves ?? []).find((q) => q.n === g.m.wave);
      if (!w || w.life < 1) {
        setState(g, 'kick', 0.8);
        g.m.kick = -(g.m.dir || 1);
        rider = stand(g, t, 3);
        break;
      }
      // where on the wave: ahead of the curl, then back inside the barrel, then out with the spit
      const T = g.state === 'take' ? 0 : g.st;
      const inside = g.state === 'ride' && T > 1.1 && T < 2.9;
      const ahead = g.state === 'take' ? 12 : T < 1.1 ? lerp(14, 4, T / 1.1) : inside ? 1.5 - 2 * Math.sin((T - 1.1) * 2) : lerp(6, 26, clamp01((T - 2.9) / 0.6));
      const face = w.face * (inside ? 0.45 : 0.55 + 0.25 * Math.sin(T * 3.1));
      ride(g, w.px + w.dir * ahead, w.y - face, w.dir * w.peel, 70, dt);
      if (g.state === 'take') {
        rider = lerpPose(prone(g, t, 1.4, 3), stand(g, t, 3), easeOutBack(g.st / g.dur));
        if (g.st >= g.dur) setState(g, 'ride', 4.2 + 1.5 * hash01(g.i, g.count, 7));
      } else {
        rider = stand(g, t, 3);
        // hidden under the lip; the curl is drawn over the surfer
        const cover = inside ? smooth((T - 1.1) / 0.3) * smooth((2.9 - T) / 0.3) : 0;
        L.riderAlpha = 1 - 0.7 * cover;
        L.board.alpha = 1 - 0.55 * cover;
        // the spit: spray blown out of the barrel as the surfer comes out
        if (T > 2.8 && T < 3.2) spray(g, z, v(0, -40), 220, 0, dt, 44);
        if (T > 3.6 && !g.m.snap) {
          g.m.snap = 1;
          spray(g, z, v(w.dir > 0 ? -30 : 30, 60), 160, w.dir > 0 ? -1 : 1, 0.2, 40);
        }
        if (g.st >= g.dur) {
          g.count++;
          g.m.snap = 0;
          if (hash01(g.i, g.count, 6) < 0.12) {
            // the barrel closed on the surfer
            setState(g, 'wipeout', 1.2);
            ring(g, z, v(0, 0), 1.3);
          } else {
            setState(g, 'kick', 0.8);
            g.m.kick = w.dir > 0 ? -1 : 1;
          }
          g.m.end = g.x < z.x + z.w / 2 ? -1 : 1;
        }
      }
      wake(g, z, SURF.wake, 2.4, 1);
      const carve = Math.abs(g.turn) * g.speed * 0.9;
      if (carve > 10) spray(g, z, v(g.turn > 0 ? -30 : 30, 70), carve, g.turn > 0 ? -1 : 1, dt, 30);
      break;
    }
    case 'kick': {
      // over the back of the wave, toward the open sea
      steer(g, Math.PI + (g.m.kick || 1) * 0.4, 4, dt, 2);
      ease(g, 8, 2.5, dt);
      move(g, dt);
      rider = lerpPose(stand(g, t, 3), prone(g, t, 0, 3), smooth((g.st - 0.5) / 0.3));
      if (g.st >= g.dur) setState(g, 'paddle');
      break;
    }
    case 'wipeout':
    default: {
      ease(g, 0, 3, dt);
      move(g, dt);
      const k = g.st;
      rider = k > 0.8 ? prone(g, t, 0, 3) : stand(g, t, 3);
      L.riderAlpha = k < 0.3 ? 1 - k / 0.3 : k > 0.8 ? clamp01((k - 0.8) / 0.3) : 0;
      L.board.rot = 1.2 * smooth(k / 0.8) * (g.i % 2 ? 1 : -1);
      if (k < 0.5) spray(g, z, v(0, 0), 60, 0, dt, 24);
      if (g.st >= g.dur) {
        g.h += L.board.rot;
        setState(g, 'paddle');
      }
      break;
    }
  }
  keepIn(g, z, 6);
  L.x = g.x;
  L.y = g.y;
  L.rider = rider;
}

// ---------------------------------------------------------------- 4 Nazaré

/** The jet ski of a pair: tows its surfer onto a wave and picks it up again on the sled. */
function ensureJetSkis(z: Zone, n: number) {
  while (z.extras.length < Math.min(2, Math.max(1, n))) {
    const j = newGuest('surfer', 100 + z.extras.length, z, 1);
    j.kind = 'jetski';
    j.x = z.x + z.w * (0.3 + 0.4 * z.extras.length);
    j.y = z.y + z.h * 0.92;
    j.h = Math.PI / 2;
    z.extras.push(j);
  }
}

/** The jet ski driver, sitting, hands on the handlebar. */
const DRIVER: Pose = {
  ...FORWARD,
  t: v(0, 6),
  legs: 0,
  hands: [v(-24, -34), v(24, -34)],
  neck: 6,
};

export function stepJetSki(j: Guest, z: Zone, dt: number) {
  const t = z.t;
  const L = baseLook(j, t);
  j.st += dt;
  const s = z.guests.find((g) => g.m.ski === j.i);
  // 'tow' drives the surfer to the wave; 'away' peels off; 'pick' drives to the surfer; 'carry' back out with it
  let tx = z.x + z.w * 0.5;
  let ty = z.y + z.h * 0.93;
  let pace = 24;
  if (j.state === 'tow' && s) {
    const w = (z.waves ?? []).find((q) => q.n === s.m.wave);
    if (w) {
      // along the swell, toward where it will break, just in front of it
      tx = w.px + w.dir * 30;
      ty = w.y - 6;
      pace = 44;
    }
  } else if (j.state === 'pick' && s) {
    tx = s.x;
    ty = s.y;
    pace = 40;
  } else if (j.state === 'carry') {
    tx = z.x + z.w * (0.25 + 0.5 * (j.i % 2));
    ty = z.y + z.h * 0.94;
    pace = 30;
  } else {
    tx = z.x + z.w * (0.2 + 0.6 * (j.i % 2));
    ty = z.y + z.h * 0.95;
    pace = 16;
  }
  const d = Math.hypot(tx - j.x, ty - j.y);
  steer(j, headingTo(j, z, tx, ty, 10), 3, dt, 3);
  ease(j, Math.min(pace, d * 2.2), 2, dt);
  move(j, dt);
  keepIn(j, z, 4);
  if (j.speed > 6) {
    wake(j, z, [v(-20, 76), v(20, 76)], 2.6, 1);
    spray(j, z, v(0, 74), j.speed * 0.6, 0, dt, 18);
  }
  L.x = j.x;
  L.y = j.y;
  L.h = j.h + Math.sin(t * 9 + j.i) * 0.03 * clamp01(j.speed / 20);
  L.rider = DRIVER;
  if (j.state === 'pick' && s && d < 6) setState(j, 'carry');
}

function nazare(g: Guest, z: Zone, n: number, dt: number) {
  const t = z.t;
  const L = baseLook(g, t);
  ensureJetSkis(z, n);
  const ski = z.extras[g.i % z.extras.length];
  g.m.ski = ski.i;
  let rider: Pose;
  const stern = () => {
    const back = dir(ski.h + Math.PI);
    return v(ski.x + back.x * 17, ski.y + back.y * 17);
  };
  if (!g.state || g.state === 'idle') setState(g, 'sled');
  switch (g.state) {
    case 'sled': {
      // lying on the jet ski's rescue sled, the board under the arm
      const st = stern();
      g.x = st.x;
      g.y = st.y;
      g.h = ski.h;
      g.speed = ski.speed;
      rider = prone(g, t, 0, 4);
      L.board.alpha = 0;
      // my turn: a new wave and the other pair is not on it -> the tow starts
      const mine = z.active && (z.waves ?? []).find((w) => w.age < w.start && w.n % z.extras.length === ski.i - 100 && !z.guests.some((o) => o !== g && o.m.wave === w.n));
      if (mine && ski.state !== 'pick') {
        g.m.wave = mine.n;
        setState(g, 'tow');
        setState(ski, 'tow');
      }
      break;
    }
    case 'tow': {
      // standing on the gun, holding the rope behind the jet ski
      const st = stern();
      const back = dir(ski.h + Math.PI);
      const tx = st.x + back.x * 26;
      const ty = st.y + back.y * 26;
      g.x += (tx - g.x) * Math.min(1, dt * 6);
      g.y += (ty - g.y) * Math.min(1, dt * 6);
      g.h = ski.h;
      g.speed = ski.speed;
      g.odo += g.speed * dt;
      rider = stand(g, t, 4);
      L.tow = st;
      wake(g, z, SURF.wake, 2.6, 0.9);
      const w = (z.waves ?? []).find((q) => q.n === g.m.wave);
      if (!w || w.age >= w.start) {
        // let go of the rope: the jet ski turns away, the surfer drops in
        setState(g, 'drop', 0.9);
        setState(ski, 'away');
        g.m.dir = w ? w.dir : 1;
        g.mirror = g.m.dir < 0;
      }
      break;
    }
    case 'drop':
    case 'ride': {
      const w = (z.waves ?? []).find((q) => q.n === g.m.wave);
      if (!w) {
        setState(g, 'swim', 1);
        rider = stand(g, t, 4);
        break;
      }
      if (g.state === 'drop') {
        // straight down the giant face, as fast as it goes
        steer(g, w.dir * 25 * DEG, 3, dt, 4);
        ease(g, 70, 3, dt);
        move(g, dt);
        rider = stand(g, t, 4);
        spray(g, z, v(0, 100), 80, 0, dt, 30);
        if (g.st >= g.dur) setState(g, 'ride', 3.2);
      } else {
        // bottom turn into the barrel, then out in a cloud of spray (or the wave wins)
        const T = g.st;
        const inside = T > 0.6 && T < 2.4;
        const ahead = T < 0.6 ? 14 : inside ? 2 : lerp(6, 34, clamp01((T - 2.4) / 0.6));
        ride(g, w.px + w.dir * ahead, w.y - w.face * (inside ? 0.45 : 0.6), w.dir * w.peel, 110, dt);
        rider = stand(g, t, 4);
        const cover = inside ? smooth((T - 0.6) / 0.3) * smooth((2.4 - T) / 0.3) : 0;
        L.riderAlpha = 1 - 0.75 * cover;
        L.board.alpha = 1 - 0.6 * cover;
        if (T > 2.3 && T < 2.8) spray(g, z, v(0, -40), 320, 0, dt, 60);
        if (g.st >= g.dur) {
          g.count++;
          if (hash01(g.i, g.count, 6) < 0.35) {
            setState(g, 'wipeout', 1.4);
            ring(g, z, v(0, 0), 2.4);
            spray(g, z, v(0, 0), 200, 0, 0.3, 50);
          } else setState(g, 'swim', 0.6);
        }
      }
      wake(g, z, SURF.wake, 2.2, 1.2);
      break;
    }
    case 'wipeout': {
      // gone in the foam: the board tumbles away
      ease(g, 12, 2, dt);
      move(g, dt);
      rider = stand(g, t, 4);
      L.riderAlpha = 0;
      L.board.rot = g.st * 9;
      L.board.alpha = clamp01(1.4 - g.st);
      if (g.st >= g.dur) setState(g, 'swim', 0.2);
      break;
    }
    case 'swim':
    default: {
      // in the water, waiting for the jet ski: only head and shoulders, the board next to them
      ease(g, 0, 2, dt);
      move(g, dt);
      rider = { ...wading(t, g, 0), t: v(0, 0) };
      L.riderScale = 0.85;
      L.board.at = v(40, 0);
      if (g.st >= g.dur && ski.state !== 'pick' && ski.state !== 'carry') setState(ski, 'pick');
      if (ski.state === 'carry' && Math.hypot(ski.x - g.x, ski.y - g.y) < 10) setState(g, 'sled');
      break;
    }
  }
  keepIn(g, z, 4);
  L.x = g.x;
  L.y = g.y;
  L.h = g.state === 'sled' || g.state === 'tow' ? g.h : L.h;
  L.rider = rider;
}
