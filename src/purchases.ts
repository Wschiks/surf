import { Capacitor } from '@capacitor/core';
import { CLUB, GEM_PACKS, PRODUCTS, type GemPackId, type ProductId } from './config/shop';
import { refreshClub, savePerks, type Perks } from './core/perks';

export type PriceKey = ProductId | GemPackId | 'club';

export type BuyResult = 'bought' | 'cancelled' | 'failed' | 'unavailable';
export type PackResult = { result: Exclude<BuyResult, 'bought'> } | { result: 'bought'; transactionId: string };

/** Buying only works inside the phone apps (App Store / Google Play). In a browser the shop shows the prices only. */
export const canBuy = Capacitor.isNativePlatform();

type Plugin = typeof import('@capgo/native-purchases');
let loaded: Promise<Plugin> | null = null;
const plugin = () => (loaded ??= import('@capgo/native-purchases'));

const productOf = (id: ProductId) => PRODUCTS.find((p) => p.id === id)!;

/** The price texts from the store, in the player's own currency (empty in a browser). */
export async function storePrices(): Promise<Partial<Record<PriceKey, string>>> {
  if (!canBuy) return {};
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    const { products } = await NativePurchases.getProducts({ productIdentifiers: [...PRODUCTS, ...GEM_PACKS].map((p) => p.storeId), productType: PURCHASE_TYPE.INAPP });
    const out: Partial<Record<PriceKey, string>> = {};
    for (const p of [...PRODUCTS, ...GEM_PACKS]) {
      const found = products.find((x) => x.identifier === p.storeId);
      if (found) out[p.id] = found.priceString;
    }
    try {
      const { products: subs } = await NativePurchases.getProducts({ productIdentifiers: [CLUB.storeId], productType: PURCHASE_TYPE.SUBS });
      const club = subs.find((x) => x.identifier === CLUB.storeId);
      if (club) out.club = club.priceString;
    } catch {
      // the subscription is not set up in the store yet: the shop shows the fallback price
    }
    return out;
  } catch {
    return {};
  }
}

/** Buy one product. On success the perk is switched on in `perks` and kept on the device. */
export async function buy(id: ProductId, perks: Perks): Promise<BuyResult> {
  if (!canBuy) return 'unavailable';
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    await NativePurchases.purchaseProduct({ productIdentifier: productOf(id).storeId, productType: PURCHASE_TYPE.INAPP, quantity: 1, autoAcknowledgePurchases: true });
    perks[id] = true;
    savePerks(perks);
    return 'bought';
  } catch (e) {
    const text = String((e as { message?: string })?.message ?? e).toLowerCase();
    return text.includes('cancel') ? 'cancelled' : 'failed';
  }
}

/** Buy one gem pack (a consumable: it can be bought again and again). The caller pays out the gems. */
export async function buyPack(id: GemPackId): Promise<PackResult> {
  if (!canBuy) return { result: 'unavailable' };
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    const t = await NativePurchases.purchaseProduct({ productIdentifier: GEM_PACKS.find((p) => p.id === id)!.storeId, productType: PURCHASE_TYPE.INAPP, quantity: 1, isConsumable: true });
    return { result: 'bought', transactionId: t.transactionId ?? t.orderId ?? '' };
  } catch (e) {
    const text = String((e as { message?: string })?.message ?? e).toLowerCase();
    return { result: text.includes('cancel') ? 'cancelled' : 'failed' };
  }
}

/**
 * Gem packs the store reports outside the normal buy flow (paid, but the app was closed before the gems arrived):
 * `pay` is called for each; it must not pay a purchase twice (grantGemPack remembers the ids).
 */
export async function watchPacks(pay: (id: GemPackId, transactionId: string) => void) {
  if (!canBuy) return;
  try {
    const { NativePurchases } = await plugin();
    await NativePurchases.addListener('transactionUpdated', (t) => {
      const pack = GEM_PACKS.find((p) => p.storeId === t.productIdentifier);
      if (pack) pay(pack.id, t.transactionId ?? t.orderId ?? '');
    });
  } catch {
    // no store: nothing to watch
  }
}

/** How long to trust a subscription the store reports without an end date (Android): the next start checks again. */
const GRACE_MS = 3 * 24 * 3600 * 1000;

/** Is this transaction a paid-up Club subscription, and until when? (iOS reports an end date, Android only lists current subscriptions.) */
function clubUntilOf(t: { isActive?: boolean; expirationDate?: string }, now: number): number {
  const end = t.expirationDate ? Date.parse(t.expirationDate) : NaN;
  if (Number.isFinite(end)) return end > now ? end : 0;
  return t.isActive === false ? 0 : now + GRACE_MS;
}

/** Subscribe to the Club (monthly). */
export async function buyClub(perks: Perks): Promise<BuyResult> {
  if (!canBuy) return 'unavailable';
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    const t = await NativePurchases.purchaseProduct({ productIdentifier: CLUB.storeId, planIdentifier: CLUB.planId, productType: PURCHASE_TYPE.SUBS, quantity: 1, autoAcknowledgePurchases: true });
    perks.clubUntil = Math.max(clubUntilOf(t, Date.now()), Date.now() + 60_000);
    refreshClub(perks);
    savePerks(perks);
    return 'bought';
  } catch (e) {
    const text = String((e as { message?: string })?.message ?? e).toLowerCase();
    return text.includes('cancel') ? 'cancelled' : 'failed';
  }
}

/** Ask the store whether the Club is paid up. Only a real answer changes anything (offline, the last known end date stays). */
export async function syncClub(perks: Perks): Promise<void> {
  if (!canBuy) return;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS, onlyCurrentEntitlements: true });
    const now = Date.now();
    perks.clubUntil = purchases.filter((t) => t.productIdentifier === CLUB.storeId).reduce((max, t) => Math.max(max, clubUntilOf(t, now)), 0);
    refreshClub(perks, now);
    savePerks(perks);
  } catch {
    // no answer: keep what we know
  }
}

/** Open the store's own page where the subscription is cancelled or changed. */
export async function manageClub() {
  try {
    const { NativePurchases } = await plugin();
    await NativePurchases.manageSubscriptions();
  } catch {
    // ignore
  }
}

/** Ask the store which products (`userAsked`: the player tapped Restore, so the App Store may ask to sign in) this account already owns (a new phone, or after "Start over"). Returns true when something was found. */
export async function restore(perks: Perks, userAsked = true): Promise<boolean> {
  if (!canBuy) return false;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    if (userAsked && Capacitor.getPlatform() === 'ios') await NativePurchases.restorePurchases();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    await syncClub(perks);
    let found = !!perks.club;
    for (const p of PRODUCTS) {
      if (purchases.some((t) => t.productIdentifier === p.storeId)) {
        perks[p.id] = true;
        found = true;
      }
    }
    if (found) savePerks(perks);
    return found;
  } catch {
    return false;
  }
}

/** On every start (in the apps): quietly pick up purchases made on another device or before a reinstall. */
export function syncPurchases(perks: Perks) {
  if (canBuy) {
    void restore(perks, false).catch(() => {}); // no store sign-in prompt at the start
  }
}

