// Rebirth: the big prestige after the whole game is done (both beach expansions bought). Everything starts over at the
// very beginning (back to wave surfing only, the mist comes back), but income goes up for good and you get gems.
// It is meant to be far away: a high level in the last zone and a huge amount of coins, more every time.

export const REBIRTH = {
  /** The zone that must reach `level` (Level up) first: the last sailing level. */
  zone: 'sailing-4',
  level: 100,
  /** Coins for the first rebirth; every next one costs `costGrowth` times more. */
  coins: 1e15,
  costGrowth: 4,
  /**
   * A rebirth adds to the income bonus, for good, and every next one adds a bit more: +2, then +3, then +4...
   * With the expansions (+1 each, also kept): x1 → x2 → x3 → rebirth x5 → x6 → x7 → rebirth x10 → ... → rebirth x16.
   */
  firstBonus: 2,
  bonusStep: 1,
  /** Gems (skill points) for every rebirth. */
  gems: 5,
};
