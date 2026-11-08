// Beach sports: games on the sand in front of the beach front (beach volleyball, beach soccer). They are bought in
// the Beach sheet, like the buildings, and then played like a sport zone: tap to start, collect, Level up and a
// manager. Instead of Bigger class and Faster turnover they have Players (1v1 up to 5v5) and Fields (1 up to 4).
// Without a rebirth they go up to 3v3 on 2 fields; every rebirth opens one more step of each.

import { unlockCoins, type StatDef } from './balance';
import type { Rect } from './layout';

export type BeachSportId = 'volleyball' | 'soccer';

export interface BeachSportDef {
  id: BeachSportId;
  name: string;
  icon: string;
  color: string;
  /** The stage of the game it belongs to: the number of beach expansions needed (like the buildings). */
  stage: number;
  /** The zone that must be unlocked before it can be bought. */
  needs: string;
  /** Coins to start it (in the Beach sheet). */
  coins: number;
  /** Economy scale, like a sport zone: costs and incomes multiply by tierScale^tier. */
  tier: number;
  /** Seconds one game takes. */
  baseSeconds: number;
  /** Where its fields lie on the sand, in map units. The fields stand side by side in this rectangle. */
  rect: Rect;
  /** Shirt colours of the two teams. */
  teams: [string, string];
  /** Names for the upgrades of this sport. */
  terms: { players: string; fields: string; manager: string; managerBlurb: string };
  /** Players: 2 more per level (1v1, 2v2 ... 5v5). Fields: one more field per level (1 to 4). */
  stats: { capacity: StatDef; fields: StatDef };
}

/** Players on a field at the start (1v1) and how many more each Players level adds (one per team). */
export const BEACH_PLAYERS = { start: 2, step: 2 };

/** Players: 1v1 at the start; 3v3 before any rebirth, then one more step per rebirth up to 5v5. */
const players = (baseCost: number): StatDef => ({ id: 'capacity', label: 'Players', icon: 'people', baseCost, growth: 5, surge: 0, max: 2, perRebirth: 1, cap: 4 });
/** Fields: 1 at the start; 2 before any rebirth, then one more per rebirth up to 4. */
const fields = (baseCost: number): StatDef => ({ id: 'fields', label: 'Fields', icon: 'flag', baseCost, growth: 6, surge: 0, max: 1, perRebirth: 1, cap: 3 });

export const BEACH_SPORTS: BeachSportDef[] = [
  {
    id: 'volleyball',
    name: 'Beach volleyball',
    icon: 'volleyball',
    color: '#f2a93b',
    stage: 1,
    needs: 'windsurfing-1',
    coins: unlockCoins(5.4, 25),
    tier: 5.4,
    baseSeconds: 8,
    rect: { x: 3.6, y: 0.08, w: 3.2, h: 0.7 },
    teams: ['#ff5a45', '#2f8dff'],
    terms: { players: 'Players', fields: 'Fields', manager: 'Referee', managerBlurb: 'Runs the games by themselves, even while you are away.' },
    stats: { capacity: players(100), fields: fields(400) },
  },
  {
    id: 'soccer',
    name: 'Beach soccer',
    icon: 'soccer',
    color: '#3cbf6a',
    stage: 2,
    needs: 'sailing-1',
    coins: unlockCoins(9.4, 25),
    tier: 9.4,
    baseSeconds: 10,
    rect: { x: 9.7, y: 0.06, w: 4.1, h: 0.76 },
    teams: ['#ffd23f', '#b56bff'],
    terms: { players: 'Players', fields: 'Fields', manager: 'Referee', managerBlurb: 'Runs the games by themselves, even while you are away.' },
    stats: { capacity: players(100), fields: fields(400) },
  },
];

export function beachSportById(id: string): BeachSportDef | undefined {
  return BEACH_SPORTS.find((b) => b.id === id);
}

/** Most fields a beach sport can ever have. */
export const MAX_FIELDS = 4;

/**
 * Where field `i` (0-based) lies, in map units: the sport's strip is split in MAX_FIELDS slots side by side and the
 * fields fill it from the left, with a little sand between them.
 */
export function fieldRect(b: BeachSportDef, i: number): Rect {
  const slot = b.rect.w / MAX_FIELDS;
  const gap = 0.07;
  return { x: b.rect.x + i * slot + gap / 2, y: b.rect.y, w: slot - gap, h: b.rect.h };
}

/** The rectangle around the first `count` fields (where the badge sits and taps land). */
export function fieldsArea(b: BeachSportDef, count: number): Rect {
  const first = fieldRect(b, 0);
  const last = fieldRect(b, Math.max(0, count - 1));
  return { x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h };
}
