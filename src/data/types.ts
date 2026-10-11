/** Typy herných dát. Statické definície zodpovedajú súborom v public/data/*.json. */

export type SocialActivity = 'feather' | 'brush' | 'hand_feed' | 'sit_quietly';
export type DiagnosticTool =
  'hand' | 'thermometer' | 'stethoscope' | 'otoscope' | 'bloodtest' | 'xray' | 'ct';
/** Miestnosti kliniky (GDD §6.5). */
export type ClinicRoomId = 'lab' | 'xray' | 'or' | 'ct' | 'pool';
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
  /** Iba mačky tohto veku (napr. choroba obličiek u starších). */
  ages?: AgeGroup[];
  /** Diagnóza kliniky – „Prípad z inej útulne" má aspoň jednu. */
  clinic?: boolean;
  /** Iba počas udalosti (napr. podchladenie v zime). */
  event?: string;
}

export interface BreedDef {
  id: string;
  name_key: string;
  rarity: number;
  /** Plemeno má vždy túto farbu (napr. siamská → seal_point). */
  coat?: string;
  /** Starostlivosť o srsť: long = rýchlejšie sa zašpiní, none = takmer vôbec. */
  coat_care?: 'long' | 'none';
}

export interface CoatDef {
  id: string;
  name_key: string;
  rarity: number;
  sprites: string[];
  /** Iba s plemenom, ktoré ju má pevne – nepadne náhodne. */
  special?: boolean;
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
  /** Mačacia rodinka: mama + [min, max] mačiatok naraz (GDD §6.2). */
  family?: [number, number];
  /** Hlásenie chodí iba s Komunitným útulkom / s klinikou. */
  requires?: 'shelter' | 'clinic' | 'event';
  /** Prípad z inej útulne: aspoň jedna diagnóza kliniky, bonus pri adopcii. */
  clinic_case?: boolean;
}

export interface NamesData {
  generic: string[];
  by_coat: Record<string, string[]>;
}

export interface BalanceData {
  /** Hodiny: reálne sekundy na hernú hodinu cez deň a v noci (22–6 h). */
  clock: {
    real_seconds_per_game_hour: number;
    night_seconds_per_game_hour: number;
    start_hour: number;
  };
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
  /** Úrovne útulku podľa ★ (GDD §6.1.1). */
  levels: LevelDef[];
  /** Účinok útulnosti (GDD §6.1.3). */
  coziness: { garage_trust_per_point: number; cafe_tip_per_point: number };
  /** Personál (GDD §6.4). */
  staff: {
    caretaker: {
      interval_s: number;
      feed_below_satisfaction: number;
      brush_below_cleanliness: number;
      brush_cleanliness: number;
      brush_cooldown_s: number;
    };
    vet: { interval_s: number };
    barista: { delay_s: number; tip_multiplier: number };
    social: { adopter_interval_mult: number; extra_waiting: number; best_match_chance: number };
  };
  /** Komunitný útulok – Fáza 2 (GDD §6.2). */
  shelter: {
    price: number;
    min_rescued: number;
    quarantine_cages: number;
    vaccine_fee_bonus: number;
    vaccine_rep_bonus: number;
  };
  /** Klinika – Fáza 3 (GDD §6.5). */
  clinic: {
    price: number;
    /** 2. poschodie kliniky (CT a bazén). */
    floor_price: number;
    rehab_fee_bonus: number;
    rehab_health: number;
    rooms: Record<ClinicRoomId, number>;
    neuter_fee_bonus: number;
    neuter_rep_bonus: number;
    neuter_match_bonus: number;
    case_fee_bonus: number;
    case_rep_bonus: number;
  };
  /** Edukačné centrum (GDD §6.9). */
  education: {
    price: number;
    first_delay_s: number;
    interval_s: number;
    wait_s: number;
    kids: [number, number];
    donation_per_kid: number;
    rep_by_stars: number[];
    kid_sprites: string[];
    teacher_sprite: string;
    quiz_questions: number;
  };
  /** Mačací hotel (GDD §6.7). */
  hotel: {
    price: number;
    suites: number;
    suite_prices: number[];
    first_delay_s: number;
    arrival_interval_s: number;
    stay_s: [number, number];
    fee: number;
    decay_mult: number;
    happy_at: number;
    rep_happy: number;
    receptionist_sprite: string;
  };
  /** Vzácne mačky (GDD §7.2). */
  rare: {
    hetero: number;
    poly: number;
    tortie_male: number;
    boost: number;
    fee_bonus: number;
    rep_bonus: number;
  };
  /** Catio – vonkajší výbeh (GDD §6.6). */
  catio: { price: number; satisfaction_decay_mult: number };
  /** Mačacia kaviareň (GDD §5.5). */
  cafe: {
    price: number;
    slots: number;
    donation_multiplier: number;
    tables: number;
    table_prices: number[];
    guest_interval_s: number;
    guest_first_delay_s: number;
    guest_stay_s: number;
    tip_base: number;
    tip_per_resident: number;
    served_multiplier: number;
    pet_satisfaction: number;
    guest_sprites: string[];
    /** Postavička za pultom. */
    barista_sprite: string;
  };
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
  served: number;
  vaccinated: number;
  neutered: number;
  hotel: number;
  lectures: number;
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
  /** Výzva sa ponúka iba po splnení podmienky (napr. otvorená kaviareň). */
  requires?: 'cafe' | 'shelter';
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
  equipment: EquipmentDef[];
  decor: DecorDef[];
  staff: StaffDef[];
  achievements: AchievementDef[];
  events: EventsData;
  cosmetics: CosmeticsData;
}

export interface CatStats {
  health: number;
  cleanliness: number;
  trust: number;
  satisfaction: number;
}

/** Pobyt mačky v hoteli: majiteľ, kedy príde po ňu a priebežná spokojnosť. */
export interface HotelStay {
  /** Hárok postavičky majiteľa. */
  owner: string;
  arrivedAt: number;
  checkoutAt: number;
  /** Súčet (spokojnosť+čistota)/2 × minúty a počet minút – priemer na konci pobytu. */
  happySum: number;
  minutes: number;
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
  /** Kde je pacient: garáž alebo karanténa v útulku (chýba = garáž). */
  ward?: 'garage' | 'quarantine';
  /** Zaočkovaná v ambulancii – vyšší príspevok pri adopcii. */
  vaccinated?: boolean;
  /** Kastrovaná na klinike – bonus ★ a lepšia zhoda pri adopcii. */
  neutered?: boolean;
  /** Rehabilitácia v bazéne po zlomenine/operácii – vyšší príspevok. */
  rehabbed?: boolean;
  /** Prišla ako prípad z inej útulne – bonus pri adopcii. */
  clinicCase?: boolean;
  /** Vzácny znak (GDD §7.2). */
  special?: RareMark;
  /** Ozdoba stálice (GDD §7.6) – id z cosmetics.json. */
  accessory?: string;
  /** Hosť mačacieho hotela (GDD §6.7) – nie je naša, majiteľ si ju vyzdvihne. */
  hotel?: HotelStay;
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

/** Objednávka hosťa v kaviarni. */
export type GuestOrder = 'coffee' | 'tea' | 'cake';

/** Hosť v mačacej kaviarni (GDD §5.5). */
export interface CafeGuest {
  id: string;
  /** Hárok postavičky (G5). */
  sprite: string;
  /** Index stola. */
  table: number;
  order: GuestOrder;
  served: boolean;
  /** Herný čas (ms simulácie) odchodu. */
  leaveAt: number;
  /** Stálica, ktorú si hosť pohladká. */
  catId: string | null;
  /** Obslúžil ho barista (menší dar ako hráč). */
  servedByStaff?: boolean;
}

export interface CafeState {
  open: boolean;
  /** Dokúpené stoly navyše. */
  tables: number;
  guests: CafeGuest[];
  /** Odpočet do ďalšieho hosťa (ms). */
  timer: number;
}

/** Čo odomyká úroveň útulku (GDD §6.1.1). */
export type Unlock =
  | 'cafe'
  | 'equipment_2'
  | 'equipment_3'
  | 'decor_2'
  | 'decor_3'
  | 'adopters_plus'
  | 'rare_cats'
  | 'shelter_2'
  | 'staff'
  | 'clinic'
  | 'catio'
  | 'hotel'
  | 'floors'
  | 'ct'
  | 'pool'
  | 'education';

export interface LevelDef {
  rep: number;
  name_key: string;
  unlocks: Unlock[];
}

/** Vybavenie so stupňami 1–3 (GDD §6.1.2). */
export interface EquipmentDef {
  id: string;
  name_key: string;
  desc_key: string;
  icon: string;
  /** Ceny 1., 2. a 3. stupňa. */
  prices: number[];
  /** Násobok účinku podľa stupňa (index 0 = nekúpené). */
  effect: number[];
}

/** Dekorácia na pevnom mieste (GDD §6.1.3). */
export interface DecorDef {
  id: string;
  name_key: string;
  room: 'garage' | 'cafe';
  sheet: 'interior' | 'clinic';
  frame: string;
  /** wall/floor = ľavý horný roh za všetkým; prop = stred spodnej hrany. */
  layer: 'wall' | 'floor' | 'prop';
  x: number;
  y: number;
  cozy: number;
  price: number;
  unlock?: Unlock;
  footprint?: number;
}

export type StaffId = 'caretaker' | 'vet' | 'barista' | 'social';

/** Člen personálu (GDD §6.4). */
/** Vzácne znaky mačky (GDD §7.2). */
export type RareMark = 'hetero' | 'poly' | 'tortie_male';

/** Kozmetika za srdiečka (GDD §7.6). */
export interface AccessoryDef {
  id: string;
  icon: string;
  price: number;
  color: string;
  extra: 'none' | 'bell' | 'bow' | 'bandana';
}
export interface WallColorDef {
  id: string;
  icon: string;
  price: number;
  color: string;
}
export interface CosmeticsData {
  hearts: {
    postcard: number;
    album: number;
    achievement: number;
    event_bonus: number;
    rare: number;
  };
  accessories: AccessoryDef[];
  walls: WallColorDef[];
}

/** Úspech (GDD §7.5). */
export interface AchievementDef {
  id: string;
  icon: string;
  kind: keyof Counters | 'residents' | 'album' | 'album_all' | 'level' | 'staff_all' | 'buildings';
  target: number;
  money: number;
}

/** Udalosť (GDD §7.3). */
export interface EventDef {
  id: 'winter' | 'openday' | 'mill';
  icon: string;
  min_level: number;
  requires?: 'cafe' | 'shelter';
  duration_s: number;
  goal: { kind: keyof Counters; target: number };
  money: number;
  rep: number;
  bonus_money: number;
  bonus_rep: number;
}
export interface EventsData {
  interval_s: number;
  first_delay_s: number;
  decline_delay_s: number;
  events: EventDef[];
}

export interface StaffDef {
  id: StaffId;
  name_key: string;
  desc_key: string;
  icon: string;
  sprite: string;
  price: number;
  room: 'garage' | 'cafe' | 'shelter';
  /** Má zmysel až s touto budovou. */
  requires?: 'cafe' | 'shelter';
}
