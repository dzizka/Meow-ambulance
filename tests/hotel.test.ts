import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { loadTestData } from './loadData';

const data = loadTestData();
const h = data.balance.hotel;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

function withHotel(): GameState {
  const s = new GameState(data, 11);
  s.devGive(20_000, 350);
  expect(s.buyHotel()).toBe(true);
  return s;
}

describe('Mačací hotel (GDD §6.7)', () => {
  it('kúpa od úrovne 6, apartmány sa dokupujú', () => {
    const s = new GameState(data, 1);
    s.money = 20_000;
    expect(s.buyHotel()).toBe(false);
    s.devGive(0, 350);
    expect(s.buyHotel()).toBe(true);
    expect(s.suiteCount).toBe(h.suites);
    expect(s.buySuite()).toBe(true);
    expect(s.suiteCount).toBe(h.suites + 1);
  });

  it('hostia prichádzajú cez deň, kým sú voľné apartmány', () => {
    const s = withHotel();
    for (let i = 0; i < 20; i++) s.tick(h.arrival_interval_s * 1000);
    expect(s.hotel.guests.length).toBeGreaterThan(0);
    expect(s.hotel.guests.length).toBeLessThanOrEqual(s.suiteCount);
    const g = s.hotel.guests[0]!;
    expect(g.hotel).toBeDefined();
    expect(g.conditions).toEqual([]);
    expect(s.getCat(g.id)).toBe(g);
    // hosť nie je naša mačka – nedá sa adoptovať ani nechať ako stálica
    expect(s.cats.includes(g)).toBe(false);
  });

  it('spokojný hosť zaplatí viac a prinesie ★', () => {
    const run = (care: boolean) => {
      const s = withHotel();
      s.devOpenHotel();
      const g = s.hotel.guests[0]!;
      const money = s.money;
      const rep = s.reputation;
      for (let i = 0; i < 40; i++) {
        if (care) {
          g.stats.satisfaction = 100;
          g.stats.cleanliness = 100;
        }
        s.tick(10_000);
      }
      s.devHotelCheckout();
      return { paid: s.money - money, rep: s.reputation - rep };
    };
    const good = run(true);
    const bad = run(false);
    expect(good.paid).toBeGreaterThan(bad.paid);
    expect(good.rep).toBeGreaterThanOrEqual(h.rep_happy);
  });

  it('hosťa sa dá nakŕmiť a ošetrovateľ sa oňho postará', () => {
    const s = withHotel();
    s.devOpenHotel();
    const g = s.hotel.guests[0]!;
    g.stats.satisfaction = 20;
    expect(s.feed(g.id)).toBe(true);
    g.stats.satisfaction = 20;
    g.lastFedAt = -1e12;
    s.hireStaff('caretaker');
    s.tick(data.balance.staff.caretaker.interval_s * 1000);
    expect(g.stats.satisfaction).toBeGreaterThan(20);
  });

  it('save v10: hostia sa uložia; save v9 má zatvorený hotel', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = withHotel();
    s.devOpenHotel();
    saves.save(s);
    const loaded = saves.load(data)!.state;
    expect(loaded.hotel.guests.length).toBe(1);
    expect(loaded.getCat(s.hotel.guests[0]!.id)).toBeDefined();
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.hotel;
    old.version = 9;
    st.set('k', JSON.stringify(old));
    const migrated = saves.load(data)!.state;
    expect(migrated.hotel.open).toBe(false);
    expect(migrated.counters.hotel).toBe(0);
  });
});
