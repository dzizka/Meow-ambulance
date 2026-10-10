import type {
  ActiveChallenge,
  AdopterVisit,
  AdoptionRecord,
  AlbumEntry,
  CafeGuest,
  CafeState,
  ChallengeDef,
  Counters,
  CatData,
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

export const SAVE_VERSION = 3;

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
}

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
    this.fillChallenges();
  }

  get rescued(): number {
    return this.counters.rescued;
  }

  // ---------- Hodiny pre atmosféru ----------

  /** Minúty od polnoci (0–1439). */
  get clockMinutes(): number {
    const c = this.data.balance.clock;
    const gameMinutes = (this.now / 1000 / c.real_seconds_per_game_hour) * 60;
    return Math.floor(c.start_hour * 60 + gameMinutes) % 1440;
  }

  get clock(): string {
    const m = this.clockMinutes;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  get dayPhase(): DayPhase {
    const h = this.clockMinutes / 60;
    if (h < 6 || h >= 22) return 'night';
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

  get freeCages(): number {
    return this.cageCount - this.cagedCats.length;
  }

  get freeResidentSlots(): number {
    return this.residentSlots - this.residents.length;
  }

  getCat(id: string): CatData | undefined {
    return this.cats.find((c) => c.id === id);
  }

  isReady(cat: CatData): boolean {
    return Care.isReady(cat, this.data);
  }

  /** Dary za minútu od návštevníkov (GDD §5.4) – spokojnejšie stálice prinášajú viac. */
  get donationsPerMinute(): number {
    const b = this.data.balance;
    const rate = b.residents.donation_per_min * (this.cafe.open ? b.cafe.donation_multiplier : 1);
    return this.residents.reduce((sum, c) => sum + rate * (0.5 + c.stats.satisfaction / 100), 0);
  }

  // ---------- Čas ----------

  /** Hra beží: `deltaMs` reálnych milisekúnd. */
  tick(deltaMs: number): void {
    if (deltaMs <= 0) return;
    const minutes = deltaMs / MINUTE;
    this.now += deltaMs;

    for (const cat of this.cats) Care.passTime(cat, minutes, this.data);
    this.addMoney(this.donationsPerMinute * minutes, false);
    this.advanceReports(deltaMs);
    this.advanceAdopters(deltaMs);
    this.advanceGuests(deltaMs);
    this.deliverPostcards();
    this.checkReadiness();
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
    const delivered = this.deliverPostcards();
    summary.postcards = delivered;
    return summary;
  }

  private advanceReports(deltaMs: number): void {
    const r = this.data.balance.rescue;
    const interval = r.interval_s * 1000;
    this.reportTimer += deltaMs;
    while (this.reportTimer >= interval) {
      if (this.reports.length >= r.max_waiting) {
        this.reportTimer = interval; // plná nástenka – ďalšie príde hneď, ako sa uvoľní miesto
        return;
      }
      this.reportTimer -= interval;
      const def = this.rng.weighted(this.data.reports, (d) => d.weight);
      const report: Report = { id: this.newId('r'), defId: def.id };
      this.reports.push(report);
      this.bus.emit('reportAdded', { report });
    }
  }

  private advanceAdopters(deltaMs: number): void {
    const a = this.data.balance.adopters;
    // Adoptéri chodia iba vtedy, keď je komu nájsť domov
    if (!this.cats.some((c) => this.isReady(c))) return;
    const interval = a.interval_s * 1000;
    this.adopterTimer += deltaMs;
    if (this.adopterTimer < interval) return;
    if (this.adopters.length >= a.max_waiting) {
      this.adopterTimer = interval;
      return;
    }
    this.adopterTimer = 0;
    // Uprednostni typ, ktorý ešte nečaká
    const waiting = new Set(this.adopters.map((v) => v.defId));
    const pool = this.data.adopters.filter((d) => !waiting.has(d.id));
    const def = this.rng.pick(pool.length ? pool : this.data.adopters);
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
        this.bus.emit('postcardArrived', { record: rec });
      }
    }
    return count;
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
    if (!report || !def || this.freeCages <= 0) return null;
    this.reports = this.reports.filter((r) => r !== report);
    const cat = generateCat(this.data, this.rng, {
      id: this.newId('cat'),
      age: def.age,
      conditionCount: def.difficulty,
      reportId: def.id,
      now: this.now,
    });
    this.cats.push(cat);
    this.counters.rescued += 1;
    if (cat.age === 'kitten') this.counters.kittens += 1;
    this.bus.emit('catAdmitted', { cat });
    this.checkChallenges();
    return cat;
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
    return found;
  }

  treat(catId: string, conditionId: string, stars: Care.Stars): boolean {
    const cat = this.getCat(catId);
    if (!cat || !Care.treat(cat, conditionId, stars, this.data)) return false;
    this.counters.treated += 1;
    if (conditionId === 'ticks') this.counters.ticks += 1;
    this.changed(cat);
    return true;
  }

  socialize(catId: string, activity: SocialActivity, stars: Care.Stars): Care.SocialResult | null {
    const cat = this.getCat(catId);
    if (!cat) return null;
    const result = Care.socialize(cat, activity, stars, this.now, this.data);
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
    if (!cat || !Care.feed(cat, this.now, this.data)) return false;
    this.counters.fed += 1;
    this.changed(cat);
    return true;
  }

  feedCooldownLeft(catId: string): number {
    const cat = this.getCat(catId);
    return cat ? Care.feedCooldownLeft(cat, this.now, this.data) : 0;
  }

  /** Nechať si mačku ako stálicu (GDD §5.4) – uvoľní klietku. */
  makeResident(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || cat.resident || !this.isReady(cat) || this.freeResidentSlots <= 0) return false;
    cat.resident = true;
    this.addToAlbum(cat, 'resident');
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
    const fee =
      Math.round(
        (r.adoption_fee_min + ((r.adoption_fee_max - r.adoption_fee_min) * match.score) / 100) / 5,
      ) * 5;
    const rep =
      match.quality === 'perfect'
        ? r.rep_perfect
        : match.quality === 'good'
          ? r.rep_good
          : r.rep_poor;
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
    this.counters.adopted += 1;
    if (match.quality === 'perfect') this.counters.perfect += 1;
    if (cat.traits.some((t) => t.id === 'shy')) this.counters.shy_homed += 1;
    if (!cat.resident) this.addToAlbum(cat, 'adopted');
    this.addMoney(fee, true);
    this.reputation += rep;
    this.bus.emit('reputationChanged', { reputation: this.reputation });
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
        (d) => !active.has(d.id) && (d.requires !== 'cafe' || this.cafe.open),
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

  private checkChallenges(): void {
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
    this.reputation += def.rep;
    this.bus.emit('reputationChanged', { reputation: this.reputation });
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
    this.bus.emit('albumAdded', { key });
  }

  get albumSize(): number {
    return this.data.breeds.length * this.data.coats.length;
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
    if (this.cafe.open || this.money < c.price) return false;
    this.addMoney(-c.price, true);
    this.cafe.open = true;
    // Prvý hosť príde čoskoro
    this.cafe.timer = (c.guest_interval_s - c.guest_first_delay_s) * 1000;
    this.bus.emit('upgradeBought', { kind: 'cafe' });
    this.fillChallenges();
    return true;
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
  guestTip(served: boolean): number {
    const c = this.data.balance.cafe;
    const bonus = this.residents.reduce(
      (sum, cat) => sum + c.tip_per_resident * (0.5 + cat.stats.satisfaction / 100),
      0,
    );
    const tip = (c.tip_base + bonus) * (served ? c.served_multiplier : 1);
    return Math.round(tip * 10) / 10;
  }

  private advanceGuests(deltaMs: number): void {
    if (!this.cafe.open) return;
    const c = this.data.balance.cafe;
    // Odchody – hosť nechá dar a pohladká si svoju mačku
    for (const g of [...this.cafe.guests]) {
      if (this.now < g.leaveAt) continue;
      this.cafe.guests = this.cafe.guests.filter((x) => x !== g);
      const amount = this.guestTip(g.served);
      this.addMoney(amount, true);
      const cat = g.catId ? this.getCat(g.catId) : undefined;
      if (cat?.resident) {
        Care.addStats(cat, { satisfaction: c.pet_satisfaction });
        this.bus.emit('catChanged', { cat });
      }
      this.bus.emit('guestLeft', { guest: g, amount });
    }
    // Príchody – iba keď je na koho sa prísť pozrieť a je voľný stôl
    const residents = this.residents;
    if (residents.length === 0) return;
    const interval = c.guest_interval_s * 1000;
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
    s.rng = new Rng(save.rng); // konštruktor už náhodu použil – obnov presný stav
    for (const c of s.cats) if (s.isReady(c)) s.readyIds.add(c.id);
    s.fillChallenges();
    return s;
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
