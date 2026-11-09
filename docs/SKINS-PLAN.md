# Skins and boxes: plan

Nothing is built yet. **Decided** = your choice. **Open** = still to choose, with my pick marked **(recommended)**. The questions are at the end.

---

## 1. How Idle Farming Empire does it (from their own help pages)

- **Every Shoebox holds 1 piece** of a crop. Pieces unlock a crop and upgrade it.
- **Unlocked** after 4 pieces (a 2x2 puzzle), then **Bronze** after 4 more, then **Silver** after 9 more (3x3).
- **Each tier is a boost for good**:

| Tier | Boost |
|---|---|
| Unlocked | +0% |
| Bronze | +100% |
| Silver | +500% |
| Gold | +2,500% |
| Platinum | +20,000%, then +80,000%, +140,000% ... with no end |

- **Rarity does not change the boost.** It only says how hard the pieces are to find.
- **Every crop belongs to one plot.** You choose which crop a plot grows, and only that crop's tier counts.
- **Free boxes come all the time:** swiping crops, the sun/rain ad, gifts from friends, the daily calendar, and gems in the shop.
- **A "?" shows the odds.** Boxes unlock at plot 9; the ones you got earlier are saved until then.

---

## 2. What we build (decided)

| | |
|---|---|
| **Item** | **Board skins** (sail, kite or hull for the other sports). Your friend's boards are the style. |
| **Per sport** | A skin is for a **whole sport**: if windsurfing wears Flames, all 4 windsurfing zones ride Flames. |
| **Boost** | **Only the board a sport wears counts**, like the planted crop. Wear Flames (Silver) = +500%, wear Camo (Bronze) = +100%. |
| **Pieces** | **1 piece per box.** 4 pieces = unlocked (the new look, +0%), +4 = **Bronze +100%**, +9 = **Silver +500%**. 17 pieces in total. |
| **Rarity per area** | Common = Wave (surfing, skimboarding). Uncommon + Rare = Sea (windsurfing, kitesurfing, foil and wing). Rare + Legendary = Ocean (sailing). A board of a better sport is worth more coins, because +100% on sailing is far more than +100% on surfing. |
| **Boxes** | **Box**: coins, 3x more expensive every time, 45% Common, 35% Uncommon, 16% Rare, 4% Legendary. **3 Boxes**: gems. **Golden box**: gems, 14% Uncommon, 33% Rare, 53% Legendary. |

**Never a wasted piece:** a piece always goes to a board that isn't at its top tier yet. When all boards of a rarity are done, the piece goes to another rarity. Idle Farming Empire: "always a new piece to unlock or upgrade one of your crops".

**Boards of a sport you don't have yet** can already get pieces. You see them in the collection, and you can wear them once the sport is open.

---

## 3. How many boards (open)

| Option | Boards | |
|---|---|---|
| **3A. 4 per sport (recommended)** | 24: surfing 4 Common, skimboarding 4 Common; windsurfing, kitesurfing and foil 3 Uncommon + 1 Rare each; sailing 2 Rare + 2 Legendary | Enough to choose from, and everything is reachable in one game (see part 4). |
| 3B. 2 per sport | 12 | Quicker to complete, but little to choose from. |
| 3C. 8 per sport | 48 | Like Idle Farming Empire (62 crops), but takes far too many boxes with 1 piece per box. |

Example boards (3A, with your friend's art):

| Sport | Boards |
|---|---|
| Surfing (Common) | Red, Ocean blue, Retro stripes, Sunset |
| Skimboarding (Common) | Sand, Coral, Checkers, Palm |
| Windsurfing (3 Uncommon + 1 Rare) | Zebra, Rainbow, Camo, **Flames** |
| Kitesurfing (3 Uncommon + 1 Rare) | Dots, Two-tone, Neon, **Lightning** |
| Foil and wing (3 Uncommon + 1 Rare) | Carbon, Split, Ice, **Hibiscus** |
| Sailing (2 Rare + 2 Legendary) | **Dragon**, **Money**, **Golden galaxy**, **Pirate gold** |

---

## 4. How many boxes a player needs (1 piece per box)

Simulated with the odds above, with 24 boards (median of 400 runs):

| Goal | Normal boxes |
|---|---|
| First board unlocked | 26 |
| Every board unlocked (every look) | 276 |
| Every board at Silver | 408 |
| First Legendary unlocked | 138 normal, or **11 Golden** |

A full game has room for only **about 20 coin boxes**. So, just like Idle Farming Empire, **most boxes must be free.**

### Free boxes (open)

| Source | Boxes in a full game | |
|---|---|---|
| **Every quest (recommended)** | about 260 (the bot finishes 263 quests) | Quests already come all the time and pay coins. A box next to the coins makes every quest worth it. |
| **Every new level or sport (recommended)** | about 60 (24 zones, 3 times because of the expansions) | |
| **Ad: a free box (recommended)** | 1 every 30 minutes of play | Uses the AdMob block **Rewarded_ItemBox** that already exists. |
| Banner plane | a few | a 4th prize |
| Rebirth | 1 Golden box per rebirth | |
| Surf Club | 1 a day | |

With quests + levels + coin boxes that is about 340 boxes: every look in one game, and most boards on Silver by the rebirth. Golden boxes are the fast way to the Legendaries.

### The first box (recommended)

The first 4 boxes always fill **one surfing board**, so the player sees "4 pieces = new board" straight away. This is fixed, not random.

---

## 5. Gold and higher (open)

| Option | |
|---|---|
| **5A. Only Bronze and Silver for now (recommended)** | +500% (x6) is already big for our balance. Add Gold later as the endgame. |
| 5B. Gold too (+16 pieces, +2,500%) | Like Idle Farming Empire, but x26 on a sport. The balance has to change for this. |

Balance: a sport on Silver earns x6. That will make the game faster, so the balance bot will open boxes too and I'll set the prices again until it takes about a day.

---

## 6. Coin box price (open)

3x more expensive every time. Start 50K, then 150K, 450K, 1.35M, 4.05M, 12.2M, ... 984M (box 10), ... 58.1T (box 20).

| Option | |
|---|---|
| **6A. Never goes back down (recommended)** | Exactly x3 every time, for good. |
| 6B. Back down at every rebirth | Start price x10 per rebirth. |

---

## 7. Gem prices (open)

20 gems = €0.99, 100 = €3.99, 300 = €9.99. A free player earns about 100 gems in a full game, and all skills cost 287.

| Option | 3 Boxes | Golden box |
|---|---|---|
| Cheap | 10 | 25 |
| **Middle (recommended)** | **20** (= the €0.99 pack) | **40** |
| Like Idle Farming Empire | 30 | 60 |

---

## 8. Rules we have to follow

| Rule | What it means |
|---|---|
| **Apple 3.1.1** | The odds must be shown **before** buying: the "?" on every card. |
| **Age rating** | In App Store Connect: **"Loot Boxes: yes"**, like Idle Farming Empire. |
| **Belgium** | Paid loot boxes count as illegal gambling there; an Antwerp court ruled the same against a mobile game in January 2025. Gem boxes count as paid. Earned boxes are fine. |
| **Netherlands** | The problem is mainly items you can sell for real money. Ours can't be sold or traded. |
| **Our own rule** | Boxes become the second random thing in the game (after the banner plane), your choice. I'll add it to CLAUDE.md and `npm run store:check`. |

Not legal advice: check Belgium with someone who knows before gem boxes go live there.

| Belgium option | |
|---|---|
| 8A. Same everywhere | Simplest, against Belgian law. |
| **8B. No gem boxes in Belgium (recommended)** | The shop hides the two gem cards for the Belgian store; coin and free boxes stay. |
| 8C. No gem boxes anywhere | Only coin and free boxes. |

---

## 9. What it looks like (minimal text, icons)

- **Shop:** a **Boxes** row like the screenshot: three cards with a "?", a box picture and a price (coin or gem icon + number).
- **Opening:** the box shakes and opens (tap to skip). A piece flies to its board, and the 2x2 / 3x3 puzzle fills up. A new board or tier is a big moment: the board shines, with **+100%** or **+500%**.
- **Collection** (the hidden Skins button comes back): one row per sport, like the Idle Farming Empire screenshot. Every board shows its puzzle, `2/4` towards the next tier, a frame in its tier color (Bronze, Silver) and a **+100%** badge. Tap a board to wear it.
- **In the water:** every guest of that sport rides the board the sport wears.
- **Unlock moment:** the first box comes with the first quest reward, with the same dark-screen spotlight as the first gem.

---

## 10. Build steps (once everything is chosen)

1. `src/config/skins.ts`: boards (sport, rarity, colors, pattern), tiers, odds and prices. All data.
2. `src/core/skins.ts`: open a box, give a piece (never wasted), tiers, the boost of the worn board, coin box price. Tests in `tests/skins.test.ts`.
3. Save: pieces per board, the board each sport wears, coin boxes bought, unopened boxes. Old saves start with nothing.
4. Art: board patterns in `art.ts`, in your friend's style, plus sail, kite and hull versions.
5. UI: the shop Boxes row, the "?" odds, the opening, the collection.
6. Free boxes: quests, new levels, the `itemBox` ad.
7. Balance: the bot opens boxes and wears its best boards; prices set again until the game takes about a day.
8. Store: "Loot Boxes" age rating, `store/listing.md`, Belgium, CLAUDE.md and `store:check`.

---

## 11. Questions for you

1. **Boards per sport?** 3A 4 (recommended), 3B 2, 3C 8
2. **Free boxes from?** quests, new levels, ad (recommended), plane, rebirth, Club
3. **First 4 boxes fill one surfing board?** yes (recommended) / no
4. **Tiers?** 5A Bronze + Silver (recommended), 5B also Gold
5. **Coin box:** start at 50K? 6A never back down (recommended) / 6B back down at a rebirth
6. **Gem prices?** 10/25, 20/40 (recommended), 30/60
7. **Belgium?** 8A, 8B (recommended), 8C

---

## Sources

- Idle Farming Empire, tiers and boosts: https://futureplaygames.theymes.com/hc/en/idle-farming-empire/articles/how-do-i-know-which-crop-to-choose-for-most-profit-67
- Idle Farming Empire, what Shoeboxes are and where they come from: https://futureplaygames.theymes.com/hc/en/idle-farming-empire/articles/what-are-the-shoeboxes-and-how-do-i-get-them-70
- Idle Farming Empire, where Shoeboxes are, the odds "?", always a new piece: https://futureplaygames.theymes.com/hc/en/idle-farming-empire/articles/where-can-i-see-my-shoeboxes-52
- Idle Farming Empire on the App Store ("Loot Boxes" age rating): https://apps.apple.com/app/id1018795567
- Apple guideline 3.1.1, loot box odds: https://www.pcgamer.com/apple-now-requires-app-store-games-to-disclose-loot-box-odds/
- Belgium: https://gamesradar.com/belgium-deems-loot-boxes-dangerous-to-children-and-society-threatens-publishers-with-prison-and-fines and https://www.gamblinginsider.com/news/5801/games-developers-remove-paid-loot-boxes-in-belgium
- Loot box laws by country (Top War 2025, Netherlands): https://blog.promise.legal/loot-box-laws-game-developers/
- Idle Theme Park Tycoon managers: https://codigames.helpshift.com/hc/en/3-idle-theme-park-tycoon/faq/945-new-feature-managers-are-here
