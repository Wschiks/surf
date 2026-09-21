import { STATS } from '../config/balance';
import { FACILITIES, facilityById } from '../config/facilities';
import { ZONES, zoneById, type ZoneRef } from '../config/sports';
import { fmt } from '../ui/format';
import { autoIncomePerSecond, guestsFor, multipliers, zoneStats } from './economy';
import type { GameState } from './state';
import { expansionStatus, nextGoal } from './unlocks';

// Quests: a handful of small jobs on offer at once (swipe the row to see them all). Finish one, tap Claim and get
// its coins. Nothing is random: what is asked depends only on how far the player is. Easy jobs come first
// (level 10, ten sessions, forty guests) and get bigger as more quests are finished. Every quest pays its own reward.

export type QuestKind = 'level' | 'sessions' | 'served' | 'earn' | 'guests' | 'speed' | 'unlock' | 'manager' | 'facility' | 'expand';

export interface Quest {
  kind: QuestKind;
  zone?: string;
  facility?: string;
  /** The number to reach (a level, a number of sessions, 1 for a simple job). */
  target: number;
  /** For "finish N sessions", "serve N guests" and "earn N coins": the counter when the quest was made. */
  base?: number;
  /** The coins this quest pays, fixed when the quest is made: harder jobs pay more. */
  reward?: number;
}

export interface QuestView {
  text: string;
  current: number;
  target: number;
  done: boolean;
  reward: number;
}

export const QUEST_SLOTS = 6;

/** Levels asked for by "level up" quests, one after the other: small first. */
const LEVEL_STEPS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 750, 1000];

/** How much a kind of job is worth compared with a plain one. */
const WORTH: Record<QuestKind, number> = { level: 1, sessions: 0.8, served: 0.8, earn: 0.7, guests: 1.2, speed: 1.6, manager: 2, facility: 2.5, unlock: 3, expand: 6 };

/** Coins for a plain quest: a minute or two of what the beach earns now, and never less than a small start amount. */
export function questReward(state: GameState): number {
  const rate = autoIncomePerSecond(state) || zonesRate(state);
  const floor = 40 * Math.pow(3, state.expansions);
  return Math.ceil(Math.max(floor, rate * 90));
}

/** What a quest pays: harder jobs pay more. */
export function rewardFor(state: GameState, kind: QuestKind): number {
  return Math.ceil(questReward(state) * WORTH[kind]);
}

/** Coins per second of everything on the beach, as if every zone was running (used when nothing has a manager yet). */
function zonesRate(state: GameState): number {
  const m = multipliers(state);
  let sum = 0;
  for (const r of ZONES) if (state.zones[r.id].owned) sum += zoneStats(state, r, state.zones[r.id], m).perSecond;
  return sum;
}

function ownedZones(state: GameState): ZoneRef[] {
  return ZONES.filter((r) => state.zones[r.id].owned).sort((a, b) => b.def.tier - a.def.tier);
}

export function questView(state: GameState, q: Quest): QuestView {
  const v = view(state, q);
  v.reward = q.reward ?? rewardFor(state, q.kind);
  return v;
}

function view(state: GameState, q: Quest): QuestView {
  const zone = q.zone ? zoneById(q.zone) : null;
  const z = q.zone ? state.zones[q.zone] : null;
  const gained = (now: number) => Math.max(0, now - (q.base ?? 0));
  switch (q.kind) {
    case 'level':
      return { text: `Level up ${zone!.def.name} to level ${q.target}`, current: z!.price, target: q.target, done: z!.price >= q.target, reward: 0 };
    case 'sessions': {
      const c = gained(z!.sessions);
      return { text: `Finish ${q.target} sessions at ${zone!.def.name}`, current: c, target: q.target, done: c >= q.target, reward: 0 };
    }
    case 'served': {
      const c = Math.floor(gained(z!.served));
      return { text: `Serve ${q.target} guests at ${zone!.def.name}`, current: c, target: q.target, done: c >= q.target, reward: 0 };
    }
    case 'earn': {
      const c = Math.floor(gained(state.totalCoins));
      return { text: `Earn ${fmt(q.target)} coins`, current: c, target: q.target, done: c >= q.target, reward: 0 };
    }
    case 'guests': {
      const now = guestsFor(zone!, z!);
      return { text: `Get ${q.target} ${zone!.sport.noun} in ${zone!.def.name}`, current: now, target: q.target, done: now >= q.target, reward: 0 };
    }
    case 'speed':
      return { text: `Make ${zone!.def.name} faster: speed level ${q.target}`, current: z!.speed, target: q.target, done: z!.speed >= q.target, reward: 0 };
    case 'unlock': {
      const done = z!.owned;
      return { text: zone!.level === 1 ? `Start ${zone!.sport.name}` : `Unlock ${zone!.def.name}`, current: done ? 1 : 0, target: 1, done, reward: 0 };
    }
    case 'manager':
      return { text: `Hire a manager for ${zone!.def.name}`, current: z!.manager ? 1 : 0, target: 1, done: z!.manager, reward: 0 };
    case 'facility': {
      const f = facilityById(q.facility!);
      const lvl = state.facilities[f.id] ?? 0;
      return { text: q.target === 1 ? `Build the ${f.name.toLowerCase()}` : `Upgrade the ${f.name.toLowerCase()} to level ${q.target}`, current: lvl, target: q.target, done: lvl >= q.target, reward: 0 };
    }
    case 'expand':
      return { text: 'Expand the beach', current: state.expansions, target: q.target, done: state.expansions >= q.target, reward: 0 };
  }
}

/** A quest is stale when it asks for something on a zone that is not there (for example after the beach started over). */
function valid(state: GameState, q: Quest): boolean {
  if (q.kind === 'unlock' || q.kind === 'facility' || q.kind === 'expand' || q.kind === 'earn') return true;
  return !!q.zone && state.zones[q.zone]?.owned;
}

const nextMultiple = (value: number, step: number) => (Math.floor(value / step) + 1) * step;
const nextStep = (value: number, steps: number[]) => steps.find((s) => s > value) ?? nextMultiple(value, 250);
/** Round a number of coins to something nice to read. */
function nice(x: number): number {
  if (x < 100) return Math.max(10, Math.round(x / 10) * 10);
  const e = Math.floor(Math.log10(x)) - 1;
  return Math.round(x / 10 ** e) * 10 ** e;
}

function make(state: GameState, slot: number, taken: Quest[]): Quest | null {
  const q = build(state, slot, taken);
  return q ? { ...q, reward: rewardFor(state, q.kind) } : null;
}

function build(state: GameState, slot: number, taken: Quest[]): Quest | null {
  const zones = ownedZones(state);
  if (!zones.length) return null;
  const done = state.questsDone;
  const round = Math.floor(done / 4); // asks get bigger as more quests are finished
  const has = (kind: QuestKind, zone?: string) => taken.some((t) => t.kind === kind && t.zone === zone);
  const pick = (kind: QuestKind, skip: (r: ZoneRef) => boolean, offset = 0) => {
    const list = zones.filter((r) => !skip(r) && !has(kind, r.id));
    return list.length ? list[(done + offset) % list.length] : null;
  };
  const rate = autoIncomePerSecond(state) || zonesRate(state);

  const tries: (() => Quest | null)[] = [];
  // 0: level up in small steps: 10, 25, 50...
  tries[0] = () => {
    const r = pick('level', (z) => state.zones[z.id].price >= STATS.price.max);
    return r ? { kind: 'level', zone: r.id, target: nextStep(state.zones[r.id].price, LEVEL_STEPS) } : null;
  };
  // 1: finish sessions
  tries[1] = () => {
    const r = pick('sessions', () => false, 1);
    return r ? { kind: 'sessions', zone: r.id, target: 10 * (1 + round) * (round > 2 ? 2 : 1), base: state.zones[r.id].sessions } : null;
  };
  // 2: serve guests
  tries[2] = () => {
    const r = pick('served', () => false, 2);
    return r ? { kind: 'served', zone: r.id, target: 40 * (1 + round) * (round > 2 ? 2 : 1), base: state.zones[r.id].served } : null;
  };
  // 3: a job that changes every time
  tries[3] = () => {
    const options: QuestKind[] = ['unlock', 'manager', 'speed', 'facility', 'expand'];
    for (let i = 0; i < options.length; i++) {
      const kind = options[(done + i) % options.length];
      if (kind === 'unlock') {
        const g = nextGoal(state);
        if (g?.zoneId && !has('unlock', g.zoneId)) return { kind, zone: g.zoneId, target: 1 };
      }
      if (kind === 'manager') {
        const r = zones.find((z) => !state.zones[z.id].manager && !has('manager', z.id));
        if (r) return { kind, zone: r.id, target: 1 };
      }
      if (kind === 'speed') {
        const r = pick('speed', (z) => state.zones[z.id].speed >= STATS.speed.max, 3);
        if (r) return { kind, zone: r.id, target: nextMultiple(state.zones[r.id].speed, 5) };
      }
      if (kind === 'facility') {
        const f = FACILITIES.find((x) => (state.facilities[x.id] ?? 0) < x.max && !taken.some((t) => t.facility === x.id));
        if (f) return { kind, facility: f.id, target: (state.facilities[f.id] ?? 0) + 1 };
      }
      if (kind === 'expand') {
        const st = expansionStatus(state);
        if (st?.ready && !has('expand')) return { kind, target: state.expansions + 1 };
      }
    }
    return null;
  };
  // 4: earn coins
  tries[4] = () => ({ kind: 'earn', target: nice(Math.max(60, rate * 240 * (1 + round))), base: state.totalCoins });
  // 5: more guests, but only later on
  tries[5] = () => {
    if (done < 4) return null;
    const r = pick('guests', (z) => state.zones[z.id].capacity >= STATS.capacity.max, 4);
    return r ? { kind: 'guests', zone: r.id, target: Math.max(10, nextMultiple(guestsFor(r, state.zones[r.id]), 5)) } : null;
  };
  return (tries[slot] ?? (() => null))();
}

/** Make sure the quests are all there. Call now and then; it does nothing when all is well. */
export function refreshQuests(state: GameState) {
  const kept: (Quest | null)[] = [];
  for (let i = 0; i < QUEST_SLOTS; i++) {
    const q = state.quests[i];
    kept.push(q && valid(state, q) ? q : null);
  }
  for (let i = 0; i < QUEST_SLOTS; i++) {
    if (!kept[i]) kept[i] = make(state, i, kept.filter((k): k is Quest => !!k));
  }
  const next = kept.filter((k): k is Quest => !!k);
  if (next.length !== state.quests.length || next.some((q, i) => q !== state.quests[i])) state.quests = next;
}

/** Take the reward of a finished quest and make the next one. Returns the coins, or 0 if it is not finished. */
export function claimQuest(state: GameState, index: number): number {
  const q = state.quests[index];
  if (!q || !questView(state, q).done) return 0;
  const reward = questView(state, q).reward;
  state.coins += reward;
  state.totalCoins += reward;
  state.questsDone += 1;
  state.quests[index] = null as unknown as Quest; // the slot gets a new quest, in the same place
  refreshQuests(state);
  return reward;
}
