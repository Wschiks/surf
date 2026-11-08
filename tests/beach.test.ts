import { describe, expect, it } from 'vitest';
import { BEACH_SPORTS } from '../src/config/beach';
import { anyZoneById, ZONES } from '../src/config/sports';
import { beachSportOpen, buyManager, buyStat, guestsFor, statMax, tick, unlockBeachSport, zoneStats } from '../src/core/economy';
import { newGame } from '../src/core/state';
import { loadGame, SAVE_KEY } from '../src/core/save';
import { expand, expansionStatus } from '../src/core/unlocks';

const VB = anyZoneById('volleyball');

const ready = () => {
  const s = newGame(0);
  s.skills = {};
  s.expansions = 1;
  s.zones['windsurfing-1'].owned = true;
  s.coins = 1e30;
  return s;
};

describe('beach sports', () => {
  it('volleyball opens after the first expansion with windsurfing, soccer after the second with sailing', () => {
    const s = newGame(0);
    const [vb, so] = BEACH_SPORTS;
    expect(beachSportOpen(s, vb)).toBe(false);
    s.expansions = 1;
    expect(beachSportOpen(s, vb)).toBe(false);
    s.zones['windsurfing-1'].owned = true;
    expect(beachSportOpen(s, vb)).toBe(true);
    expect(beachSportOpen(s, so)).toBe(false);
    s.expansions = 2;
    s.zones['sailing-1'].owned = true;
    expect(beachSportOpen(s, so)).toBe(true);
  });

  it('is bought with coins, only once, and only when open', () => {
    const s = newGame(0);
    s.coins = 1e30;
    expect(unlockBeachSport(s, 'volleyball')).toBe(false);
    const t = ready();
    const before = t.coins;
    expect(unlockBeachSport(t, 'volleyball')).toBe(true);
    expect(t.coins).toBe(before - BEACH_SPORTS[0].coins);
    expect(t.zones.volleyball.owned).toBe(true);
    expect(unlockBeachSport(t, 'volleyball')).toBe(false);
  });

  it('players: 1v1 to 5v5; fields: 1 to 4; guests = players x fields', () => {
    const s = ready();
    const z = s.zones.volleyball;
    expect(guestsFor(VB, z)).toBe(2); // 1v1 on one field
    z.capacity = 2;
    expect(guestsFor(VB, z)).toBe(6); // 3v3
    z.fields = 1;
    expect(guestsFor(VB, z)).toBe(12); // 3v3 on two fields
    z.capacity = 4;
    z.fields = 3;
    expect(guestsFor(VB, z)).toBe(40); // 5v5 on four fields
  });

  it('3v3 on 2 fields before a rebirth, one more step of each per rebirth, at most 5v5 on 4 fields', () => {
    expect(statMax('capacity', 0, VB)).toBe(2);
    expect(statMax('fields', 0, VB)).toBe(1);
    expect(statMax('capacity', 1, VB)).toBe(3);
    expect(statMax('fields', 1, VB)).toBe(2);
    expect(statMax('capacity', 2, VB)).toBe(4);
    expect(statMax('fields', 2, VB)).toBe(3);
    expect(statMax('capacity', 9, VB)).toBe(4);
    expect(statMax('fields', 9, VB)).toBe(3);
    // the water zones keep their own Bigger class
    expect(statMax('capacity', 0, ZONES[0])).toBe(10);
  });

  it('upgrades stop at the top; no Faster turnover on the sand', () => {
    const s = ready();
    unlockBeachSport(s, 'volleyball');
    for (let i = 0; i < 10; i++) buyStat(s, 'volleyball', 'capacity');
    for (let i = 0; i < 10; i++) buyStat(s, 'volleyball', 'fields');
    expect(s.zones.volleyball.capacity).toBe(2);
    expect(s.zones.volleyball.fields).toBe(1);
    expect(buyStat(s, 'volleyball', 'speed')).toBe(false);
    s.rebirths = 2;
    buyStat(s, 'volleyball', 'capacity', 'max');
    buyStat(s, 'volleyball', 'fields', 'max');
    expect(s.zones.volleyball.capacity).toBe(4);
    expect(s.zones.volleyball.fields).toBe(3);
  });

  it('earns coins like a zone, with a referee it runs by itself', () => {
    const s = ready();
    unlockBeachSport(s, 'volleyball');
    expect(buyManager(s, 'volleyball')).toBe(true);
    s.coins = 0;
    const c = s.coins;
    tick(s, 60);
    const st = zoneStats(s, VB);
    expect(s.coins - c).toBeGreaterThan(st.income * 6);
  });

  it('is not part of what an expansion asks for', () => {
    const s = ready();
    const reqs = expansionStatus(s)!.requirements.map((r) => r.zone);
    expect(reqs.some((z) => z === 'volleyball' || z === 'soccer')).toBe(false);
  });

  it('an old save (from before the beach sports) loads with them, not bought, and nothing else changes', () => {
    const old = newGame(0) as unknown as { zones: Record<string, Record<string, unknown>> };
    delete old.zones.volleyball;
    delete old.zones.soccer;
    for (const z of Object.values(old.zones)) delete z.fields;
    old.zones['wave-1'].capacity = 7;
    const s = loadGame(0, { getItem: (k: string) => (k === SAVE_KEY ? JSON.stringify(old) : null) });
    expect(s.zones.volleyball.owned).toBe(false);
    expect(s.zones.soccer.owned).toBe(false);
    expect(s.zones['wave-1'].fields).toBe(0);
    expect(s.zones['wave-1'].capacity).toBe(7);
  });

  it('an expansion starts the beach sports over too', () => {
    const s = ready();
    unlockBeachSport(s, 'volleyball');
    s.zones.volleyball.capacity = 2;
    s.zones.volleyball.fields = 1;
    for (const r of ZONES) s.zones[r.id].owned = true;
    expect(expand(s)).toBe(true);
    expect(s.zones.volleyball).toMatchObject({ owned: false, capacity: 0, fields: 0 });
  });
});
