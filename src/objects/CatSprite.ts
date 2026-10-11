import Phaser from 'phaser';
import type { CatData } from '../data/types';
import type { CatBadge } from '../core/systems/Care';
import { ensurePixelIcons } from '../scenes/pixelIcons';
import type { WorldGeom } from '../scenes/world';
import {
  catAnimKey,
  dirFromVector,
  ensureCatAnims,
  type CatAnim,
  type CatDir,
} from '../scenes/catAnims';

type Behaviour = 'idle' | 'walking' | 'fleeing' | 'sitting' | 'laying' | 'leaving';

/** Čo mačka vie o svete okolo seba (nábytok, ostatné mačky, hostia). */
export interface CatWorld extends WorldGeom {
  /** Všetky mačky v scéne – kvôli rozostupu, aby nesedeli na sebe. */
  cats(): Iterable<CatSprite>;
  /** Miesto pri hosťovi v kaviarni, kam môže mačka prísť, alebo null. */
  guestSpot?(cat: CatSprite): { x: number; y: number } | null;
  /** Mačka prišla k hosťovi (srdiečka). */
  onVisit?(cat: CatSprite): void;
}

/** Rozostup medzi mačkami (elipsa – do strán viac, dopredu/dozadu menej). */
const GAP_X = 18;
const GAP_Y = 10;

const WALK_SPEED = 22; // px za sekundu
const FLEE_SPEED = 70;
/**
 * Labky sú v snímke 32×32 na riadku ~24–26, bod mačky (origin 0.85) je na 27.
 * Tieň preto kreslíme o kúsok vyššie, aby mačka stála na zemi a nevznášala sa.
 */
const FEET_OFFSET = -2.5;

/**
 * Mačka v útulku: zobrazuje CatData a sama sa prechádza.
 * Rozhodnutia o správaní sú jednoduché a čisto vizuálne – herné pravidlá sú v core/.
 */
export class CatSprite extends Phaser.GameObjects.Sprite {
  readonly cat: CatData;
  private dir: CatDir = 'down';
  private behaviour: Behaviour = 'idle';
  private target: Phaser.Math.Vector2 | null = null;
  private nextDecisionAt = 0;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly badge: Phaser.GameObjects.Image;
  private badgeKind: CatBadge = null;
  /** Kedy pustiť ďalšie „z" (spánok) alebo iskričku (čistá srsť). */
  private nextFxAt = 0;
  /** Ide k hosťovi (kaviareň). */
  private visiting = false;
  /** Leží/sedí na jednom mieste (napr. na operačnom stole) – nerozhoduje sa sama. */
  private pinned = false;
  /** O koľko je vyššie poradie kreslenia (mačka na stole je pred stolom). */
  private depthBoost = 0;
  /** Spí aj cez deň (zotavuje sa po operácii). */
  private pinSleepy = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    cat: CatData,
    private walkArea: Phaser.Geom.Rectangle,
    /** Nábytok, ostatné mačky a hostia. */
    private readonly world: CatWorld,
  ) {
    super(scene, x, y, cat.sprite, 0);
    this.cat = cat;
    ensureCatAnims(scene.anims, cat.sprite);
    this.setOrigin(0.5, 0.85);

    this.shadow = scene.add.ellipse(x, y + FEET_OFFSET, 17, 5, 0x000000, 0.3);
    this.ring = scene.add.ellipse(x, y, 24, 9).setStrokeStyle(1, 0xfff4d6, 1).setVisible(false);
    ensurePixelIcons(scene);
    this.badge = scene.add.image(x, y, 'badge_exam').setOrigin(0.5, 1).setVisible(false);
    scene.add.existing(this);

    // Väčšia plocha na ťuknutie, aby sa mačka dala ľahko trafiť prstom
    this.setInteractive(new Phaser.Geom.Rectangle(2, 6, 28, 26), Phaser.Geom.Rectangle.Contains);
    this.applyLook();
    this.play(catAnimKey(cat.sprite, 'sit_idle', this.dir));
    this.behaviour = 'sitting';
    this.nextDecisionAt = scene.time.now + Phaser.Math.Between(500, 2500);
  }

  /** Vzhľad podľa štatistík – špinavá mačka je tmavšia (GDD §7.4). */
  applyLook(): void {
    const c = this.cat.stats.cleanliness;
    if (c < 30) this.setTint(0xa89a8c);
    else if (c < 60) this.setTint(0xd8cfc4);
    else this.clearTint();
  }

  /**
   * Značka nad hlavou: „?" nevyšetrená, krížik = treba liečiť, srdiečko = pripravená.
   * Pri zmene značka poskočí, aby si ju hráč všimol.
   */
  setBadge(kind: CatBadge): void {
    if (kind === this.badgeKind) return;
    this.badgeKind = kind;
    this.badge.setVisible(kind !== null);
    if (!kind) return;
    this.badge.setTexture(`badge_${kind}`).setScale(0.2);
    this.scene.tweens.add({ targets: this.badge, scale: 1, ease: 'Back.easeOut', duration: 350 });
  }

  /** V noci mačky viac spia (GDD §2.2 – hodiny ako atmosféra). */
  sleepy = false;
  private onLeft: (() => void) | null = null;

  /** Presun do inej časti garáže (napr. stálica do kútika). */
  setWalkArea(area: Phaser.Geom.Rectangle): void {
    this.walkArea = area;
    this.goTo(
      Phaser.Math.Between(area.left, area.right),
      Phaser.Math.Between(area.top, area.bottom),
      'walking',
    );
  }

  /** Presun do inej miestnosti (kaviareň) – zmizne a objaví sa na novom mieste. */
  teleport(x: number, y: number, area: Phaser.Geom.Rectangle): void {
    this.walkArea = area;
    this.target = null;
    this.pinned = false;
    this.depthBoost = 0;
    this.pinSleepy = false;
    this.scene.tweens.add({
      targets: [this, this.shadow],
      alpha: 0,
      duration: 250,
      onComplete: () => {
        this.setPosition(x, y);
        this.shadow.setPosition(x, y + FEET_OFFSET);
        this.behaviour = 'idle';
        this.nextDecisionAt = this.scene.time.now + 800;
        this.scene.tweens.add({ targets: [this, this.shadow], alpha: 1, duration: 300 });
      },
    });
  }

  /**
   * Presun na jedno miesto (stôl na klinike, pelech na zotavenie) – mačka tam leží alebo sedí,
   * kým ju niekto znova nepresunie (`teleport`).
   */
  pin(
    x: number,
    y: number,
    opts: { lay: boolean; dir?: CatDir; depthBoost?: number; sleepy?: boolean },
  ): void {
    this.target = null;
    this.visiting = false;
    this.scene.tweens.add({
      targets: [this, this.shadow],
      alpha: 0,
      duration: 250,
      onComplete: () => {
        this.walkArea = new Phaser.Geom.Rectangle(x, y, 1, 1);
        this.setPosition(x, y);
        this.pinned = true;
        this.depthBoost = opts.depthBoost ?? 0;
        this.pinSleepy = opts.sleepy ?? false;
        this.behaviour = opts.lay ? 'laying' : 'sitting';
        this.dir = opts.dir ?? 'down';
        this.setAnim(opts.lay ? 'lay_idle' : 'sit_idle');
        this.scene.tweens.add({ targets: [this, this.shadow], alpha: 1, duration: 300 });
      },
    });
  }

  get isPinned(): boolean {
    return this.pinned;
  }

  /** Príde k hosťovi a chvíľu pri ňom posedí alebo poleží. */
  visitSpot(spot: { x: number; y: number }): void {
    if (this.behaviour === 'leaving' || this.behaviour === 'fleeing') return;
    this.visiting = true;
    this.goTo(spot.x, spot.y, 'walking', true);
  }

  get leaving(): boolean {
    return this.behaviour === 'leaving';
  }

  /** Kde mačka je, alebo kam práve ide (kvôli rozostupu). */
  get restPoint(): { x: number; y: number } {
    return this.target ?? { x: this.x, y: this.y };
  }

  /** Je tu miesto? Nie pod nábytkom, nie schovaná za ním a nie na inej mačke. */
  isFreeSpot(x: number, y: number): boolean {
    return !this.blocked(x, y) && !this.hiddenAt(x, y) && !this.crowdedAt(x, y);
  }

  private hiddenAt(x: number, y: number): boolean {
    return this.world.hideZones.some((z) => z.contains(x, y));
  }

  private crowdedAt(x: number, y: number): boolean {
    for (const other of this.world.cats()) {
      if (other === this || other.leaving || !other.active) continue;
      const p = other.restPoint;
      const dx = (x - p.x) / GAP_X;
      const dy = (y - p.y) / GAP_Y;
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }

  /** Odchod z garáže (adopcia) – dôjde k dverám a zmizne. */
  leave(x: number, y: number, onLeft: () => void): void {
    this.disableInteractive();
    this.ring.setVisible(false);
    this.setBadge(null);
    this.onLeft = onLeft;
    this.target = new Phaser.Math.Vector2(x, y);
    this.behaviour = 'leaving';
    this.dir = dirFromVector(x - this.x, y - this.y);
    this.setAnim('walk');
  }

  setSelected(selected: boolean): void {
    this.ring.setVisible(selected);
  }

  /** Reakcia na ťuknutie: plachá mačka uteká, dôverčivá sa posadí a pradie. */
  react(): 'fled' | 'purred' {
    if (this.behaviour === 'leaving') return 'purred';
    if (this.cat.stats.trust < 15) {
      const away = new Phaser.Math.Vector2(
        this.x - this.scene.input.activePointer.worldX,
        this.y - this.scene.input.activePointer.worldY,
      )
        .normalize()
        .scale(60);
      this.goTo(this.x + away.x, this.y + away.y, 'fleeing');
      return 'fled';
    }
    this.target = null;
    this.setAnim('look');
    this.behaviour = 'sitting';
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.setAnim('sit_idle'));
    this.nextDecisionAt = this.scene.time.now + 4000;
    return 'purred';
  }

  private setAnim(anim: CatAnim): void {
    this.play(catAnimKey(this.cat.sprite, anim, this.dir), true);
  }

  private blocked(x: number, y: number): boolean {
    return this.world.obstacles.some((o) => o.contains(x, y));
  }

  /** `exact` = presne tento bod (návšteva hosťa); inak sa hľadá voľné viditeľné miesto. */
  private goTo(x: number, y: number, mode: 'walking' | 'fleeing', exact = false): void {
    const a = this.walkArea;
    let tx = Phaser.Math.Clamp(x, a.left, a.right);
    let ty = Phaser.Math.Clamp(y, a.top, a.bottom);
    // Cieľ nesmie byť pod nábytkom, za ním ani na inej mačke – skús iné miesto v oblasti
    for (let i = 0; !exact && i < 24 && !this.isFreeSpot(tx, ty); i++) {
      tx = Phaser.Math.Between(a.left, a.right);
      ty = Phaser.Math.Between(a.top, a.bottom);
    }
    this.target = new Phaser.Math.Vector2(tx, ty);
    this.behaviour = mode;
    this.dir = dirFromVector(this.target.x - this.x, this.target.y - this.y);
    this.setAnim(mode === 'fleeing' ? 'run' : 'walk');
  }

  private decide(now: number): void {
    // Sedí na inej mačke alebo je schovaná za nábytkom → presuň sa na voľné miesto
    if (this.crowdedAt(this.x, this.y) || this.hiddenAt(this.x, this.y)) {
      const a = this.walkArea;
      this.goTo(
        this.x + Phaser.Math.Between(-30, 30),
        this.y + Phaser.Math.Between(-15, 15),
        'walking',
      );
      if (this.target && !this.isFreeSpot(this.target.x, this.target.y))
        this.goTo(
          Phaser.Math.Between(a.left, a.right),
          Phaser.Math.Between(a.top, a.bottom),
          'walking',
        );
      return;
    }
    // V kaviarni občas zájde za hosťom, ak sa ľudí nebojí
    if (!this.sleepy && this.cat.stats.trust >= 15 && Math.random() < 0.3) {
      const spot = this.world.guestSpot?.(this);
      if (spot) {
        this.visitSpot(spot);
        return;
      }
    }
    const roll = Math.random();
    // Unavená/nespokojná mačka viac leží, hravá viac chodí
    const lazy = this.cat.traits.some((t) => t.id === 'lazy');
    const playful = this.cat.traits.some(
      (t) => t.id === 'playful' || t.id === 'curious' || t.id === 'hunter',
    );
    const walkChance = this.sleepy ? 0.1 : playful ? 0.65 : lazy ? 0.25 : 0.45;
    const layChance = this.sleepy ? 0.75 : 0.2;

    if (roll < walkChance) {
      const a = this.walkArea;
      this.goTo(
        Phaser.Math.Between(a.left, a.right),
        Phaser.Math.Between(a.top, a.bottom),
        'walking',
      );
      return;
    }
    if (roll < walkChance + layChance) {
      this.behaviour = 'laying';
      this.setAnim('lay');
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (this.behaviour === 'laying') this.setAnim('lay_idle');
      });
      this.nextDecisionAt = now + Phaser.Math.Between(6000, 12000);
      return;
    }
    this.behaviour = 'sitting';
    this.setAnim('sit');
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.behaviour === 'sitting') this.setAnim(Math.random() < 0.3 ? 'look' : 'sit_idle');
    });
    this.nextDecisionAt = now + Phaser.Math.Between(3000, 7000);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (this.target) {
      const speed =
        this.behaviour === 'fleeing'
          ? FLEE_SPEED
          : WALK_SPEED * (this.behaviour === 'leaving' ? 1.6 : 1);
      const step = (speed * delta) / 1000;
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= step && this.behaviour === 'leaving') {
        this.target = null;
        this.scene.tweens.add({
          targets: [this, this.shadow],
          alpha: 0,
          duration: 400,
          onComplete: () => {
            this.onLeft?.();
            this.destroy();
          },
        });
      } else if (dist <= step && this.visiting) {
        this.setPosition(this.target.x, this.target.y);
        this.target = null;
        this.arriveAtGuest(time);
      } else if (dist <= step) {
        this.setPosition(this.target.x, this.target.y);
        this.target = null;
        this.behaviour = 'idle';
        this.nextDecisionAt = time + Phaser.Math.Between(200, 1200);
        this.setAnim('sit');
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (this.behaviour === 'idle') this.setAnim('sit_idle');
        });
      } else {
        const nx = this.x + (dx / dist) * step;
        const ny = this.y + (dy / dist) * step;
        if (this.blocked(nx, ny) && !this.blocked(this.x, this.y) && this.behaviour !== 'leaving') {
          // Nábytok v ceste – zastav, ovoňaj a vyber si iný smer
          this.target = null;
          this.visiting = false;
          this.behaviour = 'idle';
          this.nextDecisionAt = time + Phaser.Math.Between(300, 900);
          this.setAnim('look');
        } else {
          this.x = nx;
          this.y = ny;
        }
      }
    } else if (!this.pinned && this.behaviour !== 'leaving' && time >= this.nextDecisionAt) {
      this.decide(time);
    }

    this.setDepth(this.y + this.depthBoost);
    this.shadow.setPosition(this.x, this.y + FEET_OFFSET).setDepth(this.y + this.depthBoost - 1);
    this.ring.setPosition(this.x, this.y + FEET_OFFSET).setDepth(this.y - 0.5);
    if (this.badge.visible) {
      const bob = Math.round(Math.sin(time / 300) * 1);
      const top = this.behaviour === 'laying' ? 18 : 27;
      this.badge.setPosition(Math.round(this.x), Math.round(this.y - top + bob)).setDepth(4500);
    }
    if (time >= this.nextFxAt) this.ambientFx(time);
  }

  /** Pri hosťovi: sadne si a pozerá hore na neho, alebo si ľahne vedľa – chvíľu ostane. */
  private arriveAtGuest(time: number): void {
    this.visiting = false;
    const lay = Math.random() < 0.5;
    this.behaviour = lay ? 'laying' : 'sitting';
    this.dir = lay ? (Math.random() < 0.5 ? 'left' : 'right') : 'up';
    this.setAnim(lay ? 'lay' : 'sit');
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.behaviour === 'laying') this.setAnim('lay_idle');
      else if (this.behaviour === 'sitting') this.setAnim('sit_idle');
    });
    this.nextDecisionAt = time + Phaser.Math.Between(8000, 15000);
    this.world.onVisit?.(this);
  }

  /** Spiaca mačka vypúšťa „z", čistá a spokojná mačka sa ligoce. */
  private ambientFx(time: number): void {
    this.nextFxAt = time + Phaser.Math.Between(1400, 2600);
    if (this.behaviour === 'leaving') return;
    if (this.behaviour === 'laying' && (this.sleepy || this.pinSleepy)) {
      const z = this.scene.add
        .image(this.x + 6, this.y - 16, 'zzz')
        .setDepth(4500)
        .setAlpha(0.9);
      this.scene.tweens.add({
        targets: z,
        x: z.x + 6,
        y: z.y - 12,
        alpha: 0,
        scale: 1.6,
        duration: 1800,
        onComplete: () => z.destroy(),
      });
      return;
    }
    if (this.cat.stats.cleanliness >= 90 && this.scene.textures.exists('spark')) {
      const sp = this.scene.add
        .image(this.x + Phaser.Math.Between(-7, 7), this.y - Phaser.Math.Between(6, 18), 'spark')
        .setDepth(this.y + 1)
        .setScale(0.4);
      this.scene.tweens.add({
        targets: sp,
        scale: 0.9,
        alpha: 0,
        duration: 700,
        onComplete: () => sp.destroy(),
      });
    }
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    this.ring.destroy();
    this.badge.destroy();
    super.destroy(fromScene);
  }
}
