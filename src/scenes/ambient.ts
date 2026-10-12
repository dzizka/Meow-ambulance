import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import { CATIO_AREA } from './CatioRoom';
import { FLOOR_TOP, ROOM } from './layout';

/**
 * Drobnosti, vďaka ktorým prostredie žije (GDD §9.3): para z hrnčekov, rastliny sa
 * jemne hojdajú, prach v slnečnom svetle a cez deň motýle vo výbehu. Iba vizuál.
 */
export class Ambient {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
  ) {
    this.motes();
    scene.time.addEvent({ delay: 9000, loop: true, callback: () => this.butterfly() });
  }

  /** Rastliny (snímka „plant") sa hojdajú – volá sa po otvorení každej miestnosti. */
  swayPlants(): void {
    for (const obj of this.scene.children.list) {
      if (!(obj instanceof Phaser.GameObjects.Image) || obj.getData('sway')) continue;
      const name = String(obj.frame?.name ?? '');
      if (!name.includes('plant')) continue;
      obj.setData('sway', true);
      this.scene.tweens.add({
        targets: obj,
        angle: { from: -1.5, to: 1.5 },
        duration: Phaser.Math.Between(2200, 3200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }
  }

  /** Prach v lúčoch svetla v garáži – cez deň. */
  private motes(): void {
    for (let i = 0; i < 7; i++) {
      const m = this.scene.add.rectangle(0, 0, 1, 1, 0xfff3d6, 0).setDepth(4000);
      const drift = () => {
        const day = this.state.dayPhase === 'day' || this.state.dayPhase === 'morning';
        const x = Phaser.Math.Between(ROOM.x + 60, ROOM.x + ROOM.w - 60);
        const y = Phaser.Math.Between(FLOOR_TOP - 40, FLOOR_TOP + 90);
        m.setPosition(x, y).setAlpha(0);
        this.scene.tweens.add({
          targets: m,
          x: x + Phaser.Math.Between(-18, 18),
          y: y + Phaser.Math.Between(10, 30),
          alpha: { from: 0, to: day ? 0.55 : 0 },
          yoyo: false,
          duration: Phaser.Math.Between(5000, 8000),
          onComplete: drift,
        });
      };
      this.scene.time.delayedCall(i * 700, drift);
    }
  }

  /** Motýľ preletí výbehom (iba cez deň a keď je výbeh postavený). */
  private butterfly(): void {
    if (!this.state.catio.open) return;
    if (this.state.dayPhase !== 'day' && this.state.dayPhase !== 'morning') return;
    if (Math.random() < 0.4) return;
    const color = Phaser.Utils.Array.GetRandom([0xf2c14e, 0xe8a0c8, 0x8fc3f0, 0xf4e6d0]);
    const a = CATIO_AREA;
    const fromLeft = Math.random() < 0.5;
    const sx = fromLeft ? a.left - 10 : a.right + 10;
    const ex = fromLeft ? a.right + 10 : a.left - 10;
    const by = Phaser.Math.Between(a.top - 30, a.top + 50);
    const g = this.scene.add.graphics().setDepth(4200).setPosition(sx, by);
    let flap = 0;
    const draw = () => {
      flap += 1;
      const w = flap % 2 === 0 ? 2 : 1;
      g.clear();
      g.fillStyle(color, 1);
      g.fillRect(-w - 1, -1, w, 2);
      g.fillRect(1, -1, w, 2);
      g.fillStyle(0x3b2f45, 1).fillRect(0, -1, 1, 3);
    };
    draw();
    const flapper = this.scene.time.addEvent({ delay: 140, loop: true, callback: draw });
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 7000,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        g.setPosition(sx + (ex - sx) * k, by + Math.sin(k * Math.PI * 6) * 8);
      },
      onComplete: () => {
        flapper.remove();
        g.destroy();
      },
    });
  }
}

/** Para stúpa nad hrnčekom, kým obrázok existuje. */
export function steam(scene: Phaser.Scene, target: Phaser.GameObjects.Image, dx = 0): void {
  const tick = scene.time.addEvent({
    delay: 700,
    loop: true,
    callback: () => {
      if (!target.active) {
        tick.remove();
        return;
      }
      if (!target.visible) return;
      const x = target.x + dx + Phaser.Math.Between(-2, 2);
      const y = target.y - target.displayHeight;
      const p = scene.add.rectangle(x, y, 1, 1, 0xffffff, 0.7).setDepth(target.depth + 1);
      scene.tweens.add({
        targets: p,
        y: y - 9,
        x: x + Phaser.Math.Between(-2, 2),
        alpha: 0,
        duration: 1400,
        onComplete: () => p.destroy(),
      });
    },
  });
}
