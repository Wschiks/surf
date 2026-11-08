import { describe, expect, it } from 'vitest';
import { REBIRTH } from '../src/config/rebirth';
import { ZONES, zoneById } from '../src/config/sports';
import { bonusFor, buyStat, multipliers, statCost, statMax, zoneStats } from '../src/core/economy';
import { newGame, type GameState } from '../src/core/state';
import { canRebirth, rebirth, rebirthStatus } from '../src/core/unlocks';

/** A finished game: both expansions bought and everything unlocked. */
function finished(): GameState {
  const s = newGame(0);
  s.expansions = 2;
  for (const z of ZONES) s.zones[z.id].owned = true;
  for (const k of Object.keys(s.sports)) s.sports[k] = true;
  return s;
}

describe('the income bonus', () => {
  it('goes x1, x2, x3, rebirth x5, x6, x7, rebirth x10, x11, x12, rebirth x16', () => {
    expect([0, 1, 2].map((e) => bonusFor(e, 0))).toEqual([1, 2, 3]);
    expect([0, 1, 2].map((e) => bonusFor(e, 1))).toEqual([5, 6, 7]);
    expect([0, 1, 2].map((e) => bonusFor(e, 2))).toEqual([10, 11, 12]);
    expect(bonusFor(0, 3)).toBe(16);
  });
});

describe('rebirth', () => {
  it('is only there once the whole game is done', () => {
    const s = newGame(0);
    expect(rebirthStatus(s)).toBeNull();
    s.expansions = 1;
    expect(rebirthStatus(s)).toBeNull();
    expect(rebirthStatus(finished())).not.toBeNull();
  });

  it('needs the last sailing zone at a high level and a huge amount of coins', () => {
    const s = finished();
    const price = rebirthStatus(s)!.coins;
    s.coins = price;
    expect(canRebirth(s)).toBe(false);
    s.zones[REBIRTH.zone].price = REBIRTH.level;
    expect(canRebirth(s)).toBe(true);
    s.coins = price - 1;
    expect(canRebirth(s)).toBe(false);
    expect(REBIRTH.coins).toBeGreaterThanOrEqual(1e15);
  });

  it('starts the whole game over with x5 income (the x3 you had, plus 2) and gems; skills stay', () => {
    const s = finished();
    s.zones[REBIRTH.zone].price = REBIRTH.level;
    s.coins = rebirthStatus(s)!.coins;
    s.facilities.shop = 3;
    s.skillPoints = 2;
    const skills = { ...s.skills };
    expect(rebirth(s)).toBe(true);
    expect(s.rebirths).toBe(1);
    expect(s.expansions).toBe(0);
    expect(s.coins).toBe(0);
    expect(s.facilities.shop).toBe(0);
    expect(s.sports.windsurfing).toBe(false);
    expect(s.zones['wave-1'].owned).toBe(true);
    expect(s.zones['wave-2'].owned).toBe(false);
    expect(s.skillPoints).toBe(2 + REBIRTH.gems);
    expect(s.skills).toEqual(skills);
    // the bonus is never lost: the x3 of the finished game plus 2 = x5
    expect(multipliers(s).coins).toBeCloseTo(newGameMult() * 5);
    expect(zoneStats(s, zoneById('wave-1')).income).toBeCloseTo(zoneStats(newGame(0), zoneById('wave-1')).income * 5);
  });

  it('costs more every time', () => {
    const s = finished();
    const first = rebirthStatus(s)!.coins;
    s.rebirths = 1;
    expect(rebirthStatus(s)!.coins).toBe(first * REBIRTH.costGrowth);
  });
});

function newGameMult(): number {
  return multipliers(newGame(0)).coins;
}

describe('Bigger class', () => {
  const W1 = zoneById('wave-1');

  it('goes up to level 10 (a class of 13), each level x3 the one before', () => {
    expect(statMax('capacity', 0)).toBe(10);
    for (let l = 1; l < 10; l++) expect(statCost(W1, 'capacity', l) / statCost(W1, 'capacity', l - 1)).toBeCloseTo(3, 1);
    expect(statCost(W1, 'capacity', 10)).toBe(Infinity);
    const s = newGame(0);
    s.skills = {}; // no skill bonuses: just the class itself
    s.zones['wave-1'].capacity = 10;
    expect(zoneStats(s, W1).guests).toBe(13);
  });

  it('every rebirth makes room for 5 more levels', () => {
    const s = finished();
    s.coins = 1e30;
    s.zones['wave-1'].capacity = 10;
    expect(buyStat(s, 'wave-1', 'capacity')).toBe(false);
    s.rebirths = 1;
    expect(statMax('capacity', 1)).toBe(15);
    expect(buyStat(s, 'wave-1', 'capacity', 'max')).toBe(true);
    expect(s.zones['wave-1'].capacity).toBe(15);
    expect(statMax('capacity', 2)).toBe(20);
  });
});
