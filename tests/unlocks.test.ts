import { describe, expect, it } from 'vitest';
import { EXPANSIONS, EXPANSION_MULT } from '../src/config/expansions';
import { SPORTS, ZONES, zoneById } from '../src/config/sports';
import { buyStat, multipliers, upgradeCount, zoneStats } from '../src/core/economy';
import { expansionNeededFor, sportStatus, unlockSport } from '../src/core/unlocks';
import { newGame, type GameState } from '../src/core/state';
import { expand, expansionStatus, levelStatus, nextGoal, unlockLevel, zoneUnlockStatus } from '../src/core/unlocks';

const fresh = () => newGame(0);

function upgradeZone(s: GameState, id: string, n: number) {
  s.coins = 1e15;
  const stats = ['capacity', 'price', 'speed'] as const;
  for (let i = 0; i < n; i++) buyStat(s, id, stats[i % 3]);
}

/** Give the player Level `level` of every sport in the open areas. */
function ownLevels(s: GameState, level: number) {
  for (const z of ZONES) if (s.sports[z.sport.id] && z.level <= level) s.zones[z.id].owned = true;
}

describe('the start', () => {
  it('starts with the surfers only', () => {
    const s = fresh();
    expect(ZONES.filter((z) => s.zones[z.id].owned).map((z) => z.id)).toEqual(['wave-1']);
    expect(s.sports.wave).toBe(true);
    expect(s.sports.skimboarding || s.sports.windsurfing || s.sports.kitesurfing || s.sports.foil || s.sports.sailing).toBe(false);
  });

  it('skimboarding is earned: Level 2 of wave surfing and coins', () => {
    const s = fresh();
    const rule = SPORTS.find((x) => x.id === 'skimboarding')!.unlock!;
    expect(expansionNeededFor(s, 'skimboarding')).toBeNull();
    s.coins = 1e12;
    expect(unlockSport(s, 'skimboarding')).toBe(false); // no Level 2 yet
    expect(sportStatus(s, SPORTS.find((x) => x.id === 'skimboarding')!).ready).toBe(false);
    s.zones['wave-2'].owned = true;
    expect(sportStatus(s, SPORTS.find((x) => x.id === 'skimboarding')!).ready).toBe(true);
    s.coins = rule.coins - 1;
    expect(unlockSport(s, 'skimboarding')).toBe(false);
    s.coins = rule.coins;
    expect(unlockSport(s, 'skimboarding')).toBe(true);
    expect(s.zones['skimboarding-1'].owned).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('closed sports cannot be reached with the level rules', () => {
    const s = fresh();
    s.coins = 1e30;
    for (const sport of SPORTS.filter((x) => !s.sports[x.id] && expansionNeededFor(s, x.id) !== null)) {
      expect(zoneUnlockStatus(s, zoneById(`${sport.id}-1`))?.kind).toBe('closed');
      expect(levelStatus(s, zoneById(`${sport.id}-2`)).blockedBy).toMatch(/expansion/);
      expect(unlockLevel(s, `${sport.id}-2`)).toBe(false);
    }
  });
});

describe('levels of a sport', () => {
  it('Level 2 needs Level 1 upgraded to a set point, plus coins', () => {
    const s = fresh();
    s.coins = 1e9;
    expect(levelStatus(s, zoneById('wave-2')).ready).toBe(false);
    expect(unlockLevel(s, 'wave-2')).toBe(false);
    upgradeZone(s, 'wave-1', zoneById('wave-2').def.unlock!.prevLevelUpgrades!);
    s.coins = 0;
    const st = levelStatus(s, zoneById('wave-2'));
    expect(st.ready).toBe(true);
    expect(st.canBuy).toBe(false);
    s.coins = st.coins;
    expect(unlockLevel(s, 'wave-2')).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('Level 3 needs 30 upgrades on Level 2 and Level 4 needs 60 on Level 3, plus coins; there is no reputation', () => {
    const s = fresh();
    s.coins = 1e15;
    expect(unlockLevel(s, 'wave-3')).toBe(false); // no Level 2 yet
    s.zones['wave-2'].owned = true;
    expect(unlockLevel(s, 'wave-3')).toBe(false); // no upgrades on Level 2
    s.zones['wave-2'].price = 29;
    expect(unlockLevel(s, 'wave-3')).toBe(false);
    s.zones['wave-2'].price = 30;
    expect(unlockLevel(s, 'wave-3')).toBe(true);
    expect(zoneById('wave-3').def.unlock!.prevLevelUpgrades).toBe(30);
    expect(zoneById('wave-4').def.unlock!.prevLevelUpgrades).toBe(60);
    expect('reputation' in s).toBe(false);
  });

  it('each level costs more than the one before', () => {
    for (const sp of SPORTS) for (let i = 2; i < sp.levels.length; i++) expect(sp.levels[i].unlock!.coins).toBeGreaterThan(sp.levels[i - 1].unlock!.coins);
  });

  it('every sport has four levels with a zone each', () => {
    for (const s of SPORTS) expect(s.levels).toHaveLength(4);
    expect(ZONES).toHaveLength(SPORTS.length * 4);
    expect(upgradeCount(fresh().zones['wave-1'])).toBe(0);
  });
});

describe('beach expansions', () => {
  it('there are two: the Sea and then the Ocean', () => {
    expect(EXPANSIONS.map((e) => e.opens)).toEqual(['sea', 'ocean']);
    expect(EXPANSION_MULT).toBe(3);
  });

  it('needs the required level in every open sport and coins', () => {
    const s = fresh();
    s.sports.skimboarding = true;
    s.coins = 1e30;
    expect(expansionStatus(s)!.ready).toBe(false);
    expect(expand(s)).toBe(false);
    ownLevels(s, EXPANSIONS[0].level - 1);
    expect(expand(s)).toBe(false);
    ownLevels(s, EXPANSIONS[0].level);
    s.coins = EXPANSIONS[0].coins - 1;
    expect(expand(s)).toBe(false);
    s.coins = EXPANSIONS[0].coins;
    expect(expand(s)).toBe(true);
  });

  it('opens the Sea, multiplies income by 3 and starts everything over', () => {
    const s = fresh();
    const before = zoneStats(s, zoneById('wave-1')).income;
    s.sports.skimboarding = true;
    ownLevels(s, 4);
    s.zones['wave-1'].manager = true;
    s.zones['wave-1'].capacity = 7;
    s.facilities.shop = 3;
    s.coins = EXPANSIONS[0].coins + 123;
    expect(expand(s)).toBe(true);
    expect(s.expansions).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.facilities.shop).toBe(0);
    expect(s.zones['wave-1'].manager).toBe(false);
    expect(s.zones['wave-1'].capacity).toBe(0);
    expect(s.zones['wave-2'].owned).toBe(false);
    // the beach starts over like a new game: only wave surfing is owned, nothing is given for free
    expect(ZONES.filter((z) => s.zones[z.id].owned).map((z) => z.id)).toEqual(['wave-1']);
    for (const id of ['skimboarding', 'windsurfing', 'kitesurfing', 'foil', 'sailing'] as const) expect(s.sports[id]).toBe(false);
    // ...but the Sea is open now: its sports can be earned
    expect(expansionNeededFor(s, 'windsurfing')).toBeNull();
    expect(expansionNeededFor(s, 'sailing')).toBe(2);
    expect(multipliers(s).coins).toBe(3);
    expect(zoneStats(s, zoneById('wave-1')).income).toBeCloseTo(before * 3);
  });

  it('the second expansion opens the Ocean and makes income x9', () => {
    const s = fresh();
    s.expansions = 1;
    s.sports.skimboarding = s.sports.windsurfing = s.sports.kitesurfing = s.sports.foil = true;
    ownLevels(s, EXPANSIONS[1].level);
    s.coins = 1e30;
    expect(expand(s)).toBe(true);
    expect(expansionNeededFor(s, 'sailing')).toBeNull(); // the Ocean is open, sailing still has to be earned
    expect(s.sports.sailing).toBe(false);
    expect(multipliers(s).coins).toBe(9);
    expect(expansionStatus(s)).toBeNull();
    expect(expand(s)).toBe(false);
  });

  it('the goal bar points to the expansion once it is in reach', () => {
    const s = fresh();
    s.sports.skimboarding = true;
    expect(nextGoal(s)?.expansion).toBe(false);
    ownLevels(s, EXPANSIONS[0].level);
    const g = nextGoal(s)!;
    expect(g.expansion).toBe(true);
    expect(g.coins).toBe(EXPANSIONS[0].coins);
  });
});
