export default async ({ page, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await ev(() => window.__surf.ui.openBeach());
  await page.waitForTimeout(1200);
  console.log(await ev(() => { const e = document.elementFromPoint(300, 200); return e.tagName + '.' + e.className; }));
  console.log(await ev(() => document.querySelector('.sheet').className + ' ' + JSON.stringify(document.querySelector('.sheet').getBoundingClientRect().top)));
  await page.mouse.click(300, 200);
  await page.waitForTimeout(700);
  console.log(await ev(() => document.querySelector('.sheet').className));
};
