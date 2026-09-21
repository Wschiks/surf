# Getting Surf Tycoon into the App Store and Google Play

Nothing has been submitted and no accounts were made. This document lists what is **ready**, and the steps **only you can do**. Run `npm run store:check` at any time: it checks what a computer can check and lists the rest.

## What is ready
* **No cheat or test options** in the game (the "Add 100B coins" button and the always-expand switch are gone). The debug hook `window.__surf` exists only in development or with `?debug` in the address.
* **Identity**: app name "Surf Tycoon", app id `com.wschiks.surftycoon` (derived from your GitHub name; change it, see below), version **1.0.0**.
* **Icons and splash screens** drawn in code and written for iOS (1024 icon without alpha, splash), Android (all densities, round and adaptive icons, splash) and the web (`npm run icons` makes them again).
* **iOS project**: iPhone only, portrait only, export compliance answered, privacy manifest included (no tracking, no collected data), no landscape.
* **Android project**: portrait only, no cleartext traffic, package folder and application id set, adaptive icon with a sea-blue background.
* **Legal**: Terms of Service and Privacy Policy inside the app (menu) and as web pages (`public/privacy.html`, `public/terms.html`, made by `npm run build`).
* **Store texts** and the answers to the store questionnaires: `store/listing.md`. **Store screenshots** in `store/screenshots/` and the icon in `store/icon-1024.png`.
* The game works offline, saves on the device, handles the phone going to sleep (offline earnings, max 8 hours), has no network calls, no ads, no purchases, no randomness.
* 80+ automated tests, a full-playthrough simulation and a browser smoke test pass.

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
