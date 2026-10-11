import Phaser from 'phaser';
import { FONT_FAMILY } from '../assets';
import { DPR } from './dpr';
import type { Stars } from '../core/systems/Care';
import type { CatData } from '../data/types';
import { t } from '../i18n/t';
import type { MinigameKind } from '../ui/UI';
import { catAnimKey, ensureCatAnims } from './catAnims';

export interface MinigameInit {
  kind: MinigameKind;
  cat: CatData;
  title: string;
  /** Röntgen: čo je na snímke (null = nič). */
  xray?: 'fracture' | 'swallowed' | null;
  /** Operácia: kastrácia (bez kroku s pinzetou). */
  neuter?: boolean;
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
    // písmo v CSS pixeloch × DPR (plátno má plné rozlíšenie displeja)
    const font = Math.round(DPR * Math.min(22, Math.max(14, Math.min(W, H) / DPR / 24)));
    this.S = Math.max(4, Math.floor(Math.min(W, H) / 44));
    this.cx = W / 2;
    this.cy = H * 0.52;

    this.add.rectangle(0, 0, W, H, BG, 0.96).setOrigin(0).setInteractive();
    this.text(W / 2, Math.max(28 * DPR, H * 0.07), init.title, font * 1.4, TEXT, true).setOrigin(
      0.5,
    );
    this.hintText = this.text(W / 2, Math.max(28 * DPR, H * 0.07) + font * 2, '', font * 0.9, DIM)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(W * 0.86)
      .setAlign('center');
    const close = this.text(W - 16 * DPR, 16 * DPR, '✕', font * 1.4, DIM).setOrigin(1, 0);
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
      case 'bandage':
        this.bandage();
        break;
      case 'ears':
        this.ears();
        break;
      case 'syrup':
        this.syrup();
        break;
      case 'breath':
        this.breath();
        break;
      case 'bath':
        this.bath();
        break;
      case 'claws':
        this.claws();
        break;
      case 'drops':
        this.drops();
        break;
      case 'vaccine':
        this.vaccine();
        break;
      case 'bloodtest':
        this.bloodtest();
        break;
      case 'xray':
        this.xray();
        break;
      case 'surgery':
        this.surgery();
        break;
      case 'splint':
        this.splint();
        break;
      default:
        this.hold();
    }
  }

  /** Zahrá zvuk, iba ak je načítaný (voliteľné zvuky môžu chýbať). */
  private sfx(key: string, volume: number): void {
    if (this.cache.audio.exists(key)) this.sound.play(key, { volume });
  }

  override update(_time: number, delta: number): void {
    if (!this.finished) this.updater?.(delta);
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    bold = false,
    family = FONT_FAMILY,
  ) {
    return this.add.text(x, y, value, {
      fontFamily: family,
      fontSize: `${Math.round(size)}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
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
    const font = Math.round(DPR * Math.min(28, Math.max(18, Math.min(W, H) / DPR / 18)));
    this.text(
      W / 2,
      H * 0.84,
      `${t('MG_DONE')}  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`,
      font,
      '#f2c14e',
      true,
    ).setOrigin(0.5);
    this.catSprite.play(catAnimKey(this.cfg.cat.sprite, 'look', 'down'));
    this.sfx('success', 0.5);
    this.sfx('mewPurr', 0.6);
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
  private pointOnCat(minY = 10, maxY = 30): Phaser.Math.Vector2 {
    const frame = this.catSprite.frame;
    for (let i = 0; i < 80; i++) {
      const px = Phaser.Math.Between(6, 26);
      const py = Phaser.Math.Between(minY, maxY);
      // Súradnice v rámci snímky – vzorkovanie cez celý hárok v Phaseri 4 nefunguje
      const c = this.textures.getPixel(px, py, this.cfg.cat.sprite, frame.name);
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
          this.sfx('error', 0.5);
          this.sfx('mew', 0.4);
          return;
        }
        tick.setPosition(p.x, p.y);
        if (pull >= pullNeeded) {
          meter.clear();
          tick.disableInteractive();
          this.input.setDragState(p, 0);
          this.sfx('pluck', 0.7);
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

  /** Prstíky labky – relatívne k polomeru vankúšika R. */
  private static readonly TOES = [
    [-0.95, -0.85],
    [-0.33, -1.25],
    [0.33, -1.25],
    [0.95, -0.85],
  ] as const;

  /** Veľká labka: vankúšik a štyri prstíky (obväz, pazúriky). */
  private drawPaw(cx: number, cy: number, R: number): Phaser.GameObjects.Graphics {
    const paw = this.add.graphics();
    const fur = 0xd9b38c;
    const pad = 0xe8a0a0;
    paw.fillStyle(fur, 1).fillCircle(cx, cy + R * 0.25, R);
    for (const [dx, dy] of MinigameScene.TOES) {
      paw.fillStyle(fur, 1).fillCircle(cx + dx * R, cy + dy * R, R * 0.42);
      paw.fillStyle(pad, 1).fillCircle(cx + dx * R, cy + dy * R + R * 0.05, R * 0.24);
    }
    paw.fillStyle(pad, 1).fillEllipse(cx, cy + R * 0.4, R * 1.1, R * 0.8);
    return paw;
  }

  // ---------- Kúpanie (blchy) ----------

  /**
   * Dve fázy: najprv mačku napeniť (pretierať, kým nie je celá v pene),
   * potom penu opláchnuť – blšky pri tom odskakujú preč.
   */
  private bath(): void {
    this.hintText.setText(t('MG_BATH_HINT_FOAM'));
    this.catSprite.anims.stop();
    this.catSprite.setFrame(24);
    const S = this.S;
    const { cx, cy } = this;

    // Vanička za mačkou a hladina vody pred ňou
    this.catSprite.setDepth(1);
    const tub = this.add.graphics().setDepth(0.5);
    tub.fillStyle(0xd8e6f0, 1).fillRoundedRect(cx - S * 15, cy - S * 1, S * 30, S * 15, S * 3);
    tub.fillStyle(0xb8d8ff, 1).fillRoundedRect(cx - S * 13, cy + S * 1, S * 26, S * 11, S * 2);
    // hladina pred mačkou – zakryje jej labky, takže sedí vo vode
    const water = this.add.graphics().setDepth(3);
    water.fillStyle(0x8fc3f0, 0.75).fillRoundedRect(cx - S * 13, cy + S * 5, S * 26, S * 7, S * 2);
    water.fillStyle(0xd8e6f0, 1).fillRoundedRect(cx - S * 15, cy + S * 11, S * 30, S * 3, S * 1.5);

    // Miesta na mačke, ktoré treba napeniť (a na nich blšky)
    const spots = Array.from({ length: 8 }, () => {
      const pt = this.pointOnCat(5, 20); // iba nad hladinou
      const foam = this.add.circle(pt.x, pt.y, S * 2.4, 0xffffff, 0).setDepth(5);
      const flea = this.add.circle(pt.x, pt.y, S * 0.45, 0x2b2533, 1).setDepth(4);
      return { foam, flea, amount: 0 };
    });
    let phase: 'foam' | 'rinse' = 'foam';
    let elapsed = 0;
    let lastX = 0;
    let lastY = 0;
    let splashCooldown = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      lastX = p.x;
      lastY = p.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.finished) return;
      const moved = Phaser.Math.Distance.Between(lastX, lastY, p.x, p.y);
      lastX = p.x;
      lastY = p.y;
      for (const sp of spots) {
        if (Phaser.Math.Distance.Between(sp.foam.x, sp.foam.y, p.x, p.y) > S * 3.5) continue;
        if (phase === 'foam' && sp.amount < 1) {
          sp.amount = Math.min(1, sp.amount + moved / (S * 10));
          sp.foam.setFillStyle(0xffffff, sp.amount * 0.9).setScale(0.6 + sp.amount * 0.5);
        } else if (phase === 'rinse' && sp.amount > 0) {
          sp.amount = Math.max(0, sp.amount - moved / (S * 10));
          sp.foam.setFillStyle(0xffffff, sp.amount * 0.9);
          if (sp.amount === 0 && sp.flea.active) {
            // blška odskočí preč
            this.tweens.add({
              targets: sp.flea,
              x: sp.flea.x + Phaser.Math.Between(-S * 12, S * 12),
              y: sp.flea.y - S * 10,
              alpha: 0,
              duration: 500,
              ease: 'Quad.easeOut',
              onComplete: () => sp.flea.destroy(),
            });
            this.sfx('pluck', 0.4);
          }
        }
      }
      if (splashCooldown <= 0 && moved > S * 0.6) {
        splashCooldown = 450;
        this.sfx('splash', 0.35);
      }
      if (phase === 'foam' && spots.every((sp) => sp.amount >= 1)) {
        phase = 'rinse';
        this.hintText.setText(t('MG_BATH_HINT_RINSE'));
        this.flash(t('MG_BATH_RINSE'), cx, cy - S * 16, '#b8d8ff');
        this.hearts(2);
      } else if (phase === 'rinse' && spots.every((sp) => sp.amount <= 0)) {
        this.catSprite.clearTint();
        this.finish((elapsed < 10000 ? 3 : elapsed < 16000 ? 2 : 1) as Stars);
      }
    });
    this.updater = (dt) => {
      elapsed += dt;
      splashCooldown -= dt;
      // blšky sa pod penou trochu hýbu
      for (const sp of spots) {
        if (sp.flea.active && sp.amount < 1) sp.flea.x += Math.sin(elapsed / 90 + sp.foam.x) * 0.3;
      }
    };
  }

  // ---------- Strihanie pazúrikov ----------

  /**
   * Nožnička sa posúva po pazúriku hore-dole. Ťuknúť, keď je na bielej špičke;
   * ružová časť pri prstíku bolí (chyba, mačka mňaukne). Štyri pazúriky.
   */
  private claws(): void {
    this.hintText.setText(t('MG_CLAWS_HINT'));
    this.catSprite.setVisible(false);
    const S = this.S;
    const R = S * 6;
    const { cx } = this;
    const cy = this.cy + S * 4;
    this.drawPaw(cx, cy, R);

    const quickPart = 0.55; // prvých 55 % pazúrika je ružových
    const claws = MinigameScene.TOES.map(([dx, dy]) => {
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const bx = cx + dx * R + ux * R * 0.36;
      const by = cy + dy * R + uy * R * 0.36;
      return { ux, uy, bx, by, L: R * 1.1, cut: false };
    });
    const g = this.add.graphics().setDepth(2);
    const marker = this.add.graphics().setDepth(3);
    let current = 0;
    let pos = 0; // 0 = pri prstíku, 1 = špička
    let dir = 1;
    let mistakes = 0;

    const drawClaws = () => {
      g.clear();
      claws.forEach((c, i) => {
        const end = c.cut ? quickPart + 0.08 : 1;
        const w = S * 1.3;
        const px = -c.uy;
        const py = c.ux;
        // pazúrik: biely zúžený trojuholník, vnútri pri koreni ružová dreň (tú nestrihať)
        const at = (t: number) => ({ x: c.bx + c.ux * c.L * t, y: c.by + c.uy * c.L * t });
        const a = at(0);
        const e = at(end);
        const q = at(quickPart);
        g.fillStyle(0xfdf6ec, 1).fillTriangle(
          a.x + px * w,
          a.y + py * w,
          a.x - px * w,
          a.y - py * w,
          e.x,
          e.y,
        );
        g.lineStyle(Math.max(1, S * 0.25), 0xc9b8a8, 1).strokeTriangle(
          a.x + px * w,
          a.y + py * w,
          a.x - px * w,
          a.y - py * w,
          e.x,
          e.y,
        );
        g.fillStyle(0xf2a0b0, 1).fillTriangle(
          a.x + px * w * 0.55,
          a.y + py * w * 0.55,
          a.x - px * w * 0.55,
          a.y - py * w * 0.55,
          q.x,
          q.y,
        );
        if (i === current && !c.cut) {
          g.lineStyle(Math.max(1, S * 0.3), 0xf2c14e, 0.8).strokeCircle(e.x, e.y, S * 1.6);
        }
      });
    };
    drawClaws();

    this.input.on('pointerdown', () => {
      if (this.finished) return;
      const c = claws[current];
      if (!c) return;
      const x = c.bx + c.ux * c.L * pos;
      const y = c.by + c.uy * c.L * pos;
      if (pos > quickPart + 0.06) {
        c.cut = true;
        this.flash(t('MG_SNIP'), x, y - S * 3, '#9ad17b');
        this.sfx('snip', 0.6);
        this.sfx('pluck', 0.3);
        // odstrihnutá špička odletí
        const tip = this.add.circle(x, y, S * 0.6, 0xfdf6ec).setDepth(4);
        this.tweens.add({
          targets: tip,
          y: y + S * 14,
          x: x + c.ux * S * 6,
          alpha: 0,
          duration: 600,
          onComplete: () => tip.destroy(),
        });
        current += 1;
        pos = 0;
        dir = 1;
        this.hearts(1);
        drawClaws();
        if (current >= claws.length)
          this.finish((mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1) as Stars);
      } else {
        mistakes += 1;
        this.flash(t('MG_OUCH'), x, y - S * 3, '#e86a6a');
        this.sfx('error', 0.4);
        this.sfx('mew', 0.5);
        this.cameras.main.shake(120, 0.004);
      }
    });

    this.updater = (dt) => {
      const c = claws[current];
      marker.clear();
      if (!c) return;
      pos += dir * dt * 0.0011;
      if (pos > 1) {
        pos = 1;
        dir = -1;
      } else if (pos < 0) {
        pos = 0;
        dir = 1;
      }
      const x = c.bx + c.ux * c.L * pos;
      const y = c.by + c.uy * c.L * pos;
      const px = -c.uy * S * 2.2;
      const py = c.ux * S * 2.2;
      const good = pos > quickPart + 0.06;
      marker
        .lineStyle(Math.max(2, S * 0.5), good ? 0x9ad17b : 0xe86a6a, 1)
        .lineBetween(x - px, y - py, x + px, y + py);
    };
  }

  // ---------- Inhalácia (nádcha) ----------

  /**
   * Kruh okolo mačky sa zväčšuje (nádych) a zmenšuje (výdych).
   * Hráč drží prst pri nádychu a pustí pri výdychu – tri dychy.
   */
  private breath(): void {
    this.hintText.setText(t('MG_BREATH_HINT'));
    const S = this.S;
    const { cx, cy } = this;
    const half = 1700; // ms nádych, rovnako výdych
    const cycles = 3;
    const { height: H } = this.scale;
    // kruh sa nesmie dotknúť nápovedy hore ani počítadla dychov dole
    const rMax = Math.max(S * 8, Math.min(S * 15, cy - S * 9, H - cy - S * 9));
    const rMin = rMax * 0.55;
    const ring = this.add.graphics().setDepth(5);
    const label = this.text(cx, cy + rMax + S * 2.6, '', S * 2.2, '#f4e6d0', true)
      .setOrigin(0.5)
      .setDepth(6);
    let elapsed = -600; // krátka pauza na začiatku
    let good = 0;
    let total = 0;
    let puffTimer = 0;
    let lastInhale: boolean | null = null;

    this.updater = (dt) => {
      elapsed += dt;
      ring.clear();
      if (elapsed < 0) {
        ring.lineStyle(S * 0.8, 0xf4e6d0, 0.5).strokeCircle(cx, cy, rMin);
        return;
      }
      const phase = (elapsed % (half * 2)) / (half * 2); // 0..1
      const inhale = phase < 0.5;
      const k = inhale ? phase * 2 : 2 - phase * 2; // 0..1..0
      const r = rMin + (rMax - rMin) * Phaser.Math.Easing.Sine.InOut(k);
      const holding = this.input.activePointer.isDown;
      const ok = holding === inhale;
      total += dt;
      if (ok) good += dt;

      if (inhale !== lastInhale) {
        lastInhale = inhale;
        label.setText(t(inhale ? 'MG_BREATH_IN' : 'MG_BREATH_OUT'));
      }
      ring.fillStyle(0xb8d8ff, 0.12).fillCircle(cx, cy, r);
      ring.lineStyle(S * 0.9, ok ? 0x9ad17b : 0xe86a6a, 0.9).strokeCircle(cx, cy, r);
      // dychy, ktoré ešte zostávajú
      const done = Math.floor(elapsed / (half * 2));
      for (let i = 0; i < cycles; i++) {
        ring
          .fillStyle(i < done ? 0x9ad17b : 0x5a4a63, 1)
          .fillCircle(cx + (i - 1) * S * 3, cy + rMax + S * 6, S * 0.9);
      }

      // pára z inhalátora pri správnom nádychu
      puffTimer -= dt;
      if (inhale && holding && puffTimer <= 0) {
        puffTimer = 160;
        const p = this.add
          .circle(cx + Phaser.Math.Between(-S * 6, S * 6), cy + S * 8, S * 1.2, 0xffffff, 0.5)
          .setDepth(4);
        this.tweens.add({
          targets: p,
          y: cy - S * 4,
          scale: 2,
          alpha: 0,
          duration: 900,
          onComplete: () => p.destroy(),
        });
      }

      if (elapsed >= half * 2 * cycles) {
        const ratio = good / Math.max(1, total);
        this.finish((ratio >= 0.8 ? 3 : ratio >= 0.6 ? 2 : 1) as Stars);
      }
    };
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

    let brushTimer = 0;
    this.input.on('pointerdown', () => {
      holding = true;
      brushTimer = 0;
    });
    this.input.on('pointerup', () => {
      if (holding && progress > 0 && progress < duration) releases += 1;
      holding = false;
    });
    let heartTimer = 0;
    this.updater = (dt) => {
      if (holding) {
        progress = Math.min(duration, progress + dt);
        heartTimer += dt;
        brushTimer -= dt;
        if (brushTimer <= 0) {
          brushTimer = 700;
          this.sfx('brush', 0.45);
        }
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

  // ---------- Obväzovanie labky ----------

  /** Hráč krúži prstom okolo labky; každé otočenie = jedna vrstva obväzu. */
  private bandage(): void {
    this.hintText.setText(t('MG_BANDAGE_HINT'));
    this.catSprite.setVisible(false);
    const S = this.S;
    const R = S * 5;
    const { cx, cy } = this;
    const inner = R * 0.8;
    const outer = R * 2.6;

    this.drawPaw(cx, cy, R);

    const guide = this.add.graphics();
    guide.lineStyle(Math.max(2, S / 2), 0xf4e6d0, 0.18).strokeCircle(cx, cy, (inner + outer) / 2);
    const wraps = this.add.graphics().setDepth(2);
    const progressArc = this.add.graphics().setDepth(3);

    let lastAngle: number | null = null;
    let turned = 0;
    let layers = 0;
    let slips = 0;
    let outside = false;

    const addLayer = () => {
      layers += 1;
      const y = cy - R * 0.9 + layers * R * 0.45;
      wraps
        .fillStyle(0xfdfaf2, 0.95)
        .fillRoundedRect(cx - R * 1.35, y, R * 2.7, R * 0.42, R * 0.12);
      wraps
        .lineStyle(Math.max(1, S / 4), 0xd9cbb8, 1)
        .strokeRoundedRect(cx - R * 1.35, y, R * 2.7, R * 0.42, R * 0.12);
      this.sfx('click', 0.5);
      this.hearts(2);
    };

    this.input.on('pointerup', () => (lastAngle = null));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.finished) return;
      const dist = Phaser.Math.Distance.Between(cx, cy, p.x, p.y);
      if (dist < inner || dist > outer) {
        if (!outside) {
          outside = true;
          slips += 1;
          this.flash(t('MG_SLIPPED'), cx, cy - outer, '#e86a6a');
          this.sfx('error', 0.4);
        }
        lastAngle = null;
        return;
      }
      outside = false;
      const angle = Math.atan2(p.y - cy, p.x - cx);
      if (lastAngle !== null) {
        let d = angle - lastAngle;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        turned += Math.abs(d);
      }
      lastAngle = angle;
      while (turned >= Math.PI * 2 && layers < 3) {
        turned -= Math.PI * 2;
        addLayer();
      }
      progressArc.clear();
      progressArc.lineStyle(Math.max(3, S * 0.8), ACCENT, 1);
      progressArc.beginPath();
      progressArc.arc(cx, cy, (inner + outer) / 2, -Math.PI / 2, -Math.PI / 2 + turned);
      progressArc.strokePath();
      if (layers >= 3) {
        progressArc.clear();
        this.finish(Math.max(1, 3 - Math.floor(slips / 2)) as Stars);
      }
    });
  }

  // ---------- Čistenie ušiek ----------

  /** Hráč stiera prstom špinu z ušiek, kým nezmizne všetka. */
  private ears(): void {
    this.hintText.setText(t('MG_EAR_HINT'));
    this.catSprite.anims.stop();
    this.catSprite.setFrame(24);
    const S = this.S;
    const blobs: { g: Phaser.GameObjects.Ellipse; dirt: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const pt = this.pointOnCat(3, 13);
      const g = this.add
        .ellipse(
          pt.x,
          pt.y,
          S * Phaser.Math.FloatBetween(1.6, 2.4),
          S * Phaser.Math.FloatBetween(1.2, 1.8),
          0x6b4a2e,
          0.9,
        )
        .setDepth(5);
      blobs.push({ g, dirt: 1 });
    }
    let elapsed = 0;
    let lastX = 0;
    let lastY = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      lastX = p.x;
      lastY = p.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.finished) return;
      const moved = Phaser.Math.Distance.Between(lastX, lastY, p.x, p.y);
      lastX = p.x;
      lastY = p.y;
      for (const b of blobs) {
        if (b.dirt <= 0) continue;
        if (Phaser.Math.Distance.Between(b.g.x, b.g.y, p.x, p.y) < S * 3) {
          b.dirt -= moved / (S * 12);
          b.g.setAlpha(Math.max(0, b.dirt) * 0.9);
          if (b.dirt <= 0) {
            b.g.destroy();
            this.sfx('drop', 0.45);
          }
        }
      }
      if (blobs.every((b) => b.dirt <= 0)) {
        this.finish((elapsed < 5000 ? 3 : elapsed < 9000 ? 2 : 1) as Stars);
      }
    });
    this.updater = (dt) => (elapsed += dt);
  }

  // ---------- Kvapky do uška (ušné roztoče) ----------

  /**
   * Kvapkadlo sa hojdá nad hlavou mačky. Ťuknúť, keď je nad označeným uškom –
   * kvapka padne. Tri kvapky (ľavé, pravé, ľavé uško).
   */
  private drops(): void {
    this.hintText.setText(t('MG_DROPS_HINT'));
    const S = this.S;
    const { cx, cy } = this;
    const ears = [
      { x: cx - S * 4.5, y: cy - S * 8 },
      { x: cx + S * 4, y: cy - S * 8 },
    ];
    const order = [0, 1, 0];
    const topY = cy - S * 22;
    const g = this.add.graphics().setDepth(5);
    const marker = this.add.graphics().setDepth(4);
    let pos = 0; // −1..1
    let dir = 1;
    let done = 0;
    let misses = 0;
    let falling = false;
    const range = S * 14;

    const drawMarker = () => {
      marker.clear();
      const ear = ears[order[done] ?? 0];
      if (!ear) return;
      marker.lineStyle(Math.max(2, S * 0.4), 0x9ad17b, 0.9).strokeCircle(ear.x, ear.y, S * 2.2);
    };
    drawMarker();

    this.input.on('pointerdown', () => {
      if (this.finished || falling) return;
      const ear = ears[order[done] ?? 0];
      if (!ear) return;
      const x = cx + pos * range;
      const hit = Math.abs(x - ear.x) < S * 2.6;
      falling = true;
      const drop = this.add.circle(x, topY + S * 4, S * 0.8, 0x8fc3f0).setDepth(6);
      this.tweens.add({
        targets: drop,
        y: hit ? ear.y : cy + S * 10,
        duration: 380,
        ease: 'Quad.easeIn',
        onComplete: () => {
          drop.destroy();
          falling = false;
          if (hit) {
            done += 1;
            this.flash(t('MG_GULP'), ear.x, ear.y - S * 4, '#9ad17b');
            this.sfx('drop', 0.5);
            this.hearts(1);
            drawMarker();
            if (done >= order.length)
              this.finish((misses === 0 ? 3 : misses <= 2 ? 2 : 1) as Stars);
          } else {
            misses += 1;
            this.flash(t('MG_MISS'), x, cy + S * 6, '#e86a6a');
            this.sfx('error', 0.4);
          }
        },
      });
    });

    this.updater = (dt) => {
      pos += dir * dt * 0.0016;
      if (pos > 1) {
        pos = 1;
        dir = -1;
      } else if (pos < -1) {
        pos = -1;
        dir = 1;
      }
      const x = cx + pos * range;
      g.clear();
      // kvapkadlo: gumička a sklenená trubička
      g.fillStyle(0xe0525a, 1).fillRoundedRect(
        x - S * 1.2,
        topY - S * 3,
        S * 2.4,
        S * 2.6,
        S * 0.6,
      );
      g.fillStyle(0xd8e6f0, 1).fillRect(x - S * 0.7, topY - S * 0.6, S * 1.4, S * 4);
      g.fillStyle(0x8fc3f0, 1).fillRect(x - S * 0.4, topY + S * 1.4, S * 0.8, S * 1.8);
    };
  }

  // ---------- Očkovanie ----------

  /**
   * Najprv mačku upokojiť hladkaním po hlavičke (držať prst a jemne hýbať),
   * potom ťuknúť na zelený bod na krku, kým svieti.
   */
  private vaccine(): void {
    this.hintText.setText(t('MG_VACCINE_HINT'));
    const S = this.S;
    const { cx, cy } = this;
    const head = { x: cx, y: cy - S * 5, r: S * 7 };
    const spot = { x: cx + S * 4, y: cy + S * 2, r: S * 2.2 };
    const bar = this.add.graphics().setDepth(5);
    const ring = this.add.graphics().setDepth(6);
    const bw = S * 24;
    const by = cy + S * 17;
    let calm = 0; // 0..1
    let spotTime = 0; // ms, kým svieti bod
    let elapsed = 0;
    let misses = 0;
    let lastX = 0;
    let lastY = 0;
    let heartTimer = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      lastX = p.x;
      lastY = p.y;
      if (this.finished) return;
      if (spotTime > 0) {
        if (Phaser.Math.Distance.Between(p.x, p.y, spot.x, spot.y) < spot.r * 1.6) {
          this.sfx('pluck', 0.5);
          this.finish((misses === 0 && elapsed < 9000 ? 3 : misses <= 1 ? 2 : 1) as Stars);
        } else {
          misses += 1;
          this.flash(t('MG_MISS'), p.x, p.y - S * 3, '#e86a6a');
          this.sfx('error', 0.4);
        }
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.finished || spotTime > 0) return;
      const moved = Phaser.Math.Distance.Between(lastX, lastY, p.x, p.y);
      lastX = p.x;
      lastY = p.y;
      if (Phaser.Math.Distance.Between(p.x, p.y, head.x, head.y) < head.r) {
        calm = Math.min(1, calm + moved / (S * 40));
        if (calm >= 1) {
          spotTime = 3500;
          this.flash(t('MG_VACCINE_CALM'), cx, head.y - S * 9, '#9ad17b');
          this.sfx('mewPurr', 0.4);
        }
      }
    });

    this.updater = (dt) => {
      elapsed += dt;
      heartTimer += dt;
      if (spotTime > 0) {
        spotTime -= dt;
        if (spotTime <= 0) calm = 0.5; // zmeškané – mačka sa trochu zavrtela, treba ju znova pohladkať
      }
      // Držanie prsta na hlavičke upokojuje aj bez pohybu (pohyb to urýchli)
      const ptr = this.input.activePointer;
      if (
        spotTime <= 0 &&
        ptr.isDown &&
        Phaser.Math.Distance.Between(ptr.x, ptr.y, head.x, head.y) < head.r
      ) {
        calm = Math.min(1, calm + dt / 2200);
        if (calm >= 1) {
          spotTime = 3500;
          this.flash(t('MG_VACCINE_CALM'), cx, head.y - S * 9, '#9ad17b');
          this.sfx('mewPurr', 0.4);
        }
      }
      if (calm > 0 && spotTime <= 0 && heartTimer > 600 && this.input.activePointer.isDown) {
        heartTimer = 0;
        this.hearts(1);
      }
      bar.clear();
      bar.fillStyle(0x3b2f45, 1).fillRoundedRect(cx - bw / 2, by, bw, S * 2, S);
      bar
        .fillStyle(0x9ad17b, 1)
        .fillRoundedRect(cx - bw / 2, by, Math.max(S * 2, bw * calm), S * 2, S);
      ring.clear();
      if (spotTime <= 0) {
        ring.lineStyle(Math.max(2, S * 0.3), 0xf4e6d0, 0.35).strokeCircle(head.x, head.y, head.r);
      } else {
        const pulse = 1 + Math.sin(elapsed / 120) * 0.15;
        ring.fillStyle(0x9ad17b, 0.85).fillCircle(spot.x, spot.y, spot.r * pulse);
        ring
          .lineStyle(Math.max(2, S * 0.3), 0xffffff, 0.9)
          .strokeCircle(spot.x, spot.y, spot.r * pulse);
      }
    };
  }

  // ---------- Sirup ----------

  /** Ťuknúť, keď je ukazovateľ v zelenom poli – tri lyžičky sirupu. */
  private syrup(): void {
    this.hintText.setText(t('MG_SYRUP_HINT'));
    const S = this.S;
    const { width: W, height: H } = this.scale;
    const bw = Math.min(W * 0.8, S * 50);
    const bx = (W - bw) / 2;
    const by = Math.min(H * 0.82, this.cy + S * 18);
    const bh = S * 2.4;
    const bar = this.add.graphics().setDepth(5);
    const zoneW = bw * 0.22;
    let zoneX = bx + Phaser.Math.FloatBetween(0, bw - zoneW);
    let pos = 0; // 0..1
    let dir = 1;
    let hits = 0;
    let misses = 0;
    const speed = 1 / 1300; // celá dĺžka za 1,3 s

    this.input.on('pointerdown', () => {
      if (this.finished) return;
      const mx = bx + pos * bw;
      if (mx >= zoneX && mx <= zoneX + zoneW) {
        hits += 1;
        this.flash(t('MG_GULP'), this.cx, this.cy - S * 14, '#9ad17b');
        const spoon = this.text(mx, by, '🥄', S * 3, '#ffffff')
          .setOrigin(0.5)
          .setDepth(6);
        this.tweens.add({
          targets: spoon,
          x: this.cx,
          y: this.cy + S * 2,
          alpha: 0,
          duration: 350,
          onComplete: () => spoon.destroy(),
        });
        this.sfx('mewFood', 0.5);
        this.hearts(2);
        zoneX = bx + Phaser.Math.FloatBetween(0, bw - zoneW);
        if (hits >= 3) this.finish((misses === 0 ? 3 : misses <= 2 ? 2 : 1) as Stars);
      } else {
        misses += 1;
        this.flash(t('MG_MISS'), mx, by - S * 3, '#e86a6a');
        this.sfx('error', 0.4);
      }
    });

    this.updater = (dt) => {
      pos += dir * dt * speed;
      if (pos > 1) {
        pos = 1;
        dir = -1;
      } else if (pos < 0) {
        pos = 0;
        dir = 1;
      }
      bar.clear();
      bar.fillStyle(0x3b2f45, 1).fillRoundedRect(bx, by, bw, bh, bh / 2);
      bar.fillStyle(0x9ad17b, 1).fillRoundedRect(zoneX, by, zoneW, bh, bh / 2);
      const mx = bx + pos * bw;
      bar.fillStyle(0xf4e6d0, 1).fillRect(mx - S * 0.4, by - S, S * 0.8, bh + S * 2);
      // lyžičky, ktoré ešte treba podať
      for (let i = 0; i < 3; i++) {
        bar
          .fillStyle(i < hits ? 0x9ad17b : 0x5a4a63, 1)
          .fillCircle(this.cx + (i - 1) * S * 3, by + bh + S * 3, S * 0.9);
      }
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

  // ---------- Klinika: krvný test (GDD §6.5) ----------

  /** V mikroskope plávajú bunky – ťuknúť na 3 zvláštne (fialové s výbežkami). */
  private bloodtest(): void {
    this.hintText.setText(t('MG_BLOOD_HINT'));
    this.catSprite.setVisible(false);
    const { width: W, height: H } = this.scale;
    const S = this.S;
    const { cx, cy } = this;
    const R = Math.min(W * 0.42, H * 0.3);
    const cellR = Math.max(S * 1.4, R * 0.075);
    const g = this.add.graphics().setDepth(3);
    const label = this.text(cx, cy + R + S * 3, '', S * 2.2, TEXT, true).setOrigin(0.5, 0);
    type Cell = { x: number; y: number; vx: number; vy: number; odd: boolean; alive: boolean };
    const cells: Cell[] = [];
    const spawn = (odd: boolean): Cell => {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (R - cellR * 2);
      const sp = (odd ? 0.05 : 0.03) * (R / 150);
      const d = Math.random() * Math.PI * 2;
      return {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: Math.cos(d) * sp,
        vy: Math.sin(d) * sp,
        odd,
        alive: true,
      };
    };
    for (let i = 0; i < 22; i++) cells.push(spawn(false));
    for (let i = 0; i < 3; i++) cells.push(spawn(true));
    let found = 0;
    let misses = 0;
    let elapsed = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.finished) return;
      if (Phaser.Math.Distance.Between(p.x, p.y, cx, cy) > R) return;
      const hit = cells.find(
        (c) => c.odd && c.alive && Phaser.Math.Distance.Between(p.x, p.y, c.x, c.y) < cellR * 1.8,
      );
      if (hit) {
        hit.alive = false;
        found += 1;
        this.flash('✓', hit.x, hit.y - cellR * 2, '#9ad17b');
        this.sfx('pluck', 0.5);
        this.hearts(1);
        if (found >= 3)
          this.finish((misses === 0 && elapsed < 15000 ? 3 : misses <= 2 ? 2 : 1) as Stars);
      } else {
        misses += 1;
        this.flash(t('MG_MISS'), p.x, p.y - S * 3, '#e86a6a');
        this.sfx('error', 0.4);
      }
    });

    this.updater = (dt) => {
      elapsed += dt;
      g.clear();
      g.fillStyle(0x1d1824, 1).fillCircle(cx, cy, R + S * 1.2);
      g.fillStyle(0xf6e7ea, 1).fillCircle(cx, cy, R);
      for (const c of cells) {
        if (!c.alive) continue;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const dx = c.x - cx;
        const dy = c.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > R - cellR) {
          // odraz od okraja zorného poľa
          const nx = dx / dist;
          const ny = dy / dist;
          const dot = c.vx * nx + c.vy * ny;
          c.vx -= 2 * dot * nx;
          c.vy -= 2 * dot * ny;
          c.x = cx + nx * (R - cellR);
          c.y = cy + ny * (R - cellR);
        }
        if (c.odd) {
          g.lineStyle(Math.max(2, cellR * 0.22), 0x5a4aa8, 1);
          for (let k = 0; k < 6; k++) {
            const a = k * 1.05 + elapsed / 900;
            g.lineBetween(
              c.x + Math.cos(a) * cellR,
              c.y + Math.sin(a) * cellR,
              c.x + Math.cos(a) * cellR * 1.45,
              c.y + Math.sin(a) * cellR * 1.45,
            );
          }
          g.fillStyle(0x8a7ad8, 1).fillCircle(c.x, c.y, cellR);
          g.fillStyle(0x5a4aa8, 1).fillCircle(c.x + cellR * 0.2, c.y - cellR * 0.1, cellR * 0.4);
        } else {
          g.fillStyle(0xc4606d, 1).fillCircle(c.x, c.y, cellR);
          g.fillStyle(0xe88a95, 1).fillCircle(c.x, c.y, cellR * 0.82);
          g.fillStyle(0xf2b0b8, 1).fillCircle(c.x, c.y, cellR * 0.35);
        }
      }
      label.setText(t('MG_BLOOD_FOUND', { n: found }));
    };
  }

  // ---------- Klinika: röntgen ----------

  /**
   * 1) Podržať rám nad mačkou, kým chvíľu obsedí. 2) Na snímke ťuknúť, kde je problém
   * (zlomenina alebo prehltnutý predmet). Ak nič nie je, snímka sa iba ukáže.
   */
  private xray(): void {
    this.hintText.setText(t('MG_XRAY_HINT_FRAME'));
    const S = this.S;
    const { cx, cy } = this;
    const fw = S * 22;
    const fh = S * 20;
    const frame = this.add.graphics().setDepth(6);
    const bar = this.add.graphics().setDepth(6);
    const bw = S * 24;
    const by = cy + S * 17;
    let fx = cx;
    let fy = cy;
    let progress = 0;
    let elapsed = 0;
    let phase: 'frame' | 'find' | 'done' = 'frame';
    let misses = 0;
    const finding = this.cfg.xray ?? null;
    const u = Math.min(S * 1.1, (this.scale.width * 0.9) / 30);
    const target =
      finding === 'fracture'
        ? { x: cx + 4 * u, y: cy + 4 * u }
        : finding === 'swallowed'
          ? { x: cx - 1 * u, y: cy - 0.5 * u }
          : null;

    const showImage = () => {
      phase = 'find';
      frame.clear();
      bar.clear();
      this.catSprite.setVisible(false);
      const img = this.add.graphics().setDepth(4);
      // snímka je väčšia ako rám – celá kostra sa do nej zmestí
      const iw = 30 * u;
      const ih = 23 * u;
      const ix = cx - 0.5 * u - iw / 2;
      const iy = cy - 1.5 * u - ih / 2;
      img.fillStyle(0x1d1824, 1).fillRect(ix - S, iy - S, iw + S * 2, ih + S * 2);
      img.fillStyle(0x22304a, 1).fillRect(ix, iy, iw, ih);
      const sk = 0xdfe8f2;
      const lw = Math.max(2, u * 0.45);
      img.lineStyle(lw, sk, 1);
      img.strokeCircle(cx + 9 * u, cy - 6 * u, 3 * u); // lebka
      img.strokeTriangle(
        cx + 7 * u,
        cy - 8.5 * u,
        cx + 7.5 * u,
        cy - 11 * u,
        cx + 9 * u,
        cy - 9 * u,
      );
      img.strokeTriangle(
        cx + 11 * u,
        cy - 8.5 * u,
        cx + 10.5 * u,
        cy - 11 * u,
        cx + 9 * u,
        cy - 9 * u,
      );
      img.lineBetween(cx - 9 * u, cy - 4 * u, cx + 6.5 * u, cy - 4 * u); // chrbtica
      for (let k = 0; k < 6; k++) {
        const rx = cx - 4 * u + k * 1.4 * u;
        img.beginPath();
        img.arc(rx, cy - 4 * u, 0.7 * u, 0, Math.PI, false);
        img.strokePath();
        img.lineBetween(rx - 0.7 * u, cy - 4 * u, rx - 0.7 * u, cy + 1 * u);
      }
      img.strokeEllipse(cx - 8 * u, cy - 3 * u, 3 * u, 2 * u); // panva
      for (const lx of [cx - 8.5 * u, cx - 7 * u, cx + 3.5 * u, cx + 5 * u])
        img.lineBetween(lx, cy - 3.5 * u, lx, cy + 8 * u);
      img.beginPath(); // chvost
      img.moveTo(cx - 9 * u, cy - 4 * u);
      img.lineTo(cx - 12 * u, cy - 6 * u);
      img.lineTo(cx - 13 * u, cy - 9 * u);
      img.strokePath();
      if (finding === 'fracture') {
        img.fillStyle(0x22304a, 1).fillRect(cx + 4.5 * u, cy + 3.5 * u, 1.2 * u, 1 * u);
        img
          .lineStyle(lw, sk, 1)
          .lineBetween(cx + 4.4 * u, cy + 4.6 * u, cx + 5.6 * u, cy + 3.7 * u);
      }
      if (finding === 'swallowed') {
        img
          .fillStyle(0xff8a5a, 1)
          .fillRoundedRect(cx - 2 * u, cy - 1.2 * u, 2.2 * u, 1.4 * u, u * 0.4);
      }
      this.sfx('click', 0.5);
      if (!target) {
        this.hintText.setText(t('MG_XRAY_CLEAR'));
        phase = 'done';
        this.time.delayedCall(1600, () =>
          this.finish(elapsed < 6000 ? 3 : elapsed < 10000 ? 2 : 1),
        );
      } else this.hintText.setText(t('MG_XRAY_HINT_FIND'));
    };

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.finished || phase !== 'find' || !target) return;
      if (Phaser.Math.Distance.Between(p.x, p.y, target.x, target.y) < S * 3.5) {
        phase = 'done';
        const ring = this.add.graphics().setDepth(7);
        ring.lineStyle(Math.max(3, S * 0.5), 0x9ad17b, 1).strokeCircle(target.x, target.y, S * 3);
        this.sfx('found', 0.5);
        this.finish((misses === 0 && elapsed < 10000 ? 3 : misses <= 1 ? 2 : 1) as Stars);
      } else {
        misses += 1;
        this.flash(t('MG_MISS'), p.x, p.y - S * 3, '#e86a6a');
        this.sfx('error', 0.4);
      }
    });

    this.updater = (dt) => {
      if (phase !== 'frame') return;
      elapsed += dt;
      // mačka sa vrtí zo strany na stranu
      const catX = cx + Math.sin(elapsed / 900) * S * 9 + Math.sin(elapsed / 330) * S * 2.5;
      this.catSprite.x = catX;
      const ptr = this.input.activePointer;
      if (ptr.isDown) {
        fx = ptr.x;
        fy = ptr.y;
      }
      const inside =
        ptr.isDown && Math.abs(catX - fx) < fw / 2 - S * 6 && Math.abs(cy - fy) < fh / 2 - S * 4;
      progress = inside ? Math.min(1, progress + dt / 1800) : Math.max(0, progress - dt / 2500);
      frame.clear();
      frame.lineStyle(Math.max(3, S * 0.5), inside ? 0x9ad17b : 0xf2c14e, 1);
      frame.strokeRect(fx - fw / 2, fy - fh / 2, fw, fh);
      bar.clear();
      bar.fillStyle(0x3b2f45, 1).fillRoundedRect(cx - bw / 2, by, bw, S * 2, S);
      bar
        .fillStyle(0x9ad17b, 1)
        .fillRoundedRect(cx - bw / 2, by, Math.max(S * 2, bw * progress), S * 2, S);
      if (progress >= 1) {
        this.catSprite.x = cx;
        showImage();
      }
    };
  }

  // ---------- Klinika: operácia ----------

  /**
   * Tri kroky: uspať (držať ručičku v zelenom), vybrať predmet pinzetou (pomaly),
   * zašiť ťukaním na bodky zľava doprava. Kastrácia nemá krok s pinzetou.
   */
  private surgery(): void {
    const S = this.S;
    const { width: W } = this.scale;
    const { cx, cy } = this;
    const steps: ('sleep' | 'extract' | 'stitch')[] = this.cfg.neuter
      ? ['sleep', 'stitch']
      : ['sleep', 'extract', 'stitch'];
    let stepIdx = 0;
    let faults = 0;
    const layer = this.add.container(0, 0).setDepth(5);
    let stepUpdate: ((dt: number) => void) | null = null;
    let onDown: ((p: Phaser.Input.Pointer) => void) | null = null;
    let stepLabel = '';
    const hint = (key: string) => this.hintText.setText(`${stepLabel} · ${t(key)}`);

    const next = () => {
      layer.removeAll(true);
      stepUpdate = null;
      onDown = null;
      const kind = steps[stepIdx];
      if (!kind) {
        this.finish((faults === 0 ? 3 : faults <= 2 ? 2 : 1) as Stars);
        return;
      }
      stepLabel = t('MG_SURG_STEP', { n: stepIdx + 1, total: steps.length });
      if (kind === 'sleep') sleep();
      else if (kind === 'extract') extract();
      else stitch();
    };
    const done = () => {
      stepIdx += 1;
      this.hearts(2);
      this.sfx('success', 0.3);
      this.time.delayedCall(400, next);
    };

    /** Rúško s operačným poľom cez mačku. */
    const field = () => {
      const g = this.add.graphics();
      g.fillStyle(0x5a8ac0, 1).fillRoundedRect(cx - S * 20, cy - S * 9, S * 40, S * 20, S * 2);
      g.fillStyle(0xe8c39a, 1).fillEllipse(cx, cy + S, S * 26, S * 13);
      g.lineStyle(Math.max(2, S * 0.3), 0xb08860, 1).strokeEllipse(cx, cy + S, S * 26, S * 13);
      layer.add(g);
      return g;
    };

    const sleep = () => {
      hint('MG_SURG_SLEEP');
      this.catSprite.setVisible(true).setY(cy - S * 3);
      const g = this.add.graphics();
      layer.add(g);
      const mw = Math.min(W * 0.8, S * 40);
      const mx = cx - mw / 2;
      const my = cy + S * 16;
      let v = 0.15;
      let inZone = 0;
      let left = false;
      let elapsed = 0;
      const zone: [number, number] = [0.45, 0.72];
      stepUpdate = (dt) => {
        elapsed += dt;
        const down = this.input.activePointer.isDown;
        v += (down ? dt / 1100 : -dt / 1300) + Math.sin(elapsed / 260) * 0.0012 * dt;
        v = Phaser.Math.Clamp(v, 0, 1);
        const ok = v >= zone[0] && v <= zone[1];
        if (ok) {
          inZone += dt;
          left = true;
        } else if (left) {
          left = false;
          faults += 0.5;
        }
        g.clear();
        g.fillStyle(0x10202a, 1).fillRoundedRect(mx, my - S * 7, mw, S * 6, S);
        g.lineStyle(Math.max(2, S * 0.3), 0x6ee08a, 1);
        g.beginPath();
        for (let i = 0; i <= 30; i++) {
          const x = mx + S + ((mw - S * 2) * i) / 30;
          const beat = (i + Math.floor(elapsed / 80)) % 10 === 0 ? -S * 2 * (0.5 + v) : 0;
          if (i === 0) g.moveTo(x, my - S * 4 + beat);
          else g.lineTo(x, my - S * 4 + beat);
        }
        g.strokePath();
        g.fillStyle(0x5a3a4a, 1).fillRoundedRect(mx, my, mw, S * 2, S);
        g.fillStyle(0x3d8a5a, 1).fillRect(mx + mw * zone[0], my, mw * (zone[1] - zone[0]), S * 2);
        g.fillStyle(0xffffff, 1).fillTriangle(
          mx + mw * v,
          my - S * 0.2,
          mx + mw * v - S,
          my - S * 1.6,
          mx + mw * v + S,
          my - S * 1.6,
        );
        g.fillStyle(0x9ad17b, 1).fillRect(
          mx,
          my + S * 2.6,
          mw * Math.min(1, inZone / 2500),
          S * 0.6,
        );
        if (inZone >= 2500) {
          this.catSprite.play(catAnimKey(this.cfg.cat.sprite, 'lay_idle', 'down'));
          done();
        }
      };
    };

    const extract = () => {
      hint('MG_SURG_EXTRACT');
      this.catSprite.setVisible(false);
      field();
      const woundR = S * 4;
      const wound = this.add.graphics();
      wound.fillStyle(0xa8404d, 1).fillEllipse(cx, cy + S, woundR * 2.4, woundR * 1.4);
      layer.add(wound);
      const obj = this.add
        .rectangle(cx, cy + S, S * 2.4, S * 1.6, 0xff8a5a)
        .setStrokeStyle(Math.max(1, S * 0.25), 0x8a3a1a);
      obj.setInteractive({ draggable: true, useHandCursor: true });
      layer.add(obj);
      const maxSpeed = S * 0.08;
      let lastX = 0;
      let lastY = 0;
      let lastT = 0;
      obj.on('dragstart', (p: Phaser.Input.Pointer) => {
        lastX = p.x;
        lastY = p.y;
        lastT = this.time.now;
      });
      obj.on('drag', (p: Phaser.Input.Pointer) => {
        const dtm = Math.max(1, this.time.now - lastT);
        const speed = Phaser.Math.Distance.Between(lastX, lastY, p.x, p.y) / dtm;
        lastX = p.x;
        lastY = p.y;
        lastT = this.time.now;
        if (speed > maxSpeed) {
          faults += 1;
          this.input.setDragState(p, 0);
          obj.setPosition(cx, cy + S);
          this.flash(t('MG_SLIPPED'), cx, cy - S * 4, '#e86a6a');
          this.sfx('error', 0.4);
          return;
        }
        obj.setPosition(p.x, p.y);
        if (Phaser.Math.Distance.Between(cx, cy + S, p.x, p.y) > S * 9) {
          obj.disableInteractive();
          this.input.setDragState(p, 0);
          this.sfx('pluck', 0.6);
          this.tweens.add({ targets: obj, alpha: 0, y: obj.y - S * 4, duration: 350 });
          done();
        }
      });
      obj.on('dragend', () => {
        if (obj.input?.enabled) this.tweens.add({ targets: obj, x: cx, y: cy + S, duration: 160 });
      });
    };

    const stitch = () => {
      hint('MG_SURG_STITCH');
      this.catSprite.setVisible(false);
      field();
      const cut = this.add.graphics();
      const x0 = cx - S * 9;
      const x1 = cx + S * 9;
      const y = cy + S;
      cut.lineStyle(Math.max(3, S * 0.6), 0xc4606d, 1).lineBetween(x0, y, x1, y);
      layer.add(cut);
      const n = 5;
      const dots = Array.from({ length: n }, (_, i) => ({
        x: x0 + S + ((x1 - x0 - S * 2) * i) / (n - 1),
        y,
      }));
      const marks = this.add.graphics();
      layer.add(marks);
      let at = 0;
      const draw = () => {
        marks.clear();
        dots.forEach((d, i) => {
          if (i < at) {
            marks.lineStyle(Math.max(2, S * 0.45), 0x3b2f45, 1);
            marks.lineBetween(d.x - S, d.y - S * 1.4, d.x + S, d.y + S * 1.4);
          } else {
            marks.lineStyle(Math.max(2, S * 0.4), i === at ? 0xf2c14e : 0x9a8aa8, 1);
            marks.strokeCircle(d.x, d.y, S * 0.9);
          }
        });
      };
      draw();
      onDown = (p) => {
        const d = dots[at];
        if (!d) return;
        if (Phaser.Math.Distance.Between(p.x, p.y, d.x, d.y) < S * 2.2) {
          at += 1;
          this.sfx('click', 0.5);
          draw();
          if (at >= n) done();
        } else {
          faults += 1;
          this.flash(t('MG_MISS'), p.x, p.y - S * 3, '#e86a6a');
          this.sfx('error', 0.4);
        }
      };
    };

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.finished) onDown?.(p);
    });
    this.updater = (dt) => stepUpdate?.(dt);
    next();
  }

  // ---------- Klinika: dlaha ----------

  /** Krúživým ťahom omotať labku – príliš rýchlo = príliš tesne (ukazovateľ tlaku). */
  private splint(): void {
    this.hintText.setText(t('MG_SPLINT_HINT'));
    this.catSprite.setVisible(false);
    const S = this.S;
    const { cx, cy } = this;
    const legW = S * 9;
    const legH = S * 26;
    const top = cy - legH / 2;
    const leg = this.add.graphics();
    leg.fillStyle(0xd9b38c, 1).fillRoundedRect(cx - legW / 2, top, legW, legH, legW / 2);
    leg.fillStyle(0xd9b38c, 1).fillEllipse(cx, top + legH, legW * 1.5, legW * 0.9);
    leg.fillStyle(0xe8a0a0, 1).fillEllipse(cx, top + legH + S, legW * 0.7, legW * 0.35);
    // dlaha (dlhá doštička vedľa labky)
    leg
      .fillStyle(0xc9a06a, 1)
      .fillRect(cx + legW / 2 - S * 0.5, top + S * 3, S * 1.4, legH - S * 6);
    const wraps = this.add.graphics().setDepth(2);
    const ring = this.add.graphics().setDepth(1);
    const meter = this.add.graphics().setDepth(3);
    const inner = legW * 0.4;
    const outer = legH * 0.75;
    const need = 4;
    let layers = 0;
    let turned = 0;
    let lastAngle: number | null = null;
    let lastT = 0;
    let pressure = 0; // vyhladená uhlová rýchlosť, 0..1+
    let tight = 0;
    const tooTight = 1;

    ring.lineStyle(Math.max(2, S / 2), 0xf4e6d0, 0.18).strokeCircle(cx, cy, (inner + outer) / 2);
    const addLayer = () => {
      layers += 1;
      const y = top + S * 3 + (layers - 1) * ((legH - S * 8) / (need - 1));
      wraps
        .fillStyle(0xfdfaf2, 0.97)
        .fillRoundedRect(cx - legW * 0.65, y, legW * 1.3, S * 2.6, S * 0.6);
      wraps
        .lineStyle(Math.max(1, S / 4), 0xd9cbb8, 1)
        .strokeRoundedRect(cx - legW * 0.65, y, legW * 1.3, S * 2.6, S * 0.6);
      this.sfx('click', 0.5);
      this.hearts(2);
    };

    this.input.on('pointerup', () => (lastAngle = null));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.finished) return;
      const dist = Phaser.Math.Distance.Between(cx, cy, p.x, p.y);
      if (dist < inner || dist > outer) {
        lastAngle = null;
        return;
      }
      const angle = Math.atan2(p.y - cy, p.x - cx);
      const now = this.time.now;
      if (lastAngle !== null) {
        let d = angle - lastAngle;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        const speed = Math.abs(d) / Math.max(8, now - lastT); // rad/ms
        pressure = pressure * 0.7 + (speed / 0.012) * 0.3;
        if (pressure > tooTight) {
          tight += 1;
          turned = Math.max(0, turned - Math.PI);
          pressure = 0.4;
          this.flash(t('MG_TOO_TIGHT'), cx, top - S * 3, '#e86a6a');
          this.sfx('mew', 0.4);
        } else turned += Math.abs(d);
      }
      lastAngle = angle;
      lastT = now;
      while (turned >= Math.PI * 2 && layers < need) {
        turned -= Math.PI * 2;
        addLayer();
      }
      if (layers >= need) this.finish((tight === 0 ? 3 : tight <= 2 ? 2 : 1) as Stars);
    });

    const mx = cx + outer + S * 2;
    const mh = S * 20;
    const my = cy - mh / 2;
    this.updater = (dt) => {
      pressure = Math.max(0, pressure - dt / 1500);
      meter.clear();
      meter.lineStyle(Math.max(1, S / 4), 0xf4e6d0, 1).strokeRect(mx, my, S * 2, mh);
      meter.fillStyle(0x3d8a5a, 0.6).fillRect(mx, my + mh * 0.3, S * 2, mh * 0.45);
      const level = Math.min(1, pressure / tooTight);
      meter.fillStyle(level > 0.85 ? 0xe86a6a : level > 0.6 ? 0xf2c14e : 0x9ad17b, 1);
      meter.fillRect(mx + S * 0.3, my + mh * (1 - level), S * 1.4, mh * level);
      ring.clear();
      ring.lineStyle(Math.max(2, S / 2), 0xf4e6d0, 0.18).strokeCircle(cx, cy, (inner + outer) / 2);
      ring.lineStyle(Math.max(3, S * 0.8), ACCENT, 1);
      ring.beginPath();
      ring.arc(cx, cy, (inner + outer) / 2, -Math.PI / 2, -Math.PI / 2 + turned);
      ring.strokePath();
    };
  }
}
