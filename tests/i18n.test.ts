import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGS, langFromLocale } from '../src/i18n/t';
import type { GameData } from '../src/data/types';
import { loadTestData } from './loadData';

const data = loadTestData();
const read = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '..', path), 'utf-8')) as T;
const dict = (l: string) => read<Record<string, string>>(`src/i18n/${l}.json`);
const en = dict('en');
const vars = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe('Jazyky', () => {
  it('jazyk podľa prehliadača, čeština → slovenčina, inak nič', () => {
    expect(langFromLocale('de-AT')).toBe('de');
    expect(langFromLocale('es-419')).toBe('es');
    expect(langFromLocale('zh-CN')).toBe('zh');
    expect(langFromLocale('ko_KR')).toBe('ko');
    expect(langFromLocale('cs-CZ')).toBe('sk');
    expect(langFromLocale('EN-us')).toBe('en');
    expect(langFromLocale('fr-FR')).toBeNull();
  });

  for (const l of LANGS) {
    it(`${l}: všetky texty, rovnaké {premenné} ako angličtina`, () => {
      const d = dict(l);
      expect(Object.keys(d).sort()).toEqual(Object.keys(en).sort());
      for (const [k, v] of Object.entries(en)) {
        expect(vars(d[k] ?? ''), k).toEqual(vars(v));
        expect((d[k] ?? '').trim().length, k).toBeGreaterThan(0);
      }
    });

    it(`${l}: mená mačiek pre každú farbu a dosť všeobecných mien`, () => {
      const names = read<GameData['names']>(`public/data/names/${l}.json`);
      expect(names.generic.length).toBeGreaterThanOrEqual(60);
      expect(new Set(names.generic).size).toBe(names.generic.length);
      for (const c of data.coats) expect(names.by_coat[c.id]?.length ?? 0, c.id).toBeGreaterThan(3);
    });
  }
});
