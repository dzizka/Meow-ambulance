import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Rng } from '../src/core/Rng';
import { EventBus } from '../src/core/EventBus';
import { TimeManager } from '../src/core/TimeManager';
import { GameState } from '../src/core/GameState';
import { generateCat } from '../src/core/systems/CatGenerator';
import sk from '../src/i18n/sk.json';
import en from '../src/i18n/en.json';
import { loadTestData } from './loadData';

const data = loadTestData();

describe('Rng', () => {
  it('je deterministický pre rovnaký seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.int(1, 6)]).toEqual([b.next(), b.next(), b.int(1, 6)]);
  });

  it('sample vracia rôzne prvky', () => {
    const picked = new Rng(1).sample([1, 2, 3, 4, 5], 3);
    expect(new Set(picked).size).toBe(3);
  });
});

describe('CatGenerator', () => {
  const rng = new Rng(7);
  const cats = Array.from({ length: 300 }, () => generateCat(data, rng));

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

  it('nikdy nie je pripravená na adopciu hneď po príjme', () => {
    const { min_health } = data.balance.adoption_ready;
    expect(cats.every((c) => c.stats.health < min_health)).toBe(true);
  });

  it('bežné plemená sú častejšie ako vzácne', () => {
    const count = (id: string) => cats.filter((c) => c.breedId === id).length;
    expect(count('domestic_short')).toBeGreaterThan(count('siamese'));
  });

  it('každý hárok spritu, na ktorý dáta odkazujú, existuje (ak sú assety stiahnuté)', () => {
    const dir = resolve(import.meta.dirname, '../public/assets/sprites/cats/popshop');
    if (!existsSync(dir)) return; // CI bez prístupu k súkromným assetom
    const sprites = [
      ...data.coats.flatMap((c) => c.sprites),
      ...data.breeds.flatMap((b) => (b.sprite_override ? [b.sprite_override] : [])),
    ];
    for (const s of sprites) expect(existsSync(resolve(dir, `${s}.png`)), s).toBe(true);
  });
});

describe('TimeManager', () => {
  it('posúva čas, hlási hodiny a koniec dňa', () => {
    const bus = new EventBus();
    const hours: number[] = [];
    let ended = 0;
    bus.on('hourChanged', (e) => hours.push(e.hour));
    bus.on('dayEnded', () => (ended += 1));
    const time = new TimeManager(bus, 7, 20, 30);
    expect(time.clock).toBe('07:00');
    time.update(30_000); // 30 s = 1 herná hodina
    expect(time.clock).toBe('08:00');
    time.setSpeed(3);
    time.update(10 * 60_000);
    expect(time.isDayOver).toBe(true);
    expect(time.clock).toBe('20:00');
    expect(ended).toBe(1);
    expect(hours[0]).toBe(8);
    time.startNextDay();
    expect([time.day, time.clock]).toEqual([2, '07:00']);
  });

  it('pauza zastaví čas', () => {
    const time = new TimeManager(new EventBus(), 7, 20, 30);
    time.setSpeed(0);
    time.update(60_000);
    expect(time.clock).toBe('07:00');
  });
});

describe('GameState', () => {
  it('prijme mačky iba do počtu klietok', () => {
    const state = new GameState(data, 3);
    const admitted: string[] = [];
    state.bus.on('catAdmitted', (e) => admitted.push(e.cat.id));
    expect(state.admitCat()).not.toBeNull();
    expect(state.admitCat()).not.toBeNull();
    expect(state.admitCat()).toBeNull();
    expect(admitted).toHaveLength(data.balance.phase_1.cages);
  });
});

describe('Lokalizácia', () => {
  it('SK a EN majú rovnaké kľúče', () => {
    expect(Object.keys(sk).sort()).toEqual(Object.keys(en).sort());
  });

  it('každý name_key z dát má preklad', () => {
    const keys = [
      ...data.traits.map((x) => x.name_key),
      ...data.conditions.map((x) => x.name_key),
      ...data.breeds.map((x) => x.name_key),
      ...data.coats.map((x) => x.name_key),
    ];
    for (const k of keys) expect(sk, k).toHaveProperty(k);
  });
});

describe('dirFromVector', () => {
  it('mapuje pohyb na 8 smerov', async () => {
    const { dirFromVector } = await import('../src/core/direction');
    expect(dirFromVector(1, 0)).toBe('right');
    expect(dirFromVector(-1, 0)).toBe('left');
    expect(dirFromVector(0, 1)).toBe('down');
    expect(dirFromVector(0, -1)).toBe('up');
    expect(dirFromVector(1, 1)).toBe('down_right');
    expect(dirFromVector(-1, -1)).toBe('up_left');
  });
});
