import { FACILITIES } from '../config/facilities';
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
}

export interface GameState {
  version: number;
  coins: number;
  reputation: number;
  totalCoins: number;
  sports: Record<string, boolean>;
  zones: Record<string, ZoneState>;
  facilities: Record<string, number>;
  /** Real time (ms since 1970) when the game was last saved or updated. */
  savedAt: number;
  startedAt: number;
}

export const SAVE_VERSION = 1;

export function newZone(owned = false): ZoneState {
  return { owned, capacity: 0, price: 0, speed: 0, manager: false, phase: 'idle', elapsed: 0, pending: 0, pendingRep: 0 };
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
    savedAt: now,
    startedAt: now,
  };
  ensureState(state);
  // The player starts with the first level of the first sport.
  const first = SPORTS.find((s) => s.order === 1)!;
  state.sports[first.id] = true;
  state.zones[zoneId(first.id, 1)].owned = true;
  return state;
}

/** Fill in anything missing (new sports, zones or facilities added since the save was made). */
export function ensureState(state: GameState): GameState {
  for (const s of SPORTS) state.sports[s.id] ??= false;
  for (const z of ZONES) state.zones[z.id] ??= newZone();
  for (const f of FACILITIES) state.facilities[f.id] ??= 0;
  return state;
}

export function isSportUnlocked(state: GameState, id: SportId): boolean {
  return !!state.sports[id];
}
