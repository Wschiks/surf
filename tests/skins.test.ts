import { describe, expect, it } from 'vitest';
import { BOX_ODDS, BOXES, MAX_PIECES, RARITIES, SKINS, STARTER_SKIN, skinsOfZone } from '../src/config/skins';
import { ZONES } from '../src/config/sports';
import { buyCoinBox, buyGemBoxes, coinBoxPrice, giveBox, openBox, skinBoost, tierOf, unlockAllSkins, wearSkin } from '../src/core/skins';
import { newGame } from '../src/core/state';
import { zoneStats } from '../src/core/economy';
import { loadGame, saveGame } from '../src/core/save';

describe('skins: the collection', () => {
  it('has 3 skins for every section of every water sport (72): Common on the waves, Rare at sea, Epic on the ocean, one Legendary per section', () => {
    expect(SKINS.length).toBe(72);
    const byArea: Record<string, string> = { wave: 'common', sea: 'rare', ocean: 'epic' };
    for (const z of ZONES) {
      const own = skinsOfZone(z.id);
      expect(own.length).toBe(3);
      expect(new Set(own.map((s) => s.name)).size).toBe(3);
      own.forEach((s, k) => expect(s.rarity).toBe(k === 2 ? 'legendary' : byArea[z.sport.area]));
    }
    const legendary = SKINS.filter((s) => s.rarity === 'legendary');
    expect(legendary.length).toBe(24);
    expect(new Set(legendary.map((s) => s.zone)).size).toBe(24);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(72);
  });

  it('a rarer skin is harder to complete: odds per skin go down with rarity', () => {
    const per = RARITIES.map((r) => BOX_ODDS.normal[r] / SKINS.filter((s) => s.rarity === r).length);
    for (let i = 1; i < per.length; i++) expect(per[i]).toBeLessThan(per[i - 1]);
  });

  it('box odds add up to 100', () => {
    for (const odds of Object.values(BOX_ODDS)) expect(Object.values(odds).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('tiers: 4 pieces unlock the look, 8 Bronze, 17 Silver', () => {
    expect([0, 3, 4, 7, 8, 16, 17].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(MAX_PIECES).toBe(17);
  });
});

describe('skins: boxes', () => {
  it('the first four boxes make one surf school skin, and it is put on', () => {
    const s = newGame(0);
    giveBox(s, 4);
    for (let i = 0; i < 4; i++) openBox(s, 'normal');
    expect(STARTER_SKIN.id).toBe('wave-1-1');
    expect(s.skins.pieces[STARTER_SKIN.id]).toBe(4);
    expect(s.skins.worn[STARTER_SKIN.zone]).toBe(STARTER_SKIN.id);
  });

  it('a piece is never wasted, and a golden box gives rarer pieces', () => {
    const s = newGame(0);
    giveBox(s, 2000);
    for (let i = 0; i < 2000; i++) openBox(s, 'normal');
    expect(Object.values(s.skins.pieces).every((p) => p <= MAX_PIECES)).toBe(true);
    const total = Object.values(s.skins.pieces).reduce((a, b) => a + b, 0);
    expect(total).toBe(Math.min(2000, 72 * MAX_PIECES));
    const g = newGame(0);
    g.skins.golden = 200;
    const got: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const r = openBox(g, 'golden')!;
      got[r.skin.rarity] = (got[r.skin.rarity] ?? 0) + 1;
    }
    expect(got.common ?? 0).toBe(0);
    expect(got.legendary).toBeGreaterThan(80);
  });

  it('the coin box costs 50K, then 3x more every time; gem boxes cost gems', () => {
    const s = newGame(0);
    s.coins = 1e9;
    expect(coinBoxPrice(s)).toBe(BOXES.coinStart);
    expect(buyCoinBox(s)).toBe(true);
    expect(coinBoxPrice(s)).toBe(BOXES.coinStart * 3);
    expect(s.skins.boxes).toBe(1);
    s.skillPoints = 60;
    expect(buyGemBoxes(s, 'three')).toBe(true);
    expect(buyGemBoxes(s, 'golden')).toBe(true);
    expect(s.skins.boxes).toBe(4);
    expect(s.skins.golden).toBe(1);
    expect(buyGemBoxes(s, 'golden')).toBe(false);
  });
});

describe('skins: the boost', () => {
  it('only the skin a section wears counts: Bronze +100%, Silver +500% on that section', () => {
    const s = newGame(0);
    const ref = ZONES[0];
    const base = zoneStats(s, ref).income;
    const skin = skinsOfZone(ref.id)[1];
    s.skins.pieces[skin.id] = 8;
    expect(skinBoost(s, ref.id)).toBe(0);
    expect(wearSkin(s, skin.id)).toBe(true);
    expect(zoneStats(s, ref).income).toBeCloseTo(base * 2);
    s.skins.pieces[skin.id] = 17;
    expect(zoneStats(s, ref).income).toBeCloseTo(base * 6);
    expect(zoneStats(s, ZONES[1]).income).toBeCloseTo(zoneStats(newGame(0), ZONES[1]).income);
  });

  it('a skin that is not unlocked cannot be worn', () => {
    const s = newGame(0);
    s.skins.pieces[SKINS[5].id] = 3;
    expect(wearSkin(s, SKINS[5].id)).toBe(false);
  });

  it('skins and boxes are saved, and old saves start with none', () => {
    const s = newGame(0);
    giveBox(s, 3);
    s.skins.pieces[SKINS[2].id] = 5;
    const store: Record<string, string> = {};
    saveGame(s, 1, { setItem: (k, v) => (store[k] = v) });
    const back = loadGame(2, { getItem: (k) => store[k] ?? null });
    expect(back.skins.boxes).toBe(3);
    expect(back.skins.pieces[SKINS[2].id]).toBe(5);
    const old = JSON.parse(Object.values(store)[0]);
    delete old.skins;
    const fromOld = loadGame(3, { getItem: () => JSON.stringify(old) });
    expect(fromOld.skins.boxes).toBe(0);
  });
});

describe('skins: the test switch', () => {
  it('unlocks every look (4 pieces) without taking pieces away', () => {
    const s = newGame(0);
    s.skins.pieces[SKINS[5].id] = 12;
    unlockAllSkins(s);
    expect(SKINS.every((k) => tierOf(s.skins.pieces[k.id]) >= 1)).toBe(true);
    expect(s.skins.pieces[SKINS[5].id]).toBe(12);
    expect(s.skins.pieces[SKINS[0].id]).toBe(4);
  });
});
