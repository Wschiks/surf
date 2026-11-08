// All balance numbers in one place. Costs and incomes of every zone scale with its "tier"
// (see sports.ts), so a new sport only needs data, not new formulas.

export type StatId = 'capacity' | 'price' | 'speed' | 'fields';
/** The order of the upgrade rows of a sport zone: level up, bigger class, faster. (Beach sports: level up, players, fields.) */
export const STAT_IDS: StatId[] = ['price', 'capacity', 'speed'];

export interface StatDef {
  id: StatId;
  label: string;
  icon: string;
  /** Cost of the first purchase, at tier 0. */
  baseCost: number;
  /** Every purchase costs this many times the last one. */
  growth: number;
  /** Extra cost that grows with the level: cost x (1 + surge x level). Makes the late levels dearer. */
  surge: number;
  /** Highest level you can buy (before any rebirth). */
  max: number;
  /** Every rebirth raises the highest level by this much. */
  perRebirth?: number;
  /** The highest level ever, however many rebirths (none: no limit). */
  cap?: number;
}

export const STATS: Record<StatId, StatDef> = {
  // Bigger class: one more guest per level, and few levels: max 10 (a class of 13 kids), each level x3 the one before
  // (1, 3, 9, 27, 81...). A full class is a goal you reach; every rebirth makes room for 5 more.
  capacity: { id: 'capacity', label: 'Capacity', icon: 'people', baseCost: 25, growth: 3, surge: 0, max: 10, perRebirth: 5 },
  // Level up: many small steps (up to 1000), with a bonus at milestone levels (see LEVEL_MILESTONES).
  price: { id: 'price', label: 'Level up', icon: 'tag', baseCost: 6, growth: 1.03, surge: 0, max: 1000 },
  // Faster sessions: the dearest of the three.
  speed: { id: 'speed', label: 'Speed', icon: 'bolt', baseCost: 80, growth: 1.336, surge: 0, max: 100 },
  // Fields: only beach sports have them (their own numbers are in src/config/beach.ts).
  fields: { id: 'fields', label: 'Fields', icon: 'flag', baseCost: 400, growth: 6, surge: 0, max: 1, perRebirth: 1, cap: 3 },
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
  /** Every tier step multiplies the income of a zone by this factor. */
  tierScale: 5,
  /** Every tier step multiplies costs by this factor. Bigger than tierScale, so later tiers take longer to reach. */
  costScale: 7.85,
  /** Scales every unlock price at once (level and sport unlocks). */
  unlockMult: 3,
  /** Price per guest gains this fraction of the base price per level up (a small step). */
  priceStep: 0.05,
  /**
   * At the top Faster turnover level a session takes this fraction of its base time (6 s -> 2 s). Every level takes off
   * the same number of seconds: (1 - speedEnd) / max of the base time (0.04 s on a 6 s session).
   */
  speedEnd: 1 / 3,
  /** Cost of a manager, in multiples of the tier scale. */
  managerCost: 60,
  /** Offline earnings stop after this many seconds away (2 hours; the beach skills add more). */
  offlineCapSeconds: 2 * 3600,
  /** Watching a rewarded ad makes all coin income x2 for this many seconds. */
  boostSeconds: 120,
  boostMult: 2,
  /** The one-time purchase "Coins x5": all coin income x5. */
  x5Mult: 5,
  /** Only show this many guests per zone on the map. */
  maxVisibleGuests: 10,
  /** While away the beach earns this share of its normal income (managed zones only). */
  offlineRate: 0.3,
  /** In the welcome-back dialog, watching an ad turns the away earnings into this share (double the free rate). */
  offlineAdRate: 0.6,
  /** In the welcome-back dialog, this many gems turn the away earnings into the full 100%. */
  offlineGemCost: 5,
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
