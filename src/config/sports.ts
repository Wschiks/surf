import type { AreaId } from './areas';
import type { Rect } from './layout';

export type SportId = 'wave' | 'skimboarding' | 'windsurfing' | 'kitesurfing' | 'foil' | 'sailing';

/** What the water looks like in a zone. Used only for drawing. */
export type WaterLook = 'flat' | 'rolling' | 'reef' | 'big' | 'shallows' | 'shorebreak' | 'chop' | 'swell';

export type GuestKind = 'surfer' | 'skimmer' | 'windsurfer' | 'kiter' | 'foiler' | 'sailor';

export interface UnlockRule {
  /** Coins to pay. */
  coins: number;
  /** Reputation the player must have. */
  reputation: number;
  /** Total upgrade levels the previous level must have (the rule for Level 2). */
  prevLevelUpgrades?: number;
}

export interface LevelDef {
  name: string;
  /** Who is there. */
  guests: string;
  /** Fixed conditions of this zone. */
  conditions: string;
  /** What the player gets first (flavour, shown on the unlock card). */
  starterBuys: string[];
  /** Zone rectangle on the map, in map units. */
  rect: Rect;
  /** Economy scale: costs and incomes multiply by tierScale^tier. */
  tier: number;
  baseGuests: number;
  baseSeconds: number;
  /** How the guests look: shirt/vest colours. */
  guestColors: string[];
  look: WaterLook;
  /** Level 1 of a sport is unlocked with the sport. Levels 2 to 4 have their own rule. */
  unlock?: UnlockRule;
}

export interface SportDef {
  id: SportId;
  name: string;
  icon: string;
  area: AreaId;
  /** 1 = first sport. A sport unlocks when the previous one has Level 2 and enough reputation. */
  order: number;
  color: string;
  guestKind: GuestKind;
  /** Rule to unlock the sport. The first sport has none. */
  unlock?: { reputation: number; coins: number };
  /** Names for the shared upgrade types in this sport. */
  terms: { capacity: string; price: string; speed: string; manager: string; managerBlurb: string };
  levels: LevelDef[];
}

export const SPORTS: SportDef[] = [
  {
    id: 'wave',
    name: 'Wave surfing',
    icon: '🏄',
    area: 'wave',
    order: 1,
    color: '#ff7a45',
    guestKind: 'surfer',
    terms: {
      capacity: 'Bigger class',
      price: 'Lesson price',
      speed: 'Faster turnover',
      manager: 'Head instructor',
      managerBlurb: 'Runs this zone by themselves, even while you are away.',
    },
    levels: [
      {
        name: 'Beginner class',
        guests: 'Kids in a class, wearing bright vests',
        conditions: 'Small, long, rolling waves',
        starterBuys: ['Bright vests', 'A first instructor', 'A board rack'],
        rect: { x: 3.5, y: 2, w: 5.7, h: 1 },
        tier: 0,
        baseGuests: 3,
        baseSeconds: 6,
        guestColors: ['#ff6b3d', '#ffd23f', '#ff5fa2', '#4be07a', '#3fc3ff'],
        look: 'rolling',
      },
    ],
  },
];

export function sportById(id: SportId): SportDef {
  const s = SPORTS.find((x) => x.id === id);
  if (!s) throw new Error('Unknown sport ' + id);
  return s;
}

export function zoneId(sport: SportId, level: number): string {
  return `${sport}-${level}`;
}

export interface ZoneRef {
  id: string;
  sport: SportDef;
  level: number; // 1-based
  def: LevelDef;
}

export const ZONES: ZoneRef[] = SPORTS.flatMap((s) => s.levels.map((def, i) => ({ id: zoneId(s.id, i + 1), sport: s, level: i + 1, def })));

export function zoneById(id: string): ZoneRef {
  const z = ZONES.find((x) => x.id === id);
  if (!z) throw new Error('Unknown zone ' + id);
  return z;
}
