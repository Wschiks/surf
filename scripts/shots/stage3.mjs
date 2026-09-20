export default async ({ page, shot, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1500);
  const ev = (fn, a) => page.evaluate(fn, a);
  // give the player progress
  await ev(() => {
    const s = window.__surf.game.state;
    s.coins = 1e7; s.reputation = 300;
    const z = s.zones['wave-1']; z.capacity = 6; z.price = 6; z.speed = 3;
  });
  await ev(() => window.__surf.ui.openZone('wave-2'));
  await page.waitForTimeout(1500);
  await shot('locked-l2');
  await page.click('[data-unlock]', { force: true });
  await page.waitForTimeout(1500);
  await shot('l2-unlocked');
  await ev(() => window.__surf.ui.openZone('wave-3'));
  await page.waitForTimeout(1500);
  await shot('locked-l3');
  await page.click('[data-unlock]', { force: true });
  await ev(() => window.__surf.ui.openZone('wave-4'));
  await page.waitForTimeout(1500);
  await shot('locked-l4');
  await page.click('[data-unlock]', { force: true });
  await page.waitForTimeout(800);
  // give them managers so guests move
  await ev(() => { const s = window.__surf.game.state; for (const id of ['wave-1','wave-2','wave-3','wave-4']) { s.zones[id].manager = true; s.zones[id].capacity = 5; } });
  await ev(() => window.__surf.ui.closeSheet());
  await ev(() => { const v = window.__surf.view; v.jumpTo(600, 350, v.width / 4.2); });
  await page.waitForTimeout(1500);
  await shot('wave-area');
  await ev(() => { const v = window.__surf.view; v.jumpTo(500, 500, v.minPpu()); });
  await page.waitForTimeout(800);
  await shot('whole');
};
