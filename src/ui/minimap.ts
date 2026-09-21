import { AREAS, areaRect, type AreaDef } from '../config/areas';
import { MAP_H, MAP_ROTATION_DEG, MAP_W, UNIT, rectCenter } from '../config/layout';
import type { MapView } from '../scene/MapView';

const ROT = (MAP_ROTATION_DEG * Math.PI) / 180;
const COS = Math.cos(ROT);
const SIN = Math.sin(ROT);
const SIZE = 96;

export interface MinimapOptions {
  isCleared: (area: AreaDef) => boolean;
  onJump: (area: AreaDef) => void;
}

/** A small overview of the whole map with a jump button per area. */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buttons = new Map<string, HTMLButtonElement>();
  private scale: number;

  constructor(
    parent: HTMLElement,
    private view: MapView,
    private opts: MinimapOptions,
  ) {
    const box = document.createElement('div');
    box.className = 'minimap';
    box.innerHTML = '<canvas></canvas><div class="jumps"></div>';
    parent.appendChild(box);
    this.canvas = box.querySelector('canvas')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.canvas.style.width = SIZE + 'px';
    this.canvas.style.height = SIZE + 'px';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    const boxW = MAP_W * Math.abs(COS) + MAP_H * Math.abs(SIN);
    const boxH = MAP_W * Math.abs(SIN) + MAP_H * Math.abs(COS);
    this.scale = (SIZE - 6) / (Math.max(boxW, boxH) * UNIT);

    const jumps = box.querySelector('.jumps')!;
    for (const a of AREAS) {
      const b = document.createElement('button');
      b.className = 'chip jump';
      b.dataset.area = a.id;
      b.textContent = a.name;
      b.title = `Jump to the ${a.name} area`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.opts.onJump(a);
      });
      jumps.appendChild(b);
      this.buttons.set(a.id, b);
    }
    this.canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const r = this.canvas.getBoundingClientRect();
      const w = this.toWorld(e.clientX - r.left, e.clientY - r.top);
      this.view.animateTo(w.x, w.y);
    });
  }

  private toMini(wx: number, wy: number) {
    const dx = (wx - (MAP_W * UNIT) / 2) * this.scale;
    const dy = (wy - (MAP_H * UNIT) / 2) * this.scale;
    return { x: SIZE / 2 + dx * COS - dy * SIN, y: SIZE / 2 + dx * SIN + dy * COS };
  }

  private toWorld(mx: number, my: number) {
    const dx = mx - SIZE / 2;
    const dy = my - SIZE / 2;
    const rx = dx * COS + dy * SIN;
    const ry = -dx * SIN + dy * COS;
    return { x: (MAP_W * UNIT) / 2 + rx / this.scale, y: (MAP_H * UNIT) / 2 + ry / this.scale };
  }

  draw() {
    const c = this.ctx;
    c.clearRect(0, 0, SIZE, SIZE);
    for (const a of AREAS) {
      const r = areaRect(a);
      const corners = [
        this.toMini(r.x * UNIT, r.y * UNIT),
        this.toMini((r.x + r.w) * UNIT, r.y * UNIT),
        this.toMini((r.x + r.w) * UNIT, (r.y + r.h) * UNIT),
        this.toMini(r.x * UNIT, (r.y + r.h) * UNIT),
      ];
      c.beginPath();
      corners.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.closePath();
      c.fillStyle = a.color;
      c.fill();
      if (!this.opts.isCleared(a)) {
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.fill();
      }
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 1;
      c.stroke();
    }
    // view rectangle
    const v = this.view.viewCorners().map((p) => this.toMini(p.x, p.y));
    c.beginPath();
    v.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = '#ff5a45';
    c.lineWidth = 1;
    c.stroke();
    for (const a of AREAS) {
      const b = this.buttons.get(a.id)!;
      const cleared = this.opts.isCleared(a);
      b.classList.toggle('locked', !cleared);
    }
  }

  static areaCenter(a: AreaDef) {
    const c = rectCenter(areaRect(a));
    return { x: c.x * UNIT, y: c.y * UNIT };
  }
}
