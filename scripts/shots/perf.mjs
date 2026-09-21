export default async ({ page, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const { scene, view } = window.__surf;
    const s = window.__surf.game.state;
    s.coins = 1e18; s.reputation = 1e9;
    for (const k of Object.keys(s.zones)) { s.zones[k].owned = true; s.zones[k].manager = true; s.zones[k].capacity = 8; }
    for (const k of Object.keys(s.sports)) s.sports[k] = true;
    view.jumpTo(500, 500, view.minPpu() * 1.6);
    await new Promise((r) => setTimeout(r, 1500));
    const game = scene.game;
    const measure = async (label) => {
      let total = 0, n = 0, t0 = 0;
      const pre = () => { t0 = performance.now(); };
      const post = () => { total += performance.now() - t0; n++; };
      game.events.on('prerender', pre); game.events.on('postrender', post);
      await new Promise((r) => setTimeout(r, 2500));
      game.events.off('prerender', pre); game.events.off('postrender', post);
      return `${label}: render call ${(total / n).toFixed(2)} ms over ${n} frames`;
    };
    const out = [];
    out.push(await measure('all zones visible'));
    // hide graphics objects to see the cost
    const gfx = scene.children.list.filter((o) => o.type === 'Graphics');
    out.push('graphics objects: ' + gfx.length);
    gfx.forEach((g) => g.setVisible(false));
    out.push(await measure('graphics hidden'));
    return out.join('\n');
  });
  console.log(r);
};
