import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { levelRep, loadTestData } from './loadData';

const data = loadTestData();
const e = data.balance.education;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

describe('Edukačné centrum (GDD §6.9)', () => {
  it('kúpa od úrovne 7 s kaviarňou', () => {
    const s = new GameState(data, 2);
    s.money = 20_000;
    s.devGive(0, levelRep(6));
    s.devOpenCafe();
    expect(s.buyEducation()).toBe(false);
    s.devGive(0, levelRep(7) - levelRep(6));
    expect(s.buyEducation()).toBe(true);
    expect(s.buyEducation()).toBe(false);
  });

  it('výlet príde cez deň a po prednáške odíde s darom a ★', () => {
    const s = new GameState(data, 3);
    s.devGive(20_000, levelRep(7));
    s.devOpenCafe();
    s.buyEducation();
    s.tick(e.first_delay_s * 1000 + 100);
    expect(s.education.trip).not.toBeNull();
    const kids = s.education.trip!.kids.length;
    const money = s.money;
    const rep = s.reputation;
    expect(s.giveLecture(3)).toBe(true);
    expect(s.education.trip).toBeNull();
    expect(s.money - money).toBeGreaterThanOrEqual(kids * e.donation_per_kid);
    expect(s.reputation - rep).toBe(e.rep_by_stars[3]);
    expect(s.counters.lectures).toBe(1);
  });

  it('nevyužitý výlet odíde sám s polovičným darom bez ★', () => {
    const s = new GameState(data, 4);
    s.devGive(20_000, levelRep(7));
    s.devSchoolTrip();
    const rep = s.reputation;
    const money = s.money;
    s.tick(e.wait_s * 1000 + 100);
    expect(s.education.trip).toBeNull();
    expect(s.reputation).toBe(rep);
    expect(s.money).toBeGreaterThan(money);
  });

  it('save v12: výlet sa uloží; staršie savy majú zatvorené centrum', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = new GameState(data, 5);
    s.devSchoolTrip();
    saves.save(s);
    expect(saves.load(data)!.state.education.trip).not.toBeNull();
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.education;
    old.version = 11;
    st.set('k', JSON.stringify(old));
    const m = saves.load(data)!.state;
    expect(m.education.open).toBe(false);
    expect(m.counters.lectures).toBe(0);
  });
});
