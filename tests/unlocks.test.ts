import { describe, expect, it } from 'vitest';
import { EXPANSIONS, EXPANSION_MULT } from '../src/config/expansions';
import { SPORTS, ZONES, zoneById } from '../src/config/sports';
import { buyStat, multipliers, upgradeCount, zoneStats } from '../src/core/economy';
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
  it('starts with the surfers and the skimboarders, and nothing else', () => {
    const s = fresh();
    const owned = ZONES.filter((z) => s.zones[z.id].owned).map((z) => z.id);
    expect(owned.sort()).toEqual(['skimboarding-1', 'wave-1']);
    expect(s.sports.wave && s.sports.skimboarding).toBe(true);
    expect(s.sports.windsurfing || s.sports.kitesurfing || s.sports.foil || s.sports.sailing).toBe(false);
  });

  it('closed sports cannot be reached with the level rules', () => {
    const s = fresh();
    s.coins = 1e30;
    s.reputation = 1e9;
    for (const sport of SPORTS.filter((x) => !s.sports[x.id])) {
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

  it('Level 3 needs reputation and coins and Level 2; Level 4 needs high reputation', () => {
    const s = fresh();
    s.coins = 1e15;
    s.reputation = 1e9;
    expect(unlockLevel(s, 'wave-3')).toBe(false); // no Level 2 yet
    s.zones['wave-2'].owned = true;
    s.reputation = 0;
    expect(unlockLevel(s, 'wave-3')).toBe(false);
    s.reputation = zoneById('wave-3').def.unlock!.reputation;
    expect(unlockLevel(s, 'wave-3')).toBe(true);
    expect(zoneById('wave-4').def.unlock!.reputation).toBeGreaterThan(zoneById('wave-3').def.unlock!.reputation * 3);
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

  it('needs the required level in every open sport, reputation and coins', () => {
    const s = fresh();
    s.coins = 1e30;
    s.reputation = 1e9;
    expect(expansionStatus(s)!.ready).toBe(false);
    expect(expand(s)).toBe(false);
    ownLevels(s, EXPANSIONS[0].level - 1);
    expect(expand(s)).toBe(false);
    ownLevels(s, EXPANSIONS[0].level);
    s.reputation = 0;
    expect(expand(s)).toBe(false);
    s.reputation = EXPANSIONS[0].reputation;
    s.coins = EXPANSIONS[0].coins - 1;
    expect(expand(s)).toBe(false);
    s.coins = EXPANSIONS[0].coins;
    expect(expand(s)).toBe(true);
  });

  it('opens the Sea, multiplies income by 3 and starts everything over', () => {
    const s = fresh();
    const before = zoneStats(s, zoneById('wave-1')).income;
    ownLevels(s, 4);
    s.zones['wave-1'].manager = true;
    s.zones['wave-1'].capacity = 7;
    s.facilities.shop = 3;
    s.reputation = 5000;
    s.coins = EXPANSIONS[0].coins + 123;
    expect(expand(s)).toBe(true);
    expect(s.expansions).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.facilities.shop).toBe(0);
    expect(s.zones['wave-1'].manager).toBe(false);
    expect(s.zones['wave-1'].capacity).toBe(0);
    expect(s.zones['wave-2'].owned).toBe(false);
    expect(s.reputation).toBe(5000); // reputation stays
    // the Sea sports are open now, at Level 1
    for (const id of ['windsurfing', 'kitesurfing', 'foil'] as const) {
      expect(s.sports[id]).toBe(true);
      expect(s.zones[`${id}-1`].owned).toBe(true);
    }
    expect(s.sports.sailing).toBe(false);
    expect(multipliers(s).coins).toBe(3);
    expect(zoneStats(s, zoneById('wave-1')).income).toBeCloseTo(before * 3);
  });

  it('the second expansion opens the Ocean and makes income x9', () => {
    const s = fresh();
    s.expansions = 1;
    s.sports.windsurfing = s.sports.kitesurfing = s.sports.foil = true;
    ownLevels(s, EXPANSIONS[1].level);
    s.reputation = 1e9;
    s.coins = 1e30;
    expect(expand(s)).toBe(true);
    expect(s.sports.sailing).toBe(true);
    expect(s.zones['sailing-1'].owned).toBe(true);
    expect(multipliers(s).coins).toBe(9);
    expect(expansionStatus(s)).toBeNull();
    expect(expand(s)).toBe(false);
  });

  it('the goal bar points to the expansion once it is in reach', () => {
    const s = fresh();
    expect(nextGoal(s)?.expansion).toBe(false);
    ownLevels(s, EXPANSIONS[0].level);
    s.reputation = EXPANSIONS[0].reputation;
    const g = nextGoal(s)!;
    expect(g.expansion).toBe(true);
    expect(g.coins).toBe(EXPANSIONS[0].coins);
  });
});
