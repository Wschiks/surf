// The picture at the top of the rescue helicopter's popup: the same yellow helicopter as on the map (src/scene/heli.ts),
// seen from the side, hovering over the sea with its rotor turning, a lifebuoy on the winch line for a waving swimmer.

/** The helicopter, nose to the left, in the shapes of the map's helicopter (about -90..95 by -45..16). */
const HELI = `
  <g class="hp-heli">
    <ellipse cx="-9" cy="-33" rx="75" ry="3.5" fill="#fff" opacity="0.14"/>
    <path d="M18,-14 L70,-12 L76,-24 L84,-24 L82,-6 L70,-4 L18,0 Z" fill="#ffc21a" stroke="#2a2a2a" stroke-width="2" stroke-linejoin="round"/>
    <rect x="48" y="-12.5" width="7" height="9" fill="#e53935"/>
    <rect x="55" y="-12.2" width="4" height="8.6" fill="#fff"/>
    <path d="M-26,-26 H12 A10,10 0 0 1 22,-16 V2 A6,6 0 0 1 16,8 H-30 A14,14 0 0 1 -44,-6 V-8 A18,18 0 0 1 -26,-26 Z" fill="#ffc21a" stroke="#2a2a2a" stroke-width="2.2"/>
    <path d="M-29,-22 H-24 A3,3 0 0 1 -21,-19 V-10 A3,3 0 0 1 -24,-7 H-37 A4,4 0 0 1 -41,-11 V-10 A12,12 0 0 1 -29,-22 Z" fill="#1f3a52"/>
    <rect x="-38" y="-20" width="8" height="5" rx="2" fill="#8fd3ff" opacity="0.55"/>
    <rect x="-15" y="-20" width="16" height="22" fill="#2b2f33"/>
    <rect x="-11" y="-12" width="8" height="12" rx="2" fill="#ff5a1f"/>
    <circle cx="-7" cy="-15" r="3.4" fill="#f2c9a0"/>
    <rect x="-11" y="-19.5" width="8" height="3.5" rx="1.5" fill="#fff"/>
    <rect x="2" y="-4" width="19" height="4" fill="#e53935"/>
    <rect x="9" y="-17" width="6" height="2" fill="#fff"/>
    <rect x="11" y="-19" width="2" height="6" fill="#fff"/>
    <path d="M-30,8 V14 M10,8 V14 M-46,11 L-42,14 H20" fill="none" stroke="#2a2a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="-12" y="-32" width="6" height="7" fill="#4a5058"/>
    <g transform="translate(-9,-33)"><rect class="hp-rotor" x="-75" y="-1.6" width="150" height="3.2" rx="1.6" fill="#30353b"/></g>
    <g transform="translate(80,-16)"><g class="hp-tail"><rect x="-1.2" y="-9" width="2.4" height="18" fill="#30353b" opacity="0.85"/><rect x="-9" y="-1.2" width="18" height="2.4" fill="#30353b" opacity="0.85"/></g></g>
    <path d="M-7,2 V42" stroke="#e8eef3" stroke-width="1.6"/>
    <g transform="translate(-7,48)">
      <circle r="7.5" fill="none" stroke="#ff4d3a" stroke-width="4.4"/>
      <circle r="7.5" fill="none" stroke="#fff" stroke-width="4.4" stroke-dasharray="5.9 5.9"/>
    </g>
  </g>`;

/** The header picture: sky over the sea, light wave marks, the swimmer, the hovering helicopter. */
export function heliPicture(): string {
  const waves = [
    [24, 128],
    [84, 146],
    [138, 124],
    [256, 142],
    [314, 124],
  ]
    .map(([x, y]) => `<path d="M${x},${y} q8,-6 16,0 t16,0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.35"/>`)
    .join('');
  return `
  <svg class="hp-pic" viewBox="0 0 360 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="hp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f86c8"/><stop offset="1" stop-color="#7cc8ee"/></linearGradient>
      <linearGradient id="hp-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1aa3cf"/><stop offset="1" stop-color="#0e6f9e"/></linearGradient>
    </defs>
    <rect width="360" height="160" fill="url(#hp-sky)"/>
    <circle cx="44" cy="34" r="46" fill="#fff" opacity="0.08"/>
    <path d="M0,112 C40,104 80,118 120,110 S200,104 240,112 S320,118 360,108 V160 H0 Z" fill="url(#hp-sea)"/>
    ${waves}
    <g transform="translate(198,136)">
      <ellipse rx="13" ry="4" fill="#fff" opacity="0.35"/>
      <rect x="-6" y="-9" width="12" height="9" rx="4" fill="#ff7a1a"/>
      <circle cy="-13" r="5" fill="#c98a5a"/>
      <path class="hp-wave" d="M5,-8 L13,-19" stroke="#c98a5a" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g transform="translate(205,62)"><g class="hp-bob">${HELI}</g></g>
  </svg>`;
}
