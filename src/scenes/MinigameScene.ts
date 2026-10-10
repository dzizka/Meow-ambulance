import Phaser from 'phaser';
import { FONT_FAMILY } from '../assets';
import type { Stars } from '../core/systems/Care';
import type { CatData } from '../data/types';
import { t } from '../i18n/t';
import type { MinigameKind } from '../ui/UI';
import { catAnimKey, ensureCatAnims } from './catAnims';

export interface MinigameInit {
  kind: MinigameKind;
  cat: CatData;
  title: string;
  done: (stars: Stars | null) => void;
}

const BG = 0x2b2533;
const ACCENT = 0xe8a87c;
const TEXT = '#f4e6d0';
const DIM = '#b9a8b8';

/**
 * Minihry (GDD §4.2, §4.3): krátke, hmatové, vždy úspešné – hodnotí sa iba 1–3 hviezdičkami.
 * Kreslí sa v pixeloch obrazovky cez celé plátno, nad garážou.
 */
export class MinigameScene extends Phaser.Scene {
  private cfg!: MinigameInit;
  private S = 8; // mierka pixel-artu mačky
  private cx = 0;
  private cy = 0;
  private catSprite!: Phaser.GameObjects.Sprite;
  private hintText!: Phaser.GameObjects.Text;
  private finished = false;
  private updater: ((dt: number) => void) | null = null;

  constructor() {
    super('Minigame');
  }

  create(init: MinigameInit): void {
    this.cfg = init;
    this.finished = false;
    this.updater = null;
    const { width: W, height: H } = this.scale;
    const font = Math.round(Math.min(22, Math.max(14, Math.min(W, H) / 24)));
    this.S = Math.max(4, Math.floor(Math.min(W, H) / 44));
    this.cx = W / 2;
    this.cy = H * 0.52;

    this.add.rectangle(0, 0, W, H, BG, 0.96).setOrigin(0).setInteractive();
    this.text(W / 2, Math.max(28, H * 0.07), init.title, font * 1.4, TEXT, true).setOrigin(0.5);
    this.hintText = this.text(W / 2, Math.max(28, H * 0.07) + font * 2, '', font * 0.9, DIM)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(W * 0.86)
      .setAlign('center');
    const close = this.text(W - 16, 16, '✕', font * 1.4, DIM).setOrigin(1, 0);
    close.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.finish(null));

    ensureCatAnims(this.anims, init.cat.sprite);
    this.catSprite = this.add
      .sprite(this.cx, this.cy, init.cat.sprite)
      .setScale(this.S)
      .play(catAnimKey(init.cat.sprite, 'sit_idle', 'down'));
    if (init.cat.stats.cleanliness < 30) this.catSprite.setTint(0xa89a8c);

    switch (init.kind) {
      case 'tick_removal':
        this.tickRemoval();
        break;
      case 'feather':
        this.feather();
        break;
      case 'quiet':
        this.quiet();
        break;
      default:
        this.hold();
    }
  }

  override update(_time: number, delta: number): void {
    if (!this.finished) this.updater?.(delta);
  }

  private text(x: number, y: number, value: string, size: number, color: string, bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.round(size)}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
    });
  }

  private finish(stars: Stars | null): void {
    if (this.finished) return;
    this.finished = true;
    if (stars === null) {
      this.close(null);
      return;
    }
    const { width: W, height: H } = this.scale;
    const font = Math.round(Math.min(28, Math.max(18, Math.min(W, H) / 18)));
    this.text(
      W / 2,
      H * 0.84,
      `${t('MG_DONE')}  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
      font,
      '#f2c14e',
      true,
    ).setOrigin(0.5);
    this.catSprite.play(catAnimKey(this.cfg.cat.sprite, 'look', 'down'));
    this.sound.play('mewPurr', { volume: 0.6 });
    this.hearts(6);
    this.time.delayedCall(1300, () => this.close(stars));
  }

  private close(stars: Stars | null): void {
    const done = this.cfg.done;
    this.scene.stop();
    done(stars);
  }

  /** Srdiečka nad mačkou – malá odmena za každý úspech. */
  private hearts(count: number): void {
    for (let i = 0; i < count; i++) {
      const h = this.text(
        this.cx + Phaser.Math.Between(-this.S * 10, this.S * 10),
        this.cy - this.S * 8,
        '❤',
        this.S * 2.4,
        '#e86a6a',
      ).setOrigin(0.5);
      this.tweens.add({
        targets: h,
        y: h.y - this.S * 10,
        alpha: 0,
        delay: i * 90,
        duration: 900,
        onComplete: () => h.destroy(),
      });
    }
  }

  /** Náhodný bod na srsti mačky (nepriehľadný pixel aktuálnej snímky). */
  private pointOnCat(): Phaser.Math.Vector2 {
    const frame = this.catSprite.frame;
    for (let i = 0; i < 60; i++) {
      const px = Phaser.Math.Between(6, 26);
      const py = Phaser.Math.Between(10, 30);
      const c = this.textures.getPixel(frame.cutX + px, frame.cutY + py, this.cfg.cat.sprite);
      if (c && c.alpha > 200) {
        return new Phaser.Math.Vector2(this.cx + (px - 16) * this.S, this.cy + (py - 16) * this.S);
      }
    }
    return new Phaser.Math.Vector2(this.cx, this.cy);
  }

  // ---------- Vyťahovanie kliešťov ----------

  private tickRemoval(): void {
    this.hintText.setText(t('MG_TICK_HINT'));
    this.catSprite.anims.stop();
    this.catSprite.setFrame(24);
    const S = this.S;
    const count = Phaser.Math.Between(3, 4);
    let removed = 0;
    let slips = 0;
    const pullNeeded = S * 6;
    const maxSpeed = S * 0.09; // px za ms – rýchlejšie ťahanie = kliešť vykĺzne

    const meter = this.add.graphics().setDepth(10);
    for (let i = 0; i < count; i++) {
      const home = this.pointOnCat();
      const tick = this.add.container(home.x, home.y).setDepth(5);
      const g = this.add.graphics();
      g.lineStyle(Math.max(1, S / 4), 0x2b1d14, 1);
      for (const a of [-0.6, 0, 0.6]) {
        g.lineBetween(-S * 0.9, a * S, -S * 1.5, a * S * 1.6);
        g.lineBetween(S * 0.9, a * S, S * 1.5, a * S * 1.6);
      }
      g.fillStyle(0x4a2e1f, 1).fillEllipse(0, 0, S * 1.9, S * 1.5);
      g.fillStyle(0x6b4430, 1).fillEllipse(-S * 0.3, -S * 0.3, S * 0.7, S * 0.5);
      tick.add(g);
      tick.setSize(S * 4, S * 4).setInteractive({ useHandCursor: true, draggable: true });
      this.tweens.add({
        targets: tick,
        angle: { from: -6, to: 6 },
        yoyo: true,
        repeat: -1,
        duration: 400 + i * 70,
      });

      let lastX = 0;
      let lastY = 0;
      let lastT = 0;
      tick.on('dragstart', (p: Phaser.Input.Pointer) => {
        lastX = p.x;
        lastY = p.y;
        lastT = this.time.now;
      });
      tick.on('drag', (p: Phaser.Input.Pointer) => {
        const dt = Math.max(1, this.time.now - lastT);
        const speed = Phaser.Math.Distance.Between(lastX, lastY, p.x, p.y) / dt;
        lastX = p.x;
        lastY = p.y;
        lastT = this.time.now;
        const pull = Phaser.Math.Distance.Between(home.x, home.y, p.x, p.y);
        // Ukazovateľ napätia: zelená = pomaly, červená = príliš rýchlo
        const ratio = Math.min(1, speed / maxSpeed);
        meter.clear();
        meter
          .fillStyle(0x2b2533, 1)
          .fillRoundedRect(home.x - S * 4, home.y - S * 4, S * 8, S, S / 2);
        meter.fillStyle(ratio > 0.85 ? 0xe86a6a : ratio > 0.55 ? 0xf2c14e : 0x9ad17b, 1);
        meter.fillRoundedRect(
          home.x - S * 4,
          home.y - S * 4,
          S * 8 * Math.max(0.08, ratio),
          S,
          S / 2,
        );

        if (speed > maxSpeed && pull > S) {
          slips += 1;
          meter.clear();
          this.input.setDragState(p, 0);
          tick.setPosition(home.x, home.y);
          this.flash(t('MG_SLIPPED'), home.x, home.y - S * 6, '#e86a6a');
          this.sound.play('mew', { volume: 0.4 });
          return;
        }
        tick.setPosition(p.x, p.y);
        if (pull >= pullNeeded) {
          meter.clear();
          tick.disableInteractive();
          this.input.setDragState(p, 0);
          this.sound.play('click', { volume: 0.7 });
          this.tweens.add({
            targets: tick,
            x: this.scale.width - S * 6,
            y: this.scale.height - S * 6,
            scale: 0.3,
            alpha: 0,
            duration: 450,
            onComplete: () => tick.destroy(),
          });
          removed += 1;
          this.hearts(2);
          if (removed === count) this.finish(Math.max(1, 3 - slips) as Stars);
        }
      });
      tick.on('dragend', () => {
        meter.clear();
        if (tick.active && tick.input?.enabled) {
          this.tweens.add({ targets: tick, x: home.x, y: home.y, duration: 180 });
        }
      });
    }
  }

  private flash(msg: string, x: number, y: number, color: string): void {
    const txt = this.text(x, y, msg, this.S * 2.2, color, true)
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({
      targets: txt,
      y: y - this.S * 4,
      alpha: 0,
      duration: 800,
      onComplete: () => txt.destroy(),
    });
  }

  // ---------- Hra s perom ----------

  private feather(): void {
    this.hintText.setText(t('MG_FEATHER_HINT'));
    const S = this.S;
    const { width: W, height: H } = this.scale;
    const floorY = H * 0.78;
    this.catSprite.setPosition(W / 2, floorY).setOrigin(0.5, 0.85);
    const sheet = this.cfg.cat.sprite;

    const wand = this.add.graphics().setDepth(5);
    let fx = W / 2;
    let fy = H * 0.45;
    let px = fx;
    let py = fy;
    let interest = 0;
    let elapsed = 0;
    let pouncing = false;
    const bar = this.add.graphics().setDepth(10);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      fx = p.x;
      fy = Math.min(p.y, floorY - S * 2);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      fx = p.x;
      fy = Math.min(p.y, floorY - S * 2);
    });

    this.updater = (dt) => {
      elapsed += dt;
      const speed = Phaser.Math.Distance.Between(px, py, fx, fy) / Math.max(1, dt);
      px = fx;
      py = fy;

      // Prútik s perom
      wand.clear();
      wand.lineStyle(Math.max(2, S / 3), 0x8a6a4a, 1).lineBetween(fx + S * 10, fy - S * 14, fx, fy);
      wand
        .fillStyle(0xe8a87c, 1)
        .fillTriangle(fx, fy, fx - S * 2.2, fy + S * 1.2, fx - S * 0.4, fy + S * 3.2);
      wand
        .fillStyle(0xf4e6d0, 1)
        .fillTriangle(fx, fy, fx - S * 1.2, fy + S * 0.6, fx - S * 0.2, fy + S * 1.8);

      // Záujem rastie, keď sa pero hýbe primerane rýchlo
      const near = Math.abs(fx - this.catSprite.x) < W * 0.45;
      const good = speed > S * 0.02 && speed < S * 0.3 && near;
      interest = Phaser.Math.Clamp(interest + (good ? dt * 0.028 : -dt * 0.01), 0, 100);

      // Mačka beží za perom
      if (!pouncing) {
        const dx = fx - this.catSprite.x;
        const dir = dx < 0 ? 'left' : 'right';
        if (Math.abs(dx) > S * 3) {
          this.catSprite.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * S * 0.03);
          this.catSprite.play(catAnimKey(sheet, interest > 50 ? 'run' : 'walk', dir), true);
        } else if (fy > floorY - S * 10 && interest > 25) {
          // Skok na pero
          pouncing = true;
          interest = Math.min(100, interest + 12);
          this.catSprite.play(catAnimKey(sheet, 'run', dir), true);
          this.tweens.add({
            targets: this.catSprite,
            y: floorY - S * 7,
            yoyo: true,
            duration: 260,
            onComplete: () => (pouncing = false),
          });
        } else {
          this.catSprite.play(catAnimKey(sheet, 'sit_idle', 'down'), true);
        }
      }

      // Ukazovateľ záujmu
      const bw = Math.min(W * 0.7, S * 40);
      const bx = (W - bw) / 2;
      const by = floorY + S * 4;
      bar.clear();
      bar.fillStyle(0x3b2f45, 1).fillRoundedRect(bx, by, bw, S * 1.5, S * 0.75);
      bar
        .fillStyle(ACCENT, 1)
        .fillRoundedRect(bx, by, Math.max(S * 1.5, (bw * interest) / 100), S * 1.5, S * 0.75);

      if (interest >= 100) {
        const s = elapsed < 7000 ? 3 : elapsed < 11000 ? 2 : 1;
        this.finish(s as Stars);
      } else if (elapsed > 20000) this.finish(1);
    };
  }

  // ---------- Podrž (obväz, uši, sirup, česanie, maškrta) ----------

  private hold(): void {
    this.hintText.setText(t('MG_HOLD_HINT'));
    const S = this.S;
    const ring = this.add.graphics().setDepth(5);
    const r = S * 14;
    const duration = 2200;
    let progress = 0;
    let holding = false;
    let releases = 0;

    this.input.on('pointerdown', () => (holding = true));
    this.input.on('pointerup', () => {
      if (holding && progress > 0 && progress < duration) releases += 1;
      holding = false;
    });
    let heartTimer = 0;
    this.updater = (dt) => {
      if (holding) {
        progress = Math.min(duration, progress + dt);
        heartTimer += dt;
        if (heartTimer > 450) {
          heartTimer = 0;
          this.hearts(1);
        }
      }
      ring.clear();
      ring.lineStyle(S * 1.2, 0x3b2f45, 1).strokeCircle(this.cx, this.cy, r);
      ring.lineStyle(S * 1.2, ACCENT, 1);
      ring.beginPath();
      ring.arc(
        this.cx,
        this.cy,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * progress) / duration,
      );
      ring.strokePath();
      if (progress >= duration) this.finish(Math.max(1, 3 - releases) as Stars);
    };
  }

  // ---------- Ticho posedieť ----------

  private quiet(): void {
    this.hintText.setText(t('MG_QUIET_HINT'));
    const S = this.S;
    const ring = this.add.graphics().setDepth(5);
    const r = S * 14;
    const duration = 5000;
    let progress = 0;
    let taps = 0;
    this.catSprite.play(catAnimKey(this.cfg.cat.sprite, 'look', 'down'));
    this.catSprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
      this.catSprite.play(catAnimKey(this.cfg.cat.sprite, 'sit_idle', 'down')),
    );
    this.input.on('pointerdown', () => {
      if (this.finished) return;
      taps += 1;
      progress = Math.max(0, progress - 2000);
      this.flash(t('MG_QUIET_RESET'), this.cx, this.cy - S * 18, DIM);
    });
    this.updater = (dt) => {
      progress = Math.min(duration, progress + dt);
      ring.clear();
      ring.lineStyle(S * 0.8, 0x3b2f45, 1).strokeCircle(this.cx, this.cy, r);
      ring.lineStyle(S * 0.8, 0x9ad17b, 1);
      ring.beginPath();
      ring.arc(
        this.cx,
        this.cy,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * progress) / duration,
      );
      ring.strokePath();
      if (progress >= duration) this.finish(Math.max(1, 3 - taps) as Stars);
    };
  }
}
