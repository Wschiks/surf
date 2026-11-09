import type { GuestKind } from '../../config/sports';
import type { Guest, Zone } from './sim';
import { foil } from './sports/foil';
import { kite } from './sports/kite';
import { sail, stepCommittee, stepRace } from './sports/sail';
import { skim } from './sports/skim';
import { stepJetSki, stepWaves, surf } from './sports/surf';
import { stepSlalom, windsurf } from './sports/wind';

/** Once per frame for the whole zone, before the guests: waves, race clocks, helpers (jet skis, committee boat). */
export function stepZone(z: Zone, kind: GuestKind, dt: number) {
  if (kind === 'surfer' && z.level >= 3) stepWaves(z, dt);
  if (kind === 'windsurfer' && z.level === 2) stepSlalom(z, dt);
  if (kind === 'sailor') stepRace(z, dt);
  for (const e of z.extras) {
    if (e.kind === 'jetski') stepJetSki(e, z, dt);
    if (e.kind === 'committee') stepCommittee(e, z, dt);
  }
}

/** One frame of one guest: its sport moves it and fills in its Look. */
export function stepGuest(g: Guest, z: Zone, n: number, dt: number) {
  g.st += dt;
  switch (g.kind) {
    case 'surfer':
      return surf(g, z, n, dt);
    case 'skimmer':
      return skim(g, z, n, dt);
    case 'windsurfer':
      return windsurf(g, z, n, dt);
    case 'kiter':
      return kite(g, z, n, dt);
    case 'foiler':
      return foil(g, z, n, dt);
    case 'sailor':
      return sail(g, z, n, dt);
    default:
      return;
  }
}
