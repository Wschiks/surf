import type { AreaId } from './areas';
import { unlockCoins } from './balance';
import type { Rect } from './layout';

export type SportId = 'wave' | 'skimboarding' | 'windsurfing' | 'kitesurfing' | 'foil' | 'sailing';

/** What the water looks like in a zone. Used only for drawing. */
export type WaterLook = 'flat' | 'ripple' | 'rolling' | 'reef' | 'big' | 'shallows' | 'shorebreak' | 'bigbreak' | 'chop' | 'swell';

export type GuestKind = 'surfer' | 'skimmer' | 'windsurfer' | 'kiter' | 'foiler' | 'sailor' | 'walker';

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
  look: WaterLook;
  /** Level 1 of a sport is free when its area opens. Levels 2 to 4 have their own rule. */
  unlock?: UnlockRule;
}

export interface SportDef {
  id: SportId;
  name: string;
  icon: string;
  area: AreaId;
  color: string;
  /** What the guests are called, for quests ("Get 30 surfers"). */
  noun: string;
  guestKind: GuestKind;
  /** Shirt and vest colours of the guests. All levels of a sport look alike; the water around them is what changes. */
  guestColors: string[];
  /** How a sport that does not start open is unlocked: own a level of another sport, have reputation, pay coins. After a beach expansion it is open from the start. */
  unlock?: { after: SportId; level: number; reputation: number; coins: number };
  /** A place on the beach this sport needs (kite launch area, jetty). It appears when the sport unlocks. */
  beachSite?: { id: 'kite-launch' | 'jetty'; name: string; rect: Rect };
  /** Names for the shared upgrade types in this sport. */
  terms: { capacity: string; price: string; speed: string; manager: string; managerBlurb: string };
  levels: LevelDef[];
}

export const SPORTS: SportDef[] = [
  {
    id: 'wave',
    noun: 'surfers',
    name: 'Wave surfing',
    icon: 'wave',
    area: 'wave',
    color: '#ff7a45',
    guestKind: 'surfer',
    guestColors: ['#ff6b3d', '#ffd23f', '#ff5fa2', '#4be07a', '#3fc3ff'],
    terms: {
      capacity: 'Bigger class',
      price: 'Level up',
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
        rect: { x: 5.6, y: 1.7, w: 4.6, h: 1.1 },
        tier: 0,
        baseGuests: 3,
        baseSeconds: 6,
        look: 'rolling',
      },
      {
        name: 'Longboarders',
        guests: 'Longboard surfers',
        conditions: 'Small, long, rolling waves',
        starterBuys: ['Longboard rental', 'A beach café'],
        rect: { x: 10.3, y: 1.7, w: 4.6, h: 1.1 },
        tier: 1.6,
        baseGuests: 4,
        baseSeconds: 8,
        look: 'rolling',
        unlock: { coins: unlockCoins(1.6, 3), reputation: 0, prevLevelUpgrades: 12 },
      },
      {
        name: 'Reef',
        guests: 'Good surfers',
        conditions: 'High waves',
        starterBuys: ['A lifeguard tower', 'Reef access'],
        rect: { x: 5.6, y: 2.85, w: 4.6, h: 1.15 },
        tier: 3.2,
        baseGuests: 3,
        baseSeconds: 10,
        look: 'reef',
        unlock: { coins: unlockCoins(3.2, 70), reputation: 31 },
      },
      {
        name: 'Nazaré',
        guests: 'Pros only',
        conditions: 'Big waves',
        starterBuys: ['A rescue jet ski', 'A safety crew'],
        rect: { x: 10.3, y: 2.85, w: 3.1, h: 1.15 },
        tier: 4.8,
        baseGuests: 2,
        baseSeconds: 12,
        look: 'big',
        unlock: { coins: unlockCoins(4.8, 150), reputation: 260 },
      },
    ],
  },
  {
    id: 'skimboarding',
    noun: 'skimboarders',
    name: 'Skimboarding',
    icon: 'skim',
    area: 'wave',
    color: '#f2b134',
    guestKind: 'skimmer',
    unlock: { after: 'wave', level: 2, reputation: 12, coins: unlockCoins(1.6, 60) },
    guestColors: ['#ffb74d', '#4dd0e1', '#f06292', '#aed581', '#ba68c8'],
    terms: {
      capacity: 'More boards',
      price: 'Level up',
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
        rect: { x: 0.1, y: 1.7, w: 2.2, h: 1.1 },
        tier: 0.4,
        baseGuests: 4,
        baseSeconds: 7,
        look: 'shallows',
      },
      {
        name: 'Flatland',
        guests: 'Flatland riders',
        conditions: 'Wide, flat, wet sand with a thin layer of water',
        starterBuys: ['Flatland boards', 'A wet-sand track'],
        rect: { x: 2.35, y: 1.7, w: 2.2, h: 1.1 },
        tier: 1.4,
        baseGuests: 4,
        baseSeconds: 8,
        look: 'flat',
        unlock: { coins: unlockCoins(1.4, 25), reputation: 0, prevLevelUpgrades: 12 },
      },
      {
        name: 'Shore break',
        guests: 'Wave riders',
        conditions: 'Small, steep waves breaking close to the sand',
        starterBuys: ['Wave boards', 'A shore-break spotter'],
        rect: { x: 0.1, y: 2.85, w: 2.2, h: 1.15 },
        tier: 2.6,
        baseGuests: 3,
        baseSeconds: 9,
        look: 'shorebreak',
        unlock: { coins: unlockCoins(2.6, 70), reputation: 21 },
      },
      {
        name: 'Big shore break',
        guests: 'Pros only',
        conditions: 'Big, fast waves breaking right on the sand',
        starterBuys: ['Pro boards', 'A rescue crew on the sand'],
        rect: { x: 2.35, y: 2.85, w: 2.2, h: 1.15 },
        tier: 4.0,
        baseGuests: 2,
        baseSeconds: 11,
        look: 'bigbreak',
        unlock: { coins: unlockCoins(4.0, 150), reputation: 160 },
      },
    ],
  },
  {
    id: 'windsurfing',
    noun: 'windsurfers',
    name: 'Windsurfing',
    icon: 'wind',
    area: 'sea',
    color: '#1fb6c9',
    guestKind: 'windsurfer',
    guestColors: ['#26c6da', '#ffd54f', '#ff8a65', '#9ccc65', '#ba68c8'],
    terms: {
      capacity: 'More sails',
      price: 'Level up',
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
        rect: { x: 0.05, y: 4.05, w: 2.4, h: 1.1 },
        tier: 4.4,
        baseGuests: 4,
        baseSeconds: 7,
        look: 'flat',
      },
      {
        name: 'Freeride',
        guests: 'Windsurfers cruising back and forth',
        conditions: 'Steady wind and flat to slightly choppy water',
        starterBuys: ['Freeride sails', 'A bigger rigging park'],
        rect: { x: 2.55, y: 4.05, w: 2.4, h: 1.1 },
        tier: 5.4,
        baseGuests: 4,
        baseSeconds: 8,
        look: 'ripple',
        unlock: { coins: unlockCoins(5.4, 25), reputation: 0, prevLevelUpgrades: 12 },
      },
      {
        name: 'Speed and freestyle',
        guests: 'Fast riders and trick riders',
        conditions: 'Strong wind and choppy water',
        starterBuys: ['Speed boards', 'Freestyle sails'],
        rect: { x: 0.05, y: 5.2, w: 2.4, h: 1.1 },
        tier: 6.6,
        baseGuests: 3,
        baseSeconds: 9,
        look: 'chop',
        unlock: { coins: unlockCoins(6.6, 70), reputation: 280 },
      },
      {
        name: 'Wave zone',
        guests: 'Pros only',
        conditions: 'Strong wind and big waves',
        starterBuys: ['Wave sails', 'A rescue boat'],
        rect: { x: 2.55, y: 5.2, w: 2.4, h: 1.1 },
        tier: 7.8,
        baseGuests: 2,
        baseSeconds: 11,
        look: 'big',
        unlock: { coins: unlockCoins(7.8, 150), reputation: 1800 },
      },
    ],
  },
  {
    id: 'kitesurfing',
    noun: 'kitesurfers',
    name: 'Kitesurfing',
    icon: 'kite',
    area: 'sea',
    color: '#ff5c8a',
    guestKind: 'kiter',
    guestColors: ['#ff7043', '#ffca28', '#29b6f6', '#ec407a', '#66bb6a'],
    beachSite: { id: 'kite-launch', name: 'Kite launch area', rect: { x: 5.5, y: 0.9, w: 4, h: 0.6 } },
    terms: {
      capacity: 'More kite spots',
      price: 'Level up',
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
        rect: { x: 5.05, y: 4.05, w: 2.4, h: 1.1 },
        tier: 5.0,
        baseGuests: 4,
        baseSeconds: 8,
        look: 'flat',
      },
      {
        name: 'Freeride',
        guests: 'Riders on twin-tip boards',
        conditions: 'Steady wind and flat to slightly choppy water',
        starterBuys: ['Twin-tip boards', 'Bigger kites'],
        rect: { x: 7.55, y: 4.05, w: 2.4, h: 1.1 },
        tier: 6.0,
        baseGuests: 4,
        baseSeconds: 8,
        look: 'ripple',
        unlock: { coins: unlockCoins(6.0, 25), reputation: 0, prevLevelUpgrades: 12 },
      },
      {
        name: 'Freestyle and big air',
        guests: 'Riders who do tricks and big jumps',
        conditions: 'Strong wind and choppy water, with lots of open space',
        starterBuys: ['Big air kites', 'A jump judge'],
        rect: { x: 5.05, y: 5.2, w: 2.4, h: 1.1 },
        tier: 7.2,
        baseGuests: 3,
        baseSeconds: 10,
        look: 'chop',
        unlock: { coins: unlockCoins(7.2, 70), reputation: 410 },
      },
      {
        name: 'Big air and waves',
        guests: 'Pros only',
        conditions: 'Very strong wind and big waves',
        starterBuys: ['Pro kites', 'A rescue jet ski'],
        rect: { x: 7.55, y: 5.2, w: 2.4, h: 1.1 },
        tier: 8.4,
        baseGuests: 2,
        baseSeconds: 12,
        look: 'big',
        unlock: { coins: unlockCoins(8.4, 150), reputation: 2600 },
      },
    ],
  },
  {
    id: 'foil',
    noun: 'foilers',
    name: 'Foil and wing',
    icon: 'foil',
    area: 'sea',
    color: '#8e6bd8',
    guestKind: 'foiler',
    guestColors: ['#7e57c2', '#26c6da', '#ffa726', '#ec407a', '#9ccc65'],
    terms: {
      capacity: 'More foil boards',
      price: 'Level up',
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
        rect: { x: 10.05, y: 4.05, w: 2.4, h: 1.1 },
        tier: 5.6,
        baseGuests: 4,
        baseSeconds: 9,
        look: 'flat',
      },
      {
        name: 'Wing freeride',
        guests: 'Riders with a hand-held wing',
        conditions: 'Light wind and flat water',
        starterBuys: ['Hand-held wings', 'Smaller foils'],
        rect: { x: 12.55, y: 4.05, w: 2.4, h: 1.1 },
        tier: 6.6,
        baseGuests: 4,
        baseSeconds: 9,
        look: 'flat',
        unlock: { coins: unlockCoins(6.6, 25), reputation: 0, prevLevelUpgrades: 12 },
      },
      {
        name: 'Downwind',
        guests: 'Experienced riders who ride small ocean swells',
        conditions: 'Open water with long, rolling swell',
        starterBuys: ['Downwind foils', 'A chase boat'],
        rect: { x: 10.05, y: 5.2, w: 2.4, h: 1.1 },
        tier: 7.8,
        baseGuests: 3,
        baseSeconds: 11,
        look: 'swell',
        unlock: { coins: unlockCoins(7.8, 70), reputation: 600 },
      },
      {
        name: 'Pro arena',
        guests: 'Pros only',
        conditions: 'Big waves and strong wind',
        starterBuys: ['Pro foils', 'A rescue crew'],
        rect: { x: 12.55, y: 5.2, w: 2.4, h: 1.1 },
        tier: 9.0,
        baseGuests: 2,
        baseSeconds: 13,
        look: 'big',
        unlock: { coins: unlockCoins(9.0, 150), reputation: 3900 },
      },
    ],
  },
  {
    id: 'sailing',
    noun: 'sailors',
    name: 'Sailing',
    icon: 'sail',
    area: 'ocean',
    color: '#3f51b5',
    guestKind: 'sailor',
    guestColors: ['#ff7043', '#ffd54f', '#4fc3f7', '#f06292', '#aed581'],
    beachSite: { id: 'jetty', name: 'Jetty', rect: { x: 4.9, y: 0.9, w: 0.55, h: 2.2 } },
    terms: {
      capacity: 'More boats',
      price: 'Level up',
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
        rect: { x: 11.3, y: 6.5, w: 3.5, h: 1.4 },
        tier: 8.2,
        baseGuests: 4,
        baseSeconds: 8,
        look: 'flat',
      },
      {
        name: 'Boat hire',
        guests: 'Weekend sailors in dinghies and catamarans',
        conditions: 'Open water near the shore and steady wind',
        starterBuys: ['Dinghies and catamarans', 'A boat hire desk'],
        rect: { x: 7.6, y: 6.5, w: 3.5, h: 1.4 },
        tier: 9.4,
        baseGuests: 4,
        baseSeconds: 10,
        look: 'ripple',
        unlock: { coins: unlockCoins(9.4, 25), reputation: 0, prevLevelUpgrades: 12 },
      },
      {
        name: 'Club racing',
        guests: 'Racing sailors on faster boats',
        conditions: 'Open water, strong wind and a marked race course',
        starterBuys: ['Racing boats', 'Race course buoys'],
        rect: { x: 3.9, y: 6.5, w: 3.5, h: 1.4 },
        tier: 10.6,
        baseGuests: 3,
        baseSeconds: 12,
        look: 'chop',
        unlock: { coins: unlockCoins(10.6, 70), reputation: 3600 },
      },
      {
        name: 'Offshore regatta',
        guests: 'Pro crews, like the Volvo Ocean Race',
        conditions: 'Open sea, strong wind and big swell',
        starterBuys: ['An ocean racer', 'A support boat'],
        rect: { x: 0.2, y: 6.5, w: 3.5, h: 1.4 },
        tier: 11.8,
        baseGuests: 2,
        baseSeconds: 14,
        look: 'swell',
        unlock: { coins: unlockCoins(11.8, 150), reputation: 23000 },
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
