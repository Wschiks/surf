// What the player bought (remove ads, coins x5). It is kept apart from the game save on purpose: a forged or restored
// save cannot hand out purchases, and "Start over" does not lose them.

export interface Perks {
  noAds?: boolean;
  x5?: boolean;
  /** Surf Club member right now (worked out from `clubUntil`; not stored itself). */
  club?: boolean;
  /** Until when the subscription is paid (ms since 1970), as last reported by the store. Kept on the device, so it also works offline. */
  clubUntil?: number;
}

/** Work out whether the Club is active at `now`. Call it often: the subscription can run out while the game is open. */
export function refreshClub(perks: Perks, now = Date.now()): boolean {
  perks.club = (perks.clubUntil ?? 0) > now;
  return perks.club;
}

/** Rewards come without showing an ad (bought "Remove ads", or Club member). */
export function adFree(perks: Perks): boolean {
  return !!perks.noAds || !!perks.club;
}

export const PERKS_KEY = 'surf-tycoon-perks-v1';

export function loadPerks(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Perks {
  try {
    const p = JSON.parse(storage?.getItem(PERKS_KEY) ?? '{}') as Perks;
    const perks: Perks = { noAds: p.noAds === true, x5: p.x5 === true, clubUntil: typeof p.clubUntil === 'number' ? p.clubUntil : 0 };
    refreshClub(perks);
    return perks;
  } catch {
    return {};
  }
}

export function savePerks(perks: Perks, storage: Pick<Storage, 'setItem'> | null = safeStorage()) {
  try {
    storage?.setItem(PERKS_KEY, JSON.stringify({ noAds: !!perks.noAds, x5: !!perks.x5, clubUntil: perks.clubUntil ?? 0 }));
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
