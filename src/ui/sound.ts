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

export const sound = {
  coin: () => blip([[880, 0], [1320, 0.07]], 'triangle'),
  buy: () => blip([[520, 0], [780, 0.06]], 'sine', 0.07),
  unlock: () => blip([[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]], 'triangle', 0.09),
  tap: () => blip([[660, 0]], 'sine', 0.05),
};
