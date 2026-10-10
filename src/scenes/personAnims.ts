import type Phaser from 'phaser';

/**
 * Postavičky z balíka GBTL (G5): hárok 3 stĺpce × 4 riadky (dole, vľavo, vpravo, hore),
 * bunka 20×32. Stredný stĺpec je státie, krajné sú kroky.
 */
export type PersonDir = 'down' | 'left' | 'right' | 'up';
const ROWS: Record<PersonDir, number> = { down: 0, left: 1, right: 2, up: 3 };

export const personKey = (sheet: string): string => `person-${sheet}`;
export const personIdleFrame = (dir: PersonDir): number => ROWS[dir] * 3 + 1;
export const personWalkKey = (sheet: string, dir: PersonDir): string =>
  `${personKey(sheet)}:walk:${dir}`;

export function ensurePersonAnims(anims: Phaser.Animations.AnimationManager, sheet: string): void {
  const key = personKey(sheet);
  for (const dir of Object.keys(ROWS) as PersonDir[]) {
    const r = ROWS[dir] * 3;
    if (anims.exists(personWalkKey(sheet, dir))) continue;
    anims.create({
      key: personWalkKey(sheet, dir),
      frames: anims.generateFrameNumbers(key, { frames: [r, r + 1, r + 2, r + 1] }),
      frameRate: 7,
      repeat: -1,
    });
  }
}
