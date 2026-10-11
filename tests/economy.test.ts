import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { loadTestData } from './loadData';

const data = loadTestData();
const levels = data.balance.levels;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

describe('Úrovne útulku (GDD §6.1.1)', () => {
  it('úroveň rastie s ★ a ohlási sa, čo sa odomklo', () => {
    const s = new GameState(data, 1);
    expect(s.level).toBe(0);
    expect(s.hasUnlock('cafe')).toBe(false);
    const ups: number[] = [];
    s.bus.on('levelUp', ({ level }) => ups.push(level));
    s.devGive(0, levels[1]!.rep);
    expect(s.level).toBe(1);
    expect(s.hasUnlock('cafe')).toBe(true);
    s.devGive(0, levels[3]!.rep); // preskočí dve úrovne naraz
    expect(ups).toEqual([1, 2, 3]);
    expect(s.nextLevelDef).toBe(levels[4]);
    expect(s.unlockRep('equipment_3')).toBe(levels[2]!.rep);
  });

  it('kaviareň sa nedá kúpiť pred 2. úrovňou', () => {
    const s = new GameState(data, 2);
    s.money = 10_000;
    expect(s.buyCafe()).toBe(false);
    s.devGive(0, levels[1]!.rep);
    expect(s.buyCafe()).toBe(true);
  });

  it('na 3. úrovni môže čakať o jedného záujemcu viac', () => {
    const s = new GameState(data, 3);
    s.tick(data.balance.rescue.interval_s * 1000);
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.devHeal(cat.id);
    const max = data.balance.adopters.max_waiting;
    for (let i = 0; i < max + 2; i++) s.devSpawnAdopter();
    expect(s.adopters).toHaveLength(max);
    s.devGive(0, levels[2]!.rep);
    s.devSpawnAdopter();
    expect(s.adopters).toHaveLength(max + 1);
  });
});

describe('Vybavenie (GDD §6.1.2)', () => {
  it('stupeň 2 treba odomknúť úrovňou ★; účinok sa prejaví', () => {
    const s = new GameState(data, 4);
    s.money = 10_000;
    s.tick(data.balance.rescue.interval_s * 1000);
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.feed(cat.id);
    const before = s.feedCooldownLeft(cat.id);
    expect(s.buyEquipment('feeder')).toBe(true);
    expect(s.feedCooldownLeft(cat.id)).toBeLessThan(before);
    expect(s.buyEquipment('feeder')).toBe(false); // stupeň 2 zamknutý
    s.devGive(0, levels[1]!.rep);
    expect(s.buyEquipment('feeder')).toBe(true);
    s.devGive(0, levels[2]!.rep);
    expect(s.buyEquipment('feeder')).toBe(true);
    expect(s.equipmentLevel('feeder')).toBe(3);
    expect(s.nextEquipmentPrice('feeder')).toBeNull();
    expect(s.buyEquipment('feeder')).toBe(false);
  });

  it('pelechy zvýšia dary stálic, hračky dôveru', () => {
    const s = new GameState(data, 5);
    s.money = 10_000;
    s.tick(data.balance.rescue.interval_s * 1000);
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.devHeal(cat.id);
    s.makeResident(cat.id);
    const rate = s.donationsPerMinute;
    const trust = s.trustMult;
    s.buyEquipment('beds');
    s.buyEquipment('toys');
    expect(s.donationsPerMinute).toBeGreaterThan(rate);
    expect(s.trustMult).toBeGreaterThan(trust);
  });

  it('bez peňazí sa kúpiť nedá', () => {
    const s = new GameState(data, 6);
    s.money = 10;
    expect(s.buyEquipment('medicine')).toBe(false);
  });
});

describe('Dekorácie a útulnosť (GDD §6.1.3)', () => {
  it('dekorácia pridá útulnosť; kaviarenské až po otvorení kaviarne; zamknuté podľa ★', () => {
    const s = new GameState(data, 7);
    s.money = 10_000;
    const garageFree = data.decor.find((d) => d.room === 'garage' && !d.unlock)!;
    const garageLocked = data.decor.find((d) => d.room === 'garage' && d.unlock === 'decor_2')!;
    const cafeFree = data.decor.find((d) => d.room === 'cafe' && !d.unlock)!;
    expect(s.buyDecor(garageFree.id)).toBe(true);
    expect(s.buyDecor(garageFree.id)).toBe(false); // už kúpená
    expect(s.coziness('garage')).toBe(garageFree.cozy);
    expect(s.buyDecor(garageLocked.id)).toBe(false);
    expect(s.buyDecor(cafeFree.id)).toBe(false); // kaviareň ešte nie je
    s.devGive(0, levels[1]!.rep);
    expect(s.buyDecor(garageLocked.id)).toBe(true);
    s.buyCafe();
    expect(s.buyDecor(cafeFree.id)).toBe(true);
    expect(s.coziness('cafe')).toBe(cafeFree.cozy);
  });

  it('útulnosť kaviarne zvýši dary hostí a útulnosť garáže dôveru', () => {
    const s = new GameState(data, 8);
    s.money = 10_000;
    s.devGive(0, levels[2]!.rep);
    s.devOpenCafe();
    s.tick(data.balance.rescue.interval_s * 1000);
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.devHeal(cat.id);
    s.makeResident(cat.id);
    const tip = s.guestTip(true);
    const trust = s.trustMult;
    for (const d of data.decor) s.buyDecor(d.id);
    expect(s.decor).toHaveLength(data.decor.length);
    expect(s.guestTip(true)).toBeGreaterThan(tip);
    expect(s.trustMult).toBeGreaterThan(trust);
  });

  it('dekorácie majú jedinečné id a existujúce miesto', () => {
    const ids = data.decor.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of data.decor) expect(['wall', 'floor', 'prop']).toContain(d.layer);
  });
});

describe('Uloženie (save v5)', () => {
  it('vybavenie a dekorácie sa uložia; save v4 dostane prázdne', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = new GameState(data, 9);
    s.money = 10_000;
    s.buyEquipment('toys');
    s.buyDecor(data.decor.find((d) => d.room === 'garage' && !d.unlock)!.id);
    saves.save(s);
    const loaded = saves.load(data)!.state;
    expect(loaded.equipmentLevel('toys')).toBe(1);
    expect(loaded.decor).toHaveLength(1);

    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.equipment;
    delete old.decor;
    old.version = 4;
    st.set('k', JSON.stringify(old));
    const migrated = saves.load(data)!.state;
    expect(migrated.equipment).toEqual({});
    expect(migrated.decor).toEqual([]);
  });
});
