import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import type { CatData } from '../src/data/types';
import { loadTestData } from './loadData';

const data = loadTestData();
const b = data.balance;
const S = 1000;
const MIN = 60 * S;

/** Mačka pripravená na adopciu (vyliečená, zdravá, dôverčivá). */
function makeReady(cat: CatData): void {
  cat.conditions.forEach((c) => {
    c.revealed = true;
    c.treated = true;
  });
  cat.stats.health = 95;
  cat.stats.trust = 80;
}

function stateWithCat(seed = 5): { s: GameState; cat: CatData } {
  const s = new GameState(data, seed);
  s.tick(b.rescue.first_delay_s * S);
  const report = s.reports[0];
  if (!report) throw new Error('žiadne hlásenie');
  const cat = s.acceptReport(report.id);
  if (!cat) throw new Error('mačka neprišla');
  return { s, cat };
}

describe('Otvorený režim – hlásenia', () => {
  it('prvé hlásenie príde po pár sekundách, ďalšie po intervale, najviac 3', () => {
    const s = new GameState(data, 1);
    s.tick((b.rescue.first_delay_s - 1) * S);
    expect(s.reports).toHaveLength(0);
    s.tick(1 * S);
    expect(s.reports).toHaveLength(1);
    s.tick(b.rescue.interval_s * S * 10);
    expect(s.reports).toHaveLength(b.rescue.max_waiting);
  });

  it('prijatie hlásenia prinesie mačku s vekom a počtom diagnóz podľa hlásenia', () => {
    const { s, cat } = stateWithCat();
    expect(s.cats).toHaveLength(1);
    expect(s.reports).toHaveLength(0);
    expect(s.rescued).toBe(1);
    const def = data.reports.find((r) => r.id === cat.reportId);
    expect(cat.conditions).toHaveLength(def?.difficulty ?? -1);
    if (def?.age) expect(cat.age).toBe(def.age);
  });

  it('bez voľnej klietky sa hlásenie prijať nedá', () => {
    const s = new GameState(data, 2);
    s.tick(b.rescue.interval_s * S * 3);
    const ids = s.reports.map((r) => r.id);
    expect(s.acceptReport(ids[0] ?? '')).not.toBeNull();
    expect(s.acceptReport(ids[1] ?? '')).not.toBeNull();
    expect(s.acceptReport(ids[2] ?? '')).toBeNull();
    s.declineReport(ids[2] ?? '');
    expect(s.reports).toHaveLength(0);
  });
});

describe('Stálice a adopcia', () => {
  it('stálica uvoľní klietku a prináša dary', () => {
    const { s, cat } = stateWithCat();
    expect(s.makeResident(cat.id)).toBe(false); // ešte nie je vyliečená
    makeReady(cat);
    expect(s.makeResident(cat.id)).toBe(true);
    expect(s.freeCages).toBe(b.phase_1.cages);
    const before = s.money;
    s.tick(10 * MIN);
    expect(s.money).toBeGreaterThan(before);
  });

  it('adoptéri prichádzajú iba keď je nejaká mačka pripravená', () => {
    const { s, cat } = stateWithCat();
    s.tick(b.adopters.interval_s * S * 2);
    expect(s.adopters).toHaveLength(0);
    makeReady(cat);
    s.tick(b.adopters.interval_s * S);
    expect(s.adopters).toHaveLength(1);
  });

  it('adopcia dá príspevok a reputáciu, mačka odíde, pohľadnica príde neskôr', () => {
    const { s, cat } = stateWithCat(9);
    makeReady(cat);
    cat.age = 'adult';
    cat.traits = [{ id: 'lazy', revealed: true }];
    s.tick(b.adopters.interval_s * S);
    // vyber adoptéra bez dealbreakerov pre túto mačku
    const visit = s.adopters[0];
    if (!visit) throw new Error('nikto neprišiel');
    const m = s.matchFor(cat.id, visit.id, false);
    if (m?.quality === 'blocked') return;
    const money = s.money;
    const rec = s.adopt(cat.id, visit.id);
    expect(rec).not.toBeNull();
    expect(s.cats).toHaveLength(0);
    expect(s.adopters).toHaveLength(0);
    expect(s.money).toBeGreaterThanOrEqual(money + b.rewards.adoption_fee_min);
    expect(s.reputation).toBeGreaterThan(0);
    if (rec?.postcardDueAt) {
      s.tick(b.rewards.postcard_delay_s[1] * S);
      expect(rec.postcardDelivered).toBe(true);
    }
  });
});

describe('Offline (GDD §2.3)', () => {
  it('potreby neklesajú, hlásenia a dary pribúdajú, dary max. 8 h', () => {
    const { s, cat } = stateWithCat();
    makeReady(cat);
    s.makeResident(cat.id);
    const clean = cat.stats.cleanliness;
    const money = s.money;
    const summary = s.applyOffline(24 * 60 * MIN);
    expect(cat.stats.cleanliness).toBe(clean);
    expect(summary.reports).toBe(b.rescue.max_waiting);
    const maxDonation = b.residents.donation_per_min * 1.5 * b.residents.offline_cap_h * 60;
    expect(s.money - money).toBeLessThanOrEqual(maxDonation + 1);
    expect(summary.donations).toBeGreaterThan(0);
    expect(s.adopters).toHaveLength(0);
  });
});

describe('Ukladanie', () => {
  it('uloží a načíta hru vrátane offline času', () => {
    const mem = new Map<string, string>();
    const storage: SaveStorage = {
      get: (k) => mem.get(k) ?? null,
      set: (k, v) => void mem.set(k, v),
      remove: (k) => void mem.delete(k),
    };
    let wall = 1_000_000;
    const sm = new SaveManager(storage, 'test', () => wall);
    const { s, cat } = stateWithCat();
    s.examine(cat.id, 'hand');
    sm.save(s);

    wall += 30 * MIN;
    const loaded = sm.load(data);
    expect(loaded).not.toBeNull();
    const l = loaded?.state;
    expect(l?.cats[0]?.name).toBe(cat.name);
    expect(l?.cats[0]?.examined).toEqual(['hand']);
    expect(l?.cats[0]?.lastFedAt).toBe(cat.lastFedAt);
    expect(loaded?.offline.minutes).toBe(30);
    expect(l?.now).toBe(s.now + 30 * MIN);
  });

  it('poškodený save vráti null', () => {
    const sm = new SaveManager({ get: () => '{nie json', set: () => {}, remove: () => {} });
    expect(sm.load(data)).toBeNull();
  });
});
