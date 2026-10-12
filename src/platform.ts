import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/** Beží hra ako aplikácia (Android) – nie v prehliadači? */
export const isNative = Capacitor.isNativePlatform();

/** Ukončí aplikáciu (iba Android; v prehliadači sa okno zavrieť nedá). */
export function exitApp(): void {
  if (isNative) void App.exitApp();
}

/** Príručka hráča (wiki) – na webe vedľa hry, v aplikácii online stránka v prehliadači. */
export function openWiki(lang: string): void {
  const path = `wiki/${lang === 'en' ? 'en/' : ''}`;
  if (isNative) {
    // Capacitor otvorí adresu mimo aplikácie v systémovom prehliadači
    location.href = `https://dzizka.github.io/Meow-ambulance/${path}`;
    return;
  }
  window.open(`./${path}`, '_blank', 'noopener');
}

/** Systémové tlačidlo Späť na Androide. */
export function onBackButton(cb: () => void): void {
  if (isNative) void App.addListener('backButton', cb);
}
