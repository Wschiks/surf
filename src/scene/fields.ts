import Phaser from 'phaser';
import { BEACH_SPORTS, fieldRect, fieldsArea, type BeachSportDef } from '../config/beach';
import { LAND, rectContains, toWorld, UNIT, type Rect } from '../config/layout';
import { beachSportOpen } from '../core/economy';
import type { GameState } from '../core/state';
import { PLAYER_SIZE, playerTexture, rng } from './art';
import { DEPTH } from './background';

/** Both beach sports play red against blue, so the two teams always read at a glance. */
const TEAM_COLORS = ['#ff4b3e', '#2f7dff'];

/** Where the players of one team stand, as fractions of their half (across, distance from the middle line). */
const FORMATION: [number, number][][] = [
  [[0.5, 0.55]],
  [
    [0.3, 0.5],
    [0.7, 0.5],
  ],
  [
    [0.25, 0.35],
    [0.75, 0.35],
    [0.5, 0.8],
  ],
  [
    [0.27, 0.3],
    [0.73, 0.3],
    [0.3, 0.68],
    [0.5, 0.92],
  ],
  [
    [0.2, 0.28],
    [0.5, 0.22],
    [0.8, 0.28],
    [0.35, 0.62],
    [0.5, 0.95],
  ],
];

interface Player {
  img: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: number;
  /** Soccer: the one guarding the goal (the deepest player, from 3 a side). */
  keeper: boolean;
  /** Seconds left of a little jump (a hit, a header). */
  hop: number;
  face: number;
}

interface Field {
  r: Rect;
  players: Player[];
  ball: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Graphics;
  sim: SoccerGame | VolleyGame;
}

interface Site {
  def: BeachSportDef;
  ground: Phaser.GameObjects.Graphics;
  fields: Field[];
  key: string;
  running: boolean;
}

/**
 * The beach sports on the sand: a dashed plot once a sport can be bought, then its fields (1 to 4) where two teams
 * (red and blue, 1v1 up to 5v5) play while a game runs: soccer with dribbling, passes, pressing, a keeper and goals,
 * volleyball with rallies of bump, set and spike. The movement comes from a small simulation per field, seeded per
 * field, so it always plays out the same way.
 */
export class FieldView {
  private sites: Site[] = [];
  private last = 0;

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
    const dt = this.last ? Math.min(0.1, Math.max(0, (time - this.last) / 1000)) : 0;
    this.last = time;
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
      for (const f of s.fields) {
        f.sim.step(f, s.running ? dt : 0, s.running);
        draw(f, time / 1000);
      }
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
    const sportNo = BEACH_SPORTS.indexOf(s.def);
    for (let i = 0; i < count; i++) {
      const r = toWorld(fieldRect(s.def, i));
      drawCourt(g, r, soccer);
      const players: Player[] = [];
      const spots = FORMATION[Math.min(perTeam, FORMATION.length) - 1];
      for (let team = 0; team < 2; team++) {
        spots.forEach(([a, d], k) => {
          const home = spot(r, soccer, team, a, d);
          const img = this.scene.add.image(home.x, home.y, playerTexture(this.scene, TEAM_COLORS[team], k + i + team)).setDepth(DEPTH.things).setDisplaySize(PLAYER_SIZE, PLAYER_SIZE);
          const face = facingMiddle(soccer, team);
          players.push({ img, home, x: home.x, y: home.y, vx: 0, vy: 0, team, keeper: soccer && perTeam >= 3 && k === spots.length - 1, hop: 0, face });
        });
      }
      const shadow = this.scene.add.graphics().setDepth(DEPTH.things - 0.2);
      shadow.fillStyle(0x6b5330, 0.28).fillEllipse(0, 0, 9, 5);
      const ball = this.scene.add.graphics().setDepth(DEPTH.things + 0.5);
      ball.fillStyle(0xffffff, 1).fillCircle(0, 0, 3.4);
      if (soccer) ball.fillStyle(0x222222, 1).fillCircle(0, 0, 1.2);
      else ball.lineStyle(1.2, 0xffc233, 1).strokeCircle(0, 0, 3.4);
      const field: Field = { r, players, ball, shadow, sim: null! };
      const seed = 1 + sportNo * 101 + i * 37;
      field.sim = soccer ? new SoccerGame(field, seed) : new VolleyGame(field, seed);
      s.fields.push(field);
    }
  }
}

// ---------------------------------------------------------------- movement

/** Run toward a point: speed up and slow down smoothly, never faster than `max` (world px per second). */
function steer(p: Player, tx: number, ty: number, max: number, dt: number) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const want = d < 0.6 ? 0 : Math.min(max, d * 3.2);
  const wx = d > 0 ? (dx / d) * want : 0;
  const wy = d > 0 ? (dy / d) * want : 0;
  const a = Math.min(1, dt * 5);
  p.vx += (wx - p.vx) * a;
  p.vy += (wy - p.vy) * a;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.hop = Math.max(0, p.hop - dt);
}

/** Turn smoothly toward an angle. */
function turn(p: Player, to: number, dt: number) {
  let d = to - p.face;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  p.face += d * Math.min(1, dt * 8);
}

function facingMiddle(soccer: boolean, team: number): number {
  if (soccer) return team === 0 ? 0 : Math.PI;
  return team === 0 ? Math.PI / 2 : -Math.PI / 2;
}

/** Put the players and the ball where the simulation says, with a little running bounce. */
function draw(f: Field, t: number) {
  f.players.forEach((p, k) => {
    const speed = Math.hypot(p.vx, p.vy);
    const run = Math.min(1, speed / 18);
    const bounce = 1 + run * 0.07 * Math.sin(t * 15 + k * 1.7) + (p.hop > 0 ? 0.28 * Math.sin((p.hop / 0.35) * Math.PI) : 0);
    p.img.setPosition(p.x, p.y).setRotation(p.face + Math.PI / 2).setScale((PLAYER_SIZE / p.img.width) * bounce);
  });
  const sim = f.sim;
  f.ball.setPosition(sim.bx, sim.by).setScale(1 + sim.lift * 0.9);
  f.shadow.setPosition(sim.bx + sim.lift * 3, sim.by + 1 + sim.lift * 4).setScale(1 - sim.lift * 0.35);
}

// ---------------------------------------------------------------- soccer

/**
 * Beach soccer: one player has the ball and dribbles toward the other goal, then passes to a teammate (sometimes an
 * opponent cuts it out) or shoots. The nearest opponent presses, the rest of each team shifts with the ball, the
 * keeper follows it along the goal line. After a goal the other team kicks off from the middle.
 */
class SoccerGame {
  bx: number;
  by: number;
  lift = 0;
  private rnd: () => number;
  private owner = -1;
  private holdUntil = 0;
  private clock = 0;
  private pass: { sx: number; sy: number; tx: number; ty: number; t: number; dur: number; to: number; shot: boolean } | null = null;
  private pause = 0;
  private kickTeam = 0;

  constructor(
    private f: Field,
    seed: number,
  ) {
    this.rnd = rng(seed);
    this.bx = f.r.x + f.r.w / 2;
    this.by = f.r.y + f.r.h / 2;
    this.kickoff();
  }

  private get mid() {
    return { x: this.f.r.x + this.f.r.w / 2, y: this.f.r.y + this.f.r.h / 2 };
  }

  /** The goal a team attacks: team 0 plays to the right, team 1 to the left. */
  private goalX(team: number): number {
    return team === 0 ? this.f.r.x + this.f.r.w - 5 : this.f.r.x + 5;
  }

  private kickoff() {
    const m = this.mid;
    this.bx = m.x;
    this.by = m.y;
    this.pass = null;
    // the most forward player of the kicking team takes it
    const team = this.f.players.filter((p) => p.team === this.kickTeam && !p.keeper);
    const first = team.reduce((a, b) => (Math.abs(b.home.x - m.x) < Math.abs(a.home.x - m.x) ? b : a), team[0] ?? this.f.players[0]);
    this.owner = this.f.players.indexOf(first);
    this.holdUntil = this.clock + 0.8 + this.rnd() * 0.6;
  }

  step(f: Field, dt: number, running: boolean) {
    const ps = f.players;
    const m = this.mid;
    if (!running) {
      // waiting for a tap: back to their places, the ball in the middle
      for (const p of ps) {
        steer(p, p.home.x, p.home.y, 22, 1 / 60);
        turn(p, facingMiddle(true, p.team), 1 / 60);
      }
      this.bx = m.x;
      this.by = m.y;
      this.lift = 0;
      return;
    }
    this.clock += dt;
    const r = f.r;
    const inX = (x: number) => Math.min(r.x + r.w - 6, Math.max(r.x + 6, x));
    const inY = (y: number) => Math.min(r.y + r.h - 6, Math.max(r.y + 6, y));

    // the ball
    if (this.pause > 0) {
      this.pause -= dt;
      if (this.pause <= 0) this.kickoff();
    } else if (this.pass) {
      const p = this.pass;
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      const e = 1 - (1 - k) * (1 - k);
      this.bx = p.sx + (p.tx - p.sx) * e;
      this.by = p.sy + (p.ty - p.sy) * e;
      this.lift = p.shot ? 0.25 * Math.sin(Math.PI * k) : 0.12 * Math.sin(Math.PI * k);
      if (k >= 1) {
        this.lift = 0;
        this.pass = null;
        if (p.shot) {
          // goal! a short pause, then the other team kicks off
          const scorer = ps[p.to];
          this.kickTeam = scorer ? 1 - scorer.team : 0;
          this.pause = 1.1;
          this.owner = -1;
        } else {
          this.owner = p.to;
          this.holdUntil = this.clock + 0.5 + this.rnd() * 1.1;
        }
      }
    } else if (this.owner >= 0) {
      const o = ps[this.owner];
      const dir = o.team === 0 ? 1 : -1;
      // the ball rolls just in front of the player with it
      this.bx = o.x + Math.cos(o.face) * 5;
      this.by = o.y + Math.sin(o.face) * 5;
      this.lift = 0;
      // an opponent right next to the ball can win it
      for (let i = 0; i < ps.length; i++) {
        const q = ps[i];
        if (q.team === o.team || Math.hypot(q.x - this.bx, q.y - this.by) > 5.5) continue;
        if (this.rnd() < dt * 1.2) {
          this.owner = i;
          q.hop = 0.25;
          this.holdUntil = this.clock + 0.4 + this.rnd() * 0.6;
        }
        break;
      }
      if (this.clock >= this.holdUntil && this.owner >= 0) {
        const o2 = ps[this.owner];
        const gx = this.goalX(o2.team);
        const mates = ps.map((p, i) => ({ p, i })).filter((x) => x.p.team === o2.team && x.i !== this.owner);
        const close = Math.abs(gx - o2.x) < r.w * 0.33;
        if (close || mates.length === 0 || this.rnd() < 0.15) {
          // shoot at the goal
          const ty = m.y + (this.rnd() - 0.5) * r.h * 0.22;
          this.pass = { sx: this.bx, sy: this.by, tx: gx - (o2.team === 0 ? -2 : 2), ty, t: 0, dur: Math.max(0.25, Math.abs(gx - this.bx) / 120), to: this.owner, shot: true };
          o2.hop = 0.3;
        } else {
          // pass to a teammate, preferably one further forward; sometimes an opponent cuts it out
          mates.sort((a, b) => dir * (b.p.x - a.p.x));
          const pick = mates[Math.floor(this.rnd() * Math.min(2, mates.length))];
          let to = pick.i;
          let tx = pick.p.x + pick.p.vx * 0.3;
          let ty = pick.p.y + pick.p.vy * 0.3;
          if (this.rnd() < 0.2) {
            const mx = (this.bx + tx) / 2;
            const my = (this.by + ty) / 2;
            const cut = ps.map((p, i) => ({ p, i })).filter((x) => x.p.team !== o2.team && !x.p.keeper).sort((a, b) => Math.hypot(a.p.x - mx, a.p.y - my) - Math.hypot(b.p.x - mx, b.p.y - my))[0];
            if (cut) {
              to = cut.i;
              tx = mx;
              ty = my;
            }
          }
          const dist = Math.hypot(tx - this.bx, ty - this.by);
          this.pass = { sx: this.bx, sy: this.by, tx: inX(tx), ty: inY(ty), t: 0, dur: Math.max(0.3, dist / 70), to, shot: false };
        }
        this.owner = -1;
      }
    }

    // the players
    const holder = this.owner >= 0 ? ps[this.owner] : null;
    const attacking = holder ? holder.team : this.pass && !this.pass.shot ? ps[this.pass.to]?.team ?? -1 : -1;
    // the nearest outfield player of each team goes for a loose ball; only the defending team presses the holder
    const nearest = [0, 1].map((team) => {
      let best = -1;
      let bd = Infinity;
      ps.forEach((p, i) => {
        if (p.team !== team || p.keeper || i === this.owner) return;
        const d = Math.hypot(p.x - this.bx, p.y - this.by);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    });
    ps.forEach((p, i) => {
      const dir = p.team === 0 ? 1 : -1;
      let tx: number;
      let ty: number;
      let speed = 24;
      if (i === this.owner) {
        // dribble toward the goal, weaving a little
        tx = p.x + dir * 22;
        ty = m.y + Math.sin(this.clock * 1.4 + i) * r.h * 0.28;
        speed = 19;
      } else if (this.pass && !this.pass.shot && i === this.pass.to) {
        tx = this.pass.tx;
        ty = this.pass.ty;
        speed = 28;
      } else if (p.keeper) {
        // the keeper walks along the goal line with the ball
        tx = (p.team === 0 ? r.x : r.x + r.w) + dir * 9;
        ty = m.y + Math.max(-r.h * 0.18, Math.min(r.h * 0.18, (this.by - m.y) * 0.6));
        speed = 20;
      } else if (this.pause <= 0 && i === nearest[p.team] && attacking !== p.team) {
        tx = this.bx;
        ty = this.by;
        speed = 23;
      } else {
        // keep the shape, shifted toward the ball; the team with the ball moves up
        const push = attacking === p.team ? 9 : attacking === -1 ? 0 : -5;
        tx = p.home.x + (this.bx - m.x) * 0.45 + dir * push;
        ty = p.home.y + (this.by - p.home.y) * 0.25;
        speed = 18;
      }
      steer(p, inX(tx), inY(ty), speed, dt);
      const moving = Math.hypot(p.vx, p.vy) > 4;
      turn(p, moving ? Math.atan2(p.vy, p.vx) : Math.atan2(this.by - p.y, this.bx - p.x), dt);
    });
  }
}

// ---------------------------------------------------------------- volleyball

/**
 * Beach volleyball: rallies. A team gets up to three touches (bump, set, spike, fewer with fewer players); the last
 * one goes over the net to a spot on the other side, and the nearest opponent runs there to take it. Now and then a
 * spike is not reached: the ball lands, a short pause, and the winning team serves.
 */
class VolleyGame {
  bx: number;
  by: number;
  lift = 0;
  private rnd: () => number;
  private flight: { sx: number; sy: number; tx: number; ty: number; t: number; dur: number; peak: number; to: number; miss: boolean } | null = null;
  private side = 0;
  private touch = 0;
  private pause = 0;

  constructor(
    private f: Field,
    seed: number,
  ) {
    this.rnd = rng(seed);
    this.bx = f.r.x + f.r.w / 2;
    this.by = f.r.y + f.r.h / 2;
    this.serve(0);
  }

  private netY() {
    return this.f.r.y + this.f.r.h / 2;
  }

  private team(t: number) {
    return this.f.players.map((p, i) => ({ p, i })).filter((x) => x.p.team === t);
  }

  /** The back player of a team serves over the net. */
  private serve(team: number) {
    const ps = this.team(team);
    const server = ps.reduce((a, b) => (Math.abs(b.p.home.y - this.netY()) > Math.abs(a.p.home.y - this.netY()) ? b : a), ps[0]);
    this.side = team;
    this.touch = 0;
    this.bx = server.p.x;
    this.by = server.p.y;
    this.over(server.i, 0.95, 1.1);
  }

  /** Hit the ball over the net to a spot on the other side; the nearest opponent runs for it. */
  private over(from: number, dur: number, peak: number) {
    const r = this.f.r;
    const other = 1 - this.f.players[from].team;
    const sign = other === 0 ? -1 : 1;
    const tx = r.x + r.w * (0.18 + this.rnd() * 0.64);
    const ty = this.netY() + sign * (r.h / 2) * (0.3 + this.rnd() * 0.5);
    const opp = this.team(other).sort((a, b) => Math.hypot(a.p.x - tx, a.p.y - ty) - Math.hypot(b.p.x - tx, b.p.y - ty))[0];
    this.f.players[from].hop = 0.35;
    this.flight = { sx: this.bx, sy: this.by, tx, ty, t: 0, dur, peak, to: opp.i, miss: this.rnd() < 0.12 };
    this.side = other;
    this.touch = 0;
  }

  step(f: Field, dt: number, running: boolean) {
    const ps = f.players;
    const net = this.netY();
    if (!running) {
      for (const p of ps) {
        steer(p, p.home.x, p.home.y, 20, 1 / 60);
        turn(p, facingMiddle(false, p.team), 1 / 60);
      }
      this.bx = f.r.x + f.r.w / 2;
      this.by = net;
      this.lift = 0;
      return;
    }
    if (this.pause > 0) {
      this.pause -= dt;
      this.lift = 0;
      if (this.pause <= 0) this.serve(1 - this.side);
    } else if (this.flight) {
      const fl = this.flight;
      fl.t += dt;
      const k = Math.min(1, fl.t / fl.dur);
      this.bx = fl.sx + (fl.tx - fl.sx) * k;
      this.by = fl.sy + (fl.ty - fl.sy) * k;
      this.lift = fl.peak * Math.sin(Math.PI * k);
      if (k >= 1) {
        this.flight = null;
        if (fl.miss) {
          // not reached: the ball drops in the sand; the other team wins the point and serves
          this.pause = 1.2;
        } else {
          const hitter = fl.to;
          const team = ps[hitter].team;
          this.touch++;
          const mates = this.team(team).filter((x) => x.i !== hitter);
          const most = Math.min(3, mates.length + 1);
          if (this.touch < most && mates.length > 0) {
            // bump or set to a teammate, high
            const mate = mates[(this.touch + hitter) % mates.length];
            ps[hitter].hop = 0.3;
            const near = this.touch === most - 1;
            const tx = near ? mate.p.x * 0.5 + (f.r.x + f.r.w / 2) * 0.5 : mate.p.x;
            const sign = team === 0 ? -1 : 1;
            const ty = near ? net + sign * f.r.h * 0.12 : mate.p.y;
            this.flight = { sx: this.bx, sy: this.by, tx, ty, t: 0, dur: 0.8, peak: 1.3, to: mate.i, miss: false };
          } else {
            // the last touch: over the net, a spike when someone could set it up
            this.over(hitter, most >= 2 ? 0.5 : 0.85, most >= 2 ? 0.55 : 1.0);
          }
        }
      }
    }
    const fl = this.flight;
    ps.forEach((p, i) => {
      let tx = p.home.x;
      let ty = p.home.y;
      let speed = 16;
      if (fl && i === fl.to && !fl.miss) {
        // run to where the ball comes down
        tx = fl.tx;
        ty = fl.ty;
        speed = 30;
      } else if (fl && fl.miss && i === fl.to) {
        // dives for it, too late
        tx = p.x + (fl.tx - p.x) * 0.6;
        ty = p.y + (fl.ty - p.y) * 0.6;
        speed = 26;
      } else if (p.team === this.side) {
        // the team waiting for the ball slides across with it
        tx = p.home.x + (this.bx - (f.r.x + f.r.w / 2)) * 0.35;
      }
      steer(p, tx, ty, speed, dt);
      // they face the net, turning a little toward the ball
      const toNet = facingMiddle(false, p.team);
      const toBall = Math.atan2(this.by - p.y, this.bx - p.x);
      let d = toBall - toNet;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      turn(p, toNet + Math.max(-0.9, Math.min(0.9, d)), dt);
    });
  }
}

/** Where a player stands: volleyball has the net across the field (teams top and bottom), soccer the halfway line (teams left and right). */
function spot(r: Rect, soccer: boolean, team: number, across: number, fromMiddle: number): { x: number; y: number } {
  const pad = 8;
  if (soccer) {
    const half = r.w / 2 - pad;
    const x = r.x + r.w / 2 + (team === 0 ? -1 : 1) * (5 + fromMiddle * (half - 5));
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
    // goals at both ends, with a net
    const gh = r.h * 0.3;
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(r.x + i - 5, r.y + r.h / 2 - gh / 2, 5, gh);
    g.fillRect(r.x + r.w - i, r.y + r.h / 2 - gh / 2, 5, gh);
    g.lineStyle(3, 0xffffff, 1);
    g.strokeRect(r.x + i - 5, r.y + r.h / 2 - gh / 2, 5, gh);
    g.strokeRect(r.x + r.w - i, r.y + r.h / 2 - gh / 2, 5, gh);
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
      // every car in a lane drives at the same speed, evenly spaced, so they never drive through each other
      const perLane = Math.ceil(colors.length / 2);
      const span = RoadView.TO - RoadView.FROM;
      this.cars.push({ g, lane: lanes[i % 2] * UNIT, speed: dir * (i % 2 ? 72 : 60), start: (Math.floor(i / 2) * span) / perLane + (i % 2) * 120 });
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
