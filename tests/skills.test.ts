import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { RING_RADIUS, TREE_UNIT, skillPosition, EXPANSION_POINTS, QUEST_POINTS, SKILL_NODES, SKILL_TREES, describeSkill, skillById } from '../src/config/skills';
import { SPORTS, zoneById } from '../src/config/sports';
import { buyFacility, buyManager, buyStat, discounts, facilityCost, managerCost, offlineCap, statCost, zoneStats } from '../src/core/economy';
import { claimQuest, questView, refreshQuests } from '../src/core/quests';
import { canLearn, learnSkill, skillEffects, skillStatus } from '../src/core/skills';
import { newGame, type GameState } from '../src/core/state';
import { expand, levelStatus } from '../src/core/unlocks';

const W1 = zoneById('wave-1');
function game(): GameState {
  const s = newGame(0);
  s.skills = {}; // no free roots, to check the effects one by one
  return s;
}
function learnPath(s: GameState, id: string) {
  const chain: string[] = [];
  for (let n: string | null = id; n; n = skillById(n).parent) chain.unshift(n);
  s.skillPoints += 1000;
  for (const c of chain) if (!s.skills[c]) s.skills = { ...s.skills, [c]: true };
}

describe('skill trees', () => {
  it('there are seven trees: one for each of the six sports and one for the beach', () => {
    expect(SKILL_TREES).toHaveLength(7);
    expect(SKILL_TREES.map((t) => t.id).sort()).toEqual([...SPORTS.map((s) => s.id), 'beach'].sort());
  });

  it('every tree starts with one free skill the player cannot choose, and then splits up', () => {
    for (const t of SKILL_TREES) {
      const roots = t.nodes.filter((n) => n.parent === null);
      expect(roots).toHaveLength(1);
      expect(roots[0].cost).toBe(0);
      expect(roots[0].root).toBe(true);
      const kids = t.nodes.filter((n) => n.parent === roots[0].id);
      expect(kids.length).toBeGreaterThanOrEqual(2); // a choice
      expect(t.nodes.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('every skill has a parent inside its own tree, costs points and reads as a sentence', () => {
    const ids = new Set(SKILL_NODES.map((n) => n.id));
    for (const n of SKILL_NODES) {
      if (n.parent) expect(ids.has(n.parent)).toBe(true);
      if (n.parent) expect(skillById(n.parent).tree).toBe(n.tree);
      if (!n.root) expect(n.cost).toBeGreaterThan(0);
      expect(describeSkill(n).length).toBeGreaterThan(5);
    }
    expect(new Set(SKILL_NODES.map((n) => n.id)).size).toBe(SKILL_NODES.length);
  });

  it('a new game has the seven root skills', () => {
    const s = newGame(0);
    expect(SKILL_TREES.every((t) => s.skills[t.nodes[0].id])).toBe(true);
    expect(Object.keys(s.skills)).toHaveLength(7);
  });
});

describe('the skill wheel', () => {
  it('the seven free roots sit on a ring around one hub in the middle', () => {
    for (const t of SKILL_TREES) expect(Math.hypot(t.at.x, t.at.y)).toBeCloseTo(RING_RADIUS, -1);
    const ats = SKILL_TREES.map((t) => t.at);
    for (let i = 0; i < ats.length; i++) for (let j = i + 1; j < ats.length; j++) expect(Math.hypot(ats[i].x - ats[j].x, ats[i].y - ats[j].y)).toBeGreaterThan(120);
  });

  it('every tree grows outward from its root, away from the hub', () => {
    for (const t of SKILL_TREES) {
      const root = t.nodes[0];
      const r0 = Math.hypot(skillPosition(root).x, skillPosition(root).y);
      for (const n of t.nodes.slice(1)) expect(Math.hypot(skillPosition(n).x, skillPosition(n).y)).toBeGreaterThan(r0 - 1);
    }
  });

  it('no two skills lie on top of each other', () => {
    const pts = SKILL_NODES.map((n) => skillPosition(n));
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y), `${SKILL_NODES[i].id} / ${SKILL_NODES[j].id}`).toBeGreaterThan(TREE_UNIT * 0.6);
  });
});

describe('learning skills', () => {
  it('needs the parent skill and enough skill points, and costs the points', () => {
    const s = game();
    const first = skillById('wave:prices1');
    expect(skillStatus(s, first)).toBe('locked'); // (this test game has no free roots yet)
    s.skills = { 'wave:root': true };
    expect(skillStatus(s, first)).toBe('available');
    expect(skillStatus(s, skillById('wave:guests1'))).toBe('locked');
    expect(canLearn(s, first)).toBe(false); // no points
    s.skillPoints = 1;
    expect(learnSkill(s, 'wave:prices1')).toBe(true);
    expect(s.skillPoints).toBe(0);
    expect(skillStatus(s, first)).toBe('owned');
    expect(learnSkill(s, 'wave:prices1')).toBe(false);
    s.skillPoints = 50;
    expect(learnSkill(s, 'wave:guests1')).toBe(true); // its parent is learned now
    expect(learnSkill(s, 'wave:speed2')).toBe(false); // parent not learned
  });

  it('skill points are rare: easy quests pay none, harder ones pay some, every 5th quest pays one', () => {
    const s = game();
    refreshQuests(s);
    s.coins = 1e12;
    buyStat(s, 'wave-1', 'price', 10);
    const easy = s.quests[0];
    expect(easy.kind).toBe('level');
    expect(questView(s, easy).points).toBe(0);
    const before = s.skillPoints;
    expect(claimQuest(s, 0)).toBeGreaterThan(0);
    expect(s.skillPoints).toBe(before); // no gem for an easy quest
    expect(QUEST_POINTS.unlock).toBeGreaterThan(QUEST_POINTS.manager);
    expect(QUEST_POINTS.expand).toBeGreaterThan(QUEST_POINTS.unlock);
    expect(EXPANSION_POINTS[1]).toBeGreaterThan(0);
    // only some quests that are made are gem quests, and a quest keeps its gems (they are fixed when it is made)
    const t = game();
    refreshQuests(t);
    for (let i = 0; i < 40; i++) {
      const idx = t.quests.findIndex((x) => x.kind === 'earn');
      if (idx < 0) break;
      const others = t.quests.filter((_, j) => j !== idx).map((x) => ({ x, points: x.points }));
      t.totalCoins += 1e15;
      claimQuest(t, idx);
      for (const o of others) expect(o.x.points).toBe(o.points);
    }
    expect(t.questsMade).toBeGreaterThan(5);
    expect(t.quests.filter((x) => (x.points ?? 0) > 0).length).toBeLessThan(t.quests.length); // never all of them
    expect(t.quests.filter((x) => x.kind === 'earn' && (x.points ?? 0) > 0).length).toBeLessThanOrEqual(1);
    // and a hard quest pays its own gems
    expect(questView(s, { kind: 'unlock', zone: 'wave-2', target: 1 }).points).toBe(2);
  });

  it('skills stay when the beach is expanded, and the expansion pays skill points', () => {
    const s = newGame(0);
    s.skills = { ...s.skills, 'wave:prices1': true, 'beach:away1': true };
    s.sports.skimboarding = true;
    for (const z of SPORTS.filter((x) => x.area !== 'sea' && x.area !== 'ocean').flatMap((x) => x.levels.map((_, i) => `${x.id}-${i + 1}`))) s.zones[z].owned = true;
    s.coins = 1e15;
    const points = s.skillPoints;
    expect(expand(s)).toBe(true);
    expect(s.skills['wave:prices1']).toBe(true);
    expect(s.skills['beach:away1']).toBe(true);
    expect(s.skillPoints).toBe(points + EXPANSION_POINTS[1]);
  });
});

describe('what the skills do', () => {
  it('coins: +x% from that sport only', () => {
    const s = game();
    const base = zoneStats(s, W1).income;
    const other = zoneStats(s, zoneById('skimboarding-1')).income;
    learnPath(s, 'wave:prices1'); // the free root (+5%) and this skill (+8%)
    expect(skillEffects(s).coins.wave).toBeCloseTo(0.13);
    expect(zoneStats(s, W1).income).toBeCloseTo(base * 1.13);
    expect(zoneStats(s, zoneById('skimboarding-1')).income).toBeCloseTo(other);
  });

  it('speed, guests and cheaper space', () => {
    const s = game();
    const st = zoneStats(s, W1);
    learnPath(s, 'wave:speed1');
    learnPath(s, 'wave:guests1');
    learnPath(s, 'wave:space1');
    const after = zoneStats(s, W1);
    expect(after.duration).toBeCloseTo(st.duration / 1.08);
    expect(after.guests).toBe(st.guests + 1);
    expect(statCost(W1, 'capacity', 0, discounts(s, 'wave').stat('capacity'))).toBeLessThan(statCost(W1, 'capacity', 0));
    expect(discounts(s, 'wave').stat('price')).toBe(0); // only the bigger class gets cheaper
  });

  it('cost, manager and unlock discounts', () => {
    const s = game();
    const up = statCost(W1, 'price', 0);
    const mgr = managerCost(W1);
    const unlock = levelStatus(s, zoneById('wave-2')).coins;
    learnPath(s, 'wave:cost1');
    learnPath(s, 'wave:manager1');
    learnPath(s, 'wave:unlock1');
    const d = discounts(s, 'wave');
    expect(statCost(W1, 'price', 0, d.stat('price'))).toBeLessThan(up);
    expect(managerCost(W1, d.manager)).toBeLessThan(mgr);
    expect(levelStatus(s, zoneById('wave-2')).coins).toBeLessThan(unlock);
    // the discount is really paid when buying
    s.coins = 1e9;
    const before = s.coins;
    buyManager(s, 'wave-1');
    expect(before - s.coins).toBe(managerCost(W1, d.manager));
  });

  it('beach: buildings work better and cost less', () => {
    const s = game();
    s.coins = 1e12;
    buyFacility(s, 'shop');
    const plain = zoneStats(s, W1).income;
    const cost = facilityCost('shop', 1);
    learnPath(s, 'beach:build1');
    learnPath(s, 'beach:material1');
    expect(zoneStats(s, W1).income).toBeGreaterThan(plain);
    expect(facilityCost('shop', 1, skillEffects(s).facilityCost)).toBeLessThan(cost);
  });

  it('beach: away time is 2 hours and grows with skills', () => {
    expect(BALANCE.offlineCapSeconds).toBe(2 * 3600);
    const s = game();
    expect(offlineCap(s)).toBe(2 * 3600);
    learnPath(s, 'beach:away1');
    learnPath(s, 'beach:away2');
    expect(offlineCap(s)).toBe((2 + 0.5 + 1 + 1.5) * 3600); // 2 hours + the free root + two skills
    const all = game();
    for (const n of SKILL_NODES.filter((x) => x.tree === 'beach')) all.skills[n.id] = true;
    expect(offlineCap(all)).toBe((2 + 0.5 + 1 + 1.5 + 2 + 3) * 3600);
  });

  it('beach: quests pay more and everything pays a little more', () => {
    const s = game();
    refreshQuests(s);
    learnPath(s, 'beach:quests1');
    learnPath(s, 'beach:busy');
    expect(skillEffects(s).quest).toBeCloseTo(0.25);
    expect(skillEffects(s).allCoins).toBeCloseTo(0.05);
  });

  it('discounts never go below 30% of the price', () => {
    const s = game();
    for (const n of SKILL_NODES) s.skills[n.id] = true;
    const fx = skillEffects(s);
    for (const t of SPORTS) {
      expect(fx.cost[t.id]).toBeLessThanOrEqual(0.7);
      expect(fx.unlock[t.id]).toBeLessThanOrEqual(0.7);
    }
    expect(fx.facilityCost).toBeLessThanOrEqual(0.7);
  });
});
