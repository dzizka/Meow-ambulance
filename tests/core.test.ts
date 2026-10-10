import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Rng } from '../src/core/Rng';
import { dirFromVector } from '../src/core/direction';
import { generateCat } from '../src/core/systems/CatGenerator';
import sk from '../src/i18n/sk.json';
import en from '../src/i18n/en.json';
import { loadTestData } from './loadData';

const data = loadTestData();

describe('Rng', () => {
  it('je deterministický pre rovnaký seed a dá sa obnoviť zo stavu', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
    const c = new Rng(a.getState());
    expect(c.next()).toBe(a.next());
  });

  it('sample vracia rôzne prvky', () => {
    expect(new Set(new Rng(1).sample([1, 2, 3, 4, 5], 3)).size).toBe(3);
  });
});

describe('CatGenerator', () => {
  const rng = new Rng(7);
  const cats = Array.from({ length: 300 }, (_, i) => generateCat(data, rng, { id: `c${i}` }));

  it('každá mačka má platné plemeno, farbu, rysy a 1–3 rôzne diagnózy', () => {
    for (const cat of cats) {
      expect(data.breeds.some((b) => b.id === cat.breedId)).toBe(true);
      expect(data.coats.some((c) => c.id === cat.coatId)).toBe(true);
      expect(cat.traits.length).toBeGreaterThanOrEqual(1);
      expect(cat.traits.length).toBeLessThanOrEqual(2);
      expect(cat.conditions.length).toBeGreaterThanOrEqual(1);
      expect(cat.conditions.length).toBeLessThanOrEqual(3);
      expect(new Set(cat.conditions.map((c) => c.id)).size).toBe(cat.conditions.length);
      expect(cat.conditions.every((c) => !c.revealed && !c.treated)).toBe(true);
      for (const v of Object.values(cat.stats)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('rešpektuje vek a počet diagnóz z hlásenia', () => {
    const cat = generateCat(data, new Rng(3), { id: 'x', age: 'senior', conditionCount: 3 });
    expect(cat.age).toBe('senior');
    expect(cat.conditions).toHaveLength(3);
  });

  it('bežné plemená sú častejšie ako vzácne', () => {
    const count = (id: string) => cats.filter((c) => c.breedId === id).length;
    expect(count('domestic_short')).toBeGreaterThan(count('siamese'));
  });

  it('každý hárok spritu, na ktorý dáta odkazujú, existuje (ak sú assety stiahnuté)', () => {
    const base = resolve(import.meta.dirname, '../public/assets/sprites');
    if (!existsSync(base)) return; // CI bez prístupu k súkromným assetom
    const cats = [
      ...data.coats.flatMap((c) => c.sprites),
      ...data.breeds.flatMap((b) => (b.sprite_override ? [b.sprite_override] : [])),
    ];
    for (const s of cats) expect(existsSync(`${base}/cats/popshop/${s}.png`), s).toBe(true);
    for (const s of data.adopters.flatMap((a) => a.sprites))
      expect(existsSync(`${base}/people/gbtl/${s}.png`), s).toBe(true);
  });
});

describe('dirFromVector', () => {
  it('mapuje pohyb na 8 smerov', () => {
    expect(dirFromVector(1, 0)).toBe('right');
    expect(dirFromVector(-1, 0)).toBe('left');
    expect(dirFromVector(0, 1)).toBe('down');
    expect(dirFromVector(0, -1)).toBe('up');
    expect(dirFromVector(1, 1)).toBe('down_right');
    expect(dirFromVector(-1, -1)).toBe('up_left');
  });
});

describe('Lokalizácia', () => {
  it('SK a EN majú rovnaké kľúče', () => {
    expect(Object.keys(sk).sort()).toEqual(Object.keys(en).sort());
  });

  it('každý kľúč z dát má preklad', () => {
    const keys = [
      ...data.traits.map((x) => x.name_key),
      ...data.conditions.map((x) => x.name_key),
      ...data.breeds.map((x) => x.name_key),
      ...data.coats.map((x) => x.name_key),
      ...data.reports.map((x) => x.name_key),
      ...data.adopters.flatMap((x) => [x.name_key, x.desc_key]),
      ...data.challenges.map((x) => x.name_key),
    ];
    for (const k of keys) expect(sk, k).toHaveProperty(k);
  });
});
