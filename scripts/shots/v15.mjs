export default async ({ page, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await ev(() => window.__surf.ui.openZone('wave-1'));
  await page.waitForTimeout(1200);
  console.log('open:', await ev(() => !!document.querySelector('.sheet.open')));
  await page.mouse.click(200, 120);
  await page.waitForTimeout(700);
  console.log('after tap above the sheet:', await ev(() => !!document.querySelector('.sheet.open')));
  await ev(() => window.__surf.ui.openZone('wave-1'));
  await page.waitForTimeout(1000);
  // tap on the map with a touch
  await page.touchscreen.tap(60, 250);
  await page.waitForTimeout(700);
  console.log('after touch tap:', await ev(() => !!document.querySelector('.sheet.open')));
  await ev(() => window.__surf.ui.openBeach());
  await page.waitForTimeout(1000);
  await page.mouse.click(300, 200);
  await page.waitForTimeout(700);
  console.log('beach sheet after tap:', await ev(() => !!document.querySelector('.sheet.open')));
};
