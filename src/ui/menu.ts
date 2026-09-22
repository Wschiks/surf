import pkg from '../../package.json';
import { CREDITS, LEGAL_UPDATED, PRIVACY, TERMS, type LegalSection } from '../config/legal';
import { ZONES } from '../config/sports';
import type { Game } from '../core/game';
import { COIN, fmt, fmtTime } from './format';
import { icon, tile } from './icons';
import { isMuted, setMuted, sound } from './sound';

export interface MenuContext {
  game: Game;
  close: () => void;
  toast: (text: string) => void;
  /** Ask "Start over?" and, if confirmed, erase the save. */
  askReset: () => void;
  refreshTop: () => void;
}

type Page = 'main' | 'how' | 'terms' | 'privacy' | 'about';

const HOW_TO_PLAY = [
  ['Start sessions', 'Tap the round badge on a zone to start a session. When it is done, tap it again to collect the coins.'],
  ['Upgrade', 'Open a zone to level it up, get a bigger class or make it faster. Hold a button to buy quickly, or pick x10, x100 or Max.'],
  ['Managers', 'Hire a manager to keep a zone running by itself, also while the game is closed. Away time earns for 2 hours; skills in the Beach tree make that longer.'],
  ['New levels and sports', 'A new level needs coins and upgrades on the level before it. A new sport needs a level of the sport before it, and coins.'],
  ['Quests', 'Finish quests for extra coins. Harder quests, and every fifth quest, also give a skill point. Every quest pays its own reward. Swipe the row of quests sideways to see them all.'],
  ['Skills', 'Skill points (the purple gems) are for the skill trees: one tree for every sport and one for the beach. Each tree starts with a free skill and then splits up so you can choose. Skills stay when you expand the beach.'],
  ['Expand the beach', 'When you own Level 4 of every sport, you can expand the beach: all income goes up for good, a new area opens and you start over.'],
  ['Moving around', 'Swipe to move, pinch or scroll to zoom.'],
] as const;

/** The menu: settings, your stats, help, terms, privacy and about. It draws itself into `root`. */
export class Menu {
  constructor(
    private root: HTMLElement,
    private ctx: MenuContext,
  ) {}

  show(page: Page = 'main') {
    this.root.className = 'modal menu';
    this.root.scrollTop = 0;
    switch (page) {
      case 'main':
        return this.main();
      case 'how':
        return this.simple('How to play', 'help', '#1497b5', `<div class="howto">${HOW_TO_PLAY.map(([t, b]) => `<div><b>${t}</b><p>${b}</p></div>`).join('')}</div>`);
      case 'terms':
        return this.legal('Terms of Service', 'doc', '#7a5cff', TERMS);
      case 'privacy':
        return this.legal('Privacy Policy', 'shield', '#2fbf8a', PRIVACY);
      case 'about':
        return this.about();
    }
  }

  // ------------------------------------------------------------ pages

  private header(title: string, ic: string, color: string, back: boolean): string {
    return `<div class="menu-head">
      ${back ? `<button class="x back" data-back aria-label="Back">${icon('back')}</button>` : tile(ic, color, 46)}
      <div class="menu-title"><h2>${title}</h2></div>
      <button class="x" data-close aria-label="Close">${icon('close')}</button>
    </div>`;
  }

  private wire() {
    this.root.querySelector('[data-close]')?.addEventListener('click', () => this.ctx.close());
    this.root.querySelector('[data-back]')?.addEventListener('click', () => this.show('main'));
    this.root.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => this.show(b.dataset.go as Page)));
  }

  private row(ic: string, color: string, title: string, sub: string, attrs: string, right = icon('chevron')): string {
    return `<button class="set-row" ${attrs}>${tile(ic, color, 40)}<span class="set-txt"><b>${title}</b><small>${sub}</small></span><span class="set-r">${right}</span></button>`;
  }

  private main() {
    const s = this.ctx.game.state;
    const owned = ZONES.filter((z) => s.zones[z.id].owned).length;
    const managers = ZONES.filter((z) => s.zones[z.id].manager).length;
    const played = fmtTime((Date.now() - s.startedAt) / 1000);
    this.root.innerHTML = `
      ${this.header('Menu', 'gear', '#ff6a3d', false)}
      <div class="menu-stats">
        <div><b>${owned}<em>/${ZONES.length}</em></b><small>Zones</small></div>
        <div><b>${managers}</b><small>Managers</small></div>
        <div><b>${s.expansions}<em>/2</em></b><small>Expansions</small></div>
        <div><b>${s.questsDone}</b><small>Quests done</small></div>
      </div>
      <p class="menu-line">${icon('chart')} ${COIN} <b>${fmt(s.totalCoins)}</b> earned in total · playing for <b>${played}</b></p>

      <h4>Settings</h4>
      <div class="set-group">
        ${this.row(isMuted() ? 'mute' : 'sound', '#1497b5', 'Sound', 'Coin and button sounds', 'data-sound', `<span class="switch${isMuted() ? '' : ' on'}"><i></i></span>`)}
      </div>

      <h4>Help</h4>
      <div class="set-group">
        ${this.row('help', '#1497b5', 'How to play', 'The basics in a minute', 'data-go="how"')}
      </div>

      <h4>Legal</h4>
      <div class="set-group">
        ${this.row('doc', '#7a5cff', 'Terms of Service', 'The rules of playing', 'data-go="terms"')}
        ${this.row('shield', '#2fbf8a', 'Privacy Policy', 'What is stored (only on your device)', 'data-go="privacy"')}
        ${this.row('heart', '#ff5c8a', 'About and credits', `Version ${pkg.version}`, 'data-go="about"')}
      </div>


      <button class="danger" data-reset>Start over (erases your save)</button>
      <button class="go big" data-close2>Back to the beach</button>`;
    this.wire();
    this.root.querySelector('[data-close2]')!.addEventListener('click', () => this.ctx.close());
    this.root.querySelector('[data-sound]')!.addEventListener('click', () => {
      setMuted(!isMuted());
      sound.tap();
      this.main();
    });
    this.root.querySelector('[data-reset]')!.addEventListener('click', () => this.ctx.askReset());
  }

  private simple(title: string, ic: string, color: string, body: string) {
    this.root.innerHTML = `${this.header(title, ic, color, true)}<div class="menu-body">${body}</div><button class="go big" data-back2>Back to the menu</button>`;
    this.wire();
    this.root.querySelector('[data-back2]')!.addEventListener('click', () => this.show('main'));
  }

  private legal(title: string, ic: string, color: string, sections: LegalSection[]) {
    const body = `<p class="menu-updated">Last updated ${LEGAL_UPDATED}</p>${sections.map((x) => `<section class="legal"><h3>${x.title}</h3><p>${x.body}</p></section>`).join('')}`;
    this.simple(title, ic, color, body);
  }

  private about() {
    const rows = CREDITS.map(([a, b]) => `<div class="credit"><b>${a}</b><span>${b}</span></div>`).join('');
    this.simple(
      'About',
      'heart',
      '#ff5c8a',
      `<div class="about-logo"><span>${icon('wave')}</span><b>Surf Tycoon</b><small>Version ${pkg.version}</small></div>
       <p class="menu-updated">An idle game about running a water-sports spot: surf, skim, windsurf, kite, foil and sail.</p>${rows}
       <div class="menu-links"><button class="btn soft" data-go="terms">${icon('doc')} Terms of Service</button><button class="btn soft" data-go="privacy">${icon('shield')} Privacy Policy</button></div>`,
    );
  }

}
