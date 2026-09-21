// Google AdMob ids for the rewarded video ad ("Watch an ad: coins x2 for 40 seconds").
// The ids are not secret: they only say which AdMob app and ad block the ad belongs to.

export const ADS = {
  ios: {
    appId: 'ca-app-pub-8560073239883666~9782230015',
    rewarded: 'ca-app-pub-8560073239883666/6132040872',
  },
  // Android has no AdMob app of its own yet: these are Google's public test ids (they only show test ads).
  // Make an Android app in AdMob, then put its app id here, in android/app/src/main/res/values/strings.xml
  // (admob_app_id) and its rewarded ad block id below.
  android: {
    appId: 'ca-app-pub-3940256099942544~3347511713',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  /**
   * Real ads only in builds made with `npm run phone:sync:live` (VITE_ADS_LIVE=1). Every other build asks AdMob for
   * test ads with the real ids, so you never click your own live ads (that can get an AdMob account banned).
   */
  live: import.meta.env.VITE_ADS_LIVE === '1',
};
