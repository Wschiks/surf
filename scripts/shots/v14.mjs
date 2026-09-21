export default async ({ page, shot, base }) => {
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(base);
  await page.waitForTimeout(1800);
  await ev(() => { const s = window.__surf.game.state; s.skillPoints = 9; s.skills = { ...s.skills, 'wave:prices1': true, 'wave:speed1': true, 'beach:away1': true, 'sailing:prices1': true }; });
  await ev(() => window.__surf.ui.openSkills());
  await page.waitForTimeout(1300);
  await shot('01-wheel');
  await page.click('.sk-tab[data-tree=wave]', { force: true });
  await page.waitForTimeout(900);
  await ev(() => document.querySelector('[data-skill="wave:guests1"]').click());
  await page.waitForTimeout(400);
  await shot('02-wave');
  await page.click('.sk-tab[data-tree=sailing]', { force: true });
  await page.waitForTimeout(900);
  await shot('03-sailing');
};
