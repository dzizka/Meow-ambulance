import type { AgeGroup, CatData, GameData } from '../../data/types';
import { Rng } from '../Rng';

/** Vzácnosť 1–5 → váha výberu (bežné plemená sú oveľa častejšie). */
const rarityWeight = (rarity: number): number => Math.pow(2, 5 - rarity);

const AGE_WEIGHTS: Record<AgeGroup, number> = { kitten: 45, adult: 40, senior: 15 };

let idCounter = 0;

/** Vygeneruje novú mačku pri príjme do útulku (GDD §3.2). */
export function generateCat(data: GameData, rng: Rng, day = 1): CatData {
  const breed = rng.weighted(data.breeds, (b) => rarityWeight(b.rarity));
  const coat = rng.weighted(data.coats, (c) => rarityWeight(c.rarity));
  const age = rng.weighted(Object.keys(AGE_WEIGHTS) as AgeGroup[], (a) => AGE_WEIGHTS[a]);

  const coatNames = data.names.by_coat[coat.id] ?? [];
  const name =
    coatNames.length > 0 && rng.chance(0.3) ? rng.pick(coatNames) : rng.pick(data.names.generic);

  const traitCount = rng.chance(0.4) ? 2 : 1;
  const traits = rng.sample(data.traits, traitCount).map((t) => ({ id: t.id, revealed: false }));

  // 1–3 rôzne diagnózy podľa váh
  const conditionCount = rng.weighted([1, 2, 3], (n) => [50, 35, 15][n - 1] ?? 0);
  const pool = [...data.conditions];
  const conditions = [];
  for (let i = 0; i < conditionCount && pool.length > 0; i++) {
    const c = rng.weighted(pool, (x) => x.weight);
    pool.splice(pool.indexOf(c), 1);
    conditions.push({ id: c.id, revealed: false, treated: false });
  }

  const shy = traits.some((t) => t.id === 'shy' || t.id === 'wild');
  const dirty = conditions.some((c) => c.id === 'dirty');

  idCounter += 1;
  return {
    id: `cat-${day}-${idCounter}-${rng.int(1000, 9999)}`,
    name,
    age,
    breedId: breed.id,
    coatId: coat.id,
    sprite: breed.sprite_override ?? rng.pick(coat.sprites),
    traits,
    conditions,
    stats: {
      health: rng.int(25, 55),
      cleanliness: dirty ? rng.int(5, 25) : rng.int(30, 55),
      trust: shy ? rng.int(0, 15) : rng.int(10, 35),
      satisfaction: rng.int(25, 50),
    },
    admittedDay: day,
  };
}
