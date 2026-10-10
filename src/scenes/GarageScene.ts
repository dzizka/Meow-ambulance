import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import type { GameData } from '../data/types';
import { CLINIC_FRAMES, INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { CatSprite } from '../objects/CatSprite';
import type { UIScene } from './UIScene';
import { WORLD_H, WORLD_W, computeLayout } from './layout';

/** Rozmery miestnosti v garáži (pixely pixel-artu). */
const ROOM = { x: 16, y: 6, w: 448, wallH: 64, floorH: 192 };
const FLOOR_TOP = ROOM.y + ROOM.wallH;

type Sheet = 'interior' | 'clinic';
const rect = (sheet: Sheet, name: string): FrameRect =>
  (sheet === 'interior'
    ? INTERIOR_FRAMES[name as keyof typeof INTERIOR_FRAMES]
    : CLINIC_FRAMES[name as keyof typeof CLINIC_FRAMES]) as FrameRect;

/**
 * Fáza 1 – Garážová záchranka (GDD §6.2).
 * Statické pozadie (podlaha, steny, výzdoba) sa skladá raz do jednej textúry,
 * nábytok a postavy sú samostatné sprity zoradené podľa výšky (y).
 */
export class GarageScene extends Phaser.Scene {
  state!: GameState;
  private cats: CatSprite[] = [];
  private selected: CatSprite | null = null;
  private zuzka!: Phaser.GameObjects.Sprite;
  private readonly walkArea = new Phaser.Geom.Rectangle(44, FLOOR_TOP + 46, 392, 132);

  constructor() {
    super('Garage');
  }

  create(): void {
    const data = this.registry.get('gameData') as GameData;
    this.state = new GameState(data);
    this.registry.set('state', this.state);

    this.registerFrames();
    this.buildBackground();
    this.placeFurniture();
    this.createCage(348, FLOOR_TOP + 38);
    this.createCage(398, FLOOR_TOP + 38);
    this.createZuzka();

    this.state.admitCat();
    this.state.admitCat();
    this.state.cats.forEach((cat, i) => this.spawnCat(cat.id, 180 + i * 90, FLOOR_TOP + 120));

    this.enableDragPan();
    this.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length === 0 && !this.isUiPointer(p)) this.select(null);
      },
    );

    this.scale.on('resize', this.applyLayout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyLayout, this));
    this.applyLayout();
    this.scene.launch('UI');
  }

  override update(_time: number, delta: number): void {
    this.state.time.update(delta);
    if (this.state.time.isDayOver && !this.dayRollPending) {
      this.dayRollPending = true;
      // M1: tu bude súhrn dňa. Zatiaľ nový deň po krátkej pauze.
      this.time.delayedCall(2500, () => {
        this.state.time.startNextDay();
        this.dayRollPending = false;
      });
    }
  }
  private dayRollPending = false;

  /** Ďalšia mačka (ladiaca funkcia ukážky): najstaršia odíde, príde nová. */
  replaceOldestCat(): void {
    const oldest = this.cats.shift();
    if (oldest) {
      this.state.cats = this.state.cats.filter((c) => c.id !== oldest.cat.id);
      if (this.selected === oldest) this.select(null);
      oldest.destroy();
    }
    const cat = this.state.admitCat();
    if (cat) this.spawnCat(cat.id, 380, FLOOR_TOP + 70);
  }

  private spawnCat(id: string, x: number, y: number): void {
    const data = this.state.getCat(id);
    if (!data) return;
    const sprite = new CatSprite(this, x, y, data, this.walkArea);
    sprite.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isUiPointer(p)) return;
      const reaction = sprite.react();
      this.sound.play(reaction === 'fled' ? 'mew' : 'mewPurr', { volume: 0.6 });
      this.select(sprite);
    });
    this.cats.push(sprite);
  }

  private select(sprite: CatSprite | null): void {
    this.selected?.setSelected(false);
    this.selected = sprite;
    sprite?.setSelected(true);
    this.state.bus.emit('catSelected', { catId: sprite?.cat.id ?? null });
  }

  private applyLayout(): void {
    const l = computeLayout(this.scale.width, this.scale.height);
    const cam = this.cameras.main;
    cam.setViewport(0, 0, l.width, l.portrait ? l.worldScreenH : l.height);
    cam.setZoom(l.zoom);
    cam.setBounds(0, 0, WORLD_W, WORLD_H, true);
    cam.centerOn(WORLD_W / 2, WORLD_H / 2);
  }

  /** Ťuknutie mimo garáže alebo na panel rozhrania sa v garáži ignoruje. */
  isUiPointer(p: Phaser.Input.Pointer): boolean {
    const cam = this.cameras.main;
    if (p.y > cam.y + cam.height) return true;
    const ui = this.scene.get('UI') as UIScene | null;
    return ui?.scene.isActive() === true && ui.blocksPointer(p.x, p.y);
  }

  /** Posúvanie garáže ťahaním (keď je väčšia ako obrazovka, napr. mobil na výšku). */
  private enableDragPan(): void {
    let lastX = 0;
    let lastY = 0;
    let dragging = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      lastX = p.x;
      lastY = p.y;
      dragging = !this.isUiPointer(p);
    });
    this.input.on('pointerup', () => (dragging = false));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !dragging) return;
      const cam = this.cameras.main;
      cam.scrollX -= (p.x - lastX) / cam.zoom;
      cam.scrollY -= (p.y - lastY) / cam.zoom;
      lastX = p.x;
      lastY = p.y;
    });
  }

  /** Pomenované výrezy z hárkov, aby sa dali použiť ako sprity. */
  private registerFrames(): void {
    for (const [sheet, frames] of [
      ['interior', INTERIOR_FRAMES],
      ['clinic', CLINIC_FRAMES],
    ] as const) {
      const tex = this.textures.get(sheet);
      for (const [name, [x, y, w, h]] of Object.entries(frames)) {
        if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
      }
    }
  }

  private buildBackground(): void {
    const key = 'garage-bg';
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = this.textures.createCanvas(key, WORLD_W, WORLD_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    const src = {
      interior: this.textures.get('interior').getSourceImage() as CanvasImageSource,
      clinic: this.textures.get('clinic').getSourceImage() as CanvasImageSource,
    };
    const draw = (sheet: Sheet, name: string, dx: number, dy: number) => {
      const [x, y, w, h] = rect(sheet, name);
      ctx.drawImage(src[sheet], x, y, w, h, Math.round(dx), Math.round(dy), w, h);
    };

    ctx.fillStyle = '#2b2533';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Steny a podlaha
    for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += 32) {
      draw('interior', 'wall_blue_top', x, ROOM.y);
      draw('interior', 'wall_blue_bottom', x, ROOM.y + 32);
      for (let y = FLOOR_TOP; y < FLOOR_TOP + ROOM.floorH; y += 32)
        draw('interior', 'floor_tile', x, y);
    }
    // Tieň pod stenou a obrys miestnosti
    ctx.fillStyle = 'rgba(30, 20, 40, 0.28)';
    ctx.fillRect(ROOM.x, FLOOR_TOP, ROOM.w, 4);
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(ROOM.x - 1, ROOM.y - 1, ROOM.w + 2, ROOM.wallH + ROOM.floorH + 2);

    // Výzdoba na stene
    draw('clinic', 'sign_cross', 108, ROOM.y + 14);
    draw('clinic', 'poster_heart', 150, ROOM.y + 20);
    draw('interior', 'corkboard', 196, ROOM.y + 26);
    draw('interior', 'window', 250, ROOM.y + 10);
    draw('interior', 'window_wide', 282, ROOM.y + 10);
    draw('interior', 'clock', 330, ROOM.y + 14);

    // Koberec na podlahe (mačky po ňom chodia, preto je v pozadí)
    draw('interior', 'rug', 262, FLOOR_TOP + 70);
    canvas.refresh();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-1000);
  }

  /** Predmet stojí na zemi: (x, bottomY) = stred spodnej hrany. */
  private prop(sheet: Sheet, name: string, x: number, bottomY: number): Phaser.GameObjects.Image {
    return this.add.image(x, bottomY, sheet, name).setOrigin(0.5, 1).setDepth(bottomY);
  }

  private placeFurniture(): void {
    const wallBase = FLOOR_TOP + 22;
    this.prop('interior', 'bookshelf', 40, wallBase);
    this.prop('clinic', 'cabinet_med', 72, wallBase);
    this.prop('clinic', 'drawers', 156, wallBase);
    this.prop('interior', 'plant', 186, wallBase + 2);
    this.prop('clinic', 'sink', 124, FLOOR_TOP + 8);
    this.prop('clinic', 'trash', 214, wallBase);

    // Ošetrovací kút vľavo
    this.prop('clinic', 'iv_stand', 38, FLOOR_TOP + 108);
    this.prop('clinic', 'exam_bed', 66, FLOOR_TOP + 104);
    this.prop('clinic', 'monitor', 66, FLOOR_TOP + 85).setDepth(FLOOR_TOP + 105);

    // Stôl dobrovoľníčky
    this.prop('interior', 'table', 120, FLOOR_TOP + 186);
    this.prop('interior', 'chair', 132, FLOOR_TOP + 160).setDepth(FLOOR_TOP + 150);
    this.prop('interior', 'desk_lamp', 96, FLOOR_TOP + 148).setDepth(FLOOR_TOP + 187);
    this.prop('interior', 'tv', 140, FLOOR_TOP + 150).setDepth(FLOOR_TOP + 187);

    // Mačací kút vpravo
    this.prop('interior', 'cushion', 440, FLOOR_TOP + 62);
    this.prop('interior', 'bowl', 330, FLOOR_TOP + 64);
    this.prop('interior', 'bowl', 344, FLOOR_TOP + 66);
    this.prop('interior', 'couch', 400, FLOOR_TOP + 188);
    this.prop('interior', 'lamp', 448, FLOOR_TOP + 160);
  }

  /** Klietka nakreslená kódom (v balíkoch nie je) – farby ladia s paletou interiéru. */
  private createCage(x: number, bottomY: number): void {
    const key = 'cage';
    if (!this.textures.exists(key)) {
      const w = 42;
      const h = 34;
      const tex = this.textures.createCanvas(key, w, h);
      if (tex) {
        const c = tex.getContext();
        c.fillStyle = '#5b4a5e'; // podstava
        c.fillRect(0, h - 6, w, 6);
        c.fillStyle = '#7a6880';
        c.fillRect(1, h - 6, w - 2, 2);
        c.fillStyle = '#d9cbb8'; // drôty
        for (let i = 1; i < w; i += 5) c.fillRect(i, 3, 1, h - 9);
        c.fillRect(0, 2, w, 2);
        c.fillRect(0, h - 9, w, 1);
        c.fillStyle = '#b0a090';
        c.fillRect(0, 4, w, 1);
        c.fillStyle = '#e8a87c'; // dvierka – rúčka
        c.fillRect(w / 2 - 3, 14, 6, 2);
        c.fillStyle = 'rgba(255,255,255,0.10)';
        c.fillRect(1, 5, w - 2, h - 11);
        tex.refresh();
      }
    }
    this.add.image(x, bottomY, key).setOrigin(0.5, 1).setDepth(bottomY);
  }

  private createZuzka(): void {
    const y = FLOOR_TOP + 168;
    this.zuzka = this.add.sprite(176, y, 'zuzka', 1).setOrigin(0.5, 1).setDepth(y);
    this.add.ellipse(176, y, 14, 5, 0x000000, 0.22).setDepth(y - 1);
    // Občas sa pozrie iným smerom: idle snímky dole/vľavo/vpravo/hore = 1, 4, 7, 10
    this.time.addEvent({
      delay: 3500,
      loop: true,
      callback: () => this.zuzka.setFrame(Phaser.Utils.Array.GetRandom([1, 1, 4, 7, 10])),
    });
  }
}
