import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { ClinicRoomId } from '../data/types';
import type { ClinicStation } from './ClinicRoom';
import { DPR } from './dpr';
import { CLINIC2_X, FLOOR_TOP, ROOM, WORLD_H, WORLD_W } from './layout';
import { addProp, type WorldGeom } from './world';

/** Miestnosti na 2. poschodí kliniky. */
export type Floor2Room = Extract<ClinicRoomId, 'ct' | 'pool'>;

const WALL_X = 214;
const SECTIONS: Record<Floor2Room, [number, number]> = {
  ct: [ROOM.x, WALL_X],
  pool: [WALL_X, ROOM.x + ROOM.w],
};
const FT0 = FLOOR_TOP;
/** Bazén (x v súradniciach budovy). */
const POOL = { x: 262, y: FT0 + 56, w: 180, h: 92 };
const STATIONS: Record<Floor2Room, ClinicStation> = {
  ct: { x: CLINIC2_X + 148, y: FT0 + 82, lay: true, dir: 'left', depthBoost: 40 },
  pool: {
    x: CLINIC2_X + POOL.x + POOL.w / 2,
    y: POOL.y + 50,
    lay: true,
    dir: 'right',
    depthBoost: 8,
  },
};
const HOTSPOTS: Record<Floor2Room, [number, number, number, number]> = {
  ct: [CLINIC2_X + 50, FT0 + 30, 130, 90],
  pool: [CLINIC2_X + POOL.x - 6, POOL.y - 6, POOL.w + 12, POOL.h + 12],
};

/**
 * Klinika – 2. poschodie (GDD §6.8): CT a rehabilitačný bazén. Nekúpené miestnosti zakrýva
 * plachta. Prístroje sú ťuknuteľné ako na prízemí. Iba zobrazenie.
 */
export class Clinic2Room {
  readonly lamps: [number, number, number][] = [
    [CLINIC2_X + 110, FLOOR_TOP + 90, 46],
    [CLINIC2_X + 350, FLOOR_TOP + 100, 60],
  ];
  private readonly shown = new Set<Floor2Room>();
  private readonly tarps = new Map<Floor2Room, Phaser.GameObjects.Container>();
  private water: Phaser.GameObjects.Graphics | null = null;
  private ring: Phaser.GameObjects.Rectangle | null = null;
  private t = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly geom: WorldGeom,
    private readonly onTap: (room: Floor2Room) => void,
  ) {
    this.makeTextures();
    this.buildBackground();
    for (const room of Object.keys(SECTIONS) as Floor2Room[]) this.showRoom(room, false);
    state.bus.on('clinicRoomBought', ({ room }) => {
      if (room in SECTIONS) this.showRoom(room as Floor2Room, true);
    });
    for (const room of Object.keys(HOTSPOTS) as Floor2Room[]) this.makeHotspot(room);
    scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => this.animate(dt));
  }

  station(room: Floor2Room): ClinicStation {
    return STATIONS[room];
  }

  /** CT: svetelný pás prejde po mačke; bazén: špliechance. */
  effect(room: Floor2Room): void {
    const sc = this.scene;
    if (room === 'ct') {
      const beam = sc.add
        .rectangle(CLINIC2_X + 100, FT0 + 92, 3, 22, 0x9ad0ff, 0.8)
        .setDepth(FT0 + 200)
        .setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({
        targets: beam,
        x: CLINIC2_X + 160,
        yoyo: true,
        repeat: 2,
        duration: 900,
        onComplete: () => beam.destroy(),
      });
      return;
    }
    const st = STATIONS.pool;
    for (let i = 0; i < 14; i++) {
      const d = sc.add.circle(st.x, st.y - 4, 1, 0xdff4ff).setDepth(st.y + 30);
      const a = Math.random() * Math.PI * 2;
      sc.tweens.add({
        targets: d,
        x: st.x + Math.cos(a) * Phaser.Math.Between(6, 16),
        y: st.y - 4 + Math.sin(a) * 6 - 8,
        alpha: 0,
        delay: i * 120,
        duration: 600,
        onComplete: () => d.destroy(),
      });
    }
  }

  private isTap(p: Phaser.Input.Pointer): boolean {
    const canvas = this.scene.game.canvas;
    return p.downElement === canvas && p.upElement === canvas && p.getDistance() < 12 * DPR;
  }

  private makeHotspot(room: Floor2Room): void {
    const [x, y, w, h] = HOTSPOTS[room];
    const zone = this.scene.add.zone(x, y, w, h).setOrigin(0).setDepth(4400);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.isTap(p) && this.state.hasClinicRoom(room)) this.onTap(room);
    });
  }

  /** Vlnky na vode a blikajúce svetlo CT. */
  private animate(dt: number): void {
    this.t += dt;
    if (this.water) {
      const g = this.water;
      g.clear();
      for (let row = 0; row < 5; row++) {
        const y = POOL.y + 12 + row * 17;
        for (let k = 0; k < 6; k++) {
          const x =
            CLINIC2_X +
            POOL.x +
            8 +
            ((((k * 31 + this.t * 0.012 * (row % 2 ? 1 : -1)) % (POOL.w - 24)) + POOL.w - 24) %
              (POOL.w - 24));
          g.fillStyle(0xbfe8ff, 0.7).fillRect(
            x,
            y + Math.round(Math.sin(this.t / 500 + k) * 1),
            8,
            1,
          );
        }
      }
    }
    if (this.ring) this.ring.setFillStyle(Math.floor(this.t / 500) % 2 ? 0x6ec8ff : 0x2a6a9a);
  }

  private showRoom(room: Floor2Room, animate: boolean): void {
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
    if (room === 'ct') this.placeCt();
    else this.placePool();
  }

  // ---------- Pozadie ----------

  private buildBackground(): void {
    const key = 'clinic2-bg';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const canvas = this.scene.textures.createCanvas(key, WORLD_W, WORLD_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const px = (c: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const { x: RX, y: RY, w: RW, wallH: WH, floorH: FH } = ROOM;
    const FT = FLOOR_TOP;
    px('#2b2533', 0, 0, WORLD_W, WORLD_H);
    // CT: svetlomodrá stena, sivá dlažba
    px('#d6e4ee', RX, RY, WALL_X - RX, WH);
    px('#b9cfdd', RX, FT - 18, WALL_X - RX, 18);
    px('#c9d3da', RX, FT, WALL_X - RX, FH);
    for (let y = FT; y < FT + FH; y += 16) px('#b0bcc4', RX, y, WALL_X - RX, 1);
    for (let x = RX; x < WALL_X; x += 16) px('#b0bcc4', x, FT, 1, FH);
    // Bazén: tyrkysové kachličky na stene, biela dlažba
    px('#9fd8d8', WALL_X, RY, RX + RW - WALL_X, WH);
    for (let y = RY; y < FT; y += 8) px('#88c4c4', WALL_X, y, RX + RW - WALL_X, 1);
    for (let x = WALL_X; x < RX + RW; x += 8) px('#88c4c4', x, RY, 1, WH);
    px('#eef3f5', WALL_X, FT, RX + RW - WALL_X, FH);
    for (let y = FT; y < FT + FH; y += 12) px('#d6dfe3', WALL_X, y, RX + RW - WALL_X, 1);
    for (let x = WALL_X; x < RX + RW; x += 12) px('#d6dfe3', x, FT, 1, FH);
    px('rgba(30, 20, 40, 0.28)', RX, FT, RW, 4);
    // Priečka s dverami
    px('#5b4a5e', WALL_X - 3, RY, 6, FT + 110 - RY);
    px('#5b4a5e', WALL_X - 3, FT + 150, 6, FT + FH - (FT + 150));
    // Schody na prízemie (vľavo) a tabuľka „2"
    for (let i = 0; i < 6; i++)
      px(i % 2 ? '#8a6a8e' : '#a88aac', RX, FT + 120 + i * 10, 34 - i * 4, 10);
    px('#5b4a5e', RX + 34, FT + 116, 2, 64);
    px('#3b2f45', RX + 6, RY + 10, 18, 18);
    px('#f2c14e', RX + 8, RY + 12, 14, 14);
    ctx.fillStyle = '#3b2f45';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('2', RX + 11, RY + 24);
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(RX - 1, RY - 1, RW + 2, WH + FH + 2);
    canvas.refresh();
    this.scene.add.image(CLINIC2_X, 0, key).setOrigin(0, 0).setDepth(-1000);
    this.geom.obstacles.push(new Phaser.Geom.Rectangle(CLINIC2_X + WALL_X - 4, FT, 8, FH));
  }

  private img(key: string, x: number, bottom: number, footprint = 0) {
    const img = this.scene.add
      .image(CLINIC2_X + x, bottom, key)
      .setOrigin(0.5, 1)
      .setDepth(bottom);
    addProp(this.geom, CLINIC2_X + x, bottom, img.width, img.height, footprint);
    return img;
  }

  private placeCt(): void {
    const FT = FLOOR_TOP;
    this.img('c2-ct', 112, FT + 112, 14);
    // svetelný pás na prstenci CT
    this.ring = this.scene.add
      .rectangle(CLINIC2_X + 112 - 10, FT + 112 - 52, 3, 3, 0x6ec8ff)
      .setOrigin(0)
      .setDepth(FT + 113);
    this.scene.add
      .image(CLINIC2_X + 150, ROOM.y + 12, 'c2-window')
      .setOrigin(0.5, 0)
      .setDepth(-990);
    this.img('c2-console', 180, FT + 172, 10);
  }

  private placePool(): void {
    const FT = FLOOR_TOP;
    this.scene.add
      .image(CLINIC2_X + POOL.x, POOL.y, 'c2-pool')
      .setOrigin(0, 0)
      .setDepth(-970);
    this.water = this.scene.add.graphics().setDepth(-960);
    this.scene.add
      .image(CLINIC2_X + POOL.x + POOL.w - 10, POOL.y - 2, 'c2-ladder')
      .setOrigin(0.5, 0)
      .setDepth(POOL.y + 10);
    this.scene.add
      .image(CLINIC2_X + 300, ROOM.y + 16, 'c2-buoy')
      .setOrigin(0.5, 0)
      .setDepth(-990);
    this.img('c2-towels', 244, FT + 40, 6);
    this.img('c2-bench', 360, FT + 178, 8);
    // pre mačky v bazéne: nedá sa po vode chodiť
    this.geom.obstacles.push(new Phaser.Geom.Rectangle(CLINIC2_X + POOL.x, POOL.y, POOL.w, POOL.h));
  }

  private makeTarp(room: Floor2Room): Phaser.GameObjects.Container {
    const [x0, x1] = SECTIONS[room];
    const w = x1 - x0 - 6;
    const h = ROOM.wallH + ROOM.floorH;
    const g = this.scene.add.graphics();
    g.fillStyle(0x2b2533, 0.55).fillRect(0, 0, w, h);
    g.fillStyle(0xd9d2c4, 0.92).fillRect(4, 10, w - 8, h - 14);
    g.fillStyle(0xbfb6a6, 1);
    for (let x = 14; x < w - 8; x += 18) g.fillRect(x, 10, 3, h - 14);
    g.fillStyle(0x8a7d6a, 1).fillRect(2, 6, w - 4, 5);
    const cx = w / 2;
    const cy = h / 2;
    g.fillStyle(0x3b2f45, 1).fillRoundedRect(cx - 22, cy - 22, 44, 44, 6);
    g.fillStyle(0xf2c14e, 1).fillRoundedRect(cx - 9, cy - 4, 18, 14, 2);
    g.lineStyle(3, 0xf2c14e, 1).strokeCircle(cx, cy - 6, 6);
    const c = this.scene.add.container(CLINIC2_X + x0 + 3, ROOM.y, [g]).setDepth(4500);
    c.setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(w / 2, h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.isTap(p)) this.onTap(room);
    });
    return c;
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
    // CT: veľký prstenec a stôl, ktorý ním prechádza
    make('c2-ct', 110, 64, (px) => {
      // stôl
      px(OUT, 20, 30, 90, 8);
      px('#e8ecef', 21, 31, 88, 5);
      px('#b8c4ca', 21, 35, 88, 2);
      px(OUT, 70, 38, 22, 26);
      px('#c9d3da', 72, 38, 18, 24);
      // prstenec
      px(OUT, 0, 0, 46, 64);
      px('#f2f5f7', 2, 2, 42, 60);
      px('#d6dfe3', 2, 50, 42, 12);
      px(OUT, 12, 14, 22, 30);
      px('#4a5a6a', 14, 16, 18, 26);
      px('#2a3a4a', 16, 18, 14, 22);
      px('#e8ecef', 12, 30, 34, 6); // stôl vchádza do prstenca
      px('#6ec8ff', 6, 6, 34, 2);
    });
    // Okno do riadiacej miestnosti so snímkou
    make('c2-window', 52, 30, (px) => {
      px(OUT, 0, 0, 52, 30);
      px('#b0d8f0', 2, 2, 48, 26);
      px('#1d1824', 6, 6, 18, 14);
      px('#dfe8f2', 9, 9, 12, 8);
      px('#1d1824', 12, 11, 6, 4);
      px('#1d1824', 28, 6, 18, 14);
      px('#6ee08a', 30, 12, 14, 1);
      px('#6ee08a', 34, 9, 1, 6);
    });
    make('c2-console', 30, 20, (px) => {
      px(OUT, 0, 0, 30, 20);
      px('#5a6aa0', 1, 1, 28, 18);
      px('#1d1824', 4, 4, 14, 8);
      px('#6ec8ff', 6, 6, 10, 1);
      px('#6ee08a', 22, 5, 3, 3);
      px('#e05a5a', 22, 11, 3, 3);
    });
    // Bazén s okrajom a vodou
    make('c2-pool', POOL.w, POOL.h, (px) => {
      px('#8a94a0', 0, 0, POOL.w, POOL.h);
      px('#c9d3da', 2, 2, POOL.w - 4, POOL.h - 4);
      px('#3a8ad0', 6, 6, POOL.w - 12, POOL.h - 12);
      px('#4aa0e0', 6, 6, POOL.w - 12, 10);
      px('#2a70b0', 6, POOL.h - 18, POOL.w - 12, 12);
      // rampa pre mačky (vľavo)
      px('#c9d3da', 6, POOL.h / 2 - 8, 26, 16);
      px('#aab4bc', 6, POOL.h / 2 + 4, 26, 4);
    });
    make('c2-ladder', 10, 26, (px) => {
      px('#c9d3da', 0, 0, 2, 26);
      px('#c9d3da', 8, 0, 2, 26);
      for (let y = 4; y < 26; y += 6) px('#e8ecef', 0, y, 10, 2);
    });
    make('c2-buoy', 18, 18, (px) => {
      px('#e05a5a', 3, 0, 12, 18);
      px('#e05a5a', 0, 3, 18, 12);
      px('#ffffff', 3, 3, 12, 12);
      px('#9fd8d8', 6, 6, 6, 6);
      px('#ffffff', 0, 7, 3, 4);
      px('#ffffff', 15, 7, 3, 4);
    });
    make('c2-towels', 22, 30, (px) => {
      px(OUT, 0, 0, 22, 30);
      px('#a87446', 1, 1, 20, 28);
      ['#f2c14e', '#e88aa8', '#7ec8ee', '#9ad17b'].forEach((c, i) => px(c, 3, 3 + i * 6, 16, 5));
    });
    make('c2-bench', 40, 12, (px) => {
      px(OUT, 0, 0, 40, 6);
      px('#c9935f', 1, 1, 38, 4);
      px(OUT, 4, 6, 3, 6);
      px(OUT, 33, 6, 3, 6);
    });
  }
}
