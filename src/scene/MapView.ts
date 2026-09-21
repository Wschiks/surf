import { MAP_ROTATION_DEG, MAP_UNITS, MIN_UNITS_ACROSS, START_UNITS_ACROSS, UNIT } from '../config/layout';

const ROT = (MAP_ROTATION_DEG * Math.PI) / 180;
const COS = Math.cos(ROT);
const SIN = Math.sin(ROT);

export interface Pt {
  x: number;
  y: number;
}

/**
 * The view onto the rotated map. Holds the centre (world px), the zoom (screen px per map unit)
 * and the screen size. All pan, zoom, clamping and projection maths lives here so it can be tested.
 */
export class MapView {
  cx = 5 * UNIT;
  cy = 1 * UNIT;
  ppu = 400;
  width = 400;
  height = 800;
  rotation = ROT;
  private target: { cx: number; cy: number; ppu: number } | null = null;
  /** Speed of a swipe that keeps gliding after the finger lifts (screen px per second). */
  private vel: Pt | null = null;

  private sized = false;

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    if (!this.sized) {
      this.sized = true;
      this.ppu = this.defaultPpu();
    }
    this.ppu = Math.min(Math.max(this.ppu, this.minPpu()), this.maxPpu());
    this.clamp();
  }

  defaultPpu(): number {
    return this.width / START_UNITS_ACROSS;
  }
  maxPpu(): number {
    return this.width / MIN_UNITS_ACROSS;
  }
  /** Zoomed all the way out: the whole rotated map fits on the screen. */
  minPpu(): number {
    const span = MAP_UNITS * (COS + SIN) + 0.4;
    return Math.min(this.width, this.height) / span;
  }
  get zoom(): number {
    return this.ppu / UNIT;
  }

  screenToWorld(sx: number, sy: number): Pt {
    const dx = sx - this.width / 2;
    const dy = sy - this.height / 2;
    const z = this.zoom;
    // inverse rotation
    const rx = dx * COS + dy * SIN;
    const ry = -dx * SIN + dy * COS;
    return { x: this.cx + rx / z, y: this.cy + ry / z };
  }

  worldToScreen(wx: number, wy: number): Pt {
    const z = this.zoom;
    const rx = (wx - this.cx) * z;
    const ry = (wy - this.cy) * z;
    return {
      x: this.width / 2 + rx * COS - ry * SIN,
      y: this.height / 2 + rx * SIN + ry * COS,
    };
  }

  /** Keep gliding after a swipe. */
  fling(vx: number, vy: number) {
    this.vel = Math.hypot(vx, vy) > 60 ? { x: vx, y: vy } : null;
  }

  stopFling() {
    this.vel = null;
  }

  panBy(dxScreen: number, dyScreen: number) {
    this.target = null;
    const z = this.zoom;
    const rx = dxScreen * COS + dyScreen * SIN;
    const ry = -dxScreen * SIN + dyScreen * COS;
    this.cx -= rx / z;
    this.cy -= ry / z;
    this.clamp();
  }

  /** Zoom by a factor while keeping the world point under the screen point fixed. */
  zoomAt(sx: number, sy: number, factor: number) {
    this.target = null;
    const before = this.screenToWorld(sx, sy);
    this.ppu = Math.min(Math.max(this.ppu * factor, this.minPpu()), this.maxPpu());
    const after = this.screenToWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
    this.clamp();
  }

  /** Half size of the view in world px, measured along the world axes (the view is a rotated rectangle). */
  private halfExtents(ppu = this.ppu): Pt {
    const z = ppu / UNIT;
    return {
      x: (this.width / 2 * COS + this.height / 2 * SIN) / z,
      y: (this.width / 2 * SIN + this.height / 2 * COS) / z,
    };
  }

  /** Keep the whole view inside the map. When the view is bigger than the map (zoomed out) the map is centred. */
  clamp() {
    const c = this.clampPoint(this.cx, this.cy, this.ppu);
    this.cx = c.x;
    this.cy = c.y;
  }

  private clampPoint(x: number, y: number, ppu: number): Pt {
    const max = MAP_UNITS * UNIT;
    const h = this.halfExtents(ppu);
    return {
      x: h.x * 2 >= max ? max / 2 : Math.min(Math.max(x, h.x), max - h.x),
      y: h.y * 2 >= max ? max / 2 : Math.min(Math.max(y, h.y), max - h.y),
    };
  }

  jumpTo(cx: number, cy: number, ppu?: number) {
    this.target = null;
    this.cx = cx;
    this.cy = cy;
    if (ppu !== undefined) this.ppu = Math.min(Math.max(ppu, this.minPpu()), this.maxPpu());
    this.clamp();
  }

  /** Smoothly move to a point. `lift` shifts the point up on screen (px), to make room for a bottom sheet. */
  animateTo(cx: number, cy: number, ppu?: number, lift = 0) {
    const p = ppu === undefined ? this.ppu : Math.min(Math.max(ppu, this.minPpu()), this.maxPpu());
    // A screen offset of (0, +lift) from the centre is a world offset of R^-1 (0, lift) / z.
    const z = p / UNIT;
    const ox = (lift * SIN) / z;
    const oy = (lift * COS) / z;
    const c = this.clampPoint(cx + ox, cy + oy, p);
    this.target = { cx: c.x, cy: c.y, ppu: p };
  }

  get animating(): boolean {
    return this.target !== null;
  }

  update(dt: number) {
    if (this.vel) {
      const v = this.vel;
      const z = this.zoom;
      const rx = (v.x * dt) * COS + (v.y * dt) * SIN;
      const ry = -(v.x * dt) * SIN + (v.y * dt) * COS;
      this.cx -= rx / z;
      this.cy -= ry / z;
      this.clamp();
      const k = Math.exp(-dt * 3.5);
      v.x *= k;
      v.y *= k;
      if (Math.hypot(v.x, v.y) < 25) this.vel = null;
    }
    if (!this.target) return;
    const k = 1 - Math.exp(-dt * 8);
    const t = this.target;
    this.cx += (t.cx - this.cx) * k;
    this.cy += (t.cy - this.cy) * k;
    this.ppu *= Math.pow(t.ppu / this.ppu, k);
    if (Math.abs(t.cx - this.cx) < 0.5 && Math.abs(t.cy - this.cy) < 0.5 && Math.abs(t.ppu / this.ppu - 1) < 0.002) {
      this.cx = t.cx;
      this.cy = t.cy;
      this.ppu = t.ppu;
      this.target = null;
    }
    this.clamp();
  }

  /** The four screen corners as world points (for the overview map). */
  viewCorners(): Pt[] {
    return [
      this.screenToWorld(0, 0),
      this.screenToWorld(this.width, 0),
      this.screenToWorld(this.width, this.height),
      this.screenToWorld(0, this.height),
    ];
  }
}

/** Pan, pinch and tap input for the map, on top of a DOM element. */
export class MapInput {
  private pointers = new Map<number, Pt>();
  private downAt = new Map<number, { x: number; y: number; t: number; moved: number }>();
  private lastMid: Pt | null = null;
  private lastDist = 0;
  private speed: Pt = { x: 0, y: 0 };
  private lastMoveT = 0;
  /** Fired when the user drags or zooms, so the UI can react (for example close hints). */
  onGesture: () => void = () => {};
  onTap: (sx: number, sy: number) => void = () => {};

  constructor(
    private el: HTMLElement,
    private view: MapView,
  ) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
  }

  private local(e: PointerEvent | WheelEvent): Pt {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down = (e: PointerEvent) => {
    const p = this.local(e);
    this.view.stopFling();
    this.speed = { x: 0, y: 0 };
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, p);
    this.downAt.set(e.pointerId, { x: p.x, y: p.y, t: performance.now(), moved: 0 });
    this.resetPinch();
  };

  private resetPinch() {
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      this.lastMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.lastDist = Math.hypot(a.x - b.x, a.y - b.y);
    } else {
      this.lastMid = null;
    }
  }

  private move = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    const d = this.downAt.get(e.pointerId);
    if (d) d.moved += Math.hypot(p.x - prev.x, p.y - prev.y);
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastMid && this.lastDist > 0 && dist > 0) {
        this.view.zoomAt(mid.x, mid.y, dist / this.lastDist);
        this.view.panBy(mid.x - this.lastMid.x, mid.y - this.lastMid.y);
      }
      this.lastMid = mid;
      this.lastDist = dist;
      this.onGesture();
    } else if (d && d.moved > 6) {
      this.view.panBy(p.x - prev.x, p.y - prev.y);
      const now = performance.now();
      const dt = Math.max(1, now - this.lastMoveT) / 1000;
      this.lastMoveT = now;
      const k = 0.5;
      this.speed = { x: this.speed.x * (1 - k) + ((p.x - prev.x) / dt) * k, y: this.speed.y * (1 - k) + ((p.y - prev.y) / dt) * k };
      this.onGesture();
    }
  };

  private up = (e: PointerEvent) => {
    const d = this.downAt.get(e.pointerId);
    const wasSingle = this.pointers.size === 1;
    if (wasSingle && d && d.moved > 12 && performance.now() - this.lastMoveT < 80) this.view.fling(this.speed.x, this.speed.y);
    this.pointers.delete(e.pointerId);
    this.downAt.delete(e.pointerId);
    this.resetPinch();
    if (e.type === 'pointerup' && d && wasSingle && d.moved <= 8 && performance.now() - d.t < 500) {
      this.onTap(d.x, d.y);
    }
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.local(e);
    this.view.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    this.onGesture();
  };
}
