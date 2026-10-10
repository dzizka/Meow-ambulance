import type {
  AdopterVisit,
  AdoptionRecord,
  CatData,
  DiagnosticTool,
  GameData,
  Report,
  SocialActivity,
} from '../data/types';
import { EventBus, type OfflineSummary } from './EventBus';
import { Rng } from './Rng';
import * as Care from './systems/Care';
import { generateCat } from './systems/CatGenerator';
import { computeMatch, type MatchResult } from './systems/Match';

export const SAVE_VERSION = 1;

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
  rescued: number;
  cats: CatData[];
  reports: Report[];
  adopters: AdopterVisit[];
  adoptions: AdoptionRecord[];
  timers: { report: number; adopter: number };
}

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
  rescued = 0;
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
    return this.data.balance.phase_1.cages;
  }

  get freeCages(): number {
    return this.cageCount - this.cagedCats.length;
  }

  get freeResidentSlots(): number {
    return this.data.balance.residents.slots - this.residents.length;
  }

  getCat(id: string): CatData | undefined {
    return this.cats.find((c) => c.id === id);
  }

  isReady(cat: CatData): boolean {
    return Care.isReady(cat, this.data);
  }

  /** Dary za minútu od návštevníkov (GDD §5.4) – spokojnejšie stálice prinášajú viac. */
  get donationsPerMinute(): number {
    const rate = this.data.balance.residents.donation_per_min;
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
    this.rescued += 1;
    this.bus.emit('catAdmitted', { cat });
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
    this.changed(cat);
    return true;
  }

  socialize(catId: string, activity: SocialActivity, stars: Care.Stars): Care.SocialResult | null {
    const cat = this.getCat(catId);
    if (!cat) return null;
    const result = Care.socialize(cat, activity, stars, this.now, this.data);
    if (result) this.changed(cat);
    return result;
  }

  socialCooldownLeft(catId: string): number {
    const cat = this.getCat(catId);
    return cat ? Care.socialCooldownLeft(cat, this.now, this.data) : 0;
  }

  feed(catId: string): boolean {
    const cat = this.getCat(catId);
    if (!cat || !Care.feed(cat, this.now, this.data)) return false;
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
    this.addMoney(fee, true);
    this.reputation += rep;
    this.bus.emit('reputationChanged', { reputation: this.reputation });
    this.bus.emit('catAdopted', { record });
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
      rescued: this.rescued,
      cats: structuredClone(this.cats),
      reports: structuredClone(this.reports),
      adopters: structuredClone(this.adopters),
      adoptions: structuredClone(this.adoptions),
      timers: { report: this.reportTimer, adopter: this.adopterTimer },
    };
  }

  static fromSave(data: GameData, save: SaveData): GameState {
    const s = new GameState(data, save.rng);
    s.now = save.now;
    s.money = save.money;
    s.reputation = save.reputation;
    s.nextId = save.nextId;
    s.rescued = save.rescued;
    s.cats = save.cats;
    s.reports = save.reports;
    s.adopters = save.adopters;
    s.adoptions = save.adoptions;
    s.reportTimer = save.timers.report;
    s.adopterTimer = save.timers.adopter;
    for (const c of s.cats) if (s.isReady(c)) s.readyIds.add(c.id);
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
  }
}
