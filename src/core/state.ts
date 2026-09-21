import { FACILITIES } from '../config/facilities';
import { areaById } from '../config/areas';
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
  /** Coins and reputation waiting to be collected (zones without a manager). */
  pending: number;
  pendingRep: number;
  /** Finished sessions and guests served in this zone (for quests). */
  sessions: number;
  served: number;
}

export interface GameState {
  version: number;
  coins: number;
  reputation: number;
  totalCoins: number;
  sports: Record<string, boolean>;
  zones: Record<string, ZoneState>;
  facilities: Record<string, number>;
  /** Beach expansions bought so far. Each one opens an area, multiplies income and restarts the beach. */
  expansions: number;
  /** The quests on offer (three at a time) and how many were completed. */
  quests: import('./quests').Quest[];
  questsDone: number;
  /** Real time (ms since 1970) when the game was last saved or updated. */
  savedAt: number;
  startedAt: number;
}

export const SAVE_VERSION = 3;

export function newZone(owned = false): ZoneState {
  return { owned, capacity: 0, price: 0, speed: 0, manager: false, phase: 'idle', elapsed: 0, pending: 0, pendingRep: 0, sessions: 0, served: 0 };
}

export function newGame(now: number): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    coins: 0,
    reputation: 0,
    totalCoins: 0,
    sports: {},
    zones: {},
    facilities: {},
    expansions: 0,
    quests: [],
    questsDone: 0,
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
  return state;
}

export function isSportUnlocked(state: GameState, id: SportId): boolean {
  return !!state.sports[id];
}
