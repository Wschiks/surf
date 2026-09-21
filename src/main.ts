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
  render: { antialias: true, roundPixels: false },
});

new ResizeObserver(() => {
  const s = size();
  if (s.w !== game.scale.width || s.h !== game.scale.height) game.scale.resize(s.w, s.h);
}).observe(holder);
