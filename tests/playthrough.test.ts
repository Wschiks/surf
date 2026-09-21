import { describe, expect, it } from 'vitest';
import { ZONES } from '../src/config/sports';
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
    expect(run.finishedAt!).toBeLessThan(14 * HOUR);
  });

  it('gives the first reward within minutes', () => {
    const first = run.events.find((e) => e.what.startsWith('unlocked'));
    expect(first).toBeDefined();
    expect(first!.t).toBeLessThan(15 * 60);
  });

  it('plays in three parts: two beach expansions, each one opening a new area', () => {
    const expansions = run.events.filter((e) => e.what.startsWith('EXPANSION'));
    expect(expansions).toHaveLength(2);
    expect(expansions[0].t).toBeGreaterThan(30 * 60);
    expect(expansions[1].t).toBeGreaterThan(expansions[0].t + 30 * 60);
    expect(run.state.expansions).toBe(2);
  });

  it('levels of a sport unlock in order', () => {
    // within one part of the game every sport unlocks Level 2 before 3 before 4
    let part: Record<string, number> = {};
    for (const e of run.events) {
      if (e.what.startsWith('EXPANSION')) part = {};
      const m = /^unlocked (.+) level (\d)/.exec(e.what);
      if (m) {
        const level = Number(m[2]);
        expect(level).toBeGreaterThan(part[m[1]] ?? 1);
        part[m[1]] = level;
      }
    }
  });

  it('has no long dead ends: there is always something to work towards', () => {
    const unlocks = run.events.filter((e) => e.what.startsWith('unlocked') || e.what.startsWith('EXPANSION')).map((e) => e.t);
    let prev = 0;
    for (const t of unlocks) {
      expect(t - prev).toBeLessThan(3.5 * HOUR);
      prev = t;
    }
    expect(run.longestWait.seconds).toBeLessThan(3 * HOUR);
  });

  it('keeps a growing income the whole way', () => {
    // every sport has been played, so the coins are far above where they started
    expect(run.state.totalCoins).toBeGreaterThan(1e9);
  });
});
