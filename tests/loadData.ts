import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GameData } from '../src/data/types';

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/data', name), 'utf-8')) as T;

/** Načíta herné dáta z public/data rovnako ako hra. */
export function loadTestData(): GameData {
  const breeds = read<{ breeds: GameData['breeds']; coats: GameData['coats'] }>('breeds.json');
  return {
    challenges: read<{ challenges: GameData['challenges'] }>('challenges.json').challenges,
    traits: read<{ traits: GameData['traits'] }>('traits.json').traits,
    conditions: read<{ conditions: GameData['conditions'] }>('conditions.json').conditions,
    breeds: breeds.breeds,
    coats: breeds.coats,
    adopters: read<{ adopters: GameData['adopters'] }>('adopters.json').adopters,
    reports: read<{ reports: GameData['reports'] }>('reports.json').reports,
    names: read<GameData['names']>('names.json'),
    balance: read<GameData['balance']>('balance.json'),
    equipment: read<{ equipment: GameData['equipment'] }>('equipment.json').equipment,
    decor: read<{ decor: GameData['decor'] }>('decor.json').decor,
    staff: read<{ staff: GameData['staff'] }>('staff.json').staff,
    achievements: read<{ achievements: GameData['achievements'] }>('achievements.json')
      .achievements,
    events: read<GameData['events']>('events.json'),
  };
}

/** Koľko ★ treba na úroveň n (1 = začiatok) – testy nezávislé od balansu. */
export function levelRep(n: number): number {
  return loadTestData().balance.levels[n - 1]?.rep ?? 0;
}
