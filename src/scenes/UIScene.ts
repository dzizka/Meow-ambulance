import Phaser from 'phaser';
import { FONT_FAMILY } from '../assets';
import type { GameState } from '../core/GameState';
import type { GameSpeed } from '../core/TimeManager';
import type { CatData, CatStats, GameData } from '../data/types';
import { t } from '../i18n/t';
import { catAnimKey } from './catAnims';
import type { GarageScene } from './GarageScene';
import { computeLayout, type Layout } from './layout';

const COLORS = {
  panel: 0x3b2f45,
  panelBorder: 0xe8a87c,
  text: '#f4e6d0',
  dim: '#b9a8b8',
  accent: '#e8a87c',
  barBg: 0x2b2533,
};

const STAT_COLORS: Record<keyof CatStats, number> = {
  health: 0xe86a6a,
  cleanliness: 0x7ec8e3,
  trust: 0xf2c14e,
  satisfaction: 0x9ad17b,
};

const STAT_KEYS: Record<keyof CatStats, string> = {
  health: 'STAT_HEALTH',
  cleanliness: 'STAT_CLEANLINESS',
  trust: 'STAT_TRUST',
  satisfaction: 'STAT_SATISFACTION',
};

/**
 * Rozhranie v pixeloch obrazovky (bez priblíženia), aby bol text ostrý aj na mobile:
 * horný panel (deň, čas, peniaze), ovládanie rýchlosti a zvuku, karta vybranej mačky.
 */
export class UIScene extends Phaser.Scene {
  private state!: GameState;
  private layout!: Layout;
  private hud: Phaser.GameObjects.GameObject[] = [];
  private card: Phaser.GameObjects.GameObject[] = [];
  private clockText?: Phaser.GameObjects.Text;
  private moneyText?: Phaser.GameObjects.Text;
  private speedButtons: { speed: GameSpeed; text: Phaser.GameObjects.Text }[] = [];
  private selectedId: string | null = null;
  private music?: Phaser.Sound.BaseSound;
  private muted = false;
  private cardRect: Phaser.Geom.Rectangle | null = null;

  constructor() {
    super('UI');
  }

  create(): void {
    this.state = this.registry.get('state') as GameState;
    const bus = this.state.bus;
    const unsubs = [
      bus.on('catSelected', ({ catId }) => {
        this.selectedId = catId;
        if (catId) this.sound.play('select', { volume: 0.4 });
        this.buildCard();
      }),
      bus.on('dayStarted', () => this.updateHud()),
    ];
    this.events.once('shutdown', () => unsubs.forEach((u) => u()));

    try {
      this.muted = localStorage.getItem('meow:muted') === '1';
    } catch {
      /* úložisko nemusí byť dostupné */
    }
    // Prehliadače dovolia zvuk až po prvom dotyku
    this.input.once('pointerdown', () => this.startMusic());

    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
    this.rebuild();
  }

  override update(): void {
    this.updateHud();
  }

  /** Je bod (v pixeloch obrazovky) nad rozhraním? Vtedy garáž ťuk/ťahanie ignoruje. */
  blocksPointer(x: number, y: number): boolean {
    if (this.cardRect?.contains(x, y)) return true;
    return this.hud.some(
      (o) => o instanceof Phaser.GameObjects.Text && o.getBounds().contains(x, y),
    );
  }

  private rebuild(): void {
    this.layout = computeLayout(this.scale.width, this.scale.height);
    this.cameras.main.setViewport(0, 0, this.layout.width, this.layout.height);
    this.buildHud();
    this.buildCard();
  }

  private text(x: number, y: number, value: string, size = 1, color = COLORS.text, bold = false) {
    return this.add.text(x, y, value, {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.round(this.layout.font * size)}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
    });
  }

  private button(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const pad = Math.round(this.layout.font * 0.45);
    const b = this.text(x, y, label, 0.95)
      .setPadding(pad + 2, pad, pad + 2, pad)
      .setBackgroundColor('#3b2f45')
      .setInteractive({ useHandCursor: true });
    b.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.sound.play('click', { volume: 0.5 });
        onClick();
      },
    );
    return b;
  }

  private panel(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const r = Math.round(this.layout.font * 0.5);
    g.fillStyle(COLORS.panel, 0.94).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(2, COLORS.panelBorder, 1).strokeRoundedRect(x, y, w, h, r);
    return g;
  }

  private buildHud(): void {
    this.hud.forEach((o) => o.destroy());
    this.hud = [];
    this.speedButtons = [];
    const f = this.layout.font;
    const m = Math.round(f * 0.6);

    this.clockText = this.text(m, m, '', 1, COLORS.text, true)
      .setPadding(Math.round(f * 0.6), Math.round(f * 0.35))
      .setBackgroundColor('#3b2f45');
    this.moneyText = this.text(0, m, '', 1, COLORS.accent, true)
      .setPadding(Math.round(f * 0.6), Math.round(f * 0.35))
      .setBackgroundColor('#3b2f45');
    this.hud.push(this.clockText, this.moneyText);

    // Rýchlosť času a zvuk – na šírku vpravo hore, na výšku vpravo dole pod garážou
    let x = this.layout.width - m;
    const sound = this.button(0, 0, this.muted ? '♪ ✕' : '♪', () => this.toggleMute());
    x -= sound.width;
    sound.setX(x);
    this.hud.push(sound);
    const speeds: [GameSpeed, string][] = [
      [3, '3×'],
      [2, '2×'],
      [1, '1×'],
      [0, '❚❚'],
    ];
    for (const [speed, label] of speeds) {
      const b = this.button(0, 0, label, () => {
        this.state.time.setSpeed(speed);
        this.updateHud();
      });
      x -= b.width + Math.round(f * 0.3);
      b.setX(x);
      this.speedButtons.push({ speed, text: b });
      this.hud.push(b);
    }

    const controlsY = this.layout.portrait ? this.layout.worldScreenH - sound.height - m : m;
    sound.setY(controlsY);
    this.speedButtons.forEach(({ text }) => text.setY(controlsY));

    // Ukážka: vymeniť mačku za novú (ladiaca funkcia, v hre nebude)
    const next = this.button(m, 0, '+ 🐾', () =>
      (this.scene.get('Garage') as GarageScene).replaceOldestCat(),
    );
    next.setY(
      (this.layout.portrait ? this.layout.worldScreenH : this.layout.height) - next.height - m,
    );
    this.hud.push(next);

    this.updateHud();
  }

  private updateHud(): void {
    if (!this.clockText || !this.moneyText) return;
    const time = this.state.time;
    const clock = `${t('UI_DAY', { day: time.day })}  ${time.clock}`;
    if (this.clockText.text !== clock) this.clockText.setText(clock);
    const money = `${this.state.money} €  ★ ${this.state.reputation}`;
    if (this.moneyText.text !== money) {
      this.moneyText.setText(money);
    }
    this.moneyText.setX(
      this.clockText.x + this.clockText.width + Math.round(this.layout.font * 0.4),
    );
    for (const { speed, text } of this.speedButtons) {
      text.setBackgroundColor(time.speed === speed ? '#e8a87c' : '#3b2f45');
      text.setColor(time.speed === speed ? '#2b2533' : COLORS.text);
    }
  }

  private buildCard(): void {
    this.card.forEach((o) => o.destroy());
    this.card = [];
    this.cardRect = null;
    const cat = this.selectedId ? this.state.getCat(this.selectedId) : undefined;
    const { panel: p, portrait } = this.layout;

    if (!cat) {
      if (portrait) {
        const h = Math.round(this.layout.font * 3.4);
        this.card.push(this.panel(p.x, p.y, p.w, h));
        this.cardRect = new Phaser.Geom.Rectangle(p.x, p.y, p.w, h);
        this.card.push(
          this.text(p.x + p.w / 2, p.y + h / 2, t('UI_TAP_CAT'), 1.1, COLORS.dim).setOrigin(0.5),
        );
      }
      return;
    }
    // Panel sa kreslí až podľa výšky obsahu, pod obsah
    const bottom = this.fillCard(cat, this.state.data);
    const h = Math.min(p.h, bottom - p.y + Math.round(this.layout.font * 0.9));
    const bg = this.panel(p.x, p.y, p.w, h).setDepth(-1);
    this.cardRect = new Phaser.Geom.Rectangle(p.x, p.y, p.w, h);
    this.card.push(bg);
  }

  /** Vyplní kartu mačky a vráti y spodného okraja obsahu. */
  private fillCard(cat: CatData, data: GameData): number {
    const { panel: p, font: f } = this.layout;
    const pad = Math.round(f * 0.9);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.card.push(o);
      return o;
    };

    // Portrét mačky
    const scale = Math.max(2, Math.floor(f / 6));
    const portrait = add(
      this.add.sprite(p.x + pad + 16 * scale, p.y + pad + 14 * scale, cat.sprite, 24),
    );
    portrait.setScale(scale).play(catAnimKey(cat.sprite, 'sit_idle', 'down'));
    if (cat.stats.cleanliness < 30) portrait.setTint(0xa89a8c);

    const tx = p.x + pad + 32 * scale + pad * 0.5;
    const breed = data.breeds.find((b) => b.id === cat.breedId);
    const coat = data.coats.find((c) => c.id === cat.coatId);
    add(this.text(tx, p.y + pad, cat.name, 1.5, COLORS.text, true));
    const sub = [
      breed && t(breed.name_key),
      coat && t(coat.name_key),
      t(`AGE_${cat.age.toUpperCase()}`),
    ]
      .filter(Boolean)
      .join(' · ');
    add(
      this.text(tx, p.y + pad + f * 1.9, sub, 0.85, COLORS.dim).setWordWrapWidth(
        p.x + p.w - tx - pad,
      ),
    );

    // Zavrieť
    const close = add(
      this.text(p.x + p.w - pad, p.y + pad * 0.6, '✕', 1.2, COLORS.dim).setOrigin(1, 0),
    );
    close.setPadding(6).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.state.bus.emit('catSelected', { catId: null }));

    // Štatistiky
    let y = p.y + pad + 32 * scale + pad * 0.6;
    const barW = p.w - pad * 2;
    const barH = Math.max(6, Math.round(f * 0.45));
    for (const key of Object.keys(STAT_KEYS) as (keyof CatStats)[]) {
      const value = Math.round(cat.stats[key]);
      add(this.text(p.x + pad, y, t(STAT_KEYS[key]), 0.85));
      add(this.text(p.x + p.w - pad, y, String(value), 0.85, COLORS.dim).setOrigin(1, 0));
      y += f * 1.15;
      const g = add(this.add.graphics());
      g.fillStyle(COLORS.barBg, 1).fillRoundedRect(p.x + pad, y, barW, barH, barH / 2);
      g.fillStyle(STAT_COLORS[key], 1).fillRoundedRect(
        p.x + pad,
        y,
        Math.max(barH, (barW * value) / 100),
        barH,
        barH / 2,
      );
      y += barH + f * 0.55;
    }

    // Povaha a diagnózy – zatiaľ skryté (GDD §4.1, §4.3)
    y += f * 0.2;
    add(this.text(p.x + pad, y, t('UI_TRAITS'), 0.85, COLORS.accent, true));
    y += f * 1.15;
    const traits = cat.traits
      .filter((tr) => tr.revealed)
      .map((tr) => t(data.traits.find((d) => d.id === tr.id)?.name_key ?? tr.id));
    add(
      this.text(
        p.x + pad,
        y,
        traits.length ? traits.join(', ') : t('UI_UNKNOWN'),
        0.85,
        COLORS.dim,
      ),
    );
    y += f * 1.4;
    add(this.text(p.x + pad, y, t('UI_CONDITIONS'), 0.85, COLORS.accent, true));
    y += f * 1.15;
    const hidden = cat.conditions.filter((c) => !c.revealed).length;
    const last = add(
      this.text(p.x + pad, y, t('UI_HIDDEN_CONDITIONS', { count: hidden }), 0.85, COLORS.dim),
    );
    return last.y + last.height;
  }

  private startMusic(): void {
    if (this.music) return;
    this.music = this.sound.add('music', { loop: true, volume: 0.3 });
    if (!this.muted) this.music.play();
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem('meow:muted', this.muted ? '1' : '0');
    } catch {
      /* nevadí */
    }
    this.startMusic();
    if (this.muted) this.music?.pause();
    else if (this.music?.isPaused) this.music.resume();
    else this.music?.play();
    this.sound.mute = this.muted;
    this.buildHud();
  }
}
