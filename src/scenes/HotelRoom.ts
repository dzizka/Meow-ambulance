import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import { INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { FLOOR_TOP, HOTEL_X, ROOM, WORLD_H, WORLD_W } from './layout';
import { ensurePersonAnims, personIdleFrame, personKey, personWalkKey } from './personAnims';
import { addProp, type WorldGeom } from './world';

/** Kde sa prechádzajú hostia hotela. */
export const HOTEL_AREA = new Phaser.Geom.Rectangle(HOTEL_X + 140, FLOOR_TOP + 62, 300, 112);
/** Apartmány (ľavý okraj, šírka) – x v súradniciach budovy. */
const SUITE_X0 = 150;
const SUITE_W = 54;
const SUITE_GAP = 6;
const MAX_SUITES = 5;
/** Recepcia – sem príde majiteľ s mačkou. */
const DESK = { x: 76, y: FLOOR_TOP + 70 };
const DOOR = { x: ROOM.x + 8, y: FLOOR_TOP + 150 };

/**
 * Mačací hotel (GDD §6.7): recepcia, apartmány pri zadnej stene, salónik. Majitelia prinášajú
 * a odnášajú mačky. Nekúpené apartmány sú zatiahnuté závesom. Iba zobrazenie.
 */
export class HotelRoom {
  readonly lamps: [number, number, number][] = [
    [HOTEL_X + 76, FLOOR_TOP + 50, 36],
    [HOTEL_X + 300, FLOOR_TOP + 40, 50],
  ];
  private readonly curtains: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly geom: WorldGeom,
  ) {
    this.makeTextures();
    this.buildBackground();
    this.placeProps();
    this.refreshSuites(false);
  }

  /** Miesto v apartmáne (pelech) pre i-teho hosťa. */
  suiteSpot(i: number): { x: number; y: number } {
    return {
      x: HOTEL_X + SUITE_X0 + i * (SUITE_W + SUITE_GAP) + SUITE_W / 2,
      y: FLOOR_TOP + 16,
    };
  }

  /** Zatiahnuté závesy cez apartmány, ktoré ešte nie sú kúpené. */
  refreshSuites(animate: boolean): void {
    const open = this.state.suiteCount;
    this.curtains.forEach((c, i) => {
      if (i < open && c.visible) {
        if (animate)
          this.scene.tweens.add({
            targets: c,
            scaleY: 0.05,
            duration: 500,
            ease: 'Sine.easeIn',
            onComplete: () => c.setVisible(false),
          });
        else c.setVisible(false);
      }
    });
  }

  /**
   * Majiteľ príde k recepcii (a po `onArrive` zase odíde). Pri príchode prinesie mačku,
   * pri odchode si ju zoberie.
   */
  ownerVisit(sheet: string, onArrive: (at: { x: number; y: number }) => void): void {
    ensurePersonAnims(this.scene.anims, sheet);
    const start = { x: HOTEL_X + DOOR.x, y: DOOR.y };
    const at = { x: HOTEL_X + DESK.x + 26, y: DESK.y + 18 };
    const p = this.scene.add
      .sprite(start.x, start.y, personKey(sheet), personIdleFrame('right'))
      .setOrigin(0.5, 1)
      .setDepth(start.y)
      .setAlpha(0);
    const walk = (x: number, y: number, done: () => void) => {
      const dx = x - p.x;
      p.play(
        personWalkKey(
          sheet,
          Math.abs(dx) > Math.abs(y - p.y) ? (dx < 0 ? 'left' : 'right') : y < p.y ? 'up' : 'down',
        ),
        true,
      );
      this.scene.tweens.add({
        targets: p,
        x,
        y,
        duration: (Math.hypot(dx, y - p.y) / 30) * 1000,
        onUpdate: () => p.setDepth(p.y),
        onComplete: () => {
          p.anims.stop();
          done();
        },
      });
    };
    this.scene.tweens.add({ targets: p, alpha: 1, duration: 300 });
    walk(at.x, at.y, () => {
      p.setFrame(personIdleFrame('up'));
      this.scene.time.delayedCall(700, () => {
        onArrive(at);
        this.scene.time.delayedCall(900, () =>
          walk(start.x, start.y, () =>
            this.scene.tweens.add({
              targets: p,
              alpha: 0,
              duration: 300,
              onComplete: () => p.destroy(),
            }),
          ),
        );
      });
    });
  }

  // ---------- Pozadie a nábytok ----------

  private buildBackground(): void {
    const key = 'hotel-bg';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const canvas = this.scene.textures.createCanvas(key, WORLD_W, WORLD_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    const interior = this.scene.textures.get('interior').getSourceImage() as CanvasImageSource;
    const draw = (name: keyof typeof INTERIOR_FRAMES, dx: number, dy: number) => {
      const [x, y, w, h] = INTERIOR_FRAMES[name] as FrameRect;
      ctx.drawImage(interior, x, y, w, h, Math.round(dx), Math.round(dy), w, h);
    };
    const px = (c: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const { x: RX, y: RY, w: RW, floorH: FH } = ROOM;
    const FT = FLOOR_TOP;
    px('#2b2533', 0, 0, WORLD_W, WORLD_H);
    for (let x = RX; x < RX + RW; x += 32) {
      draw('wall_pink_top', x, RY);
      draw('wall_pink_bottom', x, RY + 32);
      for (let y = FT; y < FT + FH; y += 32) draw('floor_wood', x, y);
    }
    // zlatá lišta a pás pod stenou
    px('#d9a441', RX, FT - 22, RW, 2);
    px('rgba(30, 20, 40, 0.28)', RX, FT, RW, 4);
    // červený koberec od dverí k apartmánom
    px('#8e2f3c', RX, FT + 138, RW, 26);
    px('#b0424f', RX, FT + 140, RW, 22);
    for (let x = RX + 6; x < RX + RW; x += 16) px('#d9a441', x, FT + 150, 6, 2);
    // vchod (vľavo)
    px('#5b4a5e', RX, FT + 118, 6, 64);
    // apartmány pri zadnej stene
    for (let i = 0; i < MAX_SUITES; i++) {
      const x = SUITE_X0 + i * (SUITE_W + SUITE_GAP);
      const top = FT - 44;
      px('#5a3a26', x - 2, top - 2, SUITE_W + 4, 70);
      px('#8a5a3c', x, top, SUITE_W, 66);
      px('#f4d9b0', x + 3, top + 3, SUITE_W - 6, 56); // tapeta vnútri
      px('#e8c79a', x + 3, top + 3, SUITE_W - 6, 4);
      px('#c98c54', x + 3, top + 52, SUITE_W - 6, 7); // podlaha apartmánu
      px('#d9a441', x + SUITE_W / 2 - 6, top - 9, 12, 7); // tabuľka s číslom
      px('#5a3a26', x + SUITE_W / 2 - 1, top - 8, 2, 5);
      if (i > 0) px('#5a3a26', x + SUITE_W / 2 - 4, top - 8, 2, 5);
    }
    // tabuľa s kľúčmi za recepciou
    px('#5a3a26', 50, RY + 18, 52, 24);
    px('#8a5a3c', 52, RY + 20, 48, 20);
    for (let i = 0; i < 6; i++) {
      px('#d9a441', 56 + i * 7, RY + 24, 3, 3);
      px('#d9a441', 57 + i * 7, RY + 27, 1, 6);
    }
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(RX - 1, RY - 1, RW + 2, ROOM.wallH + FH + 2);
    canvas.refresh();
    this.scene.add.image(HOTEL_X, 0, key).setOrigin(0, 0).setDepth(-1000);
  }

  private prop(key: string, frame: string | undefined, x: number, bottom: number, footprint = 0) {
    const img = this.scene.add
      .image(HOTEL_X + x, bottom, key, frame)
      .setOrigin(0.5, 1)
      .setDepth(bottom);
    addProp(this.geom, HOTEL_X + x, bottom, img.width, img.height, footprint);
    return img;
  }

  private placeProps(): void {
    const FT = FLOOR_TOP;
    this.prop('ht-desk', undefined, DESK.x, DESK.y, 14);
    // recepčná za pultom
    const rec = this.state.data.balance.hotel.receptionist_sprite;
    this.scene.add
      .sprite(HOTEL_X + DESK.x - 8, DESK.y - 12, personKey(rec), personIdleFrame('down'))
      .setOrigin(0.5, 1)
      .setDepth(DESK.y - 12);
    this.prop('ht-luggage', undefined, 120, FT + 112, 8);
    this.prop('interior', 'couch', 70, FT + 190, 16);
    this.prop('interior', 'plant', 132, FT + 186, 8);
    this.prop('interior', 'lamp', 20 + 10, FT + 186, 4);
    this.prop('interior', 'plant', 452, FT + 40, 6);
    // pelechy v apartmánoch a závesy cez nekúpené
    for (let i = 0; i < MAX_SUITES; i++) {
      const s = this.suiteSpot(i);
      this.scene.add
        .image(s.x, s.y + 4, 'interior', 'cushion')
        .setOrigin(0.5, 1)
        .setDepth(FT - 30);
      this.curtains.push(
        this.scene.add
          .image(s.x, FT - 44, 'ht-curtain')
          .setOrigin(0.5, 0)
          .setDepth(FT + 30),
      );
    }
  }

  // ---------- Textúry ----------

  private makeTextures(): void {
    const make = (
      key: string,
      w: number,
      h: number,
      draw: (px: (c: string, x: number, y: number, w: number, h: number) => void) => void,
    ) => {
      if (this.scene.textures.exists(key)) return;
      const tex = this.scene.textures.createCanvas(key, w, h);
      if (!tex) return;
      const ctx = tex.getContext();
      draw((c, x, y, ww, hh) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, ww, hh);
      });
      tex.refresh();
    };
    const OUT = '#3b2f45';
    // Recepčný pult so zvončekom a knihou hostí
    make('ht-desk', 64, 28, (px) => {
      px(OUT, 0, 6, 64, 22);
      px('#8a5a3c', 1, 7, 62, 20);
      px('#a8754c', 1, 7, 62, 4);
      px('#d9a441', 4, 14, 56, 2);
      px('#6a4a32', 6, 18, 52, 8);
      px('#f4f4f4', 40, 2, 12, 5); // kniha
      px('#c94a4a', 40, 2, 2, 5);
      px('#d9a441', 18, 1, 8, 5); // zvonček
      px('#f2d27a', 19, 1, 4, 2);
      px(OUT, 17, 6, 10, 1);
    });
    // Kufre
    make('ht-luggage', 26, 22, (px) => {
      px(OUT, 0, 6, 16, 16);
      px('#5a8ac0', 1, 7, 14, 14);
      px('#3a6a9a', 1, 13, 14, 2);
      px(OUT, 5, 3, 6, 4);
      px(OUT, 12, 0, 14, 22);
      px('#c94a4a', 13, 1, 12, 20);
      px('#d9a441', 13, 9, 12, 2);
    });
    // Záves cez nekúpený apartmán
    make('ht-curtain', 54, 66, (px) => {
      px('#6a2a3a', 0, 0, 54, 66);
      for (let x = 2; x < 54; x += 7) px('#8e3a4c', x, 0, 4, 66);
      px('#d9a441', 0, 0, 54, 3);
      px('#d9a441', 24, 30, 6, 6);
      px(OUT, 26, 32, 2, 3);
    });
  }
}
