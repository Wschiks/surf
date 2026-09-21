// The set of screenshots for the morning review. Uses a fast-forwarded save to reach later stages.
export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  const jump = async (x, y, across, wait = 1500) => {
    await ev(([x, y, a]) => { const v = window.__surf.view; v.jumpTo(x * 100, y * 100, v.width / a); }, [x, y, across]);
    await page.waitForTimeout(wait);
  };
  await page.goto(base);
  await page.waitForTimeout(1500);
  await shot('01-start');
  await ev(() => window.__surf.ui.openZone('wave-1'));
  await page.waitForTimeout(1200);
  await shot('02-zone-sheet');
  await ev(() => window.__surf.ui.closeSheet());
  await ev(() => window.__surf.ui.openBeach());
  await page.waitForTimeout(1000);
  await shot('03-beach-sheet');
  await ev(() => window.__surf.ui.closeSheet());
  // mid game: wave surfing complete, skimboarding started, some facilities
  await ev(() => {
    const s = window.__surf.game.state;
    s.coins = 5e6; s.reputation = 400;
    for (const id of ['wave-2', 'wave-3', 'wave-4', 'skimboarding-2']) s.zones[id].owned = true;
    s.sports.skimboarding = true; s.zones['skimboarding-1'].owned = true;
    for (const id of ['wave-1', 'wave-2', 'wave-3', 'skimboarding-1']) { const z = s.zones[id]; z.manager = true; z.capacity = 5; z.price = 4; z.speed = 3; }
    s.facilities.shop = 2; s.facilities.cafe = 1; s.facilities.showers = 1; s.facilities.lifeguard = 1;
  });
  await jump(6.3, 3.5, 3.6);
  await shot('04-wave-area');
  await jump(1.7, 3.4, 3);
  await shot('05-skimboarding-cove');
  await ev(() => window.__surf.ui.openSports());
  await page.waitForTimeout(900);
  await shot('06-sports-panel');
  await ev(() => window.__surf.ui.closeSheet());
  await jump(5, 1.4, 2.4);
  await shot('07-beach');
  await jump(3.8, 4.6, 2.6);
  await shot('08-reef');
  await jump(8.4, 4.4, 2.6);
  await shot('09-nazare');
  // late game: everything unlocked
  await ev(() => {
    const s = window.__surf.game.state;
    for (const k of Object.keys(s.sports)) s.sports[k] = true;
    for (const [id, z] of Object.entries(s.zones)) { z.owned = true; z.manager = true; z.capacity = 4 + (id.endsWith('4') ? 0 : 2); z.price = 3; }
    s.coins = 3e15; s.reputation = 5e6;
  });
  await jump(5.0, 6.5, 3.4, 3200);
  await shot('10-sea-area');
  await jump(5.0, 9.0, 3.6);
  await shot('11-ocean-area');
  await jump(9.4, 2.4, 2.8);
  await shot('12-jetty');
  await jump(5, 5, 20, 1500);
  await shot('13-whole-map');
  await ev(() => window.__surf.ui.openZone('sailing-4'));
  await page.waitForTimeout(1500);
  await shot('14-late-zone-sheet');
};
