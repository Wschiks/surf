# Getting Surf Tycoon into the App Store and Google Play

Nothing has been submitted and no accounts were made. This document lists what is **ready**, and the steps **only you can do**. Run `npm run store:check` at any time: it checks what a computer can check and lists the rest.

## What is ready
* **No cheat or test options** in the game (the "Add 100B coins" button and the always-expand switch are gone). The debug hook `window.__surf` exists only in development or with `?debug` in the address.
* **Identity**: app name "Surf Tycoon", app id `com.wschiks.surftycoon` (derived from your GitHub name; change it, see below), version **1.0.0**.
* **Icons and splash screens** drawn in code and written for iOS (1024 icon without alpha, splash), Android (all densities, round and adaptive icons, splash) and the web (`npm run icons` makes them again).
* **iOS project**: iPhone only, portrait only, export compliance answered, privacy manifest included (declares the AdMob tracking and data types), AdMob app id in `Info.plist`, tracking permission text, no landscape.
* **Android project**: portrait only, no cleartext traffic, package folder and application id set, adaptive icon with a sea-blue background.
* **Legal**: Terms of Service and Privacy Policy inside the app (menu) and as web pages (`public/privacy.html`, `public/terms.html`, made by `npm run build`).
* **Store texts** and the answers to the store questionnaires: `store/listing.md`. **Store screenshots** in `store/screenshots/` and the icon in `store/icon-1024.png`.
* The game works offline, saves on the device, handles the phone going to sleep (offline earnings, 2 hours, more with skills), has no randomness. Its only network use is the optional rewarded ads (Google AdMob, `src/ads.ts`) and the two optional one-time purchases (`src/purchases.ts`).
* 80+ automated tests, a full-playthrough simulation and a browser smoke test pass.

## Ads (Google AdMob)
* One **rewarded video** ("Watch ad", above the Expand button) gives coins x2 for 40 seconds. Ids are in `src/config/ads.ts`; the plugin is `@capacitor-community/admob`.
* iOS uses your AdMob app id `ca-app-pub-8560073239883666~9782230015` and rewarded block `.../6132040872`. **Android still uses Google's public test ids**: make an Android app in AdMob, then change `ADS.android` in `src/config/ads.ts` and `admob_app_id` in `android/app/src/main/res/values/strings.xml`.
* **Test ads vs. live ads**: normal builds ask for *test* ads with your real ids (clicking your own live ads can get an AdMob account banned). For the build you upload to the stores use `npm run phone:sync:live`.
* First tap on "Watch ad" runs: iOS tracking permission, EU/UK consent form (create the message in AdMob > Privacy & messaging, or no form will show), then the ad. In a normal browser a 5 second demo screen stands in.
* Also needed on AdMob's side: add `app-ads.txt` on your developer website, and link the app to its store listing once it is published.

## Shop and purchases
* The bag button in the top bar opens the **Shop** (`src/ui/shop.ts`): a free **ad streak** (watch 5 ads: 1 gem, coins x2 for 30 s, 2 gems, coins x2 for 1 minute, 5 gems; then locked for 24 hours; all in `src/config/shop.ts`) **gem packs** (20 / 100 / 300 gems for 0.99 / 3.99 / 9.99 EUR, consumable, `GEM_PACKS`) the **Surf Club** subscription (3.99 EUR a month: coins x2, ad rewards without an ad, 3 gems a day, +2 hours away time; `CLUB` in `src/config/shop.ts`) and two **one-time purchases**: **Remove ads** (every ad reward without watching an ad, also the Watch ad button) and **Coins x5** (all coin income x5 for good). Prices shown are read from the store in the player's currency (the 2.99 / 4.99 EUR texts are only the fallback).
* Bought items are stored on the device apart from the game save (`src/core/perks.ts`), so save codes cannot hand them out and "Start over" does not lose them; the app also checks the store on every start, and the shop has **Restore purchases**.
* Plugin: `@capgo/native-purchases`. **You must create six products in App Store Connect and Google Play Console (3 consumable gem packs, 2 one-time, 1 monthly subscription with Google base plan id `monthly`) with the ids in `src/config/shop.ts`** (table in `store/listing.md`). Until they exist and the app is on a testing track / TestFlight, buying fails with "did not go through". In a browser the shop shows the prices only.
* iOS: in Xcode, target App > Signing & Capabilities > add **In-App Purchase**. Test with a sandbox account or a StoreKit configuration file.
* Gem packs are paid out once per store transaction id (remembered on the device, `grantGemPack`), also when the store reports a paid purchase after the app was closed (`transactionUpdated`), and the game is saved right after the payout. Consumables cannot be restored by the store: gems already bought and spent are gone.
* **Club**: the end date the store reports is kept on the device (`clubUntil`), so it also works offline and stops by itself when it runs out; every start (and Restore purchases) asks the store again (`getPurchases`, current entitlements). Android does not report an end date, so it trusts the store for 3 days at a time. Daily gems: once per 24 hours (`state.clubNext`).
* Terms and Privacy Policy already describe the purchases and the subscription.

## Steps for you (in this order)
1. **Fill in the publisher** in `src/config/legal.ts` (`PUBLISHER`: name, email, website). The stores and the law want a real contact; it is printed in the Terms and the Privacy Policy. Then run `npm run build`.
2. **Choose your app id.** It must be the reverse of a domain or name you control and cannot be changed after the first upload. Edit `appId` in `capacitor.config.ts`, then run `npm run phone:id` (it copies the id into the Android and iOS projects and syncs).
3. **Host the privacy policy**: put the built `dist/privacy.html` (or the whole `dist/` folder) on any web address, for example GitHub Pages. Both stores ask for this address. Also decide on a support email or page.
4. **Accounts**: Apple Developer Program (99 USD a year, needs a Mac for the build) and Google Play Console (25 USD once). Create an app record in each with your app id / package name.
5. **iOS build** (on a Mac with Xcode installed):
   1. `npm run phone:sync` then `npm run phone:open:ios`.
   2. In Xcode: select the App target, "Signing & Capabilities": choose your Team, keep "Automatically manage signing". Version 1.0.0, Build 1 (raise the build for every upload).
   3. Product > Archive > Distribute App > App Store Connect. Test it first with TestFlight on a real iPhone.
   4. In App Store Connect fill in the listing (`store/listing.md`), upload the screenshots (6.9-inch iPhone set), set App Privacy to "Data Not Collected", age rating 4+, then submit for review.
6. **Android build** (Android Studio installed):
   1. Make a signing key once and keep it and its passwords somewhere very safe (losing it means you cannot update the app): `keytool -genkey -v -keystore surf-tycoon.keystore -alias surftycoon -keyalg RSA -keysize 2048 -validity 10000`. Do **not** put the key in the repository.
   2. `npm run phone:sync` then `npm run phone:open:android`. Build > Generate Signed Bundle > Android App Bundle, using your key. Raise `versionCode` in `android/app/build.gradle` for every upload (versionName stays 1.0.0 for the first release).
   3. Play Console: create the app, upload the `.aab` to an **internal testing** track and try it on a real phone first, fill in the store listing, upload screenshots and a 1024×500 feature graphic, fill in the Data safety form ("no data collected") and the content rating (Everyone), then release to production. New personal Play accounts must first run a closed test with testers for some weeks before they can release; check the current rule in the Play Console.
7. **Test on real devices** (iPhone and Android): pinch/pan, sound, saving after closing the app, coming back after some hours, the big wave animation, the menu pages, "Start over". Only headless desktop Chromium has been used so far.

## Things to know
* Rendering was only tested in a desktop test browser. Check performance on an older phone. In the test browser a rendering glitch sometimes cut a waiting surfer's board in half; if you see that on a real phone, tell me.
* The privacy statements are simple and match what the game does today. If you ever add analytics, ads, purchases, accounts or online features, update the Terms, the Privacy Policy, the store forms and the privacy manifest first.
* The texts of the Terms and the Privacy Policy are plain-language starting points, not legal advice. Have them checked before release if you can.
* Google Play needs a feature graphic (1024×500) that is not made yet.
