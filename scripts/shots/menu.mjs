export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await page.click('[data-ref=gear]', { force: true });
  await page.waitForTimeout(500);
  await shot('01-main');
  await ev(() => document.querySelector('.modal.menu').scrollTo(0, 900));
  await page.waitForTimeout(300);
  await shot('02-main-bottom');
  await ev(() => document.querySelector('[data-sound]').click());
  await page.waitForTimeout(300);
  console.log('sound muted after toggle:', await ev(() => localStorage.getItem('surf-tycoon-muted')));
  await ev(() => document.querySelector('[data-sound]').click());
  for (const pg of ['terms', 'privacy', 'how', 'about']) {
    await ev(() => document.querySelector('.modal.menu').scrollTo(0, 0));
    await ev((pg) => document.querySelector(`[data-go="${pg}"]`).click(), pg);
    await page.waitForTimeout(350);
    await shot('page-' + pg);
    await ev(() => document.querySelector('[data-back]').click());
    await page.waitForTimeout(250);
  }
};
