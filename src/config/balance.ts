// All balance numbers in one place. Costs and incomes of every zone scale with its "tier"
// (see sports.ts), so a new sport only needs data, not new formulas.

export type StatId = 'capacity' | 'price' | 'speed';
export const STAT_IDS: StatId[] = ['capacity', 'price', 'speed'];

export interface StatDef {
  id: StatId;
  label: string;
  icon: string;
  /** Cost of the first purchase, at tier 0. */
  baseCost: number;
  /** Every purchase costs this many times the last one. */
  growth: number;
  /** Highest level you can buy. */
  max: number;
}

export const STATS: Record<StatId, StatDef> = {
  capacity: { id: 'capacity', label: 'Capacity', icon: 'people', baseCost: 4, growth: 1.3, max: 25 },
  price: { id: 'price', label: 'Income per guest', icon: 'tag', baseCost: 6, growth: 1.33, max: 30 },
  speed: { id: 'speed', label: 'Speed', icon: 'bolt', baseCost: 9, growth: 1.4, max: 15 },
};

export const BALANCE = {
  /** Every tier step multiplies the income of a zone by this factor. */
  tierScale: 5,
  /** Every tier step multiplies costs by this factor. Bigger than tierScale, so later tiers take longer to reach. */
  costScale: 7.1,
  /** Scales every unlock price at once (level and sport unlocks). */
  unlockMult: 3,
  /** Price per guest gains this fraction of the base price per price level. */
  priceStep: 0.25,
  /** Sessions get this fraction faster per speed level (duration = base / (1 + step * level)). */
  speedStep: 0.1,
  /** Cost of a manager, in multiples of the tier scale. */
  managerCost: 60,
  /** Offline earnings stop after this many seconds away. */
  offlineCapSeconds: 8 * 3600,
  /** Only show this many guests per zone on the map. */
  maxVisibleGuests: 10,
  /** Reputation earned per guest per session at tier 0; grows with tier. */
  repPerGuest: 0.04,
  repTierScale: 1.9,
};

export function tierFactor(tier: number): number {
  return Math.pow(BALANCE.tierScale, tier);
}

export function costFactor(tier: number): number {
  return Math.pow(BALANCE.costScale, tier);
}

/** Coins for an unlock at a tier: `factor` times the cost scale of that tier. */
export function unlockCoins(tier: number, factor: number): number {
  const raw = factor * BALANCE.unlockMult * costFactor(tier);
  if (raw < 100) return Math.round(raw);
  const e = Math.floor(Math.log10(raw)) - 1;
  return Math.round(raw / 10 ** e) * 10 ** e;
}
