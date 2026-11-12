// Tiny sound effects made with the Web Audio API (no audio files). Muted state is remembered.

const KEY = 'surf-tycoon-muted';
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem(KEY) === '1';
} catch {
  // storage blocked: sound stays on
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(notes: [number, number][], type: OscillatorType = 'sine', volume = 0.08) {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  notes.forEach(([freq, at], i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = now + at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16 + (i === notes.length - 1 ? 0.12 : 0));
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

/** A burst of filtered noise: the rush and crash of a wave. */
function wave(big = false) {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  const len = 2.2;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  // a fixed pseudo-random noise (no Math.random in the game)
  let x = 0x2545f491;
  for (let i = 0; i < d.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    d[i] = ((x >>> 0) / 4294967296) * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(big ? 2600 : 2000, now + 0.55);
  filter.frequency.exponentialRampToValueAtTime(500, now + 1.9);
  const gain = c.createGain();
  const peak = big ? 0.32 : 0.24;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak * 0.5, now + 0.4);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.6);
  gain.gain.exponentialRampToValueAtTime(peak * 0.35, now + 1.0);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.1);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + len);
}

/** The rotor of the rescue helicopter: a soft whup-whup that comes and goes (filtered noise, pulsed). */
function rotor() {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  const len = 3;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  let x = 0x1f2e3d4c;
  for (let i = 0; i < d.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    d[i] = ((x >>> 0) / 4294967296) * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 320;
  filter.Q.value = 0.8;
  const pulse = c.createGain();
  const lfo = c.createOscillator();
  const depth = c.createGain();
  lfo.frequency.value = 11;
  depth.gain.value = 0.5;
  pulse.gain.value = 0.5;
  lfo.connect(depth).connect(pulse.gain);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
  src.connect(filter).connect(pulse).connect(gain).connect(c.destination);
  src.start(now);
  lfo.start(now);
  src.stop(now + len);
  lfo.stop(now + len);
}

/** A deep boom: a falling low tone (the rarity title slamming in). */
function boom(big = false) {
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(big ? 150 : 190, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.55);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(big ? 0.34 : 0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.75);
}

/** The chest opens: a short rising run, longer and brighter for a rarer piece. */
const OPEN_NOTES: Record<string, [number, number][]> = {
  common: [
    [523, 0],
    [784, 0.08],
  ],
  rare: [
    [523, 0],
    [659, 0.07],
    [988, 0.14],
  ],
  epic: [
    [523, 0],
    [659, 0.06],
    [784, 0.12],
    [1175, 0.2],
  ],
  legendary: [
    [523, 0],
    [659, 0.06],
    [784, 0.12],
    [1047, 0.18],
    [1319, 0.26],
    [1568, 0.36],
  ],
};

export const sound = {
  /** The big wave of a box opening (bigger for the golden box). */
  wave,
  /** The chest rattles before it opens. */
  rattle: () =>
    blip(
      [
        [150, 0],
        [190, 0.11],
      ],
      'square',
      0.035,
    ),
  /** The rarity title slams in. */
  boom,
  /** The rescue helicopter arrives. */
  rotor,
  /** A bright shimmer (the item rising out of the chest). */
  chime: () =>
    blip(
      [
        [1568, 0],
        [2093, 0.07],
        [2637, 0.14],
        [3136, 0.21],
      ],
      'sine',
      0.05,
    ),
  /** The lid flies off. */
  open: (rarity: string) => blip(OPEN_NOTES[rarity] ?? OPEN_NOTES.common, 'triangle', rarity === 'legendary' ? 0.11 : 0.09),
  coin: () =>
    blip(
      [
        [880, 0],
        [1320, 0.07],
      ],
      'triangle',
    ),
  buy: () =>
    blip(
      [
        [520, 0],
        [780, 0.06],
      ],
      'sine',
      0.07,
    ),
  unlock: () =>
    blip(
      [
        [523, 0],
        [659, 0.1],
        [784, 0.2],
        [1047, 0.3],
      ],
      'triangle',
      0.09,
    ),
  tap: () => blip([[660, 0]], 'sine', 0.05),
};
