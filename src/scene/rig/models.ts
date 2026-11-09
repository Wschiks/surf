// The static geometry of every model (README 3), in spec px, model frame: pivot = board/hull centre, heading -y.
// Paths are SVG path strings; the atlas bakes them with Path2D. Kept free of Phaser so the sims can use the numbers.

import type { GuestKind } from '../../config/sports';
import { pose, v, type Pose, type V } from './geom';

/** World px per spec px: a surfboard of 248 spec px is 31 world px long. */
export const K = 0.125;
/** Beach players are drawn a little bigger so they read on the courts. */
export const K_PLAYER = 0.17;

export const PATHS = {
  surf: 'M0,-124 C21,-98 33,-46 33,6 C33,60 26,98 16,118 Q0,126 -16,118 C-26,98 -33,60 -33,6 C-33,-46 -21,-98 0,-124 Z',
  skim: 'M0,81 C28,81 36,52 36,18 C36,-30 23,-70 0,-81 C-23,-70 -36,-30 -36,18 C-36,52 -28,81 0,81 Z',
  windsurf: 'M0,-160 C30,-130 48,-56 48,16 C48,86 42,130 35,156 Q0,166 -35,156 C-42,130 -48,86 -48,16 C-48,-56 -30,-130 0,-160 Z',
  /** Relative to the mast foot M. */
  wsail: 'M0,0 C106,12 172,114 143,202 C114,136 56,60 0,0 Z',
  wluff: 'M0,0 C48,5 86,26 114,54',
  /** Twin-tip in the drawn frame (long axis along x); baked turned so the leading tip points up. */
  kiteboard: 'M-80,-8 C-80,-20 -66,-25 -50,-24 Q0,-28 50,-24 C66,-25 80,-20 80,-8 L80,8 C80,20 66,25 50,24 Q0,28 -50,24 C-66,25 -80,20 -80,8 Z',
  kite: 'M-119,56 C-79,-74 79,-74 119,56 C87,20 39,0 0,0 C-39,0 -87,20 -119,56 Z',
  kiteEdge: 'M-119,56 C-79,-74 79,-74 119,56',
  foil: 'M-36,-65 C-36,-87 -20,-95 0,-95 C20,-95 36,-87 36,-65 L40,69 C40,89 28,95 0,95 C-28,95 -40,89 -40,69 Z',
  wing: 'M-120,70 C-110,10 -50,0 0,0 C50,0 110,10 120,70 C80,74 40,96 0,104 C-40,96 -80,74 -120,70 Z',
  wingEdge: 'M-120,70 C-110,10 -50,0 0,0 C50,0 110,10 120,70',
  hull: 'M0,-212 C42,-164 72,-68 72,36 C72,108 66,172 60,212 L-60,212 C-66,172 -72,108 -72,36 C-72,-68 -42,-164 0,-212 Z',
  /** Relative to the mast. */
  dsail: 'M2,3 L98,192 C122,117 80,50 2,3 Z',
};

// ---------------------------------------------------------------- surfing (3.1)

export const SURF = {
  stand: pose(v(-2, 48), [v(3, 16), v(3, 80)], [v(28, 0), v(-30, 96)]),
  /** Lying on the board, shoulders across it (2.2 prone); hands are set by the paddle cycle. */
  prone: pose(v(0, -22), [v(8, 66), v(-8, 66)], [v(-34, -40), v(34, 0)], {
    rx: 22,
    ry: 11,
    face: v(0, -1),
    hips: v(0, 16),
    legSpread: v(6, 0),
    legW: 10,
    foot: v(0, 0),
    body: 1,
    neck: 13,
  }),
  wake: [v(-12, 124), v(12, 124)] as V[],
  tail: v(0, 118),
};

// ---------------------------------------------------------------- skimboarding (3.2)

export const SKIM = {
  stand: pose(v(-2, -4), [v(3, -36), v(3, 28)], [v(-38, -48), v(36, 40)]),
  tail: v(0, 82),
};

/** Standing on the sand, facing forward (2.2 forward): feet under the body, hands ready. */
export const FORWARD: Pose = pose(v(0, 0), [v(9, 0), v(-9, 0)], [v(-28, 16), v(28, 16)], {
  rx: 28,
  ry: 14,
  face: v(0, -1),
  hips: v(0, 2),
  legSpread: v(6, 0),
  legW: 10,
  legs: 0,
  foot: v(7.5, 5.5),
  neck: 6,
});

// ---------------------------------------------------------------- windsurfing (3.3)

export const WIND = {
  mast: v(0, -16),
  /** Angle of the boom (from the mast toward the stern, to starboard) as the sail is drawn. */
  drawnAngle: Math.atan2(72.5, 106),
  /** Hands on the windward boom tube, measured from the mast, in the drawn sail. */
  boomHands: [v(22, 63), v(52, 104)] as [V, V],
  stand: pose(v(2, 94), [v(-8, 70), v(8, 134)], [v(22, 47), v(52, 88)], {
    rot: (-36 * Math.PI) / 180,
  }),
  wake: [v(-24, 156), v(24, 156)] as V[],
  tail: v(0, 158),
};

// ---------------------------------------------------------------- kitesurfing (3.4)

/** The kite rider is drawn with the board across (travel = +x); this turns a drawn point into the model frame. */
export const fromDrawn = (p: V): V => ({ x: p.y, y: -p.x });

export const KITE = {
  /** On screen the kite flies about 380 px from the rider (shortened from 20-25 m; the angle is kept). */
  lineLength: 380,
  /** Line attach points on the kite (kite frame) and bar ends (drawn rider frame). */
  tips: [v(-115, 52), v(115, 52)] as [V, V],
  barEnds: [v(-20, -34), v(20, -34)] as [V, V],
  bar: v(0, -34),
  stand: pose(v(0, 18), [v(32, -1), v(-32, -1)], [v(14, -34), v(-14, -34)], {
    rx: 26,
    ry: 14,
    face: v(0, -1),
    hips: v(0, 14),
    legSpread: v(8, 0),
    foot: v(8.5, 6),
    neck: 5,
  }),
  wake: [v(-70, 20), v(70, 20)] as V[],
};

// ---------------------------------------------------------------- foil and wing (3.5)

export const WING = {
  /** Where the wing is held (between the two handles), in the board frame, and its angle as drawn. */
  grip: v(70 - 80 * Math.sin((37 * Math.PI) / 180), -101 + 80 * Math.cos((37 * Math.PI) / 180)),
  angle: (37 * Math.PI) / 180,
  /** Handles measured from the grip, in the wing frame. */
  handles: [v(0, -14), v(0, 14)] as [V, V],
  stand: pose(v(-6, 3), [v(-1, -27), v(1, 35)], [v(28, -45), v(11, -22)], {
    rot: (-20 * Math.PI) / 180,
    rx: 14,
    ry: 25,
  }),
  mast: v(0, 105),
  wake: [v(-20, 95), v(20, 95)] as V[],
};

// ---------------------------------------------------------------- sailing (3.6)

export const SAIL = {
  mast: v(0, -100),
  boomEnd: v(98, 92),
  drawnAngle: Math.atan2(98, 190),
  block: v(12, 153),
  tiller: v(0, 148),
  sailor: pose(v(-70, 120), [v(-2, 100), v(-2, 146)], [v(-32, 100), v(-38, 154)], {
    rx: 14,
    ry: 25,
    hips: v(-60, 121),
    legSpread: v(0, -11),
    foot: v(7.5, 5.5),
    neck: 4,
  }),
  wake: [v(-50, 212), v(50, 212)] as V[],
};

// ---------------------------------------------------------------- gear per section (docs/SPORTS.md)
// Every section has its own board, boat or sail, so you can tell the section just by looking.

export const GEAR_PATHS = {
  /** Surf school: a wide soft-top foam board with a round nose (8 ft). */
  soft: 'M0,-110 C30,-106 40,-62 40,0 C40,58 34,96 0,108 C-34,96 -40,58 -40,0 C-40,-62 -30,-106 0,-110 Z',
  /** Longboard: long, wide round nose (9 ft 6). */
  long: 'M0,-150 C27,-148 38,-112 38,-40 C38,40 34,110 22,146 Q0,152 -22,146 C-34,110 -38,40 -38,-40 C-38,-112 -27,-148 0,-150 Z',
  /** Big wave gun: long and narrow, pointed both ends. */
  gun: 'M0,-152 C20,-112 29,-40 29,10 C29,72 18,122 0,152 C-18,122 -29,72 -29,10 C-29,-40 -20,-112 0,-152 Z',
  /** Small flatland skimboard. */
  skimSmall: 'M0,62 C22,62 28,40 28,12 C28,-26 18,-54 0,-62 C-18,-54 -28,-26 -28,12 C-28,40 -22,62 0,62 Z',
  /** Windsurf school board: very wide and stable. */
  windWide: 'M0,-150 C46,-138 66,-70 66,10 C66,90 58,132 46,150 Q0,160 -46,150 C-58,132 -66,90 -66,10 C-66,-70 -46,-138 0,-150 Z',
  /** Slalom race board: narrow nose, wide square tail. */
  windRace: 'M0,-150 C22,-120 36,-50 40,20 C44,80 46,128 44,150 L-44,150 C-46,128 -44,80 -40,20 C-36,-50 -22,-120 0,-150 Z',
  /** Freestyle board: short and wide. */
  windFree: 'M0,-118 C38,-104 50,-50 50,10 C50,70 44,104 34,118 Q0,126 -34,118 C-44,104 -50,70 -50,10 C-50,-50 -38,-104 0,-118 Z',
  /** Wave board: small, narrow, pointed both ends. */
  windWave: 'M0,-124 C24,-96 34,-40 34,10 C34,66 24,104 0,122 C-24,104 -34,66 -34,10 C-34,-40 -24,-96 0,-124 Z',
  /** Kite school: a big, wide twin-tip (drawn along x like the twin-tip). */
  kiteBig: 'M-96,-12 C-96,-28 -80,-34 -60,-33 Q0,-38 60,-33 C80,-34 96,-28 96,-12 L96,12 C96,28 80,34 60,33 Q0,38 -60,33 C-80,34 -96,28 -96,12 Z',
  /** Strapless wave kiteboard: a small surfboard (drawn along x, nose at +x). */
  kiteDir: 'M92,0 C70,-22 30,-27 -10,-27 C-56,-27 -84,-20 -90,0 C-84,20 -56,27 -10,27 C30,27 70,22 92,0 Z',
  /** Foil school: a big, thick, square board. */
  foilBig: 'M-48,-90 C-48,-112 -28,-118 0,-118 C28,-118 48,-112 48,-90 L52,96 C52,114 36,118 0,118 C-36,118 -52,114 -52,96 Z',
  /** Downwind foil board: long and narrow. */
  foilDown: 'M0,-160 C18,-140 30,-90 32,-20 L34,120 C34,146 24,156 0,156 C-24,156 -34,146 -34,120 L-32,-20 C-30,-90 -18,-140 0,-160 Z',
  /** Pro foil board: small and short. */
  foilPro: 'M-32,-56 C-32,-72 -18,-78 0,-78 C18,-78 32,-72 32,-56 L36,62 C36,76 26,80 0,80 C-26,80 -36,76 -36,62 Z',
  /** Optimist: a small square-nosed box. */
  opti: 'M-46,-118 L46,-118 C60,-110 68,-70 70,-10 C72,50 70,96 66,118 L-66,118 C-70,96 -72,50 -70,-10 C-68,-70 -60,-110 -46,-118 Z',
  /** One hull of a catamaran (two of them, 150 px apart). */
  catHull: 'M0,-200 C16,-160 24,-80 24,0 C24,90 20,160 16,196 L-16,196 C-20,160 -24,90 -24,0 C-24,-80 -16,-160 0,-200 Z',
  /** Offshore racing yacht (shortened, like the kite lines): pointed bow, wide stern. */
  yacht: 'M0,-330 C60,-270 104,-150 108,0 C110,130 104,250 96,320 L-96,320 C-104,250 -110,130 -108,0 C-104,-150 -60,-270 0,-330 Z',
  /** Spinnaker: a big round balloon sail (relative to the bow). */
  spin: 'M0,0 C-110,-30 -150,-170 -60,-250 C0,-290 60,-290 120,-250 C210,-170 170,-30 60,0 Z',
  /** Jet ski hull. */
  jetski: 'M0,-78 C24,-70 34,-40 34,0 C34,40 30,62 26,74 L-26,74 C-30,62 -34,40 -34,0 C-34,-40 -24,-70 0,-78 Z',
  /** Committee (race) boat. */
  committee: 'M0,-190 C46,-150 70,-70 70,20 C70,110 66,160 60,190 L-60,190 C-66,160 -70,110 -70,20 C-70,-70 -46,-150 0,-190 Z',
};

/** A sailing boat: where the mast stands, how big the sail is (x the drawn dinghy sail), where the sheet and tiller are. */
export interface Boat {
  frame: string;
  mast: V;
  sail: number;
  block: V;
  tiller: V;
  /** Where the sailors sit (drawn on the port side, mirrored for the other tack). */
  seats: V[];
  /** Spec px across the hull at the seats: how far out a hiking sailor leans. */
  beam: number;
  wake: V[];
}

export const BOATS: Record<'opti' | 'cat' | 'dinghy' | 'yacht', Boat> = {
  opti: {
    frame: 'b-opti',
    mast: v(0, -86),
    sail: 0.66,
    block: v(0, 60),
    tiller: v(0, 80),
    seats: [v(-46, 52)],
    beam: 60,
    wake: [v(-50, 118), v(50, 118)],
  },
  cat: {
    frame: 'b-cat',
    mast: v(0, -80),
    sail: 1.2,
    block: v(0, 110),
    tiller: v(0, 150),
    seats: [v(-128, 60), v(-118, 128)],
    beam: 150,
    wake: [v(-150, 196), v(150, 196)],
  },
  dinghy: {
    frame: 'b-hull',
    mast: SAIL.mast,
    sail: 1,
    block: SAIL.block,
    tiller: SAIL.tiller,
    seats: [v(-70, 120)],
    beam: 72,
    wake: SAIL.wake,
  },
  yacht: {
    frame: 'b-yacht',
    mast: v(0, -120),
    sail: 2.1,
    block: v(0, 230),
    tiller: v(0, 270),
    seats: [v(-92, 40), v(-92, 120), v(-92, 200), v(-60, 270)],
    beam: 108,
    wake: [v(-90, 320), v(90, 320)],
  },
};

/** What a section rides: board frame, tint, sail / kite / wing size and extras. */
export interface Gear {
  board: string;
  /** Tint the board with the guest colour (soft tops, longboards, small skimboards). */
  tintBoard?: boolean;
  /** Size of the sail, kite or wing (1 = the spec drawing). */
  sail: number;
  /** A race number on the sail. */
  number?: boolean;
  /** A see-through window in the sail (freestyle). */
  window?: boolean;
  /** One colour for every kite / wing / sail of this section (a school), or each guest its own. */
  color?: string;
  boat?: keyof typeof BOATS;
  /** Rider size (kids are smaller). */
  rider: number;
  /** Helmet for everyone (schools, pros). */
  helmet?: boolean;
  /** Impact vest colour over the outfit. */
  vest?: string;
}

export const GEAR: Record<string, Gear[]> = {
  surfer: [
    { board: 'b-soft', tintBoard: true, sail: 1, rider: 0.82 },
    { board: 'b-long', tintBoard: true, sail: 1, rider: 1 },
    { board: 'b-surf', sail: 1, rider: 1 },
    { board: 'b-gun', sail: 1, rider: 1, helmet: true, vest: '#FF5A1F' },
  ],
  skimmer: [
    { board: 'b-wood', sail: 1, rider: 0.82 },
    { board: 'b-skim-small', tintBoard: true, sail: 1, rider: 1 },
    { board: 'b-skim', sail: 1, rider: 1 },
    { board: 'b-skim-carbon', sail: 1, rider: 1 },
  ],
  windsurfer: [
    { board: 'b-wind-wide', sail: 0.7, rider: 0.95, color: '#4FC3F7' },
    { board: 'b-wind-race', sail: 1.12, rider: 1, number: true },
    { board: 'b-wind-free', sail: 0.88, rider: 1, window: true },
    { board: 'b-wind-wave', sail: 0.8, rider: 1 },
  ],
  kiter: [
    {
      board: 'b-kite-big',
      sail: 0.85,
      rider: 1,
      color: '#29B6F6',
      helmet: true,
    },
    { board: 'b-kite', sail: 1, rider: 1 },
    { board: 'b-kite-boots', sail: 0.9, rider: 1, vest: '#222831' },
    { board: 'b-kite', sail: 1.1, rider: 1, helmet: true, vest: '#FF5A1F' },
  ],
  foiler: [
    {
      board: 'b-foil-big',
      sail: 0.78,
      rider: 1,
      color: '#4FC3F7',
      helmet: true,
    },
    { board: 'b-foil', sail: 1, rider: 1 },
    { board: 'b-foil-down', sail: 0.95, rider: 1 },
    {
      board: 'b-foil-pro',
      sail: 0.85,
      rider: 1,
      helmet: true,
      vest: '#FF5A1F',
    },
  ],
  sailor: [
    { board: 'b-opti', sail: 1, rider: 0.8, boat: 'opti' },
    { board: 'b-hull', sail: 1, rider: 1, boat: 'dinghy' },
    { board: 'b-hull', sail: 1, rider: 1, boat: 'dinghy', number: true },
    { board: 'b-yacht', sail: 1, rider: 1, boat: 'yacht' },
  ],
};

/** Boat hire mixes dinghies and catamarans: every other guest sails a catamaran. */
export function gearFor(kind: string, level: number, i: number): Gear {
  const g = GEAR[kind]?.[Math.min(3, Math.max(0, level - 1))] ?? {
    board: 'b-surf',
    sail: 1,
    rider: 1,
  };
  if (kind === 'sailor' && level === 2 && i % 2 === 1) return { ...g, board: 'b-cat', boat: 'cat' };
  if (kind === 'kiter' && level === 4 && i % 2 === 1) return { ...g, board: 'b-kite-dir' };
  return g;
}

/** Most guests drawn in one zone, per sport and section (big gear and big waves need room). */
const VISIBLE: Record<GuestKind, number[]> = {
  surfer: [10, 8, 8, 2],
  skimmer: [8, 8, 8, 6],
  windsurfer: [7, 6, 6, 5],
  kiter: [5, 5, 5, 4],
  foiler: [6, 6, 5, 5],
  sailor: [6, 5, 5, 3],
  walker: [0, 0, 0, 0],
};

export function visibleGuests(kind: GuestKind, level: number) {
  return VISIBLE[kind][Math.min(3, Math.max(0, level - 1))];
}

