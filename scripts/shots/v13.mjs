export default async ({ browser, base }) => {
  for (const [name, w, h, dpr] of [['phone', 390, 844, 2], ['small', 360, 640, 2], ['wide', 1280, 720, 1], ['land', 800, 360, 2]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForFunction(() => window.__surf, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = window.__surf.game.state; s.coins = 500; s.skillPoints = 3; });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `screenshots/btn-${name}-map.png` });
    await page.evaluate(() => window.__surf.ui.openZone('wave-1'));
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `screenshots/btn-${name}-sheet.png` });
    await ctx.close();
  }
};
