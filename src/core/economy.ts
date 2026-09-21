import { BALANCE, costFactor, milestoneMult, STATS, STAT_IDS, tierFactor, type StatId } from '../config/balance';
import { EXPANSION_MULT } from '../config/expansions';
import { FACILITIES, facilityById } from '../config/facilities';
import { ZONES, zoneById, type ZoneRef } from '../config/sports';
import { skillEffects } from './skills';
import type { GameState, ZoneState } from './state';

export interface Multipliers {
  coins: number;
  speed: number;
}

export function multipliers(state: GameState): Multipliers {
  const fx = skillEffects(state);
  const m: Multipliers = { coins: Math.pow(EXPANSION_MULT, state.expansions) * (1 + fx.allCoins), speed: 1 };
  if (state.boost > 0) m.coins *= BALANCE.boostMult;
  if (state.perks.x5) m.coins *= BALANCE.x5Mult;
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

/** Guests in a zone: the base, the bought bigger-class levels and the extra guests from skills. */
export function guestsFor(ref: ZoneRef, z: ZoneState, extra = 0): number {
  return ref.def.baseGuests + z.capacity + extra;
}

export function zoneStats(state: GameState, ref: ZoneRef, z: ZoneState = state.zones[ref.id], m: Multipliers = multipliers(state)): ZoneStats {
  const fx = skillEffects(state);
  const sp = ref.sport.id;
  const guests = guestsFor(ref, z, fx.guests[sp] ?? 0);
  const pricePerGuest = tierFactor(ref.def.tier) * (1 + BALANCE.priceStep * z.price) * milestoneMult(z.price) * m.coins * (1 + (fx.coins[sp] ?? 0));
  const duration = ref.def.baseSeconds / ((1 + BALANCE.speedStep * z.speed) * m.speed * (1 + (fx.speed[sp] ?? 0)));
  const income = guests * pricePerGuest;
  return { guests, pricePerGuest, duration, income, perSecond: income / duration };
}

/** Cost of the next level of a stat, or Infinity at the maximum. */
export function statCost(ref: ZoneRef, stat: StatId, level: number, discount = 0): number {
  const s = STATS[stat];
  if (level >= s.max) return Infinity;
  return Math.ceil(s.baseCost * costFactor(ref.def.tier) * Math.pow(s.growth, level) * (1 + s.surge * level) * (1 - discount) * 100) / 100;
}

export function managerCost(ref: ZoneRef, discount = 0): number {
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
  return BALANCE.offlineCapSeconds + skillEffects(state).offlineHours * 3600;
}

/** Total upgrade levels bought in a zone (used by the Level 2 unlock rule). */
export function upgradeCount(z: ZoneState): number {
  return STAT_IDS.reduce((n, s) => n + z[s], 0);
}

export type BuyMode = number | 'max';

/**
 * What a tap on a buy button buys. A number (x1, x10, x100) is all or nothing: exactly that many levels, if the coins
 * are there. 'max' buys as many as the coins allow.
 */
export function planBuy(ref: ZoneRef, stat: StatId, level: number, coins: number, mode: BuyMode, discount = 0): { count: number; cost: number } {
  const limit = mode === 'max' ? STATS[stat].max : mode;
  let count = 0;
  let cost = 0;
  for (let n = level; count < limit && n < STATS[stat].max; n++) {
    const c = statCost(ref, stat, n, discount);
    if (cost + c > coins) break;
    cost += c;
    count++;
  }
  if (mode !== 'max' && count < limit) return { count: 0, cost: 0 };
  return { count, cost };
}

/** What `count` levels of a stat cost together, starting at `level` (stops at the top level). Works even when the coins are not there. */
export function costOf(ref: ZoneRef, stat: StatId, level: number, count: number, discount = 0): number {
  let cost = 0;
  for (let n = level; n < level + count && n < STATS[stat].max; n++) cost += statCost(ref, stat, n, discount);
  return cost;
}

/** Buy levels of a stat (see planBuy). Returns false if nothing could be bought. */
export function buyStat(state: GameState, zoneId: string, stat: StatId, mode: BuyMode = 1): boolean {
  const ref = zoneById(zoneId);
  const z = state.zones[zoneId];
  if (!z.owned) return false;
  const plan = planBuy(ref, stat, z[stat], state.coins, mode, discounts(state, ref.sport.id).stat(stat));
  if (plan.count === 0) return false;
  state.coins -= plan.cost;
  z[stat] += plan.count;
  return true;
}

export function buyManager(state: GameState, zoneId: string): boolean {
  const ref = zoneById(zoneId);
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

export function buyFacility(state: GameState, id: string): boolean {
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
  return ZONES.filter((r) => {
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
export function advanceZone(state: GameState, ref: ZoneRef, dt: number, m: Multipliers = multipliers(state)) {
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
    for (const ref of ZONES) advanceZone(state, ref, boosted, m);
    state.boost -= boosted;
    dt -= boosted;
  }
  if (dt <= 0) return;
  const m = multipliers(state);
  for (const ref of ZONES) advanceZone(state, ref, dt, m);
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
  coins: number;
  /** Zones without a manager that finished a session and wait for you. */
  waiting: number;
}

/** Earnings for time spent away. Zones with a manager earn, others finish one session and wait. */
export function applyOffline(state: GameState, awaySeconds: number): OfflineReport {
  const cap = offlineCap(state);
  const seconds = Math.max(0, Math.min(awaySeconds, cap));
  const before = { coins: state.coins };
  if (seconds > 0) tick(state, seconds);
  const waiting = ZONES.filter((r) => {
    const z = state.zones[r.id];
    return z.owned && !z.manager && z.phase === 'ready';
  }).length;
  return {
    seconds,
    away: awaySeconds,
    capped: awaySeconds > cap,
    coins: state.coins - before.coins,
    waiting,
  };
}

/** Coins per second from zones with a manager (what you earn while away). */
export function autoIncomePerSecond(state: GameState): number {
  const m = multipliers(state);
  let sum = 0;
  for (const r of ZONES) {
    const z = state.zones[r.id];
    if (z.owned && z.manager) sum += zoneStats(state, r, z, m).perSecond;
  }
  return sum;
}
