// Where the time goes: a CPU profile of a few seconds on one benchmark save (default "late"), summed per function.
// Usage: npm run build && node scripts/bench/profile.mjs [early|mid|late]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const name = process.argv[2] ?? 'late';
/** Optional: a running dev server's address (readable function names), e.g. http://127.0.0.1:5174/ */
const devBase = process.argv[3];
const port = 4182;
const server = devBase ? { kill() {} } : spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const base = devBase ? `${devBase}?debug=1` : `http://localhost:${port}/?debug=1`;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const save = JSON.parse(readFileSync(new URL(`./save-${name}.json`, import.meta.url), 'utf8'));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => {
    s.savedAt = Date.now();
    localStorage.setItem('surf-tycoon-save-v1', JSON.stringify(s));
  }, save);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(base);
  await page.waitForFunction(() => window.__surf && document.querySelector('.zone-chip'), null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(6000);
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dts = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const key = `${n.callFrame.functionName || '(anon)'}  ${(n.callFrame.url.split('/').pop() || '').split('?')[0].slice(0, 34)}:${n.callFrame.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + (dts[i] ?? 0));
  });
  // total time per function including what it calls
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const total = new Map();
  profile.samples.forEach((id, i) => {
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const n = byId.get(cur);
      const key = `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url.split('/').pop() || '').split('?')[0].slice(0, 24)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total.set(key, (total.get(key) ?? 0) + (dts[i] ?? 0));
    }
  });
  const all = [...self.values()].reduce((a, b) => a + b, 0);
  console.log(`\nSELF time (top 25), ${name}:`);
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(((v / all) * 100).toFixed(1).padStart(5) + '%  ' + k);
  console.log(`\nTOTAL time incl. callees (top 30):`);
  for (const [k, v] of [...total].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(((v / all) * 100).toFixed(1).padStart(5) + '%  ' + k);
  await browser.close();
} finally {
  server.kill();
}
