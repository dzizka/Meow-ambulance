import Phaser from 'phaser';
import { INTERIOR_FRAMES } from '../data/frames';
import { CATIO_X, FLOOR_TOP, ROOM, WORLD_H, WORLD_W } from './layout';
import { addProp, type WorldGeom } from './world';

/** Kde sa vo výbehu prechádzajú stálice. */
export const CATIO_AREA = new Phaser.Geom.Rectangle(CATIO_X + 44, FLOOR_TOP + 46, 380, 132);

/**
 * Catio – vonkajší výbeh pri kaviarni (GDD §6.6): tráva, plot, stromček, prelézačky,
 * motýle a vtáčiky. Stálice sem chodia cez deň. Iba zobrazenie.
 */
export class CatioRoom {
  readonly lamps: [number, number, number][] = [
    [CATIO_X + 70, FLOOR_TOP + 40, 34],
    [CATIO_X + 410, FLOOR_TOP + 40, 34],
  ];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly geom: WorldGeom,
  ) {
    this.makeTextures();
    this.buildBackground();
    this.placeProps();
    for (let i = 0; i < 3; i++) this.butterfly(i);
    scene.time.addEvent({ delay: 9000, loop: true, callback: () => this.bird() });
  }

  // ---------- Pozadie ----------

  private buildBackground(): void {
    const key = 'catio-bg';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const canvas = this.scene.textures.createCanvas(key, WORLD_W, WORLD_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    const px = (c: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const { x: RX, y: RY, w: RW, floorH: FH } = ROOM;
    const FT = FLOOR_TOP;
    const rnd = new Phaser.Math.RandomDataGenerator(['catio']);

    px('#2b2533', 0, 0, WORLD_W, WORLD_H);
    // Obloha s obláčikmi
    const sky = ctx.createLinearGradient(0, RY, 0, FT);
    sky.addColorStop(0, '#8fc8ee');
    sky.addColorStop(1, '#cfe9f7');
    ctx.fillStyle = sky;
    ctx.fillRect(RX, RY, RW, FT - RY);
    for (const [cx, cy, w] of [
      [80, RY + 12, 30],
      [230, RY + 8, 40],
      [380, RY + 16, 26],
    ] as const) {
      px('#ffffff', cx, cy, w, 5);
      px('#ffffff', cx + 5, cy - 3, w - 12, 3);
      px('#e6f3fb', cx, cy + 5, w, 1);
    }
    // Živý plot za plotom
    for (let x = RX; x < RX + RW; x += 10) {
      const h = 14 + rnd.between(0, 6);
      px('#4f8a4a', x, FT - 6 - h, 12, h + 6);
      px('#64a35a', x + 2, FT - 4 - h, 6, 3);
    }
    // Drevený plot
    for (let x = RX + 2; x < RX + RW; x += 9) {
      px('#7a5236', x, FT - 26, 7, 30);
      px('#c9935f', x + 1, FT - 25, 5, 28);
      px('#e0b07a', x + 1, FT - 25, 1, 28);
      px('#7a5236', x, FT - 28, 7, 2);
    }
    px('#7a5236', RX, FT - 18, RW, 3);
    px('#a87446', RX, FT - 17, RW, 1);
    px('#7a5236', RX, FT - 6, RW, 3);
    // Tráva s trsmi
    px('#7cbf5a', RX, FT, RW, FH);
    for (let i = 0; i < 260; i++) {
      const x = RX + rnd.between(0, RW - 3);
      const y = FT + rnd.between(2, FH - 3);
      px(rnd.frac() < 0.5 ? '#6aad4c' : '#8fd06a', x, y, 2, 1);
      if (rnd.frac() < 0.3) px('#5a9a42', x + 1, y - 1, 1, 1);
    }
    // Kvietky v tráve
    for (let i = 0; i < 26; i++) {
      const x = RX + rnd.between(4, RW - 6);
      const y = FT + rnd.between(10, FH - 6);
      px(['#f7f3e8', '#f2c14e', '#e88aa8'][i % 3] ?? '#fff', x, y, 2, 2);
      px('#f2c14e', x, y, 1, 1);
    }
    // Chodník z kameňov od dverí kaviarne
    for (let i = 0; i < 9; i++) {
      const x = RX + 30 + i * 22;
      const y = FT + 120 + Math.round(Math.sin(i * 0.8) * 10);
      px('#8a8494', x, y, 14, 8);
      px('#b3adbd', x + 1, y + 1, 12, 5);
      px('#9a94a6', x + 2, y + 5, 10, 2);
    }
    // Drevená terasa pri dverách
    px('#7a5236', RX, FT + 92, 40, 56);
    for (let y = FT + 93; y < FT + 147; y += 6) {
      px('#c9935f', RX + 1, y, 38, 5);
      px('#a87446', RX + 1, y + 4, 38, 1);
    }
    // Dvere do kaviarne (vľavo na stene)
    px('#5b4a5e', RX, FT - 40, 26, 44);
    px('#c98c54', RX + 3, FT - 37, 20, 41);
    px('#a06a3c', RX + 5, FT - 33, 16, 14);
    px('#b0d8f0', RX + 7, FT - 31, 12, 10);
    px('#f2c14e', RX + 19, FT - 14, 2, 2);
    // Kvetinový záhon pri plote
    for (let x = RX + 60; x < RX + RW - 20; x += 46) {
      px('#6a4a32', x, FT + 2, 30, 8);
      for (let k = 0; k < 5; k++) {
        px('#4f8a4a', x + 2 + k * 6, FT - 2, 2, 5);
        px(
          ['#e05a5a', '#f2c14e', '#e88aa8', '#f7f3e8', '#8a7ad8'][k] ?? '#fff',
          x + 1 + k * 6,
          FT - 4,
          4,
          3,
        );
      }
    }
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(RX - 1, RY - 1, RW + 2, ROOM.wallH + FH + 2);
    canvas.refresh();
    this.scene.add.image(CATIO_X, 0, key).setOrigin(0, 0).setDepth(-1000);
  }

  private prop(key: string, frame: string | undefined, x: number, bottom: number, footprint = 0) {
    const img = this.scene.add
      .image(CATIO_X + x, bottom, key, frame)
      .setOrigin(0.5, 1)
      .setDepth(bottom);
    addProp(this.geom, CATIO_X + x, bottom, img.width, img.height, footprint);
    return img;
  }

  private placeProps(): void {
    const FT = FLOOR_TOP;
    if (!this.scene.textures.get('interior').has('cushion')) {
      const [x, y, w, h] = INTERIOR_FRAMES.cushion;
      this.scene.textures.get('interior').add('cushion', 0, x, y, w, h);
    }
    this.prop('ct-tree', undefined, 420, FT + 100, 10);
    this.prop('ct-tower', undefined, 120, FT + 80, 10);
    this.prop('ct-house', undefined, 300, FT + 64, 8);
    this.prop('ct-birdbath', undefined, 230, FT + 166, 6);
    this.prop('ct-lamp', undefined, 70, FT + 36, 4);
    this.prop('ct-lamp', undefined, 410, FT + 36, 4);
    this.prop('interior', 'cushion', 360, FT + 170);
    this.prop('interior', 'cushion', 160, FT + 176);
  }

  // ---------- Život vo výbehu ----------

  /** Motýlik poletuje po výbehu od kvetu ku kvetu. */
  private butterfly(i: number): void {
    const color = [0xf2c14e, 0xe88aa8, 0xffffff][i % 3] ?? 0xffffff;
    const b = this.scene.add
      .container(CATIO_X + 100 + i * 110, FLOOR_TOP + 60 + i * 30)
      .setDepth(4200);
    const wingL = this.scene.add.rectangle(-1.5, 0, 3, 3, color);
    const wingR = this.scene.add.rectangle(1.5, 0, 3, 3, color);
    const body = this.scene.add.rectangle(0, 0, 1, 3, 0x3b2f45);
    b.add([wingL, wingR, body]);
    this.scene.tweens.add({
      targets: [wingL, wingR],
      scaleX: 0.3,
      yoyo: true,
      repeat: -1,
      duration: 140 + i * 20,
    });
    const fly = () => {
      this.scene.tweens.add({
        targets: b,
        x: CATIO_X + Phaser.Math.Between(40, 440),
        y: FLOOR_TOP + Phaser.Math.Between(10, 170),
        duration: Phaser.Math.Between(2500, 5000),
        ease: 'Sine.easeInOut',
        onComplete: () => this.scene.time.delayedCall(Phaser.Math.Between(300, 2000), fly),
      });
    };
    fly();
  }

  /** Vtáčik občas sadne na plot, poskočí a uletí. */
  private bird(): void {
    if (Math.random() < 0.4) return;
    const x = CATIO_X + Phaser.Math.Between(60, 420);
    const y = FLOOR_TOP - 28;
    const bird = this.scene.add
      .image(x - 120, y - 60, 'ct-bird')
      .setOrigin(0.5, 1)
      .setDepth(-900);
    this.scene.tweens.chain({
      targets: bird,
      tweens: [
        { x, y, duration: 1400, ease: 'Sine.easeOut' },
        { y: y - 2, yoyo: true, repeat: 3, duration: 160, delay: 800 },
        { x: x + 140, y: y - 70, duration: 1400, delay: 1500, ease: 'Sine.easeIn' },
      ],
      onComplete: () => bird.destroy(),
    });
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
    // Stromček
    make('ct-tree', 44, 60, (px) => {
      px('#6a4a32', 19, 34, 6, 26);
      px('#8a6242', 20, 34, 2, 26);
      px('#3f7a3c', 4, 10, 36, 26);
      px('#3f7a3c', 10, 2, 24, 36);
      px('#4f8a4a', 8, 8, 28, 22);
      px('#64a35a', 12, 6, 12, 8);
      px('#64a35a', 6, 18, 8, 6);
      px('#e05a5a', 28, 14, 3, 3);
      px('#e05a5a', 14, 24, 3, 3);
    });
    // Drevená prelézačka s plošinkami
    make('ct-tower', 30, 50, (px) => {
      px(OUT, 13, 4, 4, 46);
      for (let y = 6; y < 48; y += 2) px(y % 4 === 0 ? '#d9c39a' : '#c4a978', 14, y, 2, 2);
      px(OUT, 0, 44, 30, 6);
      px('#c9935f', 1, 45, 28, 4);
      px(OUT, 2, 24, 26, 5);
      px('#c9935f', 3, 25, 24, 3);
      px(OUT, 6, 2, 20, 5);
      px('#c9935f', 7, 3, 18, 3);
      px('#e8a0a0', 8, 0, 16, 3);
    });
    // Búdka
    make('ct-house', 28, 24, (px) => {
      px(OUT, 2, 8, 24, 16);
      px('#c98c54', 3, 9, 22, 14);
      px('#3b2f45', 10, 13, 8, 10);
      for (let i = 0; i < 9; i++) px('#a8403d', 1 + i, 8 - i, 26 - i * 2, 1);
      px('#f2c14e', 13, 4, 2, 2);
    });
    // Vtáčie napájadlo
    make('ct-birdbath', 18, 18, (px) => {
      px(OUT, 0, 2, 18, 5);
      px('#b3adbd', 1, 3, 16, 3);
      px('#7ec8ee', 3, 3, 12, 2);
      px(OUT, 7, 7, 4, 9);
      px('#b3adbd', 8, 7, 2, 9);
      px(OUT, 4, 15, 10, 3);
    });
    // Záhradná lampa
    make('ct-lamp', 8, 30, (px) => {
      px(OUT, 3, 6, 2, 24);
      px(OUT, 0, 0, 8, 7);
      px('#fff1b8', 1, 1, 6, 5);
      px(OUT, 1, 28, 6, 2);
    });
    // Vtáčik
    make('ct-bird', 6, 5, (px) => {
      px('#7a5236', 1, 1, 4, 3);
      px('#c9935f', 1, 2, 3, 2);
      px('#f2c14e', 5, 2, 1, 1);
      px(OUT, 4, 1, 1, 1);
      px('#5a3a26', 0, 2, 1, 1);
    });
  }
}
