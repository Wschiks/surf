import { SKILL_NODES, SKILL_TREES, TREE_UNIT, describeSkill, skillById, skillPosition, treeAngle, treeById, type SkillKind, type SkillNode, type TreeId } from '../config/skills';
import type { Game } from '../core/game';
import { canLearn, learnSkill, skillStatus, treeProgress } from '../core/skills';
import { icon } from './icons';
import { sound } from './sound';

export interface SkillContext {
  game: Game;
  close: () => void;
  toast: (text: string) => void;
  refreshTop: () => void;
}

const KIND_ICON: Record<SkillKind, string> = {
  coins: 'coin',
  speed: 'bolt',
  guests: 'people',
  cost: 'tag',
  manager: 'manager',
  capacityCost: 'people',
  unlock: 'lock',
  facilityPower: 'shop',
  facilityCost: 'tag',
  offline: 'clock',
  quest: 'trophy',
  allCoins: 'coins',
};

const NODE = 58;
const ROOT = 72;
const PAD = 120;


/** The skill map: seven little trees on one pan-and-zoom map, and a card that tells what the chosen skill does. */
export class SkillScreen {
  private el: HTMLElement;
  private view!: HTMLElement;
  private world!: HTMLElement;
  private selected: string | null = null;
  private tx = 0;
  private ty = 0;
  private scale = 0.9;
  private moved = 0;
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private anim = 0;
  private lastPoints = -1;
  private lastSkills: object | null = null;

  constructor(
    parent: HTMLElement,
    private ctx: SkillContext,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'skills';
    this.el.hidden = true;
    parent.appendChild(this.el);
    this.build();
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(tree: TreeId | 'hub' = 'hub') {
    this.el.hidden = false;
    this.render();
    requestAnimationFrame(() => this.focusTree(tree, false));
  }

  close() {
    this.el.hidden = true;
    cancelAnimationFrame(this.anim);
  }

  // ------------------------------------------------------------ building the screen

  private build() {
    const tabs = `<button class="sk-tab" data-tree="hub" style="--c:#a66bff" aria-label="Whole wheel">${icon('gem')}</button>` + SKILL_TREES.map((t) => `<button class="sk-tab" data-tree="${t.id}" style="--c:${t.color}" aria-label="${t.name}">${icon(t.icon)}</button>`).join('');
    this.el.innerHTML = `
      <div class="sk-head">
        <button class="x back" data-sk-close aria-label="Back">${icon('back')}</button>
        <div class="sk-title"><h2>Skills</h2><small>Quests and expansions give skill points</small></div>
        <div class="pill gems">${icon('gem')}<b data-sk-points>0</b></div>
      </div>
      <div class="sk-tabs">${tabs}</div>
      <div class="sk-view" data-sk-view><div class="sk-world" data-sk-world></div></div>
      <div class="sk-card" data-sk-card></div>`;
    this.view = this.el.querySelector('[data-sk-view]')!;
    this.world = this.el.querySelector('[data-sk-world]')!;
    this.el.querySelector('[data-sk-close]')!.addEventListener('click', () => this.ctx.close());
    this.el.querySelectorAll<HTMLElement>('.sk-tab').forEach((b) => b.addEventListener('click', () => this.focusTree(b.dataset.tree as TreeId | 'hub', true)));
    this.bindPointer();
    this.buildWorld();
  }

  private pos(n: SkillNode) {
    return skillPosition(n);
  }

  private buildWorld() {
    const pts = SKILL_NODES.map((n) => this.pos(n));
    this.bounds = { x0: Math.min(...pts.map((p) => p.x)) - PAD, y0: Math.min(...pts.map((p) => p.y)) - PAD, x1: Math.max(...pts.map((p) => p.x)) + PAD, y1: Math.max(...pts.map((p) => p.y)) + PAD };
    const b = this.bounds;
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    // world coordinates start at the top-left corner of the bounds
    const at = (n: SkillNode) => {
      const p = this.pos(n);
      return { x: p.x - b.x0, y: p.y - b.y0 };
    };
    let lines = '';
    const hub = { x: -b.x0, y: -b.y0 };
    // spokes from the hub to the seven free roots
    for (const t of SKILL_TREES) lines += `<line class="spoke" x1="${hub.x}" y1="${hub.y}" x2="${t.at.x - b.x0}" y2="${t.at.y - b.y0}" style="--c:${t.color}" />`;
    for (const n of SKILL_NODES) {
      if (!n.parent) continue;
      const a = at(skillById(n.parent));
      const c = at(n);
      lines += `<line data-line="${n.id}" x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" />`;
    }
    // the names sit between the hub and the roots, on the inside of the ring
    const labels = SKILL_TREES.map((t) => {
      const a = treeAngle(t.id);
      const d = ROOT / 2 + 34;
      const p = { x: t.at.x - Math.cos(a) * d - b.x0, y: t.at.y - Math.sin(a) * d - b.y0 };
      return `<div class="sk-label" style="left:${p.x}px;top:${p.y}px;--c:${t.color}"><b>${t.name}</b><small data-prog="${t.id}"></small></div>`;
    }).join('');
    const hubEl = `<div class="sk-hub" style="left:${hub.x}px;top:${hub.y}px">${icon('gem')}</div>`;
    const nodes = SKILL_NODES.map((n) => {
      const p = at(n);
      const t = treeById(n.tree);
      const size = n.root ? ROOT : NODE;
      const ic = n.root ? t.icon : KIND_ICON[n.kind];
      return `<button class="sk-node${n.root ? ' root' : ''}" data-skill="${n.id}" style="left:${p.x}px;top:${p.y}px;width:${size}px;height:${size}px;--c:${t.color}">${icon(ic)}<i class="sk-cost"></i></button>`;
    }).join('');
    this.world.style.width = w + 'px';
    this.world.style.height = h + 'px';
    this.world.innerHTML = `<svg class="sk-lines" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${lines}</svg>${hubEl}${labels}${nodes}`;
    this.world.querySelectorAll<HTMLElement>('[data-skill]').forEach((b) =>
      b.addEventListener('click', () => {
        if (this.moved > 8) return; // it was a drag, not a tap
        this.select(b.dataset.skill!);
      }),
    );
  }

  // ------------------------------------------------------------ pan and zoom

  private apply() {
    const r = this.view.getBoundingClientRect();
    const w = this.bounds.x1 - this.bounds.x0;
    const h = this.bounds.y1 - this.bounds.y0;
    const s = this.scale;
    // keep the map from being dragged away completely
    const minX = Math.min(0, r.width - w * s);
    const minY = Math.min(0, r.height - h * s);
    this.tx = w * s < r.width ? (r.width - w * s) / 2 : Math.min(0, Math.max(minX, this.tx));
    this.ty = h * s < r.height ? (r.height - h * s) / 2 : Math.min(0, Math.max(minY, this.ty));
    this.world.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${s})`;
  }

  private zoomAt(px: number, py: number, factor: number) {
    const s = Math.min(1.6, Math.max(0.32, this.scale * factor));
    const k = s / this.scale;
    this.tx = px - (px - this.tx) * k;
    this.ty = py - (py - this.ty) * k;
    this.scale = s;
    this.apply();
  }

  private bindPointer() {
    const pts = new Map<number, { x: number; y: number }>();
    let lastDist = 0;
    const local = (e: PointerEvent) => {
      const r = this.view.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    this.view.style.touchAction = 'none';
    this.view.addEventListener('pointerdown', (e) => {
      cancelAnimationFrame(this.anim);
      pts.set(e.pointerId, local(e));
      this.moved = 0;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    this.view.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / lastDist);
        lastDist = d;
        this.moved = 99;
      } else {
        this.moved += Math.hypot(p.x - prev.x, p.y - prev.y);
        if (this.moved > 8) {
          this.tx += p.x - prev.x;
          this.ty += p.y - prev.y;
          this.apply();
        }
      }
    });
    const end = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      lastDist = 0;
    };
    this.view.addEventListener('pointerup', end);
    this.view.addEventListener('pointercancel', end);
    this.view.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = this.view.getBoundingClientRect();
        this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );
  }

  /** Slide the map so a tree is in the middle of the view. */
  private focusTree(id: TreeId | 'hub', animate: boolean) {
    const r = this.view.getBoundingClientRect();
    const wide = this.bounds.x1 - this.bounds.x0;
    const tall = this.bounds.y1 - this.bounds.y0;
    const scale = id === 'hub' ? Math.min(r.width / wide, r.height / tall) * 0.98 : Math.min(1.05, Math.max(0.55, r.width / 470));
    const t = id === 'hub' ? { at: { x: 0, y: 0 } } : treeById(id);
    const a = id === 'hub' ? 0 : treeAngle(id);
    // the middle of the tree: 2 units out from its root (trees grow away from the hub)
    const cx = t.at.x + Math.cos(a) * (id === 'hub' ? 0 : 2) * TREE_UNIT - this.bounds.x0;
    const cy = t.at.y + Math.sin(a) * (id === 'hub' ? 0 : 2) * TREE_UNIT - this.bounds.y0;
    const targetX = r.width / 2 - cx * scale;
    const targetY = r.height / 2 - cy * scale;
    this.el.querySelectorAll('.sk-tab').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tree === id));
    cancelAnimationFrame(this.anim);
    if (!animate) {
      this.scale = scale;
      this.tx = targetX;
      this.ty = targetY;
      this.apply();
      return;
    }
    const from = { s: this.scale, x: this.tx, y: this.ty };
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 450);
      const e = 1 - Math.pow(1 - k, 3);
      this.scale = from.s + (scale - from.s) * e;
      this.tx = from.x + (targetX - from.x) * e;
      this.ty = from.y + (targetY - from.y) * e;
      this.apply();
      if (k < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }

  // ------------------------------------------------------------ state

  private select(id: string) {
    this.selected = id;
    sound.tap();
    this.render(true);
  }

  /** Update what the skills look like. Cheap: called about ten times a second while the screen is open. */
  update() {
    if (this.el.hidden) return;
    const s = this.ctx.game.state;
    if (s.skillPoints === this.lastPoints && s.skills === this.lastSkills) return;
    this.render();
  }

  private render(force = false) {
    const s = this.ctx.game.state;
    if (!force && s.skillPoints === this.lastPoints && s.skills === this.lastSkills) return;
    this.lastPoints = s.skillPoints;
    this.lastSkills = s.skills;
    (this.el.querySelector('[data-sk-points]') as HTMLElement).textContent = String(s.skillPoints);
    for (const n of SKILL_NODES) {
      const st = skillStatus(s, n);
      const btn = this.world.querySelector<HTMLElement>(`[data-skill="${n.id}"]`)!;
      btn.className = `sk-node${n.root ? ' root' : ''} ${st}${st === 'available' && canLearn(s, n) ? ' can' : ''}${this.selected === n.id ? ' sel' : ''}`;
      const cost = btn.querySelector('.sk-cost') as HTMLElement;
      cost.innerHTML = st === 'owned' || n.root ? '' : `${icon('gem')}${n.cost}`;
      const line = this.world.querySelector(`[data-line="${n.id}"]`);
      line?.setAttribute('class', st === 'owned' ? 'on' : st === 'available' ? 'next' : '');
      (line as SVGElement | null)?.style.setProperty('--c', treeById(n.tree).color);
    }
    for (const t of SKILL_TREES) {
      const p = treeProgress(s, t.id);
      (this.world.querySelector(`[data-prog="${t.id}"]`) as HTMLElement).textContent = `${p.learned} / ${p.total}`;
    }
    this.renderCard();
  }

  private renderCard() {
    const s = this.ctx.game.state;
    const card = this.el.querySelector<HTMLElement>('[data-sk-card]')!;
    if (!this.selected) {
      card.innerHTML = `<p class="sk-hint">Tap a skill to see what it does. Every tree starts with one free skill. Skills stay when you expand the beach.</p>`;
      return;
    }
    const n = skillById(this.selected);
    const t = treeById(n.tree);
    const st = skillStatus(s, n);
    let action: string;
    if (st === 'owned') action = `<button class="go auto" disabled>${icon('check')} ${n.root ? 'Free start skill' : 'Learned'}</button>`;
    else if (st === 'locked') action = `<button class="go" disabled>${icon('lock')} Learn ${skillById(n.parent!).name} first</button>`;
    else if (s.skillPoints < n.cost) action = `<button class="go" disabled>${icon('gem')} Need ${n.cost - s.skillPoints} more point${n.cost - s.skillPoints > 1 ? 's' : ''}</button>`;
    else action = `<button class="go ready" data-learn>${icon('gem')} Learn · ${n.cost}</button>`;
    card.innerHTML = `
      <div class="sk-card-top"><span class="sk-card-ic" style="--c:${t.color}">${icon(n.root ? t.icon : KIND_ICON[n.kind])}</span>
        <div><b>${n.name}</b><small>${t.name}</small></div></div>
      <p class="sk-desc">${describeSkill(n)}</p>${action}`;
    card.querySelector('[data-learn]')?.addEventListener('click', () => {
      if (learnSkill(s, n.id)) {
        sound.unlock();
        this.ctx.game.save();
        this.ctx.refreshTop();
        this.ctx.toast(`${n.name} learned`);
        this.render(true);
      }
    });
  }
}
