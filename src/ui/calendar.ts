// The daily rewards screen: the month's 24 tiles (four weeks of six), today's tile glowing, the claimed ones ticked, the
// star column with the month's fixed skins. One button claims today's tile; a second one doubles it with an ad (with
// Remove ads or the Surf Club it is always doubled). After claiming it counts down to tomorrow. Minimal text.

import type { AdResult } from '../ads';
import { CALENDAR, CALENDAR_TILES, type CalendarReward } from '../config/calendar';
import { skinById, TIERS } from '../config/skins';
import { calendarCoins, calendarSkin, calendarStatus, claimCalendar } from '../core/calendar';
import type { Game } from '../core/game';
import { adFree } from '../core/perks';
import { fmt } from './format';
import { icon, tile } from './icons';
import { boxArt, skinCanvas } from './skins';
import { sound } from './sound';

export interface CalendarContext {
  game: Game;
  close: () => void;
  toast: (text: string) => void;
  confetti: () => void;
  refreshTop: () => void;
  /** Show one rewarded ad (the x2 button). */
  playAd: () => Promise<AdResult>;
  /** True while an ad is on screen. */
  busy: () => boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function clock(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export class CalendarScreen {
  private signature = '';
  private claiming = false;
  /** The tile that was just claimed (it flips). */
  private justClaimed = -1;

  constructor(
    private root: HTMLElement,
    private ctx: CalendarContext,
  ) {}

  show() {
    this.root.className = 'modal menu calendar';
    this.root.scrollTop = 0;
    this.signature = '';
    const now = new Date();
    this.root.innerHTML = `
      <div class="menu-head">
        ${tile('calendar', '#2fbf8a', 46)}
        <div class="menu-title"><h2>Daily rewards</h2><small>${MONTHS[now.getMonth()]}</small></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="cal-grid" data-grid></div>
      <div class="cal-actions" data-actions></div>`;
    this.root.querySelector('[data-close]')!.addEventListener('click', () => this.ctx.close());
    this.update();
  }

  /** What a tile shows: its picture and its amount. */
  private face(r: CalendarReward, now: Date): { pic: string; label: string } {
    const state = this.ctx.game.state;
    switch (r.kind) {
      case 'gems':
        return { pic: `<span class="cal-ic gem">${icon('gem')}</span>`, label: `${r.gems}` };
      case 'boxes':
        return { pic: boxArt('normal', 'cal'), label: `${r.boxes}` };
      case 'coins':
        return { pic: `<span class="cal-ic coin">${icon('coins')}</span>`, label: `${fmt(calendarCoins(state, r.hours))}` };
      case 'boost':
        return { pic: `<span class="cal-x2">x2</span>`, label: `${r.minutes}m` };
      case 'skin':
        return { pic: `<span class="cal-skin" data-skin="${calendarSkin(now, r.week)}"></span>`, label: `${r.pieces}` };
    }
  }

  /** Called often while open: redraws when something changed (and every minute for the countdown). */
  update() {
    if (this.claiming) return;
    const state = this.ctx.game.state;
    const now = new Date();
    const st = calendarStatus(state, now);
    const busy = this.ctx.busy();
    const free = adFree(state.perks);
    const sig = [st.claimed, st.canClaim, busy, free, clock(st.msToTomorrow), state.coins > 0 ? fmt(calendarCoins(state, 1)) : ''].join('|');
    if (sig === this.signature) return;
    this.signature = sig;

    const grid = this.root.querySelector('[data-grid]')!;
    grid.innerHTML = CALENDAR.map((r, i) => {
      const f = this.face(r, now);
      const done = i < st.claimed;
      const today = i === st.claimed && st.canClaim;
      const cls = ['cal-tile', r.kind === 'skin' ? 'star' : '', done ? 'done' : '', today ? 'today' : '', i === this.justClaimed ? 'flip' : ''].join(' ');
      return `<div class="${cls}"><span class="cal-day">${i + 1}</span>${f.pic}<b class="cal-amt">${r.kind === 'skin' ? icon('star') : ''}${f.label}</b>${done ? `<i class="cal-check">${icon('check')}</i>` : ''}</div>`;
    }).join('');
    grid.querySelectorAll<HTMLElement>('[data-skin]').forEach((el) => {
      const skin = skinById(el.dataset.skin!);
      if (skin) el.appendChild(skinCanvas(skin, false, 46));
    });
    this.justClaimed = -1;

    const actions = this.root.querySelector('[data-actions]')!;
    const next = CALENDAR[st.claimed];
    if (st.claimed >= CALENDAR_TILES) {
      actions.innerHTML = `<button class="go big" disabled>${icon('check')}</button>`;
    } else if (!st.canClaim) {
      actions.innerHTML = `<button class="go big" disabled>${icon('clock')} ${clock(st.msToTomorrow)}</button>`;
    } else if (next.kind === 'skin' || free) {
      // skin pieces are never doubled; with Remove ads / the Surf Club every other tile is doubled for free
      actions.innerHTML = `<button class="go big ready" data-claim="${next.kind !== 'skin' && free ? 'x2' : 'one'}" ${busy ? 'disabled' : ''}>${next.kind !== 'skin' && free ? 'Claim x2' : 'Claim'}</button>`;
    } else {
      actions.innerHTML = `<button class="go big" data-claim="one" ${busy ? 'disabled' : ''}>Claim</button>
        <button class="go big ready" data-claim="ad" ${busy ? 'disabled' : ''}>${icon('video')} x2</button>`;
    }
    actions.querySelectorAll<HTMLElement>('[data-claim]').forEach((b) => b.addEventListener('click', () => void this.claim(b.dataset.claim!)));
  }

  private async claim(how: string) {
    if (this.claiming) return;
    let double = how === 'x2';
    if (how === 'ad') {
      this.claiming = true;
      const result = await this.ctx.playAd();
      this.claiming = false;
      if (result === 'failed') this.ctx.toast('No ad is ready right now. Try again in a minute.');
      if (result !== 'rewarded') {
        this.signature = '';
        this.update();
        return;
      }
      double = true;
    }
    const state = this.ctx.game.state;
    const at = calendarStatus(state, new Date()).claimed;
    const got = claimCalendar(state, new Date(), double);
    if (!got) return;
    this.ctx.game.save();
    sound.coin();
    this.ctx.confetti();
    const r = got.reward;
    if (r.kind === 'skin') {
      if (got.pieces === null) this.ctx.toast('Golden treasure box!');
      else if (got.pieces?.newTier) {
        const t = TIERS[got.pieces.newTier - 1];
        this.ctx.toast(got.pieces.newTier === 1 ? `${got.pieces.skin.name}: new skin!` : `${got.pieces.skin.name}: ${t.name} +${t.boost * 100}%!`);
      } else if (got.pieces) this.ctx.toast(`${got.pieces.skin.name} +${got.pieces.after - got.pieces.before}`);
    } else if (r.kind === 'coins' && got.coins) this.ctx.toast(`+${fmt(got.coins)}`);
    this.justClaimed = at;
    this.ctx.refreshTop();
    this.signature = '';
    this.update();
  }
}
