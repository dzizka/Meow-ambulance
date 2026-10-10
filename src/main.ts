import Phaser from 'phaser';
// Čitateľné písmo pre texty a čísla – iba latinka a latinka rozšírená (slovenčina)
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-ext-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-ext-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-ext-800.css';
import { BootScene } from './scenes/BootScene';
import { GarageScene } from './scenes/GarageScene';
import { MinigameScene } from './scenes/MinigameScene';
import { DPR, canvasSize } from './scenes/dpr';

/**
 * Konfigurácia hry. Plátno má veľkosť okna × DPR (ostré na mobile) a CSS ho
 * zmenší späť na veľkosť okna (zoom 1/DPR). Scény si samy prepočítajú priblíženie.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2b2533',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    ...canvasSize(),
    zoom: 1 / DPR,
  },
  input: { activePointers: 2 },
  scene: [BootScene, GarageScene, MinigameScene],
});

const fit = () => {
  const { width, height } = canvasSize();
  game.scale.resize(width, height);
};
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);

// Uľahčuje ladenie v konzole prehliadača
(window as unknown as { game: Phaser.Game }).game = game;
