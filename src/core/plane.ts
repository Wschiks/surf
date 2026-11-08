import { PLANE } from '../config/plane';
import { autoIncomePerSecond } from './economy';
import { addSkillPoints } from './skills';
import type { GameState } from './state';

export type PlanePrize = { kind: 'coins'; coins: number } | { kind: 'boost'; seconds: number } | { kind: 'gems'; gems: number };

/** The plane only comes once a zone has a manager (so the coins counter is not 0). */
export function planeUnlocked(state: GameState): boolean {
  return Object.values(state.zones).some((z) => z.owned && z.manager);
}

/** Seconds until the next plane. `r` is a random number from 0 to 1. */
export function planeDelay(when: 'first' | 'claimed' | 'missed', r = Math.random()): number {
  const [from, to] = when === 'first' ? PLANE.first : when === 'claimed' ? PLANE.afterClaim : PLANE.afterMiss;
  return from + (to - from) * r;
}

/** Pick the prize for the next plane (before it appears). Coins are the coins-per-second counter times 5 minutes. */
export function rollPlanePrize(state: GameState, r = Math.random()): PlanePrize {
  const p = PLANE.prizes;
  if (r < p.coins.chance) return { kind: 'coins', coins: autoIncomePerSecond(state) * p.coins.seconds };
  if (r < p.coins.chance + p.boost.chance) return { kind: 'boost', seconds: p.boost.seconds };
  return { kind: 'gems', gems: p.gems.gems };
}

/** Give the prize. The coins x2 time is added to the boost timer. */
export function claimPlanePrize(state: GameState, prize: PlanePrize) {
  if (prize.kind === 'coins') {
    state.coins += prize.coins;
    state.totalCoins += prize.coins;
  } else if (prize.kind === 'boost') state.boost += prize.seconds;
  else addSkillPoints(state, prize.gems);
}
