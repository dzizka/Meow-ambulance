import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GarageScene } from './scenes/GarageScene';
import { UIScene } from './scenes/UIScene';

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
  scene: [BootScene, GarageScene, UIScene],
});

// Uľahčuje ladenie v konzole prehliadača
(window as unknown as { game: Phaser.Game }).game = game;
