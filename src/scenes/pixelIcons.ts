import type Phaser from 'phaser';

/**
 * Drobné pixelové ikonky nad mačkami (bublina „?", krížik, srdiečko, „z").
 * Kreslia sa z textových máp pri štarte – žiadne ďalšie súbory.
 */
const PALETTE: Record<string, number> = {
  D: 0x3b2f45, // obrys
  W: 0xfff4d6, // bublina
  R: 0xe0525a, // krížik
  B: 0x5a4a6e, // otáznik
  P: 0xf27a9b, // srdiečko
  Z: 0xb8d8ff, // spánok
};

const ICONS: Record<string, string[]> = {
  badge_treat: [
    '.DDDDDDD.',
    'DWWWWWWWD',
    'DWWWRWWWD',
    'DWWWRWWWD',
    'DWRRRRRWD',
    'DWWWRWWWD',
    'DWWWRWWWD',
    'DWWWWWWWD',
    '.DDDDDDD.',
    '....DD...',
    '....D....',
  ],
  badge_exam: [
    '.DDDDDDD.',
    'DWWWWWWWD',
    'DWWBBBWWD',
    'DWBWWWBWD',
    'DWWWWBWWD',
    'DWWWBWWWD',
    'DWWWWWWWD',
    'DWWWBWWWD',
    '.DDDDDDD.',
    '....DD...',
    '....D....',
  ],
  badge_ready: [
    '.DDDDDDD.',
    'DWWWWWWWD',
    'DWPPWPPWD',
    'DWPPPPPWD',
    'DWPPPPPWD',
    'DWWPPPWWD',
    'DWWWPWWWD',
    'DWWWWWWWD',
    '.DDDDDDD.',
    '....DD...',
    '....D....',
  ],
  zzz: ['ZZZZ', '..Z.', '.Z..', 'ZZZZ'],
};

export function ensurePixelIcons(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(ICONS)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const color = PALETTE[ch];
        if (color !== undefined) g.fillStyle(color, 1).fillRect(x, y, 1, 1);
      });
    });
    g.generateTexture(key, rows[0]!.length, rows.length);
    g.destroy();
  }
}
