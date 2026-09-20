// Usage: npx tsx scripts/simulate.ts [hours]
import { simulate } from '../src/core/bot';
import { ZONES } from '../src/config/sports';

const hours = Number(process.argv[2] ?? 12);
const res = simulate({ maxSeconds: hours * 3600, step: Number(process.argv[3] ?? 2) });
const fmtT = (s: number) => `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
for (const e of res.events) console.log(fmtT(e.t).padStart(7), e.what);
console.log('purchases', res.purchases, 'longest wait', fmtT(res.longestWait.seconds), 'from', fmtT(res.longestWait.from));
console.log('finished', res.finishedAt && fmtT(res.finishedAt), 'maxed', res.maxedAt && fmtT(res.maxedAt));
console.log('coins', res.state.coins.toExponential(2), 'rep', Math.floor(res.state.reputation));
for (const r of ZONES) {
  const z = res.state.zones[r.id];
  if (z.owned) console.log(r.id.padEnd(16), 'cap', z.capacity, 'price', z.price, 'speed', z.speed, z.manager ? 'M' : '');
}
