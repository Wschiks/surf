import { rectCenter, toWorld } from '../config/layout';
import { ZONES, type ZoneRef } from '../config/sports';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import type { LabelLayer } from './labels';
import { fmt } from './format';
import { icon } from './icons';

export interface ChipHandlers {
  onOpen: (id: string) => void;
  /** Quick action: collect or start a waiting zone. */
  onQuick: (id: string) => void;
}

/** A small round badge on every zone: the sport, the level, and what the zone is doing. No text floats over the map. */
export class ZoneChips {
  constructor(
    private labels: LabelLayer,
    private h: ChipHandlers,
  ) {}

  update(state: GameState, ppu: number, selected: string | null) {
    for (const ref of ZONES) this.set(ref, state, ppu, selected === ref.id);
  }

  private set(ref: ZoneRef, state: GameState, ppu: number, selected: boolean) {
    const z = state.zones[ref.id];
    const c = rectCenter(toWorld(ref.def.rect));
    const small = ppu < 120;
    let cls = 'zone-chip';
    let quick = false;
    let glyph = ref.sport.icon;
    let color = ref.sport.color;
    let ring = 0;
    let amount = '';
    if (!z.owned) {
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
    if (small) cls += ' small';
    if (selected) cls += ' selected';
    const html = `<div class="mk" style="--c:${color};--p:${ring}"><i class="mk-ring"></i><span class="mk-ic">${icon(glyph)}</span>${small ? '' : `<b class="mk-lv">${ref.level}</b>`}${amount && !small ? `<b class="mk-amt">${amount}</b>` : ''}</div>`;
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
