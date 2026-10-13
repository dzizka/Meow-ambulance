import Phaser from 'phaser';
import { FLOOR_TOP, ROOM, WORLD_W } from './layout';

/**
 * Sezónna výzdoba (GDD §7.3) – kreslená tvarmi, bez nových obrázkov.
 * Halloween: oranžovo-fialové vlajočky a tekvičky, Vianoce: blikajúce svetielka a stromček.
 * Vlajočky/svetielka idú do všetkých budov, tekvice a stromček iba do garáže a kaviarne.
 */
const ROOMS = 8;
const GARLAND_Y = ROOM.y + 22;
/** Tekvičky pri stene na voľných miestach garáže a kaviarne (svet x, y od podlahy, veľkosť). */
const PUMPKINS: [number, number, number][] = [
  [252, 8, 1],
  [266, 10, 0.7],
  [WORLD_W + 80, 10, 1],
  [WORLD_W + 94, 12, 0.7],
];
/** Stromček v garáži a v kaviarni (svet x, y od podlahy). */
const TREES: [number, number][] = [
  [300, 12],
  [WORLD_W + 175, 14],
];

export function drawSeasonDecor(
  scene: Phaser.Scene,
  seasonId: string,
): Phaser.GameObjects.GameObject[] {
  if (seasonId === 'halloween') return halloween(scene);
  if (seasonId === 'christmas') return christmas(scene);
  return [];
}

function halloween(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const g = scene.add.graphics().setDepth(-974);
  const colors = [0xf08a24, 0x7a4fb0, 0x2b2233];
  for (let room = 0; room < ROOMS; room++) {
    const x0 = room * WORLD_W + ROOM.x + 4;
    const x1 = room * WORLD_W + ROOM.x + ROOM.w - 4;
    g.lineStyle(1, 0x3a2a1e, 1).lineBetween(x0, GARLAND_Y, x1, GARLAND_Y);
    let k = 0;
    for (let x = x0 + 6; x < x1 - 8; x += 16) {
      g.fillStyle(colors[k++ % colors.length] ?? 0xf08a24, 1);
      g.fillTriangle(x, GARLAND_Y, x + 8, GARLAND_Y, x + 4, GARLAND_Y + 8);
    }
  }
  const p = scene.add.graphics().setDepth(-960);
  for (const [x, y, size] of PUMPKINS) pumpkin(p, x, FLOOR_TOP + y, size);
  return [g, p];
}

/** Tekvička s vyrezanou tváričkou (stred dole = x, y). */
function pumpkin(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  const w = 14 * s;
  const h = 10 * s;
  g.fillStyle(0xd9741a, 1).fillEllipse(x, y - h / 2, w, h);
  g.fillStyle(0xf08a24, 1).fillEllipse(x, y - h / 2, w * 0.55, h);
  g.fillStyle(0x4f7a2a, 1).fillRect(x - 1, y - h - 3 * s, 2, 3 * s);
  g.fillStyle(0x2b1a0e, 1);
  g.fillTriangle(x - 4 * s, y - h * 0.65, x - 2 * s, y - h * 0.65, x - 3 * s, y - h * 0.45);
  g.fillTriangle(x + 2 * s, y - h * 0.65, x + 4 * s, y - h * 0.65, x + 3 * s, y - h * 0.45);
  g.fillRect(x - 3 * s, y - h * 0.3, 6 * s, Math.max(1, s));
}

function christmas(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const wire = scene.add.graphics().setDepth(-974);
  out.push(wire);
  const colors = [0xe05a5a, 0x5fbf6a, 0xf2c14e, 0x6fa8e8];
  for (let room = 0; room < ROOMS; room++) {
    const x0 = room * WORLD_W + ROOM.x + 4;
    const x1 = room * WORLD_W + ROOM.x + ROOM.w - 4;
    // drôt sa medzi háčikmi mierne prehýba
    const sag = (x: number) => GARLAND_Y + Math.abs(Math.sin(((x - x0) / 56) * Math.PI)) * 5;
    wire.lineStyle(1, 0x2f4a2a, 1);
    for (let x = x0; x < x1; x += 4) wire.lineBetween(x, sag(x), Math.min(x + 4, x1), sag(x + 4));
    let k = 0;
    for (let x = x0 + 7; x < x1 - 4; x += 14) {
      const bulb = scene.add
        .circle(x, sag(x) + 2, 2, colors[k++ % colors.length] ?? 0xffffff)
        .setDepth(-973);
      scene.tweens.add({
        targets: bulb,
        alpha: 0.35,
        duration: 700 + Math.random() * 900,
        delay: Math.random() * 1200,
        yoyo: true,
        repeat: -1,
      });
      out.push(bulb);
    }
  }
  const t = scene.add.graphics().setDepth(-960);
  for (const [x, y] of TREES) tree(t, x, FLOOR_TOP + y);
  out.push(t);
  return out;
}

/** Malý stromček so zlatou hviezdou (stred dole = x, y). */
function tree(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x6b4a2e, 1).fillRect(x - 2, y - 4, 4, 4);
  g.fillStyle(0x2f7a3a, 1);
  g.fillTriangle(x - 10, y - 4, x + 10, y - 4, x, y - 16);
  g.fillTriangle(x - 8, y - 11, x + 8, y - 11, x, y - 22);
  g.fillTriangle(x - 6, y - 17, x + 6, y - 17, x, y - 27);
  g.fillStyle(0xe05a5a, 1)
    .fillCircle(x - 4, y - 8, 1.2)
    .fillCircle(x + 3, y - 14, 1.2);
  g.fillStyle(0x6fa8e8, 1)
    .fillCircle(x + 5, y - 7, 1.2)
    .fillCircle(x - 2, y - 19, 1.2);
  g.fillStyle(0xf2c14e, 1).fillCircle(x, y - 28, 2);
}
