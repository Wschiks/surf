// Browser smoke test: builds nothing, serves dist/ with `vite preview`, plays a short session and checks the basics.
// Usage: npm run build && npm run smoke
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const port = 4179;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}`;
const fail = [];
const check = (name, ok, extra = '') => {
  console.log(ok ? 'ok  ' : 'FAIL', name, extra);
  if (!ok) fail.push(name);
};

try {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 400, height: 800 }, hasTouch: true })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.waitForSelector('.zone-chip', { timeout: 15000 });
  check('game loads with a zone tag on the map', true);

  const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__surf.game.state)));
  await page.click('.zone-chip.idle', { force: true });
  await page.waitForSelector('.zone-chip.ready', { timeout: 15000 });
  await page.click('.zone-chip.ready', { force: true });
  check('a session pays coins', (await state()).coins >= 3, String((await state()).coins));

  await page.evaluate(() => window.__surf.ui.openZone('wave-1'));
  await page.waitForSelector('.sheet.open [data-buy=capacity]');
  await page.evaluate(() => (window.__surf.game.state.coins = 100));
  await page.waitForTimeout(300);
  await page.click('[data-buy=capacity]', { force: true });
  check('buying an upgrade works', (await state()).zones['wave-1'].capacity === 1);
  await page.click('[data-buy=manager]', { force: true });
  check('hiring a manager works', (await state()).zones['wave-1'].manager === true);
  const c1 = (await state()).coins;
  await page.waitForTimeout(7000);
  check('a managed zone earns by itself', (await state()).coins > c1);

  await page.evaluate(() => window.__surf.game.save());
  await page.reload();
  await page.waitForSelector('.zone-chip', { timeout: 15000 });
  check('progress is saved', (await state()).zones['wave-1'].manager === true);

  const view = await page.evaluate(() => {
    const el = document.getElementById('game');
    const v = window.__surf.view;
    const before = v.ppu;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, clientX: 200, clientY: 400, bubbles: true, cancelable: true }));
    return { before, after: v.ppu };
  });
  check('mouse wheel zooms the map', view.after > view.before);
  check('no errors in the console', errors.length === 0, errors.join(' | '));
  await browser.close();
} finally {
  server.kill();
}
process.exit(fail.length ? 1 : 0);
