import { SPORTS, type SportId } from './sports';

// Skill trees. Skill points (the second currency) come from quests and from beach expansions. Every sport has its own
// little tree, and the beach has one too: seven trees in all. Every tree starts with one free skill that the player
// cannot choose (the root); from there the tree splits up and the player chooses what to learn.
// Skills are permanent: they stay when the beach is expanded.

export type TreeId = SportId | 'beach';

export type SkillKind =
  // for one sport
  | 'coins' // +x coins from this sport
  | 'speed' // sessions of this sport are x faster
  | 'guests' // +x guests in every zone of this sport
  | 'cost' // upgrades of this sport are x cheaper
  | 'manager' // managers of this sport are x cheaper
  | 'rep' // +x reputation from this sport
  | 'unlock' // levels and the sport itself unlock x cheaper
  // for the beach
  | 'facilityPower' // beach buildings work x better
  | 'facilityCost' // beach buildings are x cheaper
  | 'offline' // +x hours of away time that earn coins
  | 'quest' // +x coins from quests
  | 'allCoins'; // +x coins from everything

export interface SkillNode {
  id: string;
  tree: TreeId;
  name: string;
  kind: SkillKind;
  /** Percent as a fraction (0.1 = 10%), a number of guests, or hours, depending on the kind. */
  value: number;
  /** Skill points to learn it. The root is free. */
  cost: number;
  /** The skill that must be learned first. null for the root. */
  parent: string | null;
  /** Place inside the tree, in tree units: x to the right, y up is negative (the root is at 0, 0). */
  x: number;
  y: number;
  root?: boolean;
}

export interface SkillTree {
  id: TreeId;
  name: string;
  color: string;
  icon: string;
  /** Where the root of this tree stands on the skill map, in px. */
  at: { x: number; y: number };
  nodes: SkillNode[];
}

/** Pixels per tree unit on the skill map. */
export const TREE_UNIT = 78;

/** Skill points for completing a quest, by kind of quest. Easy quests pay none: skill points are rare. */
export const QUEST_POINTS: Record<string, number> = { level: 0, sessions: 0, served: 0, earn: 0, guests: 0, speed: 0, manager: 1, facility: 1, unlock: 2, expand: 5 };
/** On top of that, every 5th finished quest pays at least this many skill points, whatever it asks. */
export const LUCKY_QUEST_EVERY = 5;
export const LUCKY_QUEST_POINTS = 1;
/** Skill points for buying beach expansion 1 and 2. */
export const EXPANSION_POINTS = [0, 15, 25];

interface Shape {
  key: string;
  kind: SkillKind;
  value: number;
  cost: number;
  parent: number | null;
  x: number;
  y: number;
}

/** The shape of a sport tree: a free root that splits into two branches, then four, then a big finish. */
const SPORT_SHAPE: Shape[] = [
  { key: 'root', kind: 'coins', value: 0.05, cost: 0, parent: null, x: 0, y: 0 },
  { key: 'prices1', kind: 'coins', value: 0.08, cost: 1, parent: 0, x: -1, y: -1 },
  { key: 'speed1', kind: 'speed', value: 0.08, cost: 1, parent: 0, x: 1, y: -1 },
  { key: 'guests1', kind: 'guests', value: 1, cost: 2, parent: 1, x: -1.85, y: -2 },
  { key: 'cost1', kind: 'cost', value: 0.1, cost: 2, parent: 1, x: -0.35, y: -2 },
  { key: 'manager1', kind: 'manager', value: 0.25, cost: 2, parent: 2, x: 0.7, y: -2 },
  { key: 'rep1', kind: 'rep', value: 0.15, cost: 2, parent: 2, x: 1.9, y: -2 },
  { key: 'prices2', kind: 'coins', value: 0.12, cost: 4, parent: 3, x: -1.85, y: -3 },
  { key: 'unlock1', kind: 'unlock', value: 0.15, cost: 4, parent: 4, x: -0.5, y: -3 },
  { key: 'speed2', kind: 'speed', value: 0.12, cost: 4, parent: 5, x: 0.7, y: -3 },
  { key: 'guests2', kind: 'guests', value: 2, cost: 7, parent: 7, x: -1.2, y: -4 },
  { key: 'master', kind: 'coins', value: 0.3, cost: 12, parent: 9, x: 0.7, y: -4.1 },
];

const BEACH_SHAPE: Shape[] = [
  { key: 'root', kind: 'offline', value: 0.5, cost: 0, parent: null, x: 0, y: 0 },
  { key: 'away1', kind: 'offline', value: 1, cost: 1, parent: 0, x: -1, y: -1 },
  { key: 'build1', kind: 'facilityPower', value: 0.1, cost: 1, parent: 0, x: 1, y: -1 },
  { key: 'away2', kind: 'offline', value: 1.5, cost: 2, parent: 1, x: -1.85, y: -2 },
  { key: 'quests1', kind: 'quest', value: 0.25, cost: 2, parent: 1, x: -0.35, y: -2 },
  { key: 'material1', kind: 'facilityCost', value: 0.15, cost: 2, parent: 2, x: 0.7, y: -2 },
  { key: 'build2', kind: 'facilityPower', value: 0.15, cost: 2, parent: 2, x: 1.9, y: -2 },
  { key: 'away3', kind: 'offline', value: 2, cost: 4, parent: 3, x: -1.85, y: -3 },
  { key: 'busy', kind: 'allCoins', value: 0.05, cost: 4, parent: 4, x: -0.5, y: -3 },
  { key: 'material2', kind: 'facilityCost', value: 0.2, cost: 4, parent: 5, x: 0.7, y: -3 },
  { key: 'away4', kind: 'offline', value: 3, cost: 7, parent: 7, x: -1.2, y: -4 },
  { key: 'grand', kind: 'facilityPower', value: 0.3, cost: 12, parent: 9, x: 0.7, y: -4.1 },
];

const SPORT_NAMES: Record<string, string> = { coins: 'Better prices', speed: 'Quicker sessions', guests: 'Bigger crowds', cost: 'Cheaper upgrades', manager: 'Cheaper managers', rep: 'Happy guests', unlock: 'Cheaper unlocks' };
const BEACH_NAMES: Record<string, string> = { offline: 'Away time', facilityPower: 'Better buildings', facilityCost: 'Cheap materials', quest: 'Quest bonus', allCoins: 'Busy beach' };

function build(id: TreeId, shape: Shape[], names: Record<string, string>, rootName: string, masterName: string): SkillNode[] {
  return shape.map((s, i) => {
    let title = names[s.kind] ?? s.kind;
    if (i === 0) title = rootName;
    if (s.key === 'master' || s.key === 'grand') title = masterName;
    // the second and third skill of the same kind get a number
    const before = shape.slice(0, i).filter((o) => o.kind === s.kind && o.key !== 'root').length;
    if (i !== 0 && s.key !== 'master' && s.key !== 'grand' && before > 0) title += ' ' + ['I', 'II', 'III', 'IV', 'V'][before];
    return { id: `${id}:${s.key}`, tree: id, name: title, kind: s.kind, value: s.value, cost: s.cost, parent: s.parent === null ? null : `${id}:${shape[s.parent].key}`, x: s.x, y: s.y, root: i === 0 || undefined };
  });
}

// Where the roots stand on the skill map (px): a cross with the beach in the middle.
const POSITIONS: Record<TreeId, { x: number; y: number }> = {
  wave: { x: -390, y: 0 },
  skimboarding: { x: 0, y: 0 },
  windsurfing: { x: 390, y: 0 },
  kitesurfing: { x: -390, y: 560 },
  beach: { x: 0, y: 560 },
  foil: { x: 390, y: 560 },
  sailing: { x: 0, y: 1120 },
};

export const SKILL_TREES: SkillTree[] = [
  ...SPORTS.map((s): SkillTree => ({
    id: s.id,
    name: s.name,
    color: s.color,
    icon: s.icon,
    at: POSITIONS[s.id],
    nodes: build(s.id, SPORT_SHAPE, SPORT_NAMES, `${s.name} basics`, `Master of ${s.name.toLowerCase()}`),
  })),
  { id: 'beach', name: 'Beach', color: '#e9a13a', icon: 'beach', at: POSITIONS.beach, nodes: build('beach', BEACH_SHAPE, BEACH_NAMES, 'Beach basics', 'Grand beach') },
];

export const SKILL_NODES: SkillNode[] = SKILL_TREES.flatMap((t) => t.nodes);

export function skillById(id: string): SkillNode {
  const n = SKILL_NODES.find((x) => x.id === id);
  if (!n) throw new Error('Unknown skill ' + id);
  return n;
}

export function treeById(id: TreeId): SkillTree {
  return SKILL_TREES.find((t) => t.id === id)!;
}

/** A sentence that says what a skill does, for the skill screen. */
export function describeSkill(n: SkillNode): string {
  const pct = `${Math.round(n.value * 100)}%`;
  const sport = n.tree === 'beach' ? '' : treeById(n.tree).name.toLowerCase();
  switch (n.kind) {
    case 'coins':
      return `+${pct} coins from ${sport}`;
    case 'speed':
      return `${sport} sessions are ${pct} faster`;
    case 'guests':
      return `+${n.value} guest${n.value > 1 ? 's' : ''} in every ${sport} zone`;
    case 'cost':
      return `${sport} upgrades cost ${pct} less`;
    case 'manager':
      return `${sport} managers cost ${pct} less`;
    case 'rep':
      return `+${pct} reputation from ${sport}`;
    case 'unlock':
      return `${sport} levels and unlocks cost ${pct} less`;
    case 'facilityPower':
      return `Beach buildings work ${pct} better`;
    case 'facilityCost':
      return `Beach buildings cost ${pct} less`;
    case 'offline':
      return `+${n.value} hour${n.value === 1 ? '' : 's'} of away time that earns coins`;
    case 'quest':
      return `+${pct} coins from quests`;
    case 'allCoins':
      return `+${pct} coins from everything`;
  }
}
