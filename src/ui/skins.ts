import { BOX_ODDS, BOXES, RARITIES, RARITY_LOOK, SKINS, TIERS, skinsOfZone, type BoxKind, type SkinDef } from '../config/skins';
import { SPORTS, ZONES } from '../config/sports';
import type { Game } from '../core/game';
import { buyCoinBox, buyGemBoxes, coinBoxPrice, collectionCount, openBox, skinProgress, tierBoost, wearSkin, type BoxResult } from '../core/skins';
import { drawSkin, drawSkinHullSide, isRide, skinShape, type SkinShape } from '../scene/rig/skinArt';
import { fmt } from './format';
import { icon, tile } from './icons';
import { playOpening } from './boxOpen';
import { sound } from './sound';

export interface SkinContext {
  game: Game;
  close: () => void;
  toast: (text: string) => void;
  confetti: () => void;
  refreshTop: () => void;
}

let chestIds = 0;

/** y of the chest's front top edge at x (the front leans back toward the right). */
const frontTop = (x: number) => 44 + ((x - 12) * 6) / 54;
/** y of the lid's front bottom edge at x. */
const lidEdge = (x: number) => 45 + ((x - 9) * 7) / 60;

/** A barnacle: a pale cone with a dark mouth. */
function barnacle(x: number, y: number, r: number): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#e6dbc3" stroke="#7d6c52" stroke-width="0.5"/><circle cx="${x}" cy="${y - r * 0.1}" r="${r * 0.45}" fill="#5e4e3a"/><path d="M${x - r * 0.8},${y + r * 0.3} L${x - r * 0.35},${y} M${x + r * 0.8},${y + r * 0.3} L${x + r * 0.35},${y}" stroke="#a8977a" stroke-width="0.4"/>`;
}

/**
 * One chest in 3/4 view: a treasure chest from an old shipwreck that lay on the seabed for years. Weathered planks,
 * rusty iron corners and bands with rust stains, barnacles, sea moss and kelp, a verdigris lock, a shell, a starfish,
 * a bit of coral; inside (seen when the lid flies off) a glowing heap of gold coins, pearls and a gem. The golden box is
 * the captain's chest: dark wood with gold bands, gems and pearls, still with some seaweed. The lid is its own group.
 */
function boxShape(kind: BoxKind): string {
  const g = kind === 'golden';
  const id = `ch${++chestIds}`;
  const ink = '#2a170b';
  const wood = g ? ['#7a4a28', '#6b4022', '#83532e'] : ['#a8723f', '#99683a', '#b07c4a'];
  const sideWood = g ? ['#5a3219', '#4f2c15'] : ['#7d5230', '#714a2a'];
  const band = g ? `url(#${id}gb)` : `url(#${id}ib)`;
  const bandEdge = g ? '#a8720a' : '#1f1c1a';
  const rivet = g ? '#fff2b0' : '#6a645c';
  const defs = `<defs>
    <linearGradient id="${id}ib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e6861"/><stop offset="0.5" stop-color="#56514b"/><stop offset="1" stop-color="#433f3a"/></linearGradient>
    <linearGradient id="${id}gb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff0a0"/><stop offset="0.5" stop-color="#f2c043"/><stop offset="1" stop-color="#c88a12"/></linearGradient>
    <linearGradient id="${id}lt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g ? '#93613a' : '#c08d58'}"/><stop offset="1" stop-color="${g ? '#74482a' : '#a37344'}"/></linearGradient>
    <radialGradient id="${id}gl" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stop-color="#fff6c8"/><stop offset="0.6" stop-color="#ffcf4a"/><stop offset="1" stop-color="#d48f10"/></radialGradient>
  </defs>`;

  // the treasure inside (the lid covers it until it flies off)
  const coins = [
    [20, 43.5, 3.2],
    [27, 41.5, 3.4],
    [34, 43, 3.2],
    [41, 40.5, 3.6],
    [48, 43.5, 3.2],
    [55, 41.5, 3.4],
    [62, 44.5, 3],
    [70, 42, 3],
    [78, 41, 2.8],
    [31, 39, 3],
    [45, 37.5, 3.2],
    [59, 38.5, 3],
    [38, 36.5, 2.8],
  ]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.62}" fill="url(#${id}gl)" stroke="#a8700a" stroke-width="0.5"/>`)
    .join('');
  const inside = `
    <polygon points="12,44 66,50 90,42 36,37" fill="#2a170b"/>
    <path d="M14,45 Q24,36 40,34 Q58,33 74,37 Q84,39 88,43 L66,50 Z" fill="#c98a12"/>
    ${coins}
    <circle cx="52" cy="37" r="2.2" fill="#ffffff" stroke="#c9bfa3" stroke-width="0.4"/><circle cx="25" cy="38.5" r="1.8" fill="#ffffff" stroke="#c9bfa3" stroke-width="0.4"/>
    <path d="M66,37.5 l2.6,-2.6 l2.6,2.6 l-2.6,3 Z" fill="#e0405c" stroke="#7a1428" stroke-width="0.5"/>`;

  // the front: three planks of different wood, seams, grain, nails
  const plank = (t0: number, t1: number, col: string) => `<polygon points="12,${44 + 28 * t0} 66,${50 + 28 * t0} 66,${50 + 28 * t1} 12,${44 + 28 * t1}" fill="${col}"/>`;
  const sidePlank = (t0: number, t1: number, col: string) => `<polygon points="66,${50 + 28 * t0} 90,${42 + 28 * t0} 90,${42 + 28 * t1} 66,${50 + 28 * t1}" fill="${col}"/>`;
  const seams = [1 / 3, 2 / 3].map((t) => `<path d="M12,${44 + 28 * t} L66,${50 + 28 * t} L90,${42 + 28 * t}" fill="none" stroke="${ink}" stroke-width="0.9" opacity="0.6"/>`).join('');
  const grain = [
    'M16,48.5 C26,49 34,51 46,51.5',
    'M30,57.5 C40,58.5 50,59 62,60',
    'M14,63 C22,63.5 30,65 40,65.2',
    'M38,69.5 C46,70.5 54,71.5 63,73',
    'M70,52 C76,49.5 82,48 87,46',
    'M69,66 C75,63 82,61 88,59',
  ]
    .map((d) => `<path d="${d}" stroke="${ink}" stroke-width="0.45" fill="none" opacity="0.35"/>`)
    .join('');
  // iron (or gold) bands with rivets and rust running down
  const vband = (x: number) => {
    const y0 = frontTop(x);
    const rust = g ? '' : `<path d="M${x - 1},${y0 + 7} q0.6,4 -0.3,7 M${x + 1.2},${y0 + 19} q0.5,3 -0.2,6" stroke="#9b4a24" stroke-width="1.1" opacity="0.6" fill="none"/>`;
    return `<path d="M${x - 3.2},${y0 - 0.4} L${x + 3.2},${y0 + 0.3} L${x + 3.2},${y0 + 28.3} L${x - 3.2},${y0 + 27.6} Z" fill="${band}" stroke="${bandEdge}" stroke-width="0.8"/>
      ${[4, 13, 22].map((dy) => `<circle cx="${x}" cy="${y0 + dy}" r="1.05" fill="${rivet}" stroke="${bandEdge}" stroke-width="0.4"/>`).join('')}${rust}`;
  };
  // small iron caps on the corners
  const cap = (pts: string) => `<path d="${pts}" fill="${band}" stroke="${bandEdge}" stroke-width="0.7"/>`;
  const corners = `
    ${cap('M12,44 L18,44.7 L12,50.5 Z')}${cap('M12,72 L18,72.6 L12,66.5 Z')}
    ${cap('M66,50 L60.5,49.4 L66,55.5 Z')}${cap('M66,78 L60.5,77.4 L66,71.5 Z')}
    ${cap('M66,50 L71.5,48.2 L66,55.5 Z')}${cap('M66,78 L71.5,76.2 L66,71.5 Z')}
    ${cap('M90,42 L84.5,43.8 L90,48 Z')}${cap('M90,70 L84.5,71.8 L90,64.5 Z')}`;
  // the lock: verdigris copper (gold on the golden chest)
  const lock = `
    <path d="M35.5,49 L44,50 L44,58 L39.7,62 L35.5,57 Z" fill="${g ? '#ffe082' : '#5e9a86'}" stroke="${ink}" stroke-width="1"/>
    <path d="M37,50.5 L42.6,51.2" stroke="${g ? '#fff6d0' : '#8fc4ae'}" stroke-width="0.8"/>
    <circle cx="39.8" cy="54.2" r="1.3" fill="${ink}"/><path d="M39.8,55 L39.8,57.6" stroke="${ink}" stroke-width="1.2" stroke-linecap="round"/>`;
  // the sea's marks: moss, barnacles, a shell, a starfish, coral (the golden chest: gems and pearls instead of most of it)
  const moss = `
    <path d="M12,67 C15,64.5 19,67.5 23,66 C26,65 28,68.5 32,68.4 L33,73.8 L12,72 Z" fill="#6f9e58" opacity="0.6"/>
    <path d="M78,72 C81,69 85,70 88,66.5 L90,66 L90,70 L76,74.8 Z" fill="#6f9e58" opacity="0.55"/>`;
  const sea = g
    ? `${moss.replace(/0\.5[05]/g, '0.3')}
       <circle cx="22" cy="${frontTop(22) + 9}" r="1.7" fill="#3fd0c9" stroke="${ink}" stroke-width="0.5"/>
       <circle cx="56" cy="${frontTop(56) + 9}" r="1.7" fill="#e0405c" stroke="${ink}" stroke-width="0.5"/>
       <circle cx="78" cy="58" r="2.4" fill="#3fd0c9" stroke="${ink}" stroke-width="0.6"/><circle cx="78" cy="58" r="0.9" fill="#d9fffb"/>
       ${barnacle(15.5, 70.5, 1.5)}${barnacle(18.5, 71.5, 1.1)}`
    : `${moss}
       ${barnacle(15, 69.5, 1.8)}${barnacle(18.5, 71, 1.3)}${barnacle(14, 65.5, 1.1)}${barnacle(24, 70.5, 1)}${barnacle(86, 66, 1.4)}${barnacle(83, 68.5, 1)}${barnacle(47, 52.5, 1)}
       <path d="M27,76.5 l-3.4,-4.4 q3.4,-2.6 6.8,0 Z" fill="#f2a4a4" stroke="${ink}" stroke-width="0.6" stroke-linejoin="round"/>
       <path d="M27,76.5 l-1.6,-4.6 M27,76.5 l0,-5 M27,76.5 l1.6,-4.6" stroke="#c96a6a" stroke-width="0.4"/>
       <path d="M77,59 l1.4,-3.8 l1.4,3.8 l4,0.2 l-3.1,2.4 l1.1,3.8 l-3.4,-2.2 l-3.4,2.2 l1.1,-3.8 l-3.1,-2.4 Z" fill="#ff8a50" stroke="${ink}" stroke-width="0.7" stroke-linejoin="round"/>
       <path d="M60,77.5 q-1,-5 1.5,-8 M61.2,72 q2.4,-1.4 3.2,-4 M60.6,74.5 q-2.4,-1 -3.4,-3.4" stroke="#e8556a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  // years under water: knots, a crack, rust patches on the iron
  const wear = `
    <ellipse cx="33" cy="61.5" rx="1.6" ry="0.9" fill="${ink}" opacity="0.55"/><ellipse cx="47" cy="71.8" rx="1.3" ry="0.8" fill="${ink}" opacity="0.5"/>
    <ellipse cx="79" cy="53" rx="1.2" ry="0.8" fill="${ink}" opacity="0.5"/>
    <path d="M40,55 l3,0.6 l1.6,-0.8 l3,1 l2,-0.5" fill="none" stroke="${ink}" stroke-width="0.6" opacity="0.55"/>
    <path d="M72,61 l2.5,-1 l1.4,0.6 l3,-1.2" fill="none" stroke="${ink}" stroke-width="0.6" opacity="0.5"/>`;
  const rustPatches = g
    ? ''
    : [
        [22, 49],
        [24.5, 66],
        [54, 58],
        [56.5, 71],
        [62.5, 75.5],
        [88, 46],
      ]
        .map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="${1.6 + (i % 3) * 0.4}" ry="${1.1 + (i % 2) * 0.5}" fill="#a0521f" opacity="0.65"/>`)
        .join('');
  const body = `
    ${inside}
    ${plank(0, 1 / 3, wood[0])}${plank(1 / 3, 2 / 3, wood[1])}${plank(2 / 3, 1, wood[2])}
    ${sidePlank(0, 0.5, sideWood[0])}${sidePlank(0.5, 1, sideWood[1])}
    ${seams}${grain}${wear}
    ${sea}
    ${vband(23)}${vband(55)}
    ${corners}${rustPatches}
    ${lock}
    <path d="M12,44 L66,50 L90,42 L90,70 L66,78 L12,72 Z M66,50 L66,78" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/>`;

  // the domed lid: top, front face, end cap; planks, bands over the dome, moss, kelp draped over the edge
  const top = 'M9,34 C19,21 60,27 69,41 C75,27 88,24 93,33 C70,8 14,16 9,34 Z';
  const domeBand = (x: number) => {
    const y = 34 + ((x - 9) / 60) * 7 - Math.sin(((x - 9) / 60) * Math.PI) * 13;
    return `<path d="M${x},${lidEdge(x)} L${x},${y} L${x + 12},${y - 22}" fill="none" stroke="${band}" stroke-width="6.4" clip-path="url(#${id}t)"/>
      <path d="M${x - 3.2},${lidEdge(x) - 0.4} L${x - 3.2},${y + 1} M${x + 3.2},${lidEdge(x) + 0.4} L${x + 3.2},${y - 1}" stroke="${bandEdge}" stroke-width="0.7" clip-path="url(#${id}t)"/>
      <circle cx="${x}" cy="${lidEdge(x) - 4}" r="1" fill="${rivet}"/><circle cx="${x + 1}" cy="${y + 2}" r="1" fill="${rivet}"/>`;
  };
  const lidSea = g
    ? [14, 21, 28, 35, 42, 49, 56, 63].map((x) => `<circle cx="${x}" cy="${lidEdge(x) - 0.4}" r="1.5" fill="#ffffff" stroke="#c9bfa3" stroke-width="0.4"/>`).join('') +
      `<path d="M33,24 C30,30 35,33 32,38" fill="none" stroke="#3f8f3a" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>`
    : `<path d="M18,25 C26,19 38,18 46,21 C40,24 30,23 24,28 Z" fill="#4f7d4a" opacity="0.6"/>
       <path d="M58,22 C66,22 76,25 82,29 C74,28 66,27 60,26 Z" fill="#3f6a3e" opacity="0.55"/>
       ${barnacle(40, 22, 1.3)}${barnacle(43.5, 21.5, 1)}${barnacle(80, 30, 1.1)}
       <path d="M27,22 C24,30 31,34 27,41 C25,45 29,48 26,53 C25,55 26,57 27,58" fill="none" stroke="#2f6b3a" stroke-width="3" stroke-linecap="round"/>
       <path d="M26,46 q-4,0 -5,3 q3,1 5,-1.5 M28,36 q4,-1 6,1.5 q-3,1.6 -5.5,0 M26.5,53 q3.5,0.5 4.5,3" fill="#3f8f3a" stroke="#2f6b3a" stroke-width="0.5"/>
       <path d="M35,20 C38,27 33,31 36,37 C37.5,40 35.5,43 37,45" fill="none" stroke="#4f9a4a" stroke-width="2.1" stroke-linecap="round"/>
       <path d="M76,26 C79,31 75,35 78,40" fill="none" stroke="#2f6b3a" stroke-width="2" stroke-linecap="round"/>`;
  const lid = `<g class="lid">
    <clipPath id="${id}t"><path d="${top} M9,45 L69,52 L69,41 C60,27 19,21 9,34 Z M69,52 L93,43 L93,33 C88,24 75,27 69,41 Z"/></clipPath>
    <path d="${top}" fill="url(#${id}lt)"/>
    <path d="M17,27 C29,17 62,17 80,28 M12,31.5 C25,20.5 60,22 75,34" fill="none" stroke="${ink}" stroke-width="0.8" opacity="0.45"/>
    <path d="M9,45 L69,52 L69,41 C60,27 19,21 9,34 Z" fill="${wood[2]}"/>
    <path d="M10,40 C22,30 55,33 68,46.5" fill="none" stroke="${ink}" stroke-width="0.8" opacity="0.5"/>
    <path d="M69,52 L93,43 L93,33 C88,24 75,27 69,41 Z" fill="${sideWood[0]}"/>
    <path d="M71,46 C78,40 86,38 92,38" fill="none" stroke="${ink}" stroke-width="0.7" opacity="0.45"/>
    <path d="M9,${45 - 3.4} L69,${52 - 3.4} L93,${43 - 3.4}" fill="none" stroke="${band}" stroke-width="2.4"/>
    ${domeBand(23)}${domeBand(55)}
    <path d="M44,40.5 l2.4,0.4 l1.2,-0.9 l2.6,0.8" fill="none" stroke="${ink}" stroke-width="0.6" opacity="0.5"/>
    ${g ? '' : '<ellipse cx="24" cy="38.6" rx="1.7" ry="1.1" fill="#a0521f" opacity="0.6"/><ellipse cx="56" cy="43" rx="1.5" ry="1" fill="#a0521f" opacity="0.6"/>'}
    ${lidSea}
    <path d="M9,45 L69,52 L93,43 M69,52 L69,41 M9,34 C19,21 60,27 69,41 C75,27 88,24 93,33" fill="none" stroke="${ink}" stroke-width="1.8"/>
    <path d="M9,45 L9,34 C14,16 70,8 93,33 L93,43 L69,52 Z" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/>
  </g>`;
  return defs + body + lid;
}

/** A box picture: `three` stacks three boxes (the gem offer). */
export function boxArt(kind: BoxKind, extra = ''): string {
  const three = extra.includes('three');
  const one = boxShape(kind);
  const inner = three ? `<g transform="translate(22,-6) scale(0.62)">${one}</g><g transform="translate(-2,22) scale(0.62)">${one}</g><g transform="translate(40,24) scale(0.62)">${one}</g>` : one;
  return `<i class="box ${kind} ${extra}"><svg viewBox="0 0 100 84" aria-hidden="true">${inner}</svg></i>`;
}

/** The puzzle of a tier: 4 pieces (2x2) to unlock, 4 (2x2) for Bronze, 9 (3x3) for Silver. */
function puzzleGrid(from: number, to: number | null): number {
  return to === null ? 0 : to - from === 9 ? 3 : 2;
}

/** A sailing sail seen from above is a thin line: its picture shows the sail from the side instead. */
const SAIL_SIDE = { path: 'M -40 -100 C -34 -40 -34 40 -40 96 L 66 96 C 54 26 4 -52 -40 -100 Z', dy: 0, x0: -40, y0: -100, x1: 66, y1: 96 };
/** The leaf sail seen from the side: a leaf hanging from the mast, its tip at the top. */
const LEAF_SIDE = { path: 'M -38 -104 C 6 -70 72 -8 62 46 C 54 86 14 98 -38 94 C -46 40 -46 -40 -38 -104 Z', dy: 0, x0: -44, y0: -104, x1: 66, y1: 98 };
function pictureShape(skin: SkinDef) {
  if (skin.sport === 'sailing') return skin.pattern === 'leafSail' ? LEAF_SIDE : SAIL_SIDE;
  return skinShape(skin.sport, skin.level);
}

/** The picture of a skin: its gear, and for a set with its own board (the 1990 set) the board under the sail, mast on its mast foot. */
function drawPicture(c: CanvasRenderingContext2D, skin: SkinDef, shape: SkinShape) {
  // a skin's own board never shows in the collection (the author's choice), only a sailing skin's boat under its sail
  if (skin.board && skin.sport === 'sailing') drawSkinHullSide(c, skin);
  drawSkin(c, skin, shape);
}

/** Where the gear really sits in its own coordinates (measured once per shape from the drawn picture). */
const gearBoxes = new Map<string, { cx: number; cy: number; w: number; h: number }>();
function gearBox(skin: SkinDef) {
  const key = `${skin.sport}-${skin.level}${skin.board ? `-board-${skin.id}` : ''}${isRide(skin) ? `-${skin.id}` : ''}`;
  let box = gearBoxes.get(key);
  if (box) return box;
  const shape = pictureShape(skin);
  const N = 256;
  const span = Math.max(shape.x1 - shape.x0, shape.y1 - shape.y0) * 2.4;
  const k = N / span;
  const mx = (shape.x0 + shape.x1) / 2;
  const my = (shape.y0 + shape.y1) / 2;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.translate(N / 2, N / 2);
  g.scale(k, k);
  g.translate(-mx, -my);
  drawPicture(g, skin, shape);
  const data = g.getImageData(0, 0, N, N).data;
  let x0 = N,
    y0 = N,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (data[(y * N + x) * 4 + 3] > 20) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < x0) box = { cx: mx, cy: my, w: shape.x1 - shape.x0, h: shape.y1 - shape.y0 };
  else box = { cx: mx + ((x0 + x1) / 2 - N / 2) / k, cy: my + ((y0 + y1) / 2 - N / 2) / k, w: (x1 - x0) / k, h: (y1 - y0) / k };
  gearBoxes.set(key, box);
  return box;
}

/**
 * A skin as a puzzle (like the crops of Idle Farming Empire): a square picture of the gear in its skin, cut in a 2x2 or
 * 3x3 grid for the tier it is working toward. Collected pieces show the picture, missing ones are dark (a skin that is
 * already unlocked shows them dimmed). `glow` marks the piece that just came in.
 */
/** Just the gear of a skin on a clear background, px by px (the big item of the box opening's hero moment). */
export function skinGear(skin: SkinDef, px: number): HTMLCanvasElement {
  const shape = pictureShape(skin);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  const box = gearBox(skin);
  const tilt = box.h > box.w * 1.8 && skin.sport !== 'sailing' ? 0.7 : 0;
  const fw = box.w * Math.cos(tilt) + box.h * Math.sin(tilt);
  const fh = box.h * Math.cos(tilt) + box.w * Math.sin(tilt);
  const k = (px * 0.86) / Math.max(fw, fh);
  g.translate(px / 2, px / 2);
  g.rotate(tilt);
  g.scale(k, k);
  g.translate(-box.cx, -box.cy);
  g.shadowColor = 'rgba(0,20,40,0.45)';
  g.shadowBlur = px * 0.05;
  g.shadowOffsetY = px * 0.03;
  drawPicture(g, skin, shape);
  return c;
}

/** The square picture of a skin, px by px: sea behind, the gear in its skin on top (boards on the diagonal). */
export function skinPicture(skin: SkinDef, px: number): HTMLCanvasElement {
  const shape = pictureShape(skin);
  const pic = document.createElement('canvas');
  pic.width = pic.height = px;
  const pc = pic.getContext('2d')!;
  const sea = pc.createLinearGradient(0, 0, 0, px);
  sea.addColorStop(0, '#9fe3f2');
  sea.addColorStop(1, '#3fb3d6');
  pc.fillStyle = sea;
  pc.fillRect(0, 0, px, px);
  pc.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 3; i++) pc.fillRect(0, px * (0.22 + i * 0.3), px, Math.max(1, px * 0.025));
  const box = gearBox(skin);
  // long thin gear (a board) lies on the diagonal, so it fills the picture
  const tilt = box.h > box.w * 1.8 && skin.sport !== 'sailing' ? 0.7 : 0;
  const fw = box.w * Math.cos(tilt) + box.h * Math.sin(tilt);
  const fh = box.h * Math.cos(tilt) + box.w * Math.sin(tilt);
  const k = (px * 0.8) / Math.max(fw, fh);
  // the gear is drawn on its own first, then dropped onto the sea with one shadow (a shadow per stroke would smudge the pattern)
  const gear = document.createElement('canvas');
  gear.width = gear.height = px;
  const gc = gear.getContext('2d')!;
  gc.translate(px / 2, px / 2);
  gc.rotate(tilt);
  gc.scale(k, k);
  gc.translate(-box.cx, -box.cy);
  drawPicture(gc, skin, shape);
  pc.save();
  pc.shadowColor = 'rgba(0,40,70,0.35)';
  pc.shadowBlur = px * 0.04;
  pc.shadowOffsetY = px * 0.02;
  pc.drawImage(gear, 0, 0);
  pc.restore();
  return pic;
}

export function puzzleCanvas(skin: SkinDef, pieces: number, size = 64, glow = -1, grid = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = Math.round(size * dpr);
  c.width = c.height = px;
  c.style.width = c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  const tier = TIERS.filter((t) => pieces >= t.pieces).length;
  const from = tier === 0 ? 0 : TIERS[tier - 1].pieces;
  const to = tier >= TIERS.length ? null : TIERS[tier].pieces;
  const n = puzzleGrid(from, to);
  const have = pieces - from;
  const r = px * 0.16;
  const pic = skinPicture(skin, px);
  // the card: rounded, pieces in
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, px, px, r);
  ctx.clip();
  ctx.fillStyle = '#20364b';
  ctx.fillRect(0, 0, px, px);
  if (n === 0) ctx.drawImage(pic, 0, 0);
  const cell = px / Math.max(1, n);
  for (let i = 0; i < n * n; i++) {
    const cx = (i % n) * cell;
    const cy = Math.floor(i / n) * cell;
    if (i < have || tier > 0) ctx.drawImage(pic, cx, cy, cell, cell, cx, cy, cell, cell);
    // not collected yet: dark; on an unlocked look the next tier's missing pieces are dimmed once it has started
    if (i >= have && (tier === 0 || have > 0 || grid)) {
      ctx.fillStyle = tier > 0 ? 'rgba(16,32,48,0.5)' : '#20364b';
      ctx.fillRect(cx, cy, cell, cell);
      if (tier === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.font = `900 ${cell * 0.42}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', cx + cell / 2, cy + cell / 2 + cell * 0.03);
      }
    }
  }
  if (n > 0 && (tier === 0 || have > 0 || grid)) {
    // the puzzle lines (an unlocked look shows clean until the next tier has started)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, px / 70);
    for (let j = 1; j < n; j++) {
      ctx.beginPath();
      ctx.moveTo(j * cell, 0);
      ctx.lineTo(j * cell, px);
      ctx.moveTo(0, j * cell);
      ctx.lineTo(px, j * cell);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (glow >= 0 && n > 0) {
    // the new piece: a bright frame
    const lw = px / 26;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = lw;
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = px / 14;
    ctx.beginPath();
    ctx.roundRect((glow % n) * cell + lw / 2, Math.floor(glow / n) * cell + lw / 2, cell - lw, cell - lw, r * 0.5);
    ctx.stroke();
  }
  return c;
}

/** Mix two #rrggbb colours (k = share of the second). */
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/**
 * The puzzle of an opened box as real tiles (the card of the box opening): the picture cut in 2x2 or 3x3 pieces with
 * gaps, the tier the new piece belongs to. `land` flies the new piece in from below (out of the chest) and snaps it into
 * its slot with a flash and sparkles; `merge` closes the gaps into one picture when the tier is complete.
 */
function puzzleTiles(skin: SkinDef, before: number, size: number): { el: HTMLElement; land: () => void; merge: () => void } {
  const tierBefore = TIERS.filter((t) => before >= t.pieces).length;
  const from = tierBefore === 0 ? 0 : TIERS[tierBefore - 1].pieces;
  const to = TIERS[tierBefore]?.pieces ?? from + 4;
  const n = puzzleGrid(from, to) || 2;
  const have = before - from;
  const gap = 5;
  const cell = (size - gap * (n - 1)) / n;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const url = skinPicture(skin, Math.round(size * dpr)).toDataURL();
  const el = document.createElement('div');
  el.className = 'pz';
  el.style.setProperty('--sz', `${size}px`);
  el.style.setProperty('--n', String(n));
  const bg = (i: number) => `background-image:url(${url});background-size:${size}px ${size}px;background-position:${-(i % n) * (cell + gap)}px ${-Math.floor(i / n) * (cell + gap)}px`;
  let html = '';
  for (let i = 0; i < n * n; i++) {
    const state = i < have ? 'got' : tierBefore === 0 ? 'empty' : 'dim';
    html += `<div class="pz-cell ${state}" data-i="${i}" style="${state === 'empty' ? '' : bg(i)}"></div>`;
  }
  html += `<div class="pz-full" style="background-image:url(${url})"></div>`;
  el.innerHTML = html;
  let landed = false;
  const land = () => {
    if (landed) return;
    landed = true;
    const slot = el.querySelector<HTMLElement>(`[data-i="${have}"]`);
    if (!slot) return;
    const fly = document.createElement('div');
    fly.className = 'pz-fly';
    fly.setAttribute('style', `${bg(have)};left:${(have % n) * (cell + gap)}px;top:${Math.floor(have / n) * (cell + gap)}px;width:${cell}px;height:${cell}px`);
    el.appendChild(fly);
    window.setTimeout(() => {
      slot.className = 'pz-cell got lit';
      slot.setAttribute('style', bg(have));
      slot.innerHTML = Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45}deg"></i>`).join('');
      fly.remove();
    }, 480);
  };
  const merge = () => el.classList.add('merged');
  return { el, land, merge };
}

/** Just the picture of a skin (finished look). */
export function skinCanvas(skin: SkinDef, locked: boolean, size = 64): HTMLCanvasElement {
  return puzzleCanvas(skin, locked ? 0 : TIERS[TIERS.length - 1].pieces, size);
}

/**
 * The Skins screen: unopened boxes (open them one by one), the box shop (coin box, 3 boxes for gems, golden box, a
 * free box for an ad) with the odds behind the "?", and the collection: every section of every sport with its three
 * skins (pieces, tier, boost). Tap an unlocked skin to wear it.
 */
/**
 * The Skins screen: the collection, every section of every sport with its three skins (pieces, tier, boost), and how
 * many skins reached each tier. Tap an unlocked skin to wear it. The boxes are in the shop.
 */
export class SkinScreen {
  private signature = '';

  constructor(
    private root: HTMLElement,
    private ctx: SkinContext,
  ) {}

  show() {
    this.root.className = 'modal menu skins';
    this.root.scrollTop = 0;
    this.signature = '';
    this.root.innerHTML = `
      <div class="menu-head">
        ${tile('skin', '#ff7043', 46)}
        <div class="menu-title"><h2>Skins</h2><small class="sk-tally" data-count></small></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div data-collection></div>`;
    this.root.querySelector('[data-close]')!.addEventListener('click', () => this.ctx.close());
    this.update();
  }

  /** Called often while open: redraws only when something changed. */
  update() {
    const s = this.ctx.game.state;
    const k = s.skins;
    const sig = [Object.values(k.pieces).join(','), Object.values(k.worn).join(',')].join('|');
    if (sig === this.signature) return;
    this.signature = sig;
    this.drawCollection();
    const n = collectionCount(s);
    // like the Idle Farming Empire collection: how many skins reached each tier
    const at = (t: number) => SKINS.filter((k) => skinProgress(s, k.id).tier >= t).length;
    this.root.querySelector('[data-count]')!.innerHTML = TIERS.map((_, i) => `<span class="t${i + 1}"><i></i>${at(i + 1)}<em>/${n.total}</em></span>`).join('');
  }

  private drawCollection() {
    const s = this.ctx.game.state;
    const el = this.root.querySelector('[data-collection]')!;
    el.innerHTML = SPORTS.map(
      (sport) => `
      <h4>${icon(sport.icon)} ${sport.name}</h4>
      ${ZONES.filter((z) => z.sport.id === sport.id)
        .map(
          (z) => `
        <div class="sk-row">
          <small>${z.def.name}</small>
          <div class="sk-three">${skinsOfZone(z.id)
            .map((skin) => {
              const p = skinProgress(s, skin.id);
              const worn = s.skins.worn[z.id] === skin.id;
              const pct = p.to === null ? 100 : Math.round(((p.pieces - p.from) / (p.to - p.from)) * 100);
              const tierName = p.tier >= 1 ? TIERS[p.tier - 1].name.toLowerCase() : 'locked';
              return `<button class="sk-skin ${worn ? 'worn' : ''} ${tierName}" data-skin="${skin.id}" style="--rar:${RARITY_LOOK[skin.rarity].color}" ${p.tier ? '' : 'aria-disabled="true"'}>
                <span class="sk-pic" data-pic="${skin.id}"></span>
                ${p.tier >= 2 ? `<em class="sk-boost">+${tierBoost(p.tier) * 100}%</em>` : ''}
                ${worn ? `<em class="sk-worn">${icon('check')}</em>` : ''}
                <i class="sk-bar"><u style="width:${pct}%"></u></i>
                <small>${p.to === null ? icon('star') : `${p.pieces}/${p.to}`}</small>
              </button>`;
            })
            .join('')}</div>
        </div>`,
        )
        .join('')}`,
    ).join('');
    el.querySelectorAll<HTMLElement>('[data-pic]').forEach((holder) => {
      const skin = SKINS.find((k) => k.id === holder.dataset.pic)!;
      holder.appendChild(puzzleCanvas(skin, skinProgress(s, skin.id).pieces, 60));
    });
    el.querySelectorAll<HTMLElement>('[data-skin]').forEach((b) =>
      b.addEventListener('click', () => {
        if (wearSkin(this.ctx.game.state, b.dataset.skin!)) {
          sound.tap();
          this.ctx.game.save();
          this.signature = '';
          this.update();
        }
      }),
    );
  }
}

/** What the box shop needs from the game screen. */
export interface BoxContext {
  game: Game;
  toast: (text: string) => void;
  confetti: () => void;
  refreshTop: () => void;
}

/**
 * The boxes in the shop (like Idle Farming Empire's Shoeboxes): the coin box, 3 boxes for gems and the golden box,
 * each with a "?" for its odds. A bought box opens straight away; free boxes (quests, new sections) show as a number
 * on the coin box, tap it to open them. The opening plays over `scroller` (the shop dialog).
 */
export class BoxShop {
  private signature = '';
  private opening = false;
  /** Boxes of a bought pack still to open: a tap opens the next one instead of going back to the shop. */
  private chain = 0;
  /** Called when the last opened box is tapped away (the plane's box closes its pop-up then). */
  private done: (() => void) | null = null;

  /** Open one box straight away (a box from the banner plane); `done` runs when it is tapped away. */
  openNow(kind: BoxKind, done?: () => void) {
    this.done = done ?? null;
    this.open(kind);
  }

  constructor(
    private scroller: HTMLElement,
    private host: HTMLElement,
    private ctx: BoxContext,
  ) {
    host.innerHTML = `<div data-cards></div>`;
    this.update();
  }

  /** Called often while open: redraws only when something changed. */
  update() {
    if (this.opening) return;
    const s = this.ctx.game.state;
    const k = s.skins;
    const sig = [k.boxes, k.golden, k.coinBoxes, s.coins >= coinBoxPrice(s), s.skillPoints].join('|');
    if (sig === this.signature) return;
    this.signature = sig;
    this.drawBoxes();
  }

  private drawBoxes() {
    const s = this.ctx.game.state;
    const k = s.skins;
    const price = coinBoxPrice(s);
    const el = this.host.querySelector('[data-cards]')!;
    // boxes are opened straight away; free boxes still to open show as a number on the box (tap it to open)
    const well = (kind: BoxKind, n: number, extra = '') =>
      n > 0
        ? `<button class="well has" data-open="${kind}">${boxArt(kind, extra)}<b class="sk-n">${n}</b></button>`
        : `<span class="well">${boxArt(kind, extra)}${extra === 'three' ? '<small>x3</small>' : ''}</span>`;
    el.innerHTML = `
      <div class="sk-buy">
        <div class="sk-card"><button class="sk-q" data-q="normal" aria-label="Odds">?</button>${well('normal', k.boxes)}${
          k.boxes > 0
            ? `<button class="go ready" data-open="normal">Free</button>`
            : `<button class="go ${s.coins >= price ? 'ready' : ''}" data-buy="coin" ${s.coins >= price ? '' : 'disabled'}>${icon('coin')} ${fmt(price)}</button>`
        }</div>
        <div class="sk-card"><button class="sk-q" data-q="normal" aria-label="Odds">?</button>${well('normal', 0, 'three')}<button class="go alt" data-buy="three" ${s.skillPoints >= BOXES.threeGems ? '' : 'disabled'}>${icon('gem')} ${BOXES.threeGems}</button></div>
        <div class="sk-card gold"><button class="sk-q" data-q="golden" aria-label="Odds">?</button>${well('golden', k.golden)}<button class="go alt" data-buy="golden" ${s.skillPoints >= BOXES.goldenGems ? '' : 'disabled'}>${icon('gem')} ${BOXES.goldenGems}</button></div>
      </div>`;
    el.querySelectorAll<HTMLElement>('[data-open]').forEach((b) => b.addEventListener('click', () => this.open(b.dataset.open as BoxKind)));
    el.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => void this.buy(b.dataset.buy!)));
    el.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => this.showOdds(b.dataset.q as BoxKind)));
  }

  /** The odds of a box in a pop-up over the shop (shown before buying: App Store rule 3.1.1). Tap anywhere to close. */
  private showOdds(kind: BoxKind) {
    const layer = document.createElement('div');
    layer.className = 'sk-reveal sk-oddspop';
    layer.style.top = `${this.scroller.scrollTop}px`;
    const rows = RARITIES.map((r) => `<li style="color:${RARITY_LOOK[r].color}"><b>${BOX_ODDS[kind][r]}%</b><span>${RARITY_LOOK[r].name}</span></li>`).join('');
    layer.innerHTML = `
      <div class="sk-oddscard ${kind}">
        <button class="x" aria-label="Close">${icon('close')}</button>
        ${boxArt(kind, 'big')}
        <ul>${rows}</ul>
      </div>`;
    layer.addEventListener('click', () => layer.remove());
    this.scroller.appendChild(layer);
    sound.tap();
  }

  private buy(what: string) {
    const s = this.ctx.game.state;
    const ok = what === 'coin' ? buyCoinBox(s) : buyGemBoxes(s, what as 'three' | 'golden');
    if (!ok) return;
    sound.coin();
    this.ctx.game.save();
    this.ctx.refreshTop();
    this.signature = '';
    this.update();
    // a bought box is opened right away
    if (this.opening) return;
    if (what === 'three') this.chain = 2;
    this.open(what === 'golden' ? 'golden' : 'normal');
  }

  /** Open one box, full screen (src/ui/boxOpen.ts): the wave, the chest, the card. Tap for the next one. */
  private open(kind: BoxKind) {
    const s = this.ctx.game.state;
    const r = openBox(s, kind);
    if (!r) return;
    this.ctx.game.save();
    this.opening = true;
    const look = RARITY_LOOK[r.skin.rarity];
    const { card, reveal } = this.card(r);
    const host = (this.scroller.closest('#ui') as HTMLElement | null) ?? document.getElementById('ui') ?? document.body;
    playOpening({
      host,
      kind,
      rarity: r.skin.rarity,
      color: look.color,
      chest: boxArt(kind),
      mini: boxArt(kind, 'mini'),
      left: this.chain > 0 ? Math.min(this.chain, this.left(kind)) : this.left(kind),
      card,
      reveal,
      big: r.newTier !== null,
      hero: skinGear(r.skin, 560),
      title: `${look.name}!`,
      onTap: () => this.afterOpening(),
    });
  }

  /** The skin card of an opened box, and its moment: the new piece flies into the puzzle, and a finished tier merges into one picture. */
  private card(r: BoxResult): { card: HTMLElement; reveal: (fast: boolean) => void } {
    const look = RARITY_LOOK[r.skin.rarity];
    const zone = ZONES.find((z) => z.id === r.skin.zone)!;
    const p = skinProgress(this.ctx.game.state, r.skin.id);
    const big = r.newTier !== null;
    // the moment a tier is reached the bar is full; otherwise it shows the way to the next tier
    const pct = big || p.to === null ? 100 : Math.round(((p.pieces - p.from) / (p.to - p.from)) * 100);
    const tierBefore = TIERS.filter((t) => r.before >= t.pieces).length;
    const fromBefore = tierBefore === 0 ? 0 : TIERS[tierBefore - 1].pieces;
    const toBefore = TIERS[tierBefore]?.pieces ?? r.before;
    const pctBefore = toBefore > fromBefore ? Math.round(((r.before - fromBefore) / (toBefore - fromBefore)) * 100) : 100;
    const count = `${r.after - fromBefore}/${toBefore - fromBefore}`;
    const title = r.newTier === 1 ? 'New skin!' : r.newTier ? `${TIERS[r.newTier - 1].name} +${TIERS[r.newTier - 1].boost * 100}%` : '+1';
    const ink = r.skin.rarity === 'legendary' || r.skin.rarity === 'common' ? '#2b1d00' : '#ffffff';
    const card = document.createElement('div');
    card.className = `bc ${big ? 'big' : ''}`;
    card.style.setProperty('--rar', look.color);
    card.style.setProperty('--rar-ink', ink);
    card.style.setProperty('--rar-top', mix('#0e3352', look.color, 0.38));
    card.style.setProperty('--rar-dark', mix(look.color, '#000000', 0.35));
    card.innerHTML = `
      <div class="bc-ribbon"><span>${look.name}</span></div>
      <div class="bc-pic"></div>
      <b class="bc-name">${r.skin.name}</b>
      <small class="bc-zone">${icon(zone.sport.icon)} ${zone.def.name}</small>
      <div class="bc-bar"><u style="width:${pctBefore}%"></u><span>${count}</span></div>
      <strong class="bc-title">${title}</strong>
      <i class="bc-shine"></i>`;
    const tiles = puzzleTiles(r.skin, r.before, 176);
    card.querySelector('.bc-pic')!.appendChild(tiles.el);
    let done = false;
    const finish = (fast: boolean) => {
      card.querySelector<HTMLElement>('.bc-bar u')!.style.width = `${pct}%`;
      if (big) window.setTimeout(() => tiles.merge(), fast ? 0 : 520);
    };
    const go = (fast: boolean) => {
      if (done) {
        if (fast && big) tiles.merge();
        return;
      }
      done = true;
      tiles.land();
      finish(fast);
    };
    return { card, reveal: (fast) => (fast ? go(true) : window.setTimeout(() => go(false), 250)) };
  }

  /** After an opening is tapped away: the next box of a bought pack, or back to the shop. */
  private afterOpening() {
    this.opening = false;
    if (this.chain > 0 && this.ctx.game.state.skins.boxes > 0) {
      this.chain--;
      this.open('normal');
      return;
    }
    this.chain = 0;
    const done = this.done;
    this.done = null;
    if (done) {
      done();
      return;
    }
    this.signature = '';
    this.update();
    this.ctx.refreshTop();
  }

  private left(kind: BoxKind): number {
    const k = this.ctx.game.state.skins;
    return kind === 'golden' ? k.golden : k.boxes;
  }
}
