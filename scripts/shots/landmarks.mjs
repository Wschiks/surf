export default async ({ page, shot, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1500);
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => { const s = window.__surf.game.state; for (const id of ['wave-2','wave-3','wave-4']) { s.zones[id].owned = true; s.zones[id].manager = true; s.zones[id].capacity = 3; } });
  for (const [name, x, y, d] of [['reef', 5.0, 4.5, 2.6], ['nazare', 8.2, 4.4, 2.6], ['rocks', 1.7, 2.0, 2.4], ['reef-wide', 6.5, 4.2, 5]]) {
    await ev(([x, y, d]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / d); }, [x, y, d]);
    await page.waitForTimeout(1200);
    await shot(name);
  }
};
