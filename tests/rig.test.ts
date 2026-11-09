import { describe, expect, it } from 'vitest';
import { toWorld } from '../src/config/layout';
import { ZONES, type GuestKind } from '../src/config/sports';
import { MapView } from '../src/scene/MapView';
import { add, angleTo, dir, head, headingOf, len, rot, shadowOffset, sub, v } from '../src/scene/rig/geom';
import { GEAR, K, KITE, SAIL, SKIM, SURF, WIND, WING, fromDrawn, visibleGuests } from '../src/scene/rig/models';
import { newGuest, relax, rigPoint, SPACE, WIND_FROM, type Guest, type Zone } from '../src/scene/rig/sim';
import { stepGuest, stepZone } from '../src/scene/rig/step';
import { playerPose } from '../src/scene/rig/sports/players';
import { raceCourse } from '../src/scene/rig/sports/sail';

// The acceptance checklist of the guest models (docs/models/README.md, part 5) and the signature of every section of
// every sport (docs/SPORTS.md), as far as a test can check them.

function makeZone(id: string, active = true): { z: Zone; kind: GuestKind; n: number } {
  const ref = ZONES.find((r) => r.id === id)!;
  const r = toWorld(ref.def.rect);
  const kind = ref.sport.guestKind;
  const z: Zone = { ...r, level: ref.level, active, t: 0, windFrom: WIND_FROM, guests: [], fx: [], marks: [], extras: [], s: {} };
  if (kind === 'sailor') raceCourse(z);
  const n = visibleGuests(kind, ref.level);
  for (let i = 0; i < n; i++) z.guests.push(newGuest(kind, i, z, n));
  return { z, kind, n };
}

/** Run a zone for `seconds` at 60 steps a second, calling `each` after every step. */
function run(z: Zone, kind: GuestKind, n: number, seconds: number, each?: (g: Guest) => void) {
  for (let k = 0; k < seconds * 60; k++) {
    z.t += 1 / 60;
    stepZone(z, kind, 1 / 60);
    for (const g of z.guests) stepGuest(g, z, n, 1 / 60);
    relax(z, kind);
    if (each) for (const g of z.guests) each(g);
    z.fx.length = 0;
  }
}

/** Which states the guests of a section go through in `seconds`. */
function statesOf(id: string, seconds: number): Set<string> {
  const { z, kind, n } = makeZone(id);
  const seen = new Set<string>();
  run(z, kind, n, seconds, (g) => seen.add(g.state));
  return seen;
}

const ALL = ZONES.map((r) => r.id);

describe('guest models: the rider', () => {
  it('sideways riders stand with their feet 60-70 px apart (no splits)', () => {
    for (const p of [SURF.stand, SKIM.stand, WIND.stand, WING.stand, KITE.stand]) {
      const d = len(sub(p.feet[0], p.feet[1]));
      expect(d).toBeGreaterThanOrEqual(60);
      expect(d).toBeLessThanOrEqual(70);
    }
  });

  it('the head sits on the torso, never beside it, and is never wider than half the shoulders', () => {
    for (const p of [SURF.stand, SURF.prone, SKIM.stand, WIND.stand, WING.stand, KITE.stand, SAIL.sailor, playerPose(0, 0, 0, 'ready', 0).pose]) {
      const h = head(p);
      expect(len(sub(h.skin, p.t))).toBeLessThan(Math.max(p.rx, p.ry));
      expect(12.5 * 2).toBeLessThanOrEqual(Math.max(p.rx, p.ry) * 2);
    }
  });

  it('a surfboard is about as long as the rider is tall, not twice as big (1 spec px = 0.8 cm)', () => {
    expect(248 * K).toBeCloseTo(31);
    expect(248 * 0.8).toBeCloseTo(198.4);
  });

  it('the kite rider is drawn in the board frame with the leading tip forward', () => {
    expect(fromDrawn(v(80, 0))).toEqual(v(0, -80));
  });
});

describe('guest models: every section looks different', () => {
  it('the four sections of every sport have their own board, boat or sail', () => {
    for (const [kind, gear] of Object.entries(GEAR)) {
      const looks = new Set(gear.map((g) => `${g.board}|${g.sail}|${g.boat ?? ''}|${g.number ?? ''}|${g.color ?? ''}|${g.rider}|${g.vest ?? ''}`));
      expect(looks.size, kind).toBe(4);
    }
  });
});

describe('guest models: the simulation', () => {
  it('is the same every time (nothing random)', () => {
    const a = makeZone('wave-4');
    const b = makeZone('wave-4');
    run(a.z, a.kind, a.n, 25);
    run(b.z, b.kind, b.n, 25);
    expect(a.z.guests.map((g) => [g.x, g.y, g.h])).toEqual(b.z.guests.map((g) => [g.x, g.y, g.h]));
  });

  it('every guest of every section stays in its zone, with real numbers, busy and waiting', () => {
    for (const id of ALL) {
      const { z, kind, n } = makeZone(id);
      const pad = 2;
      const bad: string[] = [];
      const check = (g: Guest) => {
        const ok = Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.h) && g.x >= z.x - pad && g.x <= z.x + z.w + pad && g.y >= z.y - pad && g.y <= z.y + z.h + pad && g.look.rider !== null;
        if (!ok && bad.length < 3) bad.push(`${id} guest ${g.i} ${g.state} at ${g.x.toFixed(1)},${g.y.toFixed(1)}`);
      };
      run(z, kind, n, 30, check);
      z.active = false;
      run(z, kind, n, 10, check);
      z.active = true;
      run(z, kind, n, 8, check);
      expect(bad).toEqual([]);
    }
  }, 120_000);

  it('boards and boats keep their distance (they never sit on top of each other)', () => {
    for (const id of ALL) {
      const { z, kind, n } = makeZone(id);
      let close = 0;
      let pairs = 0;
      run(z, kind, n, 20);
      for (let k = 0; k < 300; k++) {
        run(z, kind, n, 1 / 60);
        for (let a = 0; a < n; a++)
          for (let b = a + 1; b < n; b++) {
            pairs++;
            if (Math.hypot(z.guests[a].x - z.guests[b].x, z.guests[a].y - z.guests[b].y) < SPACE[kind] * 0.85) close++;
          }
      }
      expect(close / Math.max(1, pairs), id).toBeLessThan(0.01);
    }
  }, 120_000);

  it('no guest is ever frozen: everything on the water bobs, also while waiting', () => {
    for (const id of ['wave-2', 'windsurfing-2', 'sailing-2']) {
      const { z, kind, n } = makeZone(id, false);
      run(z, kind, n, 10);
      const before = z.guests.map((g) => g.look.h);
      run(z, kind, n, 0.6);
      z.guests.forEach((g, i) => expect(Math.abs(g.look.h - before[i])).toBeGreaterThan(1e-4));
    }
  });

  it('windsurfers: the sail is always on the side away from the wind and the hands stay on the boom', () => {
    for (const id of ['windsurfing-1', 'windsurfing-3']) {
      const { z, kind, n } = makeZone(id);
      run(z, kind, n, 30, (g) => {
        if (g.state !== 'reach' || g.st < 0.5) return;
        const right = rot(v(1, 0), g.h);
        const w = dir(z.windFrom);
        const fromRight = w.x * right.x + w.y * right.y >= 0 ? 1 : -1;
        expect(Math.sign(g.look.rig)).toBe(-fromRight);
        const hands = WIND.boomHands.map((h) => add(WIND.mast, rigPoint(v(h.x * g.gear.sail, h.y * g.gear.sail), WIND.drawnAngle, g.look.rig)));
        const [h1, h2] = g.look.rider!.hands;
        expect(len(sub(h1, hands[0]))).toBeLessThan(12);
        expect(len(sub(h2, hands[1]))).toBeLessThan(12);
      });
    }
  });

  it('kitesurfers: the kite flies downwind and to the side of travel, never straight ahead', () => {
    const { z, kind, n } = makeZone('kitesurfing-2');
    run(z, kind, n, 40, (g) => {
      if (g.state !== 'ride' || g.st < 0.4 || !g.look.kite) return;
      const k = sub(v(g.look.kite.x, g.look.kite.y), v(g.x, g.y));
      const down = dir(z.windFrom + Math.PI);
      expect(k.x * down.x + k.y * down.y).toBeGreaterThan(0);
      expect(Math.abs(angleTo(g.h, headingOf(k)))).toBeGreaterThan(15 * (Math.PI / 180));
    });
  });

  it('sailors sit on the windward side; the committee boat is never sailed through', () => {
    const { z, kind, n } = makeZone('sailing-3');
    let bad = 0;
    let all = 0;
    let inside = 0;
    run(z, kind, n, 70, (g) => {
      for (const o of z.obstacles ?? []) if (Math.hypot(g.x - o.x, g.y - o.y) < o.r * 0.7) inside++;
      if (g.m.cross > 0 || !g.look.rider || Math.abs(g.look.rig) < 0.2) return;
      const right = rot(v(1, 0), g.h);
      const w = dir(z.windFrom);
      all++;
      if (Math.sign(g.look.rider.t.x) !== (w.x * right.x + w.y * right.y >= 0 ? 1 : -1)) bad++;
    });
    expect(bad / all).toBeLessThan(0.03);
    expect(inside).toBe(0);
  });
});

describe('guest models: the signature of every section (docs/SPORTS.md)', () => {
  it('surf school: kids ride the white water in and fall; longboarders walk to the nose', () => {
    const school = statesOf('wave-1', 40);
    expect(school.has('foam') && school.has('fall') && school.has('walk')).toBe(true);
    const { z, kind, n } = makeZone('wave-2');
    let nose = 0;
    run(z, kind, n, 40, (g) => {
      if (g.state === 'ride' && g.look.rider!.t.y < -40) nose++;
    });
    expect(nose).toBeGreaterThan(50);
  });

  it('reef and Nazaré: surfers disappear in the barrel; at Nazaré a jet ski tows them in and picks them up', () => {
    for (const id of ['wave-3', 'wave-4']) {
      const { z, kind, n } = makeZone(id);
      let barreled = 0;
      run(z, kind, n, 50, (g) => {
        if (g.state === 'ride' && g.look.riderAlpha < 0.5) barreled++;
      });
      expect(barreled, id).toBeGreaterThan(20);
    }
    const naz = statesOf('wave-4', 50);
    expect(naz.has('tow') && naz.has('sled') && naz.has('drop')).toBe(true);
  });

  it('skimboarding: shallows fall, flatland spins, shore break wraps, big shore break flies', () => {
    expect(statesOf('skimboarding-1', 30).has('fall')).toBe(true);
    expect(statesOf('skimboarding-3', 30).has('wrap')).toBe(true);
    expect(statesOf('skimboarding-4', 30).has('air')).toBe(true);
    const { z, kind, n } = makeZone('skimboarding-2');
    let tricks = 0;
    run(z, kind, n, 30, (g) => {
      if (g.state === 'glide' && (Math.abs(angleTo(g.h, g.look.h)) > 1 || Math.abs(g.look.board.rot) > 1 || g.look.scale > 1.05)) tricks++;
    });
    expect(tricks).toBeGreaterThan(0);
  });

  it('windsurfing: the school falls in, slalom races (fast, gybing at the buoys), freestyle does tricks, the wave zone jumps', () => {
    expect(statesOf('windsurfing-1', 40).has('uphaul')).toBe(true);
    const { z, kind, n } = makeZone('windsurfing-2');
    let fast = 0;
    let gybes = 0;
    run(z, kind, n, 40, (g) => {
      if (g.speed > 30) fast++;
      if (g.state === 'gybe' && g.st < 0.02) gybes++;
    });
    expect(z.buoys?.length).toBe(3);
    expect(fast).toBeGreaterThan(500);
    expect(gybes).toBeGreaterThan(5);
    expect(statesOf('windsurfing-3', 30).has('trick')).toBe(true);
    expect(statesOf('windsurfing-4', 30).has('jump')).toBe(true);
  });

  it('kitesurfing: the school crashes the kite, the others jump (tricks, big air and kiteloops)', () => {
    expect(statesOf('kitesurfing-1', 40).has('crash')).toBe(true);
    for (const id of ['kitesurfing-3', 'kitesurfing-4']) expect(statesOf(id, 40).has('jump'), id).toBe(true);
  });

  it('foil: the school only hops and falls, the others fly; the pro arena jumps', () => {
    const school = statesOf('foil-1', 40);
    expect(school.has('hop') && school.has('fall') && !school.has('fly')).toBe(true);
    expect(statesOf('foil-2', 30).has('fly')).toBe(true);
    expect(statesOf('foil-4', 60).has('jump')).toBe(true);
  });

  it('sailing: Optimists capsize, catamarans fly a hull, the club races from a start line, yachts fly a spinnaker', () => {
    expect(statesOf('sailing-1', 90).has('capsize')).toBe(true);
    const hire = makeZone('sailing-2');
    let flying = 0;
    run(hire.z, hire.kind, hire.n, 60, (g) => {
      if (g.gear.boat === 'cat' && g.look.lift > 0.2) flying++;
    });
    expect(flying).toBeGreaterThan(0);
    const club = makeZone('sailing-3');
    run(club.z, club.kind, club.n, 2);
    expect(club.z.extras.some((e) => e.kind === 'committee')).toBe(true);
    const off = makeZone('sailing-4');
    let spin = 0;
    run(off.z, off.kind, off.n, 80, (g) => {
      if (g.look.spin) spin++;
    });
    expect(spin).toBeGreaterThan(0);
  });
});

describe('guest models: the light', () => {
  it('shadows always fall down-right on the screen, whatever the map rotation', () => {
    const view = new MapView();
    view.resize(400, 800);
    const o = shadowOffset(7, 10);
    const a = view.worldToScreen(500, 300);
    const b = view.worldToScreen(500 + o.x * 100, 300 + o.y * 100);
    expect(b.x - a.x).toBeGreaterThan(0);
    expect(b.y - a.y).toBeGreaterThan(0);
    expect((b.y - a.y) / (b.x - a.x)).toBeCloseTo(10 / 7, 1);
  });
});
