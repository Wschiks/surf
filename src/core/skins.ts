// Skins and boxes (docs/SKINS-PLAN.md). Pure game logic, no Phaser.
// Boxes are the second random thing in the game (the author's choice, like the banner plane): what a box gives is
// drawn with the odds in config/skins.ts, from a random generator kept in the save (so a reload cannot reroll it).

import { BOX_ODDS, BOXES, CLUB_SKINS, MAX_PIECES, RARITIES, RARITY_SPEED, SKINS, skinById, type ClubSkinDef, STARTER_SKIN, TIERS, type BoxKind, type BoxRarity, type SkinDef } from '../config/skins';
import type { GameState } from './state';

export interface SkinState {
  /** Pieces collected per skin. */
  pieces: Record<string, number>;
  /** The skin each section (zone id) wears. */
  worn: Record<string, string>;
  /** Unopened boxes. */
  boxes: number;
  golden: number;
  /** Coin boxes bought so far (each next one costs 3x more, for good). */
  coinBoxes: number;
  /** Boxes opened so far (the first four are fixed: they make one surf school skin). */
  opened: number;
  /** State of the random generator. */
  seed: number;
  /** When the next free box from an ad can be had (ms since 1970). */
  adNext: number;
}

export function newSkins(): SkinState {
  return { pieces: {}, worn: {}, boxes: 0, golden: 0, coinBoxes: 0, opened: 0, seed: 0x5eed5, adNext: 0 };
}

/** Fill in a save made before skins existed. */
export function ensureSkins(state: GameState) {
  const s = (state.skins ??= newSkins());
  s.pieces ??= {};
  s.worn ??= {};
  s.boxes ??= 0;
  s.golden ??= 0;
  s.coinBoxes ??= 0;
  s.opened ??= 0;
  s.seed ??= 0x5eed5;
  s.adNext ??= 0;
}

/** Next random number 0..1 (kept in the save). */
function random(state: GameState): number {
  const s = state.skins;
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

/** 0 = not unlocked, 1 = unlocked, 2 = Bronze, 3 = Silver. */
export function tierOf(pieces: number): number {
  let t = 0;
  for (const tier of TIERS) if (pieces >= tier.pieces) t++;
  return t;
}

/** The income boost of a tier: +0 unlocked, +100% Bronze, +500% Silver. */
export function tierBoost(tier: number): number {
  return tier <= 0 ? 0 : TIERS[tier - 1].boost;
}

/** Pieces of a skin and what the next tier needs (null at the top). */
export function skinProgress(state: GameState, id: string): { pieces: number; tier: number; from: number; to: number | null } {
  const pieces = state.skins.pieces[id] ?? 0;
  const tier = tierOf(pieces);
  const from = tier === 0 ? 0 : TIERS[tier - 1].pieces;
  const to = tier >= TIERS.length ? null : TIERS[tier].pieces;
  return { pieces, tier, from, to };
}

/** Income boost of a section from the skin it wears (0 = none). */
export function skinBoost(state: GameState, zone: string): number {
  const id = state.skins?.worn[zone];
  if (!id) return 0;
  return tierBoost(tierOf(state.skins.pieces[id] ?? 0));
}

/** Speed of a section from the rarity of the skin it wears: its sessions go this many times faster (1 = none). */
export function skinSpeed(state: GameState, zone: string): number {
  const id = state.skins?.worn[zone];
  const skin = id ? skinById(id) : undefined;
  if (!skin || tierOf(state.skins.pieces[skin.id] ?? 0) < 1) return 1;
  return RARITY_SPEED[skin.rarity];
}

export interface BoxResult {
  skin: SkinDef;
  before: number;
  after: number;
  /** The tier went up with this piece (1 = the look is unlocked). */
  newTier: number | null;
}

/** Draw a rarity with the odds of a box. */
function drawRarity(state: GameState, kind: BoxKind): BoxRarity {
  const odds = BOX_ODDS[kind];
  let r = random(state) * 100;
  for (const rarity of RARITIES) {
    r -= odds[rarity];
    if (r < 0) return rarity;
  }
  return 'legendary';
}

/**
 * Open one box: one piece of a skin. A piece is never wasted: it always goes to a skin that is not at its top tier yet
 * (when every skin of the drawn rarity is done, the nearest rarity with room takes it). The first four boxes of a game
 * always make the first surf school skin, so the player sees "4 pieces = a new look" straight away.
 */
export function openBox(state: GameState, kind: BoxKind): BoxResult | null {
  const s = state.skins;
  if (kind === 'golden' ? s.golden <= 0 : s.boxes <= 0) return null;
  if (kind === 'golden') s.golden--;
  else s.boxes--;
  let skin: SkinDef | undefined;
  if (s.opened < 4 && kind === 'normal') skin = STARTER_SKIN;
  else {
    const want = RARITIES.indexOf(drawRarity(state, kind));
    // the drawn rarity first, then the ones next to it (higher first)
    const order = [0, 1, -1, 2, -2, 3, -3].map((d) => want + d).filter((i) => i >= 0 && i < RARITIES.length);
    for (const i of order) {
      const open = SKINS.filter((k) => k.rarity === RARITIES[i] && (s.pieces[k.id] ?? 0) < MAX_PIECES);
      if (open.length) {
        skin = open[Math.floor(random(state) * open.length)];
        break;
      }
    }
  }
  s.opened++;
  if (!skin) return null; // everything complete: nothing left to give
  const before = s.pieces[skin.id] ?? 0;
  const after = before + 1;
  s.pieces[skin.id] = after;
  const newTier = tierOf(after) > tierOf(before) ? tierOf(after) : null;
  // a new look is put on straight away when the section wears nothing yet (or something with a lower tier)
  const worn = s.worn[skin.zone];
  if (newTier && (!worn || tierOf(s.pieces[worn] ?? 0) < tierOf(after))) s.worn[skin.zone] = skin.id;
  return { skin, before, after, newTier };
}

/** Wear an unlocked skin in its section (or take it off with the same id). */
export function wearSkin(state: GameState, id: string): boolean {
  const skin = skinById(id);
  if (!skin || tierOf(state.skins.pieces[id] ?? 0) < 1) return false;
  if (state.skins.worn[skin.zone] === id) delete state.skins.worn[skin.zone];
  else state.skins.worn[skin.zone] = id;
  return true;
}

/** Price of the next coin box: 50K, then 3x more every time, for good. */
export function coinBoxPrice(state: GameState): number {
  return BOXES.coinStart * Math.pow(BOXES.coinGrowth, state.skins.coinBoxes);
}

export function buyCoinBox(state: GameState): boolean {
  const price = coinBoxPrice(state);
  if (state.coins < price) return false;
  state.coins -= price;
  state.skins.coinBoxes++;
  state.skins.boxes++;
  return true;
}

/** Spend gems on boxes: 3 normal boxes, or one golden box. */
export function buyGemBoxes(state: GameState, kind: 'three' | 'golden'): boolean {
  const price = kind === 'three' ? BOXES.threeGems : BOXES.goldenGems;
  if (state.skillPoints < price) return false;
  state.skillPoints -= price;
  if (kind === 'three') state.skins.boxes += 3;
  else state.skins.golden++;
  return true;
}

/** Testing only: every skin gets at least the pieces to unlock its look. */
export function unlockAllSkins(state: GameState) {
  const need = TIERS[0].pieces;
  for (const k of SKINS) if ((state.skins.pieces[k.id] ?? 0) < need) state.skins.pieces[k.id] = need;
}

/**
 * Give fixed pieces of one skin (the daily calendar's star days). They add to what the skin has, up to the top tier; a
 * new look is put on like a box's. Returns null when the skin is already complete (the caller gives something else).
 */
export function givePieces(state: GameState, id: string, n: number): BoxResult | null {
  const skin = skinById(id);
  const s = state.skins;
  const before = s.pieces[id] ?? 0;
  if (!skin || before >= MAX_PIECES) return null;
  const after = Math.min(MAX_PIECES, before + n);
  s.pieces[id] = after;
  const newTier = tierOf(after) > tierOf(before) ? tierOf(after) : null;
  const worn = s.worn[skin.zone];
  if (newTier && (!worn || tierOf(s.pieces[worn] ?? 0) < tierOf(after))) s.worn[skin.zone] = id;
  return { skin, before, after, newTier };
}

/** A free box (a quest, a new section, an ad). */
export function giveBox(state: GameState, n = 1) {
  state.skins.boxes += n;
}

/** How much of the collection is unlocked, and how many skins there are. */
export function collectionCount(state: GameState): { unlocked: number; total: number } {
  return { unlocked: SKINS.filter((k) => tierOf(state.skins.pieces[k.id] ?? 0) >= 1).length, total: SKINS.length };
}

// ---- the Surf Club's monthly skins

/** The month (YYYY-MM) of a moment, by the player's own clock. */
export function monthOf(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** This month's Club skin (undefined in a month without one). */
export function clubSkinOfMonth(now: number): ClubSkinDef | undefined {
  const m = monthOf(now);
  return CLUB_SKINS.find((k) => k.month === m);
}

/**
 * A member gets this month's Club skin, complete (Silver), and puts it on. Only the current month: a missed month is
 * gone. Returns the skin when it was just given (null otherwise). Call it often (joining mid-month gives it at once).
 */
export function grantClubSkin(state: GameState, now: number): ClubSkinDef | null {
  if (!state.perks.club) return null;
  const skin = clubSkinOfMonth(now);
  if (!skin || (state.skins.pieces[skin.id] ?? 0) >= MAX_PIECES) return null;
  state.skins.pieces[skin.id] = MAX_PIECES;
  state.skins.worn[skin.zone] = skin.id;
  return skin;
}

/** The Club skins the collection shows: every month up to this one (a missed one shows locked); with `all` the coming months too (testing). */
export function clubSkinsShown(now: number, all = false): ClubSkinDef[] {
  const m = monthOf(now);
  return CLUB_SKINS.filter((k) => all || k.month <= m);
}

/** Testing only: every Club skin complete. */
export function unlockClubSkins(state: GameState) {
  for (const k of CLUB_SKINS) if ((state.skins.pieces[k.id] ?? 0) < MAX_PIECES) state.skins.pieces[k.id] = MAX_PIECES;
}
