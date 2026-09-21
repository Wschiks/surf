import Phaser from 'phaser';
import { UNIT, toWorld } from '../config/layout';
import { SPORTS, type SportDef } from '../config/sports';
import type { GameState } from '../core/state';
import type { LabelLayer } from '../ui/labels';
import { bakeKiteLaunch, KITE_LAUNCH_SIZE, placeImage, placeUpright } from './art';
import { DEPTH } from './background';

interface Site {
  sport: SportDef;
  plot: Phaser.GameObjects.Graphics;
  objects: Phaser.GameObjects.GameObject[];
  built: boolean;
}

/** Places on the beach that a sport needs: the kite launch area and the jetty. Empty plot until the sport unlocks. */
export class SiteView {
  private sites: Site[] = [];

  constructor(
    private scene: Phaser.Scene,
    private labels: LabelLayer,
  ) {
    bakeKiteLaunch(scene);
    for (const sport of SPORTS) {
      if (!sport.beachSite) continue;
      const r = toWorld(sport.beachSite.rect);
      const plot = scene.add.graphics().setDepth(DEPTH.things - 2);
      plot.lineStyle(3, 0xb98543, 0.75);
      const dash = 14;
      const segs: [number, number, number, number][] = [
        [r.x, r.y, r.x + r.w, r.y],
        [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
        [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
        [r.x, r.y + r.h, r.x, r.y],
      ];
      for (const [x1, y1, x2, y2] of segs) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        for (let d = 0; d < len; d += dash * 2) {
          const a = d / len;
          const b = Math.min(len, d + dash) / len;
          plot.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
        }
      }
      plot.fillStyle(0xb98543, 0.12);
      plot.fillRect(r.x, r.y, r.w, r.h);
      this.sites.push({ sport, plot, objects: [], built: false });
    }
  }

  update(state: GameState, animate = true) {
    for (const site of this.sites) {
      const unlocked = state.sports[site.sport.id];
      const spec = site.sport.beachSite!;
      const r = toWorld(spec.rect);
      const id = 'site-' + spec.id;
      if (unlocked && !site.built) {
        site.built = true;
        site.plot.setVisible(false);
        this.build(site, animate);
      }
      // label above the plot while it is still empty
      if (!unlocked) {
        this.labels.set({ id, x: r.x + r.w / 2, y: r.y + r.h / 2, minPpu: 130, className: 'site', html: `<span>${site.sport.icon} ${spec.name}</span><small>Unlocks with ${site.sport.name}</small>` });
      } else {
        this.labels.remove(id);
      }
    }
  }

  private build(site: Site, animate: boolean) {
    const spec = site.sport.beachSite!;
    const r = toWorld(spec.rect);
    if (spec.id === 'kite-launch') {
      const img = placeImage(this.scene, 'site-kite-launch', r.x, r.y).setDepth(DEPTH.things - 2);
      img.setDisplaySize(r.w, r.h);
      const sock = placeUpright(this.scene, 'site-windsock', r.x + r.w - 14, r.y + 30).setDepth(DEPTH.things);
      site.objects.push(img, sock);
      if (animate) {
        img.setAlpha(0);
        sock.setAlpha(0);
        this.scene.tweens.add({ targets: [img, sock], alpha: 1, duration: 900 });
      }
    }
    void UNIT;
    void KITE_LAUNCH_SIZE;
  }
}
