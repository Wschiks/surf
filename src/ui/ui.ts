import { STATS, STAT_IDS, type StatId } from '../config/balance';
import { FACILITIES } from '../config/facilities';
import { areaById } from '../config/areas';
import { SPORTS, ZONES, sportById, zoneById, zoneId } from '../config/sports';
import type { GameState } from '../core/state';
import { adsNative, interstitialAvailable, showInterstitialAd, showRewardedAd, type AdResult } from '../ads';
import { AD_BREAK } from '../config/ads';
import { adBreakDue } from '../core/perks';
import { BALANCE } from '../config/balance';
import { autoIncomePerSecond, statMax, topUpOffline, bonusFor, bonusMult, facilityOpen, offlineCap, startBoost, buyFacility, buyManager, buyStat, costOf, discounts, facilityCost, managerCost, planBuy, tapZone, zoneStats, type BuyMode } from '../core/economy';
import { milestoneMult, nextMilestone } from '../config/balance';
import type { Game } from '../core/game';
import type { OfflineReport } from '../core/economy';
import { hasAffordableSkill, skillEffects } from '../core/skills';
import { canExpand, canRebirth, expand, expansionNeededFor, expansionReady, expansionStatus, rebirth, rebirthShown, rebirthStatus, unlockZone, zoneMisted, zoneUnlockStatus } from '../core/unlocks';
import { REBIRTH } from '../config/rebirth';
import { PLANE } from '../config/plane';
import { claimPlanePrize, planeDelay, planeUnlocked, rollPlanePrize, type PlanePrize } from '../core/plane';
import { claimQuest, questView, QUEST_SLOTS } from '../core/quests';
import { COIN, fmt, fmtClock, fmtDuration, fmtSeconds, fmtTime } from './format';
import { icon, sportTile, tile } from './icons';
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
  /** Coins were collected from a zone, for a floating number on the map. */
  onCollected: (zoneId: string | null, coins: number) => void;
  /** A level or a whole sport was unlocked. */
  onUnlocked: (zoneId: string, kind: 'level' | 'sport') => void;
  /** A beach expansion was bought at the height of the big wave: the beach starts over. */
  onExpanded: () => void;
  /** A rebirth: the whole game started over from the very beginning (the mist comes back). */
  onRebirth: () => void;
  /** The next expansion just became ready (every open sport at the level it needs): the wind blows the mist back. */
  onExpandReady: () => void;
  /** Send the banner plane over the map with this prize on its banner. */
  flyPlane: (f: { kind: PlanePrize['kind']; text: string; seconds: number; onTap: () => void; onGone: () => void }) => void;
}

/** Set the HTML of an element only when it changed, so a button is not rebuilt while it is being pressed. */
function setHtml(el: HTMLElement, html: string) {
  if (el.dataset.h !== html) {
    el.innerHTML = html;
    el.dataset.h = html;
  }
}

/** The zone after this one: the next level of the sport, or after level 4 the first level of the next sport (round and round). */
/** Step through the zones with the arrows, skipping zones still under the mist. */
function stepZone(state: GameState, id: string, pick: (id: string) => string): string | null {
  let cur = id;
  for (let n = 0; n < ZONES.length; n++) {
    cur = pick(cur);
    if (!zoneMisted(state, cur)) return cur;
  }
  return null;
}

function nextZoneId(id: string): string {
  const ref = zoneById(id);
  if (ref.level < ref.sport.levels.length) return zoneId(ref.sport.id, ref.level + 1);
  // after the very last zone it goes round to the first again
  const i = SPORTS.findIndex((sp) => sp.id === ref.sport.id);
  return zoneId(SPORTS[(i + 1) % SPORTS.length].id, 1);
}

/** The zone before this one: the level before, or before level 1 the last level of the sport before (round and round). */
function prevZoneId(id: string): string {
  const ref = zoneById(id);
  if (ref.level > 1) return zoneId(ref.sport.id, ref.level - 1);
  // before the very first zone it goes round to the last one
  const i = SPORTS.findIndex((sp) => sp.id === ref.sport.id);
  const prev = SPORTS[(i - 1 + SPORTS.length) % SPORTS.length];
  return zoneId(prev.id, prev.levels.length);
}

type Sheet = { kind: 'zone'; id: string } | { kind: 'beach' } | { kind: 'sports' } | { kind: 'expand' } | null;

/** The HTML user interface on top of the map: top bar, bottom dock, bottom sheets and pop-ups. */
export class GameUI {
  private root: HTMLElement;
  private sheetEl: HTMLElement;
  private dockEl: HTMLElement;
  private sheet: Sheet = null;
  private lastFull = 0;
  /** When the next banner plane comes (ms), null while there is no manager yet. */
  private planeAt: number | null = null;
  private planeFlying = false;
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
        <div class="pill coins"><span class="ico">${COIN}</span><span class="cv"><b data-ref="coins">0</b><small data-ref="rate">+0/s</small></span><em class="mult" data-ref="mult" hidden></em></div>
        <button class="pill gems" data-ref="gembtn" aria-label="Skill points"><span class="ico">${icon('gem')}</span><b data-ref="gems">0</b></button>
      </div>
      <div class="quests" data-ref="quests">
        <div class="q-list" data-ref="qlist">${Array.from({ length: QUEST_SLOTS }, (_, i) => `<div class="q-row" data-q="${i}"><div class="q-body"><span class="q-t"></span><i class="q-bar"><b></b></i><small class="q-n"></small></div><button class="q-claim"></button></div>`).join('')}</div>
      </div>
      <!-- under the quests, left: progression, in a row (each button only shows once it is unlocked) -->
      <div class="rail left" data-ref="railL">
        <button class="rbtn skills gone" data-ref="skills" aria-label="Skills">${icon('tree')}</button>
        <button class="rbtn expand" data-ref="expand" aria-label="Expand" hidden>${icon('expand')}<i class="dot" data-ref="expanddot" hidden></i></button>
        <button class="rbtn rebirth-btn" data-ref="rebirth" aria-label="Rebirth" hidden>${icon('rebirth')}</button>
      </div>
      <!-- right column above the bottom corner: extras (spin and skins are placeholders for now) -->
      <div class="rail right" data-ref="railR">
        <button class="rbtn" data-ref="spin" aria-label="Daily spin">${icon('spin')}</button>
        <button class="rbtn" data-ref="skins" aria-label="Skins">${icon('skin')}</button>
        <button class="rbtn" data-ref="gear" aria-label="Menu">${icon('gear')}</button>
      </div>
      <!-- bottom corners: shop + sports left, watch ad + beach right; the middle stays free for the map -->
      <div class="dock">
        <div class="corner left">
          <button class="cbtn big shop" data-ref="shop" aria-label="Shop">${icon('bag')}<i class="dot" data-ref="shopdot" hidden></i></button>
          <button class="cbtn sports" data-ref="sports" aria-label="Sports">${icon('sports')}</button>
        </div>
        <div class="corner right">
          <button class="cbtn boost" data-ref="boost" aria-label="Watch ad">${icon('video')}<b data-ref="boostA" hidden></b><small data-ref="boostB">x${BALANCE.boostMult}</small><i class="boost-bar"><u data-ref="boostBar"></u></i></button>
          <button class="cbtn big beach" data-ref="beach" aria-label="Beach">${icon('beach')}</button>
        </div>
      </div>
      <div class="sheet" data-ref="sheet"></div>
      <div class="toasts" data-ref="toasts"></div>
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
    this.refs.rebirth.addEventListener('click', () => this.openExpand());
    // tapping the dark area around a dialog closes it
    this.refs.modal.addEventListener('click', (e) => {
      if (e.target === this.refs.modal) this.closeModal();
    });
    // tapping a quest (not its claim button) goes to what it is about and opens it
    this.refs.qlist.querySelectorAll<HTMLElement>('.q-row').forEach((row, i) =>
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.q-claim')) return;
        const q = this.game.state.quests[i];
        if (!q) return;
        sound.tap();
        if (q.zone) this.openZone(q.zone);
        else if (q.kind === 'facility') this.openBeach();
        else if (q.kind === 'expand') this.openExpand();
        else this.openSports();
      }),
    );
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
    if (zoneMisted(this.game.state, id)) return this.expandFirst();
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

  /** Close the open sheet. `adBreak` false: never an ad break now (the game closes it itself, for an animation). */
  closeSheet(adBreak = true) {
    if (!this.sheet) return;
    this.sheet = null;
    this.sheetEl.classList.remove('open');
    this.dockEl.classList.remove('hidden');
    this.root.classList.remove('sheet-open');
    this.cb.onSelect(null);
    if (adBreak) this.maybeAdBreak();
  }

  // ------------------------------------------------------------ ad breaks

  private sessionStart = performance.now();
  private lastAdBreak = performance.now();

  /** At a calm moment (coins collected, a sheet closed) an ad break may come: a black "Ad break" screen, then an ad. */
  maybeAdBreak() {
    const now = performance.now();
    const due = adBreakDue({ adFree: adFree(this.game.state.perks), played: (now - this.sessionStart) / 1000, sinceLast: (now - this.lastAdBreak) / 1000 });
    if (!due || this.adBusy || !this.refs.modal.hidden || document.querySelector('.adbreak') || !interstitialAvailable()) return;
    this.lastAdBreak = now;
    this.adBusy = true;
    const box = document.createElement('div');
    box.className = 'adbreak';
    box.innerHTML = `<b>Ad break</b><small data-n>The ad starts in ${AD_BREAK.countdown}</small>`;
    this.host.appendChild(box);
    let left = AD_BREAK.countdown;
    const timer = setInterval(() => {
      left--;
      const n = box.querySelector('[data-n]');
      if (n && left > 0) n.textContent = `The ad starts in ${left}`;
      if (left > 0) return;
      clearInterval(timer);
      void (adsNative ? showInterstitialAd() : this.demoAdBreak()).finally(() => {
        box.remove();
        this.adBusy = false;
        this.game.resync(); // the time in the ad does not count as time away
      });
    }, 1000);
  }

  /** In a browser there is no ad network: a short stand-in for the ad. */
  private demoAdBreak(): Promise<void> {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-back adbreak-demo';
      back.innerHTML = `<div class="modal"><h2>Demo ad</h2><p>In the phone app an ad plays here.</p><button class="go big" data-ok>Close</button></div>`;
      this.host.appendChild(back);
      back.querySelector('[data-ok]')!.addEventListener('click', () => {
        back.remove();
        resolve();
      });
    });
  }

  private buildSheet() {
    if (!this.sheet) return;
    this.dockEl.classList.add('hidden');
    this.root.classList.add('sheet-open');
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
        ${owned ? sportTile(ref.sport.icon, ref.sport.color, 48) : tile('lock', '#7d92a3', 48)}
        <div class="sheet-title"><h2>${title}</h2><p>${sub}</p></div>
        ${stepZone(this.game.state, id, prevZoneId) ? `<button class="zarrow" data-prev aria-label="Level before">${icon('back')}</button>` : ''}
        ${stepZone(this.game.state, id, nextZoneId) ? `<button class="zarrow" data-next aria-label="Next level">${icon('arrow')}</button>` : ''}
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>`;
    this.sheetEl.innerHTML = head + (owned ? this.ownedBody(id) : this.lockedBody(id));
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
    for (const [sel, pick] of [['[data-next]', nextZoneId], ['[data-prev]', prevZoneId]] as const) {
      this.sheetEl.querySelector(sel)?.addEventListener('click', () => {
        const to = stepZone(this.game.state, id, pick);
        if (!to) return;
        sound.tap();
        this.openZone(to);
      });
    }
    if (!owned) {
      this.sheetEl.querySelector('[data-toexpand]')?.addEventListener('click', () => this.openExpand());
      this.sheetEl.querySelectorAll<HTMLElement>('[data-goto]').forEach((li) =>
        li.addEventListener('click', () => {
          if (li.classList.contains('met')) return;
          sound.tap();
          this.openZone(li.dataset.goto!);
        }),
      );
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
    const mgrRow = `
      <div class="up mgr" data-mgr>
        <div class="up-ico">${icon('manager')}</div>
        <div class="up-txt"><b>${terms.manager}</b><small>${icon('check')} auto</small></div>
        <button class="buy" data-buy="manager"></button>
      </div>`;
    // no manager yet: hiring one matters more than any upgrade, so it leads; once hired it settles at the bottom
    // (this is decided when the sheet is built, not live while it stays open - hiring mid-session just reorders it next time)
    const upgrades = this.game.state.zones[id].manager ? `${rows}${mgrRow}` : `${mgrRow}${rows}`;
    return `
      <div data-zone-body>
        <div class="statline">
          <div><b data-s="guests"></b><small>${icon('people')}</small></div>
          <div><b data-s="total"></b><small>${COIN}</small></div>
          <div><b data-s="dur"></b><small>${icon('clock')}</small></div>
          <div><b data-s="rate"></b><small>${COIN}/s</small></div>
        </div>
        <div class="session"><div class="bar"><i data-bar></i></div><button class="go" data-go></button></div>
        <div class="modes" data-modes><span>Buy</span>${modes}</div>
        <div class="ups">${upgrades}</div>
      </div>`;
  }

  private lockedBody(id: string): string {
    const ref = zoneById(id);
    const need = zoneUnlockStatus(this.game.state, ref)!;
    if (need.kind === 'closed') {
      // same layout as an unlockable zone: what you get, what is blocking it, and the ticked list of what the expansion that opens it needs
      const next = expansionStatus(this.game.state);
      const items = next ? SPORTS.filter((sp) => areaById(sp.area).expansion <= this.game.state.expansions).map((sp, i) => `<li data-xreq="${i}"><span class="tick"></span><span class="rt">${icon(sp.icon)} Lv ${next.def.level}</span><em></em></li>`).join('') : '';
      return `
      <div class="unlock-card">
        <h3>${sportTile(ref.sport.icon, ref.sport.color, 30)} ${ref.sport.name}</h3>
        <p class="blocked">${icon('lock')} ${icon('expand')} ${expansionNeededFor(this.game.state, ref.sport.id) ?? 1}</p>
        <ul class="reqs">${items}</ul>
        <button class="go" data-toexpand>${icon('expand')} Expand</button>
      </div>`;
    }
    // a requirement you still have to do is a button: it takes you to the zone where you do it
    const reqs = need.status.requirements.map((r, i) => `<li data-req="${i}"${r.zone ? ` data-goto="${r.zone}"` : ''}><span class="tick"></span><span class="rt">${r.text}</span><em></em>${r.zone ? `<span class="goto">${icon('arrow')}</span>` : ''}</li>`).join('');
    return `
      <div class="unlock-card">
        <h3>${icon('lock')} ${need.kind === 'sport' ? ref.sport.name : ref.def.name}</h3>
        <p class="blocked" data-blocked hidden></p>
        <ul class="reqs">${reqs}</ul>
        <button class="go" data-unlock></button>
      </div>`;
  }

  private refreshLocked(id: string) {
    const ref = zoneById(id);
    const need = zoneUnlockStatus(this.game.state, ref);
    if (!need) return;
    if (need.kind === 'closed') {
      expansionStatus(this.game.state)?.requirements.forEach((r, i) => {
        const li = this.sheetEl.querySelector<HTMLElement>(`[data-xreq="${i}"]`);
        if (!li) return;
        li.classList.toggle('met', r.met);
        setHtml(li.querySelector('.tick') as HTMLElement, r.met ? icon('check') : '');
      });
      return;
    }
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
          ${sportTile(sp.icon, sp.color, 46)}
          <div class="sport-mid"><b>${sp.name}</b><small data-info></small><div class="pips">${pips}</div></div>
        </div>`;
      }).join('');
    this.sheetEl.innerHTML = `
      <div class="sheet-head">
        ${tile('sports', '#1497b5', 48)}
        <div class="sheet-title"><h2>Sports</h2></div>
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
        info = exp !== null ? 'Locked' : `Locked · needs Level ${sp.unlock?.level} of ${sportById(sp.unlock!.after).name}`;
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
        <div class="up-txt"><b>${f.name} <em data-lvl></em></b><small data-eff class="eff"></small></div>
        <button class="buy" data-buyfac="${f.id}"></button>
      </div>`,
    ).join('');
    this.sheetEl.innerHTML = `
      <div class="sheet-head">
        ${tile('beach', '#e9a13a', 48)}
        <div class="sheet-title"><h2>Beach</h2></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="ups">${rows}</div>`;
    this.sheetEl.querySelector('[data-close]')!.addEventListener('click', () => this.closeSheet());
    this.sheetEl.querySelectorAll<HTMLElement>('[data-buyfac]').forEach((b) => this.bindBuy(b, true, () => buyFacility(this.game.state, b.dataset.buyfac!)));
  }

  private buildExpandSheet() {
    this.sheetEl.innerHTML = `
      <div class="sheet-head">
        ${expansionStatus(this.game.state) ? tile('expand', '#ff6a3d', 48) : tile('rebirth', '#2fbf8a', 48)}
        <div class="sheet-title"><h2>${expansionStatus(this.game.state) ? 'Expand' : 'Rebirth'}</h2></div>
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
    if (!st) return this.refreshRebirth(card);
    if (!card.querySelector('[data-xbtn]')) {
      // one line and one button, nothing shown twice (the author: less is more).
      // (The expansion only shows itself once every open sport is done, so there is nothing left to list.)
      const mult = bonusFor(s.expansions + 1, s.rebirths);
      card.innerHTML = `
        <p class="xp-line">${icon('rebirth')} Start over · ${COIN} x${mult} forever</p>
        <button class="go" data-xbtn></button>`;
      card.querySelector('[data-xbtn]')!.addEventListener('click', () => this.startExpansion());
    }
    const btn = card.querySelector<HTMLButtonElement>('[data-xbtn]')!;
    const can = canExpand(s);
    btn.disabled = !can;
    btn.className = 'go' + (can ? ' ready' : '');
    setHtml(btn, `${icon('expand')} ${COIN} ${fmt(st.coins)}`);
  }

  /** When the whole map is open, the expand sheet offers the rebirth: start the whole game over, stronger. */
  private refreshRebirth(card: HTMLElement) {
    const s = this.game.state;
    const st = rebirthStatus(s)!;
    if (!card.querySelector('[data-rbtn]')) {
      card.innerHTML = `
        <h3>${icon('rebirth')} Rebirth ${st.n}</h3>
        <div class="rewards"><span class="rw">${COIN}<b>x${bonusFor(0, st.n)}</b></span><span class="rw gem">${icon('gem')}<b>+${REBIRTH.gems}</b></span></div>
        <ul class="reqs"><li data-rreq="0"><span class="tick"></span><span class="rt">${icon(zoneById(REBIRTH.zone).sport.icon)} ${zoneById(REBIRTH.zone).def.name}</span><em></em></li></ul>
        <button class="go" data-rbtn></button>`;
      card.querySelector('[data-rbtn]')!.addEventListener('click', () => this.startRebirth());
    }
    st.requirements.forEach((r, i) => {
      const li = card.querySelector<HTMLElement>(`[data-rreq="${i}"]`);
      if (!li) return;
      li.classList.toggle('met', r.met);
      setHtml(li.querySelector('.tick') as HTMLElement, r.met ? icon('check') : '');
      li.querySelector('em')!.textContent = `Lv ${r.progress}`;
    });
    const btn = card.querySelector<HTMLButtonElement>('[data-rbtn]')!;
    btn.disabled = !st.canBuy;
    btn.className = 'go' + (st.canBuy ? ' ready' : '');
    setHtml(btn, `${icon('rebirth')} ${COIN} ${fmt(st.coins)}`);
  }

  /** The rebirth: the big wave washes over everything, and behind it the game starts over from the very beginning. */
  private startRebirth() {
    if (!canRebirth(this.game.state) || document.querySelector('.tsunami')) return;
    const n = this.game.state.rebirths + 1;
    this.bigWave(`Rebirth ${n}`, () => {
      rebirth(this.game.state);
      this.game.save();
      this.cb.onRebirth();
      this.refreshTop();
    }, `${icon('rebirth')} Rebirth ${n}! ${COIN} x${bonusFor(0, n)} ${icon('gem')} +${REBIRTH.gems}`);
  }

  /** Buy the expansion: the big wave sweeps over the screen and, while everything is hidden, the beach starts over. */
  private startExpansion() {
    if (!canExpand(this.game.state) || document.querySelector('.tsunami')) return;
    const st = expansionStatus(this.game.state)!;
    this.bigWave(`${st.def.name} ${st.def.n}`, () => {
      expand(this.game.state);
      this.game.save();
      this.cb.onExpanded();
      this.refreshTop();
    }, () => `${icon('expand')} ${COIN} x${bonusMult(this.game.state)}`);
  }

  /** The big wave sweeps over the screen; `atPeak` runs while everything is hidden, then confetti and a message. */
  private bigWave(title: string, atPeak: () => void, message: string | (() => string)) {
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
      <div class="ts-title">${icon('beach')}<b>${title}</b></div>`;
    this.host.appendChild(box);
    this.closeSheet(false);
    setTimeout(atPeak, 1500);
    setTimeout(() => {
      this.confetti();
      this.toast(typeof message === 'string' ? message : message());
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
  private setStatBuy(btn: HTMLElement, maxed: boolean, affordable: boolean, count: number, cost: number, rebirthMore = false) {
    if (maxed && rebirthMore) {
      this.setBuy(btn, Infinity);
      setHtml(btn, `MAX <span class="more">${icon('lock')}${icon('rebirth')}</span>`);
      return;
    }
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
        const open = facilityOpen(s, f);
        row.classList.toggle('locked', !open);
        row.querySelector('[data-lvl]')!.textContent = open ? `Lv ${lvl}/${f.max}` : '';
        const what = f.effect === 'coins' ? COIN : icon('bolt');
        const need = zoneById(f.needs);
        setHtml(row.querySelector('[data-eff]') as HTMLElement, open ? `${what} +${Math.round(f.perLevel * lvl * 100)}% <span class="dim">(+${Math.round(f.perLevel * 100)}% / Lv)</span>` : f.stage > s.expansions ? `${icon('lock')} ${icon('expand')} ${f.stage}` : `${icon('lock')} ${icon(need.sport.icon)} ${need.def.name}`);
        const btn = row.querySelector<HTMLButtonElement>('[data-buyfac]')!;
        if (open) this.setBuy(btn, facilityCost(f.id, lvl, skillEffects(s).facilityCost));
        else {
          btn.disabled = true;
          btn.removeAttribute('data-afford');
          setHtml(btn, icon('lock'));
        }
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
    q('[data-s="total"]').textContent = fmt(st.income);
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
      const top = statMax(stat, s.rebirths);
      const plan = planBuy(ref, stat, lvl, s.coins, this.buyMode, disc.stat(stat), top);
      // when the coins are not there yet, still show what the chosen amount would cost
      const want = this.buyMode === 'max' ? 1 : Math.min(this.buyMode, top - lvl);
      const shown = plan.count > 0 ? plan.count : Math.max(1, want);
      const after = lvl + shown;
      const next = zoneStats(s, ref, { ...z, [stat]: after });
      const maxed = lvl >= top;
      let eff = '';
      if (stat === 'capacity') eff = maxed ? `${icon('people')} ${st.guests} ${icon('check')}` : `${icon('people')} ${st.guests} → ${next.guests}`;
      if (stat === 'price') eff = maxed ? `${COIN} ${fmt(st.pricePerGuest)} (max)` : `${COIN} ${fmt(st.pricePerGuest)} → ${fmt(next.pricePerGuest)}`;
      if (stat === 'speed') eff = maxed ? `${icon('clock')} ${fmtSeconds(st.duration)} (max)` : `${icon('clock')} ${fmtSeconds(st.duration)} → ${fmtSeconds(next.duration)}`;
      setHtml(row.querySelector('[data-eff]')!, `Lv ${lvl} · ${eff}`);
      if (stat === 'price') {
        const nm = nextMilestone(lvl);
        setHtml(row.querySelector('[data-ms]')!, `${icon('star', '12px')} x${fmt(milestoneMult(lvl))} → x${fmt(milestoneMult(lvl) * nm.mult)} at Lv ${nm.level}`);
      }
      // a full class grows again with the next rebirth: the button says so with icons
      const rebirthMore = maxed && !!STATS[stat].perRebirth;
      this.setStatBuy(row.querySelector('[data-buy]')!, maxed, plan.count > 0, shown, plan.count > 0 ? plan.cost : costOf(ref, stat, lvl, shown, disc.stat(stat), top), rebirthMore);
    }
    // the next arrow glows when the next level can be unlocked right now
    const nextId = stepZone(s, id, nextZoneId);
    this.sheetEl.querySelector('[data-next]')?.classList.toggle('ready', !!(nextId && zoneUnlockStatus(s, zoneById(nextId))?.status.canBuy));
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

  /** Beach buildings that could be built at the last check (to say so when a new one opens). */
  private openFacilities: Set<string> | null = null;

  private refreshTop() {
    const s = this.game.state;
    const open = new Set(FACILITIES.filter((f) => facilityOpen(s, f)).map((f) => f.id));
    if (this.openFacilities) {
      for (const id of open) {
        if (this.openFacilities.has(id)) continue;
        const f = FACILITIES.find((x) => x.id === id)!;
        this.toast(`${icon(f.icon)} New: ${f.name}!`);
        this.refs.beach.classList.add('pulse');
      }
    }
    this.openFacilities = open;
    if (this.sheet?.kind === 'beach') this.refs.beach.classList.remove('pulse');
    this.refs.coins.textContent = fmt(s.coins);
    this.refs.rate.textContent = `+${fmt(autoIncomePerSecond(s))}/s`;
    this.refs.gems.textContent = String(s.skillPoints);
    const canSeeSkills = s.skillEarned > 0;
    this.refs.skills.classList.toggle('gone', !canSeeSkills);
    this.refs.skills.classList.toggle('pulse', canSeeSkills && hasAffordableSkill(s));
    const perm = bonusMult(s) * (s.perks.x5 ? BALANCE.x5Mult : 1) * (s.perks.club ? CLUB.coinMult : 1);
    this.refs.mult.hidden = perm === 1;
    this.refs.mult.textContent = `x${perm}`;
    this.refreshBoost();
    this.refs.shopdot.hidden = adStreak(s, Date.now()).lockedFor > 0;
    // the rebirth button shows once the whole game is done, and glows when a rebirth can be bought
    const showRebirth = rebirthShown(s);
    (this.refs.rebirth as HTMLButtonElement).hidden = !showRebirth;
    if (showRebirth && !s.hints.rebirth && !this.coachOpen) this.coachRebirth();
    this.refs.rebirth.classList.toggle('ready', canRebirth(s));
    const big = canExpand(s) || canRebirth(s);
    this.refs.expand.classList.toggle('ready', big);
    this.refs.expand.classList.toggle('pulse', big);
    this.refs.expanddot.hidden = !big;
    // the Expand button is a secret until the next expansion is ready (or, after the last one, the rebirth shows);
    // until then the Watch ad button takes its place
    const ready = expansionReady(s);
    const showExpand = ready; // after the last expansion the round rebirth button takes over
    const expandBtn = this.refs.expand as HTMLButtonElement;
    if (showExpand && expandBtn.hidden && this.wasExpandReady !== null) {
      expandBtn.classList.add('arrive');
      setTimeout(() => expandBtn.classList.remove('arrive'), 600);
    }
    expandBtn.hidden = !showExpand;
    if (this.wasExpandReady === false && ready) this.cb.onExpandReady();
    this.wasExpandReady = ready;
    const reb = canRebirth(s);
    if (reb && this.wasRebirthReady === false) this.toast(`${icon('rebirth')} Rebirth ready!`, () => this.openExpand());
    this.wasRebirthReady = reb;
    this.refreshQuests();
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
  private coachOpen = false;

  /**
   * The first time the rebirth button shows: the screen goes dark except for that button, an arrow points at it,
   * and only tapping it closes this (it opens the rebirth screen). Shown once per save.
   */
  private coachRebirth() {
    const btn = this.refs.rebirth;
    this.coachOpen = true;
    this.closeSheet(false);
    const el = document.createElement('div');
    el.className = 'coach';
    el.innerHTML = `<button class="coach-hole" aria-label="Rebirth"></button><div class="coach-tip"><b>${icon('rebirth')} Rebirth!</b><span class="coach-arrow">${icon('arrow')}</span></div>`;
    this.root.appendChild(el);
    const hole = el.querySelector<HTMLElement>('.coach-hole')!;
    const tip = el.querySelector<HTMLElement>('.coach-tip')!;
    const place = () => {
      if (!el.isConnected) return;
      const r = btn.getBoundingClientRect();
      const o = this.root.getBoundingClientRect();
      const pad = 8;
      Object.assign(hole.style, { left: `${r.left - o.left - pad}px`, top: `${r.top - o.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      Object.assign(tip.style, { right: `${o.right - r.left + 14}px`, top: `${r.top - o.top + r.height / 2}px` });
      requestAnimationFrame(place);
    };
    place();
    sound.unlock();
    hole.addEventListener('click', () => {
      this.game.state.hints.rebirth = true;
      this.game.save();
      el.remove();
      this.coachOpen = false;
      sound.tap();
      this.openExpand();
    });
  }

  /** Whether the next expansion was ready at the last refresh (null before the first one, so loading a save does not animate). */
  private wasExpandReady: boolean | null = null;
  private wasRebirthReady: boolean | null = null;

  /** The "watch an ad" button: shows what it gives, then the seconds left while the boost runs. */
  private refreshBoost() {
    const s = this.game.state;
    const on = s.boost > 0;
    const btn = this.refs.boost as HTMLButtonElement;
    btn.classList.toggle('on', on);
    btn.classList.toggle('busy', this.adBusy);
    btn.disabled = on || this.adBusy;
    const a = on ? `Coins x${BALANCE.boostMult}` : this.adBusy ? 'Loading...' : 'Watch ad';
    // round button: under the icon just x2, or the time left while it runs
    const b = on ? fmtClock(s.boost) : this.adBusy ? '...' : `x${BALANCE.boostMult}`;
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
      this.lastAdBreak = performance.now(); // just watched an ad: no ad break right after it
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
      this.toast(`${COIN} x${BALANCE.boostMult} · ${fmtDuration(BALANCE.boostSeconds)}`);
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
    this.updatePlane(nowMs);
    this.refreshTop();
    this.refreshSheet();
    this.skillScreen.update();
    this.shop?.update();
    if (this.game.offlineReport) this.showOffline(this.game.offlineReport);
  }

  // ------------------------------------------------------------ banner plane

  /** Send the banner plane when it is time. It flies whatever is open; missing it is the player's loss. */
  private updatePlane(nowMs: number) {
    if (!planeUnlocked(this.game.state)) {
      if (!this.planeFlying) this.planeAt = null;
      return;
    }
    this.planeAt ??= nowMs + planeDelay('first') * 1000;
    if (!this.planeFlying && nowMs >= this.planeAt) this.launchPlane();
  }

  private nextPlane(when: 'claimed' | 'missed') {
    this.planeAt = Date.now() + planeDelay(when) * 1000;
  }

  /** The prize in the popup (the plane's banner shows the same, chosen before it appeared). */
  private prizeHtml(p: PlanePrize): string {
    if (p.kind === 'coins') return `${COIN}<b>+${fmt(p.coins)}</b>`;
    if (p.kind === 'gems') return `${icon('gem')}<b>+${p.gems}</b>`;
    return `${COIN}<b>x2</b><b>· ${fmtDuration(p.seconds)}</b>`;
  }

  private launchPlane() {
    const prize = rollPlanePrize(this.game.state);
    this.planeFlying = true;
    this.cb.flyPlane({
      kind: prize.kind,
      text: prize.kind === 'coins' ? `+${fmt(prize.coins)}` : prize.kind === 'gems' ? `+${prize.gems}` : 'x2',
      seconds: PLANE.flightSeconds,
      onTap: () => {
        this.planeFlying = false;
        this.openPlane(prize);
      },
      onGone: () => {
        this.planeFlying = false;
        this.nextPlane('missed');
      },
    });
  }

  /** Tapped the plane: what you get, and one button (watch the ad, or just claim it without ads). */
  private openPlane(prize: PlanePrize) {
    sound.tap();
    const free = adFree(this.game.state.perks);
    let claimed = false;
    const m = this.modal(`
      <button class="x mist-x" data-close aria-label="Close">${icon('close')}</button>
      <div class="plane-pop">
        <div class="plane-prize">${this.prizeHtml(prize)}</div>
        <button class="go big" data-plane>${free ? 'Claim' : `${icon('video')} Watch ad`}</button>
      </div>`);
    this.modalClosed = () => {
      if (!claimed) this.nextPlane('missed');
    };
    m.querySelector('[data-close]')!.addEventListener('click', () => this.closeModal());
    const btn = m.querySelector<HTMLButtonElement>('[data-plane]')!;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const result = await this.playAd();
      if (result === 'rewarded') {
        claimed = true;
        claimPlanePrize(this.game.state, prize);
        this.nextPlane('claimed');
        sound.coin();
        this.confetti();
        this.game.save();
        this.closeModal();
        this.refreshTop();
        return;
      }
      btn.disabled = false;
      if (result === 'failed') this.toast('No ad is ready right now. Try again in a minute.');
    });
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

  toast(text: string, onTap?: () => void) {
    const t = document.createElement('div');
    t.className = 'toast' + (onTap ? ' tap' : '');
    t.innerHTML = text; // our own short texts, with icons
    if (onTap)
      t.addEventListener('click', () => {
        t.remove();
        onTap();
      });
    this.refs.toasts.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  /**
   * Tapped something still under the mist: a popup that says you can't expand yet and what to do first, with one
   * button to the next level to unlock. Once the expansion is ready, Expand opens.
   */
  expandFirst() {
    const s = this.game.state;
    sound.tap();
    const st = expansionStatus(s);
    if (!st) return;
    if (st.ready) return this.openExpand();
    this.closeSheet(false);
    const need = st.def.level;
    // the first sport still short, and its next level to unlock (that is where the work is)
    const sp = SPORTS.filter((x) => areaById(x.area).expansion <= s.expansions).find((x) => !s.zones[zoneId(x.id, need)]?.owned);
    let next: string | null = null;
    if (sp) for (let lv = 1; lv <= need; lv++) if (!s.zones[zoneId(sp.id, lv)]?.owned) { next = zoneId(sp.id, lv); break; }
    const m = this.modal(`
      <button class="x mist-x" data-close aria-label="Close">${icon('close')}</button>
      <div class="mist-pop">
        ${tile('lock', '#5d7f99', 64)}
        <h2>You can't expand yet!</h2>
        <p>First unlock Level ${need} of every sport.</p>
        ${next ? `<button class="go big" data-go>${icon('arrow')} Go</button>` : ''}
      </div>`);
    m.querySelector('[data-close]')!.addEventListener('click', () => this.closeModal());
    m.querySelector('[data-go]')?.addEventListener('click', () => {
      sound.tap();
      this.closeModal();
      this.openZone(next!);
    });
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
    const s = this.game.state;
    const cap = offlineCap(s);
    const pct = Math.round(Math.min(1, rep.seconds / cap) * 100);
    const canGems = s.skillPoints >= BALANCE.offlineGemCost;
    const notes: string[] = [];
    if (rep.waiting > 0) notes.push(`<p class="off-note">${icon('manager')} Hire a manager to earn while you're away</p>`);
    const m = this.modal(`
      <div class="menu-head">
        ${tile('clock', '#1497b5', 46)}
        <div class="menu-title"><h2>Welcome back!</h2><p>${icon('clock')} ${fmtTime(rep.away)}</p></div>
        <button class="x" data-close aria-label="Close">${icon('close')}</button>
      </div>
      ${
        rep.coins > 0
          ? `<div class="off-earn">${icon('coins')}<b data-off-total>${fmt(rep.coins)}</b><em class="off-pct">${Math.round(BALANCE.offlineRate * 100)}%</em></div>
      <div class="off-bar-row"><span>${icon('clock')}</span><span>Max ${fmtTime(cap)}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${notes.join('')}
      <div class="off-boosts">
        <button class="go off-btn" data-off-ad>${icon('video')}<b>${Math.round(BALANCE.offlineAdRate * 100)}%</b><small>${COIN} ${fmt(rep.full * BALANCE.offlineAdRate)}</small></button>
        <button class="go off-btn alt" data-off-gems${canGems ? '' : ' disabled'}>${icon('gem')}<b>${BALANCE.offlineGemCost} · 100%</b><small>${COIN} ${fmt(rep.full)}</small></button>
      </div>`
          : notes.join('')
      }`);
    const finish = () => this.closeModal();
    m.querySelector('[data-close]')!.addEventListener('click', finish);
    const raise = (rate: number) => {
      topUpOffline(s, rep, rate);
      sound.coin();
      this.confetti();
      this.game.save();
      this.refreshTop();
      finish();
    };
    const adBtn = m.querySelector<HTMLButtonElement>('[data-off-ad]');
    adBtn?.addEventListener('click', async () => {
      adBtn.disabled = true;
      const result = await this.playAd();
      if (result === 'rewarded') return raise(BALANCE.offlineAdRate);
      adBtn.disabled = false;
      if (result === 'failed') this.toast('No ad is ready right now. Try again in a minute.');
    });
    m.querySelector('[data-off-gems]')?.addEventListener('click', () => {
      if (s.skillPoints < BALANCE.offlineGemCost) return;
      s.skillPoints -= BALANCE.offlineGemCost;
      raise(1);
    });
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
      refreshTop: () => this.refreshTop(),
    }).show(page);
  }
}
