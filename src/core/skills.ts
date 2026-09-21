import { SKILL_NODES, skillById, type SkillNode, type TreeId } from '../config/skills';
import type { GameState } from './state';

/** What all the learned skills add up to. */
export interface SkillEffects {
  coins: Record<string, number>;
  speed: Record<string, number>;
  guests: Record<string, number>;
  cost: Record<string, number>;
  manager: Record<string, number>;
  capacityCost: Record<string, number>;
  unlock: Record<string, number>;
  facilityPower: number;
  facilityCost: number;
  offlineHours: number;
  quest: number;
  allCoins: number;
}

const cache = new WeakMap<object, SkillEffects>();

/** The sum of the learned skills. (Cached: learning a skill makes a new `skills` object.) */
export function skillEffects(state: GameState): SkillEffects {
  const hit = cache.get(state.skills);
  if (hit) return hit;
  const fx: SkillEffects = { coins: {}, speed: {}, guests: {}, cost: {}, manager: {}, capacityCost: {}, unlock: {}, facilityPower: 0, facilityCost: 0, offlineHours: 0, quest: 0, allCoins: 0 };
  for (const n of SKILL_NODES) {
    if (!state.skills[n.id]) continue;
    switch (n.kind) {
      case 'facilityPower':
      case 'facilityCost':
      case 'quest':
      case 'allCoins':
        (fx as unknown as Record<string, number>)[n.kind] += n.value;
        break;
      case 'offline':
        fx.offlineHours += n.value;
        break;
      default: {
        const bag = fx[n.kind] as Record<string, number>;
        bag[n.tree] = (bag[n.tree] ?? 0) + n.value;
      }
    }
  }
  // discounts never go below 30% of the price
  for (const bag of [fx.cost, fx.manager, fx.unlock, fx.capacityCost]) for (const k of Object.keys(bag)) bag[k] = Math.min(0.7, bag[k]);
  fx.facilityCost = Math.min(0.7, fx.facilityCost);
  cache.set(state.skills, fx);
  return fx;
}

export function ownsSkill(state: GameState, id: string): boolean {
  return !!state.skills[id];
}

/** A skill can be learned when its parent is learned and there are enough skill points. */
export function skillStatus(state: GameState, node: SkillNode): 'owned' | 'available' | 'locked' {
  if (ownsSkill(state, node.id)) return 'owned';
  return !node.parent || ownsSkill(state, node.parent) ? 'available' : 'locked';
}

export function canLearn(state: GameState, node: SkillNode): boolean {
  return skillStatus(state, node) === 'available' && state.skillPoints >= node.cost;
}

export function learnSkill(state: GameState, id: string): boolean {
  const node = skillById(id);
  if (!canLearn(state, node)) return false;
  state.skillPoints -= node.cost;
  state.skills = { ...state.skills, [id]: true }; // a new object, so the cache is renewed
  return true;
}

export function addSkillPoints(state: GameState, n: number) {
  state.skillPoints += n;
  state.skillEarned += n;
}

/** Skills learned and skills in a tree. */
export function treeProgress(state: GameState, tree: TreeId): { learned: number; total: number } {
  const nodes = SKILL_NODES.filter((n) => n.tree === tree);
  return { learned: nodes.filter((n) => state.skills[n.id]).length, total: nodes.length };
}

/** The free root skills, which every game starts with. */
export function rootSkills(): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const n of SKILL_NODES) if (n.root) r[n.id] = true;
  return r;
}

/** Is there a skill that can be learned with the points the player has? (The Skills button lights up.) */
export function hasAffordableSkill(state: GameState): boolean {
  if (state.skillPoints <= 0) return false;
  return SKILL_NODES.some((n) => canLearn(state, n));
}
