// The texts of the Terms of Service and the Privacy Policy, shown in the menu.
// They are short and simple on purpose and describe what the game really does today (no accounts, no
// purchases, no tracking). They are a starting point, not legal advice: before a store release, fill in
// the name and contact details of the publisher and have the texts checked.

import { BOX_ODDS, BOXES, RARITIES, RARITY_LOOK } from './skins';
import { CLUB } from './shop';

/** The odds of a box as text, from the game's own numbers: "Common 50%, Rare 36%, ...". */
const odds = (kind: 'normal' | 'golden') => RARITIES.map((r) => `${RARITY_LOOK[r].name} ${BOX_ODDS[kind][r]}%`).join(', ');

export interface LegalSection {
  title: string;
  body: string;
}

export const LEGAL_UPDATED = '14 November 2026';

/**
 * Who publishes the game. FILL THIS IN before a store release: the stores (and the law in many countries) want a
 * real name and a working contact address, and they are printed in the Terms and the Privacy Policy.
 * `npm run store:check` fails while `email` is empty.
 */
export const PUBLISHER = {
  name: 'MugStudio',
  email: 'woutschiks@gmail.com',
  website: '',
};

/** The contact sentence used at the end of the legal texts. */
export function contactText(): string {
  const who = PUBLISHER.name || 'the publisher of the game';
  if (!PUBLISHER.email) return `Contact ${who} with questions. (The contact address is added when the game is released.)`;
  return `Contact ${who} at ${PUBLISHER.email}${PUBLISHER.website ? ` (${PUBLISHER.website})` : ''} with questions.`;
}

export const TERMS: LegalSection[] = [
  { title: '1. About this game', body: 'Surf Tycoon is a free idle game about running a water-sports spot. By playing it you agree to these terms. If you do not agree, please do not play.' },
  { title: '2. Free to play and the shop', body: `The game is free to play. In the phone apps short ad breaks show every few minutes (never in the first minutes of play), and you can choose to watch video ads for bonuses (gems, coins x2, the rescue helicopter's gift). In the shop you can buy optional items: packs of gems (as often as you like), coins for gems, treasure boxes, and two one-time items, "Remove ads" and "Coins x5". Prices are shown in the shop in your own currency. Purchases are paid through the App Store or Google Play, are for your own use on your own account, and the one-time items can be restored with "Restore purchases" in the shop. Gems that were bought and spent cannot be restored or refunded by us. Coins, gems, skins and everything else in the game have no value outside the game and cannot be exchanged for money or traded.` },
  { title: '3. Treasure boxes and chance', body: `A treasure box gives one piece of a skin; which skin is drawn by chance. The odds are shown in the shop before you buy, behind the "?" of each box. A normal box: ${odds('normal')}. A golden box: ${odds('golden')}. Boxes can be earned for free (quests, new sections, the daily calendar, the rescue helicopter, the Surf Club) or bought: the coin box with in-game coins (${BOXES.coinStart.toLocaleString('en')} coins for the first, each next one costs ${BOXES.coinGrowth} times more), 3 boxes for ${BOXES.threeGems} gems, a golden box for ${BOXES.goldenGems} gems. The draw is fixed when the box is opened and is saved, so it cannot be changed by reloading. Surf Club skins never come from boxes. The rescue helicopter's gift and when it comes are also decided by chance. Nothing else in the game is random.` },
  { title: '4. The Surf Club', body: `The Surf Club is a monthly subscription (price shown in the shop, in your own currency). For as long as it is active it gives coins x${CLUB.coinMult}, ad rewards without watching ads and no ad breaks, ${CLUB.gemsPerDay} gems and ${CLUB.boxesPerDay} treasure box once every 24 hours (claimed in the shop; missed days do not add up), ${CLUB.awayHours} extra hours of away time, and a Surf Club skin each month: right away when you join you get that month's skin, and on the 1st of every month you are a member (at 00:00, by your device's clock) you get that month's skin. So joining on the 24th gives this month's skin and next month's. A month in which you are not a member on its 1st is not given later. Skins you have received stay yours after the subscription ends. The subscription renews automatically every month until you cancel it in the settings of your App Store or Google Play account (cancel at least 24 hours before the renewal date to avoid the next charge); you keep the benefits until the paid period ends. We cannot cancel it for you. Refunds follow the rules of the store you bought from.` },
  { title: '5. Daily rewards', body: 'The daily rewards calendar gives one reward for each day you play, and a new calendar starts on the 1st of each month. It uses the date of your device.' },
  { title: '6. Your progress', body: 'Your progress is saved on your own device. If you clear the data of the app or the browser, or use "Start over" in the menu, your progress is gone. We cannot restore lost progress.' },
  { title: '7. Fair play', body: 'You may play the game for your own enjoyment. Please do not copy, sell or pass off the game as your own, and do not try to break or misuse it.' },
  { title: '8. No promises', body: 'The game is provided "as is". It is still being built, so things can change, get rebalanced or contain mistakes. We do not promise that it will always work or be available, and we are not responsible for any loss that comes from playing it, as far as the law allows.' },
  { title: '9. Changes', body: 'We may change the game or these terms. When we do, the date below changes. If you keep playing after a change, you accept the new terms.' },
  { title: '10. Contact', get body() { return `Questions about these terms? ${contactText()}`; } },
];

export const PRIVACY: LegalSection[] = [
  { title: 'The short version', body: 'Surf Tycoon does not collect any personal data itself and has no account or server. Everything you build stays on your device. The only exception is the ads in the phone apps, which are shown by Google AdMob (see "Ads").' },
  { title: 'What is stored', body: 'Your game progress (coins, zones, upgrades, skins, treasure boxes, the daily calendar and so on), the time it was last saved, what you bought, and your sound setting. This is stored on your device only, in the local storage of the app or browser.' },
  { title: 'What is not collected', body: 'The game itself collects no name, no email address, no account, no location, no contacts and no analytics. The game does not connect to any server of ours to run.' },
  { title: 'Ads', body: 'The phone apps show ads from Google AdMob: optional rewarded video ads (the "Watch ad" buttons, the ad streak in the shop, the rescue helicopter) and short ad breaks every few minutes. "Remove ads" and the Surf Club turn the ad breaks off and give the rewards without ads. When an ad is shown, Google and its ad partners may use your device advertising ID and collect device and usage information to show and measure ads and to prevent fraud, as described in Google\'s privacy policy (policies.google.com/privacy). On iPhone the app first asks whether apps may track you: if you say no, you still get ads but they are not personalised. In the European Economic Area, the UK and Switzerland a consent form asks about your choices before any ad is loaded. We do not receive any of this data.' },
  { title: 'Purchases', body: 'Payments for gem packs, "Remove ads", "Coins x5" and the Surf Club subscription are handled entirely by Apple or Google. We never see your name, card or other payment details. The game only learns whether the store says you own an item or your subscription is active, and remembers that on your device.' },
  { title: 'Third parties', body: 'Apart from Google AdMob for the optional ads and the App Store or Google Play for purchases, there are no third-party services in the game. If you play in a web browser, the website that hosts the game can see normal technical information (like your IP address) in its own logs, as with any website.' },
  { title: 'Your choices', body: 'You can delete all data the game stores at any time with "Start over" in the menu, or by clearing the site or app data.' },
  { title: 'Children', body: 'The game does not ask for any personal information.' },
  { title: 'Changes and contact', get body() { return `If this ever changes (for example when online features are added), this policy will be updated before it does. ${contactText()}`; } },
];

export const CREDITS = [
  ['Game design', 'The author of the Surf Tycoon concept'],
  ['Built with', 'Phaser 4, TypeScript and Vite'],
  ['Art and icons', 'Drawn in code; skin designs by the author and a friend'],
  ['Sound', 'Made with the Web Audio API'],
] as const;
