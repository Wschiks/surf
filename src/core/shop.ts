import { AD_COOLDOWN_SECONDS, AD_STEPS, type AdStep } from '../config/shop';
import { addSkillPoints } from './skills';
import type { GameState } from './state';

export interface AdStreak {
  /** Index of the reward the next ad gives (0 to 4). */
  step: number;
  reward: AdStep;
  /** Seconds until the streak can be used again (0 = ready now). */
  lockedFor: number;
}

export function adStreak(state: GameState, now: number): AdStreak {
  const step = Math.min(Math.max(0, state.adShop.step), AD_STEPS.length - 1);
  return { step, reward: AD_STEPS[step], lockedFor: Math.max(0, Math.ceil((state.adShop.lockedUntil - now) / 1000)) };
}

/** Give the reward of the next ad in the streak. After the 5th the streak is locked for a day. Returns the reward, or null while locked. */
export function claimAdStep(state: GameState, now: number): AdStep | null {
  const s = adStreak(state, now);
  if (s.lockedFor > 0) return null;
  if ('gems' in s.reward) addSkillPoints(state, s.reward.gems);
  else state.boost = Math.max(state.boost, s.reward.boost);
  if (s.step + 1 >= AD_STEPS.length) {
    state.adShop.step = 0;
    state.adShop.lockedUntil = now + AD_COOLDOWN_SECONDS * 1000;
  } else {
    state.adShop.step = s.step + 1;
  }
  return s.reward;
}
