// Test switches for the author. They only work in development (npm run dev), or in a web test build made with
// the environment variable VITE_TEST_COINS=1 (set it only on Vercel). Never in a store build: npm run phone:sync:live
// refuses to run with it, and npm run store:check fails when it is set.

/** Unlimited coins while testing: the coins are topped up every frame, also after an expansion or rebirth. */
export const DEV_UNLIMITED_COINS = true;

/** Unlimited gems while testing: topped up every frame like the coins. */
export const DEV_UNLIMITED_GEMS = true;

/** Every skin unlocked while testing (4 pieces each, the look only: Bronze and Silver still need boxes). */
export const DEV_ALL_SKINS = true;

/** The Surf Club's monthly skins while testing: every month shows in the collection (also the coming ones) and is unlocked. Set to false to see them as players will: the coming months hidden. */
export const DEV_CLUB_PREVIEW = true;
