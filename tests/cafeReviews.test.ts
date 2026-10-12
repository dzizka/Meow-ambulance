import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import { levelRep, loadTestData } from './loadData';

const data = loadTestData();
const c = data.balance.cafe;

/** Kaviareň so stálicou a hosťom pri stole. */
function cafeWithGuest(seed: number): GameState {
  const s = new GameState(data, seed);
  s.devGive(5000, levelRep(2));
  s.devOpenCafe();
  s.devSpawnReport();
  const cat = s.acceptReport(s.reports[0]!.id)!;
  s.devHeal(cat.id);
  s.makeResident(cat.id);
  // počkať na hosťa (cez deň)
  for (let i = 0; i < 200 && s.cafe.guests.length === 0; i++) s.tick(5000);
  return s;
}

describe('Hodnotenie kaviarne (GDD §5.5)', () => {
  it('obslúžený hosť so spokojnou mačkou hodnotí lepšie ako neobslúžený', () => {
    const rate = (serve: boolean, happy: number) => {
      const s = cafeWithGuest(7);
      const g = s.cafe.guests[0]!;
      if (serve) s.serveGuest(g.id);
      s.residents.forEach((cat) => (cat.stats.satisfaction = happy));
      let stars = 0;
      let key = '';
      s.bus.on('guestLeft', ({ review }) => {
        stars ||= review.stars;
        key ||= review.key;
      });
      s.tick(c.guest_stay_s * 1000 + 1000);
      return { stars, key };
    };
    const good = rate(true, 90);
    const bad = rate(false, 20);
    expect(good.stars).toBeGreaterThan(bad.stars);
    expect(bad.key).toBe('REVIEW_NOT_SERVED');
    expect(good.key).toMatch(/REVIEW_(PERFECT|CAT_HAPPY)/);
  });

  it('priemer a vplyv na príchody hostí', () => {
    const s = cafeWithGuest(3);
    expect(s.ratingMult).toBe(1);
    s.cafe.reviews = Array.from({ length: 10 }, () => ({
      stars: 5,
      key: 'x',
      cat: '',
      sprite: '',
    }));
    expect(s.cafeRating).toBe(5);
    expect(s.ratingMult).toBeCloseTo(1 - c.rating_effect);
    s.cafe.reviews = Array.from({ length: 10 }, () => ({
      stars: 1,
      key: 'x',
      cat: '',
      sprite: '',
    }));
    expect(s.ratingMult).toBeCloseTo(1 + c.rating_effect);
  });
});
