// Usage: node scripts/screenshots.mjs <prefix> [--url http://localhost:5173] [--script scripts/shots/<file>.mjs]
// Takes screenshots of the game in a 400x800 headless browser and saves them in screenshots/.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const prefix = args[0] ?? 'shot';
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const base = opt('url', 'http://localhost:5173').replace(/\/?$/, '/') + '?debug=1';
const scriptPath = opt('script', null);

fs.mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const context = await browser.newContext({ viewport: { width: 400, height: 800 }, deviceScaleFactor: Number(process.env.DPR ?? 1), hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

const shot = async (name) => {
  await page.waitForTimeout(400);
  const file = path.join('screenshots', `${prefix}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
};

if (scriptPath) {
  const mod = await import(pathToFileURL(path.resolve(scriptPath)).href);
  await mod.default({ page, shot, base, browser, context });
} else {
  await page.goto(base);
  await page.waitForTimeout(1500);
  await shot('start');
}
if (errors.length) console.log('CONSOLE ISSUES:\n' + errors.slice(0, 15).join('\n'));
await browser.close();
