export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await shot('01-start');
  await ev(() => { document.querySelector('.quests').classList.add('collapsed'); const s = window.__surf.game.state; s.expansions = 2; s.coins = 1e12; for (const k of Object.keys(s.sports)) s.sports[k] = true; for (const [id, z] of Object.entries(s.zones)) { z.owned = true; z.manager = true; z.capacity = 4; } s.facilities.shop = 3; s.facilities.cafe = 2; s.facilities.showers = 1; s.facilities.lifeguard = 2; });
  await page.waitForTimeout(2500);
  for (const [n, x, y, a] of [['beach', 5, 0.9, 3], ['skim', 2.3, 2.6, 3], ['reef', 8.5, 3.2, 3], ['sea', 7.5, 5.2, 3.2], ['ocean', 4, 7, 3]]) {
    await ev(([x, y, a]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / a); }, [x, y, a]);
    await page.waitForTimeout(1500);
    await shot('02-' + n);
  }
};
