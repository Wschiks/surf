import { STATS, STAT_IDS, type StatId } from '../config/balance';
import { FACILITIES } from '../config/facilities';
import { zoneById } from '../config/sports';
import { autoIncomePerSecond, buyFacility, buyManager, buyStat, collectAll, facilityCost, managerCost, statCost, tapZone, waitingZones, zoneStats } from '../core/economy';
import type { Game } from '../core/game';
import type { OfflineReport } from '../core/economy';
import { resetSave } from '../core/save';
import { unlockZone, zoneUnlockStatus } from '../core/unlocks';
import { COIN, fmt, fmtSeconds, fmtTime } from './format';

export interface UICallbacks {
  /** The player selected a zone (or null when the sheet closed). */
  onSelect: (zoneId: string | null) => void;
  onReset: () => void;
  /** Coins were collected from a zone, for a floating number on the map. */
  onCollected: (zoneId: string | null, coins: number) => void;
  /** A level or a whole sport was unlocked. */
  onUnlocked: (zoneId: string, kind: 'sport' | 'level') => void;
}

type Sheet = { kind: 'zone'; id: string } | { kind: 'beach' } | null;

/** The HTML user interface on top of the map: top bar, bottom dock, bottom sheets and pop-ups. */
export class GameUI {
  private root: HTMLElement;
  private sheetEl: HTMLElement;
  private dockEl: HTMLElement;
  private sheet: Sheet = null;
  private lastFull = 0;
  private refs: Record<string, HTMLElement> = {};
  /** Whether the zone sheet that is open was built for an owned zone. */
  private sheetOwned = true;

  constructor(
    parent: HTMLElement,
    private game: Game,
    private cb: UICallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'gameui';
    this.root.innerHTML = `
      <div class="hud">
        <div class="pill coins"><span class="ico">${COIN}</span><b data-ref="coins">0</b><small data-ref="rate">+0/s</small></div>
        <div class="pill rep" title="Reputation"><span class="ico">⭐</span><b data-ref="rep">0</b></div>
        <button class="pill gear" data-ref="gear" aria-label="Menu">⚙️</button>
      </div>
      <div class="dock">
        <button class="dock-btn" data-ref="beach"><span>🏖️</span>Beach</button>
        <button class="dock-btn collect" data-ref="collect"><span>💰</span>Collect all<i data-ref="waiting">0</i></button>
      </div>
      <div class="sheet" data-ref="sheet"></div>
      <div class="toasts" data-ref="toasts"></div>
      <div class="modal-back" data-ref="modal" hidden></div>`;
    parent.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-ref]').forEach((el) => (this.refs[el.dataset.ref!] = el));
    this.sheetEl = this.refs.sheet;
    this.dockEl = this.root.querySelector('.dock')!;
    this.refs.beach.addEventListener('click', () => this.openBeach());
    this.refs.gear.addEventListener('click', () => this.openMenu());
    this.refs.collect.addEventListener('click', () => {
      const got = collectAll(this.game.state);
      if (got > 0) this.cb.onCollected(null, got);
      this.refreshTop();
    });
    if (this.game.offlineReport) this.showOffline(this.game.offlineReport);
  }

  // ------------------------------------------------------------ sheets

  get selectedZone(): string | null {
    return this.sheet?.kind === 'zone' ? this.sheet.id : null;
  }

  openZone(id: string) {
    this.sheet = { kind: 'zone', id };
    this.buildSheet();
    this.cb.onSelect(id);
  }

  openBeach() {
    this.sheet = { kind: 'beach' };
    this.buildSheet();
    this.cb.onSelect(null);
  }

  closeSheet() {
    if (!this.sheet) return;
    this.sheet = null;
    this.sheetEl.classList.remove('open');
    this.dockEl.classList.remove('hidden');
    this.cb.onSelect(null);
  }

  private buildSheet() {
    if (!this.sheet) return;
    this.dockEl.classList.add('hidden');
    if (this.sheet.kind === 'zone') this.buildZoneSheet(this.sheet.id);
    else this.buildBeachSheet();
    this.sheetEl.classList.add('open');
    this.sheetEl.scrollTop = 0;
    this.refreshSheet();
  }

  private buildZoneSheet(id: string) {
    const ref = zoneById(id);
    const owned = this.game.state.zones[id].owned;
    this.sheetOwned = owned;
    const need = zoneUnlockStatus(this.game.state, ref);
    const title = owned || need?.kind !== 'sport' ? ref.def.name : ref.sport.name;
    const sub = owned || need?.kind !== 'sport' ? `${ref.sport.name} · Level ${ref.level}` : 'New sport to unlock';
    const head = `
      <div class="sheet-head">
        <div class="sheet-icon" style="background:${ref.sport.color}">${owned ? ref.sport.icon : '🔒'}</div>
        <div class="sheet-title"><h2>${title}</h2><p>${sub}</p></div>
        <button class="x" data-close aria-label="Close">✕</button>
      </div>
      <div class="facts"><span>👤 ${ref.def.guests}</span><span>🌊 ${ref.def.conditions}</span></div>`;
    this.sheetEl.innerHTML = head + (owned ? this.ownedBody(id) : this.lockedBody(id));
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
    if (!owned) {
      this.sheetEl.querySelector('[data-unlock]')?.addEventListener('click', () => {
        const kind = unlockZone(this.game.state, id);
        if (kind) {
          this.game.save();
          this.cb.onUnlocked(id, kind);
          this.buildSheet();
        }
      });
      return;
    }
    this.sheetEl.querySelector('[data-go]')!.addEventListener('click', () => {
      const s = this.game.state;
      const before = s.coins;
      tapZone(s, id);
      if (s.coins > before) this.cb.onCollected(id, s.coins - before);
      this.refreshTop();
      this.refreshSheet();
    });
    this.sheetEl.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const what = b.dataset.buy!;
        if (what === 'manager') buyManager(this.game.state, id);
        else buyStat(this.game.state, id, what as StatId);
        this.game.save();
        this.refreshTop();
        this.refreshSheet();
      }),
    );
  }

  private ownedBody(id: string): string {
    const ref = zoneById(id);
    const { terms } = ref.sport;
    const rows = STAT_IDS.map(
      (s) => `
      <div class="up" data-stat="${s}">
        <div class="up-ico">${STATS[s].icon}</div>
        <div class="up-txt"><b>${terms[s]}</b><small data-eff></small></div>
        <button class="buy" data-buy="${s}"></button>
      </div>`,
    ).join('');
    return `
      <div data-zone-body>
        <div class="statline">
          <div><b data-s="guests"></b><small>guests</small></div>
          <div><b data-s="each"></b><small>${COIN} each</small></div>
          <div><b data-s="dur"></b><small>per session</small></div>
          <div><b data-s="rate"></b><small>${COIN} per sec</small></div>
        </div>
        <div class="session"><div class="bar"><i data-bar></i></div><button class="go" data-go></button></div>
        <div class="ups">${rows}</div>
        <div class="up mgr" data-mgr>
          <div class="up-ico">🧑‍🏫</div>
          <div class="up-txt"><b>${terms.manager}</b><small>${terms.managerBlurb}</small></div>
          <button class="buy" data-buy="manager"></button>
        </div>
      </div>`;
  }

  private lockedBody(id: string): string {
    const ref = zoneById(id);
    const need = zoneUnlockStatus(this.game.state, ref)!;
    const what = need.kind === 'sport' ? `Start ${ref.sport.name}` : `Unlock ${ref.def.name}`;
    const reqs = need.status.requirements.map((r, i) => `<li data-req="${i}"><span class="tick"></span><span class="rt">${r.text}</span><em></em></li>`).join('');
    return `
      <div class="unlock-card">
        <h3>${what}</h3>
        <p class="get">You get: ${ref.def.starterBuys.join(', ')}</p>
        <p class="blocked" data-blocked hidden></p>
        <ul class="reqs">${reqs}</ul>
        <button class="go" data-unlock></button>
      </div>`;
  }

  private refreshLocked(id: string) {
    const ref = zoneById(id);
    const need = zoneUnlockStatus(this.game.state, ref);
    if (!need) return;
    const st = need.status;
    const blocked = this.sheetEl.querySelector<HTMLElement>('[data-blocked]')!;
    blocked.hidden = !st.blockedBy;
    blocked.textContent = st.blockedBy ?? '';
    st.requirements.forEach((r, i) => {
      const li = this.sheetEl.querySelector<HTMLElement>(`[data-req="${i}"]`);
      if (!li) return;
      li.classList.toggle('met', r.met);
      li.querySelector('.tick')!.textContent = r.met ? '✓' : '○';
      li.querySelector('em')!.textContent = r.progress;
    });
    const btn = this.sheetEl.querySelector<HTMLButtonElement>('[data-unlock]')!;
    const enoughCoins = this.game.state.coins >= st.coins;
    btn.disabled = !st.canBuy;
    btn.className = 'go' + (st.canBuy ? ' ready' : '');
    btn.innerHTML = `${need.kind === 'sport' ? 'Start it' : 'Unlock'} · ${COIN} ${fmt(st.coins)}${st.ready && !enoughCoins ? ' (need more coins)' : ''}`;
  }

  private buildBeachSheet() {
    const rows = FACILITIES.map(
      (f) => `
      <div class="up" data-fac="${f.id}">
        <div class="up-ico">${f.icon}</div>
        <div class="up-txt"><b>${f.name} <em data-lvl></em></b><small>${f.blurb}</small><small data-eff class="eff"></small></div>
        <button class="buy" data-buyfac="${f.id}"></button>
      </div>`,
    ).join('');
    this.sheetEl.innerHTML = `
      <div class="sheet-head">
        <div class="sheet-icon" style="background:#f2c46b">🏖️</div>
        <div class="sheet-title"><h2>Beach facilities</h2><p>Shared buildings that boost every sport</p></div>
        <button class="x" data-close aria-label="Close">✕</button>
      </div>
      <div class="ups">${rows}</div>`;
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
    this.sheetEl.querySelectorAll<HTMLElement>('[data-buyfac]').forEach((b) =>
      b.addEventListener('click', () => {
        buyFacility(this.game.state, b.dataset.buyfac!);
        this.game.save();
        this.refreshTop();
        this.refreshSheet();
      }),
    );
  }

  private setBuy(btn: HTMLElement, cost: number, label = '') {
    const s = this.game.state;
    const maxed = !isFinite(cost);
    btn.classList.toggle('maxed', maxed);
    btn.toggleAttribute('data-afford', !maxed && s.coins >= cost);
    (btn as HTMLButtonElement).disabled = maxed;
    btn.innerHTML = maxed ? 'MAX' : `${label}<span class="cost">${COIN} ${fmt(cost)}</span>`;
  }

  private refreshSheet() {
    if (!this.sheet) return;
    const s = this.game.state;
    if (this.sheet.kind === 'beach') {
      for (const f of FACILITIES) {
        const row = this.sheetEl.querySelector<HTMLElement>(`[data-fac="${f.id}"]`)!;
        const lvl = s.facilities[f.id] ?? 0;
        row.querySelector('[data-lvl]')!.textContent = `Lv ${lvl}/${f.max}`;
        const what = f.effect === 'coins' ? 'coins' : f.effect === 'speed' ? 'speed' : 'reputation';
        row.querySelector('[data-eff]')!.textContent = `+${Math.round(f.perLevel * lvl * 100)}% ${what} now, +${Math.round(f.perLevel * 100)}% per level`;
        this.setBuy(row.querySelector('[data-buyfac]')!, facilityCost(f.id, lvl));
      }
      return;
    }
    const id = this.sheet.id;
    const ref = zoneById(id);
    const z = s.zones[id];
    if (z.owned !== this.sheetOwned) return this.buildSheet();
    if (!z.owned) return this.refreshLocked(id);
    const st = zoneStats(s, ref);
    const q = <T extends HTMLElement>(sel: string) => this.sheetEl.querySelector<T>(sel)!;
    q('[data-s="guests"]').textContent = String(st.guests);
    q('[data-s="each"]').textContent = fmt(st.pricePerGuest);
    q('[data-s="dur"]').textContent = fmtSeconds(st.duration);
    q('[data-s="rate"]').textContent = fmt(st.perSecond);
    const bar = q('[data-bar]');
    const go = q<HTMLButtonElement>('[data-go]');
    if (z.phase === 'running') bar.style.width = Math.min(100, (z.elapsed / st.duration) * 100) + '%';
    else bar.style.width = z.phase === 'ready' ? '100%' : '0%';
    if (z.manager) {
      go.innerHTML = 'Running by itself ✓';
      go.disabled = true;
      go.className = 'go auto';
    } else if (z.phase === 'ready') {
      go.innerHTML = `Collect ${COIN} ${fmt(z.pending)} and go again`;
      go.disabled = false;
      go.className = 'go ready';
    } else if (z.phase === 'idle') {
      go.innerHTML = '▶ Start a session';
      go.disabled = false;
      go.className = 'go';
    } else {
      go.innerHTML = 'Session running…';
      go.disabled = true;
      go.className = 'go';
    }
    for (const stat of STAT_IDS) {
      const row = q(`[data-stat="${stat}"]`);
      const lvl = z[stat];
      const next = zoneStats(s, ref, { ...z, [stat]: lvl + 1 });
      const maxed = lvl >= STATS[stat].max;
      let eff = '';
      if (stat === 'capacity') eff = maxed ? `${st.guests} guests (max)` : `${st.guests} → ${next.guests} guests`;
      if (stat === 'price') eff = maxed ? `${COIN} ${fmt(st.pricePerGuest)} each (max)` : `${COIN} ${fmt(st.pricePerGuest)} → ${fmt(next.pricePerGuest)} each`;
      if (stat === 'speed') eff = maxed ? `${fmtSeconds(st.duration)} (max)` : `${fmtSeconds(st.duration)} → ${fmtSeconds(next.duration)} per session`;
      row.querySelector('[data-eff]')!.innerHTML = `Lv ${lvl} · ${eff}`;
      this.setBuy(row.querySelector('[data-buy]')!, statCost(ref, stat, lvl));
    }
    const mgrBtn = q('[data-buy="manager"]');
    if (z.manager) {
      mgrBtn.classList.add('maxed');
      (mgrBtn as HTMLButtonElement).disabled = true;
      mgrBtn.textContent = 'Hired ✓';
    } else {
      this.setBuy(mgrBtn, managerCost(ref), 'Hire ');
    }
  }

  // ------------------------------------------------------------ top bar

  private refreshTop() {
    const s = this.game.state;
    this.refs.coins.textContent = fmt(s.coins);
    this.refs.rate.textContent = `+${fmt(autoIncomePerSecond(s))}/s`;
    this.refs.rep.textContent = fmt(Math.floor(s.reputation));
    const waiting = waitingZones(s).length;
    this.refs.waiting.textContent = String(waiting);
    this.refs.collect.classList.toggle('pulse', waiting > 0);
    this.refs.collect.toggleAttribute('data-empty', waiting === 0);
  }

  /** Call every frame. Cheap: the heavier refresh only runs about ten times a second. */
  update(nowMs: number) {
    if (nowMs - this.lastFull < 100) return;
    this.lastFull = nowMs;
    this.refreshTop();
    this.refreshSheet();
    if (this.game.offlineReport) this.showOffline(this.game.offlineReport);
  }

  // ------------------------------------------------------------ pop-ups

  toast(text: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    this.refs.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  private modal(html: string) {
    const m = this.refs.modal;
    m.innerHTML = `<div class="modal">${html}</div>`;
    m.hidden = false;
    return m;
  }

  private closeModal() {
    this.refs.modal.hidden = true;
    this.refs.modal.innerHTML = '';
  }

  showOffline(rep: OfflineReport) {
    this.game.offlineReport = null;
    const lines = [`You were away for <b>${fmtTime(rep.away)}</b>.`];
    if (rep.coins > 0) lines.push(`Your managers earned <b>${COIN} ${fmt(rep.coins)}</b>${rep.reputation >= 1 ? ` and <b>⭐ ${fmt(Math.floor(rep.reputation))}</b>` : ''}.`);
    if (rep.capped) lines.push(`<small>Offline earnings stop after ${fmtTime(rep.seconds)}.</small>`);
    if (rep.waiting > 0) lines.push(`${rep.waiting} zone${rep.waiting > 1 ? 's are' : ' is'} waiting for you. Hire a manager to keep them running while you are away.`);
    const m = this.modal(`<h2>Welcome back!</h2><p>${lines.join('</p><p>')}</p><button class="go big" data-ok>Nice</button>`);
    m.querySelector('[data-ok]')!.addEventListener('click', () => this.closeModal());
  }

  private openMenu() {
    const s = this.game.state;
    const m = this.modal(`
      <h2>Surf Tycoon</h2>
      <p>Coins earned in total: <b>${COIN} ${fmt(s.totalCoins)}</b></p>
      <p>Playing since <b>${new Date(s.startedAt).toLocaleDateString()}</b></p>
      <button class="go big" data-ok>Back to the beach</button>
      <button class="danger" data-reset>Start over (erases your save)</button>`);
    m.querySelector('[data-ok]')!.addEventListener('click', () => this.closeModal());
    m.querySelector('[data-reset]')!.addEventListener('click', () => {
      if (confirm('Erase your progress and start over?')) {
        resetSave();
        this.cb.onReset();
      }
    });
  }
}
