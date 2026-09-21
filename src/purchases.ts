import { Capacitor } from '@capacitor/core';
import { PRODUCTS, type ProductId } from './config/shop';
import { savePerks, type Perks } from './core/perks';

export type BuyResult = 'bought' | 'cancelled' | 'failed' | 'unavailable';

/** Buying only works inside the phone apps (App Store / Google Play). In a browser the shop shows the prices only. */
export const canBuy = Capacitor.isNativePlatform();

type Plugin = typeof import('@capgo/native-purchases');
let loaded: Promise<Plugin> | null = null;
const plugin = () => (loaded ??= import('@capgo/native-purchases'));

const productOf = (id: ProductId) => PRODUCTS.find((p) => p.id === id)!;

/** The price texts from the store, in the player's own currency (empty in a browser). */
export async function storePrices(): Promise<Partial<Record<ProductId, string>>> {
  if (!canBuy) return {};
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    const { products } = await NativePurchases.getProducts({ productIdentifiers: PRODUCTS.map((p) => p.storeId), productType: PURCHASE_TYPE.INAPP });
    const out: Partial<Record<ProductId, string>> = {};
    for (const p of PRODUCTS) {
      const found = products.find((x) => x.identifier === p.storeId);
      if (found) out[p.id] = found.priceString;
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

/** Ask the store which products (`userAsked`: the player tapped Restore, so the App Store may ask to sign in) this account already owns (a new phone, or after "Start over"). Returns true when something was found. */
export async function restore(perks: Perks, userAsked = true): Promise<boolean> {
  if (!canBuy) return false;
  try {
    const { NativePurchases, PURCHASE_TYPE } = await plugin();
    if (userAsked && Capacitor.getPlatform() === 'ios') await NativePurchases.restorePurchases();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
    let found = false;
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
  if (canBuy) void restore(perks, false).catch(() => {}); // no store sign-in prompt at the start
}

