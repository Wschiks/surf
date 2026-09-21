import Phaser from 'phaser';
import './styles.css';
import { MapScene } from './scene/MapScene';

// The canvas is drawn at the device pixel ratio (capped at 2) so the art stays sharp on phones.
const holder = document.getElementById('game')!;
const ratio = () => Math.min(window.devicePixelRatio || 1, 2);
const size = () => ({ w: Math.max(1, Math.round(holder.clientWidth * ratio())), h: Math.max(1, Math.round(holder.clientHeight * ratio())) });
const first = size();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b5d8a',
  scale: { mode: Phaser.Scale.NONE, width: first.w, height: first.h },
  scene: [MapScene],
  input: { mouse: true, touch: true },
  // 8 texture units (the minimum every device has): with more, some software renderers cut pieces out of pictures
  render: { antialias: true, roundPixels: false, maxTextures: 8 },
});

new ResizeObserver(() => {
  const s = size();
  if (s.w !== game.scale.width || s.h !== game.scale.height) game.scale.resize(s.w, s.h);
}).observe(holder);

// One size unit for buttons, pills and rounded corners: 1 on a normal phone (390 wide, 780 high), smaller on small or
// flat screens and a little bigger on large ones, so the shapes keep their proportions when the window changes.
function setUnit() {
  const col = Math.min(window.innerWidth, 480);
  const u = Math.min(1.15, Math.max(0.72, Math.min(col / 390, window.innerHeight / 780)));
  document.documentElement.style.setProperty('--u', u.toFixed(3));
}
setUnit();
window.addEventListener('resize', setUnit);
