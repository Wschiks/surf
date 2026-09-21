import { describe, expect, it } from 'vitest';
import { SPORTS, ZONES } from '../src/config/sports';
import { simulate } from '../src/core/bot';

// One full game played by the balance bot (10 second steps, up to 40 hours of play).
const run = simulate({ maxSeconds: 40 * 3600, step: 10 });
const HOUR = 3600;

describe('full playthrough with the balance bot', () => {
  it('unlocks every sport and level and hires every manager', () => {
    expect(run.finishedAt).not.toBeNull();
    for (const z of ZONES) {
      expect(run.state.zones[z.id].owned).toBe(true);
      expect(run.state.zones[z.id].manager).toBe(true);
    }
  });

  it('takes hours, not minutes and not weeks', () => {
    expect(run.finishedAt!).toBeGreaterThan(4 * HOUR);
    expect(run.finishedAt!).toBeLessThan(12 * HOUR);
    expect(run.maxedAt).not.toBeNull();
    expect(run.maxedAt!).toBeLessThan(36 * HOUR);
  });

  it('gives the first reward within minutes', () => {
    const first = run.events.find((e) => e.what.startsWith('unlocked'));
    expect(first).toBeDefined();
    expect(first!.t).toBeLessThan(15 * 60);
  });

  it('follows the unlock order of the concept: sports one at a time, each after Level 2 of the previous', () => {
    const unlockTime = new Map<string, number>();
    for (const e of run.events) {
      const sport = SPORTS.find((s) => e.what === `unlocked sport ${s.name}`);
      if (sport) unlockTime.set(sport.id, e.t);
      const lvl = /^unlocked (.+) level (\d)/.exec(e.what);
      if (lvl) {
        const s = SPORTS.find((x) => x.name === lvl[1])!;
        unlockTime.set(`${s.id}-${lvl[2]}`, e.t);
      }
    }
    const ordered = [...SPORTS].sort((a, b) => a.order - b.order);
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      expect(unlockTime.get(ordered[i].id)).toBeGreaterThan(unlockTime.get(`${prev.id}-2`)!);
    }
    // levels of a sport unlock in order
    for (const s of SPORTS) for (let l = 3; l <= 4; l++) expect(unlockTime.get(`${s.id}-${l}`)!).toBeGreaterThan(unlockTime.get(`${s.id}-${l - 1}`)!);
  });

  it('has no long dead ends: there is always something to work towards', () => {
    const unlocks = run.events.filter((e) => e.what.startsWith('unlocked')).map((e) => e.t);
    let prev = 0;
    for (const t of unlocks) {
      expect(t - prev).toBeLessThan(3 * HOUR);
      prev = t;
    }
    expect(run.longestWait.seconds).toBeLessThan(3 * HOUR);
  });

  it('keeps a growing income the whole way', () => {
    // every sport has been played, so reputation and coins are far above where they started
    expect(run.state.reputation).toBeGreaterThan(10_000);
    expect(run.state.totalCoins).toBeGreaterThan(1e9);
  });
});
