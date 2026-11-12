// The daily rewards calendar (config/calendar.ts): one tile a day you play, 24 a month, a new calendar on the 1st.
// Pure logic; the date comes in as a parameter (the phone's own local date).

import { CALENDAR, CALENDAR_MIN_INCOME, CALENDAR_TILES, MONTH_SKINS, type CalendarReward } from '../config/calendar';
import { autoIncomePerSecond } from './economy';
import { addSkillPoints } from './skills';
import { giveBox, givePieces, type BoxResult } from './skins';
import type { GameState } from './state';

export interface CalendarState {
  /** The month the claims belong to ("2026-11"). */
  month: string;
  /** Tiles claimed this month. */
  claimed: number;
  /** The day of the last claim ("2026-11-09"). */
  last: string;
}

export function newCalendar(): CalendarState {
  return { month: '', claimed: 0, last: '' };
}

export function ensureCalendar(state: GameState) {
  const c = (state.calendar ??= newCalendar());
  c.month ??= '';
  c.claimed ??= 0;
  c.last ??= '';
}

const two = (n: number) => String(n).padStart(2, '0');
export const monthKey = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}`;
export const dayKey = (d: Date) => `${monthKey(d)}-${two(d.getDate())}`;

export interface CalendarStatus {
  /** Tiles claimed this month (0 at the start of a new month). */
  claimed: number;
  /** A tile can be claimed now (not yet today, not all 24, and the phone's date did not go back). */
  canClaim: boolean;
  /** The four skins of this month (week 1 to 4). */
  skins: [string, string, string, string];
  /** Milliseconds until the next day starts (local midnight). */
  msToTomorrow: number;
}

export function calendarStatus(state: GameState, now: Date): CalendarStatus {
  const c = state.calendar;
  const month = monthKey(now);
  const today = dayKey(now);
  const claimed = c.month === month ? c.claimed : 0;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    claimed,
    canClaim: claimed < CALENDAR_TILES && c.last < today,
    skins: MONTH_SKINS[now.getMonth()],
    msToTomorrow: tomorrow.getTime() - now.getTime(),
  };
}

/** The skin of a star tile in a month. */
export function calendarSkin(now: Date, week: number): string {
  return MONTH_SKINS[now.getMonth()][week];
}

/** The coins a coins tile gives right now. */
export function calendarCoins(state: GameState, hours: number): number {
  return Math.max(autoIncomePerSecond(state), CALENDAR_MIN_INCOME) * hours * 3600;
}

export interface Claimed {
  reward: CalendarReward;
  /** Coins given (coins tiles). */
  coins?: number;
  /** The pieces given (star tiles); null when the skin was complete and a golden box was given instead. */
  pieces?: BoxResult | null;
}

/**
 * Claim today's tile. `double` doubles everything but the skin pieces (watched an ad, or Remove ads / the Surf Club).
 * Returns null when nothing can be claimed.
 */
export function claimCalendar(state: GameState, now: Date, double = false): Claimed | null {
  const st = calendarStatus(state, now);
  if (!st.canClaim) return null;
  const c = state.calendar;
  const reward = CALENDAR[st.claimed];
  const k = double ? 2 : 1;
  c.month = monthKey(now);
  c.claimed = st.claimed + 1;
  c.last = dayKey(now);
  switch (reward.kind) {
    case 'gems':
      addSkillPoints(state, reward.gems * k);
      return { reward };
    case 'boxes':
      giveBox(state, reward.boxes * k);
      return { reward };
    case 'coins': {
      const coins = calendarCoins(state, reward.hours) * k;
      state.coins += coins;
      state.totalCoins += coins;
      return { reward, coins };
    }
    case 'boost':
      state.boost += reward.minutes * 60 * k;
      return { reward };
    case 'skin': {
      const pieces = givePieces(state, calendarSkin(now, reward.week), reward.pieces);
      // the skin is already complete: a golden treasure box instead
      if (!pieces) state.skins.golden++;
      return { reward, pieces };
    }
  }
}
