import Phaser from 'phaser';
import type { GameState, SchoolTrip } from '../core/GameState';
import { INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { DPR } from './dpr';
import { EDUCATION_X, FLOOR_TOP, ROOM, WORLD_H, WORLD_W } from './layout';
import { IdleLife } from './idleLife';
import {
  ensurePersonAnims,
  personIdleFrame,
  personKey,
  personWalkKey,
  type PersonDir,
} from './personAnims';
import { addProp, type WorldGeom } from './world';

const FT0 = FLOOR_TOP;
const DOOR = { x: EDUCATION_X + ROOM.x + 8, y: FT0 + 160 };
/** Lavičky pre deti (miesta, kde sedia čelom k tabuli). */
const SEATS = [0, 1, 2, 3, 4].map((i) => ({
  x: EDUCATION_X + 150 + (i % 3) * 46 + (i >= 3 ? 23 : 0),
  y: FT0 + 104 + (i >= 3 ? 34 : 0),
}));
const TEACHER = { x: EDUCATION_X + 96, y: FT0 + 62 };
/** Koberec na hranie so stálicami (vpravo). */
export const PLAY_SPOTS = [
  { x: EDUCATION_X + 360, y: FT0 + 140 },
  { x: EDUCATION_X + 404, y: FT0 + 156 },
  { x: EDUCATION_X + 330, y: FT0 + 168 },
];
const KID_SCALE = 0.8;

/**
 * Edukačné centrum (GDD §6.9): učebňa s tabuľou a lavičkami, koberec na hranie.
 * Školský výlet príde dverami, deti si sadnú, po prednáške sa idú pohrať a odídu.
 */
export class EducationRoom {
  readonly lamps: [number, number, number][] = [
    [EDUCATION_X + 200, FLOOR_TOP + 60, 56],
    [EDUCATION_X + 380, FLOOR_TOP + 120, 40],
  ];
  private group: Phaser.GameObjects.Sprite[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    state: GameState,
    private readonly geom: WorldGeom,
    private readonly onTap: () => void,
  ) {
    this.makeTextures();
    this.buildBackground();
    this.placeProps();
    const zone = scene.add
      .zone(EDUCATION_X + 40, FT0 - 50, 260, 210)
      .setOrigin(0)
      .setDepth(4400);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const c = scene.game.canvas;
      if (p.downElement === c && p.upElement === c && p.getDistance() < 12 * DPR) this.onTap();
    });
    // výlet uložený v save – deti už sedia
    const trip = state.education.trip;
    if (trip) this.seatGroup(trip, false);
  }

  /** Výlet prišiel: učiteľka a deti prídu dverami a sadnú si. */
  arrive(trip: SchoolTrip): void {
    this.seatGroup(trip, true);
  }

  /** Výlet končí: deti sa (po prednáške) chvíľu hrajú na koberci a odídu. */
  leave(played: boolean): void {
    const group = this.group;
    this.group = [];
    const out = () =>
      group.forEach((p, i) =>
        this.scene.time.delayedCall(i * 250, () =>
          this.walk(p, DOOR.x, DOOR.y, () =>
            this.scene.tweens.add({
              targets: p,
              alpha: 0,
              duration: 300,
              onComplete: () => p.destroy(),
            }),
          ),
        ),
      );
    if (!played) {
      out();
      return;
    }
    // deti (nie učiteľka) sa rozbehnú ku koberci
    group.slice(1).forEach((p, i) => {
      const s = PLAY_SPOTS[i % PLAY_SPOTS.length]!;
      this.walk(p, s.x + (i >= PLAY_SPOTS.length ? 14 : -14), s.y + 6, () =>
        p.setFrame(personIdleFrame('right')),
      );
    });
    this.scene.time.delayedCall(6500, out);
  }

  private seatGroup(trip: SchoolTrip, animate: boolean): void {
    for (const p of this.group) p.destroy();
    this.group = [];
    const people = [trip.teacher, ...trip.kids];
    people.forEach((sheet, i) => {
      ensurePersonAnims(this.scene.anims, sheet);
      const kid = i > 0;
      const to = kid ? SEATS[(i - 1) % SEATS.length]! : TEACHER;
      const start = animate ? DOOR : to;
      const p = this.scene.add
        .sprite(start.x, start.y, personKey(sheet), personIdleFrame(kid ? 'up' : 'down'))
        .setOrigin(0.5, 1)
        .setScale(kid ? KID_SCALE : 1)
        .setDepth(start.y);
      this.group.push(p);
      // sedia a obzerajú sa (deti hlavne dopredu k učiteľke)
      new IdleLife(this.scene, p, {
        sheet,
        looks: kid ? ['up', 'up', 'up', 'left', 'right'] : ['down', 'down', 'left', 'right'],
      });
      if (!animate) return;
      p.setAlpha(0);
      this.scene.time.delayedCall(i * 300, () => {
        this.scene.tweens.add({ targets: p, alpha: 1, duration: 250 });
        this.walk(p, to.x, to.y, () => p.setFrame(personIdleFrame(kid ? 'up' : 'down')));
      });
    });
  }

  private walk(p: Phaser.GameObjects.Sprite, x: number, y: number, done: () => void): void {
    const sheet = (p.texture.key as string).replace('person-', '');
    const dx = x - p.x;
    const dy = y - p.y;
    const dir: PersonDir =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    p.play(personWalkKey(sheet, dir), true);
    this.scene.tweens.add({
      targets: p,
      x,
      y,
      duration: (Math.hypot(dx, dy) / 32) * 1000,
      onUpdate: () => p.setDepth(p.y),
      onComplete: () => {
        p.anims.stop();
        done();
      },
    });
  }

  // ---------- Pozadie a nábytok ----------

  private buildBackground(): void {
    const key = 'education-bg';
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
    const { x: RX, y: RY, w: RW, wallH: WH, floorH: FH } = ROOM;
    const FT = FLOOR_TOP;
    px('#2b2533', 0, 0, WORLD_W, WORLD_H);
    // teplá žltá stena s lištou, drevená podlaha
    px('#f2d98a', RX, RY, RW, WH);
    px('#e8c870', RX, FT - 16, RW, 16);
    px('#c9a050', RX, FT - 17, RW, 1);
    for (let x = RX; x < RX + RW; x += 32)
      for (let y = FT; y < FT + FH; y += 32) draw('floor_wood', x, y);
    px('rgba(30, 20, 40, 0.28)', RX, FT, RW, 4);
    // tabuľa s nakreslenou mačkou
    px('#5a3a26', 120, RY + 8, 150, 52);
    px('#2f5a46', 123, RY + 11, 144, 44);
    const ch = '#e8f0ea';
    px(ch, 140, RY + 26, 14, 10); // telo mačky
    px(ch, 152, RY + 20, 8, 8); // hlava
    px(ch, 152, RY + 18, 2, 2);
    px(ch, 158, RY + 18, 2, 2);
    px(ch, 136, RY + 22, 2, 6); // chvost
    px(ch, 142, RY + 36, 2, 4);
    px(ch, 150, RY + 36, 2, 4);
    for (let i = 0; i < 5; i++) px(ch, 180, RY + 18 + i * 7, 60 - i * 8, 2); // „text"
    px('#f2c14e', 245, RY + 20, 8, 8); // srdiečko
    px('#c9a050', 120, RY + 60, 150, 3); // polička na kriedu
    px('#ffffff', 140, RY + 58, 6, 2);
    // plagáty s mačkami
    for (const [x, c] of [
      [300, '#e88aa8'],
      [340, '#7ec8ee'],
      [380, '#9ad17b'],
    ] as const) {
      px('#5a3a26', x, RY + 14, 30, 34);
      px('#fff8e8', x + 2, RY + 16, 26, 30);
      px(c, x + 6, RY + 22, 18, 14);
      px('#3b2f45', x + 10, RY + 26, 2, 2);
      px('#3b2f45', x + 18, RY + 26, 2, 2);
    }
    draw('window', 40, RY + 12);
    draw('window', 430, RY + 12);
    // koberec na hranie
    px('#7a4a8a', 300, FT + 120, 150, 66);
    px('#9a6aaa', 304, FT + 124, 142, 58);
    for (let x = 310; x < 440; x += 18) px('#f2c14e', x, FT + 150, 8, 2);
    // dvere
    px('#5b4a5e', RX, FT + 118, 6, 64);
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(RX - 1, RY - 1, RW + 2, WH + FH + 2);
    canvas.refresh();
    this.scene.add.image(EDUCATION_X, 0, key).setOrigin(0, 0).setDepth(-1000);
  }

  private prop(key: string, frame: string | undefined, x: number, bottom: number, footprint = 0) {
    const img = this.scene.add
      .image(EDUCATION_X + x, bottom, key, frame)
      .setOrigin(0.5, 1)
      .setDepth(bottom);
    addProp(this.geom, EDUCATION_X + x, bottom, img.width, img.height, footprint);
    return img;
  }

  private placeProps(): void {
    const FT = FLOOR_TOP;
    this.prop('interior', 'bookshelf', 40, FT + 60, 14);
    this.prop('interior', 'plant', 290, FT + 40, 6);
    this.prop('ed-desk', undefined, 96, FT + 78, 10);
    // lavičky (pod deťmi)
    for (const s of SEATS) {
      this.scene.add
        .image(s.x, s.y + 2, 'ed-bench')
        .setOrigin(0.5, 1)
        .setDepth(s.y + 3);
    }
    this.prop('ed-toys', undefined, 420, FT + 128);
    this.prop('interior', 'plant', 452, FT + 186, 8);
  }

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
    make('ed-bench', 34, 8, (px) => {
      px(OUT, 0, 0, 34, 5);
      px('#c9935f', 1, 1, 32, 3);
      px(OUT, 3, 5, 3, 3);
      px(OUT, 28, 5, 3, 3);
    });
    make('ed-desk', 40, 22, (px) => {
      px(OUT, 0, 0, 40, 16);
      px('#a87446', 1, 1, 38, 14);
      px('#c9935f', 1, 1, 38, 3);
      px('#f4f4f4', 6, -0, 10, 3);
      px('#e05a5a', 24, 0, 6, 3);
      px(OUT, 3, 16, 4, 6);
      px(OUT, 33, 16, 4, 6);
    });
    make('ed-toys', 30, 14, (px) => {
      px('#b0507a', 2, 6, 8, 8);
      px('#f27a9b', 3, 7, 6, 6);
      px('#7a6880', 14, 9, 8, 4);
      px('#a99bb0', 15, 9, 5, 2);
      px('#e8a0a0', 21, 8, 2, 2);
      px(OUT, 24, 0, 2, 14);
      px('#f2c14e', 22, 0, 6, 3);
    });
  }
}
