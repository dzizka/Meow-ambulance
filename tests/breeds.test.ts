import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { Rng } from '../src/core/Rng';
import * as Care from '../src/core/systems/Care';
import { generateCat } from '../src/core/systems/CatGenerator';
import { loadTestData } from './loadData';

const data = loadTestData();

describe('Plemená a farby (GDD §4.4)', () => {
  it('je 12 plemien a 15 povách', () => {
    expect(data.breeds).toHaveLength(12);
    expect(data.traits).toHaveLength(15);
  });

  it('plemeno s pevnou farbou má vždy svoju farbu, špeciálne farby inak nepadnú', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 600; i++) {
      const cat = generateCat(data, rng, { id: `c${i}` });
      const breed = data.breeds.find((b) => b.id === cat.breedId)!;
      const coat = data.coats.find((c) => c.id === cat.coatId)!;
      if (breed.coat) expect(cat.coatId).toBe(breed.coat);
      else expect(coat.special).toBeFalsy();
      expect(coat.sprites).toContain(cat.sprite);
    }
  });

  it('dlhá srsť sa špiní rýchlejšie, sfinga takmer vôbec', () => {
    const base = generateCat(data, new Rng(1), { id: 'x' });
    const dirtAfter = (breedId: string) => {
      const cat = { ...structuredClone(base), breedId, traits: [] };
      cat.stats.cleanliness = 90;
      Care.passTime(cat, 10, data);
      return 90 - cat.stats.cleanliness;
    };
    expect(dirtAfter('persian')).toBeGreaterThan(dirtAfter('domestic_short'));
    expect(dirtAfter('sphynx')).toBeLessThan(dirtAfter('domestic_short'));
  });

  it('nezávislá mačka stráca spokojnosť pomalšie', () => {
    const base = generateCat(data, new Rng(2), { id: 'y' });
    const after = (trait: string) => {
      const cat = { ...structuredClone(base), traits: [{ id: trait, revealed: false }] };
      cat.stats.satisfaction = 90;
      Care.passTime(cat, 10, data);
      return cat.stats.satisfaction;
    };
    expect(after('independent')).toBeGreaterThan(after('shy'));
  });

  it('spoločenská stálica prinesie v kaviarni väčší dar', () => {
    const s = new GameState(data, 7);
    s.tick(data.balance.rescue.interval_s * 1000);
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.devHeal(cat.id);
    s.makeResident(cat.id);
    cat.traits = [{ id: 'lazy', revealed: true }];
    const plain = s.guestTip(false);
    cat.traits = [{ id: 'social', revealed: true }];
    expect(s.guestTip(false)).toBeGreaterThan(plain);
  });

  it('album: bežné plemená × bežné farby + jedno políčko za plemeno s pevnou farbou', () => {
    const s = new GameState(data, 1);
    const keys = s.albumSlots.map((x) => GameState.albumKey(x.breedId, x.coatId));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('siamese:seal_point');
    expect(keys).not.toContain('siamese:black');
  });

  it('save v3: siamská mačka a album dostanú farbu seal_point', () => {
    const mem = new Map<string, string>();
    const storage: SaveStorage = {
      get: (k) => mem.get(k) ?? null,
      set: (k, v) => void mem.set(k, v),
      remove: (k) => void mem.delete(k),
    };
    const s = new GameState(data, 3);
    s.tick(data.balance.rescue.interval_s * 1000);
    const cat = s.acceptReport(s.reports[0]!.id)!;
    cat.breedId = 'siamese';
    cat.coatId = 'black';
    const saves = new SaveManager(storage, 'k', () => 1000);
    saves.save(s);
    const old = JSON.parse(mem.get('k')!) as SaveData;
    old.version = 3;
    old.album = {
      'siamese:black': { name: 'A', sprite: 'seal_point_0', how: 'adopted', at: 0, count: 1 },
      'siamese:white': { name: 'B', sprite: 'seal_point_0', how: 'resident', at: 0, count: 2 },
    };
    mem.set('k', JSON.stringify(old));
    const loaded = saves.load(data)!.state;
    expect(loaded.cats[0]!.coatId).toBe('seal_point');
    expect(Object.keys(loaded.album)).toEqual(['siamese:seal_point']);
    expect(loaded.album['siamese:seal_point']!.count).toBe(3);
    expect(loaded.albumFilled).toBe(1);
  });
});
