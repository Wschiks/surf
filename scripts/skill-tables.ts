// Prints the skill trees as markdown tables for the design documents. Usage: npx tsx scripts/skill-tables.ts
import { SKILL_TREES, describeSkill } from '../src/config/skills';
for (const t of SKILL_TREES) {
  console.log(`\n**${t.name}** (colour ${t.color}, icon ${t.icon}, root at ${t.at.x}, ${t.at.y} px)\n`);
  console.log('| id | name | effect | cost | parent | x, y (tree units) |\n|---|---|---|---|---|---|');
  for (const n of t.nodes) console.log(`| ${n.id.split(':')[1]} | ${n.name} | ${describeSkill(n)} | ${n.cost} | ${n.parent ? n.parent.split(':')[1] : '(free root)'} | ${n.x}, ${n.y} |`);
}
