import type { GameData } from '../data/types';
import { GameState, SAVE_VERSION, emptyCafe, emptyCounters, type SaveData } from './GameState';
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
const MIGRATIONS: Record<number, (s: SaveData) => SaveData> = {
  /** v1 → v2: výzvy, album, vylepšenia, tutoriál (M2). Album sa doplní z doterajších adopcií a stálic. */
  1: (old) => {
    const s = old as SaveData & { rescued?: number };
    const counters = { ...emptyCounters(), rescued: s.rescued ?? 0, adopted: s.adoptions.length };
    const album: SaveData['album'] = {};
    const add = (c: SaveData['cats'][number], how: 'adopted' | 'resident', at: number) => {
      const key = `${c.breedId}:${c.coatId}`;
      const e = album[key];
      if (e) e.count += 1;
      else album[key] = { name: c.name, sprite: c.sprite, how, at, count: 1 };
    };
    for (const a of s.adoptions) add(a.cat, 'adopted', a.adoptedAt);
    for (const c of s.cats.filter((x) => x.resident)) add(c, 'resident', c.admittedAt);
    return {
      ...s,
      version: 2,
      counters,
      challenges: [],
      challengeTiers: {},
      album,
      upgrades: { cages: 0, slots: 0 },
      tutorialStep: 0,
      tutorialDone: s.adoptions.length > 0,
    };
  },
  /** v4 → v5: vybavenie a dekorácie (GDD §6.1). */
  4: (s) => ({ ...s, version: 5, equipment: {}, decor: [] }),
  /** v3 → v4: plemená s pevnou farbou (siamská = seal_point) – oprava farby mačiek a albumu. */
  3: (s) => {
    const fixed: Record<string, string> = { siamese: 'seal_point' };
    const fixCat = (c: SaveData['cats'][number]) => {
      const coat = fixed[c.breedId];
      if (coat) c.coatId = coat;
    };
    s.cats.forEach(fixCat);
    s.adoptions.forEach((a) => fixCat(a.cat));
    const album: SaveData['album'] = {};
    for (const [key, entry] of Object.entries(s.album)) {
      const [breed] = key.split(':');
      const coat = breed ? fixed[breed] : undefined;
      const k = coat ? `${breed}:${coat}` : key;
      const prev = album[k];
      if (prev) prev.count += entry.count;
      else album[k] = { ...entry };
    }
    return { ...s, version: 4, album };
  },
  /** v2 → v3: mačacia kaviareň (GDD §5.5), počítadlo obslúžených hostí. */
  2: (s) => ({
    ...s,
    version: 3,
    counters: { ...emptyCounters(), ...s.counters },
    cafe: emptyCafe(),
  }),
};

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
