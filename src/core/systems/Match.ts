import type { AdopterDef, CatData, GameData } from '../../data/types';

export type MatchQuality = 'perfect' | 'good' | 'poor' | 'blocked';

export interface MatchResult {
  score: number;
  quality: MatchQuality;
  /** Rysy, ktoré sa hodia / nehodia (pre vysvetlenie hráčovi). */
  good: string[];
  bad: string[];
  /** Hráč ešte nepozná všetky rysy – skóre je iba odhad. */
  uncertain: boolean;
}

/**
 * Zhoda mačky a adoptéra (GDD §5.2).
 * S `onlyRevealed` počíta iba rysy, ktoré hráč už odhalil – to je odhad, ktorý vidí v hre.
 */
export function computeMatch(
  cat: CatData,
  adopter: AdopterDef,
  data: GameData,
  onlyRevealed = false,
): MatchResult {
  const m = data.balance.match;
  const traits = cat.traits.filter((t) => !onlyRevealed || t.revealed);
  const uncertain = traits.length < cat.traits.length;

  const blockedBy =
    adopter.dealbreakers.includes(cat.age) ||
    (adopter.dealbreakers.includes('senior_cat') && cat.age === 'senior') ||
    traits.some((t) => adopter.dealbreakers.includes(t.id));
  if (blockedBy) return { score: 0, quality: 'blocked', good: [], bad: [], uncertain };

  let score = m.base;
  const good: string[] = [];
  const bad: string[] = [];
  for (const t of traits) {
    const def = data.traits.find((d) => d.id === t.id);
    if (!def) continue;
    const plus = def.adopt_good.filter((tag) => adopter.tags.includes(tag)).length;
    const minus = def.adopt_bad.filter((tag) => adopter.tags.includes(tag)).length;
    score += plus * m.trait_good + minus * m.trait_bad;
    if (plus > minus) good.push(t.id);
    if (minus > plus) bad.push(t.id);
  }
  if (adopter.age_pref === cat.age) score += m.age_match;
  else if (adopter.age_pref === 'any') score += m.age_any;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const quality: MatchQuality = score >= m.perfect ? 'perfect' : score >= m.good ? 'good' : 'poor';
  return { score, quality, good, bad, uncertain };
}
