import type { AreaId } from './areas';
import type { Rect } from './layout';

export type SportId = 'wave' | 'skimboarding' | 'windsurfing' | 'kitesurfing' | 'foil' | 'sailing';

/** What the water looks like in a zone. Used only for drawing. */
export type WaterLook = 'flat' | 'rolling' | 'reef' | 'big' | 'shallows' | 'shorebreak' | 'bigbreak' | 'chop' | 'swell';

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
      {
        name: 'Longboarders',
        guests: 'Longboard surfers',
        conditions: 'Small, long, rolling waves',
        starterBuys: ['Longboard rental', 'A beach café'],
        rect: { x: 3.5, y: 3, w: 5.7, h: 1 },
        tier: 1.6,
        baseGuests: 4,
        baseSeconds: 8,
        guestColors: ['#2fb5a8', '#f2a541', '#e8583d', '#5b8def', '#9b6bd6'],
        look: 'rolling',
        unlock: { coins: 300, reputation: 0, prevLevelUpgrades: 10 },
      },
      {
        name: 'Reef',
        guests: 'Good surfers',
        conditions: 'High waves',
        starterBuys: ['A lifeguard tower', 'Reef access'],
        rect: { x: 3.5, y: 4, w: 3, h: 1 },
        tier: 3.2,
        baseGuests: 3,
        baseSeconds: 10,
        guestColors: ['#1f9e89', '#ef476f', '#118ab2', '#ffd166', '#8338ec'],
        look: 'reef',
        unlock: { coins: 12000, reputation: 25 },
      },
      {
        name: 'Nazaré',
        guests: 'Pros only',
        conditions: 'Big waves',
        starterBuys: ['A rescue jet ski', 'A safety crew'],
        rect: { x: 6.5, y: 4, w: 2, h: 1 },
        tier: 4.8,
        baseGuests: 2,
        baseSeconds: 12,
        guestColors: ['#222831', '#c1121f', '#0b132b', '#3a0ca3', '#1b1b1e'],
        look: 'big',
        unlock: { coins: 400000, reputation: 250 },
      },
    ],
  },
  {
    id: 'skimboarding',
    name: 'Skimboarding',
    icon: '🛹',
    area: 'wave',
    order: 2,
    color: '#f2b134',
    guestKind: 'skimmer',
    unlock: { reputation: 12, coins: 1500 },
    terms: {
      capacity: 'More boards',
      price: 'Board rental',
      speed: 'Quicker runs',
      manager: 'Cove host',
      managerBlurb: 'Looks after the cove by themselves, even while you are away.',
    },
    levels: [
      {
        name: 'Shallows',
        guests: 'Kids and first-timers',
        conditions: 'Ankle-deep water at the water\'s edge, no waves',
        starterBuys: ['Rental skimboards', 'A shallow-water flag'],
        rect: { x: 0, y: 2.45, w: 1.7, h: 1.25 },
        tier: 2.1,
        baseGuests: 4,
        baseSeconds: 7,
        guestColors: ['#ffb74d', '#4dd0e1', '#f06292', '#aed581', '#ba68c8'],
        look: 'shallows',
      },
      {
        name: 'Flatland',
        guests: 'Flatland riders',
        conditions: 'Wide, flat, wet sand with a thin layer of water',
        starterBuys: ['Flatland boards', 'A wet-sand track'],
        rect: { x: 1.7, y: 2.45, w: 1.7, h: 1.25 },
        tier: 3.0,
        baseGuests: 4,
        baseSeconds: 8,
        guestColors: ['#26a69a', '#ef5350', '#ffca28', '#5c6bc0', '#8d6e63'],
        look: 'flat',
        unlock: { coins: 12000, reputation: 0, prevLevelUpgrades: 10 },
      },
      {
        name: 'Shore break',
        guests: 'Wave riders',
        conditions: 'Small, steep waves breaking close to the sand',
        starterBuys: ['Wave boards', 'A shore-break spotter'],
        rect: { x: 0, y: 3.7, w: 1.7, h: 1.25 },
        tier: 4.0,
        baseGuests: 3,
        baseSeconds: 9,
        guestColors: ['#00897b', '#e53935', '#fdd835', '#3949ab', '#6d4c41'],
        look: 'shorebreak',
        unlock: { coins: 150000, reputation: 60 },
      },
      {
        name: 'Big shore break',
        guests: 'Pros only',
        conditions: 'Big, fast waves breaking right on the sand',
        starterBuys: ['Pro boards', 'A rescue crew on the sand'],
        rect: { x: 1.7, y: 3.7, w: 1.7, h: 1.25 },
        tier: 5.2,
        baseGuests: 2,
        baseSeconds: 11,
        guestColors: ['#212121', '#b71c1c', '#0d47a1', '#4a148c', '#1b5e20'],
        look: 'bigbreak',
        unlock: { coins: 2500000, reputation: 320 },
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
