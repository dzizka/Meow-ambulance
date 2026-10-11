import Phaser from 'phaser';
import { CLINIC_FRAMES, INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { FLOOR_TOP, ROOM, SHELTER_X, WORLD_H, WORLD_W } from './layout';
import { addProp, type WorldGeom } from './world';

/** Karanténa v ľavej polovici útulku – tu sa prechádzajú pacienti z karantény. */
export const QUARANTINE_AREA = new Phaser.Geom.Rectangle(SHELTER_X + 40, FLOOR_TOP + 60, 180, 116);
/** Klietky v karanténe (stred, spodná hrana). */
export const QUARANTINE_CAGES = [56, 106, 156, 206].map((x) => ({
  x: SHELTER_X + x,
  y: FLOOR_TOP + 40,
}));
/** Priečka medzi karanténou a ambulanciou (x v súradniciach miestnosti). */
const WALL_X = 238;

/**
 * Komunitný útulok – Fáza 2 (GDD §6.2). Tretia budova sveta: karanténa a ambulancia.
 * Iba zobrazenie; pravidlá sú v GameState.
 */
export class ShelterRoom {
  readonly lamps: [number, number, number][] = [
    [SHELTER_X + 120, FLOOR_TOP + 120, 44],
    [SHELTER_X + 360, FLOOR_TOP + 110, 44],
  ];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly geom: WorldGeom,
  ) {
    this.buildBackground();
    this.placeFurniture();
  }

  private buildBackground(): void {
    const key = 'shelter-bg';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const canvas = this.scene.textures.createCanvas(key, WORLD_W, WORLD_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    const interior = this.scene.textures.get('interior').getSourceImage() as CanvasImageSource;
    const clinic = this.scene.textures.get('clinic').getSourceImage() as CanvasImageSource;
    const draw = (name: keyof typeof INTERIOR_FRAMES, dx: number, dy: number) => {
      const [x, y, w, h] = INTERIOR_FRAMES[name] as FrameRect;
      ctx.drawImage(interior, x, y, w, h, Math.round(dx), Math.round(dy), w, h);
    };
    const drawC = (name: keyof typeof CLINIC_FRAMES, dx: number, dy: number) => {
      const [x, y, w, h] = CLINIC_FRAMES[name] as FrameRect;
      ctx.drawImage(clinic, x, y, w, h, Math.round(dx), Math.round(dy), w, h);
    };

    ctx.fillStyle = '#2b2533';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Karanténa: ružové steny a drevená podlaha; ambulancia: modré steny a dlaždice
    for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += 32) {
      const left = x < WALL_X;
      draw(left ? 'wall_pink_top' : 'wall_blue_top', x, ROOM.y);
      draw(left ? 'wall_pink_bottom' : 'wall_blue_bottom', x, ROOM.y + 32);
      for (let y = FLOOR_TOP; y < FLOOR_TOP + ROOM.floorH; y += 32)
        draw(left ? 'floor_wood' : 'floor_tile', x, y);
    }
    ctx.fillStyle = 'rgba(30, 20, 40, 0.28)';
    ctx.fillRect(ROOM.x, FLOOR_TOP, ROOM.w, 4);
    // Priečka s otvorom (dvere) medzi karanténou a ambulanciou
    ctx.fillStyle = '#5b4a5e';
    ctx.fillRect(WALL_X, ROOM.y, 6, FLOOR_TOP + 118 - ROOM.y);
    ctx.fillRect(WALL_X, FLOOR_TOP + 160, 6, 32);
    ctx.fillStyle = '#7a6880';
    ctx.fillRect(WALL_X, ROOM.y, 2, FLOOR_TOP + 118 - ROOM.y);
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(ROOM.x - 1, ROOM.y - 1, ROOM.w + 2, ROOM.wallH + ROOM.floorH + 2);

    // Výzdoba na stenách
    draw('window', 60, ROOM.y + 12);
    drawC('sign_cross', 100, ROOM.y + 16);
    draw('window', 150, ROOM.y + 12);
    drawC('poster_heart', 410, ROOM.y + 20);
    draw('clock', 430, ROOM.y + 14);
    canvas.refresh();
    this.scene.add.image(SHELTER_X, 0, key).setOrigin(0, 0).setDepth(-1000);
    // Priečka je prekážka – mačky z karantény do ambulancie nechodia
    this.geom.obstacles.push(
      new Phaser.Geom.Rectangle(SHELTER_X + WALL_X - 2, FLOOR_TOP, 10, ROOM.floorH),
    );
  }

  private prop(
    sheet: 'interior' | 'clinic',
    name: string,
    x: number,
    bottomY: number,
    footprint = 0,
  ) {
    const img = this.scene.add
      .image(SHELTER_X + x, bottomY, sheet, name)
      .setOrigin(0.5, 1)
      .setDepth(bottomY);
    addProp(this.geom, SHELTER_X + x, bottomY, img.width, img.height, footprint);
    return img;
  }

  private placeFurniture(): void {
    const wallBase = FLOOR_TOP + 22;
    // Karanténa: klietky pri stene, misky, vankúšik
    for (const c of QUARANTINE_CAGES) {
      this.scene.add.image(c.x, c.y, 'cage').setOrigin(0.5, 1).setDepth(c.y);
    }
    this.prop('interior', 'plant', 30, wallBase + 4);
    this.prop('interior', 'bowl', 120, FLOOR_TOP + 100);
    this.prop('interior', 'bowl', 134, FLOOR_TOP + 102);
    this.prop('interior', 'cushion', 80, FLOOR_TOP + 160);
    this.prop('interior', 'cushion', 190, FLOOR_TOP + 170);

    // Ambulancia
    this.prop('clinic', 'cabinet_white', 270, wallBase);
    this.prop('clinic', 'cabinet_med', 300, wallBase);
    this.prop('clinic', 'drawers', 334, wallBase);
    this.prop('clinic', 'sink', 370, FLOOR_TOP + 8);
    this.prop('clinic', 'plant_tall', 440, wallBase);
    this.prop('clinic', 'iv_stand', 300, FLOOR_TOP + 130, 8);
    this.prop('clinic', 'exam_bed', 340, FLOOR_TOP + 128, 14);
    this.prop('clinic', 'monitor', 340, FLOOR_TOP + 108).setDepth(FLOOR_TOP + 129);
    this.prop('clinic', 'office_chair', 392, FLOOR_TOP + 152, 10);
    this.prop('interior', 'bookshelf', 440, FLOOR_TOP + 190, 14);
  }
}
