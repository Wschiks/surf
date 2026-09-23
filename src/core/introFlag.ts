// Whether the first-run intro has already been shown (or did not apply) on this device. Kept in its own storage key,
// separate from the game save, on purpose: "Start over" erases the save but a returning player who chooses to start
// over already knows how to play, so the intro must not come back just because the save did.

const KEY = 'surf-tycoon-intro-v1';

export function introSeen(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen(storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(KEY, '1');
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
