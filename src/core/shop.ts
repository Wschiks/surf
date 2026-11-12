import { AD_COOLDOWN_SECONDS, AD_STEPS, CLUB, COIN_PACKS, GEM_PACKS, type AdStep, type CoinPackId, type GemPackId } from '../config/shop';
import { autoIncomePerSecond } from './economy';
import { loadGranted, saveGranted } from './perks';
import { addSkillPoints } from './skills';
import type { GameState } from './state';

export interface AdStreak {
  /** Index of the reward the next ad gives (0 to 4). */
  step: number;
  reward: AdStep;
  /** Seconds until the streak can be used again (0 = ready now). */
  lockedFor: number;
}

/** When the day of the streak that started at `startedAt` is over (0 = no day running). */
function dayEnd(state: GameState): number {
  return state.adShop.startedAt > 0 ? state.adShop.startedAt + AD_COOLDOWN_SECONDS * 1000 : 0;
}

export function adStreak(state: GameState, now: number): AdStreak {
  // a day that ran out before all five ads were watched starts over at the first reward
  const expired = state.adShop.step > 0 && dayEnd(state) > 0 && now >= dayEnd(state);
  const step = expired ? 0 : Math.min(Math.max(0, state.adShop.step), AD_STEPS.length - 1);
  return { step, reward: AD_STEPS[step], lockedFor: Math.max(0, Math.ceil((state.adShop.lockedUntil - now) / 1000)) };
}

/**
 * Give the reward of the next ad in the streak. The day starts with the first ad: after the 5th the streak is locked
 * until 24 hours after that first ad (not after the last). Returns the reward, or null while locked.
 */
export function claimAdStep(state: GameState, now: number): AdStep | null {
  const s = adStreak(state, now);
  if (s.lockedFor > 0) return null;
  if (s.step === 0) state.adShop.startedAt = now;
  if ('gems' in s.reward) addSkillPoints(state, s.reward.gems);
  else state.boost = Math.max(state.boost, s.reward.boost);
  if (s.step + 1 >= AD_STEPS.length) {
    state.adShop.step = 0;
    state.adShop.lockedUntil = dayEnd(state);
  } else {
    state.adShop.step = s.step + 1;
  }
  return s.reward;
}

/**
 * Pay out a bought gem pack. `transactionId` is the store's id of the purchase: it is remembered, so the same purchase
 * (for example one reported again after the app was closed) is never paid out twice. Returns the gems given (0 if it was already paid).
 */
export function grantGemPack(state: GameState, id: GemPackId, transactionId: string, seen: string[] = loadGranted(), remember: (ids: string[]) => void = saveGranted): number {
  const pack = GEM_PACKS.find((p) => p.id === id);
  if (!pack || !transactionId || seen.includes(transactionId)) return 0;
  addSkillPoints(state, pack.gems);
  remember([...seen, transactionId]);
  return pack.gems;
}

export interface ClubStatus {
  active: boolean;
  /** Seconds until the daily gems can be claimed (0 = ready). */
  nextIn: number;
}

export function clubStatus(state: GameState, now: number): ClubStatus {
  return { active: !!state.perks.club, nextIn: Math.max(0, Math.ceil((state.clubNext - now) / 1000)) };
}

/** Members can claim their daily gems once every 24 hours (missed days do not add up). Returns the gems given. */
export function claimClubGems(state: GameState, now: number): number {
  const c = clubStatus(state, now);
  if (!c.active || c.nextIn > 0) return 0;
  addSkillPoints(state, CLUB.gemsPerDay);
  state.clubNext = now + CLUB.claimSeconds * 1000;
  return CLUB.gemsPerDay;
}

/** The coins a coin pack gives right now: the coins-per-second counter x its hours. */
export function coinPackValue(state: GameState, id: CoinPackId): number {
  const pack = COIN_PACKS.find((p) => p.id === id)!;
  return autoIncomePerSecond(state) * pack.hours * 3600;
}

/** Buy a coin pack with gems. Not possible without the gems, or while nothing earns coins yet (no manager). */
export function buyCoinPack(state: GameState, id: CoinPackId): number {
  const pack = COIN_PACKS.find((p) => p.id === id)!;
  const coins = coinPackValue(state, id);
  if (state.skillPoints < pack.gems || coins <= 0) return 0;
  state.skillPoints -= pack.gems;
  state.coins += coins;
  state.totalCoins += coins;
  return coins;
}
