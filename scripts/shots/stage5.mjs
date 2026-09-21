export default async ({ page, shot, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1500);
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => { const s = window.__surf.game.state; s.coins = 1e15; s.reputation = 1e6; for (const id of ['wave-2','skimboarding-1','skimboarding-2']) s.zones[id].owned = true; s.sports.skimboarding = true; });
  await ev(() => window.__surf.ui.openZone('windsurfing-1'));
  await page.waitForTimeout(1200);
  await shot('wind-card');
  await page.click('[data-unlock]', { force: true });
  await page.waitForTimeout(500);
  await ev(() => window.__surf.ui.closeSheet());
  await ev(() => { const v = window.__surf.view; v.jumpTo(500, 600, v.width / 5); });
  await page.waitForTimeout(3000);
  await shot('sea-cleared');
  // unlock everything in the sea
  await ev(() => { const s = window.__surf.game.state; for (const sp of ['windsurfing','kitesurfing','foil']) { s.sports[sp] = true; for (let l = 1; l <= 4; l++) { const z = s.zones[sp + '-' + l]; z.owned = true; z.manager = l % 2 === 0; z.capacity = 3; } } });
  await page.waitForTimeout(800);
  await ev(() => { const v = window.__surf.view; v.jumpTo(500, 650, v.width / 8.5); });
  await page.waitForTimeout(1500);
  await shot('sea-all');
  await ev(() => { const v = window.__surf.view; v.jumpTo(500, 650, v.width / 3.2); });
  await page.waitForTimeout(1500);
  await shot('sea-close');
  await ev(() => { const v = window.__surf.view; v.jumpTo(500, 150, v.width / 3); });
  await page.waitForTimeout(1500);
  await shot('kite-launch');
};
