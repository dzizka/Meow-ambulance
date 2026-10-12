import Phaser from 'phaser';
import type { GameState } from '../core/GameState';
import type { DecorDef } from '../data/types';
import { CLINIC_FRAMES, INTERIOR_FRAMES } from '../data/frames';
import { CAFE_X, FLOOR_TOP, roomX } from './layout';
import { addProp, type WorldGeom } from './world';

const WALL_BASE = FLOOR_TOP + 22;

/**
 * Vybavenie a dekorácie vo svete (GDD §6.1.2–3). Iba zobrazenie –
 * čo je kúpené, hovorí GameState. Nové kúsky sa objavia s malou animáciou.
 */
export class Furnishings {
  private readonly equipmentShown = new Map<string, Phaser.GameObjects.Image[]>();
  private readonly decorShown = new Set<string>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: GameState,
    private readonly geom: WorldGeom,
  ) {
    this.makeTextures();
    this.registerFrames();
    for (const def of state.data.equipment) this.showEquipment(def.id, false);
    for (const id of state.decor) {
      const def = state.decorDef(id);
      if (def) this.showDecor(def, false);
    }
    state.bus.on('equipmentBought', ({ id }) => this.showEquipment(id, true));
    state.bus.on('decorBought', ({ def }) => this.showDecor(def, true));
    // Pelechy pribudnú aj v kaviarni, keď sa otvorí
    state.bus.on('upgradeBought', ({ kind }) => {
      if (kind === 'cafe') this.showEquipment('beds', false);
    });
  }

  // ---------- Vybavenie ----------

  /** Kde a ako vyzerá vybavenie pri danom stupni (viac kusov pri vyššom stupni). */
  private equipmentPieces(
    id: string,
    level: number,
  ): { key: string; frame?: string; x: number; y: number; footprint?: number }[] {
    if (level <= 0) return [];
    switch (id) {
      case 'feeder':
        return [{ key: 'eq-feeder', x: 362, y: FLOOR_TOP + 66, footprint: 6 }];
      case 'scratcher':
        return [{ key: 'eq-cattree', x: 444, y: FLOOR_TOP + 110, footprint: 10 }];
      case 'medicine':
        return [{ key: 'clinic', frame: 'cabinet_small', x: 98, y: WALL_BASE }];
      case 'toys':
        return [
          { key: 'eq-yarn', x: 210, y: FLOOR_TOP + 150 },
          { key: 'eq-mouse', x: 250, y: FLOOR_TOP + 120 },
          { key: 'eq-yarn', x: 330, y: FLOOR_TOP + 178 },
        ].slice(0, level);
      case 'beds': {
        const spots = [
          { key: 'interior', frame: 'cushion', x: 330, y: FLOOR_TOP + 160 },
          { key: 'interior', frame: 'cushion', x: 362, y: FLOOR_TOP + 168 },
          { key: 'interior', frame: 'cushion', x: 300, y: FLOOR_TOP + 172 },
        ];
        if (this.state.cafe.open)
          spots.push(
            { key: 'interior', frame: 'cushion', x: CAFE_X + 230, y: FLOOR_TOP + 186 },
            { key: 'interior', frame: 'cushion', x: CAFE_X + 380, y: FLOOR_TOP + 186 },
            { key: 'interior', frame: 'cushion', x: CAFE_X + 160, y: FLOOR_TOP + 140 },
          );
        // stupeň = počet pelechov v každej miestnosti
        return spots.filter((_, i) => i % 3 < level);
      }
      default:
        return [];
    }
  }

  private showEquipment(id: string, animate: boolean): void {
    const level = this.state.equipmentLevel(id);
    for (const img of this.equipmentShown.get(id) ?? []) img.destroy();
    const imgs = this.equipmentPieces(id, level).map((p) => {
      const img = this.scene.add.image(p.x, p.y, p.key, p.frame).setOrigin(0.5, 1).setDepth(p.y);
      if (!this.equipmentShown.has(id))
        addProp(this.geom, p.x, p.y, img.width, img.height, p.footprint ?? 0);
      return img;
    });
    if (level > 0) this.equipmentShown.set(id, imgs);
    if (animate) imgs.forEach((img) => this.pop(img));
  }

  // ---------- Dekorácie ----------

  private showDecor(def: DecorDef, animate: boolean): void {
    if (this.decorShown.has(def.id)) return;
    this.decorShown.add(def.id);
    const ox = roomX(def.room);
    let img: Phaser.GameObjects.Image;
    if (def.layer === 'prop') {
      img = this.scene.add
        .image(ox + def.x, def.y, def.sheet, def.frame)
        .setOrigin(0.5, 1)
        .setDepth(def.y);
      addProp(this.geom, ox + def.x, def.y, img.width, img.height, def.footprint ?? 0);
    } else {
      // na stenu a na zem – za všetkým ostatným, ale nad pozadím
      img = this.scene.add
        .image(ox + def.x, def.y, def.sheet, def.frame)
        .setOrigin(0, 0)
        .setDepth(def.layer === 'wall' ? -990 : -980);
    }
    if (animate) this.pop(img);
  }

  // ---------- Pomocné ----------

  private pop(img: Phaser.GameObjects.Image): void {
    const sx = img.scaleX;
    img.setScale(0.2);
    this.scene.tweens.add({ targets: img, scale: sx, ease: 'Back.easeOut', duration: 500 });
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const sp = this.scene.add.image(img.x, img.y - img.displayHeight / 2, 'spark').setDepth(4000);
      this.scene.tweens.add({
        targets: sp,
        x: sp.x + Math.cos(a) * 18,
        y: sp.y + Math.sin(a) * 12,
        alpha: 0,
        duration: 600,
        onComplete: () => sp.destroy(),
      });
    }
  }

  private registerFrames(): void {
    for (const [sheet, frames] of [
      ['interior', INTERIOR_FRAMES],
      ['clinic', CLINIC_FRAMES],
    ] as const) {
      const tex = this.scene.textures.get(sheet);
      for (const [name, [x, y, w, h]] of Object.entries(frames)) {
        if (!tex.has(name)) tex.add(name, 0, x, y, w, h);
      }
    }
  }

  /** Vybavenie, ktoré v balíkoch nie je – nakreslené kódom vo farbách interiéru. */
  private makeTextures(): void {
    const make = (
      key: string,
      w: number,
      h: number,
      draw: (c: CanvasRenderingContext2D) => void,
    ) => {
      if (this.scene.textures.exists(key)) return;
      const tex = this.scene.textures.createCanvas(key, w, h);
      if (!tex) return;
      draw(tex.getContext());
      tex.refresh();
    };
    const px = (
      c: CanvasRenderingContext2D,
      color: string,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    // Automatické kŕmidlo: priehľadný zásobník s granulami nad miskou
    make('eq-feeder', 12, 20, (c) => {
      px(c, '#3b2f45', 2, 0, 8, 14);
      px(c, '#b8d8ff', 3, 1, 6, 12);
      px(c, '#8a5a3c', 3, 6, 6, 7);
      px(c, '#a8754c', 4, 7, 1, 1);
      px(c, '#a8754c', 6, 9, 1, 1);
      px(c, '#3b2f45', 0, 14, 12, 6);
      px(c, '#e8a87c', 1, 15, 10, 4);
      px(c, '#8a5a3c', 2, 15, 8, 2);
    });
    // Mačací strom: podstava, stĺpik so šnúrou a dve poschodia s vankúšikom
    make('eq-cattree', 26, 44, (c) => {
      px(c, '#5b4a5e', 0, 40, 26, 4);
      px(c, '#7a6880', 1, 40, 24, 1);
      for (let y = 8; y < 40; y += 2) px(c, y % 4 === 0 ? '#d9c39a' : '#c4a978', 10, y, 6, 2);
      px(c, '#5b4a5e', 2, 22, 22, 4);
      px(c, '#7a6880', 3, 22, 20, 1);
      px(c, '#5b4a5e', 4, 4, 18, 5);
      px(c, '#e8a0a0', 6, 1, 14, 4);
      px(c, '#f2c0c0', 7, 1, 12, 1);
      px(c, '#f2c14e', 21, 26, 1, 6);
      px(c, '#e8a0a0', 20, 32, 3, 3);
    });
    // Klbko vlny
    make('eq-yarn', 8, 8, (c) => {
      px(c, '#b0507a', 2, 0, 4, 8);
      px(c, '#b0507a', 0, 2, 8, 4);
      px(c, '#f27a9b', 1, 1, 6, 6);
      px(c, '#f9b0c4', 2, 2, 2, 1);
      px(c, '#b0507a', 1, 4, 6, 1);
      px(c, '#b0507a', 4, 1, 1, 6);
      px(c, '#f27a9b', 7, 6, 3, 1);
    });
    // Myška na hranie
    make('eq-mouse', 10, 6, (c) => {
      px(c, '#7a6880', 2, 1, 6, 4);
      px(c, '#a99bb0', 3, 1, 4, 2);
      px(c, '#e8a0a0', 7, 0, 2, 2);
      px(c, '#3b2f45', 8, 2, 1, 1);
      px(c, '#7a6880', 0, 3, 2, 1);
    });
  }
}
