import Phaser from 'phaser';
import { BEACH_SPORTS, fieldRect, fieldsArea, type BeachSportDef } from '../config/beach';
import { LAND, rectContains, toWorld, UNIT, type Rect } from '../config/layout';
import { beachSportOpen } from '../core/economy';
import type { GameState } from '../core/state';
import { GUEST_LOOK, guestTexture } from './art';
import { DEPTH } from './background';

/** Where the players of one team stand, as fractions of their half (x across, d = distance from the middle line). */
const FORMATION: [number, number][][] = [
  [[0.5, 0.5]],
  [
    [0.3, 0.5],
    [0.7, 0.5],
  ],
  [
    [0.2, 0.38],
    [0.5, 0.68],
    [0.8, 0.38],
  ],
  [
    [0.27, 0.3],
    [0.73, 0.3],
    [0.27, 0.72],
    [0.73, 0.72],
  ],
  [
    [0.18, 0.3],
    [0.5, 0.3],
    [0.82, 0.3],
    [0.33, 0.74],
    [0.67, 0.74],
  ],
];

interface Field {
  players: { img: Phaser.GameObjects.Image; x: number; y: number; team: number }[];
  ball: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Graphics;
  r: Rect;
}

interface Site {
  def: BeachSportDef;
  ground: Phaser.GameObjects.Graphics;
  fields: Field[];
  key: string;
  running: boolean;
}

/**
 * The beach sports on the sand: a dashed plot once a sport can be bought, then its fields (1 to 4) with the players
 * of two teams (1v1 up to 5v5) and a ball flying between them while a game runs. Fixed patterns, nothing random.
 */
export class FieldView {
  private sites: Site[] = [];

  constructor(private scene: Phaser.Scene) {
    for (const def of BEACH_SPORTS) this.sites.push({ def, ground: scene.add.graphics().setDepth(DEPTH.things - 1.4), fields: [], key: '', running: false });
  }

  /** The beach sport whose fields (or plot) are under a world point. */
  hit(state: GameState, wx: number, wy: number): string | null {
    for (const s of this.sites) {
      const z = state.zones[s.def.id];
      if (!z) continue;
      if (z.owned && rectContains(toWorld(fieldsArea(s.def, 1 + z.fields)), wx, wy)) return s.def.id;
      if (!z.owned && beachSportOpen(state, s.def) && rectContains(toWorld(fieldRect(s.def, 0)), wx, wy)) return s.def.id;
    }
    return null;
  }

  update(state: GameState, time: number) {
    for (const s of this.sites) {
      const z = state.zones[s.def.id];
      if (!z) continue;
      const open = beachSportOpen(state, s.def);
      const key = `${z.owned}|${open}|${z.fields}|${z.capacity}`;
      if (key !== s.key) {
        s.key = key;
        this.build(s, z.owned, open, 1 + z.fields, 1 + z.capacity);
      }
      s.running = z.owned && (z.manager || z.phase === 'running');
      this.animate(s, time);
    }
  }

  private build(s: Site, owned: boolean, open: boolean, count: number, perTeam: number) {
    for (const f of s.fields) {
      f.players.forEach((p) => p.img.destroy());
      f.ball.destroy();
      f.shadow.destroy();
    }
    s.fields = [];
    const g = s.ground;
    g.clear();
    if (!owned) {
      // a dashed plot where the first field will be
      if (open) dashedRect(g, toWorld(fieldRect(s.def, 0)), 0xb98543, 0.75);
      return;
    }
    const soccer = s.def.id === 'soccer';
    for (let i = 0; i < count; i++) {
      const r = toWorld(fieldRect(s.def, i));
      drawCourt(g, r, soccer);
      const players: Field['players'] = [];
      for (let team = 0; team < 2; team++) {
        const spots = FORMATION[Math.min(perTeam, FORMATION.length) - 1];
        spots.forEach(([a, d], k) => {
          const p = spot(r, soccer, team, a, d);
          const key = guestTexture(this.scene, 'walker', s.def.teams[team], k + team * 2 + i);
          const img = this.scene.add.image(p.x, p.y, key).setDepth(DEPTH.things).setDisplaySize(GUEST_LOOK.walker.w, GUEST_LOOK.walker.h);
          // face the middle line
          img.setRotation(soccer ? (team === 0 ? -Math.PI / 2 : Math.PI / 2) : team === 0 ? Math.PI : 0);
          players.push({ img, x: p.x, y: p.y, team });
        });
      }
      const shadow = this.scene.add.graphics().setDepth(DEPTH.things - 0.2);
      shadow.fillStyle(0x6b5330, 0.25).fillEllipse(0, 0, 9, 5);
      const ball = this.scene.add.graphics().setDepth(DEPTH.things + 0.5);
      ball.fillStyle(0xffffff, 1).fillCircle(0, 0, 3.6);
      ball.lineStyle(1, soccer ? 0x222222 : 0xffc233, 1).strokeCircle(0, 0, 3.6);
      s.fields.push({ players, ball, shadow, r });
    }
  }

  private animate(s: Site, time: number) {
    const soccer = s.def.id === 'soccer';
    s.fields.forEach((f, i) => {
      const t = time / 1000 + i * 1.7;
      const cx = f.r.x + f.r.w / 2;
      const cy = f.r.y + f.r.h / 2;
      if (!s.running) {
        // waiting for a tap: everyone stands still, the ball lies in the middle
        f.ball.setPosition(cx, cy).setScale(1);
        f.shadow.setPosition(cx, cy + 1);
        f.players.forEach((p) => p.img.setPosition(p.x, p.y));
        return;
      }
      let bx: number;
      let by: number;
      let lift = 0;
      if (soccer) {
        // the ball runs around the field; everyone leans toward it a little
        bx = cx + f.r.w * 0.36 * Math.sin(t * 1.1);
        by = cy + f.r.h * 0.3 * Math.sin(t * 0.83 + 0.6);
      } else {
        // the ball flies over the net between a player on each side
        const a = f.players.filter((p) => p.team === 0);
        const b = f.players.filter((p) => p.team === 1);
        const rally = Math.floor(t / 1.3);
        const k = (t / 1.3) % 1;
        const from = (rally % 2 ? b : a)[rally % (rally % 2 ? b : a).length];
        const to = (rally % 2 ? a : b)[(rally + 1) % (rally % 2 ? a : b).length];
        bx = from.x + (to.x - from.x) * k;
        by = from.y + (to.y - from.y) * k;
        lift = Math.sin(Math.PI * k);
      }
      f.ball.setPosition(bx, by).setScale(1 + lift * 0.7);
      f.shadow.setPosition(bx, by + 1 + lift * 2).setScale(1 - lift * 0.3);
      f.players.forEach((p, k) => {
        const lean = soccer ? 0.12 : 0.05;
        p.img.setPosition(p.x + (bx - p.x) * lean + Math.sin(t * 3 + k) * 1.2, p.y + (by - p.y) * lean + Math.cos(t * 2.6 + k) * 1.2);
      });
    });
  }
}

/** Where a player stands: volleyball has the net across the field (teams top and bottom), soccer the halfway line (teams left and right). */
function spot(r: Rect, soccer: boolean, team: number, across: number, fromMiddle: number): { x: number; y: number } {
  const pad = 8;
  if (soccer) {
    const half = r.w / 2 - pad;
    const x = r.x + r.w / 2 + (team === 0 ? -1 : 1) * (6 + fromMiddle * (half - 6));
    return { x, y: r.y + pad + across * (r.h - pad * 2) };
  }
  const half = r.h / 2 - pad;
  const y = r.y + r.h / 2 + (team === 0 ? -1 : 1) * (6 + fromMiddle * (half - 6));
  return { x: r.x + pad + across * (r.w - pad * 2), y };
}

function drawCourt(g: Phaser.GameObjects.Graphics, r: Rect, soccer: boolean) {
  // a raked, slightly darker patch of sand with white lines
  g.fillStyle(0xe8cf98, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 6);
  const i = 5;
  g.lineStyle(2.4, 0xffffff, 0.95).strokeRect(r.x + i, r.y + i, r.w - i * 2, r.h - i * 2);
  if (soccer) {
    const mx = r.x + r.w / 2;
    g.lineBetween(mx, r.y + i, mx, r.y + r.h - i);
    g.strokeCircle(mx, r.y + r.h / 2, r.h * 0.16);
    // goals at both ends
    const gh = r.h * 0.3;
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRect(r.x + i - 4, r.y + r.h / 2 - gh / 2, 6, gh);
    g.strokeRect(r.x + r.w - i - 2, r.y + r.h / 2 - gh / 2, 6, gh);
  } else {
    // the net across the middle, with its posts
    const my = r.y + r.h / 2;
    g.lineStyle(2, 0x6b5330, 0.25).lineBetween(r.x + 2, my + 3, r.x + r.w - 2, my + 3);
    g.lineStyle(2.6, 0x30343a, 1).lineBetween(r.x + 1, my, r.x + r.w - 1, my);
    g.fillStyle(0x30343a, 1).fillCircle(r.x + 1, my, 2.6).fillCircle(r.x + r.w - 1, my, 2.6);
  }
}

function dashedRect(g: Phaser.GameObjects.Graphics, r: Rect, color: number, alpha: number) {
  g.fillStyle(color, 0.12).fillRoundedRect(r.x, r.y, r.w, r.h, 6);
  g.lineStyle(2.5, color, alpha);
  const dash = 9;
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += dash * 2) {
      const a = d / len;
      const b = Math.min(1, (d + dash) / len);
      g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
    }
  };
  edge(r.x, r.y, r.x + r.w, r.y);
  edge(r.x + r.w, r.y, r.x + r.w, r.y + r.h);
  edge(r.x + r.w, r.y + r.h, r.x, r.y + r.h);
  edge(r.x, r.y + r.h, r.x, r.y);
}

/** Cars driving along the road behind the beach front, both ways. Fixed speeds and colours. */
export class RoadView {
  private cars: { g: Phaser.GameObjects.Graphics; lane: number; speed: number; start: number }[] = [];
  private static readonly FROM = -4 * UNIT;
  private static readonly TO = 19 * UNIT;

  constructor(scene: Phaser.Scene) {
    const colors = [0xff5a45, 0x2f8dff, 0xffd23f, 0xffffff, 0x3cbf6a, 0xff8fb8];
    const road = LAND.road;
    const lanes = [road.from + (road.to - road.from) * 0.27, road.from + (road.to - road.from) * 0.73];
    colors.forEach((c, i) => {
      const g = scene.add.graphics().setDepth(DEPTH.things - 1.45);
      const dir = i % 2 ? -1 : 1;
      drawCar(g, c, dir);
      this.cars.push({ g, lane: lanes[i % 2] * UNIT, speed: dir * (55 + (i % 3) * 14), start: i * 380 });
    });
  }

  update(time: number) {
    const span = RoadView.TO - RoadView.FROM;
    for (const c of this.cars) {
      const run = (((c.start + (time / 1000) * Math.abs(c.speed)) % span) + span) % span;
      const x = c.speed > 0 ? RoadView.FROM + run : RoadView.TO - run;
      c.g.setPosition(x, c.lane);
    }
  }
}

/** A small car seen from above, pointing along the road (dir 1 = toward higher x). */
function drawCar(g: Phaser.GameObjects.Graphics, color: number, dir: number) {
  const L = 34;
  const W = 16;
  g.fillStyle(0x000000, 0.18).fillRoundedRect(-L / 2 + 2, -W / 2 + 3, L, W, 5);
  g.fillStyle(color, 1).fillRoundedRect(-L / 2, -W / 2, L, W, 5);
  g.fillStyle(0x2c3e50, 0.85);
  // windscreen (front) and rear window
  g.fillRoundedRect(dir > 0 ? 3 : -L / 2 + 5, -W / 2 + 2.5, 8, W - 5, 2);
  g.fillRoundedRect(dir > 0 ? -L / 2 + 4 : L / 2 - 10, -W / 2 + 3, 6, W - 6, 2);
  g.fillStyle(0xfff2b0, 1).fillCircle(dir > 0 ? L / 2 - 1 : -L / 2 + 1, -W / 2 + 3, 1.6).fillCircle(dir > 0 ? L / 2 - 1 : -L / 2 + 1, W / 2 - 3, 1.6);
}
