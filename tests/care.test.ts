import { describe, expect, it } from 'vitest';
import type { CatData } from '../src/data/types';
import { Rng } from '../src/core/Rng';
import { generateCat } from '../src/core/systems/CatGenerator';
import * as Care from '../src/core/systems/Care';
import { computeMatch } from '../src/core/systems/Match';
import { loadTestData } from './loadData';

const data = loadTestData();

function makeCat(over: Partial<CatData> = {}): CatData {
  const cat = generateCat(data, new Rng(11), { id: 'c1' });
  return {
    ...cat,
    traits: [{ id: 'shy', revealed: false }],
    conditions: [
      { id: 'ticks', revealed: false, treated: false },
      { id: 'fever', revealed: false, treated: false },
    ],
    stats: { health: 40, cleanliness: 40, trust: 10, satisfaction: 40 },
    ...over,
  };
}

const adopter = (id: string) => {
  const a = data.adopters.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
};

describe('Značka nad mačkou', () => {
  it('nevyšetrená → ?, odhalená choroba → liečiť, zdravá a dôverčivá → pripravená', () => {
    const cat = makeCat();
    expect(Care.badgeFor(cat, data)).toBe('exam');
    Care.examine(cat, 'hand', data);
    expect(Care.badgeFor(cat, data)).toBe('treat');
    cat.conditions = [];
    expect(Care.badgeFor(cat, data)).toBe(null);
    cat.stats = { health: 100, cleanliness: 100, trust: 100, satisfaction: 100 };
    expect(Care.badgeFor(cat, data)).toBe('ready');
    cat.resident = true;
    expect(Care.badgeFor(cat, data)).toBe(null);
  });
});

describe('Starostlivosť', () => {
  it('ruka odhalí kliešte, teplomer horúčku', () => {
    const cat = makeCat();
    expect(Care.examine(cat, 'hand', data)).toEqual(['ticks']);
    expect(Care.examine(cat, 'thermometer', data)).toEqual(['fever']);
    expect(cat.examined).toEqual(['hand', 'thermometer']);
  });

  it('ošetriť sa dá iba odhalená a neošetrená diagnóza', () => {
    const cat = makeCat();
    expect(Care.treat(cat, 'ticks', 3, data)).toBe(false);
    Care.examine(cat, 'hand', data);
    expect(Care.treat(cat, 'ticks', 1, data)).toBe(true);
    expect(cat.stats.health).toBe(40 + 25);
    expect(Care.treat(cat, 'ticks', 3, data)).toBe(false);
  });

  it('tiché sedenie plachú mačku teší a prezradí jej povahu; potom si oddýchne', () => {
    const cat = makeCat();
    const r = Care.socialize(cat, 'sit_quietly', 2, 0, data);
    expect(r?.reaction).toBe('love');
    expect(r?.revealed).toEqual(['shy']);
    expect(cat.stats.trust).toBeGreaterThan(10 + data.balance.care.social_base_trust);
    expect(Care.socialize(cat, 'feather', 2, 1000, data)).toBeNull();
    const later = data.balance.care.social_cooldown_s * 1000;
    expect(Care.socialize(cat, 'feather', 2, later, data)?.reaction).toBe('meh');
  });

  it('kŕmenie má prestávku', () => {
    const cat = makeCat();
    expect(Care.feed(cat, 0, data)).toBe(true);
    expect(Care.feed(cat, 1000, data)).toBe(false);
    expect(Care.feed(cat, data.balance.care.feed_cooldown_s * 1000, data)).toBe(true);
  });

  it('čistota a spokojnosť klesajú najviac po podlahu, zdravie sa zotavuje až po liečbe', () => {
    const cat = makeCat({ stats: { health: 50, cleanliness: 20, trust: 10, satisfaction: 18 } });
    Care.passTime(cat, 60, data);
    expect(cat.stats.cleanliness).toBe(data.balance.stat_floor);
    expect(cat.stats.satisfaction).toBe(data.balance.stat_floor);
    expect(cat.stats.health).toBe(50);
    cat.conditions.forEach((c) => (c.treated = true));
    Care.passTime(cat, 5, data);
    expect(cat.stats.health).toBe(50 + 5 * data.balance.recovery_health_per_min);
  });

  it('pripravená = vyliečená + zdravie ≥ 80 + dôvera ≥ 60', () => {
    const cat = makeCat({ stats: { health: 90, cleanliness: 40, trust: 70, satisfaction: 40 } });
    expect(Care.isReady(cat, data)).toBe(false);
    cat.conditions.forEach((c) => (c.treated = true));
    expect(Care.isReady(cat, data)).toBe(true);
  });
});

describe('Zhoda s adoptérom (GDD §5.2)', () => {
  it('plachá dospelá mačka sa hodí k babke', () => {
    const cat = makeCat({ age: 'adult', traits: [{ id: 'shy', revealed: true }] });
    const m = computeMatch(cat, adopter('grandma'), data);
    // 50 + quiet_home 15 + age 10
    expect(m.score).toBe(75);
    expect(m.quality).toBe('good');
    expect(m.good).toEqual(['shy']);
  });

  it('hravé mačiatko je dokonalé pre rodinu s deťmi', () => {
    const cat = makeCat({ age: 'kitten', traits: [{ id: 'playful', revealed: true }] });
    const m = computeMatch(cat, adopter('family_kids'), data);
    expect(m.score).toBe(90);
    expect(m.quality).toBe('perfect');
  });

  it('dealbreaker zablokuje adopciu', () => {
    const kitten = makeCat({ age: 'kitten' });
    expect(computeMatch(kitten, adopter('grandma'), data).quality).toBe('blocked');
    const wild = makeCat({ traits: [{ id: 'wild', revealed: true }] });
    expect(computeMatch(wild, adopter('family_kids'), data).quality).toBe('blocked');
  });

  it('odhad počíta iba odhalené rysy', () => {
    const cat = makeCat({ age: 'adult', traits: [{ id: 'shy', revealed: false }] });
    const est = computeMatch(cat, adopter('grandma'), data, true);
    expect(est.uncertain).toBe(true);
    expect(est.score).toBe(60);
  });
});
