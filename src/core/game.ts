import { applyOffline, tick, type OfflineReport } from './economy';
import { loadGame, saveGame } from './save';
import type { GameState } from './state';

/** Runs the game clock on real time. If the tab was asleep for a while, the gap counts as time away. */
export class Game {
  state: GameState;
  /** Set when the player comes back to the game after being away. */
  offlineReport: OfflineReport | null = null;
  private last: number;
  private saveTimer = 0;

  constructor(now = Date.now()) {
    this.state = loadGame(now);
    this.last = now;
    const away = (now - this.state.savedAt) / 1000;
    if (away > 5) {
      const rep = applyOffline(this.state, away);
      if (rep.coins > 0 || rep.waiting > 0) this.offlineReport = rep;
    }
    this.last = now;
  }

  update(now = Date.now()) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt <= 0) return;
    if (dt > 3) {
      // the tab was asleep: count it as time away
      const rep = applyOffline(this.state, dt);
      if (rep.coins > 0 || rep.waiting > 0) this.offlineReport = rep;
      dt = 0;
    } else {
      tick(this.state, dt);
    }
    this.saveTimer += dt;
    if (this.saveTimer > 5 || dt === 0) {
      this.saveTimer = 0;
      this.save(now);
    }
  }

  save(now = Date.now()) {
    saveGame(this.state, now);
  }
}
