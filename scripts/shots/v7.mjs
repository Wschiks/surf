export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await ev(() => { const s = window.__surf.game.state; s.expansions = 2; s.reputation = 1e9; s.coins = 1e12; for (const k of Object.keys(s.sports)) s.sports[k] = true; for (const [id, z] of Object.entries(s.zones)) { z.owned = true; z.manager = true; z.capacity = 4; } });
  await ev(() => { document.querySelector('.quests')?.classList.add('collapsed'); });
  await page.waitForTimeout(2500);
  for (const [name, x, y, a] of [['wave', 8.5, 2.8, 4.6], ['skim', 2.6, 2.8, 4.6], ['sea', 7.5, 5.2, 8], ['whole', 7.5, 4, 30]]) {
    await ev(([x, y, a]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / a); }, [x, y, a]);
    await page.waitForTimeout(1800);
    await shot(name);
  }
};
