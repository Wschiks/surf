import { DEV_UNLIMITED_COINS } from '../config/dev';
import Phaser from 'phaser';
import { AREAS, areaRect } from '../config/areas';
import { MAP_W, UNIT, rectCenter, rectContains, toWorld } from '../config/layout';
import { expansionReady, mistFrom } from '../core/unlocks';
import { anyZoneById, ZONES, type SportId } from '../config/sports';
import { fieldsArea } from '../config/beach';
import { FieldView, RoadView } from './fields';
import { tapZone } from '../core/economy';
import type { FacilityDef } from '../config/facilities';
import { Game } from '../core/game';
import { resetSave } from '../core/save';
import { GameUI } from '../ui/ui';
import { LabelLayer } from '../ui/labels';
import { MERGE_PPU, ZoneChips } from '../ui/zoneChips';
import { buildBackground, DEPTH, Mist } from './background';
import { icon } from '../ui/icons';
import { BeachView } from './beach';
import { MapInput, MapView } from './MapView';
import { ZoneView } from './zoneView';
import { SiteView } from './sites';
import { OceanView } from './ocean';
import { Scenery } from './scenery';
import { PlaneView } from './plane';
import { syncPurchases, watchPacks } from '../purchases';
import { grantGemPack } from '../core/shop';
import { fmt } from '../ui/format';
import { sound } from '../ui/sound';

export class MapScene extends Phaser.Scene {
  view = new MapView();
  game_!: Game;
  private bg!: ReturnType<typeof buildBackground>;
  private mist!: Mist;
  private labels!: LabelLayer;
  private ui!: GameUI;
  private chips!: ZoneChips;
  private beach!: BeachView;
  private fields!: FieldView;
  private road!: RoadView;
  private sites!: SiteView;
  private ocean!: OceanView;
  private scenery!: Scenery;
  private plane!: PlaneView;
  private zones: ZoneView[] = [];
  private popCount = 0;
  private popsAlive = 0;

  constructor() {
    super('map');
  }

  create() {
    this.game_ = new Game();
    syncPurchases(this.game_.state.perks);
    void watchPacks((id, tx) => {
      if (grantGemPack(this.game_.state, id, tx) > 0) this.game_.save();
    });
    this.bg = buildBackground(this);
    const ui = document.getElementById('ui')!;
    ui.innerHTML = '';
    this.labels = new LabelLayer(ui);
    this.ui = new GameUI(ui, this.game_, {
      onSelect: (id) => this.onSelect(id),
      onFocusBeach: () => this.view.animateTo((MAP_W / 2) * UNIT, -0.75 * UNIT, this.view.refWidth / 3.6, this.view.height * 0.2),
      onReset: () => this.startOver(),
      onCollected: (id, coins) => this.pop(id, coins),
      onUnlocked: (id, kind) => this.onUnlocked(id, kind),
      onExpanded: () => this.onExpanded(),
      onRebirth: () => this.onRebirth(),
      onExpandReady: () => this.onExpandReady(),
      flyPlane: (f) => this.plane.fly(f),
    });
    this.chips = new ZoneChips(this.labels, {
      onOpen: (id) => this.ui.openZone(id),
      onSport: (id) => this.zoomToSport(id),
      onQuick: (id) => {
        const s = this.game_.state;
        const before = s.coins;
        tapZone(s, id);
        this.pop(id, s.coins - before);
        if (s.coins > before) {
          sound.coin();
          this.ui.maybeAdBreak();
        } else sound.tap();
      },
    });
    this.beach = new BeachView(this);
    this.beach.update(this.game_.state, false);
    this.beach.onBuilt = (f) => this.onBuilt(f);
    this.sites = new SiteView(this, this.labels);
    this.sites.update(this.game_.state, false);
    this.ocean = new OceanView(this);
    this.ocean.update(this.game_.state, 0, false);
    this.scenery = new Scenery(this);
    this.fields = new FieldView(this);
    this.road = new RoadView(this);
    this.plane = new PlaneView(this, this.view);
    for (const ref of ZONES) this.zones.push(new ZoneView(this, ref, (id, coins) => this.pop(id, coins)));

    this.mist = new Mist(this, this.game_.state.expansions);
    // a save where the next expansion is already ready: the mist is already blown back a little
    this.mist.setPeek(expansionReady(this.game_.state), false);
    for (const a of AREAS) {
      const c = rectCenter(areaRect(a));
      this.labels.set({
        id: 'area-' + a.id,
        x: (MAP_W / 2) * UNIT,
        y: c.y * UNIT,
        maxPpu: 70,
        className: 'area',
        html: a.name,
      });
    }

    const holder = document.getElementById('game')!;
    this.scale.on('resize', () => this.syncSize());
    this.syncSize();
    this.view.jumpTo(7.9 * UNIT, 2.2 * UNIT, this.view.defaultPpu());
    const input = new MapInput(holder, this.view);
    input.onTap = (sx, sy) => this.onMapTap(sx, sy);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.game_.save();
    });
    window.addEventListener('pagehide', () => this.game_.save());
    const splash = document.getElementById('splash');
    splash?.classList.add('gone');
    setTimeout(() => splash?.remove(), 700);
    // The debug hook (used by the test and screenshot scripts) only exists in development or with ?debug in the address.
    if (import.meta.env.DEV || location.search.includes('debug')) (window as unknown as { __surf: unknown }).__surf = { scene: this, view: this.view, game: this.game_, ui: this.ui };
  }

  /** Pixel ratio of the canvas compared to the page (the view works in page pixels). */
  private dpr = 1;

  private syncSize() {
    const holder = document.getElementById('game')!;
    this.dpr = this.scale.width / Math.max(1, holder.clientWidth);
    this.view.resize(holder.clientWidth, holder.clientHeight);
  }

  private onMapTap(sx: number, sy: number) {
    // the banner plane first: it flies over everything
    const pw = this.view.screenToWorld(sx, sy);
    if (this.plane.hit(pw.x, pw.y)) return this.plane.tap();
    // while a sheet (upgrades, beach, sports, expand) is open, tapping the map outside of it closes it
    if (this.ui.isSheetOpen) return this.ui.closeSheet();
    const w = this.view.screenToWorld(sx, sy);
    const f = this.beach.hit(w.x, w.y);
    if (f) return this.ui.openBeach();
    const field = this.fields.hit(this.game_.state, w.x, w.y);
    if (field) return this.ui.openZone(field);
    // anywhere under the mist: a short "expand first" popup instead of a screen full of text
    const mist = mistFrom(this.game_.state);
    if (mist !== null && w.y >= mist * UNIT) return this.ui.expandFirst();
    for (const ref of ZONES) {
      if (rectContains(toWorld(ref.def.rect), w.x, w.y)) return this.ui.openZone(ref.id);
    }
    this.ui.closeSheet();
  }

  private onSelect(id: string | null) {
    for (const z of this.zones) z.setSelected(z.ref.id === id);
    const lift = this.view.height * 0.2;
    if (id) {
      const r = this.zoneArea(id);
      const c = rectCenter(r);
      const units = Math.max(1.5, Math.min(3.2, (r.w / UNIT) * 0.6 + 0.5));
      this.view.animateTo(c.x, c.y, this.view.refWidth / units, lift);
    }
  }

  /** Where a zone lies in world px: a water zone's rectangle, or the fields a beach sport has now. */
  private zoneArea(id: string) {
    const ref = anyZoneById(id);
    if (ref.beach) return toWorld(fieldsArea(ref.beach, 1 + (this.game_.state.zones[id]?.fields ?? 0)));
    return toWorld(ref.def.rect);
  }

  private onUnlocked(id: string, kind: 'level' | 'sport') {
    const ref = anyZoneById(id);
    this.ui.confetti();
    this.ui.toast(kind === 'sport' ? `${ref.sport.name} unlocked!` : `${ref.def.name} unlocked!`);
    this.onSelect(id);
  }

  /** Zoom in on all the zones of one sport (from the zoomed-out view, where each sport has one badge). */
  private zoomToSport(id: SportId) {
    const rects = ZONES.filter((r) => r.sport.id === id).map((r) => toWorld(r.def.rect));
    const x0 = Math.min(...rects.map((r) => r.x));
    const y0 = Math.min(...rects.map((r) => r.y));
    const x1 = Math.max(...rects.map((r) => r.x + r.w));
    const y1 = Math.max(...rects.map((r) => r.y + r.h));
    const units = (Math.max(x1 - x0, y1 - y0) / UNIT) * 0.7 + 0.4;
    const ppu = Math.max(this.view.refWidth / units, MERGE_PPU * 1.4);
    sound.tap();
    this.view.animateTo((x0 + x1) / 2, (y0 + y1) / 2, ppu);
  }

  /** A new beach building: close the sheet, fly over and zoom in on it, with a "New!" tag and confetti. */
  private onBuilt(f: FacilityDef) {
    const x = f.at.x * UNIT;
    const y = f.at.y * UNIT + 30;
    // the Beach sheet closes so the whole building is in view (no ad break at this moment)
    this.ui.closeSheet(false);
    this.view.animateTo(x, y, this.view.refWidth / 2.6);
    sound.unlock();
    this.time.delayedCall(450, () => this.ui.confetti());
    const id = 'built-' + f.id;
    this.labels.set({ id, x, y, className: 'built-tag', html: `<b>New!</b> ${f.name}` });
    this.time.delayedCall(2800, () => this.labels.remove(id));
  }

  private pop(zoneId: string | null, coins: number) {
    if (coins <= 0 || this.popsAlive >= 8) return;
    const c = zoneId ? rectCenter(this.zoneArea(zoneId)) : { x: this.view.cx, y: this.view.cy };
    const id = 'pop-' + this.popCount++;
    this.labels.set({ id, x: c.x, y: c.y, className: 'pop', html: `+${fmt(coins)}` });
    this.popsAlive++;
    setTimeout(() => {
      this.labels.remove(id);
      this.popsAlive--;
    }, 1100);
  }

  /** Erase the save and reload the page: a completely fresh game. */
  private startOver() {
    this.game_.stopSaving();
    resetSave();
    location.reload();
  }

  /** The big wave has passed and the beach started over: clear the old buildings and boats and look at the start again. */
  /**
   * The last sport of the open areas reached the level the expansion needs: the camera goes to the mist, a gust of wind
   * blows it back a little, and the Expand button pops up. This is the first time the player hears about expanding.
   */
  private onExpandReady() {
    this.ui.closeSheet(false);
    const y = this.mist.frontY;
    this.view.animateTo((MAP_W / 2) * UNIT, y + 0.2 * UNIT, this.view.refWidth / 6);
    this.time.delayedCall(900, () => {
      this.gust(y);
      sound.unlock();
      this.mist.setPeek(true);
    });
    this.time.delayedCall(2600, () => this.ui.toast(`${icon('expand')} Expand!`, () => this.ui.openExpand()));
  }

  /** White wind streaks rushing into the mist (world y = the mist's front edge). */
  private gust(y: number) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      // spread evenly over the width of the map, with a staggered start, so it reads as one gust
      const x = ((i + 0.5) / n) * MAP_W * UNIT + ((i * 37) % 60) - 30;
      const len = 60 + ((i * 53) % 70);
      const g = this.add.rectangle(x, y - 1.4 * UNIT - ((i * 29) % 80), 7, len, 0xffffff, 0).setDepth(DEPTH.haze + 1);
      this.tweens.add({
        targets: g,
        y: y + 1.2 * UNIT,
        fillAlpha: { from: 0.85, to: 0 },
        duration: 1100,
        delay: (i % 5) * 90,
        ease: 'Quad.easeIn',
        onComplete: () => g.destroy(),
      });
    }
  }

  onExpanded() {
    this.beach.reset();
    this.ocean.reset();
    this.view.jumpTo(7.9 * UNIT, 2.2 * UNIT, this.view.defaultPpu());
    // the mist pulls back once the big wave has left the screen
    this.time.delayedCall(1700, () => this.mist.moveTo(this.game_.state.expansions));
  }

  /** A rebirth: the whole game started over. Clear the beach, the beach sites and the boats, and bring the mist back. */
  onRebirth() {
    this.beach.reset();
    this.ocean.reset();
    this.sites.reset();
    this.mist.destroy();
    this.mist = new Mist(this, this.game_.state.expansions);
    this.view.jumpTo(7.9 * UNIT, 2.2 * UNIT, this.view.defaultPpu());
  }

  update(time: number, delta: number) {
    const now = Date.now();
    this.game_.update(now);
    // testing only (npm run dev, or a web test build with VITE_TEST_COINS=1 such as Vercel): coins never run out, not even after a rebirth
    if ((import.meta.env.DEV || import.meta.env.VITE_TEST_COINS === '1') && DEV_UNLIMITED_COINS) this.game_.state.coins = Math.max(this.game_.state.coins, 999e27);
    this.view.update(Math.min(delta, 100) / 1000);
    const cam = this.cameras.main;
    cam.setZoom(this.view.zoom * this.dpr);
    cam.setRotation(this.view.rotation);
    cam.centerOn(this.view.cx, this.view.cy);

    this.bg.sparkle.tilePositionX = time * 0.01;
    this.bg.sparkle.tilePositionY = -time * 0.006;
    this.bg.foam.tilePositionX = time * 0.012;
    this.bg.swell.tilePositionY = -time * 0.008;
    this.bg.swell.tilePositionX = time * 0.004;
    this.mist.update(time);
    for (const z of this.zones) z.update(time, this.game_.state, this.view);
    this.beach.update(this.game_.state);
    this.beach.animateWalkers(this.game_.state, time);
    this.sites.update(this.game_.state);
    this.ocean.update(this.game_.state, time);
    this.scenery.update(time);
    this.fields.update(this.game_.state, time);
    this.road.update(time);
    this.plane.update(Math.min(delta, 100) / 1000);
    this.chips.update(this.game_.state, this.view.ppu, this.ui.selectedZone);
    this.labels.update(this.view);
    this.ui.update(now);
  }
}
