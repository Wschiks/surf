export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await ev(() => { const s = window.__surf.game.state; s.coins = 1e6; const z = s.zones['wave-1']; z.manager = true; z.capacity = 6; document.querySelector('.quests').classList.add('collapsed'); });
  await ev(() => { const v = window.__surf.view; v.jumpTo(790, 240, 700); });
  await page.waitForTimeout(2500);
  await shot('surfers');
};
