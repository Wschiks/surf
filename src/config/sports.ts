import type { AreaId } from './areas';
import { unlockCoins } from './balance';
import type { Rect } from './layout';

export type SportId = 'wave' | 'skimboarding' | 'windsurfing' | 'kitesurfing' | 'foil' | 'sailing';

/** What the water looks like in a zone. Used only for drawing. */
export type WaterLook = 'flat' | 'ripple' | 'rolling' | 'reef' | 'big' | 'shallows' | 'shorebreak' | 'bigbreak' | 'chop' | 'swell';

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
  /** A place on the beach this sport needs (kite launch area, jetty). It appears when the sport unlocks. */
  beachSite?: { id: 'kite-launch' | 'jetty'; name: string; rect: Rect };
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
        unlock: { coins: unlockCoins(1.6, 25), reputation: 0, prevLevelUpgrades: 10 },
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
        unlock: { coins: unlockCoins(3.2, 70), reputation: 25 },
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
        unlock: { coins: unlockCoins(4.8, 150), reputation: 250 },
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
    unlock: { reputation: 12, coins: unlockCoins(2.1, 60) },
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
        unlock: { coins: unlockCoins(3.0, 25), reputation: 0, prevLevelUpgrades: 10 },
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
        unlock: { coins: unlockCoins(4.0, 70), reputation: 60 },
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
        unlock: { coins: unlockCoins(5.2, 150), reputation: 320 },
      },
    ],
  },
  {
    id: 'windsurfing',
    name: 'Windsurfing',
    icon: '🌬️',
    area: 'sea',
    order: 3,
    color: '#1fb6c9',
    guestKind: 'windsurfer',
    unlock: { reputation: 44, coins: unlockCoins(4.2, 60) },
    terms: {
      capacity: 'More sails',
      price: 'Lesson and rental price',
      speed: 'Faster changeovers',
      manager: 'Windsurf coach',
      managerBlurb: 'Runs the rigging area by themselves, even while you are away.',
    },
    levels: [
      {
        name: 'Beginner class',
        guests: 'Kids and adults in a class, on wide, stable boards',
        conditions: 'Shallow, flat water and light, steady wind',
        starterBuys: ['Wide, stable boards', 'Small sails', 'A rigging area'],
        rect: { x: 0.05, y: 5.1, w: 1.6, h: 1.35 },
        tier: 4.2,
        baseGuests: 4,
        baseSeconds: 7,
        guestColors: ['#26c6da', '#ffd54f', '#ff8a65', '#9ccc65', '#ba68c8'],
        look: 'flat',
      },
      {
        name: 'Freeride',
        guests: 'Windsurfers cruising back and forth',
        conditions: 'Steady wind and flat to slightly choppy water',
        starterBuys: ['Freeride sails', 'A bigger rigging park'],
        rect: { x: 1.7, y: 5.1, w: 1.6, h: 1.35 },
        tier: 5.2,
        baseGuests: 4,
        baseSeconds: 8,
        guestColors: ['#00acc1', '#ef5350', '#fbc02d', '#5c6bc0', '#26a69a'],
        look: 'ripple',
        unlock: { coins: unlockCoins(5.2, 25), reputation: 0, prevLevelUpgrades: 10 },
      },
      {
        name: 'Speed and freestyle',
        guests: 'Fast riders and trick riders',
        conditions: 'Strong wind and choppy water',
        starterBuys: ['Speed boards', 'Freestyle sails'],
        rect: { x: 0.05, y: 6.5, w: 1.6, h: 1.35 },
        tier: 6.4,
        baseGuests: 3,
        baseSeconds: 9,
        guestColors: ['#e53935', '#00897b', '#fdd835', '#3949ab', '#8e24aa'],
        look: 'chop',
        unlock: { coins: unlockCoins(6.4, 70), reputation: 240 },
      },
      {
        name: 'Wave zone',
        guests: 'Pros only',
        conditions: 'Strong wind and big waves',
        starterBuys: ['Wave sails', 'A rescue boat'],
        rect: { x: 1.7, y: 6.5, w: 1.6, h: 1.35 },
        tier: 7.6,
        baseGuests: 2,
        baseSeconds: 11,
        guestColors: ['#212121', '#c62828', '#0d47a1', '#4a148c', '#1b5e20'],
        look: 'big',
        unlock: { coins: unlockCoins(7.6, 150), reputation: 1600 },
      },
    ],
  },
  {
    id: 'kitesurfing',
    name: 'Kitesurfing',
    icon: '🪁',
    area: 'sea',
    order: 4,
    color: '#ff5c8a',
    guestKind: 'kiter',
    beachSite: { id: 'kite-launch', name: 'Kite launch area', rect: { x: 3.5, y: 1.0, w: 3, h: 0.95 } },
    unlock: { reputation: 140, coins: unlockCoins(6.0, 60) },
    terms: {
      capacity: 'More kite spots',
      price: 'Lesson price',
      speed: 'Quicker launches',
      manager: 'Kite instructor',
      managerBlurb: 'Runs the launch area by themselves, even while you are away.',
    },
    levels: [
      {
        name: 'Kite school',
        guests: 'Beginners in a class, starting with a small trainer kite',
        conditions: 'Shallow, flat water and steady wind',
        starterBuys: ['Trainer kites', 'Safety helmets', 'A wide launch area'],
        rect: { x: 3.35, y: 5.1, w: 1.6, h: 1.35 },
        tier: 6.0,
        baseGuests: 4,
        baseSeconds: 8,
        guestColors: ['#ff7043', '#ffca28', '#29b6f6', '#ec407a', '#66bb6a'],
        look: 'flat',
      },
      {
        name: 'Freeride',
        guests: 'Riders on twin-tip boards',
        conditions: 'Steady wind and flat to slightly choppy water',
        starterBuys: ['Twin-tip boards', 'Bigger kites'],
        rect: { x: 5.0, y: 5.1, w: 1.6, h: 1.35 },
        tier: 7.0,
        baseGuests: 4,
        baseSeconds: 8,
        guestColors: ['#ff5722', '#ffeb3b', '#03a9f4', '#e91e63', '#4caf50'],
        look: 'ripple',
        unlock: { coins: unlockCoins(7.0, 25), reputation: 0, prevLevelUpgrades: 10 },
      },
      {
        name: 'Freestyle and big air',
        guests: 'Riders who do tricks and big jumps',
        conditions: 'Strong wind and choppy water, with lots of open space',
        starterBuys: ['Big air kites', 'A jump judge'],
        rect: { x: 3.35, y: 6.5, w: 1.6, h: 1.35 },
        tier: 8.2,
        baseGuests: 3,
        baseSeconds: 10,
        guestColors: ['#d81b60', '#fb8c00', '#00acc1', '#7cb342', '#5e35b1'],
        look: 'chop',
        unlock: { coins: unlockCoins(8.2, 70), reputation: 770 },
      },
      {
        name: 'Big air and waves',
        guests: 'Pros only',
        conditions: 'Very strong wind and big waves',
        starterBuys: ['Pro kites', 'A rescue jet ski'],
        rect: { x: 5.0, y: 6.5, w: 1.6, h: 1.35 },
        tier: 9.4,
        baseGuests: 2,
        baseSeconds: 12,
        guestColors: ['#1a1a1a', '#d50000', '#0091ea', '#aa00ff', '#00c853'],
        look: 'big',
        unlock: { coins: unlockCoins(9.4, 150), reputation: 5000 },
      },
    ],
  },
  {
    id: 'foil',
    name: 'Foil and wing',
    icon: '🦅',
    area: 'sea',
    order: 5,
    color: '#8e6bd8',
    guestKind: 'foiler',
    unlock: { reputation: 450, coins: unlockCoins(7.8, 60) },
    terms: {
      capacity: 'More foil boards',
      price: 'Foil rental',
      speed: 'Quick swaps',
      manager: 'Foil coach',
      managerBlurb: 'Runs the foil school by themselves, even while you are away.',
    },
    levels: [
      {
        name: 'Foil school',
        guests: 'Beginners in a class, on big, stable foil boards',
        conditions: 'Flat, calm water',
        starterBuys: ['Big foil boards', 'Helmets and pads'],
        rect: { x: 6.65, y: 5.1, w: 1.6, h: 1.35 },
        tier: 7.8,
        baseGuests: 4,
        baseSeconds: 9,
        guestColors: ['#7e57c2', '#26c6da', '#ffa726', '#ec407a', '#9ccc65'],
        look: 'flat',
      },
      {
        name: 'Wing freeride',
        guests: 'Riders with a hand-held wing',
        conditions: 'Light wind and flat water',
        starterBuys: ['Hand-held wings', 'Smaller foils'],
        rect: { x: 8.3, y: 5.1, w: 1.6, h: 1.35 },
        tier: 8.8,
        baseGuests: 4,
        baseSeconds: 9,
        guestColors: ['#5c6bc0', '#00bcd4', '#ff9800', '#e91e63', '#8bc34a'],
        look: 'flat',
        unlock: { coins: unlockCoins(8.8, 25), reputation: 0, prevLevelUpgrades: 10 },
      },
      {
        name: 'Downwind',
        guests: 'Experienced riders who ride small ocean swells',
        conditions: 'Open water with long, rolling swell',
        starterBuys: ['Downwind foils', 'A chase boat'],
        rect: { x: 6.65, y: 6.5, w: 1.6, h: 1.35 },
        tier: 10.0,
        baseGuests: 3,
        baseSeconds: 11,
        guestColors: ['#3949ab', '#00838f', '#ef6c00', '#ad1457', '#558b2f'],
        look: 'swell',
        unlock: { coins: unlockCoins(10.0, 70), reputation: 2500 },
      },
      {
        name: 'Pro arena',
        guests: 'Pros only',
        conditions: 'Big waves and strong wind',
        starterBuys: ['Pro foils', 'A rescue crew'],
        rect: { x: 8.3, y: 6.5, w: 1.6, h: 1.35 },
        tier: 11.2,
        baseGuests: 2,
        baseSeconds: 13,
        guestColors: ['#000000', '#b71c1c', '#01579b', '#4a148c', '#004d40'],
        look: 'big',
        unlock: { coins: unlockCoins(11.2, 150), reputation: 16000 },
      },
    ],
  },
  {
    id: 'sailing',
    name: 'Sailing',
    icon: '⛵',
    area: 'ocean',
    order: 6,
    color: '#3f51b5',
    guestKind: 'sailor',
    beachSite: { id: 'jetty', name: 'Jetty', rect: { x: 9.3, y: 0.9, w: 0.65, h: 2.5 } },
    unlock: { reputation: 1500, coins: unlockCoins(9.6, 60) },
    terms: {
      capacity: 'More boats',
      price: 'Boat hire',
      speed: 'Faster turnarounds',
      manager: 'Harbour master',
      managerBlurb: 'Runs the harbour by themselves, even while you are away.',
    },
    levels: [
      {
        name: 'Sailing school',
        guests: 'Kids in a class, in small dinghies',
        conditions: 'Sheltered, flat water and light wind',
        starterBuys: ['Small dinghies', 'Life jackets', 'A sheltered mooring'],
        rect: { x: 7.5, y: 8.15, w: 2.35, h: 1.7 },
        tier: 9.6,
        baseGuests: 4,
        baseSeconds: 8,
        guestColors: ['#ff7043', '#ffd54f', '#4fc3f7', '#f06292', '#aed581'],
        look: 'flat',
      },
      {
        name: 'Boat hire',
        guests: 'Weekend sailors in dinghies and catamarans',
        conditions: 'Open water near the shore and steady wind',
        starterBuys: ['Dinghies and catamarans', 'A boat hire desk'],
        rect: { x: 5.05, y: 8.15, w: 2.35, h: 1.7 },
        tier: 10.6,
        baseGuests: 4,
        baseSeconds: 10,
        guestColors: ['#ef5350', '#26c6da', '#ffa726', '#7e57c2', '#66bb6a'],
        look: 'ripple',
        unlock: { coins: unlockCoins(10.6, 25), reputation: 0, prevLevelUpgrades: 10 },
      },
      {
        name: 'Club racing',
        guests: 'Racing sailors on faster boats',
        conditions: 'Open water, strong wind and a marked race course',
        starterBuys: ['Racing boats', 'Race course buoys'],
        rect: { x: 2.6, y: 8.15, w: 2.35, h: 1.7 },
        tier: 11.8,
        baseGuests: 3,
        baseSeconds: 12,
        guestColors: ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa'],
        look: 'chop',
        unlock: { coins: unlockCoins(11.8, 70), reputation: 6500 },
      },
      {
        name: 'Offshore regatta',
        guests: 'Pro crews, like the Volvo Ocean Race',
        conditions: 'Open sea, strong wind and big swell',
        starterBuys: ['An ocean racer', 'A support boat'],
        rect: { x: 0.15, y: 8.15, w: 2.35, h: 1.7 },
        tier: 13.0,
        baseGuests: 2,
        baseSeconds: 14,
        guestColors: ['#1a237e', '#b71c1c', '#004d40', '#f57f17', '#4a148c'],
        look: 'swell',
        unlock: { coins: unlockCoins(13.0, 150), reputation: 55000 },
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
