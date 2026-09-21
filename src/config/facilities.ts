// Beach facilities: shared buildings on the beach that boost every sport.

export type FacilityEffect = 'coins' | 'speed' | 'reputation';

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
  /** Where the building stands on the beach (map units: column, depth). */
  at: { x: number; y: number };
}

export const FACILITIES: FacilityDef[] = [
  { id: 'shop', name: 'Rental shop', icon: 'shop', blurb: 'Board and wetsuit rental. Every guest pays more.', effect: 'coins', perLevel: 0.1, max: 8, baseCost: 5000, growth: 5.2, at: { x: 1.2, y: 0.3 } },
  { id: 'cafe', name: 'Beach café', icon: 'cafe', blurb: 'Guests stay for a drink and spend more.', effect: 'coins', perLevel: 0.1, max: 8, baseCost: 12000, growth: 5.4, at: { x: 3.2, y: 0.3 } },
  { id: 'showers', name: 'Showers', icon: 'shower', blurb: 'Quicker changeovers, so sessions finish faster.', effect: 'speed', perLevel: 0.06, max: 8, baseCost: 25000, growth: 5.3, at: { x: 10.4, y: 0.3 } },
  { id: 'lifeguard', name: 'Lifeguard tower', icon: 'lifeguard', blurb: 'Safe beaches make happy guests: more reputation.', effect: 'reputation', perLevel: 0.15, max: 8, baseCost: 18000, growth: 5.4, at: { x: 12.8, y: 0.3 } },
];

export function facilityById(id: string): FacilityDef {
  const f = FACILITIES.find((x) => x.id === id);
  if (!f) throw new Error('Unknown facility ' + id);
  return f;
}
