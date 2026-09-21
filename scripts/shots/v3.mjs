export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  const jump = async (x, y, across, wait = 1500) => {
    await ev(([x, y, a]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / a); }, [x, y, across]);
    await page.waitForTimeout(wait);
  };
  await page.goto(base);
  await page.waitForTimeout(1800);
  await shot('01-start');
  await ev(() => { const s = window.__surf.game.state; s.coins = 1e6; for (const id of ['wave-1','skimboarding-1']) { s.zones[id].manager = true; s.zones[id].capacity = 4; } });
  await jump(7.9, 2.2, 3.4); await shot('02-wave-skim');
  await jump(2.4, 2.4, 3.4); await shot('03-skim');
  await jump(7.5, 4, 14, 1200); await shot('04-whole');
  await ev(() => { window.__surf.game.state.coins = 1e12; window.__surf.game.state.reputation = 1e6; for (const z of Object.keys(window.__surf.game.state.zones)) { const s = window.__surf.game.state; if (s.sports[z.split('-')[0]]) { s.zones[z].owned = true; s.zones[z].manager = true; s.zones[z].capacity = 4; } } });
  await ev(() => window.__surf.ui.openBeach());
  await page.waitForTimeout(1200); await shot('05-beach-expansion');
  await page.click('[data-xbtn]', { force: true });
  await page.waitForTimeout(700); await shot('06-wave-coming');
  await page.waitForTimeout(800); await shot('07-wave-covers');
  await page.waitForTimeout(1100); await shot('08-wave-leaving');
  await page.waitForTimeout(1800);
  await shot('09-after');
  await jump(7.5, 5.2, 3.2, 2500); await shot('10-sea-open');
};
