import type { AreaId } from './areas';
import { unlockCoins } from './balance';

// Beach expansions. Buying one opens the next part of the map (its sports start at Level 1), multiplies all
// coin income and wipes the rest of the progress: the player starts over on a bigger beach, faster than before.

export const EXPANSION_MULT = 3;

export interface ExpansionDef {
  /** 1 for the first expansion. */
  n: number;
  name: string;
  /** The area that opens. */
  opens: AreaId;
  blurb: string;
  /** Every sport in the areas that are open must reach this level. */
  level: number;
  reputation: number;
  coins: number;
}

export const EXPANSIONS: ExpansionDef[] = [
  { n: 1, name: 'Beach expansion', opens: 'sea', blurb: 'Opens the Sea: windsurfing, kitesurfing and foil and wing.', level: 4, reputation: 400, coins: unlockCoins(6.2, 150) },
  { n: 2, name: 'Grand beach expansion', opens: 'ocean', blurb: 'Opens the Ocean: sailing and boats.', level: 4, reputation: 8000, coins: unlockCoins(10.0, 150) },
];

export function expansionAfter(count: number): ExpansionDef | null {
  return EXPANSIONS.find((e) => e.n === count + 1) ?? null;
}
