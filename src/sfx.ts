/**
 * Voliteľné zvuky, ktoré si autor doplní sám (docs/ASSETS.md – „Zvuky na doplnenie").
 * Súbory sa vkladajú do public/assets/audio/sfx/extra/<meno>.<mp3|ogg|wav>.
 * Zoznam existujúcich súborov zistí Vite pri štarte/builde (vite.config.ts) –
 * ak súbor chýba, hra použije náhradný zvuk alebo nezahrá nič.
 */
declare const __EXTRA_SFX__: Record<string, string[]> | undefined;

export const EXTRA_SFX_NAMES = [
  'hiss',
  'doorbell',
  'van',
  'kibble',
  'brush',
  'coins',
  'camera',
] as const;
export type ExtraSfx = (typeof EXTRA_SFX_NAMES)[number];

const found: Record<string, string[]> = typeof __EXTRA_SFX__ !== 'undefined' ? __EXTRA_SFX__ : {};

/** Iba známe mená, ktoré naozaj existujú v priečinku extra/. */
export const EXTRA_SFX: Record<string, string[]> = Object.fromEntries(
  EXTRA_SFX_NAMES.filter((n) => found[n]?.length).map((n) => [n, found[n]!]),
);
