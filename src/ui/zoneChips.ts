import { rectCenter, toWorld } from '../config/layout';
import { BEACH_ZONES, SPORTS, ZONES, type AnyZoneRef, type SportId } from '../config/sports';
import { fieldsArea } from '../config/beach';
import { beachSportOpen } from '../core/economy';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import { expansionNeededFor } from '../core/unlocks';
import type { LabelLayer } from './labels';
import { fmt } from './format';
import { icon } from './icons';

export interface ChipHandlers {
  onOpen: (id: string) => void;
  /** Quick action: collect or start a waiting zone. */
  onQuick: (id: string) => void;
  /** Zoomed far out, a sport's one badge was tapped: zoom in on that sport. */
  onSport: (sport: SportId) => void;
}

/** Zoomed out further than this (screen px per map unit), each sport shows one badge instead of one per zone. */
export const MERGE_PPU = 75;

/** A small round badge on every zone: the sport, the level, and what the zone is doing. No text floats over the map. */
export class ZoneChips {
  constructor(
    private labels: LabelLayer,
    private h: ChipHandlers,
  ) {}

  update(state: GameState, ppu: number, selected: string | null) {
    const merged = ppu < MERGE_PPU;
    for (const ref of ZONES) {
      if (merged) this.labels.remove('zone-' + ref.id);
      else this.set(ref, state, ppu, selected === ref.id);
    }
    // a beach sport is one zone: its badge stays when zoomed out
    for (const ref of BEACH_ZONES) this.set(ref, state, ppu, selected === ref.id);
    for (const sp of SPORTS) {
      if (merged) this.setSport(sp.id, state);
      else this.labels.remove('sport-' + sp.id);
    }
  }

  /** One badge for a whole sport, in the middle of its zones, with how many of them wait for a tap. */
  private setSport(id: SportId, state: GameState) {
    const sport = SPORTS.find((s) => s.id === id)!;
    const zones = ZONES.filter((r) => r.sport.id === id);
    // still under the mist: nothing to show
    if (expansionNeededFor(state, id) !== null) return this.labels.remove('sport-' + id);
    let x = 0;
    let y = 0;
    for (const r of zones) {
      const c = rectCenter(toWorld(r.def.rect));
      x += c.x / zones.length;
      y += c.y / zones.length;
    }
    const waiting = zones.filter((r) => {
      const z = state.zones[r.id];
      return z.owned && !z.manager && z.phase !== 'running';
    }).length;
    const open = state.sports[id];
    const color = open ? sport.color : '#7d92a3';
    const html = `<div class="mk" style="--c:${color};--p:0"><span class="mk-ic">${icon(open ? sport.icon : 'lock')}</span>${waiting ? `<b class="mk-lv">${waiting}</b>` : ''}</div>`;
    this.labels.set({ id: 'sport-' + id, x, y, className: 'zone-chip sport-chip' + (waiting ? ' waiting' : ''), html, onClick: () => this.h.onSport(id) });
  }

  private set(ref: AnyZoneRef, state: GameState, ppu: number, selected: boolean) {
    const z = state.zones[ref.id];
    const c = rectCenter(toWorld(ref.beach ? fieldsArea(ref.beach, 1 + (z.fields ?? 0)) : ref.def.rect));
    const small = ppu < 120;
    let cls = 'zone-chip';
    let quick = false;
    let glyph = ref.sport.icon;
    let color = ref.sport.color;
    let ring = 0;
    let amount = '';
    if (!z.owned && ref.beach) {
      // a beach sport: no badge until it can be bought (in the Beach sheet); then a grey one with its icon
      if (!beachSportOpen(state, ref.beach)) return this.labels.remove('zone-' + ref.id);
      cls += ' locked';
      color = '#7d92a3';
    } else if (!z.owned) {
      if (expansionNeededFor(state, ref.sport.id as SportId) !== null) {
        // still under the mist: not really "in play" yet, so no badge shows through it
        this.labels.remove('zone-' + ref.id);
        return;
      }
      // grey with a lock, so a glance at the map shows what is still out there to unlock
      cls += ' locked';
      glyph = 'lock';
      color = '#7d92a3';
    } else if (!z.manager && z.phase !== 'running') {
      quick = true;
      if (z.phase === 'ready') {
        cls += ' ready';
        glyph = 'coins';
        color = '#ffc233';
        amount = fmt(z.pending);
      } else {
        cls += ' idle';
        glyph = 'play';
        color = '#ff6a3d';
      }
    } else {
      const st = zoneStats(state, ref, z);
      ring = z.phase === 'running' ? Math.min(1, Math.floor((z.elapsed / st.duration) * 20) / 20) : 1;
      cls += z.manager ? ' auto' : ' run';
    }
    // a new game: point at the first zone
    const hint = ref.id === 'wave-1' && state.totalCoins === 0 && z.phase === 'idle' && !z.manager;
    if (hint) cls += ' hint';
    if (small) cls += ' small';
    if (selected) cls += ' selected';
    const html = `<div class="mk" style="--c:${color};--p:${ring}"><i class="mk-ring"></i><span class="mk-ic">${icon(glyph)}</span>${small || ref.beach ? '' : `<b class="mk-lv">${ref.level}</b>`}${amount && !small ? `<b class="mk-amt">${amount}</b>` : ''}${hint ? '<b class="mk-hint">Tap to start</b>' : ''}</div>`;
    this.labels.set({
      id: 'zone-' + ref.id,
      x: c.x,
      y: c.y,
      className: cls,
      html,
      onClick: () => (quick ? this.h.onQuick(ref.id) : this.h.onOpen(ref.id)),
    });
  }
}
