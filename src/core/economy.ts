import { skinBoost } from './skins';
import { BALANCE, costFactor, milestoneMult, STATS, STAT_IDS, tierFactor, type StatId } from '../config/balance';
import { CLUB } from '../config/shop';
import { REBIRTH } from '../config/rebirth';
import { EXPANSION_BONUS, EXPANSIONS } from '../config/expansions';
import { FACILITIES, facilityById, type FacilityDef } from '../config/facilities';
import { ALL_ZONES, anyZoneById, type AnyZoneRef } from '../config/sports';
import { BEACH_PLAYERS, BEACH_SPORTS, type BeachSportDef } from '../config/beach';
import type { StatDef } from '../config/balance';
import { skillEffects } from './skills';
import type { GameState, ZoneState } from './state';

export interface Multipliers {
  coins: number;
  speed: number;
}

/**
 * The income bonus after `rebirths` rebirths and `expansions` expansions in this round. Nothing is ever lost: every
 * expansion adds +1 (also the ones of earlier rounds) and the rebirths add +2, +3, +4...
 */
export function bonusFor(expansions: number, rebirths: number): number {
  const fromExpansions = EXPANSION_BONUS * (expansions + rebirths * EXPANSIONS.length);
  const fromRebirths = rebirths * REBIRTH.firstBonus + (REBIRTH.bonusStep * rebirths * (rebirths - 1)) / 2;
  return 1 + fromExpansions + fromRebirths;
}

/** The income bonus now (x1 at the very start). */
export function bonusMult(state: GameState): number {
  return bonusFor(state.expansions, state.rebirths ?? 0);
}

export function multipliers(state: GameState): Multipliers {
  const fx = skillEffects(state);
  const m: Multipliers = { coins: bonusMult(state) * (1 + fx.allCoins), speed: 1 };
  if (state.boost > 0) m.coins *= BALANCE.boostMult;
  if (state.perks.x5) m.coins *= BALANCE.x5Mult;
  if (state.perks.club) m.coins *= CLUB.coinMult;
  for (const f of FACILITIES) {
    const lvl = state.facilities[f.id] ?? 0;
    m[f.effect] *= 1 + f.perLevel * (1 + fx.facilityPower) * lvl;
  }
  return m;
}

export interface ZoneStats {
  guests: number;
  pricePerGuest: number;
  /** Seconds one session takes. */
  duration: number;
  /** Coins one session earns (all guests). */
  income: number;
  /** Coins per second while running. */
  perSecond: number;
}

/**
 * Guests in a zone: the base, the bought bigger-class levels and the extra guests from skills. A beach sport: the
 * players on a field (2 more per Players level: 1v1, 2v2 ...) times the number of fields.
 */
export function guestsFor(ref: AnyZoneRef, z: ZoneState, extra = 0): number {
  if (ref.beach) return (ref.def.baseGuests + z.capacity * BEACH_PLAYERS.step) * (1 + (z.fields ?? 0)) + extra;
  return ref.def.baseGuests + z.capacity + extra;
}

/** The upgrade rows of a zone: Level up, Bigger class, Faster turnover; a beach sport: Level up, Players, Fields. */
export function statIdsFor(ref: AnyZoneRef): StatId[] {
  return ref.beach ? ['price', 'capacity', 'fields'] : STAT_IDS;
}

/** The numbers of an upgrade in a zone (beach sports have their own Players and Fields). */
export function statDef(ref: AnyZoneRef | undefined, stat: StatId): StatDef {
  if (ref?.beach && (stat === 'capacity' || stat === 'fields')) return ref.beach.stats[stat];
  return STATS[stat];
}

export function zoneStats(state: GameState, ref: AnyZoneRef, z: ZoneState = state.zones[ref.id], m: Multipliers = multipliers(state)): ZoneStats {
  const fx = skillEffects(state);
  const sp = ref.sport.id;
  const guests = guestsFor(ref, z, fx.guests[sp] ?? 0);
  // the skin a section wears: Bronze +100%, Silver +500%
  const skin = 1 + skinBoost(state, ref.id);
  const pricePerGuest = tierFactor(ref.def.tier) * (1 + BALANCE.priceStep * z.price) * milestoneMult(z.price) * m.coins * (1 + (fx.coins[sp] ?? 0)) * skin;
  const duration = speedSeconds(ref.def.baseSeconds, z.speed) / (m.speed * (1 + (fx.speed[sp] ?? 0)));
  const income = guests * pricePerGuest;
  return { guests, pricePerGuest, duration, income, perSecond: income / duration };
}

/** A session's time at a Faster turnover level, before skills and boosts: every level takes off the same number of seconds. */
export function speedSeconds(baseSeconds: number, level: number): number {
  return baseSeconds * (1 - ((1 - BALANCE.speedEnd) * Math.min(level, STATS.speed.max)) / STATS.speed.max);
}

/** Cost of the next level of a stat, or Infinity at the maximum. */
/** The highest level of a stat after `rebirths` rebirths (Bigger class grows with every rebirth). Pass the zone for a beach sport. */
export function statMax(stat: StatId, rebirths = 0, ref?: AnyZoneRef): number {
  const s = statDef(ref, stat);
  const top = s.max + (s.perRebirth ?? 0) * rebirths;
  return s.cap === undefined ? top : Math.min(top, s.cap);
}

export function statCost(ref: AnyZoneRef, stat: StatId, level: number, discount = 0, max = statDef(ref, stat).max): number {
  const s = statDef(ref, stat);
  if (level >= max) return Infinity;
  return Math.ceil(s.baseCost * costFactor(ref.def.tier) * Math.pow(s.growth, level) * (1 + s.surge * level) * (1 - discount) * 100) / 100;
}

export function managerCost(ref: AnyZoneRef, discount = 0): number {
  return Math.ceil(BALANCE.managerCost * costFactor(ref.def.tier) * (1 - discount));
}

export function facilityCost(id: string, level: number, discount = 0): number {
  const f = facilityById(id);
  if (level >= f.max) return Infinity;
  return Math.ceil(f.baseCost * Math.pow(f.growth, level) * (1 - discount));
}

/** The skill discounts that apply to a sport: for each upgrade, and for managers. */
export function discounts(state: GameState, sport: string): { stat: (s: StatId) => number; manager: number } {
  const fx = skillEffects(state);
  const general = fx.cost[sport] ?? 0;
  const space = fx.capacityCost[sport] ?? 0;
  return { stat: (s) => Math.min(0.7, general + (s === 'capacity' ? space : 0)), manager: fx.manager[sport] ?? 0 };
}

/** Seconds away that still earn coins: 2 hours, plus what the beach skills add. */
export function offlineCap(state: GameState): number {
  return BALANCE.offlineCapSeconds + (skillEffects(state).offlineHours + (state.perks.club ? CLUB.awayHours : 0)) * 3600;
}

/** Total upgrade levels bought in a zone (used by the Level 2 unlock rule). */
export function upgradeCount(z: ZoneState): number {
  return STAT_IDS.reduce((n, s) => n + (z[s] ?? 0), 0);
}

export type BuyMode = number | 'max';

/**
 * What a tap on a buy button buys. A number (x1, x10, x100) is all or nothing: exactly that many levels, if the coins
 * are there. 'max' buys as many as the coins allow.
 */
export function planBuy(ref: AnyZoneRef, stat: StatId, level: number, coins: number, mode: BuyMode, discount = 0, max = statDef(ref, stat).max): { count: number; cost: number } {
  // x10 / x100 near the top buy what is left (all or nothing for that), so the last levels can still be bought
  const limit = mode === 'max' ? max : Math.min(mode, max - level);
  let count = 0;
  let cost = 0;
  for (let n = level; count < limit && n < max; n++) {
    const c = statCost(ref, stat, n, discount, max);
    if (cost + c > coins) break;
    cost += c;
    count++;
  }
  if (mode !== 'max' && (count < limit || count === 0)) return { count: 0, cost: 0 };
  return { count, cost };
}

/** What `count` levels of a stat cost together, starting at `level` (stops at the top level). Works even when the coins are not there. */
export function costOf(ref: AnyZoneRef, stat: StatId, level: number, count: number, discount = 0, max = statDef(ref, stat).max): number {
  let cost = 0;
  for (let n = level; n < level + count && n < max; n++) cost += statCost(ref, stat, n, discount, max);
  return cost;
}

/** Buy levels of a stat (see planBuy). Returns false if nothing could be bought. */
export function buyStat(state: GameState, zoneId: string, stat: StatId, mode: BuyMode = 1): boolean {
  const ref = anyZoneById(zoneId);
  const z = state.zones[zoneId];
  if (!z.owned || !statIdsFor(ref).includes(stat)) return false;
  const plan = planBuy(ref, stat, z[stat] ?? 0, state.coins, mode, discounts(state, ref.sport.id).stat(stat), statMax(stat, state.rebirths, ref));
  if (plan.count === 0) return false;
  state.coins -= plan.cost;
  z[stat] += plan.count;
  return true;
}

export function buyManager(state: GameState, zoneId: string): boolean {
  const ref = anyZoneById(zoneId);
  const z = state.zones[zoneId];
  if (!z.owned || z.manager) return false;
  const cost = managerCost(ref, discounts(state, ref.sport.id).manager);
  if (state.coins < cost) return false;
  state.coins -= cost;
  z.manager = true;
  if (z.phase === 'ready') collect(state, zoneId);
  if (z.phase === 'idle') z.phase = 'running';
  return true;
}

/** Can the beach sport be bought? Its stage of the game must be reached and the zone it needs unlocked (like a building). */
export function beachSportOpen(state: GameState, b: BeachSportDef): boolean {
  return b.stage <= state.expansions && !!state.zones[b.needs]?.owned;
}

/** Buy a beach sport: its first field appears on the sand, with a game of 1v1. */
export function unlockBeachSport(state: GameState, id: string): boolean {
  const b = BEACH_SPORTS.find((x) => x.id === id);
  const z = state.zones[id];
  if (!b || !z || z.owned || !beachSportOpen(state, b) || state.coins < b.coins) return false;
  state.coins -= b.coins;
  z.owned = true;
  z.phase = 'idle';
  z.elapsed = 0;
  return true;
}

/** Can the facility be built? Its stage of the game must be reached and the zone it needs unlocked. */
export function facilityOpen(state: GameState, f: FacilityDef): boolean {
  return f.stage <= state.expansions && !!state.zones[f.needs]?.owned;
}

export function buyFacility(state: GameState, id: string): boolean {
  if (!facilityOpen(state, facilityById(id))) return false;
  const lvl = state.facilities[id] ?? 0;
  const cost = facilityCost(id, lvl, skillEffects(state).facilityCost);
  if (!isFinite(cost) || state.coins < cost) return false;
  state.coins -= cost;
  state.facilities[id] = lvl + 1;
  return true;
}

export function addCoins(state: GameState, amount: number) {
  state.coins += amount;
  state.totalCoins += amount;
}

/** Take the waiting coins from a zone without a manager. Returns the coins collected. */
export function collect(state: GameState, id: string): number {
  const z = state.zones[id];
  if (z.phase !== 'ready') return 0;
  const got = z.pending;
  addCoins(state, got);
  z.pending = 0;
  z.phase = 'idle';
  z.elapsed = 0;
  return got;
}

/** The player taps a zone: collect what is waiting and start the next session. */
export function tapZone(state: GameState, id: string): 'collected' | 'started' | 'none' {
  const z = state.zones[id];
  if (!z.owned) return 'none';
  if (z.phase === 'ready') {
    collect(state, id);
    z.phase = 'running';
    return 'collected';
  }
  if (z.phase === 'idle') {
    z.phase = 'running';
    z.elapsed = 0;
    return 'started';
  }
  return 'none';
}

/** Zones that are waiting for the player (idle or ready, without a manager). */
export function waitingZones(state: GameState): string[] {
  return ALL_ZONES.filter((r) => {
    const z = state.zones[r.id];
    return z.owned && !z.manager && z.phase !== 'running';
  }).map((r) => r.id);
}

export function collectAll(state: GameState): number {
  let total = 0;
  for (const id of waitingZones(state)) {
    const before = state.coins;
    tapZone(state, id);
    total += state.coins - before;
  }
  return total;
}

/** Advance one zone by `dt` seconds. Zones with a manager keep earning; others stop after one session. */
export function advanceZone(state: GameState, ref: AnyZoneRef, dt: number, m: Multipliers = multipliers(state)) {
  const z = state.zones[ref.id];
  if (!z.owned) return;
  if (z.phase === 'ready') {
    if (!z.manager) return;
    collect(state, ref.id);
  }
  if (z.phase === 'idle') {
    if (!z.manager) return;
    z.phase = 'running';
    z.elapsed = 0;
  }
  const st = zoneStats(state, ref, z, m);
  z.elapsed += dt;
  if (z.elapsed < st.duration) return;
  if (z.manager) {
    const n = Math.floor(z.elapsed / st.duration);
    z.elapsed -= n * st.duration;
    addCoins(state, n * st.income);
    z.sessions += n;
    z.served += n * st.guests;
  } else {
    z.sessions += 1;
    z.served += st.guests;
    z.phase = 'ready';
    z.pending = st.income;
    z.elapsed = 0;
  }
}

export function tick(state: GameState, dt: number) {
  // the ad boost only counts for the seconds it lasts, also when a long stretch is ticked at once (time away)
  const boosted = Math.min(dt, state.boost);
  if (boosted > 0) {
    const m = multipliers(state);
    for (const ref of ALL_ZONES) advanceZone(state, ref, boosted, m);
    state.boost -= boosted;
    dt -= boosted;
  }
  if (dt <= 0) return;
  const m = multipliers(state);
  for (const ref of ALL_ZONES) advanceZone(state, ref, dt, m);
}

/** Start (or restart) the ad boost. */
export function startBoost(state: GameState) {
  state.boost = BALANCE.boostSeconds;
}

export interface OfflineReport {
  /** Seconds that counted (after the cap). */
  seconds: number;
  /** Real seconds away. */
  away: number;
  capped: boolean;
  /** Coins earned while away (the away share of the normal income). */
  coins: number;
  /** What the same time would have earned at the full rate (gems in the welcome-back dialog make it this). */
  full: number;
  /** Zones without a manager that finished a session and wait for you. */
  waiting: number;
}

/**
 * Earnings for time spent away. Zones with a manager earn, at `BALANCE.offlineRate` of the normal income; others
 * finish one session and wait (that session keeps its full coins, to collect on return).
 */
export function applyOffline(state: GameState, awaySeconds: number): OfflineReport {
  const cap = offlineCap(state);
  const seconds = Math.max(0, Math.min(awaySeconds, cap));
  const before = { coins: state.coins };
  if (seconds > 0) tick(state, seconds);
  const full = state.coins - before.coins;
  const kept = full * BALANCE.offlineRate;
  state.coins = before.coins + kept;
  state.totalCoins -= full - kept;
  const waiting = ALL_ZONES.filter((r) => {
    const z = state.zones[r.id];
    return z.owned && !z.manager && z.phase === 'ready';
  }).length;
  return {
    seconds,
    away: awaySeconds,
    capped: awaySeconds > cap,
    coins: kept,
    full,
    waiting,
  };
}

/**
 * In the welcome-back dialog the player can raise the away earnings: an ad to `BALANCE.offlineAdRate`,
 * gems to 100%. Adds only the difference to what applyOffline already gave. Returns the coins added.
 */
export function topUpOffline(state: GameState, rep: OfflineReport, rate: number): number {
  const extra = Math.max(0, rep.full * Math.min(1, rate) - rep.coins);
  state.coins += extra;
  state.totalCoins += extra;
  rep.coins += extra;
  return extra;
}

/** Coins per second from zones with a manager (what you earn while away). */
export function autoIncomePerSecond(state: GameState): number {
  const m = multipliers(state);
  let sum = 0;
  for (const r of ALL_ZONES) {
    const z = state.zones[r.id];
    if (z.owned && z.manager) sum += zoneStats(state, r, z, m).perSecond;
  }
  return sum;
}
