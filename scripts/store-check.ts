// Checks what can be checked by a computer before a store release. Usage: npm run store:check
// It lists what is ready and what still needs a person (accounts, contact details, signing).
import fs from 'node:fs';
import { PUBLISHER } from '../src/config/legal';
import { offlineCap } from '../src/core/economy';
import { newGame } from '../src/core/state';

const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const pkg = JSON.parse(read('package.json'));
const cap = read('capacitor.config.ts');
const appId = /appId:\s*'([^']+)'/.exec(cap)?.[1] ?? '';
const gradle = read('android/app/build.gradle');
const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
const plist = read('ios/App/App/Info.plist');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const src = ['src/ui/menu.ts', 'src/ui/ui.ts', 'src/scene/MapScene.ts', 'src/config/balance.ts'].map(read).join('\n');

let failures = 0;
let todo = 0;
const ok = (name: string, pass: boolean, hint = '') => {
  console.log(`${pass ? 'ok   ' : 'FAIL '} ${name}${!pass && hint ? '  -> ' + hint : ''}`);
  if (!pass) failures++;
};
const person = (name: string, hint: string) => {
  console.log(`TODO  ${name}  -> ${hint}`);
  todo++;
};

console.log('--- the game');
ok('no test or cheat options in the game', !/100e9|Add 100B|testAlwaysExpand/.test(src));
ok('unlimited test coins are off (VITE_TEST_COINS is not set)', process.env.VITE_TEST_COINS !== '1', 'unset VITE_TEST_COINS before a store build');
ok('debug hook only in development or with ?debug', /import\.meta\.env\.DEV \|\| location\.search\.includes\('debug'\)/.test(src));
// Nothing is random except the author's two exceptions: the rescue helicopter's prize and timing (Math.random in
// src/core/plane.ts) and what a treasure box gives (a generator kept in the save, so a reload cannot reroll a box).
const code = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const randomFiles = fs
  .readdirSync('src', { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.ts') && /Math\.random/.test(code('src/' + f)));
ok('random numbers only for the helicopter (src/core/plane.ts)', randomFiles.length === 1 && randomFiles[0].replace(/\\/g, '/') === 'core/plane.ts', randomFiles.join(', '));
ok('treasure boxes draw from a generator kept in the save', /seed/.test(read('src/core/skins.ts')) && /function random\(state: GameState\)/.test(read('src/core/skins.ts')));
ok('away time of a new game is 2 hours', offlineCap(newGame(0)) === 2 * 3600);
ok('the model lab page is not in the store build', !fs.existsSync('dist/lab.html'), 'it is a development tool (lab.html)');
console.log('--- identity and versions');
ok('app id is not a placeholder (com.example)', !!appId && !appId.startsWith('com.example'), 'set appId in capacitor.config.ts, then npm run phone:id');
ok('Android applicationId matches', gradle.includes(`applicationId "${appId}"`), 'run npm run phone:id');
ok('iOS bundle id matches', pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${appId};`), 'run npm run phone:id');
ok('version is x.y.z', /^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version);
ok('Android versionName matches package.json', gradle.includes(`versionName "${pkg.version}"`), `set versionName "${pkg.version}" (and raise versionCode for every upload)`);
ok('iOS MARKETING_VERSION matches package.json', pbx.includes(`MARKETING_VERSION = ${pkg.version};`), `set MARKETING_VERSION = ${pkg.version} (and raise the build number for every upload)`);
console.log('--- native settings');
ok('iOS: portrait only, iPhone only', !plist.includes('LandscapeLeft') && pbx.includes('TARGETED_DEVICE_FAMILY = 1;'));
ok('iOS: export compliance answered (no encryption)', plist.includes('ITSAppUsesNonExemptEncryption'));
ok('iOS: privacy manifest present and in the project', fs.existsSync('ios/App/App/PrivacyInfo.xcprivacy') && pbx.includes('PrivacyInfo.xcprivacy'));
ok('Android: portrait, no cleartext traffic', manifest.includes('screenOrientation="portrait"') && manifest.includes('usesCleartextTraffic="false"'));
console.log('--- pictures');
for (const f of ['store/icon-1024.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', 'public/icon-512.png', 'public/apple-touch-icon.png']) ok(`exists: ${f}`, fs.existsSync(f), 'run npm run icons');
ok('store screenshots made', fs.existsSync('store/screenshots/iphone-6.9/01-start.png') && fs.existsSync('store/screenshots/android-phone/01-start.png'), 'run npm run dev, then npm run store:screenshots');
console.log('--- legal');
ok('privacy and terms pages exist', fs.existsSync('public/privacy.html') && fs.existsSync('public/terms.html'), 'run npm run build');
ok('publisher name and contact email are filled in (src/config/legal.ts)', !!PUBLISHER.name && /.+@.+\..+/.test(PUBLISHER.email), 'the stores and the law want a real contact');
const terms = read('public/terms.html');
const listing = read('store/listing.md');
ok('Terms explain the treasure boxes and their odds', /treasure box/i.test(terms) && /odds/i.test(terms), 'scripts/build-legal-pages.ts');
ok('Terms explain the Surf Club (monthly skin, daily gems and box)', /Surf Club/.test(terms) && /skin/i.test(terms), 'scripts/build-legal-pages.ts');
ok('store listing answers the age rating with random paid items (treasure boxes)', /random/i.test(listing) && /treasure box/i.test(listing) && !/Loot boxes or random rewards: \*\*none\*\*/.test(listing), 'store/listing.md');
console.log('--- only a person can do these');
person('Apple Developer Program account (99 USD a year), an App Store Connect app record with this bundle id', 'developer.apple.com');
person('Google Play Console account (25 USD once), an app with this package name', 'play.google.com/console');
person('Host public/privacy.html on a web address and give it to both stores (privacy policy URL); add a support URL / email', 'for example GitHub Pages or any web host');
person('Build and sign: Xcode archive (needs a Mac with Xcode) and an Android release bundle (.aab, needs Android Studio and a signing key you keep safe)', 'see docs/STORE-READINESS.md');
person('Fill in the store forms with the answers in store/listing.md (age rating, data safety, privacy label, export compliance)', 'store/listing.md');
person('Test on a real iPhone and a real Android phone (TestFlight / internal testing) before submitting', '');

console.log(`\n${failures ? failures + ' check(s) FAILED' : 'all computer checks passed'}; ${todo} things need a person.`);
process.exit(failures ? 1 : 0);
