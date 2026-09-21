import { describe, expect, it } from 'vitest';
import { SAVE_KEY, loadGame, saveGame } from '../src/core/save';
import { buyManager, tick, tapZone } from '../src/core/economy';
import { Game } from '../src/core/game';
import { newGame } from '../src/core/state';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}

describe('saving', () => {
  it('round trips the game state', () => {
    const store = memoryStorage();
    const s = newGame(1000);
    s.coins = 123;
    s.zones['wave-1'].capacity = 4;
    saveGame(s, 5000, store);
    const back = loadGame(9000, store);
    expect(back.coins).toBe(123);
    expect(back.zones['wave-1'].capacity).toBe(4);
    expect(back.savedAt).toBe(5000);
  });

  it('starts a new game when nothing or garbage is saved', () => {
    expect(loadGame(0, memoryStorage()).sports.wave).toBe(true);
    expect(loadGame(0, memoryStorage({ [SAVE_KEY]: '{not json' })).coins).toBe(0);
  });

  it('adds zones and facilities that a save from an older version does not have yet', () => {
    const store = memoryStorage();
    const s = newGame(0);
    delete (s.zones as Record<string, unknown>)['wave-1'];
    delete (s.facilities as Record<string, unknown>)['shop'];
    store.setItem(SAVE_KEY, JSON.stringify(s));
    const back = loadGame(0, store);
    expect(back.zones['wave-1']).toBeDefined();
    expect(back.facilities.shop).toBe(0);
  });
});

describe('game clock', () => {
  it('pays managed zones for the time the player was away', () => {
    const s = newGame(0);
    s.skills = {}; // (the free root skill would add 5%)
    s.coins = 1e6;
    buyManager(s, 'wave-1');
    const before = s.coins;
    const store = memoryStorage();
    saveGame(s, 10_000, store);
    // the Game class reads localStorage, so emulate it
    (globalThis as unknown as { localStorage: unknown }).localStorage = store;
    const g = new Game(10_000 + 3600 * 1000);
    expect(g.state.coins - before).toBeCloseTo(3600 * 0.5 * 1.05, 0); // (+5%: the free root skill of wave surfing)
    expect(g.offlineReport?.coins).toBeGreaterThan(1000);
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });

  it('a long gap in the update loop counts as time away', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = memoryStorage();
    const g = new Game(0);
    g.state.coins = 1e6;
    buyManager(g.state, 'wave-1');
    tapZone(g.state, 'wave-1');
    const before = g.state.coins;
    g.update(1000);
    g.update(1000 + 600_000);
    expect(g.state.coins - before).toBeGreaterThan(200);
    tick(g.state, 0);
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });
});

describe('starting over', () => {
  it('does not write the old game back after the save was erased', () => {
    const store = memoryStorage();
    (globalThis as unknown as { localStorage: unknown }).localStorage = store;
    const g = new Game(0);
    g.save(1);
    expect(store.data[SAVE_KEY]).toBeDefined();
    store.removeItem(SAVE_KEY);
    g.stopSaving();
    g.save(2);
    g.update(10_000);
    expect(store.data[SAVE_KEY]).toBeUndefined();
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  });
});

describe('save codes', () => {
  it('a save can be copied as text and restored', async () => {
    const { exportSave, parseSave } = await import('../src/core/save');
    const s = newGame(1000);
    s.coins = 4242;
    s.expansions = 1;
    s.zones['wave-1'].price = 33;
    const code = exportSave(s);
    expect(code.startsWith('SURF1:')).toBe(true);
    const back = parseSave(code);
    expect(back?.coins).toBe(4242);
    expect(back?.expansions).toBe(1);
    expect(back?.zones['wave-1'].price).toBe(33);
  });

  it('rejects text that is not a save', async () => {
    const { parseSave } = await import('../src/core/save');
    expect(parseSave('hello')).toBeNull();
    expect(parseSave('SURF1:!!!')).toBeNull();
    expect(parseSave('{"version":1,"coins":5}')).toBeNull();
    expect(parseSave('')).toBeNull();
  });
});
