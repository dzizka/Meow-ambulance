import Phaser from 'phaser';
import { MUSIC_DAY, MUSIC_NIGHT } from '../assets';
import type { GameState } from '../core/GameState';
import { SaveManager, browserStorage } from '../core/SaveManager';
import type { OfflineSummary } from '../core/EventBus';
import * as Care from '../core/systems/Care';
import type { Stars } from '../core/systems/Care';
import type { CatData } from '../data/types';
import { CLINIC_FRAMES, INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { CatSprite, type CatWorld } from '../objects/CatSprite';
import { UI, type GameBridge, type MinigameRequest } from '../ui/UI';
import type { MinigameInit } from './MinigameScene';
import {
  FLOOR_TOP,
  ROOM,
  WORLD_H,
  WORLD_W,
  computeLayout,
  roomAt,
  roomX,
  type Room,
} from './layout';
import { CAFE_AREA, CafeRoom } from './CafeRoom';
import { Furnishings } from './Furnishings';
import { QUARANTINE_AREA, QUARANTINE_CAGES, ShelterRoom } from './ShelterRoom';
import { addProp, type WorldGeom } from './world';
import type { CafeGuest } from '../data/types';
import { DPR } from './dpr';

/** Miesta pre klietky – prvé dve od začiatku, ďalšie sa dokupujú (GDD §6.1). */
const CAGES = [
  { x: 348, y: FLOOR_TOP + 38 },
  { x: 398, y: FLOOR_TOP + 38 },
  { x: 298, y: FLOOR_TOP + 38 },
  { x: 248, y: FLOOR_TOP + 38 },
];
/** Kde sa pohybujú pacienti a kde stálice (kútik pri gauči). */
const PATIENT_AREA = new Phaser.Geom.Rectangle(70, FLOOR_TOP + 58, 210, 112);
const RESIDENT_AREA = new Phaser.Geom.Rectangle(300, FLOOR_TOP + 60, 140, 112);
const EXIT = { x: ROOM.x + 6, y: FLOOR_TOP + 176 };
const AUTOSAVE_MS = 15_000;

/** Farba „svetla" podľa dennej doby (GDD §2.2 – hodiny sú iba atmosféra). */
const PHASE_TINT = {
  night: { color: 0x14102a, alpha: 0.45 },
  morning: { color: 0xffc98a, alpha: 0.08 },
  day: { color: 0x000000, alpha: 0 },
  evening: { color: 0x6a3a2a, alpha: 0.2 },
} as const;

type Sheet = 'interior' | 'clinic';
const rect = (sheet: Sheet, name: string): FrameRect =>
  (sheet === 'interior'
    ? INTERIOR_FRAMES[name as keyof typeof INTERIOR_FRAMES]
    : CLINIC_FRAMES[name as keyof typeof CLINIC_FRAMES]) as FrameRect;

/**
 * Fáza 1 – Garážová záchranka (GDD §6.2) v otvorenom režime.
 * Zobrazuje stav z GameState, ukladá hru a spúšťa minihry pre HTML rozhranie.
 */
export class GarageScene extends Phaser.Scene implements GameBridge {
  state!: GameState;
  private saves = new SaveManager(browserStorage);
  private sprites = new Map<string, CatSprite>();
  private selected: CatSprite | null = null;
  private zuzka!: Phaser.GameObjects.Sprite;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private lampGlows: Phaser.GameObjects.Image[] = [];
  private phase: keyof typeof PHASE_TINT | null = null;
  private music?: Phaser.Sound.BaseSound;
  private trackKey = '';
  private sinceSave = 0;
  private cagesDrawn = 0;
  /** Pôdorysy nábytku – mačky ich obchádzajú. */
  readonly geom: WorldGeom = { obstacles: [], hideZones: [] };
  /** Čo vidia mačky: nábytok, ostatné mačky a hostia v kaviarni. */
  private readonly catWorld: CatWorld = {
    obstacles: this.geom.obstacles,
    hideZones: this.geom.hideZones,
    cats: () => this.sprites.values(),
    guestSpot: (c) =>
      this.cafe && c.cat.resident && roomAt(c.x) === 'cafe' ? this.cafe.guestSpotFor(c) : null,
    onVisit: (c) => this.cafe?.heartsAt(c.x, c.y - 22),
  };
  /** Po „Nová hra" sa už nesmie uložiť (inak by sa stará hra zapísala späť). */
  private noSave = false;
  private sinceSparkle = 0;
  /** Miestnosť, ktorú práve vidí kamera. */
  room: Room = 'garage';
  /** Rýchlosť herného času – iba vývojárske menu. */
  speed = 1;
  private cafe: CafeRoom | null = null;
  private shelterRoom: ShelterRoom | null = null;
  private ui!: UI;

  constructor() {
    super('Garage');
  }

  create(): void {
    this.state = this.registry.get('state') as GameState;
    const offline = this.registry.get('offline') as OfflineSummary | null;

    this.registerFrames();
    this.buildBackground();
    this.placeFurniture();
    this.drawCages(false);
    this.createZuzka();
    this.createLighting();
    this.makeSparkTexture();
    if (this.state.cafe.open) this.openCafeRoom();
    if (this.state.shelter.open) this.openShelterRoom();
    new Furnishings(this, this.state, this.geom);

    this.state.cats.forEach((cat, i) => {
      const area = this.areaFor(cat);
      this.spawnCat(cat, area.x + 30 + (i % 8) * 40, area.centerY);
    });
    this.listen();

    this.enableDragPan();
    this.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (over.length === 0 && !this.isOutsideWorld(p)) this.select(null);
      },
    );
    this.scale.on('resize', this.applyLayout, this);
    this.applyLayout();

    // Prehliadače dovolia zvuk až po prvom dotyku
    document.addEventListener('pointerdown', () => this.startMusic(), { once: true });
    this.loadMoreMusic();
    const saveNow = () => this.save();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('pagehide', saveNow);

    this.ui = new UI(this.state, this);
    if (offline) this.state.bus.emit('welcomeBack', { summary: offline });
    this.saves.save(this.state);
  }

  override update(_time: number, delta: number): void {
    // Po dlhšom uspaní karty prehliadača sa čas dopočíta ako offline (beží iba to dobré)
    if (delta > 5000) this.state.applyOffline(delta);
    else this.state.tick(delta * this.speed);

    this.sinceSave += delta;
    if (this.sinceSave > AUTOSAVE_MS) {
      this.sinceSave = 0;
      this.save();
    }
    this.sinceSparkle += delta;
    if (this.sinceSparkle > 1400) {
      this.sinceSparkle = 0;
      for (const sprite of this.sprites.values()) {
        if (!sprite.cat.resident && this.state.isReady(sprite.cat)) this.sparkle(sprite);
      }
    }
    this.updateLighting();
  }

  // ---------- GameBridge pre HTML rozhranie ----------

  select(catId: string | null): void {
    const sprite = catId ? (this.sprites.get(catId) ?? null) : null;
    if (sprite) {
      const room: Room = roomAt(sprite.x);
      if (room !== this.room) this.showRoom(room, false);
    }
    this.selected?.setSelected(false);
    this.selected = sprite;
    sprite?.setSelected(true);
    if (sprite)
      this.cameras.main.pan(sprite.x, this.cameras.main.midPoint.y, 300, 'Sine.easeInOut');
    this.state.bus.emit('catSelected', { catId: sprite?.cat.id ?? null });
  }

  runMinigame(req: MinigameRequest): Promise<Stars | null> {
    return new Promise((resolve) => {
      const init: MinigameInit = { ...req, done: resolve };
      this.scene.launch('Minigame', init);
      this.scene.bringToTop('Minigame');
    });
  }

  playSound(key: string, volume = 0.6, fallback?: string): void {
    if (this.cache.audio.exists(key)) this.sound.play(key, { volume });
    else if (fallback && this.cache.audio.exists(fallback)) this.sound.play(fallback, { volume });
  }

  /** Prepne kameru do inej miestnosti (garáž / kaviareň) s krátkym prelínaním. */
  showRoom(room: Room, fade = true): void {
    if (
      room === this.room ||
      (room === 'cafe' && !this.cafe) ||
      (room === 'shelter' && !this.shelterRoom)
    )
      return;
    const cam = this.cameras.main;
    const apply = () => {
      this.room = room;
      this.applyLayout();
      this.ui.setRoom(room);
    };
    if (!fade) {
      apply();
      return;
    }
    cam.fadeOut(150, 43, 37, 51);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      apply();
      cam.fadeIn(200, 43, 37, 51);
    });
  }

  /** Kde žije mačka: pacienti v garáži, stálice v kútiku alebo v kaviarni. */
  private areaFor(cat: CatData): Phaser.Geom.Rectangle {
    if (!cat.resident)
      return cat.ward === 'quarantine' && this.shelterRoom ? QUARANTINE_AREA : PATIENT_AREA;
    return this.cafe ? CAFE_AREA : RESIDENT_AREA;
  }

  /** Komunitný útulok – tretia budova (GDD §6.2). */
  private openShelterRoom(): void {
    if (this.shelterRoom) return;
    this.shelterRoom = new ShelterRoom(this, this.geom);
    for (const [x, y, r] of this.shelterRoom.lamps) this.addGlow(x, y, r);
  }

  /** Pacient sa presunie do garáže alebo do karantény (podľa `cat.ward`). */
  private moveToWard(sprite: CatSprite): void {
    const area = this.areaFor(sprite.cat);
    const x = Phaser.Math.Between(area.left + 20, area.right - 20);
    const y = Phaser.Math.Between(area.top + 10, area.bottom - 10);
    sprite.teleport(x, y, area);
  }

  private openCafeRoom(): void {
    if (this.cafe) return;
    this.cafe = new CafeRoom(
      this,
      this.state,
      this.geom,
      (id) => this.sprites.get(id),
      (guest) => this.serveGuest(guest),
    );
    for (const [x, y, r] of this.cafe.lamps) this.addGlow(x, y, r);
  }

  private serveGuest(guest: CafeGuest): void {
    if (this.state.serveGuest(guest.id)) this.save();
  }

  /** Stálica sa presťahuje do kaviarne. */
  private moveToCafe(sprite: CatSprite): void {
    const x = Phaser.Math.Between(CAFE_AREA.left + 20, CAFE_AREA.right - 20);
    const y = Phaser.Math.Between(CAFE_AREA.top + 10, CAFE_AREA.bottom - 10);
    sprite.teleport(x, y, CAFE_AREA);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  saveNow(): void {
    this.save();
  }

  setMuted(muted: boolean): void {
    this.sound.mute = muted;
  }

  resetGame(): void {
    this.noSave = true;
    this.saves.clear();
    location.reload();
  }

  private save(): void {
    if (!this.noSave) this.saves.save(this.state);
  }

  /** Nakreslí klietky podľa počtu v stave; nové sa objavia s malou animáciou. */
  private drawCages(animate: boolean): void {
    const want = Math.min(CAGES.length, this.state.cageCount);
    for (; this.cagesDrawn < want; this.cagesDrawn++) {
      const c = CAGES[this.cagesDrawn];
      if (!c) continue;
      const img = this.createCage(c.x, c.y);
      if (animate) {
        img.setScale(0.2);
        this.tweens.add({ targets: img, scale: 1, ease: 'Back.easeOut', duration: 500 });
        this.burst(c.x, c.y - 16, 8);
      }
    }
  }

  /** Iskričky do kruhu – moment premeny a nová klietka (GDD §7.4). */
  private burst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count;
      const sp = this.add.image(x, y, 'spark').setDepth(4000);
      this.tweens.add({
        targets: sp,
        x: x + Math.cos(a) * 22,
        y: y + Math.sin(a) * 16,
        alpha: 0,
        duration: 700,
        ease: 'Quad.easeOut',
        onComplete: () => sp.destroy(),
      });
    }
  }

  // ---------- Udalosti stavu ----------

  private listen(): void {
    const bus = this.state.bus;
    const save = () => this.save();
    bus.on('catAdmitted', ({ cat }) => {
      // Nová mačka sa objaví pri svojej klietke – v garáži alebo v karanténe
      const quarantine = cat.ward === 'quarantine' && this.shelterRoom;
      const cages = quarantine ? QUARANTINE_CAGES : CAGES.slice(0, this.cagesDrawn);
      const n = this.state.wardCats(quarantine ? 'quarantine' : 'garage').length;
      const cage = cages[Math.min(cages.length - 1, Math.max(0, n - 1))] ?? CAGES[0];
      if (cage) this.spawnCat(cat, cage.x, cage.y + 8);
      save();
    });
    bus.on('catMoved', ({ cat }) => {
      const sprite = this.sprites.get(cat.id);
      if (sprite) this.moveToWard(sprite);
      save();
    });
    bus.on('catChanged', ({ cat }) => this.refreshCat(cat));
    bus.on('catBecameResident', ({ cat }) => {
      const sprite = this.sprites.get(cat.id);
      if (sprite && this.cafe) this.moveToCafe(sprite);
      else sprite?.setWalkArea(RESIDENT_AREA);
      this.refreshCat(cat);
      save();
    });
    bus.on('catAdopted', ({ record }) => {
      const sprite = this.sprites.get(record.cat.id);
      if (sprite) {
        if (this.selected === sprite) this.selected = null;
        this.sprites.delete(record.cat.id);
        // odchádza dverami miestnosti, v ktorej práve je
        sprite.leave(roomX(roomAt(sprite.x)) + EXIT.x, EXIT.y, () => undefined);
      }
      save();
    });
    bus.on('reportDeclined', save);
    bus.on('upgradeBought', ({ kind }) => {
      if (kind === 'cage') this.drawCages(true);
      if (kind === 'shelter') {
        this.openShelterRoom();
        this.showRoom('shelter');
      }
      if (kind === 'cafe') {
        this.openCafeRoom();
        for (const sprite of this.sprites.values())
          if (sprite.cat.resident) this.moveToCafe(sprite);
        this.showRoom('cafe');
      }
      save();
    });
    bus.on('challengeCompleted', save);
    // Moment premeny: mačka je zdravá a dôverčivá
    bus.on('catBecameReady', ({ cat }) => {
      const sprite = this.sprites.get(cat.id);
      if (!sprite) return;
      this.burst(sprite.x, sprite.y - 12, 12);
      this.refreshCat(cat);
      this.tweens.add({ targets: sprite, scaleX: 1.25, scaleY: 1.25, yoyo: true, duration: 180 });
      save();
    });
    bus.on('postcardArrived', save);
  }

  /** Vzhľad a značka mačky podľa jej stavu. */
  private refreshCat(cat: CatData): void {
    const sprite = this.sprites.get(cat.id);
    if (!sprite) return;
    sprite.applyLook();
    sprite.setBadge(Care.badgeFor(cat, this.state.data));
  }

  private spawnCat(cat: CatData, x: number, y: number): void {
    const area = this.areaFor(cat);
    const sprite = new CatSprite(this, x, y, cat, area, this.catWorld);
    sprite.on('pointerdown', () => {
      const reaction = sprite.react();
      if (reaction === 'fled') this.playSound('hiss', 0.5, 'mew');
      else this.playSound('mewPurr', 0.6);
      this.select(sprite.cat.id);
    });
    this.sprites.set(cat.id, sprite);
    this.refreshCat(cat);
  }

  /** Iskričky nad mačkou pripravenou na adopciu (GDD §7.4). */
  private sparkle(sprite: CatSprite): void {
    const s = this.add
      .image(sprite.x + Phaser.Math.Between(-8, 8), sprite.y - 24, 'spark')
      .setDepth(sprite.depth + 1);
    this.tweens.add({
      targets: s,
      y: s.y - 10,
      alpha: 0,
      duration: 900,
      onComplete: () => s.destroy(),
    });
  }

  private makeSparkTexture(): void {
    if (this.textures.exists('spark')) return;
    const tex = this.textures.createCanvas('spark', 5, 5);
    if (!tex) return;
    const c = tex.getContext();
    c.fillStyle = '#fff4d6';
    c.fillRect(2, 0, 1, 5);
    c.fillRect(0, 2, 5, 1);
    c.fillStyle = '#f2c14e';
    c.fillRect(2, 2, 1, 1);
    tex.refresh();
  }

  // ---------- Svetlo a hudba ----------

  private createLighting(): void {
    this.nightOverlay = this.add
      .rectangle(0, 0, WORLD_W * 3, WORLD_H, 0x000000, 0)
      .setOrigin(0)
      .setDepth(5000);
    // Mäkké svetlo lámp: radiálny prechod v textúre, sčítaný s obrazom
    if (!this.textures.exists('glow')) {
      const tex = this.textures.createCanvas('glow', 64, 64);
      if (tex) {
        const c = tex.getContext();
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255, 211, 138, 0.9)');
        g.addColorStop(0.45, 'rgba(255, 190, 110, 0.35)');
        g.addColorStop(1, 'rgba(255, 170, 90, 0)');
        c.fillStyle = g;
        c.fillRect(0, 0, 64, 64);
        tex.refresh();
      }
    }
    this.addGlow(448, FLOOR_TOP + 132, 46);
    this.addGlow(96, FLOOR_TOP + 136, 30);
  }

  private addGlow(x: number, y: number, r: number): void {
    const phase = this.phase;
    const alpha = phase === 'night' ? 0.9 : phase === 'evening' ? 0.5 : 0;
    this.lampGlows.push(
      this.add
        .image(x, y, 'glow')
        .setScale(r / 32)
        .setAlpha(alpha)
        .setDepth(5001)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
  }

  private updateLighting(): void {
    const phase = this.state.dayPhase;
    if (phase === this.phase) return;
    const first = this.phase === null;
    this.phase = phase;
    const tint = PHASE_TINT[phase];
    this.nightOverlay.setFillStyle(tint.color, this.nightOverlay.fillAlpha);
    this.tweens.add({
      targets: this.nightOverlay,
      fillAlpha: tint.alpha,
      duration: first ? 0 : 4000,
    });
    const glow = phase === 'night' ? 0.9 : phase === 'evening' ? 0.5 : 0;
    this.tweens.add({ targets: this.lampGlows, alpha: glow, duration: first ? 0 : 4000 });
    for (const sprite of this.sprites.values()) sprite.sleepy = phase === 'night';
  }

  private startMusic(): void {
    if (this.music) return;
    this.playTrack('music');
  }

  /** Ďalšie skladby sa načítajú na pozadí, aby štart hry nečakal na hudbu. */
  private loadMoreMusic(): void {
    for (const [key, urls] of Object.entries({ ...MUSIC_DAY, ...MUSIC_NIGHT })) {
      if (!this.cache.audio.exists(key)) this.load.audio(key, [...urls]);
    }
    this.load.start();
  }

  /** Cez deň lo-fi, večer a v noci pokojné skladby; striedajú sa a neopakujú hneď po sebe. */
  private nextTrack(): string {
    const night = this.state.dayPhase === 'night' || this.state.dayPhase === 'evening';
    const pool = Object.keys(night ? MUSIC_NIGHT : MUSIC_DAY).filter(
      (k) => this.cache.audio.exists(k) && k !== this.trackKey,
    );
    return pool.length ? Phaser.Utils.Array.GetRandom(pool) : 'music';
  }

  private playTrack(key: string): void {
    this.music?.destroy();
    this.trackKey = key;
    this.music = this.sound.add(key, { volume: 0.3 });
    this.music.once(Phaser.Sound.Events.COMPLETE, () => this.playTrack(this.nextTrack()));
    this.music.play();
  }

  // ---------- Kamera ----------

  private applyLayout(): void {
    // Rozloženie v CSS pixeloch (rovnaké ako HTML rozhranie), plátno je × DPR
    const l = computeLayout(this.scale.width / DPR, this.scale.height / DPR);
    const cam = this.cameras.main;
    cam.setViewport(
      0,
      0,
      Math.round(l.width * DPR),
      Math.round((l.portrait ? l.worldScreenH : l.height) * DPR),
    );
    cam.setZoom(l.zoom * DPR);
    const x0 = roomX(this.room);
    cam.setBounds(x0, 0, WORLD_W, WORLD_H, true);
    cam.centerOn(x0 + WORLD_W / 2, WORLD_H / 2);
  }

  /** Ťuknutie pod garážou (mobil na výšku) – tam je HTML karta. */
  private isOutsideWorld(p: Phaser.Input.Pointer): boolean {
    const cam = this.cameras.main;
    return p.y > cam.y + cam.height;
  }

  /** Posúvanie garáže ťahaním (keď je väčšia ako obrazovka, napr. mobil na výšku). */
  private enableDragPan(): void {
    let lastX = 0;
    let lastY = 0;
    let dragging = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      lastX = p.x;
      lastY = p.y;
      dragging = !this.isOutsideWorld(p);
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
  private prop(
    sheet: Sheet,
    name: string,
    x: number,
    bottomY: number,
    footprint = 0,
  ): Phaser.GameObjects.Image {
    const img = this.add.image(x, bottomY, sheet, name).setOrigin(0.5, 1).setDepth(bottomY);
    // Pôdorys pri zemi a miesto za predmetom, kde by mačku nebolo vidieť
    addProp(this.geom, x, bottomY, img.width, img.height, footprint);
    return img;
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
    this.prop('clinic', 'iv_stand', 38, FLOOR_TOP + 108, 8);
    this.prop('clinic', 'exam_bed', 66, FLOOR_TOP + 104, 14);
    this.prop('clinic', 'monitor', 66, FLOOR_TOP + 85).setDepth(FLOOR_TOP + 105);

    // Stôl dobrovoľníčky
    this.prop('interior', 'table', 120, FLOOR_TOP + 186, 36);
    this.prop('interior', 'chair', 132, FLOOR_TOP + 160, 14).setDepth(FLOOR_TOP + 150);
    this.prop('interior', 'desk_lamp', 96, FLOOR_TOP + 148).setDepth(FLOOR_TOP + 187);
    this.prop('interior', 'tv', 140, FLOOR_TOP + 150).setDepth(FLOOR_TOP + 187);

    // Mačací kút vpravo
    this.prop('interior', 'cushion', 440, FLOOR_TOP + 62);
    this.prop('interior', 'bowl', 330, FLOOR_TOP + 64);
    this.prop('interior', 'bowl', 344, FLOOR_TOP + 66);
    this.prop('interior', 'couch', 400, FLOOR_TOP + 188, 26);
    this.prop('interior', 'lamp', 448, FLOOR_TOP + 160, 8);
  }

  /** Klietka nakreslená kódom (v balíkoch nie je) – farby ladia s paletou interiéru. */
  private createCage(x: number, bottomY: number): Phaser.GameObjects.Image {
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
    return this.add.image(x, bottomY, key).setOrigin(0.5, 1).setDepth(bottomY);
  }

  private createZuzka(): void {
    const y = FLOOR_TOP + 168;
    this.zuzka = this.add.sprite(176, y, 'zuzka', 1).setOrigin(0.5, 1).setDepth(y);
    this.add.ellipse(176, y, 14, 5, 0x000000, 0.22).setDepth(y - 1);
    addProp(this.geom, 176, y + 2, 16, 32, 10);
    // Občas sa pozrie iným smerom: idle snímky dole/vľavo/vpravo/hore = 1, 4, 7, 10
    this.time.addEvent({
      delay: 3500,
      loop: true,
      callback: () => this.zuzka.setFrame(Phaser.Utils.Array.GetRandom([1, 1, 4, 7, 10])),
    });
  }
}
