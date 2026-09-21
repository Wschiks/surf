// Custom flat icons, drawn as inline SVG (24 x 24). They use the text colour (currentColor), so CSS can colour them.
// Nothing here is an emoji or an image file.

const SHAPES: Record<string, string> = {
  coin: '<circle cx="12" cy="12" r="9.5" fill="#ffc233" stroke="#d98a0b" stroke-width="2"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#e9a516" stroke-width="1.8"/>',
  coins:
    '<path d="M4.5 6.5v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-4" fill="#ffc233" stroke="#d98a0b" stroke-width="1.6"/><path d="M4.5 11.5v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-4" fill="#ffc233" stroke="#d98a0b" stroke-width="1.6"/><ellipse cx="12" cy="6.5" rx="7.5" ry="3" fill="#ffd968" stroke="#d98a0b" stroke-width="1.6"/>',
  star: '<path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z" fill="#ffc233" stroke="#d98a0b" stroke-width="1.5" stroke-linejoin="round"/>',
  gear: '<circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.4 5.4l2.1 2.1M16.5 16.5l2.1 2.1M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="3" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  play: '<path d="M8 5.2v13.6l11-6.8z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.6 4.6L19 7.6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  dot: '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  arrow: '<path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  flag: '<path d="M6 21V3.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M6.6 4.5h11.4l-2.6 4 2.6 4H6.6z" fill="currentColor"/>',
  trophy:
    '<path d="M7 3.5h10v6a5 5 0 01-10 0z" fill="currentColor"/><path d="M7 5.5H3.8c0 3 1.5 4.6 3.6 5M17 5.5h3.2c0 3-1.5 4.6-3.6 5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 14.5V18M8 20.5h8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 8.6a4.8 4.8 0 010 6.8M18.2 6a8.4 8.4 0 010 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  people: '<circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.5 19.5c0-4 3-6.2 6.5-6.2s6.5 2.2 6.5 6.2z" fill="currentColor"/><circle cx="17" cy="9" r="2.7" fill="currentColor" opacity=".55"/><path d="M16.6 13.5c3 .3 4.9 2.2 4.9 5.5h-4.6" fill="currentColor" opacity=".55"/>',
  tag: '<path d="M3.5 12V4.5a1 1 0 011-1H12a1 1 0 01.7.3l7.6 7.6a1 1 0 010 1.4l-6.9 6.9a1 1 0 01-1.4 0L3.8 12.7a1 1 0 01-.3-.7z" fill="currentColor"/><circle cx="8.2" cy="8.2" r="1.8" fill="#fff"/>',
  bolt: '<path d="M13.6 2.5L5 13.6h6l-1.6 7.9L19 10h-6.2z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
  manager:
    '<circle cx="12" cy="7.5" r="3.7" fill="currentColor"/><path d="M4.5 21c0-4.6 3-7.2 7.5-7.2s7.5 2.6 7.5 7.2z" fill="currentColor"/><path d="M12 15.4l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="#ffc233"/>',
  // --- home screen buttons
  beach: '<path d="M3 12.5a9 9 0 0118 0z" fill="currentColor"/><path d="M12 12.5V20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3.5 21.2h17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>',
  sports:
    '<ellipse cx="12" cy="11" rx="3.3" ry="9" transform="rotate(38 12 11)" fill="currentColor"/><path d="M9.4 5.8l5.2 10.4" stroke="rgba(255,255,255,.7)" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 21c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
  // --- the six sports
  wave: '<ellipse cx="12" cy="11" rx="3.3" ry="9" transform="rotate(38 12 11)" fill="currentColor"/><path d="M9.4 5.8l5.2 10.4" stroke="rgba(255,255,255,.7)" stroke-width="1.3" stroke-linecap="round"/><path d="M2.5 21c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0 3.5-1.5 5.5 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
  skim: '<circle cx="12" cy="12" r="8.5" fill="currentColor"/><path d="M12 4.6v14.8" stroke="rgba(255,255,255,.7)" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6"/>',
  wind: '<path d="M11 2.5v13.5H4z" fill="currentColor"/><path d="M12.6 5c4.4 3 5.4 7.5 4.9 11h-4.9z" fill="currentColor" opacity=".6"/><path d="M3.5 18.5h17l-2.6 3H6.1z" fill="currentColor"/>',
  kite: '<path d="M12 2.5l7 7.4-7 5.6-7-5.6z" fill="currentColor"/><path d="M12 2.5v13" stroke="rgba(255,255,255,.65)" stroke-width="1.3"/><path d="M12 15.5c0 3.2-3.2 3-3.2 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  foil: '<path d="M2 10.5c3-5.5 17-5.5 20 0-3.6-2-16.4-2-20 0z" fill="currentColor"/><path d="M12 10v9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 20h11" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  sail: '<path d="M11.5 3v12H5z" fill="currentColor"/><path d="M13.2 6c4.2 2.5 5.3 6.5 5.3 9h-5.3z" fill="currentColor" opacity=".6"/><path d="M3.5 16.8h17l-3 4H6.5z" fill="currentColor"/>',
  // --- beach buildings
  shop: '<path d="M3 9.5L4.6 4h14.8L21 9.5z" fill="currentColor"/><path d="M3 9.5h18a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0z" fill="currentColor" opacity=".6"/><rect x="5" y="12.5" width="14" height="8" rx="1.2" fill="currentColor"/>',
  cafe: '<path d="M4.5 9.5h11V14a4 4 0 01-4 4h-3a4 4 0 01-4-4z" fill="currentColor"/><path d="M15.5 10.8h1.4a2.4 2.4 0 010 4.8h-1.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 3.5c-1 1.3 1 2.1 0 3.6M12 3.5c-1 1.3 1 2.1 0 3.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".65"/>',
  shower: '<path d="M4 21V9.5a5.5 5.5 0 0110.5-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 9h9.5L20 12.6h-6.4z" fill="currentColor"/><path d="M14.5 15.5v2.2M17.2 15.5v3.4M19.9 15.5v2.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  lifeguard: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="5" stroke-dasharray="5.9 5.9"/>',
};

export type IconName = keyof typeof SHAPES;

/** An inline SVG icon. `size` is the CSS size (default 1em). */
export function icon(name: string, size?: string): string {
  const shape = SHAPES[name] ?? SHAPES.dot;
  const style = size ? ` style="width:${size};height:${size}"` : '';
  return `<svg class="ic ic-${name}" viewBox="0 0 24 24" aria-hidden="true"${style}>${shape}</svg>`;
}

/** A coloured rounded square with a white icon on it. */
export function tile(name: string, color: string, size = 44): string {
  return `<span class="tile" style="background:${color};width:${size}px;height:${size}px">${icon(name, Math.round(size * 0.58) + 'px')}</span>`;
}
