import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/** Beží hra ako aplikácia (Android) – nie v prehliadači? */
export const isNative = Capacitor.isNativePlatform();

/** Ukončí aplikáciu (iba Android; v prehliadači sa okno zavrieť nedá). */
export function exitApp(): void {
  if (isNative) void App.exitApp();
}

/**
 * Stránka hry na itch.io – odtiaľ sa dá autor podporiť ľubovoľnou sumou.
 * Prázdne = stránka ešte neexistuje a tlačidlo „Podporiť autora" sa neukáže.
 */
export const SUPPORT_URL = 'https://quietcraft.itch.io/meow-ambulance';

/** Otvorí adresu mimo hry (na webe nová karta, v aplikácii systémový prehliadač). */
export function openExternal(url: string): void {
  if (isNative) location.href = url;
  else window.open(url, '_blank', 'noopener');
}

/**
 * Príručka hráča (wiki) je súčasťou buildu vedľa hry (`wiki/`). V aplikácii sa neotvára –
 * verejná stránka (GitHub Pages) je vypnutá a webview by z hry odišiel.
 */
export const hasWiki = !isNative;
export function openWiki(lang: string): void {
  window.open(`./wiki/${lang === 'en' ? 'en/' : ''}`, '_blank', 'noopener');
}

/** Systémové tlačidlo Späť na Androide. */
export function onBackButton(cb: () => void): void {
  if (isNative) void App.addListener('backButton', cb);
}
