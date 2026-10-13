import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import type { AdopterVisit, CatData } from '../src/data/types';
import sk from '../src/i18n/sk.json';
import en from '../src/i18n/en.json';
import { loadTestData } from './loadData';

const data = loadTestData();
const b = data.balance;
const S = 1000;
const FRIEND_CHANCE = b.adopters.friend_chance;

function readyCat(s: GameState): CatData {
  s.tick(b.rescue.interval_s * S);
  const cat = s.acceptReport(s.reports[0]!.id)!;
  cat.conditions.forEach((c) => {
    c.revealed = true;
    c.treated = true;
  });
  cat.stats = { health: 95, cleanliness: 50, trust: 80, satisfaction: 50 };
  cat.age = 'adult';
  cat.traits = [{ id: 'lazy', revealed: true }];
  return cat;
}

describe('Záujemcovia – obsah (GDD §5.1)', () => {
  it('každý typ má meno vo všetkých variantoch a opis v SK aj EN', () => {
    expect(data.adopters.length).toBeGreaterThanOrEqual(14);
    for (const dict of [sk, en] as Record<string, string>[]) {
      for (const a of data.adopters) {
        expect(dict[a.desc_key], a.desc_key).toBeTruthy();
        for (let v = 1; v <= (a.name_variants ?? 1); v++) {
          const key = v > 1 ? `${a.name_key}_${v}` : a.name_key;
          expect(dict[key], key).toBeTruthy();
        }
        for (const n of [1, 2])
          expect(dict[`POSTCARD_A_${a.id.toUpperCase()}_${n}`], a.id).toBeTruthy();
      }
      for (const tr of data.traits)
        expect(dict[`POSTCARD_PS_${tr.id.toUpperCase()}`], tr.id).toBeTruthy();
    }
  });

  it('pre každú povahu existuje záujemca, ku ktorému sa hodí', () => {
    const tags = new Set(data.adopters.flatMap((a) => a.tags));
    for (const tr of data.traits.filter((x) => x.adopt_good.length))
      expect(
        tr.adopt_good.some((g) => tags.has(g)),
        tr.id,
      ).toBe(true);
  });

  it('návšteva dostane variant mena v rozsahu typu', () => {
    const s = new GameState(data, 8);
    readyCat(s);
    for (let i = 0; i < 6; i++) {
      s.tick(b.adopters.interval_s * S);
      s.adopters.splice(0, s.adopters.length - 1);
    }
    for (const v of s.adopters) {
      const def = data.adopters.find((d) => d.id === v.defId)!;
      expect(v.variant).toBeGreaterThanOrEqual(1);
      expect(v.variant).toBeLessThanOrEqual(def.name_variants ?? 1);
    }
  });
});

describe('Kamarátka – záujemca sa vráti po druhú mačku', () => {
  it('po dokonalej adopcii príde rovnaký záujemca a druhá adopcia dá ★ navyše a istú pohľadnicu', () => {
    const s = new GameState(data, 5);
    const first = readyCat(s);
    const v1: AdopterVisit = { id: 'v1', defId: 'farmer', sprite: '019', variant: 2 };
    s.adopters.push(v1);
    first.traits = [{ id: 'brave', revealed: true }]; // statočná na farme = dokonalá zhoda
    const rec1 = s.adopt(first.id, v1.id)!;
    expect(rec1.score).toBeGreaterThanOrEqual(b.match.perfect);
    expect(rec1.adopterVariant).toBe(2);

    // vynútime návrat: šanca 100 %
    s.data.balance.adopters.friend_chance = 1;
    const second = readyCat(s);
    s.adopters.length = 0;
    s.tick(b.adopters.interval_s * S);
    const v2 = s.adopters.find((v) => v.friendOf);
    s.data.balance.adopters.friend_chance = FRIEND_CHANCE;
    expect(v2).toMatchObject({ defId: 'farmer', sprite: '019', variant: 2, friendOf: first.name });
    expect(rec1.friendVisited).toBe(true);

    const m = s.matchFor(second.id, v2!.id, false)!;
    expect(m.quality).not.toBe('poor');
    const repBefore = s.reputation;
    const rec2 = s.adopt(second.id, v2!.id)!;
    expect(rec2.friendOf).toBe(first.name);
    expect(rec2.postcardDueAt).not.toBeNull();
    const base = m.quality === 'perfect' ? b.rewards.rep_perfect : b.rewards.rep_good;
    expect(s.reputation - repBefore).toBe(base + b.adopters.friend_rep_bonus);
    expect(FRIEND_CHANCE).toBeLessThan(1);
  });

  it('bez dokonalej adopcie nikto po kamaráta nepríde', () => {
    const s = new GameState(data, 5);
    readyCat(s);
    s.data.balance.adopters.friend_chance = 1;
    s.tick(b.adopters.interval_s * S * 3);
    s.data.balance.adopters.friend_chance = FRIEND_CHANCE;
    expect(s.adopters.some((v) => v.friendOf)).toBe(false);
  });
});
