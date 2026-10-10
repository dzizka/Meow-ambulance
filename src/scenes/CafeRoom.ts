import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { CafeGuest } from '../data/types';
import { INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import type { CatSprite } from '../objects/CatSprite';
import { CAFE_X, FLOOR_TOP, ROOM, WORLD_H, WORLD_W } from './layout';
import { ensurePixelIcons } from './pixelIcons';
import {
  ensurePersonAnims,
  personIdleFrame,
  personKey,
  personWalkKey,
  type PersonDir,
} from './personAnims';

/** Kde sa v kaviarni prechádzajú stálice. */
export const CAFE_AREA = new Phaser.Geom.Rectangle(CAFE_X + 40, FLOOR_TOP + 42, 380, 136);

/** Stoly (stred, spodná hrana) a na ktorej strane sedí hosť. Prvé dva od otvorenia. */
const TABLES = [
  { x: 200, y: FLOOR_TOP + 100, side: -1 },
  { x: 320, y: FLOOR_TOP + 100, side: -1 },
  { x: 200, y: FLOOR_TOP + 160, side: 1 },
  { x: 320, y: FLOOR_TOP + 160, side: 1 },
] as const;
/** Hostia prichádzajú a odchádzajú dverami vpravo dole a chodia uličkou pri spodnej stene. */
const DOOR = { x: ROOM.x + ROOM.w - 4, y: FLOOR_TOP + 182 };
const WALK_SPEED = 32; // px za sekundu

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
    private readonly obstacles: Phaser.Geom.Rectangle[],
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
    bus.on('guestLeft', ({ guest }) => this.removeGuest(guest));
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
    if (footprint > 0) this.addObstacle(CAFE_X + x, bottomY, img.width, footprint);
    return img;
  }

  private addObstacle(x: number, bottomY: number, width: number, depth: number): void {
    const pad = 3;
    this.obstacles.push(
      new Phaser.Geom.Rectangle(
        x - width / 2 - pad,
        bottomY - depth - pad,
        width + pad * 2,
        depth + pad * 2,
      ),
    );
  }

  private placeFurniture(): void {
    const wallBase = FLOOR_TOP + 22;
    // Pult so šálkami a baristka za ním
    const baristaSheet = this.state.data.balance.cafe.barista_sprite;
    const counterY = FLOOR_TOP + 30;
    this.scene.add
      .sprite(CAFE_X + 84, counterY - 8, personKey(baristaSheet), personIdleFrame('down'))
      .setOrigin(0.5, 1)
      .setDepth(counterY - 8);
    this.prop('counter_cups', 80, counterY, 12);
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
      const table = this.prop('table_small', t.x, t.y, 10);
      const seat = this.seat(this.tablesDrawn);
      const chair = this.scene.add
        .image(seat.x, seat.y + 3, 'interior', 'chair_side')
        .setOrigin(0.5, 1)
        // stolička je pred hosťom – zakryje mu nohy, takže vyzerá, že sedí
        .setDepth(seat.y + 3)
        .setFlipX(t.side < 0);
      this.addObstacle(seat.x, seat.y + 3, 14, 8);
      if (animate) {
        for (const img of [table, chair]) {
          img.setScale(0.2);
          this.scene.tweens.add({ targets: img, scale: 1, ease: 'Back.easeOut', duration: 500 });
        }
      }
    }
  }

  /** Miesto hosťa pri stole (svetové súradnice nôh). */
  private seat(table: number): { x: number; y: number; dir: PersonDir } {
    const t = TABLES[table] ?? TABLES[0];
    return {
      x: CAFE_X + t.x + t.side * 19,
      y: t.y + 1,
      dir: t.side < 0 ? 'right' : 'left',
    };
  }

  // ---------- Hostia ----------

  private addGuest(g: CafeGuest, walkIn: boolean): void {
    if (this.guests.has(g.id)) return;
    const scene = this.scene;
    ensurePersonAnims(scene.anims, g.sprite);
    const seat = this.seat(g.table);
    const start = walkIn ? { x: CAFE_X + DOOR.x, y: DOOR.y } : seat;
    const sprite = scene.add
      .sprite(start.x, start.y, personKey(g.sprite), personIdleFrame(seat.dir))
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

    const sitDown = () => {
      view.seated = true;
      sprite.anims.stop();
      sprite.setFrame(personIdleFrame(seat.dir));
      if (g.served) this.putItem(g, view);
      else {
        bubble.setVisible(true).setScale(0.2);
        scene.tweens.add({ targets: bubble, scale: 1, ease: 'Back.easeOut', duration: 300 });
      }
      // Stálica sa príde pozrieť na hosťa
      const cat = g.catId ? this.catSprite(g.catId) : undefined;
      cat?.visit(seat.x + (seat.dir === 'right' ? 16 : -16), seat.y + 10);
    };
    if (walkIn) this.walk(view, g.sprite, [{ x: seat.x, y: DOOR.y }, seat], sitDown);
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
      .image(CAFE_X + t.x + t.side * 6, t.y - 14, `item_${g.order}`)
      .setOrigin(0.5, 1)
      .setDepth(t.y + 0.5);
  }

  private removeGuest(g: CafeGuest): void {
    const view = this.guests.get(g.id);
    if (!view) return;
    this.guests.delete(g.id);
    view.bubble.destroy();
    view.item?.destroy();
    this.hearts(view.sprite.x, view.sprite.y - 30);
    const seat = this.seat(g.table);
    this.walk(
      view,
      g.sprite,
      [
        { x: seat.x, y: DOOR.y },
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
