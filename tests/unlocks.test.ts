import { describe, expect, it } from 'vitest';
import { SPORTS, ZONES, zoneById } from '../src/config/sports';
import { buyStat, upgradeCount } from '../src/core/economy';
import { levelStatus, previousSport, sportStatus, unlockLevel, unlockSport, unlockZone, zoneUnlockStatus } from '../src/core/unlocks';
import { newGame } from '../src/core/state';

const fresh = () => newGame(0);

function upgradeWave1(s: ReturnType<typeof fresh>, n: number) {
  s.coins = 1e12;
  const stats = ['capacity', 'price', 'speed'] as const;
  for (let i = 0; i < n; i++) buyStat(s, 'wave-1', stats[i % 3]);
}

describe('wave surfing levels', () => {
  it('Level 2 needs Level 1 upgraded to a set point, plus coins', () => {
    const s = fresh();
    s.coins = 1e9;
    expect(levelStatus(s, zoneById('wave-2')).ready).toBe(false);
    expect(unlockLevel(s, 'wave-2')).toBe(false);
    const need = zoneById('wave-2').def.unlock!.prevLevelUpgrades!;
    upgradeWave1(s, need);
    s.coins = 0;
    const st = levelStatus(s, zoneById('wave-2'));
    expect(st.ready).toBe(true);
    expect(st.canBuy).toBe(false);
    s.coins = st.coins;
    expect(unlockLevel(s, 'wave-2')).toBe(true);
    expect(s.zones['wave-2'].owned).toBe(true);
    expect(s.coins).toBe(0);
  });

  it('Level 3 needs reputation and coins and Level 2', () => {
    const s = fresh();
    s.coins = 1e12;
    s.reputation = 1e6;
    expect(levelStatus(s, zoneById('wave-3')).blockedBy).toMatch(/Level 2/);
    expect(unlockLevel(s, 'wave-3')).toBe(false);
    upgradeWave1(s, zoneById('wave-2').def.unlock!.prevLevelUpgrades!);
    s.coins = 1e12;
    expect(unlockLevel(s, 'wave-2')).toBe(true);
    s.reputation = 0;
    expect(unlockLevel(s, 'wave-3')).toBe(false);
    s.reputation = zoneById('wave-3').def.unlock!.reputation;
    expect(unlockLevel(s, 'wave-3')).toBe(true);
  });

  it('Level 4 (Nazaré) needs high reputation', () => {
    const r3 = zoneById('wave-3').def.unlock!.reputation;
    const r4 = zoneById('wave-4').def.unlock!.reputation;
    expect(r4).toBeGreaterThan(r3 * 3);
  });

  it('each level costs more than the one before', () => {
    const wave = SPORTS[0].levels;
    for (let i = 2; i < wave.length; i++) expect(wave[i].unlock!.coins).toBeGreaterThan(wave[i - 1].unlock!.coins);
  });
});

describe('sport unlock chain', () => {
  it('sports unlock in a fixed order, each after Level 2 of the previous one', () => {
    const order = [...SPORTS].sort((a, b) => a.order - b.order);
    order.forEach((s, i) => {
      expect(s.order).toBe(i + 1);
      if (i === 0) expect(s.unlock).toBeUndefined();
      else expect(previousSport(s)?.id).toBe(order[i - 1].id);
    });
  });

  it('a sport needs Level 2 of the previous sport AND reputation', () => {
    const second = SPORTS.find((s) => s.order === 2);
    if (!second) return;
    const s = fresh();
    s.coins = 1e15;
    s.reputation = 1e9;
    expect(sportStatus(s, second).ready).toBe(false); // no Level 2 yet
    expect(unlockSport(s, second.id)).toBe(false);
    s.zones['wave-2'].owned = true;
    s.reputation = 0;
    expect(sportStatus(s, second).ready).toBe(false); // no reputation
    s.reputation = second.unlock!.reputation;
    expect(unlockSport(s, second.id)).toBe(true);
    expect(s.sports[second.id]).toBe(true);
    expect(s.zones[`${second.id}-1`].owned).toBe(true);
  });

  it('Level 1 of a locked sport cannot be reached through the level rules', () => {
    for (const s of SPORTS.filter((x) => x.order > 1)) {
      const st = zoneUnlockStatus(fresh(), zoneById(`${s.id}-1`));
      expect(st?.kind).toBe('sport');
      const st2 = zoneUnlockStatus(fresh(), zoneById(`${s.id}-2`));
      expect(st2?.status.blockedBy).toBeTruthy();
    }
  });

  it('unlockZone picks the right rule', () => {
    const s = fresh();
    expect(unlockZone(s, 'wave-1')).toBeNull();
    expect(unlockZone(s, 'wave-2')).toBeNull();
  });

  it('every sport has four levels with a zone each', () => {
    for (const s of SPORTS) expect(s.levels).toHaveLength(4);
    expect(ZONES).toHaveLength(SPORTS.length * 4);
    expect(upgradeCount(fresh().zones['wave-1'])).toBe(0);
  });
});
