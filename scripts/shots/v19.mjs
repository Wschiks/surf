export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await ev(() => { document.querySelector('.quests').classList.add('collapsed'); });
  for (const [n, x, y, a] of [['edge', 7.5, 4, 3], ['wide', 7.5, 5, 8], ['whole', 7.5, 4, 40]]) {
    await ev(([x, y, a]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / a); }, [x, y, a]);
    await page.waitForTimeout(1500);
    await shot(n);
  }
};
