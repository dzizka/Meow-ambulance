import type {
  ActiveChallenge,
  AdopterVisit,
  AchievementDef,
  WallColorDef,
  AdoptionRecord,
  AlbumEntry,
  CafeGuest,
  CafeState,
  ChallengeDef,
  DecorDef,
  EquipmentDef,
  EventDef,
  LevelDef,
  StaffDef,
  StaffId,
  Unlock,
  Counters,
  CatData,
  ClinicRoomId,
  DiagnosticTool,
  GameData,
  GuestOrder,
  Report,
  SocialActivity,
} from '../data/types';
import { EventBus, type OfflineSummary } from './EventBus';
import { Rng } from './Rng';
import * as Care from './systems/Care';
import { generateCat } from './systems/CatGenerator';
import { computeMatch, type MatchResult } from './systems/Match';

export const SAVE_VERSION = 15;

/** Uložená hra (JSON). Pri zmene formátu zvýšiť SAVE_VERSION a doplniť migráciu. */
export interface SaveData {
  version: number;
  /** Skutočný čas uloženia (Date.now) – kvôli offline príjmu. */
  savedAt: number;
  now: number;
  money: number;
  reputation: number;
  rng: number;
  nextId: number;
  cats: CatData[];
  reports: Report[];
  adopters: AdopterVisit[];
  adoptions: AdoptionRecord[];
  timers: { report: number; adopter: number };
  // od verzie 2
  counters: Counters;
  challenges: ActiveChallenge[];
  challengeTiers: Record<string, number>;
  album: Record<string, AlbumEntry>;
  upgrades: { cages: number; slots: number };
  tutorialStep: number;
  tutorialDone: boolean;
  // od verzie 3
  cafe: CafeState;
  // od verzie 5
  equipment: Record<string, number>;
  decor: string[];
  // od verzie 6
  shelter: { open: boolean };
  // od verzie 7
  staff: Partial<Record<StaffId, { active: boolean }>>;
  // od verzie 8
  clinic: ClinicState;
  // od verzie 9
  catio: { open: boolean };
  // od verzie 10
  hotel: HotelState;
  // od verzie 12
  education: EducationState;
  // od verzie 13
  achievements: Record<string, number>;
  // od verzie 14
  events: EventsState;
  // od verzie 15
  hearts: number;
  cosmetics: CosmeticsState;
}

/** Kozmetika (GDD §7.6): kúpené ozdoby a farby stien, zvolená farba v miestnostiach. */
export interface CosmeticsState {
  owned: string[];
  walls: Partial<Record<'garage' | 'cafe', string>>;
}

/** Udalosti (GDD §7.3): ponuka, prebiehajúca udalosť a počty dokončených. */
export interface EventsState {
  offer: EventDef['id'] | null;
  active: { id: EventDef['id']; startedAt: number; endsAt: number; start: number } | null;
  timer: number;
  done: Partial<Record<EventDef['id'], number>>;
}
export const emptyEvents = (first: number): EventsState => ({
  offer: null,
  active: null,
  timer: first,
  done: {},
});

/** Školský výlet: deti s učiteľkou čakajú na prednášku (GDD §6.9). */
export interface SchoolTrip {
  id: string;
  kids: string[];
  teacher: string;
  arrivedAt: number;
  leaveAt: number;
}
export interface EducationState {
  open: boolean;
  trip: SchoolTrip | null;
  timer: number;
}
export const emptyEducation = (): EducationState => ({ open: false, trip: null, timer: 0 });

/** Mačací hotel (GDD §6.7): kúpené apartmány a hostia. */
export interface HotelState {
  open: boolean;
  /** Dokúpené apartmány navyše. */
  suites: number;
  guests: CatData[];
  timer: number;
}
export const emptyHotel = (): HotelState => ({ open: false, suites: 0, guests: [], timer: 0 });

/** Klinika – Fáza 3 (GDD §6.5): budova a kúpené miestnosti. */
export interface ClinicState {
  open: boolean;
  rooms: ClinicRoomId[];
  /** Počet poschodí (1 alebo 2 – CT a bazén, GDD §6.8). */
  floors: number;
}
export const CLINIC_ROOMS: ClinicRoomId[] = ['lab', 'xray', 'or'];
export const FLOOR2_ROOMS: ClinicRoomId[] = ['ct', 'pool'];

export const emptyCafe = (): CafeState => ({ open: false, tables: 0, guests: [], timer: 0 });
const ORDERS: GuestOrder[] = ['coffee', 'coffee', 'tea', 'cake'];

export const emptyCounters = (): Counters => ({
  rescued: 0,
  kittens: 0,
  adopted: 0,
  perfect: 0,
  shy_homed: 0,
  treated: 0,
  ticks: 0,
  social: 0,
  fed: 0,
  served: 0,
  vaccinated: 0,
  neutered: 0,
  hotel: 0,
  lectures: 0,
});

/** Kroky tutoriálu so Zuzkou (kľúče textov) – postupujú podľa toho, čo hráč už urobil. */
export const TUTORIAL_STEPS = [
  'TUT_REPORT',
  'TUT_EXAMINE',
  'TUT_TREAT',
  'TUT_CARE',
  'TUT_READY',
  'TUT_MENU',
] as const;

export type DayPhase = 'night' | 'morning' | 'day' | 'evening';

const MINUTE = 60_000;
/** Noc: 22:00 – 6:00 (minúty od polnoci). */
const NIGHT_START = 22 * 60;
const NIGHT_END = 6 * 60;

/**
 * Celý stav hry v otvorenom režime (GDD §2.2). Bez Phaseru a DOM – testovateľný.
 * Čas: `now` = milisekundy simulácie od začiatku hry. Hodiny sú z neho odvodené a slúžia iba atmosfére.
 */
export class GameState {
  readonly bus = new EventBus();
  rng: Rng;
  now = 0;
  money: number;
  reputation = 0;
  cats: CatData[] = [];
  reports: Report[] = [];
  adopters: AdopterVisit[] = [];
  adoptions: AdoptionRecord[] = [];
  counters: Counters = emptyCounters();
  challenges: ActiveChallenge[] = [];
  challengeTiers: Record<string, number> = {};
  album: Record<string, AlbumEntry> = {};
  upgrades = { cages: 0, slots: 0 };
  cafe: CafeState = emptyCafe();
  /** Stupeň vybavenia podľa id (GDD §6.1.2). */
  equipment: Record<string, number> = {};
  /** Kúpené dekorácie (GDD §6.1.3). */
  decor: string[] = [];
  /** Komunitný útulok – Fáza 2 (GDD §6.2). */
  shelter = { open: false };
  /** Klinika – Fáza 3 (GDD §6.5). */
  clinic: ClinicState = { open: false, rooms: [], floors: 1 };
  /** Catio – vonkajší výbeh pri kaviarni (GDD §6.6). */
  catio = { open: false };
  /** Mačací hotel (GDD §6.7). */
  hotel: HotelState = emptyHotel();
  /** Edukačné centrum (GDD §6.9). */
  education: EducationState = emptyEducation();
  /** Odomknuté úspechy (id → herný čas odomknutia) – GDD §7.5. */
  achievements: Record<string, number> = {};
  /** Udalosti (GDD §7.3). */
  events: EventsState;
  /** Srdiečka ❤ – za pohľadnice, album, úspechy a udalosti (GDD §7.6). */
  hearts = 0;
  cosmetics: CosmeticsState = { owned: [], walls: {} };
  /** Najatý personál a či práve pracuje (GDD §6.4). */
  staff: Partial<Record<StaffId, { active: boolean }>> = {};
  /** Odpočty personálu a kedy ošetrovateľ naposledy česal mačku (neukladá sa). */
  private staffTimers: Partial<Record<StaffId, number>> = {};
  private brushedAt = new Map<string, number>();
  tutorialStep = 0;
  tutorialDone = false;
  private nextId = 1;
  private reportTimer: number;
  private adopterTimer: number;
  private readyIds = new Set<string>();

  constructor(
    readonly data: GameData,
    seed?: number,
  ) {
    const b = data.balance;
    this.rng = new Rng(seed);
    this.money = b.phase_1.starting_money;
    // Prvé hlásenie a prvý adoptér prídu skôr ako ďalšie
    this.reportTimer = (b.rescue.interval_s - b.rescue.first_delay_s) * 1000;
    this.adopterTimer = (b.adopters.interval_s - b.adopters.first_delay_s) * 1000;
    const ev = data.events;
    this.events = emptyEvents(ev ? (ev.interval_s - ev.first_delay_s) * 1000 : 0);
    this.fillChallenges();
  }

  get rescued(): number {
    return this.counters.rescued;
  }

  // ---------- Hodiny pre atmosféru ----------

  /** Reálne ms na jednu hernú minútu – v noci plynie čas rýchlejšie (GDD §2.2). */
  private msPerGameMinute(minute: number): number {
    const c = this.data.balance.clock;
    const night = minute >= NIGHT_START || minute < NIGHT_END;
    return ((night ? c.night_seconds_per_game_hour : c.real_seconds_per_game_hour) * 1000) / 60;
  }

  /** Herná minúta (môže byť desatinná, 0–1440) po `ms` reálneho času od začiatku hry. */
  private clockAt(ms: number): number {
    const c = this.data.balance.clock;
    const cycle =
      (NIGHT_START - NIGHT_END) * this.msPerGameMinute(12 * 60) +
      (1440 - NIGHT_START + NIGHT_END) * this.msPerGameMinute(0);
    let t = ms % cycle;
    let m = c.start_hour * 60;
    // Prejdi úseky deň/noc až po hranicu, kým sa neminie zvyšný čas
    while (t > 0) {
      const night = m >= NIGHT_START || m < NIGHT_END;
      const boundary = night ? (m >= NIGHT_START ? 1440 + NIGHT_END : NIGHT_END) : NIGHT_START;
      const per = this.msPerGameMinute(m);
      const segMs = (boundary - m) * per;
      if (t < segMs) {
        m += t / per;
        t = 0;
      } else {
        m = boundary % 1440;
        t -= segMs;
      }
    }
    return m % 1440;
  }

  /** Minúty od polnoci (0–1439). */
  get clockMinutes(): number {
    return Math.floor(this.clockAt(this.now));
  }

  get clock(): string {
    const m = this.clockMinutes;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  get dayPhase(): DayPhase {
    const h = this.clockMinutes / 60;
    if (h < NIGHT_END / 60 || h >= NIGHT_START / 60) return 'night';
    if (h < 9) return 'morning';
    if (h < 18) return 'day';
    return 'evening';
  }

  // ---------- Miesto ----------

  get cagedCats(): CatData[] {
    return this.cats.filter((c) => !c.resident);
  }

  get residents(): CatData[] {
    return this.cats.filter((c) => c.resident);
  }

  get cageCount(): number {
    return this.data.balance.phase_1.cages + this.upgrades.cages;
  }

  get residentSlots(): number {
    const b = this.data.balance;
    return b.residents.slots + this.upgrades.slots + (this.cafe.open ? b.cafe.slots : 0);
  }

  /** Klietky v karanténe Komunitného útulku. */
  get quarantineCages(): number {
    if (!this.shelter.open) return 0;
    // počas záchrany z množiarne pomôžu susedia dočasnými klietkami
    return this.data.balance.shelter.quarantine_cages + (this.eventActive('mill') ? 4 : 0);
  }

  get totalCages(): number {
    return this.cageCount + this.quarantineCages;
  }

  /** Pacienti v garáži alebo v karanténe. */
  wardCats(ward: 'garage' | 'quarantine'): CatData[] {
    return this.cagedCats.filter((c) => (c.ward ?? 'garage') === ward);
  }

  freeIn(ward: 'garage' | 'quarantine'): number {
    const cages = ward === 'garage' ? this.cageCount : this.quarantineCages;
    return cages - this.wardCats(ward).length;
  }

  get freeCages(): number {
    return this.totalCages - this.cagedCats.length;
  }

  /** Nástroje na prehliadku, ktoré hráč má (otoskop až v ambulancii útulku). */
  get tools(): DiagnosticTool[] {
    return [
      'hand',
      'thermometer',
      'stethoscope',
      ...(this.shelter.open ? ['otoscope' as const] : []),
      ...(this.hasClinicRoom('lab') ? ['bloodtest' as const] : []),
      ...(this.hasClinicRoom('xray') ? ['xray' as const] : []),
      ...(this.hasClinicRoom('ct') ? ['ct' as const] : []),
    ];
  }

  /** Koľko klietok hlásenie potrebuje (mačacia rodinka viac). */
  cagesNeeded(reportId: string): number {
    const report = this.reports.find((r) => r.id === reportId);
    const def = report && this.data.reports.find((d) => d.id === report.defId);
    return def?.family ? 1 + def.family[1] : 1;
  }

  get freeResidentSlots(): number {
    return this.residentSlots - this.residents.length;
  }

  /** Naša mačka alebo hosť hotela. */
  getCat(id: string): CatData | undefined {
    return this.cats.find((c) => c.id === id) ?? this.hotel.guests.find((c) => c.id === id);
  }

  isReady(cat: CatData): boolean {
    return Care.isReady(cat, this.data);
  }

  /** Dary za minútu od návštevníkov (GDD §5.4) – spokojnejšie stálice prinášajú viac. */
  get donationsPerMinute(): number {
    const b = this.data.balance;
    const rate =
      b.residents.donation_per_min *
      (this.cafe.open ? b.cafe.donation_multiplier : 1) *
      this.equipmentEffect('beds');
    return this.residents.reduce((sum, c) => sum + rate * (0.5 + c.stats.satisfaction / 100), 0);
  }

  // ---------- Čas ----------

  /** Hra beží: `deltaMs` reálnych milisekúnd. */
  tick(deltaMs: number): void {
    if (deltaMs <= 0) return;
    const minutes = deltaMs / MINUTE;
    this.now += deltaMs;

    const mods = {
      satisfactionDecay: this.equipmentEffect('scratcher'),
      healthRecovery: this.equipmentEffect('medicine'),
    };
    // Stálice s výbehom sa nudia pomalšie (GDD §6.6)
    const outside = {
      ...mods,
      satisfactionDecay: mods.satisfactionDecay * this.data.balance.catio.satisfaction_decay_mult,
    };
    for (const cat of this.cats)
      Care.passTime(cat, minutes, this.data, this.catio.open && cat.resident ? outside : mods);
    this.advanceHotel(deltaMs, true);
    this.advanceEducation(deltaMs);
    this.advanceEvents(deltaMs);
    this.addMoney(this.donationsPerMinute * minutes, false);
    this.advanceReports(deltaMs);
    this.advanceAdopters(deltaMs);
    this.advanceGuests(deltaMs);
    this.advanceStaff(deltaMs);
    this.deliverPostcards();
    this.checkReadiness();
    this.checkAchievements();
  }

  /**
   * Hra bola zatvorená `elapsedMs` (GDD §2.3): beží iba to dobré –
   * hlásenia, dary (max. 8 h) a pohľadnice. Potreby mačiek neklesajú, adoptéri neprichádzajú.
   */
  applyOffline(elapsedMs: number): OfflineSummary {
    const summary: OfflineSummary = { minutes: 0, reports: 0, donations: 0, postcards: 0 };
    if (elapsedMs <= 0) return summary;
    summary.minutes = Math.round(elapsedMs / MINUTE);

    const capMs = this.data.balance.residents.offline_cap_h * 60 * MINUTE;
    const donations = this.donationsPerMinute * (Math.min(elapsedMs, capMs) / MINUTE);
    this.addMoney(donations, false);
    summary.donations = Math.floor(donations);

    const before = this.reports.length;
    this.advanceReports(elapsedMs);
    summary.reports = this.reports.length - before;

    this.now += elapsedMs;
    // hostia hotela, ktorých si majitelia medzitým vyzdvihli, zaplatia
    const before2 = this.money;
    this.advanceHotel(0, false);
    summary.donations += Math.floor(this.money - before2);
    const delivered = this.deliverPostcards();
    summary.postcards = delivered;
    return summary;
  }

  private advanceReports(deltaMs: number): void {
    const r = this.data.balance.rescue;
    // v zime prichádza 2× viac hlásení
    const interval = r.interval_s * 1000 * (this.eventActive('winter') ? 0.5 : 1);
    this.reportTimer += deltaMs;
    while (this.reportTimer >= interval) {
      if (this.reports.length >= r.max_waiting) {
        this.reportTimer = interval; // plná nástenka – ďalšie príde hneď, ako sa uvoľní miesto
        return;
      }
      this.reportTimer -= interval;
      const pool = this.data.reports.filter(
        (d) =>
          d.requires !== 'event' &&
          (d.requires !== 'shelter' || this.shelter.open) &&
          // prípady z inej útulne, až keď je čím ich odhaliť
          (d.requires !== 'clinic' || this.hasClinicRoom('lab') || this.hasClinicRoom('xray')),
      );
      const def = this.rng.weighted(pool, (d) => d.weight);
      const report: Report = { id: this.newId('r'), defId: def.id };
      this.reports.push(report);
      this.bus.emit('reportAdded', { report });
    }
  }

  private advanceAdopters(deltaMs: number): void {
    const a = this.data.balance.adopters;
    // Adoptéri chodia iba vtedy, keď je komu nájsť domov
    if (!this.cats.some((c) => this.isReady(c))) return;
    const social = this.staffWorking('social') ? this.data.balance.staff.social : null;
    const openDay = this.eventActive('openday');
    const interval =
      a.interval_s * 1000 * (social?.adopter_interval_mult ?? 1) * (openDay ? 0.35 : 1);
    this.adopterTimer += deltaMs;
    if (this.adopterTimer < interval) return;
    const maxWaiting =
      a.max_waiting +
      (this.hasUnlock('adopters_plus') ? 1 : 0) +
      (social?.extra_waiting ?? 0) +
      (openDay ? 1 : 0);
    if (this.adopters.length >= maxWaiting) {
      this.adopterTimer = interval;
      return;
    }
    this.adopterTimer = 0;
    // Uprednostni typ, ktorý ešte nečaká
    const waiting = new Set(this.adopters.map((v) => v.defId));
    const pool = this.data.adopters.filter((d) => !waiting.has(d.id));
    const options = pool.length ? pool : this.data.adopters;
    let def = this.rng.pick(options);
    // Správca sietí často nájde záujemcu, ktorý sa k niektorej mačke hodí najlepšie
    if (social && this.rng.chance(social.best_match_chance)) {
      const ready = this.cats.filter((c) => this.isReady(c));
      const best = (d: (typeof options)[number]) =>
        Math.max(...ready.map((c) => computeMatch(c, d, this.data, true).score));
      def = options.reduce((x, y) => (best(y) > best(x) ? y : x), def);
    }
    const visit: AdopterVisit = {
      id: this.newId('a'),
      defId: def.id,
      sprite: this.rng.pick(def.sprites),
    };
    this.adopters.push(visit);
    this.bus.emit('adopterArrived', { visit });
  }

  private deliverPostcards(): number {
    let count = 0;
    for (const rec of this.adoptions) {
      if (!rec.postcardDelivered && rec.postcardDueAt !== null && this.now >= rec.postcardDueAt) {
        rec.postcardDelivered = true;
        count += 1;
        this.addHearts(this.heartRate('postcard'));
        this.bus.emit('postcardArrived', { record: rec });
      }
    }
    if (count > 0) this.pruneAdoptions();
    return count;
  }

  /**
   * Záznamy adopcií rastú donekonečna – nechá sa iba to, čo hra ešte ukáže:
   * pohľadnice na ceste, pripnuté a posledných `postcard_keep` doručených.
   * (Počty adopcií sú v `counters`, album má vlastný zoznam.)
   */
  private pruneAdoptions(): void {
    const keep = this.data.balance.rewards.postcard_keep;
    let delivered = 0;
    const kept: AdoptionRecord[] = [];
    for (let i = this.adoptions.length - 1; i >= 0; i--) {
      const rec = this.adoptions[i]!;
      const pending = !rec.postcardDelivered && rec.postcardDueAt !== null;
      const recent = rec.postcardDelivered && !rec.pinned && delivered++ < keep;
      // posledná adopcia ostane vždy (napr. pre okno rozlúčky)
      if (pending || rec.pinned || recent || i === this.adoptions.length - 1) kept.push(rec);
    }
    this.adoptions = kept.reverse();
  }

  /** Doručené pohľadnice od najnovšej. */
  get postcards(): AdoptionRecord[] {
    return this.adoptions.filter((a) => a.postcardDelivered).reverse();
  }

  get pinnedCount(): number {
    return this.adoptions.filter((a) => a.pinned).length;
  }

  /** Pripne / odopne pohľadnicu na nástenku (max `postcard_pins`). */
  togglePin(catId: string): boolean {
    const rec = this.adoptions.find((a) => a.cat.id === catId && a.postcardDelivered);
    if (!rec) return false;
    if (!rec.pinned && this.pinnedCount >= this.data.balance.rewards.postcard_pins) return false;
    rec.pinned = !rec.pinned;
    return true;
  }

  private checkReadiness(): void {
    for (const cat of this.cats) {
      const ready = this.isReady(cat);
      if (ready && !this.readyIds.has(cat.id)) {
        this.readyIds.add(cat.id);
        this.bus.emit('catBecameReady', { cat });
      } else if (!ready) this.readyIds.delete(cat.id);
    }
  }

  // ---------- Akcie hráča ----------

  /** Prijme hlásenie – mačka príde do voľnej klietky. */
  acceptReport(reportId: string): CatData | null {
    const report = this.reports.find((r) => r.id === reportId);
    const def = report && this.data.reports.find((d) => d.id === report.defId);
    if (!report || !def || this.freeCages < this.cagesNeeded(reportId)) return null;
    this.reports = this.reports.filter((r) => r !== report);
    const make = (age: CatData['age'] | null, conditions: number) =>
      generateCat(this.data, this.rng, {
        id: this.newId('cat'),
        age,
        conditionCount: conditions,
        reportId: def.id,
        now: this.now,
        rareBoost: this.hasUnlock('rare_cats'),
        tools: this.tools,
        surgery: this.hasClinicRoom('or'),
        pool: this.hasClinicRoom('pool'),
        clinicCase: !!def.clinic_case && age !== 'kitten',
        event: this.events.active?.id,
      });
    const cat = make(def.age, def.difficulty);
    const family = [cat];
    // Mačacia rodinka: mačiatka po mame (rovnaké plemeno a farba)
    if (def.family) {
      const n = this.rng.int(def.family[0], def.family[1]);
      for (let i = 0; i < n; i++) {
        const kitten = make('kitten', 1);
        kitten.breedId = cat.breedId;
        kitten.coatId = cat.coatId;
        kitten.sprite = cat.sprite;
        family.push(kitten);
      }
    }
    for (const c of family) {
      // Meno sa v útulku nesmie opakovať (napr. mama a mačiatko)
      const used = new Set(this.cats.map((x) => x.name));
      if (used.has(c.name)) {
        const names = [...(this.data.names.by_coat[c.coatId] ?? []), ...this.data.names.generic];
        const free = names.filter((n) => !used.has(n));
        if (free.length) c.name = this.rng.pick(free);
      }
      // do garáže, a keď je plná, do karantény
      c.ward = this.freeIn('garage') > 0 ? 'garage' : 'quarantine';
      this.cats.push(c);
      this.counters.rescued += 1;
      if (c.age === 'kitten') this.counters.kittens += 1;
      this.bus.emit('catAdmitted', { cat: c });
    }
    this.checkChallenges();
    return cat;
  }

  /** Presun pacienta medzi garážou a karanténou (ak je tam voľná klietka). */
  moveCat(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || cat.resident || !this.shelter.open) return false;
    const to = (cat.ward ?? 'garage') === 'garage' ? 'quarantine' : 'garage';
    if (this.freeIn(to) <= 0) return false;
    cat.ward = to;
    this.bus.emit('catMoved', { cat });
    return true;
  }

  // ---------- Komunitný útulok (GDD §6.2) ----------

  /** Čo ešte chýba na kúpu útulku (prázdne = dá sa kúpiť, ak sú peniaze). */
  get shelterMissing(): { rep: number; rescued: number } {
    const b = this.data.balance.shelter;
    return {
      rep: this.hasUnlock('shelter_2') ? 0 : (this.unlockRep('shelter_2') ?? 0) - this.reputation,
      rescued: Math.max(0, b.min_rescued - this.counters.rescued),
    };
  }

  buyShelter(): boolean {
    const b = this.data.balance.shelter;
    const miss = this.shelterMissing;
    if (this.shelter.open || miss.rep > 0 || miss.rescued > 0 || this.money < b.price) return false;
    this.addMoney(-b.price, true);
    this.openShelter();
    return true;
  }

  private openShelter(): void {
    this.shelter.open = true;
    this.bus.emit('upgradeBought', { kind: 'shelter' });
    this.fillChallenges();
  }

  // ---------- Klinika (GDD §6.5) ----------

  hasClinicRoom(room: ClinicRoomId): boolean {
    return this.clinic.open && this.clinic.rooms.includes(room);
  }

  /** Čo ešte chýba na kúpu kliniky: ★ (úroveň 5) a Komunitný útulok. */
  get clinicMissing(): { rep: number; shelter: boolean } {
    return {
      rep: this.hasUnlock('clinic') ? 0 : (this.unlockRep('clinic') ?? 0) - this.reputation,
      shelter: !this.shelter.open,
    };
  }

  buyClinic(): boolean {
    const miss = this.clinicMissing;
    const price = this.data.balance.clinic.price;
    if (this.clinic.open || miss.rep > 0 || miss.shelter || this.money < price) return false;
    this.addMoney(-price, true);
    this.openClinic();
    return true;
  }

  private openClinic(): void {
    this.clinic.open = true;
    this.bus.emit('upgradeBought', { kind: 'clinic' });
  }

  clinicRoomPrice(room: ClinicRoomId): number {
    return this.data.balance.clinic.rooms[room];
  }

  /** Odomknutie potrebné pre miestnosť (CT a bazén sú na 2. poschodí, úroveň 7). */
  clinicRoomUnlock(room: ClinicRoomId): Unlock | null {
    return room === 'ct' ? 'ct' : room === 'pool' ? 'pool' : null;
  }

  get hasFloor2(): boolean {
    return this.clinic.open && this.clinic.floors >= 2;
  }

  /** 2. poschodie kliniky – úroveň 7 (GDD §6.8). */
  buyFloor(): boolean {
    const price = this.data.balance.clinic.floor_price;
    if (!this.clinic.open || this.hasFloor2 || !this.hasUnlock('floors') || this.money < price)
      return false;
    this.addMoney(-price, true);
    this.clinic.floors = 2;
    this.bus.emit('upgradeBought', { kind: 'floor' });
    return true;
  }

  buyClinicRoom(room: ClinicRoomId): boolean {
    const price = this.clinicRoomPrice(room);
    if (!this.clinic.open || this.clinic.rooms.includes(room) || this.money < price) return false;
    if (FLOOR2_ROOMS.includes(room) && !this.hasFloor2) return false;
    const unlock = this.clinicRoomUnlock(room);
    if (unlock && !this.hasUnlock(unlock)) return false;
    this.addMoney(-price, true);
    this.clinic.rooms.push(room);
    this.bus.emit('clinicRoomBought', { room });
    return true;
  }

  /** Miestnosť, bez ktorej sa diagnóza nedá liečiť (operačná sála, bazén), alebo null. */
  treatmentRoom(conditionId: string): ClinicRoomId | null {
    const game = this.data.conditions.find((d) => d.id === conditionId)?.minigame;
    return game === 'surgery' ? 'or' : game === 'swim' ? 'pool' : null;
  }

  /** Rehabilitácia v bazéne: po zlomenine, operácii alebo chrbtici, raz za pobyt. */
  canRehab(cat: CatData): boolean {
    if (!this.hasClinicRoom('pool') || cat.rehabbed || cat.resident || cat.hotel) return false;
    const after = ['fracture', 'swallowed', 'spine'];
    return Care.allTreated(cat) && cat.conditions.some((c) => after.includes(c.id));
  }

  rehab(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || !this.canRehab(cat)) return false;
    cat.rehabbed = true;
    Care.addStats(cat, { health: this.data.balance.clinic.rehab_health, satisfaction: 10 });
    this.changed(cat);
    this.bus.emit('clinicVisit', { cat, room: 'pool', recover: false });
    return true;
  }

  /** Kastrácia sa dá: operačná sála, zdravá dospelá mačka, ešte nekastrovaná. */
  canNeuter(cat: CatData): boolean {
    return (
      this.hasClinicRoom('or') && cat.age !== 'kitten' && !cat.neutered && Care.allTreated(cat)
    );
  }

  neuter(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || !this.canNeuter(cat)) return false;
    cat.neutered = true;
    this.counters.neutered += 1;
    this.changed(cat);
    this.bus.emit('clinicVisit', { cat, room: 'or', recover: true });
    return true;
  }

  // ---------- Mačací hotel (GDD §6.7) ----------

  get suiteCount(): number {
    return this.hotel.open ? this.data.balance.hotel.suites + this.hotel.suites : 0;
  }

  get nextSuitePrice(): number | null {
    if (!this.hotel.open) return null;
    return this.data.balance.hotel.suite_prices[this.hotel.suites] ?? null;
  }

  get hotelMissing(): { rep: number } {
    return { rep: this.hasUnlock('hotel') ? 0 : (this.unlockRep('hotel') ?? 0) - this.reputation };
  }

  buyHotel(): boolean {
    const price = this.data.balance.hotel.price;
    if (this.hotel.open || this.hotelMissing.rep > 0 || this.money < price) return false;
    this.addMoney(-price, true);
    this.openHotel();
    return true;
  }

  private openHotel(): void {
    const h = this.data.balance.hotel;
    this.hotel.open = true;
    this.hotel.timer = (h.arrival_interval_s - h.first_delay_s) * 1000;
    this.bus.emit('upgradeBought', { kind: 'hotel' });
  }

  buySuite(): boolean {
    const price = this.nextSuitePrice;
    if (price === null || this.money < price) return false;
    this.addMoney(-price, true);
    this.hotel.suites += 1;
    this.bus.emit('upgradeBought', { kind: 'suite' });
    return true;
  }

  /** Priemerná spokojnosť hosťa za doterajší pobyt (0–100). */
  hotelHappiness(cat: CatData): number {
    const stay = cat.hotel;
    const now = (cat.stats.satisfaction + cat.stats.cleanliness) / 2;
    if (!stay || stay.minutes <= 0) return now;
    return stay.happySum / stay.minutes;
  }

  /** Koľko by majiteľ zaplatil, keby prišiel teraz. */
  hotelFee(cat: CatData): number {
    const h = this.data.balance.hotel;
    return Math.round((h.fee * (0.5 + this.hotelHappiness(cat) / 100)) / 5) * 5;
  }

  /** Hostia: starnutie potrieb, odchody (platba) a príchody cez deň. */
  private advanceHotel(deltaMs: number, arrivals: boolean): void {
    if (!this.hotel.open) return;
    const h = this.data.balance.hotel;
    const minutes = deltaMs / MINUTE;
    for (const cat of this.hotel.guests) {
      if (minutes > 0) {
        Care.passTime(cat, minutes, this.data, {
          satisfactionDecay: h.decay_mult,
          healthRecovery: 1,
        });
        if (cat.hotel) {
          cat.hotel.happySum += ((cat.stats.satisfaction + cat.stats.cleanliness) / 2) * minutes;
          cat.hotel.minutes += minutes;
        }
      }
    }
    for (const cat of [...this.hotel.guests]) {
      if (!cat.hotel || this.now < cat.hotel.checkoutAt) continue;
      const happy = Math.round(this.hotelHappiness(cat));
      const fee = this.hotelFee(cat);
      const rep = happy >= h.happy_at ? h.rep_happy : 0;
      this.hotel.guests = this.hotel.guests.filter((x) => x !== cat);
      this.counters.hotel += 1;
      this.addMoney(fee, true);
      this.gainRep(rep);
      this.bus.emit('hotelCheckOut', { cat, fee, happy, rep });
      this.checkChallenges();
    }
    if (!arrivals || this.dayPhase === 'night') return;
    if (this.hotel.guests.length >= this.suiteCount) return;
    this.hotel.timer += deltaMs;
    if (this.hotel.timer < h.arrival_interval_s * 1000) return;
    this.hotel.timer = 0;
    this.checkInGuest();
  }

  private checkInGuest(): CatData {
    const h = this.data.balance.hotel;
    const cat = generateCat(this.data, this.rng, {
      id: this.newId('hotel'),
      conditionCount: 0,
      now: this.now,
    });
    // majiteľ o nej všetko povie – rysy sú známe
    for (const t of cat.traits) t.revealed = true;
    cat.examined = [...this.tools];
    cat.stats = {
      health: 100,
      cleanliness: this.rng.int(50, 80),
      trust: this.rng.int(35, 70),
      satisfaction: this.rng.int(50, 80),
    };
    const used = new Set([...this.cats, ...this.hotel.guests].map((c) => c.name));
    if (used.has(cat.name)) {
      const free = this.data.names.generic.filter((n) => !used.has(n));
      if (free.length) cat.name = this.rng.pick(free);
    }
    cat.hotel = {
      owner: this.rng.pick(this.data.balance.cafe.guest_sprites),
      arrivedAt: this.now,
      checkoutAt: this.now + this.rng.int(h.stay_s[0], h.stay_s[1]) * 1000,
      happySum: 0,
      minutes: 0,
    };
    this.hotel.guests.push(cat);
    this.bus.emit('hotelCheckIn', { cat });
    return cat;
  }

  // ---------- Srdiečka a kozmetika (GDD §7.6) ----------

  private heartRate(kind: keyof GameState['data']['cosmetics']['hearts']): number {
    return this.data.cosmetics?.hearts[kind] ?? 0;
  }

  private addHearts(n: number): void {
    if (n <= 0) return;
    this.hearts += n;
    this.bus.emit('heartsChanged', { hearts: this.hearts, delta: n });
  }

  wallDef(id: string): WallColorDef | undefined {
    return this.data.cosmetics?.walls.find((w) => w.id === id);
  }

  /** Kúpa farby stien za srdiečka (raz – potom sa dá použiť v oboch miestnostiach). */
  buyCosmetic(id: string): boolean {
    const def = this.wallDef(id);
    if (!def || this.cosmetics.owned.includes(id) || this.hearts < def.price) return false;
    this.hearts -= def.price;
    this.cosmetics.owned.push(id);
    this.bus.emit('heartsChanged', { hearts: this.hearts, delta: -def.price });
    return true;
  }

  /** Farba stien miestnosti (null = pôvodná). */
  setWall(room: 'garage' | 'cafe', id: string | null): boolean {
    if (id && !this.cosmetics.owned.includes(id)) return false;
    if (id) this.cosmetics.walls[room] = id;
    else delete this.cosmetics.walls[room];
    this.bus.emit('wallChanged', { room, id });
    return true;
  }

  // ---------- Udalosti (GDD §7.3) ----------

  eventDef(id: EventDef['id']): EventDef | undefined {
    return this.data.events?.events.find((e) => e.id === id);
  }

  eventActive(id: EventDef['id']): boolean {
    return this.events.active?.id === id;
  }

  /** Udalosti, ktoré sa môžu ponúknuť (úroveň, kaviareň, útulok). */
  private eligibleEvents(): EventDef[] {
    return (this.data.events?.events ?? []).filter(
      (e) =>
        this.level + 1 >= e.min_level &&
        (e.requires !== 'cafe' || this.cafe.open) &&
        (e.requires !== 'shelter' || this.shelter.open),
    );
  }

  /** Postup cieľa prebiehajúcej udalosti. */
  get eventProgress(): { have: number; need: number } | null {
    const a = this.events.active;
    const def = a && this.eventDef(a.id);
    if (!a || !def) return null;
    return {
      have: Math.min(def.goal.target, this.counters[def.goal.kind] - a.start),
      need: def.goal.target,
    };
  }

  private advanceEvents(deltaMs: number): void {
    const ev = this.data.events;
    if (!ev) return;
    const a = this.events.active;
    if (a) {
      if (this.now >= a.endsAt) this.endEvent();
      return;
    }
    if (this.events.offer) return;
    this.events.timer += deltaMs;
    if (this.events.timer < ev.interval_s * 1000) return;
    const pool = this.eligibleEvents();
    if (!pool.length) {
      this.events.timer = ev.interval_s * 1000;
      return;
    }
    this.events.timer = 0;
    // najmenej hraná udalosť má prednosť
    const least = Math.min(...pool.map((e) => this.events.done[e.id] ?? 0));
    const def = this.rng.pick(pool.filter((e) => (this.events.done[e.id] ?? 0) === least));
    this.events.offer = def.id;
    this.bus.emit('eventOffered', { def });
  }

  acceptEvent(): boolean {
    const id = this.events.offer;
    const def = id && this.eventDef(id);
    if (!def || this.events.active) return false;
    this.events.offer = null;
    this.events.active = {
      id: def.id,
      startedAt: this.now,
      endsAt: this.now + def.duration_s * 1000,
      start: this.counters[def.goal.kind],
    };
    // množiareň: hneď príde veľká rodinka (mama a mačiatka)
    if (def.id === 'mill') {
      const report: Report = { id: this.newId('r'), defId: 'mill' };
      this.reports.push(report);
      this.bus.emit('reportAdded', { report });
    }
    this.bus.emit('eventStarted', { def });
    return true;
  }

  /** Odložiť ponuku – ďalšia príde neskôr. */
  declineEvent(): void {
    const ev = this.data.events;
    if (!this.events.offer || !ev) return;
    this.events.offer = null;
    this.events.timer = (ev.interval_s - ev.decline_delay_s) * 1000;
  }

  /** Koniec udalosti: odmena vždy, bonus za splnený cieľ (udalosti nikdy nezlyhajú). */
  private endEvent(): void {
    const a = this.events.active;
    const def = a && this.eventDef(a.id);
    if (!a || !def) return;
    const p = this.eventProgress;
    const bonus = !!p && p.have >= p.need;
    const money = def.money + (bonus ? def.bonus_money : 0);
    const rep = def.rep + (bonus ? def.bonus_rep : 0);
    this.events.active = null;
    this.events.done[def.id] = (this.events.done[def.id] ?? 0) + 1;
    this.addMoney(money, true);
    this.gainRep(rep);
    if (bonus) this.addHearts(this.heartRate('event_bonus'));
    this.bus.emit('eventEnded', { def, bonus, money, rep });
  }

  // ---------- Edukačné centrum (GDD §6.9) ----------

  get educationMissing(): { rep: number; cafe: boolean } {
    return {
      rep: this.hasUnlock('education') ? 0 : (this.unlockRep('education') ?? 0) - this.reputation,
      cafe: !this.cafe.open,
    };
  }

  buyEducation(): boolean {
    const e = this.data.balance.education;
    const miss = this.educationMissing;
    if (this.education.open || miss.rep > 0 || miss.cafe || this.money < e.price) return false;
    this.addMoney(-e.price, true);
    this.openEducation();
    return true;
  }

  private openEducation(): void {
    const e = this.data.balance.education;
    this.education.open = true;
    this.education.timer = (e.interval_s - e.first_delay_s) * 1000;
    this.bus.emit('upgradeBought', { kind: 'education' });
  }

  /** Výlety prichádzajú cez deň; nevyužitý výlet po chvíli odíde s polovičným darom. */
  private advanceEducation(deltaMs: number): void {
    if (!this.education.open) return;
    const e = this.data.balance.education;
    const trip = this.education.trip;
    if (trip) {
      if (this.now >= trip.leaveAt) this.endTrip(0);
      return;
    }
    if (this.dayPhase === 'night' || this.dayPhase === 'evening') return;
    this.education.timer += deltaMs;
    if (this.education.timer < e.interval_s * 1000) return;
    this.education.timer = 0;
    this.startTrip();
  }

  private startTrip(): SchoolTrip {
    const e = this.data.balance.education;
    const n = this.rng.int(e.kids[0], e.kids[1]);
    const trip: SchoolTrip = {
      id: this.newId('trip'),
      kids: this.rng.sample(e.kid_sprites, Math.min(n, e.kid_sprites.length)),
      teacher: e.teacher_sprite,
      arrivedAt: this.now,
      leaveAt: this.now + e.wait_s * 1000,
    };
    this.education.trip = trip;
    this.bus.emit('tripArrived', { trip });
    return trip;
  }

  /** Prednáška (kvíz) – deti si pohladkajú stálice a zanechajú dar; viac ★ za lepší kvíz. */
  giveLecture(stars: Care.Stars): boolean {
    if (!this.education.trip) return false;
    this.endTrip(stars);
    return true;
  }

  private endTrip(stars: number): void {
    const trip = this.education.trip;
    if (!trip) return;
    const e = this.data.balance.education;
    const money = Math.round(trip.kids.length * e.donation_per_kid * (stars > 0 ? 1 : 0.5));
    const rep = e.rep_by_stars[stars] ?? 0;
    this.education.trip = null;
    this.addMoney(money, true);
    this.gainRep(rep);
    if (stars > 0) {
      this.counters.lectures += 1;
      // deti povedia doma o útulku – záujemca o adopciu príde skôr
      this.adopterTimer = this.data.balance.adopters.interval_s * 1000;
      for (const cat of this.residents) Care.addStats(cat, { satisfaction: 8, trust: 3 });
    }
    this.bus.emit('tripLeft', { trip, stars, money, rep });
    this.checkChallenges();
  }

  // ---------- Catio (GDD §6.6) ----------

  /** Čo ešte chýba na stavbu výbehu: ★ (úroveň 6) a kaviareň. */
  get catioMissing(): { rep: number; cafe: boolean } {
    return {
      rep: this.hasUnlock('catio') ? 0 : (this.unlockRep('catio') ?? 0) - this.reputation,
      cafe: !this.cafe.open,
    };
  }

  buyCatio(): boolean {
    const miss = this.catioMissing;
    const price = this.data.balance.catio.price;
    if (this.catio.open || miss.rep > 0 || miss.cafe || this.money < price) return false;
    this.addMoney(-price, true);
    this.openCatio();
    return true;
  }

  private openCatio(): void {
    this.catio.open = true;
    this.bus.emit('upgradeBought', { kind: 'catio' });
  }

  /** Očkovanie v ambulancii – iba zdravá, ešte neočkovaná mačka. */
  vaccinate(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || !this.shelter.open || cat.vaccinated || !Care.allTreated(cat)) return false;
    cat.vaccinated = true;
    this.counters.vaccinated += 1;
    Care.addStats(cat, { health: 5 });
    this.changed(cat);
    return true;
  }

  /** Hlásenie prevezme iný útulok – bez trestu (GDD §3.1). */
  declineReport(reportId: string): void {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) return;
    this.reports = this.reports.filter((r) => r !== report);
    this.bus.emit('reportDeclined', { report });
  }

  examine(catId: string, tool: DiagnosticTool): string[] {
    const cat = this.getCat(catId);
    if (!cat) return [];
    const found = Care.examine(cat, tool, this.data);
    this.changed(cat);
    if (tool === 'bloodtest' || tool === 'xray' || tool === 'ct')
      this.bus.emit('clinicVisit', {
        cat,
        room: tool === 'bloodtest' ? 'lab' : tool,
        recover: false,
      });
    return found;
  }

  treat(catId: string, conditionId: string, stars: Care.Stars): boolean {
    const cat = this.getCat(catId);
    const needs = this.treatmentRoom(conditionId);
    if (!cat || (needs && !this.hasClinicRoom(needs))) return false;
    if (!Care.treat(cat, conditionId, stars, this.data)) return false;
    const game = this.data.conditions.find((d) => d.id === conditionId)?.minigame;
    if (game === 'surgery' || game === 'splint')
      this.bus.emit('clinicVisit', { cat, room: 'or', recover: game === 'surgery' });
    if (game === 'swim') this.bus.emit('clinicVisit', { cat, room: 'pool', recover: false });
    this.counters.treated += 1;
    if (conditionId === 'ticks') this.counters.ticks += 1;
    this.changed(cat);
    return true;
  }

  socialize(catId: string, activity: SocialActivity, stars: Care.Stars): Care.SocialResult | null {
    const cat = this.getCat(catId);
    if (!cat) return null;
    const result = Care.socialize(cat, activity, stars, this.now, this.data, this.trustMult);
    if (result) {
      this.counters.social += 1;
      this.changed(cat);
    }
    return result;
  }

  socialCooldownLeft(catId: string): number {
    const cat = this.getCat(catId);
    return cat ? Care.socialCooldownLeft(cat, this.now, this.data) : 0;
  }

  feed(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || !Care.feed(cat, this.now, this.data, this.equipmentEffect('feeder'))) return false;
    this.counters.fed += 1;
    this.changed(cat);
    return true;
  }

  feedCooldownLeft(catId: string): number {
    const cat = this.getCat(catId);
    return cat
      ? Care.feedCooldownLeft(cat, this.now, this.data, this.equipmentEffect('feeder'))
      : 0;
  }

  /** Nechať si mačku ako stálicu (GDD §5.4) – uvoľní klietku. */
  makeResident(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || cat.resident || !this.isReady(cat) || this.freeResidentSlots <= 0) return false;
    cat.resident = true;
    this.addToAlbum(cat, 'resident');
    this.addRareToAlbum(cat, 'resident');
    this.bus.emit('catBecameResident', { cat });
    this.changed(cat);
    return true;
  }

  matchFor(catId: string, visitId: string, onlyRevealed = true): MatchResult | null {
    const cat = this.getCat(catId);
    const def = this.adopterDef(visitId);
    return cat && def ? computeMatch(cat, def, this.data, onlyRevealed) : null;
  }

  adopterDef(visitId: string) {
    const visit = this.adopters.find((v) => v.id === visitId);
    return visit ? this.data.adopters.find((d) => d.id === visit.defId) : undefined;
  }

  /** Adopcia (GDD §5.3). Mačka musí byť pripravená; stálicu možno adoptovať tiež. */
  adopt(catId: string, visitId: string): AdoptionRecord | null {
    const cat = this.getCat(catId);
    const visit = this.adopters.find((v) => v.id === visitId);
    const def = this.adopterDef(visitId);
    if (!cat || !visit || !def || !this.isReady(cat)) return null;
    const match = computeMatch(cat, def, this.data);
    if (match.quality === 'blocked') return null;

    const r = this.data.balance.rewards;
    // Vzácnejšie plemeno = vyšší príspevok (+15 % za každý stupeň vzácnosti)
    const rarity = this.data.breeds.find((b) => b.id === cat.breedId)?.rarity ?? 1;
    const fee =
      Math.round(
        ((r.adoption_fee_min + ((r.adoption_fee_max - r.adoption_fee_min) * match.score) / 100) *
          (1 + 0.15 * (rarity - 1)) *
          // zaočkovaná mačka = vyšší príspevok (GDD §6.2)
          (cat.vaccinated ? 1 + this.data.balance.shelter.vaccine_fee_bonus : 1) *
          // kastrácia a prípad z inej útulne (GDD §6.5)
          (cat.neutered ? 1 + this.data.balance.clinic.neuter_fee_bonus : 1) *
          (cat.clinicCase ? 1 + this.data.balance.clinic.case_fee_bonus : 1) *
          (cat.rehabbed ? 1 + this.data.balance.clinic.rehab_fee_bonus : 1) *
          // vzácna mačka (GDD §7.2)
          (cat.special ? 1 + this.data.balance.rare.fee_bonus : 1)) /
          5,
      ) * 5;
    const rep =
      (match.quality === 'perfect'
        ? r.rep_perfect
        : match.quality === 'good'
          ? r.rep_good
          : r.rep_poor) +
      (cat.vaccinated ? this.data.balance.shelter.vaccine_rep_bonus : 0) +
      (cat.neutered ? this.data.balance.clinic.neuter_rep_bonus : 0) +
      (cat.clinicCase ? this.data.balance.clinic.case_rep_bonus : 0) +
      (cat.special ? this.data.balance.rare.rep_bonus : 0);
    const postcard =
      match.quality === 'perfect' ||
      (match.quality === 'good' && this.rng.chance(r.postcard_chance_good));
    const delay = this.rng.int(r.postcard_delay_s[0], r.postcard_delay_s[1]) * 1000;

    for (const t of cat.traits) t.revealed = true; // nový majiteľ prezradí, aká naozaj je
    const record: AdoptionRecord = {
      cat: structuredClone(cat),
      adopterDefId: def.id,
      adopterSprite: visit.sprite,
      score: match.score,
      fee,
      adoptedAt: this.now,
      postcardDueAt: postcard ? this.now + delay : null,
      postcardDelivered: false,
      postcardSeen: false,
    };
    this.cats = this.cats.filter((c) => c !== cat);
    this.adopters = this.adopters.filter((v) => v !== visit);
    this.readyIds.delete(cat.id);
    this.adoptions.push(record);
    this.pruneAdoptions();
    this.counters.adopted += 1;
    if (match.quality === 'perfect') this.counters.perfect += 1;
    if (cat.traits.some((t) => t.id === 'shy')) this.counters.shy_homed += 1;
    if (!cat.resident) this.addToAlbum(cat, 'adopted');
    if (!cat.resident) this.addRareToAlbum(cat, 'adopted');
    this.addMoney(fee, true);
    this.gainRep(rep);
    this.bus.emit('catAdopted', { record });
    this.checkChallenges();
    return record;
  }

  /** Záujemca odíde bez mačky – nič sa nestane (GDD §2.2: nikto neodchádza nahnevaný). */
  dismissAdopter(visitId: string): void {
    const visit = this.adopters.find((v) => v.id === visitId);
    if (!visit) return;
    this.adopters = this.adopters.filter((v) => v !== visit);
    this.bus.emit('adopterLeft', { visit });
  }

  markPostcardSeen(record: AdoptionRecord): void {
    record.postcardSeen = true;
  }

  // ---------- Výzvy (GDD §7.3) ----------

  challengeDef(defId: string): ChallengeDef | undefined {
    return this.data.challenges.find((d) => d.id === defId);
  }

  /** Aktuálny postup výzvy (môže presiahnuť cieľ). */
  challengeProgress(ch: ActiveChallenge): number {
    const def = this.challengeDef(ch.defId);
    if (!def) return 0;
    if (def.kind === 'residents') return this.residents.length;
    return this.counters[def.kind] - ch.start;
  }

  /** Doplní nástenku na počet aktívnych výziev – vyberá typy, ktoré na nej ešte nie sú. */
  private fillChallenges(): void {
    const want = this.data.balance.challenges.active;
    while (this.challenges.length < want) {
      const active = new Set(this.challenges.map((c) => c.defId));
      const pool = this.data.challenges.filter(
        (d) =>
          !active.has(d.id) &&
          (d.requires !== 'cafe' || this.cafe.open) &&
          (d.requires !== 'shelter' || this.shelter.open),
      );
      if (pool.length === 0) return;
      const def = this.rng.weighted(pool, (d) => d.weight);
      const tier = this.challengeTiers[def.id] ?? 0;
      this.challenges.push({
        defId: def.id,
        target: def.base + def.step * tier,
        start: def.kind === 'residents' ? 0 : this.counters[def.kind],
        completed: false,
      });
    }
    this.checkChallenges();
  }

  // ---------- Úspechy (GDD §7.5) ----------

  /** Postup úspechu: koľko už je a koľko treba. */
  achievementProgress(def: AchievementDef): { have: number; need: number } {
    const need = def.kind === 'album_all' ? this.albumSize : def.target;
    let have: number;
    switch (def.kind) {
      case 'residents':
        have = this.residents.length;
        break;
      case 'album':
      case 'album_all':
        have = this.albumFilled;
        break;
      case 'level':
        have = this.level + 1;
        break;
      case 'staff_all':
        have = this.data.staff.filter((d) => this.isHired(d.id)).length;
        return { have, need: this.data.staff.length };
      case 'buildings':
        have = [
          this.cafe.open,
          this.shelter.open,
          this.clinic.open &&
            ['lab', 'xray', 'or'].every((r) => this.clinic.rooms.includes(r as ClinicRoomId)),
          this.catio.open,
          this.hotel.open,
          this.hasFloor2 && this.clinic.rooms.includes('ct') && this.clinic.rooms.includes('pool'),
          this.education.open,
          this.hotel.open && this.nextSuitePrice === null,
        ].filter(Boolean).length;
        break;
      default:
        have = this.counters[def.kind];
    }
    return { have: Math.min(have, need), need };
  }

  /** Odomkne splnené úspechy a pripíše odmenu. */
  private checkAchievements(): void {
    for (const def of this.data.achievements ?? []) {
      if (this.achievements[def.id] !== undefined) continue;
      const p = this.achievementProgress(def);
      if (p.have < p.need) continue;
      this.achievements[def.id] = this.now;
      this.addMoney(def.money, true);
      this.addHearts(this.heartRate('achievement'));
      this.bus.emit('achievementUnlocked', { def });
    }
  }

  get achievementCount(): number {
    return Object.keys(this.achievements).length;
  }

  private checkChallenges(): void {
    this.checkAchievements();
    for (const ch of this.challenges) {
      if (!ch.completed && this.challengeProgress(ch) >= ch.target) {
        ch.completed = true;
        this.bus.emit('challengeCompleted', { challenge: ch });
      }
    }
  }

  /** Vyzdvihnúť odmenu za splnenú výzvu; na jej miesto príde nová. */
  claimChallenge(defId: string): ChallengeDef | null {
    const ch = this.challenges.find((c) => c.defId === defId && c.completed);
    const def = ch && this.challengeDef(ch.defId);
    if (!ch || !def) return null;
    this.challenges = this.challenges.filter((c) => c !== ch);
    this.challengeTiers[def.id] = (this.challengeTiers[def.id] ?? 0) + 1;
    this.addMoney(def.money, true);
    this.gainRep(def.rep);
    this.fillChallenges();
    return def;
  }

  get claimableChallenges(): number {
    return this.challenges.filter((c) => c.completed).length;
  }

  // ---------- Album (GDD §7.1) ----------

  static albumKey(breedId: string, coatId: string): string {
    return `${breedId}:${coatId}`;
  }

  private addToAlbum(cat: CatData, how: AlbumEntry['how']): void {
    const key = GameState.albumKey(cat.breedId, cat.coatId);
    const existing = this.album[key];
    if (existing) {
      existing.count += 1;
      return;
    }
    this.album[key] = { name: cat.name, sprite: cat.sprite, how, at: this.now, count: 1 };
    this.addHearts(this.heartRate('album'));
    this.bus.emit('albumAdded', { key });
  }

  /** Strana vzácností v albume (GDD §7.2) – kľúč `special:<znak>`. */
  private addRareToAlbum(cat: CatData, how: AlbumEntry['how']): void {
    if (!cat.special) return;
    const key = `special:${cat.special}`;
    const existing = this.album[key];
    if (existing) {
      existing.count += 1;
      return;
    }
    this.album[key] = { name: cat.name, sprite: cat.sprite, how, at: this.now, count: 1 };
    this.addHearts(this.heartRate('rare'));
    this.bus.emit('albumAdded', { key });
  }

  /** Všetky políčka albumu: bežné plemená × bežné farby, plemená s pevnou farbou majú jedno. */
  get albumSlots(): { breedId: string; coatId: string }[] {
    const regular = this.data.coats.filter((c) => !c.special);
    return this.data.breeds.flatMap((b) =>
      b.coat
        ? [{ breedId: b.id, coatId: b.coat }]
        : regular.map((c) => ({ breedId: b.id, coatId: c.id })),
    );
  }

  get albumSize(): number {
    return this.albumSlots.length;
  }

  /** Koľko políčok albumu je vyplnených (staré savy môžu mať kľúče mimo albumu). */
  get albumFilled(): number {
    return this.albumSlots.filter((x) => this.album[GameState.albumKey(x.breedId, x.coatId)])
      .length;
  }

  // ---------- Vylepšenia garáže (GDD §6.1) ----------

  /** Cena ďalšej klietky, alebo null, ak sa už viac kúpiť nedá. */
  get nextCagePrice(): number | null {
    return this.data.balance.upgrades.cage_prices[this.upgrades.cages] ?? null;
  }

  get nextSlotPrice(): number | null {
    return this.data.balance.upgrades.slot_prices[this.upgrades.slots] ?? null;
  }

  buyCage(): boolean {
    const price = this.nextCagePrice;
    if (price === null || this.money < price) return false;
    this.addMoney(-price, true);
    this.upgrades.cages += 1;
    this.bus.emit('upgradeBought', { kind: 'cage' });
    return true;
  }

  buySlot(): boolean {
    const price = this.nextSlotPrice;
    if (price === null || this.money < price) return false;
    this.addMoney(-price, true);
    this.upgrades.slots += 1;
    this.bus.emit('upgradeBought', { kind: 'slot' });
    return true;
  }

  // ---------- Úrovne útulku (★), vybavenie a dekorácie (GDD §6.1) ----------

  /** Index aktuálnej úrovne (0 = prvá). */
  get level(): number {
    const levels = this.data.balance.levels;
    let i = 0;
    while (i + 1 < levels.length && this.reputation >= (levels[i + 1]?.rep ?? Infinity)) i++;
    return i;
  }

  get levelDef(): LevelDef | undefined {
    return this.data.balance.levels[this.level];
  }

  get nextLevelDef(): LevelDef | null {
    return this.data.balance.levels[this.level + 1] ?? null;
  }

  hasUnlock(u: Unlock): boolean {
    return this.data.balance.levels.slice(0, this.level + 1).some((l) => l.unlocks.includes(u));
  }

  /** Od koľkých ★ je odomknutie dostupné (pre zámky v obchode). */
  unlockRep(u: Unlock): number | null {
    return this.data.balance.levels.find((l) => l.unlocks.includes(u))?.rep ?? null;
  }

  private gainRep(n: number): void {
    if (n === 0) return;
    const before = this.level;
    this.reputation += n;
    this.bus.emit('reputationChanged', { reputation: this.reputation });
    for (let l = before + 1; l <= this.level; l++) {
      const def = this.data.balance.levels[l];
      if (def) this.bus.emit('levelUp', { level: l, def });
    }
  }

  equipmentDef(id: string): EquipmentDef | undefined {
    return this.data.equipment.find((e) => e.id === id);
  }

  equipmentLevel(id: string): number {
    return this.equipment[id] ?? 0;
  }

  /** Násobok účinku vybavenia podľa kúpeného stupňa (1 = bez účinku). */
  equipmentEffect(id: string): number {
    return this.equipmentDef(id)?.effect[this.equipmentLevel(id)] ?? 1;
  }

  /** Cena ďalšieho stupňa, null = už je na maxime. */
  nextEquipmentPrice(id: string): number | null {
    return this.equipmentDef(id)?.prices[this.equipmentLevel(id)] ?? null;
  }

  /** Odomknutie potrebné pre ďalší stupeň (null = netreba). */
  nextEquipmentUnlock(id: string): Unlock | null {
    const next = this.equipmentLevel(id) + 1;
    return next === 2 ? 'equipment_2' : next === 3 ? 'equipment_3' : null;
  }

  buyEquipment(id: string): boolean {
    const price = this.nextEquipmentPrice(id);
    const unlock = this.nextEquipmentUnlock(id);
    if (price === null || this.money < price || (unlock && !this.hasUnlock(unlock))) return false;
    this.addMoney(-price, true);
    this.equipment[id] = this.equipmentLevel(id) + 1;
    this.bus.emit('equipmentBought', { id, level: this.equipment[id] });
    return true;
  }

  decorDef(id: string): DecorDef | undefined {
    return this.data.decor.find((d) => d.id === id);
  }

  buyDecor(id: string): boolean {
    const def = this.decorDef(id);
    if (!def || this.decor.includes(id) || this.money < def.price) return false;
    if (def.unlock && !this.hasUnlock(def.unlock)) return false;
    if (def.room === 'cafe' && !this.cafe.open) return false;
    this.addMoney(-def.price, true);
    this.decor.push(id);
    this.bus.emit('decorBought', { def });
    return true;
  }

  /** Body útulnosti miestnosti zo zakúpených dekorácií. */
  coziness(room: 'garage' | 'cafe'): number {
    return this.decor.reduce((sum, id) => {
      const d = this.decorDef(id);
      return d && d.room === room ? sum + d.cozy : sum;
    }, 0);
  }

  /** Násobok dôvery pri socializácii: hračky × útulnosť garáže. */
  get trustMult(): number {
    return (
      this.equipmentEffect('toys') *
      (1 + this.coziness('garage') * this.data.balance.coziness.garage_trust_per_point)
    );
  }

  // ---------- Personál (GDD §6.4) ----------

  staffDef(id: StaffId): StaffDef | undefined {
    return this.data.staff.find((s) => s.id === id);
  }

  isHired(id: StaffId): boolean {
    return this.staff[id] !== undefined;
  }

  /** Najatý, zapnutý a má kde pracovať (barista potrebuje kaviareň). */
  staffWorking(id: StaffId): boolean {
    const def = this.staffDef(id);
    if (!this.staff[id]?.active || !def) return false;
    if (def.requires === 'cafe' && !this.cafe.open) return false;
    if (def.requires === 'shelter' && !this.shelter.open) return false;
    return true;
  }

  hireStaff(id: StaffId): boolean {
    const def = this.staffDef(id);
    if (!def || this.isHired(id) || !this.hasUnlock('staff') || this.money < def.price)
      return false;
    if (def.requires === 'cafe' && !this.cafe.open) return false;
    this.addMoney(-def.price, true);
    this.staff[id] = { active: true };
    this.bus.emit('staffHired', { id });
    return true;
  }

  setStaffActive(id: StaffId, active: boolean): void {
    const s = this.staff[id];
    if (s) s.active = active;
  }

  /** Personál robí rutinu; hráč môže všetko urobiť aj sám (a lepšie). */
  private advanceStaff(deltaMs: number): void {
    const tick = (id: StaffId, intervalS: number, run: () => void) => {
      if (!this.staffWorking(id)) return;
      const t = (this.staffTimers[id] ?? 0) + deltaMs;
      if (t < intervalS * 1000) {
        this.staffTimers[id] = t;
        return;
      }
      this.staffTimers[id] = 0;
      run();
    };
    const p = this.data.balance.staff;

    // Ošetrovateľ: nakŕmi jednu hladnú mačku alebo učeše jednu špinavú
    tick('caretaker', p.caretaker.interval_s, () => {
      const c = p.caretaker;
      const all = [...this.cats, ...this.hotel.guests];
      const hungry = all.find(
        (cat) =>
          cat.stats.satisfaction < c.feed_below_satisfaction && this.feedCooldownLeft(cat.id) === 0,
      );
      if (hungry && this.feed(hungry.id)) {
        this.bus.emit('staffAction', { id: 'caretaker', kind: 'feed', cat: hungry });
        return;
      }
      const dirty = all.find(
        (cat) =>
          cat.stats.cleanliness < c.brush_below_cleanliness &&
          this.now - (this.brushedAt.get(cat.id) ?? -Infinity) > c.brush_cooldown_s * 1000,
      );
      if (dirty) {
        this.brushedAt.set(dirty.id, this.now);
        Care.addStats(dirty, { cleanliness: c.brush_cleanliness });
        this.changed(dirty);
        this.bus.emit('staffAction', { id: 'caretaker', kind: 'brush', cat: dirty });
      }
    });

    // Veterinár: prehliadne nové mačky – jeden nástroj naraz
    tick('vet', p.vet.interval_s, () => {
      for (const cat of this.cagedCats) {
        const tool = this.tools.find((x) => !cat.examined.includes(x));
        if (!tool) continue;
        const found = this.examine(cat.id, tool);
        this.bus.emit('staffAction', { id: 'vet', kind: 'examine', cat, found });
        return;
      }
    });

    // Barista: obslúži hosťa, ktorý už chvíľu čaká
    if (this.staffWorking('barista')) {
      const stay = this.data.balance.cafe.guest_stay_s * 1000;
      const delay = p.barista.delay_s * 1000;
      for (const g of this.cafe.guests) {
        if (g.served || this.now - (g.leaveAt - stay) < delay) continue;
        g.servedByStaff = true;
        if (this.serveGuest(g.id)) this.bus.emit('staffAction', { id: 'barista', kind: 'serve' });
      }
    }
  }

  // ---------- Mačacia kaviareň (GDD §5.5) ----------

  get tableCount(): number {
    return this.data.balance.cafe.tables + this.cafe.tables;
  }

  get nextTablePrice(): number | null {
    if (!this.cafe.open) return null;
    return this.data.balance.cafe.table_prices[this.cafe.tables] ?? null;
  }

  /** Hostia, ktorí ešte čakajú na obsluhu. */
  get waitingGuests(): CafeGuest[] {
    return this.cafe.guests.filter((g) => !g.served);
  }

  buyCafe(): boolean {
    const c = this.data.balance.cafe;
    if (this.cafe.open || this.money < c.price || !this.hasUnlock('cafe')) return false;
    this.addMoney(-c.price, true);
    this.openCafe();
    return true;
  }

  private openCafe(): void {
    const c = this.data.balance.cafe;
    this.cafe.open = true;
    // Prvý hosť príde čoskoro
    this.cafe.timer = (c.guest_interval_s - c.guest_first_delay_s) * 1000;
    this.bus.emit('upgradeBought', { kind: 'cafe' });
    this.fillChallenges();
  }

  buyTable(): boolean {
    const price = this.nextTablePrice;
    if (price === null || this.money < price) return false;
    this.addMoney(-price, true);
    this.cafe.tables += 1;
    this.bus.emit('upgradeBought', { kind: 'table' });
    return true;
  }

  /** Obslúženie hosťa – ťuknutie na bublinu s objednávkou. */
  serveGuest(guestId: string): boolean {
    const g = this.cafe.guests.find((x) => x.id === guestId);
    if (!g || g.served) return false;
    g.served = true;
    this.counters.served += 1;
    this.bus.emit('guestServed', { guest: g });
    this.checkChallenges();
    return true;
  }

  /** Dar hosťa pri odchode: základ + bonus za každú stálicu podľa spokojnosti. */
  guestTip(served: boolean, byStaff = false): number {
    const c = this.data.balance.cafe;
    // Spoločenské a maznavé stálice hostí potešia viac (GDD §4.4)
    const charm = (cat: CatData) =>
      cat.traits.some((t) => t.id === 'social' || t.id === 'cuddly') ? 1.5 : 1;
    const bonus = this.residents.reduce(
      (sum, cat) => sum + c.tip_per_resident * (0.5 + cat.stats.satisfaction / 100) * charm(cat),
      0,
    );
    const cozy = 1 + this.coziness('cafe') * this.data.balance.coziness.cafe_tip_per_point;
    const mult = served
      ? byStaff
        ? this.data.balance.staff.barista.tip_multiplier
        : c.served_multiplier
      : 1;
    const tip = (c.tip_base + bonus) * mult * cozy;
    return Math.round(tip * 10) / 10;
  }

  private advanceGuests(deltaMs: number): void {
    if (!this.cafe.open) return;
    const c = this.data.balance.cafe;
    // Odchody – hosť nechá dar a pohladká si svoju mačku
    for (const g of [...this.cafe.guests]) {
      if (this.now < g.leaveAt) continue;
      this.cafe.guests = this.cafe.guests.filter((x) => x !== g);
      const amount = this.guestTip(g.served, g.servedByStaff);
      this.addMoney(amount, true);
      const cat = g.catId ? this.getCat(g.catId) : undefined;
      if (cat?.resident) {
        Care.addStats(cat, { satisfaction: c.pet_satisfaction });
        this.bus.emit('catChanged', { cat });
      }
      this.bus.emit('guestLeft', { guest: g, amount });
    }
    // Príchody – iba cez deň, keď je na koho sa prísť pozrieť a je voľný stôl
    const residents = this.residents;
    if (residents.length === 0 || !this.cafeOpenNow) return;
    const interval = c.guest_interval_s * 1000 * (this.eventActive('openday') ? 0.4 : 1);
    this.cafe.timer += deltaMs;
    if (this.cafe.timer < interval) return;
    const taken = new Set(this.cafe.guests.map((g) => g.table));
    let table = -1;
    for (let i = 0; i < this.tableCount; i++) {
      if (!taken.has(i)) {
        table = i;
        break;
      }
    }
    if (table < 0) {
      this.cafe.timer = interval; // príde hneď, ako sa uvoľní stôl
      return;
    }
    this.cafe.timer = 0;
    const used = new Set(this.cafe.guests.map((g) => g.sprite));
    const pool = c.guest_sprites.filter((s) => !used.has(s));
    const guest: CafeGuest = {
      id: this.newId('g'),
      sprite: this.rng.pick(pool.length ? pool : c.guest_sprites),
      table,
      order: this.rng.pick(ORDERS),
      served: false,
      leaveAt: this.now + c.guest_stay_s * 1000,
      catId: this.rng.pick(residents).id,
    };
    this.cafe.guests.push(guest);
    this.bus.emit('guestArrived', { guest });
  }

  // ---------- Tutoriál so Zuzkou ----------

  /** Kľúč textu aktuálnej rady, alebo null, ak je tutoriál hotový. */
  get tutorialHint(): (typeof TUTORIAL_STEPS)[number] | null {
    if (this.tutorialDone) return null;
    const done = [
      () => this.counters.rescued > 0,
      () =>
        this.cats.some((c) => c.examined.length >= 2) ||
        this.counters.adopted > 0 ||
        this.residents.length > 0,
      () => this.cats.some((c) => Care.allTreated(c)) || this.counters.adopted > 0,
      () =>
        this.cats.some((c) => this.isReady(c)) ||
        this.counters.adopted > 0 ||
        this.residents.length > 0,
      () => this.counters.adopted > 0 || this.residents.length > 0,
    ];
    // Krok sa nikdy nevracia späť (nová mačka neznamená tutoriál odznova)
    while (this.tutorialStep < done.length && done[this.tutorialStep]?.()) this.tutorialStep += 1;
    return TUTORIAL_STEPS[this.tutorialStep] ?? null;
  }

  dismissTutorial(): void {
    this.tutorialDone = true;
  }

  // ---------- Ukladanie ----------

  toSave(wallClock: number): SaveData {
    return {
      version: SAVE_VERSION,
      savedAt: wallClock,
      now: this.now,
      money: this.money,
      reputation: this.reputation,
      rng: this.rng.getState(),
      nextId: this.nextId,
      cats: structuredClone(this.cats),
      reports: structuredClone(this.reports),
      adopters: structuredClone(this.adopters),
      adoptions: structuredClone(this.adoptions),
      timers: { report: this.reportTimer, adopter: this.adopterTimer },
      counters: { ...this.counters },
      challenges: structuredClone(this.challenges),
      challengeTiers: { ...this.challengeTiers },
      album: structuredClone(this.album),
      upgrades: { ...this.upgrades },
      tutorialStep: this.tutorialStep,
      tutorialDone: this.tutorialDone,
      cafe: structuredClone(this.cafe),
      equipment: { ...this.equipment },
      decor: [...this.decor],
      shelter: { ...this.shelter },
      staff: structuredClone(this.staff),
      clinic: structuredClone(this.clinic),
      catio: { ...this.catio },
      hotel: structuredClone(this.hotel),
      education: structuredClone(this.education),
      achievements: { ...this.achievements },
      events: structuredClone(this.events),
      hearts: this.hearts,
      cosmetics: structuredClone(this.cosmetics),
    };
  }

  static fromSave(data: GameData, save: SaveData): GameState {
    const s = new GameState(data, save.rng);
    s.now = save.now;
    s.money = save.money;
    s.reputation = save.reputation;
    s.nextId = save.nextId;
    s.cats = save.cats;
    s.reports = save.reports;
    s.adopters = save.adopters;
    s.adoptions = save.adoptions;
    s.pruneAdoptions();
    s.reportTimer = save.timers.report;
    s.adopterTimer = save.timers.adopter;
    s.counters = { ...emptyCounters(), ...save.counters };
    s.challenges = save.challenges;
    s.challengeTiers = save.challengeTiers;
    s.album = save.album;
    s.upgrades = save.upgrades;
    s.tutorialStep = save.tutorialStep;
    s.tutorialDone = save.tutorialDone;
    s.cafe = save.cafe ?? emptyCafe();
    s.equipment = { ...(save.equipment ?? {}) };
    s.decor = [...(save.decor ?? [])];
    s.shelter = { ...(save.shelter ?? { open: false }) };
    s.staff = structuredClone(save.staff ?? {});
    s.clinic = {
      ...structuredClone(save.clinic ?? { open: false, rooms: [], floors: 1 }),
      floors: save.clinic?.floors ?? 1,
    };
    s.catio = { ...(save.catio ?? { open: false }) };
    s.hotel = structuredClone(save.hotel ?? emptyHotel());
    s.education = structuredClone(save.education ?? emptyEducation());
    s.achievements = { ...(save.achievements ?? {}) };
    if (save.events) s.events = structuredClone(save.events);
    s.hearts = save.hearts ?? 0;
    s.cosmetics = structuredClone(save.cosmetics ?? { owned: [], walls: {} });
    s.rng = new Rng(save.rng); // konštruktor už náhodu použil – obnov presný stav
    for (const c of s.cats) if (s.isReady(c)) s.readyIds.add(c.id);
    s.fillChallenges();
    return s;
  }

  // ---------- Vývojárske menu (iba na testovanie) ----------

  /** Peniaze a reputácia navyše. */
  devGive(money: number, rep = 0): void {
    this.addMoney(money, true);
    this.gainRep(rep);
  }

  /** Nové hlásenie hneď (ak nie je nástenka plná). */
  devSpawnReport(): boolean {
    const before = this.reports.length;
    this.reportTimer = this.data.balance.rescue.interval_s * 1000;
    this.advanceReports(0);
    return this.reports.length > before;
  }

  /** Záujemca hneď – iba ak je nejaká mačka pripravená na adopciu. */
  devSpawnAdopter(): boolean {
    const before = this.adopters.length;
    this.adopterTimer = this.data.balance.adopters.interval_s * 1000;
    this.advanceAdopters(0);
    return this.adopters.length > before;
  }

  /** Hosť v kaviarni hneď (treba otvorenú kaviareň, stálicu a voľný stôl). */
  devSpawnGuest(): boolean {
    if (!this.cafe.open) return false;
    const before = this.cafe.guests.length;
    this.cafe.timer = this.data.balance.cafe.guest_interval_s * 1000;
    this.advanceGuests(0);
    return this.cafe.guests.length > before;
  }

  /** Všetci hostia hneď odídu (a nechajú dar). */
  devGuestsLeave(): void {
    for (const g of this.cafe.guests) g.leaveAt = this.now;
    this.advanceGuests(0);
  }

  /** Mačka úplne zdravá, vyšetrená, dôverčivá a so známymi rysmi. */
  devHeal(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat) return false;
    for (const c of cat.conditions) {
      c.revealed = true;
      c.treated = true;
    }
    for (const t of cat.traits) t.revealed = true;
    cat.examined = [...this.tools];
    cat.stats = { health: 100, cleanliness: 100, trust: 100, satisfaction: 100 };
    this.changed(cat);
    return true;
  }

  /** Posun hodín o `hours` herných hodín (hlásenia ani potreby sa nemenia). */
  devShiftClock(hours: number): void {
    // po herných minútach – v noci je minúta kratšia
    let m = this.clockAt(this.now);
    for (let i = 0; i < Math.round(hours * 60); i++) {
      this.now += this.msPerGameMinute(Math.floor(m) % 1440);
      m += 1;
    }
    this.deliverPostcards();
  }

  /** Kaviareň je v noci zatvorená – mačky spia (GDD §5.5). */
  get cafeOpenNow(): boolean {
    return this.dayPhase !== 'night';
  }

  /** Všetky výzvy na nástenke splnené. */
  devCompleteChallenges(): void {
    for (const ch of this.challenges) {
      if (ch.completed) continue;
      ch.completed = true;
      this.bus.emit('challengeCompleted', { challenge: ch });
    }
  }

  /** Všetky čakajúce pohľadnice prídu hneď; adopcie bez pohľadnice ju dostanú. */
  devDeliverPostcards(): number {
    for (const rec of this.adoptions) if (!rec.postcardDelivered) rec.postcardDueAt = this.now;
    return this.deliverPostcards();
  }

  /** Kaviareň zadarmo. */
  devOpenShelter(): boolean {
    if (this.shelter.open) return false;
    this.openShelter();
    return true;
  }

  /** Klinika so všetkými miestnosťami zadarmo (otvorí aj útulok). */
  devOpenClinic(): boolean {
    if (!this.shelter.open) this.openShelter();
    if (!this.clinic.open) this.openClinic();
    for (const room of CLINIC_ROOMS) {
      if (this.clinic.rooms.includes(room)) continue;
      this.clinic.rooms.push(room);
      this.bus.emit('clinicRoomBought', { room });
    }
    return true;
  }

  /** 2. poschodie kliniky s CT a bazénom zadarmo (otvorí aj kliniku). */
  devOpenFloor2(): boolean {
    this.devOpenClinic();
    if (!this.hasFloor2) {
      this.clinic.floors = 2;
      this.bus.emit('upgradeBought', { kind: 'floor' });
    }
    for (const room of FLOOR2_ROOMS) {
      if (this.clinic.rooms.includes(room)) continue;
      this.clinic.rooms.push(room);
      this.bus.emit('clinicRoomBought', { room });
    }
    return true;
  }

  /** Ponuka udalosti hneď (vývojárske menu). */
  devOfferEvent(id: EventDef['id']): boolean {
    if (this.events.active) return false;
    this.events.offer = id;
    const def = this.eventDef(id);
    if (def) this.bus.emit('eventOffered', { def });
    return true;
  }

  /** Prebiehajúca udalosť skončí hneď (s odmenou podľa postupu). */
  devEndEvent(): boolean {
    if (!this.events.active) return false;
    this.events.active.endsAt = this.now;
    this.endEvent();
    return true;
  }

  /** Edukačné centrum zadarmo a hneď výlet (otvorí aj kaviareň). */
  devSchoolTrip(): boolean {
    if (!this.cafe.open) this.openCafe();
    if (!this.education.open) this.openEducation();
    if (this.education.trip) return false;
    this.startTrip();
    return true;
  }

  /** Hotel zadarmo a hneď jeden hosť. */
  devOpenHotel(): boolean {
    if (!this.hotel.open) this.openHotel();
    if (this.hotel.guests.length >= this.suiteCount) return false;
    this.checkInGuest();
    return true;
  }

  /** Všetci hostia hotela odídu hneď (zaplatia podľa spokojnosti). */
  devHotelCheckout(): void {
    for (const c of this.hotel.guests) if (c.hotel) c.hotel.checkoutAt = this.now;
    this.advanceHotel(0, false);
  }

  /** Catio zadarmo (otvorí aj kaviareň). */
  devOpenCatio(): boolean {
    if (!this.cafe.open) this.openCafe();
    if (this.catio.open) return false;
    this.openCatio();
    return true;
  }

  devOpenCafe(): boolean {
    if (this.cafe.open) return false;
    this.openCafe();
    return true;
  }

  // ---------- Pomocné ----------

  private newId(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }

  private addMoney(amount: number, announce: boolean): void {
    if (amount === 0) return;
    const before = Math.floor(this.money);
    this.money += amount;
    const after = Math.floor(this.money);
    if (announce || after !== before)
      this.bus.emit('moneyChanged', { money: after, delta: amount });
  }

  private changed(cat: CatData): void {
    this.bus.emit('catChanged', { cat });
    this.checkReadiness();
    this.checkChallenges();
  }
}
