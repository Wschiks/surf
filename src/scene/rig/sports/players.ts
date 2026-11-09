import { clamp01, DEG, lerp, lerpV, TAU, turnPose, v, type Pose } from '../geom';
import { FORWARD } from '../models';
// ---------------------------------------------------------------- beach players (3.7, 4.4.7)

/** What a beach player is doing right now (the arms show it). */
export type PlayerAct = 'ready' | 'pass' | 'set' | 'spike' | 'kick';

/**
 * A beach player seen from above, facing -y: the run cycle (4.3) while moving, and the volleyball / soccer poses.
 * `k` is 0..1 through the action (a spike jumps). Returns the pose and the jump (0..1).
 */
export function playerPose(t: number, phase: number, speed: number, act: PlayerAct, k: number): { pose: Pose; jump: number } {
  const run = clamp01(speed / 18);
  const period = lerp(0.45, 0.28, run);
  const s = Math.sin((TAU * t) / period + phase * TAU) * (speed > 2 ? 1 : 0);
  const amt = clamp01(speed / 8);
  let p: Pose = {
    ...FORWARD,
    legs: amt,
    feet: [v(9, -20 * s * amt), v(-9, 20 * s * amt)],
    hands: [v(-28, 16 + 18 * s * amt), v(28, 16 - 18 * s * amt)],
  };
  p = turnPose(p, 6 * DEG * s * amt, p.t);
  let jump = 0;
  const up = Math.sin(Math.PI * clamp01(k));
  switch (act) {
    case 'pass':
      p = { ...p, hands: [v(-5, -42), v(5, -42)] };
      break;
    case 'set':
      p = { ...p, hands: [v(-9, -27), v(9, -27)] };
      break;
    case 'spike':
      p = { ...p, hands: [v(14, -50), v(-26, 10)], legs: 0 };
      jump = up;
      break;
    case 'kick':
      p = {
        ...p,
        legs: 1,
        feet: [lerpV(p.feet[0], v(4, -34), up), lerpV(p.feet[1], v(-9, 12), up)],
        hands: [v(-30, 4), v(30, 10)],
      };
      break;
    default:
      if (speed < 2) {
        // ready: a little bounce on the toes
        const b = Math.sin(TAU * 1.1 * t + phase * TAU) * 2;
        p = { ...p, hands: [v(-30, 16 + b), v(30, 16 - b)] };
      }
  }
  return { pose: p, jump };
}
