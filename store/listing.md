# Store listing (copy and paste into App Store Connect and Google Play Console)

Fill in the names in `[brackets]`. Nothing here has been submitted.

## Basics
| | App Store | Google Play |
|---|---|---|
| App name | Surf Tycoon: Idle Beach Game (max 30 characters) | Surf Tycoon: Idle Beach Game (max 30) |
| Subtitle / short description | Run your own surf beach (max 30) | Build a surf beach and grow it into a sea-sport empire. (max 80) |
| Category | Games > Simulation (second: Casual) | Game > Simulation |
| Price | Free | Free |
| In-app purchases / ads | 5 in-app purchases (3 gem packs consumable, Remove ads and Coins x5 one-time) + 1 auto-renewing subscription (Surf Club, monthly); contains ads (optional rewarded video) | same: 3 consumable + 2 one-time products + 1 subscription with a monthly base plan; contains ads |
| Languages | English | English |
| Support URL / email | [your support page or email] | [your support email] |
| Privacy policy URL | [the address where you host `public/privacy.html`] | same |
| Copyright | [year] [your name] | |

## Keywords (App Store, max 100 characters, comma separated)
`idle,tycoon,surf,beach,sea,kite,sailing,wind,wave,manager,clicker,relax,upgrade,resort`

## Promotional text (App Store, max 170)
Turn a quiet beach into a busy sea-sport spot. Hire managers, unlock new sports and expand the beach with a giant wave.

## Description (both stores)
Run your own beach! Surf Tycoon is a relaxing idle game about a water-sports spot.

Start with a few kids in bright vests on small, rolling waves. Earn coins, upgrade your classes, hire managers who keep everything running, and unlock more: longboarders, the reef, the giant waves of Nazaré, skimboarding, windsurfing, kitesurfing, foil and wing, and sailing.

FEATURES
• Six water sports with four levels each, from beginner classes to pros only
• Watch your guests: surfers ride the waves, skimboarders slide, windsurfers tack, kitesurfers jump, foilers glide and sailors race
• Idle earnings: managers keep working while you are away (2 hours to start with, more with skills)
• Upgrade a thousand levels with big bonuses on the way, buy x10, x100 or Max, or just hold the button
• Quests with coin rewards
• Expand the beach: a giant wave washes over the screen, you start over faster than before and all your income goes up for good
• A big map you can swipe and zoom, with a reef, a rock arch and a red lighthouse on the cliff
• No account needed, your game stays on your device. Optional video ads give you double coins or gems, and the shop has gem packs plus two optional one-time purchases (Remove ads, Coins x5).

## What's new (first release)
First release.

## In-app purchases (create these in both stores before testing)
Five products. The ids must match `PRODUCTS[].storeId` and `GEM_PACKS[].storeId` in `src/config/shop.ts`. The gem packs are **consumable** (App Store: Consumable; Google Play: a normal in-app product, which the app consumes after payout); Remove ads and Coins x5 are **non-consumable**.
| Product | Id | Price | Reference name / description |
|---|---|---|---|
| Remove ads | `nl.mugstudio.surftycoon.removeads` | 2.99 EUR (tier of your choice) | "Remove ads": every ad reward without watching an ad |
| Coins x5 | `nl.mugstudio.surftycoon.coins5x` | 4.99 EUR | "Coins x5": all coin income x5 for good |
| **Surf Club (subscription)** | `nl.mugstudio.surftycoon.club` (Google base plan id: `monthly`) | 3.99 EUR / month | "Surf Club": coins x2, ad rewards without ads, 3 gems a day, +2 hours away time |
| 20 gems | `nl.mugstudio.surftycoon.gems20` | 0.99 EUR | "20 gems": skill points for the skill trees (consumable) |
| 100 gems | `nl.mugstudio.surftycoon.gems100` | 3.99 EUR | "100 gems" (consumable) |
| 300 gems | `nl.mugstudio.surftycoon.gems300` | 9.99 EUR | "300 gems" (consumable) |
* App Store: App Store Connect > the app > Monetization > In-App Purchases, add a screenshot of the shop for review, and attach them to the app version. Google Play: Monetize > Products > In-app products, activate them (the app must be uploaded to a testing track first).
* **Subscription (Surf Club)**: App Store: create a *subscription group* (for example "Surf Club") with one auto-renewable subscription of 1 month, add the localised name/description and a screenshot. Google Play: Monetize > Subscriptions, product id as above, add a **base plan with id `monthly`** (auto-renewing, 1 month) and activate it. The shop shows what Apple and Google require: name, length, price, that it renews automatically until cancelled in the account settings, a Manage subscription button and links to the Terms and Privacy Policy. Also put the Terms (or Apple's standard EULA) and Privacy links in the store listing.
* Both stores require a working **Restore purchases** button: it is in the shop.
* Review notes: the shop opens with the bag button in the top bar.

## Age rating answers
* Violence, sexual content, nudity, profanity, drugs, alcohol, gambling (including simulated), horror, medical content: **none**.
* Unrestricted web access: no. User-generated content / chat: none.
* Loot boxes or random rewards: **none** (the game has no randomness at all). In-app purchases: yes (two fixed one-time items, no random content).
* Expected result: **App Store 4+**, **Google Play (IARC) Everyone**.

## Google Play "Data safety" form
* Does the app collect or share any user data? **Yes, through Google AdMob (the ad SDK)**: Device or other IDs (advertising ID), and app interactions / diagnostics as the AdMob SDK reports. Purpose: Advertising or marketing, Analytics/fraud prevention. Not collected by us, shared with Google. Purchases: handled by Google Play, no purchase data reaches us. Follow Google's "Data disclosure for AdMob" guide for the exact boxes.
* Is all data encrypted in transit? Yes (the ad SDK uses HTTPS).
* Can users request that their data is deleted? Data is only on the device; "Start over" in the menu deletes it.
* Ads: **Yes, the app contains ads** (rewarded video, AdMob). Target audience: **13+** is not required to be chosen; choose "all ages" only if you also fill in the Families policy. The safest choice for a first release is target age **18+ not needed / 13+ general audience**; the game itself is suitable for all ages.
* Government / financial / health apps: no.

## App Store "App Privacy" label
* Data used to **track you**: Device ID, Advertising Data, Product Interaction (all for Third-Party Advertising, not linked to identity). Follow Google's "Apple App Privacy" guide for AdMob to check the boxes. The app asks for tracking permission (App Tracking Transparency) the first time "Watch ad" is tapped. The privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`) says the same: tracking on, the Google ad domains, those three data types, one required-reason API (UserDefaults, reason CA92.1, used by the web view).
* Age rating: answer the ads questions truthfully. Do not turn on "child directed" (the game is not a Families app).
* Export compliance: the app uses no encryption of its own (`ITSAppUsesNonExemptEncryption = false`).

## Review notes (App Store Connect, "Notes for the reviewer")
No login is needed. The game is fully playable offline. Progress is saved on the device. Tap the round badge on the wave surfing zone to start earning, open the zone to buy upgrades. To see the expansion animation a player needs to reach the requirements shown on the Expand screen.

## Pictures
* Icon 1024×1024: `store/icon-1024.png` (opaque, no alpha).
* Screenshots: `store/screenshots/iphone-6.9/` (1290×2796) and `store/screenshots/android-phone/` (1080×1920). Make them again with `npm run dev` and `npm run store:screenshots`.
* Google Play also needs a **feature graphic 1024×500**: not made yet (use the icon picture on the sea gradient with the name).
