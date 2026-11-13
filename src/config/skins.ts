// Skins (docs/SKINS-PLAN.md, the author's choices): every section of every sport has 3 skins of its own (72 in all).
// A skin is a design on the section's main gear (the board for surfing and skimboarding, the sail for windsurfing and
// sailing, the kite, the wing). Boxes hold one piece each; 4 pieces unlock the look, 4 more give Bronze (+100%), 9
// more Silver (+500%). The skin a section wears boosts that section's income.

import type { AreaId } from './areas';
import { SPORTS, zoneId, type SportId } from './sports';

/** The rarities. 'club' is the Surf Club's monthly skins: never in a box, only for members (one each month). */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'club';
/** The rarities that come out of boxes. */
export type BoxRarity = Exclude<Rarity, 'club'>;
export const RARITIES: BoxRarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Frame colour and name of each rarity (the "?" lists the odds with these; the colours of the author's skin art). */
export const RARITY_LOOK: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Common', color: '#b8c4ce' },
  rare: { name: 'Rare', color: '#3d9bff' },
  epic: { name: 'Epic', color: '#c45cff' },
  legendary: { name: 'Legendary', color: '#ffb52e' },
  club: { name: 'Club', color: '#ff5c9a' },
};

/** How much faster a section's sessions go while it wears an unlocked skin of this rarity (the author's subtle Legendary touch). */
export const RARITY_SPEED: Record<Rarity, number> = { common: 1, rare: 1.1, epic: 1.25, legendary: 1.5, club: 1.5 };

/** Pieces needed to reach each tier, counted from 0, and the income boost of that tier. */
export const TIERS = [
  { name: 'Unlocked', pieces: 4, boost: 0 },
  { name: 'Bronze', pieces: 8, boost: 1 },
  { name: 'Silver', pieces: 17, boost: 5 },
];
export const MAX_PIECES = TIERS[TIERS.length - 1].pieces;

export type BoxKind = 'normal' | 'golden';

/** Odds (percent) per rarity of each box. Normal 50/36/10/4 so a rarer skin is always harder to complete (8 Epics against 24 Rares); golden is the author's 14/33/53. */
export const BOX_ODDS: Record<BoxKind, Record<BoxRarity, number>> = {
  normal: { common: 50, rare: 36, epic: 10, legendary: 4 },
  golden: { common: 0, rare: 14, epic: 33, legendary: 53 },
};

export const BOXES = {
  /** The coin box: the first one costs this, every next one 3x more, for good. */
  coinStart: 50_000,
  coinGrowth: 3,
  /** Gems for 3 normal boxes, and for one golden box. */
  threeGems: 20,
  goldenGems: 40,
};

/** The patterns the art can draw (see scene/rig/skinArt.ts). */
export type Pattern =
  | 'stripes'
  | 'dots'
  | 'flames'
  | 'camo'
  | 'checkers'
  | 'zebra'
  | 'lightning'
  | 'waves'
  | 'palms'
  | 'sunset'
  | 'split'
  | 'chevrons'
  | 'stars'
  | 'galaxy'
  | 'gold'
  | 'rainbow'
  | 'tiger'
  | 'hibiscus'
  | 'dragon'
  | 'money'
  | 'lava'
  | 'cosmic'
  | 'log'
  | 'coral'
  | 'dolphin'
  | 'lighthouse'
  | 'sardine'
  | 'swordfish'
  | 'puck'
  | 'football'
  | 'dartboard'
  | 'diagonal'
  | 'sunny'
  | 'carrot'
  | 'rocket'
  | 'racing'
  | 'bolt'
  | 'cosmos'
  | 'pinkSail'
  | 'starMoon'
  | 'leafSail'
  | 'watermelon'
  | 'iceCream'
  | 'swan'
  | 'chequered'
  | 'retroRacer'
  | 'compass'
  | 'champion'
  | 'viking'
  | 'lemonade'
  | 'matchday'
  | 'crocodile'
  | 'deepBlue'
  | 'cherryPop'
  | 'batWing'
  | 'ember'
  | 'mondrian'
  | 'goodBoy'
  | 'holland'
  | 'blossom'
  | 'jackpot'
  | 'tigerSkin'
  | 'mouse'
  | 'shark'
  | 'seagull'
  | 'pirate'
  | 'bands'
  | 'starry'
  | 'banana'
  | 'road'
  | 'ghost'
  // figures: they take the place of the gear (a bunch of balloons instead of a kite)
  | 'balloons'
  | 'gull'
  | 'falcon'
  | 'wingDragon'
  | 'cherry'
  | 'cherryBands'
  | 'drops'
  | 'inferno'
  | 'orca'
  | 'redDots'
  | 'leopard'
  | 'sharkRide'
  // the author's dad's windsurf sail of 1990 (and its board)
  | 'dad90'
  // the freestyle windsurf Legendary: a crescent-moon sail on a galaxy board
  | 'moon'
  // the windsurf designs by the author's friend (each brings its own board)
  | 'windSun'
  | 'windCamo'
  | 'jungle'
  | 'tigerRace'
  | 'checkerWind'
  | 'driftwood'
  | 'polka'
  | 'hearts'
  | 'fruit'
  | 'bigFish'
  // the Surf Club's monthly skins by the author's friend
  | 'phoenix'
  | 'xmasTree'
  | 'kite2027'
  | 'rose'
  | 'stPatrick';

export interface SkinDef {
  id: string;
  name: string;
  /** The section (zone) it belongs to, and its sport. */
  zone: string;
  sport: SportId;
  level: number;
  rarity: Rarity;
  pattern: Pattern;
  /** Base, second and detail colour. */
  colors: [string, string, string];
  /** The skin also has a design for the board or boat (the 1990 windsurf set; the sailing school's boats and rafts). */
  board?: boolean;
}

/** Rarity by area (the author's choice): the wave sports are Common, the sea sports Rare, sailing (the ocean) Epic. On top of that every section has one Legendary: its last skin. */
const RARITY_BY_AREA: Record<AreaId, Rarity> = { beach: 'common', wave: 'common', sea: 'rare', ocean: 'epic' };

/** Every design (pattern, colours, name). The author's skin art: flames, camo, lightning, hibiscus, seagull and shark are Rare; dragon and money Epic; the cosmic gold board and the fire dragon Legendary. */
const DESIGNS = {
  stripes: { pattern: 'stripes', colors: ['#ffffff', '#ff7043', '#2a3a4c'], name: 'Beach Stripes' },
  sprinkles: { pattern: 'dots', colors: ['#fff3c4', '#ff5fa2', '#3fc3ff'], name: 'Sprinkles' },
  mint: { pattern: 'split', colors: ['#4be07a', '#ffffff', '#2a3a4c'], name: 'Mint Split' },
  checkers: { pattern: 'checkers', colors: ['#ffffff', '#2a3a4c', '#ffd23f'], name: 'Checkers' },
  waves: { pattern: 'waves', colors: ['#bdeefb', '#1f8aa6', '#ffffff'], name: 'Little Waves' },
  arrows: { pattern: 'chevrons', colors: ['#ffd23f', '#ff7043', '#ffffff'], name: 'Arrows' },
  retro: { pattern: 'stripes', colors: ['#7e57c2', '#26c6da', '#ffffff'], name: 'Retro Lines' },
  flames: { pattern: 'flames', colors: ['#ffd23f', '#ff5a1f', '#d81b1b'], name: 'Flames' },
  camo: { pattern: 'camo', colors: ['#6b7d3a', '#3d4a22', '#a3a86a'], name: 'Camo' },
  lightning: { pattern: 'lightning', colors: ['#1e6fe0', '#ffffff', '#8fd3ff'], name: 'Lightning' },
  hibiscus: { pattern: 'hibiscus', colors: ['#3fd0b0', '#ff3d7f', '#ffd23f'], name: 'Hibiscus' },
  palmSunset: { pattern: 'sunset', colors: ['#ff4f8b', '#ff9a3c', '#ffd23f'], name: 'Palm Sunset' },
  zebra: { pattern: 'zebra', colors: ['#ffffff', '#1b1f24', '#ff5fa2'], name: 'Zebra' },
  seagull: { pattern: 'seagull', colors: ['#ffffff', '#8a98a6', '#ffb300'], name: 'Seagull' },
  shark: { pattern: 'shark', colors: ['#7f93a8', '#e8eef3', '#1b1f24'], name: 'Shark' },
  dragon: { pattern: 'dragon', colors: ['#17110f', '#d32f2f', '#ffc83d'], name: 'Dragon' },
  money: { pattern: 'money', colors: ['#3f9a4a', '#a5d6a7', '#1b5e20'], name: 'Money' },
  lava: { pattern: 'lava', colors: ['#3b0d06', '#ff5a1f', '#ffd23f'], name: 'Lava' },
  tiger: { pattern: 'tiger', colors: ['#ff9800', '#1b1f24', '#ffffff'], name: 'Tiger' },
  neon: { pattern: 'chevrons', colors: ['#00e5ff', '#d500f9', '#1b1f24'], name: 'Neon' },
  blueFire: { pattern: 'flames', colors: ['#0d47a1', '#00b8ff', '#ffffff'], name: 'Blue Fire' },
  cosmic: { pattern: 'cosmic', colors: ['#2a0f5c', '#b04dff', '#ffd54f'], name: 'Cosmic' },
  fireDragon: { pattern: 'dragon', colors: ['#ffb300', '#d32f2f', '#4a1204'], name: 'Fire Dragon' },
  golden: { pattern: 'gold', colors: ['#ffd54f', '#b8860b', '#fffde7'], name: 'Golden' },
  galaxy: { pattern: 'galaxy', colors: ['#1a0b3d', '#7c4dff', '#ffffff'], name: 'Galaxy' },
  rainbow: { pattern: 'rainbow', colors: ['#ff5252', '#ffd740', '#40c4ff'], name: 'Rainbow' },
  nightSky: { pattern: 'stars', colors: ['#0b1d3a', '#ffd54f', '#ffffff'], name: 'Night Sky' },
  // the kitesurfing designs by the author's friend (Kite school, Freeride, Freestyle and big air, Big air and waves)
  kiteSunny: { pattern: 'bands', colors: ['#ffd23f', '#3d8fe0', '#9fd8ff'], name: 'Sunny', rarity: 'common' },
  kiteStars: { pattern: 'starry', colors: ['#1f2f6b', '#2a3d80', '#f2c94c'], name: 'Starry' },
  // the surfing designs by the author's friend (Beginner class, Longboarders)
  drops: { pattern: 'drops', colors: ['#3f8fe0', '#a8dcff', '#1f5fa8'], name: 'Water Drop' },
  inferno: { pattern: 'inferno', colors: ['#15100e', '#c81e10', '#ffb300'], name: 'Flames' },
  orca: { pattern: 'orca', colors: ['#16181d', '#f4f6f8', '#3a414c'], name: 'Orca' },
  redDots: { pattern: 'redDots', colors: ['#f2491c', '#fffaf0', '#d3240f'], name: 'Mushroom' },
  leopard: { pattern: 'leopard', colors: ['#e0a94e', '#2e1d0c', '#b5762a'], name: 'Panther' },
  log: { pattern: 'log', colors: ['#c98a4a', '#8a5426', '#4a2a12'], name: 'Log' },
  coral: { pattern: 'coral', colors: ['#f4e1bd', '#ff6f91', '#d9b98a'], name: 'Coral' },
  dolphin: { pattern: 'dolphin', colors: ['#6f8597', '#b9c8d4', '#45576a'], name: 'Dolphin' },
  lighthouse: { pattern: 'lighthouse', colors: ['#d62828', '#fbfbf8', '#ffd54a'], name: 'Lighthouse' },
  sardine: { pattern: 'sardine', colors: ['#2e5f7c', '#e3ebf0', '#93b4c6'], name: 'Sardine' },
  swordfish: { pattern: 'swordfish', colors: ['#2d3f6e', '#8fa0c2', '#3a4150'], name: 'Swordfish' },
  // the skimboard designs by the author's friend (Shallows, Flatland, Shore break, Big shore break)
  puck: { pattern: 'puck', colors: ['#1c1e23', '#dccba4', '#2e323b'], name: 'Puck' },
  football: { pattern: 'football', colors: ['#f7f7f5', '#1c1d21', '#c9ccd2'], name: 'Football' },
  dartboard: { pattern: 'dartboard', colors: ['#18181a', '#f1e6c8', '#d0312d'], name: 'Dartboard' },
  tangerine: { pattern: 'diagonal', colors: ['#ff8a1f', '#ffd23f', '#e0601a'], name: 'Tangerine' },
  carrot: { pattern: 'carrot', colors: ['#ff8a2a', '#e2600e', '#3f9a3a'], name: 'Carrot' },
  rocket: { pattern: 'rocket', colors: ['#f2f4f7', '#d8312b', '#2f5fb3'], name: 'Rocket' },
  racing: { pattern: 'racing', colors: ['#2a6fd6', '#ffffff', '#e0322f'], name: 'Racing Stripes' },
  bolt: { pattern: 'bolt', colors: ['#20275a', '#ffd23f', '#11163a'], name: 'Lightning' },
  cosmos: { pattern: 'cosmos', colors: ['#120a33', '#7b3fe4', '#ffb347'], name: 'Cosmos' },
  sunny: { pattern: 'sunny', colors: ['#ffcf2e', '#ff9a1f', '#e0262c'], name: 'Sunny' },
  tigerSkin: { pattern: 'tigerSkin', colors: ['#ffa41f', '#141414', '#e45a0c'], name: 'Tiger' },
  mouse: { pattern: 'mouse', colors: ['#9aa0a8', '#f2a7b4', '#ffffff'], name: 'Mouse' },
  // the sailing school designs by the author's friend: each brings its own boat (drawn over the Optimist)
  bubblegum: { pattern: 'pinkSail', colors: ['#ff7eb6', '#ffd1e6', '#e0508f'], name: 'Bubblegum', board: true },
  nightRaft: { pattern: 'starMoon', colors: ['#1d2a66', '#ffd23f', '#2f3f8f'], name: 'Night Raft', board: true },
  leafRaft: { pattern: 'leafSail', colors: ['#4fb144', '#2e7d32', '#a5d86a'], name: 'Leaf Raft', board: true },
  // the Boat hire, Club racing and Offshore regatta designs: each brings its own boat (dinghy, catamaran or yacht)
  watermelon: { pattern: 'watermelon', colors: ['#ef3b4f', '#1d1d1d', '#2f9e44'], name: 'Watermelon', board: true },
  iceCream: { pattern: 'iceCream', colors: ['#ffb3c7', '#fff1cf', '#bfe8a8'], name: 'Ice Cream', board: true },
  swan: { pattern: 'swan', colors: ['#fbfbfa', '#d9dde3', '#ff8f1f'], name: 'Swan', board: true },
  chequered: { pattern: 'chequered', colors: ['#ffffff', '#1b1b1e', '#c9ccd2'], name: 'Chequered Flag', board: true },
  retroRacer: { pattern: 'retroRacer', colors: ['#e0262c', '#ffffff', '#14161a'], name: 'Retro Racer', board: true },
  pirateShip: { pattern: 'pirate', colors: ['#15171c', '#ffffff', '#ffc83d'], name: 'Pirate', board: true },
  compass: { pattern: 'compass', colors: ['#1c2c55', '#ffc83d', '#2c4380'], name: 'Compass', board: true },
  champion: { pattern: 'champion', colors: ['#ffd54f', '#b8860b', '#fffde7'], name: 'Champion', board: true },
  viking: { pattern: 'viking', colors: ['#c62828', '#f5f0e6', '#6b4423'], name: 'Viking', board: true },
  // the wing designs by the author's friend (Foil school with its boards, Wing freeride, Downwind, Pro arena)
  lemonade: { pattern: 'lemonade', colors: ['#1f3a6e', '#ffcf2e', '#2e4f8f'], name: 'Lemonade' },
  matchday: { pattern: 'matchday', colors: ['#e8302d', '#ffffff', '#a51b18'], name: 'Matchday', board: true },
  crocodile: { pattern: 'crocodile', colors: ['#3f8f3a', '#2f6e2c', '#a7d36a'], name: 'Crocodile' },
  deepBlue: { pattern: 'deepBlue', colors: ['#143a8c', '#2ab3e6', '#0e2a66'], name: 'Deep Blue' },
  cherryPop: { pattern: 'cherryPop', colors: ['#c9445e', '#e06a80', '#9c2c44'], name: 'Cherry Pop' },
  batWing: { pattern: 'batWing', colors: ['#3a3d44', '#1f2126', '#5a5e68'], name: 'Bat' },
  ember: { pattern: 'ember', colors: ['#8e1b22', '#f7941d', '#e3711a'], name: 'Ember' },
  mondrian: { pattern: 'mondrian', colors: ['#f7f5ee', '#16161a', '#d6262b'], name: 'Mondrian' },
  goodBoy: { pattern: 'goodBoy', colors: ['#e6e8eb', '#5f656d', '#f2c230'], name: 'Good Boy' },
  holland: { pattern: 'holland', colors: ['#ae1c28', '#ffffff', '#21468b'], name: 'Holland' },
  blossom: { pattern: 'blossom', colors: ['#1c2b52', '#f48fb1', '#ffffff'], name: 'Blossom' },
  jackpot: { pattern: 'jackpot', colors: ['#2e8b3e', '#e0a800', '#a8e0a0'], name: 'Jackpot' },
  sharkRide: { pattern: 'sharkRide', colors: ['#5d6b78', '#9aa8b4', '#ffffff'], name: 'Shark Ride' },
  // a friend's idea: a wing in red, green and black bands with a pair of cherries in the middle
  cherryWing: { pattern: 'cherryBands', colors: ['#d81e2c', '#1f8a3a', '#15171c'], name: 'Cherry' },
  balloons: { pattern: 'balloons', colors: ['#e53935', '#fdd835', '#1e88e5'], name: 'Balloons' },
  kiteLime: { pattern: 'bands', colors: ['#5cc85a', '#3d8fe0', '#b8f0a0'], name: 'Lime', rarity: 'common' },
  banana: { pattern: 'banana', colors: ['#ffe14d', '#e3b21b', '#5a3a1a'], name: 'Banana' },
  gull: { pattern: 'gull', colors: ['#f5f7f8', '#aab4bd', '#ffb300'], name: 'Seagull' },
  kitePurple: { pattern: 'bands', colors: ['#3b8be8', '#8a3fd1', '#b9a2ff'], name: 'Purple Rain', rarity: 'common' },
  road: { pattern: 'road', colors: ['#4a4f55', '#ffffff', '#d32f2f'], name: 'Highway' },
  falcon: { pattern: 'falcon', colors: ['#7a6e64', '#4b4038', '#ffc107'], name: 'Falcon' },
  bumblebee: { pattern: 'bands', colors: ['#ffd23f', '#1b1f24', '#ffe98a'], name: 'Bumblebee', rarity: 'common' },
  ghost: { pattern: 'ghost', colors: ['#f4f6f8', '#d3dae0', '#15171c'], name: 'Ghost' },
  wingDragon: { pattern: 'wingDragon', colors: ['#c62828', '#2e7d32', '#ffcc66'], name: 'Sky Dragon' },
  // the author's dad's wave gear of 1990: a multicolour sail with a window, and a sun-faded cream wave board with striped deck pads
  dad90: { pattern: 'dad90', colors: ['#ffa726', '#e8338f', '#29a8e0'], name: '1990 Classic', board: true },
  // the author's freestyle windsurf Legendary: the sail a crescent moon with its craters, the board the Milky Way
  moon: { pattern: 'moon', colors: ['#b9bcc1', '#eef0f2', '#6c7076'], name: 'Moonlight', board: true },
  // the windsurf designs by the author's friend (Beginner class, Slalom, Freestyle, Wave zone): each brings its own board
  windSun: { pattern: 'windSun', colors: ['#ffd23f', '#2f86e0', '#1d5fae'], name: 'Sunshine', board: true },
  windCamo: { pattern: 'windCamo', colors: ['#5aae4a', '#6b7d3a', '#3d4a22'], name: 'Camo', board: true },
  jungle: { pattern: 'jungle', colors: ['#2f5a24', '#4f8a34', '#1b3315'], name: 'Jungle Snake', board: true },
  tigerRace: { pattern: 'tigerRace', colors: ['#16171a', '#ff8a1a', '#e0262c'], name: 'Tiger Stripes', board: true },
  checkerWind: { pattern: 'checkerWind', colors: ['#ffffff', '#141416', '#c9ccd2'], name: 'Chequered', board: true },
  driftwood: { pattern: 'driftwood', colors: ['#8a5a32', '#4f9a34', '#5a3a1e'], name: 'Driftwood', board: true },
  polka: { pattern: 'polka', colors: ['#ffffff', '#ffcf2e', '#2f7fd6'], name: 'Polka Dots', board: true },
  hearts: { pattern: 'hearts', colors: ['#ffffff', '#e0262c', '#1b1b1e'], name: 'Eight of Hearts', board: true },
  fruit: { pattern: 'fruit', colors: ['#3f9a3a', '#ff8a1f', '#2a7a2a'], name: 'Fruit Salad', board: true },
  bigFish: { pattern: 'bigFish', colors: ['#3f7fd0', '#8fc0f0', '#24508f'], name: 'Blue Fish', board: true },
  thunder: { pattern: 'lightning', colors: ['#1b1f24', '#ffd54f', '#ff5a1f'], name: 'Thunder' },
  platinum: { pattern: 'gold', colors: ['#e0e0e0', '#9e9e9e', '#ffffff'], name: 'Platinum' },
  pirate: { pattern: 'pirate', colors: ['#15171c', '#ffffff', '#ffc83d'], name: 'Pirate Gold' },
} satisfies Record<
  string,
  { pattern: Pattern; colors: [string, string, string]; name: string; /** A rarity of its own instead of the area's (the author's choice). */ rarity?: Rarity; board?: boolean }
>;
type DesignId = keyof typeof DESIGNS;

/** The three designs of every section, per sport and section (school first). No design repeats inside a sport. The last design of every section is its Legendary. */
const SETS: Record<SportId, [DesignId, DesignId, DesignId][]> = {
  wave: [
    ['drops', 'inferno', 'orca'],
    ['redDots', 'leopard', 'sharkRide'],
    ['log', 'coral', 'dolphin'],
    ['lighthouse', 'sardine', 'swordfish'],
  ],
  skimboarding: [
    ['puck', 'football', 'dartboard'],
    ['tangerine', 'carrot', 'rocket'],
    ['racing', 'bolt', 'cosmos'],
    ['sunny', 'tigerSkin', 'mouse'],
  ],
  windsurfing: [
    ['windSun', 'windCamo', 'jungle'],
    ['tigerRace', 'checkerWind', 'driftwood'],
    ['polka', 'hearts', 'moon'],
    ['dad90', 'fruit', 'bigFish'],
  ],
  kitesurfing: [
    ['kiteSunny', 'kiteStars', 'balloons'],
    ['kiteLime', 'banana', 'gull'],
    ['kitePurple', 'road', 'falcon'],
    ['bumblebee', 'ghost', 'wingDragon'],
  ],
  foil: [
    ['lemonade', 'matchday', 'crocodile'],
    ['deepBlue', 'cherryPop', 'batWing'],
    ['ember', 'mondrian', 'goodBoy'],
    ['holland', 'blossom', 'jackpot'],
  ],
  sailing: [
    ['bubblegum', 'nightRaft', 'leafRaft'],
    ['watermelon', 'iceCream', 'swan'],
    ['chequered', 'retroRacer', 'pirateShip'],
    ['compass', 'champion', 'viking'],
  ],
};

/** The 72 skins: 3 per section, in sport and section order. */
export const SKINS: SkinDef[] = SPORTS.flatMap((sport) =>
  sport.levels.flatMap((_, li) => {
    const level = li + 1;
    return SETS[sport.id][li].map((key, k) => {
      const d = DESIGNS[key];
      return {
        id: `${sport.id}-${level}-${k + 1}`,
        name: d.name,
        zone: zoneId(sport.id, level),
        sport: sport.id,
        level,
        rarity: k === 2 ? 'legendary' : (('rarity' in d ? d.rarity : undefined) ?? RARITY_BY_AREA[sport.area]),
        pattern: d.pattern,
        colors: [...d.colors] as [string, string, string],
        ...('board' in d && d.board ? { board: true } : {}),
      };
    });
  }),
);

/** The skin the first four boxes of a game always make: the first Common of the surf school. */
export const STARTER_SKIN: SkinDef = SKINS.find((s) => s.rarity === 'common')!;

/** A Surf Club monthly skin: the month it is given in (YYYY-MM, the real date). */
export interface ClubSkinDef extends SkinDef {
  month: string;
}

/**
 * The Surf Club's monthly skins (the author's friend's designs): on the 1st of its month every member gets that month's
 * skin, complete (Silver). Never in a box; a missed month is gone. Each one belongs to a section and is worn there.
 */
const CLUB_MONTHS: { month: string; sport: SportId; level: number; pattern: Pattern; colors: [string, string, string]; name: string; board?: boolean }[] = [
  { month: '2026-11', sport: 'kitesurfing', level: 4, pattern: 'phoenix', colors: ['#d98a36', '#ffd27a', '#7a3a12'], name: 'Thanksgiving' },
  { month: '2026-12', sport: 'wave', level: 4, pattern: 'xmasTree', colors: ['#2f8a3a', '#56b04a', '#1d5a26'], name: 'Christmas Tree' },
  { month: '2027-01', sport: 'kitesurfing', level: 1, pattern: 'kite2027', colors: ['#1c2a6e', '#ffc83d', '#2d3f94'], name: '2027' },
  { month: '2027-02', sport: 'skimboarding', level: 1, pattern: 'rose', colors: ['#1b1c20', '#d9262c', '#d4a63a'], name: 'Rose' },
  { month: '2027-03', sport: 'windsurfing', level: 2, pattern: 'stPatrick', colors: ['#2f3236', '#f2c230', '#2f9e44'], name: "St. Patrick's", board: true },
];

export const CLUB_SKINS: ClubSkinDef[] = CLUB_MONTHS.map((m) => ({
  id: `club-${m.month}`,
  name: m.name,
  zone: zoneId(m.sport, m.level),
  sport: m.sport,
  level: m.level,
  rarity: 'club',
  pattern: m.pattern,
  colors: m.colors,
  month: m.month,
  ...(m.board ? { board: true } : {}),
}));

export function skinById(id: string): SkinDef | undefined {
  return SKINS.find((s) => s.id === id) ?? CLUB_SKINS.find((s) => s.id === id);
}

export function skinsOfZone(zone: string): SkinDef[] {
  return SKINS.filter((s) => s.zone === zone);
}
