// The banner plane: now and then a small plane flies over the beach with a prize on its banner. Tap it, watch an ad
// (or just claim it with Remove ads / the Surf Club) and the prize is yours. The prize is chosen before the plane
// appears, so the popup can say exactly what you get. This is the one random thing in the game (author's choice).

export const PLANE = {
  /** It only comes once a zone has a manager; the first one 2 to 3 minutes after that (seconds, from-to). */
  first: [120, 180] as [number, number],
  /** After you watched the ad (or claimed it): the next plane in 5 to 8 minutes. */
  afterClaim: [300, 480] as [number, number],
  /** After you let it fly by or closed the popup: back in 3 to 4 minutes. */
  afterMiss: [180, 240] as [number, number],
  /** How long it takes to cross the screen. */
  flightSeconds: 16,
  /** The prizes and their chances (they add up to 1). */
  prizes: {
    /** Coins: what the coins-per-second counter says, times this many seconds (5 minutes). */
    coins: { chance: 0.5, seconds: 300 },
    /** Coins x2: this many seconds added to the ad boost timer (5 minutes). */
    boost: { chance: 0.4, seconds: 300 },
    /** Gems. */
    gems: { chance: 0.1, gems: 3 },
  },
};
