import Phaser from 'phaser';
import { AREAS, areaById, areaRect, type AreaDef, type AreaId } from '../config/areas';
import { UNIT, rectCenter } from '../config/layout';
import { LabelLayer } from '../ui/labels';
import { Minimap } from '../ui/minimap';
import { buildBackground, Haze } from './background';
import { MapInput, MapView } from './MapView';

export class MapScene extends Phaser.Scene {
  view = new MapView();
  private bg!: ReturnType<typeof buildBackground>;
  private hazes = new Map<AreaId, Haze>();
  private labels!: LabelLayer;
  private minimap!: Minimap;
  private clearedAreas = new Set<AreaId>(['beach', 'wave']);

  constructor() {
    super('map');
  }

  create() {
    this.bg = buildBackground(this);
    const ui = document.getElementById('ui')!;
    this.labels = new LabelLayer(ui);
    this.minimap = new Minimap(ui, this.view, {
      isCleared: (a) => this.clearedAreas.has(a.id),
      onJump: (a) => this.jumpToArea(a),
    });

    for (const a of AREAS) {
      if (a.clearedBySport) this.hazes.set(a.id, new Haze(this, a.id));
      const c = rectCenter(areaRect(a));
      this.labels.set({
        id: 'area-' + a.id,
        x: 5 * UNIT,
        y: c.y * UNIT,
        maxPpu: 140,
        className: 'area',
        html: `${a.name}<small>${a.blurb}</small>`,
      });
    }

    const params = new URLSearchParams(location.search);
    for (const id of (params.get('unlock') ?? '').split(',')) {
      if (id === 'sea' || id === 'ocean') this.setAreaCleared(id, false);
      if (id === 'all') (['sea', 'ocean'] as AreaId[]).forEach((x) => this.setAreaCleared(x, false));
    }

    const holder = document.getElementById('game')!;
    this.scale.on('resize', (s: Phaser.Structs.Size) => this.view.resize(s.width, s.height));
    this.view.resize(this.scale.width, this.scale.height);
    this.view.jumpTo(6 * UNIT, 2.5 * UNIT, this.view.defaultPpu());
    new MapInput(holder, this.view);

    (window as unknown as { __surf: unknown }).__surf = { scene: this, view: this.view };
  }

  jumpToArea(a: AreaDef) {
    const c = Minimap.areaCenter(a);
    this.view.animateTo(c.x, c.y, this.view.width / 4.5);
  }

  setAreaCleared(id: AreaId, animate = true) {
    this.clearedAreas.add(id);
    this.hazes.get(id)?.clear(animate);
  }

  isAreaCleared(id: AreaId) {
    return this.clearedAreas.has(id) || !areaById(id).clearedBySport;
  }

  update(time: number, delta: number) {
    this.view.update(Math.min(delta, 100) / 1000);
    const cam = this.cameras.main;
    cam.setZoom(this.view.zoom);
    cam.setRotation(this.view.rotation);
    cam.centerOn(this.view.cx, this.view.cy);

    this.bg.sparkle.tilePositionX = time * 0.01;
    this.bg.sparkle.tilePositionY = -time * 0.006;
    this.bg.foam.tilePositionX = time * 0.012;
    for (const h of this.hazes.values()) h.update(time);
    this.labels.update(this.view);
    this.minimap.draw();
  }
}
