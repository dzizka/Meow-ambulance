import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import en from '../src/i18n/en.json';
import sk from '../src/i18n/sk.json';
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

describe('Úspechy (GDD §7.5)', () => {
  it('prvá záchrana odomkne úspech a pripíše odmenu raz', () => {
    const s = new GameState(data, 1);
    const unlocked: string[] = [];
    s.bus.on('achievementUnlocked', ({ def }) => unlocked.push(def.id));
    s.devSpawnReport();
    const money = s.money;
    s.acceptReport(s.reports[0]!.id);
    expect(unlocked).toContain('first_rescue');
    const reward = data.achievements.find((a) => a.id === 'first_rescue')!.money;
    expect(s.money).toBe(money + reward);
    s.tick(1000);
    expect(unlocked.filter((x) => x === 'first_rescue').length).toBe(1);
  });

  it('postup sa počíta z počítadiel, úrovne a stavieb', () => {
    const s = new GameState(data, 2);
    const lvl = data.achievements.find((a) => a.kind === 'level')!;
    expect(s.achievementProgress(lvl)).toEqual({ have: 1, need: lvl.target });
    const builder = data.achievements.find((a) => a.kind === 'buildings')!;
    expect(s.achievementProgress(builder).have).toBe(0);
    s.devOpenCafe();
    expect(s.achievementProgress(builder).have).toBe(1);
  });

  it('každý úspech má názov aj popis v oboch jazykoch', () => {
    for (const a of data.achievements) {
      for (const d of [sk, en] as Record<string, string>[]) {
        expect(d[`ACH_${a.id.toUpperCase()}`], a.id).toBeTruthy();
        expect(d[`ACHD_${a.kind.toUpperCase()}`], a.kind).toBeTruthy();
      }
    }
  });

  it('save v13: úspechy sa uložia; staršie savy ich dostanú dodatočne', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = new GameState(data, 3);
    s.devSpawnReport();
    s.acceptReport(s.reports[0]!.id);
    saves.save(s);
    expect(saves.load(data)!.state.achievements.first_rescue).toBeDefined();
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.achievements;
    old.version = 12;
    st.set('k', JSON.stringify(old));
    // úspechy za to, čo hráč už dokázal, sa odomknú hneď pri načítaní
    const m = saves.load(data)!.state;
    expect(m.achievements.first_rescue).toBeDefined();
  });
});
