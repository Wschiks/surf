// Test switches for the author. They only work in development (npm run dev), or in a web test build made with
// the environment variable VITE_TEST_COINS=1 (set it only on Vercel). Never in a store build: npm run phone:sync:live
// refuses to run with it, and npm run store:check fails when it is set.

/** Unlimited coins while testing: the coins are topped up every frame, also after an expansion or rebirth. */
export const DEV_UNLIMITED_COINS = true;
