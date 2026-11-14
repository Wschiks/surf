// Benchmark saves for the speed test (scripts/bench/bench.mjs): the game's own simulated player plays for a while,
// and its beach is saved. "early" = 20 minutes of play, "mid" = 6 hours, "late" = 30 hours (a full beach: many sections, managers, guests).
import { writeFileSync } from 'node:fs';
import { simulate } from '../../src/core/bot';
import { saveGame } from '../../src/core/save';

for (const [name, seconds] of [
  ['early', 20 * 60],
  ['mid', 6 * 3600],
  ['late', 30 * 3600],
] as const) {
  const r = simulate({ maxSeconds: seconds });
  let json = '';
  saveGame(r.state, Date.now(), { setItem: (_k: string, v: string) => (json = v) });
  writeFileSync(new URL(`./save-${name}.json`, import.meta.url), json);
  const owned = Object.values(r.state.zones).filter((z) => z.owned).length;
  const managers = Object.values(r.state.zones).filter((z) => z.manager).length;
  console.log(name, { owned, managers, expansions: r.state.expansions, bytes: json.length });
}
