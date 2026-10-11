import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { levelRep, loadTestData } from './loadData';

const data = loadTestData();
const p = data.balance.staff;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

function withStaffUnlocked(): GameState {
  const s = new GameState(data, 21);
  s.devGive(10_000, levelRep(5));
  return s;
}

describe('Personál (GDD §6.4)', () => {
  it('najať sa dá až od úrovne 5; raz zaplatiť, dá sa vypnúť', () => {
    const s = new GameState(data, 1);
    s.money = 10_000;
    expect(s.hireStaff('caretaker')).toBe(false);
    s.devGive(0, levelRep(5));
    const money = s.money;
    expect(s.hireStaff('caretaker')).toBe(true);
    expect(s.money).toBe(money - data.staff.find((x) => x.id === 'caretaker')!.price);
    expect(s.hireStaff('caretaker')).toBe(false);
    expect(s.staffWorking('caretaker')).toBe(true);
    s.setStaffActive('caretaker', false);
    expect(s.staffWorking('caretaker')).toBe(false);
  });

  it('baristku sa dá najať až s kaviarňou', () => {
    const s = withStaffUnlocked();
    expect(s.hireStaff('barista')).toBe(false);
    s.devOpenCafe();
    expect(s.hireStaff('barista')).toBe(true);
  });

  it('ošetrovateľ nakŕmi hladnú a učeše špinavú mačku', () => {
    const s = withStaffUnlocked();
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    cat.stats.satisfaction = 20;
    cat.stats.cleanliness = 20;
    s.hireStaff('caretaker');
    s.tick(p.caretaker.interval_s * 1000);
    expect(s.counters.fed).toBe(1);
    s.tick(p.caretaker.interval_s * 1000);
    expect(cat.stats.cleanliness).toBeGreaterThan(20);
  });

  it('veterinárka postupne prehliadne novú mačku všetkými nástrojmi', () => {
    const s = withStaffUnlocked();
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.hireStaff('vet');
    for (let i = 0; i < s.tools.length; i++) s.tick(p.vet.interval_s * 1000);
    expect(cat.examined.length).toBe(s.tools.length);
    expect(cat.conditions.every((c) => c.revealed)).toBe(true);
  });

  it('baristka obslúži čakajúceho hosťa – dar je menší ako od hráča', () => {
    const s = withStaffUnlocked();
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.devHeal(cat.id);
    s.makeResident(cat.id);
    s.devOpenCafe();
    s.hireStaff('barista');
    s.devSpawnGuest();
    s.tick(p.barista.delay_s * 1000 + 100);
    expect(s.cafe.guests[0]!.served).toBe(true);
    expect(s.cafe.guests[0]!.servedByStaff).toBe(true);
    expect(s.guestTip(true, true)).toBeLessThan(s.guestTip(true, false));
    expect(s.guestTip(true, true)).toBeGreaterThan(s.guestTip(false));
  });

  it('správca sietí privedie záujemcov častejšie a viac naraz', () => {
    const count = (social: boolean) => {
      const s = withStaffUnlocked();
      s.devSpawnReport();
      const cat = s.acceptReport(s.reports[0]!.id)!;
      s.devHeal(cat.id);
      if (social) s.hireStaff('social');
      for (let i = 0; i < 30; i++) s.tick(30_000);
      return s.adopters.length;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });

  it('save v7: personál sa uloží; save v6 dostane prázdny tím', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = withStaffUnlocked();
    s.hireStaff('vet');
    s.setStaffActive('vet', false);
    saves.save(s);
    const loaded = saves.load(data)!.state;
    expect(loaded.isHired('vet')).toBe(true);
    expect(loaded.staffWorking('vet')).toBe(false);
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.staff;
    old.version = 6;
    st.set('k', JSON.stringify(old));
    expect(saves.load(data)!.state.staff).toEqual({});
  });
});
