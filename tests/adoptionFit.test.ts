import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import * as Care from '../src/core/systems/Care';
import { computeMatch } from '../src/core/systems/Match';
import type { AdopterVisit, CatData } from '../src/data/types';
import { loadTestData } from './loadData';

const data = loadTestData();
const b = data.balance;
const S = 1000;

function makeReady(cat: CatData): void {
  cat.conditions.forEach((c) => {
    c.revealed = true;
    c.treated = true;
  });
  cat.stats.health = 95;
  cat.stats.trust = 80;
  cat.stats.cleanliness = 50;
  cat.stats.satisfaction = 50;
}

function stateWithCat(seed = 5): { s: GameState; cat: CatData } {
  const s = new GameState(data, seed);
  s.tick(b.rescue.first_delay_s * S);
  const cat = s.acceptReport(s.reports[0]!.id);
  if (!cat) throw new Error('mačka neprišla');
  return { s, cat };
}

/** Pridá záujemcu daného archetypu priamo (bez čakania na náhodu). */
function visit(s: GameState, defId: string): AdopterVisit {
  const v: AdopterVisit = { id: `v_${defId}`, defId, sprite: '000' };
  s.adopters.push(v);
  return v;
}

/** Plachá dospelá mačka u rodiny s deťmi = slabá zhoda (plachá sa k deťom nehodí). */
function poorAdoption(s: GameState, cat: CatData) {
  makeReady(cat);
  cat.age = 'adult';
  cat.traits = [{ id: 'shy', revealed: true }];
  const v = visit(s, 'family_kids');
  expect(s.matchFor(cat.id, v.id, false)?.quality).toBe('poor');
  return s.adopt(cat.id, v.id);
}

describe('Slabá adopcia – mačka sa vráti (GDD §5.2)', () => {
  it('po chvíli sa vráti do klietky smutnejšia a s nižšou dôverou', () => {
    const { s, cat } = stateWithCat();
    s.reputation = 40; // úroveň 2 od 25 ★
    const rec = poorAdoption(s, cat);
    expect(rec?.returnDueAt).toBeGreaterThan(s.now);
    expect(rec?.postcardDueAt).toBeNull();
    expect(s.cats).toHaveLength(0);
    const rep = s.reputation;
    const admitted: { returned?: boolean }[] = [];
    s.bus.on('catAdmitted', (e) => admitted.push(e));

    s.tick(b.rewards.return_delay_s[1] * S);
    expect(s.cats).toHaveLength(1);
    const back = s.cats[0]!;
    expect(back.name).toBe(cat.name);
    expect(back.stats.trust).toBe(80 - b.rewards.return_trust_loss);
    expect(back.stats.satisfaction).toBeLessThanOrEqual(b.rewards.return_satisfaction);
    expect(s.isReady(back)).toBe(false);
    expect(rec?.returned).toBe(true);
    expect(admitted).toEqual([{ cat: back, returned: true }]);
    expect(s.reputation).toBe(rep - b.rewards.return_rep_loss);

    // vráti sa iba raz
    s.tick(b.rewards.return_delay_s[1] * S);
    expect(s.cats).toHaveLength(1);
  });

  it('strata ★ nikdy nezníži úroveň', () => {
    const { s, cat } = stateWithCat();
    const lvl2 = b.levels[1]!.rep;
    s.reputation = lvl2 - b.rewards.rep_poor; // po adopcii presne na prahu úrovne 2
    poorAdoption(s, cat);
    expect(s.reputation).toBe(lvl2);
    s.tick(b.rewards.return_delay_s[1] * S);
    expect(s.reputation).toBe(lvl2);
    expect(s.level).toBe(1);
  });

  it('bez voľnej klietky počká, kým sa nejaká uvoľní', () => {
    const { s, cat } = stateWithCat();
    s.tick(b.rescue.interval_s * S * 2);
    const other = s.acceptReport(s.reports[0]!.id)!;
    poorAdoption(s, cat);
    s.acceptReport(s.reports[0]!.id);
    expect(s.freeCages).toBe(0);
    const before = s.cats.length;
    s.tick(b.rewards.return_delay_s[1] * S);
    expect(s.cats).toHaveLength(before);
    makeReady(other);
    expect(s.makeResident(other.id)).toBe(true);
    s.tick(S);
    expect(s.cats).toHaveLength(before + 1);
  });

  it('dobrá zhoda sa nevracia a čakajúci návrat prežije uloženie', () => {
    const { s, cat } = stateWithCat();
    poorAdoption(s, cat);
    const mem = new Map<string, string>();
    const storage: SaveStorage = {
      get: (k) => mem.get(k) ?? null,
      set: (k, v) => void mem.set(k, v),
      remove: (k) => void mem.delete(k),
    };
    const sm = new SaveManager(storage, 'test', () => 1_000_000);
    sm.save(s);
    const loaded = sm.load(data)!.state;
    loaded.tick(b.rewards.return_delay_s[1] * S);
    expect(loaded.cats).toHaveLength(1);

    const { s: s2, cat: cat2 } = stateWithCat(7);
    makeReady(cat2);
    cat2.age = 'adult';
    cat2.traits = [{ id: 'lazy', revealed: true }];
    const v = visit(s2, 'grandma');
    expect(s2.matchFor(cat2.id, v.id, false)?.quality).not.toBe('poor');
    expect(s2.adopt(cat2.id, v.id)?.returnDueAt).toBeUndefined();
  });
});

describe('Lesk – čistá a spokojná mačka (GDD §3.3)', () => {
  it('pridá zhodu, vyšší príspevok a istú pohľadnicu pri dobrej zhode', () => {
    const fee = (glow: boolean) => {
      const { s, cat } = stateWithCat(3);
      makeReady(cat);
      cat.age = 'adult';
      cat.traits = [{ id: 'lazy', revealed: true }];
      if (glow) {
        cat.stats.cleanliness = b.glow.min_cleanliness;
        cat.stats.satisfaction = b.glow.min_satisfaction;
      }
      expect(Care.isGlowing(cat, data)).toBe(glow);
      const def = data.adopters.find((a) => a.id === 'farmer')!;
      const m = computeMatch(cat, def, data);
      expect(m.glow).toBe(glow);
      const v = visit(s, 'farmer');
      const rec = s.adopt(cat.id, v.id)!;
      return { fee: rec.fee, score: m.score, postcard: rec.postcardDueAt !== null };
    };
    const dull = fee(false);
    const shiny = fee(true);
    expect(shiny.score).toBe(dull.score + b.match.glow_bonus);
    expect(shiny.fee).toBeGreaterThan(dull.fee);
    expect(shiny.postcard).toBe(true);
  });
});

describe('Stálica-pomocníčka (GDD §5.4)', () => {
  it('maznavá stálica urýchli dôveru plachého pacienta, nie ostatných', () => {
    const { s, cat: helper } = stateWithCat(4);
    makeReady(helper);
    helper.traits = [{ id: 'cuddly', revealed: false }];
    s.tick(b.rescue.interval_s * S);
    const shy = s.acceptReport(s.reports[0]!.id)!;
    shy.traits = [{ id: 'shy', revealed: false }];
    expect(s.helperMult(shy)).toBe(1);
    s.makeResident(helper.id);
    expect(s.helper).toBe(helper);
    expect(s.helperMult(shy)).toBe(1 + b.residents.helper_trust_bonus);
    shy.traits = [{ id: 'lazy', revealed: false }];
    expect(s.helperMult(shy)).toBe(1);
    expect(s.helperMult(helper)).toBe(1);
  });
});
