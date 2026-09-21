import { describe, expect, it } from 'vitest';
import { ZONES } from '../src/config/sports';
import { buyManager, buyStat, tapZone, tick } from '../src/core/economy';
import { claimQuest, QUEST_SLOTS, questReward, questView, refreshQuests } from '../src/core/quests';
import { newGame } from '../src/core/state';
import { expand } from '../src/core/unlocks';

function game() {
  const s = newGame(0);
  refreshQuests(s);
  return s;
}

describe('quests', () => {
  it('there are many at a time, small ones first: level 10, ten sessions, forty guests', () => {
    const s = game();
    expect(s.quests).toHaveLength(QUEST_SLOTS - 1); // "get more guests" only comes later
    const texts = s.quests.map((q) => questView(s, q).text);
    expect(texts[0]).toBe('Level up Beginner class to level 10');
    expect(texts).toContain('Finish 10 sessions at Beginner class');
    expect(texts).toContain('Serve 40 guests at Beginner class');
    expect(texts.some((t) => /^Earn /.test(t))).toBe(true);
    expect(texts.some((t) => /^Get \d+ surfers/.test(t))).toBe(false);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('more guests is asked later, when a few quests were finished', () => {
    const s = game();
    s.questsDone = 4;
    s.quests = [];
    refreshQuests(s);
    expect(s.quests.map((q) => q.kind)).toContain('guests');
    const g = s.quests.find((q) => q.kind === 'guests')!;
    expect(questView(s, g).text).toMatch(/^Get 10 surfers in /);
  });

  it('are the same every time for the same game (nothing is random)', () => {
    expect(JSON.stringify(game().quests)).toBe(JSON.stringify(game().quests));
  });

  it('count sessions and guests served from the moment the quest was made', () => {
    const s = game();
    const sessions = s.quests.find((q) => q.kind === 'sessions')!;
    const served = s.quests.find((q) => q.kind === 'served')!;
    buyManager(s, 'wave-1'); // (no coins: nothing happens)
    s.coins = 1e6;
    buyManager(s, 'wave-1');
    tick(s, 6 * 5 + 0.1); // five sessions of 6 seconds
    expect(questView(s, sessions).current).toBe(5);
    expect(questView(s, served).current).toBe(Math.floor(5 * 3));
    tick(s, 6 * 5);
    expect(questView(s, sessions).done).toBe(true);
    expect(questView(s, served).done).toBe(false); // 30 of 40 guests
    tick(s, 6 * 4);
    expect(questView(s, served).done).toBe(true);
  });

  it('an unmanaged zone counts a session when it is done', () => {
    const s = game();
    const sessions = s.quests.find((q) => q.kind === 'sessions')!;
    tapZone(s, 'wave-1');
    tick(s, 7);
    expect(questView(s, sessions).current).toBe(1);
  });

  it('earn quests count coins earned after they were made', () => {
    const s = game();
    const earn = s.quests.find((q) => q.kind === 'earn')!;
    expect(questView(s, earn).current).toBe(0);
    s.totalCoins += 33;
    expect(questView(s, earn).current).toBe(33);
  });

  it('finish when the number is reached, and then pay coins', () => {
    const s = game();
    const q = s.quests[0];
    expect(questView(s, q).done).toBe(false);
    expect(claimQuest(s, 0)).toBe(0);
    s.coins = 1e12;
    buyStat(s, 'wave-1', 'price', 10);
    expect(questView(s, q).done).toBe(true);
    const before = s.coins;
    const reward = claimQuest(s, 0);
    expect(reward).toBeGreaterThan(0);
    expect(s.coins).toBe(before + reward);
    expect(s.questsDone).toBe(1);
    expect(s.quests.length).toBeGreaterThanOrEqual(QUEST_SLOTS - 1);
    // the next level quest asks for the next step
    expect(s.quests.find((x) => x.kind === 'level')?.target).toBe(25);
  });

  it('a manager quest is finished by hiring one', () => {
    const s = game();
    s.questsDone = 1; // the third quest cycles: unlock, manager, ...
    s.quests = [];
    refreshQuests(s);
    const m = s.quests.find((q) => q.kind === 'manager');
    expect(m).toBeDefined();
    s.coins = 1e12;
    buyManager(s, 'wave-1');
    expect(questView(s, m!).done).toBe(true);
  });

  it('every quest has its own reward: harder jobs pay more, and it is fixed when the quest is made', () => {
    const s = game();
    const rewards = s.quests.map((q) => questView(s, q).reward);
    expect(rewards.every((r) => r > 0)).toBe(true);
    expect(s.quests.every((q) => q.reward === questView(s, q).reward)).toBe(true);
    const unlock = { kind: 'unlock' as const, zone: 'wave-2', target: 1 };
    const level = { kind: 'level' as const, zone: 'wave-1', target: 25 };
    expect(questView(s, unlock).reward).toBeGreaterThan(questView(s, level).reward);
    const q = s.quests[1];
    const before = questView(s, q).reward;
    s.coins = 1e15;
    buyManager(s, 'wave-1');
    buyStat(s, 'wave-1', 'price', 'max');
    expect(questView(s, q).reward).toBe(before); // the beach earns more now, the quest still pays what it said
  });

  it('the reward grows with what the beach earns and has a minimum', () => {
    const s = game();
    const first = questReward(s);
    expect(first).toBeGreaterThanOrEqual(40);
    s.coins = 1e15;
    buyStat(s, 'wave-1', 'price', 'max');
    buyManager(s, 'wave-1');
    expect(questReward(s)).toBeGreaterThan(first * 100);
  });

  it('start again after the beach was expanded (old quests would ask for zones that are gone)', () => {
    const s = game();
    s.zones['wave-2'].owned = true;
    s.quests[0] = { kind: 'level', zone: 'wave-2', target: 25 };
    // (the player has met the requirements for the first expansion)
    for (const z of ZONES) if (s.sports[z.sport.id]) s.zones[z.id].owned = true;
    s.sports.skimboarding = true;
    for (const z of ZONES) if (z.sport.id === 'skimboarding') s.zones[z.id].owned = true;
    s.reputation = 1e6;
    s.coins = 1e15;
    expect(expand(s)).toBe(true);
    refreshQuests(s);
    expect(s.quests.length).toBeGreaterThanOrEqual(QUEST_SLOTS - 1);
    for (const q of s.quests) if (q.zone && q.kind !== 'unlock') expect(s.zones[q.zone].owned).toBe(true);
  });
});
