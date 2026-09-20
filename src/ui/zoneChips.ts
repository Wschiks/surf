import { rectCenter, toWorld } from '../config/layout';
import { ZONES, type ZoneRef } from '../config/sports';
import { zoneStats } from '../core/economy';
import type { GameState } from '../core/state';
import type { LabelLayer } from './labels';
import { COIN, fmt } from './format';

export interface ChipHandlers {
  onOpen: (id: string) => void;
  /** Quick action: collect or start a waiting zone. */
  onQuick: (id: string) => void;
}

/** The little tag that floats over every zone on the map. */
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
    const compact = ppu < 120;
    const sportUnlocked = state.sports[ref.sport.id];
    let cls = 'zone-chip';
    let html: string;
    let quick = false;
    if (!z.owned) {
      cls += ' locked';
      html = compact ? `<span class="ci">🔒</span><span class="cl">${ref.level}</span>` : `<span class="ci">🔒</span><span class="cn">${sportUnlocked || ref.level === 1 ? ref.def.name : ref.sport.name}</span><small>${ref.level === 1 && !sportUnlocked ? 'Locked sport' : 'Level ' + ref.level}</small>`;
    } else {
      const st = zoneStats(state, ref, z);
      const pct = z.phase === 'running' ? Math.min(100, Math.floor((z.elapsed / st.duration) * 20) * 5) : z.phase === 'ready' ? 100 : 0;
      if (!z.manager && z.phase !== 'running') {
        quick = true;
        cls += z.phase === 'ready' ? ' ready' : ' idle';
        const msg = z.phase === 'ready' ? `Collect ${COIN} ${fmt(z.pending)}` : '▶ Tap to start';
        html = compact ? `<span class="ci">${z.phase === 'ready' ? '💰' : '▶'}</span>` : `<span class="cn">${ref.def.name}</span><small class="act">${msg}</small>`;
      } else {
        cls += z.manager ? ' auto' : ' run';
        html = compact
          ? `<span class="ci">${ref.sport.icon}</span><span class="cl">${ref.level}</span>`
          : `<span class="cn">${ref.def.name}</span><small>${z.manager ? '🧑‍🏫 ' : ''}${COIN} ${fmt(st.perSecond)}/s</small><i class="pb"><b style="width:${pct}%"></b></i>`;
      }
    }
    if (compact) cls += ' compact';
    if (selected) cls += ' selected';
    html = `<div class="chip-in">${html}</div>`;
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
