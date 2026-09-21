export default async ({ browser, base }) => {
  for (const [name, w, h, dpr] of [['small', 360, 640, 2], ['iphone', 390, 844, 3], ['tablet', 820, 1180, 2], ['desktop', 1280, 720, 1]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const s = window.__surf.game.state; s.coins = 300; window.__surf.ui.openZone('wave-1'); });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `screenshots/size-${name}.png` });
    console.log('saved', name);
    await ctx.close();
  }
};
