// Writes every splash-screen size the native projects need (drawn in code), and every app-icon size (from the picture
// at store/art/icon-source.png; see scripts/render-app-icon.py). Usage: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SEA_TOP = '#8fe6f2';
const SEA_MID = '#1b8fc4';
const SEA_BOTTOM = '#0b4f86';

/** The small picture inside the splash screen: a sun, a big white wave and a coral surfboard. The real app icon is a photo now (see render-app-icon.py); this stays code-drawn, only the splash uses it. */
function art(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SEA_TOP}"/><stop offset=".55" stop-color="${SEA_MID}"/><stop offset="1" stop-color="${SEA_BOTTOM}"/></linearGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    <circle cx="716" cy="300" r="118" fill="#ffc233"/>
    <circle cx="716" cy="300" r="118" fill="none" stroke="#ffe27a" stroke-width="14" opacity=".6"/>
    <path d="M-20 700 C230 470 470 430 610 560 C700 645 860 640 1044 520 L1044 1044 L-20 1044 Z" fill="#ffffff"/>
    <path d="M-20 790 C240 590 450 560 590 660 C690 730 860 725 1044 620 L1044 1044 L-20 1044 Z" fill="#7fd4ea"/>
    <path d="M-20 880 C240 700 440 690 580 770 C690 830 860 820 1044 730 L1044 1044 L-20 1044 Z" fill="#2fa4d8"/>
    <g transform="rotate(-32 420 470)">
      <ellipse cx="420" cy="470" rx="62" ry="250" fill="#ff6a3d"/>
      <path d="M420 240 L420 700" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity=".85"/>
    </g>
  </svg>`;
}

function splash(w, h) {
  const s = Math.min(w, h) * 0.34;
  return `<div style="width:${w}px;height:${h}px;background:linear-gradient(#8fe6f2,#1b8fc4 60%,#0b4f86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${s * 0.12}px;font-family:ui-rounded,'SF Pro Rounded',system-ui,sans-serif">
    <div style="border-radius:${s * 0.22}px;overflow:hidden;box-shadow:0 ${s * 0.04}px 0 rgba(6,32,51,.35)">${art(s)}</div>
    <div style="color:#fff;font-weight:800;font-size:${s * 0.2}px;letter-spacing:.02em;text-shadow:0 ${s * 0.015}px 0 rgba(6,32,51,.45)">Surf Tycoon</div>
  </div>`;
}

const out = (p) => path.join(process.cwd(), p);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(file, w, h, html, transparent = false) {
  fs.mkdirSync(path.dirname(out(file)), { recursive: true });
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#000'};overflow:hidden">${html}</body></html>`);
  await page.screenshot({ path: out(file), omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}

const res = 'android/app/src/main/res';
// Android splash pictures keep the sizes of the files that are already there
for (const dir of fs.readdirSync(out(res)).filter((n) => n.startsWith('drawable') && fs.existsSync(out(`${res}/${n}/splash.png`)))) {
  const f = `${res}/${dir}/splash.png`;
  const [w, h] = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out(f)]).toString().match(/\d+/g).slice(-2).map(Number);
  await png(f, w, h, splash(w, h));
}
// iOS
for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await png(`ios/App/App/Assets.xcassets/Splash.imageset/${n}`, 2732, 2732, splash(2732, 2732));
await browser.close();

// the app icon is a real picture, not drawn in code: see scripts/render-app-icon.py and store/art/icon-source.png
execFileSync('python3', ['scripts/render-app-icon.py'], { stdio: 'inherit' });
console.log('icons and splash screens written');
