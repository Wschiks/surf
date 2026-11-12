// The daily rewards calendar (the author's design, after Idle Farming Empire's): 24 tiles a month, one more every day you
// play (a missed day costs nothing, the next time you go on where you were). A new calendar starts on the 1st; tiles not
// claimed by the end of the month are gone. Four weeks of six tiles: every week has the same kinds of reward, each week
// bigger, and the last tile of every week (the star) gives pieces of a fixed skin, the same for everyone that month:
// 1 piece of one skin, 4 of another (unlocked), 8 of a Rare or Epic (Bronze, +100%), 8 of a Legendary (Bronze, +100%).
// The date is only used for "one tile a day" and "a new month"; the game itself still has no clock (CLAUDE.md).

export type CalendarReward =
  | { kind: 'gems'; gems: number }
  | { kind: 'boxes'; boxes: number }
  /** Hours of the player's own income (the coins-per-second counter x the hours). */
  | { kind: 'coins'; hours: number }
  /** Minutes added to the coins x2 timer. */
  | { kind: 'boost'; minutes: number }
  /** Pieces of the month's skin for this week (MONTH_SKINS). */
  | { kind: 'skin'; week: number; pieces: number };

export const CALENDAR_TILES = 24;

/** Week by week: gems, treasure boxes, hours of coins, coins x2, gems, the star (skin pieces). */
const WEEKS: { gems: number; boxes: number; hours: number; minutes: number; gems2: number; pieces: number }[] = [
  { gems: 5, boxes: 1, hours: 2, minutes: 10, gems2: 5, pieces: 1 },
  { gems: 10, boxes: 2, hours: 4, minutes: 20, gems2: 10, pieces: 4 },
  { gems: 15, boxes: 3, hours: 8, minutes: 30, gems2: 15, pieces: 8 },
  { gems: 25, boxes: 5, hours: 12, minutes: 60, gems2: 25, pieces: 8 },
];

/** The 24 tiles in order (day 1 first). */
export const CALENDAR: CalendarReward[] = WEEKS.flatMap((w, week) => [
  { kind: 'gems', gems: w.gems },
  { kind: 'boxes', boxes: w.boxes },
  { kind: 'coins', hours: w.hours },
  { kind: 'boost', minutes: w.minutes },
  { kind: 'gems', gems: w.gems2 },
  { kind: 'skin', week, pieces: w.pieces },
]);

/**
 * The four skins of every month (January first): week 1 a Common (1 piece), week 2 a Common (4 pieces: unlocked),
 * week 3 a Rare or Epic (8 pieces: Bronze), week 4 a Legendary (8 pieces: Bronze). All different within a month.
 */
export const MONTH_SKINS: [string, string, string, string][] = [
  ['wave-1-2', 'skimboarding-1-1', 'windsurfing-3-1', 'wave-4-3'],
  ['wave-2-1', 'kitesurfing-1-1', 'kitesurfing-2-2', 'windsurfing-1-3'],
  ['skimboarding-1-2', 'wave-2-2', 'foil-2-2', 'kitesurfing-1-3'],
  ['wave-3-2', 'skimboarding-2-2', 'windsurfing-4-1', 'skimboarding-2-3'],
  ['skimboarding-2-1', 'kitesurfing-2-1', 'sailing-2-2', 'kitesurfing-2-3'],
  ['wave-1-1', 'wave-3-1', 'kitesurfing-3-2', 'wave-1-3'],
  ['skimboarding-3-1', 'kitesurfing-3-1', 'foil-4-2', 'kitesurfing-3-3'],
  ['wave-4-2', 'skimboarding-3-2', 'sailing-4-1', 'sailing-4-3'],
  ['skimboarding-4-2', 'wave-4-1', 'kitesurfing-1-2', 'windsurfing-2-3'],
  ['skimboarding-4-1', 'kitesurfing-4-1', 'kitesurfing-4-2', 'windsurfing-3-3'],
  ['skimboarding-1-1', 'kitesurfing-1-1', 'windsurfing-4-1', 'foil-4-3'],
  ['wave-1-2', 'skimboarding-1-2', 'sailing-1-1', 'kitesurfing-4-3'],
];

/** Coins a coins tile gives at the very start, before anything earns coins (per second). */
export const CALENDAR_MIN_INCOME = 5;
