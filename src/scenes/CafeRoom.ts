import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { CafeGuest } from '../data/types';
import { INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import type { CatSprite } from '../objects/CatSprite';
import { CAFE_X, FLOOR_TOP, ROOM, WORLD_H, WORLD_W, roomAt } from './layout';
import { ensurePixelIcons } from './pixelIcons';
import { addProp, type WorldGeom } from './world';
import { IdleLife, tappablePerson } from './idleLife';
import { steam } from './ambient';
import {
  ensurePersonAnims,
  personIdleFrame,
  personKey,
  personWalkKey,
  type PersonDir,
} from './personAnims';

/** Kde sa v kaviarni prechádzajú stálice. */
export const CAFE_AREA = new Phaser.Geom.Rectangle(CAFE_X + 40, FLOOR_TOP + 42, 380, 136);

/** Stoly (stred, spodná hrana). Hosť sedí za stolom čelom k hráčovi. Prvé dva od otvorenia. */
const TABLES = [
  { x: 200, y: FLOOR_TOP + 100 },
  { x: 320, y: FLOOR_TOP + 100 },
  { x: 200, y: FLOOR_TOP + 160 },
  { x: 320, y: FLOOR_TOP + 160 },
] as const;
/** Hostia prichádzajú a odchádzajú dverami vpravo dole a chodia uličkou pri spodnej stene. */
const DOOR = { x: ROOM.x + ROOM.w - 4, y: FLOOR_TOP + 182 };
const WALK_SPEED = 32; // px za sekundu
/** Hosť sedí 12 px nad spodnou hranou stola – stôl mu zakryje nohy; k stolu prichádza zboku. */
const SEAT_UP = 12;
const SIDE_LANE = 18;

interface GuestView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  bubble: Phaser.GameObjects.Image;
  item: Phaser.GameObjects.Image | null;
  seated: boolean;
}

/**
 * Mačacia kaviareň (GDD §5.5) – druhá miestnosť sveta vedľa garáže.
 * Iba zobrazenie: hostia, stoly a objednávky prichádzajú z GameState cez udalosti.
 */
export class CafeRoom {
  private readonly guests = new Map<string, GuestView>();
  private tablesDrawn = 0;
  readonly lamps: [number, number, number][] = [
    [CAFE_X + 64, FLOOR_TOP + 150, 40],
    [CAFE_X + 440, FLOOR_TOP + 70, 30],
  ];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly geom: WorldGeom,
    private readonly catSprite: (id: string) => CatSprite | undefined,
    private readonly onServe: (guest: CafeGuest) => void,
  ) {
    ensurePixelIcons(scene);
    this.registerFrames();
    this.buildBackground();
    this.placeFurniture();
    this.drawTables(false);
    for (const g of state.cafe.guests) this.addGuest(g, false);

    const bus = state.bus;
    bus.on('guestArrived', ({ guest }) => this.addGuest(guest, true));
    bus.on('guestServed', ({ guest }) => this.served(guest));
    bus.on('guestLeft', ({ guest, review }) => {
      const view = this.guests.get(guest.id);
      if (view) this.showStars(view.sprite.x, view.sprite.y - 36, review.stars);
      this.removeGuest(guest);
    });
    bus.on('upgradeBought', ({ kind }) => {
      if (kind === 'table') this.drawTables(true);
    });
  }

  // ---------- Stavba miestnosti ----------

  private registerFrames(): void {
    const tex = this.scene.textures.get('interior');
    for (const [name, [x, y, w, h]] of Object.entries(INTERIOR_FRAMES)) {
      if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
    }
  }

  private buildBackground(): void {
    const key = 'cafe-bg';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const canvas = this.scene.textures.createCanvas(key, WORLD_W, WORLD_H);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    const src = this.scene.textures.get('interior').getSourceImage() as CanvasImageSource;
    const draw = (name: keyof typeof INTERIOR_FRAMES, dx: number, dy: number) => {
      const [x, y, w, h] = INTERIOR_FRAMES[name] as FrameRect;
      ctx.drawImage(src, x, y, w, h, Math.round(dx), Math.round(dy), w, h);
    };

    ctx.fillStyle = '#2b2533';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Ružové steny a drevená podlaha – teplejšie ako garáž
    for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += 32) {
      draw('wall_pink_top', x, ROOM.y);
      draw('wall_pink_bottom', x, ROOM.y + 32);
      for (let y = FLOOR_TOP; y < FLOOR_TOP + ROOM.floorH; y += 32) draw('floor_wood', x, y);
    }
    ctx.fillStyle = 'rgba(30, 20, 40, 0.28)';
    ctx.fillRect(ROOM.x, FLOOR_TOP, ROOM.w, 4);
    ctx.strokeStyle = '#1d1824';
    ctx.lineWidth = 2;
    ctx.strokeRect(ROOM.x - 1, ROOM.y - 1, ROOM.w + 2, ROOM.wallH + ROOM.floorH + 2);

    // Výzdoba na stene
    draw('curtains', 190, ROOM.y + 8);
    draw('window', 193, ROOM.y + 10);
    draw('painting', 250, ROOM.y + 20);
    draw('clock', 318, ROOM.y + 14);
    draw('window', 352, ROOM.y + 10);
    draw('window_wide', 384, ROOM.y + 10);
    draw('poster', 170, ROOM.y + 24);

    // Koberec pod stolmi
    draw('rug', 228, FLOOR_TOP + 70);
    canvas.refresh();
    this.scene.add.image(CAFE_X, 0, key).setOrigin(0, 0).setDepth(-1000);
  }

  /** Predmet stojí na zemi: (x, bottomY) v súradniciach miestnosti. */
  private prop(name: keyof typeof INTERIOR_FRAMES, x: number, bottomY: number, footprint = 0) {
    const img = this.scene.add
      .image(CAFE_X + x, bottomY, 'interior', name)
      .setOrigin(0.5, 1)
      .setDepth(bottomY);
    addProp(this.geom, CAFE_X + x, bottomY, img.width, img.height, footprint);
    return img;
  }

  private placeFurniture(): void {
    const wallBase = FLOOR_TOP + 22;
    // Pult so šálkami a baristka za ním
    const baristaSheet = this.state.data.balance.cafe.barista_sprite;
    const counterY = FLOOR_TOP + 30;
    ensurePersonAnims(this.scene.anims, baristaSheet);
    const barista = this.scene.add
      .sprite(CAFE_X + 84, counterY - 8, personKey(baristaSheet), personIdleFrame('down'))
      .setOrigin(0.5, 1)
      .setDepth(counterY - 8);
    // za pultom prešľapuje a občas pripraví kávu
    new IdleLife(this.scene, barista, {
      sheet: baristaSheet,
      looks: ['down', 'down', 'left', 'right', 'up'],
      wander: 12,
      emotes: ['item_coffee', 'item_tea'],
    });
    tappablePerson(this.scene, barista, 'barista');
    steam(this.scene, this.prop('counter_cups', 80, counterY, 12), -6);
    this.prop('fridge', 130, wallBase + 2, 8);
    this.prop('plant', 38, wallBase + 4, 6);
    this.prop('bookshelf', 436, wallBase, 6);
    this.prop('plant', 410, wallBase + 4, 6);

    // Oddychový kútik pre mačky vľavo dole
    this.prop('armchair', 70, FLOOR_TOP + 190, 22);
    this.prop('lamp', 30, FLOOR_TOP + 160, 6);
    this.prop('cushion', 120, FLOOR_TOP + 184);
    this.prop('bowl', 400, FLOOR_TOP + 120);
    this.prop('bowl', 414, FLOOR_TOP + 122);
    this.prop('cushion', 420, FLOOR_TOP + 150);
  }

  /** Stoly so stoličkami podľa počtu v stave – nové sa objavia s animáciou. */
  private drawTables(animate: boolean): void {
    const want = Math.min(TABLES.length, this.state.tableCount);
    for (; this.tablesDrawn < want; this.tablesDrawn++) {
      const t = TABLES[this.tablesDrawn];
      if (!t) continue;
      // Poradie odzadu: stolička → hosť → stôl (stôl mu zakryje nohy, operadlo je za ním)
      const table = this.prop('table_small', t.x, t.y, 10).setDepth(t.y);
      const chair = this.scene.add
        .image(CAFE_X + t.x, t.y - 10, 'interior', 'chair_front')
        .setOrigin(0.5, 1)
        .setDepth(t.y - 3);
      addProp(this.geom, CAFE_X + t.x, t.y - 10, 18, 29, 8);
      if (animate) {
        for (const img of [table, chair]) {
          img.setScale(0.2);
          this.scene.tweens.add({ targets: img, scale: 1, ease: 'Back.easeOut', duration: 500 });
        }
      }
    }
  }

  /** Miesto hosťa za stolom (svetové súradnice nôh) a ulička vedľa stola, ktorou prichádza. */
  private seat(table: number): { x: number; y: number; laneX: number } {
    const t = TABLES[table] ?? TABLES[0];
    return { x: CAFE_X + t.x, y: t.y - SEAT_UP, laneX: CAFE_X + t.x + SIDE_LANE };
  }

  private tableOf(g: CafeGuest): { x: number; y: number } {
    return TABLES[g.table] ?? TABLES[0];
  }

  // ---------- Hostia ----------

  private addGuest(g: CafeGuest, walkIn: boolean): void {
    if (this.guests.has(g.id)) return;
    const scene = this.scene;
    ensurePersonAnims(scene.anims, g.sprite);
    const seat = this.seat(g.table);
    const start = walkIn ? { x: CAFE_X + DOOR.x, y: DOOR.y } : seat;
    const sprite = scene.add
      .sprite(start.x, start.y, personKey(g.sprite), personIdleFrame('down'))
      .setOrigin(0.5, 1)
      .setDepth(start.y);
    const shadow = scene.add.ellipse(start.x, start.y, 14, 5, 0x000000, 0.25).setDepth(start.y - 1);
    const bubble = scene.add
      .image(seat.x, seat.y - 34, `order_${g.order}`)
      .setOrigin(0.5, 1)
      .setDepth(4500)
      .setVisible(false);
    // Väčšia plocha na ťuknutie – bublina je malá
    bubble.setInteractive(
      new Phaser.Geom.Rectangle(-6, -6, bubble.width + 12, bubble.height + 12),
      Phaser.Geom.Rectangle.Contains,
    );
    bubble.on('pointerdown', () => this.onServe(g));
    const view: GuestView = { sprite, shadow, bubble, item: null, seated: false };
    this.guests.set(g.id, view);
    // pri stole sa obzerá po kaviarni a po mačkách
    new IdleLife(scene, sprite, {
      sheet: g.sprite,
      looks: ['down', 'down', 'left', 'right'],
      busy: () => !view.seated,
    });

    const sitDown = () => {
      view.seated = true;
      sprite.anims.stop();
      // Sedí za stolom čelom k hráčovi: nad stoličkou, pod stolom
      sprite.setFrame(personIdleFrame('down'));
      sprite.setPosition(seat.x, seat.y).setDepth(this.tableOf(g).y - 2);
      shadow.setVisible(false);
      if (g.served) this.putItem(g, view);
      else {
        bubble.setVisible(true).setScale(0.2);
        scene.tweens.add({ targets: bubble, scale: 1, ease: 'Back.easeOut', duration: 300 });
      }
      // Jeho obľúbená stálica sa príde pozrieť (ak je v kaviarni a nie je k nemu iná mačka)
      const cat = g.catId ? this.catSprite(g.catId) : undefined;
      if (cat && roomAt(cat.x) === 'cafe' && cat.cat.resident) {
        const spot = this.spotsFor(g).find((p) => cat.isFreeSpot(p.x, p.y));
        if (spot) cat.visitSpot(spot);
      }
    };
    // Uličkou k stolu, zboku za stôl a na stoličku
    if (walkIn)
      this.walk(
        view,
        g.sprite,
        [
          { x: seat.laneX, y: DOOR.y },
          { x: seat.laneX, y: seat.y },
          { x: seat.x, y: seat.y },
        ],
        sitDown,
      );
    else sitDown();
  }

  private served(g: CafeGuest): void {
    const view = this.guests.get(g.id);
    if (!view) return;
    view.bubble.disableInteractive();
    this.scene.tweens.add({
      targets: view.bubble,
      scale: 0,
      duration: 200,
      onComplete: () => view.bubble.setVisible(false),
    });
    if (view.seated) this.putItem(g, view);
    this.hearts(view.sprite.x, view.sprite.y - 30);
  }

  /** Šálka alebo koláč na stole pred hosťom. */
  private putItem(g: CafeGuest, view: GuestView): void {
    if (view.item) return;
    const t = TABLES[g.table] ?? TABLES[0];
    view.item = this.scene.add
      .image(CAFE_X + t.x, t.y - 13, `item_${g.order}`)
      .setOrigin(0.5, 1)
      .setDepth(t.y + 1);
    if (g.order !== 'cake') steam(this.scene, view.item);
  }

  private removeGuest(g: CafeGuest): void {
    const view = this.guests.get(g.id);
    if (!view) return;
    this.guests.delete(g.id);
    view.bubble.destroy();
    view.item?.destroy();
    this.hearts(view.sprite.x, view.sprite.y - 30);
    const seat = this.seat(g.table);
    // Vstane, vyjde zboku spoza stola a uličkou k dverám
    view.seated = false;
    view.shadow.setPosition(seat.x, seat.y).setVisible(true);
    this.walk(
      view,
      g.sprite,
      [
        { x: seat.laneX, y: seat.y },
        { x: seat.laneX, y: DOOR.y },
        { x: CAFE_X + DOOR.x, y: DOOR.y },
      ],
      () => {
        this.scene.tweens.add({
          targets: [view.sprite, view.shadow],
          alpha: 0,
          duration: 300,
          onComplete: () => {
            view.sprite.destroy();
            view.shadow.destroy();
          },
        });
      },
    );
  }

  /** Chôdza po úsekoch (najprv uličkou, potom k stolu) s animáciou podľa smeru. */
  private walk(
    view: GuestView,
    sheet: string,
    points: { x: number; y: number }[],
    done: () => void,
  ): void {
    const [next, ...rest] = points;
    if (!next) {
      done();
      return;
    }
    const { sprite, shadow } = view;
    const dx = next.x - sprite.x;
    const dy = next.y - sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      this.walk(view, sheet, rest, done);
      return;
    }
    const dir: PersonDir =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    sprite.play(personWalkKey(sheet, dir), true);
    this.scene.tweens.add({
      targets: sprite,
      x: next.x,
      y: next.y,
      duration: (dist / WALK_SPEED) * 1000,
      onUpdate: () => {
        sprite.setDepth(sprite.y);
        shadow.setPosition(sprite.x, sprite.y).setDepth(sprite.y - 1);
      },
      onComplete: () => this.walk(view, sheet, rest, done),
    });
  }

  /** Miesta pri hosťovi, kam si môže mačka sadnúť: pred stôl a vedľa stola (nie do uličky). */
  private spotsFor(g: CafeGuest): { x: number; y: number }[] {
    const t = this.tableOf(g);
    return [
      { x: CAFE_X + t.x, y: t.y + 9 },
      { x: CAFE_X + t.x - 25, y: t.y + 3 },
    ];
  }

  /** Voľné miesto pri niektorom sediacom hosťovi pre túto mačku, alebo null. */
  guestSpotFor(cat: CatSprite): { x: number; y: number } | null {
    const options: { x: number; y: number }[] = [];
    for (const g of this.state.cafe.guests) {
      if (!this.guests.get(g.id)?.seated) continue;
      // k jednému hosťovi najviac jedna mačka
      const spots = this.spotsFor(g);
      const taken = spots.some((p) => !cat.isFreeSpot(p.x, p.y));
      if (taken) continue;
      const free = spots.filter((p) => CAFE_AREA.contains(p.x, p.y));
      options.push(...free);
    }
    return options.length ? Phaser.Utils.Array.GetRandom(options) : null;
  }

  /** Hodnotenie hosťa – päť hviezdičiek nad hlavou, plné podľa počtu. */
  private showStars(x: number, y: number, n: number): void {
    const g = this.scene.add.graphics().setDepth(4600).setPosition(x, y);
    const star = (cx: number, filled: boolean) => {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 3.2 : 1.4;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, Math.sin(a) * r));
      }
      g.fillStyle(filled ? 0xf2c14e : 0x5a4a63, 1).fillPoints(pts, true);
    };
    for (let i = 0; i < 5; i++) star((i - 2) * 7.5, i < n);
    g.setScale(0.3);
    this.scene.tweens.add({ targets: g, scale: 1, ease: 'Back.easeOut', duration: 250 });
    this.scene.tweens.add({
      targets: g,
      y: y - 10,
      alpha: 0,
      delay: 1600,
      duration: 500,
      onComplete: () => g.destroy(),
    });
  }

  /** Srdiečka nad mačkou, ktorá prišla k hosťovi. */
  heartsAt(x: number, y: number): void {
    this.hearts(x, y);
  }

  private hearts(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const h = this.scene.add
        .image(x + Phaser.Math.Between(-6, 6), y, 'badge_ready')
        .setScale(0.6)
        .setDepth(4500);
      this.scene.tweens.add({
        targets: h,
        y: y - 14 - i * 4,
        alpha: 0,
        delay: i * 120,
        duration: 900,
        onComplete: () => h.destroy(),
      });
    }
  }
}
