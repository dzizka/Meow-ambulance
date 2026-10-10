/** 8 smerov pohľadu mačky (poradie zodpovedá riadkom v hárku spritov). */
export const CAT_DIRS = [
  'down',
  'down_left',
  'left',
  'up_left',
  'up',
  'up_right',
  'right',
  'down_right',
] as const;
export type CatDir = (typeof CAT_DIRS)[number];

const BY_OCTANT: CatDir[] = [
  'right',
  'down_right',
  'down',
  'down_left',
  'left',
  'up_left',
  'up',
  'up_right',
];

/** Smer z vektora pohybu (os y smeruje dole, ako na obrazovke). */
export function dirFromVector(dx: number, dy: number): CatDir {
  const octant = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  return BY_OCTANT[octant] ?? 'down';
}
