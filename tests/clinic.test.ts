import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { generateCat } from '../src/core/systems/CatGenerator';
import { Rng } from '../src/core/Rng';
import { loadTestData } from './loadData';

const data = loadTestData();
const c = data.balance.clinic;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

/** Úroveň 5, útulok a peniaze na všetko. */
function ready(): GameState {
  const s = new GameState(data, 31);
  s.devGive(20_000, 200);
  s.devOpenShelter();
  return s;
}

describe('Klinika (GDD §6.5)', () => {
  it('budova potrebuje úroveň 5 a útulok; miestnosti sa kupujú zvlášť', () => {
    const s = new GameState(data, 1);
    s.money = 20_000;
    expect(s.buyClinic()).toBe(false); // málo ★
    s.devGive(0, 200);
    expect(s.clinicMissing.shelter).toBe(true);
    expect(s.buyClinic()).toBe(false); // bez útulku
    s.devOpenShelter();
    const money = s.money;
    expect(s.buyClinic()).toBe(true);
    expect(s.money).toBe(money - c.price);
    expect(s.tools).not.toContain('bloodtest');
    expect(s.buyClinicRoom('lab')).toBe(true);
    expect(s.buyClinicRoom('lab')).toBe(false);
    expect(s.tools).toContain('bloodtest');
    expect(s.buyClinicRoom('xray')).toBe(true);
    expect(s.tools).toContain('xray');
  });

  it('nové diagnózy padnú iba s nástrojom; operácia iba so sálou', () => {
    const gen = (tools: string[], surgery: boolean) => {
      const rng = new Rng(5);
      const ids = new Set<string>();
      for (let i = 0; i < 400; i++)
        for (const x of generateCat(data, rng, { id: 'c', tools, surgery, age: 'senior' })
          .conditions)
          ids.add(x.id);
      return ids;
    };
    const basic = gen(['hand', 'thermometer', 'stethoscope'], false);
    expect(basic.has('diabetes')).toBe(false);
    const lab = gen(['hand', 'bloodtest', 'xray'], false);
    expect(lab.has('kidney')).toBe(true);
    expect(lab.has('fracture')).toBe(true);
    expect(lab.has('swallowed')).toBe(false);
    expect(gen(['hand', 'xray'], true).has('swallowed')).toBe(true);
  });

  it('choroba obličiek iba u starších mačiek', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 300; i++) {
      const cat = generateCat(data, rng, { id: 'c', tools: ['bloodtest'], age: 'kitten' });
      expect(cat.conditions.some((x) => x.id === 'kidney')).toBe(false);
    }
  });

  it('prípad z inej útulne príde až s laboratóriom alebo röntgenom a má diagnózu kliniky', () => {
    const s = ready();
    const referral = () => {
      for (let i = 0; i < 80; i++) {
        s.reports = [];
        s.devSpawnReport();
        if (s.reports[0]?.defId === 'referral') return s.reports[0];
      }
      return null;
    };
    expect(referral()).toBeNull();
    s.buyClinic();
    s.buyClinicRoom('lab');
    const r = referral();
    expect(r).not.toBeNull();
    const cat = s.acceptReport(r!.id)!;
    expect(cat.clinicCase).toBe(true);
    const clinicIds = data.conditions.filter((d) => d.clinic).map((d) => d.id);
    expect(cat.conditions.some((x) => clinicIds.includes(x.id))).toBe(true);
  });

  it('prehltnutý predmet sa dá ošetriť iba s operačnou sálou', () => {
    const s = ready();
    s.buyClinic();
    s.buyClinicRoom('xray');
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    cat.conditions = [{ id: 'swallowed', revealed: true, treated: false }];
    expect(s.treat(cat.id, 'swallowed', 3)).toBe(false);
    s.buyClinicRoom('or');
    expect(s.treat(cat.id, 'swallowed', 3)).toBe(true);
  });

  it('kastrácia: iba dospelá zdravá mačka; vyšší príspevok, ★ a zhoda', () => {
    const adoptFee = (neuter: boolean) => {
      const s = ready();
      s.devOpenClinic();
      s.devSpawnReport();
      const cat = s.acceptReport(s.reports[0]!.id)!;
      cat.age = 'adult';
      s.devHeal(cat.id);
      if (neuter) {
        expect(s.canNeuter(cat)).toBe(true);
        expect(s.neuter(cat.id)).toBe(true);
        expect(s.neuter(cat.id)).toBe(false);
      }
      s.devSpawnAdopter();
      const visit = s.adopters[0]!;
      const score = s.matchFor(cat.id, visit.id)!.score;
      const rep = s.reputation;
      const rec = s.adopt(cat.id, visit.id);
      return { fee: rec?.fee ?? 0, rep: s.reputation - rep, score, blocked: !rec };
    };
    const plain = adoptFee(false);
    const neutered = adoptFee(true);
    if (!plain.blocked && !neutered.blocked) {
      expect(neutered.fee).toBeGreaterThan(plain.fee);
      expect(neutered.rep).toBeGreaterThanOrEqual(plain.rep + c.neuter_rep_bonus);
    }
    expect(neutered.score).toBeGreaterThanOrEqual(plain.score);
    const s = ready();
    s.devOpenClinic();
    s.devSpawnReport();
    const kitten = s.acceptReport(s.reports[0]!.id)!;
    kitten.age = 'kitten';
    s.devHeal(kitten.id);
    expect(s.canNeuter(kitten)).toBe(false);
  });

  it('veterinárka používa aj krvný test a röntgen', () => {
    const s = ready();
    s.devOpenClinic();
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.hireStaff('vet');
    for (let i = 0; i < s.tools.length; i++) s.tick(data.balance.staff.vet.interval_s * 1000);
    expect(cat.examined).toContain('bloodtest');
    expect(cat.examined).toContain('xray');
  });

  it('save v8: klinika sa uloží; save v7 dostane zatvorenú kliniku', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = ready();
    s.buyClinic();
    s.buyClinicRoom('or');
    saves.save(s);
    const loaded = saves.load(data)!.state;
    expect(loaded.hasClinicRoom('or')).toBe(true);
    expect(loaded.hasClinicRoom('lab')).toBe(false);
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.clinic;
    old.version = 7;
    st.set('k', JSON.stringify(old));
    const migrated = saves.load(data)!.state;
    expect(migrated.clinic).toEqual({ open: false, rooms: [] });
    expect(migrated.counters.neutered).toBe(0);
  });
});
