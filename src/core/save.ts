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

const CODE_PREFIX = 'SURF1:';

/** The whole save as a piece of text the player can copy (to back it up or move it to another device). */
export function exportSave(state: GameState): string {
  const json = toJson(state);
  return CODE_PREFIX + btoa(unescape(encodeURIComponent(json)));
}

/** Read a save code. Returns the game if the text is a valid save of this version, otherwise null. */
export function parseSave(text: string): GameState | null {
  try {
    const t = text.trim();
    const json = t.startsWith(CODE_PREFIX) ? decodeURIComponent(escape(atob(t.slice(CODE_PREFIX.length)))) : t;
    const parsed = JSON.parse(json) as GameState;
    if (!parsed || parsed.version !== SAVE_VERSION || typeof parsed.coins !== 'number' || typeof parsed.zones !== 'object' || !parsed.zones) return null;
    return ensureState(parsed);
  } catch {
    return null;
  }
}

/** Store a game as the current save (used when the player restores a save code; the page reloads afterwards). */
export function writeSave(state: GameState, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(SAVE_KEY, toJson(state));
  } catch {
    // ignore
  }
}
