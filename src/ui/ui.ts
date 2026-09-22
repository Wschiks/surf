import { STATS, STAT_IDS, type StatId } from '../config/balance';
import { FACILITIES } from '../config/facilities';
import { SPORTS, sportById, zoneById, zoneId } from '../config/sports';
import { adsNative, showRewardedAd, type AdResult } from '../ads';
import { BALANCE } from '../config/balance';
import { autoIncomePerSecond, startBoost, buyFacility, buyManager, buyStat, costOf, discounts, facilityCost, managerCost, planBuy, statCost, tapZone, zoneStats, type BuyMode } from '../core/economy';
import { milestoneMult, nextMilestone } from '../config/balance';
import type { Game } from '../core/game';
import type { OfflineReport } from '../core/economy';
import { hasAffordableSkill, skillEffects } from '../core/skills';
import { canExpand, expand, expansionNeededFor, expansionStatus, nextUnlockableSport, unlockZone, zoneUnlockStatus } from '../core/unlocks';
import { EXPANSION_MULT } from '../config/expansions';
import { EXPANSION_POINTS } from '../config/skills';
import { claimQuest, questView, QUEST_SLOTS } from '../core/quests';
import { COIN, fmt, fmtSeconds, fmtTime } from './format';
import { icon, tile } from './icons';
import { Menu } from './menu';
import { Shop } from './shop';
import { adStreak } from '../core/shop';
import { adFree } from '../core/perks';
import { CLUB } from '../config/shop';
import { SkillScreen } from './skills';
import type { TreeId } from '../config/skills';
import { sound } from './sound';

export interface UICallbacks {
  /** The player selected a zone (or null when the sheet closed). */
  onSelect: (zoneId: string | null) => void;
  /** The beach sheet opened: show the beach. */
  onFocusBeach: () => void;
  onReset: () => void;
  /** A save code was restored: stop saving and reload. */
  onRestored: () => void;
  /** Coins were collected from a zone, for a floating number on the map. */
  onCollected: (zoneId: string | null, coins: number) => void;
  /** A level or a whole sport was unlocked. */
  onUnlocked: (zoneId: string, kind: 'level' | 'sport') => void;
  /** A beach expansion was bought at the height of the big wave: the beach starts over. */
  onExpanded: () => void;
}

/** Set the HTML of an element only when it changed, so a button is not rebuilt while it is being pressed. */
function setHtml(el: HTMLElement, html: string) {
  if (el.dataset.h !== html) {
    el.innerHTML = html;
    el.dataset.h = html;
  }
}

type Sheet = { kind: 'zone'; id: string } | { kind: 'beach' } | { kind: 'sports' } | { kind: 'expand' } | null;

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
  /** The full-screen layer (the map's overlay): confetti, the big wave and the skill screen live here. */
  private host!: HTMLElement;
  private skillScreen!: SkillScreen;
  /** How many levels one tap on a buy button buys. */
  private buyMode: BuyMode = 1;

  constructor(
    parent: HTMLElement,
    private game: Game,
    private cb: UICallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'gameui';
    this.root.innerHTML = `
      <div class="col">
      <div class="hud">
        <div class="pill coins"><span class="ico">${COIN}</span><b data-ref="coins">0</b><small data-ref="rate">+0/s</small><em class="mult" data-ref="mult" hidden></em></div>
        <button class="pill gems" data-ref="gembtn" aria-label="Skill points"><span class="ico">${icon('gem')}</span><b data-ref="gems">0</b></button>
        <button class="pill shopbtn" data-ref="shop" aria-label="Shop">${icon('bag')}<i class="dot" data-ref="shopdot" hidden></i></button>
        <button class="pill gear" data-ref="gear" aria-label="Menu">${icon('gear')}</button>
      </div>
      <div class="quests" data-ref="quests">
        <div class="q-list" data-ref="qlist">${Array.from({ length: QUEST_SLOTS }, (_, i) => `<div class="q-row" data-q="${i}"><div class="q-body"><span class="q-t"></span><i class="q-bar"><b></b></i><small class="q-n"></small></div><button class="q-claim"></button></div>`).join('')}</div>
      </div>
      <button class="tip" data-ref="tip" hidden></button>
      <div class="dock">
        <button class="dock-btn" data-ref="beach">${icon('beach')}<em>Beach</em></button>
        <button class="dock-btn" data-ref="sports">${icon('sports')}<em>Sports</em></button>
        <button class="dock-btn dock-skills gone" data-ref="skills">${icon('tree')}<em>Skills</em></button>
        <div class="dock-slot">
          <button class="boost" data-ref="boost">${icon('video')}<span><b data-ref="boostA">Watch ad</b><small data-ref="boostB">x${BALANCE.boostMult} coins</small></span><i class="boost-bar"><u data-ref="boostBar"></u></i></button>
          <button class="dock-btn expand" data-ref="expand">${icon('expand')}<em>Expand</em></button>
        </div>
      </div>
      <div class="sheet" data-ref="sheet"></div>
      <div class="toasts" data-ref="toasts"></div>
      <div class="coach" data-ref="coach" hidden><i class="coach-ring" data-ref="coachRing"></i><b class="coach-bubble" data-ref="coachBubble"></b></div>
      </div>
      <div class="modal-back" data-ref="modal" hidden></div>`;
    parent.appendChild(this.root);
    this.host = parent;
    this.skillScreen = new SkillScreen(parent, { game: this.game, close: () => this.skillScreen.close(), toast: () => {}, refreshTop: () => this.refreshTop() });
    this.root.querySelectorAll<HTMLElement>('[data-ref]').forEach((el) => (this.refs[el.dataset.ref!] = el));
    this.sheetEl = this.refs.sheet;
    this.dockEl = this.root.querySelector('.dock')!;
    this.refs.beach.addEventListener('click', () => this.openBeach());
    this.refs.sports.addEventListener('click', () => this.openSports());
    this.refs.skills.addEventListener('click', () => this.openSkills());
    this.refs.gembtn.addEventListener('click', () => this.openSkills());
    this.refs.gear.addEventListener('click', () => this.openMenu());
    this.refs.shop.addEventListener('click', () => this.openShop());
    this.refs.expand.addEventListener('click', () => this.openExpand());
    this.refs.boost.addEventListener('click', () => void this.watchAd());
    this.refs.tip.addEventListener('click', () => {
      const kind = this.refs.tip.dataset.kind;
      this.openZone('wave-1');
      if (kind === 'manager') setTimeout(() => this.sheetEl.scrollTo({ top: this.sheetEl.scrollHeight, behavior: 'smooth' }), 400);
    });
    // tapping the dark area around a dialog closes it
    this.refs.modal.addEventListener('click', (e) => {
      if (e.target === this.refs.modal) this.closeModal();
    });
    this.refs.qlist.querySelectorAll<HTMLElement>('.q-claim').forEach((b, i) =>
      b.addEventListener('click', () => {
        const got = claimQuest(this.game.state, i);
        if (got > 0) {
          sound.coin();
          this.game.save();
          this.cb.onCollected(null, got);
        }
        this.refreshTop();
      }),
    );
    if (this.game.offlineReport) this.showOffline(this.game.offlineReport);
  }

  // ------------------------------------------------------------ sheets

  get isSheetOpen(): boolean {
    return this.sheet !== null;
  }

  get selectedZone(): string | null {
    return this.sheet?.kind === 'zone' ? this.sheet.id : null;
  }

  openZone(id: string) {
    if (this.game.state.zones[id]?.owned) this.game.state.tips.upgrade = true; // the player found the zone panel
    this.sheet = { kind: 'zone', id };
    this.buildSheet();
    this.cb.onSelect(id);
  }

  openBeach() {
    this.sheet = { kind: 'beach' };
    this.buildSheet();
    this.cb.onSelect(null);
    this.cb.onFocusBeach();
  }

  openSkills(tree: TreeId | 'hub' = 'hub') {
    this.closeSheet();
    this.skillScreen.open(tree);
  }

  openExpand() {
    this.sheet = { kind: 'expand' };
    this.buildSheet();
    this.cb.onSelect(null);
  }

  openSports() {
    this.sheet = { kind: 'sports' };
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
    else if (this.sheet.kind === 'sports') this.buildSportsSheet();
    else if (this.sheet.kind === 'expand') this.buildExpandSheet();
    else this.buildBeachSheet();
    this.sheetEl.classList.add('open');
    this.sheetEl.scrollTop = 0;
    this.refreshSheet();
  }

  private buildZoneSheet(id: string) {
    const ref = zoneById(id);
    const owned = this.game.state.zones[id].owned;
    this.sheetOwned = owned;
    const title = ref.def.name;
    const sub = `${ref.sport.name} · Level ${ref.level}`;
    const head = `
      <div class="sheet-head">
        ${tile(owned ? ref.sport.icon : 'lock', owned ? ref.sport.color : '#7d92a3', 48)}
        <div class="sheet-title"><h2>${title}</h2><p>${sub}</p></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>`;
    this.sheetEl.innerHTML = head + (owned ? this.ownedBody(id) : this.lockedBody(id));
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
    if (!owned) {
      this.sheetEl.querySelector('[data-tobeach]')?.addEventListener('click', () => this.openBeach());
      this.sheetEl.querySelector('[data-unlock]')?.addEventListener('click', () => {
        const kind = unlockZone(this.game.state, id);
        if (kind) {
          sound.unlock();
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
      if (s.coins > before) {
        this.cb.onCollected(id, s.coins - before);
        sound.coin();
      } else sound.tap();
      this.refreshTop();
      this.refreshSheet();
    });
    this.sheetEl.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        const m = b.dataset.mode!;
        this.buyMode = m === 'max' ? 'max' : Number(m);
        this.sheetEl.querySelectorAll<HTMLElement>('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
        sound.tap();
        this.refreshSheet();
      }),
    );
    this.sheetEl.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => {
      const what = b.dataset.buy!;
      // holding a level up, bigger class or faster button keeps buying, faster and faster
      this.bindBuy(b, what !== 'manager', () => (what === 'manager' ? buyManager(this.game.state, id) : buyStat(this.game.state, id, what as StatId, this.buyMode)));
    });
  }

  /**
   * A buy button. A tap buys once. When `hold` is true, holding the button keeps buying, and the longer it is held
   * the faster it goes. The game is saved when the button is let go.
   */
  private bindBuy(btn: HTMLElement, hold: boolean, act: () => boolean) {
    let timer = 0;
    let delay = 0;
    let lastSound = 0;
    const once = () => {
      if (act()) {
        const now = performance.now();
        if (now - lastSound > 90) {
          sound.buy();
          lastSound = now;
        }
      }
      this.refreshTop();
      this.refreshSheet();
    };
    let heldSince = 0;
    const loop = () => {
      // the longer it is held, the faster it goes: quicker ticks first, then several levels per tick
      const burst = 1 + Math.floor((performance.now() - heldSince) / 600);
      for (let i = 0; i < burst; i++) once();
      delay = Math.max(25, delay * 0.8);
      timer = window.setTimeout(loop, delay);
    };
    const stop = () => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
        this.game.save();
      }
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // capture is optional
      }
      once();
      this.game.save();
      if (hold) {
        heldSince = performance.now();
        delay = 300;
        timer = window.setTimeout(loop, delay);
      }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, stop);
    btn.addEventListener('click', (e) => {
      if (e.detail === 0) once(); // keyboard
    });
  }

  private ownedBody(id: string): string {
    const ref = zoneById(id);
    const { terms } = ref.sport;
    const rows = STAT_IDS.map(
      (s) => `
      <div class="up" data-stat="${s}">
        <div class="up-ico">${icon(STATS[s].icon)}</div>
        <div class="up-txt"><b>${terms[s]}</b><small data-eff></small>${s === 'price' ? '<small data-ms class="ms"></small>' : ''}</div>
        <button class="buy" data-buy="${s}"></button>
      </div>`,
    ).join('');
    const modes = ([1, 10, 100, 'max'] as BuyMode[]).map((m) => `<button data-mode="${m}"${m === this.buyMode ? ' class="on"' : ''}>${m === 'max' ? 'Max' : 'x' + m}</button>`).join('');
    return `
      <div data-zone-body>
        <div class="statline">
          <div><b data-s="guests"></b><small>guests</small></div>
          <div><b data-s="each"></b><small>${COIN} each</small></div>
          <div><b data-s="dur"></b><small>per session</small></div>
          <div><b data-s="rate"></b><small>${COIN} per sec</small></div>
        </div>
        <div class="session"><div class="bar"><i data-bar></i></div><button class="go" data-go></button></div>
        <div class="modes" data-modes><span>Buy</span>${modes}</div>
        <div class="ups">${rows}</div>
        <div class="up mgr" data-mgr>
          <div class="up-ico">${icon('manager')}</div>
          <div class="up-txt"><b>${terms.manager}</b><small>${terms.managerBlurb}</small></div>
          <button class="buy" data-buy="manager"></button>
        </div>
      </div>`;
  }

  private lockedBody(id: string): string {
    const ref = zoneById(id);
    const need = zoneUnlockStatus(this.game.state, ref)!;
    if (need.kind === 'closed') {
      return `
      <div class="unlock-card">
        <h3>Not open yet</h3>
        <p class="get">${need.status.blockedBy}. You start over on a bigger beach and all income is ${EXPANSION_MULT} times higher.</p>
        <button class="go" data-tobeach>${icon('beach')} Go to the beach</button>
      </div>`;
    }
    const reqs = need.status.requirements.map((r, i) => `<li data-req="${i}"><span class="tick"></span><span class="rt">${r.text}</span><em></em></li>`).join('');
    return `
      <div class="unlock-card">
        <h3>${need.kind === 'sport' ? `Start ${ref.sport.name}` : `Unlock ${ref.def.name}`}</h3>
        <p class="get">You get: ${ref.def.starterBuys.join(', ')}</p>
        <p class="blocked" data-blocked hidden></p>
        <ul class="reqs">${reqs}</ul>
        <button class="go" data-unlock></button>
      </div>`;
  }

  private refreshLocked(id: string) {
    const ref = zoneById(id);
    const need = zoneUnlockStatus(this.game.state, ref);
    if (!need || need.kind === 'closed') return;
    const st = need.status;
    const blocked = this.sheetEl.querySelector<HTMLElement>('[data-blocked]')!;
    blocked.hidden = !st.blockedBy;
    blocked.textContent = st.blockedBy ?? '';
    st.requirements.forEach((r, i) => {
      const li = this.sheetEl.querySelector<HTMLElement>(`[data-req="${i}"]`);
      if (!li) return;
      li.classList.toggle('met', r.met);
      setHtml(li.querySelector('.tick') as HTMLElement, r.met ? icon('check') : '');
      li.querySelector('em')!.textContent = r.progress;
    });
    const btn = this.sheetEl.querySelector<HTMLButtonElement>('[data-unlock]')!;
    const enoughCoins = this.game.state.coins >= st.coins;
    btn.disabled = !st.canBuy;
    btn.className = 'go' + (st.canBuy ? ' ready' : '');
    setHtml(btn, `${need.kind === 'sport' ? 'Start it' : 'Unlock'} · ${COIN} ${fmt(st.coins)}${st.ready && !enoughCoins ? ' (need more coins)' : ''}`);
  }

  private buildSportsSheet() {
    const rows = SPORTS.map((sp) => {
        const pips = sp.levels.map((_, i) => `<button class="pip" data-zone="${zoneId(sp.id, i + 1)}" aria-label="Level ${i + 1}">${i + 1}</button>`).join('');
        return `
        <div class="sport-row" data-sport="${sp.id}">
          ${tile(sp.icon, sp.color, 46)}
          <div class="sport-mid"><b>${sp.name}</b><small data-info></small><div class="pips">${pips}</div></div>
        </div>`;
      }).join('');
    this.sheetEl.innerHTML = `
      <div class="sheet-head">
        ${tile('sports', '#1497b5', 48)}
        <div class="sheet-title"><h2>Water sports</h2><p>Tap a level to go there</p></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="sports">${rows}</div>`;
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
    this.sheetEl.querySelectorAll<HTMLElement>('[data-zone]').forEach((b) => b.addEventListener('click', () => this.openZone(b.dataset.zone!)));
  }

  private refreshSports() {
    const s = this.game.state;
    for (const sp of SPORTS) {
      const row = this.sheetEl.querySelector<HTMLElement>(`[data-sport="${sp.id}"]`);
      if (!row) continue;
      const unlocked = s.sports[sp.id];
      const owned = sp.levels.filter((_, i) => s.zones[zoneId(sp.id, i + 1)].owned).length;
      let info: string;
      if (unlocked) info = `${sp.area[0].toUpperCase()}${sp.area.slice(1)} area · ${owned} of ${sp.levels.length} levels`;
      else {
        const exp = expansionNeededFor(s, sp.id);
        info = exp !== null ? `Locked · opens with beach expansion ${exp}` : `Locked · needs Level ${sp.unlock?.level} of ${sportById(sp.unlock!.after).name}`;
      }
      row.classList.toggle('locked', !unlocked);
      row.querySelector('[data-info]')!.textContent = info;
      row.querySelectorAll<HTMLElement>('.pip').forEach((pip, i) => pip.classList.toggle('owned', s.zones[zoneId(sp.id, i + 1)].owned));
    }
  }

  private buildBeachSheet() {
    const rows = FACILITIES.map(
      (f) => `
      <div class="up" data-fac="${f.id}">
        <div class="up-ico">${icon(f.icon)}</div>
        <div class="up-txt"><b>${f.name} <em data-lvl></em></b><small>${f.blurb}</small><small data-eff class="eff"></small></div>
        <button class="buy" data-buyfac="${f.id}"></button>
      </div>`,
    ).join('');
    this.sheetEl.innerHTML = `
      <div class="sheet-head">
        ${tile('beach', '#e9a13a', 48)}
        <div class="sheet-title"><h2>Beach facilities</h2><p>Shared buildings that boost every sport</p></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="ups">${rows}</div>`;
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
    this.sheetEl.querySelectorAll<HTMLElement>('[data-buyfac]').forEach((b) => this.bindBuy(b, true, () => buyFacility(this.game.state, b.dataset.buyfac!)));
  }

  private buildExpandSheet() {
    this.sheetEl.innerHTML = `
      <div class="sheet-head">
        ${tile('expand', '#ff6a3d', 48)}
        <div class="sheet-title"><h2>Expand the beach</h2><p>Open a new area, income goes up for good</p></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="expand-card" data-expand></div>`;
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
  }

  /** The beach expansion card in the expand sheet. */
  private refreshExpansion() {
    const card = this.sheetEl.querySelector<HTMLElement>('[data-expand]');
    if (!card) return;
    const s = this.game.state;
    const st = expansionStatus(s);
    if (!st) {
      const html = `<h3>${icon('trophy')} Fully expanded</h3><p class="get">The whole map is open. All income is x${Math.pow(EXPANSION_MULT, s.expansions)}.</p>`;
      if (card.dataset.h !== html) {
        card.innerHTML = html;
        card.dataset.h = html;
      }
      return;
    }
    if (!card.querySelector('[data-xbtn]')) {
      card.innerHTML = `
        <h3>${icon('beach')} ${st.def.name} ${st.def.n}</h3>
        <p class="get">${st.def.blurb}</p>
        <p class="get">All income x${EXPANSION_MULT}. A big wave washes over the beach and you start over, faster than before. Your skills stay.</p>
        <ul class="reqs">${st.requirements.map((r, i) => `<li data-xreq="${i}"><span class="tick"></span><span class="rt">${r.text}</span><em></em></li>`).join('')}</ul>
        <button class="go" data-xbtn></button>`;
      card.querySelector('[data-xbtn]')!.addEventListener('click', () => this.startExpansion());
    }
    st.requirements.forEach((r, i) => {
      const li = card.querySelector<HTMLElement>(`[data-xreq="${i}"]`);
      if (!li) return;
      li.classList.toggle('met', r.met);
      setHtml(li.querySelector('.tick') as HTMLElement, r.met ? icon('check') : '');
      li.querySelector('em')!.textContent = r.progress;
    });
    const btn = card.querySelector<HTMLButtonElement>('[data-xbtn]')!;
    const can = canExpand(s);
    btn.disabled = !can;
    btn.className = 'go' + (can ? ' ready' : '');
    setHtml(btn, `Expand · ${COIN} ${fmt(st.coins)}`);
  }

  /** Buy the expansion: the big wave sweeps over the screen and, while everything is hidden, the beach starts over. */
  private startExpansion() {
    if (!canExpand(this.game.state) || document.querySelector('.tsunami')) return;
    sound.unlock();
    const box = document.createElement('div');
    box.className = 'tsunami';
    box.innerHTML = `
      <div class="ts-body">
        <svg class="ts-top" viewBox="0 0 400 80" preserveAspectRatio="none"><path d="M0 80V40c30-30 60-30 100-10s70 30 100 0 70-30 100-5 70 25 100-5v60z" fill="#e9fbff"/><path d="M0 80V52c30-20 60-20 100-4s70 22 100 2 70-22 100-3 70 18 100-3v36z" fill="#3fc3df"/></svg>
        <div class="ts-fill"></div>
<svg class="ts-crest" viewBox="0 0 400 170" preserveAspectRatio="none">
          <path d="M0 0V112c30 20 60 32 100 16s70-30 100-10 70 34 100 14 70-22 100-6V0z" fill="#4fb6dc"/>
          <path d="M0 78c30 25 55 38 95 22s65-34 105-14 68 32 105 12 65-22 95-8V0H0z" fill="#1a7fb8"/>
          <path d="M0 78c30 25 55 38 95 22s65-34 105-14 68 32 105 12 65-22 95-8" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
          <path d="M0 92c30 25 55 38 95 22s65-34 105-14 68 32 105 12 65-22 95-8" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-linecap="round"/>
          <circle cx="60" cy="112" r="4" fill="#fff"/><circle cx="150" cy="96" r="3" fill="#fff"/><circle cx="250" cy="106" r="4.5" fill="#fff"/><circle cx="340" cy="88" r="3" fill="#fff"/><circle cx="205" cy="118" r="2.5" fill="#fff"/>
        </svg>
      </div>
      <div class="ts-title">${icon('beach')}<b>${expansionStatus(this.game.state)!.def.name} ${expansionStatus(this.game.state)!.def.n}</b></div>`;
    this.host.appendChild(box);
    this.closeSheet();
    setTimeout(() => {
      expand(this.game.state);
      this.game.save();
      this.cb.onExpanded();
      this.refreshTop();
    }, 1500);
    setTimeout(() => {
      this.confetti();
      this.toast(`Income x${Math.pow(EXPANSION_MULT, this.game.state.expansions)}. New area open! +${EXPANSION_POINTS[this.game.state.expansions] ?? 0} skill points`);
    }, 2500);
    setTimeout(() => box.remove(), 3400);
  }

  private setBuy(btn: HTMLElement, cost: number, label = '') {
    const s = this.game.state;
    const maxed = !isFinite(cost);
    btn.classList.toggle('maxed', maxed);
    btn.toggleAttribute('data-afford', !maxed && s.coins >= cost);
    (btn as HTMLButtonElement).disabled = maxed;
    setHtml(btn, maxed ? 'MAX' : `${label}<span class="cost">${COIN} ${fmt(cost)}</span>`);
  }

  /** The buy button of a stat: shows how many levels a tap buys and the price. */
  private setStatBuy(btn: HTMLElement, maxed: boolean, affordable: boolean, count: number, cost: number) {
    if (maxed) return this.setBuy(btn, Infinity);
    btn.classList.remove('maxed');
    btn.toggleAttribute('data-afford', affordable);
    (btn as HTMLButtonElement).disabled = false;
    setHtml(btn, `${count > 1 ? `<span class="plus">+${count}</span>` : ''}<span class="cost">${COIN} ${fmt(cost)}</span>`);
  }

  private refreshSheet() {
    if (!this.sheet) return;
    const s = this.game.state;
    if (this.sheet.kind === 'sports') return this.refreshSports();
    if (this.sheet.kind === 'expand') return this.refreshExpansion();
    if (this.sheet.kind === 'beach') {
      for (const f of FACILITIES) {
        const row = this.sheetEl.querySelector<HTMLElement>(`[data-fac="${f.id}"]`)!;
        const lvl = s.facilities[f.id] ?? 0;
        row.querySelector('[data-lvl]')!.textContent = `Lv ${lvl}/${f.max}`;
        const what = f.effect === 'coins' ? 'coins' : 'speed';
        row.querySelector('[data-eff]')!.textContent = `+${Math.round(f.perLevel * lvl * 100)}% ${what} now, +${Math.round(f.perLevel * 100)}% per level`;
        this.setBuy(row.querySelector('[data-buyfac]')!, facilityCost(f.id, lvl, skillEffects(s).facilityCost));
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
      setHtml(go, `${icon('check')} Runs by itself`);
      go.disabled = true;
      go.className = 'go auto';
    } else if (z.phase === 'ready') {
      setHtml(go, `Collect ${COIN} ${fmt(z.pending)} and go again`);
      go.disabled = false;
      go.className = 'go ready';
    } else if (z.phase === 'idle') {
      setHtml(go, `${icon('play')} Start a session`);
      go.disabled = false;
      go.className = 'go';
    } else {
      setHtml(go, 'Session running…');
      go.disabled = true;
      go.className = 'go';
    }
    for (const stat of STAT_IDS) {
      const row = q(`[data-stat="${stat}"]`);
      const lvl = z[stat];
      const disc = discounts(s, ref.sport.id);
      const plan = planBuy(ref, stat, lvl, s.coins, this.buyMode, disc.stat(stat));
      // when the coins are not there yet, still show what the chosen amount would cost
      const want = this.buyMode === 'max' ? 1 : Math.min(this.buyMode, STATS[stat].max - lvl);
      const shown = plan.count > 0 ? plan.count : Math.max(1, want);
      const after = lvl + shown;
      const next = zoneStats(s, ref, { ...z, [stat]: after });
      const maxed = lvl >= STATS[stat].max;
      let eff = '';
      if (stat === 'capacity') eff = maxed ? `${st.guests} guests (max)` : `${st.guests} → ${next.guests} guests`;
      if (stat === 'price') eff = maxed ? `${COIN} ${fmt(st.pricePerGuest)} each (max)` : `${COIN} ${fmt(st.pricePerGuest)} → ${fmt(next.pricePerGuest)} each`;
      if (stat === 'speed') eff = maxed ? `${fmtSeconds(st.duration)} (max)` : `${fmtSeconds(st.duration)} → ${fmtSeconds(next.duration)} per session`;
      setHtml(row.querySelector('[data-eff]')!, `Lv ${lvl} · ${eff}`);
      if (stat === 'price') {
        const nm = nextMilestone(lvl);
        setHtml(row.querySelector('[data-ms]')!, `${icon('star', '12px')} Bonus x${fmt(milestoneMult(lvl))} · next x${nm.mult} at level ${nm.level}`);
      }
      this.setStatBuy(row.querySelector('[data-buy]')!, lvl >= STATS[stat].max, plan.count > 0, shown, plan.count > 0 ? plan.cost : costOf(ref, stat, lvl, shown, disc.stat(stat)));
    }
    const mgrBtn = q('[data-buy="manager"]');
    if (z.manager) {
      mgrBtn.classList.add('maxed');
      (mgrBtn as HTMLButtonElement).disabled = true;
      setHtml(mgrBtn, `${icon('check')} Hired`);
    } else {
      this.setBuy(mgrBtn, managerCost(ref, discounts(s, ref.sport.id).manager), 'Hire ');
    }
  }

  // ------------------------------------------------------------ top bar

  private refreshTop() {
    const s = this.game.state;
    this.refs.coins.textContent = fmt(s.coins);
    this.refs.rate.textContent = `+${fmt(autoIncomePerSecond(s))}/s`;
    this.refs.gems.textContent = String(s.skillPoints);
    const canSeeSkills = s.skillEarned > 0;
    this.refs.skills.classList.toggle('gone', !canSeeSkills);
    this.refs.skills.classList.toggle('pulse', canSeeSkills && hasAffordableSkill(s));
    const perm = Math.pow(EXPANSION_MULT, s.expansions) * (s.perks.x5 ? BALANCE.x5Mult : 1) * (s.perks.club ? CLUB.coinMult : 1);
    this.refs.mult.hidden = perm === 1;
    this.refs.mult.textContent = `x${perm}`;
    this.refreshTip();
    this.refreshBoost();
    this.refs.shopdot.hidden = adStreak(s, Date.now()).lockedFor > 0;
    this.refs.expand.classList.toggle('ready', canExpand(s));
    this.refs.expand.classList.toggle('pulse', canExpand(s));
    this.refreshQuests();
    this.refreshCoach();
  }

  // ------------------------------------------------------------ tutorial coach marks

  /** Which early-game hint is on screen right now, if any: the whole screen dims and only that one button stays lit. */
  private coachKind: 'hire' | 'skills' | 'sports' | 'beach' | 'expand' | null = null;

  private refreshCoach() {
    if (this.sheet || this.skillScreen.isOpen || !this.refs.modal.hidden) return this.hideCoach();
    if (!this.coachKind) {
      const next = this.nextCoachStep();
      if (next) this.showCoach(next);
    }
    if (this.coachKind) this.positionCoach();
  }

  /** The next milestone to point at, in the order a new player reaches them. Each is shown once, ever. */
  private nextCoachStep(): { kind: 'hire' | 'skills' | 'sports' | 'beach' | 'expand'; el: HTMLElement; text: string } | null {
    const s = this.game.state;
    const wref = zoneById('wave-1');
    const wz = s.zones['wave-1'];
    const upgrades = wz.price + wz.capacity + wz.speed;
    if (!s.tips.hire && s.expansions === 0 && wz.owned && upgrades >= 3 && !wz.manager && s.coins >= managerCost(wref, discounts(s, 'wave').manager)) {
      return { kind: 'hire', el: this.refs.tip, text: 'You can hire someone to run it for you! A manager keeps a zone earning by itself, even while you are away. Tap here.' };
    }
    if (!s.tips.skills && s.skillEarned > 0) {
      return { kind: 'skills', el: this.refs.skills, text: 'You earned a skill point! Tap Skills to spend it in the skill trees.' };
    }
    const sport = nextUnlockableSport(s);
    if (!s.tips.sports && sport) {
      return { kind: 'sports', el: this.refs.sports, text: `You have enough to unlock ${sport.name}! Tap Sports to open it.` };
    }
    if (!s.tips.beach && s.tips.manager && FACILITIES.some((f) => s.coins >= facilityCost(f.id, s.facilities[f.id] ?? 0, skillEffects(s).facilityCost))) {
      return { kind: 'beach', el: this.refs.beach, text: 'You can afford a beach building! They boost every sport at once.' };
    }
    if (!s.tips.expand && canExpand(s)) {
      return { kind: 'expand', el: this.refs.expand, text: 'You can expand the beach! A big wave, a new area and more income for good.' };
    }
    return null;
  }

  private coachTarget(): HTMLElement | null {
    switch (this.coachKind) {
      case 'hire':
        return this.refs.tip;
      case 'skills':
        return this.refs.skills;
      case 'sports':
        return this.refs.sports;
      case 'beach':
        return this.refs.beach;
      case 'expand':
        return this.refs.expand;
      default:
        return null;
    }
  }

  private showCoach(step: { kind: 'hire' | 'skills' | 'sports' | 'beach' | 'expand'; el: HTMLElement; text: string }) {
    this.coachKind = step.kind;
    this.game.state.tips[step.kind] = true; // shown once, however it is dismissed
    this.refs.coachBubble.textContent = step.text;
    this.refs.coach.hidden = false;
    step.el.classList.add('coached');
    step.el.addEventListener('click', this.hideCoachBound, { once: true });
  }

  private hideCoachBound = () => this.hideCoach();

  private hideCoach() {
    if (!this.coachKind) return;
    this.coachTarget()?.classList.remove('coached');
    this.refs.coach.hidden = true;
    this.coachKind = null;
  }

  /** Put the glow ring and the text bubble exactly over the coached button, wherever it currently is. */
  private positionCoach() {
    const target = this.coachTarget();
    if (!target) return this.hideCoach();
    const host = this.refs.coach.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const pad = 8;
    const ring = this.refs.coachRing;
    ring.style.left = `${r.left - host.left - pad}px`;
    ring.style.top = `${r.top - host.top - pad}px`;
    ring.style.width = `${r.width + pad * 2}px`;
    ring.style.height = `${r.height + pad * 2}px`;
    const bubble = this.refs.coachBubble;
    const above = r.top > host.height * 0.55;
    bubble.style.left = `${Math.min(Math.max(r.left - host.left + r.width / 2, 130), host.width - 130)}px`;
    bubble.style.top = above ? `${r.top - host.top - 12}px` : `${r.bottom - host.top + 12}px`;
    bubble.classList.toggle('above', above);
  }

  /** A short hint above the bottom bar for the first steps: buy an upgrade, then hire a manager. Each is shown until followed. */
  private refreshTip() {
    const s = this.game.state;
    const z = s.zones['wave-1'];
    const ref = zoneById('wave-1');
    let text = '';
    let kind = '';
    if (s.expansions === 0 && !this.sheet && z.owned) {
      const upgrades = z.price + z.capacity + z.speed;
      if (!s.tips.upgrade && s.totalCoins > 0 && upgrades === 0 && s.coins >= statCost(ref, 'price', 0)) {
        text = 'You can buy an upgrade! Tap the zone on the map.';
        kind = 'upgrade';
      } else if (!s.tips.manager && upgrades >= 3 && !z.manager && s.coins >= managerCost(ref, discounts(s, 'wave').manager)) {
        text = 'Hire a manager: the zone runs by itself, even when you are away.';
        kind = 'manager';
      }
      if (z.manager) s.tips.manager = true;
      if (upgrades > 0) s.tips.upgrade = true;
    }
    this.refs.tip.hidden = !text;
    this.refs.tip.dataset.kind = kind;
    if (text && this.refs.tip.textContent !== text) this.refs.tip.textContent = text;
  }

  private refreshQuests() {
    const s = this.game.state;
    this.refs.quests.classList.toggle('hidden', !!this.sheet);
    let ready = 0;
    for (let i = 0; i < QUEST_SLOTS; i++) {
      const row = this.refs.qlist.querySelector<HTMLElement>(`[data-q="${i}"]`)!;
      const q = s.quests[i];
      row.hidden = !q;
      if (!q) continue;
      const v = questView(s, q);
      if (v.done) ready++;
      row.classList.toggle('done', v.done);
      const t = row.querySelector('.q-t') as HTMLElement;
      const text = v.text;
      if (t.textContent !== text) t.textContent = text;
      const n = row.querySelector('.q-n') as HTMLElement;
      const nt = v.target > 1 ? `${fmt(Math.min(v.current, v.target))} / ${fmt(v.target)}` : v.done ? 'Done' : 'Not yet';
      if (n.textContent !== nt) n.textContent = nt;
      (row.querySelector('.q-bar b') as HTMLElement).style.width = Math.round(Math.min(1, v.current / v.target) * 100) + '%';
      const claim = row.querySelector<HTMLElement>('.q-claim')!;
      setHtml(claim, `${v.done ? 'Claim ' : ''}${COIN} ${fmt(v.reward)}${v.points > 0 ? `<span class="q-gem">${icon('gem')}${v.points}</span>` : ''}`);
      claim.classList.toggle('waiting', !v.done);
    }
    this.refs.quests.classList.toggle('ready', ready > 0);
  }

  // ------------------------------------------------------------ ad boost

  private adBusy = false;

  /** The "watch an ad" button: shows what it gives, then the seconds left while the boost runs. */
  private refreshBoost() {
    const s = this.game.state;
    const on = s.boost > 0;
    const btn = this.refs.boost as HTMLButtonElement;
    btn.classList.toggle('on', on);
    btn.classList.toggle('busy', this.adBusy);
    btn.disabled = on || this.adBusy;
    const a = on ? `Coins x${BALANCE.boostMult}` : this.adBusy ? 'Loading...' : 'Watch ad';
    const b = on ? `${Math.ceil(s.boost)}s left` : `x${BALANCE.boostMult} for ${BALANCE.boostSeconds}s`;
    if (this.refs.boostA.textContent !== a) this.refs.boostA.textContent = a;
    if (this.refs.boostB.textContent !== b) this.refs.boostB.textContent = b;
    this.refs.boostBar.style.width = (on ? Math.min(1, s.boost / BALANCE.boostSeconds) * 100 : 0) + '%';
  }

  /** Show one ad and say how it went. Players who bought "Remove ads" skip the video and still get the reward. */
  private async playAd(): Promise<AdResult> {
    if (this.adBusy) return 'closed';
    if (adFree(this.game.state.perks)) return 'rewarded';
    this.adBusy = true;
    this.refreshBoost();
    try {
      return adsNative ? await showRewardedAd() : await this.demoAd();
    } finally {
      this.adBusy = false;
      this.game.resync(); // the time spent in the ad does not count as time away
    }
  }

  private async watchAd() {
    const s = this.game.state;
    if (s.boost > 0 || this.adBusy) return;
    const result = await this.playAd();
    if (result === 'rewarded') {
      startBoost(s);
      sound.coin();
      this.game.save();
      this.confetti();
      this.toast(`Coins x${BALANCE.boostMult} for ${BALANCE.boostSeconds} seconds!`);
    } else if (result === 'failed') {
      this.toast('No ad is ready right now. Try again in a minute.');
    }
    this.refreshBoost();
  }

  /** In a browser there is no ad network: show a short stand-in so the reward can be tried. The phone apps show real ads. */
  private demoAd(): Promise<AdResult> {
    return new Promise((resolve) => {
      let left = 5;
      const back = document.createElement('div');
      back.className = 'modal-back';
      back.innerHTML = `<div class="modal"><h2>Demo ad</h2><p>In the phone app a short video plays here. Watch it to the end to get the reward.</p><button class="go big" data-ok disabled></button><button class="go alt big" data-skip>Close</button></div>`;
      this.host.appendChild(back);
      const ok = back.querySelector<HTMLButtonElement>('[data-ok]')!;
      const draw = () => (ok.textContent = left > 0 ? `Reward in ${left}...` : 'Claim reward');
      draw();
      const timer = setInterval(() => {
        left -= 1;
        draw();
        if (left <= 0) {
          clearInterval(timer);
          ok.disabled = false;
        }
      }, 1000);
      const finish = (r: AdResult) => {
        clearInterval(timer);
        back.remove();
        resolve(r);
      };
      ok.addEventListener('click', () => finish('rewarded'));
      back.querySelector('[data-skip]')!.addEventListener('click', () => finish('closed'));
      back.addEventListener('click', (e) => {
        if (e.target === back) finish('closed');
      });
    });
  }

  /** Call every frame. Cheap: the heavier refresh only runs about ten times a second. */
  update(nowMs: number) {
    if (nowMs - this.lastFull < 100) return;
    this.lastFull = nowMs;
    this.refreshTop();
    this.refreshSheet();
    this.skillScreen.update();
    this.shop?.update();
    if (this.game.offlineReport) this.showOffline(this.game.offlineReport);
  }

  // ------------------------------------------------------------ pop-ups

  /** A burst of confetti from the middle of the screen (fixed pattern, nothing random). */
  confetti() {
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['#ff5a45', '#ffcf3f', '#4fc3f7', '#5be08f', '#ff7ab8', '#ffffff'];
    for (let i = 0; i < 30; i++) {
      const a = (i * 137.5 * Math.PI) / 180;
      const d = 90 + ((i * 53) % 130);
      const p = document.createElement('i');
      p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      p.style.setProperty('--dy', `${Math.sin(a) * d - 60}px`);
      p.style.setProperty('--rot', `${(i * 47) % 360}deg`);
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = `${(i % 5) * 20}ms`;
      box.appendChild(p);
    }
    this.host.appendChild(box);
    setTimeout(() => box.remove(), 1600);
  }

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

  /** Something to do when the open dialog goes away, however it was closed. */
  private modalClosed: (() => void) | null = null;

  private closeModal() {
    this.refs.modal.hidden = true;
    this.refs.modal.innerHTML = '';
    const done = this.modalClosed;
    this.modalClosed = null;
    done?.();
  }

  showOffline(rep: OfflineReport) {
    this.game.offlineReport = null;
    const lines = [`You were away for <b>${fmtTime(rep.away)}</b>.`];
    if (rep.coins > 0) lines.push(`Your managers earned <b>${COIN} ${fmt(rep.coins)}</b>.`);
    if (rep.capped) lines.push(`<small>Away time only earns for ${fmtTime(rep.seconds)}. Skills in the Beach tree add more.</small>`);
    if (rep.waiting > 0) lines.push(`${rep.waiting} zone${rep.waiting > 1 ? 's are' : ' is'} waiting for you. Hire a manager to keep them running while you are away.`);
    const m = this.modal(`<h2>Welcome back!</h2><p>${lines.join('</p><p>')}</p><button class="go big" data-ok>Nice</button>`);
    m.querySelector('[data-ok]')!.addEventListener('click', () => this.closeModal());
  }

  /** Ask before erasing the save. Uses our own dialog: the browser's confirm() is blocked in some app views. */
  private confirmReset() {
    const m = this.modal(`
      <h2>Start over?</h2>
      <p>This erases everything: coins, zones, upgrades, expansions and skills. You start again with wave surfing only.</p>
      <button class="go big" data-keep>No, keep playing</button>
      <button class="danger" data-really>Yes, erase everything</button>`);
    m.querySelector('[data-keep]')!.addEventListener('click', () => this.closeModal());
    m.querySelector('[data-really]')!.addEventListener('click', () => {
      this.cb.onReset();
    });
  }

  private shop: Shop | null = null;

  openShop() {
    const m = this.modal('');
    this.shop = new Shop(m.querySelector('.modal') as HTMLElement, {
      game: this.game,
      close: () => this.closeModal(),
      toast: (t) => this.toast(t),
      confetti: () => this.confetti(),
      refreshTop: () => this.refreshTop(),
      openLegal: (page) => this.openMenu(page),
      playAd: () => this.playAd(),
      busy: () => this.adBusy,
    });
    this.modalClosed = () => (this.shop = null);
    this.shop.show();
  }

  private openMenu(page: 'main' | 'terms' | 'privacy' = 'main') {
    const m = this.modal('');
    new Menu(m.querySelector('.modal') as HTMLElement, {
      game: this.game,
      close: () => this.closeModal(),
      toast: (t) => this.toast(t),
      askReset: () => this.confirmReset(),
      restored: () => this.cb.onRestored(),
      refreshTop: () => this.refreshTop(),
    }).show(page);
  }
}
