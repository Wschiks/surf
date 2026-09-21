// Draws the app icon and the splash screen in code and writes every size the stores and the native projects need.
// Usage: node scripts/make-icons.mjs   (then it converts the iOS/web icons to opaque PNGs with Python + Pillow)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SEA_TOP = '#8fe6f2';
const SEA_MID = '#1b8fc4';
const SEA_BOTTOM = '#0b4f86';

/** The picture: a sun, a big white wave and a coral surfboard. `glyphOnly` draws just the picture (for Android adaptive icons). */
function art(size, { glyphOnly = false, scale = 1, round = false } = {}) {
  const bg = glyphOnly
    ? ''
    : `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SEA_TOP}"/><stop offset=".55" stop-color="${SEA_MID}"/><stop offset="1" stop-color="${SEA_BOTTOM}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024" ${round ? 'style="border-radius:50%;overflow:hidden"' : ''}>
    ${bg}
    <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
      ${glyphOnly ? '<defs><clipPath id="c"><circle cx="512" cy="512" r="470"/></clipPath><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + SEA_TOP + '"/><stop offset=".55" stop-color="' + SEA_MID + '"/><stop offset="1" stop-color="' + SEA_BOTTOM + '"/></linearGradient></defs><circle cx="512" cy="512" r="470" fill="url(#g2)"/>' : ''}
      <g ${glyphOnly ? 'clip-path="url(#c)"' : ''}>
        <circle cx="716" cy="300" r="118" fill="#ffc233"/>
        <circle cx="716" cy="300" r="118" fill="none" stroke="#ffe27a" stroke-width="14" opacity=".6"/>
        <path d="M-20 700 C230 470 470 430 610 560 C700 645 860 640 1044 520 L1044 1044 L-20 1044 Z" fill="#ffffff"/>
        <path d="M-20 790 C240 590 450 560 590 660 C690 730 860 725 1044 620 L1044 1044 L-20 1044 Z" fill="#7fd4ea"/>
        <path d="M-20 880 C240 700 440 690 580 770 C690 830 860 820 1044 730 L1044 1044 L-20 1044 Z" fill="#2fa4d8"/>
        <g transform="rotate(-32 420 470)">
          <ellipse cx="420" cy="470" rx="62" ry="250" fill="#ff6a3d"/>
          <path d="M420 240 L420 700" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity=".85"/>
        </g>
      </g>
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
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const legacy = Math.round(48 * k);
  const fg = Math.round(108 * k);
  await png(`${res}/mipmap-${d}/ic_launcher.png`, legacy, legacy, art(legacy));
  await png(`${res}/mipmap-${d}/ic_launcher_round.png`, legacy, legacy, art(legacy, { round: true }), true);
  // adaptive icon foreground: the picture inside the safe zone (66%) on a transparent square
  await png(`${res}/mipmap-${d}/ic_launcher_foreground.png`, fg, fg, art(fg, { glyphOnly: true, scale: 0.68 }), true);
}
// Android splash pictures keep the sizes of the files that are already there
for (const dir of fs.readdirSync(out(res)).filter((n) => n.startsWith('drawable') && fs.existsSync(out(`${res}/${n}/splash.png`)))) {
  const f = `${res}/${dir}/splash.png`;
  const [w, h] = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out(f)]).toString().match(/\d+/g).slice(-2).map(Number);
  await png(f, w, h, splash(w, h));
}
// iOS
await png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, art(1024));
for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await png(`ios/App/App/Assets.xcassets/Splash.imageset/${n}`, 2732, 2732, splash(2732, 2732));
// web
await png('public/icon-512.png', 512, 512, art(512));
await png('public/icon-192.png', 192, 192, art(192));
await png('public/apple-touch-icon.png', 180, 180, art(180));
await png('store/icon-1024.png', 1024, 1024, art(1024));
await browser.close();

// the App Store refuses icons with an alpha channel: write them as plain RGB
execFileSync('python3', ['-c', `
from PIL import Image
for f in ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png','public/apple-touch-icon.png','public/icon-512.png','public/icon-192.png','store/icon-1024.png']:
    im = Image.open(f).convert('RGB'); im.save(f)
print('opaque icons written')
`], { stdio: 'inherit' });
console.log('icons and splash screens written');
