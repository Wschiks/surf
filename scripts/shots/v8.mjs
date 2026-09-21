export default async ({ page, shot, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1800);
  await page.click('[data-ref=expand]', { force: true });
  await page.waitForTimeout(900);
  console.log('button disabled:', await page.evaluate(() => document.querySelector('[data-xbtn]').disabled), '| text:', await page.evaluate(() => document.querySelector('[data-xbtn]').textContent.trim()));
  await page.evaluate(() => document.querySelector('[data-xbtn]').click());
  await page.waitForTimeout(600);
  console.log('wave started:', await page.evaluate(() => !!document.querySelector('.tsunami')), 'expansions:', await page.evaluate(() => window.__surf.game.state.expansions));
  await shot('expand-locked');
};
