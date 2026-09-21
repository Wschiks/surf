import Phaser from 'phaser';
import { AREAS, areaById, areaRect, type AreaDef, type AreaId } from '../config/areas';
import { UNIT, rectCenter, rectContains, toWorld } from '../config/layout';
import { ZONES } from '../config/sports';
import { tapZone } from '../core/economy';
import { Game } from '../core/game';
import { GameUI } from '../ui/ui';
import { LabelLayer } from '../ui/labels';
import { Minimap } from '../ui/minimap';
import { ZoneChips } from '../ui/zoneChips';
import { buildBackground, Haze } from './background';
import { BeachView } from './beach';
import { MapInput, MapView } from './MapView';
import { ZoneView } from './zoneView';
import { SiteView } from './sites';
import { OceanView } from './ocean';
import { fmt } from '../ui/format';

export class MapScene extends Phaser.Scene {
  view = new MapView();
  game_!: Game;
  private bg!: ReturnType<typeof buildBackground>;
  private hazes = new Map<AreaId, Haze>();
  private labels!: LabelLayer;
  private minimap!: Minimap;
  private ui!: GameUI;
  private chips!: ZoneChips;
  private beach!: BeachView;
  private sites!: SiteView;
  private ocean!: OceanView;
  private zones: ZoneView[] = [];
  private clearedAreas = new Set<AreaId>(['beach', 'wave']);
  private popCount = 0;
  private popsAlive = 0;

  constructor() {
    super('map');
  }

  create() {
    this.game_ = new Game();
    this.bg = buildBackground(this);
    const ui = document.getElementById('ui')!;
    ui.innerHTML = '';
    this.labels = new LabelLayer(ui);
    this.minimap = new Minimap(ui, this.view, {
      isCleared: (a) => this.isAreaCleared(a.id),
      onJump: (a) => this.jumpToArea(a),
    });
    this.ui = new GameUI(ui, this.game_, {
      onSelect: (id) => this.onSelect(id),
      onFocusBeach: () => this.view.animateTo(5 * UNIT, 0.8 * UNIT, this.view.width / 3.6, this.view.height * 0.2),
      onReset: () => {
        this.game_.stopSaving();
        location.reload();
      },
      onCollected: (id, coins) => this.pop(id, coins),
      onUnlocked: (id, kind) => this.onUnlocked(id, kind),
    });
    this.chips = new ZoneChips(this.labels, {
      onOpen: (id) => this.ui.openZone(id),
      onQuick: (id) => {
        const s = this.game_.state;
        const before = s.coins;
        tapZone(s, id);
        this.pop(id, s.coins - before);
      },
    });
    this.beach = new BeachView(this);
    this.beach.update(this.game_.state, false);
    this.sites = new SiteView(this, this.labels);
    this.sites.update(this.game_.state, false);
    this.ocean = new OceanView(this);
    this.ocean.update(this.game_.state, 0, false);
    for (const ref of ZONES) this.zones.push(new ZoneView(this, ref, (id, coins) => this.pop(id, coins)));

    for (const a of AREAS) {
      if (a.clearedBySport) this.hazes.set(a.id, new Haze(this, a.id));
      const c = rectCenter(areaRect(a));
      this.labels.set({
        id: 'area-' + a.id,
        x: 5 * UNIT,
        y: c.y * UNIT,
        maxPpu: 105,
        className: 'area',
        html: `${a.name}<small>${a.blurb}</small>`,
      });
    }
    this.syncAreas(false);

    const params = new URLSearchParams(location.search);
    for (const id of (params.get('unlock') ?? '').split(',')) {
      if (id === 'sea' || id === 'ocean') this.setAreaCleared(id, false);
      if (id === 'all') (['sea', 'ocean'] as AreaId[]).forEach((x) => this.setAreaCleared(x, false));
    }

    const holder = document.getElementById('game')!;
    this.scale.on('resize', () => this.syncSize());
    this.syncSize();
    this.view.jumpTo(6 * UNIT, 2.5 * UNIT, this.view.defaultPpu());
    const input = new MapInput(holder, this.view);
    input.onTap = (sx, sy) => this.onMapTap(sx, sy);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.game_.save();
    });
    window.addEventListener('pagehide', () => this.game_.save());
    (window as unknown as { __surf: unknown }).__surf = { scene: this, view: this.view, game: this.game_, ui: this.ui };
  }

  /** Pixel ratio of the canvas compared to the page (the view works in page pixels). */
  private dpr = 1;

  private syncSize() {
    const holder = document.getElementById('game')!;
    this.dpr = this.scale.width / Math.max(1, holder.clientWidth);
    this.view.resize(holder.clientWidth, holder.clientHeight);
  }

  private onMapTap(sx: number, sy: number) {
    const w = this.view.screenToWorld(sx, sy);
    const f = this.beach.hit(w.x, w.y);
    if (f) return this.ui.openBeach();
    for (const ref of ZONES) {
      if (rectContains(toWorld(ref.def.rect), w.x, w.y)) return this.ui.openZone(ref.id);
    }
    this.ui.closeSheet();
  }

  private onSelect(id: string | null) {
    for (const z of this.zones) z.setSelected(z.ref.id === id);
    const lift = this.view.height * 0.2;
    if (id) {
      const ref = ZONES.find((z) => z.id === id)!;
      const c = rectCenter(toWorld(ref.def.rect));
      const units = Math.max(1.5, Math.min(3.2, ref.def.rect.w * 0.6 + 0.5));
      this.view.animateTo(c.x, c.y, this.view.width / units, lift);
    }
  }

  private onUnlocked(id: string, kind: 'sport' | 'level') {
    const ref = ZONES.find((z) => z.id === id)!;
    this.ui.confetti();
    this.ui.toast(kind === 'sport' ? `${ref.sport.icon} ${ref.sport.name} unlocked!` : `🎉 ${ref.def.name} unlocked!`);
    this.onSelect(id);
  }

  private pop(zoneId: string | null, coins: number) {
    if (coins <= 0 || this.popsAlive >= 8) return;
    const ref = zoneId ? ZONES.find((z) => z.id === zoneId) : null;
    const c = ref ? rectCenter(toWorld(ref.def.rect)) : { x: this.view.cx, y: this.view.cy };
    const id = 'pop-' + this.popCount++;
    this.labels.set({ id, x: c.x, y: c.y, className: 'pop', html: `+${fmt(coins)}` });
    this.popsAlive++;
    setTimeout(() => {
      this.labels.remove(id);
      this.popsAlive--;
    }, 1100);
  }

  jumpToArea(a: AreaDef) {
    const c = { x: 5 * UNIT, y: rectCenter(areaRect(a)).y * UNIT };
    this.view.animateTo(c.x, c.y, this.view.width / 4.5);
  }

  /** Clear the haze on every area whose sport is unlocked in the saved game. */
  private syncAreas(animate: boolean) {
    for (const a of AREAS) {
      if (a.clearedBySport && this.game_.state.sports[a.clearedBySport]) this.setAreaCleared(a.id, animate);
    }
  }

  setAreaCleared(id: AreaId, animate = true) {
    this.clearedAreas.add(id);
    this.hazes.get(id)?.clear(animate);
  }

  isAreaCleared(id: AreaId) {
    return this.clearedAreas.has(id) || !areaById(id).clearedBySport;
  }

  update(time: number, delta: number) {
    const now = Date.now();
    this.game_.update(now);
    this.syncAreas(true);
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
    for (const h of this.hazes.values()) h.update(time);
    for (const z of this.zones) z.update(time, this.game_.state, this.view);
    this.beach.update(this.game_.state);
    this.sites.update(this.game_.state);
    this.ocean.update(this.game_.state, time);
    this.chips.update(this.game_.state, this.view.ppu, this.ui.selectedZone);
    this.labels.update(this.view);
    this.minimap.draw();
    this.ui.update(now);
  }
}
