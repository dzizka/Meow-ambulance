import Phaser from 'phaser';
import { EXTRA_SFX } from '../sfx';
import { personKey } from './personAnims';
import {
  AUDIO,
  DATA_FILES,
  FONT_FAMILY,
  IMAGES,
  ZUZKA_SHEET,
  catSheetPath,
  personSheetPath,
} from '../assets';
import { DPR } from './dpr';
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
    // Plátno má rozlíšenie displeja – rozmery v CSS pixeloch × DPR, aby nápis nebol drobný
    const { width, height } = this.scale;
    const u = DPR;
    const barW = Math.min(260, (width / u) * 0.6) * u;
    const label = this.add
      .text(width / 2, height / 2 - 26 * u, `🐾 ${t('UI_LOADING')}`, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(22 * u)}px`,
        fontStyle: 'bold',
        color: '#f4e6d0',
      })
      .setOrigin(0.5);
    const bar = this.add
      .rectangle(width / 2 - barW / 2, height / 2 + 10 * u, 0, 10 * u, 0xe8a87c)
      .setOrigin(0, 0.5);
    this.add
      .rectangle(width / 2, height / 2 + 10 * u, barW + 6 * u, 16 * u)
      .setStrokeStyle(2 * u, 0xf4e6d0);
    this.load.on('progress', (p: number) => {
      bar.width = barW * p;
    });
    this.load.once('complete', () => label.destroy());

    for (const [key, path] of Object.entries(DATA_FILES)) this.load.json(key, path);
    for (const [key, path] of Object.entries(IMAGES)) this.load.image(key, path);
    this.load.spritesheet(personKey(ZUZKA_SHEET), personSheetPath(ZUZKA_SHEET), {
      frameWidth: 20,
      frameHeight: 32,
    });
    for (const [key, urls] of Object.entries({ ...AUDIO, ...EXTRA_SFX }))
      this.load.audio(key, [...urls]);

    // Postavičky hostí a baristky v kaviarni – zoznam je v balance.json (GDD §5.5)
    this.load.once(Phaser.Loader.Events.FILE_COMPLETE + '-json-balance', () => {
      const balance = this.cache.json.get('balance') as GameData['balance'];
      for (const s of new Set([
        ...balance.cafe.guest_sprites,
        balance.cafe.barista_sprite,
        balance.hotel.receptionist_sprite,
      ]))
        this.load.spritesheet(personKey(s), personSheetPath(s), {
          frameWidth: 20,
          frameHeight: 32,
        });
    });

    // Postavičky personálu (GDD §6.4)
    this.load.once(Phaser.Loader.Events.FILE_COMPLETE + '-json-staff', () => {
      const staff = this.cache.json.get('staff') as { staff: GameData['staff'] };
      for (const s of staff.staff)
        if (!this.textures.exists(personKey(s.sprite)))
          this.load.spritesheet(personKey(s.sprite), personSheetPath(s.sprite), {
            frameWidth: 20,
            frameHeight: 32,
          });
    });

    // Hárky mačiek sa načítajú až keď vieme, ktoré farby existujú (z breeds.json)
    this.load.once(Phaser.Loader.Events.FILE_COMPLETE + '-json-breeds', () => {
      const breeds = this.cache.json.get('breeds') as {
        breeds: GameData['breeds'];
        coats: GameData['coats'];
      };
      const sheets = new Set<string>(breeds.coats.flatMap((c) => c.sprites));
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
      equipment: json.get('equipment').equipment,
      decor: json.get('decor').decor,
      staff: json.get('staff').staff,
      achievements: json.get('achievements').achievements,
      events: json.get('events'),
      cosmetics: json.get('cosmetics'),
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
    this.registry.set('hadSave', loaded !== null);

    // Písmo musí byť načítané skôr, než vzniknú texty na plátne
    try {
      await Promise.all([
        document.fonts.load('600 16px "Nunito"'),
        document.fonts.load('700 16px "Nunito"'),
      ]);
    } catch {
      /* ak font zlyhá, použije sa monospace */
    }
    this.scene.start('Garage');
  }
}
