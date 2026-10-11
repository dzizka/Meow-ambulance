import Phaser from 'phaser';
import type { CatData } from '../data/types';
import type { CatBadge } from '../core/systems/Care';
import { ensurePixelIcons } from '../scenes/pixelIcons';
import {
  catAnimKey,
  dirFromVector,
  ensureCatAnims,
  type CatAnim,
  type CatDir,
} from '../scenes/catAnims';

type Behaviour = 'idle' | 'walking' | 'fleeing' | 'sitting' | 'laying' | 'leaving';

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

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    cat: CatData,
    private walkArea: Phaser.Geom.Rectangle,
    /** Nábytok, cez ktorý mačka nechodí (pôdorysy pri zemi). */
    private readonly obstacles: Phaser.Geom.Rectangle[] = [],
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

  /** Prejde k bodu (napr. k hosťovi v kaviarni), ak nie je plachá a práve neodchádza. */
  visit(x: number, y: number): void {
    if (this.behaviour === 'leaving' || this.behaviour === 'fleeing') return;
    this.goTo(x, y, 'walking');
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
    return this.obstacles.some((o) => o.contains(x, y));
  }

  private goTo(x: number, y: number, mode: 'walking' | 'fleeing'): void {
    const a = this.walkArea;
    let tx = Phaser.Math.Clamp(x, a.left, a.right);
    let ty = Phaser.Math.Clamp(y, a.top, a.bottom);
    // Cieľ nesmie byť pod nábytkom – skús iné miesto v oblasti
    for (let i = 0; i < 12 && this.blocked(tx, ty); i++) {
      tx = Phaser.Math.Between(a.left, a.right);
      ty = Phaser.Math.Between(a.top, a.bottom);
    }
    this.target = new Phaser.Math.Vector2(tx, ty);
    this.behaviour = mode;
    this.dir = dirFromVector(this.target.x - this.x, this.target.y - this.y);
    this.setAnim(mode === 'fleeing' ? 'run' : 'walk');
  }

  private decide(now: number): void {
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
          this.behaviour = 'idle';
          this.nextDecisionAt = time + Phaser.Math.Between(300, 900);
          this.setAnim('look');
        } else {
          this.x = nx;
          this.y = ny;
        }
      }
    } else if (this.behaviour !== 'leaving' && time >= this.nextDecisionAt) {
      this.decide(time);
    }

    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + FEET_OFFSET).setDepth(this.y - 1);
    this.ring.setPosition(this.x, this.y + FEET_OFFSET).setDepth(this.y - 0.5);
    if (this.badge.visible) {
      const bob = Math.round(Math.sin(time / 300) * 1);
      const top = this.behaviour === 'laying' ? 18 : 27;
      this.badge.setPosition(Math.round(this.x), Math.round(this.y - top + bob)).setDepth(4500);
    }
    if (time >= this.nextFxAt) this.ambientFx(time);
  }

  /** Spiaca mačka vypúšťa „z", čistá a spokojná mačka sa ligoce. */
  private ambientFx(time: number): void {
    this.nextFxAt = time + Phaser.Math.Between(1400, 2600);
    if (this.behaviour === 'leaving') return;
    if (this.behaviour === 'laying' && this.sleepy) {
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
