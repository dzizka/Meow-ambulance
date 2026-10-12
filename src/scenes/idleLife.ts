import Phaser from 'phaser';
import { personIdleFrame, personWalkKey, type PersonDir } from './personAnims';

export interface IdleOptions {
  /** Hárok postavičky (pre chôdzu pri prešľapovaní). */
  sheet: string;
  /** Kam sa pozerá (váhy = opakovanie smeru). */
  looks?: PersonDir[];
  /** O koľko px môže prešľapnúť doľava/doprava od domova (0 = stojí/sedí na mieste). */
  wander?: number;
  /** Tieň, ktorý ide s postavičkou. */
  shadow?: Phaser.GameObjects.Shape;
  /** Obrázky, ktoré občas vyskočia nad hlavou (napr. telefón, šálka). */
  emotes?: string[];
  /** Ďalšie podmienky, kedy nerobiť nič (napr. kráča po zadaní). */
  busy?: () => boolean;
}

/**
 * Nenápadný „život" postavičiek (GDD §9.3): dýchanie, obzeranie sa, občas prešľapne
 * a niečo si pomyslí. Nikdy nezasahuje do chôdze, ktorú riadi niekto iný.
 */
export class IdleLife {
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly breath: Phaser.Tweens.Tween;
  private home: { x: number; y: number };
  private stepping = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly o: IdleOptions,
  ) {
    this.home = { x: sprite.x, y: sprite.y };
    // dýchanie: jemné nadvihnutie (pôvod je pri nohách, takže rastie hore)
    const base = sprite.scaleY;
    this.breath = scene.tweens.add({
      targets: sprite,
      scaleY: { from: base, to: base * 1.03 },
      duration: Phaser.Math.Between(1300, 1700),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Phaser.Math.Between(0, 800),
    });
    this.every(2600, 5200, () => this.look());
    if (o.wander) this.every(7000, 13000, () => this.step());
    if (o.emotes?.length) this.every(12000, 22000, () => this.emote());
    sprite.once(Phaser.GameObjects.Events.DESTROY, () => this.destroy());
  }

  /** Nový domov (napr. hosť si sadol inam). */
  setHome(x: number, y: number): void {
    this.home = { x, y };
  }

  destroy(): void {
    for (const t of this.timers) t.remove();
    this.timers.length = 0;
    this.breath.remove();
  }

  private every(min: number, max: number, fn: () => void): void {
    const schedule = () => {
      const t = this.scene.time.delayedCall(Phaser.Math.Between(min, max), () => {
        if (this.sprite.active) fn();
        schedule();
      });
      this.timers.push(t);
      if (this.timers.length > 12) this.timers.splice(0, this.timers.length - 12);
    };
    schedule();
  }

  private idle(): boolean {
    return (
      this.sprite.active &&
      this.sprite.visible &&
      !this.stepping &&
      !this.sprite.anims.isPlaying &&
      !(this.o.busy?.() ?? false)
    );
  }

  private look(): void {
    if (!this.idle()) return;
    const dirs = this.o.looks ?? ['down', 'down', 'left', 'right'];
    this.sprite.setFrame(personIdleFrame(Phaser.Utils.Array.GetRandom(dirs)));
  }

  private step(): void {
    if (!this.idle()) return;
    const w = this.o.wander ?? 0;
    // drží sa pri domove: ak je ďaleko, vráti sa
    const off = this.sprite.x - this.home.x;
    const tx = Math.abs(off) > w * 0.6 ? this.home.x : this.home.x + Phaser.Math.Between(-w, w);
    const dx = tx - this.sprite.x;
    if (Math.abs(dx) < 3) return;
    this.stepping = true;
    const dir: PersonDir = dx < 0 ? 'left' : 'right';
    this.sprite.play(personWalkKey(this.o.sheet, dir), true);
    this.scene.tweens.add({
      targets: this.sprite,
      x: tx,
      duration: (Math.abs(dx) / 22) * 1000,
      onUpdate: () => this.o.shadow?.setPosition(this.sprite.x, this.sprite.y),
      onComplete: () => {
        this.sprite.anims.stop();
        this.sprite.setFrame(personIdleFrame('down'));
        this.stepping = false;
      },
    });
  }

  private emote(): void {
    if (!this.idle() || !this.o.emotes?.length) return;
    const key = Phaser.Utils.Array.GetRandom(this.o.emotes);
    if (!this.scene.textures.exists(key)) return;
    const x = this.sprite.x;
    const y = this.sprite.y - this.sprite.displayHeight - 2;
    const icon = this.scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(4600).setScale(0.3);
    this.scene.tweens.add({ targets: icon, scale: 1, ease: 'Back.easeOut', duration: 250 });
    this.scene.tweens.add({
      targets: icon,
      y: y - 6,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => icon.destroy(),
    });
  }
}

/**
 * Ťuknutie na postavičku vo svete → scéna dostane udalosť `personTap` s rolou
 * (Zuzka, personál…). Kontroluje, že prst začal aj skončil na plátne a nehýbal sa
 * (inak by ťahanie kamery „klikalo").
 */
export function tappablePerson(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  role: string,
): void {
  sprite.setInteractive({ useHandCursor: true, pixelPerfect: false });
  sprite.on('pointerup', (p: Phaser.Input.Pointer) => {
    const canvas = scene.game.canvas;
    if (p.downElement !== canvas || p.upElement !== canvas) return;
    if (p.getDistance() > 12 * window.devicePixelRatio) return;
    scene.events.emit('personTap', role);
  });
}
