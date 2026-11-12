import type { AdResult } from '../ads';
import { BALANCE } from '../config/balance';
import { AD_STEPS, CLUB, COIN_PACKS, GEM_PACKS, PRODUCTS, type AdStep, type CoinPackId, type GemPackId, type ProductId } from '../config/shop';
import type { Game } from '../core/game';
import { adFree } from '../core/perks';
import { adStreak, buyCoinPack, claimAdStep, claimClubGems, clubStatus, coinPackValue, grantGemPack } from '../core/shop';
import { fmt } from './format';
import { buy, buyClub, buyPack, canBuy, manageClub, restore, storePrices, type PriceKey } from '../purchases';
import { icon, tile } from './icons';
import { BoxShop } from './skins';
import { sound } from './sound';

export interface ShopContext {
  game: Game;
  close: () => void;
  toast: (text: string) => void;
  confetti: () => void;
  refreshTop: () => void;
  /** Show one ad (or skip it when the player bought "Remove ads"). */
  playAd: () => Promise<AdResult>;
  /** Open the Terms or the Privacy Policy. */
  openLegal: (page: 'terms' | 'privacy') => void;
  /** True while an ad is on screen. */
  busy: () => boolean;
}

const stepText = (s: AdStep) => ('gems' in s ? `${icon('gem')}<b>+${s.gems}</b>` : `<b>x${BALANCE.boostMult}</b><small>${s.boost >= 60 ? `${s.boost / 60} min` : `${s.boost}s`}</small>`);

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(h)}:${two(m)}:${two(s)}`;
}

/** A pile of coins for a coin pack: a few coins, a pile, a big heap (i = 0, 1, 2). */
function coinPile(i: number): string {
  const coin = (x: number, y: number, r = 7) =>
    `<ellipse cx="${x}" cy="${y + 2.2}" rx="${r}" ry="${r * 0.42}" fill="#b07a08"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.42}" fill="#ffd54f" stroke="#a86f00" stroke-width="1"/><ellipse cx="${x - r * 0.25}" cy="${y - 0.6}" rx="${r * 0.45}" ry="${r * 0.15}" fill="#fff3b0"/>`;
  const stack = (x: number, base: number, n: number) => Array.from({ length: n }, (_, k) => coin(x, base - k * 3.2)).join('');
  const piles = [
    stack(32, 46, 3) + stack(48, 48, 2) + coin(40, 50),
    stack(22, 48, 3) + stack(36, 46, 5) + stack(52, 48, 4) + coin(44, 52) + coin(28, 52),
    `<path d="M8,52 Q40,4 72,52 Z" fill="#f2b632" stroke="#a86f00" stroke-width="1.4"/>` +
      [
        [26, 40],
        [40, 30],
        [54, 40],
        [33, 48],
        [47, 48],
        [40, 20],
        [18, 50],
        [62, 50],
      ]
        .map(([x, y]) => coin(x, y, 6.5))
        .join('') +
      `<path d="M56,22 l2,-5 l2,5 l5,0.4 l-4,3 l1.6,5 l-4.6,-3 l-4.6,3 l1.6,-5 l-4,-3 Z" fill="#fffbe6" opacity="0.9"/>`,
  ];
  return `<svg viewBox="0 0 80 60" aria-hidden="true">${piles[i]}</svg>`;
}

/** The shop dialog: a free ad streak (5 ads a day) and two one-time purchases. It draws itself into `root`. */
export class Shop {
  private prices: Partial<Record<PriceKey, string>> = {};
  private signature = '';
  private buying = false;
  private boxes: BoxShop | null = null;

  constructor(
    private root: HTMLElement,
    private ctx: ShopContext,
  ) {}

  show() {
    this.root.className = 'modal menu shop';
    this.root.scrollTop = 0;
    this.signature = '';
    this.root.innerHTML = `
      <div class="menu-head">
        ${tile('bag', '#ffc233', 46)}
        <div class="menu-title"><h2>Shop</h2></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="shop-card club" data-club></div>
      <h4>Free rewards</h4>
      <div class="shop-card" data-streak></div>
      <h4>Treasure boxes</h4>
      <div data-boxshop></div>
      <h4>Coins</h4>
      <div class="cp-row" data-coins></div>
      <h4>Gems</h4>
      <div data-packs></div>
      <h4>Buy once, keep forever</h4>
      <div data-products></div>
      ${canBuy ? `<button class="go alt big" data-restore>Restore purchases</button>` : `<p class="menu-line">Buying works in the Surf Tycoon phone app.</p>`}
      <button class="go big" data-close2>Back to the beach</button>`;
    this.root.querySelector('[data-close]')!.addEventListener('click', () => this.ctx.close());
    this.root.querySelector('[data-close2]')!.addEventListener('click', () => this.ctx.close());
    this.root.querySelector('[data-restore]')?.addEventListener('click', () => void this.restore());
    this.boxes = new BoxShop(this.root, this.root.querySelector('[data-boxshop]') as HTMLElement, this.ctx);
    this.update();
    void storePrices().then((p) => {
      this.prices = p;
      this.signature = '';
      this.update();
    });
  }

  /** Coins for gems: hours of the player's own income, the amount shown on each card. Redrawn when the gems or the income change. */
  private coinSig = '';
  private drawCoins() {
    const g = this.ctx.game.state;
    const values = COIN_PACKS.map((p) => coinPackValue(g, p.id));
    const sig = `${g.skillPoints}|${values.map((v) => fmt(v)).join(',')}`;
    if (sig === this.coinSig) return;
    this.coinSig = sig;
    const el = this.root.querySelector('[data-coins]') as HTMLElement | null;
    if (!el) return;
    el.innerHTML = COIN_PACKS.map((p, i) => {
      const ok = g.skillPoints >= p.gems && values[i] > 0;
      return `<div class="cp-card cp${i + 1}">
        <span class="cp-pic">${coinPile(i)}</span>
        <b class="cp-amount">+${fmt(values[i])}</b>
        <small class="cp-hours">${icon('clock')} ${p.hours}h</small>
        <button class="go alt" data-coinpack="${p.id}" ${ok ? '' : 'disabled'}>${icon('gem')} ${p.gems}</button>
      </div>`;
    }).join('');
    el.querySelectorAll<HTMLElement>('[data-coinpack]').forEach((b) =>
      b.addEventListener('click', () => {
        const coins = buyCoinPack(this.ctx.game.state, b.dataset.coinpack as CoinPackId);
        if (!coins) return;
        sound.coin();
        this.ctx.confetti();
        this.ctx.toast(`+${fmt(coins)} coins`);
        this.ctx.game.save();
        this.ctx.refreshTop();
        this.coinSig = '';
        this.signature = '';
        this.update();
      }),
    );
  }

  /** Called about ten times a second while the shop is open: redraws only when something changed. */
  update() {
    this.boxes?.update();
    this.drawCoins();
    const g = this.ctx.game.state;
    const now = Date.now();
    const streak = adStreak(g, now);
    const busy = this.ctx.busy() || this.buying;
    const sig = [streak.step, streak.lockedFor, busy, g.perks.noAds, g.perks.x5, g.perks.club, g.perks.clubUntil, clubStatus(g, now).nextIn, g.skillPoints, Object.values(this.prices).join(',')].join(
      '|',
    );
    if (sig === this.signature) return;
    this.signature = sig;

    const club = clubStatus(g, now);
    const until = g.perks.clubUntil ? new Date(g.perks.clubUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
    const perks = [`Coins x${CLUB.coinMult}, all the time`, 'No ads', `${CLUB.gemsPerDay} gems every day`, `+${CLUB.awayHours} hours away time`];
    this.root.querySelector('[data-club]')!.innerHTML = `
      <div class="shop-title"><b>${icon('star')} ${CLUB.name}</b><small>${club.active ? `Active${until ? ' until ' + until : ''}` : `${this.prices.club ?? CLUB.price} / month`}</small></div>
      <ul class="club-perks">${perks.map((t) => `<li>${icon('check')}${t}</li>`).join('')}</ul>
      ${
        club.active
          ? `<button class="go big ready" data-club-claim ${club.nextIn > 0 || busy ? 'disabled' : ''}>${icon('gem')} ${club.nextIn > 0 ? `Next gems in ${clock(club.nextIn)}` : `Claim ${CLUB.gemsPerDay} gems`}</button>
             <button class="go alt big" data-club-manage>Manage subscription</button>`
          : `<button class="go big club-join" data-club-join ${busy ? 'disabled' : ''}>Join for ${this.prices.club ?? CLUB.price} / month</button>`
      }
      <p class="shop-note">${this.prices.club ?? CLUB.price} per month. Renews by itself every month until you cancel it in your App Store or Google Play account settings. Cancel any time. <button class="link" data-legal="terms">Terms</button> · <button class="link" data-legal="privacy">Privacy</button></p>`;
    this.root.querySelector('[data-club-join]')?.addEventListener('click', () => void this.joinClub());
    this.root.querySelector('[data-club-claim]')?.addEventListener('click', () => this.claimClub());
    this.root.querySelector('[data-club-manage]')?.addEventListener('click', () => void manageClub());
    this.root.querySelectorAll<HTMLElement>('[data-legal]').forEach((b) => b.addEventListener('click', () => this.ctx.openLegal(b.dataset.legal as 'terms' | 'privacy')));

    const locked = streak.lockedFor > 0;
    const steps = AD_STEPS.map((s, i) => {
      const done = locked || i < streak.step;
      return `<div class="step${done ? ' done' : ''}${!locked && i === streak.step ? ' next' : ''}">${done ? icon('check') : stepText(s)}</div>`;
    }).join('');
    const label = locked ? `Next ads in ${clock(streak.lockedFor)}` : busy ? 'Loading...' : `${adFree(g.perks) ? 'Claim' : 'Watch ad'} ${streak.step + 1} of ${AD_STEPS.length}`;
    this.root.querySelector('[data-streak]')!.innerHTML = `
      <div class="shop-title"><b>Watch 5 ads</b><small>${locked ? 'Done for today' : 'Once a day'}</small></div>
      <div class="steps">${steps}</div>
      <p class="shop-note">${locked ? 'All five rewards are yours. Come back tomorrow.' : `Next: ${'gems' in streak.reward ? `${streak.reward.gems} gem${streak.reward.gems > 1 ? 's' : ''}` : `coins x${BALANCE.boostMult} for ${streak.reward.boost >= 60 ? `${streak.reward.boost / 60} minute` : `${streak.reward.boost} seconds`}`}`}</p>
      <button class="go big ready" data-ad ${locked || busy ? 'disabled' : ''}>${icon('video')} ${label}</button>`;
    this.root.querySelector('[data-ad]')!.addEventListener('click', () => void this.watch());

    this.root.querySelector('[data-packs]')!.innerHTML =
      `<p class="shop-note have">${icon('gem')}<span>You have <b>${g.skillPoints}</b> gems. Spend them on skills and treasure boxes.</span></p>` +
      GEM_PACKS.map(
        (p) => `<div class="shop-card product">
        ${tile('gem', '#8a4dff', 44)}
        <div class="shop-txt"><b>${p.gems} gems${p.tag ? `<em class="tag">${p.tag}</em>` : ''}</b><small>For skills and treasure boxes</small></div>
        <button class="go" data-pack="${p.id}" ${busy ? 'disabled' : ''}>${this.prices[p.id] ?? p.price}</button>
      </div>`,
      ).join('');
    this.root.querySelectorAll<HTMLElement>('[data-pack]').forEach((b) => b.addEventListener('click', () => void this.buyPack(b.dataset.pack as GemPackId)));

    this.root.querySelector('[data-products]')!.innerHTML = PRODUCTS.map((p) => {
      const owned = !!g.perks[p.id];
      return `<div class="shop-card product">
        ${tile(p.id === 'x5' ? 'coins' : 'video', p.id === 'x5' ? '#ffb300' : '#2fbf8a', 44)}
        <div class="shop-txt"><b>${p.name}</b><small>${p.text}</small></div>
        <button class="go ${owned ? 'auto' : ''}" data-buy="${p.id}" ${owned || busy ? 'disabled' : ''}>${owned ? `${icon('check')} Owned` : (this.prices[p.id] ?? p.price)}</button>
      </div>`;
    }).join('');
    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => void this.buy(b.dataset.buy as ProductId)));
  }

  private async watch() {
    const g = this.ctx.game.state;
    if (adStreak(g, Date.now()).lockedFor > 0) return;
    const result = await this.ctx.playAd();
    if (result === 'rewarded') {
      const got = claimAdStep(g, Date.now());
      if (got) {
        sound.coin();
        this.ctx.confetti();
        this.ctx.toast('gems' in got ? `+${got.gems} gem${got.gems > 1 ? 's' : ''}!` : `Coins x${BALANCE.boostMult} for ${got.boost} seconds!`);
        this.ctx.game.save();
      }
    } else if (result === 'failed') {
      this.ctx.toast('No ad is ready right now. Try again in a minute.');
    }
    this.ctx.refreshTop();
    this.update();
  }

  private async buy(id: ProductId) {
    if (this.buying) return;
    this.buying = true;
    this.update();
    const result = await buy(id, this.ctx.game.state.perks);
    this.buying = false;
    if (result === 'bought') {
      sound.coin();
      this.ctx.confetti();
      this.ctx.toast(id === 'x5' ? `Coins x${BALANCE.x5Mult} for good!` : 'Ads removed. Rewards come without an ad!');
    } else if (result === 'unavailable') {
      this.ctx.toast('Buying works in the Surf Tycoon phone app.');
    } else if (result === 'failed') {
      this.ctx.toast('The purchase did not go through. You were not charged.');
    }
    this.ctx.refreshTop();
    this.signature = '';
    this.update();
  }

  private async joinClub() {
    if (this.buying) return;
    this.buying = true;
    this.update();
    const result = await buyClub(this.ctx.game.state.perks);
    this.buying = false;
    if (result === 'bought') {
      sound.coin();
      this.ctx.confetti();
      this.ctx.toast(`Welcome to the ${CLUB.name}!`);
    } else if (result === 'unavailable') {
      this.ctx.toast('Buying works in the Surf Tycoon phone app.');
    } else if (result === 'failed') {
      this.ctx.toast('The purchase did not go through. You were not charged.');
    }
    this.ctx.refreshTop();
    this.signature = '';
    this.update();
  }

  private claimClub() {
    const got = claimClubGems(this.ctx.game.state, Date.now());
    if (got > 0) {
      sound.coin();
      this.ctx.toast(`+${got} gems!`);
      this.ctx.game.save();
    }
    this.ctx.refreshTop();
    this.update();
  }

  private async buyPack(id: GemPackId) {
    if (this.buying) return;
    this.buying = true;
    this.update();
    const r = await buyPack(id);
    this.buying = false;
    if (r.result === 'bought') {
      const gems = grantGemPack(this.ctx.game.state, id, r.transactionId);
      this.ctx.game.save(); // save at once: the gems are paid for
      sound.coin();
      this.ctx.confetti();
      this.ctx.toast(`+${gems} gems!`);
    } else if (r.result === 'unavailable') {
      this.ctx.toast('Buying works in the Surf Tycoon phone app.');
    } else if (r.result === 'failed') {
      this.ctx.toast('The purchase did not go through. You were not charged.');
    }
    this.ctx.refreshTop();
    this.signature = '';
    this.update();
  }

  private async restore() {
    if (this.buying) return;
    this.buying = true;
    this.update();
    const found = await restore(this.ctx.game.state.perks);
    this.buying = false;
    this.ctx.toast(found ? 'Your purchases are back.' : 'No purchases found for this account.');
    this.ctx.refreshTop();
    this.signature = '';
    this.update();
  }
}
