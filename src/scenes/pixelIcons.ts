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
  C: 0x8a5a3c, // káva / čaj
  M: 0xf4e6d0, // šálka, mlieko
  G: 0x9ad17b, // čaj
  K: 0xf2c14e, // koláč
  S: 0xe0525a, // jahoda
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
  // Objednávky hostí v kaviarni (GDD §5.5)
  order_coffee: [
    '.DDDDDDDDD.',
    'DWWWWWWWWWD',
    'DWWWWWWWWWD',
    'DWDDDDDDWWD',
    'DWDCCCCDDWD',
    'DWDMMMMDWDD',
    'DWDMMMMDDWD',
    'DWWDDDDWWWD',
    'DWWWWWWWWWD',
    '.DDDDDDDDD.',
    '....DD.....',
    '....D......',
  ],
  order_tea: [
    '.DDDDDDDDD.',
    'DWWWWWDWWWD',
    'DWWWWWDWWWD',
    'DWDDDDDDWWD',
    'DWDGGGGDDWD',
    'DWDMMMMDWDD',
    'DWDMMMMDDWD',
    'DWWDDDDWWWD',
    'DWWWWWWWWWD',
    '.DDDDDDDDD.',
    '....DD.....',
    '....D......',
  ],
  order_cake: [
    '.DDDDDDDDD.',
    'DWWWWWWWWWD',
    'DWWWWSWWWWD',
    'DWWWDDDWWWD',
    'DWWDMMMDWWD',
    'DWDKKKKKDWD',
    'DWDMMMMMDWD',
    'DWDKKKKKDWD',
    'DWWDDDDDWWD',
    '.DDDDDDDDD.',
    '....DD.....',
    '....D......',
  ],
  // Personál pri práci (GDD §6.4)
  icon_food: [
    '.DDDDDDDDD.',
    'DWWWWWWWWWD',
    'DWWCWCWCWWD',
    'DWWCCCCCWWD',
    'DWDDDDDDDWD',
    'DWDKKKKKDWD',
    'DWWDDDDDWWD',
    'DWWWWWWWWWD',
    '.DDDDDDDDD.',
    '....DD.....',
    '....D......',
  ],
  icon_brush: [
    '.DDDDDDDDD.',
    'DWWWWWWWWWD',
    'DWCCCCCCCWD',
    'DWDBDBDBDWD',
    'DWDBDBDBDWD',
    'DWWWWCCWWWD',
    'DWWWWCCWWWD',
    'DWWWWWWWWWD',
    '.DDDDDDDDD.',
    '....DD.....',
    '....D......',
  ],
  icon_steth: [
    '.DDDDDDDDD.',
    'DWWWWWWWWWD',
    'DWBWWWWWBWD',
    'DWBWWWWWBWD',
    'DWWBWWWBWWD',
    'DWWWBBBWWWD',
    'DWWWWBWWWWD',
    'DWWWWRRWWWD',
    '.DDDDDDDDD.',
    '....DD.....',
    '....D......',
  ],
  icon_phone: [
    '.DDDDDDDDD.',
    'DWWWDDDWWWD',
    'DWWWDZDWWWD',
    'DWWWDZDWWWD',
    'DWWWDZDWWWD',
    'DWWWDDDWWWD',
    'DWWWWPWWWWD',
    'DWWWWWWWWWD',
    '.DDDDDDDDD.',
    '....DD.....',
    '....D......',
  ],
  // Čo hosť dostal na stôl
  item_coffee: ['DDDD.', 'DCCDD', 'DMMDD', 'DMMD.', '.DD..'],
  item_tea: ['DDDD.', 'DGGDD', 'DMMDD', 'DMMD.', '.DD..'],
  item_cake: ['..S..', '.DMD.', 'DKKKD', 'DMMMD', 'DDDDD'],
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
