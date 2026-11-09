import Phaser from 'phaser';
import { ATLAS, PIVOT, RES } from './atlas';
import { K } from './models';
import type { Fx } from './sim';

// Particles in world space (README 4.5): wake marks, spray, splash rings and the foil's trickle. They stay behind
// when the guest moves on, so every turn leaves a curved trail. One shared pool for the whole map.

interface P {
  img: Phaser.GameObjects.Image;
  k: Fx['k'];
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  live: boolean;
}

const MAX = 1400;

export class FxPool {
  private items: P[] = [];
  private next = 0;

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
  ) {}

  private take(frame: string): P {
    let p: P;
    if (this.items.length < MAX) {
      const img = this.scene.add.image(0, 0, ATLAS, frame).setDepth(this.depth);
      p = {
        img,
        k: 'wake',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        life: 1,
        size: 1,
        live: false,
      };
      this.items.push(p);
    } else {
      // the pool is full: reuse the oldest one
      p = this.items[this.next];
      this.next = (this.next + 1) % MAX;
      p.img.setFrame(frame);
    }
    const pv = PIVOT.get(frame)!;
    p.img.setOrigin(pv.ox, pv.oy).setVisible(true);
    p.live = true;
    p.age = 0;
    return p;
  }

  add(list: Fx[]) {
    for (const f of list) {
      const s = K / RES;
      if (f.k === 'wake') {
        const p = this.take('limb');
        Object.assign(p, {
          k: f.k,
          x: f.x,
          y: f.y,
          vx: f.vx,
          vy: f.vy,
          life: 1.1,
          size: f.size,
        });
        // a short white dash along the travel direction
        p.img.setRotation(f.rot + Math.PI / 2).setScale(0.36 * s * f.size, 0.3 * s * f.size);
      } else if (f.k === 'spray') {
        const p = this.take('disc');
        Object.assign(p, {
          k: f.k,
          x: f.x,
          y: f.y,
          vx: f.vx,
          vy: f.vy,
          life: 0.5,
          size: f.size,
        });
        p.img.setRotation(0);
      } else if (f.k === 'ring') {
        const p = this.take('ring');
        Object.assign(p, {
          k: f.k,
          x: f.x,
          y: f.y,
          vx: 0,
          vy: 0,
          life: 0.55,
          size: f.size,
        });
        p.img.setRotation(0);
      } else {
        const p = this.take('vee');
        Object.assign(p, {
          k: f.k,
          x: f.x,
          y: f.y,
          vx: 0,
          vy: 0,
          life: 0.7,
          size: 1,
        });
        p.img.setRotation(f.rot).setScale(s, s);
      }
    }
    list.length = 0;
  }

  update(dt: number) {
    const s = K / RES;
    for (const p of this.items) {
      if (!p.live) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.live = false;
        p.img.setVisible(false);
        continue;
      }
      const drag = p.k === 'spray' ? Math.exp(-dt * 3) : Math.exp(-dt * 1.5);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.img.setPosition(p.x, p.y);
      if (p.k === 'wake') {
        const g = 1 + 0.6 * k;
        p.img.setAlpha(0.8 * (1 - k) * (1 - k * 0.3)).setScale(0.36 * s * p.size * g, 0.3 * s * p.size * (1 - 0.3 * k));
      } else if (p.k === 'spray') {
        const r = (3 * p.size * (1 - 0.4 * k)) / 32;
        p.img.setAlpha(0.95 * (1 - k * k)).setScale(r * s * 1.0, r * s);
      } else if (p.k === 'ring') {
        const r = ((8 + 26 * Math.sqrt(k)) * p.size) / 30;
        p.img.setAlpha(0.9 * (1 - k)).setScale(r * s, r * s);
      } else {
        p.img.setAlpha(0.5 * (1 - k));
      }
    }
  }
}
