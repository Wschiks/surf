import type { MapView } from '../scene/MapView';

export interface LabelSpec {
  id: string;
  /** World position (px). */
  x: number;
  y: number;
  /** Only visible while the zoom (screen px per unit) is inside this range. */
  minPpu?: number;
  maxPpu?: number;
  className?: string;
  html: string;
  onClick?: () => void;
}

/** DOM labels that follow points on the map. Text stays upright and crisp while the map is rotated. */
export class LabelLayer {
  private items = new Map<string, { spec: LabelSpec; el: HTMLElement; last: string }>();
  readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'labels';
    parent.appendChild(this.root);
  }

  set(spec: LabelSpec) {
    let it = this.items.get(spec.id);
    if (!it) {
      const el = document.createElement('div');
      el.className = 'label';
      el.dataset.id = spec.id;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.items.get(spec.id)?.spec.onClick?.();
      });
      this.root.appendChild(el);
      it = { spec, el, last: '' };
      this.items.set(spec.id, it);
    }
    it.spec = spec;
    const cls = 'label ' + (spec.className ?? '') + (spec.onClick ? ' tappable' : '');
    if (it.el.className !== cls) it.el.className = cls;
    if (it.last !== spec.html) {
      it.el.innerHTML = spec.html;
      it.last = spec.html;
    }
  }

  remove(id: string) {
    const it = this.items.get(id);
    if (it) {
      it.el.remove();
      this.items.delete(id);
    }
  }

  /** Project every label onto the screen. Call once per frame. */
  update(view: MapView) {
    for (const { spec, el } of this.items.values()) {
      const inRange = (spec.minPpu === undefined || view.ppu >= spec.minPpu) && (spec.maxPpu === undefined || view.ppu <= spec.maxPpu);
      const p = view.worldToScreen(spec.x, spec.y);
      const on = inRange && p.x > -80 && p.x < view.width + 80 && p.y > -40 && p.y < view.height + 40;
      if (!on) {
        if (el.style.display !== 'none') el.style.display = 'none';
        continue;
      }
      if (el.style.display !== 'block') el.style.display = 'block';
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    }
  }
}
