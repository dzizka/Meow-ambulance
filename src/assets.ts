/**
 * Zoznam súborov, ktoré hra načítava. Cesty sú relatívne k index.html
 * (public/ sa kopíruje do koreňa buildu). Slúži aj na výber súborov pri zverejnení ukážky.
 */
export const DATA_FILES = {
  traits: 'data/traits.json',
  conditions: 'data/conditions.json',
  breeds: 'data/breeds.json',
  adopters: 'data/adopters.json',
  names: 'data/names.json',
  balance: 'data/balance.json',
  reports: 'data/reports.json',
  challenges: 'data/challenges.json',
} as const;

export const IMAGES = {
  interior: 'assets/sprites/interior/interior_lite.png',
  clinic: 'assets/sprites/clinic/hospital_tiles.png',
} as const;

export const catSheetPath = (sheet: string): string => `assets/sprites/cats/popshop/${sheet}.png`;

export const personSheetPath = (id: string): string => `assets/sprites/people/gbtl/${id}.png`;

/** Každý zvuk v dvoch formátoch – Phaser vyberie ten, ktorý zariadenie prehrá. */
const audio = (base: string): [string, string] => [`${base}.ogg`, `${base}.mp3`];

export const AUDIO = {
  purr: audio('assets/audio/sfx/cats/cat_purractive_loop'),
  purrSleepy: audio('assets/audio/sfx/cats/cat_purrsleepy_loop'),
  mew: audio('assets/audio/sfx/cats/cat_softmew'),
  mewPurr: audio('assets/audio/sfx/cats/cat_mewpurr'),
  mewFood: audio('assets/audio/sfx/cats/cat_mewfood'),
  click: audio('assets/audio/sfx/ui/click_002'),
  select: audio('assets/audio/sfx/ui/select_001'),
  music: audio('assets/audio/music/lofi_home'),
} as const satisfies Record<string, string[]>;

export const FONT_FAMILY = '"Pixelify Sans", monospace';

/** Postava dobrovoľníčky Zuzky (G5, hárok 012). */
export const ZUZKA_SHEET = '012';
