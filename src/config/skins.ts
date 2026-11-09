// Skins (docs/SKINS-PLAN.md, the author's choices): every section of every sport has 3 skins of its own (72 in all).
// A skin is a design on the section's main gear (the board for surfing and skimboarding, the sail for windsurfing and
// sailing, the kite, the wing). Boxes hold one piece each; 4 pieces unlock the look, 4 more give Bronze (+100%), 9
// more Silver (+500%). The skin a section wears boosts that section's income.

import type { AreaId } from './areas';
import { SPORTS, zoneId, type SportId } from './sports';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** Frame colour and name of each rarity (the "?" lists the odds with these; the colours of the author's skin art). */
export const RARITY_LOOK: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Common', color: '#b8c4ce' },
  rare: { name: 'Rare', color: '#3d9bff' },
  epic: { name: 'Epic', color: '#c45cff' },
  legendary: { name: 'Legendary', color: '#ffb52e' },
};

/** Pieces needed to reach each tier, counted from 0, and the income boost of that tier. */
export const TIERS = [
  { name: 'Unlocked', pieces: 4, boost: 0 },
  { name: 'Bronze', pieces: 8, boost: 1 },
  { name: 'Silver', pieces: 17, boost: 5 },
];
export const MAX_PIECES = TIERS[TIERS.length - 1].pieces;

export type BoxKind = 'normal' | 'golden';

/** Odds (percent) per rarity of each box. Normal 50/36/10/4 so a rarer skin is always harder to complete (8 Epics against 24 Rares); golden is the author's 14/33/53. */
export const BOX_ODDS: Record<BoxKind, Record<Rarity, number>> = {
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
  | 'shark'
  | 'seagull'
  | 'pirate';

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
  thunder: { pattern: 'lightning', colors: ['#1b1f24', '#ffd54f', '#ff5a1f'], name: 'Thunder' },
  platinum: { pattern: 'gold', colors: ['#e0e0e0', '#9e9e9e', '#ffffff'], name: 'Platinum' },
  pirate: { pattern: 'pirate', colors: ['#15171c', '#ffffff', '#ffc83d'], name: 'Pirate Gold' },
} satisfies Record<string, { pattern: Pattern; colors: [string, string, string]; name: string }>;
type DesignId = keyof typeof DESIGNS;

/** The three designs of every section, per sport and section (school first). No design repeats inside a sport. The last design of every section is its Legendary. */
const SETS: Record<SportId, [DesignId, DesignId, DesignId][]> = {
  wave: [
    ['stripes', 'sprinkles', 'golden'],
    ['waves', 'camo', 'rainbow'],
    ['flames', 'lightning', 'dragon'],
    ['money', 'tiger', 'cosmic'],
  ],
  skimboarding: [
    ['checkers', 'mint', 'platinum'],
    ['arrows', 'palmSunset', 'galaxy'],
    ['zebra', 'neon', 'lava'],
    ['dragon', 'retro', 'golden'],
  ],
  windsurfing: [
    ['stripes', 'arrows', 'rainbow'],
    ['waves', 'lightning', 'nightSky'],
    ['flames', 'hibiscus', 'fireDragon'],
    ['money', 'blueFire', 'thunder'],
  ],
  kitesurfing: [
    ['sprinkles', 'mint', 'golden'],
    ['seagull', 'shark', 'cosmic'],
    ['lava', 'lightning', 'money'],
    ['neon', 'retro', 'fireDragon'],
  ],
  foil: [
    ['checkers', 'sprinkles', 'platinum'],
    ['arrows', 'hibiscus', 'nightSky'],
    ['flames', 'camo', 'dragon'],
    ['money', 'tiger', 'cosmic'],
  ],
  sailing: [
    ['waves', 'stripes', 'golden'],
    ['mint', 'palmSunset', 'galaxy'],
    ['zebra', 'lightning', 'money'],
    ['dragon', 'blueFire', 'pirate'],
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
        rarity: k === 2 ? 'legendary' : RARITY_BY_AREA[sport.area],
        pattern: d.pattern,
        colors: [...d.colors] as [string, string, string],
      };
    });
  }),
);

/** The skin the first four boxes of a game always make: the first Common of the surf school. */
export const STARTER_SKIN: SkinDef = SKINS.find((s) => s.rarity === 'common')!;

export function skinById(id: string): SkinDef | undefined {
  return SKINS.find((s) => s.id === id);
}

export function skinsOfZone(zone: string): SkinDef[] {
  return SKINS.filter((s) => s.zone === zone);
}
