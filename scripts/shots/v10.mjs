export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await shot('01-quests');
  await ev(() => document.querySelector('.q-list').scrollTo({ left: 400 }));
  await page.waitForTimeout(500);
  await shot('02-scrolled');
  console.log('quests:', JSON.stringify(await ev(() => window.__surf.game.state.quests.map((q) => q.kind + ':' + q.target + ':' + q.reward))));
  await ev(() => window.__surf.ui.openZone('wave-1'));
  await page.waitForTimeout(900);
  await shot('03-zone-sheet');
};
