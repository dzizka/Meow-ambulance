import { afterEach, describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import * as Late from '../src/core/systems/LateGame';
import type { CatData, GameData } from '../src/data/types';
import { levelRep, loadTestData } from './loadData';

const data = loadTestData();
const b = data.balance;
const S = 1000;
const today = GameState.today;

afterEach(() => {
  GameState.today = today;
});

function admit(s: GameState): CatData {
  s.tick(b.rescue.interval_s * S);
  const r = s.reports[0];
  const cat = r && s.acceptReport(r.id);
  if (!cat) throw new Error('mačka neprišla');
  return cat;
}

const entry = { name: 'Micka', sprite: 'black_0', how: 'adopted' as const, at: 0, count: 1 };

describe('Sezóny (GDD §7.3)', () => {
  it('Halloween a Vianoce podľa dátumu, Vianoce cez Nový rok', () => {
    const at = (m: number, d: number, y = 2026) => Late.seasonAt(data, new Date(y, m - 1, d))?.id;
    expect(at(10, 19)).toBeUndefined();
    expect(at(10, 20)).toBe('halloween');
    expect(at(11, 2)).toBe('halloween');
    expect(at(11, 3)).toBeUndefined();
    expect(at(12, 24)).toBe('christmas');
    expect(at(1, 6, 2027)).toBe('christmas');
    expect(at(1, 7, 2027)).toBeUndefined();
    expect(at(6, 15)).toBeUndefined();
    const xmas = b.seasons.list.find((x) => x.id === 'christmas')!;
    // Vianoce v januári patria k sezóne, ktorá sa začala v decembri
    expect(Late.seasonKey(xmas, new Date(2027, 0, 3))).toBe('christmas:2026');
    expect(Late.seasonKey(xmas, new Date(2026, 11, 3))).toBe('christmas:2026');
  });

  it('každá sezóna má svoje farby, ktoré nepadnú náhodne a nie sú v bežnom albume', () => {
    for (const season of b.seasons.list) {
      const coats = Late.seasonCoats(data, season.id);
      expect(coats.length).toBeGreaterThanOrEqual(4);
      for (const c of coats) {
        expect(c.special).toBe(true);
        expect(data.names.by_coat[c.id]?.length ?? 0).toBeGreaterThan(0);
      }
    }
    const s = new GameState(data, 1);
    expect(s.albumSlots.some((x) => data.coats.find((c) => c.id === x.coatId)?.season)).toBe(false);
  });

  it('v sezóne prídu sezónne mačky so sezónnym menom a zapíšu sa na sezónnu stranu', () => {
    GameState.today = () => new Date(2026, 9, 25);
    const always: GameData = {
      ...data,
      balance: { ...b, seasons: { ...b.seasons, chance: 1 } },
    };
    const s = new GameState(always, 3);
    expect(s.season?.id).toBe('halloween');
    const cat = admit(s);
    const coat = data.coats.find((c) => c.id === cat.coatId)!;
    expect(coat.season).toBe('halloween');
    expect(coat.sprites).toContain(cat.sprite);
    expect(data.names.by_coat[coat.id]).toContain(cat.name);
    cat.stats = { health: 100, trust: 100, cleanliness: 100, satisfaction: 100 };
    for (const c of cat.conditions) c.treated = true;
    s.tick(S);
    expect(s.makeResident(cat.id)).toBe(true);
    expect(s.album[`season:${coat.id}`]?.name).toBe(cat.name);
  });

  it('mimo sezóny neprídu a privítanie sa ukáže raz za sezónu', () => {
    const s = new GameState(data, 4);
    for (let i = 0; i < 5; i++) {
      const cat = admit(s);
      expect(data.coats.find((c) => c.id === cat.coatId)?.season).toBeUndefined();
      s.cats = [];
    }
    expect(s.takeSeasonGreeting()).toBeNull();
    GameState.today = () => new Date(2026, 11, 20);
    expect(s.takeSeasonGreeting()?.id).toBe('christmas');
    expect(s.takeSeasonGreeting()).toBeNull();
    GameState.today = () => new Date(2027, 0, 2);
    expect(s.takeSeasonGreeting()).toBeNull(); // stále tie isté Vianoce
    GameState.today = () => new Date(2027, 11, 2);
    expect(s.takeSeasonGreeting()?.id).toBe('christmas');
  });
});

describe('Strany albumu (GDD §7.1)', () => {
  it('dokončená strana dá raz ❤ a €', () => {
    const s = new GameState(data, 5);
    const done: string[] = [];
    s.bus.on('albumPageDone', (e) => done.push(e.page));
    const page = Late.albumPages(data).find((p) => p.id === 'breed:persian')!;
    for (const key of page.keys.slice(1)) s.album[key] = { ...entry };
    s.tick(S);
    expect(done).toEqual([]);
    s.album[page.keys[0]!] = { ...entry };
    const money = s.money;
    const hearts = s.hearts;
    s.tick(S);
    expect(done).toEqual(['breed:persian']);
    expect(s.albumPageDone('breed:persian')).toBe(true);
    expect(s.hearts - hearts).toBe(data.cosmetics.hearts.album_page);
    expect(Math.floor(s.money - money)).toBe(b.rewards.album_page_money);
    s.album['domestic_short:black'] = { ...entry };
    s.tick(S);
    expect(done).toEqual(['breed:persian']);
  });

  it('strany: 9 plemien, plemená s pevnou farbou, vzácnosti a sezóny', () => {
    const pages = Late.albumPages(data).map((p) => p.id);
    expect(pages).toContain('fixed');
    expect(pages).toContain('rare');
    expect(pages).toContain('season:halloween');
    expect(pages).toContain('season:christmas');
    expect(pages.filter((p) => p.startsWith('breed:'))).toHaveLength(
      data.breeds.filter((x) => !x.coat).length,
    );
  });

  it('starý save bez neskorej hry dostane odmeny za už hotové strany', () => {
    const s = new GameState(data, 6);
    for (const key of Late.albumPages(data).find((p) => p.id === 'rare')!.keys)
      s.album[key] = { ...entry };
    const save = s.toSave(0) as Partial<SaveData>;
    delete save.late;
    const loaded = GameState.fromSave(data, save as SaveData);
    expect(loaded.late.pages).toEqual([]);
    loaded.tick(S);
    expect(loaded.late.pages).toEqual(['rare']);
    // a po uložení a načítaní sa odmena nezopakuje
    const again = GameState.fromSave(data, loaded.toSave(0));
    const hearts = again.hearts;
    again.tick(S);
    expect(again.hearts).toBe(hearts);
  });
});

describe('Ocenenia (GDD §6.1.1)', () => {
  it('každých honors.every ★ nad poslednou úrovňou = ocenenie s odmenou', () => {
    const s = new GameState(data, 7);
    const top = levelRep(b.levels.length);
    const got: { n: number; gained: number }[] = [];
    s.bus.on('honorEarned', (e) => got.push(e));
    s.devGive(0, top + b.honors.every - 1);
    s.tick(S);
    expect(s.late.honors).toBe(0);
    const hearts = s.hearts;
    s.devGive(0, 1 + b.honors.every);
    s.tick(S);
    expect(s.late.honors).toBe(2);
    expect(got).toEqual([{ n: 2, gained: 2 }]);
    expect(s.hearts - hearts).toBe(2 * b.honors.hearts);
    expect(Late.honorRep(data, 3)).toBe(top + 3 * b.honors.every);
    expect(Late.honorTitleKey(data, 1)).toBe('HONOR_1');
    expect(Late.honorTitleKey(data, b.honors.titles + 1)).toBe('HONOR_1');
  });
});

describe('Nové udalosti (GDD §7.3)', () => {
  it('povodne: zachránené mačky prídu vystrašené a špinavé', () => {
    const cat = (seed: number) => {
      const s = new GameState(data, seed);
      s.devGive(0, levelRep(3));
      s.devOfferEvent('flood');
      s.acceptEvent();
      return admit(s);
    };
    // bez povodní má mačka dôveru 0–30, s nimi o 10 menej (max. 20)
    for (let seed = 20; seed < 30; seed++) {
      const wet = cat(seed);
      expect(wet.stats.trust).toBeLessThanOrEqual(20);
      expect(wet.stats.cleanliness).toBeLessThanOrEqual(20);
    }
  });

  it('bazár zdvojnásobí prepitné, prázdniny zdražia hotel', () => {
    const s = new GameState(data, 9);
    s.devOpenCafe();
    const tip = s.guestTip(true);
    s.devOfferEvent('bazaar');
    s.acceptEvent();
    expect(s.guestTip(true)).toBeCloseTo(tip * 2, 0);
    s.devEndEvent();

    s.devOpenHotel();
    const guest = s.hotel.guests[0]!;
    const fee = s.hotelFee(guest);
    s.devOfferEvent('holidays');
    s.acceptEvent();
    expect(s.hotelFee(guest)).toBeGreaterThan(fee);
  });

  it('udalosti pre hotel a edukačné centrum sa ponúknu až s budovou', () => {
    const s = new GameState(data, 10);
    s.devGive(0, levelRep(7));
    s.devOpenCafe();
    const offered = new Set<string>();
    for (let i = 0; i < 40; i++) {
      s.tick(data.events.interval_s * S);
      if (s.events.offer) offered.add(s.events.offer);
      s.declineEvent();
    }
    expect(offered.has('holidays')).toBe(false);
    expect(offered.has('schoolweek')).toBe(false);
    expect(offered.has('bazaar')).toBe(true);
    expect(offered.has('flood')).toBe(true);
  });
});
