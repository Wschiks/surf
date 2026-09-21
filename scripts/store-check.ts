// Checks what can be checked by a computer before a store release. Usage: npm run store:check
// It lists what is ready and what still needs a person (accounts, contact details, signing).
import fs from 'node:fs';
import { PUBLISHER } from '../src/config/legal';
import { BALANCE } from '../src/config/balance';

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
ok('debug hook only in development or with ?debug', /import\.meta\.env\.DEV \|\| location\.search\.includes\('debug'\)/.test(src));
ok('no random numbers in the game', !/Math\.random/.test(fs.readdirSync('src', { recursive: true }).filter((f) => String(f).endsWith('.ts')).map((f) => read('src/' + f)).join('\n')));
ok('base away time is 2 hours', BALANCE.offlineCapSeconds === 2 * 3600);
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
console.log('--- only a person can do these');
person('Apple Developer Program account (99 USD a year), an App Store Connect app record with this bundle id', 'developer.apple.com');
person('Google Play Console account (25 USD once), an app with this package name', 'play.google.com/console');
person('Host public/privacy.html on a web address and give it to both stores (privacy policy URL); add a support URL / email', 'for example GitHub Pages or any web host');
person('Build and sign: Xcode archive (needs a Mac with Xcode) and an Android release bundle (.aab, needs Android Studio and a signing key you keep safe)', 'see docs/STORE-READINESS.md');
person('Fill in the store forms with the answers in store/listing.md (age rating, data safety, privacy label, export compliance)', 'store/listing.md');
person('Test on a real iPhone and a real Android phone (TestFlight / internal testing) before submitting', '');

console.log(`\n${failures ? failures + ' check(s) FAILED' : 'all computer checks passed'}; ${todo} things need a person.`);
process.exit(failures ? 1 : 0);
