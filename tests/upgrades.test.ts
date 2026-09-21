import { describe, expect, it } from 'vitest';
import { LEVEL_MILESTONES, milestoneMult, nextMilestone, STATS } from '../src/config/balance';
import { FACILITIES } from '../src/config/facilities';
import { zoneById } from '../src/config/sports';
import { buyStat, planBuy, statCost, zoneStats } from '../src/core/economy';
import { newGame } from '../src/core/state';

const W1 = zoneById('wave-1');

describe('level up milestones', () => {
  it('follow the list: 25 x1.1, 50 x1.2, 75 x1.5, 100 x1.75, 200 x2, 300 x2, then every 100 levels x2', () => {
    expect(LEVEL_MILESTONES).toEqual([[25, 1.1], [50, 1.2], [75, 1.5], [100, 1.75], [200, 2], [300, 2]]);
    expect(milestoneMult(24)).toBe(1);
    expect(milestoneMult(25)).toBeCloseTo(1.1);
    expect(milestoneMult(50)).toBeCloseTo(1.1 * 1.2);
    expect(milestoneMult(75)).toBeCloseTo(1.1 * 1.2 * 1.5);
    expect(milestoneMult(100)).toBeCloseTo(1.1 * 1.2 * 1.5 * 1.75);
    expect(milestoneMult(200)).toBeCloseTo(1.1 * 1.2 * 1.5 * 1.75 * 2);
    expect(milestoneMult(300)).toBeCloseTo(1.1 * 1.2 * 1.5 * 1.75 * 4);
    expect(milestoneMult(399)).toBeCloseTo(milestoneMult(300));
    expect(milestoneMult(400)).toBeCloseTo(milestoneMult(300) * 2);
    expect(milestoneMult(500)).toBeCloseTo(milestoneMult(300) * 4);
    expect(milestoneMult(1000)).toBeCloseTo(milestoneMult(300) * 2 ** 7);
  });

  it('tells what the next bonus is', () => {
    expect(nextMilestone(0)).toEqual({ level: 25, mult: 1.1 });
    expect(nextMilestone(99)).toEqual({ level: 100, mult: 1.75 });
    expect(nextMilestone(300)).toEqual({ level: 400, mult: 2 });
  });

  it('level up can be bought a thousand times, each step is small, and the bonus shows in the income', () => {
    expect(STATS.price.max).toBe(1000);
    const s = newGame(0);
    s.coins = 1e30;
    const base = zoneStats(s, W1).pricePerGuest;
    buyStat(s, 'wave-1', 'price', 1);
    const step = zoneStats(s, W1).pricePerGuest / base;
    expect(step).toBeGreaterThan(1);
    expect(step).toBeLessThan(1.1); // a small step
    buyStat(s, 'wave-1', 'price', 24); // level 25
    const at25 = zoneStats(s, W1).pricePerGuest;
    const at24 = base * (1 + 0.05 * 24);
    expect(at25 / (base * (1 + 0.05 * 25))).toBeCloseTo(1.1);
    expect(at25).toBeGreaterThan(at24);
    buyStat(s, 'wave-1', 'price', 'max');
    expect(s.zones['wave-1'].price).toBe(1000);
  });
});

describe('buying many levels at once', () => {
  it('buys as many as the coins allow, up to the chosen amount', () => {
    const s = newGame(0);
    s.coins = statCost(W1, 'price', 0) * 3;
    expect(buyStat(s, 'wave-1', 'price', 10)).toBe(true);
    const n = s.zones['wave-1'].price;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThan(10);
    expect(s.coins).toBeGreaterThanOrEqual(0);
  });

  it('the plan adds up the costs of every level', () => {
    const plan = planBuy(W1, 'price', 0, 1e30, 10);
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += statCost(W1, 'price', i);
    expect(plan.count).toBe(10);
    expect(plan.cost).toBe(sum);
    expect(planBuy(W1, 'price', 0, 1, 10).count).toBe(0);
  });

  it('Max stops at the top level', () => {
    const plan = planBuy(W1, 'speed', 0, 1e300, 'max');
    expect(plan.count).toBe(STATS.speed.max);
  });
});

describe('what costs what', () => {
  it('faster and bigger class are dearer than a level up', () => {
    for (const stat of ['capacity', 'speed'] as const) {
      expect(statCost(W1, stat, 0)).toBeGreaterThan(statCost(W1, 'price', 0));
      expect(statCost(W1, stat, 20)).toBeGreaterThan(statCost(W1, 'price', 20));
    }
    expect(statCost(W1, 'speed', 0)).toBeGreaterThan(statCost(W1, 'capacity', 0));
  });

  it('beach buildings are dear', () => {
    for (const f of FACILITIES) expect(f.baseCost).toBeGreaterThanOrEqual(5000);
  });
});
