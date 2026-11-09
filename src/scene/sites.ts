import Phaser from 'phaser';
import { UNIT, toWorld } from '../config/layout';
import { SPORTS, type SportDef } from '../config/sports';
import type { GameState } from '../core/state';
import type { LabelLayer } from '../ui/labels';
import { bakeKiteLaunch, KITE_LAUNCH_SIZE, placeImage, placeUpright } from './art';
import { icon } from '../ui/icons';
import { DEPTH } from './background';

interface Site {
  sport: SportDef;
  objects: Phaser.GameObjects.GameObject[];
  built: boolean;
}

/** Places on the beach that a sport needs: the kite launch area. Nothing is drawn there until the sport unlocks. */
export class SiteView {
  private sites: Site[] = [];

  constructor(
    private scene: Phaser.Scene,
    private labels: LabelLayer,
  ) {
    bakeKiteLaunch(scene);
    for (const sport of SPORTS) {
      if (!sport.beachSite) continue;
      this.sites.push({ sport, objects: [], built: false });
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
        this.build(site, animate);
      }
      // label above the plot while it is still empty
      if (!unlocked) {
        this.labels.set({ id, x: r.x + r.w / 2, y: r.y + r.h / 2, minPpu: 130, className: 'site', html: `<div class="mk" style="--c:#7d92a3;--p:0"><span class="mk-ic">${icon(site.sport.icon)}</span></div>` });
      } else {
        this.labels.remove(id);
      }
    }
  }

  /** Take the built sites away again (a rebirth). */
  reset() {
    for (const site of this.sites) {
      site.objects.forEach((o) => o.destroy());
      site.objects = [];
      site.built = false;
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
