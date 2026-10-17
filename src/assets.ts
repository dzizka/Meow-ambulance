import { lang } from './i18n/t';

/**
 * Zoznam súborov, ktoré hra načítava. Cesty sú relatívne k index.html
 * (public/ sa kopíruje do koreňa buildu). Slúži aj na výber súborov pri zverejnení ukážky.
 */
export const DATA_FILES = {
  traits: 'data/traits.json',
  conditions: 'data/conditions.json',
  breeds: 'data/breeds.json',
  adopters: 'data/adopters.json',
  // mená mačiek sú podľa jazyka hry (mačka si meno nechá aj po zmene jazyka)
  names: `data/names/${lang}.json`,
  balance: 'data/balance.json',
  reports: 'data/reports.json',
  challenges: 'data/challenges.json',
  equipment: 'data/equipment.json',
  decor: 'data/decor.json',
  staff: 'data/staff.json',
  achievements: 'data/achievements.json',
  events: 'data/events.json',
  cosmetics: 'data/cosmetics.json',
  story: 'data/story.json',
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
  // ďalšie zvuky z balíka Kenney Interface Sounds (S3, CC0) – nič nie je vytvorené ručne
  open: audio('assets/audio/sfx/ui/open_001'),
  close: audio('assets/audio/sfx/ui/close_001'),
  success: audio('assets/audio/sfx/ui/confirmation_002'),
  error: audio('assets/audio/sfx/ui/error_004'),
  pluck: audio('assets/audio/sfx/ui/pluck_002'),
  drop: audio('assets/audio/sfx/ui/drop_002'),
  notify: audio('assets/audio/sfx/ui/bong_001'),
  upgrade: audio('assets/audio/sfx/ui/maximize_003'),
  found: audio('assets/audio/sfx/ui/glass_002'),
  nothing: audio('assets/audio/sfx/ui/question_001'),
  music: audio('assets/audio/music/lofi_home'),
} as const satisfies Record<string, string[]>;

/**
 * Hudba podľa dennej doby (GDD §9.2). Prvá skladba dňa je v AUDIO.music (načíta sa hneď),
 * ostatné sa načítajú na pozadí až po spustení hry.
 */
const MUSIC = 'assets/audio/music/';
export const MUSIC_DAY: Record<string, [string, string]> = {
  music: audio(`${MUSIC}lofi_home`),
  musicCafe: audio(`${MUSIC}lofi_cafe_time`),
  musicLove: audio(`${MUSIC}lofi_i_love_you`),
};
export const MUSIC_NIGHT: Record<string, [string, string]> = {
  musicCalmHome: audio(`${MUSIC}calm_1_a_place_i_call_home`),
  musicCalmDays: audio(`${MUSIC}calm_3_peaceful_days`),
  musicCalmSummer: audio(`${MUSIC}calm_5_summer_memories`),
};

/** Písmo všetkých textov a čísel – dobre čitateľné (Nunito, OFL); čínština a kórejčina zo systému. */
export const FONT_FAMILY =
  '"Nunito", system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans CJK KR", sans-serif';

/** Postava dobrovoľníčky Zuzky (G5, hárok 012). */
export const ZUZKA_SHEET = '012';
