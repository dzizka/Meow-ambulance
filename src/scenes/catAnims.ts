import Phaser from 'phaser';
import { CAT_DIRS, type CatDir } from '../core/direction';

export { CAT_DIRS, dirFromVector, type CatDir } from '../core/direction';

/**
 * Animácie mačiek z balíka Pop Shop (G1).
 * Hárok: 24 stĺpcov × 16 riadkov, bunka 32×32. Každý smer má 2 riadky (A, B).
 * Rozloženie je popísané v public/assets/sprites/cats/popshop/README.md.
 */
export type CatAnim = 'walk' | 'run' | 'sit' | 'sit_idle' | 'look' | 'lay' | 'lay_idle';

const COLS = 24;
const frame = (row: number, col: number): number => row * COLS + col;
const range = (row: number, from: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => frame(row, from + i));

export const catAnimKey = (sheet: string, anim: CatAnim, dir: CatDir): string =>
  `${sheet}:${anim}:${dir}`;

/** Vytvorí animácie pre jeden farebný hárok (iba raz). */
export function ensureCatAnims(anims: Phaser.Animations.AnimationManager, sheet: string): void {
  if (anims.exists(catAnimKey(sheet, 'walk', 'down'))) return;
  CAT_DIRS.forEach((dir, i) => {
    const a = i * 2; // riadok A
    const b = a + 1; // riadok B (pokračovanie)
    const vertical = dir === 'down' || dir === 'up';
    const make = (
      anim: CatAnim,
      frames: number[],
      frameRate: number,
      repeat: number,
      yoyo = false,
    ) =>
      anims.create({
        key: catAnimKey(sheet, anim, dir),
        frames: anims.generateFrameNumbers(sheet, { frames }),
        frameRate,
        repeat,
        yoyo,
      });
    make('walk', range(a, 12, 4), 7, -1);
    make('run', [...range(a, 20, 4), ...range(b, 20, 4)], 14, -1);
    make('sit', range(a, 0, 4), 8, 0);
    make('sit_idle', range(b, 0, vertical ? 3 : 2), 2, -1, true);
    make('look', [...range(a, 4, 4), frame(b, 4)], 4, 0);
    make('lay', range(a, 8, 4), 7, 0);
    make('lay_idle', range(b, 8, 4), 2, -1, true);
  });
}
