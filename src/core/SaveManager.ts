import type { GameData } from '../data/types';
import { GameState, SAVE_VERSION, type SaveData } from './GameState';
import type { OfflineSummary } from './EventBus';

/** Úložisko savu – v prehliadači localStorage, na mobile neskôr Capacitor Preferences (TECH.md). */
export interface SaveStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const browserStorage: SaveStorage = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* plné alebo zakázané úložisko – hra pokračuje bez ukladania */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nevadí */
    }
  },
};

/** Migrácie starších formátov savu. Kľúč = verzia, z ktorej sa migruje. */
const MIGRATIONS: Record<number, (s: SaveData) => SaveData> = {};

export class SaveManager {
  constructor(
    private storage: SaveStorage,
    private key = 'meow-ambulance:save:1',
    private clock: () => number = () => Date.now(),
  ) {}

  save(state: GameState): void {
    this.storage.set(this.key, JSON.stringify(state.toSave(this.clock())));
  }

  /**
   * Načíta hru a dopočíta, čo sa udialo offline (GDD §2.3).
   * Ak save neexistuje alebo je poškodený, vráti null.
   */
  load(data: GameData): { state: GameState; offline: OfflineSummary } | null {
    const raw = this.storage.get(this.key);
    if (!raw) return null;
    try {
      let save = JSON.parse(raw) as SaveData;
      while (save.version < SAVE_VERSION) {
        const migrate = MIGRATIONS[save.version];
        if (!migrate) return null;
        save = migrate(save);
      }
      const state = GameState.fromSave(data, save);
      const elapsed = Math.max(0, this.clock() - save.savedAt);
      const offline = state.applyOffline(elapsed);
      return { state, offline };
    } catch {
      return null;
    }
  }

  clear(): void {
    this.storage.remove(this.key);
  }
}
