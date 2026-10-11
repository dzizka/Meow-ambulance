import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { generateCat } from '../src/core/systems/CatGenerator';
import { Rng } from '../src/core/Rng';
import { levelRep, loadTestData } from './loadData';

const data = loadTestData();
const ev = data.events;
const def = (id: string) => ev.events.find((e) => e.id === id)!;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

describe('Udalosti (GDD §7.3)', () => {
  it('ponuka príde po čase od úrovne 2; dá sa odložiť', () => {
    const s = new GameState(data, 1);
    s.tick(ev.first_delay_s * 1000 + 100);
    expect(s.events.offer).toBeNull(); // úroveň 1
    s.devGive(0, levelRep(2));
    s.tick(ev.interval_s * 1000);
    expect(s.events.offer).not.toBeNull();
    s.declineEvent();
    expect(s.events.offer).toBeNull();
    s.tick((ev.decline_delay_s - 1) * 1000);
    expect(s.events.offer).toBeNull();
    s.tick(2000);
    expect(s.events.offer).not.toBeNull();
  });

  it('zima: 2× viac hlásení a podchladené mačky; odmena + bonus za cieľ', () => {
    const count = (winter: boolean) => {
      const s = new GameState(data, 2);
      s.devGive(10_000, levelRep(2));
      if (winter) {
        s.devOfferEvent('winter');
        s.acceptEvent();
      }
      let n = 0;
      s.bus.on('reportAdded', () => (n += 1));
      for (let i = 0; i < 10; i++) {
        s.tick(60_000);
        s.reports = [];
      }
      return n;
    };
    expect(count(true)).toBeGreaterThan(count(false));
    // podchladenie iba počas zimy
    const rng = new Rng(4);
    const gen = (event?: string) =>
      Array.from({ length: 200 }, () =>
        generateCat(data, rng, { id: 'c', tools: ['thermometer'], event }).conditions.map(
          (c) => c.id,
        ),
      ).flat();
    expect(gen().includes('hypothermia')).toBe(false);
    expect(gen('winter').includes('hypothermia')).toBe(true);
    // koniec s cieľom
    const s = new GameState(data, 3);
    s.devGive(10_000, levelRep(2));
    s.devOfferEvent('winter');
    s.acceptEvent();
    s.counters.rescued += def('winter').goal.target;
    const money = s.money;
    const rep = s.reputation;
    s.devEndEvent();
    expect(s.money - money).toBe(def('winter').money + def('winter').bonus_money);
    expect(s.reputation - rep).toBe(def('winter').rep + def('winter').bonus_rep);
    expect(s.events.done.winter).toBe(1);
  });

  it('udalosť nikdy nezlyhá – bez cieľa základná odmena', () => {
    const s = new GameState(data, 5);
    s.devGive(10_000, levelRep(2));
    s.devOpenCafe();
    s.devOfferEvent('openday');
    s.acceptEvent();
    const money = s.money;
    s.tick(def('openday').duration_s * 1000 + 100);
    expect(s.events.active).toBeNull();
    expect(s.money - money).toBeGreaterThanOrEqual(def('openday').money);
  });

  it('množiareň: veľká rodinka a dočasné klietky v karanténe', () => {
    const s = new GameState(data, 6);
    s.devGive(10_000, levelRep(4));
    s.devOpenShelter();
    const cages = s.quarantineCages;
    s.devOfferEvent('mill');
    s.acceptEvent();
    expect(s.quarantineCages).toBe(cages + 4);
    const r = s.reports.find((x) => x.defId === 'mill');
    expect(r).toBeDefined();
    const before = s.cats.length;
    s.acceptReport(r!.id);
    expect(s.cats.length - before).toBeGreaterThanOrEqual(5);
  });

  it('save v14: udalosť sa uloží; save v13 dostane prázdne udalosti', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = new GameState(data, 7);
    s.devGive(0, levelRep(2));
    s.devOfferEvent('winter');
    s.acceptEvent();
    saves.save(s);
    expect(saves.load(data)!.state.events.active?.id).toBe('winter');
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.events;
    old.version = 13;
    st.set('k', JSON.stringify(old));
    const m = saves.load(data)!.state;
    expect(m.events.active).toBeNull();
    expect(m.events.offer).toBeNull();
  });
});
