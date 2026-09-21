import { areaById } from '../config/areas';
import { EXPANSIONS, expansionAfter, type ExpansionDef } from '../config/expansions';
import { SPORTS, zoneById, zoneId, type SportId, type ZoneRef } from '../config/sports';
import { fmt } from '../ui/format';
import { upgradeCount } from './economy';
import { newZone, openAreas, type GameState } from './state';
import { FACILITIES } from '../config/facilities';

export interface Requirement {
  text: string;
  met: boolean;
  /** Progress text such as "6 / 10". */
  progress: string;
}

export interface UnlockStatus {
  /** What the player still has to do (or has done) apart from paying. */
  requirements: Requirement[];
  coins: number;
  /** Every requirement except the coins is met. */
  ready: boolean;
  /** Ready and enough coins. */
  canBuy: boolean;
  /** Set when this cannot be reached yet because something before it is missing. */
  blockedBy: string | null;
}

export function ownsLevel(state: GameState, sport: SportId, level: number): boolean {
  return !!state.zones[zoneId(sport, level)]?.owned;
}

/** The expansion that opens the area of a sport, or null when that area is already open. */
export function expansionNeededFor(state: GameState, sport: SportId): number | null {
  const s = SPORTS.find((x) => x.id === sport)!;
  const need = areaById(s.area).expansion;
  return need > state.expansions ? need : null;
}

/** Rule for Level 2 to 4 of a sport: the level before it, upgrades or reputation, and coins. */
export function levelStatus(state: GameState, ref: ZoneRef): UnlockStatus {
  const rule = ref.def.unlock ?? { coins: 0, reputation: 0 };
  const reqs: Requirement[] = [];
  let blockedBy: string | null = null;
  const exp = expansionNeededFor(state, ref.sport.id);
  if (exp !== null) blockedBy = `Opens with beach expansion ${exp}`;
  const prevLevel = ref.level - 1;
  if (prevLevel >= 1) {
    const prevOwned = ownsLevel(state, ref.sport.id, prevLevel);
    if (!prevOwned && !blockedBy) blockedBy = `Unlock Level ${prevLevel} (${ref.sport.levels[prevLevel - 1].name}) first`;
    if (rule.prevLevelUpgrades !== undefined) {
      const have = upgradeCount(state.zones[zoneId(ref.sport.id, prevLevel)]);
      reqs.push({ text: `Upgrade ${ref.sport.levels[prevLevel - 1].name}`, met: have >= rule.prevLevelUpgrades, progress: `${Math.min(have, rule.prevLevelUpgrades)} / ${rule.prevLevelUpgrades} upgrades` });
    }
  }
  if (rule.reputation > 0 || ref.level > 2) {
    reqs.push({ text: `Reputation ${fmt(rule.reputation)}`, met: state.reputation >= rule.reputation, progress: `${fmt(Math.floor(state.reputation))} / ${fmt(rule.reputation)}` });
  }
  const ready = !blockedBy && reqs.every((r) => r.met);
  return { requirements: reqs, coins: rule.coins, ready, canBuy: ready && state.coins >= rule.coins, blockedBy };
}

/** What a locked zone needs. Level 1 of a closed area needs the beach expansion; other levels need their level rule. */
export function zoneUnlockStatus(state: GameState, ref: ZoneRef): { kind: 'closed' | 'level'; status: UnlockStatus } | null {
  if (state.zones[ref.id].owned) return null;
  if (ref.level === 1) {
    const exp = expansionNeededFor(state, ref.sport.id);
    return { kind: 'closed', status: { requirements: [], coins: 0, ready: false, canBuy: false, blockedBy: `Opens with beach expansion ${exp ?? 1}` } };
  }
  return { kind: 'level', status: levelStatus(state, ref) };
}

export function unlockLevel(state: GameState, id: string): boolean {
  const ref = zoneById(id);
  if (ref.level === 1 || state.zones[id].owned) return false;
  const st = levelStatus(state, ref);
  if (!st.canBuy) return false;
  state.coins -= st.coins;
  const z = state.zones[id];
  z.owned = true;
  z.phase = 'idle';
  return true;
}

/** Unlock a level. Returns what was unlocked, if anything. */
export function unlockZone(state: GameState, id: string): 'level' | null {
  return unlockLevel(state, id) ? 'level' : null;
}

// ---------------------------------------------------------------- beach expansions

export interface ExpansionStatus extends UnlockStatus {
  def: ExpansionDef;
}

/** The next beach expansion, with what is still missing. Null once every expansion is bought. */
export function expansionStatus(state: GameState): ExpansionStatus | null {
  const def = expansionAfter(state.expansions);
  if (!def) return null;
  const reqs: Requirement[] = [];
  for (const sport of SPORTS) {
    if (areaById(sport.area).expansion > state.expansions) continue;
    const owned = ownsLevel(state, sport.id, def.level);
    reqs.push({ text: `Own Level ${def.level} of ${sport.name}`, met: owned, progress: owned ? 'Done' : 'Not yet' });
  }
  reqs.push({ text: `Reputation ${fmt(def.reputation)}`, met: state.reputation >= def.reputation, progress: `${fmt(Math.floor(state.reputation))} / ${fmt(def.reputation)}` });
  const ready = reqs.every((r) => r.met);
  return { def, requirements: reqs, coins: def.coins, ready, canBuy: ready && state.coins >= def.coins, blockedBy: null };
}

/**
 * Buy the next beach expansion. Everything on the beach starts over (coins, zones, upgrades, managers, facilities),
 * the next area opens, and income is multiplied for good. Reputation is kept.
 */
export function expand(state: GameState): boolean {
  const st = expansionStatus(state);
  if (!st || !st.canBuy) return false;
  state.expansions += 1;
  state.coins = 0;
  for (const id of Object.keys(state.zones)) state.zones[id] = newZone();
  for (const f of FACILITIES) state.facilities[f.id] = 0;
  for (const s of SPORTS) state.sports[s.id] = false;
  openAreas(state);
  return true;
}

export interface Goal {
  zoneId: string | null;
  /** What it is for, such as "Reef". */
  name: string;
  /** The first missing requirement. Empty when only coins are missing. */
  missing: string;
  coins: number;
  /** 0 to 1: how close the player is. */
  progress: number;
  expansion: boolean;
}

/** What the player should aim for next: the beach expansion once it is within reach, else the first locked level. */
export function nextGoal(state: GameState): Goal | null {
  const exp = expansionStatus(state);
  if (exp && exp.ready) return { zoneId: null, name: exp.def.name, missing: '', coins: exp.coins, progress: Math.min(1, state.coins / exp.coins), expansion: true };
  for (const sport of SPORTS) {
    if (!state.sports[sport.id]) continue;
    for (let level = 2; level <= sport.levels.length; level++) {
      const id = zoneId(sport.id, level);
      if (state.zones[id].owned) continue;
      const ref = zoneById(id);
      const st = levelStatus(state, ref);
      if (st.blockedBy) break;
      if (exp && level > exp.def.level) break; // the expansion needs Level 3 first
      const unmet = st.requirements.find((r) => !r.met);
      if (unmet) {
        const met = st.requirements.filter((r) => r.met).length;
        return { zoneId: id, name: ref.def.name, missing: `${unmet.text} (${unmet.progress})`, coins: st.coins, progress: met / (st.requirements.length + 1), expansion: false };
      }
      return { zoneId: id, name: ref.def.name, missing: '', coins: st.coins, progress: Math.min(1, state.coins / st.coins), expansion: false };
    }
  }
  if (exp) return { zoneId: null, name: exp.def.name, missing: exp.requirements.find((r) => !r.met)?.text ?? '', coins: exp.coins, progress: 0, expansion: true };
  return null;
}

export { EXPANSIONS };
