// The treasure box opening, full screen: a big wave rolls over the beach, and when it pulls back a chest lies washed up
// on the wet sand. It rattles while light in the colour of what is inside leaks out, the lid flies off with rays and a
// burst. A special item gets its own hero moment, bigger for a rarer one: the item itself rises out of the chest and
// floats in the light with a shockwave and its rarity slammed onto the screen (Epic: purple lightning; Legendary: the
// beach goes dark, gold rays, glitter, a boom and a shake, the item spins). Then the skin card rises. A tap at any moment
// jumps to the card; a tap on the card goes on (next box or back).
// Plain DOM and CSS (styles.css, "box opening"), no randomness: every particle has a fixed place.

import type { BoxKind, Rarity } from '../config/skins';
import { sound } from './sound';

export interface OpeningOptions {
  /** Where the full-screen layer goes (the UI root). */
  host: HTMLElement;
  kind: BoxKind;
  rarity: Rarity;
  /** The rarity's colour (rays, light, burst). */
  color: string;
  /** The chest picture (boxArt). */
  chest: string;
  /** A small chest picture for the "boxes left" counter. */
  mini: string;
  /** Boxes still to open after this one (0 = none). */
  left: number;
  /** The skin card (shown when it rises out of the chest). */
  card: HTMLElement;
  /** Start the card's own moment (the piece drops in); `fast` = at once. Called once or twice (a skip), must be safe twice. */
  reveal: (fast: boolean) => void;
  /** A new look or tier: extra celebration. */
  big: boolean;
  /** The item itself (the gear in its skin, clear background), big, for the hero moment of a special item. */
  hero: HTMLCanvasElement;
  /** The rarity's name, shown big in the hero moment. */
  title: string;
  /** Tapped after the card is shown: the layer is gone, go on. */
  onTap: () => void;
}

/** Fixed spread of n particles: golden angle around the chest, a little up. */
function particles(n: number, cls: string, colors: string[], reach: number): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 137.508 * Math.PI) / 180;
    const d = reach * (0.45 + ((i * 53) % 100) / 180);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d * 0.8 - reach * 0.35;
    const col = colors[i % colors.length];
    const size = 7 + ((i * 29) % 9);
    out += `<i class="${cls}" style="--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--rot:${(i * 67) % 360}deg;--pc:${col};--s:${size}px;--dl:${((i % 5) * 0.02).toFixed(2)}s"></i>`;
  }
  return out;
}

const BURST: Record<Rarity, number> = { common: 14, rare: 20, epic: 28, legendary: 40, club: 40 };

export function playOpening(o: OpeningOptions) {
  const el = document.createElement('div');
  el.className = `bo bo-${o.kind}`;
  el.dataset.r = o.rarity;
  el.style.setProperty('--rc', o.color);
  const spray = Array.from({ length: 16 }, (_, i) => {
    const x = 4 + i * 6.2;
    return `<i style="left:${x}%;--dy:${-60 - ((i * 37) % 70)}px;--dx:${((i * 23) % 40) - 20}px;--s:${8 + ((i * 13) % 10)}px;--dl:${((i % 4) * 0.03).toFixed(2)}s"></i>`;
  }).join('');
  const drips = [18, 30, 44, 58, 72, 84].map((x, i) => `<i style="left:${x}%;--dl:${(i * 0.13).toFixed(2)}s"></i>`).join('');
  const burstColors = o.kind === 'golden' ? [o.color, '#ffffff', '#ffd54f', '#ffe9a8'] : [o.color, '#ffffff', '#bfefff'];
  const burst =
    particles(BURST[o.rarity], 'p', burstColors, o.rarity === 'legendary' ? 230 : 180) +
    (o.kind === 'golden' ? particles(12, 'p coin', ['#ffd54f'], 200) : '') +
    (o.rarity === 'legendary' || o.rarity === 'epic' ? particles(10, 'p star', ['#ffffff', o.color], 210) : '');
  // little stars that twinkle around the card once it is up
  const twinkles = [
    [8, 14],
    [88, 10],
    [4, 44],
    [94, 38],
    [14, 62],
    [86, 66],
    [30, 6],
    [70, 4],
    [50, 70],
    [22, 30],
    [78, 28],
  ]
    .map(([x, y], i) => `<i style="left:${x}%;top:${y}%;--dl:${((i * 0.37) % 1.6).toFixed(2)}s;--s:${8 + ((i * 5) % 8)}px"></i>`)
    .join('');
  const special = o.rarity !== 'common';
  const knock = o.rarity === 'epic' || o.rarity === 'legendary';
  const legendary = o.rarity === 'legendary';
  // glitter falling through the dark (Legendary), light shooting through the chest's cracks before it bursts (Epic, Legendary)
  const glitter = legendary
    ? Array.from({ length: 26 }, (_, i) => `<i style="left:${(i * 37) % 100}%;--dl:${((i * 0.29) % 2.2).toFixed(2)}s;--s:${5 + ((i * 7) % 7)}px;--dx:${((i * 17) % 30) - 15}px"></i>`).join('')
    : '';
  const cracks = knock ? [-38, -20, -6, 8, 24, 40].map((a, i) => `<i style="left:${18 + i * 13}%;--a:${a}deg;--dl:${(i * 0.05).toFixed(2)}s"></i>`).join('') : '';
  const bolts =
    o.rarity === 'epic'
      ? `<svg viewBox="0 0 280 280" aria-hidden="true"><polyline points="30,40 62,82 46,92 84,140" /><polyline points="250,52 214,96 232,104 196,150" /><polyline points="44,236 84,200 70,190 110,160" /><polyline points="238,226 200,196 216,184 176,160" /></svg>`
      : '';
  const confetti = o.big ? particles(36, 'p conf', ['#ff5a45', '#ffcf3f', '#4fc3f7', '#5be08f', '#ff7ab8', '#ffffff'], 260) : '';
  el.innerHTML = `
    <div class="bo-beach"><i class="bo-sea"></i><i class="bo-shore"></i><i class="bo-sand"></i></div>
    <i class="bo-wet"></i>
    <i class="bo-dim"></i>
    ${legendary ? '<i class="bo-night"></i>' : ''}
    <div class="bo-rays"><i></i><i class="b"></i></div>
    <i class="bo-glowup"></i>
    <div class="bo-chest">${o.chest}<i class="bo-seep"></i><i class="bo-inner"></i><div class="bo-cracks">${cracks}</div><div class="bo-drips">${drips}</div></div>
    <div class="bo-burst">${burst}</div>
    <div class="bo-wave"><i class="bo-streaks"></i><i class="bo-lip"></i><i class="bo-foam"></i></div>
    <div class="bo-spray">${spray}</div>
    <i class="bo-flash"></i>
    ${legendary ? `<div class="bo-glitter">${glitter}</div>` : ''}
    ${special ? `<div class="bo-hero"><i class="bo-aura"></i><i class="bo-ring"></i><i class="bo-ring r2"></i>${legendary ? '<i class="bo-ring r3"></i>' : ''}<div class="bo-bolts">${bolts}</div><div class="bo-item"></div></div><div class="bo-htitle"><span>${o.title}</span></div>` : ''}
    ${o.rarity === 'epic' ? '<i class="bo-zap"></i>' : ''}
    <div class="bo-cardwrap"></div>
    <div class="bo-twinkle">${twinkles}</div>
    <div class="bo-confetti">${confetti}</div>
    ${o.left > 0 ? `<div class="bo-left">${o.mini}<b>${o.left}</b></div>` : ''}`;
  el.querySelector('.bo-cardwrap')!.appendChild(o.card);
  el.querySelector('.bo-item')?.appendChild(o.hero);
  o.host.appendChild(el);

  let done = false;
  const reveal = (fast: boolean) => o.reveal(fast);
  // the timeline: a rarer item knocks longer before it opens and gets a longer hero moment
  const open = knock ? 2000 : 1650;
  const heroAt = open + 260;
  const heroLen = { common: 0, rare: 1150, epic: 1450, legendary: 2050, club: 2050 }[o.rarity];
  const cardAt = special ? heroAt + heroLen : open + 500;
  const steps: [number, () => void][] = [
    [
      0,
      () => {
        el.classList.add('s-in');
        sound.wave(o.kind === 'golden');
      },
    ],
    [480, () => el.classList.add('s-crash')],
    [560, () => el.classList.add('s-out')],
    [
      1250,
      () => {
        el.classList.add('s-shake');
        sound.rattle();
      },
    ],
    ...(knock
      ? ([
          [
            1620,
            () => {
              el.classList.add('s-shake2');
              sound.rattle();
              window.setTimeout(() => sound.rattle(), 170);
            },
          ],
        ] as [number, () => void][])
      : []),
    [
      open,
      () => {
        el.classList.add('s-open');
        sound.open(o.rarity);
      },
    ],
    ...(special
      ? ([
          [
            heroAt,
            () => {
              el.classList.add('s-hero');
              sound.chime();
            },
          ],
          [
            heroAt + 330,
            () => {
              el.classList.add('s-title');
              sound.boom(legendary);
            },
          ],
        ] as [number, () => void][])
      : []),
    [cardAt, () => el.classList.add('s-card')],
    [cardAt + 60, () => reveal(false)],
    [
      cardAt + 480,
      () => {
        if (o.big) {
          el.classList.add('s-big');
          sound.unlock();
        }
      },
    ],
    [
      cardAt + 600,
      () => {
        el.classList.add('s-done');
        done = true;
      },
    ],
  ];
  let next = 0;
  const timers = steps.map(([at, fn], i) =>
    window.setTimeout(() => {
      next = i + 1;
      fn();
    }, at),
  );
  // a tap before the card is up skips to it; a tap on the card goes on
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!done) {
      timers.forEach((t) => window.clearTimeout(t));
      el.classList.add('skip', 's-in', 's-crash', 's-out', 's-shake', 's-open', 's-hero', 's-title', 's-card', 's-done');
      if (o.big) el.classList.add('s-big');
      if (next <= 4) sound.open(o.rarity);
      reveal(true);
      done = true;
      return;
    }
    el.classList.add('s-leave');
    window.setTimeout(() => {
      el.remove();
      o.onTap();
    }, 160);
  });
}
