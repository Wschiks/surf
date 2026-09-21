export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForFunction(() => window.__surf, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await ev(() => { document.querySelector('.quests').classList.add('collapsed'); const s = window.__surf.game.state; s.expansions = 2; s.coins = 1e12; for (const k of Object.keys(s.sports)) s.sports[k] = true; for (const [id, z] of Object.entries(s.zones)) { z.owned = true; z.manager = true; z.capacity = 4; } });
  await page.waitForTimeout(2600);
  for (const [n, x, y, a] of [['turbines', 15.2, 5.4, 4], ['island', -0.3, 5, 4], ['ship', 14.5, 7.4, 4]]) {
    await ev(([x, y, a]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / a); v.cx = x * 100; v.cy = y * 100; }, [x, y, a]);
    await page.waitForTimeout(1800);
    await shot(n);
  }
};
