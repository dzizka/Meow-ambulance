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

/**
 * Konfigurácia hry. Veľkosť plátna = veľkosť okna (RESIZE); scény si samy
 * prepočítajú priblíženie, aby garáž vždy celá vošla – na PC aj mobile.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2b2533',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
  },
  input: { activePointers: 2 },
  scene: [BootScene, GarageScene, MinigameScene],
});

// Uľahčuje ladenie v konzole prehliadača
(window as unknown as { game: Phaser.Game }).game = game;
