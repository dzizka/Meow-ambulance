import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/** Beží hra ako aplikácia (Android) – nie v prehliadači? */
export const isNative = Capacitor.isNativePlatform();

/** Ukončí aplikáciu (iba Android; v prehliadači sa okno zavrieť nedá). */
export function exitApp(): void {
  if (isNative) void App.exitApp();
}

/** Systémové tlačidlo Späť na Androide. */
export function onBackButton(cb: () => void): void {
  if (isNative) void App.addListener('backButton', cb);
}
