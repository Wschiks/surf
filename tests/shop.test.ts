import { describe, expect, it } from 'vitest';
import { AD_COOLDOWN_SECONDS, AD_STEPS } from '../src/config/shop';
import { BALANCE } from '../src/config/balance';
import { loadPerks, PERKS_KEY, savePerks } from '../src/core/perks';
import { exportSave, loadGame, parseSave, saveGame } from '../src/core/save';
import { adStreak, claimAdStep } from '../src/core/shop';
import { multipliers } from '../src/core/economy';
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
  it('gives 1 gem, x2 for 30 s, 2 gems, x2 for 60 s, 5 gems, in that order', () => {
    const s = fresh();
    const t = 1000;
    expect(claimAdStep(s, t)).toEqual({ gems: 1 });
    expect(s.skillPoints).toBe(1);
    expect(claimAdStep(s, t)).toEqual({ boost: 30 });
    expect(s.boost).toBe(30);
    expect(claimAdStep(s, t)).toEqual({ gems: 2 });
    expect(claimAdStep(s, t)).toEqual({ boost: 60 });
    expect(s.boost).toBe(60);
    expect(claimAdStep(s, t)).toEqual({ gems: 5 });
    expect(s.skillPoints).toBe(8);
    expect(s.skillEarned).toBe(8);
  });

  it('locks for a day after the fifth ad, then starts again at the first', () => {
    const s = fresh();
    const t = 5_000_000;
    for (let i = 0; i < AD_STEPS.length; i++) claimAdStep(s, t);
    expect(adStreak(s, t).lockedFor).toBe(AD_COOLDOWN_SECONDS);
    expect(claimAdStep(s, t + 3600 * 1000)).toBeNull();
    expect(s.skillPoints).toBe(8);
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

  it('are kept apart from the save: not in the save, not in a save code, not lost by a reset', () => {
    const s = fresh();
    s.perks = { noAds: true, x5: true };
    const store = memory();
    saveGame(s, 1, store);
    expect(store.data.get('surf-tycoon-save-v1')).not.toContain('perks');
    expect(exportSave(s)).not.toContain('perks');
    const forged = fresh() as unknown as { perks: unknown };
    forged.perks = { x5: true };
    const parsed = parseSave(JSON.stringify(forged));
    expect(parsed?.perks).toEqual({});
    store.data.set('surf-tycoon-save-v1', JSON.stringify(forged));
    expect(loadGame(0, store).perks).toEqual({});
  });

  it('are stored on the device and read back', () => {
    const store = memory();
    expect(loadPerks(store)).toEqual({ noAds: false, x5: false });
    savePerks({ x5: true }, store);
    expect(store.data.has(PERKS_KEY)).toBe(true);
    expect(loadPerks(store)).toEqual({ noAds: false, x5: true });
  });
});
