import { BOX_ODDS, BOXES, RARITIES, RARITY_LOOK, SKINS, TIERS, skinsOfZone, type BoxKind, type SkinDef } from '../config/skins';
import { SPORTS, ZONES } from '../config/sports';
import type { Game } from '../core/game';
import { buyCoinBox, buyGemBoxes, coinBoxPrice, collectionCount, openBox, skinProgress, tierBoost, wearSkin, type BoxResult } from '../core/skins';
import { drawSkin, skinShape } from '../scene/rig/skinArt';
import { fmt } from './format';
import { icon, tile } from './icons';
import { sound } from './sound';

export interface SkinContext {
  game: Game;
  close: () => void;
  toast: (text: string) => void;
  confetti: () => void;
  refreshTop: () => void;
}

/** One box drawn in 3/4 view: a cardboard box with tape, or the golden chest. The lid is its own group (it pops off). */
function boxShape(kind: BoxKind): string {
  const g = kind === 'golden';
  const line = g ? '#4a1604' : '#3e2416';
  const c = g ? { front: '#c62828', side: '#8e1414', top: '#ffd54f', rim: '#f2a93b', rimSide: '#c9850f' } : { front: '#d08a57', side: '#a9663d', top: '#e8a774', rim: '#c9773f', rimSide: '#9e5a30' };
  const body = `
    <polygon points="12,40 66,46 66,78 12,72" fill="${c.front}"/>
    <polygon points="66,46 90,38 90,70 66,78" fill="${c.side}"/>
    ${
      g
        ? `<path d="M12,40 L12,72 M66,46 L66,78 M90,38 L90,70" stroke="#ffc83d" stroke-width="5"/>
           <path d="M12,70 L66,76 L90,68" stroke="#ffc83d" stroke-width="4" fill="none"/>
           <path d="M39,67 L29,55 Q39,47 49,55 Z" fill="#ffc83d" stroke="${line}" stroke-width="1.5" stroke-linejoin="round"/>
           <path d="M39,67 L34,54 M39,67 L39,51 M39,67 L44,54" stroke="${line}" stroke-width="1.2"/>`
        : `<polygon points="34,42.5 42,43.4 42,75.4 34,74.6" fill="#e9eef2"/>
           <circle cx="55" cy="62" r="6.5" fill="#29b6f6" stroke="${line}" stroke-width="1.5"/>
           <path d="M50,63 q2.5,-3 5,0 t5,0" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
    }
    <path d="M12,40 L66,46 L90,38 L90,70 L66,78 L12,72 Z M66,46 L66,78" fill="none" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>`;
  const lid = `<g class="lid">
    <polygon points="8,34 68,41 94,32 34,25" fill="${c.top}"/>
    <polygon points="8,34 68,41 68,50 8,43" fill="${c.rim}"/>
    <polygon points="68,41 94,32 94,41 68,50" fill="${c.rimSide}"/>
    ${
      g
        ? `<path d="M8,42 L68,49 L94,40" stroke="#fff3c4" stroke-width="2" fill="none"/>
           <path d="M44,30 l3,-8 l4,5 l4,-6 l3,7 l4,-4 l-1,9 Z" fill="#ffc83d" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"/>`
        : `<polygon points="34,37 42,38 68,29.5 60,28.6" fill="#e9eef2"/>
           <polygon points="34,37 42,38 42,47 34,46" fill="#d3dbe1"/>`
    }
    <path d="M8,34 L34,25 L94,32 L94,41 L68,50 L8,43 Z M8,34 L68,41 L94,32 M68,41 L68,50" fill="none" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
  </g>`;
  return body + lid;
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
function pictureShape(skin: SkinDef) {
  return skin.sport === 'sailing' ? SAIL_SIDE : skinShape(skin.sport, skin.level);
}

/** Where the gear really sits in its own coordinates (measured once per shape from the drawn picture). */
const gearBoxes = new Map<string, { cx: number; cy: number; w: number; h: number }>();
function gearBox(skin: SkinDef) {
  const key = `${skin.sport}-${skin.level}`;
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
  drawSkin(g, skin, shape);
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
export function puzzleCanvas(skin: SkinDef, pieces: number, size = 64, glow = -1): HTMLCanvasElement {
  const shape = pictureShape(skin);
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
  // the picture: sea behind, the gear in its skin on top
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
  pc.save();
  pc.translate(px / 2, px / 2);
  pc.rotate(tilt);
  pc.scale(k, k);
  pc.translate(-box.cx, -box.cy);
  pc.shadowColor = 'rgba(0,40,70,0.35)';
  pc.shadowBlur = px * 0.04;
  pc.shadowOffsetY = px * 0.02;
  drawSkin(pc, skin, shape);
  pc.restore();
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
    if (i >= have && (tier === 0 || have > 0)) {
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
  if (n > 0 && (tier === 0 || have > 0)) {
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

  constructor(
    private scroller: HTMLElement,
    private host: HTMLElement,
    private ctx: BoxContext,
  ) {
    host.innerHTML = `<div data-cards></div><div class="sk-odds" data-odds hidden></div>`;
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
    el.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => this.toggleOdds(b.dataset.q as BoxKind)));
  }

  /** The odds of each box (shown before buying: App Store rule 3.1.1). */
  private oddsShown: BoxKind | null = null;

  private toggleOdds(kind: BoxKind) {
    const el = this.host.querySelector('[data-odds]') as HTMLElement;
    this.oddsShown = this.oddsShown === kind ? null : kind;
    el.hidden = this.oddsShown === null;
    if (el.hidden) return;
    el.innerHTML = `
      <p>${boxArt(kind, 'mini')}${RARITIES.filter((r) => BOX_ODDS[kind][r] > 0)
        .map((r) => `<span style="color:${RARITY_LOOK[r].color}">${RARITY_LOOK[r].name} <b>${BOX_ODDS[kind][r]}%</b></span>`)
        .join('')}</p>
      <p class="dim">1 piece per box · ${TIERS.map((t) => `${t.pieces} = ${t.name}${t.boost ? ` +${t.boost * 100}%` : ''}`).join(' · ')}</p>`;
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

  /** Open one box: it shakes, pops open, and the piece flies to its skin. Tap for the next one. */
  private open(kind: BoxKind) {
    const s = this.ctx.game.state;
    const r = openBox(s, kind);
    if (!r) return;
    this.ctx.game.save();
    this.opening = true;
    sound.tap();
    const layer = document.createElement('div');
    layer.className = 'sk-reveal';
    layer.style.top = `${this.scroller.scrollTop}px`;
    layer.innerHTML = boxArt(kind, 'shake');
    this.scroller.appendChild(layer);
    // shake, then the lid pops off, then the piece
    window.setTimeout(() => layer.querySelector('.box')?.classList.add('pop'), 650);
    window.setTimeout(() => this.reveal(layer, r), 950);
  }

  private reveal(layer: HTMLElement, r: BoxResult) {
    const look = RARITY_LOOK[r.skin.rarity];
    const zone = ZONES.find((z) => z.id === r.skin.zone)!;
    const p = skinProgress(this.ctx.game.state, r.skin.id);
    const big = r.newTier !== null;
    // the moment a tier is reached the bar is full; otherwise it shows the way to the next tier
    const pct = big || p.to === null ? 100 : Math.round(((p.pieces - p.from) / (p.to - p.from)) * 100);
    const count = big ? `${p.pieces}/${p.pieces}` : p.to === null ? icon('star') : `${p.pieces}/${p.to}`;
    const tierBefore = TIERS.filter((t) => r.before >= t.pieces).length;
    const fromBefore = tierBefore === 0 ? 0 : TIERS[tierBefore - 1].pieces;
    const toBefore = TIERS[tierBefore]?.pieces ?? r.before;
    const pctBefore = toBefore > fromBefore ? Math.round(((r.before - fromBefore) / (toBefore - fromBefore)) * 100) : 100;
    const title = r.newTier === 1 ? 'New skin!' : r.newTier ? `${TIERS[r.newTier - 1].name} +${TIERS[r.newTier - 1].boost * 100}%!` : `+1`;
    layer.innerHTML = `
      <div class="sk-got ${big ? 'big' : ''}" style="--rar:${look.color}">
        <em class="sk-rar">${look.name}</em>
        <span class="sk-pic"></span>
        <b>${r.skin.name}</b>
        <small>${icon(zone.sport.icon)} ${zone.def.name}</small>
        <i class="sk-bar"><u style="width:${pctBefore}%"></u></i>
        <small>${count}</small>
        <strong>${title}</strong>
      </div>`;
    // the puzzle before, then the new piece drops in with a glow
    const pic = layer.querySelector('.sk-pic')!;
    pic.appendChild(puzzleCanvas(r.skin, r.before, 130));
    window.setTimeout(() => {
      pic.innerHTML = '';
      // a finished puzzle shows the whole picture (the new look or the new tier); otherwise the new piece glows
      pic.appendChild(big ? skinCanvas(r.skin, false, 130) : puzzleCanvas(r.skin, r.after, 130, r.after - 1 - fromBefore));
      pic.classList.add('drop');
      layer.querySelector<HTMLElement>('.sk-bar u')!.style.width = `${pct}%`;
      if (big) {
        sound.coin();
        this.ctx.confetti();
      }
    }, 380);
    // tap anywhere: the next box of a bought pack, or back to the shop
    layer.addEventListener('click', () => {
      layer.remove();
      this.opening = false;
      if (this.chain > 0 && this.ctx.game.state.skins.boxes > 0) {
        this.chain--;
        this.open('normal');
        return;
      }
      this.chain = 0;
      this.signature = '';
      this.update();
      this.ctx.refreshTop();
    });
  }
}
