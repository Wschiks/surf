import Phaser from 'phaser';
import './styles.css';
import { MapScene } from './scene/MapScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b5d8a',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [MapScene],
  input: { mouse: true, touch: true },
  render: { antialias: true, roundPixels: false },
});
