// All balance numbers in one place. Costs and incomes of every zone scale with its "tier"
// (see sports.ts), so a new sport only needs data, not new formulas.

export type StatId = 'capacity' | 'price' | 'speed';
/** The order of the upgrade rows: level up, bigger class, faster. */
export const STAT_IDS: StatId[] = ['price', 'capacity', 'speed'];

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
  // Bigger class: one more guest per level. Dearer than a level up.
  capacity: { id: 'capacity', label: 'Capacity', icon: 'people', baseCost: 25, growth: 1.17, max: 100 },
  // Level up: many small steps (up to 1000), with a bonus at milestone levels (see LEVEL_MILESTONES).
  price: { id: 'price', label: 'Level up', icon: 'tag', baseCost: 6, growth: 1.03, max: 1000 },
  // Faster sessions: the dearest of the three.
  speed: { id: 'speed', label: 'Speed', icon: 'bolt', baseCost: 80, growth: 1.22, max: 40 },
};

/** Bonus multipliers for the income of a zone at certain levels. They stack. After level 300 every 100 levels doubles it. */
export const LEVEL_MILESTONES: [level: number, mult: number][] = [
  [25, 1.1],
  [50, 1.2],
  [75, 1.5],
  [100, 1.75],
  [200, 2],
  [300, 2],
];

/** Total milestone bonus at a level. */
export function milestoneMult(level: number): number {
  let m = 1;
  for (const [l, x] of LEVEL_MILESTONES) if (level >= l) m *= x;
  if (level >= 400) m *= Math.pow(2, Math.floor(level / 100) - 3);
  return m;
}

/** The next level with a bonus, and the multiplier it gives. */
export function nextMilestone(level: number): { level: number; mult: number } {
  for (const [l, x] of LEVEL_MILESTONES) if (level < l) return { level: l, mult: x };
  return { level: (Math.floor(level / 100) + 1) * 100, mult: 2 };
}

export const BALANCE = {
  /**
   * TEST AID: while true the Expand button always works (no requirements, no coins), so the big wave can be watched.
   * Set to false for the real rules. Tests and the balance bot turn it off themselves.
   */
  testAlwaysExpand: false,
  /** Every tier step multiplies the income of a zone by this factor. */
  tierScale: 5,
  /** Every tier step multiplies costs by this factor. Bigger than tierScale, so later tiers take longer to reach. */
  costScale: 8.8,
  /** Scales every unlock price at once (level and sport unlocks). */
  unlockMult: 3,
  /** Price per guest gains this fraction of the base price per level up (a small step). */
  priceStep: 0.05,
  /** Sessions get this fraction faster per speed level (duration = base / (1 + step * level)). */
  speedStep: 0.06,
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
