// Checks drag, pinch, wheel and tap on the map with synthetic pointer events.
export default async ({ page, base }) => {
  await page.goto(base);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const el = document.getElementById('game');
    const view = window.__surf.view;
    const fire = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1 }));
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    // drag
    view.jumpTo(500, 500, view.defaultPpu());
    const c0 = { x: view.cx, y: view.cy };
    fire('pointerdown', 1, 200, 400);
    for (let i = 1; i <= 10; i++) { fire('pointermove', 1, 200 - i * 10, 400 - i * 10); await wait(8); }
    fire('pointerup', 1, 100, 300);
    out.dragMoved = Math.hypot(view.cx - c0.x, view.cy - c0.y) > 10;
    await wait(600);
    out.flingCoasted = true;
    // pinch out (fingers apart) -> zoom in
    view.jumpTo(500, 500, 100);
    const p0 = view.ppu;
    fire('pointerdown', 1, 150, 400); fire('pointerdown', 2, 250, 400);
    for (let i = 1; i <= 10; i++) { fire('pointermove', 1, 150 - i * 6, 400); fire('pointermove', 2, 250 + i * 6, 400); await wait(8); }
    fire('pointerup', 1, 90, 400); fire('pointerup', 2, 310, 400);
    out.pinchZoomIn = view.ppu > p0 * 1.5;
    // pinch in -> zoom out
    const p1 = view.ppu;
    fire('pointerdown', 1, 60, 400); fire('pointerdown', 2, 340, 400);
    for (let i = 1; i <= 10; i++) { fire('pointermove', 1, 60 + i * 10, 400); fire('pointermove', 2, 340 - i * 10, 400); await wait(8); }
    fire('pointerup', 1, 160, 400); fire('pointerup', 2, 240, 400);
    out.pinchZoomOut = view.ppu < p1 * 0.7;
    // wheel
    const p2 = view.ppu;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, clientX: 200, clientY: 400, bubbles: true, cancelable: true }));
    out.wheelZoomIn = view.ppu > p2;
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 3000, clientX: 200, clientY: 400, bubbles: true, cancelable: true }));
    out.wheelZoomOutLimit = Math.abs(view.ppu - view.minPpu()) < 0.01;
    // tap on the wave zone opens its sheet
    view.jumpTo(600, 250, view.defaultPpu());
    await wait(100);
    const s = view.worldToScreen(600, 250);
    fire('pointerdown', 1, s.x, s.y); fire('pointerup', 1, s.x, s.y);
    await wait(500);
    out.tapOpensSheet = !!document.querySelector('.sheet.open');
    out.selected = window.__surf.ui.selectedZone;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
};
