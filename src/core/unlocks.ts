import { SPORTS, sportById, zoneById, zoneId, type SportDef, type SportId, type ZoneRef } from '../config/sports';
import { upgradeCount } from './economy';
import type { GameState } from './state';

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
  /** True if this unlock cannot be reached yet because something before it is missing. */
  blockedBy: string | null;
}

/** The sport that must be played before this one (the previous one in the unlock order). */
export function previousSport(sport: SportDef): SportDef | undefined {
  return SPORTS.find((s) => s.order === sport.order - 1);
}

export function ownsLevel(state: GameState, sport: SportId, level: number): boolean {
  return !!state.zones[zoneId(sport, level)]?.owned;
}

/** Rule for a sport: own Level 2 of the previous sport and have enough reputation (plus coins to build it). */
export function sportStatus(state: GameState, sport: SportDef): UnlockStatus {
  const rule = sport.unlock ?? { reputation: 0, coins: 0 };
  const prev = previousSport(sport);
  const reqs: Requirement[] = [];
  if (prev) {
    const owned = ownsLevel(state, prev.id, 2);
    reqs.push({ text: `Own Level 2 of ${prev.name} (${prev.levels[1]?.name ?? ''})`, met: owned, progress: owned ? 'Done' : 'Not yet' });
  }
  const rep = Math.floor(state.reputation);
  reqs.push({ text: `Reputation ${rule.reputation}`, met: state.reputation >= rule.reputation, progress: `${rep} / ${rule.reputation}` });
  const ready = reqs.every((r) => r.met);
  return { requirements: reqs, coins: rule.coins, ready, canBuy: ready && state.coins >= rule.coins, blockedBy: null };
}

/** Rule for Level 2 to 4 of a sport that is already unlocked. */
export function levelStatus(state: GameState, ref: ZoneRef): UnlockStatus {
  const rule = ref.def.unlock ?? { coins: 0, reputation: 0 };
  const reqs: Requirement[] = [];
  let blockedBy: string | null = null;
  if (!state.sports[ref.sport.id]) blockedBy = `Unlock ${ref.sport.name} first`;
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
    reqs.push({ text: `Reputation ${rule.reputation}`, met: state.reputation >= rule.reputation, progress: `${Math.floor(state.reputation)} / ${rule.reputation}` });
  }
  const ready = !blockedBy && reqs.every((r) => r.met);
  return { requirements: reqs, coins: rule.coins, ready, canBuy: ready && state.coins >= rule.coins, blockedBy };
}

/** Status for whatever this zone needs: the sport itself (Level 1 of a locked sport) or the level. */
export function zoneUnlockStatus(state: GameState, ref: ZoneRef): { kind: 'sport' | 'level'; status: UnlockStatus } | null {
  if (state.zones[ref.id].owned) return null;
  if (ref.level === 1) {
    if (state.sports[ref.sport.id]) return null;
    return { kind: 'sport', status: sportStatus(state, ref.sport) };
  }
  return { kind: 'level', status: levelStatus(state, ref) };
}

export function unlockSport(state: GameState, id: SportId): boolean {
  const sport = sportById(id);
  if (state.sports[id]) return false;
  const st = sportStatus(state, sport);
  if (!st.canBuy) return false;
  state.coins -= st.coins;
  state.sports[id] = true;
  const z = state.zones[zoneId(id, 1)];
  z.owned = true;
  z.phase = 'idle';
  return true;
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

/** Unlock whatever this zone needs. Returns what was unlocked, if anything. */
export function unlockZone(state: GameState, id: string): 'sport' | 'level' | null {
  const ref = zoneById(id);
  const need = zoneUnlockStatus(state, ref);
  if (!need) return null;
  if (need.kind === 'sport') return unlockSport(state, ref.sport.id) ? 'sport' : null;
  return unlockLevel(state, id) ? 'level' : null;
}
