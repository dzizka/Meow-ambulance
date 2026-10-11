import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { loadTestData } from './loadData';

const data = loadTestData();

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

describe('Catio (GDD §6.6)', () => {
  it('potrebuje úroveň 6 a kaviareň', () => {
    const s = new GameState(data, 3);
    s.money = 20_000;
    s.devGive(0, 200);
    expect(s.buyCatio()).toBe(false); // úroveň 5 nestačí
    s.devGive(0, 150);
    expect(s.catioMissing.cafe).toBe(true);
    expect(s.buyCatio()).toBe(false);
    s.devOpenCafe();
    const money = s.money;
    expect(s.buyCatio()).toBe(true);
    expect(s.money).toBe(money - data.balance.catio.price);
    expect(s.buyCatio()).toBe(false);
  });

  it('stáliciam s výbehom klesá spokojnosť pomalšie', () => {
    const drop = (catio: boolean) => {
      const s = new GameState(data, 4);
      s.devGive(10_000, 350);
      s.devSpawnReport();
      const cat = s.acceptReport(s.reports[0]!.id)!;
      s.devHeal(cat.id);
      s.makeResident(cat.id);
      if (catio) s.devOpenCatio();
      cat.stats.satisfaction = 90;
      s.tick(10 * 60_000);
      return 90 - cat.stats.satisfaction;
    };
    expect(drop(true)).toBeLessThan(drop(false));
  });

  it('save v9: výbeh sa uloží; save v8 ho nemá', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = new GameState(data, 5);
    s.devOpenCatio();
    saves.save(s);
    expect(saves.load(data)!.state.catio.open).toBe(true);
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.catio;
    old.version = 8;
    st.set('k', JSON.stringify(old));
    expect(saves.load(data)!.state.catio).toEqual({ open: false });
  });
});
