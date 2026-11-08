const SMALL = ['', 'K', 'M', 'B', 'T'];

/**
 * The letters after a number, per step of x1000: K, M, B, T, then aa, bb, cc ... zz, then aaa, bbb ... (never runs out).
 */
export function suffix(step: number): string {
  if (step < SMALL.length) return SMALL[step];
  const k = step - SMALL.length;
  return String.fromCharCode(97 + (k % 26)).repeat(2 + Math.floor(k / 26));
}

/** 1234 -> 1.23K, 12 -> 12, 0.5 -> 0.5 */
export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 10) return n < 1 && n > 0 ? n.toFixed(2).replace(/0$/, '') : n.toFixed(n % 1 === 0 ? 0 : 1);
  if (n < 1000) return Math.floor(n).toString();
  let i = 0;
  let v = n;
  while (v >= 1000) {
    v /= 1000;
    i++;
  }
  let text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  if (parseFloat(text) >= 1000) {
    i++;
    text = (parseFloat(text) / 1000).toFixed(2);
  }
  return text + suffix(i);
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (s < 3600) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** A length of time as people say it: 2 min, 1 min 30 s, 40 s. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
}

/** A countdown clock: 1:45. */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtSeconds(seconds: number): string {
  // two decimals: one Faster turnover level is only a few hundredths of a second
  return seconds < 100 ? seconds.toFixed(2) + 's' : Math.round(seconds) + 's';
}

/** A drawn gold coin (the coin emoji looks different on every phone). */
export const COIN = '<i class="coin"></i>';
