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
  { id: 'shop', name: 'Rental shop', icon: '🏄', blurb: 'Board and wetsuit rental. Every guest pays more.', effect: 'coins', perLevel: 0.1, max: 8, baseCost: 250, growth: 4.2, at: { x: 1.0, y: 0.55 } },
  { id: 'cafe', name: 'Beach café', icon: '☕', blurb: 'Guests stay for a drink and spend more.', effect: 'coins', perLevel: 0.1, max: 8, baseCost: 600, growth: 4.6, at: { x: 3.0, y: 0.55 } },
  { id: 'showers', name: 'Showers', icon: '🚿', blurb: 'Quicker changeovers, so sessions finish faster.', effect: 'speed', perLevel: 0.06, max: 8, baseCost: 1200, growth: 4.4, at: { x: 5.0, y: 0.55 } },
  { id: 'lifeguard', name: 'Lifeguard tower', icon: '🛟', blurb: 'Safe beaches make happy guests: more reputation.', effect: 'reputation', perLevel: 0.15, max: 8, baseCost: 900, growth: 4.5, at: { x: 7.0, y: 0.55 } },
];

export function facilityById(id: string): FacilityDef {
  const f = FACILITIES.find((x) => x.id === id);
  if (!f) throw new Error('Unknown facility ' + id);
  return f;
}
