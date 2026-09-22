import { ensureState, newGame, SAVE_VERSION, type GameState } from './state';

export const SAVE_KEY = 'surf-tycoon-save-v1';

/** The save as text. Purchases (`perks`) are left out: they live apart from the save (see perks.ts). */
function toJson(state: GameState): string {
  return JSON.stringify(state, (key, value) => (key === 'perks' ? undefined : value));
}

export function loadGame(now: number, storage: Pick<Storage, 'getItem'> | null = safeStorage()): GameState {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && parsed.version === SAVE_VERSION && typeof parsed.coins === 'number') return ensureState(parsed);
    }
  } catch {
    // a broken save starts a new game
  }
  return newGame(now);
}

export function saveGame(state: GameState, now: number, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  state.savedAt = now;
  try {
    storage?.setItem(SAVE_KEY, toJson(state));
  } catch {
    // storage full or blocked: keep playing
  }
}

export function resetSave(storage: Pick<Storage, 'removeItem'> | null = safeStorage()) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
