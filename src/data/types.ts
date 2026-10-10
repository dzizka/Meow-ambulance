/** Typy herných dát. Statické definície zodpovedajú súborom v public/data/*.json. */

export type SocialActivity = 'feather' | 'brush' | 'hand_feed' | 'sit_quietly';
export type DiagnosticTool = 'hand' | 'thermometer' | 'stethoscope';
export type AgeGroup = 'kitten' | 'adult' | 'senior';

export interface TraitDef {
  id: string;
  name_key: string;
  social: Record<SocialActivity, number>;
  adopt_good: string[];
  adopt_bad: string[];
}

export interface ConditionDef {
  id: string;
  name_key: string;
  reveal_tool: DiagnosticTool;
  minigame: string;
  health_gain: number;
  cleanliness_gain?: number;
  weight: number;
}

export interface BreedDef {
  id: string;
  name_key: string;
  rarity: number;
  sprite_override?: string;
}

export interface CoatDef {
  id: string;
  name_key: string;
  rarity: number;
  sprites: string[];
}

export interface AdopterDef {
  id: string;
  name_key: string;
  desc_key: string;
  tags: string[];
  age_pref: AgeGroup | 'any';
  dealbreakers: string[];
  sprites: string[];
}

export interface ReportDef {
  id: string;
  name_key: string;
  age: AgeGroup | null;
  difficulty: 1 | 2 | 3;
  weight: number;
}

export interface NamesData {
  generic: string[];
  by_coat: Record<string, string[]>;
}

export interface BalanceData {
  clock: { real_seconds_per_game_hour: number; start_hour: number };
  rescue: { interval_s: number; first_delay_s: number; max_waiting: number };
  adopters: { interval_s: number; first_delay_s: number; max_waiting: number };
  decay_per_min: { cleanliness: number; satisfaction: number };
  stat_floor: number;
  recovery_health_per_min: number;
  adoption_ready: { min_health: number; min_trust: number };
  match: {
    base: number;
    trait_good: number;
    trait_bad: number;
    age_match: number;
    age_any: number;
    perfect: number;
    good: number;
  };
  rewards: {
    adoption_fee_min: number;
    adoption_fee_max: number;
    rep_perfect: number;
    rep_good: number;
    rep_poor: number;
    postcard_delay_s: [number, number];
    postcard_chance_good: number;
  };
  care: {
    social_base_trust: number;
    social_cooldown_s: number;
    feed_satisfaction: number;
    feed_health: number;
    feed_cooldown_s: number;
    brush_cleanliness: number;
    treat_satisfaction_per_star: number;
  };
  residents: { slots: number; donation_per_min: number; offline_cap_h: number };
  phase_1: { starting_money: number; cages: number };
  /** Ceny ďalších klietok a miest v kútiku – dĺžka poľa = koľko sa dá dokúpiť. */
  upgrades: { cage_prices: number[]; slot_prices: number[] };
  challenges: { active: number };
}

/** Čo sa v hre počíta (pre výzvy a štatistiky). */
export interface Counters {
  rescued: number;
  kittens: number;
  adopted: number;
  perfect: number;
  shy_homed: number;
  treated: number;
  ticks: number;
  social: number;
  fed: number;
}

export type ChallengeKind = keyof Counters | 'residents';

export interface ChallengeDef {
  id: string;
  kind: ChallengeKind;
  name_key: string;
  base: number;
  step: number;
  money: number;
  rep: number;
  weight: number;
}

/** Výzva na nástenke (GDD §7.3). */
export interface ActiveChallenge {
  defId: string;
  target: number;
  /** Stav počítadla pri zadaní výzvy – počíta sa iba to, čo pribudne. */
  start: number;
  completed: boolean;
}

/** Záznam v albume príbehov (GDD §7.1) – jedno políčko = plemeno × farba. */
export interface AlbumEntry {
  name: string;
  sprite: string;
  how: 'adopted' | 'resident';
  at: number;
  /** Koľko mačiek tohto plemena a farby už prešlo útulkom. */
  count: number;
}

/** Všetky statické dáta hry pohromade. */
export interface GameData {
  challenges: ChallengeDef[];
  traits: TraitDef[];
  conditions: ConditionDef[];
  breeds: BreedDef[];
  coats: CoatDef[];
  adopters: AdopterDef[];
  reports: ReportDef[];
  names: NamesData;
  balance: BalanceData;
}

export interface CatStats {
  health: number;
  cleanliness: number;
  trust: number;
  satisfaction: number;
}

export interface CatCondition {
  id: string;
  revealed: boolean;
  treated: boolean;
}

/** Konkrétna mačka v útulku (ukladá sa do savu). */
export interface CatData {
  id: string;
  name: string;
  age: AgeGroup;
  breedId: string;
  coatId: string;
  /** Kľúč hárku spritov, napr. "orange_0". */
  sprite: string;
  traits: { id: string; revealed: boolean }[];
  conditions: CatCondition[];
  stats: CatStats;
  /** Ktoré nástroje už boli pri prehliadke použité. */
  examined: DiagnosticTool[];
  /** Stálica – býva v kútiku/kaviarni namiesto klietky (GDD §5.4). */
  resident: boolean;
  /** Herný čas (ms simulácie) posledného kontaktu – kvôli prestávkam medzi aktivitami. */
  lastSocialAt: number;
  lastFedAt: number;
  /** Odkiaľ prišla (id hlásenia). */
  reportId: string;
  admittedAt: number;
}

/** Hlásenie o nájdenej mačke čakajúce na prijatie. */
export interface Report {
  id: string;
  defId: string;
}

/** Záujemca o adopciu, ktorý práve čaká v garáži. */
export interface AdopterVisit {
  id: string;
  defId: string;
  sprite: string;
}

/** Záznam o adopcii – podklad pre pohľadnicu a album. */
export interface AdoptionRecord {
  cat: CatData;
  adopterDefId: string;
  adopterSprite: string;
  score: number;
  fee: number;
  adoptedAt: number;
  /** Kedy príde pohľadnica (ms simulácie), null = nepríde. */
  postcardDueAt: number | null;
  postcardDelivered: boolean;
  postcardSeen: boolean;
}
