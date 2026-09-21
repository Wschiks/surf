export default async ({ page, shot, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1500);
  const ev = (fn, a) => page.evaluate(fn, a);
  await ev(() => { const s = window.__surf.game.state; s.reputation = 500; s.facilities.shop = 3; s.facilities.cafe = 2; s.facilities.showers = 1; s.facilities.lifeguard = 2; s.sports.kitesurfing = true; });
  await ev(() => { const v = window.__surf.view; v.jumpTo(500, 100, v.width / 2.6); });
  await page.waitForTimeout(2000);
  await shot('beach');
  await ev(() => { const v = window.__surf.view; v.jumpTo(500, 100, v.width / 5); });
  await page.waitForTimeout(1500);
  await shot('beach-wide');
};
