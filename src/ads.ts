import { Capacitor } from '@capacitor/core';
import { ADS, type RewardedSpot } from './config/ads';

export type AdResult = 'rewarded' | 'closed' | 'failed';

/** True inside the phone apps. In a normal browser there are no real ads (the game shows a short demo instead). */
export const adsNative = Capacitor.isNativePlatform();

type AdMobModule = typeof import('@capacitor-community/admob');
let loaded: Promise<AdMobModule> | null = null;
let ready: Promise<void> | null = null;

function admob(): Promise<AdMobModule> {
  return (loaded ??= import('@capacitor-community/admob'));
}

/** Ask for the privacy choices (iOS tracking permission, EU consent) and start the ad SDK. Done once, on the first ad. */
function setup(): Promise<void> {
  return (ready ??= (async () => {
    const { AdMob, AdmobConsentStatus } = await admob();
    try {
      if (Capacitor.getPlatform() === 'ios') {
        const t = await AdMob.trackingAuthorizationStatus();
        if (t.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      }
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
    } catch {
      // no consent form could be shown (offline): the SDK decides by itself whether it may ask for ads
    }
    await AdMob.initialize();
  })().catch((e) => {
    ready = null; // try again on the next tap
    throw e;
  }));
}

/** The ad block for a place in the game; a place without its own block yet uses the Watch ad x2 one. */
function rewardedId(spot: RewardedSpot): string {
  const ids = Capacitor.getPlatform() === 'ios' ? ADS.ios.rewarded : ADS.android.rewarded;
  return ids[spot] || ids.boost;
}

/** Show one rewarded video. Resolves 'rewarded' only when the player watched it to the end. */
export async function showRewardedAd(spot: RewardedSpot = 'boost'): Promise<AdResult> {
  if (!adsNative) return 'failed';
  try {
    await setup();
    const { AdMob, RewardAdPluginEvents } = await admob();
    const adId = rewardedId(spot);
    await AdMob.prepareRewardVideoAd({ adId, isTesting: !ADS.live });
    let earned = false;
    return await new Promise<AdResult>((resolve) => {
      const handles: Promise<{ remove: () => Promise<void> }>[] = [];
      const done = (r: AdResult) => {
        handles.forEach((h) => void h.then((x) => x.remove()));
        resolve(r);
      };
      handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (earned = true)));
      handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => done(earned ? 'rewarded' : 'closed')));
      handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => done('failed')));
      AdMob.showRewardVideoAd().catch(() => done(earned ? 'rewarded' : 'failed'));
    });
  } catch {
    return 'failed';
  }
}

function interstitialId(): string {
  const ios = Capacitor.getPlatform() === 'ios';
  if (!ADS.live) return ios ? ADS.testInterstitial.ios : ADS.testInterstitial.android;
  return ios ? ADS.ios.interstitial : ADS.android.interstitial;
}

/** Can an ad break show an ad? In a browser a stand-in is shown; in a live build only once its ad block is set. */
export function interstitialAvailable(): boolean {
  return !adsNative || !!interstitialId();
}

/** Show one ad break ad (interstitial). Resolves when it is closed, or at once if none could be shown. */
export async function showInterstitialAd(): Promise<void> {
  const adId = interstitialId();
  if (!adsNative || !adId) return;
  try {
    await setup();
    const { AdMob, InterstitialAdPluginEvents } = await admob();
    await AdMob.prepareInterstitial({ adId, isTesting: !ADS.live });
    await new Promise<void>((resolve) => {
      const handles: Promise<{ remove: () => Promise<void> }>[] = [];
      const done = () => {
        handles.forEach((h) => void h.then((x) => x.remove()));
        resolve();
      };
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, done));
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, done));
      AdMob.showInterstitial().catch(done);
    });
  } catch {
    // no ad: keep playing
  }
}
