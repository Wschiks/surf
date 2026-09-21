import { BALANCE, costFactor, STATS, STAT_IDS, tierFactor, type StatId } from '../config/balance';
import { FACILITIES, facilityById } from '../config/facilities';
import { ZONES, zoneById, type ZoneRef } from '../config/sports';
import type { GameState, ZoneState } from './state';

export interface Multipliers {
  coins: number;
  speed: number;
  reputation: number;
}

export function multipliers(state: GameState): Multipliers {
  const m: Multipliers = { coins: 1, speed: 1, reputation: 1 };
  for (const f of FACILITIES) {
    const lvl = state.facilities[f.id] ?? 0;
    m[f.effect] *= 1 + f.perLevel * lvl;
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
  /** Reputation one session earns. */
  rep: number;
  /** Coins per second while running. */
  perSecond: number;
}

export function guestsFor(ref: ZoneRef, z: ZoneState): number {
  return ref.def.baseGuests + z.capacity;
}

export function zoneStats(state: GameState, ref: ZoneRef, z: ZoneState = state.zones[ref.id], m: Multipliers = multipliers(state)): ZoneStats {
  const guests = guestsFor(ref, z);
  const pricePerGuest = tierFactor(ref.def.tier) * (1 + BALANCE.priceStep * z.price) * m.coins;
  const duration = ref.def.baseSeconds / ((1 + BALANCE.speedStep * z.speed) * m.speed);
  const income = guests * pricePerGuest;
  const rep = guests * BALANCE.repPerGuest * Math.pow(BALANCE.repTierScale, ref.def.tier) * m.reputation;
  return { guests, pricePerGuest, duration, income, rep, perSecond: income / duration };
}

/** Cost of the next level of a stat, or Infinity at the maximum. */
export function statCost(ref: ZoneRef, stat: StatId, level: number): number {
  const s = STATS[stat];
  if (level >= s.max) return Infinity;
  return Math.ceil(s.baseCost * costFactor(ref.def.tier) * Math.pow(s.growth, level));
}

export function managerCost(ref: ZoneRef): number {
  return Math.ceil(BALANCE.managerCost * costFactor(ref.def.tier));
}

export function facilityCost(id: string, level: number): number {
  const f = facilityById(id);
  if (level >= f.max) return Infinity;
  return Math.ceil(f.baseCost * Math.pow(f.growth, level));
}

/** Total upgrade levels bought in a zone (used by the Level 2 unlock rule). */
export function upgradeCount(z: ZoneState): number {
  return STAT_IDS.reduce((n, s) => n + z[s], 0);
}

export function buyStat(state: GameState, zoneId: string, stat: StatId): boolean {
  const ref = zoneById(zoneId);
  const z = state.zones[zoneId];
  if (!z.owned) return false;
  const cost = statCost(ref, stat, z[stat]);
  if (!isFinite(cost) || state.coins < cost) return false;
  state.coins -= cost;
  z[stat] += 1;
  return true;
}

export function buyManager(state: GameState, zoneId: string): boolean {
  const ref = zoneById(zoneId);
  const z = state.zones[zoneId];
  if (!z.owned || z.manager) return false;
  const cost = managerCost(ref);
  if (state.coins < cost) return false;
  state.coins -= cost;
  z.manager = true;
  if (z.phase === 'ready') collect(state, zoneId);
  if (z.phase === 'idle') z.phase = 'running';
  return true;
}

export function buyFacility(state: GameState, id: string): boolean {
  const lvl = state.facilities[id] ?? 0;
  const cost = facilityCost(id, lvl);
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
  state.reputation += z.pendingRep;
  z.pending = 0;
  z.pendingRep = 0;
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
    state.reputation += n * st.rep;
  } else {
    z.phase = 'ready';
    z.pending = st.income;
    z.pendingRep = st.rep;
    z.elapsed = 0;
  }
}

export function tick(state: GameState, dt: number) {
  const m = multipliers(state);
  for (const ref of ZONES) advanceZone(state, ref, dt, m);
}

export interface OfflineReport {
  /** Seconds that counted (after the cap). */
  seconds: number;
  /** Real seconds away. */
  away: number;
  capped: boolean;
  coins: number;
  reputation: number;
  /** Zones without a manager that finished a session and wait for you. */
  waiting: number;
}

/** Earnings for time spent away. Zones with a manager earn, others finish one session and wait. */
export function applyOffline(state: GameState, awaySeconds: number): OfflineReport {
  const seconds = Math.max(0, Math.min(awaySeconds, BALANCE.offlineCapSeconds));
  const before = { coins: state.coins, rep: state.reputation };
  if (seconds > 0) tick(state, seconds);
  const waiting = ZONES.filter((r) => {
    const z = state.zones[r.id];
    return z.owned && !z.manager && z.phase === 'ready';
  }).length;
  return {
    seconds,
    away: awaySeconds,
    capped: awaySeconds > BALANCE.offlineCapSeconds,
    coins: state.coins - before.coins,
    reputation: state.reputation - before.rep,
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
