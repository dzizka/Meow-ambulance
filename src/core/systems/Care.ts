import type { CatData, CatStats, DiagnosticTool, GameData, SocialActivity } from '../../data/types';

/** Hodnotenie minihry: 1–3 hviezdičky. Liečba vždy uspeje (GDD §4.2). */
export type Stars = 1 | 2 | 3;

const clamp = (v: number): number => Math.max(0, Math.min(100, v));

export function addStats(cat: CatData, delta: Partial<CatStats>): void {
  for (const [k, v] of Object.entries(delta) as [keyof CatStats, number][]) {
    cat.stats[k] = clamp(cat.stats[k] + v);
  }
}

/** Prehliadka nástrojom – odhalí diagnózy, ktoré tento nástroj vidí (GDD §4.1). */
export function examine(cat: CatData, tool: DiagnosticTool, data: GameData): string[] {
  if (!cat.examined.includes(tool)) cat.examined.push(tool);
  const found: string[] = [];
  for (const c of cat.conditions) {
    const def = data.conditions.find((d) => d.id === c.id);
    if (def?.reveal_tool === tool && !c.revealed) {
      c.revealed = true;
      found.push(c.id);
    }
  }
  return found;
}

/** Ošetrenie odhalenej diagnózy po minihre. */
export function treat(cat: CatData, conditionId: string, stars: Stars, data: GameData): boolean {
  const c = cat.conditions.find((x) => x.id === conditionId);
  const def = data.conditions.find((d) => d.id === conditionId);
  if (!c || !def || !c.revealed || c.treated) return false;
  c.treated = true;
  addStats(cat, {
    health: def.health_gain,
    cleanliness: def.cleanliness_gain ?? 0,
    satisfaction: stars * data.balance.care.treat_satisfaction_per_star,
  });
  return true;
}

export interface SocialResult {
  trustGain: number;
  /** love = sadlo jej to, meh = nebavilo ju to (GDD §4.3 – ✨ / 💢). */
  reaction: 'love' | 'ok' | 'meh';
  /** Rysy, ktoré sa touto aktivitou odhalili. */
  revealed: string[];
}

export function socialCooldownLeft(cat: CatData, now: number, data: GameData): number {
  return Math.max(0, cat.lastSocialAt + data.balance.care.social_cooldown_s * 1000 - now);
}

/** Socializácia – zvyšuje dôveru podľa povahy (GDD §4.3). Vráti null, ak si mačka oddychuje. */
export function socialize(
  cat: CatData,
  activity: SocialActivity,
  stars: Stars,
  now: number,
  data: GameData,
  /** Hračky a útulnosť garáže (GDD §6.1.2–3). */
  trustMult = 1,
): SocialResult | null {
  if (socialCooldownLeft(cat, now, data) > 0) return null;
  let mult = 1;
  const revealed: string[] = [];
  for (const t of cat.traits) {
    const m = data.traits.find((d) => d.id === t.id)?.social[activity] ?? 1;
    mult *= m;
    if (m !== 1 && !t.revealed) {
      t.revealed = true;
      revealed.push(t.id);
    }
  }
  const gain = Math.round(
    data.balance.care.social_base_trust * mult * trustMult * (0.7 + 0.15 * stars),
  );
  addStats(cat, {
    trust: gain,
    satisfaction: 4,
    cleanliness: activity === 'brush' ? data.balance.care.brush_cleanliness : 0,
  });
  cat.lastSocialAt = now;
  const reaction = mult > 1.05 ? 'love' : mult < 0.95 ? 'meh' : 'ok';
  (cat.reactions ??= {})[activity] = reaction;
  return { trustGain: gain, reaction, revealed };
}

/** `cooldownMult` = automatické kŕmidlo (GDD §6.1.2). */
export function feedCooldownLeft(
  cat: CatData,
  now: number,
  data: GameData,
  cooldownMult = 1,
): number {
  return Math.max(0, cat.lastFedAt + data.balance.care.feed_cooldown_s * 1000 * cooldownMult - now);
}

/** Kŕmenie – vždy zadarmo (GDD §6.1), iba s prestávkou. */
export function feed(cat: CatData, now: number, data: GameData, cooldownMult = 1): boolean {
  if (feedCooldownLeft(cat, now, data, cooldownMult) > 0) return false;
  const foodie = cat.traits.some((t) => t.id === 'foodie');
  addStats(cat, {
    satisfaction: data.balance.care.feed_satisfaction * (foodie ? 1.5 : 1),
    health: data.balance.care.feed_health,
  });
  if (foodie) {
    const t = cat.traits.find((x) => x.id === 'foodie');
    if (t) t.revealed = true;
  }
  cat.lastFedAt = now;
  return true;
}

export const allTreated = (cat: CatData): boolean => cat.conditions.every((c) => c.treated);

/** Pripravená na adopciu alebo na presun medzi stálice (GDD §3.3). */
export function isReady(cat: CatData, data: GameData): boolean {
  const r = data.balance.adoption_ready;
  return allTreated(cat) && cat.stats.health >= r.min_health && cat.stats.trust >= r.min_trust;
}

/** Značka nad mačkou v garáži – čo práve potrebuje (GDD §7.4). */
export type CatBadge = 'treat' | 'exam' | 'ready' | null;

export function badgeFor(cat: CatData, data: GameData): CatBadge {
  if (cat.resident || cat.hotel) return null;
  if (cat.conditions.some((c) => c.revealed && !c.treated)) return 'treat';
  if (cat.examined.length === 0) return 'exam';
  if (isReady(cat, data)) return 'ready';
  return null;
}

/** Zmeny štatistík za `minutes` hry, iba keď hra beží (GDD §3.3). */
/** Účinky vybavenia na plynutie času (GDD §6.1.2). */
export interface TimeMods {
  /** Mačací strom – pomalší pokles spokojnosti. */
  satisfactionDecay: number;
  /** Lekárnička – rýchlejšie uzdravovanie. */
  healthRecovery: number;
}
const NO_MODS: TimeMods = { satisfactionDecay: 1, healthRecovery: 1 };

export function passTime(
  cat: CatData,
  minutes: number,
  data: GameData,
  mods: TimeMods = NO_MODS,
): void {
  const b = data.balance;
  const floor = b.stat_floor;
  const dec = (v: number, by: number) => (v <= floor ? v : Math.max(floor, v - by));
  // Dlhá srsť sa zašpiní rýchlejšie, sfinga takmer vôbec; nezávislá mačka sa menej nudí
  const care = data.breeds.find((x) => x.id === cat.breedId)?.coat_care;
  const dirt = care === 'long' ? 1.5 : care === 'none' ? 0.3 : 1;
  const bored = cat.traits.some((t) => t.id === 'independent') ? 0.5 : 1;
  cat.stats.cleanliness = dec(cat.stats.cleanliness, b.decay_per_min.cleanliness * dirt * minutes);
  cat.stats.satisfaction = dec(
    cat.stats.satisfaction,
    b.decay_per_min.satisfaction * bored * mods.satisfactionDecay * minutes,
  );
  if (allTreated(cat))
    addStats(cat, { health: b.recovery_health_per_min * mods.healthRecovery * minutes });
}
