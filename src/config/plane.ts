// The rescue helicopter (it replaced the banner plane and the x2 button): now and then it flies over the beach. Tap it,
// watch an ad (or just claim it with Remove ads / the Surf Club) and the prize is yours, then it rescues a swimmer. The
// prize is chosen before it appears, so the popup can say exactly what you get. Its prize and timing are one of the two
// random things in the game (author's choice).

export const PLANE = {
  /** It only comes once a zone has a manager; the first one 20 to 50 seconds after that (seconds, from-to). */
  first: [20, 50] as [number, number],
  /** After you watched the ad (or claimed it): the next helicopter in 2 to 3 minutes (it replaces the x2 button). */
  afterClaim: [120, 180] as [number, number],
  /** After you let it fly by or closed the popup: back in 1.5 to 2 minutes. */
  afterMiss: [90, 120] as [number, number],
  /** How long it takes to cross the screen. */
  flightSeconds: 24,
  /** It slows down and lingers this long in the middle of the screen, so you can't miss it. */
  lingerSeconds: 3.5,
  /** The prizes and their chances (they add up to 1). */
  prizes: {
    /** Coins: what the coins-per-second counter says, times this many seconds (5 minutes). */
    coins: { chance: 0.25, seconds: 300 },
    /** Coins x2: this many seconds added to the ad boost timer (5 minutes). */
    boost: { chance: 0.55, seconds: 300 },
    /** One skin box, opened straight away. */
    box: { chance: 0.12 },
    /** Gems. */
    gems: { chance: 0.08, gems: 3 },
  },
};
