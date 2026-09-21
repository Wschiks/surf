import type { AdResult } from '../ads';
import { BALANCE } from '../config/balance';
import { AD_STEPS, CLUB, GEM_PACKS, PRODUCTS, type AdStep, type GemPackId, type ProductId } from '../config/shop';
import type { Game } from '../core/game';
import { adFree } from '../core/perks';
import { adStreak, claimAdStep, claimClubGems, clubStatus, grantGemPack } from '../core/shop';
import { buy, buyClub, buyPack, canBuy, manageClub, restore, storePrices, type PriceKey } from '../purchases';
import { icon, tile } from './icons';
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

/** The shop dialog: a free ad streak (5 ads a day) and two one-time purchases. It draws itself into `root`. */
export class Shop {
  private prices: Partial<Record<PriceKey, string>> = {};
  private signature = '';
  private buying = false;

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
      <h4>Gems</h4>
      <div data-packs></div>
      <h4>Buy once, keep forever</h4>
      <div data-products></div>
      ${canBuy ? `<button class="go alt big" data-restore>Restore purchases</button>` : `<p class="menu-line">Buying works in the Surf Tycoon phone app.</p>`}
      <button class="go big" data-close2>Back to the beach</button>`;
    this.root.querySelector('[data-close]')!.addEventListener('click', () => this.ctx.close());
    this.root.querySelector('[data-close2]')!.addEventListener('click', () => this.ctx.close());
    this.root.querySelector('[data-restore]')?.addEventListener('click', () => void this.restore());
    this.update();
    void storePrices().then((p) => {
      this.prices = p;
      this.signature = '';
      this.update();
    });
  }

  /** Called about ten times a second while the shop is open: redraws only when something changed. */
  update() {
    const g = this.ctx.game.state;
    const now = Date.now();
    const streak = adStreak(g, now);
    const busy = this.ctx.busy() || this.buying;
    const sig = [streak.step, streak.lockedFor, busy, g.perks.noAds, g.perks.x5, g.perks.club, g.perks.clubUntil, clubStatus(g, now).nextIn, g.skillPoints, Object.values(this.prices).join(',')].join('|');
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
    const label = locked
      ? `Next ads in ${clock(streak.lockedFor)}`
      : busy
        ? 'Loading...'
        : `${adFree(g.perks) ? 'Claim' : 'Watch ad'} ${streak.step + 1} of ${AD_STEPS.length}`;
    this.root.querySelector('[data-streak]')!.innerHTML = `
      <div class="shop-title"><b>Watch 5 ads</b><small>${locked ? 'Done for today' : 'Once a day'}</small></div>
      <div class="steps">${steps}</div>
      <p class="shop-note">${locked ? 'All five rewards are yours. Come back tomorrow.' : `Next: ${'gems' in streak.reward ? `${streak.reward.gems} gem${streak.reward.gems > 1 ? 's' : ''}` : `coins x${BALANCE.boostMult} for ${streak.reward.boost >= 60 ? `${streak.reward.boost / 60} minute` : `${streak.reward.boost} seconds`}`}`}</p>
      <button class="go big ready" data-ad ${locked || busy ? 'disabled' : ''}>${icon('video')} ${label}</button>`;
    this.root.querySelector('[data-ad]')!.addEventListener('click', () => void this.watch());

    this.root.querySelector('[data-packs]')!.innerHTML = `<p class="shop-note have">${icon('gem')}<span>You have <b>${g.skillPoints}</b> gems. Spend them in the skill trees.</span></p>` + GEM_PACKS.map(
      (p) => `<div class="shop-card product">
        ${tile('gem', '#8a4dff', 44)}
        <div class="shop-txt"><b>${p.gems} gems${p.tag ? `<em class="tag">${p.tag}</em>` : ''}</b><small>Skill points for the skill trees</small></div>
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
