export default async ({ page, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const { scene, view } = window.__surf;
    view.jumpTo(420, 300, 250);
    return new Promise((res) => setTimeout(() => {
      const cam = scene.cameras.main;
      const p = cam.getWorldPoint(80, 150);
      const q = view.screenToWorld(80, 150);
      res({ phaser: [p.x, p.y], mine: [q.x, q.y] });
    }, 300));
  });
  console.log(JSON.stringify(r));
};
