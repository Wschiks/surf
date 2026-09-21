export default async ({ page, shot, base }) => {
  await page.goto(base + '?unlock=all');
  await page.waitForTimeout(1500);
  for (const a of ['beach', 'wave', 'sea', 'ocean']) {
    await page.click(`.jump[data-area=${a}]`, { force: true });
    await page.waitForTimeout(2200);
    await shot('jump-' + a);
  }
};
