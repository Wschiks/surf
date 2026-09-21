export default async ({ page, shot, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1800);
  await page.click('[data-ref=expand]', { force: true });
  await page.waitForTimeout(700);
  await page.click('[data-xbtn]', { force: true });
  for (const [n, ms] of [['a', 350], ['b', 250], ['c', 250], ['d', 300], ['e', 700]]) { await page.waitForTimeout(ms); await shot('wave-' + n); }
};
