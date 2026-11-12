import { describe, expect, it } from 'vitest';
import { PLANE } from '../src/config/plane';
import { autoIncomePerSecond } from '../src/core/economy';
import { claimPlanePrize, planeDelay, planeUnlocked, rollPlanePrize } from '../src/core/plane';
import { newGame } from '../src/core/state';

const withManager = () => {
  const s = newGame(0);
  s.zones['wave-1'].manager = true;
  return s;
};

describe('banner plane', () => {
  it('only comes once a zone has a manager', () => {
    const s = newGame(0);
    expect(planeUnlocked(s)).toBe(false);
    s.zones['wave-1'].manager = true;
    expect(planeUnlocked(s)).toBe(true);
  });

  it('first after 20-50 s, after a claim 2-3 min, after a miss 1.5-2 min (it replaces the x2 button)', () => {
    expect(planeDelay('first', 0)).toBe(20);
    expect(planeDelay('first', 1)).toBe(50);
    expect(planeDelay('claimed', 0)).toBe(120);
    expect(planeDelay('claimed', 1)).toBe(180);
    expect(planeDelay('missed', 0)).toBe(90);
    expect(planeDelay('missed', 1)).toBe(120);
  });

  it('prizes: 25% coins, 55% x2 for 5 min, 12% a skin box, 8% 3 gems', () => {
    const s = withManager();
    expect(rollPlanePrize(s, 0).kind).toBe('coins');
    expect(rollPlanePrize(s, 0.24).kind).toBe('coins');
    expect(rollPlanePrize(s, 0.25)).toEqual({ kind: 'boost', seconds: 300 });
    expect(rollPlanePrize(s, 0.79).kind).toBe('boost');
    expect(rollPlanePrize(s, 0.8)).toEqual({ kind: 'box' });
    expect(rollPlanePrize(s, 0.91).kind).toBe('box');
    expect(rollPlanePrize(s, 0.92)).toEqual({ kind: 'gems', gems: 3 });
    const p = PLANE.prizes;
    expect(p.coins.chance + p.boost.chance + p.box.chance + p.gems.chance).toBeCloseTo(1, 9);
  });

  it('coins are the coins-per-second counter times 5 minutes', () => {
    const s = withManager();
    const p = rollPlanePrize(s, 0);
    expect(p.kind === 'coins' && p.coins).toBeCloseTo(autoIncomePerSecond(s) * 300, 6);
    expect(autoIncomePerSecond(s)).toBeGreaterThan(0);
  });

  it('claiming gives the prize; x2 time is added to the boost timer', () => {
    const s = withManager();
    s.boost = 60;
    claimPlanePrize(s, { kind: 'boost', seconds: 300 });
    expect(s.boost).toBe(360);
    const c = s.coins;
    claimPlanePrize(s, { kind: 'coins', coins: 500 });
    expect(s.coins).toBe(c + 500);
    const g = s.skillPoints;
    claimPlanePrize(s, { kind: 'gems', gems: 3 });
    expect(s.skillPoints).toBe(g + 3);
    const b = s.skins.boxes;
    claimPlanePrize(s, { kind: 'box' });
    expect(s.skins.boxes).toBe(b + 1);
  });
});
