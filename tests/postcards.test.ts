import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import type { AdoptionRecord } from '../src/data/types';
import { generateCat } from '../src/core/systems/CatGenerator';
import { Rng } from '../src/core/Rng';
import { loadTestData } from './loadData';

const data = loadTestData();
const r = data.balance.rewards;
const rng = new Rng(1);

function fake(s: GameState, i: number, postcard: boolean): AdoptionRecord {
  void s;
  const cat = generateCat(data, rng, { id: `cat${i}`, tools: ['hand'] });
  return {
    cat,
    adopterDefId: data.adopters[0]!.id,
    adopterSprite: 'x',
    score: 90,
    fee: 50,
    adoptedAt: i,
    postcardDueAt: postcard ? 0 : null,
    postcardDelivered: false,
    postcardSeen: false,
  };
}

describe('Pošta – pohľadnice (GDD §7.1)', () => {
  it('uchová iba posledných N doručených, pripnuté navždy', () => {
    const s = new GameState(data, 3);
    for (let i = 0; i < r.postcard_keep * 2 + 40; i++) {
      s.adoptions.push(fake(s, i, i % 2 === 0));
    }
    s.tick(1000);
    expect(s.postcards.length).toBe(r.postcard_keep);
    expect(s.postcards[0]!.cat.id).toBe(`cat${r.postcard_keep * 2 + 38}`); // najnovšia párna
    // záznamy bez pohľadnice sa zahodia (okrem úplne poslednej adopcie)
    expect(s.adoptions.filter((a) => a.postcardDueAt === null).length).toBeLessThanOrEqual(1);

    const oldest = s.postcards[s.postcards.length - 1]!;
    expect(s.togglePin(oldest.cat.id)).toBe(true);
    for (let i = 0; i < 30; i++) s.adoptions.push(fake(s, 1000 + i, true));
    s.tick(1000);
    expect(s.postcards.some((p) => p.cat.id === oldest.cat.id)).toBe(true);
    expect(s.postcards.length).toBe(r.postcard_keep + 1);
  });

  it('pripnúť sa dá najviac postcard_pins pohľadníc', () => {
    const s = new GameState(data, 4);
    for (let i = 0; i < r.postcard_pins + 2; i++) s.adoptions.push(fake(s, i, true));
    s.tick(1000);
    const ids = s.postcards.map((p) => p.cat.id);
    for (let i = 0; i < r.postcard_pins; i++) expect(s.togglePin(ids[i]!)).toBe(true);
    expect(s.togglePin(ids[r.postcard_pins]!)).toBe(false);
    expect(s.togglePin(ids[0]!)).toBe(true); // odopnutie
    expect(s.pinnedCount).toBe(r.postcard_pins - 1);
  });
});
