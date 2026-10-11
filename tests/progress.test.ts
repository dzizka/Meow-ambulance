import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import type { CatData } from '../src/data/types';
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
}

function admit(s: GameState): CatData {
  s.tick(b.rescue.interval_s * S);
  const r = s.reports[0];
  const cat = r && s.acceptReport(r.id);
  if (!cat) throw new Error('mačka neprišla');
  return cat;
}

function memoryStorage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

describe('Výzvy (GDD §7.3)', () => {
  it('na nástenke sú 3 rôzne výzvy', () => {
    const s = new GameState(data, 1);
    expect(s.challenges).toHaveLength(b.challenges.active);
    expect(new Set(s.challenges.map((c) => c.defId)).size).toBe(b.challenges.active);
  });

  it('postup sa počíta od zadania, splnená výzva sa dá vyzdvihnúť a príde nová s vyšším cieľom', () => {
    const s = new GameState(data, 4);
    s.challenges = [];
    s.counters.rescued = 5;
    // vynúť výzvu na záchranu
    (s as unknown as { fillChallenges(): void }).fillChallenges();
    const rescue = { defId: 'rescue', target: 2, start: s.counters.rescued, completed: false };
    s.challenges[0] = rescue;
    const completed: string[] = [];
    s.bus.on('challengeCompleted', (e) => completed.push(e.challenge.defId));
    admit(s);
    expect(s.challengeProgress(rescue)).toBe(1);
    admit(s);
    expect(rescue.completed).toBe(true);
    expect(completed).toContain('rescue');

    const money = s.money;
    const rep = s.reputation;
    const def = s.claimChallenge('rescue');
    expect(def?.money).toBeGreaterThan(0);
    expect(s.money).toBe(money + (def?.money ?? 0));
    expect(s.reputation).toBe(rep + (def?.rep ?? 0));
    expect(s.challenges).toHaveLength(b.challenges.active);
    expect(s.challengeTiers.rescue).toBe(1);
    expect(s.claimChallenge('rescue')).toBeNull();
  });

  it('výzva na stálice počíta aktuálny počet stálic', () => {
    const s = new GameState(data, 6);
    const ch = { defId: 'residents', target: 1, start: 0, completed: false };
    s.challenges[0] = ch;
    const cat = admit(s);
    makeReady(cat);
    s.makeResident(cat.id);
    expect(ch.completed).toBe(true);
  });
});

describe('Album (GDD §7.1)', () => {
  it('zapíše stálicu aj adoptovanú mačku, rovnaké políčko iba zvýši počet', () => {
    const s = new GameState(data, 8);
    const added: string[] = [];
    s.bus.on('albumAdded', (e) => added.push(e.key));
    const cat = admit(s);
    makeReady(cat);
    s.makeResident(cat.id);
    const key = GameState.albumKey(cat.breedId, cat.coatId);
    expect(s.album[key]?.how).toBe('resident');
    expect(added).toEqual([key]);
    const regularBreeds = data.breeds.filter((b) => !b.coat).length;
    const fixedBreeds = data.breeds.length - regularBreeds;
    const regularCoats = data.coats.filter((c) => !c.special).length;
    expect(s.albumSize).toBe(regularBreeds * regularCoats + fixedBreeds);
  });
});

describe('Vylepšenia garáže', () => {
  it('klietky a miesta v kútiku sa dajú dokúpiť do limitu', () => {
    const s = new GameState(data, 2);
    s.money = 1000;
    const cages = s.cageCount;
    expect(s.buyCage()).toBe(true);
    expect(s.cageCount).toBe(cages + 1);
    expect(s.money).toBe(1000 - (b.upgrades.cage_prices[0] ?? 0));
    expect(s.buyCage()).toBe(true);
    expect(s.nextCagePrice).toBeNull();
    expect(s.buyCage()).toBe(false);
    const slots = s.residentSlots;
    expect(s.buySlot()).toBe(true);
    expect(s.residentSlots).toBe(slots + 1);
  });

  it('bez peňazí sa kúpiť nedá', () => {
    const s = new GameState(data, 2);
    s.money = 10;
    expect(s.buyCage()).toBe(false);
    expect(s.money).toBe(10);
  });
});

describe('Tutoriál', () => {
  it('postupuje podľa toho, čo hráč urobil, a nevracia sa', () => {
    const s = new GameState(data, 3);
    expect(s.tutorialHint).toBe('TUT_REPORT');
    const cat = admit(s);
    expect(s.tutorialHint).toBe('TUT_EXAMINE');
    s.examine(cat.id, 'hand');
    s.examine(cat.id, 'thermometer');
    expect(s.tutorialHint).toBe('TUT_TREAT');
    for (const c of cat.conditions) s.treat(cat.id, c.id, 3);
    expect(s.tutorialHint).toBe('TUT_CARE');
    cat.stats.health = 95;
    cat.stats.trust = 80;
    expect(s.tutorialHint).toBe('TUT_READY');
    s.makeResident(cat.id);
    expect(s.tutorialHint).toBe('TUT_MENU');
    s.dismissTutorial();
    expect(s.tutorialHint).toBeNull();
  });
});

describe('Uloženie v2 a migrácia v1', () => {
  it('výzvy, album, vylepšenia a tutoriál sa uložia a načítajú', () => {
    const storage = memoryStorage();
    const sm = new SaveManager(storage, 'k', () => 0);
    const s = new GameState(data, 9);
    s.money = 999;
    s.buyCage();
    const cat = admit(s);
    makeReady(cat);
    s.makeResident(cat.id);
    sm.save(s);
    const l = sm.load(data)?.state;
    expect(l?.upgrades.cages).toBe(1);
    expect(l?.cageCount).toBe(s.cageCount);
    expect(Object.keys(l?.album ?? {})).toEqual(Object.keys(s.album));
    expect(l?.challenges.map((c) => c.defId)).toEqual(s.challenges.map((c) => c.defId));
    expect(l?.counters.rescued).toBe(1);
    expect(l?.rng.getState()).toBe(s.rng.getState());
  });

  it('starý save v1 sa prevedie a album sa doplní z adopcií', () => {
    const s = new GameState(data, 10);
    const cat = admit(s);
    makeReady(cat);
    s.makeResident(cat.id);
    const v2 = s.toSave(0) as unknown as Record<string, unknown>;
    // Simuluj formát v1 z M1
    const v1: Record<string, unknown> = { ...v2, version: 1, rescued: 1 };
    for (const k of [
      'counters',
      'challenges',
      'challengeTiers',
      'album',
      'upgrades',
      'tutorialStep',
      'tutorialDone',
    ])
      delete v1[k];
    const storage = memoryStorage();
    storage.set('k', JSON.stringify(v1));
    const l = new SaveManager(storage, 'k', () => 0).load(data)?.state;
    expect(l).toBeDefined();
    expect(l?.counters.rescued).toBe(1);
    expect(Object.keys(l?.album ?? {})).toHaveLength(1);
    expect(l?.challenges).toHaveLength(b.challenges.active);
    expect(l?.upgrades).toEqual({ cages: 0, slots: 0 });
  });
});
