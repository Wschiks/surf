export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForFunction(() => window.__surf, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await ev(() => { const s = window.__surf.game.state; s.coins = 10; s.totalCoins = 6; document.querySelector('.quests').classList.add('collapsed'); });
  await page.waitForTimeout(700);
  await shot('01-tip-upgrade');
  await ev(() => { const s = window.__surf.game.state; s.tips = {}; const z = s.zones['wave-1']; z.price = 3; s.coins = 500; });
  await page.waitForTimeout(700);
  await shot('02-tip-manager');
  await page.click('.tip', { force: true });
  await page.waitForTimeout(1200);
  await shot('03-manager-row');
  console.log('tips', JSON.stringify(await ev(() => window.__surf.game.state.tips)));
};
