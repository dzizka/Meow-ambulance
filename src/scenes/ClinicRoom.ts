import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { ClinicRoomId } from '../data/types';
import { CLINIC_FRAMES, INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { DPR } from './dpr';
import { CLINIC_X, FLOOR_TOP, ROOM, WORLD_H, WORLD_W } from './layout';
import { addProp, type WorldGeom } from './world';

/** Hranice troch miestností kliniky (x v súradniciach budovy). */
const SECTIONS: Record<ClinicRoomId, [number, number]> = {
  lab: [ROOM.x, 166],
  xray: [166, 316],
  or: [316, ROOM.x + ROOM.w],
};
/** Priečky s dverami medzi miestnosťami. */
const WALLS = [166, 316];
/** Miesto pacienta pri prístroji (svet) – mačka tam leží/sedí počas zákroku. */
export interface ClinicStation {
  x: number;
  y: number;
  lay: boolean;
  dir: 'down' | 'left' | 'right';
  depthBoost: number;
}
const FT0 = FLOOR_TOP;
const STATIONS: Record<ClinicRoomId, ClinicStation> = {
  lab: { x: CLINIC_X + 72, y: FT0 + 50, lay: false, dir: 'down', depthBoost: 24 },
  xray: { x: CLINIC_X + 229, y: FT0 + 99, lay: true, dir: 'right', depthBoost: 20 },
  or: { x: CLINIC_X + 400, y: FT0 + 109, lay: true, dir: 'right', depthBoost: 25 },
};
/** Pelechy na zotavenie po operácii. */
const RECOVERY = [
  { x: CLINIC_X + 424, y: FT0 + 180 },
  { x: CLINIC_X + 452, y: FT0 + 172 },
];
/** Ťuknuteľné prístroje (svet). */
const HOTSPOTS: Record<ClinicRoomId, [number, number, number, number]> = {
  lab: [CLINIC_X + 60, FT0 + 30, 64, 44],
  xray: [CLINIC_X + 190, FT0 + 28, 94, 92],
  or: [CLINIC_X + 370, FT0 + 20, 62, 114],
};

/** Kde sa prechádza veterinárka (laboratórium a röntgen). */
export const CLINIC_WALK = new Phaser.Geom.Rectangle(CLINIC_X + 40, FLOOR_TOP + 130, 240, 50);

/**
 * Klinika – Fáza 3 (GDD §6.5): laboratórium, röntgen a operačná sála vedľa seba.
 * Nekúpené miestnosti sú zakryté plachtou (ťuknutie otvorí obchod). Iba zobrazenie.
 */
export class ClinicRoom {
  readonly lamps: [number, number, number][] = [
    [CLINIC_X + 90, FLOOR_TOP + 110, 40],
    [CLINIC_X + 240, FLOOR_TOP + 110, 40],
    [CLINIC_X + 400, FLOOR_TOP + 100, 44],
  ];
  private readonly shown = new Set<ClinicRoomId>();
  private readonly tarps = new Map<ClinicRoomId, Phaser.GameObjects.Container>();
  /** Blikajúce svetielka prístrojov (obnovujú sa časovačom). */
  private readonly leds: {
    room: ClinicRoomId;
    g: Phaser.GameObjects.Rectangle;
    colors: number[];
  }[] = [];
  private cone: Phaser.GameObjects.Image | null = null;
  private beat: Phaser.GameObjects.Graphics | null = null;
  private beatX = 0;
  /** Obsadené pelechy na zotavenie (id mačky). */
  private readonly beds: (string | null)[] = RECOVERY.map(() => null);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly geom: WorldGeom,
    /** Ťuknutie na prístroj (alebo na plachtu nekúpenej miestnosti). */
    private readonly onTap: (room: ClinicRoomId) => void,
  ) {
    this.registerFrames();
    this.makeTextures();
    this.buildBackground();
    for (const room of Object.keys(SECTIONS) as ClinicRoomId[]) this.showRoom(room, false);
    state.bus.on('clinicRoomBought', ({ room }) => this.showRoom(room, true));
    for (const room of Object.keys(HOTSPOTS) as ClinicRoomId[]) this.makeHotspot(room);
    scene.time.addEvent({ delay: 450, loop: true, callback: () => this.blink() });
    scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => this.animate(dt));
  }

  /** Kde leží/sedí pacient pri prístroji. */
  station(room: ClinicRoomId): ClinicStation {
    return STATIONS[room];
  }

  /** Voľný pelech na zotavenie (alebo prvý, ak sú obsadené). */
  takeBed(catId: string): { x: number; y: number } {
    let i = this.beds.indexOf(catId);
    if (i < 0) i = this.beds.indexOf(null);
    if (i < 0) i = 0;
    this.beds[i] = catId;
    return RECOVERY[i] ?? RECOVERY[0]!;
  }

  freeBed(catId: string): void {
    const i = this.beds.indexOf(catId);
    if (i >= 0) this.beds[i] = null;
  }

  /** Efekt zákroku: záblesk röntgenu, bublinky v laboratóriu, jasnejšia lampa na sále. */
  effect(room: ClinicRoomId): void {
    const sc = this.scene;
    if (room === 'xray') {
      const [x0, x1] = SECTIONS.xray;
      const flash = sc.add
        .rectangle(CLINIC_X + x0, ROOM.y, x1 - x0, ROOM.wallH + ROOM.floorH, 0xdff4ff, 0)
        .setOrigin(0)
        .setDepth(4900);
      sc.tweens.add({
        targets: flash,
        fillAlpha: 0.55,
        yoyo: true,
        repeat: 1,
        duration: 140,
        delay: 600,
        onComplete: () => flash.destroy(),
      });
    } else if (room === 'lab') {
      for (let i = 0; i < 10; i++) {
        const b = sc.add
          .circle(CLINIC_X + 100 + Phaser.Math.Between(0, 10), FLOOR_TOP + 48, 1, 0xbfe8ff)
          .setDepth(4900);
        sc.tweens.add({
          targets: b,
          y: b.y - Phaser.Math.Between(8, 16),
          alpha: 0,
          delay: i * 250,
          duration: 900,
          onComplete: () => b.destroy(),
        });
      }
    } else if (this.cone) {
      sc.tweens.add({ targets: this.cone, alpha: 0.6, yoyo: true, hold: 5000, duration: 400 });
    }
  }

  /** Neviditeľná plocha nad prístrojom – ťuknutie otvorí výber pacienta. */
  private makeHotspot(room: ClinicRoomId): void {
    const [x, y, w, h] = HOTSPOTS[room];
    const zone = this.scene.add.zone(x, y, w, h).setOrigin(0).setDepth(4400);
    zone.setInteractive({ useHandCursor: true });
    // ťuknutie, nie posun obrazovky prstom
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.isTap(p) && this.state.hasClinicRoom(room)) this.onTap(room);
    });
  }

  /**
   * Ťuknutie do sveta: začalo aj skončilo na plátne a prst sa takmer nepohol.
   * (Phaser počúva pustenie aj nad HTML oknom – bez kontroly by ťuknutie na tlačidlo
   * v okne nad prístrojom okno hneď znova otvorilo.)
   */
  private isTap(p: Phaser.Input.Pointer): boolean {
    const canvas = this.scene.game.canvas;
    return p.downElement === canvas && p.upElement === canvas && p.getDistance() < 12 * DPR;
  }

  /** Svetielka na prístrojoch blikajú. */
  private blink(): void {
    for (const led of this.leds) {
      if (!this.state.hasClinicRoom(led.room)) continue;
      led.g.setFillStyle(Phaser.Utils.Array.GetRandom(led.colors));
    }
  }

  /** Bod na monitoroch nad operačným stolom beží dookola. */
  private animate(dt: number): void {
    if (!this.beat) return;
    this.beatX = (this.beatX + dt * 0.02) % 26;
    const g = this.beat;
    g.clear();
    for (let i = 0; i < 3; i++) {
      const x = CLINIC_X + 348 + i * 31 + this.beatX;
      g.fillStyle(0xb8ffb8, 1).fillRect(x, ROOM.y + 40, 2, 2);
    }
  }

  private led(room: ClinicRoomId, x: number, y: number, colors: number[]): void {
    const g = this.scene.add
      .rectangle(CLINIC_X + x, y, 2, 2, colors[0])
      .setOrigin(0)
      .setDepth(4300);
    this.leds.push({ room, g, colors });
  }

  /** Vybavenie kúpenej miestnosti, alebo plachta, ak ešte nie je kúpená. */
  private showRoom(room: ClinicRoomId, animate: boolean): void {
    if (!this.state.hasClinicRoom(room)) {
      if (!this.tarps.has(room)) this.tarps.set(room, this.makeTarp(room));
      return;
    }
    if (this.shown.has(room)) return;
    this.shown.add(room);
    const tarp = this.tarps.get(room);
    if (tarp) {
      this.tarps.delete(room);
      if (animate)
        this.scene.tweens.add({
          targets: tarp,
          alpha: 0,
          y: tarp.y - 20,
          duration: 500,
          onComplete: () => tarp.destroy(),
        });
      else tarp.destroy();
    }
    const imgs =
      room === 'lab' ? this.placeLab() : room === 'xray' ? this.placeXray() : this.placeOr();
    if (animate)
      for (const img of imgs) {
        const sy = img.scaleY;
        img.setScale(img.scaleX, 0.2);
        this.scene.tweens.add({ targets: img, scaleY: sy, ease: 'Back.easeOut', duration: 450 });
      }
  }

  // ---------- Pozadie ----------

  private buildBackground(): void {
    const key = 'clinic-bg';
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
      ctx.fillRect(x, y, w, h);
    };
    const { x: RX, y: RY, w: RW, wallH: WH, floorH: FH } = ROOM;
    const FT = FLOOR_TOP;
    const [L1, L2] = WALLS as [number, number];

    px('#2b2533', 0, 0, WORLD_W, WORLD_H);
    // Laboratórium: biele kachličky na stene, svetlá dlažba
    px('#e8ecef', RX, RY, L1 - RX, WH);
    for (let y = RY; y < FT; y += 8) px('#d2d9de', RX, y, L1 - RX, 1);
    for (let x = RX; x < L1; x += 8) px('#d2d9de', x, RY, 1, WH);
    px('#cfd8de', RX, FT, L1 - RX, FH);
    for (let y = FT; y < FT + FH; y += 16) px('#b5c1c8', RX, y, L1 - RX, 1);
    for (let x = RX; x < L1; x += 16) px('#b5c1c8', x, FT, 1, FH);
    // Röntgen: modré steny a dlaždice
    for (let x = L1; x < L2; x += 32) {
      draw('wall_blue_top', x, RY);
      draw('wall_blue_bottom', x, RY + 32);
      for (let y = FT; y < FT + FH; y += 32) draw('floor_tile', x, y);
    }
    // Operačná sála: biela stena, zelená podlaha
    px('#e6e6e6', L2, RY, RX + RW - L2, WH);
    px('#b2d3e6', L2, FT - 6, RX + RW - L2, 6);
    px('#5db792', L2, FT, RX + RW - L2, FH);
    for (let y = FT; y < FT + FH; y += 16) px('#4fa382', L2, y, RX + RW - L2, 1);
    for (let x = L2; x < RX + RW; x += 16) px('#4fa382', x, FT, 1, FH);
    // Pás pod stenou
    px('rgba(30, 20, 40, 0.28)', RX, FT, RW, 4);
    // Priečky s dverami
    for (const wx of WALLS) {
      px('#5b4a5e', wx - 3, RY, 6, FT + 110 - RY);
      px('#5b4a5e', wx - 3, FT + 150, 6, FT + FH - (FT + 150));
      px('#7a6880', wx - 3, RY, 2, FT + 110 - RY);
    }
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(RX - 1, RY - 1, RW + 2, WH + FH + 2);
    canvas.refresh();
    this.scene.add.image(CLINIC_X, 0, key).setOrigin(0, 0).setDepth(-1000);
    // Priečky sú prekážky
    for (const wx of WALLS)
      this.geom.obstacles.push(
        new Phaser.Geom.Rectangle(CLINIC_X + wx - 4, FLOOR_TOP, 8, 108),
        new Phaser.Geom.Rectangle(CLINIC_X + wx - 4, FLOOR_TOP + 150, 8, 42),
      );
  }

  // ---------- Vybavenie miestností ----------

  private img(key: string, frame: string | undefined, x: number, bottom: number, footprint = 0) {
    const img = this.scene.add
      .image(CLINIC_X + x, bottom, key, frame)
      .setOrigin(0.5, 1)
      .setDepth(bottom);
    addProp(this.geom, CLINIC_X + x, bottom, img.width, img.height, footprint);
    return img;
  }

  /** Obrázok na stene (za všetkým, nad pozadím). */
  private wall(key: string, frame: string | undefined, x: number, top: number) {
    return this.scene.add
      .image(CLINIC_X + x, top, key, frame)
      .setOrigin(0.5, 0)
      .setDepth(-990);
  }

  private placeLab(): Phaser.GameObjects.Image[] {
    const FT = FLOOR_TOP;
    return [
      this.img('clinic', 'lockers', 36, FT + 24),
      this.img('clinic', 'sink', 70, FT + 6),
      this.img('clinic', 'cabinet_small', 150, FT + 24),
      this.img('clinic', 'desk_blue', 90, FT + 70, 10),
      this.img('cl-microscope', undefined, 83, FT + 57).setDepth(FT + 71),
      this.img('cl-tubes', undefined, 103, FT + 55).setDepth(FT + 71),
      this.img('clinic', 'pc', 112, FT + 50).setDepth(FT + 71),
      this.img('cl-centrifuge', undefined, 51, FT + 134, 8),
      this.img('interior', 'plant', 150, FT + 180, 8),
    ].map((img, i, all) => {
      if (i === all.length - 1) {
        this.led('lab', 50 + 17, FT + 131, [0x6ee08a, 0x2b6a3a]);
        this.led('lab', 112 - 6, FT + 36, [0x9ad0ff, 0x5a8ac0, 0xffffff]);
      }
      return img;
    });
  }

  private placeXray(): Phaser.GameObjects.Image[] {
    const FT = FLOOR_TOP;
    const RY = ROOM.y;
    return [
      this.wall('cl-lightbox', undefined, 210, RY + 14),
      this.wall('cl-warning', undefined, 256, RY + 29),
      this.wall('cl-apron', undefined, 295, RY + 30),
      this.img('cl-xray', undefined, 235, FT + 116, 12),
      this.img('cl-console', undefined, 195, FT + 172, 10),
    ].map((img, i, all) => {
      if (i === all.length - 1) {
        this.led('xray', 195 - 13 + 5, FT + 172 - 22 + 5, [0x6ee08a, 0x2b6a3a]);
        this.led('xray', 195 - 13 + 13, FT + 172 - 22 + 5, [0xe05a5a, 0x6a2a2a]);
      }
      return img;
    });
  }

  private placeOr(): Phaser.GameObjects.Image[] {
    const FT = FLOOR_TOP;
    const RY = ROOM.y;
    const tableY = FT + 130;
    const imgs = [
      this.wall('clinic', 'monitor_bank', 392, RY + 18),
      this.img('clinic', 'cabinet_med', 350, FT + 40),
      this.img('clinic', 'drawers', 446, FT + 30),
      this.img('clinic', 'iv_stand', 360, FT + 130, 8),
      this.img('clinic', 'curtain', 334, FT + 190),
      this.img('cl-ortable', undefined, 400, tableY, 10),
      // pelechy na zotavenie s infúziou
      ...RECOVERY.map((r) =>
        this.img('cl-recovery', undefined, r.x - CLINIC_X, r.y + 5).setDepth(r.y - 2),
      ),
    ];
    this.beat = this.scene.add.graphics().setDepth(-980);
    // Lampa nad stolom a jej svetlo (nad stolom, pod nocou)
    const lamp = this.scene.add
      .image(CLINIC_X + 400, ROOM.y + ROOM.wallH - 4, 'cl-orlamp')
      .setOrigin(0.5, 0)
      .setDepth(tableY + 2);
    const cone = this.scene.add
      .image(CLINIC_X + 400, FT + 26, 'cl-orlight')
      .setOrigin(0.5, 0)
      .setDepth(tableY + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35);
    this.cone = cone;
    return [...imgs, lamp, cone];
  }

  /** Plachta cez nekúpenú miestnosť – ťuknutím sa otvorí obchod. */
  private makeTarp(room: ClinicRoomId): Phaser.GameObjects.Container {
    const [x0, x1] = SECTIONS[room];
    const w = x1 - x0 - 6;
    const h = ROOM.wallH + ROOM.floorH;
    const g = this.scene.add.graphics();
    g.fillStyle(0x2b2533, 0.55).fillRect(0, 0, w, h);
    g.fillStyle(0xd9d2c4, 0.92).fillRect(4, 10, w - 8, h - 14);
    g.fillStyle(0xbfb6a6, 1);
    for (let x = 14; x < w - 8; x += 18) g.fillRect(x, 10, 3, h - 14); // záhyby
    g.fillStyle(0x8a7d6a, 1).fillRect(2, 6, w - 4, 5); // tyč
    // značka so zámkom
    const cx = w / 2;
    const cy = h / 2;
    g.fillStyle(0x3b2f45, 1).fillRoundedRect(cx - 22, cy - 22, 44, 44, 6);
    g.fillStyle(0xf2c14e, 1).fillRoundedRect(cx - 9, cy - 4, 18, 14, 2);
    g.lineStyle(3, 0xf2c14e, 1).strokeCircle(cx, cy - 6, 6);
    g.fillStyle(0x3b2f45, 1).fillRect(cx - 1, cy + 1, 2, 5);
    const c = this.scene.add.container(CLINIC_X + x0 + 3, ROOM.y, [g]).setDepth(4500);
    c.setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(w / 2, h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.isTap(p)) this.onTap(room);
    });
    return c;
  }

  // ---------- Výrezy a textúry ----------

  private registerFrames(): void {
    const tex = this.scene.textures.get('clinic');
    for (const [name, [x, y, w, h]] of Object.entries(CLINIC_FRAMES)) {
      if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
    }
  }

  /** Vybavenie, ktoré v balíku nie je – nakreslené kódom vo farbách kliniky. */
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
    // Mikroskop
    make('cl-microscope', 10, 15, (px) => {
      px(OUT, 0, 12, 10, 3);
      px(OUT, 6, 2, 3, 11);
      px('#6a5a78', 2, 0, 8, 4);
      px(OUT, 3, 6, 4, 2);
      px('#9ad0ff', 3, 8, 3, 1);
    });
    // Stojan so skúmavkami
    make('cl-tubes', 18, 11, (px) => {
      ['#e05a5a', '#f2c14e', '#5ab0e0', '#e05a5a'].forEach((c, i) => {
        px('#f4f4f4', 2 + i * 4, 0, 3, 8);
        px(c, 2 + i * 4, 4, 3, 4);
      });
      px('#8a6a4a', 0, 7, 18, 4);
    });
    // Centrifúga
    make('cl-centrifuge', 22, 14, (px) => {
      px(OUT, 0, 0, 22, 14);
      px('#c9d3da', 1, 1, 20, 12);
      px('#7a8a95', 5, 3, 12, 6);
      px('#6ee08a', 17, 11, 2, 2);
    });
    // Svetelný panel s röntgenovou snímkou mačky
    make('cl-lightbox', 40, 28, (px) => {
      const sk = '#dfe8f2';
      px('#1d1824', 0, 0, 40, 28);
      px('#30405a', 2, 2, 36, 24);
      px(sk, 27, 6, 6, 1);
      px(sk, 26, 7, 1, 5);
      px(sk, 33, 7, 1, 5);
      px(sk, 27, 12, 6, 1);
      px(sk, 27, 4, 2, 2);
      px(sk, 31, 4, 2, 2);
      px(sk, 8, 12, 18, 1);
      for (let i = 0; i < 4; i++) px(sk, 13 + i * 3, 13, 1, 4);
      px(sk, 10, 13, 1, 8);
      px(sk, 23, 13, 1, 8);
      px(sk, 3, 8, 5, 1);
      px(sk, 3, 8, 1, 4);
    });
    // Výstražná značka žiarenia
    make('cl-warning', 13, 12, (px) => {
      for (let y = 0; y < 12; y++) {
        const half = Math.floor(y / 2);
        px(OUT, 6 - half, y, half * 2 + 1, 1);
        if (y > 1 && y < 11) px('#f2c14e', 7 - half, y, Math.max(0, half * 2 - 1), 1);
      }
      px(OUT, 6, 4, 1, 4);
      px(OUT, 6, 9, 1, 1);
    });
    // Olovená zástera na vešiaku
    make('cl-apron', 10, 22, (px) => {
      px(OUT, 0, 0, 10, 2);
      px('#5a6aa0', 1, 2, 8, 18);
      px('#46558a', 1, 16, 8, 4);
      px('#7a8ac0', 2, 3, 2, 10);
    });
    // Röntgenový stôl so stĺpom a lampou
    make('cl-xray', 82, 86, (px) => {
      // stôl
      px(OUT, 0, 66, 70, 8);
      px('#e8ecef', 1, 67, 68, 5);
      px('#b8c4ca', 1, 71, 68, 2);
      px(OUT, 6, 74, 6, 12);
      px(OUT, 56, 74, 6, 12);
      // stĺp a rameno
      px(OUT, 74, 0, 8, 86);
      px('#c9d3da', 75, 1, 6, 84);
      px(OUT, 30, 6, 46, 6);
      px('#c9d3da', 31, 7, 44, 4);
      // hlavica
      px(OUT, 24, 10, 18, 14);
      px('#e8ecef', 25, 11, 16, 10);
      px('#f2c14e', 31, 22, 4, 2);
    });
    // Ovládací pult röntgenu
    make('cl-console', 26, 22, (px) => {
      px(OUT, 0, 0, 26, 22);
      px('#5a6aa0', 1, 1, 24, 20);
      px('#6ee08a', 5, 5, 4, 3);
      px('#e05a5a', 13, 5, 4, 3);
      px('#1d1824', 4, 12, 18, 6);
    });
    // Pelech na zotavenie (nízky, s dekou)
    make('cl-recovery', 26, 10, (px) => {
      px(OUT, 0, 2, 26, 8);
      px('#e8ecef', 1, 3, 24, 4);
      px('#8fb8d0', 1, 6, 24, 3);
      px('#c9e8ff', 2, 3, 6, 2);
    });
    // Operačný stôl
    make('cl-ortable', 52, 24, (px) => {
      px(OUT, 0, 0, 52, 8);
      px('#c9e8ff', 1, 1, 50, 5);
      px('#8fb8d0', 1, 5, 50, 2);
      px(OUT, 22, 8, 8, 12);
      px(OUT, 12, 20, 28, 4);
    });
    // Operačná lampa na ramene zo stropu
    make('cl-orlamp', 32, 34, (px) => {
      px('#c9d3da', 15, 0, 2, 22);
      px(OUT, 2, 20, 28, 14);
      px(OUT, 0, 23, 32, 8);
      px('#fff6c8', 3, 23, 26, 9);
      px('#ffffff', 8, 25, 16, 4);
    });
    // Kužeľ svetla lampy (priehľadný)
    if (!this.scene.textures.exists('cl-orlight')) {
      const tex = this.scene.textures.createCanvas('cl-orlight', 56, 80);
      if (tex) {
        const ctx = tex.getContext();
        const g = ctx.createLinearGradient(0, 0, 0, 80);
        g.addColorStop(0, 'rgba(255, 246, 200, 0.55)');
        g.addColorStop(1, 'rgba(255, 246, 200, 0.12)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(42, 0);
        ctx.lineTo(56, 80);
        ctx.lineTo(0, 80);
        ctx.closePath();
        ctx.fill();
        tex.refresh();
      }
    }
  }
}
