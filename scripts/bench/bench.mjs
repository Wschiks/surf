// Speed test: serves dist/ (the real production build), loads each benchmark save (make-saves.ts) on a phone-sized
// screen with the processor slowed 4x (like a mid-range phone), and measures start-up time, smoothness, CPU load and
// memory. Usage: npm run build && node scripts/bench/bench.mjs [label]   -> scripts/bench/results-<label>.json
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const label = process.argv[2] ?? 'run';
/** Optional experiment: cap the frame rate (e.g. 30) to see what it saves. */
const cap = Number(process.argv[3] ?? 0);
const port = 4181;
const SECONDS = 15;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}/?debug=1`;
const results = {};
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  for (const name of ['early', 'mid', 'late']) {
    const save = JSON.parse(readFileSync(new URL(`./save-${name}.json`, import.meta.url), 'utf8'));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    await ctx.addInitScript((s) => {
      s.savedAt = Date.now(); // no "welcome back" on load
      localStorage.setItem('surf-tycoon-save-v1', JSON.stringify(s));
    }, save);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Performance.enable');
    const t0 = Date.now();
    await page.goto(base);
    await page.waitForFunction(() => window.__surf && window.__surf.scene && document.querySelector('.zone-chip'), null, { timeout: 60000, polling: 50 });
    const startup = Date.now() - t0;
    // close whatever opened on start (a coach tip, a dialog)
    await page.evaluate(() => document.querySelectorAll('[data-close]').forEach((b) => b.click()));
    if (cap) await page.evaluate((c) => window.__surf.scene.game.loop.setFPSLimit(c), cap);
    await page.waitForTimeout(3000);
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const frames = await page.evaluate(
      (secs) =>
        new Promise((resolve) => {
          const t = [];
          const end = performance.now() + secs * 1000;
          const tick = (now) => {
            t.push(now);
            if (now < end) requestAnimationFrame(tick);
            else resolve(t);
          };
          requestAnimationFrame(tick);
        }),
      SECONDS,
    );
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    const dt = frames.slice(1).map((v, i) => v - frames[i]).sort((a, b) => a - b);
    const span = (frames[frames.length - 1] - frames[0]) / 1000;
    const objects = await page.evaluate(() => {
      const sc = window.__surf.scene;
      return { objects: sc.children.list.length, visible: sc.children.list.filter((o) => o.visible).length, textures: Object.keys(sc.textures.list).length };
    });
    results[name] = {
      startupMs: startup,
      fps: +(dt.length / span).toFixed(1),
      frameP95Ms: +dt[Math.floor(dt.length * 0.95)].toFixed(1),
      frameMaxMs: +dt[dt.length - 1].toFixed(1),
      slowFramesPct: +((dt.filter((d) => d > 33.4).length / dt.length) * 100).toFixed(1),
      cpuBusyPct: +(((m1.TaskDuration - m0.TaskDuration) / span) * 100).toFixed(1),
      scriptPct: +(((m1.ScriptDuration - m0.ScriptDuration) / span) * 100).toFixed(1),
      heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1),
      ...objects,
    };
    console.log(name, results[name]);
    await ctx.close();
  }
  await browser.close();
  writeFileSync(new URL(`./results-${label}.json`, import.meta.url), JSON.stringify(results, null, 2));
} finally {
  server.kill();
}
