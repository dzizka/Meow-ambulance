import Phaser from 'phaser';
import { EXTRA_SFX } from '../sfx';
import { AUDIO, DATA_FILES, IMAGES, ZUZKA_SHEET, catSheetPath, personSheetPath } from '../assets';
import type { GameData } from '../data/types';
import { t } from '../i18n/t';
import { GameState } from '../core/GameState';
import { SaveManager, browserStorage } from '../core/SaveManager';

/** Načíta dáta, grafiku a zvuky; potom spustí garáž. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2 - 14, t('UI_LOADING'), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f4e6d0',
      })
      .setOrigin(0.5);
    const bar = this.add
      .rectangle(width / 2 - 80, height / 2 + 6, 0, 6, 0xe8a87c)
      .setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2 + 6, 164, 10).setStrokeStyle(1, 0xf4e6d0);
    this.load.on('progress', (p: number) => {
      bar.width = 160 * p;
    });
    this.load.once('complete', () => label.destroy());

    for (const [key, path] of Object.entries(DATA_FILES)) this.load.json(key, path);
    for (const [key, path] of Object.entries(IMAGES)) this.load.image(key, path);
    this.load.spritesheet('zuzka', personSheetPath(ZUZKA_SHEET), {
      frameWidth: 20,
      frameHeight: 32,
    });
    for (const [key, urls] of Object.entries({ ...AUDIO, ...EXTRA_SFX }))
      this.load.audio(key, [...urls]);

    // Hárky mačiek sa načítajú až keď vieme, ktoré farby existujú (z breeds.json)
    this.load.once(Phaser.Loader.Events.FILE_COMPLETE + '-json-breeds', () => {
      const breeds = this.cache.json.get('breeds') as {
        breeds: GameData['breeds'];
        coats: GameData['coats'];
      };
      const sheets = new Set<string>([
        ...breeds.coats.flatMap((c) => c.sprites),
        ...breeds.breeds.flatMap((b) => (b.sprite_override ? [b.sprite_override] : [])),
      ]);
      for (const s of sheets)
        this.load.spritesheet(s, catSheetPath(s), { frameWidth: 32, frameHeight: 32 });
    });
  }

  async create(): Promise<void> {
    const json = this.cache.json;
    const breeds = json.get('breeds') as { breeds: GameData['breeds']; coats: GameData['coats'] };
    const data: GameData = {
      challenges: json.get('challenges').challenges,
      traits: json.get('traits').traits,
      conditions: json.get('conditions').conditions,
      breeds: breeds.breeds,
      coats: breeds.coats,
      adopters: json.get('adopters').adopters,
      reports: json.get('reports').reports,
      names: json.get('names'),
      balance: json.get('balance'),
    };
    this.registry.set('gameData', data);

    // Uložená hra + dopočítanie offline času (GDD §2.3). „#novahra" v adrese začne odznova.
    const saves = new SaveManager(browserStorage);
    if (location.hash === '#novahra') {
      saves.clear();
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch {
        /* v niektorých prostrediach (artifact) adresu meniť nemožno */
      }
    }
    const loaded = saves.load(data);
    this.registry.set('state', loaded?.state ?? new GameState(data));
    this.registry.set('offline', loaded?.offline ?? null);

    // Pixelový font musí byť načítaný skôr, než vzniknú texty
    try {
      await Promise.all([
        document.fonts.load('16px "Pixelify Sans"'),
        document.fonts.load('bold 16px "Pixelify Sans"'),
        document.fonts.load('600 16px "Nunito"'),
        document.fonts.load('700 16px "Nunito"'),
      ]);
    } catch {
      /* ak font zlyhá, použije sa monospace */
    }
    this.scene.start('Garage');
  }
}
