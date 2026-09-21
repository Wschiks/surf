import { describe, expect, it } from 'vitest';
import { AREAS, areaById } from '../src/config/areas';
import { FACILITIES } from '../src/config/facilities';
import { MAP_UNITS, type Rect } from '../src/config/layout';
import { SPORTS, ZONES } from '../src/config/sports';

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('map layout data', () => {
  it('areas cover the 10 rows: beach 20%, then Wave, Sea and Ocean', () => {
    expect(AREAS.map((a) => a.id)).toEqual(['beach', 'wave', 'sea', 'ocean']);
    expect(AREAS[0].from).toBe(0);
    expect(AREAS[0].to / MAP_UNITS).toBeCloseTo(0.2);
    for (let i = 1; i < AREAS.length; i++) expect(AREAS[i].from).toBe(AREAS[i - 1].to);
    expect(AREAS[AREAS.length - 1].to).toBe(MAP_UNITS);
  });

  it('every zone lies inside the map and inside the area of its sport', () => {
    for (const z of ZONES) {
      const r = z.def.rect;
      const area = areaById(z.sport.area);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(MAP_UNITS);
      expect(r.y).toBeGreaterThanOrEqual(area.from);
      expect(r.y + r.h).toBeLessThanOrEqual(area.to);
    }
  });

  it('no two zones overlap', () => {
    for (let i = 0; i < ZONES.length; i++)
      for (let j = i + 1; j < ZONES.length; j++) expect(overlap(ZONES[i].def.rect, ZONES[j].def.rect), `${ZONES[i].id} and ${ZONES[j].id}`).toBe(false);
  });

  it('the wave surfing levels move away from the beach', () => {
    const wave = SPORTS.find((s) => s.id === 'wave')!;
    const depth = wave.levels.map((l) => l.rect.y);
    for (let i = 1; i < depth.length; i++) expect(depth[i]).toBeGreaterThanOrEqual(depth[i - 1]);
  });

  it('the Sea sports are side by side, the Ocean has sailing, beach sites are on the beach', () => {
    const sea = SPORTS.filter((s) => s.area === 'sea');
    expect(sea.map((s) => s.id)).toEqual(['windsurfing', 'kitesurfing', 'foil']);
    const xs = sea.map((s) => Math.min(...s.levels.map((l) => l.rect.x)));
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(SPORTS.filter((s) => s.area === 'ocean').map((s) => s.id)).toEqual(['sailing']);
    for (const s of SPORTS) if (s.beachSite) expect(s.beachSite.rect.y).toBeLessThan(2); // starts on the beach (a jetty reaches into the water)
    expect(SPORTS.find((s) => s.id === 'kitesurfing')?.beachSite?.id).toBe('kite-launch');
    expect(SPORTS.find((s) => s.id === 'sailing')?.beachSite?.id).toBe('jetty');
  });

  it('beach facilities stand on the beach and beach sites do not sit on them', () => {
    for (const f of FACILITIES) {
      expect(f.at.y).toBeGreaterThanOrEqual(0);
      expect(f.at.y).toBeLessThan(2);
      for (const s of SPORTS) {
        const site = s.beachSite?.rect;
        if (site) expect(overlap({ x: f.at.x - 0.5, y: f.at.y + 0.2, w: 1.0, h: 0.4 }, site), `${f.id} vs ${s.id} site`).toBe(false);
      }
    }
  });

  it('the map is 10 by 10 units', () => {
    expect(MAP_UNITS).toBe(10);
  });
});
