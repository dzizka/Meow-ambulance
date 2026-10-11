import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { StaffId } from '../data/types';
import type { CatSprite } from '../objects/CatSprite';
import { FLOOR_TOP, SHELTER_X, roomAt } from './layout';
import { ensurePixelIcons } from './pixelIcons';
import {
  ensurePersonAnims,
  personIdleFrame,
  personKey,
  personWalkKey,
  type PersonDir,
} from './personAnims';

const WALK_SPEED = 30;
const ACTION_ICON = { feed: 'icon_food', brush: 'icon_brush', examine: 'icon_steth' } as const;

interface Member {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  sheet: string;
  nextMoveAt: number;
  busy: boolean;
}

/**
 * Personál ako postavičky vo svete (GDD §6.4): ošetrovateľ a veterinárka sa prechádzajú
 * a prídu k mačke, o ktorú sa starajú; správca sietí sedí za stolom v garáži.
 * Baristka je v kaviarni za pultom vždy – obsluhu ukazuje kaviareň sama.
 */
export class StaffSprites {
  private readonly members = new Map<StaffId, Member>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly catSprite: (id: string) => CatSprite | undefined,
  ) {
    ensurePixelIcons(scene);
    state.bus.on('staffAction', ({ id, kind, cat }) => {
      if (kind === 'serve' || !cat) return;
      const sprite = this.catSprite(cat.id);
      if (!sprite) return;
      this.popIcon(sprite.x, sprite.y - 28, ACTION_ICON[kind]);
      this.walkTo(id, sprite.x + 16, sprite.y + 2);
    });
    state.bus.on('adopterArrived', () => {
      const m = this.members.get('social');
      if (m) this.popIcon(m.sprite.x, m.sprite.y - 34, 'icon_phone');
    });
    this.refresh();
  }

  /** Kde člen tímu pracuje a kadiaľ sa prechádza. */
  private areaFor(id: StaffId): Phaser.Geom.Rectangle | null {
    switch (id) {
      case 'caretaker':
        return new Phaser.Geom.Rectangle(90, FLOOR_TOP + 70, 330, 100);
      case 'vet':
        return this.state.shelter.open
          ? new Phaser.Geom.Rectangle(SHELTER_X + 262, FLOOR_TOP + 140, 170, 40)
          : new Phaser.Geom.Rectangle(40, FLOOR_TOP + 115, 60, 40);
      default:
        return null;
    }
  }

  private home(id: StaffId): { x: number; y: number } {
    if (id === 'social') return { x: 104, y: FLOOR_TOP + 140 }; // za stolom v garáži
    const a = this.areaFor(id);
    return a ? { x: a.centerX, y: a.centerY } : { x: 200, y: FLOOR_TOP + 120 };
  }

  /** Volá scéna pravidelne – pridá/odoberie postavičky podľa toho, kto pracuje. */
  refresh(): void {
    for (const def of this.state.data.staff) {
      if (def.id === 'barista') continue;
      const working = this.state.staffWorking(def.id);
      const m = this.members.get(def.id);
      if (working && !m) this.spawn(def.id, def.sprite);
      else if (!working && m) {
        m.sprite.destroy();
        m.shadow.destroy();
        this.members.delete(def.id);
      }
    }
    const now = this.scene.time.now;
    for (const [id, m] of this.members) {
      if (m.busy || now < m.nextMoveAt) continue;
      const a = this.areaFor(id);
      m.nextMoveAt = now + Phaser.Math.Between(5000, 9000);
      if (a)
        this.walkTo(id, Phaser.Math.Between(a.left, a.right), Phaser.Math.Between(a.top, a.bottom));
    }
  }

  private spawn(id: StaffId, sheet: string): void {
    ensurePersonAnims(this.scene.anims, sheet);
    const h = this.home(id);
    const sprite = this.scene.add
      .sprite(h.x, h.y, personKey(sheet), personIdleFrame('down'))
      .setOrigin(0.5, 1)
      .setDepth(h.y)
      .setAlpha(0);
    const shadow = this.scene.add.ellipse(h.x, h.y, 14, 5, 0x000000, 0.25).setDepth(h.y - 1);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 400 });
    this.members.set(id, {
      sprite,
      shadow,
      sheet,
      nextMoveAt: this.scene.time.now + 3000,
      busy: false,
    });
  }

  /** Prejde k bodu, ak je v rovnakej miestnosti (inak ostane, kde je). */
  private walkTo(id: StaffId, x: number, y: number): void {
    const m = this.members.get(id);
    if (!m || id === 'social') return;
    if (roomAt(x) !== roomAt(m.sprite.x)) return;
    const dx = x - m.sprite.x;
    const dy = y - m.sprite.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    const dir: PersonDir =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    m.busy = true;
    m.sprite.play(personWalkKey(m.sheet, dir), true);
    this.scene.tweens.killTweensOf(m.sprite);
    this.scene.tweens.add({
      targets: m.sprite,
      x,
      y,
      duration: (dist / WALK_SPEED) * 1000,
      onUpdate: () => {
        m.sprite.setDepth(m.sprite.y);
        m.shadow.setPosition(m.sprite.x, m.sprite.y).setDepth(m.sprite.y - 1);
      },
      onComplete: () => {
        m.sprite.anims.stop();
        m.sprite.setFrame(personIdleFrame('down'));
        m.busy = false;
      },
    });
  }

  private popIcon(x: number, y: number, key: string): void {
    const icon = this.scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(4600).setScale(0.3);
    this.scene.tweens.add({ targets: icon, scale: 1, ease: 'Back.easeOut', duration: 250 });
    this.scene.tweens.add({
      targets: icon,
      y: y - 8,
      alpha: 0,
      delay: 1300,
      duration: 500,
      onComplete: () => icon.destroy(),
    });
  }
}
