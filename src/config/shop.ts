// The shop: a free ad streak (watch 5 ads, once a day), gem packs (bought as often as you like) and two one-time purchases.

/** One reward of the ad streak. */
export type AdStep = { gems: number } | { boost: number };

/**
 * Watch 5 ads in a row: 1 gem, coins x2 for 30 s, 2 gems, coins x2 for 1 minute, 5 gems.
 * After the 5th ad the streak is locked for a day, then it starts again at the first ad.
 */
export const AD_STEPS: readonly AdStep[] = [{ gems: 1 }, { boost: 30 }, { gems: 2 }, { boost: 60 }, { gems: 3 }];
export const AD_COOLDOWN_SECONDS = 24 * 3600;

export type ProductId = 'noAds' | 'x5';

export interface Product {
  id: ProductId;
  /** The product id in App Store Connect and Google Play Console (one-time, non-consumable). */
  storeId: string;
  name: string;
  text: string;
  /** Shown when the store price cannot be read (the store shows the real price in your currency). */
  price: string;
}

export const PRODUCTS: readonly Product[] = [
  {
    id: 'noAds',
    storeId: 'nl.mugstudio.surftycoon.removeads',
    name: 'Remove ads',
    text: 'Every ad reward, without watching an ad. One time.',
    price: '€2.99',
  },
  {
    id: 'x5',
    storeId: 'nl.mugstudio.surftycoon.coins5x',
    name: 'Coins x5',
    text: 'All coin income x5, for good. It stacks with everything else. One time.',
    price: '€4.99',
  },
];

export type GemPackId = 'gems20' | 'gems100' | 'gems300';

export interface GemPack {
  id: GemPackId;
  /** The product id in App Store Connect and Google Play Console (consumable: can be bought again and again). */
  storeId: string;
  gems: number;
  price: string;
  /** A small tag on the card. */
  tag?: string;
}

/** Skill points (gems) for real money. The bigger the pack, the cheaper a gem. */
export const GEM_PACKS: readonly GemPack[] = [
  { id: 'gems20', storeId: 'nl.mugstudio.surftycoon.gems20', gems: 20, price: '€0.99' },
  { id: 'gems100', storeId: 'nl.mugstudio.surftycoon.gems100', gems: 100, price: '€3.99', tag: 'Popular' },
  { id: 'gems300', storeId: 'nl.mugstudio.surftycoon.gems300', gems: 300, price: '€9.99', tag: 'Best value' },
];

/** The monthly subscription. */
export const CLUB = {
  /** Subscription product id in App Store Connect / Google Play Console. */
  storeId: 'nl.mugstudio.surftycoon.club',
  /** The base plan id of the monthly plan in Google Play Console (Android needs it). */
  planId: 'monthly',
  name: 'Surf Club',
  price: '€3.99',
  /** All coin income x this, for as long as you are a member. */
  coinMult: 2,
  /** Gems you can claim once every 24 hours. */
  gemsPerDay: 3,
  /** Extra hours of away time. */
  awayHours: 2,
  /** Real seconds between two gem claims. */
  claimSeconds: 24 * 3600,
} as const;
