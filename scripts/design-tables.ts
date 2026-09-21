// Prints the numbers of the game as markdown tables, for the design documents (docs/). Usage: npx tsx scripts/design-tables.ts
import { AREAS, SEA_STOPS } from '../src/config/areas';
import { BALANCE, STATS, LEVEL_MILESTONES, tierFactor, costFactor } from '../src/config/balance';
import { EXPANSIONS } from '../src/config/expansions';
import { FACILITIES } from '../src/config/facilities';
import { SPORTS } from '../src/config/sports';

const f = (n: number) => (n >= 1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n * 100) / 100));
console.log('### Areas\n| id | name | depth from | depth to | opens with expansion | overview colour |\n|---|---|---|---|---|---|');
for (const a of AREAS) console.log(`| ${a.id} | ${a.name} | ${a.from} | ${a.to} | ${a.expansion} | ${a.color} |`);
console.log('\n### Sea colour by depth (r, g, b)\n| depth | rgb |\n|---|---|');
for (const [d, r, g, b] of SEA_STOPS) console.log(`| ${d} | ${r}, ${g}, ${b} |`);
console.log('\n### Sports');
console.log('| id | name | icon | area | guest kind | noun | guest colours | beach site | unlock rule |\n|---|---|---|---|---|---|---|---|---|');
for (const s of SPORTS) console.log(`| ${s.id} | ${s.name} | ${s.icon} | ${s.area} | ${s.guestKind} | ${s.noun} | ${s.guestColors.join(' ')} | ${s.beachSite ? `${s.beachSite.id} (${s.beachSite.rect.x},${s.beachSite.rect.y},${s.beachSite.rect.w}x${s.beachSite.rect.h})` : '-'} | ${s.unlock ? `Level ${s.unlock.level} of ${s.unlock.after}, reputation ${s.unlock.reputation}, ${f(s.unlock.coins)} coins` : 'open from the start'} |`);
console.log('\n### Upgrade names per sport\n| sport | capacity | level up | speed | manager | manager text |\n|---|---|---|---|---|---|');
for (const s of SPORTS) console.log(`| ${s.id} | ${s.terms.capacity} | ${s.terms.price} | ${s.terms.speed} | ${s.terms.manager} | ${s.terms.managerBlurb} |`);
console.log('\n### Levels (zones)');
console.log('| zone | name | who | conditions | includes | rect x,y,w,h | tier | base guests | base sec | water look | unlock: coins / reputation / prev-level upgrades | base income/session | base coins/sec |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of SPORTS)
  s.levels.forEach((l, i) => {
    const income = l.baseGuests * tierFactor(l.tier);
    console.log(`| ${s.id}-${i + 1} | ${l.name} | ${l.guests} | ${l.conditions} | ${l.starterBuys.join('; ')} | ${l.rect.x}, ${l.rect.y}, ${l.rect.w}, ${l.rect.h} | ${l.tier} | ${l.baseGuests} | ${l.baseSeconds} | ${l.look} | ${l.unlock ? `${f(l.unlock.coins)} / ${l.unlock.reputation} / ${l.unlock.prevLevelUpgrades ?? '-'}` : 'free'} | ${f(income)} | ${f(income / l.baseSeconds)} |`);
  });
console.log('\n### Stats (upgrades)\n| stat | label | baseCost | growth | max |\n|---|---|---|---|---|');
for (const s of Object.values(STATS)) console.log(`| ${s.id} | ${s.label} | ${s.baseCost} | ${s.growth} | ${s.max} |`);
console.log('\nMilestones:', JSON.stringify(LEVEL_MILESTONES), '; balance:', JSON.stringify(BALANCE));
console.log('\ncostFactor(tier) examples:', [0, 2, 4, 6, 8, 10, 12].map((t) => `${t}: ${f(costFactor(t))}`).join(', '));
console.log('tierFactor(tier) examples:', [0, 2, 4, 6, 8, 10, 12].map((t) => `${t}: ${f(tierFactor(t))}`).join(', '));
console.log('\n### Facilities\n| id | name | icon | effect | per level | max | base cost | growth | at (x,y) | blurb |\n|---|---|---|---|---|---|---|---|---|---|');
for (const x of FACILITIES) console.log(`| ${x.id} | ${x.name} | ${x.icon} | ${x.effect} | ${x.perLevel} | ${x.max} | ${x.baseCost} | ${x.growth} | ${x.at.x}, ${x.at.y} | ${x.blurb} |`);
console.log('\n### Expansions\n| n | name | opens | level | reputation | coins | blurb |\n|---|---|---|---|---|---|---|');
for (const e of EXPANSIONS) console.log(`| ${e.n} | ${e.name} | ${e.opens} | ${e.level} | ${e.reputation} | ${f(e.coins)} | ${e.blurb} |`);
