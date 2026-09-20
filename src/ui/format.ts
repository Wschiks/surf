const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

/** 1234 -> 1.23K, 12 -> 12, 0.5 -> 0.5 */
export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 10) return n < 1 && n > 0 ? n.toFixed(2).replace(/0$/, '') : n.toFixed(n % 1 === 0 ? 0 : 1);
  if (n < 1000) return Math.floor(n).toString();
  let i = 0;
  let v = n;
  while (v >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i++;
  }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + SUFFIXES[i];
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (s < 3600) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtSeconds(seconds: number): string {
  return seconds < 10 ? seconds.toFixed(1) + 's' : Math.round(seconds) + 's';
}

/** A drawn gold coin (the coin emoji looks different on every phone). */
export const COIN = '<i class="coin"></i>';
