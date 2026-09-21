import { Capacitor } from '@capacitor/core';
import { ADS } from './config/ads';

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

/** Show one rewarded video. Resolves 'rewarded' only when the player watched it to the end. */
export async function showRewardedAd(): Promise<AdResult> {
  if (!adsNative) return 'failed';
  try {
    await setup();
    const { AdMob, RewardAdPluginEvents } = await admob();
    const adId = Capacitor.getPlatform() === 'ios' ? ADS.ios.rewarded : ADS.android.rewarded;
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
