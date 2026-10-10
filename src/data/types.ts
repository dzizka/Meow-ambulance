/** Typy herných dát. Zodpovedajú súborom v public/data/*.json. */

export type SocialActivity = 'feather' | 'brush' | 'hand_feed' | 'sit_quietly';
export type DiagnosticTool = 'hand' | 'thermometer' | 'stethoscope' | 'otoscope';
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
  tags: string[];
  age_pref: AgeGroup | 'any';
  dealbreakers: string[];
}

export interface NamesData {
  generic: string[];
  by_coat: Record<string, string[]>;
}

export interface BalanceData {
  day: { start_hour: number; end_hour: number; real_seconds_per_game_hour: number };
  stats_decay_per_hour: { cleanliness: number; satisfaction: number; trust: number };
  adoption_ready: { min_health: number; min_trust: number };
  match: Record<string, number>;
  rewards: Record<string, number | number[]>;
  costs: Record<string, number>;
  phase_1: { starting_money: number; cages: number; max_cages: number; cage_price: number };
}

/** Všetky statické dáta hry pohromade. */
export interface GameData {
  traits: TraitDef[];
  conditions: ConditionDef[];
  breeds: BreedDef[];
  coats: CoatDef[];
  adopters: AdopterDef[];
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
  admittedDay: number;
}
