export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await shot('01-start-quests');
  await ev(() => { const s = window.__surf.game.state; s.coins = 1e6; s.zones['wave-1'].price = 25; s.zones['wave-1'].capacity = 7; });
  await page.waitForTimeout(1500);
  await shot('02-quests-ready');
  await page.click('.q-claim', { force: true });
  await page.waitForTimeout(800);
  console.log('coins after claim', await ev(() => window.__surf.game.state.coins), 'done', await ev(() => window.__surf.game.state.questsDone));
  await shot('03-claimed');
  // expand with nothing done
  await page.click('[data-ref=expand]', { force: true });
  await page.waitForTimeout(900);
  await shot('04-expand-always');
  await page.click('[data-xbtn]', { force: true });
  await page.waitForTimeout(900); await shot('05-wave-1');
  await page.waitForTimeout(700); await shot('06-wave-2');
  await page.waitForTimeout(2600);
  console.log('expansions', await ev(() => window.__surf.game.state.expansions));
  await shot('07-after');
};
