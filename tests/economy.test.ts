import { describe, expect, it } from 'vitest';
import { STATS } from '../src/config/balance';
import { ZONES, zoneById } from '../src/config/sports';
import {
  applyOffline,
  autoIncomePerSecond,
  buyFacility,
  buyManager,
  buyStat,
  collect,
  collectAll,
  facilityCost,
  managerCost,
  multipliers,
  statCost,
  tap,
  tick,
  zoneStats,
} from './helpers';
import { BALANCE } from '../src/config/balance';
import { newGame } from '../src/core/state';

const W1 = 'wave-1';
/** A new game without the free root skills, so the numbers of the basic rules can be checked exactly. */
const fresh = () => {
  const s = newGame(0);
  s.skills = {};
  return s;
};

describe('starting state', () => {
  it('starts with wave surfing level 1 only', () => {
    const s = fresh();
    expect(s.coins).toBe(0);
    expect(s.sports.wave).toBe(true);
    expect(s.zones[W1].owned).toBe(true);
    expect(ZONES.filter((z) => s.zones[z.id].owned)).toHaveLength(1);
  });
});

describe('income', () => {
  it('a zone earns guests x price per session', () => {
    const s = fresh();
    const st = zoneStats(s, zoneById(W1));
    expect(st.guests).toBe(3);
    expect(st.income).toBeCloseTo(3);
    expect(st.duration).toBeCloseTo(6);
  });

  it('a zone without a manager waits for the player after one session', () => {
    const s = fresh();
    expect(tap(s, W1)).toBe('started');
    tick(s, 100);
    expect(s.zones[W1].phase).toBe('ready');
    expect(s.coins).toBe(0);
    expect(s.zones[W1].pending).toBeCloseTo(3);
    expect(collect(s, W1)).toBeCloseTo(3);
    expect(s.coins).toBeCloseTo(3);
  });

  it('tapping a ready zone collects and starts the next session', () => {
    const s = fresh();
    tap(s, W1);
    tick(s, 7);
    expect(tap(s, W1)).toBe('collected');
    expect(s.zones[W1].phase).toBe('running');
    expect(s.coins).toBeCloseTo(3);
  });

  it('collectAll serves every waiting zone', () => {
    const s = fresh();
    tap(s, W1);
    tick(s, 7);
    expect(collectAll(s)).toBeCloseTo(3);
  });

  it('a zone with a manager keeps earning by itself', () => {
    const s = fresh();
    s.coins = 1e6;
    expect(buyManager(s, W1)).toBe(true);
    const before = s.coins;
    tick(s, 60);
    expect(s.coins - before).toBeCloseTo(30, 5);
    expect(s.zones[W1].phase).toBe('running');
  });
});

describe('upgrades', () => {
  it('each purchase costs more than the last', () => {
    for (const z of ZONES) {
      for (const stat of Object.keys(STATS) as (keyof typeof STATS)[]) {
        let prev = 0;
        for (let lvl = 0; lvl < STATS[stat].max; lvl++) {
          const c = statCost(z, stat, lvl);
          expect(c).toBeGreaterThan(prev);
          prev = c;
        }
        expect(statCost(z, stat, STATS[stat].max)).toBe(Infinity);
      }
    }
  });

  it('facilities and managers get more expensive too', () => {
    expect(facilityCost('shop', 1)).toBeGreaterThan(facilityCost('shop', 0));
    for (let i = 1; i < ZONES.length; i++) expect(managerCost(ZONES[i])).toBeGreaterThan(0);
  });

  it('cannot buy without enough coins, and spends coins when buying', () => {
    const s = fresh();
    expect(buyStat(s, W1, 'capacity')).toBe(false);
    s.coins = statCost(zoneById(W1), 'capacity', 0);
    expect(buyStat(s, W1, 'capacity')).toBe(true);
    expect(s.coins).toBe(0);
    expect(s.zones[W1].capacity).toBe(1);
    expect(zoneStats(s, zoneById(W1)).guests).toBe(4);
  });

  it('price and speed upgrades raise income per second', () => {
    const s = fresh();
    const base = zoneStats(s, zoneById(W1)).perSecond;
    s.coins = 1e9;
    buyStat(s, W1, 'price');
    const afterPrice = zoneStats(s, zoneById(W1)).perSecond;
    buyStat(s, W1, 'speed');
    const afterSpeed = zoneStats(s, zoneById(W1)).perSecond;
    expect(afterPrice).toBeGreaterThan(base);
    expect(afterSpeed).toBeGreaterThan(afterPrice);
  });

  it('stops at the maximum level', () => {
    const s = fresh();
    s.coins = 1e30;
    for (let i = 0; i < 100; i++) buyStat(s, W1, 'speed');
    expect(s.zones[W1].speed).toBe(STATS.speed.max);
  });

  it('beach facilities boost every zone', () => {
    const s = fresh();
    const base = zoneStats(s, zoneById(W1)).income;
    s.coins = 1e9;
    expect(buyFacility(s, 'shop')).toBe(true);
    expect(multipliers(s).coins).toBeCloseTo(1.1);
    expect(zoneStats(s, zoneById(W1)).income).toBeCloseTo(base * 1.1);
    const dur = zoneStats(s, zoneById(W1)).duration;
    buyFacility(s, 'showers');
    expect(zoneStats(s, zoneById(W1)).duration).toBeLessThan(dur);
  });
});

describe('offline earnings', () => {
  it('a zone with a manager earns while the game is closed', () => {
    const s = fresh();
    s.coins = 1e6;
    buyManager(s, W1);
    const per = autoIncomePerSecond(s);
    const before = s.coins;
    const rep = applyOffline(s, 3600);
    expect(rep.coins).toBeCloseTo(per * 3600, 3);
    expect(s.coins - before).toBeCloseTo(per * 3600, 3);
    expect(rep.capped).toBe(false);
  });

  it('a zone without a manager only finishes one session and waits', () => {
    const s = fresh();
    tap(s, W1);
    const rep = applyOffline(s, 3600);
    expect(rep.coins).toBe(0);
    expect(rep.waiting).toBe(1);
    expect(s.zones[W1].pending).toBeCloseTo(3);
  });

  it('caps offline earnings at the maximum', () => {
    const s = fresh();
    s.coins = 1e6;
    buyManager(s, W1);
    const per = autoIncomePerSecond(s);
    const before = s.coins;
    const rep = applyOffline(s, BALANCE.offlineCapSeconds * 5);
    expect(rep.capped).toBe(true);
    expect(rep.seconds).toBe(BALANCE.offlineCapSeconds);
    expect(s.coins - before).toBeCloseTo(per * BALANCE.offlineCapSeconds, 2);
  });

  it('gives the same result as playing the time live', () => {
    const a = fresh();
    const b = fresh();
    for (const s of [a, b]) {
      s.coins = 1e6;
      buyManager(s, W1);
    }
    applyOffline(a, 1000);
    for (let i = 0; i < 1000; i++) tick(b, 1);
    expect(a.coins).toBeCloseTo(b.coins, 3);
  });
});
