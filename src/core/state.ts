import type { Perks } from './perks';
import { FACILITIES } from '../config/facilities';
import { areaById } from '../config/areas';
import { rootSkills } from './skills';
import { SPORTS, ZONES, zoneId, type SportId } from '../config/sports';

export type Phase = 'idle' | 'running' | 'ready';

export interface ZoneState {
  owned: boolean;
  capacity: number;
  price: number;
  speed: number;
  manager: boolean;
  phase: Phase;
  /** Seconds into the current session. */
  elapsed: number;
  /** Coins waiting to be collected (zones without a manager). */
  pending: number;
  /** Finished sessions and guests served in this zone (for quests). */
  sessions: number;
  served: number;
}

export interface GameState {
  version: number;
  coins: number;
  totalCoins: number;
  sports: Record<string, boolean>;
  zones: Record<string, ZoneState>;
  facilities: Record<string, number>;
  /** Beach expansions bought so far. Each one opens an area, multiplies income and restarts the beach. */
  expansions: number;
  /** The quests on offer (three at a time) and how many were completed. */
  quests: import('./quests').Quest[];
  questsDone: number;
  /** How many quests were ever made (every 5th one is a gem quest). */
  questsMade: number;
  /** The second currency, earned from quests and expansions and spent on skills. */
  skillPoints: number;
  skillEarned: number;
  /** Hints the player has already seen (or followed): they are shown once. */
  tips: { introDone?: boolean; levels?: boolean; skills?: boolean; sports?: boolean; beach?: boolean; expand?: boolean };
  /** Seconds left of the ad boost (all coin income x2). It runs down in real time, also while away. */
  boost: number;
  /** Progress in the shop's ad streak: the next reward and when the streak can be used again (ms since 1970). */
  adShop: { step: number; lockedUntil: number };
  /** When the Surf Club gems can be claimed again (ms since 1970). */
  clubNext: number;
  /** What the player bought. Not saved with the game (see perks.ts): the game fills it in after loading. */
  perks: Perks;
  /** Learned skills. Permanent: they stay when the beach is expanded. */
  skills: Record<string, boolean>;
  /** Real time (ms since 1970) when the game was last saved or updated. */
  savedAt: number;
  startedAt: number;
}

export const SAVE_VERSION = 3;

export function newZone(owned = false): ZoneState {
  return { owned, capacity: 0, price: 0, speed: 0, manager: false, phase: 'idle', elapsed: 0, pending: 0, sessions: 0, served: 0 };
}

export function newGame(now: number): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    coins: 0,
    totalCoins: 0,
    sports: {},
    zones: {},
    facilities: {},
    expansions: 0,
    quests: [],
    questsDone: 0,
    questsMade: 0,
    skillPoints: 0,
    skillEarned: 0,
    tips: {},
    boost: 0,
    adShop: { step: 0, lockedUntil: 0 },
    clubNext: 0,
    perks: {},
    skills: rootSkills(),
    savedAt: now,
    startedAt: now,
  };
  ensureState(state);
  openAreas(state);
  return state;
}

/** Every sport in an open area is unlocked and has its first level, free. */
export function openAreas(state: GameState) {
  for (const sport of SPORTS) {
    if (areaById(sport.area).expansion > state.expansions) continue;
    if (sport.unlock) continue; // sports with an unlock rule are earned again in every part of the game
    state.sports[sport.id] = true;
    const z = state.zones[zoneId(sport.id, 1)];
    if (!z.owned) {
      z.owned = true;
      z.phase = 'idle';
    }
  }
}

/** Fill in anything missing (new sports, zones or facilities added since the save was made). */
export function ensureState(state: GameState): GameState {
  for (const s of SPORTS) state.sports[s.id] ??= false;
  for (const z of ZONES) state.zones[z.id] ??= newZone();
  for (const z of Object.values(state.zones)) {
    z.sessions ??= 0;
    z.served ??= 0;
  }
  for (const f of FACILITIES) state.facilities[f.id] ??= 0;
  state.expansions ??= 0;
  state.quests ??= [];
  state.questsDone ??= 0;
  state.questsMade ??= 0;
  state.skillPoints ??= 0;
  state.skillEarned ??= 0;
  state.tips ??= {};
  state.boost ??= 0;
  state.adShop ??= { step: 0, lockedUntil: 0 };
  state.clubNext ??= 0;
  state.perks = {}; // never taken from a save

  state.skills = { ...rootSkills(), ...(state.skills ?? {}) };
  return state;
}

export function isSportUnlocked(state: GameState, id: SportId): boolean {
  return !!state.sports[id];
}
