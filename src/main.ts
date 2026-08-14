import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PHYSICS, clamp, launchPower } from './config/gameplay';
import { PinballScene } from './scenes/PinballScene';
import './styles/main.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('App container is missing');

app.innerHTML = `
  <section class="game-shell">
    <div class="brand">COSMIC VOVA</div>
    <div id="game"></div>
    <div class="badge">FINAL // COSMIC VOVA</div>
    <div class="crt"></div>
  </section>`;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#05061d',
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: PHYSICS.gravityY },
      enableSleeping: false,
      positionIterations: 10,
      velocityIterations: 8,
    },
  },
  scene: [PinballScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, pixelArt: false },
  callbacks: { postBoot: () => { window.focus(); } },
});

export { clamp, launchPower };
