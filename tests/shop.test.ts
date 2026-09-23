import { describe, expect, it } from 'vitest';
import { AD_COOLDOWN_SECONDS, AD_STEPS, CLUB, GEM_PACKS } from '../src/config/shop';
import { BALANCE } from '../src/config/balance';
import { adFree, loadPerks, PERKS_KEY, refreshClub, savePerks } from '../src/core/perks';
import { loadGame, saveGame } from '../src/core/save';
import { adStreak, claimAdStep, claimClubGems, clubStatus, grantGemPack } from '../src/core/shop';
import { multipliers, offlineCap } from '../src/core/economy';
import { newGame } from '../src/core/state';

const fresh = () => {
  const s = newGame(0);
  s.skills = {};
  return s;
};
const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

describe('ad streak', () => {
  it('gives 1 gem, x2 for 30 s, 2 gems, x2 for 60 s, 3 gems, in that order', () => {
    const s = fresh();
    const t = 1000;
    expect(claimAdStep(s, t)).toEqual({ gems: 1 });
    expect(s.skillPoints).toBe(1);
    expect(claimAdStep(s, t)).toEqual({ boost: 30 });
    expect(s.boost).toBe(30);
    expect(claimAdStep(s, t)).toEqual({ gems: 2 });
    expect(claimAdStep(s, t)).toEqual({ boost: 60 });
    expect(s.boost).toBe(60);
    expect(claimAdStep(s, t)).toEqual({ gems: 3 });
    expect(s.skillPoints).toBe(6);
    expect(s.skillEarned).toBe(6);
  });

  it('locks for a day after the fifth ad, then starts again at the first', () => {
    const s = fresh();
    const t = 5_000_000;
    for (let i = 0; i < AD_STEPS.length; i++) claimAdStep(s, t);
    expect(adStreak(s, t).lockedFor).toBe(AD_COOLDOWN_SECONDS);
    expect(claimAdStep(s, t + 3600 * 1000)).toBeNull();
    expect(s.skillPoints).toBe(6);
    const later = t + AD_COOLDOWN_SECONDS * 1000;
    expect(adStreak(s, later).lockedFor).toBe(0);
    expect(adStreak(s, later).step).toBe(0);
    expect(claimAdStep(s, later)).toEqual({ gems: 1 });
  });

  it('a boost reward never shortens a longer boost that is running', () => {
    const s = fresh();
    s.boost = 100;
    s.adShop.step = 1; // the x2 for 30 s reward
    claimAdStep(s, 0);
    expect(s.boost).toBe(100);
  });
});

describe('purchases', () => {
  it('coins x5 multiplies all income', () => {
    const a = fresh();
    const b = fresh();
    b.perks.x5 = true;
    expect(multipliers(b).coins).toBe(multipliers(a).coins * BALANCE.x5Mult);
  });

  it('are kept apart from the save: not in the save, and a forged save cannot grant them', () => {
    const s = fresh();
    s.perks = { noAds: true, x5: true };
    const store = memory();
    saveGame(s, 1, store);
    expect(store.data.get('surf-tycoon-save-v1')).not.toContain('perks');
    const forged = fresh() as unknown as { perks: unknown };
    forged.perks = { x5: true };
    store.data.set('surf-tycoon-save-v1', JSON.stringify(forged));
    expect(loadGame(0, store).perks).toEqual({});
  });

  it('are stored on the device and read back', () => {
    const store = memory();
    expect(loadPerks(store)).toMatchObject({ noAds: false, x5: false, club: false });
    savePerks({ x5: true }, store);
    expect(store.data.has(PERKS_KEY)).toBe(true);
    expect(loadPerks(store)).toMatchObject({ noAds: false, x5: true });
  });
});

describe('gem packs', () => {
  it('pay out the pack, and never the same purchase twice', () => {
    const s = fresh();
    let seen: string[] = [];
    const remember = (ids: string[]) => (seen = ids);
    expect(grantGemPack(s, 'gems20', 'tx-1', seen, remember)).toBe(20);
    expect(grantGemPack(s, 'gems20', 'tx-1', seen, remember)).toBe(0);
    expect(grantGemPack(s, 'gems100', 'tx-2', seen, remember)).toBe(100);
    expect(grantGemPack(s, 'gems300', 'tx-3', seen, remember)).toBe(300);
    expect(s.skillPoints).toBe(420);
    expect(s.skillEarned).toBe(420);
  });

  it('pay nothing without a purchase id', () => {
    const s = fresh();
    expect(grantGemPack(s, 'gems20', '', [], () => {})).toBe(0);
    expect(s.skillPoints).toBe(0);
  });

  it('get cheaper per gem in the bigger packs', () => {
    const per = GEM_PACKS.map((p) => parseFloat(p.price.replace(/[^0-9.]/g, '')) / p.gems);
    expect(per[1]).toBeLessThan(per[0]);
    expect(per[2]).toBeLessThan(per[1]);
  });
});

describe('Surf Club', () => {
  const member = () => {
    const s = fresh();
    s.perks = { clubUntil: 10_000_000 };
    refreshClub(s.perks, 5_000_000);
    return s;
  };

  it('is active until the paid date, and then it stops by itself', () => {
    const s = member();
    expect(s.perks.club).toBe(true);
    refreshClub(s.perks, 10_000_001);
    expect(s.perks.club).toBe(false);
  });

  it('doubles coins, adds 2 hours of away time and makes ad rewards free', () => {
    const a = fresh();
    const b = member();
    expect(multipliers(b).coins).toBe(multipliers(a).coins * CLUB.coinMult);
    expect(offlineCap(b)).toBe(offlineCap(a) + CLUB.awayHours * 3600);
    expect(adFree(a.perks)).toBe(false);
    expect(adFree(b.perks)).toBe(true);
    expect(adFree({ noAds: true })).toBe(true);
  });

  it('gives 3 gems once every 24 hours, and nothing to non-members', () => {
    const s = member();
    const t = 5_000_000;
    expect(claimClubGems(s, t)).toBe(CLUB.gemsPerDay);
    expect(claimClubGems(s, t + 1000)).toBe(0);
    expect(clubStatus(s, t).nextIn).toBe(CLUB.claimSeconds);
    expect(claimClubGems(s, t + CLUB.claimSeconds * 1000)).toBe(CLUB.gemsPerDay);
    expect(s.skillPoints).toBe(CLUB.gemsPerDay * 2);
    expect(claimClubGems(fresh(), t)).toBe(0);
  });

  it('is stored with the perks, not in the save', () => {
    const store = memory();
    savePerks({ clubUntil: 123 }, store);
    expect(loadPerks(store).clubUntil).toBe(123);
    const s = member();
    const saveStore = memory();
    saveGame(s, 1, saveStore);
    expect(saveStore.data.get('surf-tycoon-save-v1')).not.toContain('clubUntil');
  });
});
