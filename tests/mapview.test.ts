import { describe, expect, it } from 'vitest';
import { MapView } from '../src/scene/MapView';
import { UNIT } from '../src/config/layout';

function makeView() {
  const v = new MapView();
  v.resize(400, 800);
  return v;
}

describe('MapView', () => {
  it('starts about 1 unit wide and 2 units high', () => {
    const v = makeView();
    expect(v.width / v.ppu).toBeGreaterThan(0.9);
    expect(v.width / v.ppu).toBeLessThan(1.3);
    expect(v.height / v.ppu).toBeLessThan(2.6);
  });

  it('projects world to screen and back', () => {
    const v = makeView();
    v.jumpTo(300, 400, 200);
    const s = v.worldToScreen(350, 420);
    const w = v.screenToWorld(s.x, s.y);
    expect(w.x).toBeCloseTo(350, 4);
    expect(w.y).toBeCloseTo(420, 4);
  });

  it('puts the view centre in the middle of the screen', () => {
    const v = makeView();
    v.jumpTo(300, 400, 200);
    const s = v.worldToScreen(300, 400);
    expect(s.x).toBeCloseTo(200);
    expect(s.y).toBeCloseTo(400);
  });

  it('keeps the world point under the finger fixed while zooming', () => {
    const v = makeView();
    v.jumpTo(500, 500, 100);
    const before = v.screenToWorld(120, 300);
    v.zoomAt(120, 300, 2);
    const after = v.screenToWorld(120, 300);
    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it('limits zoom between the whole map and the closest view', () => {
    const v = makeView();
    v.zoomAt(200, 400, 0.0001);
    expect(v.ppu).toBeCloseTo(v.minPpu());
    v.zoomAt(200, 400, 10000);
    expect(v.ppu).toBeCloseTo(v.maxPpu());
  });

  it('keeps the view inside the map when panning (it may hang over an edge by a quarter of its size)', () => {
    const v = makeView();
    const size = (v.width / v.ppu) * UNIT + (v.height / v.ppu) * UNIT;
    for (const [dx, dy] of [[-100000, -100000], [100000, 100000], [-100000, 100000], [100000, -100000]]) {
      v.panBy(dx, dy);
      expect(v.cx).toBeGreaterThan(0);
      expect(v.cx).toBeLessThan(10 * UNIT);
      for (const p of v.viewCorners()) {
        expect(p.x).toBeGreaterThanOrEqual(-size / 4);
        expect(p.x).toBeLessThanOrEqual(10 * UNIT + size / 4);
        expect(p.y).toBeGreaterThanOrEqual(-size / 4);
        expect(p.y).toBeLessThanOrEqual(10 * UNIT + size / 4);
      }
    }
  });

  it('can reach every corner of the map when zoomed in', () => {
    const v = makeView();
    v.jumpTo(0, 0);
    expect(v.cx).toBeLessThan(200);
    v.jumpTo(10 * UNIT, 10 * UNIT);
    expect(v.cx).toBeGreaterThan(800);
  });

  it('keeps the view inside the map at every zoom level', () => {
    const v = makeView();
    for (let f = 0; f <= 1; f += 0.1) {
      v.jumpTo(0, 0, v.minPpu() + (v.maxPpu() - v.minPpu()) * f);
      const c = v.viewCorners();
      const xs = c.map((p) => p.x);
      const ys = c.map((p) => p.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      if (w <= 10 * UNIT && h <= 10 * UNIT) {
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(-w / 4 - 0.001);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(-h / 4 - 0.001);
      }
    }
  });

  it('shows the whole map when zoomed out', () => {
    const v = makeView();
    v.jumpTo(500, 500, v.minPpu());
    for (const [x, y] of [[0, 0], [1000, 0], [0, 1000], [1000, 1000]]) {
      const s = v.worldToScreen(x, y);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(400);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(800);
    }
  });

  it('lifts the target above the screen centre', () => {
    const v = makeView();
    v.jumpTo(500, 500, 250);
    v.animateTo(500, 500, 300, 150);
    for (let i = 0; i < 200; i++) v.update(0.05);
    const s = v.worldToScreen(500, 500);
    expect(s.x).toBeCloseTo(200, 0);
    expect(s.y).toBeCloseTo(250, 0);
  });
});
