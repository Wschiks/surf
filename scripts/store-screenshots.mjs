// Makes the store screenshots (needs the dev server on port 5173: npm run dev).
// iPhone 6.9"/6.7" size 1290 x 2796 and an Android phone size 1080 x 1920, from a few prepared game states.
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.URL ?? 'http://localhost:5173/?debug=1';
const sets = [
  { dir: 'store/screenshots/iphone-6.9', w: 430, h: 932, dpr: 3 }, // 1290 x 2796
  { dir: 'store/screenshots/android-phone', w: 360, h: 640, dpr: 3 }, // 1080 x 1920
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const set of sets) {
  fs.mkdirSync(set.dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: set.w, height: set.h }, deviceScaleFactor: set.dpr, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForFunction(() => window.__surf, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const ev = (fn, a) => page.evaluate(fn, a);
  const shot = async (name) => {
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${set.dir}/${name}.png` });
    console.log('saved', `${set.dir}/${name}.png`);
  };
  const jump = (x, y, across) => ev(([x, y, a]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / a); }, [x, y, across]);

  // 1. the very start
  await shot('01-start');
  await ev(() => document.querySelector('.quests')?.classList.add('collapsed')); // (the first picture shows the quests, the others show the map)
  // 2. a busy first part: wave surfing and skimboarding with managers
  await ev(() => {
    const s = window.__surf.game.state;
    s.coins = 4200; s.sports.skimboarding = true;
    for (const id of ['wave-1', 'wave-2', 'skimboarding-1']) { const z = s.zones[id]; z.owned = true; z.manager = true; z.capacity = 6; z.price = 30; z.speed = 3; }
    s.zones['skimboarding-1'].manager = true;
    s.facilities.shop = 2;
    window.__surf.game.save();
  });
  await jump(7.9, 2.4, 2.6);
  await shot('02-riding');
  // 3. the upgrade sheet
  await ev(() => window.__surf.ui.openZone('wave-1'));
  await shot('03-upgrades');
  await ev(() => window.__surf.ui.closeSheet());
  // 4. the Sea after the first expansion, everything busy
  await ev(() => {
    const s = window.__surf.game.state;
    s.expansions = 1; s.coins = 2.5e9;
    for (const k of Object.keys(s.sports)) s.sports[k] = k !== 'sailing';
    for (const [id, z] of Object.entries(s.zones)) if (!id.startsWith('sailing')) { z.owned = true; z.manager = true; z.capacity = 5; z.price = 40; }
  });
  await page.waitForTimeout(2500);
  await jump(7.5, 5.2, 3.6);
  await shot('04-the-sea');
  // 5. the whole map
  await jump(7.5, 4, 30);
  await shot('05-the-whole-map');
  // 6. the expansion sheet
  await ev(() => window.__surf.ui.openExpand());
  await shot('06-expand');
  await ctx.close();
}
await browser.close();
