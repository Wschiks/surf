import { STAT_IDS } from '../config/balance';
import { FACILITIES } from '../config/facilities';
import { SPORTS, ZONES } from '../config/sports';
import { buyFacility, buyManager, buyStat, collectAll, facilityCost, managerCost, multipliers, statCost, tick, zoneStats } from './economy';
import { newGame, type GameState } from './state';
import { EXPANSIONS } from '../config/expansions';
import { expand, expansionStatus, levelStatus, unlockLevel } from './unlocks';

// A simple, patient player used to test and balance the game. It taps every waiting zone at once,
// buys upgrades with the best payback, and saves up when a level or sport is about to unlock.

export interface SimEvent {
  t: number;
  what: string;
}

export interface SimResult {
  /** Seconds of play until everything is unlocked and every zone has a manager, or null if not reached. */
  finishedAt: number | null;
  /** Seconds until every stat of every zone is at its maximum, or null if not reached. */
  maxedAt: number | null;
  events: SimEvent[];
  /** The longest time (seconds) the player waited without being able to buy anything. */
  longestWait: { seconds: number; from: number };
  state: GameState;
  purchases: number;
}

function totalRate(state: GameState): number {
  const m = multipliers(state);
  let sum = 0;
  for (const r of ZONES) {
    const z = state.zones[r.id];
    if (z.owned) sum += zoneStats(state, r, z, m).perSecond;
  }
  return sum;
}

interface Candidate {
  name: string;
  cost: number;
  gain: number;
  buy: () => boolean;
}

function candidates(state: GameState): Candidate[] {
  const out: Candidate[] = [];
  const m = multipliers(state);
  for (const r of ZONES) {
    const z = state.zones[r.id];
    if (!z.owned) continue;
    const cur = zoneStats(state, r, z, m).perSecond;
    for (const stat of STAT_IDS) {
      const cost = statCost(r, stat, z[stat]);
      if (!isFinite(cost)) continue;
      const next = zoneStats(state, r, { ...z, [stat]: z[stat] + 1 }, m).perSecond;
      out.push({ name: `${r.id} ${stat} ${z[stat] + 1}`, cost, gain: next - cur, buy: () => buyStat(state, r.id, stat) });
    }
    if (!z.manager) out.push({ name: `${r.id} manager`, cost: managerCost(r), gain: cur * 0.15, buy: () => buyManager(state, r.id) });
  }
  const rate = totalRate(state);
  for (const f of FACILITIES) {
    const lvl = state.facilities[f.id];
    const cost = facilityCost(f.id, lvl);
    if (!isFinite(cost)) continue;
    const gainFactor = f.effect === 'reputation' ? 0.02 : (1 + f.perLevel * (lvl + 1)) / (1 + f.perLevel * lvl) - 1;
    out.push({ name: `facility ${f.id} ${lvl + 1}`, cost, gain: rate * gainFactor, buy: () => buyFacility(state, f.id) });
  }
  return out;
}

/** Next unlock (level or expansion) whose only missing piece is coins. */
function savingFor(state: GameState): { name: string; cost: number } | null {
  let best: { name: string; cost: number } | null = null;
  const exp = expansionStatus(state);
  if (exp && exp.ready) best = { name: 'expansion', cost: exp.coins };
  for (const s of SPORTS) {
    if (!state.sports[s.id]) continue;
    for (let l = 2; l <= (exp ? exp.def.level : s.levels.length); l++) {
      const ref = ZONES.find((z) => z.sport.id === s.id && z.level === l)!;
      if (state.zones[ref.id].owned) continue;
      const st = levelStatus(state, ref);
      if (st.ready && (!best || st.coins < best.cost)) best = { name: `level ${ref.id}`, cost: st.coins };
      break;
    }
  }
  return best;
}

function allDone(state: GameState): boolean {
  return state.expansions === EXPANSIONS.length && ZONES.every((r) => state.zones[r.id].owned && state.zones[r.id].manager);
}

function allMaxed(state: GameState): boolean {
  return ZONES.every((r) => STAT_IDS.every((s) => !isFinite(statCost(r, s, state.zones[r.id][s])))) && FACILITIES.every((f) => !isFinite(facilityCost(f.id, state.facilities[f.id])));
}

export function simulate(opts: { maxSeconds: number; step?: number; state?: GameState } = { maxSeconds: 3600 * 24 }): SimResult {
  const state = opts.state ?? newGame(0);
  const step = opts.step ?? 1;
  const events: SimEvent[] = [];
  let t = 0;
  let lastPurchase = 0;
  let longest = { seconds: 0, from: 0 };
  let purchases = 0;
  let finishedAt: number | null = null;
  let maxedAt: number | null = null;

  const noteBuy = () => {
    purchases++;
    if (t - lastPurchase > longest.seconds) longest = { seconds: t - lastPurchase, from: lastPurchase };
    lastPurchase = t;
  };

  while (t < opts.maxSeconds) {
    tick(state, step);
    collectAll(state);
    t += step;
    // buy, as many times as the money allows this step
    for (let guard = 0; guard < 50; guard++) {
      let bought = false;
      // 1. expansions and level unlocks come first
      if (expansionStatus(state)?.canBuy && expand(state)) {
        events.push({ t, what: `EXPANSION ${state.expansions}: the big wave. Area opened, everything starts over` });
        noteBuy();
        bought = true;
        continue;
      }
      const wanted = expansionStatus(state)?.def.level ?? 99; // save for the expansion first, the top levels come after it
      for (const r of ZONES) {
        if (r.level > wanted) continue;
        if (r.level > 1 && state.sports[r.sport.id] && !state.zones[r.id].owned && unlockLevel(state, r.id)) {
          events.push({ t, what: `unlocked ${r.sport.name} level ${r.level} (${r.def.name})` });
          noteBuy();
          bought = true;
        }
      }
      // 2. upgrades with the best payback, unless saving for an unlock
      const rate = Math.max(totalRate(state), 1e-9);
      const saving = savingFor(state);
      const tSave = saving ? Math.max(0, saving.cost - state.coins) / rate : 0;
      const affordable = candidates(state)
        .filter((c) => c.cost <= state.coins && c.gain > 0)
        .map((c) => ({ c, payback: c.cost / c.gain }))
        .filter((x) => !saving || x.payback < tSave / 2 || tSave < 1)
        .sort((a, b) => a.payback - b.payback);
      if (affordable.length) {
        const pick = affordable[0].c;
        if (pick.buy()) {
          noteBuy();
          bought = true;
          if (pick.name.endsWith('manager')) events.push({ t, what: pick.name });
        }
      }
      if (!bought) break;
    }
    if (finishedAt === null && allDone(state)) {
      finishedAt = t;
      events.push({ t, what: 'FINISHED: everything unlocked and managed' });
    }
    if (maxedAt === null && allMaxed(state)) {
      maxedAt = t;
      events.push({ t, what: 'MAXED: everything at maximum' });
      break;
    }
  }
  if (t - lastPurchase > longest.seconds) longest = { seconds: t - lastPurchase, from: lastPurchase };
  return { finishedAt, maxedAt, events, longestWait: longest, state, purchases };
}
