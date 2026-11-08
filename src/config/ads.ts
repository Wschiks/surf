// Google AdMob ids for the rewarded video ad ("Watch an ad: coins x2 for 2 minutes") and the ad breaks.
// The ids are not secret: they only say which AdMob app and ad block the ad belongs to.

export const ADS = {
  ios: {
    appId: 'ca-app-pub-8560073239883666~9782230015',
    rewarded: 'ca-app-pub-8560073239883666/6132040872',
    /** The ad break (interstitial) ad block. Empty until it is made in AdMob: live builds then have no ad breaks. */
    interstitial: '',
  },
  // Android has no AdMob app of its own yet: these are Google's public test ids (they only show test ads).
  // Make an Android app in AdMob, then put its app id here, in android/app/src/main/res/values/strings.xml
  // (admob_app_id) and its rewarded ad block id below.
  android: {
    appId: 'ca-app-pub-3940256099942544~3347511713',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  /** Google's public test ad blocks for ad breaks, used in every build that is not a live store build. */
  testInterstitial: { ios: 'ca-app-pub-3940256099942544/4411468910', android: 'ca-app-pub-3940256099942544/1033173712' },
  /**
   * Real ads only in builds made with `npm run phone:sync:live` (VITE_ADS_LIVE=1). Every other build asks AdMob for
   * test ads with the real ids, so you never click your own live ads (that can get an AdMob account banned).
   */
  live: import.meta.env.VITE_ADS_LIVE === '1',
};

/** Ad breaks: a black "Ad break" screen, then an ad. Never for players who bought Remove ads or are in the Surf Club. */
export const AD_BREAK = {
  /** No ad break in the first minutes of playing. */
  firstAfterSeconds: 5 * 60,
  /** At least this long between two ad breaks. */
  everySeconds: 7 * 60,
  /** Seconds the "Ad break" screen counts down before the ad. */
  countdown: 3,
};
