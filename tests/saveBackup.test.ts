import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { loadTestData } from './loadData';

const data = loadTestData();

function memStorage(): SaveStorage & { mem: Map<string, string> } {
  const mem = new Map<string, string>();
  return {
    mem,
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

function playedGame(): GameState {
  const s = new GameState(data, 3);
  s.tick(data.balance.rescue.first_delay_s * 1000);
  s.acceptReport(s.reports[0]!.id);
  s.money = 1234;
  return s;
}

describe('Záloha hry – export a import (GDD §10.3)', () => {
  it('kód z jedného zariadenia načíta rovnakú hru na druhom', () => {
    const a = new SaveManager(memStorage(), 'k', () => 1_000);
    const s = playedGame();
    a.save(s);
    const code = a.exportCode();
    expect(code?.startsWith('MEOW1:')).toBe(true);

    const other = memStorage();
    const b = new SaveManager(other, 'k', () => 1_000);
    // kód sa dá vložiť aj so zalomením riadkov a medzerami (kopírovanie z poznámok)
    const messy = `  ${code!.slice(0, 20)}\n${code!.slice(20)}  `;
    expect(b.importCode(messy, data)).toBe(true);
    const loaded = b.load(data)!.state;
    expect(loaded.money).toBe(1234);
    expect(loaded.cats.map((c) => c.name)).toEqual(s.cats.map((c) => c.name));
  });

  it('diakritika v menách prežije prenos', () => {
    const st = memStorage();
    const sm = new SaveManager(st, 'k', () => 0);
    const s = playedGame();
    s.cats[0]!.name = 'Pán Fúzik Žltučký';
    sm.save(s);
    const code = sm.exportCode()!;
    st.mem.clear();
    expect(sm.importCode(code, data)).toBe(true);
    expect(sm.load(data)!.state.cats[0]!.name).toBe('Pán Fúzik Žltučký');
  });

  it('neplatný alebo poškodený kód nič nezmení', () => {
    const st = memStorage();
    const sm = new SaveManager(st, 'k', () => 0);
    sm.save(playedGame());
    const before = st.get('k');
    const code = sm.exportCode()!;
    expect(sm.importCode('', data)).toBe(false);
    expect(sm.importCode('nahodny text', data)).toBe(false);
    expect(sm.importCode(code.slice(0, code.length / 2), data)).toBe(false);
    expect(sm.importCode('MEOW1:' + btoa('{"version":9999}'), data)).toBe(false);
    expect(st.get('k')).toBe(before);
  });

  it('bez uloženej hry nie je čo exportovať', () => {
    expect(new SaveManager(memStorage()).exportCode()).toBeNull();
  });
});
