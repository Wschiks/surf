export default async ({ browser, base, page: _p }) => {
  const sizes = [['phone', 390, 844, 3], ['small', 360, 640, 2], ['tablet', 820, 1180, 2], ['laptop', 1280, 720, 1], ['wide', 1920, 1080, 1], ['landscape', 800, 360, 2]];
  for (const [name, w, h, dpr] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForFunction(() => window.__surf, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = window.__surf.game.state; s.coins = 500; s.skillPoints = 7; s.reputation = 20; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/resp-${name}-map.png` });
    await page.evaluate(() => window.__surf.ui.openZone('wave-1'));
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `screenshots/resp-${name}-sheet.png` });
    await page.evaluate(() => { window.__surf.ui.closeSheet(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__surf.ui.openSkills('wave'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshots/resp-${name}-skills.png` });
    console.log('saved', name);
    await ctx.close();
  }
};
