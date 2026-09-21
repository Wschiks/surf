# Store listing (copy and paste into App Store Connect and Google Play Console)

Fill in the names in `[brackets]`. Nothing here has been submitted.

## Basics
| | App Store | Google Play |
|---|---|---|
| App name | Surf Tycoon: Idle Beach Game (max 30 characters) | Surf Tycoon: Idle Beach Game (max 30) |
| Subtitle / short description | Run your own surf beach (max 30) | Build a surf beach and grow it into a sea-sport empire. (max 80) |
| Category | Games > Simulation (second: Casual) | Game > Simulation |
| Price | Free | Free |
| In-app purchases / ads | None | None (declare "no ads") |
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
• No ads. No purchases. No account. Your game stays on your device.

## What's new (first release)
First release.

## Age rating answers
* Violence, sexual content, nudity, profanity, drugs, alcohol, gambling (including simulated), horror, medical content: **none**.
* Unrestricted web access: no. User-generated content / chat: none.
* Loot boxes or random rewards: **none** (the game has no randomness at all).
* Expected result: **App Store 4+**, **Google Play (IARC) Everyone**.

## Google Play "Data safety" form
* Does the app collect or share any user data? **No.**
* Is all data encrypted in transit? Not applicable (no data leaves the device).
* Can users request that their data is deleted? Data is only on the device; "Start over" in the menu deletes it.
* Ads: **No ads.** Target audience: **13+** is not required to be chosen; choose "all ages" only if you also fill in the Families policy. The safest choice for a first release is target age **18+ not needed / 13+ general audience**; the game itself is suitable for all ages.
* Government / financial / health apps: no.

## App Store "App Privacy" label
* **Data Not Collected.** (The game has no accounts, analytics, ads or network calls.) The app includes a privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`): no tracking, no collected data types, one required-reason API (UserDefaults, reason CA92.1, used by the web view).
* Export compliance: the app uses no encryption of its own (`ITSAppUsesNonExemptEncryption = false`).

## Review notes (App Store Connect, "Notes for the reviewer")
No login is needed. The game is fully playable offline. Progress is saved on the device. Tap the round badge on the wave surfing zone to start earning, open the zone to buy upgrades. To see the expansion animation a player needs to reach the requirements shown on the Expand screen.

## Pictures
* Icon 1024×1024: `store/icon-1024.png` (opaque, no alpha).
* Screenshots: `store/screenshots/iphone-6.9/` (1290×2796) and `store/screenshots/android-phone/` (1080×1920). Make them again with `npm run dev` and `npm run store:screenshots`.
* Google Play also needs a **feature graphic 1024×500**: not made yet (use the icon picture on the sea gradient with the name).
