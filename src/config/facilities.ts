// Beach facilities: shared buildings on the beach that boost every sport. They are rare and dear: each one has to be
// earned first (it opens when a certain zone is unlocked), and every level costs 7 times the one before.
// Every stage of the game (the start, after the 1st expansion, after the 2nd) brings one new house: the rental shop,
// then the beach café, then the beach hotel.

export type FacilityEffect = 'coins' | 'speed';

export interface FacilityDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  effect: FacilityEffect;
  /** Bonus per level, as a fraction (0.1 = +10%). */
  perLevel: number;
  max: number;
  baseCost: number;
  growth: number;
  /** Beach expansions needed before it can be built (0 = from the start). */
  stage: number;
  /** The zone that must be unlocked before it can be built. */
  needs: string;
  /** One of the houses (one per stage of the game). */
  house?: boolean;
  /** Where the building stands on the beach (map units: column, depth). */
  at: { x: number; y: number };
}

export const FACILITIES: FacilityDef[] = [
  { id: 'shop', name: 'Rental shop', icon: 'shop', blurb: 'Board and wetsuit rental. Every guest pays more.', effect: 'coins', perLevel: 0.1, max: 8, baseCost: 20000, growth: 7, stage: 0, needs: 'wave-2', house: true, at: { x: 1.2, y: -1.1 } },
  { id: 'lifeguard', name: 'Lifeguard tower', icon: 'lifeguard', blurb: 'Safe beaches bring in more guests who spend more.', effect: 'coins', perLevel: 0.08, max: 8, baseCost: 300000, growth: 7, stage: 0, needs: 'wave-3', at: { x: 12.8, y: -1.1 } },
  { id: 'showers', name: 'Showers', icon: 'shower', blurb: 'Quicker changeovers, so sessions finish faster.', effect: 'speed', perLevel: 0.06, max: 8, baseCost: 20e6, growth: 7, stage: 0, needs: 'wave-4', at: { x: 10.4, y: -1.1 } },
  { id: 'cafe', name: 'Beach café', icon: 'cafe', blurb: 'Guests stay for a drink and spend more.', effect: 'coins', perLevel: 0.12, max: 8, baseCost: 10e6, growth: 7, stage: 1, needs: 'kitesurfing-1', house: true, at: { x: 3.2, y: -1.1 } },
  { id: 'hotel', name: 'Beach hotel', icon: 'hotel', blurb: 'Guests stay the night and come back every day.', effect: 'coins', perLevel: 0.15, max: 8, baseCost: 30e9, growth: 7, stage: 2, needs: 'sailing-2', house: true, at: { x: 7.5, y: -1.1 } },
];

export function facilityById(id: string): FacilityDef {
  const f = FACILITIES.find((x) => x.id === id);
  if (!f) throw new Error('Unknown facility ' + id);
  return f;
}
