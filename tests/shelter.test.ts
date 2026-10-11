import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { levelRep, loadTestData } from './loadData';

const data = loadTestData();
const b = data.balance.shelter;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

/** Hra pripravená na útulok: dosť ★, záchran a peňazí. */
function ready(): GameState {
  const s = new GameState(data, 11);
  s.devGive(5000, levelRep(4));
  s.counters.rescued = b.min_rescued;
  return s;
}

describe('Komunitný útulok (GDD §6.2)', () => {
  it('kúpa potrebuje ★, záchrany aj peniaze; garáž ostáva', () => {
    const s = new GameState(data, 1);
    s.money = 10_000;
    expect(s.buyShelter()).toBe(false); // málo ★ aj záchran
    expect(s.shelterMissing.rep).toBeGreaterThan(0);
    s.devGive(0, levelRep(4));
    expect(s.buyShelter()).toBe(false); // málo záchran
    expect(s.shelterMissing.rescued).toBe(b.min_rescued);
    s.counters.rescued = b.min_rescued;
    const cages = s.cageCount;
    expect(s.buyShelter()).toBe(true);
    expect(s.cageCount).toBe(cages); // garáž sa nemení
    expect(s.totalCages).toBe(cages + b.quarantine_cages);
    expect(s.tools).toContain('otoscope');
  });

  it('keď je garáž plná, nová mačka ide do karantény; dá sa presúvať', () => {
    const s = ready();
    s.buyShelter();
    for (let i = 0; i < s.cageCount; i++) {
      s.devSpawnReport();
      const c = s.acceptReport(s.reports[0]!.id)!;
      if (data.reports.find((r) => r.id === c.reportId)?.family) break;
    }
    // naplň garáž úplne
    while (s.freeIn('garage') > 0) {
      s.reports = [{ id: 'r-x' + s.cats.length, defId: 'box' }];
      s.acceptReport(s.reports[0]!.id);
    }
    s.reports = [{ id: 'r-q', defId: 'box' }];
    const q = s.acceptReport('r-q')!;
    expect(q.ward).toBe('quarantine');
    expect(s.moveCat(q.id)).toBe(false); // garáž je plná
    const g = s.wardCats('garage')[0]!;
    expect(s.moveCat(g.id)).toBe(true);
    expect(g.ward).toBe('quarantine');
    expect(s.moveCat(q.id)).toBe(true);
    expect(q.ward).toBe('garage');
  });

  it('mačacia rodinka: mama a 2–3 mačiatka rovnakej farby, potrebuje viac klietok', () => {
    const s = ready();
    s.buyShelter();
    s.reports = [{ id: 'r-fam', defId: 'family' }];
    expect(s.cagesNeeded('r-fam')).toBe(4);
    const before = s.cats.length;
    const mum = s.acceptReport('r-fam')!;
    const fam = s.cats.slice(before);
    expect(fam.length).toBeGreaterThanOrEqual(3);
    expect(fam.length).toBeLessThanOrEqual(4);
    expect(mum.age).toBe('adult');
    expect(new Set(fam.map((c) => c.name)).size).toBe(fam.length);
    for (const k of fam.slice(1)) {
      expect(k.age).toBe('kitten');
      expect(k.coatId).toBe(mum.coatId);
    }
  });

  it('rodinka chodí iba s útulkom; ušné roztoče iba s otoskopom', () => {
    const s = new GameState(data, 5);
    for (let i = 0; i < 40; i++) {
      s.reports = [];
      s.devSpawnReport();
      expect(s.reports[0]!.defId).not.toBe('family');
      const c = s.acceptReport(s.reports[0]!.id);
      if (c) {
        expect(c.conditions.some((x) => x.id === 'ear_mites')).toBe(false);
        s.cats = [];
      }
    }
  });

  it('očkovanie: iba zdravá mačka; zvýši príspevok a ★ pri adopcii', () => {
    const s = ready();
    s.buyShelter();
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    expect(s.vaccinate(cat.id)).toBe(false); // ešte chorá
    s.devHeal(cat.id);
    const clone = GameState.fromSave(data, s.toSave(0));
    expect(s.vaccinate(cat.id)).toBe(true);
    expect(s.vaccinate(cat.id)).toBe(false);
    expect(s.counters.vaccinated).toBe(1);
    // rovnaká adopcia s očkovaním a bez neho
    const adopt = (st: GameState) => {
      st.adopters = [];
      st.devSpawnAdopter();
      const visit = st.adopters[0]!;
      const repBefore = st.reputation;
      const rec = st.adopt(cat.id, visit.id);
      return rec ? { fee: rec.fee, rep: st.reputation - repBefore } : null;
    };
    const withVax = adopt(s);
    const without = adopt(clone);
    if (withVax && without) {
      expect(withVax.fee).toBeGreaterThan(without.fee);
      expect(withVax.rep).toBe(without.rep + b.vaccine_rep_bonus);
    }
  });

  it('save v6: útulok sa uloží; save v5 dostane zatvorený útulok', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = ready();
    s.buyShelter();
    saves.save(s);
    expect(saves.load(data)!.state.shelter.open).toBe(true);
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.shelter;
    old.version = 5;
    st.set('k', JSON.stringify(old));
    const migrated = saves.load(data)!.state;
    expect(migrated.shelter.open).toBe(false);
    expect(migrated.counters.vaccinated).toBe(0);
  });
});
