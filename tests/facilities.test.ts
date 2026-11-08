import { describe, expect, it } from 'vitest';
import { FACILITIES } from '../src/config/facilities';
import { SPORTS } from '../src/config/sports';
import { buyFacility, facilityCost } from '../src/core/economy';
import { newGame } from '../src/core/state';

describe('a house for every stage of the game', () => {
  it('has one house per stage: shop, then café, then hotel', () => {
    const houses = FACILITIES.filter((f) => f.house).sort((a, b) => a.stage - b.stage);
    expect(houses.map((f) => [f.id, f.stage])).toEqual([
      ['shop', 0],
      ['cafe', 1],
      ['hotel', 2],
    ]);
  });

  it('a later house cannot be built before its stage', () => {
    const s = newGame(0);
    s.coins = 1e15;
    for (const z of Object.values(s.zones)) z.owned = true;
    expect(buyFacility(s, 'cafe')).toBe(false);
    expect(buyFacility(s, 'hotel')).toBe(false);
    expect(buyFacility(s, 'shop')).toBe(true);
    expect(buyFacility(s, 'lifeguard')).toBe(true);
    s.expansions = 1;
    expect(buyFacility(s, 'cafe')).toBe(true);
    expect(buyFacility(s, 'hotel')).toBe(false);
    s.expansions = 2;
    expect(buyFacility(s, 'hotel')).toBe(true);
  });

  it('every building has to be earned: it opens with a zone', () => {
    const s = newGame(0);
    s.coins = 1e15;
    expect(buyFacility(s, 'shop')).toBe(false);
    s.zones['wave-2'].owned = true;
    expect(buyFacility(s, 'shop')).toBe(true);
    expect(buyFacility(s, 'lifeguard')).toBe(false);
  });

  it('beach upgrades are expensive (the first one costs at least 15K)', () => {
    for (const f of FACILITIES) expect(facilityCost(f.id, 0)).toBeGreaterThanOrEqual(15000);
  });
});

describe('unlock prices go up level by level', () => {
  it('starting a sport never costs more than its own level 2', () => {
    for (const sp of SPORTS) {
      const l2 = sp.levels[1].unlock!.coins;
      if (sp.unlock) expect(sp.unlock.coins, sp.id).toBeLessThan(l2);
      for (let i = 2; i < sp.levels.length; i++) expect(sp.levels[i].unlock!.coins, `${sp.id} level ${i + 1}`).toBeGreaterThan(sp.levels[i - 1].unlock!.coins);
    }
  });
});
