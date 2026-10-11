import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { generateCat } from '../src/core/systems/CatGenerator';
import { Rng } from '../src/core/Rng';
import { loadTestData } from './loadData';

const data = loadTestData();
const h = data.cosmetics.hearts;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

function resident(s: GameState) {
  s.devSpawnReport();
  const cat = s.acceptReport(s.reports[0]!.id)!;
  s.devHeal(cat.id);
  s.makeResident(cat.id);
  return cat;
}

describe('Vzácne mačky (GDD §7.2)', () => {
  it('vzácne znaky sú zriedkavé, trojfarebný kocúr iba z trojfarebných', () => {
    const rng = new Rng(3);
    const marks: Record<string, number> = {};
    let calicoMales = 0;
    for (let i = 0; i < 4000; i++) {
      const c = generateCat(data, rng, { id: 'c' });
      if (c.special) marks[c.special] = (marks[c.special] ?? 0) + 1;
      if (c.special === 'tortie_male') {
        expect(c.coatId).toBe('calico');
        calicoMales += 1;
      }
    }
    expect((marks.hetero ?? 0) + (marks.poly ?? 0)).toBeGreaterThan(40);
    expect((marks.hetero ?? 0) + (marks.poly ?? 0)).toBeLessThan(400);
    expect(calicoMales).toBeGreaterThan(0);
  });

  it('vzácna mačka: vyšší príspevok, strana albumu a srdiečka', () => {
    const run = (special: boolean) => {
      const s = new GameState(data, 9);
      s.devSpawnReport();
      const cat = s.acceptReport(s.reports[0]!.id)!;
      if (special) cat.special = 'hetero';
      else delete cat.special;
      s.devHeal(cat.id);
      s.devSpawnAdopter();
      const hearts = s.hearts;
      const rec = s.adopt(cat.id, s.adopters[0]!.id);
      return { fee: rec?.fee ?? 0, s, hearts: s.hearts - hearts };
    };
    const a = run(false);
    const b = run(true);
    if (a.fee && b.fee) expect(b.fee).toBeGreaterThan(a.fee);
    expect(b.s.album['special:hetero']).toBeDefined();
    expect(b.hearts).toBeGreaterThanOrEqual(h.rare);
  });
});

describe('Srdiečka a kozmetika (GDD §7.6)', () => {
  it('srdiečka za nové políčko albumu a úspech; kúpa ozdoby a farby stien', () => {
    const s = new GameState(data, 4);
    const cat = resident(s); // album + úspechy
    expect(s.hearts).toBeGreaterThanOrEqual(h.album + h.achievement);
    const acc = data.cosmetics.accessories[0]!;
    s.hearts = 0;
    expect(s.buyCosmetic(acc.id)).toBe(false);
    s.hearts = 100;
    expect(s.buyCosmetic(acc.id)).toBe(true);
    expect(s.hearts).toBe(100 - acc.price);
    expect(s.buyCosmetic(acc.id)).toBe(false);
    expect(s.setAccessory(cat.id, acc.id)).toBe(true);
    expect(cat.accessory).toBe(acc.id);
    expect(s.setAccessory(cat.id, null)).toBe(true);
    expect(cat.accessory).toBeUndefined();
    const wall = data.cosmetics.walls[0]!;
    expect(s.setWall('garage', wall.id)).toBe(false);
    s.buyCosmetic(wall.id);
    expect(s.setWall('garage', wall.id)).toBe(true);
    expect(s.cosmetics.walls.garage).toBe(wall.id);
  });

  it('ozdobu má iba stálica', () => {
    const s = new GameState(data, 5);
    s.hearts = 100;
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    const acc = data.cosmetics.accessories[0]!;
    s.buyCosmetic(acc.id);
    expect(s.setAccessory(cat.id, acc.id)).toBe(false);
  });

  it('save v15: srdiečka a kozmetika sa uložia; staršie savy začnú s 0', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = new GameState(data, 6);
    s.hearts = 50;
    s.buyCosmetic(data.cosmetics.walls[1]!.id);
    s.setWall('cafe', data.cosmetics.walls[1]!.id);
    saves.save(s);
    const l = saves.load(data)!.state;
    expect(l.cosmetics.walls.cafe).toBe(data.cosmetics.walls[1]!.id);
    expect(l.hearts).toBe(50 - data.cosmetics.walls[1]!.price);
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.hearts;
    delete old.cosmetics;
    old.version = 14;
    st.set('k', JSON.stringify(old));
    const m = saves.load(data)!.state;
    expect(m.cosmetics).toEqual({ owned: [], walls: {} });
  });
});
