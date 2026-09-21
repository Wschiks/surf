// The shop: a free ad streak (watch 5 ads, once a day) and two one-time purchases.

/** One reward of the ad streak. */
export type AdStep = { gems: number } | { boost: number };

/**
 * Watch 5 ads in a row: 1 gem, coins x2 for 30 s, 2 gems, coins x2 for 1 minute, 5 gems.
 * After the 5th ad the streak is locked for a day, then it starts again at the first ad.
 */
export const AD_STEPS: readonly AdStep[] = [{ gems: 1 }, { boost: 30 }, { gems: 2 }, { boost: 60 }, { gems: 5 }];
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
    storeId: 'com.wschiks.surftycoon.removeads',
    name: 'Remove ads',
    text: 'Every ad reward, without watching an ad. One time.',
    price: '€2.99',
  },
  {
    id: 'x5',
    storeId: 'com.wschiks.surftycoon.coins5x',
    name: 'Coins x5',
    text: 'All coin income x5, for good. It stacks with everything else. One time.',
    price: '€4.99',
  },
];
