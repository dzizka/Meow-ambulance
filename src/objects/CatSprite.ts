import Phaser from 'phaser';
import type { CatData } from '../data/types';
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

    this.shadow = scene.add.ellipse(x, y, 18, 6, 0x000000, 0.22);
    this.ring = scene.add.ellipse(x, y, 24, 9).setStrokeStyle(1, 0xfff4d6, 1).setVisible(false);
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

  /** Odchod z garáže (adopcia) – dôjde k dverám a zmizne. */
  leave(x: number, y: number, onLeft: () => void): void {
    this.disableInteractive();
    this.ring.setVisible(false);
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
    const playful = this.cat.traits.some((t) => t.id === 'playful');
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
    this.shadow.setPosition(this.x, this.y + 1).setDepth(this.y - 1);
    this.ring.setPosition(this.x, this.y + 1).setDepth(this.y - 0.5);
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
    this.ring.destroy();
    super.destroy(fromScene);
  }
}
