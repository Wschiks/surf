# Surf Tycoon — Character, Gear & Animation Spec

This is a build spec for the redesigned guest models in **Surf Tycoon** (iOS idle game, top-down, flat low-fi style).
It is written so an AI coding agent (Claude Code) can implement it directly. Visual reference for every model is in `svg/`.

---

## 0. Instructions for Claude Code

> **Paste this into Claude Code from the root of the Surf Tycoon project:**
>
> Read `surf-tycoon-models/README.md` and look at every file in `surf-tycoon-models/svg/`.
> Then:
> 1. Find where guest/rider models are currently drawn in this codebase (search for the sports: surf, skim, windsurf, kite, foil/wing, sailing, volleyball/soccer) and figure out the rendering approach in use (SwiftUI `Canvas`/`Path`/`Shape`, SpriteKit `SKShapeNode`, etc.). Keep using that same approach.
> 2. Build the shared **rider rig** from §2 as one reusable component driven by a `Pose` value. Build it first and show me all four poses side by side before touching the sports.
> 3. Replace each sport's model with the geometry in §3, one sport at a time, using the rig. Keep the existing per-sport colours where they already match §1.4.
> 4. Add the animation system in §4: movement model, procedural secondary motion, state machines, particles. Gate expensive parts behind the LOD rules in §4.7.
> 5. Check every item of the acceptance checklist in §5 and tell me which ones pass.
> Ask me before changing gameplay logic (earnings, spawning, upgrades) — this task is visuals and animation only.

---

## 1. Conventions

### 1.1 Scale
- **1 px ≈ 0.8 cm** at sprite scale 1.0. Everything below is in these px.
- Head 25 px ≈ 20 cm. Shoulders 54 px ≈ 43 cm. Stance (feet apart) ≈ shoulder width ≈ 62–68 px.
- Real board sizes used: surfboard 6'6"×20" → **248×66**, skimboard ~130×52 cm → **162×72**, windsurf 255×77 cm → **320×96**, kite twin-tip 138×41 cm → **160×50**, foil board → **190×80**, Topper dinghy 3.38×1.19 m → **424×144**.

### 1.2 Coordinates
- Each model has a **local frame**: origin = model pivot (board/hull centre), **heading = −y (up)**, +x = right (starboard), y grows downward (SVG/UIKit style).
- The engine rotates the whole model to its world heading. **Shadows are NOT rotated** (see 1.3).
- Angles in degrees, positive = clockwise on screen.

### 1.3 Light & shadows (one global light)
- Light comes from the upper-left. Every shadow is the object's own silhouette filled with `#0E4A5C` and offset **down-right in WORLD space**, applied *after* the model rotation:
  - things on the water (boards, hulls, riders on the ground): offset `(+7, +10)`, opacity 0.22
  - riders standing on a board: rider-silhouette ellipse 19×31 at offset `(+10, +12)`, opacity 0.16
  - tall things (sails, wing): offset `(+28, +38)`, opacity 0.12–0.16
  - flying foil board: offset `(+26, +36)`, opacity 0.18
  - kite: offset `(+18, +64)`, opacity 0.10
- Implementation: render shadow layer by transforming the silhouette with the model rotation, then translating by the fixed world offset.

### 1.4 Palette
| Token | Hex | Use |
|---|---|---|
| water | `#86D0DE` | sea |
| waterLine | `#A6DDE8` | wave squiggles |
| sand | `#EFD9AC` | beach |
| wetSand | `#D2E5DC` | skim zone |
| foam | `#FFFFFF` | wake, spray, foam |
| shadow | `#0E4A5C` | all shadows (with opacity) |
| board | `#FFFFFF` | boards & hulls |
| stringer | `#DCE5EA` | 1.5 px stringer / gunwale |
| pad | `#4A5866` / `#5B6876` | tail pad / foil deck pad |
| navy | `#2A3A4C` | shorts, wetsuits, straps, mast foot |
| metal | `#46525E` | booms, sheets |
| skin | `#F6D2B0` `#F3C9A2` `#E3AE84` `#B97C55` `#7A4A2E` | pick per guest |
| skinShade | skin darkened ~8% (e.g. `#E2AE85` for `#F3C9A2`) | hands & feet |
| hair | `#3D2B1A` `#1C1715` `#D9A441` `#A0522D` `#8C8C8C` | pick per guest |
| surf accent | `#FF7043` (edge `#E0582E`) | surf outfit, kite, sail |
| skim accent | `#FFB74D` (edge `#E59A2E`) | skim outfit; board `#1F8AA6` |
| windsurf accent | `#26C6DA` (edge `#1499AB`, battens `#B2EBF2`) | sail |
| wing accent | `#7E57C2` tube, `#B39DDB` canopy, `#ECE6F8` windows | wing |
| sailing vest | `#FFCA28` (edge `#E0A800`) | sailor |
| team blue | `#2F7BFF` (edge `#1F52B0`) | players |
| team red | `#FF5240` (edge `#B3332A`) | players |

### 1.5 Outfit = level (4 levels per sport)
1. Beginner: chunky foam vest in the sport accent + two navy strap lines.
2. Improver: rash vest in the sport accent.
3. Regular: navy wetsuit (`#2A3A4C`) + accent stripe across the shoulders.
4. Pro: black suit `#1B1F24` + accent stripe; surf L4 (Nazaré/reef) adds a white helmet (circle r11.5 `#F4F6F7`, 1.5 px `#C9D3DA` edge, accent stripe front-to-back) instead of hair.

Randomise skin (5) × hair (5) per guest on spawn.

---

## 2. Shared rider rig

The rider is rebuilt every frame from a **Pose**. All points are in the model's local frame.

```
Pose {
  torso:      Point      // T, torso centre
  torsoRot:   Degrees    // rotation of the torso ellipse
  torsoRx, torsoRy        // 15 × 26 sideways/seated, 28 × 14 forward, 22 × 11 prone shoulders
  face:       Vector     // unit vector the rider looks toward
  feet:      [Point, Point]       // front, back  (may be hidden)
  hands:     [Point, Point]       // front, back
  hips:       Point      // default = T
  showLegs:   Bool
  mirror:     Bool       // flip x for switch stance / other tack
}
```

### 2.1 Shapes (draw in this order)
1. **Legs** – round-capped line, width 12, `navy` (or outfit lower colour), from `hips` to each foot.
2. **Feet** – ellipse 16×12 (rx 8, ry 6), `skinShade`, long axis along `face` (toes point where the rider looks).
3. **Arms** – round-capped line, width 9, `skin`, from each shoulder point to its hand.
   - shoulder points = `T ± 22 · s` where `s` is the torso's long axis (unit vector of torsoRy after `torsoRot`).
4. **Torso** – ellipse `torsoRx × torsoRy` rotated `torsoRot`, outfit fill, 2 px edge stroke (outfit edge colour).
   - level-3/4 accent stripe: quadratic curve across the torso's front half, width 3.
5. **Head skin** – circle r 12.5 at `T + 4·face`.
6. **Hair cap** – circle r 12 at `headCentre − 4·face`, hair colour. The leftover skin crescent is the face. **Never split the head with a straight line.**
7. **Hands** – circle r 5.5, `skinShade`, at each hand point.

Extra hair styles (drawn with the hair cap, all relative to hair-cap centre, `back = −face`):
ponytail = ellipse 5×8 at `+14·back` + tie dot r3 accent; curls = 5 extra circles r6–7 around the back half; bun = circle r6 at `+14·back`.

### 2.2 The four base poses (relative to T, rider facing +x, before mirror)
| Pose | torso | feet | hands | notes |
|---|---|---|---|---|
| **sideways** (stand on board) | 15×26, long axis along board | (5,−32), (5,32) | balance: (30,−48), (−28,48) | feet peek ~10 px past the shoulders |
| **prone** (paddle/wait) | shoulders 22×11 across board + body 14×22 at (0,22) | legs from (±6,38) to (±8,88), width 10 | paddle cycle §4.3 | head at (0,−14), face = forward |
| **seated** (sailing) | 14×25, long axis fore-aft | in cockpit: (68,−20), (68,26) | tiller & sheet (per boat) | legs width 12 from (10,−10)/(10,12) |
| **forward** (sand) | 28×14 across | hidden when standing; run cycle §4.3 | ready (−28,16),(28,16) / pass platform (−5,−42),(5,−42) | back piping: white 2.5 px curve on the rear edge |

**Proportion guard rails:** feet distance 60–70 px; arm length (shoulder→hand) 30–50 px; head never wider than ½ the shoulder width; the head is always on the torso, never beside it.

---

## 3. Models (static geometry, local coords)

Paths are SVG path syntax in the model's local frame. The SVG files in `svg/` show the same models in canvas coordinates (origin noted per model) — use them to check visually.

### 3.1 Wave surfing — `svg/surf.svg` (canvas origin 220,300)
- Board: `M0,-124 C21,-98 33,-46 33,6 C33,60 26,98 16,118 Q0,126 -16,118 C-26,98 -33,60 -33,6 C-33,-46 -21,-98 0,-124 Z` white.
- Stringer: line (0,−116)→(0,120), 1.5 px `stringer`. Tail pad: rounded rect x −14 y 70 w 28 h 42 r 9 `pad`.
- Leash: curve `M1,120 C12,136 -8,146 5,166`, 2 px navy (trails behind, wiggle it — §4.3).
- Rider pose: sideways, T (−2,48), feet (3,16) & (3,80), hands (28,0) & (−30,96), face (+1,0).
- Wake emitters: (−12,124), (12,124).

### 3.2 Skimboarding — `svg/skim.svg` (canvas origin 220,336)
- Board (pointed nose forward, round tail back): `M0,81 C28,81 36,52 36,18 C36,-30 23,-70 0,-81 C-23,-70 -36,-30 -36,18 C-36,52 -28,81 0,81 Z` fill `#1F8AA6`.
- Tail stripe: `M-23,62 Q-0,74 23,62` 6 px `#FFB74D`.
- Rider pose: sideways, T (−2,−4), feet (3,−36) & (3,28), hands (−38,−48) & (36,40). Shadow offset only (+4,+6): the board is on the ground.
- Spray emitter: (0,82) — spray comes off the round tail.

### 3.3 Windsurfing — `svg/windsurf.svg` (canvas origin 220,290)
- Board: `M0,-160 C30,-130 48,-56 48,16 C48,86 42,130 35,156 Q0,166 -35,156 C-42,130 -48,86 -48,16 C-48,-56 -30,-130 0,-160 Z`.
- Mast foot: circle r6 navy at **M = (0,−16)** (≈1.4 m from the tail).
- Sail (solid, no holes): `M0,-16 C106,-4 172,98 143,186 C114,120 56,44 0,-16 Z` accent fill, 2 px edge; luff tube `M0,-16 C48,-11 86,10 114,38` 6 px edge colour; battens 2 px: (44,28)→(69,12), (86,78)→(120,60), (118,130)→(146,120).
- Wishbone boom: ellipse rx 119 ry 15, centre (72.5,90), rotated 53.9°, stroke 4 px `metal`, no fill.
- The rig (sail + boom) is one group pivoting on M. **Rig angle** 0° = the drawing above (sheeted for a beam reach, sail to starboard). See §4.4.3.
- Rider pose: sideways, T (2,94), torsoRot −36°, feet (−8,70) & (8,134) in straps (rounded rects 22×7 navy under each foot), hands on the windward boom tube (22,47) & (52,88).
- Rule: rider always on the **windward** side; sail always to **leeward**.

### 3.4 Kitesurfing — `svg/kite.svg`
Two objects: **rider+board** and **kite**, joined by 2 lines.
- Rider frame (as drawn): board long axis along x, rider faces −y (toward the kite). To match "heading = −y", rotate this frame +90° with `(x,y) → (−y, x)`; travel direction is the board's leading tip.
- Twin-tip: `M-80,-8 C-80,-20 -66,-25 -50,-24 Q0,-28 50,-24 C66,-25 80,-20 80,-8 L80,8 C80,20 66,25 50,24 Q0,28 -50,24 C-66,25 -80,20 -80,8 Z` white; tip graphics rect 10×34 r5 accent at x ±69.
- Straps: rect 8×12 navy at (±32,1). Feet ellipses at (±32,−1) 12×17 (toes toward kite). Legs from feet to hips (±8,14).
- Torso 26×14 at (0,18) (shoulders across, facing the kite). Harness curve `M-20,25 Q0,33 20,25` accent.
- Bar: rect 44×6 r3 navy at (−22,−37); end floats r3.5 red `#E53935` (left) / blue `#1E88E5` (right); chicken-loop line (0,−31)→(0,10) 2 px.
- Hands on bar at (±14,−34). Head (0,13), hair (0,17).
- Kite (own frame, centre at leading-edge middle-bottom): canopy `M-119,56 C-79,-74 79,-74 119,56 C87,20 39,0 0,0 C-39,0 -87,20 -119,56 Z` accent; leading edge stroke `M-119,56 C-79,-74 79,-74 119,56` 9 px `#D9502A`; struts 4 px: (−71,−17)→(−62,14), (0,−42)→(0,0), (71,−17)→(62,14). Line attach points (±115,52).
- Lines: 1.6 px `#3B4651` from each kite tip to the matching bar end (±20,−34 in rider frame).
- Kite placement: §4.4.4. On screen D ≈ 380 px (shortened from 20–25 m; keep the angle, not the length).

### 3.5 Foil & wing — `svg/wing.svg` (canvas origin 220,425)
- Board: `M-36,-65 C-36,-87 -20,-95 0,-95 C20,-95 36,-87 36,-65 L40,69 C40,89 28,95 0,95 C-28,95 -40,89 -40,69 Z` white; deck pad rect x −27 y −59 w 54 h 142 r 16 `#5B6876`.
- Rider pose: sideways, T (−6,3), torsoRot −20°, feet (−1,−27) & (1,35) (≈62 px apart), hands (28,−45) & (11,−22).
- Wing group: `translate(70,−101) rotate(37)`, in wing frame: canopy `M-120,70 C-110,10 -50,0 0,0 C50,0 110,10 120,70 C80,74 40,96 0,104 C-40,96 -80,74 -120,70 Z` `#B39DDB`; windows rect 28×20 r6 at (−64,26) and (36,26) `#ECE6F8`; leading edge stroke (same curve, first half) 10 px `#7E57C2`; strut line (0,2)→(0,104) 7 px; handles rect 12×8 r3 navy at y 66 and 94. The hands sit on the handles.
- **Draw the wing AFTER the rider's hands** — the hands are under the wing.
- Flying: no board wake. Mast wake emitter at (0,105) (thin trickle). Shadows use the far "flying" offsets.

### 3.6 Sailing (Topper-size dinghy) — `svg/sailing.svg`
- Hull: `M0,-212 C42,-164 72,-68 72,36 C72,108 66,172 60,212 L-60,212 C-66,172 -72,108 -72,36 C-72,-68 -42,-164 0,-212 Z` white, 3 px `stringer` gunwale.
- Cockpit: rounded rect x −48 y 52 w 96 h 140 r 18 `#E7EEF2`. Hiking strap: line (0,66)→(0,180) 4 px navy @55%.
- Daggerboard: rect x −6 y 25 w 12 h 21 `#9AA7B2`. Rudder: rect x −6 y 210 w 12 h 24 navy. Tiller: line (0,215)→(0,148) 6 px `#9C7A54`.
- Mast: circle r7 navy at **(0,−100)**. Boom: line from (0,−98) to the boom end (98,92), 5 px `metal` (length ≈ 214). Sail: wedge `M2,-97 L98,92 C122,17 80,-50 2,-97 Z` accent, 2 px edge, battens 2 px `#FFAB91`.
- Boom + sail are a group pivoting on the mast; **boom angle** 0° = along the centreline toward the stern; drawn at +27° (to starboard). See §4.4.6.
- Mainsheet: polyline boom end → block (12,153) r4 → sailor's front hand. Tiller extension: line (0,148) → sailor's back hand, 3 px navy.
- Sailor pose: seated on the windward deck, T (−70,120), facing +x (into the boat), feet under the strap (−2,100) & (−2,146), front hand on mainsheet (−32,100), back hand on extension (−38,154). Mirror x for the other tack.

### 3.7 Beach volleyball & soccer — `svg/players.svg`
- Forward pose rider, torso 28×14 team colour + white back piping `M-24,6 Q0,19 24,6`.
- Head skin (0,−6) r13, hair cap (0,−2) r12.5.
- Poses: **ready** hands (−30,16),(30,16); **pass** hands (−5,−42),(5,−42) (arms form a V platform); **set** hands (−9,−27),(9,−27) above the forehead; **spike** front hand (14,−50), back hand (−26,10); **run** see run cycle.
- Ball: circle r10 white + 1.5 px `#C9D3DA`, seams two 2.5 px arcs (yellow `#FFCA28`, blue `#2F7BFF`).
- Net: line across the court, 4 px navy + 2 px white band on top, posts r6; shadow line (+0,+8) 6 px @18%.

---

## 4. Animation system

Guests are never frozen. Every guest = **locomotion** (moves & turns) + **secondary motion** (procedural, always on) + **state clips** (sport-specific actions) + **particles**.

### 4.1 Entity state
```
Guest {
  pos: Point, heading: Degrees, speed: px/s, turnRate: deg/s
  state: StateEnum, stateTime: s
  pose: Pose            // current, interpolated toward target each frame
  level: 1...4, skin, hair, mirror: Bool
  phase: random 0...1   // de-syncs loops between guests
}
```
Global: `windFrom` (degrees, direction the wind comes FROM; e.g. 270 = from the left/west). Default: onshore-crossshore.

### 4.2 Locomotion (all sports)
- Steering: `turnRate = clamp(shortestAngle(target − heading) * 3, ±maxTurn)`; `heading += turnRate * dt`.
- Speed eases: `speed += (targetSpeed − speed) * min(1, dt * accel)`.
- Paths: waypoints (buoys, wave line, run lane). Pick a new waypoint when within 30 px.
- **Lean into turns:** `lean = clamp(turnRate * speed * 0.0009, −8, 8)` px. Apply to the rider: torso shifts `lean` px toward the inside of the turn (local x), hands rise 3 px on the inside, outer hand reaches out 4 px.
- **Bank (fake 3D):** board `scaleX = 1 − 0.05 * |lean|/8`; board shadow shifts 2 px toward the outside of the turn.
- Point of sail (wind sports): `alpha = shortestAngle(heading − (windFrom + 180))` → 0 = dead downwind, ±180 = straight into the wind. **No-go zone: |alpha| > 135°** → sail luffs, speed drops to 0 over 2 s → must tack.

### 4.3 Secondary motion (procedural loops — run every frame, t in seconds, add `phase`)
| Loop | Formula | Applies to |
|---|---|---|
| Water bob | model rotation `±1.5° · sin(2π·0.4·t)`, shadow offset `±1 px` | everything on water |
| Breathing | torso scale `1 + 0.02·sin(2π·0.5·t)` | all riders |
| Balance sway | hands `y += 3·sin(2π·0.9·t)`, front & back in opposite phase | sideways riders |
| Leash wiggle | leash control point `x += 6·sin(2π·1.2·t)` | surf |
| Sail flutter | sail belly control points scale `1 ± 0.03` at 1.3 Hz; when luffing ±0.12 at 6 Hz | windsurf, sailing |
| Kite sweep | kite angle offset `20°·sin(2π·0.15·t)` (beginners 30° at 0.25 Hz, with speed ±15%) | kite |
| Wing pump | wing group rotation `±6°` at 1.2 Hz only while taking off | wing |
| Foil glide | rider + board `y ± 2 px` at 0.6 Hz, flying shadow offset `± 3 px` in sync | wing |
| Paddle cycle | period 0.9 s; each hand travels an ellipse from reach (±24,−30) to pull (±24,+30) relative to its shoulder; left & right half a period apart; speed pulses `+20%` on each stroke | surf prone |
| Run cycle | period 0.28 s (run) / 0.45 s (walk); `s = sin(2π·t/period)`; feet `(±9, ∓20·s)`, hands opposite to feet `(±28, ±18·s)`, torso rotation `±6°·s` | skim run, players, walking |

### 4.4 State machines (durations in seconds, poses interpolate with the listed easing)

Utility: `lerpPose(a, b, k)` lerps every point; `mirror(p)` maps x → −x; easings: `easeOutBack`, `easeInOutSine`.

#### 4.4.1 Surf
`PADDLE_OUT → WAIT → CATCH → POP_UP → RIDE → (KICK_OUT | WIPEOUT) → PADDLE_OUT`
- **PADDLE_OUT**: prone pose, paddle cycle, speed 25, heading toward the line-up behind the break.
- **WAIT**: prone, hands still, water bob only; 2–6 s random. Turn to face the beach 0.6 s before CATCH.
- **CATCH** 0.6 s: paddle cycle ×1.6 speed, speed 25 → 60.
- **POP_UP** 0.35 s, `easeOutBack`: `lerpPose(prone, sideways)`; torso rotates 90°; feet appear (scale 0 → 1); small spray burst at the tail.
- **RIDE** 3–8 s: sideways pose; follow the wave line; target heading oscillates `±35°` around the wave direction, period 2.2 s (S-carves) → lean + spray on every turn; speed 90 (pros 120, maxTurn 140°/s; beginners ride straight to the beach in whitewater, maxTurn 40°/s).
- **KICK_OUT** 0.8 s: hard turn 120° back over the wave, then back to prone (`lerpPose(sideways, prone)` 0.3 s).
- **WIPEOUT** (chance: L1 30%, L2 15%, L3 5%, L4 2% per ride): rider scale 1 → 0.7 and alpha → 0 in 0.3 s, splash ring at T, board drifts 0.6 s spinning 40°, rider re-appears prone next to it.

#### 4.4.2 Skim
`WAIT_SAND → RUN → DROP → JUMP_ON → GLIDE → STOP → WALK_BACK`
- **WAIT_SAND** 1–4 s: forward pose on sand; board carried at the right hand (board rotated 90°, scale 0.9, offset (30,4)).
- **RUN** 0.7 s: run cycle, speed 0 → 110 toward the water.
- **DROP** 0.12 s: board moves from the hand to the ground 20 px ahead, rotates to the heading.
- **JUMP_ON** 0.15 s: `lerpPose(forward, sideways)`; one spray burst.
- **GLIDE** until speed < 15: deceleration 70 px/s²; spray from the tail emitter scales with speed; pros: one 180° spin at 40% of the glide (0.5 s).
- **STOP** 0.3 s: step off (`sideways → forward`), pick up the board.
- **WALK_BACK**: walk cycle, speed 40, back up the beach.

#### 4.4.3 Windsurf
`REACH ⇄ TACK / GYBE`, plus `PLANING`, `FALL`, `UPHAUL`
- **Rig angle from point of sail**: `rigAngle = map(|alpha|, 0°→135°, 75°→12°)` toward leeward (bigger angle = sail let out further downwind). When the wind comes from the other side, mirror rig + rider.
- **REACH**: hands on the boom (boom points move with the rig); lean back 4 px windward.
- **PLANING** (speed > 70): feet into straps (back foot −12 px further aft), torso shifts 6 px windward, spray from the tail, wake longer.
- **TACK** 1.4 s (turning through the wind):
  0–0.4 board turns into the wind, rig angle → 0, sail luffs;
  0.4–0.9 rider steps around the FRONT of the mast (anchor follows an arc of radius 30 around M) and the pose mirrors;
  0.9–1.4 bear away on the new side, rig angle back out (mirrored).
- **GYBE** 0.9 s (turning downwind): board carves 160°; at 0.45 s the rig flips over the nose (rig angle sweeps through 180° in 0.25 s); feet swap.
- **FALL** (beginners only, 5% per tack): rider & rig drop: sail drawn flat on the water next to the board (alpha 0.8), rider reduced to head + shoulders with a water ring → **UPHAUL** 1.5 s: pull the rig back up (sail scale 0.3 → 1), rider climbs back to sideways pose.

#### 4.4.4 Kitesurf
`RIDE → TRANSITION → RIDE (other way)`, `JUMP`, beginner `BODY_DRAG`
- **Kite placement**: the kite sits downwind of the rider at angle `β` from the downwind line, on the side the rider is travelling: `β = +60°` going right, `−60°` going left. Position = `riderPos + D·(cos, sin)(downwindDir + β)`, D = 380. Add the kite sweep loop. Recompute the lines every frame from the tips to the bar ends.
- **RIDE**: board heading ≈ perpendicular to the wind (±15°); rider faces the kite and leans away 4 px; spray on the downwind rail.
- **TRANSITION** 1.6 s at the end of a run: speed → 20; kite swings via the zenith (β → 0 → −β); at the zenith the kite is overhead, so draw it at `0.35·D` from the rider and scale 1.15, with its shadow close to the rider; board heading rotates 180° and the rider switches stance (mirror).
- **JUMP** 1.4 s (L3+): 0–0.3 kite to the zenith; rider+board scale `1 → 1.18 → 1` (sine), their shadow offset `(7,10) → (40,55) → (7,10)`, board rotates +15° (grab) and back; landing splash ring + spray.
- **BODY_DRAG** (L1): no board, rider in water (head + shoulders, arms forward on the bar), pulled along at speed 30.

#### 4.4.5 Foil & wing
`SLOG → TAKEOFF → FLY ⇄ FOOT_SWITCH → TOUCHDOWN`
- **SLOG**: board on the water, normal shadow `(7,10)`, board wake, speed 20.
- **TAKEOFF** 1.6 s: wing pump loop + board scale pulses `1 → 1.03` at 1.2 Hz; shadow offset ramps `(7,10) → (26,36)`; board wake fades out, mast trickle fades in.
- **FLY**: foil glide loop; speed 70; gentle turns (maxTurn 50°/s).
- **FOOT_SWITCH** 1.0 s: wing group rotates 180° around the rider anchor, scaling to 0.85 at the midpoint (passing overhead); rider pose mirrors at 0.5 s.
- **TOUCHDOWN** 0.3 s: shadow snaps back to `(7,10)`, splash ring, speed → 20 → SLOG.

#### 4.4.6 Sailing
`SAIL → TACK | GYBE`, `HIKE`; races follow buoys
- **Boom angle from point of sail**: `boomAngle = map(|alpha|, 0°→135°, 80°→8°)` to leeward. Sailor always on the windward deck.
- **HIKE** (wind strength > 0.6 or L3+): sailor anchor moves 8 px outboard (over the gunwale), hull shadow shifts 3 px leeward, hull `scaleX 0.97` (heel).
- **TACK** 1.6 s: 0–0.5 turn head to wind, boom → 0°, sail luffs; 0.5–1.0 sailor crosses the cockpit (anchor x → −x through the centreline, torso scale 0.9 = ducking under the boom), pose mirrors at 0.75 s, tiller extension swaps hands; 1.0–1.6 boom swings out to the new leeward side, bear away.
- **GYBE** 0.6 s: boom swings across the stern in 0.35 s (`easeInOutSine`), sailor ducks and crosses.
- Race: waypoints = buoys; tack whenever the next buoy is inside the no-go zone (zig-zag upwind), gybe when rounding downwind marks.

#### 4.4.7 Beach volleyball & soccer
- Volleyball rally loop: `SERVE → PASS → SET → SPIKE → (ball crosses net) → PASS …`
  - Ball flight between two hand points: `h(t) = 4·H·k·(1−k)`, H = 60 (spike: 20, serve: 90), `k` = 0…1 over 0.9 s. Draw ball at the lerped ground position; ball scale `1 + h/200`; ball shadow at `ground + (0.35h, 0.5h)`, opacity 0.18.
  - The receiving player runs (run cycle, speed 80) to the predicted landing point, switches to the pass pose 0.25 s before contact.
  - SPIKE: spike pose + jump (scale 1 → 1.12 → 1 over 0.4 s, shadow offset grows ×3).
- Soccer: run cycle while moving; **KICK** 0.25 s: front foot extends to (0,−34), ball gets an impulse along the heading; idle players bob and turn to face the ball.

### 4.5 Particles
| Emitter | Spawn | Particle | Lifetime |
|---|---|---|---|
| Wake | every 6 px travelled, at each wake emitter | white round-capped dash 10×3, moves outward perpendicular to heading at 12 px/s | 0.9 s, alpha 0.8 → 0, scale 1 → 1.6 |
| Carve spray | on turns, at the outside rail, rate `= |turnRate|·speed·0.002` per frame | white dot r2–4, velocity outward 60–90 px/s with drag | 0.5 s |
| Skim spray | from the tail emitter, rate ∝ speed | droplet r2.5–3.5 + 2 trailing lines | 0.6 s |
| Splash ring | on wipeout / landing / touchdown | white ring stroke 3, radius 8 → 34 | 0.5 s, alpha 0.9 → 0 |
| Mast trickle | foil flying, every 8 px | thin 2.5 px white V, 50% opacity | 0.7 s |
- Particles live in **world space** (they stay behind when the guest moves). Cap 40 per guest.

### 4.6 Layer order (per guest, back to front)
1. wake & spray particles 2. shadows (world offset) 3. board / hull 4. deck details (stringer, pads, cockpit, straps) 5. rider legs + feet 6. sail & boom (windsurf, sailing) 7. arms 8. torso 9. head + hair 10. hands 11. **wing** (above hands) 12. kite lines 13. kite.

### 4.7 Performance / LOD
- Zoom < 0.5: skip arms/feet animation (static pose), skip particles except wake, update secondary loops at 15 Hz.
- Zoom < 0.3: draw board + torso + head only.
- Off-screen guests: update state & position only, no drawing.
- Re-use shape paths; only transforms and a few control points change per frame.

---

## 5. Acceptance checklist
- [ ] Every rider: head centred on the torso, hair cap + face crescent, no split head.
- [ ] Sideways riders: feet 60–70 px apart, both visible, no "splits".
- [ ] Board sizes match §1.1 (board ≈ rider height; not 2× bigger).
- [ ] Hands always on gear (boom, bar, strut, tiller, sheet) or clearly out for balance.
- [ ] Wing drawn over the hands; windsurf sail is solid (no hole).
- [ ] Skimboard: pointed nose forward, spray from the round tail.
- [ ] Shadows always offset down-right on screen, whatever the guest's heading.
- [ ] Windsurf & sailing: rider on the windward side, sail to leeward, both mirror on a tack.
- [ ] Kite sits to the side of travel, never straight ahead; lines follow it every frame.
- [ ] No guest is ever frozen: water bob + breathing at minimum, de-synced by `phase`.
- [ ] Turning makes riders lean and boards throw spray.
- [ ] 60 fps with 40 guests on an iPhone 12-class device.
