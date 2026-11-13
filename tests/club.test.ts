import { describe, expect, it } from 'vitest';
import { CLUB_SKINS, MAX_PIECES, skinById } from '../src/config/skins';
import { CLUB } from '../src/config/shop';
import { ZONES } from '../src/config/sports';
import { claimClubGems } from '../src/core/shop';
import { clubSkinOfMonth, clubSkinsShown, giveBox, grantClubSkin, openBox, skinSpeed } from '../src/core/skins';
import { newGame } from '../src/core/state';

const at = (y: number, m: number, d = 1, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('Surf Club: the monthly skins', () => {
  it('five monthly skins, each in a real section, as the Club rarity', () => {
    expect(CLUB_SKINS.map((k) => k.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
    for (const k of CLUB_SKINS) {
      expect(ZONES.some((z) => z.id === k.zone)).toBe(true);
      expect(k.rarity).toBe('club');
      expect(skinById(k.id)).toBe(k);
    }
    expect(clubSkinOfMonth(at(2026, 12, 1))?.name).toBe('Christmas Tree');
    expect(clubSkinOfMonth(at(2027, 4, 1))).toBeUndefined();
  });

  it("a member gets this month's skin, complete, and puts it on; a non-member gets nothing", () => {
    const s = newGame(0);
    expect(grantClubSkin(s, at(2026, 11, 13))).toBeNull();
    s.perks.club = true;
    const got = grantClubSkin(s, at(2026, 11, 13))!;
    expect(got.id).toBe('club-2026-11');
    expect(s.skins.pieces[got.id]).toBe(MAX_PIECES);
    expect(s.skins.worn[got.zone]).toBe(got.id);
    // given once
    expect(grantClubSkin(s, at(2026, 11, 20))).toBeNull();
    // it is as fast as a Legendary
    expect(skinSpeed(s, got.zone)).toBe(1.5);
  });

  it('a missed month is gone: in January a member gets January, not December', () => {
    const s = newGame(0);
    s.perks.club = true;
    expect(grantClubSkin(s, at(2027, 1, 2))!.id).toBe('club-2027-01');
    expect(s.skins.pieces['club-2026-12']).toBeUndefined();
  });

  it('the collection shows the months up to now (the coming ones hidden), all of them while testing', () => {
    expect(clubSkinsShown(at(2026, 11, 13)).map((k) => k.month)).toEqual(['2026-11']);
    expect(clubSkinsShown(at(2027, 2, 1)).length).toBe(4);
    expect(clubSkinsShown(at(2026, 11, 13), true).length).toBe(5);
  });

  it('a Club skin never comes out of a box', () => {
    const s = newGame(0);
    giveBox(s, 400);
    for (let i = 0; i < 400; i++) expect(openBox(s, 'normal')!.skin.rarity).not.toBe('club');
  });

  it('the daily claim gives 5 gems and a box', () => {
    const s = newGame(0);
    s.perks.club = true;
    const boxes = s.skins.boxes;
    expect(claimClubGems(s, 1000)).toBe(CLUB.gemsPerDay);
    expect(CLUB.gemsPerDay).toBe(5);
    expect(s.skins.boxes).toBe(boxes + CLUB.boxesPerDay);
  });
});
