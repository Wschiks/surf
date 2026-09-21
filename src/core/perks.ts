// What the player bought (remove ads, coins x5). It is kept apart from the game save on purpose: it is not part of a
// save code, so a code cannot hand out purchases, and "Start over" does not lose them.

export interface Perks {
  noAds?: boolean;
  x5?: boolean;
}

export const PERKS_KEY = 'surf-tycoon-perks-v1';

export function loadPerks(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Perks {
  try {
    const p = JSON.parse(storage?.getItem(PERKS_KEY) ?? '{}') as Perks;
    return { noAds: p.noAds === true, x5: p.x5 === true };
  } catch {
    return {};
  }
}

export function savePerks(perks: Perks, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(PERKS_KEY, JSON.stringify({ noAds: !!perks.noAds, x5: !!perks.x5 }));
  } catch {
    // storage blocked: the purchase is restored from the store on the next start
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Ids of the gem-pack purchases already paid out, so a purchase can never be paid out twice (kept apart from the save too). */
export const GRANTED_KEY = 'surf-tycoon-granted-v1';
const KEEP = 100;

export function loadGranted(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string[] {
  try {
    const v = JSON.parse(storage?.getItem(GRANTED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveGranted(ids: string[], storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(GRANTED_KEY, JSON.stringify(ids.slice(-KEEP)));
  } catch {
    // ignore
  }
}
