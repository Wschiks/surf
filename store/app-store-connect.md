# App Store Connect: what to do (in this order)

Everything the computer can do is done (`npm run store:check` passes). These steps need you, signed in at
https://appstoreconnect.apple.com. Texts to copy are in `store/listing.md`, pictures in `store/screenshots/`.

## 1. A new build (Mac with Xcode)
1. `npm run phone:sync:live` (a live build: real ads, no test coins; it refuses to run with VITE_TEST_COINS=1).
2. `npm run phone:open:ios` opens Xcode.
3. In Xcode, target App > General: raise **Build** from 3 to **4** (every upload needs a higher build number). Version stays 1.0.0.
4. Choose "Any iOS Device (arm64)", then Product > Archive. In the Organizer: Distribute App > App Store Connect > Upload.
5. After 10 to 30 minutes the build shows under TestFlight.

## 2. Test it on your own iPhone (TestFlight)
Install the build with the TestFlight app and check: the box opening (the 3-box deal opens straight through), the
helicopter, the daily calendar, an ad break, and a test purchase (sandbox account) of a gem pack and the Surf Club.
Then move the two "Test on a real phone" cards on Trello to Done.

## 3. In-app purchases and the subscription (Monetization)
Ids and prices are in `store/listing.md` > "In-app purchases". For each one: reference name, product id, price,
display name and description, and a review screenshot: `store/screenshots/iphone-6.9/09-shop.png`.
* In-App Purchases: 3 consumables (gems20, gems100, gems300) and 2 non-consumables (removeads, coins5x).
* Subscriptions: a group "Surf Club" with one auto-renewable subscription `nl.mugstudio.surftycoon.club`, 1 month,
  3.99 EUR. Description: "An exclusive skin every month, coins x2, no ads, 5 gems and a treasure box every day."
* Add all of them to the app version (step 6) so they are reviewed with it.

## 4. App Information
* Category: Games > Simulation (second: Casual).
* **Age rating**: answer as in `store/listing.md` > "Age rating answers". Important: **Loot boxes = Yes** (treasure
  boxes can be bought with gems, the odds are shown before buying). Everything else none.
* Content rights: the game contains no third-party content (the art is yours and your friend's).

## 5. Pricing and Availability
* Price: Free.
* App Availability: **untick Belgium** (paid loot boxes count as gambling there).

## 6. The version page (1.0.0)
* Screenshots: the 6.9" slot from `store/screenshots/iphone-6.9/` (9 pictures, 1290x2796); if a 6.5" slot is asked,
  `store/screenshots/iphone-6.5/`.
* Promotional text, description, keywords, support URL, copyright: from `store/listing.md`.
* Privacy Policy URL: a public web address of `privacy.html` (for example the Vercel site + `/privacy.html`, or
  GitHub Pages). Support URL: a page where people can reach you (it may be the same site).
* App Review information: no sign-in needed; paste "Review notes" from `store/listing.md`.
* Choose the build from step 1 and add the in-app purchases from step 3.

## 7. App Privacy
As in `store/listing.md` > "App Store App Privacy label": Device ID, Advertising Data and Product Interaction,
used for tracking (third-party advertising), not linked to identity.

## 8. Submit
Add for Review > Submit. After approval: in AdMob, link the app to its App Store page (app-ads.txt is already in
the build: `public/app-ads.txt`).

## Later (not needed for the iPhone release)
* Merge `beforeMain` into `main` when you are happy with it (you decide; nothing is pushed to main automatically).
* Android: make an Android app in AdMob (the Android ids are still Google's test ids), a Google Play Console app,
  and a feature graphic 1024x500.
