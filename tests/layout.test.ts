import { describe, expect, it } from 'vitest';
import { AREAS, areaById } from '../src/config/areas';
import { FACILITIES } from '../src/config/facilities';
import { LAND, MAP_H, MAP_W, type Rect } from '../src/config/layout';
import { BEACH_SPORTS, fieldRect, MAX_FIELDS } from '../src/config/beach';
import { SHORE } from '../src/config/areas';
import { SPORTS, ZONES } from '../src/config/sports';

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('map layout data', () => {
  it('the map is 15 wide and 9.6 deep; the areas fill it: the beach, then Wave, Sea and Ocean (Sea and Ocean made deeper, author request)', () => {
    expect(MAP_W).toBe(15);
    expect(MAP_H).toBe(9.6);
    expect(AREAS.map((a) => a.id)).toEqual(['beach', 'wave', 'sea', 'ocean']);
    expect(AREAS[0].from).toBe(0);
    expect(AREAS[0].to).toBeCloseTo(1.6);
    for (let i = 1; i < AREAS.length; i++) expect(AREAS[i].from).toBe(AREAS[i - 1].to);
    expect(AREAS[AREAS.length - 1].to).toBe(MAP_H);
    expect(AREAS.map((a) => a.expansion)).toEqual([0, 0, 1, 2]);
  });

  it('every zone lies inside the map and inside the area of its sport', () => {
    for (const z of ZONES) {
      const r = z.def.rect;
      const area = areaById(z.sport.area);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(MAP_W);
      expect(r.y).toBeGreaterThanOrEqual(area.from);
      expect(r.y + r.h).toBeLessThanOrEqual(area.to);
    }
  });

  it('no two zones overlap', () => {
    for (let i = 0; i < ZONES.length; i++)
      for (let j = i + 1; j < ZONES.length; j++) expect(overlap(ZONES[i].def.rect, ZONES[j].def.rect), `${ZONES[i].id} and ${ZONES[j].id}`).toBe(false);
  });

  it('the levels of a sport move away from the beach (or along the row in the Ocean)', () => {
    for (const sport of SPORTS.filter((x) => x.area !== 'ocean')) {
      const depth = sport.levels.map((l) => l.rect.y);
      for (let i = 1; i < depth.length; i++) expect(depth[i]).toBeGreaterThanOrEqual(depth[i - 1]);
    }
  });

  it('the Sea sports are side by side, the Ocean has sailing, beach sites are on the beach', () => {
    const sea = SPORTS.filter((s) => s.area === 'sea');
    expect(sea.map((s) => s.id)).toEqual(['windsurfing', 'kitesurfing', 'foil']);
    const xs = sea.map((s) => Math.min(...s.levels.map((l) => l.rect.x)));
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(SPORTS.filter((s) => s.area === 'ocean').map((s) => s.id)).toEqual(['sailing']);
    for (const s of SPORTS) if (s.beachSite) expect(s.beachSite.rect.y).toBeLessThan(1.6); // starts on the beach
    expect(SPORTS.find((s) => s.id === 'kitesurfing')?.beachSite?.id).toBe('kite-launch');
    expect(SPORTS.find((s) => s.id === 'sailing')?.beachSite).toBeUndefined(); // the jetty is gone (author's choice)
  });

  it('beach facilities stand on the beach front (the promenade) and beach sites do not sit on them', () => {
    for (const f of FACILITIES) {
      // the building's foot (at.y + 0.5) stands on the promenade
      expect(f.at.y + 0.5).toBeGreaterThan(LAND.promenade.from);
      expect(f.at.y + 0.5).toBeLessThan(LAND.promenade.to);
      for (const s of SPORTS) {
        const site = s.beachSite?.rect;
        if (site) expect(overlap({ x: f.at.x - 0.5, y: f.at.y + 0.2, w: 1.0, h: 0.4 }, site), `${f.id} vs ${s.id} site`).toBe(false);
      }
    }
  });

  it('beach sport fields lie on the sand, inside the map, clear of the beach sites and of each other', () => {
    const all: { id: string; r: Rect }[] = [];
    for (const b of BEACH_SPORTS) {
      for (let i = 0; i < MAX_FIELDS; i++) {
        const r = fieldRect(b, i);
        expect(r.y).toBeGreaterThanOrEqual(LAND.wall);
        expect(r.y + r.h).toBeLessThan(SHORE);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(MAP_W);
        for (const s of SPORTS) if (s.beachSite) expect(overlap(r, s.beachSite.rect), `${b.id} field ${i} vs ${s.id} site`).toBe(false);
        all.push({ id: `${b.id}-${i}`, r });
      }
    }
    for (const a of all) for (const b of all) if (a !== b) expect(overlap(a.r, b.r), `${a.id} vs ${b.id}`).toBe(false);
  });
});
