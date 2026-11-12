import { describe, expect, it } from 'vitest';
import { CALENDAR, CALENDAR_TILES, MONTH_SKINS } from '../src/config/calendar';
import { skinById } from '../src/config/skins';
import { calendarCoins, calendarStatus, claimCalendar } from '../src/core/calendar';
import { tierOf } from '../src/core/skins';
import { newGame } from '../src/core/state';

const day = (m: number, d: number, h = 10) => new Date(2026, m - 1, d, h);

describe('daily rewards calendar', () => {
  it('has 24 tiles: four weeks of gems, boxes, coins, x2, gems and a skin star', () => {
    expect(CALENDAR.length).toBe(CALENDAR_TILES);
    expect(CALENDAR.map((r) => r.kind).slice(0, 6)).toEqual(['gems', 'boxes', 'coins', 'boost', 'gems', 'skin']);
    expect(CALENDAR.filter((r) => r.kind === 'skin').map((r) => (r.kind === 'skin' ? r.pieces : 0))).toEqual([1, 4, 8, 8]);
  });

  it('every month has four different fixed skins: Common, Common, Rare or Epic, Legendary', () => {
    expect(MONTH_SKINS.length).toBe(12);
    for (const m of MONTH_SKINS) {
      expect(new Set(m).size).toBe(4);
      const r = m.map((id) => skinById(id)!.rarity);
      expect(r[0]).toBe('common');
      expect(r[1]).toBe('common');
      expect(['rare', 'epic']).toContain(r[2]);
      expect(r[3]).toBe('legendary');
    }
  });

  it('one tile a day you play; a missed day costs nothing; a new calendar on the 1st', () => {
    const s = newGame(0);
    expect(claimCalendar(s, day(11, 3))?.reward.kind).toBe('gems');
    expect(claimCalendar(s, day(11, 3, 20))).toBeNull();
    // skipped the 4th and 5th: the next tile is simply the second one
    expect(claimCalendar(s, day(11, 6))?.reward.kind).toBe('boxes');
    expect(calendarStatus(s, day(11, 6)).claimed).toBe(2);
    expect(calendarStatus(s, day(12, 1)).claimed).toBe(0);
    expect(claimCalendar(s, day(12, 1))?.reward).toEqual(CALENDAR[0]);
  });

  it('the phone date going back does not give a second tile', () => {
    const s = newGame(0);
    claimCalendar(s, day(11, 10));
    expect(calendarStatus(s, day(11, 9)).canClaim).toBe(false);
  });

  it('gives the rewards, doubled with an ad (not the skin pieces)', () => {
    const s = newGame(0);
    const g = s.skillPoints;
    claimCalendar(s, day(11, 1), true);
    expect(s.skillPoints).toBe(g + 10);
    claimCalendar(s, day(11, 2));
    expect(s.skins.boxes).toBe(1);
    const c = s.coins;
    const got = claimCalendar(s, day(11, 3))!;
    expect(got.coins).toBeCloseTo(calendarCoins(s, 2), 6);
    expect(s.coins).toBeCloseTo(c + got.coins!, 6);
    claimCalendar(s, day(11, 4));
    expect(s.boost).toBe(600);
  });

  it('the star days give the month\'s fixed skins: 1 piece, unlocked, Bronze, a Legendary at Bronze', () => {
    const s = newGame(0);
    for (let d = 1; d <= 24; d++) claimCalendar(s, day(11, d), true);
    const [a, b, c, l] = MONTH_SKINS[10];
    expect(s.skins.pieces[a]).toBe(1);
    expect(tierOf(s.skins.pieces[b])).toBe(1);
    expect(tierOf(s.skins.pieces[c])).toBe(2);
    expect(tierOf(s.skins.pieces[l])).toBe(2);
    expect(claimCalendar(s, day(11, 25))).toBeNull();
  });

  it('a skin that is already complete gives a golden box instead', () => {
    const s = newGame(0);
    s.skins.pieces[MONTH_SKINS[10][0]] = 17;
    s.calendar = { month: '2026-11', claimed: 5, last: '2026-11-05' };
    const r = claimCalendar(s, day(11, 6))!;
    expect(r.pieces).toBeNull();
    expect(s.skins.golden).toBe(1);
  });
});
