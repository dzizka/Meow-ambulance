import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import type { CatData } from '../src/data/types';
import sk from '../src/i18n/sk.json';
import en from '../src/i18n/en.json';
import { loadTestData } from './loadData';

const data = loadTestData();
const b = data.balance;
const S = 1000;
const story = data.story!;
const levelRep = (lvl: number) => b.levels[lvl - 1]!.rep;

function rescue(s: GameState): CatData {
  s.tick(b.rescue.interval_s * S);
  const cat = s.acceptReport(s.reports[0]!.id)!;
  return cat;
}

function makeReady(cat: CatData, traits: string[]): void {
  cat.conditions.forEach((c) => {
    c.revealed = true;
    c.treated = true;
  });
  cat.stats = { health: 95, cleanliness: 50, trust: 80, satisfaction: 50 };
  cat.age = 'adult';
  cat.traits = traits.map((id) => ({ id, revealed: true }));
}

/** Prečíta všetky scénky, ktoré sú práve na rade. */
function readAll(s: GameState): string[] {
  const read: string[] = [];
  for (let beat = s.nextStoryBeat; beat; beat = s.nextStoryBeat) {
    s.markStorySeen(beat.id);
    read.push(beat.id);
  }
  return read;
}

describe('Príbeh pána Kováča (GDD §8)', () => {
  it('všetky texty a hovorcovia existujú v SK aj EN', () => {
    for (const dict of [sk, en] as Record<string, string>[]) {
      for (const beat of story.beats)
        for (const [who, key] of beat.lines) {
          expect(story.speakers[who], who).toBeDefined();
          expect(dict[key], key).toBeTruthy();
        }
      for (const sp of Object.values(story.speakers)) expect(dict[sp.name_key]).toBeTruthy();
    }
    expect(data.adopters.find((a) => a.id === story.neighbor)?.story).toBe(true);
  });

  it('scénky idú za sebou podľa záchran a úrovní', () => {
    const s = new GameState(data, 2);
    expect(s.nextStoryBeat).toBeNull();
    rescue(s);
    expect(readAll(s)).toEqual(['kovac_1']);
    s.reputation = levelRep(3); // preskočí úroveň 2 – scénky aj tak prídu v poradí
    expect(readAll(s)).toEqual(['kovac_2', 'kovac_3']);
    expect(s.nextStoryBeat).toBeNull();
  });

  it('sused nepríde náhodne, iba po pozvaní – a jeho adopcia uzavrie príbeh', () => {
    const s = new GameState(data, 4);
    const cat = rescue(s);
    makeReady(cat, ['lazy']);
    s.reputation = levelRep(3);
    readAll(s);
    for (let i = 0; i < 20; i++) {
      s.tick(b.adopters.interval_s * S);
      expect(s.adopters.some((v) => v.defId === story.neighbor)).toBe(false);
      s.adopters.length = 0;
    }

    s.reputation = levelRep(4);
    expect(readAll(s)).toEqual(['kovac_4']);
    expect(s.neighborWaiting).toBe(true);
    s.tick(b.adopters.interval_s * S);
    const visit = s.adopters.find((v) => v.defId === story.neighbor);
    expect(visit).toBeDefined();
    expect(s.matchFor(cat.id, visit!.id, false)?.quality).not.toBe('poor');

    const rec = s.adopt(cat.id, visit!.id)!;
    expect(rec.postcardDueAt).not.toBeNull();
    expect(s.story.neighborCat).toBe(cat.name);
    expect(s.neighborWaiting).toBe(false);
    expect(s.nextStoryBeat?.id).toBe('kovac_5');
    const hearts = s.hearts;
    s.markStorySeen('kovac_5');
    expect(s.hearts).toBe(hearts + story.final_hearts);
    expect(s.nextStoryBeat).toBeNull();
    // ❤ za záverečnú scénku iba raz
    expect(s.markStorySeen('kovac_5')).toBe(0);
  });

  it('slabá zhoda so susedom príbeh neuzavrie – príde znova', () => {
    const s = new GameState(data, 4);
    const cat = rescue(s);
    makeReady(cat, ['playful', 'curious']); // hravá k seniorovi a zvedavá do ticha nesedia
    s.reputation = levelRep(4);
    readAll(s);
    s.tick(b.adopters.interval_s * S);
    const visit = s.adopters.find((v) => v.defId === story.neighbor)!;
    expect(s.matchFor(cat.id, visit.id, false)?.quality).toBe('poor');
    s.adopt(cat.id, visit.id);
    expect(s.story.neighborCat).toBeNull();
    expect(s.neighborWaiting).toBe(true);
  });

  it('starý save bez príbehu ukáže iba scénku, kde hráč práve je', () => {
    const s = new GameState(data, 6);
    rescue(s);
    s.reputation = levelRep(4);
    const save = s.toSave(0);
    delete save.story;
    const loaded = GameState.fromSave(data, save);
    expect(loaded.story.seen).toEqual(['kovac_1', 'kovac_2', 'kovac_3']);
    expect(loaded.nextStoryBeat?.id).toBe('kovac_4');

    // nová hra bez záchrany: nič nevidela
    const fresh = GameState.fromSave(data, {
      ...new GameState(data, 1).toSave(0),
      story: undefined,
    });
    expect(fresh.story.seen).toEqual([]);
  });

  it('postup príbehu sa uloží', () => {
    const s = new GameState(data, 6);
    rescue(s);
    readAll(s);
    const loaded = GameState.fromSave(data, s.toSave(0));
    expect(loaded.story.seen).toEqual(['kovac_1']);
    expect(loaded.nextStoryBeat).toBeNull();
  });
});
