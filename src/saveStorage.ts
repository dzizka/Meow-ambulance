import { Preferences } from '@capacitor/preferences';
import { browserStorage, type SaveStorage } from './core/SaveManager';
import { isNative } from './platform';

/**
 * Úložisko savu (GDD §10.3). V prehliadači iba localStorage. V aplikácii (Android) sa každé
 * uloženie zrkadlí aj do Capacitor Preferences – tie sú v natívnom úložisku, systém ich
 * nezmaže spolu s dátami WebView a Android ich zálohuje (allowBackup).
 * Hra číta synchrónne z localStorage; Preferences sa načítajú raz pri štarte (`restoreNativeSave`).
 */
export const saveStorage: SaveStorage = {
  get: (k) => browserStorage.get(k),
  set: (k, v) => {
    browserStorage.set(k, v);
    if (isNative) void Preferences.set({ key: k, value: v }).catch(() => undefined);
  },
  remove: (k) => {
    browserStorage.remove(k);
    if (isNative) void Preferences.remove({ key: k }).catch(() => undefined);
  },
};

const savedAt = (raw: string | null): number => {
  if (!raw) return -1;
  try {
    return Number((JSON.parse(raw) as { savedAt?: number }).savedAt ?? 0);
  } catch {
    return -1;
  }
};

/**
 * Pri štarte aplikácie: ak WebView o save prišiel (alebo má starší), obnoví ho z Preferences.
 * Naopak, starý save iba v localStorage (z verzie pred zálohou) skopíruje do Preferences.
 */
export async function restoreNativeSave(key: string): Promise<void> {
  if (!isNative) return;
  try {
    const native = (await Preferences.get({ key })).value;
    const local = browserStorage.get(key);
    if (native && savedAt(native) > savedAt(local)) browserStorage.set(key, native);
    else if (local && savedAt(local) > savedAt(native))
      await Preferences.set({ key, value: local });
  } catch {
    /* bez natívneho úložiska hra beží ďalej s localStorage */
  }
}

/**
 * Počká, kým natívne úložisko presne zodpovedá localStorage (pred reloadom po novej hre
 * alebo importe) – inak by `restoreNativeSave` pri štarte vrátil starý save.
 */
export async function flushNativeSave(key: string): Promise<void> {
  if (!isNative) return;
  try {
    const local = browserStorage.get(key);
    if (local) await Preferences.set({ key, value: local });
    else await Preferences.remove({ key });
  } catch {
    /* nevadí */
  }
}
