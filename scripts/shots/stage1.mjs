export default async ({ page, shot, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1500);
  await shot('start');
  const view = (fn, arg) => page.evaluate(fn, arg);
  // zoom out to the whole map
  await view(() => { const v = window.__surf.view; v.jumpTo(500, 500, v.minPpu()); });
  await shot('whole-map');
  // areas
  for (const [name, x, y, div] of [['reef', 5.2, 4.3, 3], ['rocks', 1.6, 2, 3], ['fort', 8.7, 4.2, 3], ['ocean', 5, 9, 4]]) {
    await view(([x, y, d]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / d); }, [x, y, div]);
    await shot(name);
  }
  await page.goto(base + '?unlock=all');
  await page.waitForTimeout(1200);
  await view(() => { const v = window.__surf.view; v.jumpTo(500, 500, v.minPpu()); });
  await shot('whole-map-cleared');
};
