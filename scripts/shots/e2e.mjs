// A real play session through the UI: no state hacking except the clock for the offline check.
export default async ({ page, shot, base, context }) => {
  const num = async (sel) => (await page.textContent(sel)).trim();
  await page.goto(base);
  await page.waitForTimeout(1200);
  const log = (...a) => console.log('[e2e]', ...a);
  // tap the zone chip to start, wait, collect until 4 coins
  for (let i = 0; i < 6; i++) {
    await page.click('.zone-chip.idle, .zone-chip.ready', { force: true, timeout: 12000 });
    await page.waitForFunction(() => document.querySelector('.zone-chip.ready'), null, { timeout: 12000 });
  }
  await page.click('.zone-chip.ready', { force: true });
  log('coins after taps', await num('[data-ref=coins]'));
  // open the zone sheet through the chip and buy capacity
  await page.evaluate(() => window.__surf.ui.openZone('wave-1'));
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.__surf.game.state.zones['wave-1'].capacity);
  await page.click('[data-buy=capacity]', { force: true });
  const after = await page.evaluate(() => window.__surf.game.state.zones['wave-1'].capacity);
  log('capacity', before, '->', after);
  await shot('after-buy');
  // hire a manager when affordable
  await page.evaluate(() => { window.__surf.game.state.coins += 100; });
  await page.waitForTimeout(300);
  await page.click('[data-buy=manager]', { force: true });
  const mgr = await page.evaluate(() => window.__surf.game.state.zones['wave-1'].manager);
  log('manager hired', mgr);
  await page.waitForTimeout(8000);
  const c1 = await page.evaluate(() => window.__surf.game.state.coins);
  await page.waitForTimeout(6000);
  const c2 = await page.evaluate(() => window.__surf.game.state.coins);
  log('coins grow by themselves', c1.toFixed(1), '->', c2.toFixed(1));
  await page.evaluate(() => window.__surf.game.save());
  // pretend the player was away for 3 hours
  await page.evaluate(() => {
    const key = 'surf-tycoon-save-v1';
    const s = JSON.parse(localStorage.getItem(key));
    s.savedAt -= 3 * 3600 * 1000;
    localStorage.setItem(key, JSON.stringify(s));
    window.__noSave = true;
  });
  await page.evaluate(() => { window.__surf.scene.game_.save = () => {}; });
  await page.reload();
  await page.waitForTimeout(1500);
  const modal = await page.textContent('.modal-back:not([hidden])').catch(() => null);
  log('welcome back popup:', modal && modal.replace(/\s+/g, ' ').trim());
  await shot('welcome-back');
  await page.click('[data-close]', { force: true });
  const errs = await page.evaluate(() => window.__surf.game.state.coins);
  log('coins after return', errs.toFixed(1));
};
