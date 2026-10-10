import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import type { CatData } from '../src/data/types';
import { loadTestData } from './loadData';

const data = loadTestData();
const c = data.balance.cafe;
const S = 1000;

function memoryStorage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

/** Hra s jednou stálicou a dosť peniazmi na kaviareň. */
function withResident(): { s: GameState; cat: CatData } {
  const s = new GameState(data, 3);
  s.tick(data.balance.rescue.interval_s * S);
  const cat = s.acceptReport(s.reports[0]!.id)!;
  cat.conditions.forEach((x) => {
    x.revealed = true;
    x.treated = true;
  });
  cat.stats = { health: 100, cleanliness: 80, trust: 90, satisfaction: 60 };
  expect(s.makeResident(cat.id)).toBe(true);
  s.money = 1000;
  return { s, cat };
}

describe('Mačacia kaviareň (GDD §5.5)', () => {
  it('kúpa pridá miesta pre stálice a zdvojnásobí dary', () => {
    const { s } = withResident();
    const slots = s.residentSlots;
    const rate = s.donationsPerMinute;
    expect(s.buyCafe()).toBe(true);
    expect(s.money).toBe(1000 - c.price);
    expect(s.residentSlots).toBe(slots + c.slots);
    expect(s.donationsPerMinute).toBeCloseTo(rate * c.donation_multiplier);
    expect(s.buyCafe()).toBe(false);
  });

  it('bez peňazí sa kúpiť nedá', () => {
    const { s } = withResident();
    s.money = c.price - 1;
    expect(s.buyCafe()).toBe(false);
    expect(s.cafe.open).toBe(false);
  });

  it('hostia prichádzajú iba so stálicou a najviac toľko, koľko je stolov', () => {
    const s = new GameState(data, 4);
    s.money = 1000;
    s.buyCafe();
    s.tick(c.guest_interval_s * 3 * S);
    expect(s.cafe.guests).toHaveLength(0); // žiadna stálica → nikto nepríde

    const { s: s2 } = withResident();
    s2.buyCafe();
    s2.tick(c.guest_first_delay_s * S);
    expect(s2.cafe.guests).toHaveLength(1);
    for (let i = 0; i < 10; i++) s2.tick(c.guest_interval_s * S * 0.2);
    expect(s2.cafe.guests.length).toBeLessThanOrEqual(s2.tableCount);
    const tables = s2.cafe.guests.map((g) => g.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it('obslúžený hosť nechá väčší dar a stálica je spokojnejšia', () => {
    const { s, cat } = withResident();
    s.buyCafe();
    s.tick(c.guest_first_delay_s * S);
    const g = s.cafe.guests[0]!;
    expect(s.serveGuest(g.id)).toBe(true);
    expect(s.serveGuest(g.id)).toBe(false);
    expect(s.counters.served).toBe(1);
    const tip = s.guestTip(true);
    expect(tip).toBeGreaterThan(s.guestTip(false));
    const sat = cat.stats.satisfaction;
    let left = 0;
    s.bus.on('guestLeft', ({ amount }) => (left = amount));
    s.tick(c.guest_stay_s * S);
    expect(left).toBeGreaterThan(0);
    expect(s.cafe.guests.find((x) => x.id === g.id)).toBeUndefined();
    expect(cat.stats.satisfaction).toBeGreaterThan(sat - 2); // pohladkanie vyváži pokles
  });

  it('ďalšie stoly sa dajú dokúpiť až po otvorení', () => {
    const { s } = withResident();
    expect(s.nextTablePrice).toBeNull();
    s.buyCafe();
    expect(s.nextTablePrice).toBe(c.table_prices[0]);
    expect(s.buyTable()).toBe(true);
    expect(s.tableCount).toBe(c.tables + 1);
  });

  it('výzva na hostí sa ponúka až s otvorenou kaviarňou', () => {
    const s = new GameState(data, 5);
    const offered = () => s.challenges.some((ch) => ch.defId === 'serve');
    for (let i = 0; i < 20 && !offered(); i++) {
      // vyprázdni nástenku a nechaj ju doplniť
      s.challenges = [];
      (s as unknown as { fillChallenges(): void }).fillChallenges();
      expect(offered()).toBe(false);
    }
    s.money = 1000;
    s.buyCafe();
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) {
      s.challenges = [];
      (s as unknown as { fillChallenges(): void }).fillChallenges();
      seen = offered();
    }
    expect(seen).toBe(true);
  });

  it('kaviareň a hostia sa uložia a načítajú; save v2 sa zmigruje', () => {
    const { s } = withResident();
    s.buyCafe();
    s.tick(c.guest_first_delay_s * S);
    const storage = memoryStorage();
    let clock = 1_000_000;
    const saves = new SaveManager(storage, 'k', () => clock);
    saves.save(s);
    clock += 1000;
    const loaded = saves.load(data)!.state;
    expect(loaded.cafe.open).toBe(true);
    expect(loaded.cafe.guests).toHaveLength(1);

    const v2 = JSON.parse(storage.get('k')!) as Partial<SaveData>;
    delete v2.cafe;
    v2.version = 2;
    storage.set('k', JSON.stringify(v2));
    const migrated = saves.load(data)!.state;
    expect(migrated.cafe.open).toBe(false);
    expect(migrated.counters.served).toBe(0);
  });
});
