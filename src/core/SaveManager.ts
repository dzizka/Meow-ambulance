import type { GameData } from '../data/types';
import { GameState, SAVE_VERSION, emptyCafe, emptyCounters, type SaveData } from './GameState';
import type { OfflineSummary } from './EventBus';

/** Úložisko savu – v prehliadači localStorage, v aplikácii navyše Capacitor Preferences (src/saveStorage.ts). */
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
  /** v14 → v15: srdiečka a kozmetika (GDD §7.6). */
  14: (s) => ({ ...s, version: 15, hearts: 0, cosmetics: { owned: [], walls: {} } }),
  15: (s) => ({ ...s, version: 16, campaigns: { done: 0, active: null } }),
  /** v13 → v14: udalosti (GDD §7.3) – prvá ponuka o 15 minút. */
  13: (s) => ({
    ...s,
    version: 14,
    events: { offer: null, active: null, timer: 300_000, done: {} },
  }),
  /** v12 → v13: úspechy (GDD §7.5). */
  12: (s) => ({ ...s, version: 13, achievements: {} }),
  /** v11 → v12: edukačné centrum (GDD §6.9). */
  11: (s) => ({
    ...s,
    version: 12,
    education: { open: false, trip: null, timer: 0 },
    counters: { ...emptyCounters(), ...s.counters },
  }),
  /** v10 → v11: 2. poschodie kliniky (GDD §6.8). */
  10: (s) => ({ ...s, version: 11, clinic: { ...s.clinic, floors: 1 } }),
  /** v9 → v10: mačací hotel (GDD §6.7). */
  9: (s) => ({
    ...s,
    version: 10,
    hotel: { open: false, suites: 0, guests: [], timer: 0 },
    counters: { ...emptyCounters(), ...s.counters },
  }),
  /** v8 → v9: catio – vonkajší výbeh (GDD §6.6). */
  8: (s) => ({ ...s, version: 9, catio: { open: false } }),
  /** v7 → v8: klinika, počítadlo kastrácií (GDD §6.5). */
  7: (s) => ({
    ...s,
    version: 8,
    clinic: { open: false, rooms: [], floors: 1 },
    counters: { ...emptyCounters(), ...s.counters },
  }),
  /** v6 → v7: personál (GDD §6.4). */
  6: (s) => ({ ...s, version: 7, staff: {} }),
  /** v5 → v6: Komunitný útulok, počítadlo očkovaní (GDD §6.2). */
  5: (s) => ({
    ...s,
    version: 6,
    shelter: { open: false },
    counters: { ...emptyCounters(), ...s.counters },
  }),
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

/** Kľúč savu v úložisku. */
export const SAVE_KEY = 'meow-ambulance:save:1';

/** Predpona kódu na prenos uloženej hry (export / import). */
const CODE_PREFIX = 'MEOW1:';

const toBase64 = (text: string): string => {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (code: string): string =>
  new TextDecoder().decode(Uint8Array.from(atob(code), (c) => c.charCodeAt(0)));

export class SaveManager {
  constructor(
    private storage: SaveStorage,
    private key = SAVE_KEY,
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
      const save = this.parse(raw, data);
      if (!save) return null;
      const state = GameState.fromSave(data, save);
      const elapsed = Math.max(0, this.clock() - save.savedAt);
      const offline = state.applyOffline(elapsed);
      return { state, offline };
    } catch {
      return null;
    }
  }

  /** JSON savu → aktuálna verzia (migrácie); null, ak sa nedá načítať. */
  private parse(raw: string, data: GameData): SaveData | null {
    let save = JSON.parse(raw) as SaveData;
    if (typeof save?.version !== 'number' || save.version > SAVE_VERSION) return null;
    while (save.version < SAVE_VERSION) {
      const migrate = MIGRATIONS[save.version];
      if (!migrate) return null;
      save = migrate(save);
    }
    GameState.fromSave(data, structuredClone(save)); // overí, že sa z neho dá postaviť hra
    return save;
  }

  /** Uložená hra ako text na skopírovanie (záloha, prenos na iné zariadenie). */
  exportCode(): string | null {
    const raw = this.storage.get(this.key);
    return raw ? CODE_PREFIX + toBase64(raw) : null;
  }

  /**
   * Nahradí uloženú hru kódom z `exportCode`. Neplatný kód nič nezmení a vráti false.
   * Hra sa potom načíta nanovo (reload).
   */
  importCode(code: string, data: GameData): boolean {
    const trimmed = code.replace(/\s+/g, '');
    if (!trimmed.startsWith(CODE_PREFIX)) return false;
    try {
      const raw = fromBase64(trimmed.slice(CODE_PREFIX.length));
      if (!this.parse(raw, data)) return false;
      this.storage.set(this.key, raw);
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.storage.remove(this.key);
  }
}
