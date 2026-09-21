import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { buyManager, buyStat } from '../src/core/economy';
import { claimQuest, QUEST_SLOTS, questReward, questView, refreshQuests } from '../src/core/quests';
import { newGame } from '../src/core/state';
import { expand } from '../src/core/unlocks';

BALANCE.testAlwaysExpand = false;

function game() {
  const s = newGame(0);
  refreshQuests(s);
  return s;
}

describe('quests', () => {
  it('there are three at a time, and the first ones ask for a level, guests and one more job', () => {
    const s = game();
    expect(s.quests).toHaveLength(QUEST_SLOTS);
    expect(s.quests.map((q) => q.kind).slice(0, 2)).toEqual(['level', 'guests']);
    const texts = s.quests.map((q) => questView(s, q).text);
    expect(texts[0]).toMatch(/^Level up .* to level 25$/);
    expect(texts[1]).toMatch(/^Get 10 surfers in /);
    expect(new Set(texts).size).toBe(3);
  });

  it('are the same every time for the same game (nothing is random)', () => {
    expect(JSON.stringify(game().quests)).toBe(JSON.stringify(game().quests));
  });

  it('finish when the number is reached, and then pay coins', () => {
    const s = game();
    const q = s.quests[0];
    expect(questView(s, q).done).toBe(false);
    expect(claimQuest(s, 0)).toBe(0);
    s.coins = 1e12;
    buyStat(s, 'wave-1', 'price', 25);
    expect(questView(s, q).done).toBe(true);
    const before = s.coins;
    const reward = claimQuest(s, 0);
    expect(reward).toBeGreaterThan(0);
    expect(s.coins).toBe(before + reward);
    expect(s.questsDone).toBe(1);
    expect(s.quests).toHaveLength(QUEST_SLOTS);
    // the next level quest asks for the next step
    expect(s.quests.find((x) => x.kind === 'level')?.target).toBe(50);
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
    BALANCE.testAlwaysExpand = true;
    const s = game();
    s.zones['wave-2'].owned = true;
    s.quests[0] = { kind: 'level', zone: 'wave-2', target: 25 };
    expand(s);
    refreshQuests(s);
    BALANCE.testAlwaysExpand = false;
    expect(s.quests).toHaveLength(QUEST_SLOTS);
    for (const q of s.quests) if (q.zone && q.kind !== 'unlock') expect(s.zones[q.zone].owned).toBe(true);
  });
});
