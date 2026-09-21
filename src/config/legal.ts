// The texts of the Terms of Service and the Privacy Policy, shown in the menu.
// They are short and simple on purpose and describe what the game really does today (no accounts, no
// purchases, no tracking). They are a starting point, not legal advice: before a store release, fill in
// the name and contact details of the publisher and have the texts checked.

export interface LegalSection {
  title: string;
  body: string;
}

export const LEGAL_UPDATED = '21 September 2026';

/**
 * Who publishes the game. FILL THIS IN before a store release: the stores (and the law in many countries) want a
 * real name and a working contact address, and they are printed in the Terms and the Privacy Policy.
 * `npm run store:check` fails while `email` is empty.
 */
export const PUBLISHER = {
  name: '',
  email: '',
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
  { title: '2. Free to play', body: 'The game is free. There are no in-app purchases, no ads and no real-money items. Coins and everything else in the game have no value outside the game and cannot be exchanged for money.' },
  { title: '3. Your progress', body: 'Your progress is saved on your own device. If you clear the data of the app or the browser, or use "Start over" in the menu, your progress is gone. You can make a backup with a save code in the menu. We cannot restore lost progress.' },
  { title: '4. Fair play', body: 'You may play the game for your own enjoyment. Please do not copy, sell or pass off the game as your own, and do not try to break or misuse it.' },
  { title: '5. No promises', body: 'The game is provided "as is". It is still being built, so things can change, get rebalanced or contain mistakes. We do not promise that it will always work or be available, and we are not responsible for any loss that comes from playing it, as far as the law allows.' },
  { title: '6. Changes', body: 'We may change the game or these terms. When we do, the date below changes. If you keep playing after a change, you accept the new terms.' },
  { title: '7. Contact', get body() { return `Questions about these terms? ${contactText()}`; } },
];

export const PRIVACY: LegalSection[] = [
  { title: 'The short version', body: 'Surf Tycoon does not collect, send or sell any personal data. Everything stays on your device.' },
  { title: 'What is stored', body: 'Your game progress (coins, zones, upgrades and so on), the time it was last saved, and your sound setting. This is stored on your device only, in the local storage of the app or browser.' },
  { title: 'What is not collected', body: 'No name, no email address, no account, no location, no contacts, no advertising ID and no analytics or tracking of any kind. The game does not connect to any server to run.' },
  { title: 'Third parties', body: 'There are no ads and no third-party services in the game. If you play in a web browser, the website that hosts the game can see normal technical information (like your IP address) in its own logs, as with any website.' },
  { title: 'Your choices', body: 'You can delete all data the game stores at any time with "Start over" in the menu, or by clearing the site or app data. A save code you copy is yours: keep it somewhere safe, because anyone with the code can load your progress.' },
  { title: 'Children', body: 'The game is suitable for all ages and does not ask for any personal information.' },
  { title: 'Changes and contact', get body() { return `If this ever changes (for example when online features are added), this policy will be updated before it does. ${contactText()}`; } },
];

export const CREDITS = [
  ['Game design', 'The author of the Surf Tycoon concept'],
  ['Built with', 'Phaser 4, TypeScript and Vite'],
  ['Art and icons', 'Drawn in code, no downloaded art'],
  ['Sound', 'Made with the Web Audio API'],
] as const;
