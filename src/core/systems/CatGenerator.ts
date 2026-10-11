import type { AgeGroup, CatCondition, CatData, GameData } from '../../data/types';
import { Rng } from '../Rng';

/** „Nikdy" pre časové značky (bezpečne sa uloží do JSON, na rozdiel od -Infinity). */
export const NEVER = -1e12;

/** Vzácnosť 1–5 → váha výberu (bežné plemená sú oveľa častejšie). */
const rarityWeight = (rarity: number): number => Math.pow(2, 5 - rarity);

const AGE_WEIGHTS: Record<AgeGroup, number> = { kitten: 45, adult: 40, senior: 15 };

export interface CatOptions {
  id: string;
  age?: AgeGroup | null;
  /** Počet diagnóz (1–3); ak chýba, náhodne. */
  conditionCount?: number;
  reportId?: string;
  now?: number;
  /** Úroveň ★ 4: vzácne plemená (vzácnosť 3+) 2× častejšie. */
  rareBoost?: boolean;
  /** Nástroje, ktoré hráč má – diagnózu, ktorú nemá čím odhaliť, mačka nedostane. */
  tools?: string[];
  /** Je operačná sála – inak mačka nedostane diagnózu, ktorá potrebuje operáciu. */
  surgery?: boolean;
  /** Prípad z inej útulne: prvá diagnóza je vždy diagnóza kliniky. */
  clinicCase?: boolean;
}

/** Vygeneruje novú mačku pri príjme do útulku (GDD §3.2). */
export function generateCat(data: GameData, rng: Rng, opts: CatOptions): CatData {
  const breed = rng.weighted(
    data.breeds,
    (b) => rarityWeight(b.rarity) * (opts.rareBoost && b.rarity >= 3 ? 2 : 1),
  );
  const fixed = breed.coat ? data.coats.find((c) => c.id === breed.coat) : undefined;
  const coat =
    fixed ??
    rng.weighted(
      data.coats.filter((c) => !c.special),
      (c) => rarityWeight(c.rarity),
    );
  const age =
    opts.age ?? rng.weighted(Object.keys(AGE_WEIGHTS) as AgeGroup[], (a) => AGE_WEIGHTS[a]);

  const coatNames = data.names.by_coat[coat.id] ?? [];
  const name =
    coatNames.length > 0 && rng.chance(0.3) ? rng.pick(coatNames) : rng.pick(data.names.generic);

  const traitCount = rng.chance(0.4) ? 2 : 1;
  const traits = rng.sample(data.traits, traitCount).map((t) => ({ id: t.id, revealed: false }));

  const conditionCount =
    opts.conditionCount ?? rng.weighted([1, 2, 3], (n) => [50, 35, 15][n - 1] ?? 0);
  const pool = data.conditions.filter(
    (c) =>
      (!opts.tools || opts.tools.includes(c.reveal_tool)) &&
      (!c.ages || c.ages.includes(age)) &&
      (c.minigame !== 'surgery' || opts.surgery),
  );
  const conditions: CatCondition[] = [];
  for (let i = 0; i < conditionCount && pool.length > 0; i++) {
    const clinicPool = i === 0 && opts.clinicCase ? pool.filter((x) => x.clinic) : [];
    const c = rng.weighted(clinicPool.length ? clinicPool : pool, (x) => x.weight);
    pool.splice(pool.indexOf(c), 1);
    conditions.push({ id: c.id, revealed: false, treated: false });
  }

  const shy = traits.some((t) => t.id === 'shy' || t.id === 'wild' || t.id === 'grumpy');
  const dirty = conditions.some((c) => c.id === 'dirty');

  return {
    id: opts.id,
    name,
    age,
    breedId: breed.id,
    coatId: coat.id,
    sprite: rng.pick(coat.sprites),
    traits,
    conditions,
    stats: {
      health: rng.int(25, 50),
      cleanliness: dirty ? rng.int(5, 25) : rng.int(30, 55),
      trust: shy ? rng.int(0, 12) : rng.int(10, 30),
      satisfaction: rng.int(25, 50),
    },
    examined: [],
    resident: false,
    lastSocialAt: NEVER,
    lastFedAt: NEVER,
    reportId: opts.reportId ?? '',
    ...(opts.clinicCase ? { clinicCase: true } : {}),
    admittedAt: opts.now ?? 0,
  };
}
